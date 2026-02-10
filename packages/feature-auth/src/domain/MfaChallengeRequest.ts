/**
 * @file packages/feature-auth/src/domain/MfaChallengeRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — MfaChallengeRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт запроса MFA challenge
 * - Используется при login или sensitive actions
 * - Поддержка TOTP, SMS, Email, Push
 * - Immutable, extensible, microservice-agnostic
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Multi-factor ready
 * - ✅ Security-aware / audit-ready
 *
 * @example
 * const req: MfaChallengeRequest = {
 *   userId: 'user-123',
 *   type: 'totp',
 *   deviceId: 'device-abc',
 *   ip: '1.2.3.4',
 *   userAgent: 'browser',
 *   timestamp: new Date().toISOString(),
 *   meta: { step: 'login' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типы MFA аутентификации */
export type MfaType = 'totp' | 'sms' | 'email' | 'push';

/** DTO запроса MFA challenge */
export type MfaChallengeRequest = {
  /** Идентификатор пользователя, для которого инициируется MFA */
  readonly userId: string;

  /** Тип MFA */
  readonly type: MfaType;

  /** Опциональный идентификатор устройства */
  readonly deviceId?: string;

  /** IP адрес клиента */
  readonly ip?: string;

  /** User agent клиента */
  readonly userAgent?: string;

  /** Временная метка (ISO string) */
  readonly timestamp?: string;

  /** Дополнительные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
