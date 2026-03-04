/**
 * @file packages/core/src/resilience/metrics.ts
 * ============================================================================
 * 🎯 CORE — Resilience Metrics (Pure Reliability Primitive)
 * ============================================================================
 * Архитектурная роль:
 * Generic metrics primitive для агрегации и анализа метрик производительности,
 * надежности и SLA-индикаторов. Предоставляет детерминированный API для
 * накопления, агрегации и анализа временных рядов метрик.
 * Принципы:
 * - ✅ SRP — сбор, агрегация и анализ метрик разделены
 * - ✅ Deterministic — нет скрытых часов/рандома, время передается явно
 * - ✅ Domain-pure — без IO/логирования/глобального состояния
 * - ✅ Extensible — policy-конфигурация меняет поведение без изменения core-алгоритма
 * - ✅ Strict typing — union-типы для типов метрик/агрегаций, без stringly-typed API
 * - ✅ Functional style — immutable transformations через reduce/map/filter, без мутаций
 * - ✅ Production-grade — оптимизации (ensureFrozenArray для immutable массивов, линейная интерполяция квантилей)
 * - ✅ Immutability guarantees — deep freeze для tags, frozen arrays для защиты от downstream мутаций
 */

/* ============================================================================
 * 🧩 TYPES — METRICS CONTRACT
 * ============================================================================
 */

/** Тип метрики. */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/** Единица измерения метрики. */
export type MetricUnit =
  | 'count'
  | 'bytes'
  | 'milliseconds'
  | 'seconds'
  | 'percent'
  | 'ratio'
  | 'none';

/** Значение метрики (immutable). */
export type MetricValue = Readonly<{
  /** Тип метрики. */
  readonly type: MetricType;
  /** Имя метрики (идентификатор). */
  readonly name: string;
  /** Значение (для counter/gauge — число, для histogram — массив значений). */
  readonly value: number | readonly number[];
  /** Единица измерения. */
  readonly unit: MetricUnit;
  /** Временная метка (передается извне для детерминизма). */
  readonly timestampMs: number;
  /** Опциональные теги для фильтрации/группировки (immutable). */
  readonly tags?: Readonly<Record<string, string>>;
}>;

/** Агрегированная метрика за временное окно. */
export type AggregatedMetric = Readonly<{
  /** Имя метрики. */
  readonly name: string;
  /** Тип метрики. */
  readonly type: MetricType;
  /** Единица измерения. */
  readonly unit: MetricUnit;
  /** Временное окно (start, end). */
  readonly window: Readonly<{
    readonly startMs: number;
    readonly endMs: number;
  }>;
  /** Количество значений в окне. */
  readonly count: number;
  /** Агрегированные значения (зависит от типа метрики). */
  readonly aggregates: MetricAggregates;
  /** Опциональные теги. */
  readonly tags?: Readonly<Record<string, string>>;
}>;

/** Агрегированные значения метрики (union-тип для type-safety). */
export type MetricAggregates =
  | Readonly<{
    readonly kind: 'counter' | 'gauge';
    readonly sum: number;
    readonly min: number;
    readonly max: number;
    readonly last: number;
  }>
  | Readonly<{
    readonly kind: 'histogram';
    readonly sum: number;
    readonly min: number;
    readonly max: number;
    readonly count: number;
    readonly buckets: Readonly<Record<string, number>>;
  }>
  | Readonly<{
    readonly kind: 'summary';
    readonly sum: number;
    readonly min: number;
    readonly max: number;
    readonly count: number;
    readonly quantiles: Readonly<Record<string, number>>;
  }>;

/** Конфигурация агрегации метрик. */
export type MetricsAggregationConfig = Readonly<{
  /** Размер временного окна для агрегации (в ms). */
  readonly windowSizeMs: number;
  /** Опциональные границы для histogram buckets. */
  readonly histogramBuckets?: readonly number[];
  /** Опциональные квантили для summary (0..1). */
  readonly summaryQuantiles?: readonly number[];
  /** Максимальное количество метрик в окне (для защиты от переполнения). */
  readonly maxMetricsPerWindow?: number;
}>;

/** Состояние метрик (накопленные значения в окне). */
export type MetricsState = Readonly<{
  /** Текущее окно (start timestamp). */
  readonly currentWindowStartMs: number;
  /** Метрики в текущем окне (immutable array). */
  readonly metrics: readonly MetricValue[];
  /** Опциональные теги для фильтрации. */
  readonly tags?: Readonly<Record<string, string>>;
}>;

/** Результат добавления метрики. */
export type MetricAddResult =
  | Readonly<{
    readonly success: true;
    readonly nextState: MetricsState;
  }>
  | Readonly<{
    readonly success: false;
    readonly reason: MetricAddFailureReason;
    readonly nextState: MetricsState;
  }>;

/** Причина отказа в добавлении метрики. */
export type MetricAddFailureReason =
  | 'window_overflow'
  | 'invalid_value'
  | 'timestamp_out_of_order';

/** Результат агрегации метрик. */
export type MetricsAggregationResult = Readonly<{
  /** Агрегированные метрики (сгруппированы по name). */
  readonly aggregated: readonly AggregatedMetric[];
  /** Количество обработанных метрик. */
  readonly processedCount: number;
  /** Количество пропущенных метрик (out-of-window). */
  readonly skippedCount: number;
}>;

/* ============================================================================
 * 🔧 DEFAULTS
 * ============================================================================
 */

const DEFAULT_WINDOW_SIZE_MS = 60_000; // 1 минута
const DEFAULT_MAX_METRICS_PER_WINDOW = 10_000;

// Histogram bucket boundaries (Prometheus-style defaults)
const histogramBucket0005 = 0.005;
const histogramBucket001 = 0.01;
const histogramBucket0025 = 0.025;
const histogramBucket005 = 0.05;
const histogramBucket01 = 0.1;
const histogramBucket025 = 0.25;
const histogramBucket05 = 0.5;
const histogramBucket1 = 1;
const histogramBucket25 = 2.5;
const histogramBucket5 = 5;
const histogramBucket10 = 10;

const DEFAULT_HISTOGRAM_BUCKETS: readonly number[] = Object.freeze([
  histogramBucket0005,
  histogramBucket001,
  histogramBucket0025,
  histogramBucket005,
  histogramBucket01,
  histogramBucket025,
  histogramBucket05,
  histogramBucket1,
  histogramBucket25,
  histogramBucket5,
  histogramBucket10,
]);

// Summary quantiles (common percentiles)
const quantileP50 = 0.5;
const quantileP75 = 0.75;
const quantileP90 = 0.9;
const quantileP95 = 0.95;
const quantileP99 = 0.99;
const quantileP999 = 0.999;

const DEFAULT_SUMMARY_QUANTILES: readonly number[] = Object.freeze([
  quantileP50,
  quantileP75,
  quantileP90,
  quantileP95,
  quantileP99,
  quantileP999,
]);

/** Дефолтная fail-safe конфигурация агрегации метрик. */
export const DEFAULT_METRICS_AGGREGATION_CONFIG: MetricsAggregationConfig = Object.freeze({
  windowSizeMs: DEFAULT_WINDOW_SIZE_MS,
  histogramBuckets: DEFAULT_HISTOGRAM_BUCKETS,
  summaryQuantiles: DEFAULT_SUMMARY_QUANTILES,
  maxMetricsPerWindow: DEFAULT_MAX_METRICS_PER_WINDOW,
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

function normalizeConfig(
  config: Readonly<MetricsAggregationConfig>,
): MetricsAggregationConfig {
  return Object.freeze({
    windowSizeMs: normalizePositiveInteger(
      config.windowSizeMs,
      DEFAULT_METRICS_AGGREGATION_CONFIG.windowSizeMs,
    ),
    histogramBuckets: config.histogramBuckets ?? DEFAULT_HISTOGRAM_BUCKETS,
    summaryQuantiles: config.summaryQuantiles ?? DEFAULT_SUMMARY_QUANTILES,
    maxMetricsPerWindow: normalizePositiveInteger(
      config.maxMetricsPerWindow ?? DEFAULT_MAX_METRICS_PER_WINDOW,
      DEFAULT_MAX_METRICS_PER_WINDOW,
    ),
  });
}

/**
 * Глубоко замораживает теги для гарантии immutability.
 * Защищает от мутаций вложенных объектов downstream-кодом.
 */
function deepFreezeTags(
  tags: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  // Для Record<string, string> deep freeze эквивалентен обычному freeze,
  // так как значения примитивные (string). Но делаем явно для консистентности
  // и на случай будущих изменений структуры тегов.
  return Object.freeze(tags);
}

/**
 * Создает frozen копию массива, если он еще не frozen.
 * Оптимизация: пропускает копирование для уже immutable массивов.
 */
function ensureFrozenArray(values: readonly number[]): readonly number[] {
  if (Object.isFrozen(values)) {
    return values;
  }
  return Object.freeze([...values]);
}

/**
 * Сериализует теги в строку для использования в качестве ключа группировки.
 * Гарантирует детерминированный порядок: сортирует ключи лексикографически.
 */
function serializeTags(tags: Readonly<Record<string, string>> | undefined): string {
  if (tags === undefined) {
    return '';
  }
  return Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

function getWindowStartMs(timestampMs: number, windowSizeMs: number): number {
  return Math.floor(timestampMs / windowSizeMs) * windowSizeMs;
}

function isValueInWindow(
  timestampMs: number,
  windowStartMs: number,
  windowSizeMs: number,
): boolean {
  const windowEndMs = windowStartMs + windowSizeMs;
  return timestampMs >= windowStartMs && timestampMs < windowEndMs;
}

function refreshWindow(
  state: Readonly<MetricsState>,
  config: Readonly<MetricsAggregationConfig>,
  nowMs: number,
): MetricsState {
  const normalizedConfig = normalizeConfig(config);
  const newWindowStartMs = getWindowStartMs(nowMs, normalizedConfig.windowSizeMs);

  if (newWindowStartMs === state.currentWindowStartMs) {
    return state;
  }

  return Object.freeze({
    ...state,
    currentWindowStartMs: newWindowStartMs,
    metrics: Object.freeze([]),
  });
}

function validateMetricValue(value: MetricValue): boolean {
  if (!Number.isFinite(value.timestampMs) || value.timestampMs < 0) {
    return false;
  }

  if (value.type === 'counter' || value.type === 'gauge') {
    return typeof value.value === 'number' && Number.isFinite(value.value);
  }

  if (value.type === 'histogram') {
    return Array.isArray(value.value) && value.value.every((v) => Number.isFinite(v) && v >= 0);
  }

  // После проверки counter, gauge, histogram остаётся только summary
  return Array.isArray(value.value) && value.value.every((v) => Number.isFinite(v) && v >= 0);
}

function calculateHistogramBuckets(
  values: readonly number[],
  buckets: readonly number[],
): Readonly<Record<string, number>> {
  const sortedBuckets = [...buckets].sort((a, b) => a - b);

  const initialBuckets = sortedBuckets.reduce(
    (acc, bucket) => {
      return { ...acc, [String(bucket)]: 0 };
    },
    { '+Inf': 0 } as Record<string, number>,
  );

  const result = values.reduce(
    (acc, value) => {
      const matchingBucket = sortedBuckets.find((bucket) => value <= bucket);
      if (matchingBucket !== undefined) {
        return { ...acc, [String(matchingBucket)]: (acc[String(matchingBucket)] ?? 0) + 1 };
      }
      return { ...acc, '+Inf': (acc['+Inf'] ?? 0) + 1 };
    },
    initialBuckets,
  );

  return Object.freeze(result);
}

function calculateQuantiles(
  values: readonly number[],
  quantiles: readonly number[],
): Readonly<Record<string, number>> {
  if (values.length === 0) {
    const result = quantiles.reduce(
      (acc, q) => {
        return { ...acc, [String(q)]: 0 };
      },
      {} as Record<string, number>,
    );
    return Object.freeze(result);
  }

  const sorted = [...values].sort((a, b) => a - b);

  const result = quantiles.reduce(
    (acc, q) => {
      const exactIndex = (sorted.length - 1) * q;
      const lowerIndex = Math.floor(exactIndex);
      const upperIndex = Math.ceil(exactIndex);
      const fraction = exactIndex - lowerIndex;

      // Линейная интерполяция для более точных квантилей
      const lowerValue = sorted[Math.max(0, Math.min(lowerIndex, sorted.length - 1))] ?? 0;
      const upperValue = sorted[Math.max(0, Math.min(upperIndex, sorted.length - 1))] ?? 0;
      const interpolatedValue = lowerValue + fraction * (upperValue - lowerValue);

      return { ...acc, [String(q)]: interpolatedValue };
    },
    {} as Record<string, number>,
  );

  return Object.freeze(result);
}

function aggregateCounterOrGauge(
  metrics: readonly MetricValue[],
): MetricAggregates {
  const values = metrics.map((m) => m.value as number);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const last = values.length > 0 ? values[values.length - 1] ?? 0 : 0;

  return Object.freeze({
    kind: metrics[0]?.type === 'counter' ? 'counter' : 'gauge',
    sum,
    min,
    max,
    last,
  });
}

function aggregateHistogram(
  metrics: readonly MetricValue[],
  buckets: readonly number[],
): MetricAggregates {
  const allValues = metrics
    .filter((m) => Array.isArray(m.value))
    .flatMap((m) => m.value as readonly number[]);

  const sum = allValues.reduce((acc, v) => acc + v, 0);
  const min = allValues.length > 0 ? Math.min(...allValues) : 0;
  const max = allValues.length > 0 ? Math.max(...allValues) : 0;
  const count = allValues.length;
  const histogramBuckets = calculateHistogramBuckets(allValues, buckets);

  return Object.freeze({
    kind: 'histogram',
    sum,
    min,
    max,
    count,
    buckets: histogramBuckets,
  });
}

function aggregateSummary(
  metrics: readonly MetricValue[],
  quantiles: readonly number[],
): MetricAggregates {
  const allValues = metrics
    .filter((m) => Array.isArray(m.value))
    .flatMap((m) => m.value as readonly number[]);

  const sum = allValues.reduce((acc, v) => acc + v, 0);
  const min = allValues.length > 0 ? Math.min(...allValues) : 0;
  const max = allValues.length > 0 ? Math.max(...allValues) : 0;
  const count = allValues.length;
  const quantileValues = calculateQuantiles(allValues, quantiles);

  return Object.freeze({
    kind: 'summary',
    sum,
    min,
    max,
    count,
    quantiles: quantileValues,
  });
}

/* ============================================================================
 * 🎯 API — METRICS STATE MACHINE
 * ============================================================================
 */

/** Создает начальное состояние метрик. */
export function createInitialMetricsState(
  nowMs: number, // Время в ms передается извне для детерминизма
  config?: Readonly<MetricsAggregationConfig>, // Опциональная конфигурация агрегации
): MetricsState {
  const normalizedConfig = normalizeConfig(
    config ?? DEFAULT_METRICS_AGGREGATION_CONFIG,
  );
  const windowStartMs = getWindowStartMs(nowMs, normalizedConfig.windowSizeMs);

  return Object.freeze({
    currentWindowStartMs: windowStartMs,
    metrics: Object.freeze([]),
  });
}

/**
 * Добавляет метрику в состояние.
 * Автоматически обновляет окно, если текущее время вышло за границы.
 */
export function addMetric(
  currentState: Readonly<MetricsState>, // Текущее состояние метрик
  metric: Readonly<MetricValue>, // Метрика для добавления
  config: Readonly<MetricsAggregationConfig>, // Конфигурация агрегации
  nowMs: number, // Текущее время (для валидации и обновления окна)
): MetricAddResult {
  const normalizedConfig = normalizeConfig(config);
  const state = refreshWindow(currentState, normalizedConfig, nowMs);

  if (!validateMetricValue(metric)) {
    return Object.freeze({
      success: false,
      reason: 'invalid_value',
      nextState: state,
    });
  }

  if (
    !isValueInWindow(metric.timestampMs, state.currentWindowStartMs, normalizedConfig.windowSizeMs)
  ) {
    return Object.freeze({
      success: false,
      reason: 'timestamp_out_of_order',
      nextState: state,
    });
  }

  if (
    state.metrics.length >= (normalizedConfig.maxMetricsPerWindow ?? DEFAULT_MAX_METRICS_PER_WINDOW)
  ) {
    return Object.freeze({
      success: false,
      reason: 'window_overflow',
      nextState: state,
    });
  }

  const nextMetrics = Object.freeze([...state.metrics, metric]);

  return Object.freeze({
    success: true,
    nextState: Object.freeze({
      ...state,
      metrics: nextMetrics,
    }),
  });
}

/**
 * Агрегирует метрики из состояния в агрегированные метрики.
 * Группирует по name и типу, вычисляет агрегаты согласно типу метрики.
 */
export function aggregateMetrics(
  state: Readonly<MetricsState>, // Состояние метрик для агрегации
  config: Readonly<MetricsAggregationConfig>, // Конфигурация агрегации
  nowMs: number, // Текущее время (для определения границ окна)
): MetricsAggregationResult {
  const normalizedConfig = normalizeConfig(config);
  const refreshedState = refreshWindow(state, normalizedConfig, nowMs);

  const windowEndMs = refreshedState.currentWindowStartMs + normalizedConfig.windowSizeMs;
  const inWindowMetrics = refreshedState.metrics.filter((m) =>
    isValueInWindow(
      m.timestampMs,
      refreshedState.currentWindowStartMs,
      normalizedConfig.windowSizeMs,
    )
  );

  const skippedCount = refreshedState.metrics.length - inWindowMetrics.length;

  // Группировка по name + type + tags (для корректной агрегации)
  const groupsMap = inWindowMetrics.reduce(
    (acc, metric) => {
      const tagsKey: string = serializeTags(metric.tags);
      const groupKey: string = `${metric.name}:${metric.type}:${tagsKey}`;
      const existing = acc.get(groupKey);
      return new Map(acc).set(groupKey, existing ? [...existing, metric] : [metric]);
    },
    new Map<string, readonly MetricValue[]>(),
  );

  const groups = Array.from(groupsMap.values());

  const aggregated = groups
    .filter((metrics) => metrics.length > 0)
    .map((metrics) => {
      const firstMetric = metrics[0];
      if (!firstMetric) {
        return null;
      }

      const aggregates: MetricAggregates =
        firstMetric.type === 'counter' || firstMetric.type === 'gauge'
          ? aggregateCounterOrGauge(metrics)
          : firstMetric.type === 'histogram'
          ? aggregateHistogram(
            metrics,
            normalizedConfig.histogramBuckets ?? DEFAULT_HISTOGRAM_BUCKETS,
          )
          : aggregateSummary(
            metrics,
            normalizedConfig.summaryQuantiles ?? DEFAULT_SUMMARY_QUANTILES,
          );

      return Object.freeze({
        name: firstMetric.name,
        type: firstMetric.type,
        unit: firstMetric.unit,
        window: Object.freeze({
          startMs: refreshedState.currentWindowStartMs,
          endMs: windowEndMs,
        }),
        count: metrics.length,
        aggregates,
        ...(firstMetric.tags !== undefined && { tags: firstMetric.tags }),
      });
    })
    .filter((item): item is AggregatedMetric => item !== null);

  return Object.freeze({
    aggregated: Object.freeze(aggregated),
    processedCount: inWindowMetrics.length,
    skippedCount,
  });
}

/** Создает метрику типа counter. */
export function createCounterMetric(
  name: string, // Имя метрики
  value: number, // Значение счетчика
  timestampMs: number, // Временная метка
  unit: MetricUnit = 'count', // Единица измерения (по умолчанию 'count')
  tags?: Readonly<Record<string, string>>, // Опциональные теги
): MetricValue {
  return Object.freeze({
    type: 'counter',
    name,
    value,
    unit,
    timestampMs,
    ...(tags !== undefined && { tags: deepFreezeTags(tags) }),
  });
}

/** Создает метрику типа gauge. */
export function createGaugeMetric(
  name: string, // Имя метрики
  value: number, // Значение gauge
  timestampMs: number, // Временная метка
  unit: MetricUnit = 'none', // Единица измерения (по умолчанию 'none')
  tags?: Readonly<Record<string, string>>, // Опциональные теги
): MetricValue {
  return Object.freeze({
    type: 'gauge',
    name,
    value,
    unit,
    timestampMs,
    ...(tags !== undefined && { tags: deepFreezeTags(tags) }),
  });
}

/** Создает метрику типа histogram. */
export function createHistogramMetric(
  name: string, // Имя метрики
  values: readonly number[], // Массив значений для histogram
  timestampMs: number, // Временная метка
  unit: MetricUnit = 'none', // Единица измерения (по умолчанию 'none')
  tags?: Readonly<Record<string, string>>, // Опциональные теги
): MetricValue {
  return Object.freeze({
    type: 'histogram',
    name,
    value: ensureFrozenArray(values),
    unit,
    timestampMs,
    ...(tags !== undefined && { tags: deepFreezeTags(tags) }),
  });
}

/** Создает метрику типа summary. */
export function createSummaryMetric(
  name: string, // Имя метрики
  values: readonly number[], // Массив значений для summary
  timestampMs: number, // Временная метка
  unit: MetricUnit = 'none', // Единица измерения (по умолчанию 'none')
  tags?: Readonly<Record<string, string>>, // Опциональные теги
): MetricValue {
  return Object.freeze({
    type: 'summary',
    name,
    value: ensureFrozenArray(values),
    unit,
    timestampMs,
    ...(tags !== undefined && { tags: deepFreezeTags(tags) }),
  });
}
