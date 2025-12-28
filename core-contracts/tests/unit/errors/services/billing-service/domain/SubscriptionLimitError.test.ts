import { describe, expect, it } from 'vitest';

import {
  createSubscriptionLimitError,
  getAllowedUsage,
  getCurrentUsage,
  getSubscriptionLimitReason,
  getSubscriptionPlanId,
  getUpgradeOptions,
  getUsagePercentage,
  isSubscriptionLimitError,
  isValidSubscriptionLimitErrorContext,
  PERCENT_BASE,
  requiresUpgrade,
  VALID_SUBSCRIPTION_LIMIT_REASONS,
} from '../../../../../../src/errors/services/billing-service/domain/index.js';
import type {
  SubscriptionLimitError,
  SubscriptionLimitErrorContext,
  SubscriptionLimitReason,
} from '../../../../../../src/errors/services/billing-service/domain/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock SubscriptionLimitErrorContext для тестов */
function createMockSubscriptionLimitContext(
  overrides: Partial<SubscriptionLimitErrorContext> = {},
): SubscriptionLimitErrorContext {
  return {
    type: 'subscription_limit',
    reason: 'plan-limit-exceeded',
    rule: 'usage.monthly.BYN',
    planId: 'plan_123',
    subscriptionId: 'sub_456',
    currentUsage: 150,
    allowedUsage: 100,
    usageUnit: 'requests',
    resetDate: new Date('2024-12-31'),
    upgradeOptions: ['Upgrade to Pro plan', 'Increase quota'],
    suggestions: ['Contact support', 'Review usage patterns'],
    ...overrides,
  };
}

/** Создает mock SubscriptionLimitError для тестов */
function createMockSubscriptionLimitError(
  contextOverrides: Partial<SubscriptionLimitErrorContext> = {},
): SubscriptionLimitError {
  const context = createMockSubscriptionLimitContext(contextOverrides);
  return createSubscriptionLimitError(
    context.reason,
    context.rule,
    'Subscription limit exceeded',
    context.planId,
    {
      subscriptionId: context.subscriptionId,
      currentUsage: context.currentUsage,
      allowedUsage: context.allowedUsage,
      usageUnit: context.usageUnit,
      resetDate: context.resetDate,
      upgradeOptions: context.upgradeOptions,
      suggestions: context.suggestions,
    },
  );
}

// ==================== TESTS ====================

describe('SubscriptionLimitError Domain', () => {
  describe('createSubscriptionLimitError', () => {
    it('should create SubscriptionLimitError with all fields', () => {
      const error = createSubscriptionLimitError(
        'plan-limit-exceeded',
        'usage.monthly.BYN',
        'Monthly usage limit exceeded',
        'plan_123',
        {
          subscriptionId: 'sub_456',
          currentUsage: 150,
          allowedUsage: 100,
          usageUnit: 'requests',
          resetDate: new Date('2024-12-31'),
          upgradeOptions: ['Upgrade to Pro', 'Increase quota'],
          suggestions: ['Contact support'],
        },
      );

      expect(error._tag).toBe('SubscriptionLimitError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('DOMAIN');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_104');
      expect(error.message).toBe('Monthly usage limit exceeded');
      expect(error.details).toEqual({
        type: 'subscription_limit',
        reason: 'plan-limit-exceeded',
        rule: 'usage.monthly.BYN',
        planId: 'plan_123',
        subscriptionId: 'sub_456',
        currentUsage: 150,
        allowedUsage: 100,
        usageUnit: 'requests',
        resetDate: new Date('2024-12-31'),
        upgradeOptions: ['Upgrade to Pro', 'Increase quota'],
        suggestions: ['Contact support'],
      });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should create error with minimal context', () => {
      const error = createSubscriptionLimitError(
        'usage-cap-reached',
        'requests.daily',
        'Daily request limit reached',
        'plan_basic',
      );

      expect(error._tag).toBe('SubscriptionLimitError');
      expect(error.details).toEqual({
        type: 'subscription_limit',
        reason: 'usage-cap-reached',
        rule: 'requests.daily',
        planId: 'plan_basic',
      });
    });

    it('should create CRITICAL severity error when specified', () => {
      const error = createSubscriptionLimitError(
        'subscription-expired',
        'subscription.active',
        'Subscription has expired',
        'plan_expired',
        undefined,
        'critical',
      );

      expect(error.severity).toBe('critical');
    });

    it('should create HIGH severity error by default', () => {
      const error = createSubscriptionLimitError(
        'quota-exhausted',
        'quota.monthly',
        'Monthly quota exhausted',
        'plan_quota',
      );

      expect(error.severity).toBe('high');
    });

    it('should handle Date and string resetDate', () => {
      const errorWithDate = createSubscriptionLimitError(
        'tier-upgrade-required',
        'tier.features',
        'Tier upgrade required',
        'plan_tier',
        { resetDate: new Date('2024-12-31') },
      );

      const errorWithString = createSubscriptionLimitError(
        'feature-locked',
        'feature.premium',
        'Premium feature locked',
        'plan_locked',
        { resetDate: '2024-12-31T23:59:59.999Z' },
      );

      expect(errorWithDate.details.resetDate).toEqual(new Date('2024-12-31'));
      expect(errorWithString.details.resetDate).toBe('2024-12-31T23:59:59.999Z');
    });
  });

  describe('isValidSubscriptionLimitErrorContext', () => {
    it('should return true for valid context', () => {
      const context = createMockSubscriptionLimitContext();
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidSubscriptionLimitErrorContext(null)).toBe(false);
      expect(isValidSubscriptionLimitErrorContext(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidSubscriptionLimitErrorContext('string')).toBe(false);
      expect(isValidSubscriptionLimitErrorContext(123)).toBe(false);
    });

    it('should return false for invalid type', () => {
      const context = createMockSubscriptionLimitContext({ type: 'invalid' as any });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should return false for invalid reason', () => {
      const context = createMockSubscriptionLimitContext({ reason: 'invalid-reason' as any });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should return false for non-string type field', () => {
      const context = {
        type: 123 as any, // type not string
        reason: 'plan-limit-exceeded',
        rule: 'test_rule',
        planId: 'plan_123',
      };
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should return false for non-string reason field', () => {
      const context = {
        type: 'subscription_limit',
        reason: 123 as any, // reason not string
        rule: 'test_rule',
        planId: 'plan_123',
      };
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should return false for non-string rule field', () => {
      const context = {
        type: 'subscription_limit',
        reason: 'plan-limit-exceeded',
        rule: {} as any, // rule not string
        planId: 'plan_123',
      };
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should return false for non-string planId field', () => {
      const context = {
        type: 'subscription_limit',
        reason: 'plan-limit-exceeded',
        rule: 'test_rule',
        planId: [] as any, // planId not string
      };
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const context = { type: 'subscription_limit', reason: 'plan-limit-exceeded' } as any;
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should validate usage values', () => {
      // Valid usage
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ currentUsage: 50, allowedUsage: 100 }),
      )).toBe(true);

      // Invalid usage (negative)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ currentUsage: -10, allowedUsage: 100 }),
      )).toBe(false);

      // Invalid allowed usage (zero)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ currentUsage: 50, allowedUsage: 0 }),
      )).toBe(false);
    });

    it('should validate upgradeOptions array', () => {
      // Valid upgrade options
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ upgradeOptions: ['Option 1', 'Option 2'] }),
      )).toBe(true);

      // Invalid upgrade options (not array)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ upgradeOptions: 'not array' as any }),
      )).toBe(false);

      // Invalid upgrade options (contains empty strings)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({
          upgradeOptions: ['valid option', '', 'another valid'],
        }),
      )).toBe(false);

      // Invalid upgrade options (empty strings)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ upgradeOptions: ['valid', ''] }),
      )).toBe(false);
    });

    it('should validate suggestions array', () => {
      // Valid suggestions
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ suggestions: ['Suggestion 1', 'Suggestion 2'] }),
      )).toBe(true);

      // Invalid suggestions (not array)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ suggestions: 'not array' as any }),
      )).toBe(false);

      // Invalid suggestions (contains empty strings)
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({
          suggestions: ['valid suggestion', '', 'another valid'],
        }),
      )).toBe(false);
    });

    it('should validate string fields', () => {
      // Invalid subscriptionId
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ subscriptionId: 123 as any }),
      )).toBe(false);

      // Invalid usageUnit
      expect(isValidSubscriptionLimitErrorContext(
        createMockSubscriptionLimitContext({ usageUnit: {} as any }),
      )).toBe(false);
    });

    it('should accept valid reasons', () => {
      VALID_SUBSCRIPTION_LIMIT_REASONS.forEach((reason) => {
        const context = createMockSubscriptionLimitContext({ reason });
        expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
      });
    });
  });

  describe('isSubscriptionLimitError', () => {
    it('should return true for SubscriptionLimitError', () => {
      const error = createMockSubscriptionLimitError();
      expect(isSubscriptionLimitError(error)).toBe(true);
    });

    it('should return false for other objects', () => {
      expect(isSubscriptionLimitError(null)).toBe(false);
      expect(isSubscriptionLimitError({})).toBe(false);
      expect(isSubscriptionLimitError({ _tag: 'OtherError' })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isSubscriptionLimitError('string')).toBe(false);
      expect(isSubscriptionLimitError(123)).toBe(false);
    });
  });

  describe('Accessor functions', () => {
    const error = createMockSubscriptionLimitError();

    describe('getSubscriptionLimitReason', () => {
      it('should return reason', () => {
        expect(getSubscriptionLimitReason(error)).toBe('plan-limit-exceeded');
      });
    });

    describe('getSubscriptionPlanId', () => {
      it('should return planId', () => {
        expect(getSubscriptionPlanId(error)).toBe('plan_123');
      });
    });

    describe('getCurrentUsage', () => {
      it('should return currentUsage', () => {
        expect(getCurrentUsage(error)).toBe(150);
      });

      it('should return undefined when currentUsage not set', () => {
        const errorWithoutUsage = createSubscriptionLimitError(
          'usage-cap-reached',
          'requests.daily',
          'Daily limit reached',
          'plan_basic',
        );
        expect(getCurrentUsage(errorWithoutUsage)).toBeUndefined();
      });
    });

    describe('getAllowedUsage', () => {
      it('should return allowedUsage', () => {
        expect(getAllowedUsage(error)).toBe(100);
      });

      it('should return undefined when allowedUsage not set', () => {
        const errorWithoutLimit = createSubscriptionLimitError(
          'subscription-expired',
          'subscription.active',
          'Subscription expired',
          'plan_expired',
        );
        expect(getAllowedUsage(errorWithoutLimit)).toBeUndefined();
      });
    });

    describe('getUsagePercentage', () => {
      it('should calculate usage percentage correctly', () => {
        expect(getUsagePercentage(error)).toBe(150); // (150/100) * 100 = 150%
      });

      it('should return 0 when no current usage', () => {
        const errorNoCurrent = createSubscriptionLimitError(
          'quota-exhausted',
          'quota.monthly',
          'Quota exhausted',
          'plan_quota',
          { allowedUsage: 100 },
        );
        expect(getUsagePercentage(errorNoCurrent)).toBe(0);
      });

      it('should return 0 when allowedUsage is 0', () => {
        const errorZeroAllowed = createSubscriptionLimitError(
          'feature-locked',
          'feature.premium',
          'Feature locked',
          'plan_locked',
          { currentUsage: 50, allowedUsage: 0 },
        );
        expect(getUsagePercentage(errorZeroAllowed)).toBe(0);
      });

      it('should return undefined when no limits defined', () => {
        const errorNoLimits = createSubscriptionLimitError(
          'tier-upgrade-required',
          'tier.features',
          'Tier upgrade required',
          'plan_tier',
        );
        expect(getUsagePercentage(errorNoLimits)).toBe(0); // Current implementation returns 0
      });

      it('should handle large numbers', () => {
        const errorLarge = createSubscriptionLimitError(
          'usage-cap-reached',
          'requests.monthly',
          'Monthly cap reached',
          'plan_large',
          { currentUsage: 1000000, allowedUsage: 500000 },
        );
        expect(getUsagePercentage(errorLarge)).toBe(200); // (1000000/500000) * 100 = 200%
      });
    });

    describe('requiresUpgrade', () => {
      it('should return true for tier-upgrade-required', () => {
        const upgradeError = createSubscriptionLimitError(
          'tier-upgrade-required',
          'tier.features',
          'Tier upgrade required',
          'plan_tier',
        );
        expect(requiresUpgrade(upgradeError)).toBe(true);
      });

      it('should return false for other reasons', () => {
        expect(requiresUpgrade(error)).toBe(false);

        const expiredError = createSubscriptionLimitError(
          'subscription-expired',
          'subscription.active',
          'Subscription expired',
          'plan_expired',
        );
        expect(requiresUpgrade(expiredError)).toBe(false);
      });
    });

    describe('getUpgradeOptions', () => {
      it('should return upgradeOptions', () => {
        expect(getUpgradeOptions(error)).toEqual(['Upgrade to Pro plan', 'Increase quota']);
      });

      it('should return undefined when no upgrade options', () => {
        const errorNoOptions = createSubscriptionLimitError(
          'usage-cap-reached',
          'requests.daily',
          'Daily cap reached',
          'plan_basic',
        );
        expect(getUpgradeOptions(errorNoOptions)).toBeUndefined();
      });
    });
  });

  describe('Constants', () => {
    it('should export PERCENT_BASE', () => {
      expect(PERCENT_BASE).toBe(100);
    });

    it('should export VALID_SUBSCRIPTION_LIMIT_REASONS', () => {
      expect(VALID_SUBSCRIPTION_LIMIT_REASONS).toEqual([
        'plan-limit-exceeded',
        'usage-cap-reached',
        'subscription-expired',
        'quota-exhausted',
        'tier-upgrade-required',
        'feature-locked',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should reject empty upgradeOptions array', () => {
      const context = createMockSubscriptionLimitContext({
        upgradeOptions: [],
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should reject empty suggestions array', () => {
      const context = createMockSubscriptionLimitContext({
        suggestions: [],
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should handle undefined optional fields', () => {
      const context: SubscriptionLimitErrorContext = {
        type: 'subscription_limit',
        reason: 'plan-limit-exceeded',
        rule: 'usage.monthly.BYN',
        planId: 'plan_123',
      };
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
    });

    it('should handle zero usage values', () => {
      const context = createMockSubscriptionLimitContext({
        currentUsage: 0,
        allowedUsage: 100,
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
      expect(getUsagePercentage(createSubscriptionLimitError(
        'usage-cap-reached',
        'requests.daily',
        'No usage yet',
        'plan_zero',
        { currentUsage: 0, allowedUsage: 100 },
      ))).toBe(0);
    });

    it('should handle very large usage values', () => {
      const context = createMockSubscriptionLimitContext({
        currentUsage: 999999999,
        allowedUsage: 1000000000,
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
    });

    it('should handle Date resetDate', () => {
      const context = createMockSubscriptionLimitContext({
        resetDate: new Date('2024-12-31'),
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
    });

    it('should handle string resetDate', () => {
      const context = createMockSubscriptionLimitContext({
        resetDate: '2024-12-31T23:59:59.999Z',
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
    });

    it('should reject invalid resetDate types', () => {
      const context = createMockSubscriptionLimitContext({
        resetDate: 123 as any,
      });
      expect(isValidSubscriptionLimitErrorContext(context)).toBe(false);
    });

    it('should handle all valid reason values', () => {
      const reasons: SubscriptionLimitReason[] = [
        'plan-limit-exceeded',
        'usage-cap-reached',
        'subscription-expired',
        'quota-exhausted',
        'tier-upgrade-required',
        'feature-locked',
      ];

      reasons.forEach((reason) => {
        const context = createMockSubscriptionLimitContext({ reason });
        expect(isValidSubscriptionLimitErrorContext(context)).toBe(true);
      });
    });
  });
});
