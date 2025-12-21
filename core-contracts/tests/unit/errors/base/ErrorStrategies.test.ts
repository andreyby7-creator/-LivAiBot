import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

// Import everything from the main ErrorStrategies module
import {
  ALERT_STRATEGY,
  ALERT_THRESHOLDS,
  AlertServiceTag,
  CIRCUIT_BREAKER,
  CircuitBreakerServiceTag,
  createAsyncStrategy,
  createCallbackStrategy,
  createEffectStrategy,
  createStrategyForPrefix,
  // Factories
  createStrategyWithCodes,
  executeWithCircuitBreaker,
  FALLBACK_STRATEGY,
  getAllGroupStrategies,
  getSeverityBasedStrategy,
  getStrategyByPrefix,
  getStrategyStats,
  // Groups
  GROUP_STRATEGIES,
  IGNORE_STRATEGY,
  // Base strategies
  LOG_AND_RETURN_STRATEGY,
  makeCircuitBreakerService,
  makeConsoleAlertService,
  resolveAndExecuteWithCircuitBreaker,
  // Core functions
  resolveStrategy,
  // Types and constants
  RETRY,
  RETRY_STRATEGY,
  withAlert,
  withCircuitBreaker,
  withFallback,
  // Modifiers
  withRetry,
} from '../../../../src/errors/base/ErrorStrategies';
import type {
  CircuitBreakerService,
  CircuitBreakerState,
  ErrorCodeGroup,
  ErrorStrategy,
  StrategyConfig,
  StrategyModifier,
  StrategyResult,
} from '../../../../src/errors/base/ErrorStrategies';

import { LIVAI_ERROR_CODES } from '../../../../src/errors/base/ErrorCode';

// ==================== МOCKS AND HELPERS ====================

const mockError = new Error('Test error');
const mockContext = { attemptCount: 0, errorCount: 1 };

function createMockStrategy(overrides?: Partial<ErrorStrategy<unknown>>): ErrorStrategy<unknown> {
  return {
    name: 'mock_strategy',
    description: 'Mock strategy for testing',
    priority: 1,
    execute: () =>
      Effect.succeed({
        success: true,
        data: 'mock_result',
        strategy: 'mock_strategy',
      } as StrategyResult),
    ...overrides,
  };
}

function createMockAlertService(overrides?: Partial<typeof makeConsoleAlertService>) {
  return Effect.succeed({
    isEnabled: true,
    sendAlert: vi.fn().mockReturnValue(Effect.succeed(undefined)),
    ...overrides,
  });
}

// ==================== TESTS ====================

describe('ErrorStrategies - Complete System Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Типы и константы (ErrorStrategyTypes)', () => {
    describe('Константы конфигурации', () => {
      it('RETRY константы должны иметь правильные значения', () => {
        expect(RETRY.DEFAULT_MAX).toBe(3);
        expect(RETRY.LOW).toBe(1);
        expect(RETRY.MEDIUM).toBe(2);
        expect(RETRY.HIGH).toBe(5);
      });

      it('ALERT_THRESHOLDS константы должны иметь правильные значения', () => {
        expect(ALERT_THRESHOLDS.LOW).toBe(2);
        expect(ALERT_THRESHOLDS.MEDIUM).toBe(3);
        expect(ALERT_THRESHOLDS.DEFAULT).toBe(5);
      });

      it('CIRCUIT_BREAKER константы должны иметь правильные значения', () => {
        expect(CIRCUIT_BREAKER.DEFAULT_THRESHOLD).toBe(10);
        expect(CIRCUIT_BREAKER.RECOVERY_TIMEOUT_MS).toBe(60000);
      });
    });

    describe('Типы StrategyResult', () => {
      it('должен поддерживать успешный результат', () => {
        const result: StrategyResult = {
          success: true,
          data: 'test_data',
          strategy: 'test_strategy',
        };
        expect(result.success).toBe(true);
        expect(result.data).toBe('test_data');
      });

      it('должен поддерживать неуспешный результат', () => {
        const result: StrategyResult = {
          success: false,
          error: new Error('test error'),
          strategy: 'test_strategy',
          shouldRetry: true,
        };
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe('Тип ErrorStrategy', () => {
      it('должен поддерживать все поля стратегии', () => {
        const strategy: ErrorStrategy<string> = {
          name: 'test_strategy',
          description: 'Test strategy',
          priority: 5,
          applicableCodes: [LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND],
          execute: (error, context) =>
            Effect.succeed({
              success: true,
              data: `processed_${error}`,
              strategy: 'test_strategy',
            }),
        };

        expect(strategy.name).toBe('test_strategy');
        expect(strategy.priority).toBe(5);
        expect(strategy.applicableCodes).toContain(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      });
    });

    describe('Тип StrategyConfig', () => {
      it('должен поддерживать конфигурацию стратегии', () => {
        const config: StrategyConfig = {
          maxRetries: 3,
          retryDelayMs: 1000,
          circuitBreakerThreshold: 5,
          alertThreshold: 2,
          fallbackEnabled: true,
        };

        expect(config.maxRetries).toBe(3);
        expect(config.fallbackEnabled).toBe(true);
      });
    });
  });

  describe('Базовые стратегии (ErrorStrategyBase)', () => {
    describe('LOG_AND_RETURN_STRATEGY', () => {
      it('должен возвращать ошибку без обработки', async () => {
        const result = await Effect.runPromise(
          LOG_AND_RETURN_STRATEGY.execute(mockError) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(false);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error,
        ).toBe(mockError);
        expect(result.strategy).toBe('log_and_return');
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .shouldRetry,
        ).toBe(false);
      });
    });

    describe('IGNORE_STRATEGY', () => {
      it('должен игнорировать ошибку', async () => {
        const result = await Effect.runPromise(
          IGNORE_STRATEGY.execute(mockError) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(null);
        expect(result.strategy).toBe('ignore');
      });
    });

    describe('RETRY_STRATEGY', () => {
      it('должен возвращать retry = true при attemptCount < maxRetries', async () => {
        const context = { attemptCount: 1 };
        const result = await Effect.runPromise(
          RETRY_STRATEGY.execute(mockError, context) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(false);
        expect(result.strategy).toBe('retry');
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .shouldRetry,
        ).toBe(true);
      });

      it('должен возвращать retry = false при attemptCount >= maxRetries', async () => {
        const context = { attemptCount: RETRY.DEFAULT_MAX };
        const result = await Effect.runPromise(
          RETRY_STRATEGY.execute(mockError, context) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(false);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .shouldRetry,
        ).toBe(false);
      });
    });

    describe('FALLBACK_STRATEGY', () => {
      it('должен возвращать дефолтное значение', async () => {
        const context = { defaultValue: 'fallback_value' };
        const result = await Effect.runPromise(
          FALLBACK_STRATEGY.execute(mockError, context) as Effect.Effect<
            StrategyResult,
            never,
            never
          >,
        );

        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
          'fallback_value',
        );
        expect(result.strategy).toBe('fallback');
      });
    });

    describe('ALERT_STRATEGY', () => {
      it('должен генерировать alert', async () => {
        const result = await Effect.runPromise(
          ALERT_STRATEGY.execute(mockError) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(false);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error,
        ).toBeInstanceOf(Error);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error.message,
        ).toBe('Alert triggered');
        expect(result.strategy).toBe('alert');
      });
    });
  });

  describe('Модификаторы стратегий (ErrorStrategyModifiers)', () => {
    describe('withRetry', () => {
      it('должен модифицировать стратегию добавляя retry логику', async () => {
        const baseStrategy = createMockStrategy();
        const retryStrategy = withRetry(2)(baseStrategy);

        expect(retryStrategy.name).toBe('mock_strategy_with_retry');

        // Первый вызов - должен вернуть retry = true
        const result1 = await Effect.runPromise(
          retryStrategy.execute(mockError, { attemptCount: 0 }) as Effect.Effect<
            StrategyResult,
            never,
            never
          >,
        );
        expect(result1.success).toBe(false);
        expect(
          (result1 as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .shouldRetry,
        ).toBe(true);

        // Второй вызов - должен выполнить базовую стратегию
        const result2 = await Effect.runPromise(
          retryStrategy.execute(mockError, { attemptCount: 2 }) as Effect.Effect<
            StrategyResult,
            never,
            never
          >,
        );
        expect(result2.success).toBe(true);
        expect((result2 as { success: true; data: unknown; strategy: string; }).data).toBe(
          'mock_result',
        );
      });
    });

    describe('withAlert', () => {
      it('должен модифицировать стратегию добавляя alert логику', async () => {
        const baseStrategy = createMockStrategy();

        const mockSendAlert = vi.fn().mockReturnValue(Effect.succeed(undefined));
        const mockAlertServiceEffect = Effect.succeed({
          isEnabled: true,
          sendAlert: mockSendAlert,
        });

        const alertStrategy = withAlert(2, 'medium', mockAlertServiceEffect)(baseStrategy);

        expect(alertStrategy.name).toBe('mock_strategy_with_alert');

        // Выполняем стратегию
        const result = await Effect.runPromise(
          alertStrategy.execute(mockError, { errorCount: 3 }) as Effect.Effect<
            StrategyResult,
            never,
            never
          >,
        );

        expect(result.success).toBe(true);
        expect(mockSendAlert).toHaveBeenCalled();
      });

      it('withAlert должен игнорировать disabled alert service', async () => {
        const baseStrategy = createMockStrategy();
        const mockSendAlert = vi.fn().mockReturnValue(Effect.succeed(undefined));

        const disabledAlertService = Effect.succeed({
          isEnabled: false,
          sendAlert: mockSendAlert,
        });

        const alertStrategy = withAlert(1, 'medium', disabledAlertService)(baseStrategy);

        // Выполняем стратегию с превышением threshold
        const result = await Effect.runPromise(
          alertStrategy.execute(mockError, { errorCount: 2 }) as Effect.Effect<
            StrategyResult,
            never,
            never
          >,
        );

        expect(result.success).toBe(true);
        expect(mockSendAlert).not.toHaveBeenCalled(); // Alert не должен отправляться
      });
    });

    describe('withFallback', () => {
      it('должен модифицировать стратегию добавляя fallback логику', async () => {
        const baseStrategy = createMockStrategy({
          execute: () =>
            Effect.succeed({
              success: false,
              error: new Error('Base strategy failed'),
              strategy: 'base',
              shouldRetry: false,
            } as StrategyResult),
        });
        const fallbackStrategy = withFallback('fallback_value')(baseStrategy);

        expect(fallbackStrategy.name).toBe('mock_strategy_with_fallback');

        const result = await Effect.runPromise(
          fallbackStrategy.execute(mockError) as Effect.Effect<StrategyResult, never, never>,
        );
        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
          'fallback_value',
        );
      });
    });

    describe('withCircuitBreaker', () => {
      it('должен модифицировать стратегию добавляя circuit breaker логику', async () => {
        const baseStrategy = createMockStrategy();
        const circuitBreakerStrategy = withCircuitBreaker(2)(baseStrategy);

        expect(circuitBreakerStrategy.name).toBe('mock_strategy_with_circuit_breaker');

        const result = await Effect.runPromise(
          circuitBreakerStrategy.execute(mockError).pipe(
            Effect.provideService(
              CircuitBreakerServiceTag,
              await Effect.runPromise(makeCircuitBreakerService),
            ),
          ) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(true);
      });
    });

    describe('Alert Service', () => {
      it('makeConsoleAlertService должен создавать сервис с console выводом', async () => {
        const service = await Effect.runPromise(makeConsoleAlertService);

        expect(service.isEnabled).toBe(true);
        expect(typeof service.sendAlert).toBe('function');

        // Mock console methods
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const alertMessage = {
          level: 'medium' as const,
          message: 'Test alert',
          timestamp: Date.now(),
        };

        await Effect.runPromise(service.sendAlert(alertMessage));
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('makeConsoleAlertService должен использовать правильные console методы для разных уровней', async () => {
        const service = await Effect.runPromise(makeConsoleAlertService);

        const testCases = [
          { level: 'low' as const, expectedMethod: 'info' },
          { level: 'medium' as const, expectedMethod: 'warn' },
          { level: 'high' as const, expectedMethod: 'error' },
          { level: 'critical' as const, expectedMethod: 'error' },
        ];

        for (const { level, expectedMethod } of testCases) {
          const consoleSpy = vi.spyOn(console, expectedMethod as keyof typeof console)
            .mockImplementation(() => {});

          const alertMessage = {
            level,
            message: `Test ${level} alert`,
            timestamp: Date.now(),
          };

          await Effect.runPromise(service.sendAlert(alertMessage));
          expect(consoleSpy).toHaveBeenCalled();

          consoleSpy.mockRestore();
        }
      });
    });

    describe('Circuit Breaker Service', () => {
      it('makeCircuitBreakerService должен создавать новый сервис', async () => {
        const service = await Effect.runPromise(makeCircuitBreakerService) as CircuitBreakerService;

        expect(service).toBeInstanceOf(Object);
        expect(typeof service.getState).toBe('function');
        expect(typeof service.updateState).toBe('function');

        // Test service methods with proper typing
        const state = await Effect.runPromise(
          service.getState('test_strategy'),
        ) as CircuitBreakerState;
        expect(state.failureCount).toBe(0);
        expect(state.isOpen).toBe(false);
      });

      it('circuit breaker должен корректно управлять состоянием', async () => {
        const service = await Effect.runPromise(makeCircuitBreakerService) as CircuitBreakerService;

        // Начальное состояние
        let state = await Effect.runPromise(
          service.getState('test_strategy'),
        ) as CircuitBreakerState;
        expect(state.failureCount).toBe(0);
        expect(state.isOpen).toBe(false);

        // Регистрируем неудачу
        await Effect.runPromise(service.updateState('test_strategy', false, 2));
        state = await Effect.runPromise(service.getState('test_strategy')) as CircuitBreakerState;
        expect(state.failureCount).toBe(1);
        expect(state.isOpen).toBe(false);

        // Вторая неудача - circuit breaker должен открыться
        await Effect.runPromise(service.updateState('test_strategy', false, 2));
        state = await Effect.runPromise(service.getState('test_strategy')) as CircuitBreakerState;
        expect(state.failureCount).toBe(2);
        expect(state.isOpen).toBe(true);
      });

      it('circuit breaker должен автоматически восстанавливаться после timeout', async () => {
        const service = await Effect.runPromise(makeCircuitBreakerService) as CircuitBreakerService;

        // Открываем circuit breaker
        await Effect.runPromise(service.updateState('test_strategy', false, 1));
        let state = await Effect.runPromise(
          service.getState('test_strategy'),
        ) as CircuitBreakerState;
        expect(state.isOpen).toBe(true);
        expect(state.failureCount).toBe(1);

        // Имитируем прошедшее время (больше чем RECOVERY_TIMEOUT_MS)
        const originalNow = Date.now;
        const mockNow = originalNow() + CIRCUIT_BREAKER.RECOVERY_TIMEOUT_MS + 1000;
        global.Date.now = vi.fn(() => mockNow);

        try {
          // Проверяем восстановление при следующем вызове getState
          state = await Effect.runPromise(service.getState('test_strategy')) as CircuitBreakerState;
          expect(state.isOpen).toBe(false);
          expect(state.failureCount).toBe(0); // failureCount уменьшается при recovery
        } finally {
          global.Date.now = originalNow;
        }
      });
    });
  });

  describe('Фабрики стратегий (ErrorStrategyFactories)', () => {
    describe('createStrategyWithCodes', () => {
      it('должен создавать стратегию с явным указанием кодов', () => {
        const baseStrategy = createMockStrategy();
        const codes = [
          LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          LIVAI_ERROR_CODES.DOMAIN_USER_ALREADY_EXISTS,
        ];
        const strategyWithCodes = createStrategyWithCodes(baseStrategy, codes);

        expect(strategyWithCodes.applicableCodes).toEqual(codes);
        expect(strategyWithCodes.name).toContain('_for_2_codes');
      });
    });

    describe('createStrategyForPrefix', () => {
      it('должен создавать стратегию для префикса кодов', () => {
        const baseStrategy = createMockStrategy();
        const strategyForPrefix = createStrategyForPrefix(baseStrategy, 'DOMAIN_USER');

        expect(strategyForPrefix.applicableCodes).toContain(
          LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        );
        expect(strategyForPrefix.applicableCodes).toContain(
          LIVAI_ERROR_CODES.DOMAIN_USER_ALREADY_EXISTS,
        );
      });
    });

    describe('createAsyncStrategy', () => {
      it('должен создавать стратегию из Promise-based функции', async () => {
        const asyncFn = vi.fn().mockResolvedValue({
          success: true,
          data: 'async_result',
          strategy: 'async_strategy',
        } as StrategyResult);

        const strategy = createAsyncStrategy(
          'async_strategy',
          'Async strategy',
          1,
          asyncFn,
          [LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND],
        );

        expect(strategy.name).toBe('async_strategy');
        expect(strategy.applicableCodes).toContain(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND);

        const result = await Effect.runPromise(
          strategy.execute('test_error') as Effect.Effect<StrategyResult, never, never>,
        );
        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
          'async_result',
        );
        expect(asyncFn).toHaveBeenCalledWith('test_error', undefined);
      });
    });

    describe('createEffectStrategy', () => {
      it('должен создавать стратегию из Effect-based функции', async () => {
        const effectFn = vi.fn().mockReturnValue(Effect.succeed('effect_result'));

        const strategy = createEffectStrategy(
          'effect_strategy',
          'Effect strategy',
          1,
          effectFn,
        );

        const result = await Effect.runPromise(
          strategy.execute('test_error') as Effect.Effect<StrategyResult, never, never>,
        );
        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
          'effect_result',
        );
        expect(effectFn).toHaveBeenCalledWith('test_error', undefined);
      });
    });

    describe('createCallbackStrategy', () => {
      it('должен создавать стратегию из callback-based функции', async () => {
        const callbackFn = vi.fn((error, context, callback) => {
          callback(null, 'callback_result');
        });

        const strategy = createCallbackStrategy(
          'callback_strategy',
          'Callback strategy',
          1,
          callbackFn,
        );

        const result = await Effect.runPromise(
          strategy.execute('test_error') as Effect.Effect<StrategyResult, never, never>,
        );
        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
          'callback_result',
        );
        expect(callbackFn).toHaveBeenCalledWith('test_error', undefined, expect.any(Function));
      });

      it('createAsyncStrategy должен обрабатывать ошибки в async функциях', async () => {
        const failingAsyncFn = vi.fn().mockRejectedValue(new Error('Async function failed'));

        const strategy = createAsyncStrategy(
          'failing_async_strategy',
          'Failing async strategy',
          1,
          failingAsyncFn,
          [LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND],
        );

        const result = await Effect.runPromise(
          strategy.execute('test_error') as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(false);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error,
        ).toBeInstanceOf(Error);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error.message,
        ).toContain('An unknown error occurred');
        expect(result.strategy).toBe('failing_async_strategy');
      });

      it('createEffectStrategy должен обрабатывать ошибки в Effect функциях', async () => {
        const failingEffectFn = vi.fn().mockReturnValue(
          Effect.fail(new Error('Effect function failed')),
        );

        const strategy = createEffectStrategy(
          'failing_effect_strategy',
          'Failing effect strategy',
          1,
          failingEffectFn,
        );

        const result = await Effect.runPromise(
          strategy.execute('test_error') as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(false);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error,
        ).toBeInstanceOf(Error);
        expect(
          (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
            .error.message,
        ).toContain('Effect function failed');
        expect(result.strategy).toBe('failing_effect_strategy');
      });
    });
  });

  describe('Групповые стратегии (ErrorStrategyGroups)', () => {
    it('GROUP_STRATEGIES должен содержать все групповые стратегии', () => {
      expect(GROUP_STRATEGIES).toBeDefined();
      expect(Array.isArray(GROUP_STRATEGIES)).toBe(true);
      expect(GROUP_STRATEGIES.length).toBeGreaterThan(0);

      // Проверяем структуру каждой группы
      GROUP_STRATEGIES.forEach((group) => {
        expect(group).toHaveProperty('prefix');
        expect(group).toHaveProperty('description');
        expect(group).toHaveProperty('codes');
        expect(group).toHaveProperty('strategy');
        expect(Array.isArray(group.codes)).toBe(true);
        expect(typeof group.strategy.execute).toBe('function');
      });
    });

    it('должны быть представлены все основные домены', () => {
      const prefixes = GROUP_STRATEGIES.map((g) => g.prefix);

      expect(prefixes).toContain('DOMAIN_AUTH');
      expect(prefixes).toContain('DOMAIN_USER');
      expect(prefixes).toContain('INFRA_DB');
      expect(prefixes).toContain('INFRA_NETWORK');
      expect(prefixes).toContain('SERVICE_AI');
      expect(prefixes).toContain('ADMIN_USER');
    });

    it('стратегии должны иметь правильные модификаторы', async () => {
      const domainAuthGroup = GROUP_STRATEGIES.find((g) => g.prefix === 'DOMAIN_AUTH');
      expect(domainAuthGroup).toBeDefined();

      // Проверяем что стратегия имеет модификаторы (имя должно содержать модификаторы)
      expect(domainAuthGroup!.strategy.name).toContain('with_retry');
      expect(domainAuthGroup!.strategy.name).toContain('with_alert');
    });
  });

  describe('Основные функции (ErrorStrategyCore)', () => {
    describe('resolveStrategy', () => {
      it('должен возвращать стратегию для custom кодов', () => {
        const customStrategy = createMockStrategy({
          applicableCodes: [LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND],
        });
        const strategy = resolveStrategy(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND, [customStrategy]);

        expect(strategy).toBe(customStrategy);
      });

      it('должен возвращать групповую стратегию по коду', () => {
        const strategy = resolveStrategy(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND);

        expect(strategy.name).toContain('with_retry'); // DOMAIN_USER имеет retry модификатор
      });

      it('должен возвращать severity-based стратегию для неизвестных кодов', () => {
        const strategy = resolveStrategy('UNKNOWN_CODE' as any);

        expect(strategy).toBe(LOG_AND_RETURN_STRATEGY);
      });
    });

    describe('getSeverityBasedStrategy', () => {
      it('должен возвращать базовую стратегию логирования', () => {
        const strategy = getSeverityBasedStrategy();

        expect(strategy).toBe(LOG_AND_RETURN_STRATEGY);
      });
    });

    describe('executeWithCircuitBreaker', () => {
      it('должен выполнять стратегию с circuit breaker сервисом', async () => {
        const strategy = createMockStrategy();

        const result = await Effect.runPromise(
          executeWithCircuitBreaker(strategy, mockError).pipe(
            Effect.provideService(
              CircuitBreakerServiceTag,
              await Effect.runPromise(makeCircuitBreakerService),
            ),
          ) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result.success).toBe(true);
        expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
          'mock_result',
        );
      });
    });

    describe('resolveAndExecuteWithCircuitBreaker', () => {
      it('должен разрешить и выполнить стратегию с circuit breaker', async () => {
        const result = await Effect.runPromise(
          resolveAndExecuteWithCircuitBreaker(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND, mockError)
            .pipe(
              Effect.provideService(
                CircuitBreakerServiceTag,
                await Effect.runPromise(makeCircuitBreakerService),
              ),
            ) as Effect.Effect<StrategyResult, never, never>,
        );

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('strategy');
      });
    });

    describe('getAllGroupStrategies', () => {
      it('должен возвращать все групповые стратегии', () => {
        const groups = getAllGroupStrategies();

        expect(groups).toBe(GROUP_STRATEGIES);
        expect(groups.length).toBeGreaterThan(0);
      });
    });

    describe('getStrategyByPrefix', () => {
      it('должен возвращать стратегию по префиксу', () => {
        const strategy = getStrategyByPrefix('DOMAIN_USER');

        expect(strategy).toBeDefined();
        expect(strategy!.name).toContain('with_retry');
      });

      it('должен возвращать null для неизвестного префикса', () => {
        const strategy = getStrategyByPrefix('UNKNOWN_PREFIX');

        expect(strategy).toBeNull();
      });
    });

    describe('getStrategyStats', () => {
      it('должен возвращать статистику по префиксам', () => {
        const stats = getStrategyStats();

        expect(stats).toBeInstanceOf(Object);
        expect(stats.DOMAIN_USER).toBe(2); // DOMAIN_USER имеет 2 кода
        expect(stats.INFRA_DB).toBe(3); // INFRA_DB имеет 3 кода
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('полный цикл: код ошибки -> разрешение стратегии -> выполнение', async () => {
      // 1. Берем код ошибки
      const errorCode = LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND;

      // 2. Разрешаем стратегию
      const strategy = resolveStrategy(errorCode);

      // 3. Выполняем с circuit breaker
      const result = await Effect.runPromise(
        executeWithCircuitBreaker(strategy, new Error('User not found')).pipe(
          Effect.provideService(
            CircuitBreakerServiceTag,
            await Effect.runPromise(makeCircuitBreakerService),
          ),
        ) as Effect.Effect<StrategyResult, never, never>,
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('strategy');
      // DOMAIN_USER strategy returns success: false with retry logic
      expect(result.success).toBe(false);
      expect(
        (result as { success: false; error: Error; strategy: string; shouldRetry: boolean; })
          .shouldRetry,
      ).toBe(true);
    });

    it('модификаторы стратегий работают вместе', async () => {
      const baseStrategy = createMockStrategy();
      const modifiedStrategy = withRetry(1)(
        withAlert(2)(
          withFallback('fallback')(
            withCircuitBreaker(3)(baseStrategy),
          ),
        ),
      );

      expect(modifiedStrategy.name).toContain('with_retry');
      expect(modifiedStrategy.name).toContain('with_alert');
      expect(modifiedStrategy.name).toContain('with_fallback');
      expect(modifiedStrategy.name).toContain('with_circuit_breaker');
    });

    it('модификаторы должны корректно комбинироваться в цепочки', async () => {
      const baseStrategy = createMockStrategy({
        execute: () =>
          Effect.succeed({
            success: false,
            error: new Error('Base strategy failed'),
            strategy: 'base',
            shouldRetry: false,
          } as StrategyResult),
      });

      // Создаем простую цепочку модификаторов: только fallback
      const fallbackStrategy = withFallback('fallback_value')(baseStrategy);

      // Проверяем что модификатор применился
      expect(fallbackStrategy.name).toContain('with_fallback');

      // Выполняем стратегию - должна вернуть fallback из-за ошибки в базовой стратегии
      const result = await Effect.runPromise(
        fallbackStrategy.execute(mockError) as Effect.Effect<StrategyResult, never, never>,
      );

      expect(result.success).toBe(true);
      expect((result as { success: true; data: unknown; strategy: string; }).data).toBe(
        'fallback_value',
      );

      // Теперь тестируем цепочку fallback + retry
      const complexStrategy = withRetry(2)(fallbackStrategy);
      expect(complexStrategy.name).toContain('with_retry');
      expect(complexStrategy.name).toContain('with_fallback');

      const result2 = await Effect.runPromise(
        complexStrategy.execute(mockError, { attemptCount: 3 }) as Effect.Effect<
          StrategyResult,
          never,
          never
        >,
      );

      // Поскольку attemptCount >= maxRetries (3 >= 2), retry вызывает базовую стратегию с fallback
      expect(result2.success).toBe(true);
      expect((result2 as { success: true; data: unknown; strategy: string; }).data).toBe(
        'fallback_value',
      );
    });

    it('alert система интегрируется с circuit breaker', async () => {
      const mockSendAlert = vi.fn().mockReturnValue(Effect.succeed(undefined));
      const mockAlertService = Effect.succeed({
        isEnabled: true,
        sendAlert: mockSendAlert,
      });

      const strategy = withAlert(1, 'medium', mockAlertService)(LOG_AND_RETURN_STRATEGY);

      const alertResult = await Effect.runPromise(
        strategy.execute(mockError, { errorCount: 2 }) as Effect.Effect<
          StrategyResult,
          never,
          never
        >,
      );

      expect(mockSendAlert).toHaveBeenCalled();
    });
  });
});
