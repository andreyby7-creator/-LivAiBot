/**
 * @file packages/app/src/providers/AppProviders.tsx
 * ============================================================================
 * 🧩 APP PROVIDERS — КОМПОЗИЦИЯ ПРОВАЙДЕРОВ ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Назначение:
 * - Единая точка композиции клиентских провайдеров
 * - Предсказуемый порядок инициализации инфраструктуры
 * - SSR-safe обертка без бизнес-логики
 *
 * Порядок:
 * FeatureFlags → Telemetry → QueryClient → Toast
 */

'use client';

import { memo, useEffect } from 'react';
import type { JSX, PropsWithChildren } from 'react';

import { FeatureFlagsProvider } from './FeatureFlagsProvider.js';
import type { FeatureFlagsProviderProps } from './FeatureFlagsProvider.js';
import { IntlProvider } from './intl-provider.js';
import type { IntlProviderProps } from './intl-provider.js';
import { AppQueryClientProvider } from './QueryClientProvider.js';
import type { AppQueryClientProviderProps } from './QueryClientProvider.js';
import { TelemetryProvider } from './TelemetryProvider.js';
import type { TelemetryProviderProps } from './TelemetryProvider.js';
import { ToastProvider } from './ToastProvider.js';
import type { ToastProviderProps } from './ToastProvider.js';
import { useAppStore } from '../state/store.js';
import type { AppErrorBoundaryProps } from '../ui/error-boundary.js';
import { ErrorBoundary } from '../ui/error-boundary.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type AppProvidersProps = Readonly<
  PropsWithChildren<{
    /** Конфигурация IntlProvider. */
    readonly intl: IntlProviderProps;
    /** Конфигурация ErrorBoundary. */
    readonly errorBoundary?: AppErrorBoundaryProps;
    /** Конфигурация TelemetryProvider. */
    readonly telemetry?: TelemetryProviderProps;
    /** Конфигурация FeatureFlagsProvider. */
    readonly featureFlags?: FeatureFlagsProviderProps;
    /** Конфигурация QueryClientProvider. */
    readonly queryClient?: AppQueryClientProviderProps;
    /** Конфигурация ToastProvider. */
    readonly toast?: ToastProviderProps;
  }>
>;

/* ============================================================================
 * 🎯 PROVIDERS
 * ========================================================================== */

// SSR-safe хук для инициализации глобального store
function useAppStoreInit(): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Синхронное получение состояния при монтировании
      useAppStore.getState();
      // Инициализация подписки на изменения userStatus только на клиенте
      const unsubscribe = useAppStore.subscribe((state) => state.userStatus);
      return unsubscribe;
    }
    return undefined;
  }, []);
}

function AppProvidersComponent({
  children,
  telemetry,
  featureFlags,
  queryClient,
  toast,
  intl,
  errorBoundary,
}: AppProvidersProps): JSX.Element {
  // SSR-safe инициализация глобального store без side effects
  useAppStoreInit();

  return (
    <ErrorBoundary {...(errorBoundary ?? {})}>
      <IntlProvider {...intl}>
        {/* Порядок важен: FeatureFlags → Telemetry → QueryClient → Toast */}
        <FeatureFlagsProvider {...(featureFlags ?? {})}>
          <TelemetryProvider {...(telemetry ?? {})}>
            <AppQueryClientProvider {...(queryClient ?? {})}>
              <ToastProvider {...(toast ?? {})}>
                {children}
              </ToastProvider>
            </AppQueryClientProvider>
          </TelemetryProvider>
        </FeatureFlagsProvider>
      </IntlProvider>
    </ErrorBoundary>
  );
}

export const AppProviders = Object.assign(memo(AppProvidersComponent), {
  displayName: 'AppProviders',
});

export default AppProviders;
