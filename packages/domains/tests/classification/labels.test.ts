/**
 * @file Unit тесты для Classification Labels
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';

import type {
  ClassificationLabel,
  ClassificationLabelValue,
} from '../../src/classification/labels.js';
import {
  CLASSIFICATION_LABELS,
  classificationLabel,
  classificationLabelUtils,
  classificationPolicy,
} from '../../src/classification/labels.js';

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

/* ============================================================================
 * 🧩 ТИПЫ И КОНСТАНТЫ — TESTS
 * ============================================================================
 */

describe('CLASSIFICATION_LABELS', () => {
  it('содержит все допустимые значения', () => {
    expect(CLASSIFICATION_LABELS).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN']);
  });

  it('является readonly массивом', () => {
    expect(CLASSIFICATION_LABELS).toHaveLength(4);
    expect(Array.isArray(CLASSIFICATION_LABELS)).toBe(true);
  });
});

/* ============================================================================
 * 🏗️ CLASSIFICATION LABEL — VALUE OBJECT MODULE TESTS
 * ============================================================================
 */

describe('classificationLabel', () => {
  describe('create', () => {
    it('создает label из валидной строки SAFE', () => {
      const result = classificationLabel.create('SAFE');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('SAFE');
      }
    });

    it('создает label из валидной строки SUSPICIOUS', () => {
      const result = classificationLabel.create('SUSPICIOUS');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('SUSPICIOUS');
      }
    });

    it('создает label из валидной строки DANGEROUS', () => {
      const result = classificationLabel.create('DANGEROUS');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('DANGEROUS');
      }
    });

    it('создает label из валидной строки UNKNOWN', () => {
      const result = classificationLabel.create('UNKNOWN');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('UNKNOWN');
      }
    });

    it('автоматически нормализует значение (trim) по умолчанию', () => {
      const result = classificationLabel.create('  SAFE  ');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('SAFE');
      }
    });

    it('не нормализует значение при normalize: false', () => {
      const result = classificationLabel.create('  SAFE  ', { normalize: false });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('INVALID_LABEL');
        expect(result.reason.value).toBe('  SAFE  ');
      }
    });

    it('отклоняет не строку (number)', () => {
      const result = classificationLabel.create(123 as unknown as string);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toBe(123);
      }
    });

    it('отклоняет не строку (null)', () => {
      const result = classificationLabel.create(null as unknown as string);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toBe(null);
      }
    });

    it('отклоняет не строку (undefined)', () => {
      const result = classificationLabel.create(undefined as unknown as string);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toBe(undefined);
      }
    });

    it('отклоняет не строку (object)', () => {
      const result = classificationLabel.create({} as unknown as string);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toEqual({});
      }
    });

    it('отклоняет пустую строку', () => {
      const result = classificationLabel.create('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('EMPTY_STRING');
        expect(result.reason.value).toBe('');
      }
    });

    it('отклоняет строку только из пробелов (после trim)', () => {
      const result = classificationLabel.create('   ');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('EMPTY_STRING');
        expect(result.reason.value).toBe('');
      }
    });

    it('отклоняет невалидное значение', () => {
      const result = classificationLabel.create('INVALID');
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'INVALID_LABEL') {
        expect(result.reason.kind).toBe('INVALID_LABEL');
        expect(result.reason.value).toBe('INVALID');
        expect(result.reason.allowedValues).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN']);
      }
    });
  });

  describe('deserialize', () => {
    it('десериализует валидную строку SAFE', () => {
      const result = classificationLabel.deserialize('SAFE');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('SAFE');
      }
    });

    it('десериализует валидную строку SUSPICIOUS', () => {
      const result = classificationLabel.deserialize('SUSPICIOUS');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('SUSPICIOUS');
      }
    });

    it('десериализует валидную строку DANGEROUS', () => {
      const result = classificationLabel.deserialize('DANGEROUS');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('DANGEROUS');
      }
    });

    it('десериализует валидную строку UNKNOWN', () => {
      const result = classificationLabel.deserialize('UNKNOWN');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classificationLabel.value(result.value)).toBe('UNKNOWN');
      }
    });

    it('отклоняет невалидное значение при десериализации', () => {
      const result = classificationLabel.deserialize('INVALID');
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'INVALID_LABEL') {
        expect(result.reason.kind).toBe('INVALID_LABEL');
        expect(result.reason.value).toBe('INVALID');
      }
    });

    it('отклоняет не строку при десериализации', () => {
      const result = classificationLabel.deserialize(123 as unknown as string);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
      }
    });
  });

  describe('value', () => {
    it('извлекает значение SAFE из label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabel.value(lbl)).toBe('SAFE');
    });

    it('извлекает значение SUSPICIOUS из label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationLabel.value(lbl)).toBe('SUSPICIOUS');
    });

    it('извлекает значение DANGEROUS из label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabel.value(lbl)).toBe('DANGEROUS');
    });

    it('извлекает значение UNKNOWN из label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationLabel.value(lbl)).toBe('UNKNOWN');
    });
  });

  describe('isLabel', () => {
    it('возвращает true для валидного label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabel.isLabel(lbl)).toBe(true);
    });

    it('возвращает false для невалидной строки', () => {
      expect(classificationLabel.isLabel('INVALID')).toBe(false);
    });

    it('возвращает false для не строки (number)', () => {
      expect(classificationLabel.isLabel(123 as unknown as ClassificationLabel)).toBe(false);
    });

    it('возвращает false для не строки (null)', () => {
      expect(classificationLabel.isLabel(null as unknown as ClassificationLabel)).toBe(false);
    });

    it('возвращает false для не строки (undefined)', () => {
      expect(classificationLabel.isLabel(undefined as unknown as ClassificationLabel)).toBe(false);
    });

    it('возвращает false для не строки (object)', () => {
      expect(classificationLabel.isLabel({} as unknown as ClassificationLabel)).toBe(false);
    });
  });

  describe('assertValid', () => {
    it('возвращает undefined для валидного label', () => {
      const lbl = createTestLabel('SAFE');
      const error = classificationLabel.assertValid(lbl);
      expect(error).toBeUndefined();
    });

    it('возвращает undefined для всех валидных labels', () => {
      const labels = ['SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN'] as const;
      const results = labels.map((value) => {
        const lbl = createTestLabel(value);
        return classificationLabel.assertValid(lbl);
      });
      results.forEach((error) => {
        expect(error).toBeUndefined();
      });
    });

    it('не выбрасывает ошибку для валидного label при throwOnInvalid: false', () => {
      const lbl = createTestLabel('SAFE');
      expect(() => {
        classificationLabel.assertValid(lbl, { throwOnInvalid: false });
      }).not.toThrow();
    });

    it('не выбрасывает ошибку для валидного label при throwOnInvalid: true', () => {
      const lbl = createTestLabel('SAFE');
      expect(() => {
        classificationLabel.assertValid(lbl, { throwOnInvalid: true });
      }).not.toThrow();
    });
  });
});

/* ============================================================================
 * 🔧 UTILITIES — PURE LABEL HELPERS TESTS
 * ============================================================================
 */

describe('classificationLabelUtils', () => {
  describe('getAllowedValues', () => {
    it('возвращает все допустимые значения', () => {
      const values = classificationLabelUtils.getAllowedValues();
      expect(values).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN']);
    });

    it('возвращает readonly массив', () => {
      const values = classificationLabelUtils.getAllowedValues();
      expect(Array.isArray(values)).toBe(true);
      expect(values).toHaveLength(4);
    });
  });

  describe('isSafe', () => {
    it('возвращает true для SAFE label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabelUtils.isSafe(lbl)).toBe(true);
    });

    it('возвращает false для SUSPICIOUS label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationLabelUtils.isSafe(lbl)).toBe(false);
    });

    it('возвращает false для DANGEROUS label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabelUtils.isSafe(lbl)).toBe(false);
    });

    it('возвращает false для UNKNOWN label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationLabelUtils.isSafe(lbl)).toBe(false);
    });
  });

  describe('isSuspicious', () => {
    it('возвращает true для SUSPICIOUS label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationLabelUtils.isSuspicious(lbl)).toBe(true);
    });

    it('возвращает false для SAFE label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabelUtils.isSuspicious(lbl)).toBe(false);
    });

    it('возвращает false для DANGEROUS label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabelUtils.isSuspicious(lbl)).toBe(false);
    });

    it('возвращает false для UNKNOWN label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationLabelUtils.isSuspicious(lbl)).toBe(false);
    });
  });

  describe('isDangerous', () => {
    it('возвращает true для DANGEROUS label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabelUtils.isDangerous(lbl)).toBe(true);
    });

    it('возвращает false для SAFE label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabelUtils.isDangerous(lbl)).toBe(false);
    });

    it('возвращает false для SUSPICIOUS label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationLabelUtils.isDangerous(lbl)).toBe(false);
    });

    it('возвращает false для UNKNOWN label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationLabelUtils.isDangerous(lbl)).toBe(false);
    });
  });

  describe('isUnknown', () => {
    it('возвращает true для UNKNOWN label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationLabelUtils.isUnknown(lbl)).toBe(true);
    });

    it('возвращает false для SAFE label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabelUtils.isUnknown(lbl)).toBe(false);
    });

    it('возвращает false для SUSPICIOUS label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationLabelUtils.isUnknown(lbl)).toBe(false);
    });

    it('возвращает false для DANGEROUS label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabelUtils.isUnknown(lbl)).toBe(false);
    });
  });

  describe('hasValue', () => {
    it('возвращает true для совпадающего значения SAFE', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabelUtils.hasValue(lbl, 'SAFE')).toBe(true);
    });

    it('возвращает true для совпадающего значения SUSPICIOUS', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationLabelUtils.hasValue(lbl, 'SUSPICIOUS')).toBe(true);
    });

    it('возвращает true для совпадающего значения DANGEROUS', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabelUtils.hasValue(lbl, 'DANGEROUS')).toBe(true);
    });

    it('возвращает true для совпадающего значения UNKNOWN', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationLabelUtils.hasValue(lbl, 'UNKNOWN')).toBe(true);
    });

    it('возвращает false для несовпадающего значения', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationLabelUtils.hasValue(lbl, 'SUSPICIOUS')).toBe(false);
    });

    it('возвращает false для другого несовпадающего значения', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationLabelUtils.hasValue(lbl, 'UNKNOWN')).toBe(false);
    });
  });
});

/* ============================================================================
 * 📋 POLICY — BUSINESS LOGIC TESTS
 * ============================================================================
 */

describe('classificationPolicy', () => {
  describe('requiresReview', () => {
    it('возвращает false для SAFE label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationPolicy.requiresReview(lbl)).toBe(false);
    });

    it('возвращает true для SUSPICIOUS label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationPolicy.requiresReview(lbl)).toBe(true);
    });

    it('возвращает true для DANGEROUS label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationPolicy.requiresReview(lbl)).toBe(true);
    });

    it('возвращает false для UNKNOWN label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationPolicy.requiresReview(lbl)).toBe(false);
    });
  });

  describe('isCritical', () => {
    it('возвращает false для SAFE label', () => {
      const lbl = createTestLabel('SAFE');
      expect(classificationPolicy.isCritical(lbl)).toBe(false);
    });

    it('возвращает false для SUSPICIOUS label', () => {
      const lbl = createTestLabel('SUSPICIOUS');
      expect(classificationPolicy.isCritical(lbl)).toBe(false);
    });

    it('возвращает true для DANGEROUS label', () => {
      const lbl = createTestLabel('DANGEROUS');
      expect(classificationPolicy.isCritical(lbl)).toBe(true);
    });

    it('возвращает false для UNKNOWN label', () => {
      const lbl = createTestLabel('UNKNOWN');
      expect(classificationPolicy.isCritical(lbl)).toBe(false);
    });
  });
});
