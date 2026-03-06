/**
 * @file Unit тесты для effect-isolation.ts
 * Цель: 100% coverage для публичного API: IsolationError, isIsolationError, runIsolated.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isIsolationError,
  IsolationError,
  runIsolated,
} from '../../src/effect/effect-isolation.js';

describe('effect/effect-isolation', () => {
  describe('IsolationError', () => {
    it('оборачивает Error, добавляет tag и переиспользует stack исходной ошибки', () => {
      const original = new Error('boom');
      // Явно задаём stack, чтобы предсказуемо проверить объединённый stack
      // eslint-disable-next-line fp/no-mutation
      original.stack = 'OriginalStack';

      const err = new IsolationError(original, 'test-tag');

      expect(err).toBeInstanceOf(IsolationError);
      expect(err.name).toBe('IsolationError');
      expect(err.originalError).toBe(original);
      expect(err.tag).toBe('test-tag');
      expect(err.message).toBe('Effect isolation error (tag: test-tag): boom');
      expect(err.stack).toContain('IsolationError: Effect isolation error (tag: test-tag): boom');
      expect(err.stack).toContain('OriginalStack');
    });

    it('корректно обрабатывает не-Error значение и отсутствие tag', () => {
      const err = new IsolationError(42);

      expect(err.originalError).toBe(42);
      expect(err.tag).toBeUndefined();
      expect(err.message).toBe('Effect isolation error: 42');
    });
  });

  describe('isIsolationError', () => {
    it('распознает IsolationError и отклоняет другие значения', () => {
      const iso = new IsolationError(new Error('x'));

      expect(isIsolationError(iso)).toBe(true);
      expect(isIsolationError(new Error('x'))).toBe(false);
      expect(isIsolationError(null)).toBe(false);
      expect(isIsolationError(undefined)).toBe(false);
    });
  });

  describe('runIsolated', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('возвращает ok результат при успешном эффекте без опций', async () => {
      const effect = async () => 'ok' as const;

      const result = await runIsolated(effect);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('expected ok result');
      }
      expect(result.value).toBe('ok');
    });

    it('изолирует брошенную Error в IsolationError с tag и возвращает fail Result', async () => {
      const original = new Error('fail');
      const effect = async () => {
        throw original;
      };

      const result = await runIsolated(effect, { tag: 'user-fetch' });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('expected fail result');
      }

      const { error } = result;
      expect(isIsolationError(error)).toBe(true);
      expect(error.originalError).toBe(original);
      expect(error.tag).toBe('user-fetch');
      expect(error.message).toBe('Effect isolation error (tag: user-fetch): fail');
    });

    it('изолирует не-Error и не задаёт tag, если он не передан', async () => {
      const effect = async () => {
        throw 'boom';
      };

      const result = await runIsolated(effect);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('expected fail result');
      }

      const { error } = result;
      expect(isIsolationError(error)).toBe(true);
      expect(error.originalError).toBe('boom');
      expect(error.tag).toBeUndefined();
      expect(error.message).toBe('Effect isolation error: boom');
    });

    it('в development режиме бросает TypeError, если effect не функция', async () => {
      const badEffect = 123 as unknown as () => Promise<unknown>;

      vi.stubEnv('NODE_ENV', 'development');

      await expect(runIsolated(badEffect as never)).rejects.toThrowError(
        '[effect-isolation] runIsolated: effect must be a function, got number',
      );
    });
  });
});
