import { describe, expect, it } from 'vitest';

import {
  detectPCISensitiveFields,
  isPCISensitiveField,
  PCI_SENSITIVE_FIELDS,
  sanitizePCISensitiveData,
} from '../../../../src/errors/shared/security';
import type { PCISensitiveField } from '../../../../src/errors/shared/security';

// ==================== CONSTANTS ====================

/** Все ожидаемые PCI sensitive поля для проверки */
const EXPECTED_PCI_FIELDS: readonly PCISensitiveField[] = [
  'amount',
  'cardNumber',
  'cvv',
  'cvv2',
  'expiry',
  'cardholderName',
  'pin',
  'magneticStripe',
  'chipData',
  'track1',
  'track2',
  'cavv',
  'eci',
  'xid',
] as const;

/** Non-sensitive поля для тестирования */
const NON_SENSITIVE_FIELDS = [
  'userId',
  'email',
  'name',
  'status',
  'timestamp',
  'correlationId',
  'operation',
  'provider',
] as const;

// ==================== TESTS ====================

describe('SecurityUtils', () => {
  describe('PCI_SENSITIVE_FIELDS', () => {
    it('должен содержать все ожидаемые PCI sensitive поля', () => {
      expect(PCI_SENSITIVE_FIELDS).toEqual(EXPECTED_PCI_FIELDS);
    });

    it('должен быть readonly массивом', () => {
      expect(PCI_SENSITIVE_FIELDS).toBeInstanceOf(Array);
      // as const делает массив readonly на уровне типов
      // Проверяем что все элементы имеют правильные строковые значения
      PCI_SENSITIVE_FIELDS.forEach((field) => {
        expect(typeof field).toBe('string');
        expect(field.length).toBeGreaterThan(0);
      });
    });

    it('должен содержать ровно 14 полей', () => {
      expect(PCI_SENSITIVE_FIELDS).toHaveLength(14);
    });
  });

  describe('PCISensitiveField type', () => {
    it('должен быть union типом всех PCI sensitive полей', () => {
      // Проверяем что каждый элемент массива соответствует типу
      PCI_SENSITIVE_FIELDS.forEach((field) => {
        expect(EXPECTED_PCI_FIELDS).toContain(field);
      });
    });
  });

  describe('detectPCISensitiveFields', () => {
    it('должен возвращать пустой массив для пустого объекта', () => {
      const result = detectPCISensitiveFields({});
      expect(result).toEqual([]);
      expect(result).toBeInstanceOf(Array);
    });

    it('должен обнаруживать одно PCI sensitive поле', () => {
      const obj = { cardNumber: '4111111111111111' };
      const result = detectPCISensitiveFields(obj);
      expect(result).toEqual(['cardNumber']);
    });

    it('должен обнаруживать несколько PCI sensitive полей', () => {
      const obj = {
        amount: 100,
        cardNumber: '4111111111111111',
        cvv: '123',
        expiry: '12/25',
      };
      const result = detectPCISensitiveFields(obj);
      expect(result).toEqual(['amount', 'cardNumber', 'cvv', 'expiry']);
    });

    it('должен игнорировать non-sensitive поля', () => {
      const obj = {
        userId: 123,
        email: 'user@example.com',
        status: 'active',
      };
      const result = detectPCISensitiveFields(obj);
      expect(result).toEqual([]);
    });

    it('должен обнаруживать только sensitive поля в mixed объекте', () => {
      const obj = {
        userId: 123,
        cardNumber: '4111111111111111',
        email: 'user@example.com',
        cvv: '123',
        status: 'active',
        amount: 100,
      };
      const result = detectPCISensitiveFields(obj);
      expect(result).toEqual(['amount', 'cardNumber', 'cvv']); // Порядок из PCI_SENSITIVE_FIELDS
    });

    it('должен возвращать поля в порядке их определения в PCI_SENSITIVE_FIELDS', () => {
      const obj = {
        xid: 'xid-value',
        amount: 100,
        eci: 'eci-value',
        cardNumber: '4111111111111111',
      };
      const result = detectPCISensitiveFields(obj);
      expect(result).toEqual(['amount', 'cardNumber', 'eci', 'xid']);
    });

    it('должен проверять только top-level свойства (не рекурсивно)', () => {
      const obj = {
        userId: 123,
        nested: {
          cardNumber: '4111111111111111', // Это не должно быть обнаружено
        },
      };
      const result = detectPCISensitiveFields(obj);
      expect(result).toEqual([]);
    });
  });

  describe('isPCISensitiveField', () => {
    it('должен возвращать true для всех PCI sensitive полей', () => {
      PCI_SENSITIVE_FIELDS.forEach((field) => {
        expect(isPCISensitiveField(field)).toBe(true);
      });
    });

    it('должен обеспечивать type narrowing для PCI sensitive полей', () => {
      const testField = 'cardNumber' as string;

      expect(isPCISensitiveField(testField)).toBe(true);

      // После проверки isPCISensitiveField TypeScript знает что testField: PCISensitiveField
      const narrowedField = testField as PCISensitiveField; // Type assertion после проверки
      expect(PCI_SENSITIVE_FIELDS).toContain(narrowedField);
    });

    it('должен возвращать false для non-sensitive полей', () => {
      NON_SENSITIVE_FIELDS.forEach((field) => {
        expect(isPCISensitiveField(field)).toBe(false);
      });
    });

    it('должен возвращать false для пустой строки', () => {
      expect(isPCISensitiveField('')).toBe(false);
    });

    it('должен возвращать false для случайных строк', () => {
      expect(isPCISensitiveField('randomField')).toBe(false);
      expect(isPCISensitiveField('unknown')).toBe(false);
      expect(isPCISensitiveField('test')).toBe(false);
    });

    it('должен корректно работать с граничными случаями', () => {
      // Поля которые похожи на sensitive но ими не являются
      expect(isPCISensitiveField('cardNumberX')).toBe(false);
      expect(isPCISensitiveField('amount_old')).toBe(false);
      expect(isPCISensitiveField('cvv_backup')).toBe(false);
    });
  });

  describe('sanitizePCISensitiveData', () => {
    it('должен возвращать пустой объект для пустого объекта', () => {
      const result = sanitizePCISensitiveData({});
      expect(result).toEqual({});
    });

    it('должен возвращать пустой объект если все поля sensitive', () => {
      const obj = {
        cardNumber: '4111111111111111',
        cvv: '123',
        amount: 100,
      };
      const result = sanitizePCISensitiveData(obj);
      expect(result).toEqual({});
    });

    it('должен возвращать тот же объект если нет sensitive полей', () => {
      const obj = {
        userId: 123,
        email: 'user@example.com',
        status: 'active',
        timestamp: '2024-01-01',
      };
      const result = sanitizePCISensitiveData(obj);
      expect(result).toEqual(obj);
    });

    it('должен удалять только sensitive поля из mixed объекта', () => {
      const obj = {
        userId: 123,
        cardNumber: '4111111111111111',
        email: 'user@example.com',
        cvv: '123',
        status: 'active',
        amount: 100,
        correlationId: 'corr-123',
        expiry: '12/25',
      };

      const result = sanitizePCISensitiveData(obj);

      expect(result).toEqual({
        userId: 123,
        email: 'user@example.com',
        status: 'active',
        correlationId: 'corr-123',
      });

      // Проверяем что sensitive поля действительно удалены
      expect(result).not.toHaveProperty('cardNumber');
      expect(result).not.toHaveProperty('cvv');
      expect(result).not.toHaveProperty('amount');
      expect(result).not.toHaveProperty('expiry');
    });

    it('должен обеспечивать type safety - исключать sensitive поля из типа', () => {
      const obj = {
        userId: 123,
        cardNumber: '4111111111111111',
        email: 'user@example.com',
        cvv: '123',
      };

      const result = sanitizePCISensitiveData(obj);

      // TypeScript должен понимать что result не содержит sensitive поля
      expect(result).toHaveProperty('userId', 123);
      expect(result).toHaveProperty('email', 'user@example.com');

      // Sensitive поля должны быть удалены
      expect(result).not.toHaveProperty('cardNumber');
      expect(result).not.toHaveProperty('cvv');

      // Проверяем что тип действительно исключает sensitive поля
      type ExpectedType = { userId: number; email: string; };
      const typedResult: ExpectedType = result; // Должно компилироваться
      expect(typedResult.userId).toBe(123);
    });

    it('должен сохранять порядок свойств non-sensitive полей', () => {
      const obj = {
        correlationId: 'corr-123',
        cardNumber: '4111111111111111',
        userId: 456,
        cvv: '123',
        email: 'user@example.com',
        amount: 100,
        status: 'active',
      };

      const result = sanitizePCISensitiveData(obj);

      const keys = Object.keys(result);
      expect(keys).toEqual(['correlationId', 'userId', 'email', 'status']);
    });

    it('должен корректно работать с различными типами значений', () => {
      const obj = {
        userId: 123,
        cardNumber: '4111111111111111',
        isActive: true,
        metadata: { nested: 'value' },
        amount: 100.50,
        tags: ['tag1', 'tag2'],
        cvv: '123',
      };

      const result = sanitizePCISensitiveData(obj);

      expect(result).toEqual({
        userId: 123,
        isActive: true,
        metadata: { nested: 'value' },
        tags: ['tag1', 'tag2'],
      });
    });
  });

  describe('Integration tests', () => {
    it('detectPCISensitiveFields и sanitizePCISensitiveData должны работать вместе', () => {
      const obj = {
        userId: 123,
        cardNumber: '4111111111111111',
        email: 'user@example.com',
        cvv: '123',
        amount: 100,
        status: 'active',
      };

      const sensitiveFields = detectPCISensitiveFields(obj);
      const sanitized = sanitizePCISensitiveData(obj);

      expect(sensitiveFields).toEqual(['amount', 'cardNumber', 'cvv']); // Порядок из PCI_SENSITIVE_FIELDS
      expect(sanitized).toEqual({
        userId: 123,
        email: 'user@example.com',
        status: 'active',
      });

      // После санитизации не должно быть sensitive полей
      expect(detectPCISensitiveFields(sanitized)).toEqual([]);
    });

    it('isPCISensitiveField должен работать с detectPCISensitiveFields', () => {
      const obj = {
        userId: 123,
        cardNumber: '4111111111111111',
        cvv: '123',
      };

      const sensitiveFields = detectPCISensitiveFields(obj);

      sensitiveFields.forEach((field) => {
        expect(isPCISensitiveField(field)).toBe(true);
      });

      // Проверяем что найденные поля действительно sensitive
      expect(sensitiveFields).toContain('cardNumber');
      expect(sensitiveFields).toContain('cvv');
    });
  });
});
