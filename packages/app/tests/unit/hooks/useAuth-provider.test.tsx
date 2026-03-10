/**
 * @vitest-environment jsdom
 * @file Unit tests for packages/app/src/hooks/useAuth-provider.tsx
 */

import { act, render, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthHookProvider, useAuth } from '../../../src/hooks/useAuth-provider.js';
import type { AuthHookDepsConfig } from '../../../src/lib/auth-hook-deps.js';

const authDepsMocks = vi.hoisted(() => ({
  createAuthHookDeps: vi.fn(),
}));

vi.mock('../../../src/lib/auth-hook-deps.js', () => ({
  createAuthHookDeps: authDepsMocks.createAuthHookDeps,
}));

const useAuthDIMocks = vi.hoisted(() => ({
  useAuthDI: vi.fn(),
}));

vi.mock('../../../src/hooks/useAuth.js', () => ({
  useAuth: useAuthDIMocks.useAuthDI,
}));

function createConfig(): AuthHookDepsConfig {
  // В тестах нам не важно наполнение — provider лишь передаёт config в фабрику.
  return {
    login: { config: {} as any, deps: {} as any },
    logout: { config: {} as any, deps: {} as any },
    register: { config: {} as any, deps: {} as any },
    refresh: { config: {} as any, deps: {} as any },
  } as AuthHookDepsConfig;
}

describe('useAuth-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exported AuthHookProvider имеет displayName', () => {
    expect(AuthHookProvider.displayName).toBe('AuthHookProvider');
  });

  it('useAuth бросает ошибку если используется вне AuthHookProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrowError(
      /useAuth must be used within AuthHookProvider/i,
    );
  });

  it('создаёт deps через createAuthHookDeps один раз и делегирует в DI useAuth(deps)', () => {
    const deps = { any: 'deps' };
    const resultFromDI = { ok: true };

    authDepsMocks.createAuthHookDeps.mockReturnValue(deps as any);
    useAuthDIMocks.useAuthDI.mockReturnValue(resultFromDI as any);

    const config = createConfig();

    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <AuthHookProvider config={config}>{children}</AuthHookProvider>
    );

    const { result, rerender } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toBe(resultFromDI);
    expect(authDepsMocks.createAuthHookDeps).toHaveBeenCalledTimes(1);
    expect(authDepsMocks.createAuthHookDeps).toHaveBeenCalledWith(config);
    expect(useAuthDIMocks.useAuthDI).toHaveBeenCalledTimes(1);
    expect(useAuthDIMocks.useAuthDI).toHaveBeenCalledWith(deps);

    // rerender не должен пересоздавать deps из-за useMemo([])
    rerender();
    expect(authDepsMocks.createAuthHookDeps).toHaveBeenCalledTimes(1);
  });

  it('в dev бросает ошибку если config identity изменился между рендерами', () => {
    vi.stubEnv('NODE_ENV', 'test');

    authDepsMocks.createAuthHookDeps.mockReturnValue({} as any);
    useAuthDIMocks.useAuthDI.mockReturnValue({} as any);

    const config1 = createConfig();
    const config2 = createConfig();

    let setConfig!: (next: AuthHookDepsConfig) => void;

    const Child = () => {
      useAuth();
      return null;
    };

    const ConfigSwitcher: React.FC = () => {
      const [config, _setConfig] = React.useState(config1);
      setConfig = _setConfig;
      return (
        <AuthHookProvider config={config}>
          <Child />
        </AuthHookProvider>
      );
    };

    render(<ConfigSwitcher />);

    expect(() => {
      act(() => setConfig(config2));
    }).toThrowError(/config must be stable/i);
  });

  it('в production не валидирует identity config (не бросает при смене config)', () => {
    vi.stubEnv('NODE_ENV', 'production');

    authDepsMocks.createAuthHookDeps.mockReturnValue({} as any);
    useAuthDIMocks.useAuthDI.mockReturnValue({} as any);

    const config1 = createConfig();
    const config2 = createConfig();

    let setConfig!: (next: AuthHookDepsConfig) => void;

    const Child = () => {
      useAuth();
      return null;
    };

    const ConfigSwitcher: React.FC = () => {
      const [config, _setConfig] = React.useState(config1);
      setConfig = _setConfig;
      return (
        <AuthHookProvider config={config}>
          <Child />
        </AuthHookProvider>
      );
    };

    render(<ConfigSwitcher />);

    // В production assert выключен, поэтому смена config не должна бросать.
    expect(() => {
      act(() => setConfig(config2));
    }).not.toThrow();

    // deps создаются только один раз, даже если config поменялся.
    expect(authDepsMocks.createAuthHookDeps).toHaveBeenCalledTimes(1);
  });
});
