/**
 * @file ErrorInstrumentation.ts - Абстрактные интерфейсы для observability LivAiBot
 *
 * Интерфейсы для instrumentation: logError(), sendToTelemetry(), mapErrorToSeverityMetric().
 * Strategy паттерн для разных observability систем (console, Winston, OpenTelemetry).
 * Effect Context integration для decoupling от конкретных реализаций.
 */

// ==================== ИМПОРТЫ ====================

import { Context, Effect } from 'effect';

// ==================== ТИПЫ INSTRUMENTATION ====================

/** Уровни severity для ошибок */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Типы telemetry событий */
export type TelemetryEvent = 'error_occurred' | 'error_handled' | 'error_escalated';

/** Базовый интерфейс instrumentation системы */
export type InstrumentationSystem = {
  /** Логирование ошибки с контекстом */
  readonly logError: (
    error: unknown,
    context?: Record<string, unknown>,
  ) => Effect.Effect<void>;

  /** Отправка telemetry события */
  readonly sendTelemetry: (
    event: TelemetryEvent,
    properties?: Record<string, unknown>,
  ) => Effect.Effect<void>;

  /** Маппинг ошибки к severity метрике (pure function) */
  readonly mapErrorToSeverity: (
    error: unknown,
  ) => ErrorSeverity;
};

/** Tag для InstrumentationSystem в Effect Context */
export class InstrumentationSystemTag extends Context.Tag('InstrumentationSystem')<
  InstrumentationSystemTag,
  InstrumentationSystem
>() {}

/** Type helper для работы с InstrumentationSystem в Effect */
export type InstrumentationEffect<A, E = never> = Effect.Effect<A, E, InstrumentationSystem>;

// ==================== HELPER ФУНКЦИИ ====================

/**
 * Логирование ошибки с автоматическим получением системы instrumentation
 * Использует InstrumentationSystem из Effect Context для dependency injection
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): Effect.Effect<void, never, InstrumentationSystemTag> {
  return Effect.flatMap(
    InstrumentationSystemTag,
    (instrumentation) => instrumentation.logError(error, context),
  );
}

/**
 * Отправка telemetry события с автоматическим получением системы instrumentation
 * Использует InstrumentationSystem из Effect Context для dependency injection
 */
export function sendTelemetry(
  event: TelemetryEvent,
  properties?: Record<string, unknown>,
): Effect.Effect<void, never, InstrumentationSystemTag> {
  return Effect.flatMap(
    InstrumentationSystemTag,
    (instrumentation) => instrumentation.sendTelemetry(event, properties),
  );
}

/**
 * Маппинг ошибки к severity с автоматическим получением системы instrumentation
 * Использует InstrumentationSystem из Effect Context для dependency injection
 */
export function mapErrorToSeverity(
  error: unknown,
): Effect.Effect<ErrorSeverity, never, InstrumentationSystemTag> {
  return Effect.map(
    InstrumentationSystemTag,
    (instrumentation) => instrumentation.mapErrorToSeverity(error),
  );
}

// ==================== STRATEGY РЕАЛИЗАЦИИ ====================

/**
 * Strategy паттерн: Console-based instrumentation для development
 * Выводит логи в console для debugging
 */
export const makeConsoleInstrumentation = Effect.succeed<InstrumentationSystem>({
  logError: (error, context) =>
    Effect.sync(() => {
      console.error('🚨 ERROR LOG:', error, context);
    }),

  sendTelemetry: (event, properties) =>
    Effect.sync(() => {
      console.info('📡 TELEMETRY:', event, properties);
    }),

  mapErrorToSeverity: (error) => {
    // Простая логика severity на основе типа ошибки
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('critical') || message.includes('fatal')) {
        return 'critical';
      }
      if (message.includes('high') || message.includes('severe')) {
        return 'high';
      }
      if (message.includes('medium') || message.includes('warning')) {
        return 'medium';
      }
    }
    return 'low';
  },
});

/**
 * Strategy паттерн: No-op instrumentation для production без observability
 * Полностью отключает сбор instrumentation данных
 */
export const makeDisabledInstrumentation = Effect.succeed<InstrumentationSystem>({
  logError: () => Effect.void,
  sendTelemetry: () => Effect.void,
  mapErrorToSeverity: () => 'low',
});

/**
 * Strategy паттерн: Winston-based instrumentation
 * Использует Winston для enterprise-grade логирования
 */
export const makeWinstonInstrumentation = Effect.succeed<InstrumentationSystem>({
  logError: (error, context) =>
    Effect.sync(() => {
      // В реальном проекте здесь будет интеграция с Winston
      console.error('📝 WINSTON LOG:', error, context);
    }),

  sendTelemetry: (event, properties) =>
    Effect.sync(() => {
      // В реальном проекте здесь будет отправка в telemetry систему
      console.info('📊 WINSTON TELEMETRY:', event, properties);
    }),

  mapErrorToSeverity: (error) => {
    // Более сложная логика severity с Winston интеграцией
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('database') || message.includes('connection')) {
        return 'critical';
      }
      if (message.includes('validation') || message.includes('auth')) {
        return 'high';
      }
      if (message.includes('timeout') || message.includes('retry')) {
        return 'medium';
      }
    }
    return 'low';
  },
});

/**
 * Strategy паттерн: OpenTelemetry-based instrumentation
 * Использует OpenTelemetry для distributed tracing и метрик
 */
export const makeOpenTelemetryInstrumentation = Effect.succeed<InstrumentationSystem>({
  logError: (error, context) =>
    Effect.sync(() => {
      // В реальном проекте здесь будет OpenTelemetry tracing
      console.error('🔍 OTEL LOG:', error, context);
    }),

  sendTelemetry: (event, properties) =>
    Effect.sync(() => {
      // В реальном проекте здесь будет OpenTelemetry metrics
      console.info('📈 OTEL TELEMETRY:', event, properties);
    }),

  mapErrorToSeverity: (error) => {
    // OpenTelemetry severity mapping
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('panic') || message.includes('unrecoverable')) {
        return 'critical';
      }
      if (message.includes('error') || message.includes('exception')) {
        return 'high';
      }
      if (message.includes('warn') || message.includes('degraded')) {
        return 'medium';
      }
    }
    return 'low';
  },
});

/**
 * Fallback instrumentation - алиас для console реализации
 * Используется когда основная система instrumentation недоступна
 */
export const makeFallbackInstrumentation = makeConsoleInstrumentation;
