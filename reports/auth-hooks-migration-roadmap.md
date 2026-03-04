# Auth Hooks Migration Roadmap (app ↔ feature-auth)

## Цели

- **Один источник правды для auth-состояния**: `@livai/feature-auth` (store + effects).
- **Один канонический React-хук**: `@livai/app/hooks/useAuth` (тонкий DI-фасад).
- **UI-agnostic feature-пакеты**: в `feature-*` нет React-хуков.
- **Отсутствие дублирования**: legacy `auth-service.ts` и `app`-auth-slice удалены.

## Чекпоинты (по порядку)

### 1️⃣ Базовая фиксация состояния ✅

1. ✅ Убедиться, что:
   - `pnpm run lint:canary` ✅
   - `pnpm test` (или профильные тесты для app + feature-auth) ✅
   - `pnpm run build` ✅
   - `pnpm run type-check` ✅
   - `pnpm run tsc:check` ✅
   - `pnpm run check:deprecated` ✅
   - `pnpm run check:circular-deps` ✅
   - `npx dprint fmt` ✅
   проходят без ошибок.
2. ✅ Зафиксировать коммит как точку отката.

### 2️⃣ Канонический `useAuth` в app-слое

1. Взять реализацию хука из бэкапа `reports/backups-auth-hook/useAuth.ts`.
2. Перенести её в `packages/app/src/hooks/useAuth.ts`, адаптировав импорты:
   - `AuthState`, `LoginRequest`, `RegisterRequest`, результаты эффектов — из `@livai/feature-auth`.
   - Типы `UseAuthStorePort`, `UseAuthDeps`, `UseAuthResult` оставить как в бэкапе (state + эффекты).
3. Публичный API хука:
   - `authState`
   - `login(request)`
   - `logout()`
   - `register(request)`
   - `refresh()`
4. Не добавлять derived-флаги в результат (они будут отдельными селекторами/app-адаптером).
5. Проверить, что:
   - `UseAuthStorePort` отражает именно доменное `AuthState` из feature-auth (а не старый app-auth-slice).
   - Все derived-флаги (например, `isAuthenticated`) используются только через селекторы/адаптеры, а не добавлены в возвращаемый объект `useAuth`.

### 3️⃣ Удаление хуков из `feature-auth`

1. Убедиться, что в `packages/feature-auth/src` нет рабочих импортов `./hooks/...`.
2. Удалить:
   - `packages/feature-auth/src/hooks/**`
   - любые экспорты хуков в `packages/feature-auth/src/index.ts` и под-индексах.
3. Прогнать `pnpm run lint:canary` и unit-тесты `feature-auth`:
   - Проверить отсутствие ссылок на `@livai/feature-auth/hooks/useAuth`.

### 4️⃣ DI-фабрика для хука (`auth-hook-deps.ts`)

1. Создать `packages/app/src/lib/auth-hook-deps.ts`.
2. Импортировать из `@livai/feature-auth`:
   - `createAuthStore`, `AuthStore`, `AuthStoreState` (через barrel `stores/index.js`).
   - `createLoginEffect`, `createLogoutEffect`, `createRegisterEffect`, `createRefreshEffect` и их типы.
3. Реализовать фабрику:
   - Создать один `authStore` через `createAuthStore()`.
   - Создать эффекты через `create*Effect(deps, config)` (deps/config — минимальные для запуска; позднее можно вынести в конфиги).
   - Обернуть Effect → Promise:
     - `Runtime.runPromise(Runtime.defaultRuntime, effect(...))`.
   - Собрать `UseAuthStorePort`:
     - `getAuthState: () => authStore.getState().auth` (чтение доменного `AuthState`).
     - `subscribe: (listener) => authStore.subscribe(listener)` (по `auth`-срезу, без утечки остальных полей).
   - Вернуть объект `UseAuthDeps` для хука `useAuth`.
4. Экспортировать:
   - `createAuthHookDeps(): UseAuthDeps`.
5. Дополнительно проверить:
   - Эффекты `create*Effect` получают все необходимые deps/конфиги (API-клиент, session manager, error mapper и т.п.).
   - Обёртка через `Runtime.runPromise` не теряет семантику ошибок (ошибки корректно пробрасываются/мапятся в UI).

### 5️⃣ `AuthHookProvider` (Context-обёртка)

1. Создать `packages/app/src/hooks/useAuth-provider.tsx`.
2. Реализовать:
   - React Context с типом `UseAuthDeps`.
   - Провайдер:
     - внутри `useMemo([])` один раз вызвать `createAuthHookDeps()`;
     - передать deps в контекст.
   - Обёртку `useAuth()` без параметров:
     - брать deps из контекста;
     - вызывать DI-версию `useAuth(deps)`.
3. Экспортировать:
   - `AuthHookProvider`
   - `useAuth` (без аргументов; именно его будет использовать остальной app/UI).
4. Проверить:
   - Что `useMemo([])` действительно создаёт один экземпляр store/эффектов на всё дерево (нет пересозданий из-за зависимостей).
   - Что контекст строго типизирован `UseAuthDeps` и не допускает частично заполненных deps.

### 6️⃣ Подключение провайдера в `AppProviders`

1. В `packages/app/src/providers/AppProviders.tsx`:
   - Импортировать `AuthHookProvider` из `../hooks/useAuth-provider.js`.
   - Обернуть дерево под `UnifiedUIProvider`:
     - `UnifiedUIProvider → AuthHookProvider → AuthGuardBridge`.
2. Убедиться, что:
   - `AuthGuardBridge` по-прежнему использует `useAuth()` (уже из контекста).
   - Порядок провайдеров остаётся: FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → **AuthHookProvider** → AuthGuard.

### 7️⃣ Обновление импортов UI

1. Везде, где UI (включая `ui-features` и `apps/web`) использует `useAuth`:
   - заменить импорты на `@livai/app/hooks/useAuth`.
2. Убедиться, что нет прямых импортов:
   - `@livai/feature-auth/hooks/useAuth`.
3. Дополнительно:
   - Проверить, что ни один UI-файл не тянет напрямую `feature-auth` store/эффекты, минуя app-слой.

### 8️⃣ Миграция background refresh

1. В `packages/app/src/background/tasks.ts`:
   - найти использование `di.authService.refreshToken` / `authService.refresh`.
2. Заменить:
   - на использование `refresh` из DI-эффектов `feature-auth` (через тот же DI-слой, который использует хук).
   - Источник токена/решения о refresh — `feature-auth` store (через AuthStorePort/эффекты), а не старый app-store.
3. Проверить:
   - Что silent refresh / background-задачи и `useAuth` используют один и тот же store и одни и те же эффекты (нет второго источника правды для токенов).

### 9️⃣ HTTP-интерсепторы / API клиенты

1. В коде, где заголовки авторизации формируются из app-store:
   - переключить источник токенов на feature-auth store (через адаптер / селекторы).
2. Инвариант:
   - Токен для API всегда берётся из одного места (feature-auth store), а не из старого `app.state.store`.
3. Убедиться, что:
   - Нет оставшихся ссылок на legacy `authService` для получения токенов.
   - При необходимости, адаптер поверх feature-auth store предоставляет удобный метод получения access/refresh токена для HTTP-клиента.

### 🔟 Удаление legacy auth-slice из app store

1. В `packages/app/src/state/store.ts`:
   - удалить `auth` из `AppStoreState`, начального состояния и actions (`setAuthTokens`, `clearAuth`, `setAuthLoading` и т.п.), которые больше не используются.
2. Обновить все места, где использовались эти поля/actions, на новый источник (feature-auth / useAuth).
3. После удаления:
   - Прогнать сборку и линтер, убедиться в отсутствии неразрешённых импортов/типов.

### 1️⃣1️⃣ Удаление `auth-service.ts`

1. Убедиться, что:
   - `packages/app/src/hooks/useAuth.ts` больше не импортирует `authService`.
   - `background/tasks.ts` и тесты не используют `authService`.
2. Удалить:
   - `packages/app/src/lib/auth-service.ts`
   - экспорты из `packages/app/src/lib/index.ts` и `packages/app/src/index.ts`.
3. Обновить/удалить unit-тесты `auth-service.test.ts`.
4. После удаления:
   - Убедиться, что `pnpm run lint:canary` и сборка проходят без ошибок.

### 1️⃣2️⃣ Проверка `auth-guard`

1. Убедиться, что `packages/app/src/lib/auth-guard.ts`:
   - не зависит от старого app-store и `auth-service`.
   - использует только `AuthGuardContext` (передаётся через `AuthGuardBridge`).
2. При необходимости обновить `AuthGuardBridge`, чтобы:
   - строить `AuthGuardContext` из нового `useAuth` + feature-auth store (через app-слой).
3. Проверить:
   - Что логика ролей/разрешений в `auth-guard.ts` не изменилась (миграция касается только источника auth-контекста).

### 1️⃣3️⃣ Обновление `phase2-UI.md` и контрактов

1. В `docs/phase2-UI.md`:
   - строка 458: оставить `contracts/feature-auth.contract.ts`, но уточнить deps:\
     `deps: @livai/feature-auth (types/effects/stores), types/ui-contracts, @livai/core-contracts`.
   - строка 463: заменить deps на `@livai/app/hooks/useAuth, types/ui-contracts`.
   - В остальных местах заменить `@livai/feature-auth/hooks/useAuth` → `@livai/app/hooks/useAuth`.
2. В `feature-auth/docs/auth-hook-effects-plan.md` и `auth-next-effects.md`:
   - явно зафиксировать: `useAuth` живёт в `@livai/app`, а feature-эффекты и store — в `@livai/feature-auth`.
3. Обновить примеры использования `useAuth` в доках:
   - Показывать импорт из `@livai/app/hooks/useAuth`.
   - Явно демонстрировать, что derived-флаги строятся через селекторы/adapter поверх `authState`.

### 1️⃣4️⃣ Финальная проверка

1. Прогнать:
   - `pnpm run lint:canary`
   - профильные тесты: `feature-auth`, `app` (особенно `hooks/useAuth.test.ts`, `background/tasks.test.ts`, `auth-guard.test.ts`).
2. Ручная проверка (после интеграции в web):
   - login/logout/refresh
   - multi-tab поведение (silent refresh)
   - background refresh / задачи.
3. Автоматические проверки:
   - Unit-тесты для хука `useAuth` (в app-слое) и всех auth-эффектов (login/logout/register/refresh).
   - Тесты на multi-tab / конкурирующий refresh (гарантия одного запроса при множественных вызовах).
   - Тесты ошибок: истечение токена, Zod-валидация, timeout, сетевые ошибки — корректно пробрасываются/мапятся в UI.
