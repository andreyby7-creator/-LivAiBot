/**
 * @file packages/feature-auth/src/types/auth.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Агрегирующие типы аутентификации
 * ============================================================================
 * Архитектурная роль:
 * - Агрегирующие типы для состояния и статусов аутентификации
 * - Объединяет DTO из domain/ в единую систему типов для UI/store/effects
 * - Используется в stores, hooks, effects и компонентах
 * - Микросервисно-нейтральный, vendor-agnostic
 * - Future-proof и extensible
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ UI & Store friendly
 * - ✅ Type-safe и дискриминирующие union типы
 *
 * @example
 * // AuthState для store (токены не хранятся в store, только в httpOnly cookies или secure memory)
 * const authState: AuthState = {
 *   status: 'authenticated',
 *   user: { id: 'user-123', email: 'user@example.com' },
 *   session: { sessionId: 'sess-abc', expiresAt: '2026-01-01T00:00:00Z', status: 'active' }
 * };
 * // MFA State
 * const mfaState: MfaState = {
 *   status: 'challenged',
 *   method: 'totp',
 *   challengeId: 'challenge-123',
 *   expiresAt: '2026-01-01T01:00:00Z'
 * };
 */

/* ============================================================================
 * 📦 IMPORTS
 * ============================================================================
 */

import type { RiskLevel } from '@livai/domains/policies';

import type { AuthAuditEvent } from '../domain/AuthAuditEvent.js';
import type { AuthErrorResponse } from '../domain/AuthErrorResponse.js';
import type { DeviceInfo } from '../domain/DeviceInfo.js';
import type { EmailTemplateRequest } from '../domain/EmailTemplateRequest.js';
import type { LoginIdentifierType, LoginRequest } from '../domain/LoginRequest.js';
import type { LoginRiskEvaluation, LoginRiskResult } from '../domain/LoginRiskAssessment.js';
import type { LogoutRequest } from '../domain/LogoutRequest.js';
import type { MeResponse, MeSessionInfo, MeUserInfo } from '../domain/MeResponse.js';
import type { MfaBackupCodeRequest } from '../domain/MfaBackupCodeRequest.js';
import type { MfaChallengeRequest, MfaType } from '../domain/MfaChallengeRequest.js';
import type { MfaRecoveryMethod, MfaRecoveryRequest } from '../domain/MfaRecoveryRequest.js';
import type { MfaSetupRequest } from '../domain/MfaSetupRequest.js';
import type { OAuthErrorResponse, OAuthProvider } from '../domain/OAuthErrorResponse.js';
import type { OAuthLoginRequest } from '../domain/OAuthLoginRequest.js';
import type { OAuthRegisterRequest } from '../domain/OAuthRegisterRequest.js';
import type { PasswordResetConfirm } from '../domain/PasswordResetConfirm.js';
import type {
  PasswordResetIdentifierType,
  PasswordResetRequest,
} from '../domain/PasswordResetRequest.js';
import type { RefreshTokenRequest } from '../domain/RefreshTokenRequest.js';
import type { RegisterRequest } from '../domain/RegisterRequest.js';
import type { RegisterResponse } from '../domain/RegisterResponse.js';
import type { SessionPolicy } from '../domain/SessionPolicy.js';
import type { SessionRevokeReason, SessionRevokeRequest } from '../domain/SessionRevokeRequest.js';
import type { SmsTemplateRequest } from '../domain/SmsTemplateRequest.js';
import type { TokenPair } from '../domain/TokenPair.js';
import type { VerifyEmailRequest } from '../domain/VerifyEmailRequest.js';
import type { VerifyPhoneRequest } from '../domain/VerifyPhoneRequest.js';

/* ============================================================================
 * 🕐 TEMPORAL TYPES
 * ============================================================================
 */

/** ISO 8601 строка даты и времени */
export type ISODateString = string;

/* ============================================================================
 * 📋 METADATA TYPES
 * ============================================================================
 */

/** Типизированные метаданные для состояния аутентификации */
export type AuthMeta =
  | { readonly type: 'redirect'; returnTo: string; }
  | { readonly type: 'experiment'; flag: string; value?: string | number | boolean; }
  | { readonly type: 'telemetry'; traceId: string; spanId?: string; }
  | { readonly type: 'analytics'; event: string; properties?: Record<string, unknown>; }
  | { readonly type: 'feature_flag'; name: string; enabled: boolean; }
  | { readonly type: 'custom'; key: string; value: unknown; };

/* ============================================================================
 * ⚠️ AUTH ERROR (Normalized)
 * ============================================================================
 */

/** Нормализованный тип ошибки аутентификации для UI/Store */
export type AuthError =
  | {
    readonly kind: 'network';
    readonly retryable: true;
    readonly message?: string;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'invalid_credentials';
    readonly message?: string;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'account_locked';
    readonly message?: string;
    readonly lockedUntil?: ISODateString;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'account_disabled';
    readonly message?: string;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'email_not_verified';
    readonly message?: string;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'phone_not_verified';
    readonly message?: string;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'mfa_required';
    readonly message?: string;
    readonly availableMethods?: readonly MfaType[];
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'mfa_failed';
    readonly message?: string;
    readonly remainingAttempts?: number;
    readonly raw?: AuthErrorResponse;
  }
  | { readonly kind: 'token_expired'; readonly message?: string; readonly raw?: AuthErrorResponse; }
  | { readonly kind: 'token_invalid'; readonly message?: string; readonly raw?: AuthErrorResponse; }
  | {
    readonly kind: 'session_expired';
    readonly message?: string;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'session_revoked';
    readonly message?: string;
    readonly reason?: SessionRevokeReason;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'rate_limited';
    readonly message?: string;
    readonly retryAfter?: ISODateString;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'permission_denied';
    readonly message?: string;
    readonly requiredPermissions?: readonly string[];
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'risk_blocked';
    readonly message?: string;
    readonly riskScore?: number;
    readonly raw?: AuthErrorResponse;
  }
  | {
    readonly kind: 'oauth_error';
    readonly provider?: OAuthProvider;
    readonly message?: string;
    readonly raw?: OAuthErrorResponse;
  }
  | {
    readonly kind: 'unknown';
    readonly message?: string;
    readonly raw: AuthErrorResponse | OAuthErrorResponse;
  };

/* ============================================================================
 * 🔐 AUTH STATE & STATUS
 * ============================================================================
 */

/** Статус аутентификации пользователя (декларативный, без деталей) */
export type AuthStatus =
  | 'unauthenticated' // Пользователь не аутентифицирован
  | 'authenticating' // Процесс аутентификации (login/register/oauth в процессе)
  | 'authenticated' // Пользователь успешно аутентифицирован
  | 'pending_secondary_verification' // Требуется вторичная верификация (MFA/email/phone) - детали в MfaState/VerificationState
  | 'session_expired' // Сессия истекла, требуется refresh
  | 'error'; // Ошибка аутентификации

/** Состояние аутентификации пользователя (декларативное, детали в специализированных состояниях) */
export type AuthState =
  | {
    /** Статус: не аутентифицирован */
    readonly status: 'unauthenticated';
    /** Опциональная информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные состояния */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: процесс аутентификации */
    readonly status: 'authenticating';
    /** Тип операции (login/register/oauth/refresh) */
    readonly operation?: 'login' | 'register' | 'oauth' | 'refresh';
    /** Типизированные метаданные операции */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: аутентифицирован */
    readonly status: 'authenticated';
    /** Информация о пользователе */
    readonly user: MeUserInfo;
    /** Информация о сессии (sessionId, expiresAt, status) */
    readonly session?: MeSessionInfo;
    /** Роли пользователя */
    readonly roles?: readonly string[];
    /** Permissions / scopes (ReadonlySet для O(1) lookup) */
    readonly permissions?: ReadonlySet<string>;
    /** Feature flags */
    readonly features?: Record<string, boolean>;
    /** Дополнительный контекст */
    readonly context?: Record<string, unknown>;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: требуется вторичная верификация (MFA/email/phone) */
    readonly status: 'pending_secondary_verification';
    /** Идентификатор пользователя */
    readonly userId: string;
    /** Тип верификации (детали в MfaState/VerificationState) */
    readonly verificationType?: 'mfa' | 'email' | 'phone';
    /** Информация об ошибке, если была */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: сессия истекла */
    readonly status: 'session_expired';
    /** Идентификатор пользователя */
    readonly userId?: string;
    /** Информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: ошибка */
    readonly status: 'error';
    /** Информация об ошибке */
    readonly error: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/* ============================================================================
 * 🔐 MFA TYPES
 * ============================================================================
 */

/** Статус MFA */
export type MfaStatus =
  | 'not_setup' // MFA не настроен
  | 'setup_in_progress' // Процесс настройки MFA
  | 'setup_complete' // MFA настроен
  | 'challenged' // MFA challenge отправлен
  | 'verified' // MFA успешно подтвержден
  | 'failed' // MFA проверка не прошла
  | 'recovery_required' // Требуется восстановление MFA
  | 'recovery_in_progress'; // Процесс восстановления MFA

/** Состояние MFA */
export type MfaState =
  | {
    /** Статус: MFA не настроен */
    readonly status: 'not_setup';
    /** Доступные методы для настройки */
    readonly availableMethods?: readonly MfaType[];
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: настройка в процессе */
    readonly status: 'setup_in_progress';
    /** Метод MFA, который настраивается */
    readonly method: MfaType;
    /** Идентификатор процесса настройки */
    readonly setupId?: string;
    /** Секрет для настройки (например, TOTP secret) */
    readonly secret?: string;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: MFA настроен */
    readonly status: 'setup_complete';
    /** Настроенные методы MFA */
    readonly enabledMethods: readonly MfaType[];
    /** Количество backup кодов */
    readonly backupCodesCount?: number;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: challenge отправлен */
    readonly status: 'challenged';
    /** Метод MFA */
    readonly method: MfaType;
    /** Идентификатор challenge */
    readonly challengeId: string;
    /** Время истечения challenge */
    readonly expiresAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: MFA подтвержден */
    readonly status: 'verified';
    /** Метод MFA, который был использован */
    readonly method: MfaType;
    /** Время подтверждения */
    readonly verifiedAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: MFA проверка не прошла */
    readonly status: 'failed';
    /** Метод MFA, который был использован */
    readonly method: MfaType;
    /** Количество оставшихся попыток */
    readonly remainingAttempts?: number;
    /** Информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: требуется восстановление */
    readonly status: 'recovery_required';
    /** Доступные методы восстановления */
    readonly availableRecoveryMethods?: readonly MfaRecoveryMethod[];
    /** Информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: восстановление в процессе */
    readonly status: 'recovery_in_progress';
    /** Метод восстановления */
    readonly method: MfaRecoveryMethod;
    /** Идентификатор процесса восстановления */
    readonly recoveryId?: string;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/** Агрегирующий тип для MFA операций */
export type MfaOperation =
  | MfaChallengeRequest
  | MfaSetupRequest
  | MfaBackupCodeRequest
  | MfaRecoveryRequest;

/* ============================================================================
 * 🌐 OAUTH TYPES
 * ============================================================================
 */

/** Статус OAuth аутентификации */
export type OAuthStatus =
  | 'idle' // OAuth не инициирован
  | 'initiating' // Инициирование OAuth flow
  | 'redirecting' // Перенаправление на провайдера
  | 'processing' // Обработка callback от провайдера
  | 'success' // OAuth успешно завершен
  | 'error'; // Ошибка OAuth

/** Состояние OAuth аутентификации */
export type OAuthState =
  | {
    /** Статус: не инициирован */
    readonly status: 'idle';
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: инициирование */
    readonly status: 'initiating';
    /** Провайдер OAuth */
    readonly provider: OAuthProvider;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: перенаправление */
    readonly status: 'redirecting';
    /** Провайдер OAuth */
    readonly provider: OAuthProvider;
    /** URL для перенаправления */
    readonly redirectUrl: string;
    /** State параметр для CSRF защиты */
    readonly state?: string;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: обработка callback */
    readonly status: 'processing';
    /** Провайдер OAuth */
    readonly provider: OAuthProvider;
    /** Authorization code от провайдера */
    readonly code?: string;
    /** State параметр */
    readonly state?: string;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: успешно завершен */
    readonly status: 'success';
    /** Провайдер OAuth */
    readonly provider: OAuthProvider;
    /** Результат аутентификации (токены или пользователь) */
    readonly result?: TokenPair | MeUserInfo;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: ошибка */
    readonly status: 'error';
    /** Провайдер OAuth */
    readonly provider?: OAuthProvider;
    /** Информация об ошибке */
    readonly error: OAuthErrorResponse;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/** Агрегирующий тип для OAuth операций */
export type OAuthOperation = OAuthLoginRequest | OAuthRegisterRequest;

/** Агрегирующий тип для OAuth ошибок */
export type OAuthError = OAuthErrorResponse;

/* ============================================================================
 * 🛡️ SECURITY TYPES
 * ============================================================================
 */

/**
 * Уровень риска
 * @note Re-export из @livai/domains для единого источника истины
 *       Соответствует плану рефакторинга: "Убрать локальные определения RiskLevel"
 */
export type { RiskLevel } from '@livai/domains/policies';

/** Статус безопасности */
export type SecurityStatus =
  | 'secure' // Безопасно
  | 'risk_detected' // Обнаружен риск
  | 'blocked' // Заблокировано
  | 'review_required'; // Требуется проверка

/** Состояние безопасности */
export type SecurityState =
  | {
    /** Статус: безопасно */
    readonly status: 'secure';
    /** Оценка риска */
    readonly riskScore?: number;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: обнаружен риск */
    readonly status: 'risk_detected';
    /** Уровень риска */
    readonly riskLevel: RiskLevel;
    /** Оценка риска (0-100) */
    readonly riskScore: number;
    /** Детали оценки риска */
    readonly riskAssessment?: LoginRiskResult;
    /** Требуемые действия */
    readonly requiredActions?: readonly string[];
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: заблокировано */
    readonly status: 'blocked';
    /** Причина блокировки */
    readonly reason: string;
    /** Время блокировки до */
    readonly blockedUntil?: ISODateString;
    /** Информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: требуется проверка */
    readonly status: 'review_required';
    /** Причина проверки */
    readonly reason: string;
    /** Оценка риска */
    readonly riskScore?: number;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/** Статус сессии */
export type SessionStatus =
  | 'active' // Сессия активна
  | 'expired' // Сессия истекла
  | 'revoked' // Сессия отозвана
  | 'suspended'; // Сессия приостановлена

/** Состояние сессии */
export type SessionState =
  | {
    /** Статус: активна */
    readonly status: 'active';
    /** Идентификатор сессии */
    readonly sessionId: string;
    /** Информация об устройстве */
    readonly device?: DeviceInfo;
    /** Политика сессии */
    readonly policy?: SessionPolicy;
    /** Время выдачи */
    readonly issuedAt: ISODateString;
    /** Время истечения */
    readonly expiresAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: истекла */
    readonly status: 'expired';
    /** Идентификатор сессии */
    readonly sessionId: string;
    /** Время истечения */
    readonly expiredAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: отозвана */
    readonly status: 'revoked';
    /** Идентификатор сессии */
    readonly sessionId: string;
    /** Причина отзыва */
    readonly reason?: SessionRevokeReason;
    /** Время отзыва */
    readonly revokedAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: приостановлена */
    readonly status: 'suspended';
    /** Идентификатор сессии */
    readonly sessionId: string;
    /** Причина приостановки */
    readonly reason: string;
    /** Время приостановки до */
    readonly suspendedUntil?: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/** Агрегирующий тип для операций безопасности */
export type SecurityOperation =
  | LoginRiskEvaluation
  | SessionPolicy
  | SessionRevokeRequest
  | AuthAuditEvent;

/* ============================================================================
 * 🔄 RECOVERY TYPES
 * ============================================================================
 */

/** Статус восстановления */
export type RecoveryStatus =
  | 'idle' // Восстановление не инициировано
  | 'requested' // Запрос на восстановление отправлен
  | 'verifying' // Проверка токена/кода восстановления
  | 'confirmed' // Восстановление подтверждено
  | 'completed' // Восстановление завершено
  | 'expired' // Токен/код восстановления истек
  | 'error'; // Ошибка восстановления

/** Состояние восстановления пароля */
export type PasswordRecoveryState =
  | {
    /** Статус: не инициировано */
    readonly status: 'idle';
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: запрос отправлен */
    readonly status: 'requested';
    /** Тип идентификатора */
    readonly identifierType: PasswordResetIdentifierType;
    /** Идентификатор (email/username/phone) */
    readonly identifier: string;
    /** Время отправки запроса */
    readonly requestedAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: проверка токена */
    readonly status: 'verifying';
    /** Токен восстановления */
    readonly token: string;
    /** Время истечения токена */
    readonly expiresAt?: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: подтверждено */
    readonly status: 'confirmed';
    /** Токен восстановления */
    readonly token: string;
    /** Время подтверждения */
    readonly confirmedAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: завершено */
    readonly status: 'completed';
    /** Время завершения */
    readonly completedAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: токен истек */
    readonly status: 'expired';
    /** Токен восстановления */
    readonly token?: string;
    /** Время истечения */
    readonly expiredAt: ISODateString;
    /** Информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: ошибка */
    readonly status: 'error';
    /** Информация об ошибке */
    readonly error: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/** Состояние верификации */
export type VerificationState =
  | {
    /** Статус: не инициировано */
    readonly status: 'idle';
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: отправлено */
    readonly status: 'sent';
    /** Тип верификации */
    readonly type: 'email' | 'phone';
    /** Адрес/номер для верификации */
    readonly target: string;
    /** Время отправки */
    readonly sentAt: ISODateString;
    /** Время истечения кода */
    readonly expiresAt?: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: проверка кода */
    readonly status: 'verifying';
    /** Тип верификации */
    readonly type: 'email' | 'phone';
    /** Код верификации */
    readonly code: string;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: подтверждено */
    readonly status: 'verified';
    /** Тип верификации */
    readonly type: 'email' | 'phone';
    /** Время подтверждения */
    readonly verifiedAt: ISODateString;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: истекло */
    readonly status: 'expired';
    /** Тип верификации */
    readonly type: 'email' | 'phone';
    /** Время истечения */
    readonly expiredAt: ISODateString;
    /** Информация об ошибке */
    readonly error?: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  }
  | {
    /** Статус: ошибка */
    readonly status: 'error';
    /** Тип верификации */
    readonly type: 'email' | 'phone';
    /** Информация об ошибке */
    readonly error: AuthError;
    /** Типизированные метаданные */
    readonly meta?: readonly AuthMeta[];
  };

/** Агрегирующий тип для операций восстановления */
export type RecoveryOperation =
  | PasswordResetRequest<PasswordResetIdentifierType>
  | PasswordResetConfirm
  | VerifyEmailRequest
  | VerifyPhoneRequest
  | MfaRecoveryRequest
  | EmailTemplateRequest
  | SmsTemplateRequest;

/* ============================================================================
 * 📊 AGGREGATED REQUEST/RESPONSE TYPES
 * ============================================================================
 */

/** Агрегирующий тип для всех auth запросов */
export type AuthRequest =
  | LoginRequest<LoginIdentifierType>
  | RegisterRequest
  | OAuthLoginRequest
  | OAuthRegisterRequest
  | RefreshTokenRequest
  | LogoutRequest
  | MfaOperation
  | RecoveryOperation;

/** Агрегирующий тип для всех auth ответов */
export type AuthResponse =
  | RegisterResponse<'email' | 'username' | 'phone' | 'oauth'>
  | MeResponse
  | TokenPair
  | AuthErrorResponse
  | OAuthErrorResponse;

/* ============================================================================
 * 🎯 COMMAND & EVENT TYPES (CQRS / Event Sourcing)
 * ============================================================================
 *
 * Архитектурная роль:
 * - AuthCommand: то, что инициирует пользователь (write model)
 * - AuthEvent: то, что произошло (read model, event sourcing)
 *
 * Boundary: feature-auth = read/write model
 * - domain/ = чистые DTO (domain layer)
 * - types/ = агрегирующие типы для feature layer (read/write модели)
 * - stores/effects/ = бизнес-логика и side effects (infrastructure layer)
 *
 * Примечание: type поля можно сделать const enum для runtime сериализации/логирования,
 * но оставлены как литеральные типы для гибкости и type inference.
 */

/** Базовый тип для всех событий (содержит timestamp) */
type BaseEvent = {
  readonly timestamp: ISODateString;
};

/** Команда аутентификации — то, что инициирует пользователь */
export type AuthCommand =
  | { readonly type: 'login'; readonly payload: LoginRequest<LoginIdentifierType>; }
  | { readonly type: 'register'; readonly payload: RegisterRequest; }
  | { readonly type: 'logout'; readonly payload: LogoutRequest; }
  | { readonly type: 'refresh'; readonly payload: RefreshTokenRequest; }
  | { readonly type: 'oauth_login'; readonly payload: OAuthLoginRequest; }
  | { readonly type: 'oauth_register'; readonly payload: OAuthRegisterRequest; }
  | { readonly type: 'mfa_challenge'; readonly payload: MfaChallengeRequest; }
  | { readonly type: 'mfa_setup'; readonly payload: MfaSetupRequest; }
  | { readonly type: 'mfa_backup_code'; readonly payload: MfaBackupCodeRequest; }
  | { readonly type: 'mfa_recovery'; readonly payload: MfaRecoveryRequest; }
  | {
    readonly type: 'password_reset_request';
    readonly payload: PasswordResetRequest<PasswordResetIdentifierType>;
  }
  | { readonly type: 'password_reset_confirm'; readonly payload: PasswordResetConfirm; }
  | { readonly type: 'verify_email'; readonly payload: VerifyEmailRequest; }
  | { readonly type: 'verify_phone'; readonly payload: VerifyPhoneRequest; }
  | { readonly type: 'session_revoke'; readonly payload: SessionRevokeRequest; };

/** Событие аутентификации — то, что произошло */
export type AuthEvent =
  | ({
    readonly type: 'user_logged_in';
    readonly payload: { userId: string; tokenPair: TokenPair; session?: MeSessionInfo; };
  } & BaseEvent)
  | ({
    readonly type: 'user_logged_out';
    readonly payload: { userId?: string; sessionId?: string; };
  } & BaseEvent)
  | ({
    readonly type: 'user_registered';
    readonly payload: { userId: string; tokenPair?: TokenPair; mfaRequired: boolean; };
  } & BaseEvent)
  | ({
    readonly type: 'token_refreshed';
    readonly payload: { userId: string; tokenPair: TokenPair; };
  } & BaseEvent)
  | ({
    readonly type: 'mfa_challenge_sent';
    readonly payload: { userId: string; method: MfaType; challengeId: string; };
  } & BaseEvent)
  | (
    & { readonly type: 'mfa_verified'; readonly payload: { userId: string; method: MfaType; }; }
    & BaseEvent
  )
  | ({
    readonly type: 'mfa_failed';
    readonly payload: { userId: string; method: MfaType; remainingAttempts?: number; };
  } & BaseEvent)
  | ({ readonly type: 'email_verified'; readonly payload: { userId: string; }; } & BaseEvent)
  | ({ readonly type: 'phone_verified'; readonly payload: { userId: string; }; } & BaseEvent)
  | ({
    readonly type: 'password_reset_requested';
    readonly payload: { identifier: string; identifierType: PasswordResetIdentifierType; };
  } & BaseEvent)
  | (
    & { readonly type: 'password_reset_completed'; readonly payload: { userId: string; }; }
    & BaseEvent
  )
  | ({
    readonly type: 'session_revoked';
    readonly payload: { sessionId: string; reason?: SessionRevokeReason; };
  } & BaseEvent)
  | ({ readonly type: 'session_expired'; readonly payload: { sessionId: string; }; } & BaseEvent)
  | ({
    readonly type: 'risk_detected';
    readonly payload: {
      userId?: string;
      riskScore: number;
      riskLevel: RiskLevel;
      assessment?: LoginRiskEvaluation;
    };
  } & BaseEvent)
  | (
    & { readonly type: 'auth_error'; readonly payload: { error: AuthError; userId?: string; }; }
    & BaseEvent
  )
  | ({
    readonly type: 'oauth_success';
    readonly payload: { provider: OAuthProvider; userId: string; tokenPair?: TokenPair; };
  } & BaseEvent)
  | ({
    readonly type: 'oauth_error';
    readonly payload: { provider: OAuthProvider; error: OAuthErrorResponse; };
  } & BaseEvent);
