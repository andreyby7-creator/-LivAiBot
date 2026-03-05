/**
 * @file Unit тесты для Label (Domain-Specific String Labels)
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';

import type { Label, LabelValidator } from '../../src/domain-kit/label.js';
import { label, labelValidators } from '../../src/domain-kit/label.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type RiskLabel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';

function createTestLabel<TLabel extends string = RiskLabel>(
  value: string,
  validator: LabelValidator<TLabel>,
): Label<TLabel> {
  const result = label.create(value, validator);
  if (!result.ok) {
    throw new Error(`Failed to create label: ${JSON.stringify(result.reason)}`);
  }
  return result.value;
}

function createTestValidator(): LabelValidator<RiskLabel> {
  return labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
}

/* ============================================================================
 * 🏗️ LABEL — VALUE OBJECT MODULE TESTS
 * ============================================================================
 */

describe('label', () => {
  describe('create', () => {
    it('создает label из валидной строки', () => {
      const validator = createTestValidator();
      const result = label.create('SAFE', validator);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(label.value(result.value)).toBe('SAFE');
      }
    });

    it('создает label из другого валидного значения', () => {
      const validator = createTestValidator();
      const result = label.create('DANGEROUS', validator);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(label.value(result.value)).toBe('DANGEROUS');
      }
    });

    it('автоматически нормализует значение (trim) по умолчанию', () => {
      const validator = createTestValidator();
      const result = label.create('  SAFE  ', validator);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(label.value(result.value)).toBe('SAFE');
      }
    });

    it('не нормализует значение при normalize: false', () => {
      const validator = createTestValidator();
      const result = label.create('  SAFE  ', validator, { normalize: false });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('INVALID_LABEL');
        expect(result.reason.value).toBe('  SAFE  ');
      }
    });

    it('отклоняет не строку (number)', () => {
      const validator = createTestValidator();
      const result = label.create(123 as unknown as string, validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toBe(123);
      }
    });

    it('отклоняет не строку (null)', () => {
      const validator = createTestValidator();
      const result = label.create(null as unknown as string, validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toBe(null);
      }
    });

    it('отклоняет не строку (undefined)', () => {
      const validator = createTestValidator();
      const result = label.create(undefined as unknown as string, validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toBe(undefined);
      }
    });

    it('отклоняет не строку (object)', () => {
      const validator = createTestValidator();
      const result = label.create({} as unknown as string, validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
        expect(result.reason.value).toEqual({});
      }
    });

    it('отклоняет пустую строку', () => {
      const validator = createTestValidator();
      const result = label.create('', validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('EMPTY_STRING');
        expect(result.reason.value).toBe('');
      }
    });

    it('отклоняет строку только из пробелов (после trim)', () => {
      const validator = createTestValidator();
      const result = label.create('   ', validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('EMPTY_STRING');
        expect(result.reason.value).toBe('');
      }
    });

    it('отклоняет невалидное значение', () => {
      const validator = createTestValidator();
      const result = label.create('INVALID', validator);
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'INVALID_LABEL') {
        expect(result.reason.kind).toBe('INVALID_LABEL');
        expect(result.reason.value).toBe('INVALID');
        expect(result.reason.allowedValues).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      }
    });

    it('отклоняет невалидное значение без getAllowedValues', () => {
      const validator: LabelValidator<RiskLabel> = {
        isValid: (v): v is RiskLabel => ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(v),
      };
      const result = label.create('INVALID', validator);
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason.kind === 'INVALID_LABEL') {
        expect(result.reason.kind).toBe('INVALID_LABEL');
        expect(result.reason.value).toBe('INVALID');
        expect(result.reason.allowedValues).toBeUndefined();
      }
    });

    it('создает label с normalize: true (явно)', () => {
      const validator = createTestValidator();
      const result = label.create('  SUSPICIOUS  ', validator, { normalize: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(label.value(result.value)).toBe('SUSPICIOUS');
      }
    });
  });

  describe('deserialize', () => {
    it('десериализует валидную строку', () => {
      const validator = createTestValidator();
      const result = label.deserialize('SAFE', validator);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(label.value(result.value)).toBe('SAFE');
      }
    });

    it('десериализует невалидную строку', () => {
      const validator = createTestValidator();
      const result = label.deserialize('INVALID', validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('INVALID_LABEL');
      }
    });

    it('десериализует не строку', () => {
      const validator = createTestValidator();
      const result = label.deserialize(123 as unknown as string, validator);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('NOT_A_STRING');
      }
    });
  });

  describe('value', () => {
    it('извлекает строковое значение из label', () => {
      const validator = createTestValidator();
      const lbl = createTestLabel('SAFE', validator);
      expect(label.value(lbl)).toBe('SAFE');
    });

    it('извлекает другое значение', () => {
      const validator = createTestValidator();
      const lbl = createTestLabel('DANGEROUS', validator);
      expect(label.value(lbl)).toBe('DANGEROUS');
    });
  });

  describe('isLabel', () => {
    it('возвращает true для валидного label', () => {
      const validator = createTestValidator();
      expect(label.isLabel('SAFE', validator)).toBe(true);
      expect(label.isLabel('SUSPICIOUS', validator)).toBe(true);
      expect(label.isLabel('DANGEROUS', validator)).toBe(true);
    });

    it('возвращает false для не строки (number)', () => {
      const validator = createTestValidator();
      expect(label.isLabel(123 as unknown as string, validator)).toBe(false);
    });

    it('возвращает false для не строки (null)', () => {
      const validator = createTestValidator();
      expect(label.isLabel(null as unknown as string, validator)).toBe(false);
    });

    it('возвращает false для не строки (undefined)', () => {
      const validator = createTestValidator();
      expect(label.isLabel(undefined as unknown as string, validator)).toBe(false);
    });

    it('возвращает false для пустой строки', () => {
      const validator = createTestValidator();
      expect(label.isLabel('', validator)).toBe(false);
    });

    it('возвращает false для невалидного значения', () => {
      const validator = createTestValidator();
      expect(label.isLabel('INVALID', validator)).toBe(false);
    });
  });

  describe('assertValid', () => {
    it('возвращает undefined для валидного label', () => {
      const validator = createTestValidator();
      const lbl = createTestLabel('SAFE', validator);
      const result = label.assertValid(lbl, validator);
      expect(result).toBeUndefined();
    });

    it('возвращает reason для невалидного label', () => {
      const validator = createTestValidator();
      // Создаем невалидный label через каст (для тестирования assertValid)
      const invalidLabel = 'INVALID' as Label<RiskLabel>;
      const result = label.assertValid(invalidLabel, validator);
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(result.kind).toBe('INVALID_LABEL');
        expect(result.value).toBe('INVALID');
      }
    });

    it('бросает исключение при throwOnInvalid: true и невалидном label', () => {
      const validator = createTestValidator();
      const invalidLabel = 'INVALID' as Label<RiskLabel>;
      expect(() => {
        label.assertValid(invalidLabel, validator, { throwOnInvalid: true });
      }).toThrow('Invalid label: INVALID_LABEL');
    });

    it('не бросает исключение при throwOnInvalid: false', () => {
      const validator = createTestValidator();
      const invalidLabel = 'INVALID' as Label<RiskLabel>;
      const result = label.assertValid(invalidLabel, validator, { throwOnInvalid: false });
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(result.kind).toBe('INVALID_LABEL');
      }
    });

    it('не бросает исключение при throwOnInvalid: undefined', () => {
      const validator = createTestValidator();
      const invalidLabel = 'INVALID' as Label<RiskLabel>;
      // Передаем пустой объект options (throwOnInvalid будет undefined)
      const result = label.assertValid(invalidLabel, validator, {});
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(result.kind).toBe('INVALID_LABEL');
      }
    });

    it('не бросает исключение при отсутствии options', () => {
      const validator = createTestValidator();
      const invalidLabel = 'INVALID' as Label<RiskLabel>;
      const result = label.assertValid(invalidLabel, validator);
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(result.kind).toBe('INVALID_LABEL');
      }
    });

    it('возвращает reason с правильной структурой для INVALID_LABEL', () => {
      const validator = createTestValidator();
      const invalidLabel = 'INVALID' as Label<RiskLabel>;
      const result = label.assertValid(invalidLabel, validator);
      expect(result).not.toBeUndefined();
      if (result?.kind === 'INVALID_LABEL') {
        expect(result.kind).toBe('INVALID_LABEL');
        expect(result.value).toBe('INVALID');
        expect(result.allowedValues).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      }
    });

    it('возвращает reason для пустого label (EMPTY_STRING)', () => {
      const validator = createTestValidator();
      // Создаем пустой label через каст (для тестирования assertValid)
      const emptyLabel = '' as Label<RiskLabel>;
      const result = label.assertValid(emptyLabel, validator);
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(result.kind).toBe('EMPTY_STRING');
        expect(result.value).toBe('');
      }
    });
  });
});

/* ============================================================================
 * 🏭 LABEL VALIDATORS — PRESET VALIDATORS FACTORY TESTS
 * ============================================================================
 */

describe('labelValidators', () => {
  describe('whitelist', () => {
    it('создает validator для whitelist значений', () => {
      const validator = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      expect(validator.isValid('SAFE')).toBe(true);
      expect(validator.isValid('SUSPICIOUS')).toBe(true);
      expect(validator.isValid('DANGEROUS')).toBe(true);
      expect(validator.isValid('INVALID')).toBe(false);
    });

    it('возвращает getAllowedValues', () => {
      const validator = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      const allowedValues = validator.getAllowedValues?.();
      expect(allowedValues).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
    });

    it('кеширует validator для одного и того же массива (WeakMap)', () => {
      const allowedValues: readonly RiskLabel[] = ['SAFE', 'SUSPICIOUS', 'DANGEROUS'];
      const validator1 = labelValidators.whitelist<RiskLabel>(allowedValues);
      const validator2 = labelValidators.whitelist<RiskLabel>(allowedValues);
      // Должен вернуть тот же validator из кеша
      expect(validator1).toBe(validator2);
    });

    it('кеширует validator для динамических массивов (Map)', () => {
      // Создаем два разных массива с одинаковыми значениями
      const validator1 = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      const validator2 = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      // Должен вернуть тот же validator из Map кеша
      expect(validator1).toBe(validator2);
    });

    it('не кеширует validator при useCache: false', () => {
      const allowedValues: readonly RiskLabel[] = ['SAFE', 'SUSPICIOUS', 'DANGEROUS'];
      const validator1 = labelValidators.whitelist<RiskLabel>(allowedValues, false);
      const validator2 = labelValidators.whitelist<RiskLabel>(allowedValues, false);
      // Должны быть разные validator'ы
      expect(validator1).not.toBe(validator2);
    });

    it('создает новый validator при useCache: false', () => {
      const validator = labelValidators.whitelist<RiskLabel>(
        ['SAFE', 'SUSPICIOUS', 'DANGEROUS'],
        false,
      );
      expect(validator.isValid('SAFE')).toBe(true);
      expect(validator.isValid('INVALID')).toBe(false);
    });

    it('работает с разными порядками значений (кеш по отсортированному ключу)', () => {
      const validator1 = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      const validator2 = labelValidators.whitelist<RiskLabel>(['DANGEROUS', 'SAFE', 'SUSPICIOUS']);
      // Должен вернуть тот же validator из Map кеша (ключ создается из отсортированного массива)
      expect(validator1).toBe(validator2);
    });

    it("создает разные validator'ы для разных значений", () => {
      const validator1 = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
      const validator2 = labelValidators.whitelist<string>(['OTHER', 'VALUES']);
      expect(validator1).not.toBe(validator2);
      expect(validator1.isValid('SAFE')).toBe(true);
      expect(validator2.isValid('SAFE')).toBe(false);
    });
  });

  describe('pattern', () => {
    it('создает validator для pattern matching', () => {
      const validator = labelValidators.pattern<RiskLabel>(/^[A-Z_]+$/, [
        'SAFE',
        'SUSPICIOUS',
        'DANGEROUS',
      ]);
      expect(validator.isValid('SAFE')).toBe(true);
      expect(validator.isValid('SUSPICIOUS')).toBe(true);
      expect(validator.isValid('DANGEROUS')).toBe(true);
      expect(validator.isValid('invalid')).toBe(false);
      expect(validator.isValid('123')).toBe(false);
    });

    it('возвращает getAllowedValues если передан', () => {
      const validator = labelValidators.pattern<RiskLabel>(/^[A-Z_]+$/, [
        'SAFE',
        'SUSPICIOUS',
        'DANGEROUS',
      ]);
      const allowedValues = validator.getAllowedValues?.();
      expect(allowedValues).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
    });

    it('возвращает undefined для getAllowedValues если не передан', () => {
      const validator = labelValidators.pattern<RiskLabel>(/^[A-Z_]+$/);
      const allowedValues = validator.getAllowedValues?.();
      expect(allowedValues).toBeUndefined();
    });

    it('работает с различными regex паттернами', () => {
      const validator = labelValidators.pattern<string>(/^[a-z]+$/);
      expect(validator.isValid('lowercase')).toBe(true);
      expect(validator.isValid('UPPERCASE')).toBe(false);
    });
  });

  describe('custom', () => {
    it('создает validator для custom функции валидации', () => {
      const validator = labelValidators.custom<RiskLabel>(
        (v): v is RiskLabel => ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(v),
        ['SAFE', 'SUSPICIOUS', 'DANGEROUS'],
      );
      expect(validator.isValid('SAFE')).toBe(true);
      expect(validator.isValid('SUSPICIOUS')).toBe(true);
      expect(validator.isValid('DANGEROUS')).toBe(true);
      expect(validator.isValid('INVALID')).toBe(false);
    });

    it('возвращает getAllowedValues если передан', () => {
      const validator = labelValidators.custom<RiskLabel>(
        (v): v is RiskLabel => ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(v),
        ['SAFE', 'SUSPICIOUS', 'DANGEROUS'],
      );
      const allowedValues = validator.getAllowedValues?.();
      expect(allowedValues).toEqual(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
    });

    it('возвращает undefined для getAllowedValues если не передан', () => {
      const validator = labelValidators.custom<RiskLabel>(
        (v): v is RiskLabel => ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(v),
      );
      const allowedValues = validator.getAllowedValues?.();
      expect(allowedValues).toBeUndefined();
    });

    it('работает с сложной custom логикой', () => {
      const validator = labelValidators.custom<string>(
        (v): v is string => v.length > 0 && v === v.toUpperCase(),
      );
      expect(validator.isValid('UPPERCASE')).toBe(true);
      expect(validator.isValid('lowercase')).toBe(false);
      expect(validator.isValid('')).toBe(false);
    });
  });
});
