/**
 * @file Unit тесты для Resilience Retry Policy
 * Покрывают createRetryPolicy, mergeRetryPolicies и getRetryable с 100% покрытием.
 */
import { describe, expect, it } from 'vitest';

import type { RetryPolicy } from '../../src/resilience/retry-policy.js';
import {
  createRetryPolicy,
  getRetryable,
  mergeRetryPolicies,
} from '../../src/resilience/retry-policy.js';

type TestErrorCode = 'network' | 'timeout' | 'auth';

describe('resilience/retry-policy', () => {
  it('createRetryPolicy возвращает неизменённую политику и сохраняет типизацию', () => {
    const rawPolicy: Record<TestErrorCode, boolean> = {
      network: true,
      timeout: true,
      auth: false,
    };

    const policy = createRetryPolicy<TestErrorCode>(rawPolicy);

    // Runtime: объект возвращается без изменений
    expect(policy).toBe(rawPolicy);
    expect(policy.network).toBe(true);
    expect(policy.timeout).toBe(true);
    expect(policy.auth).toBe(false);

    // Type-level: policy удовлетворяет RetryPolicy<TestErrorCode>
    const typedPolicy: RetryPolicy<TestErrorCode> = policy;
    expect(typedPolicy.auth).toBe(false);
  });

  it('mergeRetryPolicies мержит base и override, причём override имеет приоритет', () => {
    const base: RetryPolicy<TestErrorCode> = {
      network: true,
      timeout: false,
      auth: false,
    };

    const override: Partial<RetryPolicy<TestErrorCode>> = {
      timeout: true,
    };

    const merged = mergeRetryPolicies(base, override);

    // Проверяем, что все ключи сохранены
    expect(merged.network).toBe(true);
    // override.timeout=true должен переопределить base.timeout=false
    expect(merged.timeout).toBe(true);
    // Не переопределённые ключи не меняются
    expect(merged.auth).toBe(false);
  });

  it('getRetryable безопасно читает флаг retryability по ключу', () => {
    const policy: RetryPolicy<TestErrorCode> = {
      network: true,
      timeout: false,
      auth: false,
    };

    expect(getRetryable(policy, 'network')).toBe(true);
    expect(getRetryable(policy, 'timeout')).toBe(false);
    expect(getRetryable(policy, 'auth')).toBe(false);
  });
});
