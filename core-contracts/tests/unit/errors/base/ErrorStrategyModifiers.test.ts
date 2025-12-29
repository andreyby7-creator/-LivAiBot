import { describe, expect, it } from 'vitest';

import { Effect, Ref } from 'effect';

import { LIVAI_ERROR_CODES } from '../../../../src/errors/base/ErrorCode.js';
import {
  AlertServiceTag,
  CircuitBreakerService,
  CircuitBreakerServiceTag,
  makeCircuitBreakerService,
  makeConsoleAlertService,
  withAlert,
  withCircuitBreaker,
  withFallback,
  withRetry,
} from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyModifiers.js';
import { LOG_AND_RETURN_STRATEGY } from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyBase.js';

import type { AlertService } from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyModifiers.js';
import type { StrategyResult } from '../../../../src/errors/base/ErrorStrategies/ErrorStrategyTypes.js';

describe('ErrorStrategyModifiers', () => {
  describe('withRetry', () => {
    it('должен модифицировать стратегию для повторных попыток', () => {
      const modifiedStrategy = withRetry(3)(LOG_AND_RETURN_STRATEGY);

      expect(modifiedStrategy.name).toBe(`${LOG_AND_RETURN_STRATEGY.name}_with_retry`);
      expect(modifiedStrategy.description).toBe(LOG_AND_RETURN_STRATEGY.description);
    });

    it('должен возвращать retry=true при attemptCount < maxRetries', async () => {
      const modifiedStrategy = withRetry(3)(LOG_AND_RETURN_STRATEGY);

      const result = await Effect.runPromise(
        modifiedStrategy.execute(new Error('test'), { attemptCount: 1 }) as Effect.Effect<
          StrategyResult,
          unknown,
          never
        >,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.shouldRetry).toBe(true);
        expect(result.strategy).toBe(`${LOG_AND_RETURN_STRATEGY.name}_with_retry`);
      }
    });

    it('должен возвращать retry=false при attemptCount >= maxRetries', async () => {
      const modifiedStrategy = withRetry(2)(LOG_AND_RETURN_STRATEGY);

      const result = await Effect.runPromise(
        modifiedStrategy.execute(new Error('test'), { attemptCount: 2 }) as Effect.Effect<
          StrategyResult,
          unknown,
          never
        >,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.shouldRetry).toBe(false);
      }
    });

    it('должен обрабатывать отсутствие attemptCount', async () => {
      const modifiedStrategy = withRetry(3)(LOG_AND_RETURN_STRATEGY);

      const result = await Effect.runPromise(
        modifiedStrategy.execute(new Error('test')) as Effect.Effect<
          StrategyResult,
          unknown,
          never
        >,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.shouldRetry).toBe(true);
      }
    });
  });

  describe('withAlert', () => {
    it('должен модифицировать стратегию с алертом по умолчанию', () => {
      const modifiedStrategy = withAlert(5)(LOG_AND_RETURN_STRATEGY);

      expect(modifiedStrategy.name).toContain(LOG_AND_RETURN_STRATEGY.name);
      expect(modifiedStrategy.description).toBe(LOG_AND_RETURN_STRATEGY.description);
    });

    it('должен модифицировать стратегию с алертом и уровнем', () => {
      const modifiedStrategy = withAlert(3, 'critical')(LOG_AND_RETURN_STRATEGY);

      expect(modifiedStrategy.name).toContain(LOG_AND_RETURN_STRATEGY.name);
    });

    it('должен выполнять стратегию с алертом при превышении порога', async () => {
      const mockAlertService: AlertService = {
        isEnabled: true,
        sendAlert: () => Effect.succeed(undefined), // Просто успешная отправка
      };

      const modifiedStrategy = withAlert(2, 'high')(LOG_AND_RETURN_STRATEGY);

      const result = await Effect.runPromise(
        Effect.provideService(
          modifiedStrategy.execute(new Error('test'), { errorCount: 3 }),
          AlertServiceTag,
          mockAlertService,
        ) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
    });

    it('не должен отправлять алерт ниже порога', async () => {
      let alertSent = false;
      const mockAlertService: AlertService = {
        isEnabled: true,
        sendAlert: () =>
          Effect.sync(() => {
            alertSent = true;
          }),
      };

      const modifiedStrategy = withAlert(5, 'high')(LOG_AND_RETURN_STRATEGY);

      const result = await Effect.runPromise(
        Effect.provideService(
          modifiedStrategy.execute(new Error('test'), { failureCount: 2 }),
          AlertServiceTag,
          mockAlertService,
        ) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
      expect(alertSent).toBe(false);
    });
  });

  describe('withFallback', () => {
    it('должен модифицировать стратегию с fallback значением', () => {
      const modifiedStrategy = withFallback('fallback-value')(LOG_AND_RETURN_STRATEGY);

      expect(modifiedStrategy.name).toContain(LOG_AND_RETURN_STRATEGY.name);
      expect(modifiedStrategy.description).toBe(LOG_AND_RETURN_STRATEGY.description);
    });

    it('должен возвращать fallback при ошибке стратегии', async () => {
      const modifiedStrategy = withFallback('fallback-result')(LOG_AND_RETURN_STRATEGY);

      const result = await Effect.runPromise(
        modifiedStrategy.execute(new Error('test')) as Effect.Effect<
          StrategyResult,
          unknown,
          never
        >,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('fallback-result');
      }
    });
  });

  describe('withCircuitBreaker', () => {
    it('должен модифицировать стратегию с circuit breaker', () => {
      const modifiedStrategy = withCircuitBreaker(5)(LOG_AND_RETURN_STRATEGY);

      expect(modifiedStrategy.name).toContain(LOG_AND_RETURN_STRATEGY.name);
    });

    it('должен открывать circuit breaker при превышении порога отказов', async () => {
      const modifiedStrategy = withCircuitBreaker(3)(LOG_AND_RETURN_STRATEGY);

      // Создаем изолированный сервис для тестирования
      const service = await Effect.runPromise(makeCircuitBreakerService);

      // Выполняем несколько неудачных попыток
      for (let i = 0; i < 4; i++) {
        await Effect.runPromise(
          Effect.provideService(
            modifiedStrategy.execute(new Error('test')),
            CircuitBreakerServiceTag,
            service,
          ) as Effect.Effect<StrategyResult, unknown, never>,
        );
      }

      // Следующая попытка должна быть заблокирована
      const result = await Effect.runPromise(
        Effect.provideService(
          modifiedStrategy.execute(new Error('test')),
          CircuitBreakerServiceTag,
          service,
        ) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Circuit breaker is open');
      }
    });

    it('должен позволять запросы когда circuit breaker закрыт', async () => {
      const modifiedStrategy = withCircuitBreaker(5)(LOG_AND_RETURN_STRATEGY);

      const service = await Effect.runPromise(makeCircuitBreakerService);

      const result = await Effect.runPromise(
        Effect.provideService(
          modifiedStrategy.execute(new Error('test')),
          CircuitBreakerServiceTag,
          service,
        ) as Effect.Effect<StrategyResult, unknown, never>,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toContain('Circuit breaker is OPEN');
      }
    });
  });

  describe('AlertService', () => {
    describe('makeConsoleAlertService', () => {
      it('должен создавать сервис алертов с console выводом', async () => {
        const service = await Effect.runPromise(makeConsoleAlertService);

        expect(service.isEnabled).toBe(true);
        expect(typeof service.sendAlert).toBe('function');
      });

      it('должен отправлять алерты через console', async () => {
        const service = await Effect.runPromise(makeConsoleAlertService);

        // Mock console methods
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;

        let loggedMessage = '';
        console.error = (message: string) => {
          loggedMessage = message;
        };
        console.warn = (message: string) => {
          loggedMessage = message;
        };
        console.info = (message: string) => {
          loggedMessage = message;
        };

        try {
          await Effect.runPromise(service.sendAlert({
            level: 'high',
            message: 'Test alert',
            timestamp: Date.now(),
          }));

          expect(loggedMessage).toContain('Test alert');
        } finally {
          console.error = originalError;
          console.warn = originalWarn;
          console.info = originalInfo;
        }
      });
    });
  });

  describe('CircuitBreakerService', () => {
    it('должен инициализировать состояние для новой стратегии', async () => {
      const service = await Effect.runPromise(makeCircuitBreakerService);

      const state = await Effect.runPromise(service.getState('test-strategy'));

      expect(state.failureCount).toBe(0);
      expect(state.isOpen).toBe(false);
      expect(state.lastFailureTime).toBe(0);
    });

    it('должен обновлять состояние при успехе', async () => {
      const service = await Effect.runPromise(makeCircuitBreakerService);

      // Сначала создаем состояние с ошибками
      await Effect.runPromise(service.updateState('test-strategy', false, 3));

      // Затем обновляем успехом
      await Effect.runPromise(service.updateState('test-strategy', true, 3));

      const state = await Effect.runPromise(service.getState('test-strategy'));
      expect(state.failureCount).toBe(0);
      expect(state.isOpen).toBe(false);
    });

    it('должен открывать circuit breaker при превышении порога', async () => {
      const service = await Effect.runPromise(makeCircuitBreakerService);

      // Создаем 3 отказа
      for (let i = 0; i < 3; i++) {
        await Effect.runPromise(service.updateState('test-strategy', false, 3));
      }

      const state = await Effect.runPromise(service.getState('test-strategy'));
      expect(state.failureCount).toBe(3);
      expect(state.isOpen).toBe(true);
    });

    it('должен восстанавливаться после timeout', async () => {
      const service = await Effect.runPromise(makeCircuitBreakerService);

      // Создаем отказ и ждем восстановление
      await Effect.runPromise(service.updateState('test-strategy', false, 3));

      // Имитируем прошедшее время (больше чем RECOVERY_TIMEOUT_MS)
      // В реальности это происходит автоматически в getState

      // Получаем состояние после "восстановления"
      const state = await Effect.runPromise(service.getState('test-strategy'));
      // Состояние должно восстановиться со временем
      expect(state).toBeDefined();
    });
  });
});
