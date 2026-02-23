/**
 * @file packages/feature-auth/src/schemas — Validation Schemas
 *
 * Публичный API пакета schemas.
 * Экспортирует все публичные схемы валидации для feature-auth.
 */

/* ============================================================================
 * ✅ VALIDATION SCHEMAS — СХЕМЫ ВАЛИДАЦИИ
 * ========================================================================== */

/**
 * Validation Schemas: схемы валидации для всех запросов и ответов аутентификации.
 * Включает схемы для login, register, token, MFA, password reset, verification, OAuth и все связанные типы.
 *
 * @public
 */
export {
  loginSchema,
  registerSchema,
  auditEventSchema,
  loginRequestSchema,
  registerRequestSchema,
  registerResponseSchema,
  tokenPairSchema,
  refreshTokenRequestSchema,
  logoutRequestSchema,
  sessionRevokeRequestSchema,
  meResponseSchema,
  mfaChallengeRequestSchema,
  mfaSetupRequestSchema,
  mfaBackupCodeRequestSchema,
  mfaRecoveryRequestSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  verifyEmailRequestSchema,
  verifyPhoneRequestSchema,
  oauthLoginRequestSchema,
  oauthRegisterRequestSchema,
  oauthErrorResponseSchema,
  authErrorResponseSchema,
  loginRiskAssessmentSchema,
  sessionPolicySchema,
  emailTemplateRequestSchema,
  smsTemplateRequestSchema,
  deviceInfoSchema,
  type LoginValues,
  type RegisterValues,
  type AuditEventValues,
  type LoginRequestValues,
  type RegisterRequestValues,
  type RegisterResponseValues,
  type TokenPairValues,
  type RefreshTokenRequestValues,
  type LogoutRequestValues,
  type SessionRevokeRequestValues,
  type MeResponseValues,
  type MfaChallengeRequestValues,
  type MfaSetupRequestValues,
  type MfaBackupCodeRequestValues,
  type MfaRecoveryRequestValues,
  type PasswordResetRequestValues,
  type PasswordResetConfirmValues,
  type VerifyEmailRequestValues,
  type VerifyPhoneRequestValues,
  type OAuthLoginRequestValues,
  type OAuthRegisterRequestValues,
  type OAuthErrorResponseValues,
  type AuthErrorResponseValues,
  type LoginRiskAssessmentValues,
  type SessionPolicyValues,
  type EmailTemplateRequestValues,
  type SmsTemplateRequestValues,
  type DeviceInfoValues,
} from '../schemas.js';
