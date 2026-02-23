/**
 * @file packages/app/src/events — Events & Event Bus
 *
 * Публичный API пакета events.
 * Экспортирует все публичные компоненты, типы и утилиты для событий приложения и event bus.
 */

/* ============================================================================
 * 📡 APP EVENTS — СОБЫТИЯ ПРИЛОЖЕНИЯ
 * ========================================================================== */

/**
 * App Events: типизированные события приложения с валидацией и версионированием.
 * Включает типы событий, схемы payload, функции создания и проверки событий.
 *
 * @public
 */
export {
  AppEventType,
  eventSchemaVersions,
  LoginEventPayloadSchema,
  LogoutEventPayloadSchema,
  AuthExpiredEventPayloadSchema,
  BillingChangedEventPayloadSchema,
  createLoginEvent,
  createLogoutEvent,
  createAuthExpiredEvent,
  createBillingChangedEvent,
  isLoginEvent,
  isLogoutEvent,
  isAuthExpiredEvent,
  isBillingChangedEvent,
  pushToQueue,
  type EventInitiator,
  type LoginEventPayload,
  type LogoutEventPayload,
  type AuthExpiredEventPayload,
  type BillingChangedEventPayload,
  type BaseAppEvent,
  type LoginEvent,
  type LogoutEvent,
  type AuthExpiredEvent,
  type BillingChangedEvent,
  type AppEvent,
} from './app-events.js';

/* ============================================================================
 * 🚀 EVENT BUS — ШИНА СОБЫТИЙ
 * ========================================================================== */

/**
 * Event Bus: типизированная шина событий с поддержкой publish/subscribe,
 * audit log, batch push в очередь с retry и fail-safe.
 *
 * @public
 */
export {
  EventBus,
  ConsoleLogger,
  eventBus,
  onEvent,
  onAnyEvent,
  publishEvent,
  flushEventBatch,
  type EventHandler,
  type StructuredLogger,
} from './event-bus.js';

/* ============================================================================
 * 🔄 APP LIFECYCLE EVENTS — СОБЫТИЯ ЖИЗНЕННОГО ЦИКЛА
 * ========================================================================== */

/**
 * App Lifecycle Events: простой event hub для lifecycle-событий приложения.
 * Включает события bootstrap, ready, teardown, logout, reset.
 * Без payload, без domain-логики, только инфраструктурные события.
 *
 * @public
 */
export {
  AppLifecycleEvent,
  appLifecycleEvents,
  type UnsubscribeFn,
} from './app-lifecycle-events.js';
