/**
 * @file BillingServiceInstrumentation.ts - Наблюдаемость для LivAiBot Billing Service
 *
 * Инструментирование платежных операций с метриками success/failure/latency,
 * fraud flags и provider tagging.
 *
 * Архитектурные принципы: Instrumentation MUST NOT fail business flow,
 * Effect-first/Layer-first подход, vendor-agnostic, PCI-safe, orthogonal к бизнес-логике.
 *
 * Ключевые возможности: success/failure tracking, latency measurement с SLA monitoring,
 * fraud risk alerting, provider-specific error analysis, multi-region observability.
 *
 * ГРАНИЦЫ ОТВЕТСТВЕННОСТИ - ЧТО ФАЙЛ НЕ ДЕЛАЕТ:
 *  ❌ НЕ вычисляет fraud decision - только читает результат из FraudDecision
 *  ❌ НЕ влияет на retry логику - только логирует retry context
 *  ❌ НЕ принимает business решения - только наблюдает и метрит
 *  ❌ НЕ влияет на money flow - только side-effect metrics
 *  ❌ НЕ содержит business rules - чистая observability
 *  ❌ НЕ влияет на business result (T/E) - referentially transparent
 *  ❌ НЕ гарантирует delivery метрик - best-effort observability
 */

import { Clock, Context, Effect, Layer } from 'effect';

import { SpanStatusCode } from '@opentelemetry/api';

import { detectPCISensitiveFields } from '../../shared/security.js';

import {
  createInfrastructureUnknownError,
  isBillingServiceError,
} from './BillingServiceErrorTypes.js';
import { BILLING_OPERATIONS } from './domain/index.js';
import { calculateMonitoringAttributes } from './policies/index.js';

import type { BillingServiceError } from './BillingServiceErrorTypes.js';
import type { BillingOperation, CurrencyCode } from './domain/index.js';
import type { Meter, Tracer } from '@opentelemetry/api';

// ==================== SERVICE CONFIGURATION ====================

/** Конфигурация billing service - immutable на lifecycle процесса */
export type BillingServiceConfig = {
  /** Версия сервиса для метрик и трассировки - immutable */
  readonly version: string;
  /** Включает PCI compliance checks в метриках - отключайте в production для performance */
  readonly enablePCIChecks: boolean;
};

/** Context для конфигурации billing service */
export const billingServiceConfigTag = Context.GenericTag<BillingServiceConfig>(
  'BillingServiceConfig',
);

/** Фабрика для создания конфигурации из environment */
export const makeBillingServiceConfig = (
  env: Record<string, string | undefined> = process.env,
): BillingServiceConfig => ({
  version: env['BILLING_SERVICE_VERSION'] ?? '1.0.0',
  enablePCIChecks: env['BILLING_ENABLE_PCI_CHECKS'] !== 'false', // Включено по умолчанию, отключайте в production для performance
});

// ==================== ДОМЕННЫЕ ТИПЫ ====================

/** Поддерживаемые платежные провайдеры */
export type BillingProvider = 'webpay' | 'bepaid' | 'generic';

/**
 * Константы провайдеров для type safety
 * GENERIC - service-level fallback, не реальный платежный провайдер
 * ⚠️  GENERIC никогда не должен приходить снаружи, только используется внутри сервиса
 */
export const BILLING_PROVIDERS = {
  WEBPAY: 'webpay',
  BEPAID: 'bepaid',
  GENERIC: 'generic', // Service-level fallback, не реальный провайдер
} satisfies Record<string, BillingProvider>;

/**
 * Fraud risk уровни - observability-level abstraction, не бизнес-домен
 * Используется только для метрик и мониторинга, не влияет на бизнес-логику
 */
export type FraudRisk = 'low' | 'medium' | 'high';

/** Результат операции для метрик */
export type OperationResult = 'success' | 'failure';

/**
 * PCI-safe атрибуты метрик с low-cardinality полями
 * Явный объект вместо Record для предотвращения high-cardinality полей
 *
 * ⚠️  ВАЖНО: Все поля должны оставаться PCI-safe и low-cardinality!
 *    Никаких errorMessage, userId, transactionDetails и т.п.
 *    Runtime PCI check предотвратит отправку чувствительных данных,
 *    но лучше предотвратить добавление таких полей на этапе разработки.
 */
export type BillingMetricAttributes = {
  readonly provider: BillingProvider;
  readonly operation: BillingOperation;
  readonly currency: CurrencyCode; // Брендированный тип вместо string
  readonly result: OperationResult;
  readonly fraudRisk?: FraudRisk | undefined; // undefined для неизвестных fraud состояний
  readonly errorClass?: 'domain' | 'infrastructure' | 'provider' | 'fraud' | undefined; // Low-cardinality enum
  readonly errorTag?: BillingServiceError['_tag']; // Type-safe: только _tag из TaggedError
  readonly severity?: 'low' | 'medium' | 'high' | 'critical'; // Derived-only: вычисляется из error metadata
  readonly businessImpact?: 'low' | 'medium' | 'high'; // Derived-only: вычисляется из error metadata
};

/** Контекст инструментирования (input) */
export type BillingInstrumentationContext = {
  readonly operation: BillingOperation;
  readonly provider: BillingProvider;
  readonly currency: CurrencyCode;
  readonly fraudRisk?: FraudRisk | undefined; // Pre-computed fraud risk level for metrics
  // Корреляция операций идет только через distributed tracing (traceId), не через контекст
}; // ==================== МЕТРИКИ ====================

/**
 * Набор метрик для billing service с cardinality expectations
 *
 * ⚠️  ВАЖНО: Изменение labels = breaking observability change!
 *          Любое изменение label names/types ломает dashboards и alerts.
 */
type BillingMetrics = {
  // Success/Failure counters (~12 cardinality - LOW, dashboard-safe)
  readonly operationsTotal: ReturnType<Meter['createCounter']>;
  // Latency histograms, wall-clock time (~12 cardinality - LOW, SLA monitoring ready)
  readonly operationLatency: ReturnType<Meter['createHistogram']>;
  // Fraud alerts counter (~3 cardinality - VERY LOW, alerting ready) - TODO: Future risk label split
  readonly fraudAlerts: ReturnType<Meter['createCounter']>;
  // Fraud risk score distribution (~12 cardinality - LOW, range 0.0-1.0 normalized)
  // SLA: p95 > 0.3 = high risk threshold, p99 > 0.5 = critical escalation
  readonly riskScore: ReturnType<Meter['createHistogram']>;
};

/** Context для инициализированных метрик billing service - ⚠️  breaking observability change при изменении labels */
export const billingServiceMetrics = Context.GenericTag<BillingMetrics>('billingServiceMetrics');

// ==================== DERIVED ATTRIBUTES ====================

/**
 * Создает расширенные производные атрибуты из ошибки для метрик и мониторинга
 *
 * Использует monitoring policy для business logic - metadata вычисляется один раз.
 */
const createDerivedAttributesFromError = (
  error: BillingServiceError,
): ReturnType<typeof calculateMonitoringAttributes> => calculateMonitoringAttributes(error);

/** Создает метрики для billing service - используется в Layer */
const createBillingMetrics = (meter: Meter): BillingMetrics => ({
  operationsTotal: meter.createCounter(
    'billing_operations_total',
    {
      description: 'Общее количество billing операций',
    },
  ),

  operationLatency: meter.createHistogram(
    'billing_operation_duration_ms',
    {
      description:
        'Длительность billing операций (wall-clock time, включает системные задержки) - SLA buckets: 10ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s',
      unit: 'ms',
    },
  ),

  fraudAlerts: meter.createCounter(
    'billing_fraud_alerts_total',
    {
      description: 'Количество fraud alerts', // TODO: Future: fraud_alerts_total{risk="high|critical"}
    },
  ),

  riskScore: meter.createHistogram(
    'billing_fraud_risk_score',
    {
      description:
        'Распределение fraud risk scores (0.0-1.0 normalized) - SLA buckets: 0.1, 0.2, 0.3, 0.5, 0.7, 0.9',
      unit: 'score',
    },
  ),
});

// ==================== HELPER ФУНКЦИИ ====================

/** Константа для конвертации наносекунд в миллисекунды */
const NANOS_TO_MILLIS = 1_000_000;

/** PCI compliance check - логирует предупреждение вместо выбрасывания ошибки */
const checkPCISafe = (attrs: Record<string, unknown>, enableChecks: boolean): Effect.Effect<void> =>
  enableChecks
    ? Effect.flatMap(
      Effect.sync(() => detectPCISensitiveFields(attrs)),
      (violations) =>
        violations.length > 0
          ? Effect.logWarning(
            `PCI COMPLIANCE WARNING: Sensitive fields in metrics: ${violations.join(', ')}`,
          )
          : Effect.void,
    )
    : Effect.void; // Пропускаем проверку для performance в production

// Error classification types and mapping moved to monitoring policy for architectural separation

/** Записывает метрики успеха: operations counter, latency histogram, fraud score */
const recordSuccess = (
  ctx: BillingInstrumentationContext,
  latencyMs: number,
  enablePCIChecks: boolean,
): Effect.Effect<void, never, BillingMetrics> => {
  return Effect.flatMap(billingServiceMetrics, (metrics) => {
    // fraudRisk берем из pre-computed контекста

    const attributes: BillingMetricAttributes = {
      provider: ctx.provider,
      operation: ctx.operation,
      currency: ctx.currency,
      result: 'success' as const,
      fraudRisk: ctx.fraudRisk, // undefined для неизвестных состояний - не скрываем проблемы
    };

    return checkPCISafe(attributes, enablePCIChecks).pipe(
      Effect.flatMap(() =>
        Effect.sync(() => {
          metrics.operationsTotal.add(1, attributes);
          metrics.operationLatency.record(latencyMs, attributes);
        })
      ),
      Effect.ignore, // Instrumentation MUST NOT fail business flow
    );
  });
};

/** Записывает метрики неудачи: operations counter, latency, fraud alerts, error classification */
const recordFailure = (
  ctx: BillingInstrumentationContext,
  error: BillingServiceError,
  latencyMs: number,
  enablePCIChecks: boolean,
): Effect.Effect<void, never, BillingMetrics> => {
  return Effect.flatMap(billingServiceMetrics, (metrics) => {
    // fraudRisk берем из pre-computed контекста

    // Создаем расширенные атрибуты из ошибки для метрик
    const errorAttributes = createDerivedAttributesFromError(error);

    // INVARIANT: всегда используем ctx.provider, игнорируя error metadata
    // Это обеспечивает консистентность operation-level aggregation в метриках
    // Provider из контекста отражает реальный service flow, а не error classification
    const provider = ctx.provider;

    const attributes: BillingMetricAttributes = {
      provider,
      operation: ctx.operation,
      currency: ctx.currency,
      result: 'failure' as const,
      fraudRisk: ctx.fraudRisk, // undefined для неизвестных состояний - не скрываем проблемы
      errorTag: errorAttributes.errorTag,
      errorClass: errorAttributes.errorClass,
      severity: errorAttributes.severity,
      businessImpact: errorAttributes.businessImpact,
    };

    return checkPCISafe(attributes, enablePCIChecks).pipe(
      Effect.flatMap(() =>
        Effect.sync(() => {
          metrics.operationsTotal.add(1, attributes);
          metrics.operationLatency.record(latencyMs, attributes);

          // TODO: Future-proof fraud alerts семантика
          // Сейчас: fraud_alerts_total{risk="high"} (единственный уровень)
          // Будущее: fraud_alerts_total{risk="high"} | fraud_alerts_total{risk="critical"}
          // НЕ расширять случайно - резервировать для будущих уровней риска
          // Fraud alerts с теми же labels для консистентности dashboards
          if (ctx.fraudRisk === 'high') {
            metrics.fraudAlerts.add(1, attributes); // Используем полный набор attributes
          }
        })
      ),
      Effect.ignore, // Instrumentation MUST NOT fail business flow
    );
  });
};

// ==================== ОСНОВНАЯ ЛОГИКА ====================

/** Инструментирует billing операцию с метриками success/failure/latency */
const instrumentBillingOperationInternal = <T, E, R>(
  ctx: BillingInstrumentationContext,
  effect: Effect.Effect<T, E, R>,
): Effect.Effect<T, E, R | BillingInstrumentationServices> => {
  return Effect.flatMap(
    billingServiceConfigTag,
    (config) =>
      Effect.flatMap(billingServiceTracer, (tracer) =>
        Effect.flatMap(billingServiceMetrics, () => {
          // fraudRisk уже pre-computed в контексте для consistency

          // Monotonic time для точного измерения latency (Effect.Clock.currentTimeNanos - гарантированно монотонный)
          // Защита от clock skew: Math.max(0, ...) предотвращает отрицательные latency в edge-кейсах (VM/container pause)
          return Effect.flatMap(Clock.currentTimeNanos, (startTime) => {
            return tracer.startActiveSpan(`billing.${ctx.operation}`, {
              attributes: {
                'billing.operation': ctx.operation,
                'billing.provider': ctx.provider,
                'billing.currency': ctx.currency,
              },
            }, (span) => {
              return effect.pipe(
                Effect.tap(() =>
                  Effect.flatMap(Clock.currentTimeNanos, (endTime) => {
                    // Добавляем fraud risk в span для корреляции
                    if (ctx.fraudRisk) {
                      span.setAttribute('billing.fraud_risk', ctx.fraudRisk);
                    }
                    return recordSuccess(
                      ctx,
                      Math.max(0, Number(endTime - startTime) / NANOS_TO_MILLIS),
                      config.enablePCIChecks,
                    );
                  })
                ),
                Effect.tapError((error) =>
                  Effect.flatMap(Clock.currentTimeNanos, (endTime) => {
                    // Добавляем error info в span для корреляции и устанавливаем статус ERROR
                    span.setAttribute('billing.error', 'true');
                    span.setStatus({ code: SpanStatusCode.ERROR });
                    if (isBillingServiceError(error)) {
                      span.setAttribute('billing.error_tag', error._tag);
                      return recordFailure(
                        ctx,
                        error,
                        Math.max(0, Number(endTime - startTime) / NANOS_TO_MILLIS),
                        config.enablePCIChecks,
                      );
                    } else {
                      span.setAttribute('billing.error_type', 'unknown');
                      // Создаем generic error для обеспечения failure metrics даже для неизвестных ошибок
                      return Effect.flatMap(
                        createInfrastructureUnknownError(error),
                        (genericError) =>
                          // Логируем оригинальную ошибку для debugging с correlation через Effect logging
                          Effect.flatMap(
                            Effect.logWarning('Unknown error type in billing operation', { error }),
                            () =>
                              recordFailure(
                                ctx,
                                genericError,
                                Math.max(0, Number(endTime - startTime) / NANOS_TO_MILLIS),
                                config.enablePCIChecks,
                              ),
                          ),
                      );
                    }
                  })
                ),
                // Гарантированно закрываем span (future-proof на случай изменения API)
                Effect.ensuring(Effect.sync(() => {
                  span.end();
                })),
              );
            });
          });
        })),
  );
};

// ==================== CONTEXT & LAYER ====================

/** Объединенный тип для всех зависимостей billing instrumentation
 *
 * NOTE: Это union, а не intersection, потому что:
 * - Layer.mergeAll объединяет отдельные сервисы в union
 * - Effect.flatMap требует каждый сервис по отдельности
 * - Архитектурно корректно для dependency injection через Context
 */
export type BillingInstrumentationServices = BillingMetrics | Tracer | BillingServiceConfig;

/** Tracer context для billing service */
export const billingServiceTracer = Context.GenericTag<Tracer>('billingServiceTracer');

/** Factory для создания OpenTelemetry tracer */
export type TracerFactory = {
  readonly getTracer: (name: string, version?: string) => Tracer;
};

/** Инструментирует billing операцию с метриками success/failure/latency */
/** @internal - Use instrumentPayment or instrumentRefund instead */
export const instrumentBillingOperation = <T, E, R>(
  ctx: BillingInstrumentationContext,
  effect: Effect.Effect<T, E, R>,
): Effect.Effect<T, E, R | BillingInstrumentationServices> => {
  return instrumentBillingOperationInternal(ctx, effect);
};

/** Factory для создания OpenTelemetry meter - симметрично TracerFactory для vendor-agnostic архитектуры */
export type MeterFactory = {
  readonly getMeter: (name: string, version?: string) => Meter;
};

/** Создает слой OpenTelemetry tracer для billing service с dependency injection */
export const billingServiceTracerLayer = (
  tracerFactory: TracerFactory,
  config: BillingServiceConfig,
): Layer.Layer<never, never, Tracer> =>
  Layer.succeed(
    billingServiceTracer,
    tracerFactory.getTracer('livai.billing-service', config.version),
  );

/** Создает слой инициализированных метрик для billing service */
export const billingServiceMetricsLayer = (
  meterFactory: MeterFactory,
  config: BillingServiceConfig,
): Layer.Layer<never, never, BillingMetrics> =>
  Layer.succeed(
    billingServiceMetrics,
    createBillingMetrics(meterFactory.getMeter('livai.billing-service', config.version)),
  );

/** Создает слой полной billing instrumentation с dependency injection
 *
 * Композиция простых слоев - memoization не требуется, так как инициализация легковесная.
 * Используйте Layer.memoize только для expensive операций (например, database connections).
 */
export const billingInstrumentationLayer = (
  tracerFactory: TracerFactory,
  meterFactory: MeterFactory,
  config: BillingServiceConfig,
): Layer.Layer<never, never, BillingInstrumentationServices> =>
  Layer.mergeAll(
    billingServiceTracerLayer(tracerFactory, config),
    billingServiceMetricsLayer(meterFactory, config),
    Layer.succeed(billingServiceConfigTag, config),
  );

// ==================== CONVENIENCE FUNCTIONS ====================

/** ⚠️  SEMI-PUBLIC API: Используйте для новых billing операций
 *
 * Curried helper для создания type-safe instrumented операций.
 * Единая точка входа для всего billing instrumentation - обеспечивает:
 * - DRY principle для новых операций
 * - Type safety и consistency
 * - Полную observability (tracing + metrics)
 * - PCI compliance
 */
export const instrumentOperation = <T, E, R>(
  operation: BillingOperation,
) =>
(
  provider: BillingProvider,
  currency: CurrencyCode,
  fraudRisk: FraudRisk | undefined,
  effect: Effect.Effect<T, E, R>,
): Effect.Effect<T, E, R | BillingInstrumentationServices> =>
  instrumentBillingOperation(
    {
      operation,
      provider,
      currency,
      fraudRisk,
    },
    effect,
  );

// ==================== BUSINESS API ENTRY POINTS ====================

/** 🏦 BUSINESS API: Единственная точка входа для payment операций
 *
 * Эти функции - ОБЯЗАТЕЛЬНЫЕ для использования в бизнес-коде billing service.
 * Гарантируют полную observability, PCI compliance и type safety.
 *
 * ❌ НЕ используйте instrumentBillingOperation напрямую в бизнес-коде
 * ✅ Всегда используйте эти convenience functions
 */

/** 🏦 BUSINESS ENTRY POINTS
 *
 * ЕДИНСТВЕННЫЕ точки входа для billing операций в бизнес-коде.
 * Автоматически обеспечивают: tracing, metrics, fraud alerts, PCI compliance.
 */

/** Payment операции */
export const instrumentPayment = instrumentOperation(BILLING_OPERATIONS.PAYMENT);

/** Refund операции */
export const instrumentRefund = instrumentOperation(BILLING_OPERATIONS.REFUND);
