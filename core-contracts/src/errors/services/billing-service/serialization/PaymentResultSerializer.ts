/**
 * @file PaymentResultSerializer.ts
 * Сериализация результатов платежных операций для HTTP / gRPC.
 *
 * Назначение:
 *  - Валидация и нормализация результатов платежей (PaymentSuccess, PaymentError)
 *  - Маппинг в HTTP status codes и gRPC status codes без severity mapping
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

import { isValidPaymentResult, isValidPaymentSuccess } from '../BillingServiceValidators.js';

// ==================== КОНСТАНТЫ ====================

/** HTTP статус коды для результатов платежей */
export const PAYMENT_RESULT_HTTP_STATUS = Object.freeze(
  {
    OK: 200,
    BAD_REQUEST: 400,
    FAILED_PRECONDITION: 412, // Для бизнес-правил платежей
    INTERNAL_ERROR: 500,
  } as const,
);

/** gRPC статус коды для результатов платежей */
export const PAYMENT_RESULT_GRPC_STATUS = Object.freeze(
  {
    OK: 0,
    INVALID_ARGUMENT: 3,
    FAILED_PRECONDITION: 9, // Для бизнес-правил платежей
    INTERNAL: 13,
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
  readonly provider?: string; // Название провайдера, не чувствительные данные
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
  readonly operation?: string;
};

/** Унифицированный результат платежной операции */
export type PaymentResult<T = unknown> = PaymentSuccess<T> | PaymentError;

// ==================== КОНФИГУРАЦИЯ СЕРИАЛИЗАТОРА ====================

/** Request-specific переопределения конфигурации */
export type PaymentResultSerializerRequestConfig = Partial<
  Pick<
    PaymentResultSerializerConfig,
    'includeTransactionId'
  >
>;

/** Конфигурация сериализации результатов платежей */
export type PaymentResultSerializerConfig<T = unknown> = {
  readonly includeTransactionId: boolean;
  readonly resultValidator?: (result: unknown) => result is T;
  readonly observability?: {
    /** Включает observability hooks */
    readonly enableLogging: boolean;
    /** Вызывается при невалидном результате платежа */
    readonly onInvalidResult?: (result: unknown, error?: string) => void;
    /** Вызывается при сериализации payment error */
    readonly onPaymentError?: (error: PaymentError) => void;
    /** Вызывается при ошибках сериализации */
    readonly onSerializationError?: (error: unknown, context: string) => void;
  };
};

// ==================== РЕЗУЛЬТАТЫ СЕРИАЛИЗАЦИИ ====================

/** Outcome сериализации для observability */
export type PaymentResultSerializationOutcome =
  | { readonly kind: 'success'; }
  | { readonly kind: 'payment-error'; readonly code: string; }
  | { readonly kind: 'invalid-result'; }
  | { readonly kind: 'system-error'; readonly reason: string; };

/** HTTP результат сериализации платежа */
export type HttpPaymentResultSerializationResult = {
  readonly status: number;
  readonly body: {
    readonly timestamp: string;
    readonly result?: unknown;
    readonly error?: unknown;
    readonly [key: string]: unknown;
  };
  readonly metadata: {
    readonly serializer: 'payment-result-http';
    readonly timestamp: string;
    readonly config: { readonly includeTransactionId: boolean; };
    readonly outcome: PaymentResultSerializationOutcome;
  };
};

/** gRPC результат сериализации платежа */
export type GrpcPaymentResultSerializationResult = {
  readonly code: number;
  readonly message: string;
  /**
   * gRPC details array - expected schemas:
   * For success: [{ result: PaymentSuccess }]
   * For payment-error: [{ error: { code: string, message: string, details?: PaymentErrorDetails } }]
   * For invalid-result: [] (empty array)
   * For system-error: [] (empty array)
   *
   * ⚠️ Clients should check outcome in metadata first, then parse details accordingly
   */
  readonly details: readonly Record<string, unknown>[];
  readonly metadata: {
    readonly serializer: 'payment-result-grpc';
    readonly timestamp: string;
    readonly config: { readonly includeTransactionId: boolean; };
    readonly outcome: PaymentResultSerializationOutcome;
  };
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/** Создает timestamp для сериализации */
const createTimestamp = (): string => new Date().toISOString();

/** Создает metadata объект для HTTP сериализации */
const createHttpSerializationMetadata = (
  config: { readonly includeTransactionId: boolean; },
  outcome: PaymentResultSerializationOutcome,
): {
  readonly serializer: 'payment-result-http';
  readonly timestamp: string;
  readonly config: { readonly includeTransactionId: boolean; };
  readonly outcome: PaymentResultSerializationOutcome;
} => ({
  serializer: 'payment-result-http',
  timestamp: createTimestamp(),
  config,
  outcome,
});

/** Создает metadata объект для gRPC сериализации */
const createGrpcSerializationMetadata = (
  config: { readonly includeTransactionId: boolean; },
  outcome: PaymentResultSerializationOutcome,
): {
  readonly serializer: 'payment-result-grpc';
  readonly timestamp: string;
  readonly config: { readonly includeTransactionId: boolean; };
  readonly outcome: PaymentResultSerializationOutcome;
} => ({
  serializer: 'payment-result-grpc',
  timestamp: createTimestamp(),
  config,
  outcome,
});

/** Нормализует результат платежа - только отсечение лишнего, без defaults */
function normalizePaymentResult<T>(
  result: PaymentResult<T>,
  config: PaymentResultSerializerConfig<T> & PaymentResultSerializerRequestConfig,
): PaymentResult<T> | Omit<PaymentSuccess<T>, 'transactionId'> {
  if (result.type === 'success') {
    const { transactionId, ...rest } = result;
    return config.includeTransactionId
      ? { ...rest, transactionId }
      : rest;
  }

  // Для ошибок просто возвращаем как есть (уже PCI-safe)
  return result;
}

/** Обрабатывает успешный результат платежа для указанного протокола */
function processSuccessfulPaymentResult<T>(
  result: PaymentSuccess<T>,
  config: PaymentResultSerializerConfig<T>,
  protocol: 'http' | 'grpc',
): HttpPaymentResultSerializationResult | GrpcPaymentResultSerializationResult {
  const normalizedResult = normalizePaymentResult(result, config);

  if (protocol === 'http') {
    return {
      status: PAYMENT_RESULT_HTTP_STATUS.OK,
      body: {
        timestamp: createTimestamp(),
        // Intentional passthrough: operation, result, transactionId, amount, currency, provider
        ...(normalizedResult as object),
      },
      metadata: createHttpSerializationMetadata(
        { includeTransactionId: config.includeTransactionId },
        { kind: 'success' },
      ),
    };
  } else {
    return {
      code: PAYMENT_RESULT_GRPC_STATUS.OK,
      message: 'OK',
      details: [{ result: normalizedResult }],
      metadata: createGrpcSerializationMetadata(
        { includeTransactionId: config.includeTransactionId },
        { kind: 'success' },
      ),
    };
  }
}

/** Обрабатывает ошибочный результат платежа для указанного протокола */
function processPaymentErrorResult<T>(
  result: PaymentError,
  config: PaymentResultSerializerConfig<T>,
  protocol: 'http' | 'grpc',
): HttpPaymentResultSerializationResult | GrpcPaymentResultSerializationResult {
  callObservabilityHook(config, 'onPaymentError', result);

  if (protocol === 'http') {
    const errorResult = result;
    // TODO: Будущая доработка - маппинг кодов ошибок на специфические HTTP статусы
    // 402 PAYMENT_REQUIRED для бизнес-ошибок связанных с платежами
    // 409 CONFLICT для конфликтов подписок/состояний
    // 422 UNPROCESSABLE_ENTITY для ошибок валидации
    // Сейчас используем BAD_REQUEST как fallback, FAILED_PRECONDITION зарезервирован для будущего
    const status = PAYMENT_RESULT_HTTP_STATUS.BAD_REQUEST;

    return {
      status,
      body: {
        timestamp: createTimestamp(),
        error: errorResult.error,
      },
      metadata: createHttpSerializationMetadata(
        { includeTransactionId: config.includeTransactionId },
        {
          kind: 'payment-error',
          code: errorResult.error.code,
        },
      ),
    };
  } else {
    const errorResult = result;
    return {
      code: PAYMENT_RESULT_GRPC_STATUS.INVALID_ARGUMENT,
      message: errorResult.error.message,
      details: [{ error: errorResult.error }],
      metadata: createGrpcSerializationMetadata(
        { includeTransactionId: config.includeTransactionId },
        {
          kind: 'payment-error',
          code: errorResult.error.code,
        },
      ),
    };
  }
}

/** Обрабатывает невалидный результат платежа для указанного протокола */
function processInvalidPaymentResult(
  result: unknown,
  config: PaymentResultSerializerConfig,
  protocol: 'http' | 'grpc',
): HttpPaymentResultSerializationResult | GrpcPaymentResultSerializationResult {
  callObservabilityHook(config, 'onInvalidResult', result, 'invalid-payment-result');

  if (protocol === 'http') {
    return {
      status: PAYMENT_RESULT_HTTP_STATUS.INTERNAL_ERROR,
      body: {
        timestamp: createTimestamp(),
        error: {
          code: 'INVALID_PAYMENT_RESULT',
          message: 'Невалидная структура результата платежа',
        },
      },
      metadata: createHttpSerializationMetadata(
        { includeTransactionId: config.includeTransactionId },
        { kind: 'invalid-result' },
      ),
    };
  } else {
    return {
      code: PAYMENT_RESULT_GRPC_STATUS.INTERNAL,
      message: 'Невалидная структура результата платежа',
      details: [],
      metadata: createGrpcSerializationMetadata(
        { includeTransactionId: config.includeTransactionId },
        { kind: 'invalid-result' },
      ),
    };
  }
}

/** Вызывает observability hook с типобезопасностью */
function callObservabilityHook(
  config: PaymentResultSerializerConfig,
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
function processResult<T>(
  result: unknown,
  config: PaymentResultSerializerConfig<T>,
  protocol: 'http' | 'grpc',
): HttpPaymentResultSerializationResult | GrpcPaymentResultSerializationResult {
  // Только структурная валидация (семантическая проверка выполняется ниже)
  if (isValidPaymentResult(result)) {
    // TypeScript теперь знает, что result имеет тип PaymentResult<T>
    if (result.type === 'success' && isValidPaymentSuccess(result, config.resultValidator)) {
      return processSuccessfulPaymentResult(result, config, protocol);
    } else if (result.type === 'error') {
      return processPaymentErrorResult(result, config, protocol);
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
export function createPaymentResultSerializer<T = unknown>(
  config: Partial<PaymentResultSerializerConfig<T>> = {},
): {
  serializeHttp(
    result: unknown,
    requestConfig?: PaymentResultSerializerRequestConfig,
  ): HttpPaymentResultSerializationResult;
  serializeGrpc(
    result: unknown,
    requestConfig?: PaymentResultSerializerRequestConfig,
  ): GrpcPaymentResultSerializationResult;
} {
  const finalConfig: PaymentResultSerializerConfig<T> = {
    includeTransactionId: true,
    observability: {
      enableLogging: false,
    },
    ...config,
  };

  /** Сериализует результат в HTTP формат */
  function serializeHttp(
    result: unknown,
    requestConfig?: PaymentResultSerializerRequestConfig,
  ): HttpPaymentResultSerializationResult {
    try {
      const effectiveConfig = { ...finalConfig, ...requestConfig };
      return processResult(result, effectiveConfig, 'http') as HttpPaymentResultSerializationResult;
    } catch (serializationError) {
      callObservabilityHook(
        finalConfig,
        'onSerializationError',
        serializationError,
        'serializeHttp',
      );
      return {
        status: PAYMENT_RESULT_HTTP_STATUS.INTERNAL_ERROR,
        body: {
          timestamp: createTimestamp(),
          error: {
            code: 'SERIALIZATION_ERROR',
            message: 'Ошибка сериализации HTTP ответа платежа',
          },
        },
        metadata: createHttpSerializationMetadata(
          { includeTransactionId: finalConfig.includeTransactionId },
          {
            kind: 'system-error',
            reason: 'serialization-failed',
          },
        ),
      };
    }
  }

  /** Сериализует результат в gRPC формат */
  function serializeGrpc(
    result: unknown,
    requestConfig?: PaymentResultSerializerRequestConfig,
  ): GrpcPaymentResultSerializationResult {
    try {
      const effectiveConfig = { ...finalConfig, ...requestConfig };
      return processResult(result, effectiveConfig, 'grpc') as GrpcPaymentResultSerializationResult;
    } catch (serializationError) {
      callObservabilityHook(
        finalConfig,
        'onSerializationError',
        serializationError,
        'serializeGrpc',
      );
      return {
        code: PAYMENT_RESULT_GRPC_STATUS.INTERNAL,
        message: 'Ошибка сериализации gRPC ответа платежа',
        details: [],
        metadata: createGrpcSerializationMetadata(
          { includeTransactionId: finalConfig.includeTransactionId },
          {
            kind: 'system-error',
            reason: 'serialization-failed',
          },
        ),
      };
    }
  }

  return { serializeHttp, serializeGrpc };
}

// ==================== ДЕФОЛТНЫЕ ХЕЛПЕРЫ ====================

/** HTTP сериализация с дефолтной конфигурацией */
export const serializePaymentResultHttp = <T = unknown>(
  result: unknown,
  config?: Partial<PaymentResultSerializerConfig<T>>,
  requestConfig?: PaymentResultSerializerRequestConfig,
): HttpPaymentResultSerializationResult =>
  createPaymentResultSerializer(config).serializeHttp(result, requestConfig);

/** gRPC сериализация с дефолтной конфигурацией */
export const serializePaymentResultGrpc = <T = unknown>(
  result: unknown,
  config?: Partial<PaymentResultSerializerConfig<T>>,
  requestConfig?: PaymentResultSerializerRequestConfig,
): GrpcPaymentResultSerializationResult =>
  createPaymentResultSerializer(config).serializeGrpc(result, requestConfig);

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

/**
 * Transport helper для JSON сериализации.
 * ⚠️ НЕ core бизнес-логика сериализатора результатов!
 * Это utility для HTTP/gRPC transport слоя.
 *
 * SRP: PaymentResultSerializer отвечает за бизнес-логику сериализации,
 * а JSON utilities - за transport formatting.
 */
function serializeToJsonString<T>(data: T): string {
  try {
    return JSON.stringify(data, createDepthLimitedReplacer(MAX_JSON_DEPTH));
  } catch (error) {
    // Логируем ошибку сериализации для debugging
    callObservabilityHook(
      { observability: { enableLogging: true } } as PaymentResultSerializerConfig<unknown>,
      'onSerializationError',
      error,
      'json-serialization',
    );
    // Возвращаем fallback вместо throw для соблюдения функционального стиля
    return '{"error": "JSON serialization failed"}';
  }
}

/**
 * Transport utility для создания JSON replacer с depth limiting.
 * ⚠️ НЕ core бизнес-логика! Utility для transport слоя.
 *
 * Использует стек для надежного отслеживания глубины (не зависит от this контекста).
 */
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
export function serializeHttpResultToJsonString(
  result: HttpPaymentResultSerializationResult,
): string {
  return serializeToJsonString(result.body);
}

/** Сериализует gRPC результат в JSON строку для транспортного слоя */
export function serializeGrpcResultToJsonString(
  result: GrpcPaymentResultSerializationResult,
): string {
  return serializeToJsonString({
    code: result.code,
    message: result.message,
    details: result.details,
  });
}

/** Сериализует HTTP результат с metadata в полную JSON строку */
export function serializeHttpResultWithMetadataToJsonString(
  result: HttpPaymentResultSerializationResult,
): string {
  return serializeToJsonString(result);
}

/** Сериализует gRPC результат с metadata в полную JSON строку */
export function serializeGrpcResultWithMetadataToJsonString(
  result: GrpcPaymentResultSerializationResult,
): string {
  return serializeToJsonString(result);
}
