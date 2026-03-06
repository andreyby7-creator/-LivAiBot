import { describe, expect, it, vi } from 'vitest';

import {
  createTimeoutContext,
  isTimeoutError,
  TimeoutError,
  withTimeout,
} from '../../src/effect/effect-timeout.js';
import type { EffectContext } from '../../src/effect/effect-utils.js';

function createAbortAwareNeverResolvingEffect(): (signal?: AbortSignal) => Promise<never> {
  return async (signal?: AbortSignal): Promise<never> => {
    return await new Promise<never>((_resolve, reject) => {
      if (signal?.aborted === true) {
        reject(new Error('aborted-in-effect'));
        return;
      }
      signal?.addEventListener('abort', () => {
        reject(new Error('aborted-in-effect'));
      }, { once: true });
    });
  };
}

describe('effect-timeout', () => {
  describe('TimeoutError / isTimeoutError', () => {
    it('создает TimeoutError без tag', () => {
      const error = new TimeoutError(123);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.name).toBe('TimeoutError');
      expect(error.kind).toBe('TimeoutError');
      expect(error.timeoutMs).toBe(123);
      expect(error.tag).toBeUndefined();
      expect(error.message).toBe('Effect execution timeout: 123ms');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('создает TimeoutError c tag', () => {
      const error = new TimeoutError(5000, 'test-tag');
      expect(error.name).toBe('TimeoutError');
      expect(error.kind).toBe('TimeoutError');
      expect(error.timeoutMs).toBe(5000);
      expect(error.tag).toBe('test-tag');
      expect(error.message).toBe('Effect execution timeout: 5000ms (tag: test-tag)');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('isTimeoutError возвращает false для не-TimeoutError', () => {
      expect(isTimeoutError(new Error('x'))).toBe(false);
      expect(isTimeoutError({ name: 'TimeoutError' })).toBe(false);
    });
  });

  describe('createTimeoutContext', () => {
    it('добавляет timeoutMs и timeoutSource к baseContext', () => {
      const base: EffectContext = { source: 'base-source' };
      const ctx = createTimeoutContext(base, 777, 'timeout-source');
      expect(ctx.source).toBe('base-source');
      expect(ctx.timeoutMs).toBe(777);
      expect(ctx.timeoutSource).toBe('timeout-source');
    });

    it('не добавляет timeoutSource если он undefined', () => {
      const base: EffectContext = { source: 'base' };
      const ctx = createTimeoutContext(base, 10, undefined);
      expect(ctx.timeoutMs).toBe(10);
      expect('timeoutSource' in ctx).toBe(false);
    });
  });

  describe('withTimeout', () => {
    it('сразу бросает AbortError если внешний signal уже aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const effect = vi.fn(async () => 'ok');

      const wrapped = withTimeout(effect, { timeoutMs: 1000, tag: 't' });
      await expect(wrapped(controller.signal)).rejects.toMatchObject({
        name: 'AbortError',
        message: 'Aborted',
      });
      expect(effect).not.toHaveBeenCalled();
    });

    it('возвращает результат, если эффект завершился до таймаута (и чистит таймер)', async () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const effect = vi.fn(async () => 'ok');
      const wrapped = withTimeout(effect, { timeoutMs: 200, tag: 'tag' });

      const promise = wrapped(undefined);
      // Даже если мы "прошли время", эффект уже завершился, а таймер должен быть очищен.
      vi.advanceTimersByTime(500);

      await expect(promise).resolves.toBe('ok');
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('валидирует timeoutMs через clamp (min bound)', async () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      const effect = vi.fn(async () => 'ok');
      const wrapped = withTimeout(effect, { timeoutMs: 0, tag: 't' });

      await expect(wrapped(undefined)).resolves.toBe('ok');
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

      vi.useRealTimers();
    });

    it('валидирует timeoutMs через clamp (max bound)', async () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      const effect = vi.fn(async () => 'ok');
      const wrapped = withTimeout(effect, { timeoutMs: 1_000_000, tag: 't' });

      await expect(wrapped(undefined)).resolves.toBe('ok');
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300_000);

      vi.useRealTimers();
    });

    it('бросает TimeoutError при таймауте (использует explicit timeout flag)', async () => {
      vi.useFakeTimers();
      const effect = createAbortAwareNeverResolvingEffect();
      const wrapped = withTimeout(effect, { timeoutMs: 120, tag: 'timeout-test' });

      const promise = wrapped(undefined);
      vi.advanceTimersByTime(120);

      await expect(promise).rejects.toBeInstanceOf(TimeoutError);
      await expect(promise).rejects.toMatchObject({
        name: 'TimeoutError',
        kind: 'TimeoutError',
        timeoutMs: 120,
        tag: 'timeout-test',
      });

      vi.useRealTimers();
    });

    it('пробрасывает оригинальную ошибку, если это не таймаут', async () => {
      vi.useFakeTimers();
      const error = new Error('boom');
      const effect = vi.fn(async () => {
        throw error;
      });
      const wrapped = withTimeout(effect, { timeoutMs: 1000, tag: 'x' });

      await expect(wrapped(undefined)).rejects.toBe(error);
      vi.useRealTimers();
    });

    it('прокидывает внешний AbortSignal через combineAbortSignals (ветка signal != null)', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();

      const effect: (signal?: AbortSignal) => Promise<never> = async (signal?: AbortSignal) => {
        return await new Promise<never>((_resolve, reject) => {
          if (signal?.aborted === true) {
            reject(new Error('external-aborted'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new Error('external-aborted'));
          }, { once: true });
        });
      };

      const wrapped = withTimeout(effect, { timeoutMs: 10_000, tag: 't' });
      const promise = wrapped(controller.signal);

      controller.abort();
      await expect(promise).rejects.toMatchObject({ message: 'external-aborted' });

      vi.useRealTimers();
    });

    it('если callback таймера выполнится после завершения эффекта, он не должен ставить timeout флаг (completed guard)', async () => {
      const state: { cb?: () => void; } = {};

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(
        (cb: () => void) => {
          // eslint-disable-next-line fp/no-mutation -- тест: сохраняем callback таймера для ручного вызова после completion
          state.cb = cb;
          return Symbol('t') as unknown as ReturnType<typeof setTimeout>;
        },
      );
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() =>
        undefined
      );

      const effect = vi.fn(async () => 'ok');
      const wrapped = withTimeout(effect, { timeoutMs: 100, tag: 't' });

      await expect(wrapped(undefined)).resolves.toBe('ok');
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Теперь effect завершён → timeoutState.completed = true → callback должен early-return.
      state.cb?.();

      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });
});
