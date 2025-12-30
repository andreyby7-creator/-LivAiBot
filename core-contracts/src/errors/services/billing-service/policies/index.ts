/**
 * @file index.ts - Экспорт политик billing service
 *
 * Политики повторов платежей и принятия решений для billing service.
 * Включает retry policy engine, стратегии повторов и конфигурации.
 */

// ==================== PAYMENT RETRY POLICY ====================

export type {
  AutomaticRetryStrategy,
  BackoffCalculator,
  CircuitBreakerDecision,
  RetryAttemptResult,
  RetryContext,
  RetryDecision,
  RetryDeniedReason,
  RetryPolicyConfig,
  RetryReason,
  RetryStrategy,
  RetryStrategyConfig,
} from './paymentRetryPolicy.js';

export {
  applyJitter,
  createRetryContext,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_JITTER_RATIO,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_POLICY_CONFIG,
  evaluatePaymentRetryPolicy,
  getBackoffCalculator,
  mapRegistryStrategyToRetryStrategy,
  MAX_TOTAL_DELAY_MS,
  updateRetryContext,
} from './paymentRetryPolicy.js';

// ==================== FRAUD DETECTION POLICY ====================

// Types
export type {
  DeviceFingerprint,
  FraudContext,
  FraudDecision,
  FraudPolicyConfig,
  FraudReason,
  FraudRule,
  GeolocationData,
  PaymentAttempt,
  PaymentDetails,
  RulePriority,
  UserPaymentHistory,
} from './fraudDetectionPolicy.js';

// Functions and constants
export {
  DEFAULT_FRAUD_POLICY_CONFIG,
  evaluateFraudDetectionPolicy,
  EXCESSIVE_RETRY_THRESHOLD,
  EXTERNAL_API_RATE_LIMIT,
  GEO_LOOKUP_TIMEOUT_MS,
  HIGH_RISK_THRESHOLD,
  LOW_RISK_THRESHOLD,
  MAX_FRAUD_SCORE,
  MAX_RULES_EVALUATION,
  MIN_PAYMENTS_FOR_HISTORY_ANALYSIS,
  PAYMENT_METHOD_HISTORY_LENGTH,
  RAPID_ATTEMPTS_PERIOD_MINUTES,
  RAPID_ATTEMPTS_THRESHOLD,
  RULE_PRIORITIES,
  TIME_CONSTANTS,
  UNUSUAL_AMOUNT_DEVIATION,
  VELOCITY_ATTACK_PERIOD_MINUTES,
  VELOCITY_ATTACK_THRESHOLD,
} from './fraudDetectionPolicy.js';

// Interfaces
export type {
  applyStandardizedCircuitBreaker,
  applyStandardizedExternalCallOptions,
  applyStandardizedRetry,
  // Constants and utilities
  DEFAULT_EXTERNAL_CALL_OPTIONS,
  DeviceFingerprintData,
  DeviceFingerprintResult,
  ExternalCallOptions,
  ExternalDataProvider,
  ExternalDataProviderError,
  ExternalDataProviderResult,
  ExternalDataService,
  ExternalDataServiceResult,
  FallbackStrategy,
  // Additional error types
  FraudDetectionError,
  FraudDetectionServiceRegistry,
  FraudRuleEngine,
  FraudRuleEngineError,
  FraudRuleEngineResult,
  FraudRuleProvider,
  FraudRuleProviderError,
  FraudRuleProviderResult,
  GeolocationData as ExternalGeolocationData,
  HealthDetails,
  // Health and infrastructure contracts
  HealthStatus,
  // Rule configuration
  JsonFraudRule,
  // Specialized provider result types
  ProviderResult,
  RefundPolicyError,
  RefundPolicyIntegration,
  RefundPolicyResult,
  RefundStatus,
  RuleLoader,
  RuleLoadError,
  RuleSource,
  // Event callbacks
  RulesUpdateCallback,
  RuleVersionInfo,
  // Rule version management
  RuleVersionManager,
  RuleVersionManagerError,
  RuleVersionStatus,
  RuleVersionValidation,
  ServiceHealthContract,
  StandardizedCircuitBreakerOptions,
  StandardizedRetryOptions,
  TenantCallOptions,
  TimeoutOptions,
  TransactionAnalysisResult,
  TransactionAnalyzerError,
  // Transaction and refund services
  TransactionSuccessAnalyzer,
  UserContext,
  withErrorLogging,
  withGracefulFallback,
} from './fraudDetectionInterfaces.js';

// Default implementations
export type { FraudDetectionServices } from './fraudDetectionProviders.js';

export {
  defaultExternalDataProvider,
  DefaultExternalDataService,
  defaultFraudDetectionServices,
  DefaultFraudRuleEngine,
  defaultFraudRuleProvider,
  defaultJsonRuleLoader,
  EnhancedFraudRuleProvider,
  enhancedFraudRuleProvider,
  exampleJsonRuleConfig,
  exampleMixedRuleConfig,
  // Rule examples and configurations
  FRAUD_RULES,
  FRAUD_RULES_JSON,
  // Enhanced rule management
  JsonRuleLoader,
  // Multi-tenant registry
  MultiTenantFraudDetectionRegistry,
  multiTenantRegistry,
} from './fraudDetectionProviders.js';

// ==================== REFUND HANDLING POLICY ====================

// Types
export type { RefundContext, RefundDecision, RefundPolicyConfig } from './refundHandlingPolicy.js';

// Constants
export {
  APPROVE_THRESHOLD,
  CONDITIONAL_THRESHOLD,
  DEFAULT_REFUND_POLICY_CONFIG,
  DENY_THRESHOLD,
  MAX_REFUND_SCORE,
} from './refundHandlingPolicy.js';

// Functions
export { evaluateRefundPolicy } from './refundHandlingPolicy.js';

// ==================== MONITORING POLICY ====================

// Functions
export {
  calculateBusinessImpact,
  calculateMonitoringAttributes,
  calculateMonitoringPriority,
} from './monitoringPolicy.js';

// ==================== UNIFIED POLICY ENGINE ====================

// Types
export type { PolicyEngineConfig, PolicyEngineContext } from './policyEngine.js';

// Constants
export { DEFAULT_POLICY_ENGINE_CONFIG } from './policyEngine.js';

// Functions
export { evaluatePolicies } from './policyEngine.js';
