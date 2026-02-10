/**
 * @file packages/feature-auth/src/domain/RefreshTokenRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — RefreshTokenRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт для обновления access token с использованием refresh token
 * - Поддержка security context (IP, device, session)
 * - Immutable, extensible, future-proof
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 *
 * @example
 * const req: RefreshTokenRequest = {
 *   dtoVersion: '1.0',
 *   refreshToken: 'long-refresh-token-string',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser' },
 *   rotateRefreshToken: true
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

/** DTO запроса обновления токена */
export type RefreshTokenRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Токен для обновления access token */
  readonly refreshToken: string;

  /** Опциональные метаданные клиента для безопасности и аудита */
  readonly clientContext?: ClientContext;

  /** Опциональная флаг-ротация refresh token при выдаче нового access token */
  readonly rotateRefreshToken?: boolean;
};
