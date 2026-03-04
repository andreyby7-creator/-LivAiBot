/**
 * @file @livai/core/domain-kit — Domain Kit (Decision Algebra & Probability)
 * Публичный API пакета domain-kit.
 * Экспортирует все публичные компоненты, типы и утилиты для decision algebra и probability/uncertainty.
 */

/* ============================================================================
 * 🧩 ТИПЫ — STRICT BRANDED TYPES WITH PHANTOM GENERIC
 * ========================================================================== */

/**
 * Типы для evaluation level и scale.
 * Branded types с phantom generic для type safety между доменами.
 * Поддержка partial order через 'incomparable' в Ordering.
 * @public
 */

export type {
  AggregationMode,
  EvaluationLevel,
  EvaluationLevelFailureReason,
  EvaluationLevelOutcome,
  EvaluationOrder,
  EvaluationScale,
  EvaluationScaleOutcome,
  LatticeOrder,
  LatticeVerificationResult,
  NormalizedEvaluationLevel,
  Ordering,
} from './evaluation-level.js';

/* ============================================================================
 * 🏗️ EVALUATION LEVEL — VALUE OBJECT MODULE
 * ========================================================================== */

/**
 * Evaluation Level value object: создание, валидация, сериализация.
 * Создание evaluation level из числа с валидацией по scale.
 * Десериализация с проверкой scale fingerprint для защиты от forged levels.
 * @public
 */

export { evaluationLevel } from './evaluation-level.js';

/* ============================================================================
 * 📏 EVALUATION SCALE — SCALE FACTORY MODULE
 * ========================================================================== */

/**
 * Evaluation Scale factory: создание scale с opaque brand и runtime fingerprint.
 * Генерирует runtime fingerprint (scaleId) с semantic version.
 * Предотвращает semantic split-brain между версиями сервиса.
 * @public
 */

export { evaluationScale } from './evaluation-level.js';

/* ============================================================================
 * 🔢 EVALUATION ALGEBRA — ALGEBRA CONTRACT MODULE
 * ========================================================================== */

/**
 * Evaluation Algebra: контракты и presets для ordering.
 * Стандартные ordering (total order) и lattice ordering.
 * Preset для convenience, domain может определить свой ordering.
 * @public
 */

export { evaluationAlgebra } from './evaluation-level.js';

/* ============================================================================
 * 🧪 EVALUATION ALGEBRA DEV — DEV-ONLY TOOLS (TREE-SHAKEABLE)
 * ========================================================================== */

/**
 * Dev tools для проверки algebra laws (tree-shakeable).
 * Проверяет associativity, commutativity, idempotency, absorption.
 * Проверяет согласованность compare с join/meet.
 * Используется только в development/testing окружении.
 * @public
 */

export { evaluationAlgebraDev } from './evaluation-level.js';

/* ============================================================================
 * 🎯 EVALUATION AGGREGATION — AGGREGATION POLICIES MODULE
 * ========================================================================== */

/**
 * Evaluation Aggregation: опциональные aggregation strategies для rule engines.
 * Policy helpers, требуют LatticeOrder для корректной работы.
 * Поддерживает partial order через strict/lenient режимы.
 * Streaming aggregation step для rule engines.
 * @public
 */

export { evaluationAggregation } from './evaluation-level.js';

/* ============================================================================
 * 🎲 CONFIDENCE — PROBABILITY/UNCERTAINTY TYPES
 * ========================================================================== */

/**
 * Типы для confidence (probability/uncertainty).
 * Branded types с phantom generic для type safety между доменами.
 * Поддержка различных стратегий комбинирования через ConfidenceCombiner.
 * @public
 */

export type {
  Confidence,
  ConfidenceAggregationMode,
  ConfidenceCombiner,
  ConfidenceCombineResult,
  ConfidenceFailureReason,
  ConfidenceOutcome,
} from './confidence.js';

/* ============================================================================
 * 🎲 CONFIDENCE — VALUE OBJECT MODULE
 * ========================================================================== */

/**
 * Confidence value object: создание, валидация, сериализация.
 * Создание confidence из числа с валидацией диапазона (0..1).
 * Десериализация с проверкой для защиты от forged values.
 * @public
 */

export { confidence } from './confidence.js';

/* ============================================================================
 * 🔢 CONFIDENCE OPERATIONS — RUNTIME OPERATIONS MODULE
 * ========================================================================== */

/**
 * Confidence Operations: runtime операции комбинирования confidence значений.
 * Безопасное комбинирование с runtime валидацией.
 * Average и weighted average с Kahan summation для высокой точности.
 * @public
 */

export { confidenceOperations } from './confidence.js';

/* ============================================================================
 * 🏭 CONFIDENCE COMBINERS — COMBINER FACTORY MODULE
 * ========================================================================== */

/**
 * Confidence Combiners: factory для создания preset combiners.
 * Preset combiners для различных стратегий комбинирования (average, maximum, minimum, product, sum).
 * Chain combiner для pipeline комбинирования в больших rule-engine.
 * @public
 */

export { confidenceCombiners } from './confidence.js';

/* ============================================================================
 * 🏷️ LABEL — DOMAIN-SPECIFIC STRING LABELS TYPES
 * ============================================================================
 */

/**
 * Типы для label (domain-specific string labels).
 * Branded types с phantom generic для type safety между доменами.
 * Поддержка extensible validation через LabelValidator contract.
 * @public
 */

export type { Label, LabelFailureReason, LabelOutcome, LabelValidator } from './label.js';

/* ============================================================================
 * 🏷️ LABEL — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Label value object: создание, валидация, сериализация, type guards.
 * Создание label из строки с валидацией через LabelValidator.
 * Автоматическая нормализация (trim) для защиты от пробельных строк.
 * Десериализация с проверкой для защиты от forged labels.
 * @public
 */

export { label } from './label.js';

/* ============================================================================
 * 🏭 LABEL VALIDATORS — VALIDATOR FACTORY MODULE
 * ============================================================================
 */

/**
 * Label Validators: factory для создания preset validators.
 * Preset validators для различных стратегий валидации (whitelist, pattern, custom).
 * Кеширование validators для high-performance rule-engines.
 * @public
 */

export { labelValidators } from './label.js';
