/**
 * @file packages/app/src/lib/api-client.ts
 *
 * Централизованный API-клиент для всех фронтенд-платформ.
 *
 * Архитектурная роль:
 * - Единая точка общения с backend/microservices.
 * - Полная изоляция транспорта (fetch, headers, tokens, errors).
 * - Совместим с Effect-подходом и retry/timeout/cancel логикой.
 * - Не содержит доменных зависимостей.
 *
 * Этот файл — «ворота» между UI/Features и распределённой системой.
 */

import { withLogging, withRetry, withTimeout } from './effect-utils.js';
import type { EffectError, EffectLogger } from './effect-utils.js';
import { infoFireAndForget, logFireAndForget } from './telemetry.js';
import type {
  ApiClientConfig,
  ApiError,
  ApiHeaders,
  ApiRequest,
  ApiResponse,
} from '../types/api.js';

/* ============================================================================
 * 🧩 Внутренние типы и конфигурации
 * ========================================================================== */

const DEFAULT_TIMEOUT_MS = 15_000;
const SERVER_ERROR_STATUS_MIN = 500;
const RETRY_DELAY_MS = 1000;

/**
 * Создаёт логгер для API запросов.
 * Интегрируется с системой телеметрии.
 */
function createApiLogger(): EffectLogger {
  return {
    onStart: (context): void => {
      infoFireAndForget('API request started', {
        source: context?.source ?? 'unknown',
        description: context?.description ?? 'unknown',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
    onSuccess: (durationMs, context): void => {
      logFireAndForget('INFO', 'API request completed', {
        durationMs,
        source: context?.source ?? 'unknown',
        description: context?.description ?? 'unknown',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
    onError: (error, context): void => {
      logFireAndForget('ERROR', 'API request failed', {
        error: error instanceof Error ? error.message : String(error),
        source: context?.source ?? 'unknown',
        description: context?.description ?? 'unknown',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
  };
}

export type ApiClientOptions = {
  baseUrl: string;
  defaultHeaders?: ApiHeaders;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
};

/* ============================================================================
 * 🧠 Вспомогательные утилиты (экспортированы для тестирования)
 * ========================================================================== */

export function buildUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http')) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function buildHeaders(
  base: ApiHeaders = {},
  override: ApiHeaders = {},
): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...base,
    ...override,
  };
}

export async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    // Для ошибочных ответов пустое тело - это потеря информации
    if (!response.ok) {
      throw new Error(`Empty response body for error status ${response.status}`);
    }
    return null;
  }
  return JSON.parse(text) as T;
}

/* ============================================================================
 * 🚨 Ошибки API
 * ========================================================================== */

export function mapHttpError(
  response: Response,
  body: unknown,
): EffectError<ApiError> {
  const isServerError = response.status >= SERVER_ERROR_STATUS_MIN;

  // Логируем HTTP ошибки для observability
  const level = isServerError ? 'ERROR' : 'WARN';

  logFireAndForget(level, 'HTTP request failed', {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
  });

  return {
    kind: 'ApiError',
    status: response.status,
    message: response.statusText,
    payload: body as ApiError,
    retriable: isServerError,
  };
}

/* ============================================================================
 * 🚀 Реализация API-клиента
 * ========================================================================== */

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: ApiHeaders;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /* ------------------------------------------------------------------------ */
  /**
   * Базовый универсальный HTTP-запрос.
   *
   * Используется всеми методами (get/post/put/delete).
   * Обёрнут в retry + timeout + tracing.
   */
  /* ------------------------------------------------------------------------ */

  async request<TResponse, TBody = unknown>(
    req: ApiRequest<TBody>,
  ): Promise<ApiResponse<TResponse>> {
    const effect = async (): Promise<ApiResponse<TResponse>> => {
      const url = buildUrl(this.baseUrl, req.url);

      // Логируем исходящий HTTP запрос
      infoFireAndForget('HTTP request started', {
        url: req.url,
        method: req.method,
      });

      const response = await this.fetchImpl(url, {
        method: req.method,
        headers: buildHeaders(this.defaultHeaders, req.headers),
        body: req.body !== undefined ? JSON.stringify(req.body) : null,
        ...(req.signal && { signal: req.signal }),
      });

      const data = await parseJsonSafe<TResponse>(response);

      if (!response.ok) {
        throw mapHttpError(response, data);
      }

      return {
        success: true,
        data: data as TResponse,
      };
    };

    const retryEffect = withRetry(
      withTimeout(effect, this.timeoutMs),
      {
        retries: this.retries,
        delayMs: RETRY_DELAY_MS,
        shouldRetry: (error) => (error as EffectError).retriable ?? false,
      },
    );

    // Добавляем tracing для observability
    const tracedEffect = withLogging(
      retryEffect,
      createApiLogger(),
      {
        source: 'ApiClient',
        description: `${req.method} ${req.url}`,
        ...(req.context?.traceId != null && { traceId: req.context.traceId }),
      },
    );

    return tracedEffect();
  }

  /* ============================================================================
   * 🌍 HTTP Shortcuts
   * ========================================================================== */

  get<TResponse>(
    url: string,
    headers?: ApiHeaders,
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>({
      method: 'GET',
      url,
      headers: headers ?? {},
    });
  }

  post<TBody, TResponse>(
    url: string,
    body: TBody,
    headers?: ApiHeaders,
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: 'POST',
      url,
      body,
      headers: headers ?? {},
    });
  }

  put<TBody, TResponse>(
    url: string,
    body: TBody,
    headers?: ApiHeaders,
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: 'PUT',
      url,
      body,
      headers: headers ?? {},
    });
  }

  patch<TBody, TResponse>(
    url: string,
    body: TBody,
    headers?: ApiHeaders,
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: 'PATCH',
      url,
      body,
      headers: headers ?? {},
    });
  }

  delete<TResponse>(
    url: string,
    headers?: ApiHeaders,
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>({
      method: 'DELETE',
      url,
      headers: headers ?? {},
    });
  }
}

/* ============================================================================
 * 🏗 Фабрика клиента
 * ========================================================================== */

/**
 * Создание стандартного API-клиента приложения.
 * Используется в app layer, DI контейнерах, тестах и сторе.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient({
    baseUrl: config.baseUrl,
    defaultHeaders: config.defaultHeaders ?? {},
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: config.retries ?? 2,
    ...(config.fetchImpl && { fetchImpl: config.fetchImpl }),
  });
}
