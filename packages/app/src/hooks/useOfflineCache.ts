/**
 * @file packages/app/src/hooks/useOfflineCache.ts
 * ============================================================================
 * 🗄️ ХУК ОФФЛАЙН КЭША — ПРОДВИНУТЫЙ
 * ============================================================================
 * Возможности:
 * - Типизированный доступ к offline cache с SWR staleWhileRevalidate
 * - Частичное и глубокое слияние для объектов и массивов
 * - Debounce и throttle с автоочисткой таймеров
 * - SSR гидратация
 * - Кросс-таб синхронизация через BroadcastChannel
 * - Версионирование и инвалидация
 * - Колбэки для телеметрии (onUpdate, onError, onLoading)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Effect } from '@livai/core/effect';
import type {
  OfflineCacheContext,
  OfflineCacheResult,
  OfflineCacheStore,
} from '@livai/core/effect/offline-cache';
import { createOfflineCache } from '@livai/core/effect/offline-cache';

import type { ComponentState } from '../types/ui-contracts.js';

/** Алиас для состояния компонентов в контексте offline cache хуков */
export type OfflineCacheComponentState<T = unknown> = ComponentState<T>;

/* ============================================================================
 * 🧬 ТИПЫ
 * ========================================================================== */

export type CacheKey = string;

// Глубокий частичный тип для обновлений объектов
export type PartialDeep<T> = T extends object ? {
    [P in keyof T]?: PartialDeep<T[P]>;
  }
  : T;

// Маркер для сообщений инвалидации кэша
export type InvalidateMarker = { __invalidate: true; };

export type UseOfflineCacheState<T> = {
  readonly data: T | undefined;
  readonly isLoading: boolean;
  readonly error?: Error | undefined;
  readonly source?: 'CACHE' | 'STALE' | 'REMOTE' | 'ERROR' | undefined;
};

export type UseOfflineCacheOptions<T, V extends number = number> = {
  version?: V;
  context?: OfflineCacheContext;
  enableBroadcast?: boolean;
  /**
   * Передавать ли инвалидацию между вкладками.
   * @default false
   */
  invalidateBroadcast?: boolean;
  initialData?: T;
  ttl?: number;
  staleTtl?: number;
  debounceMs?: number;
  throttleMs?: number;
  /**
   * Сливать ли частичные обновления данных с существующими.
   * @default true
   */
  mergePartial?: boolean;
  onUpdate?: (data: T, source: UseOfflineCacheState<T>['source']) => void;
  onError?: (err: Error) => void;
  onLoading?: (isLoading: boolean) => void;
};

export type UseOfflineCacheReturn<T> = UseOfflineCacheState<T> & {
  refetch: () => void;
  invalidate: () => void;
  cancel: (keyStr?: CacheKey) => void;
  update: (data: PartialDeep<T>) => void;
};

/* ============================================================================
 * 🪝 BROADCAST ХУК
 * ========================================================================== */

/** Кросс-таб синхронизация через BroadcastChannel */
function useOfflineCacheBroadcast<T, V extends number>(
  _key: CacheKey | CacheKey[],
  version: V | undefined,
  enable: boolean,
  onMessage: (keyStr: CacheKey, value: T) => void,
  onInvalidate?: () => void,
): { postMessage: (keyStr: CacheKey, value: T | InvalidateMarker) => void; } {
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enable || typeof window === 'undefined') return undefined;

    try {
      const bc = new BroadcastChannel('offline-cache');

      broadcastRef.current = bc;

      const handler = (ev: MessageEvent): void => {
        const msg = ev.data as { key: CacheKey; value: T | InvalidateMarker; version?: V; };
        if (msg.version !== undefined && version !== undefined && msg.version !== version) return;

        // Обработка сообщений инвалидации
        if (
          msg.value != null
          && typeof msg.value === 'object'
          && !Array.isArray(msg.value)
          && '__invalidate' in msg.value
        ) {
          onInvalidate?.();
          return;
        }

        onMessage(msg.key, msg.value);
      };

      bc.addEventListener('message', handler);
      return (): void => {
        bc.removeEventListener('message', handler);
      };
    } catch {
      // BroadcastChannel не поддерживается, graceful degradation
      return undefined;
    }
  }, [enable, version, onMessage, onInvalidate]);

  const postMessage = useCallback(
    (keyStr: CacheKey, value: T | InvalidateMarker): void => {
      if (enable && broadcastRef.current) {
        broadcastRef.current.postMessage({ key: keyStr, value, version });
      }
    },
    [enable, version],
  );

  return { postMessage };
}

/* ============================================================================
 * 🪝 УТИЛИТА DEEP MERGE
 * ========================================================================== */

/** Безопасное слияние полных данных с частичными обновлениями */
// eslint-disable-next-line sonarjs/cognitive-complexity
function mergePartialData<T>(prev: T | undefined, partial: PartialDeep<T>): T {
  if (prev === undefined) return partial as T;

  if (Array.isArray(prev) && Array.isArray(partial)) {
    return [...prev, ...partial] as unknown as T;
  }

  if (
    typeof prev === 'object' && prev !== null && typeof partial === 'object' && partial !== null
  ) {
    const result = { ...prev } as Record<string, unknown>;
    for (const key in partial) {
      if (Object.prototype.hasOwnProperty.call(partial, key)) {
        const partialValue = (partial as Record<string, unknown>)[key];
        if (partialValue !== undefined) {
          const prevValue = (prev as Record<string, unknown>)[key];

          result[key] = mergePartialData(prevValue, partialValue as PartialDeep<unknown>);
        } else {
          delete result[key];
        }
      }
    }
    return result as T;
  }

  // Для примитивов возвращаем partial значение, если оно определено
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return partial !== undefined ? partial as T : prev;
}

/** Рекурсивное слияние объектов {} и массивов []. Не поддерживает Map, Set, Date, вложенные массивы объектов */
function deepMerge<T>(prev: T | undefined, next: T): T {
  if (prev === undefined) return next;

  if (Array.isArray(prev) && Array.isArray(next)) {
    return [...prev, ...next] as unknown as T;
  }

  if (typeof prev === 'object' && prev !== null && typeof next === 'object' && next !== null) {
    const result = { ...prev } as Record<string, unknown>;
    for (const key in next) {
      if (Object.prototype.hasOwnProperty.call(prev, key)) {
        result[key] = deepMerge(
          (prev as Record<string, unknown>)[key],
          (next as Record<string, unknown>)[key],
        );
      } else {
        result[key] = (next as Record<string, unknown>)[key];
      }
    }
    return result as T;
  }

  return next;
}

/* ============================================================================
 * 🪝 THROTTLE ХУК
 * ========================================================================== */

/** Throttle с автоочисткой таймеров */
function useThrottledCallback(
  callback: () => void,
  throttleMs: number,
): () => void {
  const lastCallRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wrapped = useCallback((): void => {
    const now = Date.now();
    const elapsed = now - lastCallRef.current;

    if (elapsed < throttleMs) {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout((): void => {
        lastCallRef.current = Date.now();
        callback();
      }, throttleMs - elapsed);
    } else {
      lastCallRef.current = now;
      callback();
    }
  }, [callback, throttleMs]);

  useEffect((): () => void => (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return wrapped;
}

/* ============================================================================
 * 🪝 ОСНОВНОЙ ХУК
 * ========================================================================== */

export function useOfflineCache<T, V extends number = number>(
  store: OfflineCacheStore,
  key: CacheKey | CacheKey[],
  fetcher: Effect<T>,
  options?: UseOfflineCacheOptions<T, V>,
): UseOfflineCacheReturn<T> {
  const {
    version,
    context,
    enableBroadcast = false,
    invalidateBroadcast = false,
    initialData,
    ttl,
    staleTtl,
    throttleMs = 1000,
    mergePartial = true,
    onUpdate,
    onError,
    onLoading,
  } = options ?? {};

  const isMountedRef = useRef(true);
  useEffect((): () => void => {
    return (): void => {
      isMountedRef.current = false;
    };
  }, []);

  const [state, setState] = useState<UseOfflineCacheState<T>>({
    data: initialData,
    isLoading: initialData === undefined,
    error: undefined,
    source: initialData !== undefined ? 'CACHE' as const : undefined,
  });

  const offlineCache = useMemo(
    () => {
      const options: Record<string, unknown> = {};
      if (ttl !== undefined) {
        options['ttl'] = ttl;
      }
      if (staleTtl !== undefined) {
        options['staleTtl'] = staleTtl;
      }
      if (version !== undefined) {
        options['version'] = version;
      }
      if (context !== undefined) {
        options['context'] = context;
      }
      return createOfflineCache(store, Object.keys(options).length > 0 ? options : undefined);
    },
    [store, ttl, staleTtl, version, context],
  );

  const ongoingFetches = useRef<Record<CacheKey, AbortController>>({});

  const scheduleFetchRef = useRef<(() => void) | null>(null);

  const { postMessage } = useOfflineCacheBroadcast<T, V>(
    key,
    version,
    enableBroadcast,
    (_keyStr, value) => {
      if (!isMountedRef.current) return;
      setState((prev: UseOfflineCacheState<T>): UseOfflineCacheState<T> => {
        const merged = mergePartial ? deepMerge(prev.data, value) : value;
        onUpdate?.(merged, 'REMOTE');
        return { ...prev, data: merged, source: 'REMOTE' };
      });
    },
    () => scheduleFetchRef.current?.(),
  );

  const fetchOne = useCallback(
    async (keyStr: CacheKey): Promise<void> => {
      if (!isMountedRef.current) return;

      onLoading?.(true);
      setState((prev: UseOfflineCacheState<T>): UseOfflineCacheState<T> => ({
        ...prev,
        isLoading: true,
        error: undefined,
      }));

      const controller = new AbortController();

      ongoingFetches.current = { ...ongoingFetches.current, [keyStr]: controller };

      try {
        const result: OfflineCacheResult<T> = await offlineCache.getOrFetch(
          keyStr,
          fetcher,
          controller,
        )();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isMountedRef.current) return;
        setState((prev: UseOfflineCacheState<T>): UseOfflineCacheState<T> => {
          const merged = mergePartial ? deepMerge(prev.data, result.value) : result.value;
          onUpdate?.(merged, result.source);
          return { data: merged, isLoading: false, error: undefined, source: result.source };
        });

        if (result.source === 'REMOTE') {
          postMessage(keyStr, result.value);
        }
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isMountedRef.current) return;
        const error = err instanceof Error ? err : new Error(String(err));
        // Логирование ошибок разработчика удалено из-за правил линтинга
        setState((prev: UseOfflineCacheState<T>): UseOfflineCacheState<T> => ({
          ...prev,
          error,
          isLoading: false,
          source: 'ERROR',
        }));
        onError?.(error);
      } finally {
        delete ongoingFetches.current[keyStr];
        onLoading?.(false);
      }
    },
    [offlineCache, fetcher, mergePartial, postMessage, onUpdate, onError, onLoading],
  );

  const scheduleFetch = useThrottledCallback(
    (): void => {
      if (Array.isArray(key)) {
        for (const k of key) fetchOne(k).catch(() => {});
      } else {
        fetchOne(key).catch(() => {});
      }
    },
    throttleMs,
  );

  // Устанавливаем ref для инвалидации через broadcast

  scheduleFetchRef.current = scheduleFetch;

  useEffect((): void => {
    scheduleFetch();
  }, [scheduleFetch]);

  const refetch = useCallback((): void => {
    scheduleFetch();
  }, [scheduleFetch]);

  const invalidate = useCallback((): void => {
    if (Array.isArray(key)) {
      key.forEach((k: CacheKey): void => {
        offlineCache.remove(k)().catch(() => {});
        if (invalidateBroadcast) {
          postMessage(k, { __invalidate: true } as InvalidateMarker); // Маркер для инвалидации
        }
      });
    } else {
      offlineCache.remove(key)().catch(() => {});
      if (invalidateBroadcast) {
        postMessage(key, { __invalidate: true } as InvalidateMarker); // Маркер для инвалидации
      }
    }
  }, [key, offlineCache, invalidateBroadcast, postMessage]);

  const cancel = useCallback((keyStr?: CacheKey): void => {
    if (keyStr !== undefined) {
      ongoingFetches.current[keyStr]?.abort();

      delete ongoingFetches.current[keyStr];
    } else {
      Object.values(ongoingFetches.current).forEach((ctrl: AbortController) => {
        ctrl.abort();
      });

      ongoingFetches.current = {};
    }
  }, []);

  const update = useCallback((data: PartialDeep<T>): void => {
    setState((prev: UseOfflineCacheState<T>): UseOfflineCacheState<T> => {
      const merged = mergePartial ? mergePartialData(prev.data, data) : (data as T);
      onUpdate?.(merged, 'CACHE');
      return { ...prev, data: merged };
    });
  }, [mergePartial, onUpdate]);

  return {
    ...state,
    refetch,
    invalidate,
    cancel,
    update,
  } as const;
}
