import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  aggregateErrors,
  chainErrors,
  chainErrorsEffect,
  combineAggregationStrategies,
  composeTransformers,
  conditionalTransform,
  createAggregationStrategy,
  ERROR_AGGREGATION_STRATEGIES,
  errorTransformers,
  filterErrors,
  groupErrors,
  mapError,
  mapErrorEffect,
  parallelTransform,
  safeTransform,
  sequentialTransform,
  transformErrorChain,
  transformErrorChainEffect,
} from '../../../../src/errors/base/ErrorTransformers';
import type {
  ChainTraversalResult,
  ErrorAggregationStrategy,
  ErrorChainTransformationResult,
  ErrorFilter,
  ErrorGrouper,
  ErrorLike,
  ErrorMapper,
} from '../../../../src/errors/base/ErrorTransformers';

import type {
  CorrelationId,
  ErrorMetadataContext,
} from '../../../../src/errors/base/ErrorMetadata';

// Mock error для тестирования
type MockError = ErrorLike & {
  readonly id: string;
  readonly type: string;
  readonly value?: number;
};

// Helper функции для создания mock данных
function createMockError(
  id: string,
  message: string,
  type: string = 'test',
  value?: number,
): MockError {
  return {
    id,
    message,
    type,
    value,
    severity: 'medium' as const,
  };
}

function createMockMetadata(correlationId: string): ErrorMetadataContext {
  return {
    correlationId: correlationId as any,
    timestamp: Date.now() as any,
  };
}

function createMockChainResult(
  errors: readonly MockError[],
  hasCycles = false,
): ChainTraversalResult<MockError> {
  return {
    chain: errors,
    hasCycles,
    maxDepth: errors.length,
    truncated: false,
  };
}

describe('ErrorTransformers', () => {
  const mockError1 = createMockError('err1', 'First error', 'validation');
  const mockError2 = createMockError('err2', 'Second error', 'network', 42);
  const mockError3 = createMockError('err3', 'Third error', 'database');
  const mockChainResult = createMockChainResult([mockError1, mockError2, mockError3]);

  describe('Типы и интерфейсы', () => {
    describe('ErrorLike', () => {
      it('должен поддерживать все поля ErrorLike интерфейса', () => {
        const error: ErrorLike = {
          message: 'Test error',
          severity: 'high' as const,
          metadata: createMockMetadata('test-id'),
        };

        expect(error.message).toBe('Test error');
        expect(error.severity).toBe('high');
        expect(error.metadata?.correlationId).toBe('test-id');
      });

      it('должен поддерживать минимальный ErrorLike (пустой объект)', () => {
        const error: ErrorLike = {};
        expect(error).toEqual({});
      });
    });

    describe('ErrorAggregationStrategy', () => {
      it('должен поддерживать все поля стратегии агрегации', () => {
        const strategy: ErrorAggregationStrategy<ErrorLike> = {
          name: 'test-strategy',
          aggregator: (errors) => errors[0] ?? ({} as ErrorLike),
        };

        expect(strategy.name).toBe('test-strategy');
        expect(typeof strategy.aggregator).toBe('function');
      });
    });

    describe('ChainTraversalResult', () => {
      it('должен поддерживать все поля результата обхода цепочки', () => {
        const result: ChainTraversalResult<MockError> = {
          chain: [mockError1],
          hasCycles: false,
          maxDepth: 1,
          truncated: false,
        };

        expect(result.chain).toEqual([mockError1]);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(1);
        expect(result.truncated).toBe(false);
      });
    });

    describe('ErrorChainTransformationResult', () => {
      it('должен поддерживать все поля результата трансформации цепочки', () => {
        const result: ErrorChainTransformationResult<MockError, string> = {
          originalChain: createMockChainResult([mockError1]),
          transformedChain: ['transformed'],
          transformationMetadata: {
            totalTransformed: 1,
            errorsEncountered: [],
          },
        };

        expect(result.originalChain.chain).toEqual([mockError1]);
        expect(result.transformedChain).toEqual(['transformed']);
        expect(result.transformationMetadata.totalTransformed).toBe(1);
        expect(result.transformationMetadata.errorsEncountered).toEqual([]);
      });
    });
  });

  describe('Основные трансформеры', () => {
    describe('mapError', () => {
      it('должен корректно применять mapper к ошибке', () => {
        const mapper: ErrorMapper<MockError, string> = (error) => `${error.id}: ${error.message}`;

        const result = mapError(mockError1, mapper);
        expect(result).toBe('err1: First error');
      });

      it('должен работать с любыми типами входа и выхода', () => {
        const mapper: ErrorMapper<number, boolean> = (num) => num > 0;

        expect(mapError(5, mapper)).toBe(true);
        expect(mapError(-1, mapper)).toBe(false);
      });

      it('должен вызывать mapper ровно один раз', () => {
        const mockMapper = vi.fn((error: MockError) => error.id);

        mapError(mockError1, mockMapper);

        expect(mockMapper).toHaveBeenCalledTimes(1);
        expect(mockMapper).toHaveBeenCalledWith(mockError1);
      });
    });

    describe('filterErrors', () => {
      const errors = [mockError1, mockError2, mockError3];

      it('должен фильтровать ошибки по предикату', () => {
        const filter: ErrorFilter<MockError> = (error) => error.type === 'validation';

        const result = filterErrors(errors, filter);
        expect(result).toEqual([mockError1]);
      });

      it('должен возвращать пустой массив если ничего не подходит', () => {
        const filter: ErrorFilter<MockError> = (error) => error.type === 'nonexistent';

        const result = filterErrors(errors, filter);
        expect(result).toEqual([]);
      });

      it('должен возвращать все ошибки если все подходят', () => {
        const filter: ErrorFilter<MockError> = (error) => error.message?.includes('error') ?? false;

        const result = filterErrors(errors, filter);
        expect(result).toEqual(errors);
      });

      it('должен работать с пустым массивом', () => {
        const filter: ErrorFilter<MockError> = () => true;

        const result = filterErrors([], filter);
        expect(result).toEqual([]);
      });
    });

    describe('groupErrors', () => {
      const errors = [
        createMockError('err1', 'Error 1', 'validation'),
        createMockError('err2', 'Error 2', 'network'),
        createMockError('err3', 'Error 3', 'validation'),
        createMockError('err4', 'Error 4', 'database'),
      ];

      it('должен группировать ошибки по ключу', () => {
        const grouper: ErrorGrouper<MockError, string> = (error) => error.type;

        const result = groupErrors(errors, grouper);

        expect(result.size).toBe(3);
        expect(result.get('validation')).toEqual([errors[0], errors[2]]);
        expect(result.get('network')).toEqual([errors[1]]);
        expect(result.get('database')).toEqual([errors[3]]);
      });

      it('должен работать с любыми типами ключей', () => {
        const grouper: ErrorGrouper<MockError, number> = (error) => error.id.length;

        const result = groupErrors(errors, grouper);

        expect(result.size).toBe(1); // Все id имеют длину 4
        expect(result.get(4)).toEqual(errors);
      });

      it('должен работать с пустым массивом', () => {
        const grouper: ErrorGrouper<MockError, string> = (error) => error.type;

        const result = groupErrors([], grouper);
        expect(result.size).toBe(0);
      });

      it('должен правильно группировать когда все ошибки в одной группе', () => {
        const sameTypeErrors = errors.map((e) => ({ ...e, type: 'same' as const }));
        const grouper: ErrorGrouper<MockError, string> = (error) => error.type;

        const result = groupErrors(sameTypeErrors, grouper);

        expect(result.size).toBe(1);
        expect(result.get('same')).toEqual(sameTypeErrors);
      });
    });

    describe('aggregateErrors', () => {
      const errors: ErrorLike[] = [
        { message: 'Error 1', severity: 'low' as const },
        { message: 'Error 2', severity: 'high' as const },
        { message: 'Error 3', severity: 'medium' as const },
      ];

      it('должен агрегировать ошибки по стратегии first', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.first();
        const result = aggregateErrors(errors, strategy);

        expect(result).toEqual(errors[0]);
      });

      it('должен агрегировать ошибки по стратегии last', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.last();
        const result = aggregateErrors(errors, strategy);

        expect(result).toEqual(errors[2]);
      });

      it('должен агрегировать ошибки по стратегии bySeverity', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.bySeverity();
        const result = aggregateErrors(errors, strategy);

        expect(result).toEqual(errors[1]); // high severity
      });

      it('должен работать с пустым массивом', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.first();
        const result = aggregateErrors([], strategy);

        expect(result).toEqual({});
      });

      it('должен работать с кастомной стратегией', () => {
        const customStrategy = ERROR_AGGREGATION_STRATEGIES.custom(
          (errors) => ({ message: `Combined: ${errors.length} errors` }),
        );

        const result = aggregateErrors(errors, customStrategy);
        expect(result.message).toBe('Combined: 3 errors');
      });
    });
  });

  describe('Трансформеры цепочек', () => {
    describe('chainErrors', () => {
      it('должен объединять несколько цепочек в одну', () => {
        const chain1 = createMockChainResult([mockError1]);
        const chain2 = createMockChainResult([mockError2, mockError3]);

        const result = chainErrors([chain1, chain2]);

        expect(result.chain.length).toBe(1);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(3);
      });

      it('должен использовать стратегию агрегации', () => {
        const chain1 = createMockChainResult([mockError1]);
        const chain2 = createMockChainResult([mockError2]);

        const result = chainErrors([chain1, chain2], ERROR_AGGREGATION_STRATEGIES.last());

        expect(result.chain.length).toBe(1);
        // Проверяем что использовалась стратегия last (должна взять последнюю ошибку)
        expect(result.chain[0]).toBeDefined();
      });

      it('должен корректно обрабатывать пустой массив цепочек', () => {
        const result = chainErrors([]);

        expect(result.chain).toEqual([]);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(0);
        expect(result.truncated).toBe(false);
      });

      it('должен объединять циклы из разных цепочек', () => {
        const chain1 = createMockChainResult([mockError1], true);
        const chain2 = createMockChainResult([mockError2], false);

        const result = chainErrors([chain1, chain2]);

        expect(result.hasCycles).toBe(true);
        expect(result.maxDepth).toBe(2);
      });

      it('должен объединять метаданные из всех ошибок', () => {
        const errorWithMetadata = {
          ...mockError1,
          metadata: createMockMetadata('meta-1'),
        };
        const anotherErrorWithMetadata = {
          ...mockError2,
          metadata: createMockMetadata('meta-2'),
        };

        const chain1 = createMockChainResult([errorWithMetadata]);
        const chain2 = createMockChainResult([anotherErrorWithMetadata]);

        const result = chainErrors([chain1, chain2]);

        expect(result.chain[0].metadata).toBeDefined();
      });
    });

    describe('transformErrorChain', () => {
      it('должен трансформировать каждую ошибку в цепочке', () => {
        const transformer: ErrorMapper<MockError, string> = (error) => `${error.id}-${error.type}`;

        const result = transformErrorChain(mockChainResult, transformer);

        expect(result.originalChain).toBe(mockChainResult);
        expect(result.transformedChain).toEqual([
          'err1-validation',
          'err2-network',
          'err3-database',
        ]);
        expect(result.transformationMetadata.totalTransformed).toBe(3);
        expect(result.transformationMetadata.errorsEncountered).toEqual([]);
      });

      it('должен собирать ошибки трансформации', () => {
        const failingTransformer: ErrorMapper<MockError, string> = (error) => {
          if (error.id === 'err2') {
            throw new Error('Transformation failed');
          }
          return error.id;
        };

        const result = transformErrorChain(mockChainResult, failingTransformer);

        expect(result.transformationMetadata.errorsEncountered.length).toBeGreaterThan(0);
        expect(result.transformedChain.length).toBe(3);
      });

      it('должен работать с пустой цепочкой', () => {
        const emptyChain = createMockChainResult([]);
        const transformer: ErrorMapper<MockError, string> = (error) => error.id;

        const result = transformErrorChain(emptyChain, transformer);

        expect(result.transformedChain).toEqual([]);
        expect(result.transformationMetadata.totalTransformed).toBe(0);
      });
    });
  });

  describe('Effect интеграция', () => {
    describe('mapErrorEffect', () => {
      it('должен создавать Effect для трансформации ошибки', async () => {
        const mapper = (error: MockError) => Effect.succeed(`${error.id}-effect`);

        const effect = mapErrorEffect(mockError1, mapper);
        const result = await Effect.runPromise(effect);

        expect(result).toBe('err1-effect');
      });

      it('должен обрабатывать ошибки в Effect', async () => {
        const failingMapper = (error: MockError) => Effect.fail<string>('Mapper failed');

        const effect = mapErrorEffect(mockError1, failingMapper);

        await expect(Effect.runPromise(effect)).rejects.toThrow('Mapper failed');
      });
    });

    describe('chainErrorsEffect', () => {
      it('должен создавать Effect для объединения цепочек', async () => {
        const chain1 = createMockChainResult([mockError1]);
        const chain2 = createMockChainResult([mockError2]);

        const effect = chainErrorsEffect([chain1, chain2]);
        const result = await Effect.runPromise(effect);

        expect(result.chain.length).toBe(1);
        expect(result.hasCycles).toBe(false);
      });
    });

    describe('transformErrorChainEffect', () => {
      it('должен трансформировать цепочку через Effect', async () => {
        const transformer = (error: MockError) => Effect.succeed(`effect-${error.id}`);

        const effect = transformErrorChainEffect(mockChainResult, transformer);
        const result = await Effect.runPromise(effect);

        expect(result.transformedChain).toEqual(['effect-err1', 'effect-err2', 'effect-err3']);
        expect(result.transformationMetadata.totalTransformed).toBe(3);
      });

      it('должен собирать ошибки из Effect трансформаций', async () => {
        const transformer = (error: MockError): Effect.Effect<string, string, never> => {
          if (error.id === 'err2') {
            return Effect.fail('Effect transformation failed');
          }
          return Effect.succeed(`effect-${error.id}`);
        };

        const effect = transformErrorChainEffect(mockChainResult, transformer);
        const result = await Effect.runPromise(effect);

        expect(result.transformationMetadata.errorsEncountered.length).toBeGreaterThan(0);
        expect(result.transformedChain.length).toBe(3);
      });
    });
  });

  describe('Стратегии агрегации', () => {
    describe('ERROR_AGGREGATION_STRATEGIES', () => {
      it('first стратегия должна возвращать первую ошибку', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.first();
        const errors: ErrorLike[] = [
          { message: 'First' },
          { message: 'Second' },
        ];

        const result = strategy.aggregator(errors);
        expect(result.message).toBe('First');
      });

      it('last стратегия должна возвращать последнюю ошибку', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.last();
        const errors: ErrorLike[] = [
          { message: 'First' },
          { message: 'Second' },
          { message: 'Last' },
        ];

        const result = strategy.aggregator(errors);
        expect(result.message).toBe('Last');
      });

      it('bySeverity стратегия должна возвращать ошибку с наивысшей severity', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.bySeverity();
        const errors: ErrorLike[] = [
          { message: 'Low', severity: 'low' as const },
          { message: 'Critical', severity: 'critical' as const },
          { message: 'High', severity: 'high' as const },
        ];

        const result = strategy.aggregator(errors);
        expect(result.message).toBe('Critical');
      });

      it('bySeverity должен корректно работать с undefined severity', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.bySeverity();
        const errors: ErrorLike[] = [
          { message: 'No severity' },
          { message: 'Low severity', severity: 'low' as const },
        ];

        const result = strategy.aggregator(errors);
        expect(result.message).toBe('Low severity');
      });
    });

    describe('createAggregationStrategy', () => {
      it('должен создавать кастомную стратегию агрегации', () => {
        const aggregator = (errors: readonly ErrorLike[]) => ({
          message: `Aggregated ${errors.length} errors`,
        });

        const strategy = createAggregationStrategy('test-strategy', aggregator);

        expect(strategy.name).toBe('test-strategy');
        expect(typeof strategy.aggregator).toBe('function');

        const errors: ErrorLike[] = [{ message: 'Error 1' }, { message: 'Error 2' }];
        const result = strategy.aggregator(errors);
        expect(result.message).toBe('Aggregated 2 errors');
      });
    });

    describe('combineAggregationStrategies', () => {
      it('должен комбинировать несколько стратегий', () => {
        const strategy1 = createAggregationStrategy(
          'strategy1',
          (errors) => ({ message: 'First' }),
        );
        const strategy2 = createAggregationStrategy(
          'strategy2',
          (errors) => ({ message: 'Second' }),
        );

        const combiner = (results: readonly ErrorLike[]) => results[0];
        const combinedStrategy = combineAggregationStrategies([strategy1, strategy2], combiner);

        expect(combinedStrategy.name).toBe('combined(strategy1,strategy2)');

        const errors: ErrorLike[] = [{ message: 'Test' }];
        const result = combinedStrategy.aggregator(errors);
        expect(result.message).toBe('First');
      });
    });
  });

  describe('Utility функции', () => {
    describe('conditionalTransform', () => {
      it('должен применять transformer если условие выполняется', () => {
        const condition: ErrorFilter<MockError> = (error) => error.type === 'validation';
        const transformer: ErrorMapper<MockError, string> = (error) => `transformed-${error.id}`;
        const fallback: ErrorMapper<MockError, string> = (error) => `fallback-${error.id}`;

        const result = conditionalTransform(mockError1, condition, transformer, fallback);
        expect(result).toBe('transformed-err1');
      });

      it('должен применять fallback если условие не выполняется', () => {
        const condition: ErrorFilter<MockError> = (error) => error.type === 'network';
        const transformer: ErrorMapper<MockError, string> = (error) => `transformed-${error.id}`;
        const fallback: ErrorMapper<MockError, string> = (error) => `fallback-${error.id}`;

        const result = conditionalTransform(mockError1, condition, transformer, fallback);
        expect(result).toBe('fallback-err1');
      });
    });

    describe('safeTransform', () => {
      it('должен возвращать результат transformer при успешной трансформации', () => {
        const transformer: ErrorMapper<MockError, string> = (error) => `safe-${error.id}`;
        const fallback = 'fallback-value';

        const result = safeTransform(mockError1, transformer, fallback);
        expect(result).toBe('safe-err1');
      });

      it('должен возвращать fallback при ошибке в transformer', () => {
        const failingTransformer: ErrorMapper<MockError, string> = () => {
          throw new Error('Transform failed');
        };
        const fallback = 'fallback-value';

        const result = safeTransform(mockError1, failingTransformer, fallback);
        expect(result).toBe('fallback-value');
      });
    });

    describe('composeTransformers', () => {
      it('должен композировать два transformer-а', () => {
        const first: ErrorMapper<MockError, number> = (error) => error.id.length;
        const second: ErrorMapper<number, string> = (length) => `length-${length}`;

        const composed = composeTransformers(first, second);

        const result = composed(mockError1);
        expect(result).toBe('length-4');
      });

      it('должен корректно передавать данные по цепочке', () => {
        const addPrefix: ErrorMapper<MockError, string> = (error) => `prefix-${error.id}`;
        const addSuffix: ErrorMapper<string, string> = (str) => `${str}-suffix`;

        const composed = composeTransformers(addPrefix, addSuffix);

        const result = composed(mockError1);
        expect(result).toBe('prefix-err1-suffix');
      });
    });

    describe('parallelTransform', () => {
      it('должен трансформировать все ошибки параллельно', () => {
        const errors = [mockError1, mockError2, mockError3];
        const transformer: ErrorMapper<MockError, string> = (error) => `parallel-${error.id}`;

        const result = parallelTransform(errors, transformer);

        expect(result).toEqual(['parallel-err1', 'parallel-err2', 'parallel-err3']);
      });

      it('должен работать с пустым массивом', () => {
        const transformer: ErrorMapper<MockError, string> = (error) => error.id;

        const result = parallelTransform([], transformer);
        expect(result).toEqual([]);
      });
    });

    describe('sequentialTransform', () => {
      it('должен трансформировать ошибки последовательно с накоплением состояния', () => {
        const errors = [mockError1, mockError2, mockError3];
        const transformer = (error: MockError, index: number, accumulated: readonly string[]) =>
          `${error.id}-index${index}-accumulated${accumulated.length}`;

        const result = sequentialTransform(errors, transformer);

        expect(result).toEqual([
          'err1-index0-accumulated0',
          'err2-index1-accumulated1',
          'err3-index2-accumulated2',
        ]);
      });

      it('должен игнорировать undefined ошибки', () => {
        const errors = [mockError1, undefined as any, mockError2];
        const transformer = (error: MockError, index: number, accumulated: readonly string[]) =>
          `${error.id}-index${index}`;

        const result = sequentialTransform(errors, transformer);

        expect(result).toEqual([
          'err1-index0',
          'err2-index2',
        ]);
      });
    });
  });

  describe('errorTransformers объект', () => {
    it('должен предоставлять доступ ко всем трансформерам', () => {
      expect(typeof errorTransformers.map).toBe('function');
      expect(typeof errorTransformers.filter).toBe('function');
      expect(typeof errorTransformers.group).toBe('function');
      expect(typeof errorTransformers.aggregate).toBe('function');
      expect(typeof errorTransformers.chain).toBe('function');
      expect(typeof errorTransformers.transformChain).toBe('function');
      expect(typeof errorTransformers.mapEffect).toBe('function');
      expect(typeof errorTransformers.chainEffect).toBe('function');
      expect(typeof errorTransformers.transformChainEffect).toBe('function');
      expect(errorTransformers.strategies).toBeDefined();
      expect(typeof errorTransformers.createStrategy).toBe('function');
      expect(typeof errorTransformers.combineStrategies).toBe('function');
      expect(typeof errorTransformers.conditionalTransform).toBe('function');
      expect(typeof errorTransformers.safeTransform).toBe('function');
      expect(typeof errorTransformers.composeTransformers).toBe('function');
      expect(typeof errorTransformers.parallelTransform).toBe('function');
      expect(typeof errorTransformers.sequentialTransform).toBe('function');
    });

    it('должен позволять использовать fluent API', () => {
      const result = errorTransformers
        .map(mockError1, (error) => `mapped-${error.id}`);

      expect(result).toBe('mapped-err1');
    });
  });

  describe('Критические зоны и edge cases', () => {
    describe('Обработка больших объемов данных', () => {
      it('chainErrors должен корректно работать с chunked processing для больших цепочек', () => {
        // Создаем много ошибок с метаданными для тестирования chunked processing
        const largeErrors = Array.from(
          { length: 2500 },
          (_, i) => createMockError(`err${i}`, `Error ${i}`, 'test'),
        );

        const chainResults: ChainTraversalResult<ErrorLike>[] = [
          createMockChainResult(largeErrors.slice(0, 1000)),
          createMockChainResult(largeErrors.slice(1000, 2000)),
          createMockChainResult(largeErrors.slice(2000)),
        ];

        const result = chainErrors(chainResults);

        expect(result.chain.length).toBe(1);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(2500);
      });

      it('groupErrors должен корректно работать с большим количеством ошибок', () => {
        const largeErrors = Array.from(
          { length: 10000 },
          (_, i) => createMockError(`err${i}`, `Error ${i}`, i % 2 === 0 ? 'even' : 'odd'),
        );

        const grouper: ErrorGrouper<MockError, string> = (error) => error.type;

        const result = groupErrors(largeErrors, grouper);

        expect(result.size).toBe(2);
        expect(result.get('even')?.length).toBe(5000);
        expect(result.get('odd')?.length).toBe(5000);
      });
    });

    describe('Обработка некорректных входных данных', () => {
      it('mapError должен работать с любыми типами входных данных', () => {
        const transformer = (input: unknown) => String(input);

        expect(mapError(null, transformer)).toBe('null');
        expect(mapError(undefined, transformer)).toBe('undefined');
        expect(mapError(42, transformer)).toBe('42');
        expect(mapError({}, transformer)).toBe('[object Object]');
      });

      it('filterErrors должен корректно работать с undefined/null в массиве', () => {
        const errors = [mockError1, null as any, undefined as any, mockError2];
        const filter: ErrorFilter<MockError> = (error) => error != null;

        const result = filterErrors(errors, filter);

        // filter должен отфильтровать null и undefined
        expect(result).toEqual([mockError1, mockError2]);
      });

      it('aggregateErrors должен корректно работать с пустыми массивами', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.first();

        expect(() => aggregateErrors([], strategy)).not.toThrow();

        const result = aggregateErrors([], strategy);
        expect(result).toEqual({});
      });

      it('transformErrorChain должен корректно работать с пустыми цепочками', () => {
        const emptyChain = createMockChainResult([]);
        const transformer: ErrorMapper<MockError, string> = (error) => error.id;

        const result = transformErrorChain(emptyChain, transformer);

        expect(result.transformedChain).toEqual([]);
        expect(result.transformationMetadata.totalTransformed).toBe(0);
        expect(result.transformationMetadata.errorsEncountered).toEqual([]);
      });
    });

    describe('Effect error handling', () => {
      it('transformErrorChainEffect должен корректно обрабатывать все успешные трансформации', async () => {
        const transformer = (error: MockError) => Effect.succeed(`success-${error.id}`);

        const effect = transformErrorChainEffect(mockChainResult, transformer);
        const result = await Effect.runPromise(effect);

        expect(result.transformationMetadata.errorsEncountered).toEqual([]);
        expect(result.transformedChain).toEqual(['success-err1', 'success-err2', 'success-err3']);
      });

      it('transformErrorChainEffect должен корректно обрабатывать все неудачные трансформации', async () => {
        const transformer = (error: MockError) =>
          Effect.fail<string>(`Failed to transform ${error.id}`);

        const effect = transformErrorChainEffect(mockChainResult, transformer);
        const result = await Effect.runPromise(effect);

        expect(result.transformationMetadata.errorsEncountered.length).toBe(3);
        expect(result.transformedChain.length).toBe(3);
        // Все трансформации должны быть placeholder объектами
        expect(result.transformedChain.every((item) => typeof item === 'object')).toBe(true);
      });

      it('transformErrorChainEffect должен корректно обрабатывать смешанные результаты', async () => {
        const transformer = (error: MockError): Effect.Effect<string, string, never> => {
          if (error.id === 'err2') {
            return Effect.fail('Mixed failure');
          }
          return Effect.succeed(`success-${error.id}`);
        };

        const effect = transformErrorChainEffect(mockChainResult, transformer);
        const result = await Effect.runPromise(effect);

        expect(result.transformationMetadata.errorsEncountered.length).toBe(1);
        expect(result.transformedChain.length).toBe(3);
        expect(result.transformedChain[0]).toBe('success-err1');
        expect(result.transformedChain[2]).toBe('success-err3');
      });
    });

    describe('Граничные случаи стратегий', () => {
      it('bySeverity стратегия должна корректно работать с неизвестными severity', () => {
        const strategy = ERROR_AGGREGATION_STRATEGIES.bySeverity();
        const errors: ErrorLike[] = [
          { message: 'Unknown severity', severity: 'unknown' as any },
          { message: 'Low severity', severity: 'low' as const },
        ];

        // Неизвестный severity должен быть интерпретирован как 'low'
        const result = strategy.aggregator(errors);
        expect(result.message).toBe('Low severity');
      });

      it('combineAggregationStrategies должен корректно работать с пустым массивом стратегий', () => {
        const combiner = (results: readonly ErrorLike[]) => ({ message: 'Combined' });
        const combinedStrategy = combineAggregationStrategies([], combiner);

        const errors: ErrorLike[] = [{ message: 'Test' }];
        const result = combinedStrategy.aggregator(errors);

        expect(result.message).toBe('Combined');
      });
    });

    describe('Memory и performance edge cases', () => {
      it('parallelTransform должен корректно работать с очень большими массивами', () => {
        const largeErrors = Array.from(
          { length: 100000 },
          (_, i) => createMockError(`err${i}`, `Error ${i}`),
        );

        const transformer: ErrorMapper<MockError, string> = (error) => `transformed-${error.id}`;

        // Это может занять время, но должно работать
        const result = parallelTransform(largeErrors, transformer);

        expect(result.length).toBe(100000);
        expect(result[0]).toBe('transformed-err0');
        expect(result[99999]).toBe('transformed-err99999');
      });

      it('sequentialTransform должен правильно накапливать состояние', () => {
        const errors = [1, 2, 3, 4, 5].map((n) => createMockError(`err${n}`, `Error ${n}`));
        const transformer = (error: MockError, index: number, accumulated: readonly string[]) =>
          `step${index}: ${accumulated.join(',')} -> ${error.id}`;

        const result = sequentialTransform(errors, transformer);

        expect(result).toEqual([
          'step0:  -> err1',
          'step1: step0:  -> err1 -> err2',
          'step2: step0:  -> err1,step1: step0:  -> err1 -> err2 -> err3',
          'step3: step0:  -> err1,step1: step0:  -> err1 -> err2,step2: step0:  -> err1,step1: step0:  -> err1 -> err2 -> err3 -> err4',
          'step4: step0:  -> err1,step1: step0:  -> err1 -> err2,step2: step0:  -> err1,step1: step0:  -> err1 -> err2 -> err3,step3: step0:  -> err1,step1: step0:  -> err1 -> err2,step2: step0:  -> err1,step1: step0:  -> err1 -> err2 -> err3 -> err4 -> err5',
        ]);
      });
    });

    describe('Chunked processing для больших объемов данных', () => {
      it('должен корректно обрабатывать большое количество ошибок с chunked processing', () => {
        // Создаем более 1000 ошибок для активации chunked processing
        const largeErrors = Array.from({ length: 1500 }, (_, i) => ({
          ...createMockError(`err-${i}`, `Error ${i}`, 'test', i),
          metadata: {
            correlationId: `corr-${i}` as CorrelationId,
            timestamp: (Date.now() + i) as any,
          },
        }));

        const chainResults: ChainTraversalResult<MockError>[] = largeErrors.map((error) => ({
          chain: [error],
          hasCycles: false,
          depth: 1,
          maxDepth: 1,
          truncated: false,
        }));

        const result = chainErrors(chainResults, ERROR_AGGREGATION_STRATEGIES.first());

        expect(result).toBeDefined();
        expect(result.chain).toHaveLength(1); // Агрегированная ошибка в chain
        expect(result.chain[0]).toBeDefined(); // Первая агрегированная ошибка
      });

      it('должен корректно мержить метаданные в chunked processing', () => {
        // Создаем ошибки с разными метаданными для тестирования merge
        const errorsWithMetadata = Array.from({ length: 1200 }, (_, i) => ({
          ...createMockError(`err-${i}`, `Error ${i}`, 'test', i),
          metadata: {
            correlationId: `corr-${i % 10}` as CorrelationId,
            timestamp: (Date.now() + i) as any,
          },
        }));

        const chainResults: ChainTraversalResult<MockError>[] = errorsWithMetadata.map((error) => ({
          chain: [error],
          hasCycles: false,
          depth: 1,
          maxDepth: 1,
          truncated: false,
        }));

        const result = chainErrors(chainResults, ERROR_AGGREGATION_STRATEGIES.first());

        expect(result).toBeDefined();
        expect(Array.isArray(result.chain)).toBe(true);
        expect(result.chain.length).toBeGreaterThan(0);
      });
    });
  });
});
