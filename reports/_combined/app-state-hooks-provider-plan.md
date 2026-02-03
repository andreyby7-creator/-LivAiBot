# 🧠 App State & Hooks Implementation Plan

## 📋 Обзор

**Цель:** Реализация инфраструктуры управления состоянием приложения LivAi.

**Текущий статус:** 0/12 компонентов реализовано

**Общие принципы:**

- ✅ **Стек выбран идеально:** TS + React Context + Zustand + Effect.ts + React Query
- ⚠️ **Не дублировать состояние:** если в Zustand — не класть в Context
- ⚠️ **TelemetryProvider выше QueryClientProvider** (правильный порядок)
- SSR-first подход с hydration-safe провайдерами
- Полная типизация и интеграция с telemetry
- Мемоизация для производительности
- Infrastructure → Providers → Composition → Hooks (минимизирует циклы)

---

## 🎯 Порядок реализации (зависимости)

```
1. Infrastructure: store.ts, query-client.ts
2. Providers: TelemetryProvider → FeatureFlagsProvider → QueryClientProvider → ToastProvider
3. Composition: AppProviders.tsx, bootstrap.ts
4. Hooks: useApi → useFeatureFlags → useOfflineCache → useToast
```

**Критично:** `query-client.ts` зависит от `telemetry-core` (pure), не от React Context!

---

## 📁 Детальные планы реализации

### 1️⃣ **store.ts** 🟢

**Расположение:** `packages/app/src/state/store.ts`
**Стек:** TS + Zustand
**Зависимости:** types/common.ts

**API:**

```typescript
interface AppState {
  // Глобальное состояние приложения
  user: User | null;
  userStatus: 'anonymous' | 'loading' | 'authenticated';
  theme: 'light' | 'dark';
  isOnline: boolean; // Вычисляется через effect + browser API
}
```

**Шаги реализации:**

1. `pnpm add zustand` (если не установлен)
2. Создать базовый store с middleware (persist, devtools)
3. Добавить типы из `types/common.ts`
4. Экспортировать hook `useAppStore`
5. Добавить selectors для computed значений
6. Реализовать isOnline через navigator.onLine + event listeners

**Важно:**

- НЕ класть async логику в store (только sync state)
- isOnline вычислять через effect + browser API
- user nullable + status для лучшего UX

**Тестирование:** Unit тесты для actions и selectors

---

### 2️⃣ **query-client.ts** 🟢

**Расположение:** `packages/app/src/state/query/query-client.ts`
**Стек:** TS + @tanstack/react-query
**Зависимости:** `lib/telemetry-core.ts`

**API:**

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // v5: cacheTime -> gcTime
      retry: (failureCount, error) => {
        // Не retry на 4xx ошибках
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
    },
    mutations: { retry: 1 },
  },
});

// Global error handler с telemetry-core (SSR-safe)
if (typeof window !== 'undefined') {
  queryClient.getQueryCache().subscribe(({ type, query }) => {
    if (type === 'error') {
      // Telemetry через core, не React Context
      telemetryCore.track('query_error', { queryKey: query.queryKey, error: query.state.error });
    }
  });
}
```

**Шаги реализации:**

1. `pnpm add @tanstack/react-query`
2. Создать конфиг с gcTime (v5) и smart retry
3. Интегрировать telemetry через queryCache.subscribe (не в queryFn)
4. Настроить фильтр retry по HTTP статусам (4xx не retry)
5. Добавить global error tracking

**Тестирование:** Проверка retry логики и error handling по статусам

---

### 3️⃣ **TelemetryProvider.tsx** 🔴

**Расположение:** `packages/app/src/providers/TelemetryProvider.tsx`
**Стек:** TS + React Context
**Зависимости:** `lib/telemetry.ts`

**API:**

```typescript
interface TelemetryContextType {
  track: (event: string, data: Record<string, any>) => void;
  flush: () => void; // Тонкий API, без batch наружу
}

const TelemetryProvider: FC<PropsWithChildren> = ({ children }) => { ... }
export const useTelemetry = () => useContext(TelemetryContext);
```

**Шаги реализации:**

1. Создать Context с типами
2. Реализовать batch буфер в useRef (не в React state)
3. Использовать setInterval для периодической отправки (30 сек)
4. Интегрировать с `lib/telemetry.ts`
5. Добавить useEffect для cleanup interval + flush на unmount
6. Экспортировать тонкий API (track, flush)

**Особенности:**

- Batch в useRef, не в state (не вызывает ререндеры)
- setInterval с cleanup
- Flush при размонтировании
- SSR-safe (no-op на сервере)

---

### 4️⃣ **FeatureFlagsProvider.tsx** 🔴

**Расположение:** `packages/app/src/providers/FeatureFlagsProvider.tsx`
**Стек:** TS + Zustand (single source of truth)
**Зависимости:** `lib/feature-flags.ts`

**API:**

```typescript
interface FeatureFlags {
  [key: string]: boolean;
}

// Zustand store как single source
interface FeatureFlagsStore {
  flags: FeatureFlags;
  overrides: Partial<FeatureFlags>; // Только runtime overrides
  setOverride: (key: string, value: boolean) => void;
  getFlag: (key: string) => boolean;
}

export const useFeatureFlagsStore = create<FeatureFlagsStore>()(
  persist(
    (set, get) => ({
      flags: {},
      overrides: {},
      setOverride: (key, value) =>
        set((state) => ({
          overrides: { ...state.overrides, [key]: value },
        })),
      getFlag: (key) => get().overrides[key] ?? get().flags[key] ?? false,
    }),
    { name: 'feature-flags-overrides' },
  ),
);

// Thin Context wrapper для SSR
const FeatureFlagsProvider: FC<PropsWithChildren<{ initialFlags?: FeatureFlags; }>> = ({
  children,
  initialFlags,
}) => {
  // SSR-safe hydration merge (не перетирает runtime overrides)
  useEffect(() => {
    if (initialFlags) {
      useFeatureFlagsStore.setState(
        (state) => ({
          flags: initialFlags ?? state.flags,
        }),
        false,
        'hydrate/initialFlags',
      );
    }
  }, [initialFlags]);

  return <>{children}</>;
};

export const useFeatureFlags = () => {
  const store = useFeatureFlagsStore();
  return useMemo(() => ({
    isEnabled: store.getFlag,
    setOverride: store.setOverride,
  }), [store]);
};
```

**Шаги реализации:**

1. Создать Zustand store как single source of truth
2. Добавить persist только для runtime overrides
3. Создать thin Context wrapper для SSR initialFlags
4. Интегрировать с `lib/feature-flags.ts` для static flags
5. Экспортировать typed hook

**Особенности:**

- Zustand как single source, Context только для SSR
- Persist только runtime overrides, не static flags
- SSR hydration-safe через initialFlags
- НЕ дублировать состояние между Context и Zustand

---

### 5️⃣ **QueryClientProvider.tsx** 🔴

**Расположение:** `packages/app/src/providers/QueryClientProvider.tsx`
**Стек:** TS + React + @tanstack/react-query
**Зависимости:** `state/query/query-client.ts`, `providers/TelemetryProvider.tsx`

**API:**

```typescript
const QueryClientProvider: FC<PropsWithChildren> = ({ children }) => (
  <TanStackQueryClientProvider client={queryClient}>
    {children}
  </TanStackQueryClientProvider>
);
```

**Шаги реализации:**

1. Импортировать queryClient
2. Создать wrapper компонент
3. Добавить ReactQueryDevtools в development
4. Интегрировать error logging с telemetry
5. Настроить Suspense boundaries если нужно

**Особенности:**

- Должен быть ниже FeatureFlagsProvider
- ErrorBoundary СНАРУЖИ провайдера (в AppProviders)
- Devtools только в development
- Suspense только если используется

---

### 6️⃣ **ToastProvider.tsx** 🔴

**Расположение:** `packages/app/src/providers/ToastProvider.tsx`
**Стек:** TS + React Context + useReducer
**Зависимости:** `ui-core/Toast.tsx`, `providers/TelemetryProvider.tsx`

**API:**

```typescript
interface Toast {
  id: string; // Генерируется внутри provider
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string; // Возвращает ID
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastProvider: FC<PropsWithChildren> = ({ children }) => { ... }
export const useToast = () => useContext(ToastContext);
```

**Шаги реализации:**

1. Создать useReducer для queue management
2. Реализовать actions: add (с auto-generated ID), remove, clear
3. Добавить auto-remove по таймеру
4. Интегрировать с telemetry для tracking
5. Создать ToastContainer компонент
6. Генерировать ID внутри provider (uuid или crypto.randomUUID)

**Особенности:**

- ID генерируется внутри provider, не в hook
- Queue с max length (5-10 тостов)
- Auto-dismiss через useTimeout
- ESC keyboard shortcuts только с focus management
- Position variants (top-left, bottom-right, etc.)

---

### 7️⃣ **AppProviders.tsx** 🔴

**Расположение:** `packages/app/src/providers/AppProviders.tsx`
**Стек:** TS + React
**Зависимости:** Все providers (Telemetry, FeatureFlags, QueryClient, Toast)

**Порядок провайдеров:**

```tsx
<ErrorBoundary>
  <IntlProvider>
    {/* i18n первый */}
    <FeatureFlagsProvider>
      {/* Флаги влияют на все */}
      <TelemetryProvider>
        {/* Мониторинг */}
        <QueryClientProvider>
          {/* Data fetching */}
          <ToastProvider>{/* UI notifications */} {children}</ToastProvider>
        </QueryClientProvider>
      </TelemetryProvider>
    </FeatureFlagsProvider>
  </IntlProvider>
</ErrorBoundary>;
```

**Шаги реализации:**

1. Импортировать все providers
2. Создать композицию в правильном порядке
3. Добавить ErrorBoundary wrapper
4. Экспортировать как default
5. Добавить displayName для devtools

---

### 8️⃣ **bootstrap.ts** 🔴

**Расположение:** `packages/app/src/bootstrap.ts`
**Стек:** TS
**Зависимости:** `providers/AppProviders.tsx`

**API:**

```typescript
export function bootstrap(element: HTMLElement, initialState?: any) {
  // Service worker registration
  // Environment checks
  // Critical resource prefetching

  const root = ReactDOM.createRoot(element);
  root.render(
    <AppProviders initialState={initialState}>
      <App />
    </AppProviders>,
  );
}
```

**Шаги реализации:**

1. Импортировать ReactDOM и AppProviders
2. Создать чистую функцию bootstrap
3. Добавить service worker registration
4. Добавить environment validation
5. Добавить critical resource prefetching

**Особенности:**

- Client-only entry point (не SSR-compatible)
- Service Worker registration внутри `if ('serviceWorker' in navigator)`
- Prefetch только critical resources
- Error handling для всех init шагов

---

### 9️⃣ **useApi.ts** 🔴

**Расположение:** `packages/app/src/hooks/useApi.ts`
**Стек:** TS + React + Effect.ts
**Зависимости:** `lib/api-client.ts`, `lib/api-schema-guard.ts`

**API:**

```typescript
// Typed helpers вместо строковых endpoint
export function useApi() {
  const telemetry = useTelemetry();

  return useMemo(() => ({
    // Typed methods based on API schema
    getUser: (id: string) => apiClient.get(`/users/${id}`).then(schemaGuard.validateUser),
    createBot: (data: CreateBotInput) =>
      apiClient.post('/bots', data).then(schemaGuard.validateBot),
    // ... другие typed methods

    // Generic method для custom запросов
    request: async <T>(endpoint: string, options?: RequestOptions): Promise<T> => {
      try {
        const response = await apiClient.request(endpoint, options);
        const validated = schemaGuard.validate(response);
        return validated as T;
      } catch (error) {
        // Error normalization через error-mapping.ts
        const normalizedError = errorMapping.normalize(error);
        telemetry.track('api_error', { endpoint, error: normalizedError });
        throw normalizedError;
      }
    },
  }), [telemetry]);
}
```

**Шаги реализации:**

1. Импортировать api-client, schema-guard, error-mapping
2. Создать typed helpers вместо generic строковых endpoint
3. Добавить error normalization через error-mapping.ts
4. Интегрировать с telemetry для tracking
5. НЕ добавлять optimistic updates (делать в React Query)

**Важно:**

- Typed helpers вместо строковых endpoint
- Error normalization через error-mapping.ts
- Optimistic updates делать в React Query, не здесь

---

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

---

### 1️⃣2️⃣ **useToast.ts** 🔴

**Расположение:** `packages/app/src/hooks/useToast.ts`
**Стек:** TS + React
**Зависимости:** `providers/ToastProvider.tsx`

**API:**

```typescript
export function useToast() {
  const { addToast, removeToast } = useContext(ToastContext);
  const telemetry = useTelemetry();

  return useMemo(() => ({
    success: (message: string) => addToast({ type: 'success', message }),
    error: (message: string) => {
      telemetry.track('toast_error', { message });
      return addToast({ type: 'error', message });
    },
    warning: (message: string) => {
      telemetry.track('toast_warning', { message });
      return addToast({ type: 'warning', message });
    },
    info: (message: string) => addToast({ type: 'info', message }),
    dismiss: (id: string) => removeToast(id),

    // Promise support без возврата raw Promise
    promise: <T>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string;
        error: string;
      },
    ) => {
      const loadingId = addToast({ type: 'info', message: messages.loading });

      promise
        .then(() => {
          removeToast(loadingId);
          addToast({ type: 'success', message: messages.success });
        })
        .catch((error) => {
          removeToast(loadingId);
          telemetry.track('toast_promise_error', { error: error.message });
          addToast({ type: 'error', message: messages.error });
        });
    },
  }), [addToast, removeToast, telemetry]);
}
```

**Шаги реализации:**

1. Использовать context от ToastProvider
2. Создать fluent API (success, error, etc.)
3. Добавить useMemo для стабильности
4. Telemetry только для error/warning типов
5. Promise support без возврата raw Promise
6. Автоматическая замена loading → success/error

**Важно:**

- Telemetry логирует только error/warning
- Promise support не возвращает raw Promise
- Loading toast заменяется на результат

---

## 🧪 Тестирование

**Для каждого компонента:**

- Unit тесты для hooks и providers
- Integration тесты для провайдер композиции
- E2E тесты для critical flows

**Общие тесты:**

- SSR compatibility всех провайдеров
- Memory leaks prevention
- Performance benchmarks

---

## 🚀 Следующие шаги

1. **lib/telemetry-core.ts** - pure telemetry без React
2. **store.ts** + **query-client.ts** (с зависимостью на telemetry-core)
3. **TelemetryProvider.tsx** (обертка над core)
4. **FeatureFlagsProvider.tsx** + **QueryClientProvider.tsx** + **ToastProvider.tsx**
5. **AppProviders.tsx** + **bootstrap.ts**
6. **Hooks:** `useApi.ts` → `useFeatureFlags.ts` → `useOfflineCache.ts` → `useToast.ts`

**Критично:** Infrastructure слой не зависит от React, только pure functions!

**Пример первого коммита:**

```bash
feat: add app state infrastructure

- Add telemetry core (lib/telemetry-core.ts)
- Add root Zustand store (store.ts)
- Add React Query client config (query-client.ts)
- Add TelemetryProvider with batch support
- Add basic AppProviders composition
```
