/**
 * @file Unit тесты для contracts/BotErrorResponse.ts
 * Покрывают BotErrorResponse типы.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { ISODateString, TraceId } from '@livai/core-contracts';

import type { BotErrorResponse, BotErrorType } from '../../../src/contracts/BotErrorResponse.js';
import type {
  BotErrorCategory,
  BotErrorCode,
  BotErrorContext,
  BotErrorSeverity,
} from '../../../src/types/bots.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createTraceId = (value = 'trace-1'): TraceId => value as TraceId;
const createISODateString = (value = '2026-01-01T00:00:00.000Z'): ISODateString =>
  value as ISODateString;
const createBotErrorCode = (value: BotErrorCode = 'BOT_NAME_INVALID'): BotErrorCode => value;
const createBotErrorCategory = (value: BotErrorCategory = 'validation'): BotErrorCategory => value;
const createBotErrorSeverity = (value: BotErrorSeverity = 'low'): BotErrorSeverity => value;
// eslint-disable-next-line @livai/rag/context-leakage, ai-security/model-poisoning -- test utility function, not real context
const createErrorContextData = (overrides: Partial<BotErrorContext> = {}): BotErrorContext => ({
  ...overrides,
});

// ============================================================================
// Тесты для BotErrorType
// ============================================================================

describe('BotErrorType', () => {
  it('поддерживает все значения union типа для validation errors', () => {
    const validationTypes: BotErrorType[] = [
      'validation_error',
      'name_invalid',
      'name_too_short',
      'name_too_long',
      'name_duplicate',
      'instruction_empty',
      'instruction_too_long',
      'settings_invalid',
      'template_not_found',
      'version_invalid',
      'multi_agent_schema_invalid',
      'prompt_invalid',
      'workspace_id_invalid',
    ];

    expect(validationTypes).toHaveLength(13);
    validationTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('поддерживает все значения union типа для policy errors', () => {
    const policyTypes: BotErrorType[] = [
      'policy_error',
      'policy_action_denied',
      'policy_mode_invalid',
      'policy_role_insufficient',
      'policy_archived',
      'policy_system_bot_restricted',
    ];

    expect(policyTypes).toHaveLength(6);
    policyTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('поддерживает все значения union типа для permission errors', () => {
    const permissionTypes: BotErrorType[] = [
      'permission_error',
      'permission_denied',
      'permission_read_denied',
      'permission_write_denied',
      'permission_execute_denied',
      'permission_delete_denied',
      'workspace_access_denied',
    ];

    expect(permissionTypes).toHaveLength(7);
    permissionTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('поддерживает все значения union типа для not found errors', () => {
    const notFoundTypes: BotErrorType[] = [
      'not_found',
      'bot_not_found',
      'channel_not_found',
      'integration_not_found',
    ];

    expect(notFoundTypes).toHaveLength(4);
    notFoundTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('поддерживает unknown_error', () => {
    const unknownType: BotErrorType = 'unknown_error';

    expect(unknownType).toBe('unknown_error');
  });

  it('поддерживает coarse-grained типы ошибок для channel/webhook/parsing/integration', () => {
    const coarseTypes: BotErrorType[] = [
      'channel_error',
      'webhook_error',
      'parsing_error',
      'integration_error',
    ];

    expect(coarseTypes).toHaveLength(4);
    coarseTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('поддерживает все типы ошибок', () => {
    const allTypes: BotErrorType[] = [
      // Validation errors
      'validation_error',
      'name_invalid',
      'name_too_short',
      'name_too_long',
      'name_duplicate',
      'instruction_empty',
      'instruction_too_long',
      'settings_invalid',
      'template_not_found',
      'version_invalid',
      'multi_agent_schema_invalid',
      'prompt_invalid',
      'workspace_id_invalid',
      // Channel errors (coarse-grained)
      'channel_error',
      // Policy errors
      'policy_error',
      'policy_action_denied',
      'policy_mode_invalid',
      'policy_role_insufficient',
      'policy_archived',
      'policy_system_bot_restricted',
      // Permission errors
      'permission_error',
      'permission_denied',
      'permission_read_denied',
      'permission_write_denied',
      'permission_execute_denied',
      'permission_delete_denied',
      'workspace_access_denied',
      // Webhook/Parsing/Integration errors (coarse-grained)
      'webhook_error',
      'parsing_error',
      'integration_error',
      // Not found errors
      'not_found',
      'bot_not_found',
      'channel_not_found',
      'integration_not_found',
      // Unknown error
      'unknown_error',
    ];

    expect(allTypes).toHaveLength(35);
  });
});

// ============================================================================
// Тесты для BotErrorResponse
// ============================================================================

describe('BotErrorResponse', () => {
  it('создаёт минимальный BotErrorResponse без опциональных полей', () => {
    const response: BotErrorResponse = {
      error: 'validation_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('low'),
      retryable: false,
    };

    expect(response.error).toBe('validation_error');
    expect(response.code).toBe('BOT_NAME_INVALID');
    expect(response.category).toBe('validation');
    expect(response.severity).toBe('low');
    expect(response.retryable).toBe(false);
    expect(response.message).toBeUndefined();
    expect(response.statusCode).toBeUndefined();
    expect(response.context).toBeUndefined();
    expect(response.traceId).toBeUndefined();
    expect(response.timestamp).toBeUndefined();
  });

  it('создаёт BotErrorResponse с message', () => {
    const response: BotErrorResponse = {
      error: 'name_invalid',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('medium'),
      retryable: false,
      message: 'Bot name is invalid',
    };

    expect(response.message).toBe('Bot name is invalid');
  });

  it('создаёт BotErrorResponse со statusCode', () => {
    const response: BotErrorResponse = {
      error: 'bot_not_found',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('high'),
      retryable: false,
      statusCode: 404,
    };

    expect(response.statusCode).toBe(404);
  });

  it('создаёт BotErrorResponse с context', () => {
    const response: BotErrorResponse = {
      error: 'validation_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('low'),
      retryable: false,
      context: createErrorContextData({
        field: 'name',
        value: 'invalid-name',
      }),
    };

    expect(response.context?.field).toBe('name');
    expect(response.context?.value).toBe('invalid-name');
  });

  it('создаёт BotErrorResponse с traceId', () => {
    const response: BotErrorResponse = {
      error: 'policy_error',
      code: createBotErrorCode('BOT_POLICY_ACTION_DENIED'),
      category: createBotErrorCategory('policy'),
      severity: createBotErrorSeverity('high'),
      retryable: false,
      traceId: createTraceId('trace-123'),
    };

    expect(response.traceId).toBe('trace-123');
  });

  it('создаёт BotErrorResponse с timestamp', () => {
    const response: BotErrorResponse = {
      error: 'permission_error',
      code: createBotErrorCode('BOT_PERMISSION_DENIED'),
      category: createBotErrorCategory('permission'),
      severity: createBotErrorSeverity('critical'),
      retryable: false,
      timestamp: createISODateString('2026-01-01T12:00:00.000Z'),
    };

    expect(response.timestamp).toBe('2026-01-01T12:00:00.000Z');
  });

  it('создаёт полный BotErrorResponse со всеми полями', () => {
    const response: BotErrorResponse = {
      error: 'validation_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('medium'),
      retryable: true,
      message: 'Bot name validation failed',
      statusCode: 400,
      context: createErrorContextData({
        field: 'name',
        value: 'test',
        details: { minLength: 3 },
      }),
      traceId: createTraceId('trace-456'),
      timestamp: createISODateString('2026-01-01T00:00:00.000Z'),
    };

    expect(response.error).toBe('validation_error');
    expect(response.code).toBe('BOT_NAME_INVALID');
    expect(response.category).toBe('validation');
    expect(response.severity).toBe('medium');
    expect(response.retryable).toBe(true);
    expect(response.message).toBe('Bot name validation failed');
    expect(response.statusCode).toBe(400);
    expect(response.context?.field).toBe('name');
    expect(response.context?.value).toBe('test');
    expect(response.traceId).toBe('trace-456');
    expect(response.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });

  it('создаёт BotErrorResponse для всех типов ошибок', () => {
    const errorTypes: BotErrorType[] = [
      'validation_error',
      'name_invalid',
      'policy_error',
      'permission_error',
      'not_found',
      'unknown_error',
    ];

    errorTypes.forEach((errorType) => {
      const response: BotErrorResponse = {
        error: errorType,
        code: createBotErrorCode('BOT_NAME_INVALID'),
        category: createBotErrorCategory('validation'),
        severity: createBotErrorSeverity('low'),
        retryable: false,
      };

      expect(response.error).toBe(errorType);
    });
  });

  it('создаёт BotErrorResponse с различными категориями', () => {
    const categories: BotErrorCategory[] = [
      'validation',
      'policy',
      'permission',
      'channel',
      'webhook',
      'parsing',
      'integration',
    ];

    categories.forEach((category) => {
      const response: BotErrorResponse = {
        error: 'validation_error',
        code: createBotErrorCode('BOT_NAME_INVALID'),
        category,
        severity: createBotErrorSeverity('low'),
        retryable: false,
      };

      expect(response.category).toBe(category);
    });
  });

  it('создаёт BotErrorResponse с различными уровнями severity', () => {
    const severities: BotErrorSeverity[] = ['low', 'medium', 'high', 'critical'];

    severities.forEach((severity) => {
      const response: BotErrorResponse = {
        error: 'validation_error',
        code: createBotErrorCode('BOT_NAME_INVALID'),
        category: createBotErrorCategory('validation'),
        severity,
        retryable: false,
      };

      expect(response.severity).toBe(severity);
    });
  });

  it('создаёт BotErrorResponse с retryable = true', () => {
    const response: BotErrorResponse = {
      error: 'unknown_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('low'),
      retryable: true,
    };

    expect(response.retryable).toBe(true);
  });

  it('создаёт BotErrorResponse с retryable = false', () => {
    const response: BotErrorResponse = {
      error: 'validation_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('low'),
      retryable: false,
    };

    expect(response.retryable).toBe(false);
  });

  it('создаёт BotErrorResponse с различными кодами ошибок', () => {
    const codes: BotErrorCode[] = [
      'BOT_NAME_INVALID',
      'BOT_POLICY_ACTION_DENIED',
      'BOT_PERMISSION_DENIED',
      'BOT_CHANNEL_NOT_FOUND',
    ];

    codes.forEach((code) => {
      const response: BotErrorResponse = {
        error: 'validation_error',
        code,
        category: createBotErrorCategory('validation'),
        severity: createBotErrorSeverity('low'),
        retryable: false,
      };

      expect(response.code).toBe(code);
    });
  });

  it('создаёт BotErrorResponse с полным context', () => {
    const response: BotErrorResponse = {
      error: 'policy_error',
      code: createBotErrorCode('BOT_POLICY_ACTION_DENIED'),
      category: createBotErrorCategory('policy'),
      severity: createBotErrorSeverity('high'),
      retryable: false,
      context: createErrorContextData({
        field: 'name',
        value: 'test-value',
        details: { key: 'value' },
        botId: 'bot-123' as any,
        version: 5,
        action: 'create' as any,
        policyReason: 'insufficient_role' as any,
        traceId: createTraceId('trace-789'),
      }),
    };

    expect(response.context?.field).toBe('name');
    expect(response.context?.value).toBe('test-value');
    expect(response.context?.details).toEqual({ key: 'value' });
    expect(response.context?.botId).toBe('bot-123');
    expect(response.context?.version).toBe(5);
    expect(response.context?.action).toBe('create');
    expect(response.context?.policyReason).toBe('insufficient_role');
    expect(response.context?.traceId).toBe('trace-789');
  });

  it('создаёт BotErrorResponse с различными statusCode', () => {
    const statusCodes = [400, 401, 403, 404, 500];

    statusCodes.forEach((statusCode) => {
      const response: BotErrorResponse = {
        error: 'validation_error',
        code: createBotErrorCode('BOT_NAME_INVALID'),
        category: createBotErrorCategory('validation'),
        severity: createBotErrorSeverity('low'),
        retryable: false,
        statusCode,
      };

      expect(response.statusCode).toBe(statusCode);
    });
  });

  it('создаёт BotErrorResponse с пустым message', () => {
    const response: BotErrorResponse = {
      error: 'validation_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('low'),
      retryable: false,
      message: '',
    };

    expect(response.message).toBe('');
  });

  it('создаёт BotErrorResponse с длинным message', () => {
    const longMessage = 'a'.repeat(1000);
    const response: BotErrorResponse = {
      error: 'validation_error',
      code: createBotErrorCode('BOT_NAME_INVALID'),
      category: createBotErrorCategory('validation'),
      severity: createBotErrorSeverity('low'),
      retryable: false,
      message: longMessage,
    };

    expect(response.message).toBe(longMessage);
  });
});
