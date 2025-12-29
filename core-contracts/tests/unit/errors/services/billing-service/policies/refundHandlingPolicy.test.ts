/**
 * @file refundHandlingPolicy.test.ts - Полное тестирование refund handling policy
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  APPROVE_THRESHOLD,
  CONDITIONAL_THRESHOLD,
  DEFAULT_REFUND_POLICY_CONFIG,
  DENY_THRESHOLD,
  evaluateRefundPolicy,
  MAX_REFUND_SCORE,
} from '../../../../../../src/errors/services/billing-service/policies/refundHandlingPolicy.js';

import type {
  RefundContext,
} from '../../../../../../src/errors/services/billing-service/policies/refundHandlingPolicy.js';

import type {
  FraudDecision,
  PaymentDetails,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionTypes.js';

import type { FraudDetectionServiceRegistry } from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionInterfaces.js';

// Mock services registry
const mockServiceRegistry: FraudDetectionServiceRegistry = {
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

const mockPaymentDetails: PaymentDetails = {
  id: 'payment-123',
  amount: 100,
  currency: 'USD',
  paymentMethod: 'card',
  country: 'US',
  paymentType: 'one-time',
  createdAt: Date.now(),
};

const mockCleanDecision: FraudDecision = {
  _tag: 'Clean',
  score: 10,
  evaluatedRules: 5,
};

const mockSuspiciousDecision: FraudDecision = {
  _tag: 'Suspicious',
  score: 45,
  reasons: ['velocity_attack'],
  evaluatedRules: 5,
  triggeredRules: ['rule1'],
};

const mockHighRiskDecision: FraudDecision = {
  _tag: 'HighRisk',
  score: 85,
  reasons: ['velocity_attack'],
  evaluatedRules: 5,
  triggeredRules: ['rule1'],
};

describe('RefundHandlingPolicy', () => {
  describe('Constants', () => {
    it('should have correct constant values', () => {
      expect(MAX_REFUND_SCORE).toBe(100);
      expect(APPROVE_THRESHOLD).toBe(30);
      expect(CONDITIONAL_THRESHOLD).toBe(60);
      expect(DENY_THRESHOLD).toBe(80);
    });
  });

  describe('DEFAULT_REFUND_POLICY_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_REFUND_POLICY_CONFIG.version).toBe('1.0.0');
      expect(DEFAULT_REFUND_POLICY_CONFIG.enabled).toBe(true);
      expect(DEFAULT_REFUND_POLICY_CONFIG.scores.clean).toBe(10);
      expect(DEFAULT_REFUND_POLICY_CONFIG.scores.suspicious).toBe(50);
      expect(DEFAULT_REFUND_POLICY_CONFIG.scores.highRisk).toBe(90);
      expect(DEFAULT_REFUND_POLICY_CONFIG.thresholds.approve).toBe(APPROVE_THRESHOLD);
      expect(DEFAULT_REFUND_POLICY_CONFIG.thresholds.conditional).toBe(CONDITIONAL_THRESHOLD);
      expect(DEFAULT_REFUND_POLICY_CONFIG.thresholds.deny).toBe(DENY_THRESHOLD);
    });
  });

  describe('evaluateRefundPolicy', () => {
    let context: RefundContext;

    beforeEach(() => {
      context = {
        payment: mockPaymentDetails,
        fraudDecision: mockCleanDecision,
        correlationId: 'test-correlation-id',
        flags: { enableRefundPolicy: true },
      };
    });

    it('should return Approve decision when policy is disabled', async () => {
      const disabledConfig = { ...DEFAULT_REFUND_POLICY_CONFIG, enabled: false };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(context, disabledConfig, mockServiceRegistry),
      );

      expect(result._tag).toBe('Approve');
      expect(result.reason).toBe('Policy disabled');
      expect(result.score).toBe(0);
      expect('conditions' in result).toBe(false); // Approve doesn't have conditions
    });

    it('should return Approve decision for Clean fraud decision', async () => {
      const cleanContext: RefundContext = {
        ...context,
        fraudDecision: mockCleanDecision,
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(cleanContext, DEFAULT_REFUND_POLICY_CONFIG, mockServiceRegistry),
      );

      expect(result._tag).toBe('Approve');
      expect(result.reason).toBe('Payment clean');
      expect(result.score).toBe(10); // DEFAULT_REFUND_POLICY_CONFIG.scores.clean
    });

    it('should return Conditional decision for Suspicious fraud decision', async () => {
      const suspiciousContext: RefundContext = {
        ...context,
        fraudDecision: mockSuspiciousDecision,
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(suspiciousContext, DEFAULT_REFUND_POLICY_CONFIG, mockServiceRegistry),
      );

      expect(result._tag).toBe('Conditional');
      expect(result.reason).toBe('Payment flagged suspicious');
      expect(result.score).toBe(DEFAULT_REFUND_POLICY_CONFIG.scores.suspicious);
      expect('conditions' in result && result.conditions).toEqual(['Suspicious fraud score']);
    });

    it('should return Deny decision for HighRisk fraud decision', async () => {
      const highRiskContext: RefundContext = {
        ...context,
        fraudDecision: mockHighRiskDecision,
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(highRiskContext, DEFAULT_REFUND_POLICY_CONFIG, mockServiceRegistry),
      );

      expect(result._tag).toBe('Deny');
      expect(result.reason).toBe('High risk payment');
      expect(result.score).toBe(DEFAULT_REFUND_POLICY_CONFIG.scores.highRisk);
    });

    it('should handle custom scores in config', async () => {
      const customConfig = {
        ...DEFAULT_REFUND_POLICY_CONFIG,
        scores: {
          clean: 15,
          suspicious: 65,
          highRisk: 95,
        },
      };

      // Test clean with custom score
      const cleanContext: RefundContext = {
        ...context,
        fraudDecision: mockCleanDecision,
      };

      const cleanResult = await Effect.runPromise(
        evaluateRefundPolicy(cleanContext, customConfig, mockServiceRegistry),
      );

      expect(cleanResult.score).toBe(15);

      // Test suspicious with custom score
      const suspiciousContext: RefundContext = {
        ...context,
        fraudDecision: mockSuspiciousDecision,
      };

      const suspiciousResult = await Effect.runPromise(
        evaluateRefundPolicy(suspiciousContext, customConfig, mockServiceRegistry),
      );

      expect(suspiciousResult.score).toBe(65);

      // Test high risk with custom score
      const highRiskContext: RefundContext = {
        ...context,
        fraudDecision: mockHighRiskDecision,
      };

      const highRiskResult = await Effect.runPromise(
        evaluateRefundPolicy(highRiskContext, customConfig, mockServiceRegistry),
      );

      expect(highRiskResult.score).toBe(95);
    });

    it('should handle correlation ID and payment ID in context', async () => {
      const customContext: RefundContext = {
        payment: { ...mockPaymentDetails, id: 'custom-payment-id' },
        fraudDecision: mockCleanDecision,
        correlationId: 'custom-correlation-id',
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(customContext, DEFAULT_REFUND_POLICY_CONFIG, mockServiceRegistry),
      );

      expect(result._tag).toBe('Approve');
      // Logging should include the custom IDs
    });

    it('should handle missing flags in context', async () => {
      const contextWithoutFlags: RefundContext = {
        payment: mockPaymentDetails,
        fraudDecision: mockCleanDecision,
        correlationId: 'test-correlation-id',
        // flags is optional
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(
          contextWithoutFlags,
          DEFAULT_REFUND_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Approve');
    });

    it('should handle forceConditional feature flag', async () => {
      const customConfig = {
        ...DEFAULT_REFUND_POLICY_CONFIG,
        scores: {
          ...DEFAULT_REFUND_POLICY_CONFIG.scores,
          clean: 35, // Score above approve threshold (30) so threshold logic won't override
        },
      };

      const contextWithForceConditional: RefundContext = {
        payment: mockPaymentDetails,
        fraudDecision: mockCleanDecision,
        correlationId: 'test-correlation-id',
        flags: { forceConditional: true },
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(contextWithForceConditional, customConfig, mockServiceRegistry),
      );

      expect(result._tag).toBe('Conditional');
      expect(result.reason).toBe('Forced conditional');
      expect(result.score).toBe(35);
      expect('conditions' in result && result.conditions).toEqual([
        'Forced conditional via feature flag',
      ]);
    });

    it('should ignore forceConditional flag for non-Approve decisions', async () => {
      const contextWithForceConditional: RefundContext = {
        payment: mockPaymentDetails,
        fraudDecision: mockSuspiciousDecision,
        correlationId: 'test-correlation-id',
        flags: { forceConditional: true }, // Should be ignored for Suspicious
      };

      const result = await Effect.runPromise(
        evaluateRefundPolicy(
          contextWithForceConditional,
          DEFAULT_REFUND_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Conditional'); // Already Conditional, not changed
      expect(result.reason).toBe('Payment flagged suspicious');
      expect(result.score).toBe(DEFAULT_REFUND_POLICY_CONFIG.scores.suspicious);
    });
  });
});
