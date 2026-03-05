/**
 * @file @livai/core/src/effect/effect-utils.ts
 *
 * ============================================================================
 * ⚡ EFFECT UTILS — УНИВЕРСАЛЬНЫЕ ПОМОЩНИКИ ДЛЯ ЭФФЕКТОВ
 * ============================================================================
 *
 * Этот файл — фундамент слоя side-effects во всём фронтенде.
 * Он не знает ничего о доменах (auth, chat, bots и т.д.) и не зависит от UI.
 *
 * Используется для:
 * - HTTP / WebSocket / SSE
 * - Retry / Timeout / Cancellation (AbortSignal propagation)
 * - Типобезопасная обработка результатов (Result<T, E>)
 * - Tracing / Observability
 * - Унифицированной обработки ошибок
 * - Поддержки микросервисной архитектуры
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

/* ========================================================================== */
/* 🧠 БАЗОВЫЕ ТИПЫ ЭФФЕКТОВ */
/* ========================================================================== */

/** Effect функция без параметров. */
export type EffectFn<T> = () => EffectLib.Effect<T>;

/** Универсальный эффект. Любая асинхронная операция должна соответствовать этому контракту. */
export type Effect<T> = (signal?: AbortSignal) => Promise<T>;

/** Контекст выполнения эффекта для трассировки, логирования и платформенной интеграции. */
export type EffectContext = ApiRequestContext & {
  /** Имя сервиса или feature, откуда был вызван эффект */
  readonly source?: string;

  /** Человекочитаемое описание эффекта */
  readonly description?: string;

  /**
   * Trace ID для distributed tracing.
   * ВАЖНО: используется только для корреляции с backend-логами и не должен
   * логироваться в публичные логи или отображаться пользователю.
   */
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
/* ⏱ TIMEOUT */
/* ========================================================================== */

/** Ошибка превышения времени ожидания. */
export type TimeoutError = Error & { readonly name: 'TimeoutError'; };

/** Фабрика ошибок таймаута без использования классов. */
export function createTimeoutError(message = 'Effect execution timeout'): TimeoutError {
  const error = new Error(message) as TimeoutError;
  // Императивное присваивание допустимо здесь для корректного stack trace и instanceof Error
  // eslint-disable-next-line fp/no-mutation, functional/immutable-data
  (error as { name: 'TimeoutError'; }).name = 'TimeoutError';
  return error;
}

/** Оборачивает эффект в timeout. Поддерживает DI таймеров и cancellation. */
export function withTimeout<T>(
  effect: Effect<T>,
  timeoutMs: number,
  options?: {
    readonly timer?: EffectTimer;
    readonly signal?: AbortSignal;
  },
): Effect<T> {
  const timer = options?.timer ?? defaultTimer;
  const { signal } = options ?? {};

  return async (outerSignal?: AbortSignal) => {
    const controller = new AbortController();
    const combinedSignal = outerSignal ?? signal;

    if (combinedSignal?.aborted === true) {
      // eslint-disable-next-line fp/no-throw
      throw createTimeoutError('Effect execution aborted');
    }

    // Используем объект для хранения состояния timeout (необходимо для очистки ресурсов)
    const timeoutState: { id: unknown; handler: (() => void) | undefined; } = {
      id: undefined,
      handler: undefined,
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      // eslint-disable-next-line functional/immutable-data, fp/no-mutation
      timeoutState.id = timer.setTimeout((): void => {
        reject(createTimeoutError());
      }, timeoutMs);

      // eslint-disable-next-line functional/immutable-data, fp/no-mutation
      timeoutState.handler = (): void => {
        timer.clearTimeout(timeoutState.id);
        reject(createTimeoutError('Effect execution aborted'));
      };

      controller.signal.addEventListener('abort', timeoutState.handler, { once: true });
    });

    const combinedAbortHandler = (): void => {
      controller.abort();
    };

    if (combinedSignal) {
      combinedSignal.addEventListener('abort', combinedAbortHandler, { once: true });
    }

    try {
      return await Promise.race([effect(combinedSignal), timeoutPromise]);
    } finally {
      // Очистка всех listeners и таймера
      if (combinedSignal) {
        combinedSignal.removeEventListener('abort', combinedAbortHandler);
      }
      if (timeoutState.handler) {
        controller.signal.removeEventListener('abort', timeoutState.handler);
      }
      if (timeoutState.id !== undefined) {
        timer.clearTimeout(timeoutState.id);
      }
    }
  };
}

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

/**
 * Оборачивает эффект в retry-механику.
 *
 * @example withRetry(fetchUser, { retries: 3, delayMs: 1000, shouldRetry: (e) => e instanceof NetworkError })
 */
export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy,
): Effect<T>;

export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy & {
    readonly shouldRetryAsync: (error: unknown) => Promise<boolean>;
  },
): Effect<T>;

export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy & {
    readonly shouldRetryAsync?: (error: unknown) => Promise<boolean>;
  },
): Effect<T> {
  const {
    retries,
    delayMs,
    maxDelayMs,
    factor = 2,
    shouldRetry,
    shouldRetryAsync,
  } = policy;

  return async (signal?: AbortSignal): Promise<T> => {
    const executeAttempt = async (
      attempt: number,
      currentDelay: number,
    ): Promise<T> => {
      try {
        return await effect(signal);
      } catch (error) {
        if (attempt >= retries) {
          // eslint-disable-next-line fp/no-throw
          throw error;
        }

        const shouldRetryThisError = shouldRetryAsync
          ? await shouldRetryAsync(error)
          : shouldRetry(error);

        if (!shouldRetryThisError) {
          // eslint-disable-next-line fp/no-throw
          throw error;
        }

        await sleep(currentDelay, signal);
        const nextDelayBase = currentDelay * factor;
        const nextDelay = maxDelayMs != null ? Math.min(nextDelayBase, maxDelayMs) : nextDelayBase;

        return executeAttempt(attempt + 1, nextDelay);
      }
    };

    return executeAttempt(0, delayMs);
  };
}

/* ========================================================================== */
/* 🛑 CANCELLATION */
/* ========================================================================== */

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

/** Унифицированное безопасное выполнение эффекта. Никогда не кидает исключения наружу. */
export async function safeExecute<T>(
  effect: Effect<T>,
  mapError?: (error: unknown) => EffectError,
): Promise<{ ok: true; data: T; } | { ok: false; error: EffectError; }> {
  try {
    // eslint-disable-next-line ai-security/model-poisoning
    const data = await effect();
    return { ok: true, data };
  } catch (error) {
    const effectError: EffectError = mapError
      ? mapError(error)
      : {
        kind: 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        payload: error,
        retriable: false,
      };
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

/**
 * Последовательно композирует эффекты. Поддерживает цепочку из любого количества эффектов.
 *
 * @example pipeEffects(() => fetchToken(), (token) => fetchUser(token), (user) => fetchPosts(user.id))
 */
export function pipeEffects<T>(
  first: Effect<T>,
  ...effects: ((value: unknown) => Effect<unknown>)[]
): Effect<unknown> {
  return async (signal?: AbortSignal): Promise<unknown> => {
    const runNext = async (index: number, current: unknown): Promise<unknown> => {
      if (index >= effects.length) {
        return current;
      }

      const nextEffect = effects[index];
      if (!nextEffect) {
        return current;
      }

      const nextValue = await nextEffect(current)(signal);
      return runNext(index + 1, nextValue);
    };

    const initial = await first(signal);
    return runNext(0, initial);
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

/** Платформо-независимый sleep с поддержкой cancellation и DI таймеров. */
export function sleep(
  ms: number,
  signal?: AbortSignal,
  timer: EffectTimer = defaultTimer,
): Promise<void> {
  // Используем объект для хранения handler (необходимо для очистки ресурсов)
  const handlerState: { handler: (() => void) | undefined; } = {
    handler: undefined,
  };

  return new Promise<void>((resolve, reject) => {
    const timeoutId = timer.setTimeout(() => {
      resolve(undefined);
    }, ms);

    if (signal) {
      // eslint-disable-next-line functional/immutable-data, fp/no-mutation
      handlerState.handler = (): void => {
        timer.clearTimeout(timeoutId);
        reject(new Error('Sleep cancelled'));
      };

      signal.addEventListener('abort', handlerState.handler, { once: true });
    }
  }).finally(() => {
    // Очистка listener'а после завершения Promise
    if (signal && handlerState.handler) {
      signal.removeEventListener('abort', handlerState.handler);
    }
  });
}

/* ========================================================================== */
/* 🔧 EFFECT RESULT & ERROR TYPES */
/* ========================================================================== */

/** Результат выполнения эффекта. Унифицированный формат для success/error handling. */
export type EffectResult<T> = Promise<{ ok: true; data: T; } | { ok: false; error: EffectError; }>;

/** Типы ошибок эффектов для discriminated union. */
export type EffectErrorKind = 'Timeout' | 'Network' | 'Server' | 'ApiError' | 'Unknown';

/** Ошибка эффекта с метаданными. */
export interface EffectError<T = unknown> {
  readonly kind: EffectErrorKind;
  readonly status?: number;
  readonly message: string;
  readonly payload?: T;
  readonly retriable?: boolean;
  readonly tags?: readonly string[];
  readonly meta?: SanitizedJson;
}

/* ========================================================================== */
/* 🔷 TYPED RESULT (RESULT<T, E> / EITHER) */
/* ========================================================================== */

/**
 * Типобезопасный результат операции (Result<T, E> или Either<L, R>).
 * Используется для типобезопасной обработки успешных результатов и ошибок без использования исключений.
 *
 * @example if (isOk(result)) { result.value } else { result.error }
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T; }
  | { readonly ok: false; readonly error: E; };

/** Создает успешный результат. */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

/** Создает ошибочный результат. */
export function fail<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, error };
}

/**
 * Type guard для проверки успешного результата.
 *
 * @example if (isOk(result)) { result.value }
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T; } {
  return result.ok;
}

/**
 * Type guard для проверки ошибочного результата.
 *
 * @example if (isFail(result)) { result.error }
 */
export function isFail<T, E>(result: Result<T, E>): result is { ok: false; error: E; } {
  return !result.ok;
}

/**
 * Преобразует значение успешного результата. Если результат ошибочный, возвращает его без изменений.
 *
 * @example map(ok(42), (x) => x * 2) // ok(84)
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result as Result<U, E>;
}

/**
 * Преобразует ошибку ошибочного результата. Если результат успешный, возвращает его без изменений.
 *
 * @example mapError(fail(err), (e) => new CustomError(e.message))
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (isFail(result)) {
    return fail(fn(result.error));
  }
  return result as Result<T, F>;
}

/**
 * Композиция результатов (flatMap / bind). Если результат успешный, применяет функцию, иначе возвращает ошибку.
 *
 * @example flatMap(ok(42), (x) => ok(x * 2)) // ok(84)
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result as Result<U, E>;
}

/**
 * Извлекает значение из результата или возвращает значение по умолчанию.
 *
 * @example unwrapOr(fail(err), 0) // 0
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Извлекает значение из результата или вычисляет его из ошибки.
 *
 * @example unwrapOrElse(fail(err), (e) => 0) // 0
 */
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
  // eslint-disable-next-line fp/no-throw
  throw new Error('Invalid Result state');
}

/**
 * Извлекает значение из результата или бросает исключение. Используйте с осторожностью, предпочтительно unwrapOr/unwrapOrElse.
 *
 * @example unwrap(ok(42)) // 42
 * @throws Если результат ошибочный
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  if (isFail(result)) {
    // eslint-disable-next-line fp/no-throw
    throw result.error;
  }
  // This ветка теоретически недостижима, но нужна для type safety
  // eslint-disable-next-line fp/no-throw
  throw new Error('Invalid Result state');
}
