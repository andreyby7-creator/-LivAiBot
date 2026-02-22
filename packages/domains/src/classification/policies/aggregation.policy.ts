/**
 * @file packages/domains/src/classification/policies/aggregation.policy.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Aggregation Policy (Strategy Orchestration Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * Policy-слой для выбора и конфигурации алгоритма агрегации рисков
 * (`max_risk_wins` / `confidence_weighted` / `fail_closed_dominance`).
 * Делегирует вычисления в `aggregation.strategy.ts`, не дублируя core-алгоритм.
 *
 * Принципы:
 * - ✅ SRP: только policy orchestration (strategy selection + weight overrides)
 * - ✅ Deterministic: стабильный dispatch и порядок применения source weights
 * - ✅ Fail-safe: невалидная policy конфигурация откатывается к default policy
 * - ✅ Domain-pure: без IO, логирования и внешних side-effects
 * - ✅ Extensible: добавление новых стратегий через union без изменения strategy ядра
 */

import type {
  AggregatedRisk,
  AggregationSource,
  AggregationThresholds,
} from './aggregation.strategy.js';
import { aggregateRiskSources } from './aggregation.strategy.js';

/* ============================================================================
 * 🧩 TYPES — POLICY CONTRACT
 * ============================================================================
 */

/** Поддерживаемые стратегии policy-слоя агрегации. */
export type AggregationPolicyStrategy =
  | 'max_risk_wins'
  | 'confidence_weighted'
  | 'fail_closed_dominance';

/** Конфигурация веса для конкретного источника. */
export type SourceWeightOverride<TSourceId extends string> = Readonly<{
  readonly sourceId: TSourceId;
  readonly weight: number;
}>;

/** Источник policy-слоя: sourceId + source для strategy-ядра. */
export type PolicyAggregationSource<
  TSourceId extends string,
  TTriggeredRule,
  TEvidence,
> = Readonly<{
  readonly sourceId: TSourceId;
  readonly source: AggregationSource<TTriggeredRule, TEvidence>;
}>;

/** Конфигурация policy-слоя агрегации. */
export type AggregationPolicy<TSourceId extends string> = Readonly<{
  readonly strategy: AggregationPolicyStrategy;
  readonly thresholds?: AggregationThresholds;
  /** Weight override применяется как multiplier к базовому source.weight. */
  readonly sourceWeights?: readonly SourceWeightOverride<TSourceId>[];
  /**
   * Для `fail_closed_dominance`:
   * если fail-closed источников нет и max risk >= mediumRiskCutoff, используем max_risk_wins.
   * иначе confidence_weighted.
   */
  readonly mediumRiskCutoff?: number;
}>;

/* ============================================================================
 * 🔧 CONSTANTS — DEFAULT POLICY
 * ============================================================================
 */

const DEFAULT_THRESHOLDS: AggregationThresholds = Object.freeze({
  mediumFrom: 40,
  highFrom: 60,
  criticalFrom: 80,
});

/** Базовая policy для агрегации classification risk. */
export const defaultAggregationPolicy: AggregationPolicy<string> = Object.freeze({
  strategy: 'fail_closed_dominance',
  thresholds: DEFAULT_THRESHOLDS,
  sourceWeights: Object.freeze([]),
  mediumRiskCutoff: DEFAULT_THRESHOLDS.mediumFrom,
});
const DEFAULT_MEDIUM_RISK_CUTOFF = defaultAggregationPolicy.mediumRiskCutoff
  ?? DEFAULT_THRESHOLDS.mediumFrom;

/* ============================================================================
 * 🔧 INTERNAL HELPERS — VALIDATION & POLICY APPLICATION
 * ============================================================================
 */

/** Нормализует cutoff в диапазон 0..100; при невалидном значении использует policy default. */
function normalizeCutoff(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MEDIUM_RISK_CUTOFF;
  }
  return Math.min(100, Math.max(0, value));
}

/** Нормализует risk score в диапазон 0..100; невалидные значения переводит в fail-closed 100. */
function normalizeRiskScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 100;
  }
  return Math.min(100, Math.max(0, score));
}

function isPolicyValid<TSourceId extends string>(
  policy: AggregationPolicy<TSourceId>,
): boolean {
  const cutoff = policy.mediumRiskCutoff;
  if (cutoff !== undefined && !Number.isFinite(cutoff)) {
    return false;
  }
  const sourceWeights = policy.sourceWeights ?? [];
  return sourceWeights.every((entry) =>
    Number.isFinite(entry.weight)
    && entry.weight >= 0
  );
}

function resolveWeightOverride<TSourceId extends string>(
  sourceId: TSourceId,
  overrides: readonly SourceWeightOverride<TSourceId>[],
): number {
  const found = overrides.find((entry) => entry.sourceId === sourceId);
  if (found === undefined || !Number.isFinite(found.weight)) {
    return 1;
  }
  return Math.min(1, Math.max(0, found.weight));
}

function applyWeightOverrides<TSourceId extends string, TTriggeredRule, TEvidence>(
  sources: readonly PolicyAggregationSource<TSourceId, TTriggeredRule, TEvidence>[],
  overrides: readonly SourceWeightOverride<TSourceId>[],
): readonly AggregationSource<TTriggeredRule, TEvidence>[] {
  return Object.freeze(
    sources.map((entry) => {
      const multiplier = resolveWeightOverride(entry.sourceId, overrides);
      return Object.freeze({
        ...entry.source,
        weight: entry.source.weight * multiplier,
      });
    }),
  );
}

function pickMaxRiskSource<TTriggeredRule, TEvidence>(
  sources: readonly AggregationSource<TTriggeredRule, TEvidence>[],
): AggregationSource<TTriggeredRule, TEvidence> | null {
  if (sources.length === 0) {
    return null;
  }
  const first = sources[0];
  if (first === undefined) {
    return null;
  }
  return sources.reduce((best, current) => {
    const bestScore = normalizeRiskScore(best.result.riskScore);
    const currentScore = normalizeRiskScore(current.result.riskScore);
    return currentScore > bestScore ? current : best;
  }, first);
}

function runMaxRiskWins<TTriggeredRule, TEvidence>(
  sources: readonly AggregationSource<TTriggeredRule, TEvidence>[],
  thresholds: AggregationThresholds,
): AggregatedRisk<TTriggeredRule, TEvidence> {
  const maxSource = pickMaxRiskSource(sources);
  if (maxSource === null) {
    return aggregateRiskSources([], thresholds);
  }
  return aggregateRiskSources([maxSource], thresholds);
}

function runFailClosedDominance<TTriggeredRule, TEvidence>(
  sources: readonly AggregationSource<TTriggeredRule, TEvidence>[],
  thresholds: AggregationThresholds,
  mediumRiskCutoff: number,
): AggregatedRisk<TTriggeredRule, TEvidence> {
  const hasFailClosed = sources.some((source) => source.isFailClosed);
  if (hasFailClosed) {
    return aggregateRiskSources(sources, thresholds);
  }
  const maxSource = pickMaxRiskSource(sources);
  if (maxSource === null) {
    return aggregateRiskSources([], thresholds);
  }
  const normalizedMaxScore = normalizeRiskScore(maxSource.result.riskScore);
  if (normalizedMaxScore >= mediumRiskCutoff) {
    return aggregateRiskSources([maxSource], thresholds);
  }
  return aggregateRiskSources(sources, thresholds);
}

/* ============================================================================
 * 🎯 API — POLICY ENTRYPOINT
 * ============================================================================
 */

/**
 * Применяет policy агрегации к источникам риска.
 * Policy управляет только выбором стратегии и weight-override, а вычисления делегируются strategy-ядру.
 */
export function applyAggregationPolicy<TSourceId extends string, TTriggeredRule, TEvidence>(
  sources: readonly PolicyAggregationSource<TSourceId, TTriggeredRule, TEvidence>[],
  policy: AggregationPolicy<TSourceId> = defaultAggregationPolicy as AggregationPolicy<TSourceId>,
): AggregatedRisk<TTriggeredRule, TEvidence> {
  const safePolicy = isPolicyValid(policy)
    ? policy
    : (defaultAggregationPolicy as AggregationPolicy<TSourceId>);
  const thresholds = safePolicy.thresholds ?? DEFAULT_THRESHOLDS;
  const weightedSources = applyWeightOverrides(sources, safePolicy.sourceWeights ?? []);

  switch (safePolicy.strategy) {
    case 'max_risk_wins':
      return runMaxRiskWins(weightedSources, thresholds);
    case 'confidence_weighted':
      return aggregateRiskSources(weightedSources, thresholds);
    case 'fail_closed_dominance':
      return runFailClosedDominance(
        weightedSources,
        thresholds,
        normalizeCutoff(safePolicy.mediumRiskCutoff),
      );
    default: {
      const exhaustive: never = safePolicy.strategy;
      return exhaustive;
    }
  }
}
