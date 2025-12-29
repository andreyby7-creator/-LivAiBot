/**
 * @file paymentRetryPolicy.ts – Payment Retry Policy Decision Engine
 *
 * Decision engine для retry-политик платежей в LivAiBot Billing Service.
 * Определяет стратегию, лимиты и задержки повторов на основе ошибок.
 *
 * Архитектурные принципы:
 * - Decision-only: только принятие решений, без исполнения
 * - Registry-driven: метаданные из BillingServiceErrorRegistry
 * - Effect-based: композиция через Effect (v3)
 * - Observable: структурированное логирование решений
 * - Type-safe: discriminated unions
 * - Детерминированность: одинаковый input → эквивалентное решение
 *   (допускается контролируемый jitter через dependency injection)
 *
 * Границы ответственности:
 * ✅ Анализ BillingServiceError
 * ✅ Решения retry / no-retry, стратегия, задержка
 * ✅ Интерпретация circuit breaker состояния
 * ✅ Явная обработка manual стратегии
 * ✅ Логирование решений
 *
 * ❌ Исполнение retry (sleep, Schedule, HTTP)
 * ❌ Хранение состояния circuit breaker
 * ❌ Таймеры и mutable state
 */

import { Effect } from 'effect';

import { getBillingErrorMetadata } from '../BillingServiceErrorRegistry.js';
import { getBillingServiceErrorCode } from '../BillingServiceErrorTypes.js';

import type { BillingServiceError } from '../BillingServiceErrorTypes.js';

// ==================== CONSTANTS ====================

/** Количество часов в сутках для расчета максимальной задержки */
const HOURS_PER_DAY = 24;

/** Количество минут в часе для расчета максимальной задержки */
const MINUTES_PER_HOUR = 60;

/** Количество секунд в минуте для расчета максимальной задержки */
const SECONDS_PER_MINUTE = 60;

/** Количество миллисекунд в секунде для расчета максимальной задержки */
const MS_PER_SECOND = 1000;

/** Максимальная общая задержка для всех retry попыток (24 часа) */
export const MAX_TOTAL_DELAY_MS = HOURS_PER_DAY
  * MINUTES_PER_HOUR
  * SECONDS_PER_MINUTE
  * MS_PER_SECOND;

/** Максимальное количество попыток по умолчанию */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Базовая задержка по умолчанию (5 секунд) */
export const DEFAULT_BASE_DELAY_MS = 5000;

/** Jitter ratio по умолчанию (20%) */
export const DEFAULT_JITTER_RATIO = 0.2;

/** Минимальное значение для генерации случайного jitter (-0.5 для диапазона [-1, 1]) */
const JITTER_RANDOM_MIN = -0.5;

/** Множитель для преобразования jitter в диапазон [-1, 1] */
const JITTER_RANGE_MULTIPLIER = 2;

/** База для экспоненциального роста в backoff стратегиях */
const BASE_FOR_EXPONENTIATION = 2;

// ==================== TYPES ====================

/**
 * Стратегия повтора платежа. Семантические алиасы поверх алгоритмов.
 *
 * provider_defined — автоматическая provider-specific стратегия (fallback к backoff)
 * manual — ручной повтор, обрабатывается вне automatic decision flow
 */
export type RetryStrategy =
  | 'immediate' // Немедленный повтор (без задержки)
  | 'fixed_delay' // Фиксированная задержка между попытками
  | 'exponential_backoff' // Экспоненциальное увеличение задержки
  | 'circuit_breaker' // Circuit breaker паттерн
  | 'provider_defined' // Определено провайдером (WebPay/BePaid specific)
  | 'manual'; // Ручной повтор (требует вмешательства)

/** Причина повтора для observability */
export type RetryReason =
  | 'infrastructure' // Инфраструктурная ошибка (network, timeout)
  | 'provider' // Ошибка провайдера (API, service unavailable)
  | 'timeout' // Таймаут операции
  | 'unknown'; // Неизвестная причина

/** Контекст повтора платежа. Минимальный, но достаточный для принятия решений */
export type RetryContext = {
  /** Номер текущей попытки (начиная с 1) */
  readonly attemptCount: number;
  /** Максимальное количество попыток */
  readonly maxAttempts: number;
  /** Выбранная стратегия повтора */
  readonly strategy: RetryStrategy;
  /** Базовая задержка в мс */
  readonly baseDelayMs: number;
  /** Время последней попытки (epoch ms) */
  readonly lastAttemptAtEpochMs: number;
  /** Общая накопленная задержка в мс */
  readonly totalDelayMs: number;
  /** Причина повтора для observability */
  readonly retryReason?: RetryReason;
};

/** Решение circuit breaker. Интерпретирует состояние, не хранит его */
export type CircuitBreakerDecision =
  | { readonly allow: true; readonly nextState: 'closed' | 'half_open'; }
  | { readonly allow: false; readonly nextState: 'open'; readonly retryAfterMs: number; };

/** Решение политики повтора. Discriminated union для type safety */
export type RetryDecision =
  | { readonly _tag: 'RetryAllowed'; readonly context: RetryContext; readonly delayMs: number; }
  | { readonly _tag: 'RetryDenied'; readonly reason: RetryDeniedReason; }
  | { readonly _tag: 'CircuitOpen'; readonly retryAfterMs: number; };

/** Конфигурация стратегии повтора */
export type RetryStrategyConfig = {
  /** Максимальное количество попыток */
  readonly maxAttempts: number;
  /** Базовая задержка в мс */
  readonly baseDelayMs: number;
  /** Максимальная общая задержка в мс */
  readonly maxTotalDelayMs: number;
  /** Jitter ratio (0.0 - 1.0) */
  readonly jitterRatio?: number;
};

/** Конфигурация политики повтора (input, policy не владеет конфигурацией) */
export type RetryPolicyConfig = {
  /** Конфигурации для каждой стратегии */
  readonly strategies: Record<RetryStrategy, RetryStrategyConfig>;
};

// ==================== BACKOFF CALCULATORS ====================

/** Функция расчета задержки для стратегии */
export type BackoffCalculator = (context: RetryContext, config: RetryStrategyConfig) => number;

/** Тип автоматических retry стратегий (исключая manual) */
export type AutomaticRetryStrategy = Exclude<RetryStrategy, 'manual'>;

/**
 * Маппинг значений стратегий из registry в RetryStrategy
 * Registry может содержать семантические значения, которые нужно преобразовать в технические стратегии
 */
export function mapRegistryStrategyToRetryStrategy(
  registryStrategy: string | undefined,
): RetryStrategy | undefined {
  switch (registryStrategy) {
    case 'immediate':
      return 'immediate';
    case 'delayed':
      return 'exponential_backoff'; // delayed -> exponential_backoff
    case 'manual':
      return 'manual';
    default:
      return undefined;
  }
}

/** Реестр backoff-calculators для автоматических retry стратегий (OCP, registry-driven) */
const exponentialBackoffCalculator: BackoffCalculator = (context, config) => {
  const attempt = Math.max(1, context.attemptCount - 1); // первая попытка = 0
  return config.baseDelayMs * Math.pow(BASE_FOR_EXPONENTIATION, attempt);
};

const BACKOFF_CALCULATORS_MAP = new Map<AutomaticRetryStrategy, BackoffCalculator>([
  ['immediate', (): number => 0],

  [
    'fixed_delay',
    (_context: RetryContext, config: RetryStrategyConfig): number => config.baseDelayMs,
  ],

  ['exponential_backoff', exponentialBackoffCalculator],

  ['circuit_breaker', (_context: RetryContext, config: RetryStrategyConfig): number => {
    // Circuit breaker использует свою логику через CircuitBreakerDecision
    return config.baseDelayMs;
  }],

  ['provider_defined', (context: RetryContext, config: RetryStrategyConfig): number => {
    // Provider-defined стратегия использует provider-specific логику
    // Fallback к exponential backoff
    return exponentialBackoffCalculator(context, config);
  }],
]);

/**
 * Получает backoff-calculator для автоматической стратегии (registry-driven, OCP).
 * 'manual' обрабатывается отдельно и не включается в калькулятор.
 * Выбрасывает Error при неизвестной стратегии для полной safety в production.
 */
export const getBackoffCalculator = (
  strategy: AutomaticRetryStrategy,
): BackoffCalculator => {
  const calculator = BACKOFF_CALCULATORS_MAP.get(strategy);
  if (!calculator) {
    throw new Error(`Unknown retry strategy: ${strategy}`);
  }
  return calculator;
};

/**
 * Применяет jitter к задержке (детерминированно, с возможностью подставить random для тестов)
 * @param delayMs Базовая задержка
 * @param jitterRatio Коэффициент jitter (0.0 - 1.0)
 * @param random Функция генерации случайного числа (по умолчанию Math.random)
 */
export function applyJitter(
  delayMs: number,
  jitterRatio: number = DEFAULT_JITTER_RATIO,
  random: () => number = Math.random,
): number {
  if (jitterRatio <= 0) return delayMs;

  const jitterAmount = delayMs * jitterRatio;
  // Преобразование random() ∈ [0,1] → random() + (-0.5) ∈ [-0.5,0.5] → * 2 ∈ [-1,1] → ±jitterAmount
  const randomJitter = (random() + JITTER_RANDOM_MIN) * JITTER_RANGE_MULTIPLIER * jitterAmount;

  return Math.max(0, Math.floor(delayMs + randomJitter));
}

// ==================== DECISION ENGINE ====================

/**
 * Оценивает политику повторов платежа.
 * Детерминированный registry-driven decision engine: извлекает метаданные, проверяет retryable статус и circuit breaker,
 * рассчитывает задержку через backoff и возвращает решение.
 * @param error Ошибка платежа для анализа
 * @param currentContext Текущий контекст повтора (или undefined для первой попытки)
 * @param config Конфигурация политики
 * @param circuitBreakerDecision Решение circuit breaker (если есть)
 * @returns RetryDecision с детерминированным результатом
 */
export function evaluatePaymentRetryPolicy(
  error: BillingServiceError,
  currentContext: RetryContext | undefined,
  config: RetryPolicyConfig,
  circuitBreakerDecision?: CircuitBreakerDecision,
): Effect.Effect<RetryDecision, never, never> {
  return Effect.gen(function*(_) {
    // Получаем текущее время для детерминизма
    const nowEpochMs = yield* _(Effect.clockWith((clock) => clock.currentTimeMillis));

    const errorCode = getBillingServiceErrorCode(error);
    const metadata = getBillingErrorMetadata(errorCode);

    // Registry-driven: извлекаем retry metadata (registry считается trusted)
    // contract assumption: BillingServiceErrorRegistry MUST be versioned & backward-compatible
    // retryMetadataVersion обеспечивает future-proofing при эволюции retry стратегий
    const isRetryable = metadata?.retryable ?? false;
    const preferredStrategy = metadata?.retryPolicy as RetryStrategy | undefined;
    const retryMetadataVersion = metadata?.retryMetadataVersion;

    // Логируем входные параметры для observability
    yield* _(Effect.logDebug('Evaluating payment retry policy', {
      event: 'retry_policy_evaluation_started',
      errorCode,
      isRetryable,
      preferredStrategy,
      retryMetadataVersion,
      retryAttempt: currentContext?.attemptCount,
    }));

    // Проверяем circuit breaker если он активен
    if (circuitBreakerDecision?.allow === false) {
      yield* _(Effect.logWarning('Circuit breaker open - denying retry', {
        event: 'retry_denied_circuit_breaker_open',
        retryAfterMs: circuitBreakerDecision.retryAfterMs,
        nextState: circuitBreakerDecision.nextState,
        errorCode,
      }));

      return {
        _tag: 'CircuitOpen' as const,
        retryAfterMs: circuitBreakerDecision.retryAfterMs,
      };
    }

    // Если ошибка не retryable - отказываем
    if (!isRetryable) {
      yield* _(Effect.logDebug('Error not retryable - denying retry', {
        event: 'retry_denied_error_not_retryable',
        reason: 'error_not_retryable',
        errorCode,
      }));

      return {
        _tag: 'RetryDenied' as const,
        reason: 'error_not_retryable',
      };
    }

    // Определяем стратегию с маппингом значений из registry
    const strategy = mapRegistryStrategyToRetryStrategy(preferredStrategy) ?? 'exponential_backoff';

    // Manual стратегия требует явного вмешательства оператора - отклоняем retry
    if (strategy === 'manual') {
      yield* _(Effect.logDebug('Manual retry strategy - denying retry', {
        event: 'retry_denied_manual_required',
        reason: 'manual_required',
        errorCode,
      }));

      return {
        _tag: 'RetryDenied' as const,
        reason: 'manual_required',
      };
    }

    // Получаем конфигурацию стратегии - прямой доступ безопасен благодаря union type
    const strategyConfig = config.strategies[strategy as keyof typeof config.strategies];

    // Создаем или обновляем контекст
    const context = currentContext
      ? updateRetryContext(currentContext, 'failure', nowEpochMs) // предыдущая попытка неудачная
      : createRetryContext(
        strategy,
        strategyConfig.maxAttempts,
        strategyConfig.baseDelayMs,
        nowEpochMs,
      );

    // Проверяем лимиты
    if (context.attemptCount > context.maxAttempts) {
      yield* _(Effect.logDebug('Max attempts exceeded - denying retry', {
        event: 'retry_denied_max_attempts_exceeded',
        reason: 'max_attempts_exceeded',
        retryAttempt: context.attemptCount,
        maxAttempts: context.maxAttempts,
        strategy: context.strategy,
        errorCode,
      }));

      return {
        _tag: 'RetryDenied' as const,
        reason: 'max_attempts_exceeded',
      };
    }

    // Рассчитываем задержку с безопасным вызовом
    // strategy гарантированно не 'manual' после проверки выше
    const calculator = getBackoffCalculator(strategy as AutomaticRetryStrategy);
    const baseDelayMs = calculator(context, strategyConfig);
    const delayWithJitter = yield* _(
      Effect.sync(() =>
        applyJitter(baseDelayMs, strategyConfig.jitterRatio ?? DEFAULT_JITTER_RATIO)
      ),
    );

    // Проверяем общую задержку
    const newTotalDelayMs = context.totalDelayMs + delayWithJitter;
    if (newTotalDelayMs > strategyConfig.maxTotalDelayMs) {
      yield* _(Effect.logDebug('Max total delay exceeded - denying retry', {
        event: 'retry_denied_max_total_delay_exceeded',
        reason: 'max_total_delay_exceeded',
        retryAttempt: context.attemptCount,
        strategy: context.strategy,
        totalDelayMs: newTotalDelayMs,
        maxTotalDelayMs: strategyConfig.maxTotalDelayMs,
        errorCode,
      }));

      return {
        _tag: 'RetryDenied' as const,
        reason: 'max_total_delay_exceeded',
      };
    }

    // Обновляем контекст с новой задержкой
    const finalContext: RetryContext = {
      ...context,
      totalDelayMs: newTotalDelayMs,
    };

    yield* _(Effect.logDebug('Retry allowed', {
      event: 'retry_allowed',
      strategy,
      retryAttempt: finalContext.attemptCount,
      maxAttempts: finalContext.maxAttempts,
      delayMs: delayWithJitter,
      totalDelayMs: newTotalDelayMs,
      errorCode,
    }));

    return {
      _tag: 'RetryAllowed' as const,
      context: finalContext,
      delayMs: delayWithJitter,
    };
  });
}

// ==================== CONTEXT MANAGEMENT ====================

/**
 * Создает начальный контекст повтора.
 * Детерминированная функция, принимает время явно для одинакового результата при одинаковом input (testable, replay).
 * @param strategy Стратегия повтора
 * @param maxAttempts Максимальное количество попыток
 * @param baseDelayMs Базовая задержка
 * @param nowEpochMs Текущее время в ms для детерминизма
 * @param retryReason Причина повтора для observability
 */
export function createRetryContext(
  strategy: RetryStrategy,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
  nowEpochMs: number,
  retryReason?: RetryReason,
): RetryContext {
  return {
    attemptCount: 1,
    maxAttempts,
    strategy,
    baseDelayMs,
    lastAttemptAtEpochMs: nowEpochMs,
    totalDelayMs: 0,
    ...(retryReason && { retryReason }),
  };
}

/** Результат попытки повтора */
export type RetryAttemptResult = 'success' | 'failure';

/** Причины отказа в повторе */
export type RetryDeniedReason =
  | 'error_not_retryable'
  | 'manual_required'
  | 'unknown_strategy'
  | 'max_attempts_exceeded'
  | 'max_total_delay_exceeded';

/**
 * Обновляет контекст после попытки.
 * Детерминированная функция, принимает время явно для одинакового результата при одинаковом input (testable, replay).
 * @param context Текущий контекст
 * @param result Результат попытки
 * @param nowEpochMs Текущее время в ms для детерминизма
 */
export function updateRetryContext(
  context: RetryContext,
  result: RetryAttemptResult,
  nowEpochMs: number,
): RetryContext {
  return {
    ...context,
    attemptCount: result === 'success' ? context.attemptCount : context.attemptCount + 1,
    lastAttemptAtEpochMs: nowEpochMs,
    // totalDelayMs обновляется в evaluatePaymentRetryPolicy
  };
}

// ==================== DEFAULT CONFIGURATION ====================

/** Дефолтная конфигурация retry policy (production-ready значения для LivAiBot) */
export const DEFAULT_RETRY_POLICY_CONFIG: RetryPolicyConfig = {
  strategies: {
    immediate: {
      maxAttempts: 1,
      baseDelayMs: 0,
      maxTotalDelayMs: 1000, // 1 секунда
      jitterRatio: 0,
    },
    fixed_delay: {
      maxAttempts: 3,
      baseDelayMs: 5000, // 5 секунд
      maxTotalDelayMs: MAX_TOTAL_DELAY_MS,
      jitterRatio: DEFAULT_JITTER_RATIO,
    },
    exponential_backoff: {
      maxAttempts: 5,
      baseDelayMs: 1000, // 1 секунда
      maxTotalDelayMs: MAX_TOTAL_DELAY_MS,
      jitterRatio: DEFAULT_JITTER_RATIO,
    },
    circuit_breaker: {
      maxAttempts: 3,
      baseDelayMs: 30000, // 30 секунд
      maxTotalDelayMs: MAX_TOTAL_DELAY_MS,
      jitterRatio: DEFAULT_JITTER_RATIO,
    },
    provider_defined: {
      maxAttempts: 3,
      baseDelayMs: 2000, // 2 секунды
      maxTotalDelayMs: MAX_TOTAL_DELAY_MS,
      jitterRatio: DEFAULT_JITTER_RATIO,
    },
    manual: {
      maxAttempts: 1,
      baseDelayMs: 0,
      maxTotalDelayMs: 1000,
      jitterRatio: 0,
    },
  },
} as const;
