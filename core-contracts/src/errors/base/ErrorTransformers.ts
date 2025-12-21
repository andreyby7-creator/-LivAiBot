/**
 * @file ErrorTransformers.ts - Полная система generic трансформеров ошибок LivAiBot
 *
 * Intelligent metadata merging, generic design для любых error-like объектов.
 * mapError<E,F>() generic mapping, chainErrors<E>() с configurable strategies,
 * aggregateErrors<E>() с custom aggregators, filterErrors<E>(), groupErrors<E>(),
 * transformErrorChain<E>(). Полностью generic - не зависит от BaseError.
 */

// ==================== ИМПОРТЫ ====================

import { Effect } from 'effect';

import { mergeMetadata } from './ErrorMetadata.js';

import type { ErrorChain } from './BaseErrorTypes.js';
import type { ErrorSeverity } from './ErrorConstants.js';
import type { ErrorMetadataContext } from './ErrorMetadata.js';
import type { ChainTraversalResult } from './ErrorUtilsCore.js';

// Re-export for convenience
export type { ChainTraversalResult };

// ==================== ТИПЫ ДЛЯ ГЕНЕРИКОВ ====================

/** Базовый интерфейс для объектов, которые можно рассматривать как ошибки */
export type ErrorLike = {
  readonly message?: string;
  readonly cause?: ErrorChain<ErrorLike>;
  readonly metadata?: ErrorMetadataContext;
  readonly severity?: ErrorSeverity;
};

/** Функция-маппер для трансформации ошибок */
export type ErrorMapper<E, F> = (error: E) => F;

/** Функция-фильтр для ошибок */
export type ErrorFilter<E> = (error: E) => boolean;

/** Функция-группировщик ошибок */
export type ErrorGrouper<E, K> = (error: E) => K;

/** Стратегии агрегации ошибок */
export type ErrorAggregationStrategy<E> = {
  readonly name: string;
  readonly aggregator: (errors: readonly E[]) => E;
};

/** Предопределенные стратегии агрегации */
export const ERROR_AGGREGATION_STRATEGIES = {
  /** Первая ошибка в списке */
  first: (): ErrorAggregationStrategy<ErrorLike> => ({
    name: 'first',
    aggregator: (errors) => errors[0] ?? ({} as ErrorLike),
  }),

  /** Последняя ошибка в списке */
  last: (): ErrorAggregationStrategy<ErrorLike> => ({
    name: 'last',
    aggregator: (errors) => errors[errors.length - 1] ?? ({} as ErrorLike),
  }),

  /** Ошибка с наивысшей severity */
  bySeverity: (): ErrorAggregationStrategy<ErrorLike> => ({
    name: 'bySeverity',
    aggregator: (errors): ErrorLike => {
      if (errors.length === 0) return {} as ErrorLike;
      const severityOrder: Record<ErrorSeverity, number> = {
        low: 0,
        medium: 1,
        high: 2,
        critical: 3,
      };
      return errors.reduce((highest, current) => {
        const currentSeverity = current.severity && severityOrder[current.severity]
          ? severityOrder[current.severity]
          : severityOrder.low;
        const highestSeverity = highest.severity && severityOrder[highest.severity]
          ? severityOrder[highest.severity]
          : severityOrder.low;
        return currentSeverity >= highestSeverity ? current : highest;
      });
    },
  }),

  /** Кастомная стратегия */
  custom: (
    aggregator: (errors: readonly ErrorLike[]) => ErrorLike,
  ): ErrorAggregationStrategy<ErrorLike> => ({
    name: 'custom',
    aggregator,
  }),
} as const;

/** Результат трансформации цепочки ошибок */
export type ErrorChainTransformationResult<E, F> = {
  readonly originalChain: ChainTraversalResult<E>;
  readonly transformedChain: readonly F[];
  readonly transformationMetadata: {
    readonly totalTransformed: number;
    readonly errorsEncountered: readonly string[];
  };
};

// ==================== ОСНОВНЫЕ ТРАНСФОРМЕРЫ ====================

/** Generic mapping ошибок из типа E в тип F */
export function mapError<E, F>(error: E, mapper: ErrorMapper<E, F>): F {
  return mapper(error);
}

/** Фильтрация массива ошибок по предикату */
export function filterErrors<E>(errors: readonly E[], filter: ErrorFilter<E>): readonly E[] {
  return errors.filter(filter);
}

/** Группировка ошибок по ключу */
export function groupErrors<E, K>(
  errors: readonly E[],
  grouper: ErrorGrouper<E, K>,
): Map<K, readonly E[]> {
  // Собираем entries в immutable массиве, затем создаем Map
  const entries = errors.reduce((acc, error) => {
    const key = grouper(error);
    const existingEntry = acc.find(([k]) => k === key);

    if (existingEntry) {
      // Обновляем существующую entry с новым элементом
      return acc.map(([k, group]) =>
        k === key ? [k, [...group, error]] as const : [k, group] as const
      );
    } else {
      // Добавляем новую entry
      return [...acc, [key, [error]] as const];
    }
  }, [] as readonly (readonly [K, readonly E[]])[]);

  return new Map(entries);
}

/** Агрегация массива ошибок в одну ошибку по стратегии */
export function aggregateErrors(
  errors: readonly ErrorLike[],
  strategy: ErrorAggregationStrategy<ErrorLike>,
): ErrorLike {
  return strategy.aggregator(errors);
}

// ==================== ЦЕПОЧКИ ОШИБОК ====================

/**
 * Вычисляет объединенные метаданные из массива ошибок с chunked processing для производительности
 */
function getMergedMetadata(
  allErrors: readonly ErrorLike[],
  primaryMetadata: ErrorMetadataContext | undefined,
): ErrorMetadataContext | undefined {
  const CHUNK_SIZE = 1000;

  if (allErrors.length <= CHUNK_SIZE) {
    // Для маленьких цепочек - обычный reduce
    return allErrors.reduce((mergedMeta: ErrorMetadataContext | undefined, error) => {
      if (!error.metadata) return mergedMeta;
      if (!mergedMeta) return error.metadata;

      const mergeResult = mergeMetadata(mergedMeta, error.metadata, 'merge-contexts');
      return mergeResult.merged;
    }, primaryMetadata);
  } else {
    // Для больших цепочек - chunked processing
    const chunks = Array.from(
      { length: Math.ceil(allErrors.length / CHUNK_SIZE) },
      (_, chunkIndex) => {
        const start = chunkIndex * CHUNK_SIZE;
        const chunk = allErrors.slice(start, start + CHUNK_SIZE);
        return chunk.reduce((mergedMeta: ErrorMetadataContext | undefined, error) => {
          if (!error.metadata) return mergedMeta;
          if (!mergedMeta) return error.metadata;

          const mergeResult = mergeMetadata(mergedMeta, error.metadata, 'merge-contexts');
          return mergeResult.merged;
        }, undefined as ErrorMetadataContext | undefined);
      },
    ).filter((chunkMetadata): chunkMetadata is ErrorMetadataContext => chunkMetadata !== undefined);

    // Merge всех chunk результатов
    return chunks.reduce((mergedMeta, chunkMeta) => {
      if (!mergedMeta) return chunkMeta;

      const mergeResult = mergeMetadata(mergedMeta, chunkMeta, 'merge-contexts');
      return mergeResult.merged;
    }, primaryMetadata);
  }
}

/** Объединение нескольких цепочек ошибок в одну с intelligent metadata merging */
export function chainErrors(
  errorChains: readonly ChainTraversalResult<ErrorLike>[],
  primaryStrategy: ErrorAggregationStrategy<ErrorLike> = ERROR_AGGREGATION_STRATEGIES.first(),
): ChainTraversalResult<ErrorLike> {
  if (errorChains.length === 0) {
    return {
      chain: [],
      hasCycles: false,
      maxDepth: 0,
      truncated: false,
    };
  }

  // Собираем все ошибки из всех цепочек
  const { allErrors, maxDepth, hasCycles } = errorChains.reduce(
    (acc, chain) => ({
      allErrors: [...acc.allErrors, ...chain.chain],
      maxDepth: acc.maxDepth + chain.maxDepth,
      hasCycles: acc.hasCycles || chain.hasCycles,
    }),
    { allErrors: [] as ErrorLike[], maxDepth: 0, hasCycles: false },
  );

  // Агрегируем в одну цепочку
  const primaryError = primaryStrategy.aggregator(allErrors);

  // Intelligent metadata merging: объединяем metadata из всех ошибок (chunked для больших цепочек)
  const mergedMetadata = getMergedMetadata(allErrors, primaryError.metadata);

  const mergedError: ErrorLike = {
    ...primaryError,
    ...(mergedMetadata && { metadata: mergedMetadata }),
  };

  return {
    chain: [mergedError],
    hasCycles,
    maxDepth,
    truncated: false,
  };
}

/** Трансформация цепочки ошибок с сохранением структуры */
export function transformErrorChain<E, F>(
  chainResult: ChainTraversalResult<E>,
  transformer: ErrorMapper<E, F>,
): ErrorChainTransformationResult<E, F> {
  // Выполняем трансформацию с обработкой ошибок
  const transformationResults = chainResult.chain.map(
    (error): { success: boolean; result?: F; error?: string; } => {
      try {
        const result = transformer(error);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );

  // Разделяем успешные трансформации и ошибки с immutable подходом
  const { transformedChain, errorsEncountered } = transformationResults.reduce(
    (acc, result) => {
      if (result.success && result.result !== undefined) {
        return {
          transformedChain: [...acc.transformedChain, result.result],
          errorsEncountered: acc.errorsEncountered,
        };
      } else {
        return {
          transformedChain: [...acc.transformedChain, {} as F], // placeholder для неудачных трансформаций
          errorsEncountered: result.error != null
            ? [...acc.errorsEncountered, result.error]
            : acc.errorsEncountered,
        };
      }
    },
    { transformedChain: [] as F[], errorsEncountered: [] as string[] },
  );

  return {
    originalChain: chainResult,
    transformedChain,
    transformationMetadata: {
      totalTransformed: transformedChain.length,
      errorsEncountered,
    },
  };
}

// ==================== EFFECT INTEGRATION ====================

/** Async mapping ошибок через Effect */
export function mapErrorEffect<E, F, E2 = unknown>(
  error: E,
  mapper: (error: E) => Effect.Effect<F, E2, never>,
): Effect.Effect<F, E2, never> {
  return mapper(error);
}

/** Async объединение цепочек ошибок через Effect */
export function chainErrorsEffect(
  errorChains: readonly ChainTraversalResult<ErrorLike>[],
  primaryStrategy: ErrorAggregationStrategy<ErrorLike> = ERROR_AGGREGATION_STRATEGIES.first(),
): Effect.Effect<ChainTraversalResult<ErrorLike>, never, never> {
  return Effect.sync(() => chainErrors(errorChains, primaryStrategy));
}

/** Async трансформация цепочки ошибок через Effect */
export function transformErrorChainEffect<E, F, E2 = unknown>(
  chainResult: ChainTraversalResult<E>,
  transformer: (error: E) => Effect.Effect<F, E2, never>,
): Effect.Effect<ErrorChainTransformationResult<E, F>, never, never> {
  // Трансформируем каждую ошибку и обрабатываем возможные ошибки
  const transformationResults = chainResult.chain.map((error) =>
    transformer(error).pipe(
      Effect.map((result) => ({ success: true as const, result })),
      Effect.catchAll((error) => Effect.succeed({ success: false as const, error: String(error) })),
    )
  );

  return Effect.all(transformationResults).pipe(
    Effect.map((results) => {
      // Разделяем успешные трансформации и ошибки с immutable подходом
      const { transformedChain, errorsEncountered } = results.reduce(
        (acc, result) => {
          if (result.success) {
            return {
              transformedChain: [...acc.transformedChain, result.result],
              errorsEncountered: acc.errorsEncountered,
            };
          } else {
            return {
              transformedChain: [...acc.transformedChain, {} as F], // placeholder
              errorsEncountered: [...acc.errorsEncountered, result.error],
            };
          }
        },
        { transformedChain: [] as F[], errorsEncountered: [] as string[] },
      );

      return {
        originalChain: chainResult,
        transformedChain,
        transformationMetadata: {
          totalTransformed: transformedChain.length,
          errorsEncountered,
        },
      };
    }),
  );
}

// ==================== UTILITY FUNCTIONS ====================

/** Создание кастомной стратегии агрегации */
export function createAggregationStrategy(
  name: string,
  aggregator: (errors: readonly ErrorLike[]) => ErrorLike,
): ErrorAggregationStrategy<ErrorLike> {
  return { name, aggregator };
}

/** Объединение нескольких стратегий в композитную */
export function combineAggregationStrategies(
  strategies: readonly ErrorAggregationStrategy<ErrorLike>[],
  combiner: (results: readonly ErrorLike[]) => ErrorLike,
): ErrorAggregationStrategy<ErrorLike> {
  return {
    name: `combined(${strategies.map((s) => s.name).join(',')})`,
    aggregator: (errors): ErrorLike => {
      const results = strategies.map((strategy) => strategy.aggregator(errors));
      return combiner(results);
    },
  };
}

/** Условная трансформация ошибок */
export function conditionalTransform<E, F>(
  error: E,
  condition: ErrorFilter<E>,
  transformer: ErrorMapper<E, F>,
  fallback: ErrorMapper<E, F>,
): F {
  return condition(error) ? transformer(error) : fallback(error);
}

/** Безопасная трансформация с fallback */
export function safeTransform<E, F>(
  error: E,
  transformer: ErrorMapper<E, F>,
  fallback: F,
): F {
  try {
    return transformer(error);
  } catch {
    return fallback;
  }
}

/** Композиция трансформеров */
export function composeTransformers<E, F, G>(
  first: ErrorMapper<E, F>,
  second: ErrorMapper<F, G>,
): ErrorMapper<E, G> {
  return (error: E) => second(first(error));
}

/** Параллельная трансформация массива ошибок */
export function parallelTransform<E, F>(
  errors: readonly E[],
  transformer: ErrorMapper<E, F>,
): readonly F[] {
  return errors.map(transformer);
}

/** Последовательная трансформация с накоплением состояния */
export function sequentialTransform<E, F>(
  errors: readonly E[],
  transformer: (error: E, index: number, accumulated: readonly F[]) => F,
): readonly F[] {
  return errors.reduce((result, error, index) => {
    if (error !== undefined) {
      return [...result, transformer(error, index, result)];
    }
    return result;
  }, [] as readonly F[]);
}

// ==================== EXPORTS ====================

/** Удобный интерфейс для всех трансформеров */
export const errorTransformers = {
  // Basic transformers
  map: mapError,
  filter: filterErrors,
  group: groupErrors,
  aggregate: aggregateErrors,

  // Chain transformers
  chain: chainErrors,
  transformChain: transformErrorChain,

  // Effect transformers
  mapEffect: mapErrorEffect,
  chainEffect: chainErrorsEffect,
  transformChainEffect: transformErrorChainEffect,

  // Strategies
  strategies: ERROR_AGGREGATION_STRATEGIES,
  createStrategy: createAggregationStrategy,
  combineStrategies: combineAggregationStrategies,

  // Utilities
  conditionalTransform,
  safeTransform,
  composeTransformers,
  parallelTransform,
  sequentialTransform,
} as const;
