/**
 * @file packages/feature-auth/src/dto — DTO
 * Публичный API DTO feature-auth для API boundary.
 */

/* ============================================================================
 * 📋 AUTH DTO — КОНТРАКТЫ ЗАПРОСОВ ДЛЯ API BOUNDARY
 * ============================================================================
 */

/**
 * LoginRequest: DTO запроса входа в систему.
 * @public
 */
export {
  type LoginIdentifier,
  type LoginIdentifierType,
  type LoginRequest,
} from './LoginRequest.js';

/**
 * RegisterRequest: DTO запроса регистрации.
 * @public
 */
export {
  type RegisterIdentifier,
  type RegisterIdentifierType,
  type RegisterRequest,
} from './RegisterRequest.js';

/**
 * RegisterResponse: DTO ответа регистрации.
 * @public
 */
export { type RegisterResponse } from './RegisterResponse.js';

/**
 * LoginResult: domain-level результат login-flow.
 * @public
 */
export { assertNever, type DomainLoginResult } from './LoginResult.js';

/**
 * MeResponse: DTO ответа эндпоинта /me.
 * @public
 */
export { type MeResponse, type MeSessionInfo, type MeUserInfo } from './MeResponse.js';

/**
 * TokenPair: DTO пары токенов для авторизации.
 * @public
 */
export { type TokenPair } from './TokenPair.js';

/**
 * PasswordResetRequest: DTO запроса сброса пароля.
 * @public
 */
export {
  type PasswordResetIdentifier,
  type PasswordResetIdentifierType,
  type PasswordResetRequest,
} from './PasswordResetRequest.js';

/**
 * PasswordResetConfirm: DTO подтверждения сброса пароля.
 * @public
 */
export { type PasswordResetConfirm } from './PasswordResetConfirm.js';

/**
 * RefreshTokenRequest: DTO запроса обновления токена.
 * @public
 */
export { type RefreshTokenRequest } from './RefreshTokenRequest.js';

/**
 * LogoutRequest: DTO запроса выхода из системы.
 * @public
 */
export { type LogoutRequest } from './LogoutRequest.js';

/**
 * MfaSetupRequest: DTO запроса настройки MFA.
 * @public
 */
export { type MfaSetupRequest } from './MfaSetupRequest.js';

/**
 * MfaChallengeRequest: DTO запроса MFA challenge.
 * @public
 */
export { type MfaChallengeRequest } from './MfaChallengeRequest.js';

/**
 * MfaBackupCodeRequest: DTO запроса использования backup кода MFA.
 * @public
 */
export { type MfaBackupCodeRequest } from './MfaBackupCodeRequest.js';

/**
 * MfaRecoveryRequest: DTO запроса восстановления MFA.
 * @public
 */
export {
  type MfaRecoveryMethod,
  type MfaRecoveryProof,
  type MfaRecoveryRequest,
} from './MfaRecoveryRequest.js';

/**
 * OAuthLoginRequest: DTO запроса OAuth login.
 * @public
 */
export { type OAuthLoginRequest } from './OAuthLoginRequest.js';

/**
 * OAuthRegisterRequest: DTO запроса OAuth регистрации.
 * @public
 */
export { type OAuthRegisterRequest } from './OAuthRegisterRequest.js';

/**
 * VerifyEmailRequest: DTO запроса подтверждения email.
 * @public
 */
export { type VerifyEmailRequest } from './VerifyEmailRequest.js';

/**
 * VerifyPhoneRequest: DTO запроса подтверждения телефона.
 * @public
 */
export { type VerifyPhoneRequest } from './VerifyPhoneRequest.js';

/**
 * SessionRevokeRequest: DTO запроса на отзыв сессии.
 * @public
 */
export { type SessionRevokeReason, type SessionRevokeRequest } from './SessionRevokeRequest.js';

/**
 * EmailTemplateRequest: DTO запроса email шаблона.
 * @public
 */
export { type AuthEmailTemplateType, type EmailTemplateRequest } from './EmailTemplateRequest.js';

/**
 * SmsTemplateRequest: DTO запроса SMS шаблона.
 * @public
 */
export { type AuthSmsTemplateType, type SmsTemplateRequest } from './SmsTemplateRequest.js';
