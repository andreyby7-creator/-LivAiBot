/**
 * @file CircuitBreakerPolicy.ts
 *
 * Алгебра circuit breaker-политик для Effect.
 *
 * Принципы:
 *  - circuit breaker = чистая стратегия (без side-effects)
 *  - policy ≠ storage / metrics / time source
 *  - policy ≠ Effect (Effect — лишь интерпретатор)
 *  - никакой domain / retry / recovery логики
 *
 * Используется как foundation-layer для всех адаптеров.
 */

import { Duration, Effect } from 'effect';

// ==================== БАЗОВЫЕ ТИПЫ ====================

/** Состояние circuit breaker */
export type CircuitState =
  | { readonly _tag: 'Closed'; }
  | { readonly _tag: 'Open'; readonly openedAt: number; }
  | { readonly _tag: 'HalfOpen'; };

/** Контекст для принятия решения */
export type CircuitContext = {
  readonly state: CircuitState;
  readonly failures: number;
  readonly now: number;
};

/** Решение circuit breaker-политики */
export type CircuitDecision =
  | { readonly _tag: 'Allow'; }
  | { readonly _tag: 'Reject'; }
  | { readonly _tag: 'Transition'; readonly nextState: CircuitState; };

/** Circuit breaker-политика как чистая функция */
export type CircuitBreakerPolicy = (
  ctx: CircuitContext,
) => CircuitDecision;

// ==================== СПЕЦИАЛЬНЫЙ ERROR ====================

/** Ошибка для открытого circuit breaker */
export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ==================== ПРИМИТИВНЫЕ ПОЛИТИКИ ====================

/** Никогда не блокировать */
export const alwaysAllow: CircuitBreakerPolicy = () => ({ _tag: 'Allow' });

/** Всегда блокировать */
export const alwaysReject: CircuitBreakerPolicy = () => ({ _tag: 'Reject' });

/**
 * Открывать circuit при превышении порога ошибок
 */
export const openOnFailures =
  (maxFailures: number): CircuitBreakerPolicy => ({ state, failures, now }) => {
    if (state._tag === 'Closed' && failures >= maxFailures) {
      return {
        _tag: 'Transition',
        nextState: { _tag: 'Open', openedAt: now },
      };
    }
    return { _tag: 'Allow' };
  };

/**
 * Переход из Open в HalfOpen по таймауту
 */
export const halfOpenAfter =
  (cooldown: Duration.Duration): CircuitBreakerPolicy => ({ state, now }) => {
    if (state._tag === 'Open') {
      const openedAt = state.openedAt;
      const elapsed = now - openedAt;
      if (elapsed >= Duration.toMillis(cooldown)) {
        return { _tag: 'Transition', nextState: { _tag: 'HalfOpen' } };
      }
      return { _tag: 'Reject' };
    }
    return { _tag: 'Allow' };
  };

// ==================== КОМБИНАТОРЫ ====================

/**
 * Композиция circuit breaker-политик.
 * Первая Transition или Reject побеждает.
 * @experimental
 */
export const buildCircuitBreakerPolicy =
  (...policies: CircuitBreakerPolicy[]): CircuitBreakerPolicy => (ctx) => {
    for (const policy of policies) {
      const decision = policy(ctx);
      if (decision._tag !== 'Allow') {
        return decision;
      }
    }
    return { _tag: 'Allow' };
  };

// ==================== EFFECT HELPERS ====================

/**
 * Интерпретация circuit breaker-политики поверх Effect
 *
 * Особенности:
 *  - state и failures хранятся снаружи (storage)
 *  - policy принимает только snapshot состояния
 *  - Transition применяется атомарно перед выполнением effect
 */
export const withCircuitBreakerPolicy = <A, E>(
  policy: CircuitBreakerPolicy,
  getContext: () => CircuitContext,
  onTransition: (state: CircuitState) => void,
) =>
(effect: Effect.Effect<A, E>): Effect.Effect<A, E> => {
  const ctx = getContext();
  const decision = policy(ctx);

  switch (decision._tag) {
    case 'Reject':
      return Effect.fail(new CircuitBreakerOpenError() as unknown as E);

    case 'Transition':
      // атомарное применение нового состояния перед выполнением effect
      onTransition(decision.nextState);
      return effect;

    case 'Allow':
    default:
      return effect;
  }
};

// ==================== ГОТОВЫЕ ПОЛИТИКИ ====================

/** Максимальное количество последовательных ошибок перед открытием circuit breaker */
const DEFAULT_MAX_FAILURES = 5;

/** Время ожидания в секундах перед переходом из Open в HalfOpen */
const DEFAULT_COOLDOWN_SECONDS = 30;

/** Стандартная infra-политика */
export const DEFAULT_CIRCUIT_BREAKER_POLICY = buildCircuitBreakerPolicy(
  openOnFailures(DEFAULT_MAX_FAILURES),
  halfOpenAfter(Duration.seconds(DEFAULT_COOLDOWN_SECONDS)),
);
