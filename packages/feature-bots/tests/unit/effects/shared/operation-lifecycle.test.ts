/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Effect } from '@livai/core/effect';

const deps = vi.hoisted(() => ({
  withStoreLock: vi.fn((storePort: unknown, action: () => void) => {
    void storePort;
    action();
  }),
  withErrorBoundary: vi.fn(<TResult, _TAuditEvent>(
    _ctx: unknown,
    fn: () => Effect<TResult>,
  ): Effect<TResult> => fn()),
  executeLifecyclePipeline: vi.fn(<_TRaw, TResult, _TAuditEvent>(
    _ctx: unknown,
    _input: unknown,
    _deps: unknown,
  ) =>
    (async (_signal?: AbortSignal) => {
      void _ctx;
      void _input;
      void _deps;
      return undefined as unknown as TResult;
    }) as Effect<TResult>
  ),
}));

vi.mock('../../../../src/effects/shared/bots-store.port.js', () => ({
  withStoreLock: deps.withStoreLock,
}));

vi.mock('../../../../src/effects/shared/lifecycle/error.js', () => ({
  withErrorBoundary: deps.withErrorBoundary,
}));

vi.mock('../../../../src/effects/shared/lifecycle/pipeline.js', () => ({
  executeLifecyclePipeline: deps.executeLifecyclePipeline,
}));

import { createOperationLifecycleHelper } from '../../../../src/effects/shared/operation-lifecycle.js';

const asEffect = <T>(impl: (signal?: AbortSignal) => Promise<T>): Effect<T> =>
  impl as unknown as Effect<T>;

const mkStorePort = () =>
  ({
    setCreateState: vi.fn(),
    setUpdateState: vi.fn(),
    setDeleteState: vi.fn(),
  }) as any;

const mkBotError = () =>
  Object.freeze({
    code: 'BOT_X',
    category: 'validation',
    severity: 'low',
    retryable: false,
  }) as any;

/* eslint-disable @livai/multiagent/orchestration-safety -- unit-тесты orchestration glue: проверяем wiring/ветвления локально, без runtime orchestrator */
/* eslint-disable @livai/rag/source-citation -- source:'test' и synthetic fixtures используются только для unit-тестов, не для production RAG payload */
describe('operation-lifecycle.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('кидает fail-fast, если заданы и idempotencyPort и idempotencyPortFactory', () => {
    const storePort = mkStorePort();
    const idempotencyPort = {} as any;

    expect(() =>
      createOperationLifecycleHelper({
        storePort,
        mapErrorConfig: { source: 'test' } as any,
        idempotencyPort,
        idempotencyPortFactory: () => idempotencyPort,
      })
    ).toThrow('Provide either idempotencyPort OR idempotencyPortFactory, not both');
  });

  it('create runOperation: no lock, map+persist+hooks wired and withErrorBoundary/pipeline invoked', async () => {
    const storePort = mkStorePort();
    const now = vi.fn(() => 1000);

    deps.executeLifecyclePipeline.mockImplementationOnce((
      ctx: any,
      input: any,
      pipelineDeps: any,
    ) =>
      asEffect(async (signal?: AbortSignal) => {
        expect(ctx.operationId).toBe('create:1000:1');
        expect(ctx.auditMeta).toEqual({ eventId: 'lifecycle:create:1', timestamp: 1000 });
        expect(ctx.actorId).toBe('system');
        expect(ctx.traceId).toBeUndefined();
        expect(signal).toBeUndefined();

        await input.execute(signal);
        const mapped = input.mapResult(123);
        expect(mapped).toEqual({ ok: true, value: 123 });
        await input.persist(pipelineDeps.botsStorePort, 123)(signal);

        pipelineDeps.hooks.onSuccess?.(123);
        pipelineDeps.hooks.onError?.(mkBotError());

        return 123;
      })
    );

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      now,
    });

    const setSuccessState = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const run = vi.fn(async (_signal?: AbortSignal) => 123);

    const effect = helper.runOperation<number>({
      operation: 'create',
      run,
      setSuccessState,
      onSuccess,
      onFailure,
      mapSuccessAuditEvent: (result) => ({ t: 'ok', result }),
      mapFailureAuditEvent: (error) => ({ t: 'err', code: error.code }),
    });

    const result = await effect(undefined);
    expect(result).toBe(123);

    expect(storePort.setCreateState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'create',
    });
    expect(setSuccessState).toHaveBeenCalledWith(storePort, 123);
    expect(onSuccess).toHaveBeenCalledWith(123);
    expect(storePort.setCreateState).toHaveBeenCalledWith({ status: 'error', error: mkBotError() });
    expect(onFailure).toHaveBeenCalledWith(mkBotError());
    expect(deps.withStoreLock).not.toHaveBeenCalled();
    expect(deps.withErrorBoundary).toHaveBeenCalledTimes(1);
    expect(deps.executeLifecyclePipeline).toHaveBeenCalledTimes(1);
  });

  it('update/delete handlers with useStoreLock=true вызывают withStoreLock и default setError', async () => {
    const storePort = mkStorePort();
    const now = vi.fn(() => 2000);

    deps.executeLifecyclePipeline.mockImplementation((_ctx: any, input: any, pipelineDeps: any) =>
      asEffect(async (signal?: AbortSignal) => {
        void _ctx;
        await input.execute(signal);
        const mapped = input.mapResult('ok');
        await input.persist(pipelineDeps.botsStorePort, mapped.value)(signal);
        pipelineDeps.hooks.onError?.(mkBotError());
        return mapped.value;
      })
    );

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      now,
    });

    const run = vi.fn(async (_signal?: AbortSignal) => 'ok');

    await helper.runOperation<string>({
      operation: 'update',
      useStoreLock: true,
      run,
    })(undefined);

    await helper.runOperation<string>({
      operation: 'delete',
      useStoreLock: true,
      run,
    })(undefined);

    expect(storePort.setUpdateState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'update',
    });
    expect(storePort.setUpdateState).toHaveBeenCalledWith({ status: 'error', error: mkBotError() });
    expect(storePort.setDeleteState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'delete',
    });
    expect(storePort.setDeleteState).toHaveBeenCalledWith({ status: 'error', error: mkBotError() });
    expect(deps.withStoreLock).toHaveBeenCalled();
  });

  it('idempotencyPortFactory branch: использует factory<TResult> вместо default/injected', async () => {
    const storePort = mkStorePort();
    const factoryPort = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _s: any) => asEffect(async () => ({} as any))),
      complete: vi.fn((_key: any, _e: any, _r: any) => asEffect(async () => ({} as any))),
      fail: vi.fn((_key: any, _e: any, _err: any) => asEffect(async () => ({} as any))),
    } as any;

    const idempotencyPortFactory = vi.fn(<TResult>() => {
      void (undefined as unknown as TResult);
      return factoryPort;
    });

    deps.executeLifecyclePipeline.mockImplementationOnce((
      _ctx: any,
      input: any,
      pipelineDeps: any,
    ) =>
      asEffect(async (signal?: AbortSignal) => {
        void _ctx;
        expect(pipelineDeps.idempotencyPort).toBe(factoryPort);
        await input.execute(signal);
        return 1;
      })
    );

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      idempotencyPortFactory,
    });

    const result = await helper.runOperation<number>({
      operation: 'create',
      run: asEffect(async () => 1),
      idempotencyKey: 'idem-1' as any,
    })(undefined);

    expect(result).toBe(1);
    expect(idempotencyPortFactory).toHaveBeenCalledTimes(1);
  });

  it('in-memory idempotency default shared across calls, and injected port branch', async () => {
    const storePort = mkStorePort();

    const injected = {
      get: vi.fn((_key: any) => asEffect(async () => null)),
      startInProgress: vi.fn((_key: any, _s: any) => asEffect(async () => ({} as any))),
      complete: vi.fn((_key: any, _e: any, _r: any) => asEffect(async () => ({} as any))),
      fail: vi.fn((_key: any, _e: any, _err: any) => asEffect(async () => ({} as any))),
    } as any;

    deps.executeLifecyclePipeline
      .mockImplementationOnce((_ctx: any, _input: any, pipelineDeps: any) =>
        asEffect(async () => {
          expect(pipelineDeps.idempotencyPort).toBe(injected);
          return 11;
        })
      )
      .mockImplementationOnce((_ctx: any, _input: any, pipelineDeps: any) =>
        asEffect(async () => {
          // второй helper без injected/factory — проверяем, что порт между вызовами один и тот же
          const p = pipelineDeps.idempotencyPort;
          await p.startInProgress('k1', 1)();
          await p.complete('k1', { status: 'finalized' }, 777)();
          const got = await p.get('k1')();
          expect(got?.status).toBe('completed');
          return 22;
        })
      )
      .mockImplementationOnce((_ctx: any, _input: any, pipelineDeps: any) =>
        asEffect(async () => {
          const p = pipelineDeps.idempotencyPort;
          const got = await p.get('k1')();
          expect(got?.status).toBe('completed');
          return 33;
        })
      );

    const helperInjected = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      idempotencyPort: injected,
    });

    const helperDefault = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      now: () => 1,
    });

    await helperInjected.runOperation<number>({
      operation: 'create',
      run: asEffect(async () => 11),
    })(undefined);

    const r1 = await helperDefault.runOperation<number>({
      operation: 'create',
      run: asEffect(async () => 22),
    })(undefined);
    const r2 = await helperDefault.runOperation<number>({
      operation: 'create',
      run: asEffect(async () => 33),
    })(undefined);

    expect(r1).toBe(22);
    expect(r2).toBe(33);
  });

  it('in-memory idempotency: покрывает startInProgress/complete/fail ветки existing completed/failed и fail-new', async () => {
    const storePort = mkStorePort();
    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      now: () => 5000,
    });

    const botError = mkBotError();

    deps.executeLifecyclePipeline
      .mockImplementationOnce((_ctx: any, _input: any, pipelineDeps: any) =>
        asEffect(async () => {
          const p = pipelineDeps.idempotencyPort;

          // new -> in_progress -> completed
          const r1 = await p.startInProgress('k2', 10)();
          expect(r1.status).toBe('in_progress');

          const c1 = await p.complete('k2', { status: 'finalized' }, 1)();
          expect(c1.status).toBe('completed');

          // existing completed branch in startInProgress
          const r2 = await p.startInProgress('k2', 20)();
          expect(r2.status).toBe('completed');

          // existing completed branch in fail
          const f1 = await p.fail('k2', { status: 'aborted', abortedAt: 1 }, botError)();
          expect(f1.status).toBe('completed');

          // existing completed branch in complete (idempotent)
          const c2 = await p.complete('k2', { status: 'finalized' }, 2)();
          expect(c2.status).toBe('completed');

          // new -> failed
          const f2 = await p.fail('k3', { status: 'aborted', abortedAt: 2 }, botError)();
          expect(f2.status).toBe('failed');

          // existing failed branch in complete
          const c3 = await p.complete('k3', { status: 'finalized' }, 3)();
          expect(c3.status).toBe('failed');

          // existing failed branch in startInProgress
          const r3 = await p.startInProgress('k3', 30)();
          expect(r3.status).toBe('failed');

          // existing failed branch in fail
          const f3 = await p.fail('k3', { status: 'aborted', abortedAt: 3 }, botError)();
          expect(f3.status).toBe('failed');

          return 44;
        })
      );

    const result = await helper.runOperation<number>({
      operation: 'create',
      run: asEffect(async () => 44),
    })(undefined);

    expect(result).toBe(44);
  });

  it('mappingConfig: только mapSuccessAuditEvent и persist with lock+setSuccessState', async () => {
    const storePort = mkStorePort();
    const setSuccessState = vi.fn();

    deps.executeLifecyclePipeline.mockImplementationOnce((
      _ctx: any,
      input: any,
      pipelineDeps: any,
    ) =>
      asEffect(async (signal?: AbortSignal) => {
        const value = await input.execute(signal);
        await input.persist(pipelineDeps.botsStorePort, value)(signal);
        expect(setSuccessState).toHaveBeenCalledWith(storePort, value);
        return value;
      })
    );

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      now: () => 3000,
    });

    const run = asEffect(async () => 55);
    const result = await helper.runOperation<number>({
      operation: 'update',
      useStoreLock: true,
      run,
      setSuccessState,
      mapSuccessAuditEvent: (r) => ({ s: r }),
      // mapFailureAuditEvent intentionally omitted to cover cond branch
    })(undefined);

    expect(result).toBe(55);
    expect(deps.withStoreLock).toHaveBeenCalled();
  });

  it('mappingConfig: только mapFailureAuditEvent', async () => {
    const storePort = mkStorePort();

    deps.executeLifecyclePipeline.mockImplementationOnce((
      _ctx: any,
      _input: any,
      _pipelineDeps: any,
    ) => asEffect(async () => 66));

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      now: () => 3100,
    });

    const result = await helper.runOperation<number>({
      operation: 'delete',
      run: asEffect(async () => 66),
      mapFailureAuditEvent: (e) => ({ c: e.code }),
      // mapSuccessAuditEvent intentionally omitted to cover cond branch
    })(undefined);

    expect(result).toBe(66);
  });

  it('operationHandlers with explicit undefined uses DEFAULT handlers (?? fallback branches)', async () => {
    const storePort = mkStorePort();

    deps.executeLifecyclePipeline.mockImplementation((_ctx: any, input: any) =>
      asEffect(async () => {
        await input.execute(undefined);
        return 1;
      })
    );

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      operationHandlers: {
        create: undefined,
        update: undefined,
        delete: undefined,
      } as any,
    });

    await helper.runOperation<number>({
      operation: 'create',
      run: asEffect(async () => 1),
    })(undefined);
    await helper.runOperation<number>({
      operation: 'update',
      run: asEffect(async () => 1),
    })(undefined);
    await helper.runOperation<number>({
      operation: 'delete',
      run: asEffect(async () => 1),
    })(undefined);

    expect(storePort.setCreateState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'create',
    });
    expect(storePort.setUpdateState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'update',
    });
    expect(storePort.setDeleteState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'delete',
    });
  });

  it('unsupported operation throws from resolveOperationHandler default branch', async () => {
    const storePort = mkStorePort();
    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
    });

    expect(() =>
      helper.runOperation<number>({
        operation: 'x' as any,
        run: asEffect(async () => 1),
      })
    ).toThrow('Unsupported operation: x');
  });
});
/* eslint-enable @livai/rag/source-citation */
/* eslint-enable @livai/multiagent/orchestration-safety */
