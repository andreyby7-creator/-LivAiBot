/**
 * @file packages/feature-bots/src/schemas — Validation Schemas
 * Публичный API пакета schemas.
 * Экспортирует все публичные схемы валидации для feature-bots.
 */

/* ============================================================================
 * ✅ VALIDATION SCHEMAS — СХЕМЫ ВАЛИДАЦИИ
 * ========================================================================== */

/**
 * Validation Schemas: схемы валидации для ботов, DTO, мультиагента и аудита.
 * Включает botSettings, create/update/publish/test request, botMetadata, botSchema,
 * botVersionAggregate, botTemplate, switch/call rules, guardrails, multiAgent, botAuditEvent и связанные типы.
 * @public
 */
export {
  botAuditEventContextSchema,
  botAuditEventSchema,
  type BotAuditEventValues,
  BotDtoSchemas,
  botMetadataSchema,
  botSchema,
  BotSchemas,
  botSettingsSchema,
  botSettingsSnapshotSchema,
  type BotSettingsValues,
  botTemplateSchema,
  type BotTemplateValues,
  type BotValues,
  botVersionAggregateSchema,
  type BotVersionAggregateValues,
  botVersionMetadataSchema,
  callRuleSchema,
  callRulesSchema,
  createBotRequestSchema,
  type CreateBotRequestValues,
  guardrailSchema,
  guardrailsSchema,
  maxRecordEntries,
  maxRecordKeyLength,
  maxStringIdLength,
  multiAgentSchema,
  MultiAgentSchemas,
  type MultiAgentSchemaValues,
  publishBotRequestSchema,
  type PublishBotRequestValues,
  testBotRequestSchema,
  type TestBotRequestValues,
  updateBotConfigRequestSchema,
  updateBotConfigRequestSchemaBase,
  type UpdateBotConfigRequestValues,
  updateBotMetadataRequestSchema,
  updateBotMetadataRequestSchemaBase,
  type UpdateBotMetadataRequestValues,
} from './schemas.js';
