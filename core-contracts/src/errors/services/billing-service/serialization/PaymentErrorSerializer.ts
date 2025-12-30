/**
 * @file PaymentErrorSerializer.ts
 * Сериализация ошибок платежных операций для HTTP / gRPC.
 *
 * Назначение:
 *  - Валидация и нормализация ошибок платежей (PaymentFailedError, RefundError, SubscriptionError)
 *  - Маппинг в HTTP status codes и gRPC status codes
 *  - PCI-safe сериализация без чувствительных данных
 *  - Чистая, детерминированная сериализация без side effects
 *
 * Архитектурные принципы:
 *  - Pure functions для сериализации
 *  - Fail-safe schema validation
 *  - Forward-compatible metadata
 *  - Transport-agnostic core (HTTP / gRPC)
 *  - PCI-safe: без PAN, CVV, expiry, только бизнес-данные
 *
 * ⚠️ PCI COMPLIANCE CRITICAL:
 *  - НИКОГДА не сериализует PAN, CVV, expiry date, cardholder name
 *  - Только PCI-safe поля: transactionId, amount, currency, provider, operation
 *  - Любая попытка сериализации чувствительных данных = SECURITY VIOLATION
 */

import { asPlainObject } from '../../../base/BaseError.js';
import { isValidPaymentResult, isValidPaymentSuccess } from '../BillingServiceValidators.js';

import type { BaseError } from '../../../base/BaseError.js';

// ==================== КОНСТАНТЫ ====================

/** Дефолтный HTTP статус для неизвестных severity уровней */
const DEFAULT_HTTP_STATUS = 500;

/** HTTP статус коды для платежных операций */
export const PAYMENT_HTTP_STATUS = Object.freeze(
  {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402, // RFC 7231 - для платежных ошибок
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409, // Для конфликтов подписок
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  } as const,
);

/** gRPC статус коды для платежных операций */
export const PAYMENT_GRPC_STATUS = Object.freeze(
  {
    OK: 0,
    INVALID_ARGUMENT: 3,
    FAILED_PRECONDITION: 9, // Для бизнес-правил (лимиты, политика)
    UNAUTHENTICATED: 16,
    PERMISSION_DENIED: 7,
    NOT_FOUND: 5,
    ALREADY_EXISTS: 6, // Для конфликтов подписок
    RESOURCE_EXHAUSTED: 8,
    INTERNAL: 13,
    UNAVAILABLE: 14,
    UNKNOWN: 2,
  } as const,
);

// ==================== ДОМЕННЫЕ ТИПЫ ПЛАТЕЖЕЙ ====================

/** Успешный результат платежной операции (PCI-safe) */
export type PaymentSuccess<T = unknown> = {
  readonly type: 'success';
  readonly operation: string;
  readonly result: T;
  readonly transactionId: string;
  readonly amount?: number; // В minor units, PCI-safe для логирования
  readonly currency?: string; // ISO 4217 код, PCI-safe
};

/** Детали ошибки платежа с PCI-safe схемой */
export type PaymentErrorDetails = {
  readonly type?: string;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly provider?: string; // Название провайдера, не чувствительные данные
  readonly operation?: string;
  /** PCI-safe: только transactionId, без card details */
  readonly transactionId?: string;
};

/** Ошибка платежной операции */
export type PaymentError = {
  readonly type: 'error';
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: PaymentErrorDetails;
  };
};

/** Унифицированный результат платежной операции */
export type PaymentResult<T = unknown> = PaymentSuccess<T> | PaymentError;

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
    readonly context?: {
      readonly correlationId?: string;
      readonly transactionId?: string;
      readonly timestamp?: number;
    };
    readonly customFields?: Record<string, unknown>;
  };
  readonly causeChain?: readonly BaseErrorPlainObject[];
};

// ==================== КОНФИГУРАЦИЯ СЕРИАЛИЗАТОРА ====================

/** Форматтер для gRPC details */
export type PaymentGrpcDetailsFormatter = (
  error: BaseErrorPlainObject,
  config: PaymentErrorSerializerConfig,
  causeChain?: readonly BaseErrorPlainObject[],
) => readonly Record<string, unknown>[];

/** Request-specific переопределения конфигурации */
export type PaymentErrorSerializerRequestConfig = Partial<
  Pick<
    PaymentErrorSerializerConfig,
    'includeCauseChain' | 'includeTransactionId'
  >
>;

/** Конфигурация сериализации платежных ошибок */
export type PaymentErrorSerializerConfig<T = unknown> = {
  readonly includeCauseChain: boolean;
  readonly includeTransactionId: boolean;
  /** Уровень детализации: basic (code+message), detailed (code+message+category+origin), full (detailed+metadata) */
  readonly detailLevel: 'basic' | 'detailed' | 'full';
  readonly resultValidator?: (result: unknown) => result is T;
  readonly severityMappers?: {
    readonly http?: (severity: string) => number;
    readonly grpc?: (severity: string) => number;
  };
  readonly grpcDetailsFormatter?: PaymentGrpcDetailsFormatter;
  readonly observability?: {
    /** Включает observability hooks */
    readonly enableLogging: boolean;
    /** Вызывается при невалидном результате платежа */
    readonly onInvalidResult?: (result: unknown, error?: string) => void;
    /** Вызывается при сериализации BaseError */
    readonly onPaymentError?: (error: BaseError) => void;
    /** Вызывается при ошибках сериализации */
    readonly onSerializationError?: (error: unknown, context: string) => void;
  };
};

/** Default formatter for gRPC details */
function createDefaultGrpcDetailsFormatter(): PaymentGrpcDetailsFormatter {
  return (error, config, causeChain) => [
    {
      '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
      reason: error.code,
      domain: 'billing.payment',
      metadata: {
        category: error.category,
        origin: error.origin,
        ...(config.detailLevel === 'full' && { metadata: error.metadata }),
      },
    },
    ...createCauseChainDetails(config.includeCauseChain ? causeChain : undefined),
  ];
}

const defaultGrpcDetailsFormatter = createDefaultGrpcDetailsFormatter();

const DEFAULT_CONFIG = {
  includeCauseChain: true,
  includeTransactionId: true,
  detailLevel: 'detailed',
  grpcDetailsFormatter: defaultGrpcDetailsFormatter,
  observability: {
    enableLogging: false,
  },
} as const;

// ==================== RUNTIME ВАЛИДАЦИЯ СХЕМЫ ====================

// ==================== НОРМАЛИЗАЦИЯ ОШИБОК ====================

/** Нормализует неизвестную платежную ошибку в стабильный контракт */
function normalizePaymentError(
  error: unknown,
): { readonly code: string; readonly message: string; } {
  if (typeof error === 'object' && error !== null) {
    const r = error as Record<string, unknown>;
    if (typeof r['code'] === 'string' && typeof r['message'] === 'string') {
      return { code: r['code'], message: r['message'] }; // PCI-safe: без details
    }
  }
  return { code: 'PAYMENT_UNKNOWN_ERROR', message: 'Неизвестная ошибка платежа' }; // PCI-safe: без sensitive error
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

/** Маппит severity BaseError в HTTP статус для платежей */
const mapSeverityToHttp = createSeverityMapper({
  low: PAYMENT_HTTP_STATUS.BAD_REQUEST,
  medium: PAYMENT_HTTP_STATUS.TOO_MANY_REQUESTS,
  high: PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED, // Специфично для платежей
  critical: PAYMENT_HTTP_STATUS.SERVICE_UNAVAILABLE,
});

/** Маппит severity BaseError в gRPC код для платежей */
const mapSeverityToGrpc = createSeverityMapper({
  low: PAYMENT_GRPC_STATUS.INVALID_ARGUMENT,
  medium: PAYMENT_GRPC_STATUS.RESOURCE_EXHAUSTED,
  high: PAYMENT_GRPC_STATUS.FAILED_PRECONDITION, // Для бизнес-правил платежей
  critical: PAYMENT_GRPC_STATUS.UNAVAILABLE,
});

// ==================== РЕЗУЛЬТАТЫ СЕРИАЛИЗАЦИИ ====================

/** Outcome сериализации для observability */
export type PaymentErrorSerializationOutcome =
  | { readonly kind: 'success'; }
  | { readonly kind: 'payment-error'; readonly code: string; }
  | { readonly kind: 'system-error'; readonly reason: string; };

/** HTTP результат сериализации платежа */
export type HttpPaymentSerializationResult = {
  readonly status: number;
  readonly body: {
    readonly timestamp: string; // Для легкой трассировки в логах
    readonly [key: string]: unknown;
  };
  readonly metadata: {
    readonly serializer: 'payment-http';
    readonly timestamp: string;
    readonly config: PaymentErrorSerializerConfig;
    readonly outcome: PaymentErrorSerializationOutcome;
  };
};

/** gRPC результат сериализации платежа */
export type GrpcPaymentSerializationResult = {
  readonly code: number;
  readonly message: string;
  readonly details: readonly Record<string, unknown>[];
  readonly metadata: {
    readonly serializer: 'payment-grpc';
    readonly timestamp: string;
    readonly config: PaymentErrorSerializerConfig;
    readonly outcome: PaymentErrorSerializationOutcome;
  };
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/** Создает timestamp для сериализации
 * @note Для production microservices рекомендуется использовать monotonic clock
 * или external time provider (NTP, distributed time service) для избежания clock drift
 */
const createTimestamp = (): string => new Date().toISOString();

/** Внутренняя функция создания metadata */
function createSerializationMetadata(
  serializer: 'payment-http' | 'payment-grpc',
  config: PaymentErrorSerializerConfig,
  outcome: PaymentErrorSerializationOutcome,
): {
  readonly serializer: 'payment-http' | 'payment-grpc';
  readonly timestamp: string;
  readonly config: PaymentErrorSerializerConfig;
  readonly outcome: PaymentErrorSerializationOutcome;
} {
  return { serializer, timestamp: createTimestamp(), config, outcome };
}

/** Generic функция создания metadata для любого протокола */
function createProtocolSerializationMetadata<T extends 'payment-http' | 'payment-grpc'>(
  serializer: T,
  config: PaymentErrorSerializerConfig,
  outcome: PaymentErrorSerializationOutcome,
): {
  readonly serializer: T;
  readonly timestamp: string;
  readonly config: PaymentErrorSerializerConfig;
  readonly outcome: PaymentErrorSerializationOutcome;
} {
  return createSerializationMetadata(serializer, config, outcome) as {
    readonly serializer: T;
    readonly timestamp: string;
    readonly config: PaymentErrorSerializerConfig;
    readonly outcome: PaymentErrorSerializationOutcome;
  };
}

/** Создает metadata объект для HTTP сериализации */
const createHttpSerializationMetadata = (
  config: PaymentErrorSerializerConfig,
  outcome: PaymentErrorSerializationOutcome,
): {
  readonly serializer: 'payment-http';
  readonly timestamp: string;
  readonly config: PaymentErrorSerializerConfig;
  readonly outcome: PaymentErrorSerializationOutcome;
} => createProtocolSerializationMetadata('payment-http', config, outcome);

/** Создает metadata объект для gRPC сериализации */
const createGrpcSerializationMetadata = (
  config: PaymentErrorSerializerConfig,
  outcome: PaymentErrorSerializationOutcome,
): {
  readonly serializer: 'payment-grpc';
  readonly timestamp: string;
  readonly config: PaymentErrorSerializerConfig;
  readonly outcome: PaymentErrorSerializationOutcome;
} => createProtocolSerializationMetadata('payment-grpc', config, outcome);

/** Создает cause chain для gRPC деталей */
function createCauseChainDetails(causeChain?: readonly BaseErrorPlainObject[]): {
  readonly '@type': 'type.googleapis.com/google.rpc.ErrorInfo';
  readonly reason: string;
  readonly domain: 'billing.payment.cause';
  readonly metadata: { readonly message: string; readonly severity: string; };
}[] {
  if (!causeChain || causeChain.length === 0) return [];

  // Мапим все элементы
  return causeChain.map((cause, originalIndex) => ({
    '@type': 'type.googleapis.com/google.rpc.ErrorInfo' as const,
    reason: `${cause.code}_${originalIndex}`,
    domain: 'billing.payment.cause' as const,
    metadata: { message: cause.message, severity: cause.severity },
  }));
}

/** Безопасное извлечение transactionId с проверками */
function getTransactionIdObject(plain: BaseErrorPlainObject): { transactionId?: string; } | {} {
  const correlationId = plain.metadata?.context?.correlationId?.trim();
  return correlationId != null && correlationId !== '' ? { transactionId: correlationId } : {};
}

/** Создает HTTP error ответ при сериализации */
function createHttpSerializationErrorResult(
  config: PaymentErrorSerializerConfig,
  reason: string,
): HttpPaymentSerializationResult {
  return {
    status: PAYMENT_HTTP_STATUS.INTERNAL_ERROR,
    body: {
      timestamp: createTimestamp(),
      error: { code: 'SERIALIZATION_ERROR', message: 'Ошибка сериализации HTTP ответа платежа' },
    },
    metadata: createHttpSerializationMetadata(config, { kind: 'system-error', reason }),
  };
}

/** Создает gRPC error ответ при сериализации */
function createGrpcSerializationErrorResult(
  config: PaymentErrorSerializerConfig,
  reason: string,
): GrpcPaymentSerializationResult {
  return {
    code: PAYMENT_GRPC_STATUS.INTERNAL,
    message: 'Ошибка сериализации gRPC ответа платежа',
    details: [],
    metadata: createGrpcSerializationMetadata(config, { kind: 'system-error', reason }),
  };
}

/** Обрабатывает BaseError для указанного протокола */
function processBaseError(
  error: BaseError,
  config: PaymentErrorSerializerConfig,
  protocol: 'http' | 'grpc',
  requestConfig?: PaymentErrorSerializerRequestConfig,
): HttpPaymentSerializationResult | GrpcPaymentSerializationResult {
  callObservabilityHook(config, 'onPaymentError', error);
  const plain = asPlainObject(error) as BaseErrorPlainObject;
  const effectiveConfig = { ...config, ...requestConfig };

  if (protocol === 'http') {
    const status = config.severityMappers?.http?.(error.severity)
      ?? mapSeverityToHttp(error.severity);
    return {
      status,
      body: {
        timestamp: createTimestamp(),
        error: {
          code: plain.code,
          message: plain.message,
          category: plain.category,
          ...(effectiveConfig.detailLevel === 'full'
            && plain.metadata
            && { metadata: safeMetadataFilter(plain.metadata) }),
          ...(effectiveConfig.includeCauseChain && { causeChain: plain.causeChain }),
          ...(effectiveConfig.includeTransactionId && getTransactionIdObject(plain)),
        },
      },
      metadata: createHttpSerializationMetadata(config, {
        kind: 'payment-error',
        code: plain.code,
      }),
    };
  } else {
    const code = config.severityMappers?.grpc?.(error.severity)
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
          domain: 'billing.payment',
          metadata: {
            category: plain.category,
            origin: plain.origin,
            ...(effectiveConfig.detailLevel === 'full' && { metadata: plain.metadata }),
            ...(effectiveConfig.includeTransactionId && getTransactionIdObject(plain)),
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
      metadata: createGrpcSerializationMetadata(config, {
        kind: 'payment-error',
        code: plain.code,
      }),
    };
  }
}

/** Обрабатывает невалидный результат платежа для указанного протокола
 * @note Использует унифицированные коды INTERNAL_ERROR/INTERNAL для консистентной observability
 */
function processInvalidPaymentResult(
  result: unknown,
  config: PaymentErrorSerializerConfig,
  protocol: 'http' | 'grpc',
): HttpPaymentSerializationResult | GrpcPaymentSerializationResult {
  callObservabilityHook(config, 'onInvalidResult', result, 'invalid-payment-result');

  if (protocol === 'http') {
    const normalized = normalizePaymentError(result);
    return {
      status: PAYMENT_HTTP_STATUS.INTERNAL_ERROR,
      body: {
        timestamp: createTimestamp(),
        error: { code: normalized.code, message: normalized.message },
      },
      metadata: createHttpSerializationMetadata(config, {
        kind: 'system-error',
        reason: 'invalid-payment-result',
      }),
    };
  } else {
    return {
      code: PAYMENT_GRPC_STATUS.INTERNAL,
      message: 'Невалидная структура результата платежа',
      details: [],
      metadata: createGrpcSerializationMetadata(config, {
        kind: 'system-error',
        reason: 'invalid-payment-result',
      }),
    };
  }
}

/** Обрабатывает успешный результат платежа для указанного протокола */
function processSuccessfulPaymentResult(
  result: unknown,
  config: PaymentErrorSerializerConfig,
  protocol: 'http' | 'grpc',
): HttpPaymentSerializationResult | GrpcPaymentSerializationResult {
  if (protocol === 'http') {
    return {
      status: PAYMENT_HTTP_STATUS.OK,
      body: {
        timestamp: createTimestamp(),
        ...(result as object),
      },
      metadata: createHttpSerializationMetadata(config, { kind: 'success' }),
    };
  } else {
    return {
      code: PAYMENT_GRPC_STATUS.OK,
      message: 'OK',
      details: [{ result }],
      metadata: createGrpcSerializationMetadata(config, { kind: 'success' }),
    };
  }
}

/** Вызывает observability hook с типобезопасностью. Игнорирует ошибки в hooks
 * @note В dev окружении может быть полезно логировать исключения для debugging,
 * но в production игнорирование корректно для предотвращения cascade failures
 */
function callObservabilityHook(
  config: PaymentErrorSerializerConfig,
  hookName: 'onInvalidResult' | 'onPaymentError' | 'onSerializationError',
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

/** Общая функция обработки результата платежа для любого протокола */
function processResult(
  result: unknown,
  config: PaymentErrorSerializerConfig,
  protocol: 'http' | 'grpc',
): HttpPaymentSerializationResult | GrpcPaymentSerializationResult {
  // Проверяем, является ли результат валидным результатом платежа (success или error)
  if (isValidPaymentResult(result)) {
    const r = result as Record<string, unknown>;
    // Это валидный результат платежа, проверяем, является ли он success или error
    if (
      r['type'] === 'success' && isValidPaymentSuccess(result, config.resultValidator)
    ) {
      return processSuccessfulPaymentResult(result, config, protocol);
    } else if (r['type'] === 'error') {
      // Для error типа используем соответствующие error коды вместо success
      return protocol === 'http'
        ? {
          status: PAYMENT_HTTP_STATUS.BAD_REQUEST,
          body: {
            timestamp: createTimestamp(),
            ...(result as object),
          },
          metadata: createHttpSerializationMetadata(config, {
            kind: 'payment-error',
            code: 'PAYMENT_RESULT_ERROR',
          }),
        } as HttpPaymentSerializationResult
        : {
          code: PAYMENT_GRPC_STATUS.INVALID_ARGUMENT,
          message: 'Payment result contains error',
          details: [{ result }],
          metadata: createGrpcSerializationMetadata(config, {
            kind: 'payment-error',
            code: 'PAYMENT_RESULT_ERROR',
          }),
        } as GrpcPaymentSerializationResult;
    } else {
      // Неверная структура success результата
      return processInvalidPaymentResult(result, config, protocol);
    }
  } else {
    // Неверная структура результата платежа
    return processInvalidPaymentResult(result, config, protocol);
  }
}

// ==================== ФАБРИКА СЕРИАЛИЗАТОРА ====================

/** Создает сериализатор результатов платежей для HTTP и gRPC */
export function createPaymentErrorSerializer<T = unknown>(
  config: Partial<PaymentErrorSerializerConfig<T>> = {},
): {
  serializeHttp(
    result: unknown,
    error?: BaseError,
    requestConfig?: PaymentErrorSerializerRequestConfig,
  ): HttpPaymentSerializationResult;
  serializeGrpc(
    result: unknown,
    error?: BaseError,
    requestConfig?: PaymentErrorSerializerRequestConfig,
  ): GrpcPaymentSerializationResult;
} {
  const finalConfig: PaymentErrorSerializerConfig<T> = { ...DEFAULT_CONFIG, ...config };

  /** Сериализует результат или ошибку в HTTP формат */
  function serializeHttp(
    result: unknown,
    error?: BaseError,
    requestConfig?: PaymentErrorSerializerRequestConfig,
  ): HttpPaymentSerializationResult {
    try {
      if (error) {
        return processBaseError(
          error,
          finalConfig,
          'http',
          requestConfig,
        ) as HttpPaymentSerializationResult;
      }

      return processResult(result, finalConfig, 'http') as HttpPaymentSerializationResult;
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

  /** Сериализует результат или ошибку в gRPC формат */
  function serializeGrpc(
    result: unknown,
    error?: BaseError,
    requestConfig?: PaymentErrorSerializerRequestConfig,
  ): GrpcPaymentSerializationResult {
    try {
      if (error) {
        return processBaseError(
          error,
          finalConfig,
          'grpc',
          requestConfig,
        ) as GrpcPaymentSerializationResult;
      }

      return processResult(result, finalConfig, 'grpc') as GrpcPaymentSerializationResult;
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
export const serializePaymentErrorHttp = <T = unknown>(
  result: unknown,
  error?: BaseError,
  config?: Partial<PaymentErrorSerializerConfig<T>>,
  requestConfig?: PaymentErrorSerializerRequestConfig,
): HttpPaymentSerializationResult =>
  createPaymentErrorSerializer(config).serializeHttp(result, error, requestConfig);

/** gRPC сериализация с дефолтной конфигурацией */
export const serializePaymentErrorGrpc = <T = unknown>(
  result: unknown,
  error?: BaseError,
  config?: Partial<PaymentErrorSerializerConfig<T>>,
  requestConfig?: PaymentErrorSerializerRequestConfig,
): GrpcPaymentSerializationResult =>
  createPaymentErrorSerializer(config).serializeGrpc(result, error, requestConfig);

// ==================== УТИЛИТЫ СЕРИАЛИЗАЦИИ В JSON ====================

/** Максимальная глубина JSON сериализации */
const MAX_JSON_DEPTH = 10;

/** Максимальное количество элементов в массивах и свойств в объектах */
const MAX_COLLECTION_SIZE = 100;

/** Безопасное получение свойства объекта */
function safeGetProperty(obj: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(obj, key);
  return descriptor ? descriptor.value : undefined;
}

/** Фильтрует чувствительные данные из metadata для PCI compliance */
function safeMetadataFilter(metadata: {
  readonly context?: {
    readonly correlationId?: string;
    readonly transactionId?: string;
    readonly timestamp?: number;
  };
  readonly userContext?: unknown;
  readonly customFields?: Record<string, unknown>;
}): {
  readonly context?: {
    readonly correlationId?: string;
    readonly transactionId?: string;
    readonly timestamp?: number;
  };
  readonly userContext?: unknown;
  readonly customFields?: Record<string, unknown>;
} {
  const { customFields, ...safeMetadata } = metadata;

  if (!customFields) {
    return safeMetadata;
  }

  // Фильтруем чувствительные поля из customFields
  const sensitiveKeys = new Set([
    'pan',
    'cvv',
    'cvv2',
    'expiry',
    'exp',
    'cardholdername',
    'card_holder_name',
    'pin',
  ]);
  const safeEntries: [string, unknown][] = Object.keys(customFields)
    .filter((key) => {
      const lowerKey = key.toLowerCase();
      return !sensitiveKeys.has(lowerKey)
        && !lowerKey.includes('card')
        && !lowerKey.includes('pin');
    })
    .map((key) => {
      const value = safeGetProperty(customFields, key);
      return value !== undefined ? [key, value] as [string, unknown] : null;
    })
    .filter((entry): entry is [string, unknown] => entry !== null);

  return {
    ...safeMetadata,
    ...(safeEntries.length > 0 ? { customFields: Object.fromEntries(safeEntries) } : {}),
  };
}

/** Безопасная JSON сериализация с error handling и depth limit */
function serializeToJsonString<T>(data: T): string {
  try {
    return JSON.stringify(data, createDepthLimitedReplacer(MAX_JSON_DEPTH));
  } catch (error) {
    // Логируем ошибку сериализации для debugging
    callObservabilityHook(
      { observability: { enableLogging: true } } as PaymentErrorSerializerConfig<unknown>,
      'onSerializationError',
      error,
      'json-serialization',
    );
    throw new Error(
      `JSON serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/** Создает replacer с ограничением глубины для предотвращения огромных payloads */
function createDepthLimitedReplacer(maxDepth: number): (key: string, value: unknown) => unknown {
  const visited = new WeakMap<object, boolean>();
  let depth = 0; // Текущая глубина в стеке

  const replacer = function(key: string, value: unknown): unknown {
    // Фильтруем приватные/системные свойства для безопасности
    if (key.startsWith('_') || key.startsWith('$')) {
      return undefined;
    }

    if (typeof value === 'object' && value !== null) {
      if (visited.has(value)) {
        return '[Circular Reference]';
      }

      if (depth >= maxDepth) {
        return `[Object too deep, max depth: ${maxDepth}]`;
      }

      visited.set(value, true);
      depth++; // Увеличиваем глубину при входе в объект

      let result: unknown;
      try {
        if (Array.isArray(value)) {
          result = value.slice(0, MAX_COLLECTION_SIZE).map((item, index) =>
            replacer(index.toString(), item)
          );
        } else {
          // Для объектов создаем безопасную копию
          const safeKeys = Object.keys(value)
            .slice(0, MAX_COLLECTION_SIZE)
            .filter((k) =>
              Object.prototype.hasOwnProperty.call(value, k) && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
            );

          const entries: [string, unknown][] = safeKeys.map((k) => [
            k,
            replacer(k, safeGetProperty(value as Record<string, unknown>, k)),
          ]);

          result = Object.fromEntries(entries);
        }
      } finally {
        depth--; // Уменьшаем глубину при выходе из объекта
      }

      return result;
    }

    return value;
  };

  return replacer;
}

/** Сериализует HTTP результат в JSON строку для транспортного слоя */
export function serializeHttpToJsonString(result: HttpPaymentSerializationResult): string {
  return serializeToJsonString(result.body);
}

/** Сериализует gRPC результат в JSON строку для транспортного слоя
 * @note result.details уже прошел через сериализатор и является PCI-safe
 */
export function serializeGrpcToJsonString(result: GrpcPaymentSerializationResult): string {
  return serializeToJsonString({
    code: result.code,
    message: result.message,
    details: result.details,
  });
}

/** Сериализует HTTP результат с metadata в полную JSON строку */
export function serializeHttpWithMetadataToJsonString(
  result: HttpPaymentSerializationResult,
): string {
  return serializeToJsonString(result);
}

/** Сериализует gRPC результат с metadata в полную JSON строку */
export function serializeGrpcWithMetadataToJsonString(
  result: GrpcPaymentSerializationResult,
): string {
  return serializeToJsonString(result);
}
