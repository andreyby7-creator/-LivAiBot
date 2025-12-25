/**
 * @file tokenRetryPolicy.ts - Умная политика повторных попыток при исчерпании токенов
 *
 * Реализует интеллектуальную логику повторных запросов при исчерпании токенов.
 * Включает exponential backoff, учет квот пользователя, альтернативные модели.
 *
 * ❗ ML-семантика токенов и квот.
 * Используется infrastructure layer → token management → user policies.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/* ========================== CONSTANTS ========================== */

const BASE_RETRY_DELAY_MS = 1000; // Базовая задержка для exponential backoff (мс)

const MAX_RETRY_DELAY_MS = 30000; // Максимальная задержка между попытками (мс)

const MAX_RETRY_ATTEMPTS = 3; // Максимальное количество повторных попыток

const BACKOFF_MULTIPLIER = 2; // Множитель для exponential backoff

const QUOTA_APPROACH_DELAY_FACTOR = 1.5; // Дополнительная задержка при приближении к квоте (%)

const TOKEN_TYPE_COMPATIBILITY_BONUS = 0.05; // Бонус совместимости для токенов

const HIGH_TOKEN_EFFICIENCY_THRESHOLD = 15; // Порог высокой эффективности токенов (%)

const COST_OPTIMIZATION_THRESHOLD = -10; // Порог оптимизации стоимости (%)

// Константы совместимости моделей
const COMPATIBILITY_PRO_TO_LITE_INPUT = 0.9;
const COMPATIBILITY_PRO_TO_LITE_OUTPUT = 0.7;
const COMPATIBILITY_PRO_TO_STANDARD = 0.85;

const COMPATIBILITY_STANDARD_TO_LITE_INPUT = 0.8;
const COMPATIBILITY_STANDARD_TO_LITE_OUTPUT = 0.6;
const COMPATIBILITY_STANDARD_TO_PRO_OUTPUT = 0.75;
const COMPATIBILITY_STANDARD_TO_PRO_INPUT = 0.5;

const COMPATIBILITY_LITE_TO_STANDARD = 0.9;
const COMPATIBILITY_LITE_TO_PRO_OUTPUT = 0.7;
const COMPATIBILITY_LITE_TO_PRO_INPUT = 0.4;

const COMPATIBILITY_ART_TO_LITE = 0.8;
const COMPATIBILITY_ART_TO_STANDARD = 0.75;

const DEFAULT_MODEL_COMPATIBILITY = 0.7; // Дефолтная совместимость моделей

const MILLISECONDS_PER_SECOND = 1000; // Количество миллисекунд в секунде

const PERCENT_BASE = 100; // Базовое значение для процентов

const FIRST_ATTEMPT_NUMBER = 0; // Номер первой попытки

const MODEL_FALLBACK_ATTEMPT_THRESHOLD = 2; // Порог попыток для переключения на model fallback

// Константы для уровней исчерпания квот
const LOW_EXHAUSTION_THRESHOLD = 0.7;
const MEDIUM_EXHAUSTION_THRESHOLD = 0.85;
const HIGH_EXHAUSTION_THRESHOLD = 0.95;

const LOW_EXHAUSTION_MULTIPLIER = 1.2;
const MEDIUM_EXHAUSTION_MULTIPLIER = 1.8;
const HIGH_EXHAUSTION_MULTIPLIER = 2.5;
const CRITICAL_EXHAUSTION_MULTIPLIER = 3.0;

/** Определяет причину выбора альтернативной модели на основе экономии токенов */
function getTokenAlternativeReason(savings: number): TokenAlternativeReason {
  if (savings > HIGH_TOKEN_EFFICIENCY_THRESHOLD) {
    return TokenAlternativeReason.TOKEN_EFFICIENCY;
  }
  if (savings < COST_OPTIMIZATION_THRESHOLD) {
    return TokenAlternativeReason.COST_OPTIMIZATION;
  }
  return TokenAlternativeReason.SIMILAR_CAPABILITIES;
}

/** Тип токенов для единообразия типизации */
export enum TokenType {
  INPUT = 'input',
  OUTPUT = 'output',
  TOTAL = 'total',
}

/** Стратегия повторных попыток */
export enum RetryStrategy {
  IMMEDIATE = 'immediate',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  QUOTA_AWARE = 'quota_aware',
  MODEL_FALLBACK = 'model_fallback',
}

/** Причины выбора альтернативной модели для токенов */
export enum TokenAlternativeReason {
  TOKEN_EFFICIENCY = 'token_efficiency',
  SIMILAR_CAPABILITIES = 'similar_capabilities',
  FALLBACK_CAPACITY = 'fallback_capacity',
  COST_OPTIMIZATION = 'cost_optimization',
}

/** Дефолтная модель для fallback при отсутствии альтернатив */
const DEFAULT_MODEL_FALLBACK = 'yandexgpt-lite';

/** Конфигурация стандартных рекомендаций для разных сценариев */
const RETRY_RECOMMENDATIONS = {
  maxAttempts: [
    'Maximum retry attempts reached',
    'Consider upgrading your plan for higher token limits',
    'Try again later when quota resets',
  ],
  insufficientTokens: [
    'Insufficient tokens available',
    'Wait for token regeneration or upgrade plan',
    'Consider using a lighter model',
  ],
  quotaApproaching: [
    'Approaching quota limits, consider upgrading plan',
  ],
  modelFallback: [
    'Alternative model may have different token consumption',
  ],
} as const;

/** Хелпер для создания стандартизированных сообщений о задержках */
function formatDelayMessage(seconds: number, strategy: string): string {
  return `Retrying in ${seconds} seconds${strategy ? ` (${strategy})` : ''}`;
}

/** Сообщения о задержках для разных стратегий */
const DELAY_MESSAGES = {
  exponentialBackoff: (seconds: number) => formatDelayMessage(seconds, 'exponential backoff'),
  quotaAware: (seconds: number) => formatDelayMessage(seconds, 'quota-aware delay'),
  modelSwitch: (model: string) => `Switching to alternative model: ${model}`,
} as const;

/** Дефолтные альтернативы моделей для токенов */
const DEFAULT_MODEL_ALTERNATIVES: Record<string, string> = {
  'yandexgpt-pro': DEFAULT_MODEL_FALLBACK,
  'yandexgpt': DEFAULT_MODEL_FALLBACK,
  'yandexgpt-lite': 'yandexgpt',
  'yandexart': DEFAULT_MODEL_FALLBACK,
};

/** Дефолтный сервис альтернатив моделей с умной цепочкой */
export class DefaultModelAlternativesService implements IModelAlternativesService {
  loadAlternatives(modelId: string, tokenType: TokenType): Promise<ModelAlternativeChain> {
    const alternatives = this.generateSmartAlternatives(modelId, tokenType);
    return Promise.resolve({ primaryModel: modelId, alternatives });
  }

  private generateSmartAlternatives(
    modelId: string,
    tokenType: TokenType,
  ): ModelAlternativeOption[] {
    const candidates = this.getCandidates(modelId, tokenType);
    return candidates.map(({ modelId: altId, score, reason, savings }) => ({
      modelId: altId,
      compatibilityScore: score,
      reason,
      tokenSavingsPercent: savings,
    })).sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  private getCandidates(primary: string, tokenType: TokenType): {
    modelId: string;
    score: number;
    reason: TokenAlternativeReason;
    savings: number;
  }[] {
    // Быстрый маппинг альтернатив с умными оценками
    const mapping: Record<string, { modelId: string; savings: number; }[]> = {
      'yandexgpt-pro': [
        { modelId: 'yandexgpt-lite', savings: 30 },
        { modelId: 'yandexgpt', savings: 15 },
      ],
      'yandexgpt': [
        { modelId: 'yandexgpt-lite', savings: 20 },
        { modelId: 'yandexgpt-pro', savings: -15 },
      ],
      'yandexgpt-lite': [
        { modelId: 'yandexgpt', savings: -10 },
        { modelId: 'yandexgpt-pro', savings: -25 },
      ],
      'yandexart': [
        { modelId: 'yandexgpt-lite', savings: 25 },
        { modelId: 'yandexgpt', savings: 10 },
      ],
    };

    return ((Reflect.get(mapping, primary) as { modelId: string; savings: number; }[] | undefined)
      ?? [{ modelId: DEFAULT_MODEL_FALLBACK, savings: 0 }])
      .map(({ modelId, savings }) => ({
        modelId,
        score: Math.min(
          1.0,
          this.calculateBaseScore(primary, modelId, tokenType)
            + (tokenType === TokenType.TOTAL ? TOKEN_TYPE_COMPATIBILITY_BONUS : 0),
        ),
        reason: getTokenAlternativeReason(savings),
        savings,
      }));
  }

  /** Расчет базового compatibility score на основе моделей и типа токенов */
  calculateBaseScore(primary: string, alternative: string, tokenType: TokenType): number {
    // Матрица совместимости моделей
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'yandexgpt-pro': {
        'yandexgpt-lite': tokenType === TokenType.INPUT
          ? COMPATIBILITY_PRO_TO_LITE_INPUT
          : COMPATIBILITY_PRO_TO_LITE_OUTPUT,
        'yandexgpt': COMPATIBILITY_PRO_TO_STANDARD,
      },
      'yandexgpt': {
        'yandexgpt-lite': tokenType === TokenType.INPUT
          ? COMPATIBILITY_STANDARD_TO_LITE_INPUT
          : COMPATIBILITY_STANDARD_TO_LITE_OUTPUT,
        'yandexgpt-pro': tokenType === TokenType.OUTPUT
          ? COMPATIBILITY_STANDARD_TO_PRO_OUTPUT
          : COMPATIBILITY_STANDARD_TO_PRO_INPUT,
      },
      'yandexgpt-lite': {
        'yandexgpt': COMPATIBILITY_LITE_TO_STANDARD,
        'yandexgpt-pro': tokenType === TokenType.OUTPUT
          ? COMPATIBILITY_LITE_TO_PRO_OUTPUT
          : COMPATIBILITY_LITE_TO_PRO_INPUT,
      },
      'yandexart': {
        'yandexgpt-lite': COMPATIBILITY_ART_TO_LITE,
        'yandexgpt': COMPATIBILITY_ART_TO_STANDARD,
      },
    };

    const primaryMatrix = Reflect.get(compatibilityMatrix, primary) as
      | Record<string, number>
      | undefined;
    if (!primaryMatrix) return DEFAULT_MODEL_COMPATIBILITY;
    return (Reflect.get(primaryMatrix, alternative) as number | undefined)
      ?? DEFAULT_MODEL_COMPATIBILITY;
  }
}

/** Глобальный экземпляр дефолтного сервиса */
const defaultAlternativesService = new DefaultModelAlternativesService();

/** Дефолтный логгер (console-based для обратной совместимости) */
const defaultLogger: ILogger = {
  warn: (message, context) => {
    console.warn(message, context);
  },
  error: (message, context) => {
    console.error(message, context);
  },
  info: (message, context) => {
    console.info(message, context);
  },
};

/** Сервис для загрузки конфигурации альтернатив моделей */
export type IModelAlternativesService = {
  /** Загружает конфигурацию альтернатив для модели */
  loadAlternatives(modelId: string, tokenType: TokenType): Promise<ModelAlternativeChain>;
};

/** Цепочка альтернативных моделей с оценками совместимости */
export type ModelAlternativeChain = {
  readonly primaryModel: string; // Основная модель
  readonly alternatives: readonly ModelAlternativeOption[]; // Цепочка альтернатив в порядке приоритета
};

/** Интерфейс для логирования */
export type ILogger = {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
};

/** Альтернативная модель с оценкой совместимости */
export type ModelAlternativeOption = {
  readonly modelId: string; // Идентификатор модели
  readonly compatibilityScore: number; // Оценка совместимости (0-1, где 1 - полная совместимость)
  readonly reason: TokenAlternativeReason; // Причина выбора этой альтернативы
  readonly tokenSavingsPercent?: number; // Ожидаемая экономия токенов (%)
};

/* ========================== TYPES ========================== */

/** Контекст политики повторных попыток для токенов */
export type TokenRetryPolicyContext = {
  readonly type: 'token_retry_policy'; // Тип контекста домена
  readonly modelId: string; // Идентификатор модели
  readonly currentTokens: number; // Текущий счетчик токенов
  readonly maxAvailableTokens: number; // Максимально доступное количество токенов
  readonly tokensUsed: number; // Количество использованных токенов
  readonly attemptNumber: number; // Номер текущей попытки (начиная с 0)
  readonly maxAttempts: number; // Максимальное количество попыток
  readonly tokenType: TokenType; // Тип токенов
  readonly userQuotaContext?: UserQuotaContext; // Контекст пользователя для учета квот
  readonly lastAttemptTime?: number; // Время последней попытки
  readonly modelAlternativesConfig?: Record<string, string>; // Конфигурация альтернативных моделей для токенов
  readonly alternativesService?: IModelAlternativesService; // Сервис для загрузки конфигурации альтернатив
  readonly logger?: ILogger; // Сервис логирования
};

/** Контекст квот пользователя */
export type UserQuotaContext = {
  readonly planTier: string; // Текущий план пользователя
  readonly dailyQuota?: number; // Дневная квота токенов
  readonly dailyUsed?: number; // Использовано за день
  readonly hourlyQuota?: number; // Почасовая квота
  readonly hourlyUsed?: number; // Использовано за час
  readonly monthlyQuota?: number; // Месячная квота
  readonly monthlyUsed?: number; // Использовано за месяц
};

/** Результат применения политики повторных попыток */
export type TokenRetryPolicyResult = {
  readonly shouldRetry: boolean; // Следует ли повторять попытку
  readonly delayMs?: number; // Расчетная задержка перед следующей попыткой (мс)
  readonly alternativeModel?: string; // Рекомендуемая альтернативная модель
  readonly reason:
    | 'success'
    | 'max_attempts_reached'
    | 'quota_exhausted'
    | 'insufficient_tokens'
    | 'backoff_timeout'; // Причина решения о повторной попытке
  readonly recommendations?: readonly string[]; // Рекомендации для пользователя
};

/* ========================== ERROR ========================== */

/** Ошибка политики повторных попыток для токенов */
export type TokenRetryPolicyError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly severity: typeof ERROR_SEVERITY.MEDIUM | typeof ERROR_SEVERITY.HIGH;
  readonly type: 'token_retry_policy_error';
  readonly code: ErrorCode;
  readonly context: TokenRetryPolicyContext;
  readonly result: TokenRetryPolicyResult;
  readonly message: string;
  readonly timestamp: string;
  readonly stack: string | undefined;
}, 'TokenRetryPolicyError'>;

/* ========================== FUNCTIONS ========================== */

// Хелпер для создания результатов retry (устраняет дублирование структур)
function createRetryResult(params: {
  shouldRetry: boolean;
  reason: TokenRetryPolicyResult['reason'];
  delayMs?: number;
  alternativeModel?: string;
  recommendations?: readonly string[];
}): TokenRetryPolicyResult {
  return {
    shouldRetry: params.shouldRetry,
    reason: params.reason,
    ...(params.delayMs !== undefined && { delayMs: params.delayMs }),
    ...(params.alternativeModel !== undefined && { alternativeModel: params.alternativeModel }),
    ...(params.recommendations && { recommendations: params.recommendations }),
  };
}

// Обработчики стратегий повторных попыток
const STRATEGY_HANDLERS: Record<
  RetryStrategy,
  (context: TokenRetryPolicyContext) => Promise<TokenRetryPolicyResult>
> = {
  [RetryStrategy.IMMEDIATE]: (_context) => {
    void _context; // immediate strategy doesn't need context
    return Promise.resolve(createRetryResult({
      shouldRetry: true,
      reason: 'success',
      delayMs: 0,
    }));
  },

  [RetryStrategy.EXPONENTIAL_BACKOFF]: (context) => {
    const delayMs = calculateExponentialBackoffDelay(context.attemptNumber);
    return Promise.resolve(createRetryResult({
      shouldRetry: true,
      reason: 'success',
      delayMs,
      recommendations: [
        DELAY_MESSAGES.exponentialBackoff(Math.round(delayMs / MILLISECONDS_PER_SECOND)),
      ],
    }));
  },

  [RetryStrategy.QUOTA_AWARE]: (context) => {
    const quotaDelayMs = calculateQuotaAwareDelay(context, context.userQuotaContext);
    return Promise.resolve(createRetryResult({
      shouldRetry: true,
      reason: 'success',
      delayMs: quotaDelayMs,
      recommendations: [
        DELAY_MESSAGES.quotaAware(Math.round(quotaDelayMs / MILLISECONDS_PER_SECOND)),
        ...RETRY_RECOMMENDATIONS.quotaApproaching,
      ],
    }));
  },

  [RetryStrategy.MODEL_FALLBACK]: async (context) => {
    const alternativeModel = await suggestAlternativeModel(context);
    return createRetryResult({
      shouldRetry: true,
      reason: 'success',
      delayMs: BASE_RETRY_DELAY_MS,
      alternativeModel,
      recommendations: [
        DELAY_MESSAGES.modelSwitch(alternativeModel),
        ...RETRY_RECOMMENDATIONS.modelFallback,
      ],
    });
  },
};

// Определяет, следует ли повторять запрос при исчерпании токенов
// Рассчитывает максимальный уровень исчерпания квот пользователя
function calculateExhaustionLevels(userQuotaContext: UserQuotaContext): number {
  const { dailyQuota, dailyUsed, hourlyQuota, hourlyUsed, monthlyQuota, monthlyUsed } =
    userQuotaContext;

  const exhaustionLevels = [
    dailyQuota !== undefined && dailyUsed !== undefined && dailyQuota > 0
      ? dailyUsed / dailyQuota
      : 0,
    hourlyQuota !== undefined && hourlyUsed !== undefined && hourlyQuota > 0
      ? hourlyUsed / hourlyQuota
      : 0,
    monthlyQuota !== undefined && monthlyUsed !== undefined && monthlyQuota > 0
      ? monthlyUsed / monthlyQuota
      : 0,
  ].filter((level) => level > 0);

  return exhaustionLevels.length > 0 ? Math.max(...exhaustionLevels) : 0;
}

export async function shouldRetryOnTokenExhaustion(
  context: TokenRetryPolicyContext,
): Promise<TokenRetryPolicyResult> {
  const {
    attemptNumber,
    maxAttempts,
    currentTokens,
    userQuotaContext,
  } = context;

  // Проверяем лимит попыток
  if (attemptNumber >= Math.min(maxAttempts, MAX_RETRY_ATTEMPTS)) {
    return createRetryResult({
      shouldRetry: false,
      reason: 'max_attempts_reached',
      recommendations: RETRY_RECOMMENDATIONS.maxAttempts,
    });
  }

  // Проверяем наличие достаточного количества токенов
  if (currentTokens <= 0) {
    return createRetryResult({
      shouldRetry: false,
      reason: 'insufficient_tokens',
      recommendations: RETRY_RECOMMENDATIONS.insufficientTokens,
    });
  }

  // Проверяем квоты пользователя
  const quotaCheck = checkUserQuotas(userQuotaContext);
  if (!quotaCheck.canRetry) {
    return createRetryResult({
      shouldRetry: false,
      reason: 'quota_exhausted',
      recommendations: quotaCheck.recommendations,
    });
  }

  // Определяем и выполняем стратегию повторной попытки
  const strategy = determineRetryStrategy(context);
  const handler = Reflect.get(STRATEGY_HANDLERS, strategy);

  return handler(context);
}

// Конфигурация проверки квот
const QUOTA_CHECKS = [
  {
    quotaKey: 'dailyQuota' as const,
    usedKey: 'dailyUsed' as const,
    thresholdPercent: 95, // Порог для запрета retry
    strategyThresholdPercent: 80, // Порог для выбора quota_aware стратегии
    name: 'Daily',
    recommendations: [
      'Wait until tomorrow for quota reset',
      'Consider upgrading to higher tier plan',
    ],
  },
  {
    quotaKey: 'hourlyQuota' as const,
    usedKey: 'hourlyUsed' as const,
    thresholdPercent: 90, // Порог для запрета retry
    strategyThresholdPercent: 70, // Порог для выбора quota_aware стратегии
    name: 'Hourly',
    recommendations: [
      'Wait for hourly quota reset',
    ],
  },
  {
    quotaKey: 'monthlyQuota' as const,
    usedKey: 'monthlyUsed' as const,
    thresholdPercent: 98, // Порог для запрета retry
    strategyThresholdPercent: 95, // Порог для выбора quota_aware стратегии
    name: 'Monthly',
    recommendations: [
      'Monthly quota nearly exhausted',
      'Consider upgrading plan immediately',
    ],
  },
] as const;

// Проверяет статус квот пользователя (объединяет логику canRetry и isApproachingLimit)
function checkQuotaStatus(userQuotaContext?: UserQuotaContext): {
  canRetry: boolean;
  isApproachingLimit: boolean;
  recommendations: string[];
} {
  if (!userQuotaContext) {
    return { canRetry: true, isApproachingLimit: false, recommendations: [] };
  }

  let isApproachingLimit = false;

  // Прерываем проверку на первом критическом превышении квоты (early exit)
  for (const check of QUOTA_CHECKS) {
    const quota = Reflect.get(userQuotaContext, check.quotaKey);
    const used = Reflect.get(userQuotaContext, check.usedKey);

    if (quota !== undefined && used !== undefined) {
      const usagePercent = (used / quota) * PERCENT_BASE;

      // Проверяем приближение к лимиту (для стратегии)
      if (usagePercent >= check.strategyThresholdPercent) {
        isApproachingLimit = true;
      }

      // Проверяем превышение лимита (для запрета retry)
      if (usagePercent >= check.thresholdPercent) {
        return {
          canRetry: false,
          isApproachingLimit: true, // Если превысили лимит, то точно приближаемся
          recommendations: [
            `${check.name} quota ${usagePercent.toFixed(1)}% used`,
            ...check.recommendations,
          ],
        };
      }
    }
  }

  return { canRetry: true, isApproachingLimit, recommendations: [] };
}

// Проверяет квоты пользователя (обратная совместимость)
function checkUserQuotas(userQuotaContext?: UserQuotaContext): {
  canRetry: boolean;
  recommendations: string[];
} {
  const status = checkQuotaStatus(userQuotaContext);
  return { canRetry: status.canRetry, recommendations: status.recommendations };
}

// Проверяет, приближается ли пользователь к лимитам квоты (обратная совместимость)
function isApproachingQuotaLimit(userQuotaContext?: UserQuotaContext): boolean {
  const status = checkQuotaStatus(userQuotaContext);
  return status.isApproachingLimit;
}

// Определяет стратегию повторной попытки
function determineRetryStrategy(context: TokenRetryPolicyContext): RetryStrategy {
  const { attemptNumber, userQuotaContext } = context;

  // Если первая попытка - immediate retry
  if (attemptNumber === FIRST_ATTEMPT_NUMBER) {
    return RetryStrategy.IMMEDIATE;
  }

  // Если приближаемся к квотам - quota-aware стратегия
  if (isApproachingQuotaLimit(userQuotaContext)) {
    return RetryStrategy.QUOTA_AWARE;
  }

  // Если много неудачных попыток - пробуем альтернативную модель
  if (attemptNumber >= MODEL_FALLBACK_ATTEMPT_THRESHOLD) {
    return RetryStrategy.MODEL_FALLBACK;
  }

  // По умолчанию - exponential backoff
  return RetryStrategy.EXPONENTIAL_BACKOFF;
}

// Рассчитывает задержку с exponential backoff
function calculateExponentialBackoffDelay(attemptNumber: number): number {
  const delayMs = BASE_RETRY_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attemptNumber);
  return Math.min(delayMs, MAX_RETRY_DELAY_MS);
}

// Рассчитывает задержку пропорционально степени исчерпания квот
function calculateQuotaAwareDelay(
  context: TokenRetryPolicyContext,
  userQuotaContext?: UserQuotaContext,
): number {
  const baseDelay = calculateExponentialBackoffDelay(context.attemptNumber);

  if (!userQuotaContext) {
    return Math.round(baseDelay * QUOTA_APPROACH_DELAY_FACTOR);
  }

  // Рассчитываем максимальный уровень исчерпания квот
  const maxExhaustion = calculateExhaustionLevels(userQuotaContext);

  // Простые множители на основе уровня исчерпания
  let multiplier: number;
  if (maxExhaustion < LOW_EXHAUSTION_THRESHOLD) {
    multiplier = LOW_EXHAUSTION_MULTIPLIER; // Низкий уровень
  } else if (maxExhaustion < MEDIUM_EXHAUSTION_THRESHOLD) {
    multiplier = MEDIUM_EXHAUSTION_MULTIPLIER; // Средний уровень
  } else if (maxExhaustion < HIGH_EXHAUSTION_THRESHOLD) {
    multiplier = HIGH_EXHAUSTION_MULTIPLIER; // Высокий уровень
  } else {
    multiplier = CRITICAL_EXHAUSTION_MULTIPLIER; // Критический уровень
  }

  return Math.round(baseDelay * multiplier);
}

// Предлагает альтернативную модель
async function suggestAlternativeModel(context: TokenRetryPolicyContext): Promise<string> {
  const { modelId, tokenType, alternativesService, modelAlternativesConfig, logger } = context;

  // Используем предоставленный логгер или дефолтный
  const log = logger ?? defaultLogger;

  // Используем предоставленный сервис или дефолтный
  const service = alternativesService ?? defaultAlternativesService;

  try {
    const chain = await service.loadAlternatives(modelId, tokenType);
    // Возвращаем лучшую альтернативу по compatibility score
    if (chain.alternatives.length > 0) {
      const bestAlternative = chain.alternatives.reduce((best, current) =>
        current.compatibilityScore > best.compatibilityScore ? current : best
      );
      return bestAlternative.modelId;
    }
  } catch (error) {
    // Логируем ошибку через централизованный сервис
    try {
      log.warn('Failed to load alternatives from service', {
        modelId,
        tokenType: tokenType.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } catch (_logError) {
      // Игнорируем ошибки логирования - они не должны ломать основную логику
      void _logError;
    }
  }

  // Fallback на простую конфигурацию
  const alternatives = modelAlternativesConfig ?? DEFAULT_MODEL_ALTERNATIVES;

  // Возвращаем альтернативу из конфига или дефолтную
  const value = Reflect.get(alternatives, modelId) as string | undefined;
  return value ?? DEFAULT_MODEL_FALLBACK;
}

// Создает ошибку политики повторных попыток
export function createTokenRetryPolicyError(
  code: ErrorCode,
  context: TokenRetryPolicyContext,
  result: TokenRetryPolicyResult,
  message: string,
): TokenRetryPolicyError {
  // Эскалируем severity при исчерпании всех попыток
  const severity = result.reason === 'max_attempts_reached'
    ? ERROR_SEVERITY.HIGH
    : ERROR_SEVERITY.MEDIUM;

  return {
    _tag: 'TokenRetryPolicyError',
    type: 'token_retry_policy_error',
    category: ERROR_CATEGORY.BUSINESS,
    severity,
    origin: ERROR_ORIGIN.SERVICE,
    code,
    message,
    context,
    result,
    timestamp: new Date().toISOString(),
    stack: new Error().stack ?? undefined,
  };
}

// Проверяет, является ли ошибка ошибкой политики повторных попыток
export function isTokenRetryPolicyError(error: unknown): error is TokenRetryPolicyError {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && error._tag === 'TokenRetryPolicyError'
    && 'type' in error
    && error.type === 'token_retry_policy_error'
  );
}

// Функциональный менеджер кеша результатов token retry policy
const createTokenRetryCacheManager = (): {
  get: (context: TokenRetryPolicyContext) => Promise<TokenRetryPolicyResult>;
  set: (context: TokenRetryPolicyContext, result: TokenRetryPolicyResult) => void;
  clear: () => void;
  size: () => number;
} => {
  let cache = new Map<string, TokenRetryPolicyResult>();

  // Создает композитный ключ для кеширования на основе значимых полей контекста
  const createCacheKey = (context: TokenRetryPolicyContext): string => {
    const {
      attemptNumber,
      maxAttempts,
      currentTokens,
      userQuotaContext,
    } = context;

    // Создаем ключ из полей, влияющих на результат (стабильная сериализация)
    const quotaKey = userQuotaContext
      ? [
        userQuotaContext.planTier,
        userQuotaContext.dailyQuota ?? 0,
        userQuotaContext.dailyUsed ?? 0,
        userQuotaContext.hourlyQuota ?? 0,
        userQuotaContext.hourlyUsed ?? 0,
        userQuotaContext.monthlyQuota ?? 0,
        userQuotaContext.monthlyUsed ?? 0,
      ].join(':')
      : 'no-quota';

    return `${attemptNumber}:${maxAttempts}:${currentTokens}:${quotaKey}`;
  };

  const get = async (context: TokenRetryPolicyContext): Promise<TokenRetryPolicyResult> => {
    const cacheKey = createCacheKey(context);

    // Проверяем кеш
    const existingResult = cache.get(cacheKey);
    if (existingResult) {
      return existingResult;
    }

    // Вычисляем результат и кешируем
    const result = await shouldRetryOnTokenExhaustion(context);
    cache = new Map([...cache, [cacheKey, result]]);
    return result;
  };

  const set = (context: TokenRetryPolicyContext, result: TokenRetryPolicyResult): void => {
    const cacheKey = createCacheKey(context);
    cache = new Map([...cache, [cacheKey, result]]);
  };

  const clear = (): void => {
    cache = new Map();
  };

  const size = (): number => {
    return cache.size;
  };

  return { get, set, clear, size };
};

/** Singleton instance кеш-менеджера */
let tokenRetryCacheInstance: ReturnType<typeof createTokenRetryCacheManager> | undefined;

/** Получение singleton instance кеш-менеджера */
const getTokenRetryCache = (): ReturnType<typeof createTokenRetryCacheManager> => {
  tokenRetryCacheInstance ??= createTokenRetryCacheManager();
  return tokenRetryCacheInstance;
};

// Функция для оценки политики с кешированием
export async function evaluateTokenRetryPolicy(
  context: TokenRetryPolicyContext,
): Promise<TokenRetryPolicyResult> {
  return getTokenRetryCache().get(context);
}

// Получает оптимальную задержку для повторной попытки
export async function getOptimalRetryDelay(context: TokenRetryPolicyContext): Promise<number> {
  const result = await evaluateTokenRetryPolicy(context);
  return result.delayMs ?? 0;
}

// Проверяет, можно ли повторить запрос с токенами
export async function canRetryWithTokens(context: TokenRetryPolicyContext): Promise<boolean> {
  const result = await evaluateTokenRetryPolicy(context);
  return result.shouldRetry;
}

// Экспорт вспомогательных функций и констант для тестирования
export {
  BACKOFF_MULTIPLIER,
  BASE_RETRY_DELAY_MS,
  calculateExponentialBackoffDelay,
  calculateQuotaAwareDelay,
  checkQuotaStatus,
  checkUserQuotas,
  createRetryResult,
  DEFAULT_MODEL_ALTERNATIVES,
  DEFAULT_MODEL_FALLBACK,
  DELAY_MESSAGES,
  determineRetryStrategy,
  formatDelayMessage,
  isApproachingQuotaLimit,
  MAX_RETRY_DELAY_MS,
  QUOTA_APPROACH_DELAY_FACTOR,
  QUOTA_CHECKS,
  RETRY_RECOMMENDATIONS,
  suggestAlternativeModel,
};
