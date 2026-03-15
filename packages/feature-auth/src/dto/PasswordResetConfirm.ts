/**
 * @file packages/feature-auth/src/dto/PasswordResetConfirm.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — PasswordResetConfirm DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт подтверждения сброса пароля
 * - Token-based подтверждение
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
 * const req: PasswordResetConfirm = {
 *   dtoVersion: '1.0',
 *   token: 'reset-token-from-email',
 *   newPassword: 'new-secure-password',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

import type { ClientContext } from '../domain/ClientContext.js';

/** DTO подтверждения сброса пароля */
export type PasswordResetConfirm = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Токен для подтверждения сброса пароля, выданный сервером */
  readonly token: string;

  /** Новый пароль пользователя (plain-text, должен быть хеширован на сервере, никогда не хранится в plain-text) */
  readonly newPassword: string;

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;

  /** Опциональная ссылка на redirect после успешного сброса */
  readonly redirectUrl?: string;
};
