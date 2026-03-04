/**
 * @vitest-environment jsdom
 * @file Unit тесты для useAuth
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseAuthDeps, UseAuthResult, UseAuthStorePort } from '../../../src/hooks/useAuth';
import { useAuth } from '../../../src/hooks/useAuth';

type TestAuthState = {
  readonly status: 'anonymous' | 'authenticated';
  readonly userId?: string;
};

type TestAuthStore = UseAuthStorePort & {
  readonly setState: (next: TestAuthState) => void;
};

const createTestAuthStore = (initialState: TestAuthState): TestAuthStore => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getAuthState: () => state as never,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState: (next: TestAuthState) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
};

describe('useAuth', () => {
  const initialState: TestAuthState = { status: 'anonymous' };
  const authenticatedState: TestAuthState = { status: 'authenticated', userId: 'user-1' };

  let authStore: TestAuthStore;
  let loginEffect: UseAuthDeps['loginEffect'];
  let logoutEffect: UseAuthDeps['logoutEffect'];
  let registerEffect: UseAuthDeps['registerEffect'];
  let refreshEffect: UseAuthDeps['refreshEffect'];
  let deps: UseAuthDeps;

  beforeEach(() => {
    authStore = createTestAuthStore(initialState);

    loginEffect = vi.fn(async (request: unknown) => ({
      kind: 'login',
      request,
    })) as unknown as UseAuthDeps['loginEffect'];
    logoutEffect = vi.fn(async () => ({
      kind: 'logout',
    })) as unknown as UseAuthDeps['logoutEffect'];
    registerEffect = vi.fn(async (request: unknown) => ({
      kind: 'register',
      request,
    })) as unknown as UseAuthDeps['registerEffect'];
    refreshEffect = vi.fn(async () => ({
      kind: 'refresh',
    })) as unknown as UseAuthDeps['refreshEffect'];

    deps = {
      authStore,
      loginEffect,
      logoutEffect,
      registerEffect,
      refreshEffect,
    };

    vi.clearAllMocks();
  });

  it('подписывается на store и возвращает актуальное authState', () => {
    const { result } = renderHook(() => useAuth(deps));

    expect(result.current.authState).toEqual(initialState);

    act(() => {
      authStore.setState(authenticatedState);
    });

    expect(result.current.authState).toEqual(authenticatedState);
  });

  it('делегирует вызовы login/logout/register/refresh в соответствующие эффекты', async () => {
    const { result } = renderHook(() => useAuth(deps));

    const loginRequest = { identifier: 'user@example.com' };
    const registerRequest = { identifier: 'new@example.com' };

    const loginResult = await result.current.login(loginRequest as never);
    const logoutResult = await result.current.logout();
    const registerResult = await result.current.register(registerRequest as never);
    const refreshResult = await result.current.refresh();

    expect(loginEffect).toHaveBeenCalledTimes(1);
    expect(loginEffect).toHaveBeenCalledWith(loginRequest);
    expect(loginResult).toEqual({ kind: 'login', request: loginRequest });

    expect(logoutEffect).toHaveBeenCalledTimes(1);
    expect(logoutResult).toEqual({ kind: 'logout' });

    expect(registerEffect).toHaveBeenCalledTimes(1);
    expect(registerEffect).toHaveBeenCalledWith(registerRequest);
    expect(registerResult).toEqual({ kind: 'register', request: registerRequest });

    expect(refreshEffect).toHaveBeenCalledTimes(1);
    expect(refreshResult).toEqual({ kind: 'refresh' });
  });

  it('возвращает стабильные функции и мемоизированный результат между рендерами', () => {
    const { result, rerender } = renderHook(() => useAuth(deps));

    const first: UseAuthResult = result.current;

    rerender();

    const second: UseAuthResult = result.current;

    expect(first.login).toBe(second.login);
    expect(first.logout).toBe(second.logout);
    expect(first.register).toBe(second.register);
    expect(first.refresh).toBe(second.refresh);
    expect(first).toBe(second);
  });
});
