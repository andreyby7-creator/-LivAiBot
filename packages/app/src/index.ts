/**
 * @file packages/app/src — Public API для App пакета
 *
 * Публичный API пакета @livai/app.
 * Экспортирует все публичные компоненты, утилиты, типы, провайдеры и хуки для приложения.
 * Tree-shakeable: все named exports остаются, импорты будут по нужным компонентам.
 *
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
 *
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
 *
 * @public
 */
export * from './background/index.js';

/* ============================================================================
 * 📡 EVENTS — СОБЫТИЯ И EVENT BUS
 * ========================================================================== */

/**
 * Events подпакет: события приложения и event bus.
 * Включает App Events, Event Bus, App Lifecycle Events и все связанные типы.
 *
 * @public
 */
export * from './events/index.js';

/* ============================================================================
 * 🪝 HOOKS — REACT ХУКИ
 * ========================================================================== */

/**
 * Hooks подпакет: React хуки для работы с API, аутентификацией, кэшем, флагами и уведомлениями.
 * Включает useApi, useAuth, useOfflineCache, useFeatureFlags, useToast и все связанные типы.
 *
 * @public
 */
export {
  useApi,
  useAuth,
  useOfflineCache,
  useFeatureFlags as useFeatureFlagsHook,
  useToast,
  authSelectors,
  type ApiUiEvent,
  type ApiComponentState,
  type ApiUiMetrics,
  type ApiEndpointDefinition,
  type ApiContract,
  type ApiClientAdapter,
  type UseApiOptions,
  type OfflineCacheComponentState,
  type PartialDeep,
  type InvalidateMarker,
  type UseOfflineCacheState,
  type UseOfflineCacheOptions,
  type UseOfflineCacheReturn,
  type UseFeatureFlagsUi,
  type FeatureFlagKey,
  type UseFeatureFlagsApi,
  type ToastUiEvent,
  type ToastComponentState as ToastHookComponentState,
  type ToastDuration,
  type UseToastApi,
} from './hooks/index.js';

/* ============================================================================
 * 🛠️ LIB — БИБЛИОТЕЧНЫЕ УТИЛИТЫ
 * ========================================================================== */

/**
 * Lib подпакет: библиотечные утилиты и сервисы.
 * Включает API Client, Auth Service, Telemetry, Validation, Effect Utils,
 * Feature Flags, I18n, Logger, Orchestrator, Performance и все связанные типы.
 *
 * @public
 */
export {
  // API Client
  ApiClient,
  createApiClient,
  buildUrl,
  buildHeaders,
  parseJsonSafe,
  mapHttpError,
  type ApiClientOptions,
  // API Schema Guard
  validateApiRequest,
  validateApiResponse,
  validateApiInteraction,
  enforceStrictValidation,
  type ApiValidationContext,
  type ApiValidationErrorCode,
  type ApiValidationError,
  type ApiRequestValidator,
  type ApiResponseValidator,
  type ApiSchemaConfig,
  // Auth Service
  AuthService,
  authService,
  createAuthService,
  type LoginRequest,
  type TokenPairResponse,
  type AuthError as AuthServiceError,
  // Auth Guard (ID excluded - exported from types)
  type AuthGuardContext,
  type Permission,
  type ResourceType,
  type Resource,
  type Action,
  type AuthErrorCode,
  type AuthError,
  type AuthDecisionReason,
  // Offline Cache
  createOfflineCache,
  createInMemoryOfflineCacheStore,
  pipeEffects,
  type OfflineCacheEvents,
  type OfflineCacheContext,
  type CacheEntry,
  type OfflineCacheStore,
  type OfflineCacheOptions,
  type OfflineCacheResult,
  // Effect Utils
  withTimeout,
  withRetry,
  createEffectAbortController,
  safeExecute,
  TimeoutError,
  type EffectFn,
  type Effect,
  type EffectContext,
  type RetryPolicy,
  type EffectAbortController,
  // Effect Isolation
  runIsolated,
  IsolationError,
  isIsolationError,
  type IsolationOptions,
  // Effect Timeout
  withTimeout as withTimeoutEffect,
  createTimeoutContext,
  validateTimeoutMs,
  TimeoutError as EffectTimeoutError,
  isTimeoutError,
  type TimeoutOptions,
  type TimeoutEffectContext,
  // Schema Validated Effect
  validatedEffect,
  createValidationError,
  SchemaValidationError,
  isSchemaValidationError,
  type ValidatedEffectOptions,
  // Error Mapping
  mapError,
  SERVICES,
  errorMessages,
  kindToErrorCode,
  type TaggedError,
  type ServicePrefix,
  type ServiceErrorCode,
  type SafeOriginError,
  type MappedError,
  type MapErrorConfig,
  // Validation
  validationError,
  ok,
  fail,
  pipe,
  type ValidationSchema,
  type ValidationContext,
  type ValidationError as LibValidationError,
  type ValidationResult,
  type Validator,
  type AsyncValidator,
  // Telemetry
  TelemetryClient,
  telemetryLevels,
  levelPriority,
  isValidTelemetrySink,
  createConsoleSink,
  createExternalSink,
  createExternalSinkSafe,
  getGlobalClientForDebug,
  type ConsoleSinkFormatter,
  type ExternalSdk,
  // Telemetry Runtime
  initTelemetry,
  getGlobalTelemetryClient,
  isTelemetryInitialized,
  resetGlobalTelemetryClient,
  setGlobalClientForDebug,
  fireAndForget,
  logFireAndForget,
  getFireAndForgetMetrics,
  infoFireAndForget,
  warnFireAndForget,
  errorFireAndForget,
  // Telemetry Batch Core
  createInitialBatchCoreState,
  addEventToBatchCore,
  flushBatchCore,
  shouldFlushBatchCore,
  telemetryBatchCore,
  defaultBatchCoreConfig,
  type TransformEventHook,
  type TelemetryBatchCoreConfigExtended,
  // Feature Flags
  setGlobalFeatureFlagLogger,
  getGlobalFeatureFlagLogger,
  type FeatureAttributeValue,
  type KnownFeatureAttributes,
  type FeatureAttributes,
  type FeatureFlagLogger,
  type FeatureContext,
  type FeatureFlagName,
  type FeatureFlagDefinition,
  type FeatureFlagStrategy,
  // I18n
  setDayjsLocale,
  setDayjsLocaleSync,
  getCurrentDayjsLocale,
  isRtlLocale,
  isDayjsLocaleSupported,
  formatDateLocalized,
  t,
  useTranslations,
  testResetTranslationStore,
  type FallbackType,
  // Logger
  log,
  info,
  warn,
  error,
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
  type LogLevel,
  type LogContext,
  type LogMetadata,
  // Orchestrator
  step,
  orchestrate,
  type Step,
  type StepResult,
  // Performance
  PerformanceMetricType,
  PerformanceSeverity,
  PerformanceErrorCodes,
  WebVitalsMetric,
  type PerformanceMetricType as PerformanceMetricTypeType,
  type PerformanceSeverity as PerformanceSeverityType,
  type PerformanceMetric,
  type PerformanceConfig,
  type PerformanceError,
  type PerformanceErrorCode,
  // Route Permissions
  checkRoutePermission,
  getRoutePolicy,
  getAvailableRouteTypes,
  type RouteType,
  type RouteInfo,
  type RoutePermissionRule,
  type RoutePermissionContext,
  type RouteDecisionReason,
  type RoutePermissionResult,
  // App Lifecycle
  appLifecycle,
  type LifecycleStage,
  type LifecycleHookEvent,
  type LifecycleHookHandler,
  // SSE Client
  createInitialSSEState,
  defaultDecoder,
  type SSEConnectionState,
  type SSEFrame,
  type SSEProtocolEvent,
  type SSEDecoder,
  type ReconnectStrategy,
  type SSETelemetry,
  type SSEClientState,
  type SSEClientConfig,
  // WebSocket
  createInitialWebSocketState,
  createWebSocketLogger,
  createWebSocketEffect,
  type WebSocketConnectionState,
  type WebSocketEvent,
  type WebSocketClientState,
  type WebSocketClientConfig,
  type WebSocketHandlers,
  type WebSocketHandlersWithTracing,
  type WebSocketEffect,
  // Service Worker
  swDisabled,
  mainCacheName,
  staticCacheName,
  precacheMainUrls,
  precacheStaticUrls,
  type Client,
  type WindowClient,
  type Clients,
  type ExtendableEvent,
  type FetchEvent,
} from './lib/index.js';

/* ============================================================================
 * 🎯 PROVIDERS — REACT ПРОВАЙДЕРЫ
 * ========================================================================== */

/**
 * Providers подпакет: React провайдеры для приложения.
 * Включает AppProviders, FeatureFlagsProvider, IntlProvider, QueryClientProvider,
 * TelemetryProvider, ToastProvider, UnifiedUIProvider и все связанные типы.
 *
 * @public
 */
export {
  AppProviders,
  AuthGuardBridge,
  FeatureFlagsProvider,
  featureFlagsStore,
  useFeatureFlags as useFeatureFlagsProvider,
  IntlProvider,
  AppQueryClientProvider,
  TelemetryProvider,
  useTelemetryContext,
  TelemetryContext,
  ToastProvider,
  useToastContext,
  ToastContext,
  UnifiedUIProvider,
  UnifiedUIContext,
  useUnifiedUI,
  useRequiredUnifiedUI,
  useUnifiedFeatureFlags,
  useUnifiedTelemetry,
  useUnifiedI18n,
  type AppUiAuthContext,
  type AppProvidersProps,
  type UiFeatureFlagsAlias,
  type FeatureFlagsState,
  type FeatureFlagsActions,
  type FeatureFlagsStore,
  type FeatureFlagsProviderProps,
  type IntlProviderProps,
  type QueryComponentState,
  type AppQueryClientProviderProps,
  type UiMetricsAlias,
  type TelemetryContextType,
  type TelemetryProviderProps,
  type ToastComponentState as ToastProviderComponentState,
  type ToastType,
  type ToastItem,
  type ToastContextType,
  type AddToastParams,
  type ToastProviderProps,
  type UnifiedUiFeatureFlagsApi,
  type UnifiedUiTelemetryApi,
  type UnifiedUiI18nContext,
  type UnifiedUIContextType,
  type UnifiedUIProviderProps,
} from './providers/index.js';

/* ============================================================================
 * 🛣️ ROUTES — МАРШРУТЫ И НАВИГАЦИЯ
 * ========================================================================== */

/**
 * Routes подпакет: маршруты и навигация.
 * Включает Routes, Route Meta, Navigation и все связанные типы.
 *
 * @public
 */
export * from './routes/index.js';

/* ============================================================================
 * 🗄️ STATE — СОСТОЯНИЕ ПРИЛОЖЕНИЯ
 * ========================================================================== */

/**
 * State подпакет: управление состоянием приложения.
 * Включает Store, Store Utils, Reset, Query Client и все связанные типы.
 *
 * @public
 */
export * from './state/index.js';

/* ============================================================================
 * 🧬 TYPES — ТИПЫ
 * ========================================================================== */

/**
 * Types подпакет: типы для всего приложения.
 * Включает API типы, Common типы, Error типы, Telemetry типы, UI Contracts и все связанные типы.
 *
 * @public
 */
export {
  // API Types
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
  // Common Types
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
  // Error Types
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
  // Telemetry Types
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
  // UI Contracts
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
 *
 * @public
 */
export * from './ui/index.js';
