/**
 * @file SharedErrorBoundary.test.ts
 * Unit-тесты для SharedErrorBoundary.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { Cause, Duration, Effect, Exit, Option } from 'effect';
import type { SharedErrorBoundaryOptions } from '../../../../src/errors/shared/SharedErrorBoundary.js';
import { withSharedErrorBoundary } from '../../../../src/errors/shared/SharedErrorBoundary.js';
import { DEFAULT_RETRY_POLICY } from '../../../../src/errors/shared/policies/RetryPolicy.js';

// Mock error для тестов
class TestError extends Error {
  constructor(message = 'Test error') {
    super(message);
    this.name = 'TestError';
  }
}

// Normalized error type для тестов
type NormalizedError = {
  message: string;
  code: string;
  category: string;
};

describe('SharedErrorBoundary', () => {
  describe('withSharedErrorBoundary', () => {
    it('должен успешно выполнить effect без ошибок', async () => {
      const effect = Effect.succeed(42);
      const options: SharedErrorBoundaryOptions = {};

      const result = await Effect.runPromise(withSharedErrorBoundary(effect, options));

      expect(result).toBe(42);
    });

    it('должен использовать дефолтные опции при пустой конфигурации', async () => {
      const testError = new TestError('test');
      const effect = Effect.fail(testError);
      const options: SharedErrorBoundaryOptions = {};

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('test');
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SharedErrorBoundary:'),
      );

      consoleSpy.mockRestore();
    });

    it('должен применять нормализацию ошибок', async () => {
      const testError = new TestError('original error');
      const effect = Effect.fail(testError);

      const normalize = vi.fn((error: TestError): NormalizedError => ({
        message: error.message,
        code: 'NORMALIZED',
        category: 'TEST',
      }));

      const options: SharedErrorBoundaryOptions<TestError, NormalizedError> = {
        normalize,
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('original error');
        },
      });
      expect(normalize).toHaveBeenCalledWith(testError);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"original error"'),
      );

      consoleSpy.mockRestore();
    });

    it('должен применять кастомную сериализацию', async () => {
      const testError = new TestError('test');
      const effect = Effect.fail(testError);

      const serialize = vi.fn((error: TestError) => `[SERIALIZED] ${error.message}`);

      const options: SharedErrorBoundaryOptions<TestError, TestError> = {
        serialize,
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('test');
        },
      });
      expect(serialize).toHaveBeenCalledWith(testError);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SERIALIZED] test'),
      );

      consoleSpy.mockRestore();
    });

    it('должен использовать кастомный логгер', async () => {
      const testError = new TestError('test');
      const effect = Effect.fail(testError);

      const logger = vi.fn();
      const options: SharedErrorBoundaryOptions = {
        logger,
      };

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('test');
        },
      });
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('SharedErrorBoundary:'),
      );
    });

    it('должен применять стратегию обработки ошибок', async () => {
      const testError = new TestError('test');
      const effect = Effect.fail(testError);

      const normalizedError: NormalizedError = {
        message: 'normalized',
        code: 'TEST',
        category: 'STRATEGY',
      };

      const normalize = vi.fn(() => normalizedError);
      const strategy = vi.fn(() => ({ _tag: 'Stop' as const }));

      const options: SharedErrorBoundaryOptions<TestError, NormalizedError> = {
        normalize,
        strategy,
      };

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('test');
        },
      });
      expect(strategy).toHaveBeenCalledWith(normalizedError);
    });

    it('должен интегрироваться с retry политикой', async () => {
      const testError = new TestError('retryable error');
      let attemptCount = 0;

      const effect = Effect.gen(function*() {
        attemptCount++;
        if (attemptCount < 3) {
          yield* Effect.fail(testError);
        }
        return `success on attempt ${attemptCount}`;
      });

      const options: SharedErrorBoundaryOptions<TestError> = {
        retryPolicy: DEFAULT_RETRY_POLICY,
        logger: () => {}, // подавляем логи для чистоты теста
      };

      const result = await Effect.runPromise(withSharedErrorBoundary(effect, options));

      expect(result).toBe('success on attempt 3');
      expect(attemptCount).toBe(3);
    });

    it('должен корректно работать с различными типами эффектов', async () => {
      // Effect без ошибок
      const successEffect = Effect.succeed('success');
      const result1 = await Effect.runPromise(withSharedErrorBoundary(successEffect, {}));
      expect(result1).toBe('success');

      // Effect с ошибкой
      const errorEffect = Effect.fail(new TestError('error'));
      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(errorEffect, {}));
      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('error');
        },
      });

      // Effect с void результатом
      const voidEffect = Effect.sync(() => {});
      const result3 = await Effect.runPromise(withSharedErrorBoundary(voidEffect, {}));
      expect(result3).toBeUndefined();
    });

    it('должен корректно типизировать generic параметры', async () => {
      // Проверяем, что типы корректно выводятся
      const effect: Effect.Effect<string, TestError> = Effect.succeed('typed result');

      const options: SharedErrorBoundaryOptions<TestError, NormalizedError> = {
        normalize: (e) => ({ message: e.message, code: 'TYPED', category: 'TEST' }),
        serialize: (n) => `Typed: ${n.message}`,
        strategy: () => ({ _tag: 'Stop' as const }),
        logger: () => {},
      };

      const result = await Effect.runPromise(withSharedErrorBoundary(effect, options));
      expect(result).toBe('typed result');
    });

    it('должен применять стратегию с Retry decision', async () => {
      const testError = new TestError('retry strategy test');
      const effect = Effect.fail(testError);

      const normalize = vi.fn((error: TestError): NormalizedError => ({
        message: error.message,
        code: 'RETRY_STRATEGY',
        category: 'TEST',
      }));

      const strategy = vi.fn(() => ({ _tag: 'Retry' as const, delay: Duration.millis(100) }));

      const options: SharedErrorBoundaryOptions<TestError, NormalizedError> = {
        normalize,
        strategy,
      };

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('retry strategy test');
        },
      });

      expect(strategy).toHaveBeenCalledWith({
        message: 'retry strategy test',
        code: 'RETRY_STRATEGY',
        category: 'TEST',
      });
    });

    it('должен обрабатывать сложные сценарии с полным набором опций', async () => {
      const complexError = new TestError('Complex error scenario');

      const effect = Effect.fail(complexError);

      const normalize = (error: TestError): NormalizedError => ({
        message: `Normalized: ${error.message}`,
        code: 'COMPLEX',
        category: 'INTEGRATION',
      });

      const strategy = (normalized: NormalizedError) => ({
        _tag: 'Stop' as const,
      });

      const serialize = (normalized: NormalizedError) =>
        `ComplexError[${normalized.code}]: ${normalized.message}`;

      const logger = vi.fn();

      const options: SharedErrorBoundaryOptions<TestError, NormalizedError> = {
        normalize,
        strategy,
        serialize,
        logger,
      };

      const exit = await Effect.runPromiseExit(withSharedErrorBoundary(effect, options));

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption);
          expect(error).toBeInstanceOf(TestError);
          expect((error as TestError).message).toBe('Complex error scenario');
        },
      });
      expect(logger).toHaveBeenCalledWith(
        'SharedErrorBoundary: ComplexError[COMPLEX]: Normalized: Complex error scenario',
      );
    });
  });
});
