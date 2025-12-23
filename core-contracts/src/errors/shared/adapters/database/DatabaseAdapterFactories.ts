/**
 * @file DatabaseAdapterFactories.ts
 * Фабрики для создания branded types Database адаптера.
 *
 * ❗ Содержит только фабричные функции
 * ❗ Не содержит бизнес-логики
 * ❗ Не зависит от Effect / FP
 *
 * Обеспечивает type-safe создание экземпляров типов.
 */

import type {
  ConstraintName,
  DatabaseId,
  DbCircuitBreakerKey,
  DbCircuitBreakerThreshold,
  DbConnectionId,
  DbDurationMs,
  DbMaxRetries,
  DbQuery,
  DbTimeoutMs,
  TxId,
} from './DatabaseAdapterTypes.js';

/** Константы для валидации в фабриках */
const VALIDATION_CONSTANTS = {
  MAX_RETRIES: 10,
  CIRCUIT_BREAKER_MIN: 1,
  CIRCUIT_BREAKER_MAX: 100,
  MAX_TIMEOUT_MS: 300000, // 5 минут
  MIN_TIMEOUT_MS: 100, // 100ms
} as const;

/**
 * Кастомный Error класс для ошибок валидации в фабриках Database адаптера
 */
export class DatabaseAdapterValidationError extends Error {
  override readonly name = 'DatabaseAdapterValidationError';

  constructor(
    message: string,
    readonly factory: string,
    readonly value: unknown,
  ) {
    super(`[${factory}] ${message}`);
    this.stack = new Error().stack ?? '';
  }
}

// ==================== ФАБРИКИ ДЛЯ СОЗДАНИЯ BRANDED TYPES ====================

/**
 * Фабрика для создания DatabaseId с валидацией
 *
 * @param id - Идентификатор базы данных
 * @returns Брендированный DatabaseId
 * @throws {DatabaseAdapterValidationError} если id пустой или не является строкой
 */
export const makeDatabaseId = (id: string): DatabaseId => {
  if (typeof id !== 'string' || !id || id.trim() === '') {
    throw new DatabaseAdapterValidationError(
      'DatabaseId must be a non-empty string',
      'makeDatabaseId',
      id,
    );
  }

  return id as DatabaseId;
};

/**
 * Фабрика для создания DbQuery с валидацией
 *
 * @param query - SQL запрос в текстовом виде
 * @returns Брендированный DbQuery
 * @throws {DatabaseAdapterValidationError} если query пустой или не является строкой
 */
export const makeDbQuery = (query: string): DbQuery => {
  if (typeof query !== 'string' || !query || query.trim() === '') {
    throw new DatabaseAdapterValidationError(
      'DbQuery must be a non-empty string',
      'makeDbQuery',
      query,
    );
  }

  return query as DbQuery;
};

/**
 * Фабрика для создания DbTimeoutMs с валидацией
 *
 * @param ms - Количество миллисекунд
 * @returns Брендированный DbTimeoutMs
 * @throws {DatabaseAdapterValidationError} если ms не является числом, отрицательным или вне допустимого диапазона
 */
export const makeTimeoutMs = (ms: number): DbTimeoutMs => {
  if (
    typeof ms !== 'number'
    || ms < VALIDATION_CONSTANTS.MIN_TIMEOUT_MS
    || ms > VALIDATION_CONSTANTS.MAX_TIMEOUT_MS
    || !Number.isFinite(ms)
  ) {
    throw new DatabaseAdapterValidationError(
      `TimeoutMs must be a finite number between ${VALIDATION_CONSTANTS.MIN_TIMEOUT_MS} and ${VALIDATION_CONSTANTS.MAX_TIMEOUT_MS}`,
      'makeTimeoutMs',
      ms,
    );
  }

  return ms as DbTimeoutMs;
};

/**
 * Фабрика для создания DbDurationMs с валидацией
 *
 * @param ms - Количество миллисекунд длительности
 * @returns Брендированный DbDurationMs
 * @throws {DatabaseAdapterValidationError} если ms не является числом или отрицательным
 */
export const makeDurationMs = (ms: number): DbDurationMs => {
  if (typeof ms !== 'number' || ms < 0 || !Number.isFinite(ms)) {
    throw new DatabaseAdapterValidationError(
      'DurationMs must be a non-negative finite number',
      'makeDurationMs',
      ms,
    );
  }

  return ms as DbDurationMs;
};

/**
 * Фабрика для создания DbMaxRetries с валидацией
 */
export const makeMaxRetries = (retries: number): DbMaxRetries => {
  if (
    typeof retries !== 'number'
    || retries < 0
    || retries > VALIDATION_CONSTANTS.MAX_RETRIES
    || !Number.isInteger(retries)
  ) {
    throw new DatabaseAdapterValidationError(
      `MaxRetries must be an integer between 0 and ${VALIDATION_CONSTANTS.MAX_RETRIES}`,
      'makeMaxRetries',
      retries,
    );
  }

  return retries as DbMaxRetries;
};

/**
 * Фабрика для создания DbConnectionId с валидацией
 *
 * @param id - Идентификатор соединения
 * @returns Брендированный DbConnectionId
 * @throws {DatabaseAdapterValidationError} при пустом или не-string значении
 */
export const makeDbConnectionId = (id: string): DbConnectionId => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new DatabaseAdapterValidationError(
      'DbConnectionId must be a non-empty string',
      'makeDbConnectionId',
      id,
    );
  }

  return id as DbConnectionId;
};

/**
 * Фабрика для создания TxId с валидацией
 *
 * @param id - Идентификатор транзакции
 * @returns Брендированный TxId
 * @throws {DatabaseAdapterValidationError} при пустом или не-string значении
 */
export const makeTxId = (id: string): TxId => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new DatabaseAdapterValidationError(
      'TxId must be a non-empty string',
      'makeTxId',
      id,
    );
  }

  return id as TxId;
};

/**
 * Фабрика для создания DbCircuitBreakerKey с валидацией
 *
 * @param key - Ключ для circuit breaker (обычно databaseId + operation type)
 * @returns Брендированный DbCircuitBreakerKey
 * @throws {DatabaseAdapterValidationError} если key пустой, не является строкой или состоит только из пробелов
 */
export const makeDbCircuitBreakerKey = (key: string): DbCircuitBreakerKey => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new DatabaseAdapterValidationError(
      'DbCircuitBreakerKey must be a non-empty string',
      'makeDbCircuitBreakerKey',
      key,
    );
  }

  return key as DbCircuitBreakerKey;
};

/**
 * Фабрика для создания DbCircuitBreakerThreshold с валидацией
 */
export const makeCircuitBreakerThreshold = (threshold: number): DbCircuitBreakerThreshold => {
  if (
    typeof threshold !== 'number'
    || threshold < VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MIN
    || threshold > VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MAX
    || !Number.isInteger(threshold)
  ) {
    throw new DatabaseAdapterValidationError(
      `CircuitBreakerThreshold must be an integer between ${VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MIN} and ${VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MAX}`,
      'makeCircuitBreakerThreshold',
      threshold,
    );
  }

  return threshold as DbCircuitBreakerThreshold;
};

/**
 * Фабрика для создания ConstraintName с валидацией
 *
 * @param name - Имя constraint (UNIQUE / FK / CHECK)
 * @returns Брендированный ConstraintName
 * @throws {DatabaseAdapterValidationError} при пустом или не-string значении
 */
export const makeConstraintName = (name: string): ConstraintName => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new DatabaseAdapterValidationError(
      'ConstraintName must be a non-empty string',
      'makeConstraintName',
      name,
    );
  }

  return name as ConstraintName;
};

// ==================== DATABASE ADAPTER FACTORIES API ====================

/**
 * Коллекция всех фабрик для создания branded types Database адаптера
 */
export const databaseAdapterFactories = {
  makeDatabaseId,
  makeDbQuery,
  makeTimeoutMs,
  makeDurationMs,
  makeMaxRetries,
  makeDbConnectionId,
  makeTxId,
  makeDbCircuitBreakerKey,
  makeCircuitBreakerThreshold,
  makeConstraintName,
  // Error class для boundary validation
  ValidationError: DatabaseAdapterValidationError,
} as const;
