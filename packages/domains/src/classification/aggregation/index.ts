/**
 * @file packages/domains/src/classification/aggregation — Classification Aggregation
 *
 * Публичный API пакета aggregation.
 * Экспортирует все публичные компоненты, типы и утилиты для classification risk scoring и weights.
 */

/* ============================================================================
 * 🧩 ТИПЫ — RISK FACTOR & WEIGHTS TYPES
 * ============================================================================
 */

/**
 * Типы для risk factors, weights и scoring context.
 * RiskFactor - registry-style архитектура для динамического добавления факторов.
 * RiskWeights - legacy конфигурация весов для обратной совместимости.
 * ScoringContext - контекст для scoring (device, geo, ip, signals, config).
 *
 * @public
 */
export type { RiskFactor, RiskWeights, ScoringContext } from './scoring.js';

/* ============================================================================
 * 📋 КОНСТАНТЫ — DEFAULT WEIGHTS
 * ============================================================================
 */

/**
 * Дефолтные веса для scoring (сумма = 1.0).
 * Используются, если weights не указаны в policy.
 * Immutable: защищены от мутаций через Object.freeze.
 * Deterministic: константа гарантирует детерминированный scoring.
 *
 * @public
 */
export { defaultRiskWeights } from './scoring.js';

/* ============================================================================
 * 🔧 ФУНКЦИИ — SCORING & VALIDATION
 * ============================================================================
 */

/**
 * Функции для расчета risk score и валидации.
 * calculateRiskScore - рассчитывает risk score используя legacy RiskWeights (обратная совместимость).
 * calculateRiskScoreWithCustomFactors - рассчитывает risk score используя registry-style факторы (extensibility).
 * validateRiskWeights - валидирует risk weights (сумма должна быть близка к 1.0, каждый вес в диапазоне 0.0-1.0).
 *
 * @public
 */
export {
  calculateRiskScore,
  calculateRiskScoreWithCustomFactors,
  validateRiskWeights,
} from './scoring.js';
