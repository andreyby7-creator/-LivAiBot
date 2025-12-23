/**
 * @file DatabaseAdapterConfig.ts - Конфигурация Database адаптера LivAiBot
 *
 * Конфигурация с валидацией, defaults и typed constants.
 * Connection pooling, retry policies, circuit breaker, timeout handling для production reliability.
 */

import { databaseAdapterFactories } from './DatabaseAdapterFactories.js';

import type {
  DatabaseAdapterContext,
  DatabaseAdapterOptions,
  DatabaseId,
  DbCircuitBreakerKey,
  DbCircuitBreakerThreshold,
  DbMaxRetries,
  DbTimeoutMs,
  TransactionIsolationLevel,
} from './DatabaseAdapterTypes.js';

/** Дефолтные значения конфигурации */
// PostgreSQL error codes constants
const POSTGRES_ERROR_CODES = {
  UNIQUE_VIOLATION: 23505,
  SERIALIZATION_FAILURE: 40001,
  DEADLOCK_DETECTED: 40,
  TOO_MANY_CONNECTIONS: 53300,
  ADMIN_SHUTDOWN: 57,
} as const;

export const DATABASE_ADAPTER_DEFAULTS = {
  /** Timeout для DB операций по умолчанию - 30 секунд */
  TIMEOUT_MS: 30000,
  /** Максимальное количество повторов */
  MAX_RETRIES: 3,
  /** Задержка между повторами - 1 секунда */
  RETRY_DELAY_MS: 1000,
  /** Порог circuit breaker - 10 ошибок */
  CIRCUIT_BREAKER_THRESHOLD: 10,
  /** Время восстановления circuit breaker - 60 секунд */
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: 60000,
  /** Максимальный размер connection pool - 20 */
  MAX_CONNECTION_POOL_SIZE: 20,
  /** Минимальный размер connection pool - 2 */
  MIN_CONNECTION_POOL_SIZE: 2,
  /** Connection timeout - 10 секунд */
  CONNECTION_TIMEOUT_MS: 10000,
  /** Максимальное время жизни соединения в пуле - 4 минуты */
  CONNECTION_MAX_LIFETIME_MS: 240000,
  /** Время простоя соединения перед закрытием - 2 минуты */
  CONNECTION_IDLE_TIMEOUT_MS: 120000,
  /** Максимальный timeout - 5 минут */
  MAX_TIMEOUT_MS: 300000,
  /** Минимальный timeout - 100ms */
  MIN_TIMEOUT_MS: 100,
  /** Уровень изоляции транзакций по умолчанию */
  DEFAULT_ISOLATION_LEVEL: 'READ_COMMITTED' as TransactionIsolationLevel,
} as const;

/** Типы DB операций для retry логики */
export const DB_OPERATION_TYPES = {
  /** SELECT операции */
  SELECT: 'SELECT',
  /** INSERT операции */
  INSERT: 'INSERT',
  /** UPDATE операции */
  UPDATE: 'UPDATE',
  /** DELETE операции */
  DELETE: 'DELETE',
  /** DDL операции */
  DDL: 'DDL',
  /** Транзакционные операции */
  TRANSACTION: 'TRANSACTION',
} as const;

/** Валидные диапазоны значений */
export const DATABASE_ADAPTER_RANGES = {
  TIMEOUT: {
    MIN: DATABASE_ADAPTER_DEFAULTS.MIN_TIMEOUT_MS,
    MAX: DATABASE_ADAPTER_DEFAULTS.MAX_TIMEOUT_MS,
  },
  RETRIES: {
    MIN: 0,
    MAX: 10,
  },
  RETRY_DELAY: {
    MIN: 100,
    MAX: 30000,
  },
  CIRCUIT_BREAKER_THRESHOLD: {
    MIN: 1,
    MAX: 100,
  },
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT: {
    MIN: 1000,
    MAX: 300000,
  },
  CONNECTION_POOL_SIZE: {
    MIN: 1,
    MAX: 100,
  },
  CONNECTION_TIMEOUT: {
    MIN: 1000,
    MAX: 120000,
  },
  CONNECTION_LIFETIME: {
    MIN: 60000,
    MAX: 3600000,
  },
  CONNECTION_IDLE_TIMEOUT: {
    MIN: 10000,
    MAX: 1800000,
  },
} as const;

/** Конфигурация Database адаптера */
export type DatabaseAdapterConfig = {
  /** Идентификатор базы данных */
  readonly databaseId: DatabaseId;
  /** Timeout для DB операций */
  readonly timeout: DbTimeoutMs;
  /** Максимальное количество повторов */
  readonly maxRetries: DbMaxRetries;
  /** Задержка между повторами */
  readonly retryDelay: DbTimeoutMs;
  /** Порог circuit breaker (количество ошибок для открытия) */
  readonly circuitBreakerThreshold: DbCircuitBreakerThreshold;
  /** Время восстановления circuit breaker */
  readonly circuitBreakerRecoveryTimeout: DbTimeoutMs;
  /** Включен ли circuit breaker */
  readonly circuitBreakerEnabled: boolean;
  /** Включены ли повторы */
  readonly retriesEnabled: boolean;
  /** Максимальный размер connection pool */
  readonly maxConnectionPoolSize: number;
  /** Минимальный размер connection pool */
  readonly minConnectionPoolSize: number;
  /** Timeout для установления соединения */
  readonly connectionTimeout: DbTimeoutMs;
  /** Максимальное время жизни соединения в пуле */
  readonly connectionMaxLifetime: DbTimeoutMs;
  /** Время простоя соединения перед закрытием */
  readonly connectionIdleTimeout: DbTimeoutMs;
  /** Уровень изоляции транзакций по умолчанию */
  readonly defaultIsolationLevel: TransactionIsolationLevel;
  /** Включено ли логирование SQL запросов */
  readonly sqlLoggingEnabled: boolean;
  /** Включены ли метрики */
  readonly metricsEnabled: boolean;
};

/**
 * Создает дефолтную конфигурацию Database адаптера
 *
 * Все значения предварительно валидированы через фабрики
 * и содержат безопасные значения по умолчанию для production.
 *
 * @returns Конфигурация с дефолтными валидированными значениями
 */
export function createDefaultConfig(databaseId?: DatabaseId): DatabaseAdapterConfig {
  return {
    databaseId: databaseId ?? databaseAdapterFactories.makeDatabaseId('default-db'),
    timeout: databaseAdapterFactories.makeTimeoutMs(DATABASE_ADAPTER_DEFAULTS.TIMEOUT_MS),
    maxRetries: databaseAdapterFactories.makeMaxRetries(DATABASE_ADAPTER_DEFAULTS.MAX_RETRIES),
    retryDelay: databaseAdapterFactories.makeTimeoutMs(DATABASE_ADAPTER_DEFAULTS.RETRY_DELAY_MS),
    circuitBreakerThreshold: databaseAdapterFactories.makeCircuitBreakerThreshold(
      DATABASE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_THRESHOLD,
    ),
    circuitBreakerRecoveryTimeout: databaseAdapterFactories.makeTimeoutMs(
      DATABASE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
    ),
    circuitBreakerEnabled: true,
    retriesEnabled: true,
    maxConnectionPoolSize: DATABASE_ADAPTER_DEFAULTS.MAX_CONNECTION_POOL_SIZE,
    minConnectionPoolSize: DATABASE_ADAPTER_DEFAULTS.MIN_CONNECTION_POOL_SIZE,
    connectionTimeout: databaseAdapterFactories.makeTimeoutMs(
      DATABASE_ADAPTER_DEFAULTS.CONNECTION_TIMEOUT_MS,
    ),
    connectionMaxLifetime: databaseAdapterFactories.makeTimeoutMs(
      DATABASE_ADAPTER_DEFAULTS.CONNECTION_MAX_LIFETIME_MS,
    ),
    connectionIdleTimeout: databaseAdapterFactories.makeTimeoutMs(
      DATABASE_ADAPTER_DEFAULTS.CONNECTION_IDLE_TIMEOUT_MS,
    ),
    defaultIsolationLevel: DATABASE_ADAPTER_DEFAULTS.DEFAULT_ISOLATION_LEVEL,
    sqlLoggingEnabled: false,
    metricsEnabled: true,
  };
}

/**
 * Создает конфигурацию Database адаптера с кастомными настройками
 *
 * Все значения валидируются и применяются поверх дефолтных.
 * Невалидные значения вызывают исключения.
 *
 * @param overrides - Частичные настройки для переопределения
 * @returns Полная конфигурация с валидированными значениями
 * @throws {DatabaseAdapterValidationError} при некорректных значениях в overrides
 */
export function createConfig(
  overrides: Partial<DatabaseAdapterOptions> = {},
): DatabaseAdapterConfig {
  const defaults = createDefaultConfig(overrides.databaseId);

  // Валидация числовых значений без branded types
  if (overrides.maxConnectionPoolSize !== undefined) {
    if (
      typeof overrides.maxConnectionPoolSize !== 'number'
      || overrides.maxConnectionPoolSize < DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MIN
      || overrides.maxConnectionPoolSize > DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MAX
      || !Number.isInteger(overrides.maxConnectionPoolSize)
    ) {
      throw new databaseAdapterFactories.ValidationError(
        `maxConnectionPoolSize must be an integer between ${DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MIN} and ${DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MAX}`,
        'createConfig',
        overrides.maxConnectionPoolSize,
      );
    }
  }

  if (overrides.minConnectionPoolSize !== undefined) {
    if (
      typeof overrides.minConnectionPoolSize !== 'number'
      || overrides.minConnectionPoolSize < DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MIN
      || overrides.minConnectionPoolSize > DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MAX
      || !Number.isInteger(overrides.minConnectionPoolSize)
    ) {
      throw new databaseAdapterFactories.ValidationError(
        `minConnectionPoolSize must be an integer between ${DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MIN} and ${DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MAX}`,
        'createConfig',
        overrides.minConnectionPoolSize,
      );
    }
  }

  // Проверка что minConnectionPoolSize <= maxConnectionPoolSize
  const finalMinPoolSize = overrides.minConnectionPoolSize ?? defaults.minConnectionPoolSize;
  const finalMaxPoolSize = overrides.maxConnectionPoolSize ?? defaults.maxConnectionPoolSize;

  if (finalMinPoolSize > finalMaxPoolSize) {
    throw new databaseAdapterFactories.ValidationError(
      'minConnectionPoolSize cannot be greater than maxConnectionPoolSize',
      'createConfig',
      { minConnectionPoolSize: finalMinPoolSize, maxConnectionPoolSize: finalMaxPoolSize },
    );
  }

  return {
    databaseId: overrides.databaseId ?? defaults.databaseId,
    timeout: overrides.timeoutMs !== undefined
      ? databaseAdapterFactories.makeTimeoutMs(overrides.timeoutMs)
      : defaults.timeout,
    maxRetries: overrides.maxRetries !== undefined
      ? databaseAdapterFactories.makeMaxRetries(overrides.maxRetries)
      : defaults.maxRetries,
    retryDelay: overrides.retryDelayMs !== undefined
      ? databaseAdapterFactories.makeTimeoutMs(overrides.retryDelayMs)
      : defaults.retryDelay,
    circuitBreakerThreshold: overrides.circuitBreakerThreshold !== undefined
      ? databaseAdapterFactories.makeCircuitBreakerThreshold(overrides.circuitBreakerThreshold)
      : defaults.circuitBreakerThreshold,
    circuitBreakerRecoveryTimeout: overrides.circuitBreakerRecoveryMs !== undefined
      ? databaseAdapterFactories.makeTimeoutMs(overrides.circuitBreakerRecoveryMs)
      : defaults.circuitBreakerRecoveryTimeout,
    circuitBreakerEnabled: overrides.circuitBreakerEnabled ?? defaults.circuitBreakerEnabled,
    retriesEnabled: overrides.retriesEnabled ?? defaults.retriesEnabled,
    maxConnectionPoolSize: overrides.maxConnectionPoolSize ?? defaults.maxConnectionPoolSize,
    minConnectionPoolSize: overrides.minConnectionPoolSize ?? defaults.minConnectionPoolSize,
    connectionTimeout: overrides.connectionTimeoutMs !== undefined
      ? databaseAdapterFactories.makeTimeoutMs(overrides.connectionTimeoutMs)
      : defaults.connectionTimeout,
    connectionMaxLifetime: overrides.connectionMaxLifetimeMs !== undefined
      ? databaseAdapterFactories.makeTimeoutMs(overrides.connectionMaxLifetimeMs)
      : defaults.connectionMaxLifetime,
    connectionIdleTimeout: overrides.connectionIdleTimeoutMs !== undefined
      ? databaseAdapterFactories.makeTimeoutMs(overrides.connectionIdleTimeoutMs)
      : defaults.connectionIdleTimeout,
    defaultIsolationLevel: overrides.defaultIsolationLevel ?? defaults.defaultIsolationLevel,
    sqlLoggingEnabled: overrides.sqlLoggingEnabled ?? defaults.sqlLoggingEnabled,
    metricsEnabled: overrides.metricsEnabled ?? defaults.metricsEnabled,
  };
}

/**
 * Создает контекст Database адаптера для DI
 *
 * @param databaseId - Идентификатор базы данных
 * @param overrides - Дополнительные настройки контекста
 * @returns DatabaseAdapterContext
 */
export function createDatabaseAdapterContext(
  databaseId: string,
  overrides: {
    defaultTimeoutMs?: DbTimeoutMs;
    maxRetries?: DbMaxRetries;
  } = {},
): DatabaseAdapterContext {
  return {
    databaseId: databaseAdapterFactories.makeDatabaseId(databaseId),
    ...(overrides.defaultTimeoutMs !== undefined
      && { defaultTimeoutMs: overrides.defaultTimeoutMs }),
    ...(overrides.maxRetries !== undefined && { maxRetries: overrides.maxRetries }),
  };
}

/**
 * Получает ключ для circuit breaker на основе database ID и операции
 *
 * @param databaseId - Идентификатор базы данных
 * @param operationType - Тип операции (SELECT, INSERT, etc.)
 * @returns Ключ для circuit breaker
 */
export function getCircuitBreakerKey(
  databaseId: string,
  operationType: string,
): DbCircuitBreakerKey {
  const validatedId = databaseAdapterFactories.makeDatabaseId(databaseId);
  return databaseAdapterFactories.makeDbCircuitBreakerKey(`${validatedId}:${operationType}`);
}

/**
 * Проверяет, является ли ошибка подходящей для повтора
 *
 * @param error - Ошибка для проверки
 * @returns true если ошибка retryable
 */
export function isRetryableDbError(error: unknown): boolean {
  // Database connection errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('connection')
      || message.includes('timeout')
      || message.includes('econnreset')
      || message.includes('enotfound')
      || message.includes('deadlock')
      || message.includes('serialization')
      || message.includes('temporary')
      || message.includes('unavailable');
  }

  // Коды ошибок специфичные для базы данных, которые можно повторить
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    const errorCode = errorObj['code'] as string | number | undefined;

    if (typeof errorCode === 'string') {
      const code = errorCode.toLowerCase();
      return code.includes('connection')
        || code.includes('timeout')
        || code.includes('deadlock')
        || code.includes('serialization')
        || code.includes('temporary')
        || code.includes('unavailable');
    }

    if (typeof errorCode === 'number') {
      // Общие повторяемые коды ошибок PostgreSQL
      const retryableCodes = [
        POSTGRES_ERROR_CODES.UNIQUE_VIOLATION,
        POSTGRES_ERROR_CODES.SERIALIZATION_FAILURE,
        POSTGRES_ERROR_CODES.DEADLOCK_DETECTED,
        POSTGRES_ERROR_CODES.TOO_MANY_CONNECTIONS,
        POSTGRES_ERROR_CODES.ADMIN_SHUTDOWN,
      ];
      return retryableCodes.includes(errorCode as typeof retryableCodes[number]);
    }
  }

  return false;
}
