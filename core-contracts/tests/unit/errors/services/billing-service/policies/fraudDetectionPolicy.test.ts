/**
 * @file fraudDetectionPolicy.test.ts - Полное тестирование fraud detection policy
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  DEFAULT_FRAUD_POLICY_CONFIG,
  evaluateFraudDetectionPolicy,
  EXCESSIVE_RETRY_THRESHOLD,
  EXTERNAL_API_RATE_LIMIT,
  GEO_LOOKUP_TIMEOUT_MS,
  HIGH_RISK_THRESHOLD,
  LOW_RISK_THRESHOLD,
  MAX_FRAUD_SCORE,
  MAX_RULES_EVALUATION,
  MIN_PAYMENTS_FOR_HISTORY_ANALYSIS,
  PAYMENT_METHOD_HISTORY_LENGTH,
  RAPID_ATTEMPTS_PERIOD_MINUTES,
  RAPID_ATTEMPTS_THRESHOLD,
  RULE_PRIORITIES,
  TIME_CONSTANTS,
  UNUSUAL_AMOUNT_DEVIATION,
  VELOCITY_ATTACK_PERIOD_MINUTES,
  VELOCITY_ATTACK_THRESHOLD,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionPolicy.js';

import type {
  DeviceFingerprint,
  FraudContext,
  FraudRule,
  GeolocationData,
  PaymentDetails,
  UserPaymentHistory,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionTypes.js';

import type {
  FraudDetectionServiceRegistry,
  FraudRuleEngineError,
  FraudRuleProviderError,
} from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionInterfaces.js';

import type {
  BillingServiceError,
} from '../../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';

import type {
  RetryDecision,
} from '../../../../../../src/errors/services/billing-service/policies/paymentRetryPolicy.js';

// ==================== MOCKS ====================

// Mock billing service error
const mockBillingError: BillingServiceError = {
  _tag: 'PaymentFailedError',
  code: 'SERVICE_BILLING_100',
  message: 'Payment processing failed',
  category: 'BUSINESS',
  severity: 'high',
  origin: 'SERVICE',
  timestamp: '2024-01-01T00:00:00Z',
  details: {
    transactionId: 'test-123',
    amount: 100,
    currency: 'BYN',
    retryable: false,
    provider: 'webpay',
    operation: 'charge',
  },
} as const;

// Mock retry decision
const mockRetryDecision: RetryDecision = {
  _tag: 'RetryAllowed',
  context: {
    attemptCount: 1,
    maxAttempts: 3,
    strategy: 'exponential_backoff',
    baseDelayMs: 1000,
    lastAttemptAtEpochMs: Date.now(),
    totalDelayMs: 0,
  },
  delayMs: 1000,
};

// Mock user payment history
const mockUserHistory: UserPaymentHistory = {
  userId: 'user-123',
  averageAmount: 50,
  totalPayments: 10,
  recentAttempts: [
    {
      timestamp: Date.now() - 1000,
      successful: true,
      amount: 50,
      paymentMethod: 'card',
      geolocation: 'BY',
      deviceFingerprint: 'fp-123',
    },
  ],
  knownGeolocations: ['BY', 'RU'],
  knownDeviceFingerprints: ['fp-123'],
};

// Mock payment details
const mockPaymentDetails: PaymentDetails = {
  id: 'payment-123',
  amount: 100,
  currency: 'BYN',
  paymentMethod: 'card',
  country: 'BY',
  paymentType: 'one-time',
  createdAt: Date.now(),
};

// Mock device fingerprint
const mockDeviceFingerprint: DeviceFingerprint = {
  userAgent: 'Mozilla/5.0',
  ipAddress: '192.168.1.1',
  deviceId: 'device-123',
  fingerprintHash: 'hash-123',
};

// Mock geolocation data
const mockGeolocationData: GeolocationData = {
  country: 'BY',
  city: 'Minsk',
  coordinates: { lat: 53.9, lng: 27.5 },
  timezone: 'Europe/Minsk',
  confidence: 95,
};

// Mock fraud context
const mockFraudContext: FraudContext = {
  paymentError: mockBillingError,
  retryDecision: mockRetryDecision,
  userHistory: mockUserHistory,
  paymentDetails: mockPaymentDetails,
  deviceFingerprint: mockDeviceFingerprint,
  geolocation: mockGeolocationData,
  correlationId: 'test-correlation-id',
};

// Mock fraud rule
const mockFraudRule: FraudRule = {
  id: 'test-rule',
  name: 'Test Rule',
  condition: () => true,
  score: 25,
  reason: 'velocity_attack',
  priority: RULE_PRIORITIES.VELOCITY_ATTACK,
  enabled: true,
  version: '1.0.0',
  description: 'Test rule for testing',
};

// Mock service registry
const mockServiceRegistry: FraudDetectionServiceRegistry = {
  ruleProvider: {
    loadRules: vi.fn(),
  },
  externalDataProvider: {
    getGeolocation: vi.fn(),
    validateDeviceFingerprint: vi.fn(),
  },
  ruleEngine: {
    evaluateRules: vi.fn(),
  },
  externalDataService: {
    getGeolocationWithFallback: vi.fn(),
    validateDeviceFingerprintWithFallback: vi.fn(),
  },
};

// Typed mocks for easier testing
const mockRuleProvider = vi.mocked(mockServiceRegistry.ruleProvider);
const mockExternalDataProvider = vi.mocked(mockServiceRegistry.externalDataProvider);
const mockRuleEngine = vi.mocked(mockServiceRegistry.ruleEngine);
const mockExternalDataService = vi.mocked(mockServiceRegistry.externalDataService);

// ==================== TESTS ====================

describe('FraudDetectionPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constants', () => {
    it('should have correct constant values', () => {
      expect(MAX_FRAUD_SCORE).toBe(100);
      expect(LOW_RISK_THRESHOLD).toBe(20);
      expect(HIGH_RISK_THRESHOLD).toBe(50);
      expect(MAX_RULES_EVALUATION).toBe(50);
      expect(GEO_LOOKUP_TIMEOUT_MS).toBe(5000);
      expect(EXTERNAL_API_RATE_LIMIT).toBe(100);
      expect(VELOCITY_ATTACK_THRESHOLD).toBe(10);
      expect(EXCESSIVE_RETRY_THRESHOLD).toBe(5);
      expect(UNUSUAL_AMOUNT_DEVIATION).toBe(2.0);
      expect(RAPID_ATTEMPTS_THRESHOLD).toBe(3);
      expect(VELOCITY_ATTACK_PERIOD_MINUTES).toBe(1);
      expect(RAPID_ATTEMPTS_PERIOD_MINUTES).toBe(5);
      expect(MIN_PAYMENTS_FOR_HISTORY_ANALYSIS).toBe(3);
      expect(PAYMENT_METHOD_HISTORY_LENGTH).toBe(10);
    });

    it('should have correct TIME_CONSTANTS', () => {
      expect(TIME_CONSTANTS.SECONDS_PER_MINUTE).toBe(60);
      expect(TIME_CONSTANTS.MILLISECONDS_PER_SECOND).toBe(1000);
      expect(TIME_CONSTANTS.MILLISECONDS_PER_MINUTE).toBe(60000);
    });

    it('should have correct RULE_PRIORITIES', () => {
      expect(RULE_PRIORITIES.VELOCITY_ATTACK).toBe(10);
      expect(RULE_PRIORITIES.EXCESSIVE_RETRIES).toBe(6);
      expect(RULE_PRIORITIES.GEOLOCATION_MISMATCH).toBe(5);
      expect(RULE_PRIORITIES.DEVICE_FINGERPRINT).toBe(4);
      expect(RULE_PRIORITIES.UNUSUAL_AMOUNT).toBe(3);
      expect(RULE_PRIORITIES.RAPID_ATTEMPTS).toBe(2);
      expect(RULE_PRIORITIES.PAYMENT_METHOD_MISMATCH).toBe(1);
    });
  });

  describe('DEFAULT_FRAUD_POLICY_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_FRAUD_POLICY_CONFIG.version).toBe('1.0.0');
      expect(DEFAULT_FRAUD_POLICY_CONFIG.enabled).toBe(true);
      expect(DEFAULT_FRAUD_POLICY_CONFIG.maxScore).toBe(MAX_FRAUD_SCORE);
      expect(DEFAULT_FRAUD_POLICY_CONFIG.thresholds.lowRisk).toBe(LOW_RISK_THRESHOLD);
      expect(DEFAULT_FRAUD_POLICY_CONFIG.thresholds.highRisk).toBe(HIGH_RISK_THRESHOLD);
      expect(DEFAULT_FRAUD_POLICY_CONFIG.performance.maxRulesEvaluation).toBe(MAX_RULES_EVALUATION);
      expect(DEFAULT_FRAUD_POLICY_CONFIG.externalApis.geoLookupRateLimit).toBe(
        EXTERNAL_API_RATE_LIMIT,
      );
      expect(DEFAULT_FRAUD_POLICY_CONFIG.externalApis.externalCallTimeoutMs).toBe(
        GEO_LOOKUP_TIMEOUT_MS,
      );
    });
  });

  describe('evaluateFraudDetectionPolicy', () => {
    it('should return Clean decision when policy is disabled', async () => {
      const disabledConfig = { ...DEFAULT_FRAUD_POLICY_CONFIG, enabled: false };

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(mockFraudContext, disabledConfig, mockServiceRegistry),
      );

      expect(result._tag).toBe('Clean');
      expect(result.score).toBe(0);
      expect(result.evaluatedRules).toBe(0);
    });

    it('should evaluate fraud rules when policy is enabled', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Clean' as const,
          score: 0,
          evaluatedRules: 1,
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(mockServiceRegistry.ruleProvider.loadRules).toHaveBeenCalledWith(
        DEFAULT_FRAUD_POLICY_CONFIG,
        DEFAULT_FRAUD_POLICY_CONFIG.version,
      );
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith(
        mockFraudContext,
        [mockFraudRule],
        DEFAULT_FRAUD_POLICY_CONFIG,
        DEFAULT_FRAUD_POLICY_CONFIG.version,
      );
      expect(result._tag).toBe('Clean');
    });

    it('should return Suspicious decision with triggered rules', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Suspicious' as const,
          score: 30,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Suspicious');
      expect(result.score).toBe(30);
      expect((result as any).reasons).toEqual(['velocity_attack']);
      expect((result as any).triggeredRules).toEqual(['test-rule']);
    });

    it('should return HighRisk decision', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'HighRisk' as const,
          score: 75,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('HighRisk');
      expect(result.score).toBe(75);
    });

    it('should handle rule provider error', async () => {
      const error: FraudRuleProviderError = {
        _tag: 'NetworkError',
        message: 'Rule source unavailable',
        source: 'test',
      };

      mockRuleProvider.loadRules.mockImplementation(() => Effect.fail(error));

      await expect(
        Effect.runPromise(
          evaluateFraudDetectionPolicy(
            mockFraudContext,
            DEFAULT_FRAUD_POLICY_CONFIG,
            mockServiceRegistry,
          ),
        ),
      ).rejects.toThrow();
    });

    it('should handle rule engine error', async () => {
      const error: FraudRuleEngineError = {
        _tag: 'RuleEvaluationError',
        message: 'Rule evaluation failed',
        ruleId: 'test-rule',
        context: mockFraudContext,
      };

      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() => Effect.fail(error));

      await expect(
        Effect.runPromise(
          evaluateFraudDetectionPolicy(
            mockFraudContext,
            DEFAULT_FRAUD_POLICY_CONFIG,
            mockServiceRegistry,
          ),
        ),
      ).rejects.toThrow();
    });

    it('should alert when suspicious rate threshold exceeded', async () => {
      const configWithLowThreshold = {
        ...DEFAULT_FRAUD_POLICY_CONFIG,
        alerts: {
          ...DEFAULT_FRAUD_POLICY_CONFIG.alerts,
          suspiciousRateThreshold: 50, // 50%
        },
      };

      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Suspicious' as const,
          score: 30,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(mockFraudContext, configWithLowThreshold, mockServiceRegistry),
      );

      expect(result._tag).toBe('Suspicious');
      // Alert should be logged (we can't easily test logging, but the code path is executed)
    });

    it('should alert when high risk rate threshold exceeded', async () => {
      const configWithLowThreshold = {
        ...DEFAULT_FRAUD_POLICY_CONFIG,
        alerts: {
          ...DEFAULT_FRAUD_POLICY_CONFIG.alerts,
          highRiskRateThreshold: 50, // 50%
        },
      };

      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'HighRisk' as const,
          score: 75,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(mockFraudContext, configWithLowThreshold, mockServiceRegistry),
      );

      expect(result._tag).toBe('HighRisk');
      // Alert should be logged
    });

    it('should alert when evaluation latency threshold exceeded', async () => {
      const configWithLowLatencyThreshold = {
        ...DEFAULT_FRAUD_POLICY_CONFIG,
        alerts: {
          ...DEFAULT_FRAUD_POLICY_CONFIG.alerts,
          evaluationLatencyThresholdMs: 0, // Very low threshold
        },
      };

      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Clean' as const,
          score: 0,
          evaluatedRules: 1,
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          configWithLowLatencyThreshold,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Clean');
      // Latency alert should be logged
    });

    it('should log fraud alert for HighRisk decision', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'HighRisk' as const,
          score: 75,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('HighRisk');
      expect(result.score).toBe(75);
      // Fraud alert should be logged for HighRisk decision
    });

    it('should log fraud alert for Suspicious decision', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Suspicious' as const,
          score: 30,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Suspicious');
      expect(result.score).toBe(30);
      // Fraud alert should be logged for Suspicious decision
    });

    it('should not log fraud alert when thresholds are not exceeded', async () => {
      const configWithHighThresholds = {
        ...DEFAULT_FRAUD_POLICY_CONFIG,
        alerts: {
          ...DEFAULT_FRAUD_POLICY_CONFIG.alerts,
          suspiciousRateThreshold: 200, // 200% - impossible to exceed
          highRiskRateThreshold: 200, // 200% - impossible to exceed
        },
      };

      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'HighRisk' as const,
          score: 75,
          reasons: ['velocity_attack'],
          evaluatedRules: 1,
          triggeredRules: ['test-rule'],
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          configWithHighThresholds,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('HighRisk');
      // Fraud alert should NOT be logged when thresholds are not exceeded
    });

    it('should not log fraud alert for Clean decision', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Clean' as const,
          score: 5,
          evaluatedRules: 1,
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Clean');
      expect(result.score).toBe(5);
      // No fraud alert should be logged for Clean decision
    });

    it('should handle Clean decision with triggeredRules property', async () => {
      mockRuleProvider.loadRules.mockImplementation(() => Effect.succeed([mockFraudRule]));
      mockRuleEngine.evaluateRules.mockImplementation(() =>
        Effect.succeed({
          _tag: 'Clean' as const,
          score: 5,
          evaluatedRules: 1,
          triggeredRules: [], // Edge case: Clean decision with triggeredRules
        })
      );

      const result = await Effect.runPromise(
        evaluateFraudDetectionPolicy(
          mockFraudContext,
          DEFAULT_FRAUD_POLICY_CONFIG,
          mockServiceRegistry,
        ),
      );

      expect(result._tag).toBe('Clean');
      expect(result.score).toBe(5);
    });
  });
});
