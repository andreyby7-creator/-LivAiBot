/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  mapBotErrorToUI: vi.fn(),
  withStoreLock: vi.fn((_storePort: unknown, action: () => void) => action()),
}));

vi.mock('../../../../src/lib/error-mapper.js', () => ({
  mapBotErrorToUI: deps.mapBotErrorToUI,
}));

vi.mock('../../../../src/effects/shared/bots-store.port.js', () => ({
  withStoreLock: deps.withStoreLock,
}));

import { createOperationLifecycleHelper } from '../../../../src/effects/shared/operation-lifecycle.helper.js';

/* eslint-disable @livai/multiagent/orchestration-safety -- локальные unit-тесты lifecycle helper, без orchestration runtime */
/* eslint-disable @livai/rag/source-citation -- В unit-тестах `mapErrorConfig.source = "test"` это технический стаб,
 * а не ссылка на внешний RAG-источник. Правило применимо к production-пейлоадам/док-цитированию, не к test fixtures. */
describe('operation-lifecycle.helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createStorePort = () =>
    ({
      setCreateState: vi.fn(),
      setUpdateState: vi.fn(),
      setDeleteState: vi.fn(),
    }) as any;

  it('успешный сценарий: create выставляет loading, вызывает success hooks и success audit', async () => {
    const storePort = createStorePort();
    const auditPort = { emit: vi.fn() };

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      auditPort,
    });

    const setSuccessState = vi.fn();
    const onSuccess = vi.fn();
    const mapSuccessAuditEvent = vi.fn((r: number) => ({ type: 'ok', r }));
    const run = vi.fn(async () => 42);

    const effect = helper.runOperation({
      operation: 'create',
      run,
      setSuccessState,
      onSuccess,
      mapSuccessAuditEvent,
    });

    const result = await effect(undefined);
    expect(result).toBe(42);
    expect(storePort.setCreateState).toHaveBeenNthCalledWith(1, {
      status: 'loading',
      operation: 'create',
    });
    expect(setSuccessState).toHaveBeenCalledWith(storePort, 42);
    expect(onSuccess).toHaveBeenCalledWith(42);
    expect(mapSuccessAuditEvent).toHaveBeenCalledWith(42);
    expect(auditPort.emit).toHaveBeenCalledWith({ type: 'ok', r: 42 });
    expect(deps.withStoreLock).not.toHaveBeenCalled();
  });

  it('успешный сценарий с useStoreLock=true: использует withStoreLock для loading и success', async () => {
    const storePort = createStorePort();
    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
    });

    const effect = helper.runOperation({
      operation: 'delete',
      useStoreLock: true,
      run: async () => 'done',
    });

    const result = await effect(undefined);
    expect(result).toBe('done');
    expect(deps.withStoreLock).toHaveBeenCalledTimes(2);
    expect(storePort.setDeleteState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'delete',
    });
  });

  it('ошибка: update маппит ошибку, выставляет error, вызывает hooks и failure audit', async () => {
    const storePort = createStorePort();
    const auditPort = { emit: vi.fn() };
    const mappedError = Object.freeze({ code: 'BOT_X', message: 'mapped' });
    deps.mapBotErrorToUI.mockReturnValue(mappedError);

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      auditPort,
    });

    const onFailure = vi.fn();
    const mapFailureAuditEvent = vi.fn((e: any) => ({ type: 'err', code: e.code }));

    const effect = helper.runOperation({
      operation: 'update',
      run: async () => {
        throw new Error('boom');
      },
      onFailure,
      mapFailureAuditEvent,
    });

    await expect(effect(undefined)).rejects.toBe(mappedError);
    expect(deps.mapBotErrorToUI).toHaveBeenCalled();
    expect(storePort.setUpdateState).toHaveBeenCalledWith({
      status: 'loading',
      operation: 'update',
    });
    expect(storePort.setUpdateState).toHaveBeenCalledWith({ status: 'error', error: mappedError });
    expect(onFailure).toHaveBeenCalledWith(mappedError);
    expect(mapFailureAuditEvent).toHaveBeenCalledWith(mappedError);
    expect(auditPort.emit).toHaveBeenCalledWith({ type: 'err', code: 'BOT_X' });
  });

  it('ошибка: create использует дефолтный create.setError handler', async () => {
    const storePort = createStorePort();
    const mappedError = Object.freeze({ code: 'BOT_CREATE_ERR' });
    deps.mapBotErrorToUI.mockReturnValue(mappedError);

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
    });

    const effect = helper.runOperation({
      operation: 'create',
      run: async () => {
        throw new Error('fail-create');
      },
    });

    await expect(effect(undefined)).rejects.toBe(mappedError);
    expect(storePort.setCreateState).toHaveBeenCalledWith({ status: 'error', error: mappedError });
  });

  it('ошибка с useStoreLock=true и без failure audit mapper', async () => {
    const storePort = createStorePort();
    const mappedError = Object.freeze({ code: 'BOT_Y' });
    deps.mapBotErrorToUI.mockReturnValue(mappedError);

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      auditPort: { emit: vi.fn() },
    });

    const effect = helper.runOperation({
      operation: 'delete',
      useStoreLock: true,
      run: async () => {
        throw 'x';
      },
    });

    await expect(effect(undefined)).rejects.toBe(mappedError);
    expect(deps.withStoreLock).toHaveBeenCalledTimes(2);
    expect(storePort.setDeleteState).toHaveBeenCalledWith({ status: 'error', error: mappedError });
  });

  it('кидает ошибку, если handler операции отсутствует (fail-fast на misconfiguration)', async () => {
    const storePort = createStorePort();
    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
    });

    const effect = helper.runOperation({
      operation: 'unknown' as any,
      run: async () => 1,
    });

    await expect(effect(undefined)).rejects.toThrow('No handler defined for operation "unknown"');
  });

  it('использует переопределенный handler из config.operationHandlers', async () => {
    const storePort = createStorePort();
    const customSetLoading = vi.fn();
    const customSetError = vi.fn();
    const mappedError = Object.freeze({ code: 'BOT_Z' });
    deps.mapBotErrorToUI.mockReturnValue(mappedError);

    const helper = createOperationLifecycleHelper({
      storePort,
      mapErrorConfig: { source: 'test' } as any,
      operationHandlers: {
        create: {
          setLoading: customSetLoading,
          setError: customSetError,
        },
      },
    });

    const effect = helper.runOperation({
      operation: 'create',
      run: async () => {
        throw new Error('x');
      },
    });

    await expect(effect(undefined)).rejects.toBe(mappedError);
    expect(customSetLoading).toHaveBeenCalledWith(storePort);
    expect(customSetError).toHaveBeenCalledWith(storePort, mappedError);
    expect(storePort.setCreateState).not.toHaveBeenCalled();
  });
});
/* eslint-enable @livai/rag/source-citation */
/* eslint-enable @livai/multiagent/orchestration-safety */
