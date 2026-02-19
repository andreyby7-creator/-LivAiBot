/**
 * @file packages/feature-auth/src/effects/login/risk-scoring.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Scoring Engine
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистый расчет risk score на основе факторов (sync/async/ML)
 * - Нормализованный weighted scoring с кэшированием
 * - Детерминированный результат с sandbox валидацией
 *
 * Принципы:
 * - ✅ Чистая функция — только расчет, без side-effects
 * - ✅ Нормализация — каждый фактор 0-100, веса суммируются в 1.0
 * - ✅ Детерминизм — одинаковый вход → одинаковый выход
 * - ✅ SRP — scoring engine не хранит данные, использует конфиг
 * - ✅ Security — валидация всех входных данных, sandbox для async/ML факторов
 * - ✅ Extensibility — конфигурируемые факторы, JSON/DB загрузка, кэширование
 */

import { createHash } from 'node:crypto';
import type { ReadonlyDeep } from 'type-fest';

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { GeoInfo } from '../../domain/LoginRiskAssessment.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Конфигурация весов для scoring */
export type RiskWeights = {
  readonly device: number;
  readonly geo: number;
  readonly network: number;
  readonly velocity: number;
};

/** Сигналы риска для scoring */
export type ScoringSignals = {
  readonly isVpn?: boolean;
  readonly isTor?: boolean;
  readonly isProxy?: boolean;
  readonly reputationScore?: number;
  readonly velocityScore?: number;
  readonly previousGeo?: GeoInfo;
};

/** Контекст для scoring */
export type ScoringContext = {
  readonly device: DeviceInfo;
  readonly geo?: GeoInfo;
  readonly ip?: string;
  /** ReadonlyDeep защищает вложенные объекты (previousGeo, externalSignals) от мутаций плагинами */
  readonly signals?: ReadonlyDeep<ScoringSignals>;
};

/** Функция расчета фактора риска (синхронная) */
type ScoringFactor = (ctx: ScoringContext) => number;

/** Функция расчета фактора риска (асинхронная, для ML/внешних API) */
type AsyncScoringFactor = (ctx: ScoringContext) => Promise<number>;

/** Функция расчета фактора */
type FactorCalculator = {
  /** Функция расчета фактора (синхронная) */
  readonly calculate: ScoringFactor;
};

/** Асинхронная функция расчета фактора */
type AsyncFactorCalculator = {
  /** Функция расчета фактора (асинхронная) */
  readonly calculateAsync: AsyncScoringFactor;
};

/** Вес фактора */
type FactorWeight = {
  /** Вес фактора (0-1) */
  readonly weight: number;
};

/** Конфигурация фактора scoring */
type FactorConfig = FactorCalculator & FactorWeight;

/** Конфигурация асинхронного фактора scoring (для ML/внешних API) */
type AsyncFactorConfig = AsyncFactorCalculator & FactorWeight;

/** Метаданные фактора для валидации */
type FactorMetadata = {
  /** Идентификатор фактора */
  readonly id: string;
  /** Тип фактора */
  readonly type: 'sync' | 'async' | 'ml';
  /** Таймаут для async факторов (мс) */
  readonly timeout?: number;
  /** Максимальное значение score (для валидации) */
  readonly maxScore?: number;
  /** Минимальное значение score (для валидации) */
  readonly minScore?: number;
};

/** Полная конфигурация фактора с метаданными */
type ExtendedFactorConfig = (FactorConfig | AsyncFactorConfig) & FactorMetadata;

/** Type guard для проверки async фактора */
export function isAsyncFactor(
  factor: ExtendedFactorConfig,
): factor is AsyncFactorConfig & FactorMetadata {
  return 'calculateAsync' in factor;
}

/** Type guard для проверки sync фактора */
export function isSyncFactor(
  factor: ExtendedFactorConfig,
): factor is FactorConfig & FactorMetadata {
  return 'calculate' in factor && !('calculateAsync' in factor);
}

/* ============================================================================
 * 🔧 CONSTANTS & CONFIG
 * ============================================================================
 */

/** Константы для валидации весов факторов */
const WEIGHT_VALIDATION = Object.freeze(
  {
    /** Максимальная допустимая сумма весов (10% отклонение) */
    MAX_TOTAL: 1.1,
    /** Минимальная допустимая сумма весов (10% отклонение) */
    MIN_TOTAL: 0.9,
  } as const,
);

/** Оценки риска для устройств (0-100) */
const DEVICE_RISK_SCORES = Object.freeze(
  {
    UNKNOWN_DEVICE: 40,
    IOT_DEVICE: 30,
    MISSING_OS: 20,
    MISSING_BROWSER: 15,
  } as const,
);

/** Оценки риска для сетевых факторов (0-100) */
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

/** Оценки риска для географических факторов (0-100) */
const GEO_RISK_SCORES = Object.freeze(
  {
    GEO_MISMATCH: 60,
    HIGH_RISK_COUNTRY: 40,
  } as const,
);

/** Список стран с высоким риском (immutable для безопасности) */
const HIGH_RISK_COUNTRIES: ReadonlySet<string> = Object.freeze(
  new Set([
    'KP', // North Korea
    'IR', // Iran
    'SY', // Syria
    // Можно расширить по необходимости
  ]),
);

/** Валидный диапазон для score (0-100) */
const SCORE_RANGE = Object.freeze(
  {
    MIN: 0,
    MAX: 100,
  } as const,
);

/** Константы для валидации IPv4 */
const IPV4_CONSTANTS = Object.freeze(
  {
    OCTET_COUNT: 4,
    MAX_OCTET_VALUE: 255,
  } as const,
);

/** Константы для кэширования */
const CACHE_CONSTANTS = Object.freeze(
  {
    /** Максимальный размер кэша (для предотвращения утечек памяти) */
    MAX_SIZE: 1000,
    /** Количество минут для TTL */
    TTL_MINUTES: 5,
    /** Количество секунд в минуте */
    SECONDS_PER_MINUTE: 60,
    /** Количество миллисекунд в секунде */
    MS_PER_SECOND: 1000,
  } as const,
);

/** TTL кэша в миллисекундах (5 минут) */
const CACHE_TTL_MS = CACHE_CONSTANTS.TTL_MINUTES
  * CACHE_CONSTANTS.SECONDS_PER_MINUTE
  * CACHE_CONSTANTS.MS_PER_SECOND;

/** Константы для async факторов */
const ASYNC_FACTOR_CONSTANTS = Object.freeze(
  {
    /** Дефолтный таймаут для async факторов (мс) */
    DEFAULT_TIMEOUT: 5000,
    /** Максимальный таймаут для async факторов (мс) */
    MAX_TIMEOUT: 30000,
  } as const,
);

/** Дефолтные веса (сумма = 1.0) */
export const defaultRiskWeights: RiskWeights = Object.freeze(
  {
    device: 0.3,
    geo: 0.25,
    network: 0.25,
    velocity: 0.2,
  } as const,
);

/** @deprecated Используйте defaultRiskWeights */
export const DefaultRiskWeights = defaultRiskWeights;

/* ============================================================================
 * 🔧 VALIDATION UTILITIES
 * ============================================================================
 */

/** Валидирует и нормализует score (0-100) */
function validateAndNormalizeScore(score: number | undefined | null): number {
  if (score === undefined || score === null) {
    return 0;
  }

  // Проверка на NaN и Infinity
  if (!Number.isFinite(score)) {
    return 0;
  }

  // Проверка на отрицательные значения
  if (score < SCORE_RANGE.MIN) {
    return 0;
  }

  // Ограничение максимумом
  return Math.min(Math.max(score, SCORE_RANGE.MIN), SCORE_RANGE.MAX);
}

/** Валидирует IPv4 адрес (строгая проверка: каждый октет 0-255) */
function isValidIpv4(ip: string): boolean {
  // eslint-disable-next-line security/detect-unsafe-regex -- Безопасный паттерн для валидации IPv4, ограниченный по длине
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipv4Pattern.test(ip)) {
    return false;
  }

  // Проверка каждого октета на диапазон 0-255
  const octets = ip.split('.');
  if (octets.length !== IPV4_CONSTANTS.OCTET_COUNT) {
    return false;
  }

  for (const octet of octets) {
    const num = Number.parseInt(octet, 10);
    if (Number.isNaN(num) || num < 0 || num > IPV4_CONSTANTS.MAX_OCTET_VALUE) {
      return false;
    }
  }

  return true;
}

/**
 * Валидирует IPv6 адрес (базовая проверка формата)
 * @note Для high-security систем рекомендуется использовать библиотеку ipaddr.js
 * для полной поддержки сокращенных форм (::1), зон (%eth0) и других edge cases
 */
function isValidIpv6(ip: string): boolean {
  // eslint-disable-next-line security/detect-unsafe-regex -- Безопасный паттерн для валидации IPv6, ограниченный по длине
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  // eslint-disable-next-line security/detect-unsafe-regex -- Безопасный паттерн для валидации IPv6, ограниченный по длине (максимум 7 групп)
  const ipv6ShortPattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  return ipv6Pattern.test(ip) || ipv6ShortPattern.test(ip);
}

/** Валидирует IP адрес (строгая проверка IPv4 и IPv6) */
function isValidIp(ip: string | undefined): ip is string {
  if (ip === undefined || ip.length === 0) {
    return false;
  }

  return isValidIpv4(ip) || isValidIpv6(ip);
}

/* ============================================================================
 * 🔧 SCORING FACTORS
 * ============================================================================
 */

/** Рассчитывает риск устройства (0-100) */
function calculateDeviceRisk(device: DeviceInfo): number {
  let score = 0;

  if (device.deviceType === 'unknown') {
    score += DEVICE_RISK_SCORES.UNKNOWN_DEVICE;
  }

  if (device.deviceType === 'iot') {
    score += DEVICE_RISK_SCORES.IOT_DEVICE;
  }

  if (device.os === undefined) {
    score += DEVICE_RISK_SCORES.MISSING_OS;
  }

  if (device.browser === undefined) {
    score += DEVICE_RISK_SCORES.MISSING_BROWSER;
  }

  return Math.min(score, SCORE_RANGE.MAX);
}

/** Рассчитывает географический риск (0-100) */
function calculateGeoRisk(geo: GeoInfo | undefined, previousGeo: GeoInfo | undefined): number {
  if (geo === undefined) {
    return 0;
  }

  let score = 0;

  if (geo.country !== undefined && HIGH_RISK_COUNTRIES.has(geo.country)) {
    score += GEO_RISK_SCORES.HIGH_RISK_COUNTRY;
  }

  if (
    previousGeo?.country !== undefined
    && geo.country !== undefined
    && previousGeo.country !== geo.country
  ) {
    score += GEO_RISK_SCORES.GEO_MISMATCH;
  }

  return Math.min(score, SCORE_RANGE.MAX);
}

/** Рассчитывает сетевой риск (0-100) */
function calculateNetworkRisk(ip: string | undefined, signals: ScoringSignals | undefined): number {
  // Валидация IP перед использованием
  if (!isValidIp(ip)) {
    return 0;
  }

  let score = 0;

  if (signals?.isTor === true) {
    score += NETWORK_RISK_SCORES.TOR;
  }

  if (signals?.isVpn === true) {
    score += NETWORK_RISK_SCORES.VPN;
  }

  if (signals?.isProxy === true) {
    score += NETWORK_RISK_SCORES.PROXY;
  }

  // Валидация reputationScore перед использованием (защита от poisoning)
  const reputationScore = validateAndNormalizeScore(signals?.reputationScore);

  if (reputationScore < NETWORK_RISK_SCORES.VERY_LOW_REPUTATION_THRESHOLD && reputationScore > 0) {
    score += NETWORK_RISK_SCORES.CRITICAL_REPUTATION;
  } else if (
    reputationScore < NETWORK_RISK_SCORES.LOW_REPUTATION_THRESHOLD
    && reputationScore >= NETWORK_RISK_SCORES.VERY_LOW_REPUTATION_THRESHOLD
  ) {
    score += NETWORK_RISK_SCORES.LOW_REPUTATION;
  }

  return Math.min(score, SCORE_RANGE.MAX);
}

/** Рассчитывает velocity risk (0-100) */
function calculateVelocityRisk(signals: ScoringSignals | undefined): number {
  // Валидация velocityScore перед использованием (защита от poisoning)
  return validateAndNormalizeScore(signals?.velocityScore);
}

/* ============================================================================
 * 🔧 FACTOR CONFIGURATION
 * ============================================================================
 */

/** Конфигурация факторов scoring (для масштабируемости) */
const factorConfigs: readonly FactorConfig[] = Object.freeze(
  [
    {
      calculate: (ctx: ScoringContext): number => calculateDeviceRisk(ctx.device),
      weight: defaultRiskWeights.device,
    },
    {
      calculate: (ctx: ScoringContext): number =>
        calculateGeoRisk(ctx.geo, ctx.signals?.previousGeo),
      weight: defaultRiskWeights.geo,
    },
    {
      calculate: (ctx: ScoringContext): number => calculateNetworkRisk(ctx.ip, ctx.signals),
      weight: defaultRiskWeights.network,
    },
    {
      calculate: (ctx: ScoringContext): number => calculateVelocityRisk(ctx.signals),
      weight: defaultRiskWeights.velocity,
    },
  ] as const,
);

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/** Рассчитывает общий risk score (0-100) с нормализацией */
export function calculateRiskScore(
  context: ScoringContext,
  weights: RiskWeights = defaultRiskWeights,
): number {
  // Используем конфигурируемые факторы для масштабируемости
  const deviceRisk = calculateDeviceRisk(context.device);
  const geoRisk = calculateGeoRisk(context.geo, context.signals?.previousGeo);
  const networkRisk = calculateNetworkRisk(context.ip, context.signals);
  const velocityRisk = calculateVelocityRisk(context.signals);

  // Нормализованный weighted score
  // Каждый фактор уже 0-100, веса суммируются в 1.0
  const weightedScore = deviceRisk * weights.device
    + geoRisk * weights.geo
    + networkRisk * weights.network
    + velocityRisk * weights.velocity;

  // Округляем и ограничиваем 0-100
  return Math.round(Math.min(Math.max(weightedScore, SCORE_RANGE.MIN), SCORE_RANGE.MAX));
}

/** Рассчитывает risk score используя конфигурируемые факторы */
export function calculateRiskScoreWithFactors(
  context: ScoringContext,
  factors: readonly FactorConfig[] = factorConfigs,
): number {
  // Автоматическое суммирование весов для валидации
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);

  // Валидация суммы весов (предупреждение при конфиг-ошибках)
  if (totalWeight > WEIGHT_VALIDATION.MAX_TOTAL || totalWeight < WEIGHT_VALIDATION.MIN_TOTAL) {
    // eslint-disable-next-line no-console -- Предупреждение о конфигурационных ошибках
    console.warn(
      `[risk-scoring] Сумма весов факторов выходит за допустимые пределы: ${
        totalWeight.toFixed(2)
      } (ожидается ~1.0)`,
    );
  }

  // Нормализация весов если сумма != 1.0
  const normalizedFactors = totalWeight !== 1.0
    ? factors.map((factor) => ({
      ...factor,
      weight: factor.weight / totalWeight,
    }))
    : factors;

  // Расчет weighted score через reduce
  const weightedScore = normalizedFactors.reduce(
    (sum, factor) => sum + factor.calculate(context) * factor.weight,
    0,
  );

  // Округляем и ограничиваем 0-100
  return Math.round(Math.min(Math.max(weightedScore, SCORE_RANGE.MIN), SCORE_RANGE.MAX));
}

/* ============================================================================
 * 🔧 DYNAMIC FACTOR LOADING (JSON/DB)
 * ============================================================================
 */

/** JSON представление конфигурации фактора (для загрузки из DB/JSON) */
export type FactorConfigJson = {
  /** Идентификатор фактора */
  readonly id: string;
  /** Вес фактора (0-1) */
  readonly weight: number;
  /** Тип фактора (для определения функции расчета) */
  readonly type: 'device' | 'geo' | 'network' | 'velocity' | 'custom';
  /** Идентификатор плагина для custom факторов (вместо eval) */
  readonly pluginId?: string;
};

/** Реестр функций расчета факторов по типу */
const factorCalculatorRegistry: ReadonlyMap<
  'device' | 'geo' | 'network' | 'velocity',
  ScoringFactor
> = Object.freeze(
  new Map(
    [
      ['device', (ctx: ScoringContext): number => calculateDeviceRisk(ctx.device)],
      [
        'geo',
        (ctx: ScoringContext): number => calculateGeoRisk(ctx.geo, ctx.signals?.previousGeo),
      ],
      [
        'network',
        (ctx: ScoringContext): number => calculateNetworkRisk(ctx.ip, ctx.signals),
      ],
      ['velocity', (ctx: ScoringContext): number => calculateVelocityRisk(ctx.signals)],
    ] as const,
  ),
) as ReadonlyMap<
  'device' | 'geo' | 'network' | 'velocity',
  ScoringFactor
>;

/** Идентификатор плагина для custom факторов */
type CustomFactorPluginId = {
  /** Идентификатор плагина */
  readonly id: string;
};

/** Функция расчета фактора для плагина */
type CustomFactorPluginCalculator = {
  /** Функция расчета фактора */
  readonly calculate: ScoringFactor;
};

/** Реестр плагинов для custom факторов (вместо eval) */
type CustomFactorPlugin = CustomFactorPluginId & CustomFactorPluginCalculator;

/** Реестр плагинов для custom факторов */
const customFactorPlugins = new Map<string, CustomFactorPlugin>();

/** Регистрирует плагин для custom фактора */
export function registerCustomFactorPlugin(plugin: CustomFactorPlugin): void {
  customFactorPlugins.set(plugin.id, plugin);
}

/** Получает плагин по идентификатору */
export function getCustomFactorPlugin(pluginId: string): CustomFactorPlugin | undefined {
  return customFactorPlugins.get(pluginId);
}

/** Валидирует JSON конфигурацию фактора */
function isValidFactorConfigJson(config: unknown): config is FactorConfigJson {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const cfg = config as Partial<FactorConfigJson>;

  if (typeof cfg.id !== 'string' || cfg.id.length === 0) {
    return false;
  }

  if (
    typeof cfg.weight !== 'number'
    || !Number.isFinite(cfg.weight)
    || cfg.weight < 0
    || cfg.weight > 1
  ) {
    return false;
  }

  if (
    cfg.type !== 'device'
    && cfg.type !== 'geo'
    && cfg.type !== 'network'
    && cfg.type !== 'velocity'
    && cfg.type !== 'custom'
  ) {
    return false;
  }

  if (cfg.type === 'custom' && (typeof cfg.pluginId !== 'string' || cfg.pluginId.length === 0)) {
    return false;
  }

  return true;
}

/** Создает FactorConfig из JSON конфигурации */
export function createFactorConfigFromJson(
  config: FactorConfigJson,
): FactorConfig | undefined {
  if (!isValidFactorConfigJson(config)) {
    return undefined;
  }

  // Для кастомных факторов используем плагинную систему (безопасно, без eval)
  if (config.type === 'custom') {
    if (config.pluginId === undefined) {
      return undefined;
    }

    const plugin = getCustomFactorPlugin(config.pluginId);
    if (plugin === undefined) {
      return undefined;
    }

    return {
      calculate: plugin.calculate,
      weight: config.weight,
    };
  }

  const calculate = factorCalculatorRegistry.get(config.type);
  if (calculate === undefined) {
    return undefined;
  }

  return {
    calculate,
    weight: config.weight,
  };
}

/** Создает массив FactorConfig из JSON конфигураций (для загрузки из DB/JSON) */
export function createFactorConfigsFromJson(
  configs: readonly FactorConfigJson[],
): readonly FactorConfig[] {
  const result: FactorConfig[] = [];

  for (const config of configs) {
    const factorConfig = createFactorConfigFromJson(config);
    if (factorConfig !== undefined) {
      result.push(factorConfig);
    }
  }

  return Object.freeze(result);
}

/** Загружает факторы из JSON и рассчитывает risk score */
export function calculateRiskScoreFromJson(
  context: ScoringContext,
  jsonConfigs: readonly FactorConfigJson[],
): number | undefined {
  const factors = createFactorConfigsFromJson(jsonConfigs);

  if (factors.length === 0) {
    return undefined;
  }

  return calculateRiskScoreWithFactors(context, factors);
}

/* ============================================================================
 * 🔧 ASYNC/ML FACTORS WITH SANDBOX & VALIDATION
 * ============================================================================
 */

/** Валидирует результат async фактора (sandbox для сохранения детерминизма) */
function validateAsyncFactorResult(
  score: number,
  metadata: FactorMetadata,
): number {
  // Проверка на NaN и Infinity
  if (!Number.isFinite(score)) {
    return 0;
  }

  // Проверка диапазона из метаданных
  const minScore = metadata.minScore ?? SCORE_RANGE.MIN;
  const maxScore = metadata.maxScore ?? SCORE_RANGE.MAX;

  if (score < minScore || score > maxScore) {
    return 0;
  }

  // Нормализация в диапазон 0-100
  return validateAndNormalizeScore(score);
}

/** Выполняет async фактор с таймаутом и валидацией (sandbox) */
async function executeAsyncFactorWithSandbox(
  factor: AsyncScoringFactor,
  context: ScoringContext,
  metadata: FactorMetadata,
): Promise<number> {
  const timeout = Math.min(
    metadata.timeout ?? ASYNC_FACTOR_CONSTANTS.DEFAULT_TIMEOUT,
    ASYNC_FACTOR_CONSTANTS.MAX_TIMEOUT,
  );

  try {
    // Выполнение с таймаутом и изоляцией (предотвращение cascading failure)
    const scorePromise = factor(context);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Таймаут с явным контролем (предотвращение hanging orchestration)
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Async factor timeout: ${metadata.id}`));
      }, timeout);
    });

    // Promise.race с таймаутом (изоляция для предотвращения cascading failure)
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Таймаут установлен выше, изоляция через catch блок
    const score = await Promise.race([scorePromise, timeoutPromise]);

    // Очистка таймера при успешном выполнении (изоляция)
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    // Валидация результата (sandbox)
    return validateAsyncFactorResult(score, metadata);
  } catch {
    // При любой ошибке возвращаем 0 (не ломаем детерминизм, изоляция от cascading failure)
    return 0;
  }
}

/** Рассчитывает risk score с поддержкой async/ML факторов */
export async function calculateRiskScoreWithAsyncFactors(
  context: ScoringContext,
  factors: readonly ExtendedFactorConfig[],
): Promise<number> {
  // Разделяем sync и async факторы для оптимизации
  const syncFactors: (FactorConfig & FactorMetadata)[] = [];
  const asyncFactors: (AsyncFactorConfig & FactorMetadata)[] = [];

  for (const factor of factors) {
    if (isAsyncFactor(factor)) {
      asyncFactors.push(factor);
    } else if (isSyncFactor(factor)) {
      syncFactors.push(factor);
    }
  }

  // Выполняем sync факторы сразу
  const syncScores = syncFactors.map((factor) => {
    const score = factor.calculate(context);
    return validateAsyncFactorResult(score, factor);
  });

  // Выполняем async факторы параллельно через Promise.allSettled (оптимизация)
  const asyncPromises = asyncFactors.map((factor) =>
    executeAsyncFactorWithSandbox(factor.calculateAsync, context, factor)
  );

  // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Таймауты установлены для каждого фактора
  const asyncResults = await Promise.allSettled(asyncPromises);
  const asyncScores = asyncResults.map((
    result,
  ) => (result.status === 'fulfilled' ? result.value : 0));

  // Объединяем результаты
  const scores = [...syncScores, ...asyncScores];
  const weights = [...syncFactors.map((f) => f.weight), ...asyncFactors.map((f) => f.weight)];

  // Валидация суммы весов (предупреждение при конфиг-ошибках)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight > WEIGHT_VALIDATION.MAX_TOTAL || totalWeight < WEIGHT_VALIDATION.MIN_TOTAL) {
    // eslint-disable-next-line no-console -- Предупреждение о конфигурационных ошибках
    console.warn(
      `[risk-scoring] Сумма весов факторов выходит за допустимые пределы: ${
        totalWeight.toFixed(2)
      } (ожидается ~1.0)`,
    );
  }

  // Нормализация весов
  const normalizedWeights = totalWeight !== 1.0
    ? weights.map((w) => w / totalWeight)
    : weights;

  // Расчет weighted score (безопасный доступ к массиву)
  const weightedScore = scores.reduce(
    (sum, score, index) => {
      // Безопасный доступ к массиву (предотвращение Object Injection)
      if (index < 0 || index >= normalizedWeights.length) {
        return sum;
      }
      // eslint-disable-next-line security/detect-object-injection -- Индекс валидирован выше, безопасный доступ
      const weight = normalizedWeights[index];
      return sum + (weight !== undefined ? score * weight : 0);
    },
    0,
  );

  // Округляем и ограничиваем 0-100
  return Math.round(Math.min(Math.max(weightedScore, SCORE_RANGE.MIN), SCORE_RANGE.MAX));
}

/* ============================================================================
 * 🔧 CACHING FOR HIGH-THROUGHPUT LOGIN FLOWS
 * ============================================================================
 */

/** Запись в кэше */
type CacheEntry = {
  /** Score */
  readonly score: number;
  /** Время создания (timestamp) */
  readonly timestamp: number;
};

/** Состояние кэша (functional approach вместо класса) */
type CacheState = {
  readonly cache: Map<string, CacheEntry>;
  readonly maxSize: number;
  readonly ttl: number;
};

/** Создает новое состояние кэша */
function createCacheState(
  maxSize: number = CACHE_CONSTANTS.MAX_SIZE,
  ttl: number = CACHE_TTL_MS,
): CacheState {
  return {
    cache: new Map<string, CacheEntry>(),
    maxSize,
    ttl,
  };
}

/**
 * Генерирует безопасный хэш контекста для кэширования (SHA256)
 * @note Использует JSON.stringify для сериализации. Убедитесь, что device.os и browser
 * являются примитивными типами (string/number/boolean), а не объектами, иначе сериализация
 * может быть некорректной (объекты сериализуются как "[object Object]")
 */
function hashContext(context: ScoringContext): string {
  const key = JSON.stringify({
    deviceType: context.device.deviceType,
    os: context.device.os,
    browser: context.device.browser,
    ip: context.ip,
    country: context.geo?.country,
    isVpn: context.signals?.isVpn,
    isTor: context.signals?.isTor,
    reputationScore: context.signals?.reputationScore,
    velocityScore: context.signals?.velocityScore,
  });

  // Безопасный криптографический хэш (SHA256) для предотвращения коллизий
  return createHash('sha256').update(key).digest('hex');
}

/** Получает score из кэша */
function getCachedScore(state: CacheState, context: ScoringContext): number | undefined {
  const key = hashContext(context);
  const entry = state.cache.get(key);

  if (entry === undefined) {
    return undefined;
  }

  // Проверка TTL
  const now = Date.now();
  if (now - entry.timestamp > state.ttl) {
    state.cache.delete(key);
    return undefined;
  }

  return entry.score;
}

/** Очищает устаревшие записи из кэша */
function cleanupExpiredEntries(state: CacheState): void {
  const now = Date.now();
  const entries = Array.from(state.cache.entries());
  for (const [key, entry] of entries) {
    if (now - entry.timestamp > state.ttl) {
      state.cache.delete(key);
    }
  }
}

/** Удаляет самую старую запись из кэша */
function removeOldestEntry(state: CacheState): void {
  const entries = Array.from(state.cache.entries());
  if (entries.length === 0) {
    return;
  }

  // Находим самую старую запись
  let oldestKey: string | undefined;
  let oldestTimestamp = Number.POSITIVE_INFINITY;

  for (const [key, entry] of entries) {
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
      oldestKey = key;
    }
  }

  if (oldestKey !== undefined) {
    state.cache.delete(oldestKey);
  }
}

/** Сохраняет score в кэш */
function setCachedScore(state: CacheState, context: ScoringContext, score: number): void {
  // Оптимизация: сначала очищаем expired, потом проверяем maxSize (избегаем двойного перебора)
  cleanupExpiredEntries(state);

  // Если кэш переполнен после очистки expired, удаляем самую старую запись
  if (state.cache.size >= state.maxSize) {
    removeOldestEntry(state);
  }

  const key = hashContext(context);
  state.cache.set(key, {
    score,
    timestamp: Date.now(),
  });
}

/** Очищает кэш */
function clearCache(state: CacheState): void {
  state.cache.clear();
}

/** Получает размер кэша */
function getCacheSize(state: CacheState): number {
  return state.cache.size;
}

/** Глобальное состояние кэша для scoring (для high-throughput login flows) */
const scoreCacheState = createCacheState();

/** Глобальное состояние кэша для async факторов */
const asyncScoreCacheState = createCacheState();

/** Рассчитывает risk score с кэшированием (для >10 факторов или high-throughput) */
export function calculateRiskScoreWithCache(
  context: ScoringContext,
  weights: RiskWeights = defaultRiskWeights,
  useCache: boolean = true,
): number {
  // Проверка кэша
  if (useCache) {
    const cached = getCachedScore(scoreCacheState, context);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Расчет score
  const score = calculateRiskScore(context, weights);

  // Сохранение в кэш
  if (useCache) {
    setCachedScore(scoreCacheState, context, score);
  }

  return score;
}

/** Рассчитывает risk score с async/ML факторами и кэшированием */
export async function calculateRiskScoreWithAsyncFactorsAndCache(
  context: ScoringContext,
  factors: readonly ExtendedFactorConfig[],
  useCache: boolean = true,
): Promise<number> {
  // Проверка кэша для async факторов
  if (useCache) {
    const cached = getCachedScore(asyncScoreCacheState, context);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Расчет score с async факторами (кэширование после await и с учетом таймаута/ошибок)
  // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Таймауты установлены внутри
  const score = await calculateRiskScoreWithAsyncFactors(context, factors);

  // Сохранение в кэш только при успешном расчете (после await)
  if (useCache) {
    setCachedScore(asyncScoreCacheState, context, score);
  }

  return score;
}

/** Очищает кэш scoring */
export function clearScoreCache(): void {
  clearCache(scoreCacheState);
}

/** Очищает кэш async scoring */
export function clearAsyncScoreCache(): void {
  clearCache(asyncScoreCacheState);
}

/** Получает размер кэша scoring */
export function getScoreCacheSize(): number {
  return getCacheSize(scoreCacheState);
}

/** Получает размер кэша async scoring */
export function getAsyncScoreCacheSize(): number {
  return getCacheSize(asyncScoreCacheState);
}

/* ============================================================================
 * 🔧 EXPORTS FOR EXTENSIBILITY
 * ============================================================================
 */

/** Конфигурация факторов scoring (для тестирования и расширения) */
export const scoringFactorConfigs = factorConfigs;

/** Реестр функций расчета факторов (для расширения) */
export const factorCalculatorRegistryExport = factorCalculatorRegistry;

/** Типы для расширения */
export type {
  AsyncFactorConfig,
  AsyncScoringFactor,
  ExtendedFactorConfig,
  FactorConfig,
  FactorMetadata,
  ScoringFactor,
};
