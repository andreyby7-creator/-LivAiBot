/**
 * @file packages/domains/src/classification/policies — Classification Policies
 *
 * Публичный API пакета policies.
 * Экспортирует типы и функции для decision/aggregation policy classification domain.
 */

/* ============================================================================
 * 🧩 ТИПЫ — BASE POLICY TYPES
 * ============================================================================
 */

/**
 * Типы базовой policy принятия решения:
 * risk levels, thresholds, decision signals и decision policy contract.
 *
 * @public
 */
export type { DecisionPolicy, DecisionSignals, RiskLevel, RiskThresholds } from './base.policy.js';

/* ============================================================================
 * 🧩 ТИПЫ — AGGREGATION STRATEGY & POLICY TYPES
 * ============================================================================
 */

/**
 * Типы aggregation strategy/policy:
 * источники, результаты агрегации, thresholds и policy-конфигурация стратегий.
 *
 * @public
 */
export type {
  AggregationPolicy,
  AggregationPolicyStrategy,
  PolicyAggregationSource,
  SourceWeightOverride,
} from './aggregation.policy.js';
export type {
  AggregatedRisk,
  AggregationSource,
  AggregationSourceResult,
  AggregationThresholds,
} from './aggregation.strategy.js';

/* ============================================================================
 * 📋 КОНСТАНТЫ — DEFAULT POLICIES
 * ============================================================================
 */

/**
 * Дефолтные конфигурации policy-слоя classification.
 *
 * @public
 */
export { defaultAggregationPolicy } from './aggregation.policy.js';
export { defaultDecisionPolicy } from './base.policy.js';

/* ============================================================================
 * 🔧 ФУНКЦИИ — POLICY API
 * ============================================================================
 */

/**
 * Функции policy-слоя:
 * - decision policy (`determineRiskLevel`, `determineLabel`)
 * - aggregation policy/strategy (`applyAggregationPolicy`, `aggregateRiskSources`)
 *
 * @public
 */
export { applyAggregationPolicy } from './aggregation.policy.js';
export { determineLabel, determineRiskLevel } from './base.policy.js';
export { aggregateRiskSources } from './aggregation.strategy.js';
