/**
 * @file HTTP нормализатор ошибок для LivAiBot
 *
 * Чистая функция нормализации HTTP ошибок. Преобразует неизвестные HTTP ошибки
 * в стандартизированные TaggedError типы с извлечением метаданных.
 *
 * Поддерживает HTTP Response и Error объекты от различных библиотек (axios, fetch, node-fetch).
 */

import { LIVAI_ERROR_CODES } from '../../base/ErrorCode.js';
import { createNetworkError } from '../infrastructure/NetworkError.js';

import type { NetworkError } from '../infrastructure/NetworkError.js';
import type { SharedAdapterError } from '../SharedErrorTypes.js';

/** HTTP status codes */
const HTTP_STATUS_CODES = {
  // 1xx Informational
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,

  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,

  // 3xx Redirection
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,

  // 4xx Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,

  // 5xx Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

/** Входные данные HTTP ошибки */
export type HttpErrorInput = unknown;

/** Результат нормализации HTTP ошибки */
export type HttpNormalizationResult = NetworkError | SharedAdapterError<Record<string, unknown>>;

/** Контекст HTTP запроса */
export type HttpRequestContext = {
  readonly url?: string;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly responseBody?: unknown;
  readonly timeout?: number;
  readonly userAgent?: string;
};

/** Создает HttpRequestContext с валидными значениями */
function createHttpRequestContext(values: Record<string, unknown>): HttpRequestContext {
  const filtered = Object.fromEntries(
    Object.entries(values).filter((entry) => entry[1] != null),
  );
  return filtered as HttpRequestContext;
}

/** Проверка объекта */
const isObject = (obj: unknown): obj is Record<string, unknown> =>
  typeof obj === 'object' && obj !== null;

/** Helper для извлечения status code из различных полей */
function extractStatusCode(input: Record<string, unknown>): number | undefined {
  if (typeof input['statusCode'] === 'number' && isValidStatusCode(input['statusCode'])) {
    return input['statusCode'];
  }
  if (typeof input['status'] === 'number' && isValidStatusCode(input['status'])) {
    return input['status'];
  }
  return undefined;
}

/** Проверяет, является ли статус код валидным */
function isValidStatusCode(code: number): boolean {
  return Number.isInteger(code)
    && code >= HTTP_STATUS_CODES.CONTINUE
    && code <= HTTP_STATUS_CODES.NETWORK_AUTHENTICATION_REQUIRED;
}

/** Helper для извлечения status text из различных полей */
function extractStatusText(input: Record<string, unknown>): string | undefined {
  if (typeof input['statusText'] === 'string') return input['statusText'];
  if (typeof input['statusMessage'] === 'string') return input['statusMessage'];
  return undefined;
}

/** Универсальный extractor для HTTP ошибок */
function extractContext(input: unknown): HttpRequestContext | undefined {
  if (!isObject(input)) return undefined;

  let values: Record<string, unknown> = {};

  // Response-like object
  if (
    'url' in input
    && typeof input['url'] === 'string'
    && 'status' in input
    && typeof input['status'] === 'number'
  ) {
    const resp = input;
    values = { ...values, url: resp['url'] as string };
    values = { ...values, statusCode: resp['status'] as number };
    if (typeof resp['statusText'] === 'string') {
      values = { ...values, statusText: resp['statusText'] };
    }
    if (typeof resp['method'] === 'string') values = { ...values, method: resp['method'] };
    if (typeof resp['timeout'] === 'number') values = { ...values, timeout: resp['timeout'] };

    let headers: Record<string, string> = {};
    if (isObject(resp['headers'])) {
      for (const [k, v] of Object.entries(resp['headers'])) {
        if (typeof v === 'string') {
          headers = { ...headers, [k.toLowerCase()]: v };
        } else if (Array.isArray(v)) {
          // Handle array headers (e.g., Set-Cookie)
          headers = { ...headers, [k.toLowerCase()]: v.join(', ') };
        } else if (v != null) {
          // Coerce other types to string
          headers = { ...headers, [k.toLowerCase()]: String(v) };
        }
      }
    }
    if (Object.keys(headers).length > 0) {
      values = { ...values, headers };
      if (headers['user-agent'] != null) values = { ...values, userAgent: headers['user-agent'] };
    }

    const body = resp['body'] ?? resp['data'];
    if (body !== undefined) values = { ...values, responseBody: body };

    return createHttpRequestContext(values);
  }

  // Error-like object
  if ('statusCode' in input || 'status' in input || 'response' in input || 'request' in input) {
    const statusCode = extractStatusCode(input);
    if (statusCode != null) values = { ...values, statusCode };

    const statusText = extractStatusText(input);
    if (statusText != null) values = { ...values, statusText };

    if (isObject(input['request'])) {
      if (typeof input['request']['url'] === 'string') {
        values = { ...values, url: input['request']['url'] };
      }
      if (typeof input['request']['method'] === 'string') {
        values = { ...values, method: input['request']['method'] };
      }
    }
    if (typeof input['url'] === 'string') values = { ...values, url: input['url'] };
    if (typeof input['method'] === 'string') values = { ...values, method: input['method'] };
    if (typeof input['timeout'] === 'number') values = { ...values, timeout: input['timeout'] };

    if (isObject(input['response'])) {
      values = { ...values, responseBody: input['response']['body'] ?? input['response']['data'] };
    }

    return createHttpRequestContext(values);
  }

  return undefined;
}

/** Проверяет валидность HTTP status code */
function isValidHttpStatusCode(statusCode: number): boolean {
  return Number.isInteger(statusCode)
    && statusCode >= HTTP_STATUS_CODES.CONTINUE
    && statusCode <= HTTP_STATUS_CODES.NETWORK_AUTHENTICATION_REQUIRED;
}

/** Категоризация HTTP ошибки по статус коду */
function categorizeHttpError(statusCode: number): 'client' | 'server' | 'unknown' {
  if (
    statusCode >= HTTP_STATUS_CODES.BAD_REQUEST
    && statusCode < HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
  ) return 'client';
  if (
    statusCode >= HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    && statusCode <= HTTP_STATUS_CODES.NETWORK_AUTHENTICATION_REQUIRED
  ) return 'server';
  return 'unknown';
}

/** Маппинг HTTP status code на LIVAI error codes */
function mapHttpStatusToErrorCode(statusCode: number): string {
  switch (statusCode) {
    case HTTP_STATUS_CODES.BAD_REQUEST:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_BAD_REQUEST;
    case HTTP_STATUS_CODES.UNAUTHORIZED:
    case HTTP_STATUS_CODES.FORBIDDEN:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_AUTH_FAILED;
    case HTTP_STATUS_CODES.NOT_FOUND:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_NOT_FOUND;
    case HTTP_STATUS_CODES.METHOD_NOT_ALLOWED:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_METHOD_NOT_ALLOWED;
    case HTTP_STATUS_CODES.REQUEST_TIMEOUT:
      return LIVAI_ERROR_CODES.INFRA_NETWORK_TIMEOUT;
    case HTTP_STATUS_CODES.CONFLICT:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_CONFLICT;
    case HTTP_STATUS_CODES.GONE:
    case HTTP_STATUS_CODES.URI_TOO_LONG:
    case HTTP_STATUS_CODES.INSUFFICIENT_STORAGE:
    case HTTP_STATUS_CODES.LOOP_DETECTED:
      return LIVAI_ERROR_CODES.INFRA_NETWORK_CONNECTION_REFUSED;
    case HTTP_STATUS_CODES.PAYLOAD_TOO_LARGE:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_PAYLOAD_TOO_LARGE;
    case HTTP_STATUS_CODES.UNSUPPORTED_MEDIA_TYPE:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_UNSUPPORTED_MEDIA_TYPE;
    case HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_VALIDATION_FAILED;
    case HTTP_STATUS_CODES.TOO_MANY_REQUESTS:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_RATE_LIMIT;
    case HTTP_STATUS_CODES.UNAVAILABLE_FOR_LEGAL_REASONS:
    case HTTP_STATUS_CODES.NOT_EXTENDED:
    case HTTP_STATUS_CODES.NETWORK_AUTHENTICATION_REQUIRED:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_AUTH_FAILED;
    case HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR:
    case HTTP_STATUS_CODES.NOT_IMPLEMENTED:
    case HTTP_STATUS_CODES.HTTP_VERSION_NOT_SUPPORTED:
      return LIVAI_ERROR_CODES.INFRA_NETWORK_SSL_ERROR;
    case HTTP_STATUS_CODES.BAD_GATEWAY:
      return LIVAI_ERROR_CODES.INFRA_NETWORK_DNS_FAILED;
    case HTTP_STATUS_CODES.SERVICE_UNAVAILABLE:
      return LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_UNAVAILABLE;
    case HTTP_STATUS_CODES.GATEWAY_TIMEOUT:
      return LIVAI_ERROR_CODES.INFRA_NETWORK_TIMEOUT;
    default: {
      const category = categorizeHttpError(statusCode);
      if (category === 'client') return LIVAI_ERROR_CODES.INFRA_NETWORK_CONNECTION_REFUSED;
      if (category === 'server') return LIVAI_ERROR_CODES.INFRA_NETWORK_TIMEOUT;
      return LIVAI_ERROR_CODES.INFRA_NETWORK_DNS_FAILED;
    }
  }
}

/** Создает NetworkError из HttpRequestContext */
function createNetworkErrorFromContext(context: HttpRequestContext): NetworkError {
  const statusCode = context.statusCode;
  const message = statusCode != null
    ? `HTTP ${statusCode}${context.statusText != null ? ` ${context.statusText}` : ''}`
    : 'HTTP request failed'; // HTTP запрос завершен неудачей
  const code = statusCode != null
    ? mapHttpStatusToErrorCode(statusCode)
    : LIVAI_ERROR_CODES.INFRA_NETWORK_SSL_ERROR;
  return createNetworkError(code, message, Object.keys(context).length > 0 ? context : undefined);
}

/** Создает SharedAdapterError для инфраструктурных HTTP проблем */
function createAdapterError(
  message: string,
  context: HttpRequestContext,
): SharedAdapterError<Record<string, unknown>> {
  return {
    _tag: 'SharedAdapterError',
    category: 'adapter',
    code: 'SHARED_INFRA_HTTP_ADAPTER_ERROR',
    message,
    details: { ...context },
  };
}

/** Нормализует HTTP ошибку */
export function normalizeHttpError(input: HttpErrorInput): HttpNormalizationResult {
  const context = extractContext(input);

  if (context?.statusCode != null && isValidHttpStatusCode(context.statusCode)) {
    return createNetworkErrorFromContext(context);
  }
  if (context) return createAdapterError('HTTP request failed without valid status code', context); // HTTP запрос завершен без валидного статус кода

  const errorMessage = isObject(input) && 'message' in input
    ? String(input['message'])
    : 'Unknown HTTP error'; // Неизвестная HTTP ошибка
  return createAdapterError(errorMessage, createHttpRequestContext({ responseBody: input }));
}

/** Type guards */
export function isHttpNetworkError(result: HttpNormalizationResult): result is NetworkError {
  return result._tag === 'NetworkError';
}

export function isHttpAdapterError(
  result: HttpNormalizationResult,
): result is SharedAdapterError<Record<string, unknown>> {
  return result._tag === 'SharedAdapterError';
}

/** Извлекает HTTP статус код */
export function extractHttpStatusCode(result: HttpNormalizationResult): number | undefined {
  if (isHttpNetworkError(result)) return result.details?.statusCode;
  if (isHttpAdapterError(result)) {
    const details = result.details;
    return details && typeof details['statusCode'] === 'number' ? details['statusCode'] : undefined;
  }
  return undefined;
}

/** Извлекает HTTP URL */
export function extractHttpUrl(result: HttpNormalizationResult): string | undefined {
  if (isHttpNetworkError(result)) return result.details?.url;
  if (isHttpAdapterError(result)) {
    const details = result.details;
    return details && typeof details['url'] === 'string' ? details['url'] : undefined;
  }
  return undefined;
}

// Экспорт для тестирования
export { createHttpRequestContext };
