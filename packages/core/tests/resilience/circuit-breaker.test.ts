/**
 * @file Unit тесты для Resilience Circuit Breaker
 * Покрывают gate/outcome state machine и ключевые edge-cases.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCircuitBreakerOutcome,
  createInitialCircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  evaluateCircuitBreakerGate,
} from '../../src/resilience/circuit-breaker.js';
import type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from '../../src/resilience/circuit-breaker.js';

const HALF_OPEN_PROBE_LIMIT = 2;
const OPEN_COOLDOWN_MS = 10;
const BASE_TIME_MS = 1_000;
const CLOCK_SKEW_BACK_MS = 15;

function createConfig(overrides: Partial<CircuitBreakerConfig> = {}): CircuitBreakerConfig {
  return Object.freeze({
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    ...overrides,
  });
}

function createState(overrides: Partial<CircuitBreakerMetrics>): CircuitBreakerMetrics {
  return Object.freeze({
    ...createInitialCircuitBreakerState(BASE_TIME_MS),
    ...overrides,
  });
}

describe('resilience/circuit-breaker', () => {
  it('создает начальное состояние с переданным временем', () => {
    const state = createInitialCircuitBreakerState(BASE_TIME_MS);
    expect(state.state).toBe('closed');
    expect(state.windowStartedMs).toBe(BASE_TIME_MS);
    expect(state.lastTransitionMs).toBe(BASE_TIME_MS);
    expect(state.successCount).toBe(0);
    expect(state.failureCount).toBe(0);
    expect(state.errorsInWindow).toBe(0);
    expect(state.halfOpenProbeCount).toBe(0);
  });

  it('в состоянии closed всегда разрешает запрос при не исчерпанном error budget', () => {
    const config = createConfig();
    const closedState = createState({
      state: 'closed',
      errorsInWindow: config.errorBudgetPerWindow - 1,
    });
    const decision = evaluateCircuitBreakerGate(closedState, config, BASE_TIME_MS);
    expect(decision.allowRequest).toBe(true);
    expect(decision.nextState.state).toBe('closed');
  });

  it('блокирует запрос при исчерпанном error budget и открывает circuit', () => {
    const config = createConfig({
      errorBudgetPerWindow: 3,
    });
    const closedState = createState({
      state: 'closed',
      errorsInWindow: 3,
    });
    const decision = evaluateCircuitBreakerGate(closedState, config, BASE_TIME_MS);
    expect(decision.allowRequest).toBe(false);
    if (decision.allowRequest) {
      throw new Error('Unexpected allowRequest=true when budget exhausted');
    }
    expect(decision.blockReason).toBe('error_budget_exhausted');
    expect(decision.nextState.state).toBe('open');
    expect(decision.nextState.lastTransitionMs).toBe(BASE_TIME_MS);
  });

  it('при исчерпанном error budget и уже open состоянии не меняет state object', () => {
    const config = createConfig({
      errorBudgetPerWindow: 1,
    });
    const openState = createState({
      state: 'open',
      errorsInWindow: 1,
    });
    const decision = evaluateCircuitBreakerGate(openState, config, BASE_TIME_MS);
    expect(decision.allowRequest).toBe(false);
    if (decision.allowRequest) {
      throw new Error('Unexpected allowRequest=true');
    }
    expect(decision.nextState).toBe(openState);
  });

  it('ограничивает half-open probes и блокирует запрос после достижения лимита', () => {
    const config = createConfig({
      openStateCooldownMs: OPEN_COOLDOWN_MS,
      halfOpenProbeLimit: HALF_OPEN_PROBE_LIMIT,
    });
    const openState = createState({
      state: 'open',
      lastTransitionMs: BASE_TIME_MS,
    });

    const moveToHalfOpen = evaluateCircuitBreakerGate(
      openState,
      config,
      BASE_TIME_MS + OPEN_COOLDOWN_MS,
    );
    expect(moveToHalfOpen.allowRequest).toBe(true);
    const halfOpenState = moveToHalfOpen.nextState;
    expect(halfOpenState.state).toBe('half_open');
    expect(halfOpenState.halfOpenProbeCount).toBe(0);

    const probeOne = evaluateCircuitBreakerGate(
      halfOpenState,
      config,
      BASE_TIME_MS + OPEN_COOLDOWN_MS,
    );
    expect(probeOne.allowRequest).toBe(true);
    expect(probeOne.nextState.halfOpenProbeCount).toBe(1);

    const probeTwo = evaluateCircuitBreakerGate(
      probeOne.nextState,
      config,
      BASE_TIME_MS + OPEN_COOLDOWN_MS,
    );
    expect(probeTwo.allowRequest).toBe(true);
    expect(probeTwo.nextState.halfOpenProbeCount).toBe(2);

    const blockedProbe = evaluateCircuitBreakerGate(
      probeTwo.nextState,
      config,
      BASE_TIME_MS + OPEN_COOLDOWN_MS,
    );
    expect(blockedProbe.allowRequest).toBe(false);
    if (blockedProbe.allowRequest) {
      throw new Error('Unexpected allowRequest=true for blocked probe');
    }
    expect(blockedProbe.blockReason).toBe('half_open_probe_limit_reached');
  });

  it('в open состоянии до конца cooldown блокирует с retryAfterMs > 0', () => {
    const config = createConfig({
      openStateCooldownMs: OPEN_COOLDOWN_MS,
    });
    const openState = createState({
      state: 'open',
      lastTransitionMs: BASE_TIME_MS,
    });
    const decision = evaluateCircuitBreakerGate(
      openState,
      config,
      BASE_TIME_MS + OPEN_COOLDOWN_MS - 1,
    );
    expect(decision.allowRequest).toBe(false);
    if (decision.allowRequest) {
      throw new Error('Unexpected allowRequest=true during cooldown');
    }
    expect(decision.blockReason).toBe('cooldown_active');
    expect(decision.retryAfterMs).toBe(1);
  });

  it('сбрасывает счетчики после успешного запроса в half-open после нескольких probes', () => {
    const config = createConfig({
      openStateCooldownMs: OPEN_COOLDOWN_MS,
      halfOpenProbeLimit: HALF_OPEN_PROBE_LIMIT,
    });
    const halfOpenWithProbes = createState({
      state: 'half_open',
      successCount: 5,
      failureCount: 4,
      halfOpenProbeCount: HALF_OPEN_PROBE_LIMIT,
      lastTransitionMs: BASE_TIME_MS,
    });

    const nextState = applyCircuitBreakerOutcome(
      halfOpenWithProbes,
      'success',
      config,
      BASE_TIME_MS + OPEN_COOLDOWN_MS,
    );

    expect(nextState.state).toBe('closed');
    expect(nextState.successCount).toBe(0);
    expect(nextState.failureCount).toBe(0);
    expect(nextState.halfOpenProbeCount).toBe(0);
  });

  it('при неуспешном запросе в half-open переводит circuit обратно в open', () => {
    const config = createConfig();
    const halfOpenState = createState({
      state: 'half_open',
      successCount: 1,
      failureCount: 1,
      halfOpenProbeCount: 1,
    });
    const nextState = applyCircuitBreakerOutcome(halfOpenState, 'failure', config, BASE_TIME_MS);
    expect(nextState.state).toBe('open');
    expect(nextState.failureCount).toBe(2);
    expect(nextState.lastTransitionMs).toBe(BASE_TIME_MS);
  });

  it('в open состоянии apply outcome не меняет состояние, только счетчики', () => {
    const config = createConfig();
    const openState = createState({
      state: 'open',
      successCount: 2,
      failureCount: 3,
    });
    const nextState = applyCircuitBreakerOutcome(openState, 'success', config, BASE_TIME_MS);
    expect(nextState.state).toBe('open');
    expect(nextState.successCount).toBe(3);
    expect(nextState.failureCount).toBe(3);
  });

  it('в closed состоянии открывает circuit при превышении порога ошибок', () => {
    const config = createConfig({
      minimumRequestCount: 2,
      failureRateThresholdPercent: 50,
    });
    const closedState = createState({
      state: 'closed',
      successCount: 0,
      failureCount: 1,
    });
    const nextState = applyCircuitBreakerOutcome(closedState, 'failure', config, BASE_TIME_MS);
    expect(nextState.state).toBe('open');
  });

  it('в closed состоянии не открывает circuit, пока не выполнены условия порога', () => {
    const config = createConfig({
      minimumRequestCount: 10,
      failureRateThresholdPercent: 90,
    });
    const closedState = createState({
      state: 'closed',
      successCount: 5,
      failureCount: 1,
    });
    const nextState = applyCircuitBreakerOutcome(closedState, 'success', config, BASE_TIME_MS);
    expect(nextState.state).toBe('closed');
  });

  it('в cooldown ветке возвращает только неотрицательный retryAfterMs', () => {
    const config = createConfig({
      openStateCooldownMs: OPEN_COOLDOWN_MS,
    });
    const skewedOpenState = createState({
      state: 'open',
      lastTransitionMs: BASE_TIME_MS + CLOCK_SKEW_BACK_MS,
    });

    const decision = evaluateCircuitBreakerGate(skewedOpenState, config, BASE_TIME_MS);
    expect(decision.allowRequest).toBe(false);
    if (decision.allowRequest) {
      throw new Error('Unexpected allowRequest=true in cooldown test');
    }
    expect(decision.blockReason).toBe('cooldown_active');
    expect(decision.retryAfterMs).toBeGreaterThanOrEqual(0);
  });

  it('в cooldown ветке при non-finite времени возвращает retryAfterMs = 0', () => {
    const config = createConfig({
      openStateCooldownMs: OPEN_COOLDOWN_MS,
    });
    const openState = createState({
      state: 'open',
      lastTransitionMs: BASE_TIME_MS,
    });
    const decision = evaluateCircuitBreakerGate(openState, config, Number.NaN);
    expect(decision.allowRequest).toBe(false);
    if (decision.allowRequest) {
      throw new Error('Unexpected allowRequest=true with NaN time');
    }
    expect(decision.blockReason).toBe('cooldown_active');
    expect(decision.retryAfterMs).toBe(0);
  });

  it('в closed состоянии использует fallback failure rate = 0 при totalRequests <= 0', () => {
    const config = createConfig({
      minimumRequestCount: 1,
      failureRateThresholdPercent: 1,
    });
    const invalidState = createState({
      state: 'closed',
      successCount: -1,
      failureCount: 0,
    });
    const nextState = applyCircuitBreakerOutcome(invalidState, 'success', config, BASE_TIME_MS);
    expect(nextState.state).toBe('closed');
  });

  it('нормализует невалидную конфигурацию и корректно обновляет окно error budget', () => {
    const invalidConfig = createConfig({
      minimumRequestCount: Number.NaN,
      failureRateThresholdPercent: Number.POSITIVE_INFINITY,
      openStateCooldownMs: -5,
      halfOpenProbeLimit: -2,
      errorBudgetPerWindow: -1,
      errorBudgetWindowMs: 0,
    });
    const state = createState({
      state: 'closed',
      errorsInWindow: 5,
      windowStartedMs: BASE_TIME_MS,
    });
    const decision = evaluateCircuitBreakerGate(state, invalidConfig, BASE_TIME_MS + 1);
    expect(decision.allowRequest).toBe(true);
    expect(decision.nextState.errorsInWindow).toBe(0);
  });
});
