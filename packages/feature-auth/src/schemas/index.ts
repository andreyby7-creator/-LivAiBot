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
  auditEventSchema,
  type AuditEventValues,
  authErrorResponseSchema,
  type AuthErrorResponseValues,
  deviceInfoSchema,
  type DeviceInfoValues,
  emailTemplateRequestSchema,
  type EmailTemplateRequestValues,
  loginRequestSchema,
  type LoginRequestValues,
  loginRiskAssessmentSchema,
  type LoginRiskAssessmentValues,
  loginSchema,
  loginTokenPairSchema,
  type LoginTokenPairValues,
  type LoginValues,
  logoutRequestSchema,
  type LogoutRequestValues,
  meResponseSchema,
  type MeResponseValues,
  mfaBackupCodeRequestSchema,
  type MfaBackupCodeRequestValues,
  mfaChallengeRequestSchema,
  type MfaChallengeRequestValues,
  mfaRecoveryRequestSchema,
  type MfaRecoveryRequestValues,
  mfaSetupRequestSchema,
  type MfaSetupRequestValues,
  oauthErrorResponseSchema,
  type OAuthErrorResponseValues,
  oauthLoginRequestSchema,
  type OAuthLoginRequestValues,
  oauthRegisterRequestSchema,
  type OAuthRegisterRequestValues,
  passwordResetConfirmSchema,
  type PasswordResetConfirmValues,
  passwordResetRequestSchema,
  type PasswordResetRequestValues,
  refreshTokenRequestSchema,
  type RefreshTokenRequestValues,
  registerRequestSchema,
  type RegisterRequestValues,
  registerResponseSchema,
  type RegisterResponseValues,
  registerSchema,
  type RegisterValues,
  sessionPolicySchema,
  type SessionPolicyValues,
  sessionRevokeRequestSchema,
  type SessionRevokeRequestValues,
  smsTemplateRequestSchema,
  type SmsTemplateRequestValues,
  tokenPairSchema,
  type TokenPairValues,
  verifyEmailRequestSchema,
  type VerifyEmailRequestValues,
  verifyPhoneRequestSchema,
  type VerifyPhoneRequestValues,
} from './schemas.js';
