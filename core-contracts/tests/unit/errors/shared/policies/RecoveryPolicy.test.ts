/**
 * @file RecoveryPolicy.test.ts
 * Unit-тесты для RecoveryPolicy.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';
import type {
  RecoveryContext,
  RecoveryPolicy,
} from '../../../../../src/errors/shared/policies/RecoveryPolicy.js';

import {
  buildRecoveryPolicy,
  // Готовые политики
  DEFAULT_RECOVERY_POLICY,
  EMPTY_ARRAY_RECOVERY_POLICY,
  EMPTY_OBJECT_RECOVERY_POLICY,
  fallbackEffect,
  fallbackFactory,
  fallbackValue,
  // Примитивные политики
  noRecovery,
  NULL_RECOVERY_POLICY,
  // Комбинаторы
  recoverIf,
  // Effect helpers
  withRecoveryPolicy,
} from '../../../../../src/errors/shared/policies/RecoveryPolicy';

// Mock error для тестов
class TestError extends Error {
  constructor(message = 'Test error') {
    super(message);
    this.name = 'TestError';
  }
}

describe('RecoveryPolicy', () => {
  describe('Примитивные политики', () => {
    describe('noRecovery', () => {
      it('должен всегда возвращать Fail независимо от error', () => {
        const policy = noRecovery();

        const ctx1: RecoveryContext = { error: new TestError() };
        const ctx2: RecoveryContext = { error: new Error('Another error') };

        expect(policy(ctx1)).toEqual({ _tag: 'Fail' });
        expect(policy(ctx2)).toEqual({ _tag: 'Fail' });
      });
    });

    describe('fallbackValue', () => {
      it('должен возвращать Recover с указанным значением', () => {
        const policy = fallbackValue('default_value');

        const ctx: RecoveryContext = { error: new TestError() };
        const result = policy(ctx);

        expect(result).toEqual({
          _tag: 'Recover',
          value: 'default_value',
        });
      });

      it('должен работать с разными типами значений', () => {
        const policy1 = fallbackValue(42);
        const policy2 = fallbackValue({ key: 'value' });
        const policy3 = fallbackValue(null);

        const ctx: RecoveryContext = { error: new TestError() };

        expect(policy1(ctx)).toEqual({ _tag: 'Recover', value: 42 });
        expect(policy2(ctx)).toEqual({ _tag: 'Recover', value: { key: 'value' } });
        expect(policy3(ctx)).toEqual({ _tag: 'Recover', value: null });
      });
    });

    describe('fallbackFactory', () => {
      it('должен возвращать Recover с результатом вызова factory', () => {
        const factory = vi.fn(() => 'computed_value');
        const policy = fallbackFactory(factory);

        const ctx: RecoveryContext = { error: new TestError() };
        const result = policy(ctx);

        expect(result).toEqual({
          _tag: 'Recover',
          value: 'computed_value',
        });
        expect(factory).toHaveBeenCalledTimes(1);
      });

      it('должен вызывать factory каждый раз при вызове политики', () => {
        let counter = 0;
        const factory = vi.fn(() => `value_${++counter}`);
        const policy = fallbackFactory(factory);

        const ctx: RecoveryContext = { error: new TestError() };

        const result1 = policy(ctx);
        const result2 = policy(ctx);

        expect(result1).toEqual({ _tag: 'Recover', value: 'value_1' });
        expect(result2).toEqual({ _tag: 'Recover', value: 'value_2' });
        expect(factory).toHaveBeenCalledTimes(2);
      });
    });

    describe('fallbackEffect', () => {
      it('должен возвращать RecoverEffect с результатом вызова effectFactory', async () => {
        const effectFactory = vi.fn(() => Effect.succeed('effect_value'));
        const policy = fallbackEffect(effectFactory);

        const ctx: RecoveryContext = { error: new TestError() };
        const result = policy(ctx);

        expect(result._tag).toBe('RecoverEffect');
        if (result._tag === 'RecoverEffect') {
          const value = await Effect.runPromise(result.effect);
          expect(value).toBe('effect_value');
        }
        expect(effectFactory).toHaveBeenCalledTimes(1);
      });

      it('должен создавать новый Effect при каждом вызове политики', async () => {
        let counter = 0;
        const effectFactory = vi.fn(() => Effect.succeed(`effect_${++counter}`));
        const policy = fallbackEffect(effectFactory);

        const ctx: RecoveryContext = { error: new TestError() };

        const result1 = policy(ctx);
        const result2 = policy(ctx);

        if (result1._tag === 'RecoverEffect' && result2._tag === 'RecoverEffect') {
          const value1 = await Effect.runPromise(result1.effect);
          const value2 = await Effect.runPromise(result2.effect);

          expect(value1).toBe('effect_1');
          expect(value2).toBe('effect_2');
        }
        expect(effectFactory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Комбинаторы', () => {
    describe('recoverIf', () => {
      it('должен использовать базовую политику для ошибок, удовлетворяющих predicate', () => {
        const basePolicy: RecoveryPolicy<string> = () => ({ _tag: 'Recover', value: 'recovered' });
        const policy = recoverIf((error: unknown) =>
          (error as Error).message.includes('recoverable')
        )(basePolicy);

        const ctx1: RecoveryContext = { error: new Error('recoverable error') };
        const ctx2: RecoveryContext = { error: new TestError() };

        expect(policy(ctx1)).toEqual({ _tag: 'Recover', value: 'recovered' });
        expect(policy(ctx2)).toEqual({ _tag: 'Fail' });
      });

      it('должен возвращать Fail для ошибок, не удовлетворяющих predicate', () => {
        const basePolicy: RecoveryPolicy<string> = () => ({ _tag: 'Recover', value: 'recovered' });
        const policy = recoverIf((error: unknown) => (error as Error).name === 'TestError')(
          basePolicy,
        );

        const ctx: RecoveryContext = { error: new Error('other error') };

        expect(policy(ctx)).toEqual({ _tag: 'Fail' });
      });
    });

    describe('buildRecoveryPolicy', () => {
      it('должен возвращать Fail если все политики возвращают Fail', () => {
        const policy1: RecoveryPolicy<string> = () => ({ _tag: 'Fail' });
        const policy2: RecoveryPolicy<string> = () => ({ _tag: 'Fail' });
        const policy = buildRecoveryPolicy(policy1, policy2);

        const ctx: RecoveryContext = { error: new TestError() };

        expect(policy(ctx)).toEqual({ _tag: 'Fail' });
      });

      it('должен возвращать результат первой успешной политики (Recover)', () => {
        const policy1: RecoveryPolicy<string> = () => ({ _tag: 'Fail' });
        const policy2: RecoveryPolicy<string> = () => ({ _tag: 'Recover', value: 'success1' });
        const policy3: RecoveryPolicy<string> = () => ({ _tag: 'Recover', value: 'success2' });
        const policy = buildRecoveryPolicy(policy1, policy2, policy3);

        const ctx: RecoveryContext = { error: new TestError() };

        expect(policy(ctx)).toEqual({ _tag: 'Recover', value: 'success1' });
      });

      it('должен возвращать результат первой успешной политики (RecoverEffect)', async () => {
        const policy1: RecoveryPolicy<string> = () => ({ _tag: 'Fail' });
        const policy2: RecoveryPolicy<string> = () => ({
          _tag: 'RecoverEffect',
          effect: Effect.succeed('effect1'),
        });
        const policy3: RecoveryPolicy<string> = () => ({ _tag: 'Recover', value: 'fallback' });
        const policy = buildRecoveryPolicy(policy1, policy2, policy3);

        const ctx: RecoveryContext = { error: new TestError() };
        const result = policy(ctx);

        expect(result._tag).toBe('RecoverEffect');
        if (result._tag === 'RecoverEffect') {
          await expect(Effect.runPromise(result.effect)).resolves.toBe('effect1');
        }
      });

      it('должен работать с пустым массивом политик', () => {
        const policy = buildRecoveryPolicy();

        const ctx: RecoveryContext = { error: new TestError() };

        expect(policy(ctx)).toEqual({ _tag: 'Fail' });
      });
    });
  });

  describe('withRecoveryPolicy', () => {
    it('должен возвращать результат успешного Effect без применения политики', async () => {
      const policy = fallbackValue('should_not_be_used');
      const effect = Effect.succeed('success');

      const result = await Effect.runPromise(withRecoveryPolicy(policy)(effect));

      expect(result).toBe('success');
    });

    it('должен применять политику при ошибке Effect и возвращать Recover значение', async () => {
      const policy = fallbackValue('fallback_value');
      const effect = Effect.fail(new TestError('original error'));

      const result = await Effect.runPromise(withRecoveryPolicy(policy)(effect));

      expect(result).toBe('fallback_value');
    });

    it('должен применять RecoverEffect политику при ошибке Effect', async () => {
      const policy = fallbackEffect(() => Effect.succeed('effect_fallback'));
      const effect = Effect.fail(new TestError('original error'));

      const result = await Effect.runPromise(withRecoveryPolicy(policy)(effect));

      expect(result).toBe('effect_fallback');
    });

    it('должен пробрасывать оригинальную ошибку при Fail политике', async () => {
      const policy = noRecovery();
      const originalError = new TestError('original error');
      const effect = Effect.fail(originalError);

      const exit = await Effect.runPromiseExit(withRecoveryPolicy(policy)(effect));

      expect(exit._tag).toBe('Failure');
      if (exit._tag === 'Failure') {
        expect(exit.cause._tag).toBe('Fail');
        // Ошибка должна быть завернута в новый Fail
      }
    });

    it('должен корректно передавать ошибку в контекст политики', async () => {
      let receivedError: unknown = null;
      const policy: RecoveryPolicy<string> = (ctx) => {
        receivedError = ctx.error;
        return { _tag: 'Recover', value: 'recovered' };
      };

      const originalError = new TestError('test error');
      const effect = Effect.fail(originalError);

      await Effect.runPromise(withRecoveryPolicy(policy)(effect));

      expect(receivedError).toBe(originalError);
    });

    it('должен работать с разными типами ошибок и recovery значений', async () => {
      const policy = fallbackValue(42);
      const effect = Effect.fail('string error');

      const result = await Effect.runPromise(withRecoveryPolicy(policy)(effect));

      expect(result).toBe(42);
    });
  });

  describe('Готовые политики', () => {
    describe('DEFAULT_RECOVERY_POLICY', () => {
      it('должен быть эквивалентен noRecovery', () => {
        const ctx: RecoveryContext = { error: new TestError() };

        expect(DEFAULT_RECOVERY_POLICY(ctx)).toEqual(noRecovery()(ctx));
      });
    });

    describe('NULL_RECOVERY_POLICY', () => {
      it('должен возвращать null при любой ошибке', () => {
        const ctx1: RecoveryContext = { error: new TestError() };
        const ctx2: RecoveryContext = { error: new Error('another error') };

        expect(NULL_RECOVERY_POLICY(ctx1)).toEqual({ _tag: 'Recover', value: null });
        expect(NULL_RECOVERY_POLICY(ctx2)).toEqual({ _tag: 'Recover', value: null });
      });
    });

    describe('EMPTY_ARRAY_RECOVERY_POLICY', () => {
      it('должен возвращать пустой массив при любой ошибке', () => {
        const ctx: RecoveryContext = { error: new TestError() };

        expect(EMPTY_ARRAY_RECOVERY_POLICY(ctx)).toEqual({ _tag: 'Recover', value: [] });
      });
    });

    describe('EMPTY_OBJECT_RECOVERY_POLICY', () => {
      it('должен возвращать пустой объект при любой ошибке', () => {
        const ctx: RecoveryContext = { error: new TestError() };

        expect(EMPTY_OBJECT_RECOVERY_POLICY(ctx)).toEqual({ _tag: 'Recover', value: {} });
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен работать с комплексной политикой recovery', async () => {
      // Сначала пытаемся recover через null, если не получается - через пустой массив
      const policy = buildRecoveryPolicy(
        recoverIf((error: unknown) => (error as Error).message.includes('database'))(
          NULL_RECOVERY_POLICY,
        ),
        recoverIf((error: unknown) => (error as Error).message.includes('network'))(
          EMPTY_ARRAY_RECOVERY_POLICY,
        ),
        fallbackValue('default_fallback'),
      );

      const dbError = new Error('database connection failed');
      const networkError = new Error('network timeout');
      const otherError = new Error('unknown error');

      const dbEffect = Effect.fail(dbError);
      const networkEffect = Effect.fail(networkError);
      const otherEffect = Effect.fail(otherError);

      const dbResult = await Effect.runPromise(withRecoveryPolicy(policy)(dbEffect));
      const networkResult = await Effect.runPromise(withRecoveryPolicy(policy)(networkEffect));
      const otherResult = await Effect.runPromise(withRecoveryPolicy(policy)(otherEffect));

      expect(dbResult).toBe(null);
      expect(networkResult).toEqual([]);
      expect(otherResult).toBe('default_fallback');
    });

    it('должен корректно работать с Effect-based recovery', async () => {
      const policy = buildRecoveryPolicy(
        fallbackValue('sync_fallback'),
        fallbackEffect(() => Effect.succeed('async_fallback')),
      );

      const effect = Effect.fail(new TestError());

      const result = await Effect.runPromise(withRecoveryPolicy(policy)(effect));

      // Первая политика (sync) должна сработать первой
      expect(result).toBe('sync_fallback');
    });
  });
});
