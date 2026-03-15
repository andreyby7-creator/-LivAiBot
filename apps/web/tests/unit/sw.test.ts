/**
 * @file Comprehensive tests for apps/web/src/sw.ts
 * Покрытие всех веток и функций:
 * - Install event handler (успех/ошибки/kill-switch)
 * - Activate event handler (успех/ошибки/kill-switch)
 * - Fetch event handler (успех/ошибки/kill-switch/фильтры)
 * - Push notification handler (успех/ошибки)
 * - Notification click handler (успех/ошибки)
 * - Background sync handler (успех/ошибки)
 * - Kill-switch логика (SERVICE_WORKER_DISABLED)
 * - Экспорт decommissionServiceWorker
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExtendableEvent,
  ExtendableMessageEvent,
  FetchEvent,
} from '@livai/app/lib/service-worker';

// Типы из Service Worker API
type Client = {
  id: string;
  type: 'window' | 'worker' | 'sharedworker';
  url: string;
  postMessage: (message: unknown) => void;
};

type WindowClient = Client & {
  focused: boolean;
  visibilityState: 'hidden' | 'visible' | 'prerender' | 'unloaded';
  focus: () => Promise<WindowClient>;
  navigate: (url: string) => Promise<WindowClient | null>;
};

type ServiceWorkerGlobalScope = typeof globalThis & {
  addEventListener: (type: string, listener: EventListener) => void;
  skipWaiting: () => Promise<void>;
  clients: {
    claim: () => Promise<void>;
    matchAll: () => Promise<Client[]>;
    openWindow: (url: string) => Promise<WindowClient | null>;
  };
  registration: {
    showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  };
};

// ============================================================================
// 🧠 MOCKS
// ============================================================================

// Mock для @livai/app (используется в sw.ts)
const mockHandleRequest = vi.fn();
const mockHandlePushNotification = vi.fn();
const mockHandleNotificationClick = vi.fn();
const mockHandleBackgroundSync = vi.fn();
const mockDecommissionServiceWorker = vi.fn();
const mockSwSelf = {
  addEventListener: vi.fn(),
  skipWaiting: vi.fn(),
  clients: {
    claim: vi.fn(),
    matchAll: vi.fn(),
    openWindow: vi.fn(),
  },
  registration: {
    showNotification: vi.fn(),
  },
} as unknown as ServiceWorkerGlobalScope;

// Мокируем правильный путь импорта, который используется в sw.ts
const mockSwDisabled = vi.fn(() => false);
vi.mock('@livai/app/lib/service-worker', () => ({
  swSelf: mockSwSelf,
  handleRequest: mockHandleRequest,
  handlePushNotification: mockHandlePushNotification,
  handleNotificationClick: mockHandleNotificationClick,
  handleBackgroundSync: mockHandleBackgroundSync,
  decommissionServiceWorker: mockDecommissionServiceWorker,
  precacheMainUrls: ['/main1', '/main2'],
  precacheStaticUrls: ['/static1', '/static2'],
  mainCacheName: 'test-main-cache',
  staticCacheName: 'test-static-cache',
  swDisabled: mockSwDisabled,
}));

// Mock для caches API
const mockCache = {
  addAll: vi.fn(),
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockCaches = {
  open: vi.fn(() => Promise.resolve(mockCache)),
  keys: vi.fn(() => Promise.resolve([])),
  delete: vi.fn(() => Promise.resolve(true)),
  match: vi.fn(),
  has: vi.fn(),
};

// Mock для global caches
global.caches = mockCaches as unknown as CacheStorage;

// Mock для self (ServiceWorkerGlobalScope)
const mockSelf = {
  ...mockSwSelf,
  caches: mockCaches,
} as unknown as ServiceWorkerGlobalScope;

// Заменяем self на мок
Object.defineProperty(global, 'self', {
  value: mockSelf,
  writable: true,
  configurable: true,
});

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('sw.ts - Service Worker', () => {
  let installHandler: ((event: unknown) => void) | undefined;
  let activateHandler: ((event: unknown) => void) | undefined;
  let fetchHandler: ((event: unknown) => void) | undefined;
  let pushHandler: ((event: unknown) => void) | undefined;
  let notificationClickHandler: ((event: unknown) => void) | undefined;
  let syncHandler: ((event: unknown) => void) | undefined;

  beforeEach(async () => {
    // Очищаем все моки
    vi.clearAllMocks();

    // Сбрасываем обработчики
    installHandler = undefined;
    activateHandler = undefined;
    fetchHandler = undefined;
    pushHandler = undefined;
    notificationClickHandler = undefined;
    syncHandler = undefined;

    // Мокируем addEventListener для захвата обработчиков
    mockSwSelf.addEventListener = vi.fn().mockImplementation((type, listener) => {
      if (type === 'install') {
        installHandler = listener as (event: unknown) => void;
      } else if (type === 'activate') {
        activateHandler = listener as (event: unknown) => void;
      } else if (type === 'fetch') {
        fetchHandler = listener as (event: unknown) => void;
      } else if (type === 'push') {
        pushHandler = listener as (event: unknown) => void;
      } else if (type === 'notificationclick') {
        notificationClickHandler = listener as (event: unknown) => void;
      } else if (type === 'sync') {
        syncHandler = listener as (event: unknown) => void;
      }
    });

    // Настраиваем моки по умолчанию
    mockSwSelf.skipWaiting = vi.fn(() => Promise.resolve());
    (mockSwSelf.clients.claim as ReturnType<typeof vi.fn>) = vi.fn(() => Promise.resolve());
    mockCache.addAll = vi.fn(() => Promise.resolve());
    mockHandleRequest.mockResolvedValue({
      response: new Response('test', { status: 200 }),
      source: 'NETWORK',
      timestamp: Date.now(),
      traceId: 'test-trace-id',
    });
    mockHandlePushNotification.mockResolvedValue(undefined);
    mockHandleNotificationClick.mockResolvedValue(undefined);
    mockHandleBackgroundSync.mockResolvedValue(undefined);

    // Очищаем require cache для переимпорта модуля
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Install event handler', () => {
    it('должен установить обработчик install', async () => {
      // Убеждаемся что моки настроены перед импортом
      vi.resetModules();

      // Импортируем модуль
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('install', expect.any(Function));
      expect(installHandler).toBeDefined();
    }, 10000); // Увеличиваем таймаут до 10 секунд

    it('должен предзагрузить критические ресурсы при установке', async () => {
      await import('../../src/sw.js');

      const event = {
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent>;

      if (installHandler) {
        installHandler(event);

        // Ждем завершения асинхронных операций
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockCaches.open).toHaveBeenCalledWith('test-main-cache');
        expect(mockCaches.open).toHaveBeenCalledWith('test-static-cache');
        expect(mockCache.addAll).toHaveBeenCalledWith(['/main1', '/main2']);
        expect(mockCache.addAll).toHaveBeenCalledWith(['/static1', '/static2']);
        expect(mockSwSelf.skipWaiting).toHaveBeenCalled();
        expect(event.waitUntil).toHaveBeenCalled();
      } else {
        expect.fail('installHandler не определен');
      }
    });

    it('должен обработать ошибки при предзагрузке main cache', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockCache.addAll.mockRejectedValueOnce(new Error('Cache error'));

      await import('../../src/sw.js');

      const event = {
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent>;

      if (installHandler) {
        installHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SW][Install] Failed main precache'),
          expect.any(Error),
        );
        expect(mockCache.addAll).toHaveBeenCalledWith(['/static1', '/static2']);

        consoleWarnSpy.mockRestore();
      } else {
        expect.fail('installHandler не определен');
      }
    });

    it('должен обработать ошибки при предзагрузке static cache', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Первый вызов успешен, второй с ошибкой
      mockCache.addAll
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Static cache error'));

      await import('../../src/sw.js');

      const event = {
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent>;

      if (installHandler) {
        installHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SW][Install] Failed static precache'),
          expect.any(Error),
        );

        consoleWarnSpy.mockRestore();
      } else {
        expect.fail('installHandler не определен');
      }
    });

    it('должен обработать общую ошибку при установке', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCaches.open.mockRejectedValueOnce(new Error('Open cache error'));

      await import('../../src/sw.js');

      const event = {
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent>;

      if (installHandler) {
        installHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SW][Install]'),
          expect.any(Error),
        );

        consoleErrorSpy.mockRestore();
      } else {
        expect.fail('installHandler не определен');
      }
    });

    it('не должен устанавливать SW если SERVICE_WORKER_DISABLED = true', async () => {
      // Мокируем swDisabled = true
      mockSwDisabled.mockReturnValue(true);

      // Перезагружаем модуль sw.ts, чтобы SERVICE_WORKER_DISABLED пересчитался
      vi.resetModules();

      // Переимпортируем модуль и перезахватываем обработчики
      installHandler = undefined;
      await import('../../src/sw.js');

      // Ждем, пока обработчики будут установлены
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event = {
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent>;

      if (typeof installHandler === 'function') {
        (installHandler as (event: unknown) => void)(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        // Не должно быть вызовов кеша или skipWaiting
        expect(mockCaches.open).not.toHaveBeenCalled();
        expect(mockSwSelf.skipWaiting).not.toHaveBeenCalled();
      } else {
        expect.fail('installHandler не определен');
      }

      // Восстанавливаем мок для следующих тестов
      mockSwDisabled.mockReturnValue(false);
    });
  });

  describe('Activate event handler', () => {
    it('должен установить обработчик activate', async () => {
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('activate', expect.any(Function));
      expect(activateHandler).toBeDefined();
    });

    it('должен взять контроль над клиентами при активации', async () => {
      // Убеждаемся что swDisabled = false перед импортом
      vi.doMock('@livai/app', () => ({
        swSelf: mockSwSelf,
        handleRequest: mockHandleRequest,
        handlePushNotification: mockHandlePushNotification,
        handleNotificationClick: mockHandleNotificationClick,
        handleBackgroundSync: mockHandleBackgroundSync,
        decommissionServiceWorker: mockDecommissionServiceWorker,
        precacheMainUrls: ['/main1', '/main2'],
        precacheStaticUrls: ['/static1', '/static2'],
        mainCacheName: 'test-main-cache',
        staticCacheName: 'test-static-cache',
        swDisabled: vi.fn(() => false),
      }));

      await import('../../src/sw.js');

      // Убеждаемся что мок настроен перед вызовом обработчика
      const claimMock = vi.fn(() => Promise.resolve());
      mockSwSelf.clients.claim = claimMock as unknown as () => Promise<void>;

      const waitUntilMock = vi.fn((promise: Readonly<Promise<unknown>>) => promise);
      const event = {
        waitUntil: waitUntilMock,
      } as unknown as ExtendableEvent;

      expect(activateHandler).toBeDefined();
      if (!activateHandler) {
        expect.fail('activateHandler не определен');
      }

      activateHandler(event);

      expect(waitUntilMock).toHaveBeenCalled();

      // Ждем завершения промиса из waitUntil
      const promise = waitUntilMock.mock.calls[0]?.[0] as Promise<unknown>;
      await promise;

      expect(claimMock).toHaveBeenCalled();
    });

    it('должен обработать ошибку при активации', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Убеждаемся что swDisabled = false перед импортом
      vi.doMock('@livai/app', () => ({
        swSelf: mockSwSelf,
        handleRequest: mockHandleRequest,
        handlePushNotification: mockHandlePushNotification,
        handleNotificationClick: mockHandleNotificationClick,
        handleBackgroundSync: mockHandleBackgroundSync,
        decommissionServiceWorker: mockDecommissionServiceWorker,
        precacheMainUrls: ['/main1', '/main2'],
        precacheStaticUrls: ['/static1', '/static2'],
        mainCacheName: 'test-main-cache',
        staticCacheName: 'test-static-cache',
        swDisabled: vi.fn(() => false),
      }));

      await import('../../src/sw.js');

      // Убеждаемся что мок настроен перед вызовом обработчика
      const claimMock = vi.fn(() => Promise.reject(new Error('Claim error')));
      mockSwSelf.clients.claim = claimMock as unknown as () => Promise<void>;

      const waitUntilMock = vi.fn((promise: Readonly<Promise<unknown>>) => promise);
      const event = {
        waitUntil: waitUntilMock,
      } as unknown as ExtendableEvent;

      expect(activateHandler).toBeDefined();
      if (!activateHandler) {
        expect.fail('activateHandler не определен');
      }

      activateHandler(event);

      expect(waitUntilMock).toHaveBeenCalled();

      // Ждем завершения промиса из waitUntil
      const promise = waitUntilMock.mock.calls[0]?.[0] as Promise<unknown>;
      await promise.catch(() => {
        // Ожидаем ошибку
      });

      expect(claimMock).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SW][Activate]'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('не должен активировать SW если SERVICE_WORKER_DISABLED = true', async () => {
      // Мокируем swDisabled = true
      mockSwDisabled.mockReturnValue(true);

      // Перезагружаем модуль sw.ts, чтобы SERVICE_WORKER_DISABLED пересчитался
      vi.resetModules();

      // Переимпортируем модуль и перезахватываем обработчики
      activateHandler = undefined;
      await import('../../src/sw.js');

      // Ждем, пока обработчики будут установлены
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event = {
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as ExtendableEvent;

      if (typeof activateHandler === 'function') {
        (activateHandler as (event: unknown) => void)(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        // Не должно быть вызова claim
        expect(mockSwSelf.clients.claim).not.toHaveBeenCalled();
      } else {
        expect.fail('activateHandler не определен');
      }

      // Восстанавливаем мок для следующих тестов
      mockSwDisabled.mockReturnValue(false);
    });
  });

  describe('Fetch event handler', () => {
    it('должен установить обработчик fetch', async () => {
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('fetch', expect.any(Function));
      expect(fetchHandler).toBeDefined();
    });

    it('должен обработать GET запрос', async () => {
      // Убеждаемся что swDisabled = false перед импортом
      vi.doMock('@livai/app', () => ({
        swSelf: mockSwSelf,
        handleRequest: mockHandleRequest,
        handlePushNotification: mockHandlePushNotification,
        handleNotificationClick: mockHandleNotificationClick,
        handleBackgroundSync: mockHandleBackgroundSync,
        decommissionServiceWorker: mockDecommissionServiceWorker,
        precacheMainUrls: ['/main1', '/main2'],
        precacheStaticUrls: ['/static1', '/static2'],
        mainCacheName: 'test-main-cache',
        staticCacheName: 'test-static-cache',
        swDisabled: vi.fn(() => false),
      }));

      await import('../../src/sw.js');

      // Убеждаемся что мок настроен перед вызовом обработчика
      mockHandleRequest.mockResolvedValue({
        response: new Response('test', { status: 200 }),
        source: 'NETWORK',
        timestamp: Date.now(),
        traceId: 'test-trace-id',
      });

      const request = new Request('https://example.com/test', { method: 'GET' });
      const respondWithMock = vi.fn((promise: Readonly<Promise<Response>>) => promise);
      const event = {
        request,
        respondWith: respondWithMock,
      } as unknown as Readonly<FetchEvent>;

      expect(fetchHandler).toBeDefined();
      if (!fetchHandler) {
        expect.fail('fetchHandler не определен');
      }

      fetchHandler(event);

      expect(respondWithMock).toHaveBeenCalled();

      // Ждем завершения промиса из respondWith
      const promise = respondWithMock.mock.calls[0]?.[0] as Promise<Response>;
      await promise;

      expect(mockHandleRequest).toHaveBeenCalledWith(
        request,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        { strategy: 'NetworkFirst' },
      );
    });

    it('должен вернуть OFFLINE_RESPONSE при ошибке обработки запроса', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Убеждаемся что swDisabled = false перед импортом
      vi.doMock('@livai/app', () => ({
        swSelf: mockSwSelf,
        handleRequest: mockHandleRequest,
        handlePushNotification: mockHandlePushNotification,
        handleNotificationClick: mockHandleNotificationClick,
        handleBackgroundSync: mockHandleBackgroundSync,
        decommissionServiceWorker: mockDecommissionServiceWorker,
        precacheMainUrls: ['/main1', '/main2'],
        precacheStaticUrls: ['/static1', '/static2'],
        mainCacheName: 'test-main-cache',
        staticCacheName: 'test-static-cache',
        swDisabled: vi.fn(() => false),
      }));

      await import('../../src/sw.js');

      // Убеждаемся что мок настроен перед вызовом обработчика
      mockHandleRequest.mockRejectedValueOnce(new Error('Request error'));

      const request = new Request('https://example.com/test', { method: 'GET' });
      const respondWithMock = vi.fn((promise: Readonly<Promise<Response>>) => promise);
      const event = {
        request,
        respondWith: respondWithMock,
      } as unknown as Readonly<FetchEvent>;

      expect(fetchHandler).toBeDefined();
      if (!fetchHandler) {
        expect.fail('fetchHandler не определен');
      }

      fetchHandler(event);

      expect(respondWithMock).toHaveBeenCalled();

      // Ждем завершения промиса из respondWith
      const promise = respondWithMock.mock.calls[0]?.[0] as Promise<Response>;
      const response = await promise;
      expect(response.status).toBe(503);
      expect(response.statusText).toBe('Service Unavailable');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SW][Fetch]'),
        expect.any(Error),
        'https://example.com/test',
      );

      consoleErrorSpy.mockRestore();
    });

    it('не должен обрабатывать не-GET запросы', async () => {
      await import('../../src/sw.js');

      const request = new Request('https://example.com/test', { method: 'POST' });
      const event = {
        request,
        respondWith: vi.fn((promise: Readonly<Promise<Response>>) => promise),
      } as unknown as FetchEvent;

      if (fetchHandler) {
        fetchHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockHandleRequest).not.toHaveBeenCalled();
        expect(event.respondWith).not.toHaveBeenCalled();
      } else {
        expect.fail('fetchHandler не определен');
      }
    });

    it('не должен обрабатывать запросы не начинающиеся с http', async () => {
      await import('../../src/sw.js');

      const request = new Request('chrome-extension://test', { method: 'GET' });
      const event = {
        request,
        respondWith: vi.fn((promise: Readonly<Promise<Response>>) => promise),
      } as unknown as FetchEvent;

      if (fetchHandler) {
        fetchHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockHandleRequest).not.toHaveBeenCalled();
        expect(event.respondWith).not.toHaveBeenCalled();
      } else {
        expect.fail('fetchHandler не определен');
      }
    });

    it('не должен обрабатывать запросы если SERVICE_WORKER_DISABLED = true', async () => {
      // Мокируем swDisabled = true
      mockSwDisabled.mockReturnValue(true);

      // Перезагружаем модуль sw.ts, чтобы SERVICE_WORKER_DISABLED пересчитался
      vi.resetModules();

      // Переимпортируем модуль и перезахватываем обработчики
      fetchHandler = undefined;
      await import('../../src/sw.js');

      // Ждем, пока обработчики будут установлены
      await new Promise((resolve) => setTimeout(resolve, 10));

      const request = new Request('https://example.com/test', { method: 'GET' });
      const event = {
        request,
        respondWith: vi.fn((promise: Readonly<Promise<Response>>) => promise),
      } as unknown as Readonly<FetchEvent>;

      if (typeof fetchHandler === 'function') {
        (fetchHandler as (event: unknown) => void)(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockHandleRequest).not.toHaveBeenCalled();
        expect(event.respondWith).not.toHaveBeenCalled();
      } else {
        expect.fail('fetchHandler не определен');
      }

      // Восстанавливаем мок для следующих тестов
      mockSwDisabled.mockReturnValue(false);
    });
  });

  describe('Push notification handler', () => {
    it('должен установить обработчик push', async () => {
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('push', expect.any(Function));
      expect(pushHandler).toBeDefined();
    });

    it('должен обработать push уведомление', async () => {
      await import('../../src/sw.js');

      const event = {
        data: {
          json: () => ({ title: 'Test', body: 'Test body' }),
        },
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableMessageEvent>;

      if (pushHandler) {
        pushHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockHandlePushNotification).toHaveBeenCalledWith(event);
        expect(event.waitUntil).toHaveBeenCalled();
      } else {
        expect.fail('pushHandler не определен');
      }
    });

    it('должен обработать ошибку при push уведомлении', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHandlePushNotification.mockRejectedValueOnce(new Error('Push error'));

      await import('../../src/sw.js');

      const event = {
        data: {
          json: () => ({ title: 'Test', body: 'Test body' }),
        },
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableMessageEvent>;

      if (pushHandler) {
        pushHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SW][Push]'),
          expect.any(Error),
        );

        consoleErrorSpy.mockRestore();
      } else {
        expect.fail('pushHandler не определен');
      }
    });
  });

  describe('Notification click handler', () => {
    it('должен установить обработчик notificationclick', async () => {
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith(
        'notificationclick',
        expect.any(Function),
      );
      expect(notificationClickHandler).toBeDefined();
    });

    it('должен обработать клик по уведомлению', async () => {
      await import('../../src/sw.js');

      const mockNotification = {
        close: vi.fn(),
        data: { url: '/test' },
      } as unknown as Notification;

      const waitUntilFn = vi.fn((promise: Readonly<Promise<unknown>>) => promise);
      const event = {
        notification: mockNotification,
        waitUntil: waitUntilFn,
      } as unknown as Readonly<
        Event & {
          notification: Notification;
          waitUntil?: (promise: Readonly<Promise<unknown>>) => void;
        }
      >;

      if (notificationClickHandler) {
        notificationClickHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockHandleNotificationClick).toHaveBeenCalledWith(event);
        expect(waitUntilFn).toHaveBeenCalled();
      } else {
        expect.fail('notificationClickHandler не определен');
      }
    });

    it('должен обработать ошибку при клике по уведомлению', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHandleNotificationClick.mockRejectedValueOnce(new Error('Notification click error'));

      await import('../../src/sw.js');

      const mockNotification = {
        close: vi.fn(),
        data: { url: '/test' },
      } as unknown as Notification;

      const waitUntilFn = vi.fn((promise: Readonly<Promise<unknown>>) => promise);
      const event = {
        notification: mockNotification,
        waitUntil: waitUntilFn,
      } as unknown as Readonly<
        Event & {
          notification: Notification;
          waitUntil?: (promise: Readonly<Promise<unknown>>) => void;
        }
      >;

      if (notificationClickHandler) {
        notificationClickHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SW][NotificationClick]'),
          expect.any(Error),
        );

        consoleErrorSpy.mockRestore();
      } else {
        expect.fail('notificationClickHandler не определен');
      }
    });

    it('должен обработать клик по уведомлению с waitUntil', async () => {
      await import('../../src/sw.js');

      // Убеждаемся что мок настроен перед вызовом обработчика
      mockHandleNotificationClick.mockResolvedValue(undefined);

      const mockNotification = {
        close: vi.fn(),
        data: { url: '/test' },
      } as unknown as Notification;

      // Создаем событие с waitUntil - код всегда вызывает waitUntil через type assertion
      // В реальном Service Worker событие notificationclick всегда имеет waitUntil
      const waitUntilFn = vi.fn((promise: Readonly<Promise<unknown>>) => promise);
      const event = {
        notification: mockNotification,
        waitUntil: waitUntilFn,
      } as unknown as Event & {
        notification: Notification;
        waitUntil: (promise: Readonly<Promise<unknown>>) => void;
      };

      expect(notificationClickHandler).toBeDefined();
      if (!notificationClickHandler) {
        expect.fail('notificationClickHandler не определен');
      }

      // Вызываем обработчик
      // Код: const extendableEvent = event as unknown as { waitUntil(...): void };
      //      extendableEvent.waitUntil(promise);
      notificationClickHandler(event);

      // Ждем выполнения промиса от handleNotificationClick
      await new Promise((resolve) => setTimeout(resolve, 0));

      // handleNotificationClick должен быть вызван
      expect(mockHandleNotificationClick).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: mockNotification,
        }),
      );
      // waitUntil должен быть вызван с промисом
      expect(waitUntilFn).toHaveBeenCalled();
    });
  });

  describe('Background sync handler', () => {
    it('должен установить обработчик sync', async () => {
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('sync', expect.any(Function));
      expect(syncHandler).toBeDefined();
    });

    it('должен обработать background sync', async () => {
      await import('../../src/sw.js');

      const event = {
        tag: 'sync-messages',
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent & { tag: string; }>;

      if (syncHandler) {
        syncHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockHandleBackgroundSync).toHaveBeenCalledWith(event);
        expect(event.waitUntil).toHaveBeenCalled();
      } else {
        expect.fail('syncHandler не определен');
      }
    });

    it('должен обработать ошибку при background sync', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHandleBackgroundSync.mockImplementationOnce(() => {
        throw new Error('Sync error');
      });

      await import('../../src/sw.js');

      const event = {
        tag: 'sync-messages',
        waitUntil: vi.fn((promise: Readonly<Promise<unknown>>) => promise),
      } as unknown as Readonly<ExtendableEvent & { tag: string; }>;

      if (syncHandler) {
        syncHandler(event);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SW][Sync]'),
          expect.any(Error),
        );

        consoleErrorSpy.mockRestore();
      } else {
        expect.fail('syncHandler не определен');
      }
    });
  });

  describe('Экспорты', () => {
    it('должен экспортировать decommissionServiceWorker', async () => {
      const module = await import('../../src/sw.js');

      expect(module).toHaveProperty('decommissionServiceWorker');
      expect(module.decommissionServiceWorker).toBe(mockDecommissionServiceWorker);
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен зарегистрировать все обработчики событий', async () => {
      await import('../../src/sw.js');

      expect(mockSwSelf.addEventListener).toHaveBeenCalledTimes(6);
      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('install', expect.any(Function));
      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('activate', expect.any(Function));
      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('fetch', expect.any(Function));
      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('push', expect.any(Function));
      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith(
        'notificationclick',
        expect.any(Function),
      );
      expect(mockSwSelf.addEventListener).toHaveBeenCalledWith('sync', expect.any(Function));
    });

    it('должен корректно обработать все обработчики при импорте', async () => {
      await import('../../src/sw.js');

      // Проверяем что все обработчики были зарегистрированы
      expect(installHandler).toBeDefined();
      expect(activateHandler).toBeDefined();
      expect(fetchHandler).toBeDefined();
      expect(pushHandler).toBeDefined();
      expect(notificationClickHandler).toBeDefined();
      expect(syncHandler).toBeDefined();
    });
  });
});
