/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

const auditMocks = vi.hoisted(() => ({
  emitBotAuditEvent: vi.fn(),
}));

vi.mock('../../../../src/lib/bot-audit.js', () => ({
  emitBotAuditEvent: auditMocks.emitBotAuditEvent,
}));

import {
  createBotAuditPortAdapter,
  createNoopBotAuditPort,
} from '../../../../src/effects/shared/audit.port.js';

describe('audit.port', () => {
  it('createBotAuditPortAdapter: прокидывает sink и options', () => {
    const sink = vi.fn();
    const adapter = createBotAuditPortAdapter(sink as any);

    auditMocks.emitBotAuditEvent.mockReturnValueOnce(Object.freeze({ ok: true }));
    const value = Object.freeze({ type: 'evt' });
    const options = Object.freeze({ flush: true });
    const res = adapter.emit(value, options as any);

    expect(res).toEqual({ ok: true });
    expect(auditMocks.emitBotAuditEvent).toHaveBeenCalledWith(value, sink, options);
  });

  it('createBotAuditPortAdapter: использует immutable snapshot defaultOptions и защищён от внешней мутации', () => {
    const sink = vi.fn();
    const sourceOptions: Record<string, unknown> = { flush: false, sampleRate: 0.1 };
    const adapter = createBotAuditPortAdapter(sink as any, sourceOptions as any);

    // eslint-disable-next-line fp/no-mutation -- Тестирует инвариант snapshot: внешняя мутация не должна влиять на adapter.
    sourceOptions['flush'] = true; // мутация исходника не должна менять snapshot внутри adapter

    auditMocks.emitBotAuditEvent.mockReturnValueOnce(Object.freeze({ ok: true }));
    adapter.emit({ event: 1 });

    const call = auditMocks.emitBotAuditEvent.mock.calls.at(-1);
    expect(call?.[2]).toEqual({ flush: false, sampleRate: 0.1 });
    expect(call?.[2]).not.toBe(sourceOptions);
    expect(Object.isFrozen(call?.[2])).toBe(true);
  });

  it('createBotAuditPortAdapter: options аргумента имеет приоритет над defaultOptions', () => {
    const sink = vi.fn();
    const adapter = createBotAuditPortAdapter(
      sink as any,
      Object.freeze({ flush: false, sampleRate: 0.1 }) as any,
    );

    const runtimeOptions = Object.freeze({ flush: true });
    auditMocks.emitBotAuditEvent.mockReturnValueOnce(Object.freeze({ ok: false, reason: 'x' }));
    const res = adapter.emit({ event: 2 }, runtimeOptions as any);

    expect(res).toEqual({ ok: false, reason: 'x' });
    expect(auditMocks.emitBotAuditEvent).toHaveBeenLastCalledWith(
      { event: 2 },
      sink,
      runtimeOptions,
    );
  });

  it('createBotAuditPortAdapter: при отсутствии options/defaultOptions передаёт undefined', () => {
    const sink = vi.fn();
    const adapter = createBotAuditPortAdapter(sink as any, undefined);

    auditMocks.emitBotAuditEvent.mockReturnValueOnce(Object.freeze({ ok: true }));
    adapter.emit({ event: 3 });

    expect(auditMocks.emitBotAuditEvent).toHaveBeenLastCalledWith({ event: 3 }, sink, undefined);
  });

  it('createNoopBotAuditPort: всегда возвращает frozen { ok: true }', () => {
    const port = createNoopBotAuditPort<{ id: number; }>();
    const r1 = port.emit({ id: 1 });
    const r2 = port.emit({ id: 2 }, { flush: true } as any);

    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    expect(Object.isFrozen(r1)).toBe(true);
    expect(Object.isFrozen(r2)).toBe(true);
  });
});
