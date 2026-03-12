/**
 * @file Unit тесты для domain/AuthRetry.ts
 * Покрывают AuthRetryPolicy, OAuthRetryPolicy и helper'ы с целью 100% покрытия.
 */

import { describe, expect, it } from 'vitest';

import type { AuthRetryKey, OAuthRetryKey } from '../../../src/domain/AuthRetry.js';
import {
  AuthRetryPolicy,
  getAuthRetryable,
  getOAuthRetryable,
  mergeAuthRetryPolicies,
  mergeOAuthRetryPolicies,
  OAuthRetryPolicy,
} from '../../../src/domain/AuthRetry.js';

describe('AuthRetryPolicy', () => {
  it('имеет детерминированные значения retryable для всех AuthErrorKey', () => {
    const allAuthKeys: AuthRetryKey[] = [
      'invalid_credentials',
      'account_locked',
      'account_disabled',
      'email_not_verified',
      'phone_not_verified',
      'mfa_required',
      'mfa_failed',
      'rate_limited',
      'session_expired',
      'session_revoked',
      'token_invalid',
      'token_expired',
      'permission_denied',
      'risk_blocked',
      'conflict',
      'unknown_error',
    ];

    // smoke: policy определена для всех ключей и совпадает с getAuthRetryable
    allAuthKeys.forEach((key) => {
      // eslint-disable-next-line security/detect-object-injection -- key строго типизирован как AuthRetryKey (exhaustive union), lookup безопасен
      const fromPolicy = AuthRetryPolicy[key];
      const fromHelper = getAuthRetryable(key);

      expect(typeof fromPolicy).toBe('boolean');
      expect(fromHelper).toBe(fromPolicy);
    });

    // несколько ключевых edge-кейсов
    expect(getAuthRetryable('invalid_credentials')).toBe(false);
    expect(getAuthRetryable('rate_limited')).toBe(true);
    expect(getAuthRetryable('token_expired')).toBe(true);
    expect(getAuthRetryable('unknown_error')).toBe(false);
  });

  it('mergeAuthRetryPolicies позволяет задавать overrides поверх базовой политики', () => {
    const override: Partial<Record<AuthRetryKey, boolean>> = {
      rate_limited: false,
      unknown_error: true,
    };

    const merged = mergeAuthRetryPolicies(AuthRetryPolicy, override);

    expect(merged.rate_limited).toBe(false);
    expect(merged.unknown_error).toBe(true);
    // остальные ключи не меняются
    expect(merged.invalid_credentials).toBe(AuthRetryPolicy.invalid_credentials);
  });
});

describe('OAuthRetryPolicy', () => {
  it('имеет детерминированные значения retryable для всех OAuthRetryKey', () => {
    const allOAuthKeys: OAuthRetryKey[] = [
      'invalid_token',
      'expired_token',
      'provider_unavailable',
      'user_denied',
      'invalid_scope',
      'account_conflict',
      'email_not_verified',
      'rate_limited',
      'unknown_error',
    ];

    allOAuthKeys.forEach((key) => {
      // eslint-disable-next-line security/detect-object-injection -- key строго типизирован как OAuthRetryKey (exhaustive union), lookup безопасен
      const fromPolicy = OAuthRetryPolicy[key];
      const fromHelper = getOAuthRetryable(key);

      expect(typeof fromPolicy).toBe('boolean');
      expect(fromHelper).toBe(fromPolicy);
    });

    expect(getOAuthRetryable('invalid_token')).toBe(false);
    expect(getOAuthRetryable('expired_token')).toBe(true);
    expect(getOAuthRetryable('provider_unavailable')).toBe(true);
    expect(getOAuthRetryable('rate_limited')).toBe(true);
    expect(getOAuthRetryable('unknown_error')).toBe(false);
  });

  it('mergeOAuthRetryPolicies позволяет задавать overrides поверх базовой политики', () => {
    const override: Partial<Record<OAuthRetryKey, boolean>> = {
      provider_unavailable: false,
      unknown_error: true,
    };

    const merged = mergeOAuthRetryPolicies(OAuthRetryPolicy, override);

    expect(merged.provider_unavailable).toBe(false);
    expect(merged.unknown_error).toBe(true);
    expect(merged.invalid_token).toBe(OAuthRetryPolicy.invalid_token);
  });
});
