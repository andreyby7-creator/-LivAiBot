/**
 * @file packages/app/src/lib/api-client.ts
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
const BEARER_PREFIX_LENGTH = 7; // "Bearer ".length

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
      // Логируем HTTP ошибки для observability (вынесено из mapHttpError для чистоты)
      const isApiError = error !== null
        && typeof error === 'object'
        && 'kind' in error
        && error.kind === 'ApiError';
      const apiError = isApiError ? (error as EffectError<ApiError>) : null;
      const level = apiError !== null
          && typeof apiError.status === 'number'
          && apiError.status >= SERVER_ERROR_STATUS_MIN
        ? 'ERROR'
        : 'WARN';

      logFireAndForget(level, 'API request failed', {
        error: error instanceof Error ? error.message : String(error),
        source: context?.source ?? 'unknown',
        description: context?.description ?? 'unknown',
        ...(context?.traceId != null && { traceId: context.traceId }),
        ...(apiError !== null && typeof apiError.status === 'number' && {
          status: apiError.status,
          ...(apiError.message !== '' && { statusText: apiError.message }),
        }),
      });
    },
  };
}

export type ApiClientOptions = {
  baseUrl: string;
  defaultHeaders?: ApiHeaders;
  retries?: number;
  fetchImpl?: typeof fetch;
  /**
   * Адаптер для получения access token из feature-auth store.
   * @remarks
   * - Если предоставлен, токен автоматически добавляется в Authorization header.
   * - Поддерживает async получение токенов для SSR (например, fetch из secure memory).
   * - Если токены хранятся в httpOnly cookies, адаптер может не использоваться
   *   (браузер отправляет cookies автоматически).
   * - HTTP-клиент НЕ подписывается напрямую на Zustand-store; доступ к токенам
   *   идёт только через адаптер/порт (функции app-слоя).
   */
  readonly getAccessToken?: () => Promise<string | null>;
  /**
   * Политика повторных попыток для обработки ошибок.
   * @remarks
   * - Если не предоставлена, используется дефолтная логика: retriable из EffectError.
   * - Позволяет кастомизировать retry логику (429, rate limits, exponential backoff и т.д.).
   */
  readonly retryPolicy?: (error: unknown) => boolean;
  /**
   * Хук для трансформации запроса перед отправкой.
   * @remarks
   * - Позволяет модифицировать RequestInit перед fetch (например, добавить correlation ID).
   */
  readonly beforeRequest?: (init: RequestInit) => RequestInit;
  /**
   * Хук для трансформации ответа после получения.
   * @remarks
   * - Позволяет модифицировать Response перед парсингом (например, логирование метрик).
   * - ⚠️ Важно: hook НЕ должен потреблять body (не вызывать response.text(), response.json() и т.д.).
   *   Если нужно прочитать body, используйте response.clone() перед вызовом hook.
   * - Response клонируется автоматически перед передачей в hook для безопасности.
   */
  readonly afterResponse?: (response: Response) => Response;
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

/**
 * Парсит JSON из Response с консистентной обработкой ошибок.
 * @remarks
 * - Transport должен быть консистентен в error shape.
 * - Если JSON.parse упадёт, бросается ApiError (не обычная Error).
 */
export async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    // Для ошибочных ответов пустое тело - это потеря информации
    if (!response.ok) {
      throw {
        kind: 'ApiError' as const,
        status: response.status,
        message: `Empty response body for error status ${response.status}`,
        payload: null,
        retriable: response.status >= SERVER_ERROR_STATUS_MIN,
      };
    }
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Transport должен быть консистентен в error shape (унифицирован с mapHttpError)
    throw {
      kind: 'ApiError' as const,
      status: response.status,
      message: 'Invalid JSON response',
      payload: null,
      retriable: false,
    };
  }
}

/* ============================================================================
 * 🚨 Ошибки API
 * ========================================================================== */

/**
 * Маппинг HTTP ошибок в EffectError.
 * @remarks
 * - Pure функция без side-effects (логирование вынесено в logger).
 * - Детерминированная: одинаковый response → одинаковый результат.
 */
export function mapHttpError(
  response: Response,
  body: unknown,
): EffectError<ApiError> {
  const isServerError = response.status >= SERVER_ERROR_STATUS_MIN;

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
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;
  private readonly retryPolicy: ((error: unknown) => boolean) | undefined;
  private readonly beforeRequest: ((init: RequestInit) => RequestInit) | undefined;
  private readonly afterResponse: ((response: Response) => Response) | undefined;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.retries = options.retries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.getAccessToken = options.getAccessToken;
    this.retryPolicy = options.retryPolicy;
    this.beforeRequest = options.beforeRequest;
    this.afterResponse = options.afterResponse;
  }

  /* ------------------------------------------------------------------------ */
  /**
   * Базовый универсальный HTTP-запрос.
   * Используется всеми методами (get/post/put/delete).
   * Обёрнут в retry + tracing.
   * ⚠️ Важно: НЕ устанавливает hard timeout — timeout живет только в orchestrator.
   * Поддерживает AbortSignal для cancellation из orchestrator.
   */
  /* ------------------------------------------------------------------------ */

  /**
   * Разрешает access token для запроса.
   * @remarks
   * - Зафиксирован один раз на request (детерминированность).
   * - Приоритет: explicit Authorization header > адаптер из DI.
   * - Инвариант: HTTP-клиент НЕ подписывается напрямую на Zustand-store.
   * - Security: НЕ используем req.context.authToken (скрытый канал, может обойти auth-adapter).
   *   Используем только явный Authorization header или адаптер (единый источник правды).
   */
  private async resolveAccessToken(req: ApiRequest<unknown>): Promise<string | null> {
    // Приоритет: explicit Authorization header > адаптер из DI
    // Security: используем только явный header, не скрытый канал через context
    // Production-safe: обрабатываем разные регистры (Authorization, authorization, AUTHORIZATION)
    const explicitAuthHeader = req.headers?.['Authorization'] ?? req.headers?.['authorization'];
    if (explicitAuthHeader !== undefined && explicitAuthHeader !== '') {
      // Извлекаем токен из "Bearer <token>" или используем как есть
      if (explicitAuthHeader.startsWith('Bearer ')) {
        return explicitAuthHeader.slice(BEARER_PREFIX_LENGTH);
      }
      return explicitAuthHeader;
    }

    if (this.getAccessToken !== undefined) {
      return this.getAccessToken();
    }

    return null;
  }

  /**
   * Строит RequestInit для fetch.
   * @remarks
   * - Обрабатывает FormData, string и object body.
   * - Добавляет Authorization header если токен доступен.
   * - Применяет beforeRequest hook если предоставлен.
   */
  private buildRequestInit<TBody>(
    req: ApiRequest<TBody>,
    accessToken: string | null,
  ): RequestInit {
    // Поддержка AbortSignal: из req.signal или из req.context (если это EffectContext)
    const abortSignal = req.signal ?? (req.context as EffectContext | undefined)?.abortSignal;

    // Формируем заголовки с Authorization, если токен доступен
    const headersWithAuth: ApiHeaders = {
      ...this.defaultHeaders,
      ...req.headers,
      ...(accessToken !== null && { Authorization: `Bearer ${accessToken}` }),
    };

    // Обрабатываем body: FormData/string не сериализуем через JSON.stringify
    let body: BodyInit | null = null;
    if (req.body !== undefined) {
      if (req.body instanceof FormData || typeof req.body === 'string') {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers: buildHeaders({}, headersWithAuth),
      body,
      ...(abortSignal && { signal: abortSignal }),
    };

    // Применяем beforeRequest hook если предоставлен
    return this.beforeRequest ? this.beforeRequest(init) : init;
  }

  async request<TResponse, TBody = unknown>(
    req: ApiRequest<TBody>,
  ): Promise<TResponse> {
    // Зафиксировать токен один раз на request (детерминированность, избегаем race conditions при retry)
    const resolvedToken = await this.resolveAccessToken(req);

    const effect = async (): Promise<TResponse> => {
      const url = buildUrl(this.baseUrl, req.url);

      // Логируем исходящий HTTP запрос
      infoFireAndForget('HTTP request started', {
        url: req.url,
        method: req.method,
      });

      const requestInit = this.buildRequestInit(req, resolvedToken);

      let response = await this.fetchImpl(url, requestInit);

      // Применяем afterResponse hook если предоставлен
      // ⚠️ Security: клонируем response перед передачей в hook, чтобы избежать потребления body
      // Hook не должен потреблять body (не вызывать response.text(), response.json() и т.д.)
      if (this.afterResponse) {
        response = this.afterResponse(response.clone());
      }

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
      shouldRetry: (error) => {
        // Используем кастомную retry policy если предоставлена, иначе дефолтная логика
        if (this.retryPolicy) {
          return this.retryPolicy(error);
        }
        return (error as EffectError).retriable ?? false;
      },
    });

    // Добавляем tracing для observability
    // ⚠️ Security: НЕ передаём authToken в tracing context (может утечь в telemetry)
    const context: EffectContext = {
      source: 'ApiClient',
      description: `${req.method} ${req.url}`,
      ...(req.context?.traceId != null && { traceId: req.context.traceId }),
      ...(req.context?.locale != null && { locale: req.context.locale }),
      // authToken НЕ передаём в context (security: может утечь в telemetry)
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
 * ⚠️ Важно: timeoutMs из конфига игнорируется (оставлен для обратной совместимости) —
 * timeout живет только в orchestrator.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient({
    baseUrl: config.baseUrl,
    defaultHeaders: config.defaultHeaders ?? {},
    retries: config.retries ?? 2,
    ...(config.fetchImpl && { fetchImpl: config.fetchImpl }),
    ...(config.getAccessToken && { getAccessToken: config.getAccessToken }),
    ...(config.retryPolicy && { retryPolicy: config.retryPolicy }),
    ...(config.beforeRequest && { beforeRequest: config.beforeRequest }),
    ...(config.afterResponse && { afterResponse: config.afterResponse }),
    // timeoutMs игнорируется — timeout только в orchestrator
  });
}
