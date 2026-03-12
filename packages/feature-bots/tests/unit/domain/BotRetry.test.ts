/**
 * @file Unit тесты для domain/BotRetry.ts
 * Покрывают BotRetryPolicy, getBotRetryable и mergeBotRetryPolicies.
 */

import { describe, expect, it } from 'vitest';

import type { BotRetryKey } from '../../../src/domain/BotRetry.js';
import {
  BotRetryPolicy,
  getBotRetryable,
  mergeBotRetryPolicies,
} from '../../../src/domain/BotRetry.js';

describe('BotRetryPolicy', () => {
  it('имеет детерминированные значения retryable для всех BotRetryKey', () => {
    const allBotKeys: BotRetryKey[] = [
      // Validation
      'BOT_NAME_INVALID',
      'BOT_NAME_TOO_SHORT',
      'BOT_NAME_TOO_LONG',
      'BOT_NAME_DUPLICATE',
      'BOT_INSTRUCTION_EMPTY',
      'BOT_INSTRUCTION_TOO_LONG',
      'BOT_SETTINGS_INVALID',
      'BOT_TEMPLATE_NOT_FOUND',
      'BOT_VERSION_INVALID',
      'BOT_MULTI_AGENT_SCHEMA_INVALID',
      'BOT_PROMPT_INVALID',
      'BOT_WORKSPACE_ID_INVALID',

      // Policy
      'BOT_POLICY_ACTION_DENIED',
      'BOT_POLICY_MODE_INVALID',
      'BOT_POLICY_ROLE_INSUFFICIENT',
      'BOT_POLICY_ARCHIVED',
      'BOT_POLICY_SYSTEM_BOT_RESTRICTED',

      // Permission
      'BOT_PERMISSION_DENIED',
      'BOT_PERMISSION_READ_DENIED',
      'BOT_PERMISSION_WRITE_DENIED',
      'BOT_PERMISSION_EXECUTE_DENIED',
      'BOT_PERMISSION_DELETE_DENIED',
      'BOT_WORKSPACE_ACCESS_DENIED',

      // Channel
      'BOT_CHANNEL_NOT_FOUND',
      'BOT_CHANNEL_INVALID',
      'BOT_CHANNEL_DISABLED',
      'BOT_CHANNEL_CONNECTION_FAILED',
      'BOT_CHANNEL_RATE_LIMIT_EXCEEDED',

      // Webhook
      'BOT_WEBHOOK_URL_INVALID',
      'BOT_WEBHOOK_TIMEOUT',
      'BOT_WEBHOOK_FAILED',
      'BOT_WEBHOOK_RETRY_EXCEEDED',
      'BOT_WEBHOOK_SIGNATURE_INVALID',
      'BOT_WEBHOOK_RATE_LIMIT_EXCEEDED',

      // Parsing
      'BOT_PARSING_INSTRUCTION_INVALID',
      'BOT_PARSING_SETTINGS_INVALID',
      'BOT_PARSING_MULTI_AGENT_INVALID',
      'BOT_PARSING_PROMPT_INVALID',
      'BOT_PARSING_JSON_INVALID',

      // Integration
      'BOT_INTEGRATION_NOT_FOUND',
      'BOT_INTEGRATION_INVALID',
      'BOT_INTEGRATION_AUTH_FAILED',
      'BOT_INTEGRATION_TIMEOUT',
      'BOT_INTEGRATION_RATE_LIMIT_EXCEEDED',
      'BOT_INTEGRATION_QUOTA_EXCEEDED',
    ];

    allBotKeys.forEach((code) => {
      // eslint-disable-next-line security/detect-object-injection -- code строго типизирован как BotRetryKey (exhaustive union), lookup безопасен
      const fromPolicy = BotRetryPolicy[code];
      const fromHelper = getBotRetryable(code);

      expect(typeof fromPolicy).toBe('boolean');
      expect(fromHelper).toBe(fromPolicy);
    });

    // sanity-check для нескольких ключевых категорий
    expect(getBotRetryable('BOT_NAME_INVALID')).toBe(false);
    expect(getBotRetryable('BOT_CHANNEL_CONNECTION_FAILED')).toBe(true);
    expect(getBotRetryable('BOT_WEBHOOK_TIMEOUT')).toBe(true);
    expect(getBotRetryable('BOT_WEBHOOK_RETRY_EXCEEDED')).toBe(false);
    expect(getBotRetryable('BOT_INTEGRATION_TIMEOUT')).toBe(true);
    expect(getBotRetryable('BOT_INTEGRATION_QUOTA_EXCEEDED')).toBe(false);
  });

  it('mergeBotRetryPolicies позволяет задавать overrides поверх базовой политики', () => {
    const override: Partial<Record<BotRetryKey, boolean>> = {
      BOT_CHANNEL_CONNECTION_FAILED: false,
      BOT_INTEGRATION_TIMEOUT: false,
    };

    const merged = mergeBotRetryPolicies(BotRetryPolicy, override);

    expect(merged.BOT_CHANNEL_CONNECTION_FAILED).toBe(false);
    expect(merged.BOT_INTEGRATION_TIMEOUT).toBe(false);
    expect(merged.BOT_NAME_INVALID).toBe(BotRetryPolicy.BOT_NAME_INVALID);
  });
});
