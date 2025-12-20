/**
 * @file ErrorStrategyCore.ts - Основные функции стратегий обработки ошибок
 */

import { Effect } from 'effect';

import { LOG_AND_RETURN_STRATEGY } from './ErrorStrategyBase.js';
import { GROUP_STRATEGIES } from './ErrorStrategyGroups.js';
import { CircuitBreakerServiceTag, makeCircuitBreakerService } from './ErrorStrategyModifiers.js';

import type { LivAiErrorCode } from '../ErrorCode.js';
import type { ErrorStrategy, StrategyResult } from './ErrorStrategyTypes.js';

// ==================== STRATEGY RESOLUTION ====================

/** Разрешение стратегии по коду ошибки с fallback pipeline */
export function resolveStrategy(
  errorCode: LivAiErrorCode,
  customStrategies: readonly ErrorStrategy<unknown>[] = [],
): ErrorStrategy<unknown> {
  // 1. Сначала ищем custom стратегии по явно указанным кодам
  const customStrategy = customStrategies.find((strategy) =>
    strategy.applicableCodes?.includes(errorCode) ?? false
  );
  if (customStrategy) {
    return customStrategy;
  }

  // 2. Ищем групповую стратегию по префиксу
  const groupStrategy = GROUP_STRATEGIES.find((group) => group.codes.includes(errorCode));
  if (groupStrategy) {
    return groupStrategy.strategy;
  }

  // 3. Fallback по severity из классификации
  return getSeverityBasedStrategy();
}

/** Получение стратегии по severity ошибки */
export function getSeverityBasedStrategy(): ErrorStrategy<unknown> {
  // В реальной реализации здесь была бы логика определения severity по коду
  // Для упрощения возвращаем базовую стратегию
  return LOG_AND_RETURN_STRATEGY;
}

// ==================== EFFECT INTEGRATION ====================

/** Выполнение стратегии с CircuitBreakerService в контексте */
export function executeWithCircuitBreaker(
  strategy: ErrorStrategy<unknown>,
  error: unknown,
  context?: Record<string, unknown>,
): Effect.Effect<StrategyResult, unknown, unknown> {
  return makeCircuitBreakerService.pipe(
    Effect.flatMap((service) =>
      strategy.execute(error, context).pipe(
        Effect.provideService(CircuitBreakerServiceTag, service),
      )
    ),
  );
}

/** Разрешение и выполнение стратегии с CircuitBreakerService в контексте */
export function resolveAndExecuteWithCircuitBreaker(
  errorCode: LivAiErrorCode,
  error: unknown,
  customStrategies: readonly ErrorStrategy<unknown>[] = [],
  context?: Record<string, unknown>,
): Effect.Effect<StrategyResult, unknown, unknown> {
  const strategy = resolveStrategy(errorCode, customStrategies);
  return makeCircuitBreakerService.pipe(
    Effect.flatMap((service) =>
      strategy.execute(error, context).pipe(
        Effect.provideService(CircuitBreakerServiceTag, service),
      )
    ),
  );
}

/** Получение всех доступных групповых стратегий */
export function getAllGroupStrategies() {
  return GROUP_STRATEGIES;
}

/** Получение стратегии по префиксу */
export function getStrategyByPrefix(prefix: string): ErrorStrategy<unknown> | null {
  const group = GROUP_STRATEGIES.find((g) => g.prefix === prefix);
  return group?.strategy ?? null;
}

/** Статистика использования стратегий */
export function getStrategyStats() {
  return GROUP_STRATEGIES.reduce((acc, group) => ({
    ...acc,
    [group.prefix]: group.codes.length,
  }), {} as Record<string, number>);
}
