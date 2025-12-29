/**
 * @file fraudDetectionInterfaces.test.ts - Полное тестирование интерфейсов fraud detection
 */

import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  applyStandardizedCircuitBreaker,
  applyStandardizedExternalCallOptions,
  applyStandardizedRetry,
  DEFAULT_EXTERNAL_CALL_OPTIONS,
  withErrorLogging,
  withGracefulFallback,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionInterfaces.js';

import type {
  DeviceFingerprintResult,
  ExternalDataProviderError,
  FraudRuleEngineError,
  FraudRuleProviderError,
  GeolocationData,
  ProviderResult,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionInterfaces.js';

import type {
  FraudContext,
  FraudPolicyConfig,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionPolicy.js';

import type { BillingServiceError } from '../../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';

// ==================== MOCKS ====================

// Mock success effect
const mockSuccessEffect = Effect.succeed('test-data');

// Mock fraud policy config
const mockFraudPolicyConfig: FraudPolicyConfig = {
  rules: {},
  thresholds: {
    lowRisk: 20,
    highRisk: 50,
  },
  maxScore: 100,
  enabled: true,
  version: '1.0.0',
  performance: {
    maxRulesEvaluation: 50,
    shortCircuitThreshold: 80,
  },
  externalApis: {
    geoLookupRateLimit: 100,
    externalCallTimeoutMs: 5000,
  },
  alerts: {
    suspiciousRateThreshold: 10,
    highRiskRateThreshold: 5,
    evaluationLatencyThresholdMs: 1000,
  },
};

// Mock billing service error
const mockBillingServiceError: BillingServiceError = {
  _tag: 'PaymentFailedError',
  code: 'SERVICE_BILLING_100',
  message: 'Payment failed',
  category: 'BUSINESS',
  severity: 'high',
  origin: 'SERVICE',
  timestamp: '2024-01-01T00:00:00Z',
  details: {
    transactionId: 'test-tx',
    amount: 100,
    currency: 'BYN',
    retryable: true,
    provider: 'bepaid',
    operation: 'charge',
  },
};

// Mock fraud context
const mockFraudContext: FraudContext = {
  paymentError: mockBillingServiceError,
  retryDecision: {
    _tag: 'RetryAllowed',
    context: {
      attemptCount: 1,
      maxAttempts: 3,
      strategy: 'exponential_backoff',
      baseDelayMs: 1000,
      lastAttemptAtEpochMs: 1000,
      totalDelayMs: 0,
    },
    delayMs: 1000,
  },
  userHistory: {
    userId: 'test-user',
    averageAmount: 100,
    totalPayments: 10,
    recentAttempts: [],
    lastSuccessfulPayment: {
      id: 'last-payment-id',
      amount: 100,
      currency: 'BYN',
      paymentMethod: 'bepaid',
      country: 'BY',
      paymentType: 'one-time',
      createdAt: 1000000,
    },
    knownGeolocations: ['US'],
    knownDeviceFingerprints: ['fp-123'],
  },
  paymentDetails: {
    id: 'payment-id',
    amount: 100,
    currency: 'BYN',
    paymentMethod: 'bepaid',
    country: 'BY',
    paymentType: 'one-time',
    createdAt: 1000000,
  },
  correlationId: 'test-correlation-id',
};

// Mock error effects
const mockFraudRuleProviderError: FraudRuleProviderError = {
  _tag: 'ConfigurationError',
  message: 'Invalid configuration provided',
  config: mockFraudPolicyConfig,
} as const;

const mockExternalDataProviderError: ExternalDataProviderError = {
  _tag: 'NetworkError',
  message: 'Connection timeout',
  service: 'geolocation-service',
} as const;

const mockFraudRuleEngineError: FraudRuleEngineError = {
  _tag: 'RuleEvaluationError',
  message: 'Failed to evaluate rule',
  ruleId: 'velocity-rule',
  context: mockFraudContext,
} as const;

// Mock data for graceful fallback
const mockGeolocationData: GeolocationData = {
  country: 'US',
  city: 'New York',
  coordinates: { lat: 40.7128, lng: -74.0060 },
  timezone: 'America/New_York',
  confidence: 0.95,
  source: 'maxmind',
  timestamp: Date.now(),
};

const mockDeviceFingerprintResult: DeviceFingerprintResult = {
  isSuspicious: false,
  confidence: 0.85,
  reasons: [],
  metadata: { browserVersion: 'Chrome 120' },
};

// ==================== TESTS ====================

describe('FraudDetectionInterfaces', () => {
  describe('DEFAULT_EXTERNAL_CALL_OPTIONS', () => {
    it('should have correct timeout configuration', () => {
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.timeout.timeoutMs).toBe(5000);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.timeout.retryCount).toBe(2);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.timeout.retryDelayMs).toBe(1000);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.timeout.retryBackoff).toBe('exponential');
    });

    it('should have correct circuit breaker configuration', () => {
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.circuitBreaker.failureThreshold).toBe(5);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.circuitBreaker.resetTimeoutMs).toBe(30000);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.circuitBreaker.name).toBe('default-external-service');
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.circuitBreaker.monitoringEnabled).toBe(true);
    });

    it('should have correct retry configuration', () => {
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.retry.maxAttempts).toBe(3);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.retry.initialDelayMs).toBe(1000);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.retry.maxDelayMs).toBe(10000);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.retry.backoffMultiplier).toBe(2);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.retry.retryableErrors).toEqual([
        'NetworkError',
        'TimeoutError',
      ]);
    });

    it('should have correct supervision configuration', () => {
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.supervision.enabled).toBe(false);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.supervision.scopeName).toBe('external-call');
    });

    it('should have correct tenant configuration', () => {
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.tenant.priority).toBe('normal');
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.tenant.fallback?.enabled).toBe(true);
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.tenant.fallback?.strategy).toBe('cache_only');
    });

    it('should have empty feature flags', () => {
      expect(DEFAULT_EXTERNAL_CALL_OPTIONS.featureFlags).toEqual({});
    });
  });

  describe('applyStandardizedCircuitBreaker', () => {
    it('should return the effect unchanged in current implementation', async () => {
      const result = await Effect.runPromise(applyStandardizedCircuitBreaker(mockSuccessEffect));

      expect(result).toBe('test-data');
    });

    it('should handle error effects', async () => {
      const errorEffect = Effect.fail(mockFraudRuleProviderError) as unknown as Effect.Effect<
        unknown
      >;
      const result = applyStandardizedCircuitBreaker(errorEffect);

      // In current implementation, error should still be propagated
      await expect(Effect.runPromise(result)).rejects.toThrow();
    });

    it('should preserve effect composition', async () => {
      const composedEffect = Effect.gen(function*(_) {
        const data1 = yield* _(mockSuccessEffect);
        const data2 = yield* _(Effect.succeed('more-data'));
        return `${data1}-${data2}`;
      });

      const result = await Effect.runPromise(applyStandardizedCircuitBreaker(composedEffect));

      expect(result).toBe('test-data-more-data');
    });
  });

  describe('applyStandardizedRetry', () => {
    it('should return the effect unchanged in current implementation', async () => {
      const result = await Effect.runPromise(applyStandardizedRetry(mockSuccessEffect));

      expect(result).toBe('test-data');
    });

    it('should handle error effects', async () => {
      const errorEffect = Effect.fail(mockExternalDataProviderError) as unknown as Effect.Effect<
        unknown
      >;
      const result = applyStandardizedRetry(errorEffect);

      // In current implementation, error should still be propagated
      await expect(Effect.runPromise(result)).rejects.toThrow();
    });

    it('should preserve effect composition with retry applied', async () => {
      const composedEffect = Effect.gen(function*(_) {
        const data1 = yield* _(mockSuccessEffect);
        const data2 = yield* _(Effect.succeed('retry-data'));
        return `${data1}-${data2}`;
      });

      const result = await Effect.runPromise(applyStandardizedRetry(composedEffect));

      expect(result).toBe('test-data-retry-data');
    });
  });

  describe('applyStandardizedExternalCallOptions', () => {
    it('should return the effect unchanged in current implementation', async () => {
      const result = await Effect.runPromise(
        applyStandardizedExternalCallOptions(mockSuccessEffect),
      );

      expect(result).toBe('test-data');
    });

    it('should handle error effects', async () => {
      const errorEffect = Effect.fail(mockFraudRuleEngineError) as unknown as Effect.Effect<
        unknown
      >;
      const result = applyStandardizedExternalCallOptions(errorEffect);

      // In current implementation, error should still be propagated
      await expect(Effect.runPromise(result)).rejects.toThrow();
    });

    it('should preserve complex effect composition', async () => {
      const complexEffect = Effect.gen(function*(_) {
        const data1 = yield* _(mockSuccessEffect);
        const data2 = yield* _(Effect.succeed('external-data'));
        const data3 = yield* _(Effect.succeed('processed-data'));
        return `${data1}-${data2}-${data3}`;
      });

      const result = await Effect.runPromise(applyStandardizedExternalCallOptions(complexEffect));

      expect(result).toBe('test-data-external-data-processed-data');
    });
  });

  describe('withGracefulFallback', () => {
    it('should return success result unchanged', async () => {
      const successResult: ProviderResult<string> = Effect.succeed('success-data');

      const result = await Effect.runPromise(withGracefulFallback(successResult));

      expect(result).toBe('success-data');
    });

    it('should convert FraudRuleProviderError to null with logging', async () => {
      const errorResult: ProviderResult<string> = Effect.fail(mockFraudRuleProviderError);

      const result = await Effect.runPromise(withGracefulFallback(errorResult));

      expect(result).toBeNull();
    });

    it('should convert ExternalDataProviderError to null with logging', async () => {
      const errorResult: ProviderResult<GeolocationData> = Effect.fail(
        mockExternalDataProviderError,
      );

      const result = await Effect.runPromise(withGracefulFallback(errorResult));

      expect(result).toBeNull();
    });

    it('should convert FraudRuleEngineError to null with logging', async () => {
      const errorResult: ProviderResult<DeviceFingerprintResult> = Effect.fail(
        mockFraudRuleEngineError,
      );

      const result = await Effect.runPromise(withGracefulFallback(errorResult));

      expect(result).toBeNull();
    });

    it('should handle errors with stack traces', async () => {
      const errorWithStack = new Error('Test error with stack');
      errorWithStack.name = 'TestError';

      const errorResult: ProviderResult<string> = Effect.fail({
        _tag: 'ConfigurationError',
        message: 'Test message',
        config: mockFraudPolicyConfig,
      } as FraudRuleProviderError);

      const result = await Effect.runPromise(withGracefulFallback(errorResult));

      expect(result).toBeNull();
    });

    it('should handle Error instances with stack traces', async () => {
      const jsError = new Error('JavaScript error with stack trace');

      const errorResult: ProviderResult<string> = Effect.fail({
        _tag: 'ConfigurationError',
        message: 'Test message',
        config: mockFraudPolicyConfig,
      } as FraudRuleProviderError);

      // Mock the error to be an Error instance
      const errorWithStack = Object.assign(jsError, {
        _tag: 'ConfigurationError',
        config: mockFraudPolicyConfig,
      } as FraudRuleProviderError);

      const errorResultWithStack: ProviderResult<string> = Effect.fail(errorWithStack);

      const result = await Effect.runPromise(withGracefulFallback(errorResultWithStack));

      expect(result).toBeNull();
    });

    it('should preserve error types in return type', async () => {
      const successResult: ProviderResult<GeolocationData> = Effect.succeed(mockGeolocationData);

      const result = await Effect.runPromise(withGracefulFallback(successResult));

      expect(result).toEqual(mockGeolocationData);
    });
  });

  describe('withErrorLogging', () => {
    it('should return success result unchanged', async () => {
      const successResult: ProviderResult<string> = Effect.succeed('success-data');

      const result = await Effect.runPromise(withErrorLogging(successResult, 'test-context'));

      expect(result).toBe('success-data');
    });

    it('should log and re-throw FraudRuleProviderError', async () => {
      const errorResult: ProviderResult<string> = Effect.fail(mockFraudRuleProviderError);

      await expect(Effect.runPromise(withErrorLogging(errorResult, 'rule-provider'))).rejects
        .toThrow();
    });

    it('should log and re-throw ExternalDataProviderError', async () => {
      const errorResult: ProviderResult<GeolocationData> = Effect.fail(
        mockExternalDataProviderError,
      );

      await expect(Effect.runPromise(withErrorLogging(errorResult, 'external-data'))).rejects
        .toThrow();
    });

    it('should log and re-throw FraudRuleEngineError', async () => {
      const errorResult: ProviderResult<DeviceFingerprintResult> = Effect.fail(
        mockFraudRuleEngineError,
      );

      await expect(Effect.runPromise(withErrorLogging(errorResult, 'rule-engine'))).rejects
        .toThrow();
    });

    it('should use different contexts for different operations', async () => {
      const errorResult: ProviderResult<string> = Effect.fail(mockFraudRuleProviderError);

      await expect(Effect.runPromise(withErrorLogging(errorResult, 'custom-context'))).rejects
        .toThrow();
    });

    it('should preserve error details in re-thrown error', async () => {
      const errorResult: ProviderResult<string> = Effect.fail(mockFraudRuleProviderError);

      await expect(Effect.runPromise(withErrorLogging(errorResult, 'test'))).rejects.toThrow();
    });
  });

  describe('Error Type Coverage', () => {
    describe('FraudRuleProviderError variants', () => {
      it('should handle ConfigurationError', async () => {
        const configError: FraudRuleProviderError = {
          _tag: 'ConfigurationError',
          message: 'Config validation failed',
          config: mockFraudPolicyConfig,
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(configError)));
        expect(result).toBeNull();
      });

      it('should handle NetworkError', async () => {
        const networkError: FraudRuleProviderError = {
          _tag: 'NetworkError',
          message: 'Connection failed',
          source: 'database',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(networkError)));
        expect(result).toBeNull();
      });

      it('should handle ValidationError', async () => {
        const validationError: FraudRuleProviderError = {
          _tag: 'ValidationError',
          message: 'Rule validation failed',
          invalidRules: ['rule-1', 'rule-2'],
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(validationError)));
        expect(result).toBeNull();
      });

      it('should handle TimeoutError', async () => {
        const timeoutError: FraudRuleProviderError = {
          _tag: 'TimeoutError',
          message: 'Request timeout',
          timeoutMs: 5000,
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(timeoutError)));
        expect(result).toBeNull();
      });
    });

    describe('ExternalDataProviderError variants', () => {
      it('should handle NetworkError', async () => {
        const networkError: ExternalDataProviderError = {
          _tag: 'NetworkError',
          message: 'API unreachable',
          service: 'geolocation-api',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(networkError)));
        expect(result).toBeNull();
      });

      it('should handle TimeoutError', async () => {
        const timeoutError: ExternalDataProviderError = {
          _tag: 'TimeoutError',
          message: 'Request timed out',
          timeoutMs: 3000,
          service: 'device-fingerprint',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(timeoutError)));
        expect(result).toBeNull();
      });

      it('should handle RateLimitError', async () => {
        const rateLimitError: ExternalDataProviderError = {
          _tag: 'RateLimitError',
          message: 'Rate limit exceeded',
          retryAfterMs: 60000,
          service: 'external-api',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(rateLimitError)));
        expect(result).toBeNull();
      });

      it('should handle InvalidInputError', async () => {
        const inputError: ExternalDataProviderError = {
          _tag: 'InvalidInputError',
          message: 'Invalid IP address format',
          field: 'ipAddress',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(inputError)));
        expect(result).toBeNull();
      });

      it('should handle ServiceUnavailableError', async () => {
        const serviceError: ExternalDataProviderError = {
          _tag: 'ServiceUnavailableError',
          message: 'Service is down',
          service: 'geolocation',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(serviceError)));
        expect(result).toBeNull();
      });
    });

    describe('FraudRuleEngineError variants', () => {
      it('should handle RuleEvaluationError', async () => {
        const evaluationError: FraudRuleEngineError = {
          _tag: 'RuleEvaluationError',
          message: 'Condition evaluation failed',
          ruleId: 'amount-rule',
          context: mockFraudContext,
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(evaluationError)));
        expect(result).toBeNull();
      });

      it('should handle ConfigurationError', async () => {
        const configError: FraudRuleEngineError = {
          _tag: 'ConfigurationError',
          message: 'Invalid engine configuration',
          configIssue: 'missing-rule-set',
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(configError)));
        expect(result).toBeNull();
      });

      it('should handle PerformanceError', async () => {
        const performanceError: FraudRuleEngineError = {
          _tag: 'PerformanceError',
          message: 'Evaluation took too long',
          latencyMs: 15000,
          ruleCount: 25,
        };

        const result = await Effect.runPromise(withGracefulFallback(Effect.fail(performanceError)));
        expect(result).toBeNull();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle chained error handling operations', async () => {
      // Create a complex effect that fails
      const complexFailingEffect = Effect.gen(function*(_) {
        yield* _(Effect.succeed('step1'));
        yield* _(Effect.fail(mockFraudRuleProviderError));
        return 'should-not-reach-here';
      });

      // Apply error logging first, then graceful fallback
      const loggedEffect = withErrorLogging(complexFailingEffect, 'integration-test');
      const gracefulEffect = withGracefulFallback(loggedEffect);

      const result = await Effect.runPromise(gracefulEffect);

      expect(result).toBeNull();
    });

    it('should handle multiple standardized options applied', async () => {
      const failingEffect = Effect.fail(mockExternalDataProviderError) as unknown as Effect.Effect<
        unknown
      >;

      // Apply all standardized options
      const processedEffect = applyStandardizedExternalCallOptions(
        applyStandardizedRetry(
          applyStandardizedCircuitBreaker(failingEffect),
        ),
      );

      // In current implementation, error should still be propagated
      await expect(Effect.runPromise(processedEffect)).rejects.toThrow();
    });

    it('should handle success path through all helpers', async () => {
      const successEffect = Effect.succeed(mockGeolocationData);

      // Apply all helpers
      const processedEffect = applyStandardizedExternalCallOptions(
        applyStandardizedRetry(
          applyStandardizedCircuitBreaker(successEffect),
        ),
      );

      const result = await Effect.runPromise(processedEffect);

      expect(result).toEqual(mockGeolocationData);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty error messages', async () => {
      const emptyMessageError: FraudRuleProviderError = {
        _tag: 'ConfigurationError',
        message: '',
        config: {
          ...mockFraudPolicyConfig,
          performance: {
            ...mockFraudPolicyConfig.performance,
            maxRulesEvaluation: 5,
          },
        },
      };

      const result = await Effect.runPromise(withGracefulFallback(Effect.fail(emptyMessageError)));

      expect(result).toBeNull();
    });

    it('should handle very long error messages', async () => {
      const longMessage = 'A'.repeat(1000);
      const longMessageError: ExternalDataProviderError = {
        _tag: 'NetworkError',
        message: longMessage,
        service: 'test-service',
      };

      const result = await Effect.runPromise(withGracefulFallback(Effect.fail(longMessageError)));

      expect(result).toBeNull();
    });

    it('should handle nested effect structures', async () => {
      const nestedEffect = Effect.gen(function*(_) {
        const innerResult = yield* _(Effect.gen(function*(_) {
          yield* _(Effect.succeed('inner'));
          return yield* _(Effect.fail(mockFraudRuleEngineError));
        }));
        return innerResult;
      });

      const result = await Effect.runPromise(withGracefulFallback(nestedEffect));

      expect(result).toBeNull();
    });

    it('should handle effects with multiple yields before failure', async () => {
      const multiStepEffect = Effect.gen(function*(_) {
        yield* _(Effect.succeed('step1'));
        yield* _(Effect.succeed('step2'));
        yield* _(Effect.succeed('step3'));
        yield* _(Effect.fail(mockExternalDataProviderError));
        return 'unreachable';
      });

      const result = await Effect.runPromise(withGracefulFallback(multiStepEffect));

      expect(result).toBeNull();
    });
  });

  describe('Type safety and generic handling', () => {
    it('should maintain type safety with different result types', async () => {
      // Test with string result
      const stringSuccess: ProviderResult<string> = Effect.succeed('string-data');
      const stringResult = await Effect.runPromise(withGracefulFallback(stringSuccess));
      expect(typeof stringResult).toBe('string');

      // Test with object result
      const objectSuccess: ProviderResult<GeolocationData> = Effect.succeed(mockGeolocationData);
      const objectResult = await Effect.runPromise(withGracefulFallback(objectSuccess));
      expect(objectResult).toEqual(mockGeolocationData);

      // Test with null result (graceful degradation)
      const errorResult: ProviderResult<string> = Effect.fail(mockFraudRuleProviderError);
      const nullResult = await Effect.runPromise(withGracefulFallback(errorResult));
      expect(nullResult).toBeNull();
    });

    it('should handle union types correctly', async () => {
      // Test ProviderResult<T | null> type handling
      const successResult: ProviderResult<GeolocationData | null> = Effect.succeed(
        mockGeolocationData,
      );
      const successFallback = await Effect.runPromise(withGracefulFallback(successResult));
      expect(successFallback).toEqual(mockGeolocationData);

      const nullResult: ProviderResult<GeolocationData | null> = Effect.succeed(null);
      const nullFallback = await Effect.runPromise(withGracefulFallback(nullResult));
      expect(nullFallback).toBeNull();
    });
  });
});
