/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  safeParse: vi.fn(),
  mapBotResponseToBotInfo: vi.fn(),
  createBotErrorResponse: vi.fn((input: unknown) => Object.freeze({ tag: 'ERR', input })),
}));

vi.mock('../../../../src/schemas/index.js', () => ({
  createBotRequestSchema: {
    safeParse: deps.safeParse,
  },
}));

vi.mock('../../../../src/effects/shared/bots-api.mappers.js', () => ({
  mapBotResponseToBotInfo: deps.mapBotResponseToBotInfo,
}));

vi.mock('../../../../src/lib/bot-errors.js', () => ({
  createBotErrorResponse: deps.createBotErrorResponse,
}));

import {
  createCreateBotApiMappingError,
  mapCreateBotEffectInputToApiInput,
  mapCreateBotResponseToBotInfo,
} from '../../../../src/effects/create/create-bot-api.mapper.js';

describe('create-bot-api.mapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('маппит input в api-input с operationId', () => {
    const parsedBody = Object.freeze({ name: 'Bot A' });
    deps.safeParse.mockReturnValue({ success: true, data: parsedBody });

    const input = Object.freeze({
      workspaceId: 'ws-1',
      operationId: 'op-1',
      request: { name: 'Bot A' },
    });

    const result = mapCreateBotEffectInputToApiInput(input as any);

    expect(result).toEqual({
      workspaceId: 'ws-1',
      operationId: 'op-1',
      body: parsedBody,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(deps.safeParse).toHaveBeenCalledWith({ name: 'Bot A' });
  });

  it('маппит input в api-input без operationId', () => {
    deps.safeParse.mockReturnValue({ success: true, data: { prompt: 'x' } });

    const result = mapCreateBotEffectInputToApiInput({
      workspaceId: 'ws-2',
      request: { prompt: 'x' } as any,
    } as any);

    expect(result).toEqual({
      workspaceId: 'ws-2',
      body: { prompt: 'x' },
    });
    expect(result).not.toHaveProperty('operationId');
  });

  it('fail-closed: при невалидном request кидает mapping error с issues', () => {
    deps.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [
          { path: ['request', 0, 'name'], message: 'required' },
          { path: ['request', 'prompt'], message: 'bad type' },
        ],
      },
    });

    expect(() =>
      mapCreateBotEffectInputToApiInput({
        workspaceId: 'ws-3',
        request: {} as any,
      } as any)
    ).toThrow();

    expect(deps.createBotErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            mapper: 'create-bot-api.mapper',
            message: 'Некорректный request для create-bot API',
            issues: [
              { path: 'request.0.name', message: 'required' },
              { path: 'request.prompt', message: 'bad type' },
            ],
          }),
        }),
      }),
    );
  });

  it('mapCreateBotResponseToBotInfo: делегирует shared mapper', () => {
    const dto = Object.freeze({ id: 'b1' });
    const mapped = Object.freeze({ id: 'b1', name: 'Bot' });
    deps.mapBotResponseToBotInfo.mockReturnValue(mapped);

    const result = mapCreateBotResponseToBotInfo(dto as any);

    expect(result).toBe(mapped);
    expect(deps.mapBotResponseToBotInfo).toHaveBeenCalledWith(dto);
  });

  it('createCreateBotApiMappingError: поддерживает вызов без issues', () => {
    createCreateBotApiMappingError('only-message');

    expect(deps.createBotErrorResponse).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: 'BOT_PARSING_JSON_INVALID',
        context: expect.objectContaining({
          details: expect.objectContaining({
            mapper: 'create-bot-api.mapper',
            message: 'only-message',
          }),
        }),
      }),
    );

    const arg = deps.createBotErrorResponse.mock.calls.at(-1)?.[0] as any;
    expect(arg.context.details).not.toHaveProperty('issues');
  });
});
