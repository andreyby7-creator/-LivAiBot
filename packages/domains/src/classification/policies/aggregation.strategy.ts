/**
 * @file packages/domains/src/classification/policies/aggregation.strategy.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Aggregation Strategy (Core Algorithm)
 * ============================================================================
 * Архитектурная роль:
 * Чистое ядро агрегации risk score из нескольких источников сигналов.
 * Никаких policy-решений оркестрации: только deterministic aggregation algorithm.
 * Принципы:
 * - ✅ SRP: только aggregation strategy, без orchestration и IO
 * - ✅ Deterministic: стабильный порядок, tie-break по индексу источника
 * - ✅ Fail-safe (fail-closed): невалидные score/weight/confidence нормализуются в сторону более консервативного риска
 * - ✅ Domain-pure: без side-effects и скрытого coupling
 * - ✅ Extensible: generic payload/result metadata без изменения core-алгоритма
 */

import type { RiskLevel } from './base.policy.js';

/* ============================================================================
 * 🧩 TYPES — STRATEGY CONTRACT
 * ============================================================================
 */

/** Результат одного источника для участия в агрегации. */
export type AggregationSourceResult<TTriggeredRule, TEvidence> = Readonly<{
  /** Risk score источника (ожидается в диапазоне 0..100). */
  readonly riskScore: number;
  /** Сработавшие правила источника (используются для explainability). */
  readonly triggeredRules: readonly TTriggeredRule[];
  /** Уверенность источника (0..1). Если не задана, используется 1. */
  readonly confidence?: number;
  /** Дополнительный payload источника (передается через dominant source). */
  readonly evidence?: TEvidence;
}>;

/** Источник для агрегации. */
export type AggregationSource<TTriggeredRule, TEvidence> = Readonly<{
  readonly result: AggregationSourceResult<TTriggeredRule, TEvidence>;
  /** Базовый вес источника. Нормативный диапазон: 0..1 (значения вне диапазона принудительно нормализуются). */
  readonly weight: number;
  /** Признак fail-closed источника: приоритетно доминирует при наличии. */
  readonly isFailClosed: boolean;
}>;

/** Конфигурация порогов определения risk level по итоговому score. */
export type AggregationThresholds = Readonly<{
  readonly mediumFrom: number;
  readonly highFrom: number;
  readonly criticalFrom: number;
}>;

/** Результат работы aggregation strategy. */
export type AggregatedRisk<TTriggeredRule, TEvidence> = Readonly<{
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  /** Правила объединяются конкатенацией (дубликаты сохраняются намеренно для explainability по источникам). */
  readonly triggeredRules: readonly TTriggeredRule[];
  /** Индекс источника, чье состояние использовано как dominant. */
  readonly dominantSourceIndex: number;
  /** Payload доминирующего источника (если был задан). */
  readonly evidence?: TEvidence;
}>;

/* ============================================================================
 * 🔧 CONSTANTS — DEFAULTS
 * ============================================================================
 */

const DEFAULT_THRESHOLDS: AggregationThresholds = Object.freeze({
  mediumFrom: 40,
  highFrom: 60,
  criticalFrom: 80,
});

// Aggregation intentionally fail-closed: fallback всегда консервативный (critical risk).
const FALLBACK_SCORE = 100;

/* ============================================================================
 * 🔧 INTERNAL HELPERS — VALIDATION & NORMALIZATION
 * ============================================================================
 */

/** Нормализует score в диапазон 0..100; невалидные числа переводит в fail-closed fallback. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return FALLBACK_SCORE;
  }
  return Math.min(100, Math.max(0, score));
}

function normalizeWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    // Невалидный вес не должен усиливать источник: деградируем в 0 (ignored by aggregation).
    // Diagnostics/invariant enforcement ожидаются на orchestration/policy layer.
    return 0;
  }
  // Для консервативного поведения ограничиваем вклад источника в диапазон 0..1.
  return Math.min(1, Math.max(0, weight));
}

/** Нормализует confidence в диапазон 0..1; `undefined` трактуется как нейтральное доверие `1`. */
function normalizeConfidence(confidence: number | undefined): number {
  if (confidence === undefined || !Number.isFinite(confidence)) {
    return 1;
  }
  return Math.min(1, Math.max(0, confidence));
}

function isThresholdsValid(thresholds: AggregationThresholds): boolean {
  return (
    thresholds.mediumFrom >= 0
    && thresholds.mediumFrom <= 100
    && thresholds.highFrom >= 0
    && thresholds.highFrom <= 100
    && thresholds.criticalFrom >= 0
    && thresholds.criticalFrom <= 100
    && thresholds.mediumFrom <= thresholds.highFrom
    && thresholds.highFrom <= thresholds.criticalFrom
  );
}

function toRiskLevel(score: number, thresholds: AggregationThresholds): RiskLevel {
  if (score >= thresholds.criticalFrom) {
    return 'critical';
  }
  if (score >= thresholds.highFrom) {
    return 'high';
  }
  if (score >= thresholds.mediumFrom) {
    return 'medium';
  }
  return 'low';
}

/** Возвращает индекс источника с максимальным score (при равенстве — первый, для детерминизма). */
function findMaxRiskIndex<TTriggeredRule, TEvidence>(
  sources: readonly AggregationSource<TTriggeredRule, TEvidence>[],
): number {
  return sources.reduce((bestIndex, current, index, all) => {
    if (bestIndex === -1) {
      return index;
    }
    const bestScore = clampScore(all[bestIndex]?.result.riskScore ?? FALLBACK_SCORE);
    const currentScore = clampScore(current.result.riskScore);
    // При равенстве оставляем более ранний индекс, чтобы сохранить детерминизм.
    return currentScore > bestScore ? index : bestIndex;
  }, -1);
}

/** Считает confidence-weighted score; при нулевом суммарном весе возвращает fail-closed fallback. */
function calculateWeightedScore<TTriggeredRule, TEvidence>(
  sources: readonly AggregationSource<TTriggeredRule, TEvidence>[],
): number {
  const totals = sources.reduce(
    (acc, source) => {
      const score = clampScore(source.result.riskScore);
      const weight = normalizeWeight(source.weight);
      const confidence = normalizeConfidence(source.result.confidence);
      const effectiveWeight = weight * confidence;
      return {
        weightedScore: acc.weightedScore + score * effectiveWeight,
        totalWeight: acc.totalWeight + effectiveWeight,
      };
    },
    { weightedScore: 0, totalWeight: 0 },
  );

  if (totals.totalWeight <= 0) {
    return FALLBACK_SCORE;
  }
  return clampScore(Math.round(totals.weightedScore / totals.totalWeight));
}

/* ============================================================================
 * 🎯 API — AGGREGATION STRATEGY
 * ============================================================================
 */

/**
 * Агрегирует risk из множества источников.
 * Правила:
 * - при пустом входе возвращает fail-safe critical fallback;
 * - если есть fail-closed источники, доминирует max risk среди fail-closed;
 * - иначе используется confidence-weighted aggregation.
 */
export function aggregateRiskSources<TTriggeredRule, TEvidence>(
  sources: readonly AggregationSource<TTriggeredRule, TEvidence>[],
  thresholds: AggregationThresholds = DEFAULT_THRESHOLDS,
): AggregatedRisk<TTriggeredRule, TEvidence> {
  if (sources.length === 0) {
    return Object.freeze({
      riskScore: FALLBACK_SCORE,
      riskLevel: 'critical',
      triggeredRules: Object.freeze([]) as readonly TTriggeredRule[],
      dominantSourceIndex: -1,
    });
  }

  // Fail-safe для misconfigured thresholds: используем стабильный доменный default.
  const safeThresholds = isThresholdsValid(thresholds) ? thresholds : DEFAULT_THRESHOLDS;
  const failClosedSources = sources
    .map((source, sourceIndex) => ({ source, sourceIndex }))
    .filter((entry) => entry.source.isFailClosed);

  if (failClosedSources.length > 0) {
    // Tie-break: при равном riskScore сохраняем первый встреченный fail-closed источник.
    const dominantIndexWithinFailClosed = findMaxRiskIndex(
      failClosedSources.map((entry) => entry.source),
    );
    const dominantFailClosedEntry = failClosedSources[dominantIndexWithinFailClosed];
    const dominantFailClosed = dominantFailClosedEntry?.source;
    const riskScore = clampScore(dominantFailClosed?.result.riskScore ?? FALLBACK_SCORE);
    const riskLevel = toRiskLevel(riskScore, safeThresholds);
    return Object.freeze({
      riskScore,
      riskLevel,
      triggeredRules: Object.freeze([...(dominantFailClosed?.result.triggeredRules ?? [])]),
      dominantSourceIndex: dominantFailClosedEntry?.sourceIndex ?? -1,
      ...(dominantFailClosed?.result.evidence !== undefined && {
        evidence: dominantFailClosed.result.evidence,
      }),
    });
  }

  const aggregatedScore = calculateWeightedScore(sources);
  const riskLevel = toRiskLevel(aggregatedScore, safeThresholds);
  const dominantSourceIndex = findMaxRiskIndex(sources);
  const dominantSource = dominantSourceIndex >= 0 ? sources[dominantSourceIndex] : undefined;
  const triggeredRules = Object.freeze(sources.flatMap((source) => source.result.triggeredRules));

  return Object.freeze({
    riskScore: aggregatedScore,
    riskLevel,
    triggeredRules,
    dominantSourceIndex,
    ...(dominantSource?.result.evidence !== undefined && {
      evidence: dominantSource.result.evidence,
    }),
  });
}
