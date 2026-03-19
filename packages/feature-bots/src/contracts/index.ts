/**
 * @file packages/feature-bots/src/contracts — Contracts
 * Публичный API контрактов feature-bots для API boundary.
 */

/* ============================================================================
 * 📜 BOTS CONTRACTS — КОНТРАКТЫ ДЛЯ API BOUNDARY
 * ============================================================================
 */

/**
 * BotErrorResponse: нормализованный контракт ошибок ботов.
 * @public
 */
export { type BotErrorResponse, type BotErrorType } from './BotErrorResponse.js';

/**
 * OperationState contracts: generic lifecycle state (loading/success/error).
 * @public
 */
export {
  type OperationError,
  type OperationLoading,
  type OperationState,
  type OperationSuccess,
} from './OperationState.js';

/**
 * Bots store contracts: batch intents + contract version.
 * @public
 */
export { type BotsStoreBatchUpdate, botsStoreContractVersion } from './BotsStoreContract.js';
