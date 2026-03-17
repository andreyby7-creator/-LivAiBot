/**
 * @file Unit тесты для lib/bot-audit.ts
 * Цель: 100% покрытие файла bot-audit.ts
 */

import { describe, expect, it, vi } from 'vitest';

import type { BotAuditEvent } from '../../../src/domain/BotAuditEvent.js';
import type { BotAuditSink, EmitBotAuditEventResult } from '../../../src/lib/bot-audit.js';
import {
  emitBotAuditEvent,
  isBotAuditEventValues,
  normalizeBotAuditEventValues,
  parseBotAuditEventValues,
  toBotAuditEventValues,
} from '../../../src/lib/bot-audit.js';
import type { BotAuditEventValues } from '../../../src/schemas/index.js';

const eventValues = (overrides: Partial<BotAuditEventValues> = {}): BotAuditEventValues =>
  ({
    eventId: 'evt-1' as any,
    type: 'bot_updated',
    botId: 'bot-1' as any,
    workspaceId: 'ws-1' as any,
    timestamp: 1 as any,
    userId: 'user-1' as any,
    // eslint-disable-next-line @livai/rag/context-leakage -- test-only context payload
    context: { a: 1 },
    ...overrides,
  }) as any;

const expectEmitFail = (res: EmitBotAuditEventResult): { error: Error & { code: string; }; } => {
  expect(res.ok).toBe(false);
  return res as any;
};

describe('isBotAuditEventValues / parseBotAuditEventValues', () => {
  it('isBotAuditEventValues true для валидного значения и false для невалидного', () => {
    expect(isBotAuditEventValues(eventValues())).toBe(true);
    expect(isBotAuditEventValues({})).toBe(false);
  });

  it('parseBotAuditEventValues возвращает data или бросает ParseBotAuditEventError', () => {
    expect(parseBotAuditEventValues(eventValues()).type).toBe('bot_updated');
    try {
      parseBotAuditEventValues({});
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).name).toBe('ParseBotAuditEventError');
      expect((e as any).code).toBe('INVALID_AUDIT_EVENT');
    }
  });
});

describe('normalizeBotAuditEventValues', () => {
  it('whitelist-ит поля, делает shallow-freeze context и freeze event', () => {
    const original = eventValues({ context: { x: 1 } });
    const normalized = normalizeBotAuditEventValues(original);

    expect(normalized).toEqual(original);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.context)).toBe(true);
  });

  it('не добавляет userId/context если они undefined', () => {
    const normalized = normalizeBotAuditEventValues(
      eventValues({ userId: undefined, context: undefined } as any),
    );
    expect('userId' in normalized).toBe(false);
    expect('context' in normalized).toBe(false);
  });
});

describe('emitBotAuditEvent', () => {
  it('success path: парсит, нормализует (по умолчанию) и вызывает sink.emit', () => {
    const sink: BotAuditSink = { emit: vi.fn() };
    const v = eventValues({ context: { m: 1 } });

    const res = emitBotAuditEvent(v, sink);

    expect(res).toEqual({ ok: true });
    expect(sink.emit).toHaveBeenCalledTimes(1);
    const emitted = (sink.emit as any).mock.calls[0]![0] as BotAuditEventValues;
    expect(Object.isFrozen(emitted)).toBe(true);
    expect(Object.isFrozen(emitted.context)).toBe(true);
  });

  it('normalize=false: эмитит parsed как есть (без заморозки контекста)', () => {
    const sink: BotAuditSink = { emit: vi.fn() };
    const v = eventValues({ context: { m: 1 } });

    const res = emitBotAuditEvent(v, sink, { normalize: false });
    expect(res).toEqual({ ok: true });

    const emitted = (sink.emit as any).mock.calls[0]![0] as BotAuditEventValues;
    expect(Object.isFrozen(emitted)).toBe(false);
  });

  it('payload too large: onInvalid called, ok=false; strict=true throws', () => {
    const sink: BotAuditSink = { emit: vi.fn() };
    const onInvalid = vi.fn();
    const big = { x: 'a'.repeat(1000) };

    const res = emitBotAuditEvent(big, sink, { maxSerializedSize: 10, onInvalid });
    expect(res.ok).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(sink.emit).not.toHaveBeenCalled();

    expect(() => emitBotAuditEvent(big, sink, { maxSerializedSize: 10, onInvalid, strict: true }))
      .toThrow(/payload too large/);
  });

  it('parse error: onInvalid called, ok=false; strict=true throws same error', () => {
    const sink: BotAuditSink = { emit: vi.fn() };
    const onInvalid = vi.fn();

    const res = emitBotAuditEvent({}, sink, { onInvalid });
    expect(res.ok).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);

    expect(() => emitBotAuditEvent({}, sink, { onInvalid, strict: true })).toThrow();
  });

  it('trySerializeSize: circular value gives null, then parse fails and returns ok=false', () => {
    const sink: BotAuditSink = { emit: vi.fn() };
    const onInvalid = vi.fn();
    const circular: any = {};
    // eslint-disable-next-line fp/no-mutation -- creating a circular structure requires mutation
    circular.self = circular;

    const res = emitBotAuditEvent(circular, sink, { onInvalid });
    expect(res.ok).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('non-Error thrown (from sink.emit): wraps into ParseBotAuditEventError', () => {
    const sink2: BotAuditSink = {
      emit: () => {
        throw 'boom';
      },
    };

    const res = emitBotAuditEvent(eventValues(), sink2, { strict: false });
    const fail = expectEmitFail(res);
    expect(fail.error.name).toBe('ParseBotAuditEventError');
    expect(fail.error.code).toBe('INVALID_AUDIT_EVENT');
  });
});

describe('toBotAuditEventValues', () => {
  it('парсит доменное событие и возвращает normalized values', () => {
    const domainEvent: BotAuditEvent = eventValues() as any;
    const out = toBotAuditEventValues(domainEvent);
    expect(out.type).toBe('bot_updated');
    expect(Object.isFrozen(out)).toBe(true);
  });
});
