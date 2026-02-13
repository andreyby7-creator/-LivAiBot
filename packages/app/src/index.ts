/**
 * @file @livai/app — Next.js композиция (providers/hooks/ui/lib/types).
 *
 * Публичный API пакета @livai/app.
 * Экспортирует все публичные компоненты, утилиты, типы и провайдеры.
 */

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
  AllUserRoles,
  type ApiFailure,
  type ApiSuccess,
  type AppContext,
  // Routing types
  type AppModule,
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
  type ExhaustiveRoleCheck,
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
  type RouteConfig,
  type Subscription,
  type UserRole,
  UserRoles,
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
  type BatchConfig,
  BatchCoreConfigVersion,
  type CustomLevelPriority,
  defaultTelemetryTimezone,
  type DropPolicy,
  type FallbackPriorityStrategy,
  type NonPIIField,
  type PIIField,
  type RetryConfig,
  type TelemetryBatchCoreConfig,
  type TelemetryBatchCoreState,
  type TelemetryConfig,
  type TelemetryEvent,
  type TelemetryLevel,
  TelemetryLevels,
  type TelemetryLevelTemplate,
  type TelemetryMetadata,
  type TelemetryPrimitive,
  type TelemetrySink,
  type TelemetryTimezone,
  type ThrottleConfig,
  type UiTelemetryMetrics,
} from './types/telemetry.js';

// Экспортируем UI контракты
export {
  type AppWrapperProps,
  type ComponentState,
  type ControlledFieldProps,
  type MapCoreProps,
  type UiAuthContext,
  type UiEvent,
  type UiEventHandler,
  type UiEventMap,
  type UiFeatureFlags,
  type UiMetrics,
  type UiPrimitiveProps,
  type UiStatefulComponentProps,
  type UiStatePolicy,
  type UncontrolledFieldProps,
} from './types/ui-contracts.js';

// Экспортируем типы lifecycle
export {
  type LifecycleHookEvent,
  type LifecycleHookHandler,
  type LifecycleStage,
} from './lib/app-lifecycle.js';

/* ============================================================================
 * 🛠️ LIB — УТИЛИТЫ И КЛИЕНТЫ
 * ========================================================================== */

export * from './lib/api-client.js';
export * from './lib/api-schema-guard.js';
export * from './lib/auth-guard.js';
// Явный экспорт из auth-service для избежания конфликта с AuthError из auth-guard
export {
  type AuthError as AuthServiceError,
  authService,
  createAuthService,
} from './lib/auth-service.js';
export { appLifecycle } from './lib/app-lifecycle.js';
// Явный экспорт из effect-utils для избежания конфликтов с error-mapping и validation
export {
  asApiEffect,
  createEffectAbortController,
  type Effect,
  type EffectAbortController,
  type EffectContext,
  type EffectError,
  type EffectErrorKind,
  type EffectFn,
  type EffectLogger,
  type EffectResult,
  fail as resultFail,
  flatMap,
  isFail,
  isOk,
  map as resultMap,
  mapError as resultMapError,
  ok as resultOk,
  pipeEffects,
  type Result,
  type RetryPolicy,
  safeExecute,
  sleep,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  withLogging,
  withRetry,
} from './lib/effect-utils.js';
// Effect timeout - экспортируем из effect-timeout.ts (новые версии с расширенным функционалом)
export {
  createTimeoutContext,
  isTimeoutError,
  type TimeoutEffectContext,
  TimeoutError,
  type TimeoutOptions,
  validateTimeoutMs,
  withTimeout,
} from './lib/effect-timeout.js';
export {
  isIsolationError,
  IsolationError,
  type IsolationOptions,
  runIsolated,
} from './lib/effect-isolation.js';

// Schema validated effect
export {
  createValidationError,
  isSchemaValidationError,
  SchemaValidationError,
  validatedEffect,
  type ValidatedEffectOptions,
} from './lib/schema-validated-effect.js';

// Orchestrator
export { orchestrate, type Step, step, type StepResult } from './lib/orchestrator.js';
export * from './lib/error-mapping.js';
export * from './lib/feature-flags.js';
// export * from './lib/i18n.js'; // Временно отключен для E2E из-за конфликта с next-intl
export * from './lib/logger.js';
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
export * from './lib/performance.js';
export * from './lib/route-permissions.js';
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
// Экспортируем batch core API и типы
export {
  defaultBatchCoreConfig,
  telemetryBatchCore,
  type TelemetryBatchCoreConfigExtended,
  type TransformEventHook,
} from './lib/telemetry.batch-core.js';
// Экспортируем типы и классы из lib/telemetry.js (чистые утилиты)
export {
  type ConsoleSinkFormatter,
  createConsoleSink,
  createExternalSink,
  createExternalSinkSafe,
  type ExternalSdk,
  getGlobalClientForDebug,
  isValidTelemetrySink,
  levelPriority,
  TelemetryClient,
  telemetryLevels,
} from './lib/telemetry.js';
// Экспортируем singleton функции из lib/telemetry-runtime.js
export {
  errorFireAndForget,
  fireAndForget,
  getFireAndForgetMetrics,
  getGlobalTelemetryClient,
  infoFireAndForget,
  initTelemetry,
  isTelemetryInitialized,
  logFireAndForget,
  resetGlobalTelemetryClient,
  setGlobalClientForDebug,
  warnFireAndForget,
} from './lib/telemetry-runtime.js';
// Явный экспорт из validation для избежания конфликтов с effect-utils
// ValidationError уже экспортируется из types/errors.js, поэтому не экспортируем из validation
export {
  asyncPipe,
  type AsyncValidator,
  fail as validationFail,
  formatFileSize,
  type FormValidationResult,
  isNumber,
  isString,
  nullable,
  type ObjectSchema,
  ok as validationOk,
  optional,
  pipe,
  pipeMany,
  refine,
  required,
  toAsync,
  validateFileBasic,
  validateForm,
  validateObject,
  type ValidationContext,
  type ValidationResult,
  type ValidationSchema,
  type Validator,
} from './lib/validation.js';
export * from './lib/websocket.js';

/* ============================================================================
 * ⚙️ BACKGROUND — ФОНОВЫЕ ЗАДАЧИ И ПЛАНИРОВЩИК
 * ========================================================================== */

export {
  type BackgroundTask,
  getGlobalScheduler,
  MeldablePriorityQueue,
  type PriorityType,
  type QueueItem,
  Scheduler,
  scheduler,
  type SchedulerDI,
  type TaskFn,
} from './background/scheduler.js';

export {
  backgroundTasks,
  type BackgroundTasksDI,
  createTasks,
  initBackgroundTasks,
  PermanentError,
  type TaskEffect,
  TaskError,
  TransientError,
} from './background/tasks.js';

/* ============================================================================
 * 🏪 STORE — ГЛОБАЛЬНОЕ СОСТОЯНИЕ
 * ========================================================================== */

export * from './state/store.js';
export * from './state/store-utils.js';
export * from './state/reset.js';
export * from './state/query/query-client.js';

/* ============================================================================
 * 🛤️ ROUTES — МАРШРУТЫ И МЕТАДАННЫЕ
 * ========================================================================== */

export * from './routes/routes.js';
export * from './routes/route-meta.js';
export * from './routes/navigation.js';

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
 * 📡 EVENTS — СОБЫТИЯ ПРИЛОЖЕНИЯ
 * ========================================================================== */

export * from './events/app-events.js';
export * from './events/app-lifecycle-events.js';
export * from './events/event-bus.js';
// Контракты событий документированы в ./events/event-contracts.md

/* ============================================================================
 * 🎯 PROVIDERS — ПРОВАЙДЕРЫ
 * ========================================================================== */

export * from './providers/AppProviders.js';
export * from './providers/FeatureFlagsProvider.js';
export * from './providers/intl-provider.js';
export * from './providers/QueryClientProvider.js';
export * from './providers/TelemetryProvider.js';
export * from './providers/ToastProvider.js';
export * from './providers/UnifiedUIProvider.js';

/* ============================================================================
 * 🪝 HOOKS — REACT HOOKS
 * ========================================================================== */

export * from './hooks/useApi.js';
export * from './hooks/useAuth.js';
// useFeatureFlags и useToast уже экспортированы из providers
export * from './hooks/useOfflineCache.js';

/* ============================================================================
 * 🚀 BOOTSTRAP — ЗАПУСК ПРИЛОЖЕНИЯ
 * ========================================================================== */

export * from './bootstrap.js';
