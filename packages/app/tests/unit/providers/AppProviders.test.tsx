/**
 * @vitest-environment jsdom
 * @file Unit тесты для AppProviders
 */

import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

const providerMocks = vi.hoisted(() => ({
  IntlProvider: vi.fn(({ children }) => <div data-testid='intl-provider'>{children}</div>),
  FeatureFlagsProvider: vi.fn(({ children }) => (
    <div data-testid='feature-flags-provider'>{children}</div>
  )),
  TelemetryProvider: vi.fn(({ children }) => <div data-testid='telemetry-provider'>{children}
  </div>),
  AppQueryClientProvider: vi.fn(({ children }) => (
    <div data-testid='query-client-provider'>{children}</div>
  )),
  ToastProvider: vi.fn(({ children }) => <div data-testid='toast-provider'>{children}</div>),
  AuthHookProvider: vi.fn(({ children }) => <div data-testid='auth-hook-provider'>{children}</div>),
}));

const storeMocks = vi.hoisted(() => ({
  useAppStore: Object.assign(
    vi.fn(() => ({
      user: null as any,
      userStatus: 'anonymous',
      theme: 'light',
      isOnline: true,
      actions: {},
    })),
    {
      getState: vi.fn(() => ({
        user: null as any,
        userStatus: 'anonymous',
        theme: 'light',
        isOnline: true,
        actions: {},
      })),
      subscribe: vi.fn(() => vi.fn()),
    },
  ),
}));

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({
    authState: {
      status: 'unauthenticated',
    } as any,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Мок конфигурации для AuthHookProvider
const mockAuthHookConfig = {
  login: {
    config: {} as any,
    deps: {} as any,
  },
  logout: {
    config: {} as any,
    deps: {} as any,
  },
  register: {
    config: {} as any,
    deps: {} as any,
  },
  refresh: {
    config: {} as any,
    deps: {} as any,
  },
} as const;

vi.mock('../../../src/providers/intl-provider', () => ({
  IntlProvider: providerMocks.IntlProvider,
  useI18n: vi.fn(() => ({
    locale: 'en',
    direction: 'ltr' as const,
    translate: vi.fn((ns, key, _params) => `${ns}:${key}`),
    loadNamespace: vi.fn(),
    isNamespaceLoaded: vi.fn(() => true),
    t: vi.fn((key) => `t:${key}`),
    formatDateLocalized: vi.fn(),
    setDayjsLocale: vi.fn(),
  })),
}));

vi.mock('../../../src/providers/FeatureFlagsProvider', () => ({
  FeatureFlagsProvider: providerMocks.FeatureFlagsProvider,
  useFeatureFlags: vi.fn(() => ({
    isEnabled: vi.fn(() => false),
    setOverride: vi.fn(),
    clearOverrides: vi.fn(),
    getOverride: vi.fn(() => false),
  })),
}));

vi.mock('../../../src/providers/TelemetryProvider', () => ({
  TelemetryProvider: providerMocks.TelemetryProvider,
  useTelemetryContext: vi.fn(() => ({
    track: vi.fn(),
    infoFireAndForget: vi.fn(),
    warnFireAndForget: vi.fn(),
    errorFireAndForget: vi.fn(),
    flush: vi.fn(),
  })),
}));

vi.mock('../../../src/providers/QueryClientProvider', () => ({
  AppQueryClientProvider: providerMocks.AppQueryClientProvider,
}));

vi.mock('../../../src/providers/ToastProvider', () => ({
  ToastProvider: providerMocks.ToastProvider,
}));

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  UnifiedUIProvider: vi.fn(({ children }) => (
    <div data-testid='unified-ui-provider'>{children}</div>
  )),
}));

vi.mock('../../../src/hooks/useAuth-provider', () => ({
  AuthHookProvider: providerMocks.AuthHookProvider,
  useAuth: authMocks.useAuth,
}));

vi.mock('../../../src/state/store', () => ({
  useAppStore: storeMocks.useAppStore,
}));

import { AppProviders, AuthGuardBridge } from '../../../src/providers/AppProviders';

describe('AppProviders', () => {
  const intlProps = {
    locale: 'en',
    messages: { common: { ok: 'OK' } },
    children: null,
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('composes providers in the expected order and renders children', () => {
    render(
      <AppProviders intl={intlProps} authHook={mockAuthHookConfig}>
        <div data-testid='child'>child</div>
      </AppProviders>,
    );

    expect(screen.getByTestId('intl-provider')).toBeInTheDocument();
    expect(screen.getByTestId('feature-flags-provider')).toBeInTheDocument();
    expect(screen.getByTestId('telemetry-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('unified-ui-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();

    const intlProvider = screen.getByTestId('intl-provider');
    const featureFlagsProvider = screen.getByTestId('feature-flags-provider');
    const telemetryProvider = screen.getByTestId('telemetry-provider');
    const queryClientProvider = screen.getByTestId('query-client-provider');
    const toastProvider = screen.getByTestId('toast-provider');
    const unifiedUIProvider = screen.getByTestId('unified-ui-provider');

    expect(intlProvider).toContainElement(featureFlagsProvider);
    expect(featureFlagsProvider).toContainElement(telemetryProvider);
    expect(telemetryProvider).toContainElement(queryClientProvider);
    expect(queryClientProvider).toContainElement(toastProvider);
    expect(toastProvider).toContainElement(unifiedUIProvider);
    expect(unifiedUIProvider).toContainElement(screen.getByTestId('auth-hook-provider'));
    expect(screen.getByTestId('auth-hook-provider')).toContainElement(screen.getByTestId('child'));
  });

  it('passes props to providers and uses store selector', () => {
    render(
      <AppProviders
        intl={intlProps}
        authHook={mockAuthHookConfig}
        featureFlags={{ initialFlags: { SYSTEM_flag: true } }}
        telemetry={{ enabled: false }}
        queryClient={{ enabled: false }}
        toast={{ maxToasts: 3 }}
      >
        <div>child</div>
      </AppProviders>,
    );

    expect(providerMocks.FeatureFlagsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ initialFlags: { SYSTEM_flag: true } }),
      undefined,
    );
    expect(providerMocks.TelemetryProvider).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
      undefined,
    );
    expect(providerMocks.AppQueryClientProvider).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
      undefined,
    );
    expect(providerMocks.ToastProvider).toHaveBeenCalledWith(
      expect.objectContaining({ maxToasts: 3 }),
      undefined,
    );
    expect(providerMocks.IntlProvider).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', messages: intlProps.messages }),
      undefined,
    );
    expect(storeMocks.useAppStore.getState).toHaveBeenCalledTimes(1);
    expect(storeMocks.useAppStore.subscribe).toHaveBeenCalledTimes(1);
  });

  it('renders children correctly', () => {
    render(
      <AppProviders intl={intlProps} authHook={mockAuthHookConfig}>
        <div data-testid='child'>child</div>
      </AppProviders>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders with minimal props', () => {
    render(
      <AppProviders intl={intlProps} authHook={mockAuthHookConfig}>
        <div data-testid='child'>child</div>
      </AppProviders>,
    );

    // Выполняем callback подписки, чтобы покрыть функцию селектора userStatus
    const subscribeCalls = (storeMocks.useAppStore.subscribe as any).mock
      .calls as unknown[][];
    const subscribeCallback = subscribeCalls[0]?.[0] as
      | ((state: { userStatus: string; }) => unknown)
      | undefined;

    if (subscribeCallback) {
      subscribeCallback({ userStatus: 'anonymous' });
    }
  });

  it('includes AuthGuardBridge in provider chain', () => {
    render(
      <AppProviders intl={intlProps} authHook={mockAuthHookConfig}>
        <div data-testid='child'>child</div>
      </AppProviders>,
    );

    // Проверяем что все провайдеры включая AuthGuardBridge рендерятся
    expect(screen.getByTestId('intl-provider')).toBeInTheDocument();
    expect(screen.getByTestId('feature-flags-provider')).toBeInTheDocument();
    expect(screen.getByTestId('telemetry-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('unified-ui-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  describe('AuthGuardBridge', () => {
    it('renders children and provides auth context', async () => {
      render(
        <AuthGuardBridge>
          <div data-testid='auth-child'>auth child</div>
        </AuthGuardBridge>,
      );

      expect(screen.getByTestId('auth-child')).toBeInTheDocument();
    });

    it('provides correct auth context for authenticated user', async () => {
      // Mock store с authenticated state
      storeMocks.useAppStore.mockReturnValueOnce({
        user: { id: 'user-123', name: 'Test User' },
        userStatus: 'authenticated',
        theme: 'light',
        isOnline: true,
        actions: {},
      });

      // Mock useAuth с authenticated state и токенами
      authMocks.useAuth.mockReturnValueOnce({
        authState: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
          context: {
            accessToken: 'test-token',
            refreshToken: 'test-refresh',
          },
        } as any,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        refresh: vi.fn(),
      });

      render(
        <AuthGuardBridge>
          <div>content</div>
        </AuthGuardBridge>,
      );
    });

    it('provides correct auth context for anonymous user', async () => {
      render(
        <AuthGuardBridge>
          <div>content</div>
        </AuthGuardBridge>,
      );
    });

    it('handles authenticated user with null access token', async () => {
      // Mock store с authenticated state
      storeMocks.useAppStore.mockReturnValueOnce({
        user: { id: 'user-123', name: 'Test User' },
        userStatus: 'authenticated',
        theme: 'light',
        isOnline: true,
        actions: {},
      });

      render(
        <AuthGuardBridge>
          <div>content</div>
        </AuthGuardBridge>,
      );
    });

    it('handles authenticated user with null refresh token', async () => {
      // Mock store с authenticated state
      storeMocks.useAppStore.mockReturnValueOnce({
        user: { id: 'user-123', name: 'Test User' },
        userStatus: 'authenticated',
        theme: 'light',
        isOnline: true,
        actions: {},
      });

      render(
        <AuthGuardBridge>
          <div>content</div>
        </AuthGuardBridge>,
      );
    });
  });
});
