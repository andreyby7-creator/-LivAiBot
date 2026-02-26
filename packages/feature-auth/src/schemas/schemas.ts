/**
 * @file packages/feature-auth/src/schemas.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Zod Schemas & Types
 * ============================================================================
 *
 * Архитектурная роль:
 * - Runtime валидация для UI форм аутентификации
 * - Type-safe схемы на базе OpenAPI контрактов
 * - Strict режим для предотвращения extra полей
 * - Поддержка всех auth сценариев (login, register, audit)
 * - SIEM-ready audit event validation
 *
 * Принципы:
 * - ❌ Нет бизнес-логики (только валидация)
 * - ✅ Источник истины: @livai/core-contracts/validation/zod
 * - ✅ Strict режим для UI (нет extra полей)
 * - ✅ Type-safe inference для TypeScript
 * - ✅ Runtime validation с detailed errors
 * - ✅ Audit & compliance ready
 */

import { generatedAuth } from '@livai/core-contracts/validation/zod';
import { z } from 'zod';
import type { z as ZodType } from 'zod';

// Zod schemas provide runtime validation for auth-related DTOs
// Domain types are defined separately and can be validated using these schemas

// Константы для сообщений об ошибках валидации
const ERROR_INVALID_ISO_8601_DATETIME = 'Invalid ISO 8601 datetime format';
const ERROR_INVALID_EMAIL_FORMAT = 'Invalid email format';
const ERROR_INVALID_URL_FORMAT = 'Invalid URL format';

// Константы для ограничений длины (защита от ReDoS)
const MAX_ISO_8601_DATETIME_LENGTH = 30; // Максимальная длина ISO 8601 datetime строки
const MAX_EMAIL_LENGTH = 320; // Максимальная длина email (RFC 5321)
const MIN_PHONE_CODE_LENGTH = 4; // Минимальная длина SMS кода подтверждения
const MAX_PHONE_CODE_LENGTH = 8; // Максимальная длина SMS кода подтверждения

// Безопасные регулярные выражения (с ограничением длины для предотвращения ReDoS)
// eslint-disable-next-line functional/prefer-immutable-types, security/detect-unsafe-regex -- Regex константы неизменяемы по определению; безопасен благодаря ограничению длины строки (MAX_ISO_8601_DATETIME_LENGTH)
const ISO_8601_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
// eslint-disable-next-line functional/prefer-immutable-types -- Regex константы неизменяемы по определению
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line functional/prefer-immutable-types -- Regex константы неизменяемы по определению
const NUMERIC_CODE_REGEX = /^\d+$/; // Только цифры для SMS кода подтверждения

/* ============================================================================
 * 🔧 ESLINT CONFIGURATION
 * ============================================================================
 *
 * Глобальное подавление правил для всего файла:
 * - functional/prefer-immutable-types: Zod schemas — runtime объекты,
 *   типовая иммутабельность здесь неприменима
 */

/* eslint-disable functional/prefer-immutable-types -- Zod схемы — runtime объекты, типовая иммутабельность здесь неприменима */

/* ============================================================================
 * 🎯 UI FORM SCHEMAS (Strict Mode)
 * ============================================================================ */

// Login form schema — strict validation для UI форм, базируется на core-contracts LoginRequestSchema с strict() режимом
export const loginSchema = generatedAuth.LoginRequestSchema.strict();

// Inferred type from login schema — type-safe для TypeScript, автоматически синхронизирован с OpenAPI контрактом
export type LoginValues = ZodType.infer<typeof loginSchema>;

// Register form schema — strict validation для UI форм, базируется на core-contracts RegisterRequestSchema с strict() режимом
export const registerSchema = generatedAuth.RegisterRequestSchema.strict();

// Inferred type from register schema — type-safe для TypeScript, автоматически синхронизирован с OpenAPI контрактом
export type RegisterValues = ZodType.infer<typeof registerSchema>;

/* ============================================================================
 * 📊 AUDIT EVENT SCHEMA (SIEM-Ready)
 * ============================================================================ */

/* eslint-disable @livai/rag/context-leakage -- События аудита требуют контекстных полей (sessionId, context) для соответствия SIEM */
// Audit event schema для валидации событий аудита аутентификации (vendor-agnostic, SIEM-ready, compliance-focused)
// Поддерживает: login/logout flows, token management, MFA operations, risk detection, policy violations, OAuth flows
export const auditEventSchema = z.object({
  eventId: z.string().min(1), // Уникальный идентификатор события
  type: z.enum([ // Тип события аудита
    'login_attempt',
    'login_success',
    'login_failure',
    'logout',
    'token_refresh',
    'token_revoked',
    'session_revoked',
    'mfa_challenge',
    'mfa_success',
    'mfa_failure',
    'password_reset_request',
    'password_reset_confirm',
    'email_verification',
    'phone_verification',
    'oauth_login',
    'oauth_register',
    'risk_detected',
    'policy_violation',
  ]),
  timestamp: z.string().refine(
    (val) => val.length <= MAX_ISO_8601_DATETIME_LENGTH && ISO_8601_DATETIME_REGEX.test(val),
    {
      message: ERROR_INVALID_ISO_8601_DATETIME,
    },
  ), // Timestamp в ISO 8601 формате
  userId: z.string().optional(), // User ID (опционально, может отсутствовать до идентификации)
  sessionId: z.string().optional(), // Session ID для tracking
  clientApp: z.string().optional(), // Client application (web, mobile, api, admin, etc.)
  ip: z.string().optional(), // IP адрес (PII - Personal Identifiable Information)
  deviceId: z.string().optional(), // Device fingerprint (PII)
  userAgent: z.string().optional(), // User-Agent string
  geo: z.object({ // Геолокационная информация (PII)
    country: z.string().optional(), // Страна
    region: z.string().optional(), // Регион
    city: z.string().optional(), // Город
    lat: z.number().optional(), // Широта
    lng: z.number().optional(), // Долгота
  }).optional(),
  riskScore: z.number().min(0).max(100).optional(), // Risk score (0-100) для risk-based events
  policyId: z.string().optional(), // Policy ID для policy violation events
  mfaMethod: z.string().optional(), // MFA method для MFA-related events
  errorCode: z.string().optional(), // Error code для failure events
  correlationId: z.string().optional(), // Correlation ID для distributed tracing
  context: z.record(z.string(), z.unknown()).optional(), // Дополнительный контекст (extensible)
}).strict();

/* eslint-enable @livai/rag/context-leakage */

// Inferred type from audit event schema — type-safe для TypeScript, полная типизация всех полей аудита для SIEM интеграции
export type AuditEventValues = ZodType.infer<typeof auditEventSchema>;

/* ============================================================================
 * 🔐 AUTH REQUEST SCHEMAS
 * ============================================================================ */

/* eslint-disable @livai/rag/context-leakage, no-magic-numbers -- Требуется клиентский контекст и отслеживание сессий; стандартные лимиты длины пароля/workspace */
// Login request schema — базовая структура для валидации, базируется на discriminated union типе LoginRequest
export const loginRequestSchema = z.object({
  identifier: z.object({ // Универсальный идентификатор пользователя
    type: z.enum(['email', 'oauth', 'username', 'phone']), // Тип идентификатора
    value: z.string(), // Значение идентификатора
  }),
  password: z.string().min(8).max(128).optional(), // Стандартная минимальная длина пароля
  dtoVersion: z.enum(['1.0', '1.1']), // Версия DTO для безопасного evolution API
  rememberMe: z.boolean().optional(), // Запомнить пользователя
  clientContext: z.object({ // Клиентский контекст для безопасности
    ip: z.string().optional(), // IP адрес клиента
    deviceId: z.string().optional(), // Идентификатор устройства
    userAgent: z.string().optional(), // User-Agent клиента
    locale: z.string().optional(), // Локаль клиента
    timezone: z.string().optional(), // Часовой пояс клиента
    sessionId: z.string().optional(), // Идентификатор сессии
    appVersion: z.string().optional(), // Версия приложения
    geo: z.object({ // Геолокационная информация
      lat: z.number().optional(), // Широта
      lng: z.number().optional(), // Долгота
      country: z.string().optional(), // Страна
      region: z.string().optional(), // Регион
      city: z.string().optional(), // Город
    }).optional(),
  }).optional(),
  mfa: z.union([
    z.object({ type: z.string(), token: z.string(), deviceId: z.string().optional() }),
    z.array(z.object({ type: z.string(), token: z.string(), deviceId: z.string().optional() })),
  ]).optional(), // Multi-factor authentication
  provider: z.string().optional(), // OAuth provider
  providerToken: z.string().optional(), // OAuth provider token
}).strict();

export type LoginRequestValues = ZodType.infer<typeof loginRequestSchema>;

// Register request schema
export const registerRequestSchema = z.object({
  email: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
    message: ERROR_INVALID_EMAIL_FORMAT,
  }), // Email пользователя
  password: z.string().min(8).max(128), // Стандартная минимальная длина пароля
  workspaceName: z.string().min(1).max(200), // Разумный лимит длины имени workspace
  clientContext: z.object({ // Клиентский контекст для безопасности
    ip: z.string().optional(), // IP адрес клиента
    deviceId: z.string().optional(), // Идентификатор устройства
    userAgent: z.string().optional(), // User-Agent клиента
    locale: z.string().optional(), // Локаль клиента
    timezone: z.string().optional(), // Часовой пояс клиента
  }).optional(),
}).strict();

export type RegisterRequestValues = ZodType.infer<typeof registerRequestSchema>;

// Register response schema
export const registerResponseSchema = z.object({
  userId: z.string(), // Идентификатор пользователя
  workspaceId: z.string(), // Идентификатор workspace
  email: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
    message: ERROR_INVALID_EMAIL_FORMAT,
  }), // Email пользователя
  accessToken: z.string(), // Access token
  refreshToken: z.string(), // Refresh token
  tokenType: z.string().optional(), // Тип токена (обычно 'bearer')
  expiresIn: z.number().optional(), // Время жизни токена в секундах
}).strict();

export type RegisterResponseValues = ZodType.infer<typeof registerResponseSchema>;

/* eslint-enable @livai/rag/context-leakage, no-magic-numbers */

/* ============================================================================
 * 🔑 TOKEN & SESSION SCHEMAS
 * ============================================================================ */

/* eslint-disable @livai/rag/context-leakage -- Отслеживание сессий требуется для безопасности */
// Token pair schema
export const tokenPairSchema = z.object({
  accessToken: z.string(), // JWT или opaque access token
  refreshToken: z.string(), // JWT или opaque refresh token
  expiresAt: z.string().refine(
    (val) => val.length <= MAX_ISO_8601_DATETIME_LENGTH && ISO_8601_DATETIME_REGEX.test(val),
    {
      message: ERROR_INVALID_ISO_8601_DATETIME,
    },
  ), // Время истечения access token (ISO 8601)
  issuedAt: z.string().refine(
    (val) => val.length <= MAX_ISO_8601_DATETIME_LENGTH && ISO_8601_DATETIME_REGEX.test(val),
    {
      message: ERROR_INVALID_ISO_8601_DATETIME,
    },
  ).optional(), // Время выпуска токенов (ISO 8601, опционально)
  scope: z.array(z.string()).optional(), // Дополнительные scope/permissions токена
  metadata: z.record(z.string(), z.unknown()).optional(), // Опциональные метаданные для аудита или device binding
}).strict();

export type TokenPairValues = ZodType.infer<typeof tokenPairSchema>;

// Refresh token request schema
export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(), // Refresh token для обновления access token
}).strict();

export type RefreshTokenRequestValues = ZodType.infer<typeof refreshTokenRequestSchema>;

// Logout request schema
export const logoutRequestSchema = z.object({
  refreshToken: z.string().optional(), // Refresh token для отзыва
  sessionId: z.string().optional(), // Идентификатор сессии для отзыва
}).strict();

export type LogoutRequestValues = ZodType.infer<typeof logoutRequestSchema>;

// Session revoke request schema
export const sessionRevokeRequestSchema = z.object({
  sessionId: z.string(), // Идентификатор сессии для отзыва
  reason: z.string().optional(), // Причина отзыва сессии
}).strict();

export type SessionRevokeRequestValues = ZodType.infer<typeof sessionRevokeRequestSchema>;

// Me response schema
export const meResponseSchema = z.object({
  user: z.object({ // Информация о пользователе
    id: z.string(), // Идентификатор пользователя
    email: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
      message: ERROR_INVALID_EMAIL_FORMAT,
    }).optional(), // Email пользователя
    emailVerified: z.boolean().optional(), // Email подтвержден
    phone: z.string().optional(), // Телефон пользователя
    phoneVerified: z.boolean().optional(), // Телефон подтвержден
    username: z.string().optional(), // Имя пользователя
    displayName: z.string().optional(), // Отображаемое имя
    avatarUrl: z.string().optional(), // URL аватара
    authProvider: z.enum(['password', 'oauth']).optional(), // OAuth провайдер, если применимо
    status: z.enum(['active', 'locked', 'disabled', 'pending']).optional(), // Статус аккаунта
    createdAt: z.string().optional(), // Время создания аккаунта
    lastLoginAt: z.string().optional(), // Время последнего входа
  }),
  roles: z.array(z.string()), // Роли пользователя
  permissions: z.array(z.string()), // Permissions / scopes
  session: z.object({ // Информация о текущей сессии
    sessionId: z.string(), // Идентификатор сессии
    ip: z.string().optional(), // IP адрес текущей сессии
    deviceId: z.string().optional(), // Идентификатор устройства
    userAgent: z.string().optional(), // User-Agent
    issuedAt: z.string().optional(), // Время выдачи сессии
    expiresAt: z.string().optional(), // Время истечения сессии
  }).optional(),
  features: z.record(z.string(), z.boolean()).optional(), // Feature flags / capability hints
  context: z.record(z.string(), z.unknown()).optional(), // Дополнительный контекст (org, tenant, policy hints)
}).strict();

export type MeResponseValues = ZodType.infer<typeof meResponseSchema>;

/* eslint-enable @livai/rag/context-leakage */

/* ============================================================================
 * 🔐 MFA SCHEMAS
 * ============================================================================ */

/* eslint-disable no-magic-numbers -- Стандартная длина backup кода */
// MFA challenge request schema
export const mfaChallengeRequestSchema = z.object({
  userId: z.string(), // Идентификатор пользователя
  method: z.enum(['totp', 'sms', 'email', 'push']), // Метод MFA
}).strict();

export type MfaChallengeRequestValues = ZodType.infer<typeof mfaChallengeRequestSchema>;

// MFA setup request schema
export const mfaSetupRequestSchema = z.object({
  userId: z.string(), // Идентификатор пользователя
  method: z.enum(['totp', 'sms', 'email', 'push']), // Метод MFA
  phoneNumber: z.string().optional(), // Номер телефона (для SMS)
  email: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
    message: ERROR_INVALID_EMAIL_FORMAT,
  }).optional(),
}).strict();

export type MfaSetupRequestValues = ZodType.infer<typeof mfaSetupRequestSchema>;

// MFA backup code request schema
export const mfaBackupCodeRequestSchema = z.object({
  userId: z.string(), // Идентификатор пользователя
  code: z.string().length(8), // Стандартная длина backup кода
}).strict();

export type MfaBackupCodeRequestValues = ZodType.infer<typeof mfaBackupCodeRequestSchema>;

// MFA recovery request schema
export const mfaRecoveryRequestSchema = z.object({
  userId: z.string(), // Идентификатор пользователя
  recoveryCode: z.string(), // Код восстановления
}).strict();

export type MfaRecoveryRequestValues = ZodType.infer<typeof mfaRecoveryRequestSchema>;

/* eslint-enable no-magic-numbers */

/* ============================================================================
 * 🔄 PASSWORD RECOVERY SCHEMAS
 * ============================================================================ */

/* eslint-disable @livai/rag/context-leakage, no-magic-numbers -- Клиентский контекст для безопасности; стандартная длина пароля */
// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
    message: ERROR_INVALID_EMAIL_FORMAT,
  }), // Email для сброса пароля
  clientContext: z.object({ // Клиентский контекст для безопасности
    ip: z.string().optional(), // IP адрес клиента
    userAgent: z.string().optional(), // User-Agent клиента
  }).optional(),
}).strict();

export type PasswordResetRequestValues = ZodType.infer<typeof passwordResetRequestSchema>;

// Password reset confirm schema
export const passwordResetConfirmSchema = z.object({
  dtoVersion: z.enum(['1.0', '1.1']).optional(), // Версия DTO для безопасного evolution API
  token: z.string(), // Токен для подтверждения сброса пароля, выданный сервером
  newPassword: z.string().min(8).max(128), // Стандартная минимальная длина пароля
  confirmPassword: z.string().min(8).max(128).optional(), // Для UI валидации (не в domain DTO)
  clientContext: z.object({ // Опциональные метаданные клиента
    ip: z.string().optional(), // IP адрес клиента
    deviceId: z.string().optional(), // Идентификатор устройства
    userAgent: z.string().optional(), // User-Agent клиента
    locale: z.string().optional(), // Локаль клиента
    timezone: z.string().optional(), // Часовой пояс клиента
    geo: z.object({ // Геолокационная информация
      lat: z.number(), // Широта
      lng: z.number(), // Долгота
    }).optional(),
    sessionId: z.string().optional(), // Идентификатор сессии
    appVersion: z.string().optional(), // Версия приложения
  }).optional(),
  redirectUrl: z.string().optional(), // Опциональная ссылка на redirect после успешного сброса
}).refine((data) => {
  // Если confirmPassword присутствует, проверяем совпадение (для UI валидации)
  return data.confirmPassword === undefined ? true : data.newPassword === data.confirmPassword;
}, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).strict();

/* eslint-enable @livai/rag/context-leakage, no-magic-numbers */

export type PasswordResetConfirmValues = ZodType.infer<typeof passwordResetConfirmSchema>;

/* ============================================================================
 * ✅ VERIFICATION SCHEMAS
 * ============================================================================ */

// Email verification request schema
export const verifyEmailRequestSchema = z.object({
  token: z.string(), // Токен верификации email
  email: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
    message: ERROR_INVALID_EMAIL_FORMAT,
  }), // Email для верификации
}).strict();

export type VerifyEmailRequestValues = ZodType.infer<typeof verifyEmailRequestSchema>;

// Phone verification request schema
export const verifyPhoneRequestSchema = z.object({
  dtoVersion: z.enum(['1.0', '1.1']).optional(), // Версия DTO для безопасного evolution API
  phone: z.string(), // Номер телефона в международном формате (E.164)
  code: z.string().min(MIN_PHONE_CODE_LENGTH).max(MAX_PHONE_CODE_LENGTH).refine(
    (val) => NUMERIC_CODE_REGEX.test(val),
    {
      message: 'Code must contain only digits',
    },
  ), // Код подтверждения, выданный через SMS (numeric, 4-8 цифр)
  /* eslint-disable-next-line @livai/rag/context-leakage -- Клиентский контекст для безопасности и аудита */
  clientContext: z.object({ // Опциональные метаданные клиента
    ip: z.string().optional(), // IP адрес клиента
    deviceId: z.string().optional(), // Идентификатор устройства
    userAgent: z.string().optional(), // User-Agent клиента
    locale: z.string().optional(), // Локаль клиента
    timezone: z.string().optional(), // Часовой пояс клиента
    geo: z.object({ // Геолокационная информация
      lat: z.number(), // Широта
      lng: z.number(), // Долгота
    }).optional(),
    /* eslint-disable-next-line @livai/rag/context-leakage -- Идентификатор сессии для безопасности и аудита */
    sessionId: z.string().optional(), // Идентификатор сессии
    appVersion: z.string().optional(), // Версия приложения
  }).optional(),
  redirectUrl: z.string().refine((val) => {
    try {
      const _url = new URL(val);
      return Boolean(_url);
    } catch {
      return false;
    }
  }, {
    message: ERROR_INVALID_URL_FORMAT,
  }).optional(), // Опциональная ссылка для redirect после подтверждения
}).strict();

export type VerifyPhoneRequestValues = ZodType.infer<typeof verifyPhoneRequestSchema>;

/* ============================================================================
 * 🌐 OAUTH SCHEMAS
 * ============================================================================ */

/* eslint-disable @livai/rag/context-leakage, no-magic-numbers -- Клиентский контекст для безопасности OAuth; разумный лимит длины имени workspace */
// OAuth login request schema
export const oauthLoginRequestSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft', 'apple']), // OAuth провайдер
  code: z.string(), // Authorization code от OAuth провайдера
  state: z.string(), // State параметр для защиты от CSRF
  redirectUri: z.string().refine((val) => {
    try {
      const _url = new URL(val);
      return Boolean(_url);
    } catch {
      return false;
    }
  }, {
    message: ERROR_INVALID_URL_FORMAT,
  }), // Redirect URI для OAuth callback
  clientContext: z.object({ // Клиентский контекст для безопасности
    ip: z.string().optional(), // IP адрес клиента
    userAgent: z.string().optional(), // User-Agent клиента
    deviceId: z.string().optional(), // Идентификатор устройства
  }).optional(),
}).strict();

export type OAuthLoginRequestValues = ZodType.infer<typeof oauthLoginRequestSchema>;

// OAuth register request schema
export const oauthRegisterRequestSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft', 'apple']), // OAuth провайдер
  code: z.string(), // Authorization code от OAuth провайдера
  state: z.string(), // State параметр для защиты от CSRF
  redirectUri: z.string().refine((val) => {
    try {
      const _url = new URL(val);
      return Boolean(_url);
    } catch {
      return false;
    }
  }, {
    message: ERROR_INVALID_URL_FORMAT,
  }), // Redirect URI для OAuth callback
  workspaceName: z.string().min(1).max(200), // Разумный лимит длины имени workspace
  clientContext: z.object({ // Клиентский контекст для безопасности
    ip: z.string().optional(), // IP адрес клиента
    userAgent: z.string().optional(), // User-Agent клиента
    deviceId: z.string().optional(), // Идентификатор устройства
  }).optional(),
}).strict();

/* eslint-enable @livai/rag/context-leakage, no-magic-numbers */

export type OAuthRegisterRequestValues = ZodType.infer<typeof oauthRegisterRequestSchema>;

// OAuth error response schema
export const oauthErrorResponseSchema = z.object({
  error: z.enum([ // Тип ошибки OAuth
    'invalid_request',
    'unauthorized_client',
    'access_denied',
    'unsupported_response_type',
    'invalid_scope',
    'server_error',
    'temporarily_unavailable',
  ]),
  errorDescription: z.string().optional(), // Описание ошибки
  errorUri: z.string().refine((val) => {
    try {
      const _url = new URL(val);
      return Boolean(_url);
    } catch {
      return false;
    }
  }, {
    message: ERROR_INVALID_URL_FORMAT,
  }).optional(), // URI с дополнительной информацией об ошибке
  state: z.string().optional(), // State параметр (если был передан)
}).strict();

export type OAuthErrorResponseValues = ZodType.infer<typeof oauthErrorResponseSchema>;

/* ============================================================================
 * ⚠️ ERROR RESPONSE SCHEMAS
 * ============================================================================ */

// Auth error response schema
export const authErrorResponseSchema = z.object({
  error: z.enum([ // Тип ошибки аутентификации
    'invalid_credentials',
    'account_disabled',
    'account_locked',
    'email_not_verified',
    'phone_not_verified',
    'mfa_required',
    'mfa_invalid',
    'token_expired',
    'token_invalid',
    'session_expired',
    'rate_limited',
    'policy_violation',
    'oauth_error',
  ]),
  message: z.string(), // Сообщение об ошибке
  code: z.string(), // Код ошибки
  details: z.record(z.string(), z.unknown()).optional(), // Дополнительные детали ошибки
  traceId: z.string().optional(), // Идентификатор трейса для отладки
}).strict();

export type AuthErrorResponseValues = ZodType.infer<typeof authErrorResponseSchema>;

/* ============================================================================
 * 🛡️ RISK & SECURITY SCHEMAS
 * ============================================================================ */

/* eslint-disable @livai/rag/context-leakage -- Схемы политик безопасности определяют конфигурацию, а не контекст пользователя */
// Login risk assessment schema
export const loginRiskAssessmentSchema = z.object({
  userId: z.string().optional(), // Пользователь (может отсутствовать до идентификации)
  ip: z.string().optional(), // IP адрес клиента
  geo: z.object({ // Геолокация (IP / GPS / provider)
    country: z.string().optional(), // Страна
    region: z.string().optional(), // Регион
    city: z.string().optional(), // Город
    lat: z.number().optional(), // Широта
    lng: z.number().optional(), // Долгота
  }).optional(),
  device: z.object({
    deviceId: z.string().optional(), // Стабильный идентификатор устройства
    fingerprint: z.string().optional(), // Device fingerprint / hash
    platform: z.enum(['web', 'ios', 'android', 'desktop']).optional(), // Платформа клиента
    os: z.string().optional(), // Операционная система
    browser: z.string().optional(), // Браузер или клиент
    appVersion: z.string().optional(), // Версия приложения / клиента
  }).optional(), // Информация об устройстве
  userAgent: z.string().optional(), // User-Agent клиента
  previousSessionId: z.string().optional(), // Предыдущая сессия (если есть)
  timestamp: z.string().refine(
    (val) => val.length <= MAX_ISO_8601_DATETIME_LENGTH && ISO_8601_DATETIME_REGEX.test(val),
    {
      message: ERROR_INVALID_ISO_8601_DATETIME,
    },
  ).optional(), // Временная метка события (ISO 8601)
  signals: z.record(z.string(), z.unknown()).optional(), // Дополнительные сигналы риска (ASN, VPN, Proxy, TOR, Velocity anomalies, Reputation score, External risk vendors)
}).strict();

export type LoginRiskAssessmentValues = ZodType.infer<typeof loginRiskAssessmentSchema>;

// Session policy schema
export const sessionPolicySchema = z.object({
  maxConcurrentSessions: z.number().min(1).optional(), // Максимальное количество одновременных сессий
  ipPolicy: z.object({
    allow: z.array(z.string()).optional(), // Разрешённые IP / CIDR
    deny: z.array(z.string()).optional(), // Запрещённые IP / CIDR
  }).optional(), // Политика IP ограничений
  geoPolicy: z.object({
    allowCountries: z.array(z.string()).optional(), // Разрешённые страны (ISO-2)
    denyCountries: z.array(z.string()).optional(), // Запрещённые страны (ISO-2)
  }).optional(), // Географические ограничения
  requireSameIpForRefresh: z.boolean().optional(), // Требовать тот же IP для refresh token
  requireSameDeviceForRefresh: z.boolean().optional(), // Требовать тот же device fingerprint
  sessionTtlSeconds: z.number().min(1).optional(), // TTL сессии (в секундах)
  idleTimeoutSeconds: z.number().min(1).optional(), // Таймаут неактивности (idle timeout, сек)
  revokeOldestOnLimitExceeded: z.boolean().optional(), // Принудительное завершение старых сессий при превышении лимита
  meta: z.record(z.string(), z.unknown()).optional(), // Дополнительные extensible метаданные
}).strict();

/* eslint-enable @livai/rag/context-leakage */

export type SessionPolicyValues = ZodType.infer<typeof sessionPolicySchema>;

/* ============================================================================
 * 📧 TEMPLATE SCHEMAS
 * ============================================================================ */

// Email template request schema
export const emailTemplateRequestSchema = z.object({
  to: z.string().refine((val) => val.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(val), {
    message: ERROR_INVALID_EMAIL_FORMAT,
  }), // Email получателя
  templateId: z.string(), // Идентификатор шаблона email
  variables: z.record(z.string(), z.unknown()), // Переменные для подстановки в шаблон
  locale: z.string().optional(), // Локаль для локализации шаблона
  priority: z.enum(['low', 'normal', 'high']).optional(), // Приоритет отправки
}).strict();

export type EmailTemplateRequestValues = ZodType.infer<typeof emailTemplateRequestSchema>;

// SMS template request schema
export const smsTemplateRequestSchema = z.object({
  to: z.string(), // Номер телефона получателя
  templateId: z.string(), // Идентификатор шаблона SMS
  variables: z.record(z.string(), z.unknown()), // Переменные для подстановки в шаблон
  locale: z.string().optional(), // Локаль для локализации шаблона
  priority: z.enum(['low', 'normal', 'high']).optional(), // Приоритет отправки
}).strict();

export type SmsTemplateRequestValues = ZodType.infer<typeof smsTemplateRequestSchema>;

/* ============================================================================
 * 📱 DEVICE INFO SCHEMA
 * ============================================================================ */

// Device info schema
export const deviceInfoSchema = z.object({
  deviceId: z.string(), // Уникальный идентификатор устройства
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'iot', 'unknown']), // Тип устройства
  os: z.string().optional(), // Операционная система устройства
  browser: z.string().optional(), // Браузер или клиент
  ip: z.string().optional(), // IP адрес устройства
  geo: z.object({ // Геолокация устройства
    lat: z.number(), // Широта
    lng: z.number(), // Долгота
  }).optional(),
  userAgent: z.string().optional(), // User Agent устройства
  appVersion: z.string().optional(), // Версия приложения / клиента
  lastUsedAt: z.string().refine(
    (val) => val.length <= MAX_ISO_8601_DATETIME_LENGTH && ISO_8601_DATETIME_REGEX.test(val),
    {
      message: ERROR_INVALID_ISO_8601_DATETIME,
    },
  ).optional(), // Последнее время использования устройства (ISO timestamp)
}).strict();

export type DeviceInfoValues = ZodType.infer<typeof deviceInfoSchema>;

/* ============================================================================
 * 🔧 ESLINT CONFIGURATION END
 * ============================================================================ */

/* eslint-enable functional/prefer-immutable-types */
