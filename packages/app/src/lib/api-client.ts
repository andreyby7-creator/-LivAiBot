/**
 * @file packages/app/src/lib/api-client.ts
 *
 * Централизованный API-клиент для всех фронтенд-платформ.
 *
 * Архитектурная роль:
 * - Единая точка общения с backend/microservices.
 * - Полная изоляция транспорта (fetch, headers, tokens, errors).
 * - Совместим с Effect-подходом и retry/cancel логикой.
 * - Не содержит доменных зависимостей.
 *
 * ⚠️ Важно: НЕ устанавливает hard timeout — timeout живет только в orchestrator.
 * - Поддерживает AbortSignal для cancellation из orchestrator.
 * - Только HTTP transport (не знает про zod, не делает inline parse).
 *
 * Этот файл — «ворота» между UI/Features и распределённой системой.
 */

import { withLogging, withRetry } from './effect-utils.js';
import type { EffectContext, EffectError, EffectLogger } from './effect-utils.js';
import { infoFireAndForget, logFireAndForget } from './telemetry-runtime.js';
import type { ApiClientConfig, ApiError, ApiHeaders, ApiRequest } from '../types/api.js';

/* ============================================================================
 * 🧩 Внутренние типы и конфигурации
 * ========================================================================== */

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
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.retries = options.retries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /* ------------------------------------------------------------------------ */
  /**
   * Базовый универсальный HTTP-запрос.
   *
   * Используется всеми методами (get/post/put/delete).
   * Обёрнут в retry + tracing.
   *
   * ⚠️ Важно: НЕ устанавливает hard timeout — timeout живет только в orchestrator.
   * Поддерживает AbortSignal для cancellation из orchestrator.
   */
  /* ------------------------------------------------------------------------ */

  async request<TResponse, TBody = unknown>(
    req: ApiRequest<TBody>,
  ): Promise<TResponse> {
    const effect = async (): Promise<TResponse> => {
      const url = buildUrl(this.baseUrl, req.url);

      // Логируем исходящий HTTP запрос
      infoFireAndForget('HTTP request started', {
        url: req.url,
        method: req.method,
      });

      // Поддержка AbortSignal: из req.signal или из req.context (если это EffectContext)
      const abortSignal = req.signal ?? (req.context as EffectContext | undefined)?.abortSignal;

      const response = await this.fetchImpl(url, {
        method: req.method,
        headers: buildHeaders(this.defaultHeaders, req.headers),
        body: req.body !== undefined ? JSON.stringify(req.body) : null,
        ...(abortSignal && { signal: abortSignal }),
      });

      const data = await parseJsonSafe<TResponse>(response);

      if (!response.ok) {
        throw mapHttpError(response, data);
      }

      return data as TResponse;
    };

    // Только retry, без timeout (timeout только в orchestrator)
    const retryEffect = withRetry(effect, {
      retries: this.retries,
      delayMs: RETRY_DELAY_MS,
      shouldRetry: (error) => (error as EffectError).retriable ?? false,
    });

    // Добавляем tracing для observability
    const context: EffectContext = {
      source: 'ApiClient',
      description: `${req.method} ${req.url}`,
      ...(req.context?.traceId != null && { traceId: req.context.traceId }),
      ...(req.context?.locale != null && { locale: req.context.locale }),
      ...(req.context?.authToken != null && { authToken: req.context.authToken }),
      ...(req.context?.platform != null && { platform: req.context.platform }),
      ...(req.signal && { abortSignal: req.signal }),
      ...((req.context as EffectContext | undefined)?.abortSignal && {
        abortSignal: (req.context as EffectContext).abortSignal,
      }),
    };

    const tracedEffect = withLogging(retryEffect, createApiLogger(), context);

    return tracedEffect();
  }

  /* ============================================================================
   * 🌍 HTTP Shortcuts
   * ========================================================================== */

  get<TResponse>(
    url: string,
    headers?: ApiHeaders,
  ): Promise<TResponse> {
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
  ): Promise<TResponse> {
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
  ): Promise<TResponse> {
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
  ): Promise<TResponse> {
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
  ): Promise<TResponse> {
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
 *
 * ⚠️ Важно: timeoutMs из конфига игнорируется (оставлен для обратной совместимости) —
 * timeout живет только в orchestrator.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient({
    baseUrl: config.baseUrl,
    defaultHeaders: config.defaultHeaders ?? {},
    retries: config.retries ?? 2,
    ...(config.fetchImpl && { fetchImpl: config.fetchImpl }),
    // timeoutMs игнорируется — timeout только в orchestrator
  });
}
