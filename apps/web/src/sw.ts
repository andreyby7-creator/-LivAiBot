/**
 * @file apps/web/src/sw.ts
 * ============================================================================
 * 🟢 SERVICE WORKER (TypeScript) — PWA/OFFLINE ЯДРО
 * ============================================================================
 * Использует ядро из packages/app
 * - NetworkFirst, CacheFirst, StaleWhileRevalidate
 * - Push notifications
 * - Background sync
 * - Graceful degradation
 * - Telemetry-ready
 * Принципы:
 * - Zero business logic
 * - Immutable конфигурация
 * - Микросервисная архитектура
 * - Полная типизация
 */

import {
  decommissionServiceWorker,
  handleBackgroundSync,
  handleNotificationClick,
  handlePushNotification,
  handleRequest,
  mainCacheName,
  precacheMainUrls,
  precacheStaticUrls,
  staticCacheName,
  swDisabled,
  swSelf,
} from '@livai/app/lib/service-worker.js';
import type {
  ExtendableEvent,
  ExtendableMessageEvent,
  FetchEvent,
} from '@livai/app/lib/service-worker.js';

/* ============================================================================
 * 📋 ТИПЫ И КОНСТАНТЫ
 * ========================================================================== */

/** Тип события клика по уведомлению - соответствует типу из ServiceWorkerGlobalScope */
type NotificationEvent = Event & {
  notification: Notification;
  waitUntil?: (promise: Promise<unknown>) => void;
};

/** Тип события background sync */
type SyncEvent = ExtendableEvent & {
  readonly tag: string;
};

/** Стандартный ответ для оффлайн режима */
const OFFLINE_RESPONSE = new Response('Offline', {
  status: 503,
  statusText: 'Service Unavailable',
});

/** Kill-switch для Service Worker - значение может быть изменено через remote config */
const SERVICE_WORKER_DISABLED: boolean = swDisabled();

/* ============================================================================
 * 🛠️ УСТАНОВКА SERVICE WORKER
 * ========================================================================== */

/**
 * Обработчик установки Service Worker
 * Предзагружает критические ресурсы в кеш
 */
swSelf.addEventListener('install', (event: ExtendableEvent) => {
  // Kill-switch: если SW отключен, не устанавливаем
  if (SERVICE_WORKER_DISABLED) return;

  event.waitUntil(
    (async (): Promise<void> => {
      try {
        const mainCache = await caches.open(mainCacheName);
        await mainCache.addAll(precacheMainUrls as string[]).catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('[SW][Install] Failed main precache:', err);
        });

        const staticCache = await caches.open(staticCacheName);
        await staticCache.addAll(precacheStaticUrls as string[]).catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('[SW][Install] Failed static precache:', err);
        });

        await swSelf.skipWaiting();
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[SW][Install]', error);
      }
    })(),
  );
});

/* ============================================================================
 * ⚡ АКТИВАЦИЯ SERVICE WORKER
 * ========================================================================== */

/**
 * Обработчик активации Service Worker
 * Берет контроль над всеми клиентами
 */
swSelf.addEventListener('activate', (event: ExtendableEvent) => {
  // Kill-switch: если SW отключен, не активируем
  if (SERVICE_WORKER_DISABLED) return;

  event.waitUntil(
    (async (): Promise<void> => {
      try {
        await swSelf.clients.claim();
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[SW][Activate]', error);
      }
    })(),
  );
});

/* ============================================================================
 * 🌐 FETCH HANDLER
 * ========================================================================== */

/**
 * Обработчик сетевых запросов
 * Использует стратегию NetworkFirst для всех GET запросов
 */
swSelf.addEventListener('fetch', (event: FetchEvent) => {
  // Kill-switch: если SW отключен, не перехватываем запросы
  if (SERVICE_WORKER_DISABLED) return;
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    (async (): Promise<Response> => {
      try {
        const result = await handleRequest(
          event.request,
          { timestamp: Date.now() },
          { strategy: 'NetworkFirst' },
        );
        return result.response;
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[SW][Fetch]', error, event.request.url);
        return OFFLINE_RESPONSE;
      }
    })(),
  );
});

/* ============================================================================
 * 📡 PUSH NOTIFICATIONS
 * ========================================================================== */

/**
 * Обработчик push уведомлений
 * Отображает уведомления пользователю
 */
swSelf.addEventListener('push', (event: ExtendableMessageEvent) => {
  event.waitUntil(
    (async (): Promise<void> => {
      try {
        await handlePushNotification(event);
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[SW][Push]', error);
      }
    })(),
  );
});

/**
 * Обработчик клика по уведомлению
 * Открывает соответствующее окно приложения
 */
swSelf.addEventListener('notificationclick', (event: NotificationEvent) => {
  const promise = handleNotificationClick(event).catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[SW][NotificationClick]', error);
  });
  event.waitUntil?.(promise);
});

/* ============================================================================
 * 🔄 BACKGROUND SYNC
 * ========================================================================== */

/**
 * Обработчик background sync
 * Выполняет синхронизацию данных в фоновом режиме
 */
swSelf.addEventListener('sync', (event: SyncEvent) => {
  event.waitUntil(
    Promise.resolve().then(() => {
      try {
        // handleBackgroundSync выполняет синхронные операции
        handleBackgroundSync(event as ExtendableEvent & { tag: string; });
        return undefined;
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[SW][Sync]', error);
        return undefined;
      }
    }),
  );
});

/* ============================================================================
 * ❌ EMERGENCY DECOMMISSION
 * ========================================================================== */
export { decommissionServiceWorker };
