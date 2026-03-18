/**
 * @file packages/feature-bots/src/stores — Stores Layer
 * Публичный API store-слоя feature-bots (zustand).
 */

/* ============================================================================
 * 🔧 HELPERS — SHARED STORE UPDATERS
 * ========================================================================== */

/**
 * Store helpers: shared updaters для operations.
 * @public
 */
export { setOperation } from './helpers/operations.js';

/* ============================================================================
 * 🗃️ STORE — BOTS ZUSTAND STORE (STATE ONLY)
 * ========================================================================== */

/**
 * Bots store: Zustand store состояния ботов без side-effects.
 * @public
 */
export {
  type BotsStore,
  type BotsStoreActions,
  type BotsStoreState,
  botsStoreVersion,
  createBotsStore,
  type CreateBotsStoreConfig,
  createInitialBotsStoreState,
} from './bots.js';
