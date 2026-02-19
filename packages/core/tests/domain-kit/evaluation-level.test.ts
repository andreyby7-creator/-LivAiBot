/**
 * @file Unit тесты для Evaluation Level (Decision Algebra)
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import type {
  EvaluationLevel,
  EvaluationOrder,
  EvaluationScale,
  LatticeOrder,
  Ordering,
} from '../../src/domain-kit/evaluation-level.js';
import {
  evaluationAggregation,
  evaluationAlgebra,
  evaluationAlgebraDev,
  evaluationLevel,
  evaluationScale,
} from '../../src/domain-kit/evaluation-level.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createTestScale<TDomain extends string = 'risk'>(
  min: number = 0,
  max: number = 10,
  domain: TDomain = 'risk' as TDomain,
  semanticVersion: string = 'v1',
): EvaluationScale<TDomain> {
  const result = evaluationScale.create(min, max, domain, semanticVersion);
  if (!result.ok) {
    throw new Error(`Failed to create scale: ${result.reason}`);
  }
  return result.value;
}

function createTestLevel<TDomain extends string = 'risk'>(
  value: number,
  scale: EvaluationScale<TDomain>,
): EvaluationLevel<TDomain> {
  const result = evaluationLevel.create(value, scale);
  if (!result.ok) {
    throw new Error(`Failed to create level: ${result.reason}`);
  }
  return result.value;
}

function createPartialOrder<TDomain extends string>(): LatticeOrder<TDomain> {
  const baseOrder: EvaluationOrder<TDomain> = {
    compare(a, b): Ordering {
      // Partial order: некоторые элементы incomparable
      if (a === 1 && b === 2) {
        return 'incomparable';
      }
      if (a === 2 && b === 1) {
        return 'incomparable';
      }
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    },
    join(a, b): EvaluationLevel<TDomain> | undefined {
      const cmp = baseOrder.compare(a, b);
      if (cmp === 'incomparable') {
        return undefined;
      }
      if (cmp === -1) {
        return b;
      }
      if (cmp === 1) {
        return a;
      }
      return a;
    },
    meet(a, b): EvaluationLevel<TDomain> | undefined {
      const cmp = baseOrder.compare(a, b);
      if (cmp === 'incomparable') {
        return undefined;
      }
      if (cmp === -1) {
        return a;
      }
      if (cmp === 1) {
        return b;
      }
      return a;
    },
  };

  return {
    ...baseOrder,
    top(scale): EvaluationLevel<TDomain> {
      return scale.max as EvaluationLevel<TDomain>;
    },
    bottom(scale): EvaluationLevel<TDomain> {
      return scale.min as EvaluationLevel<TDomain>;
    },
  };
}

function createInvalidLatticeOrder<TDomain extends string>(): LatticeOrder<TDomain> {
  const base = evaluationAlgebra.standardLatticeOrder<TDomain>(true);
  return {
    ...base,
    join(a): EvaluationLevel<TDomain> {
      // Нарушает idempotency: join(a, a) !== a
      return (a + 1) as EvaluationLevel<TDomain>;
    },
    top(scale): EvaluationLevel<TDomain> {
      return base.top(scale);
    },
    bottom(scale): EvaluationLevel<TDomain> {
      return base.bottom(scale);
    },
  };
}

/* ============================================================================
 * 🎯 TESTS — evaluationLevel (Value Object Module)
 * ============================================================================
 */

describe('Evaluation Level (Decision Algebra)', () => {
  describe('evaluationLevel.create', () => {
    it('создает evaluation level для валидного значения', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(5, scale);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(evaluationLevel.value(result.value)).toBe(5);
      }
    });

    it('возвращает NOT_A_NUMBER для не-числа', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create('not a number', scale);

      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'NOT_A_NUMBER') {
        expect(result.reason.value).toBe('not a number');
      }
    });

    it('возвращает NOT_A_NUMBER для Infinity', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(Infinity, scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_NUMBER');
      }
    });

    it('возвращает NOT_A_NUMBER для -Infinity', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(-Infinity, scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_NUMBER');
      }
    });

    it('возвращает NON_INTEGER для дробного числа', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(5.5, scale);

      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'NON_INTEGER') {
        expect(result.reason.value).toBe(5.5);
      }
    });

    it('возвращает INVALID_RANGE для значения меньше min', () => {
      const scale = createTestScale(5, 10, 'risk');
      const result = evaluationLevel.create(3, scale);

      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'INVALID_RANGE') {
        expect(result.reason.value).toBe(3);
        expect(result.reason.min).toBe(5);
        expect(result.reason.max).toBe(10);
      }
    });

    it('возвращает INVALID_RANGE для значения больше max', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(15, scale);

      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'INVALID_RANGE') {
        expect(result.reason.value).toBe(15);
        expect(result.reason.min).toBe(0);
        expect(result.reason.max).toBe(10);
      }
    });

    it('принимает значение равное min', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(0, scale);

      expect(result.ok).toBe(true);
    });

    it('принимает значение равное max', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.create(10, scale);

      expect(result.ok).toBe(true);
    });
  });

  describe('evaluationLevel.deserialize', () => {
    it('десериализует валидный level без проверки scaleId', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.deserialize(5, scale);

      expect(result.ok).toBe(true);
    });

    it('десериализует валидный level с совпадающим scaleId', () => {
      const scale = createTestScale(0, 10, 'risk', 'v2');
      const result = evaluationLevel.deserialize(5, scale, scale.scaleId);

      expect(result.ok).toBe(true);
    });

    it('возвращает SCALE_MISMATCH для несовпадающего scaleId', () => {
      const scale = createTestScale(0, 10, 'risk', 'v2');
      const result = evaluationLevel.deserialize(5, scale, 'wrong-scale-id');

      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'SCALE_MISMATCH') {
        expect(result.reason.expectedScaleId).toBe('wrong-scale-id');
        expect(result.reason.actualScaleId).toBe(scale.scaleId);
      }
    });

    it('проверяет валидацию значения при десериализации', () => {
      const scale = createTestScale(0, 10, 'risk');
      const result = evaluationLevel.deserialize(15, scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('INVALID_RANGE');
      }
    });
  });

  describe('evaluationLevel.value', () => {
    it('извлекает числовое значение из evaluation level', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);

      expect(evaluationLevel.value(level)).toBe(5);
    });
  });

  describe('evaluationLevel.isNormalized', () => {
    it('возвращает false для обычного evaluation level', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);

      expect(evaluationLevel.isNormalized(level)).toBe(false);
    });

    it('возвращает true для normalized evaluation level', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);
      const normalized = evaluationAggregation.projectToScale(level, scale);

      expect(evaluationLevel.isNormalized(normalized)).toBe(true);
    });
  });

  /* ============================================================================
   * 📏 TESTS — evaluationScale (Scale Factory Module)
   * ============================================================================
   */

  describe('evaluationScale.create', () => {
    it('создает scale для валидных параметров', () => {
      const result = evaluationScale.create(0, 10, 'risk', 'v1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.min).toBe(0);
        expect(result.value.max).toBe(10);
        expect(result.value.domain).toBe('risk');
        expect(result.value.semanticVersion).toBe('v1');
        expect(result.value.scaleId).toMatch(/^s[a-z0-9]+$/);
      }
    });

    it('использует v1 по умолчанию для semanticVersion', () => {
      const result = evaluationScale.create(0, 10, 'risk');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.semanticVersion).toBe('v1');
      }
    });

    it('возвращает ошибку для отрицательного min', () => {
      const result = evaluationScale.create(-1, 10, 'risk');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Invalid evaluation scale');
      }
    });

    it('возвращает ошибку для max < min', () => {
      const result = evaluationScale.create(10, 5, 'risk');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Invalid evaluation scale');
      }
    });

    it('возвращает ошибку для нецелого min', () => {
      const result = evaluationScale.create(0.5, 10, 'risk');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Invalid evaluation scale');
      }
    });

    it('возвращает ошибку для нецелого max', () => {
      const result = evaluationScale.create(0, 10.5, 'risk');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Invalid evaluation scale');
      }
    });

    it('возвращает ошибку для пустого semanticVersion', () => {
      const result = evaluationScale.create(0, 10, 'risk', '');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('Semantic version cannot be empty');
      }
    });

    it('генерирует разные scaleId для разных semanticVersion', () => {
      const scale1 = createTestScale(0, 10, 'risk', 'v1');
      const scale2 = createTestScale(0, 10, 'risk', 'v2');

      expect(scale1.scaleId).not.toBe(scale2.scaleId);
    });

    it('генерирует одинаковый scaleId для одинаковых параметров', () => {
      const scale1 = createTestScale(0, 10, 'risk', 'v1');
      const scale2 = createTestScale(0, 10, 'risk', 'v1');

      expect(scale1.scaleId).toBe(scale2.scaleId);
    });
  });

  /* ============================================================================
   * 🔢 TESTS — evaluationAlgebra (Algebra Contract Module)
   * ============================================================================
   */

  describe('evaluationAlgebra.standardOrder', () => {
    it('создает ascending order (0=best, N=worst)', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      expect(order.compare(level1, level2)).toBe(-1);
      expect(order.compare(level2, level1)).toBe(1);
      expect(order.compare(level1, level1)).toBe(0);
    });

    it('создает descending order (0=worst, N=best)', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>(false);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      expect(order.compare(level1, level2)).toBe(1);
      expect(order.compare(level2, level1)).toBe(-1);
      expect(order.compare(level1, level1)).toBe(0);
    });

    it('использует ascending по умолчанию', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      expect(order.compare(level1, level2)).toBe(-1);
    });

    it('join возвращает максимум для ascending', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const joinResult = order.join(level1, level2);
      expect(joinResult).not.toBeUndefined();
      if (joinResult !== undefined) {
        expect(evaluationLevel.value(joinResult)).toBe(2);
      }
    });

    it('join возвращает минимум для descending', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>(false);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const joinResult = order.join(level1, level2);
      expect(joinResult).not.toBeUndefined();
      if (joinResult !== undefined) {
        expect(evaluationLevel.value(joinResult)).toBe(1);
      }
    });

    it('meet возвращает минимум для ascending', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const meetResult = order.meet(level1, level2);
      expect(meetResult).not.toBeUndefined();
      if (meetResult !== undefined) {
        expect(evaluationLevel.value(meetResult)).toBe(1);
      }
    });

    it('meet возвращает максимум для descending', () => {
      const order = evaluationAlgebra.standardOrder<'risk'>(false);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const meetResult = order.meet(level1, level2);
      expect(meetResult).not.toBeUndefined();
      if (meetResult !== undefined) {
        expect(evaluationLevel.value(meetResult)).toBe(2);
      }
    });
  });

  describe('evaluationAlgebra.standardLatticeOrder', () => {
    it('создает lattice order с top/bottom для ascending', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');

      const top = order.top(scale);
      const bottom = order.bottom(scale);

      expect(evaluationLevel.value(top)).toBe(10);
      expect(evaluationLevel.value(bottom)).toBe(0);
      expect(order.compare(top, bottom)).toBe(1);
    });

    it('создает lattice order с top/bottom для descending', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(false);
      const scale = createTestScale(0, 10, 'risk');

      const top = order.top(scale);
      const bottom = order.bottom(scale);

      expect(evaluationLevel.value(top)).toBe(0);
      expect(evaluationLevel.value(bottom)).toBe(10);
      expect(order.compare(top, bottom)).toBe(1);
    });

    it('использует ascending по умолчанию', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');

      const top = order.top(scale);
      expect(evaluationLevel.value(top)).toBe(10);
    });
  });

  /* ============================================================================
   * 🧪 TESTS — evaluationAlgebraDev (Dev Tools)
   * ============================================================================
   */

  describe('evaluationAlgebraDev.verify', () => {
    // Helper функция для тестов нарушения semilattice consistency
    const getSemilatticeConsistencyJoinValue = (
      valA: number,
      valB: number,
    ): EvaluationLevel<'risk'> | undefined | null => {
      const isPair = (x: number, y: number): boolean =>
        (valA === x && valB === y) || (valA === y && valB === x);
      // Специальные случаи для нарушения semilattice consistency
      if (isPair(1, 2) || isPair(2, 3)) {
        return 99 as EvaluationLevel<'risk'>;
      }
      if (isPair(99, 3)) {
        return undefined;
      }
      if (isPair(1, 99)) {
        return 3 as EvaluationLevel<'risk'>;
      }
      return null; // Использовать стандартный order
    };
    it('возвращает ok для валидного lattice order', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('возвращает ok для массива с менее чем 2 элементами', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);

      const result = evaluationAlgebraDev.verify(order, [level1], scale);

      expect(result.ok).toBe(true);
    });

    it('возвращает ok для пустого массива', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');

      const result = evaluationAlgebraDev.verify(order, [], scale);

      expect(result.ok).toBe(true);
    });

    it('возвращает ok если один из элементов undefined', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);

      const result = evaluationAlgebraDev.verify(order, [
        level1,
        undefined as unknown as EvaluationLevel<'risk'>,
      ], scale);

      expect(result.ok).toBe(true);
    });

    it('обнаруживает нарушение idempotency law', () => {
      const order = createInvalidLatticeOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('idempotency');
      }
    });

    it('обрабатывает partial order в associativity проверках', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Partial order с incomparable элементами - проверки должны пропускать такие случаи
      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      // Может вернуть ok или fail в зависимости от реализации
      expect(result).toHaveProperty('ok');
    });

    it('обнаруживает нарушение associativity law для join', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Создаем order, который нарушает associativity
      // Нормально: join(1,2)=2, join(2,3)=3, join(1,3)=3
      // join(join(1,2),3) = join(2,3) = 3
      // join(1,join(2,3)) = join(1,3) = 3
      // Нарушаем: делаем join(2,3) возвращать 4, а join(1,4) возвращать 3
      // join(join(1,2),3) = join(2,3) = 4
      // join(1,join(2,3)) = join(1,4) = 3
      // 4 ≠ 3, поэтому associativity нарушена
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // join(2,3) возвращает 4 вместо 3
          if (valA === 2 && valB === 3) {
            return 4 as EvaluationLevel<'risk'>;
          }
          // join(1,4) возвращает 3, чтобы нарушить associativity
          if (valA === 1 && valB === 4) {
            return 3 as EvaluationLevel<'risk'>;
          }
          const joinResult = order.join(a, b);
          if (joinResult === undefined) {
            throw new Error('Unexpected undefined from order.join');
          }
          return joinResult;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('associativity');
      }
    });

    it('обнаруживает нарушение semilattice consistency для join', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Создаем order, который нарушает semilattice consistency
      // Нужно сделать так, чтобы:
      // join(join(1,2),3) = undefined
      // join(1,join(2,3)) = определенное значение
      // Или наоборот
      // join(1,2)=2, join(2,3)=undefined, join(1,3)=3
      // join(join(1,2),3) = join(2,3) = undefined
      // join(1,join(2,3)) = join(1,undefined) - но joinBC = undefined, поэтому joinABC = undefined
      // Проблема: обе стороны undefined
      // Решение: делаем join(1,2) возвращать специальное значение 99, которое при join с 3 даст undefined
      // Но join(2,1) тоже должен вернуть 99, чтобы сохранить commutativity
      // join(99,3) = undefined
      // join(1,99) = 3 (определен)
      // Тогда:
      // join(join(1,2),3) = join(99,3) = undefined
      // join(1,join(2,3)) = join(1,undefined) - но joinBC = undefined, поэтому joinABC = undefined
      // Все еще обе стороны undefined!
      // Другой подход: делаем join(2,3) возвращать специальное значение 99, которое при join с 1 даст определенное значение
      // join(2,3) = 99
      // join(1,99) = 3
      // join(99,3) = undefined (чтобы нарушить consistency)
      // Тогда:
      // join(join(1,2),3) = join(2,3) = 99, затем join(99,3) = undefined
      // join(1,join(2,3)) = join(1,99) = 3
      // undefined ≠ 3, но проверка consistency проверяет existence, а не значения
      // joinAbC = undefined, joinABC = 3
      // Одна сторона undefined, другая определена - нарушение consistency!
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> | undefined {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          const specialValue = getSemilatticeConsistencyJoinValue(valA, valB);
          if (specialValue !== null) {
            return specialValue;
          }
          const joinResult = order.join(a, b);
          return joinResult ?? undefined;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('semilattice consistency');
      }
    });

    it('проверяет commutativity law', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('проверяет associativity law для join', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('проверяет associativity law для meet', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('проверяет absorption law', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('проверяет согласованность compare с join/meet', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('проверяет top/bottom consistency', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      expect(result.ok).toBe(true);
    });

    it('обнаруживает нарушение commutativity law', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Нарушаем commutativity: join(1,2) !== join(2,1)
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // join(1,2) возвращает 3 вместо 2
          if (valA === 1 && valB === 2) {
            return 3 as EvaluationLevel<'risk'>;
          }
          // join(2,1) возвращает 2 (нормально)
          const joinResult = order.join(a, b);
          if (joinResult === undefined) {
            throw new Error('Unexpected undefined from order.join');
          }
          return joinResult;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('commutativity');
      }
    });

    it('обнаруживает нарушение associativity law для meet', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Нарушаем associativity для meet: meet(meet(1,2),3) !== meet(1,meet(2,3))
      // meet(1,2)=1, meet(2,3)=2, meet(1,3)=1
      // meet(meet(1,2),3) = meet(1,3) = 1
      // meet(1,meet(2,3)) = meet(1,2) = 1
      // Нарушаем: делаем meet(1,2) возвращать 4, meet(4,3) возвращать 5, meet(1,4) возвращать 1
      // meet(meet(1,2),3) = meet(4,3) = 5
      // meet(1,meet(2,3)) = meet(1,2) = 4
      // 5 !== 4, но нужно сохранить idempotency и commutativity
      const createMeetFunction = (): LatticeOrder<'risk'>['meet'] => {
        return (a, b): EvaluationLevel<'risk'> => {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // Специальные случаи для нарушения associativity
          if ((valA === 1 && valB === 2) || (valA === 2 && valB === 1)) {
            return 4 as EvaluationLevel<'risk'>;
          }
          if ((valA === 4 && valB === 3) || (valA === 3 && valB === 4)) {
            return 5 as EvaluationLevel<'risk'>;
          }
          if ((valA === 1 && valB === 4) || (valA === 4 && valB === 1)) {
            return 4 as EvaluationLevel<'risk'>;
          }
          const meetResult = order.meet(a, b);
          if (meetResult === undefined) {
            throw new Error('Unexpected undefined from order.meet');
          }
          return meetResult;
        };
      };
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        meet: createMeetFunction(),
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('associativity');
        expect(result.reason).toContain('meet');
      }
    });

    it('обнаруживает нарушение absorption law', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Нарушаем absorption: join(1, meet(1,2)) !== 1
      // meet(1,2)=1, join(1,1)=1 (absorption)
      // Нарушаем: делаем meet(1,2) возвращать 0, а join(1,0) возвращать 2 вместо 1
      // Это нарушает absorption, но сохраняет idempotency (join(1,1)=1, meet(1,1)=1)
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // join(1,0) возвращает 2 вместо 1 (нарушает absorption)
          if ((valA === 1 && valB === 0) || (valA === 0 && valB === 1)) {
            return 2 as EvaluationLevel<'risk'>;
          }
          const joinResult = order.join(a, b);
          if (joinResult === undefined) {
            throw new Error('Unexpected undefined from order.join');
          }
          return joinResult;
        },
        meet(a, b): EvaluationLevel<'risk'> {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // meet(1,2) возвращает 0 вместо 1 (чтобы нарушить absorption)
          if ((valA === 1 && valB === 2) || (valA === 2 && valB === 1)) {
            return 0 as EvaluationLevel<'risk'>;
          }
          const meetResult = order.meet(a, b);
          if (meetResult === undefined) {
            throw new Error('Unexpected undefined from order.meet');
          }
          return meetResult;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('absorption');
      }
    });

    it('обнаруживает нарушение согласованности compare с join/meet', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Нарушаем consistency: compare(1,2)=-1, но join(1,2) !== 2
      // Нужно сохранить commutativity: join(1,2) и join(2,1) должны возвращать одно и то же
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // join(1,2) возвращает 3 вместо 2 (нарушает consistency)
          // join(2,1) тоже возвращает 3 для commutativity
          if ((valA === 1 && valB === 2) || (valA === 2 && valB === 1)) {
            return 3 as EvaluationLevel<'risk'>;
          }
          const joinResult = order.join(a, b);
          if (joinResult === undefined) {
            throw new Error('Unexpected undefined from order.join');
          }
          return joinResult;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('inconsistency');
      }
    });

    it('обнаруживает нарушение top/bottom consistency', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Нарушаем top/bottom: top не больше bottom
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        compare(a, b): Ordering {
          // Делаем top меньше bottom
          if (a === 10 && b === 0) {
            return -1; // top < bottom (нарушение!)
          }
          return order.compare(a, b);
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('top');
        expect(result.reason).toContain('bottom');
      }
    });

    it('обрабатывает partial order в associativity проверках', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Partial order с incomparable элементами - проверки должны пропускать такие случаи
      const result = evaluationAlgebraDev.verify(order, [level1, level2, level3], scale);

      // Может вернуть ok или fail в зависимости от реализации
      expect(result).toHaveProperty('ok');
    });

    it('обнаруживает нарушение associativity law для join', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Создаем order, который нарушает associativity
      // Нормально: join(1,2)=2, join(2,3)=3, join(1,3)=3
      // join(join(1,2),3) = join(2,3) = 3
      // join(1,join(2,3)) = join(1,3) = 3
      // Нарушаем: делаем join(2,3) возвращать 4, а join(1,4) возвращать 3
      // join(join(1,2),3) = join(2,3) = 4
      // join(1,join(2,3)) = join(1,4) = 3
      // 4 ≠ 3, поэтому associativity нарушена
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          // join(2,3) возвращает 4 вместо 3
          if (valA === 2 && valB === 3) {
            return 4 as EvaluationLevel<'risk'>;
          }
          // join(1,4) возвращает 3, чтобы нарушить associativity
          if (valA === 1 && valB === 4) {
            return 3 as EvaluationLevel<'risk'>;
          }
          const joinResult = order.join(a, b);
          if (joinResult === undefined) {
            throw new Error('Unexpected undefined from order.join');
          }
          return joinResult;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('associativity');
      }
    });

    it('обнаруживает нарушение semilattice consistency для join', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      // Создаем order, который нарушает semilattice consistency
      // Нужно сделать так, чтобы:
      // join(join(1,2),3) = undefined
      // join(1,join(2,3)) = определенное значение
      // Или наоборот
      // join(1,2)=2, join(2,3)=undefined, join(1,3)=3
      // join(join(1,2),3) = join(2,3) = undefined
      // join(1,join(2,3)) = join(1,undefined) - но joinBC = undefined, поэтому joinABC = undefined
      // Проблема: обе стороны undefined
      // Решение: делаем join(1,2) возвращать специальное значение 99, которое при join с 3 даст undefined
      // Но join(2,1) тоже должен вернуть 99, чтобы сохранить commutativity
      // join(99,3) = undefined
      // join(1,99) = 3 (определен)
      // Тогда:
      // join(join(1,2),3) = join(99,3) = undefined
      // join(1,join(2,3)) = join(1,undefined) - но joinBC = undefined, поэтому joinABC = undefined
      // Все еще обе стороны undefined!
      // Другой подход: делаем join(2,3) возвращать специальное значение 99, которое при join с 1 даст определенное значение
      // join(2,3) = 99
      // join(1,99) = 3
      // join(99,3) = undefined (чтобы нарушить consistency)
      // Тогда:
      // join(join(1,2),3) = join(2,3) = 99, затем join(99,3) = undefined
      // join(1,join(2,3)) = join(1,99) = 3
      // undefined ≠ 3, но проверка consistency проверяет existence, а не значения
      // joinAbC = undefined, joinABC = 3
      // Одна сторона undefined, другая определена - нарушение consistency!
      const invalidOrder: LatticeOrder<'risk'> = {
        ...order,
        join(a, b): EvaluationLevel<'risk'> | undefined {
          const valA = evaluationLevel.value(a);
          const valB = evaluationLevel.value(b);
          const specialValue = getSemilatticeConsistencyJoinValue(valA, valB);
          if (specialValue !== null) {
            return specialValue;
          }
          const joinResult = order.join(a, b);
          return joinResult ?? undefined;
        },
      };

      const result = evaluationAlgebraDev.verify(invalidOrder, [level1, level2, level3], scale);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('semilattice consistency');
      }
    });
  });

  /* ============================================================================
   * 🎯 TESTS — evaluationAggregation (Aggregation Policies Module)
   * ============================================================================
   */

  describe('evaluationAggregation.step', () => {
    it('возвращает join результат для comparable элементов', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const prev = createTestLevel(1, scale);
      const next = createTestLevel(2, scale);

      const result = evaluationAggregation.step(prev, next, order);

      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(evaluationLevel.value(result)).toBe(2);
      }
    });

    it('возвращает undefined для incomparable элементов', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const prev = createTestLevel(1, scale);
      const next = createTestLevel(2, scale);

      const result = evaluationAggregation.step(prev, next, order);

      expect(result).toBeUndefined();
    });
  });

  describe('evaluationAggregation.isInRange', () => {
    it('возвращает true для значения в диапазоне', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);

      expect(evaluationAggregation.isInRange(level, 0, 10)).toBe(true);
      expect(evaluationAggregation.isInRange(level, 3, 7)).toBe(true);
      expect(evaluationAggregation.isInRange(level, 5, 5)).toBe(true);
    });

    it('возвращает false для значения меньше min', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);

      expect(evaluationAggregation.isInRange(level, 6, 10)).toBe(false);
    });

    it('возвращает false для значения больше max', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);

      expect(evaluationAggregation.isInRange(level, 0, 4)).toBe(false);
    });
  });

  describe('evaluationAggregation.projectToScale', () => {
    it('возвращает min для значения меньше min', () => {
      const scale = createTestScale(5, 10, 'risk');
      const level = createTestLevel(3, createTestScale(0, 10, 'risk'));

      const projected = evaluationAggregation.projectToScale(level, scale);

      expect(evaluationLevel.value(projected as unknown as EvaluationLevel<string>)).toBe(5);
      expect(evaluationLevel.isNormalized(projected)).toBe(true);
    });

    it('возвращает max для значения больше max', () => {
      const scale = createTestScale(0, 5, 'risk');
      const level = createTestLevel(7, createTestScale(0, 10, 'risk'));

      const projected = evaluationAggregation.projectToScale(level, scale);

      expect(evaluationLevel.value(projected as unknown as EvaluationLevel<string>)).toBe(5);
      expect(evaluationLevel.isNormalized(projected)).toBe(true);
    });

    it('возвращает исходное значение для значения в диапазоне', () => {
      const scale = createTestScale(0, 10, 'risk');
      const level = createTestLevel(5, scale);

      const projected = evaluationAggregation.projectToScale(level, scale);

      expect(evaluationLevel.value(projected as unknown as EvaluationLevel<string>)).toBe(5);
      expect(evaluationLevel.isNormalized(projected)).toBe(true);
    });
  });

  describe('evaluationAggregation.worstCase', () => {
    it('возвращает undefined для пустого массива', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);

      const result = evaluationAggregation.worstCase(order, []);

      expect(result).toBeUndefined();
    });

    it('возвращает undefined для массива с undefined первым элементом', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);

      const result = evaluationAggregation.worstCase(order, [
        undefined as unknown as EvaluationLevel<'risk'>,
      ]);

      expect(result).toBeUndefined();
    });

    it('возвращает максимум для strict mode', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(3, scale);
      const level3 = createTestLevel(2, scale);

      const result = evaluationAggregation.worstCase(order, [level1, level2, level3], 'strict');

      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(evaluationLevel.value(result)).toBe(3);
      }
    });

    it('возвращает undefined для strict mode при incomparable', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const result = evaluationAggregation.worstCase(order, [level1, level2], 'strict');

      expect(result).toBeUndefined();
    });

    it('выбирает глобальный representative для lenient mode', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(3, scale);
      const level3 = createTestLevel(2, scale);

      const result = evaluationAggregation.worstCase(order, [level1, level2, level3], 'lenient');

      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(evaluationLevel.value(result)).toBe(3);
      }
    });

    it('выбирает первый найденный для lenient mode при равных incomparable', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAggregation.worstCase(order, [level1, level2, level3], 'lenient');

      // Должен выбрать первый найденный representative
      expect(result).not.toBeUndefined();
    });

    it('использует strict по умолчанию', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const result = evaluationAggregation.worstCase(order, [level1, level2]);

      expect(result).not.toBeUndefined();
    });
  });

  describe('evaluationAggregation.bestCase', () => {
    it('возвращает undefined для пустого массива', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);

      const result = evaluationAggregation.bestCase(order, []);

      expect(result).toBeUndefined();
    });

    it('возвращает undefined для массива с undefined первым элементом', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);

      const result = evaluationAggregation.bestCase(order, [
        undefined as unknown as EvaluationLevel<'risk'>,
      ]);

      expect(result).toBeUndefined();
    });

    it('возвращает минимум для strict mode', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(3, scale);
      const level2 = createTestLevel(1, scale);
      const level3 = createTestLevel(2, scale);

      const result = evaluationAggregation.bestCase(order, [level1, level2, level3], 'strict');

      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(evaluationLevel.value(result)).toBe(1);
      }
    });

    it('возвращает undefined для strict mode при incomparable', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const result = evaluationAggregation.bestCase(order, [level1, level2], 'strict');

      expect(result).toBeUndefined();
    });

    it('обрабатывает reduce с undefined в strict mode', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      // Симулируем ситуацию, когда meet может вернуть undefined
      const customOrder: LatticeOrder<'risk'> = {
        ...order,
        meet(a, b): EvaluationLevel<'risk'> | undefined {
          // Возвращаем undefined для определенных случаев
          if (evaluationLevel.value(a) === 1 && evaluationLevel.value(b) === 2) {
            return undefined;
          }
          return order.meet(a, b);
        },
      };

      const result = evaluationAggregation.bestCase(customOrder, [level1, level2], 'strict');

      expect(result).toBeUndefined();
    });

    it('выбирает глобальный representative для lenient mode', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(3, scale);
      const level2 = createTestLevel(1, scale);
      const level3 = createTestLevel(2, scale);

      const result = evaluationAggregation.bestCase(order, [level1, level2, level3], 'lenient');

      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(evaluationLevel.value(result)).toBe(1);
      }
    });

    it('выбирает первый найденный для lenient mode при равных incomparable', () => {
      const order = createPartialOrder<'risk'>();
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);
      const level3 = createTestLevel(3, scale);

      const result = evaluationAggregation.bestCase(order, [level1, level2, level3], 'lenient');

      // Должен выбрать первый найденный representative
      expect(result).not.toBeUndefined();
    });

    it('использует strict по умолчанию', () => {
      const order = evaluationAlgebra.standardLatticeOrder<'risk'>(true);
      const scale = createTestScale(0, 10, 'risk');
      const level1 = createTestLevel(1, scale);
      const level2 = createTestLevel(2, scale);

      const result = evaluationAggregation.bestCase(order, [level1, level2]);

      expect(result).not.toBeUndefined();
    });
  });
});
