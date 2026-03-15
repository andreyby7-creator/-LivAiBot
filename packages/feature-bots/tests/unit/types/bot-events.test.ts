/**
 * @file Unit тесты для types/bot-events.ts
 * Цель: 100% покрытие экспортируемых типов, констант и type guards.
 */
import { describe, expect, it } from 'vitest';

import type { TraceId } from '@livai/core-contracts';

import type {
  BotId,
  BotUserId,
  BotVersion,
  BotWorkspaceId,
  Timestamp,
} from '../../../src/domain/Bot.js';
import type { EventId } from '../../../src/domain/BotAuditEvent.js';
import type {
  BotArchivedPayload,
  BotConfigField,
  BotCreatedPayload,
  BotDeletedPayload,
  BotEvent,
  BotEventByType,
  BotEventContext,
  BotEventMeta,
  BotEventPayload,
  BotEventPayloadMap,
  BotEventType,
  BotMutableField,
  BotPausedPayload,
  BotPublishedPayload,
  BotResumedPayload,
  BotUpdatedPayload,
  ConfigChangedPayload,
  CorrelationId,
  InstructionUpdatedPayload,
  MultiAgentUpdatedPayload,
  SchemaVersion,
} from '../../../src/types/bot-events.js';
import {
  botEventSchemaVersion,
  BotEventTypes,
  isBotEvent,
  isBotEventOfType,
} from '../../../src/types/bot-events.js';
import type { BotPauseReason } from '../../../src/types/bot-lifecycle.js';
import type { BotStatus } from '../../../src/types/bots.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createBotId = (): BotId => 'bot-123' as BotId;
const createWorkspaceId = (): BotWorkspaceId => 'workspace-456' as BotWorkspaceId;
const createUserId = (): BotUserId => 'user-789' as BotUserId;
const createEventId = (): EventId => 'event-001' as EventId;
const createTimestamp = (): Timestamp => 1234567890 as Timestamp;
const createTraceId = (): TraceId => 'trace-123' as TraceId;
const createCorrelationId = (): CorrelationId => 'corr-456' as CorrelationId;
const createBotVersion = (): BotVersion => 1 as BotVersion;

const createBotEventMeta = (overrides: Partial<BotEventMeta> = {}): BotEventMeta => ({
  eventId: createEventId(),
  timestamp: createTimestamp(),
  schemaVersion: botEventSchemaVersion,
  ...overrides,
});

/* eslint-disable @livai/rag/context-leakage -- Тестовые данные для unit тестов, не используются в production */
const createBotEventContext = (overrides: Partial<BotEventContext> = {}): BotEventContext => ({
  workspaceId: createWorkspaceId(),
  ...overrides,
});
/* eslint-enable @livai/rag/context-leakage */

// ============================================================================
// 📊 CONSTANTS
// ============================================================================

describe('botEventSchemaVersion', () => {
  it('должен быть равен 1', () => {
    expect(botEventSchemaVersion).toBe(1);
  });

  it('должен иметь тип SchemaVersion', () => {
    const version: SchemaVersion = botEventSchemaVersion;
    expect(version).toBe(1);
  });
});

describe('BotEventTypes', () => {
  it('должен содержать все типы событий ботов', () => {
    expect(BotEventTypes.BOT_CREATED).toBe('bot_created');
    expect(BotEventTypes.BOT_PUBLISHED).toBe('bot_published');
    expect(BotEventTypes.BOT_UPDATED).toBe('bot_updated');
    expect(BotEventTypes.BOT_DELETED).toBe('bot_deleted');
    expect(BotEventTypes.INSTRUCTION_UPDATED).toBe('instruction_updated');
    expect(BotEventTypes.MULTI_AGENT_UPDATED).toBe('multi_agent_updated');
    expect(BotEventTypes.BOT_PAUSED).toBe('bot_paused');
    expect(BotEventTypes.BOT_RESUMED).toBe('bot_resumed');
    expect(BotEventTypes.BOT_ARCHIVED).toBe('bot_archived');
    expect(BotEventTypes.CONFIG_CHANGED).toBe('config_changed');
  });

  it('должен соответствовать BotEventType', () => {
    const eventTypes: BotEventType[] = Object.values(BotEventTypes) as BotEventType[];
    expect(eventTypes).toHaveLength(10);
    eventTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

// ============================================================================
// 🧩 FIELD TYPES
// ============================================================================

describe('BotMutableField', () => {
  it('должен поддерживать все изменяемые поля метаданных', () => {
    const fields: BotMutableField[] = [
      'name',
      'metadata.labels',
      'metadata.features',
      'metadata.integrations',
    ];
    expect(fields).toHaveLength(4);
    fields.forEach((field) => {
      expect(typeof field).toBe('string');
    });
  });
});

describe('BotConfigField', () => {
  it('должен поддерживать все изменяемые поля конфигурации', () => {
    const fields: BotConfigField[] = [
      'settings.temperature',
      'settings.contextWindow',
      'settings.maxSessions',
      'settings.fallbackMessage',
      'settings.piiMaskingEnabled',
      'settings.imageRecognitionEnabled',
      'settings.unrecognizedMessage',
      'settings.interruptionRules',
    ];
    expect(fields).toHaveLength(8);
    fields.forEach((field) => {
      expect(typeof field).toBe('string');
    });
  });
});

// ============================================================================
// 🧩 PAYLOAD TYPES
// ============================================================================

describe('BotCreatedPayload', () => {
  it('должен поддерживать создание payload события bot_created', () => {
    const payload: BotCreatedPayload = {
      createdBy: createUserId(),
      name: 'Test Bot',
      initialVersion: createBotVersion(),
      initialStatus: { type: 'draft' } as BotStatus,
    };
    expect(payload.createdBy).toBeDefined();
    expect(payload.name).toBe('Test Bot');
    expect(payload.initialVersion).toBeDefined();
    expect(payload.initialStatus.type).toBe('draft');
  });
});

describe('BotPublishedPayload', () => {
  it('должен поддерживать payload без previousVersion', () => {
    const payload: BotPublishedPayload = {
      publishedBy: createUserId(),
      currentVersion: createBotVersion(),
    };
    expect(payload.publishedBy).toBeDefined();
    expect(payload.currentVersion).toBeDefined();
    expect(payload.previousVersion).toBeUndefined();
  });

  it('должен поддерживать payload с previousVersion', () => {
    const payload: BotPublishedPayload = {
      publishedBy: createUserId(),
      currentVersion: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    expect(payload.previousVersion).toBeDefined();
  });
});

describe('BotUpdatedPayload', () => {
  it('должен поддерживать payload события bot_updated', () => {
    const payload: BotUpdatedPayload = {
      updatedBy: createUserId(),
      updatedFields: ['name', 'metadata.labels'] as readonly BotMutableField[],
      newRevision: 2,
      previousRevision: 1,
    };
    expect(payload.updatedBy).toBeDefined();
    expect(payload.updatedFields).toHaveLength(2);
    expect(payload.newRevision).toBe(2);
    expect(payload.previousRevision).toBe(1);
  });
});

describe('BotDeletedPayload', () => {
  it('должен поддерживать payload события bot_deleted', () => {
    const payload: BotDeletedPayload = {
      deletedBy: createUserId(),
      currentVersion: createBotVersion(),
    };
    expect(payload.deletedBy).toBeDefined();
    expect(payload.currentVersion).toBeDefined();
  });
});

describe('InstructionUpdatedPayload', () => {
  it('должен поддерживать payload события instruction_updated', () => {
    const payload: InstructionUpdatedPayload = {
      updatedBy: createUserId(),
      currentVersion: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    expect(payload.updatedBy).toBeDefined();
    expect(payload.currentVersion).toBeDefined();
    expect(payload.previousVersion).toBeDefined();
  });
});

describe('MultiAgentUpdatedPayload', () => {
  it('должен поддерживать payload события multi_agent_updated', () => {
    const payload: MultiAgentUpdatedPayload = {
      updatedBy: createUserId(),
      currentVersion: createBotVersion(),
      previousVersion: createBotVersion(),
      multiAgentSchemaVersion: 2,
    };
    expect(payload.updatedBy).toBeDefined();
    expect(payload.currentVersion).toBeDefined();
    expect(payload.previousVersion).toBeDefined();
    expect(payload.multiAgentSchemaVersion).toBe(2);
  });
});

describe('BotPausedPayload', () => {
  it('должен поддерживать payload события bot_paused', () => {
    const payload: BotPausedPayload = {
      pausedBy: createUserId(),
      reason: 'manual' as BotPauseReason,
      currentVersion: createBotVersion(),
    };
    expect(payload.pausedBy).toBeDefined();
    expect(payload.reason).toBe('manual');
    expect(payload.currentVersion).toBeDefined();
  });
});

describe('BotResumedPayload', () => {
  it('должен поддерживать payload события bot_resumed', () => {
    const payload: BotResumedPayload = {
      resumedBy: createUserId(),
      currentVersion: createBotVersion(),
    };
    expect(payload.resumedBy).toBeDefined();
    expect(payload.currentVersion).toBeDefined();
  });
});

describe('BotArchivedPayload', () => {
  it('должен поддерживать payload события bot_archived', () => {
    const payload: BotArchivedPayload = {
      archivedBy: createUserId(),
      currentVersion: createBotVersion(),
    };
    expect(payload.archivedBy).toBeDefined();
    expect(payload.currentVersion).toBeDefined();
  });
});

describe('ConfigChangedPayload', () => {
  it('должен поддерживать payload события config_changed', () => {
    const payload: ConfigChangedPayload = {
      changedBy: createUserId(),
      changedFields: ['settings.temperature', 'settings.maxSessions'] as readonly BotConfigField[],
      currentVersion: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    expect(payload.changedBy).toBeDefined();
    expect(payload.changedFields).toHaveLength(2);
    expect(payload.currentVersion).toBeDefined();
    expect(payload.previousVersion).toBeDefined();
  });
});

// ============================================================================
// 🧭 EVENT PAYLOAD MAP
// ============================================================================

describe('BotEventPayloadMap', () => {
  it('должен содержать все типы событий с соответствующими payload', () => {
    const map: BotEventPayloadMap = {
      bot_created: {} as BotCreatedPayload,
      bot_published: {} as BotPublishedPayload,
      bot_updated: {} as BotUpdatedPayload,
      bot_deleted: {} as BotDeletedPayload,
      instruction_updated: {} as InstructionUpdatedPayload,
      multi_agent_updated: {} as MultiAgentUpdatedPayload,
      bot_paused: {} as BotPausedPayload,
      bot_resumed: {} as BotResumedPayload,
      bot_archived: {} as BotArchivedPayload,
      config_changed: {} as ConfigChangedPayload,
    };
    expect(Object.keys(map)).toHaveLength(10);
  });
});

// ============================================================================
// 🧭 EVENT UNION
// ============================================================================

describe('BotEvent', () => {
  it('должен поддерживать событие bot_created', () => {
    const event: BotEvent = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        createdBy: createUserId(),
        name: 'Test Bot',
        initialVersion: createBotVersion(),
        initialStatus: { type: 'draft' } as BotStatus,
      },
    };
    expect(event.type).toBe('bot_created');
    expect(event.aggregateType).toBe('bot');
    expect(event.aggregateId).toBeDefined();
  });

  it('должен поддерживать событие bot_published', () => {
    const event: BotEvent = {
      type: 'bot_published',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        publishedBy: createUserId(),
        currentVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('bot_published');
  });

  it('должен поддерживать событие bot_updated', () => {
    const event: BotEvent = {
      type: 'bot_updated',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        updatedBy: createUserId(),
        updatedFields: ['name'] as readonly BotMutableField[],
        newRevision: 2,
        previousRevision: 1,
      },
    };
    expect(event.type).toBe('bot_updated');
  });

  it('должен поддерживать событие bot_deleted', () => {
    const event: BotEvent = {
      type: 'bot_deleted',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        deletedBy: createUserId(),
        currentVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('bot_deleted');
  });

  it('должен поддерживать событие instruction_updated', () => {
    const event: BotEvent = {
      type: 'instruction_updated',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        updatedBy: createUserId(),
        currentVersion: createBotVersion(),
        previousVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('instruction_updated');
  });

  it('должен поддерживать событие multi_agent_updated', () => {
    const event: BotEvent = {
      type: 'multi_agent_updated',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        updatedBy: createUserId(),
        currentVersion: createBotVersion(),
        previousVersion: createBotVersion(),
        multiAgentSchemaVersion: 2,
      },
    };
    expect(event.type).toBe('multi_agent_updated');
  });

  it('должен поддерживать событие bot_paused', () => {
    const event: BotEvent = {
      type: 'bot_paused',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        pausedBy: createUserId(),
        reason: 'manual' as BotPauseReason,
        currentVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('bot_paused');
  });

  it('должен поддерживать событие bot_resumed', () => {
    const event: BotEvent = {
      type: 'bot_resumed',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        resumedBy: createUserId(),
        currentVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('bot_resumed');
  });

  it('должен поддерживать событие bot_archived', () => {
    const event: BotEvent = {
      type: 'bot_archived',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        archivedBy: createUserId(),
        currentVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('bot_archived');
  });

  it('должен поддерживать событие config_changed', () => {
    const event: BotEvent = {
      type: 'config_changed',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        changedBy: createUserId(),
        changedFields: ['settings.temperature'] as readonly BotConfigField[],
        currentVersion: createBotVersion(),
        previousVersion: createBotVersion(),
      },
    };
    expect(event.type).toBe('config_changed');
  });

  it('должен поддерживать meta с опциональными полями', () => {
    const event: BotEvent = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta({
        traceId: createTraceId(),
        correlationId: createCorrelationId(),
      }),
      context: createBotEventContext(),
      payload: {
        createdBy: createUserId(),
        name: 'Test Bot',
        initialVersion: createBotVersion(),
        initialStatus: { type: 'draft' } as BotStatus,
      },
    };
    expect(event.meta.traceId).toBeDefined();
    expect(event.meta.correlationId).toBeDefined();
  });
});

// ============================================================================
// 🔧 UTILITY TYPES
// ============================================================================

describe('BotEventPayload', () => {
  it('должен извлекать тип payload для bot_created', () => {
    type Payload = BotEventPayload<'bot_created'>;
    const payload: Payload = {
      createdBy: createUserId(),
      name: 'Test Bot',
      initialVersion: createBotVersion(),
      initialStatus: { type: 'draft' } as BotStatus,
    };
    expect(payload).toBeDefined();
  });
});

describe('BotEventByType', () => {
  it('должен извлекать тип события для bot_created', () => {
    type Event = BotEventByType<'bot_created'>;
    const event: Event = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        createdBy: createUserId(),
        name: 'Test Bot',
        initialVersion: createBotVersion(),
        initialStatus: { type: 'draft' } as BotStatus,
      },
    };
    expect(event.type).toBe('bot_created');
  });
});

// ============================================================================
// 🎯 TYPE GUARDS
// ============================================================================

describe('isBotEventOfType', () => {
  it('должен возвращать true для события с указанным типом', () => {
    const event: BotEvent = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        createdBy: createUserId(),
        name: 'Test Bot',
        initialVersion: createBotVersion(),
        initialStatus: { type: 'draft' } as BotStatus,
      },
    };
    expect(isBotEventOfType(event, 'bot_created')).toBe(true);
  });

  it('должен возвращать false для события с другим типом', () => {
    const event: BotEvent = {
      type: 'bot_published',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        publishedBy: createUserId(),
        currentVersion: createBotVersion(),
      },
    };
    expect(isBotEventOfType(event, 'bot_created')).toBe(false);
  });

  it('должен корректно работать со всеми типами событий', () => {
    const eventTypes: BotEventType[] = [
      'bot_created',
      'bot_published',
      'bot_updated',
      'bot_deleted',
      'instruction_updated',
      'multi_agent_updated',
      'bot_paused',
      'bot_resumed',
      'bot_archived',
      'config_changed',
    ];

    eventTypes.forEach((eventType) => {
      const event = {
        type: eventType,
        aggregateType: 'bot',
        aggregateId: createBotId(),
        meta: createBotEventMeta(),
        context: createBotEventContext(),
        payload: {} as BotEventPayloadMap[typeof eventType],
      } as BotEvent;
      expect(isBotEventOfType(event, eventType)).toBe(true);
    });
  });
});

describe('isBotEvent', () => {
  it('должен возвращать true для валидного события bot_created', () => {
    const event: BotEvent = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {
        createdBy: createUserId(),
        name: 'Test Bot',
        initialVersion: createBotVersion(),
        initialStatus: { type: 'draft' } as BotStatus,
      },
    };
    expect(isBotEvent(event)).toBe(true);
  });

  it('должен возвращать true для валидного события с опциональными полями meta', () => {
    const event: BotEvent = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta({
        traceId: createTraceId(),
        correlationId: createCorrelationId(),
      }),
      context: createBotEventContext(),
      payload: {
        createdBy: createUserId(),
        name: 'Test Bot',
        initialVersion: createBotVersion(),
        initialStatus: { type: 'draft' } as BotStatus,
      },
    };
    expect(isBotEvent(event)).toBe(true);
  });

  it('должен возвращать false для null', () => {
    expect(isBotEvent(null)).toBe(false);
  });

  it('должен возвращать false для undefined', () => {
    expect(isBotEvent(undefined)).toBe(false);
  });

  it('должен возвращать false для примитивных типов', () => {
    expect(isBotEvent('string')).toBe(false);
    expect(isBotEvent(123)).toBe(false);
    expect(isBotEvent(true)).toBe(false);
  });

  it('должен возвращать false для объекта без type', () => {
    const invalid = {
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным type', () => {
    const invalid = {
      type: 'invalid_type',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным aggregateType', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'invalid',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным aggregateId', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: 123,
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта без meta', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с null meta', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: null,
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным meta.eventId', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: {
        eventId: 123,
        timestamp: createTimestamp(),
        schemaVersion: botEventSchemaVersion,
      },
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным meta.timestamp', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: {
        eventId: createEventId(),
        timestamp: 'invalid',
        schemaVersion: botEventSchemaVersion,
      },
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным meta.schemaVersion', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: {
        eventId: createEventId(),
        timestamp: createTimestamp(),
        schemaVersion: 999,
      },
      context: createBotEventContext(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта без context', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с null context', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: null,
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с невалидным context.workspaceId', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: {
        workspaceId: 123,
      },
      payload: {},
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта без payload', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать false для объекта с null payload', () => {
    const invalid = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: createBotEventMeta(),
      context: createBotEventContext(),
      payload: null,
    };
    expect(isBotEvent(invalid)).toBe(false);
  });

  it('должен возвращать true для всех типов событий', () => {
    const eventTypes: BotEventType[] = [
      'bot_created',
      'bot_published',
      'bot_updated',
      'bot_deleted',
      'instruction_updated',
      'multi_agent_updated',
      'bot_paused',
      'bot_resumed',
      'bot_archived',
      'config_changed',
    ];

    eventTypes.forEach((eventType) => {
      const event = {
        type: eventType,
        aggregateType: 'bot',
        aggregateId: createBotId(),
        meta: createBotEventMeta(),
        context: createBotEventContext(),
        payload: {} as BotEventPayloadMap[typeof eventType],
      } as BotEvent;
      expect(isBotEvent(event)).toBe(true);
    });
  });
});
