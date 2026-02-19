/**
 * @file @livai/feature-auth — бизнес-логика аутентификации (UI-агностичная).
 *
 * Публичный API пакета @livai/feature-auth.
 * Экспортирует все DTO типы, Zod схемы и утилиты для аутентификации.
 *
 * Архитектурная роль:
 * - Типизированные контракты для auth операций
 * - Runtime валидация через Zod схемы
 * - Type-safe inference для TypeScript
 * - Согласованность с backend контрактами
 */

/* ============================================================================
 * 🧬 TYPES — DTO ТИПЫ
 * ============================================================================
 *
 * Domain Transfer Objects — типизированные контракты для auth операций.
 * Все DTO синхронизированы с Zod схемами в schemas.ts.
 *
 * Примечание: Общие типы (ClientContext, MfaType, OAuthProvider) экспортируются
 * только из LoginRequest/OAuthLoginRequest для избежания конфликтов имен.
 */

// Основные DTO с общими типами (ClientContext, MfaInfo, MfaType экспортируются только из LoginRequest)
export * from './domain/LoginRequest.js';
export {
  type RegisterIdentifier,
  type RegisterIdentifierType,
  type RegisterRequest,
} from './domain/RegisterRequest.js';
export * from './domain/OAuthLoginRequest.js';

// Остальные DTO (явные экспорты для избежания конфликтов)
export {
  type AuditGeoInfo,
  type AuthAuditEvent,
  type AuthAuditEventType,
} from './domain/AuthAuditEvent.js';

export { type AuthErrorResponse, type AuthErrorType } from './domain/AuthErrorResponse.js';

export { type DeviceInfo, type DeviceType } from './domain/DeviceInfo.js';

export {
  type AuthEmailTemplateType,
  type EmailTemplateRequest,
} from './domain/EmailTemplateRequest.js';

export * from './domain/LoginRiskAssessment.js';

export { type LogoutRequest } from './domain/LogoutRequest.js';

export { type MeResponse, type MeSessionInfo, type MeUserInfo } from './domain/MeResponse.js';

export { type MfaBackupCodeRequest } from './domain/MfaBackupCodeRequest.js';

export { type MfaChallengeRequest } from './domain/MfaChallengeRequest.js';

export {
  type MfaRecoveryMethod,
  type MfaRecoveryProof,
  type MfaRecoveryRequest,
} from './domain/MfaRecoveryRequest.js';

export { type MfaSetupRequest } from './domain/MfaSetupRequest.js';

export { type OAuthErrorResponse, type OAuthErrorType } from './domain/OAuthErrorResponse.js';

export { type OAuthRegisterRequest } from './domain/OAuthRegisterRequest.js';

export { type PasswordResetConfirm } from './domain/PasswordResetConfirm.js';

export {
  type PasswordResetIdentifier,
  type PasswordResetIdentifierType,
  type PasswordResetRequest,
} from './domain/PasswordResetRequest.js';

export { type RefreshTokenRequest } from './domain/RefreshTokenRequest.js';

export { type RegisterResponse } from './domain/RegisterResponse.js';

export { type GeoPolicy, type IpPolicy, type SessionPolicy } from './domain/SessionPolicy.js';

export {
  type SessionRevokeReason,
  type SessionRevokeRequest,
} from './domain/SessionRevokeRequest.js';

export { type AuthSmsTemplateType, type SmsTemplateRequest } from './domain/SmsTemplateRequest.js';

export { type TokenPair } from './domain/TokenPair.js';

export { type VerifyEmailRequest } from './domain/VerifyEmailRequest.js';

export { type VerifyPhoneRequest } from './domain/VerifyPhoneRequest.js';

/* ============================================================================
 * 🔐 SCHEMAS — ZOD СХЕМЫ
 * ============================================================================
 *
 * Zod схемы для runtime валидации и type-safe inference.
 * Все схемы работают в strict режиме для предотвращения extra полей.
 */

export * from './schemas.js';

/* ============================================================================
 * 🧩 TYPES — АГРЕГИРУЮЩИЕ ТИПЫ
 * ============================================================================
 *
 * Агрегирующие типы для состояния и статусов аутентификации.
 * Используются в stores, hooks, effects и компонентах.
 */

export * from './types/auth.js';

// Risk Assessment Types (централизованные типы из types/risk.ts)
export type {
  ContextBuilderPlugin,
  ExternalRiskSignals,
  InternalRiskSignals,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from './types/risk.js';

/* ============================================================================
 * 🛡️ DOMAIN — PURE DOMAIN LOGIC
 * ============================================================================
 *
 * Pure domain логика для risk assessment.
 * Детерминированные функции без side-effects.
 */

// Domain: Risk Validation
export { type RiskSemanticViolation, validateRiskSemantics } from './domain/RiskValidation.js';

// Domain: Context Builders
export {
  buildAssessmentContext,
  buildRuleContext,
  buildScoringContext,
} from './domain/ContextBuilders.js';

// Domain: Plugin Appliers
export {
  applyAssessmentPlugins,
  applyRulePlugins,
  applyScoringPlugins,
} from './domain/PluginAppliers.js';

// Domain: Local Rules Engine
export { evaluateLocalRules } from './domain/LocalRulesEngine.js';

/* ============================================================================
 * 🔒 SECURITY — SECURITY UTILITIES
 * ============================================================================
 *
 * Security utilities для защиты от атак и sanitization данных.
 */

// Security: Sanitizer
export { sanitizeExternalSignals } from './lib/sanitizer.js';

/* ============================================================================
 * ⚡ EFFECTS — PURE EFFECTS
 * ============================================================================
 *
 * Pure effects для аутентификации без side-effects.
 * Детерминированные функции для device fingerprint и risk assessment.
 */

// Device Fingerprint
export { DeviceFingerprint } from './effects/login/device-fingerprint.js';

// Risk Assessment: Rules
export {
  AllRules,
  allRules,
  compositeRules,
  deviceRules,
  evaluateRuleActions,
  evaluateRules,
  type ExtendedRuleDefinition,
  geoRules,
  getMaxPriority,
  getRuleDefinition,
  getRulesWithDecisionImpact,
  networkRules,
  type RiskRule,
  type RiskRuleConfig,
  type RuleAction,
  type RuleContextMetadata,
  type RuleDefinition,
  type RuleEvaluationContext,
  type RuleEvaluator,
  type RuleIdentifier,
  type RuleMetadata,
  type RuleSignals,
  sortRulesByPriority,
} from './effects/login/risk-rules.js';

// Risk Assessment: Scoring
export {
  calculateRiskScore,
  calculateRiskScoreFromJson,
  calculateRiskScoreWithAsyncFactors,
  calculateRiskScoreWithAsyncFactorsAndCache,
  calculateRiskScoreWithCache,
  calculateRiskScoreWithFactors,
  clearAsyncScoreCache,
  clearScoreCache,
  createFactorConfigFromJson,
  createFactorConfigsFromJson,
  DefaultRiskWeights,
  defaultRiskWeights,
  factorCalculatorRegistryExport,
  type FactorConfigJson,
  getAsyncScoreCacheSize,
  getCustomFactorPlugin,
  getScoreCacheSize,
  isAsyncFactor,
  isSyncFactor,
  registerCustomFactorPlugin,
  type RiskWeights,
  type ScoringContext,
  scoringFactorConfigs,
  type ScoringSignals,
} from './effects/login/risk-scoring.js';

// Risk Assessment: Decision
export {
  type BlockReason,
  type DecisionPolicy,
  type DecisionResult,
  type DecisionSignals,
  DefaultDecisionPolicy,
  defaultDecisionPolicy,
  DefaultRiskThresholds,
  defaultRiskThresholds,
  determineDecisionHint,
  determineRiskLevel,
  type RiskThresholds,
} from './effects/login/risk-decision.js';

// Risk Assessment: Adapter
export {
  buildAssessment,
  type RiskSignals as AdapterRiskSignals,
  type SignalsMapperPlugin,
} from './effects/login/risk-assessment.adapter.js';

// Risk Assessment: Composition Layer
export { assessLoginRisk, type AuditHook } from './effects/login/risk-assessment.js';

// Login Helpers: Validation
export { isValidLoginRequest } from './effects/login/validation.js';

// Login Helpers: Metadata Builders
export {
  buildLoginMetadata,
  type IdentifierHasher,
  type LoginContext,
  type LoginMetadata,
  type MetadataBuilder,
  type MetadataConfig,
  type RiskMetadata,
} from './effects/login/metadata-builders.js';

/* ============================================================================
 * 🛡️ SECURITY PIPELINE — RISK ASSESSMENT & SECURITY
 * ============================================================================
 *
 * Security pipeline для оценки рисков и принятия решений.
 * Включает local rules engine, performance limits и security pipeline facade.
 */

// Security Pipeline: Risk Sources
export {
  assessLocalRisk,
  type AuditHook as LocalRulesAuditHook,
  type LocalRiskResult,
  type LocalRulesSourceConfig,
  PerformanceLimits,
} from './lib/security-pipeline/risk-sources/local-rules.source.js';

export {
  DEFAULT_PERFORMANCE_LIMITS,
  defaultPerformanceLimits,
  getPerformanceLimits,
  type PerformanceLimitsConfig,
  resetPerformanceLimits,
  setPerformanceLimits,
  validatePerformanceLimits,
} from './lib/security-pipeline/risk-sources/performance-limits.js';

// Security Pipeline: Core
export type { SecurityPipelineError } from './lib/security-pipeline/core/security-pipeline.errors.js';

// Security Pipeline: Public API
export {
  executeSecurityPipeline,
  type SecurityOperation,
  type SecurityPipelineConfig,
  type SecurityPipelineResult,
  type SecurityPipelineStep,
  SecurityPipelineVersion,
} from './lib/security-pipeline/security-pipeline.js';

// Security Pipeline: Facade
export { executeSecurityPipeline as executeSecurityPipelineFacade } from './lib/security-pipeline/security-pipeline.facade.js';

/* ============================================================================
 * 🏪 STORES — ZUSTAND STORES
 * ============================================================================
 *
 * Zustand stores для управления состоянием аутентификации.
 */

export * from './stores/auth.js';
