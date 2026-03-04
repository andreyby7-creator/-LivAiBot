/**
 * @file packages/app/src/lib/effect-utils.ts
 * ============================================================================
 * ⚡ EFFECT UTILS — УНИВЕРСАЛЬНЫЕ ПОМОЩНИКИ ДЛЯ ЭФФЕКТОВ
 * ============================================================================
 * Этот файл — фундамент слоя side-effects во всём фронтенде.
 * Он не знает ничего о доменах (auth, chat, bots и т.д.) и не зависит от UI.
 * Используется для:
 * - HTTP / WebSocket / SSE
 * - Retry / Timeout / Cancellation (AbortSignal propagation)
 * - Типобезопасная обработка результатов (Result<T, E>)
 * - Tracing / Observability
 * - Унифицированной обработки ошибок
 * - Поддержки микросервисной архитектуры
 * Принципы:
 * - Zero business logic
 * - Zero UI dependencies
 * - Детерминированность
 * - Полная тестируемость
 * - Один контракт → одна ответственность
 */

import type { Effect as EffectLib } from 'effect';

import type { ApiError, ApiRequestContext, ApiResponse } from '../types/api.js';

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

  /** Trace ID для distributed tracing */
  readonly traceId?: string;

  /** AbortSignal для cancellation через контекст */
  readonly abortSignal?: AbortSignal;
};

/* ========================================================================== */
/* ⏱ TIMEOUT */
/* ========================================================================== */

/** Ошибка превышения времени ожидания. */
export class TimeoutError extends Error {
  constructor(message = 'Effect execution timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Оборачивает эффект в timeout. */
export function withTimeout<T>(
  effect: Effect<T>,
  timeoutMs: number,
): Effect<T> {
  return async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        effect(),
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout((): void => {
            reject(new TimeoutError());
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  };
}

/* ========================================================================== */
/* 🔁 RETRY */
/* ========================================================================== */

/** Политика повторных попыток. */
export type RetryPolicy = {
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
};

/**
 * Оборачивает эффект в retry-механику.
 *
 * @example withRetry(fetchUser, { retries: 3, delayMs: 1000, shouldRetry: (e) => e instanceof NetworkError })
 */
export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy,
): Effect<T> {
  const {
    retries,
    delayMs,
    maxDelayMs,
    factor = 2,
    shouldRetry,
  } = policy;

  return async (): Promise<T> => {
    let currentDelay = delayMs;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await effect();
      } catch (error) {
        if (attempt >= retries) {
          throw error;
        }

        const shouldRetryThisError = shouldRetry(error);
        if (!shouldRetryThisError) {
          throw error;
        }

        await new Promise<void>((r) => setTimeout(r, currentDelay));
        currentDelay = Math.min(currentDelay * factor, maxDelayMs ?? currentDelay * factor);
      }
    }

    // Это никогда не должно достигаться, но TypeScript это нужно
    throw new Error('Unexpected end of retry loop');
  };
}

/* ========================================================================== */
/* 🛑 CANCELLATION */
/* ========================================================================== */

/** Контроллер отмены эффекта. Совместим с AbortController. */
export type EffectAbortController = {
  abort: () => void;
  signal: AbortSignal;
};

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
): Promise<{ ok: true; data: T; } | { ok: false; error: EffectError; }> {
  try {
    const data = await effect();
    return { ok: true, data };
  } catch (error) {
    // Преобразуем неизвестную ошибку в EffectError
    const effectError: EffectError = {
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
): Effect<ApiResponse<T>> {
  return async () => {
    try {
      const data = await effect();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: mapError(error),
      };
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
  return async (): Promise<unknown> => {
    let result: unknown = await first();

    for (const effect of effects) {
      result = await effect(result)();
    }

    return result;
  };
}

/* ========================================================================== */
/* 🔭 OBSERVABILITY */
/* ========================================================================== */

/** Логгер эффектов. Подключается на уровне платформы (web / pwa / mobile). */
export type EffectLogger = {
  onStart?: (context?: EffectContext) => void;
  onSuccess?: (durationMs: number, context?: EffectContext) => void;
  onError?: (error: unknown, context?: EffectContext) => void;
};

/** Оборачивает эффект в логирование и метрики. */
export function withLogging<T>(
  effect: Effect<T>,
  logger: EffectLogger,
  context?: EffectContext,
): Effect<T> {
  return async () => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    logger.onStart?.(context);

    try {
      const result = await effect();
      const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        - start;
      logger.onSuccess?.(duration, context);
      return result;
    } catch (error) {
      logger.onError?.(error, context);
      throw error;
    }
  };
}

/* ========================================================================== */
/* 🧠 PLATFORM-SAFE SLEEP */
/* ========================================================================== */

/** Платформо-независимый sleep с поддержкой cancellation. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = (): void => {
        clearTimeout(timeoutId);
        reject(new Error('Sleep cancelled'));
      };

      signal.addEventListener('abort', abortHandler, { once: true });
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
export type EffectError<T = unknown> = {
  readonly kind: EffectErrorKind;
  readonly status?: number;
  readonly message: string;
  readonly payload?: T;
  readonly retriable?: boolean;
};

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
  // This should never happen, but TypeScript needs it
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
    throw result.error;
  }
  // This should never happen, but TypeScript needs it
  throw new Error('Invalid Result state');
}
