/**
 * @file Unit тесты для schemas/schemas.ts
 * Покрывают все Zod-схемы и refinement-логику (multiAgentSchema superRefine).
 * Цель: 100% покрытие кода.
 */
/* eslint-disable functional/no-conditional-statements -- тесты: проверка result.success и ветвление по error */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- тесты: внутри if (!result.success) error гарантирован */
/* eslint-disable @livai/rag/source-citation -- тесты: описания кейсов без цитирования источников */
/* eslint-disable ai-security/token-leakage -- тесты: false positive на подстроке в описании (validateUniquePriorities) */
/* eslint-disable @livai/multiagent/agent-isolation -- тесты: хелперы не агенты, изоляция не требуется */

import { describe, expect, it } from 'vitest';

import {
  botAuditEventContextSchema,
  botAuditEventSchema,
  BotDtoSchemas,
  botMetadataSchema,
  botSchema,
  BotSchemas,
  botSettingsSchema,
  botTemplateSchema,
  botVersionAggregateSchema,
  botVersionMetadataSchema,
  createBotRequestSchema,
  maxRecordEntries,
  maxRecordKeyLength,
  maxStringIdLength,
  multiAgentSchema,
  MultiAgentSchemas,
  publishBotRequestSchema,
  testBotRequestSchema,
  updateBotConfigRequestSchema,
  updateBotMetadataRequestSchema,
} from '../../../src/schemas/schemas.js';

// ============================================================================
// Helpers: минимальные валидные данные
// ============================================================================

function validBotSettings() {
  return {
    temperature: 0,
    contextWindow: 0,
    piiMasking: false,
    imageRecognition: false,
    unrecognizedMessage: { message: 'x', showSupportHint: false },
    interruptionRules: { allowUserInterruption: true, maxConcurrentSessions: 1 },
  };
}

function validAgentGraph() {
  return {
    nodes: [{ id: 'root', isRoot: true }],
    edges: [] as { source: string; target: string; type: 'call' | 'switch' | 'fallback'; }[],
  };
}

// ============================================================================
// Constants
// ============================================================================

describe('schemas constants', () => {
  it('export maxStringIdLength', () => {
    expect(maxStringIdLength).toBe(128);
  });
  it('export maxRecordKeyLength', () => {
    expect(maxRecordKeyLength).toBe(64);
  });
  it('export maxRecordEntries', () => {
    expect(maxRecordEntries).toBe(50);
  });
});

// ============================================================================
// botSettingsSchema
// ============================================================================

describe('botSettingsSchema', () => {
  it('принимает валидные настройки', () => {
    const result = botSettingsSchema.safeParse(validBotSettings());
    expect(result.success).toBe(true);
  });
  it('отклоняет невалидный temperature', () => {
    const result = botSettingsSchema.safeParse({ ...validBotSettings(), temperature: 3 });
    expect(result.success).toBe(false);
  });
  it('отклоняет extra поля (strict)', () => {
    const result = botSettingsSchema.safeParse({ ...validBotSettings(), extraField: 1 });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// createBotRequestSchema
// ============================================================================

describe('createBotRequestSchema', () => {
  it('принимает валидный запрос', () => {
    const result = createBotRequestSchema.safeParse({
      name: 'Bot',
      instruction: 'Do something',
      settings: validBotSettings(),
    });
    expect(result.success).toBe(true);
  });
  it('принимает с templateId', () => {
    const result = createBotRequestSchema.safeParse({
      name: 'Bot',
      instruction: 'x',
      settings: validBotSettings(),
      templateId: 'tpl-1',
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет пустое name', () => {
    const result = createBotRequestSchema.safeParse({
      name: '',
      instruction: 'x',
      settings: validBotSettings(),
    });
    expect(result.success).toBe(false);
  });
  it('отклоняет extra поля', () => {
    const result = createBotRequestSchema.safeParse({
      name: 'Bot',
      instruction: 'x',
      settings: validBotSettings(),
      extra: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// updateBotMetadataRequestSchema (refine AtLeastOne)
// ============================================================================

describe('updateBotMetadataRequestSchema', () => {
  it('принимает с name и currentVersion', () => {
    const result = updateBotMetadataRequestSchema.safeParse({
      name: 'New Name',
      currentVersion: 0,
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет без name (refine)', () => {
    const result = updateBotMetadataRequestSchema.safeParse({ currentVersion: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('At least one'))).toBe(true);
    }
  });
});

// ============================================================================
// updateBotConfigRequestSchema (refine AtLeastOne instruction | settings)
// ============================================================================

describe('updateBotConfigRequestSchema', () => {
  it('принимает с instruction и operationId', () => {
    const result = updateBotConfigRequestSchema.safeParse({
      instruction: 'Updated',
      operationId: 'op-1',
    });
    expect(result.success).toBe(true);
  });
  it('принимает с settings и operationId', () => {
    const result = updateBotConfigRequestSchema.safeParse({
      settings: validBotSettings(),
      operationId: 'op-1',
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет без instruction и без settings (refine)', () => {
    const result = updateBotConfigRequestSchema.safeParse({ operationId: 'op-1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('At least one'))).toBe(true);
    }
  });
});

// ============================================================================
// publishBotRequestSchema (discriminated union)
// ============================================================================

describe('publishBotRequestSchema', () => {
  it('принимает type publish', () => {
    const result = publishBotRequestSchema.safeParse({ type: 'publish' });
    expect(result.success).toBe(true);
  });
  it('принимает type publish с version', () => {
    const result = publishBotRequestSchema.safeParse({ type: 'publish', version: 1 });
    expect(result.success).toBe(true);
  });
  it('принимает type rollback с rollbackVersion', () => {
    const result = publishBotRequestSchema.safeParse({ type: 'rollback', rollbackVersion: 1 });
    expect(result.success).toBe(true);
  });
  it('отклоняет неверный type', () => {
    const result = publishBotRequestSchema.safeParse({ type: 'invalid' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// testBotRequestSchema
// ============================================================================

describe('testBotRequestSchema', () => {
  it('принимает валидный запрос', () => {
    const result = testBotRequestSchema.safeParse({ message: 'Hello' });
    expect(result.success).toBe(true);
  });
  it('отклоняет пустое message', () => {
    const result = testBotRequestSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// botMetadataSchema (maxEntriesRecord, scalar values)
// ============================================================================

describe('botMetadataSchema', () => {
  it('принимает пустой объект', () => {
    const result = botMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });
  it('принимает features/integrations/extra в лимите и скаляры', () => {
    const result = botMetadataSchema.safeParse({
      features: { a: true, b: false },
      integrations: { k: 'v' },
      extra: { n: 1, b: true },
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет features больше maxRecordEntries', () => {
    const keys = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, true]));
    const result = botMetadataSchema.safeParse({ features: keys });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('metadata.features'))).toBe(true);
    }
  });
  it('отклоняет значение не-скаляр в integrations', () => {
    const result = botMetadataSchema.safeParse({
      integrations: { k: { nested: 1 } },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// botSchema
// ============================================================================

describe('botSchema', () => {
  it('принимает валидный бот', () => {
    const result = botSchema.safeParse({
      id: 'bot-1',
      workspaceId: 'ws-1',
      name: 'Bot',
      revision: 0,
      currentVersion: 0,
      metadata: {},
      createdAt: 0,
      createdBy: 'u1',
      status: { type: 'draft' },
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет невалидный status type', () => {
    const result = botSchema.safeParse({
      id: 'bot-1',
      workspaceId: 'ws-1',
      name: 'Bot',
      revision: 0,
      currentVersion: 0,
      metadata: {},
      createdAt: 0,
      createdBy: 'u1',
      status: { type: 'invalid' },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// botVersionMetadataSchema, botVersionAggregateSchema
// ============================================================================

describe('botVersionMetadataSchema', () => {
  it('принимает extra со скалярами', () => {
    const result = botVersionMetadataSchema.safeParse({ extra: { k: 'v' } });
    expect(result.success).toBe(true);
  });
});

describe('botVersionAggregateSchema', () => {
  it('принимает валидный агрегат', () => {
    const result = botVersionAggregateSchema.safeParse({
      id: 'bv-1',
      botId: 'b1',
      workspaceId: 'ws1',
      version: 0,
      instruction: 'x',
      settings: validBotSettings(),
      operationId: 'op1',
      createdAt: 0,
      createdBy: 'u1',
      metadata: {},
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// botTemplateSchema (capabilities/tags unique refine)
// ============================================================================

describe('botTemplateSchema', () => {
  const baseTemplate = {
    id: 'tpl-1',
    name: 'T',
    role: 'assistant' as const,
    description: 'D',
    defaultInstruction: 'I',
    defaultSettings: validBotSettings(),
    capabilities: ['multi_channel'],
    tags: ['tag1'],
  };
  it('принимает валидный шаблон', () => {
    const result = botTemplateSchema.safeParse(baseTemplate);
    expect(result.success).toBe(true);
  });
  it('отклоняет дубликаты в capabilities', () => {
    const result = botTemplateSchema.safeParse({
      ...baseTemplate,
      capabilities: ['multi_channel', 'multi_channel'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Capabilities'))).toBe(true);
    }
  });
  it('отклоняет дубликаты в tags', () => {
    const result = botTemplateSchema.safeParse({
      ...baseTemplate,
      tags: ['a', 'a'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Tags'))).toBe(true);
    }
  });
});

// ============================================================================
// multiAgentSchema (superRefine: unique nodes, edges exist, root count, unique priorities)
// ============================================================================

describe('multiAgentSchema', () => {
  it('принимает валидную схему с одним root и валидными edges', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: {
        nodes: [
          { id: 'root', isRoot: true },
          { id: 'a', isRoot: false },
        ],
        edges: [{ source: 'root', target: 'a', type: 'call' }],
      },
      switchRules: [{ trigger: 'user_intent', targetAgent: 'a', priority: 0 }],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(true);
  });

  it('принимает несколько правил с одним trigger и разными приоритетами (покрытие existing.add)', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: validAgentGraph(),
      switchRules: [
        { trigger: 'user_intent', targetAgent: 'a', priority: 0 },
        { trigger: 'user_intent', targetAgent: 'b', priority: 1 },
      ],
      callRules: [
        { trigger: 'function_call', targetAgent: 'a', priority: 0 },
        { trigger: 'function_call', targetAgent: 'b', priority: 1 },
      ],
      guardrails: [],
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет дубликат node id (validateUniqueNodes)', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: {
        nodes: [
          { id: 'same', isRoot: true },
          { id: 'same', isRoot: false },
        ],
        edges: [],
      },
      switchRules: [],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Duplicate agent node id'))).toBe(
        true,
      );
    }
  });
  it('отклоняет edge source не из nodes (validateEdgesExist)', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: {
        nodes: [{ id: 'root', isRoot: true }],
        edges: [{ source: 'missing', target: 'root', type: 'call' }],
      },
      switchRules: [],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Edge source'))).toBe(true);
    }
  });
  it('отклоняет edge target не из nodes', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: {
        nodes: [{ id: 'root', isRoot: true }],
        edges: [{ source: 'root', target: 'missing', type: 'call' }],
      },
      switchRules: [],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Edge target'))).toBe(true);
    }
  });
  it('отклоняет 0 root (validateRootCount)', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: {
        nodes: [{ id: 'a', isRoot: false }],
        edges: [],
      },
      switchRules: [],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('exactly 1 root node'))).toBe(
        true,
      );
    }
  });
  it('отклоняет 2 root', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: {
        nodes: [
          { id: 'r1', isRoot: true },
          { id: 'r2', isRoot: true },
        ],
        edges: [],
      },
      switchRules: [],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('exactly 1 root node'))).toBe(
        true,
      );
    }
  });
  it('отклоняет дубликат приоритета в switchRules (validateUniquePrioritiesPerTrigger)', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: validAgentGraph(),
      switchRules: [
        { trigger: 'user_intent', targetAgent: 'a', priority: 1 },
        { trigger: 'user_intent', targetAgent: 'b', priority: 1 },
      ],
      callRules: [],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Duplicate priority'))).toBe(true);
      expect(result.error.issues.some((i) => String(i.path).includes('switchRules'))).toBe(true);
    }
  });
  it('отклоняет дубликат приоритета в callRules', () => {
    const result = multiAgentSchema.safeParse({
      agentGraph: validAgentGraph(),
      switchRules: [],
      callRules: [
        { trigger: 'function_call', targetAgent: 'a', priority: 0 },
        { trigger: 'function_call', targetAgent: 'b', priority: 0 },
      ],
      guardrails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message?.includes('Duplicate priority'))).toBe(true);
      expect(result.error.issues.some((i) => String(i.path).includes('callRules'))).toBe(true);
    }
  });
});

// ============================================================================
// switchRuleSchema / callRuleSchema / guardrailSchema (структура)
// ============================================================================

describe('switchRuleSchema', () => {
  it('принимает правило с conditions intent_match', () => {
    const result = MultiAgentSchemas.SwitchRule.safeParse({
      trigger: 'user_intent',
      targetAgent: 'agent-1',
      priority: 0,
      conditions: { type: 'intent_match', intents: ['i1'] },
    });
    expect(result.success).toBe(true);
  });
});

describe('callRuleSchema', () => {
  it('принимает правило с conditions function_name_match', () => {
    const result = MultiAgentSchemas.CallRule.safeParse({
      trigger: 'function_call',
      targetAgent: 'agent-1',
      priority: 0,
      conditions: { type: 'function_name_match', functionNames: ['f1'] },
    });
    expect(result.success).toBe(true);
  });
});

describe('guardrailSchema', () => {
  it('принимает max_call_depth', () => {
    const result = MultiAgentSchemas.Guardrail.safeParse({
      type: 'max_call_depth',
      maxDepth: 1,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// botAuditEventContextSchema (discriminated union по type)
// ============================================================================

describe('botAuditEventContextSchema', () => {
  it('принимает bot_created с context-скалярами', () => {
    const result = botAuditEventContextSchema.safeParse({
      type: 'bot_created',
      context: { key: 'value' },
    });
    expect(result.success).toBe(true);
  });
  it('принимает bot_deleted с context', () => {
    const result = botAuditEventContextSchema.safeParse({
      type: 'bot_deleted',
      context: { n: 1 },
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет context с не-скаляром в bot_created', () => {
    const result = botAuditEventContextSchema.safeParse({
      type: 'bot_created',
      context: { k: { nested: 1 } },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// botAuditEventSchema
// ============================================================================

describe('botAuditEventSchema', () => {
  it('принимает валидное событие', () => {
    const result = botAuditEventSchema.safeParse({
      eventId: 'ev-1',
      type: 'bot_created',
      botId: 'b1',
      workspaceId: 'ws1',
      timestamp: 0,
    });
    expect(result.success).toBe(true);
  });
  it('отклоняет context с не-скаляром', () => {
    const result = botAuditEventSchema.safeParse({
      eventId: 'ev-1',
      type: 'bot_created',
      botId: 'b1',
      workspaceId: 'ws1',
      timestamp: 0,
      context: { k: [] },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Namespace exports (DX)
// ============================================================================

describe('BotSchemas namespace', () => {
  it('содержит Settings, Metadata, Aggregate, VersionAggregate', () => {
    expect(BotSchemas.Settings).toBe(botSettingsSchema);
    expect(BotSchemas.Metadata).toBe(botMetadataSchema);
    expect(BotSchemas.Aggregate).toBe(botSchema);
    expect(BotSchemas.VersionAggregate).toBe(botVersionAggregateSchema);
  });
});

describe('BotDtoSchemas namespace', () => {
  it('содержит Create, UpdateMetadata, UpdateConfig, Publish, Test', () => {
    expect(BotDtoSchemas.Create).toBe(createBotRequestSchema);
    expect(BotDtoSchemas.UpdateMetadata).toBe(updateBotMetadataRequestSchema);
    expect(BotDtoSchemas.UpdateConfig).toBe(updateBotConfigRequestSchema);
    expect(BotDtoSchemas.Publish).toBe(publishBotRequestSchema);
    expect(BotDtoSchemas.Test).toBe(testBotRequestSchema);
  });
});

describe('MultiAgentSchemas namespace', () => {
  it('содержит Schema (multiAgentSchema)', () => {
    expect(MultiAgentSchemas.Schema).toBe(multiAgentSchema);
  });
});

/* eslint-enable functional/no-conditional-statements */
/* eslint-enable @typescript-eslint/no-unnecessary-condition */
/* eslint-enable @livai/rag/source-citation */
/* eslint-enable ai-security/token-leakage */
/* eslint-enable @livai/multiagent/agent-isolation */
