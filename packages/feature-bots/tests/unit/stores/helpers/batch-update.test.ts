/**
 * @file Unit tests for stores/helpers/batch-update.ts
 */

import { describe, expect, it } from 'vitest';

import type { ID, ISODateString } from '@livai/core-contracts';

import type { BotsStoreBatchUpdate } from '../../../../src/contracts/BotsStoreContract.js';
import {
  applyBotsStoreBatchUpdates,
  applyBotsStoreSetBotsList,
  applyBotsStoreSetCreateState,
  applyBotsStoreSetDeleteState,
  applyBotsStoreSetUpdateState,
  applyBotsStoreUpsertBot,
} from '../../../../src/stores/helpers/batch-update.js';
import type { BotInfo, BotsState } from '../../../../src/types/bots.js';

const iso = (): ISODateString => '2026-01-01T00:00:00.000Z' as ISODateString;
const botId = (n: number): ID<'Bot'> => (`bot-${n}` as unknown as ID<'Bot'>);
const wsId = (): ID<'Workspace'> => 'ws-1' as unknown as ID<'Workspace'>;

const botInfo = (n: number, overrides: Partial<BotInfo> = {}): BotInfo => ({
  id: botId(n),
  name: `Bot ${n}`,
  status: { type: 'draft' },
  workspaceId: wsId(),
  currentVersion: 1,
  createdAt: iso(),
  ...overrides,
});

const createBaseState = (): { version: number; bots: BotsState; } => ({
  version: 1,
  bots: {
    entities: {},
    operations: {
      create: { status: 'idle' } as any,
      update: { status: 'idle' } as any,
      delete: { status: 'idle' } as any,
    },
  },
});

describe('batch-update', () => {
  it('applyBotsStoreSetBotsList: dev=true замораживает BotInfo в entities', () => {
    const state0 = createBaseState();
    const bot1 = botInfo(1);
    const bot2 = botInfo(2);

    const next = applyBotsStoreSetBotsList(state0 as any, [bot1, bot2], true);

    expect(Object.keys(next.bots.entities)).toEqual([botId(1), botId(2)]);
    expect(next.bots.entities[botId(1)]).toBe(bot1);
    expect(Object.isFrozen(next.bots.entities[botId(1)] as any)).toBe(true);
    expect(next.bots.entities[botId(2)]).toBe(bot2);
    expect(Object.isFrozen(next.bots.entities[botId(2)] as any)).toBe(true);

    // операции должны сохраниться ссылочно (копируется только entities)
    expect(next.bots.operations).toBe(state0.bots.operations);
  });

  it('applyBotsStoreSetBotsList: dev=false не замораживает BotInfo в entities', () => {
    const state0 = createBaseState();
    const bot1 = botInfo(1);

    const next = applyBotsStoreSetBotsList(state0 as any, [bot1], false);

    expect(next.bots.entities[botId(1)]).toBe(bot1);
    expect(Object.isFrozen(next.bots.entities[botId(1)] as any)).toBe(false);
    expect(next.bots.operations).toBe(state0.bots.operations);
  });

  it('applyBotsStoreUpsertBot: dev=true замораживает только обновляемый bot', () => {
    const state0 = createBaseState();
    const existing = botInfo(7);
    const other = botInfo(8);

    const state1 = {
      ...state0,
      bots: {
        ...state0.bots,
        entities: {
          [existing.id]: existing,
        },
      },
    };

    const next = applyBotsStoreUpsertBot(state1 as any, other, true);

    expect(next.bots.entities[existing.id]).toBe(existing);
    expect(Object.isFrozen(next.bots.entities[existing.id] as any)).toBe(false);

    expect(next.bots.entities[other.id]).toBe(other);
    expect(Object.isFrozen(next.bots.entities[other.id] as any)).toBe(true);

    expect(next.bots.operations).toBe(state1.bots.operations);
  });

  it('applyBotsStoreUpsertBot: dev=false не замораживает bot', () => {
    const state0 = createBaseState();
    const other = botInfo(10);

    const next = applyBotsStoreUpsertBot(state0 as any, other, false);

    expect(next.bots.entities[other.id]).toBe(other);
    expect(Object.isFrozen(next.bots.entities[other.id] as any)).toBe(false);
  });

  it('applyBotsStoreSetCreateState/UpdateState/DeleteState меняют только соответствующую operation', () => {
    const state0 = createBaseState();

    const createLoading = { status: 'loading', operation: 'create' } as any;
    const updateSuccess = { status: 'success', data: botInfo(1) } as any;
    const deleteError = { status: 'error', error: { code: 'BOT_CUSTOM' } } as any;

    const s1 = applyBotsStoreSetCreateState(state0 as any, createLoading);
    expect(s1.bots.operations.create).toBe(createLoading);
    expect(s1.bots.operations.update).toBe(state0.bots.operations.update);
    expect(s1.bots.operations.delete).toBe(state0.bots.operations.delete);

    const s2 = applyBotsStoreSetUpdateState(s1 as any, updateSuccess);
    expect(s2.bots.operations.create).toBe(createLoading);
    expect(s2.bots.operations.update).toBe(updateSuccess);
    expect(s2.bots.operations.delete).toBe(state0.bots.operations.delete);

    const s3 = applyBotsStoreSetDeleteState(s2 as any, deleteError);
    expect(s3.bots.operations.create).toBe(createLoading);
    expect(s3.bots.operations.update).toBe(updateSuccess);
    expect(s3.bots.operations.delete).toBe(deleteError);
  });

  it('applyBotsStoreBatchUpdates: пустой массив возвращает исходный state без изменений', () => {
    const state0 = createBaseState();
    const ctx = {
      getInitial: () => state0,
      isDev: () => false,
    };

    const next = applyBotsStoreBatchUpdates(state0 as any, [], ctx as any);
    expect(next).toBe(state0);
  });

  it('applyBotsStoreBatchUpdates: reset возвращает ctx.getInitial (и chain дальше применяет шаги)', () => {
    const base = createBaseState();
    const initialForReset = {
      ...base,
      bots: {
        ...base.bots,
        entities: { [botId(99)]: botInfo(99) },
      },
    };

    const ctx = {
      getInitial: () => initialForReset as any,
      isDev: () => true,
    };

    const b1 = botInfo(1);
    const b2 = botInfo(2);

    const createState = { status: 'loading', operation: 'create' } as any;
    const updateState = { status: 'success', data: b2 } as any;
    const deleteState = { status: 'error', error: { code: 'BOT_CUSTOM' } } as any;

    const updates: readonly BotsStoreBatchUpdate[] = [
      { type: 'reset' },
      { type: 'setBotsList', bots: [b1] },
      { type: 'upsertBot', bot: b2 },
      { type: 'setCreateState', state: createState },
      { type: 'setUpdateState', state: updateState },
      { type: 'setDeleteState', state: deleteState },
    ] as any;

    const state0 = createBaseState();
    const next = applyBotsStoreBatchUpdates(state0 as any, updates, ctx as any);

    // цепочка применена в фиксированном порядке
    expect(Object.keys(next.bots.entities)).toEqual([botId(1), botId(2)]);
    expect(next.bots.entities[botId(2)]).toBe(b2);
    expect(Object.isFrozen(next.bots.entities[botId(2)] as any)).toBe(true);

    expect(next.bots.operations.create).toBe(createState);
    expect(next.bots.operations.update).toBe(updateState);
    expect(next.bots.operations.delete).toBe(deleteState);
  });

  it('applyBotsStoreBatchUpdates: шаги setCreateState/setUpdateState/setDeleteState работают независимо', () => {
    const state0 = createBaseState();
    const ctx = {
      getInitial: () => state0,
      isDev: () => false,
    };

    const createState = { status: 'loading', operation: 'create' } as any;
    const updateState = { status: 'loading', operation: 'update' } as any;
    const deleteState = { status: 'loading', operation: 'delete' } as any;

    const updates: readonly BotsStoreBatchUpdate[] = [
      { type: 'setCreateState', state: createState },
      { type: 'setUpdateState', state: updateState },
      { type: 'setDeleteState', state: deleteState },
    ] as any;

    const next = applyBotsStoreBatchUpdates(state0 as any, updates, ctx as any);
    expect(next.bots.operations.create).toBe(createState);
    expect(next.bots.operations.update).toBe(updateState);
    expect(next.bots.operations.delete).toBe(deleteState);
  });
});
