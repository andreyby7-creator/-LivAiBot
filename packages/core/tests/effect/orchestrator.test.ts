/**
 * @file Unit тесты для effect/orchestrator.ts
 * Цель: 100% coverage для публичного API: step, stepWithPrevious, orchestrate, createOrchestrator.
 */

import { describe, expect, it, vi } from 'vitest';

import type { Step } from '../../src/effect/orchestrator.js';

describe('effect/orchestrator', () => {
  it('step: оборачивает Effect<T> и пробрасывает signal (previousResult игнорируется)', async () => {
    const { step } = await import('../../src/effect/orchestrator.js');

    const effect = vi.fn(async (signal?: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return 'ok' as const;
    });

    const controller = new AbortController();
    const s = step('fetch', effect, 123);

    // Step.effect имеет сигнатуру EffectWithPrevious, поэтому передаем 2 аргумента
    const result = await (s.effect as (sig?: AbortSignal, previous?: unknown) => Promise<unknown>)(
      controller.signal,
      { any: 'previous' },
    );

    expect(result).toBe('ok');
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('stepWithPrevious: передает previousResult в effect', async () => {
    const { stepWithPrevious } = await import('../../src/effect/orchestrator.js');

    const s = stepWithPrevious<number, number>(
      'inc',
      async (_signal, previous) => (previous ?? 0) + 1,
      10,
    );

    const result = await s.effect(undefined, 41);
    expect(result).toBe(42);
  });

  it('createOrchestrator: success path — применяет withTimeout только при timeoutMs>0, вызывает telemetry.info, передает previousResult', async () => {
    vi.resetModules();

    const withTimeout = vi.fn(<T>(effect: (signal?: AbortSignal) => Promise<T>) => effect);

    const runIsolated = vi.fn(async (effect: () => Promise<unknown>, _opts?: unknown) => {
      const value = await effect();
      return { ok: true as const, value };
    });

    vi.doMock('../../src/effect/effect-timeout.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-timeout.js');
      return { ...actual, withTimeout };
    });
    vi.doMock('../../src/effect/effect-isolation.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-isolation.js');
      return { ...actual, runIsolated };
    });

    const { createOrchestrator, step, stepWithPrevious } = await import('../../src/effect/orchestrator.js');

    const info = vi.fn();
    const warn = vi.fn();
    const orch = createOrchestrator({ telemetry: { info, warn } });
    expect(Object.isFrozen(orch)).toBe(true);

    const s1 = step('s1', async () => 'a', 5);
    const s2 = stepWithPrevious('s2', async (_sig, prev) => `${String(prev)}b`);
    const s3 = step('s3', async () => 'ignored-timeout', 0); // timeoutMs=0 → no withTimeout

    const effect = orch.orchestrate([s1, s2, s3] as unknown as readonly [Step<string>, Step<string>, Step<string>]);
    const result = await effect();

    // Последний шаг возвращает 'ignored-timeout'
    expect(result).toBe('ignored-timeout');

    // withTimeout: только для s1 (timeoutMs=5), но не для s2 (undefined) и s3 (0)
    expect(withTimeout).toHaveBeenCalledTimes(1);
    // runIsolated вызывается на каждый step
    expect(runIsolated).toHaveBeenCalledTimes(3);
    expect(info).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(0);
  });

  it('createOrchestrator: fail path — вызывает telemetry.warn и возвращает rejected promise', async () => {
    vi.resetModules();

    const isolationError = new Error('boom');
    const runIsolated = vi.fn(async () => ({ ok: false as const, error: isolationError }));
    const withTimeout = vi.fn(<T>(effect: (signal?: AbortSignal) => Promise<T>) => effect);

    vi.doMock('../../src/effect/effect-timeout.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-timeout.js');
      return { ...actual, withTimeout };
    });
    vi.doMock('../../src/effect/effect-isolation.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-isolation.js');
      return { ...actual, runIsolated };
    });

    const { createOrchestrator, step } = await import('../../src/effect/orchestrator.js');
    const warn = vi.fn();
    const orch = createOrchestrator({ telemetry: { warn } });

    const effect = orch.orchestrate([step('s1', async () => 'x', 10)] as unknown as readonly [Step<string>]);

    await expect(effect()).rejects.toBe(isolationError);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(withTimeout).toHaveBeenCalledTimes(1);
  });

  it('createOrchestrator: fail path — non-Error значение в error (ветка String(error))', async () => {
    vi.resetModules();

    const runIsolated = vi.fn(async () => ({ ok: false as const, error: 'boom' as unknown }));
    const withTimeout = vi.fn(<T>(effect: (signal?: AbortSignal) => Promise<T>) => effect);

    vi.doMock('../../src/effect/effect-timeout.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-timeout.js');
      return { ...actual, withTimeout };
    });
    vi.doMock('../../src/effect/effect-isolation.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-isolation.js');
      return { ...actual, runIsolated };
    });

    const { createOrchestrator, step } = await import('../../src/effect/orchestrator.js');
    const warn = vi.fn();
    const orch = createOrchestrator({ telemetry: { warn } });

    const effect = orch.orchestrate([step('s1', async () => 'x')] as unknown as readonly [Step<string>]);

    await expect(effect()).rejects.toBe('boom');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ error: 'boom' }));
    expect(withTimeout).toHaveBeenCalledTimes(0);
  });

  it('orchestrate: пустые steps возвращают effect, который reject (не throw при создании)', async () => {
    const { orchestrate } = await import('../../src/effect/orchestrator.js');
    const eff = orchestrate([] as unknown as readonly Step<unknown>[]);
    await expect(eff()).rejects.toThrowError('[orchestrator] Cannot orchestrate empty steps array');
  });

  it('fallback: если isOk/isFail замоканы как false, orchestrator возвращает Invalid Result state', async () => {
    vi.resetModules();

    vi.doMock('../../src/effect/effect-utils.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-utils.js');
      return {
        ...actual,
        isOk: () => false,
        isFail: () => false,
      };
    });

    vi.doMock('../../src/effect/effect-isolation.js', async () => {
      const actual = await vi.importActual('../../src/effect/effect-isolation.js');
      return {
        ...actual,
        runIsolated: async () => ({ ok: true as const, value: 1 }),
      };
    });

    const { createOrchestrator, step } = await import('../../src/effect/orchestrator.js');
    const orch = createOrchestrator();
    const eff = orch.orchestrate([step('s1', async () => 'x')] as unknown as readonly [Step<string>]);

    await expect(eff()).rejects.toThrowError('[orchestrator] Invalid Result state');
  });
});

