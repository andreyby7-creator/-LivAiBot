/**
 * @file packages/feature-auth/src/domain/MfaSetupRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — MfaSetupRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт для настройки MFA для пользователя
 * - Поддержка TOTP, SMS, Email, Push
 * - Секреты и методы конфигурируются через DTO
 * - Immutable, extensible, микросервисно-нейтральный
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
 * const req: MfaSetupRequest = {
 *   userId: 'user-123',
 *   type: 'totp',
 *   secret: 'base32-secret',
 *   deviceName: 'My iPhone',
 *   deviceId: 'device-abc',
 *   ip: '1.2.3.4',
 *   userAgent: 'browser',
 *   meta: { step: 'enrollment' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типы MFA аутентификации */
export type MfaType = 'totp' | 'sms' | 'email' | 'push';

/** DTO запроса настройки MFA */
export type MfaSetupRequest = {
  /** Идентификатор пользователя */
  readonly userId: string;

  /** Тип MFA, который настраивается */
  readonly type: MfaType;

  /** Секрет или токен, необходимый для настройки MFA (например, base32 для TOTP) */
  readonly secret?: string;

  /** Читаемое имя устройства (для push / sms, для отображения пользователю) */
  readonly deviceName?: string;

  /** Идентификатор устройства, если применимо */
  readonly deviceId?: string;

  /** IP адрес клиента */
  readonly ip?: string;

  /** User agent клиента */
  readonly userAgent?: string;

  /** Дополнительные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
