/**
 * @file packages/feature-auth/src/dto/OAuthLoginRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — OAuthLoginRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO для аутентификации через сторонние OAuth провайдеры
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
 * const req: OAuthLoginRequest = {
 *   dtoVersion: '1.0',
 *   provider: 'google',
 *   providerToken: 'oauth-access-token', // ⚠️ Передавать только по HTTPS, временный токен
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser', locale: 'en-US' }
 * };
 */

import type { OAuthProvider } from '../contracts/OAuthErrorResponse.js';
import type { ClientContext } from '../domain/ClientContext.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** DTO запроса OAuth login */
export type OAuthLoginRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** OAuth провайдер */
  readonly provider: OAuthProvider;

  /** Токен доступа провайдера (access token) */
  readonly providerToken: string;

  /** Опциональные данные о клиентском окружении */
  readonly clientContext?: ClientContext;

  /** Опциональные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
