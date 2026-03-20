/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import type { Effect } from '@livai/core/effect';

import { executeLifecyclePipeline } from '../../../../../src/effects/shared/lifecycle/pipeline.js';

type BotError = {
  readonly code: string;
  readonly category: string;
  readonly severity: string;
  readonly retryable: boolean;
  readonly context?: unknown;
};

const asEffect = <T>(impl: (signal?: AbortSignal) => Promise<T>): Effect<T> =>
  impl as unknown as Effect<T>;

/* eslint-disable @livai/rag/context-leakage -- unit-test: локальный mkCtx для fixture-контекста */
/* eslint-disable @livai/multiagent/orchestration-safety -- unit-test: orchestration runtime не выполняется */
const mkCtx = (overrides: Partial<any> = {}) =>
  ({
    operationId: 'op-1' as any,
    actorId: 'user-1' as any,
    policyMeta: { version: 1, flags: [], segments: [] },
    auditMeta: { eventId: 'evt-1', timestamp: 123 },
    abortSignal: undefined,
    ...overrides,
  }) as any;

const freeze = <T>(v: T): T => Object.freeze(v);

describe('executeLifecyclePipeline (lifecycle/pipeline.ts)', () => {
  it('existing: status=completed => возвращает existing.result, без execute/map/persist', async () => {
    const signal2 = new AbortController().signal;
    const getEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'completed',
        completedAt: 1,
        executionState: freeze({ status: 'finalized' }),
        result: 777,
      })
    );

    const idempotencyPort = {
      get: vi.fn((_key: any) => getEffect),
      startInProgress: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
    };

    const input = {
      execute: vi.fn(),
      mapResult: vi.fn(),
      persist: vi.fn(),
    };

    const ctx = mkCtx({ abortSignal: new AbortController().signal });

    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);
    const result = await effect(signal2);

    expect(result).toBe(777);
    expect(getEffect).toHaveBeenCalledTimes(1);
    expect(getEffect.mock.calls[0]?.[0]).toBe(signal2);
    expect(input.execute).not.toHaveBeenCalled();
  });

  it('existing: status=failed => прокидывает existing.error', async () => {
    const existingError: BotError = freeze({
      code: 'BOT_X',
      category: 'channel',
      severity: 'high',
      retryable: true,
    });

    const getEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'failed',
        failedAt: 1,
        executionState: freeze({ status: 'aborted', abortedAt: 123 }),
        error: existingError,
      })
    );

    const idempotencyPort = {
      get: vi.fn((_key: any) => getEffect),
      startInProgress: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    } as any;

    const deps = { botsStorePort: {} as any, idempotencyPort };

    const input = {
      execute: vi.fn(),
      mapResult: vi.fn(),
      persist: vi.fn(),
    };

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);

    await expect(effect(undefined)).rejects.toBe(existingError);
    expect(getEffect).toHaveBeenCalledTimes(1);
    expect(input.execute).not.toHaveBeenCalled();
  });

  it('existing: in_progress + reconcile => completed => возвращает reconciled.result', async () => {
    const reconciled = freeze({
      key: 'op-1',
      status: 'completed',
      completedAt: 2,
      executionState: freeze({ status: 'finalized' }),
      result: 42,
    });

    const getEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'in_progress',
        startedAt: 2,
        executionState: freeze({ status: 'started' }),
      } as any)
    );

    const reconcileEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve(reconciled));

    const idempotencyPort = {
      get: vi.fn((_key: any) => getEffect),
      reconcile: vi.fn((_key: any) => reconcileEffect),
      startInProgress: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    } as any;

    const deps = { botsStorePort: {} as any, idempotencyPort };
    const input = {
      execute: vi.fn(),
      mapResult: vi.fn(),
      persist: vi.fn(),
    };

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);

    const result = await effect(undefined);
    expect(result).toBe(42);
    expect(reconcileEffect).toHaveBeenCalledTimes(1);
    expect(input.execute).not.toHaveBeenCalled();
  });

  it('existing: in_progress + reconcile => failed => прокидывает reconciled.error', async () => {
    const reconciledError: BotError = freeze({
      code: 'BOT_FAIL',
      category: 'policy',
      severity: 'medium',
      retryable: false,
    });

    const getEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'in_progress',
        startedAt: 3,
        executionState: freeze({ status: 'started' }),
      } as any)
    );

    const reconcileEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'failed',
        failedAt: 3,
        executionState: freeze({ status: 'aborted', abortedAt: 123 }),
        error: reconciledError,
      } as any)
    );

    const idempotencyPort = {
      get: vi.fn((_key: any) => getEffect),
      reconcile: vi.fn((_key: any) => reconcileEffect),
      startInProgress: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    } as any;

    const deps = { botsStorePort: {} as any, idempotencyPort };

    const input = {
      execute: vi.fn(),
      mapResult: vi.fn(),
      persist: vi.fn(),
    };

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);

    await expect(effect(undefined)).rejects.toBe(reconciledError);
    expect(input.execute).not.toHaveBeenCalled();
  });

  it('existing: in_progress без reconcile => continue => mapping.ok=false => fail + hooks(onError) + audit(failure)', async () => {
    const signal1 = new AbortController().signal;
    const botError: BotError = freeze({
      code: 'BOT_MAP_ERR',
      category: 'integration',
      severity: 'high',
      retryable: false,
    });

    const getEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'in_progress',
        startedAt: 4,
        executionState: freeze({ status: 'started' }),
      } as any)
    );

    const startInProgressEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const failEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const portFailCall = vi.fn((_key: any, executionState: any, error: any) => {
      expect(executionState).toEqual({ status: 'aborted', abortedAt: 123 });
      expect(Object.isFrozen(executionState)).toBe(true);
      expect(error).toBe(botError);
      return failEffect;
    });

    const idempotencyPort = {
      get: vi.fn((_key: any) => getEffect),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startInProgressEffect),
      fail: portFailCall,
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
    } as any;

    const onError = vi.fn(() => Promise.resolve(undefined));
    const hooks = { onError };

    const auditEmit = vi.fn();
    const auditPort = { emit: auditEmit };
    const auditMapping = { mapFailureAuditEvent: vi.fn((_e: any) => ({ type: 'fail' })) };

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      auditPort,
      auditMapping,
      hooks,
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: false, error: botError })),
      persist: vi.fn(),
    };

    const ctx = mkCtx({ abortSignal: signal1 });
    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);

    await expect(effect(signal1)).rejects.toBe(botError);

    expect(getEffect.mock.calls[0]?.[0]).toBe(signal1);
    expect(startInProgressEffect).toHaveBeenCalledTimes(1);
    expect(failEffect).toHaveBeenCalledTimes(1);
    expect(completeEffect).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(auditEmit).toHaveBeenCalledTimes(1);
    expect(auditEmit).toHaveBeenCalledWith({ type: 'fail' });
  });

  it('mapping.ok=true success: hooks undefined & auditPort/mapping undefined => just execute->persist->complete->return', async () => {
    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const persistEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve());
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      hooks: undefined,
      auditPort: undefined,
      auditMapping: undefined,
      retryConfig: { maxRetries: NaN },
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: 5 })),
      persist: vi.fn((_storePort: any, _value: any) =>
        asEffect(async (_signal?: AbortSignal) => persistEffect(_signal))
      ),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps);

    const result = await effect(undefined);
    expect(result).toBe(5);

    expect(startEffect).toHaveBeenCalledTimes(1);
    expect(persistEffect).toHaveBeenCalledTimes(1);
    expect(completeEffect).toHaveBeenCalledTimes(1);
  });

  it('mapping.ok=true: hooks.onSuccess throws sync => try/catch swallowed, still completes', async () => {
    const botValue = 9;
    const onSuccess = vi.fn(() => {
      throw new Error('hook-sync');
    });

    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const persistEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve());
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      hooks: { onSuccess },
      auditPort: { emit: vi.fn() },
      auditMapping: { mapSuccessAuditEvent: vi.fn(() => ({ type: 'ok' })) },
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: botValue })),
      persist: vi.fn((_storePort: any, _value: any) =>
        asEffect(async (_signal?: AbortSignal) => persistEffect(_signal))
      ),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps);

    const result = await effect(undefined);
    expect(result).toBe(botValue);
  });

  it('mapping.ok=true: hooks.onSuccess returns rejected promise => swallowHookRejection', async () => {
    const botValue = 3;
    const onSuccess = vi.fn(() => Promise.reject(new Error('hook-reject')));

    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const persistEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve());
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      hooks: { onSuccess },
      auditPort: undefined,
      auditMapping: undefined,
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: botValue })),
      persist: vi.fn((_storePort: any, _value: any) =>
        asEffect(async (_signal?: AbortSignal) => persistEffect(_signal))
      ),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps);

    const result = await effect(undefined);
    expect(result).toBe(botValue);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('mapping.ok=true: auditMapping.mapSuccessAuditEvent undefined => не вызывает emit', async () => {
    const emit = vi.fn();

    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const persistEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve());
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      auditPort: { emit },
      auditMapping: {},
      hooks: undefined,
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: 1 })),
      persist: vi.fn((_storePort: any, _value: any) =>
        asEffect(async (_signal?: AbortSignal) => persistEffect(_signal))
      ),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps as any);

    const result = await effect(undefined);
    expect(result).toBe(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('mapping.ok=true: hooks задан, но onSuccess отсутствует => bestEffortRunHooks no-op', async () => {
    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const persistEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve());
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      hooks: {} as any, // onSuccess undefined
      auditPort: undefined,
      auditMapping: undefined,
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: 10 })),
      persist: vi.fn((_storePort: any, _value: any) =>
        asEffect(async () => persistEffect({} as any))
      ),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps as any);

    const result = await effect(undefined);
    expect(result).toBe(10);
    expect(completeEffect).toHaveBeenCalledTimes(1);
  });

  it('mapping.ok=false: hooks задан, но onError отсутствует и auditMapping без mapFailureAuditEvent => audit не эмитится', async () => {
    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const failEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const botError: BotError = freeze({
      code: 'BOT_MAP_ERR2',
      category: 'integration',
      severity: 'high',
      retryable: false,
    });

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      fail: vi.fn((_key: any, executionState: any, error: any) => {
        expect(executionState).toEqual({ status: 'aborted', abortedAt: 123 });
        expect(Object.isFrozen(executionState)).toBe(true);
        expect(error).toBe(botError);
        return failEffect;
      }),
      complete: vi.fn(),
    } as any;

    const auditEmit = vi.fn();
    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      hooks: {} as any, // onError undefined
      auditPort: { emit: auditEmit },
      auditMapping: {}, // mapFailureAuditEvent undefined
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: false, error: botError })),
      persist: vi.fn(),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps as any);

    await expect(effect(undefined)).rejects.toBe(botError);
    expect(auditEmit).not.toHaveBeenCalled();
    expect(failEffect).toHaveBeenCalledTimes(1);
  });

  it('bounded retry: persist бросает один раз, потом успешно => withBoundedRetry recursion', async () => {
    const persistImpl = vi.fn((_storePort: any, _value: any) => {
      const effect = asEffect(async (_signal?: AbortSignal) => {
        const callIndex = persistImpl.mock.calls.length;
        return callIndex === 1 ? Promise.reject(new Error('persist-once')) : undefined;
      });
      return effect;
    });

    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      retryConfig: { maxRetries: 1 },
      hooks: undefined,
      auditPort: undefined,
      auditMapping: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: 2 })),
      persist: persistImpl,
    };

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);

    const result = await effect(undefined);
    expect(result).toBe(2);
    expect(persistImpl).toHaveBeenCalledTimes(2);
    expect(completeEffect).toHaveBeenCalledTimes(1);
  });

  it('bounded retry: persist всегда бросает при maxAttempts=1 => прокидывает ошибку', async () => {
    const inputError = new Error('persist-fail');

    const persistImpl = vi.fn((_storePort: any, _value: any) =>
      asEffect(async () => {
        throw inputError;
      })
    );

    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const idempotencyPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      retryConfig: { maxRetries: 0 },
      hooks: undefined,
      auditPort: undefined,
      auditMapping: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: 2 })),
      persist: persistImpl,
    };

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input as any, deps as any);

    await expect(effect(undefined)).rejects.toBe(inputError);
    expect(startEffect).toHaveBeenCalledTimes(1);
    expect(completeEffect).not.toHaveBeenCalled();
  });

  it('existing: reconcile returns in_progress => continue => mapping.ok=true, ok', async () => {
    const startEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));
    const persistEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve());
    const completeEffect = vi.fn((_signal?: AbortSignal) => Promise.resolve({} as any));

    const getEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'in_progress',
        startedAt: 6,
        executionState: freeze({ status: 'started' }),
      } as any)
    );

    const reconcileEffect = vi.fn((_signal?: AbortSignal) =>
      Promise.resolve({
        key: 'op-1',
        status: 'in_progress',
        startedAt: 6,
        executionState: freeze({ status: 'started' }),
      } as any)
    );

    const idempotencyPort = {
      get: vi.fn((_key: any) => getEffect),
      reconcile: vi.fn((_key: any) => reconcileEffect),
      startInProgress: vi.fn((_key: any, _startedAtMs: any) => startEffect),
      complete: vi.fn((_key: any, _executionState: any, _result: any) => completeEffect),
      fail: vi.fn(),
    } as any;

    const deps = {
      botsStorePort: {} as any,
      idempotencyPort,
      hooks: undefined,
      auditPort: undefined,
      auditMapping: undefined,
      retryConfig: undefined,
    };

    const input = {
      execute: vi.fn((_signal?: AbortSignal) => Promise.resolve({ raw: 1 })),
      mapResult: vi.fn(() => freeze({ ok: true, value: 6 })),
      persist: vi.fn((_storePort: any, _value: any) =>
        asEffect(async (_signal?: AbortSignal) => persistEffect(_signal))
      ),
    } as any;

    const ctx = mkCtx({ abortSignal: new AbortController().signal });
    const effect = executeLifecyclePipeline(ctx, input, deps as any);

    const result = await effect(undefined);
    expect(result).toBe(6);
    expect(startEffect).toHaveBeenCalledTimes(1);
  });
});

/* eslint-enable @livai/multiagent/orchestration-safety */
/* eslint-enable @livai/rag/context-leakage */
