### 🔟 **useFeatureFlags.ts** 🔴

**Расположение:** `packages/app/src/hooks/useFeatureFlags.ts`
**Стек:** TS + React
**Зависимости:** `providers/FeatureFlagsProvider.tsx`

**API:**

```typescript
export function useFeatureFlags() {
  // Селекторы для производительности (меньше ререндеров)
  const getFlag = useFeatureFlagsStore((s) => s.getFlag);
  const setOverride = useFeatureFlagsStore((s) => s.setOverride);

  return useMemo(() => ({
    isEnabled: <K extends keyof FeatureFlags>(flag: K): boolean => {
      return getFlag(flag);
    },
    // Toggle только для dev/debug, не для prod UI
    toggle: process.env.NODE_ENV === 'development'
      ? (flag: string, value?: boolean) => setOverride(flag, value ?? !getFlag(flag))
      : undefined,
  }), [getFlag, setOverride]);
}
```

**Шаги реализации:**

1. Использовать Zustand селекторы для производительности
2. Добавить generic типизацию для isEnabled<K>
3. Toggle только в development режиме
4. Добавить useMemo для стабильности
5. SSR-safe через useSyncExternalStore если нужно

**Важно:**

- Селекторы снижают лишние ререндеры при изменении unrelated state
- toggle только для dev/debug, не для prod UI
- Generic типизация для type safety

---

### 1️⃣1️⃣ **useOfflineCache.ts** 🔴

**Расположение:** `packages/app/src/hooks/useOfflineCache.ts`
**Стек:** TS + React + Effect.ts
**Зависимости:** `lib/offline-cache.ts`

**API:**

```typescript
interface CacheEntry<T> {
  data: T;
  version: number;
  timestamp: number;
}

export function useOfflineCache<T>(
  key: string,
  defaultValue: T,
  version: number = 1,
) {
  const [data, setData] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(false); // SSR: сразу false
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let mounted = true;

    offlineCache.get<CacheEntry<T>>(key).then((cached) => {
      if (!mounted) return;

      if (cached && cached.version === version) {
        setData(cached.data);
      }
      setIsLoading(false);
    });

    // BroadcastChannel optional, behind feature flag
    if (
      typeof window !== 'undefined'
      && 'BroadcastChannel' in window
      && useFeatureFlagsStore.getState().getFlag('broadcast-sync')
    ) {
      bcRef.current = new BroadcastChannel(`offline-cache-${key}`);
      bcRef.current.onmessage = (event) => {
        if (event.data.type === 'update' && event.data.version === version) {
          setData(event.data.data);
        }
      };
    }

    return () => {
      mounted = false;
      bcRef.current?.close();
      bcRef.current = null;
    };
  }, [key, version]);

  const update = useCallback(async (newData: T) => {
    const entry: CacheEntry<T> = {
      data: newData,
      version,
      timestamp: Date.now(),
    };

    setData(newData);
    await offlineCache.set(key, entry);

    // Broadcast update через ref
    if (bcRef.current) {
      bcRef.current.postMessage({ type: 'update', data: newData, version });
    }
  }, [key, version]);

  return { data, update, isLoading };
}
```

**Шаги реализации:**

1. Использовать existing `lib/offline-cache.ts`
2. Добавить versioning для invalidation
3. BroadcastChannel optional, за feature flag
4. SSR: isLoading сразу false
5. Типизировать generic T с версией
6. Добавить cleanup и mounted check

**Важно:**

- Version для cache invalidation
- BroadcastChannel только с feature flag
- SSR-safe (isLoading = false)
