/**
 * @file packages/feature-bots/src/lib — Lib Layer
 * Публичный API lib-слоя feature-bots.
 *
 * @remarks
 * Lib-слой содержит pure утилиты и rule-engine адаптеры поверх domain/types/contracts,
 * не добавляя transport деталей в домен.
 */

/* ============================================================================
 * 🧰 LIB — УТИЛИТЫ И RULE-ENGINE
 * ========================================================================== */

/**
 * Error Mapper: production-grade rule-engine для преобразования boundary/unknown ошибок в `BotError`.
 * @public
 */
export {
  type BotErrorInput,
  type MapBotErrorConfig,
  mapBotErrorToUI,
  type MapFn,
  type MappingRule,
  type MatchFn,
} from './error-mapper.js';

/**
 * Bot Errors: канонические метаданные кодов и фабрики/нормализация `BotErrorResponse`.
 * @public
 */
export {
  botErrorMetaByCode,
  createBotErrorResponse,
  type CreateBotErrorResponseInput,
  normalizeBotErrorResponse,
} from './bot-errors.js';

/**
 * Policy Adapter: преобразование core policy типов в feature-bots типы.
 * @public
 */
export {
  adaptBotModeToBotStatus,
  type AdaptBotModeToStatusInput,
  adaptBotPolicyActionToBotCommandType,
  type AdaptBotPolicyActionToCommandOptions,
  AllBotPolicyActions,
  type BotPolicyActionResolverContext,
  isBotMode,
  isBotPolicyAction,
  parseBotMode,
  parseBotPolicyAction,
} from './policy-adapter.js';

/**
 * Multi-Agent Validator: инварианты MultiAgentSchema (graph/rules/guardrails) + boundary limits.
 * @public
 */
export {
  assertMultiAgentSchemaInvariant,
  type MultiAgentInvariantCode,
  type MultiAgentInvariantIssue,
  type MultiAgentSchemaValidationFail,
  type MultiAgentSchemaValidationOk,
  type MultiAgentSchemaValidationResult,
  type MultiAgentValidationContext,
  type MultiAgentValidationRule,
  validateMultiAgentSchema,
  type ValidateMultiAgentSchemaOptions,
} from './multi-agent-validator.js';

/**
 * Version Manager: pure операции управления версиями конфигурации бота.
 * @public
 */
export {
  applyVersionToBot,
  createNextBotVersion,
  type CreateNextBotVersionInput,
  createRollbackBotVersion,
  type CreateRollbackBotVersionInput,
} from './version-manager.js';
