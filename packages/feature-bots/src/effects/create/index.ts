/**
 * @file packages/feature-bots/src/effects/create — Create Effects
 * Публичный API create effects.
 * Экспортирует контракты и конфигурацию для create-bot orchestrator'ов.
 */

/* ============================================================================
 * ➕ CREATE BOT EFFECT — DI CONTRACTS & CONFIG
 * ========================================================================== */

/**
 * Create Bot Effect: вход и DI-конфигурация create-flow.
 * @public
 */
export type { CreateBotEffectConfig, CreateBotEffectInput } from './create-bot-effect.types.js';

/* ============================================================================
 * 🔁 CREATE API MAPPER — EFFECT INPUT ↔ API TRANSPORT
 * ========================================================================== */

/**
 * Create API Mapper: pure маппинг request/response для create-bot API.
 * @public
 */
export {
  mapCreateBotEffectInputToApiInput,
  mapCreateBotResponseToBotInfo,
} from './create-bot-api.mapper.js';

/* ============================================================================
 * 🗃️ CREATE STORE UPDATER — SUCCESS TRANSITION
 * ========================================================================== */

/**
 * Create Bot Store Updater: атомарное обновление bots-store после success-create.
 * @public
 */
export { updateCreateBotState } from './create-bot-store-updater.js';

/* ============================================================================
 * 🗃️ CREATE BOT AUDIT MAPPER — AUDIT EVENT VALUES
 * ============================================================================
 */

/**
 * Create Bot Audit Mapper: success/failure create-flow → `BotAuditEventValues`.
 * @public
 */
export {
  type CreateBotFailureAuditContext,
  type CreateBotSuccessAuditContext,
  mapCreateBotErrorToAuditEvent,
  mapCreateBotResultToAuditEvent,
} from './create-bot-audit.mapper.js';
