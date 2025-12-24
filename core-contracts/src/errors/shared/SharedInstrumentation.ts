/**
 * @file SharedInstrumentation.ts
 *
 * Хелперы для мониторинга shared-операций:
 *  - tracing adapters
 *  - metrics policies
 *  - logging normalizers
 *
 * Принципы:
 *  - zero side-effects кроме observability
 *  - Strategy pattern для разных систем мониторинга
 *  - интеграция с Effect/OpenTelemetry
 */

import type { Effect } from 'effect';

/** Контекст для tracing и метрик */
export type SharedInstrumentationContext = {
  /** Имя операции, для метрик и логов */
  readonly operation: string;
  /** Дополнительные теги/labels для observability */
  readonly tags?: Record<string, string>;
};

/** Интерфейс strategy для tracing */
export type TracingStrategy = {
  startSpan<A>(
    name: string,
    effect: Effect.Effect<A, unknown>,
    context?: SharedInstrumentationContext
  ): Effect.Effect<A, unknown>;
};

/** Интерфейс strategy для metrics */
export type MetricsStrategy = {
  record<A>(
    metricName: string,
    effect: Effect.Effect<A, unknown>,
    context?: SharedInstrumentationContext
  ): Effect.Effect<A, unknown>;
};

/** Интерфейс strategy для логирования ошибок */
export type LoggingStrategy = {
  log<A>(
    message: string,
    effect: Effect.Effect<A, unknown>,
    context?: SharedInstrumentationContext
  ): Effect.Effect<A, unknown>;
};

/** Опции SharedInstrumentation */
export type SharedInstrumentationOptions = {
  tracing?: TracingStrategy;
  metrics?: MetricsStrategy;
  logging?: LoggingStrategy;
};

/**
 * Обертка shared-операции с наблюдаемостью
 * @example
 * const instrumented = withSharedInstrumentation(effect, {
 *   tracing: otelTracing,
 *   metrics: prometheusMetrics,
 *   logging: consoleLogging,
 * }, { operation: 'loadUser' });
 */
export function withSharedInstrumentation<A>(
  effect: Effect.Effect<A, unknown>,
  options: SharedInstrumentationOptions,
  context: SharedInstrumentationContext
): Effect.Effect<A, unknown> {
  let wrapped = effect;

  // tracing
  if (options.tracing) {
    wrapped = options.tracing.startSpan(context.operation, wrapped, context);
  }

  // metrics
  if (options.metrics) {
    wrapped = options.metrics.record(context.operation, wrapped, context);
  }

  // logging
  if (options.logging) {
    wrapped = options.logging.log(context.operation, wrapped, context);
  }

  return wrapped;
}

/** Shortcut: только tracing */
export function withTracing<A>(
  effect: Effect.Effect<A, unknown>,
  strategy: TracingStrategy,
  context: SharedInstrumentationContext
): Effect.Effect<A, unknown> {
  return strategy.startSpan(context.operation, effect, context);
}

/** Shortcut: только metrics */
export function withMetrics<A>(
  effect: Effect.Effect<A, unknown>,
  strategy: MetricsStrategy,
  context: SharedInstrumentationContext
): Effect.Effect<A, unknown> {
  return strategy.record(context.operation, effect, context);
}

/** Shortcut: только logging */
export function withLogging<A>(
  effect: Effect.Effect<A, unknown>,
  strategy: LoggingStrategy,
  context: SharedInstrumentationContext
): Effect.Effect<A, unknown> {
  return strategy.log(context.operation, effect, context);
}
