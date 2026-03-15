/**
 * @file packages/feature-auth/src/dto/LogoutRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — LogoutRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт запроса выхода из системы
 * - Опциональная передача refresh token для безопасного инвалидирования
 * - Поддержка клиентского контекста (IP, device, session)
 * - Immutable, future-proof и extensible
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 *
 * @example
 * const req: LogoutRequest = {
 *   dtoVersion: '1.0',
 *   refreshToken: 'optional-refresh-token',
 *   clientContext: { ip: '1.2.3.4', deviceId: 'device-abc', sessionId: 'session-123' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

import type { ClientContext } from '../domain/ClientContext.js';

/** DTO запроса выхода из системы */
export type LogoutRequest = {
  /** Версия DTO для безопасного evolution API */
  readonly dtoVersion?: '1.0' | '1.1';

  /** Опциональный refresh token для инвалидирования */
  readonly refreshToken?: string;

  /** Опциональные метаданные клиента */
  readonly clientContext?: ClientContext;
};
