/**
 * @file @livai/core/resilience — Reliability Primitives
 * Публичный API пакета resilience.
 * Экспортирует pure reliability primitives для circuit breaker, metrics, performance limits и связанных SLA-политик.
 */

/* ============================================================================
 * 🧩 TYPES — CIRCUIT BREAKER CONTRACT
 * ========================================================================== */

/**
 * Типы для circuit breaker state machine.
 * Включают policy-конфиг, runtime state, gate/outcome контракты.
 * @public
 */
export type {
  CircuitBreakerBlockReason,
  CircuitBreakerConfig,
  CircuitBreakerGateDecision,
  CircuitBreakerMetrics,
  CircuitBreakerRequestOutcome,
  CircuitBreakerState,
} from './circuit-breaker.js';

/* ============================================================================
 * 🔁 RETRY POLICY — GENERIC PRIMITIVE
 * ========================================================================== */

/**
 * Retry Policy: generic типы и helper для retryability.
 * @public
 */
export type { RetryPolicy } from './retry-policy.js';

/**
 * Retry Policy helpers.
 * @public
 */
export { createRetryPolicy, getRetryable, mergeRetryPolicies } from './retry-policy.js';

/* ============================================================================
 * 🔧 CIRCUIT BREAKER — PURE STATE MACHINE
 * ========================================================================== */

/**
 * Circuit breaker функции:
 * - `createInitialCircuitBreakerState` — начальное состояние;
 * - `evaluateCircuitBreakerGate` — gate-решение до запроса;
 * - `applyCircuitBreakerOutcome` — обновление state machine после запроса.
 * @public
 */
export {
  applyCircuitBreakerOutcome,
  createInitialCircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  evaluateCircuitBreakerGate,
} from './circuit-breaker.js';

/* ============================================================================
 * 🧩 TYPES — METRICS CONTRACT
 * ========================================================================== */

/**
 * Типы для metrics state machine.
 * Включают конфиг агрегации, runtime state, метрики и агрегаты.
 * @public
 */
export type {
  AggregatedMetric,
  MetricAddFailureReason,
  MetricAddResult,
  MetricAggregates,
  MetricsAggregationConfig,
  MetricsAggregationResult,
  MetricsState,
  MetricType,
  MetricUnit,
  MetricValue,
} from './metrics.js';

/* ============================================================================
 * 🔧 METRICS — PURE STATE MACHINE
 * ========================================================================== */

/**
 * Metrics функции:
 * - `createInitialMetricsState` — начальное состояние;
 * - `addMetric` — добавление метрики в состояние;
 * - `aggregateMetrics` — агрегация метрик за временное окно;
 * - `createCounterMetric`, `createGaugeMetric`, `createHistogramMetric`, `createSummaryMetric` — фабрики метрик.
 * @public
 */
export {
  addMetric,
  aggregateMetrics,
  createCounterMetric,
  createGaugeMetric,
  createHistogramMetric,
  createInitialMetricsState,
  createSummaryMetric,
  DEFAULT_METRICS_AGGREGATION_CONFIG,
} from './metrics.js';

/* ============================================================================
 * 🧩 TYPES — PERFORMANCE LIMITS CONTRACT
 * ========================================================================== */

/**
 * Типы для performance limits.
 * Включают конфиг лимитов, результаты проверки и валидации.
 * @public
 */
export type {
  LimitCheckResult,
  LimitsValidationError,
  LimitsValidationErrorReason,
  LimitsValidationResult,
  PerformanceLimitsConfig,
  PerformanceLimitType,
} from './performance-limits.js';

/* ============================================================================
 * 🔧 PERFORMANCE LIMITS — PURE VALIDATION & CHECKING
 * ========================================================================== */

/**
 * Performance limits функции:
 * - `validatePerformanceLimits` — валидация конфигурации лимитов;
 * - `createPerformanceLimitsConfig` — создание конфигурации с переопределениями;
 * - `checkLimitByType` — единая функция проверки лимита по типу (rule-engine архитектура);
 * - `checkLimits` — bulk API для проверки нескольких лимитов одновременно;
 * - `checkRulesLimit`, `checkExecutionTimeLimit`, `checkPluginsLimit`, `checkMemoryLimit`, `checkConcurrentOperationsLimit` — проверка конкретных лимитов;
 * - `createLimitExceededMetric`, `createLimitUsageMetric`, `createLimitUsageGaugeMetric`, `createLimitRemainingMetric` — генераторы метрик для отслеживания лимитов;
 * - `createAllMetricsForLimit` — атомарное создание всех метрик для лимита.
 * @public
 */
export {
  checkConcurrentOperationsLimit,
  checkExecutionTimeLimit,
  checkLimitByType,
  checkLimits,
  checkMemoryLimit,
  checkPluginsLimit,
  checkRulesLimit,
  createAllMetricsForLimit,
  createLimitExceededMetric,
  createLimitRemainingMetric,
  createLimitUsageGaugeMetric,
  createLimitUsageMetric,
  createPerformanceLimitsConfig,
  DEFAULT_PERFORMANCE_LIMITS_CONFIG,
  validatePerformanceLimits,
} from './performance-limits.js';
