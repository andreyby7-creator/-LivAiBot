/**
 * @file HttpAdapter.ts - HTTP адаптер LivAiBot
 *
 * Boundary + side-effects компонент. НЕ нормализует ошибки, НЕ решает стратегии, НЕ содержит бизнес-логику.
 * ДЕЛАЕТ HTTP I/O, retry/timeout/circuit breaker, unknown → BaseError, применение стратегий.
 * Только Effect. Никаких throw.
 */

import type { Effect } from 'effect';

import { createConfig } from './HttpAdapterConfig.js';
import { httpAdapterEffect } from './HttpAdapterEffect.js';
import { httpAdapterFactories } from './HttpAdapterFactories.js';
import { HttpMethod } from './HttpAdapterTypes.js';

import type { HttpAdapterConfig } from './HttpAdapterConfig.js';
import type {
  CircuitBreaker,
  Clock,
  CorrelationIdService,
  HttpClient,
  Logger,
  Metrics,
} from './HttpAdapterEffect.js';
import type { HttpQueryParams, HttpRequest, HttpResponse, TimeoutMs } from './HttpAdapterTypes.js';

/** HTTP методы, которые имеют тело запроса */
const METHODS_WITH_BODY = new Set([HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH]);

/** HTTP Adapter интерфейс */
export type HttpAdapter = {
  /**
   * Выполняет HTTP запрос
   * @param request HTTP запрос
   * @param httpClient HTTP клиент
   * @param clock Clock сервис
   * @param logger Logger сервис
   * @param metrics Metrics сервис
   * @param correlationId CorrelationId сервис
   * @param circuitBreaker CircuitBreaker сервис
   * @returns Effect с результатом или ошибкой
   */
  request(
    request: HttpRequest,
    httpClient: HttpClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    correlationId: CorrelationIdService,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<HttpResponse, unknown, unknown>;
};

/** Реализация HTTP Adapter */
export class HttpAdapterImpl implements HttpAdapter {
  private readonly config: HttpAdapterConfig;

  constructor(config: Partial<HttpAdapterConfig> = {}) {
    this.config = createConfig(config);
  }

  request(
    request: HttpRequest,
    httpClient: HttpClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    correlationId: CorrelationIdService,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<HttpResponse, unknown, unknown> {
    // Передаем все сервисы явно через DI
    return httpAdapterEffect(
      request,
      this.config,
      httpClient,
      clock,
      logger,
      metrics,
      correlationId,
      circuitBreaker,
    );
  }
}

/** Создает HTTP Adapter с дефолтной конфигурацией */
export function createHttpAdapter(): HttpAdapter {
  return new HttpAdapterImpl();
}

/** Создает HTTP Adapter с кастомной конфигурацией */
export function createHttpAdapterWithConfig(config: Partial<HttpAdapterConfig>): HttpAdapter {
  return new HttpAdapterImpl(config);
}

/**
 * Универсальный хелпер для создания HTTP запросов с поддержкой всех методов
 *
 * Автоматически обрабатывает body сериализацию для методов с телом (POST, PUT, PATCH)
 *
 * @param method - HTTP метод
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param options - Опции запроса
 * @param options.body - Тело запроса для методов с body (автоматически сериализуется в JSON)
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
function createHttpRequest(
  method: HttpMethod,
  url: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  const baseRequest = {
    method,
    url: httpAdapterFactories.makeHttpUrl(url),
  };

  // Методы с телом: автоматически сериализуем body в JSON
  const hasBody = METHODS_WITH_BODY.has(method)
    && options.body !== undefined
    && options.body !== null;

  let result: HttpRequest = {
    ...baseRequest,
    ...(options.query !== undefined && { query: options.query }),
    ...(options.timeout !== undefined && { timeoutMs: options.timeout }),
  };

  if (hasBody) {
    result = {
      ...result,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.body),
    };
  } else if (options.headers !== undefined) {
    result = {
      ...result,
      headers: options.headers,
    };
  }

  return result;
}

/**
 * Утилита для создания HTTP GET запроса
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createGetRequest(
  url: string,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.GET, url, options);
}

/**
 * Утилита для создания HTTP POST запроса
 *
 * Body автоматически сериализуется в JSON с Content-Type: application/json
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param body - Тело запроса (сериализуется в JSON)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createPostRequest(
  url: string,
  body?: unknown,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.POST, url, { body, ...options });
}

/**
 * Утилита для создания HTTP PUT запроса
 *
 * Body автоматически сериализуется в JSON с Content-Type: application/json
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param body - Тело запроса (сериализуется в JSON)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createPutRequest(
  url: string,
  body?: unknown,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.PUT, url, { body, ...options });
}

/**
 * Утилита для создания HTTP DELETE запроса
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createDeleteRequest(
  url: string,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.DELETE, url, options);
}

/**
 * Утилита для создания HTTP PATCH запроса
 *
 * Body автоматически сериализуется в JSON с Content-Type: application/json
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param body - Тело запроса (сериализуется в JSON)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createPatchRequest(
  url: string,
  body?: unknown,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.PATCH, url, { body, ...options });
}

/**
 * Утилита для создания HTTP HEAD запроса
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createHeadRequest(
  url: string,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.HEAD, url, options);
}

/**
 * Утилита для создания HTTP OPTIONS запроса
 *
 * @param url - URL строки (конвертируется в HttpUrl branded type)
 * @param options - Опции запроса
 * @param options.headers - HTTP заголовки
 * @param options.query - Query параметры (HttpQueryParams branded type)
 * @param options.timeout - Таймаут (TimeoutMs branded type)
 * @returns HttpRequest с валидированными branded types
 */
export function createOptionsRequest(
  url: string,
  options: {
    headers?: Record<string, string>;
    query?: HttpQueryParams;
    timeout?: TimeoutMs;
  } = {},
): HttpRequest {
  return createHttpRequest(HttpMethod.OPTIONS, url, options);
}
