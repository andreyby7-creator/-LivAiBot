# Дорожная карта: Реализация login-effect (Staff+/FAANG level)

**Цель:** Реализовать `packages/feature-auth/src/effects/login.ts` как production-grade orchestrator с соблюдением всех архитектурных инвариантов.

**Статус:** Планирование → Реализация

---

## 1️⃣ Зафиксировать контракт login-endpoint (schema-first) ✅

**1.1 Backend** ✅

Двухфазный, агрегат не возвращает:

- `POST /login` → `TokenPairResponse`
- `GET /me` → `MeResponse`

Агрегация выполняется только в effect-слое.
Без успешного `/me` → login невозможен (fail-closed).

**1.2 Transport (strict)** ✅

- `loginTokenPairSchema.strict()`
- `meResponseSchema.strict()`
- ❌ `.passthrough()`
- ❌ optional

Типы: `LoginTokenPairValues`, `MeResponseValues` — используются только в transport/feature.

**1.3 Feature (DTO)** ✅

```typescript
LoginResponseDto =
  | { type: 'success'; tokenPair; me }
  | { type: 'mfa_required'; challenge }
```

- `readonly`
- discriminated union
- нет optional
- `@version 1`
- `assertNever`
- создаётся только после успешных `/login` + `/me`

**1.4 Domain** ✅

```typescript
DomainLoginResult =
  | { type: 'success'; tokenPair: TokenPair; me: MeResponse }
  | { type: 'mfa_required'; challenge: MfaChallengeRequest }
```

- только domain-типы
- ❌ zod / DTO / any
- immutable
- fail-closed
- `@version 1`
- `assertNever`

Transport ↔ Domain mapping — явный и типобезопасный.

**1.5 Effect (оркестрация)** ✅

1. `/login` → strict validate
2. `/me` → strict validate
3. затем: DTO → Domain → storeUpdater → securityPipeline

Если `/me` падает →
нет `DomainLoginResult`, нет мутаций store, нет токенов, нет securityPipeline → `AuthError`.

**1.6 Инвариант (тест)** ✅

`/login` OK + `/me` fail →
`AuthError`, нет partial state, нет side-effects.

**📌 Итог:** ✅

- strict runtime validation
- чёткое разделение Transport / Feature / Domain
- immutable discriminated unions
- двухфазный deterministic flow
- fail-closed зафиксирован тестом
- MFA-ready

---

## 2️⃣ Устранить Record из domain/LoginRiskAssessment.ts

**Задача:** Убрать `Record<string, unknown>` из domain-слоя.

**Действия:**

- [ ] Предпочтительный вариант: полностью убрать `signals` из domain-слоя:
  - оставить сигналы в adapter-слое
  - в domain хранить только агрегированные значения (score, level, decision)
- [ ] Если сигналы остаются в domain:
  - Заменить `signals?: Record<string, unknown>` на строго типизированный `Readonly<LoginRiskSignals>`
  - Синхронизировать `LoginRiskSignals` с `RiskSignals` из `types/auth-risk.ts` и `login-risk-assessment.adapter.ts`
- [ ] Обновить `domain/LoginRiskAssessment.ts`:
  ```typescript
  // Было: signals?: Record<string, unknown>
  // Стало: signals?: Readonly<LoginRiskSignals> (строго типизированный, без индекс-сигнатур)
  ```
- [ ] Проверить, что adapter-слой остаётся единственной точкой трансформации внешних сигналов
- [ ] Обновить `buildAssessment` в `login-risk-assessment.adapter.ts` при необходимости

**Критерии готовности:**

- ✅ `domain/LoginRiskAssessment.ts` не содержит `Record<string, unknown>`
- ✅ Все сигналы либо вынесены в adapter, либо строго типизированы через `Readonly<...>`
- ✅ В domain нет индекс-сигнатур и generic-map структур
- ✅ Domain остаётся deterministic и отражает только стабильный semantic слой

---

## 3️⃣ Определить DI-контракт login-эффекта

**Задача:** Создать типы зависимостей до реализации.

**Действия:**

- [ ] Создать `LoginStorePort` интерфейс (не конкретный Zustand-тип):
  ```typescript
  type LoginStorePort = {
    setAuthState: (state: AuthState) => void;
    setSessionState: (state: SessionState | null) => void;
    setSecurityState: (state: SecurityState) => void;
    applyEventType: (type: AuthEvent['type']) => void;
  };
  ```
- [ ] Создать `LoginEffectDeps`:
  ```typescript
  type LoginEffectDeps = {
    apiClient: ApiClient;
    authStore: LoginStorePort; // порт, не конкретный тип
    securityPipeline: (
      context: SecurityPipelineContext,
      policy?: RiskPolicy,
    ) => Effect<SecurityPipelineResult>; // обёртка над executeSecurityPipeline с фиксированными env/плагинами
    identifierHasher: IdentifierHasher;
    auditLogger: MandatoryAuditLogger;
    clock: () => Readonly<Date>; // для детерминизма и исключения мутации
  };
  ```
- [ ] Создать `LoginEffectConfig`:
  ```typescript
  type LoginEffectConfig = {
    timeouts: {
      loginApiTimeoutMs: number; // для POST /v1/auth/login
      meApiTimeoutMs: number; // для GET /v1/auth/me
      // validate и metadata без таймаута или минимальный фиксированный
    };
    security: SecurityPipelineConfig; // failClosed: true в prod
    featureFlags?: Readonly<LoginFeatureFlags>;
    // policyMode на уровне композиции, login-effect не знает о режимах безопасности
  };
  ```
- [ ] Убедиться: никаких глобальных констант и `overallTimeoutMs`

**Критерии готовности:**

- ✅ Типы `LoginEffectDeps` и `LoginEffectConfig` определены
- ✅ `LoginStorePort` — порт, не конкретная реализация
- ✅ `securityPipeline` типизирован как обёртка с фиксированными параметрами
- ✅ В config нет generic `Record` и глобальных констант/overallTimeoutMs

---

## 4️⃣ Создать effects/login/login-api.mapper.ts

**Задача:** Чистый маппинг transport ↔ domain.

**Действия:**

- [ ] Создать файл `packages/feature-auth/src/effects/login/login-api.mapper.ts`
- [ ] Реализовать `mapLoginRequestToApiPayload(LoginRequest): LoginRequestValues`
- [ ] Реализовать `mapLoginResponseToDomain(LoginResponseDto): DomainLoginResult`
- [ ] Требования:
  - ❌ Никакой логики store
  - ❌ Никакой логики security
  - ❌ Нет доступа к `SecurityPipelineResult`
  - ✅ Только mapping transport ↔ domain
  - ✅ Строгие return-типы (никаких частичных объектов)
  - ✅ Pure функции, без side-effects
  - ✅ Нормализация enum-like строк в union-типы, дат и массивов → readonly
  - ❌ Никаких `try/catch` и default fallback — если данные невалидны, это bug схемы

**Критерии готовности:**

- ✅ Файл создан с двумя чистыми функциями
- ✅ Все типы строгие, без `Partial<>` в возвращаемых значениях
- ✅ Нет зависимостей от store/security/telemetry

---

## 5️⃣ Создать effects/login/login-store-updater.ts

**Задача:** Единая точка переходов состояния.

**Действия:**

- [ ] Создать файл `packages/feature-auth/src/effects/login/login-store-updater.ts`
- [ ] Реализовать функцию:
  ```typescript
  updateLoginState(
    store: LoginStorePort,
    securityResult: SecurityPipelineResult,
    domainResult: DomainLoginResult, // один union-тип, не несколько вариантов
    metadata?: LoginMetadata[]
  ): void
  ```
- [ ] Внутри функции:
  - Разделить внутреннюю реализацию на:
    - `applySuccessState` (гарантирует наличие `tokenPair` и `me` — оба обязательны)
    - `applyMfaState` (зарезервировано для будущего)
    - `applyBlockedState`
  - Вызовы `setAuthState`, `setSessionState`, `setSecurityState`, `applyEventType`
  - Использование готового `SecurityPipelineResult` (не пересчёт risk)
- [ ] Требования:
  - ❌ Без fallback'ов (`id: ''` запрещено)
  - ❌ Никаких `try/catch` — ошибки должны приходить валидированными
  - ❌ Не дублировать rule-engine из store
  - ❌ Не вычислять risk заново
  - ❌ Не читать текущее состояние и не принимать решения (decision уже сделан выше)
  - ✅ Метаданные передаются уже нормализованными
  - ✅ `DomainLoginResult.success` гарантированно содержит `tokenPair` и `me` (никаких partial состояний)

**Критерии готовности:**

- ✅ Файл создан с функцией `updateLoginState`
- ✅ Все переходы состояния через store actions
- ✅ Нет fallback-значений и пересчёта risk
- ✅ Success-состояние гарантирует наличие обоих полей (`tokenPair` и `me`)

---

## 6️⃣ (Опционально) Вынести login-security-policy

**Задача:** Клиентская policy поверх security-pipeline.

**Условие:** Только если нужна дополнительная policy поверх `executeSecurityPipeline`.

**Действия:**

- [ ] Создать `packages/feature-auth/src/effects/login/login-security-policy.ts`
- [ ] Реализовать:
  ```typescript
  evaluateLoginSecurityPolicy(
    result: SecurityPipelineResult,
    isProduction: boolean,
    policy: LoginSecurityPolicyConfig
  ): LoginSecurityDecision
  ```
- [ ] Тип:
  ```typescript
  type LoginSecurityDecision =
    | { type: 'block'; reason: string; }
    | { type: 'require_mfa'; }
    | { type: 'allow'; };
  ```
- [ ] Требования:
  - ✅ Pure-функция
  - ❌ Никаких store-вызовов
  - ❌ Никаких API-вызовов
  - ❌ Не читать featureFlags напрямую — получать уже рассчитанную policy

**Критерии готовности:**

- ✅ Файл создан (если нужен)
- ✅ Pure-функция без side-effects
- ✅ Используется в login.ts только для получения решения

---

## 7️⃣ Реализовать effects/login.ts как тонкий orchestrator

**Задача:** Основная реализация login-effect.

**Действия:**

- [ ] Создать файл `packages/feature-auth/src/effects/login.ts`
- [ ] Реализовать последовательность шагов через `orchestrate`:

  **Step 1 — validate-input:**
  - Использовать `isValidLoginRequest` и/или `loginRequestSchema`
  - Fail-fast, deterministic

  **Step 2 — security-pipeline:**
  - Вызов `executeSecurityPipeline` как атомарного шага
  - ❌ Не оборачивать в дополнительный timeout
  - Использовать `failClosed: true` в prod
  - ❌ Не дублировать risk-логику

  **Step 3 — security policy (если есть):**
  - Решение: `block` / `require_mfa` / `allow`
  - Если `block` → обновить store через updater и завершить

  **Step 4 — enrich-metadata:**
  - Через `createLoginMetadataEnricher`
  - Использовать injected `identifierHasher` и `clock`

  **Step 5 — validated API calls (двухфазный):**
  - **Step 5.1 — POST /v1/auth/login:**
    - `validatedEffect(loginTokenPairSchema, apiCall)`
    - `withTimeout` с `config.timeouts.loginApiTimeoutMs`
    - ❌ Никаких retry внутри эффекта
  - **Step 5.2 — GET /v1/auth/me:**
    - Использовать `access_token` из Step 5.1
    - `validatedEffect(meResponseSchema, apiCall)`
    - Отдельный `withTimeout` с `config.timeouts.meApiTimeoutMs`
    - ❌ Fail-closed: если `/me` упал — логин считается неуспешным (не делать fallback)
  - **Step 5.3 — агрегация:**
    - Объединить `TokenPair` и `MeResponse` в `DomainLoginResult.success`
    - Только после успешного завершения обоих вызовов

  **Step 6 — store update:**
  - Через `login-store-updater`
  - ❌ Никакой бизнес-логики внутри login.ts

- [ ] Return-тип: строгий union `LoginResult` с полезным payload:
  ```typescript
  type LoginResult =
    | { type: 'success'; userId: UserId; }
    | { type: 'mfa_required'; challengeId: string; }
    | { type: 'blocked'; reason: string; }
    | { type: 'error'; error: AuthError; };
  ```

**Критерии готовности:**

- ✅ Файл создан с полной последовательностью шагов
- ✅ Все шаги через `orchestrate` с isolation и timeout
- ✅ Return-тип — строгий union
- ✅ Нет бизнес-логики в orchestrator
- ✅ Store используется только в финальном шаге, без чтения состояния внутри шагов

---

## 8️⃣ Интегрировать error-mapper как единственный источник ошибок

**Задача:** Все ошибки через error-mapper (включая ошибки обоих API-вызовов).

**Действия:**

- [ ] В login.ts все три пути ошибок через helper `mapUnknownToAuthError`:
  - Ошибки API (через `mapAuthError`) — для обоих вызовов (`/login` и `/me`)
  - `SchemaValidationError` → валидировать и маппить как `unknown`/`policy_violation`
  - Инфраструктурные (`TimeoutError`, `IsolationError`, сетевые) → через правила `network`/`unknown`
- [ ] ❌ Никаких ручных `if (status === 401)` в login.ts
- [ ] ❌ Любая ошибка второго шага (`/me`) также проходит через error-mapper
- [ ] ❌ Не делать fallback типа "если `/me` упал — всё равно залогинить" — fail-closed: если `/me` не прошёл, логин считается неуспешным
- [ ] Sanitization только в error-mapper
- [ ] login.ts получает уже нормализованный `AuthError`

**Критерии готовности:**

- ✅ Все ошибки проходят через один helper `mapUnknownToAuthError`
- ✅ Нет ручной обработки HTTP-статусов
- ✅ Все ошибки типизированы как `AuthError`
- ✅ Ошибки обоих API-вызовов обрабатываются одинаково

---

## 9️⃣ Принять единый timeout-policy

**Задача:** Устранить конфликты таймаутов.

**Действия:**

- [ ] Security timeout — только внутри `executeSecurityPipeline`
- [ ] API timeouts — два отдельных, в login.ts (через `withTimeout` и config):
  - `loginApiTimeoutMs` для `POST /v1/auth/login`
  - `meApiTimeoutMs` для `GET /v1/auth/me`
  - ❌ Не один общий timeout для обоих вызовов
- [ ] Validate и metadata — без таймаута (или минимальный фиксированный)
- [ ] Удалить любые legacy-константы типа `LOGIN_TIMEOUT_MS`
- [ ] Проверить, что нет нескольких уровней таймаутов

**Критерии готовности:**

- ✅ Таймауты определены в config (два отдельных для API)
- ✅ Нет legacy-констант
- ✅ Нет конфликтов между шагами

---

## 🔟 Интегрировать audit-логгер корректно

**Задача:** Audit через DI, без глобалов.

**Действия:**

- [ ] Передавать `MandatoryAuditLogger` в `security-pipeline`
- [ ] ❌ login.ts не использует `console.*`
- [ ] Audit должен фиксировать:
  - `login_success` только после успешного `/me` (не после получения `tokenPair`)
  - Иначе можно получить токены, но не загрузить профиль — система окажется в inconsistent state
- [ ] При ошибке/блокировке — формировать `AuthAuditEvent` через существующую схему
- [ ] Весь audit — через DI (`LoginEffectDeps.auditLogger`)
- [ ] Использовать отдельный mapper `mapLoginResultToAuditEvent(...)` — чтобы login.ts не содержал audit-структуру

**Критерии готовности:**

- ✅ Нет `console.*` в login.ts
- ✅ Audit через injected logger (интерфейс, не конкретная реализация)
- ✅ События формируются через `auditEventSchema` и отдельный mapper
- ✅ `login_success` фиксируется только после успешного `/me`

---

## 1️⃣1️⃣ Обновить public API feature-auth

**Задача:** Экспортировать login-effect.

**Действия:**

- [ ] В `packages/feature-auth/src/effects/index.ts`:
  - Экспортировать `createLoginEffect` или `loginEffect`
  - ❌ Не экспортировать внутренние мапперы и updater по умолчанию
  - (Только если это часть public API — экспортировать явно)

**Критерии готовности:**

- ✅ login-effect доступен через public API
- ✅ Внутренние модули не экспортируются по умолчанию

---

## 1️⃣2️⃣ Проверить архитектурные инварианты (Staff+ checklist)

**Задача:** Финальная проверка всех требований.

**Чек-лист:**

- [ ] ❌ Нет `Record` в domain
- [ ] ❌ Нет `console.*`
- [ ] ❌ Нет бизнес-логики в orchestrator
- [ ] ❌ Нет fallback-значений
- [ ] ❌ Нет дублирования risk-policy
- [ ] ❌ Нет нескольких уровней таймаутов
- [ ] ❌ Нет пересечения transport DTO и domain типов
- [ ] ❌ Нет mutable объектов в domain
- [ ] ❌ Нет прямых вызовов `Date.now()` и `new Date()` внутри effect-цепочки (используется `clock` из DI)
- [ ] ❌ Нет implicit `any` в effect-цепочке и orchestrator
- [ ] ✅ Deterministic
- [ ] ✅ Fail-closed security
- [ ] ✅ Rule-engine масштабируем
- [ ] ✅ Store — единственный владелец состояния
- [ ] ✅ Schema-validated boundary

**Критерии готовности:**

- ✅ Все пункты чек-листа пройдены
- ✅ Код готов к code review

---

## Порядок выполнения

**Рекомендуемая последовательность:**

1. **Пункты 1-3** (контракт, domain, DI) — сначала, до реализации
2. **Пункты 4-6** (мапперы, updater, policy) — вспомогательные модули
3. **Пункт 7** (основной orchestrator) — использует всё выше
4. **Пункты 8-10** (интеграции) — финальная интеграция
5. **Пункты 11-12** (API и проверка) — завершение

---

**Дата создания:** 2025-01-XX\
**Версия:** 1.0\
**Статус:** Планирование
