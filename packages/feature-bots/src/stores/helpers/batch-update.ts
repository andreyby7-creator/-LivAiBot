/**
 * @file packages/feature-bots/src/stores/helpers/batch-update.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Pure bots-store batch reducers
 * ============================================================================
 *
 * Единый источник правды для применения `BotsStoreBatchUpdate` и одиночных мутаций
 * entities/operations без Zustand. Используется из `stores/bots.ts` и может
 * вызываться напрямую в unit-тестах.
 */

import type { BotsStoreBatchUpdate } from '../../contracts/BotsStoreContract.js';
import type { BotInfo, BotsState } from '../../types/bots.js';
import { setOperation } from './operations.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Форма состояния, совместимая с `BotsStoreState` (без циклического импорта из `bots.ts`). */
export type BotsStoreBaseState = Readonly<{
  readonly version: number;
  readonly bots: BotsState;
}>;

export type ApplyBotsStoreBatchContext = Readonly<{
  readonly getInitial: () => BotsStoreBaseState;
  readonly isDev: () => boolean;
}>;

/* ============================================================================
 * 🧩 SINGLE-STEP REDUCERS (SSOT)
 * ============================================================================
 */

export function applyBotsStoreSetBotsList(
  current: BotsStoreBaseState,
  bots: readonly BotInfo[],
  isDev: boolean,
): BotsStoreBaseState {
  const entities: Record<BotInfo['id'], BotInfo> = {};
  for (const bot of bots) {
    entities[bot.id] = isDev ? Object.freeze(bot) : bot;
  }

  return {
    ...current,
    bots: {
      ...current.bots,
      entities,
    },
  };
}

export function applyBotsStoreUpsertBot(
  current: BotsStoreBaseState,
  bot: BotInfo,
  isDev: boolean,
): BotsStoreBaseState {
  const frozenBot = isDev ? Object.freeze(bot) : bot;
  return {
    ...current,
    bots: {
      ...current.bots,
      entities: {
        ...current.bots.entities,
        [bot.id]: frozenBot,
      },
    },
  };
}

export function applyBotsStoreSetCreateState(
  current: BotsStoreBaseState,
  next: BotsState['operations']['create'],
): BotsStoreBaseState {
  return {
    ...current,
    bots: setOperation('create', next)(current.bots),
  };
}

export function applyBotsStoreSetUpdateState(
  current: BotsStoreBaseState,
  next: BotsState['operations']['update'],
): BotsStoreBaseState {
  return {
    ...current,
    bots: setOperation('update', next)(current.bots),
  };
}

export function applyBotsStoreSetDeleteState(
  current: BotsStoreBaseState,
  next: BotsState['operations']['delete'],
): BotsStoreBaseState {
  return {
    ...current,
    bots: setOperation('delete', next)(current.bots),
  };
}

/* ============================================================================
 * 🧩 BATCH — TABLE DISPATCH
 * ============================================================================
 */

const STEP_HANDLERS: Readonly<
  {
    readonly [K in BotsStoreBatchUpdate['type']]: (
      state: BotsStoreBaseState,
      update: Extract<BotsStoreBatchUpdate, { readonly type: K; }>,
      ctx: ApplyBotsStoreBatchContext,
    ) => BotsStoreBaseState;
  }
> = Object.freeze({
  reset: (_state, _update, ctx) => ctx.getInitial(),

  setBotsList: (state, update, ctx) => applyBotsStoreSetBotsList(state, update.bots, ctx.isDev()),

  upsertBot: (state, update, ctx) => applyBotsStoreUpsertBot(state, update.bot, ctx.isDev()),

  setCreateState: (state, update) =>
    applyBotsStoreSetCreateState(
      state,
      update.state as BotsState['operations']['create'],
    ),

  setUpdateState: (state, update) =>
    applyBotsStoreSetUpdateState(
      state,
      update.state as BotsState['operations']['update'],
    ),

  setDeleteState: (state, update) =>
    applyBotsStoreSetDeleteState(
      state,
      update.state as BotsState['operations']['delete'],
    ),
});

/**
 * Чистое применение цепочки batch-intents к снимку стора (один проход).
 *
 * @remarks
 * Не вызывает Zustand `set` — только возвращает следующее состояние.
 */
export function applyBotsStoreBatchUpdates(
  state: BotsStoreBaseState,
  updates: readonly BotsStoreBatchUpdate[],
  ctx: ApplyBotsStoreBatchContext,
): BotsStoreBaseState {
  let next: BotsStoreBaseState = state;
  for (const update of updates) {
    const step = STEP_HANDLERS[update.type] as (
      s: BotsStoreBaseState,
      u: BotsStoreBatchUpdate,
      c: ApplyBotsStoreBatchContext,
    ) => BotsStoreBaseState;
    next = step(next, update, ctx);
  }
  return next;
}
