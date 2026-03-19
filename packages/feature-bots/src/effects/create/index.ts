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
