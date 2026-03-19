/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const redact = (input: string): string => {
  // Повторяем алгоритм из create-bot-audit.mapper.ts (FNV-1a 32bit) без мутаций/циклов.
  const FNV_PRIME = 0x01000193;
  const hash = [...input].reduce(
    (acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), FNV_PRIME),
    0x811c9dc5,
  );
  const u32 = hash >>> 0;
  return `redacted_${u32.toString(16)}`;
};

const mocks = vi.hoisted(() => {
  /* eslint-disable @livai/rag/context-leakage -- Здесь mock-объект auditContext создаётся локально в unit-тестах. */
  const createBotAuditEventTemplateMock = vi.fn(
    (
      eventType: string,
      botId: string,
      workspaceId: string,
      userId: string | undefined,
      auditContext: any,
    ) => ({
      eventType,
      botId,
      workspaceId,
      userId,
      auditContext,
    }),
  );
  /* eslint-enable @livai/rag/context-leakage */

  const botAuditEventSchemaParseMock = vi.fn((payload: unknown) => payload);

  return {
    createBotAuditEventTemplateMock,
    botAuditEventSchemaParseMock,
  };
});

vi.mock('../../../../src/types/bots-initial.js', () => ({
  createBotAuditEventTemplate: mocks.createBotAuditEventTemplateMock,
}));

vi.mock('../../../../src/schemas/index.js', () => ({
  botAuditEventSchema: { parse: mocks.botAuditEventSchemaParseMock },
}));

import {
  mapCreateBotErrorToAuditEvent,
  mapCreateBotResultToAuditEvent,
} from '../../../../src/effects/create/create-bot-audit.mapper.js';

describe('create-bot-audit.mapper', () => {
  it('mapCreateBotResultToAuditEvent: success без traceId и с userId', () => {
    const bot = {
      id: 'bot-1',
      workspaceId: 'ws-1',
    } as any;

    const context = {
      eventId: 'evt-1',
      timestamp: 111,
      userId: 'user-1',
    };

    mocks.botAuditEventSchemaParseMock.mockClear();
    mocks.createBotAuditEventTemplateMock.mockClear();

    const res = mapCreateBotResultToAuditEvent(bot, context as any);

    expect(mocks.createBotAuditEventTemplateMock).toHaveBeenCalledTimes(1);
    const args = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];
    expect(args[0]).toBe('bot_created');
    expect(args[1]).toBe(redact('bot-1'));
    expect(args[2]).toBe(redact('ws-1'));
    expect(args[3]).toBe(redact('user-1'));

    const auditContext = args[4];
    expect(auditContext.stage).toBe('create');
    expect(auditContext.result).toBe('success');
    expect(auditContext).not.toHaveProperty('traceId');
    expect(Object.isFrozen(auditContext)).toBe(true);

    expect(mocks.botAuditEventSchemaParseMock).toHaveBeenCalledTimes(1);
    const parsed = mocks.botAuditEventSchemaParseMock.mock.calls[0]?.[0] as any;
    expect(parsed.eventId).toBe('evt-1');
    expect(parsed.timestamp).toBe(111);
    expect(res).toEqual(parsed);
  });

  it('mapCreateBotResultToAuditEvent: success с traceId и без userId', () => {
    const bot = {
      id: 'bot-2',
      workspaceId: 'ws-2',
    } as any;

    const context = {
      eventId: 'evt-2',
      timestamp: 222,
      traceId: 'trace-2',
    };

    mocks.botAuditEventSchemaParseMock.mockClear();
    mocks.createBotAuditEventTemplateMock.mockClear();

    const res = mapCreateBotResultToAuditEvent(bot, context as any);

    const args = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];
    expect(args[0]).toBe('bot_created');
    expect(args[1]).toBe(redact('bot-2'));
    expect(args[2]).toBe(redact('ws-2'));
    expect(args[3]).toBe(undefined);

    const auditContext = args[4];
    expect(auditContext.stage).toBe('create');
    expect(auditContext.result).toBe('success');
    expect(auditContext.traceId).toBe('trace-2');
    expect(Object.isFrozen(auditContext)).toBe(true);

    const parsed = mocks.botAuditEventSchemaParseMock.mock.calls[0]?.[0] as any;
    expect(parsed.eventId).toBe('evt-2');
    expect(parsed.timestamp).toBe(222);
    expect(res).toEqual(parsed);
  });

  it('mapCreateBotErrorToAuditEvent: failure без traceId и с userId', () => {
    const error = {
      code: 'BOT_CUSTOM',
      category: 'custom',
      severity: 'error',
      retryable: true,
    } as any;

    const context = {
      eventId: 'evt-3',
      timestamp: 333,
      botId: 'bot-3',
      workspaceId: 'ws-3',
      userId: 'user-3',
    };

    mocks.botAuditEventSchemaParseMock.mockClear();
    mocks.createBotAuditEventTemplateMock.mockClear();

    const res = mapCreateBotErrorToAuditEvent(error, context as any);

    const args = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];
    expect(args[0]).toBe('bot_created');
    expect(args[1]).toBe(redact('bot-3'));
    expect(args[2]).toBe(redact('ws-3'));
    expect(args[3]).toBe(redact('user-3'));

    const auditContext = args[4];
    expect(auditContext.stage).toBe('create');
    expect(auditContext.result).toBe('failed');
    expect(auditContext).not.toHaveProperty('traceId');
    expect(auditContext.errorCode).toBe('BOT_CUSTOM');
    expect(auditContext.errorCategory).toBe('custom');
    expect(auditContext.errorSeverity).toBe('error');
    expect(auditContext.errorRetryable).toBe(true);
    expect(Object.isFrozen(auditContext)).toBe(true);

    const parsed = mocks.botAuditEventSchemaParseMock.mock.calls[0]?.[0] as any;
    expect(parsed.eventId).toBe('evt-3');
    expect(parsed.timestamp).toBe(333);
    expect(res).toEqual(parsed);
  });

  it('mapCreateBotErrorToAuditEvent: failure с traceId и без userId', () => {
    const error = {
      code: 'BOT_CUSTOM_2',
      category: 'custom',
      severity: 'warning',
      retryable: false,
    } as any;

    const context = {
      eventId: 'evt-4',
      timestamp: 444,
      botId: 'bot-4',
      workspaceId: 'ws-4',
      traceId: 'trace-4',
    };

    mocks.botAuditEventSchemaParseMock.mockClear();
    mocks.createBotAuditEventTemplateMock.mockClear();

    const res = mapCreateBotErrorToAuditEvent(error, context as any);

    const args = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];
    expect(args[0]).toBe('bot_created');
    expect(args[1]).toBe(redact('bot-4'));
    expect(args[2]).toBe(redact('ws-4'));
    expect(args[3]).toBe(undefined);

    const auditContext = args[4];
    expect(auditContext.stage).toBe('create');
    expect(auditContext.result).toBe('failed');
    expect(auditContext.traceId).toBe('trace-4');
    expect(auditContext.errorCode).toBe('BOT_CUSTOM_2');
    expect(auditContext.errorCategory).toBe('custom');
    expect(auditContext.errorSeverity).toBe('warning');
    expect(auditContext.errorRetryable).toBe(false);
    expect(Object.isFrozen(auditContext)).toBe(true);

    const parsed = mocks.botAuditEventSchemaParseMock.mock.calls[0]?.[0] as any;
    expect(parsed.eventId).toBe('evt-4');
    expect(parsed.timestamp).toBe(444);
    expect(res).toEqual(parsed);
  });

  it('redaction correctness: всегда редактирует botId/workspaceId/userId, детерминирована и корректно работает для empty/very-long', () => {
    const long = 'x'.repeat(1000);
    const bot = Object.freeze({
      id: '',
      workspaceId: long,
    } as any);

    const context = Object.freeze({
      eventId: 'evt-red-1',
      timestamp: 555,
      userId: 'user-red',
    });

    mocks.createBotAuditEventTemplateMock.mockClear();

    const res1 = mapCreateBotResultToAuditEvent(bot, context as any);
    const args1 = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];

    const botIdRed1 = args1[1];
    const workspaceIdRed1 = args1[2];
    const userIdRed1 = args1[3];

    expect(botIdRed1).toBe(redact(''));
    expect(botIdRed1).not.toBe('');

    expect(workspaceIdRed1).toBe(redact(long));
    expect(workspaceIdRed1).not.toBe(long);

    expect(userIdRed1).toBe(redact('user-red'));
    expect(userIdRed1).not.toBe('user-red');

    // determinism: повторный вызов даёт те же redacted значения
    mocks.createBotAuditEventTemplateMock.mockClear();
    const res2 = mapCreateBotResultToAuditEvent(bot, context as any);
    const args2 = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];

    expect(args2[1]).toBe(botIdRed1);
    expect(args2[2]).toBe(workspaceIdRed1);
    expect(args2[3]).toBe(userIdRed1);

    expect(res2).toEqual(res1);
  });

  it('schema validation / fail-closed: если base некорректный (нет stage), botAuditEventSchema.parse кидает ошибку', () => {
    mocks.botAuditEventSchemaParseMock.mockImplementationOnce((payload: any) => {
      return payload?.auditContext?.stage === undefined
        ? (() => {
          throw new Error('schema mismatch');
        })()
        : payload;
    });

    mocks.createBotAuditEventTemplateMock.mockImplementationOnce(() => ({
      eventType: 'bot_created',
      botId: 'redacted_any',
      workspaceId: 'redacted_any',
      userId: undefined,
      // auditContext intentionally missing stage
      auditContext: Object.freeze({}),
    }));

    const bot = { id: 'bot-bad', workspaceId: 'ws-bad' } as any;
    const context = { eventId: 'evt-bad', timestamp: 777, userId: 'u-bad' };

    expect(() => mapCreateBotResultToAuditEvent(bot, context as any)).toThrow('schema mismatch');
  });

  it('optional fields: success с userId=undefined и traceId=undefined (оба отсутствуют)', () => {
    const bot = {
      id: 'bot-uid-none',
      workspaceId: 'ws-uid-none',
    } as any;

    const context = {
      eventId: 'evt-uid-none',
      timestamp: 888,
    };

    mocks.createBotAuditEventTemplateMock.mockClear();
    mocks.botAuditEventSchemaParseMock.mockClear();

    const res = mapCreateBotResultToAuditEvent(bot, context as any);

    const args = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];
    expect(args[0]).toBe('bot_created');
    expect(args[1]).toBe(redact('bot-uid-none'));
    expect(args[2]).toBe(redact('ws-uid-none'));
    expect(args[3]).toBe(undefined);

    const auditContext = args[4];
    expect(auditContext.stage).toBe('create');
    expect(auditContext.result).toBe('success');
    expect(Object.prototype.hasOwnProperty.call(auditContext, 'traceId')).toBe(false);
    expect(Object.isFrozen(auditContext)).toBe(true);

    const parsed = mocks.botAuditEventSchemaParseMock.mock.calls[0]?.[0] as any;
    expect(res).toEqual(parsed);
  });

  it('error branch: разные severity/retryable + длинные строки в BotError формируют immutable context', () => {
    const error = Object.freeze({
      code: 'BOT_CUSTOM_LONG_'.padEnd(50, '9'),
      category: 'custom',
      severity: 'critical',
      retryable: false,
    }) as any;

    const context = {
      eventId: 'evt-err-long',
      timestamp: 999,
      botId: 'bot-err-long',
      workspaceId: 'ws-err-long',
      userId: undefined,
    };

    mocks.createBotAuditEventTemplateMock.mockClear();
    mocks.botAuditEventSchemaParseMock.mockClear();

    const res = mapCreateBotErrorToAuditEvent(error, context as any);

    const args = mocks.createBotAuditEventTemplateMock.mock.calls[0] as any[];
    const auditContext = args[4];

    expect(auditContext.stage).toBe('create');
    expect(auditContext.result).toBe('failed');
    expect(auditContext.errorCode).toBe(error.code);
    expect(auditContext.errorCategory).toBe(error.category);
    expect(auditContext.errorSeverity).toBe(error.severity);
    expect(auditContext.errorRetryable).toBe(false);
    expect(Object.isFrozen(auditContext)).toBe(true);

    const parsed = mocks.botAuditEventSchemaParseMock.mock.calls[0]?.[0] as any;
    expect(res).toEqual(parsed);
  });
});
