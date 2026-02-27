## 🎯 Цель документа

Эталонно реализовать оставшиеся эффекты feature-auth (`effects/logout.ts`, `effects/register.ts`, `effects/refresh.ts`, `lib/session-manager.ts`, `hooks/useAuth.ts`) по тому же уровню архитектуры и инвариантов, что и `effects/login.ts`, с максимальным переиспользованием уже существующих модулей.

Документ разбит по файлам 2️⃣2️⃣6️⃣–2️⃣3️⃣0️⃣ из `docs/phase2-UI.md` и фиксирует:

- какие зависимости им нужны фактически;
- что уже реализовано и может быть переиспользовано;
- чего не хватает и какие новые модули стоит создать;
- какие части `effects/login/*` имеет смысл вынести в общие слои.

---

## 1️⃣ `effects/logout.ts` (2️⃣2️⃣6️⃣)

**Планируемый контракт (по `docs/phase2-UI.md`):**

- deps: `@livai/app/lib/orchestrator`, `@livai/app/state/store-utils`, `stores/auth`, `types/auth`, `lib/error-mapper` (через DI), `effects/logout/logout-effect.types`, `effects/logout/logout-store-updater`.
- Поведение: logout через orchestrator, очистка auth state через `safeSet`, блокировка store через `setStoreLocked`.

### 1.1. Что уже есть для переиспользования

- `stores/auth.ts` (`AuthStore` + инварианты, события, транзакции)\
  Используется как единый источник состояния. Logout обязан опираться на его публичный API, а не на внутреннюю структуру.

- `effects/login/login-effect.types.ts`\
  Даёт хороший эталон DI-портов и подход к timeouts/concurrency. Для logout можно:
  - **переиспользовать паттерн** `StorePort` (порт хранилища без знания о Zustand);
  - **переиспользовать подход к `ClockPort` и `AbortControllerPort`**, если logout будет участвовать в общей стратегии таймаутов/конкуренции.

- `effects/login/login-store-updater.ts`\
  Уже реализует applySuccess/applyMfa/applyBlocked для login. Для logout:
  - можно опираться на те же типы `SessionState`, `AuthState`, `SecurityState` из `types/auth.ts`;
  - но сама логика logout-сброса должна быть отдельным helper’ом, чтобы не перегружать login-specific updater.

### 1.2. Чего не хватает

1. **Общий store-updater для logout**
   - Новый модуль: `effects/logout/logout-store-updater.ts`
   - Задача: единая точка применения logout-состояния (очистка сессии, статуса, security-индикаторов), по аналогии с `login-store-updater`, но без знания login-domain.
   - Контракт:
     - вход: `AuthStorePort` (по аналогии с `LoginStorePort`, но, возможно, обобщённый), reason (опционально), meta (опционально);
     - выход: void; инварианты — не читает текущее состояние, не вводит fallback-значения.

2. **DI-тип для logout-effect**
   - Новый модуль: `effects/logout/logout-effect.types.ts`
   - Содержимое:
     - `LogoutStorePort` (минимальный подмножество методов `AuthStore` для logout);
     - `LogoutEffectDeps` (store + errorMapper + clock/abortController при необходимости);
     - `LogoutEffectConfig` (timeouts +, если нужно, простая стратегия concurrency).
   - Архитектурно — тот же уровень, что и `login-effect.types.ts`, но **без security-pipeline** и без HTTP.

3. **Сам orchestrator logout-effect**
   - Файл: `effects/logout.ts` (как в плане, реализовать заново).
   - Наследует инварианты login-orchestrator:
     - ❌ нет бизнес-логики (только сценарий);
     - ❌ нет прямых `Date.now()` (использовать `ClockPort`, если нужен timestamp для audit/telemetry);
     - ✅ все side-effects только через DI-порты (`AuthStorePort`, возможно audit/logger).
   - Использует:
     - `@livai/app/lib/orchestrator` — если потребуется последовательность шагов (например, audit → store-reset);
     - `@livai/app/state/store-utils` — для `safeSet`, если его контракт уже зафиксирован в app-слое.

### 1.3. Рекомендации по переиспользованию/выносу

- Вынести из `login-effect.types.ts` **общий `StorePort`-паттерн** в более нейтральный модуль (например, `effects/shared/auth-store.port.ts`), чтобы:
  - login/logout/refresh могли переиспользовать один и тот же тип порта;
  - не дублировать сигнатуры `setAuthState/setSessionState/setSecurityState/applyEventType`.
- `login-store-updater.ts` оставить login-специфичным; для logout сделать отдельный модуль, но использовать те же типы `SessionState`/`AuthState` из `types/auth.ts`.

---

## 2️⃣ `effects/register.ts` (2️⃣2️⃣7️⃣)

**Планируемый контракт (по `docs/phase2-UI.md`):**

- deps: `@livai/app/lib/orchestrator`, `@livai/app/lib/schema-validated-effect`, `@livai/app/lib/effect-timeout`, `@livai/app/lib/effect-utils`,
  `domain/RegisterRequest`, `domain/RegisterResponse`, `schemas`, `types/auth`, `lib/error-mapper` (через DI),
  `effects/register/register-effect.types`, `effects/register/register-api.mapper`, `effects/register/register-store-updater`, `effects/login/login-metadata.enricher`.
- Flow: validate-input (strict Zod) → optional metadata → api-call → domain mapping → update-store → timeouts + error-mapper.

### 2.1. Что уже есть для переиспользования

- **Общая схема orchestrator и validatedEffect:**
  - `effects/login.ts` — эталон orchestrator:
    - strict Zod (`loginRequestSchema.strict()`),
    - `validatedEffect` для /login и /me,
    - `withTimeout` + глобальный hard timeout,
    - error mapping через `deps.errorMapper`,
    - deps: `@livai/app/lib/orchestrator`, `@livai/app/lib/schema-validated-effect`, `@livai/app/lib/effect-timeout`, `@livai/app/lib/effect-utils`, `domain/LoginRequest`, `domain/LoginResult`, `schemas`, `types/auth`, `types/login.dto`, `effects/login/*`.

- **Ошибки и маппинг:**
  - `lib/error-mapper.ts` (deps: `@livai/app/lib/error-mapping`, `domain/AuthErrorResponse`, `domain/MfaChallengeRequest`, `domain/OAuthErrorResponse`, `domain/SessionRevokeRequest`, `types/auth`) — уже реализованный mapper API-ошибок в `AuthError`:
    - безопасный слой, переиспользуемый для logout/refresh/OAuth/MFA;
    - register-effect должен принимать его через DI-порт, не импортировать напрямую.

- **Store и типы:**
  - `stores/auth.ts` (deps: `types/auth`) и `types/auth.ts` (deps: `@livai/domains/policies`, `domain/*`) — уже содержат достаточный набор типов для post-register состояния.
  - `domain/RegisterRequest.ts` (deps: —) и `domain/RegisterResponse.ts` (deps: `domain/LoginRequest`, `domain/TokenPair`) — типы для DTO.
  - `schemas` (через `packages/feature-auth/src/schemas/index.ts`, deps: `@livai/core-contracts`) — Zod схемы register-flow уже описаны.

- **Метаданные логина:**
  - `effects/login/login-metadata.enricher.ts` уже поддерживает `operation: 'register' | 'oauth' | 'refresh'` в `LoginMetadata['timestamp']`:
    - это означает, что **тот же enricher** может использоваться и для register/refresh;
    - потребуется только другой `LoginContext` (тип identifier может быть другим, но контракт уже допускает);
    - deps: `@livai/core`, `@livai/domains`, `domain/DeviceInfo`, `domain/LoginRequest`.

### 2.2. Чего не хватает

1. **Специализированные DI-типы для register-effect**
   - Новый файл: `effects/register/register-effect.types.ts`.
   - Базу можно взять из `login-effect.types.ts`, но упростить:
     - тот же `ApiClient` и `ErrorMapperPort`;
     - `RegisterStorePort` как подмножество `LoginStorePort` (скорее всего те же методы);
     - `RegisterEffectDeps` без `securityPipeline`, без `auditLogger`;
     - `RegisterEffectConfig`: timeouts (один или два, в зависимости от наличия /me /агрегированных шагов) + concurrency, если регистрировать несколько раз подряд нежелательно.

2. **API-mapper для register**
   - Новый файл: `effects/register/register-api.mapper.ts`.
   - По аналогии с `login-api.mapper.ts`:
     - `RegisterRequest` → `RegisterRequestValues` (schemas-level);
     - `RegisterResponseDto` (если предусмотрен агрегат) → domain (`DomainRegisterResult` или reuse `RegisterResponse`).
   - Общие приёмы:
     - copy-on-write + `Object.freeze`;
     - проверка dynamic `Record` (если есть) через helper-ы наподобие `validateSafeRecordPayload` — их можно вынести в общий утилитный модуль (`effects/shared/record-safety.ts`), чтобы не дублировать код из login-mapper’а.

3. **Store-updater для register**
   - Новый файл: `effects/register/register-store-updater.ts`.
   - Логика:
     - на успешной регистрации — установить `AuthState`/`SessionState` аналогично login-success (возможно, через внутреннее переиспользование логики из `login-store-updater.ts`, если backend сразу возвращает `TokenPair + Me`);
     - инвариант: не пересчитывать риск, не читать текущее состояние стора.
   - Возможное решение:
     - вынести из `login-store-updater.ts` общий helper `applySessionFromTokenPairAndMe(...)` в модуль `effects/shared/session-updater.ts` и переиспользовать в обоих updaters.

4. **Сам orchestrator register-effect**
   - Файл: `effects/register.ts` (как в плане).
   - Наследует ключевые решения из login.ts:
     - strict Zod (`registerRequestSchema.strict()`),
     - `validatedEffect` для /v1/auth/register,
     - глобальный hard timeout (на уровне `RegisterEffectConfig`, не размазывая `withTimeout` по шагам),
     - все ошибки через `deps.errorMapper.map(...)`.
   - Различия:
     - security-pipeline опционален (по плану — без него);
     - метаданные строятся всё тем же `buildLoginMetadata`, но с `operation: 'register'` (контекст уже это допускает);
     - audit-логгер может быть подключён позже отдельно (в текущем плане он не указан).

### 2.3. Рекомендации по выносу общих частей

- Вынести **валидацию и freeze для dynamic Record** из `login-api.mapper.ts` в отдельный модуль, например:
  - `effects/shared/safe-record.ts` с функциями:
    - `validateSafeRecordPayload(value, label)`,
    - `freezeShallowRecord`,
    - `freezeArrayCopy`.
  - И login, и register смогут использовать этот модуль, избегая дублирования и сохраняя единые правила безопасности.

- Вынести из `login-store-updater.ts` общий helper для построения `SessionState` из `(tokenPair, me.session)` (с проверкой `issuedAt <= expiresAt`) в:
  - `effects/shared/session-state.builder.ts`.

---

## 3️⃣ `effects/refresh.ts` (2️⃣2️⃣8️⃣)

**Планируемый контракт (по `docs/phase2-UI.md`):**

- deps: `@livai/app/lib/orchestrator`, `@livai/app/lib/schema-validated-effect`, `@livai/app/lib/effect-timeout`, `@livai/app/lib/effect-isolation`, `@livai/app/lib/effect-utils`,
  `@livai/app/state/store-utils`, `types/auth`, `stores/auth`, `@livai/core/policies/AuthPolicy`, `schemas`, `domain/RefreshTokenRequest`, `domain/TokenPair`, `domain/MeResponse`,
  `lib/error-mapper` (через DI), `effects/refresh/refresh-effect.types`, `effects/refresh/refresh-api.mapper`, `effects/refresh/refresh-store-updater`.
- Поведение: обновляет access token через orchestrator с idempotency guard, validation через `validatedEffect`, sync store через `safeSet`, isolation и timeout.

### 3.1. Что уже есть для переиспользования

- **Store и типы:**
  - `stores/auth.ts` (deps: `types/auth`) — уже реализованный, с инвариантами и версионированием;
  - `types/auth.ts` (deps: `@livai/domains/policies`, `domain/*`) — содержит `SessionState`, `AuthState`, статусы сессии;
  - `domain/TokenPair.ts` (deps: —), `domain/MeResponse.ts` (deps: —), `domain/SessionPolicy.ts` (deps: —), `domain/RefreshTokenRequest.ts` (deps: —) — контракты для работы с сессией.

- **Политики и ядро:**
  - `@livai/core/policies/AuthPolicy` (упомянуто в docs) — используется уже в других местах для lifecycle токенов/сессий;
  - `lib/session-manager.ts` (запланирован) будет естественным местом для политики refresh (см. ниже).

- **Login-flow реализация:**
  - `effects/login.ts` (deps: `@livai/app/lib/orchestrator`, `@livai/app/lib/schema-validated-effect`, `@livai/app/lib/effect-timeout`, `@livai/app/lib/effect-utils`, `domain/LoginRequest`, `domain/LoginResult`, `schemas`, `types/auth`, `types/login.dto`, `effects/login/*`) и `effects/login/login-store-updater.ts` (deps: `effects/login/login-effect.types`, `effects/login/login-metadata.enricher`, `domain/LoginResult`, `lib/security-pipeline`, `types/auth-risk`, `types/auth`) уже реализуют:
    - построение нового `SessionState`,
    - strict Zod валидацию TokenPair/MeResponse,
    - fail-closed поведение, если /me не успешен.

### 3.2. Чего не хватает

1. **DI-типы для refresh-effect**
   - Новый файл: `effects/refresh/refresh-effect.types.ts`.
   - Базируется на:
     - `ApiClient` и `ErrorMapperPort` из login;
     - `AuthStorePort` (общий порт стора после выноса из login-специфики);
     - `RefreshEffectConfig`:
       - timeouts для /v1/auth/refresh и, возможно, для /v1/auth/me (если цепочка повторяет login);
       - concurrency (скорее всего serialize или ignore, чтобы не было параллельных refresh).

2. **API-mapper для refresh**
   - Новый файл: `effects/refresh/refresh-api.mapper.ts`.
   - Функции:
     - `mapRefreshRequestToApiPayload` (из состояния/SessionPolicy в DTO, если требуется тело запроса);
     - `mapRefreshResponseToDomain` (из DTO в `TokenPair`/`MeResponse` или аналогичный доменный результат).
   - Общий код для `TokenPair` и `MeResponse` можно переиспользовать из login, вынеся соответствующие helper’ы:
     - Например, `mapTokenPairValuesToDomain` и `mapMeResponseValuesToDomain` вынести из `login-api.mapper.ts` в `effects/shared/auth-api.mappers.ts` и использовать как в login, так и в refresh.

3. **Store-updater для refresh**

- Возможные варианты:
  - либо отдельный модуль `effects/refresh/refresh-store-updater.ts`;
  - либо переиспользование общего helper’а из `effects/shared/session-state.builder.ts`, если login/refresh используют один и тот же способ обновления сессии.

4. **Сам orchestrator refresh-effect**

- Файл: `effects/refresh.ts`.
- Наследует паттерн login.ts:
  - `validatedEffect` для /v1/auth/refresh (и /me, если требуется синхронизация профиля);
  - `withTimeout` + global hard timeout на уровне конфигурации;
  - все ошибки через errorMapper.
- Дополнительно:
  - isolation через `@livai/app/lib/effect-isolation` (как указано в docs) — idempotency guard и защита от дублирующихся refresh-операций;
  - использование `AuthPolicy` из core для принятия решения, **где** и **когда** разрешено делать refresh (до login-effect, снаружи самого эффекта).

### 3.3. Рекомендации по выносу общих частей

- Вынести в отдельный модуль общие **API-mapping helper’ы**:
  - mapping TokenPair/MeResponse в домен (`mapTokenPairValuesToDomain`, `mapMeResponseValuesToDomain`);
  - использовать и в login, и в refresh (и, потенциально, в register).

---

## 4️⃣ `lib/session-manager.ts` (2️⃣2️⃣9️⃣)

**Планируемый контракт (по `docs/phase2-UI.md`):**

- deps: `types/auth`, `@livai/core/policies/AuthPolicy`, `domain/SessionPolicy`, `domain/TokenPair`.
- Поведение: auto-refresh, expiry, invalidation, session policies, concurrent limits.

### 4.1. Что уже есть для переиспользования

- `types/auth.ts` (deps: `@livai/domains/policies`, `domain/*`) — содержит все базовые типы состояния сессии.
- `domain/SessionPolicy.ts` (deps: —) — описывает политики сессии (ограничения по IP, concurrent sessions).
- `domain/TokenPair.ts` (deps: —) — контракт токенов для refresh.
- `@livai/core/policies/AuthPolicy` — уже реализует базовую доменную политику auth.
- Login/refresh-flow:
  - login уже создаёт корректный `SessionState` и синхронизирует его со store;
  - refresh будет обновлять токены и сессию по тем же правилам.

### 4.2. Чего не хватает

1. **Собственно доменный SessionManager**

- Файл: `lib/session-manager.ts` (по плану).
- Архитектурная роль:
  - чистый доменный сервис поверх `AuthPolicy` и `SessionPolicy`;
  - **не знает про HTTP, orchestrator или Effect**;
  - предоставляет операции:
    - `shouldRefresh(sessionState, now)` — когда нужно триггерить refresh;
    - `isExpired(sessionState, now)` — истёк ли срок;
    - `canOpenNewSession(currentSessions, policy)` — concurrent limits.

2. **Интеграция с effects**

- Сами эффекты (login/refresh/logout) не должны вшивать бизнес-политику внутрь себя:
  - они используют `session-manager` как чистый доменный сервис;
  - session-manager работает на `SessionState`, `SessionPolicy`, `AuthPolicy`.

### 4.3. Рекомендации

- Строго держать `session-manager.ts` **domain-pure**:
  - никаких ссылок на Effect, orchestrator, app-layer;
  - только типы из `types/auth.ts`, `domain/SessionPolicy.ts`, `@livai/core/policies/AuthPolicy`.
- Вся интеграция с Effects должна происходить в orchestrator’ах:
  - login/refresh вызывают session-manager, чтобы решить, нужно ли авто-refresh или invalidation;
  - результаты session-manager используются внутри store-updater’ов и эффектов.

---

## 5️⃣ `hooks/useAuth.ts` (2️⃣3️⃣0️⃣)

**Планируемый контракт (по `docs/phase2-UI.md`):**

- deps: `stores/auth`, `effects/login`, `effects/logout`, `effects/refresh`, `types/auth`, `domain/LoginRequest`, `domain/LogoutRequest`, `domain/RefreshTokenRequest`.
- Поведение: единый React-адаптер auth: инкапсулирует zustand+effects, даёт API `authState/authStatus/isAuthenticated/login/logout/refresh`.

### 5.1. Что уже есть для переиспользования

- В пакете `@livai/app` уже существует `hooks/useAuth.ts` (app-слой), который:
  - интегрирует store, effects и app-провайдеры;
  - протекает в web-приложение через `@livai/app/providers/AppProviders`.

- `stores/auth.ts` (deps: `types/auth`) и `effects/login.ts` (deps: `@livai/app/lib/orchestrator`, `@livai/app/lib/schema-validated-effect`, `@livai/app/lib/effect-timeout`, `@livai/app/lib/effect-utils`, `domain/LoginRequest`, `domain/LoginResult`, `schemas`, `types/auth`, `types/login.dto`, `effects/login/*`), а также будущие `effects/logout.ts` и `effects/refresh.ts` — это уже то, на что должен опираться hook в `feature-auth`.

### 5.2. Чего не хватает

1. **`feature-auth`-уровневый hook**

- Файл: `packages/feature-auth/src/hooks/useAuth.ts`.
- Архитектурная роль:
  - тонкий фасад над:
    - `createAuthStore` (из `stores/auth`),
    - `createLoginEffect`, `createLogoutEffect`, `createRefreshEffect`;
  - не знает про Next.js, роутинг, UI; это задача app-layer.

2. **Интеграционный мост App ↔ Feature**

- Уже запланирован в `docs/phase2-UI.md` как `features/auth.adapter.ts` (в app-слое):
  - использует `@livai/feature-auth/hooks/useAuth` как источник;
  - адаптирует под UI-контракты приложения (`types/ui-contracts`).

### 5.3. Рекомендации

- Структурировать `feature-auth/hooks/useAuth.ts` как **чистый React-hook**, который:
  - создаёт/подключает `AuthStore` (через `createAuthStore` и selectors);
  - принимает `login/logout/refresh` эффекты как зависимости (через DI-конструктор или провайдер на уровне feature-auth);
  - возвращает строго типизированный объект:
    - `authState`, `authStatus`, `isAuthenticated`, `login()`, `logout()`, `refresh()`.

- Логику idempotency/дедупликации промисов (чтобы не было нескольких одновременных login/refresh) **делегировать самим эффектам**, а не хукe:
  - эффекты уже реализуют стратегию concurrency;
  - hook только вызывает effect и маппит результат в UI-состояние/ошибки.

---

## 6️⃣ Какие части `effects/login/*` стоит сделать общими

На основе анализа `effects/login/*.ts` и `lib/security-pipeline.ts` рекомендуются следующие выносы:

1. **Общий порт стора для auth-эффектов**
   - Новый модуль: `effects/shared/auth-store.port.ts`.
   - Содержимое:
     - `AuthStorePort` (подмножество `LoginStorePort`):
       - `setAuthState`, `setSessionState`, `setSecurityState`, `applyEventType`, `batchUpdate?`.
   - `login-effect.types.ts` переезжает на этот общий порт;
   - новые `logout-effect.types.ts` и `refresh-effect.types.ts` используют тот же порт.

2. **Общие helper’ы для SessionState**
   - Новый модуль: `effects/shared/session-state.builder.ts`.
   - Вытащить из `login-store-updater.ts`:
     - построение `SessionState` из `(SecurityPipelineResult.deviceInfo, tokenPair, me.session)` с проверкой `issuedAt <= expiresAt`.
   - Использовать:
     - в `login-store-updater.ts`,
     - в будущем `refresh-store-updater.ts`.

3. **Безопасная работа с dynamic Record**
   - Новый модуль: `effects/shared/safe-record.ts`.
   - Вынести из `login-api.mapper.ts`:
     - `isPlainObject`, `isSafePrimitive`, `isSafePrimitiveArray`,
     - `validateSafeRecordPayload`, `freezeShallowRecord`, `freezeArrayCopy`, `validateAndFreezeRecordPayload`.
   - Использовать:
     - в `login-api.mapper.ts`,
     - в `register-api.mapper.ts`,
     - в `refresh-api.mapper.ts` (если ответ содержит metadata/context).

4. **Общие API-мэпперы для TokenPair/MeResponse**
   - Новый модуль: `effects/shared/auth-api.mappers.ts`.
   - Вынести:
     - `mapTokenPairValuesToDomain`,
     - `mapMeResponseValuesToDomain`.
   - Использовать:
     - в login,
     - в refresh,
     - при необходимости — в register (если backend возвращает тот же формат).

5. **Переиспользование metadata enricher’а**
   - `login-metadata.enricher.ts` уже поддерживает `operation: 'login' | 'register' | 'oauth' | 'refresh'`:
     - **не переносить** его в shared-директорию, оставить в `effects/login`, но использовать как общую зависимость для register/refresh через DI;
     - это сохранит семантику "login-context enricher", но позволит охватывать и родственные операции.

6. **Переиспользование security-pipeline**
   - `lib/security-pipeline.ts` уже задизайнен для операций `'login' | 'oauth_login' | 'register' | 'oauth_register' | 'mfa' | 'session_refresh'`:
     - login уже использует его через projection `LoginSecurityResult`;
     - register/refresh смогут:
       - либо не использовать pipeline (по текущему плану для register);
       - либо использовать другие операции (`'session_refresh'`) через отдельные projection-типы (`RefreshSecurityResult`), определённые в своих `*-effect.types.ts`.

---

## 7️⃣ Краткий итог по каждому файлу 2️⃣2️⃣6️⃣–2️⃣3️⃣0️⃣

- **2️⃣2️⃣6️⃣ `effects/logout.ts`**
  - Требует: собственного DI-типа, logout-store-updater, общего `AuthStorePort`.
  - Может переиспользовать: паттерн DI/конкуренции из `login-effect.types.ts`, типы из `types/auth.ts`, store из `stores/auth.ts`.

- **2️⃣2️⃣7️⃣ `effects/register.ts`**
  - Требует: `register-effect.types.ts`, `register-api.mapper.ts`, `register-store-updater.ts`.
  - Может переиспользовать: `validatedEffect`, error-mapper, metadata-enricher, shared-safe-record helper’ы и shared SessionState builder.

- **2️⃣2️⃣8️⃣ `effects/refresh.ts`**
  - Требует: `refresh-effect.types.ts`, `refresh-api.mapper.ts`, (опционально) `refresh-store-updater.ts`.
  - Может переиспользовать: общие TokenPair/MeResponse мэпперы, SessionState builder, error-mapper, orchestrator-паттерн login.ts.

- **2️⃣2️⃣9️⃣ `lib/session-manager.ts`**
  - Требует: доменный сервис поверх `AuthPolicy`/`SessionPolicy` без Effect/HTTP.
  - Может переиспользовать: типы `SessionState`/`AuthState`/`SessionPolicy` и знания о сроках из login/refresh-flow.

- **2️⃣3️⃣0️⃣ `hooks/useAuth.ts` (feature-auth)**
  - Требует: единый React-hook, собирающий store + эффекты (login/logout/refresh).
  - Может переиспользовать: `stores/auth.ts`, factory’и `createLoginEffect`/`createLogoutEffect`/`createRefreshEffect`, типы `AuthState`/`AuthStatus`.

Таким образом, ядро уже реализовано (login-flow, security-pipeline, metadata, store), а оставшиеся эффекты и hook могут быть реализованы эталонно, если:

- оформить общие порты и helper’ы в отдельных модулях;
- переиспользовать существующие mapping/validation/SessionState-строители;
- строго удерживать бизнес-правила в домене (`AuthPolicy`, `SessionPolicy`, `session-manager`), а orchestrator’ы делать тонкими, как `login.ts`.
