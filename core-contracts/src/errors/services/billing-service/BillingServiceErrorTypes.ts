/**
 * @file BillingServiceErrorTypes.ts - Типы ошибок уровня сервиса для биллинговых операций
 *
 * Определяет основные типы ошибок уровня сервиса, связывающие доменные ошибки и инфраструктуру.
 * Архитектура: Доменные ошибки → Сервисные ошибки → Инфраструктурные ошибки.
 *
 * Ключевые принципы: TaggedError, SERVICE_BILLING_* коды, PCI-safe, аудит, Effect-native.
 */

import { Effect } from 'effect';

import { SERVICE_ERROR_CODES } from '../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import { isCurrencySupported, isPaymentMethodSupported } from './domain/index.js';

import type {
  BillingDomainError,
  SupportedCurrency,
  SupportedPaymentMethod,
} from './domain/index.js';
import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';
import type { ErrorSeverity } from '../../base/ErrorConstants.js';

// ==================== COMMON ERROR FACTORY ====================

/** Generic helper для создания Effect из TaggedError */
function createBillingServiceEffect<TError extends TaggedError<unknown, string>>(
  error: TError,
): Effect.Effect<TError, never, never> {
  return Effect.sync(() => error) as unknown as Effect.Effect<TError, never, never>;
}

/** Generic helper для нормализации optional контекста во всех error creators */
export function normalizeOptionalContext<T extends Record<string, unknown>>(
  context?: Partial<T>,
): Partial<T> {
  if (!context) return {};
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value != null),
  ) as Partial<T>;
}

/** Helper для нормализации контекста PaymentFailedError */
function normalizePaymentContext(
  context?: { provider?: SupportedPaymentMethod; operation?: string; },
): { provider?: SupportedPaymentMethod; operation?: string; } {
  return normalizeOptionalContext(context);
}

/** Общая фабрика для создания billing service ошибок */
function createBillingServiceError<Tag extends string, TDetails>(
  tag: Tag,
  code: ErrorCode,
  severity: ErrorSeverity,
  message: string,
  details: TDetails,
  timestamp?: string,
): TaggedError<{
  readonly code: ErrorCode;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly severity: ErrorSeverity;
  readonly message: string;
  readonly details: TDetails;
  readonly timestamp: string;
}, Tag> {
  return {
    _tag: tag,
    code,
    origin: ERROR_ORIGIN.SERVICE,
    category: ERROR_CATEGORY.BUSINESS,
    severity,
    message,
    details,
    timestamp: timestamp ?? new Date().toISOString(),
  };
}

// ==================== ОШИБКА НЕУДАЧНОГО ПЛАТЕЖА ====================

/** Ошибка неудачного платежа на уровне сервиса. PCI-safe, готова к аудиту. */
export type PaymentFailedError = TaggedError<{
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly severity: 'high';
  readonly message: string;
  readonly details: {
    readonly transactionId: string;
    readonly amount: number;
    readonly currency: string; // может содержать невалидные значения для диагностики ошибок
    readonly retryable: boolean;
    readonly retryPolicy?: 'immediate' | 'delayed' | 'manual';
    readonly provider?: SupportedPaymentMethod;
    readonly operation?: string;
    /** Контекст для enterprise трассировки и мониторинга */
    readonly observability?: {
      readonly traceId?: string;
      readonly sessionId?: string;
      readonly userId?: string;
      readonly requestId?: string;
      readonly serviceName?: string;
      readonly operationName?: string;
    };
  };
  readonly timestamp: string;
}, 'PaymentFailedError'>;

/** Создает PaymentFailedError (transactionId, amount, currency, context) */
export function createPaymentFailedError(
  transactionId: string,
  amount: number,
  currency: string,
  context?: {
    provider?: SupportedPaymentMethod;
    operation?: string;
    retryPolicy?: 'immediate' | 'delayed' | 'manual';
  },
): Effect.Effect<PaymentFailedError, never, never> {
  // createPaymentFailedError теперь принимает любые значения для гибкости,
  // валидация происходит на уровне сервиса

  const normalizedContext = normalizePaymentContext(context);

  return createBillingServiceEffect(
    createBillingServiceError(
      'PaymentFailedError',
      SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
      ERROR_SEVERITY.HIGH, // severity из registry
      `Payment processing failed for transaction ${transactionId}`,
      {
        transactionId,
        amount,
        currency,
        retryable: !!context?.retryPolicy, // retryable зависит от наличия retryPolicy
        retryPolicy: context?.retryPolicy,
        ...normalizedContext,
      },
    ) as PaymentFailedError,
  );
}

// ==================== ОШИБКА ПОДПИСКИ ====================

/** Ошибка подписки на уровне сервиса. */
export type SubscriptionError = TaggedError<{
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly message: string;
  readonly details: {
    readonly subscriptionId: string;
    readonly reason: string;
    readonly planId?: string;
    readonly currentUsage?: number;
    readonly allowedUsage?: number;
  };
  readonly timestamp: string;
}, 'SubscriptionError'>;

/** Создает SubscriptionError (subscriptionId, reason, context) */
export function createSubscriptionError(
  subscriptionId: string,
  reason: string,
  context?: { planId?: string; currentUsage?: number; allowedUsage?: number; },
): Effect.Effect<SubscriptionError, never, never> {
  return createBillingServiceEffect(
    createBillingServiceError(
      'SubscriptionError',
      SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
      ERROR_SEVERITY.MEDIUM,
      `Subscription error: ${reason}`,
      {
        subscriptionId,
        reason,
        ...normalizeOptionalContext(context),
      },
    ) as SubscriptionError,
  );
}

// ==================== ОШИБКА ВОЗВРАТА ====================

/** Ошибка обработки возврата на уровне сервиса. */
export type RefundError = TaggedError<{
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly message: string;
  readonly details: {
    readonly transactionId: string;
    readonly reason: string;
    readonly refundAmount?: number;
    readonly currency?: string;
    readonly daysSinceTransaction?: number;
  };
  readonly timestamp: string;
}, 'RefundError'>;

/** Создает RefundError (transactionId, reason, context) */
export function createRefundError(
  transactionId: string,
  reason: string,
  context?: { refundAmount?: number; currency?: string; daysSinceTransaction?: number; },
): Effect.Effect<RefundError, never, never> {
  return createBillingServiceEffect(
    createBillingServiceError(
      'RefundError',
      SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR,
      ERROR_SEVERITY.HIGH,
      `Refund processing failed: ${reason}`,
      {
        transactionId,
        reason,
        ...normalizeOptionalContext(context),
      },
    ) as RefundError,
  );
}

// ==================== UNION TYPE ====================

export type InfrastructureUnknownError = TaggedError<{
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly category: typeof ERROR_CATEGORY.TECHNICAL;
  readonly severity: typeof ERROR_SEVERITY.HIGH;
  readonly message: string;
  readonly details: {
    readonly originalError: unknown;
  };
  readonly timestamp: string;
}, 'InfrastructureUnknownError'>;

/** Создает InfrastructureUnknownError для неизвестных инфраструктурных ошибок */
export function createInfrastructureUnknownError(
  originalError: unknown,
): Effect.Effect<InfrastructureUnknownError, never, never> {
  return createBillingServiceEffect({
    _tag: 'InfrastructureUnknownError',
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    category: ERROR_CATEGORY.TECHNICAL,
    severity: ERROR_SEVERITY.HIGH,
    message: `Unknown infrastructure error: ${String(originalError)}`,
    details: { originalError },
    timestamp: new Date().toISOString(),
  } as InfrastructureUnknownError);
}

/** Union всех ошибок billing service. */
export type BillingServiceError =
  | PaymentFailedError
  | SubscriptionError
  | RefundError
  | InfrastructureUnknownError;

// ==================== TYPE GUARDS ====================

/** Универсальный helper для создания type guards по _tag с runtime validation */
function isTaggedError<T>(tag: string): (error: unknown) => error is T {
  return (error: unknown): error is T => {
    if (
      typeof error !== 'object'
      || error === null
      || !('_tag' in error)
    ) {
      return false;
    }

    const taggedError = error as Record<string, unknown>;

    // Проверяем наличие обязательных полей TaggedError
    return (
      taggedError['_tag'] === tag
      && typeof taggedError['code'] === 'string'
      && typeof taggedError['origin'] === 'string'
      && typeof taggedError['category'] === 'string'
      && typeof taggedError['severity'] === 'string'
      && typeof taggedError['message'] === 'string'
      && typeof taggedError['details'] === 'object'
      && taggedError['details'] !== null
      && typeof taggedError['timestamp'] === 'string'
    );
  };
}

/** Type guard для PaymentFailedError (error) */
export const isPaymentFailedError = isTaggedError<PaymentFailedError>('PaymentFailedError');

/** Type guard для SubscriptionError (error) */
export const isSubscriptionError = isTaggedError<SubscriptionError>('SubscriptionError');

/** Type guard для RefundError (error) */
export const isRefundError = isTaggedError<RefundError>('RefundError');

/** Type guard для InfrastructureUnknownError (error) */
export const isInfrastructureUnknownError = isTaggedError<InfrastructureUnknownError>(
  'InfrastructureUnknownError',
);

/** Type guard для любой BillingServiceError (error) */
export function isBillingServiceError(error: unknown): error is BillingServiceError {
  return (
    isPaymentFailedError(error)
    || isSubscriptionError(error)
    || isRefundError(error)
    || isInfrastructureUnknownError(error)
  );
}

// ==================== PATTERN MATCHING ====================

/** Pattern matching для BillingServiceError (error, patterns) */
export function matchBillingServiceError<T>(
  error: BillingServiceError,
  patterns: {
    paymentFailedError: (error: PaymentFailedError) => T;
    subscriptionError: (error: SubscriptionError) => T;
    refundError: (error: RefundError) => T;
    infrastructureUnknownError: (error: InfrastructureUnknownError) => T;
  },
): T {
  switch (error._tag) {
    case 'PaymentFailedError':
      return patterns.paymentFailedError(error);
    case 'SubscriptionError':
      return patterns.subscriptionError(error);
    case 'RefundError':
      return patterns.refundError(error);
    case 'InfrastructureUnknownError':
      return patterns.infrastructureUnknownError(error);
    default:
      // Exhaustive check - если добавится новый тип ошибки, будет ошибка компиляции
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
  }
}

/** Safe pattern matching для неизвестных ошибок (error, patterns) */
export function safeMatchBillingServiceError<T>(
  error: unknown,
  patterns: {
    paymentFailedError: (error: PaymentFailedError) => T;
    subscriptionError: (error: SubscriptionError) => T;
    refundError: (error: RefundError) => T;
    infrastructureUnknownError: (error: InfrastructureUnknownError) => T;
    fallback: () => T;
  },
): T {
  if (!isBillingServiceError(error)) {
    return patterns.fallback();
  }
  return matchBillingServiceError(error, {
    paymentFailedError: patterns.paymentFailedError,
    subscriptionError: patterns.subscriptionError,
    refundError: patterns.refundError,
    infrastructureUnknownError: patterns.infrastructureUnknownError,
  });
}

// ==================== ACCESSOR FUNCTIONS ====================

// PaymentFailedError accessors

/** Извлекает поддерживаемую валюту из domain ошибки (с fallback) */
function extractSupportedCurrency(currency: string | undefined): SupportedCurrency {
  // Fallback к BYN (Белорусский рубль) как валюте по умолчанию для биллинговой системы
  // Это гарантирует продолжение обработки платежей даже с некорректными/отсутствующими данными о валюте
  // BYN выбран, поскольку является основной валютой белорусского рынка
  return currency != null && isCurrencySupported(currency) ? currency : 'BYN';
}

/** Извлекает поддерживаемый payment method из domain ошибки (опционально) */
function extractSupportedPaymentMethod(
  paymentMethod: string | undefined,
): SupportedPaymentMethod | undefined {
  return paymentMethod != null && isPaymentMethodSupported(paymentMethod)
    ? paymentMethod
    : undefined;
}

// ==================== DOMAIN → SERVICE MAPPING ====================

/** Конвертирует доменные ошибки в сервисные (domainError) */
export function domainErrorToServiceError(
  domainError: BillingDomainError,
): Effect.Effect<BillingServiceError, never, never> {
  switch (domainError._tag) {
    case 'PaymentValidationError':
      const currency = extractSupportedCurrency(domainError.details.currency);
      const provider = extractSupportedPaymentMethod(domainError.details.paymentMethod);

      return createPaymentFailedError(
        domainError.details.transactionId ?? 'unknown',
        domainError.details.amount ?? 0,
        currency,
        {
          ...(provider != null ? { provider } : {}),
          operation: 'validation',
        },
      ).pipe(
        Effect.map((serviceError: PaymentFailedError): PaymentFailedError => ({
          ...serviceError,
          message: `Payment validation failed: ${domainError.details.rule}`,
        })),
      );
    case 'SubscriptionLimitError':
      // Fallback: subscriptionId берется из domain error, если отсутствует - используем planId
      // currentUsage и allowedUsage передаются как есть (могут быть undefined)
      return createSubscriptionError(
        domainError.details.subscriptionId ?? domainError.details.planId,
        domainError.details.reason,
        {
          ...(domainError.details.planId && { planId: domainError.details.planId }),
          ...(domainError.details.currentUsage != null
            && { currentUsage: domainError.details.currentUsage }),
          ...(domainError.details.allowedUsage != null
            && { allowedUsage: domainError.details.allowedUsage }),
        },
      );
    case 'RefundPolicyError':
      // Все поля передаются как есть из domain error
      // refundAmount, currency, daysSinceTransaction могут быть undefined если не указаны
      return createRefundError(
        domainError.details.transactionId,
        domainError.details.reason,
        {
          ...(domainError.details.refundAmount != null
            && { refundAmount: domainError.details.refundAmount }),
          ...(domainError.details.currency != null && { currency: domainError.details.currency }),
          ...(domainError.details.daysSinceTransaction != null
            && { daysSinceTransaction: domainError.details.daysSinceTransaction }),
        },
      );
    default:
      // Fallback для неизвестных domain ошибок - exhaustive check
      const exhaustiveCheck: never = domainError;
      throw new Error(`Unknown domain error type: ${String(exhaustiveCheck)}`);
  }
}

// ==================== ACCESSOR FUNCTIONS ====================

// PaymentFailedError accessors

/** Получает ID транзакции из PaymentFailedError. */
export function getPaymentTransactionId(error: PaymentFailedError): string {
  return error.details.transactionId;
}

/** Получает сумму платежа из PaymentFailedError. */
export function getPaymentAmount(error: PaymentFailedError): number {
  return error.details.amount;
}

/** Получает валюту платежа из PaymentFailedError. */
export function getPaymentCurrency(error: PaymentFailedError): string {
  return error.details.currency;
}

/** Проверяет retryable ли ошибка платежа. */
export function isPaymentRetryable(error: PaymentFailedError): boolean {
  return error.details.retryable;
}

/** Получает провайдера платежа из PaymentFailedError. */
export function getPaymentProvider(error: PaymentFailedError): SupportedPaymentMethod | undefined {
  return error.details.provider;
}

// SubscriptionError accessors

/** Получает ID подписки из SubscriptionError. */
export function getSubscriptionId(error: SubscriptionError): string {
  return error.details.subscriptionId;
}

/** Получает причину ошибки из SubscriptionError. */
export function getSubscriptionErrorReason(error: SubscriptionError): string {
  return error.details.reason;
}

/** Получает ID плана из SubscriptionError. */
export function getSubscriptionPlanId(error: SubscriptionError): string | undefined {
  return error.details.planId;
}

/** Получает текущее использование из SubscriptionError. */
export function getSubscriptionCurrentUsage(error: SubscriptionError): number | undefined {
  return error.details.currentUsage;
}

/** Получает разрешенное использование из SubscriptionError. */
export function getSubscriptionAllowedUsage(error: SubscriptionError): number | undefined {
  return error.details.allowedUsage;
}

// RefundError accessors

/** Получает ID транзакции из RefundError. */
export function getRefundTransactionId(error: RefundError): string {
  return error.details.transactionId;
}

/** Получает причину ошибки из RefundError. */
export function getRefundErrorReason(error: RefundError): string {
  return error.details.reason;
}

/** Получает сумму возврата из RefundError. */
export function getRefundAmount(error: RefundError): number | undefined {
  return error.details.refundAmount;
}

/** Получает валюту возврата из RefundError (если доступно). */
export function getRefundCurrency(error: RefundError): string | undefined {
  return error.details.currency;
}

/** Получает дни с момента транзакции из RefundError. */
export function getRefundDaysSinceTransaction(error: RefundError): number | undefined {
  return error.details.daysSinceTransaction;
}

// ==================== UTILITY FUNCTIONS ====================

/** Получает код ошибки из BillingServiceError (error) */
export function getBillingServiceErrorCode(error: BillingServiceError): ErrorCode {
  return error.code;
}

/** Получает timestamp из BillingServiceError (error) */
export function getBillingServiceErrorTimestamp(error: BillingServiceError): string {
  return error.timestamp;
}

/** Получает сводку ошибки из BillingServiceError (error) */
export function getBillingServiceErrorSummary(error: BillingServiceError): string {
  return matchBillingServiceError(error, {
    paymentFailedError: (e) =>
      `Payment failed for ${getPaymentTransactionId(e)} (${getPaymentAmount(e)} ${
        getPaymentCurrency(e)
      })`,
    subscriptionError: (e) =>
      `Subscription error for ${getSubscriptionId(e)}: ${getSubscriptionErrorReason(e)}`,
    refundError: (e) => `Refund error for ${getRefundTransactionId(e)}: ${getRefundErrorReason(e)}`,
    infrastructureUnknownError: (e) => `Infrastructure unknown error: ${e.message}`,
  });
}
