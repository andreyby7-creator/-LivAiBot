/**
 * @file packages/domains/src/classification/context — Classification Context Builders
 *
 * Публичный API пакета context.
 * Экспортирует все публичные компоненты для построения контекстов classification domain.
 */

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION SLOT MAP
 * ============================================================================
 */

/**
 * Типы для slot-based pipeline архитектуры.
 * ClassificationSlotMap - определяет все слоты данных для classification pipeline.
 *
 * @public
 */
export type { ClassificationSlotMap } from './context-builders.js';

/* ============================================================================
 * 🔧 CONTEXT BUILDERS — PURE FUNCTIONS
 * ============================================================================
 */

/**
 * Pure functions для построения контекстов разных слоёв classification domain.
 * buildScoringContext - строит контекст для scoring (slot-based API)
 * buildRuleContext - строит контекст для rule evaluation (slot-based API)
 * buildAssessmentContext - строит контекст для assessment (slot-based API)
 *
 * @note Все функции используют slot-based API для интеграции в declarative pipeline
 * @public
 */
export {
  buildAssessmentContext,
  buildRuleContext,
  buildScoringContext,
} from './context-builders.js';
