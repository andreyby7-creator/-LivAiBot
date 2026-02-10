/**
 * @file packages/feature-auth/src/domain/PasswordResetRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — PasswordResetRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт запроса сброса пароля
 * - Поддержка идентификации по email, username или телефону
 * - Immutable, secure, future-proof
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 *
 * @example
 * const req: PasswordResetRequest<'email'> = {
 *   dtoVersion: '1.0',
 *   identifier: { type: 'email', value: 'user@example.com' },
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Поддерживаемые типы идентификатора для сброса пароля */
export type PasswordResetIdentifierType = 'email' | 'username' | 'phone';

/** Универсальный идентификатор для PasswordReset */
export type PasswordResetIdentifier<T extends PasswordResetIdentifierType = 'email'> = {
  readonly type: T;
  readonly value: string;
};

/** Информация о клиентском окружении */
export type ClientContext = {
  readonly ip?: string;
  readonly deviceId?: string;
  readonly userAgent?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly geo?: { lat: number; lng: number; };
  readonly sessionId?: string;
  readonly appVersion?: string;
};

/** DTO запроса сброса пароля */
export type PasswordResetRequest<T extends PasswordResetIdentifierType = 'email'> = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Идентификатор пользователя */
  readonly identifier: PasswordResetIdentifier<T>;

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;

  /** Опциональная ссылка на redirect после сброса пароля */
  readonly redirectUrl?: string;
};
