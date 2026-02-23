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
  AuthGuardBridge,
  type AppUiAuthContext,
  type AppProvidersProps,
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
  FeatureFlagsProvider,
  featureFlagsStore,
  useFeatureFlags,
  type UiFeatureFlagsAlias,
  type FeatureFlagsState,
  type FeatureFlagsActions,
  type FeatureFlagsStore,
  type FeatureFlagsProviderProps,
} from './FeatureFlagsProvider.js';

/* ============================================================================
 * 🌐 INTL PROVIDER — ПРОВАЙДЕР ИНТЕРНАЦИОНАЛИЗАЦИИ
 * ========================================================================== */

/**
 * Intl Provider: провайдер для интернационализации.
 *
 * @public
 */
export {
  IntlProvider,
  type IntlProviderProps,
} from './intl-provider.js';

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
  type QueryComponentState,
  type AppQueryClientProviderProps,
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
  TelemetryProvider,
  useTelemetryContext,
  TelemetryContext,
  type UiMetricsAlias,
  type TelemetryContextType,
  type TelemetryProviderProps,
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
  ToastProvider,
  useToast as useToastContext,
  ToastContext,
  type ToastComponentState,
  type ToastType,
  type ToastItem,
  type ToastContextType,
  type AddToastParams,
  type ToastProviderProps,
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
  UnifiedUIProvider,
  UnifiedUIContext,
  useUnifiedUI,
  useRequiredUnifiedUI,
  useUnifiedFeatureFlags,
  useUnifiedTelemetry,
  useUnifiedI18n,
  type UnifiedUiFeatureFlagsApi,
  type UnifiedUiTelemetryApi,
  type UnifiedUiI18nContext,
  type UnifiedUIContextType,
  type UnifiedUIProviderProps,
} from './UnifiedUIProvider.js';
