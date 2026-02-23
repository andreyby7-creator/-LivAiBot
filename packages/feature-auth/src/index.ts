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

// Risk Assessment Types (централизованные типы из types/auth-risk.ts)
export type {
  ContextBuilderPlugin,
  ExternalRiskSignals,
  InternalRiskSignals,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from './types/auth-risk.js';

/* ============================================================================
 * 🛡️ DOMAIN — PURE DOMAIN LOGIC
 * ============================================================================
 *
 * Pure domain логика для risk assessment.
 * Детерминированные функции без side-effects.
 *
 * @note Domain логика для risk assessment перенесена в @livai/domains
 *       (validateClassificationSemantics, buildScoringContext, buildRuleContext, etc.)
 */

/* ============================================================================
 * ⚡ EFFECTS — PURE EFFECTS
 * ============================================================================
 *
 * Pure effects для аутентификации без side-effects.
 * Детерминированные функции для device fingerprint и risk assessment.
 */

// Device Fingerprint
export { DeviceFingerprint } from './effects/login/device-fingerprint.js';

// Risk Assessment: Rules, Scoring, Decision
// @note Правила, scoring и decision логика перенесена в @livai/domains
//       (evaluateRules, calculateRiskScore, determineRiskLevel, etc.)

// Risk Assessment: Adapter
export {
  buildAssessment,
  type RiskSignals as AdapterRiskSignals,
  type SignalsMapperPlugin,
} from './effects/login/login-risk-assessment.adapter.js';

// Risk Assessment: Composition Layer
export { assessLoginRisk, type AuditHook } from './effects/login/risk-assessment.js';

// Login Helpers: Validation
export { isValidLoginRequest } from './effects/login/validation.js';

// Login Helpers: Metadata Builders
export {
  buildLoginMetadata,
  createLoginMetadataEnricher,
  type IdentifierHasher,
  type LoginContext,
  type LoginMetadata,
  type MetadataBuilder,
  type MetadataConfig,
  type RiskMetadata,
} from './effects/login/login-metadata.enricher.js';

/* ============================================================================
 * 🛡️ SECURITY PIPELINE — RISK ASSESSMENT & SECURITY
 * ============================================================================
 *
 * Security pipeline для оценки рисков и принятия решений.
 *
 * @note Security pipeline перенесён в @livai/core/pipeline
 *       (executeSecurityPipeline, SecurityPipelineError, etc.)
 */

/* ============================================================================
 * 🏪 STORES — ZUSTAND STORES
 * ============================================================================
 *
 * Zustand stores для управления состоянием аутентификации.
 */

export * from './stores/auth.js';
