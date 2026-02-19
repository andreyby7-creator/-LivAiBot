/**
 * @file Unit тесты для Classification Evaluation Result
 * Полное покрытие всех типов и их свойств (100%)
 */
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- Тесты могут использовать прямой импорт из @livai/core
import { confidence, evaluationLevel, evaluationScale } from '@livai/core';
import type {
  ClassificationLabel,
  ClassificationLabelValue,
} from '../../../src/classification/labels.js';
import { classificationLabel } from '../../../src/classification/labels.js';
import type { ClassificationSignals } from '../../../src/classification/signals/signals.js';
import {
  classificationContext,
  classificationSignals,
} from '../../../src/classification/signals/signals.js';
import type { ClassificationEvaluationResult } from '../../../src/classification/evaluation/result.js';

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
 * 🧩 ТИПЫ — CLASSIFICATION EVALUATION RESULT TESTS
 * ============================================================================
 */

describe('ClassificationEvaluationResult', () => {
  describe('тип и структура', () => {
    it('может быть создан с минимальными обязательными полями', () => {
      const result = createTestEvaluationResult('SAFE', 10, 0.9, 0, 100);
      expect(result).toHaveProperty('evaluationLevel');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('scale');
    });

    it('может быть создан со всеми полями включая usedSignals', () => {
      const baseResult = createTestEvaluationResult('SUSPICIOUS', 50, 0.7, 0, 100);
      const signals: ClassificationSignals = {
        isVpn: true,
        reputationScore: 75,
      };
      const signalsResult = classificationSignals.create(signals);
      if (!signalsResult) {
        throw new Error('Failed to create signals');
      }
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        usedSignals: ['isVpn', 'reputationScore', 'velocityScore'],
      };
      expect(result.usedSignals).toEqual(['isVpn', 'reputationScore', 'velocityScore']);
    });

    it('может быть создан со всеми полями включая context', () => {
      const baseResult = createTestEvaluationResult('DANGEROUS', 90, 0.5, 0, 100);
      const contextData = {
        ip: '192.168.1.1',
        userId: 'user123',
      };
      const contextResult = classificationContext.create(contextData);
      if (!contextResult) {
        throw new Error('Failed to create context');
      }
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        context: contextResult,
      };
      expect(result.context).toBeDefined();
      expect(result.context?.ip).toBe('192.168.1.1');
    });

    it('может быть создан со всеми полями (usedSignals и context)', () => {
      const baseResult = createTestEvaluationResult('UNKNOWN', 30, 0.8, 0, 100);
      const signals: ClassificationSignals = {
        isVpn: false,
      };
      const signalsResult = classificationSignals.create(signals);
      if (!signalsResult) {
        throw new Error('Failed to create signals');
      }
      const contextData = {
        ip: '10.0.0.1',
      };
      const contextResult = classificationContext.create(contextData);
      if (!contextResult) {
        throw new Error('Failed to create context');
      }
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        usedSignals: ['isVpn', 'isTor'],
        context: contextResult,
      };
      expect(result.usedSignals).toEqual(['isVpn', 'isTor']);
      expect(result.context).toBeDefined();
    });
  });

  describe('обязательные поля', () => {
    it('содержит evaluationLevel с правильным типом', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(typeof result.evaluationLevel).toBe('number');
      expect(result.evaluationLevel).toBe(20);
    });

    it('содержит confidence с правильным типом', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBe(0.95);
    });

    it('содержит label с правильным типом', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(result.label).toBeDefined();
      const labelValue = classificationLabel.value(result.label);
      expect(labelValue).toBe('SAFE');
    });

    it('содержит scale с правильным типом', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(result.scale).toBeDefined();
      expect(result.scale.domain).toBe('classification');
      expect(result.scale.min).toBe(0);
      expect(result.scale.max).toBe(100);
    });
  });

  describe('опциональные поля', () => {
    it('usedSignals может отсутствовать', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(result.usedSignals).toBeUndefined();
    });

    it('context может отсутствовать', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(result.context).toBeUndefined();
    });

    it('usedSignals и context могут отсутствовать одновременно', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(result.usedSignals).toBeUndefined();
      expect(result.context).toBeUndefined();
    });
  });

  describe('строгая типизация usedSignals', () => {
    it('usedSignals принимает только валидные ключи ClassificationSignals', () => {
      const baseResult = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        usedSignals: ['isVpn', 'isTor', 'isProxy', 'asn', 'reputationScore', 'velocityScore'],
      };
      expect(result.usedSignals).toBeDefined();
      expect(result.usedSignals?.length).toBe(6);
    });

    it('usedSignals может содержать все возможные ключи', () => {
      const baseResult = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      const allKeys: (keyof ClassificationSignals)[] = [
        'isVpn',
        'isTor',
        'isProxy',
        'asn',
        'reputationScore',
        'velocityScore',
        'previousGeo',
        'evaluationLevel',
        'confidence',
        'externalSignals',
      ];
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        usedSignals: allKeys,
      };
      expect(result.usedSignals).toEqual(allKeys);
    });

    it('usedSignals может быть пустым массивом', () => {
      const baseResult = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        usedSignals: [],
      };
      expect(result.usedSignals).toEqual([]);
    });
  });

  describe('различные значения label', () => {
    it('может быть создан с label SAFE', () => {
      const result = createTestEvaluationResult('SAFE', 10, 0.9, 0, 100);
      const labelValue = classificationLabel.value(result.label);
      expect(labelValue).toBe('SAFE');
    });

    it('может быть создан с label SUSPICIOUS', () => {
      const result = createTestEvaluationResult('SUSPICIOUS', 50, 0.7, 0, 100);
      const labelValue = classificationLabel.value(result.label);
      expect(labelValue).toBe('SUSPICIOUS');
    });

    it('может быть создан с label DANGEROUS', () => {
      const result = createTestEvaluationResult('DANGEROUS', 90, 0.5, 0, 100);
      const labelValue = classificationLabel.value(result.label);
      expect(labelValue).toBe('DANGEROUS');
    });

    it('может быть создан с label UNKNOWN', () => {
      const result = createTestEvaluationResult('UNKNOWN', 30, 0.8, 0, 100);
      const labelValue = classificationLabel.value(result.label);
      expect(labelValue).toBe('UNKNOWN');
    });
  });

  describe('различные значения evaluationLevel', () => {
    it('может быть создан с низким evaluationLevel', () => {
      const result = createTestEvaluationResult('SAFE', 5, 0.95, 0, 100);
      expect(result.evaluationLevel).toBe(5);
    });

    it('может быть создан со средним evaluationLevel', () => {
      const result = createTestEvaluationResult('SUSPICIOUS', 50, 0.7, 0, 100);
      expect(result.evaluationLevel).toBe(50);
    });

    it('может быть создан с высоким evaluationLevel', () => {
      const result = createTestEvaluationResult('DANGEROUS', 95, 0.3, 0, 100);
      expect(result.evaluationLevel).toBe(95);
    });

    it('может быть создан с граничным evaluationLevel (min)', () => {
      const result = createTestEvaluationResult('SAFE', 0, 0.9, 0, 100);
      expect(result.evaluationLevel).toBe(0);
    });

    it('может быть создан с граничным evaluationLevel (max)', () => {
      const result = createTestEvaluationResult('DANGEROUS', 100, 0.1, 0, 100);
      expect(result.evaluationLevel).toBe(100);
    });
  });

  describe('различные значения confidence', () => {
    it('может быть создан с низким confidence', () => {
      const result = createTestEvaluationResult('UNKNOWN', 30, 0.1, 0, 100);
      expect(result.confidence).toBe(0.1);
    });

    it('может быть создан со средним confidence', () => {
      const result = createTestEvaluationResult('SUSPICIOUS', 50, 0.5, 0, 100);
      expect(result.confidence).toBe(0.5);
    });

    it('может быть создан с высоким confidence', () => {
      const result = createTestEvaluationResult('SAFE', 10, 0.99, 0, 100);
      expect(result.confidence).toBe(0.99);
    });

    it('может быть создан с граничным confidence (0)', () => {
      const result = createTestEvaluationResult('UNKNOWN', 30, 0, 0, 100);
      expect(result.confidence).toBe(0);
    });

    it('может быть создан с граничным confidence (1)', () => {
      const result = createTestEvaluationResult('SAFE', 5, 1, 0, 100);
      expect(result.confidence).toBe(1);
    });
  });

  describe('различные значения scale', () => {
    it('может быть создан с scale 0-100', () => {
      const result = createTestEvaluationResult('SAFE', 50, 0.9, 0, 100);
      expect(result.scale.min).toBe(0);
      expect(result.scale.max).toBe(100);
    });

    it('может быть создан с scale 0-10', () => {
      const scaleResult = evaluationScale.create(0, 10, 'classification');
      if (!scaleResult.ok) {
        throw new Error('Failed to create scale');
      }
      const scale = scaleResult.value;
      const levelResult = evaluationLevel.create(5, scale);
      if (!levelResult.ok) {
        throw new Error('Failed to create level');
      }
      const label = createTestLabel('SAFE');
      const confidenceResult = confidence.create(0.9, 'classification');
      if (!confidenceResult.ok) {
        throw new Error('Failed to create confidence');
      }
      const result: ClassificationEvaluationResult = {
        evaluationLevel: levelResult.value,
        confidence: confidenceResult.value,
        label,
        scale,
      };
      expect(result.scale.min).toBe(0);
      expect(result.scale.max).toBe(10);
    });

    it('может быть создан с scale 1-5', () => {
      const scaleResult = evaluationScale.create(1, 5, 'classification');
      if (!scaleResult.ok) {
        throw new Error('Failed to create scale');
      }
      const scale = scaleResult.value;
      const levelResult = evaluationLevel.create(3, scale);
      if (!levelResult.ok) {
        throw new Error('Failed to create level');
      }
      const label = createTestLabel('SUSPICIOUS');
      const confidenceResult = confidence.create(0.7, 'classification');
      if (!confidenceResult.ok) {
        throw new Error('Failed to create confidence');
      }
      const result: ClassificationEvaluationResult = {
        evaluationLevel: levelResult.value,
        confidence: confidenceResult.value,
        label,
        scale,
      };
      expect(result.scale.min).toBe(1);
      expect(result.scale.max).toBe(5);
    });
  });

  describe('immutability', () => {
    it('все поля readonly и не могут быть изменены', () => {
      const result = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      expect(Object.isFrozen(result)).toBe(false); // Readonly не означает frozen
      // Проверяем, что поля доступны только для чтения через TypeScript
      expect(result.evaluationLevel).toBe(20);
      expect(result.confidence).toBe(0.95);
    });

    it('usedSignals является readonly массивом', () => {
      const baseResult = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        usedSignals: ['isVpn'],
      };
      expect(Array.isArray(result.usedSignals)).toBe(true);
      expect(result.usedSignals).toEqual(['isVpn']);
    });
  });

  describe('context структура', () => {
    it('context может содержать все поля ClassificationContext', () => {
      const baseResult = createTestEvaluationResult('SAFE', 20, 0.95, 0, 100);
      const contextData = {
        ip: '192.168.1.1',
        userId: 'user123',
        previousSessionId: 'session456',
        timestamp: '2024-01-01T00:00:00Z',
      };
      const contextResult = classificationContext.create(contextData);
      if (!contextResult) {
        throw new Error('Failed to create context');
      }
      const result: ClassificationEvaluationResult = {
        ...baseResult,
        context: contextResult,
      };
      expect(result.context?.ip).toBe('192.168.1.1');
      expect(result.context?.userId).toBe('user123');
      expect(result.context?.previousSessionId).toBe('session456');
      expect(result.context?.timestamp).toBe('2024-01-01T00:00:00Z');
    });
  });
});
