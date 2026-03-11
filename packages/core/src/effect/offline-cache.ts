/**
 * @file packages/core/src/effect/offline-cache.ts
 * ============================================================================
 * 🗄️ OFFLINE CACHE CORE — УЛЬТИМАТИВНОЕ ЯДРО ОФФЛАЙН-КЭШИРОВАНИЯ
 * ============================================================================
 *
 * Свойства:
 * - Гибридная память + постоянное хранилище
 * - Stale-While-Revalidate с внутренним TypedEmitter (без Node.js зависимостей)
 * - Неизменяемый и функциональный
 * - Resilient и отказоустойчивый
 * - Готов к telemetry через onError/onUpdate/onEvaluate (DI), microservice-friendly
 * - Без зависимостей от app-слоя и telemetry-runtime
 *
 * FILE STRUCTURE: Types → Store Adapter → Cache Engine → Store Implementations → Retry System → Utilities → Event System
 *
 * ┌───────────────────── SWR Flow ─────────────────────┐
 * │                                                    │
 * │ getOrFetch(key) → Cache Check → Fresh? → Return    │
 * │     ↓                ↓              ↓              │
 * │ Cache Miss       Stale Data    Background Fetch    │
 * │     ↓                ↓              ↓              │
 * │ inFlightFetches? → Wait Existing → Return          │
 * │     ↓                                              │
 * │   Start New → Fetch → Store → Return               │
 * │                                                    │
 * │ Key: inFlightFetches + staleWhileRevalidateDelay   │
 * └────────────────────────────────────────────────────┘
 */

import type { Effect, EffectTimer } from './effect-utils.js';
import { defaultTimer, pipeEffects } from './effect-utils.js';

/* ============================================================================
 * 🧱 TYPES — КОНТЕКСТ, КЛЮЧИ, ЗАПИСИ, КОНТРАКТЫ И СТРАТЕГИИ
 * ========================================================================== */

export interface OfflineCacheContext {
  readonly service?: string;
  readonly traceId?: string;
  readonly locale?: string;
  readonly attributes?: Record<string, string | number | boolean>;
}

// 🏷️ КЛЮЧИ И МЕТАДАННЫЕ
export type CacheKey = string;

export type CacheEntry<T> = Readonly<{
  key: CacheKey;
  value: T;
  createdAt: number;
  expiresAt?: number | undefined;
  staleAt?: number | undefined;
  version?: number | undefined;
}>;

// 🧱 CONTRACT: STORE
export interface OfflineCacheStore {
  get<T>(key: CacheKey): Effect<CacheEntry<T> | undefined>;
  set<T>(entry: CacheEntry<T>): Effect<void>;
  delete(key: CacheKey): Effect<void>;
  clear(): Effect<void>;
  snapshot?(): Effect<readonly CacheEntry<unknown>[]>;
}

// 🧮 EVICTION & RETRY STRАТЕГИИ (TYPES)
export interface OfflineCacheEvictionStrategy {
  isExpired(entry: CacheEntry<unknown>, now: () => number): boolean;
  isStale?(entry: CacheEntry<unknown>, now: () => number): boolean;
}

export interface RetryStrategyOptions {
  attempts: number;
  delay: number;
  backoff: number;
  timer: EffectTimer;
  random: () => number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, error: unknown) => void;
}

export type RetryStrategy = <T>(
  fn: () => Promise<T>,
  options: RetryStrategyOptions,
) => Promise<T>;

export type OfflineCacheFreezeMode = 'deep' | 'shallow' | 'none';

// 🧾 STORE ADAPTER — NAMESPACE WRAPPER
/**
 * Оборачивает OfflineCacheStore, добавляя namespace к ключам.
 * Доменный слой работает с логическими ключами, storage-слой — с namespaced ключами.
 */
function wrapNamespacedStore(store: OfflineCacheStore, namespace: string): OfflineCacheStore {
  const prefix = `${namespace}:`;
  const withNamespace = (key: CacheKey): CacheKey => `${prefix}${key}`;

  return {
    get: <T>(key: CacheKey): Effect<CacheEntry<T> | undefined> => store.get<T>(withNamespace(key)),

    set: <T>(entry: CacheEntry<T>): Effect<void> =>
      store.set<T>(
        freeze({
          ...entry,
          key: withNamespace(entry.key),
        }),
      ),

    delete: (key: CacheKey): Effect<void> => store.delete(withNamespace(key)),

    clear: (): Effect<void> => store.clear(),
    ...(store.snapshot && {
      snapshot: (): Effect<readonly CacheEntry<unknown>[]> => {
        const snapshot = store.snapshot;
        if (!snapshot) {
          return async () => Promise.resolve([] as readonly CacheEntry<unknown>[]);
        }
        return snapshot();
      },
    }),
  };
}

/* ============================================================================
 * ⚙️ CACHE OPTIONS
 * ========================================================================== */
export interface OfflineCacheOptions {
  readonly ttl?: number;
  readonly staleTtl?: number;
  readonly allowStale?: boolean;
  readonly namespace?: string;
  /**
   * Версия кэша для инвалидации при изменении схемы данных.
   * Зарезервировано для будущего использования: автоматическая инвалидация по версии не реализована.
   * Значение сохраняется в CacheEntry и может использоваться внешними системами для ручной инвалидации.
   */
  readonly version?: number;
  readonly context?: OfflineCacheContext;
  readonly staleWhileRevalidateDelay?: number; // Задержка перед фоновым обновлением stale данных (мс)
  readonly evictionStrategy?: OfflineCacheEvictionStrategy; // Кастомная стратегия устаревания/протухания (TTL/LRU/LFU и т.п.)
  readonly retryAttempts?: number; // Количество попыток повторного запроса при ошибке (default: 3)
  readonly retryDelay?: number; // Начальная задержка между попытками в мс (default: 1000)
  readonly retryBackoff?: number; // Множитель задержки для экспоненциального backoff (default: 2)
  readonly retryStrategy?: RetryStrategy; // Кастомная стратегия retry (по умолчанию retryWithBackoff)
  readonly freezeMode?: OfflineCacheFreezeMode; // Режим заморозки результатов: deep (по умолчанию), shallow или none
  readonly maxFetchDurationMs?: number; // Максимальная длительность одного fetch перед автоматическим abort (ms)
  readonly onRetry?: (attempt: number, error: unknown) => void; // Callback для telemetry при retry
  readonly onError?: (err: unknown, key: CacheKey) => void;
  readonly onUpdate?: (key: CacheKey, value: unknown) => void;
  readonly onEvaluate?: (result: OfflineCacheResult<unknown>) => void;
  /**
   * Кастомный таймер для детерминированного тестирования (fake timers).
   * По умолчанию используется defaultTimer из effect-utils (обёртка над setTimeout/Date.now).
   */
  readonly timer?: EffectTimer;
  /**
   * Источник случайности для jitter в retryWithBackoff.
   * По умолчанию Math.random, в тестах можно подменить на seedable PRNG.
   */
  readonly random?: () => number;
}

// 📊 CACHE RESULT
export type OfflineCacheResult<T> = Readonly<{
  key: CacheKey;
  value: T;
  source: 'CACHE' | 'STALE' | 'REMOTE' | 'ERROR';
  timestamp: number;
  error?: unknown;
  context?: OfflineCacheContext;
}>;

// 🔢 RETRY CONSTANTS
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_RETRY_BACKOFF = 2;
const RETRY_JITTER_FACTOR = 0.25;

// 📦 IN-MEMORY STORE LIMITS
const DEFAULT_MAX_IN_MEMORY_ENTRIES = 1000;

/* ============================================================================
 * 🎯 OFFLINE CACHE ENGINE
 * ========================================================================== */
/* eslint-disable functional/immutable-data, functional/no-let, fp/no-mutation, fp/no-throw */
// Инфраструктурный код: использует мутабельные структуры данных (Map/Set) и выбрасывание ошибок
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
  cleanupExpired: () => Effect<void>;
} {
  const {
    ttl,
    staleTtl,
    allowStale = true,
    namespace = 'default',
    version,
    context,
    staleWhileRevalidateDelay = 0, // По умолчанию без задержки
    evictionStrategy,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS, // По умолчанию 3 попытки
    retryDelay = DEFAULT_RETRY_DELAY, // По умолчанию 1 секунда
    retryBackoff = DEFAULT_RETRY_BACKOFF, // По умолчанию экспоненциальный backoff
    retryStrategy = retryWithBackoff,
    freezeMode = 'deep',
    maxFetchDurationMs,
    onRetry,
    onError,
    onUpdate,
    onEvaluate,
    timer = defaultTimer,
    random = Math.random,
  } = options ?? {};

  const storeWithNamespace = namespace.length > 0
    ? wrapNamespacedStore(store, namespace) // Добавляем namespace к ключам
    : store;

  const now = (): number => timer.now();
  const events = new TypedOfflineCacheEmitter();

  const effectiveEviction: OfflineCacheEvictionStrategy = evictionStrategy ?? {
    isExpired: (entry: CacheEntry<unknown>, getNow: () => number): boolean =>
      entry.expiresAt !== undefined && entry.expiresAt <= getNow(),
    isStale: (entry: CacheEntry<unknown>, getNow: () => number): boolean =>
      entry.staleAt !== undefined && entry.staleAt <= getNow(),
  };

  /** Проверяет, истек ли срок действия записи кэша (с учётом кастомной стратегии) */
  const isExpired = (entry: CacheEntry<unknown>): boolean =>
    effectiveEviction.isExpired(entry, now);

  /** Проверяет, является ли запись кэша устаревшей (stale) (с учётом кастомной стратегии) */
  const isStale = (entry: CacheEntry<unknown>): boolean =>
    effectiveEviction.isStale?.(entry, now) ?? false; // Если стратегия не определяет stale, считаем свежим

  /** Безопасно вызывает onError для телеметрии, не позволяя ему прерывать основной поток */
  const safeOnError = (err: unknown, key: CacheKey): void => {
    try {
      onError?.(err, key);
    } catch {
      // Ошибку логгера сознательно заглатываем, чтобы не затенить исходную ошибку
    }
  };

  /** Безопасно вызывает произвольный listener, пробрасывая его ошибки в onError */
  const safeListener = <Args extends unknown[]>(
    listener: ((...args: Args) => void) | undefined,
    key: CacheKey,
    ...args: Args
  ): void => {
    if (!listener) {
      return;
    }
    try {
      listener(...args);
    } catch (err) {
      safeOnError(err, key);
    }
  };

  /** Безопасно эмитит события кэша, пробрасывая ошибки listener'ов в onError (если ключ задан) */
  const safeEmit = <Event extends keyof OfflineCacheEvents>(
    event: Event,
    keyForOnError: CacheKey | undefined,
    ...args: Parameters<OfflineCacheEvents[Event]>
  ): void => {
    try {
      events.emit(event, ...args);
    } catch (emitError) {
      if (keyForOnError !== undefined) {
        safeOnError(emitError, keyForOnError); // Для error-событий keyForOnError = undefined, не логируем ошибки эмиттера
      }
    }
  };

  // Debounced версия onEvaluate для снижения нагрузки при частых stale updates (per-key)
  const onEvaluateTimeouts = new Map<CacheKey, ReturnType<EffectTimer['setTimeout']>>();
  const debouncedOnEvaluate = (result: OfflineCacheResult<unknown>): void => {
    const existingTimeoutId = onEvaluateTimeouts.get(result.key);
    if (existingTimeoutId !== undefined) {
      timer.clearTimeout(existingTimeoutId);
    }
    const timeoutId = timer.setTimeout(() => {
      safeListener(onEvaluate, result.key, result);
      onEvaluateTimeouts.delete(result.key);
    }, 100); // 100ms debounce для high-frequency stale updates
    onEvaluateTimeouts.set(result.key, timeoutId);
  };
  // Registry для трекинга активных fetch‑операций (in‑flight запросы)
  const inFlightFetches = new Map<CacheKey, { promise: Promise<unknown>; timeoutId?: unknown; }>();

  /** Очищает in‑flight fetch для ключа */
  function cleanupFetch(key: CacheKey): void {
    const entry = inFlightFetches.get(key);
    if (entry === undefined) {
      return;
    }

    if (entry.timeoutId !== undefined) {
      timer.clearTimeout(entry.timeoutId);
    }

    inFlightFetches.delete(key);
  }

  /** Создает promise для fetch операции с обработкой ошибок и событиями */
  function createFetchPromise<T>(
    key: CacheKey,
    fetcher: Effect<T>,
    signal: AbortSignal,
    requestContext?: OfflineCacheContext,
  ): Promise<T> {
    const abortHandler = (): void => {
      cleanupFetch(key);
    };

    signal.addEventListener('abort', abortHandler);

    // NOTE: Если fetcher не поддерживает AbortSignal, фоновый fetch может продолжаться
    // даже после abort. Это задокументированное поведение для совместимости.

    // Проверяем abort перед началом выполнения
    if (signal.aborted) {
      cleanupFetch(key);
      throw new Error('Operation was aborted');
    }

    return retryStrategy(
      () => fetcher(signal),
      {
        attempts: retryAttempts,
        delay: retryDelay,
        backoff: retryBackoff,
        signal,
        timer,
        random,
        ...(onRetry
          ? {
            onRetry: (attempt: number, error: unknown): void => {
              onRetry(attempt, error);
            },
          }
          : {}),
      },
    )
      .then(async (value: T) => {
        await storeWithNamespace.set(buildEntry(key, value))();
        safeListener(onUpdate, key, key, value); // key дублируется: первый для onError, второй для onUpdate
        safeEmit(
          'update',
          key,
          key,
          value,
          requestContext?.traceId,
          requestContext?.service,
        );
        return value;
      })
      .catch((err: unknown) => {
        // Ошибка fetch / retry
        safeOnError(err, key);
        safeEmit('error', undefined, err, key, requestContext?.traceId, requestContext?.service); // undefined = не логируем ошибки эмиттера
        throw err;
      })
      .finally(() => {
        signal.removeEventListener('abort', abortHandler);
        cleanupFetch(key);
      });
  }

  /** Создает новую запись кэша с метаданными */
  function buildEntry<T>(key: CacheKey, value: T): CacheEntry<T> {
    const createdAt = now();
    return Object.freeze({
      key,
      value,
      createdAt,
      expiresAt: ttl !== undefined ? createdAt + ttl : undefined, // TTL в миллисекундах от момента создания
      staleAt: staleTtl !== undefined ? createdAt + staleTtl : undefined, // Stale TTL в миллисекундах от момента создания
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
    const ctx = resultContext ?? context; // Fallback на глобальный контекст из options
    return freezeWithMode(
      ctx
        ? { key, value, source, timestamp, error, context: ctx }
        : { key, value, source, timestamp, error },
      freezeMode,
    );
  }

  /** Обрабатывает случай с stale данными (SWR ветка) */
  function handleStaleData<T>(
    entry: CacheEntry<T>,
    key: CacheKey,
    fetcher: Effect<T>,
    signal: AbortSignal,
    requestContext?: OfflineCacheContext,
  ): OfflineCacheResult<T> {
    // Фоновое обновление без блокировки - только если нет in‑flight fetch и сигнал не aborted
    if (!inFlightFetches.has(key) && !signal.aborted) {
      const fetchPromise = createFetchPromise(key, fetcher, signal, requestContext);

      if (staleWhileRevalidateDelay > 0) {
        // Запускаем fetch с задержкой
        const timeoutId = timer.setTimeout(() => {
          // Fetch promise уже создан, но выполнение отложено; убираем timeoutId из записи
          if (inFlightFetches.has(key)) {
            inFlightFetches.set(key, { promise: fetchPromise });
          }
        }, staleWhileRevalidateDelay);

        inFlightFetches.set(key, { promise: fetchPromise, timeoutId });
      } else {
        // Запускаем немедленно
        inFlightFetches.set(key, { promise: fetchPromise });
      }

      // Гарантируем очистку после завершения
      fetchPromise.finally(() => {
        cleanupFetch(key);
      }).catch((err: unknown) => {
        // Логируем ошибки очистки, но не допускаем их распространения
        safeOnError(err, key);
      });
    }

    const result = createCacheResult(
      entry.key,
      entry.value,
      'STALE',
      now(),
      undefined,
      requestContext ?? context,
    );
    debouncedOnEvaluate(result);
    return result;
  }

  /** Обрабатывает возврат существующего in‑flight fetch */
  async function handleExistingFetch<T>(
    key: CacheKey,
    timestamp: number,
    requestContext?: OfflineCacheContext,
  ): Promise<OfflineCacheResult<T>> {
    const entry = inFlightFetches.get(key) as { promise: Promise<unknown>; }; // Гарантированно существует (проверено выше)
    const value = await entry.promise as T; // Тип известен из контекста вызова
    const result = createCacheResult(key, value, 'REMOTE', timestamp, undefined, requestContext);
    safeListener(onEvaluate, key, result);
    return result;
  }

  /** Обрабатывает удаленную загрузку */
  async function handleRemoteFetch<T>(
    key: CacheKey,
    fetcher: Effect<T>,
    signal: AbortSignal,
    timestamp: number,
    requestContext?: OfflineCacheContext,
  ): Promise<OfflineCacheResult<T>> {
    try {
      const fetchPromise = createFetchPromise(key, fetcher, signal, requestContext);

      inFlightFetches.set(key, { promise: fetchPromise });
      const value = await fetchPromise;
      const result = createCacheResult(key, value, 'REMOTE', timestamp, undefined, requestContext);
      safeListener(onEvaluate, key, result);
      return result;
    } catch (err: unknown) {
      return handleErrorFallback(key, timestamp, err, requestContext);
    }
  }

  /** Обрабатывает fallback при ошибке */
  async function handleErrorFallback<T>(
    key: CacheKey,
    timestamp: number,
    err: unknown,
    requestContext?: OfflineCacheContext,
  ): Promise<OfflineCacheResult<T>> {
    // Попытаться получить кэшированное значение даже при ошибке
    try {
      const entry = await storeWithNamespace.get<T>(key)();
      if (entry && !isExpired(entry)) {
        const result = createCacheResult(
          key,
          entry.value,
          'STALE',
          timestamp,
          undefined,
          requestContext,
        );
        safeListener(onEvaluate, key, result);
        return result;
      }
    } catch (storeError) {
      // Логируем ошибки получения кэша, но не прерываем fallback‑цепочку
      safeOnError(storeError, key);
    }

    // Fallback: возвращаем результат с undefined и ошибкой для диагностики
    const result = createCacheResult(key, undefined as T, 'ERROR', timestamp, err, requestContext); // undefined as T для type safety при отсутствии данных
    safeListener(onEvaluate, key, result);
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
      const timestamp = now();
      const requestContext = contextOverride ?? context;

      const controller = abortCtrl ?? new AbortController(); // Создаём новый только если не передан извне
      const { signal } = controller;

      let fetchTimeoutId: unknown; // Таймер для автоматического abort при превышении maxFetchDurationMs
      if (maxFetchDurationMs !== undefined && abortCtrl === undefined) { // Авто-abort только если контроллер создан нами
        fetchTimeoutId = timer.setTimeout(() => {
          controller.abort();
        }, maxFetchDurationMs);
      }

      try {
        const entry = await storeWithNamespace.get<T>(key)();

        if (entry !== undefined && !isExpired(entry) && !isStale(entry)) {
          const result = createCacheResult(
            key,
            entry.value,
            'CACHE',
            timestamp,
            undefined,
            requestContext,
          );
          safeListener(onEvaluate, key, result);
          return result;
        }

        if (inFlightFetches.has(key)) {
          return await handleExistingFetch(key, timestamp, requestContext);
        }

        if (entry !== undefined && !isExpired(entry) && allowStale) {
          return handleStaleData(entry, key, fetcher, signal, requestContext);
        }

        // Cache miss - загружаем удаленно
        // Удаленная загрузка + кэширование
        return await handleRemoteFetch(
          key,
          fetcher,
          signal,
          timestamp,
          requestContext,
        );
      } catch (err: unknown) {
        safeOnError(err, key);
        safeEmit('error', undefined, err, key, requestContext?.traceId, requestContext?.service); // undefined = не логируем ошибки эмиттера

        return await handleErrorFallback(key, timestamp, err, requestContext);
      } finally {
        if (fetchTimeoutId !== undefined) {
          timer.clearTimeout(fetchTimeoutId);
        }
      }
    };
  }

  const get = <T>(key: CacheKey): Effect<T | undefined> =>
    mapEffectResult(storeWithNamespace.get<T>(key), (entry) => entry?.value);

  const set = <T>(key: CacheKey, value: T, contextOverride?: OfflineCacheContext): Effect<void> =>
    pipeEffects(
      storeWithNamespace.set(buildEntry(key, value)),
      (): Effect<void> => (): Promise<void> => {
        const ctx = contextOverride ?? context;
        safeEmit('update', key, key, value, ctx?.traceId, ctx?.service);
        safeListener(onUpdate, key, key, value); // key дублируется: первый для onError, второй для onUpdate
        return Promise.resolve();
      },
    );

  const remove = (key: CacheKey, contextOverride?: OfflineCacheContext): Effect<void> =>
    pipeEffects(
      storeWithNamespace.delete(key),
      (): Effect<void> => (): Promise<void> => {
        const ctx = contextOverride ?? context;
        safeEmit('delete', key, key, ctx?.traceId, ctx?.service);
        return Promise.resolve();
      },
    );

  const clear = (contextOverride?: OfflineCacheContext): Effect<void> =>
    pipeEffects(
      storeWithNamespace.clear(),
      (): Effect<void> => (): Promise<void> => {
        const ctx = contextOverride ?? context;
        safeEmit('clear', undefined, ctx?.traceId, ctx?.service);
        return Promise.resolve();
      },
    );

  const cleanupExpired = (): Effect<void> => async () => {
    const snapshot = storeWithNamespace.snapshot;
    if (!snapshot) {
      return;
    }
    const entries = await snapshot()();
    const expiredKeys = entries
      .filter((entry) => isExpired(entry))
      .map((entry) => entry.key);
    await Promise.all(
      expiredKeys.map((expiredKey) => storeWithNamespace.delete(expiredKey)()),
    );
  };

  const cancel = (key: CacheKey): boolean => {
    if (inFlightFetches.has(key)) {
      cleanupFetch(key);
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

  return freeze({ getOrFetch, get, set, remove, clear, cancel, on, events, cleanupExpired });
}
/* eslint-enable functional/immutable-data, functional/no-let, fp/no-mutation, fp/no-throw */

/* ============================================================================
 * 🏬 STORE IMPLEMENTATIONS — IN-MEMORY STORE
 * ========================================================================== */

/**
 * Простейшая in-memory реализация OfflineCacheStore.
 * Используется для тестов и простых сценариев.
 * Не реализует TTL/LRU eviction и не предназначена для высоконагруженного production.
 */
export function createInMemoryOfflineCacheStore(): OfflineCacheStore {
  /* eslint-disable functional/immutable-data */
  const cache = new Map<string, CacheEntry<unknown>>();

  const get: OfflineCacheStore['get'] =
    <T>(key: CacheKey): Effect<CacheEntry<T> | undefined> => () => {
      const existing = cache.get(key) as CacheEntry<T> | undefined;
      if (existing === undefined) {
        return Promise.resolve(undefined);
      }

      // LRU: переносим ключ в конец, чтобы отметить его как недавно использованный.
      cache.delete(key);
      cache.set(key, existing);

      return Promise.resolve(existing);
    };

  const set: OfflineCacheStore['set'] = <T>(entry: CacheEntry<T>): Effect<void> => () => {
    const key = entry.key;
    const frozen = freeze(entry);

    // Если ключ уже существует, удаляем его, чтобы обновить порядок LRU.
    if (cache.has(key)) {
      cache.delete(key);
    }

    cache.set(key, frozen);

    // LRU eviction: если размер кэша превысил лимит, удаляем самый старый (наименее недавно использованный) ключ.
    if (cache.size > DEFAULT_MAX_IN_MEMORY_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    return Promise.resolve();
  };

  const deleteFn: OfflineCacheStore['delete'] = (key: CacheKey): Effect<void> => () => {
    cache.delete(key);
    return Promise.resolve();
  };

  const clear: OfflineCacheStore['clear'] = (): Effect<void> => () => {
    cache.clear();
    return Promise.resolve();
  };

  const snapshot: OfflineCacheStore['snapshot'] =
    (): Effect<readonly CacheEntry<unknown>[]> => () =>
      // O(n) относительно текущего размера кэша
      Promise.resolve(Object.freeze([...cache.values()]));

  return {
    get,
    set,
    delete: deleteFn,
    clear,
    snapshot,
  };
  /* eslint-enable functional/immutable-data */
}

/* ============================================================================
 * ♻️ RETRY SYSTEM
 * ========================================================================== */

/* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation, fp/no-throw */
// Retry loop требует мутабельного счетчика, явного цикла и throw для управления потоком
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    delay: number;
    backoff: number;
    timer: EffectTimer;
    random: () => number;
    signal?: AbortSignal;
    onRetry?: (attempt: number, error: unknown) => void;
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
      options.onRetry?.(attempt, error);

      if (attempt === options.attempts) {
        break; // Последняя попытка, выбрасываем ошибку
      }

      const baseDelay = options.delay * Math.pow(options.backoff, attempt - 1);
      // Добавляем jitter (случайное смещение до 25% от базовой задержки)
      const jitter = baseDelay * RETRY_JITTER_FACTOR * options.random();
      const delay = baseDelay + jitter;
      await new Promise<void>((resolve) => {
        options.timer.setTimeout(resolve, delay);
      });
    }
  }

  // Если все попытки исчерпаны — пробрасываем последнюю ошибку
  throw lastError;
}
/* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation, fp/no-throw */

/* ============================================================================
 * 🔒 UTILITIES
 * ========================================================================== */

/* eslint-disable functional/no-loop-statements */
// Deep freeze требует итерации для рекурсивной обработки вложенных объектов
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
/* eslint-enable functional/no-loop-statements */

function freezeWithMode<T>(obj: T, mode: OfflineCacheFreezeMode): T {
  if (mode === 'none') {
    return obj;
  }
  if (mode === 'shallow') {
    if (Object.isFrozen(obj)) return obj;
    // Только верхний уровень; вложенные объекты не трогаем
    return Object.freeze(obj as unknown as Record<string, unknown>) as T;
  }
  // deep
  return freeze(obj);
}

/** Effect композиция: трансформация результата (аналог map для нашей простой Effect системы) */
function mapEffectResult<A, B>(effect: Effect<A>, transform: (value: A) => B): Effect<B> {
  return () => effect().then(transform);
}

/* ============================================================================
 * 📡 EVENT SYSTEM — EMITTER (IMPLEMENTATION DETAIL)
 * ========================================================================== */

export interface OfflineCacheEvents {
  update: (key: CacheKey, value: unknown, traceId?: string, service?: string) => void;
  error: (err: unknown, key: CacheKey, traceId?: string, service?: string) => void;
  delete: (key: CacheKey, traceId?: string, service?: string) => void;
  clear: (traceId?: string, service?: string) => void;
}

/* eslint-disable functional/no-classes, functional/no-this-expressions, functional/immutable-data, functional/no-loop-statements */
// Event emitter — stateful abstraction; класс и циклы здесь осознанный инфраструктурный выбор
class TypedOfflineCacheEmitter {
  private readonly listeners = new Map<
    keyof OfflineCacheEvents,
    Set<OfflineCacheEvents[keyof OfflineCacheEvents]>
  >();

  on<K extends keyof OfflineCacheEvents>(event: K, listener: OfflineCacheEvents[K]): this {
    const existing = this.listeners.get(event) ?? new Set();
    existing.add(listener);
    this.listeners.set(event, existing);
    return this;
  }

  off<K extends keyof OfflineCacheEvents>(event: K, listener: OfflineCacheEvents[K]): this {
    const existing = this.listeners.get(event);
    if (existing) {
      existing.delete(listener);
      if (existing.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  once<K extends keyof OfflineCacheEvents>(event: K, listener: OfflineCacheEvents[K]): this {
    const wrapped: OfflineCacheEvents[K] = ((...args: Parameters<OfflineCacheEvents[K]>) => {
      this.off(event, wrapped);

      (listener as (...args: Parameters<OfflineCacheEvents[K]>) => void)(...args);
    }) as OfflineCacheEvents[K];
    return this.on(event, wrapped);
  }

  emit<K extends keyof OfflineCacheEvents>(
    event: K,
    ...args: Parameters<OfflineCacheEvents[K]>
  ): boolean {
    const existing = this.listeners.get(event);
    if (!existing || existing.size === 0) {
      return false;
    }
    for (const listener of [...existing]) { // Копируем массив, чтобы избежать проблем при изменении listeners во время итерации
      (listener as (...args: Parameters<OfflineCacheEvents[K]>) => void)(...args);
    }
    return true;
  }
}
/* eslint-enable functional/no-classes, functional/no-this-expressions, functional/immutable-data, functional/no-loop-statements */

type OfflineCacheEmitter = TypedOfflineCacheEmitter;
