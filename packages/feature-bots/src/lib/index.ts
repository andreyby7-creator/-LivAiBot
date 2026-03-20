/**
 * @file packages/feature-bots/src/lib — Lib Layer
 * Публичный API lib-слоя feature-bots.
 *
 * @remarks
 * Lib-слой содержит contracts-first rule-engine адаптеры и pure утилиты
 * (включая фабрики/нормализацию `BotError`), не добавляя transport/IO детали в домен.
 */

/* ============================================================================
 * 🧭 ERROR MAPPER — преобразование boundary/unknown → `BotError`
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
  normalizeBotError,
} from './error-mapper.js';

/* ============================================================================
 * 🧩 BOT ERRORS — `BotError` / `BotErrorResponse` без дрейфа метаданных
 * ========================================================================== */
/**
 * Bot Errors: канонические метаданные кодов и фабрики `BotError` / `BotErrorResponse` (без дрейфа retryable/category/severity).
 * @public
 */
export {
  botErrorMetaByCode,
  createBotErrorFromCode,
  createBotErrorResponse,
  type CreateBotErrorResponseInput,
  normalizeBotErrorResponse,
} from './bot-errors.js';

/* ============================================================================
 * 🧠 POLICY ADAPTER — адаптация core policy типажей
 * ========================================================================== */
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

/* ============================================================================
 * 🧾 MULTI-AGENT VALIDATOR — валидация схем и инвариантов
 * ========================================================================== */
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

/* ============================================================================
 * 🗓️ VERSION MANAGER — чистое управление версиями бота
 * ========================================================================== */
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

/* ============================================================================
 * 🔎 BOT AUDIT — нормализация и DI emit audit-ивентов
 * ========================================================================== */
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

/* ============================================================================
 * 📈 BOT TELEMETRY — телеметрия и DI emit sink
 * ========================================================================== */
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

/* ============================================================================
 * 🔁 BOT PIPELINE — pipeline composition и rule-engine
 * ========================================================================== */
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
