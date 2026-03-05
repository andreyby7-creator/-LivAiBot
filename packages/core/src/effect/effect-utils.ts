/**
 * @file @livai/core/src/effect/effect-utils.ts
 *
 * ============================================================================
 * ⚡ EFFECT UTILS — УНИВЕРСАЛЬНЫЕ ПОМОЩНИКИ ДЛЯ ЭФФЕКТОВ
 * ============================================================================
 *
 * Фундамент слоя side-effects. Без доменной логики и UI-зависимостей.
 *
 * Используется для:
 * - HTTP / WebSocket / SSE
 * - Retry / Timeout / Cancellation (AbortSignal propagation)
 * - Типобезопасная обработка результатов (Result<T, E>)
 * - Tracing / Observability
 * - Унифицированная обработка ошибок
 * - Микросервисная архитектура
 *
 * Принципы:
 * - Zero business logic
 * - Zero UI dependencies
 * - Детерминированность
 * - Полная тестируемость
 * - Один контракт → одна ответственность
 *
 * Границы слоёв:
 * - @livai/core-contracts — чистый типовой слой (контракты API и ошибок, без runtime).
 * - @livai/core (effect) — реализация доменно-ориентированной логики эффектов и error-mapping.
 * - @livai/app — конкретный runtime (браузер, платформа, UI, логирование и интеграции).
 */

import type { Effect as EffectLib } from 'effect';

import type {
  ApiError,
  ApiRequestContext,
  ApiResponse,
  SanitizedJson,
} from '@livai/core-contracts';

/* eslint-disable fp/no-throw, functional/no-let, fp/no-mutation, functional/no-loop-statements, @typescript-eslint/no-unnecessary-condition */
// Throw, let, мутации и циклы необходимы для side-effects (обработка ошибок, retry, state management)

/* ========================================================================== */
/* 🧠 БАЗОВЫЕ ТИПЫ ЭФФЕКТОВ */
/* ========================================================================== */

/** Effect функция без параметров. */
export type EffectFn<T> = () => EffectLib.Effect<T>;

/** Универсальный эффект. Любая асинхронная операция должна соответствовать этому контракту. */
export type Effect<T> = (signal?: AbortSignal) => Promise<T>; // T - Тип возвращаемого значения эффекта

/**
 * Контекст выполнения эффекта для трассировки, логирования и платформенной интеграции.
 * Расширяет ApiRequestContext. Domain-модули могут расширять (например, TimeoutEffectContext).
 * @see ApiRequestContext из @livai/core-contracts
 */
export type EffectContext = ApiRequestContext & {
  /** Имя сервиса или feature, откуда был вызван эффект */
  readonly source?: string;

  /** Человекочитаемое описание эффекта */
  readonly description?: string;

  /** Trace ID для distributed tracing. ВАЖНО: только для корреляции с backend-логами, не логировать публично. */
  readonly traceId?: string;

  /** AbortSignal для cancellation через контекст */
  readonly abortSignal?: AbortSignal;
};

export type EffectTimer = Readonly<{
  now: () => number;
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}>;

export const defaultTimer: EffectTimer = {
  now: (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (cb, ms): unknown => setTimeout(cb, ms),
  clearTimeout: (id): void => {
    clearTimeout(id as ReturnType<typeof setTimeout>);
  },
};

/* ========================================================================== */
/* 🔁 RETRY */
/* ========================================================================== */

/** Политика повторных попыток. */
export interface RetryPolicy {
  /** Количество повторов */
  readonly retries: number;

  /** Базовая задержка между повторами (мс) */
  readonly delayMs: number;

  /** Максимальная задержка между повторами (мс) для safety */
  readonly maxDelayMs?: number;

  /** Экспоненциальный backoff */
  readonly factor?: number;

  /** Фильтр ошибок, при которых retry допустим */
  readonly shouldRetry: (error: unknown) => boolean;
}

/** Оборачивает эффект в retry-механику с экспоненциальным backoff. */
export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy,
  context?: EffectContext,
  metricTags?: readonly string[],
): Effect<T>;

export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy & {
    readonly shouldRetryAsync: (error: unknown) => Promise<boolean>;
  },
  context?: EffectContext,
  metricTags?: readonly string[],
): Effect<T>;

export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy & {
    readonly shouldRetryAsync?: (error: unknown) => Promise<boolean>;
    readonly logger?: EffectLogger;
  },
  context?: EffectContext,
  metricTags?: readonly string[],
): Effect<T> {
  const {
    retries,
    delayMs,
    maxDelayMs,
    factor = 2,
    shouldRetry,
    shouldRetryAsync,
    logger,
  } = policy;

  return async (signal?: AbortSignal): Promise<T> => {
    const retryStartTime = defaultTimer.now();

    // Проверяет, нужно ли делать retry для ошибки
    const checkShouldRetry = async (error: unknown): Promise<boolean> => {
      if (shouldRetryAsync !== undefined) {
        return shouldRetryAsync(error);
      }
      return shouldRetry(error);
    };

    // Логирует retry попытку
    const logRetryAttempt = (attempt: number): void => {
      if (logger?.onRetry !== undefined) {
        const totalDurationMs = defaultTimer.now() - retryStartTime;
        logger.onRetry(attempt, totalDurationMs, context, metricTags);
      }
    };

    // Проверяет, был ли signal aborted
    const checkAborted = (): void => {
      const isAborted = signal?.aborted ?? false;
      if (isAborted) {
        const abortError: EffectError = {
          kind: 'Cancelled',
          message: 'Retry aborted by external signal',
          retriable: false,
        };
        throw abortError;
      }
    };

    // Вычисляет следующую задержку
    const calculateNextDelay = (currentDelayMs: number): number => {
      const nextDelayBase = currentDelayMs * factor;
      return maxDelayMs !== undefined
        ? Math.min(nextDelayBase, maxDelayMs)
        : nextDelayBase;
    };

    // Полностью итеративный подход для 100% stack-safety
    // Предотвращает рост stack при любом количестве retries
    let currentAttempt = 0;
    let currentDelay = delayMs;

    while (true) {
      // Early abort: проверяем перед выполнением эффекта
      checkAborted();

      try {
        return await effect(signal);
      } catch (error) {
        // Если это последняя попытка, пробрасываем ошибку
        if (currentAttempt >= retries) {
          throw error;
        }

        // Проверяем, нужно ли делать retry для этой ошибки
        const shouldRetryThisError = await checkShouldRetry(error);
        if (!shouldRetryThisError) {
          throw error;
        }

        // Логируем retry попытку с суммарным временем для observability
        logRetryAttempt(currentAttempt + 1);

        // Early abort: проверяем перед sleep
        checkAborted();

        // Ждем перед следующей попыткой
        await sleep(currentDelay, signal);

        // Early abort: проверяем после sleep
        checkAborted();

        // Вычисляем задержку для следующей попытки с экспоненциальным backoff
        currentDelay = calculateNextDelay(currentDelay);
        currentAttempt++;
      }
    }
  };
}

/* ========================================================================== */
/* 🛑 CANCELLATION */
/* ========================================================================== */

/**
 * Объединяет несколько AbortSignal в один. Если любой сигнал aborted, объединённый также aborted.
 * Защищён от повторных подписок. Использует { once: true } для автоматической очистки.
 */
export function combineAbortSignals(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const combinedSignal = controller.signal;

  // Если любой сигнал уже aborted, сразу abort
  if (signals.some((s) => s.aborted)) {
    controller.abort();
    return combinedSignal;
  }

  // Используем Set для фильтрации уникальных сигналов (защита от повторных подписок)
  const uniqueSignals = new Set<AbortSignal>(signals);

  // Добавляем listeners для каждого уникального сигнала с { once: true } для автоматической очистки
  const handler = (): void => {
    controller.abort();
  };
  uniqueSignals.forEach((signal) => {
    signal.addEventListener('abort', handler, { once: true });
  });

  return combinedSignal;
}

/** Контроллер отмены эффекта. Совместим с AbortController. */
export interface EffectAbortController {
  abort: () => void;
  signal: AbortSignal;
}

/** Создаёт abort controller для эффекта. */
export function createEffectAbortController(): EffectAbortController {
  const controller = new AbortController();
  return {
    abort: (): void => {
      controller.abort();
    },
    signal: controller.signal,
  };
}

/* ========================================================================== */
/* 🧱 SAFE EXECUTION */
/* ========================================================================== */

/**
 * Определяет тип EffectError из неизвестной ошибки.
 * Автоматически распознает Timeout, Cancelled, Network, Server ошибки.
 */
function determineEffectError(error: unknown): EffectError {
  // Если ошибка уже является EffectError, используем её
  if (
    error !== null
    && error !== undefined
    && typeof error === 'object'
    && 'kind' in error
  ) {
    return error as EffectError;
  }

  // Если это Error, определяем тип по сообщению или имени
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const kind = determineErrorKind(message, error.name);
    const retriable = kind === 'Timeout' || kind === 'Network' || kind === 'Server';

    return {
      kind,
      message: error.message,
      payload: error,
      retriable,
      ...(error.stack !== undefined && { stack: error.stack }),
    };
  }

  // Неизвестный тип ошибки
  const unknownErrorStack = error instanceof Error ? error.stack : undefined;
  return {
    kind: 'Unknown',
    message: String(error),
    payload: error,
    retriable: false,
    ...(unknownErrorStack !== undefined && { stack: unknownErrorStack }),
  };
}

/** Определяет EffectErrorKind по сообщению и имени ошибки. */
function determineErrorKind(message: string, errorName: string): EffectErrorKind {
  if (message.includes('timeout') || errorName === 'TimeoutError') {
    return 'Timeout';
  }
  if (message.includes('cancelled') || message.includes('abort') || errorName === 'AbortError') {
    return 'Cancelled';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'Network';
  }
  if (
    message.includes('server')
    || message.includes('500')
    || message.includes('502')
    || message.includes('503')
  ) {
    return 'Server';
  }
  return 'Unknown';
}

/**
 * Унифицированное безопасное выполнение эффекта. Никогда не кидает исключения наружу.
 * Автоматически определяет тип ошибки (Timeout, Cancelled, Network, Server).
 */
export async function safeExecute<T>( // T - Тип результата эффекта
  effect: Effect<T>,
  mapError?: (error: unknown) => EffectError,
): Promise<{ ok: true; data: T; } | { ok: false; error: EffectError; }> {
  try {
    // eslint-disable-next-line ai-security/model-poisoning
    const data = await effect();
    return { ok: true, data };
  } catch (error) {
    // Если передан кастомный маппер, используем его
    if (mapError) {
      const effectError = mapError(error);
      return { ok: false, error: effectError };
    }

    // Автоматическое определение типа ошибки для известных случаев
    const effectError = determineEffectError(error);
    return { ok: false, error: effectError };
  }
}

/* ========================================================================== */
/* 🔄 API RESPONSE ADAPTER */
/* ========================================================================== */

/** Преобразует обычный effect в effect с ApiResponse<T> для унификации с API контрактами. */
export function asApiEffect<T>(
  effect: Effect<T>,
  mapError: (error: unknown) => ApiError,
  options?: {
    readonly meta?: SanitizedJson;
  },
): Effect<ApiResponse<T>> {
  return async () => {
    try {
      // eslint-disable-next-line ai-security/model-poisoning
      const data = await effect();
      const baseResponse: ApiResponse<T> = {
        success: true,
        data,
      };
      const meta = options?.meta;
      return meta !== undefined ? { ...baseResponse, meta } : baseResponse;
    } catch (error) {
      const apiError = mapError(error);
      const baseResponse: ApiResponse<T> = {
        success: false,
        error: apiError,
      };
      const meta = options?.meta;
      return meta !== undefined ? { ...baseResponse, meta } : baseResponse;
    }
  };
}

/* ========================================================================== */
/* 🧩 PIPELINE / COMPOSITION */
/* ========================================================================== */

const MIN_EFFECTS_COUNT = 1;
const MAX_OPTIMIZED_EFFECTS = 4;
const THREE_EFFECTS = 3;

/** Последовательно композирует эффекты с типобезопасной цепочкой (для двух эффектов). */
export function pipeEffects<A, B>( // A - Тип результата первого эффекта, B - Тип результата второго эффекта
  first: Effect<A>,
  second: (value: A) => Effect<B>,
): Effect<B>;

/** Последовательно композирует эффекты с типобезопасной цепочкой (для трёх эффектов). */
export function pipeEffects<A, B, C>( // A - Тип результата первого эффекта, B - Тип результата второго эффекта, C - Тип результата третьего эффекта
  first: Effect<A>,
  second: (value: A) => Effect<B>,
  third: (value: B) => Effect<C>,
): Effect<C>;

/** Последовательно композирует эффекты с типобезопасной цепочкой (для четырёх эффектов). */
export function pipeEffects<A, B, C, D>( // A - Тип результата первого эффекта, B - Тип результата второго эффекта, C - Тип результата третьего эффекта, D - Тип результата четвёртого эффекта
  first: Effect<A>,
  second: (value: A) => Effect<B>,
  third: (value: B) => Effect<C>,
  fourth: (value: C) => Effect<D>,
): Effect<D>;

/** Последовательно композирует эффекты с типобезопасной цепочкой (для пяти эффектов). */
export function pipeEffects<A, B, C, D, E>( // A - Тип результата первого эффекта, B - Тип результата второго эффекта, C - Тип результата третьего эффекта, D - Тип результата четвёртого эффекта, E - Тип результата пятого эффекта
  first: Effect<A>,
  second: (value: A) => Effect<B>,
  third: (value: B) => Effect<C>,
  fourth: (value: C) => Effect<D>,
  fifth: (value: D) => Effect<E>,
): Effect<E>;

/** Последовательно композирует эффекты. Поддерживает цепочку из любого количества эффектов. */
export function pipeEffects<T>( // T - Тип результата первого эффекта
  first: Effect<T>,
  ...effects: ((value: unknown) => Effect<unknown>)[]
): Effect<unknown>;

export function pipeEffects<T>(
  first: Effect<T>,
  ...effects: ((value: unknown) => Effect<unknown>)[]
): Effect<unknown> {
  return async (signal?: AbortSignal): Promise<unknown> => {
    const initial = await first(signal);

    // Выполняет цепочку эффектов для оптимизированных случаев
    const executeOptimizedChain = async (
      startValue: unknown,
      effectChain: readonly ((value: unknown) => Effect<unknown>)[],
    ): Promise<unknown> => {
      return effectChain.reduce(
        async (currentPromise, nextEffect) => {
          const current = await currentPromise;
          return nextEffect(current)(signal);
        },
        Promise.resolve(startValue),
      );
    };

    // Общий случай для 5+ эффектов
    const executeChain = async (
      currentValue: unknown,
      remainingEffects: readonly ((value: unknown) => Effect<unknown>)[],
    ): Promise<unknown> => {
      if (remainingEffects.length === 0) {
        return currentValue;
      }
      const [nextEffect, ...rest] = remainingEffects;
      if (nextEffect === undefined) {
        return currentValue;
      }
      const nextValue = await nextEffect(currentValue)(signal);
      return executeChain(nextValue, rest);
    };

    // Обработка типобезопасных перегрузок для 2-5 эффектов
    if (effects.length === MIN_EFFECTS_COUNT) {
      return executeOptimizedChain(initial, effects);
    }
    if (effects.length === 2) {
      return executeOptimizedChain(initial, effects);
    }
    if (effects.length === THREE_EFFECTS) {
      return executeOptimizedChain(initial, effects);
    }
    if (effects.length === MAX_OPTIMIZED_EFFECTS) {
      return executeOptimizedChain(initial, effects);
    }

    // Общий случай для 5+ эффектов
    return executeChain(initial, effects);
  };
}

/* ========================================================================== */
/* 🔭 OBSERVABILITY */
/* ========================================================================== */

/** Логгер эффектов. Подключается на уровне платформы (web / pwa / mobile). */
export interface EffectLogger {
  onStart?: (context?: EffectContext) => void;
  onSuccess?: (durationMs: number, context?: EffectContext, metricTags?: readonly string[]) => void;
  onError?: (error: unknown, context?: EffectContext, metricTags?: readonly string[]) => void;
  /** Опциональный callback для логирования retry попыток с суммарным временем */
  onRetry?: (
    attempt: number,
    totalDurationMs: number,
    context?: EffectContext,
    metricTags?: readonly string[],
  ) => void;
}

/** Оборачивает эффект в логирование и метрики. */
export function withLogging<T>(
  effect: Effect<T>,
  logger: EffectLogger,
  context?: EffectContext,
  metricTags?: readonly string[],
): Effect<T> {
  return () => {
    const start = defaultTimer.now();
    logger.onStart?.(context);

    return effect()
      .then((result) => {
        const duration = defaultTimer.now() - start;
        logger.onSuccess?.(duration, context, metricTags);
        return result;
      })
      .catch((error) => {
        logger.onError?.(error, context, metricTags);
        // eslint-disable-next-line promise/no-return-wrap
        return Promise.reject(error);
      });
  };
}

/* ========================================================================== */
/* 🧠 PLATFORM-SAFE SLEEP */
/* ========================================================================== */

/** Платформо-независимый sleep с поддержкой cancellation. При отмене бросает EffectError с kind = 'Cancelled'. */
export async function sleep(
  ms: number,
  signal?: AbortSignal,
  timer: EffectTimer = defaultTimer,
): Promise<void> {
  // Если signal уже aborted, сразу бросаем ошибку
  const isAborted = signal?.aborted ?? false;
  if (isAborted) {
    const sleepError = new Error();
    const cancelledError: EffectError = {
      kind: 'Cancelled',
      message: 'Sleep cancelled',
      retriable: false,
      ...(sleepError.stack !== undefined && { stack: sleepError.stack }),
    };
    throw cancelledError;
  }

  let timeoutId: unknown;
  let abortHandler: (() => void) | undefined;

  return new Promise<void>((resolve, reject) => {
    timeoutId = timer.setTimeout(() => {
      resolve(undefined);
    }, ms);

    if (signal) {
      abortHandler = (): void => {
        timer.clearTimeout(timeoutId);
        const sleepError = new Error();
        const cancelledError: EffectError = {
          kind: 'Cancelled',
          message: 'Sleep cancelled',
          retriable: false,
          ...(sleepError.stack !== undefined && { stack: sleepError.stack }),
        };
        reject(cancelledError);
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    }
  }).finally(() => {
    // Очистка: удаляем listener и очищаем timeout на случай, если он еще не был очищен
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
    // Очищаем timeout на случай, если он еще не был очищен (защита от утечек)
    if (timeoutId !== undefined) {
      timer.clearTimeout(timeoutId);
    }
  });
}

/* ========================================================================== */
/* 🔧 EFFECT RESULT & ERROR TYPES */
/* ========================================================================== */

/** Результат выполнения эффекта. Унифицированный формат для success/error handling. */
export type EffectResult<T> = Promise<{ ok: true; data: T; } | { ok: false; error: EffectError; }>;

/** Типы ошибок эффектов для discriminated union. */
export type EffectErrorKind =
  | 'Timeout'
  | 'Network'
  | 'Server'
  | 'ApiError'
  | 'Cancelled'
  | 'Unknown';

/** Ошибка эффекта с метаданными. */
export interface EffectError<T = unknown> {
  readonly kind: EffectErrorKind;
  readonly status?: number;
  readonly message: string;
  readonly payload?: T;
  readonly retriable?: boolean;
  readonly tags?: readonly string[];
  readonly meta?: SanitizedJson;
  /** Stack trace для production debugging (опционально) */
  readonly stack?: string;
}

/* ========================================================================== */
/* 🔷 TYPED RESULT (RESULT<T, E> / EITHER) */
/* ========================================================================== */

/**
 * Универсальный результат операции (Result<T, E> или Either<L, R>).
 * Отличие от ValidationResult<T>: одна ошибка типа E vs массив ValidationError[].
 */
export type Result<T, E = Error> = // T - Тип успешного значения, E - Тип ошибки (по умолчанию Error)
  | { readonly ok: true; readonly value: T; } // Тип успешного значения
  | { readonly ok: false; readonly error: E; }; // Тип ошибки

/** Создает успешный результат. */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

/** Создает ошибочный результат. */
export function fail<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, error };
}

/** Type guard для проверки успешного результата. */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T; } {
  return result.ok;
}

/** Type guard для проверки ошибочного результата. */
export function isFail<T, E>(result: Result<T, E>): result is { ok: false; error: E; } {
  return !result.ok;
}

/** Преобразует значение успешного результата. Если ошибочный, возвращает без изменений. */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result as Result<U, E>;
}

/** Преобразует ошибку ошибочного результата. Если успешный, возвращает без изменений. */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (isFail(result)) {
    return fail(fn(result.error));
  }
  return result as Result<T, F>;
}

/** Композиция результатов (flatMap / bind). Если успешный, применяет функцию, иначе возвращает ошибку. */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result as Result<U, E>;
}

/** Извлекает значение из результата или возвращает значение по умолчанию. */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/** Извлекает значение из результата или вычисляет его из ошибки. */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T,
): T {
  if (isOk(result)) {
    return result.value;
  }
  if (isFail(result)) {
    return fn(result.error);
  }
  // This ветка теоретически недостижима, но нужна для type safety
  throw new Error('Invalid Result state');
}

/**
 * Извлекает значение из результата или бросает исключение. Используйте с осторожностью, предпочтительно unwrapOr/unwrapOrElse.
 * Безопасно обрабатывает ошибки, проверяя instanceof Error.
 * @throws Если результат ошибочный (Error или новый Error из строкового представления)
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  if (isFail(result)) {
    // Безопасная обработка ошибки: проверяем, что это Error, иначе создаём новый
    const errorToThrow = result.error instanceof Error
      ? result.error
      : new Error(String(result.error));
    throw errorToThrow;
  }
  // This ветка теоретически недостижима, но нужна для type safety
  throw new Error('Invalid Result state');
}

/* eslint-enable fp/no-throw, functional/no-let, fp/no-mutation, functional/no-loop-statements, @typescript-eslint/no-unnecessary-condition */
