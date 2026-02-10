/**
 * @file packages/feature-auth/src/domain/MfaBackupCodeRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — MfaBackupCodeRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO для использования резервных (backup) кодов MFA
 * - Используется при восстановлении доступа, когда основной MFA недоступен
 * - Immutable, extensible, безопасный и микросервисно-нейтральный
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Multi-factor recovery ready
 * - ✅ Security-aware / audit-ready
 *
 * @example
 * const req: MfaBackupCodeRequest = {
 *   userId: 'user-123',
 *   backupCode: 'ABCD-EFGH',
 *   deviceId: 'device-abc',
 *   ip: '1.2.3.4',
 *   userAgent: 'browser',
 *   meta: { step: 'recovery' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** DTO запроса использования резервного MFA кода */
export type MfaBackupCodeRequest = {
  /** Идентификатор пользователя */
  readonly userId: string;

  /** Резервный (backup) код MFA */
  readonly backupCode: string;

  /** Идентификатор устройства, если применимо */
  readonly deviceId?: string;

  /** IP адрес клиента */
  readonly ip?: string;

  /** User agent клиента */
  readonly userAgent?: string;

  /** Дополнительные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
