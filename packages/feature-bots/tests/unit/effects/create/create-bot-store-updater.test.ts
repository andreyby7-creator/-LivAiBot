/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import { updateCreateBotState } from '../../../../src/effects/create/create-bot-store-updater.js';
import type { BotInfo } from '../../../../src/types/bots.js';

/* eslint-disable ai-security/model-poisoning -- Unit-тесты используют синтетические fixture/mock-данные.
 * Правило помечает любые “model/training-like” payload как потенциальное poisoning без возможности runtime sanitization,
 * поэтому здесь disable корректен и локализован на уровне файла. */
describe('updateCreateBotState', () => {
  it('применяет batchUpdate: upsertBot + success(create) и freeze’ит success state', () => {
    const batchUpdate = vi.fn();
    const storePort = { batchUpdate } as any;

    const bot = {
      id: 'bot-1',
      name: 'Bot 1',
      status: { type: 'draft' },
      workspaceId: 'ws-1',
      currentVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    } as BotInfo;

    updateCreateBotState(storePort, bot);

    expect(batchUpdate).toHaveBeenCalledTimes(1);

    const updates = batchUpdate.mock.calls[0]?.[0] as any[];
    expect(Object.isFrozen(updates)).toBe(true);
    expect(updates).toHaveLength(2);

    expect(updates[0]).toEqual({ type: 'upsertBot', bot });

    expect(updates[1]).toEqual({
      type: 'setCreateState',
      state: { status: 'success', data: bot },
    });

    // buildCreateSuccessState делает Object.freeze на самом state
    expect(Object.isFrozen(updates[1].state)).toBe(true);
    expect(updates[1].state.data).toBe(bot);
  });

  it('determinism/idempotency: повторный вызов с тем же bot.id формирует одинаковые intents', () => {
    const batchUpdate = vi.fn();
    const storePort = { batchUpdate } as any;

    const bot = {
      id: 'bot-1',
      name: 'Bot 1',
      status: { type: 'draft' },
      workspaceId: 'ws-1',
      currentVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    } as BotInfo;

    updateCreateBotState(storePort, bot);
    updateCreateBotState(storePort, bot);

    expect(batchUpdate).toHaveBeenCalledTimes(2);

    const updates1 = batchUpdate.mock.calls[0]?.[0] as any[];
    const updates2 = batchUpdate.mock.calls[1]?.[0] as any[];

    expect(Object.isFrozen(updates1)).toBe(true);
    expect(Object.isFrozen(updates2)).toBe(true);
    expect(updates1).toHaveLength(2);
    expect(updates2).toHaveLength(2);

    // По содержимому intents должны быть детерминированными.
    expect(updates1).toEqual(updates2);

    expect(updates1[0]).toEqual({ type: 'upsertBot', bot });
    expect(updates2[0]).toEqual({ type: 'upsertBot', bot });

    expect(updates1[1]).toEqual({
      type: 'setCreateState',
      state: { status: 'success', data: bot },
    });
    expect(updates2[1]).toEqual({
      type: 'setCreateState',
      state: { status: 'success', data: bot },
    });

    // Внутри success-state сохраняется ссылка на исходный bot object.
    expect(updates1[1].state.data).toBe(bot);
    expect(updates2[1].state.data).toBe(bot);
    expect(Object.isFrozen(updates1[1].state)).toBe(true);
    expect(Object.isFrozen(updates2[1].state)).toBe(true);
  });
});

/* eslint-enable ai-security/model-poisoning */
