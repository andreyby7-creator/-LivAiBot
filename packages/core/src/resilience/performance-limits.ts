/**
 * @file packages/core/src/resilience/performance-limits.ts
 * ============================================================================
 * 🎯 CORE — Resilience Performance Limits (Pure Reliability Primitive)
 * ============================================================================
 *
 * Архитектурная роль:
 * Generic performance limits primitive для валидации и контроля лимитов
 * производительности операций. Предоставляет детерминированный API для
 * проверки лимитов без side-effects и глобального состояния.
 * Интегрируется с metrics.ts для создания метрик на основе результатов проверки.
 *
 * Принципы:
 * - ✅ SRP — валидация, проверка, нормализация и генерация метрик разделены
 * - ✅ Deterministic — нет скрытых часов/рандома, все значения передаются явно
 * - ✅ Domain-pure — без IO/логирования/глобального состояния/process.env
 * - ✅ Extensible — rule-engine через динамический маппинг LIMIT_EXTRACTORS (as const satisfies), новые лимиты добавляются без изменения core-логики
 * - ✅ Strict typing — union-типы для типов лимитов/результатов, Readonly<Record<PerformanceLimitType, ...>>, as const satisfies для type safety
 * - ✅ Functional style — immutable transformations, Object.freeze для всех структур данных
 * - ✅ Scalable — единая checkLimitByType, bulk API (checkLimits) для проверки нескольких лимитов одновременно, plug-and-play архитектура
 * - ✅ Performance — кеширование нормализованных конфигураций через WeakMap для high-frequency проверок (автоматическая очистка при удалении конфигурации)
 * - ✅ Metrics integration — функции-генераторы метрик (counter/gauge), валидация и escaping tags для безопасного экспорта в Prometheus/Influx, атомарное создание через createAllMetricsForLimit
 */

import { createCounterMetric, createGaugeMetric } from './metrics.js';
import type { MetricValue } from './metrics.js';

/* ============================================================================
 * 🧩 TYPES — PERFORMANCE LIMITS CONTRACT
 * ============================================================================
 */

/** Тип лимита производительности. */
export type PerformanceLimitType =
  | 'max_rules'
  | 'max_execution_time_ms'
  | 'max_plugins'
  | 'max_memory_mb'
  | 'max_concurrent_operations';

/** Результат проверки лимита. */
export type LimitCheckResult =
  | Readonly<{
    readonly withinLimit: true;
    readonly remaining: number;
    readonly limitType: PerformanceLimitType;
  }>
  | Readonly<{
    readonly withinLimit: false;
    readonly limit: number;
    readonly actual: number;
    readonly exceededBy: number;
    readonly limitType: PerformanceLimitType;
  }>;

/** Конфигурация лимитов производительности. */
export type PerformanceLimitsConfig = Readonly<{
  /** Максимальное количество правил. */
  readonly maxRules: number;
  /** Максимальное время выполнения (мс). */
  readonly maxExecutionTimeMs: number;
  /** Максимальное количество плагинов. */
  readonly maxPlugins: number;
  /** Максимальное использование памяти (MB, опционально). */
  readonly maxMemoryMb?: number;
  /** Максимальное количество одновременных операций (опционально). */
  readonly maxConcurrentOperations?: number;
}>;

/** Результат валидации конфигурации лимитов. */
export type LimitsValidationResult =
  | Readonly<{
    readonly valid: true;
    readonly normalized: PerformanceLimitsConfig;
  }>
  | Readonly<{
    readonly valid: false;
    readonly errors: readonly LimitsValidationError[];
  }>;

/** Ошибка валидации лимита. */
export type LimitsValidationError = Readonly<{
  readonly limitType: PerformanceLimitType;
  readonly reason: LimitsValidationErrorReason;
  readonly value: number;
}>;

/** Причина ошибки валидации. */
export type LimitsValidationErrorReason =
  | 'must_be_positive'
  | 'must_be_non_negative'
  | 'must_be_finite'
  | 'exceeds_maximum';

/* ============================================================================
 * 🔧 DEFAULTS
 * ============================================================================
 */

const DEFAULT_MAX_RULES = 50;
const DEFAULT_MAX_EXECUTION_TIME_MS = 10;
const DEFAULT_MAX_PLUGINS = 20;
const DEFAULT_MAX_MEMORY_MB = 100;
const DEFAULT_MAX_CONCURRENT_OPERATIONS = 10;

/** Дефолтная fail-safe конфигурация лимитов производительности. */
export const DEFAULT_PERFORMANCE_LIMITS_CONFIG: PerformanceLimitsConfig = Object.freeze({
  maxRules: DEFAULT_MAX_RULES,
  maxExecutionTimeMs: DEFAULT_MAX_EXECUTION_TIME_MS,
  maxPlugins: DEFAULT_MAX_PLUGINS,
  maxMemoryMb: DEFAULT_MAX_MEMORY_MB,
  maxConcurrentOperations: DEFAULT_MAX_CONCURRENT_OPERATIONS,
});

/* ============================================================================
 * 🔧 INTERNAL HELPERS
 * ============================================================================
 */

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeConfig(
  config: Readonly<PerformanceLimitsConfig>,
): PerformanceLimitsConfig {
  return Object.freeze({
    maxRules: normalizePositiveInteger(
      config.maxRules,
      DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxRules,
    ),
    maxExecutionTimeMs: normalizePositiveInteger(
      config.maxExecutionTimeMs,
      DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxExecutionTimeMs,
    ),
    maxPlugins: normalizeNonNegativeInteger(
      config.maxPlugins,
      DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxPlugins,
    ),
    ...(config.maxMemoryMb !== undefined && {
      maxMemoryMb: normalizePositiveInteger(
        config.maxMemoryMb,
        DEFAULT_MAX_MEMORY_MB,
      ),
    }),
    ...(config.maxConcurrentOperations !== undefined && {
      maxConcurrentOperations: normalizePositiveInteger(
        config.maxConcurrentOperations,
        DEFAULT_MAX_CONCURRENT_OPERATIONS,
      ),
    }),
  });
}

function validateLimitValue(
  limitType: PerformanceLimitType,
  value: number,
  requirePositive: boolean,
): LimitsValidationError | null {
  if (!Number.isFinite(value)) {
    return Object.freeze({
      limitType,
      reason: 'must_be_finite',
      value,
    });
  }

  if (requirePositive && value <= 0) {
    return Object.freeze({
      limitType,
      reason: 'must_be_positive',
      value,
    });
  }

  if (!requirePositive && value < 0) {
    return Object.freeze({
      limitType,
      reason: 'must_be_non_negative',
      value,
    });
  }

  return null;
}

function validateActualValue(actual: number): boolean {
  return Number.isFinite(actual) && actual >= 0;
}

/**
 * Экранирует значение тега для безопасного экспорта в Prometheus/Influx.
 * Заменяет специальные символы на безопасные эквиваленты.
 */
function escapeMetricTagValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Экранируем обратный слэш
    .replace(/"/g, '\\"') // Экранируем кавычки
    .replace(/\n/g, '\\n') // Экранируем переносы строк
    .replace(/\r/g, '\\r') // Экранируем возврат каретки
    .replace(/\t/g, '\\t') // Экранируем табуляцию
    .replace(/=/g, '\\=') // Экранируем знак равенства (Prometheus)
    .replace(/,/g, '\\,') // Экранируем запятую (Prometheus)
    .replace(/\s+/g, '_'); // Заменяем пробелы на подчеркивания
}

function validateMetricTags(tags: Readonly<Record<string, string>>): boolean {
  const maxTagKeyLength = 200;
  const maxTagValueLength = 200;
  const invalidChars = /[^a-zA-Z0-9_\-:.]/;

  return Object.entries(tags).every(([key, value]) => {
    if (key.length === 0 || key.length > maxTagKeyLength) {
      return false;
    }
    if (invalidChars.test(key)) {
      return false;
    }
    if (value.length === 0 || value.length > maxTagValueLength) {
      return false;
    }
    return true;
  });
}

function createMetricTags(
  limitType: PerformanceLimitType,
  limit: number,
  actual: number,
  exceededBy?: number,
  remaining?: number,
  additionalTags?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const baseTags: Record<string, string> = {
    limit_type: limitType,
    limit: String(limit),
    actual: String(actual),
    ...(exceededBy !== undefined && { exceeded_by: String(exceededBy) }),
    ...(remaining !== undefined && { remaining: String(remaining) }),
  };

  // Экранируем пользовательские теги для безопасности
  const escapedAdditionalTags = additionalTags
    ? Object.fromEntries(
      Object.entries(additionalTags).map(([key, value]) => [
        key,
        escapeMetricTagValue(value),
      ]),
    )
    : undefined;

  const merged = { ...baseTags, ...escapedAdditionalTags };
  return Object.freeze(merged);
}

type LimitExtractor = (config: Readonly<PerformanceLimitsConfig>) => number;

const LIMIT_EXTRACTORS = Object.freeze(
  {
    max_rules: (config) => config.maxRules,
    max_execution_time_ms: (config) => config.maxExecutionTimeMs,
    max_plugins: (config) => config.maxPlugins,
    max_memory_mb: (config) => config.maxMemoryMb ?? DEFAULT_MAX_MEMORY_MB,
    max_concurrent_operations: (config) =>
      config.maxConcurrentOperations ?? DEFAULT_MAX_CONCURRENT_OPERATIONS,
  } as const satisfies Record<PerformanceLimitType, LimitExtractor>,
);

/* ============================================================================
 * 🎯 API — LIMITS VALIDATION & CHECKING
 * ============================================================================
 */

/**
 * Валидирует конфигурацию лимитов производительности.
 * Возвращает нормализованную конфигурацию или список ошибок.
 */
export function validatePerformanceLimits(
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов для валидации
): LimitsValidationResult {
  const validationResults = [
    validateLimitValue('max_rules', config.maxRules, true),
    validateLimitValue('max_execution_time_ms', config.maxExecutionTimeMs, true),
    validateLimitValue('max_plugins', config.maxPlugins, false),
    config.maxMemoryMb !== undefined
      ? validateLimitValue('max_memory_mb', config.maxMemoryMb, true)
      : null,
    config.maxConcurrentOperations !== undefined
      ? validateLimitValue('max_concurrent_operations', config.maxConcurrentOperations, true)
      : null,
  ];

  const errors = validationResults.filter(
    (error): error is LimitsValidationError => error !== null,
  );

  if (errors.length > 0) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(errors),
    });
  }

  return Object.freeze({
    valid: true,
    normalized: normalizeConfig(config),
  });
}

/**
 * Кеш для нормализованных конфигураций.
 * Используется для оптимизации high-frequency проверок лимитов.
 * Ключ - конфигурация, значение - нормализованная конфигурация.
 * @note WeakMap автоматически очищает записи при удалении конфигурации из памяти.
 * Это предотвращает утечки памяти и делает кеш подходящим для долгоживущих конфигураций.
 * Для очень больших конфигураций (тысячи уникальных объектов) можно рассмотреть LRU-cache,
 * но для большинства случаев WeakMap достаточно эффективен.
 */
const normalizedConfigCache = new WeakMap<
  Readonly<PerformanceLimitsConfig>,
  PerformanceLimitsConfig
>();

function getNormalizedConfig(config: Readonly<PerformanceLimitsConfig>): PerformanceLimitsConfig {
  const cached = normalizedConfigCache.get(config);
  if (cached) {
    return cached;
  }

  const normalized = normalizeConfig(config);
  normalizedConfigCache.set(config, normalized);
  return normalized;
}

/**
 * Единая функция проверки лимита по типу.
 * Использует динамический маппинг для извлечения лимита из конфигурации.
 * Добавляет новые лимиты без изменения core-логики.
 * @note Precision loss: Для дробных значений (например, время в ms с float, память в MB)
 * применяется Math.floor при вычислении remaining и exceededBy для консистентности
 * целочисленных результатов. Это означает, что 10.9ms будет округлено до 10ms,
 * а 100.7MB до 100MB. Для точных измерений используйте целочисленные значения.
 */
export function checkLimitByType(
  limitType: PerformanceLimitType, // Тип лимита для проверки
  actual: number, // Текущее значение (может быть дробным, будет округлено вниз через Math.floor)
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
): LimitCheckResult {
  if (!validateActualValue(actual)) {
    // Для невалидных actual возвращаем превышение с нулевым лимитом
    return Object.freeze({
      withinLimit: false,
      limit: 0,
      actual,
      exceededBy: actual,
      limitType,
    });
  }

  const normalized = getNormalizedConfig(config);
  const extractor = LIMIT_EXTRACTORS[limitType];
  const limit = extractor(normalized);
  // Округление вниз для консистентности: дробные значения (10.9ms → 10ms, 100.7MB → 100MB)
  // приводятся к целым числам для всех расчетов remaining и exceededBy
  const actualFloored = Math.floor(actual);
  const limitFloored = Math.floor(limit);

  if (actualFloored <= limitFloored) {
    return Object.freeze({
      withinLimit: true,
      remaining: Math.floor(limitFloored - actualFloored),
      limitType,
    });
  }

  return Object.freeze({
    withinLimit: false,
    limit: limitFloored,
    actual: actualFloored,
    exceededBy: Math.floor(actualFloored - limitFloored),
    limitType,
  });
}

/** Проверяет, не превышен ли лимит для количества правил. */
export function checkRulesLimit(
  actual: number, // Текущее количество правил
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
): LimitCheckResult {
  return checkLimitByType('max_rules', actual, config);
}

/** Проверяет, не превышен ли лимит для времени выполнения. */
export function checkExecutionTimeLimit(
  actualMs: number, // Текущее время выполнения (мс)
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
): LimitCheckResult {
  return checkLimitByType('max_execution_time_ms', actualMs, config);
}

/** Проверяет, не превышен ли лимит для количества плагинов. */
export function checkPluginsLimit(
  actual: number, // Текущее количество плагинов
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
): LimitCheckResult {
  return checkLimitByType('max_plugins', actual, config);
}

/** Проверяет, не превышен ли лимит для использования памяти. */
export function checkMemoryLimit(
  actualMb: number, // Текущее использование памяти (MB)
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
): LimitCheckResult {
  return checkLimitByType('max_memory_mb', actualMb, config);
}

/** Проверяет, не превышен ли лимит для одновременных операций. */
export function checkConcurrentOperationsLimit(
  actual: number, // Текущее количество одновременных операций
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
): LimitCheckResult {
  return checkLimitByType('max_concurrent_operations', actual, config);
}

/**
 * Bulk API: проверяет несколько лимитов одновременно.
 * Оптимизировано для случаев, когда нужно проверить все лимиты pipeline за один вызов.
 * @note Precision loss: Для дробных значений применяется Math.floor (см. checkLimitByType).
 */
export function checkLimits(
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация лимитов
  actuals: Readonly<Record<PerformanceLimitType, number>>, // Текущие значения для каждого типа лимита
): Readonly<Record<PerformanceLimitType, LimitCheckResult>> {
  return Object.freeze({
    max_rules: checkLimitByType('max_rules', actuals.max_rules, config),
    max_execution_time_ms: checkLimitByType(
      'max_execution_time_ms',
      actuals.max_execution_time_ms,
      config,
    ),
    max_plugins: checkLimitByType('max_plugins', actuals.max_plugins, config),
    max_memory_mb: checkLimitByType('max_memory_mb', actuals.max_memory_mb, config),
    max_concurrent_operations: checkLimitByType(
      'max_concurrent_operations',
      actuals.max_concurrent_operations,
      config,
    ),
  });
}

/**
 * Создает конфигурацию лимитов с переопределением значений.
 * Нормализует и валидирует значения автоматически.
 */
export function createPerformanceLimitsConfig(
  overrides: Partial<Readonly<PerformanceLimitsConfig>> = {}, // Частичные переопределения дефолтных значений
): PerformanceLimitsConfig {
  const merged = Object.freeze({
    ...DEFAULT_PERFORMANCE_LIMITS_CONFIG,
    ...overrides,
  });
  return normalizeConfig(merged);
}

/* ============================================================================
 * 📊 METRICS INTEGRATION — GENERATORS
 * ============================================================================
 */

/**
 * Создает counter метрику для отслеживания превышений лимита.
 * Используется для мониторинга количества нарушений лимитов.
 */
export function createLimitExceededMetric(
  checkResult: Readonly<LimitCheckResult>, // Результат проверки лимита
  timestampMs: number, // Временная метка события
  tags?: Readonly<Record<string, string>>, // Опциональные теги для контекста
): MetricValue | null {
  if (checkResult.withinLimit) {
    return null;
  }

  // TypeScript type narrowing: после проверки withinLimit === false
  // checkResult имеет тип с полями limit, actual, exceededBy
  const exceededResult = checkResult as Readonly<{
    readonly withinLimit: false;
    readonly limit: number;
    readonly actual: number;
    readonly exceededBy: number;
    readonly limitType: PerformanceLimitType;
  }>;

  const metricTags = createMetricTags(
    exceededResult.limitType,
    exceededResult.limit,
    exceededResult.actual,
    exceededResult.exceededBy,
    undefined,
    tags,
  );

  if (!validateMetricTags(metricTags)) {
    // Возвращаем метрику без дополнительных тегов при невалидных tags
    const safeTags = createMetricTags(
      exceededResult.limitType,
      exceededResult.limit,
      exceededResult.actual,
      exceededResult.exceededBy,
    );
    return createCounterMetric(
      `performance_limit_exceeded_${exceededResult.limitType}`,
      1,
      timestampMs,
      'count',
      safeTags,
    );
  }

  return createCounterMetric(
    `performance_limit_exceeded_${exceededResult.limitType}`,
    1,
    timestampMs,
    'count',
    metricTags,
  );
}

/**
 * Создает gauge метрику для отслеживания использования лимита (в процентах).
 * Для превышенных лимитов возвращает 100%+ использование.
 * Для лимитов в пределах нормы требует явного указания лимита через config.
 * @note Precision loss: Для дробных значений применяется Math.floor при вычислениях
 * для консистентности. Например, 10.9ms округляется до 10ms, 100.7MB до 100MB.
 */
export function createLimitUsageMetric(
  checkResult: Readonly<LimitCheckResult>, // Результат проверки лимита
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация для получения лимита
  timestampMs: number, // Временная метка события
  tags?: Readonly<Record<string, string>>, // Опциональные теги для контекста
): MetricValue {
  if (checkResult.withinLimit) {
    // Вычисляем лимит из конфига по типу
    const normalized = getNormalizedConfig(config);
    const extractor = LIMIT_EXTRACTORS[checkResult.limitType];
    const limit = extractor(normalized);
    const actual = limit - checkResult.remaining;
    const usagePercent = limit > 0 ? Math.min(100, (actual / limit) * 100) : 0;

    const metricTags = createMetricTags(
      checkResult.limitType,
      limit,
      actual,
      undefined,
      checkResult.remaining,
      tags,
    );

    const safeTags = validateMetricTags(metricTags)
      ? metricTags
      : createMetricTags(checkResult.limitType, limit, actual, undefined, checkResult.remaining);

    return createGaugeMetric(
      `performance_limit_usage_${checkResult.limitType}`,
      usagePercent,
      timestampMs,
      'percent',
      safeTags,
    );
  }

  // Для превышенных лимитов вычисляем процент превышения
  // TypeScript type narrowing: после проверки withinLimit === false
  // checkResult имеет тип с полями limit, actual, exceededBy
  const exceededResult = checkResult as Readonly<{
    readonly withinLimit: false;
    readonly limit: number;
    readonly actual: number;
    readonly exceededBy: number;
    readonly limitType: PerformanceLimitType;
  }>;

  const usagePercent = exceededResult.limit > 0
    ? ((exceededResult.actual / exceededResult.limit) * 100)
    : 100;

  const metricTags = createMetricTags(
    exceededResult.limitType,
    exceededResult.limit,
    exceededResult.actual,
    exceededResult.exceededBy,
    undefined,
    tags,
  );

  const safeTags = validateMetricTags(metricTags)
    ? metricTags
    : createMetricTags(
      exceededResult.limitType,
      exceededResult.limit,
      exceededResult.actual,
      exceededResult.exceededBy,
    );

  return createGaugeMetric(
    `performance_limit_usage_${exceededResult.limitType}`,
    usagePercent,
    timestampMs,
    'percent',
    safeTags,
  );
}

/**
 * Создает gauge метрику для отслеживания использования лимита с явным указанием лимита.
 * Позволяет точно вычислить процент использования даже когда лимит не превышен.
 * @note Precision loss: Для дробных значений применяется Math.floor для консистентности
 * целочисленных результатов. Например, actual=10.9, limit=100 → actualFloored=10, usage=10%.
 */
export function createLimitUsageGaugeMetric(
  actual: number, // Текущее значение (может быть дробным, будет округлено вниз)
  limit: number, // Лимит (может быть дробным, будет округлено вниз)
  limitType: PerformanceLimitType, // Тип лимита
  timestampMs: number, // Временная метка события
  tags?: Readonly<Record<string, string>>, // Опциональные теги для контекста
): MetricValue {
  // Округление вниз для консистентности: дробные значения приводятся к целым числам
  const actualFloored = Math.floor(actual);
  const limitFloored = Math.floor(limit);
  const usagePercent = limitFloored > 0 ? Math.min(100, (actualFloored / limitFloored) * 100) : 0;
  const remaining = Math.max(0, limitFloored - actualFloored);

  const metricTags = createMetricTags(
    limitType,
    limitFloored,
    actualFloored,
    undefined,
    remaining,
    tags,
  );

  const safeTags = validateMetricTags(metricTags)
    ? metricTags
    : createMetricTags(limitType, limitFloored, actualFloored, undefined, remaining);

  return createGaugeMetric(
    `performance_limit_usage_${limitType}`,
    usagePercent,
    timestampMs,
    'percent',
    safeTags,
  );
}

/** Создает gauge метрику для отслеживания оставшегося ресурса лимита. */
export function createLimitRemainingMetric(
  checkResult: Readonly<LimitCheckResult>, // Результат проверки лимита
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация для получения лимита
  timestampMs: number, // Временная метка события
  tags?: Readonly<Record<string, string>>, // Опциональные теги для контекста
): MetricValue | null {
  if (!checkResult.withinLimit) {
    return null;
  }

  const normalized = getNormalizedConfig(config);
  const extractor = LIMIT_EXTRACTORS[checkResult.limitType];
  const limit = extractor(normalized);

  const metricTags = createMetricTags(
    checkResult.limitType,
    limit,
    checkResult.remaining,
    undefined,
    checkResult.remaining,
    tags,
  );

  const safeTags = validateMetricTags(metricTags)
    ? metricTags
    : createMetricTags(
      checkResult.limitType,
      limit,
      checkResult.remaining,
      undefined,
      checkResult.remaining,
    );

  return createGaugeMetric(
    `performance_limit_remaining_${checkResult.limitType}`,
    checkResult.remaining,
    timestampMs,
    'count',
    safeTags,
  );
}

/**
 * Создает все метрики для лимита атомарно.
 * Уменьшает дублирование вызовов и обеспечивает консистентность метрик.
 */
export function createAllMetricsForLimit(
  checkResult: Readonly<LimitCheckResult>, // Результат проверки лимита
  config: Readonly<PerformanceLimitsConfig>, // Конфигурация для получения лимита
  timestampMs: number, // Временная метка события
  tags?: Readonly<Record<string, string>>, // Опциональные теги для контекста
): readonly MetricValue[] {
  // Всегда создаем usage метрику
  const usageMetric = createLimitUsageMetric(checkResult, config, timestampMs, tags);

  // Создаем remaining или exceeded метрику в зависимости от результата
  const additionalMetric = checkResult.withinLimit
    ? createLimitRemainingMetric(checkResult, config, timestampMs, tags)
    : createLimitExceededMetric(checkResult, timestampMs, tags);

  const metrics = additionalMetric
    ? [usageMetric, additionalMetric]
    : [usageMetric];

  return Object.freeze(metrics);
}
