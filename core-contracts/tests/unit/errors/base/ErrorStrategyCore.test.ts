import { describe, expect, it } from 'vitest';

import { Effect } from 'effect';

import { LIVAI_ERROR_CODES } from '../../../../src/errors/base/ErrorCode.js';
import {
  executeWithCircuitBreaker,
  getAllGroupStrategies,
  getSeverityBasedStrategy,
  getStrategyByPrefix,
  getStrategyStats,
  resolveAndExecuteWithCircuitBreaker,
  resolveStrategy,
} from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyCore.js';
import { LOG_AND_RETURN_STRATEGY } from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyBase.js';
import type { ErrorStrategy, StrategyResult } from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyTypes.js';

describe('ErrorStrategyCore', () => {
  describe('resolveStrategy', () => {
    it('должен возвращать custom стратегию если она применима к коду', () => {
      const mockStrategy: ErrorStrategy<unknown> = {
        name: 'test-strategy',
        description: 'Test strategy for unit tests',
        priority: 1,
        applicableCodes: [LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS],
        execute: () => Effect.succeed({ success: true, data: { handled: true, action: 'test' }, strategy: 'test-strategy' } as StrategyResult),
      };

      const result = resolveStrategy(
        LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        [mockStrategy],
      );

      expect(result).toBe(mockStrategy);
    });

    it('должен возвращать групповую стратегию если нет custom стратегии', () => {
      // Используем код ошибки из DOMAIN группы
      const result = resolveStrategy(LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS);
      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
    });

    it('должен возвращать fallback стратегию если код не найден в группах', () => {
      // Создадим mock код ошибки, который не входит ни в одну группу
      const unknownCode = 'UNKNOWN_TEST_001' as any;
      const result = resolveStrategy(unknownCode);
      expect(result).toBe(LOG_AND_RETURN_STRATEGY);
    });

    it('должен игнорировать custom стратегии без applicableCodes', () => {
      const mockStrategy: ErrorStrategy<unknown> = {
        name: 'test-strategy',
        description: 'Test strategy without applicable codes',
        priority: 1,
        execute: () => Effect.succeed({ success: true, data: { handled: true, action: 'test' }, strategy: 'test-strategy' } as StrategyResult),
      };

      const result = resolveStrategy(LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS, [mockStrategy]);
      // Должен вернуться групповая стратегия, а не custom
      expect(result).not.toBe(mockStrategy);
    });
  });

  describe('getSeverityBasedStrategy', () => {
    it('должен возвращать базовую стратегию', () => {
      const result = getSeverityBasedStrategy();
      expect(result).toBe(LOG_AND_RETURN_STRATEGY);
    });
  });

  describe('executeWithCircuitBreaker', () => {
    it('должен выполнять стратегию в контексте CircuitBreakerService', async () => {
      const mockStrategy: ErrorStrategy<unknown> = {
        name: 'test-strategy',
        description: 'Test strategy for circuit breaker',
        priority: 1,
        execute: () => Effect.succeed({ success: true, data: { handled: true, action: 'circuit-breaker-test' }, strategy: 'test-strategy' } as StrategyResult),
      };

      const result = await Effect.runPromise(executeWithCircuitBreaker(mockStrategy, new Error('test')) as Effect.Effect<StrategyResult, unknown, never>);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ handled: true, action: 'circuit-breaker-test' });
      }
    });

    it('должен передавать context в стратегию', async () => {
      const mockStrategy: ErrorStrategy<unknown> = {
        name: 'test-strategy',
        description: 'Test strategy with context',
        priority: 1,
        execute: (error, context) => Effect.succeed({
          success: true,
          data: { handled: true, action: `context-test-${context?.testValue}` },
          strategy: 'test-strategy'
        } as StrategyResult),
      };

      const result = await Effect.runPromise(
        executeWithCircuitBreaker(mockStrategy, new Error('test'), { testValue: 'passed' }) as Effect.Effect<StrategyResult, unknown, never>,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ handled: true, action: 'context-test-passed' });
      }
    });
  });

  describe('resolveAndExecuteWithCircuitBreaker', () => {
    it('должен разрешить и выполнить стратегию для известного кода ошибки', async () => {
      const effect = resolveAndExecuteWithCircuitBreaker(LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS, new Error('test'));
      expect(effect).toBeDefined();
      // Effect должен выполняться без ошибок
      await expect(Effect.runPromise(effect as Effect.Effect<StrategyResult, unknown, never>)).resolves.toBeDefined();
    });

    it('должен использовать custom стратегии при разрешении', async () => {
      const mockStrategy: ErrorStrategy<unknown> = {
        name: 'custom-test-strategy',
        description: 'Custom test strategy',
        priority: 1,
        applicableCodes: [LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS],
        execute: () => Effect.succeed({ success: true, data: { handled: true, action: 'custom-executed' }, strategy: 'custom-test-strategy' } as StrategyResult),
      };

      const result = await Effect.runPromise(
        resolveAndExecuteWithCircuitBreaker(
          LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          new Error('test'),
          [mockStrategy],
        ) as Effect.Effect<StrategyResult, unknown, never>,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ handled: true, action: 'custom-executed' });
      }
    });
  });

  describe('getAllGroupStrategies', () => {
    it('должен возвращать массив групповых стратегий', () => {
      const strategies = getAllGroupStrategies();
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('prefix');
      expect(strategies[0]).toHaveProperty('codes');
      expect(strategies[0]).toHaveProperty('strategy');
    });
  });

  describe('getStrategyByPrefix', () => {
    it('должен возвращать стратегию для существующего префикса', () => {
      const strategy = getStrategyByPrefix('DOMAIN_AUTH');
      expect(strategy).not.toBeNull();
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('execute');
    });

    it('должен возвращать null для несуществующего префикса', () => {
      const strategy = getStrategyByPrefix('NONEXISTENT');
      expect(strategy).toBeNull();
    });
  });

  describe('getStrategyStats', () => {
    it('должен возвращать статистику использования стратегий', () => {
      const stats = getStrategyStats();
      expect(typeof stats).toBe('object');
      expect(Object.keys(stats).length).toBeGreaterThan(0);

      // Все значения должны быть числами
      Object.values(stats).forEach((count) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
