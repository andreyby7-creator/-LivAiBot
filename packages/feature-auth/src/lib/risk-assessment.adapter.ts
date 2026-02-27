/**
 * @file packages/feature-auth/src/lib/risk-assessment.adapter.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Assessment Adapter
 * ============================================================================
 *
 * Архитектурная роль:
 * - Адаптер между classification layer и domain layer для risk assessment
 * - Преобразование ClassificationRule → RiskReason с дедупликацией
 * - Нормализация DeviceInfo → DeviceRiskInfo (определение platform из OS)
 * - Валидация и нормализация boundary данных (timestamp, IP, geo координаты)
 * - Создание RiskEvaluation через domain factories
 *
 * Принципы:
 * - ✅ Adapter pattern — изоляция domain от classification/transport слоев
 * - ✅ Security-first — строгая валидация boundary данных (IP через ipaddr.js, timestamp через ISO 8601, geo координаты)
 * - ✅ Extensibility — param object pattern для buildAssessment (легко добавлять новые поля)
 * - ✅ Single responsibility — только трансформация, нормализация и валидация boundary данных
 * - ✅ Domain purity — использует domain factories (createLoginRiskResult, createLoginRiskEvaluation)
 * - ✅ Deterministic — строгая валидация timestamp без fallback (Date.now запрещен)
 * - ✅ Canonical Time Model — ISO 8601 string → epoch ms (number) на boundary
 */

import type { ClassificationRule } from '@livai/domains/strategies';
import { isValid as isValidIpAddress } from 'ipaddr.js';

import type { DeviceInfo } from '../domain/DeviceInfo.js';
import type {
  DeviceRiskInfo,
  LoginRiskContext,
  LoginRiskEvaluation,
  RiskReason,
} from '../domain/LoginRiskAssessment.js';
import {
  createLoginRiskEvaluation,
  createLoginRiskResult,
  DomainValidationError,
  RiskReasonCode,
  RiskReasonType,
} from '../domain/LoginRiskAssessment.js';
import type { RiskLevel } from '../types/auth.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Версия модели по умолчанию для risk assessment */
export const defaultModelVersion = '1.0.0' as const;

/* ============================================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Нормализует DeviceInfo для risk assessment
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
 * Exhaustive mapping: ClassificationRule → RiskReason
 * @note TypeScript enforces completeness: adding new ClassificationRule requires updating this map
 * @note Production-safe: no silent degradation, all rules must be mapped
 */
const RULE_TO_REASON: { readonly [K in ClassificationRule]: RiskReason; } = {
  TOR_NETWORK: { type: RiskReasonType.NETWORK, code: RiskReasonCode.NETWORK.TOR },
  VPN_DETECTED: { type: RiskReasonType.NETWORK, code: RiskReasonCode.NETWORK.VPN },
  PROXY_DETECTED: { type: RiskReasonType.NETWORK, code: RiskReasonCode.NETWORK.PROXY },
  LOW_REPUTATION: { type: RiskReasonType.REPUTATION, code: RiskReasonCode.REPUTATION.LOW },
  CRITICAL_REPUTATION: {
    type: RiskReasonType.REPUTATION,
    code: RiskReasonCode.REPUTATION.CRITICAL,
  },
  HIGH_VELOCITY: {
    type: RiskReasonType.BEHAVIOR,
    code: RiskReasonCode.BEHAVIOR.HIGH_VELOCITY,
  },
  GEO_MISMATCH: { type: RiskReasonType.GEO, code: RiskReasonCode.GEO.IMPOSSIBLE_TRAVEL },
  HIGH_RISK_COUNTRY: { type: RiskReasonType.GEO, code: RiskReasonCode.GEO.HIGH_RISK_COUNTRY },
  UNKNOWN_DEVICE: { type: RiskReasonType.DEVICE, code: RiskReasonCode.DEVICE.UNKNOWN },
  // Rules without direct RiskReason mapping (IoT, missing fields) → map to closest equivalent
  IoT_DEVICE: { type: RiskReasonType.DEVICE, code: RiskReasonCode.DEVICE.UNKNOWN },
  MISSING_OS: { type: RiskReasonType.DEVICE, code: RiskReasonCode.DEVICE.UNKNOWN },
  MISSING_BROWSER: { type: RiskReasonType.DEVICE, code: RiskReasonCode.DEVICE.UNKNOWN },
  HIGH_RISK_SCORE: { type: RiskReasonType.REPUTATION, code: RiskReasonCode.REPUTATION.CRITICAL },
  NEW_DEVICE_VPN: {
    type: RiskReasonType.NETWORK,
    code: RiskReasonCode.NETWORK.VPN,
  },
  IoT_TOR: { type: RiskReasonType.NETWORK, code: RiskReasonCode.NETWORK.TOR },
} as const;

/**
 * Маппит ClassificationRule в RiskReason с устранением дубликатов
 * @note Pure функция, детерминированная
 * @note Exhaustive: TypeScript enforces all ClassificationRule values are mapped
 * @note Дедупликация: устраняет дубликаты по {type, code} для explainability consistency
 *       Например, VPN_DETECTED и NEW_DEVICE_VPN оба маппятся в {type: 'network', code: 'vpn'}
 *       В результате будет только один reason, а не два одинаковых
 */
function mapTriggeredRulesToReasons(
  triggeredRules: readonly ClassificationRule[],
): readonly RiskReason[] {
  // Маппим правила в reasons
  const reasons = triggeredRules.map((rule) => {
    // eslint-disable-next-line security/detect-object-injection -- rule имеет тип ClassificationRule (union type из известных значений), безопасный lookup через Record
    return RULE_TO_REASON[rule];
  });

  // Устраняем дубликаты по {type, code} используя Set с ключом-строкой
  const seen = new Set<string>();
  const uniqueReasons: RiskReason[] = [];

  for (const reason of reasons) {
    // Создаем уникальный ключ из type и code
    const key = `${reason.type}:${reason.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueReasons.push(reason);
    }
  }

  // Runtime защита от мутаций: возвращаем frozen-массив причин
  return Object.freeze(uniqueReasons);
}

/* ============================================================================
 * 🔧 VALIDATION HELPERS
 * ============================================================================
 */

/**
 * Regex для строгой валидации ISO 8601 формата
 * @note Поддерживает форматы: YYYY-MM-DDTHH:mm:ss.sssZ и YYYY-MM-DDTHH:mm:ssZ
 * @note Использует ограниченные квантификаторы для предотвращения ReDoS
 */
// eslint-disable-next-line security/detect-unsafe-regex -- Ограниченные квантификаторы (фиксированная длина), простая структура без вложенных опциональных групп, не подвержен ReDoS
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * Строгая нормализация timestamp на boundary
 * Canonical Time Model:
 * - External boundary (domains) → ISO 8601 string
 * - Internal domain (LoginRiskContext) → epoch ms (number)
 *
 * @note Использует только Date.parse (не new Date())
 * @note Запрещает не-ISO строки через строгую проверку
 * @note Падает на invalid input (никаких fallback)
 * @note Никакого Date.now(), никакого new Date() без проверки
 * @throws {DomainValidationError} Если timestamp невалидный
 */
function validateAndParseTimestamp(timestamp: string | number): number {
  // Если уже number (epoch ms) - валидируем напрямую
  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp)) {
      throw new DomainValidationError(
        `Invalid timestamp: must be finite number (epoch ms), got: ${timestamp}`,
        'timestamp',
        timestamp,
        'TIMESTAMP_INVALID',
      );
    }
    return timestamp;
  }

  // Если string - строгая валидация ISO 8601 формата
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    throw new DomainValidationError(
      `Invalid timestamp: must be non-empty ISO 8601 string or epoch ms number, got: ${
        String(timestamp)
      }`,
      'timestamp',
      timestamp,
      'TIMESTAMP_INVALID_TYPE',
    );
  }

  // Строгая проверка ISO 8601 формата перед парсингом
  if (!ISO_8601_REGEX.test(timestamp)) {
    throw new DomainValidationError(
      `Invalid timestamp format: must be ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ), got: ${timestamp}`,
      'timestamp',
      timestamp,
      'TIMESTAMP_INVALID_FORMAT',
    );
  }

  // Парсинг через Date.parse (единственный допустимый способ)
  const parsed = Date.parse(timestamp);

  // Валидация результата парсинга
  if (!Number.isFinite(parsed)) {
    throw new DomainValidationError(
      `Invalid timestamp: Date.parse returned non-finite value for ISO 8601 string, got: ${timestamp}`,
      'timestamp',
      timestamp,
      'TIMESTAMP_PARSE_FAILED',
    );
  }

  return parsed;
}

/** Константы для валидации координат */
const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LNG = -180;
const MAX_LNG = 180;

/**
 * Валидирует geo координаты
 * @throws {DomainValidationError} Если координаты невалидные
 * @note Не является multi-agent операцией - это pure validation функция
 */
// eslint-disable-next-line @livai/multiagent/agent-isolation -- Это pure validation функция, не multi-agent операция
function validateGeoCoordinates(geo: {
  readonly lat?: number;
  readonly lng?: number;
}): void {
  if (
    geo.lat !== undefined && (!Number.isFinite(geo.lat) || geo.lat < MIN_LAT || geo.lat > MAX_LAT)
  ) {
    throw new DomainValidationError(
      `Invalid geo.lat: must be finite number in range ${MIN_LAT} to ${MAX_LAT}, got: ${geo.lat}`,
      'geo.lat',
      geo.lat,
      'GEO_LAT_INVALID',
    );
  }

  if (
    geo.lng !== undefined && (!Number.isFinite(geo.lng) || geo.lng < MIN_LNG || geo.lng > MAX_LNG)
  ) {
    throw new DomainValidationError(
      `Invalid geo.lng: must be finite number in range ${MIN_LNG} to ${MAX_LNG}, got: ${geo.lng}`,
      'geo.lng',
      geo.lng,
      'GEO_LNG_INVALID',
    );
  }
}

/**
 * Валидирует IP адрес используя ipaddr.js (production-safe, защита от ReDoS)
 * @note Использует библиотеку ipaddr.js вместо regex для предотвращения catastrophic backtracking
 * @note Поддерживает все форматы IPv4 и IPv6 согласно RFC 4291
 * @throws {DomainValidationError} Если IP невалидный
 */
function validateIpAddress(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError(
      'IP address cannot be empty string',
      'ip',
      ip,
      'IP_INVALID',
    );
  }

  try {
    if (!isValidIpAddress(trimmed)) {
      throw new DomainValidationError(
        `Invalid IP address: must be valid IPv4 or IPv6, got: ${trimmed}`,
        'ip',
        trimmed,
        'IP_INVALID',
      );
    }
  } catch (error) {
    // ipaddr.js может выбросить исключение для невалидных адресов
    if (error instanceof DomainValidationError) {
      throw error;
    }
    throw new DomainValidationError(
      `Invalid IP address: parsing failed, got: ${trimmed}`,
      'ip',
      trimmed,
      'IP_INVALID',
    );
  }

  return trimmed;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Параметры для buildAssessment (param object pattern для extensibility)
 * @note Использует param object pattern для уменьшения cognitive load и упрощения расширения
 * @note Легко добавлять новые поля (session risk signals, vendor score, multi-factor metadata)
 */
export type BuildAssessmentParams = {
  readonly deviceInfo: DeviceInfo; // Информация об устройстве (нормализуется в DeviceRiskInfo)
  readonly context: {
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
    readonly timestamp: string | number; // Обязателен для детерминированности
  };
  readonly classificationResult: {
    readonly riskScore: number;
    readonly riskLevel: RiskLevel;
    readonly triggeredRules: readonly ClassificationRule[];
  };
  readonly modelVersion?: string; // Версия модели (по умолчанию defaultModelVersion)
};

/**
 * Строит LoginRiskEvaluation объект из domain данных
 * @note Signals не попадают в domain - остаются в adapter слое
 * @note Использует param object pattern для extensibility (легко добавлять новые поля)
 */
export function buildAssessment(params: BuildAssessmentParams): LoginRiskEvaluation {
  const {
    deviceInfo,
    context,
    classificationResult,
    modelVersion = defaultModelVersion,
  } = params;
  const device = normalizeDeviceForRisk(deviceInfo);
  const timestamp = validateAndParseTimestamp(context.timestamp);

  // Создаём LoginRiskResult (createLoginRiskResult внутри вызывает createRiskScore для валидации)
  const result = createLoginRiskResult({
    score: classificationResult.riskScore,
    level: classificationResult.riskLevel,
    reasons: mapTriggeredRulesToReasons(classificationResult.triggeredRules),
    modelVersion,
  });

  // Валидация geo координат (защита от Infinity/NaN)
  let validatedGeo: LoginRiskContext['geo'];
  if (context.geo !== undefined) {
    validateGeoCoordinates(context.geo);
    const { lat, lng, ...restGeo } = context.geo;
    validatedGeo = {
      ...restGeo,
      ...(lat !== undefined && { lat }),
      ...(lng !== undefined && { lng }),
    };
  }

  // Валидация IP адреса (IPv4/IPv6) для audit trail
  const validatedIp = context.ip !== undefined
    ? validateIpAddress(context.ip)
    : undefined;

  // Создаём LoginRiskContext
  const riskContext: LoginRiskContext = {
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(validatedIp !== undefined && { ip: validatedIp }),
    ...(validatedGeo !== undefined && { geo: validatedGeo }),
    device,
    ...(context.userAgent !== undefined && { userAgent: context.userAgent }),
    ...(context.previousSessionId !== undefined && {
      previousSessionId: context.previousSessionId,
    }),
    timestamp,
  };

  // Возвращаем LoginRiskEvaluation через factory
  return createLoginRiskEvaluation(result, riskContext);
}
