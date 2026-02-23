/**
 * @file packages/feature-auth/src/domain — Domain Types
 *
 * Публичный API пакета domain.
 * Экспортирует все публичные доменные типы для feature-auth.
 */

/* ============================================================================
 * 🔐 AUTH DOMAIN — ДОМЕННЫЕ ТИПЫ АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * Device Info: информация об устройстве.
 *
 * @public
 */
export { type DeviceInfo, type DeviceType } from './DeviceInfo.js';

/**
 * Login Request: запрос на вход в систему.
 *
 * @public
 */
export {
  type ClientContext as LoginClientContext,
  type LoginIdentifier,
  type LoginIdentifierType,
  type LoginRequest,
  type MfaInfo,
} from './LoginRequest.js';

/**
 * Logout Request: запрос на выход из системы.
 *
 * @public
 */
export { type ClientContext as LogoutClientContext, type LogoutRequest } from './LogoutRequest.js';

/**
 * Register Request: запрос на регистрацию.
 *
 * @public
 */
export {
  type ClientContext as RegisterClientContext,
  type MfaInfo as RegisterMfaInfo,
  type RegisterIdentifier,
  type RegisterIdentifierType,
  type RegisterRequest,
} from './RegisterRequest.js';

/**
 * Register Response: ответ на регистрацию.
 *
 * @public
 */
export { type RegisterResponse } from './RegisterResponse.js';

/**
 * Refresh Token Request: запрос на обновление токена.
 *
 * @public
 */
export {
  type ClientContext as RefreshTokenClientContext,
  type RefreshTokenRequest,
} from './RefreshTokenRequest.js';

/**
 * Token Pair: пара токенов (access и refresh).
 *
 * @public
 */
export { type TokenPair } from './TokenPair.js';

/**
 * Me Response: информация о текущем пользователе.
 *
 * @public
 */
export { type MeResponse, type MeSessionInfo, type MeUserInfo } from './MeResponse.js';

/* ============================================================================
 * 🔑 OAUTH — OAUTH АУТЕНТИФИКАЦИЯ
 * ========================================================================== */

/**
 * OAuth Login Request: запрос на вход через OAuth.
 *
 * @public
 */
export {
  type OAuthLoginRequest,
  type OAuthProvider as OAuthLoginProvider,
} from './OAuthLoginRequest.js';

/**
 * OAuth Register Request: запрос на регистрацию через OAuth.
 *
 * @public
 */
export {
  type OAuthProvider as OAuthRegisterProvider,
  type OAuthRegisterRequest,
} from './OAuthRegisterRequest.js';

/**
 * OAuth Error Response: ответ об ошибке OAuth.
 *
 * @public
 */
export {
  type OAuthErrorResponse,
  type OAuthErrorType,
  type OAuthProvider as OAuthErrorProvider,
} from './OAuthErrorResponse.js';

/* ============================================================================
 * 🔒 MFA — МНОГОФАКТОРНАЯ АУТЕНТИФИКАЦИЯ
 * ========================================================================== */

/**
 * MFA Challenge Request: запрос на прохождение MFA.
 *
 * @public
 */
export {
  type MfaChallengeRequest,
  type MfaType as MfaChallengeType,
} from './MfaChallengeRequest.js';

/**
 * MFA Setup Request: запрос на настройку MFA.
 *
 * @public
 */
export { type MfaSetupRequest, type MfaType as MfaSetupType } from './MfaSetupRequest.js';

/**
 * MFA Backup Code Request: запрос на использование backup кода MFA.
 *
 * @public
 */
export { type MfaBackupCodeRequest } from './MfaBackupCodeRequest.js';

/**
 * MFA Recovery Request: запрос на восстановление MFA.
 *
 * @public
 */
export {
  type MfaRecoveryMethod,
  type MfaRecoveryProof,
  type MfaRecoveryRequest,
} from './MfaRecoveryRequest.js';

/* ============================================================================
 * 🔑 PASSWORD RESET — СБРОС ПАРОЛЯ
 * ========================================================================== */

/**
 * Password Reset Request: запрос на сброс пароля.
 *
 * @public
 */
export {
  type ClientContext as PasswordResetClientContext,
  type PasswordResetIdentifier,
  type PasswordResetIdentifierType,
  type PasswordResetRequest,
} from './PasswordResetRequest.js';

/**
 * Password Reset Confirm: подтверждение сброса пароля.
 *
 * @public
 */
export {
  type ClientContext as PasswordResetConfirmClientContext,
  type PasswordResetConfirm,
} from './PasswordResetConfirm.js';

/* ============================================================================
 * ✅ VERIFICATION — ПОДТВЕРЖДЕНИЕ
 * ========================================================================== */

/**
 * Verify Email Request: запрос на подтверждение email.
 *
 * @public
 */
export {
  type ClientContext as VerifyEmailClientContext,
  type VerifyEmailRequest,
} from './VerifyEmailRequest.js';

/**
 * Verify Phone Request: запрос на подтверждение телефона.
 *
 * @public
 */
export {
  type ClientContext as VerifyPhoneClientContext,
  type VerifyPhoneRequest,
} from './VerifyPhoneRequest.js';

/* ============================================================================
 * 📧 EMAIL & SMS TEMPLATES — ШАБЛОНЫ СООБЩЕНИЙ
 * ========================================================================== */

/**
 * Email Template Request: запрос на отправку email шаблона.
 *
 * @public
 */
export { type AuthEmailTemplateType, type EmailTemplateRequest } from './EmailTemplateRequest.js';

/**
 * SMS Template Request: запрос на отправку SMS шаблона.
 *
 * @public
 */
export { type AuthSmsTemplateType, type SmsTemplateRequest } from './SmsTemplateRequest.js';

/* ============================================================================
 * 🔍 RISK ASSESSMENT — ОЦЕНКА РИСКОВ
 * ========================================================================== */

/**
 * Login Risk Assessment: оценка рисков при входе.
 *
 * @public
 */
export {
  type DeviceRiskInfo,
  type GeoInfo,
  type LoginRiskAssessment,
} from './LoginRiskAssessment.js';

/* ============================================================================
 * 📋 AUDIT & ERRORS — АУДИТ И ОШИБКИ
 * ========================================================================== */

/**
 * Auth Audit Event: событие аудита аутентификации.
 *
 * @public
 */
export {
  type AuditGeoInfo,
  type AuthAuditEvent,
  type AuthAuditEventType,
} from './AuthAuditEvent.js';

/**
 * Auth Error Response: ответ об ошибке аутентификации.
 *
 * @public
 */
export { type AuthErrorResponse, type AuthErrorType } from './AuthErrorResponse.js';

/* ============================================================================
 * 🔐 SESSION POLICY — ПОЛИТИКА СЕССИЙ
 * ========================================================================== */

/**
 * Session Policy: политика управления сессиями.
 *
 * @public
 */
export { type GeoPolicy, type IpPolicy, type SessionPolicy } from './SessionPolicy.js';

/**
 * Session Revoke Request: запрос на отзыв сессии.
 *
 * @public
 */
export { type SessionRevokeReason, type SessionRevokeRequest } from './SessionRevokeRequest.js';
