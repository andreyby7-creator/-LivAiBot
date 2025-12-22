/**
 * @file CacheError.ts - Ошибки кеша LivAiBot
 *
 * TaggedError типы для ошибок кеширования.
 * Pure mapping от внешних ошибок кеша к BaseError через ErrorBuilders.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';

/**
 * Контекст ошибки кеша с дополнительными полями
 */
export type CacheErrorContext = {
  /** Тип кеша (redis, memcached, memory, etc.) */
  readonly cacheType?: string;
  /** Ключ кеша */
  readonly key?: string;
  /** Операция (get, set, delete, expire) */
  readonly operation?: string;
  /** TTL (время жизни) */
  readonly ttl?: number;
  /** Cache namespace */
  readonly namespace?: string;
  /** Cache host */
  readonly host?: string;
  /** Cache port */
  readonly port?: number;
  /** Connection ID */
  readonly connectionId?: string;
};

/**
 * TaggedError тип для ошибок кеша
 */
export type CacheError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.TECHNICAL;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.MEDIUM;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: CacheErrorContext;
  readonly timestamp: string;
}, 'CacheError'>;

/**
 * Создает CacheError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст ошибки кеша
 * @param timestamp - опциональный timestamp для тестов
 * @returns CacheError
 */
export function createCacheError(
  code: ErrorCode,
  message: string,
  context?: CacheErrorContext,
  timestamp?: string,
): CacheError {
  return {
    _tag: 'CacheError',
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as CacheError;
}

/**
 * Проверяет, является ли объект допустимым CacheErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует CacheErrorContext
 */
export function isValidCacheErrorContext(context: unknown): context is CacheErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем опциональные поля CacheErrorContext
  if (ctx['cacheType'] !== undefined && typeof ctx['cacheType'] !== 'string') return false;
  if (ctx['key'] !== undefined && typeof ctx['key'] !== 'string') return false;
  if (ctx['operation'] !== undefined && typeof ctx['operation'] !== 'string') return false;
  if (
    ctx['ttl'] !== undefined && (typeof ctx['ttl'] !== 'number' || !Number.isInteger(ctx['ttl']))
  ) return false;
  if (ctx['namespace'] !== undefined && typeof ctx['namespace'] !== 'string') return false;
  if (ctx['host'] !== undefined && typeof ctx['host'] !== 'string') return false;
  if (
    ctx['port'] !== undefined && (typeof ctx['port'] !== 'number' || !Number.isInteger(ctx['port']))
  ) return false;
  if (ctx['connectionId'] !== undefined && typeof ctx['connectionId'] !== 'string') return false;

  return true;
}

/**
 * Type guard для проверки, является ли ошибка CacheError
 * @param error - ошибка для проверки
 * @returns true если это CacheError
 */
export function isCacheError(error: unknown): error is CacheError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'CacheError'
    && candidate['category'] === ERROR_CATEGORY.TECHNICAL
    && candidate['origin'] === ERROR_ORIGIN.INFRASTRUCTURE
    && candidate['severity'] === ERROR_SEVERITY.MEDIUM
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined || isValidCacheErrorContext(candidate['details']))
  );
}

/**
 * Извлекает ключ кеша из CacheError
 * @param error - CacheError
 * @returns ключ кеша или undefined
 */
export function getCacheKey(error: CacheError): string | undefined {
  return error.details?.key;
}

/**
 * Извлекает информацию о соединении с кешем из CacheError
 * @param error - CacheError
 * @returns информация о соединении или undefined
 */
export function getCacheConnection(error: CacheError): {
  cacheType?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  connectionId?: string | undefined;
} | undefined {
  const details = error.details;
  if (!details) return undefined;

  return {
    cacheType: details.cacheType,
    host: details.host,
    port: details.port,
    connectionId: details.connectionId,
  };
}

/**
 * Извлекает операцию кеша из CacheError
 * @param error - CacheError
 * @returns операция или undefined
 */
export function getCacheOperation(error: CacheError): string | undefined {
  return error.details?.operation;
}

/**
 * Проверяет, является ли CacheError ошибкой соединения
 * @param error - CacheError
 * @returns true если ошибка связана с соединением
 */
export function isCacheConnectionError(error: CacheError): boolean {
  return (
    error.details?.host !== undefined
    || error.details?.connectionId !== undefined
  );
}
