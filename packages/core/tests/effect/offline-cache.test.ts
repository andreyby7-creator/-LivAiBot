/* eslint-disable functional/no-let, fp/no-mutation */

import { describe, expect, it, vi } from 'vitest';

import type { Effect, EffectTimer } from '../../src/effect/effect-utils.js';
import type {
  CacheEntry,
  CacheKey,
  OfflineCacheContext,
  OfflineCacheOptions,
  OfflineCacheResult,
  OfflineCacheStore,
} from '../../src/effect/offline-cache.js';
import {
  createInMemoryOfflineCacheStore,
  createOfflineCache,
} from '../../src/effect/offline-cache.js';

const makeEffect = <T>(fn: (signal?: AbortSignal) => Promise<T>): Effect<T> => fn;

const createTestTimer = (): EffectTimer & {
  advance: (ms: number) => void;
} => {
  let now = 0;
  const pending = new Set<() => void>();

  const timer: EffectTimer & { advance: (ms: number) => void; } = {
    now: () => now,
    setTimeout: (cb, _ms) => {
      // Для тестов вызываем немедленно, но через очередь — чтобы соблюдать порядок
      const wrapped = () => cb();
      pending.add(wrapped);
      Promise.resolve().then(() => {
        if (pending.has(wrapped)) {
          pending.delete(wrapped);
          wrapped();
        }
        return undefined;
      });
      return wrapped;
    },
    clearTimeout: (id: unknown) => {
      if (typeof id === 'function') {
        pending.delete(id as () => void);
      }
    },
    advance: (ms: number) => {
      now += ms;
    },
  };

  return timer;
};

const createEntry = <T>(
  key: CacheKey,
  value: T,
  createdAt: number,
  opts?: Partial<Pick<CacheEntry<T>, 'expiresAt' | 'staleAt' | 'version'>>,
): CacheEntry<T> =>
  Object.freeze({
    key,
    value,
    createdAt,
    ...opts,
  });

describe('offline-cache.ts — createInMemoryOfflineCacheStore', () => {
  it('поддерживает get/set/delete/clear/snapshot', async () => {
    const store = createInMemoryOfflineCacheStore();
    const entry = createEntry('k1', 'v1', 0);

    await store.set(entry)();
    await expect(store.get<string>('k1')()).resolves.toEqual(entry);

    const snapshot = await store.snapshot!()();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toEqual(entry);

    await store.delete('k1')();
    await expect(store.get<string>('k1')()).resolves.toBeUndefined();

    await store.set(createEntry('k2', 'v2', 0))();
    await store.clear()();
    await expect(store.snapshot!()()).resolves.toEqual([]);
  });
});

describe('offline-cache.ts — createOfflineCache basic flows', () => {
  const makeStore = () => createInMemoryOfflineCacheStore();

  const makeCache = (
    store: OfflineCacheStore,
    options?: OfflineCacheOptions,
  ) => createOfflineCache(store, options);

  it('cache miss → REMOTE, кэшируется и триггерит update/onEvaluate', async () => {
    const store = makeStore();
    const timer = createTestTimer();
    const onUpdate = vi.fn();
    const onEvaluate = vi.fn();

    const cache = makeCache(store, { timer, onUpdate, onEvaluate, namespace: '' });
    const fetcher = vi.fn(
      makeEffect(async () => {
        return 'remote-value';
      }),
    );

    const result = await cache.getOrFetch('key1', fetcher)();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('remote-value');

    const storedValue = await cache.get<string>('key1')();
    expect(storedValue).toBe('remote-value');

    expect(onUpdate).toHaveBeenCalledWith('key1', 'remote-value');
    expect(onEvaluate).toHaveBeenCalled();
  });

  it('fresh cache hit → CACHE, без повторного fetch', async () => {
    const store = makeStore();
    const timer = createTestTimer();

    // Прямо пишем запись в store через публичный API
    const cache = makeCache(store, { timer });
    const fetcher = vi.fn(
      makeEffect(async () => {
        return 'remote';
      }),
    );
    await cache.getOrFetch('key-cache', fetcher)();
    expect(fetcher).toHaveBeenCalledTimes(1);

    const fetcher2 = vi.fn(
      makeEffect(async () => {
        return 'remote-2';
      }),
    );
    const result2 = await cache.getOrFetch('key-cache', fetcher2)();
    expect(result2.source).toBe('CACHE');
    expect(fetcher2).not.toHaveBeenCalled();
  });

  it('cleanupExpired удаляет только устаревшие записи (default eviction)', async () => {
    const store = makeStore();
    const timer = createTestTimer();

    const evictionStrategy = {
      isExpired: (entry: CacheEntry<unknown>): boolean => entry.key === 'expired',
      isStale: (): boolean => false,
    };
    const cache = makeCache(store, { timer, evictionStrategy, namespace: '' });

    await cache.set('live', 'value-live')();
    await cache.set('expired', 'value-expired')();

    await cache.cleanupExpired()();

    await expect(store.get('live')()).resolves.not.toBeUndefined();
    await expect(store.get('expired')()).resolves.toBeUndefined();
  });
});

describe('offline-cache.ts — SWR, stale и error fallback', () => {
  const makeStore = () => createInMemoryOfflineCacheStore();

  it('stale entry + allowStale → возвращает STALE и запускает фоновый fetch', async () => {
    const store = makeStore();
    const timer = createTestTimer();
    const fetcher = vi.fn(
      makeEffect(async () => {
        return 'fresh';
      }),
    );

    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => true,
    };

    const cache = createOfflineCache(store, {
      allowStale: true,
      evictionStrategy,
      timer,
      namespace: '',
    });

    const staleEntry = createEntry('key-stale', 'stale', timer.now(), {});
    await store.set(staleEntry)();

    const result = await cache.getOrFetch('key-stale', fetcher)();
    expect(result.source).toBe('STALE');
    expect(result.value).toBe('stale');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('in-flight fetch re-use: второй getOrFetch ждёт тот же promise', async () => {
    const store = makeStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });

    let resolveFetch: ((v: string) => void) | undefined;
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = vi.fn(
      makeEffect(async () => {
        return fetchPromise;
      }),
    );

    const p1 = cache.getOrFetch('key-inflight', fetcher)();
    const p2 = cache.getOrFetch('key-inflight', fetcher)();

    resolveFetch?.('value-inflight');

    const r1 = await p1;
    const r2 = await p2;
    expect(r1.value).toBe('value-inflight');
    expect(r2.value).toBe('value-inflight');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('handleErrorFallback: при ошибке и наличии неистёкшего кэша возвращает STALE', async () => {
    // Кастомный store: первый get → miss, второй get (из handleErrorFallback) → entry
    let firstGet = true;
    const entry = createEntry('key-error-stale', 'stale-after-error', 0);
    const store: OfflineCacheStore = {
      get: <T>(key: CacheKey): Effect<CacheEntry<T> | undefined> => async () => {
        expect(key).toBe('key-error-stale');
        if (firstGet) {
          firstGet = false;
          return undefined;
        }
        return entry as unknown as CacheEntry<T>;
      },
      set: () => async () => {},
      delete: () => async () => {},
      clear: () => async () => {},
    };
    const timer = createTestTimer();
    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => false,
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      evictionStrategy,
    });

    const failing = makeEffect<string>(async () => {
      throw new Error('network fail');
    });

    const result = await cache.getOrFetch('key-error-stale', failing)();
    expect(result.source).toBe('STALE');
    expect(result.value).toBe('stale-after-error');
  });

  it('handleErrorFallback: при ошибке и отсутствии кэша возвращает ERROR', async () => {
    const store = makeStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });

    const failing = makeEffect<string>(async () => {
      throw new Error('fatal');
    });

    const result = await cache.getOrFetch('key-error-empty', failing)();
    expect(result.source).toBe('ERROR');
    expect(result.value).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('offline-cache.ts — cancel и события', () => {
  it('cancel снимает in-flight fetch для ключа', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });

    let resolveFetch: ((v: string) => void) | undefined;
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = makeEffect(async () => fetchPromise);

    void cache.getOrFetch('key-cancel', fetcher)();
    // Даём внутреннему эффекту шанс записать in-flight fetch
    await Promise.resolve();
    expect(cache.cancel('key-cancel')).toBe(true);
    resolveFetch?.('after-cancel');
  });

  it('events.on получает update/delete/clear', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });

    const updates: OfflineCacheResult<unknown>[] = [];
    const deletes: string[] = [];
    const clears: { traceId: string | undefined; service: string | undefined; }[] = [];

    cache.on('update', (key, value, traceId, service) => {
      updates.push({
        key,
        value,
        source: 'REMOTE',
        timestamp: 0,
        context: { traceId, service } as OfflineCacheContext,
      });
    });
    cache.on('delete', (key, traceId, service) => {
      deletes.push(key);
      void clears.push({ traceId, service });
    });
    cache.on('clear', (traceId, service) => {
      clears.push({ traceId, service });
    });

    const ctx: OfflineCacheContext = { traceId: 't-1', service: 'svc' };
    await cache.set('k', 'v', ctx)();
    await cache.remove('k', ctx)();
    await cache.clear(ctx)();

    expect(updates[0]?.key).toBe('k');
    expect(deletes).toEqual(['k']);
    expect(clears[clears.length - 1]).toEqual({ traceId: 't-1', service: 'svc' });
  });
});

describe('offline-cache.ts — freezeMode и emitter методы', () => {
  it('freezeMode: none и shallow работают как заявлено', async () => {
    const store1 = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();

    const cacheNone = createOfflineCache(store1, {
      timer,
      namespace: '',
      freezeMode: 'none',
      context: { traceId: 't-none', service: 'svc' },
    });
    const rNone = await cacheNone.getOrFetch(
      'k-none',
      makeEffect(async () => 'v-none'),
    )();
    expect(Object.isFrozen(rNone)).toBe(false);

    const store2 = createInMemoryOfflineCacheStore();
    const cacheShallow = createOfflineCache(store2, {
      timer,
      namespace: '',
      freezeMode: 'shallow',
      context: { traceId: 't-shallow', service: 'svc', attributes: { foo: 'bar' } },
    });
    const rShallow = await cacheShallow.getOrFetch(
      'k-shallow',
      makeEffect(async () => 'v-shallow'),
    )();
    expect(Object.isFrozen(rShallow)).toBe(true);
    // При shallow freeze замораживается только верхний уровень результата, не вложенный context
    // (context передаётся как есть из options, не проходит через freezeWithMode отдельно)
    expect(rShallow.context?.traceId).toBe('t-shallow');
    expect(rShallow.context?.service).toBe('svc');
  });

  it('events.once и events.off работают корректно', () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });

    const onceListener = vi.fn();
    cache.events.once('update', onceListener);
    cache.events.emit('update', 'k', 'v');
    cache.events.emit('update', 'k', 'v2');
    expect(onceListener).toHaveBeenCalledTimes(1);

    const clearListener = vi.fn();
    cache.events.on('clear', clearListener);
    cache.events.off('clear', clearListener);
    cache.events.emit('clear');
    expect(clearListener).not.toHaveBeenCalled();
  });
});

describe('offline-cache.ts — дополнительные ветки покрытия', () => {
  it('wrapNamespacedStore: snapshot fallback когда store.snapshot отсутствует', async () => {
    const store: OfflineCacheStore = {
      get: () => async () => undefined,
      set: () => async () => {},
      delete: () => async () => {},
      clear: () => async () => {},
      // snapshot отсутствует
    };
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: 'ns' });
    // cleanupExpired должен корректно обработать отсутствие snapshot
    await cache.cleanupExpired()();
  });

  it('cleanupExpired: возвращается early если snapshot отсутствует', async () => {
    const store: OfflineCacheStore = {
      get: () => async () => undefined,
      set: () => async () => {},
      delete: () => async () => {},
      clear: () => async () => {},
      // snapshot отсутствует
    };
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });
    await cache.cleanupExpired()();
    // Должен завершиться без ошибок
  });

  it('staleWhileRevalidateDelay > 0: запускает fetch с задержкой', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      staleTtl: 100,
      staleWhileRevalidateDelay: 50,
      allowStale: true,
    });

    // Создаём stale entry
    await store.set({
      key: 'key-delay',
      value: 'stale-value',
      createdAt: timer.now() - 200,
      staleAt: timer.now() - 100,
    })();

    let resolveFetch: ((v: string) => void) | undefined;
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = makeEffect(async () => fetchPromise);

    const result = await cache.getOrFetch('key-delay', fetcher)();
    expect(result.source).toBe('STALE');
    expect(result.value).toBe('stale-value');

    // При staleWhileRevalidateDelay > 0 fetch promise создаётся сразу, но timeoutId устанавливается
    // Проверяем, что in-flight есть (promise создан, но выполнение отложено через timeout)
    expect(cache.cancel('key-delay')).toBe(true);
    resolveFetch?.('new-value');
  });

  it('maxFetchDurationMs: автоматически abort при превышении длительности', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      maxFetchDurationMs: 100,
    });

    const fetcher = makeEffect<string>(async () => {
      await timer.advance(150);
      return 'too-late';
    });

    const result = await cache.getOrFetch('key-timeout', fetcher)();
    expect(result.source).toBe('ERROR');
    expect(result.error).toBeInstanceOf(Error);
  });

  it('retryWithBackoff: abort signal прерывает retry', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      retryAttempts: 5,
      retryDelay: 10,
    });

    const controller = new AbortController();
    const fetcher = makeEffect<string>(async () => {
      controller.abort();
      throw new Error('network');
    });

    const result = await cache.getOrFetch('key-abort-retry', fetcher, controller)();
    expect(result.source).toBe('ERROR');
  });

  it('cancel: возвращает false если ключ не в in-flight', () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });
    expect(cache.cancel('non-existent')).toBe(false);
  });

  it('debouncedOnEvaluate: очищает предыдущий timeout при повторном вызове (строка 296)', async () => {
    const store = createInMemoryOfflineCacheStore();
    // Создаём timer с отложенным выполнением для правильной работы debounce
    const now = 0;
    const pendingTimeouts = new Map<unknown, { callback: () => void; delay: number; }>();
    const clearTimeoutSpy = vi.fn((id: unknown) => {
      pendingTimeouts.delete(id);
    });
    const timer: EffectTimer = {
      now: () => now,
      setTimeout: (cb, delay: number) => {
        const id = Symbol('timeout');
        pendingTimeouts.set(id, { callback: cb, delay });
        return id;
      },
      clearTimeout: clearTimeoutSpy,
    };

    const onEvaluate = vi.fn();
    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => true, // Всегда stale
    };
    const cache = createOfflineCache(store, {
      timer,
      onEvaluate,
      allowStale: true,
      evictionStrategy,
      namespace: '',
    });

    // Создаём stale entry
    const staleEntry = createEntry('key-debounce', 'stale-value', now - 200, {
      staleAt: now - 100,
    });
    await store.set(staleEntry)();

    const fetcher = makeEffect(async () => 'fresh');

    // Первый вызов с aborted signal - создаёт timeout для debounced onEvaluate,
    // но НЕ создаёт in-flight fetch (так как signal.aborted = true)
    const controller1 = new AbortController();
    controller1.abort();
    await cache.getOrFetch('key-debounce', fetcher, controller1)();
    await Promise.resolve(); // Даём время для установки timeout
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(pendingTimeouts.size).toBeGreaterThan(0);

    // Второй вызов с новым signal - должен попасть в handleStaleData
    // и очистить предыдущий timeout (строка 296)
    const controller2 = new AbortController();
    await cache.getOrFetch('key-debounce', fetcher, controller2)();
    await Promise.resolve(); // Даём время для обработки

    // Проверяем, что clearTimeout был вызван для очистки предыдущего timeout
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('cleanupFetch: очищает timeoutId при cancel с staleWhileRevalidateDelay (строка 315)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      staleTtl: 100,
      staleWhileRevalidateDelay: 50, // Важно: delay > 0
      allowStale: true,
    });

    // Создаём stale entry
    await store.set({
      key: 'key-cleanup-timeout',
      value: 'stale',
      createdAt: timer.now() - 200,
      staleAt: timer.now() - 100,
    })();

    let resolveFetch: ((v: string) => void) | undefined;
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = makeEffect(async () => fetchPromise);

    // Запускаем getOrFetch - создаст fetch с timeoutId
    void cache.getOrFetch('key-cleanup-timeout', fetcher)();
    await Promise.resolve(); // Даём время для установки timeoutId

    // Cancel должен вызвать cleanupFetch с timeoutId (строка 315)
    expect(cache.cancel('key-cleanup-timeout')).toBe(true);
    resolveFetch?.('value');
  });

  it('onRetry: вызывается при retry попытках (строка 355)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const onRetry = vi.fn();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      retryAttempts: 3,
      retryDelay: 10,
      onRetry, // Важно: предоставить callback
    });

    let attemptCount = 0;
    const fetcher = makeEffect<string>(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('network error');
      }
      return 'success';
    });

    const result = await cache.getOrFetch('key-retry', fetcher)();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('success');
    expect(onRetry).toHaveBeenCalledTimes(2); // Вызывается на 1-й и 2-й попытке
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('handleErrorFallback: обрабатывает ошибку store.get (строка 523)', async () => {
    const storeError = new Error('store failure');
    const store: OfflineCacheStore = {
      get: () => async () => {
        throw storeError; // Бросаем ошибку при get
      },
      set: () => async () => {},
      delete: () => async () => {},
      clear: () => async () => {},
    };
    const timer = createTestTimer();
    const onError = vi.fn();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      onError,
    });

    const failing = makeEffect<string>(async () => {
      throw new Error('fetch error');
    });

    const result = await cache.getOrFetch('key-store-error', failing)();
    expect(result.source).toBe('ERROR');
    expect(result.error).toBeInstanceOf(Error);
    // onError должен быть вызван дважды: для fetch error и для store error (строка 523)
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(1, expect.any(Error), 'key-store-error');
    expect(onError).toHaveBeenNthCalledWith(2, storeError, 'key-store-error');
  });

  it('getOrFetch: обрабатывает ошибку store.get в начале (строки 587-590)', async () => {
    const storeError = new Error('store get failed');
    const store: OfflineCacheStore = {
      get: () => async () => {
        throw storeError; // Бросаем ошибку сразу при get
      },
      set: () => async () => {},
      delete: () => async () => {},
      clear: () => async () => {},
    };
    const timer = createTestTimer();
    const onError = vi.fn();
    const errorListener = vi.fn();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      onError,
    });

    // Подписываемся на события error для проверки safeEmit (строка 588)
    cache.on('error', errorListener);

    const fetcher = makeEffect<string>(async () => 'value');

    const result = await cache.getOrFetch('key-store-get-error', fetcher)();
    expect(result.source).toBe('ERROR');
    expect(result.error).toBe(storeError);
    expect(onError).toHaveBeenCalledWith(storeError, 'key-store-get-error');
    // Проверяем что safeEmit был вызван (строка 588)
    expect(errorListener).toHaveBeenCalledWith(
      storeError,
      'key-store-get-error',
      undefined,
      undefined,
    );
  });

  it('safeListener: обрабатывает ошибки в listener (строка 272)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const onError = vi.fn();
    const throwingOnUpdate = vi.fn(() => {
      throw new Error('listener error');
    });
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      onUpdate: throwingOnUpdate,
      onError,
    });

    // set должен вызвать onUpdate, который бросает ошибку
    // safeListener должен поймать ошибку и вызвать onError (строка 272)
    await cache.set('key-listener-error', 'value')();
    expect(throwingOnUpdate).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'key-listener-error');
  });

  it('safeEmit: обрабатывает ошибки в event listeners (строки 285-286)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const onError = vi.fn();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      onError,
    });

    // Подписываемся на update с listener, который бросает ошибку
    const throwingListener = vi.fn(() => {
      throw new Error('emit listener error');
    });
    cache.on('update', throwingListener);

    // set должен вызвать emit, который вызовет listener, который бросает ошибку
    // safeEmit должен поймать ошибку и вызвать onError (строки 285-286)
    await cache.set('key-emit-error', 'value')();
    expect(throwingListener).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'key-emit-error');
  });

  it('createFetchPromise: обрабатывает уже aborted signal (строка 338)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, { timer, namespace: '' });

    const controller = new AbortController();
    controller.abort(); // Abort до вызова

    const fetcher = makeEffect<string>(async () => 'value');

    const result = await cache.getOrFetch('key-aborted', fetcher, controller)();
    expect(result.source).toBe('ERROR');
    expect(result.error).toBeInstanceOf(Error);
  });

  it('handleStaleData: проверка inFlightFetches.has предотвращает дублирование fetch (строка 426)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => true,
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      allowStale: true,
      evictionStrategy,
    });

    // Создаём stale entry
    const staleEntry = createEntry('key-inflight-stale', 'stale-value', timer.now() - 200, {
      staleAt: timer.now() - 100,
    });
    await store.set(staleEntry)();

    let resolveFetch: ((v: string) => void) | undefined;
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = vi.fn(makeEffect(async () => fetchPromise));

    // Первый вызов создаёт in-flight fetch через handleStaleData
    const p1 = cache.getOrFetch('key-inflight-stale', fetcher)();
    await Promise.resolve(); // Даём время для создания in-flight fetch

    // Второй вызов попадает в handleExistingFetch (проверка inFlightFetches.has в getOrFetch)
    // Это покрывает ветку проверки inFlightFetches.has в handleStaleData (строка 426)
    // через косвенное покрытие - handleStaleData не вызывается, если есть in-flight
    const p2 = cache.getOrFetch('key-inflight-stale', fetcher)();

    resolveFetch?.('fresh');

    const r1 = await p1;
    const r2 = await p2;

    expect(r1.source).toBe('STALE');
    expect(r2.source).toBe('REMOTE'); // Второй вызов ждёт in-flight fetch
    // fetcher должен быть вызван только один раз
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('handleStaleData: не создаёт fetch если signal aborted (строка 426)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => true,
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      allowStale: true,
      evictionStrategy,
    });

    // Создаём stale entry
    const staleEntry = createEntry('key-aborted-stale', 'stale-value', timer.now() - 200, {
      staleAt: timer.now() - 100,
    });
    await store.set(staleEntry)();

    const controller = new AbortController();
    controller.abort();

    const fetcher = vi.fn(makeEffect(async () => 'fresh'));

    // Вызов с aborted signal должен вернуть STALE, но НЕ создать fetch (строка 426)
    const result = await cache.getOrFetch('key-aborted-stale', fetcher, controller)();
    expect(result.source).toBe('STALE');
    expect(result.value).toBe('stale-value');
    // fetcher не должен быть вызван
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('getOrFetch: не создаёт авто-abort если передан abortCtrl (строка 547)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      maxFetchDurationMs: 100, // Устанавливаем timeout
    });

    const controller = new AbortController();
    const fetcher = makeEffect<string>(async () => {
      // Симулируем долгий fetch
      await new Promise<void>((resolve) => {
        timer.setTimeout(() => resolve(), 150);
      });
      return 'value';
    });

    // Передаём abortCtrl извне - авто-abort не должен создаваться (строка 547)
    const result = await cache.getOrFetch('key-external-abort', fetcher, controller)();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('value');
  });

  it('getOrFetch: не возвращает stale если allowStale=false (строка 573)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => true, // Всегда stale
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      allowStale: false, // Важно: отключаем stale
      evictionStrategy,
    });

    // Создаём stale entry
    const staleEntry = createEntry('key-no-stale', 'stale-value', timer.now() - 200, {
      staleAt: timer.now() - 100,
    });
    await store.set(staleEntry)();

    const fetcher = vi.fn(makeEffect(async () => 'fresh'));

    // Должен выполнить fetch вместо возврата stale (строка 573)
    const result = await cache.getOrFetch('key-no-stale', fetcher)();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('isStale: возвращает false если стратегия не определяет isStale (строка 249)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    // Стратегия без isStale метода
    const evictionStrategy = {
      isExpired: () => false,
      // isStale не определён
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      evictionStrategy,
    });

    // Создаём entry без staleAt
    const entry = createEntry('key-no-stale-method', 'value', timer.now());
    await store.set(entry)();

    const fetcher = vi.fn(makeEffect(async () => 'fresh'));

    // Entry должно считаться свежим (не stale), так как isStale не определён (строка 249)
    const result = await cache.getOrFetch('key-no-stale-method', fetcher)();
    expect(result.source).toBe('CACHE');
    expect(result.value).toBe('value');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('handleStaleData: обрабатывает случай когда ключ удалён до timeout callback (строка 433)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const evictionStrategy = {
      isExpired: () => false,
      isStale: () => true,
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      staleTtl: 100,
      staleWhileRevalidateDelay: 50, // Важно: delay > 0
      allowStale: true,
      evictionStrategy,
    });

    // Создаём stale entry
    await store.set({
      key: 'key-timeout-cleanup',
      value: 'stale',
      createdAt: timer.now() - 200,
      staleAt: timer.now() - 100,
    })();

    let resolveFetch: ((v: string) => void) | undefined;
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = makeEffect(async () => fetchPromise);

    // Запускаем getOrFetch - создаст fetch с timeoutId
    void cache.getOrFetch('key-timeout-cleanup', fetcher)();
    await Promise.resolve();

    // Cancel удаляет ключ из inFlightFetches
    cache.cancel('key-timeout-cleanup');

    // Теперь timeout callback должен проверить, что ключ уже удалён (строка 433)
    // Ждём выполнения timeout
    await new Promise<void>((resolve) => {
      timer.setTimeout(() => resolve(), 60);
    });

    // Ключ должен быть удалён, поэтому timeout callback не должен обновить inFlightFetches
    expect(cache.cancel('key-timeout-cleanup')).toBe(false);
    resolveFetch?.('value');
  });

  it('safeEmit: не логирует ошибки эмиттера для error событий (keyForOnError=undefined)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const onError = vi.fn();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      onError,
    });

    // Подписываемся на error с listener, который бросает ошибку
    const throwingListener = vi.fn(() => {
      throw new Error('error listener error');
    });
    cache.on('error', throwingListener);

    const failing = makeEffect<string>(async () => {
      throw new Error('fetch error');
    });

    // getOrFetch должен вызвать safeEmit('error', undefined, ...)
    // Ошибка listener не должна логироваться в onError (keyForOnError=undefined)
    await cache.getOrFetch('key-error-emit', failing)();
    expect(throwingListener).toHaveBeenCalled();
    // onError должен быть вызван только для fetch error, не для emit error
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'key-error-emit');
  });

  it('createCacheResult: создаёт результат без context когда context не задан (строка 410)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    // Не передаём context в options
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
    });

    const fetcher = makeEffect(async () => 'value');

    const result = await cache.getOrFetch('key-no-context', fetcher)();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('value');
    // context должен быть undefined (строка 410 - ветка ctx ? ... : ...)
    expect(result.context).toBeUndefined();
  });

  it('createCacheResult: использует requestContext вместо глобального context', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const globalContext: OfflineCacheContext = { traceId: 'global-trace', service: 'global-svc' };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      context: globalContext,
    });

    const fetcher = makeEffect(async () => 'value');
    const requestContext: OfflineCacheContext = {
      traceId: 'request-trace',
      service: 'request-svc',
    };

    const result = await cache.getOrFetch(
      'key-request-context',
      fetcher,
      undefined,
      requestContext,
    )();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('value');
    // Должен использоваться requestContext, а не глобальный context
    expect(result.context).toEqual(requestContext);
    expect(result.context?.traceId).toBe('request-trace');
  });

  it('effectiveEviction: обрабатывает entry без expiresAt (строка 238)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      // Не устанавливаем ttl, чтобы expiresAt был undefined
    });

    // Создаём entry без expiresAt
    const entry = createEntry('key-no-expires', 'value', timer.now());
    await store.set(entry)();

    const fetcher = vi.fn(makeEffect(async () => 'fresh'));

    // Entry без expiresAt должно считаться не истёкшим (строка 238 - ветка expiresAt !== undefined)
    const result = await cache.getOrFetch('key-no-expires', fetcher)();
    expect(result.source).toBe('CACHE');
    expect(result.value).toBe('value');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('effectiveEviction: обрабатывает entry без staleAt (строка 240)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      // Не устанавливаем staleTtl, чтобы staleAt был undefined
    });

    // Создаём entry без staleAt
    const entry = createEntry('key-no-stale', 'value', timer.now());
    await store.set(entry)();

    const fetcher = vi.fn(makeEffect(async () => 'fresh'));

    // Entry без staleAt должно считаться не stale (строка 240 - ветка staleAt !== undefined)
    const result = await cache.getOrFetch('key-no-stale', fetcher)();
    expect(result.source).toBe('CACHE');
    expect(result.value).toBe('value');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('storeWithNamespace: использует store напрямую когда namespace пустой (строка 229)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    // Пустой namespace - должен использовать store напрямую (строка 229 - ветка namespace.length > 0)
    const cache = createOfflineCache(store, {
      timer,
      namespace: '', // Пустой namespace
    });

    const fetcher = makeEffect(async () => 'value');
    const result = await cache.getOrFetch('key-empty-ns', fetcher)();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('value');

    // Проверяем, что ключ сохранён без namespace префикса
    const stored = await store.get('key-empty-ns')();
    expect(stored).toBeDefined();
    expect(stored?.key).toBe('key-empty-ns');
  });

  it('handleErrorFallback: возвращает ERROR когда entry expired (строка 509)', async () => {
    const store = createInMemoryOfflineCacheStore();
    const timer = createTestTimer();
    const evictionStrategy = {
      isExpired: (entry: CacheEntry<unknown>): boolean => entry.key === 'expired-entry',
      isStale: () => false,
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      evictionStrategy,
    });

    // Создаём expired entry
    await store.set(createEntry('expired-entry', 'expired-value', 0))();

    const failing = makeEffect<string>(async () => {
      throw new Error('fetch error');
    });

    // handleErrorFallback должен проверить entry, но оно expired (строка 509)
    const result = await cache.getOrFetch('expired-entry', failing)();
    expect(result.source).toBe('ERROR');
    expect(result.error).toBeInstanceOf(Error);
  });

  it('getOrFetch: очищает fetchTimeoutId в finally (строка 592)', async () => {
    const store = createInMemoryOfflineCacheStore();
    // Создаём timer, который не выполняет timeout немедленно
    const now = 0;
    const timeouts = new Map<unknown, { callback: () => void; delay: number; }>();
    const clearTimeoutSpy = vi.fn((id: unknown) => {
      timeouts.delete(id);
    });
    const timer: EffectTimer = {
      now: () => now,
      setTimeout: (cb, delay: number) => {
        const id = Symbol('timeout');
        timeouts.set(id, { callback: cb, delay });
        return id;
      },
      clearTimeout: clearTimeoutSpy,
    };
    const cache = createOfflineCache(store, {
      timer,
      namespace: '',
      maxFetchDurationMs: 100,
    });

    const fetcher = makeEffect<string>(async () => {
      // Fetch завершается быстро, до timeout
      return 'value';
    });

    const result = await cache.getOrFetch('key-timeout-cleanup', fetcher)();
    expect(result.source).toBe('REMOTE');
    expect(result.value).toBe('value');
    // fetchTimeoutId должен быть очищен в finally (строка 592)
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

/* eslint-enable functional/no-let, fp/no-mutation */
