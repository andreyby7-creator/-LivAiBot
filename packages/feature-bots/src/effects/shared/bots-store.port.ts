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
 * - Type safety: обновления описаны как discriminated union (`BatchUpdate`)
 *
 * Инварианты:
 * - Этот порт **синхронный**: он не делает IO и не скрывает async/side-effects.
 * - Store-updater'ы в эффектах должны предпочитать `batchUpdate`, чтобы не разводить промежуточные состояния.
 * - `setStoreLocked` / `withStoreLock` — это НЕ настоящий concurrency-lock между эффектами.
 *   Это *re-entrancy guard* в рамках одного adapter instance (защита от повторных/вложенных обновлений).
 * - `getState` возвращает copy-on-write snapshot: consumers не получают ссылок на `entities/operations`.
 */

import type { OperationState } from '@livai/core';

import type { BotsStore, BotsStoreState } from '../../stores/bots.js';
import type { BotInfo, BotsState, OperationKey } from '../../types/bots.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Тип обновления стора для batchUpdate.
 * Discriminated union для type-safe обновлений.
 */
export type BatchUpdate =
  | { readonly type: 'reset'; }
  | { readonly type: 'setBotsList'; readonly bots: readonly BotInfo[]; }
  | { readonly type: 'setCreateState'; readonly state: BotsState['operations']['create']; }
  | { readonly type: 'setUpdateState'; readonly state: BotsState['operations']['update']; }
  | { readonly type: 'setDeleteState'; readonly state: BotsState['operations']['delete']; };

export function isBatchUpdateOfType<T extends BatchUpdate['type']>(
  update: BatchUpdate,
  type: T,
): update is Extract<BatchUpdate, { readonly type: T; }> {
  return update.type === type;
}

/**
 * Единый контракт стора для всех bot-эффектов.
 *
 * @remarks
 * Методы намеренно минимальны и маппятся 1:1 на `BotsStore.actions`.
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
   * @remarks Не является truly-atomic: обновления выполняются последовательно, подписчики могут увидеть промежуточные состояния.
   */
  readonly batchUpdate: (updates: readonly BatchUpdate[]) => void;

  /** Устанавливает список ботов целиком (обычно после fetch). */
  readonly setBotsList: (bots: readonly BotInfo[]) => void;

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

export type LoadingState = OperationState<never, string, never>;
export type SuccessState<T> = OperationState<T, string, never>;
export type ErrorState<E> = OperationState<never, string, E>;

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

export function createBotsStorePortAdapter(store: BotsStore): BotsStorePort {
  let isLocked = false;

  const assertUnlocked = (): void => {
    if (isLocked) {
      throw new Error(STORE_LOCKED_ERROR);
    }
  };

  return Object.freeze({
    setStoreLocked: (locked: boolean) => {
      isLocked = locked;
    },

    batchUpdate: (updates: readonly BatchUpdate[]) => {
      assertUnlocked();

      for (const update of updates) {
        switch (update.type) {
          case 'reset': {
            store.actions.reset();
            break;
          }
          case 'setBotsList': {
            store.actions.setBotsList(update.bots);
            break;
          }
          case 'setCreateState': {
            store.actions.setCreateState(update.state);
            break;
          }
          case 'setUpdateState': {
            store.actions.setUpdateState(update.state);
            break;
          }
          case 'setDeleteState': {
            store.actions.setDeleteState(update.state);
            break;
          }
          default: {
            const _exhaustive: never = update;
            throw new Error(`[BotsStorePort] Unsupported batch update: ${String(_exhaustive)}`);
          }
        }
      }
    },

    setBotsList: (bots) => {
      assertUnlocked();
      store.actions.setBotsList(bots);
    },
    setCreateState: (state) => {
      assertUnlocked();
      store.actions.setCreateState(state);
    },
    setUpdateState: (state) => {
      assertUnlocked();
      store.actions.setUpdateState(state);
    },
    setDeleteState: (state) => {
      assertUnlocked();
      store.actions.setDeleteState(state);
    },

    toLoading: (operation) => store.actions.toLoading(operation),
    toSuccess: (data) => store.actions.toSuccess(data),
    toError: (err) => store.actions.toError(err),

    getState: () => ({
      version: store.version,
      bots: {
        ...store.bots,
        entities: { ...store.bots.entities },
        operations: { ...store.bots.operations },
      },
    }),
  });
}
