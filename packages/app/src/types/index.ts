/**
 * @file packages/app/src/types — Type Definitions
 *
 * Публичный API пакета types.
 * Экспортирует все публичные типы для приложения.
 */

/* ============================================================================
 * 🔌 API — ТИПЫ API
 * ========================================================================== */

/**
 * API Types: типы для работы с API, запросами, ответами и ошибками.
 *
 * @public
 */
export {
  type HttpMethod,
  type ApiServiceName,
  type ApiRequestContext,
  type ApiErrorCategory,
  type ApiErrorSource,
  type ApiError,
  type ApiSuccessResponse,
  type ApiFailureResponse,
  type ApiResponse,
  type PaginationParams,
  type PaginatedResult,
  type RealtimeEvent,
  type RealtimeSubscription,
  type ApiRequest,
  type ApiRetryPolicy,
  type ApiHandler,
  type BaseApiDTO,
  type SoftDeletable,
  type VersionedEntity,
  type ApiAuthContext,
  type ApiHeaders,
  type ApiMetrics,
  type ApiClientConfig,
  type UploadDomainStatus,
  type FileValidationResult,
  type AppFileStatus,
  type InternalFileInfo,
} from './api.js';

/* ============================================================================
 * 🧩 COMMON — ОБЩИЕ ТИПЫ
 * ========================================================================== */

/**
 * Common Types: общие типы для всего приложения.
 *
 * @public
 */
export {
  UserRoles,
  AllUserRoles,
  AppModules,
  type ID,
  type ISODateString,
  type JsonPrimitive,
  type JsonValue,
  type JsonObject,
  type JsonArray,
  type Json,
  type Nullable,
  type Optional,
  type Maybe,
  type Immutable,
  type Platform,
  type AppContext,
  type BaseDTO,
  type PaginatedResponse,
  type ApiSuccess,
  type ApiFailure,
  type ApiResponse as CommonApiResponse,
  type ErrorCategory,
  type ErrorSource,
  type ApiError as CommonApiError,
  type AsyncStatus,
  type AsyncIdle,
  type AsyncLoading,
  type AsyncSuccess,
  type AsyncError,
  type AsyncState,
  type RealtimeEvent as CommonRealtimeEvent,
  type Subscription,
  type AuthContext,
  type FeatureFlags,
  type VoidFn,
  type Handler,
  type Identifiable,
  type Loggable,
  type AsyncFn,
  type UserRole,
  type AppModule,
  type RouteConfig,
} from './common.js';

/* ============================================================================
 * 🚨 ERRORS — ТИПЫ ОШИБОК
 * ========================================================================== */

/**
 * Error Types: типы для обработки ошибок в приложении.
 *
 * @public
 */
export {
  createServerError,
  handleError,
  type FrontendErrorSource,
  type AppError,
  type ClientError,
  type ValidationError,
  type NetworkError,
  type ServerError,
  type UnknownError,
  type ErrorFn,
  type ErrorHandler,
  type ErrorBoundaryErrorCode,
  type IsErrorOfType,
} from './errors.js';

/* ============================================================================
 * 📡 TELEMETRY — ТИПЫ ТЕЛЕМЕТРИИ
 * ========================================================================== */

/**
 * Telemetry Types: типы для телеметрии и мониторинга.
 *
 * @public
 */
export {
  TelemetryLevels,
  BatchCoreConfigVersion,
  defaultTelemetryTimezone,
  type UiTelemetryMetrics,
  type TelemetryLevel,
  type TelemetryLevelTemplate,
  type TelemetryPrimitive,
  type PIIField,
  type NonPIIField,
  type TelemetryMetadata,
  type TelemetryTimezone,
  type TelemetryEvent,
  type TelemetryBatchCoreConfig,
  type TelemetryBatchCoreState,
  type TelemetrySink,
  type RetryConfig,
  type DropPolicy,
  type BatchConfig,
  type ThrottleConfig,
  type CustomLevelPriority,
  type FallbackPriorityStrategy,
  type TelemetryConfig,
} from './telemetry.js';

/* ============================================================================
 * 🎨 UI CONTRACTS — КОНТРАКТЫ UI
 * ========================================================================== */

/**
 * UI Contracts: контракты для UI компонентов и состояний.
 *
 * @public
 */
export {
  type UiFeatureFlagName,
  type UiPrimitiveProps,
  type UiFeatureFlags,
  type ControlledFieldProps,
  type UncontrolledFieldProps,
  type UiEventMap,
  type UiEvent,
  type UiEventHandler,
  type UiStatePolicy,
  type ComponentState,
  type UiStatefulComponentProps,
  type MapCoreProps,
  type AppWrapperProps,
  type UiAuthContext,
  type UiMetrics,
  type UiFeatureFlagsApi,
  type UiTelemetryApi,
  type UiI18nContext,
} from './ui-contracts.js';
