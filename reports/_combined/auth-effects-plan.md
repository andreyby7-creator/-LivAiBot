## 🎯 Цель документа

Эталонно реализовать оставшиеся эффекты feature-auth (`effects/logout.ts`, `effects/register.ts`, `effects/refresh.ts`, `lib/session-manager.ts`, `hooks/useAuth.ts`) по тому же уровню архитектуры и инвариантов, что и `effects/login.ts`, с максимальным переиспользованием уже существующих модулей.

---

### 📋 Что фиксирует документ

Документ разбит по шагам реализации и фиксирует:

- 📦 **Какие зависимости** им нужны фактически
- ♻️ **Что уже реализовано** и может быть переиспользовано
- 🆕 **Чего не хватает** и какие новые модули стоит создать
- 🔄 **Какие части** `effects/login/*` имеет смысл вынести в общие слои

---

## 📋 План реализации (порядок обязателен)

> ⚠️ **Критично:** Реализация должна идти строго по этапам. Нарушение порядка приведёт к дублированию кода и архитектурным проблемам.

---

## 🧱 ФАЗА 1 — Стабилизация shared-слоя (обязательный фундамент)

> **Цель:** убрать дублирование из login-flow и подготовить переиспользуемую базу.

**Эта фаза обязательна** — без неё нельзя переходить к реализации эффектов.

---

### 📝 Шаг 1. Вынести общий контракт стора

#### ➤ Создать

```
effects/shared/auth-store.port.ts
```

#### ➤ Контракт

```typescript
interface AuthStorePort {
  setAuthState(state: AuthState): void
  setSessionState(state: SessionState): void
  setSecurityState(state: SecurityState): void
  applyEventType(event: AuthEvent): void
  setStoreLocked(locked: boolean): void  // ОБЯЗАТЕЛЬНО (для logout/refresh)
  batchUpdate(updates: BatchUpdate[]): void  // ОБЯЗАТЕЛЬНО (для атомарности)
}
```

**Атомарность:** все store-updater'ы используют `batchUpdate` для атомарного обновления (избегаем промежуточных состояний)

#### ➤ Инварианты

- ✅ `AuthEvent` — union-тип, не `string` (type-safety)
- ❌ Нет прямых вызовов Zustand в эффектах
- ❌ Нет скрытых методов
- ✅ Единый порт для всех auth-эффектов (login/logout/register/refresh)
- ✅ `batchUpdate` обязателен для атомарности всех обновлений

#### ➤ Обязательное действие

Перевести `login-effect.types.ts` на этот порт.

#### ➤ Использование

- `login-effect.types.ts` переезжает на этот общий порт
- `logout-effect.types.ts`, `refresh-effect.types.ts`, `register-effect.types.ts` используют тот же порт

#### ⚠️ Критично

> **Это база.** Пока нет общего порта — писать остальные эффекты рано.

---

### 📝 Шаг 2. Централизовать построение SessionState

#### ➤ Создать

```
effects/shared/session-state.builder.ts
```

#### ➤ Вынести из

- `login-store-updater.ts`

#### ➤ Инварианты builder'а

- ✅ Проверка `issuedAt <= expiresAt`
- ✅ Copy-on-write
- ✅ Shallow freeze
- ❌ Не читает store
- ✅ Единая точка построения `SessionState` из `(deviceInfo, tokenPair, me.session)`

#### ➤ Подключить обратно

- В `login-store-updater.ts`

#### ➤ Использование

- В `login-store-updater.ts`
- В `refresh-store-updater.ts`
- В `register-store-updater.ts` (если backend возвращает TokenPair + Me)

> **👉 После этого login становится эталоном reuse.**

---

### 📝 Шаг 3. Централизовать API-мэпперы

#### ➤ Создать

```
effects/shared/auth-api.mappers.ts
```

#### ➤ Вынести

- `mapTokenPairValuesToDomain(values: LoginTokenPairValues): TokenPair`
- `mapMeResponseValuesToDomain(values: MeResponseValues): MeResponse`

#### ➤ Подключить в

- `login-api.mapper.ts`
- `refresh-api.mapper.ts`
- `register-api.mapper.ts` (если backend возвращает тот же формат)

#### ➤ Инварианты

- ✅ Pure-функции
- ❌ Refresh не должен иметь собственную копию логики login-мэппинга

---

### 📝 Шаг 4. Вынести safe-record helper

#### ➤ Создать

```
effects/shared/safe-record.ts
```

#### ➤ Перенести

- `isPlainObject(value): boolean`
- `isSafePrimitive(value): boolean`
- `isSafePrimitiveArray(value): boolean`
- `validateSafeRecordPayload(value, label): Record<string, unknown>`
- `freezeShallowRecord(record): Readonly<Record<string, unknown>>`
- `freezeArrayCopy(array): ReadonlyArray<unknown>`
- `validateAndFreezeRecordPayload(value, label): Readonly<Record<string, unknown>>`

#### ⚠️ Важно

- ✅ Только **shallow freeze**
- ❌ Никакого **deep freeze** (дорого и избыточно)

#### ➤ Использование

- В `login-api.mapper.ts`
- В `register-api.mapper.ts`
- В `refresh-api.mapper.ts` (если ответ содержит metadata/context)

---

### ✅ Результат Фазы 1

**Login-flow:**

- ✅ полностью очищен от локальных helper'ов
- ✅ использует shared-слой
- ✅ становится шаблоном для остальных эффектов

#### 🔄 Дополнительные рекомендации по переиспользованию

**Переиспользование metadata enricher'а:**

- `login-metadata.enricher.ts` уже поддерживает `operation: 'login' | 'register' | 'oauth' | 'refresh'`
- ❌ Не переносить его в shared-директорию, оставить в `effects/login`, но использовать как общую зависимость для register/refresh через DI
- ✅ Это сохранит семантику "login-context enricher", но позволит охватывать и родственные операции

**Переиспользование security-pipeline:**

- `lib/security-pipeline.ts` уже задизайнен для операций `'login' | 'oauth_login' | 'register' | 'oauth_register' | 'mfa' | 'session_refresh'`
- `login` уже использует его через projection `LoginSecurityResult`
- `register/refresh` смогут:
  - либо не использовать pipeline (по текущему плану для register)
  - либо использовать другие операции (`'session_refresh'`) через отдельные projection-типы (`RefreshSecurityResult`), определённые в своих `*-effect.types.ts`

---

## 🧠 ФАЗА 2 — Доменная политика

> ⚠️ **До реализации refresh писать эффекты запрещено.**

**Эта фаза изолирует бизнес-логику** от orchestration-слоя.

---

### 📝 Шаг 5. Реализовать lib/session-manager.ts

#### ➤ Domain-pure сервис

#### ➤ Зависимости

- `types/auth.ts` (SessionState, AuthState, SessionPolicy)
- `@livai/core/policies/AuthPolicy`
- `domain/SessionPolicy.ts`
- `domain/TokenPair.ts`

#### ➤ Методы

- `isExpired(session, now): boolean` — истёк ли срок
- `shouldRefresh(session, now): boolean` — когда нужно триггерить refresh
- `getRefreshDeadline(session): number` — **критично:** возвращает timestamp, когда нужно начать refresh (proactive refresh)
- `shouldInvalidate(session, policy): boolean` — нужно ли инвалидировать сессию
- `canOpenNewSession(existing, policy): boolean` — concurrent limits

#### ➤ Инварианты

- ✅ Fail-closed
- ❌ Не знает про effects
- ❌ Не знает про store
- ❌ Не знает про HTTP
- ✅ `now` передаётся извне (injected)
- ❌ Никаких побочных эффектов
- ✅ Никаких допущений о наличии токена
- ✅ Валидация времени строго через injected `now`

#### ⚠️ Критично

**`getRefreshDeadline` — обязательный метод**

- Избавляет от "минус 30 секунд" в эффектах
- Deadline — часть политики, не эффекта

#### ➤ Интеграция с effects

**Граница ответственности:**

**SessionManager (domain):**
- ✅ Вычисляет deadlines (`getRefreshDeadline`)
- ✅ Решает expire/invalidate (`isExpired`, `shouldInvalidate`)
- ✅ Решает, нужно ли refresh (`shouldRefresh`)
- ❌ Не знает про HTTP/ошибки API

**Effect (orchestration):**
- ✅ Делает HTTP-запросы
- ✅ Обрабатывает ошибки API
- ✅ Применяет store-updater
- ✅ Спрашивает SessionManager для принятия решений

> **👉 Важно:** Политика ≠ эффект. Бизнес-правила в домене, orchestration в effect.

---

### ✅ Результат Фазы 2

- ✅ Вся auth-политика изолирована в домене
- ✅ Effects будут только orchestration-слоем

---

## ⚙️ ФАЗА 3 — Реализация эффектов

> Теперь shared-слой стабилен, политика вынесена.

**Реализация строго по порядку:** сначала простые (logout), затем сложные (refresh).

---

### 🔴 3.1 Logout (самый простой)

> **Почему первым:** не зависит от session-manager, минимальная логика, хороший старт для проверки shared-слоя.

#### 📁 Создать

- `effects/logout/logout-effect.types.ts`
- `effects/logout/logout-store-updater.ts`
- `effects/logout.ts`

---

#### 🏗️ Архитектура

##### 1️⃣ Режимы

```typescript
type LogoutMode = 'local' | 'remote'
```

- **`local`** → без ApiClient, без ErrorMapper, без timeout
- **`remote`** → через DI:
  - `ApiClient` (для удалённого revoke)
  - `ErrorMapperPort` (для обработки ошибок revoke)
  - `timeout` (для revoke-запроса)

**Стратегия remote logout:** optimistic reset — reset store всегда, revoke API best-effort (не блокирует logout при timeout/500/network error)

##### ➤ DI-тип (`logout-effect.types.ts`)

- `AuthStorePort` (общий, из `effects/shared/auth-store.port.ts`)
- `ClockPort` — только если нужен timestamp для audit/event
- `LogoutEffectDeps`:
  - `store` + `clock` при необходимости
  - `apiClient` и `errorMapper` только при `mode: 'remote'`
- `LogoutEffectConfig`:
  - `mode: 'local' | 'remote'` (обязательно)
  - `concurrency: 'ignore' | 'cancel_previous' | 'serialize'`
  - `timeout?` (только при `mode: 'remote'`)

**Инвариант:** Logout не должен импортировать конкретные эффекты/мапперы напрямую — только через deps

**Важно:** Эффект не должен быть универсальным — явное разделение на local/remote

**Isolation:** не обязателен для logout (если `concurrency = 'ignore'` — достаточно, isolation guard не нужен)

##### 2️⃣ Store-updater (`logout-store-updater.ts`)

**Единственная точка reset:**

Использует канонические initial states из `types/auth-initial.ts`:
- `INITIAL_AUTH_STATE`
- `INITIAL_SESSION_STATE`
- `INITIAL_SECURITY_STATE`

Сбрасывает через `batchUpdate` (атомарно):
- `AuthState` → `INITIAL_AUTH_STATE`
- `SessionState` → `INITIAL_SESSION_STATE`
- `SecurityState` → `INITIAL_SECURITY_STATE`
- `applyEventType('logout')`

- ❌ Не читает текущее состояние
- ❌ Не использует fallback-значения
- ✅ Атомарное обновление через `batchUpdate`

**Контракт:** вход — `AuthStorePort` (из shared), `reason` (опционально), `meta` (опционально); выход — `void`

**Важно:** Никакой логики reset внутри orchestrator — только в store-updater

##### 3️⃣ Orchestrator (`logout.ts`)

- ✅ Чистый сценарий
- ✅ Idempotency (двойной logout → no-op)
- ✅ Блокировка store только на время reset (lock → reset → unlock), revoke не держит lock (идёт параллельно после unlock)
- ❌ Нет бизнес-логики (только сценарий)
- ❌ Нет прямых `Date.now()` (использовать `ClockPort`, если нужен timestamp для audit/telemetry)
- ✅ Все side-effects только через DI-порты
- ✅ Fail-closed: не вводит fallback-значения, не читает текущее состояние store
- ❌ Не вызывает другие эффекты напрямую (cross-effect вызовы запрещены)

**Remote logout:** reset store (с lock) + revoke API параллельно после unlock (best-effort, не ждём успеха revoke)

Использует `@livai/app/lib/orchestrator` — если потребуется последовательность шагов (например, audit → store-reset)

---

#### ♻️ Что можно переиспользовать

- Паттерн `StorePort` из `login-effect.types.ts`
- Подход к `ClockPort` и `AbortControllerPort`
- Типы `SessionState`, `AuthState`, `SecurityState` из `types/auth.ts`

---

#### 🚫 Инварианты

- ❌ Никаких прямых вызовов store/setState — только через `AuthStorePort`
- ❌ Никаких знаний о Zustand, HTTP, UI
- ✅ Все side-effects только через DI-порты

---

### 🟡 3.2 Register (Login-light)

> **Почему вторым:** максимально переиспользует паттерны login, но без security-pipeline.

#### 📁 Создать

- `effects/register/register-effect.types.ts`
- `effects/register/register-api.mapper.ts`
- `effects/register/register-store-updater.ts`
- `effects/register.ts`

---

#### 🏗️ Архитектурная модель

**Register = Login-light**

**Использует:**

- ✅ strict Zod (`registerRequestSchema.strict()`)
- ✅ `validatedEffect` для `/v1/auth/register`
- ✅ `errorMapper` через DI
- ✅ `metadata-enricher` (reuse из login, с `operation: 'register'`)
- ✅ `session-state builder` (reuse из shared)
- ✅ hard timeout на весь flow
- ❌ Без security-pipeline (если не требуется по политике)

---

#### ➤ DI-тип (`register-effect.types.ts`)

- `AuthStorePort` (общий, из shared)
- `ApiClient`
- `ErrorMapperPort`
- `ClockPort` (если нужен timestamp)
- `RegisterEffectDeps` без `securityPipeline`, без `auditLogger`
- `RegisterEffectConfig`:
  - `hardTimeout` (глобальный timeout на весь flow)
  - `apiTimeout?` (для отдельных API-вызовов, если нужен)
  - `concurrency?: 'ignore' | 'cancel_previous' | 'serialize'` (конфигурируемо, не жёстко):
    - `'serialize'` — если backend не допускает параллельную регистрацию
    - `'ignore'` — если повторное нажатие допустимо
  - Дефолт может быть задан, но не зафиксирован в типах

**Cancellation:** при `cancel_previous` effect создаёт `AbortController`, отменяет предыдущий запрос, очищает isolation state при завершении

---

#### ➤ API-mapper (`register-api.mapper.ts`)

**Функции:**

- `RegisterRequest` → `RegisterRequestValues` (schemas-level)
- `RegisterResponseDto` → domain (`DomainRegisterResult` или reuse `RegisterResponse`)

**Инварианты:**

- ✅ Только pure-функции
- ✅ Freeze выходных объектов
- ✅ Использовать `effects/shared/safe-record.ts` helper
- ❌ Никакой логики store внутри мэппера

---

#### ➤ Store-updater (`register-store-updater.ts`)

**Логика:**

- Если backend возвращает `TokenPair + Me` — использовать `effects/shared/session-state.builder.ts`

**Инварианты:**

- ❌ Не пересчитывать security/risk
- ❌ Не читать store
- ❌ Не делать fallback при частично успешном ответе (fail-closed)

---

#### ➤ Orchestrator (`register.ts`)

**Наследует ключевые решения из `login.ts`:**

- ✅ strict Zod (`registerRequestSchema.strict()`)
- ✅ `validatedEffect` для `/v1/auth/register`
- ✅ Все ошибки через `deps.errorMapper.map(...)`
- ✅ Fail-closed: при частично успешном ответе (например, `/me` падает) — reject, не применяем токены

**Таймауты:**

- ✅ Один hard timeout поверх orchestrator
- ❌ Не размазывать `withTimeout` по шагам

**Различия:**

- security-pipeline опционален (по плану — без него)
- метаданные строятся тем же `buildLoginMetadata`, но с `operation: 'register'`

---

#### ♻️ Что можно переиспользовать

- Общая схема orchestrator и `validatedEffect` из `login.ts`
- `lib/error-mapper.ts` (через DI-порт)
- `stores/auth.ts` и `types/auth.ts`
- `domain/RegisterRequest.ts` и `domain/RegisterResponse.ts`
- `schemas` (через `packages/feature-auth/src/schemas/index.ts`)
- `effects/login/login-metadata.enricher.ts` (уже поддерживает `operation: 'register'`)
- `effects/shared/safe-record.ts`
- `effects/shared/session-state.builder.ts`

---

#### 🚫 Инварианты

- ❌ Не пересчитывает security
- ❌ Не читает store
- ❌ Не делает fallback при частичном успехе
- ✅ Concurrency — конфигурируемый, не зафиксированный

---

### 🔴 3.3 Refresh (самый чувствительный)

> **Почему последним:** самый сложный, требует session-manager, критичен для безопасности.

#### 📁 Создать

- `effects/refresh/refresh-effect.types.ts`
- `effects/refresh/refresh-api.mapper.ts`
- `effects/refresh/refresh-store-updater.ts`
- `effects/refresh.ts`

---

#### 🎯 Семантика

**Refresh = контролируемая мутация SessionState**

**Инварианты:**

- ❌ Не создаёт новую auth-сессию
- ❌ Не меняет `authStatus` без оснований
- ❌ Не выполняется параллельно (строго serialize или ignore)

---

#### ➤ DI-тип (`refresh-effect.types.ts`)

- `AuthStorePort` (общий, из shared)
- `ApiClient`
- `ErrorMapperPort`
- `RefreshEffectConfig`:
  - `timeout` (для `/v1/auth/refresh` и, возможно, `/v1/auth/me`)
  - `concurrency: 'serialize' | 'ignore'` (строго, чтобы не было параллельных refresh)

**Обязательно:** isolation guard через `@livai/app/lib/effect-isolation`

**Store lock:** блокирует store через `setStoreLocked(true)` в начале, unlock в `finally`

**Cancellation:** при `cancel_previous` effect создаёт `AbortController`, отменяет предыдущий refresh, очищает isolation state в `finally`

---

#### ➤ API-mapper (`refresh-api.mapper.ts`)

**Функции:**

- `mapRefreshRequestToApiPayload` (из состояния/SessionPolicy в DTO, если требуется тело запроса)
- `mapRefreshResponseToDomain` (из DTO в `TokenPair`/`MeResponse`)

**Важно:** Использовать `effects/shared/auth-api.mappers.ts`:
- `mapTokenPairValuesToDomain`
- `mapMeResponseValuesToDomain`

- ❌ Refresh не должен иметь собственную копию логики login-мэппинга

---

#### ➤ Store-updater (`refresh-store-updater.ts`)

**Использовать `effects/shared/session-state.builder.ts`:**

- ✅ проверка `issuedAt <= expiresAt`
- ✅ copy-on-write
- ✅ freeze
- ✅ Атомарное обновление через `batchUpdate`

**Стратегия при частично успешном refresh (fail-closed):**

Если `/refresh` успешен, но `/me` падает:
- ❌ Не принимать новые токены без `/me`
- ❌ Не сохранять старый session
- ✅ Invalidate session (как в login)

**Важно:** Решение invalidate принимается через `session-manager.shouldInvalidate()`, не внутри эффекта

---

#### ➤ Orchestrator (`refresh.ts`)

**Наследует паттерн `login.ts`:**

- ✅ `validatedEffect` для `/v1/auth/refresh` (и `/me`, если требуется синхронизация профиля)
- ✅ `withTimeout` + global hard timeout на уровне конфигурации
- ✅ Все ошибки через `errorMapper`

**Idempotency:**

- ✅ Использовать `@livai/app/lib/effect-isolation`:
  - один активный refresh
  - повторный вызов возвращает текущий промис

**Строгий инвариант о статусе:**

Refresh не имеет права менять `authStatus` кроме перехода:
- `authenticated → expired`, или
- `authenticated → invalidated`

- ❌ Refresh не может случайно "логинить" пользователя (переход в `authenticated` запрещён)

**Интеграция с session-manager:**

1. Эффект спрашивает `session-manager.shouldRefresh()` — нужно ли refresh
2. Делает HTTP-запросы (`/refresh`, `/me`)
3. При ошибке спрашивает `session-manager.shouldInvalidate()` — что делать
4. Применяет через store-updater

**Граница:** SessionManager решает "когда" и "что делать при неудаче", Effect делает HTTP и применяет решения

---

#### ♻️ Что можно переиспользовать

- `stores/auth.ts` и `types/auth.ts`
- `domain/TokenPair.ts`, `domain/MeResponse.ts`, `domain/SessionPolicy.ts`, `domain/RefreshTokenRequest.ts`
- `@livai/core/policies/AuthPolicy`
- Построение `SessionState` из `login-store-updater.ts`
- strict Zod валидацию `TokenPair`/`MeResponse` из login-flow
- fail-closed поведение, если `/me` не успешен
- `effects/shared/auth-api.mappers.ts`
- `effects/shared/session-state.builder.ts`
- `lib/error-mapper.ts` (через DI-порт)

---

#### 🎯 Обязательные элементы

##### 1️⃣ Isolation guard

- ✅ Только один активный refresh
- ✅ Повторный вызов возвращает текущий promise

##### 2️⃣ Использование SessionManager

**Effect:**

1. Спрашивает policy
2. Принимает решение
3. Применяет через store-updater

##### 3️⃣ Строгий запрет

Refresh не имеет права менять `authStatus`, кроме:

- `authenticated → expired`
- `authenticated → invalidated`

- ❌ Не может логинить пользователя

##### 4️⃣ Store-updater

**Использует:**

- shared session-state builder
- shared API-mappers

---

## 🧩 ФАЗА 4 — React hook

> ⚠️ **Только после стабилизации эффектов.**

**Hook — последний слой**, который объединяет всё в единый React-интерфейс.

---

### 📁 Создать

```
packages/feature-auth/src/hooks/useAuth.ts
```

---

### 🎭 Роль

**Тонкий React-фасад:**

- селекторы стора
- вызов эффектов
- агрегация derived-флагов

- ❌ Никакой бизнес-логики

---

### ➤ Зависимости

- `stores/auth.ts`
- `effects/login.ts`
- `effects/logout.ts`
- `effects/refresh.ts`
- `types/auth.ts`
- `domain/LoginRequest.ts`
- `domain/LogoutRequest.ts`
- `domain/RefreshTokenRequest.ts`

---

### ➤ API (возвращаемый объект)

```typescript
{
  authState: AuthState
  authStatus: AuthStatus
  isAuthenticated: boolean
  login(request): Promise<LoginResult>
  logout(): Promise<void>
  refresh(): Promise<RefreshResult>
}
```

---

### 🚫 Критичные запреты

- ✅ Методы должны возвращать промисы эффектов без обёрток
- ❌ concurrency-логика (это ответственность эффектов)
- ❌ deduplication (эффекты уже реализуют стратегию concurrency)
- ❌ retry (это ответственность эффектов)
- ❌ refresh-триггеры (это ответственность session-manager)
- ❌ policy-решения (это ответственность session-manager)
- ❌ трансформация ошибок (это ответственность эффектов)
- ❌ catch и глотание исключений (UI должен видеть реальные ошибки)
- ❌ создание derived side-effects (иначе UI начнёт зависеть от поведения хука, а не эффекта)

---

### ➤ DI для hook

Hook не должен создавать эффекты напрямую

**Эффекты передаются через:**

- feature-level provider, или
- фабрику `createAuthFeature()`

---

### ➤ Интеграционный мост App ↔ Feature

Уже запланирован в `docs/phase2-UI.md` как `features/auth.adapter.ts` (в app-слое):

- использует `@livai/feature-auth/hooks/useAuth` как источник
- адаптирует под UI-контракты приложения (`types/ui-contracts`)

---

### ♻️ Что можно переиспользовать

В пакете `@livai/app` уже существует `hooks/useAuth.ts` (app-слой), который:

- интегрирует store, effects и app-провайдеры
- протекает в web-приложение через `@livai/app/providers/AppProviders`

`stores/auth.ts` и `effects/login.ts`, а также будущие `effects/logout.ts` и `effects/refresh.ts`

---

### 💡 Рекомендации

- Структурировать `feature-auth/hooks/useAuth.ts` как чистый React-hook
- Логику idempotency/дедупликации промисов делегировать самим эффектам, а не хукe

> **👉 Hook — адаптер, не координатор.**

---

## 📦 Финальный линейный порядок реализации

> ⚠️ **Критично:** Реализация должна идти строго по этапам. Нарушение порядка приведёт к дублированию кода и архитектурным проблемам.

### 🏗️ Этап 1: Shared-слой (ФАЗА 1)

1. ✅ `auth-store.port.ts` — единый контракт стора
2. ✅ `session-state.builder.ts` — централизованное построение сессии
3. ✅ `auth-api.mappers.ts` — общие мэпперы API
4. ✅ `safe-record.ts` — безопасная работа с Record
5. ✅ **Переподключить login к shared** — рефакторинг существующего кода

### 🧠 Этап 2: Доменная политика (ФАЗА 2)

6. ✅ `session-manager.ts` — domain-pure сервис для политик

### ⚙️ Этап 3: Эффекты (ФАЗА 3)

7. ✅ `logout-effect` — самый простой, не зависит от session-manager
8. ✅ `register-effect` — reuse login-паттерна
9. ✅ `refresh-effect` — последним, самый чувствительный, зависит от session-manager

### 🧩 Этап 4: React-интерфейс (ФАЗА 4)

10. ✅ `useAuth` hook — в самом конце, когда эффекты уже стабильны

---

## 🧭 Главные инварианты всей системы

> Эти принципы должны соблюдаться на всех этапах реализации.

---

### 🎯 Policy в домене, orchestration в effect

**Разделение ответственности:**

- 🧠 **Бизнес-правила** (`AuthPolicy`, `SessionPolicy`, `session-manager`) — в домене
- ⚙️ **Orchestrator'ы** (`login.ts`, `logout.ts`, `register.ts`, `refresh.ts`) — тонкие, без бизнес-логики

---

### 💾 Store обновляется только через store-updater

**Единственная точка изменения состояния:**

- ❌ Никаких прямых вызовов `store/setState` в orchestrator'ах
- ✅ Единственная точка применения состояния — `*-store-updater.ts`

---

### 🔄 Мэпперы — pure и frozen

**Безопасность данных:**

- ✅ Все мэпперы (`*-api.mapper.ts`) — pure-функции
- ✅ Выходные объекты — frozen (`Object.freeze`)
- ❌ Никакой логики store внутри мэпперов

---

### 🔌 Один общий AuthStorePort для всех эффектов

**Единый контракт:**

- 📄 `effects/shared/auth-store.port.ts` — единый контракт
- ✅ Login/logout/register/refresh используют один порт

---

### 🏗️ SessionState строится в одном месте

**Централизация логики:**

- 📄 `effects/shared/session-state.builder.ts` — единый builder
- ✅ Проверка времени, copy-on-write, freeze — централизованно

---

### ⚡ Concurrency и isolation живут внутри effect, не в hook

**Управление конкурентностью:**

- 📝 Стратегии concurrency (`ignore`, `cancel_previous`, `serialize`) — в `*-effect.types.ts`
- 🔒 Isolation guard — в effect через `@livai/app/lib/effect-isolation`
- ❌ Hook не управляет concurrency

---

### 🎣 Hook — только адаптер, не координатор

**Тонкий фасад:**

- ✅ Hook вызывает эффекты и маппит результат в UI-состояние
- ❌ Никакой бизнес-логики, retry, refresh-триггеров, policy-решений
- ❌ Не трансформирует ошибки, не catch-ит исключения, не создаёт side-effects
- 💡 **UI должен зависеть от эффектов, а не хука**

**Error surface:** эффекты throw типизированные ошибки, hook пробрасывает их без обработки, UI обрабатывает через error boundaries или try/catch

### 🚫 Cross-effect вызовы запрещены

**Правило:**

- ❌ Эффекты не вызывают друг друга напрямую
- ❌ Эффекты не импортируют другие эффекты
- ✅ Hook может вызывать несколько эффектов последовательно
- ✅ Orchestrator может координировать эффекты (но не auth-эффекты друг друга)

### 🛡️ Fail-closed для всех эффектов

**Глобальное правило:**

- ❌ Частично успешные ответы **не применяются**
- ✅ При любой ошибке в цепочке (например, `/me` падает после успешного `/refresh`) — reject или invalidate
- ❌ Нет fallback на частичные данные

**Применяется:** login, register, refresh — все используют fail-closed стратегию
