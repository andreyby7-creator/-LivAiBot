/**
 * @file @livai/core/rule-engine — Generic Predicate & Rule Operations
 *
 * Публичный API пакета rule-engine.
 * Экспортирует все публичные компоненты, типы и утилиты для generic операций с предикатами и правилами.
 */

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC PREDICATE RESULT & ALGEBRAIC CONTRACT
 * ========================================================================== */

/**
 * Типы для generic операций с предикатами.
 * Predicate для функций-предикатов, PredicateResult для effect-based API,
 * PredicateOperation для extensible contract.
 *
 * @public
 */

export {
  type Predicate,
  type PredicateConfig,
  type PredicateErrorMetadata,
  type PredicateFailureReason,
  type PredicateHooks,
  type PredicateOperation,
  type PredicateResult,
} from './predicate.js';

/* ============================================================================
 * 🔧 PREDICATE — GENERIC PREDICATE OPERATIONS
 * ========================================================================== */

/**
 * Predicate: generic функции для работы с предикатами.
 * Чистые функции без side-effects, только generic predicate operations.
 * Все функции возвращают PredicateResult для composability.
 *
 * @public
 */

export { predicate } from './predicate.js';

/* ============================================================================
 * 🧮 PREDICATE ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM PREDICATE OPERATIONS
 * ========================================================================== */

/**
 * Predicate Algebra: factory для создания custom predicate operations.
 * Позволяет создавать custom predicate compositions, evaluations, streaming operations
 * без изменения core логики.
 *
 * @public
 */

export { predicateAlgebra } from './predicate.js';

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC RULE RESULT & ALGEBRAIC CONTRACT
 * ========================================================================== */

/**
 * Типы для generic операций с правилами.
 * Rule для связывания предиката с результатом, RuleResult для effect-based API,
 * RuleOperation для extensible contract.
 *
 * @public
 */

export {
  isStepResult,
  type Rule,
  type RuleConfig,
  type RuleFailureReason,
  type RuleOperation,
  type RuleResult,
  type StepResult,
} from './rule.js';

/* ============================================================================
 * 🔧 RULE — GENERIC RULE OPERATIONS
 * ========================================================================== */

/**
 * Rule: generic функции для работы с правилами.
 * Чистые функции без side-effects, только generic rule operations.
 * Все функции возвращают RuleResult для composability.
 *
 * @public
 */

export { rule } from './rule.js';

/* ============================================================================
 * 🧮 RULE ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM RULE OPERATIONS
 * ========================================================================== */

/**
 * Rule Algebra: factory для создания custom rule operations.
 * Позволяет создавать custom rule compositions, evaluations, streaming operations
 * без изменения core логики.
 *
 * @public
 */

export { ruleAlgebra } from './rule.js';

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC EVALUATOR RESULT & ALGEBRAIC CONTRACT
 * ========================================================================== */

/**
 * Типы для generic операций с evaluator.
 * EvaluationMode для режимов оценки, EvaluationResult для effect-based API,
 * EvaluatorOperation для extensible contract.
 *
 * @public
 */

export {
  type EvaluationConfig,
  type EvaluationFailureReason,
  type EvaluationMode,
  type EvaluationResult,
  type EvaluatorOperation,
} from './evaluator.js';

/* ============================================================================
 * 🔧 EVALUATOR — GENERIC EVALUATOR OPERATIONS
 * ========================================================================== */

/**
 * Evaluator: generic функции для оценки правил.
 * Чистые функции без side-effects, только generic evaluator operations.
 * Все функции возвращают EvaluationResult для composability.
 *
 * @public
 */

export { evaluator } from './evaluator.js';

/* ============================================================================
 * 🧮 EVALUATOR ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM EVALUATOR OPERATIONS
 * ========================================================================== */

/**
 * Evaluator Algebra: factory для создания custom evaluator operations.
 * Позволяет создавать custom evaluator compositions, evaluations, streaming operations
 * без изменения core логики.
 *
 * @public
 */

export { evaluatorAlgebra } from './evaluator.js';
