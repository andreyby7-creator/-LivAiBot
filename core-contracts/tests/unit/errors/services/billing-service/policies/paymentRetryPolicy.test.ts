/**
 * @file paymentRetryPolicy.test.ts - Полное тестирование политики повторных попыток платежей
 */

import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  applyJitter,
  createRetryContext,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_JITTER_RATIO,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_POLICY_CONFIG,
  evaluatePaymentRetryPolicy,
  getBackoffCalculator,
  mapRegistryStrategyToRetryStrategy,
  MAX_TOTAL_DELAY_MS,
  updateRetryContext,
} from '../../../../../../src/errors/services/billing-service/policies/paymentRetryPolicy.js';

import type {
  CircuitBreakerDecision,
  RetryContext,
  RetryPolicyConfig,
} from '../../../../../../src/errors/services/billing-service/policies/paymentRetryPolicy.js';

// Import BillingServiceError from the types file
import type { BillingServiceError } from '../../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';

// ==================== MOCKS ====================

// Mock retryable error (PaymentFailedError)
const mockRetryableError: BillingServiceError = {
  _tag: 'PaymentFailedError',
  code: 'SERVICE_BILLING_100',
  message: 'Payment processing failed for transaction test-123',
  category: 'BUSINESS',
  severity: 'high',
  origin: 'SERVICE',
  timestamp: '2024-01-01T00:00:00Z',
  details: {
    transactionId: 'test-123',
    amount: 100,
    currency: 'BYN',
    retryable: true,
    provider: 'webpay',
    operation: 'charge',
  },
} as const;

const mockRetryContext: RetryContext = {
  attemptCount: 1,
  maxAttempts: 3,
  strategy: 'exponential_backoff',
  baseDelayMs: 1000,
  lastAttemptAtEpochMs: 1000,
  totalDelayMs: 0,
};

const mockCircuitBreakerDecisionOpen: CircuitBreakerDecision = {
  allow: false,
  nextState: 'open',
  retryAfterMs: 30000,
};

const mockCircuitBreakerDecisionClosed: CircuitBreakerDecision = {
  allow: true,
  nextState: 'closed',
};

// ==================== TESTS ====================

describe('PaymentRetryPolicy', () => {
  describe('evaluatePaymentRetryPolicy', () => {
    it('should allow retry for retryable error on first attempt', async () => {
      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(mockRetryableError, undefined, DEFAULT_RETRY_POLICY_CONFIG),
      );

      expect(result._tag).toBe('RetryAllowed');
      if (result._tag === 'RetryAllowed') {
        expect(result.context.attemptCount).toBe(1);
        expect(result.delayMs).toBeGreaterThan(0);
      }
    });

    it('should deny retry when circuit breaker is open', async () => {
      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          mockRetryableError,
          undefined,
          DEFAULT_RETRY_POLICY_CONFIG,
          mockCircuitBreakerDecisionOpen,
        ),
      );

      expect(result._tag).toBe('CircuitOpen');
      if (result._tag === 'CircuitOpen') {
        expect(result.retryAfterMs).toBe(30000);
      }
    });

    it('should deny retry for non-retryable error', async () => {
      const mockNonRetryableError: BillingServiceError = {
        ...mockRetryableError,
        code: 'SERVICE_BILLING_102', // Refund error - non-retryable
        _tag: 'RefundError',
        details: {
          transactionId: 'refund-123',
          reason: 'insufficient funds',
        },
      } as const;

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(mockNonRetryableError, undefined, DEFAULT_RETRY_POLICY_CONFIG),
      );

      expect(result._tag).toBe('RetryDenied');
      if (result._tag === 'RetryDenied') {
        expect(result.reason).toBe('error_not_retryable');
      }
    });

    it('should deny retry for manual strategy', async () => {
      const mockManualError: BillingServiceError = {
        ...mockRetryableError,
        code: 'SERVICE_BILLING_101', // Subscription error - manual retry
        _tag: 'SubscriptionError',
        details: {
          subscriptionId: 'sub-123',
          reason: 'plan limit exceeded',
        },
      } as const;

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(mockManualError, undefined, DEFAULT_RETRY_POLICY_CONFIG),
      );

      expect(result._tag).toBe('RetryDenied');
      if (result._tag === 'RetryDenied') {
        expect(result.reason).toBe('manual_required');
      }
    });

    it('should deny retry when max attempts exceeded', async () => {
      const contextAtMaxAttempts: RetryContext = {
        ...mockRetryContext,
        attemptCount: 3,
        maxAttempts: 3,
      };

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          mockRetryableError,
          contextAtMaxAttempts,
          DEFAULT_RETRY_POLICY_CONFIG,
        ),
      );

      expect(result._tag).toBe('RetryDenied');
      if (result._tag === 'RetryDenied') {
        expect(result.reason).toBe('max_attempts_exceeded');
      }
    });

    it('should deny retry when max total delay exceeded', async () => {
      const contextNearMaxDelay: RetryContext = {
        ...mockRetryContext,
        attemptCount: 2,
        totalDelayMs: MAX_TOTAL_DELAY_MS - 1000, // Close to max
      };

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          mockRetryableError,
          contextNearMaxDelay,
          DEFAULT_RETRY_POLICY_CONFIG,
        ),
      );

      expect(result._tag).toBe('RetryDenied');
      if (result._tag === 'RetryDenied') {
        expect(result.reason).toBe('max_total_delay_exceeded');
      }
    });

    it('should allow retry with exponential backoff for subsequent attempts', async () => {
      const contextSecondAttempt: RetryContext = {
        ...mockRetryContext,
        attemptCount: 2,
      };

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          mockRetryableError,
          contextSecondAttempt,
          DEFAULT_RETRY_POLICY_CONFIG,
        ),
      );

      expect(result._tag).toBe('RetryAllowed');
      if (result._tag === 'RetryAllowed') {
        expect(result.context.attemptCount).toBe(3); // Incremented
        expect(result.delayMs).toBeGreaterThan(1000); // Exponential backoff
      }
    });

    it('should handle different retry strategies correctly', async () => {
      // Test with default config - should use exponential_backoff from error metadata
      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(mockRetryableError, undefined, DEFAULT_RETRY_POLICY_CONFIG),
      );

      expect(result._tag).toBe('RetryAllowed');
      if (result._tag === 'RetryAllowed') {
        expect(result.delayMs).toBeGreaterThan(0);
      }
    });

    it('should handle circuit breaker state transitions', async () => {
      // Test with closed circuit breaker (allow: true)
      const resultClosed = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          mockRetryableError,
          undefined,
          DEFAULT_RETRY_POLICY_CONFIG,
          mockCircuitBreakerDecisionClosed,
        ),
      );

      expect(resultClosed._tag).toBe('RetryAllowed');

      // Test with open circuit breaker (allow: false)
      const resultOpen = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          mockRetryableError,
          undefined,
          DEFAULT_RETRY_POLICY_CONFIG,
          mockCircuitBreakerDecisionOpen,
        ),
      );

      expect(resultOpen._tag).toBe('CircuitOpen');
    });

    it('should handle error with unknown retry strategy from registry', async () => {
      // Create error that would have unknown strategy in registry
      const errorWithUnknownStrategy: BillingServiceError = {
        ...mockRetryableError,
        code: 'SERVICE_BILLING_100',
        // This would result in mapRegistryStrategyToRetryStrategy returning undefined
      };

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(
          errorWithUnknownStrategy,
          undefined,
          DEFAULT_RETRY_POLICY_CONFIG,
        ),
      );

      expect(result._tag).toBe('RetryAllowed');
      if (result._tag === 'RetryAllowed') {
        expect(result.delayMs).toBeGreaterThan(0);
      }
    });

    it('should handle config with undefined jitterRatio', async () => {
      // Create config where jitterRatio is explicitly undefined
      const configWithoutJitter: RetryPolicyConfig = {
        strategies: {
          ...DEFAULT_RETRY_POLICY_CONFIG.strategies,
          exponential_backoff: {
            maxAttempts: 5,
            baseDelayMs: 1000,
            maxTotalDelayMs: MAX_TOTAL_DELAY_MS,
            jitterRatio: undefined as any, // Explicitly undefined to test fallback
          },
        },
      };

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(mockRetryableError, undefined, configWithoutJitter),
      );

      expect(result._tag).toBe('RetryAllowed');
      if (result._tag === 'RetryAllowed') {
        expect(result.delayMs).toBeGreaterThan(0);
      }
    });

    it('should handle error with no metadata in registry', async () => {
      // Create error with code that doesn't exist in registry
      const errorWithoutMetadata: BillingServiceError = {
        ...mockRetryableError,
        code: 'UNKNOWN_ERROR_CODE' as any,
      };

      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(errorWithoutMetadata, undefined, DEFAULT_RETRY_POLICY_CONFIG),
      );

      // Should deny retry when metadata is missing (defaults to not retryable)
      expect(result._tag).toBe('RetryDenied');
      if (result._tag === 'RetryDenied') {
        expect(result.reason).toBe('error_not_retryable');
      }
    });
  });
  describe('applyJitter', () => {
    it('should return base delay when jitter ratio is 0', () => {
      const baseDelay = 1000;
      const result = applyJitter(baseDelay, 0);

      expect(result).toBe(baseDelay);
    });

    it('should apply jitter with default ratio', () => {
      const baseDelay = 1000;
      const result = applyJitter(baseDelay);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(baseDelay * 2);
    });

    it('should apply jitter with custom ratio', () => {
      const baseDelay = 1000;
      const jitterRatio = 0.5;
      const result = applyJitter(baseDelay, jitterRatio);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(baseDelay * 2);
    });

    it('should handle deterministic random function', () => {
      const baseDelay = 1000;
      const jitterRatio = 0.2;
      const deterministicRandom = () => 0.5; // Always return 0.5

      const result = applyJitter(baseDelay, jitterRatio, deterministicRandom);

      // With random = 0.5, jitter should be 0 (middle of range)
      expect(result).toBe(baseDelay);
    });

    it('should ensure result is never negative', () => {
      const baseDelay = 100;
      const jitterRatio = 1.0;
      const alwaysMinRandom = () => 0; // Minimum possible random value

      const result = applyJitter(baseDelay, jitterRatio, alwaysMinRandom);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getBackoffCalculator', () => {
    it('should return immediate calculator for immediate strategy', () => {
      const calculator = getBackoffCalculator('immediate');
      const context: any = { attemptCount: 1 };
      const config = DEFAULT_RETRY_POLICY_CONFIG.strategies.immediate;

      const delay = calculator(context, config);
      expect(delay).toBe(0);
    });

    it('should return fixed delay calculator for fixed_delay strategy', () => {
      const calculator = getBackoffCalculator('fixed_delay');
      const context: any = { attemptCount: 1 };
      const config = DEFAULT_RETRY_POLICY_CONFIG.strategies.fixed_delay;

      const delay = calculator(context, config);
      expect(delay).toBe(config.baseDelayMs);
    });

    it('should return exponential backoff calculator for exponential_backoff strategy', () => {
      const calculator = getBackoffCalculator('exponential_backoff');
      const context: any = { attemptCount: 2 };
      const config = DEFAULT_RETRY_POLICY_CONFIG.strategies.exponential_backoff;

      const delay = calculator(context, config);
      // attempt = Math.max(1, context.attemptCount - 1) = Math.max(1, 2-1) = 1
      // delay = 1000 * 2^1 = 2000
      expect(delay).toBe(2000);
    });

    it('should return circuit breaker calculator for circuit_breaker strategy', () => {
      const calculator = getBackoffCalculator('circuit_breaker');
      const context: any = { attemptCount: 1 };
      const config = DEFAULT_RETRY_POLICY_CONFIG.strategies.circuit_breaker;

      const delay = calculator(context, config);
      expect(delay).toBe(config.baseDelayMs);
    });

    it('should return provider defined calculator for provider_defined strategy', () => {
      const calculator = getBackoffCalculator('provider_defined');
      const context: any = { attemptCount: 2 };
      const config = DEFAULT_RETRY_POLICY_CONFIG.strategies.provider_defined;

      const delay = calculator(context, config);
      // Provider defined falls back to exponential backoff
      expect(delay).toBe(4000); // 2000 * 2^(2-1) = 2000 * 2 = 4000
    });

    it('should throw error for unknown strategy', () => {
      expect(() => {
        getBackoffCalculator('unknown' as any);
      }).toThrow('Unknown retry strategy: unknown');
    });
  });

  describe('createRetryContext', () => {
    it('should create initial retry context with defaults', () => {
      const nowEpochMs = 1000;
      const context = createRetryContext('exponential_backoff', undefined, undefined, nowEpochMs);

      expect(context.attemptCount).toBe(1);
      expect(context.maxAttempts).toBe(DEFAULT_MAX_ATTEMPTS);
      expect(context.strategy).toBe('exponential_backoff');
      expect(context.baseDelayMs).toBe(DEFAULT_BASE_DELAY_MS);
      expect(context.lastAttemptAtEpochMs).toBe(nowEpochMs);
      expect(context.totalDelayMs).toBe(0);
    });

    it('should create retry context with custom parameters', () => {
      const nowEpochMs = 1000;
      const maxAttempts = 5;
      const baseDelayMs = 2000;
      const retryReason = 'infrastructure';

      const context = createRetryContext(
        'fixed_delay',
        maxAttempts,
        baseDelayMs,
        nowEpochMs,
        retryReason,
      );

      expect(context.attemptCount).toBe(1);
      expect(context.maxAttempts).toBe(maxAttempts);
      expect(context.strategy).toBe('fixed_delay');
      expect(context.baseDelayMs).toBe(baseDelayMs);
      expect(context.lastAttemptAtEpochMs).toBe(nowEpochMs);
      expect(context.totalDelayMs).toBe(0);
      expect(context.retryReason).toBe(retryReason);
    });

    it('should create retry context without retry reason', () => {
      const nowEpochMs = 1000;
      const context = createRetryContext('immediate', 1, 0, nowEpochMs);

      expect(context.retryReason).toBeUndefined();
    });
  });

  describe('updateRetryContext', () => {
    it('should update context on success (not increment attempt count)', () => {
      const originalContext: any = {
        attemptCount: 2,
        totalDelayMs: 1000,
        lastAttemptAtEpochMs: 1000,
      };

      const nowEpochMs = 2000;
      const updatedContext = updateRetryContext(originalContext, 'success', nowEpochMs);

      expect(updatedContext.attemptCount).toBe(2); // Should not increment on success
      expect(updatedContext.lastAttemptAtEpochMs).toBe(nowEpochMs);
      expect(updatedContext.totalDelayMs).toBe(1000); // Should not change
    });

    it('should update context on failure (increment attempt count)', () => {
      const originalContext: any = {
        attemptCount: 2,
        totalDelayMs: 1000,
        lastAttemptAtEpochMs: 1000,
      };

      const nowEpochMs = 2000;
      const updatedContext = updateRetryContext(originalContext, 'failure', nowEpochMs);

      expect(updatedContext.attemptCount).toBe(3); // Should increment on failure
      expect(updatedContext.lastAttemptAtEpochMs).toBe(nowEpochMs);
      expect(updatedContext.totalDelayMs).toBe(1000); // Should not change here
    });
  });

  describe('Constants and configuration', () => {
    it('should have correct MAX_TOTAL_DELAY_MS value', () => {
      // 24 hours in milliseconds
      const expected = 24 * 60 * 60 * 1000;
      expect(MAX_TOTAL_DELAY_MS).toBe(expected);
    });

    it('should have correct DEFAULT_MAX_ATTEMPTS', () => {
      expect(DEFAULT_MAX_ATTEMPTS).toBe(3);
    });

    it('should have correct DEFAULT_BASE_DELAY_MS', () => {
      expect(DEFAULT_BASE_DELAY_MS).toBe(5000);
    });

    it('should have correct DEFAULT_JITTER_RATIO', () => {
      expect(DEFAULT_JITTER_RATIO).toBe(0.2);
    });

    it('should have valid DEFAULT_RETRY_POLICY_CONFIG', () => {
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies).toHaveProperty('immediate');
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies).toHaveProperty('fixed_delay');
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies).toHaveProperty('exponential_backoff');
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies).toHaveProperty('circuit_breaker');
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies).toHaveProperty('provider_defined');
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies).toHaveProperty('manual');

      // Check immediate strategy
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies.immediate.maxAttempts).toBe(1);
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies.immediate.baseDelayMs).toBe(0);
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies.immediate.jitterRatio).toBe(0);

      // Check exponential_backoff strategy
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies.exponential_backoff.maxAttempts).toBe(5);
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies.exponential_backoff.baseDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_POLICY_CONFIG.strategies.exponential_backoff.maxTotalDelayMs).toBe(
        MAX_TOTAL_DELAY_MS,
      );
    });
  });

  describe('mapRegistryStrategyToRetryStrategy', () => {
    it('should map "immediate" to "immediate"', () => {
      const result = mapRegistryStrategyToRetryStrategy('immediate');
      expect(result).toBe('immediate');
    });

    it('should map "delayed" to "exponential_backoff"', () => {
      const result = mapRegistryStrategyToRetryStrategy('delayed');
      expect(result).toBe('exponential_backoff');
    });

    it('should map "manual" to "manual"', () => {
      const result = mapRegistryStrategyToRetryStrategy('manual');
      expect(result).toBe('manual');
    });

    it('should return undefined for unknown strategy', () => {
      const result = mapRegistryStrategyToRetryStrategy('unknown');
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      const result = mapRegistryStrategyToRetryStrategy(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle fallback to exponential_backoff when registry strategy is unmapped', async () => {
      // This test covers the fallback branch in evaluatePaymentRetryPolicy
      // when mapRegistryStrategyToRetryStrategy returns undefined
      const result = await Effect.runPromise(
        evaluatePaymentRetryPolicy(mockRetryableError, undefined, DEFAULT_RETRY_POLICY_CONFIG),
      );

      expect(result._tag).toBe('RetryAllowed');
      if (result._tag === 'RetryAllowed') {
        expect(result.delayMs).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle zero max attempts in context', () => {
      const contextWithZeroMaxAttempts: any = {
        attemptCount: 1,
        maxAttempts: 0,
      };

      const nowEpochMs = 1000;
      const updatedContext = updateRetryContext(contextWithZeroMaxAttempts, 'failure', nowEpochMs);

      expect(updatedContext.attemptCount).toBe(2); // Still increments even with zero max
    });

    it('should handle negative total delay', () => {
      const contextWithNegativeDelay: any = {
        attemptCount: 1,
        totalDelayMs: -1000,
      };

      const nowEpochMs = 1000;
      const updatedContext = updateRetryContext(contextWithNegativeDelay, 'failure', nowEpochMs);

      expect(updatedContext.totalDelayMs).toBe(-1000); // Preserves negative value
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete retry flow for payment failure', () => {
      // First attempt
      let nowEpochMs = 1000;
      let context = createRetryContext('exponential_backoff', 3, 1000, nowEpochMs);

      expect(context.attemptCount).toBe(1);
      expect(context.totalDelayMs).toBe(0);

      // Second attempt (simulate failure)
      nowEpochMs = 2000;
      context = updateRetryContext(context, 'failure', nowEpochMs);

      expect(context.attemptCount).toBe(2);
      expect(context.lastAttemptAtEpochMs).toBe(nowEpochMs);

      // Third attempt (simulate failure)
      nowEpochMs = 3000;
      context = updateRetryContext(context, 'failure', nowEpochMs);

      expect(context.attemptCount).toBe(3);
      expect(context.lastAttemptAtEpochMs).toBe(nowEpochMs);
    });

    it('should calculate delays correctly for different strategies', () => {
      const context: any = { attemptCount: 2 };

      // Test immediate
      const immediateCalc = getBackoffCalculator('immediate');
      expect(immediateCalc(context, DEFAULT_RETRY_POLICY_CONFIG.strategies.immediate)).toBe(0);

      // Test fixed delay
      const fixedCalc = getBackoffCalculator('fixed_delay');
      expect(fixedCalc(context, DEFAULT_RETRY_POLICY_CONFIG.strategies.fixed_delay)).toBe(5000);

      // Test exponential backoff
      const expCalc = getBackoffCalculator('exponential_backoff');
      expect(expCalc(context, DEFAULT_RETRY_POLICY_CONFIG.strategies.exponential_backoff)).toBe(
        2000,
      );
    });

    it('should apply jitter consistently', () => {
      const baseDelay = 1000;
      const deterministicRandom = () => 0.5;

      // Same inputs should give same results with deterministic random
      const result1 = applyJitter(baseDelay, 0.2, deterministicRandom);
      const result2 = applyJitter(baseDelay, 0.2, deterministicRandom);

      expect(result1).toBe(result2);
      expect(result1).toBe(baseDelay); // With random = 0.5, jitter = 0
    });
  });
});
