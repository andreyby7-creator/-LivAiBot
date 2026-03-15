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

import type {
  ExtendableEvent,
  ExtendableMessageEvent,
  FetchEvent,
} from '@livai/app/lib/service-worker';
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
} from '@livai/app/lib/service-worker';

/* ============================================================================
 * 📋 ТИПЫ И КОНСТАНТЫ
 * ========================================================================== */

/** Стандартный ответ для оффлайн режима */
const OFFLINE_RESPONSE = new Response('Offline', {
  status: 503,
  statusText: 'Service Unavailable',
});

/** Kill-switch для Service Worker - значение может быть изменено через remote config */
const SERVICE_WORKER_DISABLED = swDisabled();

/* ============================================================================
 * 🛠️ УСТАНОВКА SERVICE WORKER
 * ========================================================================== */

/**
 * Обработчик установки Service Worker
 * Предзагружает критические ресурсы в кеш
 */
swSelf.addEventListener('install', (event: ExtendableEvent): void => {
  // Kill-switch: если SW отключен, не устанавливаем
  if (SERVICE_WORKER_DISABLED) return;

  const installEvent = event as unknown as { waitUntil(promise: Promise<unknown>): void; };
  installEvent.waitUntil(
    (async (): Promise<void> => {
      try {
        const mainCache = await caches.open(mainCacheName);
        await mainCache.addAll(precacheMainUrls).catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('[SW][Install] Failed main precache:', err);
        });

        const staticCache = await caches.open(staticCacheName);
        await staticCache.addAll(precacheStaticUrls).catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn('[SW][Install] Failed static precache:', err);
        });

        const selfScope = swSelf as unknown as { skipWaiting(): Promise<void>; };
        await selfScope.skipWaiting();
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
swSelf.addEventListener('activate', (event: ExtendableEvent): void => {
  // Kill-switch: если SW отключен, не активируем
  if (SERVICE_WORKER_DISABLED) return;

  const activateEvent = event as unknown as { waitUntil(promise: Promise<unknown>): void; };
  activateEvent.waitUntil(
    (async (): Promise<void> => {
      try {
        const selfScope = swSelf as unknown as { clients: { claim(): Promise<void>; }; };
        await selfScope.clients.claim();
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
swSelf.addEventListener('fetch', (event: FetchEvent): void => {
  // Kill-switch: если SW отключен, не перехватываем запросы
  if (SERVICE_WORKER_DISABLED) return;
  const fetchEvent = event as unknown as {
    readonly request: Request;
    respondWith(response: Response | Promise<Response>): void;
  };
  if (fetchEvent.request.method !== 'GET') return;
  const requestUrl: string = fetchEvent.request.url;
  if (!requestUrl.startsWith('http')) return;

  fetchEvent.respondWith(
    (async (): Promise<Response> => {
      try {
        const result = await handleRequest(
          fetchEvent.request,
          { timestamp: Date.now() },
          { strategy: 'NetworkFirst' as const },
        );
        return result.response;
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[SW][Fetch]', error, fetchEvent.request.url);
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
swSelf.addEventListener('push', (event: ExtendableMessageEvent): void => {
  const pushEventWithWait = event as unknown as { waitUntil(promise: Promise<unknown>): void; };
  pushEventWithWait.waitUntil(
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
swSelf.addEventListener(
  'notificationclick',
  ((event: Event): void => {
    const notificationEvent = event as Event & { notification: Notification; };
    const promise = handleNotificationClick(notificationEvent).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[SW][NotificationClick]', error);
    });
    // waitUntil доступен через ExtendableEvent, но не определен в типе notificationclick
    // Используем type assertion для безопасного доступа
    const extendableEvent = event as unknown as { waitUntil(promise: Promise<unknown>): void; };
    extendableEvent.waitUntil(promise);
  }) as EventListener,
);

/* ============================================================================
 * 🔄 BACKGROUND SYNC
 * ========================================================================== */

/**
 * Обработчик background sync
 * Выполняет синхронизацию данных в фоновом режиме
 */
swSelf.addEventListener(
  'sync',
  ((event: Event): void => {
    const syncEvent = event as ExtendableEvent & { tag: string; };
    syncEvent.waitUntil(
      Promise.resolve().then(() => {
        try {
          // handleBackgroundSync выполняет синхронные операции
          handleBackgroundSync(syncEvent);
          return undefined;
        } catch (error: unknown) {
          // eslint-disable-next-line no-console
          console.error('[SW][Sync]', error);
          return undefined;
        }
      }),
    );
  }) as EventListener,
);

/* ============================================================================
 * ❌ EMERGENCY DECOMMISSION
 * ========================================================================== */
export { decommissionServiceWorker };
