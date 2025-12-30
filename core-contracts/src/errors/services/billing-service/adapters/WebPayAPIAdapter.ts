/**
 * @file WebPayAPIAdapter.ts
 *
 * Адаптер WebPay API на Effect-TS v3.
 *
 * Принципы:
 *  - Микросервисность: чистые границы, зависимости через Layer/Context.
 *  - Полнота: типобезопасные модели запросов/ответов и ошибок.
 *  - Дальновидность: circuit breaker, backoff, observability hooks.
 *  - Устойчивость: timeout, retry только для инфраструктурных ошибок.
 *  - Чистота: отсутствует доступ к чувствительным данным карт.
 *  - Архитектура: SDK isolation, transport-agnostic, typed boundary.
 */

import { Context, Duration, Effect, Layer, Ref, Schedule } from 'effect';
import type { Duration as DurationType } from 'effect/Duration';

import type { SupportedCurrency, SupportedPaymentMethod } from '../domain/index.js';
import type {
  WebPayAPIError,
  WebPayErrorCode,
  WebPayTransactionStatus,
} from '../infrastructure/WebPayAPIError.js';

// ==================== ДОМЕННЫЕ ТИПЫ ====================

/** Входной запрос на создание платежа */
export type WebPayPaymentRequest = {
  readonly amount: number; // Сумма в минимальных единицах валюты
  readonly currency: SupportedCurrency;
  readonly orderId: string; // Merchant order ID
  readonly paymentMethod?: SupportedPaymentMethod;
  /** Ключ идемпотентности (UUID v4 или ULID), обязательный для защиты от дубликатов */
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
};

/** Bulk запрос на проверку статусов платежей (для будущего) */
export type WebPayBulkStatusRequest = {
  readonly transactionIds: readonly string[];
  readonly includeRawResponse?: boolean;
};

/** Bulk ответ со статусами платежей (для будущего) */
export type WebPayBulkStatusResponse = {
  readonly results: readonly WebPayPaymentResponse[];
  readonly failedIds: readonly string[]; // ID которые не удалось проверить
};

/** Ответ платежного шлюза */
export type WebPayPaymentResponse = {
  readonly transactionId: string; // WebPay transaction ID
  readonly orderId: string; // Merchant order ID
  readonly status: WebPayTransactionStatus;
  readonly amount: number;
  readonly currency: SupportedCurrency;
  readonly timestamp: string;
  /** Raw SDK response (для отладки, наружу не выводится) */
  readonly raw?: unknown;
};

// ==================== ОШИБКИ АДАПТЕРА ====================

const CONNECTION_ERROR_TAG = 'ConnectionError' as const;
const INVALID_REQUEST_ERROR_TAG = 'InvalidRequestError' as const;
const UNAUTHORIZED_ERROR_TAG = 'UnauthorizedError' as const;
const PAYMENT_DECLINED_ERROR_TAG = 'PaymentDeclinedError' as const;
const PROCESSING_ERROR_TAG = 'ProcessingError' as const;
const UNKNOWN_ERROR_TAG = 'UnknownError' as const;

export type WebPayAdapterError =
  | {
    readonly _tag: typeof CONNECTION_ERROR_TAG;
    readonly message: string;
    readonly cause?: unknown;
  }
  | {
    readonly _tag: typeof INVALID_REQUEST_ERROR_TAG;
    readonly message: string;
    readonly details?: unknown;
  }
  | { readonly _tag: typeof UNAUTHORIZED_ERROR_TAG; readonly message: string; }
  | {
    readonly _tag: typeof PAYMENT_DECLINED_ERROR_TAG;
    readonly message: string;
    readonly code?: WebPayErrorCode;
  }
  | {
    readonly _tag: typeof PROCESSING_ERROR_TAG;
    readonly message: string;
    readonly cause?: unknown;
  }
  | {
    readonly _tag: typeof UNKNOWN_ERROR_TAG;
    readonly message: string;
    readonly cause?: unknown;
  };

// ==================== КОНФИГУРАЦИЯ ====================

/** Конфигурация адаптера */
export type WebPayAdapterConfig = {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly merchantId: string;
  readonly requestTimeoutMs: number;
  readonly defaultCurrency: SupportedCurrency;
  readonly maxRetryAttempts: number;
  readonly retryInitialDelayMs: number;
  readonly retryMaxDelayMs: number;
  /** Список HTTP статусов, при которых разрешены retry (например 429/5xx) */
  readonly retryOnStatus?: readonly number[];
  readonly observability?: {
    readonly enableLogging: boolean;
    readonly onSdkCall?: (method: string, params: unknown) => void;
    readonly onSdkSuccess?: (method: string, response: WebPaySDKResponse) => void;
    readonly onSdkError?: (method: string, error: WebPayAdapterError) => void;
    readonly onRetry?: (method: string, attempt: number, error: WebPayAdapterError) => void;
    /** Срабатывает при смене состояния circuit breaker */
    readonly onCircuitStateChange?: (
      from: CircuitBreakerState['status'],
      to: CircuitBreakerState['status'],
      metadata: { readonly failureCount: number; readonly openedAt?: number; },
    ) => void;
  };
  readonly circuitBreaker?: CircuitBreakerConfig;
  /** Маскировать raw в observability/logs для prod */
  readonly maskRaw?: boolean;
};

// ==================== SDK АБСТРАКЦИЯ ====================

/** Изолированный контракт WebPay SDK */
export type WebPaySDK = {
  createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    paymentMethod?: string;
    idempotencyKey?: string;
  }): Promise<WebPaySDKResponse>;

  getPaymentStatus(transactionId: string): Promise<WebPaySDKResponse>;

  cancelPayment(transactionId: string): Promise<WebPaySDKResponse>;
};

type WebPaySDKResponse = {
  transactionId: string;
  orderId: string;
  status: WebPayTransactionStatus;
  amount: number;
  currency: string;
  timestamp: string;
  raw?: unknown;
};

// ==================== CONTEXT ====================

export const webPaySDKContext = Context.GenericTag<WebPaySDK>('@billing/WebPaySDK');
export const webPayConfigContext = Context.GenericTag<WebPayAdapterConfig>('@billing/WebPayConfig');

// ==================== CIRCUIT BREAKER ====================

export type CircuitBreakerState = {
  readonly status: 'closed' | 'open' | 'half-open';
  readonly failureCount: number;
  readonly lastFailureTime: number;
  readonly openedAt?: number;
  readonly halfOpenRequestCount: number;
};

const initialCircuitBreakerState: CircuitBreakerState = {
  status: 'closed',
  failureCount: 0,
  lastFailureTime: 0,
  halfOpenRequestCount: 0,
} as const;

/** Сервис circuit breaker, скрывает Ref внутри */
export type CircuitBreakerService = {
  readonly state: Ref.Ref<CircuitBreakerState>;
};

export const circuitBreakerContext = Context.GenericTag<CircuitBreakerService>(
  '@billing/CircuitBreaker',
);

export type CircuitBreakerConfig = {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly halfOpenMaxRequests: number;
  /** Необязательное поле для обратной совместимости, не используется */
  readonly halfOpenRequestCount?: number;
};

// ==================== NETWORK ERROR HANDLING ====================

const HTTP_STATUS = Object.freeze(
  {
    INTERNAL_SERVER_ERROR: 500,
    RATE_LIMITED: 429,
  } as const,
);

const connectionError = (message: string, cause?: unknown): WebPayAdapterError =>
  cause !== undefined && cause !== null
    ? { _tag: CONNECTION_ERROR_TAG, message, cause }
    : { _tag: CONNECTION_ERROR_TAG, message };

const invalidRequestError = (message: string, details?: unknown): WebPayAdapterError =>
  details !== undefined && details !== null
    ? { _tag: INVALID_REQUEST_ERROR_TAG, message, details }
    : { _tag: INVALID_REQUEST_ERROR_TAG, message };

const unauthorizedError = (message: string): WebPayAdapterError => ({
  _tag: UNAUTHORIZED_ERROR_TAG,
  message,
});

const paymentDeclinedError = (message: string, code?: WebPayErrorCode): WebPayAdapterError => ({
  _tag: PAYMENT_DECLINED_ERROR_TAG,
  message,
  ...(code ? { code } : {}),
});

const processingError = (message: string, cause?: unknown): WebPayAdapterError =>
  cause !== undefined && cause !== null
    ? { _tag: PROCESSING_ERROR_TAG, message, cause }
    : { _tag: PROCESSING_ERROR_TAG, message };

const unknownError = (message: string, cause?: unknown): WebPayAdapterError =>
  cause !== undefined && cause !== null
    ? { _tag: UNKNOWN_ERROR_TAG, message, cause }
    : { _tag: UNKNOWN_ERROR_TAG, message };

function normalizeNetworkError(
  error: unknown,
  operationName: string,
  config?: WebPayAdapterConfig,
): WebPayAdapterError {
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    const errorCode = e['code'];
    const status = e['status']
      ?? e['statusCode']
      ?? (e['response'] as { [key: string]: unknown; } | undefined)?.['status'];

    const isNetCode = (code?: unknown): code is string =>
      typeof code === 'string'
      && (code === 'ECONNREFUSED'
        || code === 'ENOTFOUND'
        || code === 'ECONNRESET'
        || code === 'ETIMEDOUT'
        || code === 'ESOCKETTIMEDOUT'
        || code === 'ENETUNREACH');

    if (isNetCode(errorCode)) {
      return connectionError(`Network error during ${operationName}: ${errorCode}`, error);
    }

    if (errorCode === 'EAI_AGAIN' || errorCode === 'EAI_FAIL') {
      return connectionError(`DNS resolution failed during ${operationName}: ${errorCode}`, error);
    }

    if (
      errorCode === 'CERT_HAS_EXPIRED'
      || errorCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      || errorCode === 'SELF_SIGNED_CERT_IN_CHAIN'
    ) {
      return connectionError(`SSL/TLS error during ${operationName}: ${errorCode}`, error);
    }

    if (typeof status === 'number') {
      const retryStatuses = config?.retryOnStatus ?? [];
      if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR || retryStatuses.includes(status)) {
        return connectionError(`Server error during ${operationName}: HTTP ${status}`, error);
      }
      if (status === HTTP_STATUS.RATE_LIMITED) {
        return processingError(`Rate limited during ${operationName}: HTTP ${status}`, error);
      }
    }

    if (
      (typeof errorCode === 'string'
        && (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT'))
      || e['timeout'] === true
      || e['isTimeout'] === true
    ) {
      return processingError(`Request timeout during ${operationName}`, error);
    }
  }

  if (typeof error === 'string') {
    return unknownError(`Unexpected error during ${operationName}: ${error}`, error);
  }

  return unknownError(`Unhandled error during ${operationName}: ${String(error)}`, error);
}

// ==================== OBSERVABILITY ====================

function callObservabilityHook(
  config: WebPayAdapterConfig,
  hookName: 'onSdkCall' | 'onSdkSuccess' | 'onSdkError' | 'onRetry' | 'onCircuitStateChange',
  ...args: unknown[]
): void {
  if (config.observability?.enableLogging !== true) return;

  const hookValue = Reflect.get(config.observability, hookName) as
    | ((...args: unknown[]) => void)
    | undefined;

  if (!hookValue) return;

  try {
    hookValue(...args);
  } catch {
    // Игнорируем ошибки observability ради устойчивости
  }
}

// ==================== HELPER FUNCTIONS ====================

function normalizeWebPayResponse(
  raw: WebPaySDKResponse,
  config: WebPayAdapterConfig,
  customNormalizer?: (raw: WebPaySDKResponse, config: WebPayAdapterConfig) => WebPayPaymentResponse,
): WebPayPaymentResponse {
  if (customNormalizer) {
    return customNormalizer(raw, config);
  }

  const safeRaw = config.maskRaw === true ? undefined : raw.raw;

  return {
    transactionId: raw.transactionId || '',
    orderId: raw.orderId || '',
    status: raw.status,
    amount: raw.amount,
    currency: raw.currency ? (raw.currency as SupportedCurrency) : config.defaultCurrency,
    timestamp: raw.timestamp || new Date().toISOString(),
    raw: safeRaw,
  };
}

function isRetryableError(error: WebPayAdapterError): boolean {
  return error._tag === CONNECTION_ERROR_TAG || error._tag === PROCESSING_ERROR_TAG;
}

function createRetrySchedule(
  config: WebPayAdapterConfig,
): Schedule.Schedule<DurationType, WebPayAdapterError, never> {
  const EXPONENTIAL_MULTIPLIER = 2.0;
  const base = Schedule.exponential(
    Duration.millis(config.retryInitialDelayMs),
    EXPONENTIAL_MULTIPLIER,
  );
  if (config.retryMaxDelayMs > 0) {
    const maxDelay = Duration.millis(config.retryMaxDelayMs);
    const capped = Schedule.intersect(base, Schedule.spaced(maxDelay));
    return Schedule.map(capped, ([d]) => d).pipe(Schedule.upTo(config.maxRetryAttempts));
  }
  return base.pipe(Schedule.upTo(config.maxRetryAttempts));
}

// ==================== ERROR MAPPING ====================

export function mapWebPayError(error: unknown): WebPayAdapterError {
  if (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'WebPayAPIError'
  ) {
    const webpayError = error as WebPayAPIError;
    const details = webpayError.details ?? {};
    const webpayCode = details.webpayCode;

    if (webpayCode) {
      const declinedCodes: WebPayErrorCode[] = [
        'payment_declined',
        'insufficient_funds',
        'card_expired',
        'card_blocked',
        'invalid_card_number',
        'invalid_cvv',
        'duplicate_transaction',
      ];

      if (declinedCodes.includes(webpayCode)) {
        return paymentDeclinedError(webpayError.message, webpayCode);
      }
    }

    const httpStatus = details.httpStatus;
    const BAD_GATEWAY = 502;
    const SERVICE_UNAVAILABLE = 503;
    const GATEWAY_TIMEOUT = 504;
    const REQUEST_TIMEOUT = 408;

    if (
      httpStatus
      && [BAD_GATEWAY, SERVICE_UNAVAILABLE, GATEWAY_TIMEOUT, REQUEST_TIMEOUT].includes(httpStatus)
    ) {
      return connectionError(`WebPay connection failed: HTTP ${httpStatus}`, error);
    }

    const UNAUTHORIZED_STATUS = 401;
    if (httpStatus === UNAUTHORIZED_STATUS) {
      return unauthorizedError('Unauthorized WebPay request');
    }

    const BAD_REQUEST_STATUS = 400;
    if (httpStatus === BAD_REQUEST_STATUS) {
      return invalidRequestError('Invalid WebPay request', details);
    }
  }

  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;

    const code = e['code'];
    if (
      typeof code === 'string'
      && (code === 'ECONNREFUSED'
        || code === 'ENOTFOUND'
        || code === 'ETIMEDOUT'
        || code === 'ECONNRESET'
        || code === 'ESOCKETTIMEDOUT'
        || code === 'ENETUNREACH')
    ) {
      return connectionError(`WebPay network error: ${code}`, error);
    }

    if (e['code'] === 'EAI_AGAIN' || e['code'] === 'EAI_FAIL') {
      return connectionError(`WebPay DNS resolution failed: ${e['code']}`, error);
    }

    if (
      e['code'] === 'CERT_HAS_EXPIRED'
      || e['code'] === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      || e['code'] === 'SELF_SIGNED_CERT_IN_CHAIN'
    ) {
      return connectionError(`WebPay SSL/TLS error: ${e['code']}`, error);
    }

    const status = e['status'] ?? e['statusCode'];
    if (typeof status === 'number' && status === HTTP_STATUS.RATE_LIMITED) {
      return processingError('WebPay rate limited', error);
    }

    if (e['code'] === 'ETIMEDOUT') {
      return processingError('WebPay request timeout', error);
    }
  }

  return unknownError('Unhandled WebPay SDK error', error);
}

// ==================== IDEMPOTENCY KEY ====================

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function validateIdempotencyKey(
  key?: string,
): Effect.Effect<string | undefined, WebPayAdapterError, never> {
  if (key == null) return Effect.succeed(undefined);
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return Effect.fail(invalidRequestError('IdempotencyKey must be non-empty'));
  }
  const isValid = uuidV4Regex.test(trimmed) || ulidRegex.test(trimmed);
  if (!isValid) {
    return Effect.fail(invalidRequestError('IdempotencyKey must be UUID v4 или ULID'));
  }
  return Effect.succeed(trimmed);
}

// ==================== RESILIENCE LAYER ====================

/** Обертывает эффект circuit breaker-сервисом, если включен в конфиге */
function withCircuitBreaker<A, R>(
  operationName: string,
  config: WebPayAdapterConfig,
  effect: Effect.Effect<A, WebPayAdapterError, R | CircuitBreakerService>,
): Effect.Effect<A, WebPayAdapterError, R | CircuitBreakerService> {
  if (!config.circuitBreaker) return effect;

  const cbConfig = config.circuitBreaker;

  return Effect.gen(function*() {
    const { state: stateRef } = yield* circuitBreakerContext;
    const now = Date.now();
    let current = yield* Ref.get(stateRef);

    if (
      current.status === 'open'
      && current.openedAt !== undefined
      && now - current.openedAt < cbConfig.resetTimeoutMs
    ) {
      return yield* Effect.fail(processingError(`Circuit breaker open for ${operationName}`));
    }

    if (
      current.status === 'open'
      && current.openedAt !== undefined
      && now - current.openedAt >= cbConfig.resetTimeoutMs
    ) {
      const nextState: CircuitBreakerState = {
        status: 'half-open',
        failureCount: current.failureCount,
        lastFailureTime: current.lastFailureTime,
        openedAt: current.openedAt,
        halfOpenRequestCount: 0,
      };
      yield* Ref.set(stateRef, nextState);
      callObservabilityHook(
        config,
        'onCircuitStateChange',
        current.status,
        nextState.status,
        {
          failureCount: nextState.failureCount,
          openedAt: nextState.openedAt,
          halfOpenRequestCount: nextState.halfOpenRequestCount,
        },
      );
      current = nextState;
    }

    if (
      current.status === 'half-open' && current.halfOpenRequestCount >= cbConfig.halfOpenMaxRequests
    ) {
      return yield* Effect.fail(
        processingError(`Circuit breaker half-open limit reached for ${operationName}`),
      );
    }

    if (current.status === 'half-open') {
      yield* Ref.update<CircuitBreakerState>(stateRef, (state): CircuitBreakerState => ({
        ...state,
        halfOpenRequestCount: state.halfOpenRequestCount + 1,
      }));
    }

    const updated = yield* Ref.get(stateRef);
    const fromStatus = updated.status;

    return yield* effect.pipe(
      Effect.tapBoth({
        onSuccess: () =>
          Ref.set(stateRef, initialCircuitBreakerState).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                callObservabilityHook(
                  config,
                  'onCircuitStateChange',
                  fromStatus,
                  'closed',
                  { failureCount: 0, openedAt: undefined, halfOpenRequestCount: 0 },
                );
              })
            ),
          ),
        onFailure: () =>
          Ref.updateAndGet<CircuitBreakerState>(stateRef, (state): CircuitBreakerState => {
            const failureCount = state.failureCount + 1;
            if (failureCount >= cbConfig.failureThreshold) {
              const openedAt = now;
              return {
                status: 'open',
                failureCount,
                lastFailureTime: now,
                openedAt,
                halfOpenRequestCount: 0,
              };
            }
            return {
              ...state,
              failureCount,
              lastFailureTime: now,
            };
          }).pipe(
            Effect.tap((next) =>
              Effect.sync(() => {
                callObservabilityHook(
                  config,
                  'onCircuitStateChange',
                  fromStatus,
                  next.status,
                  {
                    failureCount: next.failureCount,
                    openedAt: next.openedAt,
                    halfOpenRequestCount: next.halfOpenRequestCount,
                  },
                );
              })
            ),
          ),
      }),
    );
  });
}

function executeWithResilience<A, R>(
  operationName: string,
  config: WebPayAdapterConfig,
  effectFactory: () => Effect.Effect<A, WebPayAdapterError, R | CircuitBreakerService>,
): Effect.Effect<A, WebPayAdapterError, R | CircuitBreakerService> {
  const effect = effectFactory();

  const timed = effect.pipe(
    Effect.timeoutFail({
      duration: Duration.millis(config.requestTimeoutMs),
      onTimeout: () =>
        processingError(`WebPay ${operationName} timeout after ${config.requestTimeoutMs}ms`),
    }),
  );

  let attempt = 0;
  const schedule = createRetrySchedule(config);

  const retried = Effect.retry(timed, {
    schedule,
    while: (error) => {
      const retryable = isRetryableError(error);
      if (retryable) {
        attempt += 1;
        callObservabilityHook(config, 'onRetry', operationName, attempt, error);
      }
      return retryable;
    },
  });

  return withCircuitBreaker(operationName, config, retried);
}

function toAdapterError(
  operationName: string,
  config: WebPayAdapterConfig,
  error: unknown,
): WebPayAdapterError {
  const mapped = mapWebPayError(error);
  if (mapped._tag !== UNKNOWN_ERROR_TAG) {
    callObservabilityHook(config, 'onSdkError', operationName, mapped);
    return mapped;
  }

  const networkMapped = normalizeNetworkError(error, operationName, config);
  callObservabilityHook(config, 'onSdkError', operationName, networkMapped);
  return networkMapped;
}

function runSdkOperation(
  operationName: string,
  sdkCall: (sdk: WebPaySDK) => Promise<WebPaySDKResponse>,
  normalizer?: (raw: WebPaySDKResponse, config: WebPayAdapterConfig) => WebPayPaymentResponse,
): Effect.Effect<
  WebPayPaymentResponse,
  WebPayAdapterError,
  WebPaySDK | WebPayAdapterConfig | CircuitBreakerService
> {
  return Effect.gen(function*() {
    const sdk = yield* webPaySDKContext;
    const config = yield* webPayConfigContext;
    const startedAt = Date.now();

    callObservabilityHook(config, 'onSdkCall', operationName, { startedAt });

    const base = Effect.tryPromise({
      try: () => sdkCall(sdk),
      catch: (error: unknown) => toAdapterError(operationName, config, error),
    }).pipe(
      Effect.tap((response) =>
        Effect.sync(() => {
          const durationMs = Date.now() - startedAt;
          callObservabilityHook(config, 'onSdkSuccess', operationName, {
            response,
            durationMs,
            metadata: undefined,
          });
        })
      ),
      Effect.map((response) => normalizeWebPayResponse(response, config, normalizer)),
    );

    return yield* executeWithResilience(operationName, config, () => base).pipe(
      Effect.catchAll((error) => Effect.fail(toAdapterError(operationName, config, error))),
    );
  });
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

export const webPayAdapter = {
  /** Создаёт новый платеж */
  createPayment(
    request: WebPayPaymentRequest,
  ): Effect.Effect<
    WebPayPaymentResponse,
    WebPayAdapterError,
    WebPaySDK | WebPayAdapterConfig | CircuitBreakerService
  > {
    return Effect.gen(function*() {
      const idempotencyKey = yield* validateIdempotencyKey(request.idempotencyKey);
      return yield* runSdkOperation('createPayment', (sdk) =>
        sdk.createPayment({
          amount: request.amount,
          currency: request.currency,
          orderId: request.orderId || '',
          ...(request.paymentMethod != null && { paymentMethod: request.paymentMethod }),
          ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
        }));
    });
  },

  /** Получает статус платежа по transactionId */
  getPaymentStatus(
    transactionId: string,
  ): Effect.Effect<
    WebPayPaymentResponse,
    WebPayAdapterError,
    WebPaySDK | WebPayAdapterConfig | CircuitBreakerService
  > {
    return runSdkOperation('getPaymentStatus', (sdk) => sdk.getPaymentStatus(transactionId));
  },

  /** Отменяет платеж по transactionId */
  cancelPayment(
    transactionId: string,
  ): Effect.Effect<
    WebPayPaymentResponse,
    WebPayAdapterError,
    WebPaySDK | WebPayAdapterConfig | CircuitBreakerService
  > {
    return runSdkOperation('cancelPayment', (sdk) => sdk.cancelPayment(transactionId));
  },

  /**
   * Массовый запрос статусов платежей (пока заглушка).
   * Оставлено для forward-compatibility и согласованной API-формы.
   */
  getBulkPaymentStatus(
    request: WebPayBulkStatusRequest,
  ): Effect.Effect<
    WebPayBulkStatusResponse,
    WebPayAdapterError,
    WebPaySDK | WebPayAdapterConfig | CircuitBreakerService
  > {
    const { transactionIds } = request;
    const tasks = transactionIds.map((transactionId) =>
      runSdkOperation('getPaymentStatus', (sdk) => sdk.getPaymentStatus(transactionId)).pipe(
        Effect.either,
      )
    );

    return Effect.all(tasks, { concurrency: 'unbounded' }).pipe(
      Effect.flatMap((results) => {
        const typed = results as readonly AdapterEither[];
        const aggregated = typed.map((either, idx) => ({
          either,
          id: transactionIds.at(idx) ?? 'unknown',
        }));

        const partition = aggregated.reduce(
          (acc, current) => {
            if (current.either._tag === 'Right') {
              // Check if the result is actually an error
              const result = current.either.right;
              if (
                '_tag' in result && typeof result._tag === 'string' && result._tag.includes('Error')
              ) {
                return {
                  successes: acc.successes,
                  failedIds: [...acc.failedIds, current.id],
                };
              }
              return {
                successes: [...acc.successes, result],
                failedIds: acc.failedIds,
              };
            }
            return {
              successes: acc.successes,
              failedIds: [...acc.failedIds, current.id],
            };
          },
          { successes: [] as readonly WebPayPaymentResponse[], failedIds: [] as readonly string[] },
        );

        if (partition.successes.length === 0 && partition.failedIds.length > 0) {
          const firstFailed = aggregated.find((it) => it.either._tag === 'Left');
          const firstEither: AdapterEither = firstFailed?.either
            ?? typed[0]
            ?? { _tag: 'Left', left: unknownError('Bulk operations failed') };
          const firstId = firstFailed?.id ?? 'unknown';
          return Effect.fail(eitherToError(firstEither, firstId));
        }

        return Effect.succeed(
          {
            results: partition.successes,
            failedIds: partition.failedIds,
          } satisfies WebPayBulkStatusResponse,
        );
      }),
    );
  },
};

// ==================== LAYERS ====================

export const createWebPayConfigLayer = (
  config: WebPayAdapterConfig,
): Layer.Layer<never, never, WebPayAdapterConfig> =>
  Layer.effect(webPayConfigContext, Effect.succeed(config));

export const createWebPaySDKLayer = (
  sdk: WebPaySDK,
): Layer.Layer<never, never, WebPaySDK> => Layer.effect(webPaySDKContext, Effect.succeed(sdk));

export const createCircuitBreakerLayer = (
  initialState: CircuitBreakerState = initialCircuitBreakerState,
): Layer.Layer<never, never, CircuitBreakerService> =>
  Layer.effect(
    circuitBreakerContext,
    Ref.make(initialState).pipe(Effect.map((state) => ({ state }))),
  );

// ==================== HELPERS ====================

type AdapterEither = { readonly _tag: 'Left'; readonly left: WebPayAdapterError; } | {
  readonly _tag: 'Right';
  readonly right: WebPayPaymentResponse;
};

function eitherToError(
  either: AdapterEither,
  transactionId: string,
): WebPayAdapterError {
  if (either._tag === 'Right') {
    return unknownError(`Unexpected success for ${transactionId} when error expected`);
  }
  return either.left;
}

/** Клиент без утечек R: провайдим все слои и возвращаем эффекты с R=never */
export function createWebPayAdapterClient(
  sdk: WebPaySDK,
  config: WebPayAdapterConfig,
  initialState: CircuitBreakerState = initialCircuitBreakerState,
): {
  readonly createPayment: (
    req: WebPayPaymentRequest,
  ) => Effect.Effect<WebPayPaymentResponse, WebPayAdapterError, never>;
  readonly getPaymentStatus: (
    transactionId: string,
  ) => Effect.Effect<WebPayPaymentResponse, WebPayAdapterError, never>;
  readonly cancelPayment: (
    transactionId: string,
  ) => Effect.Effect<WebPayPaymentResponse, WebPayAdapterError, never>;
  readonly getBulkPaymentStatus: (
    req: WebPayBulkStatusRequest,
  ) => Effect.Effect<WebPayBulkStatusResponse, WebPayAdapterError, never>;
} {
  const circuitService: CircuitBreakerService = { state: Ref.unsafeMake(initialState) };

  const provideAll = <A>(
    eff: Effect.Effect<
      A,
      WebPayAdapterError,
      WebPaySDK | WebPayAdapterConfig | CircuitBreakerService
    >,
  ): Effect.Effect<A, WebPayAdapterError, never> =>
    eff.pipe(
      Effect.provideService(webPaySDKContext, sdk),
      Effect.provideService(webPayConfigContext, config),
      Effect.provideService(circuitBreakerContext, circuitService),
    );

  return {
    createPayment: (req: WebPayPaymentRequest) => provideAll(webPayAdapter.createPayment(req)),
    getPaymentStatus: (transactionId: string) =>
      provideAll(webPayAdapter.getPaymentStatus(transactionId)),
    cancelPayment: (transactionId: string) =>
      provideAll(webPayAdapter.cancelPayment(transactionId)),
    getBulkPaymentStatus: (req: WebPayBulkStatusRequest) =>
      provideAll(webPayAdapter.getBulkPaymentStatus(req)),
  };
}
