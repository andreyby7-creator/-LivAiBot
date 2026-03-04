/**
 * @file packages/app/src — Public API для App пакета
 * Публичный API пакета @livai/app.
 * Экспортирует все публичные компоненты, утилиты, типы, провайдеры и хуки для приложения.
 * Tree-shakeable: все named exports остаются, импорты будут по нужным компонентам.
 * Принцип:
 * - разделение на подпакеты: background, events, hooks, lib, providers, routes, state, types, ui
 * - каждый подпакет имеет свой индексный файл с полным набором экспортов
 * - главный индекс реэкспортирует все подпакеты для удобства использования
 */

/* ============================================================================
 * 🚀 BOOTSTRAP — ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
 * ========================================================================== */

/**
 * Bootstrap: инициализация клиентского приложения.
 * Включает валидацию окружения, prefetch, регистрацию Service Worker и рендер.
 * @public
 */
export {
  bootstrap,
  type BootstrapEvent,
  type BootstrapEventHandler,
  type BootstrapOptions,
  type BootstrapResult,
} from './bootstrap.js';

/* ============================================================================
 * ⏰ BACKGROUND — ФОНОВЫЕ ЗАДАЧИ И ПЛАНИРОВЩИК
 * ========================================================================== */

/**
 * Background подпакет: фоновые задачи и планировщик.
 * Включает Scheduler, Background Tasks, MeldablePriorityQueue и все связанные типы.
 * @public
 */
export * from './background/index.js';

/* ============================================================================
 * 📡 EVENTS — СОБЫТИЯ И EVENT BUS
 * ========================================================================== */

/**
 * Events подпакет: события приложения и event bus.
 * Включает App Events, Event Bus, App Lifecycle Events и все связанные типы.
 * @public
 */
export * from './events/index.js';

/* ============================================================================
 * 🪝 HOOKS — REACT ХУКИ
 * ========================================================================== */

/**
 * Hooks подпакет: React хуки для работы с API, аутентификацией, кэшем, флагами и уведомлениями.
 * Включает useApi, useAuth, useOfflineCache, useFeatureFlags, useToast и все связанные типы.
 * @public
 */
export {
  type ApiClientAdapter,
  type ApiComponentState,
  type ApiContract,
  type ApiEndpointDefinition,
  type ApiUiEvent,
  type ApiUiMetrics,
  type FeatureFlagKey,
  type InvalidateMarker,
  type OfflineCacheComponentState,
  type PartialDeep,
  type ToastComponentState as ToastHookComponentState,
  type ToastDuration,
  type ToastUiEvent,
  useApi,
  type UseApiOptions,
  useAuth,
  useFeatureFlags as useFeatureFlagsHook,
  type UseFeatureFlagsApi,
  type UseFeatureFlagsUi,
  useOfflineCache,
  type UseOfflineCacheOptions,
  type UseOfflineCacheReturn,
  type UseOfflineCacheState,
  useToast,
  type UseToastApi,
} from './hooks/index.js';

/* ============================================================================
 * 🛠️ LIB — БИБЛИОТЕЧНЫЕ УТИЛИТЫ
 * ========================================================================== */

/**
 * Lib подпакет: библиотечные утилиты и сервисы.
 * Включает API Client, Auth Service, Telemetry, Validation, Effect Utils,
 * Feature Flags, I18n, Logger, Orchestrator, Performance и все связанные типы.
 * @public
 */
export {
  type Action,
  addEventToBatchCore,
  // API Client
  ApiClient,
  type ApiClientOptions,
  type ApiRequestValidator,
  type ApiResponseValidator,
  type ApiSchemaConfig,
  type ApiValidationContext,
  type ApiValidationError,
  type ApiValidationErrorCode,
  // App Lifecycle
  appLifecycle,
  type AsyncValidator,
  type AuthDecisionReason,
  type AuthError,
  type AuthErrorCode,
  // Auth Guard (ID excluded - exported from types)
  type AuthGuardContext,
  type AuthHookDepsConfig,
  buildHeaders,
  buildUrl,
  type CacheEntry,
  // Route Permissions
  checkRoutePermission,
  type Client,
  type Clients,
  type ConsoleSinkFormatter,
  createApiClient,
  createAuthHookDeps,
  createConsoleSink,
  createEffectAbortController,
  createExternalSink,
  createExternalSinkSafe,
  // Telemetry Batch Core
  createInitialBatchCoreState,
  // SSE Client
  createInitialSSEState,
  // WebSocket
  createInitialWebSocketState,
  createInMemoryOfflineCacheStore,
  // Offline Cache
  createOfflineCache,
  createTimeoutContext,
  createValidationError,
  createWebSocketEffect,
  createWebSocketLogger,
  defaultBatchCoreConfig,
  defaultDecoder,
  type Effect,
  type EffectAbortController,
  type EffectContext,
  type EffectFn,
  enforceStrictValidation,
  error,
  errorFireAndForget,
  errorMessages,
  type ExtendableEvent,
  type ExternalSdk,
  fail,
  type FallbackType,
  type FeatureAttributes,
  type FeatureAttributeValue,
  type FeatureContext,
  type FeatureFlagDefinition,
  type FeatureFlagLogger,
  type FeatureFlagName,
  type FeatureFlagStrategy,
  type FetchEvent,
  fireAndForget,
  flushBatchCore,
  formatDateLocalized,
  getAvailableRouteTypes,
  getCurrentDayjsLocale,
  getFireAndForgetMetrics,
  getGlobalClientForDebug,
  getGlobalFeatureFlagLogger,
  getGlobalTelemetryClient,
  getRoutePolicy,
  info,
  infoFireAndForget,
  // Telemetry Runtime
  initTelemetry,
  isDayjsLocaleSupported,
  isIsolationError,
  IsolationError,
  type IsolationOptions,
  isRtlLocale,
  isSchemaValidationError,
  isTelemetryInitialized,
  isTimeoutError,
  isValidTelemetrySink,
  kindToErrorCode,
  type KnownFeatureAttributes,
  levelPriority,
  type LifecycleHookEvent,
  type LifecycleHookHandler,
  type LifecycleStage,
  // Logger
  log,
  type LogContext,
  logFireAndForget,
  type LogLevel,
  type LogMetadata,
  logOperationFailure,
  logOperationStart,
  logOperationSuccess,
  mainCacheName,
  // Error Mapping
  mapError,
  type MapErrorConfig,
  mapHttpError,
  type MappedError,
  type OfflineCacheContext,
  type OfflineCacheEvents,
  type OfflineCacheOptions,
  type OfflineCacheResult,
  type OfflineCacheStore,
  ok,
  orchestrate,
  parseJsonSafe,
  type PerformanceConfig,
  type PerformanceError,
  type PerformanceErrorCode,
  PerformanceErrorCodes,
  type PerformanceMetric,
  // Performance
  PerformanceMetricType,
  type PerformanceMetricType as PerformanceMetricTypeType,
  PerformanceSeverity,
  type PerformanceSeverity as PerformanceSeverityType,
  type Permission,
  pipe,
  pipeEffects,
  precacheMainUrls,
  precacheStaticUrls,
  type ReconnectStrategy,
  resetGlobalTelemetryClient,
  type Resource,
  type ResourceType,
  type RetryPolicy,
  type RouteDecisionReason,
  type RouteInfo,
  type RoutePermissionContext,
  type RoutePermissionResult,
  type RoutePermissionRule,
  type RouteType,
  // Effect Isolation
  runIsolated,
  safeExecute,
  type SafeOriginError,
  SchemaValidationError,
  type ServiceErrorCode,
  type ServicePrefix,
  SERVICES,
  // I18n
  setDayjsLocale,
  setDayjsLocaleSync,
  setGlobalClientForDebug,
  // Feature Flags
  setGlobalFeatureFlagLogger,
  shouldFlushBatchCore,
  type SSEClientConfig,
  type SSEClientState,
  type SSEConnectionState,
  type SSEDecoder,
  type SSEFrame,
  type SSEProtocolEvent,
  type SSETelemetry,
  staticCacheName,
  type Step,
  // Orchestrator
  step,
  type StepResult,
  // Service Worker
  swDisabled,
  t,
  type TaggedError,
  telemetryBatchCore,
  type TelemetryBatchCoreConfigExtended,
  // Telemetry
  TelemetryClient,
  telemetryLevels,
  testResetTranslationStore,
  type TimeoutEffectContext,
  TimeoutError,
  TimeoutError as EffectTimeoutError,
  type TimeoutOptions,
  type TransformEventHook,
  useTranslations,
  validateApiInteraction,
  // API Schema Guard
  validateApiRequest,
  validateApiResponse,
  // Schema Validated Effect
  validatedEffect,
  type ValidatedEffectOptions,
  validateTimeoutMs,
  type ValidationContext,
  type ValidationError as LibValidationError,
  // Validation
  validationError,
  type ValidationResult,
  type ValidationSchema,
  type Validator,
  warn,
  warnFireAndForget,
  type WebSocketClientConfig,
  type WebSocketClientState,
  type WebSocketConnectionState,
  type WebSocketEffect,
  type WebSocketEvent,
  type WebSocketHandlers,
  type WebSocketHandlersWithTracing,
  WebVitalsMetric,
  type WindowClient,
  withRetry,
  // Effect Utils
  withTimeout,
  // Effect Timeout
  withTimeout as withTimeoutEffect,
} from './lib/index.js';

/* ============================================================================
 * 🎯 PROVIDERS — REACT ПРОВАЙДЕРЫ
 * ========================================================================== */

/**
 * Providers подпакет: React провайдеры для приложения.
 * Включает AppProviders, FeatureFlagsProvider, IntlProvider, QueryClientProvider,
 * TelemetryProvider, ToastProvider, UnifiedUIProvider и все связанные типы.
 * @public
 */
export {
  type AddToastParams,
  AppProviders,
  type AppProvidersProps,
  AppQueryClientProvider,
  type AppQueryClientProviderProps,
  type AppUiAuthContext,
  AuthGuardBridge,
  type FeatureFlagsActions,
  FeatureFlagsProvider,
  type FeatureFlagsProviderProps,
  type FeatureFlagsState,
  type FeatureFlagsStore,
  featureFlagsStore,
  IntlProvider,
  type IntlProviderProps,
  type QueryComponentState,
  TelemetryContext,
  type TelemetryContextType,
  TelemetryProvider,
  type TelemetryProviderProps,
  type ToastComponentState as ToastProviderComponentState,
  ToastContext,
  type ToastContextType,
  type ToastItem,
  ToastProvider,
  type ToastProviderProps,
  type ToastType,
  type UiFeatureFlagsAlias,
  type UiMetricsAlias,
  UnifiedUIContext,
  type UnifiedUIContextType,
  type UnifiedUiFeatureFlagsApi,
  type UnifiedUiI18nContext,
  UnifiedUIProvider,
  type UnifiedUIProviderProps,
  type UnifiedUiTelemetryApi,
  useFeatureFlags as useFeatureFlagsProvider,
  useRequiredUnifiedUI,
  useTelemetryContext,
  useToastContext,
  useUnifiedFeatureFlags,
  useUnifiedI18n,
  useUnifiedTelemetry,
  useUnifiedUI,
} from './providers/index.js';

/* ============================================================================
 * 🛣️ ROUTES — МАРШРУТЫ И НАВИГАЦИЯ
 * ========================================================================== */

/**
 * Routes подпакет: маршруты и навигация.
 * Включает Routes, Route Meta, Navigation и все связанные типы.
 * @public
 */
export * from './routes/index.js';

/* ============================================================================
 * 🗄️ STATE — СОСТОЯНИЕ ПРИЛОЖЕНИЯ
 * ========================================================================== */

/**
 * State подпакет: управление состоянием приложения.
 * Включает Store, Store Utils, Reset, Query Client и все связанные типы.
 * @public
 */
export * from './state/index.js';

/* ============================================================================
 * 🧬 TYPES — ТИПЫ
 * ========================================================================== */

/**
 * Types подпакет: типы для всего приложения.
 * Включает API типы, Common типы, Error типы, Telemetry типы, UI Contracts и все связанные типы.
 * @public
 */
export {
  AllUserRoles,
  type ApiAuthContext,
  type ApiClientConfig,
  type ApiError,
  type ApiError as CommonApiError,
  type ApiErrorCategory,
  type ApiErrorSource,
  type ApiFailure,
  type ApiFailureResponse,
  type ApiHandler,
  type ApiHeaders,
  type ApiMetrics,
  type ApiRequest,
  type ApiRequestContext,
  type ApiResponse,
  type ApiResponse as CommonApiResponse,
  type ApiRetryPolicy,
  type ApiServiceName,
  type ApiSuccess,
  type ApiSuccessResponse,
  type AppContext,
  type AppError,
  type AppFileStatus,
  type AppModule,
  AppModules,
  type AppWrapperProps,
  type AsyncError,
  type AsyncFn,
  type AsyncIdle,
  type AsyncLoading,
  type AsyncState,
  type AsyncStatus,
  type AsyncSuccess,
  type AuthContext,
  type BaseApiDTO,
  type BaseDTO,
  type BatchConfig,
  BatchCoreConfigVersion,
  type ClientError,
  type ComponentState,
  type ControlledFieldProps,
  // Error Types
  createServerError,
  type CustomLevelPriority,
  defaultTelemetryTimezone,
  type DropPolicy,
  type ErrorBoundaryErrorCode,
  type ErrorCategory,
  type ErrorFn,
  type ErrorHandler,
  type ErrorSource,
  type FallbackPriorityStrategy,
  type FeatureFlags,
  type FileValidationResult,
  type FrontendErrorSource,
  handleError,
  type Handler,
  // API Types
  type HttpMethod,
  type ID,
  type Identifiable,
  type Immutable,
  type InternalFileInfo,
  type IsErrorOfType,
  type ISODateString,
  type Json,
  type JsonArray,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue,
  type Loggable,
  type MapCoreProps,
  type Maybe,
  type NetworkError,
  type NonPIIField,
  type Nullable,
  type Optional,
  type PaginatedResponse,
  type PaginatedResult,
  type PaginationParams,
  type PIIField,
  type Platform,
  type RealtimeEvent,
  type RealtimeEvent as CommonRealtimeEvent,
  type RealtimeSubscription,
  type RetryConfig,
  type RouteConfig,
  type ServerError,
  type SoftDeletable,
  type Subscription,
  type TelemetryBatchCoreConfig,
  type TelemetryBatchCoreState,
  type TelemetryConfig,
  type TelemetryEvent,
  type TelemetryLevel,
  // Telemetry Types
  TelemetryLevels,
  type TelemetryLevelTemplate,
  type TelemetryMetadata,
  type TelemetryPrimitive,
  type TelemetrySink,
  type TelemetryTimezone,
  type ThrottleConfig,
  type UiAuthContext,
  type UiEvent,
  type UiEventHandler,
  type UiEventMap,
  // UI Contracts
  type UiFeatureFlagName,
  type UiFeatureFlags,
  type UiFeatureFlagsApi,
  type UiI18nContext,
  type UiMetrics,
  type UiPrimitiveProps,
  type UiStatefulComponentProps,
  type UiStatePolicy,
  type UiTelemetryApi,
  type UiTelemetryMetrics,
  type UncontrolledFieldProps,
  type UnknownError,
  type UploadDomainStatus,
  type UserRole,
  // Common Types
  UserRoles,
  type ValidationError,
  type VersionedEntity,
  type VoidFn,
} from './types/index.js';

/* ============================================================================
 * 🎨 UI — UI КОМПОНЕНТЫ
 * ========================================================================== */

/**
 * UI подпакет: UI компоненты приложения.
 * Включает примитивы (Button, Input, Textarea, Select, Checkbox, Radio, Toggle, Icon,
 * Avatar, Badge, Tooltip, Divider, Card, Dialog, Form, LoadingSpinner, Dropdown,
 * ContextMenu, StatusIndicator) и композитные компоненты (Toast, Skeleton, Modal,
 * Breadcrumbs, Tabs, Accordion, DatePicker, FileUploader, SideBar, SearchBar,
 * ConfirmDialog, ErrorBoundary, UserProfileDisplay, NavigationMenuItem,
 * LanguageSelector, SupportButton) и все связанные типы.
 * @public
 */
export * from './ui/index.js';
