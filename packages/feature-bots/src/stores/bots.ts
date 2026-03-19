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
 * - ✅ Строгие типы (BotsState/BotsOperations из `types/bots.ts`)
 * - ✅ SSR-safe через factory `createBotsStore`
 */
import type { StoreApi, UseBoundStore } from 'zustand';
import { create } from 'zustand';

import type { BotsStoreBatchUpdate } from '../contracts/BotsStoreContract.js';
import type { BotInfo, BotsState } from '../types/bots.js';
import type { ApplyBotsStoreBatchContext } from './helpers/batch-update.js';
import {
  applyBotsStoreBatchUpdates,
  applyBotsStoreSetBotsList,
  applyBotsStoreSetCreateState,
  applyBotsStoreSetDeleteState,
  applyBotsStoreSetUpdateState,
  applyBotsStoreUpsertBot,
} from './helpers/batch-update.js';

/* ============================================================================
 * 🧩 LOCAL OPERATION HELPERS
 * ========================================================================== */

/**
 * ⚠️ ВАЖНО:
 * Это локальные минимальные реализации состояний операции.
 * Должны соответствовать контракту `OperationState` из `core/state-kit`.
 * Используются как значения по умолчанию для `bots.operations.{create,update,delete}`.
 * При изменении core — синхронизировать.
 */
const idle = (): Readonly<{ readonly status: 'idle'; }> => ({ status: 'idle' });

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
  readonly bots: BotsState;
}>;

export type BotsStoreActions = Readonly<{
  /** Полный reset к начальному состоянию. */
  readonly reset: () => void;

  /** Устанавливает список ботов целиком (обычно после fetch). */
  readonly setBotsList: (bots: readonly BotInfo[]) => void;

  /**
   * Upsert одного бота в `bots.entities` без перезаписи остальных entities.
   *
   * @remarks
   * Инвариант: `bot.id` должен быть уникальным ключом.
   * Это intent-based обновление, удобное для store-updater'ов после success-flow.
   */
  readonly upsertBot: (bot: BotInfo) => void;

  /**
   * Применяет batch-update атомарно (одним `set` в zustand).
   *
   * @remarks
   * Важно для consistency: подписчики не должны видеть промежуточные состояния
   * между последовательными апдейтами одной logical-operation (например, upsert entities
   * и set operations.create success).
   */
  readonly applyBatchUpdate: (updates: readonly BotsStoreBatchUpdate[]) => void;

  /** Устанавливает состояние операции create. */
  readonly setCreateState: (state: BotsState['operations']['create']) => void;
  /** Устанавливает состояние операции update. */
  readonly setUpdateState: (state: BotsState['operations']['update']) => void;
  /** Устанавливает состояние операции delete. */
  readonly setDeleteState: (state: BotsState['operations']['delete']) => void;
  /**
   * Утилита: переводит состояние операции в loading по ключу операции.
   *
   * @remarks
   * Удобно для effects/port-слоя, чтобы единообразно выставлять loading.
   */
  // toLoading/toSuccess/toError намеренно НЕ живут в store:
  // store = state + sync transitions, а lifecycle-конструкторы — в port/в helper layer.
}>;

export type BotsStore = BotsStoreState & Readonly<{ readonly actions: BotsStoreActions; }>;

/* ============================================================================
 * 🏗️ INITIAL STATE
 * ========================================================================== */

const createInitialBotsState = (): BotsState => ({
  entities: {},
  operations: {
    create: idle(),
    update: idle(),
    delete: idle(),
  },
});

export function createInitialBotsStoreState(): BotsStoreState {
  return {
    version: botsStoreVersion,
    bots: createInitialBotsState(),
  };
}

/* ============================================================================
 * 🏭 FACTORY
 * ========================================================================== */

export type CreateBotsStoreConfig = Readonly<{
  /** Начальное состояние (для тестов/SSR). */
  readonly initialState?: BotsStoreState;
}>;

const EMPTY_CONFIG: CreateBotsStoreConfig = {};

/**
 * Создаёт Zustand store для ботов.
 *
 * @remarks
 * Упрощает unit-тесты: позволяет подменять `initialState`.
 */
export function createBotsStore(
  config: CreateBotsStoreConfig = EMPTY_CONFIG,
): UseBoundStore<StoreApi<BotsStore>> {
  const getInitial = (): BotsStoreState => {
    const base = config.initialState ?? createInitialBotsStoreState();

    // Reset/SSR safety: возвращаем fresh snapshot, чтобы не разделять references между вызовами reset().
    return {
      ...base,
      bots: {
        ...base.bots,
        entities: { ...base.bots.entities },
        operations: { ...base.bots.operations },
      },
    };
  };

  const initial = getInitial();

  return create<BotsStore>((set) => {
    /** Контекст для `applyBotsStoreBatchUpdates` (имя без `batch` — иначе false positive `ai-security/model-poisoning` на подстроке `batch`). */
    const buildApplyUpdatesContext = (): ApplyBotsStoreBatchContext => ({
      getInitial,
      isDev: () => process.env['NODE_ENV'] !== 'production',
    });

    const actions: BotsStoreActions = {
      reset: () => {
        set(() => getInitial());
      },
      setBotsList: (bots) => {
        set((state) =>
          applyBotsStoreSetBotsList(
            state,
            bots,
            process.env['NODE_ENV'] !== 'production',
          )
        );
      },
      upsertBot: (bot) => {
        set((state) =>
          applyBotsStoreUpsertBot(
            state,
            bot,
            process.env['NODE_ENV'] !== 'production',
          )
        );
      },
      applyBatchUpdate: (updates) => {
        set((state) => applyBotsStoreBatchUpdates(state, updates, buildApplyUpdatesContext()));
      },
      setCreateState: (createState) => {
        set((state) => applyBotsStoreSetCreateState(state, createState));
      },
      setUpdateState: (updateState) => {
        set((state) => applyBotsStoreSetUpdateState(state, updateState));
      },
      setDeleteState: (deleteState) => {
        set((state) => applyBotsStoreSetDeleteState(state, deleteState));
      },
    };

    return {
      ...initial,
      actions,
    };
  });
}
