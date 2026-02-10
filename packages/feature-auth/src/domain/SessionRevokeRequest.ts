/**
 * @file packages/feature-auth/src/domain/SessionRevokeRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — SessionRevokeRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт запроса на отзыв сессии
 * - Используется для logout, invalidation, security audit
 * - Immutable, extensible, microservice-agnostic
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware / audit-ready
 *
 * @example
 * const revoke: SessionRevokeRequest = {
 *   sessionId: 'sess-12345',
 *   deviceId: 'device-abc',
 *   ip: '1.2.3.4',
 *   reason: 'user-initiated',
 *   timestamp: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Причины отзыва сессии */
export type SessionRevokeReason =
  | 'user-initiated'
  | 'admin-initiated'
  | 'security-issue'
  | 'expired'
  | 'unknown';

/** DTO запроса на отзыв сессии */
export type SessionRevokeRequest = {
  /** Уникальный идентификатор сессии */
  readonly sessionId: string;

  /** Опциональный идентификатор устройства, с которого происходит отзыв */
  readonly deviceId?: string;

  /** IP пользователя при отзыве */
  readonly ip?: string;

  /** Причина отзыва */
  readonly reason?: SessionRevokeReason;

  /** Временная метка запроса (ISO string) */
  readonly timestamp?: string;

  /** Дополнительные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
