/**
 * @file packages/app/src/lib/service-worker.ts
 * ============================================================================
 * 🔧 SERVICE WORKER — PWA/OFFLINE ЯДРО
 * ============================================================================
 * Свойства:
 * - Гибридные стратегии кеширования (NetworkFirst, CacheFirst, StaleWhileRevalidate)
 * - Push notifications поддержка
 * - Background sync для оффлайн операций
 * - Автоматическая очистка устаревших кешей
 * - Telemetry-ready архитектура
 * - Микросервисная архитектура с traceId
 * - Отказоустойчивый и resilient
 * - Готов к production использованию
 * Принципы:
 * - Zero business logic (только инфраструктура)
 * - Immutable конфигурация
 * - Полная типизация TypeScript
 * - Graceful degradation
 */

/* ============================================================================
 * 🧠 ТИПЫ И КОНСТРАНТЫ
 * ========================================================================== */

/** Версия Service Worker для управления кешами */
const SW_VERSION = '1.0.0';

/** Feature flag для отключения Service Worker (kill-switch) */
// Значение может быть изменено через remote config или environment variable
// Используется функция для возможности runtime проверки (например, через cache API)
function getSwDisabled(): boolean {
  // В будущем можно добавить проверку remote config через cache API
  // const configCache = await caches.match('/sw-config.json');
  // if (configCache) { ... }
  return false;
}
export function swDisabled(): boolean {
  return getSwDisabled();
}

/** Константы для размеров */
const BYTES_IN_KB = 1024;
const BYTES_IN_MB = BYTES_IN_KB * BYTES_IN_KB;

/** Максимальный размер одного ответа для кеширования (10MB) */
const MAX_RESPONSE_SIZE_BYTES = 10 * BYTES_IN_MB;

/** Максимальный размер всего кеша в байтах (100MB) */
const MAX_TOTAL_CACHE_SIZE_BYTES = 100 * BYTES_IN_MB;

/** Версия схемы телеметрии */
const TELEMETRY_SCHEMA_VERSION = '1.0.0';

/** App ID для namespace изоляции */
const APP_ID = 'livai';

/** Environment runtime constant (заменено с compile-time на runtime для Turbopack) */
const ENVIRONMENT = process.env['NODE_ENV'] === 'production'
  ? 'prod'
  : process.env['NEXT_PUBLIC_APP_ENV'] === 'staging'
  ? 'stage'
  : 'dev';

/** Префикс для кешей с namespace изоляцией */
const CACHE_PREFIX = `${APP_ID}-${ENVIRONMENT}-sw`;

/** Имя основного кеша */
const mainCacheNameValue = `${CACHE_PREFIX}-v${SW_VERSION}`;
export const mainCacheName = mainCacheNameValue;

/** Имя кеша для статических ресурсов */
const staticCacheNameValue = `${CACHE_PREFIX}-static-v${SW_VERSION}`;
export const staticCacheName = staticCacheNameValue;

/** Имя кеша для API запросов (базовое, без user hash) */
const API_CACHE_BASE_NAME = `${CACHE_PREFIX}-api-v${SW_VERSION}`;

/** Получает имя API кеша с изоляцией по пользователю */
function getApiCacheName(userHash: string | null): string {
  if (userHash === null) {
    // Публичные API без изоляции
    return `${API_CACHE_BASE_NAME}-public`;
  }
  return `${API_CACHE_BASE_NAME}-${userHash}`;
}

/** Константы для хеширования токенов */
const TOKEN_HASH_BYTES = 8;
const TOKEN_HASH_HEX_LENGTH = 2;
const HEX_RADIX = 16;

/** Создает безопасный хеш токена с использованием crypto.subtle */
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .slice(0, TOKEN_HASH_BYTES)
    .map((b) => b.toString(HEX_RADIX).padStart(TOKEN_HASH_HEX_LENGTH, '0'))
    .join('');
}

/** Извлекает хеш пользователя из запроса (Authorization header) */
async function getUserHashFromRequest(request: Request): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader === null || authHeader === '') {
      return null;
    }
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return null;
    }
    const tokenPart = authHeader.split(' ', 2)[1];
    const token = tokenPart?.trim();
    if (token === '' || token === undefined) {
      return null;
    }
    // Безопасный SHA-256 хеш токена для изоляции кеша
    const hash = await hashToken(token);
    return hash;
  } catch {
    return null;
  }
}

/** Время жизни кеша в миллисекундах (7 дней) */
const DAYS_IN_WEEK = 7;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const MILLISECONDS_IN_SECOND = 1000;
const CACHE_TTL = DAYS_IN_WEEK
  * HOURS_IN_DAY
  * MINUTES_IN_HOUR
  * SECONDS_IN_MINUTE
  * MILLISECONDS_IN_SECOND;

/** Константы для конфигурации кеширования */
const STATIC_CACHE_DAYS = 30;
const API_CACHE_MINUTES = 5;
const API_NETWORK_TIMEOUT_SECONDS = 5;

/** URLs для предварительного кеширования при установке */
const precacheMainUrlsValue: readonly string[] = [
  '/',
  `/offline.html?v=${SW_VERSION}`,
] as const;
export const precacheMainUrls = precacheMainUrlsValue;

const precacheStaticUrlsValue: readonly string[] = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
] as const;
export const precacheStaticUrls = precacheStaticUrlsValue;

/**
 * Стратегия кеширования
 * CacheFirst = CacheFirst + TTL enforcement
 * - Возвращает кеш только если он свежий (не expired)
 * - Кеш без sw-cached-date считается expired
 * - Fallback на сеть если кеш устарел или отсутствует
 */
type CacheStrategy =
  | 'NetworkFirst'
  | 'CacheFirst'
  | 'StaleWhileRevalidate'
  | 'NetworkOnly'
  | 'CacheOnly';

/** Конфигурация кеширования для маршрута */
type RouteCacheConfig = Readonly<{
  strategy: CacheStrategy;
  cacheName?: string | undefined;
  maxAge?: number | undefined;
  maxEntries?: number | undefined;
  networkTimeout?: number | undefined;
}>;

/** Контекст запроса для телеметрии */
type RequestContext = Readonly<{
  traceId?: string;
  service?: string;
  timestamp: number;
}>;

/** Типы ошибок для детальной классификации */
type ErrorSource =
  | 'ERROR_NETWORK'
  | 'ERROR_TIMEOUT'
  | 'ERROR_CACHE_MISS'
  | 'ERROR_INVALID_RESPONSE'
  | 'ERROR';

/** Результат обработки запроса */
type RequestResult = Readonly<{
  response: Response;
  source: 'CACHE' | 'NETWORK' | 'STALE' | ErrorSource;
  timestamp: number;
  traceId?: string | undefined;
}>;

/** Типы для Service Worker API */
export type Client = {
  readonly url: string;
  readonly id: string;
  readonly type: 'window' | 'worker' | 'sharedworker';
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

export type WindowClient = Client & {
  focus(): Promise<WindowClient>;
};

export type Clients = {
  matchAll(
    options?: {
      type?: 'window' | 'worker' | 'sharedworker' | 'all';
      includeUncontrolled?: boolean;
    },
  ): Promise<Client[]>;
  openWindow(url: string): Promise<WindowClient | null>;
  claim(): Promise<void>;
};

export type ExtendableEvent = Event & {
  waitUntil(promise: Promise<unknown>): void;
};

export type FetchEvent = ExtendableEvent & {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
};

export type ExtendableMessageEvent = ExtendableEvent & {
  readonly data: unknown;
};

export type ServiceWorkerGlobalScope = {
  readonly registration: ServiceWorkerRegistration;
  readonly clients: Clients;
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'push', listener: (event: ExtendableMessageEvent) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (event: Event & { notification: Notification; }) => void,
  ): void;
  addEventListener(
    type: 'sync',
    listener: (
      event: Event & { tag: string; waitUntil: (promise: Promise<unknown>) => void; },
    ) => void,
  ): void;
};

// Service Worker работает в отдельном контексте, используем глобальный self
export const swSelf = self as unknown as ServiceWorkerGlobalScope;

/* ============================================================================
 * ⚙️ КОНФИГУРАЦИЯ МАРШРУТОВ
 * ========================================================================== */

/** Конфигурация кеширования для различных типов запросов */
type RoutePattern = string | RegExp;

const ROUTE_CONFIGS: readonly (readonly [RoutePattern, RouteCacheConfig])[] = [
  // Статические ресурсы (CSS, JS, изображения) - CacheFirst
  [
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/,
    {
      strategy: 'CacheFirst' as const,
      cacheName: staticCacheName,
      maxAge: STATIC_CACHE_DAYS
        * HOURS_IN_DAY
        * MINUTES_IN_HOUR
        * SECONDS_IN_MINUTE
        * MILLISECONDS_IN_SECOND, // 30 дней
      maxEntries: 100,
    },
  ],
  // API запросы - NetworkFirst с fallback на кеш
  // cacheName будет переопределён в handleRequest с учётом userHash
  [
    /^\/api\//,
    {
      strategy: 'NetworkFirst' as const,
      cacheName: API_CACHE_BASE_NAME, // Базовое имя, будет заменено на getApiCacheName(userHash)
      maxAge: API_CACHE_MINUTES * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND, // 5 минут
      maxEntries: 50,
      networkTimeout: API_NETWORK_TIMEOUT_SECONDS * MILLISECONDS_IN_SECOND, // 5 секунд
    },
  ],
  // HTML страницы - StaleWhileRevalidate
  [
    /\.html$|^\/$/,
    {
      strategy: 'StaleWhileRevalidate' as const,
      cacheName: mainCacheName,
      maxAge: HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND, // 1 день
      maxEntries: 20,
    },
  ],
  // По умолчанию - NetworkFirst
  [
    '*',
    {
      strategy: 'NetworkFirst' as const,
      cacheName: mainCacheName,
      maxAge: CACHE_TTL,
      maxEntries: 100,
    },
  ],
] as const;

/* ============================================================================
 * 🔧 УТИЛИТЫ КЕШИРОВАНИЯ
 * ========================================================================== */

/** Получает конфигурацию кеширования для запроса */
function getRouteConfig(url: string): RouteCacheConfig {
  for (const [pattern, config] of ROUTE_CONFIGS) {
    if (pattern === '*') continue;

    if (pattern instanceof RegExp) {
      if (pattern.test(url)) {
        return config;
      }
    } else if (typeof pattern === 'string' && url.includes(pattern)) {
      return config;
    }
  }

  // Fallback на дефолтную конфигурацию
  const defaultConfig = ROUTE_CONFIGS.find(([pattern]) => pattern === '*');
  return defaultConfig?.[1] ?? {
    strategy: 'NetworkFirst',
    cacheName: mainCacheName,
    maxAge: CACHE_TTL,
    maxEntries: 100,
  };
}

/**
 * Проверяет валидность ответа для кеширования (cache poisoning protection)
 * Правила:
 * - Только статус 200 OK
 * - Content-Type должен быть валидным
 * - Размер не должен превышать лимит
 */
async function isValidForCaching(response: Response, request?: Request): Promise<boolean> {
  // Только успешные ответы
  const HTTP_OK = 200;
  if (response.status !== HTTP_OK) return false;

  // Проверка размера (если доступен Content-Length)
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const size = Number.parseInt(contentLength, 10);
    if (size > MAX_RESPONSE_SIZE_BYTES) return false;
  }

  // Базовые проверки Content-Type (можно расширить)
  const contentType = response.headers.get('content-type');
  if (contentType === null) return false;

  // Блокируем кеширование HTML в API кеше (защита от ошибок)
  if (contentType.includes('text/html') && response.url.includes('/api/')) {
    return false;
  }

  // API cache isolation: проверка cache-control: private
  // Если ответ помечен как private, не кешируем в общем API кеше
  if (request?.url.includes('/api/') === true) {
    const cacheControl = response.headers.get('cache-control');
    const isPrivate = cacheControl?.toLowerCase().includes('private') ?? false;
    if (isPrivate) {
      // Private ответы требуют изоляции по пользователю
      // Если нет userHash, не кешируем
      const userHash = await getUserHashFromRequest(request);
      if (userHash === null) {
        return false;
      }
    }
  }

  return true;
}

/** Проверяет, истек ли срок действия кеша */
function isCacheExpired(response: Response, maxAge: number): boolean {
  const cachedDate = response.headers.get('sw-cached-date');
  if (cachedDate !== null && cachedDate !== '') {
    const cachedTime = Number.parseInt(cachedDate, 10);
    const now = Date.now();
    return now - cachedTime > maxAge;
  }

  // Fallback to Date header
  const dateHeader = response.headers.get('date');
  if (dateHeader !== null && dateHeader !== '') {
    const dateTime = new Date(dateHeader).getTime();
    const now = Date.now();
    return now - dateTime > maxAge;
  }

  // No timestamp available - consider expired
  return true;
}

/** Создает кешируемый ответ с метаданными */
function createCacheableResponse(response: Response): Response {
  const cloned = response.clone();
  const headers = new Headers(cloned.headers);
  headers.set('sw-cached-date', Date.now().toString());

  return new Response(cloned.body, {
    status: cloned.status,
    statusText: cloned.statusText,
    headers,
  });
}

/** Обновляет timestamp кешированного ответа (для LRU) */
async function updateCacheEntryTimestamp(
  cache: Cache,
  request: Request,
  response: Response,
): Promise<void> {
  try {
    await cache.put(request, createCacheableResponse(response));
  } catch {
    // Graceful degradation - если не удалось обновить timestamp, продолжаем
  }
}

/** Проверяет размер ответа и определяет, можно ли его кешировать */
async function getResponseSizeForCaching(response: Response): Promise<number | null> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    return Number.parseInt(contentLength, 10);
  }

  // Fallback: проверяем размер через blob для chunked/streaming responses
  try {
    const cloned = response.clone();
    const blob = await cloned.blob();
    return blob.size;
  } catch {
    // Если не удалось получить размер, не кешируем
    return null;
  }
}

/** Очищает устаревшие кеши */
async function cleanOldCacheEntries(
  cacheName: string,
  maxEntries: number,
): Promise<void> {
  if (maxEntries <= 0) return;

  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length <= maxEntries) return;

    // Сортируем по дате кеширования (старые первыми)
    const entries = await Promise.all(
      keys.map(async (request) => {
        const response = await cache.match(request);
        if (!response) {
          // Если response отсутствует, считаем запись самой новой (удаляется последней)
          return {
            request,
            timestamp: Number.MAX_SAFE_INTEGER,
          };
        }
        const cachedDate = response.headers.get('sw-cached-date') ?? null;
        const timestamp = cachedDate !== null && cachedDate !== ''
          ? Number.parseInt(cachedDate, 10)
          : 0;
        return {
          request,
          timestamp,
        };
      }),
    );

    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

    // Удаляем старые записи
    const toDelete = sortedEntries.slice(0, sortedEntries.length - maxEntries);
    await Promise.all(toDelete.map((entry) => cache.delete(entry.request)));
  } catch {
    // Graceful degradation - ошибки очистки не должны ломать работу
    // В Service Worker нет доступа к telemetry, поэтому просто игнорируем ошибки
  }
}

/* ============================================================================
 * 🎯 СТРАТЕГИИ КЕШИРОВАНИЯ
 * ========================================================================== */

/** NetworkFirst стратегия: пробует сеть, fallback на кеш */
async function networkFirstStrategy(
  request: Request,
  config: RouteCacheConfig,
  context: RequestContext,
): Promise<RequestResult> {
  const cacheName = config.cacheName ?? mainCacheName;
  const cache = await caches.open(cacheName);
  const DEFAULT_NETWORK_TIMEOUT = 10 * MILLISECONDS_IN_SECOND;
  const networkTimeout = config.networkTimeout ?? DEFAULT_NETWORK_TIMEOUT;

  try {
    // Пробуем сеть с таймаутом и AbortController
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, networkTimeout);

    const networkPromise = fetch(request, { signal: abortController.signal })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    const response = await networkPromise;

    if (response.ok && await isValidForCaching(response, request)) {
      const responseSize = await getResponseSizeForCaching(response);

      if (responseSize === null || responseSize > MAX_RESPONSE_SIZE_BYTES) {
        // Ответ слишком большой или не удалось определить размер - не кешируем
        return {
          response,
          source: 'NETWORK',
          timestamp: context.timestamp,
          traceId: context.traceId,
        };
      }

      // Кешируем успешный ответ
      await cache.put(request, createCacheableResponse(response.clone()));
      await cleanOldCacheEntries(cacheName, config.maxEntries ?? 100);

      return {
        response,
        source: 'NETWORK',
        timestamp: context.timestamp,
        traceId: context.traceId,
      };
    }

    throw new Error(`Network response not ok: ${response.status}`);
  } catch {
    // Fallback на кеш
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      const maxAge = config.maxAge ?? CACHE_TTL;
      const isExpired = isCacheExpired(cachedResponse, maxAge);

      return {
        response: cachedResponse,
        source: isExpired ? 'STALE' : 'CACHE',
        timestamp: context.timestamp,
        traceId: context.traceId,
      };
    }

    // Если кеша нет, возвращаем ошибку с телеметрией
    return {
      response: new Response('Network error', { status: 503, statusText: 'Service Unavailable' }),
      source: 'ERROR',
      timestamp: context.timestamp,
      traceId: context.traceId,
    };
  }
}

/**
 * CacheFirst стратегия: пробует кеш, fallback на сеть
 * Поведение: CacheFirst + TTL enforcement
 * - Возвращает кеш только если он свежий (isCacheExpired = false)
 * - Кеш без sw-cached-date считается expired → fallback на сеть
 * - Если сеть недоступна, возвращает STALE кеш (даже без даты)
 */
async function cacheFirstStrategy(
  request: Request,
  config: RouteCacheConfig,
  context: RequestContext,
): Promise<RequestResult> {
  const cacheName = config.cacheName ?? mainCacheName;
  const cache = await caches.open(cacheName);

  // Пробуем кеш
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const maxAge = config.maxAge ?? CACHE_TTL;
    const isExpired = isCacheExpired(cachedResponse, maxAge);

    if (!isExpired) {
      // Обновляем timestamp для LRU (cache hit)
      await updateCacheEntryTimestamp(cache, request, cachedResponse);
      return {
        response: cachedResponse,
        source: 'CACHE',
        timestamp: context.timestamp,
        traceId: context.traceId,
      };
    }
  }

  // Fallback на сеть
  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, createCacheableResponse(response.clone()));
      await cleanOldCacheEntries(cacheName, config.maxEntries ?? 100);
      // Byte-limit: проверяем общий размер кеша
      await purgeCacheIfNeeded(cacheName);
    }

    return {
      response,
      source: 'NETWORK',
      timestamp: context.timestamp,
      traceId: context.traceId,
    };
  } catch (error) {
    // Если сеть недоступна, возвращаем устаревший кеш если есть
    if (cachedResponse) {
      return {
        response: cachedResponse,
        source: 'STALE',
        timestamp: context.timestamp,
        traceId: context.traceId,
      };
    }

    throw error;
  }
}

/** StaleWhileRevalidate стратегия: возвращает кеш сразу, обновляет в фоне */
async function staleWhileRevalidateStrategy(
  request: Request,
  config: RouteCacheConfig,
  context: RequestContext,
): Promise<RequestResult> {
  const cacheName = config.cacheName ?? mainCacheName;
  const cache = await caches.open(cacheName);

  // Пробуем кеш
  const cachedResponse = await cache.match(request);

  // Фоновое обновление (не блокируем ответ)
  if (cachedResponse) {
    const updatePromise = fetch(request)
      .then(async (response): Promise<Response | undefined> => {
        if (response.ok) {
          await cache.put(request, createCacheableResponse(response.clone()));
          await cleanOldCacheEntries(cacheName, config.maxEntries ?? 100);
          // Byte-limit: проверяем общий размер кеша
          await purgeCacheIfNeeded(cacheName);
        }
        return undefined;
      })
      .catch((): undefined => {
        // Игнорируем ошибки фонового обновления
        return undefined;
      });

    // Запускаем обновление в фоне
    updatePromise.catch(() => {
      // Игнорируем ошибки фонового обновления
    });

    return {
      response: cachedResponse,
      source: 'STALE',
      timestamp: context.timestamp,
      traceId: context.traceId,
    };
  }

  // Если кеша нет, ждем сеть
  const response = await fetch(request);

  if (response.ok && await isValidForCaching(response, request)) {
    const responseSize = await getResponseSizeForCaching(response);

    if (responseSize !== null && responseSize <= MAX_RESPONSE_SIZE_BYTES) {
      await cache.put(request, createCacheableResponse(response.clone()));
      await cleanOldCacheEntries(cacheName, config.maxEntries ?? 100);
    }
  }

  return {
    response,
    source: 'NETWORK',
    timestamp: context.timestamp,
    traceId: context.traceId,
  };
}

/** Обрабатывает запрос согласно стратегии кеширования */
export async function handleRequest(
  request: Request,
  context: RequestContext,
  config: RouteCacheConfig,
): Promise<RequestResult> {
  // API cache isolation: используем изолированный кеш для API запросов
  let finalConfig = config;
  if (request.url.includes('/api/')) {
    const userHash = await getUserHashFromRequest(request);
    const apiCacheName = getApiCacheName(userHash);
    finalConfig = {
      ...config,
      cacheName: apiCacheName,
    };
  }

  switch (finalConfig.strategy) {
    case 'NetworkFirst':
      return networkFirstStrategy(request, finalConfig, context);
    case 'CacheFirst':
      return cacheFirstStrategy(request, finalConfig, context);
    case 'StaleWhileRevalidate':
      return staleWhileRevalidateStrategy(request, finalConfig, context);
    case 'NetworkOnly': {
      try {
        const response = await fetch(request);
        return {
          response,
          source: 'NETWORK',
          timestamp: context.timestamp,
          traceId: context.traceId,
        };
      } catch {
        return {
          response: new Response('Network error', {
            status: 503,
            statusText: 'Service Unavailable',
          }),
          source: 'ERROR',
          timestamp: context.timestamp,
          traceId: context.traceId,
        };
      }
    }
    case 'CacheOnly': {
      const cache = await caches.open(finalConfig.cacheName ?? mainCacheName);
      const cachedResponse = await cache.match(request);
      if (!cachedResponse) {
        return {
          response: new Response('Cache miss', { status: 504, statusText: 'Gateway Timeout' }),
          source: 'ERROR_CACHE_MISS',
          timestamp: context.timestamp,
          traceId: context.traceId,
        };
      }

      // CacheOnly возвращает кеш независимо от freshness
      // Обновляем timestamp для LRU (cache hit)
      await updateCacheEntryTimestamp(cache, request, cachedResponse);
      return {
        response: cachedResponse,
        source: 'CACHE',
        timestamp: context.timestamp,
        traceId: context.traceId,
      };
    }
    default:
      return networkFirstStrategy(request, finalConfig, context);
  }
}

/* ============================================================================
 * 📡 PUSH NOTIFICATIONS
 * ========================================================================== */

/** Обрабатывает push уведомления */
export async function handlePushNotification(event: ExtendableMessageEvent): Promise<void> {
  try {
    const eventData = event.data as { json?: () => unknown; } | undefined;
    const jsonMethod = eventData?.json;
    const data = (jsonMethod !== undefined ? jsonMethod() : undefined) as {
      title?: string;
      body?: string;
      icon?: string;
      tag?: string;
      data?: unknown;
      requireInteraction?: boolean;
      silent?: boolean;
    } | undefined ?? {};
    const title = data.title ?? 'LivAi';
    const options: NotificationOptions = {
      body: data.body ?? '',
      icon: data.icon ?? '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      ...(data.tag !== undefined && { tag: data.tag }),
      ...(data.data !== undefined && { data: data.data }),
      requireInteraction: data.requireInteraction ?? false,
      silent: data.silent ?? false,
    };

    await swSelf.registration.showNotification(title, options);
  } catch {
    // Graceful degradation - ошибки push notifications не должны ломать работу
    // В Service Worker нет доступа к telemetry, поэтому просто игнорируем ошибки
  }
}

/** Обрабатывает background sync события */
export function handleBackgroundSync(
  event: ExtendableEvent & { tag: string; },
): void {
  // Базовая обработка background sync - в будущем можно расширить
  // Пока просто подтверждаем получение события
  event.waitUntil(Promise.resolve());
}

/** Обрабатывает клик по уведомлению */
export async function handleNotificationClick(
  event: Event & { notification: Notification; },
): Promise<void> {
  event.notification.close();

  const data = event.notification.data as { url?: string; } | undefined;
  const url = data?.url ?? '/';

  const clients = await swSelf.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  // Пробуем открыть существующее окно
  for (const client of clients) {
    if (client.url === url && 'focus' in client) {
      await (client as Client & { focus(): Promise<Client>; }).focus();
      return;
    }
  }

  // Открываем новое окно
  const openWindowMethod = swSelf.clients.openWindow;
  await openWindowMethod(url);
}

/* ============================================================================
 * 🗑️ DECOMMISSION FLOW (Enterprise: полное удаление SW из прода)
 * ========================================================================== */

/**
 * Полностью удаляет Service Worker из продакшена.
 * Используется для emergency decommission.
 * Чек-лист:
 * - unregister SW
 * - delete all caches by prefix
 * - reload clients
 * - verify navigator.serviceWorker.controller === null
 * Вызывается из клиента через postMessage или через remote config.
 */
export async function decommissionServiceWorker(): Promise<void> {
  try {
    // 1. Удаляем все кеши с префиксом приложения
    const cacheNames = await caches.keys();
    const appCaches = cacheNames.filter((name) => name.startsWith(CACHE_PREFIX));
    await Promise.all(appCaches.map((name) => caches.delete(name)));

    // 2. Отправляем команду всем клиентам для перезагрузки
    const clients = await swSelf.clients.matchAll({ includeUncontrolled: true });
    await Promise.all(
      clients.map((client) => {
        if ('reload' in client && typeof client.reload === 'function') {
          return (client.reload as () => Promise<void>)();
        }
        // Проверяем, что это WindowClient с методом navigate
        if (client.type === 'window' && 'url' in client) {
          const windowClient = client as unknown as WindowClient;
          if (
            'navigate' in windowClient
            && typeof (windowClient as {
                navigate?: (url: string) => Promise<WindowClient | null>;
              }).navigate === 'function'
          ) {
            const navigateMethod =
              (windowClient as { navigate: (url: string) => Promise<WindowClient | null>; })
                .navigate;
            return navigateMethod(windowClient.url);
          }
        }
        return Promise.resolve();
      }),
    );

    // 3. Отключаем Service Worker
    await swSelf.registration.unregister();
  } catch {
    // Graceful degradation - ошибки не должны ломать процесс
  }
}

/* ============================================================================
 * 📊 BYTE-LIMIT НА ВЕСЬ CACHE (Enterprise: лимит на общий объём)
 * ========================================================================== */

/**
 * Подсчитывает общий размер кеша в байтах.
 */
async function getCacheSize(cacheName: string): Promise<number> {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const contentLength = response.headers.get('content-length');
        if (contentLength !== null) {
          totalSize += Number.parseInt(contentLength, 10);
        } else {
          // Если Content-Length нет, пытаемся получить размер через blob
          try {
            const blob = await response.blob();
            totalSize += blob.size;
          } catch {
            // Если не удалось, пропускаем
          }
        }
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Очищает кеш по LRU (Least Recently Used) при превышении лимита.
 */
async function purgeCacheIfNeeded(cacheName: string): Promise<void> {
  try {
    const totalSize = await getCacheSize(cacheName);
    if (totalSize <= MAX_TOTAL_CACHE_SIZE_BYTES) {
      return;
    }

    // Превышен лимит - удаляем старые записи (LRU)
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    // Собираем записи с timestamp
    const entries = await Promise.all(
      keys.map(async (request) => {
        const response = await cache.match(request);
        let size = 0;
        let timestamp = 0;

        if (response) {
          const contentLength = response.headers.get('content-length');
          if (contentLength !== null) {
            size = Number.parseInt(contentLength, 10);
          } else {
            try {
              const blob = await response.blob();
              size = blob.size;
            } catch {
              // Пропускаем если не удалось получить размер
            }
          }

          const cachedDate = response.headers.get('sw-cached-date');
          if (cachedDate !== null && cachedDate !== '') {
            timestamp = Number.parseInt(cachedDate, 10);
          }
        }

        return { request, size, timestamp };
      }),
    );

    // Сортируем по timestamp (старые первыми)
    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

    // Удаляем старые записи пока не уложимся в лимит
    let currentSize = totalSize;
    for (const entry of sortedEntries) {
      if (currentSize <= MAX_TOTAL_CACHE_SIZE_BYTES) {
        break;
      }
      await cache.delete(entry.request);
      currentSize -= entry.size;
    }
  } catch {
    // Graceful degradation
  }
}

/** Выполняет миграции между версиями SW */
function runVersionMigrations(oldVersion: string | null): Promise<void> {
  if (oldVersion === null) {
    // Первая установка, миграции не нужны
    return Promise.resolve();
  }

  // Пример: миграция с версии 1.0.0 на 1.1.0
  const targetVersion = '1.1.0';
  if (oldVersion < targetVersion) {
    // Здесь можно выполнить миграцию схемы кеша
    // Например: migrateCacheSchema()
  }

  // Добавьте другие миграции по мере необходимости
  return Promise.resolve();
}

/* ============================================================================
 * 🧹 ОЧИСТКА КЕШЕЙ
 * ========================================================================== */

/** Удаляет старые версии кешей */
async function cleanupOldCaches(): Promise<void> {
  try {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter((name) =>
      name.startsWith(CACHE_PREFIX) && !name.includes(`v${SW_VERSION}`)
    );

    await Promise.all(oldCaches.map((name) => caches.delete(name)));
  } catch {
    // Graceful degradation - ошибки очистки кешей не должны ломать работу
    // В Service Worker нет доступа к telemetry, поэтому просто игнорируем ошибки
  }
}

/* ============================================================================
 * 🎯 SERVICE WORKER EVENT HANDLERS
 * ========================================================================== */

/** Обработчик установки Service Worker */
swSelf.addEventListener('install', (event: ExtendableEvent): void => {
  // Kill-switch: если SW отключен, не устанавливаем
  // swDisabled - функция для будущего remote config
  if (swDisabled()) {
    return;
  }

  event.waitUntil(
    (async (): Promise<void> => {
      // Предварительное кеширование критических ресурсов
      // MAIN cache: offline.html и главная страница
      const mainCache = await caches.open(mainCacheName);
      try {
        await mainCache.addAll(precacheMainUrls as string[]);
      } catch {
        // Graceful degradation - если не удалось закешировать, продолжаем
      }

      // STATIC cache: иконки и статические ресурсы
      const staticCache = await caches.open(staticCacheName);
      try {
        await staticCache.addAll(precacheStaticUrls as string[]);
      } catch {
        // Graceful degradation - если не удалось закешировать, продолжаем
      }

      // Пропускаем ожидание активации для быстрого обновления
      await swSelf.skipWaiting();
    })(),
  );
});

/** Обработчик активации Service Worker */
swSelf.addEventListener('activate', (event: ExtendableEvent): void => {
  // Kill-switch: если SW отключен, не активируем
  // swDisabled - функция для будущего remote config
  if (swDisabled()) {
    return;
  }

  event.waitUntil(
    (async (): Promise<void> => {
      // Определяем старую версию из кешей
      const cacheNames = await caches.keys();
      const oldCache = cacheNames.find((name) =>
        name.startsWith(CACHE_PREFIX) && !name.includes(`v${SW_VERSION}`)
      );
      const versionMatch = oldCache?.match(/v([\d.]+)/);
      const oldVersion = versionMatch?.[1] ?? null;

      // Выполняем миграции между версиями
      await runVersionMigrations(oldVersion);

      // Очищаем старые кеши
      await cleanupOldCaches();

      // Берем контроль над всеми клиентами
      await swSelf.clients.claim();

      // Cache warming: прогрев критичных маршрутов
      // Можно добавить прогрев API кеша и dashboard shell
      // await warmupCache();
    })(),
  );
});

/** Обработчик fetch запросов */
swSelf.addEventListener('fetch', (event: FetchEvent) => {
  // Kill-switch: если SW отключен, не перехватываем запросы
  if (swDisabled()) {
    return;
  }

  const { request } = event;

  // Игнорируем не-GET запросы
  if (request.method !== 'GET') {
    return;
  }

  // Игнорируем range-requests (видео, аудио, стримы)
  // Service Worker не должен обрабатывать частичные запросы
  if (request.headers.has('range')) {
    return;
  }

  // Игнорируем chrome-extension и другие специальные протоколы
  if (!request.url.startsWith('http')) {
    return;
  }

  // Игнорируем запросы к сторонним доменам (same-origin only)
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
      return;
    }
  } catch {
    // Если не удалось распарсить URL, игнорируем запрос
    return;
  }

  const context: RequestContext = {
    timestamp: Date.now(),
    traceId: crypto.randomUUID(),
  };

  const url = new URL(request.url);
  const config = getRouteConfig(url.pathname);

  // Отправляем traceId клиентам для телеметрии
  const sendTelemetry = (result: RequestResult): void => {
    // Отправляем telemetry только для проблемных случаев (ERROR, STALE)
    // чтобы избежать перегрузки postMessage
    if (result.source === 'NETWORK' || result.source === 'CACHE') {
      return;
    }

    swSelf.clients.matchAll()
      .then((clients) => {
        clients.forEach((client) => {
          const message = {
            type: 'SW_TRACE',
            schemaVersion: TELEMETRY_SCHEMA_VERSION,
            traceId: result.traceId,
            url: request.url,
            strategy: config.strategy,
            cacheName: config.cacheName ?? null,
            source: result.source,
            timestamp: result.timestamp,
            appId: APP_ID,
            environment: ENVIRONMENT,
          };
          try {
            client.postMessage(message);
          } catch {
            // Игнорируем ошибки отправки телеметрии
          }
        });
        return undefined;
      })
      .catch(() => {
        // Игнорируем ошибки получения клиентов
      });
  };

  event.respondWith(
    handleRequest(request, context, config)
      .then((result) => {
        sendTelemetry(result);
        return result.response;
      })
      .catch(async (): Promise<Response> => {
        // Offline UX contract: определяем стратегию ответа
        // 503/504 → offline.html
        // Другие → raw error или retry
        let offlinePage: Response | undefined;
        try {
          offlinePage = await caches.match('/offline.html');
        } catch {
          // Игнорируем ошибки получения offline страницы
        }
        if (offlinePage !== undefined) {
          return offlinePage;
        }
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }),
  );
});

/** Обработчик push уведомлений */
swSelf.addEventListener('push', (event: ExtendableMessageEvent): void => {
  event.waitUntil(handlePushNotification(event));
});

/** Обработчик клика по уведомлению */
swSelf.addEventListener(
  'notificationclick',
  (
    event: Event & { notification: Notification; waitUntil?: (promise: Promise<unknown>) => void; },
  ): void => {
    const waitUntilMethod = event.waitUntil;
    if (waitUntilMethod !== undefined) {
      waitUntilMethod(handleNotificationClick(event));
    } else {
      handleNotificationClick(event).catch(() => {
        // Игнорируем ошибки обработки клика по уведомлению
      });
    }
  },
);

/** Обработчик background sync событий */
swSelf.addEventListener('sync', (event: ExtendableEvent & { tag: string; }): void => {
  event.waitUntil(
    Promise.resolve().then(() => {
      handleBackgroundSync(event);
      return undefined;
    }),
  );
});
