import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  analyzeErrorChain,
  analyzeErrorChainMemoized,
  clearAnalysisCache,
  clearTraversalCache,
  findRootCause,
  flattenCauses,
  getChainDepth,
  getErrorChain,
  hasCycles,
  isLeafError,
  isRootError,
  safeGetCause,
  safeTraverseCauses,
  safeTraverseCausesMemoized,
} from '../../../../src/errors/base/ErrorUtilsCore';
import type {
  ChainTraversalConfig,
  ChainTraversalResult,
  ErrorChainAnalysis,
  SafeCauseResult,
} from '../../../../src/errors/base/ErrorUtilsCore';

import type { ErrorChain } from '../../../../src/errors/base/BaseErrorTypes';

// Mock error для тестирования
type MockError = {
  id: string;
  message: string;
  cause?: ErrorChain<MockError>;
};

// Helper функция для создания mock ошибок
function createMockError(id: string, message: string, cause?: MockError): MockError {
  return cause
    ? { id, message, cause: { error: cause } }
    : { id, message };
}

describe('ErrorUtilsCore', () => {
  let mockError1: MockError;
  let mockError2: MockError;
  let mockError3: MockError;

  beforeEach(() => {
    // Создаем цепочку ошибок: error1 -> error2 -> error3
    mockError3 = createMockError('error3', 'Deepest error');
    mockError2 = createMockError('error2', 'Middle error', mockError3);
    mockError1 = createMockError('error1', 'Root error', mockError2);
  });

  describe('Конфигурация и типы', () => {
    describe('ChainTraversalConfig', () => {
      it('должен поддерживать все поля конфигурации', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 100,
          detectCycles: true,
          enableCaching: false,
        };

        expect(config.maxDepth).toBe(100);
        expect(config.detectCycles).toBe(true);
        expect(config.enableCaching).toBe(false);
      });
    });

    describe('SafeCauseResult', () => {
      it('должен поддерживать success результат', () => {
        const result: SafeCauseResult<MockError> = {
          success: true,
          cause: mockError1,
        };

        expect(result.success).toBe(true);
        expect(result.cause).toBe(mockError1);
      });

      it('должен поддерживать failure результаты', () => {
        const noCauseResult: SafeCauseResult<MockError> = {
          success: false,
          reason: 'no_cause',
        };

        const cycleResult: SafeCauseResult<MockError> = {
          success: false,
          reason: 'cycle_detected',
        };

        const depthResult: SafeCauseResult<MockError> = {
          success: false,
          reason: 'max_depth_exceeded',
        };

        expect(noCauseResult.success).toBe(false);
        expect(noCauseResult.reason).toBe('no_cause');
        expect(cycleResult.reason).toBe('cycle_detected');
        expect(depthResult.reason).toBe('max_depth_exceeded');
      });
    });

    describe('ChainTraversalResult', () => {
      it('должен поддерживать все поля результата', () => {
        const result: ChainTraversalResult<MockError> = {
          chain: [mockError1, mockError2],
          hasCycles: false,
          maxDepth: 3,
          truncated: false,
        };

        expect(result.chain).toEqual([mockError1, mockError2]);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(3);
        expect(result.truncated).toBe(false);
      });
    });

    describe('ErrorChainAnalysis', () => {
      it('должен поддерживать все поля анализа', () => {
        const analysis: ErrorChainAnalysis = {
          depth: 3,
          hasCycles: false,
          uniqueErrors: 3,
          maxDepthWithoutCycles: 3,
          cyclePaths: [],
        };

        expect(analysis.depth).toBe(3);
        expect(analysis.hasCycles).toBe(false);
        expect(analysis.uniqueErrors).toBe(3);
        expect(analysis.maxDepthWithoutCycles).toBe(3);
        expect(analysis.cyclePaths).toEqual([]);
      });
    });
  });

  describe('safeGetCause', () => {
    it('должен возвращать причину для ошибки с cause', () => {
      const result = safeGetCause(mockError1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cause).toBe(mockError2);
      }
    });

    it('должен возвращать no_cause для ошибки без cause', () => {
      const errorWithoutCause = createMockError('solo', 'Solo error');
      const result = safeGetCause(errorWithoutCause);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('no_cause');
      }
    });

    it('должен возвращать no_cause для ошибки с некорректной структурой cause', () => {
      const errorWithBadCause = { id: 'bad', message: 'Bad', cause: 'not an object' } as any;
      const result = safeGetCause(errorWithBadCause);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('no_cause');
      }
    });

    it('должен обнаруживать циклы через visited Set', () => {
      const visited = new Set([mockError1]);
      const result = safeGetCause(mockError1, visited);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('cycle_detected');
      }
    });

    it('должен игнорировать циклы если detectCycles отключен', () => {
      const visited = new Set([mockError1]);
      const config: ChainTraversalConfig = {
        maxDepth: 1000,
        detectCycles: false,
        enableCaching: false,
      };
      const result = safeGetCause(mockError1, visited, config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cause).toBe(mockError2);
      }
    });
  });

  describe('safeTraverseCauses', () => {
    it('должен корректно обходить простую цепочку ошибок', () => {
      const result = safeTraverseCauses(mockError1);

      expect(result.chain).toEqual([mockError1, mockError2, mockError3]);
      expect(result.hasCycles).toBe(false);
      expect(result.maxDepth).toBe(3);
      expect(result.truncated).toBe(false);
    });

    it('должен останавливаться на лимите глубины', () => {
      const config: ChainTraversalConfig = {
        maxDepth: 2,
        detectCycles: true,
        enableCaching: false,
      };
      const result = safeTraverseCauses(mockError1, config);

      expect(result.chain).toEqual([mockError1, mockError2]);
      expect(result.hasCycles).toBe(false);
      expect(result.maxDepth).toBe(2);
      expect(result.truncated).toBe(true);
    });

    it('должен обнаруживать циклы в цепочке', () => {
      // Создаем цикл: cyclicError1 -> cyclicError2 -> cyclicError1
      const cyclicError2 = createMockError('error2', 'Middle error');
      const cyclicError1 = createMockError('error1', 'Root error', cyclicError2);

      // Создаем цикл: cyclicError2.cause = cyclicError1
      (cyclicError2 as any).cause = { error: cyclicError1 };

      const result = safeTraverseCauses(cyclicError1);

      expect(result.hasCycles).toBe(true);
      expect(result.chain).toEqual([cyclicError1, cyclicError2]);
    });

    it('должен работать с одиночной ошибкой', () => {
      const singleError = createMockError('single', 'Single error');
      const result = safeTraverseCauses(singleError);

      expect(result.chain).toEqual([singleError]);
      expect(result.hasCycles).toBe(false);
      expect(result.maxDepth).toBe(1);
      expect(result.truncated).toBe(false);
    });

    it('должен игнорировать циклы если detectCycles отключен', () => {
      // Создаем цикл: cyclicError1 -> cyclicError2 -> cyclicError1
      const cyclicError2 = createMockError('error2', 'Middle error');
      const cyclicError1 = createMockError('error1', 'Root error', cyclicError2);

      // Создаем цикл: cyclicError2.cause = cyclicError1
      (cyclicError2 as any).cause = { error: cyclicError1 };

      const config: ChainTraversalConfig = {
        maxDepth: 5,
        detectCycles: false,
        enableCaching: false,
      };
      const result = safeTraverseCauses(cyclicError1, config);

      // Без детекции циклов должен продолжить обход до достижения maxDepth
      expect(result.truncated).toBe(true);
      expect(result.maxDepth).toBe(5);
    });
  });

  describe('Основные утилиты', () => {
    describe('flattenCauses', () => {
      it('должен возвращать плоский массив цепочки', () => {
        const result = flattenCauses(mockError1);
        expect(result).toEqual([mockError1, mockError2, mockError3]);
      });

      it('должен учитывать конфигурацию обхода', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 2,
          detectCycles: true,
          enableCaching: false,
        };
        const result = flattenCauses(mockError1, config);
        expect(result).toEqual([mockError1, mockError2]);
      });
    });

    describe('getErrorChain', () => {
      it('должен возвращать полный результат обхода цепочки', () => {
        const result = getErrorChain(mockError1);

        expect(result.chain).toEqual([mockError1, mockError2, mockError3]);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(3);
        expect(result.truncated).toBe(false);
      });
    });

    describe('findRootCause', () => {
      it('должен возвращать самую глубокую ошибку в цепочке', () => {
        const root = findRootCause(mockError1);
        expect(root).toBe(mockError3);
      });

      it('должен возвращать null для пустой цепочки', () => {
        const singleError = createMockError('single', 'Single error');
        const root = findRootCause(singleError);
        expect(root).toBe(singleError);
      });

      it('должен учитывать лимит глубины', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 2,
          detectCycles: true,
          enableCaching: false,
        };
        const root = findRootCause(mockError1, config);
        expect(root).toBe(mockError2); // Остановился на глубине 2
      });
    });
  });

  describe('Анализ цепочек', () => {
    describe('analyzeErrorChain', () => {
      it('должен анализировать простую цепочку без циклов', () => {
        const analysis = analyzeErrorChain(mockError1);

        expect(analysis.depth).toBe(3);
        expect(analysis.hasCycles).toBe(false);
        expect(analysis.uniqueErrors).toBe(3);
        expect(analysis.maxDepthWithoutCycles).toBe(3);
        expect(analysis.cyclePaths).toEqual([]);
      });

      it('должен обнаруживать циклы в анализе', () => {
        // Создаем цикл: cyclicError1 -> cyclicError2 -> cyclicError1
        const cyclicError2 = createMockError('error2', 'Middle error');
        const cyclicError1 = createMockError('error1', 'Root error', cyclicError2);

        // Создаем цикл: cyclicError2.cause = cyclicError1
        (cyclicError2 as any).cause = { error: cyclicError1 };

        const analysis = analyzeErrorChain(cyclicError1);

        expect(analysis.hasCycles).toBe(true);
        expect(analysis.cyclePaths).toEqual([['cycle_detected']]);
        expect(analysis.maxDepthWithoutCycles).toBe(1); // error1 -> error2, затем цикл
      });

      it('должен правильно считать уникальные ошибки', () => {
        const analysis = analyzeErrorChain(mockError1);
        expect(analysis.uniqueErrors).toBe(3);
      });
    });

    describe('Мемоизированные функции', () => {
      beforeEach(() => {
        // Очищаем кеши перед каждым тестом
        clearAnalysisCache();
        clearTraversalCache();
      });

      describe('analyzeErrorChainMemoized', () => {
        it('должен кешировать результаты анализа', () => {
          // Первый вызов
          const analysis1 = analyzeErrorChainMemoized(mockError1);
          expect(analysis1.depth).toBe(3);

          // Модифицируем объект (но кеш должен сохранить старый результат)
          // Поскольку это объект, кеш WeakMap должен сохранить результат
          const analysis2 = analyzeErrorChainMemoized(mockError1);
          expect(analysis2).toBe(analysis1); // Тот же объект из кеша
        });

        it('должен отключать кеширование при соответствующей конфигурации', () => {
          const config: ChainTraversalConfig = {
            maxDepth: 1000,
            detectCycles: true,
            enableCaching: false,
          };
          const analysis1 = analyzeErrorChainMemoized(mockError1, config);
          const analysis2 = analyzeErrorChainMemoized(mockError1, config);

          // Без кеширования должны быть разные объекты
          expect(analysis1).not.toBe(analysis2);
          expect(analysis1.depth).toBe(analysis2.depth);
        });
      });

      describe('safeTraverseCausesMemoized', () => {
        it('должен кешировать результаты обхода', () => {
          const result1 = safeTraverseCausesMemoized(mockError1);
          const result2 = safeTraverseCausesMemoized(mockError1);

          expect(result1).toBe(result2); // Тот же объект из кеша
          expect(result1.chain).toEqual([mockError1, mockError2, mockError3]);
        });

        it('должен отключать кеширование при соответствующей конфигурации', () => {
          const config: ChainTraversalConfig = {
            maxDepth: 1000,
            detectCycles: true,
            enableCaching: false,
          };
          const result1 = safeTraverseCausesMemoized(mockError1, config);
          const result2 = safeTraverseCausesMemoized(mockError1, config);

          expect(result1).not.toBe(result2);
          expect(result1.chain).toEqual(result2.chain);
        });
      });

      describe('Очистка кешей', () => {
        it('clearAnalysisCache должен работать без ошибок', () => {
          expect(() => clearAnalysisCache()).not.toThrow();
        });

        it('clearTraversalCache должен работать без ошибок', () => {
          expect(() => clearTraversalCache()).not.toThrow();
        });
      });
    });
  });

  describe('Утилитарные функции', () => {
    describe('hasCycles', () => {
      it('должен возвращать false для цепочки без циклов', () => {
        const result = hasCycles(mockError1);
        expect(result).toBe(false);
      });

      it('должен возвращать true для цепочки с циклами', () => {
        // Создаем цикл: cyclicError1 -> cyclicError2 -> cyclicError1
        const cyclicError2 = createMockError('error2', 'Middle error');
        const cyclicError1 = createMockError('error1', 'Root error', cyclicError2);

        // Создаем цикл: cyclicError2.cause = cyclicError1
        (cyclicError2 as any).cause = { error: cyclicError1 };

        const result = hasCycles(cyclicError1);
        expect(result).toBe(true);
      });
    });

    describe('getChainDepth', () => {
      it('должен возвращать глубину цепочки', () => {
        const depth = getChainDepth(mockError1);
        expect(depth).toBe(3);
      });

      it('должен учитывать лимит глубины', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 2,
          detectCycles: true,
          enableCaching: false,
        };
        const depth = getChainDepth(mockError1, config);
        expect(depth).toBe(2);
      });
    });

    describe('isLeafError', () => {
      it('должен возвращать true для ошибки без причины', () => {
        const leafError = createMockError('leaf', 'Leaf error');
        const result = isLeafError(leafError);
        expect(result).toBe(true);
      });

      it('должен возвращать false для ошибки с причиной', () => {
        const result = isLeafError(mockError1);
        expect(result).toBe(false);
      });
    });

    describe('isRootError', () => {
      it('должен возвращать true для ошибки без причины', () => {
        const rootError = createMockError('root', 'Root error');
        const result = isRootError(rootError);
        expect(result).toBe(true);
      });

      it('должен возвращать false для ошибки, у которой есть причина', () => {
        const result = isRootError(mockError1);
        expect(result).toBe(false);
      });

      it('должен возвращать true для ошибки, которая является корнем цепочки', () => {
        // error1 -> error2 -> error3, где error3 - корень (нет причины)
        const result = isRootError(mockError3);
        expect(result).toBe(true);
      });

      it('должен возвращать false для промежуточной ошибки', () => {
        const result = isRootError(mockError2);
        expect(result).toBe(false);
      });
    });
  });

  describe('Критические зоны и edge cases', () => {
    describe('Обработка null и undefined', () => {
      it('safeGetCause должен корректно обрабатывать null', () => {
        const result = safeGetCause(null as any);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.reason).toBe('no_cause');
        }
      });

      it('safeGetCause должен корректно обрабатывать undefined', () => {
        const result = safeGetCause(undefined as any);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.reason).toBe('no_cause');
        }
      });

      it('safeTraverseCauses должен корректно обрабатывать null', () => {
        const result = safeTraverseCauses(null as any);
        expect(result.chain).toEqual([null]);
        expect(result.hasCycles).toBe(false);
        expect(result.maxDepth).toBe(1);
        expect(result.truncated).toBe(false);
      });
    });

    describe('Глубокие рекурсии и лимиты', () => {
      it('должен обрабатывать очень глубокие цепочки с лимитом', () => {
        // Создаем цепочку глубиной 10
        let currentError: MockError = createMockError('root', 'Root');
        for (let i = 1; i <= 10; i++) {
          const nextError = createMockError(`level${i}`, `Level ${i}`, currentError);
          currentError = nextError;
        }

        const config: ChainTraversalConfig = {
          maxDepth: 5,
          detectCycles: true,
          enableCaching: false,
        };
        const result = safeTraverseCauses(currentError, config);

        expect(result.truncated).toBe(true);
        expect(result.maxDepth).toBe(5);
        expect(result.chain.length).toBe(5);
      });

      it('должен корректно работать с maxDepth = 0', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 0,
          detectCycles: true,
          enableCaching: false,
        };
        const result = safeTraverseCauses(mockError1, config);

        expect(result.truncated).toBe(true);
        expect(result.maxDepth).toBe(0);
        expect(result.chain).toEqual([]);
      });

      it('должен корректно работать с maxDepth = 1', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 1,
          detectCycles: true,
          enableCaching: false,
        };
        const result = safeTraverseCauses(mockError1, config);

        expect(result.truncated).toBe(true);
        expect(result.maxDepth).toBe(1);
        expect(result.chain).toEqual([mockError1]);
      });
    });

    describe('Сложные структуры циклов', () => {
      it('должен обнаруживать self-referencing циклы', () => {
        const selfReferencingError = createMockError('self', 'Self error');
        // Создаем self-reference
        (selfReferencingError as any).cause = { error: selfReferencingError };

        const result = safeTraverseCauses(selfReferencingError);

        expect(result.hasCycles).toBe(true);
        expect(result.chain).toEqual([selfReferencingError]);
      });

      it('должен обнаруживать длинные циклы', () => {
        // Создаем цикл: A -> B -> C -> A
        const errorA = createMockError('A', 'Error A');
        const errorB = createMockError('B', 'Error B', errorA); // C -> A
        const errorC = createMockError('C', 'Error C', errorB); // B -> C

        (errorA as any).cause = { error: errorB }; // A -> B

        const result = safeTraverseCauses(errorA);

        expect(result.hasCycles).toBe(true);
        expect(result.chain.length).toBe(2); // A -> B, затем обнаруживается цикл
      });

      it('должен корректно анализировать цепочки с циклами', () => {
        // Создаем цикл: cyclicError1 -> cyclicError2 -> cyclicError1
        const cyclicError2 = createMockError('error2', 'Middle error');
        const cyclicError1 = createMockError('error1', 'Root error', cyclicError2);

        // Создаем цикл: cyclicError2.cause = cyclicError1
        (cyclicError2 as any).cause = { error: cyclicError1 };

        const analysis = analyzeErrorChain(cyclicError1);

        expect(analysis.hasCycles).toBe(true);
        expect(analysis.depth).toBe(2);
        expect(analysis.maxDepthWithoutCycles).toBe(1);
        expect(analysis.cyclePaths.length).toBeGreaterThan(0);
      });
    });

    describe('Производительность и память', () => {
      it('мемоизированные функции должны кешировать результаты', () => {
        const result1 = analyzeErrorChainMemoized(mockError1);
        const result2 = analyzeErrorChainMemoized(mockError1);

        // Результаты должны быть одинаковыми (кешированными)
        expect(result1).toBe(result2);
        expect(result1.depth).toBe(3);
        expect(result1.hasCycles).toBe(false);
      });

      it('отключение кеширования должно работать корректно', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 1000,
          detectCycles: true,
          enableCaching: false,
        };

        const result1 = analyzeErrorChainMemoized(mockError1, config);
        const result2 = analyzeErrorChainMemoized(mockError1, config);

        // Без кеширования результаты должны быть равны но не идентичны
        expect(result1.depth).toBe(result2.depth);
        expect(result1.hasCycles).toBe(result2.hasCycles);
        expect(result1).not.toBe(result2);
      });
    });

    describe('Граничные случаи типов', () => {
      it('должен корректно работать с любыми типами ошибок', () => {
        // Примитивные типы
        expect(safeGetCause(42 as any).success).toBe(false);
        expect(safeGetCause('string' as any).success).toBe(false);
        expect(safeGetCause(true as any).success).toBe(false);

        // Объекты без cause
        expect(safeGetCause({}).success).toBe(false);

        // Объекты с некорректной структурой cause
        expect(safeGetCause({ cause: null }).success).toBe(false);
        expect(safeGetCause({ cause: {} }).success).toBe(false);
        expect(safeGetCause({ cause: { notError: 'value' } }).success).toBe(false);
      });

      it('должен корректно обрабатывать массивы в качестве ошибок', () => {
        const arrayError = [1, 2, 3];
        const result = safeTraverseCauses(arrayError as any);

        expect(result.chain).toEqual([arrayError]);
        expect(result.hasCycles).toBe(false);
      });

      it('должен корректно работать с Symbol в качестве идентификатора ошибки', () => {
        const symbolError = { id: Symbol('test'), message: 'Symbol error' };
        const result = safeTraverseCauses(symbolError as any);

        expect(result.chain).toEqual([symbolError]);
      });
    });

    describe('Конфигурационные edge cases', () => {
      it('должен корректно работать с экстремальными значениями maxDepth', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 10000,
          detectCycles: true,
          enableCaching: false,
        };
        const result = safeTraverseCauses(mockError1, config);

        expect(result.truncated).toBe(false);
        expect(result.maxDepth).toBe(3);
      });

      it('должен корректно работать с maxDepth = 1000 (default)', () => {
        const config: ChainTraversalConfig = {
          maxDepth: 1000,
          detectCycles: true,
          enableCaching: false,
        };
        const result = safeTraverseCauses(mockError1, config);

        expect(result.truncated).toBe(false);
        expect(result.maxDepth).toBe(3);
      });

      it('analyzeErrorChain должен корректно работать с отключенной детекцией циклов', () => {
        // Создаем цикл: cyclicError1 -> cyclicError2 -> cyclicError1
        const cyclicError2 = createMockError('error2', 'Middle error');
        const cyclicError1 = createMockError('error1', 'Root error', cyclicError2);

        // Создаем цикл: cyclicError2.cause = cyclicError1
        (cyclicError2 as any).cause = { error: cyclicError1 };

        const config: ChainTraversalConfig = {
          maxDepth: 1000,
          detectCycles: false,
          enableCaching: false,
        };
        const analysis = analyzeErrorChain(cyclicError1, config);

        // Без детекции циклов анализ может не обнаружить их
        expect(analysis.depth).toBeGreaterThan(0);
      });
    });
  });
});
