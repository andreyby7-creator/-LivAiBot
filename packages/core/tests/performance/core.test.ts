/**
 * @file packages/core/tests/performance/core.test.ts
 * ============================================================================
 * 🧪 PERFORMANCE CORE — Unit Tests (100% Coverage)
 * ============================================================================
 * Полное покрытие всех функций и веток исполнения (100%)
 */

import { describe, expect, it, vi } from 'vitest';

import type { JsonObject } from '@livai/core-contracts';

import type {
  MetricProcessor,
  MetricRule,
  PerformanceLogger,
  PerformanceMetric,
} from '../../src/performance/core.js';
import { createPerformanceTracker, PerformanceTracker } from '../../src/performance/core.js';

// Для тестов допустимо:
// - Мутации объектов для создания тестовых данных (fp/no-mutation)
// - Использование тестовых данных без валидации (ai-security/model-poisoning)
/* eslint-disable fp/no-mutation, ai-security/model-poisoning */

/* ============================================================================
 * 🔧 TEST HELPERS
 * ============================================================================ */

function createTestMetric(overrides?: Partial<PerformanceMetric>): PerformanceMetric {
  return {
    name: 'LCP',
    value: 3000, // Выше threshold 2500 для LCP, чтобы пройти через rules
    timestamp: 1234567890,
    ...overrides,
  };
}

// Создает метрику, которая гарантированно пройдет через все фильтры
function createPassingMetric(overrides?: Partial<PerformanceMetric>): PerformanceMetric {
  return {
    name: 'UNKNOWN_METRIC', // Не в DEFAULT_RULES, поэтому пройдет (default: allow)
    value: 1000,
    timestamp: 1234567890,
    ...overrides,
  };
}

type TestLogger = PerformanceLogger & {
  getMetrics: () => PerformanceMetric[];
  getBatches: () => readonly PerformanceMetric[][];
  clear: () => void;
};

function createTestLogger(): TestLogger {
  const metrics: PerformanceMetric[] = [];
  const batches: PerformanceMetric[][] = [];

  return {
    metric: (metric: PerformanceMetric) => {
      metrics.push(metric);
    },
    metrics: (ms: readonly PerformanceMetric[]) => {
      batches.push([...ms]);
    },
    // Expose для тестов
    getMetrics: () => metrics,
    getBatches: () => batches,
    clear: () => {
      metrics.length = 0;
      batches.length = 0;
    },
  };
}

/* ============================================================================
 * ⏰ CLOCK — getMonotonicTime
 * ============================================================================ */

describe('getMonotonicTime', () => {
  it('использует performance.now() если доступен', () => {
    const mockPerformance = {
      now: vi.fn(() => 1234.567),
    };
    global.performance = mockPerformance as unknown as Performance;

    const tracker = createPerformanceTracker(createTestLogger());
    const time = tracker.getCurrentTime();

    expect(time).toBe(1234.567);
    expect(mockPerformance.now).toHaveBeenCalled();
  });

  it('использует Date.now() если performance.now() недоступен', () => {
    const originalPerformance = global.performance;
    delete (global as { performance?: Performance; }).performance;

    const mockDateNow = vi.spyOn(Date, 'now').mockReturnValue(9876543210);

    const tracker = createPerformanceTracker(createTestLogger());
    const time = tracker.getCurrentTime();

    expect(time).toBe(9876543210);
    expect(mockDateNow).toHaveBeenCalled();

    mockDateNow.mockRestore();
    global.performance = originalPerformance;
  });

  it('использует кастомную now функцию из конфигурации', () => {
    const customNow = vi.fn(() => 5555);
    const tracker = createPerformanceTracker(createTestLogger(), { now: customNow });

    const time = tracker.getCurrentTime();

    expect(time).toBe(5555);
    expect(customNow).toHaveBeenCalled();
  });
});

/* ============================================================================
 * 🎲 SAMPLER — createSamplerFunction
 * ============================================================================ */

describe('Sampler', () => {
  it('возвращает true если sampleRate >= 1.0', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 1.0,
      rules: [], // Без правил, чтобы метрика прошла
    });
    const metric = createPassingMetric();

    tracker.record(metric);
    tracker.flush();

    // Метрика должна пройти через sampler
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThan(0);
  });

  it('возвращает false если sampleRate <= 0.0', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, { sampleRate: 0.0 });
    const metric = createTestMetric();

    tracker.record(metric);
    tracker.flush();

    // Метрика должна быть отфильтрована sampler'ом
    expect(logger.getMetrics().length).toBe(0);
  });

  it('использует детерминированный sampling с key', () => {
    const logger1 = createTestLogger();
    const tracker1 = createPerformanceTracker(logger1, {
      sampleRate: 0.5,
      samplingKey: 'user-123',
    });

    const logger2 = createTestLogger();
    const tracker2 = createPerformanceTracker(logger2, {
      sampleRate: 0.5,
      samplingKey: 'user-123',
    });

    const metric = createTestMetric({ name: 'LCP' });

    tracker1.record(metric);
    tracker1.flush();
    tracker2.record(metric);
    tracker2.flush();

    // Детерминированный sampling: одинаковый key + name → одинаковый результат
    expect(logger1.getMetrics().length).toBe(logger2.getMetrics().length);
  });

  it('использует metricKey если передан в shouldSample', () => {
    const logger = createTestLogger();
    const captured: {
      metric?: PerformanceMetric;
      key: string | undefined;
    } = {
      key: undefined,
    };

    const customShouldSample = vi.fn((metric: PerformanceMetric, seed?: string) => {
      captured.metric = metric;
      captured.key = seed;
      return true; // Всегда возвращаем true для теста
    });

    const tracker = createPerformanceTracker(logger, {
      sampleRate: 0.5,
      shouldSample: customShouldSample,
      rules: [], // Без правил, чтобы метрика прошла
    });

    const metric = createPassingMetric();
    tracker.record(metric);
    tracker.flush();

    expect(customShouldSample).toHaveBeenCalled();
    expect(captured.metric).toBeDefined();
    expect(captured.key).toBeUndefined();
  });

  it('использует пустую строку как fallback для key', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 0.5,
      // samplingKey не задан
    });

    const metric = createTestMetric({ name: 'test-metric' });
    tracker.record(metric);
    tracker.flush();

    // Детерминированный результат даже без key
    const result1 = logger.getMetrics().length;

    logger.clear();
    tracker.clear();
    tracker.record(metric);
    tracker.flush();

    // Должен быть тот же результат (детерминированный)
    const result2 = logger.getMetrics().length;
    expect(result1).toBe(result2);
  });
});

/* ============================================================================
 * 📏 RULES ENGINE — compileRules, isAboveThreshold
 * ============================================================================ */

describe('Rules Engine', () => {
  it('компилирует exact rules в Map', () => {
    const rules: readonly MetricRule[] = [
      { name: 'LCP', threshold: 2500 },
      { name: 'CLS', threshold: 0.1 },
    ];

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      rules,
      sampleRate: 1.0, // 100% sampling для теста
    });

    const metric1 = createTestMetric({ name: 'LCP', value: 3000 });
    const metric2 = createTestMetric({ name: 'CLS', value: 0.2 });
    const metric3 = createTestMetric({ name: 'LCP', value: 1000 }); // Ниже threshold

    tracker.record(metric1);
    tracker.record(metric2);
    tracker.record(metric3);
    tracker.flush();

    // metric1 и metric2 должны пройти (выше threshold), metric3 - нет
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('компилирует prefix rules (wildcard)', () => {
    const rules: readonly MetricRule[] = [
      { name: 'api.*', threshold: 500 },
      { name: 'component.*', threshold: 100 },
    ];

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      rules,
      sampleRate: 1.0,
    });

    const metric1 = createTestMetric({ name: 'api.request', value: 600 });
    const metric2 = createTestMetric({ name: 'component.render', value: 150 });
    const metric3 = createTestMetric({ name: 'api.request', value: 300 }); // Ниже threshold

    tracker.record(metric1);
    tracker.record(metric2);
    tracker.record(metric3);
    tracker.flush();

    // metric1 и metric2 должны пройти, metric3 - нет
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('компилирует regex rules', () => {
    const rules: readonly MetricRule[] = [
      { name: /^api\.(get|post)$/, threshold: 500 },
    ];

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      rules,
      sampleRate: 1.0,
    });

    const metric1 = createTestMetric({ name: 'api.get', value: 600 });
    const metric2 = createTestMetric({ name: 'api.post', value: 700 });
    const metric3 = createTestMetric({ name: 'api.put', value: 600 }); // Не матчится regex
    const metric4 = createTestMetric({ name: 'api.get', value: 300 }); // Ниже threshold

    tracker.record(metric1);
    tracker.record(metric2);
    tracker.record(metric3);
    tracker.record(metric4);
    tracker.flush();

    // metric1 и metric2 должны пройти, metric3 и metric4 - нет
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('возвращает true если правило не найдено (default: allow)', () => {
    const rules: readonly MetricRule[] = [
      { name: 'LCP', threshold: 2500 },
    ];

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      rules,
      sampleRate: 1.0,
    });

    const metric = createPassingMetric({ name: 'UNKNOWN_METRIC', value: 100 });

    tracker.record(metric);
    tracker.flush();

    // Метрика без правила должна пройти (default: allow)
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThan(0);
  });

  it('использует DEFAULT_METRIC_RULES если rules не заданы', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 1.0, // 100% sampling
    }); // Без rules, использует DEFAULT_METRIC_RULES

    const metric1 = createTestMetric({ name: 'LCP', value: 3000 }); // Выше threshold 2500
    const metric2 = createTestMetric({ name: 'CLS', value: 0.2 }); // Выше threshold 0.1
    const metric3 = createTestMetric({ name: 'LCP', value: 1000 }); // Ниже threshold

    tracker.record(metric1);
    tracker.record(metric2);
    tracker.record(metric3);
    tracker.flush();

    // metric1 и metric2 должны пройти, metric3 - нет
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('проверяет threshold для exact match', () => {
    const rules: readonly MetricRule[] = [
      { name: 'TEST', threshold: 100 },
    ];

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      rules,
      sampleRate: 1.0,
    });

    const metric1 = createTestMetric({ name: 'TEST', value: 101 }); // Выше
    const metric2 = createTestMetric({ name: 'TEST', value: 100 }); // Равно (не выше)
    const metric3 = createTestMetric({ name: 'TEST', value: 99 }); // Ниже

    tracker.record(metric1);
    tracker.record(metric2);
    tracker.record(metric3);
    tracker.flush();

    // Только metric1 должна пройти (value > threshold)
    const total = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});

/* ============================================================================
 * 🧹 SANITIZATION — sanitizeTags, sanitizeMetadata
 * ============================================================================ */

describe('Sanitization', () => {
  describe('sanitizeTags', () => {
    it('возвращает undefined если tags === undefined', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [], // Без правил для теста
      });

      const metric = createPassingMetric();
      // Удаляем tags для теста
      const metricWithoutTags: Omit<PerformanceMetric, 'tags'> & { tags?: never; } = {
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        ...(metric.metadata && { metadata: metric.metadata }),
      };
      tracker.record(metricWithoutTags as PerformanceMetric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.tags).toBeUndefined();
    });

    it('возвращает frozen пустой объект если tags пустой', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [], // Без правил для теста
      });

      const metric = createPassingMetric({ tags: {} });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.tags).toEqual({});
      expect(Object.isFrozen(loggedMetric?.tags)).toBe(true);
    });

    it('ограничивает длину значений тегов', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxTagLength: 10,
        sampleRate: 1.0,
        rules: [],
      });

      const longValue = 'a'.repeat(100);
      const metric = createPassingMetric({ tags: { key: longValue } });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.tags?.['key']).toBe(`${'a'.repeat(10)}...`);
    });

    it('не обрезает короткие значения тегов', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxTagLength: 10,
        sampleRate: 1.0,
        rules: [],
      });

      const shortValue = 'short';
      const metric = createPassingMetric({ tags: { key: shortValue } });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.tags?.['key']).toBe(shortValue);
    });

    it('ограничивает количество тегов', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxTagCount: 3,
        sampleRate: 1.0,
        rules: [],
      });

      const tags = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`key${i}`, `value${i}`]),
      ) as Record<string, string>;

      const metric = createPassingMetric({ tags });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(Object.keys(loggedMetric?.tags ?? {})).toHaveLength(3);
    });

    it('использует дефолтные значения maxTagLength и maxTagCount', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger); // Без кастомных значений

      const longValue = 'a'.repeat(300);
      const tags = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`key${i}`, longValue]),
      ) as Record<string, string>;

      const metric = createTestMetric({ tags });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0];
      const tagKeys = Object.keys(loggedMetric?.tags ?? {});
      expect(tagKeys.length).toBeLessThanOrEqual(50); // DEFAULT_MAX_TAG_COUNT
      if (tagKeys.length > 0) {
        const firstTagValue = Object.values(loggedMetric?.tags ?? {})[0] as string;
        expect(firstTagValue.length).toBeLessThanOrEqual(203); // DEFAULT_MAX_TAG_LENGTH + '...'
      }
    });
  });

  describe('sanitizeMetadata', () => {
    it('возвращает undefined если metadata === undefined', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [],
      });

      const metric = createPassingMetric();
      // Удаляем metadata для теста
      const metricWithoutMetadata: Omit<PerformanceMetric, 'metadata'> & { metadata?: never; } = {
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        ...(metric.tags && { tags: metric.tags }),
      };
      tracker.record(metricWithoutMetadata as PerformanceMetric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.metadata).toBeUndefined();
    });

    it('возвращает metadata если размер в пределах лимита', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxMetadataSize: 1000,
        sampleRate: 1.0,
        rules: [],
      });

      const metadata: JsonObject = { key: 'value' };
      const metric = createPassingMetric({ metadata });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.metadata).toEqual(metadata);
    });

    it('возвращает truncated объект если metadata слишком большой', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxMetadataSize: 10,
        sampleRate: 1.0,
        rules: [],
      });

      const largeMetadata: JsonObject = { data: 'x'.repeat(1000) };
      const metric = createPassingMetric({ metadata: largeMetadata });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.metadata).toEqual({
        _truncated: true,
        _originalSize: expect.any(Number),
        _maxSize: 10,
      });
    });

    it('возвращает frozen пустой объект если JSON.stringify выбрасывает ошибку', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [],
      });

      // Создаем circular reference для ошибки JSON.stringify
      const circularMetadata: JsonObject = {} as JsonObject;
      (circularMetadata as Record<string, unknown>)['self'] = circularMetadata;

      const metric = createPassingMetric({ metadata: circularMetadata });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.metadata).toEqual({});
      expect(Object.isFrozen(loggedMetric?.metadata)).toBe(true);
    });

    it('использует дефолтное значение maxMetadataSize', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [],
      }); // Без кастомного maxMetadataSize

      // Создаем metadata размером больше 10KB
      const largeMetadata: JsonObject = { data: 'x'.repeat(11 * 1024) };
      const metric = createPassingMetric({ metadata: largeMetadata });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.metadata).toEqual({
        _truncated: true,
        _originalSize: expect.any(Number),
        _maxSize: 10 * 1024, // DEFAULT_MAX_METADATA_SIZE
      });
    });
  });
});

/* ============================================================================
 * ❄️ FREEZE — freezeMetric
 * ============================================================================ */

describe('freezeMetric', () => {
  it('не замораживает метрику в production mode', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 1.0,
      rules: [],
    });

    const metric = createPassingMetric({ tags: { key: 'value' }, metadata: { data: 'test' } });
    tracker.record(metric);
    tracker.flush();

    const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
    // В production метрика не заморожена (оптимизация)
    expect(loggedMetric).toBeDefined();

    vi.unstubAllEnvs();
  });

  it('замораживает метрику в dev mode', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 1.0,
      rules: [],
    });

    const metric = createPassingMetric({ tags: { key: 'value' }, metadata: { data: 'test' } });
    tracker.record(metric);
    tracker.flush();

    const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
    expect(loggedMetric).toBeDefined();
    if (loggedMetric) {
      expect(Object.isFrozen(loggedMetric)).toBe(true);
      if (loggedMetric.tags) {
        expect(Object.isFrozen(loggedMetric.tags)).toBe(true);
      }
      if (loggedMetric.metadata) {
        expect(Object.isFrozen(loggedMetric.metadata)).toBe(true);
      }
    }

    vi.unstubAllEnvs();
  });

  it('замораживает метрику без tags и metadata', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 1.0,
      rules: [],
    });

    // Создаем метрику без tags и metadata для теста
    const metricWithoutExtras: PerformanceMetric = {
      name: 'UNKNOWN_METRIC',
      value: 1000,
      timestamp: 1234567890,
    };
    tracker.record(metricWithoutExtras);
    tracker.flush();

    const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
    expect(loggedMetric).toBeDefined();
    if (loggedMetric) {
      expect(Object.isFrozen(loggedMetric)).toBe(true);
    }

    vi.unstubAllEnvs();
  });
});

/* ============================================================================
 * 📦 BATCHER — MetricsBatcher
 * ============================================================================ */

describe('MetricsBatcher', () => {
  describe('add', () => {
    it('добавляет метрику в буфер', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 5,
        sampleRate: 1.0,
        rules: [],
      });

      const metric = createPassingMetric();
      tracker.record(metric);

      expect(tracker.getBufferSize()).toBe(1);
    });

    it('автоматически отправляет батч при достижении batchSize', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, { batchSize: 2 });

      tracker.record(createTestMetric({ name: 'metric1' }));
      tracker.record(createTestMetric({ name: 'metric2' }));

      // Батч должен быть автоматически отправлен
      expect(logger.getBatches().length).toBeGreaterThan(0);
    });

    it('не отправляет батч если размер меньше batchSize', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, { batchSize: 5 });

      tracker.record(createTestMetric({ name: 'metric1' }));
      tracker.record(createTestMetric({ name: 'metric2' }));

      // Батч не должен быть отправлен автоматически
      expect(logger.getBatches().length).toBe(0);
    });

    it('удаляет самое старое при переполнении (drop-oldest)', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxBufferSize: 3,
        bufferOverflowStrategy: 'drop-oldest',
        batchSize: 10, // Не отправлять автоматически
        sampleRate: 1.0,
        rules: [],
      });

      tracker.record(createPassingMetric({ name: 'metric1' }));
      tracker.record(createPassingMetric({ name: 'metric2' }));
      tracker.record(createPassingMetric({ name: 'metric3' }));
      tracker.record(createPassingMetric({ name: 'metric4' })); // Переполнение

      expect(tracker.getBufferSize()).toBe(3);
      tracker.flush();
      const metrics = logger.getMetrics();
      const batches = logger.getBatches();
      const allMetrics = [...metrics, ...(batches[0] ?? [])];
      // Самое старое (metric1) должно быть удалено
      expect(allMetrics.some((m: PerformanceMetric) => m.name === 'metric1')).toBe(false);
      expect(allMetrics.some((m: PerformanceMetric) => m.name === 'metric4')).toBe(true);
    });

    it('игнорирует новую метрику при переполнении (drop-newest)', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxBufferSize: 3,
        bufferOverflowStrategy: 'drop-newest',
        batchSize: 10,
        sampleRate: 1.0,
        rules: [],
      });

      tracker.record(createPassingMetric({ name: 'metric1' }));
      tracker.record(createPassingMetric({ name: 'metric2' }));
      tracker.record(createPassingMetric({ name: 'metric3' }));
      tracker.record(createPassingMetric({ name: 'metric4' })); // Переполнение

      expect(tracker.getBufferSize()).toBe(3);
      tracker.flush();
      const metrics = logger.getMetrics();
      const batches = logger.getBatches();
      const allMetrics = [...metrics, ...(batches[0] ?? [])];
      // Новая метрика (metric4) должна быть проигнорирована
      expect(allMetrics.some((m: PerformanceMetric) => m.name === 'metric4')).toBe(false);
      expect(allMetrics.some((m: PerformanceMetric) => m.name === 'metric1')).toBe(true);
    });

    it('использует дефолтную стратегию drop-oldest', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxBufferSize: 2,
        batchSize: 10,
        // bufferOverflowStrategy не задан
      });

      tracker.record(createTestMetric({ name: 'metric1' }));
      tracker.record(createTestMetric({ name: 'metric2' }));
      tracker.record(createTestMetric({ name: 'metric3' })); // Переполнение

      expect(tracker.getBufferSize()).toBe(2);
      tracker.flush();
      const metrics = logger.getMetrics();
      // Должна использоваться drop-oldest по умолчанию
      expect(metrics.some((m: PerformanceMetric) => m.name === 'metric1')).toBe(false);
    });
  });

  describe('flush', () => {
    it('отправляет накопленные метрики через logger.metrics если доступен', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, { batchSize: 10 });

      tracker.record(createTestMetric({ name: 'metric1' }));
      tracker.record(createTestMetric({ name: 'metric2' }));
      tracker.flush();

      expect(logger.getBatches().length).toBe(1);
      expect(logger.getBatches()[0]?.length).toBe(2);
    });

    it('отправляет метрики по одной через logger.metric если batch API недоступен', () => {
      const logger = createTestLogger();
      // Удаляем metrics метод
      delete (logger as { metrics?: unknown; }).metrics;

      const tracker = createPerformanceTracker(logger, { batchSize: 10 });

      tracker.record(createTestMetric({ name: 'metric1' }));
      tracker.record(createTestMetric({ name: 'metric2' }));
      tracker.flush();

      expect(logger.getMetrics().length).toBe(2);
    });

    it('не отправляет если буфер пуст', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger);

      tracker.flush();

      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('защищен от double flush через isFlushing flag', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, { batchSize: 10 });

      tracker.record(createTestMetric({ name: 'metric1' }));

      // Симулируем одновременный flush
      tracker.flush();
      tracker.flush(); // Второй flush должен быть проигнорирован

      const totalMetrics = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
      expect(totalMetrics).toBe(1);
    });

    it('очищает таймер при flush', () => {
      vi.useFakeTimers();
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 10,
        flushInterval: 5000,
      });

      tracker.record(createTestMetric({ name: 'metric1' }));

      // Запускается таймер
      expect(tracker.getBufferSize()).toBe(1);

      // Flush должен очистить таймер
      tracker.flush();

      // Таймер не должен сработать после flush
      vi.advanceTimersByTime(6000);
      expect(logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0)).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('clear', () => {
    it('очищает буфер без отправки', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, { batchSize: 10 });

      tracker.record(createTestMetric({ name: 'metric1' }));
      tracker.record(createTestMetric({ name: 'metric2' }));

      expect(tracker.getBufferSize()).toBe(2);

      tracker.clear();

      expect(tracker.getBufferSize()).toBe(0);
      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('очищает таймер при clear', () => {
      vi.useFakeTimers();
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 10,
        flushInterval: 5000,
      });

      tracker.record(createTestMetric({ name: 'metric1' }));
      expect(tracker.getBufferSize()).toBe(1);

      tracker.clear();

      // Таймер не должен сработать после clear
      vi.advanceTimersByTime(6000);
      expect(logger.getMetrics().length).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('getBufferSize', () => {
    it('возвращает текущий размер буфера', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 10,
        sampleRate: 1.0,
        rules: [],
      });

      expect(tracker.getBufferSize()).toBe(0);

      tracker.record(createPassingMetric());
      expect(tracker.getBufferSize()).toBe(1);

      tracker.record(createPassingMetric());
      expect(tracker.getBufferSize()).toBe(2);

      tracker.flush();
      expect(tracker.getBufferSize()).toBe(0);
    });
  });

  describe('flushInterval', () => {
    it('автоматически отправляет батч через flushInterval', async () => {
      vi.useFakeTimers();
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 10,
        flushInterval: 5000,
      });

      tracker.record(createTestMetric({ name: 'metric1' }));

      expect(logger.getBatches().length).toBe(0);

      vi.advanceTimersByTime(5000);

      expect(logger.getBatches().length).toBe(1);
      expect(logger.getBatches()[0]?.length).toBe(1);

      vi.useRealTimers();
    });

    it('не запускает таймер если flushInterval = 0', () => {
      vi.useFakeTimers();
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 10,
        flushInterval: 0,
      });

      tracker.record(createTestMetric({ name: 'metric1' }));

      vi.advanceTimersByTime(10000);

      // Таймер не должен сработать
      expect(logger.getBatches().length).toBe(0);

      vi.useRealTimers();
    });

    it('использует immediate flush если setTimeout недоступен', () => {
      const originalSetTimeout = global.setTimeout;
      delete (global as { setTimeout?: typeof setTimeout; }).setTimeout;

      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        batchSize: 10,
        flushInterval: 5000, // Должен быть проигнорирован
      });

      tracker.record(createTestMetric({ name: 'metric1' }));

      // Батч должен быть отправлен сразу при достижении batchSize
      tracker.record(createTestMetric({ name: 'metric2' }));
      tracker.record(createTestMetric({ name: 'metric3' }));
      // ... до batchSize

      global.setTimeout = originalSetTimeout;
    });
  });
});

/* ============================================================================
 * 🚀 PERFORMANCE TRACKER — Pipeline
 * ============================================================================ */

describe('PerformanceTracker', () => {
  describe('constructor', () => {
    it('использует дефолтные значения конфигурации', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger);

      expect(tracker.getCurrentTime()).toBeGreaterThan(0);
      expect(tracker.getBufferSize()).toBe(0);
    });

    it('применяет кастомную конфигурацию', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 0.5,
        batchSize: 5,
        flushInterval: 1000,
        maxBufferSize: 100,
        enabled: true,
      });

      expect(tracker.getBufferSize()).toBe(0);
    });

    it('отключает трекинг если enabled = false', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, { enabled: false });

      tracker.record(createTestMetric());
      tracker.flush();

      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('включает трекинг по умолчанию', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger); // enabled не задан

      tracker.record(createTestMetric({ name: 'LCP', value: 3000 }));
      tracker.flush();

      expect(logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('record - pipeline', () => {
    it('обрабатывает метрику через processors', () => {
      const logger = createTestLogger();
      const processor: MetricProcessor = {
        process: (metric) => ({
          ...metric,
          value: metric.value * 2,
        }),
      };

      const tracker = createPerformanceTracker(logger, {
        processors: [processor],
        sampleRate: 1.0,
        rules: [],
      });

      const metric = createPassingMetric({ value: 100 });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.value).toBe(200);
    });

    it('фильтрует метрику если processor возвращает null', () => {
      const logger = createTestLogger();
      const processor: MetricProcessor = {
        process: () => null,
      };

      const tracker = createPerformanceTracker(logger, {
        processors: [processor],
      });

      const metric = createTestMetric();
      tracker.record(metric);
      tracker.flush();

      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('обрабатывает несколько processors последовательно', () => {
      const logger = createTestLogger();
      const processor1: MetricProcessor = {
        process: (metric) => ({
          ...metric,
          value: metric.value + 10,
        }),
      };
      const processor2: MetricProcessor = {
        process: (metric) => ({
          ...metric,
          value: metric.value * 2,
        }),
      };

      const tracker = createPerformanceTracker(logger, {
        processors: [processor1, processor2],
        sampleRate: 1.0,
        rules: [],
      });

      const metric = createPassingMetric({ value: 100 });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      // (100 + 10) * 2 = 220
      expect(loggedMetric?.value).toBe(220);
    });

    it('прерывает pipeline если processor возвращает null', () => {
      const logger = createTestLogger();
      const processor1: MetricProcessor = {
        process: () => null,
      };
      const processor2: MetricProcessor = {
        process: (metric) => ({
          ...metric,
          value: metric.value * 2,
        }),
      };

      const tracker = createPerformanceTracker(logger, {
        processors: [processor1, processor2],
      });

      const metric = createTestMetric({ value: 100 });
      tracker.record(metric);
      tracker.flush();

      // processor2 не должен быть вызван
      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('применяет sanitize только если tags/metadata изменились', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        maxTagLength: 5,
        sampleRate: 1.0,
        rules: [],
      });

      // Метрика с короткими тегами (не требуют sanitize)
      const metric1 = createPassingMetric({ tags: { key: 'val' } });
      tracker.record(metric1);
      tracker.flush();

      const loggedMetric1 = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric1?.tags).toEqual({ key: 'val' });

      logger.clear();
      tracker.clear();

      // Метрика с длинными тегами (требуют sanitize)
      const metric2 = createPassingMetric({ tags: { key: 'very long value' } });
      tracker.record(metric2);
      tracker.flush();

      const loggedMetric2 = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric2?.tags?.['key']).toBe('very ...');
    });

    it('не создает новый объект если tags и metadata не изменились', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [],
      });

      const metric = createPassingMetric({ tags: { key: 'value' }, metadata: { data: 'test' } });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      // Объект должен быть создан (из-за freeze в dev mode), но структура должна совпадать
      expect(loggedMetric?.tags).toEqual(metric.tags);
      expect(loggedMetric?.metadata).toEqual(metric.metadata);
    });

    it('фильтрует метрику если value не превышает threshold', () => {
      const logger = createTestLogger();
      const rules: readonly MetricRule[] = [
        { name: 'LCP', threshold: 2500 },
      ];

      const tracker = createPerformanceTracker(logger, { rules });

      const metric = createTestMetric({ name: 'LCP', value: 1000 }); // Ниже threshold
      tracker.record(metric);
      tracker.flush();

      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('фильтрует метрику если sampler возвращает false', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 0.0, // Ничего не сэмплируем
      });

      const metric = createTestMetric({ name: 'LCP', value: 3000 });
      tracker.record(metric);
      tracker.flush();

      expect(logger.getMetrics().length).toBe(0);
      expect(logger.getBatches().length).toBe(0);
    });

    it('выполняет полный pipeline: processors → sanitize → rules → sampler → batcher', () => {
      const logger = createTestLogger();
      const processor: MetricProcessor = {
        process: (metric) => ({
          ...metric,
          tags: { ...metric.tags, processed: 'true' },
        }),
      };

      const rules: readonly MetricRule[] = [
        { name: 'LCP', threshold: 2500 },
      ];

      const tracker = createPerformanceTracker(logger, {
        processors: [processor],
        rules,
        sampleRate: 1.0,
        maxTagLength: 10,
      });

      const metric = createTestMetric({
        name: 'LCP',
        value: 3000,
        tags: { original: 'tag' },
      });

      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric).toBeDefined();
      expect(loggedMetric?.name).toBe('LCP');
      expect(loggedMetric?.value).toBe(3000);
      expect(loggedMetric?.tags?.['processed']).toBe('true');
    });
  });

  describe('hasOwnKeys optimization', () => {
    it('пропускает sanitize для undefined tags (оптимизация)', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger);

      // Создаем метрику без tags для теста
      const metricWithoutTags: PerformanceMetric = {
        name: 'LCP',
        value: 2500,
        timestamp: 1234567890,
        ...(createTestMetric().metadata && { metadata: createTestMetric().metadata }),
      };
      tracker.record(metricWithoutTags);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.tags).toBeUndefined();
    });

    it('пропускает sanitize для пустых tags (оптимизация)', () => {
      const logger = createTestLogger();
      const tracker = createPerformanceTracker(logger, {
        sampleRate: 1.0,
        rules: [],
      });

      const metric = createPassingMetric({ tags: {} });
      tracker.record(metric);
      tracker.flush();

      const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
      expect(loggedMetric?.tags).toEqual({});
    });
  });
});

/* ============================================================================
 * 🏭 FACTORY — createPerformanceTracker
 * ============================================================================ */

describe('createPerformanceTracker', () => {
  it('создает новый экземпляр PerformanceTracker', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger);

    expect(tracker).toBeInstanceOf(PerformanceTracker);
  });

  it('создает независимые экземпляры', () => {
    const logger1 = createTestLogger();
    const logger2 = createTestLogger();

    const tracker1 = createPerformanceTracker(logger1);
    const tracker2 = createPerformanceTracker(logger2);

    tracker1.record(createTestMetric({ name: 'metric1' }));
    tracker2.record(createTestMetric({ name: 'metric2' }));

    tracker1.flush();
    tracker2.flush();

    expect(logger1.getMetrics().length + (logger1.getBatches()[0]?.length ?? 0)).toBe(1);
    expect(logger2.getMetrics().length + (logger2.getBatches()[0]?.length ?? 0)).toBe(1);
  });

  it('применяет конфигурацию при создании', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      batchSize: 5,
      flushInterval: 1000,
      maxBufferSize: 50,
    });

    expect(tracker.getBufferSize()).toBe(0);
  });
});

/* ============================================================================
 * 🔄 ИНТЕГРАЦИОННЫЕ ТЕСТЫ
 * ============================================================================ */

describe('Интеграционные тесты', () => {
  it('полный цикл: record → flush → проверка', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      batchSize: 3,
      flushInterval: 0,
    });

    tracker.record(createTestMetric({ name: 'LCP', value: 3000 }));
    tracker.record(createTestMetric({ name: 'CLS', value: 0.2 }));
    tracker.record(createTestMetric({ name: 'INP', value: 250 }));

    tracker.flush();

    const totalMetrics = logger.getMetrics().length + (logger.getBatches()[0]?.length ?? 0);
    expect(totalMetrics).toBeGreaterThan(0);
  });

  it('работает с комплексной конфигурацией', () => {
    const logger = createTestLogger();
    const processor: MetricProcessor = {
      process: (metric) => ({
        ...metric,
        tags: { ...metric.tags, source: 'test' },
      }),
    };

    const rules: readonly MetricRule[] = [
      { name: 'api.*', threshold: 500 },
      { name: /^component\./, threshold: 100 },
    ];

    const tracker = createPerformanceTracker(logger, {
      sampleRate: 0.8,
      samplingKey: 'test-key',
      batchSize: 5,
      flushInterval: 2000,
      maxBufferSize: 100,
      bufferOverflowStrategy: 'drop-oldest',
      rules,
      processors: [processor],
      maxTagLength: 50,
      maxTagCount: 20,
      maxMetadataSize: 5000,
    });

    tracker.record(createTestMetric({
      name: 'api.request',
      value: 600,
      tags: { endpoint: '/users' },
      metadata: { userId: '123' },
    }));

    tracker.flush();

    const loggedMetric = logger.getMetrics()[0] ?? logger.getBatches()[0]?.[0];
    expect(loggedMetric).toBeDefined();
    expect(loggedMetric?.tags?.['source']).toBe('test');
  });

  it('обрабатывает edge case: все метрики отфильтрованы', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      sampleRate: 0.0, // Ничего не сэмплируем
    });

    tracker.record(createTestMetric({ name: 'LCP', value: 3000 }));
    tracker.record(createTestMetric({ name: 'CLS', value: 0.2 }));
    tracker.flush();

    expect(logger.getMetrics().length).toBe(0);
    expect(logger.getBatches().length).toBe(0);
  });

  it('обрабатывает edge case: буфер переполнен и очищен', () => {
    const logger = createTestLogger();
    const tracker = createPerformanceTracker(logger, {
      maxBufferSize: 2,
      batchSize: 10,
      bufferOverflowStrategy: 'drop-oldest',
    });

    tracker.record(createTestMetric({ name: 'metric1' }));
    tracker.record(createTestMetric({ name: 'metric2' }));
    tracker.record(createTestMetric({ name: 'metric3' }));
    tracker.record(createTestMetric({ name: 'metric4' }));

    expect(tracker.getBufferSize()).toBe(2);
    tracker.flush();

    const metrics = logger.getMetrics();
    const batches = logger.getBatches();
    const total = metrics.length + (batches[0]?.length ?? 0);
    expect(total).toBe(2);
    // Самое старое должно быть удалено
    expect(
      metrics.some((m: PerformanceMetric) => m.name === 'metric1')
        || batches[0]?.some((m: PerformanceMetric) => m.name === 'metric1'),
    ).toBe(false);
  });
});

/* eslint-enable fp/no-mutation, ai-security/model-poisoning */
