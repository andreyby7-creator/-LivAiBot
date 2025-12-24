/**
 * @file tokenRetryPolicy.test.ts - Полное тестирование политики повторных попыток токенов
 */

import { describe, it, expect, beforeEach } from 'vitest';

import type {
  TokenRetryPolicyContext,
  UserQuotaContext,
} from '../../../../../../src/errors/services/ai-service/policies/tokenRetryPolicy.js';

import {
  shouldRetryOnTokenExhaustion,
  evaluateTokenRetryPolicy,
  getOptimalRetryDelay,
  canRetryWithTokens,
  createTokenRetryPolicyError,
  isTokenRetryPolicyError,
  checkQuotaStatus,
  checkUserQuotas,
  isApproachingQuotaLimit,
  determineRetryStrategy,
  calculateExponentialBackoffDelay,
  calculateQuotaAwareDelay,
  createRetryResult,
  formatDelayMessage,
  suggestAlternativeModel,
  TokenType,
  TokenAlternativeReason,
  RETRY_RECOMMENDATIONS,
  DELAY_MESSAGES,
  DEFAULT_MODEL_ALTERNATIVES,
  QUOTA_CHECKS,
  BASE_RETRY_DELAY_MS,
  BACKOFF_MULTIPLIER,
  MAX_RETRY_DELAY_MS,
  QUOTA_APPROACH_DELAY_FACTOR,
  DEFAULT_MODEL_FALLBACK,
  DefaultModelAlternativesService,
  type TokenRetryPolicyResult,
} from '../../../../../../src/errors/services/ai-service/policies/tokenRetryPolicy.js';

/* ========================== MOCKS ========================== */

const mockUserQuotaContext: UserQuotaContext = {
  planTier: 'premium',
  dailyQuota: 10000,
  dailyUsed: 8000,
  hourlyQuota: 1000,
  hourlyUsed: 700,
  monthlyQuota: 300000,
  monthlyUsed: 250000,
};

const mockTokenRetryContext: TokenRetryPolicyContext = {
  type: 'token_retry_policy',
  modelId: 'yandexgpt-pro',
  currentTokens: 500,
  maxAvailableTokens: 1000,
  tokensUsed: 500,
  attemptNumber: 0,
  maxAttempts: 3,
  tokenType: TokenType.INPUT,
  userQuotaContext: mockUserQuotaContext,
};

/* ========================== TESTS ========================== */

describe('TokenRetryPolicy', () => {
  describe('shouldRetryOnTokenExhaustion', () => {
    it('should allow immediate retry on first attempt with sufficient tokens', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 0,
        currentTokens: 500,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toBe('success');
      expect(result.delayMs).toBe(0);
    });

    it('should prevent retry when no tokens available', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        currentTokens: 0,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('insufficient_tokens');
      expect(result.recommendations).toEqual([
        'Insufficient tokens available',
        'Wait for token regeneration or upgrade plan',
        'Consider using a lighter model',
      ]);
    });

    it('should prevent retry when max attempts reached', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 3,
        maxAttempts: 3,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should prevent retry when daily quota exceeded', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        userQuotaContext: {
          ...mockUserQuotaContext,
          dailyUsed: 9600, // 96% of quota
        },
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('quota_exhausted');
      expect(result.recommendations).toContain('Daily quota 96.0% used');
    });

    it('should use exponential backoff for subsequent attempts', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThan(1000);
      expect(result.reason).toBe('success');
    });

    it('should use quota-aware delay when approaching limits', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
        userQuotaContext: {
          ...mockUserQuotaContext,
          dailyUsed: 8500, // 85% of quota
        },
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThan(1000);
      expect(result.reason).toBe('success');
    });

    it('should suggest alternative model after multiple failures when quota is low', async () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50% - below strategyThresholdPercent (80%)
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20% - below strategyThresholdPercent (70%)
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33% - below strategyThresholdPercent (95%)
      };

      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 2,
        userQuotaContext: lowUsageContext,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.alternativeModel).toBeDefined();
      expect(result.reason).toBe('success');
    });
  });

  describe('evaluateTokenRetryPolicy', () => {
    it('should evaluate policy and cache result', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 0,
      };

      const result1 = await evaluateTokenRetryPolicy(context);
      const result2 = await evaluateTokenRetryPolicy(context);

      expect(result1.shouldRetry).toBe(true);
      expect(result1).toBe(result2); // Same cached result
    });
  });

  describe('getOptimalRetryDelay', () => {
    it('should return delay from evaluated policy', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
      };

      const delay = await getOptimalRetryDelay(context);

      expect(delay).toBeGreaterThan(1000);
    });

    it('should return 0 when retry not allowed', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        currentTokens: 0,
      };

      const delay = await getOptimalRetryDelay(context);

      expect(delay).toBe(0);
    });
  });

  describe('canRetryWithTokens', () => {
    it('should return true when retry is allowed', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 0,
      };

      const canRetry = await canRetryWithTokens(context);

      expect(canRetry).toBe(true);
    });

    it('should return false when retry is not allowed', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        currentTokens: 0,
      };

      const canRetry = await canRetryWithTokens(context);

      expect(canRetry).toBe(false);
    });
  });

  describe('checkQuotaStatus', () => {
    it('should return canRetry true and isApproachingLimit false for normal usage', () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50% usage - below strategyThresholdPercent (80%)
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20% usage - below strategyThresholdPercent (70%)
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33% usage - below strategyThresholdPercent (95%)
      };

      const result = checkQuotaStatus(lowUsageContext);

      expect(result.canRetry).toBe(true);
      expect(result.isApproachingLimit).toBe(false);
      expect(result.recommendations).toEqual([]);
    });

    it('should return canRetry false when quota exceeded', () => {
      const result = checkQuotaStatus({
        ...mockUserQuotaContext,
        dailyUsed: 9600, // 96% usage
      });

      expect(result.canRetry).toBe(false);
      expect(result.isApproachingLimit).toBe(true);
      expect(result.recommendations).toContain('Daily quota 96.0% used');
    });

    it('should return isApproachingLimit true when approaching threshold', () => {
      const result = checkQuotaStatus({
        ...mockUserQuotaContext,
        dailyUsed: 8200, // 82% usage (above 80% threshold)
      });

      expect(result.canRetry).toBe(true);
      expect(result.isApproachingLimit).toBe(true);
    });

    it('should handle undefined quota context', () => {
      const result = checkQuotaStatus(undefined);

      expect(result.canRetry).toBe(true);
      expect(result.isApproachingLimit).toBe(false);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('checkUserQuotas (legacy)', () => {
    it('should delegate to checkQuotaStatus', () => {
      const quotaStatus = checkQuotaStatus(mockUserQuotaContext);
      const userQuotas = checkUserQuotas(mockUserQuotaContext);

      expect(userQuotas.canRetry).toBe(quotaStatus.canRetry);
      expect(userQuotas.recommendations).toStrictEqual(quotaStatus.recommendations);
    });
  });

  describe('isApproachingQuotaLimit (legacy)', () => {
    it('should delegate to checkQuotaStatus', () => {
      const quotaStatus = checkQuotaStatus(mockUserQuotaContext);
      const approaching = isApproachingQuotaLimit(mockUserQuotaContext);

      expect(approaching).toBe(quotaStatus.isApproachingLimit);
    });
  });

  describe('determineRetryStrategy', () => {
    it('should return immediate for first attempt', () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 0,
      };

      const strategy = determineRetryStrategy(context);

      expect(strategy).toBe('immediate');
    });

    it('should return quota_aware when approaching quota limits', () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
        userQuotaContext: {
          ...mockUserQuotaContext,
          dailyUsed: 8500, // Above threshold
        },
      };

      const strategy = determineRetryStrategy(context);

      expect(strategy).toBe('quota_aware');
    });

    it('should return model_fallback after multiple attempts when not approaching quota', () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50% - below strategyThresholdPercent (80%)
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20% - below strategyThresholdPercent (70%)
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33% - below strategyThresholdPercent (95%)
      };

      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 2,
        userQuotaContext: lowUsageContext,
      };

      const strategy = determineRetryStrategy(context);

      expect(strategy).toBe('model_fallback');
    });

    it('should return exponential_backoff for normal cases', () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50% - below strategyThresholdPercent (80%)
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20% - below strategyThresholdPercent (70%)
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33% - below strategyThresholdPercent (95%)
      };

      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
        userQuotaContext: lowUsageContext,
      };

      const strategy = determineRetryStrategy(context);

      expect(strategy).toBe('exponential_backoff');
    });
  });

  describe('calculateExponentialBackoffDelay', () => {
    it('should calculate correct delay with backoff multiplier', () => {
      expect(calculateExponentialBackoffDelay(0)).toBe(1000); // 1 * 2^0 * 1000
      expect(calculateExponentialBackoffDelay(1)).toBe(2000); // 1 * 2^1 * 1000
      expect(calculateExponentialBackoffDelay(2)).toBe(4000); // 1 * 2^2 * 1000
    });

    it('should not exceed MAX_RETRY_DELAY_MS', () => {
      const largeAttempt = calculateExponentialBackoffDelay(10);
      expect(largeAttempt).toBe(30000); // MAX_RETRY_DELAY_MS
    });
  });

  describe('calculateQuotaAwareDelay', () => {
    it('should return base delay when no quota context', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };
      const delay = calculateQuotaAwareDelay(context, undefined);

      expect(delay).toBe(1500); // BASE_DELAY * QUOTA_FACTOR
    });

    it('should apply different multipliers based on exhaustion level', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      // Low exhaustion (< 70%)
      const lowUsageContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 5000, // 50%
        hourlyUsed: 200, // 20%
        monthlyUsed: 100000, // 33%
      };
      const lowDelay = calculateQuotaAwareDelay(context, lowUsageContext);
      expect(lowDelay).toBe(1200); // 1.2x multiplier

      // Medium exhaustion (70-85%) - using mockUserQuotaContext with 80%
      const mediumDelay = calculateQuotaAwareDelay(context, mockUserQuotaContext); // 80%
      expect(mediumDelay).toBe(1800); // 1.8x multiplier

      // High exhaustion (85-95%)
      const highUsageContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 9000, // 90%
      };
      const highDelay = calculateQuotaAwareDelay(context, highUsageContext);
      expect(highDelay).toBe(2500); // 2.5x multiplier

      // Critical exhaustion (>95%)
      const criticalUsageContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 9700, // 97%
      };
      const criticalDelay = calculateQuotaAwareDelay(context, criticalUsageContext);
      expect(criticalDelay).toBe(3000); // 3.0x multiplier
    });
  });

  describe('createRetryResult', () => {
    it('should create result with all fields', () => {
      const result = createRetryResult({
        shouldRetry: true,
        reason: 'success',
        delayMs: 1000,
        alternativeModel: 'model-x',
        recommendations: ['test message'],
      });

      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toBe('success');
      expect(result.delayMs).toBe(1000);
      expect(result.alternativeModel).toBe('model-x');
      expect(result.recommendations).toEqual(['test message']);
    });

    it('should create result with optional fields omitted', () => {
      const result = createRetryResult({
        shouldRetry: false,
        reason: 'max_attempts_reached',
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
      expect(result.delayMs).toBeUndefined();
      expect(result.alternativeModel).toBeUndefined();
      expect(result.recommendations).toBeUndefined();
    });

    it('should handle readonly arrays', () => {
      const recommendations = ['msg1', 'msg2'] as const;
      const result = createRetryResult({
        shouldRetry: true,
        reason: 'success',
        recommendations,
      });

      expect(result.recommendations).toEqual(['msg1', 'msg2']);
    });
  });

  describe('formatDelayMessage', () => {
    it('should format message with strategy', () => {
      const message = formatDelayMessage(5, 'exponential backoff');
      expect(message).toBe('Retrying in 5 seconds (exponential backoff)');
    });

    it('should format message without strategy', () => {
      const message = formatDelayMessage(3, '');
      expect(message).toBe('Retrying in 3 seconds');
    });
  });

  describe('suggestAlternativeModel', () => {
    it('should return alternative model from service', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        alternativesService: {
          loadAlternatives: async () => ({
            primaryModel: 'yandexgpt-pro',
            alternatives: [{
              modelId: 'yandexgpt-lite',
              compatibilityScore: 0.9,
              reason: TokenAlternativeReason.TOKEN_EFFICIENCY,
              tokenSavingsPercent: 30,
            }],
          }),
        },
      };

      const alternative = await suggestAlternativeModel(context);

      expect(alternative).toBe('yandexgpt-lite');
    });

    it('should fallback to default model when service fails', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        alternativesService: {
          loadAlternatives: async () => { throw new Error('Service error'); },
        },
      };

      const alternative = await suggestAlternativeModel(context);

      expect(alternative).toBe('yandexgpt-lite'); // Default fallback
    });

    it('should use modelAlternativesConfig when service fails', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        modelAlternativesConfig: {
          'yandexgpt-pro': 'custom-model',
        },
        alternativesService: {
          loadAlternatives: async () => { throw new Error('Service unavailable'); },
        },
      };

      const alternative = await suggestAlternativeModel(context);

      expect(alternative).toBe('custom-model');
    });

    it('should fallback to default when no config and service fails', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        // No modelAlternativesConfig
        alternativesService: {
          loadAlternatives: async () => { throw new Error('Service unavailable'); },
        },
      };

      const alternative = await suggestAlternativeModel(context);

      expect(alternative).toBe('yandexgpt-lite'); // DEFAULT_MODEL_FALLBACK
    });
  });

  describe('createTokenRetryPolicyError', () => {
    it('should create valid error with all fields', () => {
      const mockResult: TokenRetryPolicyResult = {
        shouldRetry: false,
        reason: 'quota_exhausted',
        recommendations: ['test'],
      };

      const error = createTokenRetryPolicyError(
        'TOKEN_RETRY_ERROR',
        mockTokenRetryContext,
        mockResult,
        'Test error message',
      );

      expect(error._tag).toBe('TokenRetryPolicyError');
      expect(error.category).toBe('BUSINESS');
      expect(error.severity).toBe('medium');
      expect(error.origin).toBe('SERVICE');
      expect(error.code).toBe('TOKEN_RETRY_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.context).toBe(mockTokenRetryContext);
      expect(error.result).toBe(mockResult);
      expect(error.timestamp).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('isTokenRetryPolicyError', () => {
    it('should return true for valid error', () => {
      const error = createTokenRetryPolicyError(
        'TEST_ERROR',
        mockTokenRetryContext,
        { shouldRetry: false, reason: 'insufficient_tokens' },
        'Test',
      );

      expect(isTokenRetryPolicyError(error)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isTokenRetryPolicyError({})).toBe(false);
      expect(isTokenRetryPolicyError(null)).toBe(false);
      expect(isTokenRetryPolicyError({ _tag: 'OtherError' })).toBe(false);
    });
  });

  describe('Constants and enums', () => {
    it('should have correct TokenType enum values', () => {
      expect(TokenType.INPUT).toBe('input');
      expect(TokenType.OUTPUT).toBe('output');
      expect(TokenType.TOTAL).toBe('total');
    });

    it('should have correct TokenAlternativeReason enum values', () => {
      expect(TokenAlternativeReason.TOKEN_EFFICIENCY).toBe('token_efficiency');
      expect(TokenAlternativeReason.SIMILAR_CAPABILITIES).toBe('similar_capabilities');
      expect(TokenAlternativeReason.FALLBACK_CAPACITY).toBe('fallback_capacity');
      expect(TokenAlternativeReason.COST_OPTIMIZATION).toBe('cost_optimization');
    });

    it('should have correct RETRY_RECOMMENDATIONS structure', () => {
      // These are used in various test scenarios, just verify they exist
      expect(typeof RETRY_RECOMMENDATIONS.maxAttempts).toBe('object');
      expect(typeof RETRY_RECOMMENDATIONS.insufficientTokens).toBe('object');
      expect(typeof RETRY_RECOMMENDATIONS.quotaApproaching).toBe('object');
      expect(typeof RETRY_RECOMMENDATIONS.modelFallback).toBe('object');
    });

    it('should have correct DELAY_MESSAGES structure', () => {
      // Test the message formatters
      expect(typeof DELAY_MESSAGES.exponentialBackoff(5)).toBe('string');
      expect(typeof DELAY_MESSAGES.quotaAware(3)).toBe('string');
      expect(typeof DELAY_MESSAGES.modelSwitch('model-x')).toBe('string');

      expect(DELAY_MESSAGES.exponentialBackoff(5)).toContain('5 seconds');
      expect(DELAY_MESSAGES.quotaAware(3)).toContain('quota-aware delay');
      expect(DELAY_MESSAGES.modelSwitch('model-x')).toContain('model-x');
    });

    it('should have correct DEFAULT_MODEL_ALTERNATIVES', () => {
      // Verify the fallback mapping exists
      expect(typeof DEFAULT_MODEL_ALTERNATIVES).toBe('object');
      expect(DEFAULT_MODEL_ALTERNATIVES['yandexgpt-pro']).toBe('yandexgpt-lite');
    });
  });

  describe('DefaultModelAlternativesService', () => {
    let service: DefaultModelAlternativesService;

    beforeEach(() => {
      service = new DefaultModelAlternativesService();
    });

    it('should load alternatives for yandexgpt-pro', async () => {
      const result = await service.loadAlternatives('yandexgpt-pro', TokenType.INPUT);

      expect(result.primaryModel).toBe('yandexgpt-pro');
      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives[0].modelId).toBe('yandexgpt-lite');
      expect(result.alternatives[0].compatibilityScore).toBeGreaterThan(0.8);
    });

    it('should load alternatives for yandexgpt', async () => {
      const result = await service.loadAlternatives('yandexgpt', TokenType.OUTPUT);

      expect(result.primaryModel).toBe('yandexgpt');
      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives.some(alt => alt.modelId === 'yandexgpt-lite')).toBe(true);
    });

    it('should load alternatives for unknown model', async () => {
      const result = await service.loadAlternatives('unknown-model', TokenType.INPUT);

      expect(result.primaryModel).toBe('unknown-model');
      expect(result.alternatives).toHaveLength(1);
      expect(result.alternatives[0].modelId).toBe(DEFAULT_MODEL_FALLBACK);
    });

    it('should calculate base compatibility scores correctly', () => {
      // Test INPUT token type boosts for pro->lite
      const inputScore = service.calculateBaseScore('yandexgpt-pro', 'yandexgpt-lite', TokenType.INPUT);
      const outputScore = service.calculateBaseScore('yandexgpt-pro', 'yandexgpt-lite', TokenType.OUTPUT);

      expect(inputScore).toBeGreaterThan(outputScore); // INPUT should have higher score for pro->lite

      // Test OUTPUT boost for lite->pro
      const outputScore2 = service.calculateBaseScore('yandexgpt-lite', 'yandexgpt-pro', TokenType.OUTPUT);
      const inputScore2 = service.calculateBaseScore('yandexgpt-lite', 'yandexgpt-pro', TokenType.INPUT);

      expect(outputScore2).toBeGreaterThan(inputScore2); // OUTPUT should have higher score for lite->pro
    });

    it('should calculate base score for unknown model combinations', () => {
      const score = service.calculateBaseScore('unknown1', 'unknown2', TokenType.INPUT);

      expect(score).toBe(0.7); // Default fallback score from compatibilityMatrix
    });

    it('should sort alternatives by compatibility score', async () => {
      const result = await service.loadAlternatives('yandexgpt-pro', TokenType.INPUT);

      // Should be sorted in descending order
      for (let i = 0; i < result.alternatives.length - 1; i++) {
        expect(result.alternatives[i].compatibilityScore).toBeGreaterThanOrEqual(
          result.alternatives[i + 1].compatibilityScore
        );
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete retry flow with quota-aware strategy', async () => {
      // Scenario: High quota usage triggers quota-aware delay
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1, // First retry attempt
        userQuotaContext: {
          ...mockUserQuotaContext,
          dailyUsed: 9000, // 90% - above strategyThresholdPercent (80%)
        },
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThan(1000); // Higher delay due to quota awareness
      expect((result.recommendations ?? []).some(rec => rec.includes('quota-aware delay'))).toBe(true);
    });

    it('should handle quota-aware delay with multiple quota types', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
        userQuotaContext: {
          ...mockUserQuotaContext,
          dailyUsed: 8800, // 88% - should trigger quota-aware
          hourlyUsed: 800,  // 80% - also high
        },
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThan(2000); // Higher delay due to quota awareness
      expect((result.recommendations ?? []).some(rec => rec.includes('quota-aware delay'))).toBe(true);
    });

    it('should prevent retry when both token and quota limits exceeded', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        currentTokens: 0, // No tokens
        userQuotaContext: {
          ...mockUserQuotaContext,
          dailyUsed: 9600, // Quota exceeded
        },
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('insufficient_tokens'); // Token check happens first
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined context fields gracefully', async () => {
      const minimalContext: TokenRetryPolicyContext = {
        type: 'token_retry_policy',
        modelId: 'test-model',
        currentTokens: 100,
        maxAvailableTokens: 1000,
        tokensUsed: 0,
        attemptNumber: 0,
        maxAttempts: 3,
        tokenType: TokenType.INPUT,
      };

      const result = await shouldRetryOnTokenExhaustion(minimalContext);

      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toBe('success');
    });

    it('should handle empty alternatives from service', async () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50% - below strategyThresholdPercent (80%)
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20% - below strategyThresholdPercent (70%)
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33% - below strategyThresholdPercent (95%)
      };

      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 2,
        userQuotaContext: lowUsageContext,
        alternativesService: {
          loadAlternatives: async () => ({
            primaryModel: 'yandexgpt-pro',
            alternatives: [], // Empty alternatives
          }),
        },
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.alternativeModel).toBeDefined(); // Should fallback to default model
    });

    it('should handle all quota types at limit', () => {
      const criticalQuota: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 9500,    // 95% - block
        hourlyQuota: 1000,
        hourlyUsed: 900,    // 90% - block
        monthlyQuota: 300000,
        monthlyUsed: 297000, // 99% - block
      };

      const result = checkQuotaStatus(criticalQuota);

      expect(result.canRetry).toBe(false);
      expect(result.isApproachingLimit).toBe(true);
    });

    it('should block retry when daily quota exceeds threshold', () => {
      const dailyExceeded: UserQuotaContext = {
        planTier: 'free',
        dailyQuota: 1000,
        dailyUsed: 951, // 95.1% - exceeds 95% threshold
        hourlyQuota: 100,
        hourlyUsed: 50, // 50% - below threshold
        monthlyQuota: 10000,
        monthlyUsed: 2000, // 20% - below threshold
      };

      const result = checkQuotaStatus(dailyExceeded);

      expect(result.canRetry).toBe(false);
      expect(result.isApproachingLimit).toBe(true);
      expect(result.recommendations.some(rec => rec.includes('95.1% used'))).toBe(true);
    });

    it('should block retry when hourly quota exceeds threshold', () => {
      const hourlyExceeded: UserQuotaContext = {
        planTier: 'free',
        dailyQuota: 1000,
        dailyUsed: 500, // 50% - below threshold
        hourlyQuota: 100,
        hourlyUsed: 91, // 91% - exceeds 90% threshold
        monthlyQuota: 10000,
        monthlyUsed: 2000, // 20% - below threshold
      };

      const result = checkQuotaStatus(hourlyExceeded);

      expect(result.canRetry).toBe(false);
      expect(result.isApproachingLimit).toBe(true);
      expect(result.recommendations.some(rec => rec.includes('91.0% used'))).toBe(true);
    });

    it('should block retry when monthly quota exceeds threshold', () => {
      const monthlyExceeded: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50% - below threshold
        hourlyQuota: 1000,
        hourlyUsed: 500, // 50% - below threshold
        monthlyQuota: 300000,
        monthlyUsed: 297001, // 99.0003% - exceeds 98% threshold
      };

      const result = checkQuotaStatus(monthlyExceeded);

      expect(result.canRetry).toBe(false);
      expect(result.isApproachingLimit).toBe(true);
      expect(result.recommendations.some(rec => rec.includes('99.0% used'))).toBe(true);
    });

    it('should handle partial quota data (some quotas undefined)', () => {
      const partialQuota: UserQuotaContext = {
        planTier: 'free',
        dailyQuota: 1000,
        dailyUsed: 950, // 95% - exceeds threshold (95% block)
        hourlyQuota: undefined, // No hourly limit
        hourlyUsed: undefined,
        monthlyQuota: 10000,
        monthlyUsed: 2000, // 20% - below threshold
      };

      const result = checkQuotaStatus(partialQuota);

      expect(result.canRetry).toBe(false); // Daily quota exceeded
      expect(result.isApproachingLimit).toBe(true);
      expect((result.recommendations ?? []).some(rec => rec.includes('95.0% used'))).toBe(true);
    });

    it('should handle zero quota values gracefully', () => {
      const zeroQuota: UserQuotaContext = {
        planTier: 'free',
        dailyQuota: 0,
        dailyUsed: 0,
        hourlyQuota: 1000,
        hourlyUsed: 100, // 10%
        monthlyQuota: 0,
        monthlyUsed: 0,
      };

      const result = checkQuotaStatus(zeroQuota);

      expect(result.canRetry).toBe(true);
      expect(result.isApproachingLimit).toBe(false);
    });

    it('should handle very high attempt numbers', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 100, // Very high attempt number
        maxAttempts: 50,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should handle attemptNumber exactly at MAX_RETRY_ATTEMPTS limit', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 5, // MAX_RETRY_ATTEMPTS = 5
        maxAttempts: 10, // But this is higher than MAX_RETRY_ATTEMPTS
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should handle attemptNumber exceeding MAX_RETRY_ATTEMPTS', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 6, // > MAX_RETRY_ATTEMPTS = 5
        maxAttempts: 10,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should respect maxAttempts when lower than MAX_RETRY_ATTEMPTS', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 2, // Below MAX_RETRY_ATTEMPTS = 5
        maxAttempts: 2,   // But at maxAttempts limit
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should handle MAX_RETRY_ATTEMPTS when maxAttempts is higher', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 5, // Exactly MAX_RETRY_ATTEMPTS = 5
        maxAttempts: 10,  // Higher than MAX_RETRY_ATTEMPTS
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should handle negative token values', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        currentTokens: -10, // Negative tokens
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('insufficient_tokens');
    });
  });

  describe('Strategy handlers coverage', () => {
    it('should execute immediate strategy', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 0,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(0);
      expect(result.reason).toBe('success');
    });

    it('should execute exponential_backoff strategy', async () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50%
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20%
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33%
      };

      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
        userQuotaContext: lowUsageContext,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThan(1000);
      expect((result.recommendations ?? []).some(rec => rec.includes('exponential backoff'))).toBe(true);
    });

    it('should execute quota_aware strategy', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 1,
        userQuotaContext: mockUserQuotaContext, // 80% usage triggers quota_aware
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThan(1000);
      expect((result.recommendations ?? []).some(rec => rec.includes('quota-aware delay'))).toBe(true);
    });

    it('should execute model_fallback strategy', async () => {
      const lowUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 5000, // 50%
        hourlyQuota: 1000,
        hourlyUsed: 200, // 20%
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33%
      };

      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 2,
        userQuotaContext: lowUsageContext,
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.alternativeModel).toBeDefined();
      expect((result.recommendations ?? []).some(rec => rec.includes('alternative model'))).toBe(true);
    });
  });

  describe('Quota exhaustion levels', () => {
    it('should handle critical exhaustion (>95%)', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      const criticalContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 9700, // 97%
      };

      const delay = calculateQuotaAwareDelay(context, criticalContext);
      expect(delay).toBe(3000); // 3.0x multiplier
    });

    it('should handle high exhaustion (85-95%)', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      const highContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 9000, // 90%
      };

      const delay = calculateQuotaAwareDelay(context, highContext);
      expect(delay).toBe(2500); // 2.5x multiplier
    });

    it('should handle medium exhaustion (70-85%)', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      const mediumContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 8000, // 80%
      };

      const delay = calculateQuotaAwareDelay(context, mediumContext);
      expect(delay).toBe(1800); // 1.8x multiplier
    });

    it('should handle low exhaustion (<70%)', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      const lowContext: UserQuotaContext = {
        ...mockUserQuotaContext,
        dailyUsed: 5000, // 50%
        hourlyUsed: 200, // 20%
        monthlyUsed: 100000, // 33%
      };

      const delay = calculateQuotaAwareDelay(context, lowContext);
      expect(delay).toBe(1200); // 1.2x multiplier
    });

    it('should handle mixed exhaustion levels (take max)', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      const mixedContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 6000, // 60% - low
        hourlyQuota: 1000,
        hourlyUsed: 850, // 85% - high
        monthlyQuota: 300000,
        monthlyUsed: 100000, // 33% - low
      };

      const delay = calculateQuotaAwareDelay(context, mixedContext);
      expect(delay).toBe(2500); // Takes max exhaustion (85% -> 2.5x)
    });

    it('should handle all quotas at zero usage (maxExhaustion = 0)', () => {
      const context: TokenRetryPolicyContext = { ...mockTokenRetryContext };

      const zeroUsageContext: UserQuotaContext = {
        planTier: 'premium',
        dailyQuota: 10000,
        dailyUsed: 0, // 0%
        hourlyQuota: 1000,
        hourlyUsed: 0, // 0%
        monthlyQuota: 300000,
        monthlyUsed: 0, // 0%
      };

      const delay = calculateQuotaAwareDelay(context, zeroUsageContext);
      expect(delay).toBe(1200); // 1.2x multiplier (lowest level)
    });
  });

  describe('Alternative model suggestion edge cases', () => {
    it('should handle service returning alternatives with zero compatibility', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        alternativesService: {
          loadAlternatives: async () => ({
            primaryModel: 'yandexgpt-pro',
            alternatives: [{
              modelId: 'bad-model',
              compatibilityScore: 0, // Zero compatibility
              reason: TokenAlternativeReason.TOKEN_EFFICIENCY,
              tokenSavingsPercent: 0,
            }, {
              modelId: 'good-model',
              compatibilityScore: 0.9, // High compatibility
              reason: TokenAlternativeReason.SIMILAR_CAPABILITIES,
              tokenSavingsPercent: 50,
            }],
          }),
        },
      };

      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBe('good-model'); // Should pick highest score
    });

    it('should handle unknown model in alternatives config', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        modelId: 'unknown-model',
        alternativesService: {
          loadAlternatives: async () => { throw new Error('Unknown model'); },
        },
      };

      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBe('yandexgpt-lite'); // DEFAULT_MODEL_FALLBACK
    });

    it('should prefer service alternatives over config', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        modelAlternativesConfig: {
          'yandexgpt-pro': 'config-model',
        },
        alternativesService: {
          loadAlternatives: async () => ({
            primaryModel: 'yandexgpt-pro',
            alternatives: [{
              modelId: 'service-model',
              compatibilityScore: 0.8,
              reason: TokenAlternativeReason.TOKEN_EFFICIENCY,
              tokenSavingsPercent: 30,
            }],
          }),
        },
      };

      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBe('service-model'); // Service takes precedence
    });
  });

  describe('Error handling and logging', () => {
    it('should handle logger errors gracefully', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        logger: {
          warn: () => { throw new Error('Logger error'); },
          error: () => {},
          info: () => {},
        },
        alternativesService: {
          loadAlternatives: async () => { throw new Error('Service error'); },
        },
      };

      // Logger errors should not break the flow - function should still work
      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBe('yandexgpt-lite'); // Should still return fallback despite logger error
    });

    it('should handle malformed service response', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        alternativesService: {
          loadAlternatives: async () => ({
            primaryModel: 'yandexgpt-pro',
            alternatives: null as any, // Malformed response
          }),
        },
      };

      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBe('yandexgpt-lite'); // Should fallback gracefully
    });

    it('should use default logger when no logger provided', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        // No logger provided - should use defaultLogger
        alternativesService: {
          loadAlternatives: async () => { throw new Error('Service error'); },
        },
      };

      // This should trigger defaultLogger.warn usage
      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBe('yandexgpt-lite'); // Should fallback to default
    });

    it('should use default alternatives service when no service provided', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        // No alternativesService provided - should use defaultAlternativesService
      };

      const alternative = await suggestAlternativeModel(context);
      expect(alternative).toBeDefined(); // Should get some alternative
    });

    it('should handle division by zero in quota calculations', () => {
      const zeroQuota: UserQuotaContext = {
        planTier: 'free',
        dailyQuota: 0, // Zero quota - should not divide by zero
        dailyUsed: 0,
        hourlyQuota: 100,
        hourlyUsed: 10,
        monthlyQuota: 0, // Another zero quota
        monthlyUsed: 0,
      };

      const result = checkQuotaStatus(zeroQuota);

      expect(result.canRetry).toBe(true); // Should not crash
      expect(result.isApproachingLimit).toBe(false);
    });

    it('should handle negative quota values gracefully', () => {
      const negativeQuota: UserQuotaContext = {
        planTier: 'free',
        dailyQuota: 1000,
        dailyUsed: -100, // Negative usage - should handle gracefully
        hourlyQuota: 100,
        hourlyUsed: 50,
        monthlyQuota: 10000,
        monthlyUsed: 5000,
      };

      const result = checkQuotaStatus(negativeQuota);

      expect(result.canRetry).toBe(true); // Negative usage should not block
      expect(result.isApproachingLimit).toBe(false);
    });

    it('should handle empty quota context completely', () => {
      const emptyQuota = {} as UserQuotaContext; // Empty object

      const result = checkQuotaStatus(emptyQuota);

      expect(result.canRetry).toBe(true);
      expect(result.isApproachingLimit).toBe(false);
      expect(result.recommendations).toEqual([]);
    });

    it('should handle MAX_RETRY_ATTEMPTS exactly', async () => {
      const context: TokenRetryPolicyContext = {
        ...mockTokenRetryContext,
        attemptNumber: 5, // MAX_RETRY_ATTEMPTS = 5
        maxAttempts: 10, // Higher than MAX_RETRY_ATTEMPTS
      };

      const result = await shouldRetryOnTokenExhaustion(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });
  });
});
