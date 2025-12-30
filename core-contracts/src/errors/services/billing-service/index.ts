/**
 * @file index.ts - Экспорт billing service ошибок LivAiBot
 *
 * Единая точка входа для всех billing service типов ошибок.
 * Предоставляет selective exports для поддержания чистого API.
 */

// ==================== DOMAIN ERRORS ====================

export type {
  BillingOperation,
  CurrencyCode,
  ISO4217CurrencyCode,
  PaymentValidationError,
  PaymentValidationErrorContext,
  PaymentValidationReason,
  PaymentValidationRule,
  SupportedCurrency,
  SupportedPaymentMethod,
} from './domain/index.js';

export {
  BILLING_OPERATION_COUNT,
  BILLING_OPERATION_VALUES,
  BILLING_OPERATIONS,
  convertToMajorUnits,
  convertToMinorUnits,
  createPaymentValidationError,
  CURRENCY_CODE_COUNT,
  CURRENCY_CODE_VALUES,
  formatPaymentAmount,
  getCurrencyLimit,
  getCurrencyType,
  getPaymentSessionId,
  getPaymentUserId,
  getPaymentValidationErrorSeverity,
  getPaymentValidationReason,
  getPaymentValidationRule,
  getPaymentValidationSuggestions,
  isBillingOperation,
  isCurrencyCode,
  isCurrencySupported,
  isPaymentAmountValid,
  isPaymentMethodSupported,
  isPaymentValidationError,
  isValidPaymentValidationErrorContext,
  makeBillingOperation,
  makeCurrencyCode,
  PAYMENT_MAXIMUM_AMOUNTS,
  PAYMENT_MINIMUM_AMOUNTS,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CURRENCY_CODES,
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

export type { ValidatedBillingOperation } from './BillingServiceValidators.js';

export {
  validateAmount,
  validateBillingOperation,
  validateCurrency,
  validatePaymentMethod,
} from './BillingServiceValidators.js';

// ==================== INFRASTRUCTURE ERRORS ====================

export type {
  BePaidAPIError,
  BePaidAPIErrorContext,
  BePaidErrorCode,
  BePaidHttpStatus,
  GatewayUnavailableReason,
  GenericAPIError,
  GenericAPIErrorContext,
  PaymentGatewayUnavailableError,
  PaymentGatewayUnavailableErrorContext,
  WebPayAPIError,
  WebPayAPIErrorContext,
  WebPayErrorCode,
  WebPayHttpStatus,
} from './infrastructure/index.js';

// PaymentProviderId from shared layer
export type { PaymentProviderId } from '../../shared/index.js';

export {
  BEPAID_ERROR_CODES,
  BEPAID_HTTP_STATUSES,
  createBePaidAPIError,
  createGenericAPIError,
  createPaymentGatewayUnavailableError,
  createWebPayAPIError,
  getEstimatedRecoveryTimeMin,
  getGenericAPIErrorCorrelationId,
  getGenericAPIErrorHttpStatus,
  getGenericAPIErrorMessage,
  getGenericAPIErrorProvider,
  getGenericAPIErrorRawResponse,
  getRetryAfterMs,
  getSourceErrorTag,
  getSuggestedAlternatives,
  getUnavailableProvider,
  getUnavailableReason,
  getWebPayErrorCode,
  getWebPayHttpStatus,
  getWebPayOrderId,
  getWebPayRawPayload,
  getWebPayTransactionId,
  getWebPayTransactionStatus,
  hasSuggestedAlternatives,
  isBePaidAPIError,
  isBePaidCardError,
  isBePaidRetryableError,
  isGatewayUnavailableRetryable,
  isGenericAPIError,
  isPaymentGatewayUnavailableError,
  isValidBePaidAPIErrorContext,
  isValidGenericAPIErrorContext,
  isValidPaymentGatewayUnavailableErrorContext,
  isValidWebPayAPIErrorContext,
  isWebPayAPIError,
  isWebPayCardError,
  isWebPayRetryableError,
  shouldConsiderAlternatives,
  WEBPAY_ERROR_CODES,
  WEBPAY_HTTP_STATUSES,
} from './infrastructure/index.js';

// PaymentProviderId utilities from shared layer
export { isPaymentProviderId, MAX_PROVIDER_ID_LENGTH } from '../../shared/index.js';

// ==================== INSTRUMENTATION ====================

export type {
  BillingInstrumentationContext,
  BillingMetricAttributes,
  FraudRisk,
  MeterFactory,
  OperationResult,
  TracerFactory,
} from './BillingServiceInstrumentation.js';

export {
  BILLING_PROVIDERS,
  billingInstrumentationLayer,
  billingServiceMetricsLayer,
  billingServiceTracerLayer,
  instrumentBillingOperation,
  instrumentPayment,
  instrumentRefund,
  makeBillingServiceConfig,
} from './BillingServiceInstrumentation.js';

export type { BillingServiceConfig } from './BillingServiceInstrumentation.js';

// ==================== POLICIES ====================

export {
  evaluateFraudDetectionPolicy,
  evaluatePaymentRetryPolicy,
  evaluateRefundPolicy,
} from './policies/index.js';

// ==================== SERIALIZATION ====================

export {
  createPaymentErrorSerializer,
  serializeGrpcToJsonString,
  serializeGrpcWithMetadataToJsonString,
  serializeHttpToJsonString,
  serializeHttpWithMetadataToJsonString,
  serializePaymentErrorGrpc,
  serializePaymentErrorHttp,
} from './serialization/index.js';

export type {
  BaseErrorPlainObject,
  GrpcPaymentResultSerializationResult,
  GrpcPaymentSerializationResult,
  HttpPaymentResultSerializationResult,
  HttpPaymentSerializationResult,
  PaymentError,
  PaymentErrorDetails,
  PaymentErrorSerializationOutcome,
  PaymentErrorSerializerConfig,
  PaymentErrorSerializerRequestConfig,
  PaymentGrpcDetailsFormatter,
  PaymentResult,
  PaymentResultSerializationOutcome,
  PaymentResultSerializerConfig,
  PaymentResultSerializerRequestConfig,
  PaymentSuccess,
} from './serialization/index.js';

export {
  PAYMENT_GRPC_STATUS,
  PAYMENT_HTTP_STATUS,
  PAYMENT_RESULT_GRPC_STATUS,
  PAYMENT_RESULT_HTTP_STATUS,
} from './serialization/index.js';

// ==================== PAYMENT RESULT SERIALIZATION ====================

export {
  createPaymentResultSerializer,
  serializePaymentResultGrpc,
  serializePaymentResultHttp,
} from './serialization/index.js';

// ==================== ADAPTERS ====================

export type {
  BePaidAdapterConfig,
  BePaidAdapterError,
  BePaidPaymentRequest,
  BePaidPaymentResponse,
  BePaidSDK,
  WebPayAdapterConfig,
  WebPayAdapterError,
  WebPayPaymentRequest,
  WebPayPaymentResponse,
  WebPaySDK,
} from './adapters/index.js';

export {
  bePaidAdapter,
  bePaidCircuitBreakerContext,
  bePaidConfigContext,
  bePaidSDKContext,
  createBePaidAdapterClient,
  createBePaidCircuitLayer,
  createBePaidConfigLayer,
  createBePaidSDKLayer,
  createWebPayAdapterClient,
  createWebPayConfigLayer,
  createWebPaySDKLayer,
  mapBePaidError,
  mapWebPayError,
  webPayAdapter,
  webPayConfigContext,
  webPaySDKContext,
} from './adapters/index.js';
