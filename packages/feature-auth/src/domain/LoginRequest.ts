/**
 * @file packages/feature-auth/src/domain/LoginRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — LoginRequest DTO
 * ============================================================================
 * Архитектурная роль:
 * - Типизированный контракт запроса login
 * - Поддержка email, username, phone, oauth
 * - Multi-factor authentication (MFA)
 * - Устойчивый и микросервисно-нейтральный
 * - Immutable, future-proof и extensible
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Extensible / future-proof
 * - ✅ Immutable / readonly
 * - ✅ Multi-factor ready
 * - ✅ Security aware
 *
 * @example
 * // Email login
 * const req: LoginRequest<'email'> = {
 *   dtoVersion: '1.0',
 *   identifier: { type: 'email', value: 'user@example.com' },
 *   password: 'plain-text-password', // ⚠️ Передавать только по HTTPS, хешируется на сервере
 *   mfa: { type: 'totp', token: '123456' },
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser', locale: 'en-US' },
 *   rememberMe: true
 * };
 * // OAuth login
 * const oauthReq: LoginRequest<'oauth'> = {
 *   dtoVersion: '1.0',
 *   identifier: { type: 'oauth', value: 'user-oauth-id' },
 *   provider: 'google',
 *   providerToken: 'oauth-access-token',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc' }
 * };
 */

import type { ClientContext } from './ClientContext.js';
import type { MfaInfo } from './MfaInfo.js';

/* ============================================================================
* 🧭 TYPES
* ============================================================================
*/

/** Поддерживаемые типы идентификатора для login */
export type LoginIdentifierType = 'email' | 'username' | 'phone' | 'oauth';

/** Универсальный идентификатор пользователя */
export type LoginIdentifier<T extends LoginIdentifierType = 'email'> = {
  readonly type: T;
  readonly value: string;
};

/** Базовые поля для всех типов login запросов */
type LoginRequestBase = {
  readonly dtoVersion?: '1.0' | '1.1';
  readonly mfa?: MfaInfo | MfaInfo[];
  readonly clientContext?: ClientContext;
  readonly rememberMe?: boolean;
};

/** Login запрос для OAuth (provider и providerToken обязательны) */
type LoginRequestOAuth = LoginRequestBase & {
  readonly identifier: LoginIdentifier<'oauth'>;
  readonly provider: string;
  readonly providerToken: string;
};

/** Login запрос для не-OAuth типов (email, username, phone) */
type LoginRequestNonOAuth<T extends 'email' | 'username' | 'phone' = 'email'> = LoginRequestBase & {
  readonly identifier: LoginIdentifier<T>;
  readonly password?: string;
};

/** DTO запроса login (discriminated union) */
export type LoginRequest<T extends LoginIdentifierType = 'email'> = T extends 'oauth'
  ? LoginRequestOAuth
  : T extends 'email' | 'username' | 'phone' ? LoginRequestNonOAuth<T>
  : never;
