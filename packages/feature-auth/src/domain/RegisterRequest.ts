/**
 * @file packages/feature-auth/src/domain/RegisterRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — RegisterRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт запроса регистрации нового пользователя
 * - Поддержка email, username, phone, oauth
 * - Multi-factor authentication (MFA)
 * - Устойчивый и микросервисно-нейтральный
 * - Immutable, future-proof и extensible
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Extensible / future-proof
 * - ✅ Immutable / readonly
 * - ✅ Multi-factor ready
 * - ✅ Security aware
 *
 * @example
 * // Email/username registration
 * const req: RegisterRequest<'email'> = {
 *   dtoVersion: '1.0',
 *   identifier: { type: 'email', value: 'user@example.com' },
 *   username: 'user123',
 *   password: 'plain-text-password',
 *   mfa: { type: 'totp', token: '123456' },
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser', locale: 'en-US' }
 * };
 *
 * // OAuth registration
 * const oauthReq: RegisterRequest<'oauth'> = {
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

/** Поддерживаемые типы идентификатора для регистрации */
export type RegisterIdentifierType = 'email' | 'username' | 'phone' | 'oauth';

/** Универсальный идентификатор пользователя */
export type RegisterIdentifier<T extends RegisterIdentifierType = 'email'> = {
  readonly type: T;
  readonly value: string;
};

/** DTO запроса регистрации */
export type RegisterRequest<T extends RegisterIdentifierType = 'email'> = {
  /** Версия DTO для безопасной эволюции API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Идентификатор пользователя */
  readonly identifier: RegisterIdentifier<T>;

  /** Username (опционально для email/phone registration) */
  readonly username?: T extends 'email' | 'phone' ? string : never;

  /** Пароль пользователя (plain-text, должен быть хеширован на сервере) */
  readonly password?: T extends 'oauth' ? never : string;

  /** Имя workspace для регистрации (обязательно для email/username/phone registration) */
  readonly workspaceName?: T extends 'oauth' ? never : string;

  /** Multi-factor authentication */
  readonly mfa?: MfaInfo | MfaInfo[];

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;

  /** Запрос "запомнить устройство" */
  readonly rememberMe?: boolean;

  /** Только для OAuth идентификаторов */
  readonly provider?: T extends 'oauth' ? string : never;
  readonly providerToken?: T extends 'oauth' ? string : never;
};
