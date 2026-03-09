/**
 * @file packages/app/src/lib — Library Utilities
 * Публичный API пакета lib.
 * Экспортирует все публичные утилиты, сервисы и типы для работы приложения.
 */

/* ============================================================================
 * 🔌 API CLIENT — КЛИЕНТ API
 * ========================================================================== */

/**
 * API Client: клиент для выполнения HTTP запросов с поддержкой типизации и обработки ошибок.
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
 * 🛡️ AUTH GUARD — ЗАЩИТА ДОСТУПА
 * ========================================================================== */

/**
 * Auth Guard: система контроля доступа с проверкой прав и ролей.
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
} from './auth-guard.js';

/* ============================================================================
 * 🔗 AUTH HOOK DI — DI-ФАБРИКА ДЛЯ useAuth
 * ========================================================================== */

/**
 * Auth Hook DI: фабрика DI-зависимостей для канонического React-хука `useAuth`.
 * @public
 */
export { type AuthHookDepsConfig, createAuthHookDeps } from './auth-hook-deps.js';

/* ============================================================================
 * 🔗 AUTH TOKEN ADAPTER — АДАПТЕР ДЛЯ ПОЛУЧЕНИЯ ТОКЕНОВ ИЗ FEATURE-AUTH
 * ========================================================================== */

/**
 * Auth Token Adapter: адаптер для получения access token из feature-auth store.
 * Используется HTTP-клиентами для автоматического добавления Authorization header.
 * @public
 * @remarks
 * - HTTP-клиент НЕ подписывается напрямую на Zustand-store.
 * - Доступ к токенам идёт только через адаптер/порт (функции app-слоя).
 */
export {
  type AuthTokenAdapter,
  type AuthTokenAdapterConfig,
  type AuthTokenAdapterLogger,
  createAuthTokenAdapter,
} from './auth-token-adapter.js';

/* ============================================================================
 * 🗄️ OFFLINE CACHE — ОФФЛАЙН КЭШ
 * ========================================================================== */

/**
 * Offline Cache: система кэширования данных для работы в оффлайн режиме.
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
 * 📡 TELEMETRY RUNTIME — РАНТАЙМ ТЕЛЕМЕТРИИ
 * ========================================================================== */

/**
 * Telemetry Runtime: runtime утилиты для работы с телеметрией.
 * @public
 */
export {
  errorFireAndForget,
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
 * 🌐 I18N — ИНТЕРНАЦИОНАЛИЗАЦИЯ
 * ========================================================================== */

/**
 * I18n: система интернационализации с поддержкой локалей и форматирования дат.
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
 * ⚡ PERFORMANCE — ПРОИЗВОДИТЕЛЬНОСТЬ
 * ========================================================================== */

/**
 * Performance: мониторинг производительности и Web Vitals.
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
 * @public
 */
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
} from './service-worker.js';
