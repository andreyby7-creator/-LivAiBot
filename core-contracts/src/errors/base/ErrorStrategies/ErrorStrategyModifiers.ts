/**
 * @file ErrorStrategyModifiers.ts - Модификаторы стратегий обработки ошибок
 */

import { Context, Effect, Ref } from 'effect';

import { CIRCUIT_BREAKER, RETRY } from './ErrorStrategyTypes.js';

import type { LivAiErrorCode } from '../ErrorCode.js';
import type { ErrorStrategy, StrategyModifier, StrategyResult } from './ErrorStrategyTypes.js';

// ==================== ALERT TYPES ====================

/** Уровень важности alert сообщения */
export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

/** Alert сообщение */
export type AlertMessage = Readonly<{
  level: AlertLevel;
  message: string;
  errorCode?: LivAiErrorCode;
  strategyName?: string;
  context?: Record<string, unknown>;
  timestamp: number;
}>;

/** Интерфейс alert сервиса */
export type AlertService = {
  readonly sendAlert: (alert: AlertMessage) => Effect.Effect<void, never, never>;
  readonly isEnabled: boolean;
};

// ==================== STRATEGY MODIFIERS ====================

/** Retry стратегия */
export function withRetry(maxRetries: number): StrategyModifier<unknown> {
  return (strategy: ErrorStrategy<unknown>) => ({
    ...strategy,
    name: `${strategy.name}_with_retry`,
    execute: (error: unknown, context?: Record<string, unknown>) =>
      Effect.suspend(() => {
        const attemptCount = (context?.['attemptCount'] ?? 0) as number;
        if (attemptCount < maxRetries) {
          return Effect.succeed({
            success: false,
            error: error as Error,
            strategy: `${strategy.name}_with_retry`,
            shouldRetry: true,
          });
        }
        return strategy.execute(error, context);
      }),
  });
}

/** Alert стратегия */
export function withAlert(threshold: number): StrategyModifier<unknown>;
export function withAlert(threshold: number, level: AlertLevel): StrategyModifier<unknown>;
export function withAlert(
  threshold: number,
  level: AlertLevel,
  alertService: Effect.Effect<AlertService, never, never>,
): StrategyModifier<unknown>;
export function withAlert(
  threshold: number,
  level: AlertLevel = 'warning',
  alertService?: Effect.Effect<AlertService, never, never>,
): StrategyModifier<unknown> {
  return (strategy: ErrorStrategy<unknown>) => ({
    ...strategy,
    name: `${strategy.name}_with_alert`,
    execute: (error: unknown, context?: Record<string, unknown>) =>
      (alertService ?? makeConsoleAlertService).pipe(
        Effect.flatMap((service) => {
          if (service.isEnabled) {
            const errorCount = (context?.['errorCount'] ?? 0) as number;
            if (errorCount >= threshold) {
              const alert: AlertMessage = {
                level,
                message:
                  `Alert threshold reached for strategy ${strategy.name}: ${errorCount} errors`,
                strategyName: strategy.name,
                context: { errorCount, threshold, ...context },
                timestamp: Date.now(),
              };

              // Отправляем alert асинхронно, не блокируя основную логику
              return Effect.forkDaemon(service.sendAlert(alert)).pipe(
                Effect.zipRight(strategy.execute(error, context)),
              );
            }
          }

          return strategy.execute(error, context);
        }),
      ),
  });
}

/** Fallback стратегия */
export function withFallback(fallbackValue: unknown): StrategyModifier<unknown> {
  return (strategy: ErrorStrategy<unknown>) => ({
    ...strategy,
    name: `${strategy.name}_with_fallback`,
    execute: (error: unknown, context?: Record<string, unknown>) =>
      strategy.execute(error, context).pipe(
        Effect.map((result) => {
          if (!result.success) {
            return {
              success: true,
              data: fallbackValue,
              strategy: `${strategy.name}_with_fallback`,
            };
          }
          return result;
        }),
      ),
  });
}

/** Circuit breaker стратегия */
export function withCircuitBreaker(failureThreshold: number): StrategyModifier<unknown> {
  return (baseStrategy: ErrorStrategy<unknown>) => {
    // Создаем новую стратегию с circuit breaker логикой
    const circuitBreakerStrategy: ErrorStrategy<unknown> = {
      name: `${baseStrategy.name}_with_circuit_breaker`,
      description:
        `${baseStrategy.description} with circuit breaker (threshold: ${failureThreshold})`,
      priority: Math.max(baseStrategy.priority, RETRY.HIGH), // Высокий приоритет для circuit breaker
      execute: (error: unknown, context?: Record<string, unknown>) =>
        CircuitBreakerServiceTag.pipe(
          Effect.flatMap((service) =>
            service.getState(baseStrategy.name).pipe(
              Effect.flatMap((state) => {
                if (state.isOpen) {
                  return Effect.succeed({
                    success: false,
                    error: new Error(`Circuit breaker is open for strategy: ${baseStrategy.name}`),
                    strategy: circuitBreakerStrategy.name,
                    shouldRetry: false,
                  } as StrategyResult);
                }

                return baseStrategy.execute(error, context).pipe(
                  Effect.tap((result) =>
                    service.updateState(baseStrategy.name, result.success, failureThreshold)
                  ),
                  Effect.map((result) => result),
                );
              }),
            )
          ),
        ),
    };

    return circuitBreakerStrategy;
  };
}

// ==================== ALERT SERVICE ====================

/** Tag для AlertService в Effect Context */
export class AlertServiceTag extends Context.Tag('AlertService')<
  AlertServiceTag,
  AlertService
>() {}

/** Создание базового AlertService с console выводом (для development) */
export const makeConsoleAlertService = Effect.succeed<AlertService>({
  isEnabled: true,
  sendAlert: (alert) =>
    Effect.sync(() => {
      const prefix = `[${alert.level.toUpperCase()}]`;
      const timestamp = new Date(alert.timestamp).toISOString();
      const message = `${prefix} ${timestamp} ${alert.message}`;

      switch (alert.level) {
        case 'critical':
        case 'error':
          console.error(message, alert);
          break;
        case 'warning':
          console.warn(message, alert);
          break;
        default:
          console.info(message, alert);
      }
    }),
});

// ==================== CIRCUIT BREAKER ====================

/** Состояние circuit breaker */
export type CircuitBreakerState = Readonly<{
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}>;

/** Tag для CircuitBreakerService в Effect Context */
export class CircuitBreakerServiceTag extends Context.Tag('CircuitBreakerService')<
  CircuitBreakerServiceTag,
  CircuitBreakerService
>() {}

/**
 * Stateful singleton с side-effects через Ref<Map<...>>.
 * ⚠️ Thread-safe via Ref.modify. Для serverless нужен external storage.
 */
export class CircuitBreakerService {
  constructor(private readonly statesRef: Ref.Ref<Map<string, CircuitBreakerState>>) {}

  /** Получение состояния circuit breaker для стратегии (атомарная операция с recovery) */
  getState(strategyName: string): Effect.Effect<CircuitBreakerState, never, never> {
    return this.statesRef.modify((states) => {
      let state = states.get(strategyName);

      // Инициализируем состояние если не существует
      if (!state) {
        state = { failureCount: 0, lastFailureTime: 0, isOpen: false };
        const newStates = new Map(states).set(strategyName, state);
        return [state, newStates];
      }

      // Проверяем recovery timeout (автоматическое восстановление)
      const now = Date.now();
      if (state.isOpen && now - state.lastFailureTime > CIRCUIT_BREAKER.RECOVERY_TIMEOUT_MS) {
        const recoveredState = {
          failureCount: Math.max(0, state.failureCount - 1),
          lastFailureTime: state.lastFailureTime,
          isOpen: false,
        };
        const newStates = new Map(states).set(strategyName, recoveredState);
        return [recoveredState, newStates];
      }

      return [state, states];
    });
  }

  /** Обновление состояния circuit breaker для стратегии (атомарная операция) */
  updateState(
    strategyName: string,
    success: boolean,
    failureThreshold: number,
  ): Effect.Effect<void, never, never> {
    return this.statesRef.modify((states) => {
      const currentState = states.get(strategyName)
        ?? { failureCount: 0, lastFailureTime: 0, isOpen: false };
      const now = Date.now();

      let newState: CircuitBreakerState;

      if (success) {
        // Успех - уменьшаем счетчик отказов
        const newFailureCount = Math.max(0, currentState.failureCount - 1);
        newState = {
          failureCount: newFailureCount,
          lastFailureTime: currentState.lastFailureTime,
          isOpen: newFailureCount > 0 ? currentState.isOpen : false,
        };
      } else {
        // Неудача - увеличиваем счетчик
        const newFailureCount = currentState.failureCount + 1;
        newState = {
          failureCount: newFailureCount,
          lastFailureTime: now,
          isOpen: newFailureCount >= failureThreshold,
        };
      }

      const newStates = new Map(states).set(strategyName, newState);
      return [undefined, newStates];
    });
  }
}

/** Создает новый CircuitBreakerService с изолированным Ref для тестирования */
export const makeCircuitBreakerService = Ref.make(new Map<string, CircuitBreakerState>()).pipe(
  Effect.map((statesRef) => new CircuitBreakerService(statesRef)),
);
