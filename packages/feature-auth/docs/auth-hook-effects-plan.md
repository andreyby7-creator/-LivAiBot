## 🎯 Цель документа

Завершить реализацию auth-слоя feature-auth:

- React‑hook `hooks/useAuth.ts` как единый фасад для UI.

## 🧩 ФАЗА 1 — React hook `useAuth`

> Реализовать `packages/feature-auth/src/hooks/useAuth.ts` как тонкий фасад над эффектами.

### 1 Файл и экспорт

- `packages/feature-auth/src/hooks/useAuth.ts`

**Экспортируемая функция:**

```ts
export function useAuth(): {
  authState: AuthState;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  login(request: LoginRequest): Promise<LoginResult>;
  logout(): Promise<LogoutResult>;
  register(request: RegisterRequest): Promise<RegisterResult>;
  refresh(): Promise<RefreshResult>;
};
```

**DI через props или context:**

```ts
export type UseAuthDeps = {
  authStore: AuthStorePort; // адаптер к конкретному store (Zustand/Redux)
  loginEffect: (request: LoginRequest) => Promise<LoginResult>;
  logoutEffect: () => Promise<LogoutResult>;
  registerEffect: (request: RegisterRequest) => Promise<RegisterResult>;
  refreshEffect: () => Promise<RefreshResult>;
};

export function useAuth(deps: UseAuthDeps): ReturnType<typeof useAuth>;
```

### 2 Реализация

**Чеклист инвариантов:**

- ✅ Только фасад: вызывает эффекты без обёрток, не содержит бизнес‑логики
- ✅ Derived flags (`isAuthenticated`, `authStatus`) — только вычисление из store
- ✅ Ошибки пробрасываются без перехвата/трансформации
- ✅ Подписка на store через `useSyncExternalStore` или аналог
- ✅ Эффекты передаются через DI (`UseAuthDeps` или feature factory)

**Селекторы:**

- `authState = authStore.getAuthState()` — текущий `AuthState`;
- `authStatus = authState.status` — `'authenticated' | 'unauthenticated' | 'expired' | ...`;
- `isAuthenticated = authStatus === 'authenticated'` — derived флаг.

**Методы:**

- `login(request)` → `deps.loginEffect(request)` (без обёрток);
- `logout()` → `deps.logoutEffect()` (без обёрток);
- `register(request)` → `deps.registerEffect(request)` (без обёрток);
- `refresh()` → `deps.refreshEffect()` (без обёрток).

**Инварианты (hook как адаптер, не координатор):**

- ✅ **Тонкий фасад:**
  - вызывает эффекты и маппит результат в удобное API для UI;
  - ❌ не содержит бизнес‑логики (policy, retry, refresh‑триггеры — в эффектах/session‑manager);
  - ❌ не управляет concurrency (concurrency управляется эффектами);
  - ❌ не дедуплицирует вызовы (idempotency уже реализована в эффектах);
  - ❌ не кэширует промисы (эффекты возвращают актуальные результаты);
  - ❌ не управляет retry / backoff (это ответственность эффектов);
  - ❌ не создаёт refresh‑триггеры (это ответственность session‑manager или внешнего слоя).
- ✅ **Derived flags:**
  - `isAuthenticated = authStatus === 'authenticated'` — только вычисление из store;
  - `authStatus = authState.status` — только чтение из store;
  - ❌ не содержит сложной логики вычисления флагов (только простые derived значения).
- ✅ **Обработка ошибок:**
  - ❌ не перехватывает ошибки (пробрасывает `AuthError` наверх без трансформации);
  - ❌ не трансформирует ошибки (errors пробрасываются как есть из эффектов);
  - ❌ не catch'ит и не глотает исключения (UI должен видеть реальные ошибки);
  - UI должен обрабатывать ошибки через error boundaries или try/catch.
- ✅ **Подписка на store:**
  - подписка через React hooks (`useSyncExternalStore` или аналог);
  - перерендер при изменении `authState` / `authStatus`;
  - селекторы читают состояние через `AuthStorePort` (адаптер к конкретному store).
- ✅ **DI через props или feature factory:**
  - эффекты передаются через `UseAuthDeps` (props) или feature-level provider;
  - hook не создаёт эффекты напрямую (все через DI);
  - composer/feature factory создаёт эффекты и передаёт в hook.
- ✅ **Разделение ответственности:**
  - UI должен зависеть от эффектов и store, а не от скрытой логики хука;
  - hook — только адаптер, не координатор (не создаёт derived side‑effects).

### 3 Разделение ответственности hook vs effect

| Задача                        | Где реализуется               |
| ----------------------------- | ----------------------------- |
| Policy / Session rules        | domain (`session-manager`)    |
| HTTP, timeout, retry          | эффекты (`*-effect.ts`)       |
| Concurrency / isolation guard | эффекты (`*-effect.ts`)       |
| Audit logging                 | эффекты + audit мэпперы       |
| Store updates                 | `*-store-updater.ts`          |
| Derived UI flags              | hook (`isAuthenticated`, etc) |
| DI wiring                     | composer / feature factory    |

---

## 📚 Shared modules / reference

- `effects/shared/auth-store.port.ts` — единый `AuthStorePort` для всех эффектов.
- `effects/shared/session-state.builder.ts` — централизованное построение `SessionState`.
- `effects/shared/auth-api.mappers.ts` — мэпперы transport → domain (`TokenPair`, `MeResponse`).
- `lib/session-manager.ts` — политика refresh/expire/invalidate.
- `lib/error-mapper.ts` — нормализация ошибок в `AuthError`.
- `effects/*/*-audit.mapper.ts` — мэпперы domain‑результатов в audit‑события.
- `effects/*/*-metadata.enricher.ts` — обогащение метаданных (login/register/refresh).

Все новые эффекты и хук должны ссылаться на эти модули вместо дублирования логики.
