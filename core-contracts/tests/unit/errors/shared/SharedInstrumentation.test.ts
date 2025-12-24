/**
 * @file SharedInstrumentation.test.ts
 * Unit-тесты для SharedInstrumentation.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';
import type {
  LoggingStrategy,
  MetricsStrategy,
  SharedInstrumentationContext,
  TracingStrategy,
} from '../../../../src/errors/shared/SharedInstrumentation.js';
import {
  withLogging,
  withMetrics,
  withSharedInstrumentation,
  withTracing,
} from '../../../../src/errors/shared/SharedInstrumentation.js';

// Mock стратегии для тестирования
const mockTracingStrategy: TracingStrategy = {
  startSpan: vi.fn((name, effect) => effect as any),
};

const mockMetricsStrategy: MetricsStrategy = {
  record: vi.fn((name, effect) => effect as any),
};

const mockLoggingStrategy: LoggingStrategy = {
  log: vi.fn((message, effect) => effect as any),
};

const mockContext: SharedInstrumentationContext = {
  operation: 'testOperation',
  tags: { service: 'test', version: '1.0' },
};

describe('SharedInstrumentation', () => {
  describe('withSharedInstrumentation', () => {
    it('должен успешно выполнить effect без стратегий', async () => {
      const effect = Effect.succeed('success');
      const options = {};
      const context = mockContext;

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      expect(result).toBe('success');
    });

    it('должен применять tracing стратегию', async () => {
      const effect = Effect.succeed('traced');
      const options = { tracing: mockTracingStrategy };
      const context = mockContext;

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      expect(result).toBe('traced');
      expect(mockTracingStrategy.startSpan).toHaveBeenCalledWith(
        'testOperation',
        effect,
        context,
      );
    });

    it('должен применять metrics стратегию', async () => {
      const effect = Effect.succeed('measured');
      const options = { metrics: mockMetricsStrategy };
      const context = mockContext;

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      expect(result).toBe('measured');
      expect(mockMetricsStrategy.record).toHaveBeenCalledWith(
        'testOperation',
        effect,
        context,
      );
    });

    it('должен применять logging стратегию', async () => {
      const effect = Effect.succeed('logged');
      const options = { logging: mockLoggingStrategy };
      const context = mockContext;

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      expect(result).toBe('logged');
      expect(mockLoggingStrategy.log).toHaveBeenCalledWith(
        'testOperation',
        effect,
        context,
      );
    });

    it('должен применять все стратегии одновременно', async () => {
      const effect = Effect.succeed('fully instrumented');
      const options = {
        tracing: mockTracingStrategy,
        metrics: mockMetricsStrategy,
        logging: mockLoggingStrategy,
      };
      const context = mockContext;

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      expect(result).toBe('fully instrumented');

      // Проверяем, что все стратегии были вызваны
      expect(mockTracingStrategy.startSpan).toHaveBeenCalled();
      expect(mockMetricsStrategy.record).toHaveBeenCalled();
      expect(mockLoggingStrategy.log).toHaveBeenCalled();
    });

    it('должен корректно работать с пустым контекстом tags', async () => {
      const effect = Effect.succeed('no tags');
      const options = { tracing: mockTracingStrategy };
      const context: SharedInstrumentationContext = { operation: 'noTagsOp' };

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      expect(result).toBe('no tags');
      expect(mockTracingStrategy.startSpan).toHaveBeenCalledWith(
        'noTagsOp',
        effect,
        context,
      );
    });

    it('должен сохранять порядок применения стратегий', async () => {
      // Создаем стратегии, которые добавляют эффекты
      const tracingStrategy: TracingStrategy = {
        startSpan: (name, effect) => effect.pipe(Effect.map((x) => `${x}-traced`)) as any,
      };

      const metricsStrategy: MetricsStrategy = {
        record: (name, effect) => effect.pipe(Effect.map((x) => `${x}-measured`)) as any,
      };

      const loggingStrategy: LoggingStrategy = {
        log: (message, effect) => effect.pipe(Effect.map((x) => `${x}-logged`)) as any,
      };

      const effect = Effect.succeed('base');
      const options = {
        tracing: tracingStrategy,
        metrics: metricsStrategy,
        logging: loggingStrategy,
      };
      const context = mockContext;

      const result = await Effect.runPromise(
        withSharedInstrumentation(effect, options, context),
      );

      // Порядок применения: tracing -> metrics -> logging
      expect(result).toBe('base-traced-measured-logged');
    });
  });

  describe('withTracing', () => {
    it('должен применять только tracing стратегию', async () => {
      const effect = Effect.succeed('traced only');
      const context = mockContext;

      const result = await Effect.runPromise(
        withTracing(effect, mockTracingStrategy, context),
      );

      expect(result).toBe('traced only');
      expect(mockTracingStrategy.startSpan).toHaveBeenCalledWith(
        'testOperation',
        effect,
        context,
      );
    });
  });

  describe('withMetrics', () => {
    it('должен применять только metrics стратегию', async () => {
      const effect = Effect.succeed('measured only');
      const context = mockContext;

      const result = await Effect.runPromise(
        withMetrics(effect, mockMetricsStrategy, context),
      );

      expect(result).toBe('measured only');
      expect(mockMetricsStrategy.record).toHaveBeenCalledWith(
        'testOperation',
        effect,
        context,
      );
    });
  });

  describe('withLogging', () => {
    it('должен применять только logging стратегию', async () => {
      const effect = Effect.succeed('logged only');
      const context = mockContext;

      const result = await Effect.runPromise(
        withLogging(effect, mockLoggingStrategy, context),
      );

      expect(result).toBe('logged only');
      expect(mockLoggingStrategy.log).toHaveBeenCalledWith(
        'testOperation',
        effect,
        context,
      );
    });
  });

  describe('типизация и интерфейсы', () => {
    it('должен корректно типизировать SharedInstrumentationContext', () => {
      const context: SharedInstrumentationContext = {
        operation: 'test',
        tags: { key: 'value' },
      };

      expect(context.operation).toBe('test');
      expect(context.tags?.key).toBe('value');
    });

    it('должен поддерживать SharedInstrumentationContext без tags', () => {
      const context: SharedInstrumentationContext = {
        operation: 'minimal',
      };

      expect(context.operation).toBe('minimal');
      expect(context.tags).toBeUndefined();
    });

    it('должен корректно типизировать стратегии', () => {
      // Проверяем, что интерфейсы стратегий работают правильно
      const tracing: TracingStrategy = {
        startSpan: (name, effect) => effect,
      };

      const metrics: MetricsStrategy = {
        record: (name, effect) => effect,
      };

      const logging: LoggingStrategy = {
        log: (message, effect) => effect,
      };

      expect(typeof tracing.startSpan).toBe('function');
      expect(typeof metrics.record).toBe('function');
      expect(typeof logging.log).toBe('function');
    });
  });

  describe('интеграционные сценарии', () => {
    it('должен корректно работать в цепочке Effect операций', async () => {
      const complexEffect = Effect.gen(function*() {
        const step1 = yield* Effect.succeed('step1');
        const step2 = yield* Effect.succeed('step2');
        return `${step1}-${step2}`;
      });

      const instrumented = withSharedInstrumentation(
        complexEffect,
        {
          tracing: mockTracingStrategy,
          metrics: mockMetricsStrategy,
        },
        mockContext,
      );

      const result = await Effect.runPromise(instrumented);
      expect(result).toBe('step1-step2');

      expect(mockTracingStrategy.startSpan).toHaveBeenCalled();
      expect(mockMetricsStrategy.record).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки корректно', async () => {
      const failingEffect = Effect.fail('test error');
      const errorHandlingStrategy: TracingStrategy = {
        startSpan: (name, effect) =>
          effect.pipe(
            Effect.catchAll((error) => Effect.succeed(`handled: ${error}`)),
          ) as any,
      };

      const instrumented = withTracing(failingEffect, errorHandlingStrategy, mockContext);
      const result = await Effect.runPromise(instrumented);

      expect(result).toBe('handled: test error');
    });
  });
});
