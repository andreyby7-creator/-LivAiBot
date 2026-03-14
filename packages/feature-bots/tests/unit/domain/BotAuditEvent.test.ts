/**
 * @file Unit тесты для domain/BotAuditEvent.ts
 * Покрывают BotAuditEvent типы и createBotAuditEventInvariantError.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type {
  BotId,
  BotUserId,
  BotVersion,
  BotWorkspaceId,
  Timestamp,
} from '../../../src/domain/Bot.js';
import type {
  BotAuditEvent,
  BotAuditEventContextMap,
  BotAuditEventInvariantError,
  BotAuditEventType,
  BotCreatedContext,
  BotDeletedContext,
  BotPublishedContext,
  BotUpdatedContext,
  ConfigChangedContext,
  EventId,
  InstructionUpdatedContext,
  MultiAgentUpdatedContext,
  PolicyViolationContext,
} from '../../../src/domain/BotAuditEvent.js';
import { createBotAuditEventInvariantError } from '../../../src/domain/BotAuditEvent.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createEventId = (value = 'event-1'): EventId => value as EventId;
const createBotId = (value = 'bot-1'): BotId => value as BotId;
const createWorkspaceId = (value = 'workspace-1'): BotWorkspaceId => value as BotWorkspaceId;
const createUserId = (value = 'user-1'): BotUserId => value as BotUserId;
const createBotVersion = (value = 0): BotVersion => value as BotVersion;
const createTimestamp = (value = 1): Timestamp => value as Timestamp;

// ============================================================================
// Тесты для createBotAuditEventInvariantError
// ============================================================================

// eslint-disable-next-line ai-security/token-leakage -- false positive: function name, not a token
describe('createBotAuditEventInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error = createBotAuditEventInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BotAuditEventInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createBotAuditEventInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
    expect(error.stack).toBeTruthy();
  });

  it('создаёт frozen error объект', () => {
    const error = createBotAuditEventInvariantError('frozen-test');

    expect(Object.isFrozen(error)).toBe(true);
  });

  it('работает с пустой строкой', () => {
    const error = createBotAuditEventInvariantError('');

    expect(error.message).toBe('');
    expect(error.name).toBe('BotAuditEventInvariantError');
  });

  it('работает с длинным сообщением', () => {
    const longMessage = 'a'.repeat(1000);
    const error = createBotAuditEventInvariantError(longMessage);

    expect(error.message).toBe(longMessage);
  });

  it('создаёт ошибку, совместимую с BotAuditEventInvariantError типом', () => {
    const error: BotAuditEventInvariantError = createBotAuditEventInvariantError('type-test');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BotAuditEventInvariantError');
  });
});

// ============================================================================
// Тесты для EventId
// ============================================================================

describe('EventId', () => {
  it('создаёт EventId', () => {
    const eventId: EventId = createEventId('test-event');
    expect(eventId).toBe('test-event');
  });

  it('создаёт EventId с различными значениями', () => {
    const eventId1: EventId = createEventId('event-1');
    const eventId2: EventId = createEventId('event-2');

    expect(eventId1).toBe('event-1');
    expect(eventId2).toBe('event-2');
  });
});

// ============================================================================
// Тесты для BotAuditEventType
// ============================================================================

describe('BotAuditEventType', () => {
  it('поддерживает все значения union типа', () => {
    const types: BotAuditEventType[] = [
      'bot_created',
      'bot_published',
      'bot_updated',
      'bot_deleted',
      'instruction_updated',
      'multi_agent_updated',
      'config_changed',
      'policy_violation',
    ];

    expect(types).toHaveLength(8);
    expect(types).toContain('bot_created');
    expect(types).toContain('bot_published');
    expect(types).toContain('bot_updated');
    expect(types).toContain('bot_deleted');
    expect(types).toContain('instruction_updated');
    expect(types).toContain('multi_agent_updated');
    expect(types).toContain('config_changed');
    expect(types).toContain('policy_violation');
  });
});

// ============================================================================
// Тесты для BotCreatedContext
// ============================================================================

describe('BotCreatedContext', () => {
  it('создаёт BotCreatedContext с пустым объектом', () => {
    const context: BotCreatedContext = {};

    expect(context).toEqual({});
  });

  it('создаёт BotCreatedContext с дополнительными полями', () => {
    const context: BotCreatedContext = {
      name: 'Test Bot',
      description: 'Test description',
    };

    expect(context['name']).toBe('Test Bot');
    expect(context['description']).toBe('Test description');
  });
});

// ============================================================================
// Тесты для BotPublishedContext
// ============================================================================

describe('BotPublishedContext', () => {
  it('создаёт BotPublishedContext без полей', () => {
    const context: BotPublishedContext = {};

    expect(context.version).toBeUndefined();
    expect(context.previousVersion).toBeUndefined();
  });

  it('создаёт BotPublishedContext с version', () => {
    const context: BotPublishedContext = {
      version: createBotVersion(5),
    };

    expect(context.version).toBe(5);
    expect(context.previousVersion).toBeUndefined();
  });

  it('создаёт BotPublishedContext с previousVersion', () => {
    const context: BotPublishedContext = {
      previousVersion: createBotVersion(3),
    };

    expect(context.version).toBeUndefined();
    expect(context.previousVersion).toBe(3);
  });

  it('создаёт BotPublishedContext с обоими полями', () => {
    const context: BotPublishedContext = {
      version: createBotVersion(5),
      previousVersion: createBotVersion(3),
    };

    expect(context.version).toBe(5);
    expect(context.previousVersion).toBe(3);
  });
});

// ============================================================================
// Тесты для BotUpdatedContext
// ============================================================================

describe('BotUpdatedContext', () => {
  it('создаёт BotUpdatedContext без полей', () => {
    const context: BotUpdatedContext = {};

    expect(context.updatedFields).toBeUndefined();
  });

  it('создаёт BotUpdatedContext с updatedFields', () => {
    const context: BotUpdatedContext = {
      updatedFields: ['name', 'description'],
    };

    expect(context.updatedFields).toEqual(['name', 'description']);
  });

  it('создаёт BotUpdatedContext с пустым массивом updatedFields', () => {
    const context: BotUpdatedContext = {
      updatedFields: [],
    };

    expect(context.updatedFields).toEqual([]);
  });
});

// ============================================================================
// Тесты для BotDeletedContext
// ============================================================================

describe('BotDeletedContext', () => {
  it('создаёт BotDeletedContext с пустым объектом', () => {
    const context: BotDeletedContext = {};

    expect(context).toEqual({});
  });

  it('создаёт BotDeletedContext с дополнительными полями', () => {
    const context: BotDeletedContext = {
      reason: 'User request',
      deletedBy: 'admin',
    };

    expect(context['reason']).toBe('User request');
    expect(context['deletedBy']).toBe('admin');
  });
});

// ============================================================================
// Тесты для InstructionUpdatedContext
// ============================================================================

describe('InstructionUpdatedContext', () => {
  it('создаёт InstructionUpdatedContext без полей', () => {
    const context: InstructionUpdatedContext = {};

    expect(context.version).toBeUndefined();
    expect(context.previousVersion).toBeUndefined();
  });

  it('создаёт InstructionUpdatedContext с version', () => {
    const context: InstructionUpdatedContext = {
      version: createBotVersion(10),
    };

    expect(context.version).toBe(10);
    expect(context.previousVersion).toBeUndefined();
  });

  it('создаёт InstructionUpdatedContext с previousVersion', () => {
    const context: InstructionUpdatedContext = {
      previousVersion: createBotVersion(8),
    };

    expect(context.version).toBeUndefined();
    expect(context.previousVersion).toBe(8);
  });

  it('создаёт InstructionUpdatedContext с обоими полями', () => {
    const context: InstructionUpdatedContext = {
      version: createBotVersion(10),
      previousVersion: createBotVersion(8),
    };

    expect(context.version).toBe(10);
    expect(context.previousVersion).toBe(8);
  });
});

// ============================================================================
// Тесты для MultiAgentUpdatedContext
// ============================================================================

describe('MultiAgentUpdatedContext', () => {
  it('создаёт MultiAgentUpdatedContext без полей', () => {
    const context: MultiAgentUpdatedContext = {};

    expect(context.version).toBeUndefined();
    expect(context.previousVersion).toBeUndefined();
  });

  it('создаёт MultiAgentUpdatedContext с version', () => {
    const context: MultiAgentUpdatedContext = {
      version: createBotVersion(15),
    };

    expect(context.version).toBe(15);
    expect(context.previousVersion).toBeUndefined();
  });

  it('создаёт MultiAgentUpdatedContext с previousVersion', () => {
    const context: MultiAgentUpdatedContext = {
      previousVersion: createBotVersion(12),
    };

    expect(context.version).toBeUndefined();
    expect(context.previousVersion).toBe(12);
  });

  it('создаёт MultiAgentUpdatedContext с обоими полями', () => {
    const context: MultiAgentUpdatedContext = {
      version: createBotVersion(15),
      previousVersion: createBotVersion(12),
    };

    expect(context.version).toBe(15);
    expect(context.previousVersion).toBe(12);
  });
});

// ============================================================================
// Тесты для ConfigChangedContext
// ============================================================================

describe('ConfigChangedContext', () => {
  it('создаёт ConfigChangedContext без полей', () => {
    const context: ConfigChangedContext = {};

    expect(context.changedFields).toBeUndefined();
  });

  it('создаёт ConfigChangedContext с changedFields', () => {
    const context: ConfigChangedContext = {
      changedFields: ['timeout', 'retryCount'],
    };

    expect(context.changedFields).toEqual(['timeout', 'retryCount']);
  });

  it('создаёт ConfigChangedContext с пустым массивом changedFields', () => {
    const context: ConfigChangedContext = {
      changedFields: [],
    };

    expect(context.changedFields).toEqual([]);
  });
});

// ============================================================================
// Тесты для PolicyViolationContext
// ============================================================================

describe('PolicyViolationContext', () => {
  it('создаёт PolicyViolationContext без полей', () => {
    const context: PolicyViolationContext = {};

    expect(context.policyId).toBeUndefined();
    expect(context.errorCode).toBeUndefined();
    expect(context.violation).toBeUndefined();
  });

  it('создаёт PolicyViolationContext с policyId', () => {
    const context: PolicyViolationContext = {
      policyId: 'policy-1',
    };

    expect(context.policyId).toBe('policy-1');
  });

  it('создаёт PolicyViolationContext с errorCode', () => {
    const context: PolicyViolationContext = {
      errorCode: 'ERR_001',
    };

    expect(context.errorCode).toBe('ERR_001');
  });

  it('создаёт PolicyViolationContext с violation', () => {
    const context: PolicyViolationContext = {
      violation: 'Invalid configuration',
    };

    expect(context.violation).toBe('Invalid configuration');
  });

  it('создаёт PolicyViolationContext со всеми полями', () => {
    const context: PolicyViolationContext = {
      policyId: 'policy-1',
      errorCode: 'ERR_001',
      violation: 'Invalid configuration',
    };

    expect(context.policyId).toBe('policy-1');
    expect(context.errorCode).toBe('ERR_001');
    expect(context.violation).toBe('Invalid configuration');
  });
});

// ============================================================================
// Тесты для BotAuditEventContextMap
// ============================================================================

describe('BotAuditEventContextMap', () => {
  it('поддерживает все типы контекстов', () => {
    const contextMap: BotAuditEventContextMap = {
      bot_created: {},
      bot_published: { version: createBotVersion(1) },
      bot_updated: { updatedFields: ['name'] },
      bot_deleted: {},
      instruction_updated: { version: createBotVersion(2) },
      multi_agent_updated: { version: createBotVersion(3) },
      config_changed: { changedFields: ['timeout'] },
      policy_violation: { policyId: 'policy-1' },
    };

    expect(contextMap.bot_created).toEqual({});
    expect(contextMap.bot_published.version).toBe(1);
    expect(contextMap.bot_updated.updatedFields).toEqual(['name']);
    expect(contextMap.bot_deleted).toEqual({});
    expect(contextMap.instruction_updated.version).toBe(2);
    expect(contextMap.multi_agent_updated.version).toBe(3);
    expect(contextMap.config_changed.changedFields).toEqual(['timeout']);
    expect(contextMap.policy_violation.policyId).toBe('policy-1');
  });
});

// ============================================================================
// Тесты для BotAuditEvent
// ============================================================================

describe('BotAuditEvent', () => {
  it('создаёт BotAuditEvent типа bot_created без context и userId', () => {
    const event: BotAuditEvent<'bot_created'> = {
      eventId: createEventId('event-1'),
      type: 'bot_created',
      botId: createBotId('bot-1'),
      workspaceId: createWorkspaceId('workspace-1'),
      timestamp: createTimestamp(1000),
    };

    expect(event.eventId).toBe('event-1');
    expect(event.type).toBe('bot_created');
    expect(event.botId).toBe('bot-1');
    expect(event.workspaceId).toBe('workspace-1');
    expect(event.timestamp).toBe(1000);
    expect(event.userId).toBeUndefined();
    expect(event.context).toBeUndefined();
  });

  it('создаёт BotAuditEvent типа bot_created с context и userId', () => {
    const event: BotAuditEvent<'bot_created'> = {
      eventId: createEventId('event-2'),
      type: 'bot_created',
      botId: createBotId('bot-2'),
      workspaceId: createWorkspaceId('workspace-2'),
      timestamp: createTimestamp(2000),
      userId: createUserId('user-1'),
      context: { name: 'Test Bot' },
    };

    expect(event.userId).toBe('user-1');
    expect(event.context?.['name']).toBe('Test Bot');
  });

  it('создаёт BotAuditEvent типа bot_published без context', () => {
    const event: BotAuditEvent<'bot_published'> = {
      eventId: createEventId('event-3'),
      type: 'bot_published',
      botId: createBotId('bot-3'),
      workspaceId: createWorkspaceId('workspace-3'),
      timestamp: createTimestamp(3000),
    };

    expect(event.type).toBe('bot_published');
    expect(event.context).toBeUndefined();
  });

  it('создаёт BotAuditEvent типа bot_published с context', () => {
    const event: BotAuditEvent<'bot_published'> = {
      eventId: createEventId('event-4'),
      type: 'bot_published',
      botId: createBotId('bot-4'),
      workspaceId: createWorkspaceId('workspace-4'),
      timestamp: createTimestamp(4000),
      context: {
        version: createBotVersion(5),
        previousVersion: createBotVersion(3),
      },
    };

    expect(event.context?.version).toBe(5);
    expect(event.context?.previousVersion).toBe(3);
  });

  it('создаёт BotAuditEvent типа bot_updated с context', () => {
    const event: BotAuditEvent<'bot_updated'> = {
      eventId: createEventId('event-5'),
      type: 'bot_updated',
      botId: createBotId('bot-5'),
      workspaceId: createWorkspaceId('workspace-5'),
      timestamp: createTimestamp(5000),
      context: {
        updatedFields: ['name', 'description'],
      },
    };

    expect(event.type).toBe('bot_updated');
    expect(event.context?.updatedFields).toEqual(['name', 'description']);
  });

  it('создаёт BotAuditEvent типа bot_deleted', () => {
    const event: BotAuditEvent<'bot_deleted'> = {
      eventId: createEventId('event-6'),
      type: 'bot_deleted',
      botId: createBotId('bot-6'),
      workspaceId: createWorkspaceId('workspace-6'),
      timestamp: createTimestamp(6000),
      context: { reason: 'User request' },
    };

    expect(event.type).toBe('bot_deleted');
    expect(event.context?.['reason']).toBe('User request');
  });

  it('создаёт BotAuditEvent типа instruction_updated с context', () => {
    const event: BotAuditEvent<'instruction_updated'> = {
      eventId: createEventId('event-7'),
      type: 'instruction_updated',
      botId: createBotId('bot-7'),
      workspaceId: createWorkspaceId('workspace-7'),
      timestamp: createTimestamp(7000),
      context: {
        version: createBotVersion(10),
        previousVersion: createBotVersion(8),
      },
    };

    expect(event.type).toBe('instruction_updated');
    expect(event.context?.version).toBe(10);
    expect(event.context?.previousVersion).toBe(8);
  });

  it('создаёт BotAuditEvent типа multi_agent_updated с context', () => {
    const event: BotAuditEvent<'multi_agent_updated'> = {
      eventId: createEventId('event-8'),
      type: 'multi_agent_updated',
      botId: createBotId('bot-8'),
      workspaceId: createWorkspaceId('workspace-8'),
      timestamp: createTimestamp(8000),
      context: {
        version: createBotVersion(15),
        previousVersion: createBotVersion(12),
      },
    };

    expect(event.type).toBe('multi_agent_updated');
    expect(event.context?.version).toBe(15);
    expect(event.context?.previousVersion).toBe(12);
  });

  it('создаёт BotAuditEvent типа config_changed с context', () => {
    const event: BotAuditEvent<'config_changed'> = {
      eventId: createEventId('event-9'),
      type: 'config_changed',
      botId: createBotId('bot-9'),
      workspaceId: createWorkspaceId('workspace-9'),
      timestamp: createTimestamp(9000),
      context: {
        changedFields: ['timeout', 'retryCount'],
      },
    };

    expect(event.type).toBe('config_changed');
    expect(event.context?.changedFields).toEqual(['timeout', 'retryCount']);
  });

  it('создаёт BotAuditEvent типа policy_violation с context', () => {
    const event: BotAuditEvent<'policy_violation'> = {
      eventId: createEventId('event-10'),
      type: 'policy_violation',
      botId: createBotId('bot-10'),
      workspaceId: createWorkspaceId('workspace-10'),
      timestamp: createTimestamp(10000),
      context: {
        policyId: 'policy-1',
        errorCode: 'ERR_001',
        violation: 'Invalid configuration',
      },
    };

    expect(event.type).toBe('policy_violation');
    expect(event.context?.policyId).toBe('policy-1');
    expect(event.context?.errorCode).toBe('ERR_001');
    expect(event.context?.violation).toBe('Invalid configuration');
  });

  it('создаёт BotAuditEvent без указания конкретного типа', () => {
    const event: BotAuditEvent = {
      eventId: createEventId('event-11'),
      type: 'bot_created',
      botId: createBotId('bot-11'),
      workspaceId: createWorkspaceId('workspace-11'),
      timestamp: createTimestamp(11000),
    };

    expect(event.type).toBe('bot_created');
  });

  it('создаёт BotAuditEvent со всеми типами событий', () => {
    const types: BotAuditEventType[] = [
      'bot_created',
      'bot_published',
      'bot_updated',
      'bot_deleted',
      'instruction_updated',
      'multi_agent_updated',
      'config_changed',
      'policy_violation',
    ];

    types.forEach((type) => {
      const event: BotAuditEvent = {
        eventId: createEventId(`event-${type}`),
        type,
        botId: createBotId('bot-1'),
        workspaceId: createWorkspaceId('workspace-1'),
        timestamp: createTimestamp(1000),
      };

      expect(event.type).toBe(type);
    });
  });

  it('создаёт BotAuditEvent с userId для всех типов', () => {
    const event: BotAuditEvent<'bot_created'> = {
      eventId: createEventId('event-12'),
      type: 'bot_created',
      botId: createBotId('bot-12'),
      workspaceId: createWorkspaceId('workspace-12'),
      timestamp: createTimestamp(12000),
      userId: createUserId('user-2'),
    };

    expect(event.userId).toBe('user-2');
  });

  it('создаёт BotAuditEvent без userId (системное событие)', () => {
    const event: BotAuditEvent<'bot_published'> = {
      eventId: createEventId('event-13'),
      type: 'bot_published',
      botId: createBotId('bot-13'),
      workspaceId: createWorkspaceId('workspace-13'),
      timestamp: createTimestamp(13000),
    };

    expect(event.userId).toBeUndefined();
  });
});
