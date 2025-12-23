/**
 * @file CacheAdapterFactories.ts
 * Фабрики для создания branded types Cache адаптера.
 *
 * ❗ Содержит только фабричные функции
 * ❗ Не содержит бизнес-логики
 * ❗ Не зависит от Effect / FP
 *
 * Обеспечивает type-safe создание экземпляров типов.
 */

import type {
  CacheCircuitBreakerKey,
  CacheCircuitBreakerThreshold,
  CacheDurationMs,
  CacheInstanceId,
  CacheKey,
  CacheMaxRetries,
  CacheNodeId,
  CacheTimeoutMs,
  CacheTtlMs,
} from './CacheAdapterTypes.js';

/** Константы для валидации в фабриках */
const VALIDATION_CONSTANTS = {
  MAX_RETRIES: 10,
  CIRCUIT_BREAKER_MIN: 1,
  CIRCUIT_BREAKER_MAX: 100,
  MAX_TIMEOUT_MS: 300000, // 5 минут
  MIN_TIMEOUT_MS: 100, // 100ms
  MAX_TTL_MS: 2592000000, // 30 дней
} as const;

/** Кастомный Error класс для ошибок валидации в фабриках Cache адаптера */
export class CacheAdapterValidationError extends Error {
  override readonly name = 'CacheAdapterValidationError';

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
 * Фабрика для создания CacheKey с валидацией
 *
 * @param key - Ключ кеша
 * @returns Брендированный CacheKey
 * @throws {CacheAdapterValidationError} если key пустой или не является строкой
 */
export const makeCacheKey = (key: string): CacheKey => {
  if (typeof key !== 'string' || !key || key.trim() === '') {
    throw new CacheAdapterValidationError(
      'CacheKey must be a non-empty string',
      'makeCacheKey',
      key,
    );
  }

  return key as CacheKey;
};

/**
 * Фабрика для создания CacheTtlMs с валидацией
 *
 * @param ms - TTL в миллисекундах
 * @returns Брендированный CacheTtlMs
 * @throws {CacheAdapterValidationError} если ms не является числом, отрицательным или вне допустимого диапазона
 *
 * @note TTL = 0 недопустим, чтобы явно отличить от "без TTL" (которое обрабатывается отдельно)
 */
export const makeCacheTtlMs = (ms: number): CacheTtlMs => {
  if (
    typeof ms !== 'number'
    || ms <= 0
    || ms > VALIDATION_CONSTANTS.MAX_TTL_MS
    || !Number.isFinite(ms)
  ) {
    throw new CacheAdapterValidationError(
      `CacheTtlMs must be a finite number between 1 and ${VALIDATION_CONSTANTS.MAX_TTL_MS}`,
      'makeCacheTtlMs',
      ms,
    );
  }

  return ms as CacheTtlMs;
};

/**
 * Фабрика для создания CacheTimeoutMs с валидацией
 *
 * @param ms - Количество миллисекунд
 * @returns Брендированный CacheTimeoutMs
 * @throws {CacheAdapterValidationError} если ms не является числом, отрицательным или вне допустимого диапазона
 *
 * @note Использует те же границы, что и DB адаптер, но для Cache можно отдельно варьировать
 * (например, меньшее MAX_TIMEOUT_MS для более быстрого фейловера)
 */
export const makeTimeoutMs = (ms: number): CacheTimeoutMs => {
  if (
    typeof ms !== 'number'
    || ms < VALIDATION_CONSTANTS.MIN_TIMEOUT_MS
    || ms > VALIDATION_CONSTANTS.MAX_TIMEOUT_MS
    || !Number.isFinite(ms)
  ) {
    throw new CacheAdapterValidationError(
      `TimeoutMs must be a finite number between ${VALIDATION_CONSTANTS.MIN_TIMEOUT_MS} and ${VALIDATION_CONSTANTS.MAX_TIMEOUT_MS}`,
      'makeTimeoutMs',
      ms,
    );
  }

  return ms as CacheTimeoutMs;
};

/**
 * Фабрика для создания CacheDurationMs с валидацией
 *
 * @param ms - Количество миллисекунд длительности
 * @returns Брендированный CacheDurationMs
 * @throws {CacheAdapterValidationError} если ms не является числом или отрицательным
 *
 * @note Использует те же границы, что и DB адаптер, но для Cache можно отдельно варьировать
 * (например, меньшее MAX_TIMEOUT_MS для более быстрого фейловера)
 */
export const makeDurationMs = (ms: number): CacheDurationMs => {
  if (typeof ms !== 'number' || ms < 0 || !Number.isFinite(ms)) {
    throw new CacheAdapterValidationError(
      'DurationMs must be a non-negative finite number',
      'makeDurationMs',
      ms,
    );
  }

  return ms as CacheDurationMs;
};

/** Фабрика для создания CacheMaxRetries с валидацией */
export const makeMaxRetries = (retries: number): CacheMaxRetries => {
  if (
    typeof retries !== 'number'
    || retries < 0
    || retries > VALIDATION_CONSTANTS.MAX_RETRIES
    || !Number.isInteger(retries)
  ) {
    throw new CacheAdapterValidationError(
      `MaxRetries must be an integer between 0 and ${VALIDATION_CONSTANTS.MAX_RETRIES}`,
      'makeMaxRetries',
      retries,
    );
  }

  return retries as CacheMaxRetries;
};

/**
 * Фабрика для создания CacheInstanceId с валидацией
 *
 * @param id - Идентификатор cache instance
 * @returns Брендированный CacheInstanceId
 * @throws {CacheAdapterValidationError} если id пустой или не является строкой
 */
export const makeCacheInstanceId = (id: string): CacheInstanceId => {
  if (typeof id !== 'string' || !id || id.trim() === '') {
    throw new CacheAdapterValidationError(
      'CacheInstanceId must be a non-empty string',
      'makeCacheInstanceId',
      id,
    );
  }

  return id as CacheInstanceId;
};

/**
 * Фабрика для создания CacheNodeId с валидацией
 *
 * @param id - Идентификатор узла кластера
 * @returns Брендированный CacheNodeId
 * @throws {CacheAdapterValidationError} если id пустой или не является строкой
 */
export const makeCacheNodeId = (id: string): CacheNodeId => {
  if (typeof id !== 'string' || !id || id.trim() === '') {
    throw new CacheAdapterValidationError(
      'CacheNodeId must be a non-empty string',
      'makeCacheNodeId',
      id,
    );
  }

  return id as CacheNodeId;
};

/**
 * Фабрика для создания CacheCircuitBreakerKey с валидацией
 *
 * @param key - Ключ для circuit breaker (обычно cacheInstanceId + operation type)
 * @returns Брендированный CacheCircuitBreakerKey
 * @throws {CacheAdapterValidationError} если key пустой, не является строкой или состоит только из пробелов
 */
export const makeCacheCircuitBreakerKey = (key: string): CacheCircuitBreakerKey => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new CacheAdapterValidationError(
      'CacheCircuitBreakerKey must be a non-empty string',
      'makeCacheCircuitBreakerKey',
      key,
    );
  }

  return key as CacheCircuitBreakerKey;
};

/** Фабрика для создания CacheCircuitBreakerThreshold с валидацией */
export const makeCircuitBreakerThreshold = (threshold: number): CacheCircuitBreakerThreshold => {
  if (
    typeof threshold !== 'number'
    || threshold < VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MIN
    || threshold > VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MAX
    || !Number.isInteger(threshold)
  ) {
    throw new CacheAdapterValidationError(
      `CircuitBreakerThreshold must be an integer between ${VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MIN} and ${VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MAX}`,
      'makeCircuitBreakerThreshold',
      threshold,
    );
  }

  return threshold as CacheCircuitBreakerThreshold;
};

// ==================== CACHE ADAPTER FACTORIES API ====================

/** Коллекция всех фабрик для создания branded types Cache адаптера */
export const cacheAdapterFactories = {
  makeCacheKey,
  makeCacheTtlMs,
  makeTimeoutMs,
  makeDurationMs,
  makeMaxRetries,
  makeCacheInstanceId,
  makeCacheNodeId,
  makeCacheCircuitBreakerKey,
  makeCircuitBreakerThreshold,
  // Error class для boundary validation
  ValidationError: CacheAdapterValidationError,
} as const;
