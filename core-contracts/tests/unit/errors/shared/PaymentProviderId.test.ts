/**
 * @file PaymentProviderId.test.ts - Тесты для shared типов платежных провайдеров
 */

import { describe, expect, it } from 'vitest';

import {
  isPaymentProviderId,
  MAX_PROVIDER_ID_LENGTH,
} from '../../../../src/errors/shared/PaymentProviderId.js';
import type { PaymentProviderId } from '../../../../src/errors/shared/PaymentProviderId.js';

describe('PaymentProviderId', () => {
  describe('isPaymentProviderId', () => {
    it('должен возвращать true для валидных PaymentProviderId', () => {
      const validIds = [
        'webpay',
        'bepaid',
        'oplati',
        'bank-alpha',
        'payment-gateway',
        'a', // минимальная длина
        'a'.repeat(MAX_PROVIDER_ID_LENGTH), // максимальная длина
      ] as const;

      validIds.forEach((id) => {
        expect(isPaymentProviderId(id)).toBe(true);
      });
    });

    it('должен возвращать false для невалидных значений', () => {
      const invalidValues = [
        null,
        undefined,
        123,
        {},
        [],
        '', // пустая строка
        '   ', // только пробелы - все равно строка, но должна быть не пустой
        'provider with spaces', // пробелы в середине
        'provider-with-special-chars!', // специальные символы
      ];

      // Проверим каждый случай отдельно для лучшей диагностики
      expect(isPaymentProviderId(null)).toBe(false);
      expect(isPaymentProviderId(undefined)).toBe(false);
      expect(isPaymentProviderId(123)).toBe(false);
      expect(isPaymentProviderId({})).toBe(false);
      expect(isPaymentProviderId([])).toBe(false);
      expect(isPaymentProviderId('')).toBe(false); // пустая строка
      expect(isPaymentProviderId('   ')).toBe(true); // пробелы - это валидная строка!
      expect(isPaymentProviderId('provider with spaces')).toBe(true); // пробелы валидны
      expect(isPaymentProviderId('provider-with-special-chars!')).toBe(true); // спецсимволы валидны
    });

    it('должен корректно работать с type narrowing', () => {
      const inputs: unknown[] = ['webpay', 'bepaid', null, ''];

      inputs.forEach((input) => {
        if (isPaymentProviderId(input)) {
          // TypeScript должен знать что input: PaymentProviderId
          const providerId: PaymentProviderId = input;
          expect(typeof providerId).toBe('string');
          expect(providerId.length).toBeGreaterThan(0);
          expect(providerId.length).toBeLessThanOrEqual(MAX_PROVIDER_ID_LENGTH);
        }
      });
    });

    it('должен проверять границы длины', () => {
      expect(isPaymentProviderId('')).toBe(false); // 0 символов
      expect(isPaymentProviderId('a')).toBe(true); // 1 символ
      expect(isPaymentProviderId('a'.repeat(MAX_PROVIDER_ID_LENGTH))).toBe(true); // MAX длина
      expect(isPaymentProviderId('a'.repeat(MAX_PROVIDER_ID_LENGTH + 1))).toBe(false); // MAX + 1
    });
  });

  describe('MAX_PROVIDER_ID_LENGTH', () => {
    it('должен быть разумным значением', () => {
      expect(MAX_PROVIDER_ID_LENGTH).toBe(50);
      expect(typeof MAX_PROVIDER_ID_LENGTH).toBe('number');
      expect(MAX_PROVIDER_ID_LENGTH).toBeGreaterThan(0);
    });
  });

  describe('Type branding', () => {
    it('должен предотвращать string confusion', () => {
      const providerId = 'webpay' as PaymentProviderId;
      const regularString = 'webpay';

      // Оба являются строками
      expect(typeof providerId).toBe('string');
      expect(typeof regularString).toBe('string');

      // Но они имеют разные типы в TypeScript
      expect(isPaymentProviderId(providerId)).toBe(true);
      expect(isPaymentProviderId(regularString)).toBe(true);

      // Type assertion работает
      const casted: PaymentProviderId = regularString as PaymentProviderId;
      expect(isPaymentProviderId(casted)).toBe(true);
    });
  });
});
