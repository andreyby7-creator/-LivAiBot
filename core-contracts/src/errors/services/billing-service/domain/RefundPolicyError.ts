/**
 * @file RefundPolicyError.ts - Доменные ошибки политики возвратов LivAiBot
 *
 * Бизнес-ошибки нарушений политики возвратов платежей.
 * Включает проверки окон возврата, типов транзакций и сумм возвратов.
 *
 * Возможности:
 * - Полная политика возвратов (временные окна, суммы, типы транзакций)
 * - Enterprise трассировка (transactionId, userId, currency)
 * - UX/analytics подсказки (suggestions для улучшения пользовательского опыта)
 * - Расчеты возвратов (проценты, лимиты)
 * - PCI-safe (без чувствительных данных)
 * - Audit-ready (timestamps, структурированный контекст)
 *
 * Будущие улучшения:
 * - Мульти-валютная поддержка возвратов
 * - Динамические политики по регионам
 * - Интеграция с fraud detection
 * - Автоматические ретри возвратов
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { ISO4217CurrencyCode } from './PaymentValidationError.js';
import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

// ==================== CONSTANTS ====================

/** Допустимые причины нарушений политики возвратов */
export const VALID_REFUND_POLICY_REASONS: readonly RefundPolicyReason[] = [
  'refund-window-expired',
  'non-refundable-transaction',
  'partial-refund-not-allowed',
  'refund-amount-exceeded',
  'refund-already-processed',
  'insufficient-funds',
] as const;

/** База для расчетов процентов (100%) */
export const PERCENT_BASE = 100;

/** Дефолтные рекомендации для разных типов ошибок возвратов */
export const DEFAULT_REFUND_SUGGESTIONS: Record<RefundPolicyReason, readonly string[]> = {
  'refund-window-expired': ['Contact customer support for exceptional refund approval'],
  'non-refundable-transaction': [
    'Review transaction type eligibility',
    'Consider alternative compensation',
  ],
  'partial-refund-not-allowed': ['Process full refund or cancel transaction'],
  'refund-amount-exceeded': [
    'Reduce refund amount to maximum allowed',
    'Contact support for approval',
  ],
  'refund-already-processed': ['Check refund status in transaction history'],
  'insufficient-funds': ['Verify account balance', 'Contact financial operations'],
} as const;

// ==================== REFUND POLICY TYPES ====================

/** Причины нарушений политики возвратов */
export type RefundPolicyReason =
  | 'refund-window-expired' // Истекло время для возврата
  | 'non-refundable-transaction' // Транзакция не подлежит возврату
  | 'partial-refund-not-allowed' // Частичный возврат не разрешен
  | 'refund-amount-exceeded' // Сумма возврата превышает разрешенную
  | 'refund-already-processed' // Возврат уже обработан
  | 'insufficient-funds'; // Недостаточно средств для возврата

/** Контекст ошибки политики возвратов */
export type RefundPolicyErrorContext = {
  readonly type: 'refund_policy';
  readonly reason: RefundPolicyReason;
  readonly transactionId: string;
  readonly refundAmount?: number;
  readonly maxRefundAmount?: number;
  readonly daysSinceTransaction?: number;
  readonly maxRefundWindowDays?: number;
  readonly resetDate?: Date | string; // Дата сброса/окончания периода возврата
  readonly currency?: ISO4217CurrencyCode; // Для мульти-валютной трассировки
  readonly userId?: string; // Для enterprise audit
  readonly sessionId?: string; // Для security tracking
  readonly regionId?: string; // Для multi-region поддержки
  readonly tenantId?: string; // Для multi-tenant поддержки
  readonly suggestions?: readonly string[]; // UX подсказки и analytics
};

/** TaggedError для ошибок политики возвратов */
export type RefundPolicyError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.DOMAIN;
  readonly severity: typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details: RefundPolicyErrorContext;
  readonly timestamp: string;
}, 'RefundPolicyError'>;

/** Создает RefundPolicyError */
export function createRefundPolicyError(
  reason: RefundPolicyReason,
  transactionId: string,
  message: string,
  context?: Omit<RefundPolicyErrorContext, 'type' | 'reason' | 'transactionId'>,
  severity?: typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL,
  timestamp?: string,
): RefundPolicyError {
  return {
    _tag: 'RefundPolicyError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: severity ?? getRefundPolicySeverity(reason),
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_POLICY_VIOLATION,
    message,
    details: {
      type: 'refund_policy',
      reason,
      transactionId,
      ...context,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as RefundPolicyError;
}

/** Определяет severity для refund policy ошибок */
function getRefundPolicySeverity(
  reason: RefundPolicyReason,
): typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL {
  // Критические ошибки (требуют немедленного внимания)
  if (reason === 'insufficient-funds') {
    return ERROR_SEVERITY.CRITICAL;
  }
  // Все остальные refund policy ошибки - высокий уровень
  return ERROR_SEVERITY.HIGH;
}

// ==================== TYPE GUARDS & VALIDATION ====================

/** Проверяет RefundPolicyErrorContext */
export function isValidRefundPolicyErrorContext(
  context: unknown,
): context is RefundPolicyErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Обязательные поля
  if (ctx['type'] !== 'refund_policy') return false;
  if (typeof ctx['reason'] !== 'string') return false;
  if (typeof ctx['transactionId'] !== 'string') return false;

  // Проверяем что reason допустимый
  if (!VALID_REFUND_POLICY_REASONS.includes(ctx['reason'] as RefundPolicyReason)) return false;

  // Опциональные поля с бизнес-валидацией
  if (
    ctx['refundAmount'] !== undefined
    && (typeof ctx['refundAmount'] !== 'number' || ctx['refundAmount'] < 0)
  ) return false;
  if (
    ctx['maxRefundAmount'] !== undefined
    && (typeof ctx['maxRefundAmount'] !== 'number' || ctx['maxRefundAmount'] <= 0)
  ) return false;
  if (
    ctx['daysSinceTransaction'] !== undefined
    && (typeof ctx['daysSinceTransaction'] !== 'number' || ctx['daysSinceTransaction'] < 0)
  ) return false;
  if (
    ctx['maxRefundWindowDays'] !== undefined
    && (typeof ctx['maxRefundWindowDays'] !== 'number' || ctx['maxRefundWindowDays'] <= 0)
  ) return false;

  if (ctx['currency'] !== undefined && typeof ctx['currency'] !== 'string') return false;
  if (ctx['userId'] !== undefined && typeof ctx['userId'] !== 'string') return false;
  if (ctx['sessionId'] !== undefined && typeof ctx['sessionId'] !== 'string') return false;
  if (ctx['regionId'] !== undefined && typeof ctx['regionId'] !== 'string') return false;
  if (ctx['tenantId'] !== undefined && typeof ctx['tenantId'] !== 'string') return false;
  if (
    ctx['resetDate'] !== undefined
    && (typeof ctx['resetDate'] !== 'string' && !(ctx['resetDate'] instanceof Date))
  ) return false;

  if (ctx['suggestions'] !== undefined) {
    if (!Array.isArray(ctx['suggestions'])) return false;
    if (ctx['suggestions'].length === 0) return false; // Reject empty array
    if (!ctx['suggestions'].every((s: unknown) => typeof s === 'string' && s.trim().length > 0)) {
      return false;
    }
  }

  return true;
}

/** Проверяет является ли ошибка RefundPolicyError */
export function isRefundPolicyError(
  error: unknown,
): error is RefundPolicyError {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as { _tag: string; })._tag === 'RefundPolicyError'
  );
}

// ==================== ACCESSOR FUNCTIONS ====================

/** Получает причину нарушения политики возврата */
export function getRefundPolicyReason(
  error: RefundPolicyError,
): RefundPolicyReason {
  return error.details.reason;
}

/** Получает ID транзакции */
export function getRefundTransactionId(
  error: RefundPolicyError,
): string {
  return error.details.transactionId;
}

/** Получает сумму возврата */
export function getRefundAmount(
  error: RefundPolicyError,
): number | undefined {
  return error.details.refundAmount;
}

/** Получает максимальную сумму возврата */
export function getMaxRefundAmount(
  error: RefundPolicyError,
): number | undefined {
  return error.details.maxRefundAmount;
}

/** Получает количество дней с момента транзакции */
export function getDaysSinceTransaction(
  error: RefundPolicyError,
): number | undefined {
  return error.details.daysSinceTransaction;
}

/** Получает максимальное окно возврата в днях */
export function getMaxRefundWindowDays(
  error: RefundPolicyError,
): number | undefined {
  return error.details.maxRefundWindowDays;
}

/** Получает валюту возврата */
export function getRefundCurrency(
  error: RefundPolicyError,
): string | undefined {
  return error.details.currency;
}

/** Получает ID пользователя */
export function getRefundUserId(
  error: RefundPolicyError,
): string | undefined {
  return error.details.userId;
}

/** Получает ID сессии */
export function getRefundSessionId(
  error: RefundPolicyError,
): string | undefined {
  return error.details.sessionId;
}

/** Получает ID региона */
export function getRefundRegionId(
  error: RefundPolicyError,
): string | undefined {
  return error.details.regionId;
}

/** Получает ID тенанта */
export function getRefundTenantId(
  error: RefundPolicyError,
): string | undefined {
  return error.details.tenantId;
}

/** Получает подсказки для UX/analytics */
export function getRefundPolicySuggestions(
  error: RefundPolicyError,
): readonly string[] | undefined {
  return error.details.suggestions;
}

// ==================== BUSINESS LOGIC HELPERS ====================

/** Вычисляет процент использованного окна возврата */
export function getRefundWindowPercentage(
  error: RefundPolicyError,
): number | undefined {
  const daysSince = error.details.daysSinceTransaction;
  const maxDays = error.details.maxRefundWindowDays;

  if (daysSince === undefined || maxDays === undefined || maxDays === 0) {
    return undefined;
  }

  return Math.min(Math.round((daysSince / maxDays) * PERCENT_BASE), PERCENT_BASE);
}

/** Вычисляет процент запрошенной суммы возврата от максимально возможной */
export function getRefundAmountPercentage(
  error: RefundPolicyError,
): number | undefined {
  const refundAmount = error.details.refundAmount;
  const maxAmount = error.details.maxRefundAmount;

  if (refundAmount === undefined || maxAmount === undefined || maxAmount === 0) {
    return undefined;
  }

  return Math.min(Math.round((refundAmount / maxAmount) * PERCENT_BASE), PERCENT_BASE);
}

/** Проверяет истекло ли окно возврата */
export function isRefundWindowExpired(
  error: RefundPolicyError,
): boolean {
  const percentage = getRefundWindowPercentage(error);
  return percentage !== undefined && percentage >= PERCENT_BASE;
}

/** Проверяет превышает ли сумма возврата лимит */
export function isRefundAmountExceeded(
  error: RefundPolicyError,
): boolean {
  const refundAmount = error.details.refundAmount;
  const maxAmount = error.details.maxRefundAmount;

  if (refundAmount === undefined || maxAmount === undefined) {
    return false;
  }

  return refundAmount > maxAmount;
}

/** Получает рекомендуемые действия для исправления ошибки */
export function getRecommendedRefundActions(
  error: RefundPolicyError,
): readonly string[] {
  const suggestions = error.details.suggestions;
  if (suggestions && suggestions.length > 0) {
    return suggestions;
  }

  // Default suggestions based on reason
  return DEFAULT_REFUND_SUGGESTIONS[error.details.reason];
}
