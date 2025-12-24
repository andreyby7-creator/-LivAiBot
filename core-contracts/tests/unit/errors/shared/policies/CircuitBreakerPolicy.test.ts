/**
 * @file CircuitBreakerPolicy.test.ts
 * Unit-тесты для CircuitBreakerPolicy.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { Duration, Effect } from 'effect';
import type {
  CircuitBreakerPolicy,
  CircuitContext,
  CircuitState,
} from '../../../../../src/errors/shared/policies/CircuitBreakerPolicy.js';

import {
  // Примитивные политики
  alwaysAllow,
  alwaysReject,
  // Комбинаторы
  buildCircuitBreakerPolicy,
  // Error
  CircuitBreakerOpenError,
  // Готовые политики
  DEFAULT_CIRCUIT_BREAKER_POLICY,
  halfOpenAfter,
  openOnFailures,
  // Effect helpers
  withCircuitBreakerPolicy,
} from '../../../../../src/errors/shared/policies/CircuitBreakerPolicy';

// Mock error для тестов
class TestError extends Error {
  constructor(message = 'Test error') {
    super(message);
    this.name = 'TestError';
  }
}

describe('CircuitBreakerPolicy', () => {
  describe('Примитивные политики', () => {
    describe('alwaysAllow', () => {
      it('должен всегда возвращать Allow независимо от состояния', () => {
        const closedCtx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        const openCtx: CircuitContext = {
          state: { _tag: 'Open', openedAt: Date.now() - 1000 },
          failures: 5,
          now: Date.now(),
        };

        const halfOpenCtx: CircuitContext = {
          state: { _tag: 'HalfOpen' },
          failures: 3,
          now: Date.now(),
        };

        expect(alwaysAllow(closedCtx)).toEqual({ _tag: 'Allow' });
        expect(alwaysAllow(openCtx)).toEqual({ _tag: 'Allow' });
        expect(alwaysAllow(halfOpenCtx)).toEqual({ _tag: 'Allow' });
      });
    });

    describe('alwaysReject', () => {
      it('должен всегда возвращать Reject независимо от состояния', () => {
        const closedCtx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        const openCtx: CircuitContext = {
          state: { _tag: 'Open', openedAt: Date.now() - 1000 },
          failures: 5,
          now: Date.now(),
        };

        expect(alwaysReject(closedCtx)).toEqual({ _tag: 'Reject' });
        expect(alwaysReject(openCtx)).toEqual({ _tag: 'Reject' });
      });
    });

    describe('openOnFailures', () => {
      it('должен возвращать Allow когда failures < maxFailures', () => {
        const policy = openOnFailures(3);

        const ctx1: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 1,
          now: Date.now(),
        };

        const ctx2: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 2,
          now: Date.now(),
        };

        expect(policy(ctx1)).toEqual({ _tag: 'Allow' });
        expect(policy(ctx2)).toEqual({ _tag: 'Allow' });
      });

      it('должен возвращать Transition в Open когда failures >= maxFailures и состояние Closed', () => {
        const policy = openOnFailures(3);
        const now = Date.now();

        const ctx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 3,
          now,
        };

        const result = policy(ctx);
        expect(result._tag).toBe('Transition');
        if (result._tag === 'Transition') {
          expect(result.nextState).toEqual({ _tag: 'Open', openedAt: now });
        }
      });

      it('должен возвращать Allow для состояний Open и HalfOpen независимо от failures', () => {
        const policy = openOnFailures(3);

        const openCtx: CircuitContext = {
          state: { _tag: 'Open', openedAt: Date.now() - 1000 },
          failures: 10,
          now: Date.now(),
        };

        const halfOpenCtx: CircuitContext = {
          state: { _tag: 'HalfOpen' },
          failures: 10,
          now: Date.now(),
        };

        expect(policy(openCtx)).toEqual({ _tag: 'Allow' });
        expect(policy(halfOpenCtx)).toEqual({ _tag: 'Allow' });
      });
    });

    describe('halfOpenAfter', () => {
      it('должен возвращать Allow для состояний Closed и HalfOpen', () => {
        const policy = halfOpenAfter(Duration.seconds(30));

        const closedCtx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        const halfOpenCtx: CircuitContext = {
          state: { _tag: 'HalfOpen' },
          failures: 3,
          now: Date.now(),
        };

        expect(policy(closedCtx)).toEqual({ _tag: 'Allow' });
        expect(policy(halfOpenCtx)).toEqual({ _tag: 'Allow' });
      });

      it('должен возвращать Reject для Open состояния если cooldown не истек', () => {
        const policy = halfOpenAfter(Duration.seconds(30));
        const openedAt = Date.now() - Duration.toMillis(Duration.seconds(10)); // 10 сек назад

        const ctx: CircuitContext = {
          state: { _tag: 'Open', openedAt },
          failures: 5,
          now: Date.now(),
        };

        expect(policy(ctx)).toEqual({ _tag: 'Reject' });
      });

      it('должен возвращать Transition в HalfOpen для Open состояния если cooldown истек', () => {
        const policy = halfOpenAfter(Duration.seconds(30));
        const openedAt = Date.now() - Duration.toMillis(Duration.seconds(35)); // 35 сек назад

        const ctx: CircuitContext = {
          state: { _tag: 'Open', openedAt },
          failures: 5,
          now: Date.now(),
        };

        const result = policy(ctx);
        expect(result._tag).toBe('Transition');
        if (result._tag === 'Transition') {
          expect(result.nextState).toEqual({ _tag: 'HalfOpen' });
        }
      });
    });
  });

  describe('Комбинаторы', () => {
    describe('buildCircuitBreakerPolicy', () => {
      it('должен возвращать Allow если все политики возвращают Allow', () => {
        const policy = buildCircuitBreakerPolicy(alwaysAllow, alwaysAllow);

        const ctx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        expect(policy(ctx)).toEqual({ _tag: 'Allow' });
      });

      it('должен возвращать Transition первой политики, которая его возвращает', () => {
        const transitionPolicy: CircuitBreakerPolicy = () => ({
          _tag: 'Transition',
          nextState: { _tag: 'HalfOpen' },
        });

        const policy = buildCircuitBreakerPolicy(alwaysAllow, transitionPolicy, alwaysReject);

        const ctx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        const result = policy(ctx);
        expect(result._tag).toBe('Transition');
        if (result._tag === 'Transition') {
          expect(result.nextState).toEqual({ _tag: 'HalfOpen' });
        }
      });

      it('должен возвращать Reject первой политики, которая его возвращает', () => {
        const rejectPolicy: CircuitBreakerPolicy = () => ({ _tag: 'Reject' });
        const transitionPolicy: CircuitBreakerPolicy = () => ({
          _tag: 'Transition',
          nextState: { _tag: 'HalfOpen' },
        });

        const policy = buildCircuitBreakerPolicy(alwaysAllow, rejectPolicy, transitionPolicy);

        const ctx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        expect(policy(ctx)).toEqual({ _tag: 'Reject' });
      });

      it('должен работать с пустым массивом политик', () => {
        const policy = buildCircuitBreakerPolicy();

        const ctx: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 0,
          now: Date.now(),
        };

        expect(policy(ctx)).toEqual({ _tag: 'Allow' });
      });
    });
  });

  describe('withCircuitBreakerPolicy', () => {
    it('должен выполнять Effect когда политика возвращает Allow', async () => {
      const getContext = vi.fn(() => ({
        state: { _tag: 'Closed' } as CircuitState,
        failures: 0,
        now: Date.now(),
      }));

      const onTransition = vi.fn();
      const policy = alwaysAllow;

      const effect = Effect.succeed('success');
      const result = await Effect.runPromise(
        withCircuitBreakerPolicy(policy, getContext, onTransition)(effect),
      );

      expect(result).toBe('success');
      expect(getContext).toHaveBeenCalledTimes(1);
      expect(onTransition).not.toHaveBeenCalled();
    });

    it('должен выполнять Effect и вызывать onTransition когда политика возвращает Transition', async () => {
      const transitionPolicy: CircuitBreakerPolicy = () => ({
        _tag: 'Transition',
        nextState: { _tag: 'HalfOpen' },
      });

      const getContext = vi.fn(() => ({
        state: { _tag: 'Closed' } as CircuitState,
        failures: 0,
        now: Date.now(),
      }));

      const onTransition = vi.fn();

      const effect = Effect.succeed('success');
      const result = await Effect.runPromise(
        withCircuitBreakerPolicy(transitionPolicy, getContext, onTransition)(effect),
      );

      expect(result).toBe('success');
      expect(getContext).toHaveBeenCalledTimes(1);
      expect(onTransition).toHaveBeenCalledWith({ _tag: 'HalfOpen' });
    });

    it('должен выбрасывать CircuitBreakerOpenError когда политика возвращает Reject', async () => {
      const getContext = vi.fn(() => ({
        state: { _tag: 'Open', openedAt: Date.now() - 1000 } as CircuitState,
        failures: 5,
        now: Date.now(),
      }));

      const onTransition = vi.fn();
      const policy = alwaysReject;

      const effect = Effect.succeed('should not execute');
      const exit = await Effect.runPromiseExit(
        withCircuitBreakerPolicy(policy, getContext, onTransition)(effect),
      );

      expect(exit._tag).toBe('Failure');
      if (exit._tag === 'Failure') {
        expect(exit.cause._tag).toBe('Fail');
        // Circuit breaker блокирует выполнение
      }

      expect(getContext).toHaveBeenCalledTimes(1);
      expect(onTransition).not.toHaveBeenCalled();
    });

    it('должен корректно передавать CircuitContext в политику', () => {
      const expectedContext: CircuitContext = {
        state: { _tag: 'Open', openedAt: 123456 },
        failures: 3,
        now: 123500,
      };

      const getContext = vi.fn(() => expectedContext);
      const onTransition = vi.fn();

      let receivedContext: CircuitContext | undefined;

      const testPolicy: CircuitBreakerPolicy = (ctx) => {
        receivedContext = ctx;
        return { _tag: 'Allow' };
      };

      const effect = Effect.succeed('test');
      withCircuitBreakerPolicy(testPolicy, getContext, onTransition)(effect);

      expect(receivedContext).toEqual(expectedContext);
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('должен создавать ошибку с правильным сообщением', () => {
      const error = new CircuitBreakerOpenError();
      expect(error.message).toBe('Circuit breaker is open');
      expect(error.name).toBe('CircuitBreakerOpenError');
    });

    it('должен поддерживать кастомное сообщение', () => {
      const error = new CircuitBreakerOpenError('Custom message');
      expect(error.message).toBe('Custom message');
      expect(error.name).toBe('CircuitBreakerOpenError');
    });
  });

  describe('Готовые политики', () => {
    describe('DEFAULT_CIRCUIT_BREAKER_POLICY', () => {
      it('должен открывать circuit при 5+ failures', () => {
        const ctx1: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 4,
          now: Date.now(),
        };

        const ctx2: CircuitContext = {
          state: { _tag: 'Closed' },
          failures: 5,
          now: Date.now(),
        };

        expect(DEFAULT_CIRCUIT_BREAKER_POLICY(ctx1)._tag).toBe('Allow');

        const result2 = DEFAULT_CIRCUIT_BREAKER_POLICY(ctx2);
        expect(result2._tag).toBe('Transition');
        if (result2._tag === 'Transition') {
          expect(result2.nextState._tag).toBe('Open');
        }
      });

      it('должен переходить в HalfOpen через 30 секунд', () => {
        const openedAt = Date.now() - Duration.toMillis(Duration.seconds(35)); // 35 сек назад

        const ctx: CircuitContext = {
          state: { _tag: 'Open', openedAt },
          failures: 5,
          now: Date.now(),
        };

        const result = DEFAULT_CIRCUIT_BREAKER_POLICY(ctx);
        expect(result._tag).toBe('Transition');
        if (result._tag === 'Transition') {
          expect(result.nextState).toEqual({ _tag: 'HalfOpen' });
        }
      });

      it('должен оставаться открытым если не прошло 30 секунд', () => {
        const openedAt = Date.now() - Duration.toMillis(Duration.seconds(10)); // 10 сек назад

        const ctx: CircuitContext = {
          state: { _tag: 'Open', openedAt },
          failures: 5,
          now: Date.now(),
        };

        expect(DEFAULT_CIRCUIT_BREAKER_POLICY(ctx)).toEqual({ _tag: 'Reject' });
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен реализовывать полный цикл circuit breaker', () => {
      const now = Date.now();
      const policy = DEFAULT_CIRCUIT_BREAKER_POLICY;

      // 1. Closed состояние с failures < 5 - Allow
      const closedCtx = {
        state: { _tag: 'Closed' } as CircuitState,
        failures: 3,
        now,
      };
      expect(policy(closedCtx)._tag).toBe('Allow');

      // 2. Closed состояние с failures >= 5 - Transition to Open
      const shouldOpenCtx = {
        state: { _tag: 'Closed' } as CircuitState,
        failures: 5,
        now,
      };
      const openResult = policy(shouldOpenCtx);
      expect(openResult._tag).toBe('Transition');
      if (openResult._tag === 'Transition') {
        expect(openResult.nextState._tag).toBe('Open');
      }

      // 3. Open состояние без timeout - Reject
      const openCtx = {
        state: { _tag: 'Open', openedAt: now } as CircuitState,
        failures: 5,
        now: now + Duration.toMillis(Duration.seconds(10)), // 10 сек спустя
      };
      expect(policy(openCtx)._tag).toBe('Reject');

      // 4. Open состояние с timeout - Transition to HalfOpen
      const timeoutCtx = {
        state: { _tag: 'Open', openedAt: now } as CircuitState,
        failures: 5,
        now: now + Duration.toMillis(Duration.seconds(35)), // 35 сек спустя
      };
      const halfOpenResult = policy(timeoutCtx);
      expect(halfOpenResult._tag).toBe('Transition');
      if (halfOpenResult._tag === 'Transition') {
        expect(halfOpenResult.nextState).toEqual({ _tag: 'HalfOpen' });
      }
    });

    it('должен корректно работать с withCircuitBreakerPolicy в эффектах', async () => {
      // Тестируем случай с открытым circuit breaker
      const getContext = () => ({
        state: { _tag: 'Open', openedAt: Date.now() - 1000 } as CircuitState,
        failures: 5,
        now: Date.now(),
      });

      const onTransition = vi.fn();
      const policy = DEFAULT_CIRCUIT_BREAKER_POLICY;

      const effect = Effect.succeed('should not execute');
      const protectedEffect = withCircuitBreakerPolicy(policy, getContext, onTransition)(effect);

      // Circuit открыт, вызов должен быть заблокирован
      const exit = await Effect.runPromiseExit(protectedEffect);
      expect(exit._tag).toBe('Failure');
      expect(onTransition).not.toHaveBeenCalled();
    });
  });
});
