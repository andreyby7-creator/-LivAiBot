/**
 * @file HttpAdapterTypes.ts
 * Типы транспортного уровня для HTTP-адаптера.
 *
 * ❗ Не содержит бизнес-логики
 * ❗ Не содержит side-effects
 * ❗ Не зависит от Effect / FP
 *
 * Предназначен для строгого, безопасного и расширяемого HTTP boundary.
 */

import type { LivAiErrorCode } from '../../../base/ErrorCode.js';

// ==================== БАЗОВЫЕ ДОМЕННЫЕ ПРИМИТИВЫ ====================

/** HTTP методы запроса - тайпсейфный enum для исключения опечаток */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
  CONNECT = 'CONNECT',
}

/**
 * Абсолютный HTTP URL (валидируется на boundary)
 *
 * @boundary-validation Гарантируется фабрикой {@link makeHttpUrl} в HttpAdapterFactories.ts
 * @throws Error при некорректном URL формате или пустой строке
 */
export type HttpUrl = string & { readonly __brand: 'HttpUrl'; };

/**
 * Таймаут в миллисекундах
 *
 * @boundary-validation Гарантируется фабрикой {@link makeTimeoutMs} в HttpAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 * @responsible Компонент, вызывающий фабрику, отвечает за TimeoutMs > 0
 */
export type TimeoutMs = number & { readonly __brand: 'TimeoutMs'; };

/**
 * Длительность операции в миллисекундах
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDurationMs} в HttpAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 */
export type DurationMs = number & { readonly __brand: 'DurationMs'; };

/**
 * Максимальное количество повторов
 *
 * @boundary-validation Гарантируется фабрикой {@link makeMaxRetries} в HttpAdapterFactories.ts
 * @throws Error при значениях вне диапазона 0-10 или нецелых числах
 */
export type MaxRetries = number & { readonly __brand: 'MaxRetries'; };

/**
 * Порог circuit breaker
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCircuitBreakerThreshold} в HttpAdapterFactories.ts
 * @throws Error при значениях вне диапазона 1-100 или нецелых числах
 */
export type CircuitBreakerThreshold = number & { readonly __brand: 'CircuitBreakerThreshold'; };

/** HTTP заголовки (immutable) */
export type HttpHeaders = Readonly<Record<string, string>>;

/** Значение query-параметра */
export type HttpQueryValue = string | number | boolean | null | undefined;

/** Query-параметры HTTP запроса */
export type HttpQueryParams = Readonly<Record<string, HttpQueryValue>>;

/** HTTP тело запроса */
export type HttpBody =
  | string
  | Uint8Array
  | Readonly<Record<string, unknown>>
  | null;

/**
 * Correlation ID для трекинга запросов
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCorrelationId} в HttpAdapterFactories.ts
 * @throws Error при пустой или не-string значении
 */
export type CorrelationId = string & { readonly __brand: 'CorrelationId'; };

// ==================== HTTP REQUEST / RESPONSE ====================

/** HTTP запрос (transport-level) */
export type HttpRequest = Readonly<{
  method: HttpMethod;
  url: HttpUrl;
  headers?: HttpHeaders;
  query?: HttpQueryParams;
  body?: HttpBody;
  timeoutMs?: TimeoutMs;
  signal?: AbortSignal;
}>;

/**
 * Код HTTP статуса ответа
 *
 * @boundary-validation Гарантируется фабрикой {@link makeHttpStatusCode} в HttpAdapterFactories.ts
 * @throws Error при значениях вне диапазона 100-599 или нецелых числах
 */
export type HttpStatusCode = number & { readonly __brand: 'HttpStatusCode'; };

/** HTTP ответ */
export type HttpResponse = Readonly<{
  statusCode: HttpStatusCode;
  headers: HttpHeaders;
  body: unknown;
  url: HttpUrl;
  durationMs: DurationMs;
}>;

// ==================== КОНФИГУРАЦИЯ HTTP АДАПТЕРА ====================

/** Опции HTTP адаптера */
export type HttpAdapterOptions = Readonly<{
  timeoutMs?: TimeoutMs;
  maxRetries?: MaxRetries;
  retryDelayMs?: TimeoutMs;
  circuitBreakerThreshold?: CircuitBreakerThreshold;
  circuitBreakerRecoveryMs?: TimeoutMs;
  circuitBreakerEnabled?: boolean;
  retriesEnabled?: boolean;
}>;

// ==================== CIRCUIT BREAKER ====================

/**
 * Ключ circuit breaker (host + method)
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCircuitBreakerKey} в HttpAdapterFactories.ts
 * @throws Error при пустой или не-string значении
 */
export type CircuitBreakerKey = string & { readonly __brand: 'CircuitBreakerKey'; };

/** Контекст circuit breaker для HTTP */
export type HttpCircuitContext = Readonly<{
  host: string;
  method: HttpMethod;
}>;

// ==================== РЕЗУЛЬТАТ ПРИМЕНЕНИЯ СТРАТЕГИИ ОБРАБОТКИ ОШИБОК ====================

/**
 * Решение стратегии обработки HTTP ошибки
 *
 * success — запрос успешен
 * retry   — можно повторить запрос
 * fail    — фатальная ошибка
 */
export type HttpStrategyDecision =
  | Readonly<{ type: 'success'; }>
  | Readonly<{
    type: 'retry';
    retryAfterMs?: TimeoutMs;
  }>
  | Readonly<{
    type: 'fail';
    errorCode: LivAiErrorCode;
    openCircuit?: boolean;
  }>;

// ==================== КОНТЕКСТ HTTP АДАПТЕРА ====================

/** Контекст HTTP адаптера для dependency injection */
export type HttpAdapterContext = Readonly<{
  baseUrl?: HttpUrl;
  defaultHeaders?: HttpHeaders;
  defaultTimeoutMs?: TimeoutMs;
}>;
