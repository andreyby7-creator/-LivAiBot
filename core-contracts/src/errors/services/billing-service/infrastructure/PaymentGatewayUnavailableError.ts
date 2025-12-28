/**
 * @file PaymentGatewayUnavailableError.ts - Системная ошибка недоступности платежного шлюза
 *
 * Критическая ошибка недоступности платежного шлюза для LivAiBot Billing Service.
 * Используется для failover, retry и circuit breaker сценариев.
 *
 * Особенности:
 * - Не зависит от конкретного провайдера (WebPay, BePaid, банки)
 * - Критический SRE сигнал влияющий на revenue
 * - Точка схождения всей платежной инфраструктуры
 * - Включает информацию о альтернативных провайдерах
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';
import { isPaymentProviderId } from '../../../shared/PaymentProviderId.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { PaymentProviderId } from '../../../shared/PaymentProviderId.js';

// ==================== HELPER FUNCTIONS ====================

/** Проверяет, является ли значение числом */
const isNumber = (value: unknown): value is number => typeof value === 'number';

/** Проверяет, является ли значение неотрицательным целым числом */
const isNonNegativeInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= 0;

/** Проверяет, является ли значение строкой */
const isString = (value: unknown): value is string => typeof value === 'string';

/** Проверяет, является ли значение допустимой причиной недоступности */
const isValidGatewayUnavailableReason = (value: unknown): value is GatewayUnavailableReason =>
  isString(value) && [
    'timeout',
    'network_error',
    'rate_limit',
    'maintenance',
    'degraded',
    'upstream_dependency',
    'unknown',
  ].includes(value);

// ==================== TYPES & CONSTANTS ====================

/** Причины недоступности платежного шлюза */
export type GatewayUnavailableReason =
  | 'timeout' // Таймаут подключения к провайдеру
  | 'network_error' // Сетевая ошибка или недоступность
  | 'rate_limit' // Превышение лимитов запросов
  | 'maintenance' // Техническое обслуживание провайдера
  | 'degraded' // Провайдер в degraded состоянии (частично работает)
  | 'upstream_dependency' // Недоступность upstream зависимостей провайдера
  | 'unknown'; // Неизвестная причина недоступности

/** Контекст ошибки недоступности платежного шлюза */
export type PaymentGatewayUnavailableErrorContext = {
  /** Провайдер, который недоступен */
  readonly provider: PaymentProviderId;

  /** Причина недоступности */
  readonly reason: GatewayUnavailableReason;

  /** Время ожидания перед повторной попыткой (мс) */
  readonly retryAfterMs?: number;

  /** Ожидаемое время восстановления (минуты) */
  readonly estimatedRecoveryTimeMin?: number;

  /** Предлагаемые альтернативные провайдеры (не является стратегией failover) */
  readonly suggestedAlternatives?: readonly PaymentProviderId[];

  /** Тег исходной ошибки (WebPayAPIError, BePaidAPIError и т.д.) */
  readonly sourceErrorTag?: string;

  /**
   * Дополнительный контекст для debugging
   *
   * ⚠️ Ограничения использования:
   * - НЕ сериализуется в API responses
   * - НЕ логируется в PII-unsafe средах (GDPR/HIPAA compliance)
   * - Только для internal debugging и incident analysis
   */
  readonly debugInfo?: Record<string, unknown>;
};

/** TaggedError тип для ошибок недоступности платежного шлюза */
export type PaymentGatewayUnavailableError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.SYSTEM;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.CRITICAL;
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_GATEWAY_UNAVAILABLE;
  readonly message: string;
  readonly details?: PaymentGatewayUnavailableErrorContext;
  readonly timestamp: string;
}, 'PaymentGatewayUnavailableError'>;

// ==================== FACTORY FUNCTION ====================

/**
 * Создает PaymentGatewayUnavailableError с указанным сообщением, контекстом и timestamp
 *
 * Это системная ошибка, которая поднимается на уровне BillingService/PaymentOrchestrator
 * когда конкретный платежный провайдер недоступен и требуется failover или retry.
 */
export function createPaymentGatewayUnavailableError(
  message: string,
  context: PaymentGatewayUnavailableErrorContext,
  timestamp?: string,
): PaymentGatewayUnavailableError {
  return {
    _tag: 'PaymentGatewayUnavailableError',
    category: ERROR_CATEGORY.SYSTEM,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.CRITICAL,
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_GATEWAY_UNAVAILABLE,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as const;
}

// ==================== VALIDATION ====================

/** Проверяет валидность PaymentGatewayUnavailableErrorContext */
export function isValidPaymentGatewayUnavailableErrorContext(
  context: unknown,
): context is PaymentGatewayUnavailableErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Защита от вложенных ошибок - context не должен содержать _tag
  if ('_tag' in ctx) return false;

  // Обязательные поля
  if (!isPaymentProviderId(ctx['provider'])) return false;
  if (!isValidGatewayUnavailableReason(ctx['reason'])) return false;

  // Опциональные поля
  if (ctx['retryAfterMs'] !== undefined && !isNonNegativeInteger(ctx['retryAfterMs'])) return false;
  if (
    ctx['estimatedRecoveryTimeMin'] !== undefined
    && !isNonNegativeInteger(ctx['estimatedRecoveryTimeMin'])
  ) return false;
  if (ctx['suggestedAlternatives'] !== undefined) {
    if (!Array.isArray(ctx['suggestedAlternatives'])) return false;
    if (!ctx['suggestedAlternatives'].every(isPaymentProviderId)) return false;
  }
  if (ctx['sourceErrorTag'] !== undefined && !isString(ctx['sourceErrorTag'])) return false;
  // debugInfo может быть любым объектом

  return true;
}

// ==================== TYPE GUARD ====================

/** Type guard для проверки PaymentGatewayUnavailableError */
export function isPaymentGatewayUnavailableError(
  error: unknown,
): error is PaymentGatewayUnavailableError {
  if (
    typeof error !== 'object'
    || error === null
    || !('_tag' in error)
    || !('code' in error)
    || !('details' in error)
  ) {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Проверяем основные поля ошибки
  const hasValidTag = err['_tag'] === 'PaymentGatewayUnavailableError';
  const hasValidCode = err['code'] === SERVICE_ERROR_CODES.SERVICE_BILLING_GATEWAY_UNAVAILABLE;

  // Проверяем валидность контекста ошибки
  const hasValidDetails = isValidPaymentGatewayUnavailableErrorContext(err['details']);

  return hasValidTag && hasValidCode && hasValidDetails;
}

// ==================== GETTER FUNCTIONS ====================

/** Извлекает провайдера из ошибки недоступности */
export function getUnavailableProvider(
  error: PaymentGatewayUnavailableError,
): PaymentProviderId | undefined {
  return error.details?.provider;
}

/** Извлекает причину недоступности */
export function getUnavailableReason(
  error: PaymentGatewayUnavailableError,
): GatewayUnavailableReason | undefined {
  return error.details?.reason;
}

/** Извлекает время ожидания перед retry */
export function getRetryAfterMs(error: PaymentGatewayUnavailableError): number | undefined {
  return error.details?.retryAfterMs;
}

/** Извлекает ожидаемое время восстановления */
export function getEstimatedRecoveryTimeMin(
  error: PaymentGatewayUnavailableError,
): number | undefined {
  return error.details?.estimatedRecoveryTimeMin;
}

/** Извлекает предлагаемые альтернативные провайдеры */
export function getSuggestedAlternatives(
  error: PaymentGatewayUnavailableError,
): readonly PaymentProviderId[] | undefined {
  return error.details?.suggestedAlternatives;
}

/** Проверяет, есть ли предлагаемые альтернативные провайдеры */
export function hasSuggestedAlternatives(error: PaymentGatewayUnavailableError): boolean {
  return Boolean(
    error.details?.suggestedAlternatives && error.details.suggestedAlternatives.length > 0,
  );
}

/** Извлекает тег исходной ошибки */
export function getSourceErrorTag(error: PaymentGatewayUnavailableError): string | undefined {
  return error.details?.sourceErrorTag;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * @orchestration-helper Определяет, является ли ошибка retryable (policy decision)
 *
 * ⚠️ Это orchestration utility, а не domain знание.
 * Использовать только в PaymentOrchestrator / BillingService.
 * Не является частью core error domain model.
 */
export function isGatewayUnavailableRetryable(error: PaymentGatewayUnavailableError): boolean {
  const reason = getUnavailableReason(error);

  // Временные/переходящие проблемы - retryable
  return reason
    ? [
      'timeout',
      'network_error',
      'rate_limit',
      'degraded', // Частично работает - может восстановиться
      'upstream_dependency', // Upstream проблемы могут быть временными
    ].includes(reason)
    : false;
}

/**
 * @orchestration-helper Определяет, стоит ли рассмотреть альтернативные провайдеры (policy decision)
 *
 * ⚠️ Это orchestration utility, а не domain знание.
 * Использовать только в PaymentOrchestrator / BillingService.
 * Не является частью core error domain model.
 */
export function shouldConsiderAlternatives(error: PaymentGatewayUnavailableError): boolean {
  const reason = getUnavailableReason(error);
  const hasSuggestions = hasSuggestedAlternatives(error);

  // Длительные/критические проблемы - рассмотреть альтернативы, если есть предложения
  return reason
    ? [
      'maintenance', // Техобслуживание - длительное
      'upstream_dependency', // Upstream проблемы могут быть длительными
      'unknown', // Неизвестные проблемы - рассмотреть альтернативы для надежности
    ].includes(reason) && hasSuggestions
    : false;
}

/**
 * @orchestration-helper Создает PaymentGatewayUnavailableError из API ошибки провайдера
 *
 * ⚠️ Это orchestration utility, а не domain factory.
 * Использовать только в PaymentOrchestrator / BillingService.
 */
export function createFromProviderAPIError(
  providerError: { _tag: string; },
  provider: PaymentProviderId,
  reason?: GatewayUnavailableReason,
  additionalContext?: Partial<PaymentGatewayUnavailableErrorContext>,
): PaymentGatewayUnavailableError;

/**
 * @orchestration-helper Создает PaymentGatewayUnavailableError из неизвестной ошибки провайдера
 *
 * Безопасно извлекает _tag из любой ошибки для tracing.
 * Если _tag отсутствует, использует 'UnknownProviderError'.
 *
 * ⚠️ Это orchestration utility, а не domain factory.
 * Использовать только в PaymentOrchestrator / BillingService.
 */
export function createFromProviderAPIError(
  providerError: unknown,
  provider: PaymentProviderId,
  reason?: GatewayUnavailableReason,
  additionalContext?: Partial<PaymentGatewayUnavailableErrorContext>,
): PaymentGatewayUnavailableError;

/** Implementation */
export function createFromProviderAPIError(
  providerError: unknown,
  provider: PaymentProviderId,
  reason: GatewayUnavailableReason = 'unknown',
  additionalContext?: Partial<PaymentGatewayUnavailableErrorContext>,
): PaymentGatewayUnavailableError {
  // Безопасно извлекаем _tag из ошибки
  const sourceErrorTag = (typeof providerError === 'object'
      && providerError !== null
      && '_tag' in providerError
      && typeof providerError._tag === 'string')
    ? providerError._tag
    : 'UnknownProviderError';

  const context: PaymentGatewayUnavailableErrorContext = {
    provider,
    reason,
    sourceErrorTag,
    ...additionalContext,
  };

  return createPaymentGatewayUnavailableError(
    `Payment gateway ${provider} is unavailable: ${reason}`,
    context,
  );
}
