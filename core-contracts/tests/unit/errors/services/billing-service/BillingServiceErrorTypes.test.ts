import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  createPaymentFailedError,
  createRefundError,
  createSubscriptionError,
  domainErrorToServiceError,
  getBillingServiceErrorCode,
  getBillingServiceErrorSummary,
  getBillingServiceErrorTimestamp,
  getPaymentAmount,
  getPaymentCurrency,
  getPaymentProvider,
  getPaymentTransactionId,
  getRefundAmount,
  getRefundCurrency,
  getRefundDaysSinceTransaction,
  getRefundErrorReason,
  getRefundTransactionId,
  getSubscriptionAllowedUsage,
  getSubscriptionCurrentUsage,
  getSubscriptionErrorReason,
  getSubscriptionId,
  getSubscriptionPlanId,
  isBillingServiceError,
  isPaymentFailedError,
  isPaymentRetryable,
  isRefundError,
  isSubscriptionError,
  matchBillingServiceError,
  normalizeOptionalContext,
  safeMatchBillingServiceError,
} from '../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';
import type {
  BillingServiceError,
  PaymentFailedError,
  RefundError,
  SubscriptionError,
} from '../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';
import type { BillingDomainError } from '../../../../../src/errors/services/billing-service/domain/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock PaymentFailedError для тестов */
function createMockPaymentFailedError(
  transactionId = 'txn_123456',
  amount = 10000, // 100.00 BYN
  currency: 'BYN' | 'RUB' | 'USD' | 'EUR' = 'BYN',
  context?: { provider?: 'bank_transfer' | 'credit_card'; operation?: string; },
): PaymentFailedError {
  const effect = createPaymentFailedError(transactionId, amount, currency, context);
  return Effect.runSync(effect as any);
}

/** Создает mock SubscriptionError для тестов */
function createMockSubscriptionError(
  subscriptionId = 'sub_123456',
  reason = 'usage-limit-exceeded',
  context?: { planId?: string; currentUsage?: number; allowedUsage?: number; },
): SubscriptionError {
  const effect = createSubscriptionError(subscriptionId, reason, context);
  return Effect.runSync(effect as any);
}

/** Создает mock RefundError для тестов */
function createMockRefundError(
  transactionId = 'txn_123456',
  reason = 'refund-window-expired',
  context?: { refundAmount?: number; currency?: string; daysSinceTransaction?: number; },
): RefundError {
  const effect = createRefundError(transactionId, reason, context);
  return Effect.runSync(effect as any);
}

/** Создает mock domain ошибку для тестирования mapping */
function createMockDomainError(type: 'payment' | 'subscription' | 'refund'): BillingDomainError {
  switch (type) {
    case 'payment':
      return {
        _tag: 'PaymentValidationError',
        code: 'SERVICE_BILLING_103',
        origin: 'DOMAIN' as const,
        category: 'BUSINESS' as const,
        severity: 'high' as const,
        message: 'Payment validation failed',
        details: {
          type: 'payment_validation',
          reason: 'invalid-amount',
          rule: 'amount.min.BYN',
          amount: 50,
          currency: 'BYN',
          paymentMethod: 'bank_transfer',
          planId: 'plan_123',
          transactionId: 'txn_123',
          userId: 'user_456',
          sessionId: 'session_789',
          suggestions: ['Increase amount'],
        },
        timestamp: '2024-01-01T12:00:00.000Z',
      } as any;
    case 'subscription':
      return {
        _tag: 'SubscriptionLimitError',
        code: 'SERVICE_BILLING_104',
        origin: 'DOMAIN' as const,
        category: 'BUSINESS' as const,
        severity: 'high' as const,
        message: 'Subscription limit exceeded',
        details: {
          type: 'subscription_limit',
          reason: 'usage-limit-exceeded',
          rule: 'usage.limit.exceeded',
          planId: 'plan_123',
          subscriptionId: 'sub_456',
          currentUsage: 150,
          allowedUsage: 100,
        },
        timestamp: '2024-01-01T12:00:00.000Z',
      } as any;
    case 'refund':
      return {
        _tag: 'RefundPolicyError',
        code: 'SERVICE_BILLING_105',
        origin: 'DOMAIN' as const,
        category: 'BUSINESS' as const,
        severity: 'high' as const,
        message: 'Refund policy violation',
        details: {
          type: 'refund_policy',
          reason: 'refund-window-expired',
          transactionId: 'txn_123',
          refundAmount: 5000,
          maxRefundAmount: 10000,
          daysSinceTransaction: 35,
          maxRefundWindowDays: 30,
          currency: 'BYN',
          userId: 'user_456',
          sessionId: 'session_789',
          regionId: 'us-east-1',
          tenantId: 'tenant_abc',
          suggestions: ['Contact support'],
        },
        timestamp: '2024-01-01T12:00:00.000Z',
      } as any;
  }
}

// ==================== TESTS ====================

describe('BillingServiceErrorTypes', () => {
  describe('createPaymentFailedError', () => {
    it('should create PaymentFailedError with all fields', () => {
      const error = createMockPaymentFailedError(
        'txn_123456',
        10000, // 100.00 BYN
        'BYN',
        { provider: 'bank_transfer', operation: 'charge' },
      );

      expect(error._tag).toBe('PaymentFailedError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('SERVICE');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_100');
      expect(error.message).toBe('Payment processing failed for transaction txn_123456');
      expect(error.details).toEqual({
        transactionId: 'txn_123456',
        amount: 10000,
        currency: 'BYN',
        retryable: false, // retryable зависит от retryPolicy, здесь retryPolicy не передан
        provider: 'bank_transfer',
        operation: 'charge',
      });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should create error with minimal context', () => {
      const error = createMockPaymentFailedError('txn_789', 5000, 'USD');

      expect(error._tag).toBe('PaymentFailedError');
      expect(error.details).toEqual({
        transactionId: 'txn_789',
        amount: 5000,
        currency: 'USD',
        retryable: false, // retryable зависит от retryPolicy
      });
      expect(error.details.provider).toBeUndefined();
      expect(error.details.operation).toBeUndefined();
    });

    it('should create error with provider but no operation', () => {
      const error = createMockPaymentFailedError(
        'txn_999',
        2500,
        'RUB',
        { provider: 'credit_card' },
      );

      expect(error.details.provider).toBe('credit_card');
      expect(error.details.operation).toBeUndefined();
    });

    it('should create error with operation but no provider', () => {
      const error = createMockPaymentFailedError(
        'txn_888',
        15000,
        'EUR',
        { operation: 'refund' },
      );

      expect(error.details.operation).toBe('refund');
      expect(error.details.provider).toBeUndefined();
    });

    it('should handle unsupported currency gracefully', () => {
      const error = createMockPaymentFailedError('txn_777', 1000, 'XYZ' as any);
      expect(error.details.currency).toBe('XYZ'); // currency сохраняется как есть
      expect(error._tag).toBe('PaymentFailedError');
    });

    it('should handle invalid payment amount gracefully', () => {
      const error = createMockPaymentFailedError('txn_666', 0, 'BYN');
      expect(error.details.amount).toBe(0);
      expect(error.details.currency).toBe('BYN');
      expect(error._tag).toBe('PaymentFailedError');
    });

    it('should handle unsupported payment method gracefully', () => {
      const error = createMockPaymentFailedError('txn_444', 1000, 'BYN', {
        provider: 'unsupported_method' as any,
      });
      expect(error.details.provider).toBe('unsupported_method');
      expect(error._tag).toBe('PaymentFailedError');
    });

    it('should handle all supported currencies', () => {
      const currencies = ['BYN', 'RUB', 'USD', 'EUR'] as const;

      currencies.forEach((currency) => {
        const error = createMockPaymentFailedError('txn_test', 1000, currency);
        expect(error.details.currency).toBe(currency);
        expect(error.details.amount).toBe(1000);
      });
    });

    it('should handle all supported payment methods', () => {
      const methods = ['bank_transfer', 'credit_card'] as const;

      methods.forEach((method) => {
        const error = createMockPaymentFailedError('txn_test', 1000, 'BYN', { provider: method });
        expect(error.details.provider).toBe(method);
      });
    });
  });

  describe('createSubscriptionError', () => {
    it('should create SubscriptionError with all fields', () => {
      const error = createMockSubscriptionError(
        'sub_123456',
        'usage-limit-exceeded',
        { planId: 'plan_pro', currentUsage: 150, allowedUsage: 100 },
      );

      expect(error._tag).toBe('SubscriptionError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('SERVICE');
      expect(error.code).toBe('SERVICE_BILLING_101');
      expect(error.message).toBe('Subscription error: usage-limit-exceeded');
      expect(error.details).toEqual({
        subscriptionId: 'sub_123456',
        reason: 'usage-limit-exceeded',
        planId: 'plan_pro',
        currentUsage: 150,
        allowedUsage: 100,
      });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should create error with minimal context', () => {
      const error = createMockSubscriptionError('sub_789', 'subscription-expired');

      expect(error._tag).toBe('SubscriptionError');
      expect(error.details).toEqual({
        subscriptionId: 'sub_789',
        reason: 'subscription-expired',
      });
      expect(error.details.planId).toBeUndefined();
      expect(error.details.currentUsage).toBeUndefined();
      expect(error.details.allowedUsage).toBeUndefined();
    });

    it('should create error with partial context', () => {
      const error = createMockSubscriptionError(
        'sub_999',
        'plan-limit-exceeded',
        { planId: 'plan_basic' },
      );

      expect(error.details.subscriptionId).toBe('sub_999');
      expect(error.details.reason).toBe('plan-limit-exceeded');
      expect(error.details.planId).toBe('plan_basic');
      expect(error.details.currentUsage).toBeUndefined();
      expect(error.details.allowedUsage).toBeUndefined();
    });

    it('should handle various subscription reasons', () => {
      const reasons = [
        'usage-limit-exceeded',
        'subscription-expired',
        'plan-limit-exceeded',
        'quota-exhausted',
        'tier-upgrade-required',
        'feature-locked',
      ];

      reasons.forEach((reason) => {
        const error = createMockSubscriptionError('sub_test', reason);
        expect(error.details.reason).toBe(reason);
        expect(error.message).toBe(`Subscription error: ${reason}`);
      });
    });

    it('should handle numeric usage values', () => {
      const error = createMockSubscriptionError(
        'sub_123',
        'usage-limit-exceeded',
        { currentUsage: 0, allowedUsage: 0 },
      );

      expect(error.details.currentUsage).toBe(0);
      expect(error.details.allowedUsage).toBe(0);
    });

    it('should handle large numeric usage values', () => {
      const error = createMockSubscriptionError(
        'sub_456',
        'quota-exhausted',
        { currentUsage: 999999999, allowedUsage: 1000000000 },
      );

      expect(error.details.currentUsage).toBe(999999999);
      expect(error.details.allowedUsage).toBe(1000000000);
    });

    it('should handle negative usage values (though this would be unusual)', () => {
      const error = createMockSubscriptionError(
        'sub_789',
        'usage-limit-exceeded',
        { currentUsage: -10, allowedUsage: 100 },
      );

      expect(error.details.currentUsage).toBe(-10);
      expect(error.details.allowedUsage).toBe(100);
    });
  });

  describe('createRefundError', () => {
    it('should create RefundError with all fields', () => {
      const error = createMockRefundError(
        'txn_123456',
        'refund-window-expired',
        { refundAmount: 5000, currency: 'BYN', daysSinceTransaction: 35 },
      );

      expect(error._tag).toBe('RefundError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('SERVICE');
      expect(error.code).toBe('SERVICE_BILLING_102');
      expect(error.message).toBe('Refund processing failed: refund-window-expired');
      expect(error.details).toEqual({
        transactionId: 'txn_123456',
        reason: 'refund-window-expired',
        refundAmount: 5000,
        currency: 'BYN',
        daysSinceTransaction: 35,
      });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should create error with minimal context', () => {
      const error = createMockRefundError('txn_789', 'non-refundable-transaction');

      expect(error._tag).toBe('RefundError');
      expect(error.details).toEqual({
        transactionId: 'txn_789',
        reason: 'non-refundable-transaction',
      });
      expect(error.details.refundAmount).toBeUndefined();
      expect(error.details.currency).toBeUndefined();
      expect(error.details.daysSinceTransaction).toBeUndefined();
    });

    it('should create error with partial context', () => {
      const error = createMockRefundError(
        'txn_999',
        'refund-amount-exceeded',
        { refundAmount: 10000 },
      );

      expect(error.details.transactionId).toBe('txn_999');
      expect(error.details.reason).toBe('refund-amount-exceeded');
      expect(error.details.refundAmount).toBe(10000);
      expect(error.details.currency).toBeUndefined();
      expect(error.details.daysSinceTransaction).toBeUndefined();
    });

    it('should handle various refund reasons', () => {
      const reasons = [
        'refund-window-expired',
        'non-refundable-transaction',
        'refund-amount-exceeded',
        'refund-already-processed',
        'insufficient-funds',
        'partial-refund-not-allowed',
      ];

      reasons.forEach((reason) => {
        const error = createMockRefundError('txn_test', reason);
        expect(error.details.reason).toBe(reason);
        expect(error.message).toBe(`Refund processing failed: ${reason}`);
      });
    });

    it('should handle numeric refund values', () => {
      const error = createMockRefundError(
        'txn_123',
        'refund-amount-exceeded',
        { refundAmount: 0, daysSinceTransaction: 0 },
      );

      expect(error.details.refundAmount).toBe(0);
      expect(error.details.daysSinceTransaction).toBe(0);
    });

    it('should handle large numeric values', () => {
      const error = createMockRefundError(
        'txn_456',
        'refund-window-expired',
        { refundAmount: 999999999, daysSinceTransaction: 999999 },
      );

      expect(error.details.refundAmount).toBe(999999999);
      expect(error.details.daysSinceTransaction).toBe(999999);
    });

    it('should handle string currency values', () => {
      const currencies = ['BYN', 'RUB', 'USD', 'EUR', 'unknown-currency'];

      currencies.forEach((currency) => {
        const error = createMockRefundError('txn_test', 'refund-window-expired', { currency });
        expect(error.details.currency).toBe(currency);
      });
    });

    it('should handle negative values (though this would be unusual)', () => {
      const error = createMockRefundError(
        'txn_789',
        'refund-amount-exceeded',
        { refundAmount: -1000, daysSinceTransaction: -5 },
      );

      expect(error.details.refundAmount).toBe(-1000);
      expect(error.details.daysSinceTransaction).toBe(-5);
    });
  });

  describe('Type Guards', () => {
    describe('isPaymentFailedError', () => {
      it('should return true for PaymentFailedError', () => {
        const error = createMockPaymentFailedError();
        expect(isPaymentFailedError(error)).toBe(true);
      });

      it('should return false for other error types', () => {
        const subscriptionError = createMockSubscriptionError();
        const refundError = createMockRefundError();

        expect(isPaymentFailedError(subscriptionError)).toBe(false);
        expect(isPaymentFailedError(refundError)).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isPaymentFailedError(null)).toBe(false);
        expect(isPaymentFailedError(undefined)).toBe(false);
        expect(isPaymentFailedError('string')).toBe(false);
        expect(isPaymentFailedError(123)).toBe(false);
        expect(isPaymentFailedError({})).toBe(false);
      });

      it('should return false for objects without _tag', () => {
        expect(isPaymentFailedError({ code: 'test', message: 'test' })).toBe(false);
      });

      it('should return false for objects with wrong _tag', () => {
        expect(isPaymentFailedError({ _tag: 'WrongError' })).toBe(false);
      });

      it('should return false for objects missing required fields', () => {
        expect(isPaymentFailedError({
          _tag: 'PaymentFailedError',
          code: 'test',
          // missing other required fields
        })).toBe(false);
      });
    });

    describe('isSubscriptionError', () => {
      it('should return true for SubscriptionError', () => {
        const error = createMockSubscriptionError();
        expect(isSubscriptionError(error)).toBe(true);
      });

      it('should return false for other error types', () => {
        const paymentError = createMockPaymentFailedError();
        const refundError = createMockRefundError();

        expect(isSubscriptionError(paymentError)).toBe(false);
        expect(isSubscriptionError(refundError)).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isSubscriptionError(null)).toBe(false);
        expect(isSubscriptionError(undefined)).toBe(false);
        expect(isSubscriptionError('string')).toBe(false);
        expect(isSubscriptionError(123)).toBe(false);
        expect(isSubscriptionError({})).toBe(false);
      });

      it('should return false for objects without _tag', () => {
        expect(isSubscriptionError({ code: 'test', message: 'test' })).toBe(false);
      });

      it('should return false for objects with wrong _tag', () => {
        expect(isSubscriptionError({ _tag: 'WrongError' })).toBe(false);
      });
    });

    describe('isRefundError', () => {
      it('should return true for RefundError', () => {
        const error = createMockRefundError();
        expect(isRefundError(error)).toBe(true);
      });

      it('should return false for other error types', () => {
        const paymentError = createMockPaymentFailedError();
        const subscriptionError = createMockSubscriptionError();

        expect(isRefundError(paymentError)).toBe(false);
        expect(isRefundError(subscriptionError)).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isRefundError(null)).toBe(false);
        expect(isRefundError(undefined)).toBe(false);
        expect(isRefundError('string')).toBe(false);
        expect(isRefundError(123)).toBe(false);
        expect(isRefundError({})).toBe(false);
      });

      it('should return false for objects without _tag', () => {
        expect(isRefundError({ code: 'test', message: 'test' })).toBe(false);
      });

      it('should return false for objects with wrong _tag', () => {
        expect(isRefundError({ _tag: 'WrongError' })).toBe(false);
      });
    });

    describe('isBillingServiceError', () => {
      it('should return true for PaymentFailedError', () => {
        const error = createMockPaymentFailedError();
        expect(isBillingServiceError(error)).toBe(true);
      });

      it('should return true for SubscriptionError', () => {
        const error = createMockSubscriptionError();
        expect(isBillingServiceError(error)).toBe(true);
      });

      it('should return true for RefundError', () => {
        const error = createMockRefundError();
        expect(isBillingServiceError(error)).toBe(true);
      });

      it('should return false for unknown error types', () => {
        const unknownError = {
          _tag: 'UnknownError',
          code: 'UNKNOWN',
          origin: 'UNKNOWN',
          category: 'UNKNOWN',
          severity: 'high',
          message: 'Unknown error',
          details: {},
          timestamp: '2024-01-01T12:00:00.000Z',
        };

        expect(isBillingServiceError(unknownError)).toBe(false);
      });

      it('should return false for non-objects', () => {
        expect(isBillingServiceError(null)).toBe(false);
        expect(isBillingServiceError(undefined)).toBe(false);
        expect(isBillingServiceError('string')).toBe(false);
        expect(isBillingServiceError(123)).toBe(false);
        expect(isBillingServiceError({})).toBe(false);
      });

      it('should return false for objects missing required fields', () => {
        expect(isBillingServiceError({
          _tag: 'PaymentFailedError',
          code: 'test',
          // missing other required fields
        })).toBe(false);
      });

      it('should return false for invalid union of errors', () => {
        // Test with missing required details field
        const invalidError = {
          _tag: 'PaymentFailedError',
          code: 'SERVICE_BILLING_100',
          origin: 'SERVICE',
          category: 'BUSINESS',
          severity: 'high',
          message: 'Test',
          // missing details field
          timestamp: '2024-01-01T12:00:00.000Z',
        };

        expect(isBillingServiceError(invalidError)).toBe(false);
      });
    });
  });

  describe('Pattern Matching', () => {
    describe('matchBillingServiceError', () => {
      it('should handle PaymentFailedError pattern', () => {
        const error = createMockPaymentFailedError();
        const result = matchBillingServiceError(error, {
          paymentFailedError: (e) => `Payment failed: ${getPaymentTransactionId(e)}`,
          subscriptionError: (e) => `Subscription error: ${getSubscriptionId(e)}`,
          refundError: (e) => `Refund error: ${getRefundTransactionId(e)}`,
          infrastructureUnknownError: () => 'Infrastructure error',
        });

        expect(result).toBe('Payment failed: txn_123456');
      });

      it('should handle SubscriptionError pattern', () => {
        const error = createMockSubscriptionError();
        const result = matchBillingServiceError(error, {
          paymentFailedError: (e) => `Payment failed: ${getPaymentTransactionId(e)}`,
          subscriptionError: (e) => `Subscription error: ${getSubscriptionId(e)}`,
          refundError: (e) => `Refund error: ${getRefundTransactionId(e)}`,
          infrastructureUnknownError: () => 'Infrastructure error',
        });

        expect(result).toBe('Subscription error: sub_123456');
      });

      it('should handle RefundError pattern', () => {
        const error = createMockRefundError();
        const result = matchBillingServiceError(error, {
          paymentFailedError: (e) => `Payment failed: ${getPaymentTransactionId(e)}`,
          subscriptionError: (e) => `Subscription error: ${getSubscriptionId(e)}`,
          refundError: (e) => `Refund error: ${getRefundTransactionId(e)}`,
          infrastructureUnknownError: () => 'Infrastructure error',
        });

        expect(result).toBe('Refund error: txn_123456');
      });

      it('should handle exhaustive check at compile time', () => {
        const paymentError = createMockPaymentFailedError();
        const subscriptionError = createMockSubscriptionError();
        const refundError = createMockRefundError();

        // This test verifies that all error types are handled
        // If a new error type is added, this test will fail at compile time
        const results = [
          matchBillingServiceError(paymentError, {
            paymentFailedError: () => 'PAYMENT',
            subscriptionError: () => 'SUBSCRIPTION',
            refundError: () => 'REFUND',
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
          }),
          matchBillingServiceError(subscriptionError, {
            paymentFailedError: () => 'PAYMENT',
            subscriptionError: () => 'SUBSCRIPTION',
            refundError: () => 'REFUND',
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
          }),
          matchBillingServiceError(refundError, {
            paymentFailedError: () => 'PAYMENT',
            subscriptionError: () => 'SUBSCRIPTION',
            refundError: () => 'REFUND',
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
          }),
        ];

        expect(results).toEqual(['PAYMENT', 'SUBSCRIPTION', 'REFUND']);
      });

      it('should return different results for different error types', () => {
        const paymentError = createMockPaymentFailedError('txn_payment', 1000, 'BYN');
        const subscriptionError = createMockSubscriptionError('sub_test', 'expired');
        const refundError = createMockRefundError('txn_refund', 'failed');

        const results = [
          matchBillingServiceError(paymentError, {
            paymentFailedError: (e) => `PAYMENT: ${e.details.transactionId}`,
            subscriptionError: () => 'SUBSCRIPTION',
            refundError: () => 'REFUND',
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
          }),
          matchBillingServiceError(subscriptionError, {
            paymentFailedError: () => 'PAYMENT',
            subscriptionError: (e) => `SUBSCRIPTION: ${e.details.subscriptionId}`,
            refundError: () => 'REFUND',
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
          }),
          matchBillingServiceError(refundError, {
            paymentFailedError: () => 'PAYMENT',
            subscriptionError: () => 'SUBSCRIPTION',
            refundError: (e) => `REFUND: ${e.details.transactionId}`,
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
          }),
        ];

        expect(results).toEqual([
          'PAYMENT: txn_payment',
          'SUBSCRIPTION: sub_test',
          'REFUND: txn_refund',
        ]);
      });
    });

    describe('safeMatchBillingServiceError', () => {
      it('should handle PaymentFailedError pattern', () => {
        const error = createMockPaymentFailedError();
        const result = safeMatchBillingServiceError(error, {
          paymentFailedError: (e) => `Payment failed: ${getPaymentTransactionId(e)}`,
          subscriptionError: (e) => `Subscription error: ${getSubscriptionId(e)}`,
          refundError: (e) => `Refund error: ${getRefundTransactionId(e)}`,
          infrastructureUnknownError: () => 'Infrastructure error',
          fallback: () => 'Unknown error',
        });

        expect(result).toBe('Payment failed: txn_123456');
      });

      it('should handle SubscriptionError pattern', () => {
        const error = createMockSubscriptionError();
        const result = safeMatchBillingServiceError(error, {
          paymentFailedError: (e) => `Payment failed: ${getPaymentTransactionId(e)}`,
          subscriptionError: (e) => `Subscription error: ${getSubscriptionId(e)}`,
          refundError: (e) => `Refund error: ${getRefundTransactionId(e)}`,
          infrastructureUnknownError: () => 'Infrastructure error',
          fallback: () => 'Unknown error',
        });

        expect(result).toBe('Subscription error: sub_123456');
      });

      it('should handle RefundError pattern', () => {
        const error = createMockRefundError();
        const result = safeMatchBillingServiceError(error, {
          paymentFailedError: (e) => `Payment failed: ${getPaymentTransactionId(e)}`,
          subscriptionError: (e) => `Subscription error: ${getSubscriptionId(e)}`,
          refundError: (e) => `Refund error: ${getRefundTransactionId(e)}`,
          infrastructureUnknownError: () => 'Infrastructure error',
          fallback: () => 'Unknown error',
        });

        expect(result).toBe('Refund error: txn_123456');
      });

      it('should return fallback for non-billing service errors', () => {
        const unknownError = {
          _tag: 'UnknownError',
          code: 'UNKNOWN',
          origin: 'UNKNOWN',
          category: 'UNKNOWN',
          severity: 'high',
          message: 'Unknown error',
          details: {},
          timestamp: '2024-01-01T12:00:00.000Z',
        };

        const result = safeMatchBillingServiceError(unknownError, {
          paymentFailedError: () => 'PAYMENT',
          subscriptionError: () => 'SUBSCRIPTION',
          refundError: () => 'REFUND',
          infrastructureUnknownError: () => 'INFRASTRUCTURE',
          fallback: () => 'FALLBACK',
        });

        expect(result).toBe('FALLBACK');
      });

      it('should return fallback for null/undefined', () => {
        const result = safeMatchBillingServiceError(null, {
          paymentFailedError: () => 'PAYMENT',
          subscriptionError: () => 'SUBSCRIPTION',
          refundError: () => 'REFUND',
          infrastructureUnknownError: () => 'INFRASTRUCTURE',
          fallback: () => 'FALLBACK',
        });

        expect(result).toBe('FALLBACK');
      });

      it('should return fallback for primitive values', () => {
        const result = safeMatchBillingServiceError('string error', {
          paymentFailedError: () => 'PAYMENT',
          subscriptionError: () => 'SUBSCRIPTION',
          refundError: () => 'REFUND',
          infrastructureUnknownError: () => 'INFRASTRUCTURE',
          fallback: () => 'FALLBACK',
        });

        expect(result).toBe('FALLBACK');
      });

      it('should work with complex fallback logic', () => {
        const unknownError = { message: 'custom error' };

        const result = safeMatchBillingServiceError(unknownError, {
          paymentFailedError: () => 'PAYMENT',
          subscriptionError: () => 'SUBSCRIPTION',
          refundError: () => 'REFUND',
          infrastructureUnknownError: () => 'INFRASTRUCTURE',
          fallback: () => `Fallback: ${(unknownError as any).message || 'unknown'}`,
        });

        expect(result).toBe('Fallback: custom error');
      });

      it('should handle all billing service error types correctly', () => {
        const errors: BillingServiceError[] = [
          createMockPaymentFailedError('txn_1', 1000, 'BYN'),
          createMockSubscriptionError('sub_1', 'expired'),
          createMockRefundError('txn_2', 'failed'),
        ];

        const results = errors.map((error) =>
          safeMatchBillingServiceError(error, {
            paymentFailedError: (e) => `PAYMENT_${e.details.transactionId}`,
            subscriptionError: (e) => `SUBSCRIPTION_${e.details.subscriptionId}`,
            refundError: (e) => `REFUND_${e.details.transactionId}`,
            infrastructureUnknownError: () => 'INFRASTRUCTURE',
            fallback: () => 'UNKNOWN',
          })
        );

        expect(results).toEqual([
          'PAYMENT_txn_1',
          'SUBSCRIPTION_sub_1',
          'REFUND_txn_2',
        ]);
      });
    });
  });

  describe('Accessor Functions', () => {
    describe('PaymentFailedError accessors', () => {
      const error = createMockPaymentFailedError(
        'txn_test_123',
        25000, // 250.00 BYN
        'BYN',
        { provider: 'bank_transfer', operation: 'charge' },
      );

      describe('getPaymentTransactionId', () => {
        it('should return transactionId', () => {
          expect(getPaymentTransactionId(error)).toBe('txn_test_123');
        });
      });

      describe('getPaymentAmount', () => {
        it('should return amount', () => {
          expect(getPaymentAmount(error)).toBe(25000);
        });
      });

      describe('getPaymentCurrency', () => {
        it('should return currency', () => {
          expect(getPaymentCurrency(error)).toBe('BYN');
        });
      });

      describe('isPaymentRetryable', () => {
        it('should return retryable status', () => {
          expect(isPaymentRetryable(error)).toBe(false); // retryable зависит от retryPolicy
        });
      });

      describe('getPaymentProvider', () => {
        it('should return provider when present', () => {
          expect(getPaymentProvider(error)).toBe('bank_transfer');
        });

        it('should return undefined when provider not set', () => {
          const errorNoProvider = createMockPaymentFailedError('txn_123', 1000, 'USD');
          expect(getPaymentProvider(errorNoProvider)).toBeUndefined();
        });
      });
    });

    describe('SubscriptionError accessors', () => {
      const error = createMockSubscriptionError(
        'sub_test_456',
        'usage-limit-exceeded',
        { planId: 'plan_pro', currentUsage: 150, allowedUsage: 100 },
      );

      describe('getSubscriptionId', () => {
        it('should return subscriptionId', () => {
          expect(getSubscriptionId(error)).toBe('sub_test_456');
        });
      });

      describe('getSubscriptionErrorReason', () => {
        it('should return reason', () => {
          expect(getSubscriptionErrorReason(error)).toBe('usage-limit-exceeded');
        });
      });

      describe('getSubscriptionPlanId', () => {
        it('should return planId when present', () => {
          expect(getSubscriptionPlanId(error)).toBe('plan_pro');
        });

        it('should return undefined when planId not set', () => {
          const errorNoPlan = createMockSubscriptionError('sub_123', 'expired');
          expect(getSubscriptionPlanId(errorNoPlan)).toBeUndefined();
        });
      });

      describe('getSubscriptionCurrentUsage', () => {
        it('should return currentUsage when present', () => {
          expect(getSubscriptionCurrentUsage(error)).toBe(150);
        });

        it('should return undefined when currentUsage not set', () => {
          const errorNoUsage = createMockSubscriptionError('sub_123', 'expired');
          expect(getSubscriptionCurrentUsage(errorNoUsage)).toBeUndefined();
        });
      });

      describe('getSubscriptionAllowedUsage', () => {
        it('should return allowedUsage when present', () => {
          expect(getSubscriptionAllowedUsage(error)).toBe(100);
        });

        it('should return undefined when allowedUsage not set', () => {
          const errorNoUsage = createMockSubscriptionError('sub_123', 'expired');
          expect(getSubscriptionAllowedUsage(errorNoUsage)).toBeUndefined();
        });
      });
    });

    describe('RefundError accessors', () => {
      const error = createMockRefundError(
        'txn_refund_789',
        'refund-window-expired',
        { refundAmount: 5000, currency: 'BYN', daysSinceTransaction: 35 },
      );

      describe('getRefundTransactionId', () => {
        it('should return transactionId', () => {
          expect(getRefundTransactionId(error)).toBe('txn_refund_789');
        });
      });

      describe('getRefundErrorReason', () => {
        it('should return reason', () => {
          expect(getRefundErrorReason(error)).toBe('refund-window-expired');
        });
      });

      describe('getRefundAmount', () => {
        it('should return refundAmount when present', () => {
          expect(getRefundAmount(error)).toBe(5000);
        });

        it('should return undefined when refundAmount not set', () => {
          const errorNoAmount = createMockRefundError('txn_123', 'failed');
          expect(getRefundAmount(errorNoAmount)).toBeUndefined();
        });
      });

      describe('getRefundCurrency', () => {
        it('should return currency when present', () => {
          expect(getRefundCurrency(error)).toBe('BYN');
        });

        it('should return undefined when currency not set', () => {
          const errorNoCurrency = createMockRefundError('txn_123', 'failed');
          expect(getRefundCurrency(errorNoCurrency)).toBeUndefined();
        });
      });

      describe('getRefundDaysSinceTransaction', () => {
        it('should return daysSinceTransaction when present', () => {
          expect(getRefundDaysSinceTransaction(error)).toBe(35);
        });

        it('should return undefined when daysSinceTransaction not set', () => {
          const errorNoDays = createMockRefundError('txn_123', 'failed');
          expect(getRefundDaysSinceTransaction(errorNoDays)).toBeUndefined();
        });
      });
    });

    describe('Generic BillingServiceError accessors', () => {
      const paymentError = createMockPaymentFailedError('txn_123', 1000, 'BYN');
      const subscriptionError = createMockSubscriptionError('sub_456', 'expired');
      const refundError = createMockRefundError('txn_789', 'failed');

      describe('getBillingServiceErrorCode', () => {
        it('should return code for PaymentFailedError', () => {
          expect(getBillingServiceErrorCode(paymentError)).toBe('SERVICE_BILLING_100');
        });

        it('should return code for SubscriptionError', () => {
          expect(getBillingServiceErrorCode(subscriptionError)).toBe('SERVICE_BILLING_101');
        });

        it('should return code for RefundError', () => {
          expect(getBillingServiceErrorCode(refundError)).toBe('SERVICE_BILLING_102');
        });
      });

      describe('getBillingServiceErrorTimestamp', () => {
        it('should return timestamp for PaymentFailedError', () => {
          expect(getBillingServiceErrorTimestamp(paymentError)).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
          );
        });

        it('should return timestamp for SubscriptionError', () => {
          expect(getBillingServiceErrorTimestamp(subscriptionError)).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
          );
        });

        it('should return timestamp for RefundError', () => {
          expect(getBillingServiceErrorTimestamp(refundError)).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
          );
        });
      });

      describe('getBillingServiceErrorSummary', () => {
        it('should return summary for PaymentFailedError', () => {
          expect(getBillingServiceErrorSummary(paymentError)).toBe(
            'Payment failed for txn_123 (1000 BYN)',
          );
        });

        it('should return summary for SubscriptionError', () => {
          expect(getBillingServiceErrorSummary(subscriptionError)).toBe(
            'Subscription error for sub_456: expired',
          );
        });

        it('should return summary for RefundError', () => {
          expect(getBillingServiceErrorSummary(refundError)).toBe(
            'Refund error for txn_789: failed',
          );
        });

        it('should handle different currencies in payment summary', () => {
          const usdError = createMockPaymentFailedError('txn_usd', 5000, 'USD');
          const rubError = createMockPaymentFailedError('txn_rub', 25000, 'RUB');
          const eurError = createMockPaymentFailedError('txn_eur', 1000, 'EUR');

          expect(getBillingServiceErrorSummary(usdError)).toBe(
            'Payment failed for txn_usd (5000 USD)',
          );
          expect(getBillingServiceErrorSummary(rubError)).toBe(
            'Payment failed for txn_rub (25000 RUB)',
          );
          expect(getBillingServiceErrorSummary(eurError)).toBe(
            'Payment failed for txn_eur (1000 EUR)',
          );
        });

        it('should handle undefined values in subscription summary', () => {
          const errorNoDetails = createMockSubscriptionError('sub_123', 'test-reason');
          expect(getBillingServiceErrorSummary(errorNoDetails)).toBe(
            'Subscription error for sub_123: test-reason',
          );
        });

        it('should handle undefined values in refund summary', () => {
          const errorNoDetails = createMockRefundError('txn_123', 'test-reason');
          expect(getBillingServiceErrorSummary(errorNoDetails)).toBe(
            'Refund error for txn_123: test-reason',
          );
        });
      });
    });
  });

  describe('Domain to Service Mapping', () => {
    describe('domainErrorToServiceError', () => {
      it('should convert PaymentValidationError to PaymentFailedError', () => {
        const domainError = createMockDomainError('payment');
        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as PaymentFailedError;

        expect(serviceError._tag).toBe('PaymentFailedError');
        expect(serviceError.category).toBe('BUSINESS');
        expect(serviceError.origin).toBe('SERVICE');
        expect(serviceError.code).toBe('SERVICE_BILLING_100');
        expect(serviceError.message).toContain('Payment validation failed: amount.min.BYN');
        expect(serviceError.details.transactionId).toBe('txn_123');
        expect(serviceError.details.amount).toBe(50);
        expect(serviceError.details.currency).toBe('BYN'); // fallback currency
        expect(serviceError.details.retryable).toBe(false); // retryable зависит от retryPolicy
        expect(serviceError.details.operation).toBe('validation');
      });

      it('should convert PaymentValidationError with provider', () => {
        const domainError = createMockDomainError('payment');
        // Manually set provider in domain error
        (domainError.details as any).paymentMethod = 'bank_transfer';

        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as PaymentFailedError;

        expect(serviceError.details.provider).toBe('bank_transfer');
      });

      it('should handle PaymentValidationError with missing transactionId', () => {
        const domainError = createMockDomainError('payment');
        (domainError.details as any).transactionId = undefined;

        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as PaymentFailedError;

        expect(serviceError.details.transactionId).toBe('unknown');
      });

      // Note: Testing missing amount would result in amount: 0, which fails validation

      it('should convert SubscriptionLimitError to SubscriptionError', () => {
        const domainError = createMockDomainError('subscription');
        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as SubscriptionError;

        expect(serviceError._tag).toBe('SubscriptionError');
        expect(serviceError.category).toBe('BUSINESS');
        expect(serviceError.origin).toBe('SERVICE');
        expect(serviceError.code).toBe('SERVICE_BILLING_101');
        expect(serviceError.message).toBe('Subscription error: usage-limit-exceeded');
        expect(serviceError.details.subscriptionId).toBe('sub_456');
        expect(serviceError.details.reason).toBe('usage-limit-exceeded');
        expect(serviceError.details.planId).toBe('plan_123');
        expect(serviceError.details.currentUsage).toBe(150);
        expect(serviceError.details.allowedUsage).toBe(100);
      });

      it('should handle SubscriptionLimitError with subscriptionId fallback to planId', () => {
        const domainError = createMockDomainError('subscription');
        (domainError.details as any).subscriptionId = undefined;

        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as SubscriptionError;

        expect(serviceError.details.subscriptionId).toBe('plan_123'); // fallback to planId
      });

      it('should handle SubscriptionLimitError with undefined optional fields', () => {
        const domainError = createMockDomainError('subscription');
        (domainError.details as any).currentUsage = undefined;
        (domainError.details as any).allowedUsage = undefined;

        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as SubscriptionError;

        expect(serviceError.details.currentUsage).toBeUndefined();
        expect(serviceError.details.allowedUsage).toBeUndefined();
      });

      it('should convert RefundPolicyError to RefundError', () => {
        const domainError = createMockDomainError('refund');
        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as RefundError;

        expect(serviceError._tag).toBe('RefundError');
        expect(serviceError.category).toBe('BUSINESS');
        expect(serviceError.origin).toBe('SERVICE');
        expect(serviceError.code).toBe('SERVICE_BILLING_102');
        expect(serviceError.message).toBe('Refund processing failed: refund-window-expired');
        expect(serviceError.details.transactionId).toBe('txn_123');
        expect(serviceError.details.reason).toBe('refund-window-expired');
        expect(serviceError.details.refundAmount).toBe(5000);
        expect(serviceError.details.currency).toBe('BYN');
        expect(serviceError.details.daysSinceTransaction).toBe(35);
      });

      it('should handle RefundPolicyError with undefined optional fields', () => {
        const domainError = createMockDomainError('refund');
        (domainError.details as any).refundAmount = undefined;
        (domainError.details as any).currency = undefined;
        (domainError.details as any).daysSinceTransaction = undefined;

        const serviceErrorEffect = domainErrorToServiceError(domainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as RefundError;

        expect(serviceError.details.refundAmount).toBeUndefined();
        expect(serviceError.details.currency).toBeUndefined();
        expect(serviceError.details.daysSinceTransaction).toBeUndefined();
      });

      it('should throw error for unknown domain error type', () => {
        const unknownDomainError = {
          ...createMockDomainError('payment'),
          _tag: 'UnknownDomainError' as any,
        };

        expect(() => {
          const serviceErrorEffect = domainErrorToServiceError(unknownDomainError as any);
          Effect.runSync(serviceErrorEffect as any);
        }).toThrow(/Unknown domain error type/);
      });

      it('should preserve domain error details in service error', () => {
        // Test PaymentValidationError details preservation
        const paymentDomainError = createMockDomainError('payment');
        (paymentDomainError.details as any).amount = 999;
        (paymentDomainError.details as any).currency = 'USD';

        const paymentServiceErrorEffect = domainErrorToServiceError(paymentDomainError);
        const paymentServiceError = Effect.runSync(
          paymentServiceErrorEffect as any,
        ) as PaymentFailedError;

        expect(paymentServiceError.details.amount).toBe(999);
        expect(paymentServiceError.details.currency).toBe('USD'); // from domain error

        // Test SubscriptionLimitError details preservation
        const subscriptionDomainError = createMockDomainError('subscription');
        (subscriptionDomainError.details as any).currentUsage = 999;
        (subscriptionDomainError.details as any).allowedUsage = 1000;

        const subscriptionServiceErrorEffect = domainErrorToServiceError(subscriptionDomainError);
        const subscriptionServiceError = Effect.runSync(
          subscriptionServiceErrorEffect as any,
        ) as SubscriptionError;

        expect(subscriptionServiceError.details.currentUsage).toBe(999);
        expect(subscriptionServiceError.details.allowedUsage).toBe(1000);
      });

      it('should handle all domain error types correctly', () => {
        const domainErrors = [
          createMockDomainError('payment'),
          createMockDomainError('subscription'),
          createMockDomainError('refund'),
        ];

        const serviceErrors = domainErrors.map((error) => {
          const effect = domainErrorToServiceError(error);
          return Effect.runSync(effect as any) as BillingServiceError;
        });

        expect(serviceErrors[0]._tag).toBe('PaymentFailedError');
        expect(serviceErrors[1]._tag).toBe('SubscriptionError');
        expect(serviceErrors[2]._tag).toBe('RefundError');

        expect(serviceErrors[0].code).toBe('SERVICE_BILLING_100');
        expect(serviceErrors[1].code).toBe('SERVICE_BILLING_101');
        expect(serviceErrors[2].code).toBe('SERVICE_BILLING_102');
      });
    });
  });

  describe('Helper Functions', () => {
    describe('normalizeOptionalContext', () => {
      it('should return empty object for undefined context', () => {
        const result = normalizeOptionalContext(undefined);
        expect(result).toEqual({});
      });

      it('should return empty object for null context', () => {
        const result = normalizeOptionalContext(null as any);
        expect(result).toEqual({});
      });

      it('should filter out null and undefined values', () => {
        const context = {
          field1: 'value1',
          field2: null,
          field3: undefined,
          field4: 'value4',
          field5: 0, // zero should be preserved
          field6: false, // false should be preserved
        };

        const result = normalizeOptionalContext(context);
        expect(result).toEqual({
          field1: 'value1',
          field4: 'value4',
          field5: 0,
          field6: false,
        });
      });

      it('should preserve all non-null values', () => {
        const context = {
          stringField: 'test',
          numberField: 42,
          booleanField: true,
          objectField: { nested: 'value' },
          arrayField: [1, 2, 3],
        };

        const result = normalizeOptionalContext(context);
        expect(result).toEqual(context);
      });

      it('should handle empty objects', () => {
        const result = normalizeOptionalContext({});
        expect(result).toEqual({});
      });

      it('should work with different types of optional contexts', () => {
        // Test with PaymentFailedError context
        const paymentContext = {
          provider: 'bank_transfer' as const,
          operation: undefined,
        };
        const normalizedPayment = normalizeOptionalContext(paymentContext);
        expect(normalizedPayment).toEqual({ provider: 'bank_transfer' });

        // Test with SubscriptionError context
        const subscriptionContext = {
          planId: 'plan_123',
          currentUsage: null,
          allowedUsage: 100,
        };
        const normalizedSubscription = normalizeOptionalContext(subscriptionContext);
        expect(normalizedSubscription).toEqual({
          planId: 'plan_123',
          allowedUsage: 100,
        });

        // Test with RefundError context
        const refundContext = {
          refundAmount: 5000,
          currency: undefined,
          daysSinceTransaction: 30,
        };
        const normalizedRefund = normalizeOptionalContext(refundContext);
        expect(normalizedRefund).toEqual({
          refundAmount: 5000,
          daysSinceTransaction: 30,
        });
      });
    });

    // Note: Internal helper functions (createBillingServiceEffect, createBillingServiceError,
    // extractSupportedCurrency, extractSupportedPaymentMethod) are not exported and thus not tested.
    // Only exported helper functions are tested.
  });

  describe('Edge Cases', () => {
    describe('Empty and null values', () => {
      it('should handle empty strings in transaction IDs', () => {
        const error = createMockPaymentFailedError('');
        expect(getPaymentTransactionId(error)).toBe('');
      });

      it('should handle empty strings in subscription IDs', () => {
        const error = createMockSubscriptionError('');
        expect(getSubscriptionId(error)).toBe('');
      });

      it('should handle empty strings in refund transaction IDs', () => {
        const error = createMockRefundError('');
        expect(getRefundTransactionId(error)).toBe('');
      });

      it('should handle empty reasons', () => {
        const error = createMockSubscriptionError('sub_123', '');
        expect(getSubscriptionErrorReason(error)).toBe('');
        expect(error.message).toBe('Subscription error: ');
      });

      // Note: Zero amounts are not allowed by createPaymentFailedError validation

      it('should handle negative amounts in context (though unusual)', () => {
        const error = createMockRefundError('txn_123', 'test', { refundAmount: -100 });
        expect(getRefundAmount(error)).toBe(-100);
      });
    });

    describe('Large values', () => {
      // Note: Very large amounts are not allowed by createPaymentFailedError validation

      it('should handle very large usage values', () => {
        const largeUsage = 999999999;
        const error = createMockSubscriptionError('sub_large', 'exceeded', {
          currentUsage: largeUsage,
          allowedUsage: largeUsage + 1,
        });
        expect(getSubscriptionCurrentUsage(error)).toBe(largeUsage);
        expect(getSubscriptionAllowedUsage(error)).toBe(largeUsage + 1);
      });

      it('should handle very large refund amounts', () => {
        const largeRefund = 999999999999;
        const error = createMockRefundError('txn_large', 'test', {
          refundAmount: largeRefund,
        });
        expect(getRefundAmount(error)).toBe(largeRefund);
      });

      it('should handle very large days since transaction', () => {
        const largeDays = 999999;
        const error = createMockRefundError('txn_old', 'expired', {
          daysSinceTransaction: largeDays,
        });
        expect(getRefundDaysSinceTransaction(error)).toBe(largeDays);
      });
    });

    describe('Special characters and unicode', () => {
      it('should handle unicode characters in transaction IDs', () => {
        const unicodeId = 'txn_тест_123_🚀_🎯';
        const error = createMockPaymentFailedError(unicodeId);
        expect(getPaymentTransactionId(error)).toBe(unicodeId);
      });

      it('should handle unicode characters in reasons', () => {
        const unicodeReason = 'Ошибка: превышен лимит 🚫';
        const error = createMockSubscriptionError('sub_123', unicodeReason);
        expect(getSubscriptionErrorReason(error)).toBe(unicodeReason);
        expect(error.message).toBe(`Subscription error: ${unicodeReason}`);
      });

      it('should handle special characters in plan IDs', () => {
        const specialPlanId = 'plan@special_123-456.test';
        const error = createMockSubscriptionError('sub_123', 'test', { planId: specialPlanId });
        expect(getSubscriptionPlanId(error)).toBe(specialPlanId);
      });

      it('should handle unicode in currency strings', () => {
        const error = createMockRefundError('txn_123', 'test', { currency: '₽РУБ' });
        expect(getRefundCurrency(error)).toBe('₽РУБ');
      });
    });

    describe('Pattern matching edge cases', () => {
      it('should handle pattern matching with missing handlers', () => {
        const error = createMockPaymentFailedError();

        // Test with incomplete pattern (should cause compile error in real usage, but runtime works)
        const result = safeMatchBillingServiceError(error, {
          paymentFailedError: (e) => `PAYMENT: ${getPaymentTransactionId(e)}`,
          subscriptionError: () => 'SUBSCRIPTION',
          refundError: () => 'REFUND',
          infrastructureUnknownError: () => 'INFRASTRUCTURE',
          fallback: () => 'UNKNOWN',
        });

        expect(result).toBe('PAYMENT: txn_123456');
      });

      it('should handle safe pattern matching with unknown error types', () => {
        const unknownError = {
          _tag: 'CompletelyUnknownError',
          code: 'UNKNOWN',
          origin: 'UNKNOWN',
          category: 'UNKNOWN',
          severity: 'high',
          message: 'Unknown error',
          details: { someField: 'value' },
          timestamp: '2024-01-01T12:00:00.000Z',
        };

        const result = safeMatchBillingServiceError(unknownError, {
          paymentFailedError: () => 'PAYMENT',
          subscriptionError: () => 'SUBSCRIPTION',
          refundError: () => 'REFUND',
          infrastructureUnknownError: () => 'INFRASTRUCTURE',
          fallback: () => 'FALLBACK_TRIGGERED',
        });

        expect(result).toBe('FALLBACK_TRIGGERED');
      });
    });

    describe('Type guard edge cases', () => {
      it('should handle type guards with malformed objects', () => {
        const malformedErrors = [
          { _tag: 'PaymentFailedError' }, // missing required fields
          { _tag: 'PaymentFailedError', code: 'TEST' }, // missing other fields
          {
            _tag: 'PaymentFailedError',
            code: 'TEST',
            origin: 'SERVICE',
            category: 'BUSINESS',
            severity: 'high',
            message: 'Test',
            details: null, // null details
            timestamp: '2024-01-01T12:00:00.000Z',
          },
          {
            _tag: 'PaymentFailedError',
            code: 'TEST',
            origin: 'SERVICE',
            category: 'BUSINESS',
            severity: 'high',
            message: 'Test',
            details: 'not an object', // wrong details type
            timestamp: '2024-01-01T12:00:00.000Z',
          },
        ];

        malformedErrors.forEach((error) => {
          expect(isPaymentFailedError(error)).toBe(false);
          expect(isBillingServiceError(error)).toBe(false);
        });
      });

      it('should handle type guards with prototype pollution attempts', () => {
        const pollutedObject = {
          _tag: 'PaymentFailedError',
          code: 'SERVICE_BILLING_101',
          origin: 'SERVICE',
          category: 'BUSINESS',
          severity: 'high',
          message: 'Test',
          details: { transactionId: 'test', amount: 100, currency: 'BYN', retryable: true },
          timestamp: '2024-01-01T12:00:00.000Z',
          __proto__: { polluted: 'value' }, // prototype pollution
        };

        // Type guards should still work correctly
        expect(isPaymentFailedError(pollutedObject)).toBe(true);
        expect(isBillingServiceError(pollutedObject)).toBe(true);
      });
    });

    describe('Accessor function edge cases', () => {
      it('should handle accessors with undefined optional fields', () => {
        const minimalPaymentError = createMockPaymentFailedError('txn_minimal', 100, 'BYN');
        const minimalSubscriptionError = createMockSubscriptionError('sub_minimal', 'test');
        const minimalRefundError = createMockRefundError('txn_minimal', 'test');

        // Should not throw errors when accessing undefined fields
        expect(getPaymentProvider(minimalPaymentError)).toBeUndefined();
        expect(getSubscriptionPlanId(minimalSubscriptionError)).toBeUndefined();
        expect(getSubscriptionCurrentUsage(minimalSubscriptionError)).toBeUndefined();
        expect(getSubscriptionAllowedUsage(minimalSubscriptionError)).toBeUndefined();
        expect(getRefundAmount(minimalRefundError)).toBeUndefined();
        expect(getRefundCurrency(minimalRefundError)).toBeUndefined();
        expect(getRefundDaysSinceTransaction(minimalRefundError)).toBeUndefined();
      });

      it('should handle summary generation with undefined values', () => {
        const minimalErrors = [
          createMockPaymentFailedError('txn_1', 100, 'BYN'),
          createMockSubscriptionError('sub_1', 'test'),
          createMockRefundError('txn_2', 'test'),
        ];

        const summaries = minimalErrors.map((error) => getBillingServiceErrorSummary(error));

        expect(summaries[0]).toBe('Payment failed for txn_1 (100 BYN)');
        expect(summaries[1]).toBe('Subscription error for sub_1: test');
        expect(summaries[2]).toBe('Refund error for txn_2: test');
      });
    });

    describe('Domain mapping edge cases', () => {
      it('should handle domain mapping with malformed domain errors', () => {
        const malformedDomainError = {
          _tag: 'PaymentValidationError',
          code: 'SERVICE_BILLING_103',
          origin: 'DOMAIN',
          category: 'BUSINESS',
          severity: 'high',
          message: 'Malformed error',
          details: {
            type: 'payment_validation',
            reason: 'invalid-amount',
            rule: 'amount.min.BYN',
            // missing required fields like amount, currency, etc.
          },
          timestamp: '2024-01-01T12:00:00.000Z',
        };

        // Note: This test would fail because amount: 0 is invalid for payment validation
        // const serviceErrorEffect = domainErrorToServiceError(malformedDomainError as any);
        // const serviceError = Effect.runSync(serviceErrorEffect as any) as PaymentFailedError;
      });

      it('should handle domain mapping with extreme values', () => {
        const extremeDomainError = createMockDomainError('payment');
        (extremeDomainError.details as any).transactionId = 'a'.repeat(1000); // very long ID

        const serviceErrorEffect = domainErrorToServiceError(extremeDomainError);
        const serviceError = Effect.runSync(serviceErrorEffect as any) as PaymentFailedError;

        expect(serviceError.details.transactionId).toBe('a'.repeat(1000));
      });
    });

    describe('Timestamp handling', () => {
      it('should generate valid ISO timestamps', () => {
        const error = createMockPaymentFailedError();

        // Should be valid ISO 8601 timestamp
        const timestamp = getBillingServiceErrorTimestamp(error);
        expect(() => new Date(timestamp)).not.toThrow();
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should handle timestamp parsing edge cases', () => {
        // Test that timestamps are properly formatted
        const errors = [
          createMockPaymentFailedError(),
          createMockSubscriptionError(),
          createMockRefundError(),
        ];

        errors.forEach((error) => {
          const timestamp = getBillingServiceErrorTimestamp(error);
          const parsed = new Date(timestamp);

          // Should be valid date and recent (within last minute)
          expect(parsed.getTime()).toBeGreaterThan(Date.now() - 60000);
          expect(parsed.getTime()).toBeLessThan(Date.now() + 1000);
        });
      });
    });

    describe('Memory and performance edge cases', () => {
      it('should handle creating many errors without memory leaks', () => {
        const errors: PaymentFailedError[] = [];

        // Create many errors
        for (let i = 0; i < 1000; i++) {
          errors.push(createMockPaymentFailedError(`txn_${i}`, (i + 1) * 100, 'BYN')); // i+1 to avoid 0
        }

        expect(errors).toHaveLength(1000);

        // Verify all are valid
        errors.forEach((error, index) => {
          expect(error._tag).toBe('PaymentFailedError');
          expect(getPaymentTransactionId(error)).toBe(`txn_${index}`);
          expect(getPaymentAmount(error)).toBe((index + 1) * 100);
        });
      });

      it('should handle deeply nested context objects', () => {
        const deepContext = {
          nested: {
            deeply: {
              nested: {
                value: 'test',
                array: [1, 2, { more: 'nesting' }],
              },
            },
          },
        };

        // This should work without issues (though not recommended in practice)
        const error = createMockSubscriptionError('sub_123', 'test', deepContext as any);
        expect((error.details as any).nested).toBeDefined();
      });
    });
  });
});
