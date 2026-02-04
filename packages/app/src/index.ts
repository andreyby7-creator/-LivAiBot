/**
 * @file @livai/app — Next.js композиция (providers/hooks/ui/lib/types).
 *
 * Публичный API пакета @livai/app.
 * Экспортирует все публичные компоненты, утилиты, типы и провайдеры.
 */

/* ============================================================================
 * 🧩 UI — UI КОМПОНЕНТЫ
 * ========================================================================== */

export * from './ui/accordion.js';
export * from './ui/avatar.js';
export * from './ui/badge.js';
export * from './ui/breadcrumbs.js';
export * from './ui/button.js';
export * from './ui/card.js';
export * from './ui/checkbox.js';
export * from './ui/confirm-dialog.js';
export * from './ui/context-menu.js';
export * from './ui/date-picker.js';
export * from './ui/dialog.js';
export * from './ui/divider.js';
export * from './ui/dropdown.js';
export * from './ui/error-boundary.js';
export * from './ui/file-uploader.js';
export * from './ui/form.js';
export * from './ui/icon.js';
export * from './ui/input.js';
export * from './ui/language-selector.js';
export * from './ui/loading-spinner.js';
export * from './ui/modal.js';
export * from './ui/navigation-menu-item.js';
export * from './ui/radio.js';
export * from './ui/search-bar.js';
export * from './ui/select.js';
export * from './ui/sidebar.js';
export * from './ui/skeleton-group.js';
export * from './ui/skeleton.js';
export * from './ui/status-indicator.js';
export * from './ui/support-button.js';
export * from './ui/tabs.js';
export * from './ui/textarea.js';
export * from './ui/toast.js';
export * from './ui/toggle.js';
export * from './ui/tooltip.js';
export * from './ui/user-profile-display.js';

/* ============================================================================
 * 🛠️ LIB — УТИЛИТЫ И КЛИЕНТЫ
 * ========================================================================== */

export * from './lib/api-client.js';
export * from './lib/effect-utils.js';
export * from './lib/error-mapping.js';
export * from './lib/feature-flags.js';
// export * from './lib/i18n.js'; // Временно отключен для E2E из-за конфликта с next-intl
// pipeEffects конфликтует с effect-utils, экспортируем явно
export {
  type CacheEntry,
  type CacheKey,
  createInMemoryOfflineCacheStore,
  createOfflineCache,
  type OfflineCacheContext,
  type OfflineCacheEvents,
  type OfflineCacheOptions,
  type OfflineCacheResult,
  type OfflineCacheStore,
} from './lib/offline-cache.js';
export {
  type Client,
  type Clients,
  decommissionServiceWorker,
  type ExtendableEvent,
  type ExtendableMessageEvent,
  type FetchEvent,
  handleBackgroundSync,
  handleNotificationClick,
  handlePushNotification,
  handleRequest,
  mainCacheName,
  precacheMainUrls,
  precacheStaticUrls,
  type ServiceWorkerGlobalScope,
  staticCacheName,
  swDisabled,
  swSelf,
  type WindowClient,
} from './lib/service-worker.js';
export * from './lib/sse-client.js';
export * from './lib/telemetry.js';
export * from './lib/validation.js';
export * from './lib/websocket.js';
export * from './lib/api-schema-guard.js';
export * from './lib/performance.js';
export * from './lib/auth-guard.js';
export * from './lib/route-permissions.js';
export * from './lib/logger.js';

/* ============================================================================
 * 🧬 TYPES — ТИПЫ
 * ========================================================================== */

// ApiError, ApiResponse, RealtimeEvent конфликтуют между api.js и common.js
// Экспортируем из api.js (более специфичные типы для API)
export {
  type ApiAuthContext,
  type ApiClientConfig,
  type ApiError,
  type ApiErrorCategory,
  type ApiErrorSource,
  type ApiFailureResponse,
  type ApiHandler,
  type ApiHeaders,
  type ApiMetrics,
  type ApiRequest,
  type ApiRequestContext,
  type ApiResponse,
  type ApiRetryPolicy,
  type ApiServiceName,
  type ApiSuccessResponse,
  type BaseApiDTO,
  type HttpMethod,
  type PaginatedResult,
  type PaginationParams,
  type RealtimeEvent,
  type RealtimeSubscription,
  type SoftDeletable,
  type VersionedEntity,
} from './types/api.js';
// Экспортируем из common.js остальные типы, исключая конфликтующие
export {
  type ApiFailure,
  type ApiSuccess,
  type AppContext,
  type AsyncError,
  type AsyncFn,
  type AsyncIdle,
  type AsyncLoading,
  type AsyncState,
  type AsyncStatus,
  type AsyncSuccess,
  type AuthContext,
  type BaseDTO,
  type ErrorCategory,
  type ErrorSource,
  type FeatureFlags,
  type Handler,
  type ID,
  type Identifiable,
  type Immutable,
  type ISODateString,
  type Json,
  type JsonArray,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue,
  type Loggable,
  type Maybe,
  type Nullable,
  type Optional,
  type PaginatedResponse,
  type Platform,
  type Subscription,
  type VoidFn,
} from './types/common.js';

// Экспортируем типы ошибок
export {
  type AppError,
  type ClientError,
  createServerError,
  type ErrorFn,
  type ErrorHandler,
  type FrontendErrorSource,
  handleError,
  type IsErrorOfType,
  type NetworkError,
  type ServerError,
  type UnknownError,
  type ValidationError,
} from './types/errors.js';

// Экспортируем типы телеметрии
export {
  BatchCoreConfigVersion,
  type TelemetryBatchCoreConfig,
  type TelemetryBatchCoreState,
  type TelemetryConfig,
  type TelemetryEvent,
  type TelemetryLevel,
  TelemetryLevels,
  type TelemetryMetadata,
  type TelemetrySink,
} from './types/telemetry.js';

/* ============================================================================
 * 🎯 PROVIDERS — ПРОВАЙДЕРЫ
 * ========================================================================== */

export * from './providers/AppProviders.js';
export * from './providers/FeatureFlagsProvider.js';
export * from './providers/intl-provider.js';
export * from './providers/QueryClientProvider.js';
export * from './providers/TelemetryProvider.js';
export * from './providers/ToastProvider.js';

/* ============================================================================
 * 🚀 BOOTSTRAP — ЗАПУСК ПРИЛОЖЕНИЯ
 * ========================================================================== */

export * from './bootstrap.js';

/* ============================================================================
 * 🏪 STORE — ГЛОБАЛЬНОЕ СОСТОЯНИЕ
 * ========================================================================== */

export * from './state/store.js';
export * from './state/query/query-client.js';
