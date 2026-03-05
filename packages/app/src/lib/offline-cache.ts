/**
 * @file packages/app/src/lib/offline-cache.ts
 * ============================================================================
 * 🗄️ OFFLINE CACHE CORE — УЛЬТИМАТИВНОЕ ЯДРО ОФФЛАЙН-КЭШИРОВАНИЯ
 * ============================================================================
 * Свойства:
 * - Гибридная память + постоянное хранилище
 * - Stale-While-Revalidate с EventEmitter
 * - Неизменяемый и функциональный
 * - Отказоустойчивый и resilient
 * - Готов к telemetry, microservice-friendly, безопасен для распределенных систем
 * ┌───────────────────── SWR Flow ─────────────────────┐
 * │                                                    │
 * │ getOrFetch(key) → Cache Check → Fresh? → Return    │
 * │     ↓                ↓              ↓              │
 * │ Cache Miss       Stale Data    Background Fetch    │
 * │     ↓                ↓              ↓              │
 * │ ongoingFetches? → Wait Existing → Return           │
 * │     ↓                                              │
 * │   Start New → Fetch → Store → Return               │
 * │                                                    │
 * │ Key: ongoingFetches + staleWhileRevalidateDelay    │
 * └────────────────────────────────────────────────────┘
 */

import { EventEmitter } from 'events';

import type { Effect } from '@livai/core/effect';

import { errorFireAndForget, warnFireAndForget } from './telemetry-runtime.js';

/* ============================================================================
 * 📡 EVENT TYPES
 * ========================================================================== */
export type OfflineCacheEvents = {
  update: (key: CacheKey, value: unknown, traceId?: string, service?: string) => void;
  error: (err: unknown, key: CacheKey, traceId?: string, service?: string) => void;
  delete: (key: CacheKey, traceId?: string, service?: string) => void;
  clear: (traceId?: string, service?: string) => void;
};

class TypedOfflineCacheEmitter extends EventEmitter {
  override on<K extends keyof OfflineCacheEvents>(event: K, listener: OfflineCacheEvents[K]): this {
    return super.on(event, listener);
  }

  override once<K extends keyof OfflineCacheEvents>(
    event: K,
    listener: OfflineCacheEvents[K],
  ): this {
    return super.once(event, listener);
  }

  override emit<K extends keyof OfflineCacheEvents>(
    event: K,
    ...args: Parameters<OfflineCacheEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

type OfflineCacheEmitter = TypedOfflineCacheEmitter;

/* ============================================================================
 * 🧠 КОНТЕКСТ КЭША
 * ========================================================================== */
export type OfflineCacheContext = {
  readonly service?: string;
  readonly traceId?: string;
  readonly locale?: string;
  readonly attributes?: Record<string, string | number | boolean>;
};

/* ============================================================================
 * 🏷️ КЛЮЧИ И МЕТАДАННЫЕ
 * ========================================================================== */
export type CacheKey = string;

export type CacheEntry<T> = Readonly<{
  key: CacheKey;
  value: T;
  createdAt: number;
  expiresAt?: number | undefined;
  staleAt?: number | undefined;
  version?: number | undefined;
}>;

/* ============================================================================
 * 🧱 CONTRACT: STORE
 * ========================================================================== */
export type OfflineCacheStore = {
  get<T>(key: CacheKey): Effect<CacheEntry<T> | undefined>;
  set<T>(entry: CacheEntry<T>): Effect<void>;
  delete(key: CacheKey): Effect<void>;
  clear(): Effect<void>;
  snapshot?(): Effect<readonly CacheEntry<unknown>[]>;
};

/* ============================================================================
 * ⚙️ CACHE OPTIONS
 * ========================================================================== */
export type OfflineCacheOptions = {
  readonly ttl?: number;
  readonly staleTtl?: number;
  readonly allowStale?: boolean;
  readonly namespace?: string;
  readonly version?: number;
  readonly context?: OfflineCacheContext;
  readonly staleWhileRevalidateDelay?: number; // Задержка перед фоновым обновлением stale данных (мс)
  readonly retryAttempts?: number; // Количество попыток повторного запроса при ошибке (default: 3)
  readonly retryDelay?: number; // Начальная задержка между попытками в мс (default: 1000)
  readonly retryBackoff?: number; // Множитель задержки для экспоненциального backoff (default: 2)
  readonly onError?: (err: unknown, key: CacheKey) => void;
  readonly onUpdate?: (key: CacheKey, value: unknown) => void;
  readonly onEvaluate?: (result: OfflineCacheResult<unknown>) => void;
};

/* ============================================================================
 * 📊 CACHE RESULT
 * ========================================================================== */
export type OfflineCacheResult<T> = Readonly<{
  key: CacheKey;
  value: T;
  source: 'CACHE' | 'STALE' | 'REMOTE' | 'ERROR';
  timestamp: number;
  error?: unknown;
  context?: OfflineCacheContext;
}>;

/* ============================================================================
 * 🎯 OFFLINE CACHE ENGINE
 * ========================================================================== */
export function createOfflineCache(
  store: OfflineCacheStore,
  options?: OfflineCacheOptions,
): {
  getOrFetch: <T>(
    key: CacheKey,
    fetcher: Effect<T>,
    abortCtrl?: AbortController,
    contextOverride?: OfflineCacheContext,
  ) => Effect<OfflineCacheResult<T>>;
  get: <T>(key: CacheKey) => Effect<T | undefined>;
  set: <T>(key: CacheKey, value: T, contextOverride?: OfflineCacheContext) => Effect<void>;
  remove: (key: CacheKey, contextOverride?: OfflineCacheContext) => Effect<void>;
  clear: (contextOverride?: OfflineCacheContext) => Effect<void>;
  cancel: (key: CacheKey) => boolean;
  on: <Event extends keyof OfflineCacheEvents>(
    event: Event,
    listener: OfflineCacheEvents[Event],
  ) => void;
  events: OfflineCacheEmitter;
} {
  const {
    ttl,
    staleTtl,
    allowStale = true,
    namespace = 'default',
    version,
    context,
    staleWhileRevalidateDelay = 0, // По умолчанию без задержки
    retryAttempts = DEFAULT_RETRY_ATTEMPTS, // По умолчанию 3 попытки
    retryDelay = DEFAULT_RETRY_DELAY, // По умолчанию 1 секунда
    retryBackoff = DEFAULT_RETRY_BACKOFF, // По умолчанию экспоненциальный backoff
    onError,
    onUpdate,
    onEvaluate,
  } = options ?? {};

  const buildKey = (key: CacheKey): string => `${namespace}:${key}`;
  const now = (): number => Date.now();
  const events = new TypedOfflineCacheEmitter();

  // Debounced версия onEvaluate для снижения нагрузки при частых stale updates
  let onEvaluateTimeoutId: ReturnType<typeof setTimeout> | undefined;
  const debouncedOnEvaluate = (result: OfflineCacheResult<unknown>): void => {
    if (onEvaluateTimeoutId) {
      clearTimeout(onEvaluateTimeoutId);
    }
    onEvaluateTimeoutId = setTimeout(() => {
      onEvaluate?.(result);
    }, 100); // 100ms debounce для high-frequency stale updates
  };
  const ongoingFetches: Record<
    CacheKey,
    { promise: Promise<unknown>; timeoutId?: ReturnType<typeof setTimeout>; }
  > = {};

  /** Очищает ongoing fetch для ключа */
  function cleanupFetch(namespacedKey: CacheKey, signal?: AbortSignal): void {
    const entry = ongoingFetches[namespacedKey];
    if (entry) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      if (signal) {
        signal.removeEventListener('abort', () => {
          cleanupFetch(namespacedKey);
        });
      }

      delete ongoingFetches[namespacedKey];
    }
  }

  /** Создает promise для fetch операции с обработкой ошибок и событиями */
  function createFetchPromise<T>(
    namespacedKey: CacheKey,
    fetcher: Effect<T>,
    signal: AbortSignal,
    requestContext?: OfflineCacheContext,
  ): Promise<T> {
    const abortHandler = (): void => {
      cleanupFetch(namespacedKey, signal);
    };

    signal.addEventListener('abort', abortHandler);

    // NOTE: Если fetcher не поддерживает AbortSignal, фоновый fetch может продолжаться
    // даже после abort. Это задокументированное поведение для совместимости.

    // Проверяем abort перед началом выполнения
    if (signal.aborted) {
      cleanupFetch(namespacedKey, signal);
      throw new Error('Operation was aborted');
    }

    return retryWithBackoff(
      () => fetcher(signal),
      {
        attempts: retryAttempts,
        delay: retryDelay,
        backoff: retryBackoff,
        signal,
        onRetry: (attempt) => {
          warnFireAndForget('Cache retry operation', {
            key: namespacedKey,
            attempt,
            operation: 'retry',
          });
        },
      },
    )
      .then(async (value: T) => {
        await store.set(buildEntry(namespacedKey, value))();
        onUpdate?.(namespacedKey, value);
        events.emit(
          'update',
          namespacedKey,
          value,
          requestContext?.traceId,
          requestContext?.service,
        );
        return value;
      })
      .catch((err: unknown) => {
        onError?.(err, namespacedKey);
        events.emit('error', err, namespacedKey, requestContext?.traceId, requestContext?.service);

        errorFireAndForget('Cache fetch failed', {
          key: namespacedKey,
          operation: 'fetch',
        });
        throw err;
      })
      .finally(() => {
        signal.removeEventListener('abort', abortHandler);
        cleanupFetch(namespacedKey);
      });
  }

  /** Обрабатывает случай с stale данными */
  function handleStaleData<T>(
    entry: CacheEntry<T>,
    namespacedKey: CacheKey,
    fetcher: Effect<T>,
    signal: AbortSignal,
    requestContext?: OfflineCacheContext,
  ): OfflineCacheResult<T> {
    // Фоновое обновление без блокировки - только если нет ongoing fetch
    if (!(namespacedKey in ongoingFetches)) {
      // Проверяем еще раз, что fetch не запущен (на случай гонки)
      if (!signal.aborted) {
        const fetchPromise = createFetchPromise(namespacedKey, fetcher, signal, requestContext);

        if (staleWhileRevalidateDelay > 0) {
          // Запускаем fetch с задержкой
          const timeoutId = setTimeout(() => {
            // Fetch уже создан в createFetchPromise, просто убираем timeoutId
            if (namespacedKey in ongoingFetches) {
              ongoingFetches[namespacedKey] = { promise: fetchPromise };
            }
          }, staleWhileRevalidateDelay);

          ongoingFetches[namespacedKey] = { promise: fetchPromise, timeoutId };
        } else {
          // Запускаем немедленно

          ongoingFetches[namespacedKey] = { promise: fetchPromise };
        }

        // Обработчик abort для полной очистки
        signal.addEventListener('abort', () => {
          cleanupFetch(namespacedKey);
        }, { once: true });

        // Гарантируем очистку после завершения
        fetchPromise.finally(() => {
          cleanupFetch(namespacedKey);
        }).catch(() => {
          // Игнорируем ошибки очистки
        });
      }
    }

    const result = createCacheResult(entry.key, entry.value, 'STALE', now(), undefined, context);
    debouncedOnEvaluate(result);
    return result;
  }

  /** Проверяет, истек ли срок действия записи кэша */
  const isExpired = (entry: CacheEntry<unknown>): boolean =>
    entry.expiresAt !== undefined && entry.expiresAt <= now();

  /** Проверяет, является ли запись кэша устаревшей (stale) */
  const isStale = (entry: CacheEntry<unknown>): boolean =>
    entry.staleAt !== undefined && entry.staleAt <= now();

  /** Создает новую запись кэша с метаданными */
  function buildEntry<T>(key: CacheKey, value: T): CacheEntry<T> {
    const createdAt = now();
    return Object.freeze({
      key,
      value,
      createdAt,
      expiresAt: ttl !== undefined ? createdAt + ttl : undefined,
      staleAt: staleTtl !== undefined ? createdAt + staleTtl : undefined,
      version,
    });
  }

  /** Создает результат кэша с контекстом */
  function createCacheResult<T>(
    key: CacheKey,
    value: T,
    source: 'CACHE' | 'STALE' | 'REMOTE' | 'ERROR',
    timestamp: number,
    error?: unknown,
    resultContext?: OfflineCacheContext,
  ): OfflineCacheResult<T> {
    const ctx = resultContext ?? context;
    return freeze(
      ctx
        ? { key, value, source, timestamp, error, context: ctx }
        : { key, value, source, timestamp, error },
    );
  }

  /** Обрабатывает возврат существующего ongoing fetch */
  async function handleExistingFetch<T>(
    key: CacheKey,
    namespacedKey: CacheKey,
    timestamp: number,
    requestContext?: OfflineCacheContext,
  ): Promise<OfflineCacheResult<T>> {
    const entry = ongoingFetches[namespacedKey] as { promise: Promise<unknown>; };
    const value = await entry.promise as T;
    const result = createCacheResult(key, value, 'REMOTE', timestamp, undefined, requestContext);
    onEvaluate?.(result);
    return result;
  }

  /** Обрабатывает удаленную загрузку */
  async function handleRemoteFetch<T>(
    key: CacheKey,
    namespacedKey: CacheKey,
    fetcher: Effect<T>,
    signal: AbortSignal,
    timestamp: number,
    requestContext?: OfflineCacheContext,
  ): Promise<OfflineCacheResult<T>> {
    try {
      const fetchPromise = createFetchPromise(namespacedKey, fetcher, signal, requestContext);

      ongoingFetches[namespacedKey] = { promise: fetchPromise };
      const value = await fetchPromise;
      const result = createCacheResult(key, value, 'REMOTE', timestamp, undefined, requestContext);
      onEvaluate?.(result);
      return result;
    } catch (err: unknown) {
      return handleErrorFallback(key, namespacedKey, timestamp, err, requestContext);
    }
  }

  /** Обрабатывает fallback при ошибке */
  async function handleErrorFallback<T>(
    key: CacheKey,
    namespacedKey: CacheKey,
    timestamp: number,
    err: unknown,
    requestContext?: OfflineCacheContext,
  ): Promise<OfflineCacheResult<T>> {
    // Попытаться получить кэшированное значение даже при ошибке
    try {
      const entry = await store.get<T>(namespacedKey)();
      if (entry && !isExpired(entry)) {
        const result = createCacheResult(
          key,
          entry.value,
          'STALE',
          timestamp,
          undefined,
          requestContext,
        );
        onEvaluate?.(result);
        return result;
      }
    } catch {
      // Игнорируем ошибки получения кэша
    }

    // Fallback: возвращаем результат с undefined и ошибкой для диагностики
    const result = createCacheResult(key, undefined as T, 'ERROR', timestamp, err, requestContext);
    onEvaluate?.(result);
    return result;
  }

  /** Основной метод получения с SWR */
  function getOrFetch<T>(
    key: CacheKey,
    fetcher: Effect<T>,
    abortCtrl?: AbortController,
    contextOverride?: OfflineCacheContext,
  ): Effect<OfflineCacheResult<T>> {
    return async () => {
      const namespacedKey = buildKey(key);
      const timestamp = now();
      const requestContext = contextOverride ?? context;

      // Создаем AbortController если не предоставлен
      const controller = abortCtrl ?? new AbortController();
      const { signal } = controller;

      try {
        const entry = await store.get<T>(namespacedKey)();

        if (entry && !isExpired(entry) && !isStale(entry)) {
          const result = createCacheResult(
            key,
            entry.value,
            'CACHE',
            timestamp,
            undefined,
            requestContext,
          );
          onEvaluate?.(result);
          return result;
        }

        if (namespacedKey in ongoingFetches) {
          return await handleExistingFetch(key, namespacedKey, timestamp, requestContext);
        }

        if (entry && !isExpired(entry) && allowStale) {
          return handleStaleData(entry, namespacedKey, fetcher, signal, requestContext);
        }

        // Cache miss - логируем и загружаем удаленно
        warnFireAndForget('Cache miss, fetching remotely', {
          key: namespacedKey,
          operation: 'cache_miss',
        });

        // Удаленная загрузка + кэширование
        return await handleRemoteFetch(
          key,
          namespacedKey,
          fetcher,
          signal,
          timestamp,
          requestContext,
        );
      } catch (err: unknown) {
        onError?.(err, namespacedKey);
        events.emit('error', err, namespacedKey, context?.traceId, context?.service);

        errorFireAndForget('Cache getOrFetch failed', {
          key: namespacedKey,
          operation: 'getOrFetch',
        });

        return handleErrorFallback(key, namespacedKey, timestamp, err, requestContext);
      }
    };
  }

  const get = <T>(key: CacheKey): Effect<T | undefined> =>
    mapEffectResult(store.get<T>(buildKey(key)), (entry) => entry?.value);

  const set = <T>(key: CacheKey, value: T, contextOverride?: OfflineCacheContext): Effect<void> =>
    chainEffects(
      store.set(buildEntry(buildKey(key), value)),
      (): Effect<void> => (): Promise<void> => {
        const namespacedKey = buildKey(key);
        const ctx = contextOverride ?? context;
        events.emit('update', namespacedKey, value, ctx?.traceId, ctx?.service);
        onUpdate?.(namespacedKey, value);
        return Promise.resolve();
      },
    );

  const remove = (key: CacheKey, contextOverride?: OfflineCacheContext): Effect<void> =>
    chainEffects(
      store.delete(buildKey(key)),
      (): Effect<void> => (): Promise<void> => {
        const namespacedKey = buildKey(key);
        const ctx = contextOverride ?? context;
        events.emit('delete', namespacedKey, ctx?.traceId, ctx?.service);
        return Promise.resolve();
      },
    );

  const clear = (contextOverride?: OfflineCacheContext): Effect<void> =>
    chainEffects(
      store.clear(),
      (): Effect<void> => (): Promise<void> => {
        const ctx = contextOverride ?? context;
        events.emit('clear', ctx?.traceId, ctx?.service);
        return Promise.resolve();
      },
    );

  const cancel = (key: CacheKey): boolean => {
    const namespacedKey = buildKey(key);
    if (namespacedKey in ongoingFetches) {
      cleanupFetch(namespacedKey);
      warnFireAndForget('Cache fetch cancelled by client', {
        key: namespacedKey,
        operation: 'cancel',
      });
      return true;
    }
    return false;
  };

  const on = <Event extends keyof OfflineCacheEvents>(
    event: Event,
    listener: OfflineCacheEvents[Event],
  ): void => {
    events.on(event, listener);
  };

  return freeze({ getOrFetch, get, set, remove, clear, cancel, on, events });
}

/* ============================================================================
 * 🧪 IN-MEMORY STORE (REFERENCE)
 * ========================================================================== */
export function createInMemoryOfflineCacheStore(): OfflineCacheStore {
  const cache = new Map<CacheKey, CacheEntry<unknown>>();

  return {
    get<T>(key: CacheKey): Effect<CacheEntry<T> | undefined> {
      return (): Promise<CacheEntry<T> | undefined> =>
        Promise.resolve(cache.get(key) as CacheEntry<T> | undefined);
    },
    set<T>(entry: CacheEntry<T>): Effect<void> {
      return (): Promise<void> => {
        cache.set(entry.key, freeze(entry));
        return Promise.resolve();
      };
    },
    delete(key: CacheKey): Effect<void> {
      return (): Promise<void> => {
        cache.delete(key);
        return Promise.resolve();
      };
    },
    clear(): Effect<void> {
      return (): Promise<void> => {
        cache.clear();
        return Promise.resolve();
      };
    },
    snapshot(): Effect<readonly CacheEntry<unknown>[]> {
      return (): Promise<readonly CacheEntry<unknown>[]> =>
        Promise.resolve(Object.freeze([...cache.values()]));
    },
  };
}

/* ============================================================================
 * 🔄 RETRY LOGIC
 * ========================================================================== */

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_RETRY_BACKOFF = 2;
const RETRY_JITTER_FACTOR = 0.25; // Фактор jitter для распределения нагрузки (25%)

// Выполняет функцию с повторными попытками и экспоненциальным backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    delay: number;
    backoff: number;
    onRetry?: (attempt: number, error: unknown) => void;
    signal?: AbortSignal;
  },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    // Проверяем abort перед каждой попыткой
    if (options.signal?.aborted ?? false) {
      throw new Error('Operation was aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === options.attempts) {
        break; // Последняя попытка, выбрасываем ошибку
      }

      const baseDelay = options.delay * Math.pow(options.backoff, attempt - 1);
      // Добавляем jitter (случайное смещение до 25% от базовой задержки)
      const jitter = baseDelay * RETRY_JITTER_FACTOR * Math.random();
      const delay = baseDelay + jitter;
      options.onRetry?.(attempt, error);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Логируем финальную ошибку для telemetry
  errorFireAndForget('Cache retry exhausted', {
    attempts: options.attempts,
    operation: 'retry_exhausted',
  });

  throw lastError;
}

/* ============================================================================
 * 🔒 UTILS
 * ========================================================================== */

/** Замораживает объект для обеспечения immutability. Возвращает объект без изменений если он уже заморожен */
function freeze<T>(obj: T): T {
  if (Object.isFrozen(obj)) return obj;

  // Deep freeze для вложенных объектов
  if (obj !== null && obj !== undefined && typeof obj === 'object') {
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
      const value = (obj as Record<string, unknown>)[name];
      if (value !== null && value !== undefined && typeof value === 'object') {
        freeze(value);
      }
    }
  }

  return Object.freeze(obj);
}

/** Effect композиция: последовательное выполнение эффектов (аналог chain/flatMap для нашей простой Effect системы) */
function chainEffects<A, B>(effect: Effect<A>, next: (value: A) => Effect<B>): Effect<B> {
  return () => effect().then((value) => next(value)());
}

/** Effect композиция: трансформация результата (аналог map для нашей простой Effect системы) */
function mapEffectResult<A, B>(effect: Effect<A>, transform: (value: A) => B): Effect<B> {
  return () => effect().then(transform);
}

/**
 * Effect композиция: pipe для последовательного выполнения эффектов
 * Позволяет создавать цепочки трансформаций для сложной логики
 * @param effect - Начальный эффект
 * @param transforms - Массив функций-трансформаторов
 * @returns Составной эффект с последовательными трансформациями
 */
export function pipeEffects<A, B = A>(
  effect: Effect<A>,
  ...transforms: ((value: unknown) => Effect<unknown>)[]
): Effect<B> {
  return transforms.reduce((currentEffect, transform) => {
    return chainEffects(currentEffect, (value) => {
      const nextEffect = transform(value);
      return nextEffect;
    });
  }, effect as Effect<unknown>) as Effect<B>;
}
