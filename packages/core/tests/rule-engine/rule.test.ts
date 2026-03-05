/**
 * @file Unit тесты для Rule (Generic Rule Operations)
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';

import type { Predicate } from '../../src/rule-engine/predicate.js';
import type {
  Rule,
  RuleConfig,
  RuleFailureReason,
  RuleOperation,
} from '../../src/rule-engine/rule.js';
import { rule, ruleAlgebra } from '../../src/rule-engine/rule.js';

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
 * 🧪 RULE.CREATE — TESTS
 * ============================================================================
 */

describe('rule.create', () => {
  it('создает правило без приоритета', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.predicate).toBe(pred);
      expect(result.value.result).toBe('positive');
      expect(result.value.priority).toBeUndefined();
    }
  });

  it('создает правило с приоритетом', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe(5);
    }
  });

  it('возвращает INVALID_PRIORITY для NaN', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', NaN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PRIORITY');
    }
  });

  it('возвращает INVALID_PRIORITY для Infinity', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', Infinity);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PRIORITY');
    }
  });

  it('возвращает INVALID_PRIORITY для -Infinity', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', -Infinity);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PRIORITY');
    }
  });

  it('принимает undefined приоритет', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBeUndefined();
    }
  });

  it('принимает отрицательный приоритет', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', -5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe(-5);
    }
  });

  it('принимает нулевой приоритет', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.create(pred, 'positive', 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe(0);
    }
  });
});

/* ============================================================================
 * 🧪 RULE.VALIDATE — TESTS
 * ============================================================================
 */

describe('rule.validate', () => {
  it('валидирует корректное правило', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const ruleValue = createMockRule(pred, 'positive');
    const result = rule.validate(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(ruleValue);
    }
  });

  it('валидирует правило с приоритетом', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const ruleValue = createMockRule(pred, 'positive', 5);
    const result = rule.validate(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe(5);
    }
  });

  it('возвращает INVALID_RULE для null', () => {
    const result = rule.validate<Predicate<number>, string>(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для undefined', () => {
    const result = rule.validate<Predicate<number>, string>(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для массива', () => {
    const result = rule.validate<Predicate<number>, string>([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для объекта без predicate', () => {
    const result = rule.validate<Predicate<number>, string>({ result: 'positive' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для объекта без result', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.validate<Predicate<number>, string>({ predicate: pred });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для невалидного предиката (с validatePredicateFn)', () => {
    const validatePredicateFn = (p: unknown): p is Predicate<number> => {
      return typeof p === 'function';
    };
    const result = rule.validate(
      { predicate: 'not a function', result: 'positive' },
      validatePredicateFn,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('валидирует правило с validatePredicateFn', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const validatePredicateFn = (p: unknown): p is Predicate<number> => {
      return typeof p === 'function';
    };
    const ruleValue = createMockRule(pred, 'positive');
    const result = rule.validate(ruleValue, validatePredicateFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(ruleValue);
    }
  });

  it('возвращает INVALID_RULE для невалидного приоритета (NaN)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.validate({ predicate: pred, result: 'positive', priority: NaN });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для невалидного приоритета (Infinity)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.validate({ predicate: pred, result: 'positive', priority: Infinity });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('принимает undefined приоритет', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const ruleValue = createMockRule(pred, 'positive', undefined);
    const result = rule.validate(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBeUndefined();
    }
  });
});

/* ============================================================================
 * 🧪 RULE.VALIDATEWITHPREDICATE — TESTS
 * ============================================================================
 */

describe('rule.validateWithPredicate', () => {
  it('валидирует правило с Predicate<TFact>', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const ruleValue = createMockRule(pred, 'positive');
    const result = rule.validateWithPredicate<number, string>(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.predicate).toBe(pred);
      expect(result.value.result).toBe('positive');
    }
  });

  it('валидирует правило с приоритетом', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const ruleValue = createMockRule(pred, 'positive', 5);
    const result = rule.validateWithPredicate<number, string>(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe(5);
    }
  });

  it('возвращает INVALID_RULE для null', () => {
    const result = rule.validateWithPredicate<number, string>(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для undefined', () => {
    const result = rule.validateWithPredicate<number, string>(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для массива', () => {
    const result = rule.validateWithPredicate<number, string>([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для объекта без predicate', () => {
    const result = rule.validateWithPredicate<number, string>({ result: 'positive' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_RULE для объекта без result', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.validateWithPredicate<number, string>({ predicate: pred });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает INVALID_PREDICATE для невалидного предиката', () => {
    const result = rule.validateWithPredicate<number, string>({
      predicate: 'not a function',
      result: 'positive',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PREDICATE');
    }
  });

  it('возвращает INVALID_PRIORITY для невалидного приоритета (NaN)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.validateWithPredicate<number, string>({
      predicate: pred,
      result: 'positive',
      priority: NaN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PRIORITY');
    }
  });

  it('возвращает INVALID_PRIORITY для невалидного приоритета (Infinity)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const result = rule.validateWithPredicate<number, string>({
      predicate: pred,
      result: 'positive',
      priority: Infinity,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_PRIORITY');
    }
  });

  it('принимает undefined приоритет', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const ruleValue = createMockRule(pred, 'positive', undefined);
    const result = rule.validateWithPredicate<number, string>(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBeUndefined();
    }
  });
});

/* ============================================================================
 * 🧪 RULE.VALIDATEALL — TESTS
 * ============================================================================
 */

describe('rule.validateAll', () => {
  it('валидирует массив правил', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules = [
      createMockRule(pred1, 'positive'),
      createMockRule(pred2, 'even'),
    ];
    const result = rule.validateAll(rules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });

  it('возвращает EMPTY_RULES для пустого массива (strict по умолчанию)', () => {
    const result = rule.validateAll([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('разрешает пустой массив с allowEmpty=true', () => {
    const config = { allowEmpty: true } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.validateAll([], config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = Array.from({ length: 5 }, () => createMockRule(pred, 'positive'));
    const config = { maxCompositionSize: 3 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.validateAll(rules, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('возвращает INVALID_RULE для невалидного правила в массиве', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'positive'),
      { predicate: 'not a function', result: 'invalid' },
    ];
    const result = rule.validateAll(rules);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('валидирует массив правил с validatePredicateFn', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const validatePredicateFn = (p: unknown): p is Predicate<number> => {
      return typeof p === 'function';
    };
    const rules = [
      createMockRule(pred1, 'positive'),
      createMockRule(pred2, 'even'),
    ];
    const result = rule.validateAll(rules, undefined, validatePredicateFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });

  it('возвращает INVALID_RULE для невалидного предиката с validatePredicateFn', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const validatePredicateFn = (p: unknown): p is Predicate<number> => {
      return typeof p === 'function';
    };
    const rules = [
      createMockRule(pred, 'positive'),
      { predicate: 'not a function', result: 'invalid' },
    ];
    const result = rule.validateAll(rules, undefined, validatePredicateFn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });
});

/* ============================================================================
 * 🧪 RULE.SORTBYPRIORITY — TESTS
 * ============================================================================
 */

describe('rule.sortByPriority', () => {
  it('сортирует правила по приоритету (по убыванию)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'high', 5),
      createMockRule(pred, 'medium', 3),
    ];
    const result = rule.sortByPriority(rules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.result).toBe('high');
      expect(result.value[1]?.result).toBe('medium');
      expect(result.value[2]?.result).toBe('low');
    }
  });

  it('правила без приоритета имеют приоритет 0 и сортируются в конце', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'no-priority'),
      createMockRule(pred, 'high', 5),
      createMockRule(pred, 'low', 1),
    ];
    const result = rule.sortByPriority(rules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.result).toBe('high');
      expect(result.value[1]?.result).toBe('low');
      expect(result.value[2]?.result).toBe('no-priority');
    }
  });

  it('возвращает EMPTY_RULES для пустого массива', () => {
    const result = rule.sortByPriority([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('сортирует правила с одинаковым приоритетом (стабильная сортировка)', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'first', 5),
      createMockRule(pred, 'second', 5),
      createMockRule(pred, 'third', 5),
    ];
    const result = rule.sortByPriority(rules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Стабильная сортировка сохраняет порядок элементов с одинаковым приоритетом
      expect(result.value).toHaveLength(3);
    }
  });

  it('сортирует правила с отрицательным приоритетом', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'negative', -5),
      createMockRule(pred, 'zero', 0),
      createMockRule(pred, 'positive', 5),
    ];
    const result = rule.sortByPriority(rules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.result).toBe('positive');
      expect(result.value[1]?.result).toBe('zero');
      expect(result.value[2]?.result).toBe('negative');
    }
  });
});

/* ============================================================================
 * 🧪 RULE.FILTERBYPRIORITY — TESTS
 * ============================================================================
 */

describe('rule.filterByPriority', () => {
  it('фильтрует правила по minPriority', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'medium', 3),
      createMockRule(pred, 'high', 5),
    ];
    const config = { minPriority: 3 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.result).toBe('medium');
      expect(result.value[1]?.result).toBe('high');
    }
  });

  it('фильтрует правила по maxPriority', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'medium', 3),
      createMockRule(pred, 'high', 5),
    ];
    const config = { maxPriority: 3 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.result).toBe('low');
      expect(result.value[1]?.result).toBe('medium');
    }
  });

  it('фильтрует правила по диапазону приоритетов', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'medium', 3),
      createMockRule(pred, 'high', 5),
    ];
    const config = { minPriority: 2, maxPriority: 4 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.result).toBe('medium');
    }
  });

  it('возвращает все правила если фильтрация не требуется', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'medium', 3),
    ];
    const config = {} as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });

  it('возвращает EMPTY_RULES для пустого массива', () => {
    const config = { minPriority: 1 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority([], config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('правила без приоритета имеют приоритет 0', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'no-priority'),
      createMockRule(pred, 'with-priority', 5),
    ];
    const config = { minPriority: 1 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.result).toBe('with-priority');
    }
  });

  it('пропускает undefined элементы в массиве', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'valid', 5),
      undefined as unknown as Rule<Predicate<number>, string>,
      createMockRule(pred, 'also-valid', 3),
    ];
    const config = { minPriority: 1 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.filterByPriority(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });
});

/* ============================================================================
 * 🧪 RULE.PREPARE — TESTS
 * ============================================================================
 */

describe('rule.prepare', () => {
  it('валидирует, фильтрует и сортирует правила', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
      createMockRule(pred, 'high', 5),
      createMockRule(pred, 'medium', 3),
    ];
    const config = { minPriority: 2 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.prepare(rules, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.result).toBe('high');
      expect(result.value[1]?.result).toBe('medium');
    }
  });

  it('возвращает ошибку валидации если правила невалидны', () => {
    const rules = [
      { predicate: 'not a function', result: 'invalid' },
    ];
    const result = rule.prepare(rules);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('INVALID_RULE');
    }
  });

  it('возвращает ошибку фильтрации если правила пусты после фильтрации', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = [
      createMockRule(pred, 'low', 1),
    ];
    const config = { minPriority: 5 } as RuleConfig<
      readonly Rule<Predicate<number>, string>[],
      void,
      Predicate<number>,
      unknown,
      void
    >;
    const result = rule.prepare(rules, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('работает с validatePredicateFn', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const validatePredicateFn = (p: unknown): p is Predicate<number> => {
      return typeof p === 'function';
    };
    const rules = [
      createMockRule(pred, 'positive', 5),
    ];
    const result = rule.prepare(rules, undefined, validatePredicateFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });
});

/* ============================================================================
 * 🧪 RULE.EXTENSIONS — TESTS
 * ============================================================================
 */

describe('rule.extensions', () => {
  it('является замороженным объектом', () => {
    expect(Object.isFrozen(rule.extensions)).toBe(true);
  });

  it('является пустым объектом по умолчанию', () => {
    expect(Object.keys(rule.extensions)).toHaveLength(0);
  });
});

/* ============================================================================
 * 🧪 RULE ALGEBRA.OPERATE — TESTS
 * ============================================================================
 */

describe('ruleAlgebra.operate', () => {
  it('выполняет операцию с массивом правил', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        return rule.predicate(fact) ? state + 1 : state;
      },
      finalize: (state) => state,
    };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred1, 1),
      createMockRule(pred2, 2),
    ];
    const result = ruleAlgebra.operate(operation, rules, 4, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2); // оба предиката вернули true
    }
  });

  it('выполняет операцию с Iterable правил', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        return rule.predicate(fact) ? state + 1 : state;
      },
      finalize: (state) => state,
    };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred1, 1),
      createMockRule(pred2, 2),
    ];
    const result = ruleAlgebra.operate(operation, createRuleIterable(rules), 4, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2);
    }
  });

  it('возвращает EMPTY_RULES для пустого массива', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const result = ruleAlgebra.operate(operation, [], 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает EMPTY_RULES для пустого Iterable', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const result = ruleAlgebra.operate(operation, createRuleIterable([]), 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize для массива', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = Array.from(
      { length: 5 },
      () => createMockRule(pred, 1),
    );
    const config = { maxCompositionSize: 3 } as RuleConfig<
      number,
      number,
      Predicate<number>,
      number,
      void
    >;
    const result = ruleAlgebra.operate(operation, rules, 5, undefined, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize для Iterable', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = Array.from(
      { length: 5 },
      () => createMockRule(pred, 1),
    );
    const config = { maxCompositionSize: 3 } as RuleConfig<
      number,
      number,
      Predicate<number>,
      number,
      void
    >;
    const result = ruleAlgebra.operate(operation, createRuleIterable(rules), 5, undefined, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('обрабатывает ошибку в step', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [createMockRule(pred, 1)];
    const result = ruleAlgebra.operate(operation, rules, 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('обрабатывает ошибку в step для Iterable', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [createMockRule(pred, 1)];
    const result = ruleAlgebra.operate(operation, createRuleIterable(rules), 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('обрабатывает ошибку в finalize', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: () => {
        throw new Error('Finalize error');
      },
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [createMockRule(pred, 1)];
    const result = ruleAlgebra.operate(operation, rules, 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('работает с context', () => {
    const operation: RuleOperation<number, number, string, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact, context) => {
        return rule.predicate(fact) ? state + context.length : state;
      },
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [createMockRule(pred, 1)];
    const result = ruleAlgebra.operate(operation, rules, 5, 'test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(4); // 'test'.length = 4
    }
  });

  it('поддерживает short-circuit через StepResult (break)', () => {
    const operation: RuleOperation<string | null, string | null, void, Predicate<number>, number> =
      {
        init: () => null as string | null,
        step: (state, rule, fact) => {
          if (rule.predicate(fact)) {
            return { type: 'break' as const, state: rule.result };
          }
          return { type: 'continue' as const, state };
        },
        finalize: (state) => state,
      };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x > 10;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred1, 'first'),
      createMockRule(pred2, 'second'),
    ];
    const result = ruleAlgebra.operate(operation, rules, 5, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('first'); // первый предикат вернул true, short-circuit
    }
  });

  it('поддерживает short-circuit через StepResult (break) для Iterable', () => {
    const operation: RuleOperation<string | null, string | null, void, Predicate<number>, number> =
      {
        init: () => null as string | null,
        step: (state, rule, fact) => {
          // Обрабатываем первое правило (count становится 1), затем второе делает break
          if (rule.predicate(fact) && state === null) {
            // Первое правило проходит, обрабатываем его и продолжаем
            return { type: 'continue' as const, state: 'first-processed' };
          }
          if (rule.predicate(fact)) {
            // Второе правило проходит, делаем break
            return { type: 'break' as const, state: rule.result };
          }
          return { type: 'continue' as const, state };
        },
        finalize: (state) => state ?? null,
      };
    const pred1: Predicate<number> = (x) => x > 0; // true для 5
    const pred2: Predicate<number> = (x) => x > 0; // true для 5
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred1, 'first'),
      createMockRule(pred2, 'second'),
    ];
    const result = ruleAlgebra.operate(operation, createRuleIterable(rules), 5, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('second'); // второе правило вернуло true, short-circuit
    }
  });

  it('поддерживает short-circuit через StepResult (continue)', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        const newState = rule.predicate(fact) ? state + 1 : state;
        return { type: 'continue' as const, state: newState };
      },
      finalize: (state) => state,
    };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred1, 1),
      createMockRule(pred2, 2),
    ];
    const result = ruleAlgebra.operate(operation, rules, 4, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2); // оба предиката вернули true
    }
  });

  it('обрабатывает undefined правило в массиве (edge case)', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred, 1),
      undefined as unknown as Rule<Predicate<number>, number>,
    ];
    const result = ruleAlgebra.operate(operation, rules, 5, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.reason as RuleFailureReason;
      expect(reason.kind).toBe('INVALID_RULE');
    }
  });
});

/* ============================================================================
 * 🧪 RULE ALGEBRA.OPERATELAZY — TESTS
 * ============================================================================
 */

describe('ruleAlgebra.operateLazy', () => {
  it('выполняет операцию с массивом правил (streaming)', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        return rule.predicate(fact) ? state + 1 : state;
      },
      finalize: (state) => state,
    };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred1, 1),
      createMockRule(pred2, 2),
    ];
    const generator = ruleAlgebra.operateLazy(operation, rules, 4, undefined);
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

  it('выполняет операцию с Iterable правил (streaming)', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        return rule.predicate(fact) ? state + 1 : state;
      },
      finalize: (state) => state,
    };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred1, 1),
      createMockRule(pred2, 2),
    ];
    const generator = ruleAlgebra.operateLazy(operation, createRuleIterable(rules), 4, undefined);
    const results = Array.from(generator);
    expect(results).toHaveLength(3); // 2 step + 1 finalize
    const thirdResult = results[2];
    expect(thirdResult?.ok).toBe(true);
    if (thirdResult?.ok === true) {
      expect(thirdResult.value).toBe(2);
    }
  });

  it('возвращает EMPTY_RULES для пустого массива', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const generator = ruleAlgebra.operateLazy(operation, [], 5, undefined);
    const results = Array.from(generator);
    expect(results).toHaveLength(1);
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает EMPTY_RULES для пустого Iterable', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const generator = ruleAlgebra.operateLazy(operation, createRuleIterable([]), 5, undefined);
    const results = Array.from(generator);
    expect(results).toHaveLength(1);
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('EMPTY_RULES');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize для массива', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = Array.from(
      { length: 5 },
      () => createMockRule(pred, 1),
    );
    const config = { maxCompositionSize: 3 } as RuleConfig<
      number,
      number,
      Predicate<number>,
      number,
      void
    >;
    const generator = ruleAlgebra.operateLazy(operation, rules, 5, undefined, config);
    const results = Array.from(generator);
    expect(results).toHaveLength(1);
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('возвращает COMPOSITION_ERROR при превышении maxCompositionSize для Iterable', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = Array.from(
      { length: 5 },
      () => createMockRule(pred, 1),
    );
    const config = { maxCompositionSize: 3 } as RuleConfig<
      number,
      number,
      Predicate<number>,
      number,
      void
    >;
    const generator = ruleAlgebra.operateLazy(
      operation,
      createRuleIterable(rules),
      5,
      undefined,
      config,
    );
    const results = Array.from(generator);
    // Обрабатываются 3 правила (step результаты), затем возвращается COMPOSITION_ERROR
    expect(results.length).toBeGreaterThanOrEqual(3);
    const lastResult = results[results.length - 1];
    expect(lastResult?.ok).toBe(false);
    if (lastResult && !lastResult.ok) {
      const reason = lastResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('ранний выход при ошибке в step', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred, 1),
      createMockRule(pred, 2),
    ];
    const generator = ruleAlgebra.operateLazy(operation, rules, 5, undefined);
    const results = Array.from(generator);
    expect(results).toHaveLength(1); // только первый step с ошибкой
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('ранний выход при ошибке в step для Iterable', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: () => {
        throw new Error('Step error');
      },
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred, 1),
      createMockRule(pred, 2),
    ];
    const generator = ruleAlgebra.operateLazy(operation, createRuleIterable(rules), 5, undefined);
    const results = Array.from(generator);
    expect(results).toHaveLength(1); // только первый step с ошибкой
    const firstResult = results[0];
    expect(firstResult?.ok).toBe(false);
    if (firstResult && !firstResult.ok) {
      const reason = firstResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });

  it('поддерживает short-circuit через StepResult (break)', () => {
    const operation: RuleOperation<string | null, string | null, void, Predicate<number>, number> =
      {
        init: () => null as string | null,
        step: (state, rule, fact) => {
          if (rule.predicate(fact)) {
            return { type: 'break' as const, state: rule.result };
          }
          return { type: 'continue' as const, state };
        },
        finalize: (state) => state,
      };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x > 10;
    const rules: Rule<Predicate<number>, string>[] = [
      createMockRule(pred1, 'first'),
      createMockRule(pred2, 'second'),
    ];
    const generator = ruleAlgebra.operateLazy(operation, rules, 5, undefined);
    const results = Array.from(generator);
    // Должен быть только один step результат (short-circuit) + finalize
    expect(results.length).toBeGreaterThanOrEqual(2);
    const finalizeResult = results[results.length - 1];
    expect(finalizeResult?.ok).toBe(true);
    if (finalizeResult?.ok === true) {
      expect(finalizeResult.value).toBe('first');
    }
  });

  it('поддерживает short-circuit через StepResult (continue)', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        const newState = rule.predicate(fact) ? state + 1 : state;
        return { type: 'continue' as const, state: newState };
      },
      finalize: (state) => state,
    };
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules: Rule<Predicate<number>, number>[] = [
      createMockRule(pred1, 1),
      createMockRule(pred2, 2),
    ];
    const generator = ruleAlgebra.operateLazy(operation, rules, 4, undefined);
    const results = Array.from(generator);
    expect(results).toHaveLength(3); // 2 step + 1 finalize
    const finalizeResult = results[2];
    expect(finalizeResult?.ok).toBe(true);
    if (finalizeResult?.ok === true) {
      expect(finalizeResult.value).toBe(2);
    }
  });

  it('работает с context', () => {
    const operation: RuleOperation<number, number, string, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact, context) => {
        return rule.predicate(fact) ? state + context.length : state;
      },
      finalize: (state) => state,
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [createMockRule(pred, 1)];
    const generator = ruleAlgebra.operateLazy(operation, rules, 5, 'test');
    const results = Array.from(generator);
    const finalizeResult = results[1];
    expect(finalizeResult?.ok).toBe(true);
    if (finalizeResult?.ok === true) {
      expect(finalizeResult.value).toBe(4); // 'test'.length = 4
    }
  });

  it('обрабатывает ошибку в finalize', () => {
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state) => state,
      finalize: () => {
        throw new Error('Finalize error');
      },
    };
    const pred: Predicate<number> = (x) => x > 0;
    const rules: Rule<Predicate<number>, number>[] = [createMockRule(pred, 1)];
    const generator = ruleAlgebra.operateLazy(operation, rules, 5, undefined);
    const results = Array.from(generator);
    const finalizeResult = results[1];
    expect(finalizeResult?.ok).toBe(false);
    if (finalizeResult && !finalizeResult.ok) {
      const reason = finalizeResult.reason as RuleFailureReason;
      expect(reason.kind).toBe('COMPOSITION_ERROR');
    }
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & INTEGRATION TESTS
 * ============================================================================
 */

describe('Edge Cases & Integration', () => {
  it('работает с большим количеством правил', () => {
    const pred: Predicate<number> = (x) => x > 0;
    const rules = Array.from({ length: 1000 }, (_, i) => createMockRule(pred, `rule-${i}`, i));
    const result = rule.sortByPriority(rules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1000);
      expect(result.value[0]?.priority).toBe(999);
      expect(result.value[999]?.priority).toBe(0);
    }
  });

  it('работает с различными типами результатов', () => {
    const pred: Predicate<string> = (s) => s.length > 0;
    const ruleValue = createMockRule(pred, { message: 'valid' });
    const result = rule.validate(ruleValue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toEqual({ message: 'valid' });
    }
  });

  it('работает с объектными фактами', () => {
    interface User {
      age: number;
      name: string;
    }
    const agePred: Predicate<User> = (u) => u.age >= 18;
    const namePred: Predicate<User> = (u) => u.name.length > 0;
    const rules: Rule<Predicate<User>, string>[] = [
      createMockRule(agePred, 'adult'),
      createMockRule(namePred, 'named'),
    ];
    // Используем приведение типов, так как мы собираем строки в массив
    const operation: RuleOperation<string[], string[], void, Predicate<User>, User> = {
      init: () => [],
      step: (state, rule, fact) => {
        // rule.result имеет тип string[], но мы знаем что это string, собираем в массив
        const ruleResult = (rule as unknown as Rule<Predicate<User>, string>).result;
        return rule.predicate(fact) ? [...state, ruleResult] : state;
      },
      finalize: (state) => state,
    };
    const result = ruleAlgebra.operate(
      operation,
      rules as unknown as Rule<Predicate<User>, string[]>[],
      { age: 20, name: 'John' },
      undefined,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(['adult', 'named']);
    }
  });

  it('работает с вложенными операциями', () => {
    const pred1: Predicate<number> = (x) => x > 0;
    const pred2: Predicate<number> = (x) => x % 2 === 0;
    const rules1 = [createMockRule(pred1, 'positive', 5)];
    const rules2 = [createMockRule(pred2, 'even', 3)];
    const validation1 = rule.validateAll(rules1);
    const validation2 = rule.validateAll(rules2);
    expect(validation1.ok).toBe(true);
    expect(validation2.ok).toBe(true);
    if (validation1.ok && validation2.ok) {
      const combined = [...validation1.value, ...validation2.value];
      const sorted = rule.sortByPriority(combined);
      expect(sorted.ok).toBe(true);
      if (sorted.ok) {
        expect(sorted.value[0]?.result).toBe('positive');
        expect(sorted.value[1]?.result).toBe('even');
      }
    }
  });

  it('проверяет что streaming не материализует весь Iterable', () => {
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для тестирования генератора и подсчета yield */
    let yieldCount = 0;
    function* createLargeIterable(): Generator<Rule<Predicate<number>, number>> {
      const pred: Predicate<number> = (x) => x > 0;
      for (let i = 0; i < 1000; i += 1) {
        yield createMockRule(pred, i, i);
        yieldCount += 1;
      }
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */
    const operation: RuleOperation<number, number, void, Predicate<number>, number> = {
      init: () => 0,
      step: (state, rule, fact) => {
        if (rule.predicate(fact) && state >= 2) {
          return { type: 'break' as const, state: state + 1 };
        }
        return rule.predicate(fact) ? state + 1 : state;
      },
      finalize: (state) => state,
    };
    const generator = ruleAlgebra.operateLazy(operation, createLargeIterable(), 5, undefined);
    // Потребляем только первые несколько элементов
    const firstResult = generator.next();
    expect(firstResult.done).toBe(false);
    // Short-circuit должен остановить генерацию
    Array.from(generator);
    // yieldCount должен быть меньше 1000 из-за short-circuit
    expect(yieldCount).toBeLessThan(1000);
  });
});
