/**
 * @file packages/domains/src/classification/aggregation/scoring.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Risk Scoring (Aggregation Semantics)
 * ============================================================================
 * Архитектурная роль:
 * Aggregation layer для расчета risk score на основе факторов классификации.
 * Использует generic aggregation semantics из @livai/core.
 * Основные компоненты:
 * - RiskFactor: тип для факторов риска с name, weight, compute
 * - RiskWeights: конфигурация весов для scoring (device, geo, network, velocity)
 * - factorsRegistry: дефолтный registry факторов
 * - calculateRiskScore: основной API для расчета risk score с RiskWeights
 * - calculateRiskScoreWithCustomFactors: API для расчета с кастомными факторами
 * Принципы:
 * - ✅ Aggregation semantics — scoring = aggregation, НЕ в strategies
 * - ✅ Pure domain — детерминированная функция, одинаковый вход → одинаковый выход (без randomness, IO, глобального состояния)
 * - ✅ No side-effects — изолирован от effects layer
 * - ✅ SRP — только scoring, не содержит decision logic или rule evaluation
 * - ✅ Domain-focused — classification-специфичные веса и факторы
 * - ✅ Normalized weights — веса суммируются в 1.0 для корректного weighted scoring
 * - ✅ Immutable — все веса и константы защищены от мутаций через Object.freeze и Readonly
 * - ✅ Security — валидация всех входных данных для защиты от poisoning:
 *    - IP-валидаторы: IPv4, IPv6 (compressed/mixed), зоны, IPv4-mapped адреса (использует battle-tested ipaddr.js)
 *    - Валидация чисел: reputationScore, velocityScore (NaN, Infinity, отрицательные значения)
 * - ✅ Extensible — registry-style архитектура для динамического добавления факторов без изменения core types
 */

import ipaddr from 'ipaddr.js';

import { SCORE_VALIDATION } from '../constants.js';
import type {
  ClassificationContext,
  ClassificationGeo,
  ClassificationSignals,
} from '../signals/signals.js';
import { getClassificationRulesConfig } from '../strategies/config.js';
import type { DeviceInfo } from '../strategies/rules.js';

/* ============================================================================
 * 🧩 ТИПЫ — SCORING CONTEXT
 * ============================================================================
 */

/**
 * Контекст для scoring (используется в aggregation/)
 * @note config передается явно (избегает fallback на глобальный state)
 * @public
 */
export type ScoringContext = Readonly<{
  readonly device: DeviceInfo;
  readonly geo?: ClassificationContext['geo'];
  readonly ip?: string;
  readonly signals?: ClassificationContext['signals'];
  /** Опциональная конфигурация для оптимизации (избегает повторных вызовов getClassificationRulesConfig) */
  readonly config?: Readonly<{
    readonly highRiskCountries: ReadonlySet<string>;
  }>;
}>;

/* ============================================================================
 * 🔧 КОНСТАНТЫ
 * ============================================================================
 */

/**
 * Константы для валидации весов
 * @internal
 */
const WEIGHT_VALIDATION = Object.freeze(
  {
    /** Минимальная допустимая сумма весов (10% отклонение для числовой точности) */
    MIN_TOTAL: 0.9,
    /** Максимальная допустимая сумма весов (10% отклонение для числовой точности) */
    MAX_TOTAL: 1.1,
    /** Целевая сумма весов */
    TARGET_TOTAL: 1.0,
    /** Минимальный вес для одного фактора */
    MIN_WEIGHT: 0.0,
    /** Максимальный вес для одного фактора */
    MAX_WEIGHT: 1.0,
  } as const,
);

/**
 * Оценки риска для устройств (0-100)
 * @internal
 */
const DEVICE_RISK_SCORES = Object.freeze(
  {
    UNKNOWN_DEVICE: 40,
    IOT_DEVICE: 30,
    MISSING_OS: 20,
    MISSING_BROWSER: 15,
  } as const,
);

/**
 * Оценки риска для сетевых факторов (0-100)
 * @internal
 */
const NETWORK_RISK_SCORES = Object.freeze(
  {
    TOR: 70,
    VPN: 50,
    PROXY: 40,
    LOW_REPUTATION: 30,
    CRITICAL_REPUTATION: 50,
    LOW_REPUTATION_THRESHOLD: 50,
    VERY_LOW_REPUTATION_THRESHOLD: 10,
  } as const,
);

/**
 * Оценки риска для географических факторов (0-100)
 * @internal
 */
const GEO_RISK_SCORES = Object.freeze(
  {
    GEO_MISMATCH: 60,
    HIGH_RISK_COUNTRY: 40,
  } as const,
);

/* ============================================================================
 * 🧩 ТИПЫ — RISK FACTOR & REGISTRY
 * ============================================================================
 */

/**
 * Фактор риска для scoring
 * Registry-style архитектура позволяет динамически добавлять новые факторы
 * @public
 */
export type RiskFactor = Readonly<{
  /** Уникальное имя фактора */
  readonly name: string;
  /** Вес фактора (0.0-1.0) */
  readonly weight: number;
  /** Функция расчета риска для фактора (0-100) */
  readonly compute: (ctx: ScoringContext) => number;
}>;

/**
 * Конфигурация весов для scoring
 * Веса суммируются в 1.0 для нормализованного weighted scoring
 * @note Валидация: сумма весов должна быть близка к 1.0 (0.9-1.1 для учета числовой точности)
 * @note Каждый вес должен быть в диапазоне 0.0-1.0
 * @public
 */
export type RiskWeights = Readonly<{
  /** Вес для device факторов (0.0-1.0) */
  readonly device: number;
  /** Вес для geo факторов (0.0-1.0) */
  readonly geo: number;
  /** Вес для network факторов (0.0-1.0) */
  readonly network: number;
  /** Вес для velocity факторов (0.0-1.0) */
  readonly velocity: number;
}>;

/* ============================================================================
 * 🔧 VALIDATION UTILITIES
 * ============================================================================
 */

/**
 * Валидирует risk weights (сумма должна быть близка к 1.0, каждый вес в диапазоне 0.0-1.0)
 * @internal
 */
export function validateRiskWeights(
  weights: RiskWeights, // Веса для валидации
): boolean { // true если веса валидны, false иначе
  // Валидация диапазона каждого веса
  if (
    weights.device < WEIGHT_VALIDATION.MIN_WEIGHT
    || weights.device > WEIGHT_VALIDATION.MAX_WEIGHT
    || weights.geo < WEIGHT_VALIDATION.MIN_WEIGHT
    || weights.geo > WEIGHT_VALIDATION.MAX_WEIGHT
    || weights.network < WEIGHT_VALIDATION.MIN_WEIGHT
    || weights.network > WEIGHT_VALIDATION.MAX_WEIGHT
    || weights.velocity < WEIGHT_VALIDATION.MIN_WEIGHT
    || weights.velocity > WEIGHT_VALIDATION.MAX_WEIGHT
  ) {
    return false;
  }

  // Валидация суммы весов (с учетом числовой точности)
  const total = weights.device + weights.geo + weights.network + weights.velocity;
  return total >= WEIGHT_VALIDATION.MIN_TOTAL && total <= WEIGHT_VALIDATION.MAX_TOTAL;
}

/**
 * Дефолтные веса для scoring (сумма = 1.0)
 * Используются, если weights не указаны в policy
 * @note Веса валидированы: сумма = 1.0, каждый вес в диапазоне 0.0-1.0
 * @note Immutable: защищены от мутаций через Object.freeze
 * @note Deterministic: константа гарантирует детерминированный scoring
 * @public
 */
export const defaultRiskWeights: RiskWeights = Object.freeze(
  {
    device: 0.3,
    geo: 0.25,
    network: 0.25,
    velocity: 0.2,
  } as const,
);

// Runtime валидация дефолтных весов (invariant check)
if (!validateRiskWeights(defaultRiskWeights)) {
  // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации: дефолтные веса должны быть валидны
  throw new Error(
    `Invalid defaultRiskWeights: sum must be close to 1.0, each weight must be 0.0-1.0`,
  );
}

/* ============================================================================
 * 🔧 VALIDATION UTILITIES — SCORE & IP
 * ============================================================================
 */

/**
 * Валидирует и нормализует score (0-100)
 * @internal
 */
function validateAndNormalizeScore(
  score: number | undefined | null, // Score для валидации
): number { // Нормализованный score в диапазоне 0-100
  if (score === undefined || score === null) {
    return 0;
  }

  // Проверка на NaN и Infinity
  if (!Number.isFinite(score)) {
    return 0;
  }

  // Проверка на отрицательные значения
  if (score < SCORE_VALIDATION.MIN_SCORE) {
    return 0;
  }

  // Ограничение максимумом
  return Math.min(Math.max(score, SCORE_VALIDATION.MIN_SCORE), SCORE_VALIDATION.MAX_SCORE);
}

/**
 * Валидирует IPv4 адрес используя battle-tested библиотеку ipaddr.js
 * @internal
 */
function isValidIpv4(ip: string): boolean { // true если IP валиден, false иначе
  try {
    const addr = ipaddr.process(ip);
    return addr.kind() === 'ipv4';
  } catch {
    return false;
  }
}

/**
 * Валидирует IPv6 адрес используя battle-tested библиотеку ipaddr.js
 * Поддерживает все edge cases:
 * - Полные адреса: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
 * - Сокращенные формы: 2001:db8::1, ::1 (включая сложные edge-cases)
 * - Смешанные формы: 2001:db8::192.168.1.1
 * - IPv4-mapped адреса: ::ffff:192.168.1.1
 * - IPv4-compatible адреса: ::192.168.1.1
 * - Зоны: fe80::1%eth0 (полная поддержка RFC 4007)
 * @note Security: использует battle-tested библиотеку ipaddr.js для production high-security систем
 * @internal
 */
function isValidIpv6(ip: string): boolean { // true если IP валиден, false иначе
  try {
    // ipaddr.js автоматически обрабатывает зоны (RFC 4007)
    const addr = ipaddr.process(ip);
    return addr.kind() === 'ipv6';
  } catch {
    return false;
  }
}

/**
 * Валидирует IP адрес (строгая проверка IPv4 и IPv6) используя battle-tested библиотеку ipaddr.js
 * @internal
 */
function isValidIp(ip: string | undefined): ip is string { // true если IP валиден, false иначе
  if (ip === undefined || ip.length === 0) {
    return false;
  }

  // Используем отдельные функции для ясности и возможности переиспользования
  return isValidIpv4(ip) || isValidIpv6(ip);
}

/* ============================================================================
 * 🔧 SCORING FACTORS — RISK CALCULATION
 * ============================================================================
 */

/**
 * Рассчитывает риск устройства (0-100)
 * @internal
 */
function calculateDeviceRisk(
  device: DeviceInfo, // Информация об устройстве
): number { // Risk score для устройства (0-100)
  const scores = [
    device.deviceType === 'unknown' ? DEVICE_RISK_SCORES.UNKNOWN_DEVICE : 0,
    device.deviceType === 'iot' ? DEVICE_RISK_SCORES.IOT_DEVICE : 0,
    device.os === undefined ? DEVICE_RISK_SCORES.MISSING_OS : 0,
    device.browser === undefined ? DEVICE_RISK_SCORES.MISSING_BROWSER : 0,
  ];

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  return Math.min(totalScore, SCORE_VALIDATION.MAX_SCORE);
}

/**
 * Рассчитывает географический риск (0-100)
 * @internal
 */
function calculateGeoRisk(
  geo: ClassificationGeo | undefined, // Текущая геолокация
  previousGeo: ClassificationGeo | undefined, // Предыдущая геолокация (для определения GEO_MISMATCH)
  highRiskCountries: ReadonlySet<string>, // Список стран с высоким риском
): number { // Risk score для геолокации (0-100)
  if (geo === undefined) {
    return 0;
  }

  const scores = [
    geo.country !== undefined && highRiskCountries.has(geo.country)
      ? GEO_RISK_SCORES.HIGH_RISK_COUNTRY
      : 0,
    previousGeo?.country !== undefined
      && geo.country !== undefined
      && previousGeo.country !== geo.country
      ? GEO_RISK_SCORES.GEO_MISMATCH
      : 0,
  ];

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  return Math.min(totalScore, SCORE_VALIDATION.MAX_SCORE);
}

/**
 * Рассчитывает сетевой риск (0-100)
 * @internal
 */
function calculateNetworkRisk(
  ip: string | undefined, // IP адрес
  signals: ClassificationSignals | undefined, // Сигналы классификации
): number { // Risk score для сети (0-100)
  // Валидация IP перед использованием
  if (!isValidIp(ip)) {
    return 0;
  }

  // Валидация reputationScore перед использованием (защита от poisoning)
  const reputationScore = validateAndNormalizeScore(signals?.reputationScore);

  const scores = [
    signals?.isTor === true ? NETWORK_RISK_SCORES.TOR : 0,
    signals?.isVpn === true ? NETWORK_RISK_SCORES.VPN : 0,
    signals?.isProxy === true ? NETWORK_RISK_SCORES.PROXY : 0,
    reputationScore < NETWORK_RISK_SCORES.VERY_LOW_REPUTATION_THRESHOLD
      && reputationScore > 0
      ? NETWORK_RISK_SCORES.CRITICAL_REPUTATION
      : 0,
    reputationScore < NETWORK_RISK_SCORES.LOW_REPUTATION_THRESHOLD
      && reputationScore >= NETWORK_RISK_SCORES.VERY_LOW_REPUTATION_THRESHOLD
      ? NETWORK_RISK_SCORES.LOW_REPUTATION
      : 0,
  ];

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  return Math.min(totalScore, SCORE_VALIDATION.MAX_SCORE);
}

/**
 * Рассчитывает velocity risk (0-100)
 * @internal
 */
function calculateVelocityRisk(
  signals: ClassificationSignals | undefined, // Сигналы классификации
): number { // Risk score для velocity (0-100)
  // Валидация velocityScore перед использованием (защита от poisoning)
  return validateAndNormalizeScore(signals?.velocityScore);
}

/* ============================================================================
 * 🎯 FACTOR REGISTRY — EXTENSIBLE FACTOR ARCHITECTURE
 * ============================================================================
 */

/**
 * Registry факторов риска
 * Позволяет динамически добавлять новые факторы без изменения core types
 * @internal
 */
const factorsRegistry: readonly RiskFactor[] = Object.freeze(
  [
    {
      name: 'device',
      weight: defaultRiskWeights.device,
      compute: (ctx: ScoringContext): number => calculateDeviceRisk(ctx.device),
    },
    {
      name: 'geo',
      weight: defaultRiskWeights.geo,
      compute: (ctx: ScoringContext): number => {
        // Используем config из context если передан, иначе получаем глобальный (оптимизация для множественных вызовов)
        const config = ctx.config ?? getClassificationRulesConfig();
        return calculateGeoRisk(
          ctx.geo,
          ctx.signals?.previousGeo,
          config.highRiskCountries,
        );
      },
    },
    {
      name: 'network',
      weight: defaultRiskWeights.network,
      compute: (ctx: ScoringContext): number => calculateNetworkRisk(ctx.ip, ctx.signals),
    },
    {
      name: 'velocity',
      weight: defaultRiskWeights.velocity,
      compute: (ctx: ScoringContext): number => calculateVelocityRisk(ctx.signals),
    },
  ] as const,
);

/**
 * Валидирует registry факторов
 * Проверяет что сумма весов близка к 1.0 и каждый вес в диапазоне 0.0-1.0
 * @internal
 */
function validateFactorsRegistry(
  factors: readonly RiskFactor[], // Массив факторов для валидации
): boolean { // true если факторы валидны, false иначе
  if (factors.length === 0) {
    return false;
  }

  // Проверка уникальности имен и валидация весов
  const names = factors.map((factor) => factor.name);
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    return false; // Дублирующиеся имена
  }

  // Валидация весов
  const invalidWeight = factors.some(
    (factor) =>
      factor.weight < WEIGHT_VALIDATION.MIN_WEIGHT
      || factor.weight > WEIGHT_VALIDATION.MAX_WEIGHT,
  );
  if (invalidWeight) {
    return false;
  }

  // Валидация суммы весов
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  return totalWeight >= WEIGHT_VALIDATION.MIN_TOTAL
    && totalWeight <= WEIGHT_VALIDATION.MAX_TOTAL;
}

/**
 * Модуль кеширования normalizedFactors (замыкание для управления кешем)
 * @internal
 */
const normalizedFactorsCacheModule = ((): Readonly<{
  readonly get: (
    cacheKey: string,
  ) =>
    | readonly (Readonly<
      { name: string; weight: number; compute: (ctx: ScoringContext) => number; }
    >)[]
    | undefined;
  readonly set: (
    cacheKey: string,
    normalized: readonly (Readonly<
      { name: string; weight: number; compute: (ctx: ScoringContext) => number; }
    >)[],
  ) => void;
}> => {
  const cache = new Map<
    string,
    readonly (Readonly<
      { name: string; weight: number; compute: (ctx: ScoringContext) => number; }
    >)[]
  >();

  return {
    get: (cacheKey: string) => cache.get(cacheKey),
    set: (cacheKey: string, normalized) => {
      // eslint-disable-next-line functional/immutable-data -- Кеш требует мутации Map
      cache.set(cacheKey, normalized);
    },
  } as const;
})();

/**
 * Создает ключ кеша из весов факторов
 * @internal
 */
function createFactorsCacheKey(factors: readonly RiskFactor[]): string {
  // Сортируем по имени для консистентности ключа
  const sortedFactors = [...factors].sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(sortedFactors.map((f) => ({ name: f.name, weight: f.weight })));
}

/**
 * Рассчитывает risk score используя registry факторов
 * Использует registry-style архитектуру для extensibility
 * @internal
 */
function calculateRiskScoreWithFactors(
  context: ScoringContext, // Контекст для scoring
  factors: readonly RiskFactor[] = factorsRegistry, // Массив факторов (по умолчанию factorsRegistry)
): number { // Risk score в диапазоне 0-100
  // Валидация факторов
  if (!validateFactorsRegistry(factors)) {
    // eslint-disable-next-line fp/no-throw -- Некорректные факторы должны прерывать выполнение
    throw new Error(
      'Invalid factors: sum of weights must be close to 1.0, each weight must be 0.0-1.0, names must be unique',
    );
  }

  // Вычисляем scores для каждого фактора
  const scores = factors.map((factor) => factor.compute(context));

  // Нормализация весов (если сумма != 1.0) с кешированием
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const normalizedFactors: readonly (Readonly<{
    name: string;
    weight: number;
    compute: (ctx: ScoringContext) => number;
  }>)[] = totalWeight === WEIGHT_VALIDATION.TARGET_TOTAL
    ? factors
    : ((): readonly (Readonly<{
      name: string;
      weight: number;
      compute: (ctx: ScoringContext) => number;
    }>)[] => {
      // Проверяем кеш для normalizedFactors
      const cacheKey = createFactorsCacheKey(factors);
      const cached = normalizedFactorsCacheModule.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
      // Создаем normalizedFactors и кешируем
      const normalized = Object.freeze(
        factors.map((factor) => ({
          name: factor.name,
          weight: factor.weight / totalWeight,
          compute: factor.compute,
        })),
      ) as readonly (Readonly<{
        name: string;
        weight: number;
        compute: (ctx: ScoringContext) => number;
      }>)[];
      normalizedFactorsCacheModule.set(cacheKey, normalized);
      return normalized;
    })();

  // Нормализованный weighted score
  const weightedScore = normalizedFactors.reduce(
    (sum, factor, index) => {
      const score = scores[index];
      if (score === undefined) {
        return sum;
      }
      return sum + score * factor.weight;
    },
    0,
  );

  // Округляем и ограничиваем 0-100
  return Math.round(
    Math.min(
      Math.max(weightedScore, SCORE_VALIDATION.MIN_SCORE),
      SCORE_VALIDATION.MAX_SCORE,
    ),
  );
}

/* ============================================================================
 * 🎯 MAIN API — CALCULATE RISK SCORE
 * ============================================================================
 */

/**
 * Рассчитывает общий risk score (0-100) с нормализацией
 * Использует weighted scoring: каждый фактор умножается на свой вес и суммируется
 * @note Для оптимизации множественных вызовов: передавайте config в context.config
 *      чтобы избежать повторных вызовов getClassificationRulesConfig() внутри факторов
 * @public
 */
export function calculateRiskScore(
  context: ScoringContext, // Контекст для scoring (device, geo, ip, signals, опционально config)
  weights: RiskWeights = defaultRiskWeights, // Веса для факторов (по умолчанию defaultRiskWeights)
): number { // Risk score в диапазоне 0-100
  // Используем registry-style архитектуру
  // Создаем факторы из weights
  const factors: readonly RiskFactor[] = Object.freeze(
    [
      {
        name: 'device',
        weight: weights.device,
        compute: (ctx: ScoringContext): number => calculateDeviceRisk(ctx.device),
      },
      {
        name: 'geo',
        weight: weights.geo,
        compute: (ctx: ScoringContext): number => {
          // Используем config из context если передан, иначе получаем глобальный (оптимизация для множественных вызовов)
          const config = ctx.config ?? getClassificationRulesConfig();
          return calculateGeoRisk(
            ctx.geo,
            ctx.signals?.previousGeo,
            config.highRiskCountries,
          );
        },
      },
      {
        name: 'network',
        weight: weights.network,
        compute: (ctx: ScoringContext): number => calculateNetworkRisk(ctx.ip, ctx.signals),
      },
      {
        name: 'velocity',
        weight: weights.velocity,
        compute: (ctx: ScoringContext): number => calculateVelocityRisk(ctx.signals),
      },
    ] as const,
  );

  return calculateRiskScoreWithFactors(context, factors);
}

/**
 * Рассчитывает risk score используя кастомные факторы
 * Позволяет динамически добавлять новые факторы без изменения core types
 * @note Использует registry-style архитектуру для extensibility
 * @note Факторы валидируются автоматически (сумма весов, диапазон весов, уникальность имен)
 * @public
 */
export function calculateRiskScoreWithCustomFactors(
  context: ScoringContext, // Контекст для scoring
  factors: readonly RiskFactor[], // Массив факторов риска
): number { // Risk score в диапазоне 0-100
  return calculateRiskScoreWithFactors(context, factors);
}
