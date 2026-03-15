/**
 * @file packages/feature-auth/src/dto/TokenPair.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — TokenPair DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт пары токенов для аутентификации
 * - Immutable, secure, future-proof
 * - Используется для Access + Refresh токенов
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware
 *
 * @example
 * const tokens: TokenPair = {
 *   accessToken: 'access-token-here',
 *   refreshToken: 'refresh-token-here',
 *   expiresAt: '2026-12-31T23:59:59Z',
 *   issuedAt: '2026-01-01T00:00:00Z',
 *   scope: ['read', 'write']
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** DTO пары токенов для авторизации */
export type TokenPair = {
  /** JWT или opaque access token */
  readonly accessToken: string;

  /** JWT или opaque refresh token */
  readonly refreshToken: string;

  /** Время истечения access token (ISO 8601) */
  readonly expiresAt: string;

  /** Время выпуска токенов (ISO 8601, опционально) */
  readonly issuedAt?: string;

  /** Дополнительные scope/permissions токена */
  readonly scope?: readonly string[];

  /** Опциональные метаданные, например для аудита или device binding */
  readonly metadata?: Record<string, unknown>;
};
