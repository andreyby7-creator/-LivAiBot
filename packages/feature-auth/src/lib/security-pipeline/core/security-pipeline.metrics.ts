/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.metrics.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Metrics & Disagreement Dashboard)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Метрики для анализа расхождений между v1 и v2
 * - Disagreement dashboard для мониторинга rollout
 * - Причина изменения: observability / rollout strategy changes
 *
 * Принципы:
 * - ✅ Агрегация метрик — накопление статистики
 * - ✅ Disagreement tracking — отслеживание расхождений v1 vs v2
 * - ✅ Safety-first — фокус на критических метриках (v2 weaker than v1)
 * - ✅ Time-series ready — метрики готовы для time-series DB
 */

import type { RiskAssessmentResult } from '../../../types/risk.js';
import type { SecurityPipelineContext } from '../security-pipeline.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Тип расхождения между v1 и v2
 */
export type DisagreementType = 'v2_stricter' | 'v2_weaker' | 'exact_match';

/**
 * Метрика расхождения между v1 и v2
 */
export type DisagreementMetric = {
  /** Тип расхождения */
  readonly type: DisagreementType;
  /** Risk level v1 */
  readonly v1RiskLevel: RiskAssessmentResult['riskLevel'];
  /** Risk level v2 */
  readonly v2RiskLevel: RiskAssessmentResult['riskLevel'];
  /** Risk score v1 */
  readonly v1RiskScore: number;
  /** Risk score v2 */
  readonly v2RiskScore: number;
  /** Разница в risk score */
  readonly scoreDelta: number;
  /** Timestamp события */
  readonly timestamp: number;
  /** Контекст события (для debugging) */
  readonly context: SecurityPipelineContext;
};

/**
 * Агрегированные метрики для disagreement dashboard
 */
export type DisagreementDashboardMetrics = {
  /** Общее количество сравнений v1 vs v2 */
  readonly totalComparisons: number;
  /** Процент случаев, когда v2 строже v1 (v2 risk > v1 risk) */
  readonly v2StricterPercentage: number;
  /** Процент случаев, когда v2 слабее v1 (v2 risk < v1 risk) - КРИТИЧНО */
  readonly v2WeakerPercentage: number;
  /** Процент точных совпадений */
  readonly exactMatchPercentage: number;
  /** Средняя разница в risk score (v2 - v1) */
  readonly averageScoreDelta: number;
  /** Количество случаев, когда v2 weaker (для auto-rollback) */
  readonly v2WeakerCount: number;
  /** Provider timeout rate (процент таймаутов remote provider) */
  readonly providerTimeoutRate: number;
  /** Fail-closed rate (процент случаев fail-closed) */
  readonly failClosedRate: number;
  /** Timestamp последнего обновления */
  readonly lastUpdated: number;
};

/**
 * Конфигурация для метрик
 */
// eslint-disable-next-line functional/no-mixed-types -- Configuration object with mixed properties and functions
export type MetricsConfig = {
  /** Функция для отправки метрик (telemetry) */
  readonly emitMetric?: (metric: DisagreementMetric) => void;
  /** Функция для агрегации метрик (опционально, для in-memory агрегации) */
  readonly aggregateMetrics?: (
    metrics: readonly DisagreementMetric[],
  ) => DisagreementDashboardMetrics;
  /** Включить детальное логирование расхождений */
  readonly enableDetailedLogging?: boolean;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Порог для определения "значимого" расхождения в risk score */
const SIGNIFICANT_SCORE_DELTA = 10;

/* ============================================================================
 * 🎯 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Определяет тип расхождения между v1 и v2
 */
export function determineDisagreementType(
  v1Risk: RiskAssessmentResult,
  v2Risk: RiskAssessmentResult,
): DisagreementType {
  const scoreDelta = v2Risk.riskScore - v1Risk.riskScore;

  // Если разница в risk score незначительна, считаем точным совпадением
  if (Math.abs(scoreDelta) < SIGNIFICANT_SCORE_DELTA) {
    return 'exact_match';
  }

  // Если v2 risk level выше или score больше → v2 строже
  if (v2Risk.riskScore > v1Risk.riskScore) {
    return 'v2_stricter';
  }

  // Если v2 risk level ниже или score меньше → v2 слабее (КРИТИЧНО)
  return 'v2_weaker';
}

/**
 * Создает метрику расхождения
 */
export function createDisagreementMetric(
  v1Risk: RiskAssessmentResult,
  v2Risk: RiskAssessmentResult,
  context: SecurityPipelineContext,
): DisagreementMetric {
  const scoreDelta = v2Risk.riskScore - v1Risk.riskScore;
  const type = determineDisagreementType(v1Risk, v2Risk);

  return {
    type,
    v1RiskLevel: v1Risk.riskLevel,
    v2RiskLevel: v2Risk.riskLevel,
    v1RiskScore: v1Risk.riskScore,
    v2RiskScore: v2Risk.riskScore,
    scoreDelta,
    timestamp: Date.now(),
    context,
  };
}

/* ============================================================================
 * 📊 AGGREGATION FUNCTIONS
 * ============================================================================
 */

/**
 * Агрегирует метрики расхождений в dashboard метрики
 */
export function aggregateDisagreementMetrics(
  metrics: readonly DisagreementMetric[],
): DisagreementDashboardMetrics {
  if (metrics.length === 0) {
    return {
      totalComparisons: 0,
      v2StricterPercentage: 0,
      v2WeakerPercentage: 0,
      exactMatchPercentage: 0,
      averageScoreDelta: 0,
      v2WeakerCount: 0,
      providerTimeoutRate: 0,
      failClosedRate: 0,
      lastUpdated: Date.now(),
    };
  }

  const totalComparisons = metrics.length;
  const v2StricterCount = metrics.filter((m) => m.type === 'v2_stricter').length;
  const v2WeakerCount = metrics.filter((m) => m.type === 'v2_weaker').length;
  const exactMatchCount = metrics.filter((m) => m.type === 'exact_match').length;

  const totalScoreDelta = metrics.reduce((sum, m) => sum + m.scoreDelta, 0);
  const averageScoreDelta = totalScoreDelta / totalComparisons;

  return {
    totalComparisons,
    v2StricterPercentage: (v2StricterCount / totalComparisons) * 100,
    v2WeakerPercentage: (v2WeakerCount / totalComparisons) * 100,
    exactMatchPercentage: (exactMatchCount / totalComparisons) * 100,
    averageScoreDelta,
    v2WeakerCount,
    providerTimeoutRate: 0, // TODO: интегрировать с remote provider metrics
    failClosedRate: 0, // TODO: интегрировать с fail-closed metrics
    lastUpdated: Date.now(),
  };
}

/**
 * Создает метрику для telemetry события
 */
export function createTelemetryMetric(
  eventType: 'v2_disagreement' | 'provider_timeout' | 'fail_closed' | 'provider_error',
  data: {
    readonly v1Risk?: RiskAssessmentResult;
    readonly v2Risk?: RiskAssessmentResult;
    readonly context: SecurityPipelineContext;
    readonly error?: unknown;
  },
): DisagreementMetric | null {
  if (eventType === 'v2_disagreement' && data.v1Risk && data.v2Risk) {
    return createDisagreementMetric(data.v1Risk, data.v2Risk, data.context);
  }

  // Для других типов событий создаем placeholder метрику
  if (
    eventType === 'provider_timeout'
    || eventType === 'fail_closed'
    || eventType === 'provider_error'
  ) {
    // Создаем синтетическую метрику для отслеживания
    return {
      type: 'v2_stricter', // Placeholder, не используется для этих событий
      v1RiskLevel: 'medium',
      v2RiskLevel: 'medium',
      v1RiskScore: 0,
      v2RiskScore: 0,
      scoreDelta: 0,
      timestamp: Date.now(),
      context: data.context,
    };
  }

  return null;
}
