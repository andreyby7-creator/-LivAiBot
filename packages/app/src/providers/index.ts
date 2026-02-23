/**
 * @file packages/app/src/providers — React Providers
 *
 * Публичный API пакета providers.
 * Экспортирует все публичные провайдеры, контексты и хуки для React компонентов.
 */

/* ============================================================================
 * 🎯 APP PROVIDERS — ГЛАВНЫЕ ПРОВАЙДЕРЫ
 * ========================================================================== */

/**
 * App Providers: главный провайдер приложения, объединяющий все провайдеры.
 *
 * @public
 */
export {
  AppProviders,
  type AppProvidersProps,
  type AppUiAuthContext,
  AuthGuardBridge,
} from './AppProviders.js';

/* ============================================================================
 * 🚩 FEATURE FLAGS PROVIDER — ПРОВАЙДЕР ФЛАГОВ
 * ========================================================================== */

/**
 * Feature Flags Provider: провайдер для управления feature flags через Zustand.
 *
 * @public
 */
export {
  type FeatureFlagsActions,
  FeatureFlagsProvider,
  type FeatureFlagsProviderProps,
  type FeatureFlagsState,
  type FeatureFlagsStore,
  featureFlagsStore,
  type UiFeatureFlagsAlias,
  useFeatureFlags,
} from './FeatureFlagsProvider.js';

/* ============================================================================
 * 🌐 INTL PROVIDER — ПРОВАЙДЕР ИНТЕРНАЦИОНАЛИЗАЦИИ
 * ========================================================================== */

/**
 * Intl Provider: провайдер для интернационализации.
 *
 * @public
 */
export { IntlProvider, type IntlProviderProps } from './intl-provider.js';

/* ============================================================================
 * 🔄 QUERY CLIENT PROVIDER — ПРОВАЙДЕР QUERY CLIENT
 * ========================================================================== */

/**
 * Query Client Provider: провайдер для React Query с настройками по умолчанию.
 *
 * @public
 */
export {
  AppQueryClientProvider,
  type AppQueryClientProviderProps,
  type QueryComponentState,
} from './QueryClientProvider.js';

/* ============================================================================
 * 📡 TELEMETRY PROVIDER — ПРОВАЙДЕР ТЕЛЕМЕТРИИ
 * ========================================================================== */

/**
 * Telemetry Provider: провайдер для телеметрии и метрик.
 *
 * @public
 */
export {
  TelemetryContext,
  type TelemetryContextType,
  TelemetryProvider,
  type TelemetryProviderProps,
  type UiMetricsAlias,
  useTelemetryContext,
} from './TelemetryProvider.js';

/* ============================================================================
 * 🍞 TOAST PROVIDER — ПРОВАЙДЕР УВЕДОМЛЕНИЙ
 * ========================================================================== */

/**
 * Toast Provider: провайдер для управления toast уведомлениями.
 *
 * @public
 */
export {
  type AddToastParams,
  type ToastComponentState,
  ToastContext,
  type ToastContextType,
  type ToastItem,
  ToastProvider,
  type ToastProviderProps,
  type ToastType,
  useToast as useToastContext,
} from './ToastProvider.js';

/* ============================================================================
 * 🎨 UNIFIED UI PROVIDER — ОБЪЕДИНЕННЫЙ UI ПРОВАЙДЕР
 * ========================================================================== */

/**
 * Unified UI Provider: объединенный провайдер для feature flags, telemetry и i18n.
 *
 * @public
 */
export {
  UnifiedUIContext,
  type UnifiedUIContextType,
  type UnifiedUiFeatureFlagsApi,
  type UnifiedUiI18nContext,
  UnifiedUIProvider,
  type UnifiedUIProviderProps,
  type UnifiedUiTelemetryApi,
  useRequiredUnifiedUI,
  useUnifiedFeatureFlags,
  useUnifiedI18n,
  useUnifiedTelemetry,
  useUnifiedUI,
} from './UnifiedUIProvider.js';
