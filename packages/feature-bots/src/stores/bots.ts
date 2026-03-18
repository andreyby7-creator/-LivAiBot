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

import type { OperationState } from '@livai/core';

import type { BotInfo, BotsState, OperationKey } from '../types/bots.js';
import { setOperation } from './helpers/operations.js';

/* ============================================================================
 * 🧩 LOCAL OPERATION HELPERS
 * ========================================================================== */

/**
 * ⚠️ ВАЖНО:
 * Это локальные минимальные реализации состояний операции.
 * Должны соответствовать контракту `OperationState` из `core/state-kit`.
 * При изменении core — синхронизировать.
 */
const idle = <T, Op extends string, E>(): OperationState<T, Op, E> => ({ status: 'idle' });
const loading = <Op extends string>(operation: Op): OperationState<never, Op, never> => ({
  status: 'loading',
  operation,
});
const success = <T>(data: T): OperationState<T, string, never> => ({ status: 'success', data });
const failure = <E>(err: E): OperationState<never, string, E> => ({ status: 'error', error: err });

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
  readonly toLoading: (
    operation: OperationKey,
  ) => ReturnType<typeof loading>;

  /** Утилита: success state. */
  readonly toSuccess: <T>(data: T) => ReturnType<typeof success<T>>;

  /** Утилита: error state. */
  readonly toError: <E>(err: E) => ReturnType<typeof failure<E>>;
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
 * Factory делает store SSR-safe и упрощает unit тесты.
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
    const actions: BotsStoreActions = {
      reset: () => {
        set(() => getInitial());
      },
      setBotsList: (bots) => {
        set((state) => {
          const entities: Record<BotInfo['id'], BotInfo> = {};
          const isDev = process.env['NODE_ENV'] !== 'production';
          for (const bot of bots) {
            // Dev-only: защищаем store от случайных мутаций входных объектов (BotInfo трактуется как immutable).
            entities[bot.id] = isDev ? Object.freeze(bot) : bot;
          }

          return {
            ...state,
            bots: {
              ...state.bots,
              entities,
            },
          };
        });
      },
      setCreateState: (createState) => {
        set((state) => ({ ...state, bots: setOperation('create', createState)(state.bots) }));
      },
      setUpdateState: (updateState) => {
        set((state) => ({ ...state, bots: setOperation('update', updateState)(state.bots) }));
      },
      setDeleteState: (deleteState) => {
        set((state) => ({ ...state, bots: setOperation('delete', deleteState)(state.bots) }));
      },
      toLoading: (operationName: OperationKey) => loading(operationName),
      toSuccess: <T>(data: T) => success<T>(data),
      toError: <E>(err: E) => failure<E>(err),
    };

    return {
      ...initial,
      actions,
    };
  });
}
