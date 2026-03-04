/**
 * @file packages/app/src/providers/AppProviders.tsx
 * ============================================================================
 * 🧩 APP PROVIDERS — КОМПОЗИЦИЯ ПРОВАЙДЕРОВ ПРИЛОЖЕНИЯ
 * ============================================================================
 * Назначение:
 * - Единая точка композиции клиентских провайдеров
 * - Предсказуемый порядок инициализации инфраструктуры
 * - SSR-safe обертка без бизнес-логики
 * Порядок:
 * FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → AuthGuard
 */

'use client';

import React, { memo, useEffect } from 'react';
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
import { UnifiedUIProvider } from './UnifiedUIProvider.js';
import { useAuth } from '../hooks/useAuth.js';
import type { AuthGuardContext, Permission, UserRole } from '../lib/auth-guard.js';
import { AuthGuardProvider } from '../lib/auth-guard.js';
import { useAppStore } from '../state/store.js';
import type { UiAuthContext } from '../types/ui-contracts.js';

/** Алиас для UI auth context в контексте app providers */

/* ============================================================================
 * 🔐 AUTH GUARD BRIDGE — МОСТ МЕЖДУ USEAUTH И AUTHGUARD
 * ============================================================================
 *
 * Интегрирует данные аутентификации из useAuth/store с AuthGuard системой.
 * Преобразует Zustand store состояние в AuthGuardContext для использования
 * в guard'ах и авторизационных проверках.
 */
export const AuthGuardBridge: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const auth = useAuth();
  const store = useAppStore();

  // Создаем AuthGuardContext из данных useAuth
  const REQUEST_ID_LENGTH = 9;
  const REQUEST_ID_RADIX = 36;

  const baseContext = {
    requestId: `req_${Date.now()}_${
      Math.random().toString(REQUEST_ID_RADIX).substring(2, REQUEST_ID_LENGTH + 2)
    }`,
    ...(typeof navigator !== 'undefined' && { userAgent: navigator.userAgent }),
    ...(store.user?.id ? { userId: store.user.id } : {}),
    roles: new Set<UserRole>(), // TODO: Добавить роли из user профиля
    permissions: new Set<Permission>(), // TODO: Добавить разрешения
  };

  const authGuardContext: AuthGuardContext = auth.isAuthenticated && store.auth.accessToken != null
    ? {
      isAuthenticated: true,
      accessToken: store.auth.accessToken,
      ...(store.auth.refreshToken != null ? { refreshToken: store.auth.refreshToken } : {}),
      ...baseContext,
    }
    : {
      isAuthenticated: false,
      ...baseContext,
    };

  return React.createElement(AuthGuardProvider, { value: authGuardContext, children });
};
export type AppUiAuthContext = UiAuthContext;

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type AppProvidersProps = Readonly<
  PropsWithChildren<{
    /** Конфигурация IntlProvider. */
    readonly intl: IntlProviderProps;
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
}: AppProvidersProps): JSX.Element {
  // SSR-safe инициализация глобального store без side effects
  useAppStoreInit();

  return (
    <IntlProvider {...intl}>
      {/* Порядок важен: FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → AuthGuard */}
      <FeatureFlagsProvider {...(featureFlags ?? {})}>
        <TelemetryProvider {...(telemetry ?? {})}>
          <AppQueryClientProvider {...(queryClient ?? {})}>
            <ToastProvider {...(toast ?? {})}>
              <UnifiedUIProvider>
                <AuthGuardBridge>
                  {children}
                </AuthGuardBridge>
              </UnifiedUIProvider>
            </ToastProvider>
          </AppQueryClientProvider>
        </TelemetryProvider>
      </FeatureFlagsProvider>
    </IntlProvider>
  );
}

export const AppProviders = Object.assign(memo(AppProvidersComponent), {
  displayName: 'AppProviders',
});

export default AppProviders;
