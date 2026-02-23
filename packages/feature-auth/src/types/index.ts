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
  type AuthCommand,
  type AuthError,
  type AuthEvent,
  type AuthMeta,
  type AuthRequest,
  type AuthResponse,
  type AuthState,
  type AuthStatus,
  type ISODateString,
  type MfaOperation,
  type MfaState,
  type MfaStatus,
  type OAuthError,
  type OAuthOperation,
  type OAuthState,
  type OAuthStatus,
  type PasswordRecoveryState,
  type RecoveryOperation,
  type RecoveryStatus,
  type SecurityOperation,
  type SecurityState,
  type SecurityStatus,
  type SessionState,
  type SessionStatus,
  type VerificationState,
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
  type AuthRuleEvaluationContext,
  type AuthScoringContext,
  type BuildAssessmentContext,
  type ContextBuilderPlugin,
  type ExternalRiskSignals,
  type InternalRiskSignals,
  type IsoTimestamp,
  type ReadonlyDeep,
  type RiskAssessmentResult,
  type RiskContext,
  type RiskLevel,
  type RiskPolicy,
  type RiskSignals,
} from './auth-risk.js';
