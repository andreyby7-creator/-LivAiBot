/**
 * @file packages/feature-bots/src/stores — Stores Layer
 * Публичный API store-слоя feature-bots (zustand).
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
