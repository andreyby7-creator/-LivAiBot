/**
 * @file Unit тесты для автосгенерированных Zod-схем (generated/*).
 */

import { describe, expect, it } from 'vitest';

import * as auth from '../../../../src/validation/zod/generated/auth.js';
import * as bots from '../../../../src/validation/zod/generated/bots.js';
import * as conversations from '../../../../src/validation/zod/generated/conversations.js';

function smokeSchemas(mod: Readonly<{ schemas: Record<string, unknown>; }>, label: string) {
  it(`${label}: экспортирует хотя бы одну схему`, () => {
    expect(Object.keys(mod.schemas).length).toBeGreaterThan(0);
  });

  it(`${label}: каждая схема имеет safeParse и не падает`, () => {
    Object.entries(mod.schemas).forEach(([name, schema]) => {
      expect(schema, `${label}.${name}`).toBeTruthy();
      expect((schema as { safeParse?: unknown; }).safeParse, `${label}.${name}`).toBeTypeOf(
        'function',
      );

      expect(() => (schema as { safeParse: (v: unknown) => unknown; }).safeParse({})).not.toThrow();
    });
  });
}

function expectZodFail(
  res: Readonly<{ success: boolean; error?: { issues: readonly unknown[]; }; }>,
) {
  expect(res.success).toBe(false);
  if (!res.success) {
    expect(Array.isArray(res.error?.issues)).toBe(true);
    expect((res.error?.issues ?? []).length).toBeGreaterThan(0);
  }
}

describe('generated schemas smoke', () => {
  smokeSchemas(auth, 'auth');
  smokeSchemas(bots, 'bots');
  smokeSchemas(conversations, 'conversations');
});

describe('generated schemas: parse + ошибки', () => {
  it('auth.LoginRequestSchema: валидный пример парсится и покрывает все поля', () => {
    expect(
      auth.LoginRequestSchema.parse({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('auth.LoginRequestSchema: невалидный пример даёт ошибку', () => {
    expectZodFail(auth.LoginRequestSchema.safeParse({ email: 'abc' }));
  });

  it('auth.RegisterRequestSchema: валидный пример парсится и покрывает все поля', () => {
    expect(
      auth.RegisterRequestSchema.parse({
        email: 'user@example.com',
        password: 'password123',
        workspace_name: 'My Workspace',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'password123',
      workspace_name: 'My Workspace',
    });
  });

  it('auth.RegisterRequestSchema: невалидный пример даёт ошибку', () => {
    expectZodFail(
      auth.RegisterRequestSchema.safeParse({
        email: 'ab',
        password: 'short',
        workspace_name: '',
      }),
    );
  });

  it('auth.RefreshRequestSchema: валидный пример парсится', () => {
    expect(auth.RefreshRequestSchema.parse({ refresh_token: 'rtok' })).toEqual({
      refresh_token: 'rtok',
    });
  });

  it('auth.RefreshRequestSchema: невалидный пример даёт ошибку', () => {
    expectZodFail(auth.RefreshRequestSchema.safeParse({}));
  });

  it('auth.TokenPairResponseSchema: default token_type применяется', () => {
    expect(
      auth.TokenPairResponseSchema.parse({
        access_token: 'atok',
        refresh_token: 'rtok',
      }),
    ).toEqual({
      access_token: 'atok',
      refresh_token: 'rtok',
      token_type: 'bearer',
    });
  });

  it('auth.TokenPairResponseSchema: невалидный пример даёт ошибку', () => {
    expectZodFail(auth.TokenPairResponseSchema.safeParse({ access_token: 'atok' }));
  });

  it('auth.MeResponseSchema: uuid поля валидируются', () => {
    const ok = auth.MeResponseSchema.safeParse({
      email: 'user@example.com',
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      workspace_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(ok.success).toBe(true);
    expectZodFail(
      auth.MeResponseSchema.safeParse({
        email: 'user@example.com',
        user_id: 'not-a-uuid',
        workspace_id: 'not-a-uuid',
      }),
    );
  });

  it('auth.AuthorizationSchema: поддерживает string/null/undefined', () => {
    expect(auth.AuthorizationSchema.safeParse(undefined).success).toBe(true);
    expect(auth.AuthorizationSchema.safeParse('Bearer x').success).toBe(true);
    expect(auth.AuthorizationSchema.safeParse(null).success).toBe(true);
  });

  it('auth.ValidationErrorSchema и auth.HTTPValidationErrorSchema: корректная структура ошибок', () => {
    expect(
      auth.ValidationErrorSchema.safeParse({
        loc: ['body', 0],
        msg: 'bad',
        type: 'value_error',
      }).success,
    ).toBe(true);

    expect(
      auth.HTTPValidationErrorSchema.safeParse({
        detail: [
          {
            loc: ['body', 'email'],
            msg: 'bad',
            type: 'value_error',
          },
        ],
      }).success,
    ).toBe(true);

    // partial(): пустой объект тоже допустим
    expect(auth.HTTPValidationErrorSchema.safeParse({}).success).toBe(true);
  });

  it('bots.BotCreateRequestSchema: валидный пример парсится и покрывает поля/defaults', () => {
    expect(
      bots.BotCreateRequestSchema.parse({
        name: 'My Bot',
      }),
    ).toEqual({
      instruction: '',
      name: 'My Bot',
    });
  });

  it('bots.BotCreateRequestSchema: невалидный пример даёт ошибку', () => {
    expectZodFail(bots.BotCreateRequestSchema.safeParse({ name: '' }));
  });

  it('bots.UpdateInstructionRequestSchema: ограничения min/max работают', () => {
    expect(
      bots.UpdateInstructionRequestSchema.safeParse({
        instruction: 'hello',
      }).success,
    ).toBe(true);
    expectZodFail(bots.UpdateInstructionRequestSchema.safeParse({ instruction: '' }));
  });

  it('bots.X_Operation_IdSchema: поддерживает string/null/undefined', () => {
    expect(bots.X_Operation_IdSchema.safeParse(undefined).success).toBe(true);
    expect(bots.X_Operation_IdSchema.safeParse('op-1').success).toBe(true);
    expect(bots.X_Operation_IdSchema.safeParse(null).success).toBe(true);
  });

  it('bots.BotResponseSchema/BotsListResponseSchema: datetime/uuid/int проверяются', () => {
    const botOk = bots.BotResponseSchema.safeParse({
      created_at: '2020-01-01T00:00:00Z',
      current_version: 1,
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: 'Bot',
      status: 'active',
      workspace_id: '550e8400-e29b-41d4-a716-446655440011',
    });
    expect(botOk.success).toBe(true);

    const listOk = bots.BotsListResponseSchema.safeParse({
      items: [botOk.success ? botOk.data : {}],
    });
    expect(listOk.success).toBe(true);

    expectZodFail(
      bots.BotResponseSchema.safeParse({
        created_at: 'not-datetime',
        current_version: 1.2,
        id: 'not-uuid',
        name: 'Bot',
        status: 'active',
        workspace_id: 'not-uuid',
      }),
    );
  });

  it('bots.ValidationErrorSchema и bots.HTTPValidationErrorSchema: корректная структура ошибок', () => {
    expect(
      bots.ValidationErrorSchema.safeParse({
        loc: ['body', 0],
        msg: 'bad',
        type: 'value_error',
      }).success,
    ).toBe(true);

    expect(
      bots.HTTPValidationErrorSchema.safeParse({
        detail: [
          {
            loc: ['body', 'name'],
            msg: 'bad',
            type: 'value_error',
          },
        ],
      }).success,
    ).toBe(true);

    expect(bots.HTTPValidationErrorSchema.safeParse({}).success).toBe(true);
  });

  it('conversations.TurnRequestSchema: валидный пример парсится', () => {
    expect(conversations.TurnRequestSchema.parse({ content: 'hi' })).toEqual({ content: 'hi' });
  });

  it('conversations.TurnRequestSchema: невалидный пример даёт ошибку', () => {
    expectZodFail(conversations.TurnRequestSchema.safeParse({ content: '' }));
  });

  it('conversations.ThreadCreateRequestSchema: partial позволяет пустой объект, и bot_id допускает null', () => {
    expect(conversations.ThreadCreateRequestSchema.safeParse({}).success).toBe(true);
    expect(conversations.ThreadCreateRequestSchema.safeParse({ bot_id: null }).success).toBe(true);
    expect(
      conversations.ThreadCreateRequestSchema.safeParse({
        bot_id: '550e8400-e29b-41d4-a716-446655440020',
      }).success,
    ).toBe(true);
  });

  it('conversations.ThreadResponseSchema/ThreadsListResponseSchema: datetime/uuid проверяются', () => {
    const threadOk = conversations.ThreadResponseSchema.safeParse({
      bot_id: null,
      created_at: '2020-01-01T00:00:00Z',
      id: '550e8400-e29b-41d4-a716-446655440021',
      status: 'active',
      workspace_id: '550e8400-e29b-41d4-a716-446655440022',
    });
    expect(threadOk.success).toBe(true);

    const listOk = conversations.ThreadsListResponseSchema.safeParse({
      items: [threadOk.success ? threadOk.data : {}],
    });
    expect(listOk.success).toBe(true);
  });

  it('conversations.MessageResponseSchema/MessagesListResponseSchema: operation_id optional, uuid/datetime', () => {
    const msgOk = conversations.MessageResponseSchema.safeParse({
      content: 'hi',
      created_at: '2020-01-01T00:00:00Z',
      id: '550e8400-e29b-41d4-a716-446655440030',
      role: 'user',
      thread_id: '550e8400-e29b-41d4-a716-446655440031',
      operation_id: null,
    });
    expect(msgOk.success).toBe(true);

    const listOk = conversations.MessagesListResponseSchema.safeParse({
      items: [msgOk.success ? msgOk.data : {}],
    });
    expect(listOk.success).toBe(true);
  });

  it('conversations.TurnResponseSchema: вложенные сообщения валидируются', () => {
    const payload = {
      assistant_message: {
        content: 'hello',
        created_at: '2020-01-01T00:00:00Z',
        id: '550e8400-e29b-41d4-a716-446655440040',
        role: 'assistant',
        thread_id: '550e8400-e29b-41d4-a716-446655440041',
      },
      thread_id: '550e8400-e29b-41d4-a716-446655440041',
      user_message: {
        content: 'hi',
        created_at: '2020-01-01T00:00:00Z',
        id: '550e8400-e29b-41d4-a716-446655440042',
        role: 'user',
        thread_id: '550e8400-e29b-41d4-a716-446655440041',
      },
    };
    expect(conversations.TurnResponseSchema.safeParse(payload).success).toBe(true);
    expectZodFail(conversations.TurnResponseSchema.safeParse({}));
  });

  it('conversations.X_Operation_IdSchema: поддерживает string/null/undefined', () => {
    expect(conversations.X_Operation_IdSchema.safeParse(undefined).success).toBe(true);
    expect(conversations.X_Operation_IdSchema.safeParse('op-1').success).toBe(true);
    expect(conversations.X_Operation_IdSchema.safeParse(null).success).toBe(true);
  });

  it('conversations.ValidationErrorSchema и conversations.HTTPValidationErrorSchema: корректная структура ошибок', () => {
    expect(
      conversations.ValidationErrorSchema.safeParse({
        loc: ['body', 0],
        msg: 'bad',
        type: 'value_error',
      }).success,
    ).toBe(true);

    expect(
      conversations.HTTPValidationErrorSchema.safeParse({
        detail: [
          {
            loc: ['body', 'content'],
            msg: 'bad',
            type: 'value_error',
          },
        ],
      }).success,
    ).toBe(true);

    expect(conversations.HTTPValidationErrorSchema.safeParse({}).success).toBe(true);
  });
});
