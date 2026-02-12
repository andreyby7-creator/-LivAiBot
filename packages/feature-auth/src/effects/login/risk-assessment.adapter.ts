/**
 * @file packages/feature-auth/src/effects/login/risk-assessment.adapter.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Assessment Adapter
 * ============================================================================
 *
 * Архитектурная роль:
 * - Адаптер между domain и DTO слоями
 * - Преобразование типизированных signals в Record для DTO
 * - Защита от утечки sensitive данных
 *
 * Принципы:
 * - ✅ Adapter pattern — изоляция domain от transport
 * - ✅ Security-first — фильтрация sensitive данных
 * - ✅ Single responsibility — только трансформация
 */

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
const SIGNALS_WHITELIST: readonly (keyof RiskSignals)[] = [
  'isVpn',
  'isTor',
  'isProxy',
  'asn',
  'reputationScore',
  'velocityScore',
  'previousGeo',
] as const;

/* ============================================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Безопасно получает значение поля из signals (защита от object injection)
 * Использует whitelist для проверки поля
 */
function getSignalValueSafely(
  signals: RiskSignals,
  field: keyof RiskSignals,
): unknown {
  // Безопасный доступ через switch (защита от object injection)
  switch (field) {
    case 'isVpn':
      return signals.isVpn;
    case 'isTor':
      return signals.isTor;
    case 'isProxy':
      return signals.isProxy;
    case 'asn':
      return signals.asn;
    case 'reputationScore':
      return signals.reputationScore;
    case 'velocityScore':
      return signals.velocityScore;
    case 'previousGeo':
      return signals.previousGeo;
    default:
      return undefined;
  }
}

/**
 * Безопасно присваивает значение в record (защита от object injection)
 * Использует whitelist для проверки поля
 */
function assignSignalValueSafely(
  record: Record<string, unknown>,
  field: keyof RiskSignals,
  value: unknown,
): void {
  // Безопасное присваивание через switch (защита от object injection)
  switch (field) {
    case 'isVpn':
      Object.assign(record, { isVpn: value });
      break;
    case 'isTor':
      Object.assign(record, { isTor: value });
      break;
    case 'isProxy':
      Object.assign(record, { isProxy: value });
      break;
    case 'asn':
      Object.assign(record, { asn: value });
      break;
    case 'reputationScore':
      Object.assign(record, { reputationScore: value });
      break;
    case 'velocityScore':
      Object.assign(record, { velocityScore: value });
      break;
    case 'previousGeo':
      Object.assign(record, { previousGeo: value });
      break;
  }
}

/**
 * Runtime-check для signals: гарантирует отсутствие функций или символов
 * Проверяет JSON-serializable перед передачей в DTO
 *
 * @param value - Значение для проверки
 * @throws Error если значение содержит функции или символы
 */
function assertJsonSerializable(value: unknown, fieldName: string): void {
  if (value === undefined || value === null) {
    return;
  }

  // Проверка на функции
  if (typeof value === 'function') {
    throw new Error(`Field "${fieldName}" contains a function, which is not JSON-serializable`);
  }

  // Проверка на символы
  if (typeof value === 'symbol') {
    throw new Error(`Field "${fieldName}" contains a symbol, which is not JSON-serializable`);
  }

  // Проверка на циклические ссылки через JSON.stringify
  try {
    JSON.stringify(value);
  } catch (error) {
    throw new Error(
      `Field "${fieldName}" is not JSON-serializable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** Преобразует DeviceInfo в DeviceRiskInfo */
function mapDeviceInfoToRiskInfo(deviceInfo: DeviceInfo): DeviceRiskInfo {
  const platform = determinePlatformFromOS(deviceInfo.os, deviceInfo.deviceType);

  return {
    deviceId: deviceInfo.deviceId,
    ...(platform !== undefined && { platform }),
    ...(deviceInfo.os !== undefined && { os: deviceInfo.os }),
    ...(deviceInfo.browser !== undefined && { browser: deviceInfo.browser }),
    ...(deviceInfo.appVersion !== undefined && { appVersion: deviceInfo.appVersion }),
  };
}

/** Определяет platform из OS, а не из deviceType (FAANG best practice) */
function determinePlatformFromOS(
  os: string | undefined,
  deviceType: DeviceInfo['deviceType'],
): DeviceRiskInfo['platform'] {
  if (os === undefined) {
    return deviceType === 'desktop' ? 'desktop' : 'web';
  }

  const osLower = os.toLowerCase();

  if (osLower.includes('ios') || osLower.includes('iphone') || osLower.includes('ipad')) {
    return 'ios';
  }

  if (osLower.includes('android')) {
    return 'android';
  }

  if (osLower.includes('windows') || osLower.includes('macos') || osLower.includes('linux')) {
    return 'desktop';
  }

  return 'web';
}

/**
 * Plugin hook для кастомных полей DTO
 * Позволяет расширять signals mapping без изменения core logic
 *
 * @requirements Production-safe usage:
 * - Детерминированность: одинаковый вход → одинаковый выход (без side-effects, без внешних зависимостей)
 * - Соблюдение whitelist: добавляемые поля должны быть безопасными для DTO (JSON-serializable)
 * - Безопасность: не должен добавлять sensitive данные или externalSignals
 * - Идемпотентность: повторный вызов с теми же параметрами должен давать тот же результат
 *
 * @example
 * const customMapper: SignalsMapperPlugin = (signals, baseRecord) => {
 *   // Детерминированное расширение: добавляем только безопасные поля
 *   return {
 *     ...baseRecord,
 *     customField: signals.someSafeField, // только whitelist-поля
 *   };
 * };
 */
export type SignalsMapperPlugin = (
  signals: RiskSignals,
  baseRecord: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * Преобразует типизированные signals в Record для DTO (без externalSignals)
 * Использует динамическую фильтрацию через whitelist для масштабируемости
 *
 * @param signals - Сигналы для преобразования
 * @param mapperPlugin - Опциональный plugin для кастомных полей DTO
 *   @requirements Должен быть детерминированным и соблюдать whitelist (см. SignalsMapperPlugin)
 * @returns Record для DTO или undefined
 */
function mapSignalsToRecord(
  signals: RiskSignals | undefined,
  mapperPlugin?: SignalsMapperPlugin,
): Record<string, unknown> | undefined {
  if (signals === undefined) {
    return undefined;
  }

  const record: Record<string, unknown> = {};

  // Динамическая фильтрация через whitelist (масштабируется на >50 сигналов)
  // Безопасный доступ: итерируемся только по whitelist (защита от object injection)
  for (const field of SIGNALS_WHITELIST) {
    // Безопасный доступ: получаем значение через helper функцию
    const value = getSignalValueSafely(signals, field);
    if (value !== undefined) {
      // Runtime-check: гарантируем отсутствие функций или символов
      assertJsonSerializable(value, field);
      // Безопасное присваивание через helper функцию
      assignSignalValueSafely(record, field, value);
    }
  }

  // Применяем plugin для кастомных полей (если передан)
  // @note mapperPlugin должен быть детерминированным и соблюдать whitelist для production-safe usage
  const finalRecord = mapperPlugin ? mapperPlugin(signals, record) : record;

  // externalSignals НЕ пробрасываются в assessment DTO для безопасности
  // Они используются только для внутренних расчетов

  return Object.keys(finalRecord).length > 0 ? finalRecord : undefined;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Строит LoginRiskAssessment объект из domain данных
 *
 * @param deviceInfo - Информация об устройстве
 * @param context - Контекст для assessment
 * @param mapperPlugin - Опциональный plugin для кастомных полей signals DTO
 *   @requirements Production-safe: детерминированный, соблюдает whitelist, без side-effects
 *   Должен быть идемпотентным: одинаковый вход → одинаковый выход
 * @returns LoginRiskAssessment DTO
 */
export function buildAssessment(
  deviceInfo: DeviceInfo,
  context: {
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
  mapperPlugin?: SignalsMapperPlugin,
): LoginRiskAssessment {
  const device = mapDeviceInfoToRiskInfo(deviceInfo);
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
