/**
 * @file packages/feature-auth/src/domain/DeviceInfo.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — DeviceInfo DTO
 * ============================================================================
 * Архитектурная роль:
 * - Типизированный контракт информации об устройстве для аудита
 * - Используется для логирования, оценки риска и MFA
 * - Immutable, extensible, security-aware
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware / audit-ready
 *
 * @example
 * const device: DeviceInfo = {
 *   deviceId: 'device-abc',
 *   deviceType: 'desktop',
 *   os: 'Windows 11',
 *   browser: 'Chrome 112',
 *   ip: '1.2.3.4',
 *   geo: { lat: 55.7558, lng: 37.6173 },
 *   userAgent: 'Mozilla/5.0 ...',
 *   appVersion: '1.0.3',
 *   lastUsedAt: new Date().toISOString()
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Тип устройства */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'iot' | 'unknown';

/** DTO информации об устройстве для аудита и security */
export type DeviceInfo = {
  /** Уникальный идентификатор устройства */
  readonly deviceId: string;

  /** Тип устройства */
  readonly deviceType: DeviceType;

  /** Операционная система устройства */
  readonly os?: string;

  /** Браузер или клиент */
  readonly browser?: string;

  /** IP адрес устройства */
  readonly ip?: string;

  /** Геолокация устройства */
  readonly geo?: { readonly lat: number; readonly lng: number; };

  /** User Agent устройства */
  readonly userAgent?: string;

  /** Версия приложения / клиента */
  readonly appVersion?: string;

  /** Последнее время использования устройства */
  readonly lastUsedAt?: string; // ISO timestamp
};
