/**
 * @file policyEngine.test.ts - Полное тестирование unified policy engine
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  evaluatePolicies,
} from '../../../../../../src/errors/services/billing-service/policies/policyEngine.js';

import {
  DEFAULT_FRAUD_POLICY_CONFIG,
  evaluateFraudDetectionPolicy,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionPolicy.js';

import {
  DEFAULT_REFUND_POLICY_CONFIG,
  evaluateRefundPolicy,
} from '../../../../../../src/errors/services/billing-service/policies/refundHandlingPolicy.js';

// Create default config locally
const DEFAULT_POLICY_ENGINE_CONFIG = {
  fraudPolicy: DEFAULT_FRAUD_POLICY_CONFIG,
  refundPolicy: DEFAULT_REFUND_POLICY_CONFIG,
};

import type {
  PolicyEngineConfig,
  PolicyEngineContext,
} from '../../../../../../src/errors/services/billing-service/policies/policyEngine.js';

import type {
  FraudDecision,
  PaymentDetails,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionTypes.js';

import type {
  RefundDecision,
} from '../../../../../../src/errors/services/billing-service/policies/refundHandlingPolicy.js';

// Cast to any to avoid typing issues with mocks
const mockEvaluateFraudDetectionPolicy = evaluateFraudDetectionPolicy as any;
const mockEvaluateRefundPolicy = evaluateRefundPolicy as any;

// Mock implementations
const mockFraudDecision: FraudDecision = {
  _tag: 'Clean',
  score: 10,
  evaluatedRules: 3,
};

const mockRefundDecision: RefundDecision = {
  _tag: 'Approve',
  reason: 'Payment clean',
  score: 10,
};

const mockPaymentDetails: PaymentDetails = {
  id: 'payment-123',
  amount: 100,
  currency: 'USD',
  paymentMethod: 'card',
  country: 'US',
  paymentType: 'one-time',
  createdAt: Date.now(),
};

// Simplified mock fraud context - using proper types but simplified values
const mockFraudContext = {
  paymentError: {
    _tag: 'PaymentFailedError' as const,
    code: 'PAYMENT_FAILED' as any,
    message: 'Payment failed',
    paymentId: 'payment-123',
    paymentAmount: 100,
    paymentCurrency: 'USD',
    paymentMethod: 'card',
    timestamp: '2024-01-01T00:00:00Z' as any,
    correlationId: 'test-correlation-id',
  },
  retryDecision: {
    _tag: 'RetryAllowed' as const,
    delayMs: 1000,
    reason: 'transient_error' as any,
    attemptCount: 1,
  },
  retryContext: {
    attemptCount: 1,
    totalDelayMs: 1000,
    lastRetryReason: 'network_error' as any,
  },
  userHistory: {
    userId: 'user-123',
    averageAmount: 100,
    totalPayments: 5,
    recentAttempts: [],
    lastPaymentDate: Date.now() - 86400000,
    firstPaymentDate: Date.now() - 86400000 * 30,
    paymentCount: 5,
  },
  paymentDetails: mockPaymentDetails,
  deviceFingerprint: {
    userAgent: 'test-agent',
    ipAddress: '192.168.1.1',
    deviceId: 'device-123',
    fingerprintHash: 'hash123',
  },
  geolocation: {
    country: 'US',
    city: 'New York',
    coordinates: { lat: 40.7128, lng: -74.0060 },
    timezone: 'America/New_York',
    confidence: 90,
  },
  correlationId: 'test-correlation-id',
  flags: { enableFraudCheck: true },
} as any; // Using any to bypass strict typing for test mocks

const mockServiceRegistry = {
  ruleProvider: {
    loadRules: vi.fn(),
  },
  ruleEngine: {
    evaluateRules: vi.fn(),
  },
  externalDataProvider: {
    getGeolocation: vi.fn(),
    validateDeviceFingerprint: vi.fn(),
  },
  externalDataService: {
    getGeolocationWithFallback: vi.fn(),
    validateDeviceFingerprintWithFallback: vi.fn(),
  },
};

// Mock the imported functions
vi.mock(
  '../../../../../../src/errors/services/billing-service/policies/fraudDetectionPolicy.js',
  () => ({
    evaluateFraudDetectionPolicy: vi.fn(),
    DEFAULT_FRAUD_POLICY_CONFIG: {
      enabled: true,
      version: '1.0.0',
      maxScore: 100,
      thresholds: { lowRisk: 20, highRisk: 50 },
      scores: { clean: 10, suspicious: 45, highRisk: 90 },
    },
  }),
);

vi.mock(
  '../../../../../../src/errors/services/billing-service/policies/refundHandlingPolicy.js',
  () => ({
    evaluateRefundPolicy: vi.fn(),
    DEFAULT_REFUND_POLICY_CONFIG: {
      enabled: true,
      version: '1.0.0',
      maxScore: 100,
      thresholds: { approve: 30, conditional: 60, deny: 80 },
      scores: { clean: 10, suspicious: 50, highRisk: 90 },
    },
  }),
);

describe('PolicyEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockEvaluateFraudDetectionPolicy.mockReturnValue(
      Effect.succeed(mockFraudDecision),
    );
    mockEvaluateRefundPolicy.mockReturnValue(
      Effect.succeed(mockRefundDecision),
    );
  });

  describe('DEFAULT_POLICY_ENGINE_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_POLICY_ENGINE_CONFIG.fraudPolicy).toBeDefined();
      expect(DEFAULT_POLICY_ENGINE_CONFIG.refundPolicy).toBeDefined();
      expect(DEFAULT_POLICY_ENGINE_CONFIG.fraudPolicy.enabled).toBe(true);
      expect(DEFAULT_POLICY_ENGINE_CONFIG.refundPolicy.enabled).toBe(true);
    });
  });

  describe('evaluatePolicies', () => {
    let context: PolicyEngineContext;

    beforeEach(() => {
      context = {
        payment: mockPaymentDetails,
        fraudContext: mockFraudContext,
        correlationId: 'test-correlation-id',
        flags: { enablePolicyEngine: true },
      };
    });

    it('should evaluate both fraud and refund policies', async () => {
      const customConfig: PolicyEngineConfig = {
        fraudPolicy: { ...DEFAULT_POLICY_ENGINE_CONFIG.fraudPolicy },
        refundPolicy: { ...DEFAULT_POLICY_ENGINE_CONFIG.refundPolicy },
      };

      const result = await Effect.runPromise(
        evaluatePolicies(context, customConfig, mockServiceRegistry),
      );

      expect(mockEvaluateFraudDetectionPolicy).toHaveBeenCalledWith(
        context.fraudContext,
        customConfig.fraudPolicy,
        mockServiceRegistry,
      );

      expect(mockEvaluateRefundPolicy).toHaveBeenCalledWith(
        {
          payment: context.payment,
          fraudDecision: mockFraudDecision,
          flags: context.flags ?? {},
          correlationId: context.correlationId,
        },
        customConfig.refundPolicy,
        mockServiceRegistry,
      );

      expect(result).toEqual({
        fraud: mockFraudDecision,
        refund: mockRefundDecision,
      });
    });

    it('should use default config when not provided', async () => {
      const result = await Effect.runPromise(
        evaluatePolicies(context, undefined, mockServiceRegistry),
      );

      expect(mockEvaluateFraudDetectionPolicy).toHaveBeenCalledWith(
        context.fraudContext,
        DEFAULT_POLICY_ENGINE_CONFIG.fraudPolicy,
        mockServiceRegistry,
      );

      expect(result.fraud).toBe(mockFraudDecision);
      expect(result.refund).toBe(mockRefundDecision);
    });

    it('should use default services when not provided', async () => {
      const result = await Effect.runPromise(
        evaluatePolicies(context, DEFAULT_POLICY_ENGINE_CONFIG),
      );

      expect(mockEvaluateFraudDetectionPolicy).toHaveBeenCalledWith(
        context.fraudContext,
        DEFAULT_POLICY_ENGINE_CONFIG.fraudPolicy,
        expect.any(Object), // defaultFraudDetectionServices
      );

      expect(result.fraud).toBe(mockFraudDecision);
      expect(result.refund).toBe(mockRefundDecision);
    });

    it('should create correct refund context from fraud decision', async () => {
      const highRiskFraudDecision: FraudDecision = {
        _tag: 'HighRisk',
        score: 85,
        reasons: ['velocity_attack'],
        evaluatedRules: 5,
        triggeredRules: ['rule1'],
      };

      mockEvaluateFraudDetectionPolicy.mockReturnValueOnce(
        Effect.succeed(highRiskFraudDecision),
      );

      const result = await Effect.runPromise(
        evaluatePolicies(context, DEFAULT_POLICY_ENGINE_CONFIG, mockServiceRegistry),
      );

      expect(mockEvaluateRefundPolicy).toHaveBeenCalledWith(
        {
          payment: context.payment,
          fraudDecision: highRiskFraudDecision,
          flags: context.flags ?? {},
          correlationId: context.correlationId,
        },
        DEFAULT_POLICY_ENGINE_CONFIG.refundPolicy,
        mockServiceRegistry,
      );

      expect(result.fraud).toBe(highRiskFraudDecision);
    });

    it('should handle missing flags in context', async () => {
      const contextWithoutFlags: PolicyEngineContext = {
        payment: mockPaymentDetails,
        fraudContext: mockFraudContext,
        correlationId: 'test-correlation-id',
        // flags is optional
      };

      const result = await Effect.runPromise(
        evaluatePolicies(contextWithoutFlags, DEFAULT_POLICY_ENGINE_CONFIG, mockServiceRegistry),
      );

      expect(mockEvaluateRefundPolicy).toHaveBeenCalledWith(
        {
          payment: contextWithoutFlags.payment,
          fraudDecision: mockFraudDecision,
          flags: {}, // Should default to empty object
          correlationId: contextWithoutFlags.correlationId,
        },
        DEFAULT_POLICY_ENGINE_CONFIG.refundPolicy,
        mockServiceRegistry,
      );

      expect(result.fraud).toBe(mockFraudDecision);
      expect(result.refund).toBe(mockRefundDecision);
    });

    it('should handle errors from fraud detection policy', async () => {
      const testError = new Error('Fraud detection failed');
      mockEvaluateFraudDetectionPolicy.mockReturnValue(
        Effect.fail(testError as any), // Using any to bypass strict typing
      );

      await expect(
        Effect.runPromise(
          evaluatePolicies(context, DEFAULT_POLICY_ENGINE_CONFIG, mockServiceRegistry),
        ),
      ).rejects.toThrow('Fraud detection failed');
    });

    it('should handle errors from refund policy', async () => {
      const testError = new Error('Refund policy failed');
      mockEvaluateRefundPolicy.mockReturnValue(
        Effect.fail(testError as any), // Using any to bypass strict typing
      );

      await expect(
        Effect.runPromise(
          evaluatePolicies(context, DEFAULT_POLICY_ENGINE_CONFIG, mockServiceRegistry),
        ),
      ).rejects.toThrow('Refund policy failed');
    });
  });
});
