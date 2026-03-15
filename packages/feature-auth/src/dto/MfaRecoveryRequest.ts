/**
 * @file packages/feature-auth/src/dto/MfaRecoveryRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — MfaRecoveryRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO восстановления доступа при потере MFA устройства
 * - Используется в recovery flow (backup codes, support, identity proof)
 * - Может инициировать сброс / переинициализацию MFA
 * - Vendor- и implementation-agnostic
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security & fraud-aware
 * - ✅ Audit-ready
 *
 * @example
 * const req: MfaRecoveryRequest = {
 *   userId: 'user-123',
 *   method: 'backup_code',
 *   proof: { backupCode: 'ABCD-EFGH' },
 *   ip: '1.2.3.4',
 *   deviceId: 'new-device',
 *   userAgent: 'browser',
 *   timestamp: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Методы восстановления MFA */
export type MfaRecoveryMethod =
  | 'backup_code'
  | 'email_verification'
  | 'sms_verification'
  | 'support_assisted';

/** Доказательство владения аккаунтом */
export type MfaRecoveryProof = {
  /** Backup code */
  readonly backupCode?: string;

  /** Email verification token */
  readonly emailToken?: string;

  /** SMS verification code */
  readonly smsCode?: string;

  /** Идентификатор тикета поддержки */
  readonly supportTicketId?: string;

  /** Расширяемые доказательства */
  readonly meta?: Record<string, unknown>;
};

/** DTO запроса восстановления MFA */
export type MfaRecoveryRequest = {
  /** Идентификатор пользователя */
  readonly userId: string;

  /** Метод восстановления */
  readonly method: MfaRecoveryMethod;

  /** Доказательство владения аккаунтом */
  readonly proof: MfaRecoveryProof;

  /** IP адрес клиента */
  readonly ip?: string;

  /** Идентификатор нового устройства */
  readonly deviceId?: string;

  /** User-Agent клиента */
  readonly userAgent?: string;

  /** Временная метка запроса (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Дополнительный контекст:
   * - risk score
   * - manual override flags
   * - admin approvals
   */
  readonly context?: Record<string, unknown>;
};
