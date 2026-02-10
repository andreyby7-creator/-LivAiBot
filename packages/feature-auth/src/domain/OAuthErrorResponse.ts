/**
 * @file packages/feature-auth/src/domain/OAuthErrorResponse.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — OAuthErrorResponse DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO стандартизированных ошибок OAuth аутентификации
 * - Используется при OAuth login / register / token exchange
 * - Нормализует ошибки разных провайдеров (Google, Yandex, FB, VK)
 * - Provider-agnostic и безопасен для API boundary
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 * - ✅ Provider-normalized
 *
 * @example
 * const err: OAuthErrorResponse = {
 *   error: 'invalid_token',
 *   provider: 'google',
 *   message: 'OAuth access token is invalid or expired',
 *   retryable: false,
 *   timestamp: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Нормализованные типы OAuth ошибок */
export type OAuthErrorType =
  | 'invalid_token'
  | 'expired_token'
  | 'provider_unavailable'
  | 'user_denied'
  | 'invalid_scope'
  | 'account_conflict'
  | 'email_not_verified'
  | 'rate_limited'
  | 'unknown_error';

/** OAuth провайдер */
export type OAuthProvider = 'google' | 'yandex' | 'facebook' | 'vk';

/** DTO ошибки OAuth */
export type OAuthErrorResponse = {
  /** Нормализованный код ошибки */
  readonly error: OAuthErrorType;

  /** OAuth провайдер */
  readonly provider?: OAuthProvider;

  /** Человеко-читаемое описание (без утечки чувствительных данных) */
  readonly message?: string;

  /** Можно ли повторить операцию */
  readonly retryable?: boolean;

  /** HTTP статус (если используется на API boundary) */
  readonly statusCode?: number;

  /** Оригинальный код ошибки провайдера (для логов) */
  readonly providerErrorCode?: string;

  /** Идентификатор запроса / корреляции */
  readonly correlationId?: string;

  /** Временная метка ошибки (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Дополнительный контекст:
   * - raw provider payload (sanitized)
   * - redirect_uri
   * - scope
   * - oauth flow stage
   */
  readonly context?: Record<string, unknown>;
};
