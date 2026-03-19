/**
 * @file packages/feature-bots/src/effects/shared/bots-store.port.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bots Store Port (Shared)
 * ============================================================================
 *
 * Единый контракт стора для bot-эффектов.
 * Абстрагирует Zustand store, чтобы effects не зависели от реализации (`zustand`, selectors, middleware).
 *
 * Архитектурные решения:
 * - Port pattern: эффекты работают через интерфейс, не знают про Zustand
 * - Batch updates: `batchUpdate` применяет обновления синхронно и в фиксированном порядке
 * - Type safety: обновления описаны как discriminated union (`BotsStoreBatchUpdate`)
 *
 * Инварианты:
 * - Этот порт **синхронный**: он не делает IO и не скрывает async/side-effects.
 * - Store-updater'ы в эффектах должны предпочитать `batchUpdate`, чтобы не разводить промежуточные состояния.
 * - `setStoreLocked` / `withStoreLock` — guard re-entrancy внутри одного adapter instance (меж-эффектного lock нет).
 * - `getState` возвращает copy-on-write snapshot: consumers не получают ссылок на `entities/operations`.
 */

import type { BotsStoreBatchUpdate } from '../../contracts/BotsStoreContract.js';
import type { BotsStore, BotsStoreState } from '../../stores/bots.js';
import type { BotInfo, BotsState, OperationKey } from '../../types/bots.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

export type { BotsStoreBatchUpdate };

export function isBotsStoreBatchUpdateOfType<T extends BotsStoreBatchUpdate['type']>(
  update: BotsStoreBatchUpdate,
  type: T,
): update is Extract<BotsStoreBatchUpdate, { readonly type: T; }> {
  return update.type === type;
}

/**
 * Единый контракт стора для всех bot-эффектов.
 *
 * @remarks
 * Port-методы намеренно минимальны:
 * - мутации идут через `batchUpdate`, `set*`, `upsert`
 * - lifecycle-конструкторы (toLoading/toSuccess/toError) реализуются в port,
 *   чтобы store оставался только state + sync transitions.
 */
export type BotsStorePort = Readonly<{
  /**
   * Включает/выключает re-entrancy guard для мутаций.
   * @remarks Не является меж-эффектным lock'ом. Используйте `withStoreLock` для корректного finally.
   * @internal Предпочитайте `withStoreLock`. Прямой вызов опасен: легко забыть unlock.
   */
  readonly setStoreLocked: (locked: boolean) => void;

  /**
   * Применяет пачку обновлений синхронно и в фиксированном порядке.
   * @remarks
   * Должна применяться атомарно в смысле наблюдаемости: подписчики не должны
   * видеть промежуточные состояния между апдейтами одной logical-operation.
   */
  readonly batchUpdate: (updates: readonly BotsStoreBatchUpdate[]) => void;

  /** Устанавливает список ботов целиком (обычно после fetch). */
  readonly setBotsList: (bots: readonly BotInfo[]) => void;

  /** Upsert одного бота в `bots.entities` без потери остальных entities. */
  readonly upsertBot: (bot: BotInfo) => void;

  /** Устанавливает состояние операции create. */
  readonly setCreateState: (state: BotsState['operations']['create']) => void;
  /** Устанавливает состояние операции update. */
  readonly setUpdateState: (state: BotsState['operations']['update']) => void;
  /** Устанавливает состояние операции delete. */
  readonly setDeleteState: (state: BotsState['operations']['delete']) => void;

  /** Утилита: loading state по ключу операции. */
  readonly toLoading: (operation: OperationKey) => LoadingState;
  /** Утилита: success state. */
  readonly toSuccess: <T>(data: T) => SuccessState<T>;
  /** Утилита: error state. */
  readonly toError: <E>(err: E) => ErrorState<E>;

  /** Возвращает snapshot состояния стора без доступа к `actions` (read-only). */
  readonly getState: () => BotsStoreState;
}>;

export type LoadingState = Readonly<
  { readonly status: 'loading'; readonly operation: OperationKey; }
>;
export type SuccessState<T> = Readonly<{ readonly status: 'success'; readonly data: T; }>;
export type ErrorState<E> = Readonly<{ readonly status: 'error'; readonly error: E; }>;

/* ============================================================================
 * 🔒 LOCK UTILITY — Re-entrancy guard helper
 * ============================================================================
 */

export function withStoreLock<T>(storePort: BotsStorePort, operation: () => T): T {
  storePort.setStoreLocked(true);
  try {
    return operation();
  } finally {
    storePort.setStoreLocked(false);
  }
}

/* ============================================================================
 * 🔧 ADAPTER — BotsStore → BotsStorePort
 * ============================================================================
 */

const STORE_LOCKED_ERROR = '[BotsStorePort] Store is locked. Cannot update state.' as const;

/**
 * @internal Helpers to keep discriminant literals (`status`) stable
 * and return frozen (immutable) state objects.
 */
const freezeLoadingState = (operation: OperationKey): LoadingState =>
  Object.freeze({ status: 'loading' as const, operation });

const freezeSuccessState = <T>(data: T): SuccessState<T> =>
  Object.freeze({ status: 'success' as const, data });

const freezeErrorState = <E>(error: E): ErrorState<E> =>
  Object.freeze({ status: 'error' as const, error });

/**
 * Адаптер `BotsStore` (zustand store) -> `BotsStorePort` (effects API).
 *
 * @remarks
 * Адаптер добавляет re-entrancy guard и гарантирует наблюдаемую атомарность для `batchUpdate`.
 */
export function createBotsStorePortAdapter(store: BotsStore): BotsStorePort {
  let isLocked = false;

  const assertUnlocked = (): void => {
    if (isLocked) {
      throw new Error(STORE_LOCKED_ERROR);
    }
  };

  const adapter: BotsStorePort = Object.freeze({
    setStoreLocked: (locked: boolean) => {
      isLocked = locked;
    },

    batchUpdate: (updates: readonly BotsStoreBatchUpdate[]) => {
      assertUnlocked();
      // Атомарное применение выполняется одним `set` внутри zustand store (`applyBatchUpdate`),
      // чтобы подписчики не видели промежуточные состояния между шагами одной logical-operation.
      store.actions.applyBatchUpdate(updates);
    },

    setBotsList: (bots: readonly BotInfo[]) => {
      assertUnlocked();
      store.actions.setBotsList(bots);
    },
    upsertBot: (bot: BotInfo) => {
      assertUnlocked();
      store.actions.upsertBot(bot);
    },
    setCreateState: (state: BotsState['operations']['create']) => {
      assertUnlocked();
      store.actions.setCreateState(state);
    },
    setUpdateState: (state: BotsState['operations']['update']) => {
      assertUnlocked();
      store.actions.setUpdateState(state);
    },
    setDeleteState: (state: BotsState['operations']['delete']) => {
      assertUnlocked();
      store.actions.setDeleteState(state);
    },

    toLoading: (operation: OperationKey): LoadingState => freezeLoadingState(operation),
    toSuccess: <T>(data: T): SuccessState<T> => freezeSuccessState(data),
    toError: <E>(err: E): ErrorState<E> => freezeErrorState(err),

    getState: (): BotsStoreState => ({
      version: store.version,
      bots: {
        ...store.bots,
        entities: { ...store.bots.entities },
        operations: { ...store.bots.operations },
      },
    }),
  });

  return adapter;
}
