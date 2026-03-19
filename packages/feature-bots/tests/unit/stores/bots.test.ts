/**
 * @file Unit-тесты для stores/bots.ts
 */

import { describe, expect, it, vi } from 'vitest';

import type { ID, ISODateString } from '@livai/core-contracts';

import {
  botsStoreVersion,
  createBotsStore,
  createInitialBotsStoreState,
} from '../../../src/stores/bots.js';
import type { BotInfo } from '../../../src/types/bots.js';

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

describe('createInitialBotsStoreState', () => {
  it('возвращает ожидаемую версию и idle-состояния операций', () => {
    const init = createInitialBotsStoreState();
    expect(init.version).toBe(botsStoreVersion);
    expect(init.bots.entities).toEqual({});
    expect(init.bots.operations.create).toEqual({ status: 'idle' });
    expect(init.bots.operations.update).toEqual({ status: 'idle' });
    expect(init.bots.operations.delete).toEqual({ status: 'idle' });
  });
});

describe('createBotsStore', () => {
  it('использует initial state по умолчанию и предоставляет actions', () => {
    const useStore = createBotsStore();
    const state = useStore.getState();

    expect(state.version).toBe(botsStoreVersion);
    expect(state.bots.entities).toEqual({});
    expect(state.actions).toBeDefined();
    expect(typeof state.actions.reset).toBe('function');
  });

  it('использует initialState из конфига, но reset() возвращает fresh snapshot (без общих ссылок)', () => {
    const initialState = createInitialBotsStoreState();
    const useStore = createBotsStore({ initialState });

    const s0 = useStore.getState();
    const entitiesRef0 = s0.bots.entities;
    const operationsRef0 = s0.bots.operations;

    // меняем store через actions, чтобы проверить что reset действительно заменяет state
    s0.actions.setBotsList([botInfo(1)]);
    const beforeReset = useStore.getState();
    expect(Object.keys(beforeReset.bots.entities)).toHaveLength(1);

    beforeReset.actions.reset();
    const afterReset = useStore.getState();
    expect(afterReset.bots.entities).toEqual({});
    expect(afterReset.bots.entities).not.toBe(entitiesRef0);
    expect(afterReset.bots.operations).not.toBe(operationsRef0);

    // второй reset тоже должен возвращать fresh objects (не переиспользовать snapshot)
    const entitiesRef1 = afterReset.bots.entities;
    afterReset.actions.reset();
    const afterReset2 = useStore.getState();
    expect(afterReset2.bots.entities).not.toBe(entitiesRef1);
  });

  it('setBotsList собирает entities map и замораживает BotInfo в dev', () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const useStore = createBotsStore();
      const b1 = botInfo(1);
      const b2 = botInfo(2, { status: { type: 'active', publishedAt: iso() } });

      useStore.getState().actions.setBotsList([b1, b2]);
      const state = useStore.getState();

      expect(Object.keys(state.bots.entities)).toEqual([botId(1), botId(2)]);
      expect(state.bots.entities[botId(1)]?.name).toBe('Bot 1');
      expect(Object.isFrozen(state.bots.entities[botId(1)]!)).toBe(true);
      expect(Object.isFrozen(state.bots.entities[botId(2)]!)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('setBotsList не замораживает BotInfo в production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const useStore = createBotsStore();
      const b1 = botInfo(1);
      useStore.getState().actions.setBotsList([b1]);

      const stored = useStore.getState().bots.entities[botId(1)]!;
      expect(stored).toBe(b1);
      expect(Object.isFrozen(stored)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('setCreateState / setUpdateState / setDeleteState обновляют operations через helper', () => {
    const useStore = createBotsStore();

    const createState = { status: 'loading', operation: 'create' } as any;
    const updateState = { status: 'loading', operation: 'update' } as any;
    const deleteState = { status: 'loading', operation: 'delete' } as any;

    useStore.getState().actions.setCreateState(createState);
    useStore.getState().actions.setUpdateState(updateState);
    useStore.getState().actions.setDeleteState(deleteState);

    const s = useStore.getState();
    expect(s.bots.operations.create).toEqual(createState);
    expect(s.bots.operations.update).toEqual(updateState);
    expect(s.bots.operations.delete).toEqual(deleteState);
  });

  it('upsertBot: в development замораживает bot в entities', () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const useStore = createBotsStore();
      const b1 = botInfo(1);

      useStore.getState().actions.upsertBot(b1);
      const stored = useStore.getState().bots.entities[botId(1)]!;

      expect(stored).toBe(b1);
      expect(Object.isFrozen(stored)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('upsertBot: в production не замораживает bot в entities', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const useStore = createBotsStore();
      const b1 = botInfo(1);

      useStore.getState().actions.upsertBot(b1);
      const stored = useStore.getState().bots.entities[botId(1)]!;

      expect(stored).toBe(b1);
      expect(Object.isFrozen(stored)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('applyBatchUpdate: применяет reset/setBotsList/upsertBot и устанавливает operations', () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const useStore = createBotsStore();

      // Подготовим состояние, чтобы reset внутри applyBatchUpdate реально что-то вернул.
      const oldBot = botInfo(99);
      useStore.getState().actions.setBotsList([oldBot]);
      expect(Object.keys(useStore.getState().bots.entities)).toEqual([botId(99)]);

      const b1 = botInfo(1);
      const b2 = botInfo(2, { status: { type: 'active', publishedAt: iso() } });

      const createState = { status: 'loading', operation: 'create' } as any;
      const updateState = { status: 'success', data: b2 } as any;
      const deleteState = { status: 'loading', operation: 'delete' } as any;

      useStore.getState().actions.applyBatchUpdate([
        { type: 'reset' },
        { type: 'setBotsList', bots: [b1] },
        { type: 'upsertBot', bot: b2 },
        { type: 'setCreateState', state: createState },
        { type: 'setUpdateState', state: updateState },
        { type: 'setDeleteState', state: deleteState },
      ] as any);

      const state = useStore.getState();
      expect(Object.keys(state.bots.entities)).toEqual([botId(1), botId(2)]);
      expect(Object.isFrozen(state.bots.entities[botId(2)]!)).toBe(true);

      expect(state.bots.operations.create).toEqual(createState);
      expect(state.bots.operations.update).toEqual(updateState);
      expect(state.bots.operations.delete).toEqual(deleteState);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
