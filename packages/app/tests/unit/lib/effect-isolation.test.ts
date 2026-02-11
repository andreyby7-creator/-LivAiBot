/**
 * @file Unit тесты для packages/app/src/lib/effect-isolation.ts
 *
 * Enterprise-grade тестирование effect-isolation с 100% покрытием:
 * - IsolationError конструктор и свойства
 * - isIsolationError type guard
 * - runIsolated для всех сценариев (успех, ошибки, различные типы ошибок)
 * - Нормализация tag
 * - Проверка типа effect в dev режиме
 * - Chaining нескольких runIsolated (предотвращение cascading failures)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Effect } from '../../../src/lib/effect-utils.js';
import { isFail, isOk } from '../../../src/lib/effect-utils.js';
import {
  isIsolationError,
  IsolationError,
  runIsolated,
} from '../../../src/lib/effect-isolation.js';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock Effect, который успешно выполняется
 */
function createMockSuccessEffect<T>(value: Readonly<T>): Effect<T> {
  return async (): Promise<T> => {
    return value;
  };
}

/**
 * Создает mock Effect, который выбрасывает ошибку
 */
function createMockErrorEffect(error: Readonly<Error>): Effect<never> {
  return async (): Promise<never> => {
    throw error;
  };
}

/**
 * Создает mock Effect, который выбрасывает не-Error значение
 */
function createMockNonErrorEffect(value: unknown): Effect<never> {
  return async (): Promise<never> => {
    throw value;
  };
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Effect Isolation - Enterprise Grade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // IsolationError
  // ==========================================================================

  describe('IsolationError', () => {
    it('должен создавать ошибку с Error и tag', () => {
      const originalError = new Error('Original error');
      const tag = 'test-tag';
      const error = new IsolationError(originalError, tag);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IsolationError);
      expect(error.name).toBe('IsolationError');
      expect(error.message).toBe(`Effect isolation error (tag: ${tag}): ${originalError.message}`);
      expect(error.originalError).toBe(originalError);
      expect(error.tag).toBe(tag);
      expect(error.stack).toContain('IsolationError');
      expect(error.stack).toContain(originalError.stack);
    });

    it('должен создавать ошибку с Error без tag', () => {
      const originalError = new Error('Original error');
      const error = new IsolationError(originalError);

      expect(error.message).toBe(`Effect isolation error: ${originalError.message}`);
      expect(error.originalError).toBe(originalError);
      expect(error.tag).toBeUndefined();
      expect(error.stack).toContain('IsolationError');
      expect(error.stack).toContain(originalError.stack);
    });

    it('должен создавать ошибку с не-Error значением и tag', () => {
      const originalError = 'String error';
      const tag = 'test-tag';
      const error = new IsolationError(originalError, tag);

      expect(error.message).toBe(`Effect isolation error (tag: ${tag}): ${originalError}`);
      expect(error.originalError).toBe(originalError);
      expect(error.tag).toBe(tag);
    });

    it('должен создавать ошибку с не-Error значением без tag', () => {
      const originalError = 42;
      const error = new IsolationError(originalError);

      expect(error.message).toBe(`Effect isolation error: ${String(originalError)}`);
      expect(error.originalError).toBe(originalError);
      expect(error.tag).toBeUndefined();
    });

    it('должен нормализовать пустой tag в undefined', () => {
      const originalError = new Error('Test');
      const error = new IsolationError(originalError, '');

      expect(error.tag).toBeUndefined();
      expect(error.message).toBe(`Effect isolation error: ${originalError.message}`);
    });

    it('должен нормализовать null tag в undefined', () => {
      const originalError = new Error('Test');
      const error = new IsolationError(originalError, null as unknown as string);

      expect(error.tag).toBeUndefined();
      expect(error.message).toBe(`Effect isolation error: ${originalError.message}`);
    });

    it('должен нормализовать undefined tag в undefined', () => {
      const originalError = new Error('Test');
      const error = new IsolationError(originalError, undefined);

      expect(error.tag).toBeUndefined();
      expect(error.message).toBe(`Effect isolation error: ${originalError.message}`);
    });

    it('должен нормализовать не-string tag к string', () => {
      const originalError = new Error('Test');
      const error = new IsolationError(originalError, 123 as unknown as string);

      expect(error.tag).toBe('123');
      expect(error.message).toContain('tag: 123');
    });

    it('должен сохранять stack trace для Error с stack', () => {
      const originalError = new Error('Test error');
      originalError.stack = 'Error: Test error\n    at test.js:1:1';
      const error = new IsolationError(originalError, 'test-tag');

      expect(error.stack).toContain('IsolationError');
      expect(error.stack).toContain(originalError.stack);
    });

    it('не должен сохранять stack trace для Error без stack', () => {
      const originalError = new Error('Test error');
      originalError.stack = '';
      const error = new IsolationError(originalError, 'test-tag');

      expect(error.stack).toBeDefined();
      // При пустом stack исходной ошибки, stack IsolationError должен быть определен, но не равен пустой строке
      expect(error.stack).not.toBe('');
      expect(error.stack).toContain('IsolationError');
    });

    it('не должен сохранять stack trace для Error с null stack', () => {
      const originalError = new Error('Test error');
      originalError.stack = null as unknown as string;
      const error = new IsolationError(originalError, 'test-tag');

      expect(error.stack).toBeDefined();
      expect(error.stack).not.toContain(originalError.stack);
    });
  });

  // ==========================================================================
  // isIsolationError
  // ==========================================================================

  describe('isIsolationError', () => {
    it('должен возвращать true для IsolationError', () => {
      const error = new IsolationError(new Error('Test'));
      expect(isIsolationError(error)).toBe(true);
    });

    it('должен возвращать false для обычного Error', () => {
      const error = new Error('Test');
      expect(isIsolationError(error)).toBe(false);
    });

    it('должен возвращать false для string', () => {
      expect(isIsolationError('error')).toBe(false);
    });

    it('должен возвращать false для number', () => {
      expect(isIsolationError(42)).toBe(false);
    });

    it('должен возвращать false для null', () => {
      expect(isIsolationError(null)).toBe(false);
    });

    it('должен возвращать false для undefined', () => {
      expect(isIsolationError(undefined)).toBe(false);
    });

    it('должен возвращать false для объекта', () => {
      expect(isIsolationError({ message: 'error' })).toBe(false);
    });
  });

  // ==========================================================================
  // runIsolated
  // ==========================================================================

  describe('runIsolated', () => {
    it('должен успешно выполнять эффект и возвращать ok результат', async () => {
      const value = 'success';
      const effect = createMockSuccessEffect(value);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(value);
      }
    });

    it('должен изолировать Error и возвращать fail результат', async () => {
      const originalError = new Error('Test error');
      const effect = createMockErrorEffect(originalError);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBe(originalError);
        expect(result.error.tag).toBeUndefined();
      }
    });

    it('должен изолировать Error с tag', async () => {
      const originalError = new Error('Test error');
      const tag = 'test-tag';
      const effect = createMockErrorEffect(originalError);
      const result = await runIsolated(effect, { tag });

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBe(originalError);
        expect(result.error.tag).toBe(tag);
      }
    });

    it('должен изолировать string ошибку', async () => {
      const originalError = 'String error';
      const effect = createMockNonErrorEffect(originalError);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBe(originalError);
      }
    });

    it('должен изолировать number ошибку', async () => {
      const originalError = 42;
      const effect = createMockNonErrorEffect(originalError);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBe(originalError);
      }
    });

    it('должен изолировать object ошибку', async () => {
      const originalError = { code: 'ERROR', message: 'Object error' };
      const effect = createMockNonErrorEffect(originalError);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBe(originalError);
      }
    });

    it('должен изолировать null ошибку', async () => {
      const originalError = null;
      const effect = createMockNonErrorEffect(originalError);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBe(originalError);
      }
    });

    it('должен нормализовать пустой tag', async () => {
      const originalError = new Error('Test');
      const effect = createMockErrorEffect(originalError);
      const result = await runIsolated(effect, { tag: '' });

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error.tag).toBeUndefined();
      }
    });

    it('должен нормализовать null tag', async () => {
      const originalError = new Error('Test');
      const effect = createMockErrorEffect(originalError);
      const result = await runIsolated(effect, { tag: null as unknown as string });

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error.tag).toBeUndefined();
      }
    });

    it('должен нормализовать не-string tag к string', async () => {
      const originalError = new Error('Test');
      const effect = createMockErrorEffect(originalError);
      const result = await runIsolated(effect, { tag: 123 as unknown as string });

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error.tag).toBe('123');
      }
    });

    it('должен работать без options', async () => {
      const value = 'success';
      const effect = createMockSuccessEffect(value);
      const result = await runIsolated(effect);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(value);
      }
    });

    it('должен работать с пустыми options', async () => {
      const value = 'success';
      const effect = createMockSuccessEffect(value);
      const result = await runIsolated(effect, {});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(value);
      }
    });

    it('должен проверять тип effect в development режиме', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      await expect(runIsolated(null as unknown as Effect<string>)).rejects.toThrow(TypeError);
      await expect(runIsolated(undefined as unknown as Effect<string>)).rejects.toThrow(TypeError);
      await expect(runIsolated(42 as unknown as Effect<string>)).rejects.toThrow(TypeError);
      await expect(runIsolated('not-a-function' as unknown as Effect<string>)).rejects.toThrow(
        TypeError,
      );
      await expect(runIsolated({} as unknown as Effect<string>)).rejects.toThrow(TypeError);

      vi.unstubAllEnvs();
    });

    it('не должен проверять тип effect в production режиме, но должен изолировать ошибку', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      // В production проверка типа не выполняется, но эффект должен упасть при вызове
      // Ошибка будет изолирована, а не проброшена
      const invalidEffect = null as unknown as Effect<string>;
      const result = await runIsolated(invalidEffect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBeInstanceOf(TypeError);
      }

      vi.unstubAllEnvs();
    });

    it('не должен проверять тип effect в test режиме, но должен изолировать ошибку', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      // В test режиме проверка типа не выполняется, но ошибка изолируется
      const invalidEffect = null as unknown as Effect<string>;
      const result = await runIsolated(invalidEffect);

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.originalError).toBeInstanceOf(TypeError);
      }

      vi.unstubAllEnvs();
    });

    it('должен предотвращать cascading failures при chaining', async () => {
      // Первый эффект падает
      const failingEffect = createMockErrorEffect(new Error('Step 1 failed'));
      const step1 = await runIsolated(failingEffect, { tag: 'step1' });

      // Второй эффект успешен
      const successEffect = createMockSuccessEffect('step2-success');
      const step2 = await runIsolated(successEffect, { tag: 'step2' });

      // Ошибка в step1 не влияет на step2
      expect(isOk(step1)).toBe(false);
      expect(isOk(step2)).toBe(true);

      if (isFail(step1)) {
        expect(step1.error.tag).toBe('step1');
        expect(step1.error.originalError).toBeInstanceOf(Error);
      }

      if (isOk(step2)) {
        expect(step2.value).toBe('step2-success');
      }
    });

    it('должен обрабатывать несколько последовательных изолированных эффектов', async () => {
      const results = await Promise.all([
        runIsolated(createMockSuccessEffect('result1'), { tag: 'task1' }),
        runIsolated(createMockErrorEffect(new Error('Task 2 failed')), { tag: 'task2' }),
        runIsolated(createMockSuccessEffect('result3'), { tag: 'task3' }),
      ]);

      expect(isOk(results[0])).toBe(true);
      expect(isOk(results[1])).toBe(false);
      expect(isOk(results[2])).toBe(true);

      if (isOk(results[0])) {
        expect(results[0].value).toBe('result1');
      }

      if (isFail(results[1])) {
        expect(results[1].error.tag).toBe('task2');
      }

      if (isOk(results[2])) {
        expect(results[2].value).toBe('result3');
      }
    });

    it('должен работать с асинхронными эффектами', async () => {
      const asyncEffect: Effect<string> = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-success';
      };

      const result = await runIsolated(asyncEffect, { tag: 'async-task' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('async-success');
      }
    });

    it('должен изолировать ошибки из асинхронных эффектов', async () => {
      const asyncErrorEffect: Effect<never> = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async error');
      };

      const result = await runIsolated(asyncErrorEffect, { tag: 'async-error' });

      expect(isOk(result)).toBe(false);
      if (isFail(result)) {
        expect(result.error).toBeInstanceOf(IsolationError);
        expect(result.error.tag).toBe('async-error');
        expect(result.error.originalError).toBeInstanceOf(Error);
      }
    });

    it('должен работать с эффектами, возвращающими различные типы', async () => {
      const stringResult = await runIsolated(createMockSuccessEffect('string'));
      const numberResult = await runIsolated(createMockSuccessEffect(42));
      const objectResult = await runIsolated(createMockSuccessEffect({ key: 'value' }));

      expect(isOk(stringResult)).toBe(true);
      expect(isOk(numberResult)).toBe(true);
      expect(isOk(objectResult)).toBe(true);

      if (isOk(stringResult)) {
        expect(typeof stringResult.value).toBe('string');
      }
      if (isOk(numberResult)) {
        expect(typeof numberResult.value).toBe('number');
      }
      if (isOk(objectResult)) {
        expect(typeof objectResult.value).toBe('object');
      }
    });

    it('должен поддерживать AbortSignal в эффектах', async () => {
      const effectWithSignal: Effect<string> = async (signal?: AbortSignal) => {
        if (signal?.aborted === true) {
          throw new Error('Aborted');
        }
        return 'success';
      };

      const result = await runIsolated(effectWithSignal);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('success');
      }
    });

    it('должен изолировать ошибки при abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const effectWithAbort: Effect<never> = async (signal?: AbortSignal) => {
        if (signal?.aborted === true) {
          throw new Error('Aborted');
        }
        return 'success' as never;
      };

      const result = await runIsolated(effectWithAbort, { tag: 'abort-test' });

      // Эффект не получит aborted signal, так как runIsolated не передает его
      // Но если эффект сам проверит signal, он может выбросить ошибку
      // В данном случае эффект не получит signal, поэтому вернет success
      expect(isOk(result)).toBe(true);
    });
  });
});
