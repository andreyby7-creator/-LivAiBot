/**
 * @file AIResponseSerializer.ts
 * Сериализация ответов Yandex AI API для HTTP / gRPC.
 *
 * Назначение:
 *  - Валидация JSON-schema ответа AI
 *  - Нормализация ошибок (AI / transport / unknown)
 *  - Маппинг в HTTP status codes и gRPC status codes
 *  - Чистая, детерминированная сериализация без side effects
 *
 * Архитектурные принципы:
 *  - Pure functions
 *  - Fail-safe schema validation
 *  - Forward-compatible metadata
 *  - Transport-agnostic core (HTTP / gRPC)
 */

import { asPlainObject } from '../../../base/BaseError.js';

import type { BaseError } from '../../../base/BaseError.js';

// ==================== КОНСТАНТЫ ====================

/** Дефолтный HTTP статус для неизвестных severity уровней */
const DEFAULT_HTTP_STATUS = 500;

// ==================== ДОМЕННЫЕ ТИПЫ AI ====================

/** Структура usage в AI ответе */
export type AIUsage = {
  readonly tokens?: number;
  readonly latencyMs?: number;
};

/** Успешный ответ AI с строгой типизацией result */
export type AIResponseSuccess<T = unknown> = {
  readonly type: 'success';
  readonly model: string;
  readonly result: T;
  readonly usage?: AIUsage;
};

/** Детали ошибки AI с типобезопасной схемой */
export type AIErrorDetails = {
  readonly type?: string;
  readonly param?: string;
  readonly code?: string | number;
  readonly internalMessage?: string;
  readonly retryable?: boolean;
  readonly [key: string]: unknown; // Дополнительные поля
};

/** Ошибка AI провайдера */
export type AIResponseError = {
  readonly type: 'error';
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: AIErrorDetails;
  };
};

/** Унифицированный ответ AI */
export type AIResponse<T = unknown> = AIResponseSuccess<T> | AIResponseError;

// ==================== PLAIN-OBJECT BASEERROR ====================

/** Plain object представление BaseError для сериализации */
export type BaseErrorPlainObject = {
  readonly _tag: string;
  readonly code: string;
  readonly message: string;
  readonly severity: string;
  readonly category: string;
  readonly origin: string;
  readonly timestamp: number;
  readonly metadata?: {
    readonly context?: { readonly correlationId?: string; readonly timestamp?: number; };
    readonly customFields?: Record<string, unknown>;
  };
  readonly causeChain?: readonly BaseErrorPlainObject[];
};

// ==================== HTTP / GRPC СТАТУСЫ ====================

/** HTTP статус коды */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** gRPC статус коды */
export const GRPC_STATUS = {
  OK: 0,
  INVALID_ARGUMENT: 3,
  UNAUTHENTICATED: 16,
  PERMISSION_DENIED: 7,
  NOT_FOUND: 5,
  RESOURCE_EXHAUSTED: 8,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  UNKNOWN: 2,
} as const;

// ==================== КОНФИГУРАЦИЯ СЕРИАЛИЗАТОРА ====================

/** Форматтер для gRPC details */
export type GrpcDetailsFormatter = (
  error: BaseErrorPlainObject,
  config: AIResponseSerializerConfig,
  causeChain?: readonly BaseErrorPlainObject[],
) => readonly Record<string, unknown>[];

/** Request-specific переопределения конфигурации */
export type AIResponseSerializerRequestConfig = Partial<
  Pick<
    AIResponseSerializerConfig,
    'includeUsage' | 'includeCauseChain'
  >
>;

/** Конфигурация сериализации AI ответа */
export type AIResponseSerializerConfig<T = unknown> = {
  readonly includeUsage: boolean;
  readonly includeCauseChain: boolean;
  readonly detailLevel: 'basic' | 'detailed' | 'full';
  readonly resultValidator?: (result: unknown) => result is T;
  readonly severityMappers?: {
    readonly http?: (severity: string) => number;
    readonly grpc?: (severity: string) => number;
  };
  readonly grpcDetailsFormatter?: GrpcDetailsFormatter;
  readonly observability?: {
    /** Включает observability hooks */
    readonly enableLogging: boolean;
    /** Вызывается при невалидном AI ответе (response, error?) */
    readonly onInvalidResponse?: (response: unknown, error?: string) => void;
    /** Вызывается при сериализации BaseError (error) */
    readonly onAIError?: (error: BaseError) => void;
    /** Вызывается при ошибках сериализации (error, context) */
    readonly onSerializationError?: (error: unknown, context: string) => void;
  };
};

/** Default formatter for gRPC details */
const defaultGrpcDetailsFormatter: GrpcDetailsFormatter = (error, config, causeChain) => [
  {
    '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
    reason: error.code,
    domain: 'ai.yandex',
    metadata: {
      category: error.category,
      origin: error.origin,
      ...(config.detailLevel === 'full' && { metadata: error.metadata }),
    },
  },
  ...createCauseChainDetails(config.includeCauseChain ? causeChain : undefined),
];

const DEFAULT_CONFIG = {
  includeUsage: true,
  includeCauseChain: true,
  detailLevel: 'detailed',
  grpcDetailsFormatter: defaultGrpcDetailsFormatter,
  observability: {
    enableLogging: false,
  },
} as const;

// ==================== RUNTIME ВАЛИДАЦИЯ СХЕМЫ ====================

/** Проверяет валидность структуры AIUsage с глубоким анализом */
function isValidAIUsage(value: unknown): value is AIUsage {
  if (typeof value !== 'object' || value === null) return true; // usage опционален
  const u = value as Record<string, unknown>;

  const isValidNumber = (val: unknown): val is number =>
    typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0;

  return (
    (u['tokens'] === undefined || isValidNumber(u['tokens']))
    && (u['latencyMs'] === undefined || isValidNumber(u['latencyMs']))
  );
}

/** Проверяет валидность структуры AIErrorDetails */
function isValidAIErrorDetails(value: unknown): value is AIErrorDetails {
  if (typeof value !== 'object' || value === null) return true; // details опциональны
  const d = value as Record<string, unknown>;

  // Проверяем известные поля на корректность типов
  const isValidString = (val: unknown): val is string =>
    typeof val === 'string' && val.trim().length > 0;

  const isValidStringOrNumber = (val: unknown): boolean =>
    typeof val === 'string' || typeof val === 'number';

  return (
    (d['type'] === undefined || isValidString(d['type']))
    && (d['param'] === undefined || isValidString(d['param']))
    && (d['code'] === undefined || isValidStringOrNumber(d['code']))
    && (d['internalMessage'] === undefined || isValidString(d['internalMessage']))
    && (d['retryable'] === undefined || typeof d['retryable'] === 'boolean')
  );
}

/** Проверяет валидность структуры AI ответа с глубокой валидацией */
function isValidAIResponse<T = unknown>(value: unknown): value is AIResponse<T> {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;

  if (r['type'] === 'success') {
    // Проверяем обязательные поля success ответа
    if (typeof r['model'] !== 'string' || !r['model'].trim()) return false;
    if (!('result' in r)) return false;

    // Проверяем опциональную структуру usage
    if ('usage' in r && !isValidAIUsage(r['usage'])) return false;

    return true;
  }

  if (r['type'] === 'error') {
    const error = r['error'];
    if (typeof error !== 'object' || error === null) return false;

    const e = error as Record<string, unknown>;
    return (
      typeof e['code'] === 'string'
      && e['code'].trim().length > 0
      && typeof e['message'] === 'string'
      && e['message'].trim().length > 0
      && (e['details'] === undefined || isValidAIErrorDetails(e['details']))
    );
  }

  return false;
}

/** Проверяет и валидирует AIResponseSuccess с типизированным result */
function isValidAIResponseSuccess<T>(
  value: unknown,
  resultValidator?: (result: unknown) => result is T,
): value is AIResponseSuccess<T> {
  if (!isValidAIResponse(value)) return false;
  const r = value as Record<string, unknown>;

  if (r['type'] !== 'success') return false;

  const result = r['result'];

  // Если предоставлен валидатор result, используем его
  if (resultValidator) {
    return resultValidator(result);
  }

  // Базовая валидация result: не должен быть null/undefined, но может быть любым другим значением
  // Это позволяет принимать примитивы, объекты, массивы и т.д.
  return result !== null && result !== undefined;
}

// ==================== НОРМАЛИЗАЦИЯ ОШИБОК ====================

/** Нормализует неизвестную AI ошибку в стабильный контракт */
function normalizeAIError(
  error: unknown,
): { readonly code: string; readonly message: string; readonly details?: unknown; } {
  if (typeof error === 'object' && error !== null) {
    const r = error as Record<string, unknown>;
    if (typeof r['code'] === 'string' && typeof r['message'] === 'string') {
      return { code: r['code'], message: r['message'], details: r['details'] };
    }
  }
  return { code: 'AI_UNKNOWN_ERROR', message: 'Неизвестная ошибка AI провайдера', details: error };
}

// ==================== МАППИНГ SEVERITY → TRANSPORT ====================

/** Создает severity mapper с injectable константами */
function createSeverityMapper(statusMap: Record<string, number>) {
  return (severity: string): number => {
    const status = (Reflect.get(statusMap, severity) as number | undefined)
      ?? (Reflect.get(statusMap, 'high') as number | undefined)
      ?? DEFAULT_HTTP_STATUS;
    return status;
  };
}

/** Маппит severity BaseError в HTTP статус */
const mapSeverityToHttp = createSeverityMapper({
  low: HTTP_STATUS.BAD_REQUEST,
  medium: HTTP_STATUS.TOO_MANY_REQUESTS,
  high: HTTP_STATUS.INTERNAL_ERROR,
  critical: HTTP_STATUS.SERVICE_UNAVAILABLE,
});

/** Маппит severity BaseError в gRPC код */
const mapSeverityToGrpc = createSeverityMapper({
  low: GRPC_STATUS.INVALID_ARGUMENT,
  medium: GRPC_STATUS.RESOURCE_EXHAUSTED,
  high: GRPC_STATUS.INTERNAL,
  critical: GRPC_STATUS.UNAVAILABLE,
});

// ==================== РЕЗУЛЬТАТЫ СЕРИАЛИЗАЦИИ ====================

/** Outcome сериализации для observability */
export type AIResponseSerializationOutcome =
  | { readonly kind: 'success'; }
  | { readonly kind: 'ai-error'; readonly code: string; }
  | { readonly kind: 'system-error'; readonly reason: string; };

/** HTTP результат сериализации AI */
export type HttpAISerializationResult = {
  readonly status: number;
  readonly body: unknown;
  readonly metadata: {
    readonly serializer: 'ai-http';
    readonly timestamp: string;
    readonly config: AIResponseSerializerConfig;
    readonly outcome: AIResponseSerializationOutcome;
  };
};

/** gRPC результат сериализации AI */
export type GrpcAISerializationResult = {
  readonly code: number;
  readonly message: string;
  readonly details: readonly Record<string, unknown>[];
  readonly metadata: {
    readonly serializer: 'ai-grpc';
    readonly timestamp: string;
    readonly config: AIResponseSerializerConfig;
    readonly outcome: AIResponseSerializationOutcome;
  };
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/** Создает timestamp для сериализации */
const createTimestamp = (): string => new Date().toISOString();

/** Внутренняя функция создания metadata */
function createSerializationMetadata(
  serializer: 'ai-http' | 'ai-grpc',
  config: AIResponseSerializerConfig,
  outcome: AIResponseSerializationOutcome,
): {
  readonly serializer: 'ai-http' | 'ai-grpc';
  readonly timestamp: string;
  readonly config: AIResponseSerializerConfig;
  readonly outcome: AIResponseSerializationOutcome;
} {
  return { serializer, timestamp: createTimestamp(), config, outcome };
}

/** Создает metadata объект для HTTP сериализации */
function createHttpSerializationMetadata(
  config: AIResponseSerializerConfig,
  outcome: AIResponseSerializationOutcome,
): {
  readonly serializer: 'ai-http';
  readonly timestamp: string;
  readonly config: AIResponseSerializerConfig;
  readonly outcome: AIResponseSerializationOutcome;
} {
  return createSerializationMetadata('ai-http', config, outcome) as {
    readonly serializer: 'ai-http';
    readonly timestamp: string;
    readonly config: AIResponseSerializerConfig;
    readonly outcome: AIResponseSerializationOutcome;
  };
}

/** Создает metadata объект для gRPC сериализации */
function createGrpcSerializationMetadata(
  config: AIResponseSerializerConfig,
  outcome: AIResponseSerializationOutcome,
): {
  readonly serializer: 'ai-grpc';
  readonly timestamp: string;
  readonly config: AIResponseSerializerConfig;
  readonly outcome: AIResponseSerializationOutcome;
} {
  return createSerializationMetadata('ai-grpc', config, outcome) as {
    readonly serializer: 'ai-grpc';
    readonly timestamp: string;
    readonly config: AIResponseSerializerConfig;
    readonly outcome: AIResponseSerializationOutcome;
  };
}

/** Создает cause chain для gRPC деталей */
function createCauseChainDetails(causeChain?: readonly BaseErrorPlainObject[]): {
  readonly '@type': 'type.googleapis.com/google.rpc.ErrorInfo';
  readonly reason: string;
  readonly domain: 'ai.yandex.cause';
  readonly metadata: { readonly message: string; readonly severity: string; };
}[] {
  if (!causeChain || causeChain.length === 0) return [];

  // Мапим все элементы
  return causeChain.map((cause, originalIndex) => ({
    '@type': 'type.googleapis.com/google.rpc.ErrorInfo' as const,
    reason: `${cause.code}_${originalIndex}`,
    domain: 'ai.yandex.cause' as const,
    metadata: { message: cause.message, severity: cause.severity },
  }));
}

/** Получает severity mapper для указанного протокола */
function getSeverityMapper(
  config: AIResponseSerializerConfig,
  protocol: 'http' | 'grpc',
): ((severity: string) => number) | undefined {
  return Reflect.get(config.severityMappers ?? {}, protocol);
}

/** Создает HTTP error ответ при сериализации */
function createHttpSerializationErrorResult(
  config: AIResponseSerializerConfig,
  reason: string,
): HttpAISerializationResult {
  return {
    status: HTTP_STATUS.INTERNAL_ERROR,
    body: { error: { code: 'SERIALIZATION_ERROR', message: 'Ошибка сериализации HTTP ответа' } },
    metadata: createHttpSerializationMetadata(config, { kind: 'system-error', reason }),
  };
}

/** Создает gRPC error ответ при сериализации */
function createGrpcSerializationErrorResult(
  config: AIResponseSerializerConfig,
  reason: string,
): GrpcAISerializationResult {
  return {
    code: GRPC_STATUS.INTERNAL,
    message: 'Ошибка сериализации gRPC ответа',
    details: [],
    metadata: createGrpcSerializationMetadata(config, { kind: 'system-error', reason }),
  };
}

/** Обрабатывает BaseError для указанного протокола */
function processBaseError(
  error: BaseError,
  config: AIResponseSerializerConfig,
  protocol: 'http' | 'grpc',
  requestConfig?: AIResponseSerializerRequestConfig,
): HttpAISerializationResult | GrpcAISerializationResult {
  callObservabilityHook(config, 'onAIError', error);
  const plain = asPlainObject(error) as BaseErrorPlainObject;
  const effectiveConfig = { ...config, ...requestConfig };

  if (protocol === 'http') {
    const status = getSeverityMapper(config, 'http')?.(error.severity)
      ?? mapSeverityToHttp(error.severity);
    return {
      status,
      body: {
        error: {
          code: plain.code,
          message: plain.message,
          category: plain.category,
          ...(effectiveConfig.detailLevel === 'full' && { metadata: plain.metadata }),
          ...(effectiveConfig.includeCauseChain && { causeChain: plain.causeChain }),
        },
      },
      metadata: createHttpSerializationMetadata(config, { kind: 'ai-error', code: plain.code }),
    };
  } else {
    const code = getSeverityMapper(config, 'grpc')?.(error.severity)
      ?? mapSeverityToGrpc(error.severity);
    const details = effectiveConfig.grpcDetailsFormatter
      ? effectiveConfig.grpcDetailsFormatter(
        plain,
        effectiveConfig,
        effectiveConfig.includeCauseChain ? plain.causeChain : undefined,
      )
      : [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: plain.code,
          domain: 'ai.yandex',
          metadata: {
            category: plain.category,
            origin: plain.origin,
            ...(effectiveConfig.detailLevel === 'full' && { metadata: plain.metadata }),
          },
        },
        ...createCauseChainDetails(
          effectiveConfig.includeCauseChain ? plain.causeChain : undefined,
        ),
      ];

    return {
      code,
      message: plain.message,
      details,
      metadata: createGrpcSerializationMetadata(config, { kind: 'ai-error', code: plain.code }),
    };
  }
}

/** Обрабатывает невалидный AI ответ для указанного протокола */
function processInvalidAIResponse(
  response: unknown,
  config: AIResponseSerializerConfig,
  protocol: 'http' | 'grpc',
): HttpAISerializationResult | GrpcAISerializationResult {
  callObservabilityHook(config, 'onInvalidResponse', response, 'invalid-ai-response');

  if (protocol === 'http') {
    const normalized = normalizeAIError(response);
    return {
      status: HTTP_STATUS.INTERNAL_ERROR,
      body: { error: { code: normalized.code, message: normalized.message } },
      metadata: createHttpSerializationMetadata(config, {
        kind: 'system-error',
        reason: 'invalid-ai-response',
      }),
    };
  } else {
    return {
      code: GRPC_STATUS.INTERNAL,
      message: 'Невалидная структура ответа AI',
      details: [],
      metadata: createGrpcSerializationMetadata(config, {
        kind: 'system-error',
        reason: 'invalid-ai-response',
      }),
    };
  }
}

/** Обрабатывает успешный AI ответ для указанного протокола */
function processSuccessfulAIResponse(
  response: unknown,
  config: AIResponseSerializerConfig,
  protocol: 'http' | 'grpc',
  requestConfig?: AIResponseSerializerRequestConfig,
): HttpAISerializationResult | GrpcAISerializationResult {
  const effectiveConfig = { ...config, ...requestConfig };

  if (protocol === 'http') {
    // Обрабатываем includeUsage: убираем usage из ответа если отключено
    let body = response;
    if (!effectiveConfig.includeUsage && isValidAIResponseSuccess(response)) {
      // Убираем usage из ответа если отключено в конфигурации
      const { usage, ...responseWithoutUsage } = response;
      void usage; // usage intentionally unused - we just want to exclude it
      body = responseWithoutUsage;
    }
    return {
      status: HTTP_STATUS.OK,
      body,
      metadata: createHttpSerializationMetadata(config, { kind: 'success' }),
    };
  } else {
    return {
      code: GRPC_STATUS.OK,
      message: 'OK',
      details: [{ result: response }],
      metadata: createGrpcSerializationMetadata(config, { kind: 'success' }),
    };
  }
}

/** Вызывает observability hook с типобезопасностью. Игнорирует ошибки в hooks */
function callObservabilityHook(
  config: AIResponseSerializerConfig,
  hookName: 'onInvalidResponse' | 'onAIError' | 'onSerializationError',
  ...args: unknown[]
): void {
  const hookValue = Reflect.get(config.observability ?? {}, hookName) as
    | ((...args: unknown[]) => void)
    | undefined;
  if (config.observability?.enableLogging === true && hookValue) {
    try {
      hookValue(...args);
    } catch {
      // Игнорируем ошибки в observability hooks
    }
  }
}

// ==================== ФАБРИКА СЕРИАЛИЗАТОРА ====================

/** Создает сериализатор AI ответов для HTTP и gRPC */
export function createAIResponseSerializer<T = unknown>(
  config: Partial<AIResponseSerializerConfig<T>> = {},
): {
  serializeHttp(
    response: unknown,
    error?: BaseError,
    requestConfig?: AIResponseSerializerRequestConfig,
  ): HttpAISerializationResult;
  serializeGrpc(
    response: unknown,
    error?: BaseError,
    requestConfig?: AIResponseSerializerRequestConfig,
  ): GrpcAISerializationResult;
} {
  const finalConfig: AIResponseSerializerConfig<T> = { ...DEFAULT_CONFIG, ...config };

  /** Сериализует ответ или ошибку в HTTP формат */
  function serializeHttp(
    response: unknown,
    error?: BaseError,
    requestConfig?: AIResponseSerializerRequestConfig,
  ): HttpAISerializationResult {
    try {
      if (error) {
        return processBaseError(
          error,
          finalConfig,
          'http',
          requestConfig,
        ) as HttpAISerializationResult;
      }

      // Проверяем, является ли ответ валидным AI ответом (success или error)
      if (isValidAIResponse(response)) {
        const r = response as Record<string, unknown>;
        // Это валидный AI ответ, проверяем, является ли он success или error
        if (
          r['type'] === 'success' && isValidAIResponseSuccess(response, finalConfig.resultValidator)
        ) {
          return processSuccessfulAIResponse(
            response,
            finalConfig,
            'http',
            requestConfig,
          ) as HttpAISerializationResult;
        } else if (r['type'] === 'error') {
          // Это валидный AI error ответ, возвращаем как success (200) с самим ответом
          return {
            status: HTTP_STATUS.OK,
            body: response,
            metadata: createHttpSerializationMetadata(finalConfig, { kind: 'success' }),
          } as HttpAISerializationResult;
        } else {
          // Неверная структура success ответа (например, result === null/undefined)
          return processInvalidAIResponse(
            response,
            finalConfig,
            'http',
          ) as HttpAISerializationResult;
        }
      } else {
        // Неверная структура AI ответа
        return processInvalidAIResponse(response, finalConfig, 'http') as HttpAISerializationResult;
      }
    } catch (serializationError) {
      callObservabilityHook(
        finalConfig,
        'onSerializationError',
        serializationError,
        'serializeHttp',
      );
      return createHttpSerializationErrorResult(finalConfig, 'serialization-failed');
    }
  }

  /** Сериализует ответ или ошибку в gRPC формат */
  function serializeGrpc(
    response: unknown,
    error?: BaseError,
    requestConfig?: AIResponseSerializerRequestConfig,
  ): GrpcAISerializationResult {
    try {
      if (error) {
        return processBaseError(
          error,
          finalConfig,
          'grpc',
          requestConfig,
        ) as GrpcAISerializationResult;
      }

      // Проверяем, является ли ответ валидным AI ответом (success или error)
      if (isValidAIResponse(response)) {
        const r = response as Record<string, unknown>;
        // Это валидный AI ответ, проверяем, является ли он success или error
        if (
          r['type'] === 'success' && isValidAIResponseSuccess(response, finalConfig.resultValidator)
        ) {
          return processSuccessfulAIResponse(
            response,
            finalConfig,
            'grpc',
            requestConfig,
          ) as GrpcAISerializationResult;
        } else if (r['type'] === 'error') {
          // Это валидный AI error ответ, возвращаем как success (OK) с самим ответом
          return {
            code: GRPC_STATUS.OK,
            message: 'OK',
            details: [{ result: response }],
            metadata: createGrpcSerializationMetadata(finalConfig, { kind: 'success' }),
          } as GrpcAISerializationResult;
        } else {
          // Неверная структура success ответа (например, result === null/undefined)
          return processInvalidAIResponse(
            response,
            finalConfig,
            'grpc',
          ) as GrpcAISerializationResult;
        }
      } else {
        // Неверная структура AI ответа
        return processInvalidAIResponse(response, finalConfig, 'grpc') as GrpcAISerializationResult;
      }
    } catch (serializationError) {
      callObservabilityHook(
        finalConfig,
        'onSerializationError',
        serializationError,
        'serializeGrpc',
      );
      return createGrpcSerializationErrorResult(finalConfig, 'serialization-failed');
    }
  }

  return { serializeHttp, serializeGrpc };
}

// ==================== ДЕФОЛТНЫЕ ХЕЛПЕРЫ ====================

/** HTTP сериализация с дефолтной конфигурацией */
export const serializeAIResponseHttp = <T = unknown>(
  response: unknown,
  error?: BaseError,
  config?: Partial<AIResponseSerializerConfig<T>>,
  requestConfig?: AIResponseSerializerRequestConfig,
): HttpAISerializationResult =>
  createAIResponseSerializer(config).serializeHttp(response, error, requestConfig);

/** gRPC сериализация с дефолтной конфигурацией */
export const serializeAIResponseGrpc = <T = unknown>(
  response: unknown,
  error?: BaseError,
  config?: Partial<AIResponseSerializerConfig<T>>,
  requestConfig?: AIResponseSerializerRequestConfig,
): GrpcAISerializationResult =>
  createAIResponseSerializer(config).serializeGrpc(response, error, requestConfig);

// ==================== УТИЛИТЫ СЕРИАЛИЗАЦИИ В JSON ====================

/** Безопасная JSON сериализация с error handling */
function serializeToJsonString<T>(data: T): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    // Логируем ошибку сериализации для debugging
    callObservabilityHook(
      { observability: { enableLogging: true } } as AIResponseSerializerConfig<unknown>,
      'onSerializationError',
      error,
      'json-serialization',
    );
    throw new Error(
      `JSON serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/** Сериализует HTTP результат в JSON строку для транспортного слоя */
export function serializeHttpToJsonString(result: HttpAISerializationResult): string {
  return serializeToJsonString(result.body);
}

/** Сериализует gRPC результат в JSON строку для транспортного слоя */
export function serializeGrpcToJsonString(result: GrpcAISerializationResult): string {
  return serializeToJsonString({
    code: result.code,
    message: result.message,
    details: result.details,
  });
}

/** Сериализует HTTP результат с metadata в полную JSON строку */
export function serializeHttpWithMetadataToJsonString(result: HttpAISerializationResult): string {
  return serializeToJsonString(result);
}

/** Сериализует gRPC результат с metadata в полную JSON строку */
export function serializeGrpcWithMetadataToJsonString(result: GrpcAISerializationResult): string {
  return serializeToJsonString(result);
}
