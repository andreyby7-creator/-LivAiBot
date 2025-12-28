/**
 * @file ErrorStrategyFactories.ts - Фабрики для создания стратегий обработки ошибок
 */

import { Effect } from 'effect';

import { GROUP_STRATEGIES } from './ErrorStrategyGroups.js';

import type { LivAiErrorCode } from '../ErrorCode.js';
import type { ErrorStrategy, StrategyResult } from './ErrorStrategyTypes.js';

// ==================== STRATEGY FACTORIES ====================

/** Создание стратегии с явным указанием применимых кодов ошибок */
export function createStrategyWithCodes<E>(
  baseStrategy: ErrorStrategy<E>,
  applicableCodes: readonly LivAiErrorCode[],
): ErrorStrategy<E> {
  return {
    ...baseStrategy,
    applicableCodes,
    name: `${baseStrategy.name}_for_${applicableCodes.length}_codes`,
  };
}

/** Создание стратегии для конкретного префикса кодов */
export function createStrategyForPrefix<E>(
  baseStrategy: ErrorStrategy<E>,
  prefix: string,
): ErrorStrategy<E> {
  // Пустой префикс - не фильтруем, возвращаем пустой массив
  if (prefix === '') {
    return createStrategyWithCodes(baseStrategy, []);
  }

  // Находим все коды с данным префиксом в групповых стратегиях
  const applicableCodes = GROUP_STRATEGIES
    .flatMap((group) => group.codes)
    .filter((code) => code.startsWith(prefix));

  return createStrategyWithCodes(baseStrategy, applicableCodes);
}

/** Создание асинхронной стратегии из Promise-based функции */
export function createAsyncStrategy<E>(
  name: string,
  description: string,
  priority: number,
  asyncFn: (error: E, context?: Record<string, unknown>) => Promise<StrategyResult>,
  applicableCodes?: readonly LivAiErrorCode[],
): ErrorStrategy<E> {
  const strategy: ErrorStrategy<E> = {
    name,
    description,
    priority,
    execute: (error, context) =>
      Effect.tryPromise(() => asyncFn(error, context)).pipe(
        Effect.catchAll((error: unknown) =>
          Effect.succeed({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            strategy: name,
            shouldRetry: false,
          } as StrategyResult)
        ),
      ),
  };

  return applicableCodes
    ? { ...strategy, applicableCodes }
    : strategy;
}

/** Создание стратегии из Effect-based функции */
export function createEffectStrategy<E>(
  name: string,
  description: string,
  priority: number,
  effectFn: (error: E, context?: Record<string, unknown>) => Effect.Effect<unknown, unknown, never>,
  applicableCodes?: readonly LivAiErrorCode[],
): ErrorStrategy<E> {
  const strategy: ErrorStrategy<E> = {
    name,
    description,
    priority,
    execute: (error, context) =>
      effectFn(error, context).pipe(
        Effect.map((result) => ({
          success: true,
          data: result,
          strategy: name,
        } as StrategyResult)),
        Effect.catchAll((error: unknown) =>
          Effect.succeed({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            strategy: name,
            shouldRetry: false,
          } as StrategyResult)
        ),
      ),
  };

  return applicableCodes
    ? { ...strategy, applicableCodes }
    : strategy;
}

/** Создание стратегии из callback-based функции */
export function createCallbackStrategy<E>(
  name: string,
  description: string,
  priority: number,
  callbackFn: (
    error: E,
    context: Record<string, unknown> | undefined,
    callback: (err: Error | null, result?: unknown) => void,
  ) => void,
  applicableCodes?: readonly LivAiErrorCode[],
): ErrorStrategy<E> {
  const strategy: ErrorStrategy<E> = {
    name,
    description,
    priority,
    execute: (error, context) =>
      Effect.async<StrategyResult>((resume) => {
        callbackFn(error, context, (err, result) => {
          if (err) {
            resume(Effect.succeed({
              success: false,
              error: err,
              strategy: name,
              shouldRetry: false,
            }));
          } else {
            resume(Effect.succeed({
              success: true,
              data: result,
              strategy: name,
            }));
          }
        });
      }),
  };

  return applicableCodes
    ? { ...strategy, applicableCodes }
    : strategy;
}
