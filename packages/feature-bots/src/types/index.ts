/**
 * @file packages/feature-bots/src/types — Type Definitions
 * Публичный API пакета types.
 * Экспортирует все публичные типы для feature-bots.
 */

/* ============================================================================
 * 🔁 BOT LIFECYCLE — АТОМАРНЫЕ КОНТРАКТЫ ЖИЗНЕННОГО ЦИКЛА
 * ========================================================================== */

/**
 * Bot Lifecycle: микро-контракты жизненного цикла ботов.
 * @public
 */
export {
  type BotEnforcementReason,
  type BotLifecycleReason,
  type BotPauseReason,
} from './bot-lifecycle.js';

/* ============================================================================
 * 🧾 BOT COMMANDS — ТИПЫ И КОНСТАНТЫ КОМАНД
 * ========================================================================== */

/**
 * Bot Commands: типы и константы команд управления ботами.
 * @public
 */
export {
  AllBotCommandTypes,
  type ArchiveBotPayload,
  type BotCommand,
  type BotCommandMeta,
  type BotCommandPayloadMap,
  type BotCommandType,
  BotCommandTypes,
  type CreateBotFromTemplatePayload,
  type CreateCustomBotPayload,
  type DeleteBotPayload,
  type ManageMultiAgentPayload,
  type OperationId,
  type PauseBotPayload,
  type PublishBotPayload,
  type ResumeBotPayload,
  type SimulateBotMessagePayload,
  type UpdateInstructionPayload,
} from './bot-commands.js';

/* ============================================================================
 * 🤖 BOT TYPES — АГРЕГИРУЮЩИЕ ТИПЫ СОСТОЯНИЯ И ОПЕРАЦИЙ БОТОВ
 * ========================================================================== */

/**
 * Bot Types: агрегирующие типы состояния и операций ботов.
 * @public
 */
export {
  type BotChannelErrorCode,
  type BotError,
  type BotErrorCategory,
  type BotErrorCode,
  type BotErrorContext,
  type BotErrorMappingConfig,
  type BotErrorMappingConfigBase,
  type BotErrorMappingConfigFunctions,
  type BotErrorMappingRegistry,
  type BotErrorSeverity,
  type BotErrorState,
  type BotField,
  type BotIdle,
  type BotInfo,
  type BotIntegrationErrorCode,
  type BotListState,
  type BotLoading,
  type BotOperationData,
  type BotOperationState,
  type BotParsingErrorCode,
  type BotPermissionErrorCode,
  type BotPolicyErrorCode,
  type BotState,
  type BotStatus,
  type BotSuccess,
  type BotValidationErrorCode,
  type BotWebhookErrorCode,
} from './bots.js';

/* ============================================================================
 * 📡 BOT EVENTS — ТИПЫ И КОНСТАНТЫ СОБЫТИЙ БОТОВ
 * ========================================================================== */

/**
 * Bot Events: типы и константы событий ботов.
 * @public
 */
export {
  type BotArchivedPayload,
  type BotConfigField,
  type BotCreatedPayload,
  type BotDeletedPayload,
  type BotEvent,
  type BotEventByType,
  type BotEventContext,
  type BotEventMeta,
  type BotEventPayload,
  type BotEventPayloadMap,
  botEventSchemaVersion,
  type BotEventType,
  BotEventTypes,
  type BotMutableField,
  type BotPausedPayload,
  type BotPublishedPayload,
  type BotResumedPayload,
  type BotUpdatedPayload,
  type ConfigChangedPayload,
  type CorrelationId,
  type InstructionUpdatedPayload,
  isBotEvent,
  isBotEventOfType,
  type MultiAgentUpdatedPayload,
  type SchemaVersion,
} from './bot-events.js';

/* ============================================================================
 * 🎯 BOT INITIAL STATES — КАНОНИЧЕСКИЕ НАЧАЛЬНЫЕ СОСТОЯНИЯ И ШАБЛОНЫ
 * ========================================================================== */

/**
 * Bot Initial States: канонические начальные состояния и pipeline hooks.
 * @public
 */
export {
  type BotAuditEventTemplate,
  BotAuditEventTemplateMap,
  type BotPipelineHookData,
  type BotPipelineHookFunction,
  type BotPipelineHookMap,
  type BotPipelineHookWithPriority,
  createBotAuditEventTemplate,
  type HookPriority,
  initialBotListState,
  initialBotOperationState,
  initialBotPipelineHookMap,
  initialBotState,
  registerBotPipelineHook,
} from './bots-initial.js';
