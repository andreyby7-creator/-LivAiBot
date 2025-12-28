/**
 * @file index.ts - Экспорт billing service ошибок LivAiBot
 *
 * Единая точка входа для всех billing service типов ошибок.
 * Предоставляет selective exports для поддержания чистого API.
 */

// ==================== DOMAIN ERRORS ====================

export type {
  ISO4217CurrencyCode,
  PaymentValidationError,
  PaymentValidationErrorContext,
  PaymentValidationReason,
  PaymentValidationRule,
  SupportedCurrency,
  SupportedPaymentMethod,
} from './domain/index.js';

export {
  convertToMajorUnits,
  convertToMinorUnits,
  createPaymentValidationError,
  formatPaymentAmount,
  getCurrencyLimit,
  getCurrencyType,
  getPaymentSessionId,
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
} from './domain/index.js';

export type {
  SubscriptionLimitError,
  SubscriptionLimitErrorContext,
  SubscriptionLimitReason,
} from './domain/index.js';

export {
  createSubscriptionLimitError,
  getSubscriptionLimitReason,
  getUpgradeOptions,
  getUsagePercentage,
  isSubscriptionLimitError,
  isValidSubscriptionLimitErrorContext,
  PERCENT_BASE as SUBSCRIPTION_PERCENT_BASE,
  requiresUpgrade,
  VALID_SUBSCRIPTION_LIMIT_REASONS,
} from './domain/index.js';

export type {
  RefundPolicyError,
  RefundPolicyErrorContext,
  RefundPolicyReason,
} from './domain/index.js';

export {
  createRefundPolicyError,
  DEFAULT_REFUND_SUGGESTIONS,
  getMaxRefundWindowDays,
  getRecommendedRefundActions,
  getRefundPolicyReason,
  getRefundRegionId,
  getRefundSessionId,
  getRefundTenantId,
  getRefundUserId,
  getRefundWindowPercentage,
  isRefundPolicyError,
  isValidRefundPolicyErrorContext,
  VALID_REFUND_POLICY_REASONS,
} from './domain/index.js';

export type { BillingDomainError } from './domain/index.js';

// ==================== SERVICE ERROR TYPES ====================

export type {
  BillingServiceError,
  PaymentFailedError,
  RefundError,
  SubscriptionError,
} from './BillingServiceErrorTypes.js';

export {
  createPaymentFailedError,
  createRefundError,
  createSubscriptionError,
  domainErrorToServiceError,
  getBillingServiceErrorCode,
  getBillingServiceErrorSummary,
  getBillingServiceErrorTimestamp,
  getPaymentAmount,
  getPaymentCurrency,
  getPaymentProvider,
  getPaymentTransactionId,
  getRefundAmount,
  getRefundCurrency,
  getRefundDaysSinceTransaction,
  getRefundErrorReason,
  getRefundTransactionId,
  getSubscriptionAllowedUsage,
  getSubscriptionCurrentUsage,
  getSubscriptionErrorReason,
  getSubscriptionId,
  getSubscriptionPlanId,
  isBillingServiceError,
  isPaymentFailedError,
  isPaymentRetryable,
  isRefundError,
  isSubscriptionError,
  matchBillingServiceError,
  safeMatchBillingServiceError,
} from './BillingServiceErrorTypes.js';

// ==================== ERROR REGISTRY ====================

export type {
  BillingBehaviorMetadata,
  BillingComplianceMetadata,
  BillingMetadata,
  BillingServiceErrorMetadata,
} from './BillingServiceErrorRegistry.js';

export {
  BILLING_SERVICE_ERROR_REGISTRY,
  getBillingErrorMetadata,
} from './BillingServiceErrorRegistry.js';

// ==================== VALIDATORS ====================

export type {
  BillingOperation,
  ValidatedBillingOperation,
} from './BillingServiceValidators.js';

export {
  validateAmount,
  validateCurrency,
  validatePaymentMethod,
  validateBillingOperation,
} from './BillingServiceValidators.js';

// ==================== FUTURE EXPORTS (PLACEHOLDERS) ====================

// These will be added as we implement the remaining layers:
// export { validateAmount, validateCurrency, validatePaymentMethod, validateBillingOperation } from './BillingServiceValidators.js';
// export type { StripeAPIError, PayPalAPIError, PaymentGatewayUnavailableError } from './infrastructure/index.js';
// export { evaluatePaymentRetryPolicy, evaluateFraudRisk, evaluateRefundPolicy } from './policies/index.js';
// export { instrumentBillingOperation } from './BillingServiceInstrumentation.js';
// export { serializePaymentError, serializePaymentResult } from './serialization/index.js';
// export { createStripeAdapter, createPayPalAdapter } from './adapters/index.js';
