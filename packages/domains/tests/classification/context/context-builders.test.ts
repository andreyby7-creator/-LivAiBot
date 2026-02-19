/**
 * @file Unit тесты для Classification Context Builders
 * Полное покрытие всех функций и edge cases
 */
import { describe, expect, it } from 'vitest';
import {
  buildAssessmentContext,
  buildRuleContext,
  buildScoringContext,
} from '../../../src/classification/context/context-builders.js';
import type { ClassificationSlotMap } from '../../../src/classification/context/context-builders.js';
import type { ClassificationRulesConfig } from '../../../src/classification/strategies/config.js';
import { getClassificationRulesConfig } from '../../../src/classification/strategies/config.js';
// eslint-disable-next-line no-restricted-imports -- Тесты могут использовать прямой импорт из @livai/core
import { confidence, evaluationLevel, evaluationScale } from '@livai/core';
import type {
  ClassificationLabel,
  ClassificationLabelValue,
} from '../../../src/classification/labels.js';
import { classificationLabel } from '../../../src/classification/labels.js';
import type { ClassificationEvaluationResult } from '../../../src/classification/evaluation/result.js';
import {
  classificationContext,
  classificationSignals,
} from '../../../src/classification/signals/signals.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createTestLabel(value: ClassificationLabelValue): ClassificationLabel {
  const result = classificationLabel.create(value);
  if (!result.ok) {
    throw new Error(`Failed to create label: ${JSON.stringify(result.reason)}`);
  }
  return result.value;
}

function createTestEvaluationResult(
  labelValue: ClassificationLabelValue,
  levelValue: number,
  confidenceValue: number,
  scaleMin: number,
  scaleMax: number,
): ClassificationEvaluationResult {
  const label = createTestLabel(labelValue);
  const scaleResult = evaluationScale.create(scaleMin, scaleMax, 'classification');
  if (!scaleResult.ok) {
    throw new Error(`Failed to create scale: ${JSON.stringify(scaleResult.reason)}`);
  }
  const scale = scaleResult.value;
  const levelResult = evaluationLevel.create(levelValue, scale);
  if (!levelResult.ok) {
    throw new Error(`Failed to create level: ${JSON.stringify(levelResult.reason)}`);
  }
  const evaluationLevelValue = levelResult.value;
  const confidenceResult = confidence.create(confidenceValue, 'classification');
  if (!confidenceResult.ok) {
    throw new Error(`Failed to create confidence: ${JSON.stringify(confidenceResult.reason)}`);
  }
  const confidenceValueResult = confidenceResult.value;
  return {
    evaluationLevel: evaluationLevelValue,
    confidence: confidenceValueResult,
    label,
    scale,
  };
}

/* ============================================================================
 * 🔧 BUILD RULE CONTEXT — TESTS
 * ============================================================================
 */

describe('buildRuleContext', () => {
  const baseDevice = { deviceId: 'device1', deviceType: 'mobile' as const };
  const baseContext = classificationContext.create({
    geo: { lat: 37.7749, lng: -122.4194 },
  })!;

  it('создаёт ruleContext с валидными данными', () => {
    const context = classificationContext.create({
      previousSessionId: 'session123',
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: classificationSignals.create({
        isVpn: false,
        reputationScore: 75,
      })!,
    })!;

    const result = buildRuleContext({
      device: baseDevice,
      context,
      riskScore: 50,
    });

    expect(result.ruleContext).toBeDefined();
    expect(result.ruleContext.metadata).toBeDefined();
    expect(result.ruleContext.metadata.isNewDevice).toBe(false);
    expect(result.ruleContext.metadata.riskScore).toBe(50);
    expect(result.ruleContext.signals).toBeDefined();
    expect(result.ruleContext.signals.isVpn).toBe(false);
  });

  describe('isNewDevice logic - edge cases', () => {
    it('isNewDevice = true когда previousSessionId === undefined', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.metadata.isNewDevice).toBe(true);
    });

    it('isNewDevice = true когда previousSessionId === "" (пустая строка)', () => {
      // Примечание: classificationContext.create() должен вернуть null для пустой строки,
      // но если кто-то попытается обойти валидацию, builder должен обработать это
      const context = {
        ...baseContext,
        previousSessionId: '',
      } as typeof baseContext & { previousSessionId: string; };

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.metadata.isNewDevice).toBe(true);
    });

    it('isNewDevice = false когда previousSessionId = валидная строка', () => {
      const context = classificationContext.create({
        previousSessionId: 'session123',
        geo: { lat: 37.7749, lng: -122.4194 },
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.metadata.isNewDevice).toBe(false);
    });
  });

  describe('buildRuleSignals - возвращает пустой объект вместо undefined', () => {
    it('возвращает пустой объект signals когда signals === undefined', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      // signals должен быть объектом, а не undefined
      expect(result.ruleContext.signals).toBeDefined();
      expect(result.ruleContext.signals).toEqual({});
      expect(typeof result.ruleContext.signals).toBe('object');
    });

    it('возвращает объект signals с полями когда signals валидны', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
        signals: classificationSignals.create({
          isVpn: true,
          reputationScore: 75,
        })!,
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.signals).toBeDefined();
      expect(result.ruleContext.signals.isVpn).toBe(true);
      expect(result.ruleContext.signals.reputationScore).toBe(75);
    });

    it('возвращает объект signals с isTor, isProxy, velocityScore', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
        signals: classificationSignals.create({
          isTor: true,
          isProxy: false,
          velocityScore: 85,
        })!,
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.signals).toBeDefined();
      expect(result.ruleContext.signals.isTor).toBe(true);
      expect(result.ruleContext.signals.isProxy).toBe(false);
      expect(result.ruleContext.signals.velocityScore).toBe(85);
    });
  });

  describe('previousGeo handling', () => {
    it('включает previousGeo в ruleContext когда signals.previousGeo определен', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
        signals: classificationSignals.create({
          isVpn: false,
          previousGeo: { lat: 40.7128, lng: -74.0060 },
        })!,
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.previousGeo).toBeDefined();
      expect(result.ruleContext.previousGeo?.lat).toBe(40.7128);
      expect(result.ruleContext.previousGeo?.lng).toBe(-74.0060);
    });

    it('не включает previousGeo когда signals.previousGeo undefined', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
        signals: classificationSignals.create({
          isVpn: false,
        })!,
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      expect(result.ruleContext.previousGeo).toBeUndefined();
    });
  });

  describe('validateRiskScore - edge cases', () => {
    it('нормализует riskScore: undefined → 0', () => {
      const result = buildRuleContext({
        device: baseDevice,
        context: baseContext,
      } as Pick<ClassificationSlotMap, 'device' | 'context' | 'riskScore'>);

      expect(result.ruleContext.metadata.riskScore).toBe(0);
    });

    it('нормализует riskScore: NaN → 0', () => {
      const result = buildRuleContext({
        device: baseDevice,
        context: baseContext,
        riskScore: Number.NaN,
      });

      expect(result.ruleContext.metadata.riskScore).toBe(0);
    });

    it('нормализует riskScore: Infinity → 0', () => {
      const result = buildRuleContext({
        device: baseDevice,
        context: baseContext,
        riskScore: Number.POSITIVE_INFINITY,
      });

      expect(result.ruleContext.metadata.riskScore).toBe(0);
    });

    it('нормализует riskScore: > 100 → 100', () => {
      const result = buildRuleContext({
        device: baseDevice,
        context: baseContext,
        riskScore: 150,
      });

      expect(result.ruleContext.metadata.riskScore).toBe(100);
    });

    it('нормализует riskScore: < 0 → 0', () => {
      const result = buildRuleContext({
        device: baseDevice,
        context: baseContext,
        riskScore: -10,
      });

      expect(result.ruleContext.metadata.riskScore).toBe(0);
    });

    it('сохраняет валидный riskScore без изменений', () => {
      const result = buildRuleContext({
        device: baseDevice,
        context: baseContext,
        riskScore: 75,
      });

      expect(result.ruleContext.metadata.riskScore).toBe(75);
    });
  });

  describe('immutability - freeze protection', () => {
    it('freeze ruleContext и его вложенные объекты', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
        signals: classificationSignals.create({
          isVpn: false,
        })!,
      })!;

      const result = buildRuleContext({
        device: baseDevice,
        context,
        riskScore: 50,
      });

      // Проверяем, что объекты frozen
      expect(Object.isFrozen(result.ruleContext)).toBe(true);
      expect(Object.isFrozen(result.ruleContext.signals)).toBe(true);
      expect(Object.isFrozen(result.ruleContext.metadata)).toBe(true);
    });
  });
});

/* ============================================================================
 * 🔧 BUILD SCORING CONTEXT — TESTS
 * ============================================================================
 */

describe('buildScoringContext', () => {
  const baseDevice = { deviceId: 'device1', deviceType: 'mobile' as const };
  const config: ClassificationRulesConfig = getClassificationRulesConfig();

  it('создаёт scoringContext с валидными данными', () => {
    const context = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      ip: '192.168.1.1',
      signals: classificationSignals.create({
        reputationScore: 80,
      })!,
    })!;

    const result = buildScoringContext({
      device: baseDevice,
      context,
      config,
    });

    expect(result.scoringContext).toBeDefined();
    expect(result.scoringContext!.device.deviceId).toBe('device1');
    expect(result.scoringContext!.geo?.lat).toBe(37.7749);
    expect(result.scoringContext!.ip).toBe('192.168.1.1');
    expect(result.scoringContext!.signals?.reputationScore).toBe(80);
    expect(result.scoringContext!.config?.highRiskCountries).toBeDefined();
  });

  it('создаёт scoringContext без optional полей', () => {
    const context = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
    })!;

    const result = buildScoringContext({
      device: baseDevice,
      context,
      config,
    });

    expect(result.scoringContext).toBeDefined();
    expect(result.scoringContext!.ip).toBeUndefined();
    expect(result.scoringContext!.signals).toBeUndefined();
  });

  it('freeze scoringContext', () => {
    const context = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
    })!;

    const result = buildScoringContext({
      device: baseDevice,
      context,
      config,
    });

    expect(Object.isFrozen(result.scoringContext)).toBe(true);
  });
});

/* ============================================================================
 * 🔧 BUILD ASSESSMENT CONTEXT — TESTS
 * ============================================================================
 */

describe('buildAssessmentContext', () => {
  const baseDevice = { deviceId: 'device1', deviceType: 'mobile' as const };

  it('создаёт assessmentContext с валидными данными', () => {
    const context = classificationContext.create({
      previousSessionId: 'session123',
      geo: { lat: 37.7749, lng: -122.4194, country: 'US', region: 'CA' },
      userId: 'user1',
      signals: classificationSignals.create({
        isVpn: false,
      })!,
    })!;

    const ruleEvaluationResult = createTestEvaluationResult('SAFE', 10, 0.8, 0, 100);

    const result = buildAssessmentContext({
      device: baseDevice,
      context,
      riskScore: 60,
      ruleEvaluationResult,
    });

    expect(result.assessmentContext).toBeDefined();
    expect(result.assessmentContext!.device.deviceId).toBe('device1');
    expect(result.assessmentContext!.classificationContext.previousSessionId).toBe('session123');
    expect(result.assessmentContext!.riskScore).toBe(60);
    expect(result.assessmentContext!.ruleEvaluationResult.label).toBeDefined();
  });

  describe('freeze nested objects - geo protection', () => {
    it('freeze geo и его поля для защиты от nested mutations', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194, country: 'US', region: 'CA', city: 'SF' },
        signals: classificationSignals.create({
          isVpn: false,
        })!,
      })!;

      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 10, 0.8, 0, 100);

      const result = buildAssessmentContext({
        device: baseDevice,
        context,
        riskScore: 60,
        ruleEvaluationResult,
      });

      const frozenGeo = result.assessmentContext!.classificationContext.geo;

      // Проверяем, что geo объект frozen
      expect(frozenGeo).toBeDefined();
      expect(Object.isFrozen(frozenGeo)).toBe(true);

      // Проверяем, что classificationContext frozen
      expect(Object.isFrozen(result.assessmentContext!.classificationContext)).toBe(true);

      // Проверяем, что signals frozen
      if (result.assessmentContext!.classificationContext.signals) {
        expect(Object.isFrozen(result.assessmentContext!.classificationContext.signals)).toBe(true);
      }

      // Проверяем, что assessmentContext frozen
      expect(Object.isFrozen(result.assessmentContext)).toBe(true);
    });

    it('freeze context без geo', () => {
      const context = classificationContext.create({
        userId: 'user1',
        signals: classificationSignals.create({
          isVpn: false,
        })!,
      })!;

      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 10, 0.8, 0, 100);

      const result = buildAssessmentContext({
        device: baseDevice,
        context,
        riskScore: 60,
        ruleEvaluationResult,
      });

      expect(Object.isFrozen(result.assessmentContext!.classificationContext)).toBe(true);
      expect(Object.isFrozen(result.assessmentContext)).toBe(true);
    });

    it('freeze context без signals', () => {
      const context = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
      })!;

      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 10, 0.8, 0, 100);

      const result = buildAssessmentContext({
        device: baseDevice,
        context,
        riskScore: 60,
        ruleEvaluationResult,
      });

      expect(Object.isFrozen(result.assessmentContext!.classificationContext)).toBe(true);
      if (result.assessmentContext!.classificationContext.geo) {
        expect(Object.isFrozen(result.assessmentContext!.classificationContext.geo)).toBe(true);
      }
    });
  });
});
