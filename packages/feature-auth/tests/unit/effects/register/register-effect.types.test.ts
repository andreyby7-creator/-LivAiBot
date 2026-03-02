/**
 * @file Unit тесты для effects/register/register-effect.types.ts
 * Цель: 100% покрытие runtime-части файла (RegisterConfigError + validateRegisterConfig).
 */

import { describe, expect, it } from 'vitest';

import type {
  ConcurrencyStrategy,
  RegisterEffectConfig,
  RegisterEffectResult,
} from '../../../../src/effects/register/register-effect.types.js';
import {
  RegisterConfigError,
  validateRegisterConfig,
} from '../../../../src/effects/register/register-effect.types.js';

describe('effects/register/register-effect.types', () => {
  describe('RegisterConfigError', () => {
    it('сохраняет prototype chain, name и message', () => {
      const err = new RegisterConfigError('boom');

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(RegisterConfigError);
      expect(err.name).toBe('RegisterConfigError');
      expect(err.message).toBe('boom');
    });
  });

  describe('validateRegisterConfig', () => {
    it('принимает валидный config без apiTimeout', () => {
      const config: RegisterEffectConfig = {
        hardTimeout: 5_000,
      };

      expect(() => validateRegisterConfig(config)).not.toThrow();
    });

    it('принимает валидный config с apiTimeout (hardTimeout > apiTimeout)', () => {
      const config: RegisterEffectConfig = {
        hardTimeout: 5_000,
        apiTimeout: 3_000,
      };

      expect(() => validateRegisterConfig(config)).not.toThrow();
    });

    it('отклоняет hardTimeout <= 0', () => {
      const config: RegisterEffectConfig = {
        hardTimeout: 0,
      };

      expect(() => validateRegisterConfig(config)).toThrow(RegisterConfigError);
      expect(() => validateRegisterConfig(config)).toThrow('register hardTimeout must be > 0');
    });

    it('отклоняет apiTimeout <= 0 (если задан)', () => {
      const config: RegisterEffectConfig = {
        hardTimeout: 5_000,
        apiTimeout: 0,
      };

      expect(() => validateRegisterConfig(config)).toThrow(RegisterConfigError);
      expect(() => validateRegisterConfig(config)).toThrow('register apiTimeout must be > 0');
    });

    it('отклоняет hardTimeout <= apiTimeout', () => {
      const config: RegisterEffectConfig = {
        hardTimeout: 5_000,
        apiTimeout: 5_000,
      };

      expect(() => validateRegisterConfig(config)).toThrow(RegisterConfigError);
      expect(() => validateRegisterConfig(config)).toThrow(
        'register hardTimeout must exceed apiTimeout',
      );
    });
  });

  describe('type contracts (compile-time)', () => {
    it('exports expected unions/aliases', () => {
      const strategies: ConcurrencyStrategy[] = ['ignore', 'cancel_previous', 'serialize'];
      expect(strategies).toHaveLength(3);

      const results: RegisterEffectResult[] = [
        { type: 'success', userId: 'u1' },
        { type: 'mfa_required', userId: 'u2' },
        { type: 'cancelled' },
        { type: 'timeout' },
        // error-variant: AuthError — structural type comes from another module,
        // so we keep runtime payload as unknown and focus on discriminant.
        { type: 'error', error: {} as unknown as never },
      ];
      expect(results.map((r) => r.type)).toEqual([
        'success',
        'mfa_required',
        'cancelled',
        'timeout',
        'error',
      ]);

      const config = {
        hardTimeout: 10_000,
        apiTimeout: 1_000,
        concurrency: 'serialize',
        featureFlags: {},
      } satisfies RegisterEffectConfig;
      expect(config.hardTimeout).toBe(10_000);

      // @ts-expect-error invalid ConcurrencyStrategy should not compile
      const _badStrategy: ConcurrencyStrategy = 'parallel';
      void _badStrategy;

      // @ts-expect-error success result must include userId
      const _badResult: RegisterEffectResult = { type: 'success' };
      void _badResult;
    });
  });
});
