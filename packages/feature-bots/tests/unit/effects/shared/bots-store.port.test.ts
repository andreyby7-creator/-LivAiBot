/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createBotsStorePortAdapter,
  isBotsStoreBatchUpdateOfType,
  withStoreLock,
} from '../../../../src/effects/shared/bots-store.port.js';

type AnyStore = any;

const createStoreMock = (): AnyStore => {
  const actions = {
    reset: vi.fn(),
    // В портовых тестах важен факт прокидывания `updates` в store.actions.applyBatchUpdate.
    // Внутреннюю валидацию делаем не здесь (и избегаем `for/switch`, запрещённых ESLint функциональными правилами).
    applyBatchUpdate: vi.fn(),
    setBotsList: vi.fn(),
    upsertBot: vi.fn(),
    setCreateState: vi.fn(),
    setUpdateState: vi.fn(),
    setDeleteState: vi.fn(),
  };

  return {
    version: 1,
    bots: {
      entities: { a: { id: 'a' } },
      operations: {
        create: { status: 'idle' },
        update: { status: 'idle' },
        delete: { status: 'idle' },
      },
    },
    actions,
  };
};

describe('bots-store.port', () => {
  it('isBotsStoreBatchUpdateOfType: корректно сужает тип по discriminator', () => {
    const update = { type: 'setBotsList', bots: [] } as const;
    expect(isBotsStoreBatchUpdateOfType(update as any, 'setBotsList')).toBe(true);
    expect(isBotsStoreBatchUpdateOfType(update as any, 'reset')).toBe(false);
  });

  it('withStoreLock: выставляет lock true и снимает после успеха', () => {
    const setStoreLocked = vi.fn();
    const storePort = { setStoreLocked } as any;
    const res = withStoreLock(storePort, () => 123);
    expect(res).toBe(123);
    expect(setStoreLocked).toHaveBeenNthCalledWith(1, true);
    expect(setStoreLocked).toHaveBeenNthCalledWith(2, false);
  });

  it('withStoreLock: снимает lock после ошибки', () => {
    const setStoreLocked = vi.fn();
    const storePort = { setStoreLocked } as any;
    expect(() =>
      withStoreLock(storePort, () => {
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(setStoreLocked).toHaveBeenNthCalledWith(1, true);
    expect(setStoreLocked).toHaveBeenNthCalledWith(2, false);
  });

  it('createBotsStorePortAdapter: проксирует toLoading/toSuccess/toError и делает snapshot без ссылок на entities/operations', () => {
    const store = createStoreMock();
    const port = createBotsStorePortAdapter(store);

    expect(port.toLoading('create' as any)).toEqual({ status: 'loading', operation: 'create' });

    expect(port.toSuccess({ ok: true })).toEqual({
      status: 'success',
      data: { ok: true },
    });

    expect(port.toError('e')).toEqual({ status: 'error', error: 'e' });

    const s1 = port.getState();
    const s2 = port.getState();

    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
    expect(s1.bots).not.toBe(store.bots);
    expect(s1.bots.entities).not.toBe(store.bots.entities);
    expect(s1.bots.operations).not.toBe(store.bots.operations);
  });

  it('adapter: при lock любые обновления кидают ошибку', () => {
    const store = createStoreMock();
    const port = createBotsStorePortAdapter(store);

    port.setStoreLocked(true);
    expect(() => port.setBotsList([])).toThrow('[BotsStorePort] Store is locked.');
    expect(() =>
      port.upsertBot(
        {
          id: 'b1',
          name: 'x',
          status: { type: 'draft' },
          workspaceId: 'ws' as any,
          currentVersion: 1,
          createdAt: '2020-01-01T00:00:00.000Z' as any,
        } as any,
      )
    ).toThrow(
      '[BotsStorePort] Store is locked.',
    );
    expect(() => port.setCreateState({ status: 'idle' } as any)).toThrow(
      '[BotsStorePort] Store is locked.',
    );
    expect(() => port.setUpdateState({ status: 'idle' } as any)).toThrow(
      '[BotsStorePort] Store is locked.',
    );
    expect(() => port.setDeleteState({ status: 'idle' } as any)).toThrow(
      '[BotsStorePort] Store is locked.',
    );
    expect(() => port.batchUpdate([])).toThrow('[BotsStorePort] Store is locked.');
  });

  it('batchUpdate: выполняет все варианты update в фиксированном порядке', () => {
    const store = createStoreMock();
    const port = createBotsStorePortAdapter(store);

    const bots = Object.freeze([{ id: 'b1' }]) as any;
    const c = Object.freeze({ status: 'loading' }) as any;
    const u = Object.freeze({ status: 'success', data: 1 }) as any;
    const d = Object.freeze({ status: 'error', error: 'x' }) as any;

    port.batchUpdate([
      { type: 'reset' },
      { type: 'setBotsList', bots },
      { type: 'setCreateState', state: c },
      { type: 'setUpdateState', state: u },
      { type: 'setDeleteState', state: d },
    ]);

    expect(store.actions.applyBatchUpdate).toHaveBeenCalledTimes(1);
    expect(store.actions.applyBatchUpdate).toHaveBeenCalledWith([
      { type: 'reset' },
      { type: 'setBotsList', bots },
      { type: 'setCreateState', state: c },
      { type: 'setUpdateState', state: u },
      { type: 'setDeleteState', state: d },
    ]);
  });

  it('upsertBot: проксирует вызов в store.actions.upsertBot и работает только когда store не locked', () => {
    const store = createStoreMock();
    const port = createBotsStorePortAdapter(store);

    const bot = {
      id: 'b1',
      name: 'x',
      status: { type: 'draft' },
      workspaceId: 'ws' as any,
      currentVersion: 1,
      createdAt: '2020-01-01T00:00:00.000Z' as any,
    } as any;
    port.upsertBot(bot);

    expect(store.actions.upsertBot).toHaveBeenCalledWith(bot);
  });

  it('batchUpdate: прокидывает unknown type в store.actions.applyBatchUpdate без валидации порта', () => {
    const store = createStoreMock();
    const port = createBotsStorePortAdapter(store);

    const updates = [{ type: 'nope' } as any];
    port.batchUpdate(updates as any);

    expect(store.actions.applyBatchUpdate).toHaveBeenCalledWith(updates);
  });
});
