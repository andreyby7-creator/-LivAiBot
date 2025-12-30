import { describe, expect, it } from 'vitest';

import {
  BILLING_OPERATION_COUNT,
  BILLING_OPERATION_VALUES,
  BILLING_OPERATIONS,
  isBillingOperation,
  makeBillingOperation,
} from '../../../../../../src/errors/services/billing-service/domain/BillingOperation';
import type { BillingOperation } from '../../../../../../src/errors/services/billing-service/domain/BillingOperation';

// ==================== CONSTANTS ====================

/** Все ожидаемые billing операции */
const EXPECTED_OPERATIONS = {
  PAYMENT: 'payment',
  REFUND: 'refund',
  SUBSCRIPTION: 'subscription',
  VALIDATION: 'validation',
} as const;

/** Недопустимые значения для тестирования */
const INVALID_OPERATION_VALUES = [
  '',
  '   ',
  'transfer',
  'charge',
  'withdraw',
  'deposit',
  'invalid',
  'random',
  'test',
  'payment_extra',
  'PAYMENT', // uppercase
  'refund-invalid',
  'subscription ',
  ' validation',
  'operation123',
] as const;

// ==================== TESTS ====================

describe('BillingOperation', () => {
  describe('BILLING_OPERATIONS', () => {
    it('должен содержать все ожидаемые операции', () => {
      expect(BILLING_OPERATIONS).toEqual(EXPECTED_OPERATIONS);
    });

    it('должен содержать ровно 4 операции', () => {
      const operations = Object.keys(BILLING_OPERATIONS);
      expect(operations).toHaveLength(4);
      expect(operations).toEqual(['PAYMENT', 'REFUND', 'SUBSCRIPTION', 'VALIDATION']);
    });

    it('все значения должны быть брендированными типами BillingOperation', () => {
      Object.values(BILLING_OPERATIONS).forEach((operation) => {
        expect(typeof operation).toBe('string');
        expect(isBillingOperation(operation)).toBe(true);
      });
    });

    it('PAYMENT - операция оплаты', () => {
      expect(BILLING_OPERATIONS.PAYMENT).toBe('payment');
      expect(isBillingOperation(BILLING_OPERATIONS.PAYMENT)).toBe(true);
    });

    it('REFUND - операция возврата', () => {
      expect(BILLING_OPERATIONS.REFUND).toBe('refund');
      expect(isBillingOperation(BILLING_OPERATIONS.REFUND)).toBe(true);
    });

    it('SUBSCRIPTION - операция подписки', () => {
      expect(BILLING_OPERATIONS.SUBSCRIPTION).toBe('subscription');
      expect(isBillingOperation(BILLING_OPERATIONS.SUBSCRIPTION)).toBe(true);
    });

    it('VALIDATION - операция валидации', () => {
      expect(BILLING_OPERATIONS.VALIDATION).toBe('validation');
      expect(isBillingOperation(BILLING_OPERATIONS.VALIDATION)).toBe(true);
    });
  });

  describe('BillingOperation type', () => {
    it('должен быть брендированным типом на основе string', () => {
      // TypeScript проверки - эти строки должны компилироваться
      const paymentOp: BillingOperation = 'payment' as BillingOperation;
      const refundOp: BillingOperation = 'refund' as BillingOperation;
      const subscriptionOp: BillingOperation = 'subscription' as BillingOperation;
      const validationOp: BillingOperation = 'validation' as BillingOperation;

      expect(isBillingOperation(paymentOp)).toBe(true);
      expect(isBillingOperation(refundOp)).toBe(true);
      expect(isBillingOperation(subscriptionOp)).toBe(true);
      expect(isBillingOperation(validationOp)).toBe(true);
    });

    it('должен предотвращать использование произвольных строк', () => {
      // Проверяем что произвольные строки не проходят валидацию
      const invalidOperation = 'INVALID';

      expect(isBillingOperation(invalidOperation)).toBe(false);

      // TypeScript предотвращает присваивание произвольных строк к BillingOperation
      // без явного приведения типа - проверяем через компиляцию
    });
  });

  describe('isBillingOperation', () => {
    it('должен возвращать true для всех поддерживаемых операций', () => {
      Object.values(BILLING_OPERATIONS).forEach((operation) => {
        expect(isBillingOperation(operation)).toBe(true);
      });
    });

    it('должен обеспечивать type narrowing для поддерживаемых операций', () => {
      const testValues = ['payment', 'refund', 'subscription', 'validation'] as const;

      testValues.forEach((value) => {
        expect(isBillingOperation(value)).toBe(true);

        // После проверки isBillingOperation используем type assertion
        const narrowedValue = value as BillingOperation;
        expect(BILLING_OPERATION_VALUES).toContain(narrowedValue);
      });
    });

    it('должен возвращать false для недопустимых значений операций', () => {
      INVALID_OPERATION_VALUES.forEach((invalidOperation) => {
        expect(isBillingOperation(invalidOperation)).toBe(false);
      });
    });

    it('должен возвращать false для null и undefined', () => {
      expect(isBillingOperation(null as any)).toBe(false);
      expect(isBillingOperation(undefined as any)).toBe(false);
    });

    it('должен возвращать false для чисел', () => {
      expect(isBillingOperation('123' as any)).toBe(false);
      expect(isBillingOperation(123 as any)).toBe(false);
    });

    it('должен возвращать false для объектов', () => {
      expect(isBillingOperation({} as any)).toBe(false);
      expect(isBillingOperation([] as any)).toBe(false);
    });

    it('должен быть чувствительным к регистру', () => {
      expect(isBillingOperation('PAYMENT')).toBe(false);
      expect(isBillingOperation('REFUND')).toBe(false);
      expect(isBillingOperation('payment')).toBe(true); // lowercase уже проверено выше
    });

    it('должен корректно работать с граничными случаями', () => {
      // Похожие на операции но недопустимые
      expect(isBillingOperation('payment_extra')).toBe(false);
      expect(isBillingOperation('refund-invalid')).toBe(false);
      expect(isBillingOperation('subscription ')).toBe(false);
      expect(isBillingOperation(' validation')).toBe(false);
      expect(isBillingOperation('operation123')).toBe(false);
    });
  });

  describe('makeBillingOperation', () => {
    it('должен успешно создавать BillingOperation для всех поддерживаемых операций', () => {
      Object.values(BILLING_OPERATIONS).forEach((expectedOperation) => {
        const result = makeBillingOperation(expectedOperation);
        expect(result).toBe(expectedOperation);
        expect(isBillingOperation(result)).toBe(true);
      });
    });

    it('должен выбрасывать ошибку для недопустимых операций', () => {
      INVALID_OPERATION_VALUES.forEach((invalidOperation) => {
        expect(() => makeBillingOperation(invalidOperation)).toThrow(
          `Invalid billing operation: ${invalidOperation}`,
        );
      });
    });

    it('должен обеспечивать type safety при создании', () => {
      // TypeScript проверки
      const paymentOp = makeBillingOperation('payment');
      const refundOp = makeBillingOperation('refund');

      // Эти значения теперь имеют тип BillingOperation
      const paymentTyped: BillingOperation = paymentOp;
      const refundTyped: BillingOperation = refundOp;

      expect(paymentOp).toBe('payment');
      expect(refundOp).toBe('refund');
      expect(paymentTyped).toBe(paymentOp);
      expect(refundTyped).toBe(refundOp);
    });

    it('должен выбрасывать ошибку для null и undefined', () => {
      expect(() => makeBillingOperation(null as any)).toThrow('Invalid billing operation: null');
      expect(() => makeBillingOperation(undefined as any)).toThrow(
        'Invalid billing operation: undefined',
      );
    });

    it('должен выбрасывать ошибку для пустой строки', () => {
      expect(() => makeBillingOperation('')).toThrow('Invalid billing operation: ');
    });
  });

  describe('BILLING_OPERATION_VALUES', () => {
    it('должен содержать все поддерживаемые операции', () => {
      expect(BILLING_OPERATION_VALUES).toHaveLength(4);
      expect(BILLING_OPERATION_VALUES).toEqual(['payment', 'refund', 'subscription', 'validation']);
    });

    it('все значения должны быть BillingOperation', () => {
      BILLING_OPERATION_VALUES.forEach((operation) => {
        expect(isBillingOperation(operation)).toBe(true);
        expect(typeof operation).toBe('string');
      });
    });

    it('должен быть readonly массивом', () => {
      expect(BILLING_OPERATION_VALUES).toBeInstanceOf(Array);

      // Проверяем что массив имеет правильную длину и содержит ожидаемые значения
      expect(BILLING_OPERATION_VALUES).toHaveLength(4);
      expect(BILLING_OPERATION_VALUES).toEqual(['payment', 'refund', 'subscription', 'validation']);

      // TypeScript предотвращает модификацию readonly массива на уровне типов
    });

    it('порядок должен соответствовать порядку в BILLING_OPERATIONS', () => {
      const expectedValues = Object.values(BILLING_OPERATIONS);
      expect(BILLING_OPERATION_VALUES).toEqual(expectedValues);
    });
  });

  describe('BILLING_OPERATION_COUNT', () => {
    it('должен равняться количеству поддерживаемых операций', () => {
      expect(BILLING_OPERATION_COUNT).toBe(4);
      expect(BILLING_OPERATION_COUNT).toBe(Object.keys(BILLING_OPERATIONS).length);
      expect(BILLING_OPERATION_COUNT).toBe(BILLING_OPERATION_VALUES.length);
    });

    it('должен быть числом', () => {
      expect(typeof BILLING_OPERATION_COUNT).toBe('number');
      expect(Number.isInteger(BILLING_OPERATION_COUNT)).toBe(true);
      expect(BILLING_OPERATION_COUNT).toBeGreaterThan(0);
    });
  });

  describe('Integration tests', () => {
    it('isBillingOperation и makeBillingOperation должны работать вместе', () => {
      const testOperations = ['payment', 'refund', 'subscription', 'validation'];

      testOperations.forEach((operationString) => {
        // Проверяем через type guard
        expect(isBillingOperation(operationString)).toBe(true);

        // Создаем через makeBillingOperation
        const createdOperation = makeBillingOperation(operationString);
        expect(createdOperation).toBe(operationString);

        // Проверяем что созданная операция в списке значений
        expect(BILLING_OPERATION_VALUES).toContain(createdOperation);
      });
    });

    it('все константы должны быть согласованы', () => {
      expect(BILLING_OPERATION_COUNT).toBe(Object.keys(BILLING_OPERATIONS).length);
      expect(BILLING_OPERATION_VALUES.length).toBe(BILLING_OPERATION_COUNT);
      expect(BILLING_OPERATION_VALUES).toEqual(Object.values(BILLING_OPERATIONS));

      // Все значения из BILLING_OPERATIONS должны проходить isBillingOperation
      Object.values(BILLING_OPERATIONS).forEach((operation) => {
        expect(isBillingOperation(operation)).toBe(true);
        expect(BILLING_OPERATION_VALUES).toContain(operation);
      });
    });

    it('type safety должен работать в цепочке операций', () => {
      // Создаем операцию через makeBillingOperation
      const operation = makeBillingOperation('payment');

      // Проверяем через isBillingOperation
      expect(isBillingOperation(operation)).toBe(true);

      // Используем в массиве значений
      expect(BILLING_OPERATION_VALUES).toContain(operation);

      // Проверяем количество
      expect(BILLING_OPERATION_COUNT).toBeGreaterThanOrEqual(1);

      // Все операции должны быть type-safe
      const typedOperation: BillingOperation = operation;
      const typedValues: readonly BillingOperation[] = BILLING_OPERATION_VALUES;
      const typedCount: number = BILLING_OPERATION_COUNT;

      // Проверяем что типы корректны
      expect(typedOperation).toBe(operation);
      expect(typedValues).toEqual(BILLING_OPERATION_VALUES);
      expect(typedCount).toBe(BILLING_OPERATION_COUNT);
    });
  });
});
