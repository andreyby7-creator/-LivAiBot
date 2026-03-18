/**
 * @file packages/feature-bots/src/stores/helpers/operations.ts
 * ============================================================================
 * 🧩 FEATURE-BOTS — Store helper (setOperation)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единый helper для обновления `state.operations`
 * - Убирает дублирование `setState` логики в store
 *
 * Принципы:
 * - ✅ Pure updater: не мутирует state
 * - ✅ Key/value связаны типобезопасно (mapped types поверх OperationKey)
 */

import type { BotsOperations, BotsState } from '../../types/bots.js';

/* ============================================================================
 * 🔧 OPERATIONS — TYPE-SAFE UPDATERS
 * ========================================================================== */

export const setOperation = <K extends keyof BotsOperations>(
  key: K,
  value: BotsOperations[K],
) =>
(state: Readonly<BotsState>): Readonly<BotsState> => ({
  ...state,
  operations: {
    ...state.operations,
    [key]: value,
  },
});
