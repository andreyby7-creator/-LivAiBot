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

### ✅ Шаг 1.1 Вынести общий контракт стора [ВЫПОЛНЕНО]

#### ➤ Создать

```
effects/shared/auth-store.port.ts ✅
```

#### ➤ Контракт

```typescript
type AuthStorePort {
  setAuthState(state: AuthState): void; ✅
  setSessionState(state: SessionState | null): void; ✅ (поддержка null для очистки)
  setSecurityState(state: SecurityState): void; ✅
  applyEventType(event: AuthEvent['type']): void; ✅ (union-тип, не string)
  setStoreLocked(locked: boolean): void; ✅ (ОБЯЗАТЕЛЬНО для logout/refresh)
  batchUpdate(updates: readonly BatchUpdate[]): void; ✅ (ОБЯЗАТЕЛЬНО для атомарности)
}
```

**Атомарность:** все store-updater'ы используют `batchUpdate` для атомарного обновления (избегаем промежуточных состояний) ✅

#### ➤ Инварианты

- ✅ `AuthEvent['type']` — union-тип, не `string` (type-safety)
- ✅ Нет прямых вызовов Zustand в эффектах (используется через `AuthStorePort`)
- ✅ Нет скрытых методов
- ✅ Единый порт для всех auth-эффектов (login/logout/register/refresh)
- ✅ `batchUpdate` обязателен для атомарности всех обновлений
- ✅ Реализован адаптер `createAuthStorePortAdapter` для Zustand store
- ✅ Реализована утилита `withStoreLock` для безопасной блокировки

#### ➤ Обязательное действие

Перевести `login-effect.types.ts` на этот порт. ✅ **ВЫПОЛНЕНО**

#### ➤ Использование

- ✅ `login-effect.types.ts` переведен на общий порт (`authStore: AuthStorePort`)
- ✅ `login-store-updater.ts` использует `AuthStorePort` (все методы через порт)
- ✅ Создан индекс `effects/shared/index.ts` с экспортами
- ⏳ `logout-effect.types.ts`, `refresh-effect.types.ts`, `register-effect.types.ts` будут использовать тот же порт

#### ⚠️ Критично

> **Это база.** Пока нет общего порта — писать остальные эффекты рано. ✅ **ГОТОВО К ИСПОЛЬЗОВАНИЮ**

---

### ✅ Шаг 1.2 Централизовать построение SessionState [ВЫПОЛНЕНО]

#### ➤ Создать

```
effects/shared/session-state.builder.ts ✅
```

#### ➤ Вынести из

- `login-store-updater.ts` ✅

#### ➤ Инварианты builder'а

- ✅ Проверка `issuedAt <= expiresAt` через `Date.parse()` (безопасное сравнение ISO-8601)
- ✅ Copy-on-write (shallow copy deviceInfo)
- ✅ Shallow freeze (защита от мутаций)
- ✅ Не читает store (pure function)
- ✅ Единая точка построения `SessionState` из `(deviceInfo, tokenPair, me.session)`
- ✅ Fail-fast: выбрасывает ошибку если `issuedAt` или `expiresAt` отсутствуют (предотвращает silent masking)
- ✅ Валидация ISO формата дат (проверка на `NaN` после `Date.parse()`)
- ✅ Возвращает `null` если `me.session` отсутствует (intentional absence)

#### ➤ Подключить обратно

- ✅ В `login-store-updater.ts`

#### ➤ Использование

- ✅ В `login-store-updater.ts`
- ⏳ В `refresh-store-updater.ts`
- ⏳ В `register-store-updater.ts` (если backend возвращает TokenPair + Me)

#### ⚠️ Критично

> **👉 После этого login становится эталоном reuse.** ✅ **ГОТОВО К ИСПОЛЬЗОВАНИЮ**

---

### ✅ Шаг 1.3 Централизовать API-мэпперы [ВЫПОЛНЕНО]

#### ➤ Создать

```
effects/shared/auth-api.mappers.ts ✅
```

#### ➤ Вынести

- ✅ `mapTokenPairValuesToDomain(values: LoginTokenPairValues): TokenPair`
- ✅ `mapMeResponseValuesToDomain(values: MeResponseValues): MeResponse`
- ✅ Вспомогательные функции: `freezeArrayCopy`, `validateAndFreezeRecordPayload`, `mapMeSessionValuesToDomain`, `mapMeUserValuesToDomain` и др.

#### ➤ Подключить в

- ✅ `login-api.mapper.ts`
- ⏳ `refresh-api.mapper.ts`
- ⏳ `register-api.mapper.ts` (если backend возвращает тот же формат)

#### ➤ Инварианты

- ✅ Pure-функции (без side-effects, детерминированные)
- ✅ Copy-on-write для массивов/объектов
- ✅ Immutability через Object.freeze
- ✅ Safety boundary: валидация dynamic Record перед переносом в domain
- ✅ Единая точка мэппинга transport → domain для всех auth-эффектов

#### ⚠️ Критично

> **Refresh не должен иметь собственную копию логики login-мэппинга.** ✅ **ГОТОВО К ИСПОЛЬЗОВАНИЮ**

---

### ✅ Шаг 1.4 Создать канонические initial states [ВЫПОЛНЕНО]

#### ➤ Создать

```
types/auth-initial.ts ✅
```

#### ➤ Константы

- ✅ `initialAuthState: AuthState` — `{ status: 'unauthenticated' }`
- ✅ `createInitialSessionState(): SessionState | null` — возвращает `null` (фабрика для соблюдения линтера)
- ✅ `initialSecurityState: SecurityState` — `{ status: 'secure' }`

#### ➤ Зависимости

- ✅ `types/auth.ts` (AuthState, SessionState, SecurityState)

#### ➤ Инварианты

- ✅ Канонические значения (единый источник истины для reset)
- ✅ Type-safe (соответствуют типам из `types/auth.ts`)
- ✅ Immutable (readonly константы + Object.freeze)
- ✅ Не зависит от store или effects
- ✅ Не содержит бизнес-логики

#### ➤ Использование

- ⏳ `logout-store-updater.ts` (для атомарного reset через `batchUpdate`)
- ⏳ Возможно, другие эффекты для reset/cleanup операций

#### ⚠️ Важно

**Единый источник истины для reset:**

- ✅ Избегаем дублирования `{ status: 'unauthenticated' }` в разных местах
- ✅ Гарантируем консистентность при сбросе состояний
- ✅ Упрощаем тестирование (можно мокать константы)

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

### ✅ Шаг 2.1. Реализовать lib/session-manager.ts [ВЫПОЛНЕНО]

#### ➤ Domain-pure сервис ✅

#### ➤ Зависимости ✅

- ✅ `types/auth.ts` (SessionState) — используется
- ✅ `@livai/core` (AuthPolicyConfig) — используется (обновлено: используется AuthPolicyConfig, не AuthPolicy)
- ✅ `@livai/core-contracts` (UnixTimestampMs) — используется
- ✅ `domain/SessionPolicy.ts` — используется
- ❌ `domain/TokenPair.ts` — не используется (не требуется для session-manager)

#### ➤ Методы ✅

- ✅ `isExpired(session, now): boolean` — реализован, fail-closed, exhaustive check
- ✅ `shouldRefresh(session, now): boolean` — реализован, proactive refresh
- ✅ `getRefreshDeadline(session): UnixTimestampMs` — **реализован**, возвращает UnixTimestampMs (улучшение: тип вместо number)
- ✅ `shouldInvalidate(session, now): boolean` — реализован, проверяет только active сессии, использует policy из конфигурации
- ✅ `canOpenNewSession(existing, now): boolean` — реализован, использует policy из конфигурации, учитывает expired сессии

#### ➤ Инварианты ✅

- ✅ Fail-closed — реализовано во всех методах
- ✅ Не знает про effects — изолирован от orchestration-слоя
- ✅ Не знает про store — нет зависимостей от store
- ✅ Не знает про HTTP — нет HTTP-запросов
- ✅ `now` передаётся извне (injected) — все методы принимают `now: UnixTimestampMs`
- ✅ Никаких побочных эффектов — pure functions
- ✅ Никаких допущений о наличии токена — работает только с SessionState
- ✅ Валидация времени строго через injected `now` — все проверки используют `now`

#### ⚠️ Критично ✅

**`getRefreshDeadline` — обязательный метод ✅**

- ✅ Избавляет от "минус 30 секунд" в эффектах — deadline вычисляется в domain
- ✅ Deadline — часть политики, не эффекта — реализовано через `refreshProactiveWindowMs` в конфигурации

#### ➤ Интеграция с effects ✅

**Граница ответственности:**

**SessionManager (domain):**

- ✅ Вычисляет deadlines (`getRefreshDeadline`) — реализовано
- ✅ Решает expire/invalidate (`isExpired`, `shouldInvalidate`) — реализовано
- ✅ Решает, нужно ли refresh (`shouldRefresh`) — реализовано
- ✅ Не знает про HTTP/ошибки API — изолирован

**Effect (orchestration):**

- ✅ Делает HTTP-запросы — ответственность effects
- ✅ Обрабатывает ошибки API — ответственность effects
- ✅ Применяет store-updater — ответственность effects
- ✅ Спрашивает SessionManager для принятия решений — готово к интеграции

> **👉 Важно:** Политика ≠ эффект. Бизнес-правила в домене, orchestration в effect. ✅ Реализовано

---

### ✅ Результат Фазы 2 [ВЫПОЛНЕНО]

- ✅ Вся auth-политика изолирована в домене
- ✅ Effects будут только orchestration-слоем
- ✅ SessionManager реализован с поддержкой AuthPolicy

---

## ⚙️ ФАЗА 3 — Реализация эффектов

> Теперь shared-слой стабилен, политика вынесена.

**Реализация строго по порядку:** сначала простые (logout), затем сложные (refresh).

---

### 🔴 3.1 Logout (самый простой)

> **Почему первым:** не зависит от session-manager, минимальная логика, хороший старт для проверки shared-слоя.

#### 📁 Создать

- ✅ `effects/logout/logout-effect.types.ts` [ВЫПОЛНЕНО]
- `effects/logout/logout-store-updater.ts`
- `effects/logout.ts`

---

#### 🏗️ Архитектура

##### 1️⃣ Режимы

```typescript
type LogoutMode = 'local' | 'remote';
```

- **`local`** → без ApiClient, без ErrorMapper, без timeout
- **`remote`** → через DI:
  - `ApiClient` (для удалённого revoke)
  - `ErrorMapperPort` (для обработки ошибок revoke)
  - `timeout` (для revoke-запроса)

**Стратегия remote logout:** optimistic reset — reset store всегда, revoke API best-effort (не блокирует logout при timeout/500/network error)

##### ➤ DI-тип (`logout-effect.types.ts`) ✅ [ВЫПОЛНЕНО]

- ✅ `AuthStorePort` (общий, из `effects/shared/auth-store.port.ts`) — реализовано в BaseLogoutEffectDeps
- ✅ `ClockPort` — обязателен для audit/telemetry — реализовано в BaseLogoutEffectDeps
- ✅ `LogoutEffectDeps` — discriminated union для compile-time safety:
  - ✅ `store` + `clock` + `auditLogger` — базовые зависимости (BaseLogoutEffectDeps)
  - ✅ `apiClient` и `errorMapper` только при `mode: 'remote'` — реализовано в RemoteLogoutEffectDeps
- ✅ `LogoutEffectConfig` — discriminated union:
  - ✅ `mode: 'local' | 'remote'` (обязательно) — реализовано
  - ✅ `concurrency: 'ignore' | 'cancel_previous' | 'serialize'` — реализовано как LogoutConcurrency
  - ✅ `timeout?` (только при `mode: 'remote'`) — реализовано в remote варианте
  - ✅ `featureFlags?: LogoutFeatureFlags` — добавлено для консистентности с login

**Инвариант:** ✅ Logout не импортирует конкретные эффекты/мапперы напрямую — только типы через `import type`

**Важно:** ✅ Эффект не универсальный — явное разделение на local/remote через discriminated unions

**Isolation:** ✅ не обязателен для logout — упомянуто в комментариях

**Дополнительно реализовано:**

- ✅ `LogoutSecurityDecision` и `LogoutSecurityResult` для extensibility
- ✅ `validateLogoutConfig` для runtime validation timeout
- ✅ Type guards (`isRemoteLogoutDeps`, `isLocalLogoutDeps`) для discriminated unions

##### 2️⃣ Store-updater (`logout-store-updater.ts`) ✅ [ВЫПОЛНЕНО]

**Единственная точка reset:**

Использует канонические initial states из `types/auth-initial.ts`:

- `initialAuthState`
- `createInitialSessionState()` (возвращает `null`)
- `initialSecurityState`

Сбрасывает через `batchUpdate` (атомарно):

- `AuthState` → `initialAuthState`
- `SessionState` → `createInitialSessionState()`
- `SecurityState` → `initialSecurityState`
- `applyEventType('user_logged_out')`

- ❌ Не читает текущее состояние
- ❌ Не использует fallback-значения
- ✅ Атомарное обновление через `batchUpdate`
- ✅ Вынесена константа `logoutResetActions` для централизованного расширения reset-логики

**Контракт:** вход — `AuthStorePort` (из shared), `context?` (опциональный контекст для audit/telemetry с `reason?` и `data?: unknown`); выход — `void`

**Реализовано:**

- ✅ Функция `applyLogoutReset` с атомарным reset через `batchUpdate`
- ✅ Использование канонических initial states из `types/auth-initial.ts`
- ✅ Константа `logoutResetActions` для future-proofing (централизованное расширение)
- ✅ Опциональный `context` параметр для audit/telemetry (зарезервирован для будущего использования)
- ✅ Domain-pure, deterministic, без side-effects
- ✅ Inline комментарии для параметров (без дублирования в JSDoc)

**Важно:** Никакой логики reset внутри orchestrator — только в store-updater

##### 3️⃣ Orchestrator (`logout.ts`) ✅ [ВЫПОЛНЕНО]

- ✅ Чистый сценарий
- ✅ Idempotency (двойной logout → no-op)
- ✅ Блокировка store только на время reset (lock → reset → unlock), revoke не держит lock (идёт параллельно после unlock)
- ✅ Нет бизнес-логики (только сценарий)
- ✅ Нет прямых `Date.now()` (используется `ClockPort` через `deps.clock.now()`)
- ✅ Все side-effects только через DI-порты
- ✅ Fail-closed: не вводит fallback-значения, не читает текущее состояние store
- ✅ Не вызывает другие эффекты напрямую (cross-effect вызовы запрещены)

**Remote logout:** reset store (с lock) + revoke API параллельно после unlock (best-effort, не ждём успеха revoke)

**Реализовано:**

- ✅ `performStoreReset` использует `withStoreLock` для атомарного lock → reset → unlock
- ✅ `handleRevokeRequest` выполняется параллельно после unlock, не блокирует logout
- ✅ Все timestamp'ы через `deps.clock.now()` и `epochMsToIsoString()` (детерминизм)
- ✅ Audit logging через `LogoutAuditLoggerPort` (синхронно внутри `runOnce`)
- ✅ Concurrency control: `ignore`, `cancel_previous`, `serialize` с DoS-защитой
- ✅ Idempotency через `batchUpdate` в `applyLogoutReset`
- ✅ Fail-closed: ошибки revoke логируются, но не влияют на результат logout

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

### 🟢 3.2 Register (Login-light) — выполнено

> **Почему вторым:** максимально переиспользует паттерны login, но без security-pipeline.

#### 📁 Реализовано

- `effects/register/register-effect.types.ts`
- `effects/register/register-api.mapper.ts`
- `effects/register/register-store-updater.ts`
- `effects/register/register-audit.mapper.ts`
- `effects/register/register-metadata.enricher.ts`
- `effects/register.ts`

---

#### 🏗️ Архитектурная модель

**Register = Login-light**

**Использует:**

- ✅ request validation (fail-fast, domain-level)
- ✅ `validatedEffect` + `registerResponseSchema` для `/v1/auth/register`
- ✅ `errorMapper` через DI
- ✅ `register-metadata.enricher` (register-native, без login-casts)
- ✅ `session-state builder` (reuse из shared)
- ✅ hard timeout на весь flow
- ❌ Без security-pipeline (если не требуется по политике)

---

#### ➤ DI-тип (`register-effect.types.ts`)

- `AuthStorePort` (общий, из shared)
- `ApiClient` (`AuthApiClientPort`)
- `ErrorMapperPort`
- `ClockPort` (обязателен для timestamp/audit)
- `TraceIdGeneratorPort` (обязателен, deterministic DI)
- `IdentifierHasherPort` (для metadata-enricher'а)
- `RegisterAuditLoggerPort` (audit-события регистрации)
- `AbortControllerPort` (для `cancel_previous`)
- `EventIdGeneratorPort` (обязателен, deterministic DI)
- `RegisterTelemetryPort?` (опционально, best-effort observability: audit/error-mapper failures)
- `RegisterEffectDeps` без `securityPipeline` (в отличие от login)
- `RegisterEffectConfig`:
  - `hardTimeout` (глобальный timeout на весь flow)
  - `apiTimeout?` (для отдельных API-вызовов, если нужен)
  - `concurrency?: 'ignore' | 'cancel_previous' | 'serialize'` (конфигурируемо, не жёстко):
    - `'serialize'` — если backend не допускает параллельную регистрацию
    - `'ignore'` — если повторное нажатие допустимо
  - `featureFlags?: RegisterFeatureFlags` (резерв под future-флаги, консистентно с login/logout)
  - `validateRegisterConfig(...)` (hardTimeout > 0, apiTimeout > 0, hardTimeout > apiTimeout)
  - `RegisterConfigError` (domain-specific config error)

**Cancellation:** при `cancel_previous` отменяет предыдущий запрос через AbortController (cancellation ≠ failure).

---

#### ➤ API-mapper (`register-api.mapper.ts`)

**Функции:**

- `RegisterRequest<'email'>` (domain) → `RegisterRequestValues` (transport для `/v1/auth/register`)
- `OAuthRegisterTransportInput` (transport input) → `OAuthRegisterRequestValues` (transport для `/v1/auth/oauth/register`)
- `RegisterResponseValues` (transport) → `RegisterResponse<'email'>` / `RegisterResponse<'oauth'>` (domain)

**Инварианты:**

- ✅ Только pure-функции
- ✅ Freeze выходных объектов
- ❌ Никакой логики store внутри мэппера
- ✅ Fail-closed: для типов идентификатора, не поддерживаемых текущей схемой (`username`, `phone`), выбрасывает ошибку
- ✅ Переиспользует `mapTokenPairValuesToDomain` из shared mappers для TokenPair
- ✅ OAuth provider mapping: exhaustive switch (domain drift → fail-closed)
- ✅ Guard: `expiresIn > 0`
- ✅ Trim для OAuth transport полей (code/state/redirectUri/workspaceName)

---

#### ➤ Store-updater (`register-store-updater.ts`)

**Логика:**

- Если backend возвращает `TokenPair + Me` — использовать `effects/shared/session-state.builder.ts` (SessionState) и выставлять `SecurityState` в `initialSecurityState` (status: `secure`)

**Инварианты:**

- ❌ Не пересчитывать security/risk
- ❌ Не читать store
- ❌ Не делать fallback при частично успешном ответе (fail-closed)
- ✅ Registry pattern для state handlers (scalable без разрастания if/switch)
- ✅ Детерминированные fail-closed error messages (без JSON.stringify)

---

#### ➤ Orchestrator (`register.ts`)

**Ключевые решения:**

- ✅ `validatedEffect` для `/v1/auth/register`
- ✅ Все ошибки через `deps.errorMapper.map(...)`
- ✅ Защита от падения mapper (fallback AuthError + telemetry)
- ✅ Best-effort audit logging (ошибки не ломают flow) + telemetry hook

**Таймауты:**

- ✅ Один hard timeout поверх orchestrator
- ❌ Не размазывать `withTimeout` по шагам

**Различия:**

- security-pipeline опционален (по плану — без него)
- метаданные строятся через `register-metadata.enricher` (без login-casts)
- traceId генерируется через DI (`TraceIdGeneratorPort`), без глобального `crypto`

---

#### ♻️ Что можно переиспользовать

- Общая схема orchestrator и `validatedEffect` из `login.ts`
- `lib/error-mapper.ts` (через DI-порт)
- `stores/auth.ts` и `types/auth.ts`
- `domain/RegisterRequest.ts` и `domain/RegisterResponse.ts`
- `domain/OAuthRegisterRequest.ts` (для OAuth register mapper)
- `schemas` (через `packages/feature-auth/src/schemas/index.ts`)
  - `registerRequestSchema` для email-регистрации
  - `oauthRegisterRequestSchema` для OAuth-регистрации
- `identifierHasher` (shared port) — единая стратегия hash для metadata
- `effects/shared/session-state.builder.ts`
- `effects/shared/auth-api.mappers.ts` (для маппинга TokenPair)

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
- `effects/refresh/refresh-audit.mapper.ts`
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
- `ApiClient` (`AuthApiClientPort`)
- `ErrorMapperPort`
- `SessionManagerPort` (порт над `lib/session-manager.ts`)
- `ClockPort` (обязателен для policy/audit timestamps)
- `RefreshAuditLoggerPort` (audit-события refresh/invalidate)
- `AbortControllerPort` (для отмены при `cancel_previous`, если используется)
- `EventIdGeneratorPort?` (опционален, для детерминизма в тестах)
- `RefreshEffectConfig`:
  - `timeout` (для `/v1/auth/refresh` и, возможно, `/v1/auth/me`)
  - `concurrency: 'serialize' | 'ignore'` (строго, чтобы не было параллельных refresh)
- `featureFlags?: RefreshFeatureFlags` (резерв под future-флаги, консистентно с login/logout)
- `validateRefreshConfig(...)` (валидация timeout > 0 и допустимых значений concurrency на этапе композиции)

**Обязательно:** isolation guard (один активный refresh, повторные вызовы возвращают текущий Promise; реализуется через стратегию concurrency/in-flight, без cross-effect вызовов)

**Store lock:** блокирует store через `withStoreLock(deps.authStore, ...)` (lock → атомарное обновление → unlock, как в logout)

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

**Security:**

- При успешном refresh `SecurityState` не меняется (reuse текущего состояния)
- При invalidate использует те же initial states (`initialAuthState`/`createInitialSessionState`/`initialSecurityState`) и `batchUpdate`, что и logout-reset

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

- ✅ Использовать idempotency guard на уровне effect:
  - один активный refresh (in-flight Promise)
  - повторный вызов возвращает текущий промис (очередь/serialize как в logout)

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
