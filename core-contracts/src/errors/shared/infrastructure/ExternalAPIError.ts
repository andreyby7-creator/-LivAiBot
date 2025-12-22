/**
 * @file ExternalAPIError.ts - Ошибки внешних API LivAiBot
 *
 * TaggedError типы для ошибок внешних API сервисов.
 * Pure mapping от внешних API ошибок к BaseError через ErrorBuilders.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';

/**
 * Контекст ошибки внешнего API с дополнительными полями
 */
export type ExternalAPIErrorContext = {
  /** Название внешнего сервиса */
  readonly serviceName?: string;
  /** Версия API */
  readonly apiVersion?: string;
  /** Endpoint API */
  readonly endpoint?: string;
  /** HTTP метод */
  readonly method?: string;
  /** HTTP статус код */
  readonly statusCode?: number;
  /** ID запроса во внешнем сервисе */
  readonly externalRequestId?: string;
  /** Время выполнения запроса в мс */
  readonly responseTime?: number;
  /** Размер ответа в байтах */
  readonly responseSize?: number;
  /** Rate limit информация */
  readonly rateLimit?: {
    readonly limit?: number;
    readonly remaining?: number;
    readonly resetTime?: number;
  };
  /** Retry информация */
  readonly retry?: {
    readonly attempt?: number;
    readonly maxAttempts?: number;
    readonly backoff?: number;
  };
};

/**
 * TaggedError тип для ошибок внешних API
 */
export type ExternalAPIError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.TECHNICAL;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.MEDIUM;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: ExternalAPIErrorContext;
  readonly timestamp: string;
}, 'ExternalAPIError'>;

/**
 * Создает ExternalAPIError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст ошибки внешнего API
 * @param timestamp - опциональный timestamp для тестов
 * @returns ExternalAPIError
 */
export function createExternalAPIError(
  code: ErrorCode,
  message: string,
  context?: ExternalAPIErrorContext,
  timestamp?: string,
): ExternalAPIError {
  return {
    _tag: 'ExternalAPIError',
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as ExternalAPIError;
}

/**
 * Проверяет, является ли объект допустимым ExternalAPIErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует ExternalAPIErrorContext
 */
export function isValidExternalAPIErrorContext(
  context: unknown,
): context is ExternalAPIErrorContext {
  if (context == null || typeof context !== 'object' || Array.isArray(context)) return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем опциональные поля ExternalAPIErrorContext
  if (ctx['serviceName'] !== undefined && typeof ctx['serviceName'] !== 'string') return false;
  if (ctx['apiVersion'] !== undefined && typeof ctx['apiVersion'] !== 'string') return false;
  if (ctx['endpoint'] !== undefined && typeof ctx['endpoint'] !== 'string') return false;
  if (ctx['method'] !== undefined && typeof ctx['method'] !== 'string') return false;
  if (
    ctx['statusCode'] !== undefined
    && (typeof ctx['statusCode'] !== 'number' || !Number.isInteger(ctx['statusCode']))
  ) return false;
  if (ctx['externalRequestId'] !== undefined && typeof ctx['externalRequestId'] !== 'string') {
    return false;
  }
  if (
    ctx['responseTime'] !== undefined
    && (typeof ctx['responseTime'] !== 'number'
      || !Number.isInteger(ctx['responseTime'])
      || ctx['responseTime'] < 0)
  ) return false;
  if (
    ctx['responseSize'] !== undefined
    && (typeof ctx['responseSize'] !== 'number' || !Number.isInteger(ctx['responseSize']))
  ) return false;

  // Проверяем вложенные объекты
  if (ctx['rateLimit'] !== undefined) {
    if (typeof ctx['rateLimit'] !== 'object' || ctx['rateLimit'] === null) return false;
    const rateLimit = ctx['rateLimit'] as Record<string, unknown>;
    if (
      rateLimit['limit'] !== undefined
      && (typeof rateLimit['limit'] !== 'number' || !Number.isInteger(rateLimit['limit']))
    ) return false;
    if (
      rateLimit['remaining'] !== undefined
      && (typeof rateLimit['remaining'] !== 'number' || !Number.isInteger(rateLimit['remaining']))
    ) return false;
    if (
      rateLimit['resetTime'] !== undefined
      && (typeof rateLimit['resetTime'] !== 'number'
        || !Number.isInteger(rateLimit['resetTime'])
        || rateLimit['resetTime'] < 0)
    ) return false;
  }

  if (ctx['retry'] !== undefined) {
    if (typeof ctx['retry'] !== 'object' || ctx['retry'] === null) return false;
    const retry = ctx['retry'] as Record<string, unknown>;
    if (
      retry['attempt'] !== undefined
      && (typeof retry['attempt'] !== 'number' || !Number.isInteger(retry['attempt']))
    ) return false;
    if (
      retry['maxAttempts'] !== undefined
      && (typeof retry['maxAttempts'] !== 'number' || !Number.isInteger(retry['maxAttempts']))
    ) return false;
    if (
      retry['backoff'] !== undefined
      && (typeof retry['backoff'] !== 'number'
        || !Number.isInteger(retry['backoff'])
        || retry['backoff'] < 0)
    ) return false;
  }

  return true;
}

/**
 * Type guard для проверки, является ли ошибка ExternalAPIError
 * @param error - ошибка для проверки
 * @returns true если это ExternalAPIError
 */
export function isExternalAPIError(error: unknown): error is ExternalAPIError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'ExternalAPIError'
    && candidate['category'] === ERROR_CATEGORY.TECHNICAL
    && candidate['origin'] === ERROR_ORIGIN.INFRASTRUCTURE
    && candidate['severity'] === ERROR_SEVERITY.MEDIUM
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined || isValidExternalAPIErrorContext(candidate['details']))
  );
}

/**
 * Извлекает информацию о сервисе из ExternalAPIError
 * @param error - ExternalAPIError
 * @returns информация о сервисе или undefined
 */
export function getAPIServiceInfo(error: ExternalAPIError): {
  serviceName?: string | undefined;
  apiVersion?: string | undefined;
  endpoint?: string | undefined;
} | undefined {
  const details = error.details;
  if (!details) return undefined;

  return {
    serviceName: details.serviceName,
    apiVersion: details.apiVersion,
    endpoint: details.endpoint,
  };
}

/**
 * Извлекает информацию о rate limiting из ExternalAPIError
 * @param error - ExternalAPIError
 * @returns информация о rate limiting или undefined
 */
export function getAPIRateLimit(error: ExternalAPIError): {
  limit?: number | undefined;
  remaining?: number | undefined;
  resetTime?: number | undefined;
} | undefined {
  return error.details?.rateLimit;
}

/**
 * Извлекает информацию о retry из ExternalAPIError
 * @param error - ExternalAPIError
 * @returns информация о retry или undefined
 */
export function getAPIRetryInfo(error: ExternalAPIError): {
  attempt?: number | undefined;
  maxAttempts?: number | undefined;
  backoff?: number | undefined;
} | undefined {
  return error.details?.retry;
}

/**
 * Проверяет, является ли ExternalAPIError ошибкой rate limit (лимиты исчерпаны)
 * @param error - ExternalAPIError
 * @returns true если rate limit достигнут (remaining === 0)
 */
export function isRateLimitError(error: ExternalAPIError): boolean {
  const remaining = error.details?.rateLimit?.remaining;
  return typeof remaining === 'number' && Number.isInteger(remaining) && remaining === 0;
}

/**
 * Проверяет, является ли ExternalAPIError повторяемой (можно retry)
 * @param error - ExternalAPIError
 * @returns true если ошибка повторяемая (attempt < maxAttempts)
 */
export function isRetryableError(error: ExternalAPIError): boolean {
  const retry = error.details?.retry;
  if (!retry) return false;
  const attempt = retry.attempt;
  const maxAttempts = retry.maxAttempts;
  return (
    typeof attempt === 'number'
    && typeof maxAttempts === 'number'
    && Number.isInteger(attempt)
    && Number.isInteger(maxAttempts)
    && attempt >= 0
    && maxAttempts > 0
    && attempt < maxAttempts
  );
}

/**
 * Извлекает информацию о API соединении из ExternalAPIError
 * @param error - ExternalAPIError
 * @returns информация о соединении к API или undefined
 */
export function getAPIConnection(error: ExternalAPIError): {
  serviceName?: string | undefined;
  endpoint?: string | undefined;
  method?: string | undefined;
  statusCode?: number | undefined;
} | undefined {
  const details = error.details;
  if (!details) return undefined;

  return {
    serviceName: details.serviceName,
    endpoint: details.endpoint,
    method: details.method,
    statusCode: details.statusCode,
  };
}
