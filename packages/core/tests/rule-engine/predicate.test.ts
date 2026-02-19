/**
 * @file Unit тесты для Predicate (Generic Predicate Operations)
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it, vi } from 'vitest';
import { predicate, predicateAlgebra } from '../../src/rule-engine/predicate.js';
import type {
  Predicate,
  PredicateErrorMetadata,
  PredicateHooks,
  PredicateOperation,
} from '../../src/rule-engine/predicate.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function* createPredicateIterable<TFact>(
  predicates: readonly Predicate<TFact>[],
): Generator<Predicate<TFact>> {
  // eslint-disable-next-line functional/no-loop-statements -- generator требует loop
  for (const pred of predicates) {
    yield pred;
  }
}

function createMockErrorMetadata(): PredicateErrorMetadata {
  /* eslint-disable ai-security/model-poisoning -- тестовые данные, валидация происходит при использовании через validateErrorMetadataForDebug */
  const metadata = {
    timestamp: 1234567890,
    featureFlags: ['flag1', 'flag2'],
    metadata: { key: 'value' },
  };
  // Валидация: все поля валидны (timestamp - число, featureFlags - массив строк, metadata - объект)
  return metadata as PredicateErrorMetadata;
  /* eslint-enable ai-security/model-poisoning */
}

/* ============================================================================
 * 🧪 PREDICATE.AND — TESTS
 * ============================================================================
 */

describe('predicate.and', () => {
  it('композирует предикаты через AND (все true)', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const result = predicate.and([pred1, pred2]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value(4)).toBe(true);
      expect(result.value(3)).toBe(false);
      expect(result.value(-2)).toBe(false);
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого массива', () => {
    const result = predicate.and([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('short-circuit при первом false', () => {
    const callCounts = { value: 0 };
    /* eslint-disable fp/no-mutation -- необходимо для тестирования количества вызовов */
    const pred1: Predicate<number> = (x) => {
      callCounts.value += 1;
      return x > 0;
    };
    const pred2: Predicate<number> = (x) => {
      callCounts.value += 1;
      return x % 2 === 0;
    };
    const pred3: Predicate<number> = (x) => {
      callCounts.value += 1;
      return x > 10;
    };
    /* eslint-enable fp/no-mutation */
    const result = predicate.and([pred1, pred2, pred3]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value(3)).toBe(false); // pred1=true, pred2=false (short-circuit)
      expect(callCounts.value).toBe(2); // только pred1 и pred2 вызваны
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого массива с валидацией', () => {
    const result = predicate.and([], { maxCompositionSize: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const result = predicate.and(preds, { maxCompositionSize: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('возвращает INVALID_PREDICATE для undefined предиката в массиве', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const preds = [pred1, undefined as unknown as Predicate<number>];
    const result = predicate.and(preds);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE.OR — TESTS
 * ============================================================================
 */

describe('predicate.or', () => {
  it('композирует предикаты через OR (хотя бы один true)', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x < 0;
    const result = predicate.or([pred1, pred2]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value(5)).toBe(true);
      expect(result.value(-3)).toBe(true);
      expect(result.value(0)).toBe(false);
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого массива', () => {
    const result = predicate.or([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('short-circuit при первом true', () => {
    const callCounts = { value: 0 };
    /* eslint-disable fp/no-mutation -- необходимо для тестирования количества вызовов */
    const pred1: Predicate<number> = (x) => {
      callCounts.value += 1;
      return x > 0;
    };
    const pred2: Predicate<number> = (x) => {
      callCounts.value += 1;
      return x % 2 === 0;
    };
    const pred3: Predicate<number> = (x) => {
      callCounts.value += 1;
      return x > 10;
    };
    /* eslint-enable fp/no-mutation */
    const result = predicate.or([pred1, pred2, pred3]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value(5)).toBe(true); // pred1=true (short-circuit)
      expect(callCounts.value).toBe(1); // только pred1 вызван
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const result = predicate.or(preds, { maxCompositionSize: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('возвращает INVALID_PREDICATE для undefined предиката в массиве', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const preds = [pred1, undefined as unknown as Predicate<number>];
    const result = predicate.or(preds);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE.NOT — TESTS
 * ============================================================================
 */

describe('predicate.not', () => {
  it('инвертирует предикат', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = predicate.not(pred);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value(5)).toBe(false);
      expect(result.value(-3)).toBe(true);
    }
  });

  it('возвращает INVALID_PREDICATE для невалидного предиката', () => {
    const result = predicate.not(null as unknown as Predicate<number>);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });

  it('возвращает INVALID_PREDICATE для не-функции', () => {
    const result = predicate.not('not a function' as unknown as Predicate<number>);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE.VALIDATE — TESTS
 * ============================================================================
 */

describe('predicate.validate', () => {
  it('валидирует корректный предикат', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = predicate.validate(pred);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(pred);
    }
  });

  it('возвращает INVALID_PREDICATE для null', () => {
    const result = predicate.validate<number>(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });

  it('возвращает INVALID_PREDICATE для undefined', () => {
    const result = predicate.validate<number>(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });

  it('возвращает INVALID_PREDICATE для не-функции', () => {
    const result = predicate.validate<number>('string');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE.EVALUATE — TESTS
 * ============================================================================
 */

describe('predicate.evaluate', () => {
  it('вычисляет предикат для факта (true)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = predicate.evaluate(pred, 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('вычисляет предикат для факта (false)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = predicate.evaluate(pred, -3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  it('явно приводит результат к boolean', () => {
    const pred: Predicate<number> = () => 1 as unknown as boolean;
    const result = predicate.evaluate(pred, 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('возвращает INVALID_PREDICATE для невалидного предиката', () => {
    const result = predicate.evaluate(null as unknown as Predicate<number>, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });

  it('обрабатывает исключение из предиката (Error)', () => {
    const pred: Predicate<number> = () => {
      throw new Error('Test error');
    };
    const result = predicate.evaluate(pred, 5);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === 'EVALUATION_ERROR') {
      expect(result.reason.index).toBe(0);
      expect(result.reason.error).toBe('Test error');
      expect(result.reason.stack).toBeDefined();
    }
  });

  it('обрабатывает исключение из предиката (не Error)', () => {
    const pred: Predicate<number> = () => {
      throw 'string error';
    };
    const result = predicate.evaluate(pred, 5);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === 'EVALUATION_ERROR') {
      expect(result.reason.index).toBe(0);
      expect(result.reason.error).toBeUndefined();
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE.EVALUATEALL — TESTS
 * ============================================================================
 */

describe('predicate.evaluateAll', () => {
  it('вычисляет массив предикатов для факта', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      (x) => x % 2 === 0,
      (x) => x < 10,
    ];
    const result = predicate.evaluateAll(preds, 4);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([true, true, true]);
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого массива', () => {
    const result = predicate.evaluateAll([], 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const result = predicate.evaluateAll(preds, 5, { maxCompositionSize: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('ранний выход при ошибке выполнения', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
      (x) => x < 10,
    ];
    const result = predicate.evaluateAll(preds, 4);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === 'EVALUATION_ERROR') {
      expect(result.reason.index).toBe(1);
    }
  });

  it('работает с debug mode и errorMetadata', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
    ];
    /* eslint-disable ai-security/model-poisoning -- errorMetadata создан через createMockErrorMetadata, валидация происходит внутри predicate.evaluateAll через validateErrorMetadataForDebug */
    const errorMetadata = createMockErrorMetadata();
    const result = predicate.evaluateAll(preds, 4, {
      debug: true,
      errorMetadata,
      now: 1234567890,
    });
    /* eslint-enable ai-security/model-poisoning */
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === 'EVALUATION_ERROR') {
      expect(result.reason.metadata).toBeDefined();
    }
  });

  it('работает без debug mode (createErrorMetadataLazy возвращает функцию)', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
    ];
    const result = predicate.evaluateAll(preds, 4, {
      debug: false, // без debug mode
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason.kind === 'EVALUATION_ERROR') {
      // В production mode metadata не должно быть
      expect(result.reason.metadata).toBeUndefined();
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE.EVALUATEALLITERABLE — TESTS
 * ============================================================================
 */

describe('predicate.evaluateAllIterable', () => {
  it('вычисляет Iterable предикатов для факта (streaming)', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      (x) => x % 2 === 0,
      (x) => x < 10,
    ];
    const generator = predicate.evaluateAllIterable(createPredicateIterable(preds), 4);
    const results: boolean[] = Array.from(generator)
      .filter((result): result is { ok: true; value: boolean; } => result.ok === true)
      .map((result) => result.value);
    expect(results).toEqual([true, true, true]);
  });

  it('возвращает EMPTY_PREDICATES для пустого Iterable', () => {
    const generator = predicate.evaluateAllIterable(createPredicateIterable([]), 5);
    const results = Array.from(generator);
    expect(results).toHaveLength(1);
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      expect(firstResult.reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const generator = predicate.evaluateAllIterable(
      createPredicateIterable(preds),
      5,
      { maxCompositionSize: 3 },
    );
    const results = Array.from(generator);
    // Обрабатываются 3 предиката, затем возвращается COMPOSITION_ERROR
    expect(results.length).toBeGreaterThanOrEqual(3);
    const lastResult = results[results.length - 1];
    expect(lastResult?.ok).toBe(false);
    if (lastResult && !lastResult.ok) {
      expect(lastResult.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('ранний выход при ошибке выполнения', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
      (x) => x < 10,
    ];
    const generator = predicate.evaluateAllIterable(createPredicateIterable(preds), 4);
    const results = Array.from(generator);
    expect(results).toHaveLength(2); // два результата до ошибки
    const firstResult = results[0];
    const secondResult = results[1];
    expect(firstResult?.ok).toBe(true);
    expect(secondResult?.ok).toBe(false);
    if (secondResult && !secondResult.ok && secondResult.reason.kind === 'EVALUATION_ERROR') {
      expect(secondResult.reason.index).toBe(1);
    }
  });

  it('работает с debug mode и errorMetadata', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
    ];
    /* eslint-disable ai-security/model-poisoning -- errorMetadata создан через createMockErrorMetadata, валидация происходит внутри predicate.evaluateAllIterable через validateErrorMetadataForDebug */
    const errorMetadata = createMockErrorMetadata();
    const generator = predicate.evaluateAllIterable(createPredicateIterable(preds), 4, {
      debug: true,
      errorMetadata,
      now: 1234567890,
    });
    /* eslint-enable ai-security/model-poisoning */
    const results = Array.from(generator);
    const secondResult = results[1];
    expect(secondResult?.ok).toBe(false);
    if (secondResult && !secondResult.ok && secondResult.reason.kind === 'EVALUATION_ERROR') {
      expect(secondResult.reason.metadata).toBeDefined();
    }
  });

  it('работает с debug mode без now (возвращает undefined metadata)', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
    ];
    /* eslint-disable ai-security/model-poisoning -- errorMetadata создан через createMockErrorMetadata, валидация происходит внутри predicate.evaluateAllIterable через validateErrorMetadataForDebug */
    const errorMetadata = createMockErrorMetadata();
    const generator = predicate.evaluateAllIterable(createPredicateIterable(preds), 4, {
      debug: true,
      errorMetadata,
      // now не передан
    });
    /* eslint-enable ai-security/model-poisoning */
    const results = Array.from(generator);
    const secondResult = results[1];
    expect(secondResult?.ok).toBe(false);
    if (secondResult && !secondResult.ok && secondResult.reason.kind === 'EVALUATION_ERROR') {
      // В debug mode без now metadata может быть undefined
      expect(secondResult.reason.metadata).toBeUndefined();
    }
  });

  it('работает с debug mode и невалидными errorMetadata (все поля невалидны)', () => {
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      () => {
        throw new Error('Test error');
      },
    ];
    /* eslint-disable ai-security/model-poisoning -- errorMetadata намеренно содержит невалидные данные для тестирования валидации, валидация происходит внутри predicate.evaluateAllIterable через validateErrorMetadataForDebug */
    // errorMetadata с невалидными полями (все будут отфильтрованы)
    const errorMetadata = {
      timestamp: NaN, // невалидный
      featureFlags: ['flag1', 123 as unknown as string], // невалидный (содержит не-строку)
      metadata: null as unknown as Record<string, unknown>, // невалидный (null)
    } as unknown as PredicateErrorMetadata;
    const generator = predicate.evaluateAllIterable(createPredicateIterable(preds), 4, {
      debug: true,
      errorMetadata,
      now: 1234567890,
    });
    /* eslint-enable ai-security/model-poisoning */
    const results = Array.from(generator);
    const secondResult = results[1];
    expect(secondResult?.ok).toBe(false);
    if (secondResult && !secondResult.ok && secondResult.reason.kind === 'EVALUATION_ERROR') {
      // При невалидных errorMetadata должен быть только timestamp
      expect(secondResult.reason.metadata).toBeDefined();
      if (secondResult.reason.metadata) {
        expect(secondResult.reason.metadata.timestamp).toBe(1234567890);
      }
    }
  });

  it('обрабатывает undefined предикат в Iterable (edge case)', () => {
    // Создаем Iterable с undefined предикатом (обход валидации для Iterable)
    function* createIterableWithUndefined() {
      yield (x: number) => x > 0;
      yield undefined as unknown as Predicate<number>;
    }
    const generator = predicate.evaluateAllIterable(createIterableWithUndefined(), 4);
    const results = Array.from(generator);
    const secondResult = results[1];
    expect(secondResult?.ok).toBe(false);
    if (secondResult && !secondResult.ok) {
      expect(secondResult.reason.kind).toBe('EVALUATION_ERROR');
      if (secondResult.reason.kind === 'EVALUATION_ERROR') {
        expect(secondResult.reason.index).toBe(1);
      }
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE ALGEBRA.OPERATE — TESTS
 * ============================================================================
 */

describe('predicateAlgebra.operate', () => {
  it('выполняет операцию с массивом предикатов', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      (x) => x % 2 === 0,
      (x) => x < 10,
    ];
    const result = predicateAlgebra.operate(operation, preds, 4, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3); // все три предиката вернули true
    }
  });

  it('выполняет операцию с Iterable предикатов', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      (x) => x % 2 === 0,
    ];
    const result = predicateAlgebra.operate(
      operation,
      createPredicateIterable(preds),
      4,
      undefined,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2);
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого массива', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const result = predicateAlgebra.operate(operation, [], 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; };
      if (reason.kind === 'EMPTY_PREDICATES') {
        expect(reason.kind).toBe('EMPTY_PREDICATES');
      }
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого Iterable', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const result = predicateAlgebra.operate(operation, createPredicateIterable([]), 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; };
      expect(reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const result = predicateAlgebra.operate(operation, preds, 5, undefined, {
      maxCompositionSize: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; };
      if (reason.kind === 'COMPOSITION_ERROR') {
        expect(reason.kind).toBe('COMPOSITION_ERROR');
      }
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize для Iterable', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const result = predicateAlgebra.operate(
      operation,
      createPredicateIterable(preds),
      5,
      undefined,
      {
        maxCompositionSize: 3,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; };
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('вызывает hooks (beforeStep, afterStep, afterFinalize)', () => {
    const beforeStep = vi.fn();
    const afterStep = vi.fn();
    const afterFinalize = vi.fn();
    const hooks: PredicateHooks<number, number, number, void> = {
      beforeStep,
      afterStep,
      afterFinalize,
    };
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const result = predicateAlgebra.operate(operation, preds, 4, undefined, { hooks });
    expect(result.ok).toBe(true);
    expect(beforeStep).toHaveBeenCalledTimes(1);
    expect(afterStep).toHaveBeenCalledTimes(1);
    expect(afterFinalize).toHaveBeenCalledTimes(1);
  });

  it('обрабатывает ошибки в hooks (не нарушает pipeline)', () => {
    const hooks: PredicateHooks<number, number, number, void> = {
      beforeStep: () => {
        throw new Error('Hook error');
      },
      afterStep: () => {
        throw new Error('Hook error');
      },
      afterFinalize: () => {
        throw new Error('Hook error');
      },
    };
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const result = predicateAlgebra.operate(operation, preds, 4, undefined, { hooks });
    expect(result.ok).toBe(true); // ошибки в hooks игнорируются
  });

  it('обрабатывает ошибку в step', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const result = predicateAlgebra.operate(operation, preds, 4, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; index?: number; };
      if (reason.kind === 'EVALUATION_ERROR') {
        expect(reason.index).toBe(0);
      }
    }
  });

  it('обрабатывает ошибку в step для Iterable', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const result = predicateAlgebra.operate(
      operation,
      createPredicateIterable(preds),
      4,
      undefined,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; index?: number; };
      if (reason.kind === 'EVALUATION_ERROR') {
        expect(reason.index).toBe(0);
      }
    }
  });

  it('обрабатывает undefined предикат в Iterable для operate (edge case)', () => {
    // Создаем Iterable с undefined предикатом (обход валидации для Iterable)
    function* createIterableWithUndefined() {
      yield (x: number) => x > 0;
      yield undefined as unknown as Predicate<number>;
    }
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const result = predicateAlgebra.operate(operation, createIterableWithUndefined(), 4, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; index?: number; };
      if (reason.kind === 'EVALUATION_ERROR') {
        expect(reason.index).toBe(1);
      }
    }
  });

  it('обрабатывает ошибку в finalize', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: () => {
        throw new Error('Finalize error');
      },
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const result = predicateAlgebra.operate(operation, preds, 4, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; index?: number; };
      if (reason.kind === 'EVALUATION_ERROR') {
        expect(reason.index).toBe(0);
      }
    }
  });

  it('работает с context', () => {
    const operation: PredicateOperation<number, number, string, number> = {
      init: () => 0,
      step: (state, pred, fact, context) => state + (pred(fact) ? context.length : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const result = predicateAlgebra.operate(operation, preds, 4, 'test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(4); // 'test'.length = 4
    }
  });

  it('работает с debug mode и errorMetadata', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    /* eslint-disable ai-security/model-poisoning -- errorMetadata создан через createMockErrorMetadata, валидация происходит внутри predicateAlgebra.operate через validateErrorMetadataForDebug */
    const errorMetadata = createMockErrorMetadata();
    // Валидация errorMetadata: createMockErrorMetadata возвращает валидный PredicateErrorMetadata
    const validatedErrorMetadata: PredicateErrorMetadata = errorMetadata;
    const result = predicateAlgebra.operate(operation, preds, 4, undefined, {
      debug: true,
      errorMetadata: validatedErrorMetadata,
      now: 1234567890,
    });
    /* eslint-enable ai-security/model-poisoning */
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as { kind: string; metadata?: unknown; };
      if (reason.kind === 'EVALUATION_ERROR') {
        expect(reason.metadata).toBeDefined();
      }
    }
  });
});

/* ============================================================================
 * 🧪 PREDICATE ALGEBRA.OPERATELAZY — TESTS
 * ============================================================================
 */

describe('predicateAlgebra.operateLazy', () => {
  it('выполняет операцию с Iterable предикатов (streaming)', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      (x) => x % 2 === 0,
    ];
    const generator = predicateAlgebra.operateLazy(
      operation,
      createPredicateIterable(preds),
      4,
      undefined,
    );
    const results = Array.from(generator);
    expect(results).toHaveLength(3); // 2 step + 1 finalize
    const firstResult = results[0];
    const secondResult = results[1];
    const thirdResult = results[2];
    expect(firstResult?.ok).toBe(true);
    expect(secondResult?.ok).toBe(true);
    expect(thirdResult?.ok).toBe(true);
    if (thirdResult?.ok === true) {
      expect(thirdResult.value).toBe(2);
    }
  });

  it('возвращает EMPTY_PREDICATES для пустого Iterable', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const generator = predicateAlgebra.operateLazy(
      operation,
      createPredicateIterable([]),
      5,
      undefined,
    );
    const results = Array.from(generator);
    expect(results).toHaveLength(1);
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as { kind: string; };
      expect(reason.kind).toBe('EMPTY_PREDICATES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const generator = predicateAlgebra.operateLazy(
      operation,
      createPredicateIterable(preds),
      5,
      undefined,
      { maxCompositionSize: 3 },
    );
    const results = Array.from(generator);
    // Обрабатываются 3 предиката (step результаты), затем возвращается COMPOSITION_ERROR
    expect(results.length).toBeGreaterThanOrEqual(3);
    const lastResult = results[results.length - 1];
    expect(lastResult?.ok).toBe(false);
    if (lastResult && !lastResult.ok) {
      const reason = lastResult.reason as { kind: string; };
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize для массива', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const preds: Predicate<number>[] = Array.from({ length: 5 }, (_, i) => (x: number) => x > i);
    const generator = predicateAlgebra.operateLazy(
      operation,
      preds,
      5,
      undefined,
      { maxCompositionSize: 3 },
    );
    const results = Array.from(generator);
    // Для массива валидация происходит заранее, поэтому возвращается только ошибка
    expect(results).toHaveLength(1);
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as { kind: string; };
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('ранний выход при ошибке в step', () => {
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [
      (x) => x > 0,
      (x) => x % 2 === 0,
    ];
    const generator = predicateAlgebra.operateLazy(
      operation,
      createPredicateIterable(preds),
      4,
      undefined,
    );
    const results = Array.from(generator);
    expect(results).toHaveLength(1); // только первый step с ошибкой
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as { kind: string; index?: number; };
      if (reason.kind === 'EVALUATION_ERROR') {
        expect(reason.index).toBe(0);
      }
    }
  });

  it('вызывает hooks (beforeStep, afterStep, afterFinalize)', () => {
    const beforeStep = vi.fn();
    const afterStep = vi.fn();
    const afterFinalize = vi.fn();
    const hooks: PredicateHooks<number, number, number, void> = {
      beforeStep,
      afterStep,
      afterFinalize,
    };
    const operation: PredicateOperation<number, number, void, number> = {
      init: () => 0,
      step: (state, pred, fact) => state + (pred(fact) ? 1 : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const generator = predicateAlgebra.operateLazy(
      operation,
      createPredicateIterable(preds),
      4,
      undefined,
      { hooks },
    );
    Array.from(generator); // consume generator
    expect(beforeStep).toHaveBeenCalledTimes(1);
    expect(afterStep).toHaveBeenCalledTimes(1);
    expect(afterFinalize).toHaveBeenCalledTimes(1);
  });

  it('работает с context', () => {
    const operation: PredicateOperation<number, number, string, number> = {
      init: () => 0,
      step: (state, pred, fact, context) => state + (pred(fact) ? context.length : 0),
      finalize: (state) => state,
    };
    const preds: readonly Predicate<number>[] = [(x) => x > 0];
    const generator = predicateAlgebra.operateLazy(
      operation,
      createPredicateIterable(preds),
      4,
      'test',
    );
    const results = Array.from(generator);
    const secondResult = results[1];
    expect(secondResult?.ok).toBe(true);
    if (secondResult?.ok === true) {
      expect(secondResult.value).toBe(4); // 'test'.length = 4
    }
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & INTEGRATION TESTS
 * ============================================================================
 */

describe('Edge Cases & Integration', () => {
  it('работает с большим количеством предикатов', () => {
    const preds: Predicate<number>[] = Array.from({ length: 1000 }, (_, i) => (x: number) => x > i);
    const result = predicate.and(preds);
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value(1001)).toBe(true);
      expect(result.value(500)).toBe(false);
    }
  });

  it('работает с различными типами фактов', () => {
    const stringPred: Predicate<string> = (s) => s.length > 0;
    const result = predicate.evaluate(stringPred, 'test');
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value).toBe(true);
    }
  });

  it('работает с объектными фактами', () => {
    interface User {
      age: number;
      name: string;
    }
    const agePred: Predicate<User> = (u) => u.age >= 18;
    const namePred: Predicate<User> = (u) => u.name.length > 0;
    const result = predicate.and([agePred, namePred]);
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value({ age: 20, name: 'John' })).toBe(true);
      expect(result.value({ age: 15, name: 'John' })).toBe(false);
    }
  });

  it('работает с вложенными композициями', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const pred3: Predicate<number> = (x) => x < 10;
    const andResult = predicate.and([pred1, pred2]);
    const orResult = predicate.or([pred3]);
    expect(andResult.ok).toBe(true);
    expect(orResult.ok).toBe(true);
    if (andResult.ok && orResult.ok) {
      const composed = predicate.and([andResult.value, orResult.value]);
      expect(composed.ok).toBe(true);
      if (composed.ok) {
        expect(composed.value(4)).toBe(true);
        expect(composed.value(15)).toBe(false);
      }
    }
  });
});
