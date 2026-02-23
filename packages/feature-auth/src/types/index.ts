/**
 * @file packages/feature-auth/src/types — Type Definitions
 *
 * Публичный API пакета types.
 * Экспортирует все публичные типы для feature-auth.
 */

/* ============================================================================
 * 🔐 AUTH TYPES — ТИПЫ АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * Auth Types: типы для аутентификации.
 * Включает AuthState, MfaState, OAuthState, SecurityState, SessionState и все связанные типы.
 *
 * @public
 */
export {
  type ISODateString,
  type AuthMeta,
  type AuthError,
  type AuthStatus,
  type AuthState,
  type MfaStatus,
  type MfaState,
  type MfaOperation,
  type OAuthStatus,
  type OAuthState,
  type OAuthOperation,
  type OAuthError,
  type SecurityStatus,
  type SecurityState,
  type SessionStatus,
  type SessionState,
  type SecurityOperation,
  type RecoveryStatus,
  type PasswordRecoveryState,
  type VerificationState,
  type RecoveryOperation,
  type AuthRequest,
  type AuthResponse,
  type AuthCommand,
  type AuthEvent,
} from './auth.js';

/* ============================================================================
 * 🎯 AUTH RISK TYPES — ТИПЫ ОЦЕНКИ РИСКОВ
 * ========================================================================== */

/**
 * Auth Risk Types: типы для оценки рисков аутентификации.
 * Включает RiskContext, RiskPolicy, RiskAssessmentResult и все связанные типы.
 *
 * @public
 */
export {
  type RiskLevel,
  type ReadonlyDeep,
  type InternalRiskSignals,
  type ExternalRiskSignals,
  type RiskSignals,
  type IsoTimestamp,
  type RiskContext,
  type RiskPolicy,
  type RiskAssessmentResult,
  type BuildAssessmentContext,
  type ContextBuilderPlugin,
  type AuthRuleEvaluationContext,
  type AuthScoringContext,
} from './auth-risk.js';
