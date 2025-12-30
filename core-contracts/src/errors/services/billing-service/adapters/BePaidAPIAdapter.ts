/**
 * @file BePaidAPIAdapter.ts
 *
 * Адаптер BePaid API на Effect-TS v3.
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

import {
  BEPAID_ERROR_CATEGORIES,
  BEPAID_HTTP_STATUSES,
  isBePaidCardError,
  isBePaidRetryableError,
} from '../infrastructure/BePaidAPIError.js';

import type { SupportedCurrency, SupportedPaymentMethod } from '../domain/index.js';
import type { BePaidAPIError, BePaidErrorCode } from '../infrastructure/BePaidAPIError.js';

// ==================== ДОМЕННЫЕ ТИПЫ ====================

/** Входной запрос на создание платежа */
export type BePaidPaymentRequest = {
  readonly amount: number; // Сумма в минимальных единицах валюты
  readonly currency: SupportedCurrency;
  readonly orderId: string; // Merchant order ID
  readonly paymentMethod?: SupportedPaymentMethod;
  /** Ключ идемпотентности (UUID v4 или ULID), обязательный для защиты от дубликатов */
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
};

/** Bulk запрос на проверку статусов платежей (для будущего) */
export type BePaidBulkStatusRequest = {
  readonly transactionIds: readonly string[];
  readonly includeRawResponse?: boolean;
};

/** Bulk ответ со статусами платежей (для будущего) */
export type BePaidBulkStatusResponse = {
  readonly results: readonly BePaidPaymentResponse[];
  readonly failedIds: readonly string[]; // ID которые не удалось проверить
};

/** Ответ платежного шлюза */
export type BePaidPaymentResponse = {
  readonly transactionId: string;
  readonly orderId: string;
  readonly status: BePaidTransactionStatus;
  readonly amount: number;
  readonly currency: SupportedCurrency;
  readonly timestamp: string;
  readonly raw?: unknown;
};

/** Типизированный статус транзакции BePaid (консервативный union) */
export type BePaidTransactionStatus =
  | 'successful'
  | 'failed'
  | 'pending'
  | 'processing'
  | 'canceled'
  | 'authorized';

// ==================== ОШИБКИ ====================

const CONNECTION_ERROR = 'ConnectionError' as const;
const INVALID_REQUEST_ERROR = 'InvalidRequestError' as const;
const UNAUTHORIZED_ERROR = 'UnauthorizedError' as const;
const PAYMENT_DECLINED_ERROR = 'PaymentDeclinedError' as const;
const PROCESSING_ERROR = 'ProcessingError' as const;
const UNKNOWN_ERROR = 'UnknownError' as const;

export type BePaidAdapterError =
  | { readonly _tag: typeof CONNECTION_ERROR; readonly message: string; readonly cause?: unknown; }
  | {
    readonly _tag: typeof INVALID_REQUEST_ERROR;
    readonly message: string;
    readonly details?: unknown;
  }
  | { readonly _tag: typeof UNAUTHORIZED_ERROR; readonly message: string; }
  | {
    readonly _tag: typeof PAYMENT_DECLINED_ERROR;
    readonly message: string;
    readonly code?: BePaidErrorCode;
  }
  | { readonly _tag: typeof PROCESSING_ERROR; readonly message: string; readonly cause?: unknown; }
  | { readonly _tag: typeof UNKNOWN_ERROR; readonly message: string; readonly cause?: unknown; };

// ==================== КОНФИГ ====================

export type BePaidAdapterConfig = {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly merchantId: string;
  readonly requestTimeoutMs: number;
  readonly defaultCurrency: SupportedCurrency;
  readonly maxRetryAttempts: number;
  readonly retryInitialDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly retryOnStatus?: readonly number[];
  readonly observability?: {
    readonly enableLogging: boolean;
    readonly onSdkCall?: (method: string, payload: unknown) => void;
    readonly onSdkSuccess?: (method: string, payload: unknown) => void;
    readonly onSdkError?: (method: string, error: BePaidAdapterError) => void;
    readonly onRetry?: (method: string, attempt: number, error: BePaidAdapterError) => void;
    /** Срабатывает при смене состояния circuit breaker */
    readonly onCircuitStateChange?: (
      from: CircuitBreakerState['status'],
      to: CircuitBreakerState['status'],
      metadata: { readonly failureCount: number; readonly openedAt?: number; },
    ) => void;
  };
  readonly circuitBreaker?: CircuitBreakerConfig;
  readonly maskRaw?: boolean;
};

// ==================== SDK АБСТРАКЦИЯ ====================

/** Изолированный контракт BePaid SDK */
export type BePaidSDK = {
  createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    paymentMethod?: string;
    idempotencyKey?: string;
  }): Promise<BePaidSDKResponse>;

  getPaymentStatus(transactionId: string): Promise<BePaidSDKResponse>;

  cancelPayment(transactionId: string): Promise<BePaidSDKResponse>;
};

type BePaidSDKResponse = {
  transactionId: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: string;
  raw?: unknown;
};

// ==================== CONTEXTS ====================

export const bePaidSDKContext = Context.GenericTag<BePaidSDK>('@billing/BePaidSDK');
export const bePaidConfigContext = Context.GenericTag<BePaidAdapterConfig>('@billing/BePaidConfig');

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

export type CircuitBreakerService = {
  readonly state: Ref.Ref<CircuitBreakerState>;
};

export const circuitBreakerContext = Context.GenericTag<CircuitBreakerService>(
  '@billing/BePaidCircuit',
);

export type CircuitBreakerConfig = {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly halfOpenMaxRequests: number;
  /** Опционально, для совместимости с WebPay */
  readonly halfOpenRequestCount?: number;
};

// ==================== OBSERVABILITY HELPERS ====================

type ObsHook = 'onSdkCall' | 'onSdkSuccess' | 'onSdkError' | 'onRetry' | 'onCircuitStateChange';

const callObs = (
  config: BePaidAdapterConfig,
  hook: ObsHook,
  ...args: readonly unknown[]
): void => {
  if (config.observability?.enableLogging !== true) return;
  const fn = Reflect.get(config.observability, hook) as ((...a: unknown[]) => void) | undefined;
  if (fn) {
    try {
      fn(...args);
    } catch {
      // ignore
    }
  }
};

// ==================== IDEMPOTENCY ====================

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const validateIdempotencyKey = (
  key?: string,
): Effect.Effect<string | undefined, BePaidAdapterError, never> => {
  if (key == null) return Effect.succeed(undefined);
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return Effect.fail(invalidRequestError('IdempotencyKey must be non-empty'));
  }
  const ok = uuidV4Regex.test(trimmed) || ulidRegex.test(trimmed);
  if (!ok) return Effect.fail(invalidRequestError('IdempotencyKey must be UUID v4 или ULID'));
  return Effect.succeed(trimmed);
};

// ==================== ERROR FACTORY ====================

const connectionError = (message: string, cause?: unknown): BePaidAdapterError =>
  cause != null ? { _tag: CONNECTION_ERROR, message, cause } : { _tag: CONNECTION_ERROR, message };
const invalidRequestError = (message: string, details?: unknown): BePaidAdapterError =>
  details != null
    ? { _tag: INVALID_REQUEST_ERROR, message, details }
    : { _tag: INVALID_REQUEST_ERROR, message };
const unauthorizedError = (message: string): BePaidAdapterError => ({
  _tag: UNAUTHORIZED_ERROR,
  message,
});
const declinedError = (message: string, code?: BePaidErrorCode): BePaidAdapterError =>
  code
    ? { _tag: PAYMENT_DECLINED_ERROR, message, code }
    : { _tag: PAYMENT_DECLINED_ERROR, message };
const processingError = (message: string, cause?: unknown): BePaidAdapterError =>
  cause != null ? { _tag: PROCESSING_ERROR, message, cause } : { _tag: PROCESSING_ERROR, message };
const unknownError = (message: string, cause?: unknown): BePaidAdapterError =>
  cause != null ? { _tag: UNKNOWN_ERROR, message, cause } : { _tag: UNKNOWN_ERROR, message };

// ==================== ERROR MAPPING ====================

export function mapBePaidError(error: unknown): BePaidAdapterError {
  if (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'BePaidAPIError'
  ) {
    const be = error as BePaidAPIError;
    const details = be.details ?? {};
    const httpStatus = details.httpStatus;
    const bepaidCode = details.bepaidCode;

    // Card declines / бизнес-отклонения
    if (
      bepaidCode && (isBePaidCardError(be) || BEPAID_ERROR_CATEGORIES.SECURITY.includes(bepaidCode))
    ) {
      return declinedError(be.message, bepaidCode);
    }

    // Unauthorized
    if (httpStatus === BEPAID_HTTP_STATUSES.UNAUTHORIZED) {
      return unauthorizedError('Unauthorized BePaid request');
    }

    // Invalid request
    if (
      httpStatus === BEPAID_HTTP_STATUSES.BAD_REQUEST
      || httpStatus === BEPAID_HTTP_STATUSES.UNPROCESSABLE_ENTITY
    ) {
      return invalidRequestError('Invalid BePaid request', details);
    }

    // Retryable infra errors
    if (isBePaidRetryableError(be)) {
      return connectionError(
        `BePaid connection failed${httpStatus ? `: HTTP ${httpStatus}` : ''}`,
        error,
      );
    }

    return processingError(be.message, error);
  }

  // Fallback network-ish errors
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    const code = e['code'];
    if (
      code === 'ECONNREFUSED'
      || code === 'ENOTFOUND'
      || code === 'ETIMEDOUT'
      || code === 'ECONNRESET'
      || code === 'ESOCKETTIMEDOUT'
      || code === 'ENETUNREACH'
    ) {
      return connectionError(`BePaid network error: ${String(code)}`, error);
    }

    if (code === 'EAI_AGAIN' || code === 'EAI_FAIL') {
      return connectionError(`BePaid DNS resolution failed: ${String(code)}`, error);
    }

    if (
      code === 'CERT_HAS_EXPIRED'
      || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      || code === 'SELF_SIGNED_CERT_IN_CHAIN'
    ) {
      return connectionError(`BePaid SSL/TLS error: ${String(code)}`, error);
    }
  }

  return unknownError('Unhandled BePaid SDK error', error);
}

// ==================== NORMALIZATION ====================

const normalizeResponse = (
  raw: BePaidSDKResponse,
  config: BePaidAdapterConfig,
  custom?: (raw: BePaidSDKResponse, config: BePaidAdapterConfig) => BePaidPaymentResponse,
  includeRaw?: boolean,
): BePaidPaymentResponse => {
  if (custom) return custom(raw, config);
  return {
    transactionId: raw.transactionId || '',
    orderId: raw.orderId || '',
    status: (raw.status as BePaidTransactionStatus | undefined) ?? 'processing',
    amount: raw.amount,
    currency: raw.currency ? (raw.currency as SupportedCurrency) : config.defaultCurrency,
    timestamp: raw.timestamp || new Date().toISOString(),
    raw: includeRaw === false || config.maskRaw === true ? undefined : raw.raw,
  };
};

// ==================== RETRY LOGIC ====================

const isRetryable = (err: BePaidAdapterError): boolean =>
  err._tag === CONNECTION_ERROR || err._tag === PROCESSING_ERROR;

function createRetrySchedule(
  config: BePaidAdapterConfig,
): Schedule.Schedule<DurationType, BePaidAdapterError, never> {
  const EXPONENTIAL_MULTIPLIER = 2.0;
  const base = Schedule.exponential(
    Duration.millis(config.retryInitialDelayMs),
    EXPONENTIAL_MULTIPLIER,
  );
  const withCap = config.retryMaxDelayMs > 0
    ? Schedule.intersect(base, Schedule.spaced(Duration.millis(config.retryMaxDelayMs))).pipe(
      Schedule.map(([d]) => d),
    )
    : base;
  return Schedule.jittered(withCap).pipe(Schedule.upTo(config.maxRetryAttempts));
}

// ==================== NETWORK ERROR NORMALIZATION ====================

const HTTP_STATUS = Object.freeze(
  {
    INTERNAL_SERVER_ERROR: 500,
    RATE_LIMITED: 429,
  } as const,
);

const normalizeNetworkError = (
  error: unknown,
  operation: string,
  config: BePaidAdapterConfig,
): BePaidAdapterError => {
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    const code = e['code'];
    const status = e['status']
      ?? e['statusCode']
      ?? (e['response'] as { [key: string]: unknown; } | undefined)?.['status'];

    const isNetCode = (c: unknown): c is string =>
      typeof c === 'string'
      && (c === 'ECONNREFUSED'
        || c === 'ENOTFOUND'
        || c === 'ECONNRESET'
        || c === 'ETIMEDOUT'
        || c === 'ESOCKETTIMEDOUT'
        || c === 'ENETUNREACH');

    if (isNetCode(code)) {
      return connectionError(`Network error during ${operation}: ${code}`, error);
    }

    if (code === 'EAI_AGAIN' || code === 'EAI_FAIL') {
      return connectionError(`DNS resolution failed during ${operation}: ${code}`, error);
    }

    if (
      code === 'CERT_HAS_EXPIRED'
      || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      || code === 'SELF_SIGNED_CERT_IN_CHAIN'
    ) {
      return connectionError(`SSL/TLS error during ${operation}: ${code}`, error);
    }

    if (typeof status === 'number') {
      const retryStatuses = config.retryOnStatus ?? [];
      if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR || retryStatuses.includes(status)) {
        return connectionError(`Server error during ${operation}: HTTP ${status}`, error);
      }
      if (status === HTTP_STATUS.RATE_LIMITED) {
        return processingError(`Rate limited during ${operation}: HTTP ${status}`, error);
      }
    }
  }

  if (typeof error === 'string') {
    return unknownError(`Unexpected error during ${operation}: ${error}`, error);
  }

  return unknownError(`Unhandled error during ${operation}: ${String(error)}`, error);
};

const handleNetworkError = (
  error: unknown,
  operation: string,
  config: BePaidAdapterConfig,
): BePaidAdapterError => {
  // Сначала пытаемся замапить доменную ошибку
  try {
    const mapped = mapBePaidError(error);
    if (mapped._tag !== UNKNOWN_ERROR) return mapped;
  } catch {
    // игнорируем и продолжаем к сетевой нормализации
  }
  return normalizeNetworkError(error, operation, config);
};

const safeSdkCall = <T>(
  sdkCall: () => Promise<T>,
  operation: string,
  config: BePaidAdapterConfig,
): Promise<T> =>
  new Promise((resolve, reject) => {
    try {
      const p = sdkCall();
      p.then(resolve).catch((err) => {
        reject(handleNetworkError(err, operation, config));
      });
    } catch (err) {
      reject(handleNetworkError(err, operation, config));
    }
  });

// ==================== RESILIENCE ====================

const withCircuit = <A, R>(
  operation: string,
  config: BePaidAdapterConfig,
  effect: Effect.Effect<A, BePaidAdapterError, R | CircuitBreakerService>,
): Effect.Effect<A, BePaidAdapterError, R | CircuitBreakerService> => {
  if (!config.circuitBreaker) return effect;

  const cb = config.circuitBreaker;

  return Effect.gen(function*() {
    const { state: stateRef } = yield* circuitBreakerContext;
    const now = Date.now();
    let state = yield* Ref.get(stateRef);

    if (
      state.status === 'open'
      && state.openedAt !== undefined
      && now - state.openedAt < cb.resetTimeoutMs
    ) {
      return yield* Effect.fail(processingError(`Circuit breaker open for ${operation}`));
    }

    if (
      state.status === 'open'
      && state.openedAt !== undefined
      && now - state.openedAt >= cb.resetTimeoutMs
    ) {
      const next: CircuitBreakerState = {
        status: 'half-open',
        failureCount: state.failureCount,
        lastFailureTime: state.lastFailureTime,
        openedAt: state.openedAt,
        halfOpenRequestCount: 0,
      };
      yield* Ref.set(stateRef, next);
      state = next;
      callObs(config, 'onCircuitStateChange', 'open', 'half-open', {
        failureCount: next.failureCount,
        openedAt: next.openedAt,
      });
    }

    if (state.status === 'half-open' && state.halfOpenRequestCount >= cb.halfOpenMaxRequests) {
      return yield* Effect.fail(
        processingError(`Circuit breaker half-open limit reached for ${operation}`),
      );
    }

    if (state.status === 'half-open') {
      yield* Ref.update(
        stateRef,
        (s) => ({ ...s, halfOpenRequestCount: s.halfOpenRequestCount + 1 }),
      );
    }

    return yield* effect.pipe(
      Effect.tapBoth({
        onSuccess: () =>
          Ref.set(stateRef, initialCircuitBreakerState).pipe(
            Effect.tap(() => {
              return Effect.sync(() => {
                callObs(config, 'onCircuitStateChange', state.status, 'closed', {
                  failureCount: 0,
                  openedAt: undefined,
                });
              });
            }),
          ),
        onFailure: () =>
          Ref.updateAndGet(stateRef, (s): CircuitBreakerState => {
            const failureCount = s.failureCount + 1;
            if (failureCount >= cb.failureThreshold) {
              const openedAt = now;
              return {
                status: 'open',
                failureCount,
                lastFailureTime: now,
                openedAt,
                halfOpenRequestCount: 0,
              };
            }
            return { ...s, failureCount, lastFailureTime: now };
          }).pipe(
            Effect.tap((next) => {
              return Effect.sync(() => {
                callObs(config, 'onCircuitStateChange', state.status, next.status, {
                  failureCount: next.failureCount,
                  openedAt: next.openedAt,
                });
              });
            }),
          ),
      }),
    );
  });
};

const executeWithResilience = <A, R>(
  op: string,
  config: BePaidAdapterConfig,
  eff: () => Effect.Effect<A, BePaidAdapterError, R | CircuitBreakerService>,
): Effect.Effect<A, BePaidAdapterError, R | CircuitBreakerService> => {
  const timed = eff().pipe(
    Effect.timeoutFail({
      duration: Duration.millis(config.requestTimeoutMs),
      onTimeout: () => processingError(`BePaid ${op} timeout after ${config.requestTimeoutMs}ms`),
    }),
  );

  let attempt = 0;
  const retried = Effect.retry(timed, {
    schedule: createRetrySchedule(config),
    while: (err) => {
      const ok = isRetryable(err);
      if (ok) {
        attempt += 1;
        callObs(config, 'onRetry', op, attempt, err);
      }
      return ok;
    },
  });

  return withCircuit(op, config, retried);
};

// ==================== SDK OP RUNNER ====================

const toAdapterError = (
  op: string,
  config: BePaidAdapterConfig,
  err: unknown,
): BePaidAdapterError => {
  const mapped = mapBePaidError(err);
  if (mapped._tag !== UNKNOWN_ERROR) {
    callObs(config, 'onSdkError', op, mapped);
    return mapped;
  }
  const net = normalizeNetworkError(err, op, config);
  callObs(config, 'onSdkError', op, net);
  return net;
};

const runSdkOperation = (
  op: string,
  sdkCall: (sdk: BePaidSDK) => Promise<BePaidSDKResponse>,
  normalizer?: (raw: BePaidSDKResponse, config: BePaidAdapterConfig) => BePaidPaymentResponse,
  includeRaw?: boolean,
): Effect.Effect<
  BePaidPaymentResponse,
  BePaidAdapterError,
  BePaidSDK | BePaidAdapterConfig | CircuitBreakerService
> =>
  Effect.gen(function*() {
    const sdk = yield* bePaidSDKContext;
    const config = yield* bePaidConfigContext;
    const startedAt = Date.now();

    callObs(config, 'onSdkCall', op, {
      response: undefined,
      durationMs: undefined,
      metadata: { startedAt },
    });

    const base = Effect.tryPromise({
      try: () => safeSdkCall(() => sdkCall(sdk), op, config),
      catch: (err) => toAdapterError(op, config, err),
    }).pipe(
      Effect.tap((resp) =>
        Effect.sync(() => {
          const durationMs = Date.now() - startedAt;
          callObs(config, 'onSdkSuccess', op, {
            response: resp,
            durationMs,
            metadata: { startedAt },
          });
        })
      ),
      Effect.map((resp) => normalizeResponse(resp, config, normalizer, includeRaw)),
    );

    return yield* executeWithResilience(op, config, () => base).pipe(
      Effect.catchAll((err) => Effect.fail(toAdapterError(op, config, err))),
    );
  });

// ==================== ОСНОВНАЯ ЛОГИКА ====================

export const bePaidAdapter = {
  createPayment(
    request: BePaidPaymentRequest,
  ): Effect.Effect<
    BePaidPaymentResponse,
    BePaidAdapterError,
    BePaidSDK | BePaidAdapterConfig | CircuitBreakerService
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

  getPaymentStatus(
    transactionId: string,
  ): Effect.Effect<
    BePaidPaymentResponse,
    BePaidAdapterError,
    BePaidSDK | BePaidAdapterConfig | CircuitBreakerService
  > {
    return runSdkOperation('getPaymentStatus', (sdk) => sdk.getPaymentStatus(transactionId));
  },

  cancelPayment(
    transactionId: string,
  ): Effect.Effect<
    BePaidPaymentResponse,
    BePaidAdapterError,
    BePaidSDK | BePaidAdapterConfig | CircuitBreakerService
  > {
    return runSdkOperation('cancelPayment', (sdk) => sdk.cancelPayment(transactionId));
  },

  getBulkPaymentStatus(
    request: BePaidBulkStatusRequest,
  ): Effect.Effect<
    BePaidBulkStatusResponse,
    BePaidAdapterError,
    BePaidSDK | BePaidAdapterConfig | CircuitBreakerService
  > {
    const tasks = request.transactionIds.map((tid) =>
      runSdkOperation(
        'getPaymentStatus',
        (sdk) => sdk.getPaymentStatus(tid),
        undefined,
        request.includeRawResponse,
      ).pipe(Effect.either)
    );

    return Effect.all(tasks, { concurrency: 'unbounded' }).pipe(
      Effect.flatMap((results) => {
        const typed = results as readonly AdapterEither[];
        const aggregated = typed.map((either, idx) => ({
          either,
          id: request.transactionIds.at(idx) ?? 'unknown',
        }));

        const partition = aggregated.reduce(
          (acc, cur) =>
            cur.either._tag === 'Right'
              ? { successes: [...acc.successes, cur.either.right], failedIds: acc.failedIds }
              : { successes: acc.successes, failedIds: [...acc.failedIds, cur.id] },
          { successes: [] as readonly BePaidPaymentResponse[], failedIds: [] as readonly string[] },
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
          } satisfies BePaidBulkStatusResponse,
        );
      }),
    );
  },
};

// ==================== LAYERS ====================

export const createBePaidConfigLayer = (
  config: BePaidAdapterConfig,
): Layer.Layer<never, never, BePaidAdapterConfig> =>
  Layer.effect(bePaidConfigContext, Effect.succeed(config));

export const createBePaidSDKLayer = (
  sdk: BePaidSDK,
): Layer.Layer<never, never, BePaidSDK> => Layer.effect(bePaidSDKContext, Effect.succeed(sdk));

export const createBePaidCircuitLayer = (
  initialState: CircuitBreakerState = initialCircuitBreakerState,
): Layer.Layer<never, never, CircuitBreakerService> =>
  Layer.effect(
    circuitBreakerContext,
    Ref.make(initialState).pipe(Effect.map((state) => ({ state }))),
  );

// ==================== КЛИЕНТ БЕЗ УТЕЧКИ R ====================

type AdapterEither = { readonly _tag: 'Left'; readonly left: BePaidAdapterError; } | {
  readonly _tag: 'Right';
  readonly right: BePaidPaymentResponse;
};

const eitherToError = (
  either: AdapterEither,
  transactionId: string,
): BePaidAdapterError => {
  if (either._tag === 'Right') {
    return unknownError(`Unexpected success for ${transactionId} when error expected`);
  }
  return either.left;
};

export function createBePaidAdapterClient(
  sdk: BePaidSDK,
  config: BePaidAdapterConfig,
  initialState: CircuitBreakerState = initialCircuitBreakerState,
): {
  readonly createPayment: (
    req: BePaidPaymentRequest,
  ) => Effect.Effect<BePaidPaymentResponse, BePaidAdapterError, never>;
  readonly getPaymentStatus: (
    tid: string,
  ) => Effect.Effect<BePaidPaymentResponse, BePaidAdapterError, never>;
  readonly cancelPayment: (
    tid: string,
  ) => Effect.Effect<BePaidPaymentResponse, BePaidAdapterError, never>;
  readonly getBulkPaymentStatus: (
    req: BePaidBulkStatusRequest,
  ) => Effect.Effect<BePaidBulkStatusResponse, BePaidAdapterError, never>;
} {
  const circuit: CircuitBreakerService = { state: Ref.unsafeMake(initialState) };

  const provideAll = <A>(
    eff: Effect.Effect<
      A,
      BePaidAdapterError,
      BePaidSDK | BePaidAdapterConfig | CircuitBreakerService
    >,
  ): Effect.Effect<A, BePaidAdapterError, never> =>
    eff.pipe(
      Effect.provideService(bePaidSDKContext, sdk),
      Effect.provideService(bePaidConfigContext, config),
      Effect.provideService(circuitBreakerContext, circuit),
    );

  return {
    createPayment: (req) => provideAll(bePaidAdapter.createPayment(req)),
    getPaymentStatus: (tid) => provideAll(bePaidAdapter.getPaymentStatus(tid)),
    cancelPayment: (tid) => provideAll(bePaidAdapter.cancelPayment(tid)),
    getBulkPaymentStatus: (req) => provideAll(bePaidAdapter.getBulkPaymentStatus(req)),
  };
}
