/**
 * @file AIServiceInstrumentation.ts
 *
 * Инструментирование AI-сервиса LivAiBot.
 *
 * Назначение:
 *  - Сбор ML-метрик (latency, tokens, success / failure)
 *  - Инструментирование inference операций
 *  - Интеграция с OpenTelemetry
 *  - Минимальное влияние на бизнес-логику
 *
 * Архитектурные принципы:
 *  - Observability ортогонально
 *  - Нет бизнес-логики внутри
 *  - Effect-first подход
 *  - Безопасные метрики по умолчанию
 *  - Vendor-agnostic telemetry
 */

import { Context, Effect, Layer } from 'effect';

import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';

import type { Tracer } from '@opentelemetry/api';

// ==================== КОНТЕКСТ ИНСТРУМЕНТИРОВАНИЯ ====================

/** Контекст OpenTelemetry tracer. */
export const aiServiceTracerContext = Context.GenericTag<Tracer>('AIServiceTracer');

// ==================== ДОМЕННЫЕ ТИПЫ ====================

/** Поддерживаемые AI провайдеры. */
export enum AIProvider {
  YANDEX = 'yandex',
  LOCAL = 'local',
  EXTERNAL = 'external',
  // OPENAI = 'openai', // Для будущего расширения
}

/** Атрибуты для метрик и спанов. */
export type AIMetricAttributes = Record<string, string | number | boolean | undefined> & {
  readonly model: string;
  readonly provider: string;
  readonly operation: string;
  readonly errorTag?: string;
  readonly retryCount?: number;
  readonly customErrorCode?: number;
  readonly gpuRequired?: boolean;
  readonly modelType?: string;
  readonly tokenCount?: number;
  readonly latencyMs?: number;
};

/** Контекст AI операции для инструментирования. */
export type AIInstrumentationContext = {
  readonly operation: 'inference' | 'embedding' | 'moderation';
  readonly model: string;
  readonly provider: AIProvider;
  readonly errorAttributes?: Omit<AIMetricAttributes, 'model' | 'provider' | 'operation'>;
};

/** Результат inference с ML-метаданными. */
export type AIInferenceResult<T = unknown> = {
  readonly output: T;
  readonly tokenUsage?: number;
};

// ==================== МЕТРИКИ ====================

/** Набор ML-метрик AI сервиса. */
type AIMetrics = {
  readonly inferenceTokens: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
  readonly inferenceErrors: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']>;
  readonly inferenceSuccess: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']>;
};

const meter = metrics.getMeter('livai.ai-service');

/** Инициализированные ML-метрики. */
const aiMetrics: AIMetrics = {
  inferenceTokens: meter.createHistogram(
    'ai_inference_tokens',
    {
      description: 'Использование токенов на AI inference',
      unit: 'tokens',
    },
  ),
  inferenceErrors: meter.createCounter(
    'ai_inference_errors_total',
    {
      description: 'Общее количество ошибок AI inference',
    },
  ),
  inferenceSuccess: meter.createCounter(
    'ai_inference_success_total',
    {
      description: 'Общее количество успешных AI inferences',
    },
  ),
};

// ==================== ОСНОВНАЯ ЛОГИКА ====================

/** Инструментирует AI inference эффект. */
export function instrumentAIInference<T, E, R>(
  context: AIInstrumentationContext,
  effect: Effect.Effect<AIInferenceResult<T>, E, R>,
): Effect.Effect<AIInferenceResult<T>, E, R> {
  return Effect.withSpan(
    effect.pipe(
      Effect.tap((result) => {
        // Business метрики: использование токенов и успешность
        // Latency измеряется автоматически OTEL span (derived signal, не side effect)

        const baseAttributes: AIMetricAttributes = {
          model: context.model,
          provider: context.provider,
          operation: context.operation,
        };

        if (result.tokenUsage != null && !isNaN(result.tokenUsage)) {
          aiMetrics.inferenceTokens.record(result.tokenUsage, baseAttributes);
        }

        aiMetrics.inferenceSuccess.add(1, baseAttributes);

        return Effect.succeed(undefined);
      }),
      Effect.tapError((error: unknown) => {
        // Метрики ошибок: частота сбоев с классификацией ошибок
        // Latency измеряется автоматически OTEL span (derived signal, не side effect)

        const baseAttributes: AIMetricAttributes = {
          model: context.model,
          provider: context.provider,
          operation: context.operation,
          errorTag: typeof error === 'object' && error !== null && '_tag' in error
            ? String((error as { _tag?: unknown; })._tag)
            : 'unknown',
        };

        aiMetrics.inferenceErrors.add(1, {
          ...baseAttributes,
          ...(context.errorAttributes ?? {}),
        });

        // Устанавливаем статус ERROR для span (OTEL стандарт)
        return Effect.sync(() => {
          const span = trace.getActiveSpan();
          if (span) {
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'AI inference failed' });
          }
        });
      }),
    ),
    `ai.${context.operation}`,
  );
}

// ==================== LAYER ====================

/** Создаёт слой OpenTelemetry tracer для AI сервиса. */
export const aiServiceInstrumentationLayer: Layer.Layer<
  never,
  never,
  Tracer
> = Layer.succeed(
  aiServiceTracerContext,
  trace.getTracer('livai.ai-service'),
);
