/**
 * @file packages/feature-bots/src/schemas/schemas.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Zod-схемы и типы для DTO ботов
 * ============================================================================
 *
 * Архитектурная роль:
 * - Runtime-валидация для UI/SDK форм и API boundary вокруг домена ботов.
 * - Type-safe схемы на базе доменных типов и контрактов `@livai/core-contracts/validation/zod`.
 * - Strict-режим для UI (нет extra полей), безопасный для эволюции контрактов.
 * - Поддержка всех основных сценариев:
 *   - создание/обновление/публикация/тестирование бота;
 *   - мультиагентные схемы;
 *   - шаблоны ботов;
 *   - события аудита ботов.
 *
 * Принципы:
 * - ❌ Нет бизнес-логики (только структура и валидация DTO). superRefine — только для structural invariants (граф, лимиты, уникальность); lifecycle и доменные бизнес-инварианты проверяются в domain validators (assertBotInvariant, assertMultiAgentSchemaInvariant).
 * - ✅ Источник истины для домена: типы и инварианты в `domain/*`, здесь — runtime-валидация.
 * - ✅ Strict-режим для UI/SDK: запрет extra полей, явные DTO-формы.
 * - ✅ Deterministic: объединения и rule-engine без if/else-монолита; уникальность приоритета внутри trigger-группы гарантируется схемой.
 * - ✅ Domain-pure: без HTTP/DB/transport-деталей за пределами DTO-протокола.
 * - ✅ Extensible: новые сценарии — расширением union-типов и registry; лимиты (maxRecordEntries и др.) экспортируются для единообразия.
 */

import { z } from 'zod';

// Зона: слой схем и refinement. Исключения по решению:
// — Схемы — статические объекты валидации (не пользовательские данные): prefer-immutable-types, context-leakage, model-poisoning, data-leakage.
// — В .superRefine/.refine колбеках разрешены if, циклы и вызовы addIssue ради побочного эффекта: no-conditional-statements, no-loop-statements, no-unused-expression.
/* eslint-disable functional/prefer-immutable-types, @livai/rag/context-leakage, ai-security/model-poisoning, ai-security/data-leakage, functional/no-conditional-statements, functional/no-loop-statements, fp/no-unused-expression */

/* ============================================================================
 * 📏 VALIDATION CONSTANTS
 * ============================================================================ */

/** Максимальная длина строкового идентификатора. Экспорт для единообразия лимитов в новых схемах. */
export const maxStringIdLength = 128;
/** Максимальная длина ключа в record. Экспорт для единообразия лимитов в новых схемах. */
export const maxRecordKeyLength = 64;
/** Максимальное количество записей в record. Экспорт для единообразия лимитов в новых схемах. */
export const maxRecordEntries = 50;
// Максимальное безопасное целое число (Number.MAX_SAFE_INTEGER = 2^53 - 1)
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/* ============================================================================
 * 🔧 VALIDATION HELPERS
 * ============================================================================ */

/** Вызов ctx.addIssue; возвращает false для использования в выражениях при необходимости. */
const addIssue = (
  ctx: z.RefinementCtx,
  issue: Parameters<z.RefinementCtx['addIssue']>[0],
): false => {
  ctx.addIssue(issue);
  return false;
};

/** Валидатор: не более limit записей в record. Подписан под Zod (value: unknown). */
const ensureMaxEntries =
  (limit: number, field: string) => (value: unknown, ctx: z.RefinementCtx): void => {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length > limit) {
      addIssue(ctx, {
        code: 'custom',
        message: `${field} MUST NOT contain more than ${limit} entries`,
      });
    }
  };

// Хелпер для создания bounded record схем с ограничением на длину ключей.
const boundedRecord = (valueSchema: z.ZodTypeAny): z.ZodTypeAny =>
  z.record(z.string().max(maxRecordKeyLength), valueSchema);

/** Record-схема с ограничением на длину ключей и на число записей (DRY). Используется для metadata.*, audit context. */
const maxEntriesRecord = (valueSchema: z.ZodTypeAny, fieldName: string): z.ZodTypeAny =>
  boundedRecord(valueSchema).superRefine(ensureMaxEntries(maxRecordEntries, fieldName));

/** Допустимые типы значений в расширяемых record (metadata, integrationConfig, audit context). Исключает произвольные объекты — только скаляры. */
const scalarRecordValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/** Значения в контексте аудита — только скаляры, чтобы исключить инъекцию произвольных структур. */
const auditContextValueSchema = scalarRecordValueSchema;

/* ============================================================================
 * 🔢 PRIMITIVE SCHEMAS
 * ========================================================================== */

// Базовые примитивы
const stringIdSchema = z.string().trim().min(1).max(maxStringIdLength);
const positiveIntSchema = z.number().int().min(0).max(MAX_SAFE_INTEGER);

// Revision / BotVersion — DTO-уровень работает с «сырыми» числами; брендинг — забота мапперов.
const versionNumberSchema = z.number().int().nonnegative();
const revisionSchema = versionNumberSchema;
const botVersionSchema = versionNumberSchema;

// ID-типы — на DTO-уровне это просто непустые строки.
const botIdSchema = stringIdSchema;
const workspaceIdSchema = stringIdSchema;
const userIdSchema = stringIdSchema;
const botTemplateIdSchema = stringIdSchema;
const botVersionIdSchema = stringIdSchema;
const agentIdSchema = stringIdSchema;
const eventIdSchema = stringIdSchema;

/* ============================================================================
 * 🧩 BOT SETTINGS SCHEMAS
 * ============================================================================
 *
 * Схемы отражают доменные типы из `BotSettings.ts`.
 */

const temperatureSchema = z.number().min(0).max(2);

const contextWindowSchema = z.number().int().nonnegative();

const piiMaskingSchema = z.boolean();

const imageRecognitionSchema = z.boolean();

const unrecognizedMessageSettingsSchema = z.object({
  message: z.string().min(1),
  showSupportHint: z.boolean(),
}).strict();

const interruptionRulesSchema = z.object({
  allowUserInterruption: z.boolean(),
  maxConcurrentSessions: z.number().int().positive(),
}).strict();

const botFeatureFlagsSchema = z.object({
  handoff: z.boolean(),
  analytics: z.boolean(),
  advanced_memory: z.boolean(),
}).strict();

const integrationConfigSchema = boundedRecord(scalarRecordValueSchema);

const botSettingsExtraSchema = z.object({
  settingsSchemaVersion: z.number().int().nonnegative().optional(),
  featureFlags: botFeatureFlagsSchema.optional(),
  integrationConfig: integrationConfigSchema.optional(),
}).strict();

/** Zod-схема для доменной модели `BotSettings` */
export const botSettingsSchema = z.object({
  temperature: temperatureSchema,
  contextWindow: contextWindowSchema,
  piiMasking: piiMaskingSchema,
  imageRecognition: imageRecognitionSchema,
  unrecognizedMessage: unrecognizedMessageSettingsSchema,
  interruptionRules: interruptionRulesSchema,
  extra: botSettingsExtraSchema.optional(),
}).strict();

/**
 * Тип inferred-значений настроек бота.
 */
export type BotSettingsValues = z.infer<typeof botSettingsSchema>;

/* ============================================================================
 * 🧩 BOT DTO SCHEMAS (Create / Update / Publish / Test)
 * ============================================================================
 *
 * Эти схемы оборачивают DTO-типизацию из `dto/*` и связывают её с Zod.
 */

/** Схема DTO `CreateBotRequest` */
export const createBotRequestSchema = z.object({
  name: z.string().min(1),
  instruction: z.string().min(1),
  settings: botSettingsSchema,
  templateId: botTemplateIdSchema.optional(),
}).strict();

export type CreateBotRequestValues = z.infer<typeof createBotRequestSchema>;

/**
 * Схема DTO `UpdateBotMetadataRequest`.
 * Использует паттерн AtLeastOne через refine на уровне Zod.
 */
export const updateBotMetadataRequestSchemaBase = z.object({
  name: z.string().min(1).optional(),
  currentVersion: botVersionSchema,
}).strict();

export const updateBotMetadataRequestSchema = updateBotMetadataRequestSchemaBase
  .refine(
    (value) => value.name !== undefined,
    {
      message: 'At least one metadata field MUST be provided',
      path: ['name'],
    },
  );

export type UpdateBotMetadataRequestValues = z.infer<typeof updateBotMetadataRequestSchema>;

/**
 * Схема DTO `UpdateBotConfigRequest`.
 * AtLeastOne для конфигурационных полей + обязательный `operationId`.
 */
export const updateBotConfigRequestSchemaBase = z.object({
  instruction: z.string().min(1).optional(),
  settings: botSettingsSchema.optional(),
  operationId: z.string().min(1),
}).strict();

export const updateBotConfigRequestSchema = updateBotConfigRequestSchemaBase
  .refine(
    (value) => value.instruction !== undefined || value.settings !== undefined,
    {
      message: 'At least one configuration field (instruction or settings) MUST be provided',
      path: ['instruction'],
    },
  );

export type UpdateBotConfigRequestValues = z.infer<typeof updateBotConfigRequestSchema>;

/** Схема DTO `PublishBotRequest` как детерминированный discriminated union: publish / rollback */
export const publishBotRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('publish'),
    version: botVersionSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('rollback'),
    rollbackVersion: botVersionSchema,
  }).strict(),
]);

export type PublishBotRequestValues = z.infer<typeof publishBotRequestSchema>;

/** Схема DTO `TestBotRequest` */
export const testBotRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: stringIdSchema.optional(),
  context: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type TestBotRequestValues = z.infer<typeof testBotRequestSchema>;

/* ============================================================================
 * 🧩 BOT DOMAIN SNAPSHOT SCHEMAS
 * ============================================================================
 *
 * Эти схемы удобны для сериализации/десериализации доменных слепков (например, в event-store).
 */

/** Zod-схема для `BotMetadata` */
export const botMetadataSchema = z.object({
  labels: z.array(z.string()).optional(),
  features: maxEntriesRecord(z.boolean(), 'metadata.features').optional(),
  integrations: maxEntriesRecord(scalarRecordValueSchema, 'metadata.integrations').optional(),
  extra: maxEntriesRecord(scalarRecordValueSchema, 'metadata.extra').optional(),
}).strict();

/**
 * Схема для агрегата `Bot`.
 * Инварианты lifecycle (deletedAt vs status) проверяются в доменном слое через `assertBotInvariant`.
 */
export const botSchema = z.object({
  id: botIdSchema,
  workspaceId: workspaceIdSchema,
  name: z.string().min(1),
  revision: revisionSchema,
  currentVersion: botVersionSchema,
  metadata: botMetadataSchema,
  createdAt: positiveIntSchema,
  updatedAt: positiveIntSchema.optional(),
  createdBy: userIdSchema,
  updatedBy: userIdSchema.optional(),
  status: z.object({
    type: z.enum([
      'draft',
      'active',
      'paused',
      'archived',
      'suspended',
      'deprecated',
      'deleted',
    ]),
  }).strict(),
  deletedAt: positiveIntSchema.optional(),
}).strict();

export type BotValues = z.infer<typeof botSchema>;

/* ============================================================================
 * 🧩 BOT VERSION SNAPSHOT SCHEMAS
 * ============================================================================
 */

export const botVersionMetadataSchema = z.object({
  rollbackFromVersion: botVersionSchema.optional(),
  tags: z.array(z.string()).optional(),
  extra: boundedRecord(scalarRecordValueSchema).optional(),
}).strict();

export const botSettingsSnapshotSchema = botSettingsSchema;

export const botVersionAggregateSchema = z.object({
  id: botVersionIdSchema,
  botId: botIdSchema,
  workspaceId: workspaceIdSchema,
  version: botVersionSchema,
  instruction: z.string().min(1),
  settings: botSettingsSnapshotSchema,
  operationId: z.string().min(1),
  createdAt: positiveIntSchema,
  createdBy: userIdSchema,
  metadata: botVersionMetadataSchema,
}).strict();

export type BotVersionAggregateValues = z.infer<typeof botVersionAggregateSchema>;

/* ============================================================================
 * 🧩 BOT TEMPLATE SCHEMAS
 * ============================================================================
 */

const botTemplateRoleSchema = z.enum(['assistant', 'support', 'sales', 'analytics', 'system']);

const botTemplateCapabilitySchema = z.enum([
  'multi_channel',
  'handoff',
  'advanced_memory',
  'external_tools',
]);

const botTemplateCapabilitiesSchema = z.array(botTemplateCapabilitySchema)
  .refine(
    (value) => new Set(value).size === value.length,
    { message: 'Capabilities MUST NOT contain duplicates' },
  );

const botTemplateTagsSchema = z.array(z.string())
  .refine(
    (value) => new Set(value).size === value.length,
    { message: 'Tags MUST NOT contain duplicates' },
  );

export const botTemplateSchema = z.object({
  id: botTemplateIdSchema,
  name: z.string().min(1),
  role: botTemplateRoleSchema,
  description: z.string().min(1),
  defaultInstruction: z.string().min(1),
  defaultSettings: botSettingsSchema,
  capabilities: botTemplateCapabilitiesSchema,
  tags: botTemplateTagsSchema,
}).strict();

export type BotTemplateValues = z.infer<typeof botTemplateSchema>;

/* ============================================================================
 * 🧩 MULTI-AGENT SCHEMAS & RULE-ENGINE
 * ============================================================================
 *
 * Эти схемы отражают мультиагентную модель и rule-engine без if/else-монолита:
 * - SwitchRules / CallRules / Guardrails.
 * - Вся масштабируемость достигается через union-типы и registry-driven подход.
 */

// Numeric types (DTO-уровень не навешивает brand, только проверяет диапазон).
const maxCallDepthSchema = z.number().int().positive();

const maxCallsPerAgentSchema = z.number().int().positive();

const agentCallTimeoutSchema = z.number().int().positive();

/**
 * Приоритет правила (0 — наивысший, чем больше число, тем ниже приоритет).
 * Используется для детерминированного упорядочивания правил во внешнем rule-engine.
 */
const rulePrioritySchema = z.number().int().nonnegative();

// Agent graph
const agentEdgeTypeSchema = z.enum(['call', 'switch', 'fallback']);

const agentEdgeSchema = z.object({
  source: agentIdSchema,
  target: agentIdSchema,
  type: agentEdgeTypeSchema,
}).strict();

const agentNodeSchema = z.object({
  id: agentIdSchema,
  isRoot: z.boolean(),
}).strict();

const agentGraphSchema = z.object({
  nodes: z.array(agentNodeSchema),
  edges: z.array(agentEdgeSchema),
}).strict();

// Switch rules
const switchTriggerSchema = z.enum([
  'user_intent',
  'topic_match',
  'explicit_switch',
  'fallback',
  'timeout',
  'error_threshold',
]);

const switchConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('intent_match'),
    intents: z.array(z.string()).min(1),
  }).strict(),
  z.object({
    type: z.literal('topic_match'),
    topics: z.array(z.string()).min(1),
  }).strict(),
  z.object({
    type: z.literal('confidence_threshold'),
    minConfidence: z.number().min(0).max(1),
  }).strict(),
  z.object({
    type: z.literal('error_count_threshold'),
    maxErrors: z.number().int().nonnegative(),
  }).strict(),
]);

export const switchRuleSchema = z.object({
  trigger: switchTriggerSchema,
  targetAgent: agentIdSchema,
  priority: rulePrioritySchema,
  conditions: switchConditionSchema.optional(),
}).strict();

export const switchRulesSchema = z.array(switchRuleSchema);

// Call rules
const callTriggerSchema = z.enum([
  'function_call',
  'tool_required',
  'specialized_task',
  'explicit_call',
  'context_enrichment',
]);

const callConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('function_name_match'),
    functionNames: z.array(z.string()).min(1),
  }).strict(),
  z.object({
    type: z.literal('tool_type_match'),
    toolTypes: z.array(z.string()).min(1),
  }).strict(),
  z.object({
    type: z.literal('task_category_match'),
    categories: z.array(z.string()).min(1),
  }).strict(),
  z.object({
    type: z.literal('context_key_match'),
    requiredKeys: z.array(z.string()).min(1),
  }).strict(),
]);

export const callRuleSchema = z.object({
  trigger: callTriggerSchema,
  targetAgent: agentIdSchema,
  priority: rulePrioritySchema,
  conditions: callConditionSchema.optional(),
}).strict();

export const callRulesSchema = z.array(callRuleSchema);

// Guardrails
export const guardrailSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('max_call_depth'),
    maxDepth: maxCallDepthSchema,
    agentId: agentIdSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('max_calls_per_agent'),
    maxCalls: maxCallsPerAgentSchema,
    agentId: agentIdSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('call_timeout'),
    timeout: agentCallTimeoutSchema,
    agentId: agentIdSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('circular_call_prevention'),
    agentId: agentIdSchema.optional(),
  }).strict(),
]);

export const guardrailsSchema = z.array(guardrailSchema);

/* ---------- Graph validation helpers (SRP): по одной ответственности на функцию ---------- */

function validateUniqueNodes(
  nodes: readonly { id: string; }[],
  ctx: z.RefinementCtx,
): Set<string> {
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      addIssue(ctx, {
        code: 'custom',
        path: ['agentGraph', 'nodes'],
        message: `Duplicate agent node id detected: ${node.id}`,
      });
    } else {
      nodeIds.add(node.id);
    }
  }
  return nodeIds;
}

function validateEdgesExist(
  nodeIds: Set<string>,
  edges: readonly { source: string; target: string; }[],
  ctx: z.RefinementCtx,
): boolean {
  return edges.reduce<boolean>(
    (valid, edge) => {
      if (!nodeIds.has(edge.source)) {
        addIssue(ctx, {
          code: 'custom',
          path: ['agentGraph', 'edges'],
          message: `Edge source MUST reference existing node id: ${edge.source}`,
        });
        return false;
      }
      if (!nodeIds.has(edge.target)) {
        addIssue(ctx, {
          code: 'custom',
          path: ['agentGraph', 'edges'],
          message: `Edge target MUST reference existing node id: ${edge.target}`,
        });
        return false;
      }
      return valid;
    },
    true,
  );
}

function validateRootCount(
  nodes: readonly { isRoot: boolean; }[],
  ctx: z.RefinementCtx,
): number {
  const rootCount = nodes.reduce((count, node) => (node.isRoot ? count + 1 : count), 0);
  if (rootCount !== 1) {
    addIssue(ctx, {
      code: 'custom',
      path: ['agentGraph', 'nodes'],
      message: `Agent graph MUST have exactly 1 root node, found ${rootCount}`,
    });
  }
  return rootCount;
}

/**
 * Проверка уникальности приоритета внутри каждой trigger-группы.
 * При равных приоритетах порядок применения правил не определён; схема запрещает дубликаты.
 */
function validateUniquePrioritiesPerTrigger(
  rules: readonly { trigger: string; priority: number; }[],
  pathPrefix: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const byTrigger = new Map<string, Set<number>>();
  for (const rule of rules) {
    const existing = byTrigger.get(rule.trigger);
    if (existing !== undefined) {
      if (existing.has(rule.priority)) {
        addIssue(ctx, {
          code: 'custom',
          path: pathPrefix,
          message:
            `Duplicate priority ${rule.priority} for trigger "${rule.trigger}"; order of application would be undefined`,
        });
      } else {
        existing.add(rule.priority);
      }
    } else {
      byTrigger.set(rule.trigger, new Set([rule.priority]));
    }
  }
}

/**
 * Полная схема мультиагентной модели `MultiAgentSchema`.
 * Инварианты графа и множеств правил проверяются в доменном validator-е (`assertMultiAgentSchemaInvariant`).
 * Для очень больших графов тяжёлую проверку можно вынести в domain-валидатор, Zod оставить для базовой структуры.
 */
export const multiAgentSchema = z.object({
  agentGraph: agentGraphSchema,
  switchRules: switchRulesSchema,
  callRules: callRulesSchema,
  guardrails: guardrailsSchema,
}).strict()
  .superRefine((value, ctx): void => {
    const nodeIds = validateUniqueNodes(value.agentGraph.nodes, ctx);
    validateEdgesExist(nodeIds, value.agentGraph.edges, ctx);
    validateRootCount(value.agentGraph.nodes, ctx);
    validateUniquePrioritiesPerTrigger(value.switchRules, ['switchRules'], ctx);
    validateUniquePrioritiesPerTrigger(value.callRules, ['callRules'], ctx);
  });

export type MultiAgentSchemaValues = z.infer<typeof multiAgentSchema>;

/* ============================================================================
 * 🧩 BOT AUDIT EVENT SCHEMAS
 * ============================================================================
 */

const botAuditEventTypeSchema = z.enum([
  'bot_created',
  'bot_published',
  'bot_updated',
  'bot_deleted',
  'instruction_updated',
  'multi_agent_updated',
  'config_changed',
  'policy_violation',
]);

// Контексты событий аудита
const botPublishedContextSchema = z.object({
  version: botVersionSchema.optional(),
  previousVersion: botVersionSchema.optional(),
}).strict();

const botUpdatedContextSchema = z.object({
  updatedFields: z.array(z.string()).optional(),
}).strict();

const instructionUpdatedContextSchema = z.object({
  version: botVersionSchema.optional(),
  previousVersion: botVersionSchema.optional(),
}).strict();

const multiAgentUpdatedContextSchema = z.object({
  version: botVersionSchema.optional(),
  previousVersion: botVersionSchema.optional(),
}).strict();

const configChangedContextSchema = z.object({
  changedFields: z.array(z.string()).optional(),
}).strict();

const policyViolationContextSchema = z.object({
  policyId: z.string().optional(),
  errorCode: z.string().optional(),
  violation: z.string().optional(),
}).strict();

/**
 * Контекст события аудита по типу события.
 * Используется rule-engine без if/else через discriminated union (canonical pattern для лучшей производительности и типизации).
 */
export const botAuditEventContextSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bot_created'),
    context: maxEntriesRecord(auditContextValueSchema, 'bot_created.context').optional(),
  }).strict(),
  z.object({
    type: z.literal('bot_published'),
    context: botPublishedContextSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('bot_updated'),
    context: botUpdatedContextSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('bot_deleted'),
    context: maxEntriesRecord(auditContextValueSchema, 'bot_deleted.context').optional(),
  }).strict(),
  z.object({
    type: z.literal('instruction_updated'),
    context: instructionUpdatedContextSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('multi_agent_updated'),
    context: multiAgentUpdatedContextSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('config_changed'),
    context: configChangedContextSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('policy_violation'),
    context: policyViolationContextSchema.optional(),
  }).strict(),
]);

/**
 * Схема доменной модели `BotAuditEvent`.
 * Инварианты и соответствие контекста типу события проверяются в доменном validator-е.
 */
export const botAuditEventSchema = z.object({
  eventId: eventIdSchema,
  type: botAuditEventTypeSchema,
  botId: botIdSchema,
  workspaceId: workspaceIdSchema,
  timestamp: positiveIntSchema,
  userId: userIdSchema.optional(),
  context: maxEntriesRecord(auditContextValueSchema, 'BotAuditEvent.context').optional(),
}).strict();

/* ============================================================================
 * 🧩 NAMESPACE EXPORTS (DX-FRIENDLY)
 * ============================================================================
 *
 * Эти объекты группируют схемы для лучшего DX и автодополнения в IDE.
 */

export const BotSchemas = {
  Settings: botSettingsSchema,
  Metadata: botMetadataSchema,
  Aggregate: botSchema,
  VersionAggregate: botVersionAggregateSchema,
} as const;

export const BotDtoSchemas = {
  Create: createBotRequestSchema,
  UpdateMetadata: updateBotMetadataRequestSchema,
  UpdateConfig: updateBotConfigRequestSchema,
  Publish: publishBotRequestSchema,
  Test: testBotRequestSchema,
} as const;

export const MultiAgentSchemas = {
  Graph: agentGraphSchema,
  SwitchRule: switchRuleSchema,
  CallRule: callRuleSchema,
  Guardrail: guardrailSchema,
  Schema: multiAgentSchema,
} as const;

export type BotAuditEventValues = z.infer<typeof botAuditEventSchema>;

/* eslint-enable functional/prefer-immutable-types, @livai/rag/context-leakage, ai-security/model-poisoning, ai-security/data-leakage, functional/no-conditional-statements, functional/no-loop-statements, fp/no-unused-expression */
