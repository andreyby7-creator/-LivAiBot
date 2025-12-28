import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  validateAmount,
  validateCurrency,
  validatePaymentMethod,
  validateBillingOperation,
} from '../../../../../src/errors/services/billing-service/BillingServiceValidators.js';
import { SERVICE_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../../../src/errors/base/ErrorConstants.js';
import type { PaymentFailedError } from '../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';

// ==================== HELPERS ====================

/** Helper для выполнения Effect и получения результата */
const runEffect = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runSync(Effect.either(effect));
};

/** Helper для проверки структуры PaymentFailedError */
const expectPaymentFailedError = (error: PaymentFailedError, expectedCode: string) => {
  expect(error._tag).toBe('PaymentFailedError');
  expect(error.code).toBe(expectedCode);
  expect(error.origin).toBe(ERROR_ORIGIN.SERVICE);
  expect(error.category).toBe(ERROR_CATEGORY.BUSINESS);
  expect(error.severity).toBe(ERROR_SEVERITY.HIGH);
  expect(error.timestamp).toBeDefined();
  expect(typeof error.timestamp).toBe('string');
  expect(error.details.transactionId).toBeDefined();
};

// ==================== VALIDATE AMOUNT TESTS ====================

describe('validateAmount', () => {
  describe('success cases', () => {
    it('should validate positive finite amount for BYN', () => {
      const result = runEffect(validateAmount(1000, 'BYN'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe(1000);
      }
    });

    it('should validate positive finite amount for USD', () => {
      const result = runEffect(validateAmount(5000, 'USD'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe(5000);
      }
    });

    it('should validate decimal amounts', () => {
      const result = runEffect(validateAmount(99.99, 'EUR'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe(99.99);
      }
    });

    it('should validate minimum valid amount for RUB', () => {
      const result = runEffect(validateAmount(100, 'RUB')); // 1.00 RUB
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe(100);
      }
    });
  });

  describe('error cases', () => {
    it('should reject zero amount', () => {
      const result = runEffect(validateAmount(0, 'BYN'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.amount).toBe(0);
        expect(result.left.details.currency).toBe('BYN');
      }
    });

    it('should reject negative amount', () => {
      const result = runEffect(validateAmount(-100, 'USD'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.amount).toBe(-100);
      }
    });

    it('should reject NaN', () => {
      const result = runEffect(validateAmount(NaN, 'EUR'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.amount).toBe(NaN);
      }
    });

    it('should reject Infinity', () => {
      const result = runEffect(validateAmount(Infinity, 'RUB'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.amount).toBe(Infinity);
      }
    });

    it('should reject amount exceeding currency limit', () => {
      // 6,000,000 превышает лимит 5,000,000 для BYN
      const result = runEffect(validateAmount(6000000, 'BYN'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.amount).toBe(6000000);
      }
    });
  });
});

// ==================== VALIDATE CURRENCY TESTS ====================

describe('validateCurrency', () => {
  describe('success cases', () => {
    it('should validate supported BYN currency', () => {
      const result = runEffect(validateCurrency('BYN'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('BYN');
      }
    });

    it('should validate supported RUB currency', () => {
      const result = runEffect(validateCurrency('RUB'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('RUB');
      }
    });

    it('should validate supported USD currency', () => {
      const result = runEffect(validateCurrency('USD'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('USD');
      }
    });

    it('should validate supported EUR currency', () => {
      const result = runEffect(validateCurrency('EUR'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('EUR');
      }
    });

    it('should be case sensitive', () => {
      const result = runEffect(validateCurrency('byn'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
      }
    });
  });

  describe('error cases', () => {
    it('should reject unsupported currency', () => {
      const result = runEffect(validateCurrency('JPY'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.amount).toBe(0);
        expect(result.left.details.currency).toBe('JPY');
      }
    });

    it('should reject empty string', () => {
      const result = runEffect(validateCurrency(''));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
        expect(result.left.details.currency).toBe('');
      }
    });
  });
});

// ==================== VALIDATE PAYMENT METHOD TESTS ====================

describe('validatePaymentMethod', () => {
  describe('success cases', () => {
    it('should validate undefined method', () => {
      const result = runEffect(validatePaymentMethod(undefined));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBeUndefined();
      }
    });

    it('should validate supported credit_card method', () => {
      const result = runEffect(validatePaymentMethod('credit_card'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('credit_card');
      }
    });

    it('should validate supported webpay method', () => {
      const result = runEffect(validatePaymentMethod('webpay'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('webpay');
      }
    });

    it('should validate supported paypal method', () => {
      const result = runEffect(validatePaymentMethod('paypal'));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toBe('paypal');
      }
    });
  });

  describe('error cases', () => {
    it('should reject unsupported payment method', () => {
      const result = runEffect(validatePaymentMethod('stripe'));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
        expect(result.left.details.amount).toBe(0);
        expect(result.left.details.currency).toBe('N/A');
      }
    });

    it('should reject empty string', () => {
      const result = runEffect(validatePaymentMethod(''));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
    });
  });
});

// ==================== VALIDATE BILLING OPERATION TESTS ====================

describe('validateBillingOperation', () => {
  describe('success cases', () => {
    it('should validate complete valid operation', () => {
      const operation = {
        amount: 1000,
        currency: 'BYN' as const,
        paymentMethod: 'webpay' as const,
      };

      const result = runEffect(validateBillingOperation(operation));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toEqual({
          amount: 1000,
          currency: 'BYN',
          paymentMethod: 'webpay',
        });
      }
    });

    it('should validate operation without payment method', () => {
      const operation = {
        amount: 500,
        currency: 'USD' as const,
        paymentMethod: undefined,
      };

      const result = runEffect(validateBillingOperation(operation));
      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right).toEqual({
          amount: 500,
          currency: 'USD',
          paymentMethod: undefined,
        });
      }
    });
  });

  describe('error cases', () => {
    it('should fail on invalid currency', () => {
      const operation = {
        amount: 1000,
        currency: 'JPY' as const,
        paymentMethod: 'webpay' as const,
      };

      const result = runEffect(validateBillingOperation(operation));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
    });

    it('should fail on invalid amount', () => {
      const operation = {
        amount: -100,
        currency: 'BYN' as const,
        paymentMethod: 'webpay' as const,
      };

      const result = runEffect(validateBillingOperation(operation));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
    });

    it('should fail on invalid payment method', () => {
      const operation = {
        amount: 1000,
        currency: 'BYN' as const,
        paymentMethod: 'stripe' as const,
      };

      const result = runEffect(validateBillingOperation(operation));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      }
    });

    it('should fail fast on currency validation (first check)', () => {
      const operation = {
        amount: -100, // invalid but should not reach here
        currency: 'INVALID' as const,
        paymentMethod: 'invalid' as const,
      };

      const result = runEffect(validateBillingOperation(operation));
      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expectPaymentFailedError(result.left, SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
        // Should fail on currency, not on amount
        expect(result.left.details.currency).toBe('INVALID');
      }
    });
  });
});

// ==================== EDGE CASES ====================

describe('Edge Cases', () => {
  it('should handle maximum valid amount', () => {
    // Предполагаем, что 4999999 - максимум для BYN
    const result = runEffect(validateAmount(4999999, 'BYN'));
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe(4999999);
    }
  });

  it('should handle floating point precision', () => {
    const result = runEffect(validateAmount(30, 'USD')); // 0.30 USD in cents
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe(30);
    }
  });

  it('should handle minimum amounts', () => {
    const result = runEffect(validateAmount(1, 'EUR')); // 0.01 EUR
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe(1);
    }
  });
});
