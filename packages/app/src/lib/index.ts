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
  type ApiClientOptions,
  buildHeaders,
  buildUrl,
  createApiClient,
  mapHttpError,
  parseJsonSafe,
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
  type ApiRequestValidator,
  type ApiResponseValidator,
  type ApiSchemaConfig,
  type ApiValidationContext,
  type ApiValidationError,
  type ApiValidationErrorCode,
  enforceStrictValidation,
  validateApiInteraction,
  validateApiRequest,
  validateApiResponse,
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
  type AuthError as AuthServiceError,
  AuthService,
  authService,
  createAuthService,
  type LoginRequest,
  type TokenPairResponse,
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
  type Action,
  type AuthDecisionReason,
  type AuthError,
  type AuthErrorCode,
  type AuthGuardContext,
  type ID,
  type Permission,
  type Resource,
  type ResourceType,
  type UserRole,
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
  type CacheEntry,
  type CacheKey,
  createInMemoryOfflineCacheStore,
  createOfflineCache,
  type OfflineCacheContext,
  type OfflineCacheEvents,
  type OfflineCacheOptions,
  type OfflineCacheResult,
  type OfflineCacheStore,
  pipeEffects,
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
  createEffectAbortController,
  type Effect,
  type EffectAbortController,
  type EffectContext,
  type EffectFn,
  type RetryPolicy,
  safeExecute,
  TimeoutError,
  withRetry,
  withTimeout,
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
  isIsolationError,
  IsolationError,
  type IsolationOptions,
  runIsolated,
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
  createTimeoutContext,
  isTimeoutError,
  type TimeoutEffectContext,
  TimeoutError as EffectTimeoutError,
  type TimeoutOptions,
  validateTimeoutMs,
  withTimeout as withTimeoutEffect,
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
  createValidationError,
  isSchemaValidationError,
  SchemaValidationError,
  validatedEffect,
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
  errorMessages,
  kindToErrorCode,
  mapError,
  type MapErrorConfig,
  type MappedError,
  type SafeOriginError,
  type ServiceErrorCode,
  type ServicePrefix,
  SERVICES,
  type TaggedError,
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
  type AsyncValidator,
  fail,
  ok,
  pipe,
  type ValidationContext,
  type ValidationError,
  validationError,
  type ValidationResult,
  type ValidationSchema,
  type Validator,
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
  addEventToBatchCore,
  createInitialBatchCoreState,
  defaultBatchCoreConfig,
  flushBatchCore,
  shouldFlushBatchCore,
  telemetryBatchCore,
  type TelemetryBatchCoreConfigExtended,
  type TransformEventHook,
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
  type FeatureAttributes,
  type FeatureAttributeValue,
  type FeatureContext,
  type FeatureFlagDefinition,
  type FeatureFlagLogger,
  type FeatureFlagName,
  type FeatureFlagStrategy,
  getGlobalFeatureFlagLogger,
  type KnownFeatureAttributes,
  setGlobalFeatureFlagLogger,
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
  type FallbackType,
  formatDateLocalized,
  getCurrentDayjsLocale,
  isDayjsLocaleSupported,
  isRtlLocale,
  setDayjsLocale,
  setDayjsLocaleSync,
  t,
  testResetTranslationStore,
  useTranslations,
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
  error,
  info,
  log,
  type LogContext,
  type LogLevel,
  type LogMetadata,
  logOperationFailure,
  logOperationStart,
  logOperationSuccess,
  warn,
} from './logger.js';

/* ============================================================================
 * 🎭 ORCHESTRATOR — ОРКЕСТРАТОР
 * ========================================================================== */

/**
 * Orchestrator: оркестрация выполнения шагов с изоляцией и таймаутами.
 *
 * @public
 */
export { orchestrate, type Step, step, type StepResult } from './orchestrator.js';

/* ============================================================================
 * ⚡ PERFORMANCE — ПРОИЗВОДИТЕЛЬНОСТЬ
 * ========================================================================== */

/**
 * Performance: мониторинг производительности и Web Vitals.
 *
 * @public
 */
export {
  type PerformanceConfig,
  type PerformanceError,
  type PerformanceErrorCode,
  PerformanceErrorCodes,
  type PerformanceMetric,
  PerformanceMetricType,
  type PerformanceMetricType as PerformanceMetricTypeType,
  PerformanceSeverity,
  type PerformanceSeverity as PerformanceSeverityType,
  WebVitalsMetric,
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
  getAvailableRouteTypes,
  getRoutePolicy,
  type RouteDecisionReason,
  type RouteInfo,
  type RoutePermissionContext,
  type RoutePermissionResult,
  type RoutePermissionRule,
  type RouteType,
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
  type LifecycleHookEvent,
  type LifecycleHookHandler,
  type LifecycleStage,
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
  type ReconnectStrategy,
  type SSEClientConfig,
  type SSEClientState,
  type SSEConnectionState,
  type SSEDecoder,
  type SSEFrame,
  type SSEProtocolEvent,
  type SSETelemetry,
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
  createWebSocketEffect,
  createWebSocketLogger,
  type WebSocketClientConfig,
  type WebSocketClientState,
  type WebSocketConnectionState,
  type WebSocketEffect,
  type WebSocketEvent,
  type WebSocketHandlers,
  type WebSocketHandlersWithTracing,
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
  type Client,
  type Clients,
  type ExtendableEvent,
  type FetchEvent,
  mainCacheName,
  precacheMainUrls,
  precacheStaticUrls,
  staticCacheName,
  swDisabled,
  type WindowClient,
} from './service-worker.js';
