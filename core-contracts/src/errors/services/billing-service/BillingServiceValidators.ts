/**
 * @file BillingServiceValidators.ts - Валидаторы для защиты ДО IO операций LivAiBot Billing Service
 *
 * Service-level валидация входных данных для биллинговых операций.
 * Защищает от некорректных данных перед любыми IO операциями (SDK, API, DB).
 *
 * Архитектура: Domain validation helpers → Service validators → BillingServiceError
 *
 * Особенности:
 * - Effect-based для асинхронной композиции
 * - Service-level ошибки (PaymentFailedError)
 * - Transport-agnostic (независим от HTTP/DB/SDK)
 * - Fail-fast валидация
 */

import { Effect } from 'effect';

import { SERVICE_ERROR_CODES } from '../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import {
  isCurrencySupported,
  isPaymentAmountValid,
  isPaymentMethodSupported,
} from './domain/index.js';

import type { PaymentFailedError } from './BillingServiceErrorTypes.js';
import type { SupportedCurrency, SupportedPaymentMethod } from './domain/index.js';

// ==================== RETRY POLICY CONSTANTS ====================

/** Политики повторов для ошибок валидации */
export const VALIDATION_RETRY_POLICIES = {
  /** Немедленный повтор - для быстрого исправления */
  IMMEDIATE: 'immediate',
  /** Отложенный повтор - для временных проблем */
  DELAYED: 'delayed',
  /** Ручной повтор - требует вмешательства */
  MANUAL: 'manual',
} as const;

export type ValidationRetryPolicy =
  typeof VALIDATION_RETRY_POLICIES[keyof typeof VALIDATION_RETRY_POLICIES];

// ==================== OBSERVABILITY CONTEXT ====================

/** Контекст для enterprise трассировки и мониторинга */
export type ObservabilityContext = {
  /** Trace ID для распределенной трассировки */
  traceId?: string;
  /** Session ID пользователя */
  sessionId?: string;
  /** User ID для идентификации пользователя */
  userId?: string;
  /** Request ID для корреляции запросов */
  requestId?: string;
  /** Service name для идентификации сервиса */
  serviceName?: string;
  /** Operation name для детального логирования */
  operationName?: string;
};

/** Дефолтные значения для observability контекста */
export const DEFAULT_OBSERVABILITY_CONTEXT = {
  serviceName: 'billing-service',
  operationName: 'validation',
} as const;

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/** Создает PaymentFailedError для валидации */
function createValidationError(
  transactionId: string,
  amount: number,
  currency: string,
  operation: string,
  retryPolicy?: ValidationRetryPolicy,
  observabilityContext?: ObservabilityContext,
): Effect.Effect<never, PaymentFailedError, never> {
  // Создаем ошибку напрямую, без строгой валидации валюты
  const error: PaymentFailedError = {
    _tag: 'PaymentFailedError',
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
    origin: ERROR_ORIGIN.SERVICE,
    category: ERROR_CATEGORY.BUSINESS,
    severity: ERROR_SEVERITY.HIGH,
    message: `Payment validation failed for transaction ${transactionId}`,
    details: {
      transactionId,
      amount,
      currency, // currency может быть любой строкой для диагностики ошибок
      retryable: !!retryPolicy, // retryable зависит от наличия retryPolicy
      ...(retryPolicy && { retryPolicy }),
      operation,
      // Observability context для enterprise трассировки
      ...(observabilityContext && {
        observability: {
          ...DEFAULT_OBSERVABILITY_CONTEXT,
          ...observabilityContext,
        },
      }),
    },
    timestamp: new Date().toISOString(), // TODO: move to instrumentation layer for deterministic testing
  };

  return Effect.fail(error);
}

/** Общий helper для создания ошибок валидации с параметрами по умолчанию */
const createValidationFailure = (
  amount = 0,
  currency: string = 'N/A',
  operation = 'validation',
  transactionId = 'validation-failed',
  retryPolicy?: ValidationRetryPolicy,
  observabilityContext?: ObservabilityContext,
): Effect.Effect<never, PaymentFailedError, never> =>
  createValidationError(
    transactionId,
    amount,
    currency,
    operation,
    retryPolicy,
    observabilityContext,
  );

// ==================== ТИПЫ ====================

/** Raw input биллинговой операции */
export type BillingOperation = {
  /** Сумма операции в минимальных единицах валюты */
  amount: number;
  /** Код валюты (строка, будет провалидирована) */
  currency: string;
  /** Метод оплаты (опционально, строка, будет провалидирована) */
  paymentMethod?: string;
};

/** Валидированная и нормализованная операция */
export type ValidatedBillingOperation = {
  /** Сумма операции в минимальных единицах валюты */
  amount: number;
  /** Поддерживаемая валюта (нормализована) */
  currency: SupportedCurrency;
  /** Поддерживаемый метод оплаты (опционально, нормализован) */
  paymentMethod: SupportedPaymentMethod | undefined;
};

// ==================== ИНДИВИДУАЛЬНЫЕ ВАЛИДАТОРЫ ====================

/**
 * Валидирует сумму платежа для указанной валюты.
 * Проверяет положительное значение и лимиты валюты.
 * @param amount Сумма в минимальных единицах валюты
 * @param currency Валюта для проверки лимитов
 * @param observabilityContext Контекст для enterprise трассировки
 */
export const validateAmount = (
  amount: number,
  currency: SupportedCurrency,
  observabilityContext?: ObservabilityContext,
): Effect.Effect<number, PaymentFailedError> => {
  // Базовая валидация суммы
  if (!Number.isFinite(amount) || amount <= 0) {
    return createValidationFailure(
      amount,
      currency,
      'amount-validation',
      `amount-invalid-${amount}-${currency}`,
      VALIDATION_RETRY_POLICIES.MANUAL,
      observabilityContext,
    );
  }

  // Проверяем соответствие бизнес-правилам для указанной валюты
  // Используем domain helper для комплексной валидации
  if (!isPaymentAmountValid(amount, currency)) {
    return createValidationFailure(
      amount,
      currency,
      'amount-validation',
      `amount-limits-${amount}-${currency}`,
      VALIDATION_RETRY_POLICIES.MANUAL,
      observabilityContext,
    );
  }

  return Effect.succeed(amount);
};

/**
 * Валидирует и нормализует код валюты.
 * Преобразует строку в SupportedCurrency, проверяет поддержку.
 * @param currency Строковый код валюты
 * @param observabilityContext Контекст для enterprise трассировки
 */
export const validateCurrency = (
  currency: string,
  observabilityContext?: ObservabilityContext,
): Effect.Effect<SupportedCurrency, PaymentFailedError> => {
  // Проверяем поддержку валюты через domain helper
  if (!isCurrencySupported(currency)) {
    return createValidationFailure(
      0,
      currency,
      'currency-validation',
      `currency-unsupported-${currency}`,
      VALIDATION_RETRY_POLICIES.MANUAL,
      observabilityContext,
    );
  }

  // Type guard isCurrencySupported гарантирует, что currency имеет тип SupportedCurrency
  // Никаких дополнительных преобразований не требуется
  return Effect.succeed(currency);
};

/**
 * Валидирует и нормализует метод оплаты.
 * Преобразует опциональную строку в SupportedPaymentMethod | undefined.
 * @param method Опциональный строковый код метода оплаты
 * @param observabilityContext Контекст для enterprise трассировки
 */
export const validatePaymentMethod = (
  method: string | undefined,
  observabilityContext?: ObservabilityContext,
): Effect.Effect<SupportedPaymentMethod | undefined, PaymentFailedError> => {
  // Если метод не указан - возвращаем undefined
  if (method === undefined) {
    return Effect.succeed(undefined);
  }

  // Проверяем поддержку метода через domain helper
  if (!isPaymentMethodSupported(method)) {
    return createValidationFailure(
      0,
      'N/A',
      'payment-method-validation',
      `payment-method-unsupported-${method}`,
      VALIDATION_RETRY_POLICIES.MANUAL,
      observabilityContext,
    );
  }

  // Type guard isPaymentMethodSupported гарантирует, что method имеет тип SupportedPaymentMethod
  // Никаких дополнительных преобразований не требуется
  return Effect.succeed(method);
};

// ==================== КОМПОЗИТНЫЙ ВАЛИДАТОР ====================

/**
 * Комплексная валидация биллинговой операции.
 * Выполняет последовательную валидацию: сумма → валюта → метод оплаты.
 * Fail-fast, возвращает полностью валидированную операцию.
 * @param operation Raw входная биллинговая операция
 * @param observabilityContext Контекст для enterprise трассировки
 */
export const validateBillingOperation = (
  operation: BillingOperation,
  observabilityContext?: ObservabilityContext,
): Effect.Effect<ValidatedBillingOperation, PaymentFailedError> => {
  // Сначала собираем данные операции для явной связи amount ↔ currency
  const { amount, currency: rawCurrency, paymentMethod: rawPaymentMethod } = operation;

  return validateCurrency(rawCurrency, observabilityContext).pipe(
    Effect.flatMap((currency) =>
      validateAmount(amount, currency, observabilityContext).pipe(
        Effect.flatMap((validatedAmount) =>
          validatePaymentMethod(rawPaymentMethod, observabilityContext).pipe(
            Effect.map((paymentMethod) => ({
              amount: validatedAmount,
              currency,
              paymentMethod,
            })),
          )
        ),
      )
    ),
  );
};
