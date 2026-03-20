/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import type { Effect } from '@livai/core/effect';

import { withErrorBoundary } from '../../../../../src/effects/shared/lifecycle/error.js';
import type { BotError } from '../../../../../src/types/bots.js';

/* eslint-disable @livai/rag/context-leakage -- unit-тест использует hoisted mock коллбеки */
const deps = vi.hoisted(() => ({
  mapBotErrorToUI: vi.fn(),
}));

vi.mock('../../../../../src/lib/error-mapper.js', () => ({
  mapBotErrorToUI: deps.mapBotErrorToUI,
}));

const asEffect = <T>(impl: (signal?: AbortSignal) => Promise<T>): Effect<T> =>
  impl as unknown as Effect<T>;

const mkCtx = (
  port: {
    get: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
  },
  overrides: Partial<any> = {},
) =>
  ({
    operationId: 'op-1',
    actorId: 'user-1',
    policyMeta: { version: 1, flags: [], segments: [] },
    auditMeta: { eventId: 'evt-1', timestamp: 123 },
    abortSignal: undefined,
    idempotencyPort: port,
    // eslint-disable-next-line @livai/rag/source-citation -- это технический fixture для unit-test
    mapErrorConfig: { source: 'test' } as any,
    ...overrides,
  }) as any;

/* eslint-disable @livai/multiagent/orchestration-safety -- unit-тест: withErrorBoundary не является real-orchestration */
describe('withErrorBoundary (lifecycle/error.ts)', () => {
  it('success: пробрасывает результат и не вызывает idempotencyPort', async () => {
    const port = {
      get: vi.fn(),
      fail: vi.fn(),
    };

    const ctx = mkCtx(port);

    const run = () =>
      asEffect<string>(async (_signal) => {
        return 'ok';
      });

    const signal = new AbortController().signal;
    const effect = withErrorBoundary<string>(ctx, run);

    await expect(effect(signal)).resolves.toBe('ok');
    expect(port.get).not.toHaveBeenCalled();
    expect(port.fail).not.toHaveBeenCalled();
    expect(deps.mapBotErrorToUI).not.toHaveBeenCalled();
  });

  it('error: normalize unknown -> BotError и вызывает idempotencyPort.fail, если status не completed/failed', async () => {
    const botError = Object.freeze({ code: 'BOT_X' }) as unknown as BotError;
    deps.mapBotErrorToUI.mockReturnValue(botError);

    const port = {
      get: vi.fn((_key: unknown) =>
        asEffect(async () =>
          ({
            status: 'in_progress',
          }) as any
        )
      ),
      fail: vi.fn((_key: unknown, executionState: any, error: any) =>
        asEffect(async () => {
          expect(executionState).toEqual({ status: 'aborted', abortedAt: 123 });
          expect(error).toBe(botError);
        })
      ),
    };

    const ctx = mkCtx(port);

    const run = () =>
      asEffect<string>(async () => {
        throw new Error('boom');
      });

    const effect = withErrorBoundary<string>(ctx, run);
    await expect(effect(undefined)).rejects.toBe(botError);

    expect(deps.mapBotErrorToUI).toHaveBeenCalledTimes(1);
    expect(port.get).toHaveBeenCalledTimes(1);
    expect(port.fail).toHaveBeenCalledTimes(1);
  });

  it('error: не вызывает idempotencyPort.fail, если idempotency record уже completed', async () => {
    const botError = Object.freeze({ code: 'BOT_X' }) as unknown as BotError;
    deps.mapBotErrorToUI.mockReturnValue(botError);

    const port = {
      get: vi.fn((_key: unknown) =>
        asEffect(async () =>
          ({
            status: 'completed',
            completedAt: 1,
          }) as any
        )
      ),
      fail: vi.fn((_key: unknown) => asEffect(async () => {})),
    };

    const ctx = mkCtx(port);

    const run = () =>
      asEffect<string>(async () => {
        throw 'unknown';
      });

    const effect = withErrorBoundary<string>(ctx, run);
    await expect(effect(undefined)).rejects.toBe(botError);

    expect(port.get).toHaveBeenCalledTimes(1);
    expect(port.fail).not.toHaveBeenCalled();
  });

  it('error: не вызывает idempotencyPort.fail, если idempotency record уже failed', async () => {
    const botError = Object.freeze({ code: 'BOT_X' }) as unknown as BotError;
    deps.mapBotErrorToUI.mockReturnValue(botError);

    const port = {
      get: vi.fn((_key: unknown) =>
        asEffect(async () =>
          ({
            status: 'failed',
            failedAt: 1,
          }) as any
        )
      ),
      fail: vi.fn((_key: unknown) => asEffect(async () => {})),
    };

    const ctx = mkCtx(port);

    const run = () =>
      asEffect<string>(async () => {
        throw new Error('boom-2');
      });

    const effect = withErrorBoundary<string>(ctx, run);
    await expect(effect(undefined)).rejects.toBe(botError);

    expect(port.get).toHaveBeenCalledTimes(1);
    expect(port.fail).not.toHaveBeenCalled();
  });

  it('error: safeFailIdempotency best-effort — если port.get кидает, пробрасываем botError', async () => {
    const botError = Object.freeze({ code: 'BOT_X' }) as unknown as BotError;
    deps.mapBotErrorToUI.mockReturnValue(botError);

    const port = {
      get: vi.fn((_key: unknown) =>
        asEffect(async () => {
          throw new Error('idempotency read failed');
        })
      ),
      fail: vi.fn((_key: unknown) => asEffect(async () => {})),
    };

    const ctx = mkCtx(port);

    const run = () =>
      asEffect<string>(async () => {
        throw new Error('boom-3');
      });

    const effect = withErrorBoundary<string>(ctx, run);
    await expect(effect(undefined)).rejects.toBe(botError);

    expect(port.get).toHaveBeenCalledTimes(1);
    expect(port.fail).not.toHaveBeenCalled();
  });

  it('error: вызывает hooks.onError (rejected promise не ломает flow) и emit failure audit event', async () => {
    const botError = Object.freeze({ code: 'BOT_HOOKS' }) as unknown as BotError;
    deps.mapBotErrorToUI.mockReturnValue(botError);

    const onError = vi.fn(() => Promise.reject(new Error('hook-failed')));
    const mapFailureAuditEvent = vi.fn((_e: BotError) => ({ type: 'fail-audit' }));
    const emit = vi.fn();

    const port = {
      get: vi.fn((_key: unknown) =>
        asEffect(async () =>
          ({
            status: 'in_progress',
          }) as any
        )
      ),
      fail: vi.fn((_key: unknown) => asEffect(async () => {})),
    };

    const ctx = mkCtx(port, {
      hooks: { onError },
      auditPort: { emit },
      auditMapping: { mapFailureAuditEvent },
    });

    const run = () =>
      asEffect<string>(async () => {
        throw new Error('boom-with-hooks');
      });

    const effect = withErrorBoundary<string>(ctx, run);
    await expect(effect(undefined)).rejects.toBe(botError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(botError);
    expect(mapFailureAuditEvent).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ type: 'fail-audit' });
  });

  it('error: audit mapping без mapFailureAuditEvent => early return (emit не вызывается)', async () => {
    const botError = Object.freeze({ code: 'BOT_AUDIT_NONE' }) as unknown as BotError;
    deps.mapBotErrorToUI.mockReturnValue(botError);

    const emit = vi.fn();
    const port = {
      get: vi.fn((_key: unknown) =>
        asEffect(async () =>
          ({
            status: 'in_progress',
          }) as any
        )
      ),
      fail: vi.fn((_key: unknown) => asEffect(async () => {})),
    };

    const ctx = mkCtx(port, {
      hooks: { onError: undefined },
      auditPort: { emit },
      auditMapping: {},
    });

    const run = () =>
      asEffect<string>(async () => {
        throw new Error('boom-no-audit-mapper');
      });

    const effect = withErrorBoundary<string>(ctx, run);
    await expect(effect(undefined)).rejects.toBe(botError);

    expect(emit).not.toHaveBeenCalled();
  });
});
/* eslint-enable @livai/rag/context-leakage */
/* eslint-enable @livai/multiagent/orchestration-safety */
