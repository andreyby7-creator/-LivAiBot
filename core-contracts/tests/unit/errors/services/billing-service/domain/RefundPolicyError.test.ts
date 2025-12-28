import { describe, expect, it } from 'vitest';

import {
  createRefundPolicyError,
  DEFAULT_REFUND_SUGGESTIONS,
  getDaysSinceTransaction,
  getMaxRefundAmount,
  getMaxRefundWindowDays,
  getRecommendedRefundActions,
  getRefundAmount,
  getRefundAmountPercentage,
  getRefundCurrency,
  getRefundPolicyReason,
  getRefundPolicySuggestions,
  getRefundRegionId,
  getRefundSessionId,
  getRefundTenantId,
  getRefundTransactionId,
  getRefundUserId,
  getRefundWindowPercentage,
  isRefundAmountExceeded,
  isRefundPolicyError,
  isRefundWindowExpired,
  isValidRefundPolicyErrorContext,
  VALID_REFUND_POLICY_REASONS,
} from '../../../../../../src/errors/services/billing-service/domain/index.js';
import type {
  RefundPolicyError,
  RefundPolicyErrorContext,
  RefundPolicyReason,
} from '../../../../../../src/errors/services/billing-service/domain/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock RefundPolicyErrorContext для тестов */
function createMockRefundPolicyContext(
  overrides: Partial<RefundPolicyErrorContext> = {},
): RefundPolicyErrorContext {
  return {
    type: 'refund_policy',
    reason: 'refund-window-expired',
    transactionId: 'txn_123456',
    refundAmount: 50,
    maxRefundAmount: 100,
    daysSinceTransaction: 35,
    maxRefundWindowDays: 30,
    currency: 'USD',
    userId: 'user_789',
    sessionId: 'session_101',
    regionId: 'us-east-1',
    tenantId: 'tenant_abc',
    suggestions: ['Contact support', 'Review policy'],
    ...overrides,
  };
}

/** Создает mock RefundPolicyError для тестов */
function createMockRefundPolicyError(
  contextOverrides: Partial<RefundPolicyErrorContext> = {},
): RefundPolicyError {
  const context = createMockRefundPolicyContext(contextOverrides);
  return createRefundPolicyError(
    context.reason,
    context.transactionId,
    'Test refund policy error',
    {
      refundAmount: context.refundAmount,
      maxRefundAmount: context.maxRefundAmount,
      daysSinceTransaction: context.daysSinceTransaction,
      maxRefundWindowDays: context.maxRefundWindowDays,
      currency: context.currency,
      userId: context.userId,
      sessionId: context.sessionId,
      regionId: context.regionId,
      tenantId: context.tenantId,
      suggestions: context.suggestions,
    },
  );
}

// ==================== TESTS ====================

describe('RefundPolicyError Domain', () => {
  describe('createRefundPolicyError', () => {
    it('should create RefundPolicyError with all fields', () => {
      const error = createRefundPolicyError(
        'refund-window-expired',
        'txn_123456',
        'Refund window has expired',
        {
          refundAmount: 50,
          maxRefundAmount: 100,
          daysSinceTransaction: 35,
          maxRefundWindowDays: 30,
          currency: 'USD',
          userId: 'user_789',
          sessionId: 'session_101',
          regionId: 'us-east-1',
          tenantId: 'tenant_abc',
          suggestions: ['Contact support', 'Review policy'],
        },
      );

      expect(error._tag).toBe('RefundPolicyError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('DOMAIN');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_105');
      expect(error.message).toBe('Refund window has expired');
      expect(error.details).toEqual({
        type: 'refund_policy',
        reason: 'refund-window-expired',
        transactionId: 'txn_123456',
        refundAmount: 50,
        maxRefundAmount: 100,
        daysSinceTransaction: 35,
        maxRefundWindowDays: 30,
        currency: 'USD',
        userId: 'user_789',
        sessionId: 'session_101',
        regionId: 'us-east-1',
        tenantId: 'tenant_abc',
        suggestions: ['Contact support', 'Review policy'],
      });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should create error with minimal context', () => {
      const error = createRefundPolicyError(
        'non-refundable-transaction',
        'txn_789',
        'Transaction is not refundable',
      );

      expect(error._tag).toBe('RefundPolicyError');
      expect(error.details).toEqual({
        type: 'refund_policy',
        reason: 'non-refundable-transaction',
        transactionId: 'txn_789',
      });
    });

    it('should create CRITICAL severity error for insufficient-funds', () => {
      const error = createRefundPolicyError(
        'insufficient-funds',
        'txn_999',
        'Insufficient funds for refund',
      );

      expect(error.severity).toBe('critical');
    });

    it('should create HIGH severity error for other reasons', () => {
      const error = createRefundPolicyError(
        'refund-amount-exceeded',
        'txn_888',
        'Refund amount exceeds maximum',
      );

      expect(error.severity).toBe('high');
    });

    it('should handle Date resetDate in context', () => {
      const error = createRefundPolicyError(
        'refund-already-processed',
        'txn_777',
        'Refund already processed',
        { resetDate: new Date('2024-12-31') },
      );

      expect(error.details.resetDate).toEqual(new Date('2024-12-31'));
    });

    it('should handle string resetDate in context', () => {
      const error = createRefundPolicyError(
        'partial-refund-not-allowed',
        'txn_666',
        'Partial refund not allowed',
        { resetDate: '2024-12-31T23:59:59.999Z' },
      );

      expect(error.details.resetDate).toBe('2024-12-31T23:59:59.999Z');
    });
  });

  describe('isValidRefundPolicyErrorContext', () => {
    it('should return true for valid context', () => {
      const context = createMockRefundPolicyContext();
      expect(isValidRefundPolicyErrorContext(context)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidRefundPolicyErrorContext(null)).toBe(false);
      expect(isValidRefundPolicyErrorContext(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidRefundPolicyErrorContext('string')).toBe(false);
      expect(isValidRefundPolicyErrorContext(123)).toBe(false);
    });

    it('should return false for invalid type', () => {
      const context = createMockRefundPolicyContext({ type: 'invalid' as any });
      expect(isValidRefundPolicyErrorContext(context)).toBe(false);
    });

    it('should return false for invalid reason', () => {
      const context = createMockRefundPolicyContext({ reason: 'invalid-reason' as any });
      expect(isValidRefundPolicyErrorContext(context)).toBe(false);
    });

    it('should return false for non-string reason', () => {
      const context = {
        ...createMockRefundPolicyContext(),
        reason: 123 as any, // Invalid reason type
      };
      expect(isValidRefundPolicyErrorContext(context)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const context = { type: 'refund_policy', reason: 'refund-window-expired' } as any;
      expect(isValidRefundPolicyErrorContext(context)).toBe(false);
    });

    it('should validate numeric fields', () => {
      // Valid numeric fields
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ refundAmount: 50, maxRefundAmount: 100 }),
      )).toBe(true);

      // Invalid refundAmount (negative)
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ refundAmount: -10 }),
      )).toBe(false);

      // Invalid maxRefundAmount (zero)
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ maxRefundAmount: 0 }),
      )).toBe(false);

      // Invalid daysSinceTransaction (negative)
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ daysSinceTransaction: -5 }),
      )).toBe(false);

      // Invalid maxRefundWindowDays (zero)
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ maxRefundWindowDays: 0 }),
      )).toBe(false);
    });

    it('should validate string fields', () => {
      // Invalid transactionId
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ transactionId: 123 as any }),
      )).toBe(false);

      // Invalid currency
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ currency: {} as any }),
      )).toBe(false);

      // Invalid userId
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ userId: [] as any }),
      )).toBe(false);

      // Invalid regionId
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ regionId: 456 as any }),
      )).toBe(false);

      // Invalid sessionId
      const contextWithInvalidSessionId = {
        ...createMockRefundPolicyContext(),
        sessionId: {} as any, // Invalid sessionId type
      };
      expect(isValidRefundPolicyErrorContext(contextWithInvalidSessionId)).toBe(false);

      // Invalid tenantId
      const contextWithInvalidTenantId = {
        ...createMockRefundPolicyContext(),
        tenantId: 789 as any, // Invalid tenantId type
      };
      expect(isValidRefundPolicyErrorContext(contextWithInvalidTenantId)).toBe(false);
    });

    it('should validate suggestions array', () => {
      // Valid suggestions
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ suggestions: ['Suggestion 1', 'Suggestion 2'] }),
      )).toBe(true);

      // Invalid suggestions (not array)
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ suggestions: 'not array' as any }),
      )).toBe(false);

      // Invalid suggestions (contains empty strings)
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ suggestions: ['valid', '', 'another valid'] }),
      )).toBe(false);
    });

    it('should validate resetDate types', () => {
      // Valid Date
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ resetDate: new Date() }),
      )).toBe(true);

      // Valid string
      expect(isValidRefundPolicyErrorContext(
        createMockRefundPolicyContext({ resetDate: '2024-12-31T23:59:59.999Z' }),
      )).toBe(true);

      // Invalid type
      const contextWithInvalidResetDate = {
        ...createMockRefundPolicyContext(),
        resetDate: 123 as any, // Invalid resetDate type
      };
      expect(isValidRefundPolicyErrorContext(contextWithInvalidResetDate)).toBe(false);
    });

    it('should accept all valid reasons', () => {
      VALID_REFUND_POLICY_REASONS.forEach((reason) => {
        const context = createMockRefundPolicyContext({ reason });
        expect(isValidRefundPolicyErrorContext(context)).toBe(true);
      });
    });
  });

  describe('isRefundPolicyError', () => {
    it('should return true for RefundPolicyError', () => {
      const error = createMockRefundPolicyError();
      expect(isRefundPolicyError(error)).toBe(true);
    });

    it('should return false for other objects', () => {
      expect(isRefundPolicyError(null)).toBe(false);
      expect(isRefundPolicyError({})).toBe(false);
      expect(isRefundPolicyError({ _tag: 'OtherError' })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isRefundPolicyError('string')).toBe(false);
      expect(isRefundPolicyError(123)).toBe(false);
    });
  });

  describe('Accessor functions', () => {
    const error = createMockRefundPolicyError();

    describe('getRefundPolicyReason', () => {
      it('should return reason', () => {
        expect(getRefundPolicyReason(error)).toBe('refund-window-expired');
      });
    });

    describe('getRefundTransactionId', () => {
      it('should return transactionId', () => {
        expect(getRefundTransactionId(error)).toBe('txn_123456');
      });
    });

    describe('getRefundAmount', () => {
      it('should return refundAmount', () => {
        expect(getRefundAmount(error)).toBe(50);
      });

      it('should return undefined when refundAmount not set', () => {
        const errorNoAmount = createRefundPolicyError(
          'non-refundable-transaction',
          'txn_999',
          'Not refundable',
        );
        expect(getRefundAmount(errorNoAmount)).toBeUndefined();
      });
    });

    describe('getMaxRefundAmount', () => {
      it('should return maxRefundAmount', () => {
        expect(getMaxRefundAmount(error)).toBe(100);
      });
    });

    describe('getDaysSinceTransaction', () => {
      it('should return daysSinceTransaction', () => {
        expect(getDaysSinceTransaction(error)).toBe(35);
      });
    });

    describe('getMaxRefundWindowDays', () => {
      it('should return maxRefundWindowDays', () => {
        expect(getMaxRefundWindowDays(error)).toBe(30);
      });
    });

    describe('getRefundCurrency', () => {
      it('should return currency', () => {
        expect(getRefundCurrency(error)).toBe('USD');
      });
    });

    describe('getRefundUserId', () => {
      it('should return userId', () => {
        expect(getRefundUserId(error)).toBe('user_789');
      });
    });

    describe('getRefundSessionId', () => {
      it('should return sessionId', () => {
        expect(getRefundSessionId(error)).toBe('session_101');
      });
    });

    describe('getRefundRegionId', () => {
      it('should return regionId', () => {
        expect(getRefundRegionId(error)).toBe('us-east-1');
      });
    });

    describe('getRefundTenantId', () => {
      it('should return tenantId', () => {
        expect(getRefundTenantId(error)).toBe('tenant_abc');
      });
    });

    describe('getRefundPolicySuggestions', () => {
      it('should return suggestions', () => {
        expect(getRefundPolicySuggestions(error)).toEqual(['Contact support', 'Review policy']);
      });
    });
  });

  describe('Business logic functions', () => {
    describe('getRefundWindowPercentage', () => {
      it('should calculate window percentage correctly', () => {
        const error = createMockRefundPolicyError({
          daysSinceTransaction: 25,
          maxRefundWindowDays: 30,
        });
        expect(getRefundWindowPercentage(error)).toBe(83); // (25/30) * 100 = 83.33 → 83
      });

      it('should return 100 when expired', () => {
        const error = createMockRefundPolicyError({
          daysSinceTransaction: 35,
          maxRefundWindowDays: 30,
        });
        expect(getRefundWindowPercentage(error)).toBe(100); // Capped at 100
      });

      it('should return undefined when no window data', () => {
        const error = createRefundPolicyError(
          'non-refundable-transaction',
          'txn_111',
          'Not refundable',
        );
        expect(getRefundWindowPercentage(error)).toBeUndefined();
      });

      it('should return undefined when maxRefundWindowDays is 0', () => {
        const error = createMockRefundPolicyError({
          daysSinceTransaction: 10,
          maxRefundWindowDays: 0,
        });
        expect(getRefundWindowPercentage(error)).toBeUndefined();
      });
    });

    describe('getRefundAmountPercentage', () => {
      it('should calculate amount percentage correctly', () => {
        const error = createMockRefundPolicyError({
          refundAmount: 75,
          maxRefundAmount: 100,
        });
        expect(getRefundAmountPercentage(error)).toBe(75); // (75/100) * 100 = 75
      });

      it('should return 100 when at maximum', () => {
        const error = createMockRefundPolicyError({
          refundAmount: 150,
          maxRefundAmount: 100,
        });
        expect(getRefundAmountPercentage(error)).toBe(100); // Capped at 100
      });

      it('should return undefined when no amount data', () => {
        const error = createRefundPolicyError(
          'refund-already-processed',
          'txn_222',
          'Already processed',
        );
        expect(getRefundAmountPercentage(error)).toBeUndefined();
      });

      it('should return undefined when maxRefundAmount is 0', () => {
        const error = createMockRefundPolicyError({
          refundAmount: 50,
          maxRefundAmount: 0,
        });
        expect(getRefundAmountPercentage(error)).toBeUndefined();
      });
    });

    describe('isRefundWindowExpired', () => {
      it('should return true when window is expired', () => {
        const error = createMockRefundPolicyError({
          daysSinceTransaction: 35,
          maxRefundWindowDays: 30,
        });
        expect(isRefundWindowExpired(error)).toBe(true);
      });

      it('should return false when window is not expired', () => {
        const error = createMockRefundPolicyError({
          daysSinceTransaction: 25,
          maxRefundWindowDays: 30,
        });
        expect(isRefundWindowExpired(error)).toBe(false);
      });

      it('should return false when no window data', () => {
        const error = createRefundPolicyError(
          'insufficient-funds',
          'txn_333',
          'No funds',
        );
        expect(isRefundWindowExpired(error)).toBe(false);
      });
    });

    describe('isRefundAmountExceeded', () => {
      it('should return true when amount exceeds maximum', () => {
        const error = createMockRefundPolicyError({
          refundAmount: 150,
          maxRefundAmount: 100,
        });
        expect(isRefundAmountExceeded(error)).toBe(true);
      });

      it('should return false when amount is within limits', () => {
        const error = createMockRefundPolicyError({
          refundAmount: 75,
          maxRefundAmount: 100,
        });
        expect(isRefundAmountExceeded(error)).toBe(false);
      });

      it('should return false when no amount data', () => {
        const error = createRefundPolicyError(
          'partial-refund-not-allowed',
          'txn_444',
          'Partial not allowed',
        );
        expect(isRefundAmountExceeded(error)).toBe(false);
      });
    });

    describe('getRecommendedRefundActions', () => {
      it('should return custom suggestions when provided', () => {
        const error = createMockRefundPolicyError({
          suggestions: ['Custom action 1', 'Custom action 2'],
        });
        expect(getRecommendedRefundActions(error)).toEqual(['Custom action 1', 'Custom action 2']);
      });

      it('should return default suggestions based on reason', () => {
        const testCases: { reason: RefundPolicyReason; expected: readonly string[]; }[] = [
          {
            reason: 'refund-window-expired',
            expected: DEFAULT_REFUND_SUGGESTIONS['refund-window-expired'],
          },
          {
            reason: 'non-refundable-transaction',
            expected: DEFAULT_REFUND_SUGGESTIONS['non-refundable-transaction'],
          },
          {
            reason: 'partial-refund-not-allowed',
            expected: DEFAULT_REFUND_SUGGESTIONS['partial-refund-not-allowed'],
          },
          {
            reason: 'refund-amount-exceeded',
            expected: DEFAULT_REFUND_SUGGESTIONS['refund-amount-exceeded'],
          },
          {
            reason: 'refund-already-processed',
            expected: DEFAULT_REFUND_SUGGESTIONS['refund-already-processed'],
          },
          {
            reason: 'insufficient-funds',
            expected: DEFAULT_REFUND_SUGGESTIONS['insufficient-funds'],
          },
        ];

        testCases.forEach(({ reason, expected }) => {
          const error = createRefundPolicyError(reason, 'txn_test', 'Test error');
          expect(getRecommendedRefundActions(error)).toEqual(expected);
        });
      });

      it('should return fallback for unknown reasons', () => {
        const error = createRefundPolicyError(
          'refund-window-expired' as RefundPolicyReason,
          'txn_test',
          'Test error',
        );
        // Manually modify reason to simulate unknown (though type system prevents this)
        (error.details as any).reason = 'unknown-reason';
        expect(getRecommendedRefundActions(error)).toBeUndefined();
      });
    });
  });

  describe('Constants', () => {
    it('should export VALID_REFUND_POLICY_REASONS', () => {
      expect(VALID_REFUND_POLICY_REASONS).toEqual([
        'refund-window-expired',
        'non-refundable-transaction',
        'partial-refund-not-allowed',
        'refund-amount-exceeded',
        'refund-already-processed',
        'insufficient-funds',
      ]);
    });

    it('should export DEFAULT_REFUND_SUGGESTIONS', () => {
      expect(DEFAULT_REFUND_SUGGESTIONS).toEqual({
        'refund-window-expired': ['Contact customer support for exceptional refund approval'],
        'non-refundable-transaction': [
          'Review transaction type eligibility',
          'Consider alternative compensation',
        ],
        'partial-refund-not-allowed': ['Process full refund or cancel transaction'],
        'refund-amount-exceeded': [
          'Reduce refund amount to maximum allowed',
          'Contact support for approval',
        ],
        'refund-already-processed': ['Check refund status in transaction history'],
        'insufficient-funds': ['Verify account balance', 'Contact financial operations'],
      });
    });
  });

  describe('Edge cases', () => {
    it('should reject empty suggestions array', () => {
      const context = {
        ...createMockRefundPolicyContext(),
        suggestions: [], // Empty suggestions array
      };
      expect(isValidRefundPolicyErrorContext(context)).toBe(false);
    });

    it('should handle empty string suggestions', () => {
      const context = createMockRefundPolicyContext({
        suggestions: [''],
      });
      expect(isValidRefundPolicyErrorContext(context)).toBe(false);
    });

    it('should handle undefined optional fields', () => {
      const context: RefundPolicyErrorContext = {
        type: 'refund_policy',
        reason: 'refund-window-expired',
        transactionId: 'txn_555',
      };
      expect(isValidRefundPolicyErrorContext(context)).toBe(true);
    });

    it('should handle zero values in calculations', () => {
      const error = createMockRefundPolicyError({
        refundAmount: 0,
        maxRefundAmount: 100,
        daysSinceTransaction: 0,
        maxRefundWindowDays: 30,
      });

      expect(getRefundAmountPercentage(error)).toBe(0);
      expect(getRefundWindowPercentage(error)).toBe(0);
      expect(isRefundWindowExpired(error)).toBe(false);
      expect(isRefundAmountExceeded(error)).toBe(false);
    });

    it('should handle very large values', () => {
      const error = createMockRefundPolicyError({
        refundAmount: 999999999,
        maxRefundAmount: 1000000000,
        daysSinceTransaction: 999999,
        maxRefundWindowDays: 1000000,
      });

      expect(getRefundAmountPercentage(error)).toBe(100); // (999999999/1000000000) * 100 = 99.999 → 100
      expect(getRefundWindowPercentage(error)).toBe(100); // (999999/1000000) * 100 = 99.999 → 100
    });

    it('should handle precision edge cases', () => {
      const error = createMockRefundPolicyError({
        refundAmount: 1,
        maxRefundAmount: 3,
        daysSinceTransaction: 1,
        maxRefundWindowDays: 3,
      });

      expect(getRefundAmountPercentage(error)).toBe(33); // (1/3) * 100 = 33.333 → 33
      expect(getRefundWindowPercentage(error)).toBe(33); // (1/3) * 100 = 33.333 → 33
    });

    it('should handle all reason types in DEFAULT_REFUND_SUGGESTIONS', () => {
      VALID_REFUND_POLICY_REASONS.forEach((reason) => {
        const suggestions = DEFAULT_REFUND_SUGGESTIONS[reason as RefundPolicyReason];
        expect(suggestions).toBeDefined();
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
      });
    });
  });
});
