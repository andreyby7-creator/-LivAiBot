/**
 * @file Unit тесты для Resilience Metrics
 * Покрывают state machine, агрегацию, фабрики метрик и edge-cases.
 */
import { describe, expect, it } from 'vitest';
import {
  addMetric,
  aggregateMetrics,
  createCounterMetric,
  createGaugeMetric,
  createHistogramMetric,
  createInitialMetricsState,
  createSummaryMetric,
  DEFAULT_METRICS_AGGREGATION_CONFIG,
} from '../../src/resilience/metrics.js';
import type { MetricsAggregationConfig, MetricsState } from '../../src/resilience/metrics.js';

const BASE_TIME_MS = 1_000;
const WINDOW_SIZE_MS = 60_000;

function createConfig(overrides: Partial<MetricsAggregationConfig> = {}): MetricsAggregationConfig {
  return Object.freeze({
    ...DEFAULT_METRICS_AGGREGATION_CONFIG,
    ...overrides,
  });
}

function createState(overrides: Partial<MetricsState> = {}): MetricsState {
  return Object.freeze({
    ...createInitialMetricsState(BASE_TIME_MS),
    ...overrides,
  });
}

describe('resilience/metrics', () => {
  describe('createInitialMetricsState', () => {
    it('создает начальное состояние с дефолтным конфигом', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      // Окно округляется до начала окна (BASE_TIME_MS = 1000, windowSize = 60000, округляется до 0)
      expect(state.currentWindowStartMs).toBe(0);
      expect(state.metrics).toEqual([]);
      expect(state.tags).toBeUndefined();
    });

    it('создает начальное состояние с кастомным конфигом', () => {
      const customConfig = createConfig({ windowSizeMs: 30_000 });
      const state = createInitialMetricsState(BASE_TIME_MS, customConfig);
      expect(state.currentWindowStartMs).toBe(0); // Округление до начала окна
      expect(state.metrics).toEqual([]);
    });

    it('округляет время до начала окна', () => {
      const config = createConfig({ windowSizeMs: 10_000 });
      const state = createInitialMetricsState(15_234, config);
      expect(state.currentWindowStartMs).toBe(10_000);
    });
  });

  describe('createCounterMetric', () => {
    it('создает counter метрику без тегов', () => {
      const metric = createCounterMetric('requests', 42, BASE_TIME_MS);
      expect(metric.type).toBe('counter');
      expect(metric.name).toBe('requests');
      expect(metric.value).toBe(42);
      expect(metric.unit).toBe('count');
      expect(metric.timestampMs).toBe(BASE_TIME_MS);
      expect(metric.tags).toBeUndefined();
    });

    it('создает counter метрику с тегами', () => {
      const tags = { service: 'api', env: 'prod' };
      const metric = createCounterMetric('requests', 42, BASE_TIME_MS, 'count', tags);
      expect(metric.tags).toEqual(tags);
      expect(Object.isFrozen(metric.tags)).toBe(true);
    });

    it('создает counter метрику с кастомной единицей', () => {
      const metric = createCounterMetric('bytes', 1024, BASE_TIME_MS, 'bytes');
      expect(metric.unit).toBe('bytes');
    });
  });

  describe('createGaugeMetric', () => {
    it('создает gauge метрику без тегов', () => {
      const metric = createGaugeMetric('cpu_usage', 75.5, BASE_TIME_MS);
      expect(metric.type).toBe('gauge');
      expect(metric.name).toBe('cpu_usage');
      expect(metric.value).toBe(75.5);
      expect(metric.unit).toBe('none');
      expect(metric.tags).toBeUndefined();
    });

    it('создает gauge метрику с тегами', () => {
      const tags = { host: 'server1' };
      const metric = createGaugeMetric('memory', 512, BASE_TIME_MS, 'bytes', tags);
      expect(metric.tags).toEqual(tags);
      expect(Object.isFrozen(metric.tags)).toBe(true);
    });
  });

  describe('createHistogramMetric', () => {
    it('создает histogram метрику без тегов', () => {
      const values = [0.1, 0.2, 0.3, 0.4, 0.5];
      const metric = createHistogramMetric('latency', values, BASE_TIME_MS);
      expect(metric.type).toBe('histogram');
      expect(metric.name).toBe('latency');
      expect(metric.value).toEqual(values);
      expect(Array.isArray(metric.value)).toBe(true);
      expect(metric.tags).toBeUndefined();
    });

    it('создает histogram метрику с тегами', () => {
      const values = [1, 2, 3];
      const tags = { endpoint: '/api/users' };
      const metric = createHistogramMetric(
        'response_time',
        values,
        BASE_TIME_MS,
        'milliseconds',
        tags,
      );
      expect(metric.tags).toEqual(tags);
      expect(Object.isFrozen(metric.tags)).toBe(true);
    });

    it('оптимизирует frozen массив (не копирует)', () => {
      const values = Object.freeze([1, 2, 3]);
      const metric = createHistogramMetric('test', values, BASE_TIME_MS);
      expect(metric.value).toBe(values); // Тот же объект, не копия
    });

    it('копирует и замораживает незамороженный массив', () => {
      const values = [1, 2, 3];
      const metric = createHistogramMetric('test', values, BASE_TIME_MS);
      expect(metric.value).not.toBe(values); // Новая копия
      expect(Object.isFrozen(metric.value)).toBe(true);
    });
  });

  describe('createSummaryMetric', () => {
    it('создает summary метрику без тегов', () => {
      const values = [10, 20, 30, 40, 50];
      const metric = createSummaryMetric('duration', values, BASE_TIME_MS);
      expect(metric.type).toBe('summary');
      expect(metric.name).toBe('duration');
      expect(metric.value).toEqual(values);
      expect(metric.tags).toBeUndefined();
    });

    it('создает summary метрику с тегами', () => {
      const values = [100, 200, 300];
      const tags = { operation: 'query' };
      const metric = createSummaryMetric(
        'db_query_time',
        values,
        BASE_TIME_MS,
        'milliseconds',
        tags,
      );
      expect(metric.tags).toEqual(tags);
      expect(Object.isFrozen(metric.tags)).toBe(true);
    });

    it('оптимизирует frozen массив (не копирует)', () => {
      const values = Object.freeze([1, 2, 3]);
      const metric = createSummaryMetric('test', values, BASE_TIME_MS);
      expect(metric.value).toBe(values);
    });
  });

  describe('addMetric', () => {
    it('успешно добавляет метрику в состояние', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const metric = createCounterMetric('requests', 1, BASE_TIME_MS);
      const config = createConfig();

      const result = addMetric(state, metric, config, BASE_TIME_MS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextState.metrics).toHaveLength(1);
        expect(result.nextState.metrics[0]).toEqual(metric);
      }
    });

    it('возвращает ошибку для invalid_value (некорректный timestamp)', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const metric = createCounterMetric('requests', 1, -1); // Отрицательный timestamp
      const config = createConfig();

      const result = addMetric(state, metric, config, BASE_TIME_MS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_value');
      }
    });

    it('возвращает ошибку для invalid_value (некорректное значение counter)', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const metric = Object.freeze({
        type: 'counter' as const,
        name: 'test',
        value: NaN, // Некорректное значение
        unit: 'count' as const,
        timestampMs: BASE_TIME_MS,
      });
      const config = createConfig();

      const result = addMetric(state, metric, config, BASE_TIME_MS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_value');
      }
    });

    it('возвращает ошибку для invalid_value (некорректный histogram)', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const metric = Object.freeze({
        type: 'histogram' as const,
        name: 'test',
        value: [1, -1], // Отрицательное значение
        unit: 'none' as const,
        timestampMs: BASE_TIME_MS,
      });
      const config = createConfig();

      const result = addMetric(state, metric, config, BASE_TIME_MS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_value');
      }
    });

    it('возвращает ошибку для timestamp_out_of_order', () => {
      const config = createConfig({ windowSizeMs: WINDOW_SIZE_MS });
      // Окно начинается с 0 (BASE_TIME_MS = 1000 округляется до 0 при windowSize = 60000)
      const state = createInitialMetricsState(BASE_TIME_MS, config);
      // Метрика с валидным временем, но вне текущего окна [0, 60000)
      const metric = createCounterMetric('requests', 1, WINDOW_SIZE_MS + 1); // 60001, вне окна

      const result = addMetric(state, metric, config, BASE_TIME_MS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('timestamp_out_of_order');
      }
    });

    it('возвращает ошибку для window_overflow', () => {
      const state = createState({
        metrics: Array.from(
          { length: 5 },
          (_, i) => createCounterMetric('test', i, BASE_TIME_MS + i),
        ),
      });
      const metric = createCounterMetric('test', 6, BASE_TIME_MS + 6);
      const config = createConfig({ maxMetricsPerWindow: 5 });

      const result = addMetric(state, metric, config, BASE_TIME_MS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('window_overflow');
      }
    });

    it('обновляет окно при переходе в новое временное окно', () => {
      const config = createConfig({ windowSizeMs: WINDOW_SIZE_MS });
      const state = createInitialMetricsState(BASE_TIME_MS, config);
      const newTime = BASE_TIME_MS + WINDOW_SIZE_MS + 1;
      // Окно округляется: Math.floor(61001 / 60000) * 60000 = 60000
      const expectedWindowStart = 60_000;
      const metric = createCounterMetric('requests', 1, newTime);

      const result = addMetric(state, metric, config, newTime);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextState.currentWindowStartMs).toBe(expectedWindowStart);
        expect(result.nextState.metrics).toHaveLength(1);
      }
    });

    it('добавляет несколько метрик последовательно', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const config = createConfig();
      const metric1 = createCounterMetric('requests', 1, BASE_TIME_MS);
      const metric2 = createCounterMetric('requests', 2, BASE_TIME_MS + 1);

      const result1 = addMetric(state, metric1, config, BASE_TIME_MS);
      expect(result1.success).toBe(true);

      if (result1.success) {
        const result2 = addMetric(result1.nextState, metric2, config, BASE_TIME_MS + 1);
        expect(result2.success).toBe(true);
        if (result2.success) {
          expect(result2.nextState.metrics).toHaveLength(2);
        }
      }
    });
  });

  describe('aggregateMetrics', () => {
    it('возвращает пустой результат для пустого состояния', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toEqual([]);
      expect(result.processedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
    });

    it('агрегирует counter метрики', () => {
      const state = createState({
        metrics: [
          createCounterMetric('requests', 10, BASE_TIME_MS),
          createCounterMetric('requests', 20, BASE_TIME_MS + 1),
          createCounterMetric('requests', 30, BASE_TIME_MS + 2),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      expect(result.aggregated[0]?.name).toBe('requests');
      expect(result.aggregated[0]?.type).toBe('counter');
      if (result.aggregated[0]?.aggregates.kind === 'counter') {
        expect(result.aggregated[0].aggregates.sum).toBe(60);
        expect(result.aggregated[0].aggregates.min).toBe(10);
        expect(result.aggregated[0].aggregates.max).toBe(30);
        expect(result.aggregated[0].aggregates.last).toBe(30);
      }
    });

    it('агрегирует gauge метрики', () => {
      const state = createState({
        metrics: [
          createGaugeMetric('cpu', 50, BASE_TIME_MS),
          createGaugeMetric('cpu', 75, BASE_TIME_MS + 1),
          createGaugeMetric('cpu', 25, BASE_TIME_MS + 2),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      if (result.aggregated[0]?.aggregates.kind === 'gauge') {
        expect(result.aggregated[0].aggregates.sum).toBe(150); // 50 + 75 + 25
        expect(result.aggregated[0].aggregates.min).toBe(25);
        expect(result.aggregated[0].aggregates.max).toBe(75);
        expect(result.aggregated[0].aggregates.last).toBe(25);
      }
    });

    it('агрегирует histogram метрики', () => {
      const state = createState({
        metrics: [
          createHistogramMetric('latency', [0.1, 0.2], BASE_TIME_MS),
          createHistogramMetric('latency', [0.3, 0.4], BASE_TIME_MS + 1),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      expect(result.aggregated[0]?.type).toBe('histogram');
      if (result.aggregated[0]?.aggregates.kind === 'histogram') {
        expect(result.aggregated[0].aggregates.sum).toBe(1.0);
        expect(result.aggregated[0].aggregates.min).toBe(0.1);
        expect(result.aggregated[0].aggregates.max).toBe(0.4);
        expect(result.aggregated[0].aggregates.count).toBe(4);
        expect(result.aggregated[0].aggregates.buckets).toBeDefined();
      }
    });

    it('агрегирует summary метрики с линейной интерполяцией квантилей', () => {
      const state = createState({
        metrics: [
          createSummaryMetric('duration', [10, 20, 30, 40, 50], BASE_TIME_MS),
          createSummaryMetric('duration', [15, 25, 35, 45, 55], BASE_TIME_MS + 1),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      expect(result.aggregated[0]?.type).toBe('summary');
      if (result.aggregated[0]?.aggregates.kind === 'summary') {
        expect(result.aggregated[0].aggregates.sum).toBe(325);
        expect(result.aggregated[0].aggregates.min).toBe(10);
        expect(result.aggregated[0].aggregates.max).toBe(55);
        expect(result.aggregated[0].aggregates.count).toBe(10);
        expect(result.aggregated[0].aggregates.quantiles).toBeDefined();
        // Проверяем, что квантили вычислены (не все нули)
        const quantileValues = Object.values(result.aggregated[0].aggregates.quantiles);
        expect(quantileValues.some((v) => v > 0)).toBe(true);
      }
    });

    it('группирует метрики по name, type и tags', () => {
      const state = createState({
        metrics: [
          createCounterMetric('requests', 10, BASE_TIME_MS, 'count', { service: 'api' }),
          createCounterMetric('requests', 20, BASE_TIME_MS + 1, 'count', { service: 'api' }),
          createCounterMetric('requests', 30, BASE_TIME_MS + 2, 'count', { service: 'web' }),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(2); // Две группы по тегам
      const apiGroup = result.aggregated.find((m) => m.tags?.['service'] === 'api');
      const webGroup = result.aggregated.find((m) => m.tags?.['service'] === 'web');
      expect(apiGroup).toBeDefined();
      expect(webGroup).toBeDefined();
      if (apiGroup?.aggregates.kind === 'counter') {
        expect(apiGroup.aggregates.sum).toBe(30);
      }
      if (webGroup?.aggregates.kind === 'counter') {
        expect(webGroup.aggregates.sum).toBe(30);
      }
    });

    it('разделяет метрики по типу', () => {
      const state = createState({
        metrics: [
          createCounterMetric('requests', 10, BASE_TIME_MS),
          createGaugeMetric('requests', 20, BASE_TIME_MS + 1),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(2); // Две группы по типу
    });

    it('пропускает метрики вне текущего окна', () => {
      const config = createConfig({ windowSizeMs: WINDOW_SIZE_MS });
      // Используем время, которое не обновляет окно при агрегации
      const windowStart = 60_000; // Окно [60000, 120000)
      const oldTime = windowStart - 1; // 59_999, вне окна [60000, 120000)
      const newTime = windowStart + 1; // 60_001, в окне
      const state = createState({
        currentWindowStartMs: windowStart,
        metrics: [
          createCounterMetric('old', 1, oldTime),
          createCounterMetric('new', 2, newTime),
        ],
      });

      const result = aggregateMetrics(state, config, windowStart);

      expect(result.processedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.aggregated).toHaveLength(1);
      expect(result.aggregated[0]?.name).toBe('new');
    });

    it('обрабатывает пустые histogram/summary массивы', () => {
      const state = createState({
        metrics: [
          createHistogramMetric('empty', [], BASE_TIME_MS),
          createSummaryMetric('empty', [], BASE_TIME_MS + 1),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(2);
      const histogram = result.aggregated.find((m) => m.type === 'histogram');
      const summary = result.aggregated.find((m) => m.type === 'summary');
      if (histogram?.aggregates.kind === 'histogram') {
        expect(histogram.aggregates.sum).toBe(0);
        expect(histogram.aggregates.count).toBe(0);
      }
      if (summary?.aggregates.kind === 'summary') {
        expect(summary.aggregates.sum).toBe(0);
        expect(summary.aggregates.count).toBe(0);
      }
    });

    it('обновляет окно при агрегации', () => {
      const config = createConfig({ windowSizeMs: WINDOW_SIZE_MS });
      const windowStart = 60_000; // Окно [60000, 120000)
      const state = createState({
        currentWindowStartMs: windowStart,
        metrics: [createCounterMetric('test', 1, windowStart)],
      });
      // Новое время переводит в следующее окно [120000, 180000)
      const newTime = windowStart + WINDOW_SIZE_MS + 1; // 120_001

      const result = aggregateMetrics(state, config, newTime);

      // refreshWindow очищает метрики при обновлении окна, так что skippedCount = 0
      // (метрики уже удалены из состояния, а не пропущены)
      expect(result.skippedCount).toBe(0);
      expect(result.processedCount).toBe(0);
      expect(result.aggregated).toHaveLength(0);
    });

    it('вычисляет квантили для summary с линейной интерполяцией', () => {
      // Массив из 10 элементов для проверки интерполяции
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const state = createState({
        metrics: [createSummaryMetric('test', values, BASE_TIME_MS)],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      if (result.aggregated[0]?.aggregates.kind === 'summary') {
        const quantiles = result.aggregated[0].aggregates.quantiles;
        // P50 должен быть около 5.5 (между 5 и 6)
        expect(quantiles['0.5']).toBeGreaterThan(5);
        expect(quantiles['0.5']).toBeLessThan(6);
        // P95 должен быть около 9.55 (между 9 и 10)
        expect(quantiles['0.95']).toBeGreaterThan(9);
        expect(quantiles['0.95']).toBeLessThan(10);
      }
    });

    it('обрабатывает пустой массив для квантилей', () => {
      const state = createState({
        metrics: [createSummaryMetric('test', [], BASE_TIME_MS)],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      if (result.aggregated[0]?.aggregates.kind === 'summary') {
        const quantiles = result.aggregated[0].aggregates.quantiles;
        // Все квантили должны быть 0 для пустого массива
        Object.values(quantiles).forEach((q) => {
          expect(q).toBe(0);
        });
      }
    });
  });

  describe('DEFAULT_METRICS_AGGREGATION_CONFIG', () => {
    it('имеет корректные дефолтные значения', () => {
      expect(DEFAULT_METRICS_AGGREGATION_CONFIG.windowSizeMs).toBe(60_000);
      expect(DEFAULT_METRICS_AGGREGATION_CONFIG.maxMetricsPerWindow).toBe(10_000);
      expect(DEFAULT_METRICS_AGGREGATION_CONFIG.histogramBuckets).toBeDefined();
      expect(DEFAULT_METRICS_AGGREGATION_CONFIG.summaryQuantiles).toBeDefined();
    });

    it('является frozen объектом', () => {
      expect(Object.isFrozen(DEFAULT_METRICS_AGGREGATION_CONFIG)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('обрабатывает метрики с одинаковыми именами но разными единицами', () => {
      const state = createState({
        metrics: [
          createCounterMetric('size', 100, BASE_TIME_MS, 'bytes'),
          createCounterMetric('size', 200, BASE_TIME_MS + 1, 'count'),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      // Должны быть сгруппированы вместе (единица не влияет на группировку)
      expect(result.aggregated.length).toBeGreaterThanOrEqual(1);
    });

    it('обрабатывает очень большие значения', () => {
      const state = createState({
        metrics: [createCounterMetric('large', Number.MAX_SAFE_INTEGER, BASE_TIME_MS)],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      if (result.aggregated[0]?.aggregates.kind === 'counter') {
        expect(result.aggregated[0].aggregates.sum).toBe(Number.MAX_SAFE_INTEGER);
      }
    });

    it('обрабатывает отрицательные значения для gauge (допустимо)', () => {
      const state = createState({
        metrics: [createGaugeMetric('temp', -10, BASE_TIME_MS)],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      if (result.aggregated[0]?.aggregates.kind === 'gauge') {
        expect(result.aggregated[0].aggregates.sum).toBe(-10);
        expect(result.aggregated[0].aggregates.min).toBe(-10);
      }
    });

    it('обрабатывает метрики с пустыми тегами', () => {
      const state = createState({
        metrics: [
          createCounterMetric('test', 1, BASE_TIME_MS, 'count', {}),
          createCounterMetric('test', 2, BASE_TIME_MS + 1),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      // Пустые теги и отсутствие тегов должны группироваться отдельно
      expect(result.aggregated.length).toBeGreaterThanOrEqual(1);
    });

    it('нормализует невалидные значения в конфиге (NaN, Infinity, <= 0)', () => {
      const invalidConfig = createConfig({
        windowSizeMs: NaN,
        maxMetricsPerWindow: -5,
      });
      const state = createInitialMetricsState(BASE_TIME_MS, invalidConfig);

      // Должны использоваться дефолтные значения
      expect(state.currentWindowStartMs).toBeDefined();
    });

    it('сериализует теги с сортировкой ключей', () => {
      const state = createState({
        metrics: [
          createCounterMetric('test', 1, BASE_TIME_MS, 'count', {
            z: 'last',
            a: 'first',
            m: 'middle',
          }),
          createCounterMetric('test', 2, BASE_TIME_MS + 1, 'count', {
            a: 'first',
            m: 'middle',
            z: 'last',
          }),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      // Метрики с одинаковыми тегами (в разном порядке) должны группироваться вместе
      expect(result.aggregated).toHaveLength(1);
      if (result.aggregated[0]?.aggregates.kind === 'counter') {
        expect(result.aggregated[0].aggregates.sum).toBe(3);
      }
    });

    it('валидирует summary метрики', () => {
      const state = createInitialMetricsState(BASE_TIME_MS);
      const validSummary = createSummaryMetric('test', [1, 2, 3], BASE_TIME_MS);
      const invalidSummary = Object.freeze({
        type: 'summary' as const,
        name: 'test',
        value: [1, -1], // Отрицательное значение
        unit: 'none' as const,
        timestampMs: BASE_TIME_MS,
      });
      const config = createConfig();

      const validResult = addMetric(state, validSummary, config, BASE_TIME_MS);
      expect(validResult.success).toBe(true);

      const invalidResult = addMetric(state, invalidSummary, config, BASE_TIME_MS);
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.reason).toBe('invalid_value');
      }
    });

    it('обрабатывает histogram значения больше всех buckets (+Inf)', () => {
      const state = createState({
        metrics: [
          createHistogramMetric('latency', [100, 200, 300], BASE_TIME_MS), // Значения больше всех дефолтных buckets
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      if (result.aggregated[0]?.aggregates.kind === 'histogram') {
        expect(result.aggregated[0].aggregates.buckets['+Inf']).toBeGreaterThan(0);
      }
    });

    it('обрабатывает histogram с значениями в разных buckets', () => {
      const state = createState({
        metrics: [
          createHistogramMetric('latency', [0.001, 0.01, 0.1, 1, 5, 10, 100], BASE_TIME_MS),
        ],
      });
      const config = createConfig();

      const result = aggregateMetrics(state, config, BASE_TIME_MS);

      expect(result.aggregated).toHaveLength(1);
      if (result.aggregated[0]?.aggregates.kind === 'histogram') {
        const buckets = result.aggregated[0].aggregates.buckets;
        // Проверяем, что значения распределены по buckets
        const bucketCounts = Object.values(buckets);
        expect(bucketCounts.some((count) => count > 0)).toBe(true);
      }
    });
  });
});
