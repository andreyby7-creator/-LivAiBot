/**
 * @file Unit тесты для packages/app/src/lib/effect-timeout.ts
 *
 * Enterprise-grade тестирование effect-timeout с 100% покрытием:
 * - TimeoutError конструктор и свойства
 * - isTimeoutError type guard
 * - validateTimeoutMs с min/max bounds и логированием
 * - withTimeout для всех сценариев (успех, timeout, abort, ошибки)
 * - combineAbortSignals через withTimeout
 * - createTimeoutContext с различными параметрами
 * - AbortSignal propagation и cleanup
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Effect, EffectContext } from '../../../src/lib/effect-utils.js';
import {
  createTimeoutContext,
  isTimeoutError,
  TimeoutError,
  validateTimeoutMs,
  withTimeout,
} from '../../../src/lib/effect-timeout.js';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock Effect, который успешно выполняется
 */
function createMockSuccessEffect<T>(
  value: Readonly<T>,
  delayMs: number = 0,
): Effect<T> {
  return async (signal?: AbortSignal): Promise<T> => {
    if (delayMs > 0) {
      const checkInterval = 10;
      const steps = Math.ceil(delayMs / checkInterval);

      for (let i = 0; i < steps; i++) {
        if (signal?.aborted === true) {
          throw new Error('Effect aborted');
        }
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }

      if (signal?.aborted === true) {
        throw new Error('Effect aborted');
      }
    }
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
 * Создает mock Effect, который проверяет AbortSignal во время выполнения
 */
function createMockAbortableEffect<T>(
  value: Readonly<T>,
  delayMs: number = 50,
): Effect<T> {
  return async (signal?: AbortSignal): Promise<T> => {
    // Проверяем signal периодически во время выполнения
    const checkInterval = 10;
    const steps = Math.ceil(delayMs / checkInterval);

    for (let i = 0; i < steps; i++) {
      if (signal?.aborted === true) {
        throw new Error('Effect aborted');
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    if (signal?.aborted === true) {
      throw new Error('Effect aborted');
    }

    return value;
  };
}

/**
 * Создает mock EffectContext
 */
function createMockEffectContext(
  overrides: Readonly<Partial<EffectContext>> = {},
): EffectContext {
  return {
    traceId: 'test-trace-id',
    locale: 'en',
    ...overrides,
  };
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Effect Timeout - Enterprise Grade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TimeoutError', () => {
    it('должен создавать ошибку без tag', () => {
      const error = new TimeoutError(5000);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Effect execution timeout: 5000ms');
      expect(error.timeoutMs).toBe(5000);
      expect(error.tag).toBeUndefined();
    });

    it('должен создавать ошибку с tag', () => {
      const error = new TimeoutError(3000, 'login');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Effect execution timeout: 3000ms (tag: login)');
      expect(error.timeoutMs).toBe(3000);
      expect(error.tag).toBe('login');
    });
  });

  describe('isTimeoutError', () => {
    it('должен возвращать true для TimeoutError', () => {
      const error = new TimeoutError(1000);
      expect(isTimeoutError(error)).toBe(true);
    });

    it('должен возвращать false для обычной Error', () => {
      const error = new Error('Test error');
      expect(isTimeoutError(error)).toBe(false);
    });

    it('должен возвращать false для других типов', () => {
      expect(isTimeoutError('string')).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError(123)).toBe(false);
      expect(isTimeoutError({})).toBe(false);
    });
  });

  describe('validateTimeoutMs', () => {
    it('должен возвращать значение в допустимых пределах', () => {
      expect(validateTimeoutMs(5000)).toBe(5000);
      expect(validateTimeoutMs(100)).toBe(100);
      expect(validateTimeoutMs(300000)).toBe(300000);
    });

    it('должен корректировать значение меньше минимума', () => {
      expect(validateTimeoutMs(50)).toBe(100); // DEFAULT_MIN_TIMEOUT_MS
      expect(validateTimeoutMs(0)).toBe(100);
      expect(validateTimeoutMs(-100)).toBe(100);
    });

    it('должен корректировать значение больше максимума', () => {
      expect(validateTimeoutMs(500000)).toBe(300000); // DEFAULT_MAX_TIMEOUT_MS
      expect(validateTimeoutMs(1000000)).toBe(300000);
    });

    it('должен использовать кастомные min/max bounds', () => {
      expect(validateTimeoutMs(50, 200, 1000)).toBe(200);
      expect(validateTimeoutMs(2000, 200, 1000)).toBe(1000);
      expect(validateTimeoutMs(500, 200, 1000)).toBe(500);
    });

    it('должен логировать предупреждение в development при значении меньше минимума', () => {
      vi.stubEnv('NODE_ENV', 'development');
      // Восстанавливаем оригинальный console.warn для проверки вызова
      vi.restoreAllMocks();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateTimeoutMs(50);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[effect-timeout] Timeout 50ms is less than minimum 100ms, using 100ms',
      );

      consoleWarnSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it('не должен логировать в test окружении', () => {
      vi.stubEnv('NODE_ENV', 'test');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateTimeoutMs(50);

      // В test окружении не должно быть логирования
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it('должен логировать предупреждение в development при значении больше максимума', () => {
      vi.stubEnv('NODE_ENV', 'development');
      // Восстанавливаем оригинальный console.warn для проверки вызова
      vi.restoreAllMocks();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateTimeoutMs(500000);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[effect-timeout] Timeout 500000ms exceeds maximum 300000ms, using 300000ms',
      );

      consoleWarnSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it('не должен логировать в production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      // Восстанавливаем оригинальный console.warn для проверки вызова
      vi.restoreAllMocks();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateTimeoutMs(50);
      validateTimeoutMs(500000);

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      vi.unstubAllEnvs();
    });
  });

  describe('withTimeout', () => {
    it('должен успешно выполнять effect до timeout', async () => {
      const effect = createMockSuccessEffect('success', 10);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 100 });

      const result = await timeoutEffect();

      expect(result).toBe('success');
    });

    it('должен выбрасывать TimeoutError при превышении timeout', async () => {
      const effect = createMockSuccessEffect('success', 300);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 100 });

      const error = await timeoutEffect().catch((e) => e);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.message).toContain('Effect execution timeout: 100ms');
    });

    it('должен выбрасывать TimeoutError с tag при превышении timeout', async () => {
      const effect = createMockSuccessEffect('success', 300);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 100, tag: 'login' });

      const error = await timeoutEffect().catch((e) => e);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.tag).toBe('login');
      expect(error.message).toContain('tag: login');
    });

    it('должен использовать валидированный timeout (корректировка min)', async () => {
      // Проверяем, что validateTimeoutMs корректирует значение
      // timeout 50ms будет скорректирован до 100ms (DEFAULT_MIN_TIMEOUT_MS)
      // effect с задержкой 300ms должен превысить timeout 100ms
      const effect = createMockSuccessEffect('success', 300);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 50 }); // будет скорректирован до 100

      const error = await timeoutEffect().catch((e) => e);
      expect(error).toBeInstanceOf(TimeoutError);
      // Проверяем, что использован валидированный timeout (100ms, а не 50ms)
      expect(error.timeoutMs).toBe(100);
    });

    it('должен использовать валидированный timeout (корректировка max)', async () => {
      const effect = createMockSuccessEffect('success', 10);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 500000 }); // будет скорректирован до 300000

      // Timeout будет 300000ms, effect выполнится за 10ms, поэтому успех
      const result = await timeoutEffect();
      expect(result).toBe('success');
    });

    it('должен пробрасывать другие ошибки (не timeout)', async () => {
      const originalError = new Error('Custom error');
      const effect = createMockErrorEffect(originalError);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 1000 });

      await expect(timeoutEffect()).rejects.toThrow('Custom error');
      await expect(timeoutEffect()).rejects.toThrow(Error);
      await expect(timeoutEffect()).rejects.not.toThrow(TimeoutError);
    });

    it('должен очищать timeout при успешном выполнении', async () => {
      const effect = createMockSuccessEffect('success', 10);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 100 });

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await timeoutEffect();

      // Даём время на выполнение finally
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('должен очищать timeout при ошибке', async () => {
      const originalError = new Error('Custom error');
      const effect = createMockErrorEffect(originalError);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 1000 });

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      try {
        await timeoutEffect();
      } catch {
        // Ожидаем ошибку
      }

      // Даём время на выполнение finally
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('должен очищать timeout при timeout', async () => {
      const effect = createMockSuccessEffect('success', 200);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 50 });

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      try {
        await timeoutEffect();
      } catch {
        // Ожидаем ошибку
      }

      // Даём время на выполнение finally
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('должен передавать AbortSignal в effect', async () => {
      const effect = createMockAbortableEffect('success');
      const timeoutEffect = withTimeout(effect, { timeoutMs: 100 });

      const result = await timeoutEffect();

      expect(result).toBe('success');
    });

    it('должен объединять внешний AbortSignal с timeout signal', async () => {
      const externalController = new AbortController();
      const effect = createMockAbortableEffect('success', 200);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 1000 });

      // Выполняем с внешним signal
      const promise = timeoutEffect(externalController.signal);

      // Abort внешний signal
      externalController.abort();

      // Effect должен быть отменён через объединённый signal
      await expect(promise).rejects.toThrow('Effect aborted');
    });

    it('должен работать без внешнего AbortSignal', async () => {
      const effect = createMockSuccessEffect('success', 10);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 100 });

      const result = await timeoutEffect();

      expect(result).toBe('success');
    });

    it('должен обрабатывать уже aborted внешний signal', async () => {
      const externalController = new AbortController();
      externalController.abort();

      const effect = createMockAbortableEffect('success');
      const timeoutEffect = withTimeout(effect, { timeoutMs: 1000 });

      await expect(timeoutEffect(externalController.signal)).rejects.toThrow();
    });

    it('должен корректно обрабатывать быстрый effect с большим timeout', async () => {
      const effect = createMockSuccessEffect('fast', 5);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 10000 });

      const result = await timeoutEffect();

      expect(result).toBe('fast');
    });
  });

  describe('combineAbortSignals (через withTimeout)', () => {
    it('должен объединять внешний signal с timeout signal', async () => {
      const externalController = new AbortController();
      const effect = createMockAbortableEffect('success', 200);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 1000 });

      const promise = timeoutEffect(externalController.signal);

      // Abort внешний signal
      externalController.abort();

      // Effect должен быть отменён через объединённый signal
      await expect(promise).rejects.toThrow('Effect aborted');
    });

    it('должен обрабатывать уже aborted сигналы', async () => {
      const controller = new AbortController();
      controller.abort();

      const effect = createMockAbortableEffect('success', 200);
      const timeoutEffect = withTimeout(effect, { timeoutMs: 1000 });

      await expect(timeoutEffect(controller.signal)).rejects.toThrow('Effect aborted');
    });
  });

  describe('createTimeoutContext', () => {
    it('должен создавать контекст без baseContext', () => {
      const context = createTimeoutContext(undefined, 5000);

      expect(context.timeoutMs).toBe(5000);
      expect(context.source).toBeUndefined();
    });

    it('должен создавать контекст с baseContext', () => {
      const baseContext = createMockEffectContext({
        traceId: 'trace-123',
        locale: 'ru',
      });
      const context = createTimeoutContext(baseContext, 3000);

      expect(context.timeoutMs).toBe(3000);
      expect(context.traceId).toBe('trace-123');
      expect(context.locale).toBe('ru');
      expect(context.source).toBeUndefined();
    });

    it('должен создавать контекст с source', () => {
      const context = createTimeoutContext(undefined, 5000, 'login');

      expect(context.timeoutMs).toBe(5000);
      expect(context.source).toBe('login');
    });

    it('должен создавать контекст с baseContext и source', () => {
      const baseContext = createMockEffectContext({
        traceId: 'trace-456',
      });
      const context = createTimeoutContext(baseContext, 2000, 'auth');

      expect(context.timeoutMs).toBe(2000);
      expect(context.source).toBe('auth');
      expect(context.traceId).toBe('trace-456');
    });

    it('не должен добавлять source если он undefined', () => {
      const context = createTimeoutContext(undefined, 1000, undefined);

      expect(context.timeoutMs).toBe(1000);
      expect(context.source).toBeUndefined();
    });

    it('должен сохранять все свойства baseContext', () => {
      const baseContext: EffectContext = {
        traceId: 'trace-789',
        locale: 'en',
        authToken: 'token-123',
        platform: 'web',
        source: 'original-source',
        description: 'Original description',
        abortSignal: new AbortController().signal,
      };
      const context = createTimeoutContext(baseContext, 4000, 'new-source');

      expect(context.timeoutMs).toBe(4000);
      expect(context.source).toBe('new-source'); // перезаписывается
      expect(context.traceId).toBe('trace-789');
      expect(context.locale).toBe('en');
      expect(context.authToken).toBe('token-123');
      expect(context.platform).toBe('web');
      expect(context.description).toBe('Original description');
      expect(context.abortSignal).toBe(baseContext.abortSignal);
    });
  });
});
