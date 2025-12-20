/**
 * @file ErrorMetrics.ts - Абстракция метрик системы для обработки ошибок LivAiBot
 *
 * Интерфейсы для метрик с helpers incrementErrorCounter(), observeLatency().
 * Абстракция над конкретными метриками системами для dependency injection.
 * Effect Context integration для decoupling от конкретных реализаций.
 */

// ==================== ИМПОРТЫ ====================

import { Context, Effect } from 'effect';

import type { ErrorSeverity } from './ErrorConstants.js';

// ==================== ТИПЫ МЕТРИК ====================

/** Базовый интерфейс метрик системы */
export type MetricsSystem = {
  /** Инкремент счетчика ошибок */
  readonly incrementCounter: (
    name: string,
    labels?: Record<string, string | number>,
  ) => Effect.Effect<void>;

  /** Наблюдение за длительностью операции */
  readonly observeLatency: (
    name: string,
    durationMs: number,
    labels?: Record<string, string | number>,
  ) => Effect.Effect<void>;

  /** Наблюдение за размером (например, количество элементов) */
  readonly observeSize: (
    name: string,
    size: number,
    labels?: Record<string, string | number>,
  ) => Effect.Effect<void>;
};

/** Tag для MetricsSystem в Effect Context */
export class MetricsSystemTag extends Context.Tag('MetricsSystem')<
  MetricsSystemTag,
  MetricsSystem
>() {}

/** Type helper для работы с MetricsSystem в Effect */
export type MetricsSystemEffect<A, E = never> = Effect.Effect<A, E, MetricsSystem>;

/** Конфигурация метрики */
export type MetricConfig = {
  readonly name: string;
  readonly help?: string;
  readonly labels?: Record<string, string>;
};

/** Имена метрик для консистентности */
export const METRIC_NAMES = {
  ERROR_TOTAL: 'livai_error_total',
  OP_DURATION: 'livai_error_operation_duration',
  CHAIN_SIZE: 'livai_error_chain_size',
} as const;

// ==================== HELPER ФУНКЦИИ ====================

/**
 * Инкремент счетчика ошибок с автоматическим определением типа ошибки
 * Использует MetricsSystem из Effect Context для dependency injection
 */
export function incrementErrorCounter(
  errorType: string,
  severity: ErrorSeverity = 'medium',
  additionalLabels?: Record<string, string | number>,
): Effect.Effect<void, never, MetricsSystemTag> {
  return Effect.flatMap(MetricsSystemTag, (metrics) =>
    metrics.incrementCounter(
      METRIC_NAMES.ERROR_TOTAL,
      {
        error_type: errorType,
        severity,
        ...additionalLabels,
      },
    ));
}

/**
 * Наблюдение за длительностью операции обработки ошибок
 * Измеряет время выполнения error handling операций
 */
export function observeLatency(
  operation: string,
  durationMs: number,
  additionalLabels?: Record<string, string | number>,
): Effect.Effect<void, never, MetricsSystemTag> {
  return Effect.flatMap(MetricsSystemTag, (metrics) =>
    metrics.observeLatency(
      METRIC_NAMES.OP_DURATION,
      durationMs,
      {
        operation,
        ...additionalLabels,
      },
    ));
}

/**
 * Наблюдение за размером цепочки ошибок или количеством ошибок
 */
export function observeErrorChainSize(
  chainLength: number,
  additionalLabels?: Record<string, string | number>,
): Effect.Effect<void, never, MetricsSystemTag> {
  return Effect.flatMap(MetricsSystemTag, (metrics) =>
    metrics.observeSize(
      METRIC_NAMES.CHAIN_SIZE,
      chainLength,
      additionalLabels,
    ));
}

// ==================== УТИЛИТЫ МЕТРИК ====================

/**
 * Обертка для операций с автоматическим измерением latency
 * Измеряет время выполнения error handling операций
 */
export function withLatencyMetrics<T, E>(
  operationName: string,
  effect: Effect.Effect<T, E>,
  additionalLabels?: Record<string, string | number>,
): Effect.Effect<T, E, MetricsSystemTag> {
  return Effect.sync(() => Date.now()).pipe(
    Effect.flatMap((startTime) =>
      effect.pipe(
        Effect.flatMap((result) => {
          const duration = Date.now() - startTime;
          return observeLatency(operationName, duration, { success: 'true', ...additionalLabels })
            .pipe(
              Effect.map(() => result),
            );
        }),
        Effect.catchAll((error) => {
          const duration = Date.now() - startTime;
          return observeLatency(operationName, duration, { success: 'false', ...additionalLabels })
            .pipe(
              Effect.flatMap(() =>
                incrementErrorCounter('operation_failed', 'high', { operation: operationName })
              ),
              Effect.flatMap(() => Effect.fail(error)),
            );
        }),
      )
    ),
  );
}

/**
 * Обертка для операций с подсчетом ошибок
 * Автоматически инкрементит счетчики при ошибках
 */
export function withErrorMetrics<T, E>(
  operationName: string,
  effect: Effect.Effect<T, E>,
  additionalLabels?: Record<string, string | number>,
): Effect.Effect<T, E, MetricsSystemTag> {
  return effect.pipe(
    Effect.catchAll((error) =>
      incrementErrorCounter(operationName, 'high', additionalLabels).pipe(
        Effect.flatMap(() => Effect.fail(error)),
      )
    ),
  );
}

/**
 * Агрегация метрик для цепочки ошибок
 * Собирает статистику по именам ошибок в цепочке
 */
export function collectErrorChainMetrics(
  errorNames: readonly string[],
  chainLength: number,
  operationName: string,
  additionalLabels?: Record<string, string | number>,
): Effect.Effect<void, never, MetricsSystemTag> {
  return observeErrorChainSize(chainLength, { operation: operationName, ...additionalLabels }).pipe(
    Effect.flatMap(() => {
      // Метрики по типам ошибок в цепочке
      const errorMetrics = errorNames.map((errorName) =>
        incrementErrorCounter(
          errorName,
          'medium',
          { operation: operationName, in_chain: 'true', ...additionalLabels },
        )
      );

      return Effect.all(errorMetrics, { concurrency: 'unbounded' }).pipe(
        Effect.map(() => undefined),
      );
    }),
  );
}

// ==================== DEFAULT РЕАЛИЗАЦИИ ====================

/**
 * Console-based metrics для development
 * Выводит метрики в console для debugging
 */
export const makeConsoleMetrics = Effect.succeed<MetricsSystem>({
  incrementCounter: (name, labels) =>
    Effect.sync(() => {
      console.info(`📊 METRIC: ${name}`, labels);
    }),

  observeLatency: (name, durationMs, labels) =>
    Effect.sync(() => {
      console.info(`⏱️ LATENCY: ${name} = ${durationMs}ms`, labels);
    }),

  observeSize: (name, size, labels) =>
    Effect.sync(() => {
      console.info(`📏 SIZE: ${name} = ${size}`, labels);
    }),
});

/**
 * No-op metrics для production без метрик
 * Полностью отключает сбор метрик
 */
export const makeDisabledMetrics = Effect.succeed<MetricsSystem>({
  incrementCounter: () => Effect.void,
  observeLatency: () => Effect.void,
  observeSize: () => Effect.void,
});

/**
 * Fallback metrics - алиас для console реализации
 * Используется когда основная система метрик недоступна
 */
export const makeFallbackMetrics = makeConsoleMetrics;
