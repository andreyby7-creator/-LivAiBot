/**
 * @file packages/app/src/types — Type Definitions
 * Публичный API пакета types.
 * Экспортирует все публичные типы для приложения.
 */

/* ============================================================================
 * 🔌 API — ТИПЫ API
 * ========================================================================== */

/**
 * API Types: типы для работы с API, запросами, ответами и ошибками.
 * @public
 */
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
  type AppFileStatus,
  type BaseApiDTO,
  type FileValidationResult,
  type HttpMethod,
  type InternalFileInfo,
  type PaginatedResult,
  type PaginationParams,
  type RealtimeEvent,
  type RealtimeSubscription,
  type SoftDeletable,
  type UploadDomainStatus,
  type VersionedEntity,
} from './api.js';

/* ============================================================================
 * 🧩 COMMON — ОБЩИЕ ТИПЫ
 * ========================================================================== */

/**
 * Common Types: общие типы для всего приложения.
 * @public
 */
export {
  AllUserRoles,
  type ApiError as CommonApiError,
  type ApiFailure,
  type ApiResponse as CommonApiResponse,
  type ApiSuccess,
  type AppContext,
  AppModules,
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
  type RealtimeEvent as CommonRealtimeEvent,
  type RouteConfig,
  type Subscription,
  UserRoles,
  type VoidFn,
} from './common.js';

/* ============================================================================
 * 🎨 UI CONTRACTS — КОНТРАКТЫ UI
 * ========================================================================== */

/**
 * UI Contracts: контракты для UI компонентов и состояний.
 * @public
 */
export {
  type AppWrapperProps,
  type ComponentState,
  type ControlledFieldProps,
  type MapCoreProps,
  type UiAuthContext,
  type UiEvent,
  type UiEventHandler,
  type UiEventMap,
  type UiFeatureFlagName,
  type UiFeatureFlags,
  type UiFeatureFlagsApi,
  type UiI18nContext,
  type UiMetrics,
  type UiPrimitiveProps,
  type UiStatefulComponentProps,
  type UiStatePolicy,
  type UiTelemetryApi,
  type UncontrolledFieldProps,
} from './ui-contracts.js';
