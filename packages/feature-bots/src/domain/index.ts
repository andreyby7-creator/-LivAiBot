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
 * BotSettings: доменная модель настроек бота.
 * @public
 */
export {
  assertBotSettingsInvariant,
  type BotFeatureFlag,
  type BotFeatureFlags,
  type BotIntegrationConfig,
  type BotSettings,
  type BotSettingsExtra,
  type ContextWindow,
  type ImageRecognitionEnabled,
  type InterruptionRules,
  type PiiMaskingEnabled,
  type Temperature,
  type UnrecognizedMessageSettings,
} from './BotSettings.js';

/**
 * BotTemplate: доменная модель шаблона бота.
 * @public
 */
export {
  assertBotTemplateInvariant,
  type BotTemplate,
  type BotTemplateCapabilities,
  type BotTemplateCapability,
  type BotTemplateId,
  type BotTemplateInvariantError,
  type BotTemplateRole,
  type BotTemplateTags,
  createBotTemplateInvariantError,
} from './BotTemplate.js';

/**
 * Prompt: доменная модель prompt-блоков инструкции.
 * @public
 */
export {
  assertPromptInvariant,
  type Constraints,
  createPrompt,
  createPromptInvariantError,
  type Greeting,
  type HandoffAction,
  type HandoffCondition,
  type HandoffRule,
  type HandoffRules,
  type HandoffTrigger,
  type Prompt,
  type PromptInvariantError,
  type PromptLanguage,
  type PromptRaw,
  type PromptStyle,
  type SystemPrompt,
} from './Prompt.js';

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
