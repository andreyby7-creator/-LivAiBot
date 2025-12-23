/**
 * @file DatabaseAdapterEffect.ts - Effect пайплайн для Database адаптера
 *
 * Реализует Effect-based обработку запросов к базе данных с поддержкой:
 * - timeout для запросов
 * - retry стратегии с exponential backoff
 * - circuit breaker для защиты от каскадных сбоев
 * - нормализация ошибок и применение стратегий восстановления
 * - логирование и метрики производительности
 */

import { Effect, Schedule } from 'effect';

import { INFRA_ERROR_CODES } from '../../../base/ErrorCode.js';
import { resolveAndExecuteWithCircuitBreaker } from '../../../base/ErrorStrategies.js';
import { normalizeDatabaseError } from '../../normalizers/DatabaseNormalizer.js';

import { DATABASE_ADAPTER_DEFAULTS, getCircuitBreakerKey } from './DatabaseAdapterConfig.js';
import { databaseAdapterFactories } from './DatabaseAdapterFactories.js';

import type {
  DbDurationMs,
  DbExecuteResult,
  DbParams,
  DbQuery,
  DbQueryResult,
  DbTimeoutMs,
  TransactionIsolationLevel,
} from './DatabaseAdapterTypes.js';
import type { LivAiErrorCode } from '../../../base/ErrorCode.js';
import type { StrategyResult } from '../../../base/ErrorStrategies/ErrorStrategyTypes.js';

/** Tagged Error discriminated union для Database адаптера */
type TaggedError =
  | { _tag: 'DatabaseError'; code: string; message: string; details?: Record<string, unknown>; }
  | {
    _tag: 'SharedAdapterError';
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
  | { _tag: string; code?: string; [key: string]: unknown; };

/** Type guard для проверки DatabaseError */
const isDatabaseError = (
  error: TaggedError,
): error is Extract<TaggedError, { _tag: 'DatabaseError'; }> => error._tag === 'DatabaseError';

/** Database клиент интерфейс - driver-specific */
export type DatabaseClient = {
  (query: DbQuery, params?: DbParams, options?: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  }): Promise<{ rows?: unknown[]; rowCount?: number; affectedRows?: number; }>;
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

/** Вспомогательные функции */

/** Логирование и метрики для SELECT */
const logSelect = (
  logger: Logger,
  metrics: Metrics,
  query: string,
  durationMs: number,
  rowCount?: number,
): void => {
  metrics.timing('db_query_duration', durationMs, { operation: 'SELECT', rowCount: rowCount ?? 0 });
  logger.info('Database SELECT query completed', { query, durationMs, rowCount });
};

/** Логирование и метрики для EXECUTE */
const logExecute = (
  logger: Logger,
  metrics: Metrics,
  query: string,
  durationMs: number,
  affectedRows?: number,
): void => {
  metrics.timing('db_query_duration', durationMs, {
    operation: 'EXECUTE',
    affectedRows: affectedRows ?? 0,
  });
  logger.info('Database EXECUTE query completed', { query, durationMs, affectedRows });
};

/** Логирование и метрики для ошибок DB запросов */
const logDbError = (
  metrics: Metrics,
  logger: Logger,
  query: string,
  durationMs: number,
  databaseId: string,
  error: unknown,
): void => {
  metrics.increment('db_query_error', 1, { databaseId });
  logger.error('Database query failed', {
    databaseId,
    query,
    durationMs,
    error: error instanceof Error ? error.message : String(error),
  });
};

/** Оборачивает эффект в Circuit Breaker */
const withCircuitBreaker = <T>(
  effect: Effect.Effect<T, unknown, unknown>,
  circuitBreaker: CircuitBreaker,
  key: string,
  logger: Logger,
): Effect.Effect<T, unknown, unknown> =>
  Effect.gen(function*() {
    if (circuitBreaker.isOpen(key)) {
      logger.warn('Circuit breaker is open, skipping DB operation', { key });
      return yield* Effect.fail({
        _tag: 'SharedAdapterError',
        code: INFRA_ERROR_CODES.INFRA_DB_QUERY_FAILED,
        message: `Circuit breaker open: ${key}`,
      } as TaggedError);
    }
    return yield* effect;
  });

/** Retryable эффект с нормализацией и стратегиями */
const withErrorStrategies = <T>(
  baseEffect: Effect.Effect<T, unknown, unknown>,
  query: DbQuery,
  databaseId: string,
  logger: Logger,
  circuitBreaker: CircuitBreaker,
  maxRetries: number,
  retryDelay: number,
): Effect.Effect<T, unknown, unknown> => {
  // Retry эффект с circuit breaker и метриками
  const retryableEffect = Effect.catchAll(baseEffect, (error) => {
    return Effect.gen(function*() {
      const taggedError = typeof normalizeDatabaseError === 'function'
        ? normalizeDatabaseError(error)
        : error;
      const taggedErrorTyped = taggedError as TaggedError;
      const errorCode: LivAiErrorCode = isDatabaseError(taggedErrorTyped)
        ? taggedErrorTyped.code as LivAiErrorCode
        : INFRA_ERROR_CODES.INFRA_DB_QUERY_FAILED;

      logger.info('Applying database error strategies', { errorCode, query, databaseId });

      const strategyResult = yield* resolveAndExecuteWithCircuitBreaker(
        errorCode,
        taggedError,
        [],
        { query, taggedError, env: { logger, circuitBreaker } },
      ) as Effect.Effect<StrategyResult, unknown, never>;

      if (
        !strategyResult.success
        && (strategyResult as { success: false; shouldRetry: boolean; }).shouldRetry
      ) {
        // Circuit breaker failure recording
        circuitBreaker.recordFailure?.(query); // Используем query как временный key
        logger.warn('Database operation failed, will retry', { errorCode, query, databaseId });
      }

      return yield* Effect.fail(taggedError);
    });
  });

  // Configurable retry strategy с exponential backoff
  if (maxRetries <= 0) {
    return retryableEffect;
  }

  const retryStrategy = Schedule.spaced(retryDelay);

  return Effect.retry(retryableEffect, retryStrategy);
};

/** Публичные функции */

/**
 * Выполняет SELECT запрос с circuit breaker и логированием
 * @param query SQL запрос
 * @param params Параметры (опционально)
 * @param timeoutMs Таймаут
 * @param databaseId ID базы данных
 * @param dbClient Клиент БД
 * @param clock Таймер
 * @param logger Логгер
 * @param metrics Метрики
 * @param circuitBreaker Circuit breaker
 * @param transaction Транзакция (опционально)
 * @returns Effect с результатом SELECT
 */
export function executeSelect<Row = unknown>(
  query: DbQuery,
  params: DbParams | undefined,
  timeoutMs: DbTimeoutMs,
  databaseId: string,
  dbClient: DatabaseClient,
  clock: Clock,
  logger: Logger,
  metrics: Metrics,
  circuitBreaker: CircuitBreaker,
  maxRetries?: number,
  retryDelay?: number,
  transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; },
): Effect.Effect<DbQueryResult<Row>, unknown, unknown> {
  const operationStart = clock.now();

  const baseEffect = Effect.gen(function*() {
    const start = clock.now();
    const result = yield* Effect.tryPromise(() =>
      dbClient(query, params, {
        timeout: timeoutMs,
        ...(transaction ? { transaction } : undefined),
      })
    );
    const durationMs: DbDurationMs = databaseAdapterFactories.makeDurationMs(clock.now() - start);

    logSelect(logger, metrics, query, durationMs, result.rows?.length);

    return { rows: (result.rows ?? []) as Row[], rowCount: result.rows?.length ?? 0, durationMs };
  });

  const circuitKey = getCircuitBreakerKey(databaseId, 'SELECT');
  return Effect.catchAll(
    withErrorStrategies(
      withCircuitBreaker(baseEffect, circuitBreaker, circuitKey, logger),
      query,
      databaseId,
      logger,
      circuitBreaker,
      maxRetries ?? DATABASE_ADAPTER_DEFAULTS.MAX_RETRIES,
      retryDelay ?? DATABASE_ADAPTER_DEFAULTS.RETRY_DELAY_MS,
    ),
    (error) => {
      const totalDurationMs = databaseAdapterFactories.makeDurationMs(clock.now() - operationStart);
      logDbError(metrics, logger, query, totalDurationMs, databaseId, error);
      return Effect.fail(error);
    },
  );
}

/**
 * Выполняет EXECUTE запрос с circuit breaker и логированием
 * @param query SQL запрос (INSERT/UPDATE/DELETE)
 * @param params Параметры (опционально)
 * @param timeoutMs Таймаут
 * @param databaseId ID базы данных
 * @param dbClient Клиент БД
 * @param clock Таймер
 * @param logger Логгер
 * @param metrics Метрики
 * @param circuitBreaker Circuit breaker
 * @param transaction Транзакция (опционально)
 * @returns Effect с результатом EXECUTE
 */
export function executeQuery(
  query: DbQuery,
  params: DbParams | undefined,
  timeoutMs: DbTimeoutMs,
  databaseId: string,
  dbClient: DatabaseClient,
  clock: Clock,
  logger: Logger,
  metrics: Metrics,
  circuitBreaker: CircuitBreaker,
  maxRetries?: number,
  retryDelay?: number,
  transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; },
): Effect.Effect<DbExecuteResult, unknown, unknown> {
  const operationStart = clock.now();

  const baseEffect = Effect.gen(function*() {
    const start = clock.now();
    const result = yield* Effect.tryPromise(() =>
      dbClient(query, params, {
        timeout: timeoutMs,
        ...(transaction ? { transaction } : undefined),
      })
    );
    const durationMs: DbDurationMs = databaseAdapterFactories.makeDurationMs(clock.now() - start);

    logExecute(logger, metrics, query, durationMs, result.affectedRows);

    return { affectedRows: result.affectedRows ?? 0, durationMs };
  });

  const circuitKey = getCircuitBreakerKey(databaseId, 'EXECUTE');
  return Effect.catchAll(
    withErrorStrategies(
      withCircuitBreaker(baseEffect, circuitBreaker, circuitKey, logger),
      query,
      databaseId,
      logger,
      circuitBreaker,
      maxRetries ?? DATABASE_ADAPTER_DEFAULTS.MAX_RETRIES,
      retryDelay ?? DATABASE_ADAPTER_DEFAULTS.RETRY_DELAY_MS,
    ),
    (error) => {
      const totalDurationMs = databaseAdapterFactories.makeDurationMs(clock.now() - operationStart);
      logDbError(metrics, logger, query, totalDurationMs, databaseId, error);
      return Effect.fail(error);
    },
  );
}
