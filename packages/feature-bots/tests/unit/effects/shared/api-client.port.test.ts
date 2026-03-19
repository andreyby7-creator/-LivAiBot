/**
 * @vitest-environment node
 */

import { describe, expectTypeOf, it } from 'vitest';

import type {
  BotApiClientPort,
  BotApiCreateBotInput,
  BotApiGetBotInput,
  BotApiListBotsInput,
  BotApiUpdateInstructionInput,
  BotCreateRequestTransport,
  BotResponseTransport,
  BotsListResponseTransport,
  RequestContext,
  UpdateInstructionRequestTransport,
} from '../../../../src/effects/shared/api-client.port.js';

type Assert<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

describe('api-client.port (types)', () => {
  it('RequestContext: operationId/requestId опциональны', () => {
    const _context: Assert<
      Extends<RequestContext, { operationId?: unknown; requestId?: unknown; }>
    > = true;
    void _context;
  });

  it('Transport DTO types: существуют и являются объектоподобными', () => {
    const _botResponse: Assert<Extends<BotResponseTransport, Record<string, unknown>>> = true;
    const _botsListResponse: Assert<
      Extends<BotsListResponseTransport, Record<string, unknown>>
    > = true;
    const _createBotBody: Assert<Extends<BotCreateRequestTransport, Record<string, unknown>>> =
      true;
    const _updateInstructionBody: Assert<
      Extends<UpdateInstructionRequestTransport, Record<string, unknown>>
    > = true;

    void _botResponse;
    void _botsListResponse;
    void _createBotBody;
    void _updateInstructionBody;
  });

  it('BotApi*Input: корректные обязательные поля', () => {
    // Compile-time only: без expectTypeOf().toMatchTypeOf (оно триггерит TS deprecation warning в типах).
    const _listBots: Assert<Extends<BotApiListBotsInput, { workspaceId: unknown; }>> = true;
    const _createBot: Assert<
      Extends<BotApiCreateBotInput, { workspaceId: unknown; body: unknown; }>
    > = true;
    const _getBot: Assert<Extends<BotApiGetBotInput, { workspaceId: unknown; botId: unknown; }>> =
      true;
    const _updateInstruction: Assert<
      Extends<
        BotApiUpdateInstructionInput,
        { workspaceId: unknown; botId: unknown; body: unknown; }
      >
    > = true;

    // silence unused (they are type-level checks)
    void _listBots;
    void _createBot;
    void _getBot;
    void _updateInstruction;
  });

  it('BotApiClientPort: методы возвращают Effect (функцию (signal?) => Promise<...>)', () => {
    // Не фиксируем конкретные transport DTO, но проверяем shape:
    // (input, context?) => (signal?) => Promise<...>
    expectTypeOf<BotApiClientPort['listBots']>().toBeCallableWith(
      { workspaceId: '' as any } as BotApiListBotsInput,
      {} as RequestContext,
    );
    expectTypeOf<ReturnType<BotApiClientPort['listBots']>>().toBeCallableWith(
      undefined,
    );

    expectTypeOf<BotApiClientPort['createBot']>().toBeCallableWith(
      { workspaceId: '' as any, body: {} as any } as BotApiCreateBotInput,
      {} as RequestContext,
    );
    expectTypeOf<ReturnType<BotApiClientPort['createBot']>>().toBeCallableWith(
      undefined,
    );

    expectTypeOf<BotApiClientPort['getBot']>().toBeCallableWith(
      { workspaceId: '' as any, botId: '' as any } as BotApiGetBotInput,
      {} as RequestContext,
    );
    expectTypeOf<ReturnType<BotApiClientPort['getBot']>>().toBeCallableWith(
      undefined,
    );

    expectTypeOf<BotApiClientPort['updateInstruction']>().toBeCallableWith(
      { workspaceId: '' as any, botId: '' as any, body: {} as any } as BotApiUpdateInstructionInput,
      {} as RequestContext,
    );
    expectTypeOf<ReturnType<BotApiClientPort['updateInstruction']>>().toBeCallableWith(
      undefined,
    );
  });
});
