/**
 * @file Unit тесты для access-control/auth-guard.react.tsx
 */

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Action, AuthDecision, Resource } from '../../src/access-control/auth-guard.js';
import type { AuthGuardContext } from '../../src/access-control/auth-guard.react.js';
import {
  AuthGuardProvider,
  useAuthGuardContext,
  useCheckAccess,
  useMemoizedCheckAccess,
} from '../../src/access-control/auth-guard.react.js';

// Мокаем checkAccess из core-guard, чтобы контролировать решения
const checkAccessMock = vi.hoisted(() =>
  vi.fn<(action: Action, resource: Resource, context: AuthGuardContext) => AuthDecision>()
);

vi.mock('../../src/access-control/auth-guard.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/access-control/auth-guard.js')>(
    '../../src/access-control/auth-guard.js',
  );

  return {
    ...actual,
    checkAccess: checkAccessMock,
  };
});

const BASE_CONTEXT: AuthGuardContext = {
  requestId: 'req-1',
  isAuthenticated: true,
  userId: 'user-1' as any,
  roles: new Set(),
  permissions: new Set(),
};

const makeWrapper =
  (context: AuthGuardContext) => ({ children }: { readonly children: React.ReactNode; }) => (
    <AuthGuardProvider value={context}>{children}</AuthGuardProvider>
  );

describe('AuthGuardProvider / useAuthGuardContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('прокидывает value в контекст', () => {
    const contextValue: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-42',
      traceId: 'trace-123',
    };

    const wrapper = makeWrapper(contextValue);
    const { result } = renderHook(() => useAuthGuardContext(), { wrapper });

    expect(result.current).toBe(contextValue);
    expect(result.current.requestId).toBe('req-42');
    expect(result.current.traceId).toBe('trace-123');
  });

  it('бросает понятную ошибку, если используется вне AuthGuardProvider', () => {
    // renderHook в @testing-library/react ловит ошибки синхронно
    const catchError = (): Error | undefined => {
      try {
        renderHook(() => useAuthGuardContext());
        return undefined;
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e));
      }
    };

    const error = catchError();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('useAuthGuardContext must be used within an AuthGuardProvider');
  });
});

describe('useCheckAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('делегирует в checkAccess с текущим контекстом', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-check',
    };
    const wrapper = makeWrapper(context);

    const action: Action = 'READ';
    const resource: Resource = { type: 'public' };
    const decision: AuthDecision = { allow: true, reason: 'SUCCESS' };

    checkAccessMock.mockReturnValueOnce(decision);

    const { result } = renderHook(() => useCheckAccess(action, resource), { wrapper });

    expect(checkAccessMock).toHaveBeenCalledWith(action, resource, context);
    expect(checkAccessMock).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(decision);
  });
});

describe('useMemoizedCheckAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('вызывает checkAccess и кеширует решение по ключу', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-memo',
    };
    const wrapper = makeWrapper(context);

    const action: Action = 'READ';
    const resource: Resource = { type: 'public' };
    const decision: AuthDecision = { allow: true, reason: 'SUCCESS' };

    checkAccessMock.mockReturnValue(decision);

    const { result, rerender } = renderHook(
      (props: { action: Action; resource: Resource; }) =>
        useMemoizedCheckAccess(props.action, props.resource),
      {
        initialProps: { action, resource },
        wrapper,
      },
    );

    expect(result.current).toEqual(decision);
    expect(checkAccessMock).toHaveBeenCalledTimes(1);
    expect(checkAccessMock).toHaveBeenCalledWith(action, resource, context);

    // Повторный render с теми же props должен использовать кеш и не вызывать checkAccess повторно
    rerender({ action, resource });
    expect(result.current).toEqual(decision);
    expect(checkAccessMock).toHaveBeenCalledTimes(1);
  });

  it('вызывает onDecision как для свежего решения, так и для кешированного', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-callback',
    };
    const wrapper = makeWrapper(context);

    const action: Action = 'READ';
    const resource: Resource = { type: 'public' };
    const decision: AuthDecision = { allow: true, reason: 'SUCCESS' };

    const onDecision = vi.fn();

    checkAccessMock.mockReturnValue(decision);

    const { rerender } = renderHook(
      (props: { action: Action; resource: Resource; }) =>
        useMemoizedCheckAccess(props.action, props.resource, { onDecision }),
      {
        initialProps: { action, resource },
        wrapper,
      },
    );

    // Первый вызов — свежий результат (может быть вызван несколько раз из-за StrictMode)
    expect(onDecision).toHaveBeenCalled();
    const firstCallArg = onDecision.mock.calls[onDecision.mock.calls.length - 1]?.[0];
    expect(firstCallArg).toEqual(decision);

    const callCountBeforeRerender = onDecision.mock.calls.length;

    // Второй вызов — из кеша
    rerender({ action, resource });
    expect(onDecision.mock.calls.length).toBeGreaterThan(callCountBeforeRerender);
    const lastCallArg = onDecision.mock.calls[onDecision.mock.calls.length - 1]?.[0];
    expect(lastCallArg).toEqual(decision);
  });

  it('создаёт разные кеш-ключи для разных ресурсов и действий', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-keys',
    };
    const wrapper = makeWrapper(context);

    const decisionAllow: AuthDecision = { allow: true, reason: 'SUCCESS' };

    checkAccessMock.mockReturnValue(decisionAllow);

    const resourcePublic: Resource = { type: 'public' };
    const resourcePrivate: Resource = { type: 'private', id: 'res-1' as any };

    const { rerender } = renderHook(
      (props: { action: Action; resource: Resource; }) =>
        useMemoizedCheckAccess(props.action, props.resource),
      {
        initialProps: { action: 'READ', resource: resourcePublic },
        wrapper,
      },
    );

    // READ public
    expect(checkAccessMock).toHaveBeenCalledTimes(1);
    expect(checkAccessMock).toHaveBeenCalledWith('READ', resourcePublic, context);

    // READ private — новый ключ
    rerender({ action: 'READ', resource: resourcePrivate });
    expect(checkAccessMock).toHaveBeenCalledTimes(2);
    expect(checkAccessMock).toHaveBeenCalledWith('READ', resourcePrivate, context);

    // WRITE private — ещё один новый ключ
    rerender({ action: 'WRITE', resource: resourcePrivate });
    expect(checkAccessMock).toHaveBeenCalledTimes(3);
    expect(checkAccessMock).toHaveBeenCalledWith('WRITE', resourcePrivate, context);
  });

  it('создаёт разные ключи для ресурсов с разными id', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-ids',
    };
    const wrapper = makeWrapper(context);

    const decisionAllow: AuthDecision = { allow: true, reason: 'SUCCESS' };

    checkAccessMock.mockReturnValue(decisionAllow);

    const resource1: Resource = { type: 'private', id: 'res-1' as any };
    const resource2: Resource = { type: 'private', id: 'res-2' as any };

    const { rerender } = renderHook(
      (props: { action: Action; resource: Resource; }) =>
        useMemoizedCheckAccess(props.action, props.resource),
      {
        initialProps: { action: 'READ', resource: resource1 },
        wrapper,
      },
    );

    // READ res-1
    expect(checkAccessMock).toHaveBeenCalledTimes(1);

    // READ res-2 — новый ключ из-за другого id
    rerender({ action: 'READ', resource: resource2 });
    expect(checkAccessMock).toHaveBeenCalledTimes(2);
  });

  it('не вызывает onDecision если options не передан', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-no-callback',
    };
    const wrapper = makeWrapper(context);

    const action: Action = 'READ';
    const resource: Resource = { type: 'public' };
    const decision: AuthDecision = { allow: true, reason: 'SUCCESS' };

    checkAccessMock.mockReturnValue(decision);

    const { result } = renderHook(
      (props: { action: Action; resource: Resource; }) =>
        useMemoizedCheckAccess(props.action, props.resource),
      {
        initialProps: { action, resource },
        wrapper,
      },
    );

    expect(result.current).toEqual(decision);
    expect(checkAccessMock).toHaveBeenCalledTimes(1);
  });

  it('не обновляет кеш если ключ уже существует (покрывает ветку previous[key] !== undefined)', () => {
    const context: AuthGuardContext = {
      ...BASE_CONTEXT,
      requestId: 'req-cache-update',
    };
    const wrapper = makeWrapper(context);

    const action: Action = 'READ';
    const resource: Resource = { type: 'public' };
    const decision1: AuthDecision = { allow: true, reason: 'SUCCESS' };
    const decision2: AuthDecision = { allow: false, reason: 'RESOURCE_ACCESS_DENIED' };

    checkAccessMock.mockReturnValueOnce(decision1).mockReturnValueOnce(decision2);

    const { result, rerender } = renderHook(
      (props: { action: Action; resource: Resource; }) =>
        useMemoizedCheckAccess(props.action, props.resource),
      {
        initialProps: { action, resource },
        wrapper,
      },
    );

    const firstResult = result.current;
    expect(firstResult).toEqual(decision1);

    // Первый rerender — должен использовать кеш, не вызывать checkAccess
    rerender({ action, resource });
    expect(result.current).toBe(firstResult);
    expect(checkAccessMock).toHaveBeenCalledTimes(1);

    // Второй rerender — всё ещё кеш
    rerender({ action, resource });
    expect(result.current).toBe(firstResult);
    expect(checkAccessMock).toHaveBeenCalledTimes(1);
  });
});
