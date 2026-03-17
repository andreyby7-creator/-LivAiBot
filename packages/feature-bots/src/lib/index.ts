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

/**
 * Bot Audit: runtime validation/normalization и DI emit для SIEM/логов.
 * @public
 */
export {
  type BotAuditSink,
  emitBotAuditEvent,
  type EmitBotAuditEventOptions,
  type EmitBotAuditEventResult,
  isBotAuditEventValues,
  normalizeBotAuditEventValues,
  type ParseBotAuditEventError,
  type ParseBotAuditEventErrorCode,
  parseBotAuditEventValues,
  toBotAuditEventValues,
} from './bot-audit.js';

/**
 * Bot Telemetry: pure builders метрик и DI emit sink.
 * @public
 */
export {
  type BotTelemetryEntityRef,
  type BotTelemetryError,
  type BotTelemetryErrorCode,
  type BotTelemetryEvent,
  type BotTelemetryMetadata,
  type BotTelemetryMetricName,
  BotTelemetryMetricNames,
  type BotTelemetrySink,
  type BotTelemetrySinkLike,
  createBotTelemetryEvent,
  createBotTelemetrySinkAdapter,
  type CreateBotTelemetrySinkAdapterInput,
  createConversationsStartedTelemetryEvent,
  type CreateConversationsStartedTelemetryInput,
  createIntegrationCallTelemetryEvent,
  type CreateIntegrationCallTelemetryInput,
  createLlmTokensTelemetryEvent,
  type CreateLlmTokensTelemetryInput,
  createMessagesProcessedTelemetryEvent,
  type CreateMessagesProcessedTelemetryInput,
  createWebhookTelemetryEvent,
  type CreateWebhookTelemetryInput,
  emitBotTelemetryEvent,
  type EmitBotTelemetryEventOptions,
  type EmitBotTelemetryEventResult,
} from './bot-telemetry.js';

/**
 * Bot Pipeline: обработка pipeline-триггеров + hook points (DI) и опциональный audit.
 * @public
 */
export {
  type BotPipelineAuditEmitter,
  type BotPipelineAuditMapper,
  type BotPipelineError,
  type BotPipelineErrorCode,
  type BotPipelineHookContext,
  type BotPipelineHooks,
  type BotPipelineResult,
  type BotPipelineRule,
  type BotPipelineRuleContext,
  type BotPipelineStepFailure,
  type BotPipelineStepId,
  type BotPipelineStepResult,
  type BotPipelineTrigger,
  emitBotPipelineAuditEvents,
  runBotPipeline,
  type RunBotPipelineOptions,
} from './bot-pipeline.js';
