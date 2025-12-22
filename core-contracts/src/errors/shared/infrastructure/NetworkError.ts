/**
 * @file NetworkError.ts - Сетевые ошибки LivAiBot
 *
 * TaggedError типы для сетевых ошибок.
 * Pure mapping от внешних сетевых ошибок к BaseError через ErrorBuilders.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';

/**
 * Контекст сетевой ошибки с дополнительными полями
 */
export type NetworkErrorContext = {
  /** URL запроса */
  readonly url?: string;
  /** HTTP метод (GET, POST, PUT, DELETE) */
  readonly method?: string;
  /** HTTP статус код */
  readonly statusCode?: number;
  /** Время ожидания в мс */
  readonly timeout?: number;
  /** Размер ответа в байтах */
  readonly responseSize?: number;
  /** Тело ответа */
  readonly responseBody?: unknown;
  /** User-Agent */
  readonly userAgent?: string;
  /** HTTP headers */
  readonly headers?: Record<string, string>;
  /** IP адрес назначения */
  readonly remoteAddress?: string;
  /** Порт назначения */
  readonly remotePort?: number;
  /** Локальный IP адрес */
  readonly localAddress?: string;
  /** Локальный порт */
  readonly localPort?: number;
  /** Тип соединения (http, https, tcp, udp) */
  readonly connectionType?: string;
};

/**
 * TaggedError тип для сетевых ошибок
 */
export type NetworkError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.TECHNICAL;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.HIGH;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: NetworkErrorContext;
  readonly timestamp: string;
}, 'NetworkError'>;

/**
 * Создает NetworkError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст сетевой ошибки
 * @param timestamp - опциональный timestamp для тестов
 * @returns NetworkError
 */
export function createNetworkError(
  code: ErrorCode,
  message: string,
  context?: NetworkErrorContext,
  timestamp?: string,
): NetworkError {
  return {
    _tag: 'NetworkError',
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.HIGH,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as NetworkError;
}

/**
 * Проверяет, является ли объект допустимым NetworkErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует NetworkErrorContext
 */
export function isValidNetworkErrorContext(context: unknown): context is NetworkErrorContext {
  if (context == null || typeof context !== 'object' || Array.isArray(context)) return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем опциональные поля NetworkErrorContext
  if (ctx['url'] !== undefined && typeof ctx['url'] !== 'string') return false;
  if (ctx['method'] !== undefined && typeof ctx['method'] !== 'string') return false;
  if (
    ctx['statusCode'] !== undefined
    && (typeof ctx['statusCode'] !== 'number' || !Number.isInteger(ctx['statusCode']))
  ) return false;
  if (
    ctx['timeout'] !== undefined
    && (typeof ctx['timeout'] !== 'number' || !Number.isInteger(ctx['timeout']))
  ) return false;
  if (
    ctx['responseSize'] !== undefined
    && (typeof ctx['responseSize'] !== 'number' || !Number.isInteger(ctx['responseSize']))
  ) return false;
  if (ctx['userAgent'] !== undefined && typeof ctx['userAgent'] !== 'string') return false;
  if (ctx['remoteAddress'] !== undefined && typeof ctx['remoteAddress'] !== 'string') return false;
  if (
    ctx['remotePort'] !== undefined
    && (typeof ctx['remotePort'] !== 'number' || !Number.isInteger(ctx['remotePort']))
  ) return false;
  if (ctx['localAddress'] !== undefined && typeof ctx['localAddress'] !== 'string') return false;
  if (
    ctx['localPort'] !== undefined
    && (typeof ctx['localPort'] !== 'number' || !Number.isInteger(ctx['localPort']))
  ) return false;
  if (ctx['connectionType'] !== undefined && typeof ctx['connectionType'] !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard для проверки, является ли ошибка NetworkError
 * @param error - ошибка для проверки
 * @returns true если это NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'NetworkError'
    && candidate['category'] === ERROR_CATEGORY.TECHNICAL
    && candidate['origin'] === ERROR_ORIGIN.INFRASTRUCTURE
    && candidate['severity'] === ERROR_SEVERITY.HIGH
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined || isValidNetworkErrorContext(candidate['details']))
  );
}

/**
 * Извлекает URL из NetworkError
 * @param error - NetworkError
 * @returns URL или undefined
 */
export function getNetworkUrl(error: NetworkError): string | undefined {
  return error.details?.url;
}

/**
 * Извлекает информацию о HTTP запросе из NetworkError
 * @param error - NetworkError
 * @returns информация о запросе или undefined
 */
export function getHttpRequestInfo(error: NetworkError): {
  method?: string | undefined;
  statusCode?: number | undefined;
  userAgent?: string | undefined;
} | undefined {
  const details = error.details;
  if (!details) return undefined;

  return {
    method: details.method,
    statusCode: details.statusCode,
    userAgent: details.userAgent,
  };
}

/**
 * Извлекает информацию о сетевом соединении из NetworkError
 * @param error - NetworkError
 * @returns информация о соединении или undefined
 */
export function getNetworkConnection(error: NetworkError): {
  remoteAddress?: string | undefined;
  remotePort?: number | undefined;
  localAddress?: string | undefined;
  localPort?: number | undefined;
  connectionType?: string | undefined;
} | undefined {
  const details = error.details;
  if (!details) return undefined;

  return {
    remoteAddress: details.remoteAddress,
    remotePort: details.remotePort,
    localAddress: details.localAddress,
    localPort: details.localPort,
    connectionType: details.connectionType,
  };
}

/**
 * Проверяет, является ли NetworkError ошибкой таймаута
 * @param error - NetworkError
 * @returns true если это ошибка таймаута
 */
export function isTimeoutError(error: NetworkError): boolean {
  return error.details?.timeout !== undefined;
}

/**
 * Проверяет, является ли NetworkError HTTP-ошибкой
 * @param error - NetworkError
 * @returns true если это HTTP-ошибка
 */
export function isHttpError(error: NetworkError): boolean {
  return error.details?.statusCode !== undefined;
}
