/**
 * @file DatabaseAdapterTypes.ts
 * Типы транспортного уровня для Database-адаптера.
 *
 * ❗ Не содержит бизнес-логики
 * ❗ Не содержит side-effects
 * ❗ Не зависит от Effect / FP
 *
 * Предназначен для строгого, безопасного и расширяемого database boundary
 * (SQL / NoSQL / ORM / raw driver — не важно).
 */

import type { LivAiErrorCode } from '../../../base/ErrorCode.js';

/**
 * @future
 * Возможные расширения (НЕ требуется сейчас):
 *
 * 1) DbError._tag: 'DbSerializationError'
 *    — для поддержки optimistic locking / serialization failures
 *
 * 2) DbQuery → union:
 *    type DbQuery = SqlQuery | MongoQuery
 *    — если потребуется единый adapter для SQL + NoSQL
 */

// ==================== БАЗОВЫЕ ДОМЕННЫЕ ПРИМИТИВЫ ====================

/**
 * Идентификатор базы данных / datasource
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDatabaseId} в DatabaseAdapterFactories.ts
 * @throws Error при пустой строке или не-string значении
 */
export type DatabaseId = string & { readonly __brand: 'DatabaseId'; };

/**
 * SQL / DB запрос в текстовом виде
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDbQuery} в DatabaseAdapterFactories.ts
 * @throws Error при пустом запросе или не-string значении
 */
export type DbQuery = string & { readonly __brand: 'DbQuery'; };

/**
 * Параметры запроса (позиционные или именованные)
 *
 * ❗ Значения intentionally unknown — валидация на уровне драйвера
 */
export type DbParams =
  | readonly unknown[]
  | Readonly<Record<string, unknown>>;

/**
 * Таймаут операции БД в миллисекундах
 *
 * @boundary-validation Гарантируется фабрикой {@link makeTimeoutMs} в DatabaseAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 */
export type DbTimeoutMs = number & { readonly __brand: 'DbTimeoutMs'; };

/**
 * Длительность выполнения DB операции
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDurationMs} в DatabaseAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 */
export type DbDurationMs = number & { readonly __brand: 'DbDurationMs'; };

/**
 * Максимальное количество retry для DB операций
 *
 * @boundary-validation Гарантируется фабрикой {@link makeMaxRetries} в DatabaseAdapterFactories.ts
 * @throws Error при значениях вне диапазона 0–10 или нецелых числах
 */
export type DbMaxRetries = number & { readonly __brand: 'DbMaxRetries'; };

// ==================== CONNECTION / TRANSACTION ====================

/**
 * Идентификатор соединения с БД
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDbConnectionId}
 * @throws Error при пустом значении
 */
export type DbConnectionId = string & { readonly __brand: 'DbConnectionId'; };

/**
 * Идентификатор транзакции
 *
 * @boundary-validation Гарантируется фабрикой {@link makeTxId}
 * @throws Error при пустом значении
 */
export type TxId = string & { readonly __brand: 'TxId'; };

/**
 * Уровень изоляции транзакции
 *
 * Используется как строгий enum для предотвращения опечаток
 */
export enum TransactionIsolationLevel {
  READ_UNCOMMITTED = 'READ_UNCOMMITTED',
  READ_COMMITTED = 'READ_COMMITTED',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

/**
 * Контекст активной транзакции
 */
export type DbTransactionContext = Readonly<{
  txId: TxId;
  isolationLevel: TransactionIsolationLevel;
}>;

// ==================== РЕЗУЛЬТАТЫ ЗАПРОСОВ ====================

/**
 * Результат SELECT-подобного запроса
 */
export type DbQueryResult<Row = unknown> = Readonly<{
  rows: readonly Row[];
  rowCount: number;
  durationMs: DbDurationMs;
}>;

/**
 * Результат EXECUTE (INSERT / UPDATE / DELETE)
 */
export type DbExecuteResult = Readonly<{
  affectedRows: number;
  durationMs: DbDurationMs;
}>;

// ==================== CIRCUIT BREAKER ====================

/**
 * Ключ circuit breaker для БД
 *
 * Обычно: databaseId + operation type
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDbCircuitBreakerKey}
 * @throws Error при пустом значении
 */
export type DbCircuitBreakerKey = string & { readonly __brand: 'DbCircuitBreakerKey'; };

/**
 * Порог circuit breaker для DB
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCircuitBreakerThreshold}
 * @throws Error при значениях вне допустимого диапазона
 */
export type DbCircuitBreakerThreshold = number & {
  readonly __brand: 'DbCircuitBreakerThreshold';
};

// ==================== ОШИБКИ БАЗЫ ДАННЫХ ====================

/**
 * Имя constraint (UNIQUE / FK / CHECK)
 *
 * @boundary-validation Гарантируется фабрикой {@link makeConstraintName}
 * @throws Error при пустом значении
 */
export type ConstraintName = string & { readonly __brand: 'ConstraintName'; };

/**
 * Типизированная ошибка Database-адаптера (transport-level)
 *
 * ❗ Не бизнес-ошибка
 * ❗ Используется для нормализации и ErrorStrategies
 */
export type DbError =
  | Readonly<{
    _tag: 'DbConnectionError';
    message: string;
    code?: string;
  }>
  | Readonly<{
    _tag: 'DbTimeoutError';
    timeoutMs: DbTimeoutMs;
  }>
  | Readonly<{
    _tag: 'DbConstraintViolation';
    constraint: ConstraintName;
  }>
  | Readonly<{
    _tag: 'DbDeadlockError';
  }>
  | Readonly<{
    _tag: 'DbUnknownError';
    original: unknown;
  }>;

// ==================== РЕШЕНИЕ СТРАТЕГИИ ОБРАБОТКИ ОШИБОК ====================

/**
 * Решение стратегии обработки DB ошибки
 *
 * success — операция успешна
 * retry   — можно повторить запрос
 * fail    — фатальная ошибка
 */
export type DbStrategyDecision =
  | Readonly<{ type: 'success'; }>
  | Readonly<{
    type: 'retry';
    retryAfterMs?: DbTimeoutMs;
  }>
  | Readonly<{
    type: 'fail';
    errorCode: LivAiErrorCode;
    openCircuit?: boolean;
  }>;

// ==================== ОПЦИИ DATABASE АДАПТЕРА ====================

/**
 * Опции Database адаптера
 */
export type DatabaseAdapterOptions = Readonly<{
  databaseId?: DatabaseId;
  timeoutMs?: DbTimeoutMs;
  maxRetries?: DbMaxRetries;
  retryDelayMs?: DbTimeoutMs;
  circuitBreakerThreshold?: DbCircuitBreakerThreshold;
  circuitBreakerRecoveryMs?: DbTimeoutMs;
  circuitBreakerEnabled?: boolean;
  retriesEnabled?: boolean;
  maxConnectionPoolSize?: number;
  minConnectionPoolSize?: number;
  connectionTimeoutMs?: DbTimeoutMs;
  connectionMaxLifetimeMs?: DbTimeoutMs;
  connectionIdleTimeoutMs?: DbTimeoutMs;
  defaultIsolationLevel?: TransactionIsolationLevel;
  sqlLoggingEnabled?: boolean;
  metricsEnabled?: boolean;
}>;

// ==================== КОНТЕКСТ DATABASE АДАПТЕРА ====================

/**
 * Контекст Database-адаптера (transport-level)
 *
 * Используется для дефолтов и DI
 */
export type DatabaseAdapterContext = Readonly<{
  databaseId: DatabaseId;
  defaultTimeoutMs?: DbTimeoutMs;
  maxRetries?: DbMaxRetries;
}>;
