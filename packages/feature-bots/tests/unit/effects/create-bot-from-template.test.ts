/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mapCreateBotEffectInputToApiInput,
  mapCreateBotResponseToBotInfo,
} from '../../../src/effects/create/create-bot-api.mapper.js';
import { createBotFromTemplateEffect } from '../../../src/effects/create-bot-from-template.js';

/* eslint-disable @livai/rag/context-leakage -- unit-тесты используют только синтетические фикстуры и моки */
/* eslint-disable @livai/rag/source-citation -- source:'test' в фикстурах намеренно используется для unit-тестов */
/* eslint-disable @livai/multiagent/orchestration-safety -- wiring оркестрации проверяется локально на замоканных эффектах */
/* eslint-disable functional/no-conditional-statements -- условные ветки в тестах повышают читаемость сценариев */
/* eslint-disable ai-security/token-leakage -- ложные срабатывания на именах mapper-символов в тестовом коде */

const mocked = vi.hoisted(() => ({
  assertBotTemplateInvariant: vi.fn(),
  buildActorUserContext: vi.fn(({ userId, actorRole }: any) =>
    Object.freeze({
      userId: userId ?? null,
      ...(actorRole !== undefined ? { role: actorRole } : {}),
    })
  ),
  checkCreatePermissionsOrThrow: vi.fn(),
  checkCreatePolicyOrThrow: vi.fn(),
  buildDraftBotId: vi.fn(() => 'bot_draft_fixed'),
  buildCreateBotRequestBody: vi.fn((input: any) =>
    Object.freeze({
      name: input.name,
      instruction: input.instructionOverride ?? input.template.defaultInstruction,
      settings: input.template.defaultSettings,
      templateId: input.template.id,
    })
  ),
  mapCreateBotErrorToAuditEvent: vi.fn((_error: any, context: any) =>
    Object.freeze({
      type: 'failure',
      eventId: context.eventId,
      timestamp: context.timestamp,
      botId: context.botId,
      workspaceId: context.workspaceId,
      traceId: context.traceId,
      userId: context.userId,
    })
  ),
  mapCreateBotResultToAuditEvent: vi.fn((_result: any, context: any) =>
    Object.freeze({
      type: 'success',
      eventId: context.eventId,
      timestamp: context.timestamp,
      traceId: context.traceId,
      userId: context.userId,
    })
  ),
  updateCreateBotState: vi.fn(),
}));

vi.mock('../../../src/domain/BotTemplate.js', () => ({
  assertBotTemplateInvariant: mocked.assertBotTemplateInvariant,
}));

vi.mock('../../../src/effects/create/create-bot.helpers.js', () => ({
  buildActorUserContext: mocked.buildActorUserContext,
  buildCreateBotRequestBody: mocked.buildCreateBotRequestBody,
  buildDraftBotId: mocked.buildDraftBotId,
  checkCreatePermissionsOrThrow: mocked.checkCreatePermissionsOrThrow,
  checkCreatePolicyOrThrow: mocked.checkCreatePolicyOrThrow,
}));

vi.mock('../../../src/effects/create/create-bot-audit.mapper.js', () => ({
  mapCreateBotErrorToAuditEvent: mocked.mapCreateBotErrorToAuditEvent,
  mapCreateBotResultToAuditEvent: mocked.mapCreateBotResultToAuditEvent,
}));

vi.mock('../../../src/effects/create/create-bot-store-updater.js', () => ({
  updateCreateBotState: mocked.updateCreateBotState,
}));

type AnyFn = (...args: readonly any[]) => any;

function mkTemplate(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    id: 'tpl_alpha',
    name: 'Template Alpha',
    role: 'assistant',
    description: 'Template',
    defaultInstruction: 'help',
    defaultSettings: Object.freeze({
      temperature: 0.2,
      contextWindow: 4096,
      piiMasking: false,
      imageRecognition: false,
      unrecognizedMessage: Object.freeze({
        message: 'fallback',
        showSupportHint: true,
      }),
      interruptionRules: Object.freeze({
        allowUserInterruption: true,
        maxConcurrentSessions: 10,
      }),
    }),
    capabilities: Object.freeze(['multi_channel']),
    tags: Object.freeze(['base']),
    ...overrides,
  }) as any;
}

function mkRequest(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    workspaceId: 'ws_1',
    template: mkTemplate(),
    name: 'Bot Name',
    userId: 'u_1',
    actorRole: 'editor',
    ...overrides,
  }) as any;
}

function mkBotInfo(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    id: 'bot_1',
    name: 'Bot Name',
    status: Object.freeze({ type: 'draft' }),
    workspaceId: 'ws_1',
    currentVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as any;
}

function mkBotResponseDto(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    id: 'bot_1',
    name: 'Bot Name',
    workspace_id: 'ws_1',
    workspaceId: 'ws_1',
    current_version: 1,
    currentVersion: 1,
    status: 'draft',
    created_at: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as any;
}

describe('create-bot-from-template.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.assertBotTemplateInvariant.mockImplementation(() => undefined);
    mocked.checkCreatePermissionsOrThrow.mockImplementation(() => undefined);
    mocked.checkCreatePolicyOrThrow.mockImplementation(() => undefined);
    mocked.updateCreateBotState.mockImplementation(() => undefined);
  });

  it('pre-flight success: корректный userId и actorRole проходят policy/permissions', async () => {
    const response = mkBotResponseDto();
    const apiCreateBot = vi.fn(() => (async () => response) as any);
    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: apiCreateBot } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    const result = await effectFactory(mkRequest())();
    expect(result).toMatchObject({ id: 'bot_1', workspaceId: 'ws_1' });
    expect(mocked.checkCreatePermissionsOrThrow).toHaveBeenCalledTimes(1);
    expect(mocked.checkCreatePolicyOrThrow).toHaveBeenCalledTimes(1);
  });

  it('pre-flight fail-closed: при undefined userId/actorRole кидает BOT_PERMISSION_DENIED', async () => {
    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    await expect(effectFactory(mkRequest({ userId: undefined, actorRole: undefined }))()).rejects
      .toMatchObject({
        code: 'BOT_PERMISSION_DENIED',
      });
  });

  it('permission denied: пробрасывает соответствующую ошибку', async () => {
    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    const denied = Object.freeze({
      code: 'BOT_PERMISSION_DENIED',
      category: 'permission',
      severity: 'high',
      retryable: false,
    });
    mocked.checkCreatePermissionsOrThrow.mockImplementationOnce(() => {
      throw denied;
    });

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    await expect(effectFactory(mkRequest())()).rejects.toEqual(denied);
  });

  it('policy denied: пробрасывает соответствующую ошибку', async () => {
    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    const denied = Object.freeze({
      code: 'BOT_POLICY_ARCHIVED',
      category: 'policy',
      severity: 'high',
      retryable: false,
    });
    mocked.checkCreatePolicyOrThrow.mockImplementationOnce(() => {
      throw denied;
    });

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    await expect(effectFactory(mkRequest())()).rejects.toEqual(denied);
  });

  it('domain invariant: assertBotTemplateInvariant выбрасывает на невалидном шаблоне', async () => {
    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    mocked.assertBotTemplateInvariant.mockImplementationOnce(() => {
      throw new Error('invalid template');
    });

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    await expect(effectFactory(mkRequest({ template: mkTemplate({ name: ' ' }) }))()).rejects
      .toThrow(
        'invalid template',
      );
  });

  it('api/transport: mapCreateBotEffectInputToApiInput и mapCreateBotResponseToBotInfo работают корректно', () => {
    const apiInput = mapCreateBotEffectInputToApiInput({
      workspaceId: 'ws_1' as any,
      operationId: 'op_123' as any,
      request: {
        name: 'Mapped Bot',
        instruction: 'be helpful',
        settings: {
          temperature: 0.1,
          contextWindow: 2048,
          piiMasking: true,
          imageRecognition: false,
          unrecognizedMessage: {
            message: 'fallback',
            showSupportHint: false,
          },
          interruptionRules: {
            allowUserInterruption: true,
            maxConcurrentSessions: 5,
          },
        } as any,
        templateId: 'tpl_alpha',
      } as any,
    });

    expect(apiInput).toEqual({
      workspaceId: 'ws_1',
      operationId: 'op_123',
      body: {
        name: 'Mapped Bot',
        instruction: 'be helpful',
        settings: {
          temperature: 0.1,
          contextWindow: 2048,
          piiMasking: true,
          imageRecognition: false,
          unrecognizedMessage: {
            message: 'fallback',
            showSupportHint: false,
          },
          interruptionRules: {
            allowUserInterruption: true,
            maxConcurrentSessions: 5,
          },
        },
        templateId: 'tpl_alpha',
      },
    });

    const botInfo = mapCreateBotResponseToBotInfo(mkBotResponseDto());
    expect(botInfo).toMatchObject({
      id: 'bot_1',
      workspaceId: 'ws_1',
      name: 'Bot Name',
    });
  });

  it('AbortSignal передаётся в apiClient.createBot и может быть прерван', async () => {
    const seenSignals: AbortSignal[] = [];
    const apiCreateBot = vi.fn((_input: any) =>
      (async (signal?: AbortSignal) => {
        if (signal !== undefined) seenSignals.push(signal);
        if (signal?.aborted === true) {
          throw Object.freeze({
            code: 'BOT_REQUEST_ABORTED',
            category: 'channel',
            severity: 'low',
            retryable: true,
          });
        }
        return mkBotResponseDto();
      }) as any
    );

    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: apiCreateBot } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    const ac = new AbortController();
    ac.abort();
    await expect(effectFactory(mkRequest())(ac.signal)).rejects.toMatchObject({
      code: 'BOT_REQUEST_ABORTED',
    });
    expect(seenSignals[0]).toBe(ac.signal);
  });

  it('lifecycle success/failure + idempotency: updateCreateBotState и mapFailureAuditEvent вызываются корректно', async () => {
    const calls = new Map<string, unknown>();
    const apiCreateBot = vi.fn((_input: any) => (async () => mkBotResponseDto()) as any);
    const runOperation = vi.fn((params: any) => {
      const key = String(params.idempotencyKey);
      return (async (signal?: AbortSignal) => {
        if (calls.has(key)) return calls.get(key);
        try {
          const value = await params.run(signal);
          params.setSuccessState?.({} as any, value);
          params.onSuccess?.(value);
          params.mapSuccessAuditEvent?.(value);
          calls.set(key, value);
          return value;
        } catch (error) {
          params.onFailure?.(error);
          params.mapFailureAuditEvent?.(error);
          throw error;
        }
      }) as any;
    });

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 5000 },
        eventIdGenerator: { generate: () => 'evt-5000' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: apiCreateBot } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    const first = await effectFactory(mkRequest({ operationId: 'op_same' }))();
    const second = await effectFactory(mkRequest({ operationId: 'op_same' }))();
    expect(first).toEqual(second);
    expect(apiCreateBot).toHaveBeenCalledTimes(1);
    expect(mocked.updateCreateBotState).toHaveBeenCalledTimes(1);

    const failingRunOperation = vi.fn((params: any) =>
      (async () => {
        const err = Object.freeze({
          code: 'BOT_PARSING_JSON_INVALID',
          category: 'parsing',
          severity: 'medium',
          retryable: false,
        });
        params.onFailure?.(err);
        params.mapFailureAuditEvent?.(err);
        throw err;
      }) as any
    );

    const failingEffectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 6000 },
        eventIdGenerator: { generate: () => 'evt-6000' },
      },
      {
        lifecycleHelper: { runOperation: failingRunOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    await expect(failingEffectFactory(mkRequest())()).rejects.toMatchObject({
      code: 'BOT_PARSING_JSON_INVALID',
    });
    expect(mocked.mapCreateBotErrorToAuditEvent).toHaveBeenCalled();
  });

  it('audit success/failure: eventId/timestamp/optional traceId/userId и fallback botId детерминированы', () => {
    const captured: any[] = [];
    const runOperation = vi.fn((params: any) => {
      captured.push(params);
      return (async () => mkBotInfo()) as any;
    });

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 7000 },
        eventIdGenerator: { generate: () => 'evt-fixed' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() as AnyFn } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    effectFactory(
      mkRequest({
        traceId: 'trace-1',
        userId: 'u_7',
        operationId: 'op_7',
      }),
    );
    const params = captured[0];
    const successEvent = params.mapSuccessAuditEvent(mkBotInfo());
    expect(successEvent).toMatchObject({
      type: 'success',
      eventId: 'evt-fixed',
      timestamp: 7000,
      traceId: 'trace-1',
      userId: 'u_7',
    });

    const failureOne = params.mapFailureAuditEvent({
      code: 'BOT_PERMISSION_DENIED',
      category: 'permission',
      severity: 'high',
      retryable: false,
      context: {},
    });
    const failureTwo = params.mapFailureAuditEvent({
      code: 'BOT_PERMISSION_DENIED',
      category: 'permission',
      severity: 'high',
      retryable: false,
      context: {},
    });
    const failureWithBotId = params.mapFailureAuditEvent({
      code: 'BOT_PERMISSION_DENIED',
      category: 'permission',
      severity: 'high',
      retryable: false,
      context: { botId: 'bot_from_error' },
    });
    expect(failureOne.botId).toBe(failureTwo.botId);
    expect(failureWithBotId.botId).toBe('bot_from_error');
    expect(failureOne).toMatchObject({
      type: 'failure',
      eventId: 'evt-fixed',
      timestamp: 7000,
      traceId: 'trace-1',
      userId: 'u_7',
      workspaceId: 'ws_1',
    });
  });

  it('hooks: onSuccess и onError best-effort (ошибки внутри hook не ломают flow)', async () => {
    const onSuccess = vi.fn(() => {
      throw new Error('hook success failed');
    });
    const onError = vi.fn(() => {
      throw new Error('hook error failed');
    });

    const runOperation = vi.fn((params: any) =>
      (async () => {
        const result = mkBotInfo();
        params.setSuccessState?.({} as any, result);
        params.onSuccess?.(result);
        params.onFailure?.({
          code: 'BOT_POLICY_ARCHIVED',
          category: 'policy',
          severity: 'high',
          retryable: false,
        });
        return result;
      }) as any
    );

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 8000 },
        eventIdGenerator: { generate: () => 'evt-8000' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    await expect(
      effectFactory(
        mkRequest({
          hooks: Object.freeze({ onSuccess, onError }),
        }),
      )(),
    ).resolves.toMatchObject({ id: 'bot_1' });

    expect(mocked.updateCreateBotState).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('edge-cases: instructionOverride влияет на operationId, minimal input детерминирован при фиксированных time/eventId', () => {
    const captured: any[] = [];
    const runOperation = vi.fn((params: any) => {
      captured.push(params);
      return (async () => mkBotInfo()) as any;
    });

    const effectFactory = createBotFromTemplateEffect(
      {
        clock: { now: () => 9000 },
        eventIdGenerator: { generate: () => 'evt-9000' },
      },
      {
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: vi.fn() } as any,
        botPolicy: {} as any,
        botPermissions: {} as any,
        auditPort: {} as any,
        storePort: {} as any,
        mapErrorConfig: { source: 'test' } as any,
      },
    );

    effectFactory(mkRequest({ operationId: undefined, instructionOverride: undefined }));
    effectFactory(mkRequest({ operationId: undefined, instructionOverride: 'OVERRIDE-1' }));
    effectFactory(
      mkRequest({
        operationId: undefined,
        instructionOverride: undefined,
        traceId: undefined,
        userId: undefined,
      }),
    );

    const firstKey = captured[0].idempotencyKey;
    const secondKey = captured[1].idempotencyKey;
    expect(firstKey).toMatch(/^op_[0-9a-f]+$/);
    expect(secondKey).toMatch(/^op_[0-9a-f]+$/);
    expect(firstKey).not.toBe(secondKey);

    const successEvent = captured[0].mapSuccessAuditEvent(mkBotInfo());
    expect(successEvent).toMatchObject({
      eventId: 'evt-9000',
      timestamp: 9000,
    });
    const successEventNoOptional = captured[2].mapSuccessAuditEvent(mkBotInfo());
    expect(successEventNoOptional.traceId).toBeUndefined();
    expect(successEventNoOptional.userId).toBeUndefined();
    const failureEventNoOptional = captured[2].mapFailureAuditEvent({
      code: 'BOT_POLICY_ACTION_DENIED',
      category: 'policy',
      severity: 'high',
      retryable: false,
      context: {},
    });
    expect(failureEventNoOptional.traceId).toBeUndefined();
    expect(failureEventNoOptional.userId).toBeUndefined();
  });
});

/* eslint-enable ai-security/token-leakage */
/* eslint-enable functional/no-conditional-statements */
/* eslint-enable @livai/multiagent/orchestration-safety */
/* eslint-enable @livai/rag/source-citation */
/* eslint-enable @livai/rag/context-leakage */
