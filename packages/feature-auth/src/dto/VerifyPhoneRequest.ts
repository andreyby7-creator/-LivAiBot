/**
 * @file packages/feature-auth/src/dto/VerifyPhoneRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — VerifyPhoneRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт подтверждения телефона (SMS code)
 * - Token/code-based подтверждение
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
 * const req: VerifyPhoneRequest = {
 *   dtoVersion: '1.0',
 *   phone: '+79991234567',
 *   code: '123456',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', userAgent: 'browser' },
 *   redirectUrl: 'https://app.example.com/onboarding'
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

import type { ClientContext } from '../domain/ClientContext.js';

/** DTO подтверждения телефона */
export type VerifyPhoneRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Телефонный номер в международном формате (E.164) */
  readonly phone: string;

  /** Код подтверждения, выданный через SMS */
  readonly code: string;

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;

  /** Опциональная ссылка для redirect после подтверждения */
  readonly redirectUrl?: string;
};
