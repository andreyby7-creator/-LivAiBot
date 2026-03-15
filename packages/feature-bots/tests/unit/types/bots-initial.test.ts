/**
 * @file Unit тесты для types/bots-initial.ts
 * Цель: 100% покрытие экспортируемых констант, функций и типов.
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
  BotAuditEventContextMap,
  BotAuditEventType,
  EventId,
} from '../../../src/domain/BotAuditEvent.js';
import type { BotEvent, BotEventByType, BotEventType } from '../../../src/types/bot-events.js';
import type { BotIdle, BotListState, BotState } from '../../../src/types/bots.js';
import type {
  BotAuditEventTemplate,
  BotPipelineHookData,
  BotPipelineHookFunction,
  BotPipelineHookMap,
  BotPipelineHookWithPriority,
  HookPriority,
} from '../../../src/types/bots-initial.js';
import {
  BotAuditEventTemplateMap,
  createBotAuditEventTemplate,
  initialBotListState,
  initialBotOperationState,
  initialBotPipelineHookMap,
  initialBotState,
  registerBotPipelineHook,
} from '../../../src/types/bots-initial.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createBotId = (): BotId => 'bot-123' as BotId;
const createWorkspaceId = (): BotWorkspaceId => 'workspace-456' as BotWorkspaceId;
const createUserId = (): BotUserId => 'user-789' as BotUserId;
const createBotVersion = (): BotVersion => 1 as BotVersion;
const createEventId = (): EventId => 'event-001' as EventId;
const createTimestamp = (): Timestamp => 1234567890 as Timestamp;

/* eslint-disable @livai/rag/context-leakage -- Тестовые данные для unit тестов, не используются в production */
const createBotEvent = (): BotEvent => ({
  type: 'bot_created',
  aggregateType: 'bot',
  aggregateId: createBotId(),
  meta: {
    eventId: createEventId(),
    timestamp: createTimestamp(),
    schemaVersion: 1 as const,
  },
  context: {
    workspaceId: createWorkspaceId(),
  },
  payload: {
    createdBy: createUserId(),
    name: 'Test Bot',
    initialVersion: createBotVersion(),
    initialStatus: { type: 'draft' },
  },
});
/* eslint-enable @livai/rag/context-leakage */

// ============================================================================
// 🎯 CANONICAL INITIAL STATES
// ============================================================================

describe('initialBotOperationState', () => {
  it('должен быть объектом с status idle', () => {
    expect(initialBotOperationState).toEqual({ status: 'idle' });
    expect(initialBotOperationState.status).toBe('idle');
  });

  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(initialBotOperationState)).toBe(true);
  });

  it('должен соответствовать типу BotIdle', () => {
    const state: BotIdle = initialBotOperationState;
    expect(state.status).toBe('idle');
  });
});

describe('initialBotListState', () => {
  it('должен содержать все необходимые поля', () => {
    expect(initialBotListState.bots).toEqual([]);
    expect(initialBotListState.currentBotId).toBeNull();
    expect(initialBotListState.listState).toEqual(initialBotOperationState);
    expect(initialBotListState.currentBotState).toEqual(initialBotOperationState);
  });

  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(initialBotListState)).toBe(true);
    expect(Object.isFrozen(initialBotListState.bots)).toBe(true);
  });

  it('должен соответствовать типу BotListState', () => {
    const state: BotListState = initialBotListState;
    expect(state.bots).toEqual([]);
    expect(state.currentBotId).toBeNull();
  });
});

describe('initialBotState', () => {
  it('должен содержать все операции в состоянии idle', () => {
    expect(initialBotState.list).toEqual(initialBotListState);
    expect(initialBotState.create).toEqual(initialBotOperationState);
    expect(initialBotState.update).toEqual(initialBotOperationState);
    expect(initialBotState.delete).toEqual(initialBotOperationState);
    expect(initialBotState.publish).toEqual(initialBotOperationState);
    expect(initialBotState.pause).toEqual(initialBotOperationState);
    expect(initialBotState.resume).toEqual(initialBotOperationState);
    expect(initialBotState.archive).toEqual(initialBotOperationState);
  });

  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(initialBotState)).toBe(true);
  });

  it('должен соответствовать типу BotState', () => {
    const state: BotState = initialBotState;
    expect(state.list).toBeDefined();
    expect(state.create.status).toBe('idle');
  });
});

// ============================================================================
// 📋 AUDIT EVENT TEMPLATES
// ============================================================================

describe('createBotAuditEventTemplate', () => {
  it('должен создавать шаблон без userId и context', () => {
    const template = createBotAuditEventTemplate(
      'bot_created',
      createBotId(),
      createWorkspaceId(),
    );
    expect(template.type).toBe('bot_created');
    expect(template.botId).toBeDefined();
    expect(template.workspaceId).toBeDefined();
    expect(template.userId).toBeUndefined();
    expect(template.context).toBeUndefined();
  });

  it('должен создавать шаблон с userId', () => {
    const template = createBotAuditEventTemplate(
      'bot_created',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
    );
    expect(template.userId).toBeDefined();
  });

  it('должен создавать шаблон с context для bot_published', () => {
    const context: BotAuditEventContextMap['bot_published'] = {
      version: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    const template = createBotAuditEventTemplate(
      'bot_published',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для bot_updated', () => {
    const context: BotAuditEventContextMap['bot_updated'] = {
      updatedFields: ['name', 'metadata.labels'],
    };
    const template = createBotAuditEventTemplate(
      'bot_updated',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для instruction_updated', () => {
    const context: BotAuditEventContextMap['instruction_updated'] = {
      version: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    const template = createBotAuditEventTemplate(
      'instruction_updated',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для multi_agent_updated', () => {
    const context: BotAuditEventContextMap['multi_agent_updated'] = {
      version: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    const template = createBotAuditEventTemplate(
      'multi_agent_updated',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для config_changed', () => {
    const context: BotAuditEventContextMap['config_changed'] = {
      changedFields: ['settings.temperature', 'settings.maxSessions'],
    };
    const template = createBotAuditEventTemplate(
      'config_changed',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для policy_violation', () => {
    const context: BotAuditEventContextMap['policy_violation'] = {
      policyId: 'policy-123',
      errorCode: 'POLICY_VIOLATION',
      violation: 'Test violation',
    };
    const template = createBotAuditEventTemplate(
      'policy_violation',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон для bot_deleted без context', () => {
    const template = createBotAuditEventTemplate(
      'bot_deleted',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
    );
    expect(template.type).toBe('bot_deleted');
    expect(template.context).toBeUndefined();
  });

  it('должен создавать шаблон для bot_created с пустым context', () => {
    const context: BotAuditEventContextMap['bot_created'] = {};
    const template = createBotAuditEventTemplate(
      'bot_created',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual({});
  });

  it('должен возвращать замороженный объект', () => {
    const template = createBotAuditEventTemplate(
      'bot_created',
      createBotId(),
      createWorkspaceId(),
    );
    expect(Object.isFrozen(template)).toBe(true);
  });

  it('должен создавать шаблон без eventId и timestamp', () => {
    const template = createBotAuditEventTemplate(
      'bot_created',
      createBotId(),
      createWorkspaceId(),
    );
    expect('eventId' in template).toBe(false);
    expect('timestamp' in template).toBe(false);
  });

  it('должен работать для всех типов событий', () => {
    const eventTypes: BotAuditEventType[] = [
      'bot_created',
      'bot_published',
      'bot_updated',
      'bot_deleted',
      'instruction_updated',
      'multi_agent_updated',
      'config_changed',
      'policy_violation',
    ];

    eventTypes.forEach((eventType) => {
      const template = createBotAuditEventTemplate(
        eventType,
        createBotId(),
        createWorkspaceId(),
        createUserId(),
      );
      expect(template.type).toBe(eventType);
      expect(template.botId).toBeDefined();
      expect(template.workspaceId).toBeDefined();
    });
  });
});

describe('BotAuditEventTemplateMap', () => {
  it('должен содержать функции для всех типов событий', () => {
    const eventTypes: BotAuditEventType[] = [
      'bot_created',
      'bot_published',
      'bot_updated',
      'bot_deleted',
      'instruction_updated',
      'multi_agent_updated',
      'config_changed',
      'policy_violation',
    ];

    eventTypes.forEach((eventType) => {
      // eslint-disable-next-line security/detect-object-injection -- eventType валидирован через union type
      const templateFn = BotAuditEventTemplateMap[eventType];
      expect(typeof templateFn).toBe('function');
      const template = templateFn(createBotId(), createWorkspaceId());
      expect(template.type).toBe(eventType);
    });
  });

  it('должен создавать шаблон без userId', () => {
    const template = BotAuditEventTemplateMap.bot_created(
      createBotId(),
      createWorkspaceId(),
    );
    expect(template.userId).toBeUndefined();
  });

  it('должен создавать шаблон с userId', () => {
    const template = BotAuditEventTemplateMap.bot_created(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
    );
    expect(template.userId).toBeDefined();
  });

  it('должен создавать шаблон с context для bot_published', () => {
    const context: BotAuditEventContextMap['bot_published'] = {
      version: createBotVersion(),
    };
    const template = BotAuditEventTemplateMap.bot_published(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для bot_updated', () => {
    const context: BotAuditEventContextMap['bot_updated'] = {
      updatedFields: ['name'],
    };
    const template = BotAuditEventTemplateMap.bot_updated(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для instruction_updated', () => {
    const context: BotAuditEventContextMap['instruction_updated'] = {
      version: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    const template = BotAuditEventTemplateMap.instruction_updated(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для multi_agent_updated', () => {
    const context: BotAuditEventContextMap['multi_agent_updated'] = {
      version: createBotVersion(),
      previousVersion: createBotVersion(),
    };
    const template = BotAuditEventTemplateMap.multi_agent_updated(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для config_changed', () => {
    const context: BotAuditEventContextMap['config_changed'] = {
      changedFields: ['settings.temperature'],
    };
    const template = BotAuditEventTemplateMap.config_changed(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен создавать шаблон с context для policy_violation', () => {
    const context: BotAuditEventContextMap['policy_violation'] = {
      policyId: 'policy-123',
      errorCode: 'POLICY_VIOLATION',
    };
    const template = BotAuditEventTemplateMap.policy_violation(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      context,
    );
    expect(template.context).toEqual(context);
  });

  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(BotAuditEventTemplateMap)).toBe(true);
  });
});

describe('BotAuditEventTemplate', () => {
  it('должен быть типом функции из BotAuditEventTemplateMap', () => {
    const templateFn: BotAuditEventTemplate = BotAuditEventTemplateMap.bot_created;
    const template = templateFn(createBotId(), createWorkspaceId());
    expect(template.type).toBe('bot_created');
  });
});

// ============================================================================
// 🔗 PIPELINE HOOKS
// ============================================================================

describe('HookPriority', () => {
  it('должен быть числовым типом', () => {
    const priority: HookPriority = 0;
    expect(typeof priority).toBe('number');
  });
});

describe('BotPipelineHookFunction', () => {
  it('должен поддерживать синхронную функцию', () => {
    const hook: BotPipelineHookFunction = (event: BotEvent) => {
      void event;
    };
    expect(typeof hook).toBe('function');
    hook(createBotEvent());
  });

  it('должен поддерживать асинхронную функцию', async () => {
    const hook: BotPipelineHookFunction = async (event: BotEvent) => {
      void event;
    };
    expect(typeof hook).toBe('function');
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Тестовая функция, не реальная orchestration
    await hook(createBotEvent());
  });

  it('должен поддерживать функцию с конкретным типом события', () => {
    const hook: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    expect(typeof hook).toBe('function');
  });
});

describe('BotPipelineHookData', () => {
  it('должен поддерживать приоритет', () => {
    /* eslint-disable ai-security/model-poisoning -- Тестовые данные для unit тестов, не training data */
    const data: BotPipelineHookData = {
      priority: 10,
    };
    /* eslint-enable ai-security/model-poisoning */
    expect(data.priority).toBe(10);
  });

  it('должен поддерживать отсутствие приоритета', () => {
    /* eslint-disable ai-security/model-poisoning -- Тестовые данные для unit тестов, не training data */
    const data: BotPipelineHookData = {};
    /* eslint-enable ai-security/model-poisoning */
    expect(data.priority).toBeUndefined();
  });
});

describe('BotPipelineHookWithPriority', () => {
  it('должен содержать hook и priority', () => {
    const hookWithPriority: BotPipelineHookWithPriority = {
      hook: (event: BotEvent) => {
        void event;
      },
      priority: 5,
    };
    expect(typeof hookWithPriority.hook).toBe('function');
    expect(hookWithPriority.priority).toBe(5);
  });

  it('должен поддерживать отсутствие priority', () => {
    const hookWithPriority: BotPipelineHookWithPriority = {
      hook: (event: BotEvent) => {
        void event;
      },
    };
    expect(hookWithPriority.priority).toBeUndefined();
  });

  it('должен быть замороженным объектом', () => {
    const hookWithPriority: BotPipelineHookWithPriority = Object.freeze({
      hook: (event: BotEvent) => {
        void event;
      },
      priority: 5,
    });
    expect(Object.isFrozen(hookWithPriority)).toBe(true);
  });
});

describe('BotPipelineHookMap', () => {
  it('должен поддерживать hooks для всех типов событий', () => {
    const map: BotPipelineHookMap = {
      bot_created: Object.freeze([
        Object.freeze({
          hook: (event: BotEventByType<'bot_created'>) => {
            void event;
          },
          priority: 0,
        }),
      ]),
    };
    expect(map.bot_created).toBeDefined();
    expect(map.bot_created?.[0]?.priority).toBe(0);
  });

  it('должен поддерживать пустой map', () => {
    const map: BotPipelineHookMap = {};
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe('initialBotPipelineHookMap', () => {
  it('должен быть пустым объектом', () => {
    expect(initialBotPipelineHookMap).toEqual({});
    expect(Object.keys(initialBotPipelineHookMap)).toHaveLength(0);
  });

  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(initialBotPipelineHookMap)).toBe(true);
  });

  it('должен соответствовать типу BotPipelineHookMap', () => {
    const map: BotPipelineHookMap = initialBotPipelineHookMap;
    expect(map).toEqual({});
  });
});

describe('registerBotPipelineHook', () => {
  it('должен регистрировать hook для нового типа события', () => {
    const hook: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const newMap = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook,
    );
    expect(newMap.bot_created).toBeDefined();
    expect(newMap.bot_created).toHaveLength(1);
    expect(newMap.bot_created?.[0]?.hook).toBe(hook);
  });

  it('должен регистрировать hook с приоритетом', () => {
    const hook: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const newMap = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook,
      10,
    );
    expect(newMap.bot_created?.[0]?.priority).toBe(10);
  });

  it('должен регистрировать hook без приоритета (по умолчанию undefined)', () => {
    const hook: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const newMap = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook,
    );
    expect(newMap.bot_created?.[0]?.priority).toBeUndefined();
  });

  it('должен добавлять hook к существующим hooks', () => {
    const hook1: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const hook2: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const map1 = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook1,
    );
    const map2 = registerBotPipelineHook(map1, 'bot_created', hook2);
    expect(map2.bot_created).toHaveLength(2);
    expect(map2.bot_created?.[0]?.hook).toBe(hook1);
    expect(map2.bot_created?.[1]?.hook).toBe(hook2);
  });

  it('должен сохранять hooks для других типов событий', () => {
    const hook1: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const hook2: BotPipelineHookFunction<BotEventByType<'bot_published'>> = (
      event: BotEventByType<'bot_published'>,
    ) => {
      void event;
    };
    const map1 = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook1,
    );
    const map2 = registerBotPipelineHook(map1, 'bot_published', hook2);
    expect(map2.bot_created).toBeDefined();
    expect(map2.bot_published).toBeDefined();
    expect(map2.bot_created).toHaveLength(1);
    expect(map2.bot_published).toHaveLength(1);
  });

  it('должен возвращать новый map без мутации исходного', () => {
    const hook: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const originalMap = initialBotPipelineHookMap;
    const newMap = registerBotPipelineHook(originalMap, 'bot_created', hook);
    expect(newMap).not.toBe(originalMap);
    expect(originalMap).toEqual({});
    expect(newMap.bot_created).toBeDefined();
  });

  it('должен возвращать замороженный map', () => {
    const hook: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const newMap = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook,
    );
    expect(Object.isFrozen(newMap)).toBe(true);
    expect(Object.isFrozen(newMap.bot_created)).toBe(true);
  });

  it('должен работать для всех типов событий', () => {
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
      const hook: BotPipelineHookFunction<BotEventByType<typeof eventType>> = (
        event: BotEventByType<typeof eventType>,
      ) => {
        void event;
      };
      const newMap = registerBotPipelineHook(
        initialBotPipelineHookMap,
        eventType,
        hook,
      );
      // eslint-disable-next-line security/detect-object-injection -- eventType валидирован через union type
      expect(newMap[eventType]).toBeDefined();
      // eslint-disable-next-line security/detect-object-injection -- eventType валидирован через union type
      expect(newMap[eventType]).toHaveLength(1);
    });
  });

  it('должен поддерживать hooks с разными приоритетами', () => {
    const hook1: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const hook2: BotPipelineHookFunction<BotEventByType<'bot_created'>> = (
      event: BotEventByType<'bot_created'>,
    ) => {
      void event;
    };
    const map1 = registerBotPipelineHook(
      initialBotPipelineHookMap,
      'bot_created',
      hook1,
      0,
    );
    const map2 = registerBotPipelineHook(map1, 'bot_created', hook2, 10);
    expect(map2.bot_created?.[0]?.priority).toBe(0);
    expect(map2.bot_created?.[1]?.priority).toBe(10);
  });
});
