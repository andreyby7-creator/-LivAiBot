/**
 * @file packages/feature-auth/src/domain/LogoutRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — LogoutRequest DTO
 * ============================================================================
 * Архитектурная роль:
 * - Типизированный контракт запроса выхода из системы
 * - Опциональная передача refresh token для безопасного инвалидирования
 * - Поддержка клиентского контекста (IP, device, session)
 * - Immutable, future-proof и extensible
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 *
 * @example
 * const req: LogoutRequest = {
 *   dtoVersion: '1.0',
 *   refreshToken: 'optional-refresh-token',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', sessionId: 'session-123' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

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

/** DTO запроса выхода из системы */
export type LogoutRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Опциональный refresh token для инвалидирования */
  readonly refreshToken?: string;

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;
};
