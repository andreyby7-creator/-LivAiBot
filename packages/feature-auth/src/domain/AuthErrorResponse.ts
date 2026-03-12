/**
 * @file packages/feature-auth/src/domain/AuthErrorResponse.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — AuthErrorResponse DTO
 * ============================================================================
 * Архитектурная роль:
 * - Унифицированный DTO ошибок аутентификации и авторизации
 * - Используется всеми auth endpoints (password, OAuth, MFA, sessions)
 * - Безопасен для API boundary (frontend / SDK)
 * - Совместим с rate limiting, lockout и risk-based flows
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-safe
 * - ✅ UX & API friendly
 *
 * @example
 * const error: AuthErrorResponse = {
 *   error: 'invalid_credentials',
 *   message: 'Invalid email or password',
 *   retryable: true,
 *   statusCode: 401,
 *   timestamp: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Нормализованные типы ошибок auth-домена */
export type AuthErrorType =
  | 'invalid_credentials'
  | 'account_locked'
  | 'account_disabled'
  | 'email_not_verified'
  | 'phone_not_verified'
  | 'mfa_required'
  | 'mfa_failed'
  | 'rate_limited'
  | 'session_expired'
  | 'session_revoked'
  | 'token_invalid'
  | 'token_expired'
  | 'permission_denied'
  | 'risk_blocked'
  | 'conflict'
  | 'unknown_error';

/** DTO ошибки аутентификации */
export type AuthErrorResponse = {
  /** Нормализованный код ошибки */
  readonly error: AuthErrorType;

  /** Безопасное человеко-читаемое сообщение */
  readonly message?: string;

  /** Можно ли повторить операцию */
  readonly retryable: boolean;

  /** HTTP статус (если используется на API boundary) */
  readonly statusCode?: number;

  /** Идентификатор пользователя (если известен) */
  readonly userId?: string;

  /** Идентификатор сессии / запроса */
  readonly correlationId?: string;

  /** Временная метка ошибки (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Дополнительный контекст:
   * - remaining attempts
   * - lockout duration
   * - required MFA type
   * - risk score
   */
  readonly context?: Record<string, unknown>;
};
