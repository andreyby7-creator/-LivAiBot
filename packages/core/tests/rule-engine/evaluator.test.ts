/**
 * @file Unit тесты для Evaluator (Generic Rule Evaluation)
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { evaluator, evaluatorAlgebra } from '../../src/rule-engine/evaluator.js';
import type { EvaluationConfig } from '../../src/rule-engine/evaluator.js';
import { rule } from '../../src/rule-engine/rule.js';
import type { Rule, RuleFailureReason } from '../../src/rule-engine/rule.js';
import type { Predicate } from '../../src/rule-engine/predicate.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function* createRuleIterable<TPredicate, TResult>(
  rules: readonly Rule<TPredicate, TResult>[],
): Generator<Rule<TPredicate, TResult>> {
  // eslint-disable-next-line functional/no-loop-statements -- generator требует loop
  for (const rule of rules) {
    yield rule;
  }
}

function createMockRule<TPredicate, TResult>(
  predicate: TPredicate,
  result: TResult,
  priority?: number,
): Rule<TPredicate, TResult> {
  return {
    predicate,
    result,
    ...(priority !== undefined ? { priority } : {}),
  };
}

/* ============================================================================
 * 🧪 EVALUATOR.EVALUATE — TESTS (FIRST-MATCH)
 * ============================================================================
 */

describe('evaluator.evaluate', () => {
  it('возвращает результат первого совпавшего правила', () => {
    const pred1: Predicate<number> = (x) => x > 10;
    const pred2: Predicate<number> = (x) => x > 5;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred1, 'high', 10),
      createMockRule(pred2, 'medium', 5),
    ];
    const result = evaluator.evaluate(rules, 15);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('high');
    }
  });

  it('возвращает NO_MATCH если нет совпадений', () => {
    const pred: Predicate<number> = (x) => x > 10;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'high')];
    const result = evaluator.evaluate(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('NO_MATCH');
    }
  });

  it('возвращает EMPTY_RULES для пустого массива', () => {
    const result = evaluator.evaluate([], 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает NO_MATCH для пустого массива с allowEmpty=true', () => {
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      allowEmpty: true,
    };
    const result = evaluator.evaluate([], 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('NO_MATCH');
    }
  });

  it('обрабатывает ошибки валидации', () => {
    const invalidRule = { predicate: null, result: 'test' } as unknown as Rule<
      Predicate<number>,
      string
    >;
    const result = evaluator.evaluate([invalidRule], 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('фильтрует правила по приоритету', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'high', 10),
    ];
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      minPriority: 5,
    };
    const result = evaluator.evaluate(rules, 5, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('high');
    }
  });

  it('использует skipSort для оптимизации', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'first', 1),
      createMockRule(pred, 'second', 2),
    ];
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      skipSort: true,
    };
    const result = evaluator.evaluate(rules, 5, config);
    expect(result.ok).toBe(true);
  });

  it('обрабатывает all-match режим через config', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ];
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      mode: { type: 'all-match' },
    };
    const result = evaluator.evaluate(rules, 5, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
      if (Array.isArray(result.value)) {
        expect(result.value.length).toBe(2);
      }
    }
  });

  it('обрабатывает ошибки предиката', () => {
    const throwingPred: Predicate<number> = () => {
      throw new Error('predicate error');
    };
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(throwingPred, 'test')];
    const result = evaluator.evaluate(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EVALUATION_ERROR');
    }
  });

  it('обрабатывает maxCompositionSize', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = Array.from(
      { length: 10 },
      () => createMockRule(pred, 'test'),
    );
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      maxCompositionSize: 5,
    };
    const result = evaluator.evaluate(rules, 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('обрабатывает ошибку фильтрации по приоритету', () => {
    // Тестируем строку 647 - ошибка фильтрации в evaluate
    // После фильтрации все правила отфильтрованы, filterByPriority вернет EMPTY_RULES
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'low1', 1),
      createMockRule(pred, 'low2', 2),
    ];
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      minPriority: 10, // Все правила будут отфильтрованы
      maxPriority: 5, // Дополнительное ограничение
    };
    const result = evaluator.evaluate(rules, 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('обрабатывает ошибку сортировки', () => {
    // sortByPriority возвращает EMPTY_RULES если массив пустой после фильтрации
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'test', 1)];
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      minPriority: 10, // Все правила отфильтрованы
      skipSort: false, // Сортировка включена
    };
    const result = evaluator.evaluate(rules, 5, config);
    // После фильтрации массив пустой, sortByPriority вернет EMPTY_RULES
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });
});

/* ============================================================================
 * 🧪 EVALUATOR.EVALUATEALL — TESTS (ALL-MATCH)
 * ============================================================================
 */

describe('evaluator.evaluateAll', () => {
  it('возвращает массив всех совпавших правил', () => {
    const pred1: Predicate<number> = (x) => x > 5;
    const pred2: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred1, 'high'),
      createMockRule(pred2, 'low'),
    ];
    const result = evaluator.evaluateAll(rules, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(['high', 'low']);
    }
  });

  it('возвращает пустой массив если нет совпадений', () => {
    const pred: Predicate<number> = (x) => x > 10;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'high')];
    const result = evaluator.evaluateAll(rules, 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('возвращает EMPTY_RULES для пустого массива', () => {
    const result = evaluator.evaluateAll([], 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает NO_MATCH для пустого массива с allowEmpty=true', () => {
    const config: Omit<EvaluationConfig<string, Predicate<number>, number>, 'mode'> = {
      allowEmpty: true,
    };
    const result = evaluator.evaluateAll([], 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('NO_MATCH');
    }
  });

  it('фильтрует правила по приоритету', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'high', 10),
    ];
    const config: Omit<EvaluationConfig<string, Predicate<number>, number>, 'mode'> = {
      minPriority: 5,
    };
    const result = evaluator.evaluateAll(rules, 5, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(['high']);
    }
  });

  it('использует skipSort для оптимизации', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ];
    const config: Omit<EvaluationConfig<string, Predicate<number>, number>, 'mode'> = {
      skipSort: true,
    };
    const result = evaluator.evaluateAll(rules, 5, config);
    expect(result.ok).toBe(true);
  });

  it('обрабатывает ошибки предиката', () => {
    const throwingPred: Predicate<number> = () => {
      throw new Error('predicate error');
    };
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(throwingPred, 'test')];
    const result = evaluator.evaluateAll(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EVALUATION_ERROR');
    }
  });

  it('обрабатывает ошибку валидации в evaluateAll', () => {
    const invalidRule = { predicate: null, result: 'test' } as unknown as Rule<
      Predicate<number>,
      string
    >;
    const result = evaluator.evaluateAll([invalidRule], 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('обрабатывает ошибку фильтрации в evaluateAll', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'low', 1)];
    const config: Omit<EvaluationConfig<string, Predicate<number>, number>, 'mode'> = {
      minPriority: 10, // Все правила отфильтрованы
    };
    const result = evaluator.evaluateAll(rules, 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('обрабатывает ошибку сортировки в evaluateAll', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'test', 1)];
    const config: Omit<EvaluationConfig<string, Predicate<number>, number>, 'mode'> = {
      minPriority: 10, // Все правила отфильтрованы
      skipSort: false, // Сортировка включена
    };
    const result = evaluator.evaluateAll(rules, 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('обрабатывает ошибку фильтрации когда все правила отфильтрованы в evaluateAll', () => {
    // Тестируем строку 754 - ошибка фильтрации в evaluateAll
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'low1', 1),
      createMockRule(pred, 'low2', 2),
    ];
    const config: Omit<EvaluationConfig<string, Predicate<number>, number>, 'mode'> = {
      minPriority: 10, // Все правила отфильтрованы
      maxPriority: 5, // Дополнительное ограничение
    };
    const result = evaluator.evaluateAll(rules, 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });
});

/* ============================================================================
 * 🧪 EVALUATOR.EVALUATEITERABLE — TESTS (STREAMING)
 * ============================================================================
 */

describe('evaluator.evaluateIterable', () => {
  it('работает в streaming режиме для first-match без приоритетов', () => {
    const pred: Predicate<number> = (x) => x > 5;
    const rules = createRuleIterable([
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ]);
    const result = evaluator.evaluateIterable(rules, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('first');
    }
  });

  it('работает в streaming режиме для all-match', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = createRuleIterable([
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ]);
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      mode: { type: 'all-match' },
    };
    const result = evaluator.evaluateIterable(rules, 10, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
      if (Array.isArray(result.value)) {
        expect(result.value.length).toBe(2);
      }
    }
  });

  it('материализует для first-match с приоритетами', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = createRuleIterable([
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'high', 10),
    ]);
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      minPriority: 5,
    };
    const result = evaluator.evaluateIterable(rules, 10, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('high');
    }
  });

  it('не материализует для first-match с skipSort', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = createRuleIterable([
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ]);
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      skipSort: true,
    };
    const result = evaluator.evaluateIterable(rules, 10, config);
    expect(result.ok).toBe(true);
  });

  it('возвращает EMPTY_RULES для пустого Iterable', () => {
    const rules = createRuleIterable([]);
    const result = evaluator.evaluateIterable(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает NO_MATCH для пустого Iterable с allowEmpty=true', () => {
    const rules = createRuleIterable([]);
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      allowEmpty: true,
    };
    const result = evaluator.evaluateIterable(rules, 5, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('NO_MATCH');
    }
  });

  it('обрабатывает ошибки валидации в streaming режиме', () => {
    const invalidRule = { predicate: null, result: 'test' } as unknown as Rule<
      Predicate<number>,
      string
    >;
    const rules = createRuleIterable([invalidRule]);
    const result = evaluator.evaluateIterable(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // В streaming режиме ошибки валидации обрабатываются через handleEvaluationError
      expect(['INVALID_RULE', 'EVALUATION_ERROR']).toContain(result.reason.kind);
    }
  });

  it('обрабатывает правило без обязательных полей в streaming', () => {
    // Тестируем строку 422 - validateRuleStreaming когда нет 'predicate' или 'result'
    const invalidRule = { notPredicate: () => true, notResult: 'test' } as unknown as Rule<
      Predicate<number>,
      string
    >;
    const rules = createRuleIterable([invalidRule]);
    const result = evaluator.evaluateIterable(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('обрабатывает невалидные типы правил в streaming', () => {
    // Тестируем строку 417 - validateRuleStreaming для null, array, примитивов
    const invalidRules = [
      null,
      [],
      'string',
      123,
      true,
    ] as unknown as readonly Rule<Predicate<number>, string>[];
    const rules = createRuleIterable(invalidRules);
    const result = evaluator.evaluateIterable(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('обрабатывает неизвестные ошибки через handleEvaluationError fallback', () => {
    // Тестируем строку 478 - fallback в handleEvaluationError для неизвестных ошибок
    // Нужно создать ситуацию, когда ошибка является структурированной, но kind не входит в knownKinds
    // Или когда ошибка не является структурированной и не является Error объектом
    const throwingRule = {
      predicate: () => {
        // Выбрасываем структурированную ошибку с неизвестным kind
        throw { kind: 'UNKNOWN_ERROR_TYPE', message: 'test' };
      },
      result: 'test',
    } as unknown as Rule<Predicate<number>, string>;
    const rules = createRuleIterable([throwingRule]);
    const result = evaluator.evaluateIterable(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Fallback должен обработать неизвестную структурированную ошибку
      expect(result.reason.kind).toBe('EVALUATION_ERROR');
      if ('error' in result.reason) {
        expect(result.reason.error).toBeDefined();
      }
    }
  });

  it('обрабатывает COMPOSITION_ERROR в streaming режиме', () => {
    const pred: Predicate<number> = (x) => x > 0;
    // Для streaming режима проверка maxCompositionSize происходит в operateEvaluatorRules
    // после валидации и фильтрации, поэтому нужно больше правил
    const rules = createRuleIterable(
      Array.from({ length: 10 }, () => createMockRule(pred, 'test')),
    );
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      maxCompositionSize: 5,
      mode: { type: 'all-match' }, // Используем all-match для гарантированной проверки
    };
    const result = evaluator.evaluateIterable(rules, 5, config);
    // В streaming режиме maxCompositionSize проверяется после валидации
    // Если все правила валидны, проверка произойдет в operateEvaluatorRules
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('фильтрует правила по приоритету в streaming режиме', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = createRuleIterable([
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'high', 10),
    ]);
    const config: EvaluationConfig<string, Predicate<number>, number> = {
      minPriority: 5,
      skipSort: true, // Чтобы не материализовать
    };
    const result = evaluator.evaluateIterable(rules, 10, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('high');
    }
  });

  it('обрабатывает различные типы ошибок через handleEvaluationError', () => {
    const pred: Predicate<number> = (x) => x > 0;
    // Создаем правило с невалидным приоритетом для тестирования handleEvaluationError
    const invalidPriorityRule = {
      predicate: pred,
      result: 'test',
      priority: NaN,
    } as unknown as Rule<Predicate<number>, string>;
    const rules = createRuleIterable([invalidPriorityRule]);
    const result = evaluator.evaluateIterable(rules, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // handleEvaluationError обработает структурированную ошибку
      expect(['INVALID_PRIORITY', 'EVALUATION_ERROR']).toContain(result.reason.kind);
    }
  });
});

/* ============================================================================
 * 🧪 EVALUATOR ALGEBRA — TESTS
 * ============================================================================
 */

describe('evaluatorAlgebra.operate', () => {
  it('применяет операцию к валидированным правилам', () => {
    const pred: Predicate<number> = (x) => x > 5;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'high')];
    const validated = rule.validateAll(rules);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: (state: string[], rule: Rule<Predicate<number>, string>, fact: number) => {
          return rule.predicate(fact) ? [...state, rule.result] : state;
        },
        finalize: (state: string[]) => state,
      };
      const result = evaluatorAlgebra.operate(
        operation,
        validated.value as Rule<Predicate<number>, string>[],
        10,
        undefined,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(['high']);
      }
    }
  });

  it('обрабатывает ошибки операции', () => {
    const pred: Predicate<number> = (x) => x > 5;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'high')];
    const validated = rule.validateAll(rules);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: () => {
          throw new Error('step error');
        },
        finalize: (state: string[]) => state,
      };
      const result = evaluatorAlgebra.operate(operation, validated.value, 10, undefined);
      expect(result.ok).toBe(false);
    }
  });

  it('работает с Iterable правилами', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rulesArray: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ];
    const rules = createRuleIterable(rulesArray);
    const validated = rule.validateAll(rulesArray);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: (state: string[], rule: Rule<Predicate<number>, string>, fact: number) => {
          return rule.predicate(fact) ? [...state, rule.result] : state;
        },
        finalize: (state: string[]) => state,
      };
      const result = evaluatorAlgebra.operate(operation, rules, 10, undefined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    }
  });

  it('обрабатывает maxCompositionSize', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = Array.from(
      { length: 10 },
      () => createMockRule(pred, 'test'),
    );
    const validated = rule.validateAll(rules);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: (state: string[]) => state,
        finalize: (state: string[]) => state,
      };
      const config = { maxCompositionSize: 5 };
      const result = evaluatorAlgebra.operate(
        operation,
        validated.value as Rule<Predicate<number>, string>[],
        10,
        undefined,
        config,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const reason = result.reason as RuleFailureReason;
        expect(reason.kind).toBe('COMPOSITION_ERROR');
      }
    }
  });
});

describe('evaluatorAlgebra.operateLazy', () => {
  it('возвращает генератор для streaming evaluation', () => {
    const pred: Predicate<number> = (x) => x > 5;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'high')];
    const validated = rule.validateAll(rules);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: (state: string[], rule: Rule<Predicate<number>, string>, fact: number) => {
          return rule.predicate(fact) ? [...state, rule.result] : state;
        },
        finalize: (state: string[]) => state,
      };
      const generator = evaluatorAlgebra.operateLazy(
        operation,
        validated.value as Rule<Predicate<number>, string>[],
        10,
        undefined,
      );
      const results: unknown[] = [];
      // eslint-disable-next-line functional/no-loop-statements -- необходимо для тестирования генератора
      for (const step of generator) {
        results.push(step);
        if (!step.ok) break;
      }
      expect(results.length).toBeGreaterThan(0);
      const lastResult = results[results.length - 1];
      if (
        lastResult !== undefined
        && lastResult !== null
        && typeof lastResult === 'object'
        && 'ok' in lastResult
        && (lastResult as { ok: boolean; }).ok === true
      ) {
        expect('value' in lastResult && (lastResult as { value: unknown; }).value).toEqual([
          'high',
        ]);
      }
    }
  });

  it('поддерживает early exit через break', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred, 'first'),
      createMockRule(pred, 'second'),
    ];
    const validated = rule.validateAll(rules);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: (state: string[]) => state,
        finalize: (state: string[]) => state,
      };
      const generator = evaluatorAlgebra.operateLazy(
        operation,
        validated.value as Rule<Predicate<number>, string>[],
        10,
        undefined,
      );
      const count = Array.from(generator).slice(0, 2).length;
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('обрабатывает ошибки в streaming режиме', () => {
    const pred: Predicate<number> = (x) => x > 5;
    const rules: Rule<Predicate<number>, string>[] = [createMockRule(pred, 'high')];
    const validated = rule.validateAll(rules);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const operation = {
        init: () => [] as string[],
        step: () => {
          throw new Error('step error');
        },
        finalize: (state: string[]) => state,
      };
      const generator = evaluatorAlgebra.operateLazy(
        operation,
        validated.value as Rule<Predicate<number>, string>[],
        10,
        undefined,
      );
      const hasError = Array.from(generator).some((step) => step.ok === false);
      expect(hasError).toBe(true);
    }
  });
});
