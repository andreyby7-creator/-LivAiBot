/**
 * @file packages/feature-auth/src/domain/LoginRiskAssessment.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — LoginRiskAssessment DTO
 * ============================================================================
 * Архитектурная роль:
 * - Domain-типы для оценки риска аутентификации
 * - Используется при login / refresh / sensitive actions
 * - SRP: строгое разделение на LoginRiskResult (семантический результат) и LoginRiskContext (входной контекст)
 * - Явная композиция: LoginRiskEvaluation = { result, context } (не intersection type)
 * - Signals остаются в adapter/classification слое, не попадают в domain
 * - Risk-engine и vendor agnostic
 * - ⚠️ Конфиденциальность: LoginRiskContext содержит PII (IP, geo, device) - помечен как @internal
 * Принципы:
 * - ❌ Нет бизнес-логики (кроме pure функций: deriveLoginDecision, createRiskScore, createRiskModelVersion)
 * - ✅ Полная типизация (без Record, index signatures, generic-map структур)
 * - ✅ Immutable / readonly
 * - ✅ Domain purity: LoginRiskResult содержит только семантический результат
 * - ✅ Decision вычисляется через deriveLoginDecision(level) с использованием mapping table для гибкости
 * - ✅ Branded types: RiskScore, RiskModelVersion с валидацией через DomainValidationError
 * - ✅ Reasons — closed-set union с категоризацией, всегда массив
 * - ✅ Timestamp как epoch ms (UTC, меньше surface area)
 * - ✅ Security & fraud-aware (PII в Context, воспроизводимость через modelVersion)
 */

import type { RiskLevel } from '@livai/domains/policies';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Оценка риска (0-100) с branded type для валидации
 * @note Гарантирует диапазон 0-100, предотвращает NaN, Infinity, отрицательные значения
 */
declare const RiskScoreBrand: unique symbol;
export type RiskScore = number & {
  readonly [RiskScoreBrand]: 'RiskScore';
};

/**
 * Версия модели оценки риска (branded type для семантической значимости)
 * @note Формат: "major.minor" (например, "1.0", "2.5", "1.0.0-beta")
 * @note Необходимо для воспроизводимости решений и расследования fraud
 */
declare const RiskModelVersionBrand: unique symbol;
export type RiskModelVersion = string & {
  readonly [RiskModelVersionBrand]: 'RiskModelVersion';
};

/**
 * Решение по логину на основе оценки риска
 * @note Вычисляется из RiskLevel через deriveLoginDecision, не передаётся извне
 */
export type LoginDecision = 'login' | 'mfa' | 'block';

/* ============================================================================
 * 🏷️ RISK REASON CONSTANTS — Константы для типов и кодов причин риска
 * ============================================================================
 */

/**
 * Константы типов причин риска (discriminator values)
 * @note Используются для refactor safety и избежания строковых литералов в rule-engine
 */
export const RiskReasonType = {
  NETWORK: 'network',
  REPUTATION: 'reputation',
  GEO: 'geo',
  DEVICE: 'device',
  BEHAVIOR: 'behavior',
} as const;

/**
 * Константы кодов причин риска (сгруппированы по типам)
 * @note Используются для refactor safety и избежания строковых литералов в rule-engine
 */
export const RiskReasonCode = {
  NETWORK: {
    VPN: 'vpn',
    TOR: 'tor',
    PROXY: 'proxy',
  },
  REPUTATION: {
    LOW: 'low',
    CRITICAL: 'critical',
  },
  GEO: {
    VELOCITY: 'velocity',
    IMPOSSIBLE_TRAVEL: 'impossible_travel',
    HIGH_RISK_COUNTRY: 'high_risk_country',
    SUSPICIOUS: 'suspicious',
  },
  DEVICE: {
    UNKNOWN: 'unknown',
    ANOMALY: 'anomaly',
  },
  BEHAVIOR: {
    HIGH_VELOCITY: 'high_velocity',
  },
} as const;

/**
 * Причина риска (closed-set union с категоризацией для масштабируемости)
 * @note Маппится из triggeredRules в adapter-слое, без generic-map структур
 * @note Категоризация позволяет группировать и анализировать причины
 * @note Использует константы RiskReasonType и RiskReasonCode для refactor safety
 *
 * @example { type: RiskReasonType.NETWORK; code: RiskReasonCode.NETWORK.VPN }
 */
export type RiskReason =
  | {
    type: typeof RiskReasonType.NETWORK;
    code: typeof RiskReasonCode.NETWORK[keyof typeof RiskReasonCode.NETWORK];
  }
  | {
    type: typeof RiskReasonType.REPUTATION;
    code: typeof RiskReasonCode.REPUTATION[keyof typeof RiskReasonCode.REPUTATION];
  }
  | {
    type: typeof RiskReasonType.GEO;
    code: typeof RiskReasonCode.GEO[keyof typeof RiskReasonCode.GEO];
  }
  | {
    type: typeof RiskReasonType.DEVICE;
    code: typeof RiskReasonCode.DEVICE[keyof typeof RiskReasonCode.DEVICE];
  }
  | {
    type: typeof RiskReasonType.BEHAVIOR;
    code: typeof RiskReasonCode.BEHAVIOR[keyof typeof RiskReasonCode.BEHAVIOR];
  };

/** Геолокационная информация */
export type GeoInfo = {
  readonly country?: string; // ISO-2 код страны
  readonly region?: string; // Регион/штат
  readonly city?: string;
  readonly lat?: number; // Широта (-90 до 90)
  readonly lng?: number; // Долгота (-180 до 180)
};

/** Информация об устройстве и fingerprint */
export type DeviceRiskInfo = {
  readonly deviceId?: string; // Стабильный идентификатор устройства
  readonly fingerprint?: string; // Device fingerprint hash
  readonly platform?: 'web' | 'ios' | 'android' | 'desktop';
  readonly os?: string; // Операционная система
  readonly browser?: string; // Браузер или клиент
  readonly appVersion?: string; // Версия приложения
};

/* ============================================================================
 * 🎯 DOMAIN TYPES
 * ============================================================================
 */

/**
 * Семантический результат оценки риска (domain layer)
 * @note Только результат вычислений, без входного контекста
 * @note Decision вычисляется через deriveLoginDecision(level) и включается в result
 * @note Соответствует roadmap: score, level, decision, reasons
 *
 * @example { score: 75, level: 'high', decision: 'block', reasons: [{ type: RiskReasonType.NETWORK, code: RiskReasonCode.NETWORK.VPN }], modelVersion: '1.0' }
 */
export type LoginRiskResult = {
  readonly score: RiskScore; // 0-100
  readonly level: RiskLevel;
  readonly decision: LoginDecision; // Вычисляется через deriveLoginDecision(level)
  readonly reasons: readonly RiskReason[]; // Всегда массив (даже пустой) для explainability
  readonly modelVersion: RiskModelVersion; // Версия модели для воспроизводимости
};

/**
 * Контекст оценки риска (входные данные)
 * @note Отдельно от результата для соблюдения SRP
 * @internal Содержит PII (IP, geo, device fingerprint) - не экспортировать в UI-пакет (GDPR)
 * @note При публикации публичного API использовать stripInternal в tsconfig
 */
export type LoginRiskContext = {
  readonly userId?: string; // Может отсутствовать до идентификации
  readonly ip?: string; // IPv4 или IPv6
  readonly geo?: GeoInfo; // Геолокация (IP/GPS/provider)
  readonly device?: DeviceRiskInfo; // Информация об устройстве
  readonly userAgent?: string; // User-Agent клиента
  readonly previousSessionId?: string; // ID предыдущей сессии (если есть)
  readonly timestamp: number; // Epoch ms UTC
};

/**
 * Полная оценка риска для audit (явная композиция)
 * @note Используется для audit и полного контекста
 * @note Явная композиция вместо intersection type для предотвращения утечек PII
 */
export type LoginRiskEvaluation = {
  readonly result: LoginRiskResult;
  readonly context: LoginRiskContext;
};

/* ============================================================================
 * 📦 CONSTANTS
 * ============================================================================
 */

/**
 * Пустой массив причин риска (default для LoginRiskResult)
 * @note Удобно для создания default LoginRiskResult без undefined и избежания проверок null/undefined
 */
/* eslint-disable functional/prefer-immutable-types -- Object.freeze обеспечивает runtime immutability, конфликт с branded types */
export const emptyReasons = Object.freeze([]) as readonly RiskReason[];

/* ============================================================================
 * 🔧 FUNCTIONS
 * ============================================================================
 */

/**
 * Mapping table для преобразования уровня риска в решение по логину
 * @note Используется для развязки LoginDecision от RiskLevel
 * @note Легко изменять политики без изменения кода (A/B тестирование, конфигурация)
 * @note TypeScript гарантирует exhaustive coverage через Record<RiskLevel, LoginDecision>
 */
const DECISION_BY_LEVEL: Record<RiskLevel, LoginDecision> = {
  low: 'login',
  medium: 'mfa',
  high: 'block',
  critical: 'block',
} as const;

/**
 * Вычисляет решение по логину на основе уровня риска
 * @note Pure функция, детерминированная
 * @note Использует lookup table для гибкости и легкого изменения политик
 * @note TypeScript гарантирует exhaustive coverage через Record<RiskLevel, LoginDecision>
 */
export function deriveLoginDecision(level: RiskLevel): LoginDecision {
  // eslint-disable-next-line security/detect-object-injection -- level имеет тип RiskLevel (union type из известных значений), безопасный lookup через Record
  return DECISION_BY_LEVEL[level];
}

/**
 * Ошибка валидации domain-типа
 * @note Расширена для structured logging: содержит field, value, code для диагностики
 */
/* eslint-disable functional/no-this-expressions, fp/no-mutation, fp/no-unused-expression -- DomainValidationError: infrastructure boundary для structured logging, instanceof, совместимость с try/catch */
export class DomainValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    public readonly code: string = 'DOMAIN_VALIDATION_ERROR',
  ) {
    super(message);
    this.name = 'DomainValidationError';
    Object.setPrototypeOf(this, DomainValidationError.prototype);
  }

  /**
   * Сериализует ошибку для structured logging
   * @note Используется в production для логов и мониторинга
   */
  toJSON(): { name: string; message: string; field?: string; value?: unknown; code: string; } {
    return Object.freeze({
      name: this.name,
      message: this.message,
      ...(this.field !== undefined && { field: this.field }),
      ...(this.value !== undefined && { value: this.value }),
      code: this.code,
    });
  }
}
/* eslint-enable functional/no-this-expressions, fp/no-mutation, fp/no-unused-expression */

/**
 * Создаёт RiskScore с валидацией
 * @throws {DomainValidationError} Если score вне диапазона 0-100 или невалидный
 */
/* eslint-disable functional/no-conditional-statements -- if улучшает читаемость vs вложенные тернарники */
export function createRiskScore(value: number): RiskScore {
  if (!Number.isFinite(value)) {
    throw new DomainValidationError(
      `RiskScore must be finite number, got: ${value}`,
      'score',
      value,
      'RISK_SCORE_INVALID_FINITE',
    );
  }
  if (value < 0 || value > 100) {
    throw new DomainValidationError(
      `RiskScore must be in range 0-100, got: ${value}`,
      'score',
      value,
      'RISK_SCORE_OUT_OF_RANGE',
    );
  }
  return value as RiskScore;
}
/* eslint-enable functional/no-conditional-statements */

/** Regex для валидации формата версии модели (major.minor) - безопасный паттерн с ограниченными квантификаторами */
// eslint-disable-next-line security/detect-unsafe-regex -- Ограниченные квантификаторы {1,5} и {1,20} предотвращают ReDoS
const MODEL_VERSION_REGEX = /^\d{1,5}\.\d{1,5}(?:\.\d{1,5})?(?:-[a-zA-Z0-9-]{1,20})?$/;

/**
 * Создаёт RiskModelVersion с валидацией формата
 * @note Валидация формата "major.minor" для безопасности audit/fraud
 * @note Поддерживает семантические версии: "1.0", "2.5", "1.0.0-beta"
 * @throws {DomainValidationError} Если формат невалидный
 */
/* eslint-disable functional/no-conditional-statements -- if улучшает читаемость vs вложенные тернарники */
export function createRiskModelVersion(value: string): RiskModelVersion {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainValidationError(
      `RiskModelVersion must be non-empty string, got: ${value}`,
      'modelVersion',
      value,
      'MODEL_VERSION_INVALID_TYPE',
    );
  }
  // Валидация формата major.minor (опционально с patch и pre-release)
  if (!MODEL_VERSION_REGEX.test(value)) {
    throw new DomainValidationError(
      `RiskModelVersion must match format "major.minor" (e.g., "1.0", "2.5"), got: ${value}`,
      'modelVersion',
      value,
      'MODEL_VERSION_INVALID_FORMAT',
    );
  }
  return value as RiskModelVersion;
}
/* eslint-enable functional/no-conditional-statements */

/* ============================================================================
 * 🏭 FACTORY FUNCTIONS
 * ============================================================================
 */

/**
 * Создаёт пустой LoginRiskResult (для тестов и placeholder объектов)
 * @note Используется для создания default/placeholder объектов без необходимости проверять null/undefined
 */
export function createEmptyLoginRiskResult(): LoginRiskResult {
  return Object.freeze({
    score: createRiskScore(0),
    level: 'low',
    decision: 'login',
    reasons: emptyReasons,
    modelVersion: createRiskModelVersion('1.0'),
  });
}

/**
 * Создаёт LoginRiskResult (чистый domain, без PII)
 * @note Используется в rule engine, pure domain logic
 * @note Не содержит контекст (userId, IP, geo, device) - только семантический результат
 * @note Decision вычисляется автоматически через deriveLoginDecision(level)
 */
export function createLoginRiskResult(params: {
  score: number;
  level: RiskLevel;
  reasons?: readonly RiskReason[];
  modelVersion: string;
}): LoginRiskResult {
  return Object.freeze({
    score: createRiskScore(params.score),
    level: params.level,
    decision: deriveLoginDecision(params.level),
    // Создаём копию массива для защиты от мутации через type assertion
    // emptyReasons остаётся shared frozen array для оптимизации
    reasons: params.reasons ? ([...params.reasons] as const) : emptyReasons,
    modelVersion: createRiskModelVersion(params.modelVersion),
  });
}

/**
 * Создаёт LoginRiskEvaluation (базовая структура для domain + context)
 * @note Используется для полного контекста оценки риска
 * @note Явная композиция result + context
 */
export function createLoginRiskEvaluation(
  result: LoginRiskResult,
  context: LoginRiskContext,
): LoginRiskEvaluation {
  return Object.freeze({
    result,
    context,
  });
}
/* eslint-enable functional/prefer-immutable-types */
