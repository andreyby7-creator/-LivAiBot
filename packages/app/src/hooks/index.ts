/**
 * @file packages/app/src/hooks — React Hooks
 * Публичный API пакета hooks.
 * Экспортирует все публичные хуки, типы и утилиты для React компонентов.
 */

/* ============================================================================
 * 🔌 USE API — ХУК ДЛЯ API ВЫЗОВОВ
 * ========================================================================== */

/**
 * useApi: оркестратор вызовов API с типизацией, валидацией и телеметрией.
 * Предоставляет строго типизированные helpers для API без строковых endpoint'ов.
 * @public
 */
export {
  type ApiClientAdapter,
  type ApiComponentState,
  type ApiContract,
  type ApiEndpointDefinition,
  type ApiUiEvent,
  type ApiUiMetrics,
  useApi,
  type UseApiOptions,
} from './useApi.js';

/* ============================================================================
 * 🔐 USE AUTH — ХУК ДЛЯ АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * useAuth: React hook для управления аутентификацией.
 * Предоставляет состояние и методы для login/logout/refresh с автоматическим управлением токенами.
 * @public
 */
export { authSelectors, useAuth } from './useAuth.js';

/* ============================================================================
 * 🗄️ USE OFFLINE CACHE — ХУК ДЛЯ ОФФЛАЙН КЭША
 * ========================================================================== */

/**
 * useOfflineCache: продвинутый хук для работы с offline cache.
 * Включает типизированный доступ, SWR staleWhileRevalidate, частичное слияние,
 * debounce/throttle, SSR гидратацию и кросс-таб синхронизацию.
 * @public
 */
export {
  type CacheKey,
  type InvalidateMarker,
  type OfflineCacheComponentState,
  type PartialDeep,
  useOfflineCache,
  type UseOfflineCacheOptions,
  type UseOfflineCacheReturn,
  type UseOfflineCacheState,
} from './useOfflineCache.js';

/* ============================================================================
 * 🚩 USE FEATURE FLAGS — ХУК ДЛЯ ФЛАГОВ
 * ========================================================================== */

/**
 * useFeatureFlags: SSR-safe hook для чтения и управления feature flags.
 * Предоставляет typed доступ к флагам через Zustand selectors с dev-only toggle.
 * @public
 */
export {
  type FeatureFlagKey,
  useFeatureFlags,
  type UseFeatureFlagsApi,
  type UseFeatureFlagsUi,
} from './useFeatureFlags.js';

/* ============================================================================
 * 🍞 USE TOAST — ХУК ДЛЯ УВЕДОМЛЕНИЙ
 * ========================================================================== */

/**
 * useToast: fluent API для управления уведомлениями.
 * Предоставляет методы success/error/warning/info/loading/promise с автоматической телеметрией.
 * @public
 */
export {
  type ToastComponentState,
  type ToastDuration,
  type ToastUiEvent,
  useToast,
  type UseToastApi,
} from './useToast.js';
