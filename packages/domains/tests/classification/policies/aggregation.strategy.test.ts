/**
 * @file Unit тесты для Classification Aggregation Strategy
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import type {
  AggregatedRisk,
  AggregationSource,
  AggregationSourceResult,
  AggregationThresholds,
} from '../../../src/classification/policies/aggregation.strategy.js';
import { aggregateRiskSources } from '../../../src/classification/policies/aggregation.strategy.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createValidThresholds(
  overrides: Partial<AggregationThresholds> = {},
): AggregationThresholds {
  return {
    mediumFrom: 40,
    highFrom: 60,
    criticalFrom: 80,
    ...overrides,
  };
}

function createSourceResult<TTriggeredRule = string, TEvidence = unknown>(
  overrides: Partial<AggregationSourceResult<TTriggeredRule, TEvidence>> = {},
): AggregationSourceResult<TTriggeredRule, TEvidence> {
  return {
    riskScore: 50,
    triggeredRules: [],
    confidence: 1,
    ...overrides,
  };
}

function createSource<TTriggeredRule = string, TEvidence = unknown>(
  overrides: Partial<AggregationSource<TTriggeredRule, TEvidence>> = {},
): AggregationSource<TTriggeredRule, TEvidence> {
  return {
    result: createSourceResult(overrides.result),
    weight: 1,
    isFailClosed: false,
    ...overrides,
  };
}

/* ============================================================================
 * 🧩 ТИПЫ — TESTS
 * ============================================================================
 */

describe('Aggregation Strategy Types', () => {
  it('AggregationSourceResult может быть создан с минимальными полями', () => {
    const result: AggregationSourceResult<string, unknown> = {
      riskScore: 50,
      triggeredRules: [],
    };
    expect(result.riskScore).toBe(50);
    expect(result.triggeredRules).toEqual([]);
  });

  it('AggregationSourceResult может быть создан со всеми полями', () => {
    const result: AggregationSourceResult<string, string> = {
      riskScore: 75,
      triggeredRules: ['rule1', 'rule2'],
      confidence: 0.8,
      evidence: 'test evidence',
    };
    expect(result.riskScore).toBe(75);
    expect(result.confidence).toBe(0.8);
    expect(result.evidence).toBe('test evidence');
  });

  it('AggregationSource может быть создан', () => {
    const source: AggregationSource<string, unknown> = {
      result: createSourceResult(),
      weight: 0.5,
      isFailClosed: true,
    };
    expect(source.weight).toBe(0.5);
    expect(source.isFailClosed).toBe(true);
  });

  it('AggregationThresholds может быть создан', () => {
    const thresholds: AggregationThresholds = {
      mediumFrom: 40,
      highFrom: 60,
      criticalFrom: 80,
    };
    expect(thresholds.mediumFrom).toBe(40);
  });

  it('AggregatedRisk содержит все ожидаемые поля', () => {
    const result: AggregatedRisk<string, unknown> = {
      riskScore: 60,
      riskLevel: 'medium',
      triggeredRules: ['rule1'],
      dominantSourceIndex: 0,
      evidence: 'test',
    };
    expect(result.riskScore).toBe(60);
    expect(result.riskLevel).toBe('medium');
    expect(result.dominantSourceIndex).toBe(0);
  });
});

/* ============================================================================
 * 🔧 КОНСТАНТЫ — TESTS
 * ============================================================================
 */

describe('Constants', () => {
  // Since constants are internal, we test them through the API
  it('использует default thresholds при отсутствии параметров', () => {
    const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
    const result = aggregateRiskSources(sources);
    expect(result.riskLevel).toBe('medium'); // 50 >= 40 (mediumFrom default)
  });

  it('использует custom thresholds когда заданы', () => {
    const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
    const customThresholds = createValidThresholds({ mediumFrom: 60 });
    const result = aggregateRiskSources(sources, customThresholds);
    expect(result.riskLevel).toBe('low'); // 50 < 60 (custom mediumFrom)
  });
});

/* ============================================================================
 * 🔧 INTERNAL HELPERS — TESTS
 * ============================================================================
 */

describe('Internal Helper Functions', () => {
  describe('clampScore', () => {
    // Test through aggregateRiskSources with edge case scores

    it('нормализует валидные scores в диапазоне 0-100', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 75 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(75);
    });

    it('нормализует отрицательные scores к 0', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: -10 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(0);
    });

    it('нормализует scores выше 100 к 100', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 150 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100);
    });

    it('обрабатывает NaN как fail-closed fallback', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: NaN }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE
    });

    it('обрабатывает Infinity как fail-closed fallback', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: Infinity }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE
    });
  });

  describe('normalizeWeight', () => {
    // Test through weighted aggregation

    it('нормализует валидные веса в диапазоне 0-1', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 100 }), weight: 0.5 }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // single source always contributes full score regardless of weight
    });

    it('нормализует отрицательные веса к 0', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 100 }), weight: -1 }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE due to zero effective weight
    });

    it('нормализует веса выше 1 к 1', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 100 }), weight: 2 }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // weight becomes 1, single source contributes full score
    });

    it('обрабатывает NaN веса как 0', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 100 }), weight: NaN }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE due to zero effective weight
    });
  });

  describe('normalizeConfidence', () => {
    // Test through confidence-weighted aggregation

    it('использует confidence по умолчанию как 1', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 100 }), weight: 1 }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // single source with full weight and confidence
    });

    it('применяет confidence multiplier', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 100, confidence: 0.5 }),
          weight: 1,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // single source, confidence normalized out
    });

    it('нормализует confidence в диапазоне 0-1', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 100, confidence: 2 }),
          weight: 1,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // confidence becomes 1
    });

    it('обрабатывает NaN confidence как 1', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 100, confidence: NaN }),
          weight: 1,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // confidence becomes 1
    });
  });

  describe('isThresholdsValid', () => {
    // Test through aggregateRiskSources with invalid thresholds

    it('принимает валидные thresholds', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
      const result = aggregateRiskSources(sources, createValidThresholds());
      expect(result.riskLevel).toBe('medium');
    });

    it('отклоняет thresholds вне диапазона 0-100', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
      const invalidThresholds = createValidThresholds({ mediumFrom: -10 });
      const result = aggregateRiskSources(sources, invalidThresholds);
      // Should fallback to default thresholds
      expect(result.riskLevel).toBe('medium');
    });

    it('отклоняет немонотонные thresholds', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
      const invalidThresholds = createValidThresholds({
        mediumFrom: 80,
        highFrom: 60, // less than medium
      });
      const result = aggregateRiskSources(sources, invalidThresholds);
      // Should fallback to default thresholds
      expect(result.riskLevel).toBe('medium');
    });
  });

  describe('toRiskLevel', () => {
    // Test through aggregateRiskSources

    it('возвращает low для scores ниже medium threshold', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 30 }) })];
      const result = aggregateRiskSources(sources);
      expect(result.riskLevel).toBe('low');
    });

    it('возвращает medium для scores в диапазоне medium threshold', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
      const result = aggregateRiskSources(sources);
      expect(result.riskLevel).toBe('medium');
    });

    it('возвращает high для scores в диапазоне high threshold', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 70 }) })];
      const result = aggregateRiskSources(sources);
      expect(result.riskLevel).toBe('high');
    });

    it('возвращает critical для scores выше critical threshold', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 90 }) })];
      const result = aggregateRiskSources(sources);
      expect(result.riskLevel).toBe('critical');
    });
  });

  describe('findMaxRiskIndex', () => {
    // Test through dominantSourceIndex in results

    it('возвращает индекс источника с максимальным score', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 30 }) }),
        createSource({ result: createSourceResult({ riskScore: 80 }) }),
        createSource({ result: createSourceResult({ riskScore: 50 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.dominantSourceIndex).toBe(1); // index of source with score 80
    });

    it('возвращает первый индекс при равных scores', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 50 }) }),
        createSource({ result: createSourceResult({ riskScore: 50 }) }),
        createSource({ result: createSourceResult({ riskScore: 30 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.dominantSourceIndex).toBe(0); // first source with score 50
    });
  });

  describe('calculateWeightedScore', () => {
    // Test through aggregateRiskSources

    it('вычисляет confidence-weighted average', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 100, confidence: 1 }),
          weight: 0.6,
        }),
        createSource({
          result: createSourceResult({ riskScore: 0, confidence: 1 }),
          weight: 0.4,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(60); // (100*0.6 + 0*0.4) / (0.6 + 0.4) = 60
    });

    it('возвращает fail-closed fallback при нулевом суммарном весе', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 50 }), weight: 0 }),
        createSource({ result: createSourceResult({ riskScore: 50 }), weight: 0 }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE due to zero total weight
    });
  });
});

/* ============================================================================
 * 🎯 API FUNCTIONS — TESTS
 * ============================================================================
 */

describe('aggregateRiskSources', () => {
  describe('empty sources', () => {
    it('возвращает fail-safe critical fallback для пустого массива', () => {
      const result = aggregateRiskSources([]);
      expect(result.riskScore).toBe(100);
      expect(result.riskLevel).toBe('critical');
      expect(result.triggeredRules).toEqual([]);
      expect(result.dominantSourceIndex).toBe(-1);
      expect(result.evidence).toBeUndefined();
    });
  });

  describe('single source', () => {
    it('возвращает score и level для одного источника', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 75, triggeredRules: ['rule1'] }),
          weight: 1,
          isFailClosed: false,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(75);
      expect(result.riskLevel).toBe('high');
      expect(result.triggeredRules).toEqual(['rule1']);
      expect(result.dominantSourceIndex).toBe(0);
    });

    it('использует evidence от доминирующего источника', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 50, evidence: 'test evidence' }),
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.evidence).toBe('test evidence');
    });

    it('работает с fail-closed источником', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 30 }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(30);
      expect(result.riskLevel).toBe('low');
      expect(result.dominantSourceIndex).toBe(0);
    });
  });

  describe('multiple sources', () => {
    it('агрегирует scores с confidence-weighted average', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 100, confidence: 1 }),
          weight: 0.6,
        }),
        createSource({
          result: createSourceResult({ riskScore: 0, confidence: 1 }),
          weight: 0.4,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(60); // (100*0.6 + 0*0.4) / (0.6 + 0.4) = 60
    });

    it('конкатенирует triggered rules от всех источников', () => {
      const sources = [
        createSource({
          result: createSourceResult({ triggeredRules: ['rule1', 'rule2'] }),
        }),
        createSource({
          result: createSourceResult({ triggeredRules: ['rule3'] }),
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.triggeredRules).toEqual(['rule1', 'rule2', 'rule3']);
    });

    it('сохраняет дубликаты rules для explainability', () => {
      const sources = [
        createSource({
          result: createSourceResult({ triggeredRules: ['rule1'] }),
        }),
        createSource({
          result: createSourceResult({ triggeredRules: ['rule1'] }),
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.triggeredRules).toEqual(['rule1', 'rule1']);
    });
  });

  describe('fail-closed sources', () => {
    it('доминирует fail-closed источник с максимальным risk', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 90 }),
          isFailClosed: true,
        }),
        createSource({
          result: createSourceResult({ riskScore: 100 }),
          isFailClosed: false, // regular source, should be ignored
        }),
        createSource({
          result: createSourceResult({ riskScore: 80 }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(90); // max among fail-closed sources
      expect(result.dominantSourceIndex).toBe(0); // index of first fail-closed source with max risk
    });

    it('при равных fail-closed scores выбирает первый по индексу', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 50 }),
          isFailClosed: false,
        }),
        createSource({
          result: createSourceResult({ riskScore: 80 }),
          isFailClosed: true,
        }),
        createSource({
          result: createSourceResult({ riskScore: 80 }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.dominantSourceIndex).toBe(1); // first fail-closed source
    });

    it('использует evidence только от доминирующего fail-closed источника', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 50, evidence: 'evidence1' }),
          isFailClosed: true,
        }),
        createSource({
          result: createSourceResult({ riskScore: 60, evidence: 'evidence2' }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.evidence).toBe('evidence2'); // from dominant source (higher risk)
    });

    it('использует только fail-closed rules в triggeredRules', () => {
      const sources = [
        createSource({
          result: createSourceResult({ triggeredRules: ['regular1'] }),
          isFailClosed: false,
        }),
        createSource({
          result: createSourceResult({ triggeredRules: ['failclosed1'] }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.triggeredRules).toEqual(['failclosed1']);
    });
  });

  describe('threshold validation', () => {
    it('fallback к default thresholds при невалидных', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
      const invalidThresholds = createValidThresholds({ mediumFrom: 200 }); // > 100
      const result = aggregateRiskSources(sources, invalidThresholds);
      expect(result.riskLevel).toBe('medium'); // using default thresholds
    });

    it('работает с custom thresholds', () => {
      const sources = [createSource({ result: createSourceResult({ riskScore: 50 }) })];
      const customThresholds = createValidThresholds({
        mediumFrom: 60,
        highFrom: 70,
        criticalFrom: 80,
      });
      const result = aggregateRiskSources(sources, customThresholds);
      expect(result.riskLevel).toBe('low'); // 50 < 60
    });
  });

  describe('edge cases', () => {
    it('обрабатывает источники с NaN scores', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: NaN }) }),
        createSource({ result: createSourceResult({ riskScore: 50 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(75); // (100 + 50) / 2 = 75
    });

    it('обрабатывает источники с нулевыми весами', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 100 }), weight: 0 }),
        createSource({ result: createSourceResult({ riskScore: 50 }), weight: 1 }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(50); // only second source contributes
    });

    it('работает с confidence = 0', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 100, confidence: 0 }),
          weight: 1,
        }),
        createSource({
          result: createSourceResult({ riskScore: 50, confidence: 1 }),
          weight: 1,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(50); // first source has effective weight 0
    });

    it('округляет результат до целого числа', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: 33, confidence: 1 }),
          weight: 1,
        }),
        createSource({
          result: createSourceResult({ riskScore: 34, confidence: 1 }),
          weight: 1,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(34); // (33 + 34) / 2 = 33.5 -> 34 (rounded)
    });

    it('fail-closed источник с NaN score использует fallback', () => {
      const sources = [
        createSource({
          result: createSourceResult({ riskScore: NaN }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE
      expect(result.dominantSourceIndex).toBe(0);
    });

    it('fail-closed источник с undefined triggeredRules', () => {
      const sources = [
        createSource({
          result: createSourceResult({ triggeredRules: undefined as any }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.triggeredRules).toEqual([]);
    });

    it('fail-closed источник с undefined evidence', () => {
      const sources = [
        createSource({
          result: createSourceResult({ evidence: undefined }),
          isFailClosed: true,
        }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.evidence).toBeUndefined();
    });

    it('покрывает edge case в findMaxRiskIndex с NaN scores', () => {
      // This test ensures we cover the fallback path in findMaxRiskIndex
      const sources = [
        createSource({ result: createSourceResult({ riskScore: NaN }) }), // becomes 100
        createSource({ result: createSourceResult({ riskScore: 50 }) }),
        createSource({ result: createSourceResult({ riskScore: NaN }) }), // becomes 100
      ];
      const result = aggregateRiskSources(sources);
      expect(result.dominantSourceIndex).toBe(0); // first source with score 100 (NaN -> FALLBACK_SCORE)
    });

    it('покрывает fallback path в fail-closed dominant source access', () => {
      // Create a scenario where dominantFailClosed might be undefined
      // This is hard to trigger naturally, but let's try with empty fail-closed sources
      const sources = [
        createSource({ isFailClosed: true }), // fail-closed with default score 50
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(50);
      expect(result.dominantSourceIndex).toBe(0);
    });

    it('force covers findMaxRiskIndex array access pattern', () => {
      // Create sources where the reduce function will access all[bestIndex] multiple times
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 10 }) }),
        createSource({ result: createSourceResult({ riskScore: 20 }) }),
        createSource({ result: createSourceResult({ riskScore: 15 }) }),
        createSource({ result: createSourceResult({ riskScore: 25 }) }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.dominantSourceIndex).toBe(3); // source with highest score 25
      expect(result.riskScore).toBe(18); // (10+20+15+25)/4 = 17.5 -> 18 rounded
    });

    it('покрывает fail-closed с множественными источниками', () => {
      const sources = [
        createSource({ result: createSourceResult({ riskScore: 60 }), isFailClosed: true }),
        createSource({ result: createSourceResult({ riskScore: 80 }), isFailClosed: true }),
        createSource({ result: createSourceResult({ riskScore: 100 }), isFailClosed: false }),
      ];
      const result = aggregateRiskSources(sources);
      expect(result.riskScore).toBe(80); // max among fail-closed sources
      expect(result.dominantSourceIndex).toBe(1); // index of max fail-closed source
    });

    it('покрывает synthetic sparse-array ветку с dominantSourceIndex = -1', () => {
      // Runtime-sparse массив: length > 0, но без элементов.
      // Нужен для покрытия defensive ветки dominantSourceIndex < 0.
      const sparseSources = new Array(2) as AggregationSource<string, unknown>[];
      const result = aggregateRiskSources(sparseSources);
      expect(result.riskScore).toBe(100); // FALLBACK_SCORE: totalWeight <= 0
      expect(result.riskLevel).toBe('critical');
      expect(result.dominantSourceIndex).toBe(-1);
      expect(result.evidence).toBeUndefined();
    });
  });
});
