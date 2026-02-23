/**
 * @file packages/feature-auth/src/effects/login/login-risk-assessment.adapter.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Risk Assessment Adapter
 * ============================================================================
 *
 * Архитектурная роль:
 * - Адаптер между domain и DTO слоями для login risk assessment
 * - Преобразование типизированных signals в Record для DTO через @livai/core/projection-engine
 * - Нормализация DeviceInfo → DeviceRiskInfo (normalization step для DTO projection)
 * - Защита от утечки sensitive данных через whitelist + allowed namespace
 *
 * Принципы:
 * - ✅ Adapter pattern — изоляция domain от transport
 * - ✅ Security-first — фильтрация sensitive данных через whitelist + allowed namespace
 * - ✅ Extensibility — plugin может добавлять поля с префиксом `custom_` для расширения DTO
 * - ✅ Single responsibility — только трансформация и normalization
 * - ✅ Generic projection — использует transformDomainToDto из @livai/core
 */

import type { DtoSchema, JsonValue } from '@livai/core';
import { transformDomainToDto } from '@livai/core';

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { DeviceRiskInfo, LoginRiskAssessment } from '../../domain/LoginRiskAssessment.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типизированные сигналы риска (domain layer) */
export type RiskSignals = {
  readonly isVpn?: boolean;
  readonly isTor?: boolean;
  readonly isProxy?: boolean;
  readonly asn?: string;
  readonly reputationScore?: number;
  readonly velocityScore?: number;
  readonly previousGeo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  /** Внутренние сигналы (НЕ пробрасываются в DTO) */
  readonly externalSignals?: Readonly<Record<string, unknown>>;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/**
 * Whitelist полей signals для передачи в DTO
 * Динамическая фильтрация для масштабируемости (>50 сигналов)
 * externalSignals НЕ включается в whitelist для безопасности
 */
const SIGNALS_WHITELIST_ARRAY: readonly string[] = [
  'isVpn',
  'isTor',
  'isProxy',
  'asn',
  'reputationScore',
  'velocityScore',
  'previousGeo',
] as const;

/**
 * Set для безопасной проверки whitelist полей (защита от object injection)
 */
const SIGNALS_WHITELIST = new Set<string>(SIGNALS_WHITELIST_ARRAY);

/**
 * Префикс для полей, которые plugin может добавлять в DTO
 * @note Поля с этим префиксом разрешены в enforceWhitelist для extensibility
 */
const ALLOWED_PLUGIN_PREFIX = 'custom_';

/**
 * DTO Schema для RiskSignals
 * Используется с transformDomainToDto из @livai/core/input-boundary/projection-engine
 */
const RISK_SIGNALS_SCHEMA: DtoSchema<RiskSignals> = Object.freeze({
  fields: SIGNALS_WHITELIST_ARRAY,
  mapper: (domain: RiskSignals, fieldName: string): unknown => {
    // Безопасный доступ через switch (защита от object injection)
    switch (fieldName) {
      case 'isVpn':
        return domain.isVpn;
      case 'isTor':
        return domain.isTor;
      case 'isProxy':
        return domain.isProxy;
      case 'asn':
        return domain.asn;
      case 'reputationScore':
        return domain.reputationScore;
      case 'velocityScore':
        return domain.velocityScore;
      case 'previousGeo':
        return domain.previousGeo;
      default:
        return undefined;
    }
  },
});

/* ============================================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Нормализует DeviceInfo для risk assessment (normalization step для DTO projection)
 * @note Normalization step, не бизнес-логика. Определяет platform из OS
 */
function normalizeDeviceForRisk(
  deviceInfo: DeviceInfo, // Информация об устройстве (нормализуется в DeviceRiskInfo)
): DeviceRiskInfo { // DeviceRiskInfo с нормализованным platform
  const os = deviceInfo.os?.toLowerCase();

  let platform: DeviceRiskInfo['platform'];

  if (os === undefined || os === '') {
    platform = deviceInfo.deviceType === 'desktop' ? 'desktop' : 'web';
  } else if (os.includes('ios') || os.includes('iphone') || os.includes('ipad')) {
    platform = 'ios';
  } else if (os.includes('android')) {
    platform = 'android';
  } else if (
    os.includes('windows')
    || os.includes('macos')
    || os.includes('linux')
  ) {
    platform = 'desktop';
  } else {
    platform = 'web';
  }

  return {
    deviceId: deviceInfo.deviceId,
    platform,
    ...(deviceInfo.os !== undefined && deviceInfo.os !== '' && { os: deviceInfo.os }),
    ...(deviceInfo.browser !== undefined
      && deviceInfo.browser !== ''
      && { browser: deviceInfo.browser }),
    ...(deviceInfo.appVersion !== undefined
      && deviceInfo.appVersion !== ''
      && { appVersion: deviceInfo.appVersion }),
  };
}

/**
 * Применяет whitelist фильтрацию к record после plugin
 * @security Защищает от malicious plugin, разрешает расширение через `custom_` префикс
 * @note Base whitelist поля защищены от удаления (перезапись заблокирована на этапе merge)
 */
function enforceWhitelist(
  record: Record<string, unknown>, // Record после merge (base поля защищены, может содержать malicious keys)
): Record<string, unknown> { // Отфильтрованный record (только whitelist + custom_ поля)
  // Фильтруем только whitelist поля и разрешенные plugin поля
  // Используем Object.fromEntries для безопасной фильтрации (защита от object injection)
  const filteredEntries = Object.entries(record).filter(([key]) => {
    // Base whitelist поля всегда разрешены (защищены от удаления)
    if (typeof key === 'string' && SIGNALS_WHITELIST.has(key)) {
      return true;
    }
    // Plugin может добавлять поля с префиксом custom_ для extensibility
    if (typeof key === 'string' && key.startsWith(ALLOWED_PLUGIN_PREFIX)) {
      return true;
    }
    // Все остальные поля (включая externalSignals, malicious keys) удаляются
    return false;
  });

  return Object.fromEntries(filteredEntries);
}

/**
 * Plugin hook для кастомных полей DTO
 * @requirements Детерминированность, идемпотентность, immutability (baseRecord frozen)
 * @security Base whitelist поля защищены от перезаписи/удаления, разрешены только `custom_` поля
 * @example
 * const mapper: SignalsMapperPlugin = (signals, baseRecord) => ({
 *   ...baseRecord,
 *   customVendorId: 'vendor-123', // разрешено
 *   // isVpn: false, // игнорируется: защищено от перезаписи
 * });
 */
export type SignalsMapperPlugin = (
  signals: RiskSignals, // Сигналы для преобразования
  baseRecord: Record<string, unknown>, // Frozen copy базового record (не мутировать)
) => Record<string, unknown>; // Расширенный record (может содержать custom_ поля)

/**
 * Преобразует типизированные signals в Record для DTO (без externalSignals)
 * @security Base whitelist поля защищены от перезаписи/удаления, plugin может добавлять `custom_` поля
 */
function mapSignalsToRecord(
  signals: RiskSignals | undefined, // Сигналы для преобразования
  mapperPlugin?: SignalsMapperPlugin, // Опциональный plugin для кастомных полей DTO (должен быть детерминированным)
): Record<string, unknown> | undefined { // Record для DTO или undefined
  if (signals === undefined) {
    return undefined;
  }

  // Используем transformDomainToDto из @livai/core для безопасной трансформации
  const transformResult = transformDomainToDto<RiskSignals, Record<string, JsonValue>>(
    signals,
    RISK_SIGNALS_SCHEMA,
    [], // Без projection slots (можно добавить в будущем для расширяемости)
    {}, // Без контекста
  );

  // Если трансформация не удалась, возвращаем undefined
  if (!transformResult.ok) {
    // В production можно логировать ошибку, но для адаптера возвращаем undefined
    return undefined;
  }

  let record = transformResult.value as Record<string, unknown>;

  // Применяем plugin для кастомных полей (если передан)
  if (mapperPlugin) {
    const pluginResult = mapperPlugin(signals, Object.freeze({ ...record }));

    // Защищаем base whitelist поля от перезаписи: мержим, но игнорируем whitelist поля из pluginResult
    // Используем Object.fromEntries для безопасного мержа (защита от object injection)
    const pluginEntries = Object.entries(pluginResult).filter(([key]) => {
      // Игнорируем whitelist поля из pluginResult (защита от перезаписи)
      return typeof key === 'string' && !SIGNALS_WHITELIST.has(key);
    });
    record = { ...record, ...Object.fromEntries(pluginEntries) };
  }

  // Применяем whitelist фильтрацию: защита от malicious plugin, разрешены только whitelist + custom_ поля
  record = enforceWhitelist(record);

  // externalSignals не пробрасываются в DTO (используются только для внутренних расчетов)
  return Object.values(record).some((v) => v !== undefined) ? record : undefined;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Строит LoginRiskAssessment объект из domain данных
 * @security Base whitelist поля защищены, plugin может добавлять `custom_` поля
 */
export function buildAssessment(
  deviceInfo: DeviceInfo, // Информация об устройстве (нормализуется в DeviceRiskInfo)
  context: { // Контекст для assessment (IP, geo, signals, timestamp)
    readonly userId?: string;
    readonly ip?: string;
    readonly geo?: {
      readonly country?: string;
      readonly region?: string;
      readonly city?: string;
      readonly lat?: number;
      readonly lng?: number;
    };
    readonly userAgent?: string;
    readonly previousSessionId?: string;
    readonly timestamp?: string;
    readonly signals?: RiskSignals;
  },
  mapperPlugin?: SignalsMapperPlugin, // Опциональный plugin для кастомных полей signals DTO (production-safe: детерминированный, без side-effects)
): LoginRiskAssessment { // LoginRiskAssessment DTO
  const device = normalizeDeviceForRisk(deviceInfo);
  const signalsRecord = mapSignalsToRecord(context.signals, mapperPlugin);

  return {
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.geo !== undefined && { geo: context.geo }),
    device,
    ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
    ...(context.previousSessionId !== undefined && {
      previousSessionId: context.previousSessionId,
    }),
    ...(context.timestamp !== undefined && { timestamp: context.timestamp }),
    ...(signalsRecord !== undefined && { signals: signalsRecord }),
  };
}
