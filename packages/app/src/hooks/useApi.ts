/**
 * @file packages/app/src/hooks/useApi.ts
 * ============================================================================
 * 🔌 USE API — ОРКЕСТРАТОР ВЫЗОВОВ API
 * ============================================================================
 * Назначение:
 * - Строго типизированные helpers для API (без строковых endpoint'ов)
 * - Нормализация ошибок через error-mapping
 * - Runtime безопасность через api-schema-guard
 * - Telemetry как side-effect
 * Принципы:
 * - useApi не знает детали транспорта
 * - useApi не содержит бизнес-логики
 * - useApi возвращает чистые async операции
 * - useApi не реализует cache/retry/optimistic (это boundary React Query слоя)
 */

import { Effect as EffectLib } from 'effect';
import { useMemo } from 'react';

import type { MappedError } from '@livai/core/effect';
import { mapError } from '@livai/core/effect';

import type { ApiClient } from '../lib/api-client.js';
import type {
  ApiRequestValidator,
  ApiResponseValidator,
  ApiSchemaConfig,
  ApiValidationContext,
} from '../lib/api-schema-guard.js';
import { validateApiRequest, validateApiResponse } from '../lib/api-schema-guard.js';
import { logFireAndForget } from '../lib/telemetry-runtime.js';
import type { ApiHeaders, ApiRequestContext, ApiServiceName, HttpMethod } from '../types/api.js';
import type { ComponentState, UiEvent, UiEventMap, UiMetrics } from '../types/ui-contracts.js';

/** Алиас для UI событий в контексте API хуков */
export type ApiUiEvent<TType extends keyof UiEventMap = keyof UiEventMap> = UiEvent<TType>;

/** Алиас для состояния компонентов в контексте API хуков */
export type ApiComponentState<T = unknown> = ComponentState<T>;

/** Алиас для UI метрик в контексте API хуков */
export type ApiUiMetrics = UiMetrics;

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Определение endpoint'а с типизированными request/response и опциональной валидацией. */
export type ApiEndpointDefinition<TRequest, TResponseRaw, TResponse = TResponseRaw> = Readonly<{
  /** Микросервис */
  readonly service: ApiServiceName;
  /** HTTP метод */
  readonly method: HttpMethod;
  /** Endpoint path (string или фабрика) */
  readonly path: string | ((input: TRequest) => string);
  /** Заголовки запроса */
  readonly headers?: ApiHeaders | ((input: TRequest) => ApiHeaders);
  /** Маппинг входных данных в payload запроса */
  readonly mapRequest?: (input: TRequest) => unknown;
  /**
   * Маппинг ответа на нужную форму.
   * Допустимо только для DTO → ViewModel трансформаций (без бизнес-логики).
   */
  readonly mapResponse?: (response: TResponseRaw) => TResponse;
  /** Валидатор запроса */
  readonly requestValidator?: ApiRequestValidator<TRequest>;
  /** Валидатор ответа */
  readonly responseValidator?: ApiResponseValidator<TResponseRaw>;
}>;

/** Контракт API - набор типизированных endpoint'ов. */
export type ApiContract = Readonly<
  Record<string, ApiEndpointDefinition<unknown, unknown, unknown>>
>;

type RequestOf<T> = T extends ApiEndpointDefinition<infer TReq, unknown, unknown> ? TReq : never;
type ResponseRawOf<T> = T extends ApiEndpointDefinition<unknown, infer TRaw, unknown> ? TRaw
  : never;
type ResponseOf<T> = T extends ApiEndpointDefinition<unknown, unknown, infer TRes> ? TRes : never;

type ApiExecutionContext = Readonly<{
  readonly traceId?: string;
  readonly locale?: string;
  readonly requestId: string;
}>;

export type ApiClientAdapter<T extends ApiContract> = Readonly<
  {
    [K in keyof T]: (input: RequestOf<T[K]>) => Promise<ResponseOf<T[K]>>;
  }
>;

/** Опции для настройки useApi хука. */
export type UseApiOptions<T extends ApiContract> = Readonly<{
  /** Экземпляр API клиента */
  readonly client: ApiClient;
  /** Контракт API (должен быть static или memoized). */
  readonly contract: T;
  /** Контекст запроса (traceId, authToken, locale и т.д.) */
  readonly context?: ApiRequestContext;
  /** Включить telemetry */
  readonly telemetryEnabled?: boolean;
}>;

/* ============================================================================
 * 🧰 UTILS
 * ========================================================================== */

const BASE36_RADIX = 36;
const RANDOM_ID_LENGTH = 9;
const HTTP_STATUS_SERVER_ERROR_MIN = 500;
const HTTP_STATUS_CLIENT_ERROR_MIN = 400;

function createRequestId(): string {
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    if (typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  }
  return `req_${Date.now()}_${Math.random().toString(BASE36_RADIX).slice(2, RANDOM_ID_LENGTH)}`;
}

function resolvePath<TRequest>(
  path: ApiEndpointDefinition<TRequest, unknown>['path'],
  input: TRequest,
): string {
  return typeof path === 'function' ? path(input) : path;
}

function resolveHeaders<TRequest>(
  headers: ApiEndpointDefinition<TRequest, unknown>['headers'],
  input: TRequest,
): ApiHeaders {
  if (!headers) return {};
  return typeof headers === 'function' ? headers(input) : headers;
}

function isMappedError(value: unknown): value is MappedError {
  return value != null
    && typeof value === 'object'
    && 'code' in (value as Record<string, unknown>)
    && 'message' in (value as Record<string, unknown>)
    && 'timestamp' in (value as Record<string, unknown>);
}

function getTelemetryErrorKindFromMappedError(
  error: MappedError,
): 'validation' | 'network' | 'server' | 'client' | 'unknown' {
  if (error.code.startsWith('SYSTEM_VALIDATION_')) {
    return 'validation';
  }

  if (error.code.startsWith('NETWORK_')) {
    return 'network';
  }

  if (error.code.startsWith('HTTP_5')) {
    return 'server';
  }

  if (error.code.startsWith('HTTP_4')) {
    return 'client';
  }

  return 'unknown';
}

function getTelemetryErrorKindFromObject(
  error: Record<string, unknown>,
): 'validation' | 'network' | 'server' | 'client' | 'unknown' {
  const status = typeof error['status'] === 'number' ? error['status'] : null;
  if (status !== null) {
    if (status >= HTTP_STATUS_SERVER_ERROR_MIN) return 'server';
    if (status >= HTTP_STATUS_CLIENT_ERROR_MIN) return 'client';
  }

  if ('name' in error && error['name'] === 'TypeError') {
    return 'network';
  }

  return 'unknown';
}

function getTelemetryErrorKind(
  error: unknown,
): 'validation' | 'network' | 'server' | 'client' | 'unknown' {
  if (isMappedError(error)) {
    return getTelemetryErrorKindFromMappedError(error);
  }

  if (error != null && typeof error === 'object') {
    return getTelemetryErrorKindFromObject(error as Record<string, unknown>);
  }

  return 'unknown';
}

/* ============================================================================
 * 🎯 CORE ORCHESTRATION
 * ========================================================================== */

/** Подготавливает контексты для API вызова (execution, validation, schema). */
function prepareApiContexts(
  endpoint: ApiEndpointDefinition<unknown, unknown, unknown>,
  input: unknown,
  context?: ApiRequestContext,
): {
  executionContext: ApiExecutionContext;
  schemaConfig: ApiSchemaConfig<unknown, unknown>;
  validationContext: ApiValidationContext;
  requestPayload: unknown;
  headers: ApiHeaders;
  endpointPath: string;
  method: HttpMethod;
} {
  const requestId = createRequestId();
  const method = endpoint.method;
  const endpointPath = resolvePath(endpoint.path, input);
  const headers = resolveHeaders(endpoint.headers, input);
  const requestPayload = endpoint.mapRequest ? endpoint.mapRequest(input) : input;

  const executionContext: ApiExecutionContext = {
    requestId,
    ...(context?.traceId != null && context.traceId !== '' && { traceId: context.traceId }),
    ...(context?.locale != null && context.locale !== '' && { locale: context.locale }),
  };

  const schemaConfig: ApiSchemaConfig<unknown, unknown> = {
    service: endpoint.service,
    method,
    endpoint: endpointPath,
    requestValidator: endpoint.requestValidator,
    responseValidator: endpoint.responseValidator,
  };

  const validationContext: ApiValidationContext = {
    method,
    endpoint: endpointPath,
    requestId,
    ...(executionContext.traceId != null
      && executionContext.traceId !== ''
      && { traceId: executionContext.traceId }),
    ...(executionContext.locale != null
      && executionContext.locale !== ''
      && { locale: executionContext.locale }),
  };

  return {
    executionContext,
    schemaConfig,
    validationContext,
    requestPayload,
    headers,
    endpointPath,
    method,
  };
}

/** Создает типизированный API клиент из контракта. */
function buildApiClient<T extends ApiContract>(
  client: ApiClient,
  contract: T,
  context?: ApiRequestContext,
  telemetryEnabled: boolean = true,
): ApiClientAdapter<T> {
  const entries = Object.entries(contract).map(([key, endpoint]) => {
    const fn = async (input: RequestOf<typeof endpoint>): Promise<ResponseOf<typeof endpoint>> => {
      const startTime = Date.now();
      const {
        executionContext,
        schemaConfig,
        validationContext,
        requestPayload,
        headers,
        endpointPath,
        method,
      } = prepareApiContexts(endpoint, input, context);

      try {
        const validatedRequest = endpoint.requestValidator
          ? await EffectLib.runPromise(
            validateApiRequest(requestPayload, schemaConfig, validationContext),
          )
          : requestPayload;

        // apiClient.request() теперь возвращает данные напрямую или бросает ошибку
        const responseData = await client.request<ResponseRawOf<typeof endpoint>, unknown>({
          method,
          url: endpointPath,
          body: method === 'GET' ? undefined : validatedRequest,
          headers,
          ...(context && { context }),
        });

        // Валидируем и мапим ответ
        const validatedResponse = endpoint.responseValidator
          ? await EffectLib.runPromise(
            validateApiResponse(responseData, schemaConfig, validationContext),
          )
          : responseData;

        const result = endpoint.mapResponse
          ? endpoint.mapResponse(validatedResponse)
          : validatedResponse;

        if (telemetryEnabled) {
          logFireAndForget('INFO', 'API call succeeded', {
            endpoint: endpointPath,
            method,
            durationMs: Date.now() - startTime,
          });
        }

        return result;
      } catch (error) {
        if (isMappedError(error)) {
          if (telemetryEnabled) {
            logFireAndForget('ERROR', 'API call failed', {
              endpoint: endpointPath,
              method,
              durationMs: Date.now() - startTime,
              errorCode: error.code,
              errorKind: getTelemetryErrorKind(error),
            });
          }
          throw error;
        }

        const mappedError = mapError(
          error,
          {
            endpoint: endpointPath,
            method,
            requestId: executionContext.requestId,
          },
          { locale: executionContext.locale ?? 'ru', timestamp: Date.now() },
        );

        if (telemetryEnabled) {
          logFireAndForget('ERROR', 'API call failed', {
            endpoint: endpointPath,
            method,
            durationMs: Date.now() - startTime,
            errorCode: mappedError.code,
            errorKind: getTelemetryErrorKind(mappedError),
          });
        }

        throw mappedError;
      }
    };

    return [key, fn] as const;
  });

  return Object.freeze(Object.fromEntries(entries)) as ApiClientAdapter<T>;
}

/* ============================================================================
 * 🪝 HOOK
 * ========================================================================== */

/**
 * React-хук для получения строго типизированного API адаптера.
 * @param options - конфигурация API клиента
 * @returns типизированный API клиент
 */
export function useApi<T extends ApiContract>(
  options: UseApiOptions<T>,
): ApiClientAdapter<T> {
  return useMemo(
    () =>
      buildApiClient(
        options.client,
        options.contract,
        options.context,
        options.telemetryEnabled !== false,
      ),
    [options.client, options.contract, options.context, options.telemetryEnabled],
  );
}
