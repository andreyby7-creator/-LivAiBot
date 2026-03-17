/**
 * @file packages/feature-bots/src/stores/bots.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS STORE — ЧИСТОЕ СОСТОЯНИЕ БОТОВ (ZUSTAND)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единственный источник правды для UI состояния ботов в feature-bots
 * - Чистое состояние без side-effects: store = state + sync transitions
 * - Effects/IO вынесены в `effects/` и взаимодействуют со store через порт (Port pattern)
 *
 * Гарантии:
 * - ❌ Нет async / side-effects
 * - ❌ Нет доменной оркестрации
 * - ✅ Детерминированные синхронные transitions
 * - ✅ Строгие типы (BotState/BotOperationState из `types/bots.ts`)
 * - ✅ SSR-safe через factory `createBotsStore`
 */
import type { StoreApi, UseBoundStore } from 'zustand';
import { create } from 'zustand';

import type { BotCommandType } from '../types/bot-commands.js';
import type { BotInfo, BotOperationState, BotState } from '../types/bots.js';

/* ============================================================================
 * 🧩 STORE VERSIONING
 * ========================================================================== */

export const botsStoreVersion = 1 as const;

/* ============================================================================
 * 🧱 STORE CONTRACT
 * ========================================================================== */

export type BotsStoreState = Readonly<{
  /** Версия store (для future persistence/migrations). */
  readonly version: number;
  /** Полное состояние ботов для UI/effects. */
  readonly bots: BotState;
}>;

export type BotsStoreActions = Readonly<{
  /** Полный reset к начальному состоянию. */
  readonly reset: () => void;

  /** Устанавливает список ботов целиком (обычно после fetch). */
  readonly setBotsList: (bots: readonly BotInfo[]) => void;
  /** Устанавливает выбранного бота (или null). */
  readonly setCurrentBotId: (botId: BotInfo['id'] | null) => void;

  /** Устанавливает состояние операции загрузки списка ботов. */
  readonly setListState: (state: BotOperationState<readonly BotInfo[]>) => void;
  /** Устанавливает состояние операции загрузки текущего бота. */
  readonly setCurrentBotState: (state: BotOperationState<BotInfo>) => void;

  /** Устанавливает состояние операции create. */
  readonly setCreateState: (state: BotOperationState<BotInfo>) => void;
  /** Устанавливает состояние операции update. */
  readonly setUpdateState: (state: BotOperationState<BotInfo>) => void;
  /** Устанавливает состояние операции delete. */
  readonly setDeleteState: (state: BotOperationState<void>) => void;
  /** Устанавливает состояние операции publish. */
  readonly setPublishState: (state: BotOperationState<BotInfo>) => void;
  /** Устанавливает состояние операции pause. */
  readonly setPauseState: (state: BotOperationState<BotInfo>) => void;
  /** Устанавливает состояние операции resume. */
  readonly setResumeState: (state: BotOperationState<BotInfo>) => void;
  /** Устанавливает состояние операции archive. */
  readonly setArchiveState: (state: BotOperationState<BotInfo>) => void;

  /**
   * Утилита: переводит состояние операции в loading с конкретным operation type.
   *
   * @remarks
   * Удобно для эффектов, чтобы единообразно выставлять loading.
   */
  readonly toLoading: (
    operation: BotCommandType,
  ) => Readonly<{ readonly status: 'loading'; readonly operation: BotCommandType; }>;
  /** Утилита: канонический idle state. */
  readonly toIdle: () => Readonly<{ readonly status: 'idle'; }>;
}>;

export type BotsStore = BotsStoreState & Readonly<{ readonly actions: BotsStoreActions; }>;

/* ============================================================================
 * 🏗️ INITIAL STATE
 * ========================================================================== */

const IDLE = Object.freeze({ status: 'idle' as const });

const createInitialBotState = (): BotState =>
  Object.freeze({
    list: Object.freeze({
      bots: Object.freeze([] as const),
      currentBotId: null,
      listState: IDLE,
      currentBotState: IDLE,
    }),
    create: IDLE,
    update: IDLE,
    delete: IDLE,
    publish: IDLE,
    pause: IDLE,
    resume: IDLE,
    archive: IDLE,
  });

export function createInitialBotsStoreState(): BotsStoreState {
  return Object.freeze({
    version: botsStoreVersion,
    bots: createInitialBotState(),
  });
}

/* ============================================================================
 * 🏭 FACTORY
 * ========================================================================== */

export type CreateBotsStoreConfig = Readonly<{
  /** Начальное состояние (для тестов/SSR). */
  readonly initialState?: BotsStoreState;
}>;

const EMPTY_CONFIG: CreateBotsStoreConfig = Object.freeze({});

/**
 * Создаёт Zustand store для ботов.
 *
 * @remarks
 * Factory делает store SSR-safe и упрощает unit тесты.
 */
export function createBotsStore(
  config: CreateBotsStoreConfig = EMPTY_CONFIG,
): UseBoundStore<StoreApi<BotsStore>> {
  const initial = config.initialState ?? createInitialBotsStoreState();

  return create<BotsStore>((set) => {
    const actions: BotsStoreActions = {
      reset: () => {
        set(() => initial);
      },
      setBotsList: (bots) => {
        set((state) => ({
          ...state,
          bots: {
            ...state.bots,
            list: {
              ...state.bots.list,
              bots,
            },
          },
        }));
      },
      setCurrentBotId: (botId) => {
        set((state) => ({
          ...state,
          bots: {
            ...state.bots,
            list: {
              ...state.bots.list,
              currentBotId: botId,
            },
          },
        }));
      },
      setListState: (listState) => {
        set((state) => ({
          ...state,
          bots: {
            ...state.bots,
            list: {
              ...state.bots.list,
              listState,
            },
          },
        }));
      },
      setCurrentBotState: (currentBotState) => {
        set((state) => ({
          ...state,
          bots: {
            ...state.bots,
            list: {
              ...state.bots.list,
              currentBotState,
            },
          },
        }));
      },
      setCreateState: (createState) => {
        set((state) => ({ ...state, bots: { ...state.bots, create: createState } }));
      },
      setUpdateState: (updateState) => {
        set((state) => ({ ...state, bots: { ...state.bots, update: updateState } }));
      },
      setDeleteState: (deleteState) => {
        set((state) => ({ ...state, bots: { ...state.bots, delete: deleteState } }));
      },
      setPublishState: (publishState) => {
        set((state) => ({ ...state, bots: { ...state.bots, publish: publishState } }));
      },
      setPauseState: (pauseState) => {
        set((state) => ({ ...state, bots: { ...state.bots, pause: pauseState } }));
      },
      setResumeState: (resumeState) => {
        set((state) => ({ ...state, bots: { ...state.bots, resume: resumeState } }));
      },
      setArchiveState: (archiveState) => {
        set((state) => ({ ...state, bots: { ...state.bots, archive: archiveState } }));
      },
      toLoading: (operation: BotCommandType) =>
        Object.freeze({ status: 'loading' as const, operation }),
      toIdle: () => IDLE,
    };

    return {
      ...initial,
      actions,
    };
  });
}
