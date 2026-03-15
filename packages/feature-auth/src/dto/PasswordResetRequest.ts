/**
 * @file packages/feature-auth/src/dto/PasswordResetRequest.ts
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

import type { ClientContext } from '../domain/ClientContext.js';

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
