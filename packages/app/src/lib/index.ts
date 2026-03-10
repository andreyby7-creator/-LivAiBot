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
 * 🛣️ ROUTE ACCESS — ПРОВЕРКА ДОСТУПА К МАРШРУТАМ ДЛЯ UI
 * ========================================================================== */

/**
 * Route Access: UI-специфичные утилиты для проверки доступа к маршрутам.
 * @public
 */
export { canAccessRoute } from './route-access.js';

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
