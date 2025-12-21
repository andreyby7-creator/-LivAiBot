import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  collectErrorChainMetrics,
  // Core functions
  incrementErrorCounter,
  // Implementations
  makeConsoleMetrics,
  makeDisabledMetrics,
  makeFallbackMetrics,
  METRIC_NAMES,
  // Types and interfaces

  // Tags and constants
  MetricsSystemTag,
  observeErrorChainSize,
  observeLatency,
  withErrorMetrics,
  // Utility functions
  withLatencyMetrics,
} from '../../../../src/errors/base/ErrorMetrics';
import type {
  MetricConfig,
  MetricsSystem,
  MetricsSystemEffect,
} from '../../../../src/errors/base/ErrorMetrics';

// ==================== МOCKS AND HELPERS ====================

function createMockMetricsSystem(overrides?: Partial<MetricsSystem>): MetricsSystem {
  return {
    incrementCounter: vi.fn().mockReturnValue(Effect.void),
    observeLatency: vi.fn().mockReturnValue(Effect.void),
    observeSize: vi.fn().mockReturnValue(Effect.void),
    ...overrides,
  };
}

function createMockMetricsEffect(
  overrides?: Partial<MetricsSystem>,
): Effect.Effect<MetricsSystem, never, never> {
  return Effect.succeed(createMockMetricsSystem(overrides));
}

// ==================== TESTS ====================

describe('ErrorMetrics - Complete Metrics System Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Типы и интерфейсы (ErrorMetrics Types)', () => {
    describe('MetricsSystem interface', () => {
      it('должен поддерживать все методы интерфейса MetricsSystem', () => {
        const metrics: MetricsSystem = {
          incrementCounter: (name, labels) => Effect.succeed(undefined),
          observeLatency: (name, duration, labels) => Effect.succeed(undefined),
          observeSize: (name, size, labels) => Effect.succeed(undefined),
        };

        expect(typeof metrics.incrementCounter).toBe('function');
        expect(typeof metrics.observeLatency).toBe('function');
        expect(typeof metrics.observeSize).toBe('function');
      });
    });

    describe('MetricsSystemTag', () => {
      it('должен быть Context Tag для MetricsSystem', () => {
        expect(MetricsSystemTag.key).toBe('MetricsSystem');
        expect(typeof MetricsSystemTag).toBe('function');
      });
    });

    describe('MetricsSystemEffect type', () => {
      it('должен поддерживать Effect с MetricsSystem в контексте', () => {
        // Test that the type compiles correctly
        const effect: MetricsSystemEffect<number> = Effect.succeed(42);

        // Verify the type signature
        expect(typeof effect).toBe('object');
      });
    });

    describe('MetricConfig type', () => {
      it('должен поддерживать конфигурацию метрики', () => {
        const config: MetricConfig = {
          name: 'test_metric',
          help: 'Test metric description',
          labels: { service: 'test' },
        };

        expect(config.name).toBe('test_metric');
        expect(config.help).toBe('Test metric description');
        expect(config.labels?.service).toBe('test');
      });
    });

    describe('METRIC_NAMES константы', () => {
      it('должен содержать все необходимые имена метрик', () => {
        expect(METRIC_NAMES.ERROR_TOTAL).toBe('livai_error_total');
        expect(METRIC_NAMES.OP_DURATION).toBe('livai_error_operation_duration');
        expect(METRIC_NAMES.CHAIN_SIZE).toBe('livai_error_chain_size');
      });
    });
  });

  describe('Основные функции (Core Functions)', () => {
    describe('incrementErrorCounter', () => {
      it('должен инкрементить счетчик ошибок с базовыми параметрами', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

        const result = await Effect.runPromise(
          incrementErrorCounter('test_error').pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(result).toBeUndefined();
        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          { error_type: 'test_error', severity: 'medium' },
        );
      });

      it('должен инкрементить счетчик с кастомной severity', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

        await Effect.runPromise(
          incrementErrorCounter('validation_error', 'high').pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          { error_type: 'validation_error', severity: 'high' },
        );
      });

      it('должен инкрементить счетчик с дополнительными labels', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

        await Effect.runPromise(
          incrementErrorCounter('network_error', 'critical', { service: 'api', user_id: 123 }).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          {
            error_type: 'network_error',
            severity: 'critical',
            service: 'api',
            user_id: 123,
          },
        );
      });
    });

    describe('observeLatency', () => {
      it('должен наблюдать за длительностью операции', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

        await Effect.runPromise(
          observeLatency('transform_operation', 150).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.OP_DURATION,
          150,
          { operation: 'transform_operation' },
        );
      });

      it('должен наблюдать за длительностью с дополнительными labels', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

        await Effect.runPromise(
          observeLatency('validation', 75, { input_size: 100, output_size: 95 }).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.OP_DURATION,
          75,
          { operation: 'validation', input_size: 100, output_size: 95 },
        );
      });
    });

    describe('observeErrorChainSize', () => {
      it('должен наблюдать за размером цепочки ошибок', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ observeSize: mockObserve });

        await Effect.runPromise(
          observeErrorChainSize(5).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockObserve).toHaveBeenCalledWith(METRIC_NAMES.CHAIN_SIZE, 5, undefined);
      });

      it('должен наблюдать за размером с дополнительными labels', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ observeSize: mockObserve });

        await Effect.runPromise(
          observeErrorChainSize(10, { operation: 'aggregation', severity: 'high' }).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.CHAIN_SIZE,
          10,
          { operation: 'aggregation', severity: 'high' },
        );
      });
    });
  });

  describe('Утилиты метрик (Metrics Utilities)', () => {
    describe('withLatencyMetrics', () => {
      it('должен измерять latency успешной операции', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

        const operation = Effect.succeed('operation_result');

        const result = await Effect.runPromise(
          withLatencyMetrics('test_operation', operation).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(result).toBe('operation_result');
        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.OP_DURATION,
          expect.any(Number), // duration
          { operation: 'test_operation', success: 'true' },
        );
      });

      it('должен измерять latency неудачной операции', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({
          observeLatency: mockObserve,
          incrementCounter: mockIncrement,
        });

        const failingOperation = Effect.fail(new Error('Operation failed'));

        const result = await Effect.runPromiseExit(
          withLatencyMetrics('failing_operation', failingOperation).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(result._tag).toBe('Failure');
        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.OP_DURATION,
          expect.any(Number),
          { operation: 'failing_operation', success: 'false' },
        );
        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          { error_type: 'operation_failed', severity: 'high', operation: 'failing_operation' },
        );
      });

      it('должен работать с дополнительными labels', async () => {
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

        const operation = Effect.succeed('result');

        await Effect.runPromise(
          withLatencyMetrics('custom_operation', operation, { user_id: 456, feature: 'beta' }).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.OP_DURATION,
          expect.any(Number),
          { operation: 'custom_operation', success: 'true', user_id: 456, feature: 'beta' },
        );
      });
    });

    describe('withErrorMetrics', () => {
      it('должен пропускать успешные операции без метрик', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

        const operation = Effect.succeed('success_result');

        const result = await Effect.runPromise(
          withErrorMetrics('test_operation', operation).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(result).toBe('success_result');
        expect(mockIncrement).not.toHaveBeenCalled();
      });

      it('должен инкрементить счетчик при ошибке операции', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

        const failingOperation = Effect.fail(new Error('Test error'));

        const result = await Effect.runPromiseExit(
          withErrorMetrics('error_operation', failingOperation).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(result._tag).toBe('Failure');
        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          { error_type: 'error_operation', severity: 'high' },
        );
      });

      it('должен работать с дополнительными labels при ошибке', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

        const failingOperation = Effect.fail(new Error('Test error'));

        await Effect.runPromiseExit(
          withErrorMetrics('error_operation', failingOperation, { service: 'auth', attempt: 3 })
            .pipe(
              Effect.provideService(MetricsSystemTag, mockMetrics),
            ),
        );

        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          { error_type: 'error_operation', severity: 'high', service: 'auth', attempt: 3 },
        );
      });
    });

    describe('collectErrorChainMetrics', () => {
      it('должен собирать метрики для цепочки ошибок', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({
          incrementCounter: mockIncrement,
          observeSize: mockObserve,
        });

        const errorNames = ['validation_error', 'network_error', 'database_error'];
        const chainLength = 3;

        await Effect.runPromise(
          collectErrorChainMetrics(errorNames, chainLength, 'chain_processing').pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        // Проверяем метрику размера цепочки
        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.CHAIN_SIZE,
          chainLength,
          { operation: 'chain_processing' },
        );

        // Проверяем метрики для каждого типа ошибки
        expect(mockIncrement).toHaveBeenCalledTimes(3);
        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          {
            error_type: 'validation_error',
            severity: 'medium',
            operation: 'chain_processing',
            in_chain: 'true',
          },
        );
        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          {
            error_type: 'network_error',
            severity: 'medium',
            operation: 'chain_processing',
            in_chain: 'true',
          },
        );
        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          {
            error_type: 'database_error',
            severity: 'medium',
            operation: 'chain_processing',
            in_chain: 'true',
          },
        );
      });

      it('должен работать с дополнительными labels', async () => {
        const mockIncrement = vi.fn().mockReturnValue(Effect.void);
        const mockObserve = vi.fn().mockReturnValue(Effect.void);
        const mockMetrics = createMockMetricsSystem({
          incrementCounter: mockIncrement,
          observeSize: mockObserve,
        });

        await Effect.runPromise(
          collectErrorChainMetrics(['single_error'], 1, 'test_op', { batch_id: 'abc123' }).pipe(
            Effect.provideService(MetricsSystemTag, mockMetrics),
          ),
        );

        expect(mockObserve).toHaveBeenCalledWith(
          METRIC_NAMES.CHAIN_SIZE,
          1,
          { operation: 'test_op', batch_id: 'abc123' },
        );

        expect(mockIncrement).toHaveBeenCalledWith(
          METRIC_NAMES.ERROR_TOTAL,
          {
            error_type: 'single_error',
            severity: 'medium',
            operation: 'test_op',
            in_chain: 'true',
            batch_id: 'abc123',
          },
        );
      });
    });
  });

  describe('Реализации метрик (Metrics Implementations)', () => {
    describe('makeConsoleMetrics', () => {
      it('должен создавать console-based систему метрик', async () => {
        const metrics = await Effect.runPromise(makeConsoleMetrics);

        expect(metrics).toHaveProperty('incrementCounter');
        expect(metrics).toHaveProperty('observeLatency');
        expect(metrics).toHaveProperty('observeSize');
        expect(typeof metrics.incrementCounter).toBe('function');
        expect(typeof metrics.observeLatency).toBe('function');
        expect(typeof metrics.observeSize).toBe('function');
      });

      it('должен выводить метрики в console', async () => {
        const metrics = await Effect.runPromise(makeConsoleMetrics);

        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        await Effect.runPromise(metrics.incrementCounter('test_counter', { key: 'value' }));
        await Effect.runPromise(metrics.observeLatency('test_latency', 42, { operation: 'test' }));
        await Effect.runPromise(metrics.observeSize('test_size', 100, { type: 'array' }));

        expect(consoleSpy).toHaveBeenCalledTimes(3);
        expect(consoleSpy).toHaveBeenCalledWith('📊 METRIC: test_counter', { key: 'value' });
        expect(consoleSpy).toHaveBeenCalledWith('⏱️ LATENCY: test_latency = 42ms', {
          operation: 'test',
        });
        expect(consoleSpy).toHaveBeenCalledWith('📏 SIZE: test_size = 100', { type: 'array' });

        consoleSpy.mockRestore();
      });
    });

    describe('makeDisabledMetrics', () => {
      it('должен создавать no-op систему метрик', async () => {
        const metrics = await Effect.runPromise(makeDisabledMetrics);

        expect(metrics).toHaveProperty('incrementCounter');
        expect(metrics).toHaveProperty('observeLatency');
        expect(metrics).toHaveProperty('observeSize');

        // Все методы должны возвращать Effect.void
        await Effect.runPromise(metrics.incrementCounter('test'));
        await Effect.runPromise(metrics.observeLatency('test', 0));
        await Effect.runPromise(metrics.observeSize('test', 0));
      });
    });

    describe('makeFallbackMetrics', () => {
      it('должен быть алиасом для makeConsoleMetrics', () => {
        expect(makeFallbackMetrics).toBe(makeConsoleMetrics);
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('комплексный workflow с метриками', async () => {
      const mockIncrement = vi.fn().mockReturnValue(Effect.void);
      const mockObserveLatency = vi.fn().mockReturnValue(Effect.void);
      const mockObserveSize = vi.fn().mockReturnValue(Effect.void);

      const mockMetrics = createMockMetricsSystem({
        incrementCounter: mockIncrement,
        observeLatency: mockObserveLatency,
        observeSize: mockObserveSize,
      });

      // 1. Инкремент счетчика ошибок
      await Effect.runPromise(
        incrementErrorCounter('workflow_error', 'high', { step: 'validation' }).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      // 2. Измерение latency операции
      await Effect.runPromise(
        observeLatency('workflow_step', 250, { step: 'processing' }).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      // 3. Наблюдение размера цепочки
      await Effect.runPromise(
        observeErrorChainSize(3, { workflow: 'error_processing' }).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      // 4. Сбор метрик цепочки ошибок
      await Effect.runPromise(
        collectErrorChainMetrics(['error1', 'error2'], 2, 'workflow').pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      // Проверки вызовов
      expect(mockIncrement).toHaveBeenCalledWith(
        METRIC_NAMES.ERROR_TOTAL,
        { error_type: 'workflow_error', severity: 'high', step: 'validation' },
      );
      expect(mockObserveLatency).toHaveBeenCalledWith(
        METRIC_NAMES.OP_DURATION,
        250,
        { operation: 'workflow_step', step: 'processing' },
      );
      expect(mockObserveSize).toHaveBeenCalledWith(
        METRIC_NAMES.CHAIN_SIZE,
        3,
        { workflow: 'error_processing' },
      );
      expect(mockObserveSize).toHaveBeenCalledWith(
        METRIC_NAMES.CHAIN_SIZE,
        2,
        { operation: 'workflow' },
      );
    });

    it('withLatencyMetrics должен корректно измерять время', async () => {
      const mockObserve = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

      // Операция, которая занимает некоторое время
      const operation = Effect.async<string>((resume) => {
        setTimeout(() => resume(Effect.succeed('delayed_result')), 10);
      });

      const result = await Effect.runPromise(
        withLatencyMetrics('delayed_operation', operation).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(result).toBe('delayed_result');
      expect(mockObserve).toHaveBeenCalledWith(
        METRIC_NAMES.OP_DURATION,
        expect.any(Number),
        { operation: 'delayed_operation', success: 'true' },
      );

      const call = mockObserve.mock.calls[0];
      const duration = call[1] as number;
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('метрики должны корректно работать с различными типами labels', async () => {
      const mockIncrement = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

      await Effect.runPromise(
        incrementErrorCounter('mixed_labels', 'low', {
          string_label: 'test',
          number_label: 42,
          boolean_label: 'true', // boolean не поддерживается в labels
        }).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(mockIncrement).toHaveBeenCalledWith(
        METRIC_NAMES.ERROR_TOTAL,
        {
          error_type: 'mixed_labels',
          severity: 'low',
          string_label: 'test',
          number_label: 42,
          boolean_label: 'true',
        },
      );
    });
  });

  describe('Граничные случаи и edge cases', () => {
    it('incrementErrorCounter должен работать без дополнительных labels', async () => {
      const mockIncrement = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ incrementCounter: mockIncrement });

      await Effect.runPromise(
        incrementErrorCounter('simple_error').pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(mockIncrement).toHaveBeenCalledWith(
        METRIC_NAMES.ERROR_TOTAL,
        { error_type: 'simple_error', severity: 'medium' },
      );
    });

    it('observeLatency должен работать с нулевой длительностью', async () => {
      const mockObserve = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

      await Effect.runPromise(
        observeLatency('instant_operation', 0).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(mockObserve).toHaveBeenCalledWith(
        METRIC_NAMES.OP_DURATION,
        0,
        { operation: 'instant_operation' },
      );
    });

    it('observeErrorChainSize должен работать с нулевым размером', async () => {
      const mockObserve = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ observeSize: mockObserve });

      await Effect.runPromise(
        observeErrorChainSize(0).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(mockObserve).toHaveBeenCalledWith(METRIC_NAMES.CHAIN_SIZE, 0, undefined);
    });

    it('collectErrorChainMetrics должен работать с пустой цепочкой', async () => {
      const mockObserve = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ observeSize: mockObserve });

      await Effect.runPromise(
        collectErrorChainMetrics([], 0, 'empty_chain').pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(mockObserve).toHaveBeenCalledWith(
        METRIC_NAMES.CHAIN_SIZE,
        0,
        { operation: 'empty_chain' },
      );
    });

    it('withLatencyMetrics должен корректно обрабатывать очень быстрые операции', async () => {
      const mockObserve = vi.fn().mockReturnValue(Effect.void);
      const mockMetrics = createMockMetricsSystem({ observeLatency: mockObserve });

      const result = await Effect.runPromise(
        withLatencyMetrics('instant', Effect.succeed('result')).pipe(
          Effect.provideService(MetricsSystemTag, mockMetrics),
        ),
      );

      expect(result).toBe('result');
      const call = mockObserve.mock.calls[0];
      const duration = call[1] as number;
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});
