import { describe, expect, it } from 'vitest';

import { Effect } from 'effect';

import { LIVAI_ERROR_CODES } from '../../../../src/errors/base/ErrorCode.js';
import {
  createAsyncStrategy,
  createCallbackStrategy,
  createEffectStrategy,
  createStrategyForPrefix,
  createStrategyWithCodes,
} from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyFactories.js';
import { LOG_AND_RETURN_STRATEGY } from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyBase.js';

import type {
  ErrorStrategy,
  StrategyResult,
} from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyTypes.js';

describe('ErrorStrategyFactories', () => {
  describe('createStrategyWithCodes', () => {
    it('должен создавать стратегию с явными кодами ошибок', () => {
      const applicableCodes = [LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS];
      const strategy = createStrategyWithCodes(LOG_AND_RETURN_STRATEGY, applicableCodes);

      expect(strategy.name).toContain('_for_1_codes');
      expect(strategy.applicableCodes).toEqual(applicableCodes);
      expect(strategy.description).toBe(LOG_AND_RETURN_STRATEGY.description);
      expect(strategy.priority).toBe(LOG_AND_RETURN_STRATEGY.priority);
    });

    it('должен создавать стратегию с несколькими кодами ошибок', () => {
      const applicableCodes = [
        LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      ];
      const strategy = createStrategyWithCodes(LOG_AND_RETURN_STRATEGY, applicableCodes);

      expect(strategy.name).toContain('_for_2_codes');
      expect(strategy.applicableCodes).toEqual(applicableCodes);
    });
  });

  describe('createStrategyForPrefix', () => {
    it('должен создавать стратегию для существующего префикса', () => {
      const strategy = createStrategyForPrefix(LOG_AND_RETURN_STRATEGY, 'DOMAIN_AUTH');

      expect(strategy.applicableCodes).toBeDefined();
      expect(strategy.applicableCodes!.length).toBeGreaterThan(0);
      expect(strategy.applicableCodes!.every((code) => code.startsWith('DOMAIN_AUTH'))).toBe(true);
    });

    it('должен создавать стратегию с пустым массивом кодов для несуществующего префикса', () => {
      const strategy = createStrategyForPrefix(LOG_AND_RETURN_STRATEGY, 'NONEXISTENT');

      expect(strategy.applicableCodes).toEqual([]);
    });

    it('должен покрывать все ветки условий в createStrategyForPrefix', () => {
      // Существующие префиксы - должны найти коды
      const existingPrefixes = [
        'DOMAIN_AUTH',
        'INFRA_DB',
        'SERVICE_AI',
        'ADMIN_USER',
      ];

      existingPrefixes.forEach((prefix) => {
        const strategy = createStrategyForPrefix(LOG_AND_RETURN_STRATEGY, prefix);
        expect(strategy.applicableCodes).toBeDefined();
        expect(Array.isArray(strategy.applicableCodes)).toBe(true);
        expect(strategy.applicableCodes!.length).toBeGreaterThan(0);
        expect(strategy.applicableCodes!.every((code) => code.startsWith(prefix))).toBe(true);
      });

      // Частичные префиксы - должны найти коды
      const partialPrefixes = [
        'DOMAIN',
        'INFRA',
        'SERVICE',
        'ADMIN',
      ];

      partialPrefixes.forEach((prefix) => {
        const strategy = createStrategyForPrefix(LOG_AND_RETURN_STRATEGY, prefix);
        expect(strategy.applicableCodes).toBeDefined();
        expect(Array.isArray(strategy.applicableCodes)).toBe(true);
        expect(strategy.applicableCodes!.length).toBeGreaterThan(0);
        expect(strategy.applicableCodes!.every((code) => code.startsWith(prefix))).toBe(true);
      });

      // Несуществующие префиксы - должны вернуть пустой массив
      const nonExistentPrefixes = [
        'NON_EXISTENT',
        'INVALID_PREFIX',
        'RANDOM_STRING',
        'XYZ_', // не существует в error codes
      ];

      nonExistentPrefixes.forEach((prefix) => {
        const strategy = createStrategyForPrefix(LOG_AND_RETURN_STRATEGY, prefix);
        expect(strategy.applicableCodes).toEqual([]);
      });

      // Пустой префикс - должен вернуть пустой массив
      const strategyEmpty = createStrategyForPrefix(LOG_AND_RETURN_STRATEGY, '');
      expect(strategyEmpty.applicableCodes).toEqual([]);
    });
  });

  describe('createAsyncStrategy', () => {
    it('должен создавать асинхронную стратегию без applicableCodes', () => {
      const asyncFn = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => ({
        success: true,
        data: 'test-result',
        strategy: 'test-async',
      });

      const strategy = createAsyncStrategy('test-async', 'Test async strategy', 1, asyncFn);

      expect(strategy.name).toBe('test-async');
      expect(strategy.description).toBe('Test async strategy');
      expect(strategy.priority).toBe(1);
      expect(strategy.applicableCodes).toBeUndefined();
    });

    it('должен создавать асинхронную стратегию с applicableCodes', () => {
      const asyncFn = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => ({
        success: true,
        data: 'test-result',
        strategy: 'test-async',
      });

      const applicableCodes = [LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS];
      const strategy = createAsyncStrategy(
        'test-async',
        'Test async strategy',
        1,
        asyncFn,
        applicableCodes,
      );

      expect(strategy.applicableCodes).toEqual(applicableCodes);
    });

    it('должен корректно выполнять асинхронную функцию при успехе', async () => {
      const asyncFn = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => ({
        success: true,
        data: 'async-success',
        strategy: 'test-async',
      });

      const strategy = createAsyncStrategy('test-async', 'Test', 1, asyncFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test')) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('async-success');
      }
    });

    it('должен обрабатывать ошибки в асинхронной функции', async () => {
      const asyncFn = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => {
        throw new Error('async-error');
      };

      const strategy = createAsyncStrategy('test-async', 'Test', 1, asyncFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test')) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.strategy).toBe('test-async');
        expect(result.shouldRetry).toBe(false);
      }
    });

    it('должен передавать context в асинхронную функцию', async () => {
      const asyncFn = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => ({
        success: true,
        data: context?.testValue,
        strategy: 'test-async',
      });

      const strategy = createAsyncStrategy('test-async', 'Test', 1, asyncFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test'), { testValue: 'passed' }) as Effect.Effect<
          StrategyResult,
          unknown,
          never
        >,
      );

      if (result.success) {
        expect(result.data).toBe('passed');
      }
    });
  });

  describe('createEffectStrategy', () => {
    it('должен создавать Effect-based стратегию без applicableCodes', () => {
      const effectFn = (error: unknown, context?: Record<string, unknown>) =>
        Effect.succeed('effect-result');

      const strategy = createEffectStrategy('test-effect', 'Test effect strategy', 2, effectFn);

      expect(strategy.name).toBe('test-effect');
      expect(strategy.description).toBe('Test effect strategy');
      expect(strategy.priority).toBe(2);
      expect(strategy.applicableCodes).toBeUndefined();
    });

    it('должен создавать Effect-based стратегию с applicableCodes', () => {
      const effectFn = (error: unknown, context?: Record<string, unknown>) =>
        Effect.succeed('effect-result');

      const applicableCodes = [LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND];
      const strategy = createEffectStrategy('test-effect', 'Test', 2, effectFn, applicableCodes);

      expect(strategy.applicableCodes).toEqual(applicableCodes);
    });

    it('должен корректно выполнять Effect функцию при успехе', async () => {
      const effectFn = (error: unknown, context?: Record<string, unknown>) =>
        Effect.succeed('effect-success');

      const strategy = createEffectStrategy('test-effect', 'Test', 2, effectFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test')) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('effect-success');
        expect(result.strategy).toBe('test-effect');
      }
    });

    it('должен обрабатывать ошибки в Effect функции', async () => {
      const effectFn = (error: unknown, context?: Record<string, unknown>) =>
        Effect.fail('effect-error');

      const strategy = createEffectStrategy('test-effect', 'Test', 2, effectFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test')) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('effect-error');
        expect(result.strategy).toBe('test-effect');
        expect(result.shouldRetry).toBe(false);
      }
    });
  });

  describe('createCallbackStrategy', () => {
    it('должен создавать callback-based стратегию без applicableCodes', () => {
      const callbackFn = (
        error: unknown,
        context: Record<string, unknown> | undefined,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        callback(null, 'callback-result');
      };

      const strategy = createCallbackStrategy(
        'test-callback',
        'Test callback strategy',
        3,
        callbackFn,
      );

      expect(strategy.name).toBe('test-callback');
      expect(strategy.description).toBe('Test callback strategy');
      expect(strategy.priority).toBe(3);
      expect(strategy.applicableCodes).toBeUndefined();
    });

    it('должен создавать callback-based стратегию с applicableCodes', () => {
      const callbackFn = (
        error: unknown,
        context: Record<string, unknown> | undefined,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        callback(null, 'callback-result');
      };

      const applicableCodes = [LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_FAILED];
      const strategy = createCallbackStrategy(
        'test-callback',
        'Test',
        3,
        callbackFn,
        applicableCodes,
      );

      expect(strategy.applicableCodes).toEqual(applicableCodes);
    });

    it('должен корректно выполнять callback функцию при успехе', async () => {
      const callbackFn = (
        error: unknown,
        context: Record<string, unknown> | undefined,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        callback(null, 'callback-success');
      };

      const strategy = createCallbackStrategy('test-callback', 'Test', 3, callbackFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test')) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('callback-success');
      }
      expect(result.strategy).toBe('test-callback');
    });

    it('должен обрабатывать ошибки в callback функции', async () => {
      const callbackFn = (
        error: unknown,
        context: Record<string, unknown> | undefined,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        callback(new Error('callback-error'));
      };

      const strategy = createCallbackStrategy('test-callback', 'Test', 3, callbackFn);
      const result = await Effect.runPromise(
        strategy.execute(new Error('test')) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('callback-error');
        expect(result.strategy).toBe('test-callback');
        expect(result.shouldRetry).toBe(false);
      }
    });

    it('должен покрывать edge cases в фабричных функциях', () => {
      // createAsyncStrategy с различными типами функций
      const asyncFnSuccess = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => ({
        success: true,
        data: { result: 'success' },
        strategy: 'async-success',
      });

      const asyncFnError = async (
        error: unknown,
        context?: Record<string, unknown>,
      ): Promise<StrategyResult> => ({
        success: false,
        error: new Error('async error'),
        strategy: 'async-error',
        shouldRetry: false,
      });

      const strategyAsyncSuccess = createAsyncStrategy('async-success', 'Test', 1, asyncFnSuccess);
      const strategyAsyncError = createAsyncStrategy('async-error', 'Test', 1, asyncFnError);

      expect(strategyAsyncSuccess.name).toBe('async-success');
      expect(strategyAsyncError.name).toBe('async-error');

      // createEffectStrategy с различными эффектами
      const effectFnSuccess = (error: unknown, context?: Record<string, unknown>) =>
        Effect.succeed(
          {
            success: true,
            data: { result: 'effect success' },
            strategy: 'effect-success',
          } as StrategyResult,
        );

      const effectFnError = (error: unknown, context?: Record<string, unknown>) =>
        Effect.fail(new Error('effect error'));

      const strategyEffectSuccess = createEffectStrategy(
        'effect-success',
        'Test',
        2,
        effectFnSuccess,
      );
      const strategyEffectError = createEffectStrategy('effect-error', 'Test', 2, effectFnError);

      expect(strategyEffectSuccess.name).toBe('effect-success');
      expect(strategyEffectError.name).toBe('effect-error');

      // createCallbackStrategy с различными функциями
      const callbackFnSuccess = (
        error: unknown,
        context?: Record<string, unknown>,
      ): StrategyResult => ({
        success: true,
        data: { result: 'callback success' },
        strategy: 'callback-success',
      });

      const callbackFnError = (
        error: unknown,
        context?: Record<string, unknown>,
      ): StrategyResult => ({
        success: false,
        error: new Error('callback error'),
        strategy: 'callback-error',
        shouldRetry: false,
      });

      const strategyCallbackSuccess = createCallbackStrategy(
        'callback-success',
        'Test',
        3,
        callbackFnSuccess,
      );
      const strategyCallbackError = createCallbackStrategy(
        'callback-error',
        'Test',
        3,
        callbackFnError,
      );

      expect(strategyCallbackSuccess.name).toBe('callback-success');
      expect(strategyCallbackError.name).toBe('callback-error');
    });
  });
});
