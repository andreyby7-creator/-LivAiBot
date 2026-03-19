/**
 * @file packages/feature-bots/src/contracts/BotsStoreContract.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bots Store Contract
 * ============================================================================
 *
 * Единый контракт обновлений стора для feature-bots effects/store.
 * Используется в обоих слоях, чтобы не допускать drift типов обновлений.
 */

import type { BotError, BotInfo } from '../types/bots.js';
import type { OperationState } from './OperationState.js';

/** Версия контракта bots-store batch intents (для future migrations/compatibility). */
export const botsStoreContractVersion = 1 as const;

/* ============================================================================
 * 🧭 CONTRACTS — Batch Updates
 * ============================================================================
 */

/**
 * UI/Store-level intents для `bots-store`.
 *
 * @remarks
 * Это низкоуровневый контракт мутаций, который предназначен только для feature-bots
 * store-updaters/effects и не является domain-level интерфейсом.
 */
export type BotsStoreBatchUpdate =
  | { readonly type: 'reset'; }
  | { readonly type: 'setBotsList'; readonly bots: readonly BotInfo[]; }
  | { readonly type: 'upsertBot'; readonly bot: BotInfo; }
  | {
    readonly type: 'setCreateState';
    readonly state: OperationState<BotInfo, BotError, 'create'>;
  }
  | {
    readonly type: 'setUpdateState';
    readonly state: OperationState<BotInfo, BotError, 'update'>;
  }
  | {
    readonly type: 'setDeleteState';
    // У core операция delete имеет результат `void`, а `undefined` — практично эквивалентно
    // и меньше ломает generic inference.
    readonly state: OperationState<undefined, BotError, 'delete'>;
  };
