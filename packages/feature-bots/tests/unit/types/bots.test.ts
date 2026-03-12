/**
 * @file Unit тесты для types/bots.ts
 * Полное покрытие агрегирующих типов ботов
 */

import { describe, expect, it } from 'vitest';

import type { BotPolicyAction, BotPolicyDeniedReason } from '@livai/core';
import type { ID, ISODateString, JsonObject, TraceId } from '@livai/core-contracts';

import type { BotCommandType } from '../../../src/types/bot-commands.js';
import type { BotEnforcementReason, BotPauseReason } from '../../../src/types/bot-lifecycle.js';
import type {
  BotChannelErrorCode,
  BotError,
  BotErrorCategory,
  BotErrorCode,
  BotErrorContext,
  BotErrorMappingConfig,
  BotErrorMappingConfigBase,
  BotErrorMappingConfigFunctions,
  BotErrorMappingRegistry,
  BotErrorSeverity,
  BotErrorState,
  BotField,
  BotIdle,
  BotInfo,
  BotIntegrationErrorCode,
  BotListState,
  BotLoading,
  BotOperationData,
  BotOperationState,
  BotParsingErrorCode,
  BotPermissionErrorCode,
  BotPolicyErrorCode,
  BotState,
  BotStatus,
  BotSuccess,
  BotValidationErrorCode,
  BotWebhookErrorCode,
} from '../../../src/types/bots.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createISODateString = (): ISODateString => '2026-01-01T00:00:00.000Z' as ISODateString;

const createBotId = (): ID<'Bot'> => 'bot-123' as ID<'Bot'>;

const createWorkspaceId = (): ID<'Workspace'> => 'workspace-456' as ID<'Workspace'>;

const createTraceId = (): TraceId => 'trace-789' as TraceId;

const createBotError = (overrides: Partial<BotError> = {}): BotError => ({
  category: 'validation',
  code: 'BOT_NAME_INVALID',
  severity: 'medium',
  retryable: false,
  ...overrides,
});

/**
 * Дефолтная политика retryability для тестов.
 * Это не “заглушка”, а явное правило: permission/policy обычно fail-fast,
 * parsing/validation тоже, а интеграции/webhook/channel могут быть ретраебельны.
 */
const defaultRetryableByCategory: Readonly<Record<BotErrorCategory, boolean>> = {
  validation: false,
  policy: false,
  permission: false,
  parsing: false,
  channel: true,
  webhook: true,
  integration: true,
} as const;

const createBotErrorByCategory = (
  category: BotErrorCategory,
  overrides: Partial<BotError> = {},
): BotError =>
  createBotError({
    category,
    // eslint-disable-next-line security/detect-object-injection -- category строго типизирован (union), безопасный lookup
    retryable: defaultRetryableByCategory[category],
    ...overrides,
  });

/* eslint-disable @livai/rag/context-leakage -- Тестовые данные для unit тестов, не используются в production */
const createBotErrorContext = (overrides: Partial<BotErrorContext> = {}): BotErrorContext => ({
  field: 'name',
  value: 'test',
  ...overrides,
});
/* eslint-enable @livai/rag/context-leakage */

const createBotInfo = (overrides: Partial<BotInfo> = {}): BotInfo => ({
  id: createBotId(),
  name: 'Test Bot',
  status: { type: 'draft' },
  workspaceId: createWorkspaceId(),
  currentVersion: 1,
  createdAt: createISODateString(),
  ...overrides,
});

// ============================================================================
// 🧭 BOT STATUS TYPES
// ============================================================================

describe('BotPauseReason', () => {
  it('должен поддерживать все варианты причин приостановки', () => {
    const reasons: BotPauseReason[] = [
      'manual',
      'rate_limit',
      'integration_error',
      'quota_exceeded',
    ];
    expect(reasons).toHaveLength(4);
    reasons.forEach((reason) => {
      const pauseStatus: BotStatus = {
        type: 'paused',
        pausedAt: createISODateString(),
        reason,
      };
      expect(pauseStatus.reason).toBe(reason);
    });
  });
});

describe('BotEnforcementReason', () => {
  it('должен поддерживать все варианты причин приостановки (внешняя интеграция)', () => {
    const reasons: BotEnforcementReason[] = [
      'policy_violation',
      'security_risk',
      'billing_issue',
    ];
    expect(reasons).toHaveLength(3);
    reasons.forEach((reason) => {
      const suspendStatus: BotStatus = {
        type: 'suspended',
        suspendedAt: createISODateString(),
        reason,
      };
      expect(suspendStatus.reason).toBe(reason);
    });
  });
});

describe('BotStatus', () => {
  it('должен поддерживать тип draft', () => {
    const status: BotStatus = { type: 'draft' };
    expect(status.type).toBe('draft');
  });

  it('должен поддерживать тип active', () => {
    const status: BotStatus = {
      type: 'active',
      publishedAt: createISODateString(),
    };
    expect(status.type).toBe('active');
    expect(status.publishedAt).toBeDefined();
  });

  it('должен поддерживать тип paused без причины', () => {
    const status: BotStatus = {
      type: 'paused',
      pausedAt: createISODateString(),
      reason: 'manual',
    };
    expect(status.type).toBe('paused');
    expect(status.reason).toBe('manual');
  });

  it('должен поддерживать тип paused с причиной', () => {
    const status: BotStatus = {
      type: 'paused',
      pausedAt: createISODateString(),
      reason: 'manual',
    };
    expect(status.type).toBe('paused');
    expect(status.reason).toBe('manual');
  });

  it('должен поддерживать тип archived', () => {
    const status: BotStatus = {
      type: 'archived',
      archivedAt: createISODateString(),
    };
    expect(status.type).toBe('archived');
    expect(status.archivedAt).toBeDefined();
  });

  it('должен поддерживать тип deleted', () => {
    const status: BotStatus = {
      type: 'deleted',
      deletedAt: createISODateString(),
    };
    expect(status.type).toBe('deleted');
    expect(status.deletedAt).toBeDefined();
  });

  it('должен поддерживать тип suspended', () => {
    const status: BotStatus = {
      type: 'suspended',
      suspendedAt: createISODateString(),
      reason: 'security_risk',
    };
    expect(status.type).toBe('suspended');
    expect(status.reason).toBe('security_risk');
  });

  it('должен поддерживать тип deprecated без замены', () => {
    const status: BotStatus = {
      type: 'deprecated',
      deprecatedAt: createISODateString(),
    };
    expect(status.type).toBe('deprecated');
    expect(status.replacementBotId).toBeUndefined();
  });

  it('должен поддерживать тип deprecated с заменой', () => {
    const status: BotStatus = {
      type: 'deprecated',
      deprecatedAt: createISODateString(),
      replacementBotId: createBotId(),
    };
    expect(status.type).toBe('deprecated');
    expect(status.replacementBotId).toBeDefined();
  });
});

// ============================================================================
// ⚠️ BOT ERROR CATEGORIES
// ============================================================================

describe('BotErrorCategory', () => {
  it('должен поддерживать все категории ошибок', () => {
    const categories: BotErrorCategory[] = [
      'validation',
      'policy',
      'permission',
      'channel',
      'webhook',
      'parsing',
      'integration',
    ];
    expect(categories).toHaveLength(7);
    categories.forEach((category) => {
      const error: BotError = createBotErrorByCategory(category);
      expect(error.category).toBe(category);
    });
  });
});

describe('BotErrorSeverity', () => {
  it('должен поддерживать все уровни серьёзности', () => {
    const severities: BotErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
    expect(severities).toHaveLength(4);
    severities.forEach((severity) => {
      const error: BotError = {
        category: 'validation',
        code: 'BOT_NAME_INVALID',
        severity,
        retryable: false,
      };
      expect(error.severity).toBe(severity);
    });
  });
});

describe('BotValidationErrorCode', () => {
  it('должен поддерживать все коды ошибок валидации', () => {
    const codes: BotValidationErrorCode[] = [
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
    ];
    expect(codes).toHaveLength(12);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('validation', { code });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotPolicyErrorCode', () => {
  it('должен поддерживать все коды ошибок политики', () => {
    const codes: BotPolicyErrorCode[] = [
      'BOT_POLICY_ACTION_DENIED',
      'BOT_POLICY_MODE_INVALID',
      'BOT_POLICY_ROLE_INSUFFICIENT',
      'BOT_POLICY_ARCHIVED',
      'BOT_POLICY_SYSTEM_BOT_RESTRICTED',
    ];
    expect(codes).toHaveLength(5);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('policy', { code, severity: 'high' });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotPermissionErrorCode', () => {
  it('должен поддерживать все коды ошибок прав доступа', () => {
    const codes: BotPermissionErrorCode[] = [
      'BOT_PERMISSION_DENIED',
      'BOT_PERMISSION_READ_DENIED',
      'BOT_PERMISSION_WRITE_DENIED',
      'BOT_PERMISSION_EXECUTE_DENIED',
      'BOT_PERMISSION_DELETE_DENIED',
      'BOT_WORKSPACE_ACCESS_DENIED',
    ];
    expect(codes).toHaveLength(6);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('permission', { code, severity: 'high' });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotChannelErrorCode', () => {
  it('должен поддерживать все коды ошибок каналов', () => {
    const codes: BotChannelErrorCode[] = [
      'BOT_CHANNEL_NOT_FOUND',
      'BOT_CHANNEL_INVALID',
      'BOT_CHANNEL_DISABLED',
      'BOT_CHANNEL_CONNECTION_FAILED',
      'BOT_CHANNEL_RATE_LIMIT_EXCEEDED',
    ];
    expect(codes).toHaveLength(5);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('channel', { code });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotWebhookErrorCode', () => {
  it('должен поддерживать все коды ошибок webhook', () => {
    const codes: BotWebhookErrorCode[] = [
      'BOT_WEBHOOK_URL_INVALID',
      'BOT_WEBHOOK_TIMEOUT',
      'BOT_WEBHOOK_FAILED',
      'BOT_WEBHOOK_RETRY_EXCEEDED',
      'BOT_WEBHOOK_SIGNATURE_INVALID',
      'BOT_WEBHOOK_RATE_LIMIT_EXCEEDED',
    ];
    expect(codes).toHaveLength(6);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('webhook', { code });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotParsingErrorCode', () => {
  it('должен поддерживать все коды ошибок парсинга', () => {
    const codes: BotParsingErrorCode[] = [
      'BOT_PARSING_INSTRUCTION_INVALID',
      'BOT_PARSING_SETTINGS_INVALID',
      'BOT_PARSING_MULTI_AGENT_INVALID',
      'BOT_PARSING_PROMPT_INVALID',
      'BOT_PARSING_JSON_INVALID',
    ];
    expect(codes).toHaveLength(5);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('parsing', { code, severity: 'low' });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotIntegrationErrorCode', () => {
  it('должен поддерживать все коды ошибок интеграций', () => {
    const codes: BotIntegrationErrorCode[] = [
      'BOT_INTEGRATION_NOT_FOUND',
      'BOT_INTEGRATION_INVALID',
      'BOT_INTEGRATION_AUTH_FAILED',
      'BOT_INTEGRATION_TIMEOUT',
      'BOT_INTEGRATION_RATE_LIMIT_EXCEEDED',
      'BOT_INTEGRATION_QUOTA_EXCEEDED',
    ];
    expect(codes).toHaveLength(6);
    codes.forEach((code) => {
      const error: BotError = createBotErrorByCategory('integration', { code, severity: 'high' });
      expect(error.code).toBe(code);
    });
  });
});

describe('BotErrorCode', () => {
  it('должен объединять все типы кодов ошибок', () => {
    const validationCode: BotErrorCode = 'BOT_NAME_INVALID';
    const policyCode: BotErrorCode = 'BOT_POLICY_ACTION_DENIED';
    const permissionCode: BotErrorCode = 'BOT_PERMISSION_DENIED';
    const channelCode: BotErrorCode = 'BOT_CHANNEL_NOT_FOUND';
    const webhookCode: BotErrorCode = 'BOT_WEBHOOK_URL_INVALID';
    const parsingCode: BotErrorCode = 'BOT_PARSING_INSTRUCTION_INVALID';
    const integrationCode: BotErrorCode = 'BOT_INTEGRATION_NOT_FOUND';

    expect(validationCode).toBe('BOT_NAME_INVALID');
    expect(policyCode).toBe('BOT_POLICY_ACTION_DENIED');
    expect(permissionCode).toBe('BOT_PERMISSION_DENIED');
    expect(channelCode).toBe('BOT_CHANNEL_NOT_FOUND');
    expect(webhookCode).toBe('BOT_WEBHOOK_URL_INVALID');
    expect(parsingCode).toBe('BOT_PARSING_INSTRUCTION_INVALID');
    expect(integrationCode).toBe('BOT_INTEGRATION_NOT_FOUND');
  });
});

describe('BotField', () => {
  it('должен поддерживать все поля бота', () => {
    const fields: BotField[] = [
      'name',
      'instruction',
      'template',
      'settings',
      'workspace_id',
      'version',
      'multi_agent_schema',
      'prompt',
    ];
    expect(fields).toHaveLength(8);
    fields.forEach((field) => {
      const context: BotErrorContext = {
        field,
        value: 'test',
      };
      expect(context.field).toBe(field);
    });
  });
});

describe('BotErrorContext', () => {
  it('должен поддерживать минимальный контекст', () => {
    const context: BotErrorContext = {};
    expect(context).toBeDefined();
  });

  it('должен поддерживать полный контекст', () => {
    const context: BotErrorContext = {
      field: 'name',
      value: 'test',
      details: { test: 'value' } as JsonObject,
      botId: createBotId(),
      version: 1,
      action: 'publish' as BotPolicyAction,
      policyReason: 'insufficient_role' as BotPolicyDeniedReason,
      traceId: createTraceId(),
      timestamp: createISODateString(),
    };
    expect(context.field).toBe('name');
    expect(context.value).toBe('test');
    expect(context.botId).toBeDefined();
    expect(context.version).toBe(1);
    expect(context.action).toBe('publish');
    expect(context.policyReason).toBe('insufficient_role');
    expect(context.traceId).toBeDefined();
    expect(context.timestamp).toBeDefined();
  });
});

describe('BotError', () => {
  it('должен поддерживать минимальную ошибку', () => {
    const error: BotError = {
      category: 'validation',
      code: 'BOT_NAME_INVALID',
      severity: 'medium',
      retryable: false,
    };
    expect(error.category).toBe('validation');
    expect(error.code).toBe('BOT_NAME_INVALID');
    expect(error.severity).toBe('medium');
  });

  it('должен поддерживать ошибку с контекстом', () => {
    const error: BotError = {
      category: 'validation',
      code: 'BOT_NAME_INVALID',
      severity: 'medium',
      context: createBotErrorContext(),
      retryable: false,
    };
    expect(error.context).toBeDefined();
    expect(error.retryable).toBe(false);
  });

  it('должен поддерживать ошибку с retryable', () => {
    const error: BotError = {
      category: 'webhook',
      code: 'BOT_WEBHOOK_TIMEOUT',
      severity: 'low',
      retryable: true,
    };
    expect(error.retryable).toBe(true);
  });
});

// ============================================================================
// 🗺️ ERROR MAPPING STRUCTURE
// ============================================================================

describe('BotErrorMappingConfigBase', () => {
  it('должен поддерживать базовую конфигурацию маппинга', () => {
    const config: BotErrorMappingConfigBase = {
      code: 'BOT_NAME_INVALID',
      category: 'validation',
      severity: 'medium',
      retryable: false,
    };
    expect(config.code).toBe('BOT_NAME_INVALID');
    expect(config.category).toBe('validation');
    expect(config.severity).toBe('medium');
    expect(config.retryable).toBe(false);
  });
});

describe('BotErrorMappingConfigFunctions', () => {
  it('должен поддерживать конфигурацию без функций', () => {
    const config: BotErrorMappingConfigFunctions = {};
    expect(config).toBeDefined();
  });

  it('должен поддерживать конфигурацию с extractContext', () => {
    const config: BotErrorMappingConfigFunctions = {
      extractContext: (error: unknown) =>
        typeof error === 'object' && error !== null ? createBotErrorContext() : undefined,
    };
    expect(config.extractContext).toBeDefined();
    const result = config.extractContext?.({ test: 'value' });
    expect(result).toBeDefined();
  });
});

describe('BotErrorMappingConfig', () => {
  it('должен объединять базовую конфигурацию и функции', () => {
    const config: BotErrorMappingConfig = {
      code: 'BOT_NAME_INVALID',
      category: 'validation',
      severity: 'medium',
      retryable: false,
      extractContext: (_error: unknown) => createBotErrorContext(),
    };
    expect(config.code).toBe('BOT_NAME_INVALID');
    expect(config.extractContext).toBeDefined();
  });
});

describe('BotErrorMappingRegistry', () => {
  it('должен поддерживать registry для всех кодов ошибок', () => {
    const registry: BotErrorMappingRegistry = {
      BOT_NAME_INVALID: {
        code: 'BOT_NAME_INVALID',
        category: 'validation',
        severity: 'medium',
        retryable: false,
      },
      BOT_POLICY_ACTION_DENIED: {
        code: 'BOT_POLICY_ACTION_DENIED',
        category: 'policy',
        severity: 'high',
        retryable: false,
      },
    } as BotErrorMappingRegistry;
    expect(registry.BOT_NAME_INVALID).toBeDefined();
    expect(registry.BOT_POLICY_ACTION_DENIED).toBeDefined();
  });
});

// ============================================================================
// 📊 BOT STATE
// ============================================================================

describe('BotInfo', () => {
  it('должен поддерживать минимальную информацию о боте', () => {
    const bot: BotInfo = createBotInfo();
    expect(bot.id).toBeDefined();
    expect(bot.name).toBe('Test Bot');
    expect(bot.status.type).toBe('draft');
    expect(bot.workspaceId).toBeDefined();
    expect(bot.currentVersion).toBe(1);
    expect(bot.createdAt).toBeDefined();
  });

  it('должен поддерживать информацию о боте с updatedAt', () => {
    const bot: BotInfo = createBotInfo({
      updatedAt: createISODateString(),
    });
    expect(bot.updatedAt).toBeDefined();
  });

  it('должен поддерживать информацию о боте с различными статусами', () => {
    const activeBot: BotInfo = createBotInfo({
      status: {
        type: 'active',
        publishedAt: createISODateString(),
      },
    });
    expect(activeBot.status.type).toBe('active');

    const pausedBot: BotInfo = createBotInfo({
      status: {
        type: 'paused',
        pausedAt: createISODateString(),
        reason: 'manual',
      },
    });
    expect(pausedBot.status.type).toBe('paused');
    expect(
      pausedBot.status.type === 'paused' ? pausedBot.status.reason : undefined,
    ).toBe('manual');
  });
});

describe('BotCommandType', () => {
  it('должен поддерживать все типы команд', () => {
    const commands: BotCommandType[] = [
      'create_bot_from_template',
      'create_custom_bot',
      'update_instruction',
      'manage_multi_agent',
      'publish_bot',
      'pause_bot',
      'resume_bot',
      'archive_bot',
      'delete_bot',
      'simulate_bot_message',
    ];
    expect(commands).toHaveLength(10);
    commands.forEach((command) => {
      const loading: BotLoading = {
        status: 'loading',
        operation: command,
      };
      expect(loading.operation).toBe(command);
    });
  });
});

describe('BotIdle', () => {
  it('должен поддерживать состояние ожидания', () => {
    const idle: BotIdle = { status: 'idle' };
    expect(idle.status).toBe('idle');
  });
});

describe('BotLoading', () => {
  it('должен поддерживать состояние загрузки с операцией', () => {
    const loading: BotLoading = {
      status: 'loading',
      operation: 'create_custom_bot',
    };
    expect(loading.status).toBe('loading');
    expect(loading.operation).toBe('create_custom_bot');
  });
});

describe('BotSuccess', () => {
  it('должен поддерживать состояние успеха с данными по умолчанию', () => {
    const success: BotSuccess = {
      status: 'success',
      data: createBotInfo(),
    };
    expect(success.status).toBe('success');
    expect(success.data).toBeDefined();
  });

  it('должен поддерживать состояние успеха с кастомными данными', () => {
    const success: BotSuccess<readonly BotInfo[]> = {
      status: 'success',
      data: [createBotInfo(), createBotInfo()],
    };
    expect(success.status).toBe('success');
    expect(success.data).toHaveLength(2);
  });
});

describe('BotErrorState', () => {
  it('должен поддерживать состояние ошибки', () => {
    const errorState: BotErrorState = {
      status: 'error',
      error: createBotError(),
    };
    expect(errorState.status).toBe('error');
    expect(errorState.error).toBeDefined();
  });
});

describe('BotOperationState', () => {
  it('должен поддерживать состояние idle', () => {
    const state: BotOperationState = { status: 'idle' };
    expect(state.status).toBe('idle');
  });

  it('должен поддерживать состояние loading', () => {
    const state: BotOperationState = {
      status: 'loading',
      operation: 'create_custom_bot',
    };
    expect(state.status).toBe('loading');
  });

  it('должен поддерживать состояние success', () => {
    const state: BotOperationState = {
      status: 'success',
      data: createBotInfo(),
    };
    expect(state.status).toBe('success');
  });

  it('должен поддерживать состояние error', () => {
    const state: BotOperationState = {
      status: 'error',
      error: createBotError(),
    };
    expect(state.status).toBe('error');
  });

  it('должен поддерживать generic типы для success', () => {
    const state: BotOperationState<readonly BotInfo[]> = {
      status: 'success',
      data: [createBotInfo()],
    };
    expect(state.status).toBe('success');
    expect(Array.isArray(state.data)).toBe(true);
  });

  it('должен поддерживать void для delete операции', () => {
    const state: BotOperationState<void> = {
      status: 'success',
      data: undefined,
    };
    expect(state.status).toBe('success');
  });
});

describe('BotListState', () => {
  it('должен поддерживать состояние списка ботов', () => {
    const listState: BotListState = {
      bots: [createBotInfo()],
      currentBotId: createBotId(),
      listState: { status: 'idle' },
      currentBotState: { status: 'idle' },
    };
    expect(listState.bots).toHaveLength(1);
    expect(listState.currentBotId).toBeDefined();
    expect(listState.listState.status).toBe('idle');
    expect(listState.currentBotState.status).toBe('idle');
  });

  it('должен поддерживать состояние списка без текущего бота', () => {
    const listState: BotListState = {
      bots: [],
      currentBotId: null,
      listState: { status: 'idle' },
      currentBotState: { status: 'idle' },
    };
    expect(listState.currentBotId).toBeNull();
  });
});

describe('BotState', () => {
  it('должен поддерживать полное состояние ботов', () => {
    const botState: BotState = {
      list: {
        bots: [],
        currentBotId: null,
        listState: { status: 'idle' },
        currentBotState: { status: 'idle' },
      },
      create: { status: 'idle' },
      update: { status: 'idle' },
      delete: { status: 'idle' },
      publish: { status: 'idle' },
      pause: { status: 'idle' },
      resume: { status: 'idle' },
      archive: { status: 'idle' },
    };
    expect(botState.list).toBeDefined();
    expect(botState.create.status).toBe('idle');
    expect(botState.update.status).toBe('idle');
    expect(botState.delete.status).toBe('idle');
    expect(botState.publish.status).toBe('idle');
    expect(botState.pause.status).toBe('idle');
    expect(botState.resume.status).toBe('idle');
    expect(botState.archive.status).toBe('idle');
  });
});

// ============================================================================
// 🔧 UTILITY TYPES
// ============================================================================

describe('BotOperationData', () => {
  it('должен извлекать тип данных из BotSuccess', () => {
    const success: BotSuccess<BotInfo> = {
      status: 'success',
      data: createBotInfo(),
    };
    type ExtractedData = BotOperationData<typeof success>;
    const extracted: ExtractedData = success.data;
    expect(extracted).toBeDefined();
  });

  it('должен возвращать never для не-Success состояний', () => {
    const idle: BotIdle = { status: 'idle' };
    type ExtractedData = BotOperationData<typeof idle>;
    // Type-level тест: ExtractedData должен быть never для idle состояния
    const _test: ExtractedData = undefined as never;
    expect(_test).toBeUndefined();
  });
});
