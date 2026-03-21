/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mapCreateBotEffectInputToApiInput,
  mapCreateBotResponseToBotInfo,
} from '../../../src/effects/create/create-bot-api.mapper.js';
import { createCustomBotEffect } from '../../../src/effects/create-custom-bot.js';

/* eslint-disable @livai/rag/context-leakage -- unit-тесты используют только синтетические фикстуры и моки */
/* eslint-disable @livai/rag/source-citation -- source:'test' в фикстурах намеренно используется для unit-тестов */
/* eslint-disable @livai/multiagent/orchestration-safety -- wiring оркестрации проверяется локально на замоканных эффектах */
/* eslint-disable functional/no-conditional-statements -- условные ветки в тестах повышают читаемость сценариев */
/* eslint-disable ai-security/token-leakage -- ложные срабатывания на именах mapper-символов в тестовом коде */

const mocked = vi.hoisted(() => ({
  buildActorUserContext: vi.fn(({ userId, actorRole }: any) =>
    Object.freeze({
      userId: userId ?? null,
      ...(actorRole !== undefined ? { role: actorRole } : {}),
    })
  ),
  checkCreatePermissionsOrThrow: vi.fn(),
  checkCreatePolicyOrThrow: vi.fn(),
  buildDraftBotId: vi.fn(() => 'bot_draft_custom_fixed'),
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

function mkCreateBotLikeHelpers() {
  return Object.freeze({
    checkCreatePermissionsOrThrow: mocked.checkCreatePermissionsOrThrow,
    checkCreatePolicyOrThrow: mocked.checkCreatePolicyOrThrow,
  });
}

vi.mock('../../../src/effects/shared/pure-guards.js', () => ({
  buildActorUserContext: mocked.buildActorUserContext,
}));

vi.mock('../../../src/effects/create/create-bot.helpers.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../src/effects/create/create-bot.helpers.js')
  >();
  return {
    ...actual,
    buildDraftBotId: mocked.buildDraftBotId,
  };
});

vi.mock('../../../src/effects/create/create-bot-audit.mapper.js', () => ({
  mapCreateBotErrorToAuditEvent: mocked.mapCreateBotErrorToAuditEvent,
  mapCreateBotResultToAuditEvent: mocked.mapCreateBotResultToAuditEvent,
}));

vi.mock('../../../src/effects/create/create-bot-store-updater.js', () => ({
  updateCreateBotState: mocked.updateCreateBotState,
}));

function mkValidSettings() {
  return Object.freeze({
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
  });
}

function mkCustomRequest(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    workspaceId: 'ws_1',
    name: 'Custom Bot',
    instruction: 'be helpful',
    settings: mkValidSettings(),
    userId: 'u_1',
    actorRole: 'editor',
    ...overrides,
  }) as any;
}

function mkBotInfo(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    id: 'bot_1',
    name: 'Custom Bot',
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
    name: 'Custom Bot',
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

function mkEffectConfig(overrides: Partial<Parameters<typeof createCustomBotEffect>[1]> = {}) {
  return {
    lifecycleHelper: { runOperation: vi.fn() } as any,
    apiClient: { createBot: vi.fn() } as any,
    botPolicy: {} as any,
    botPermissions: {} as any,
    auditPort: {} as any,
    storePort: {} as any,
    mapErrorConfig: { source: 'test' } as any,
    createBotLikeHelpers: mkCreateBotLikeHelpers(),
    ...overrides,
  } as Parameters<typeof createCustomBotEffect>[1];
}

describe('create-custom-bot.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.checkCreatePermissionsOrThrow.mockImplementation(() => undefined);
    mocked.checkCreatePolicyOrThrow.mockImplementation(() => undefined);
    mocked.updateCreateBotState.mockImplementation(() => undefined);
  });

  it('pre-flight success: permission create и policy create_custom', async () => {
    const response = mkBotResponseDto();
    const apiCreateBot = vi.fn(() => (async () => response) as any);
    const runOperation = vi.fn((params: any) =>
      (async (signal?: AbortSignal) => params.run(signal)) as any
    );
    const effectFactory = createCustomBotEffect(
      {
        clock: { now: () => 1000 },
        eventIdGenerator: { generate: () => 'evt-1' },
      },
      mkEffectConfig({
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: apiCreateBot } as any,
      }),
    );

    const result = await effectFactory(mkCustomRequest())();
    expect(result).toMatchObject({ id: 'bot_1', workspaceId: 'ws_1' });
    expect(mocked.checkCreatePermissionsOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
      }),
    );
    expect(mocked.checkCreatePolicyOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_custom',
      }),
    );
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

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 1000 }, eventIdGenerator: { generate: () => 'evt-1' } },
      mkEffectConfig({ lifecycleHelper: { runOperation } as any }),
    );

    await expect(effectFactory(mkCustomRequest())()).rejects.toEqual(denied);
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

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 1000 }, eventIdGenerator: { generate: () => 'evt-1' } },
      mkEffectConfig({ lifecycleHelper: { runOperation } as any }),
    );

    await expect(effectFactory(mkCustomRequest())()).rejects.toEqual(denied);
  });

  it('api/transport: mapCreateBotEffectInputToApiInput и mapCreateBotResponseToBotInfo', () => {
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
      name: 'Custom Bot',
    });
  });

  it('AbortSignal передаётся в apiClient.createBot', async () => {
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
    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 1000 }, eventIdGenerator: { generate: () => 'evt-1' } },
      mkEffectConfig({
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: apiCreateBot } as any,
      }),
    );

    const ac = new AbortController();
    ac.abort();
    await expect(effectFactory(mkCustomRequest())(ac.signal)).rejects.toMatchObject({
      code: 'BOT_REQUEST_ABORTED',
    });
    expect(seenSignals[0]).toBe(ac.signal);
  });

  it('lifecycle + idempotency: updateCreateBotState и mapFailureAuditEvent', async () => {
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

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 5000 }, eventIdGenerator: { generate: () => 'evt-5000' } },
      mkEffectConfig({
        lifecycleHelper: { runOperation } as any,
        apiClient: { createBot: apiCreateBot } as any,
      }),
    );

    const first = await effectFactory(mkCustomRequest({ operationId: 'op_same' }))();
    const second = await effectFactory(mkCustomRequest({ operationId: 'op_same' }))();
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

    const failingEffectFactory = createCustomBotEffect(
      { clock: { now: () => 6000 }, eventIdGenerator: { generate: () => 'evt-6000' } },
      mkEffectConfig({ lifecycleHelper: { runOperation: failingRunOperation } as any }),
    );

    await expect(failingEffectFactory(mkCustomRequest())()).rejects.toMatchObject({
      code: 'BOT_PARSING_JSON_INVALID',
    });
    expect(mocked.mapCreateBotErrorToAuditEvent).toHaveBeenCalled();
  });

  it('audit: success/failure, traceId, userId, fallback botId и botId из error.context', () => {
    const captured: any[] = [];
    const runOperation = vi.fn((params: any) => {
      captured.push(params);
      return (async () => mkBotInfo()) as any;
    });

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 7000 }, eventIdGenerator: { generate: () => 'evt-fixed' } },
      mkEffectConfig({ lifecycleHelper: { runOperation } as any }),
    );

    effectFactory(
      mkCustomRequest({
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

  it('audit: без traceId в success/failure', () => {
    const captured: any[] = [];
    const runOperation = vi.fn((params: any) => {
      captured.push(params);
      return (async () => mkBotInfo()) as any;
    });

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 7100 }, eventIdGenerator: { generate: () => 'evt-nb' } },
      mkEffectConfig({ lifecycleHelper: { runOperation } as any }),
    );

    effectFactory(mkCustomRequest({ traceId: undefined }));
    const params = captured[0];
    const successEvent = params.mapSuccessAuditEvent(mkBotInfo());
    expect(successEvent.traceId).toBeUndefined();
    const failureEvent = params.mapFailureAuditEvent({
      code: 'BOT_POLICY_ACTION_DENIED',
      category: 'policy',
      severity: 'high',
      retryable: false,
      context: {},
    });
    expect(failureEvent.traceId).toBeUndefined();
  });

  it('hooks: onSuccess и onError best-effort', async () => {
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

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 8000 }, eventIdGenerator: { generate: () => 'evt-8000' } },
      mkEffectConfig({ lifecycleHelper: { runOperation } as any }),
    );

    await expect(
      effectFactory(
        mkCustomRequest({
          hooks: Object.freeze({ onSuccess, onError }),
        }),
      )(),
    ).resolves.toMatchObject({ id: 'bot_1' });

    expect(mocked.updateCreateBotState).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('edge: templateId и settings влияют на operationId; детерминированность при фиксированных clock/eventId', () => {
    const captured: any[] = [];
    const runOperation = vi.fn((params: any) => {
      captured.push(params);
      return (async () => mkBotInfo()) as any;
    });

    const effectFactory = createCustomBotEffect(
      { clock: { now: () => 9000 }, eventIdGenerator: { generate: () => 'evt-9000' } },
      mkEffectConfig({ lifecycleHelper: { runOperation } as any }),
    );

    const base = {
      operationId: undefined,
      settings: mkValidSettings(),
    };
    effectFactory(mkCustomRequest(base));
    effectFactory(
      mkCustomRequest({
        ...base,
        templateId: 'catalog_tpl_1',
      }),
    );
    effectFactory(
      mkCustomRequest({
        ...base,
        settings: Object.freeze({
          ...mkValidSettings(),
          temperature: 0.99,
        }),
      }),
    );

    const k0 = captured[0].idempotencyKey;
    const k1 = captured[1].idempotencyKey;
    const k2 = captured[2].idempotencyKey;
    expect(k0).toMatch(/^op_[0-9a-f]+$/);
    expect(k1).toMatch(/^op_[0-9a-f]+$/);
    expect(k2).toMatch(/^op_[0-9a-f]+$/);
    expect(new Set([k0, k1, k2]).size).toBe(3);

    const successEvent = captured[0].mapSuccessAuditEvent(mkBotInfo());
    expect(successEvent).toMatchObject({
      eventId: 'evt-9000',
      timestamp: 9000,
      userId: 'u_1',
    });
  });
});

/* eslint-enable ai-security/token-leakage */
/* eslint-enable functional/no-conditional-statements */
/* eslint-enable @livai/multiagent/orchestration-safety */
/* eslint-enable @livai/rag/source-citation */
/* eslint-enable @livai/rag/context-leakage */
