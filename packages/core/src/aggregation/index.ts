/**
 * @file @livai/core/aggregation — Generic Aggregation Semantics
 * Публичный API пакета aggregation.
 * Экспортирует все публичные компоненты, типы и утилиты для generic агрегации значений.
 */

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC WEIGHTED VALUE & ALGEBRAIC RESULT
 * ========================================================================== */

/**
 * Типы для generic агрегации значений с весами.
 * WeightedValue для значений с весами, ReduceResult для effect-based API.
 * @public
 */

export {
  type AggregatorState,
  type NumericAggregator,
  type ReduceFailureReason,
  type ReduceResult,
  type WeightedValue,
  type WeightValidationConfig,
} from './reducer.js';
export {
  type ScoreFailureReason,
  type ScoreOperation,
  type ScoreResult,
  type ScoringConfig,
} from './scoring.js';
export {
  type NormalizationConfig,
  type WeightFailureReason,
  type WeightOperation,
  type WeightResult,
} from './weight.js';

/* ============================================================================
 * 🔢 REDUCER — GENERIC REDUCTION FUNCTIONS
 * ========================================================================== */

/**
 * Reducer: generic функции для редукции массивов значений.
 * Чистые функции без side-effects, только generic math.
 * Все функции возвращают ReduceResult для composability.
 * @public
 */

export { reducer } from './reducer.js';

/* ============================================================================
 * 🧮 REDUCER ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM AGGREGATORS
 * ========================================================================== */

/**
 * Reducer Algebra: factory для создания custom aggregators.
 * Позволяет создавать median, percentile, geometric mean, confidence aggregation
 * без изменения core логики.
 * @public
 */

export { reducerAlgebra } from './reducer.js';

/* ============================================================================
 * ⚖️ WEIGHT — GENERIC WEIGHT OPERATIONS
 * ========================================================================== */

/**
 * Weight: generic функции для работы с весами.
 * Чистые функции без side-effects, только generic math.
 * Все функции возвращают WeightResult для composability.
 * @public
 */

export { weight } from './weight.js';

/* ============================================================================
 * 🧮 WEIGHT ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM WEIGHT OPERATIONS
 * ========================================================================== */

/**
 * Weight Algebra: factory для создания custom weight operations.
 * Позволяет создавать weighted median, percentile weights, weight distribution
 * без изменения core логики.
 * @public
 */

export { weightAlgebra } from './weight.js';

/* ============================================================================
 * 🎯 SCORING — GENERIC SCORING OPERATIONS
 * ========================================================================== */

/**
 * Scoring: generic функции для scoring.
 * Чистые функции без side-effects, только generic math.
 * Все функции возвращают ScoreResult для composability.
 * @public
 */

export { scoring } from './scoring.js';

/* ============================================================================
 * 🧮 SCORE ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM SCORING OPERATIONS
 * ========================================================================== */

/**
 * Score Algebra: factory для создания custom scoring operations.
 * Позволяет создавать custom scoring strategies, score transformations
 * без изменения core логики.
 * @public
 */

export { scoreAlgebra } from './scoring.js';
