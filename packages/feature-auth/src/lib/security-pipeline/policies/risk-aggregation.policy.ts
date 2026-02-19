/**
 * @file packages/feature-auth/src/lib/security-pipeline/policies/risk-aggregation.policy.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Aggregation Policy
 * ============================================================================
 *
 * Архитектурная роль:
 * - Политика агрегации рисков из множественных источников
 * - Причина изменения: aggregation policy changes
 *
 * Принципы:
 * - ✅ Max risk wins — максимальный риск побеждает
 * - ✅ Confidence weighting — взвешивание по уверенности
 * - ✅ Fail-closed dominance — fail-closed источники доминируют
 */

import type { RiskAssessmentResult } from '../../../types/risk.js';
import { aggregateRisks } from '../risk-sources/aggregate-risk.js';
import type { RiskSource } from '../risk-sources/aggregate-risk.js';

/**
 * Политика агрегации рисков
 */
export type AggregationPolicy = {
  /** Стратегия агрегации */
  readonly strategy: 'max_risk_wins' | 'confidence_weighted' | 'fail_closed_dominance';
  /** Веса источников (по умолчанию равные) */
  readonly sourceWeights?: Readonly<Record<string, number>>;
};

/**
 * Дефолтная политика агрегации
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Constant for default aggregation policy
export const DEFAULT_AGGREGATION_POLICY: AggregationPolicy = {
  strategy: 'fail_closed_dominance',
  sourceWeights: {
    local_rules: 0.6,
    remote_provider: 0.4,
  },
};

/**
 * Применяет политику агрегации к источникам риска
 * @note Max risk wins: максимальный риск побеждает
 * @note Confidence weighting: взвешивание по уверенности
 * @note Fail-closed dominance: fail-closed источники доминируют
 */
export function applyAggregationPolicy(
  sources: readonly RiskSource[],
  policy: AggregationPolicy = DEFAULT_AGGREGATION_POLICY,
): RiskAssessmentResult {
  // Применяем веса из политики
  const weightedSources: RiskSource[] = sources.map((source) => {
    const sourceName = 'source' in source.result ? source.result.source : 'local_rules';
    // eslint-disable-next-line security/detect-object-injection -- sourceName контролируется из типов (union type), безопасно
    const policyWeight = policy.sourceWeights?.[sourceName] ?? 1.0;
    return {
      ...source,
      weight: source.weight * policyWeight,
    };
  });

  // Применяем стратегию агрегации
  switch (policy.strategy) {
    case 'max_risk_wins': {
      // Максимальный риск побеждает
      const firstSource = weightedSources[0];
      if (firstSource === undefined) {
        throw new Error('[aggregation-policy] weightedSources is empty');
      }
      const maxRiskSource = weightedSources.reduce((max, source) => {
        return source.result.riskScore > max.result.riskScore ? source : max;
      }, firstSource);
      return maxRiskSource.result;
    }

    case 'confidence_weighted': {
      // Взвешенная агрегация по confidence
      return aggregateRisks(weightedSources);
    }

    case 'fail_closed_dominance': {
      // Fail-closed доминирует, иначе max risk wins для высоких рисков
      const failClosedSources = weightedSources.filter((s) => s.isFailClosed);
      if (failClosedSources.length > 0) {
        return aggregateRisks(weightedSources);
      }

      // Max risk wins: если максимальный риск >= medium threshold, используем его
      const MEDIUM_RISK_THRESHOLD = 40;
      const firstSource = weightedSources[0];
      if (firstSource === undefined) {
        throw new Error('[aggregation-policy] weightedSources is empty');
      }
      const maxRiskSource = weightedSources.reduce((max, source) => {
        return source.result.riskScore > max.result.riskScore ? source : max;
      }, firstSource);

      // Если максимальный риск >= medium threshold, используем max risk wins
      if (maxRiskSource.result.riskScore >= MEDIUM_RISK_THRESHOLD) {
        return maxRiskSource.result;
      }

      // Иначе взвешенная агрегация
      return aggregateRisks(weightedSources);
    }

    default: {
      // Fallback: используем общую агрегацию
      return aggregateRisks(weightedSources);
    }
  }
}
