/**
 * @vitest-environment jsdom
 * @file Unit тесты для AppProviders
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const providerMocks = vi.hoisted(() => ({
  ErrorBoundary: vi.fn(({ children }) => <div data-testid='error-boundary'>{children}</div>),
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
}));

const storeMocks = vi.hoisted(() => ({
  useAppStore: Object.assign(
    vi.fn(() => 'anonymous'),
    {
      getState: vi.fn(() => ({ userStatus: 'anonymous' })),
      subscribe: vi.fn(() => vi.fn()),
    },
  ),
}));

vi.mock('../../../src/ui/error-boundary', () => ({
  ErrorBoundary: providerMocks.ErrorBoundary,
}));

vi.mock('../../../src/providers/intl-provider', () => ({
  IntlProvider: providerMocks.IntlProvider,
}));

vi.mock('../../../src/providers/FeatureFlagsProvider', () => ({
  FeatureFlagsProvider: providerMocks.FeatureFlagsProvider,
}));

vi.mock('../../../src/providers/TelemetryProvider', () => ({
  TelemetryProvider: providerMocks.TelemetryProvider,
}));

vi.mock('../../../src/providers/QueryClientProvider', () => ({
  AppQueryClientProvider: providerMocks.AppQueryClientProvider,
}));

vi.mock('../../../src/providers/ToastProvider', () => ({
  ToastProvider: providerMocks.ToastProvider,
}));

vi.mock('../../../src/state/store', () => ({
  useAppStore: storeMocks.useAppStore,
}));

import { AppProviders } from '../../../src/providers/AppProviders';

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
      <AppProviders intl={intlProps}>
        <div data-testid='child'>child</div>
      </AppProviders>,
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('intl-provider')).toBeInTheDocument();
    expect(screen.getByTestId('feature-flags-provider')).toBeInTheDocument();
    expect(screen.getByTestId('telemetry-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();

    const errorBoundary = screen.getByTestId('error-boundary');
    const intlProvider = screen.getByTestId('intl-provider');
    const featureFlagsProvider = screen.getByTestId('feature-flags-provider');
    const telemetryProvider = screen.getByTestId('telemetry-provider');
    const queryClientProvider = screen.getByTestId('query-client-provider');
    const toastProvider = screen.getByTestId('toast-provider');

    expect(errorBoundary).toContainElement(intlProvider);
    expect(intlProvider).toContainElement(featureFlagsProvider);
    expect(featureFlagsProvider).toContainElement(telemetryProvider);
    expect(telemetryProvider).toContainElement(queryClientProvider);
    expect(queryClientProvider).toContainElement(toastProvider);
  });

  it('passes props to providers and uses store selector', () => {
    render(
      <AppProviders
        intl={intlProps}
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
    expect(providerMocks.ErrorBoundary).toHaveBeenCalledWith(
      expect.objectContaining({}), // ErrorBoundary gets default empty props
      undefined,
    );
    expect(providerMocks.IntlProvider).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', messages: intlProps.messages }),
      undefined,
    );
    expect(storeMocks.useAppStore.getState).toHaveBeenCalledTimes(1);
    expect(storeMocks.useAppStore.subscribe).toHaveBeenCalledTimes(1);
  });
});
