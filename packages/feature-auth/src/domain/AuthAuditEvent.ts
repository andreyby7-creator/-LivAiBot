/**
 * @file packages/feature-auth/src/domain/AuthAuditEvent.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — AuthAuditEvent DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Универсальный DTO событий аудита аутентификации
 * - Используется для security logs, compliance, forensics
 * - Поддерживает login, logout, MFA, token, session, risk события
 * - Vendor-agnostic, SIEM-ready
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security & compliance aware
 * - ✅ Audit / SIEM ready
 *
 * @example
 * const event: AuthAuditEvent = {
 *   eventId: 'evt-123',
 *   type: 'login_success',
 *   userId: 'user-123',
 *   clientApp: 'web',
 *   ip: '1.2.3.4',
 *   deviceId: 'device-abc',
 *   geo: { country: 'DE', city: 'Berlin' },
 *   timestamp: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типы событий аутентификации */
export type AuthAuditEventType =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_refresh'
  | 'token_revoked'
  | 'session_revoked'
  | 'mfa_challenge'
  | 'mfa_success'
  | 'mfa_failure'
  | 'password_reset_request'
  | 'password_reset_confirm'
  | 'email_verification'
  | 'phone_verification'
  | 'oauth_login'
  | 'oauth_register'
  | 'risk_detected'
  | 'policy_violation';

/** Геолокационная информация */
export type AuditGeoInfo = {
  readonly country?: string;
  readonly region?: string;
  readonly city?: string;
  readonly lat?: number;
  readonly lng?: number;
};

/** DTO события аудита аутентификации */
export type AuthAuditEvent = {
  /** Уникальный идентификатор события */
  readonly eventId: string;

  /** Тип события */
  readonly type: AuthAuditEventType;

  /** Пользователь (может отсутствовать до идентификации) */
  readonly userId?: string;

  /** Идентификатор сессии */
  readonly sessionId?: string;

  /** Клиентское приложение (web, mobile, api, admin, etc.) */
  readonly clientApp?: string;

  /** IP адрес клиента */
  readonly ip?: string;

  /** Идентификатор устройства */
  readonly deviceId?: string;

  /** User-Agent */
  readonly userAgent?: string;

  /** Геолокация */
  readonly geo?: AuditGeoInfo;

  /** Временная метка события (ISO 8601) */
  readonly timestamp: string;

  /** Risk score (0-100, опционально для risk-based events) */
  readonly riskScore?: number;

  /** Policy ID (для policy violations) */
  readonly policyId?: string;

  /** MFA method (для MFA events) */
  readonly mfaMethod?: string;

  /** Error code (для failure events) */
  readonly errorCode?: string;

  /** Correlation ID для tracing */
  readonly correlationId?: string;

  /**
   * Дополнительный контекст:
   * - error codes
   * - risk score
   * - provider (oauth)
   * - policyId
   * - MFA type
   */
  readonly context?: Record<string, unknown>;
};
