/**
 * @file packages/feature-auth/src/domain/OAuthRegisterRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — OAuthRegisterRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO для регистрации пользователя через сторонние OAuth провайдеры
 * - Поддержка Google, Yandex, Facebook, VK и других
 * - Immutable, extensible, микросервисно-нейтральный
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 * - ✅ Multi-provider OAuth ready
 *
 * @example
 * const req: OAuthRegisterRequest = {
 *   dtoVersion: '1.0',
 *   provider: 'google',
 *   providerToken: 'oauth-access-token',
 *   email: 'user@example.com',
 *   displayName: 'John Doe',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser', locale: 'en-US' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Поддерживаемые OAuth провайдеры */
export type OAuthProvider = 'google' | 'yandex' | 'facebook' | 'vk';

/** DTO запроса OAuth регистрации */
export type OAuthRegisterRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** OAuth провайдер */
  readonly provider: OAuthProvider;

  /** Токен доступа провайдера (access token) */
  readonly providerToken: string;

  /** Email нового пользователя (опционально, зависит от провайдера) */
  readonly email?: string;

  /** Имя или отображаемое имя пользователя */
  readonly displayName?: string;

  /** Дополнительные данные, возвращаемые провайдером */
  readonly providerData?: Record<string, unknown>;

  /** Опциональные данные о клиентском окружении */
  readonly clientContext?: {
    readonly ip?: string;
    readonly deviceId?: string;
    readonly userAgent?: string;
    readonly locale?: string;
    readonly timezone?: string;
    readonly geo?: { lat: number; lng: number; };
    readonly sessionId?: string;
    readonly appVersion?: string;
  };

  /** Опциональные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
