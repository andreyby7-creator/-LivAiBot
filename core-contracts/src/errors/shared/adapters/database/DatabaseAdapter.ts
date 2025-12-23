/**
 * @file DatabaseAdapter.ts - Database адаптер LivAiBot
 *
 * Boundary + side-effects компонент. НЕ нормализует ошибки, НЕ решает стратегии, НЕ содержит бизнес-логику.
 * ДЕЛАЕТ DB I/O, retry/timeout/circuit breaker, unknown → BaseError, применение стратегий.
 * Только Effect. Никаких throw.
 */

import type { Effect } from 'effect';

import { createConfig } from './DatabaseAdapterConfig.js';
import { executeQuery, executeSelect } from './DatabaseAdapterEffect.js';
import { databaseAdapterFactories } from './DatabaseAdapterFactories.js';

import type { DatabaseAdapterConfig } from './DatabaseAdapterConfig.js';
import type {
  CircuitBreaker,
  Clock,
  DatabaseClient,
  Logger,
  Metrics,
} from './DatabaseAdapterEffect.js';
import type {
  DbExecuteResult,
  DbParams,
  DbQuery,
  DbQueryResult,
  DbTimeoutMs,
  TransactionIsolationLevel,
} from './DatabaseAdapterTypes.js';

// Clock, Logger, Metrics, CircuitBreaker типы определены в DatabaseAdapterEffect.ts

/** Database Adapter интерфейс */
export type DatabaseAdapter = {
  /**
   * Выполняет SELECT запрос
   * @param query SQL запрос
   * @param params Параметры запроса
   * @param dbClient Database клиент
   * @param clock Clock сервис
   * @param logger Logger сервис
   * @param metrics Metrics сервис
   * @param circuitBreaker CircuitBreaker сервис
   * @param options Дополнительные опции
   * @returns Effect с результатом или ошибкой
   */
  select<Row = unknown>(
    query: DbQuery,
    params: DbParams | undefined,
    dbClient: DatabaseClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
    options?: {
      timeout?: DbTimeoutMs;
      transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
    },
  ): Effect.Effect<DbQueryResult<Row>, unknown, unknown>;

  /**
   * Выполняет EXECUTE запрос (INSERT/UPDATE/DELETE)
   * @param query SQL запрос
   * @param params Параметры запроса
   * @param dbClient Database клиент
   * @param clock Clock сервис
   * @param logger Logger сервис
   * @param metrics Metrics сервис
   * @param circuitBreaker CircuitBreaker сервис
   * @param options Дополнительные опции
   * @returns Effect с результатом или ошибкой
   */
  execute(
    query: DbQuery,
    params: DbParams | undefined,
    dbClient: DatabaseClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
    options?: {
      timeout?: DbTimeoutMs;
      transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
    },
  ): Effect.Effect<DbExecuteResult, unknown, unknown>;
};

/** Реализация Database Adapter */
export class DatabaseAdapterImpl implements DatabaseAdapter {
  private readonly config: DatabaseAdapterConfig;

  constructor(config: Partial<DatabaseAdapterConfig> = {}) {
    this.config = createConfig(config);
  }

  select<Row = unknown>(
    query: DbQuery,
    params: DbParams | undefined,
    dbClient: DatabaseClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
    options?: {
      timeout?: DbTimeoutMs;
      transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
    },
  ): Effect.Effect<DbQueryResult<Row>, unknown, unknown> {
    // Передаем все сервисы явно через DI
    const effectiveTimeout = options?.timeout ?? this.config.timeout;
    return executeSelect(
      query,
      params,
      databaseAdapterFactories.makeTimeoutMs(effectiveTimeout),
      this.config.databaseId,
      dbClient,
      clock,
      logger,
      metrics,
      circuitBreaker,
      this.config.maxRetries,
      this.config.retryDelay,
      options?.transaction,
    ) as Effect.Effect<DbQueryResult<Row>, unknown, unknown>;
  }

  execute(
    query: DbQuery,
    params: DbParams | undefined,
    dbClient: DatabaseClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
    options?: {
      timeout?: DbTimeoutMs;
      transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
    },
  ): Effect.Effect<DbExecuteResult, unknown, unknown> {
    // Передаем все сервисы явно через DI
    const effectiveTimeout = options?.timeout ?? this.config.timeout;
    return executeQuery(
      query,
      params,
      databaseAdapterFactories.makeTimeoutMs(effectiveTimeout),
      this.config.databaseId,
      dbClient,
      clock,
      logger,
      metrics,
      circuitBreaker,
      this.config.maxRetries,
      this.config.retryDelay,
      options?.transaction,
    );
  }
}

/** Создает Database Adapter с дефолтной конфигурацией */
export function createDatabaseAdapter(): DatabaseAdapter {
  return new DatabaseAdapterImpl();
}

/** Создает Database Adapter с кастомной конфигурацией */
export function createDatabaseAdapterWithConfig(
  config: Partial<DatabaseAdapterConfig>,
): DatabaseAdapter {
  return new DatabaseAdapterImpl(config);
}

/**
 * Утилита для создания SELECT запроса
 *
 * @param query - SQL SELECT запрос
 * @param params - Параметры запроса
 * @param options - Опции запроса
 * @returns Объект с запросом и параметрами
 */
export function createSelectQuery(
  query: string,
  params?: DbParams,
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  } = {},
): {
  query: DbQuery;
  params?: DbParams | undefined;
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  };
} {
  return {
    query: databaseAdapterFactories.makeDbQuery(query),
    params,
    options,
  };
}

/**
 * Утилита для создания INSERT запроса
 *
 * @param query - SQL INSERT запрос
 * @param params - Параметры запроса
 * @param options - Опции запроса
 * @returns Объект с запросом и параметрами
 */
export function createInsertQuery(
  query: string,
  params?: DbParams,
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  } = {},
): {
  query: DbQuery;
  params?: DbParams | undefined;
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  };
} {
  return {
    query: databaseAdapterFactories.makeDbQuery(query),
    params,
    options,
  };
}

/**
 * Утилита для создания UPDATE запроса
 *
 * @param query - SQL UPDATE запрос
 * @param params - Параметры запроса
 * @param options - Опции запроса
 * @returns Объект с запросом и параметрами
 */
export function createUpdateQuery(
  query: string,
  params?: DbParams,
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  } = {},
): {
  query: DbQuery;
  params?: DbParams | undefined;
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  };
} {
  return {
    query: databaseAdapterFactories.makeDbQuery(query),
    params,
    options,
  };
}

/**
 * Утилита для создания DELETE запроса
 *
 * @param query - SQL DELETE запрос
 * @param params - Параметры запроса
 * @param options - Опции запроса
 * @returns Объект с запросом и параметрами
 */
export function createDeleteQuery(
  query: string,
  params?: DbParams,
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  } = {},
): {
  query: DbQuery;
  params?: DbParams | undefined;
  options: {
    timeout?: DbTimeoutMs;
    transaction?: { id: string; isolationLevel?: TransactionIsolationLevel; };
  };
} {
  return {
    query: databaseAdapterFactories.makeDbQuery(query),
    params,
    options,
  };
}
