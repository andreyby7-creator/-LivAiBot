/**
 * @file CacheAdapterEffect.ts
 *
 * Effect-пайплайн для Cache адаптера с поддержкой:
 * timeout, retry, circuit breaker, нормализации ошибок,
 * стратегий восстановления, логирования и метрик.
 *
 * Архитектурно и семантически консистентен с HTTP и DB адаптерами.
 */

import { Effect, Schedule } from 'effect';

import { INFRA_ERROR_CODES } from '../../../base/ErrorCode.js';
import { resolveAndExecuteWithCircuitBreaker } from '../../../base/ErrorStrategies.js';
import { normalizeCacheError } from '../../normalizers/CacheNormalizer.js';

import { CACHE_ADAPTER_DEFAULTS, getCircuitBreakerKey } from './CacheAdapterConfig.js';
import { cacheAdapterFactories } from './CacheAdapterFactories.js';

import type {
  CacheDurationMs,
  CacheKey,
  CacheMaxRetries,
  CacheTimeoutMs,
  CacheTtlMs,
} from './CacheAdapterTypes.js';
import type { LivAiErrorCode } from '../../../base/ErrorCode.js';
import type { StrategyResult } from '../../../base/ErrorStrategies/ErrorStrategyTypes.js';

// ==================== ТИПЫ ====================

/** Тип операций Cache адаптера */
type CacheOperation = 'GET' | 'SET' | 'DELETE';

/** Tagged Error для Cache адаптера */
type TaggedError =
  | {
    _tag: 'CacheError';
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
  | {
    _tag: 'SharedAdapterError';
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
  | { _tag: string; code?: string; [key: string]: unknown; };

/** Type guard для CacheError */
const isCacheError = (
  error: TaggedError,
): error is Extract<TaggedError, { _tag: 'CacheError'; }> => error._tag === 'CacheError';

/** Cache клиент интерфейс */
export type CacheClient = {
  get<T = unknown>(key: CacheKey): Promise<T | null>;
  set<T = unknown>(key: CacheKey, value: T, ttlMs?: CacheTtlMs): Promise<void>;
  delete(key: CacheKey): Promise<void>;

  // @experimental - extension points для будущих bulk операций
  /** @experimental Получение нескольких значений по ключам */
  mget?<T = unknown>(keys: CacheKey[]): Promise<T[] | null>;
  /** @experimental Установка нескольких значений */
  mset?<T = unknown>(
    entries: { key: CacheKey; value: T; ttlMs?: CacheTtlMs; }[],
  ): Promise<void>;
};

/** Clock интерфейс */
export type Clock = { now(): number; };

/** Logger интерфейс */
export type Logger = {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

/** Metrics интерфейс */
export type Metrics = {
  timing(name: string, value: number, tags?: Record<string, string | number>): void;
  increment(name: string, value?: number, tags?: Record<string, string | number>): void;
};

/** Circuit Breaker интерфейс */
export type CircuitBreaker = {
  isOpen(key: string): boolean;
  recordSuccess?(key: string): void;
  recordFailure?(key: string): void;
  getFailureCount?(key: string): number;
};

// ==================== ЛОГИРОВАНИЕ И МЕТРИКИ ====================

const logCacheSuccess = (
  logger: Logger,
  metrics: Metrics,
  operation: 'GET' | 'SET' | 'DELETE',
  key: CacheKey,
  durationMs: CacheDurationMs,
): void => {
  metrics.timing('cache_operation_duration', durationMs, { operation });
  logger.info('Cache операция выполнена', { operation, key, durationMs });
};

const logCacheError = (
  logger: Logger,
  metrics: Metrics,
  operation: 'GET' | 'SET' | 'DELETE',
  key: CacheKey,
  durationMs: CacheDurationMs,
  error: unknown,
): void => {
  metrics.increment('cache_operation_error', 1, { operation });
  logger.error('Ошибка cache операции', {
    operation,
    key,
    durationMs,
    error: error instanceof Error ? error.message : String(error),
  });
};

const logCacheRetry = (
  logger: Logger,
  metrics: Metrics,
  operation: CacheOperation,
  key: CacheKey,
  error: unknown,
): void => {
  metrics.increment('cache_retry_attempt', 1, { operation });
  logger.warn('Повтор cache операции', {
    operation,
    key,
    error: error instanceof Error ? error.message : String(error),
  });
};

// ==================== ОБЕРТКИ ЭФФЕКТОВ ====================

/** Обертка с circuit breaker */
const withCircuitBreaker = <T>(
  effect: Effect.Effect<T, unknown, unknown>,
  circuitBreaker: CircuitBreaker,
  key: string,
  logger: Logger,
): Effect.Effect<T, unknown, unknown> =>
  Effect.gen(function*() {
    if (circuitBreaker.isOpen(key)) {
      logger.warn('Circuit breaker открыт, операция пропущена', { key });
      return yield* Effect.fail({
        _tag: 'SharedAdapterError',
        code: INFRA_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED,
        message: `Circuit breaker open: ${key}`,
      } as TaggedError);
    }
    return yield* effect;
  });

/** Обертка с timeout */
const withTimeout = <T>(
  effect: Effect.Effect<T, unknown, unknown>,
  timeoutMs?: CacheTimeoutMs,
): Effect.Effect<T, unknown, unknown> =>
  timeoutMs
    ? Effect.timeoutFail(effect, {
      duration: timeoutMs,
      onTimeout: () => ({
        _tag: 'SharedAdapterError',
        code: INFRA_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED,
        message: 'Cache operation timeout',
      }),
    })
    : effect;

/** Обертка с retry и стратегиями ошибок */
const withErrorStrategies = <T>(
  baseEffect: Effect.Effect<T, unknown, unknown>,
  operation: CacheOperation,
  key: CacheKey,
  logger: Logger,
  metrics: Metrics,
  circuitBreaker: CircuitBreaker,
  maxRetries: number,
  retryDelay: number,
): Effect.Effect<T, unknown, unknown> => {
  const retryable = Effect.catchAll(baseEffect, (error) =>
    Effect.gen(function*() {
      const taggedError = normalizeCacheError(error);

      const tagged = taggedError as TaggedError;
      let errorCode: LivAiErrorCode;

      if (isCacheError(tagged)) {
        errorCode = tagged.code as LivAiErrorCode;
      } else {
        switch (operation) {
          case 'GET':
            errorCode = INFRA_ERROR_CODES.INFRA_CACHE_GET_FAILED;
            break;
          case 'SET':
            errorCode = INFRA_ERROR_CODES.INFRA_CACHE_SET_FAILED;
            break;
          case 'DELETE':
            errorCode = INFRA_ERROR_CODES.INFRA_CACHE_DELETE_FAILED;
            break;
          default:
            errorCode = INFRA_ERROR_CODES.INFRA_CACHE_GET_FAILED; // fallback
        }
      }

      logger.info('Применение cache error strategies', {
        errorCode,
        operation,
        key,
      });

      const strategyResult = yield* resolveAndExecuteWithCircuitBreaker(
        errorCode,
        taggedError,
        [],
        { operation, key, taggedError, env: { logger, circuitBreaker } },
      ) as Effect.Effect<StrategyResult, unknown, never>;

      if (
        !strategyResult.success
        && (strategyResult as { success: false; shouldRetry: boolean; }).shouldRetry
      ) {
        circuitBreaker.recordFailure?.(key);
        logCacheRetry(logger, metrics, operation, key, taggedError);
      }

      return yield* Effect.fail(taggedError);
    }));

  if (maxRetries <= 0) {
    return retryable;
  }

  return Effect.retry(retryable, Schedule.spaced(retryDelay));
};

// ==================== ПУБЛИЧНЫЕ CACHE ЭФФЕКТЫ ====================

/** Получение значения из cache */
export function cacheGet<T = unknown>(
  key: CacheKey,
  cacheClient: CacheClient,
  clock: Clock,
  logger: Logger,
  metrics: Metrics,
  circuitBreaker: CircuitBreaker,
  maxRetries: CacheMaxRetries = cacheAdapterFactories.makeMaxRetries(
    CACHE_ADAPTER_DEFAULTS.MAX_RETRIES,
  ),
  retryDelay: CacheTimeoutMs = cacheAdapterFactories.makeTimeoutMs(
    CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS,
  ),
  timeoutMs?: CacheTimeoutMs,
): Effect.Effect<T | null, unknown, unknown> {
  const startedAt = clock.now(); // Время начала общей операции (включая повторы/обработку ошибок)
  const circuitKey = getCircuitBreakerKey(key, 'GET');

  const baseEffect = Effect.gen(function*() {
    const start = clock.now(); // Время начала одиночной cache операции
    const value = yield* Effect.tryPromise(() => cacheClient.get<T>(key));
    const durationMs = cacheAdapterFactories.makeDurationMs(clock.now() - start); // Длительность cache операции

    logCacheSuccess(logger, metrics, 'GET', key, durationMs);
    circuitBreaker.recordSuccess?.(circuitKey);

    return value;
  });

  return Effect.catchAll(
    withTimeout(
      withErrorStrategies(
        withCircuitBreaker(baseEffect, circuitBreaker, circuitKey, logger),
        'GET',
        key,
        logger,
        metrics,
        circuitBreaker,
        maxRetries,
        retryDelay,
      ),
      timeoutMs,
    ),
    (error) => {
      const totalDuration = cacheAdapterFactories.makeDurationMs(clock.now() - startedAt); // Длительность общей операции (включая повторы)
      logCacheError(logger, metrics, 'GET', key, totalDuration, error);
      return Effect.fail(error);
    },
  );
}

/** Запись значения в cache */
export function cacheSet<T = unknown>(
  key: CacheKey,
  value: T,
  ttlMs: CacheTtlMs | undefined,
  cacheClient: CacheClient,
  clock: Clock,
  logger: Logger,
  metrics: Metrics,
  circuitBreaker: CircuitBreaker,
  maxRetries: CacheMaxRetries = cacheAdapterFactories.makeMaxRetries(
    CACHE_ADAPTER_DEFAULTS.MAX_RETRIES,
  ),
  retryDelay: CacheTimeoutMs = cacheAdapterFactories.makeTimeoutMs(
    CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS,
  ),
  timeoutMs?: CacheTimeoutMs,
): Effect.Effect<void, unknown, unknown> {
  const startedAt = clock.now(); // Время начала общей операции (включая повторы/обработку ошибок)
  const circuitKey = getCircuitBreakerKey(key, 'SET');

  const baseEffect = Effect.gen(function*() {
    const start = clock.now(); // Время начала одиночной cache операции
    yield* Effect.tryPromise(() => cacheClient.set(key, value, ttlMs));
    const durationMs = cacheAdapterFactories.makeDurationMs(clock.now() - start); // Длительность cache операции

    logCacheSuccess(logger, metrics, 'SET', key, durationMs);
    circuitBreaker.recordSuccess?.(circuitKey);
  });

  return Effect.catchAll(
    withTimeout(
      withErrorStrategies(
        withCircuitBreaker(baseEffect, circuitBreaker, circuitKey, logger),
        'SET',
        key,
        logger,
        metrics,
        circuitBreaker,
        maxRetries,
        retryDelay,
      ),
      timeoutMs,
    ),
    (error) => {
      const totalDuration = cacheAdapterFactories.makeDurationMs(clock.now() - startedAt); // Длительность общей операции (включая повторы)
      logCacheError(logger, metrics, 'SET', key, totalDuration, error);
      return Effect.fail(error);
    },
  );
}

/** Удаление значения из cache */
export function cacheDelete(
  key: CacheKey,
  cacheClient: CacheClient,
  clock: Clock,
  logger: Logger,
  metrics: Metrics,
  circuitBreaker: CircuitBreaker,
  maxRetries: CacheMaxRetries = cacheAdapterFactories.makeMaxRetries(
    CACHE_ADAPTER_DEFAULTS.MAX_RETRIES,
  ),
  retryDelay: CacheTimeoutMs = cacheAdapterFactories.makeTimeoutMs(
    CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS,
  ),
  timeoutMs?: CacheTimeoutMs,
): Effect.Effect<void, unknown, unknown> {
  const startedAt = clock.now(); // Время начала общей операции (включая повторы/обработку ошибок)
  const circuitKey = getCircuitBreakerKey(key, 'DELETE');

  const baseEffect = Effect.gen(function*() {
    const start = clock.now(); // Время начала одиночной cache операции
    yield* Effect.tryPromise(() => cacheClient.delete(key));
    const durationMs = cacheAdapterFactories.makeDurationMs(clock.now() - start); // Длительность cache операции

    logCacheSuccess(logger, metrics, 'DELETE', key, durationMs);
    circuitBreaker.recordSuccess?.(circuitKey);
  });

  return Effect.catchAll(
    withTimeout(
      withErrorStrategies(
        withCircuitBreaker(baseEffect, circuitBreaker, circuitKey, logger),
        'DELETE',
        key,
        logger,
        metrics,
        circuitBreaker,
        maxRetries,
        retryDelay,
      ),
      timeoutMs,
    ),
    (error) => {
      const totalDuration = cacheAdapterFactories.makeDurationMs(clock.now() - startedAt); // Длительность общей операции (включая повторы)
      logCacheError(logger, metrics, 'DELETE', key, totalDuration, error);
      return Effect.fail(error);
    },
  );
}
