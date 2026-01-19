/**
 * @file packages/app/src/lib/effect-utils.ts
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
 * - Retry / Timeout / Cancellation
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
 */

import type { ApiError, ApiRequestContext, ApiResponse } from '../types/api.js';

/* ========================================================================== */
/* 🧠 БАЗОВЫЕ ТИПЫ ЭФФЕКТОВ */
/* ========================================================================== */

/**
 * Универсальный эффект.
 * Любая асинхронная операция в системе должна соответствовать этому контракту.
 */
export type Effect<T> = (signal?: AbortSignal) => Promise<T>;

/**
 * Контекст выполнения эффекта.
 * Используется для трассировки, логирования и платформенной интеграции.
 */
export type EffectContext = ApiRequestContext & {
  /** Имя сервиса или feature, откуда был вызван эффект */
  source?: string;

  /** Человекочитаемое описание эффекта */
  description?: string;
};

/* ========================================================================== */
/* ⏱ TIMEOUT */
/* ========================================================================== */

/**
 * Ошибка превышения времени ожидания.
 */
export class TimeoutError extends Error {
  constructor(message = 'Effect execution timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Оборачивает эффект в timeout.
 *
 * @example
 * const effect = withTimeout(fetchUser, 5000)
 */
export function withTimeout<T>(
  effect: Effect<T>,
  timeoutMs: number,
): Effect<T> {
  return () => {
    return Promise.race([
      effect(),
      new Promise<T>((_, reject) => {
        setTimeout((): void => {
          reject(new TimeoutError());
        }, timeoutMs);
      }),
    ]);
  };
}

/* ========================================================================== */
/* 🔁 RETRY */
/* ========================================================================== */

/**
 * Политика повторных попыток.
 */
export type RetryPolicy = {
  /** Количество повторов */
  retries: number;

  /** Базовая задержка между повторами (мс) */
  delayMs: number;

  /** Экспоненциальный backoff */
  factor?: number;

  /** Фильтр ошибок, при которых retry допустим */
  shouldRetry: (error: unknown) => boolean;
};

/**
 * Оборачивает эффект в retry-механику.
 *
 * @example
 * const effect = withRetry(fetchUser, { retries: 3, delayMs: 1000 });
 * const user = await effect(); // Максимум 4 попытки (1 + 3 retry)
 */
export function withRetry<T>(
  effect: Effect<T>,
  policy: RetryPolicy,
): Effect<T> {
  const {
    retries,
    delayMs,
    factor = 2,
    shouldRetry,
  } = policy;

  return async () => {
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
        currentDelay *= factor;
      }
    }

    // Это никогда не должно достигаться, но TypeScript это нужно
    throw new Error('Unexpected end of retry loop');
  };
}

/* ========================================================================== */
/* 🛑 CANCELLATION */
/* ========================================================================== */

/**
 * Контроллер отмены эффекта.
 * Совместим с AbortController.
 */
export type EffectAbortController = {
  abort: () => void;
  signal: AbortSignal;
};

/**
 * Создаёт abort controller для эффекта.
 */
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
 * Унифицированное безопасное выполнение эффекта.
 * Никогда не кидает исключения наружу.
 */
export async function safeExecute<T>(
  effect: Effect<T>,
): Promise<{ ok: true; data: T; } | { ok: false; error: unknown; }> {
  try {
    const data = await effect();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error };
  }
}

/* ========================================================================== */
/* 🔄 API RESPONSE ADAPTER */
/* ========================================================================== */

/**
 * Преобразует обычный effect в effect с ApiResponse<T>.
 * Используется для унификации эффектов с API контрактами.
 */
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
 * Последовательно композирует эффекты.
 *
 * @example
 * const effect = pipeEffects(
 *   () => fetchToken(),
 *   (token) => fetchUser(token),
 * )
 */
export function pipeEffects<A, B>(
  first: Effect<A>,
  second: (a: A) => Effect<B>,
): Effect<B> {
  return async () => {
    const a = await first();
    return second(a)();
  };
}

/* ========================================================================== */
/* 🔭 OBSERVABILITY */
/* ========================================================================== */

/**
 * Логгер эффектов.
 * Подключается на уровне платформы (web / pwa / mobile).
 */
export type EffectLogger = {
  onStart?: (context?: EffectContext) => void;
  onSuccess?: (durationMs: number, context?: EffectContext) => void;
  onError?: (error: unknown, context?: EffectContext) => void;
};

/**
 * Оборачивает эффект в логирование и метрики.
 */
export function withLogging<T>(
  effect: Effect<T>,
  logger: EffectLogger,
  context?: EffectContext,
): Effect<T> {
  return async () => {
    const start = performance.now();
    logger.onStart?.(context);

    try {
      const result = await effect();
      logger.onSuccess?.(performance.now() - start, context);
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

/**
 * Платформо-независимый sleep.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ========================================================================== */
/* 🔧 EFFECT RESULT & ERROR TYPES */
/* ========================================================================== */

/**
 * Результат выполнения эффекта.
 * Может быть успешным или содержать ошибку.
 */
export type EffectResult<T> = Promise<T>;

/**
 * Ошибка эффекта с метаданными.
 */
export type EffectError<T = unknown> = {
  kind: string;
  status?: number;
  message: string;
  payload?: T;
  retriable?: boolean;
};

/* ========================================================================== */
/* 🔍 TRACING & OBSERVABILITY */
/* ========================================================================== */

/**
 * Оборачивает эффект в tracing для observability.
 * Добавляет метаданные для мониторинга и отладки.
 */
export function withTracing<T>(
  _operation: string,
  effect: Effect<T>,
): Effect<T> {
  return async () => {
    try {
      const result = await effect();

      // В реальном приложении здесь будет отправка метрик
      // console.log(`[TRACE] ${_operation} completed`);

      return result;
    } catch (error) {
      // console.error(`[TRACE] ${_operation} failed:`, error);

      throw error;
    }
  };
}
