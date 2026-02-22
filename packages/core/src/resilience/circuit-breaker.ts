/**
 * @file packages/core/src/resilience/circuit-breaker.ts
 * ============================================================================
 * 🎯 CORE — Resilience Circuit Breaker (Pure Reliability Primitive)
 * ============================================================================
 *
 * Архитектурная роль:
 * Generic circuit breaker для SLA-изоляции внешних зависимостей.
 * Предоставляет детерминированный two-phase API:
 * 1) gate evaluation (можно ли делать запрос сейчас),
 * 2) outcome application (обновление состояния после результата запроса).
 *
 * Принципы:
 * - ✅ SRP — gate-оценка и state transition отделены
 * - ✅ Deterministic — нет скрытых часов/рандома, время передается явно
 * - ✅ Domain-pure — без IO/логирования/глобального состояния
 * - ✅ Extensible — policy-конфигурация меняет поведение без изменения core-алгоритма
 * - ✅ Strict typing — union-типы для состояний/причин, без stringly-typed API
 */

/* ============================================================================
 * 🧩 TYPES — CIRCUIT BREAKER CONTRACT
 * ============================================================================
 */

/** Состояние circuit breaker. */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

/** Причина блокировки запроса на gate-этапе. */
export type CircuitBreakerBlockReason =
  | 'error_budget_exhausted'
  | 'cooldown_active'
  | 'half_open_probe_limit_reached';

/** Конфигурация circuit breaker policy. */
export type CircuitBreakerConfig = Readonly<{
  /** Минимальное число запросов перед оценкой failure rate. */
  readonly minimumRequestCount: number;
  /** Порог ошибок (в процентах, 0..100), после которого circuit открывается. */
  readonly failureRateThresholdPercent: number;
  /** Длительность open-состояния (cooldown). */
  readonly openStateCooldownMs: number;
  /** Максимум probe-запросов в half-open до следующего решения. */
  readonly halfOpenProbeLimit: number;
  /** Error budget: максимум ошибок в скользящем окне. */
  readonly errorBudgetPerWindow: number;
  /** Размер окна error budget. */
  readonly errorBudgetWindowMs: number;
}>;

/** Внутреннее состояние circuit breaker + метрики. */
export type CircuitBreakerMetrics = Readonly<{
  readonly state: CircuitBreakerState;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errorsInWindow: number;
  readonly windowStartedMs: number;
  readonly lastTransitionMs: number;
  readonly halfOpenProbeCount: number;
}>;

/** Результат gate-проверки до выполнения запроса. */
export type CircuitBreakerGateDecision =
  | Readonly<{
    readonly allowRequest: true;
    readonly nextState: CircuitBreakerMetrics;
  }>
  | Readonly<{
    readonly allowRequest: false;
    readonly nextState: CircuitBreakerMetrics;
    readonly blockReason: CircuitBreakerBlockReason;
    readonly retryAfterMs?: number;
  }>;

/** Результат выполнения запроса для обновления state machine. */
export type CircuitBreakerRequestOutcome = 'success' | 'failure';

/* ============================================================================
 * 🔧 DEFAULTS
 * ============================================================================
 */

const DEFAULT_MIN_REQUESTS = 10;
const DEFAULT_FAILURE_THRESHOLD = 50;
const DEFAULT_OPEN_COOLDOWN_MS = 60_000;
const DEFAULT_HALF_OPEN_PROBE_LIMIT = 1;
const DEFAULT_ERROR_BUDGET = 100;
const DEFAULT_ERROR_BUDGET_WINDOW_MS = 300_000;

/** Дефолтная fail-safe конфигурация circuit breaker. */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = Object.freeze({
  minimumRequestCount: DEFAULT_MIN_REQUESTS,
  failureRateThresholdPercent: DEFAULT_FAILURE_THRESHOLD,
  openStateCooldownMs: DEFAULT_OPEN_COOLDOWN_MS,
  halfOpenProbeLimit: DEFAULT_HALF_OPEN_PROBE_LIMIT,
  errorBudgetPerWindow: DEFAULT_ERROR_BUDGET,
  errorBudgetWindowMs: DEFAULT_ERROR_BUDGET_WINDOW_MS,
});

/* ============================================================================
 * 🔧 INTERNAL HELPERS
 * ============================================================================
 */

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function normalizePercentage(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, value));
}

function normalizeConfig(config: Readonly<CircuitBreakerConfig>): CircuitBreakerConfig {
  return Object.freeze({
    minimumRequestCount: Math.max(
      1,
      normalizeNonNegativeInteger(
        config.minimumRequestCount,
        DEFAULT_CIRCUIT_BREAKER_CONFIG.minimumRequestCount,
      ),
    ),
    failureRateThresholdPercent: normalizePercentage(
      config.failureRateThresholdPercent,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.failureRateThresholdPercent,
    ),
    openStateCooldownMs: Math.max(
      1,
      normalizeNonNegativeInteger(
        config.openStateCooldownMs,
        DEFAULT_CIRCUIT_BREAKER_CONFIG.openStateCooldownMs,
      ),
    ),
    halfOpenProbeLimit: Math.max(
      1,
      normalizeNonNegativeInteger(
        config.halfOpenProbeLimit,
        DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenProbeLimit,
      ),
    ),
    errorBudgetPerWindow: Math.max(
      1,
      normalizeNonNegativeInteger(
        config.errorBudgetPerWindow,
        DEFAULT_CIRCUIT_BREAKER_CONFIG.errorBudgetPerWindow,
      ),
    ),
    errorBudgetWindowMs: Math.max(
      1,
      normalizeNonNegativeInteger(
        config.errorBudgetWindowMs,
        DEFAULT_CIRCUIT_BREAKER_CONFIG.errorBudgetWindowMs,
      ),
    ),
  });
}

function refreshErrorBudgetWindow(
  state: Readonly<CircuitBreakerMetrics>,
  config: Readonly<CircuitBreakerConfig>,
  nowMs: number,
): CircuitBreakerMetrics {
  if (nowMs - state.windowStartedMs < config.errorBudgetWindowMs) {
    return state;
  }
  return Object.freeze({
    ...state,
    errorsInWindow: 0,
    windowStartedMs: nowMs,
  });
}

function calculateFailureRatePercent(metrics: Readonly<CircuitBreakerMetrics>): number {
  const totalRequests = metrics.successCount + metrics.failureCount;
  if (totalRequests <= 0) {
    return 0;
  }
  return (metrics.failureCount / totalRequests) * 100;
}

/** Гарантирует неотрицательное значение retryAfter для прозрачного downstream-контракта. */
function toNonNegativeRetryAfterMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function transitionState(
  state: Readonly<CircuitBreakerMetrics>,
  next: CircuitBreakerState,
  nowMs: number,
): CircuitBreakerMetrics {
  if (state.state === next) {
    return state;
  }
  return Object.freeze({
    ...state,
    state: next,
    lastTransitionMs: nowMs,
    ...(next !== 'half_open' && { halfOpenProbeCount: 0 }),
  });
}

/* ============================================================================
 * 🎯 API — STATE MACHINE
 * ============================================================================
 */

/**
 * Создает начальное состояние circuit breaker.
 * @param nowMs Время в ms передается извне для детерминизма.
 */
export function createInitialCircuitBreakerState(nowMs: number): CircuitBreakerMetrics {
  return Object.freeze({
    state: 'closed',
    successCount: 0,
    failureCount: 0,
    errorsInWindow: 0,
    windowStartedMs: nowMs,
    lastTransitionMs: nowMs,
    halfOpenProbeCount: 0,
  });
}

/**
 * Проверяет gate перед внешним вызовом.
 * Может вернуть обновленное состояние (например, open -> half_open после cooldown).
 */
export function evaluateCircuitBreakerGate(
  currentState: Readonly<CircuitBreakerMetrics>,
  rawConfig: Readonly<CircuitBreakerConfig>,
  nowMs: number,
): CircuitBreakerGateDecision {
  const config = normalizeConfig(rawConfig);
  const state = refreshErrorBudgetWindow(currentState, config, nowMs);

  if (state.errorsInWindow >= config.errorBudgetPerWindow) {
    const opened = transitionState(state, 'open', nowMs);
    return Object.freeze({
      allowRequest: false,
      nextState: opened,
      blockReason: 'error_budget_exhausted',
      retryAfterMs: config.openStateCooldownMs,
    });
  }

  if (state.state === 'closed') {
    return Object.freeze({
      allowRequest: true,
      nextState: state,
    });
  }

  if (state.state === 'open') {
    const elapsed = nowMs - state.lastTransitionMs;
    if (elapsed >= config.openStateCooldownMs) {
      return Object.freeze({
        allowRequest: true,
        nextState: transitionState(state, 'half_open', nowMs),
      });
    }
    return Object.freeze({
      allowRequest: false,
      nextState: state,
      blockReason: 'cooldown_active',
      retryAfterMs: toNonNegativeRetryAfterMs(config.openStateCooldownMs - elapsed), // Явно не возвращаем отрицательные значения.
    });
  }

  if (state.halfOpenProbeCount >= config.halfOpenProbeLimit) {
    return Object.freeze({
      allowRequest: false,
      nextState: state,
      blockReason: 'half_open_probe_limit_reached',
    });
  }

  return Object.freeze({
    allowRequest: true,
    nextState: Object.freeze({
      ...state,
      halfOpenProbeCount: state.halfOpenProbeCount + 1, // Счетчик probe увеличивается только при реально разрешенном запросе.
    }),
  });
}

/**
 * Обновляет state machine после результата запроса.
 * @param currentState Состояние после gate-решения (decision.nextState).
 */
export function applyCircuitBreakerOutcome(
  currentState: Readonly<CircuitBreakerMetrics>,
  outcome: CircuitBreakerRequestOutcome,
  rawConfig: Readonly<CircuitBreakerConfig>,
  nowMs: number,
): CircuitBreakerMetrics {
  const config = normalizeConfig(rawConfig);
  const state = refreshErrorBudgetWindow(currentState, config, nowMs);

  const successCount = outcome === 'success' ? state.successCount + 1 : state.successCount;
  const failureCount = outcome === 'failure' ? state.failureCount + 1 : state.failureCount;
  const errorsInWindow = outcome === 'failure' ? state.errorsInWindow + 1 : state.errorsInWindow;

  const withCounters = Object.freeze({
    ...state,
    successCount,
    failureCount,
    errorsInWindow,
  });

  if (withCounters.state === 'half_open') {
    if (outcome === 'success') {
      return Object.freeze({
        ...transitionState(withCounters, 'closed', nowMs),
        successCount: 0,
        failureCount: 0,
        halfOpenProbeCount: 0,
      });
    }
    return transitionState(withCounters, 'open', nowMs);
  }

  if (withCounters.state === 'open') {
    return withCounters;
  }

  const totalRequests = withCounters.successCount + withCounters.failureCount;
  const failureRatePercent = calculateFailureRatePercent(withCounters);
  const mustOpen = totalRequests >= config.minimumRequestCount
    && failureRatePercent >= config.failureRateThresholdPercent;

  return mustOpen
    ? transitionState(withCounters, 'open', nowMs)
    : withCounters;
}
