/**
 * @file Unit тесты для effects/refresh/refresh-effect.types.ts
 * Цель: 100% покрытие runtime-части файла (RefreshConfigError + validateRefreshConfig).
 */

import { describe, expect, it } from 'vitest';

import type {
  RefreshEffectConfig,
  RefreshResult,
  SessionDecision,
} from '../../../../src/effects/refresh/refresh-effect.types.js';
import {
  RefreshConfigError,
  validateRefreshConfig,
} from '../../../../src/effects/refresh/refresh-effect.types.js';

describe('effects/refresh/refresh-effect.types', () => {
  describe('RefreshConfigError', () => {
    it('сохраняет prototype chain, name и message', () => {
      const error = new RefreshConfigError('invalid config');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RefreshConfigError);
      expect(error.name).toBe('RefreshConfigError');
      expect(error.message).toBe('invalid config');
    });
  });

  describe('validateRefreshConfig', () => {
    it('принимает валидную конфигурацию с concurrency=serialize', () => {
      const config: RefreshEffectConfig = {
        timeout: 5_000,
        concurrency: 'serialize',
        policy: 'standard',
      };

      expect(() => validateRefreshConfig(config)).not.toThrow();
    });

    it('принимает валидную конфигурацию с concurrency=ignore и граничным timeout', () => {
      const config: RefreshEffectConfig = {
        timeout: 60_000,
        concurrency: 'ignore',
        policy: 'strict',
      };

      expect(() => validateRefreshConfig(config)).not.toThrow();
    });

    it('отклоняет конфигурацию с timeout <= 0', () => {
      const config: RefreshEffectConfig = {
        timeout: 0,
        concurrency: 'serialize',
        policy: 'standard',
      };

      expect(() => validateRefreshConfig(config)).toThrow(RefreshConfigError);
      expect(() => validateRefreshConfig(config)).toThrow(
        'refresh timeout must be > 0 and <= 60000ms',
      );
    });

    it('отклоняет конфигурацию с timeout больше максимального', () => {
      const config: RefreshEffectConfig = {
        timeout: 60_001,
        concurrency: 'serialize',
        policy: 'standard',
      };

      expect(() => validateRefreshConfig(config)).toThrow(RefreshConfigError);
      expect(() => validateRefreshConfig(config)).toThrow(
        'refresh timeout must be > 0 and <= 60000ms',
      );
    });

    it('отклоняет конфигурацию с некорректной concurrency стратегией', () => {
      // Используем приведение через unknown, чтобы сохранить некорректное runtime-значение
      // и одновременно не полагаться на @ts-expect-error (который должен оставаться «используемым»).
      const config = {
        timeout: 5_000,
        concurrency: 'cancel_previous',
        policy: 'legacy',
      } as unknown as RefreshEffectConfig;

      expect(() => validateRefreshConfig(config)).toThrow(RefreshConfigError);
      expect(() => validateRefreshConfig(config)).toThrow(
        'refresh concurrency must be "serialize" or "ignore"',
      );
    });
  });

  describe('type contracts (compile-time)', () => {
    it('RefreshResult поддерживает все варианты union-типа', () => {
      const results: RefreshResult[] = [
        { type: 'success', userId: 'user-1' },
        {
          type: 'error',
          // error-variant: AuthError — структурный тип приходит из другого модуля,
          // поэтому в runtime используем unknown и фокусируемся на discriminant.
          error: {} as unknown as never,
        },
        { type: 'invalidated', reason: 'expired' },
        { type: 'invalidated', reason: 'refresh_failed' },
        { type: 'invalidated', reason: 'security_policy' },
        { type: 'invalidated', reason: 'unknown' },
        { type: 'noop', reason: 'already_fresh' },
        { type: 'noop', reason: 'not_authenticated' },
      ];

      expect(results.map((r) => r.type)).toEqual([
        'success',
        'error',
        'invalidated',
        'invalidated',
        'invalidated',
        'invalidated',
        'noop',
        'noop',
      ]);
    });

    it('SessionDecision покрывает все ветви discriminated union и обеспечивает exhaustiveness', () => {
      const decisions: SessionDecision[] = [
        { type: 'refresh' },
        { type: 'noop', reason: 'fresh' },
        { type: 'noop', reason: 'not_authenticated' },
        { type: 'invalidate', reason: 'expired' },
      ];

      const labels = decisions.map((decision) =>
        decision.type === 'refresh'
          ? 'refresh'
          : decision.type === 'noop'
          ? decision.reason
          : `invalidate:${decision.reason}`
      );

      expect(labels).toEqual([
        'refresh',
        'fresh',
        'not_authenticated',
        'invalidate:expired',
      ]);
    });
  });
});
