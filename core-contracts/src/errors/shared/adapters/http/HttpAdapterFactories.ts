/**
 * @file HttpAdapterFactories.ts
 * Фабрики для создания branded types HTTP адаптера.
 *
 * ❗ Содержит только фабричные функции
 * ❗ Не содержит бизнес-логики
 * ❗ Не зависит от Effect / FP
 *
 * Обеспечивает type-safe создание экземпляров типов.
 */

import type {
  CircuitBreakerKey,
  CircuitBreakerThreshold,
  CorrelationId,
  DurationMs,
  HttpHeaders,
  HttpStatusCode,
  HttpUrl,
  MaxRetries,
  TimeoutMs,
} from './HttpAdapterTypes.js';

/** Константы для валидации в фабриках */
const VALIDATION_CONSTANTS = {
  MAX_RETRIES: 10,
  CIRCUIT_BREAKER_MIN: 1,
  CIRCUIT_BREAKER_MAX: 100,
  HTTP_STATUS_MIN: 100,
  HTTP_STATUS_MAX: 599,
} as const;

/**
 * Кастомный Error класс для ошибок валидации в фабриках HTTP адаптера
 */
export class HttpAdapterValidationError extends Error {
  override readonly name = 'HttpAdapterValidationError';

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
 * Фабрика для создания HttpUrl с валидацией
 *
 * @param url - URL строка для валидации
 * @returns Брендированный HttpUrl
 * @throws {HttpAdapterValidationError} если url пустой, не является строкой или имеет некорректный формат URL
 * @throws {HttpAdapterValidationError} если url не может быть распарсен конструктором URL
 */
export const makeHttpUrl = (url: string): HttpUrl => {
  if (typeof url !== 'string' || !url || url.trim() === '') {
    throw new HttpAdapterValidationError('HttpUrl must be a non-empty string', 'makeHttpUrl', url);
  }

  // Базовая валидация URL формата
  try {
    new URL(url);
  } catch {
    throw new HttpAdapterValidationError(`Invalid URL format: ${url}`, 'makeHttpUrl', url);
  }

  return url as HttpUrl;
};

/**
 * Фабрика для создания TimeoutMs с валидацией
 *
 * @param ms - Количество миллисекунд
 * @returns Брендированный TimeoutMs
 * @throws {HttpAdapterValidationError} если ms не является числом, отрицательным или не конечным
 */
export const makeTimeoutMs = (ms: number): TimeoutMs => {
  if (typeof ms !== 'number' || ms < 0 || !Number.isFinite(ms)) {
    throw new HttpAdapterValidationError(
      'TimeoutMs must be a non-negative finite number',
      'makeTimeoutMs',
      ms,
    );
  }

  return ms as TimeoutMs;
};

/**
 * Фабрика для создания DurationMs с валидацией
 *
 * @param ms - Количество миллисекунд длительности
 * @returns Брендированный DurationMs
 * @throws {HttpAdapterValidationError} если ms не является числом, отрицательным или не конечным
 */
export const makeDurationMs = (ms: number): DurationMs => {
  if (typeof ms !== 'number' || ms < 0 || !Number.isFinite(ms)) {
    throw new HttpAdapterValidationError(
      'DurationMs must be a non-negative finite number',
      'makeDurationMs',
      ms,
    );
  }

  return ms as DurationMs;
};

/**
 * Фабрика для создания MaxRetries с валидацией
 */
export const makeMaxRetries = (retries: number): MaxRetries => {
  if (
    typeof retries !== 'number'
    || retries < 0
    || retries > VALIDATION_CONSTANTS.MAX_RETRIES
    || !Number.isInteger(retries)
  ) {
    throw new HttpAdapterValidationError(
      `MaxRetries must be an integer between 0 and ${VALIDATION_CONSTANTS.MAX_RETRIES}`,
      'makeMaxRetries',
      retries,
    );
  }

  return retries as MaxRetries;
};

/**
 * Фабрика для создания CircuitBreakerThreshold с валидацией
 */
export const makeCircuitBreakerThreshold = (threshold: number): CircuitBreakerThreshold => {
  if (
    typeof threshold !== 'number'
    || threshold < VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MIN
    || threshold > VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MAX
    || !Number.isInteger(threshold)
  ) {
    throw new HttpAdapterValidationError(
      `CircuitBreakerThreshold must be an integer between ${VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MIN} and ${VALIDATION_CONSTANTS.CIRCUIT_BREAKER_MAX}`,
      'makeCircuitBreakerThreshold',
      threshold,
    );
  }

  return threshold as CircuitBreakerThreshold;
};

/**
 * Фабрика для создания HttpStatusCode с валидацией
 *
 * @param code - HTTP статус код
 * @returns Брендированный HttpStatusCode
 * @throws {HttpAdapterValidationError} если code не является целым числом в диапазоне 100-599
 */
export const makeHttpStatusCode = (code: number): HttpStatusCode => {
  if (
    typeof code !== 'number'
    || code < VALIDATION_CONSTANTS.HTTP_STATUS_MIN
    || code > VALIDATION_CONSTANTS.HTTP_STATUS_MAX
    || !Number.isInteger(code)
  ) {
    throw new HttpAdapterValidationError(
      `HttpStatusCode must be an integer between ${VALIDATION_CONSTANTS.HTTP_STATUS_MIN} and ${VALIDATION_CONSTANTS.HTTP_STATUS_MAX}`,
      'makeHttpStatusCode',
      code,
    );
  }

  return code as HttpStatusCode;
};

/**
 * Фабрика для создания CircuitBreakerKey с валидацией
 *
 * @param key - Ключ для circuit breaker (обычно host + method)
 * @returns Брендированный CircuitBreakerKey
 * @throws {HttpAdapterValidationError} если key пустой, не является строкой или состоит только из пробелов
 */
export const makeCircuitBreakerKey = (key: string): CircuitBreakerKey => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new HttpAdapterValidationError(
      'CircuitBreakerKey must be a non-empty string',
      'makeCircuitBreakerKey',
      key,
    );
  }

  return key as CircuitBreakerKey;
};

/**
 * Фабрика для создания CorrelationId с валидацией
 *
 * @param id - correlation ID строка
 * @returns Брендированный CorrelationId
 * @throws {HttpAdapterValidationError} при пустой или не-string значении
 */
export const makeCorrelationId = (id: string): CorrelationId => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new HttpAdapterValidationError(
      'CorrelationId must be a non-empty string',
      'makeCorrelationId',
      id,
    );
  }

  return id as CorrelationId;
};

/**
 * Фабрика для создания HttpHeaders с валидацией
 *
 * @param headers - объект headers
 * @returns Брендированный HttpHeaders
 * @throws {HttpAdapterValidationError} при некорректном формате headers
 */
export const makeHttpHeaders = (headers: unknown): HttpHeaders => {
  if (headers === null || headers === undefined || typeof headers !== 'object') {
    throw new HttpAdapterValidationError(
      'HttpHeaders must be an object',
      'makeHttpHeaders',
      headers,
    );
  }

  // Проверяем что все ключи - непустые строки и все значения - строки
  const headersRecord = headers as Record<string, unknown>;
  for (const key in headersRecord) {
    if (!Object.prototype.hasOwnProperty.call(headersRecord, key)) continue;
    const value = headersRecord[key];
    if (typeof key !== 'string' || key === '' || typeof value !== 'string') {
      throw new HttpAdapterValidationError(
        'HttpHeaders keys and values must be strings',
        'makeHttpHeaders',
        headers,
      );
    }
  }

  return headers as HttpHeaders;
};

// ==================== HTTP ADAPTER FACTORIES API ====================

/**
 * Коллекция всех фабрик для создания branded types HTTP адаптера
 */
export const httpAdapterFactories = {
  makeHttpUrl,
  makeTimeoutMs,
  makeDurationMs,
  makeMaxRetries,
  makeCircuitBreakerThreshold,
  makeHttpStatusCode,
  makeCircuitBreakerKey,
  makeCorrelationId,
  makeHttpHeaders,
  // Error class для boundary validation
  ValidationError: HttpAdapterValidationError,
} as const;
