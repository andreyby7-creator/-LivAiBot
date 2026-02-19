/**
 * @file @livai/domains/classification/evaluation — Classification Evaluation Result
 *
 * Публичный API пакета classification evaluation.
 * Экспортирует все публичные компоненты, типы для classification evaluation result и assessment logic.
 */

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION EVALUATION RESULT TYPES
 * ============================================================================
 */

/**
 * Типы для classification evaluation result.
 * ClassificationEvaluationResult - результат оценки классификации с evaluationLevel, confidence, label, scale.
 * Использует generic типы из @livai/core/domain-kit для type safety между доменами.
 * Строгая типизация usedSignals через keyof ClassificationSignals для предотвращения drift.
 *
 * @public
 */

export type { ClassificationEvaluationResult } from './result.js';

/* ============================================================================
 * 🧩 ТИПЫ — ASSESSMENT TYPES
 * ============================================================================
 */

/**
 * Типы для assessment logic.
 * AssessmentContext - контекст для assessment logic, содержащий deviceInfo, context, riskScore и rule evaluation result.
 * AssessmentContextBuilderPlugin - плагин для расширения assessment context.
 * BuildAssessmentContextOptions - опции для сборки assessment context.
 *
 * @public
 */

export type {
  AssessmentContext,
  AssessmentContextBuilderPlugin,
  BuildAssessmentContextOptions,
} from './assessment.js';

/* ============================================================================
 * 🔧 ФУНКЦИИ — ASSESSMENT FUNCTIONS
 * ============================================================================
 */

/**
 * Функции для assessment logic.
 * buildAssessmentContextWithPlugins - собирает assessment context с применением плагинов.
 * assembleAssessmentResultFromContext - собирает финальный assessment result из assessment context.
 *
 * @public
 */

export {
  assembleAssessmentResultFromContext,
  buildAssessmentContextWithPlugins,
} from './assessment.js';
