/**
 * @file packages/core/src/rule-engine/rule.ts
 * ============================================================================
 * 🛡️ CORE — Rule Engine (Rule)
 * ============================================================================
 * Архитектурная роль:
 * - Generic операции для работы с правилами: создание, валидация, сортировка по приоритету
 * - Архитектура: Rule (primitives) + RuleAlgebra (extensible contract)
 * - Причина изменения: rule-engine, generic rule operations, rule algebra
 * Принципы:
 * - ✅ SRP: разделение на Rule (primitives) и RuleAlgebra (extensible contract)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты
 * - ✅ Domain-pure: без side-effects, платформо-агностично, generic по TPredicate и TResult
 * - ✅ Extensible: RuleAlgebra для создания custom rule operations без изменения core
 * - ✅ Strict typing: generic по TPredicate, TResult, без string и Record в domain
 * - ✅ Scalable: Iterable streaming для больших наборов правил
 * - ✅ Security: runtime validation для защиты от некорректных правил
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения
 * - ❌ НЕ зависит от aggregation/classification
 */

import type { Predicate, PredicateResult } from './predicate.js';
import { predicate } from './predicate.js';

/* ============================================================================
 * 1. TYPES — RULE MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Правило: связывает предикат с результатом и опциональным приоритетом
 * Generic по TPredicate (может быть Predicate<TFact> или другой тип) и TResult
 * @public
 */
export type Rule<
  TPredicate, // Тип предиката (может быть Predicate<TFact> или другой тип)
  TResult, // Тип результата, возвращаемого при успешном выполнении предиката
> = Readonly<{
  /** Предикат для проверки факта */
  readonly predicate: TPredicate;
  /** Результат, возвращаемый при успешном выполнении предиката */
  readonly result: TResult;
  /** Приоритет правила (чем больше, тем выше приоритет; опционально) */
  readonly priority?: number;
}>;

/**
 * Результат операции с правилами (effect-based algebraic contract)
 * Generic по E для extensibility (custom operations могут возвращать свои типы ошибок)
 * @public
 */
export type RuleResult<
  T, // Тип значения при успешном выполнении
  E = RuleFailureReason, // Тип ошибки (для extensibility, custom operations могут возвращать свои типы ошибок)
> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: E; }>;

/**
 * Причина ошибки операции с правилами
 * @public
 */
export type RuleFailureReason =
  | Readonly<{ kind: 'INVALID_RULE'; }>
  | Readonly<{ kind: 'INVALID_PREDICATE'; }>
  | Readonly<{ kind: 'INVALID_PRIORITY'; }>
  | Readonly<{ kind: 'EMPTY_RULES'; }>
  | Readonly<{ kind: 'COMPOSITION_ERROR'; }>;

/**
 * Конфигурация для работы с правилами
 * Generic по TResult, TState, TPredicate, TFact, TContext для типобезопасности hooks
 * @public
 */
export type RuleConfig<
  TResult = unknown, // Тип результата операции (для будущих расширений)
  TState = void, // Тип состояния (для будущих расширений)
  TPredicate = unknown, // Тип предиката (для будущих расширений)
  TFact = unknown, // Тип факта (для будущих расширений)
  TContext = void, // Тип контекста (для будущих расширений)
> = Readonly<{
  /** Максимальное количество правил (защита от DoS) */
  readonly maxCompositionSize?: number;
  /** Минимальный приоритет (правила с меньшим приоритетом игнорируются) */
  readonly minPriority?: number;
  /** Максимальный приоритет (правила с большим приоритетом игнорируются) */
  readonly maxPriority?: number;
  /** Разрешить пустой список правил (для dynamic pipeline) */
  readonly allowEmpty?: boolean;
  /** @internal Type parameters для типобезопасности в будущих расширениях */
  readonly _typeMarker?: Readonly<{
    readonly result?: TResult;
    readonly state?: TState;
    readonly predicate?: TPredicate;
    readonly fact?: TFact;
    readonly context?: TContext;
  }>;
}>;

/**
 * Константы для работы с правилами (по умолчанию)
 * Generic fallback для снижения необходимости кастов
 */
function createDefaultRuleConfig<
  TResult = unknown,
  TState = void,
  TPredicate = unknown,
  TFact = unknown,
  TContext = void,
>(): RuleConfig<TResult, TState, TPredicate, TFact, TContext> {
  return {
    maxCompositionSize: Number.MAX_SAFE_INTEGER,
  } as RuleConfig<TResult, TState, TPredicate, TFact, TContext>;
}

/** Константы для работы с правилами (по умолчанию) - для обратной совместимости */
const DEFAULT_RULE_CONFIG = createDefaultRuleConfig() satisfies RuleConfig<
  unknown,
  void,
  unknown,
  unknown,
  void
>;

/* ============================================================================
 * 🔧 DOMAIN VALIDATION
 * ============================================================================
 */

/** Валидация приоритета (проверка, что это конечное число) */
function validatePriority(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined; // защита от NaN/Infinity
}

/** Валидация правила (проверка структуры и типов) */
function validateRule<TPredicate, TResult>(
  rule: unknown,
  validatePredicateFn?: (predicate: unknown) => predicate is TPredicate,
): rule is Rule<TPredicate, TResult> {
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
    return false; // исключаем null и массивы
  }

  const obj = rule as Record<string, unknown>;

  // Проверка наличия обязательных полей
  if (!('predicate' in obj) || !('result' in obj)) {
    return false;
  }

  // Валидация предиката (если предоставлена функция валидации)
  if (validatePredicateFn !== undefined && !validatePredicateFn(obj['predicate'])) {
    return false;
  }

  // Базовая проверка типа предиката (если не передана validatePredicateFn)
  // Исключаем примитивы (string, number, boolean, null, undefined) как явно невалидные предикаты
  if (validatePredicateFn === undefined) {
    const predicateValue = obj['predicate'];
    if (
      predicateValue === null
      || predicateValue === undefined
      || typeof predicateValue === 'string'
      || typeof predicateValue === 'number'
      || typeof predicateValue === 'boolean'
    ) {
      return false;
    }
  }

  // Валидация приоритета (опциональное поле)
  if (
    'priority' in obj
    && validatePriority(obj['priority']) === undefined
    && obj['priority'] !== undefined
  ) {
    return false;
  }

  return true;
}

/** Валидация массива правил */
function validateRules<TPredicate, TResult>(
  rules: readonly unknown[],
  maxSize?: number,
  validatePredicateFn?: (predicate: unknown) => predicate is TPredicate,
  allowEmpty?: boolean,
): RuleResult<readonly Rule<TPredicate, TResult>[], RuleFailureReason> {
  if (rules.length === 0) {
    // Разрешаем пустой список если allowEmpty=true (для dynamic pipeline)
    if (allowEmpty === true) {
      return { ok: true, value: [] };
    }
    return { ok: false, reason: { kind: 'EMPTY_RULES' } }; // strict по умолчанию
  }

  if (maxSize !== undefined && rules.length > maxSize) {
    return {
      ok: false,
      reason: { kind: 'COMPOSITION_ERROR' }, // защита от DoS
    };
  }

  /* eslint-disable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination и валидации */
  const validated: Rule<TPredicate, TResult>[] = [];
  for (let i = 0; i < rules.length; i += 1) {
    const ruleItem = rules[i];
    if (!validateRule<TPredicate, TResult>(ruleItem, validatePredicateFn)) {
      return {
        ok: false,
        reason: { kind: 'INVALID_RULE' }, // ранний выход при невалидном правиле
      };
    }
    // После validateRule TypeScript сужает тип через type guard
    validated.push(ruleItem); // накапливаем валидные правила
  }
  /* eslint-enable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation */

  return { ok: true, value: validated };
}

/** Фильтрация правил по приоритету */
function filterRulesByPriority<TPredicate, TResult>(
  rules: readonly Rule<TPredicate, TResult>[],
  minPriority?: number,
  maxPriority?: number,
): readonly Rule<TPredicate, TResult>[] {
  if (minPriority === undefined && maxPriority === undefined) {
    return rules; // ранний выход если фильтрация не требуется
  }

  /* eslint-disable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для фильтрации */
  const filtered: Rule<TPredicate, TResult>[] = [];
  for (let i = 0; i < rules.length; i += 1) {
    const ruleItem = rules[i];
    if (ruleItem === undefined) {
      continue; // пропускаем undefined элементы
    }
    const priority = ruleItem.priority ?? 0; // правила без приоритета имеют приоритет 0
    if (
      (minPriority === undefined || priority >= minPriority)
      && (maxPriority === undefined || priority <= maxPriority)
    ) {
      filtered.push(ruleItem); // накапливаем правила, прошедшие фильтрацию
    }
  }
  /* eslint-enable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation */

  return filtered;
}

/* ============================================================================
 * 📦 PUBLIC RULE API
 * ============================================================================
 */

/** Модуль для работы с правилами */
export const rule = {
  /**
   * Создание правила из предиката и результата
   *
   * @example
   * ```ts
   * rule.create((x: number) => x > 0, 'positive');
   * ```
   */
  create<TPredicate, TResult>(
    predicate: TPredicate,
    result: TResult,
    priority?: number,
  ): RuleResult<Rule<TPredicate, TResult>, RuleFailureReason> {
    const validatedPriority = priority !== undefined ? validatePriority(priority) : undefined;
    if (priority !== undefined && validatedPriority === undefined) {
      return { ok: false, reason: { kind: 'INVALID_PRIORITY' } };
    }

    return {
      ok: true,
      value: {
        predicate,
        result,
        ...(validatedPriority !== undefined ? { priority: validatedPriority } : {}),
      },
    };
  },

  /**
   * Валидация правила
   *
   * @example
   * ```ts
   * rule.validate({ predicate: (x) => x > 0, result: 'positive' });
   * ```
   */
  validate<TPredicate, TResult>(
    rule: unknown,
    validatePredicateFn?: (predicate: unknown) => predicate is TPredicate,
  ): RuleResult<Rule<TPredicate, TResult>, RuleFailureReason> {
    if (!validateRule<TPredicate, TResult>(rule, validatePredicateFn)) {
      return { ok: false, reason: { kind: 'INVALID_RULE' } };
    }

    // После validateRule TypeScript знает что rule это Rule<TPredicate, TResult>
    return { ok: true, value: rule };
  },

  /**
   * Валидация правила с предикатом типа Predicate<TFact>
   * Использует predicate.validate для валидации предиката
   *
   * @example
   * ```ts
   * rule.validateWithPredicate<number, string>({ predicate: (x) => x > 0, result: 'positive' });
   * ```
   */
  validateWithPredicate<TFact, TResult>(
    rule: unknown,
  ): RuleResult<Rule<Predicate<TFact>, TResult>, RuleFailureReason> {
    if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
      return { ok: false, reason: { kind: 'INVALID_RULE' } };
    }

    const obj = rule as Record<string, unknown>;

    if (!('predicate' in obj) || !('result' in obj)) {
      return { ok: false, reason: { kind: 'INVALID_RULE' } };
    }

    // Используем predicate.validate для валидации предиката (возвращает PredicateResult)
    const predicateValidation: PredicateResult<Predicate<TFact>> = predicate.validate<TFact>(
      obj['predicate'],
    );
    if (!predicateValidation.ok) {
      return { ok: false, reason: { kind: 'INVALID_PREDICATE' } };
    }

    const validatedPriority = 'priority' in obj ? validatePriority(obj['priority']) : undefined;
    if ('priority' in obj && obj['priority'] !== undefined && validatedPriority === undefined) {
      return { ok: false, reason: { kind: 'INVALID_PRIORITY' } };
    }

    return {
      ok: true,
      value: {
        predicate: predicateValidation.value,
        result: obj['result'] as TResult,
        ...(validatedPriority !== undefined ? { priority: validatedPriority } : {}),
      },
    };
  },

  /**
   * Валидация массива правил
   *
   * @example
   * ```ts
   * rule.validateAll([{ predicate: (x) => x > 0, result: 'positive' }]);
   * ```
   */
  validateAll<TPredicate, TResult>(
    rules: readonly unknown[],
    config: RuleConfig<readonly Rule<TPredicate, TResult>[], void, TPredicate, unknown, void> =
      DEFAULT_RULE_CONFIG as RuleConfig<
        readonly Rule<TPredicate, TResult>[],
        void,
        TPredicate,
        unknown,
        void
      >,
    validatePredicateFn?: (predicate: unknown) => predicate is TPredicate,
  ): RuleResult<readonly Rule<TPredicate, TResult>[], RuleFailureReason> {
    return validateRules(rules, config.maxCompositionSize, validatePredicateFn, config.allowEmpty);
  },

  /**
   * Сортировка правил по приоритету (по убыванию: от большего к меньшему)
   * Правила без приоритета имеют приоритет 0 и сортируются в конце
   */
  sortByPriority<TPredicate, TResult>(
    rules: readonly Rule<TPredicate, TResult>[],
  ): RuleResult<readonly Rule<TPredicate, TResult>[], RuleFailureReason> {
    if (rules.length === 0) {
      return { ok: false, reason: { kind: 'EMPTY_RULES' } };
    }

    // Создаем копию массива для сортировки (immutable подход)
    const sorted = [...rules].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA; // сортировка по убыванию (больший приоритет = выше)
    });

    return { ok: true, value: sorted };
  },

  /**
   * Фильтрация правил по диапазону приоритетов
   *
   * @example
   * ```ts
   * rule.filterByPriority([...rules], { minPriority: 2, maxPriority: 4 });
   * ```
   */
  filterByPriority<TPredicate, TResult>(
    rules: readonly Rule<TPredicate, TResult>[],
    config: RuleConfig<readonly Rule<TPredicate, TResult>[], void, TPredicate, unknown, void> =
      DEFAULT_RULE_CONFIG as RuleConfig<
        readonly Rule<TPredicate, TResult>[],
        void,
        TPredicate,
        unknown,
        void
      >,
  ): RuleResult<readonly Rule<TPredicate, TResult>[], RuleFailureReason> {
    if (rules.length === 0) {
      return { ok: false, reason: { kind: 'EMPTY_RULES' } };
    }

    const filtered = filterRulesByPriority(rules, config.minPriority, config.maxPriority);
    return { ok: true, value: filtered };
  },

  /**
   * Комбинированная операция: валидация, фильтрация по приоритету и сортировка
   * Thin wrapper поверх validateAll, filterByPriority и sortByPriority
   *
   * @example
   * ```ts
   * rule.prepare([...rules], { minPriority: 2 });
   * ```
   */
  prepare<TPredicate, TResult>(
    rules: readonly unknown[],
    config: RuleConfig<readonly Rule<TPredicate, TResult>[], void, TPredicate, unknown, void> =
      DEFAULT_RULE_CONFIG as RuleConfig<
        readonly Rule<TPredicate, TResult>[],
        void,
        TPredicate,
        unknown,
        void
      >,
    validatePredicateFn?: (predicate: unknown) => predicate is TPredicate,
  ): RuleResult<readonly Rule<TPredicate, TResult>[], RuleFailureReason> {
    // Шаг 1: Валидация
    const validation = rule.validateAll(rules, config, validatePredicateFn);
    if (!validation.ok) {
      return validation;
    }

    // Шаг 2: Фильтрация по приоритету
    const filtered = rule.filterByPriority(validation.value, config);
    if (!filtered.ok) {
      return filtered;
    }

    // Шаг 3: Сортировка по приоритету
    return rule.sortByPriority(filtered.value);
  },

  /**
   * Namespace для DSL-style расширений правил
   * Позволяет добавлять domain-specific операции без изменения core
   * ⚠️ Защищено от мутаций через Object.freeze для предотвращения side-channel атак
   *
   * @example
   * ```ts
   * rule.extensions.custom = { createWithDefaultPriority: (p, r) => rule.create(p, r, 0) };
   * ```
   */
  extensions: Object.freeze({}) as Record<string, unknown>,
} as const;

/* ============================================================================
 * 🔬 RULE ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM RULE OPERATIONS
 * ============================================================================
 */

/**
 * Результат шага операции с поддержкой short-circuit без throw
 * Позволяет step возвращать сигнал для продолжения или прерывания итерации
 * @public
 */
export type StepResult<TState, E = never> =
  | Readonly<{ type: 'continue'; state: TState; }>
  | Readonly<{ type: 'break'; state: TState; }>
  | Readonly<{ type: 'error'; error: E; }>;

/**
 * Проверка, является ли результат StepResult
 * @public
 */
export function isStepResult<TState, E = never>(
  value: TState | StepResult<TState, E>,
): value is StepResult<TState, E> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('type' in value)) {
    return false;
  }
  const typeValue = (value as { type: unknown; }).type;
  return typeValue === 'continue' || typeValue === 'break' || typeValue === 'error';
}

/**
 * Операция для работы с правилами (extensible contract)
 * Generic по TResult, TState, TContext, TPredicate, TFact, E для full algebra extensibility
 * ⚠️ КРИТИЧНО: Все методы должны быть pure и deterministic (без Date.now(), Math.random(), side-effects, мутаций).
 * step возвращает новое состояние (не мутирует), исключения автоматически перехватываются и преобразуются в RuleFailureReason.
 * ⚠️ SHORT-CIRCUIT: step может возвращать TState (продолжение) или StepResult<TState> (type='break' прерывает итерацию,
 * type='continue' продолжает). Позволяет реализовать "first match wins" без throw.
 * @public
 */
export type RuleOperation<
  TResult, // Тип результата операции (что возвращает finalize)
  TState = void, // Тип состояния
  TContext = void, // Тип контекста
  TPredicate = unknown, // Тип предиката
  TFact = unknown, // Тип факта
  TRuleResult = TResult, // Тип результата правила (что в Rule<TPredicate, TRuleResult>), по умолчанию = TResult для обратной совместимости
  _E = unknown, // Тип ошибки, используемый в возвращаемом типе ruleAlgebra.operate и в StepResult
> = Readonly<{
  /** Инициализация состояния */
  init: () => TState;
  /** Обработка одного правила и факта (⚠️ НЕ мутировать state, возвращать новое состояние или StepResult для short-circuit. Исключения перехватываются автоматически) */
  step: (
    state: TState,
    rule: Rule<TPredicate, TRuleResult>,
    fact: TFact,
    context: TContext,
  ) => TState | StepResult<TState, _E>;
  /** Финализация результата из состояния (⚠️ Исключения перехватываются автоматически и возвращаются как RuleFailureReason) */
  finalize: (state: TState, context: TContext) => TResult;
}>;

/**
 * Результат обработки шага с поддержкой short-circuit
 */
type ProcessStepResult<TState, E> =
  | RuleResult<TState, E | RuleFailureReason>
  | Readonly<{ ok: true; value: TState; shouldBreak: boolean; }>;

/** Обработка одного шага в цикле operate */
function processRuleOperateStep<TResult, TState, TPredicate, TFact, TContext, TRuleResult, E>(
  state: TState,
  rule: Rule<TPredicate, TRuleResult> | undefined,
  fact: TFact,
  _index: number,
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  context: TContext,
): ProcessStepResult<TState, E> {
  if (rule === undefined) {
    return { ok: false, reason: { kind: 'INVALID_RULE' } as E | RuleFailureReason }; // edge case
  }

  try {
    const stepResult = operation.step(state, rule, fact, context); // immutable: возвращает новое состояние или StepResult

    // Проверяем, является ли результат StepResult
    if (isStepResult(stepResult)) {
      // Обработка ошибки (если тип ошибки не never)
      if (stepResult.type === 'error') {
        return {
          ok: false,
          reason: stepResult.error as E | RuleFailureReason,
        };
      }
      return {
        ok: true,
        value: stepResult.state,
        shouldBreak: stepResult.type === 'break', // сигнал для прерывания итерации
      };
    }

    // Обычный результат - продолжаем итерацию
    return { ok: true, value: stepResult, shouldBreak: false };
  } catch {
    // Исключения преобразуются в RuleFailureReason
    return {
      ok: false,
      reason: { kind: 'COMPOSITION_ERROR' } as E | RuleFailureReason,
    }; // обработка исключений из step
  }
}

/** Обработка ошибки finalize */
function handleRuleFinalizeError<TResult, E>(): RuleResult<TResult, E | RuleFailureReason> {
  return {
    ok: false,
    reason: { kind: 'COMPOSITION_ERROR' } as E | RuleFailureReason,
  };
}

/** Выполнение finalize операции */
function executeRuleFinalize<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  state: TState,
  context: TContext,
): RuleResult<TResult, E | RuleFailureReason> {
  try {
    const result = operation.finalize(state, context); // финализация результата из состояния
    return { ok: true, value: result };
  } catch {
    return handleRuleFinalizeError<TResult, E>(); // обработка исключений из finalize
  }
}

/** Обработка массива правил в operate */
function operateRuleArray<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  rules: readonly Rule<TPredicate, TRuleResult>[],
  fact: TFact,
  context: TContext,
  config: RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
): RuleResult<TResult, E | RuleFailureReason> {
  if (rules.length === 0) {
    return { ok: false, reason: { kind: 'EMPTY_RULES' } };
  }

  if (config.maxCompositionSize !== undefined && rules.length > config.maxCompositionSize) {
    return { ok: false, reason: { kind: 'COMPOSITION_ERROR' } };
  }

  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
  let state = operation.init(); // инициализация состояния

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const stepResult = processRuleOperateStep(
      state,
      rule,
      fact,
      i,
      operation,
      context,
    );
    if (!stepResult.ok) {
      return stepResult as RuleResult<TResult, E | RuleFailureReason>; // ранний выход при ошибке
    }
    state = stepResult.value; // обновляем состояние для следующей итерации
    // Проверяем сигнал short-circuit
    if ('shouldBreak' in stepResult && stepResult.shouldBreak) {
      break; // прерываем итерацию без ошибки (short-circuit)
    }
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  return executeRuleFinalize(
    operation,
    state,
    context,
  );
}

/** Обработка Iterable правил в operate */
function operateRuleIterable<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  rules: Iterable<Rule<TPredicate, TRuleResult>>,
  fact: TFact,
  context: TContext,
  config: RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
): RuleResult<TResult, E | RuleFailureReason> {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination и индексации */
  let state = operation.init(); // инициализация состояния
  let index = 0; // индекс для отладки и ошибок
  let count = 0; // счетчик для проверки maxCompositionSize

  for (const rule of rules) {
    if (config.maxCompositionSize !== undefined && count >= config.maxCompositionSize) {
      return { ok: false, reason: { kind: 'COMPOSITION_ERROR' } }; // защита от DoS
    }

    const stepResult = processRuleOperateStep(
      state,
      rule,
      fact,
      index,
      operation,
      context,
    );
    if (!stepResult.ok) {
      return stepResult as RuleResult<TResult, E | RuleFailureReason>; // ранний выход при ошибке
    }
    state = stepResult.value; // обновляем состояние для следующей итерации
    // Проверяем сигнал short-circuit
    if ('shouldBreak' in stepResult && stepResult.shouldBreak) {
      break; // прерываем итерацию без ошибки (short-circuit)
    }
    index += 1;
    count += 1;
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  if (count === 0) {
    return { ok: false, reason: { kind: 'EMPTY_RULES' } }; // проверка пустого Iterable
  }

  return executeRuleFinalize(
    operation,
    state,
    context,
  );
}

/** Streaming генератор для массива правил (O(1) memory) */
function* operateLazyArray<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  rules: readonly Rule<TPredicate, TRuleResult>[],
  fact: TFact,
  context: TContext,
  config: RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
): Generator<
  | RuleResult<TState, E | RuleFailureReason>
  | RuleResult<TResult, E | RuleFailureReason>,
  void,
  unknown
> {
  if (rules.length === 0) {
    yield { ok: false, reason: { kind: 'EMPTY_RULES' } };
    return;
  }

  if (config.maxCompositionSize !== undefined && rules.length > config.maxCompositionSize) {
    yield { ok: false, reason: { kind: 'COMPOSITION_ERROR' } };
    return;
  }

  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для streaming и индексации */
  let state = operation.init(); // инициализация состояния
  let index = 0; // индекс для отладки и ошибок

  for (const rule of rules) {
    const stepResult = processRuleOperateStep(
      state,
      rule,
      fact,
      index,
      operation,
      context,
    );
    yield stepResult as RuleResult<TState, E | RuleFailureReason>; // yield каждого шага для streaming
    if (!stepResult.ok) {
      return; // ранний выход при ошибке
    }
    state = stepResult.value; // обновляем состояние для следующей итерации
    // Проверяем сигнал short-circuit
    if ('shouldBreak' in stepResult && stepResult.shouldBreak) {
      break; // прерываем итерацию без ошибки (short-circuit)
    }
    index += 1;
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  const finalizeResult = executeRuleFinalize(
    operation,
    state,
    context,
  );
  yield finalizeResult; // yield финального результата
}

/** Streaming генератор для Iterable правил (O(1) memory, true streaming) */
function* operateLazyIterable<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  rules: Iterable<Rule<TPredicate, TRuleResult>>,
  fact: TFact,
  context: TContext,
  config: RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
): Generator<
  | RuleResult<TState, E | RuleFailureReason>
  | RuleResult<TResult, E | RuleFailureReason>,
  void,
  unknown
> {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для streaming и индексации */
  let state = operation.init(); // инициализация состояния
  let index = 0; // индекс для отладки и ошибок
  let count = 0; // счетчик для проверки maxCompositionSize

  for (const rule of rules) {
    if (config.maxCompositionSize !== undefined && count >= config.maxCompositionSize) {
      yield { ok: false, reason: { kind: 'COMPOSITION_ERROR' } }; // защита от DoS
      return;
    }

    const stepResult = processRuleOperateStep(
      state,
      rule,
      fact,
      index,
      operation,
      context,
    );
    yield stepResult as RuleResult<TState, E | RuleFailureReason>; // yield каждого шага для streaming
    if (!stepResult.ok) {
      return; // ранний выход при ошибке
    }
    state = stepResult.value; // обновляем состояние для следующей итерации
    // Проверяем сигнал short-circuit
    if ('shouldBreak' in stepResult && stepResult.shouldBreak) {
      break; // прерываем итерацию без ошибки (short-circuit)
    }
    index += 1;
    count += 1;
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  if (count === 0) {
    yield { ok: false, reason: { kind: 'EMPTY_RULES' } }; // проверка пустого Iterable
    return;
  }

  const finalizeResult = executeRuleFinalize(
    operation,
    state,
    context,
  );
  yield finalizeResult; // yield финального результата
}

/** Модуль для extensible rule algebra */
export const ruleAlgebra = {
  /**
   * Применение RuleOperation к массиву или Iterable правил и факту
   * Поддерживает early termination (loop-based) и streaming (O(1) memory)
   * ⚠️ ВАЖНО: ожидает валидированные правила (rule.create() или rule.validate()/rule.validateAll()).
   * Невалидированные правила могут привести к runtime исключениям в RuleOperation.step.
   *
   * @example
   * ```ts
   * // Short-circuit: "first match wins"
   * const firstMatch = {
   *   init: () => null as string | null,
   *   step: (s, r, f) => r.predicate(f) ? { type: 'break', state: r.result } : { type: 'continue', state: s },
   *   finalize: (s) => s,
   * };
   * const validated = rule.validateAll(rules);
   * if (validated.ok) ruleAlgebra.operate(firstMatch, validated.value, fact);
   * ```
   */
  operate<
    TResult,
    TState = void,
    TContext = void,
    TPredicate = unknown,
    TFact = unknown,
    TRuleResult = TResult,
    E = unknown,
  >(
    operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
    rules: readonly Rule<TPredicate, TRuleResult>[] | Iterable<Rule<TPredicate, TRuleResult>>,
    fact: TFact,
    context: TContext,
    config: RuleConfig<TResult, TState, TPredicate, TFact, TContext> =
      DEFAULT_RULE_CONFIG as RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
  ): RuleResult<TResult, E | RuleFailureReason> {
    return Array.isArray(rules)
      ? operateRuleArray(operation, rules, fact, context, config) // оптимизированный путь для массивов
      : operateRuleIterable(operation, rules, fact, context, config); // streaming путь для Iterable
  },

  /**
   * Применение RuleOperation (lazy, streaming-friendly)
   * Возвращает generator для streaming evaluation с early-exit
   * ⚠️ ВАЖНО: ожидает валидированные правила (rule.create() или rule.validate()/rule.validateAll()).
   * Невалидированные правила могут привести к runtime исключениям в RuleOperation.step.
   *
   * @example
   * ```ts
   * const op = { init: () => 0, step: (s, r, f) => r.predicate(f) ? s + 1 : s, finalize: (s) => s };
   * for (const step of ruleAlgebra.operateLazy(op, validatedRules, fact)) {
   *   if (!step.ok) break;
   * }
   * ```
   */
  *operateLazy<
    TResult,
    TState = void,
    TContext = void,
    TPredicate = unknown,
    TFact = unknown,
    TRuleResult = TResult,
    E = unknown,
  >(
    operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
    rules: readonly Rule<TPredicate, TRuleResult>[] | Iterable<Rule<TPredicate, TRuleResult>>,
    fact: TFact,
    context: TContext,
    config: RuleConfig<TResult, TState, TPredicate, TFact, TContext> =
      DEFAULT_RULE_CONFIG as RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
  ): Generator<
    | RuleResult<TState, E | RuleFailureReason>
    | RuleResult<TResult, E | RuleFailureReason>,
    void,
    unknown
  > {
    // Делегируем в соответствующий streaming генератор без материализации Iterable
    if (Array.isArray(rules)) {
      yield* operateLazyArray<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
        operation,
        rules,
        fact,
        context,
        config,
      );
    } else {
      yield* operateLazyIterable<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
        operation,
        rules,
        fact,
        context,
        config,
      );
    }
  },
} as const;
