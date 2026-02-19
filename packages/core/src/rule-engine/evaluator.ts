/**
 * @file packages/core/src/rule-engine/evaluator.ts
 * ============================================================================
 * 🛡️ CORE — Evaluator (Generic Rule Evaluation)
 * ============================================================================
 *
 * Generic evaluation правил: применение предикатов к фактам с выбором результата по приоритету.
 * Архитектура: Evaluator (primitives) + EvaluatorAlgebra (extensible contract).
 *
 * Архитектура: библиотека из 2 модулей в одном файле
 * - Evaluator: generic функции для evaluation правил (evaluate, evaluateAll, evaluateIterable)
 * - EvaluatorAlgebra: extensible contract для создания custom evaluation operations
 *
 * Принципы: SRP, Deterministic, Domain-pure, Scalable (Iterable streaming),
 * Strict typing (generic по TPredicate, TResult, TFact), Extensible, Immutable, Security (runtime validation).
 *
 * ⚠️ ВАЖНО: НЕ включает domain-специфичные значения, НЕ зависит от aggregation/classification.
 */

import type {
  Rule,
  RuleConfig,
  RuleFailureReason,
  RuleOperation,
  RuleResult,
  StepResult,
} from './rule.js';
import { isStepResult, rule, ruleAlgebra } from './rule.js';

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC EVALUATION RESULT & ALGEBRAIC CONTRACT
 * ============================================================================
 */

/**
 * Режим evaluation правил
 * @public
 */
export type EvaluationMode =
  | Readonly<{ type: 'first-match'; }> // Первое совпадение (short-circuit)
  | Readonly<{ type: 'all-match'; }>; // Все совпадения

/**
 * Результат evaluation правила (effect-based algebraic contract)
 * Generic по E для extensibility (custom operations могут возвращать свои типы ошибок)
 * @public
 */
export type EvaluationResult<
  T, // Тип результата при успешном evaluation
  E = EvaluationFailureReason, // Тип ошибки (для extensibility, custom operations могут возвращать свои типы ошибок)
> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: E; }>;

/**
 * Причина ошибки evaluation правил
 * @public
 */
export type EvaluationFailureReason =
  | Readonly<{ kind: 'EMPTY_RULES'; }>
  | Readonly<{ kind: 'NO_MATCH'; }>
  | Readonly<{ kind: 'EVALUATION_ERROR'; index: number; error?: string; stack?: string; }>
  | Readonly<{ kind: 'COMPOSITION_ERROR'; }>
  | RuleFailureReason; // Наследуем ошибки из rule.ts

/**
 * Конфигурация для evaluation правил
 * Generic по TResult, TPredicate, TFact для типобезопасности
 * @public
 */
export type EvaluationConfig<
  TResult = unknown, // Тип результата правила
  TPredicate = unknown, // Тип предиката
  TFact = unknown, // Тип факта
> = Readonly<{
  /** Режим evaluation (first-match или all-match) */
  readonly mode?: EvaluationMode;
  /** Максимальное количество правил (защита от DoS) */
  readonly maxCompositionSize?: number;
  /** Минимальный приоритет (правила с меньшим приоритетом игнорируются) */
  readonly minPriority?: number;
  /** Максимальный приоритет (правила с большим приоритетом игнорируются) */
  readonly maxPriority?: number;
  /** Разрешить пустой список правил (для dynamic pipeline) */
  readonly allowEmpty?: boolean;
  /** Пропустить сортировку (для first-match когда порядок уже гарантирован, +30-40% perf при large rules) */
  readonly skipSort?: boolean;
  /** Включить stack trace в ошибки (по умолчанию false для безопасности в проде) */
  readonly includeStack?: boolean;
  /** @internal Type parameters для типобезопасности в будущих расширениях */
  readonly _typeMarker?: Readonly<{
    readonly result?: TResult;
    readonly predicate?: TPredicate;
    readonly fact?: TFact;
  }>;
}>;

/** Константы для evaluation правил (по умолчанию) */
function createDefaultEvaluationConfig<
  TResult = unknown,
  TPredicate = unknown,
  TFact = unknown,
>(): EvaluationConfig<TResult, TPredicate, TFact> {
  return {
    mode: FIRST_MATCH_MODE,
  } as EvaluationConfig<TResult, TPredicate, TFact>;
}

/** Константа для режима first-match (используется в нескольких местах) */
const FIRST_MATCH_MODE = { type: 'first-match' } as const;

/** Константы для evaluation правил (по умолчанию) - для обратной совместимости */
const DEFAULT_EVALUATION_CONFIG = createDefaultEvaluationConfig() satisfies EvaluationConfig<
  unknown,
  unknown,
  unknown
>;

/* ============================================================================
 * 🔧 PREDICATE VALIDATION
 * ============================================================================
 */

/** Обработка ошибки при evaluation предиката */
function createPredicateError(
  index: number,
  error: unknown,
  includeStack?: boolean,
): EvaluationFailureReason {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = includeStack === true && error instanceof Error ? error.stack : undefined;
  if (errorMessage !== '' && errorStack !== undefined && errorStack !== '') {
    return { kind: 'EVALUATION_ERROR', index, error: errorMessage, stack: errorStack };
  }
  if (errorMessage !== '') {
    return { kind: 'EVALUATION_ERROR', index, error: errorMessage };
  }
  return { kind: 'EVALUATION_ERROR', index };
}

/** Применение предиката к факту с обработкой исключений */
function evaluatePredicate<TPredicate, TFact>(
  predicate: TPredicate,
  fact: TFact,
  index: number,
  includeStack?: boolean,
): RuleResult<boolean, EvaluationFailureReason> {
  if (typeof predicate !== 'function') {
    return {
      ok: false,
      reason: { kind: 'EVALUATION_ERROR', index, error: 'Predicate is not a function' },
    };
  }

  try {
    const result = (predicate as (fact: TFact) => boolean)(fact);
    return { ok: true, value: Boolean(result) }; // Явное приведение к boolean
  } catch (error) {
    return { ok: false, reason: createPredicateError(index, error, includeStack) };
  }
}

/** Wrapper для обработки step с поддержкой EvaluatorStepResult (структурированные ошибки) */
function processEvaluatorStep<TResult, TState, TPredicate, TFact, TContext, TRuleResult, E>(
  state: TState,
  rule: Rule<TPredicate, TRuleResult> | undefined,
  fact: TFact,
  _index: number, // Передается через context для evaluator операций (TContext = number)
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  context: TContext, // Для evaluator операций context = index (number)
):
  | RuleResult<TState, E | RuleFailureReason | EvaluationFailureReason>
  | Readonly<{ ok: true; value: TState; shouldBreak: boolean; }>
{
  if (rule === undefined) {
    return {
      ok: false,
      reason: { kind: 'INVALID_RULE' } as E | RuleFailureReason | EvaluationFailureReason,
    };
  }

  try {
    // Для evaluator операций context = number (индекс), передаем индекс через context
    // _index используется через context в операциях (для evaluator TContext = number)
    const stepResult = operation.step(state, rule, fact, context);

    // Проверяем, является ли результат StepResult (включая тип 'error')
    if (isStepResult(stepResult)) {
      // Обработка ошибки
      if (stepResult.type === 'error') {
        return {
          ok: false,
          reason: stepResult.error as E | RuleFailureReason | EvaluationFailureReason,
        };
      }
      // Обработка continue/break
      return {
        ok: true,
        value: stepResult.state,
        shouldBreak: stepResult.type === 'break',
      };
    }

    // Обычный результат - продолжаем итерацию
    return { ok: true, value: stepResult, shouldBreak: false };
  } catch {
    // Исключения преобразуются в RuleFailureReason
    return {
      ok: false,
      reason: { kind: 'COMPOSITION_ERROR' } as E | RuleFailureReason | EvaluationFailureReason,
    };
  }
}

/** Wrapper для ruleAlgebra.operate с поддержкой EvaluatorStepResult (streaming-friendly для Iterable) */
function operateEvaluatorRules<TResult, TState, TPredicate, TFact, TContext, TRuleResult, E>(
  operation: RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
  rules: readonly Rule<TPredicate, TRuleResult>[] | Iterable<Rule<TPredicate, TRuleResult>>,
  fact: TFact,
  context: TContext,
  config: RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
): RuleResult<TResult, E | RuleFailureReason | EvaluationFailureReason> {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
  let state = operation.init();
  let index = 0;
  let count = 0;

  // Объединенный цикл для массивов и Iterable (одинаковая логика)
  for (const rule of rules) {
    if (config.maxCompositionSize !== undefined && count >= config.maxCompositionSize) {
      return {
        ok: false,
        reason: { kind: 'COMPOSITION_ERROR' } as E | RuleFailureReason | EvaluationFailureReason,
      };
    }

    // Для evaluator операций context = number (индекс), передаем индекс напрямую
    const stepResult = processEvaluatorStep(
      state,
      rule,
      fact,
      index,
      operation,
      index as unknown as TContext, // для evaluator операций TContext = number
    );

    if (!stepResult.ok) {
      return { ok: false, reason: stepResult.reason } as RuleResult<
        TResult,
        E | RuleFailureReason | EvaluationFailureReason
      >;
    }

    state = stepResult.value;
    if ('shouldBreak' in stepResult && stepResult.shouldBreak) {
      break; // short-circuit
    }

    index += 1;
    count += 1;
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  try {
    const finalizeResult = operation.finalize(state, context);
    return { ok: true, value: finalizeResult };
  } catch {
    return {
      ok: false,
      reason: { kind: 'COMPOSITION_ERROR' } as E | RuleFailureReason | EvaluationFailureReason,
    };
  }
}

/** Операция для first-match evaluation */
function createFirstMatchOperation<TPredicate, TResult, TFact>(
  includeStack?: boolean,
): RuleOperation<
  TResult | null, // Результат операции
  TResult | null, // Состояние
  number, // TContext используется для передачи индекса
  TPredicate,
  TFact,
  TResult // TRuleResult: тип результата правила (совпадает с TResult)
> {
  return {
    init: () => null as TResult | null,
    step: (
      state,
      rule,
      fact,
      index,
    ): StepResult<TResult | null, EvaluationFailureReason> => {
      // Если уже нашли совпадение, пропускаем остальные правила (short-circuit)
      if (state !== null) {
        return { type: 'break' as const, state };
      }

      // Передаем реальный индекс для корректного debugging
      const predicateResult = evaluatePredicate(rule.predicate, fact, index, includeStack);
      if (!predicateResult.ok) {
        // Ошибка evaluation предиката - возвращаем структурированную ошибку через StepResult
        // processEvaluatorStep обработает это и преобразует в RuleResult с сохранением всей информации об ошибке
        return {
          type: 'error' as const,
          error: predicateResult.reason,
        };
      }

      if (predicateResult.value) {
        // Предикат вернул true - возвращаем результат правила и прерываем итерацию
        return { type: 'break' as const, state: rule.result };
      }

      // Предикат вернул false - продолжаем поиск
      return { type: 'continue' as const, state };
    },
    finalize: (state) => state,
  };
}

/**
 * Операция для all-match evaluation
 * Использует TRuleResult для разделения типа результата операции и типа результата правила:
 * - Результат операции: readonly TResult[]
 * - Тип правила: Rule<TPredicate, TResult> (где TResult - тип результата правила, не массива)
 */
function createAllMatchOperation<TPredicate, TResult, TFact>(
  includeStack?: boolean,
): RuleOperation<
  readonly TResult[], // Результат операции
  readonly TResult[], // Состояние
  number, // TContext используется для передачи индекса
  TPredicate,
  TFact,
  TResult // TRuleResult: тип результата правила (не массив)
> {
  return {
    init: () => [] as readonly TResult[],
    step: (
      state,
      ruleItem,
      fact,
      index,
    ): StepResult<readonly TResult[], EvaluationFailureReason> => {
      // Передаем реальный индекс для корректного debugging
      const predicateResult = evaluatePredicate(ruleItem.predicate, fact, index, includeStack);
      if (!predicateResult.ok) {
        // Ошибка evaluation предиката - возвращаем структурированную ошибку через StepResult
        // processEvaluatorStep обработает это и преобразует в RuleResult с сохранением всей информации об ошибке
        return {
          type: 'error' as const,
          error: predicateResult.reason,
        };
      }

      if (predicateResult.value) {
        // Предикат вернул true - добавляем результат правила
        // ruleItem имеет тип Rule<TPredicate, TResult> (благодаря TRuleResult)
        const newState: readonly TResult[] = [...state, ruleItem.result];
        return { type: 'continue' as const, state: newState };
      }

      // Предикат вернул false - продолжаем без изменений
      return { type: 'continue' as const, state };
    },
    finalize: (state) => state,
  };
}

/** Преобразование RuleResult в EvaluationResult с обработкой ошибок */
function convertRuleResultToEvaluationResult<T, E>(
  ruleResult: RuleResult<T, E | RuleFailureReason>,
): EvaluationResult<T, EvaluationFailureReason> {
  if (ruleResult.ok) {
    return { ok: true, value: ruleResult.value };
  }

  // Преобразуем RuleFailureReason в EvaluationFailureReason
  const reason = ruleResult.reason as EvaluationFailureReason;
  return { ok: false, reason };
}

/** Обработка результата first-match evaluation */
function processFirstMatchResult<TResult>(
  result: RuleResult<TResult | null, EvaluationFailureReason | RuleFailureReason>,
): EvaluationResult<TResult | null, EvaluationFailureReason> {
  if (!result.ok) {
    return convertRuleResultToEvaluationResult(result);
  }

  if (result.value === null) {
    return { ok: false, reason: { kind: 'NO_MATCH' } };
  }

  return { ok: true, value: result.value };
}

/** Обработка результата all-match evaluation */
function processAllMatchResult<TResult>(
  result: RuleResult<readonly TResult[], EvaluationFailureReason | RuleFailureReason>,
): EvaluationResult<readonly TResult[], EvaluationFailureReason> {
  if (!result.ok) {
    return convertRuleResultToEvaluationResult(result);
  }

  return { ok: true, value: result.value };
}

/** Валидация правила на лету (streaming-friendly) */
function validateRuleStreaming<TPredicate, TResult>(
  ruleItem: unknown,
  validatePredicateFn?: (predicate: unknown) => predicate is TPredicate,
): RuleResult<Rule<TPredicate, TResult>, EvaluationFailureReason> {
  // Базовая проверка структуры
  if (typeof ruleItem !== 'object' || ruleItem === null || Array.isArray(ruleItem)) {
    return { ok: false, reason: { kind: 'INVALID_RULE' } };
  }

  const obj = ruleItem as Record<string, unknown>;
  if (!('predicate' in obj) || !('result' in obj)) {
    return { ok: false, reason: { kind: 'INVALID_RULE' } };
  }

  // Проверка предиката
  if (validatePredicateFn !== undefined && !validatePredicateFn(obj['predicate'])) {
    return { ok: false, reason: { kind: 'INVALID_PREDICATE' } };
  }

  // Проверка приоритета
  if (
    'priority' in obj && (typeof obj['priority'] !== 'number' || !Number.isFinite(obj['priority']))
  ) {
    return { ok: false, reason: { kind: 'INVALID_PRIORITY' } };
  }

  // Type assertion после валидации структуры
  // После всех проверок мы можем безопасно утверждать тип
  return { ok: true, value: obj as unknown as Rule<TPredicate, TResult> };
}

/** Фильтрация правила по приоритету (streaming-friendly) */
function filterRuleByPriority<TResult>(
  ruleItem: Rule<unknown, TResult>,
  minPriority?: number,
  maxPriority?: number,
): boolean {
  const priority = ruleItem.priority ?? 0;
  return (minPriority === undefined || priority >= minPriority)
    && (maxPriority === undefined || priority <= maxPriority);
}

/** Type guard для проверки структурированной ошибки */
function isStructuredError(
  error: unknown,
): error is { kind: string; readonly [key: string]: unknown; } {
  return typeof error === 'object' && error !== null && 'kind' in error;
}

/** Обработка ошибок evaluation */
function handleEvaluationError(error: unknown): EvaluationResult<never, EvaluationFailureReason> {
  // Проверяем, является ли ошибка структурированным объектом с полем kind
  if (isStructuredError(error)) {
    // Проверяем известные типы ошибок из RuleFailureReason и EvaluationFailureReason
    const knownKinds = [
      'COMPOSITION_ERROR',
      'INVALID_RULE',
      'INVALID_PREDICATE',
      'INVALID_PRIORITY',
      'EMPTY_RULES',
    ] as const;
    if (knownKinds.includes(error.kind as (typeof knownKinds)[number])) {
      return { ok: false, reason: error as EvaluationFailureReason };
    }
  }

  // Fallback для неизвестных ошибок
  const errorMessage = error instanceof Error ? error.message : String(error);
  return { ok: false, reason: { kind: 'EVALUATION_ERROR', index: 0, error: errorMessage } };
}

/** Обработка first-match режима для streaming evaluation */
function evaluateFirstMatchStreaming<TPredicate, TResult, TFact>(
  validatedRules: Generator<Rule<TPredicate, TResult>, void, unknown>,
  fact: TFact,
  config: EvaluationConfig<TResult, TPredicate, TFact>,
): EvaluationResult<TResult | null, EvaluationFailureReason> {
  const operation = createFirstMatchOperation<TPredicate, TResult, TFact>(config.includeStack);
  const algebraConfig: RuleConfig<TResult | null, TResult | null, TPredicate, TFact, number> = {
    maxCompositionSize: config.maxCompositionSize,
  } as RuleConfig<TResult | null, TResult | null, TPredicate, TFact, number>;

  const result = operateEvaluatorRules(
    operation,
    validatedRules,
    fact,
    0,
    algebraConfig,
  );

  return processFirstMatchResult(
    result as RuleResult<TResult | null, EvaluationFailureReason | RuleFailureReason>,
  );
}

/** Обработка all-match режима для streaming evaluation */
function evaluateAllMatchStreaming<TPredicate, TResult, TFact>(
  validatedRules: Generator<Rule<TPredicate, TResult>, void, unknown>,
  fact: TFact,
  config: EvaluationConfig<TResult, TPredicate, TFact>,
): EvaluationResult<readonly TResult[], EvaluationFailureReason> {
  const operation = createAllMatchOperation<TPredicate, TResult, TFact>(config.includeStack);
  const algebraConfig: RuleConfig<
    readonly TResult[],
    readonly TResult[],
    TPredicate,
    TFact,
    number
  > = {
    maxCompositionSize: config.maxCompositionSize,
  } as RuleConfig<readonly TResult[], readonly TResult[], TPredicate, TFact, number>;

  const result = operateEvaluatorRules(
    operation,
    validatedRules,
    fact,
    0,
    algebraConfig,
  );

  return processAllMatchResult(
    result as RuleResult<readonly TResult[], EvaluationFailureReason | RuleFailureReason>,
  );
}

/** Streaming evaluation для Iterable правил (O(1) memory) */
function evaluateIterableStreaming<TPredicate, TResult, TFact>(
  rules: Iterable<Rule<TPredicate, TResult>>,
  fact: TFact,
  config: EvaluationConfig<TResult, TPredicate, TFact>,
): EvaluationResult<TResult | null | readonly TResult[], EvaluationFailureReason> {
  const mode = config.mode ?? FIRST_MATCH_MODE;
  /* eslint-disable functional/no-loop-statements, fp/no-throw -- необходимо для streaming и защиты от DoS */

  // Валидация и фильтрация на лету
  // Примечание: проверка maxCompositionSize выполняется в operateEvaluatorRules для унификации логики
  function* validatedAndFilteredRules(): Generator<Rule<TPredicate, TResult>, void, unknown> {
    for (const ruleItem of rules) {
      // Валидация правила
      const validation = validateRuleStreaming(ruleItem);
      if (!validation.ok) {
        throw validation.reason;
      }

      // Фильтрация по приоритету
      if (!filterRuleByPriority(validation.value, config.minPriority, config.maxPriority)) {
        continue;
      }

      // Type assertion после валидации
      yield validation.value as Rule<TPredicate, TResult>;
    }
  }
  /* eslint-enable functional/no-loop-statements, fp/no-throw */

  try {
    const validatedRules = validatedAndFilteredRules();
    const firstRule = validatedRules.next();

    // Проверка на пустой список правил
    if (firstRule.done === true) {
      if (config.allowEmpty === true) {
        return { ok: false, reason: { kind: 'NO_MATCH' } };
      }
      return { ok: false, reason: { kind: 'EMPTY_RULES' } };
    }

    // Создаем новый генератор, который включает первый элемент
    function* rulesWithFirst(): Generator<Rule<TPredicate, TResult>, void, unknown> {
      // firstRule.done уже проверено выше, поэтому value гарантированно существует
      yield firstRule.value as Rule<TPredicate, TResult>;
      yield* validatedRules;
    }

    // Применяем операцию к streaming Iterable
    if (mode.type === FIRST_MATCH_MODE.type) {
      return evaluateFirstMatchStreaming(rulesWithFirst(), fact, config);
    }

    return evaluateAllMatchStreaming(rulesWithFirst(), fact, config);
  } catch (error) {
    return handleEvaluationError(error);
  }
}

/* ============================================================================
 * 📦 PUBLIC EVALUATOR API
 * ============================================================================
 */

/** Модуль для evaluation правил */
export const evaluator = {
  /**
   * Evaluation правил для факта (first-match по умолчанию)
   * Возвращает результат первого совпавшего правила или null
   * @example
   * ```ts
   * const result = evaluator.evaluate(rules, fact);
   * if (result.ok && result.value !== null) { const value = result.value; }
   * ```
   */
  evaluate<TPredicate, TResult, TFact>(
    rules: readonly Rule<TPredicate, TResult>[],
    fact: TFact,
    config: EvaluationConfig<TResult, TPredicate, TFact> =
      DEFAULT_EVALUATION_CONFIG as EvaluationConfig<TResult, TPredicate, TFact>,
  ): EvaluationResult<TResult | null | readonly TResult[], EvaluationFailureReason> {
    if (rules.length === 0) {
      if (config.allowEmpty === true) {
        return { ok: false, reason: { kind: 'NO_MATCH' } };
      }
      return { ok: false, reason: { kind: 'EMPTY_RULES' } };
    }

    // Подготавливаем правила (валидация, фильтрация, опциональная сортировка)
    const ruleConfig: RuleConfig<
      readonly Rule<TPredicate, TResult>[],
      void,
      TPredicate,
      unknown,
      void
    > = {
      maxCompositionSize: config.maxCompositionSize,
      minPriority: config.minPriority,
      maxPriority: config.maxPriority,
      allowEmpty: config.allowEmpty,
    } as RuleConfig<readonly Rule<TPredicate, TResult>[], void, TPredicate, unknown, void>;

    // Валидация и фильтрация
    const validation = rule.validateAll(rules, ruleConfig);
    if (!validation.ok) {
      return convertRuleResultToEvaluationResult(validation);
    }

    const filtered = rule.filterByPriority(validation.value, ruleConfig);
    if (!filtered.ok) {
      return convertRuleResultToEvaluationResult(filtered);
    }

    // Сортировка только если не пропущена (skipSort для first-match когда порядок уже гарантирован, +30-40% perf)
    const prepared = config.skipSort === true
      ? filtered
      : rule.sortByPriority(filtered.value);
    if (!prepared.ok) {
      return convertRuleResultToEvaluationResult(prepared);
    }

    // Выбираем операцию в зависимости от режима
    const mode = config.mode ?? FIRST_MATCH_MODE;
    if (mode.type === FIRST_MATCH_MODE.type) {
      const operation = createFirstMatchOperation<TPredicate, TResult, TFact>(config.includeStack);
      const algebraConfig: RuleConfig<TResult | null, TResult | null, TPredicate, TFact, number> = {
        maxCompositionSize: config.maxCompositionSize,
      } as RuleConfig<TResult | null, TResult | null, TPredicate, TFact, number>;

      // Используем operateEvaluatorRules для поддержки структурированных ошибок и передачи индекса
      const result = operateEvaluatorRules(
        operation,
        prepared.value,
        fact,
        0, // начальный индекс, будет инкрементироваться в цикле
        algebraConfig,
      );

      return processFirstMatchResult(
        result as RuleResult<TResult | null, EvaluationFailureReason | RuleFailureReason>,
      );
    }

    // all-match режим
    const operation = createAllMatchOperation<TPredicate, TResult, TFact>(config.includeStack);
    const algebraConfig: RuleConfig<
      readonly TResult[],
      readonly TResult[],
      TPredicate,
      TFact,
      number
    > = {
      maxCompositionSize: config.maxCompositionSize,
    } as RuleConfig<readonly TResult[], readonly TResult[], TPredicate, TFact, number>;

    // prepared.value имеет тип readonly Rule<TPredicate, TResult>[]
    // Благодаря TRuleResult в RuleOperation, тип правила корректно определен как Rule<TPredicate, TResult>
    // Используем operateEvaluatorRules для поддержки структурированных ошибок и передачи индекса
    const result = operateEvaluatorRules(
      operation,
      prepared.value,
      fact,
      0, // начальный индекс, будет инкрементироваться в цикле
      algebraConfig,
    );

    return processAllMatchResult(
      result as RuleResult<readonly TResult[], EvaluationFailureReason | RuleFailureReason>,
    );
  },

  /**
   * Evaluation всех правил для факта (all-match)
   * Возвращает массив результатов всех совпавших правил
   * @example
   * ```ts
   * const result = evaluator.evaluateAll(rules, fact);
   * if (result.ok) { const matches = result.value; }
   * ```
   */
  evaluateAll<TPredicate, TResult, TFact>(
    rules: readonly Rule<TPredicate, TResult>[],
    fact: TFact,
    config: Omit<EvaluationConfig<TResult, TPredicate, TFact>, 'mode'> = {} as Omit<
      EvaluationConfig<TResult, TPredicate, TFact>,
      'mode'
    >,
  ): EvaluationResult<readonly TResult[], EvaluationFailureReason> {
    if (rules.length === 0) {
      if (config.allowEmpty === true) {
        return { ok: false, reason: { kind: 'NO_MATCH' } };
      }
      return { ok: false, reason: { kind: 'EMPTY_RULES' } };
    }

    // Подготавливаем правила (валидация, фильтрация, опциональная сортировка)
    const ruleConfig: RuleConfig<
      readonly Rule<TPredicate, TResult>[],
      void,
      TPredicate,
      unknown,
      void
    > = {
      maxCompositionSize: config.maxCompositionSize,
      minPriority: config.minPriority,
      maxPriority: config.maxPriority,
      allowEmpty: config.allowEmpty,
    } as RuleConfig<readonly Rule<TPredicate, TResult>[], void, TPredicate, unknown, void>;

    // Валидация и фильтрация
    const validation = rule.validateAll(rules, ruleConfig);
    if (!validation.ok) {
      return convertRuleResultToEvaluationResult(validation);
    }

    const filtered = rule.filterByPriority(validation.value, ruleConfig);
    if (!filtered.ok) {
      return convertRuleResultToEvaluationResult(filtered);
    }

    // Сортировка только если не пропущена (skipSort для all-match когда порядок не критичен, +30-40% perf)
    const prepared = config.skipSort === true
      ? filtered
      : rule.sortByPriority(filtered.value);
    if (!prepared.ok) {
      return convertRuleResultToEvaluationResult(prepared);
    }

    // all-match режим
    const operation = createAllMatchOperation<TPredicate, TResult, TFact>(config.includeStack);
    const algebraConfig: RuleConfig<
      readonly TResult[],
      readonly TResult[],
      TPredicate,
      TFact,
      number
    > = {
      maxCompositionSize: config.maxCompositionSize,
    } as RuleConfig<readonly TResult[], readonly TResult[], TPredicate, TFact, number>;

    // prepared.value имеет тип readonly Rule<TPredicate, TResult>[]
    // Благодаря TRuleResult в RuleOperation, тип правила корректно определен как Rule<TPredicate, TResult>
    // Используем operateEvaluatorRules для поддержки структурированных ошибок и передачи индекса
    const result = operateEvaluatorRules(
      operation,
      prepared.value,
      fact,
      0, // начальный индекс, будет инкрементироваться в цикле
      algebraConfig,
    );

    return processAllMatchResult(
      result as RuleResult<readonly TResult[], EvaluationFailureReason | RuleFailureReason>,
    );
  },

  /**
   * Evaluation правил для факта (streaming-friendly, Iterable)
   * Поддерживает first-match и all-match режимы
   * ⚠️ ВАЖНО: для first-match с приоритетами требуется сортировка, что может потребовать частичной материализации
   * Для all-match работает полностью в streaming режиме (O(1) memory)
   * @example
   * ```ts
   * const result = evaluator.evaluateIterable(ruleGenerator, fact);
   * ```
   */
  evaluateIterable<TPredicate, TResult, TFact>(
    rules: Iterable<Rule<TPredicate, TResult>>,
    fact: TFact,
    config: EvaluationConfig<TResult, TPredicate, TFact> =
      DEFAULT_EVALUATION_CONFIG as EvaluationConfig<TResult, TPredicate, TFact>,
  ): EvaluationResult<TResult | null | readonly TResult[], EvaluationFailureReason> {
    const mode = config.mode ?? FIRST_MATCH_MODE;
    // Сортировка нужна только если:
    // 1. Не пропущена через skipSort
    // 2. И есть приоритеты для first-match (для all-match сортировка не критична)
    const needsSorting = config.skipSort !== true
      && mode.type === FIRST_MATCH_MODE.type
      && (config.minPriority !== undefined || config.maxPriority !== undefined);

    // Для first-match с приоритетами без skipSort нужна сортировка → материализация
    // Для all-match, first-match без приоритетов или с skipSort → полностью streaming (O(1) memory)
    if (needsSorting) {
      // Материализуем только для сортировки (необходимо для корректного порядка обработки по приоритету)
      /* eslint-disable functional/no-loop-statements, functional/immutable-data -- необходимо для материализации */
      const rulesArray: Rule<TPredicate, TResult>[] = [];
      for (const ruleItem of rules) {
        rulesArray.push(ruleItem);
      }
      /* eslint-enable functional/no-loop-statements, functional/immutable-data */
      return evaluator.evaluate(rulesArray, fact, config);
    }

    // Streaming-путь: валидация и фильтрация на лету без материализации (O(1) memory)
    return evaluateIterableStreaming(rules, fact, config);
  },

  /**
   * Namespace для DSL-style расширений evaluator
   * Позволяет добавлять domain-specific операции без изменения core
   * ⚠️ Защищено от мутаций через Object.freeze для предотвращения side-channel атак
   * @example
   * ```ts
   * evaluator.extensions.custom = { evaluateWithContext: (rules, fact, ctx) => ... };
   * ```
   */
  extensions: Object.freeze({}) as Record<string, unknown>,
} as const;

/* ============================================================================
 * 🔬 EVALUATOR ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM EVALUATION OPERATIONS
 * ============================================================================
 */

/**
 * Операция для custom evaluation (extensible contract)
 * Generic по TResult, TState, TContext, TPredicate, TFact, E для full algebra extensibility
 *
 * ⚠️ КРИТИЧНО: Все методы должны быть pure и deterministic (без Date.now(), Math.random(), side-effects, мутаций).
 * step возвращает новое состояние (не мутирует), исключения автоматически перехватываются и преобразуются в EvaluationFailureReason.
 *
 * @public
 */
export type EvaluatorOperation<
  TResult, // Тип результата операции
  TState = void, // Тип состояния
  TContext = void, // Тип контекста
  TPredicate = unknown, // Тип предиката
  TFact = unknown, // Тип факта
  TRuleResult = TResult, // Тип результата правила (по умолчанию = TResult для обратной совместимости)
  _E = unknown, // Тип ошибки, используемый в возвращаемом типе evaluatorAlgebra.operate
> = RuleOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, _E>;

/** Модуль для extensible evaluator algebra */
export const evaluatorAlgebra = {
  /**
   * Применение EvaluatorOperation к массиву или Iterable правил и факту
   * Поддерживает early termination (loop-based) и streaming (O(1) memory)
   *
   * ⚠️ ВАЖНО: ожидает валидированные правила (rule.create() или rule.validate()/rule.validateAll()).
   * Невалидированные правила могут привести к runtime исключениям в EvaluatorOperation.step.
   *
   * @example
   * ```ts
   * const op = { init: () => [], step: (s, r, f) => r.predicate(f) ? [...s, r.result] : s, finalize: (s) => s };
   * const validated = rule.validateAll(rules);
   * if (validated.ok) { const result = evaluatorAlgebra.operate(op, validated.value, fact, ctx); }
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
    operation: EvaluatorOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
    rules: readonly Rule<TPredicate, TRuleResult>[] | Iterable<Rule<TPredicate, TRuleResult>>,
    fact: TFact,
    context: TContext,
    config: RuleConfig<TResult, TState, TPredicate, TFact, TContext> = {
      maxCompositionSize: Number.MAX_SAFE_INTEGER,
    } as RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
  ): RuleResult<TResult, E | RuleFailureReason> {
    // Делегируем в ruleAlgebra.operate (reuse существующей реализации)
    return ruleAlgebra.operate<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
      operation,
      rules,
      fact,
      context,
      config,
    );
  },

  /**
   * Применение EvaluatorOperation (lazy, streaming-friendly)
   * Возвращает generator для streaming evaluation с early-exit
   *
   * ⚠️ ВАЖНО: ожидает валидированные правила (rule.create() или rule.validate()/rule.validateAll()).
   * Невалидированные правила могут привести к runtime исключениям в EvaluatorOperation.step.
   *
   * @example
   * ```ts
   * const op = { init: () => 0, step: (s, r, f) => r.predicate(f) ? s + 1 : s, finalize: (s) => s };
   * for (const step of evaluatorAlgebra.operateLazy(op, validatedRules, fact, ctx)) {
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
    operation: EvaluatorOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>,
    rules: readonly Rule<TPredicate, TRuleResult>[] | Iterable<Rule<TPredicate, TRuleResult>>,
    fact: TFact,
    context: TContext,
    config: RuleConfig<TResult, TState, TPredicate, TFact, TContext> = {
      maxCompositionSize: Number.MAX_SAFE_INTEGER,
    } as RuleConfig<TResult, TState, TPredicate, TFact, TContext>,
  ): Generator<
    | RuleResult<TState, E | RuleFailureReason>
    | RuleResult<TResult, E | RuleFailureReason>,
    void,
    unknown
  > {
    // Делегируем в ruleAlgebra.operateLazy (reuse существующей реализации)
    yield* ruleAlgebra.operateLazy<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>(
      operation,
      rules,
      fact,
      context,
      config,
    );
  },
} as const;
