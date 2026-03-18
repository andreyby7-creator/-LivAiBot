/**
 * @file Unit-тесты для `src/types/bots-initial.ts` (новая архитектура).
 * Цель: 100% покрытие runtime-кода (initialBotsState, audit templates, pipeline hooks).
 */

import { describe, expect, it, vi } from 'vitest';

import type { BotId, BotUserId, BotWorkspaceId } from '../../../src/domain/Bot.js';
import type { BotAuditEventContextMap } from '../../../src/domain/BotAuditEvent.js';
import type { BotEventByType } from '../../../src/types/bot-events.js';
import type { BotPipelineHookMap } from '../../../src/types/bots-initial.js';
import {
  BotAuditEventTemplateMap,
  createBotAuditEventTemplate,
  initialBotPipelineHookMap,
  initialBotsState,
  registerBotPipelineHook,
} from '../../../src/types/bots-initial.js';

const createBotId = (): BotId => 'bot-1' as BotId;
const createWorkspaceId = (): BotWorkspaceId => 'ws-1' as BotWorkspaceId;
const createUserId = (): BotUserId => 'user-1' as BotUserId;

describe('initialBotsState', () => {
  it('имеет форму entities + operations (idle)', async () => {
    expect(initialBotsState.entities).toEqual({});
    expect(initialBotsState.operations.create).toEqual({ status: 'idle' });
    expect(initialBotsState.operations.update).toEqual({ status: 'idle' });
    expect(initialBotsState.operations.delete).toEqual({ status: 'idle' });
  });

  it('заморожен (верхний уровень и вложенные структуры)', async () => {
    expect(Object.isFrozen(initialBotsState)).toBe(true);
    expect(Object.isFrozen(initialBotsState.entities)).toBe(true);
    expect(Object.isFrozen(initialBotsState.operations)).toBe(true);
  });
});

describe('createBotAuditEventTemplate', () => {
  it('создаёт шаблон без userId и context', async () => {
    const botId = createBotId();
    const wsId = createWorkspaceId();
    const tpl = createBotAuditEventTemplate('bot_created', botId, wsId);

    expect(tpl).toEqual({ type: 'bot_created', botId, workspaceId: wsId });
    expect((tpl as any).userId).toBeUndefined();
    expect((tpl as any).context).toBeUndefined();
  });

  it('создаёт шаблон с userId', async () => {
    const tpl = createBotAuditEventTemplate(
      'bot_created',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
    );
    expect(tpl.userId).toBeDefined();
  });

  it('создаёт шаблон с context (ветка context !== undefined)', async () => {
    const ctx: BotAuditEventContextMap['bot_published'] = {
      version: 1 as any,
      previousVersion: 1 as any,
    };
    const tpl = createBotAuditEventTemplate(
      'bot_published',
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      ctx,
    );
    expect(tpl.context).toEqual(ctx);
  });
});

describe('BotAuditEventTemplateMap', () => {
  it('возвращает шаблоны для нескольких типов', async () => {
    const a = BotAuditEventTemplateMap.bot_created(createBotId(), createWorkspaceId());
    expect(a.type).toBe('bot_created');

    const b = BotAuditEventTemplateMap.config_changed(
      createBotId(),
      createWorkspaceId(),
      createUserId(),
      { key: 'x', value: 'y' } as any,
    );
    expect(b.type).toBe('config_changed');
    expect(b.userId).toBeDefined();
    expect(b.context).toBeDefined();
  });

  it('покрывает все фабрики из map (smoke)', async () => {
    const id = createBotId();
    const ws = createWorkspaceId();
    const user = createUserId();

    expect(
      BotAuditEventTemplateMap.bot_published(
        id,
        ws,
        user,
        { version: 1 as any, previousVersion: 1 as any } as any,
      ).type,
    )
      .toBe('bot_published');
    expect(
      BotAuditEventTemplateMap.bot_updated(id, ws, user, { updatedFields: ['name'] } as any).type,
    )
      .toBe('bot_updated');
    expect(
      BotAuditEventTemplateMap.bot_deleted(id, ws, user, { deletedReason: 'manual' } as any).type,
    )
      .toBe('bot_deleted');
    expect(
      BotAuditEventTemplateMap.instruction_updated(
        id,
        ws,
        user,
        { version: 1 as any, previousVersion: 1 as any } as any,
      ).type,
    )
      .toBe('instruction_updated');
    expect(
      BotAuditEventTemplateMap.multi_agent_updated(
        id,
        ws,
        user,
        { version: 1 as any, previousVersion: 1 as any } as any,
      ).type,
    )
      .toBe('multi_agent_updated');
    expect(
      BotAuditEventTemplateMap.policy_violation(id, ws, user, { reason: 'policy_violation' } as any)
        .type,
    )
      .toBe('policy_violation');
  });
});

describe('initialBotPipelineHookMap', () => {
  it('пустой и заморожен', async () => {
    expect(initialBotPipelineHookMap).toEqual({});
    expect(Object.isFrozen(initialBotPipelineHookMap)).toBe(true);
  });
});

describe('registerBotPipelineHook', () => {
  it('добавляет hook в пустой map (priority отсутствует)', async () => {
    const map: BotPipelineHookMap = initialBotPipelineHookMap;
    const hook = vi.fn<(...args: any[]) => void>();

    const updated = registerBotPipelineHook(map, 'bot_created', hook);
    expect(updated).not.toBe(map);
    expect(map).toEqual({});

    const hooks = (updated as any).bot_created as readonly any[];
    expect(hooks).toHaveLength(1);
    expect(hooks[0].hook).toBe(hook);
    expect(hooks[0].priority).toBeUndefined();
    expect(Object.isFrozen(hooks)).toBe(true);
    expect(Object.isFrozen(hooks[0])).toBe(true);
  });

  it('аппендит к существующим hooks и сохраняет priority', async () => {
    const hook1 = vi.fn<(...args: any[]) => void>();
    const hook2 = vi.fn<(...args: any[]) => void>();

    const map1 = registerBotPipelineHook(initialBotPipelineHookMap, 'bot_created', hook1, 2);
    const map2 = registerBotPipelineHook(map1, 'bot_created', hook2);

    const hooks = (map2 as any).bot_created as readonly any[];
    expect(hooks).toHaveLength(2);
    expect(hooks[0].priority).toBe(2);
    expect(hooks[1].priority).toBeUndefined();
  });

  it('hook типизируется через BotEventByType', async () => {
    const hook = vi.fn<(e: BotEventByType<'bot_created'>) => void | Promise<void>>();
    const map = registerBotPipelineHook(initialBotPipelineHookMap, 'bot_created', hook);
    const hooks = (map as any).bot_created as readonly { hook: typeof hook; }[];
    expect(hooks).toHaveLength(1);

    const evt = {
      type: 'bot_created',
      aggregateType: 'bot',
      aggregateId: createBotId(),
      meta: { eventId: 'e' as any, timestamp: 1 as any, schemaVersion: 1 as const },
      context: { workspaceId: createWorkspaceId() },
      payload: {
        createdBy: createUserId(),
        name: 'Bot',
        initialVersion: 1 as any,
        initialStatus: { type: 'draft' },
      },
    } as BotEventByType<'bot_created'>;

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test calls a local hook, no orchestration
    await hooks[0]!.hook(evt);
    expect(hook).toHaveBeenCalledTimes(1);
  });
});
