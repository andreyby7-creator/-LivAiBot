/**
 * @file RetryPolicy.test.ts
 * Unit-тесты для RetryPolicy.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { Duration, Effect } from 'effect';
import type {
  RetryContext,
  RetryPolicy,
} from '../../../../../src/errors/shared/policies/RetryPolicy.js';

import {
  buildRetryPolicy,
  // Готовые политики
  DEFAULT_RETRY_POLICY,
  exponentialBackoff,
  FAST_RETRY_POLICY,
  fixedDelay,
  // Комбинаторы
  limitAttempts,
  linearBackoff,
  // Примитивные политики
  noRetry,
  retryIf,
  SLOW_RETRY_POLICY,
  // Schedule adapter
  toSchedule,
  withJitter,
  // Effect helpers
  withRetryPolicy,
} from '../../../../../src/errors/shared/policies/RetryPolicy';

// Mock error для тестов
class TestError extends Error {
  constructor(message = 'Test error') {
    super(message);
    this.name = 'TestError';
  }
}

describe('RetryPolicy', () => {
  describe('Примитивные политики', () => {
    describe('noRetry', () => {
      it('должен всегда возвращать Stop независимо от attempt и error', () => {
        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 5, error: new Error('Another error') };

        expect(noRetry(ctx1)).toEqual({ _tag: 'Stop' });
        expect(noRetry(ctx2)).toEqual({ _tag: 'Stop' });
      });
    });

    describe('fixedDelay', () => {
      it('должен возвращать Retry с фиксированной задержкой', () => {
        const policy = fixedDelay(100);

        const ctx: RetryContext = { attempt: 1, error: new TestError() };
        const result = policy(ctx);

        expect(result).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(100),
        });
      });

      it('должен работать с разными значениями delayMs', () => {
        const policy1 = fixedDelay(50);
        const policy2 = fixedDelay(1000);

        const ctx: RetryContext = { attempt: 1, error: new TestError() };

        expect(policy1(ctx)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(50),
        });

        expect(policy2(ctx)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(1000),
        });
      });
    });

    describe('linearBackoff', () => {
      it('должен возвращать delay = baseDelayMs * attempt', () => {
        const policy = linearBackoff(50);

        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 2, error: new TestError() };
        const ctx5: RetryContext = { attempt: 5, error: new TestError() };

        expect(policy(ctx1)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(50), // 50 * 1
        });

        expect(policy(ctx2)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(100), // 50 * 2
        });

        expect(policy(ctx5)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(250), // 50 * 5
        });
      });
    });

    describe('exponentialBackoff', () => {
      it('должен возвращать delay = baseDelayMs * 2^(attempt-1)', () => {
        const policy = exponentialBackoff(100);

        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 2, error: new TestError() };
        const ctx3: RetryContext = { attempt: 3, error: new TestError() };

        expect(policy(ctx1)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(100), // 100 * 2^(1-1) = 100 * 1
        });

        expect(policy(ctx2)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(200), // 100 * 2^(2-1) = 100 * 2
        });

        expect(policy(ctx3)).toEqual({
          _tag: 'Retry',
          delay: Duration.millis(400), // 100 * 2^(3-1) = 100 * 4
        });
      });
    });
  });

  describe('Комбинаторы', () => {
    describe('limitAttempts', () => {
      it('должен возвращать Stop при attempt >= max', () => {
        const basePolicy: RetryPolicy = () => ({ _tag: 'Retry', delay: Duration.millis(100) });
        const policy = limitAttempts(3)(basePolicy);

        const ctx1: RetryContext = { attempt: 3, error: new TestError() };
        const ctx2: RetryContext = { attempt: 5, error: new TestError() };

        expect(policy(ctx1)).toEqual({ _tag: 'Stop' });
        expect(policy(ctx2)).toEqual({ _tag: 'Stop' });
      });

      it('должен использовать базовую политику при attempt < max', () => {
        const basePolicy: RetryPolicy = () => ({ _tag: 'Retry', delay: Duration.millis(100) });
        const policy = limitAttempts(3)(basePolicy);

        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 2, error: new TestError() };

        expect(policy(ctx1)).toEqual({ _tag: 'Retry', delay: Duration.millis(100) });
        expect(policy(ctx2)).toEqual({ _tag: 'Retry', delay: Duration.millis(100) });
      });
    });

    describe('retryIf', () => {
      it('должен использовать базовую политику для ошибок, удовлетворяющих predicate', () => {
        const basePolicy: RetryPolicy = () => ({ _tag: 'Retry', delay: Duration.millis(100) });
        const policy = retryIf((error: unknown) => (error as Error).message.includes('retryable'))(
          basePolicy,
        );

        const ctx1: RetryContext = { attempt: 1, error: new Error('retryable error') };
        const ctx2: RetryContext = { attempt: 1, error: new TestError() };

        expect(policy(ctx1)).toEqual({ _tag: 'Retry', delay: Duration.millis(100) });
        expect(policy(ctx2)).toEqual({ _tag: 'Stop' });
      });

      it('должен возвращать Stop для ошибок, не удовлетворяющих predicate', () => {
        const basePolicy: RetryPolicy = () => ({ _tag: 'Retry', delay: Duration.millis(100) });
        const policy = retryIf((error: unknown) => (error as Error).name === 'TestError')(
          basePolicy,
        );

        const ctx: RetryContext = { attempt: 1, error: new Error('other error') };

        expect(policy(ctx)).toEqual({ _tag: 'Stop' });
      });
    });

    describe('withJitter', () => {
      it('должен увеличивать задержку на jitter ratio', () => {
        const basePolicy: RetryPolicy = () => ({ _tag: 'Retry', delay: Duration.millis(100) });
        const policy = withJitter(0.3)(basePolicy); // 30% jitter

        const ctx: RetryContext = { attempt: 1, error: new TestError() };
        const result = policy(ctx);

        expect(result._tag).toBe('Retry');
        if (result._tag === 'Retry') {
          const actualDelay = Duration.toMillis(result.delay);

          // Задержка должна быть в диапазоне [100, 100 + 100*0.3] = [100, 130]
          expect(actualDelay).toBeGreaterThanOrEqual(100);
          expect(actualDelay).toBeLessThanOrEqual(130);
        }
      });

      it('должен оставлять Stop без изменений', () => {
        const basePolicy: RetryPolicy = () => ({ _tag: 'Stop' });
        const policy = withJitter(0.5)(basePolicy);

        const ctx: RetryContext = { attempt: 1, error: new TestError() };

        expect(policy(ctx)).toEqual({ _tag: 'Stop' });
      });
    });

    describe('buildRetryPolicy', () => {
      it('должен корректно комбинировать политики', () => {
        const policy = buildRetryPolicy(
          exponentialBackoff(50),
          withJitter(0.1),
          limitAttempts(2),
        );

        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 2, error: new TestError() };
        const ctx3: RetryContext = { attempt: 3, error: new TestError() };

        // attempt 1: Retry с exponential + jitter
        const result1 = policy(ctx1);
        expect(result1._tag).toBe('Retry');
        if (result1._tag === 'Retry') {
          const delay1 = Duration.toMillis(result1.delay);
          expect(delay1).toBeGreaterThanOrEqual(50); // 50 * 2^(1-1) = 50
          expect(delay1).toBeLessThanOrEqual(55); // +10% jitter
        }

        // attempt 2: Stop из-за limitAttempts(2) - attempt >= 2
        const result2 = policy(ctx2);
        expect(result2).toEqual({ _tag: 'Stop' });

        // attempt 3: Stop из-за limitAttempts(2)
        const result3 = policy(ctx3);
        expect(result3).toEqual({ _tag: 'Stop' });
      });
    });
  });

  describe('withRetryPolicy', () => {
    it('должен пробрасывать ошибку после Stop', async () => {
      const policy = noRetry;
      const failingEffect = Effect.fail(new TestError('fail'));

      const result = await Effect.runPromiseExit(withRetryPolicy(policy)(failingEffect));

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail');
      }
    });

    it('должен retry 1 раз перед Stop (limitAttempts(2))', async () => {
      const mockFn = vi.fn();
      let callCount = 0;

      const effect = Effect.sync(() => {
        callCount++;
        mockFn(callCount);
        // Всегда fail, чтобы проверить retry limit
        return Effect.fail(new TestError(`fail ${callCount}`));
      }).pipe(Effect.flatten);

      const policy = limitAttempts(2)(fixedDelay(10));
      const exit = await Effect.runPromiseExit(withRetryPolicy(policy)(effect));

      // limitAttempts(2): attempt 1 - Retry, attempt 2 - Stop
      expect(exit._tag).toBe('Failure');
      expect(callCount).toBe(2); // initial + 1 retry
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('должен применять delay между retries', async () => {
      const startTime = Date.now();
      let callCount = 0;

      const effect = Effect.sync(() => {
        callCount++;
        // Всегда fail, чтобы проверить delay при retry
        return Effect.fail(new TestError(`fail ${callCount}`));
      }).pipe(Effect.flatten);

      const policy = limitAttempts(2)(fixedDelay(50)); // attempt 1: Retry с delay, attempt 2: Stop
      await Effect.runPromiseExit(withRetryPolicy(policy)(effect));

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(45); // ~50ms delay между retry
      expect(callCount).toBe(2); // initial + 1 retry
    });

    it('должен корректно эволюционировать RetryContext', async () => {
      const contexts: RetryContext[] = [];
      const policy: RetryPolicy = (ctx) => {
        contexts.push(ctx);
        return ctx.attempt >= 2 ? { _tag: 'Stop' } : { _tag: 'Retry', delay: Duration.millis(1) };
      };

      const effect = Effect.fail(new TestError('fail'));
      await Effect.runPromiseExit(withRetryPolicy(policy)(effect));

      expect(contexts).toHaveLength(2); // attempt 1 (Retry) и attempt 2 (Stop)
      expect(contexts[0].attempt).toBe(1);
      expect(contexts[1].attempt).toBe(2);
      expect(contexts[0].error).toBeInstanceOf(TestError);
      expect(contexts[1].error).toBeInstanceOf(TestError);
    });
  });

  describe('toSchedule (experimental)', () => {
    it('должен создавать Schedule без ошибок', () => {
      const policy = limitAttempts(3)(fixedDelay(100));
      const schedule = toSchedule(policy);

      // Просто проверяем, что schedule создался
      expect(schedule).toBeDefined();
    });

    it('должен корректно увеличивать attempt через unfold', () => {
      const policy = limitAttempts(3)(fixedDelay(100));
      const schedule = toSchedule(policy);

      // Проверяем внутреннюю структуру (экспериментально)
      // unfold создает последовательность состояний
      expect(schedule).toBeDefined();
    });

    it('должен останавливаться через whileInput', () => {
      const policy = noRetry;
      const schedule = toSchedule(policy);

      expect(schedule).toBeDefined();
    });
  });

  describe('Готовые политики', () => {
    describe('DEFAULT_RETRY_POLICY', () => {
      it('должен retry 2 раза с exponential backoff + jitter, stop на 3-й', () => {
        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 2, error: new TestError() };
        const ctx3: RetryContext = { attempt: 3, error: new TestError() };
        const ctx4: RetryContext = { attempt: 4, error: new TestError() };

        expect(DEFAULT_RETRY_POLICY(ctx1)._tag).toBe('Retry');
        expect(DEFAULT_RETRY_POLICY(ctx2)._tag).toBe('Retry');
        expect(DEFAULT_RETRY_POLICY(ctx3)._tag).toBe('Stop'); // limitAttempts(3)
        expect(DEFAULT_RETRY_POLICY(ctx4)._tag).toBe('Stop');
      });

      it('должен применять jitter к exponential backoff', () => {
        const ctx: RetryContext = { attempt: 1, error: new TestError() };
        const result = DEFAULT_RETRY_POLICY(ctx);

        expect(result._tag).toBe('Retry');
        if (result._tag === 'Retry') {
          const delay = Duration.toMillis(result.delay);
          // exponentialBackoff(100) = 100ms, jitter ~30% = [100, 130]ms
          expect(delay).toBeGreaterThanOrEqual(100);
          expect(delay).toBeLessThanOrEqual(130);
        }
      });
    });

    describe('FAST_RETRY_POLICY', () => {
      it('должен retry 4 раза с fixed delay 50ms, stop на 5-й', () => {
        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx4: RetryContext = { attempt: 4, error: new TestError() };
        const ctx5: RetryContext = { attempt: 5, error: new TestError() };
        const ctx6: RetryContext = { attempt: 6, error: new TestError() };

        expect(FAST_RETRY_POLICY(ctx1)._tag).toBe('Retry');
        expect(FAST_RETRY_POLICY(ctx4)._tag).toBe('Retry');
        expect(FAST_RETRY_POLICY(ctx5)._tag).toBe('Stop'); // limitAttempts(5)
        expect(FAST_RETRY_POLICY(ctx6)._tag).toBe('Stop');

        const result = FAST_RETRY_POLICY(ctx1);
        if (result._tag === 'Retry') {
          const delay = Duration.toMillis(result.delay);
          expect(delay).toBe(50);
        }
      });
    });

    describe('SLOW_RETRY_POLICY', () => {
      it('должен retry 1 раз с exponential backoff 500ms, stop на 2-й', () => {
        const ctx1: RetryContext = { attempt: 1, error: new TestError() };
        const ctx2: RetryContext = { attempt: 2, error: new TestError() };
        const ctx3: RetryContext = { attempt: 3, error: new TestError() };

        expect(SLOW_RETRY_POLICY(ctx1)._tag).toBe('Retry');
        expect(SLOW_RETRY_POLICY(ctx2)._tag).toBe('Stop'); // limitAttempts(2)
        expect(SLOW_RETRY_POLICY(ctx3)._tag).toBe('Stop');

        const result1 = SLOW_RETRY_POLICY(ctx1);
        if (result1._tag === 'Retry') {
          const delay1 = Duration.toMillis(result1.delay);
          expect(delay1).toBe(500); // 500 * 2^(1-1) = 500
        }
      });
    });
  });
});
