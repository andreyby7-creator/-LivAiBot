import { describe, expect, it } from 'vitest';

import {
  AI_VENDOR,
  createBurstLimitError,
  createPerDayLimitError,
  createPerHourLimitError,
  createPerMinuteLimitError,
  createQuotaExhaustionError,
  createRateLimitError,
  getRateLimitRecoveryStrategy,
  getRateLimitUsagePercentage,
  getRecommendedRetryDelay,
  getTimeUntilReset,
  isHardLimit,
  isRateLimitCritical,
  isRateLimitRetriable,
} from '../../../../../../src/errors/services/ai-service/infrastructure/index.js';
import type {
  RateLimitError,
  RateLimitErrorContext,
  RateLimitKind,
  RateLimitRecoveryStrategy,
  RateLimitUnit,
} from '../../../../../../src/errors/services/ai-service/infrastructure/index.js';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../../src/errors/base/ErrorConstants.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock RateLimitErrorContext для тестов */
function createMockRateLimitContext(
  overrides: Partial<RateLimitErrorContext> = {},
): RateLimitErrorContext {
  return {
    type: 'yandex_ai_rate_limit',
    vendor: AI_VENDOR,
    limitKind: 'per_minute',
    recoveryStrategy: 'exponential_backoff',
    unit: 'requests',
    currentUsage: 120,
    limit: 100,
    excess: 20,
    windowMs: 60000,
    resetTimeMs: 30000,
    hardLimit: false,
    endpoint: 'https://llm.api.cloud.yandex.net/v1/completions',
    modelType: 'gpt-4',
    recommendedDelayMs: 5000,
    retryCount: 1,
    maxRetries: 3,
    ...overrides,
  };
}

/** Создает mock RateLimitError для тестов */
function createMockRateLimitError(
  contextOverrides: Partial<RateLimitErrorContext> = {},
  messageOverrides: Partial<{ code: string; message: string; timestamp: string; }> = {},
): RateLimitError {
  return createRateLimitError(
    (messageOverrides.code ?? 'INFRA_AI_RATE_LIMIT_PER_MINUTE') as any,
    messageOverrides.message ?? 'Test rate limit error',
    {
      limitKind: 'per_minute',
      recoveryStrategy: 'exponential_backoff',
      unit: 'requests',
      currentUsage: 120,
      limit: 100,
      windowMs: 60000,
      resetTimeMs: 30000,
      hardLimit: false,
      ...contextOverrides,
    },
    messageOverrides.timestamp,
  );
}

// ==================== TESTS ====================

describe('RateLimitError', () => {
  describe('Константы и типы', () => {
    it('должен корректно определять AI_VENDOR константу', () => {
      expect(AI_VENDOR).toBe('yandex_cloud');
    });

    it('должен корректно определять RateLimitKind типы', () => {
      const validKinds: RateLimitKind[] = [
        'per_minute',
        'per_hour',
        'per_day',
        'burst',
        'quota',
      ];

      expect(validKinds).toHaveLength(5);
      validKinds.forEach((kind) => {
        expect(typeof kind).toBe('string');
      });
    });

    it('должен корректно определять RateLimitRecoveryStrategy типы', () => {
      const validStrategies: RateLimitRecoveryStrategy[] = [
        'exponential_backoff',
        'fixed_delay',
        'immediate_retry',
        'fail_fast',
      ];

      expect(validStrategies).toHaveLength(4);
      validStrategies.forEach((strategy) => {
        expect(typeof strategy).toBe('string');
      });
    });

    it('должен корректно определять RateLimitUnit типы', () => {
      const validUnits: RateLimitUnit[] = [
        'requests',
        'tokens',
        'bytes',
      ];

      expect(validUnits).toHaveLength(3);
      validUnits.forEach((unit) => {
        expect(typeof unit).toBe('string');
      });
    });

    it('должен корректно определять RateLimitErrorContext интерфейс', () => {
      const context: RateLimitErrorContext = createMockRateLimitContext();

      expect(context.type).toBe('yandex_ai_rate_limit');
      expect(context.vendor).toBe(AI_VENDOR);
      expect(context.limitKind).toBe('per_minute');
      expect(context.recoveryStrategy).toBe('exponential_backoff');
      expect(context.unit).toBe('requests');
      expect(context.currentUsage).toBe(120);
      expect(context.limit).toBe(100);
      expect(context.excess).toBe(20);
      expect(context.windowMs).toBe(60000);
      expect(context.resetTimeMs).toBe(30000);
      expect(context.hardLimit).toBe(false);
      expect(context.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(context.modelType).toBe('gpt-4');
      expect(context.recommendedDelayMs).toBe(5000);
      expect(context.retryCount).toBe(1);
      expect(context.maxRetries).toBe(3);
    });
  });

  describe('createRateLimitError', () => {
    it('должен создавать базовую ошибку с минимальными параметрами', () => {
      const error = createRateLimitError(
        'INFRA_AI_RATE_LIMIT_PER_MINUTE' as any,
        'Rate limit exceeded',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      expect(error._tag).toBe('RateLimitError');
      expect(error.category).toBe(ERROR_CATEGORY.TECHNICAL);
      expect(error.origin).toBe(ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(error.code).toBe('INFRA_AI_RATE_LIMIT_PER_MINUTE');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.details.type).toBe('yandex_ai_rate_limit');
      expect(error.details.vendor).toBe(AI_VENDOR);
      expect(error.details.limitKind).toBe('per_minute');
      expect(error.details.recoveryStrategy).toBe('exponential_backoff');
      expect(error.details.unit).toBe('requests');
      expect(error.details.currentUsage).toBe(120);
      expect(error.details.limit).toBe(100);
      expect(error.details.excess).toBe(20);
      expect(error.details.windowMs).toBe(60000);
      expect(error.details.resetTimeMs).toBe(30000);
      expect(error.details.hardLimit).toBe(false);
      expect(typeof error.timestamp).toBe('string');
    });

    it('должен создавать ошибку с полным контекстом', () => {
      const context = createMockRateLimitContext();
      const error = createRateLimitError(
        'INFRA_AI_RATE_LIMIT_PER_MINUTE' as any,
        'Full context error',
        context,
      );

      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.modelType).toBe('gpt-4');
      expect(error.details.recommendedDelayMs).toBe(5000);
      expect(error.details.retryCount).toBe(1);
      expect(error.details.maxRetries).toBe(3);
    });

    it('должен правильно рассчитывать excess', () => {
      const error = createRateLimitError(
        'TEST_CODE' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 150,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      expect(error.details.excess).toBe(50);
    });

    it('должен корректно обрабатывать excess = 0 когда currentUsage <= limit', () => {
      const errorEqual = createRateLimitError(
        'TEST_CODE' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 100,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      const errorLess = createRateLimitError(
        'TEST_CODE' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 80,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      expect(errorEqual.details.excess).toBe(0);
      expect(errorLess.details.excess).toBe(0);
    });

    it('должен использовать переданный timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createRateLimitError(
        'TEST_CODE' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('должен генерировать timestamp автоматически если не передан', () => {
      const before = new Date();
      const error = createRateLimitError(
        'TEST_CODE' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );
      const after = new Date();

      const errorTime = new Date(error.timestamp);
      expect(errorTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('createPerMinuteLimitError', () => {
    it('должен создавать ошибку превышения минутного лимита', () => {
      const error = createPerMinuteLimitError(120, 100);

      expect(error.code).toBe('INFRA_AI_RATE_LIMIT_PER_MINUTE');
      expect(error.message).toContain('Превышен лимит запросов в минуту');
      expect(error.message).toContain('120/100');
      expect(error.message).toContain('20 превышение');
      expect(error.details.limitKind).toBe('per_minute');
      expect(error.details.recoveryStrategy).toBe('exponential_backoff');
      expect(error.details.unit).toBe('requests');
      expect(error.details.currentUsage).toBe(120);
      expect(error.details.limit).toBe(100);
      expect(error.details.excess).toBe(20);
      expect(error.details.windowMs).toBe(60000);
      expect(error.details.resetTimeMs).toBe(60000);
      expect(error.details.hardLimit).toBe(false);
      expect(error.details.recommendedDelayMs).toBe(30000); // Min of 60000 and 30000
    });

    it('должен создавать ошибку с endpoint и modelType', () => {
      const error = createPerMinuteLimitError(120, 100, 'endpoint', 'gpt-4');

      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.modelType).toBe('gpt-4');
    });

    it('должен создавать ошибку без endpoint и modelType (undefined)', () => {
      const error = createPerMinuteLimitError(120, 100, undefined, undefined);

      expect(error.details.endpoint).toBeUndefined();
      expect(error.details.modelType).toBeUndefined();
    });
  });

  describe('createPerHourLimitError', () => {
    it('должен создавать ошибку превышения часового лимита', () => {
      const error = createPerHourLimitError(1200, 1000);

      expect(error.code).toBe('INFRA_AI_RATE_LIMIT_PER_HOUR');
      expect(error.message).toContain('Превышен лимит запросов в час');
      expect(error.message).toContain('1200/1000');
      expect(error.message).toContain('200 превышение');
      expect(error.details.limitKind).toBe('per_hour');
      expect(error.details.recoveryStrategy).toBe('fixed_delay');
      expect(error.details.unit).toBe('requests');
      expect(error.details.currentUsage).toBe(1200);
      expect(error.details.limit).toBe(1000);
      expect(error.details.excess).toBe(200);
      expect(error.details.windowMs).toBe(3600000); // 1 hour
      expect(error.details.resetTimeMs).toBe(3600000);
      expect(error.details.hardLimit).toBe(false);
      expect(error.details.recommendedDelayMs).toBe(60000); // Min of 3600000/60 and 300000
    });

    it('должен создавать ошибку без endpoint и modelType (undefined)', () => {
      const error = createPerHourLimitError(1200, 1000, undefined, undefined);

      expect(error.details.endpoint).toBeUndefined();
      expect(error.details.modelType).toBeUndefined();
    });

    it('должен создавать ошибку с endpoint и modelType', () => {
      const error = createPerHourLimitError(1200, 1000, 'endpoint', 'gpt-4');

      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.modelType).toBe('gpt-4');
    });
  });

  describe('createPerDayLimitError', () => {
    it('должен создавать ошибку превышения дневного лимита', () => {
      const error = createPerDayLimitError(12000, 10000);

      expect(error.code).toBe('INFRA_AI_RATE_LIMIT_PER_DAY');
      expect(error.message).toContain('Превышен лимит запросов в сутки');
      expect(error.message).toContain('12000/10000');
      expect(error.message).toContain('2000 превышение');
      expect(error.details.limitKind).toBe('per_day');
      expect(error.details.recoveryStrategy).toBe('fail_fast');
      expect(error.details.unit).toBe('requests');
      expect(error.details.currentUsage).toBe(12000);
      expect(error.details.limit).toBe(10000);
      expect(error.details.excess).toBe(2000);
      expect(error.details.windowMs).toBe(86400000); // 24 hours
      expect(error.details.resetTimeMs).toBe(86400000);
      expect(error.details.hardLimit).toBe(false);
      expect(error.details.recommendedDelayMs).toBe(3600000); // Min of 86400000/24 and 3600000
    });

    it('должен создавать ошибку без endpoint и modelType (undefined)', () => {
      const error = createPerDayLimitError(12000, 10000, undefined, undefined);

      expect(error.details.endpoint).toBeUndefined();
      expect(error.details.modelType).toBeUndefined();
    });

    it('должен создавать ошибку с endpoint и modelType', () => {
      const error = createPerDayLimitError(12000, 10000, 'endpoint', 'gpt-4');

      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.modelType).toBe('gpt-4');
    });
  });

  describe('createBurstLimitError', () => {
    it('должен создавать ошибку превышения burst лимита', () => {
      const error = createBurstLimitError(150, 100, 10000);

      expect(error.code).toBe('INFRA_AI_RATE_LIMIT_BURST');
      expect(error.message).toContain('Превышен burst лимит');
      expect(error.message).toContain('150/100 за 10000ms');
      expect(error.message).toContain('50 превышение');
      expect(error.details.limitKind).toBe('burst');
      expect(error.details.recoveryStrategy).toBe('immediate_retry');
      expect(error.details.unit).toBe('requests');
      expect(error.details.currentUsage).toBe(150);
      expect(error.details.limit).toBe(100);
      expect(error.details.excess).toBe(50);
      expect(error.details.windowMs).toBe(10000);
      expect(error.details.resetTimeMs).toBe(10000);
      expect(error.details.hardLimit).toBe(false);
      expect(error.details.recommendedDelayMs).toBe(1000); // Min of 10000/10 and 10000
    });

    it('должен создавать ошибку с endpoint и modelType', () => {
      const error = createBurstLimitError(150, 100, 10000, 'endpoint', 'gpt-4');

      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.modelType).toBe('gpt-4');
    });

    it('должен создавать burst ошибку без endpoint и modelType (undefined)', () => {
      const error = createBurstLimitError(150, 100, 10000, undefined, undefined);

      expect(error.details.endpoint).toBeUndefined();
      expect(error.details.modelType).toBeUndefined();
    });

    it('должен создавать burst ошибку с endpoint и modelType', () => {
      const error = createBurstLimitError(150, 100, 10000, 'endpoint', 'gpt-4');

      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.modelType).toBe('gpt-4');
    });
  });

  describe('createQuotaExhaustionError', () => {
    it('должен создавать ошибку исчерпания квоты', () => {
      const error = createQuotaExhaustionError(150000, 100000);

      expect(error.code).toBe('INFRA_AI_QUOTA_EXHAUSTED');
      expect(error.message).toContain('Исчерпана квота токенов');
      expect(error.message).toContain('150000/100000');
      expect(error.message).toContain('50000 превышение');
      expect(error.details.limitKind).toBe('quota');
      expect(error.details.recoveryStrategy).toBe('fail_fast');
      expect(error.details.unit).toBe('tokens');
      expect(error.details.currentUsage).toBe(150000);
      expect(error.details.limit).toBe(100000);
      expect(error.details.excess).toBe(50000);
      expect(error.details.windowMs).toBe(86400000); // Daily quota
      expect(error.details.resetTimeMs).toBe(86400000);
      expect(error.details.hardLimit).toBe(true);
    });

    it('должен создавать ошибку с modelType и endpoint', () => {
      const error = createQuotaExhaustionError(150000, 100000, 'gpt-4', 'endpoint');

      expect(error.details.modelType).toBe('gpt-4');
      expect(error.details.endpoint).toBe('endpoint');
    });

    it('должен создавать ошибку без modelType и endpoint (undefined)', () => {
      const error = createQuotaExhaustionError(150000, 100000, undefined, undefined);

      expect(error.details.modelType).toBeUndefined();
      expect(error.details.endpoint).toBeUndefined();
    });

    it('должен создавать ошибку с modelType и без endpoint (quota)', () => {
      const error = createQuotaExhaustionError(150000, 100000, 'gpt-4', undefined);

      expect(error.details.modelType).toBe('gpt-4');
      expect(error.details.endpoint).toBeUndefined();
    });

    it('должен создавать ошибку без modelType и с endpoint (quota)', () => {
      const error = createQuotaExhaustionError(150000, 100000, undefined, 'endpoint');

      expect(error.details.modelType).toBeUndefined();
      expect(error.details.endpoint).toBe('endpoint');
    });
  });

  describe('Policy Helpers', () => {
    it('getRateLimitRecoveryStrategy должен возвращать правильную стратегию', () => {
      const exponentialError = createPerMinuteLimitError(120, 100);
      const fixedDelayError = createPerHourLimitError(1200, 1000);
      const failFastError = createPerDayLimitError(12000, 10000);
      const immediateRetryError = createBurstLimitError(150, 100, 10000);
      const quotaError = createQuotaExhaustionError(150000, 100000);

      expect(getRateLimitRecoveryStrategy(exponentialError)).toBe('exponential_backoff');
      expect(getRateLimitRecoveryStrategy(fixedDelayError)).toBe('fixed_delay');
      expect(getRateLimitRecoveryStrategy(failFastError)).toBe('fail_fast');
      expect(getRateLimitRecoveryStrategy(immediateRetryError)).toBe('immediate_retry');
      expect(getRateLimitRecoveryStrategy(quotaError)).toBe('fail_fast');
    });

    it('isRateLimitRetriable должен правильно определять retriable ошибки', () => {
      const retriableErrors = [
        createPerMinuteLimitError(120, 100),
        createPerHourLimitError(1200, 1000),
        createBurstLimitError(150, 100, 10000),
      ];

      const nonRetriableErrors = [
        createPerDayLimitError(12000, 10000),
        createQuotaExhaustionError(150000, 100000),
      ];

      retriableErrors.forEach((error) => {
        expect(isRateLimitRetriable(error)).toBe(true);
      });

      nonRetriableErrors.forEach((error) => {
        expect(isRateLimitRetriable(error)).toBe(false);
      });
    });

    it('getRecommendedRetryDelay должен возвращать правильные задержки', () => {
      const exponentialError = createPerMinuteLimitError(120, 100);
      const immediateRetryError = createBurstLimitError(150, 100, 10000);
      const quotaError = createQuotaExhaustionError(150000, 100000);

      expect(getRecommendedRetryDelay(exponentialError)).toBe(30000);
      expect(getRecommendedRetryDelay(immediateRetryError)).toBe(1000);
      expect(getRecommendedRetryDelay(quotaError)).toBe(1000); // default
    });

    it('getRecommendedRetryDelay должен возвращать default значение когда recommendedDelayMs undefined', () => {
      const error = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
          // recommendedDelayMs не указан
        },
      );

      expect(getRecommendedRetryDelay(error)).toBe(1000); // default fallback
    });

    it('getRateLimitUsagePercentage должен правильно рассчитывать процент', () => {
      const error = createMockRateLimitError();

      expect(getRateLimitUsagePercentage(error)).toBe(120); // (120/100) * 100 = 120%
    });

    it('isRateLimitCritical должен определять критичность (>90%)', () => {
      const criticalError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 95,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      const nonCriticalError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 85,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      const exactly90Error = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 90,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 30000,
          hardLimit: false,
        },
      );

      expect(isRateLimitCritical(criticalError)).toBe(true); // 95% > 90%
      expect(isRateLimitCritical(nonCriticalError)).toBe(false); // 85% < 90%
      expect(isRateLimitCritical(exactly90Error)).toBe(false); // 90% == 90%, not > 90%
    });

    it('isHardLimit должен правильно определять hard limits', () => {
      const softLimits = [
        createPerMinuteLimitError(120, 100),
        createPerHourLimitError(1200, 1000),
        createPerDayLimitError(12000, 10000),
        createBurstLimitError(150, 100, 10000),
      ];

      const hardLimits = [
        createQuotaExhaustionError(150000, 100000),
      ];

      softLimits.forEach((error) => {
        expect(isHardLimit(error)).toBe(false);
      });

      hardLimits.forEach((error) => {
        expect(isHardLimit(error)).toBe(true);
      });
    });

    it('getTimeUntilReset должен правильно форматировать время', () => {
      // Тест для формата с часами
      const hoursError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 3661000, // 1h 1m 1s
          hardLimit: false,
        },
      );

      expect(getTimeUntilReset(hoursError)).toBe('1ч 1м');

      // Тест для формата с минутами
      const minutesError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 66000, // 1m 6s
          hardLimit: false,
        },
      );

      expect(getTimeUntilReset(minutesError)).toBe('1м 6с');

      // Тест для формата только с секундами
      const secondsError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 45000, // 45s
          hardLimit: false,
        },
      );

      expect(getTimeUntilReset(secondsError)).toBe('45с');

      // Тест для случая, когда время уже истекло
      const expiredError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: -1000, // Уже истекло
          hardLimit: false,
        },
      );

      expect(getTimeUntilReset(expiredError)).toBe('Немедленно');
    });

    it('getTimeUntilReset должен обрабатывать граничные случаи', () => {
      // Тест для resetTimeMs = 0
      const zeroError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 0,
          hardLimit: false,
        },
      );

      expect(getTimeUntilReset(zeroError)).toBe('Немедленно');

      // Тест для очень маленького положительного значения
      const tinyError = createRateLimitError(
        'TEST' as any,
        'Test',
        {
          limitKind: 'per_minute',
          recoveryStrategy: 'exponential_backoff',
          unit: 'requests',
          currentUsage: 120,
          limit: 100,
          windowMs: 60000,
          resetTimeMs: 500, // 0.5 секунды
          hardLimit: false,
        },
      );

      expect(getTimeUntilReset(tinyError)).toBe('0с');
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен работать полный цикл создания и обработки ошибки', () => {
      // Создаем ошибку превышения минутного лимита
      const error = createPerMinuteLimitError(120, 100, 'endpoint', 'gpt-4');

      // Проверяем структуру ошибки
      expect(error._tag).toBe('RateLimitError');
      expect(error.details.type).toBe('yandex_ai_rate_limit');
      expect(error.details.vendor).toBe(AI_VENDOR);

      // Проверяем policy helpers
      expect(getRateLimitRecoveryStrategy(error)).toBe('exponential_backoff');
      expect(isRateLimitRetriable(error)).toBe(true);
      expect(getRecommendedRetryDelay(error)).toBe(30000);
      expect(getRateLimitUsagePercentage(error)).toBe(120);
      expect(isRateLimitCritical(error)).toBe(true);
      expect(isHardLimit(error)).toBe(false);
      expect(getTimeUntilReset(error)).toBe('1м 0с');

      // Проверяем специфические поля
      expect(error.details.limitKind).toBe('per_minute');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.modelType).toBe('gpt-4');
      expect(error.details.excess).toBe(20);
    });

    it('должен корректно обрабатывать все типы limitKind', () => {
      // Тестируем createPerMinuteLimitError
      const perMinuteError = createPerMinuteLimitError(120, 100);
      expect(perMinuteError.details.limitKind).toBe('per_minute');
      expect(perMinuteError.details.hardLimit).toBe(false);

      // Тестируем createPerHourLimitError
      const perHourError = createPerHourLimitError(1200, 1000);
      expect(perHourError.details.limitKind).toBe('per_hour');
      expect(perHourError.details.hardLimit).toBe(false);

      // Тестируем createPerDayLimitError
      const perDayError = createPerDayLimitError(12000, 10000);
      expect(perDayError.details.limitKind).toBe('per_day');
      expect(perDayError.details.hardLimit).toBe(false);

      // Тестируем createBurstLimitError
      const burstError = createBurstLimitError(150, 100, 10000);
      expect(burstError.details.limitKind).toBe('burst');
      expect(burstError.details.hardLimit).toBe(false);

      // Тестируем createQuotaExhaustionError
      const quotaError = createQuotaExhaustionError(150000, 100000);
      expect(quotaError.details.limitKind).toBe('quota');
      expect(quotaError.details.hardLimit).toBe(true);
    });

    it('должен корректно обрабатывать все единицы измерения', () => {
      const units: RateLimitUnit[] = ['requests', 'tokens', 'bytes'];

      units.forEach((unit) => {
        const error = createRateLimitError(
          'TEST_CODE' as any,
          'Test',
          {
            limitKind: 'per_minute',
            recoveryStrategy: 'exponential_backoff',
            unit,
            currentUsage: 120,
            limit: 100,
            windowMs: 60000,
            resetTimeMs: 30000,
            hardLimit: false,
          },
        );

        expect(error.details.unit).toBe(unit);
      });
    });
  });
});
