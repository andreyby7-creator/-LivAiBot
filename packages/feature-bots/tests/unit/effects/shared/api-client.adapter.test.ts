/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

/* eslint-disable @livai/multiagent/orchestration-safety -- В unit-тестах ниже мы исполняем локальные эффекты,
 * оркестрация (agent) не запускается, поэтому правило "timeout for agent operation" здесь не несёт смысла. */

const mocks = vi.hoisted(() => {
  const HEADERS = {
    WORKSPACE_ID: 'X-Workspace-Id',
    OPERATION_ID: 'X-Operation-Id',
  } as const;

  const botErrorMetaByCode = {
    BOT_PARSING_JSON_INVALID: {
      error: 'BotParsingError',
      category: 'parsing',
      severity: 'error',
    },
    BOT_REQUEST_ABORTED: {
      error: 'BotAbortError',
      category: 'transport',
      severity: 'warning',
    },
    BOT_CHANNEL_CONNECTION_FAILED: {
      error: 'BotConnectionError',
      category: 'transport',
      severity: 'error',
    },
    BOT_CUSTOM: {
      error: 'BotCustomError',
      category: 'custom',
      severity: 'error',
    },
  } as const;

  const createBotErrorResponse = vi.fn(
    (input: { code: keyof typeof botErrorMetaByCode; message?: string; context?: unknown; }) => {
      const meta = botErrorMetaByCode[input.code];
      /* eslint-disable @livai/rag/context-leakage -- В тестах мы подсовываем произвольный context payload через контракт. */
      return Object.freeze({
        error: meta.error,
        code: input.code,
        category: meta.category,
        severity: meta.severity,
        retryable: input.code === 'BOT_CUSTOM',
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(input.context !== undefined ? { context: input.context } : {}),
      });
      /* eslint-enable @livai/rag/context-leakage */
    },
  );

  const getBotRetryable = vi.fn((code: keyof typeof botErrorMetaByCode) => code === 'BOT_CUSTOM');

  const makeSchema = <T>(
    impl: (v: unknown) => { success: true; data: T; } | { success: false; error: any; },
  ) => ({
    safeParse: vi.fn(impl),
  });

  const botCreateRequestSchema = makeSchema<{ valid: true; }>((v) => {
    const ok = typeof v === 'object' && v !== null && (v as any).valid === true;
    return ok
      ? { success: true, data: v as { valid: true; } }
      : {
        success: false,
        error: {
          issues: [
            {
              path: [Symbol('x'), 0, 'a'],
              message: 'token=123', // будет санитайзиться в undefined
            },
          ],
        },
      };
  });

  const updateInstructionRequestSchema = makeSchema<{ instruction: string; }>((v) => {
    const ok = typeof v === 'object' && v !== null && typeof (v as any).instruction === 'string';
    return ok
      ? { success: true, data: v as { instruction: string; } }
      : {
        success: false,
        error: { issues: [{ path: ['instruction'], message: ' invalid ' }] },
      };
  });

  const botResponseSchema = makeSchema<{ ok: true; }>((v) => {
    const ok = typeof v === 'object' && v !== null && (v as any).ok === true;
    return ok
      ? { success: true, data: v as { ok: true; } }
      : { success: false, error: { issues: [{ path: ['ok'], message: ' ok ' }] } };
  });

  const botsListResponseSchema = makeSchema<{ bots: readonly unknown[]; }>((v) => {
    const ok = typeof v === 'object' && v !== null && Array.isArray((v as any).bots);
    return ok
      ? { success: true, data: v as { bots: readonly unknown[]; } }
      : { success: false, error: { issues: [{ path: ['bots'], message: 'bots' }] } };
  });

  return {
    HEADERS,
    botErrorMetaByCode,
    createBotErrorResponse,
    getBotRetryable,
    schemas: {
      BotCreateRequestSchema: botCreateRequestSchema,
      UpdateInstructionRequestSchema: updateInstructionRequestSchema,
      BotResponseSchema: botResponseSchema,
      BotsListResponseSchema: botsListResponseSchema,
    },
  };
});

vi.mock('@livai/core-contracts', () => ({ HEADERS: mocks.HEADERS }));
vi.mock('@livai/core-contracts/validation/zod', () => ({ generatedBots: mocks.schemas }));
vi.mock('../../../../src/domain/BotRetry.js', () => ({ getBotRetryable: mocks.getBotRetryable }));
vi.mock('../../../../src/lib/bot-errors.js', () => ({
  botErrorMetaByCode: mocks.botErrorMetaByCode,
  createBotErrorResponse: mocks.createBotErrorResponse,
}));

import { createBotApiClientPortAdapter } from '../../../../src/effects/shared/api-client.adapter.js';

type LegacyApiClient = Parameters<typeof createBotApiClientPortAdapter>[0];

const createLegacyClient = (): {
  readonly client: LegacyApiClient;
  readonly get: any;
  readonly post: any;
  readonly put: any;
} => {
  // `vi.fn<...>` не всегда корректно сохраняет дженерик возврата `Promise<T>`,
  // поэтому приводим через `as any`, чтобы совпали сигнатуры LegacyApiClient.
  const get = vi.fn() as any as LegacyApiClient['get'];
  const post = vi.fn() as any as LegacyApiClient['post'];
  const put = vi.fn() as any as LegacyApiClient['put'];
  return {
    client: { get, post, put },
    get,
    post,
    put,
  };
};

describe('createBotApiClientPortAdapter', () => {
  it('listBots: делает GET, добавляет X-Workspace-Id и пропускает из options только X-Operation-Id', async () => {
    const { client, get } = createLegacyClient();
    get.mockResolvedValue({ bots: [] });

    const api = createBotApiClientPortAdapter(client);
    const res = await api.listBots({ workspaceId: 'ws1' as any }, { operationId: 'op1' as any })(
      undefined,
    );

    expect(res).toEqual({ bots: [] });
    expect(get).toHaveBeenCalledWith('/v1/bots', {
      headers: {
        [mocks.HEADERS.OPERATION_ID]: 'op1',
        [mocks.HEADERS.WORKSPACE_ID]: 'ws1',
      },
    });
  });

  it('createBot: input.operationId имеет приоритет над context.operationId', async () => {
    const { client, post } = createLegacyClient();
    post.mockResolvedValue({ ok: true });

    const api = createBotApiClientPortAdapter(client);
    const res = await api.createBot(
      {
        workspaceId: 'ws1' as any,
        operationId: 'op-input' as any,
        body: { valid: true } as any,
      },
      {
        operationId: 'op-options' as any,
      },
    )(undefined);

    expect(res).toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith(
      '/v1/bots',
      { valid: true },
      {
        headers: {
          [mocks.HEADERS.OPERATION_ID]: 'op-input',
          [mocks.HEADERS.WORKSPACE_ID]: 'ws1',
        },
      },
    );
  });

  it('getBot: если botId пустой, падает с BOT_PARSING_JSON_INVALID (pathTemplate требует bot_id)', async () => {
    const { client } = createLegacyClient();
    const api = createBotApiClientPortAdapter(client);

    await expect(
      api.getBot({ workspaceId: 'ws1' as any, botId: '' as any })(undefined),
    ).rejects.toEqual(expect.objectContaining({ code: 'BOT_PARSING_JSON_INVALID' }));
  });

  it('request validation: createBot body невалиден → BOT_PARSING_JSON_INVALID с parseIssues (message санитайзится)', async () => {
    const { client } = createLegacyClient();
    const api = createBotApiClientPortAdapter(client);

    await expect(
      api.createBot({ workspaceId: 'ws1' as any, body: { nope: true } as any })(undefined),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            operation: 'createBot',
            parseIssues: [
              expect.objectContaining({
                path: expect.stringContaining('Symbol('),
              }),
            ],
          }),
        }),
      }),
    );
  });

  it('response validation: transport вернул невалидный ответ → BOT_PARSING_JSON_INVALID, message триммится', async () => {
    const { client, post } = createLegacyClient();
    post.mockResolvedValue({ ok: false });

    const api = createBotApiClientPortAdapter(client);

    await expect(
      api.createBot({ workspaceId: 'ws1' as any, body: { valid: true } as any })(undefined),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            operation: 'createBot',
            parseIssues: [expect.objectContaining({ message: 'ok' })],
          }),
        }),
      }),
    );
  });

  it('transport error: AbortError → BOT_REQUEST_ABORTED', async () => {
    const { client, get } = createLegacyClient();
    const err = Object.assign(new Error('aborted'), { name: 'AbortError' });
    get.mockRejectedValue(err);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_REQUEST_ABORTED' }),
    );
  });

  it('transport error: TimeoutError → BOT_CHANNEL_CONNECTION_FAILED', async () => {
    const { client, get } = createLegacyClient();
    const err = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    get.mockRejectedValue(err);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_CHANNEL_CONNECTION_FAILED' }),
    );
  });

  it('transport error: DOMException AbortError тоже маппится в BOT_REQUEST_ABORTED', async () => {
    const { client, get } = createLegacyClient();
    const err = new DOMException('aborted', 'AbortError');
    get.mockRejectedValue(err);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_REQUEST_ABORTED' }),
    );
  });

  it('transport error: DOMException TimeoutError тоже маппится в BOT_CHANNEL_CONNECTION_FAILED', async () => {
    const { client, get } = createLegacyClient();
    const err = new DOMException('timeout', 'TimeoutError');
    get.mockRejectedValue(err);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_CHANNEL_CONNECTION_FAILED' }),
    );
  });

  it('transport error: обычный Error (не AbortError) → BOT_CHANNEL_CONNECTION_FAILED', async () => {
    const { client, get } = createLegacyClient();
    const err = Object.assign(new Error('boom'), { name: 'TypeError' });
    get.mockRejectedValue(err);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_CHANNEL_CONNECTION_FAILED' }),
    );
  });

  it('transport error: BotErrorResponse contract shape проходит как есть', async () => {
    const { client, get } = createLegacyClient();
    const contractErr = Object.freeze({
      error: 'BotCustomError',
      code: 'BOT_CUSTOM',
      category: 'custom',
      severity: 'error',
      retryable: true,
    });
    get.mockRejectedValue(contractErr);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toBe(contractErr);
  });

  it('transport error: payload.code + payload.message → маппится в BOT_CUSTOM и message санитайзится', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue({ payload: { code: 'BOT_CUSTOM', message: 'hello' } });

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_CUSTOM', message: 'hello' }),
    );
  });

  it('transport error: code/message на верхнем уровне тоже маппится (без payload)', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue({ code: 'BOT_CUSTOM', message: 'hello2' });

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_CUSTOM', message: 'hello2' }),
    );
  });

  it('transport error: невалидный code → fallback parsing error', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue({ code: 'NOT_A_BOT_CODE', message: 'hi' });

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_PARSING_JSON_INVALID' }),
    );
  });

  it('transport error: long/sensitive message не попадает в safeMessage', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue({
      payload: {
        code: 'NOT_A_BOT_CODE',
        message: `bearer ${'x'.repeat(500)}`,
      },
    });

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            cause: expect.not.objectContaining({ safeMessage: expect.anything() }),
          }),
        }),
      }),
    );
  });

  it('transport error: примитив без shape → fallback parsing error', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue(1);

    const api = createBotApiClientPortAdapter(client);
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_PARSING_JSON_INVALID' }),
    );
  });

  it('transport error: object без code/message → rawCode/rawMessage остаются unknown (покрытие undefined веток)', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue({ foo: 1 });

    const api = createBotApiClientPortAdapter(client, { errorRules: [] });
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            cause: expect.objectContaining({ rawCode: 'unknown' }),
          }),
        }),
      }),
    );
  });

  it('getBot: interpolates bot_id и кодирует значение', async () => {
    const { client, get } = createLegacyClient();
    get.mockResolvedValue({ ok: true });

    const api = createBotApiClientPortAdapter(client);
    const res = await api.getBot({ workspaceId: 'ws1' as any, botId: 'a b' as any })(
      undefined,
    );

    expect(res).toEqual({ ok: true });
    expect(get).toHaveBeenCalledWith('/v1/bots/a%20b', {
      headers: { [mocks.HEADERS.WORKSPACE_ID]: 'ws1' },
    });
  });

  it('updateInstruction: делает PUT и добавляет signal в requestOptions', async () => {
    const { client, put } = createLegacyClient();
    put.mockResolvedValue({ ok: true });

    const api = createBotApiClientPortAdapter(client);
    const controller = new AbortController();
    const res = await api.updateInstruction({
      workspaceId: 'ws1' as any,
      operationId: 'op1' as any,
      botId: 'bot-1' as any,
      body: { instruction: 'hi' } as any,
    })(controller.signal);

    expect(res).toEqual({ ok: true });
    expect(put).toHaveBeenCalledWith(
      '/v1/bots/bot-1/instruction',
      { instruction: 'hi' },
      {
        headers: {
          [mocks.HEADERS.OPERATION_ID]: 'op1',
          [mocks.HEADERS.WORKSPACE_ID]: 'ws1',
        },
        signal: controller.signal,
      },
    );
  });

  it('пробрасывает AbortSignal из effect-вызова в legacyClient через requestOptions.signal', async () => {
    const { client, get } = createLegacyClient();
    get.mockResolvedValue({ bots: [] });

    const api = createBotApiClientPortAdapter(client);
    const controller = new AbortController();

    await api.listBots({ workspaceId: 'ws1' as any })(controller.signal);

    expect(get).toHaveBeenCalledWith('/v1/bots', {
      headers: { [mocks.HEADERS.WORKSPACE_ID]: 'ws1' },
      signal: controller.signal,
    });
  });

  it('config.errorRules: сортировка по priority определяет выбранное правило', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue(new Error('x'));

    const low = Object.freeze({
      priority: 20,
      match: () => true,
      map: () =>
        mocks.createBotErrorResponse({
          code: 'BOT_CUSTOM',
          message: 'low',
          context: Object.freeze({ details: Object.freeze({ rule: 'low' }) }),
        } as any),
    });

    const high = Object.freeze({
      priority: 5,
      match: () => true,
      map: () =>
        mocks.createBotErrorResponse({
          code: 'BOT_CUSTOM',
          message: 'high',
          context: Object.freeze({ details: Object.freeze({ rule: 'high' }) }),
        } as any),
    });

    const api = createBotApiClientPortAdapter(client, { errorRules: [low as any, high as any] });
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({ code: 'BOT_CUSTOM', message: 'high' }),
    );
  });

  it('config.errorRules: пустой список → fallback createUnknownBotErrorResponse (exhaustiveness ветка)', async () => {
    const { client, get } = createLegacyClient();
    get.mockRejectedValue({ code: 'BOT_CUSTOM', message: 'hello' });

    const api = createBotApiClientPortAdapter(client, { errorRules: [] });
    await expect(api.listBots({ workspaceId: 'ws1' as any })(undefined)).rejects.toEqual(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            cause: expect.objectContaining({ rawCode: 'BOT_CUSTOM' }),
          }),
        }),
      }),
    );
  });
});

/* eslint-enable @livai/multiagent/orchestration-safety */
