/**
 * @file index.ts - Экспорт доменных ошибок billing service
 *
 * Специализированные доменные ошибки для платежей и подписок.
 * Включает валидацию платежей, лимиты подписок и политику возвратов.
 */

import type { PaymentValidationError } from './PaymentValidationError.js';
import type { RefundPolicyError } from './RefundPolicyError.js';
import type { SubscriptionLimitError } from './SubscriptionLimitError.js';

// ==================== PAYMENT ERRORS ====================

export type {
  ISO4217CurrencyCode,
  PaymentValidationError,
  PaymentValidationErrorContext,
  PaymentValidationReason,
  PaymentValidationRule,
  SupportedCurrency,
  SupportedPaymentMethod,
} from './PaymentValidationError.js';

export {
  convertToMajorUnits,
  convertToMinorUnits,
  createPaymentValidationError,
  formatPaymentAmount,
  getCurrencyLimit,
  getCurrencyType,
  getPaymentAmount,
  getPaymentCurrency,
  getPaymentSessionId,
  getPaymentTransactionId,
  getPaymentUserId,
  getPaymentValidationReason,
  getPaymentValidationRule,
  getPaymentValidationSuggestions,
  getPaymentValidationErrorSeverity,
  isCurrencySupported,
  isPaymentAmountValid,
  isPaymentMethodSupported,
  isPaymentValidationError,
  isValidPaymentValidationErrorContext,
  PAYMENT_MAXIMUM_AMOUNTS,
  PAYMENT_MINIMUM_AMOUNTS,
  SUPPORTED_CURRENCIES,
  SUPPORTED_PAYMENT_METHODS,
  VALID_PAYMENT_VALIDATION_REASONS,
} from './PaymentValidationError.js';

// ==================== SUBSCRIPTION ERRORS ====================

export type {
  SubscriptionLimitError,
  SubscriptionLimitErrorContext,
  SubscriptionLimitReason,
} from './SubscriptionLimitError.js';

export {
  createSubscriptionLimitError,
  getAllowedUsage,
  getCurrentUsage,
  getSubscriptionLimitReason,
  getSubscriptionPlanId,
  getUpgradeOptions,
  getUsagePercentage,
  isSubscriptionLimitError,
  isValidSubscriptionLimitErrorContext,
  PERCENT_BASE,
  requiresUpgrade,
  VALID_SUBSCRIPTION_LIMIT_REASONS,
} from './SubscriptionLimitError.js';

// ==================== REFUND POLICY ERRORS ====================

export type {
  RefundPolicyError,
  RefundPolicyErrorContext,
  RefundPolicyReason,
} from './RefundPolicyError.js';

export {
  createRefundPolicyError,
  DEFAULT_REFUND_SUGGESTIONS,
  getDaysSinceTransaction,
  getMaxRefundAmount,
  getMaxRefundWindowDays,
  getRecommendedRefundActions,
  getRefundAmount,
  getRefundAmountPercentage,
  getRefundCurrency,
  getRefundPolicyReason,
  getRefundPolicySuggestions,
  getRefundRegionId,
  getRefundSessionId,
  getRefundTenantId,
  getRefundTransactionId,
  getRefundUserId,
  getRefundWindowPercentage,
  isRefundAmountExceeded,
  isRefundPolicyError,
  isRefundWindowExpired,
  isValidRefundPolicyErrorContext,
  VALID_REFUND_POLICY_REASONS,
} from './RefundPolicyError.js';

// ==================== UNION TYPE ====================

/** Объединение всех доменных ошибок billing service */
export type BillingDomainError =
  | PaymentValidationError
  | SubscriptionLimitError
  | RefundPolicyError;
