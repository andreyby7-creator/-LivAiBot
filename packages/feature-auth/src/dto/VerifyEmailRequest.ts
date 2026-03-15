/**
 * @file packages/feature-auth/src/dto/VerifyEmailRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — VerifyEmailRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт подтверждения email
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
 * const req: VerifyEmailRequest = {
 *   dtoVersion: '1.0',
 *   token: 'confirmation-token-from-email',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

import type { ClientContext } from '../domain/ClientContext.js';

/** DTO подтверждения email */
export type VerifyEmailRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Токен для подтверждения email, выданный сервером */
  readonly token: string;

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;

  /** Опциональная ссылка для redirect после подтверждения */
  readonly redirectUrl?: string;
};
