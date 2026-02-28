/**
 * @file packages/feature-auth/src/domain/RegisterResponse.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — RegisterResponse DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт ответа регистрации
 * - Возвращает токены, MFA вызовы или подтверждение аккаунта
 * - Поддержка OAuth, multi-factor authentication (MFA)
 * - Immutable, extensible, future-proof
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ MFA-ready
 * - ✅ OAuth-ready
 * - ✅ Extensible / future-proof
 *
 * @example
 * // Стандартная регистрация с паролем
 * const resp: RegisterResponse<'email'> = {
 *   dtoVersion: '1.0',
 *   userId: 'user-123',
 *   tokenPair: { accessToken: 'abc', refreshToken: 'xyz', expiresAt: '2026-12-31T23:59:59Z' },
 *   mfaRequired: false
 * };
 *
 * // MFA required
 * const mfaResp: RegisterResponse<'email'> = {
 *   dtoVersion: '1.0',
 *   userId: 'user-456',
 *   mfaChallenge: { type: 'totp', secret: 'xxxxxx' },
 *   mfaRequired: true
 * };
 *
 * // OAuth регистрация
 * const oauthResp: RegisterResponse<'oauth'> = {
 *   dtoVersion: '1.0',
 *   userId: 'oauth-789',
 *   tokenPair: { accessToken: 'abc', refreshToken: 'xyz', expiresAt: '2026-12-31T23:59:59Z' },
 *   provider: 'google'
 * };
 */

import type { MfaInfo } from './MfaInfo.js';
import type { TokenPair } from './TokenPair.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** DTO ответа регистрации */
export type RegisterResponse<T extends 'email' | 'username' | 'phone' | 'oauth' = 'email'> = {
  /** Версия DTO для безопасной эволюции */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Уникальный идентификатор пользователя */
  readonly userId: string;

  /** Пара токенов, если регистрация завершена */
  readonly tokenPair?: TokenPair;

  /** MFA challenge, если требуется подтверждение */
  readonly mfaChallenge?: MfaInfo | MfaInfo[];

  /** Флаг, показывающий, нужно ли пройти MFA */
  readonly mfaRequired: boolean;

  /** Только для OAuth идентификаторов */
  readonly provider?: T extends 'oauth' ? string : never;

  /** Опциональная информация о клиентском окружении */
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
};
