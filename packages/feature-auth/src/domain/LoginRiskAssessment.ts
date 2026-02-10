/**
 * @file packages/feature-auth/src/domain/LoginRiskAssessment.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — LoginRiskAssessment DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO оценки риска аутентификации
 * - Используется при login / refresh / sensitive actions
 * - Основан на IP, геолокации, device fingerprint и сессионном контексте
 * - Risk-engine и vendor agnostic
 * - ⚠️ Конфиденциальность: geo/IP/device данные должны соответствовать GDPR/privacy policy
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security & fraud-aware
 *
 * @example
 * const risk: LoginRiskAssessment = {
 *   userId: 'user-123',
 *   ip: '1.2.3.4',
 *   geo: { country: 'DE', city: 'Berlin', lat: 52.52, lng: 13.405 },
 *   device: {
 *     deviceId: 'device-abc',
 *     fingerprint: 'fp-xyz',
 *     platform: 'web',
 *     os: 'Linux',
 *     browser: 'Chrome'
 *   },
 *   userAgent: 'Mozilla/5.0',
 *   previousSessionId: 'sess-prev',
 *   timestamp: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Геолокационная информация */
export type GeoInfo = {
  readonly country?: string;
  readonly region?: string;
  readonly city?: string;
  readonly lat?: number;
  readonly lng?: number;
};

/** Информация об устройстве и fingerprint */
export type DeviceRiskInfo = {
  /** Стабильный идентификатор устройства */
  readonly deviceId?: string;

  /** Device fingerprint / hash */
  readonly fingerprint?: string;

  /** Платформа клиента */
  readonly platform?: 'web' | 'ios' | 'android' | 'desktop';

  /** Операционная система */
  readonly os?: string;

  /** Браузер или клиент */
  readonly browser?: string;

  /** Версия приложения / клиента */
  readonly appVersion?: string;
};

/** DTO оценки риска логина */
export type LoginRiskAssessment = {
  /** Пользователь (может отсутствовать до идентификации) */
  readonly userId?: string;

  /** IP адрес клиента */
  readonly ip?: string;

  /** Геолокация (IP / GPS / provider) */
  readonly geo?: GeoInfo;

  /** Информация об устройстве */
  readonly device?: DeviceRiskInfo;

  /** User-Agent клиента */
  readonly userAgent?: string;

  /** Предыдущая сессия (если есть) */
  readonly previousSessionId?: string;

  /** Временная метка события (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Дополнительные сигналы риска:
   * - ASN
   * - VPN / Proxy / TOR
   * - Velocity anomalies
   * - Reputation score
   * - External risk vendors
   */
  readonly signals?: Record<string, unknown>;
};
