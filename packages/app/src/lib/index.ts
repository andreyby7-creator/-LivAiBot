/**
 * @file packages/app/src/lib — Library Utilities
 *
 * Публичный API пакета lib.
 * Экспортирует все публичные утилиты, сервисы и типы для работы приложения.
 */

/* ============================================================================
 * 🔌 API CLIENT — КЛИЕНТ API
 * ========================================================================== */

/**
 * API Client: клиент для выполнения HTTP запросов с поддержкой типизации и обработки ошибок.
 *
 * @public
 */
export {
  ApiClient,
  createApiClient,
  buildUrl,
  buildHeaders,
  parseJsonSafe,
  mapHttpError,
  type ApiClientOptions,
} from './api-client.js';

/* ============================================================================
 * 🛡️ API SCHEMA GUARD — ВАЛИДАЦИЯ API
 * ========================================================================== */

/**
 * API Schema Guard: валидация запросов и ответов API с типизацией.
 *
 * @public
 */
export {
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
} from './api-schema-guard.js';

/* ============================================================================
 * 🔐 AUTH SERVICE — СЕРВИС АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * Auth Service: сервис для управления аутентификацией и токенами.
 *
 * @public
 */
export {
  AuthService,
  authService,
  createAuthService,
  type LoginRequest,
  type TokenPairResponse,
  type AuthError as AuthServiceError,
} from './auth-service.js';

/* ============================================================================
 * 🛡️ AUTH GUARD — ЗАЩИТА ДОСТУПА
 * ========================================================================== */

/**
 * Auth Guard: система контроля доступа с проверкой прав и ролей.
 *
 * @public
 */
export {
  type ID,
  type AuthGuardContext,
  type UserRole,
  type Permission,
  type ResourceType,
  type Resource,
  type Action,
  type AuthErrorCode,
  type AuthError,
  type AuthDecisionReason,
} from './auth-guard.js';

/* ============================================================================
 * 🗄️ OFFLINE CACHE — ОФФЛАЙН КЭШ
 * ========================================================================== */

/**
 * Offline Cache: система кэширования данных для работы в оффлайн режиме.
 *
 * @public
 */
export {
  createOfflineCache,
  createInMemoryOfflineCacheStore,
  pipeEffects,
  type OfflineCacheEvents,
  type OfflineCacheContext,
  type CacheKey,
  type CacheEntry,
  type OfflineCacheStore,
  type OfflineCacheOptions,
  type OfflineCacheResult,
} from './offline-cache.js';

/* ============================================================================
 * ⚡ EFFECT UTILS — УТИЛИТЫ ДЛЯ EFFECT
 * ========================================================================== */

/**
 * Effect Utils: утилиты для работы с Effect и асинхронными операциями.
 *
 * @public
 */
export {
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
} from './effect-utils.js';

/* ============================================================================
 * 🔒 EFFECT ISOLATION — ИЗОЛЯЦИЯ EFFECT
 * ========================================================================== */

/**
 * Effect Isolation: изоляция выполнения Effect для безопасности.
 *
 * @public
 */
export {
  runIsolated,
  IsolationError,
  isIsolationError,
  type IsolationOptions,
} from './effect-isolation.js';

/* ============================================================================
 * ⏱️ EFFECT TIMEOUT — ТАЙМАУТЫ ДЛЯ EFFECT
 * ========================================================================== */

/**
 * Effect Timeout: управление таймаутами для Effect операций.
 *
 * @public
 */
export {
  withTimeout as withTimeoutEffect,
  createTimeoutContext,
  validateTimeoutMs,
  TimeoutError as EffectTimeoutError,
  isTimeoutError,
  type TimeoutOptions,
  type TimeoutEffectContext,
} from './effect-timeout.js';

/* ============================================================================
 * 🎯 SCHEMA VALIDATED EFFECT — ВАЛИДАЦИЯ СХЕМ
 * ========================================================================== */

/**
 * Schema Validated Effect: Effect с валидацией схем данных.
 *
 * @public
 */
export {
  validatedEffect,
  createValidationError,
  SchemaValidationError,
  isSchemaValidationError,
  type ValidatedEffectOptions,
} from './schema-validated-effect.js';

/* ============================================================================
 * 🚨 ERROR MAPPING — МАППИНГ ОШИБОК
 * ========================================================================== */

/**
 * Error Mapping: маппинг и нормализация ошибок между сервисами.
 *
 * @public
 */
export {
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
} from './error-mapping.js';

/* ============================================================================
 * ✅ VALIDATION — ВАЛИДАЦИЯ
 * ========================================================================== */

/**
 * Validation: система валидации данных с типизацией.
 *
 * @public
 */
export {
  validationError,
  ok,
  fail,
  pipe,
  type ValidationSchema,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type Validator,
  type AsyncValidator,
} from './validation.js';

/* ============================================================================
 * 📊 TELEMETRY — ТЕЛЕМЕТРИЯ
 * ========================================================================== */

/**
 * Telemetry: система телеметрии для мониторинга и логирования.
 *
 * @public
 */
export {
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
} from './telemetry.js';

/* ============================================================================
 * 📡 TELEMETRY RUNTIME — РАНТАЙМ ТЕЛЕМЕТРИИ
 * ========================================================================== */

/**
 * Telemetry Runtime: runtime утилиты для работы с телеметрией.
 *
 * @public
 */
export {
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
} from './telemetry-runtime.js';

/* ============================================================================
 * 📦 TELEMETRY BATCH CORE — БАТЧИНГ ТЕЛЕМЕТРИИ
 * ========================================================================== */

/**
 * Telemetry Batch Core: батчинг событий телеметрии для оптимизации.
 *
 * @public
 */
export {
  createInitialBatchCoreState,
  addEventToBatchCore,
  flushBatchCore,
  shouldFlushBatchCore,
  telemetryBatchCore,
  defaultBatchCoreConfig,
  type TransformEventHook,
  type TelemetryBatchCoreConfigExtended,
} from './telemetry.batch-core.js';

/* ============================================================================
 * 🚩 FEATURE FLAGS — ФЛАГИ ФУНКЦИЙ
 * ========================================================================== */

/**
 * Feature Flags: система управления feature flags с контекстом и стратегиями.
 *
 * @public
 */
export {
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
} from './feature-flags.js';

/* ============================================================================
 * 🌐 I18N — ИНТЕРНАЦИОНАЛИЗАЦИЯ
 * ========================================================================== */

/**
 * I18n: система интернационализации с поддержкой локалей и форматирования дат.
 *
 * @public
 */
export {
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
} from './i18n.js';

/* ============================================================================
 * 📝 LOGGER — ЛОГГЕР
 * ========================================================================== */

/**
 * Logger: система логирования с уровнями и контекстом.
 *
 * @public
 */
export {
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
} from './logger.js';

/* ============================================================================
 * 🎭 ORCHESTRATOR — ОРКЕСТРАТОР
 * ========================================================================== */

/**
 * Orchestrator: оркестрация выполнения шагов с изоляцией и таймаутами.
 *
 * @public
 */
export {
  step,
  orchestrate,
  type Step,
  type StepResult,
} from './orchestrator.js';

/* ============================================================================
 * ⚡ PERFORMANCE — ПРОИЗВОДИТЕЛЬНОСТЬ
 * ========================================================================== */

/**
 * Performance: мониторинг производительности и Web Vitals.
 *
 * @public
 */
export {
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
} from './performance.js';

/* ============================================================================
 * 🛣️ ROUTE PERMISSIONS — ПРАВА ДОСТУПА К МАРШРУТАМ
 * ========================================================================== */

/**
 * Route Permissions: проверка прав доступа к маршрутам.
 *
 * @public
 */
export {
  checkRoutePermission,
  getRoutePolicy,
  getAvailableRouteTypes,
  type RouteType,
  type RouteInfo,
  type RoutePermissionRule,
  type RoutePermissionContext,
  type RouteDecisionReason,
  type RoutePermissionResult,
} from './route-permissions.js';

/* ============================================================================
 * 🔄 APP LIFECYCLE — ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ
 * ========================================================================== */

/**
 * App Lifecycle: управление жизненным циклом приложения.
 *
 * @public
 */
export {
  appLifecycle,
  type LifecycleStage,
  type LifecycleHookEvent,
  type LifecycleHookHandler,
} from './app-lifecycle.js';

/* ============================================================================
 * 🔌 SSE CLIENT — КЛИЕНТ SSE
 * ========================================================================== */

/**
 * SSE Client: клиент для работы с Server-Sent Events.
 *
 * @public
 */
export {
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
} from './sse-client.js';

/* ============================================================================
 * 🔌 WEBSOCKET — КЛИЕНТ WEBSOCKET
 * ========================================================================== */

/**
 * WebSocket: клиент для работы с WebSocket соединениями.
 *
 * @public
 */
export {
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
} from './websocket.js';

/* ============================================================================
 * 🔧 SERVICE WORKER — СЕРВИСНЫЙ ВОРКЕР
 * ========================================================================== */

/**
 * Service Worker: утилиты для работы с service worker и кэшированием.
 *
 * @public
 */
export {
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
} from './service-worker.js';
