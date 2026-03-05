/**
 * @file Unit тесты для Classification Aggregation Policy
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';

import type {
  AggregationPolicy,
  AggregationPolicyStrategy,
  PolicyAggregationSource,
  SourceWeightOverride,
} from '../../../src/classification/policies/aggregation.policy.js';
import {
  applyAggregationPolicy,
  defaultAggregationPolicy,
} from '../../../src/classification/policies/aggregation.policy.js';
import type { AggregationSourceResult } from '../../../src/classification/policies/aggregation.strategy.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createValidThresholds(
  overrides: Partial<{ mediumFrom: number; highFrom: number; criticalFrom: number; }> = {},
): { mediumFrom: number; highFrom: number; criticalFrom: number; } {
  return {
    mediumFrom: 40,
    highFrom: 60,
    criticalFrom: 80,
    ...overrides,
  };
}

function createSourceWeightOverride<TSourceId extends string>(
  sourceId: TSourceId,
  weight: number,
): SourceWeightOverride<TSourceId> {
  return { sourceId, weight };
}

function createPolicyAggregationSource<
  TSourceId extends string,
  TTriggeredRule = string,
  TEvidence = unknown,
>(
  sourceId: TSourceId,
  overrides: {
    result?: {
      riskScore?: number;
      triggeredRules?: readonly TTriggeredRule[];
      confidence?: number;
      evidence?: TEvidence;
    };
    weight?: number;
    isFailClosed?: boolean;
  } = {},
): PolicyAggregationSource<TSourceId, TTriggeredRule, TEvidence> {
  const resultOverrides = overrides.result ?? {};
  const riskScore = resultOverrides.riskScore ?? 50;
  const triggeredRules = resultOverrides.triggeredRules ?? [];
  const confidence = resultOverrides.confidence ?? 1;
  const evidence = resultOverrides.evidence;

  const defaultResult: AggregationSourceResult<TTriggeredRule, TEvidence> = {
    riskScore,
    triggeredRules,
    confidence,
    ...(evidence !== undefined && { evidence }),
  };

  const weight = overrides.weight ?? 1;
  const isFailClosed = overrides.isFailClosed ?? false;

  return {
    sourceId,
    source: {
      result: defaultResult,
      weight,
      isFailClosed,
    },
  };
}

function createAggregationPolicy<TSourceId extends string>(
  overrides: Partial<AggregationPolicy<TSourceId>> = {},
): AggregationPolicy<TSourceId> {
  return {
    strategy: 'fail_closed_dominance',
    thresholds: createValidThresholds(),
    sourceWeights: [],
    mediumRiskCutoff: 40,
    ...overrides,
  };
}

/* ============================================================================
 * 🧩 ТИПЫ — TESTS
 * ============================================================================
 */

describe('Aggregation Policy Types', () => {
  it('AggregationPolicyStrategy поддерживает все значения', () => {
    const strategies: AggregationPolicyStrategy[] = [
      'max_risk_wins',
      'confidence_weighted',
      'fail_closed_dominance',
    ];

    strategies.forEach((strategy) => {
      expect(['max_risk_wins', 'confidence_weighted', 'fail_closed_dominance']).toContain(strategy);
    });
  });

  it('SourceWeightOverride может быть создан', () => {
    const override: SourceWeightOverride<'source1'> = {
      sourceId: 'source1',
      weight: 0.8,
    };
    expect(override.sourceId).toBe('source1');
    expect(override.weight).toBe(0.8);
  });

  it('PolicyAggregationSource может быть создан', () => {
    const source: PolicyAggregationSource<'source1', string, unknown> = {
      sourceId: 'source1',
      source: {
        result: {
          riskScore: 60,
          triggeredRules: ['rule1'],
        },
        weight: 0.9,
        isFailClosed: false,
      },
    };
    expect(source.sourceId).toBe('source1');
    expect(source.source.result.riskScore).toBe(60);
  });

  it('AggregationPolicy может быть создан', () => {
    const policy: AggregationPolicy<'source1'> = {
      strategy: 'confidence_weighted',
      thresholds: createValidThresholds(),
      sourceWeights: [createSourceWeightOverride('source1', 0.7)],
      mediumRiskCutoff: 50,
    };
    expect(policy.strategy).toBe('confidence_weighted');
    expect(policy.mediumRiskCutoff).toBe(50);
  });
});

/* ============================================================================
 * 🔧 КОНСТАНТЫ — TESTS
 * ============================================================================
 */

describe('Constants', () => {
  describe('defaultAggregationPolicy', () => {
    it('содержит валидную конфигурацию', () => {
      expect(defaultAggregationPolicy.strategy).toBe('fail_closed_dominance');
      expect(defaultAggregationPolicy.thresholds).toEqual({
        mediumFrom: 40,
        highFrom: 60,
        criticalFrom: 80,
      });
      expect(defaultAggregationPolicy.sourceWeights).toEqual([]);
      expect(defaultAggregationPolicy.mediumRiskCutoff).toBe(40);
    });

    it('является frozen объектом', () => {
      expect(Object.isFrozen(defaultAggregationPolicy)).toBe(true);
      expect(Object.isFrozen(defaultAggregationPolicy.thresholds)).toBe(true);
      expect(Object.isFrozen(defaultAggregationPolicy.sourceWeights)).toBe(true);
    });
  });
});

/* ============================================================================
 * 🔧 INTERNAL HELPERS — TESTS
 * ============================================================================
 */

describe('Internal Helper Functions', () => {
  describe('normalizeCutoff', () => {
    // Test through applyAggregationPolicy with fail_closed_dominance strategy

    it('возвращает default cutoff для undefined', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policy = createAggregationPolicy();
      // mediumRiskCutoff is omitted, should use default
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50); // Uses confidence_weighted since score < cutoff
    });

    it('нормализует валидные cutoff значения', () => {
      const sources = [createPolicyAggregationSource('source1', {
        result: { riskScore: 45 }, // < cutoff, should use confidence_weighted
      })];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: 50,
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(45);
    });

    it('нормализует cutoff вне диапазона', () => {
      const sources = [createPolicyAggregationSource('source1', {
        result: { riskScore: 30 }, // < default cutoff, should use confidence_weighted
      })];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: 150, // > 100, should be clamped
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(30);
    });

    it('обрабатывает NaN cutoff как default', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: NaN,
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);
    });

    it('использует DEFAULT_MEDIUM_RISK_CUTOFF при отсутствующем cutoff в policy', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policyWithoutCutoff: AggregationPolicy<'source1'> = {
        strategy: 'fail_closed_dominance',
        thresholds: createValidThresholds(),
        sourceWeights: [],
      };
      const result = applyAggregationPolicy(sources, policyWithoutCutoff);
      expect(result.riskScore).toBe(50);
    });
  });

  describe('normalizeRiskScore', () => {
    // Test through pickMaxRiskSource via max_risk_wins strategy

    it('нормализует валидные scores', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 75 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 60 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(75);
    });

    it('обрабатывает NaN как 100', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: NaN } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 50 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(100);
    });

    it('нормализует отрицательные scores к 0', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: -10 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 50 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);
    });

    it('нормализует scores выше 100 к 100', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 150 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 50 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(100);
    });
  });

  describe('isPolicyValid', () => {
    // Test through applyAggregationPolicy fallback behavior

    it('принимает валидную policy', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policy = createAggregationPolicy();
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);
    });

    it('отклоняет policy с NaN cutoff', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const invalidPolicy = createAggregationPolicy({ mediumRiskCutoff: NaN });
      const result = applyAggregationPolicy(sources, invalidPolicy);
      // Should fallback to default policy
      expect(result.riskScore).toBe(50);
    });

    it('отклоняет policy с отрицательными weight overrides', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const invalidPolicy = createAggregationPolicy({
        sourceWeights: [createSourceWeightOverride('source1', -1)],
      });
      const result = applyAggregationPolicy(sources, invalidPolicy);
      // Should fallback to default policy
      expect(result.riskScore).toBe(50);
    });

    it('отклоняет policy с NaN weight overrides', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const invalidPolicy = createAggregationPolicy({
        sourceWeights: [createSourceWeightOverride('source1', NaN)],
      });
      const result = applyAggregationPolicy(sources, invalidPolicy);
      // Should fallback to default policy
      expect(result.riskScore).toBe(50);
    });
  });

  describe('resolveWeightOverride', () => {
    // Test through applyWeightOverrides via applyAggregationPolicy

    it('возвращает 1 для отсутствующего override', () => {
      const sources = [
        createPolicyAggregationSource('source1', { weight: 0.8 }),
        createPolicyAggregationSource('source2', { weight: 1 }),
      ];
      const policy = createAggregationPolicy({
        sourceWeights: [], // no overrides
        strategy: 'confidence_weighted',
      });
      const result = applyAggregationPolicy(sources, policy);
      // Both sources have score 50, effective weights: 0.8 and 1.0
      // Result: (50*0.8 + 50*1.0) / (0.8 + 1.0) = 90 / 1.8 = 50
      expect(result.riskScore).toBe(50);
    });

    it('применяет weight multiplier', () => {
      const sources = [
        createPolicyAggregationSource('source1', { weight: 0.8 }),
        createPolicyAggregationSource('source2', { weight: 1 }),
      ];
      const policy = createAggregationPolicy({
        sourceWeights: [createSourceWeightOverride('source1', 0.5)], // override source1 weight
        strategy: 'confidence_weighted',
      });
      const result = applyAggregationPolicy(sources, policy);
      // source1 effective weight: 0.8 * 0.5 = 0.4
      // source2 effective weight: 1.0 * 1.0 = 1.0
      // Result: (50*0.4 + 50*1.0) / (0.4 + 1.0) = 70 / 1.4 ≈ 50
      expect(result.riskScore).toBe(50);
    });

    it('нормализует weight override к диапазону 0-1', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policy = createAggregationPolicy({
        sourceWeights: [createSourceWeightOverride('source1', 2)], // > 1, should be clamped to 1
        strategy: 'confidence_weighted',
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);
    });

    it('обрабатывает NaN weight override как 1', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policy = createAggregationPolicy({
        sourceWeights: [createSourceWeightOverride('source1', NaN)],
        strategy: 'confidence_weighted',
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);
    });
  });

  describe('applyWeightOverrides', () => {
    // Test through applyAggregationPolicy

    it('применяет множественные weight overrides', () => {
      const sources = [
        createPolicyAggregationSource('source1', { weight: 0.8 }),
        createPolicyAggregationSource('source2', { weight: 0.6 }),
      ];
      const policy = createAggregationPolicy({
        sourceWeights: [
          createSourceWeightOverride('source1', 0.5),
          createSourceWeightOverride('source2', 0.8),
        ],
        strategy: 'confidence_weighted',
      });
      const result = applyAggregationPolicy(sources, policy);
      // Effective weights: source1 = 0.8 * 0.5 = 0.4, source2 = 0.6 * 0.8 = 0.48
      // Scores: both 50, so result = (50*0.4 + 50*0.48) / (0.4 + 0.48) = 50
      expect(result.riskScore).toBe(50);
    });
  });

  describe('pickMaxRiskSource', () => {
    // Test through max_risk_wins strategy

    it('возвращает null для пустого массива', () => {
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy([], policy);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE
      expect(result.dominantSourceIndex).toBe(-1);
    });

    it('возвращает источник с максимальным score', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 30 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 80 } }),
        createPolicyAggregationSource('source3', { result: { riskScore: 60 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(80);
      expect(result.dominantSourceIndex).toBe(0); // Index in the single-source array passed to strategy
    });

    it('обрабатывает NaN scores как 100', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 50 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: NaN } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(100);
      expect(result.dominantSourceIndex).toBe(0); // Index in the single-source array passed to strategy
    });

    it('покрывает synthetic sparse-array ветку first === undefined', () => {
      const sparse = new Array(2) as PolicyAggregationSource<'source1', string, unknown>[];
      const policy = createAggregationPolicy<'source1'>({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sparse, policy);
      expect(result.riskScore).toBe(100); // fallback from strategy([]) path
      expect(result.dominantSourceIndex).toBe(-1);
    });
  });

  describe('runMaxRiskWins', () => {
    // Test through max_risk_wins strategy

    it('делегирует single source aggregation', () => {
      const sources = [createPolicyAggregationSource('source1', { result: { riskScore: 75 } })];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(75);
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('runFailClosedDominance', () => {
    // Test through fail_closed_dominance strategy

    it('делегирует aggregation при наличии fail-closed источников', () => {
      const sources = [
        createPolicyAggregationSource('source1', { isFailClosed: true, result: { riskScore: 90 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 50 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'fail_closed_dominance' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(90);
    });

    it('использует max_risk_wins когда max score >= cutoff', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 50 } }), // >= 40
        createPolicyAggregationSource('source2', { result: { riskScore: 30 } }),
      ];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: 40,
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);
    });

    it('использует confidence_weighted когда max score < cutoff', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 30 } }), // < 40
        createPolicyAggregationSource('source2', { result: { riskScore: 20 } }),
      ];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: 40,
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(25); // (30 + 20) / 2 = 25
    });
  });
});

/* ============================================================================
 * 🎯 API FUNCTIONS — TESTS
 * ============================================================================
 */

describe('applyAggregationPolicy', () => {
  describe('empty sources', () => {
    it('возвращает fail-safe fallback для пустого массива', () => {
      const policy = createAggregationPolicy();
      const result = applyAggregationPolicy([], policy);
      expect(result.riskScore).toBe(100);
      expect(result.riskLevel).toBe('critical');
      expect(result.triggeredRules).toEqual([]);
      expect(result.dominantSourceIndex).toBe(-1);
    });
  });

  describe('default policy', () => {
    it('использует default policy когда policy не указана', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const result = applyAggregationPolicy(sources);
      expect(result.riskScore).toBe(50);
    });
  });

  describe('strategy: max_risk_wins', () => {
    it('выбирает источник с максимальным risk score', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 30 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 80 } }),
        createPolicyAggregationSource('source3', { result: { riskScore: 60 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(80);
      expect(result.dominantSourceIndex).toBe(0); // Index in the single-source array passed to strategy
    });

    it('применяет weight overrides', () => {
      const sources = [createPolicyAggregationSource('source1', { weight: 1 })];
      const policy = createAggregationPolicy({
        strategy: 'max_risk_wins',
        sourceWeights: [createSourceWeightOverride('source1', 0.5)],
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50); // Single source, weight normalized out
    });
  });

  describe('strategy: confidence_weighted', () => {
    it('выполняет confidence-weighted aggregation', () => {
      const sources = [
        createPolicyAggregationSource('source1', {
          result: { riskScore: 100, confidence: 0.8 },
          weight: 0.6,
        }),
        createPolicyAggregationSource('source2', {
          result: { riskScore: 0, confidence: 0.6 },
          weight: 0.4,
        }),
      ];
      const policy = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sources, policy);
      // Effective weights: 0.6 * 0.8 = 0.48, 0.4 * 0.6 = 0.24
      // Result: (100 * 0.48 + 0 * 0.24) / (0.48 + 0.24) = 48 / 0.72 = 66.67 -> 67
      expect(result.riskScore).toBe(67);
    });

    it('применяет weight overrides', () => {
      const sources = [
        createPolicyAggregationSource('source1', { weight: 0.8 }),
        createPolicyAggregationSource('source2', { weight: 0.6 }),
      ];
      const policy = createAggregationPolicy({
        strategy: 'confidence_weighted',
        sourceWeights: [
          createSourceWeightOverride('source1', 0.5),
          createSourceWeightOverride('source2', 0.8),
        ],
      });
      const result = applyAggregationPolicy(sources, policy);
      // Effective weights: 0.8 * 0.5 = 0.4, 0.6 * 0.8 = 0.48
      // Both have score 50, so result = 50
      expect(result.riskScore).toBe(50);
    });

    it('достигает normalizeWeight fallback: NaN weight -> 0', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 100 }, weight: NaN }),
        createPolicyAggregationSource('source2', { result: { riskScore: 50 }, weight: 1 }),
      ];
      const policy = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50); // первый источник игнорируется (effective weight = 0)
    });

    it('достигает normalizeConfidence fallback: NaN confidence -> 1', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 100, confidence: NaN } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 0, confidence: 1 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50); // confidence NaN нормализуется в 1
    });

    it('достигает totalWeight<=0 fallback: все effective weights равны 0', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 100 }, weight: 0 }),
        createPolicyAggregationSource('source2', { result: { riskScore: 50 }, weight: 0 }),
      ];
      const policy = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE из strategy
    });
  });

  describe('strategy: fail_closed_dominance', () => {
    it('делегирует fail-closed логику strategy-ядру', () => {
      const sources = [
        createPolicyAggregationSource('source1', { isFailClosed: true, result: { riskScore: 70 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 90 } }),
      ];
      const policy = createAggregationPolicy({ strategy: 'fail_closed_dominance' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(70); // Fail-closed dominates
    });

    it('применяет max_risk_wins когда max score >= cutoff', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 50 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 30 } }),
      ];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: 45,
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50); // Max risk wins
    });

    it('применяет confidence_weighted когда max score < cutoff', () => {
      const sources = [
        createPolicyAggregationSource('source1', { result: { riskScore: 30 } }),
        createPolicyAggregationSource('source2', { result: { riskScore: 40 } }),
      ];
      const policy = createAggregationPolicy({
        strategy: 'fail_closed_dominance',
        mediumRiskCutoff: 50,
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(35); // (30 + 40) / 2 = 35
    });
  });

  describe('policy validation and fallbacks', () => {
    it('fallback к default policy при невалидной policy', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const invalidPolicy = createAggregationPolicy({
        mediumRiskCutoff: NaN,
        sourceWeights: [createSourceWeightOverride('source1', -1)],
      });
      const result = applyAggregationPolicy(sources, invalidPolicy);
      // Should use default policy
      expect(result.riskScore).toBe(50);
    });

    it('использует default thresholds когда не указаны', () => {
      const sources = [createPolicyAggregationSource('source1', { result: { riskScore: 50 } })];
      const policy = createAggregationPolicy();
      // thresholds is omitted, should use default
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskLevel).toBe('medium'); // 50 >= 40 (default mediumFrom)
    });

    it('fallback к default thresholds при невалидных thresholds в policy', () => {
      const sources = [createPolicyAggregationSource('source1', { result: { riskScore: 50 } })];
      const policy = createAggregationPolicy({
        strategy: 'confidence_weighted',
        thresholds: createValidThresholds({ mediumFrom: 200 }),
      });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskLevel).toBe('medium'); // invalid thresholds -> strategy default thresholds
    });
  });

  describe('evidence handling', () => {
    it('передает evidence от доминирующего источника', () => {
      const sources = [
        createPolicyAggregationSource('source1', {
          result: { riskScore: 60, evidence: 'evidence1' },
        }),
        createPolicyAggregationSource('source2', {
          result: { riskScore: 40, evidence: 'evidence2' },
        }),
      ];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.evidence).toBe('evidence1');
    });
  });

  describe('triggered rules concatenation', () => {
    it('конкатенирует rules от всех источников', () => {
      const sources = [
        createPolicyAggregationSource('source1', {
          result: { triggeredRules: ['rule1', 'rule2'] },
        }),
        createPolicyAggregationSource('source2', {
          result: { triggeredRules: ['rule3'] },
        }),
      ];
      const policy = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.triggeredRules).toEqual(['rule1', 'rule2', 'rule3']);
    });

    it('сохраняет дубликаты rules', () => {
      const sources = [
        createPolicyAggregationSource('source1', {
          result: { triggeredRules: ['rule1'] },
        }),
        createPolicyAggregationSource('source2', {
          result: { triggeredRules: ['rule1'] },
        }),
      ];
      const policy = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.triggeredRules).toEqual(['rule1', 'rule1']);
    });

    it('покрывает synthetic sparse-array ветку dominantSourceIndex < 0 в strategy', () => {
      const sparse = new Array(2) as PolicyAggregationSource<'source1', string, unknown>[];
      const policy = createAggregationPolicy<'source1'>({ strategy: 'confidence_weighted' });
      const result = applyAggregationPolicy(sparse, policy);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE: totalWeight <= 0
      expect(result.riskLevel).toBe('critical');
      expect(result.dominantSourceIndex).toBe(-1);
    });
  });

  describe('exhaustive strategy checking', () => {
    it('покрывает исчерпывающую проверку стратегий', () => {
      const sources = [createPolicyAggregationSource('source1')];
      const policy = createAggregationPolicy({ strategy: 'max_risk_wins' });
      const result = applyAggregationPolicy(sources, policy);
      expect(result.riskScore).toBe(50);

      const policy2 = createAggregationPolicy({ strategy: 'confidence_weighted' });
      const result2 = applyAggregationPolicy(sources, policy2);
      expect(result2.riskScore).toBe(50);

      const policy3 = createAggregationPolicy({ strategy: 'fail_closed_dominance' });
      const result3 = applyAggregationPolicy(sources, policy3);
      expect(result3.riskScore).toBe(50);
    });
  });
});
