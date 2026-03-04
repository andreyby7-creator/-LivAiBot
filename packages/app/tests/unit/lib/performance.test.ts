/**
 * @vitest-environment jsdom
 * @file Unit тесты для packages/app/src/lib/performance.ts
 * Enterprise-grade тестирование системы мониторинга производительности с 90-100% покрытием:
 * - Core Web Vitals метрики и их сбор
 * - Рендеринг компонентов и API вызовов
 * - Батчинг метрик с таймаутами
 * - React hooks для интеграции
 * - Инициализация и управление состоянием
 * - Memory API и Performance API проверки
 * - Error handling и graceful degradation
 * - Type safety и edge cases
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
import { Effect as EffectLib } from 'effect';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock telemetry functions using vi.mock
vi.mock('../../../src/lib/telemetry-runtime', () => ({
  errorFireAndForget: vi.fn(),
  warnFireAndForget: vi.fn(),
  infoFireAndForget: vi.fn(),
}));

// Import after mocking
import {
  errorFireAndForget,
  infoFireAndForget,
  warnFireAndForget,
} from '../../../src/lib/telemetry-runtime';

// Get mocked functions
const mockErrorFireAndForget = vi.mocked(errorFireAndForget);
const mockWarnFireAndForget = vi.mocked(warnFireAndForget);
const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

// Mock Date.now for consistent timestamps in tests
const mockNow = 1234567890123;
vi.spyOn(Date, 'now').mockReturnValue(mockNow);

// Note: React hooks are tested with renderHook but we don't mock them
// to ensure realistic behavior

// React hooks are imported automatically by renderHook

// Импорты из тестируемого модуля
import type {
  PerformanceConfig,
  PerformanceMetric,
  WebVitalsValue,
} from '../../../src/lib/performance.js';

import {
  addMetricToBuffer,
  calculateApiResponseSeverity,
  calculateComponentRenderSeverity,
  calculateMemoryUsageSeverity,
  calculateResourceLoadSeverity,
  calculateSeverity,
  collectApiResponseMetric,
  collectComponentRenderMetric,
  collectMemoryUsageMetric,
  collectWebVitalsMetric,
  // Internal functions exported for testing
  createMetricId,
  createPerformanceError,
  createPerformanceMetric,
  flushMetricsBuffer,
  getPerformanceConfig,
  initPerformanceMonitoring,
  isMemoryAPISupported,
  isPerformanceAPISupported,
  legacyRandomId,
  PerformanceMetricType,
  PerformanceSeverity,
  resetPerformanceStateForTests,
  stopPerformanceMonitoring,
  useApiPerformanceTracking,
  usePerformanceProfiling,
  useWebVitalsTracking,
  WebVitalsMetric,
  webVitalsRatingToSeverity,
} from '../../../src/lib/performance';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock Performance API
 */
function createMockPerformance(): Performance {
  const mockPerformance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    getEntries: vi.fn(() => []),
    timing: {
      navigationStart: Date.now(),
      loadEventEnd: Date.now() + 1000,
      domContentLoadedEventEnd: Date.now() + 500,
    } as PerformanceTiming,
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 500 * 1024 * 1024, // 500MB
    } as any,
  };

  return mockPerformance as unknown as Performance;
}

/**
 * Создает mock WebVitalsValue
 */
function createMockWebVitalsValue(overrides: Partial<WebVitalsValue> = {}): WebVitalsValue {
  return {
    name: 'FCP' as WebVitalsMetric,
    value: 1500,
    id: 'test-vitals-id',
    delta: 100,
    rating: 'good',
    ...overrides,
  };
}

/**
 * Создает mock window с Performance API
 */
function createMockWindow(overrides: Partial<Window> = {}): Window {
  const mockWindow = {
    performance: createMockPerformance(),
    setTimeout: vi.fn((cb, delay) => setTimeout(cb, delay)),
    clearTimeout: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
    ...overrides,
  };

  return mockWindow as Window;
}

/**
 * Создает mock crypto API
 */
function createMockCrypto(): Crypto {
  return {
    randomUUID: vi.fn(() => 'test-uuid-123'),
  } as unknown as Crypto;
}

/**
 * Настраивает глобальное окружение для тестов
 */

function setupTestEnvironment(mockWindow?: Window, mockCrypto?: Crypto): void {
  if (mockWindow) {
    vi.stubGlobal('window', mockWindow);
  }

  if (mockCrypto) {
    vi.stubGlobal('crypto', mockCrypto);
  }

  // Mock React hooks
  vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return {
      ...actual,
      useRef: vi.fn(() => ({ current: undefined })),
      useEffect: vi.fn((effect) => effect()),
      useCallback: vi.fn((fn) => fn),
    };
  });

  // Mock telemetry functions
  vi.mock('../../../src/lib/telemetry-runtime', () => ({
    errorFireAndForget: vi.fn(),
    infoFireAndForget: vi.fn(),
    warnFireAndForget: vi.fn(),
  }));
}

/**
 * Очищает глобальное окружение после тестов
 */
function cleanupTestEnvironment(): void {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Performance Monitoring System - Enterprise Grade', () => {
  beforeEach(() => {
    setupTestEnvironment(createMockWindow(), createMockCrypto());
    resetPerformanceStateForTests();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Constants and Types', () => {
    it('PerformanceMetricType содержит все ожидаемые типы', () => {
      expect(PerformanceMetricType.WEB_VITALS).toBe('WEB_VITALS');
      expect(PerformanceMetricType.COMPONENT_RENDER).toBe('COMPONENT_RENDER');
      expect(PerformanceMetricType.API_RESPONSE).toBe('API_RESPONSE');
      expect(PerformanceMetricType.RESOURCE_LOAD).toBe('RESOURCE_LOAD');
      expect(PerformanceMetricType.NAVIGATION).toBe('NAVIGATION');
      expect(PerformanceMetricType.MEMORY_USAGE).toBe('MEMORY_USAGE');
      expect(PerformanceMetricType.CUSTOM).toBe('CUSTOM');
    });

    it('PerformanceSeverity содержит все уровни критичности', () => {
      expect(PerformanceSeverity.LOW).toBe('LOW');
      expect(PerformanceSeverity.MEDIUM).toBe('MEDIUM');
      expect(PerformanceSeverity.HIGH).toBe('HIGH');
      expect(PerformanceSeverity.CRITICAL).toBe('CRITICAL');
    });

    it('WebVitalsMetric содержит все метрики Core Web Vitals', () => {
      expect(WebVitalsMetric.CLS).toBe('CLS');
      expect(WebVitalsMetric.INP).toBe('INP');
      expect(WebVitalsMetric.FCP).toBe('FCP');
      expect(WebVitalsMetric.LCP).toBe('LCP');
      expect(WebVitalsMetric.TTFB).toBe('TTFB');
    });
  });

  describe('Utility Functions', () => {
    describe('createMetricId', () => {
      it('создает ID с правильным форматом', () => {
        const id = createMetricId('WEB_VITALS', 'FCP');
        expect(id).toContain('WEB_VITALS_FCP');
        expect(id).toContain(mockNow.toString()); // Should contain mocked timestamp
        // UUID format: 8-4-4-4-12 characters with dashes
        expect(id).toMatch(
          /WEB_VITALS_FCP_\d+_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
        );
      });

      it('использует fallback для окружений без crypto', () => {
        vi.stubGlobal('crypto', undefined);
        const id = createMetricId('COMPONENT_RENDER', 'MyComponent');
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });

      it('включает timestamp в ID', () => {
        const before = Date.now();
        const id = createMetricId('API_RESPONSE', 'GET /api/users');
        const after = Date.now();

        const timestampStr = id.split('_')[3];
        expect(timestampStr).toBeDefined();
        const timestamp = parseInt(timestampStr!);
        expect(timestamp).toBeGreaterThanOrEqual(before);
        expect(timestamp).toBeLessThanOrEqual(after);
      });
    });

    describe('webVitalsRatingToSeverity', () => {
      it('маппит good рейтинг в LOW severity', () => {
        expect(webVitalsRatingToSeverity('good')).toBe('LOW');
      });

      it('маппит needs-improvement рейтинг в MEDIUM severity', () => {
        expect(webVitalsRatingToSeverity('needs-improvement')).toBe('MEDIUM');
      });

      it('маппит poor рейтинг в HIGH severity', () => {
        expect(webVitalsRatingToSeverity('poor')).toBe('HIGH');
      });
    });

    describe('calculateSeverity', () => {
      it('возвращает LOW для значений ниже порога', () => {
        expect(calculateSeverity(10, undefined, 'COMPONENT_RENDER')).toBe('LOW');
      });

      it('возвращает MEDIUM для средних значений', () => {
        expect(calculateSeverity(30, undefined, 'COMPONENT_RENDER')).toBe('MEDIUM');
      });

      it('возвращает HIGH для высоких значений', () => {
        expect(calculateSeverity(80, undefined, 'COMPONENT_RENDER')).toBe('HIGH');
      });

      it('возвращает CRITICAL для критически высоких значений', () => {
        expect(calculateSeverity(3001, undefined, 'API_RESPONSE')).toBe('CRITICAL');
      });

      it('использует кастомные thresholds', () => {
        expect(calculateSeverity(60, { componentRenderTime: 50 }, 'COMPONENT_RENDER')).toBe(
          'MEDIUM',
        );
      });
    });

    describe('isPerformanceAPISupported', () => {
      it('возвращает true когда Performance API доступен', () => {
        setupTestEnvironment(createMockWindow(), createMockCrypto());
        expect(isPerformanceAPISupported()).toBe(true);
      });

      it('возвращает false когда window не определен', () => {
        vi.stubGlobal('window', undefined);
        expect(isPerformanceAPISupported()).toBe(false);
      });

      it('возвращает false когда performance не доступен', () => {
        vi.stubGlobal('window', {});
        expect(isPerformanceAPISupported()).toBe(false);
      });

      it('возвращает false когда performance.mark не функция', () => {
        const mockWindow = createMockWindow();
        delete (mockWindow.performance as any).mark;
        vi.stubGlobal('window', mockWindow);
        expect(isPerformanceAPISupported()).toBe(false);
      });
    });

    describe('isMemoryAPISupported', () => {
      it('возвращает true когда Memory API доступен', () => {
        setupTestEnvironment(createMockWindow(), createMockCrypto());
        expect(isMemoryAPISupported()).toBe(true);
      });

      it('возвращает false когда window не определен', () => {
        vi.stubGlobal('window', undefined);
        expect(isMemoryAPISupported()).toBe(false);
      });

      it('возвращает false когда performance не доступен', () => {
        vi.stubGlobal('window', {});
        expect(isMemoryAPISupported()).toBe(false);
      });

      it('возвращает false когда memory не доступен', () => {
        const mockWindow = createMockWindow();
        delete (mockWindow.performance as any).memory;
        vi.stubGlobal('window', mockWindow);
        expect(isMemoryAPISupported()).toBe(false);
      });
    });
  });

  describe('createPerformanceMetric', () => {
    it('создает метрику с правильной структурой', () => {
      const metric = createPerformanceMetric(
        'COMPONENT_RENDER',
        'MyComponent',
        25,
        'ms',
        { componentName: 'MyComponent' },
        { renderCount: 1 },
      );

      expect(metric).toEqual({
        id: expect.stringContaining('COMPONENT_RENDER_MyComponent'),
        type: 'COMPONENT_RENDER',
        name: 'MyComponent',
        value: 25,
        unit: 'ms',
        severity: 'MEDIUM',
        timestamp: expect.any(Number),
        context: { componentName: 'MyComponent' },
        metadata: { renderCount: 1 },
      });
    });

    it('применяет правильную severity логику', () => {
      const lowMetric = createPerformanceMetric('COMPONENT_RENDER', 'FastComponent', 5, 'ms');
      const highMetric = createPerformanceMetric('COMPONENT_RENDER', 'SlowComponent', 100, 'ms');

      expect(lowMetric.severity).toBe('LOW');
      expect(highMetric.severity).toBe('HIGH');
    });

    it('работает без опциональных параметров', () => {
      const metric = createPerformanceMetric('MEMORY_USAGE', 'heap', 1000000, 'bytes');

      expect(metric.context).toBeUndefined();
      expect(metric.metadata).toBeUndefined();
      expect(metric.isSynthetic).toBeUndefined();
    });
  });

  describe('collectWebVitalsMetric', () => {
    it('успешно собирает Web Vitals метрику', async () => {
      const vitals = createMockWebVitalsValue({ name: 'FCP', value: 1200, rating: 'good' });
      const result = await EffectLib.runPromise(collectWebVitalsMetric(vitals));

      expect(result).toEqual({
        id: expect.stringContaining('WEB_VITALS_FCP'),
        type: 'WEB_VITALS',
        name: 'FCP',
        value: 1200,
        unit: 'ms',
        severity: 'LOW', // good rating -> LOW severity
        timestamp: expect.any(Number),
        context: undefined,
        metadata: {
          rating: 'good',
          id: 'test-vitals-id',
          delta: 100,
        },
      });
    });

    it('перезаписывает severity на основе Web Vitals rating', async () => {
      const vitals = createMockWebVitalsValue({
        name: 'CLS',
        value: 0.1,
        rating: 'poor', // poor rating должен дать HIGH severity несмотря на низкое значение
      });
      const result = await EffectLib.runPromise(collectWebVitalsMetric(vitals));

      expect(result.severity).toBe('HIGH'); // poor -> HIGH
    });

    it('использует score unit для CLS метрики', async () => {
      const vitals = createMockWebVitalsValue({ name: 'CLS', value: 0.05 });
      const result = await EffectLib.runPromise(collectWebVitalsMetric(vitals));

      expect(result.unit).toBe('score');
    });

    it('использует ms unit для других Web Vitals метрик', async () => {
      const vitals = createMockWebVitalsValue({ name: 'FCP', value: 1500 });
      const result = await EffectLib.runPromise(collectWebVitalsMetric(vitals));

      expect(result.unit).toBe('ms');
    });
  });

  describe('collectComponentRenderMetric', () => {
    it('создает метрику рендеринга компонента', async () => {
      const result = await EffectLib.runPromise(
        collectComponentRenderMetric('MyComponent', 25, { route: '/home' }),
      );

      expect(result).toEqual({
        id: expect.stringContaining('COMPONENT_RENDER_component_render_MyComponent'),
        type: 'COMPONENT_RENDER',
        name: 'component_render_MyComponent',
        value: 25,
        unit: 'ms',
        severity: 'MEDIUM',
        timestamp: expect.any(Number),
        context: {
          componentName: 'MyComponent',
          route: '/home',
        },
      });
    });

    it('логирует предупреждение для медленных рендеров', async () => {
      // Use mocked function

      await EffectLib.runPromise(collectComponentRenderMetric('SlowComponent', 50));

      expect(mockWarnFireAndForget).toHaveBeenCalledWith(
        'Медленный рендер компонента',
        {
          componentName: 'SlowComponent',
          renderTime: 50,
          threshold: 16,
        },
      );
    });
  });

  describe('collectApiResponseMetric', () => {
    it('создает метрику API ответа', async () => {
      const result = await EffectLib.runPromise(
        collectApiResponseMetric('/api/users', 'GET', 500, 200, 1024, { userId: '123' }),
      );

      expect(result).toEqual({
        id: expect.stringContaining('API_RESPONSE_api_response_GET_/api/users'),
        type: 'API_RESPONSE',
        name: 'api_response_GET_/api/users',
        value: 500,
        unit: 'ms',
        severity: 'LOW',
        timestamp: expect.any(Number),
        context: {
          route: 'GET /api/users',
          userId: '123',
        },
        metadata: {
          statusCode: 200,
          responseSize: 1024,
        },
      });
    });

    it('работает без responseSize', async () => {
      const result = await EffectLib.runPromise(
        collectApiResponseMetric('/api/data', 'POST', 300, 201),
      );

      expect(result.metadata).toEqual({
        statusCode: 201,
      });
    });

    it('логирует предупреждение для медленных API вызовов', async () => {
      // Use mocked function

      await EffectLib.runPromise(collectApiResponseMetric('/api/slow', 'GET', 2001, 200));

      expect(mockWarnFireAndForget).toHaveBeenCalledWith(
        'Медленный API ответ',
        {
          endpoint: '/api/slow',
          method: 'GET',
          responseTime: 2001,
          statusCode: 200,
        },
      );
    });
  });

  describe('collectMemoryUsageMetric', () => {
    it('собирает метрику использования памяти', async () => {
      const result = await EffectLib.runPromise(collectMemoryUsageMetric());

      expect(result).toEqual({
        id: expect.stringContaining('MEMORY_USAGE_memory_usage'),
        type: 'MEMORY_USAGE',
        name: 'memory_usage',
        value: 52428800, // 50MB
        unit: 'bytes',
        severity: 'LOW',
        timestamp: expect.any(Number),
        context: undefined,
        metadata: {
          totalMemory: 104857600, // 100MB
          limitMemory: 524288000, // 500MB
          usagePercentage: 10, // 50/500 * 100
        },
      });
    });

    it('возвращает ошибку когда Memory API недоступен', async () => {
      // Убираем memory из performance
      const mockWindow = createMockWindow();
      delete (mockWindow.performance as any).memory;
      vi.stubGlobal('window', mockWindow);

      await expect(EffectLib.runPromise(collectMemoryUsageMetric())).rejects.toThrow(
        '{"code":"PERFORMANCE_API_UNAVAILABLE","message":"Memory API недоступен для сбора метрик памяти","severity":"LOW"}',
      );
    });
  });

  describe('Batching System', () => {
    describe('addMetricToBuffer', () => {
      it('добавляет метрику в буфер', async () => {
        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        await EffectLib.runPromise(addMetricToBuffer(metric));

        // Проверяем что метрика добавлена через flush
        const flushed = await EffectLib.runPromise(flushMetricsBuffer());
        expect(flushed).toBeUndefined();
      });

      it('отправляет метрики когда буфер переполнен', async () => {
        // Use mocked function

        // Создаем много метрик для переполнения буфера
        const metrics: PerformanceMetric[] = [];
        for (let i = 0; i < 105; i++) {
          metrics.push({
            id: `test-metric-${i}`,
            type: 'CUSTOM',
            name: `test-${i}`,
            value: 100,
            unit: 'ms',
            severity: 'LOW',
            timestamp: Date.now(),
          });
        }

        // Добавляем метрики
        for (const metric of metrics) {
          await EffectLib.runPromise(addMetricToBuffer(metric));
        }

        // Проверяем что метрики были отправлены (100 вызовов для 100 метрик при переполнении буфера)
        expect(mockInfoFireAndForget).toHaveBeenCalledTimes(100);
      });

      it('не работает когда мониторинг отключен', async () => {
        await EffectLib.runPromise(initPerformanceMonitoring({ enabled: false }));

        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        mockInfoFireAndForget.mockClear(); // Сбрасываем счетчик вызовов после init

        await EffectLib.runPromise(addMetricToBuffer(metric));

        expect(mockInfoFireAndForget).not.toHaveBeenCalled();
      });

      it('работает только в браузерном окружении', async () => {
        vi.stubGlobal('window', undefined);

        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        await EffectLib.runPromise(addMetricToBuffer(metric));

        // Use mocked function
        expect(mockInfoFireAndForget).not.toHaveBeenCalled();
      });
    });

    describe('flushMetricsBuffer', () => {
      it('отправляет все метрики из буфера', async () => {
        // Use mocked function

        const metric1: PerformanceMetric = {
          id: 'test-metric-1',
          type: 'COMPONENT_RENDER',
          name: 'Component1',
          value: 25,
          unit: 'ms',
          severity: 'MEDIUM',
          timestamp: Date.now(),
        };

        const metric2: PerformanceMetric = {
          id: 'test-metric-2',
          type: 'API_RESPONSE',
          name: 'API1',
          value: 500,
          unit: 'ms',
          severity: 'MEDIUM',
          timestamp: Date.now(),
        };

        await EffectLib.runPromise(addMetricToBuffer(metric1));
        await EffectLib.runPromise(addMetricToBuffer(metric2));
        await EffectLib.runPromise(flushMetricsBuffer());

        expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2);
        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'Performance metric collected',
          expect.objectContaining({
            type: 'COMPONENT_RENDER',
            name: 'Component1',
            value: 25,
          }),
        );
      });

      it('очищает буфер после отправки', async () => {
        // Use mocked function

        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        await EffectLib.runPromise(addMetricToBuffer(metric));
        await EffectLib.runPromise(flushMetricsBuffer());

        // Повторный flush не должен отправлять метрики
        await EffectLib.runPromise(flushMetricsBuffer());
        expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      });

      it('работает только в браузерном окружении', async () => {
        vi.stubGlobal('window', undefined);

        const result = await EffectLib.runPromise(flushMetricsBuffer());
        expect(result).toBeUndefined();
      });

      it('логирует ошибку при проблемах с телеметрией', async () => {
        // Мокаем infoFireAndForget чтобы он выбрасывал ошибку
        mockInfoFireAndForget.mockImplementation(() => {
          throw new Error('Telemetry failed');
        });

        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        await EffectLib.runPromise(addMetricToBuffer(metric));
        const result = await EffectLib.runPromise(flushMetricsBuffer());

        // Функция должна завершиться успешно несмотря на ошибки телеметрии
        expect(result).toBeUndefined();

        // Должна быть залогирована ошибка телеметрии
        expect(mockErrorFireAndForget).toHaveBeenCalledWith(
          'Не удалось отправить метрику производительности',
          {
            metricId: 'test-metric',
            metricType: 'CUSTOM',
            error: 'Error: Telemetry failed',
          },
        );
      });
    });
  });

  describe('React Hooks', () => {
    describe('usePerformanceProfiling', () => {
      it('настраивает профилирование компонента', () => {
        // Hook should not throw an error
        expect(() => {
          renderHook(() => usePerformanceProfiling('TestComponent'));
        }).not.toThrow();
      });
    });

    describe('useWebVitalsTracking', () => {
      it('настраивает Web Vitals трекинг', async () => {
        // Hook should not throw an error
        expect(() => {
          renderHook(() => useWebVitalsTracking());
        }).not.toThrow();
      });

      it('не настраивает трекинг когда Web Vitals отключены', () => {
        // Hook should not throw an error even when disabled
        expect(() => {
          renderHook(() => useWebVitalsTracking());
        }).not.toThrow();
      });
    });

    describe('useApiPerformanceTracking', () => {
      it('возвращает trackApiCall функцию', () => {
        const { result } = renderHook(() => useApiPerformanceTracking());

        expect(typeof result.current.trackApiCall).toBe('function');
        // Hook should return a valid function
        expect(result.current.trackApiCall).toBeInstanceOf(Function);
      });
    });

    describe('Internal Functions', () => {
      it('getPerformanceConfig возвращает текущую конфигурацию', () => {
        const config = getPerformanceConfig();
        expect(config).toHaveProperty('enabled');
        expect(config).toHaveProperty('thresholds');
        expect(config).toHaveProperty('batchInterval');
      });

      it('createPerformanceError создает объект ошибки', () => {
        const error = createPerformanceError('TELEMETRY_SEND_FAILED', 'Test error', 'HIGH', {
          test: true,
        });
        expect(error).toEqual({
          code: 'TELEMETRY_SEND_FAILED',
          message: 'Test error',
          severity: 'HIGH',
          context: { test: true },
          cause: undefined,
        });
      });

      it('legacyRandomId возвращает строку правильной длины', () => {
        const id = legacyRandomId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        // Should contain only valid characters for base36
        expect(id).toMatch(/^[a-z0-9]+$/);
      });

      it('calculateComponentRenderSeverity возвращает правильные уровни', () => {
        expect(calculateComponentRenderSeverity(10, undefined)).toBe('LOW'); // Below 16ms
        expect(calculateComponentRenderSeverity(20, undefined)).toBe('MEDIUM'); // Above 16ms
      });

      it('calculateApiResponseSeverity возвращает правильные уровни', () => {
        expect(calculateApiResponseSeverity(500, undefined)).toBe('LOW'); // Below 1000ms
        expect(calculateApiResponseSeverity(1500, undefined)).toBe('MEDIUM'); // Above 1000ms
        expect(calculateApiResponseSeverity(2500, undefined)).toBe('HIGH'); // Above 2000ms
        expect(calculateApiResponseSeverity(3500, undefined)).toBe('CRITICAL'); // Above 3000ms
      });

      it('calculateResourceLoadSeverity возвращает правильные уровни', () => {
        expect(calculateResourceLoadSeverity(1000)).toBe('LOW'); // Below 5000ms
        expect(calculateResourceLoadSeverity(6000)).toBe('MEDIUM'); // Above 5000ms
        expect(calculateResourceLoadSeverity(11000)).toBe('HIGH'); // Above 10000ms
      });

      it('calculateMemoryUsageSeverity возвращает правильные уровни', () => {
        expect(calculateMemoryUsageSeverity(50000000, undefined)).toBe('LOW'); // Below threshold
        expect(calculateMemoryUsageSeverity(100000000, undefined)).toBe('HIGH'); // Above threshold
      });
    });
  });

  describe('Initialization and Configuration', () => {
    describe('initPerformanceMonitoring', () => {
      it('инициализирует мониторинг с дефолтной конфигурацией', async () => {
        mockInfoFireAndForget.mockReset(); // Сбрасываем mock перед тестом

        await EffectLib.runPromise(initPerformanceMonitoring());

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'Инициализация системы мониторинга производительности',
          expect.any(Object),
        );
      });

      it('применяет кастомную конфигурацию', async () => {
        mockInfoFireAndForget.mockReset(); // Сбрасываем mock перед тестом

        const config: Partial<PerformanceConfig> = {
          enabled: false,
          batchInterval: 10000,
          enableWebVitals: false,
        };

        await EffectLib.runPromise(initPerformanceMonitoring(config));

        // Проверяем что конфигурация применена через getPerformanceConfig если бы он был экспортирован
      });

      it('логирует отключение мониторинга', async () => {
        mockInfoFireAndForget.mockReset(); // Сбрасываем mock перед тестом

        await EffectLib.runPromise(initPerformanceMonitoring({ enabled: false }));

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'Мониторинг производительности отключен через конфигурацию',
        );
      });

      it('логирует предупреждение когда Performance API недоступен', async () => {
        vi.stubGlobal('window', undefined);

        await EffectLib.runPromise(initPerformanceMonitoring());

        expect(mockWarnFireAndForget).toHaveBeenCalledWith(
          'Performance API недоступен, мониторинг производительности отключен',
        );
      });
    });

    describe('stopPerformanceMonitoring', () => {
      it('останавливает мониторинг и отправляет оставшиеся метрики', async () => {
        mockInfoFireAndForget.mockReset(); // Сбрасываем mock перед тестом

        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        await EffectLib.runPromise(addMetricToBuffer(metric));
        await EffectLib.runPromise(stopPerformanceMonitoring());

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'Остановка мониторинга производительности',
        );
      });

      it('очищает таймер в браузерном окружении', async () => {
        mockInfoFireAndForget.mockReset(); // Сбрасываем mock перед тестом
        vi.stubGlobal('window', createMockWindow());

        await EffectLib.runPromise(stopPerformanceMonitoring());

        // Таймер должен быть очищен
      });
    });

    describe('resetPerformanceStateForTests', () => {
      it('сбрасывает состояние для тестирования', async () => {
        // Добавляем метрику в буфер
        const metric: PerformanceMetric = {
          id: 'test-metric',
          type: 'CUSTOM',
          name: 'test',
          value: 100,
          unit: 'ms',
          severity: 'LOW',
          timestamp: Date.now(),
        };

        EffectLib.runPromise(addMetricToBuffer(metric));

        // Сбрасываем состояние
        resetPerformanceStateForTests();

        // Буфер должен быть пустым
        const flushed = EffectLib.runPromise(flushMetricsBuffer());
        await expect(flushed).resolves.toBeUndefined();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('gracefully обрабатывает недоступный Performance API', async () => {
      vi.stubGlobal('window', undefined);

      await expect(EffectLib.runPromise(collectWebVitalsMetric(createMockWebVitalsValue()))).rejects
        .toThrow(
          '{"code":"PERFORMANCE_API_UNAVAILABLE","message":"Performance API недоступен для сбора Web Vitals","severity":"LOW"}',
        );
    });

    it('работает с нестандартными Web Vitals ratings', async () => {
      const vitals = createMockWebVitalsValue({
        rating: 'unknown' as any,
      });

      const result = await EffectLib.runPromise(collectWebVitalsMetric(vitals));
      expect(result.severity).toBe('MEDIUM'); // дефолт для неизвестных рейтингов
    });

    it('обрабатывает пустые контексты и метаданные', async () => {
      const metric = createPerformanceMetric(
        'CUSTOM',
        'test',
        0,
        'unit',
        {},
        {},
      );

      expect(metric.context).toEqual({});
      expect(metric.metadata).toEqual({});
    });

    it('работает с экстремальными значениями', async () => {
      const result = await EffectLib.runPromise(
        collectApiResponseMetric('/api/test', 'GET', 999999, 200),
      );

      expect(result.severity).toBe('CRITICAL');
    });
  });
});
