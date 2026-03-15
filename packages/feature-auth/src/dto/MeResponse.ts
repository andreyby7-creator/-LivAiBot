/**
 * @file packages/feature-auth/src/dto/MeResponse.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — MeResponse DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO ответа эндпоинта `/me`
 * - Представляет текущего аутентифицированного пользователя
 * - Используется frontend / mobile / SDK
 * - Источник истины для identity, roles и permissions
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Security-safe (без секретов)
 * - ✅ Extensible / future-proof
 * - ✅ API & UX friendly
 *
 * @example
 * const me: MeResponse = {
 *   user: {
 *     id: 'user-123',
 *     email: 'user@example.com',
 *     emailVerified: true,
 *     displayName: 'John Doe'
 *   },
 *   roles: ['user', 'admin'],
 *   permissions: ['profile.read', 'profile.write'],
 *   session: {
 *     sessionId: 'sess-abc',
 *     issuedAt: '2026-02-10T10:00:00Z',
 *     expiresAt: '2026-02-11T10:00:00Z'
 *   }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Базовая информация о пользователе */
export type MeUserInfo = {
  readonly id: string;

  readonly email?: string;
  readonly emailVerified?: boolean;

  readonly phone?: string;
  readonly phoneVerified?: boolean;

  readonly username?: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;

  /** OAuth провайдер, если применимо */
  readonly authProvider?: 'password' | 'oauth';

  /** Статус аккаунта */
  readonly status?: 'active' | 'locked' | 'disabled' | 'pending';

  /** Временные метки */
  readonly createdAt?: string;
  readonly lastLoginAt?: string;
};

/** Информация о текущей сессии */
export type MeSessionInfo = {
  readonly sessionId: string;

  /** IP адрес текущей сессии */
  readonly ip?: string;

  /** Идентификатор устройства */
  readonly deviceId?: string;

  /** User-Agent */
  readonly userAgent?: string;

  /** Время выдачи сессии */
  readonly issuedAt?: string;

  /** Время истечения сессии */
  readonly expiresAt?: string;
};

/** DTO ответа /me */
export type MeResponse = {
  /** Информация о пользователе */
  readonly user: MeUserInfo;

  /** Роли пользователя */
  readonly roles: readonly string[];

  /** Permissions / scopes */
  readonly permissions: readonly string[];

  /** Информация о текущей сессии */
  readonly session?: MeSessionInfo;

  /** Feature flags / capability hints */
  readonly features?: Record<string, boolean>;

  /** Дополнительный контекст (org, tenant, policy hints) */
  readonly context?: Record<string, unknown>;
};
