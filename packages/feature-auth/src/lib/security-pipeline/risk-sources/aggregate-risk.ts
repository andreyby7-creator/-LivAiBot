/**
 * @file packages/feature-auth/src/lib/security-pipeline/risk-sources/aggregate-risk.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Sources (Aggregation)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Агрегация результатов из множественных источников риска
 * - Причина изменения: multi-source risk aggregation logic
 *
 * Принципы:
 * - ✅ Max risk wins — максимальный риск побеждает
 * - ✅ Confidence weighting — взвешивание по уверенности
 * - ✅ Fail-closed dominance — fail-closed источники доминируют
 */

import type { RemoteRiskResult } from './remote-provider.source.js';
import type { RiskAssessmentResult } from '../../../types/risk.js';

/**
 * Результат агрегации рисков из множественных источников
 */
export type AggregatedRiskResult = RiskAssessmentResult;

/**
 * Источник риска для агрегации
 */
export type RiskSource = {
  /** Результат оценки риска */
  readonly result: RiskAssessmentResult | RemoteRiskResult;
  /** Вес источника (0-1) */
  readonly weight: number;
  /** Является ли источник fail-closed (критическим) */
  readonly isFailClosed: boolean;
};

/**
 * Возвращает fallback результат при отсутствии источников
 */
function createFallbackResult(): AggregatedRiskResult {
  return {
    riskScore: 100,
    riskLevel: 'critical',
    triggeredRules: [],
    decisionHint: {
      action: 'block',
      blockReason: 'critical_risk',
    },
    assessment: {
      device: {
        deviceId: 'unknown',
        platform: 'web',
      },
    },
  };
}

/**
 * Обрабатывает fail-closed источники (доминируют)
 */
function handleFailClosedSources(failClosedSources: readonly RiskSource[]): AggregatedRiskResult {
  const firstFailClosed = failClosedSources[0];
  if (firstFailClosed === undefined) {
    throw new Error('[aggregate-risk] failClosedSources is empty after filter');
  }
  const maxFailClosedRisk = failClosedSources.reduce((max, source) => {
    return source.result.riskScore > max.result.riskScore ? source : max;
  }, firstFailClosed);
  return maxFailClosedRisk.result;
}

/**
 * Вычисляет взвешенный score из источников
 */
function calculateWeightedScore(sources: readonly RiskSource[]): number {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const source of sources) {
    // Валидация: NaN или невалидный score → fail-closed
    if (!Number.isFinite(source.result.riskScore)) {
      return 100; // Critical risk для NaN/Infinity
    }

    const confidence = 'confidence' in source.result ? source.result.confidence : 1.0;
    const effectiveWeight = source.weight * confidence;
    weightedScore += source.result.riskScore * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  const result = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 100;
  // Валидация результата: NaN → critical
  return Number.isFinite(result) ? result : 100;
}

/**
 * Определяет уровень риска на основе score
 */
function determineRiskLevel(score: number): RiskAssessmentResult['riskLevel'] {
  const CRITICAL_THRESHOLD = 80;
  const HIGH_THRESHOLD = 60;
  const MEDIUM_THRESHOLD = 40;

  if (score >= CRITICAL_THRESHOLD) return 'critical';
  if (score >= HIGH_THRESHOLD) return 'high';
  if (score >= MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Агрегирует результаты из множественных источников риска
 * @note Max risk wins: максимальный риск побеждает
 * @note Confidence weighting: взвешивание по уверенности источников
 * @note Fail-closed dominance: fail-closed источники доминируют
 */
export function aggregateRisks(sources: readonly RiskSource[]): AggregatedRiskResult {
  if (sources.length === 0) {
    return createFallbackResult();
  }

  // Проверяем fail-closed источники (доминируют)
  const failClosedSources = sources.filter((s) => s.isFailClosed);
  if (failClosedSources.length > 0) {
    return handleFailClosedSources(failClosedSources);
  }

  // Валидация: проверяем на NaN в источниках перед агрегацией
  const hasInvalidScore = sources.some((s) => !Number.isFinite(s.result.riskScore));
  if (hasInvalidScore) {
    return createFallbackResult(); // Critical risk для NaN
  }

  // Взвешенная агрегация по confidence и weight
  const aggregatedScore = calculateWeightedScore(sources);
  const aggregatedScoreClamped = Math.max(0, Math.min(100, aggregatedScore));

  // Валидация результата агрегации
  if (!Number.isFinite(aggregatedScoreClamped)) {
    return createFallbackResult(); // Critical risk для NaN результата
  }

  // Определяем risk level на основе агрегированного score
  const riskLevel = determineRiskLevel(aggregatedScoreClamped);

  // Находим источник с максимальным риском для decision hint и assessment
  const firstSource = sources[0];
  if (firstSource === undefined) {
    throw new Error('[aggregate-risk] sources is empty');
  }
  const maxRiskSource = sources.reduce((max, source) => {
    return source.result.riskScore > max.result.riskScore ? source : max;
  }, firstSource);

  // Объединяем triggered rules из всех источников
  const allTriggeredRules = sources.flatMap((s) => s.result.triggeredRules);

  return {
    riskScore: aggregatedScoreClamped,
    riskLevel,
    triggeredRules: allTriggeredRules,
    decisionHint: maxRiskSource.result.decisionHint,
    assessment: maxRiskSource.result.assessment,
  };
}
