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
 * FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → AuthHookProvider → AuthGuard
 */

'use client';

import type { JSX, PropsWithChildren } from 'react';
import React, { memo, useEffect, useMemo } from 'react';

import type { AuthGuardContext, Permission } from '@livai/core/access-control';
import { AuthGuardProvider } from '@livai/core/access-control';
import type { AnyRole } from '@livai/core-contracts';

import { AuthHookProvider, useAuth } from '../hooks/useAuth-provider.js';
import type { AuthHookDepsConfig } from '../lib/auth-hook-deps.js';
import type { AppStore } from '../state/store.js';
import { useAppStore } from '../state/store.js';
import type { UiAuthContext } from '../types/ui-contracts.js';
import type { FeatureFlagsProviderProps } from './FeatureFlagsProvider.js';
import { FeatureFlagsProvider } from './FeatureFlagsProvider.js';
import type { IntlProviderProps } from './intl-provider.js';
import { IntlProvider } from './intl-provider.js';
import type { AppQueryClientProviderProps } from './QueryClientProvider.js';
import { AppQueryClientProvider } from './QueryClientProvider.js';
import type { TelemetryProviderProps } from './TelemetryProvider.js';
import { TelemetryProvider } from './TelemetryProvider.js';
import type { ToastProviderProps } from './ToastProvider.js';
import { ToastProvider } from './ToastProvider.js';
import { UnifiedUIProvider } from './UnifiedUIProvider.js';

/* ============================================================================
 * 🔐 AUTH GUARD BRIDGE — МОСТ МЕЖДУ USEAUTH И AUTHGUARD
 * ============================================================================
 *
 * Интегрирует данные аутентификации из useAuth/store с AuthGuard системой.
 * Преобразует Zustand store состояние в AuthGuardContext для использования
 * в guard'ах и авторизационных проверках.
 */

/**
 * Опции для построения AuthGuardContext.
 * @remarks
 * Позволяет расширять контекст авторизации без изменения сигнатуры bridge.
 * Future: mfa/ssO/risk flags can be added here без изменения сигнатуры bridge.
 */
type AuthGuardContextOptions = Readonly<{
  /** Роли пользователя для RBAC. */
  readonly roles?: ReadonlySet<AnyRole>;
  /** Разрешения пользователя для ABAC. */
  readonly permissions?: ReadonlySet<Permission>;
}>;

/** Длина случайной части requestId. */
const REQUEST_ID_LENGTH = 9;
/** Radix для генерации requestId (base36). */
const REQUEST_ID_RADIX = 36;

/**
 * Строит AuthGuardContext из состояния AppStore и токенов из useAuth.
 * @param store - Состояние приложения из Zustand store.
 * @param accessToken - Access token из feature-auth (может быть null).
 * @param refreshToken - Refresh token из feature-auth (опционально).
 * @param requestId - Уникальный идентификатор запроса (мемоизирован на сессию).
 * @param options - Опциональные параметры контекста (роли, разрешения, future: MFA/SSO/risk).
 * @returns AuthGuardContext для использования в guard'ах и авторизационных проверках.
 * @remarks
 * - Domain-чистая функция: только маппинг store + tokens → context, без side-effects.
 * - Детерминированная: результат зависит только от входных параметров.
 * - Extensible: новые поля можно добавлять через options без изменения сигнатуры.
 */
const buildAuthGuardContext = (
  store: AppStore,
  accessToken: string | null,
  refreshToken: string | null | undefined,
  requestId: string,
  options?: AuthGuardContextOptions,
): AuthGuardContext => {
  const roles = options?.roles ?? new Set<AnyRole>();
  const permissions = options?.permissions ?? new Set<Permission>();

  const baseContext = {
    requestId,
    ...(typeof navigator !== 'undefined' && { userAgent: navigator.userAgent }),
    ...(store.user?.id ? { userId: store.user.id } : {}),
    roles,
    permissions,
  };

  const isAuthenticated = accessToken != null;

  return isAuthenticated
    ? {
      isAuthenticated: true,
      accessToken,
      ...(refreshToken != null ? { refreshToken } : {}),
      ...baseContext,
    }
    : {
      isAuthenticated: false,
      ...baseContext,
    };
};

/**
 * Мост между AppStore, useAuth и AuthGuard системой.
 * @remarks
 * - Тонкий UI-компонент: читает store и useAuth, передаёт контекст в AuthGuardProvider.
 * - Мемоизирует requestId и authGuardContext для стабильности и производительности.
 * - SSR-safe: работает корректно на сервере и клиенте.
 * - Использует `useAuth()` для получения токенов из feature-auth store.
 */
export const AuthGuardBridge: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const store = useAppStore();
  const { authState } = useAuth();

  // Извлекаем токены из feature-auth AuthState
  const accessToken = authState.status === 'authenticated'
      && typeof authState.context?.['accessToken'] === 'string'
      && authState.context['accessToken'].length > 0
    ? authState.context['accessToken']
    : null;

  const refreshToken = authState.status === 'authenticated'
      && typeof authState.context?.['refreshToken'] === 'string'
      && authState.context['refreshToken'].length > 0
    ? authState.context['refreshToken']
    : null;

  const requestId = useMemo(
    () =>
      `req_${Date.now()}_${
        Math.random().toString(REQUEST_ID_RADIX).substring(2, REQUEST_ID_LENGTH + 2)
      }`,
    [],
  );

  const authGuardContext = useMemo(
    () => buildAuthGuardContext(store, accessToken, refreshToken, requestId),
    [store, accessToken, refreshToken, requestId],
  );

  return React.createElement(AuthGuardProvider, { value: authGuardContext, children });
};

/**
 * Алиас для UI auth context в контексте app providers.
 * @public
 */
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
    /** Конфигурация AuthHookProvider. */
    readonly authHook: AuthHookDepsConfig;
  }>
>;

/* ============================================================================
 * 🎯 PROVIDERS
 * ========================================================================== */

/**
 * SSR-safe хук для инициализации глобального store.
 * @remarks
 * - Выполняется только на клиенте (typeof window !== 'undefined').
 * - Инициализирует подписку на изменения userStatus для синхронизации состояния.
 * - Не имеет side-effects на сервере, что гарантирует SSR-корректность.
 */
function useAppStoreInit(): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      // На сервере эффект не выполняет никаких действий
      return;
    }

    // Синхронное получение состояния при монтировании
    useAppStore.getState();
    // Инициализация подписки на изменения userStatus только на клиенте
    const unsubscribe = useAppStore.subscribe((state) => state.userStatus);
    return unsubscribe;
  }, []);
}

/**
 * Основной компонент композиции провайдеров приложения.
 * @param props - Конфигурация провайдеров (intl и authHook обязательны, остальные опциональны).
 * @returns JSX дерево провайдеров с детьми.
 * @remarks
 * - Порядок провайдеров фиксирован и важен: FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → AuthHookProvider → AuthGuard.
 * - SSR-safe: инициализация store выполняется только на клиенте.
 * - Чистая композиция: не содержит бизнес-логики, только обёртки провайдеров.
 */
function AppProvidersComponent({
  children,
  telemetry,
  featureFlags,
  queryClient,
  toast,
  intl,
  authHook,
}: AppProvidersProps): JSX.Element {
  // SSR-safe инициализация глобального store без side effects
  useAppStoreInit();

  return (
    <IntlProvider {...intl}>
      {/* Порядок важен: FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → AuthHookProvider → AuthGuard */}
      <FeatureFlagsProvider {...(featureFlags ?? {})}>
        <TelemetryProvider {...(telemetry ?? {})}>
          <AppQueryClientProvider {...(queryClient ?? {})}>
            <ToastProvider {...(toast ?? {})}>
              <UnifiedUIProvider>
                <AuthHookProvider config={authHook}>
                  <AuthGuardBridge>
                    {children}
                  </AuthGuardBridge>
                </AuthHookProvider>
              </UnifiedUIProvider>
            </ToastProvider>
          </AppQueryClientProvider>
        </TelemetryProvider>
      </FeatureFlagsProvider>
    </IntlProvider>
  );
}

/**
 * Главный провайдер приложения с мемоизацией.
 * @remarks
 * - Мемоизирован через React.memo для оптимизации ререндеров.
 * - Единая точка композиции всех клиентских провайдеров.
 * - Экспортируется как default и named export для гибкости импорта.
 * @public
 */
export const AppProviders = Object.assign(memo(AppProvidersComponent), {
  displayName: 'AppProviders',
});

export default AppProviders;
