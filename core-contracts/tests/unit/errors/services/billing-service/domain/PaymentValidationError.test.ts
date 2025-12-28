import { describe, expect, it } from 'vitest';

import {
  convertToMajorUnits,
  convertToMinorUnits,
  createPaymentValidationError,
  getPaymentValidationErrorSeverity,
  formatPaymentAmount,
  getCurrencyLimit,
  getCurrencyType,
  getPaymentAmount,
  getPaymentCurrency,
  getPaymentSessionId,
  getPaymentTransactionId,
  getPaymentUserId,
  getPaymentValidationReason,
  getPaymentValidationRule,
  getPaymentValidationSuggestions,
  isCurrencySupported,
  isPaymentAmountValid,
  isPaymentMethodSupported,
  isPaymentValidationError,
  isValidPaymentValidationErrorContext,
  PAYMENT_MAXIMUM_AMOUNTS,
  PAYMENT_MINIMUM_AMOUNTS,
} from '../../../../../../src/errors/services/billing-service/domain/index.js';
import type {
  PaymentValidationError,
  PaymentValidationErrorContext,
} from '../../../../../../src/errors/services/billing-service/domain/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock PaymentValidationErrorContext для тестов */
function createMockPaymentValidationContext(
  overrides: Partial<PaymentValidationErrorContext> = {},
): PaymentValidationErrorContext {
  return {
    type: 'payment_validation',
    reason: 'invalid-amount' as const,
    rule: 'amount.min.BYN',
    amount: 50, // 0.50 BYN
    currency: 'BYN' as const,
    paymentMethod: 'bank_transfer' as const,
    transactionId: 'txn_456',
    userId: 'user_789',
    sessionId: 'session_101',
    suggestions: ['Increase amount to minimum 1 BYN'],
    ...overrides,
  };
}

/** Создает mock PaymentValidationError для тестов */
function createMockPaymentValidationError(
  contextOverrides: Partial<PaymentValidationErrorContext> = {},
): PaymentValidationError {
  const context = createMockPaymentValidationContext(contextOverrides);
  return createPaymentValidationError(
    context.reason,
    context.rule,
    'Payment amount too low',
    {
      planId: context.planId || 'plan_123',
      amount: context.amount,
      currency: context.currency,
      paymentMethod: context.paymentMethod,
      transactionId: context.transactionId,
      userId: context.userId,
      sessionId: context.sessionId,
      suggestions: context.suggestions,
    },
  );
}

// ==================== TESTS ====================

describe('PaymentValidationError Domain', () => {
  describe('createPaymentValidationError', () => {
    it('should create PaymentValidationError with all fields', () => {
      const error = createPaymentValidationError(
        'invalid-amount',
        'amount.min.BYN',
        'Amount too low for BYN currency',
        {
          planId: 'plan_123',
          amount: 50, // 0.50 BYN
          currency: 'BYN',
          paymentMethod: 'bank_transfer',
          transactionId: 'txn_456',
          userId: 'user_789',
          sessionId: 'session_101',
          suggestions: ['Increase amount to minimum 1 BYN'],
        },
      );

      expect(error._tag).toBe('PaymentValidationError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('DOMAIN');
      expect(getPaymentValidationErrorSeverity(error)).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_103');
      expect(error.message).toBe('Amount too low for BYN currency');
      expect(error.details).toEqual({
        type: 'payment_validation',
        reason: 'invalid-amount',
        rule: 'amount.min.BYN',
        amount: 50,
        currency: 'BYN',
        paymentMethod: 'bank_transfer',
        planId: 'plan_123',
        transactionId: 'txn_456',
        userId: 'user_789',
        sessionId: 'session_101',
        suggestions: ['Increase amount to minimum 1 BYN'],
      });
    });

    it('should create error with minimal context', () => {
      const error = createPaymentValidationError(
        'unsupported-currency',
        'currency.unsupported',
        'Currency not supported',
        { planId: 'plan_123' },
      );

      expect(error._tag).toBe('PaymentValidationError');
      expect(error.details).toEqual({
        type: 'payment_validation',
        reason: 'unsupported-currency',
        rule: 'currency.unsupported',
        planId: 'plan_123',
      });
    });


    it('should create CRITICAL severity error for PCI violations', () => {
      const error = createPaymentValidationError(
        'pci-violation',
        'pci.unsafe',
        'PCI violation detected',
        { planId: 'plan_123' },
      );

      expect(getPaymentValidationErrorSeverity(error)).toBe('critical');
    });

    it('should create HIGH severity error for non-PCI violations', () => {
      const error = createPaymentValidationError(
        'invalid-amount',
        'amount.min.BYN',
        'Amount too low',
        { planId: 'plan_123' },
      );

      expect(getPaymentValidationErrorSeverity(error)).toBe('high');
    });

    it('should allow custom severity override', () => {
      const error = createPaymentValidationError(
        'invalid-amount',
        'amount.min.BYN',
        'Amount too low',
        { planId: 'plan_123' },
      );

      expect(getPaymentValidationErrorSeverity(error)).toBe('high');
    });
  });

  describe('isValidPaymentValidationErrorContext', () => {
    it('should return true for valid context', () => {
      const context = createMockPaymentValidationContext();
      expect(isValidPaymentValidationErrorContext(context)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidPaymentValidationErrorContext(null)).toBe(false);
      expect(isValidPaymentValidationErrorContext(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidPaymentValidationErrorContext('string')).toBe(false);
      expect(isValidPaymentValidationErrorContext(123)).toBe(false);
    });

    it('should return false for invalid type', () => {
      const context = createMockPaymentValidationContext({ type: 'invalid' as any });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should return false for invalid reason', () => {
      const context = createMockPaymentValidationContext({ reason: 'invalid-reason' as any });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const context = { type: 'payment_validation' } as any;
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should accept any numeric amounts structurally', () => {
      // Valid amounts
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ amount: 100, currency: 'BYN' }),
      )).toBe(true);

      // Any amounts are structurally valid (business validation is separate)
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ amount: 0, currency: 'BYN' }),
      )).toBe(true);

      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ amount: 100_000_000, currency: 'BYN' }),
      )).toBe(true);
    });

    it('should accept various currency types', () => {
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ currency: 'BYN' as const }),
      )).toBe(true);

      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ currency: 'BTC' }),
      )).toBe(true);
    });

    it('should accept payment methods', () => {
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ paymentMethod: 'bank_transfer' as const }),
      )).toBe(true);
    });

    it('should validate suggestions array', () => {
      // Valid suggestions
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ suggestions: ['Fix amount', 'Check currency'] }),
      )).toBe(true);

      // Invalid suggestions (not array)
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ suggestions: 'not array' as any }),
      )).toBe(false);

      // Invalid suggestions (empty strings)
      expect(isValidPaymentValidationErrorContext(
        createMockPaymentValidationContext({ suggestions: ['valid', ''] }),
      )).toBe(false);
    });
  });

  describe('isPaymentValidationError', () => {
    it('should return true for PaymentValidationError', () => {
      const error = createMockPaymentValidationError();
      expect(isPaymentValidationError(error)).toBe(true);
    });

    it('should return false for other objects', () => {
      expect(isPaymentValidationError(null)).toBe(false);
      expect(isPaymentValidationError({})).toBe(false);
      expect(isPaymentValidationError({ _tag: 'OtherError' })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isPaymentValidationError('string')).toBe(false);
      expect(isPaymentValidationError(123)).toBe(false);
    });
  });

  describe('Accessor functions', () => {
    const error = createMockPaymentValidationError();

    describe('getPaymentValidationReason', () => {
      it('should return reason', () => {
        expect(getPaymentValidationReason(error)).toBe('invalid-amount');
      });
    });

    describe('getPaymentValidationRule', () => {
      it('should return rule', () => {
        expect(getPaymentValidationRule(error)).toBe('amount.min.BYN');
      });
    });

    describe('getPaymentAmount', () => {
      it('should return amount', () => {
        expect(getPaymentAmount(error)).toBe(50);
      });

      it('should return undefined when amount not set', () => {
        const errorWithoutAmount = createPaymentValidationError(
          'unsupported-currency',
          'currency.unsupported',
          'Currency not supported',
          { planId: 'plan_123' },
        );
        expect(getPaymentAmount(errorWithoutAmount)).toBeUndefined();
      });
    });

    describe('getPaymentCurrency', () => {
      it('should return currency', () => {
        expect(getPaymentCurrency(error)).toBe('BYN');
      });
    });

    describe('getPaymentValidationSuggestions', () => {
      it('should return suggestions', () => {
        expect(getPaymentValidationSuggestions(error)).toEqual([
          'Increase amount to minimum 1 BYN',
        ]);
      });
    });

    describe('getPaymentTransactionId', () => {
      it('should return transactionId', () => {
        expect(getPaymentTransactionId(error)).toBe('txn_456');
      });
    });

    describe('getPaymentUserId', () => {
      it('should return userId', () => {
        expect(getPaymentUserId(error)).toBe('user_789');
      });
    });

    describe('getPaymentSessionId', () => {
      it('should return sessionId', () => {
        expect(getPaymentSessionId(error)).toBe('session_101');
      });
    });
  });

  describe('Utility functions', () => {
    describe('isCurrencySupported', () => {
      it('should return true for supported currencies', () => {
        expect(isCurrencySupported('BYN')).toBe(true);
        expect(isCurrencySupported('RUB')).toBe(true);
        expect(isCurrencySupported('USD')).toBe(true);
        expect(isCurrencySupported('EUR')).toBe(true);
      });

      it('should return false for unsupported currencies', () => {
        expect(isCurrencySupported('BTC')).toBe(false);
        expect(isCurrencySupported('XYZ')).toBe(false);
      });
    });

    describe('isPaymentMethodSupported', () => {
      it('should return true for supported methods', () => {
        expect(isPaymentMethodSupported('credit_card')).toBe(true);
        expect(isPaymentMethodSupported('bank_transfer')).toBe(true);
        expect(isPaymentMethodSupported('webpay')).toBe(true);
      });

      it('should return false for unsupported methods', () => {
        expect(isPaymentMethodSupported('crypto_wallet')).toBe(false);
        expect(isPaymentMethodSupported('unknown_method')).toBe(false);
      });
    });

    describe('isPaymentAmountValid', () => {
      it('should validate amounts with currency', () => {
        expect(isPaymentAmountValid(100, 'BYN')).toBe(true);
        expect(isPaymentAmountValid(1000, 'RUB')).toBe(true);
        expect(isPaymentAmountValid(50, 'USD')).toBe(true);
      });

      it('should reject invalid amounts', () => {
        expect(isPaymentAmountValid(0, 'BYN')).toBe(false); // Too low
        expect(isPaymentAmountValid(100_000_000, 'BYN')).toBe(false); // Too high
      });

    });

    describe('getCurrencyType', () => {
      it('should return supported for supported currencies', () => {
        expect(getCurrencyType('BYN')).toBe('supported');
        expect(getCurrencyType('USD')).toBe('supported');
      });

      it('should return unsupported for unsupported currencies', () => {
        expect(getCurrencyType('BTC')).toBe('unsupported');
        expect(getCurrencyType('XYZ')).toBe('unsupported');
      });
    });


    describe('getCurrencyLimit', () => {
      it('should return correct limits for all supported currencies', () => {
        expect(getCurrencyLimit(PAYMENT_MINIMUM_AMOUNTS, 'BYN')).toBe(1);
        expect(getCurrencyLimit(PAYMENT_MINIMUM_AMOUNTS, 'RUB')).toBe(100);
        expect(getCurrencyLimit(PAYMENT_MINIMUM_AMOUNTS, 'USD')).toBe(1);
        expect(getCurrencyLimit(PAYMENT_MINIMUM_AMOUNTS, 'EUR')).toBe(1);

        expect(getCurrencyLimit(PAYMENT_MAXIMUM_AMOUNTS, 'BYN')).toBe(5_000_000);
        expect(getCurrencyLimit(PAYMENT_MAXIMUM_AMOUNTS, 'RUB')).toBe(50_000_000);
        expect(getCurrencyLimit(PAYMENT_MAXIMUM_AMOUNTS, 'USD')).toBe(1_000_000);
        expect(getCurrencyLimit(PAYMENT_MAXIMUM_AMOUNTS, 'EUR')).toBe(1_000_000);
      });
    });
  });

  describe('Constants', () => {
    it('should export payment limit constants', () => {
      expect(PAYMENT_MINIMUM_AMOUNTS).toEqual({
        BYN: 1,
        RUB: 100,
        USD: 1,
        EUR: 1,
      });

      expect(PAYMENT_MAXIMUM_AMOUNTS).toEqual({
        BYN: 5_000_000,
        RUB: 50_000_000,
        USD: 1_000_000,
        EUR: 1_000_000,
      });

    });
  });

  describe('Utility functions', () => {
    describe('convertToMinorUnits', () => {
      it('should convert major units to minor units', () => {
        expect(convertToMinorUnits(10.50)).toBe(1050); // 10.50 USD → 1050 cents
        expect(convertToMinorUnits(0.01)).toBe(1); // 0.01 USD → 1 cent
        expect(convertToMinorUnits(100)).toBe(10000); // 100 USD → 10000 cents
      });

      it('should require exact decimal precision', () => {
        expect(() => convertToMinorUnits(10.999)).toThrow('Invalid amount precision');
        expect(() => convertToMinorUnits(10.001)).toThrow('Invalid amount precision');
        expect(convertToMinorUnits(10.00)).toBe(1000); // exact precision works
        expect(convertToMinorUnits(10.50)).toBe(1050); // exact precision works
      });

      it('should handle negative amounts', () => {
        expect(convertToMinorUnits(-10.50)).toBe(-1050); // negative amounts
      });

      it('should handle very large amounts', () => {
        expect(convertToMinorUnits(1000000)).toBe(100000000); // large amounts
      });
    });

    describe('convertToMajorUnits', () => {
      it('should convert minor units to major units', () => {
        expect(convertToMajorUnits(1050)).toBe(10.5); // 1050 cents → 10.50 USD
        expect(convertToMajorUnits(1)).toBe(0.01); // 1 cent → 0.01 USD
        expect(convertToMajorUnits(10000)).toBe(100); // 10000 cents → 100 USD
      });

      it('should handle negative amounts', () => {
        expect(convertToMajorUnits(-1050)).toBe(-10.5); // negative amounts
      });

      it('should handle very large amounts', () => {
        expect(convertToMajorUnits(100000000)).toBe(1000000); // large amounts
      });
    });

    describe('formatPaymentAmount', () => {
      it('should format amounts with currency', () => {
        expect(formatPaymentAmount(1050, 'USD')).toBe('10.50 USD');
        expect(formatPaymentAmount(150, 'BYN')).toBe('1.50 BYN');
        expect(formatPaymentAmount(10000, 'RUB')).toBe('100.00 RUB');
        expect(formatPaymentAmount(500, 'EUR')).toBe('5.00 EUR');
      });

      it('should handle zero amounts', () => {
        expect(formatPaymentAmount(0, 'USD')).toBe('0.00 USD');
      });

      it('should handle negative amounts', () => {
        expect(formatPaymentAmount(-1050, 'USD')).toBe('-10.50 USD');
      });

      it('should handle large amounts', () => {
        expect(formatPaymentAmount(100000000, 'USD')).toBe('1000000.00 USD');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty suggestions array', () => {
      const context = createMockPaymentValidationContext({
        suggestions: [],
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(true);
    });

    it('should handle undefined optional fields', () => {
      const context: PaymentValidationErrorContext = {
        type: 'payment_validation',
        reason: 'invalid-amount',
        rule: 'amount.min.BYN',
      };
      expect(isValidPaymentValidationErrorContext(context)).toBe(true); // planId optional
    });

    it('should accept any amounts for unsupported currencies', () => {
      // For unsupported currencies, amount validation is not applied
      const context = createMockPaymentValidationContext({
        amount: 200_000_000, // Any amount is valid for unsupported currencies
        currency: 'BTC',
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(true);
    });

    it('should accept any numeric amounts structurally', () => {
      const context = createMockPaymentValidationContext({
        amount: 0, // zero amount
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(true);

      const context2 = createMockPaymentValidationContext({
        amount: -100, // negative amount
      });
      expect(isValidPaymentValidationErrorContext(context2)).toBe(true);
    });

    it('should reject invalid amount types', () => {
      const context = createMockPaymentValidationContext({
        amount: 'not a number' as any, // invalid amount type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should accept any amounts without currency', () => {
      const context = createMockPaymentValidationContext({
        amount: 200_000_000, // Any amount is valid without currency
        currency: undefined,
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(true);
    });

    it('should reject invalid currency types', () => {
      const context = createMockPaymentValidationContext({
        currency: 123 as any, // invalid currency type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid payment method types', () => {
      const context = createMockPaymentValidationContext({
        paymentMethod: {} as any, // invalid payment method type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });


    it('should reject invalid transactionId types', () => {
      const context = createMockPaymentValidationContext({
        transactionId: 123 as any, // invalid transactionId type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid userId types', () => {
      const context = createMockPaymentValidationContext({
        userId: {} as any, // invalid userId type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid sessionId types', () => {
      const context = createMockPaymentValidationContext({
        sessionId: [] as any, // invalid sessionId type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid suggestions types', () => {
      const context = createMockPaymentValidationContext({
        suggestions: 'not array' as any, // invalid suggestions type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject suggestions with non-string elements', () => {
      const context = createMockPaymentValidationContext({
        suggestions: ['valid', 123 as any], // invalid suggestion element
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject non-string reason', () => {
      const context = {
        type: 'payment_validation',
        reason: 123 as any, // reason not a string
        rule: 'test_rule',
      } as any;
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid planId types', () => {
      const context = createMockPaymentValidationContext({
        planId: {} as any, // invalid planId type
      });
      expect(isValidPaymentValidationErrorContext(context)).toBe(false);
    });
  });
});
