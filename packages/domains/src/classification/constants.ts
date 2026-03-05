/**
 * @file packages/domains/src/classification/constants.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Domain Constants (Single Source of Truth)
 * ============================================================================
 * Общие константы для classification domain.
 * Single source of truth для валидационных границ и инвариантов.
 * Принципы:
 * - ✅ Single source of truth: предотвращает расхождение констант между модулями
 * - ✅ Immutable: Object.freeze для защиты от мутаций
 * - ✅ Type-safe: as const для strict typing
 * - ✅ Domain-pure: только domain-specific константы
 */

/* ============================================================================
 * 📋 КОНСТАНТЫ — VALIDATION BOUNDARIES
 * ============================================================================
 */

/**
 * Валидационные границы для геолокации (WGS84)
 * Single source of truth для всех модулей classification domain
 * @public
 */
export const GEO_VALIDATION = Object.freeze(
  {
    /** Минимальная широта (WGS84) */
    MIN_LAT: -90,
    /** Максимальная широта (WGS84) */
    MAX_LAT: 90,
    /** Минимальная долгота (WGS84) */
    MIN_LNG: -180,
    /** Максимальная долгота (WGS84) */
    MAX_LNG: 180,
  } as const,
);

/**
 * Валидационные границы для scores (reputation, velocity)
 * Single source of truth для всех модулей classification domain
 * @public
 */
export const SCORE_VALIDATION = Object.freeze(
  {
    /** Минимальный score */
    MIN_SCORE: 0,
    /** Максимальный score */
    MAX_SCORE: 100,
  } as const,
);

/* ============================================================================
 * 📋 КОНСТАНТЫ — EVALUATION SCALE
 * ============================================================================
 */

import type { EvaluationScale } from '@livai/core';
import { evaluationScale } from '@livai/core';

/**
 * Evaluation scale для classification domain
 * Диапазон: 0-100 (0 = безопасно, 100 = опасно)
 * Semantic version: 1.0.0
 * Single source of truth для всех модулей classification domain
 * Мемоизируется один раз при загрузке модуля
 * @public
 */
const CLASSIFICATION_SCALE_RESULT = evaluationScale.create(0, 100, 'classification', '1.0.0');

if (!CLASSIFICATION_SCALE_RESULT.ok) {
  // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации
  throw new Error(`Failed to create classification scale: ${CLASSIFICATION_SCALE_RESULT.reason}`);
}

export const CLASSIFICATION_EVALUATION_SCALE: EvaluationScale<'classification'> =
  CLASSIFICATION_SCALE_RESULT.value;
