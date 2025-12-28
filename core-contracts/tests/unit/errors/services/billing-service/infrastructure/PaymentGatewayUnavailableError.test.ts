import { describe, expect, it } from 'vitest';

import {
  createFromProviderAPIError,
  createPaymentGatewayUnavailableError,
  getEstimatedRecoveryTimeMin,
  getRetryAfterMs,
  getSuggestedAlternatives,
  getUnavailableProvider,
  getUnavailableReason,
  hasSuggestedAlternatives,
  isGatewayUnavailableRetryable,
  isPaymentGatewayUnavailableError,
  isValidPaymentGatewayUnavailableErrorContext,
  shouldConsiderAlternatives,
} from '../../../../../../src/errors/services/billing-service/infrastructure/PaymentGatewayUnavailableError.js';

import type {
  GatewayUnavailableReason,
  PaymentGatewayUnavailableError,
  PaymentGatewayUnavailableErrorContext,
  PaymentProviderId,
} from '../../../../../../src/errors/services/billing-service/infrastructure/PaymentGatewayUnavailableError.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock PaymentGatewayUnavailableErrorContext для тестов */
function createMockPaymentGatewayUnavailableErrorContext(
  overrides: Partial<PaymentGatewayUnavailableErrorContext> = {},
): PaymentGatewayUnavailableErrorContext {
  return {
    provider: 'webpay' as PaymentProviderId,
    reason: 'timeout',
    retryAfterMs: 5000,
    estimatedRecoveryTimeMin: 10,
    suggestedAlternatives: ['bepaid' as PaymentProviderId],
    sourceErrorTag: 'WebPayAPIError',
    debugInfo: { correlationId: 'test-123' },
    ...overrides,
  };
}

/** Создает mock PaymentGatewayUnavailableError для тестов */
function createMockPaymentGatewayUnavailableError(
  contextOverrides: Partial<PaymentGatewayUnavailableErrorContext> = {},
  message = 'Payment gateway unavailable',
): PaymentGatewayUnavailableError {
  const context = createMockPaymentGatewayUnavailableErrorContext(contextOverrides);
  return createPaymentGatewayUnavailableError(message, context);
}

// ==================== TESTS ====================

describe('PaymentGatewayUnavailableError', () => {
  describe('Constants and Types', () => {
    describe('PaymentProviderId', () => {
      it('should be branded string type', () => {
        const provider: PaymentProviderId = 'webpay' as PaymentProviderId;
        expect(typeof provider).toBe('string');
        expect(provider).toBe('webpay');
      });
    });

    describe('GatewayUnavailableReason', () => {
      it('should include all expected reasons', () => {
        const reasons: GatewayUnavailableReason[] = [
          'timeout',
          'network_error',
          'rate_limit',
          'maintenance',
          'degraded',
          'upstream_dependency',
          'unknown',
        ];

        reasons.forEach((reason) => {
          expect([
            'timeout',
            'network_error',
            'rate_limit',
            'maintenance',
            'degraded',
            'upstream_dependency',
            'unknown',
          ]).toContain(reason);
        });
      });
    });
  });

  describe('createPaymentGatewayUnavailableError', () => {
    it('should create error with all required fields', () => {
      const context = createMockPaymentGatewayUnavailableErrorContext();
      const error = createPaymentGatewayUnavailableError('Test error', context);

      expect(error._tag).toBe('PaymentGatewayUnavailableError');
      expect(error.category).toBe('SYSTEM');
      expect(error.origin).toBe('INFRASTRUCTURE');
      expect(error.severity).toBe('critical');
      expect(error.code).toBe('SERVICE_BILLING_108');
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual(context);
      expect(error.timestamp).toBeDefined();
      expect(error.code).toBe('SERVICE_BILLING_108');
    });

    it('should create error with custom timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const context = createMockPaymentGatewayUnavailableErrorContext();
      const error = createPaymentGatewayUnavailableError('Test', context, customTimestamp);

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('should create error with minimal context', () => {
      const minimalContext: PaymentGatewayUnavailableErrorContext = {
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
      };
      const error = createPaymentGatewayUnavailableError('Minimal test', minimalContext);

      expect(error.details?.provider).toBe('webpay');
      expect(error.details?.reason).toBe('timeout');
      expect(error.details?.retryAfterMs).toBeUndefined();
      expect(error.details?.suggestedAlternatives).toBeUndefined();
    });
  });

  describe('isValidPaymentGatewayUnavailableErrorContext', () => {
    it('should return true for valid context', () => {
      const context = createMockPaymentGatewayUnavailableErrorContext();
      expect(isValidPaymentGatewayUnavailableErrorContext(context)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext(null)).toBe(false);
      expect(isValidPaymentGatewayUnavailableErrorContext(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext('string')).toBe(false);
      expect(isValidPaymentGatewayUnavailableErrorContext(123)).toBe(false);
      expect(isValidPaymentGatewayUnavailableErrorContext([])).toBe(false);
    });

    it('should return false for nested errors (containing _tag)', () => {
      const nestedError = {
        _tag: 'SomeOtherError',
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
      };
      expect(isValidPaymentGatewayUnavailableErrorContext(nestedError)).toBe(false);
    });

    it('should validate provider field', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
      })).toBe(true);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: '' as PaymentProviderId, // empty string
        reason: 'timeout',
      })).toBe(false);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'a'.repeat(100) as PaymentProviderId, // too long
        reason: 'timeout',
      })).toBe(false);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 123 as any, // wrong type
        reason: 'timeout',
      })).toBe(false);
    });

    it('should validate reason field', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
      })).toBe(true);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'invalid_reason' as any,
      })).toBe(false);
    });

    it('should validate optional numeric fields', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        retryAfterMs: 5000,
        estimatedRecoveryTimeMin: 10,
      })).toBe(true);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        retryAfterMs: -1, // negative
      })).toBe(false);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        retryAfterMs: 1.5, // not integer
      })).toBe(false);
    });

    it('should validate suggestedAlternatives array', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        suggestedAlternatives: ['bepaid' as PaymentProviderId],
      })).toBe(true);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        suggestedAlternatives: 'not_array' as any,
      })).toBe(false);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        suggestedAlternatives: [123 as any], // invalid provider
      })).toBe(false);
    });

    it('should validate string fields', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        sourceErrorTag: 'WebPayAPIError',
      })).toBe(true);

      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        sourceErrorTag: 123 as any, // wrong type
      })).toBe(false);
    });

    it('should allow any debugInfo object', () => {
      expect(isValidPaymentGatewayUnavailableErrorContext({
        provider: 'webpay' as PaymentProviderId,
        reason: 'timeout',
        debugInfo: { any: 'object', works: true },
      })).toBe(true);
    });
  });

  describe('isPaymentGatewayUnavailableError', () => {
    it('should return true for valid PaymentGatewayUnavailableError', () => {
      const error = createMockPaymentGatewayUnavailableError();
      expect(isPaymentGatewayUnavailableError(error)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isPaymentGatewayUnavailableError(null)).toBe(false);
      expect(isPaymentGatewayUnavailableError({})).toBe(false);
      expect(isPaymentGatewayUnavailableError({ _tag: 'PaymentGatewayUnavailableError' })).toBe(
        false,
      );
      expect(isPaymentGatewayUnavailableError({ code: 'SERVICE_BILLING_GATEWAY_UNAVAILABLE' }))
        .toBe(false);
    });

    it('should return false for wrong tag', () => {
      const invalidError = { ...createMockPaymentGatewayUnavailableError(), _tag: 'WrongTag' };
      expect(isPaymentGatewayUnavailableError(invalidError)).toBe(false);
    });

    it('should return false for wrong code', () => {
      const invalidError = { ...createMockPaymentGatewayUnavailableError(), code: 'WRONG_CODE' };
      expect(isPaymentGatewayUnavailableError(invalidError)).toBe(false);
    });

    it('should return false for invalid context', () => {
      const invalidError = {
        ...createMockPaymentGatewayUnavailableError(),
        details: { provider: 123 }, // invalid provider
      };
      expect(isPaymentGatewayUnavailableError(invalidError)).toBe(false);
    });

    it('should validate with nested error protection', () => {
      const invalidError = {
        ...createMockPaymentGatewayUnavailableError(),
        details: {
          _tag: 'NestedError', // should be rejected
          provider: 'webpay' as PaymentProviderId,
          reason: 'timeout',
        },
      };
      expect(isPaymentGatewayUnavailableError(invalidError)).toBe(false);
    });
  });

  describe('Getter functions', () => {
    describe('getUnavailableProvider', () => {
      it('should return provider when present', () => {
        const error = createMockPaymentGatewayUnavailableError({
          provider: 'bepaid' as PaymentProviderId,
        });
        expect(getUnavailableProvider(error)).toBe('bepaid');
      });

      it('should return undefined when details missing', () => {
        const error = { ...createMockPaymentGatewayUnavailableError(), details: undefined };
        expect(getUnavailableProvider(error)).toBeUndefined();
      });
    });

    describe('getUnavailableReason', () => {
      it('should return reason when present', () => {
        const error = createMockPaymentGatewayUnavailableError({ reason: 'network_error' });
        expect(getUnavailableReason(error)).toBe('network_error');
      });

      it('should return undefined when details missing', () => {
        const error = { ...createMockPaymentGatewayUnavailableError(), details: undefined };
        expect(getUnavailableReason(error)).toBeUndefined();
      });
    });

    describe('getRetryAfterMs', () => {
      it('should return retryAfterMs when present', () => {
        const error = createMockPaymentGatewayUnavailableError({ retryAfterMs: 10000 });
        expect(getRetryAfterMs(error)).toBe(10000);
      });

      it('should return undefined when not present', () => {
        const error = createMockPaymentGatewayUnavailableError({ retryAfterMs: undefined });
        expect(getRetryAfterMs(error)).toBeUndefined();
      });
    });

    describe('getEstimatedRecoveryTimeMin', () => {
      it('should return estimatedRecoveryTimeMin when present', () => {
        const error = createMockPaymentGatewayUnavailableError({ estimatedRecoveryTimeMin: 30 });
        expect(getEstimatedRecoveryTimeMin(error)).toBe(30);
      });

      it('should return undefined when not present', () => {
        const error = createMockPaymentGatewayUnavailableError({
          estimatedRecoveryTimeMin: undefined,
        });
        expect(getEstimatedRecoveryTimeMin(error)).toBeUndefined();
      });
    });

    describe('getSuggestedAlternatives', () => {
      it('should return suggestedAlternatives when present', () => {
        const alternatives = ['bepaid', 'oplati'] as PaymentProviderId[];
        const error = createMockPaymentGatewayUnavailableError({
          suggestedAlternatives: alternatives,
        });
        expect(getSuggestedAlternatives(error)).toEqual(alternatives);
      });

      it('should return undefined when not present', () => {
        const error = createMockPaymentGatewayUnavailableError({
          suggestedAlternatives: undefined,
        });
        expect(getSuggestedAlternatives(error)).toBeUndefined();
      });
    });

    describe('hasSuggestedAlternatives', () => {
      it('should return true when alternatives present and non-empty', () => {
        const error = createMockPaymentGatewayUnavailableError({
          suggestedAlternatives: ['bepaid' as PaymentProviderId],
        });
        expect(hasSuggestedAlternatives(error)).toBe(true);
      });

      it('should return false when alternatives empty', () => {
        const error = createMockPaymentGatewayUnavailableError({ suggestedAlternatives: [] });
        expect(hasSuggestedAlternatives(error)).toBe(false);
      });

      it('should return false when alternatives undefined', () => {
        const error = createMockPaymentGatewayUnavailableError({
          suggestedAlternatives: undefined,
        });
        expect(hasSuggestedAlternatives(error)).toBe(false);
      });
    });
  });

  describe('Helper functions', () => {
    describe('isGatewayUnavailableRetryable', () => {
      it('should return true for temporary/retryable reasons', () => {
        const retryableReasons: GatewayUnavailableReason[] = [
          'timeout',
          'network_error',
          'rate_limit',
          'degraded',
          'upstream_dependency',
        ];

        retryableReasons.forEach((reason) => {
          const error = createMockPaymentGatewayUnavailableError({ reason });
          expect(isGatewayUnavailableRetryable(error)).toBe(true);
        });
      });

      it('should return false for permanent reasons', () => {
        const nonRetryableReasons: GatewayUnavailableReason[] = ['maintenance', 'unknown'];

        nonRetryableReasons.forEach((reason) => {
          const error = createMockPaymentGatewayUnavailableError({ reason });
          expect(isGatewayUnavailableRetryable(error)).toBe(false);
        });
      });

      it('should return false when reason is undefined', () => {
        const error = createMockPaymentGatewayUnavailableError({ reason: undefined as any });
        expect(isGatewayUnavailableRetryable(error)).toBe(false);
      });

      it('should return false when details missing', () => {
        const error = { ...createMockPaymentGatewayUnavailableError(), details: undefined };
        expect(isGatewayUnavailableRetryable(error)).toBe(false);
      });
    });

    describe('shouldConsiderAlternatives', () => {
      it('should return true for critical problems with alternatives', () => {
        const criticalReasons: GatewayUnavailableReason[] = [
          'maintenance',
          'upstream_dependency',
          'unknown',
        ];

        criticalReasons.forEach((reason) => {
          const error = createMockPaymentGatewayUnavailableError({
            reason,
            suggestedAlternatives: ['bepaid' as PaymentProviderId],
          });
          expect(shouldConsiderAlternatives(error)).toBe(true);
        });
      });

      it('should return false for temporary problems', () => {
        const temporaryReasons: GatewayUnavailableReason[] = [
          'timeout',
          'network_error',
          'rate_limit',
          'degraded',
        ];

        temporaryReasons.forEach((reason) => {
          const error = createMockPaymentGatewayUnavailableError({
            reason,
            suggestedAlternatives: ['bepaid' as PaymentProviderId],
          });
          expect(shouldConsiderAlternatives(error)).toBe(false);
        });
      });

      it('should return false when no alternatives available', () => {
        const error = createMockPaymentGatewayUnavailableError({
          reason: 'maintenance',
          suggestedAlternatives: undefined,
        });
        expect(shouldConsiderAlternatives(error)).toBe(false);
      });

      it('should return false when alternatives empty', () => {
        const error = createMockPaymentGatewayUnavailableError({
          reason: 'maintenance',
          suggestedAlternatives: [],
        });
        expect(shouldConsiderAlternatives(error)).toBe(false);
      });

      it('should return false when reason is undefined', () => {
        const error = createMockPaymentGatewayUnavailableError({
          reason: undefined as any,
          suggestedAlternatives: ['bepaid' as PaymentProviderId],
        });
        expect(shouldConsiderAlternatives(error)).toBe(false);
      });
    });
  });

  describe('createFromProviderAPIError', () => {
    describe('typed error overload', () => {
      it('should create error from typed provider error', () => {
        const providerError = { _tag: 'WebPayAPIError', message: 'Connection failed' };
        const error = createFromProviderAPIError(
          providerError,
          'webpay' as PaymentProviderId,
          'timeout',
        );

        expect(error.details?.provider).toBe('webpay');
        expect(error.details?.reason).toBe('timeout');
        expect(error.details?.sourceErrorTag).toBe('WebPayAPIError');
        expect(error.message).toBe('Payment gateway webpay is unavailable: timeout');
      });

      it('should use default reason when not provided', () => {
        const providerError = { _tag: 'BePaidAPIError' };
        const error = createFromProviderAPIError(providerError, 'bepaid' as PaymentProviderId);

        expect(error.details?.reason).toBe('unknown');
      });

      it('should merge additional context', () => {
        const providerError = { _tag: 'WebPayAPIError' };
        const additionalContext = {
          retryAfterMs: 30000,
          debugInfo: { traceId: 'abc-123' },
        };

        const error = createFromProviderAPIError(
          providerError,
          'webpay' as PaymentProviderId,
          'rate_limit',
          additionalContext,
        );

        expect(error.details?.retryAfterMs).toBe(30000);
        expect(error.details?.debugInfo).toEqual({ traceId: 'abc-123' });
      });
    });

    describe('unknown error overload', () => {
      it('should safely extract _tag from valid error object', () => {
        const providerError = { _tag: 'CustomAPIError', details: 'some info' };
        const error = createFromProviderAPIError(
          providerError,
          'webpay' as PaymentProviderId,
          'network_error',
        );

        expect(error.details?.sourceErrorTag).toBe('CustomAPIError');
      });

      it('should use UnknownProviderError when _tag missing', () => {
        const providerError = { message: 'Generic error', code: 500 }; // no _tag
        const error = createFromProviderAPIError(
          providerError,
          'webpay' as PaymentProviderId,
          'timeout',
        );

        expect(error.details?.sourceErrorTag).toBe('UnknownProviderError');
      });

      it('should use UnknownProviderError for non-object errors', () => {
        const providerError = 'String error'; // not an object
        const error = createFromProviderAPIError(
          providerError,
          'webpay' as PaymentProviderId,
          'timeout',
        );

        expect(error.details?.sourceErrorTag).toBe('UnknownProviderError');
      });

      it('should use UnknownProviderError for null/undefined', () => {
        const error1 = createFromProviderAPIError(null, 'webpay' as PaymentProviderId, 'timeout');
        const error2 = createFromProviderAPIError(
          undefined,
          'webpay' as PaymentProviderId,
          'timeout',
        );

        expect(error1.details?.sourceErrorTag).toBe('UnknownProviderError');
        expect(error2.details?.sourceErrorTag).toBe('UnknownProviderError');
      });

      it('should handle errors with non-string _tag', () => {
        const providerError = { _tag: 123, other: 'data' }; // _tag not string
        const error = createFromProviderAPIError(
          providerError,
          'webpay' as PaymentProviderId,
          'timeout',
        );

        expect(error.details?.sourceErrorTag).toBe('UnknownProviderError');
      });

      it('should work with all error types', () => {
        // Test with different error types
        const testCases = [
          { _tag: 'WebPayAPIError', expected: 'WebPayAPIError' },
          { _tag: 'BePaidAPIError', expected: 'BePaidAPIError' },
          { message: 'plain error', expected: 'UnknownProviderError' },
          { _tag: null, expected: 'UnknownProviderError' },
          42,
          'string error',
          null,
          undefined,
        ];

        testCases.forEach((providerError, index) => {
          const error = createFromProviderAPIError(
            providerError as any,
            'webpay' as PaymentProviderId,
            'timeout',
          );

          const expectedTag = typeof providerError === 'object'
              && providerError !== null
              && '_tag' in providerError
              && typeof providerError._tag === 'string'
            ? providerError._tag
            : 'UnknownProviderError';

          expect(error.details?.sourceErrorTag).toBe(expectedTag);
        });
      });
    });
  });

  describe('Integration tests', () => {
    it('should create and validate complete error flow', () => {
      // Create error from provider error
      const providerError = { _tag: 'WebPayAPIError', transactionId: 'wp_123' };
      const error = createFromProviderAPIError(
        providerError,
        'webpay' as PaymentProviderId,
        'timeout',
        {
          retryAfterMs: 15000,
          suggestedAlternatives: ['bepaid' as PaymentProviderId],
          debugInfo: { correlationId: 'test-flow' },
        },
      );

      // Verify error structure
      expect(isPaymentGatewayUnavailableError(error)).toBe(true);
      expect(isValidPaymentGatewayUnavailableErrorContext(error.details)).toBe(true);

      // Verify getters
      expect(getUnavailableProvider(error)).toBe('webpay');
      expect(getUnavailableReason(error)).toBe('timeout');
      expect(getRetryAfterMs(error)).toBe(15000);
      expect(getSuggestedAlternatives(error)).toEqual(['bepaid']);
      expect(error.details?.sourceErrorTag).toBe('WebPayAPIError');

      // Verify policy helpers
      expect(isGatewayUnavailableRetryable(error)).toBe(true); // timeout is retryable
      expect(shouldConsiderAlternatives(error)).toBe(false); // timeout is temporary
    });

    it('should handle maintenance scenario with failover', () => {
      const providerError = { _tag: 'BePaidAPIError' };
      const error = createFromProviderAPIError(
        providerError,
        'bepaid' as PaymentProviderId,
        'maintenance',
        {
          estimatedRecoveryTimeMin: 60,
          suggestedAlternatives: ['webpay', 'oplati'] as PaymentProviderId[],
        },
      );

      expect(getUnavailableProvider(error)).toBe('bepaid');
      expect(getUnavailableReason(error)).toBe('maintenance');
      expect(getEstimatedRecoveryTimeMin(error)).toBe(60);
      expect(getSuggestedAlternatives(error)).toEqual(['webpay', 'oplati']);

      expect(isGatewayUnavailableRetryable(error)).toBe(false); // maintenance not retryable
      expect(shouldConsiderAlternatives(error)).toBe(true); // maintenance with alternatives
      expect(hasSuggestedAlternatives(error)).toBe(true);
    });

    it('should handle unknown errors gracefully', () => {
      const error = createFromProviderAPIError(
        'Plain string error',
        'unknown_provider' as PaymentProviderId,
        'unknown',
      );

      expect(error.details?.sourceErrorTag).toBe('UnknownProviderError');
      expect(error.details?.provider).toBe('unknown_provider');
      expect(error.details?.reason).toBe('unknown');

      expect(isGatewayUnavailableRetryable(error)).toBe(false); // unknown not retryable
      expect(shouldConsiderAlternatives(error)).toBe(false); // no alternatives
    });

    it('should support all provider types', () => {
      const providers = [
        'webpay',
        'bepaid',
        'oplati',
        'bank_transfer',
        'card_gateway',
      ] as PaymentProviderId[];

      providers.forEach((provider) => {
        const error = createPaymentGatewayUnavailableError(
          `Gateway ${provider} unavailable`,
          { provider, reason: 'network_error' },
        );

        expect(getUnavailableProvider(error)).toBe(provider);
        expect(isPaymentGatewayUnavailableError(error)).toBe(true);
      });
    });

    it('should support all reason types', () => {
      const reasons: GatewayUnavailableReason[] = [
        'timeout',
        'network_error',
        'rate_limit',
        'maintenance',
        'degraded',
        'upstream_dependency',
        'unknown',
      ];

      reasons.forEach((reason) => {
        const error = createPaymentGatewayUnavailableError(
          `Gateway unavailable: ${reason}`,
          { provider: 'webpay' as PaymentProviderId, reason },
        );

        expect(getUnavailableReason(error)).toBe(reason);
        expect(isValidPaymentGatewayUnavailableErrorContext(error.details)).toBe(true);
      });
    });
  });
});
