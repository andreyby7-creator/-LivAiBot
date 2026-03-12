/**
 * @file Unit тесты для types/bot-commands.ts
 * Цель: 100% покрытие типов/констант команд ботов.
 */
import { describe, expect, it } from 'vitest';

import type { ID, ISODateString, TraceId } from '@livai/core-contracts';

import type {
  ArchiveBotPayload,
  BotCommand,
  BotCommandMeta,
  BotCommandPayloadMap,
  BotCommandType,
  CreateBotFromTemplatePayload,
  CreateCustomBotPayload,
  DeleteBotPayload,
  ManageMultiAgentPayload,
  OperationId,
  PauseBotPayload,
  PublishBotPayload,
  ResumeBotPayload,
  SimulateBotMessagePayload,
  UpdateInstructionPayload,
} from '../../../src/types/bot-commands.js';
import { AllBotCommandTypes, BotCommandTypes } from '../../../src/types/bot-commands.js';
import type { BotPauseReason } from '../../../src/types/bot-lifecycle.js';

const createOperationId = (): OperationId => 'op-1' as OperationId;
const createWorkspaceId = (): ID<'Workspace'> => 'workspace-1' as ID<'Workspace'>;
const createBotId = (): ID<'Bot'> => 'bot-1' as ID<'Bot'>;
const createTemplateId = (): ID<'BotTemplate'> => 'template-1' as ID<'BotTemplate'>;
const createSimulationId = (): ID<'BotSimulation'> => 'sim-1' as ID<'BotSimulation'>;
const createISODateString = (): ISODateString => '2026-01-01T00:00:00.000Z' as ISODateString;
const createTraceId = (): TraceId => 'trace-1' as TraceId;

const createMeta = (overrides: Partial<BotCommandMeta> = {}): BotCommandMeta => ({
  operationId: createOperationId(),
  createdAt: createISODateString(),
  ...overrides,
});

describe('BotCommandTypes', () => {
  it('содержит канонический набор строковых констант', () => {
    expect(BotCommandTypes.CREATE_BOT_FROM_TEMPLATE).toBe('create_bot_from_template');
    expect(BotCommandTypes.CREATE_CUSTOM_BOT).toBe('create_custom_bot');
    expect(BotCommandTypes.UPDATE_INSTRUCTION).toBe('update_instruction');
    expect(BotCommandTypes.MANAGE_MULTI_AGENT).toBe('manage_multi_agent');
    expect(BotCommandTypes.PUBLISH_BOT).toBe('publish_bot');
    expect(BotCommandTypes.PAUSE_BOT).toBe('pause_bot');
    expect(BotCommandTypes.RESUME_BOT).toBe('resume_bot');
    expect(BotCommandTypes.ARCHIVE_BOT).toBe('archive_bot');
    expect(BotCommandTypes.DELETE_BOT).toBe('delete_bot');
    expect(BotCommandTypes.SIMULATE_BOT_MESSAGE).toBe('simulate_bot_message');
  });

  it('является иммутабельным объектом', () => {
    expect(Object.isFrozen(BotCommandTypes)).toBe(true);
  });
});

describe('BotCommandType & AllBotCommandTypes', () => {
  it('AllBotCommandTypes содержит все значения BotCommandTypes и только их', () => {
    const allFromConst = new Set(AllBotCommandTypes);
    const allFromObject = new Set(Object.values(BotCommandTypes));

    expect(allFromConst.size).toBe(allFromObject.size);
    allFromObject.forEach((value) => {
      expect(allFromConst.has(value as BotCommandType)).toBe(true);
    });
  });

  it('каждый элемент AllBotCommandTypes совместим с BotCommandType', () => {
    const types: BotCommandType[] = [...AllBotCommandTypes];
    expect(types).toHaveLength(AllBotCommandTypes.length);
  });
});

describe('Payload types', () => {
  it('CreateBotFromTemplatePayload имеет строгую форму', () => {
    const payload: CreateBotFromTemplatePayload = {
      workspaceId: createWorkspaceId(),
      templateId: createTemplateId(),
      name: 'From template',
      instructionOverride: 'Custom instruction',
    };
    expect(payload.instructionOverride).toBe('Custom instruction');
  });

  it('CreateCustomBotPayload требует instruction', () => {
    const payload: CreateCustomBotPayload = {
      workspaceId: createWorkspaceId(),
      name: 'Custom bot',
      instruction: 'Do something',
    };
    expect(payload.instruction).toBe('Do something');
  });

  it('UpdateInstructionPayload использует botId и instruction', () => {
    const payload: UpdateInstructionPayload = {
      botId: createBotId(),
      instruction: 'New instruction',
    };
    expect(payload.botId).toBe(createBotId());
    expect(payload.instruction).toBe('New instruction');
  });

  it('ManageMultiAgentPayload содержит schemaVersion и serializedSchema', () => {
    const payload: ManageMultiAgentPayload = {
      botId: createBotId(),
      schemaVersion: 1,
      serializedSchema: '{"agents":[]}',
    };
    expect(payload.schemaVersion).toBe(1);
    expect(payload.serializedSchema).toBe('{"agents":[]}');
  });

  it('PublishBotPayload допускает опциональную версию', () => {
    const withVersion: PublishBotPayload = {
      botId: createBotId(),
      version: 2,
    };
    const withoutVersion: PublishBotPayload = {
      botId: createBotId(),
    };
    expect(withVersion.version).toBe(2);
    expect(withoutVersion.version).toBeUndefined();
  });

  it('PauseBotPayload использует BotPauseReason', () => {
    const payload: PauseBotPayload = {
      botId: createBotId(),
      reason: 'manual' as BotPauseReason,
    };
    expect(payload.reason).toBe('manual');
  });

  it('Resume/Archive/Delete payload содержат только botId', () => {
    const resume: ResumeBotPayload = { botId: createBotId() };
    const archive: ArchiveBotPayload = { botId: createBotId() };
    const del: DeleteBotPayload = { botId: createBotId() };

    expect(resume.botId).toBeDefined();
    expect(archive.botId).toBeDefined();
    expect(del.botId).toBeDefined();
  });

  it('SimulateBotMessagePayload содержит botId, message и simulationId', () => {
    const payload: SimulateBotMessagePayload = {
      botId: createBotId(),
      message: 'Hello',
      simulationId: createSimulationId(),
    };
    expect(payload.message).toBe('Hello');
    expect(payload.simulationId).toBe(createSimulationId());
  });
});

describe('BotCommandMeta', () => {
  it('содержит operationId, createdAt и опциональный traceId', () => {
    const meta: BotCommandMeta = createMeta({ traceId: createTraceId() });
    expect(meta.operationId).toBe(createOperationId());
    expect(meta.createdAt).toBe(createISODateString());
    expect(meta.traceId).toBe(createTraceId());
  });

  it('позволяет опустить traceId', () => {
    const meta: BotCommandMeta = createMeta();
    expect(meta.traceId).toBeUndefined();
  });
});

describe('BotCommandPayloadMap & BotCommand', () => {
  it('BotCommandPayloadMap сопоставляет каждому типу свою payload-форму', () => {
    const payloadMap: BotCommandPayloadMap = {
      create_bot_from_template: {
        workspaceId: createWorkspaceId(),
        templateId: createTemplateId(),
        name: 'From template',
      },
      create_custom_bot: {
        workspaceId: createWorkspaceId(),
        name: 'Custom bot',
        instruction: 'Do something',
      },
      update_instruction: {
        botId: createBotId(),
        instruction: 'New instruction',
      },
      manage_multi_agent: {
        botId: createBotId(),
        schemaVersion: 1,
        serializedSchema: '{"agents":[]}',
      },
      publish_bot: {
        botId: createBotId(),
      },
      pause_bot: {
        botId: createBotId(),
        reason: 'manual',
      },
      resume_bot: {
        botId: createBotId(),
      },
      archive_bot: {
        botId: createBotId(),
      },
      delete_bot: {
        botId: createBotId(),
      },
      simulate_bot_message: {
        botId: createBotId(),
        message: 'Hello',
        simulationId: createSimulationId(),
      },
    };

    // runtime-проверка: все ключи соответствуют значениям BotCommandTypes
    Object.keys(payloadMap).forEach((key) => {
      expect(Object.values(BotCommandTypes)).toContain(key as BotCommandType);
    });
  });

  it('BotCommand формирует discriminated union по всем типам команд', () => {
    const meta = createMeta();

    const factories = {
      [BotCommandTypes.CREATE_BOT_FROM_TEMPLATE]: (): BotCommand => ({
        type: BotCommandTypes.CREATE_BOT_FROM_TEMPLATE,
        meta,
        payload: {
          workspaceId: createWorkspaceId(),
          templateId: createTemplateId(),
          name: 'From template',
        },
      }),
      [BotCommandTypes.CREATE_CUSTOM_BOT]: (): BotCommand => ({
        type: BotCommandTypes.CREATE_CUSTOM_BOT,
        meta,
        payload: {
          workspaceId: createWorkspaceId(),
          name: 'Custom bot',
          instruction: 'Do something',
        },
      }),
      [BotCommandTypes.UPDATE_INSTRUCTION]: (): BotCommand => ({
        type: BotCommandTypes.UPDATE_INSTRUCTION,
        meta,
        payload: {
          botId: createBotId(),
          instruction: 'New instruction',
        },
      }),
      [BotCommandTypes.MANAGE_MULTI_AGENT]: (): BotCommand => ({
        type: BotCommandTypes.MANAGE_MULTI_AGENT,
        meta,
        payload: {
          botId: createBotId(),
          schemaVersion: 1,
          serializedSchema: '{"agents":[]}',
        },
      }),
      [BotCommandTypes.PUBLISH_BOT]: (): BotCommand => ({
        type: BotCommandTypes.PUBLISH_BOT,
        meta,
        payload: {
          botId: createBotId(),
        },
      }),
      [BotCommandTypes.PAUSE_BOT]: (): BotCommand => ({
        type: BotCommandTypes.PAUSE_BOT,
        meta,
        payload: {
          botId: createBotId(),
          reason: 'manual',
        },
      }),
      [BotCommandTypes.RESUME_BOT]: (): BotCommand => ({
        type: BotCommandTypes.RESUME_BOT,
        meta,
        payload: {
          botId: createBotId(),
        },
      }),
      [BotCommandTypes.ARCHIVE_BOT]: (): BotCommand => ({
        type: BotCommandTypes.ARCHIVE_BOT,
        meta,
        payload: {
          botId: createBotId(),
        },
      }),
      [BotCommandTypes.DELETE_BOT]: (): BotCommand => ({
        type: BotCommandTypes.DELETE_BOT,
        meta,
        payload: {
          botId: createBotId(),
        },
      }),
      [BotCommandTypes.SIMULATE_BOT_MESSAGE]: (): BotCommand => ({
        type: BotCommandTypes.SIMULATE_BOT_MESSAGE,
        meta,
        payload: {
          botId: createBotId(),
          message: 'Hello',
          simulationId: createSimulationId(),
        },
      }),
    } as const satisfies Record<BotCommandType, () => BotCommand>;

    // eslint-disable-next-line security/detect-object-injection -- ключ берётся из AllBotCommandTypes (строгий union), safe lookup
    const commands: BotCommand[] = AllBotCommandTypes.map((type) => factories[type]());

    expect(commands).toHaveLength(AllBotCommandTypes.length);
    commands.forEach((command) => {
      expect(command.meta.operationId).toBe(createOperationId());
      expect(command.payload).toBeDefined();
    });
  });
});
