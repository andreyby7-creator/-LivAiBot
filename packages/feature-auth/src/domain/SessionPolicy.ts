/**
 * @file packages/feature-auth/src/domain/SessionPolicy.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — SessionPolicy DTO
 * ============================================================================
 * Архитектурная роль:
 * - DTO политик управления сессиями пользователя
 * - Ограничения по IP, географии, устройствам
 * - Контроль количества и времени жизни сессий
 * - Используется при login, refresh, risk evaluation
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware / enterprise-ready
 *
 * @example
 * const policy: SessionPolicy = {
 *   maxConcurrentSessions: 3,
 *   ipPolicy: {
 *     allow: ['192.168.0.0/16'],
 *     deny: ['10.0.0.0/8']
 *   },
 *   requireSameIpForRefresh: true,
 *   sessionTtlSeconds: 60 * 60 * 24,
 *   idleTimeoutSeconds: 60 * 30
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Политика IP-адресов */
export type IpPolicy = {
  /** Разрешённые IP / CIDR */
  readonly allow?: readonly string[];

  /** Запрещённые IP / CIDR */
  readonly deny?: readonly string[];
};

/** Политика географических ограничений */
export type GeoPolicy = {
  /** Разрешённые страны (ISO-2) */
  readonly allowCountries?: readonly string[];

  /** Запрещённые страны (ISO-2) */
  readonly denyCountries?: readonly string[];
};

/** Политика управления сессиями */
export type SessionPolicy = {
  /** Максимальное количество одновременных сессий */
  readonly maxConcurrentSessions?: number;

  /** Политика IP ограничений */
  readonly ipPolicy?: IpPolicy;

  /** Географические ограничения */
  readonly geoPolicy?: GeoPolicy;

  /** Требовать тот же IP для refresh token */
  readonly requireSameIpForRefresh?: boolean;

  /** Требовать тот же device fingerprint */
  readonly requireSameDeviceForRefresh?: boolean;

  /** TTL сессии (в секундах) */
  readonly sessionTtlSeconds?: number;

  /** Таймаут неактивности (idle timeout, сек) */
  readonly idleTimeoutSeconds?: number;

  /** Принудительное завершение старых сессий при превышении лимита */
  readonly revokeOldestOnLimitExceeded?: boolean;

  /** Дополнительные extensible метаданные */
  readonly meta?: Record<string, unknown>;
};
