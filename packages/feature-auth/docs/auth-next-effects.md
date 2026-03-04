# Дополнительные эффекты аутентификации

> Расширенные auth-эффекты для полного покрытия функциональности: password reset, verification, MFA, OAuth, session management, profile updates.

---

## Password Reset Flow

### Forgot Password

> Запрос на сброс пароля: пользователь указывает email/username, система отправляет токен для сброса пароля. Не требует аутентификации, best-effort (не блокирует UI при ошибках).

2️⃣5️⃣2️⃣ effects/forgot-password/forgot-password-effect.types.ts 🔴 — ts — deps: effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: ForgotPasswordEffectDeps, ForgotPasswordEffectConfig, validateForgotPasswordConfig)

2️⃣5️⃣3️⃣ effects/forgot-password/forgot-password-api.mapper.ts 🔴 — ts — deps: domain/ForgotPasswordRequest, schemas, effects/shared/auth-api.mappers; (mapper: ForgotPasswordRequest→payload, ForgotPasswordResponseDto→domain)

2️⃣5️⃣4️⃣ effects/forgot-password/forgot-password-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapForgotPasswordResultToAuditEvent→AuditEventValues, password_reset_requested/password_reset_failed)

2️⃣5️⃣5️⃣ effects/forgot-password.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/forgot-password/_; (forgot password orchestrator: validate→api→audit, best-effort)

### Reset Password

> Подтверждение сброса пароля: пользователь вводит новый пароль и токен из email/SMS. При успехе создаёт новую сессию (TokenPair + Me), fail-closed при невалидном токене.

2️⃣5️⃣6️⃣ effects/reset-password/reset-password-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: ResetPasswordEffectDeps, ResetPasswordEffectConfig, validateResetPasswordConfig)

2️⃣5️⃣7️⃣ effects/reset-password/reset-password-api.mapper.ts 🔴 — ts — deps: domain/ResetPasswordRequest, domain/TokenPair, schemas, effects/shared/auth-api.mappers; (mapper: ResetPasswordRequest→payload, ResetPasswordResponseDto→domain, использует shared mappers для TokenPair)

2️⃣5️⃣8️⃣ effects/reset-password/reset-password-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/session-state.builder, types/auth; (applyResetPasswordSuccess: обновление SessionState через session-state.builder при успешном reset)

2️⃣5️⃣9️⃣ effects/reset-password/reset-password-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapResetPasswordResultToAuditEvent→AuditEventValues, password_reset_success/password_reset_failed)

2️⃣6️⃣0️⃣ effects/reset-password.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/reset-password/_; (reset password orchestrator: validate→api→map→store→audit, fail-closed)

---

## Contact Verification

### Verify Email

> Подтверждение email: пользователь переходит по ссылке из письма или вводит код. Обновляет `emailVerified: true` в SessionState, не создаёт новую сессию.

2️⃣6️⃣1️⃣ effects/verify-email/verify-email-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: VerifyEmailEffectDeps, VerifyEmailEffectConfig, validateVerifyEmailConfig)

2️⃣6️⃣2️⃣ effects/verify-email/verify-email-api.mapper.ts 🔴 — ts — deps: domain/VerifyEmailRequest, schemas; (mapper: VerifyEmailRequest→payload, VerifyEmailResponseDto→domain)

2️⃣6️⃣3️⃣ effects/verify-email/verify-email-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applyVerifyEmailSuccess: обновление emailVerified в SessionState через batchUpdate)

2️⃣6️⃣4️⃣ effects/verify-email/verify-email-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapVerifyEmailResultToAuditEvent→AuditEventValues, email_verified/email_verification_failed)

2️⃣6️⃣5️⃣ effects/verify-email.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/verify-email/_; (verify email orchestrator: validate→api→store→audit)

### Verify Phone

> Подтверждение телефона: пользователь вводит SMS-код. Обновляет `phoneVerified: true` в SessionState, не создаёт новую сессию.

2️⃣6️⃣6️⃣ effects/verify-phone/verify-phone-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: VerifyPhoneEffectDeps, VerifyPhoneEffectConfig, validateVerifyPhoneConfig)

2️⃣6️⃣7️⃣ effects/verify-phone/verify-phone-api.mapper.ts 🔴 — ts — deps: domain/VerifyPhoneRequest, schemas; (mapper: VerifyPhoneRequest→payload, VerifyPhoneResponseDto→domain)

2️⃣6️⃣8️⃣ effects/verify-phone/verify-phone-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applyVerifyPhoneSuccess: обновление phoneVerified в SessionState через batchUpdate)

2️⃣6️⃣9️⃣ effects/verify-phone/verify-phone-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapVerifyPhoneResultToAuditEvent→AuditEventValues, phone_verified/phone_verification_failed)

2️⃣7️⃣0️⃣ effects/verify-phone.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/verify-phone/_; (verify phone orchestrator: validate→api→store→audit)

---

## Multi-Factor Authentication (MFA)

### MFA Challenge

> Проверка MFA-кода: пользователь вводит TOTP/SMS-код после логина с `mfa_required`. При успехе создаёт сессию (TokenPair + Me), fail-closed при неверном коде.

2️⃣7️⃣1️⃣ effects/mfa/mfa-challenge-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: MfaChallengeEffectDeps, MfaChallengeEffectConfig, validateMfaChallengeConfig)

2️⃣7️⃣2️⃣ effects/mfa/mfa-challenge-api.mapper.ts 🔴 — ts — deps: domain/MfaChallengeRequest, domain/TokenPair, schemas, effects/shared/auth-api.mappers; (mapper: MfaChallengeRequest→payload, MfaChallengeResponseDto→domain, использует shared mappers для TokenPair)

2️⃣7️⃣3️⃣ effects/mfa/mfa-challenge-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/session-state.builder, types/auth; (applyMfaChallengeSuccess: обновление SessionState через session-state.builder при успешном MFA)

2️⃣7️⃣4️⃣ effects/mfa/mfa-challenge-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapMfaChallengeResultToAuditEvent→AuditEventValues, mfa_success/mfa_failure)

2️⃣7️⃣5️⃣ effects/mfa-challenge.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/mfa/_; (MFA challenge orchestrator: validate→api→map→store→audit, fail-closed)

### MFA Setup

> Настройка MFA: пользователь активирует TOTP/SMS для аккаунта. Обновляет `mfaEnabled: true` в SessionState, возвращает QR-код/секрет для настройки приложения.

2️⃣7️⃣6️⃣ effects/mfa/mfa-setup-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: MfaSetupEffectDeps, MfaSetupEffectConfig, validateMfaSetupConfig)

2️⃣7️⃣7️⃣ effects/mfa/mfa-setup-api.mapper.ts 🔴 — ts — deps: domain/MfaSetupRequest, schemas; (mapper: MfaSetupRequest→payload, MfaSetupResponseDto→domain)

2️⃣7️⃣8️⃣ effects/mfa/mfa-setup-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applyMfaSetupSuccess: обновление mfaEnabled в SessionState через batchUpdate)

2️⃣7️⃣9️⃣ effects/mfa/mfa-setup-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapMfaSetupResultToAuditEvent→AuditEventValues, mfa_setup_success/mfa_setup_failed)

2️⃣8️⃣0️⃣ effects/mfa-setup.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/mfa/_; (MFA setup orchestrator: validate→api→store→audit)

### MFA Backup Code

> Использование резервного кода MFA: пользователь вводит одноразовый backup code вместо TOTP/SMS. При успехе создаёт сессию (TokenPair + Me), fail-closed при неверном коде.

2️⃣8️⃣1️⃣ effects/mfa/mfa-backup-code-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: MfaBackupCodeEffectDeps, MfaBackupCodeEffectConfig, validateMfaBackupCodeConfig)

2️⃣8️⃣2️⃣ effects/mfa/mfa-backup-code-api.mapper.ts 🔴 — ts — deps: domain/MfaBackupCodeRequest, domain/TokenPair, schemas, effects/shared/auth-api.mappers; (mapper: MfaBackupCodeRequest→payload, MfaBackupCodeResponseDto→domain, использует shared mappers для TokenPair)

2️⃣8️⃣3️⃣ effects/mfa/mfa-backup-code-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/session-state.builder, types/auth; (applyMfaBackupCodeSuccess: обновление SessionState через session-state.builder при успешном backup code)

2️⃣8️⃣4️⃣ effects/mfa/mfa-backup-code-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapMfaBackupCodeResultToAuditEvent→AuditEventValues, mfa_backup_code_success/mfa_backup_code_failed)

2️⃣8️⃣5️⃣ effects/mfa-backup-code.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/mfa/_; (MFA backup code orchestrator: validate→api→map→store→audit, fail-closed)

---

## OAuth Authentication

### OAuth Login

> Вход через OAuth провайдер (Google/Yandex/Facebook/VK): пользователь авторизуется через сторонний сервис, получает code, обменивает на токены. Использует security-pipeline, fail-closed при ошибке `/me`.

2️⃣8️⃣6️⃣ effects/oauth/oauth-login-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, lib/security-pipeline, types/auth, lib/error-mapper; (DI: OAuthLoginEffectDeps, OAuthLoginEffectConfig, validateOAuthLoginConfig)

2️⃣8️⃣7️⃣ effects/oauth/oauth-login-api.mapper.ts 🔴 — ts — deps: domain/OAuthLoginRequest, domain/TokenPair, domain/MeResponse, schemas, effects/shared/auth-api.mappers; (mapper: OAuthLoginRequest→payload, OAuthLoginResponseDto→domain, использует shared mappers)

2️⃣8️⃣8️⃣ effects/oauth/oauth-login-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/session-state.builder, lib/security-pipeline, types/auth; (applyOAuthLoginSuccess: обновление SessionState через session-state.builder, security-pipeline integration)

2️⃣8️⃣9️⃣ effects/oauth/oauth-login-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapOAuthLoginResultToAuditEvent→AuditEventValues, oauth_login_success/oauth_login_failure)

2️⃣9️⃣0️⃣ effects/oauth-login.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/oauth/_; (OAuth login orchestrator: validate→security→api(/oauth/login+/me)→map→store→audit, fail-closed)

### OAuth Register

> Регистрация через OAuth провайдер: новый пользователь создаёт аккаунт через сторонний сервис. Создаёт сессию (TokenPair + Me), fail-closed при ошибке `/me`.

2️⃣9️⃣1️⃣ effects/oauth/oauth-register-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: OAuthRegisterEffectDeps, OAuthRegisterEffectConfig, validateOAuthRegisterEffectConfig)

2️⃣9️⃣2️⃣ effects/oauth/oauth-register-api.mapper.ts 🔴 — ts — deps: domain/OAuthRegisterRequest, domain/TokenPair, domain/MeResponse, schemas, effects/shared/auth-api.mappers; (mapper: OAuthRegisterRequest→payload, OAuthRegisterResponseDto→domain, использует shared mappers)

2️⃣9️⃣3️⃣ effects/oauth/oauth-register-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/session-state.builder, types/auth; (applyOAuthRegisterSuccess: обновление SessionState через session-state.builder)

2️⃣9️⃣4️⃣ effects/oauth/oauth-register-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapOAuthRegisterResultToAuditEvent→AuditEventValues, oauth_register_success/oauth_register_failure)

2️⃣9️⃣5️⃣ effects/oauth-register.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/oauth/_; (OAuth register orchestrator: validate→api(/oauth/register+/me)→map→store→audit, fail-closed)

---

## Session Management

### Session Revoke

> Отзыв конкретной сессии: пользователь завершает одну из активных сессий (не текущую). Удаляет сессию из списка активных, не сбрасывает текущую сессию.

2️⃣9️⃣6️⃣ effects/session-revoke/session-revoke-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: SessionRevokeEffectDeps, SessionRevokeEffectConfig, validateSessionRevokeConfig)

2️⃣9️⃣7️⃣ effects/session-revoke/session-revoke-api.mapper.ts 🔴 — ts — deps: domain/SessionRevokeRequest, schemas; (mapper: SessionRevokeRequest→payload, SessionRevokeResponseDto→domain)

2️⃣9️⃣8️⃣ effects/session-revoke/session-revoke-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applySessionRevokeSuccess: удаление сессии из списка активных сессий через batchUpdate)

2️⃣9️⃣9️⃣ effects/session-revoke/session-revoke-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapSessionRevokeResultToAuditEvent→AuditEventValues, session_revoked/session_revoke_failed)

3️⃣0️⃣0️⃣ effects/session-revoke.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/session-revoke/_; (session revoke orchestrator: validate→api→store→audit)

### Logout All Sessions

> Выход из всех сессий: пользователь завершает все активные сессии одновременно. Сначала отзывает все сессии через session-revoke, затем выполняет logout текущей сессии.

3️⃣0️⃣1️⃣ effects/logout-all-sessions.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, effects/logout/logout-store-updater, effects/session-revoke/_; (logout all sessions orchestrator: revoke все активные сессии через session-revoke, затем logout текущей сессии)

---

## Profile & Security Updates

### Change Password

> Смена пароля для аутентифицированного пользователя: пользователь вводит старый и новый пароль. Не обновляет store напрямую (сессия остаётся активной), только audit logging.

3️⃣0️⃣2️⃣ effects/change-password/change-password-effect.types.ts 🔴 — ts — deps: effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: ChangePasswordEffectDeps, ChangePasswordEffectConfig, validateChangePasswordConfig)

3️⃣0️⃣3️⃣ effects/change-password/change-password-api.mapper.ts 🔴 — ts — deps: domain/ChangePasswordRequest, schemas; (mapper: ChangePasswordRequest→payload, ChangePasswordResponseDto→domain)

3️⃣0️⃣4️⃣ effects/change-password/change-password-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapChangePasswordResultToAuditEvent→AuditEventValues, password_changed/password_change_failed)

3️⃣0️⃣5️⃣ effects/change-password.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/change-password/_; (change password orchestrator: validate→api→audit, не обновляет store напрямую)

### Update Profile

> Обновление профиля пользователя: пользователь меняет имя, аватар, настройки. Обновляет профиль в SessionState через `/me`, fail-closed при ошибке API.

3️⃣0️⃣6️⃣ effects/update-profile/update-profile-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: UpdateProfileEffectDeps, UpdateProfileEffectConfig, validateUpdateProfileConfig)

3️⃣0️⃣7️⃣ effects/update-profile/update-profile-api.mapper.ts 🔴 — ts — deps: domain/UpdateProfileRequest, domain/MeResponse, schemas, effects/shared/auth-api.mappers; (mapper: UpdateProfileRequest→payload, UpdateProfileResponseDto→domain, использует shared mappers для MeResponse)

3️⃣0️⃣8️⃣ effects/update-profile/update-profile-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applyUpdateProfileSuccess: обновление профиля в SessionState через batchUpdate)

3️⃣0️⃣9️⃣ effects/update-profile/update-profile-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapUpdateProfileResultToAuditEvent→AuditEventValues, profile_updated/profile_update_failed)

3️⃣1️⃣0️⃣ effects/update-profile.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/update-profile/_; (update profile orchestrator: validate→api(/me)→map→store→audit, fail-closed)

---

## Audit & Telemetry

### Audit Logging

> Централизованное логирование auth-событий: все эффекты используют единый audit logger для событий успеха/ошибок. Best-effort: ошибки логирования не ломают основной flow, фиксируются через telemetry.

3️⃣1️⃣1️⃣ lib/audit-logger.ts 🔴 — ts — deps: schemas, types/auth; (централизованный audit logger: logAuthEvent, валидация через auditEventSchema, sync/async поддержка)

3️⃣1️⃣2️⃣ lib/audit-logger-adapter.ts 🔴 — ts — deps: lib/audit-logger, @livai/app/lib/telemetry; (адаптер audit logger для интеграции с telemetry: recordAuditFailure, best-effort error handling)

### Telemetry

> Observability для auth-слоя: фиксация ошибок audit/errorMapper, метрики производительности эффектов, интеграция с внешними системами мониторинга.

3️⃣1️⃣3️⃣ lib/auth-telemetry.ts 🔴 — ts — deps: @livai/app/lib/telemetry, types/auth; (telemetry для auth: recordAuditFailure, recordErrorMapperFailure, recordEffectDuration, метрики concurrency)

---

## Session Policy & Proactive Refresh

### Session Policy Check

> Проверка лимитов сессий и политик: валидация concurrent sessions, проверка TTL, географические ограничения. Используется session-manager для принятия решений.

3️⃣1️⃣4️⃣ effects/session-policy-check/session-policy-check-effect.types.ts 🔴 — ts — deps: lib/session-manager, types/auth, @livai/core/policies/AuthPolicy; (DI: SessionPolicyCheckEffectDeps, SessionPolicyCheckEffectConfig, validateSessionPolicyCheckConfig)

3️⃣1️⃣5️⃣ effects/session-policy-check/session-policy-check-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applySessionPolicyViolation: блокировка сессии при нарушении политики через batchUpdate)

3️⃣1️⃣6️⃣ effects/session-policy-check.ts 🔴 — ts+effect — deps: @livai/app (orchestrator), lib/session-manager, types/auth, effects/session-policy-check/_; (session policy check orchestrator: проверка через session-manager, применение решений через store-updater)

### Proactive Refresh

> Автоматический refresh токенов: проверка через session-manager.shouldRefresh(), выполнение refresh до истечения токена. Интегрируется с refresh effect, не требует действий пользователя.

3️⃣1️⃣7️⃣ effects/proactive-refresh/proactive-refresh-effect.types.ts 🔴 — ts — deps: lib/session-manager, effects/refresh/refresh-effect.types, types/auth; (DI: ProactiveRefreshEffectDeps, ProactiveRefreshEffectConfig, validateProactiveRefreshConfig)

3️⃣1️⃣8️⃣ effects/proactive-refresh.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, effect-timeout), lib/session-manager, effects/refresh, types/auth; (proactive refresh orchestrator: периодическая проверка shouldRefresh, вызов refresh effect при необходимости)

---

## Account Security

### Account Lock

> Блокировка аккаунта при подозрении на взлом: система блокирует аккаунт при множественных неудачных попытках входа, подозрительной активности. Требует административного разблокирования или подтверждения через email/SMS.

3️⃣1️⃣9️⃣ effects/account-lock/account-lock-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: AccountLockEffectDeps, AccountLockEffectConfig, validateAccountLockConfig)

3️⃣2️⃣0️⃣ effects/account-lock/account-lock-api.mapper.ts 🔴 — ts — deps: domain/AccountLockRequest, schemas; (mapper: AccountLockRequest→payload, AccountLockResponseDto→domain)

3️⃣2️⃣1️⃣ effects/account-lock/account-lock-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applyAccountLock: обновление accountLocked в AuthState через batchUpdate, инвалидация всех сессий)

3️⃣2️⃣2️⃣ effects/account-lock/account-lock-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapAccountLockResultToAuditEvent→AuditEventValues, account_locked/account_lock_failed)

3️⃣2️⃣3️⃣ effects/account-lock.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/account-lock/_; (account lock orchestrator: validate→api→store→audit, fail-closed)

### Account Unblock

> Разблокировка аккаунта: администратор или пользователь (через email/SMS подтверждение) разблокирует аккаунт. Снимает блокировку, но не восстанавливает сессии (требуется повторный вход).

3️⃣2️⃣4️⃣ effects/account-unblock/account-unblock-effect.types.ts 🔴 — ts — deps: effects/shared/auth-store.port, effects/shared/api-client.port, types/auth, lib/error-mapper; (DI: AccountUnblockEffectDeps, AccountUnblockEffectConfig, validateAccountUnblockConfig)

3️⃣2️⃣5️⃣ effects/account-unblock/account-unblock-api.mapper.ts 🔴 — ts — deps: domain/AccountUnblockRequest, schemas; (mapper: AccountUnblockRequest→payload, AccountUnblockResponseDto→domain)

3️⃣2️⃣6️⃣ effects/account-unblock/account-unblock-store-updater.ts 🔴 — ts — deps: effects/shared/auth-store.port, types/auth; (applyAccountUnblock: обновление accountLocked: false в AuthState через batchUpdate)

3️⃣2️⃣7️⃣ effects/account-unblock/account-unblock-audit.mapper.ts 🔴 — ts — deps: schemas, types/auth; (mapAccountUnblockResultToAuditEvent→AuditEventValues, account_unblocked/account_unblock_failed)

3️⃣2️⃣8️⃣ effects/account-unblock.ts 🔴 — ts+effect — deps: @livai/app (orchestrator, schema-validated-effect, effect-timeout), types/auth, schemas, effects/account-unblock/_; (account unblock orchestrator: validate→api→store→audit, fail-closed)

---

## Общие принципы

Все эффекты следуют единым архитектурным паттернам:

- ✅ **DI через порты:** все зависимости через типизированные порты (`*-effect.types.ts`)
- ✅ **Валидация конфигурации:** `validate*Config` на этапе композиции
- ✅ **Pure мэпперы:** `*-api.mapper.ts` используют shared‑мэпперы, возвращают frozen объекты
- ✅ **Store‑only‑updates:** все изменения через `*-store-updater.ts` с `batchUpdate`
- ✅ **Fail‑closed:** частично успешные ответы не применяются
- ✅ **Audit logging:** best‑effort через `*-audit.mapper.ts` с Zod валидацией
- ✅ **Orchestrator pattern:** `validate→api→map→store→audit` через `@livai/app` utilities

## 🧩 Refactor TODO (общие для всех auth-эффектов)

**Анализ общих портов после реализации всех `*-effect.types.ts`**

- После появления всех `*-effect.types.ts` (login/logout/register/refresh и новые эффекты):
  - Собрать список общих портов (например, `ErrorMapperPort`, `ClockPort`, `AbortControllerPort` и др.).
  - Зафиксировать, какие из них повторяются 1:1 минимум в 2–3 эффектах.
- Если повторение стабильное:
  - Вынести такие порты в общий модуль (`effects/shared/effect-ports.ts` или capability-файлы).
  - Обновить `*-effect.types.ts` для использования общих типов.
    Все новые эффекты и хук должны ссылаться на эти модули вместо дублирования логики.

1. **Общий helper для времени**
   - Вынести повторяющийся helper `epochMsToIsoString(epochMs: number): string` из всех оркестраторов, которые формируют ISO‑timestamp через `new Date(...)`.
   - Создать `effects/shared/time.utils.ts` (например, `toIsoFromMs`).
   - Обновить login/register/logout/refresh и будущие эффекты на общий util.

2. **Общий лимит очереди для serialize-стратегии**
   - Вынести `MAX_SERIALIZE_QUEUE_LENGTH = 10` в общий модуль, например `effects/shared/effect-concurrency.ts` (`DEFAULT_SERIALIZE_QUEUE_LIMIT`).
   - Заменить локальные константы во всех эффектах, использующих стратегию `concurrency: 'serialize'`.
   - Убедиться, что все такие эффекты используют единый лимит.
