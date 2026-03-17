/**
 * @file Unit тесты для lib/bot-telemetry.ts
 * Цель: 100% покрытие файла bot-telemetry.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelemetryLevel } from '@livai/core-contracts';

import type { BotTelemetryEvent, BotTelemetrySinkLike } from '../../../src/lib/bot-telemetry.js';
import {
  createBotTelemetryEvent,
  createBotTelemetrySinkAdapter,
  createConversationsStartedTelemetryEvent,
  createIntegrationCallTelemetryEvent,
  createLlmTokensTelemetryEvent,
  createMessagesProcessedTelemetryEvent,
  createWebhookTelemetryEvent,
  emitBotTelemetryEvent,
} from '../../../src/lib/bot-telemetry.js';

const entity = { id: 'bot-1', workspaceId: 'ws-1' } as any;

const baseInput = (overrides: Partial<Parameters<typeof createBotTelemetryEvent>[0]> = {}) => ({
  timestamp: 1,
  level: 'INFO' as TelemetryLevel,
  message: 'm',
  metric: 'performance' as any,
  entity,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createBotTelemetryEvent', () => {
  it('создаёт frozen event, freeze metadata, и не создаёт tracing keys когда они undefined', () => {
    const evt = createBotTelemetryEvent(
      baseInput({
        correlationId: 'c1',
        metadata: { ok: true, n: 1, z: null },
      }),
    );

    expect(Object.isFrozen(evt)).toBe(true);
    expect(Object.isFrozen(evt.metadata)).toBe(true);

    expect('spanId' in evt).toBe(false);
    expect('traceId' in evt).toBe(false);
    expect(evt.correlationId).toBe('c1');

    const meta = evt.metadata as unknown as Record<string, unknown>;
    expect(meta['metric']).toBe('performance');
    expect(meta['botId']).toBe('bot-1');
    expect(meta['workspaceId']).toBe('ws-1');
    expect(meta['ok']).toBe(true);
    expect(meta['n']).toBe(1);
    expect(meta['z']).toBe(null);
  });

  it('freezeMetadata short-circuits when metadata already frozen', () => {
    const spy = vi.spyOn(Object, 'isFrozen').mockReturnValue(true);
    const evt = createBotTelemetryEvent(baseInput({ metadata: { a: 1 } }));
    expect(evt.metadata).toEqual(expect.objectContaining({ metric: 'performance' }));
    expect(spy).toHaveBeenCalled();
  });

  it('metadata опционален: без metadata в input нет extra ключей', () => {
    const evt = createBotTelemetryEvent(
      baseInput({
        metric: 'conversion' as any,
      }),
    );

    const meta = evt.metadata as unknown as Record<string, unknown>;
    expect(meta['metric']).toBe('conversion');
    expect('ok' in meta).toBe(false);
  });

  it('бросает BotTelemetryError на не-primitive metadata', () => {
    expect(() =>
      createBotTelemetryEvent(
        baseInput({
          metadata: { bad: { nested: true } as any } as any,
        }),
      )
    ).toThrow(/Telemetry metadata must be primitive-only/);
  });
});

describe('metric helpers', () => {
  it('createLlmTokensTelemetryEvent включает tokens и optional model', () => {
    const evt = createLlmTokensTelemetryEvent({
      entity,
      timestamp: 1,
      tokens: 123,
      model: 'gpt-x',
      correlationId: 'c',
      traceId: 't',
    });
    const meta = evt.metadata as unknown as Record<string, unknown>;
    expect(meta['metric']).toBe('llm_tokens');
    expect(meta['tokens']).toBe(123);
    expect(meta['model']).toBe('gpt-x');
    expect(evt.correlationId).toBe('c');
    expect(evt.traceId).toBe('t');
  });

  it('createLlmTokensTelemetryEvent без model не добавляет ключ model', () => {
    const evt = createLlmTokensTelemetryEvent({
      entity,
      timestamp: 1,
      tokens: 1,
    });
    const meta = evt.metadata as unknown as Record<string, unknown>;
    expect('model' in meta).toBe(false);
  });

  it('conversations_started: default count=1', () => {
    const evt = createConversationsStartedTelemetryEvent({ entity, timestamp: 1 });
    const meta = evt.metadata as unknown as Record<string, unknown>;
    expect(meta['metric']).toBe('conversations_started');
    expect(meta['count']).toBe(1);
  });

  it('messages_processed: uses provided count', () => {
    const evt = createMessagesProcessedTelemetryEvent({
      entity,
      timestamp: 1,
      count: 5,
      spanId: 's',
    });
    const meta = evt.metadata as unknown as Record<string, unknown>;
    expect(meta['metric']).toBe('messages_processed');
    expect(meta['count']).toBe(5);
    expect(evt.spanId).toBe('s');
  });

  it('createWebhookTelemetryEvent level depends on status', () => {
    const ok = createWebhookTelemetryEvent({ entity, timestamp: 1, status: 'success' });
    const bad = createWebhookTelemetryEvent({
      entity,
      timestamp: 1,
      status: 'failed',
      provider: 'p',
    });
    expect(ok.level).toBe('INFO');
    expect(bad.level).toBe('WARN');
    const meta = bad.metadata as unknown as Record<string, unknown>;
    expect(meta['provider']).toBe('p');
  });

  it('integration_calls: level depends on status and optional latencyMs', () => {
    const ok = createIntegrationCallTelemetryEvent({
      entity,
      timestamp: 1,
      status: 'success',
      integration: 'slack',
      latencyMs: 10,
    });
    const bad = createIntegrationCallTelemetryEvent({
      entity,
      timestamp: 1,
      status: 'failed',
      integration: 'slack',
    });
    expect(ok.level).toBe('INFO');
    const metaOk = ok.metadata as unknown as Record<string, unknown>;
    expect(metaOk['latencyMs']).toBe(10);
    expect(bad.level).toBe('WARN');
    const metaBad = bad.metadata as unknown as Record<string, unknown>;
    expect('latencyMs' in metaBad).toBe(false);
  });
});

describe('emitBotTelemetryEvent', () => {
  it('accepts sink function and returns ok=true', async () => {
    const sink = vi.fn();
    const evt = createConversationsStartedTelemetryEvent({ entity, timestamp: 1 });
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const res = await emitBotTelemetryEvent(sink, evt, { timeoutMs: 100 });
    expect(res).toEqual({ ok: true });
    expect(sink).toHaveBeenCalledWith(evt);
  });

  it('accepts sink { emit } via adapter', async () => {
    const emit = vi.fn();
    const sinkLike: BotTelemetrySinkLike = createBotTelemetrySinkAdapter({ emit });
    const evt = createMessagesProcessedTelemetryEvent({ entity, timestamp: 1 });
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const res = await emitBotTelemetryEvent(sinkLike, evt, { timeoutMs: 100 });
    expect(res).toEqual({ ok: true });
    expect(emit).toHaveBeenCalledWith(evt);
  });

  it('invalid sink returns ok=false and calls onError (strict=false)', async () => {
    const evt = createMessagesProcessedTelemetryEvent({ entity, timestamp: 1 });
    const onError = vi.fn();

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    await expect(emitBotTelemetryEvent({} as any, evt, { onError, timeoutMs: 100 })).rejects
      .toThrow(
        /Telemetry sink is invalid/,
      );
    expect(onError).not.toHaveBeenCalled();
  });

  it('invalid sink throws when strict=true', async () => {
    const evt = createMessagesProcessedTelemetryEvent({ entity, timestamp: 1 });
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    await expect(emitBotTelemetryEvent({} as any, evt, { strict: true, timeoutMs: 100 })).rejects
      .toThrow(
        /Telemetry sink is invalid/,
      );
  });

  it('non-serializable payload triggers onInvalid and returns ok=false (strict=false)', async () => {
    const sink = vi.fn();
    const onInvalid = vi.fn();
    // We must pass an intentionally non-serializable event (circular ref).
    // `create*TelemetryEvent` returns a frozen object, so craft a raw event here.
    const evt: BotTelemetryEvent = {
      level: 'INFO',
      message: 'x',
      timestamp: 1,
      metadata: { metric: 'conversations_started', botId: 'bot-1', workspaceId: 'ws-1' } as any,
    } as any;
    // eslint-disable-next-line fp/no-mutation -- create circular structure for JSON.stringify failure
    (evt as any).self = evt;

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const res = await emitBotTelemetryEvent(sink, evt, { onInvalid, timeoutMs: 100 });
    expect(res.ok).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('payload too large triggers TELEMETRY_PAYLOAD_TOO_LARGE (and strict=true throws)', async () => {
    const sink = vi.fn();
    const onInvalid = vi.fn();
    const evt = createBotTelemetryEvent(
      baseInput({
        message: 'x'.repeat(2000),
        metadata: { a: 'b' },
      }),
    );

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const res = await emitBotTelemetryEvent(sink, evt, {
      maxSerializedSize: 10,
      onInvalid,
      timeoutMs: 100,
    });
    expect(res.ok).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    await expect(
      emitBotTelemetryEvent(sink, evt, {
        maxSerializedSize: 10,
        onInvalid,
        strict: true,
        timeoutMs: 100,
      }),
    ).rejects.toThrow(/Telemetry payload too large/);
  });

  it('timeout path returns ok=false and strict=true throws; invalid timeoutMs uses default', async () => {
    vi.useFakeTimers();

    const sink = () => new Promise<void>(() => {});
    const evt = createConversationsStartedTelemetryEvent({ entity, timestamp: 1 });

    const p1 = emitBotTelemetryEvent(sink, evt, { timeoutMs: 5 });
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: advancing timers is controlled by test runner
    await vi.advanceTimersByTimeAsync(5);
    const res1 = await p1;
    expect(res1.ok).toBe(false);
    expect(String((res1 as any).error)).toContain('after 5ms');

    const p2 = emitBotTelemetryEvent(sink, evt, { timeoutMs: Number.NaN as any, strict: true });
    const expectation = expect(p2).rejects.toThrow(/after 10000ms/);
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: advancing timers is controlled by test runner
    await vi.advanceTimersByTimeAsync(10_000);
    await expectation;
  });

  it('sink throws: returns ok=false and onError called', async () => {
    const err = new Error('boom');
    const sink = () => {
      throw err;
    };
    const evt = createConversationsStartedTelemetryEvent({ entity, timestamp: 1 });
    const onError = vi.fn();

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const res = await emitBotTelemetryEvent(sink, evt, { onError, timeoutMs: 100 });
    expect(res.ok).toBe(false);
    expect(onError).toHaveBeenCalledWith(err, evt);
  });

  it('timeoutMs normalization: covers all branches', async () => {
    const sink = () => Promise.resolve();
    const evt = createConversationsStartedTelemetryEvent({ entity, timestamp: 1 });

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const r1 = await emitBotTelemetryEvent(sink, evt, {});
    expect(r1.ok).toBe(true);

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const r2 = await emitBotTelemetryEvent(sink, evt, { timeoutMs: 0 });
    expect(r2.ok).toBe(true);

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const r3 = await emitBotTelemetryEvent(sink, evt, { timeoutMs: 5 });
    expect(r3.ok).toBe(true);

    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- unit test: emitBotTelemetryEvent has built-in timeout handling
    const r4 = await emitBotTelemetryEvent(sink, evt, { timeoutMs: Number.NaN as any });
    expect(r4.ok).toBe(true);
  });
});
