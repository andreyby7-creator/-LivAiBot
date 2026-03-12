/**
 * @file packages/feature-bots/src/domain — Domain Types
 * Публичный API доменных типов feature-bots.
 */

/* ============================================================================
 * 🤖 BOTS DOMAIN — ДОМЕННЫЕ ТИПЫ БОТОВ
 * ========================================================================== */

/**
 * Bot Aggregate: доменная модель бота.
 * @public
 */
export {
  type ActiveBot,
  type ActiveBotStatus,
  assertBotInvariant,
  type Bot,
  type BotId,
  type BotInvariantError,
  type BotMetadata,
  type BotUserId,
  type BotVersion,
  type BotWorkspaceId,
  createBotInvariantError,
  type DeletedBot,
  type DeletedBotStatus,
  type Revision,
  type Timestamp,
} from './Bot.js';

/**
 * BotVersion Aggregate: доменная модель версии бота.
 * @public
 */
export {
  assertBotVersionInvariant,
  type BotInstruction,
  type BotSettingsSnapshot,
  type BotVersionAggregate,
  type BotVersionId,
  type BotVersionInvariantError,
  type BotVersionMetadata,
  createBotVersionInvariantError,
} from './BotVersion.js';

/**
 * Bot Retry Policy: централизованная retry-политика для ошибок ботов.
 * @public
 */
export {
  type BotRetryKey,
  BotRetryPolicy,
  getBotRetryable,
  mergeBotRetryPolicies,
} from './BotRetry.js';
