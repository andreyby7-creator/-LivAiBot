# 🚀 ФАЗА 2 — UI Platform (Web + PWA)

**Цель:** построить frontend runtime для AI-платформы, который:

- управляет AI-агентами
- поддерживает real-time диалоги
- работает с RAG / tool-calling
- оркестрирует UI-процессы
- масштабируется для интеграций

## 📦 Базовые технологические принципы

**Zod 4.x** → runtime‑контракты frontend ↔ backend (DTO-валидация, schema-guards, API pipelines)

**Effect 3.x** → runtime для всех side-effects (API, WebSocket/SSE, retry/cancellation, telemetry, orchestration, timeout/isolation), реализован в `@livai/core` и используется в UI через адаптеры `@livai/app`.

**Zustand 5.x** → глобальный UI state, feature-stores, persistence и lifecycle reset через единый root store.

**Next.js App Router + next-intl** → i18n с первого дня (en/ru, locale routing, без hydration flicker).

Server Components используются только как layout/data boundaries.\
Бизнес-логика и side-effects выполняются на клиенте через `app` и `feature` слои.

## 📊 Фактическое состояние системы

| Слой           | Состояние                 | Комментарий                                  |
| -------------- | ------------------------- | -------------------------------------------- |
| UI primitives  | 🟢 реализовано            | `ui-core` + базовая UI-инфраструктура        |
| App runtime    | 🟢 реализовано            | store, providers, hooks, runtime utilities   |
| Feature domain | 🟡 частично               | auth / bots / chat реализованы, UI не полный |
| UI features    | 🟡 частично               | базовые экраны и сценарии                    |
| Real-time      | 🟡 инфраструктура готова  | WS / SSE клиенты есть                        |
| PWA / offline  | 🟡 базовая инфраструктура | service worker и offline cache               |

**Фундамент платформы уже реализован.**

## 🧱 Архитектура пакетов

Слои строятся строго снизу вверх:

```
core-contracts
      ↓
ui-core
      ↓
ui-shared
      ↓
app
      ↓
feature-*
      ↓
ui-features
      ↓
apps/web
```

**Ограничения зависимостей:**

- `ui-core` → только UI primitives
- `ui-features` → не работает напрямую с API
- `feature-*` → бизнес-логика и side-effects
- `app` → runtime и точка композиции

Импортные границы контролируются ESLint architectural rules.

## 🧩 Назначение слоёв

**Core**

- `core-contracts` → канонические DTO, roles, permissions, ID-типы

**UI**

- `ui-core` → атомарные UI-компоненты без бизнес-логики
- `ui-shared` → UI-инфраструктура (helpers, design tokens, shared components)

**App runtime**

- `app` → runtime слой приложения:
  - Zustand root store
  - providers и hooks façade
  - API clients + WebSocket / SSE
  - telemetry и feature flags
  - error mapping
  - offline cache + service worker

Этот слой соединяет UI и domain features.

**Domain features**

- `feature-auth` → login, register, refresh tokens, guards
- `feature-bots` → создание и управление AI-ботами
- `feature-chat` → real-time диалоги и сообщения

**UI scenarios**

- `ui-features` → пользовательские сценарии (страницы, формы, workflows)

**Application**

- `apps/web` → тонкий Next.js слой (routing, layouts, i18n, подключение `AppProviders`)

Без бизнес-логики.

## ⚙️ Платформенные механизмы

### **Feature Flags**

Контролируемый rollout UI и платформенных возможностей:

- включение новых UI
- real-time функций
- A/B rollout

### **Error Handling**

Централизованный mapping:

```
Backend errors
      ↓
Effect errors
      ↓
UI error mapping
      ↓
Toast / UI feedback
```

### **Runtime Orchestration**

Все side-effects проходят через:

- orchestrator
- timeout / isolation
- schema validation

Это обеспечивает единое поведение ошибок, безопасные side-effects и контролируемые pipeline.

## 🧠 Итог

Фаза 2 формирует frontend runtime AI-платформы, а не обычное SPA.

## 📁 Структура файлов и порядок реализации

Формат строки: file — status — type — deps — описание

Легенда: 🟢 реализовано, 🟡 частично, ⚪ запланировано

### **Core-contracts / domain** ✅

- 🟢 `common.ts` — ts — deps: @livai/core-contracts базовые доменные типы: UUID, даты, money, pagination, audit, decision-типы
- 🟢 `telemetry.ts` — ts — deps: — контракты телеметрии: события, метрики, correlation ids
- 🟢 `app-effects.ts` — ts — deps: common — общие типы для Effect-пайплайнов: ApiRequestContext, ApiError, ApiResponse
- 🟢 `auth.ts` — ts — deps: common — DTO auth домена: пользователи, сессии, токены, workspace-контекст
- 🟢 `bots.ts` — ts — deps: common — DTO для ботов: Bot, BotTemplate, Prompt, настройки и статусы
- 🟢 `conversations.ts` — ts — deps: common — DTO диалогов: Conversation, Message, attachments, handoff/feedback

### **Core-contracts / errors** ✅

- 🟢 `http.ts` — ts — deps: — HTTP-ошибки: HttpStatusCode, ErrorCode, ErrorResponse контракт

### **Core-contracts / context** ✅

- 🟢 `headers.ts` — ts — deps: — стандартизированные HTTP-заголовки: traceId, workspaceId, userId, correlationId
- 🟢 `http-contracts.ts` — ts — deps: — HttpMethod, ServiceName, базовые HTTP-контракты между сервисами

### **Core-contracts / validation (Zod)** ✅

- 🟢 `transform.ts` — ts — deps: — утилиты трансформации схем/результатов Zod
- 🟢 `validate.ts` — ts — deps: zod — унифицированные врапперы для runtime-валидации DTO
- 🟢 `effect.ts` — ts+effect — deps: zod — утилиты для интеграции Zod с Effect-пайплайнами
- 🟢 `i18n.ts` — ts — deps: zod — i18n-расширения: локализованные сообщения валидации
- 🟢 `forms.ts` — ts — deps: zod — паттерны для сложных форм: step-формы, вложенные структуры
- 🟢 `conditional.ts` — ts — deps: zod — условная валидация: when/then/else для DTO
- 🟢 `auth.ts` — ts — deps: zod — автогенерированные Zod-схемы auth DTO из OpenAPI
- 🟢 `bots.ts` — ts — deps: zod — схемы для ботов/шаблонов/промптов
- 🟢 `conversations.ts` — ts — deps: zod — схемы для диалогов/сообщений/feedback

### **Core** ✅

- 🟢 `hash.ts` — ts — deps: — универсальные утилиты хеширования для core-слоя

### **Core / data-safety** ✅

- 🟢 `sanitization-mode.ts` — ts — deps: — режимы санитизации данных (strict/relaxed и др.)
- 🟢 `structural-clone.ts` — ts — deps: — безопасный структурный клон для сложных структур
- 🟢 `taint.ts` — ts — deps: data-safety/trust-level — базовая модель taint-меток для отслеживания «загрязнённых» данных
- 🟢 `taint-source.ts` — ts — deps: data-safety/taint, data-safety/sanitization-mode, data-safety/trust-level — источники taint-данных
- 🟢 `taint-sink.ts` — ts — deps: data-safety/taint, data-safety/trust-level — точки приёма taint-данных (sinks)
- 🟢 `taint-propagation.ts` — ts — deps: data-safety/taint, data-safety/trust-level — правила распространения taint-меток по данным
- 🟢 `trust-level.ts` — ts — deps: — уровни доверия к данным и источникам

### **Core / domain-kit** ✅

- 🟢 `label.ts` — ts — deps: — типы меток для доменных сущностей и событий
- 🟢 `confidence.ts` — ts — deps: — уровни уверенности (confidence) для оценок/предсказаний
- 🟢 `evaluation-level.ts` — ts — deps: — уровни оценивания качества (evaluation levels)

### **Core / state-kit** ✅

- 🟢 `persist.ts` — ts — deps: — persist helpers (`mergePreservingActions`, `createNoopStorage`)
- 🟢 `operation.ts` — ts — deps: — `OperationState` (idle/loading/success/error) + конструкторы и type guards
- 🟢 `updater.ts` — ts — deps: — `applyUpdater` (чистое функциональное обновление state с referential equality)
- 🟢 `version.ts` — ts — deps: — helpers для версий (`compareVersion`, `assertVersionEqual`, `isVersionMismatch`)

### **Core / aggregation** ✅

- 🟢 `reducer.ts` — ts — deps: — базовые редьюсеры для агрегирования результатов и метрик
- 🟢 `scoring.ts` — ts — deps: — вычисление скоров и оценок на основе агрегированных данных
- 🟢 `weight.ts` — ts — deps: — веса и взвешивание сигналов/метрик при агрегировании

### **Core / rule engine** ✅

- 🟢 `predicate.ts` — ts — deps: — декларативные предикаты (условия) для правил
- 🟢 `rule.ts` — ts — deps: rule-engine/predicate — модель правила (conditions + actions)
- 🟢 `evaluator.ts` — ts — deps: rule-engine/rule — движок исполнения правил

### **Core / feature flags** ✅

- 🟢 `core.ts` — ts — deps: core/hash, core/effect — ядро feature-flag системы (storage, evaluation, targeting)
- 🟢 `react.tsx` — tsx+react — deps: feature-flags/core — React-провайдеры и хуки для работы с feature flags

### **Core / pipelines** ✅

- 🟢 `engine.ts` — ts — deps: pipeline/plan, pipeline/plugin-api — ядро pipeline-движка (исполнение шагов, state machine)
- 🟢 `adapter.ts` — ts — deps: — адаптеры для интеграции pipeline с внешними слоями
- 🟢 `plan.ts` — ts — deps: pipeline/plugin-api — декларативные планы pipeline (steps, branching, retries)
- 🟢 `plugin-api.ts` — ts — deps: — API для плагинов pipeline-движка
- 🟢 `feature-flags.ts` — ts — deps: core/hash — интеграционный слой, связывающий pipeline с feature flags
- 🟢 `runtime-overrides.ts` — ts — deps: — runtime-переопределения поведения pipeline (debug/experiments)
- 🟢 `replay.ts` — ts — deps: — механизм реплея выполненных pipeline для отладки
- 🟢 `safety-guard.ts` — ts — deps: — защитные проверки безопасности данных в pipeline
- 🟢 `errors.ts` — ts — deps: pipeline/plugin-api — специализированные ошибки pipeline-уровня

### **Core / transport** ✅

- 🟢 `sse-client.ts` — ts+effect — deps: core/effect — клиент для Server-Sent Events
- 🟢 `websocket.ts` — ts+effect — deps: core/effect — клиент для WebSocket-соединений

### **Core / effect runtime** ✅

- 🟢 `effect-utils.ts` — ts+effect — deps: core-contracts — базовые утилиты для работы с Effect runtime
- 🟢 `effect-timeout.ts` — ts+effect — deps: effect/effect-utils — таймауты для эффектов и управление временем выполнения
- 🟢 `effect-isolation.ts` — ts+effect — deps: effect/effect-utils — изоляция эффектов (sandboxing, cancellation)
- 🟢 `schema-validated-effect.ts` — ts+effect — deps: effect/effect-utils, effect/error-mapping, effect/validation — эффекты с проверкой схем (schema-first pipelines)
- 🟢 `validation.ts` — ts+effect — deps: core-contracts, effect/error-mapping — композиция валидации и эффектов
- 🟢 `orchestrator.ts` — ts+effect — deps: effect/effect-utils, effect/effect-isolation, effect/effect-timeout — оркестратор side-effects (steps, retries, orchestration)
- 🟢 `offline-cache.ts` — ts+effect — deps: effect/effect-utils — оффлайн-кэш для API-запросов и runtime-событий
- 🟢 `error-mapping.ts` — ts+effect — deps: core-contracts, effect/effect-utils — маппинг ошибок backend → Effect → UI/runtime

### **Core / telemetry** ✅

- 🟢 `batch-core.ts` — ts — deps: core-contracts, telemetry/sanitization — батчинг телеметрии и событий
- 🟢 `client.ts` — ts — deps: core-contracts, telemetry/sanitization — клиент телеметрии для отправки событий и метрик
- 🟢 `sanitization.ts` — ts — deps: core-contracts — санитизация данных перед отправкой телеметрии
- 🟢 `sinks.ts` — ts — deps: core-contracts — sinks для вывода телеметрии (консоль, external APM и др.)

### **Core / performance** ✅

- 🟢 `core.ts` — ts — deps: core-contracts, core/hash — ядро измерения производительности (таймеры, метрики, профайлинг)
- 🟢 `react.tsx` — tsx+react — deps: performance/core — React-хуки и компоненты для измерения производительности UI

### **Core / resilience** ✅

- 🟢 `circuit-breaker.ts` — ts — deps: — circuit breaker для внешних вызовов
- 🟢 `metrics.ts` — ts — deps: — метрики устойчивости (ошибки, retries, latency)
- 🟢 `performance-limits.ts` — ts — deps: resilience/metrics — ограничение нагрузки и лимиты производительности
- 🟢 `retry-policy.ts` — ts — deps: — generic retry-policy primitive (RetryPolicy<T>, createRetryPolicy, mergeRetryPolicies, getRetryable) для deterministic retryability lookup в feature-пакетах, используется в AuthRetry/BotRetry/ChatRetry для централизованной политики ретраев

### **Core / policies** ✅

- 🟢 `AuthPolicy.ts` — ts — deps: core-contracts — политика доступа для auth-домена
- 🟢 `BillingPolicy.ts` — ts — deps: core-contracts — политика биллинга
- 🟢 `BotPolicy.ts` — ts — deps: core-contracts — политика управления ботами
- 🟢 `ChatPolicy.ts` — ts — deps: core-contracts — политика для чата и диалогов
- 🟢 `BotPermissions.ts` — ts — deps: core-contracts, policies/BotPolicy — низкоуровневые разрешения для ботов
- 🟢 `ComposedPolicy.ts` — ts — deps: core-contracts, policies/AuthPolicy, policies/BillingPolicy, policies/BotPermissions, policies/BotPolicy, policies/ChatPolicy — композиция нескольких политик в единый объект

### **Core / input boundary** ✅

- 🟢 `generic-validation.ts` — ts — deps: core-contracts — общие валидаторы входящих данных
- 🟢 `api-schema-guard.ts` — ts+effect — deps: core/effect, core-contracts, input-boundary/api-validation-runtime — schema-guards для API входов
- 🟢 `api-validation-runtime.ts` — ts+effect — deps: core/effect, core-contracts, effect/schema-validated-effect, core/hash — runtime-валидация API-запросов
- 🟢 `context-enricher.ts` — ts — deps: input-boundary/generic-validation — обогащение контекста запросов (trace/workspace/user)
- 🟢 `projection-engine.ts` — ts — deps: input-boundary/generic-validation — проекции DTO в доменные модели и обратно

### **Core / access control** ✅

- 🟢 `auth-guard.ts` — ts+effect — deps: core/effect, core-contracts — базовый guard доступа
- 🟢 `route-permissions.ts` — ts — deps: core-contracts, access-control/auth-guard — разрешения на уровне маршрутов
- 🟢 `auth-guard.react.tsx` — tsx+react — deps: access-control/auth-guard — React-компоненты и хуки для guard-ов

### **Domains / classification** ✅

- 🟢 `constants.ts` — ts — deps: @livai/core — константы и базовые типы домена классификации
- 🟢 `labels.ts` — ts — deps: @livai/core — labels и value-объекты классификации
- 🟢 `signals/signals.ts` — ts — deps: @livai/core, domains/classification/constants, domains/classification/labels — domain-specific сигналы и слоты
- 🟢 `signals/violations.ts` — ts — deps: domains/classification/constants, domains/classification/signals/signals — правила и типы нарушений для классификации
- 🟢 `context/context-builders.ts` — ts — deps: domains/classification/aggregation/scoring, domains/classification/constants, domains/classification/evaluation/assessment, domains/classification/signals/signals, domains/classification/strategies/config, domains/classification/strategies/rules — context-builders для сборки контекстов классификации
- 🟢 `strategies/config.ts` — ts — deps: — конфигурация стратегий классификации (ruleset, weights)
- 🟢 `strategies/rules.ts` — ts — deps: domains/classification/constants, domains/classification/signals/signals, domains/classification/strategies/config — декларативные правила классификации
- 🟢 `strategies/assessment.ts` — ts — deps: domains/classification/aggregation/scoring, domains/classification/evaluation/assessment, domains/classification/evaluation/result, domains/classification/policies/base.policy, domains/classification/signals/signals, domains/classification/signals/violations, domains/classification/strategies/config, domains/classification/strategies/deterministic.strategy, domains/classification/strategies/rules — стратегии оценки на основе правил
- 🟢 `strategies/validation.ts` — ts — deps: domains/classification/signals/signals, domains/classification/signals/violations — валидация входных сигналов и контекста
- 🟢 `strategies/deterministic.strategy.ts` — ts — deps: @livai/core, domains/classification/context/context-builders, domains/classification/evaluation/assessment, domains/classification/evaluation/result, domains/classification/policies/base.policy, domains/classification/signals/signals, domains/classification/signals/violations, domains/classification/strategies/config, domains/classification/strategies/rules, domains/classification/strategies/validation — детерминированная стратегия классификации
- 🟢 `evaluation/assessment.ts` — ts — deps: @livai/core, domains/classification/constants, domains/classification/policies/base.policy, domains/classification/signals/signals, domains/classification/signals/violations, domains/classification/strategies/rules, domains/classification/evaluation/result — сборка финальной оценки (assessment)
- 🟢 `evaluation/result.ts` — ts — deps: @livai/core, domains/classification/labels, domains/classification/policies/base.policy, domains/classification/signals/signals, domains/classification/strategies/rules — финальный результат классификации
- 🟢 `aggregation/scoring.ts` — ts — deps: ipaddr.js, domains/classification/constants, domains/classification/signals/signals, domains/classification/strategies/config, domains/classification/strategies/rules — расчёт risk score и агрегирование сигналов
- 🟢 `policies/base.policy.ts` — ts — deps: domains/classification/labels, domains/classification/signals/signals — базовый класс для политик классификации
- 🟢 `policies/aggregation.policy.ts` — ts — deps: domains/classification/policies/aggregation.strategy — политика агрегирования risk score
- 🟢 `policies/aggregation.strategy.ts` — ts — deps: domains/classification/policies/base.policy — стратегия агрегирования в рамках политики
- 🟢 `providers/remote.provider.ts` — ts — deps: @livai/core, domains/classification/signals/signals, domains/classification/strategies/rules — remote-провайдер для интеграции домена классификации в pipeline

### **Feature-auth / types** ✅

- 🟢 `types/auth-initial.ts` — ts — deps: types/auth, types/auth-risk — канонические начальные состояния Auth/Security/Session для reset-операций в store/effects
- 🟢 `types/auth-risk.ts` — ts — deps: @livai/domains/aggregation, @livai/domains/policies, @livai/domains/signals, @livai/domains/strategies, domain/LoginRiskAssessment — auth-специфичные типы risk-сигналов, контекста и результатов оценки риска, адаптер поверх domains
- 🟢 `types/auth.ts` — ts — deps: @livai/core-contracts, @livai/domains/policies, contracts/AuthErrorResponse, contracts/OAuthErrorResponse, domain/AuthAuditEvent, domain/DeviceInfo, domain/LoginRiskAssessment, domain/MfaInfo, domain/SessionPolicy, dto/* — агрегирующие типы состояния, команд, событий и операций аутентификации для store/effects/UI
- 🟢 `types/login.dto.ts` — ts — deps: schemas/index — feature-level DTO результата login-flow (LoginResponseDto) и type-guards без доменной логики

### **Feature-auth / domain** ✅

- 🟢 `AuthAuditEvent.ts` — ts — deps: — доменные события аудита аутентификации для SIEM/логирования
- 🟢 `ClientContext.ts` — ts — deps: — типизированный клиентский контекст (ip/geo/device/session) для auth-запросов
- 🟢 `DeviceInfo.ts` — ts — deps: — доменная модель устройства клиента для аудита и политик сессий
- 🟢 `LoginRiskAssessment.ts` — ts — deps: @livai/domains/policies — доменная модель оценки риска логина, причин и решений политики (DomainValidationError.value ограничен примитивами string | number | boolean для избежания утечек)
- 🟢 `MfaInfo.ts` — ts — deps: — доменная модель настроек и статуса MFA
- 🟢 `SessionPolicy.ts` — ts — deps: — доменная политика сессий (TTL, geo/ip-ограничения, лимиты)
- 🟢 `AuthRetry.ts` — ts — deps: @livai/core/resilience, contracts/AuthErrorResponse, contracts/OAuthErrorResponse — централизованные retry-политики для AuthErrorType и OAuthErrorType (AuthRetryPolicy/OAuthRetryPolicy + getAuthRetryable/getOAuthRetryable/merge* для overrides; edge-case unknown_error всегда non-retryable)

### **Feature-auth / contracts** ✅

- 🟢 `AuthErrorResponse.ts` — ts — deps: — нормализованный контракт ошибок аутентификации backend (строгий union AuthErrorType, обязательный retryable: boolean без transport-деталей)
- 🟢 `OAuthErrorResponse.ts` — ts — deps: — доменный контракт ошибок OAuth-провайдеров (строгий union OAuthErrorType, обязательный retryable: boolean без transport-деталей)

### **Feature-auth / dto** ✅

- 🟢 `EmailTemplateRequest.ts` — ts — deps: — DTO запросов на отправку auth email-шаблонов
- 🟢 `LoginRequest.ts` — ts — deps: domain/ClientContext, domain/MfaInfo — доменный DTO запроса логина с универсальным идентификатором
- 🟢 `LoginResult.ts` — ts — deps: dto/MeResponse, dto/MfaChallengeRequest, dto/TokenPair — domain-level результат login-flow (успех/ошибка/требование MFA)
- 🟢 `LogoutRequest.ts` — ts — deps: domain/ClientContext — DTO запроса logout с контекстом клиента/сессии
- 🟢 `MeResponse.ts` — ts — deps: — доменный ответ «текущий пользователь» с ролями, правами и сессией
- 🟢 `MfaBackupCodeRequest.ts` — ts — deps: — DTO использования backup-кода MFA
- 🟢 `MfaChallengeRequest.ts` — ts — deps: domain/MfaInfo — DTO вызова MFA-challenge (totp/sms/email/push)
- 🟢 `MfaRecoveryRequest.ts` — ts — deps: — DTO восстановления доступа через MFA-recovery
- 🟢 `MfaSetupRequest.ts` — ts — deps: domain/MfaInfo — DTO настройки MFA-методов
- 🟢 `OAuthLoginRequest.ts` — ts — deps: contracts/OAuthErrorResponse, domain/ClientContext — DTO OAuth-login (provider/code/state/redirectUri)
- 🟢 `OAuthRegisterRequest.ts` — ts — deps: contracts/OAuthErrorResponse, domain/ClientContext — DTO регистрации через OAuth с workspace-контекстом
- 🟢 `PasswordResetConfirm.ts` — ts — deps: domain/ClientContext — DTO подтверждения сброса пароля по токену
- 🟢 `PasswordResetRequest.ts` — ts — deps: domain/ClientContext — DTO запроса на сброс пароля с clientContext
- 🟢 `RefreshTokenRequest.ts` — ts — deps: domain/ClientContext — DTO запроса refresh токенов с clientContext
- 🟢 `RegisterRequest.ts` — ts — deps: domain/ClientContext, domain/MfaInfo — DTO регистрации пользователя и workspace
- 🟢 `RegisterResponse.ts` — ts — deps: domain/ClientContext, domain/MfaInfo, dto/TokenPair — доменный ответ регистрации с user/workspace/token данными
- 🟢 `SessionRevokeRequest.ts` — ts — deps: — DTO отзыва сессии с причиной
- 🟢 `SmsTemplateRequest.ts` — ts — deps: — DTO запросов на отправку auth SMS-шаблонов
- 🟢 `TokenPair.ts` — ts — deps: — доменная модель пары токенов (access/refresh) и метаданных
- 🟢 `VerifyEmailRequest.ts` — ts — deps: domain/ClientContext — DTO подтверждения email с clientContext
- 🟢 `VerifyPhoneRequest.ts` — ts — deps: domain/ClientContext — DTO подтверждения телефона с кодом и clientContext

### **Feature-auth / schemas** ✅

- 🟢 `schemas.ts` — ts — deps: zod, @livai/core-contracts/validation/zod — Zod-схемы и inferred-типы для всех auth DTO (login/register/MFA/risk/session/oauth/errors)

### **Feature-auth / lib** ✅

- 🟢 `classification-mapper.ts` — ts — deps: @livai/domains/labels, @livai/domains/policies, @livai/domains/strategies — маппинг результатов классификации/риска из domains в auth-специфичные решения и DTO
- 🟢 `device-fingerprint.ts` — ts+effect — deps: domain/DeviceInfo — формирование/валидация device fingerprint и безопасная обработка device-метаданных
- 🟢 `error-mapper.ts` — ts+effect — deps: @livai/core/effect, contracts/AuthErrorResponse, contracts/OAuthErrorResponse, domain/MfaInfo, dto/SessionRevokeRequest, types/auth — маппинг transport/domain ошибок в нормализованный AuthError и UI-дружественные коды
- 🟢 `risk-assessment.adapter.ts` — ts — deps: ipaddr.js, @livai/domains/strategies, domain/DeviceInfo, domain/LoginRiskAssessment, types/auth — адаптер между domains/classification и feature-auth risk-моделью (LoginRiskAssessment)
- 🟢 `risk-assessment.ts` — ts — deps: @livai/domains/aggregation, @livai/domains/policies, @livai/domains/signals, @livai/domains/strategies, domain/DeviceInfo, domain/LoginRiskAssessment, types/auth-risk, lib/classification-mapper, lib/risk-assessment.adapter — оркестрация оценки риска логина на основе сигналов, политик и результатов доменного движка
- 🟢 `security-pipeline.ts` — ts+effect — deps: @livai/core/effect, domain/DeviceInfo, domain/LoginRiskAssessment, types/auth, types/auth-risk, lib/device-fingerprint, lib/risk-assessment — декларативный security-pipeline для login/register/refresh с поддержкой плагинов и audit
- 🟢 `session-manager.ts` — ts — deps: @livai/core, @livai/core-contracts, domain/SessionPolicy, types/auth — domain-pure менеджер жизненного цикла сессий (TTL, refresh, concurrent limits, policy checks)

### **Feature-auth / stores** ✅

- 🟢 `auth.ts` — ts — deps: type-fest, zustand, types/auth — централизованный Zustand-store состояния аутентификации/MFA/безопасности/сессий без side-effects (effects используют store только через порты из effects/shared/auth-store.port.ts)

### **Feature-auth / effects** ✅

- 🟢 `shared/api-client.adapter.ts` — ts+effect — deps: @livai/core/effect, effects/shared/api-client.port — адаптер HTTP-клиента под Effect-пайплайны и auth-схемы
- 🟢 `shared/api-client.port.ts` — ts+effect — deps: @livai/core/effect — портовый контракт AuthApiClientPort для DI (login/register/logout/refresh)
- 🟢 `shared/auth-api.mappers.ts` — ts — deps: dto/MeResponse, dto/TokenPair, schemas/index — мапперы HTTP-ответов backend → domain/feature-уровень (TokenPair/Me/AuthError)
- 🟢 `shared/auth-store.port.ts` — ts — deps: stores/auth, types/auth — портовый контракт доступа к auth-store из эффектов (Port pattern для изоляции effects от реализации store)
- 🟢 `shared/session-state.builder.ts` — ts — deps: @livai/core-contracts, domain/DeviceInfo, dto/MeResponse, dto/TokenPair, types/auth — построитель SessionState из API-ответов/политик для store
- 🟢 `login/login-api.mapper.ts` — ts — deps: domain/MfaInfo, dto/LoginRequest, dto/LoginResult, dto/MfaChallengeRequest, schemas/index, types/login.dto, effects/shared/auth-api.mappers — маппинг step-результатов login API (login/me) в LoginResponseDto/AuthState
- 🟢 `login/login-audit.mapper.ts` — ts — deps: dto/LoginResult, schemas/index, types/auth, login/login-effect.types, login/login-metadata.enricher — построение audit-событий login_success/login_failure/risk_detected
- 🟢 `login/login-effect.types.ts` — ts+effect — deps: lib/security-pipeline, schemas/index, types/auth, types/auth-risk, effects/shared/api-client.port, effects/shared/auth-store.port — DI-контракты, порты и конфигурация login-effect (security pipeline, audit, clock)
- 🟢 `login/login-metadata.enricher.ts` — ts — deps: @livai/core, @livai/domains/policies, domain/DeviceInfo, dto/LoginRequest — обогащение login-метаданных (risk, device, policy) для audit/store
- 🟢 `login/login-store-updater.ts` — ts — deps: dto/LoginResult, lib/security-pipeline, types/auth-risk, effects/shared/auth-store.port, effects/shared/session-state.builder, login/login-metadata.enricher — pure-обновления auth-store по результатам login-flow
- 🟢 `login/validation.ts` — ts — deps: dto/LoginRequest — валидация входных данных login-flow и contract-level проверки
- 🟢 `logout/logout-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий logout/session_revoked
- 🟢 `logout/logout-effect.types.ts` — ts — deps: lib/security-pipeline, schemas/index, types/auth, types/auth-risk, effects/shared/api-client.port, effects/shared/auth-store.port — DI-контракты и конфигурация logout-effect
- 🟢 `logout/logout-store-updater.ts` — ts — deps: types/auth, types/auth-initial, effects/shared/auth-store.port — pure-обновления auth-store при logout/ревокации сессий
- 🟢 `refresh/refresh-api.mapper.ts` — ts — deps: dto/MeResponse, dto/TokenPair, schemas/index, types/auth, effects/shared/auth-api.mappers — маппинг ответов refresh API в TokenPair/SessionState
- 🟢 `refresh/refresh-audit.mapper.ts` — ts — deps: schemas/index, types/auth, refresh/refresh-effect.types — audit-события для token_refresh/session_refresh
- 🟢 `refresh/refresh-effect.types.ts` — ts — deps: @livai/core-contracts, schemas/index, types/auth, effects/shared/api-client.port, effects/shared/auth-store.port — DI-контракты и конфигурация refresh-effect
- 🟢 `refresh/refresh-store-updater.ts` — ts — deps: domain/DeviceInfo, dto/MeResponse, dto/TokenPair, types/auth, types/auth-initial, effects/shared/auth-store.port, effects/shared/session-state.builder, refresh/refresh-effect.types — pure-обновления auth-store при успешном refresh токенов/сессий
- 🟢 `register/register-api.mapper.ts` — ts — deps: dto/OAuthRegisterRequest, dto/RegisterRequest, dto/RegisterResponse, schemas/index, effects/shared/auth-api.mappers — маппинг ответов регистрации в RegisterResponse/Me/SessionState
- 🟢 `register/register-audit.mapper.ts` — ts — deps: zod, domain/DeviceInfo, dto/RegisterRequest, dto/RegisterResponse, schemas/index, types/auth — audit-события регистрации (oauth/password), policy-violations
- 🟢 `register/register-effect.types.ts` — ts — deps: schemas/index, types/auth, login/login-effect.types, effects/shared/api-client.port, effects/shared/auth-store.port — DI-контракты и конфигурация register-effect
- 🟢 `register/register-metadata.enricher.ts` — ts — deps: dto/RegisterRequest — обогащение метаданных регистрации (workspace, device, risk)
- 🟢 `register/register-store-updater.ts` — ts — deps: domain/DeviceInfo, dto/MeResponse, dto/RegisterRequest, dto/RegisterResponse, dto/TokenPair, types/auth, types/auth-initial, effects/shared/auth-store.port, effects/shared/session-state.builder — pure-обновления auth-store и начальной сессии после регистрации
- 🟢 `login.ts` — ts+effect — deps: @livai/core/effect, dto/LoginRequest, dto/LoginResult, schemas/index, types/auth, types/login.dto, login/login-api.mapper, login/login-audit.mapper, login/login-effect.types, login/login-metadata.enricher, login/login-store-updater — оркестратор login-flow на Effect (валидация → security-pipeline → API → store/audit)
- 🟢 `logout.ts` — ts+effect — deps: @livai/core/effect, types/auth, logout/logout-audit.mapper, logout/logout-effect.types, logout/logout-store-updater, effects/shared/auth-store.port — оркестратор logout-flow (ревокация токенов/сессий + обновление store/audit)
- 🟢 `refresh.ts` — ts+effect — deps: @livai/core/effect, domain/DeviceInfo, schemas/index, types/auth, refresh/refresh-api.mapper, refresh/refresh-audit.mapper, refresh/refresh-effect.types, refresh/refresh-store-updater, effects/shared/auth-store.port — оркестратор refresh-flow (обновление токенов/сессий + security-проверки)
- 🟢 `register.ts` — ts+effect — deps: @livai/core/effect, contracts/AuthErrorResponse, domain/DeviceInfo, dto/RegisterRequest, dto/RegisterResponse, schemas/index, types/auth, register/register-api.mapper, register/register-audit.mapper, register/register-effect.types, register/register-metadata.enricher, register/register-store-updater — оркестратор registration-flow (password/oauth) с audit и инициализацией сессии

### **Feature-auth / effects (запланировано)** ⚪

- ⚪ `forgot-password/forgot-password-effect.types.ts` — ts — deps: shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация forgot-password-effect
- ⚪ `forgot-password/forgot-password-api.mapper.ts` — ts — deps: domain/PasswordResetRequest, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа forgot-password API
- ⚪ `forgot-password/forgot-password-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий password_reset_requested/password_reset_failed
- ⚪ `forgot-password.ts` — ts+effect — deps: lib/_, schemas/index, effects/forgot-password/_ — оркестратор forgot-password-flow (best-effort, не блокирует UI)
- ⚪ `reset-password/reset-password-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация reset-password-effect
- ⚪ `reset-password/reset-password-api.mapper.ts` — ts — deps: domain/PasswordResetConfirm, domain/TokenPair, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа reset-password API (TokenPair)
- ⚪ `reset-password/reset-password-store-updater.ts` — ts — deps: shared/auth-store.port, shared/session-state.builder, types/auth — обновление SessionState при успешном reset-password
- ⚪ `reset-password/reset-password-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий password_reset_success/password_reset_failed
- ⚪ `reset-password.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/reset-password/_ — оркестратор reset-password-flow (fail-closed, создаёт сессию)
- ⚪ `verify-email/verify-email-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация verify-email-effect
- ⚪ `verify-email/verify-email-api.mapper.ts` — ts — deps: domain/VerifyEmailRequest, schemas/index — маппинг запроса/ответа verify-email API
- ⚪ `verify-email/verify-email-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — обновление emailVerified в SessionState
- ⚪ `verify-email/verify-email-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий email_verified/email_verification_failed
- ⚪ `verify-email.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/verify-email/_ — оркестратор verify-email-flow
- ⚪ `verify-phone/verify-phone-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация verify-phone-effect
- ⚪ `verify-phone/verify-phone-api.mapper.ts` — ts — deps: domain/VerifyPhoneRequest, schemas/index — маппинг запроса/ответа verify-phone API
- ⚪ `verify-phone/verify-phone-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — обновление phoneVerified в SessionState
- ⚪ `verify-phone/verify-phone-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий phone_verified/phone_verification_failed
- ⚪ `verify-phone.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/verify-phone/_ — оркестратор verify-phone-flow
- ⚪ `mfa/mfa-challenge-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация mfa-challenge-effect
- ⚪ `mfa/mfa-challenge-api.mapper.ts` — ts — deps: domain/MfaChallengeRequest, domain/TokenPair, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа MFA challenge API (TokenPair)
- ⚪ `mfa/mfa-challenge-store-updater.ts` — ts — deps: shared/auth-store.port, shared/session-state.builder, types/auth — обновление SessionState при успешном MFA challenge
- ⚪ `mfa/mfa-challenge-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий mfa_success/mfa_failure
- ⚪ `mfa-challenge.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/mfa/_ — оркестратор MFA challenge-flow (fail-closed, создаёт сессию)
- ⚪ `mfa/mfa-setup-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация mfa-setup-effect
- ⚪ `mfa/mfa-setup-api.mapper.ts` — ts — deps: domain/MfaSetupRequest, schemas/index — маппинг запроса/ответа MFA setup API
- ⚪ `mfa/mfa-setup-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — обновление mfaEnabled в SessionState
- ⚪ `mfa/mfa-setup-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий mfa_setup_success/mfa_setup_failed
- ⚪ `mfa-setup.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/mfa/_ — оркестратор MFA setup-flow
- ⚪ `mfa/mfa-backup-code-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация mfa-backup-code-effect
- ⚪ `mfa/mfa-backup-code-api.mapper.ts` — ts — deps: domain/MfaBackupCodeRequest, domain/TokenPair, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа MFA backup code API (TokenPair)
- ⚪ `mfa/mfa-backup-code-store-updater.ts` — ts — deps: shared/auth-store.port, shared/session-state.builder, types/auth — обновление SessionState при успешном backup code
- ⚪ `mfa/mfa-backup-code-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий mfa_backup_code_success/mfa_backup_code_failed
- ⚪ `mfa-backup-code.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/mfa/_ — оркестратор MFA backup-code-flow (fail-closed, создаёт сессию)
- ⚪ `oauth/oauth-login-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, lib/security-pipeline, types/auth, lib/error-mapper — DI-контракты и конфигурация oauth-login-effect
- ⚪ `oauth/oauth-login-api.mapper.ts` — ts — deps: domain/OAuthLoginRequest, domain/TokenPair, domain/MeResponse, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа OAuth login API (TokenPair, MeResponse)
- ⚪ `oauth/oauth-login-store-updater.ts` — ts — deps: shared/auth-store.port, shared/session-state.builder, lib/security-pipeline, types/auth — обновление SessionState при успешном OAuth login
- ⚪ `oauth/oauth-login-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий oauth_login_success/oauth_login_failure
- ⚪ `oauth-login.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/oauth/_ — оркестратор OAuth login-flow (security-pipeline, fail-closed)
- ⚪ `oauth/oauth-register-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация oauth-register-effect
- ⚪ `oauth/oauth-register-api.mapper.ts` — ts — deps: domain/OAuthRegisterRequest, domain/TokenPair, domain/MeResponse, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа OAuth register API (TokenPair, MeResponse)
- ⚪ `oauth/oauth-register-store-updater.ts` — ts — deps: shared/auth-store.port, shared/session-state.builder, types/auth — обновление SessionState при успешном OAuth register
- ⚪ `oauth/oauth-register-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий oauth_register_success/oauth_register_failure
- ⚪ `oauth-register.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/oauth/_ — оркестратор OAuth register-flow (fail-closed)
- ⚪ `session-revoke/session-revoke-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация session-revoke-effect
- ⚪ `session-revoke/session-revoke-api.mapper.ts` — ts — deps: domain/SessionRevokeRequest, schemas/index — маппинг запроса/ответа session-revoke API
- ⚪ `session-revoke/session-revoke-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — удаление сессии из списка активных сессий
- ⚪ `session-revoke/session-revoke-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий session_revoked/session_revoke_failed
- ⚪ `session-revoke.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/session-revoke/_ — оркестратор session-revoke-flow
- ⚪ `logout-all-sessions.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/logout/_, effects/session-revoke/* — оркестратор logout-all-sessions-flow (revoke всех сессий + logout текущей)
- ⚪ `change-password/change-password-effect.types.ts` — ts — deps: shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация change-password-effect
- ⚪ `change-password/change-password-api.mapper.ts` — ts — deps: domain/*, schemas/index — маппинг запроса/ответа change-password API
- ⚪ `change-password/change-password-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий password_changed/password_change_failed
- ⚪ `change-password.ts` — ts+effect — deps: lib/_, schemas/index, effects/change-password/_ — оркестратор change-password-flow (не обновляет store напрямую)
- ⚪ `update-profile/update-profile-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация update-profile-effect
- ⚪ `update-profile/update-profile-api.mapper.ts` — ts — deps: domain/*, domain/MeResponse, schemas/index, shared/auth-api.mappers — маппинг запроса/ответа update-profile API (MeResponse)
- ⚪ `update-profile/update-profile-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — обновление профиля в SessionState
- ⚪ `update-profile/update-profile-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий profile_updated/profile_update_failed
- ⚪ `update-profile.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/update-profile/_ — оркестратор update-profile-flow (fail-closed)
- ⚪ `session-policy-check/session-policy-check-effect.types.ts` — ts — deps: lib/session-manager, types/auth, @livai/core/policies/AuthPolicy — DI-контракты и конфигурация session-policy-check-effect
- ⚪ `session-policy-check/session-policy-check-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — блокировка сессии при нарушении политики
- ⚪ `session-policy-check.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/session-policy-check/_ — оркестратор session-policy-check-flow (проверка через session-manager)
- ⚪ `proactive-refresh/proactive-refresh-effect.types.ts` — ts — deps: lib/session-manager, effects/refresh/refresh-effect.types, types/auth — DI-контракты и конфигурация proactive-refresh-effect
- ⚪ `proactive-refresh.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/refresh, effects/proactive-refresh/_ — оркестратор proactive-refresh-flow (периодическая проверка shouldRefresh)
- ⚪ `account-lock/account-lock-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация account-lock-effect
- ⚪ `account-lock/account-lock-api.mapper.ts` — ts — deps: domain/*, schemas/index — маппинг запроса/ответа account-lock API
- ⚪ `account-lock/account-lock-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — обновление accountLocked в AuthState, инвалидация всех сессий
- ⚪ `account-lock/account-lock-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий account_locked/account_lock_failed
- ⚪ `account-lock.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/account-lock/_ — оркестратор account-lock-flow (fail-closed)
- ⚪ `account-unblock/account-unblock-effect.types.ts` — ts — deps: shared/auth-store.port, shared/api-client.port, types/auth, lib/error-mapper — DI-контракты и конфигурация account-unblock-effect
- ⚪ `account-unblock/account-unblock-api.mapper.ts` — ts — deps: domain/*, schemas/index — маппинг запроса/ответа account-unblock API
- ⚪ `account-unblock/account-unblock-store-updater.ts` — ts — deps: shared/auth-store.port, types/auth — обновление accountLocked: false в AuthState
- ⚪ `account-unblock/account-unblock-audit.mapper.ts` — ts — deps: schemas/index, types/auth — построение audit-событий account_unblocked/account_unblock_failed
- ⚪ `account-unblock.ts` — ts+effect — deps: lib/_, stores/auth, schemas/index, effects/account-unblock/_ — оркестратор account-unblock-flow (fail-closed)

### **Feature-auth / lib (запланировано)** ⚪

- ⚪ `audit-logger.ts` — ts — deps: schemas/index, types/auth — централизованный audit logger для auth-событий (валидация через auditEventSchema)
- ⚪ `auth-telemetry.ts` — ts — deps: types/auth — telemetry для auth-слоя (метрики производительности, ошибки audit/errorMapper)

### **Feature-bots / types** ✅

- 🟢 `bot-lifecycle.ts` — ts — deps: none — атомарные lifecycle-контракты (BotPauseReason, BotEnforcementReason)
- 🟢 `bot-commands.ts` — ts — deps: @livai/core-contracts, types/bot-lifecycle — типы и константы команд ботов (BotCommandTypes/BotCommandType/AllBotCommandTypes, BotCommand discriminated union + строгие payload'ы для: create_bot_from_template, create_custom_bot, update_instruction, manage_multi_agent, publish_bot, pause_bot, resume_bot, archive_bot, delete_bot, simulate_bot_message)
- 🟢 `bots.ts` — ts — deps: @livai/core-contracts, @livai/core, types/bot-lifecycle — агрегирующие типы для store/effects/UI (BotStatus с 7 вариантами и причинами приостановки, BotError с 7 категориями и severity для telemetry/alerts, exhaustive union BotErrorCode, BotErrorMappingRegistry для rule-engine, BotInfo, store-форма `BotsState` = `{ entities, operations }`, операции `BotsOperations` на базе `OperationState` из core/state-kit с ключами `OperationKey` = create/update/delete)
- 🟢 `bot-events.ts` — ts — deps: @livai/core-contracts, domain/*, types/bots, types/bot-lifecycle — типы и константы domain events ботов для store/effects/UI/event-bus (Single Source of Truth: BotEventPayloadMap → auto-generated BotEventType → discriminated union BotEvent; rule-engine ready: aggregateId/aggregateType для routing; event versioning: schemaVersion в BotEventMeta; 10 событий lifecycle: bot_created/published/updated/deleted, instruction_updated, multi_agent_updated, bot_paused/resumed/archived, config_changed; type guards isBotEvent/isBotEventOfType)
- 🟢 `bots-initial.ts` — ts — deps: @livai/core (types), types/bots, domain/BotAuditEvent, types/bot-events — канонические начальные структуры для store/effects (initialBotsState: `{ entities: {}, operations: idle }`), шаблоны для audit-событий (BotAuditEventTemplateMap auto-generated через satisfies, createBotAuditEventTemplate), pipeline-hooks (initialBotPipelineHookMap, BotPipelineHookMap с приоритетами, registerBotPipelineHook для immutable registration) для автоматических действий при lifecycle-событиях

### **Feature-bots / domain** ✅

- 🟢 `domain/Bot.ts` — ts — deps: @livai/core-contracts — доменная модель бота (Active/Deleted union со статусами draft/active/paused/archived/deleted/suspended/deprecated, branded revision/currentVersion, workspaceId, metadata (non-sensitive only), audit-поля createdAt/updatedAt/deletedAt/createdBy/updatedBy + runtime-инварианты для deletedAt/revision/currentVersion)
- 🟢 `domain/BotSettings.ts` — ts — deps: @livai/core-contracts — доменная модель настроек бота (BotSettings с branded temperature/contextWindow, PII/image-флагами, секции unrecognizedMessage/interruptionRules/extra + runtime-инварианты для temperature/contextWindow/maxSessions/fallbackMessage)
- 🟢 `domain/BotVersion.ts` — ts — deps: @livai/core-contracts, types/bot-commands, domain/Bot, domain/BotSettings — доменная модель версии бота (BotVersionAggregate с version, branded instruction, BotSettingsSnapshot (BotSettings), operationId, workspaceId, audit-поля createdAt/createdBy, metadata для rollback/tags + runtime-инварианты для instruction/settings/version/rollbackFromVersion)
- 🟢 `domain/BotTemplate.ts` — ts — deps: @livai/core-contracts, domain/BotSettings — доменная модель шаблона бота (BotTemplate c id, name, role, description, defaultInstruction, defaultSettings: BotSettings, capabilities (exhaustive union), tags/labels для фильтрации шаблонов + runtime-инварианты для name/defaultInstruction/capabilities/tags/defaultSettings)
- 🟢 `domain/Prompt.ts` — ts — deps: — доменная модель prompt-блоков инструкции (Prompt с branded systemPrompt/greeting/constraints, exhaustive unions PromptLanguage/PromptStyle/HandoffTrigger/HandoffAction/HandoffCondition, HandoffRules с priority и typed conditions, factory createPrompt для нормализации строк через trim + runtime-инварианты для systemPrompt/greeting/constraints/handoffRules дубликаты/priority)
- 🟢 `domain/MultiAgentSchema.ts` — ts — deps: — доменная модель мультиагентной схемы (MultiAgentSchema с agentGraph (nodes/edges), switchRules/callRules (exhaustive unions SwitchTrigger/SwitchCondition/CallTrigger/CallCondition), guardrails (discriminated union Guardrail); branded types AgentId/MaxCallDepth/MaxCallsPerAgent/AgentCallTimeout/RulePriority; exhaustive unions AgentEdgeType/SwitchTrigger/CallTrigger; error type MultiAgentSchemaInvariantError; валидация в lib/multi-agent-validator.ts)
- 🟢 `domain/Publishing.ts` — ts — deps: domain/Bot — доменная модель публикации бота (Publishing с status (exhaustive union draft/active/paused), publishedAt (Timestamp), publishedVersion (BotVersion), rollbackVersion (BotVersion, опционально); error type PublishingInvariantError)
- 🟢 `domain/BotAuditEvent.ts` — ts — deps: domain/Bot — доменная модель событий аудита ботов для SIEM/логирования (BotAuditEvent с exhaustive union BotAuditEventType: bot_created/bot_published/bot_updated/bot_deleted/instruction_updated/multi_agent_updated/config_changed/policy_violation; eventId, botId, workspaceId, timestamp, userId, context; error type BotAuditEventInvariantError; SIEM-ready структура)
- 🟢 `domain/BotRetry.ts` — ts — deps: @livai/core/resilience, types/bots — централизованная retry-политика для BotErrorCode (BotRetryPolicy, getBotRetryable, mergeBotRetryPolicies; validation/policy/permission/parsing — non‑retryable, сетевые channel/webhook/integration ошибки по умолчанию retryable; `BotErrorMappingRegistry.retryable` в tests валидируется против `getBotRetryable(code)` для сохранения единой точки правды)

### **Feature-bots / contracts** ✅

- 🟢 `contracts/BotErrorResponse.ts` — ts — deps: @livai/core-contracts, types/bots — нормализованный контракт ошибок ботов (BotErrorResponse с error (exhaustive union BotErrorType: validation_error/policy_error/permission_error/not_found/unknown_error и детальные коды), code (BotErrorCode), category (BotErrorCategory), severity (BotErrorSeverity), retryable, message, statusCode, context (BotErrorContext), traceId, timestamp)

### **Feature-bots / dto** ✅

- 🟢 `dto/CreateBotRequest.ts` — ts — deps: domain/BotSettings, domain/BotTemplate, domain/BotVersion — DTO создания бота (CreateBotRequest с name, instruction, settings (BotSettings), templateId (BotTemplateId, опционально для from-template))
- 🟢 `dto/UpdateBotMetadataRequest.ts` — ts — deps: domain/Bot — DTO обновления метаданных бота (UpdateBotMetadataRequest с опциональным name через BotMetadataPatch, обязательным currentVersion для optimistic concurrency control, экспортирует AtLeastOne utility type)
- 🟢 `dto/UpdateBotConfigRequest.ts` — ts — deps: domain/BotSettings, domain/BotVersion, types/bot-commands, dto/UpdateBotMetadataRequest — DTO обновления конфигурации бота (UpdateBotConfigRequest с опциональными instruction, settings через BotConfigurationPatch, обязательным operationId для идемпотентности)
- 🟢 `dto/PublishBotRequest.ts` — ts — deps: domain/Bot — DTO публикации бота (PublishBotRequest с опциональными version и rollbackVersion для публикации или rollback к предыдущей версии)
- 🟢 `dto/TestBotRequest.ts` — ts — deps: @livai/core-contracts — DTO тестового запроса к боту (TestBotRequest с обязательным message, опциональными conversationId и context для тестирования бота)

### **Feature-bots / schemas** ✅

- 🟢 `schemas.ts` — ts — deps: zod — Zod-схемы и inferred-типы для bot DTO (create/update/publish/test), multi-agent, template, audit-события; structural refinements (граф, лимиты, уникальность приоритетов)

### **Feature-bots / lib** ✅

- 🟢 `error-mapper.ts` — ts — deps: contracts/BotErrorResponse, types/bots, domain/BotRetry — детерминированный DI rule-engine: boundary/unknown → `BotError`, retryable строго из BotRetryPolicy
- 🟢 `bot-errors.ts` — ts — deps: contracts/BotErrorResponse, types/bots, domain/BotRetry — канонические метаданные `BotErrorCode` + фабрики/нормализация `BotErrorResponse` (anti-drift), retryable строго из BotRetryPolicy
- 🟢 `policy-adapter.ts` — ts — deps: @livai/core, @livai/core-contracts, types/bots, types/bot-commands, types/bot-lifecycle — адаптер core policy → feature-bots (BotMode → BotStatus, BotPolicyAction → BotCommandType) + guards/parsers для boundary
- 🟢 `instruction-builder.ts` — ts — deps: domain/Prompt, domain/BotSettings — детерминированный builder полной instruction-строки из prompt-блоков и настроек (канонический порядок секций + DI-hook `formatSection`)
- 🟢 `multi-agent-validator.ts` — ts — deps: domain/MultiAgentSchema — детерминированный валидатор инвариантов `MultiAgentSchema` (agent isolation, size limits, граф: reachability + cycle detection, rules/guardrails, DI custom plugins) + `assertMultiAgentSchemaInvariant` для boundary (transport/DB mapping, тесты, policy-слой)
- 🟢 `version-manager.ts` — ts — deps: domain/Bot, domain/BotVersion, types/bot-commands — domain-pure version manager: next/rollback `BotVersionAggregate` + applyVersionToBot (детерминированно, без now(), immutable)
- 🟢 `bot-audit.ts` — ts — deps: domain/BotAuditEvent, schemas/index, types/bots — хелперы аудита: runtime validation/normalization (anti-drift), лимит размера payload, structured parsing error + DI emit sink и `onInvalid` hook
- 🟢 `bot-telemetry.ts` — ts — deps: types/bots, @livai/core-contracts — telemetry hooks: pure builders событий метрик (SSOT metric names + allow-listed primitive metadata) + DI sink emit без `Date.now()`
- 🟢 `bot-pipeline.ts` — ts — deps: types/bot-commands, types/bot-events, lib/bot-audit — детерминированный runner pipeline-триггеров (command/event) + DI hooks (`beforePublish`, `afterRollback`, `onCommandExecuted`) + расширение через `rules` и опциональный audit emit

### **Feature-bots / stores** ✅

- 🟢 `helpers/operations.ts` — ts — deps: types/bots — store helper `setOperation` для типобезопасного обновления `bots.operations` без мутаций (key/value связаны через `BotsOperations`)
- 🟢 `bots.ts` — ts — deps: zustand, @livai/core, types/bots, stores/helpers/operations — чистый Zustand-store `BotsStore` (state + sync transitions) без side-effects; SSR-safe factory `createBotsStore`, `createInitialBotsStoreState` и typed actions для обновления `bots.entities`/`bots.operations`

### **Feature-bots / effects** ⚪

- 🟢 `shared/api-client.port.ts` — ts+effect — deps: @livai/core/effect, @livai/core-contracts/validation/zod, domain/Bot, types/bot-commands — port-контракт `BotApiClientPort` (Effect-based) + `RequestContext` + validated transport DTO shapes для boundary effects/transport
- 🟢 `shared/api-client.adapter.ts` — ts+effect — deps: shared/api-client.port, contracts/BotErrorResponse, lib/bot-errors, domain/BotRetry, types/bots, @livai/core-contracts/validation/zod — адаптер legacy HTTP-клиента под `BotApiClientPort`: Zod-валидация + детерминированная нормализация transport-ошибок в `BotErrorResponse` + политика заголовков (`X-Workspace-Id`, `X-Operation-Id`)
- 🟢 `shared/bots-api.mappers.ts` — ts — deps: shared/api-client.port, contracts/BotErrorResponse, lib/bot-errors, types/bots, types/bot-lifecycle — pure мапперы validated transport DTO (`bots-service`) → feature/store модели (`BotInfo`, `BotStatus`); fail-closed на неконсистентных status passthrough-полях
- 🟢 `shared/bots-store.port.ts` — ts — deps: stores/bots, types/bots — port-контракт `BotsStorePort` + adapter для доступа к bots-store из эффектов без зависимости от Zustand; `batchUpdate` (discriminated union) + опциональный lock для критичных последовательностей
- ⚪ `create/create-bot-effect.types.ts` — ts — deps: shared/bots-store.port, shared/api-client.port, @livai/core/policies/BotPolicy, @livai/core/policies/BotPermissions, types/bots, lib/error-mapper — DI-контракты и конфигурация create-bot-effect
- ⚪ `create/create-bot-api.mapper.ts` — ts — deps: domain/CreateBotRequest, domain/Bot, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа create-bot API
- ⚪ `create/create-bot-store-updater.ts` — ts — deps: shared/bots-store.port, types/bots — обновление store при успешном создании бота
- ⚪ `create/create-bot-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий bot_created/bot_create_failed
- ⚪ `create/create-bot-from-template.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/create/_, domain/BotTemplate — оркестратор создания бота из шаблона (U3: выбор шаблона → создание с дефолтными настройками, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `create/create-custom-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/create/_ — оркестратор создания кастомного бота (U4: создание с нуля с базовыми параметрами, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `update/update-bot-effect.types.ts` — ts — deps: shared/bots-store.port, shared/api-client.port, @livai/core/policies/BotPolicy, types/bots, lib/error-mapper — DI-контракты и конфигурация update-bot-effect
- ⚪ `update/update-bot-api.mapper.ts` — ts — deps: domain/UpdateBotRequest, domain/Bot, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа update-bot API
- ⚪ `update/update-bot-store-updater.ts` — ts — deps: shared/bots-store.port, types/bots — обновление store при успешном обновлении бота
- ⚪ `update/update-bot-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий bot_updated/bot_update_failed
- ⚪ `update/update-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/update/_ — оркестратор update-bot-flow (валидация → policy → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `update/update-instruction-effect.types.ts` — ts — deps: shared/bots-store.port, shared/api-client.port, @livai/core/policies/BotPolicy, types/bots, lib/error-mapper, lib/instruction-builder — DI-контракты и конфигурация update-instruction-effect
- ⚪ `update/update-instruction-api.mapper.ts` — ts — deps: domain/UpdateInstructionRequest, domain/BotVersion, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа update-instruction API (версионирование)
- ⚪ `update/update-instruction-store-updater.ts` — ts — deps: shared/bots-store.port, lib/version-manager, types/bots — обновление store и создание новой версии при обновлении инструкции
- ⚪ `update/update-instruction-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий instruction_updated/instruction_update_failed
- ⚪ `update/update-instruction.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/update/_ — оркестратор update-instruction-flow (U5: валидация prompt-блоков → версионирование → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `delete/delete-bot-effect.types.ts` — ts — deps: shared/bots-store.port, shared/api-client.port, @livai/core/policies/BotPolicy, @livai/core/policies/BotPermissions, types/bots, lib/error-mapper — DI-контракты и конфигурация delete-bot-effect
- ⚪ `delete/delete-bot-api.mapper.ts` — ts — deps: domain/*, schemas/index — маппинг запроса/ответа delete-bot API
- ⚪ `delete/delete-bot-store-updater.ts` — ts — deps: shared/bots-store.port, types/bots — удаление бота из store при успешном удалении
- ⚪ `delete/delete-bot-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий bot_deleted/bot_delete_failed
- ⚪ `delete/delete-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/delete/_ — оркестратор delete-bot-flow (policy check → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `publish/publish-bot-effect.types.ts` — ts — deps: shared/bots-store.port, shared/api-client.port, @livai/core/policies/BotPolicy, types/bots, lib/error-mapper — DI-контракты и конфигурация publish-bot-effect
- ⚪ `publish/publish-bot-api.mapper.ts` — ts — deps: domain/PublishBotRequest, domain/Publishing, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа publish-bot API
- ⚪ `publish/publish-bot-store-updater.ts` — ts — deps: shared/bots-store.port, types/bots — обновление статуса бота на active при публикации
- ⚪ `publish/publish-bot-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий bot_published/bot_publish_failed
- ⚪ `publish/publish-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/publish/_ — оркестратор publish-bot-flow (U10: policy check → валидация → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `lifecycle/pause-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/lifecycle/_ — оркестратор pause-bot-flow (перевод в paused статус, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `lifecycle/resume-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/lifecycle/_ — оркестратор resume-bot-flow (возобновление из paused, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `lifecycle/archive-bot.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/lifecycle/_ — оркестратор archive-bot-flow (архивация бота, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `multi-agent/multi-agent-effect.types.ts` — ts — deps: shared/bots-store.port, shared/api-client.port, @livai/core/policies/BotPolicy, types/bots, lib/error-mapper, lib/multi-agent-validator — DI-контракты и конфигурация multi-agent-effect
- ⚪ `multi-agent/multi-agent-api.mapper.ts` — ts — deps: domain/MultiAgentSchema, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа multi-agent API
- ⚪ `multi-agent/multi-agent-store-updater.ts` — ts — deps: shared/bots-store.port, types/bots — обновление multi-agent схемы в store
- ⚪ `multi-agent/multi-agent-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий multi_agent_updated/multi_agent_update_failed
- ⚪ `multi-agent/manage-multi-agent.ts` — ts+effect — deps: lib/_, stores/bots, schemas/index, effects/multi-agent/_ — оркестратор manage-multi-agent-flow (U5.1: валидация схемы → проверка циклов → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `test/test-bot-effect.types.ts` — ts — deps: shared/api-client.port, types/bots, lib/error-mapper — DI-контракты и конфигурация test-bot-effect
- ⚪ `test/test-bot-api.mapper.ts` — ts — deps: domain/TestBotRequest, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа test-bot API (симулятор чата)
- ⚪ `test/test-bot-audit.mapper.ts` — ts — deps: schemas/index, types/bots — построение audit-событий bot_tested/test_failed
- ⚪ `test/test-bot-simulator.ts` — ts+effect — deps: lib/_, schemas/index, effects/test/_ — оркестратор test-bot-simulator-flow (U10: отправка тестового сообщения → получение ответа → валидация)
- ⚪ `templates/templates-effect.types.ts` — ts — deps: shared/api-client.port, types/bots, lib/error-mapper — DI-контракты и конфигурация templates-effect
- ⚪ `templates/templates-api.mapper.ts` — ts — deps: domain/BotTemplate, schemas/index, shared/bots-api.mappers — маппинг запроса/ответа templates API (каталог шаблонов)
- ⚪ `templates/get-templates.ts` — ts+effect — deps: lib/_, schemas/index, effects/templates/_ — оркестратор get-templates-flow (получение каталога шаблонов для U3)

### **Feature-chat / types** ⚪

- ⚪ `chat.ts` — ts — deps: @livai/core-contracts, domain/*, @livai/core/policies/ChatPolicy — агрегирующие типы состояния и операций чата для store/effects/UI (ChatState, ChatStatus, ChatError с категоризацией: validation, policy, permission, rate_limit, real_time, network, severity: 'low' | 'medium' | 'high' для telemetry/alerts, exhaustive union ChatErrorCode и структура error-mapping с retryable: boolean, кодами и контекстом)
- ⚪ `chat-initial.ts` — ts — deps: types/chat, domain/ChatAuditEvent, types/chat-commands, types/chat-events — канонические начальные состояния Chat для reset-операций в store/effects, шаблоны для audit-событий (ChatAuditEventTemplate), pipeline-hooks (ChatPipelineHookTemplate) для автоматических действий при lifecycle-событиях
- ⚪ `chat-commands.ts` — ts — deps: domain/*, types/chat — типы и константы команд чата (send_message, create_conversation, edit_message, delete_message, archive_conversation, send_feedback, request_handoff, connect_realtime, disconnect_realtime)
- ⚪ `chat-events.ts` — ts — deps: domain/*, types/chat — типы и константы событий чата (message_sent, message_received, message_edited, message_deleted, conversation_created, conversation_archived, feedback_submitted, handoff_requested, realtime_connected, realtime_disconnected, realtime_error)

### **Feature-chat / domain** ⚪

- ⚪ `Message.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — доменная модель сообщения (id, threadId, role: 'user' | 'assistant' | 'system', content, status: 'sending' | 'sent' | 'delivered' | 'failed', createdAt, updatedAt, operationId для идемпотентности, attachments, metadata)
- ⚪ `Conversation.ts` — ts — deps: @livai/core-contracts/conversations, types/chat, @livai/core/policies/ChatPolicy — доменная модель разговора/треда (id, workspaceId, botId, title, type, status: 'active' | 'archived' | 'deleted', createdBy, createdAt, updatedAt, deletedAt, metadata, tags/labels для фильтрации)
- ⚪ `Thread.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — доменная модель треда (id, workspaceId, botId, status: 'active' | 'archived', createdAt, последнее сообщение для UI)
- ⚪ `ChatAuditEvent.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — доменная модель событий аудита чата для SIEM/логирования (message_sent, message_received, message_edited, message_deleted, conversation_created, conversation_archived, feedback_submitted, handoff_requested, realtime_connected, realtime_disconnected, policy_violation)
- ⚪ `Feedback.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — доменная модель обратной связи (id, messageId, threadId, rating: 'positive' | 'negative', comment, createdAt, createdBy)
- ⚪ `Handoff.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — доменная модель передачи диалога человеку (id, threadId, reason, status: 'requested' | 'accepted' | 'rejected', requestedAt, acceptedAt, assignedTo)
- ⚪ `ChatRetry.ts` — ts — deps: @livai/core/resilience, contracts/ChatErrorResponse, types/chat — централизованная retry-политика для ChatErrorType/ChatErrorCode (ChatRetryPolicy, getChatRetryable, mergeChatRetryPolicies; validation/policy/permission/parsing — non‑retryable, сетевые rate_limit/real_time/network ошибки по умолчанию retryable, с возможностью overrides для конкретных сценариев)

### **Feature-chat / contracts** ⚪

- ⚪ `ChatErrorResponse.ts` — ts — deps: @livai/core-contracts, types/chat — нормализованный контракт ошибок чата (строгий union ChatErrorType: validation, policy, permission, rate_limit, real_time, network, not_found; обязательный retryable: boolean без transport-деталей)

### **Feature-chat / dto** ⚪

- ⚪ `SendMessageRequest.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — DTO отправки сообщения (threadId, content, operationId для идемпотентности, attachments опционально)
- ⚪ `CreateConversationRequest.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — DTO создания разговора (title, botId, type, initialMessage опционально)
- ⚪ `TurnRequest.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — DTO выполнения хода в диалоге (content, operationId для идемпотентности)
- ⚪ `TurnResponse.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — DTO результата хода (threadId, userMessage, assistantMessage)
- ⚪ `FeedbackRequest.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — DTO отправки обратной связи (messageId, threadId, rating, comment опционально)
- ⚪ `HandoffRequest.ts` — ts — deps: @livai/core-contracts/conversations, types/chat — DTO запроса передачи диалога (threadId, reason, assignedTo опционально)

### **Feature-chat / schemas** ⚪

- ⚪ `schemas.ts` — ts — deps: zod, @livai/core-contracts/validation/zod — Zod-схемы и inferred-типы для всех chat DTO (send-message/create-conversation/turn/feedback/handoff) и chatAuditEventSchema для валидации audit-событий

### **Feature-chat / lib** ⚪

- ⚪ `error-mapper.ts` — ts — deps: @livai/core, contracts/ChatErrorResponse, types/chat, domain/ChatRetry — маппинг transport/domain ошибок в нормализованный ChatError и UI-дружественные коды с использованием централизованной retry-политики
- ⚪ `chat-errors.ts` — ts — deps: contracts/ChatErrorResponse, types/chat, domain/ChatRetry — константы кодов ошибок, категоризация ошибок (validation, policy, permission, rate_limit, real_time, network, parsing) и специфичная логика маппинга сложных ошибок с опорой на ChatRetryPolicy
- ⚪ `policy-adapter.ts` — ts — deps: @livai/core/policies/ChatPolicy, types/chat — адаптер между core/policies и feature-chat (ChatMode → ChatStatus, ChatAction → ChatCommand)
- ⚪ `message-normalizer.ts` — ts — deps: domain/Message, types/chat — нормализация входящих сообщений API/WS/SSE → Message entity (статусы доставки, timestamps, idempotency, forward-compatibility)
- ⚪ `real-time-manager.ts` — ts — deps: @livai/core/websocket, @livai/core/sse-client, domain/Message, types/chat — domain-pure менеджер real-time соединений (WebSocket/SSE lifecycle, reconnect, idempotency, синхронизация состояния)
- ⚪ `chat-audit.ts` — ts — deps: domain/ChatAuditEvent, schemas/index, types/chat — хелперы для логирования audit-событий (валидация через chatAuditEventSchema, построение контекста, отправка в SIEM/логирование)
- ⚪ `chat-telemetry.ts` — ts — deps: types/chat, @livai/core-contracts/telemetry — telemetry hooks для метрик чата (messages_sent, messages_received, conversations_created, response_time, realtime_connections, feedback_submitted, handoff_requests, метрики производительности)
- ⚪ `chat-pipeline.ts` — ts — deps: types/chat-commands, types/chat-events, lib/chat-audit — описание и обработка pipeline-триггеров (автоматические действия при создании/архивации разговора, обработка real-time событий, триггеры уведомлений, hook points для future events: beforeSendMessage, afterMessageReceived, onRealtimeConnected для расширяемости без изменения структуры)

### **Feature-chat / stores** ⚪

- ⚪ `helpers/operations.ts` — ts — deps: types/chat, @livai/core/state-kit — store helper для типобезопасного обновления `chat.operations` (единый паттерн setOperation для OperationState без мутаций)
- ⚪ `chat.ts` — ts — deps: zustand, @livai/core/state-kit, types/chat, stores/helpers/operations — централизованный Zustand-store состояния чата (entities + operations через OperationState из state-kit; только sync transitions, без async/side-effects; effects работают со store только через ports из `effects/shared/chat-store.port.ts`)

### **Feature-chat / effects** ⚪

- ⚪ `shared/api-client.adapter.ts` — ts+effect — deps: lib/*, stores/chat, schemas/index — адаптер HTTP-клиента под Effect-пайплайны и chat-схемы
- ⚪ `shared/api-client.port.ts` — ts+effect — deps: lib/*, stores/chat, schemas/index — портовый контракт ChatApiClientPort для DI (send-message, create-conversation, turn, feedback, handoff)
- ⚪ `shared/chat-api.mappers.ts` — ts+effect — deps: lib/*, stores/chat, schemas/index — мапперы HTTP-ответов backend → domain/feature-уровень (Message/Conversation/Turn/ChatError)
- ⚪ `shared/chat-store.port.ts` — ts — deps: stores/chat, types/chat — портовый контракт доступа к chat-store из эффектов (Port pattern для изоляции effects от реализации store)
- ⚪ `shared/realtime-client.port.ts` — ts — deps: @livai/core/websocket, @livai/core/sse-client, stores/chat, types/chat — портовый контракт real-time клиента для DI (WebSocket/SSE, единый интерфейс)
- ⚪ `send-message/send-message-effect.types.ts` — ts — deps: shared/chat-store.port, shared/api-client.port, @livai/core/policies/ChatPolicy, types/chat, lib/error-mapper — DI-контракты и конфигурация send-message-effect
- ⚪ `send-message/send-message-api.mapper.ts` — ts — deps: domain/SendMessageRequest, domain/Message, schemas/index, shared/chat-api.mappers — маппинг запроса/ответа send-message API
- ⚪ `send-message/send-message-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — optimistic update и обновление store при успешной отправке сообщения
- ⚪ `send-message/send-message-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий message_sent/message_send_failed
- ⚪ `send-message/send-message.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/send-message/_ — оркестратор send-message-flow (валидация → policy → rate-limit check → API → optimistic update → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `create-conversation/create-conversation-effect.types.ts` — ts — deps: shared/chat-store.port, shared/api-client.port, @livai/core/policies/ChatPolicy, types/chat, lib/error-mapper — DI-контракты и конфигурация create-conversation-effect
- ⚪ `create-conversation/create-conversation-api.mapper.ts` — ts — deps: domain/CreateConversationRequest, domain/Conversation, schemas/index, shared/chat-api.mappers — маппинг запроса/ответа create-conversation API
- ⚪ `create-conversation/create-conversation-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — обновление store при успешном создании разговора
- ⚪ `create-conversation/create-conversation-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий conversation_created/conversation_create_failed
- ⚪ `create-conversation/create-conversation.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/create-conversation/_ — оркестратор create-conversation-flow (валидация → policy → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `turn/turn-effect.types.ts` — ts — deps: shared/chat-store.port, shared/api-client.port, @livai/core/policies/ChatPolicy, types/chat, lib/error-mapper — DI-контракты и конфигурация turn-effect
- ⚪ `turn/turn-api.mapper.ts` — ts — deps: domain/TurnRequest, domain/TurnResponse, schemas/index, shared/chat-api.mappers — маппинг запроса/ответа turn API (выполнение хода в диалоге)
- ⚪ `turn/turn-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — обновление store при успешном выполнении хода (добавление user и assistant сообщений)
- ⚪ `turn/turn-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий turn_completed/turn_failed
- ⚪ `turn/turn.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/turn/_ — оркестратор turn-flow (U10: отправка сообщения → получение ответа бота → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `realtime/websocket-effect.types.ts` — ts — deps: shared/realtime-client.port, shared/chat-store.port, types/chat, lib/error-mapper — DI-контракты и конфигурация websocket-effect
- ⚪ `realtime/websocket-client.mapper.ts` — ts — deps: domain/Message, lib/message-normalizer, shared/realtime-client.port — маппинг WebSocket сообщений в Message entity
- ⚪ `realtime/websocket-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — обновление store при получении real-time сообщений
- ⚪ `realtime/websocket-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий realtime_connected/realtime_disconnected/realtime_error
- ⚪ `realtime/connect-websocket.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/realtime/_ — оркестратор connect-websocket-flow (подключение к WebSocket → обработка сообщений → store/audit, isolation и timeout, защита от multiple connections, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `realtime/sse-effect.types.ts` — ts — deps: shared/realtime-client.port, shared/chat-store.port, types/chat, lib/error-mapper — DI-контракты и конфигурация sse-effect
- ⚪ `realtime/sse-client.mapper.ts` — ts — deps: domain/Message, lib/message-normalizer, shared/realtime-client.port — маппинг SSE сообщений в Message entity
- ⚪ `realtime/sse-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — обновление store при получении SSE сообщений
- ⚪ `realtime/sse-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий realtime_connected/realtime_disconnected/realtime_error
- ⚪ `realtime/connect-sse.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/realtime/_ — оркестратор connect-sse-flow (SSE fallback для real-time чата, альтернатива WebSocket, единый контракт обновления chat store, включается по feature-flag или env, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `feedback/feedback-effect.types.ts` — ts — deps: shared/chat-store.port, shared/api-client.port, types/chat, lib/error-mapper — DI-контракты и конфигурация feedback-effect
- ⚪ `feedback/feedback-api.mapper.ts` — ts — deps: domain/FeedbackRequest, domain/Feedback, schemas/index, shared/chat-api.mappers — маппинг запроса/ответа feedback API
- ⚪ `feedback/feedback-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — обновление store при успешной отправке обратной связи
- ⚪ `feedback/feedback-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий feedback_submitted/feedback_failed
- ⚪ `feedback/send-feedback.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/feedback/_ — оркестратор send-feedback-flow (U11: отправка оценки ответа → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `handoff/handoff-effect.types.ts` — ts — deps: shared/chat-store.port, shared/api-client.port, @livai/core/policies/ChatPolicy, types/chat, lib/error-mapper — DI-контракты и конфигурация handoff-effect
- ⚪ `handoff/handoff-api.mapper.ts` — ts — deps: domain/HandoffRequest, domain/Handoff, schemas/index, shared/chat-api.mappers — маппинг запроса/ответа handoff API
- ⚪ `handoff/handoff-store-updater.ts` — ts — deps: shared/chat-store.port, types/chat — обновление store при запросе передачи диалога
- ⚪ `handoff/handoff-audit.mapper.ts` — ts — deps: schemas/index, types/chat — построение audit-событий handoff_requested/handoff_accepted/handoff_rejected
- ⚪ `handoff/request-handoff.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/handoff/_ — оркестратор request-handoff-flow (U5/U11: запрос передачи диалога человеку → API → store/audit, generic hooks для audit/telemetry для расширяемости без изменения структуры)
- ⚪ `lifecycle/archive-conversation.ts` — ts+effect — deps: lib/_, stores/chat, schemas/index, effects/lifecycle/_ — оркестратор archive-conversation-flow (архивация разговора, generic hooks для audit/telemetry для расширяемости без изменения структуры)

### **UI-core / types** ✅

- 🟢 `ui.ts` — ts — deps: — базовые UI типы и контракты для всех UI компонентов (CoreUIBaseProps, CoreUIComponentContract, UIAlign, UIColor, UISize, UIState, UISemanticStatus, UIVisibility, UIInteractive, UIDataAttributes, UITestId и др.)

### **UI-core / primitives** ✅

- 🟢 `button.tsx` — tsx+react — deps: lib/i18n, clsx— базовая кнопка с вариантами стилей (primary/secondary) и размерами (sm/md/lg), fullWidth
- 🟢 `input.tsx` — tsx+react — deps: lib/i18n, clsx— текстовое поле ввода с поддержкой различных типов и состояний
- 🟢 `textarea.tsx` — tsx+react — deps: — многострочное текстовое поле ввода
- 🟢 `select.tsx` — tsx+react — deps: — выпадающий список для выбора одного значения
- 🟢 `checkbox.tsx` — tsx+react — deps: — чекбокс для выбора одного или нескольких значений
- 🟢 `radio.tsx` — tsx+react — deps: — радиокнопка для выбора одного значения из группы
- 🟢 `toggle.tsx` — tsx+react — deps: — переключатель для boolean значений
- 🟢 `icon.tsx` — tsx+react — deps: lib/i18n, types/ui— компонент для отображения иконок
- 🟢 `avatar.tsx` — tsx+react — deps: — компонент для отображения аватара пользователя с размерами
- 🟢 `badge.tsx` — tsx+react — deps: — компонент для отображения бейджа/метки с вариантами и размерами
- 🟢 `tooltip.tsx` — tsx+react — deps: — компонент для отображения подсказок при наведении с позиционированием
- 🟢 `divider.tsx` — tsx+react — deps: lib/i18n, types/ui— компонент-разделитель для визуального разделения контента (горизонтальный/вертикальный)
- 🟢 `card.tsx` — tsx+react — deps: lib/i18n, types/ui— компонент карточки для группировки контента с вариантами и размерами
- 🟢 `form-field.tsx` — tsx+react — deps: — компонент поля формы с лейблом и ошибкой
- 🟢 `dialog.tsx` — tsx+react — deps: lib/i18n, react-dom— компонент диалогового окна
- 🟢 `form.tsx` — tsx+react — deps: — компонент формы для группировки полей ввода
- 🟢 `loading-spinner.tsx` — tsx+react — deps: lib/i18n, types/ui— компонент индикатора загрузки с вариантами и размерами
- 🟢 `dropdown.tsx` — tsx+react — deps: lib/i18n, types/ui— компонент выпадающего меню
- 🟢 `context-menu.tsx` — tsx+react — deps: — компонент контекстного меню
- 🟢 `status-indicator.tsx` — tsx+react — deps: lib/i18n, types/ui— компонент индикатора статуса с вариантами и размерами

### **UI-core / components** ✅

- 🟢 `Toast.tsx` — tsx+react — deps: — — компонент для отображения уведомлений (info/success/warning/error), presentational primitive, управление жизненным циклом в App-слое
- 🟢 `Skeleton.tsx` — tsx+react — deps: types/ui — компонент скелетона для отображения состояния загрузки с вариантами
- 🟢 `Modal.tsx` — tsx+react — deps: types/ui — компонент модального окна с вариантами
- 🟢 `Breadcrumbs.tsx` — tsx+react — deps: types/ui — компонент навигационных хлебных крошек
- 🟢 `Tabs.tsx` — tsx+react — deps: types/ui — компонент вкладок для переключения между разделами
- 🟢 `Accordion.tsx` — tsx+react — deps: types/ui — компонент аккордеона для раскрывающихся секций
- 🟢 `DatePicker.tsx` — tsx+react — deps: types/ui — компонент для выбора даты с календарем
- 🟢 `FileUploader.tsx` — tsx+react — deps: types/ui — компонент для загрузки файлов с поддержкой статусов и прогресса
- 🟢 `SideBar.tsx` — tsx+react — deps: types/ui — компонент боковой панели навигации (collapsed/expanded, left/right)
- 🟢 `SearchBar.tsx` — tsx+react — deps: types/ui — компонент поисковой строки
- 🟢 `ConfirmDialog.tsx` — tsx+react — deps: types/ui — компонент диалога подтверждения действия
- 🟢 `ErrorBoundary.tsx` — tsx+react — deps: types/ui — компонент границы ошибок для обработки ошибок React
- 🟢 `UserProfileDisplay.tsx` — tsx+react — deps: types/ui — компонент для отображения профиля пользователя
- 🟢 `NavigationMenuItem.tsx` — tsx+react — deps: types/ui — компонент элемента навигационного меню
- 🟢 `LanguageSelector.tsx` — tsx+react — deps: types/ui — компонент для выбора языка интерфейса
- 🟢 `SupportButton.tsx` — tsx+react — deps: types/ui — компонент кнопки поддержки с вариантами и размерами

### **UI-shared / i18n** ✅

- 🟢 `types.ts` — ts — deps: — общие типы для i18n в UI слое (TFunction контракт для функции перевода, не бросает исключений, всегда возвращает строку или undefined, адаптеры для next-intl/i18next приводятся к этой форме)

### **UI-shared / validation** ✅

- 🟢 `zod.ts` — ts — deps: i18n/types — интеграция Zod ошибок с UI (i18n ключи, маппинг, ValidationKeys константы, translateZodMessage, buildNestedKey, createZodI18nErrorMap)
- 🟢 `rhf-zod-resolver.ts` — ts — deps: validation/zod, react-hook-form, zod — Zod → React Hook Form resolver (Zod v4 friendly, типы @hookform/resolvers/zod часто отстают от Zod v4, стабильный мост между Zod и RHF)

### **UI-shared / websocket** ⚪

- ⚪ `websocket-adapter.ts` — ts+react — deps: @livai/core/transport/websocket, i18n/types — UI-адаптер для WebSocket клиента из core (React hooks для подключения/отключения, обработка сообщений, состояние подключения, SSR-safe, используется в UI-компонентах напрямую, не через app/hooks)
- ⚪ `websocket-provider.tsx` — tsx+react — deps: websocket/websocket-adapter — React Provider для WebSocket контекста (единая точка доступа к WebSocket соединению, lifecycle management, для UI-компонентов, не для feature-chat effects)

### **UI-shared / sse** ⚪

- ⚪ `sse-adapter.ts` — ts+react — deps: @livai/core/transport/sse-client, i18n/types — UI-адаптер для SSE клиента из core (React hooks для подключения/отключения, обработка событий, состояние подключения, SSR-safe, используется в UI-компонентах напрямую, не через app/hooks)
- ⚪ `sse-provider.tsx` — tsx+react — deps: sse/sse-adapter — React Provider для SSE контекста (единая точка доступа к SSE соединению, lifecycle management, для UI-компонентов, не для feature-chat effects)

### **UI-shared / offline-cache** ⚪

- ⚪ `offline-cache-adapter.ts` — ts+react — deps: @livai/core/effect/offline-cache, i18n/types — UI-адаптер для offline-cache из core (React hooks для доступа к кэшу, типизированный доступ с SWR staleWhileRevalidate, частичное и глубокое слияние, debounce и throttle, SSR гидратация, кросс-таб синхронизация через BroadcastChannel, для UI-компонентов напрямую, альтернатива app/hooks/useOfflineCache для случаев, когда нужен более низкоуровневый доступ)
- ⚪ `offline-cache-provider.tsx` — tsx+react — deps: offline-cache/offline-cache-adapter — React Provider для offline-cache контекста (единая точка доступа к кэшу, версионирование и инвалидация, для UI-компонентов)

### **UI-shared / helpers** ⚪

- ⚪ `format-helpers.ts` — ts — deps: i18n/types — утилиты форматирования для UI (форматирование дат, чисел, денег, локализованные форматы)
- ⚪ `dom-helpers.ts` — ts — deps: — утилиты для работы с DOM (безопасные селекторы, события, атрибуты, SSR-safe)
- ⚪ `url-helpers.ts` — ts — deps: — утилиты для работы с URL (построение query-параметров, парсинг, валидация)
- ⚪ `storage-helpers.ts` — ts — deps: — утилиты для работы с localStorage/sessionStorage (типизированный доступ, SSR-safe, error handling)

### **App / types** ✅

- 🟢 `common.ts` — ts — deps: @livai/core-contracts общие типы приложения (AppContext, AppModules, UserRoles, RouteConfig, ComponentState, AsyncState, PaginatedResponse, Json, ISODateString, ID, Platform и др.)
- 🟢 `ui-contracts.ts` — ts — deps: @livai/ui-core, lib/i18n, types/common — контракты UI (UiAuthContext, UiFeatureFlagsApi, UiI18nContext, UiTelemetryApi, UiPrimitiveProps, ComponentState, FeatureFlags, UiFeatureFlagName)
- 🟢 `api.ts` — ts — deps: @livai/core-contracts, types/common, types/ui-contracts — типы API (ApiRequest, ApiResponse, ApiRequestContext, ApiError, ApiSuccess, ApiFailure, ApiRetryPolicy, ApiMetrics, HttpMethod, ServiceName)

### **App / lib** 🟡

- 🟢 `api-client.ts` — ts+effect — deps: @livai/core-contracts, @livai/core/effect, types/api, lib/telemetry-runtime — HTTP клиент для выполнения API запросов с типизацией, обработкой ошибок, retry, cancellation, telemetry (ApiClient, createApiClient, buildHeaders, buildUrl, mapHttpError, parseJsonSafe, использует @livai/core/effect для withLogging, withRetry)
- 🟢 `telemetry-runtime.ts` — ts — deps: @livai/core-contracts, @livai/core/telemetry — runtime телеметрии (initTelemetry, getGlobalTelemetryClient, errorFireAndForget, infoFireAndForget, logFireAndForget, warnFireAndForget, getFireAndForgetMetrics, resetGlobalTelemetryClient, setGlobalClientForDebug, isTelemetryInitialized, адаптер для @livai/core/telemetry)
- 🟢 `i18n.ts` — ts+react — deps: dayjs — интернационализация (t, useTranslations, formatDateLocalized, setDayjsLocale, setDayjsLocaleSync, getCurrentDayjsLocale, isDayjsLocaleSupported, isRtlLocale, FallbackType)
- 🟢 `logger.ts` — ts — deps: @livai/core-contracts, types/common, lib/telemetry-runtime — логирование (log, info, error, warn, logOperationStart, logOperationSuccess, logOperationFailure, logFireAndForget, LogLevel, LogContext, LogMetadata)
- 🟢 `service-worker.ts` — ts — deps: — service worker утилиты (handleRequest, handleBackgroundSync, handlePushNotification, handleNotificationClick, precacheMainUrls, precacheStaticUrls, decommissionServiceWorker, mainCacheName, staticCacheName, swDisabled, swSelf, Client, Clients, WindowClient, ServiceWorkerGlobalScope, ExtendableEvent, ExtendableMessageEvent, FetchEvent)
- 🟢 `auth-hook-deps.ts` — ts — deps: effect, @livai/feature-auth, hooks/useAuth — DI-фабрика для связки feature-auth store + effects для useAuth (createAuthHookDeps, AuthHookDepsConfig)
- 🟢 `auth-token-adapter.ts` — ts — deps: hooks/useAuth — адаптер для получения токенов из feature-auth store (createAuthTokenAdapter, AuthTokenAdapter, AuthTokenAdapterConfig, AuthTokenAdapterLogger, используется HTTP-клиентами для автоматического добавления Authorization header)
- ⚪ `bots-hook-deps.ts` — ts — deps: @livai/feature-bots (stores, effects, types) — DI-фабрика для связки feature-bots store + effects для useBots (createBotsHookDeps, BotsHookDepsConfig, по аналогии с auth-hook-deps)
- ⚪ `chat-hook-deps.ts` — ts — deps: @livai/feature-chat (stores, effects, types) — DI-фабрика для связки feature-chat store + effects для useChat (createChatHookDeps, ChatHookDepsConfig, по аналогии с auth-hook-deps)
- 🟢 `route-access.ts` — ts — deps: @livai/core/access-control/route-permissions — UI-специфичные утилиты для проверки доступа к маршрутам (canAccessRoute, использует @livai/core/access-control/route-permissions)
- 🟢 `app-lifecycle.ts` — ts — deps: background/tasks, events/app-lifecycle-events, types/common — управление жизненным циклом приложения (appLifecycle, LifecycleStage, LifecycleHookEvent, LifecycleHookHandler)

### **App / state** ✅

- 🟢 `store.ts` — ts+zustand — deps: types/common — глобальный Zustand store состояния приложения (AppStore, AppStoreState, AppStoreActions, PersistedAppState, AppUser, UserStatus, ThemeMode, useAppStore, createInitialState, getCurrentTime, getInitialOnlineStatus, registerNetworkStatusListener, storeMerge, storePartialize, appStoreSelectors, appStoreDerivedSelectors, getAppStoreActions, getAppStoreState, setAppStoreState)
- 🟢 `store-utils.ts` — ts — deps: state/store — утилиты безопасного обновления store (safeSet, SafeSetOptions, isStoreLocked, setStoreLocked; последовательные обновления через очередь, guardrail при logout)
- 🟢 `query/query-client.ts` — ts+react — deps: lib/telemetry-runtime — query client (React Query клиент с настройками по умолчанию, интеграция с telemetry)
- 🟢 `reset.ts` — ts — deps: events/app-lifecycle-events, state/store, state/store-utils — сброс UI-state при logout/force-reset (policy: soft/full, store lock guardrail, dev visibility)

### **App / providers** ✅

- 🟢 `AppProviders.tsx` — ts+react — deps: @livai/core/access-control, @livai/core-contracts, hooks/useAuth-provider, lib/auth-hook-deps, providers/FeatureFlagsProvider, providers/intl-provider, providers/QueryClientProvider, providers/TelemetryProvider, providers/ToastProvider, providers/UnifiedUIProvider, state/store, types/ui-contracts — корневой провайдер приложения (композиция: FeatureFlags → Telemetry → QueryClient → Toast → UnifiedUI → AuthHookProvider → AuthGuard; SSR-safe; AuthGuardBridge строит AuthGuardContext из userId (store selector) + tokens + requestId + optional userAgent)
- 🟢 `FeatureFlagsProvider.tsx` — ts+zustand — deps: @livai/core/feature-flags, types/common, types/ui-contracts — провайдер feature flags (управление feature flags через Zustand, FeatureFlagsProviderProps, FeatureFlagsState, FeatureFlagsActions, FeatureFlagsStore, featureFlagsStore, useFeatureFlags, UiFeatureFlagsAlias)
- 🟢 `intl-provider.tsx` — ts+react — deps: next-intl — провайдер интернационализации (IntlProvider, IntlProviderProps, интеграция с next-intl)
- 🟢 `QueryClientProvider.tsx` — ts+react — deps: state/query/query-client, types/ui-contracts — провайдер query client (AppQueryClientProvider, AppQueryClientProviderProps, QueryComponentState, React Query провайдер с настройками по умолчанию)
- 🟢 `TelemetryProvider.tsx` — ts+react — deps: @livai/core-contracts, @livai/core/telemetry, lib/telemetry-runtime, types/ui-contracts — провайдер телеметрии (TelemetryProvider, TelemetryProviderProps, TelemetryContext, TelemetryContextType, useTelemetryContext, UiMetricsAlias)
- 🟢 `ToastProvider.tsx` — ts+react — deps: providers/TelemetryProvider, types/ui-contracts — провайдер уведомлений (ToastProvider, ToastProviderProps, ToastContext, ToastContextType, ToastItem, ToastType, AddToastParams, ToastComponentState, useToastContext)
- 🟢 `UnifiedUIProvider.tsx` — ts+react — deps: @livai/core-contracts, @livai/core/feature-flags/react, lib/i18n, lib/telemetry-runtime, providers/FeatureFlagsProvider, providers/TelemetryProvider, types/ui-contracts — объединенный UI провайдер (UnifiedUIProvider, UnifiedUIProviderProps, UnifiedUIContext, UnifiedUIContextType, UnifiedUiFeatureFlagsApi, UnifiedUiI18nContext, UnifiedUiTelemetryApi, useUnifiedUI, useUnifiedFeatureFlags, useUnifiedI18n, useUnifiedTelemetry, useRequiredUnifiedUI, единая точка доступа к featureFlags + telemetry + i18n)

### **App / hooks** ✅

- 🟢 `useApi.ts` — ts+react+effect — deps: @livai/core/effect, @livai/core/input-boundary/api-schema-guard, effect, lib/api-client, lib/telemetry-runtime, types/api, types/ui-contracts — хук для API запросов (useApi, UseApiOptions, ApiComponentState, ApiContract, ApiEndpointDefinition, ApiClientAdapter, ApiUiEvent, ApiUiMetrics, оркестратор вызовов API с типизацией, валидацией и телеметрией)
- 🟢 `useAuth.ts` — ts+react — deps: @livai/feature-auth, lib/auth-hook-deps — React hook для аутентификации (useAuth, UseAuthStorePort, фасад над feature-auth store и effects, предоставляет доступ к доменному AuthState и методы login/logout/register/refresh)
- 🟢 `useAuth-provider.tsx` — ts+react — deps: hooks/useAuth, lib/auth-hook-deps — React Context-обёртка для DI-версии useAuth (AuthHookProvider, AuthHookProviderProps, публичный API: useAuth() без параметров, DI-зависимости берутся из контекста)
- 🟢 `useFeatureFlags.ts` — ts+react — deps: @livai/core/feature-flags, providers/FeatureFlagsProvider, types/common, types/ui-contracts — хук для feature flags (useFeatureFlags, UseFeatureFlagsApi, UseFeatureFlagsUi, FeatureFlagKey, SSR-safe hook для чтения и управления feature flags через Zustand selectors с dev-only toggle)
- 🟢 `useOfflineCache.ts` — ts+react+effect — deps: @livai/core/effect, @livai/core/effect/offline-cache, types/ui-contracts — хук для офлайн кеша (useOfflineCache, UseOfflineCacheOptions, UseOfflineCacheReturn, UseOfflineCacheState, OfflineCacheComponentState, CacheKey, InvalidateMarker, PartialDeep, типизированный доступ с SWR staleWhileRevalidate, частичное и глубокое слияние, debounce и throttle, SSR гидратация, кросс-таб синхронизация через BroadcastChannel, версионирование и инвалидация, использует @livai/core/effect/offline-cache напрямую)
- 🟢 `useToast.ts` — ts+react — deps: providers/ToastProvider, lib/telemetry-runtime, types/ui-contracts — хук для уведомлений (useToast, UseToastApi, ToastComponentState, ToastDuration, ToastUiEvent, fluent API для управления уведомлениями: success/error/warning/info/loading/promise с автоматической телеметрией)
- ⚪ `useBots.ts` — ts+react — deps: lib/bots-hook-deps, @livai/feature-bots (stores, effects, types) — React hook для управления ботами (useBots, UseBotsStorePort, UseBotsDeps, UseBotsResult, фасад над feature-bots store и effects, предоставляет доступ к BotState и методы createBot/updateBot/deleteBot/publishBot, по аналогии с useAuth)
- ⚪ `useBots-provider.tsx` — ts+react — deps: hooks/useBots, lib/bots-hook-deps — React Context-обёртка для DI-версии useBots (BotsHookProvider, BotsHookProviderProps, публичный API: useBots() без параметров, DI-зависимости берутся из контекста)
- ⚪ `useChat.ts` — ts+react — deps: lib/chat-hook-deps, @livai/feature-chat (stores, effects, types) — React hook для управления чатом (useChat, UseChatStorePort, UseChatDeps, UseChatResult, фасад над feature-chat store и effects, предоставляет доступ к ChatState и методы sendMessage/createConversation/connectRealtime, по аналогии с useAuth)
- ⚪ `useChat-provider.tsx` — ts+react — deps: hooks/useChat, lib/chat-hook-deps — React Context-обёртка для DI-версии useChat (ChatHookProvider, ChatHookProviderProps, публичный API: useChat() без параметров, DI-зависимости берутся из контекста)
- ⚪ `useRealTime.ts` — ts+react+effect — deps: hooks/useChat, @livai/core/transport/websocket, @livai/core/transport/sse-client — Lifecycle-контроль real-time (init WS/SSE on mount, cleanup on unmount, reconnect/idempotency, защита от multiple connections, синхронизация состояния подключения в store, telemetry; lifecycle остаётся в React, effect — чистый use-case, использует @livai/core/transport напрямую)

### **App / ui** ✅

- 🟢 `button.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/common, types/ui-contracts — обертка кнопки (Button, AppButtonProps, ButtonWrapperProps, ButtonMapCoreProps, ButtonUiFeatureFlags, enabled: telemetry, feature-flags, i18n)
- 🟢 `input.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/common, types/ui-contracts — обертка поля ввода (Input, AppInputProps, InputWrapperProps, InputMapCoreProps, InputUiFeatureFlags, InputTelemetryEvent, InputTelemetryPayload)
- 🟢 `textarea.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка многострочного поля (Textarea, AppTextareaProps, TextareaWrapperProps, TextareaMapCoreProps, TextareaUiFeatureFlags)
- 🟢 `select.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка выпадающего списка (Select, AppSelectProps, SelectWrapperProps, SelectMapCoreProps, SelectUiFeatureFlags)
- 🟢 `checkbox.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка чекбокса (Checkbox, AppCheckboxProps, CheckboxWrapperProps, CheckboxMapCoreProps, CheckboxUiFeatureFlags)
- 🟢 `radio.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка радиокнопки (Radio, AppRadioProps, RadioWrapperProps, RadioMapCoreProps, RadioUiFeatureFlags)
- 🟢 `toggle.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка переключателя (Toggle, AppToggleProps, ToggleWrapperProps, ToggleMapCoreProps, ToggleUiFeatureFlags)
- 🟢 `icon.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка иконки (Icon, AppIconProps, IconWrapperProps, IconMapCoreProps, IconUiFeatureFlags)
- 🟢 `avatar.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка аватара (Avatar, AppAvatarProps, AvatarWrapperProps, AvatarMapCoreProps, AvatarUiFeatureFlags)
- 🟢 `badge.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка бейджа (Badge, AppBadgeProps, BadgeWrapperProps, BadgeMapCoreProps, BadgeUiFeatureFlags)
- 🟢 `tooltip.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка подсказки (Tooltip, AppTooltipProps, TooltipWrapperProps, TooltipMapCoreProps, TooltipUiFeatureFlags)
- 🟢 `divider.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка разделителя (Divider, AppDividerProps, DividerWrapperProps, DividerMapCoreProps, DividerUiFeatureFlags)
- 🟢 `card.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка карточки (Card, AppCardProps, CardWrapperProps, CardMapCoreProps, CardUiFeatureFlags)
- 🟢 `dialog.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider — обертка диалога (Dialog, AppDialogProps)
- 🟢 `form.tsx` — tsx+react — deps: @livai/core/effect, @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка формы (Form, AppFormProps)
- 🟢 `loading-spinner.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка индикатора загрузки (LoadingSpinner, AppLoadingSpinnerProps, LoadingSpinnerWrapperProps, LoadingSpinnerMapCoreProps, LoadingSpinnerUiFeatureFlags)
- 🟢 `dropdown.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка выпадающего меню (Dropdown, AppDropdownProps, DropdownWrapperProps, DropdownMapCoreProps, DropdownUiFeatureFlags)
- 🟢 `context-menu.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка контекстного меню (ContextMenu, AppContextMenuProps, ContextMenuWrapperProps, ContextMenuMapCoreProps, ContextMenuUiFeatureFlags)
- 🟢 `status-indicator.tsx` — tsx+react — deps: @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка индикатора статуса (StatusIndicator, AppStatusIndicatorProps, StatusIndicatorWrapperProps, StatusIndicatorMapCoreProps, StatusIndicatorUiFeatureFlags)
- 🟢 `toast.tsx` — tsx+react — deps: @livai/core-contracts, @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/common, types/ui-contracts — обертка уведомлений (Toast, AppToastProps, ToastWrapperProps, ToastMapCoreProps, ToastUiFeatureFlags)
- 🟢 `skeleton.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка скелетона (Skeleton, AppSkeletonProps, SkeletonWrapperProps, SkeletonMapCoreProps, SkeletonUiFeatureFlags)
- 🟢 `skeleton-group.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — группа скелетонов (SkeletonGroup, AppSkeletonGroupProps)
- 🟢 `modal.tsx` — tsx+react — deps: @livai/ui-core, @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка модального окна (Modal, AppModalProps, ModalWrapperProps, ModalMapCoreProps, ModalUiFeatureFlags)
- 🟢 `breadcrumbs.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка хлебных крошек (Breadcrumbs, AppBreadcrumbsProps, AppBreadcrumbItem, BreadcrumbsWrapperProps, BreadcrumbsMapCoreProps, BreadcrumbsUiFeatureFlags)
- 🟢 `tabs.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка вкладок (Tabs, AppTabsProps, TabsWrapperProps, TabsMapCoreProps, TabsUiFeatureFlags)
- 🟢 `accordion.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка аккордеона (Accordion, AppAccordionProps, AccordionWrapperProps, AccordionMapCoreProps, AccordionUiFeatureFlags)
- 🟢 `date-picker.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка выбора даты (DatePicker, AppDatePickerProps, DatePickerWrapperProps, DatePickerMapCoreProps, DatePickerUiFeatureFlags)
- 🟢 `file-uploader.tsx` — tsx+react — deps: @livai/core/effect, @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/api, types/ui-contracts — обертка загрузки файлов (FileUploader, AppFileUploaderProps)
- 🟢 `sidebar.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка боковой панели (SideBar, AppSideBarProps, SidebarWrapperProps, SidebarMapCoreProps, SidebarUiFeatureFlags)
- 🟢 `search-bar.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка поисковой строки (SearchBar, AppSearchBarProps)
- 🟢 `confirm-dialog.tsx` — tsx+react — deps: @livai/ui-core, @livai/ui-core, providers/UnifiedUIProvider, types/ui-contracts — обертка диалога подтверждения (ConfirmDialog, AppConfirmDialogProps, ConfirmDialogWrapperProps, ConfirmDialogMapCoreProps, ConfirmDialogUiFeatureFlags)
- 🟢 `error-boundary.tsx` — tsx+react — deps: @livai/core/effect, @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/common, types/ui-contracts — обертка границы ошибок (ErrorBoundary, AppErrorBoundaryProps, ErrorBoundaryWrapperProps, ErrorBoundaryMapCoreProps, ErrorBoundaryUiFeatureFlags)
- 🟢 `user-profile-display.tsx` — tsx+react — deps: @livai/core/access-control, @livai/core/access-control/route-permissions, @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/common, types/ui-contracts — обертка отображения профиля (UserProfileDisplay, AppUserProfileDisplayProps, UserProfileDisplayWrapperProps, UserProfileDisplayMapCoreProps, UserProfileDisplayUiFeatureFlags)
- 🟢 `navigation-menu-item.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, lib/route-access, providers/UnifiedUIProvider, types/common, types/ui-contracts — обертка элемента навигации (NavigationMenuItem, AppNavigationMenuItemProps, NavigationMenuItemWrapperProps, NavigationMenuItemMapCoreProps, NavigationMenuItemUiFeatureFlags)
- 🟢 `language-selector.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка выбора языка (LanguageSelector, AppLanguageSelectorProps, LanguageSelectorWrapperProps, LanguageSelectorMapCoreProps, LanguageSelectorUiFeatureFlags)
- 🟢 `support-button.tsx` — tsx+react — deps: @livai/ui-core, lib/i18n, providers/UnifiedUIProvider, types/ui-contracts — обертка кнопки поддержки (SupportButton, AppSupportButtonProps)

### **App / routes** ✅

- 🟢 `routes.ts` — ts — deps: types/common — декларативный список всех routes приложения (RouteNames константы, RouteNameKey тип, определение route-эндпоинтов и их метаданных, используется в router, guards, middleware)
- 🟢 `route-meta.ts` — ts — deps: @livai/core/access-control/route-permissions, routes/routes, types/common — метаданные маршрутов (permissions, flags, auth-required, декларативная конфигурация доступа к маршрутам)
- 🟢 `navigation.ts` — ts — deps: routes/route-meta, routes/routes, types/common — конфигурация навигации (sidebar/menu/navigation config, построение навигационных структур)

### **App / events** ✅

- 🟢 `app-events.ts` — ts — deps: types/common, zod, uuid — события приложения (AppEventType enum, AppEvent, BaseAppEvent, LoginEvent, LogoutEvent, AuthExpiredEvent, BillingChangedEvent, схемы payload с валидацией, функции создания и проверки событий, версионирование схем, EventInitiator, pushToQueue)
- 🟢 `app-lifecycle-events.ts` — ts — deps: types/common — события жизненного цикла приложения (AppLifecycleEvent enum, appLifecycleEvents, UnsubscribeFn, простой event hub для lifecycle-событий: bootstrap, ready, teardown, logout, reset, без payload, без domain-логики, только инфраструктурные события)
- 🟢 `event-bus.ts` — ts — deps: events/app-events, ioredis — типизированная шина событий (EventBus, eventBus, publishEvent, onEvent, onAnyEvent, EventHandler, StructuredLogger, ConsoleLogger, flushEventBatch, publish/subscribe, audit log, batch push в очередь с retry и fail-safe)

### **App / background** ✅

- 🟢 `scheduler.ts` — ts+effect — deps: effect, events/app-events, events/event-bus, lib/telemetry-runtime — адаптивный планировщик задач (Scheduler, scheduler, getGlobalScheduler, SchedulerDI, BackgroundTask, TaskFn, PriorityType, QueueItem, MeldablePriorityQueue, persistent binary heap priority queue O(log n), cancellable tasks с AbortSignal, adaptive concurrency + token bucket rate-limiting O(1), retry с exponential backoff + jitter, dead-letter queue, periodic & event-driven задачи, bounded telemetry pipeline с backpressure и batching, immutable architecture на Effect-TS, graceful shutdown)
- 🟢 `tasks.ts` — ts+effect — deps: effect, background/scheduler, events/app-events, events/event-bus, hooks/useAuth — фоновые задачи (backgroundTasks, BackgroundTasksDI, createTasks, initBackgroundTasks, startBackgroundTasks, stopBackgroundTasks, TaskEffect, TaskError, PermanentError, TransientError, унифицированные фоновые задачи через глобальный Scheduler: cache refresh/sync, auth refresh, event-driven задачи, retry/DLQ логика, cancellable через AbortSignal, graceful shutdown)

### **App / bootstrap** ✅

- 🟢 `bootstrap.tsx` — tsx+react — deps: providers/AppProviders, react-dom/client — инициализация приложения (bootstrap, BootstrapOptions, BootstrapResult, BootstrapEvent, BootstrapEventHandler, валидация окружения, prefetch, регистрация Service Worker и рендер)

### **App / contracts** ⚪

- ⚪ `feature-auth.contract.ts` — ts — deps: @livai/core-contracts, @livai/feature-auth, types/ui-contracts — контракт app ↔ auth (isAuthenticated, permissions[], pure mapping AuthState/AuthStoreState → UI-контракты, использует только типы и селекторы из feature-auth, запрещено писать auth-бизнес-логику руками, запрещено импортировать Zustand-типы)
- ⚪ `feature-bots.contract.ts` — ts — deps: @livai/core-contracts, @livai/feature-bots, types/ui-contracts — контракт app ↔ bots (capabilities, botPermissions, pure mapping BotState/BotStoreState → UI-контракты, использует только типы и селекторы из feature-bots)
- ⚪ `feature-chat.contract.ts` — ts — deps: @livai/core-contracts, @livai/feature-chat, types/ui-contracts — контракт app ↔ chat (chatPermissions, pure mapping ChatState/ChatStoreState → UI-контракты, использует только типы и селекторы из feature-chat)

### **App / features** ⚪

- ⚪ `auth.adapter.ts` — ts — deps: hooks/useAuth, types/ui-contracts — адаптер auth feature (proxy, flags, SSR-safe, UI импортирует только адаптер и/или @livai/app/hooks/useAuth, но не @livai/feature-auth, запрещен прямой импорт useAuth в UI-слое мимо адаптера, слой адаптера — единственная точка, где derived-флаги и UI-логика auth собираются из authState)
- ⚪ `bots.adapter.ts` — ts — deps: hooks/useBots, types/ui-contracts — адаптер bots feature для app (proxy, flags, SSR-safe, UI импортирует только адаптер и/или @livai/app/hooks/useBots, но не @livai/feature-bots, по аналогии с auth.adapter)
- ⚪ `chat.adapter.ts` — ts — deps: hooks/useChat, types/ui-contracts — адаптер chat feature для app (proxy, flags, SSR-safe, UI импортирует только адаптер и/или @livai/app/hooks/useChat, но не @livai/feature-chat, по аналогии с auth.adapter)

### **UI-features / Auth** 🟡

- 🟡 `auth/login-form.tsx` — tsx+react — deps: @livai/feature-auth, @livai/ui-core, @livai/ui-shared — UI-компонент формы логина (**нарушение границ**: прямой импорт `@livai/feature-auth` для `LoginValues` и `loginSchema`). **План исправления**: (1) убрать импорт `@livai/feature-auth` из `ui-features`; (2) принимать в пропсах чистый DTO/контракт (например, `{ email: string; password: string }`) и callback `onSubmit`, который уже реализован в app-слое поверх `@livai/app/hooks/useAuth` / эффектов; (3) валидацию (`loginSchema`) выполнять в app-слое или передавать в форму через пропсы, чтобы ui-features не знали про доменные схемы feature-auth
- 🟡 `auth/register-form.tsx` — tsx+react — deps: @livai/feature-auth, @livai/ui-core, @livai/ui-shared — UI-компонент формы регистрации (**нарушение границ**: прямой импорт `@livai/feature-auth` для `RegisterValues` и `registerSchema`). **План исправления**: (1) убрать импорт `@livai/feature-auth` из `ui-features`; (2) заменить `RegisterValues` на локальный UI-тип (email/password/workspaceName) и получать `onSubmit` из app-слоя; (3) схему `registerSchema` и логику регистрации держать в feature/auth + app (hooks/effects), а в форму передавать только ошибки/валидацию через пропсы
- ⚪ `auth/WorkspaceForm.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, common/PermissionGate — UI-форма выбора/создания workspace
- ⚪ `auth/OnboardingFlow.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — UI-флоу онбординга пользователя
- ⚪ `auth/TwoFactorAuth.tsx` — tsx+react+effect — deps: @livai/app/hooks/useAuth — UI-компонент управления двухфакторной аутентификацией

### **UI-features / Permission-based** ⚪

- ⚪ `common/AuthGuard.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — универсальный UI-guard для защиты разделов по аутентификации
- ⚪ `common/RoleGate.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — UI-компонент, показывающий контент только для определённых ролей
- ⚪ `common/PermissionGate.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — UI-компонент, показывающий контент только при наличии конкретных permissions
- ⚪ `common/ProtectedRoute.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — UI-обёртка для защищённых маршрутов

### **UI-features / Bots** ⚪

- ⚪ `bots/BotDashboard.tsx` — tsx+react — deps: @livai/app/hooks/useBots — дашборд со списком ботов и основными метриками
- ⚪ `bots/BotWizardFlow.tsx` — tsx+react+effect — deps: @livai/app/hooks/useBots — пошаговый мастер создания/настройки бота
- ⚪ `bots/BotTemplateSelector.tsx` — tsx+react — deps: — выбор шаблона бота
- ⚪ `bots/BotBasicForm.tsx` — tsx+react — deps: — базовая форма параметров бота (название, описание и т.п.)
- ⚪ `bots/PromptEditor.tsx` — tsx+react+effect — deps: @livai/app/hooks/useBots — редактор промптов/инструкций бота
- ⚪ `bots/PromptBlocks.tsx` — tsx+react — deps: — визуальное представление блоков промпта
- ⚪ `bots/PromptPreview.tsx` — tsx+react — deps: — предпросмотр поведения бота по текущему промпту
- ⚪ `bots/BotCard.tsx` — tsx+react — deps: — компактная карточка бота для списков
- ⚪ `bots/BotDetailCard.tsx` — tsx+react — deps: — детальная карточка бота с информацией о создателе и статусе
- ⚪ `bots/SubscriptionStatusBadge.tsx` — tsx+react — deps: — бейдж статуса подписки/доступности бота
- ⚪ `bots/CreatorInfo.tsx` — tsx+react — deps: — блок информации о создателе бота
- ⚪ `bots/ContactButton.tsx` — tsx+react — deps: — кнопка связи с создателем/поддержкой по боту
- ⚪ `bots/BotListItem.tsx` — tsx+react — deps: — элемент списка ботов (например, для сайдбара)

### **UI-features / Chat** ⚪

- ⚪ `chat/ChatInterface.tsx` — tsx+react+effect — deps: @livai/app/hooks/useChat, @livai/app/hooks/useRealTime — основной интерфейс чата (список сообщений, инпут, статус подключения)
- ⚪ `chat/MessageBubble.tsx` — tsx+react — deps: @livai/app/hooks/useChat — UI-компонент «пузырька» сообщения
- ⚪ `chat/ChatInput.tsx` — tsx+react — deps: @livai/app/hooks/useChat — поле ввода сообщения с базовыми действиями
- ⚪ `chat/TypingIndicator.tsx` — tsx+react — deps: @livai/app/hooks/useChat — индикатор «пишет...»
- ⚪ `chat/MessageStatus.tsx` — tsx+react — deps: @livai/app/hooks/useChat — отображение статуса доставки/прочтения сообщения
- ⚪ `chat/Attachments.tsx` — tsx+react — deps: @livai/app/hooks/useChat — блок вложений (файлы, изображения и т.п.)
- ⚪ `chat/AttachmentsDragDrop.tsx` — tsx+react — deps: @livai/app/hooks/useChat — drag & drop UI для вложений
- ⚪ `chat/ChatHistory.tsx` — tsx+react — deps: @livai/app/hooks/useChat — список/лента истории сообщений
- ⚪ `chat/ChatListPanel.tsx` — tsx+react — deps: @livai/app/hooks/useChat — панель со списком чатов/разговоров
- ⚪ `chat/ChatListHeader.tsx` — tsx+react — deps: @livai/app/hooks/useChat — хедер списка чатов с фильтрами/режимами
- ⚪ `chat/CreateChatButton.tsx` — tsx+react — deps: @livai/app/hooks/useChat — кнопка создания тестового/нового чата
- ⚪ `chat/AIAgentStatusToggle.tsx` — tsx+react — deps: @livai/app/hooks/useChat — переключатель состояния AI-агента (активен/выключен)
- ⚪ `chat/ChatActionButtons.tsx` — tsx+react — deps: @livai/app/hooks/useChat — панель действий над чатом (закрыть, закрепить, поделиться и т.п.)
- ⚪ `chat/MessageInputBar.tsx` — tsx+react+effect — deps: @livai/app/hooks/useChat, @livai/app/hooks/useRealTime — расширенная панель ввода (текст, вложения, голос, AI-подсказки)
- ⚪ `chat/AdvancedModeToggle.tsx` — tsx+react — deps: @livai/app/hooks/useChat — переключатель «расширенный режим» для чата

### **UI-features / Admin** ⚪

- ⚪ `admin/DataTable.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — таблица данных с загрузкой через API
- ⚪ `admin/Pagination.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — пагинация для таблиц/списков
- ⚪ `admin/FiltersPanel.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — панель фильтров с запросами к API
- ⚪ `admin/StatCard.tsx` — tsx+react — deps: — карточка статистики (значение + подпись/иконка)
- ⚪ `admin/Chart.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — графики/чарты с данными из API
- ⚪ `admin/LogsViewer.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — просмотр логов/событий
- ⚪ `admin/UserRoleBadge.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — бейдж роли пользователя
- ⚪ `admin/EmptyState.tsx` — tsx+react — deps: — компонент пустого состояния с иконкой и описанием
- ⚪ `admin/DateRangePicker.tsx` — tsx+react — deps: @livai/app/hooks/useApi — выбор периода дат с подгрузкой данных
- ⚪ `admin/FilterDropdown.tsx` — tsx+react — deps: @livai/app/hooks/useApi — дропдаун-фильтр с запросами к API

### **UI-features / Billing** ⚪

- ⚪ `billing/PricingCard.tsx` — tsx+react — deps: — карточка тарифа/прайс-планов
- ⚪ `billing/InvoiceTable.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — таблица инвойсов
- ⚪ `billing/PaymentMethod.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — управление платёжным методом
- ⚪ `billing/BillingHistory.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — история списаний/платежей
- ⚪ `billing/SubscriptionStatus.tsx` — tsx+react — deps: — отображение текущего статуса подписки
- ⚪ `billing/BalanceDisplay.tsx` — tsx+react — deps: — карточка баланса для сайдбара/дашборда
- ⚪ `billing/BotStatusIndicator.tsx` — tsx+react — deps: — индикатор статуса бота в контексте биллинга
- ⚪ `billing/TransactionHistoryTable.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — таблица транзакций с вкладками/фильтрами
- ⚪ `billing/UsageGraph.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — график использования ресурсов/лимитов
- ⚪ `billing/StatSummaryCards.tsx` — tsx+react — deps: — набор сводных карточек с ключевыми метриками
- ⚪ `billing/PaymentModal.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — модальное окно оплаты с выбором метода
- ⚪ `billing/AmountInput.tsx` — tsx+react — deps: @livai/app/hooks/useApi — инпут суммы с валидацией и подсказками
- ⚪ `billing/TeamMemberSelector.tsx` — tsx+react — deps: — селектор количества участников/сидов
- ⚪ `billing/OrganizationFormFields.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — поля формы для данных организации
- ⚪ `billing/DocumentUploadSection.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — секция загрузки документов для биллинга

### **UI-features / PWA & Security** ⚪

- ⚪ `pwa/InstallPrompt.tsx` — tsx+react+effect — deps: @livai/app/lib/service-worker — UI-подсказка установки PWA
- ⚪ `pwa/OfflineIndicator.tsx` — tsx+react+effect — deps: @livai/app/hooks/useOfflineCache — индикатор оффлайн-режима
- ⚪ `pwa/UpdateNotification.tsx` — tsx+react+effect — deps: @livai/app/lib/service-worker — уведомление о доступном обновлении приложения
- ⚪ `security/PermissionsTable.tsx` — tsx+react — deps: @livai/app/hooks/useAuth, @livai/app/lib/route-access — таблица прав/ролей пользователя

### **UI-features / Marketplace** ⚪

- ⚪ `marketplace/MarketplaceCard.tsx` — tsx+react — deps: — карточка приложения/бота в маркетплейсе
- ⚪ `marketplace/CategoryTabs.tsx` — tsx+react — deps: — вкладки/табы категорий маркетплейса
- ⚪ `marketplace/MarketplaceSearch.tsx` — tsx+react+effect — deps: @livai/app/hooks/useApi — строка поиска по приложениям/ботам с запросами к API

### **Web / базовая конфигурация и i18n** ✅

- 🟢 `apps/web/package.json` — json — deps: — Next.js приложение, зависимости на `@livai/app`, `@livai/ui-core`, `@livai/ui-features`, `next`, `next-intl`
- 🟢 `apps/web/tsconfig.json` — json — deps: — TypeScript конфигурация с `paths` на workspace-пакеты (`@livai/app`, `@livai/ui-*`, `@livai/core`)
- 🟢 `apps/web/next.config.mjs` — mjs — deps: — конфигурация Next.js (App Router, i18n, security headers)
- 🟢 `apps/web/.env.example` — env — deps: — пример переменных окружения для web (API URL, NEXT_PUBLIC_* флаги)
- 🟢 `apps/web/src/env.ts` — ts — deps: zod — типизированная загрузка и валидация env-переменных
- 🟢 `apps/web/i18n/i18n.config.json` — json — deps: — список локалей и базовые настройки i18n
- 🟢 `apps/web/i18n/routing.ts` — ts — deps: — типобезопасные маршруты и тип `Locale` для i18n
- 🟢 `apps/web/i18n/request.ts` — ts — deps: next-intl, i18n/routing — серверная конфигурация next-intl (загрузка сообщений, middleware интеграция)
- 🟢 `apps/web/messages/en.json` — json — deps: — сообщения i18n EN
- 🟢 `apps/web/messages/ru.json` — json — deps: — сообщения i18n RU
- 🟢 `apps/web/src/app/globals.css` — css — deps: — глобальные стили приложения (reset, базовая типографика, layout)
- 🟢 `apps/web/public/manifest.json` — json — deps: — PWA manifest (иконки, название, тема)
- 🟢 `apps/web/src/sw.ts` — ts — deps: @livai/app/lib/service-worker — исходник Service Worker (использует SW-утилиты app-слоя)
- 🟢 `apps/web/public/sw.js` — js — deps: apps/web/src/sw — скомпилированный Service Worker
- 🟢 `apps/web/public/favicon.ts` — ts — deps: — favicon приложения (RSC endpoint)
- 🟢 `apps/web/src/app/icon-192.png/route.ts` — ts — deps: app/icons/_lib/pwa-icon-service — endpoint иконки 192x192 для PWA
- 🟢 `apps/web/src/app/icon-512.png/route.ts` — ts — deps: app/icons/_lib/pwa-icon-service — endpoint иконки 512x512 для PWA
- 🟢 `apps/web/src/app/robots.txt/route.ts` — ts — deps: app/robots.txt/_lib/robots-service — динамический endpoint robots.txt
- 🟢 `apps/web/src/app/sitemap.xml/route.ts` — ts — deps: app/sitemap.xml/_lib/sitemap-service — динамический endpoint sitemap.xml с i18n
- 🟢 `apps/web/middleware.ts` — ts — deps: next-intl, next-intl.config — i18n-routing middleware для Next.js

### **Web / layout и провайдеры** ✅

- 🟢 `apps/web/src/app/[locale]/layout.tsx` — tsx+react — deps: next-intl, next-intl.config — root layout с i18n (валidaция locale, `setRequestLocale`, генерация metadata/viewport)
- 🟢 `apps/web/src/app/providers.tsx` — tsx+react — deps: @livai/app — клиентский провайдер (композиция QueryClientProvider + провайдеры из `@livai/app`, логирование ошибок через `errorFireAndForget`)

### **Web / SW регистрация** 🟡

- 🟡 `apps/web/src/app/sw-register.ts` — ts — deps: — регистрация Service Worker на клиенте (инвариант: никаких доменных/бизнес-эффектов, только UX-обёртка — запрос разрешений, показ toast-уведомлений, перерегистрация)

### **Web / страницы (общие)** 🟡

- 🟡 `apps/web/src/app/[locale]/page.tsx` — tsx+react — deps: next-intl, i18n/routing — главная страница с i18n и навигацией (инвариант: никаких прямых API-вызовов и бизнес-логики, только ссылки/композиция `ui-features`/страниц)
- 🟡 `apps/web/src/app/[locale]/not-found.tsx` — tsx+react — deps: — кастомная 404-страница (НЕТ; инвариант: локализованное сообщение + fallback-ссылка, без feature-/API-кода)
- 🟡 `apps/web/src/app/[locale]/error.tsx` — tsx+react — deps: — кастомная 500-страница (НЕТ; инвариант: отображение ошибки + логирование через `@livai/app`, без прямых вызовов feature-слоя)
- 🟡 `apps/web/src/app/global-error.tsx` — tsx+react — deps: — глобальная error boundary Next.js 16+ (НЕТ; инвариант: логирование всех необработанных ошибок через `@livai/app`, UI-fallback без знания доменных деталей)

### **Web / Auth страницы** 🟡

- 🟡 `apps/web/src/app/[locale]/auth/login/page.tsx` — tsx+react — deps: i18n/routing, auth/login/LoginClient — серверный контейнер login (инвариант: чистый RSC без client-хуков и бизнес-логики, только проксирование клиента)
- 🟡 `apps/web/src/app/[locale]/auth/login/LoginClient.tsx` — tsx+react — deps: @livai/ui-features/auth/login-form, i18n/routing, next-intl — клиентский компонент login (инвариант: `LoginClient` не импортирует `@livai/feature-auth`, вся аутентификация идёт через app-слой/колбэки, переданные в форму)
- 🟡 `apps/web/src/app/[locale]/auth/register/page.tsx` — tsx+react — deps: i18n/routing, auth/register/RegisterClient — серверный контейнер register (аналогично login: только прокси)
- 🟡 `apps/web/src/app/[locale]/auth/register/RegisterClient.tsx` — tsx+react — deps: @livai/ui-features/auth/register-form, i18n/routing, next-intl — клиентский компонент register (инвариант: нет прямых импортов feature-auth, форма получает `onSubmit`/валидацию из app-слоя)

### **Web / Dashboard** 🟡

- 🟡 `apps/web/src/app/[locale]/dashboard/page.tsx` — tsx+react — deps: i18n/routing, dashboard/DashboardClient — серверный контейнер dashboard (инвариант: только композиция/передача props, без client-хуков и побочных эффектов)
- 🟡 `apps/web/src/app/[locale]/dashboard/DashboardClient.tsx` — tsx+react — deps: i18n/routing — клиентский dashboard (инвариант: нет прямых импортов `@livai/feature-*` и `@livai/core`, только `@livai/app` + `ui-features/admin`)

### **Web / Bots** ⚪

- ⚪ `apps/web/src/app/[locale]/bots/page.tsx` — tsx+react — deps: @livai/ui-features/bots/BotDashboard — страница «Боты» (контейнер вокруг `BotDashboard`, подключённый к AppProviders; инвариант: вся логика ботов — через `@livai/app`/`ui-features`, без прямых imports `@livai/feature-bots`)

### **Web / Balance & Billing** ⚪

- ⚪ `apps/web/src/app/[locale]/balance/page.tsx` — tsx+react — deps: @livai/ui-features/billing — страница «Баланс/Биллинг» с вкладками и компонентами биллинга (инвариант: никакой прямой работы с HTTP/API — только через хуки `@livai/app` внутри `ui-features/billing`)

### **Web / Marketplace** ⚪

- ⚪ `apps/web/src/app/[locale]/marketplace/page.tsx` — tsx+react — deps: @livai/ui-features/marketplace — страница маркетплейса с табами категорий и карточками приложений/ботов (инвариант: только композиция `ui-features/marketplace`, без прямых импортов feature-/core-слоя)

### **Web / Chat** ⚪

- ⚪ `apps/web/src/app/[locale]/chat/page.tsx` — tsx+react — deps: @livai/ui-features/chat/ChatInterface, @livai/ui-features/chat/ChatListPanel — страница чата (интерфейс диалогов + список чатов, подключение к real-time через хуки app-слоя внутри `ui-features`; инвариант: web-страница не знает про WebSocket/SSE, только про компоненты `ui-features`)

### **Web / Admin & Analytics** ⚪

- ⚪ `apps/web/src/app/[locale]/analytics/page.tsx` — tsx+react — deps: @livai/ui-features/admin — страница аналитики (графики, фильтры, таблицы; инвариант: все запросы/эффекты инкапсулированы в `ui-features/admin` и `@livai/app`, страницы остаются чистыми контейнерами)
- ⚪ `apps/web/src/app/[locale]/history/page.tsx` — tsx+react — deps: @livai/ui-features/admin — страница истории действий/сессий (таблица + фильтры; инвариант: никакой прямой работы с API внутри страницы)
- ⚪ `apps/web/src/app/[locale]/mailings/page.tsx` — tsx+react — deps: @livai/ui-features/admin — страница рассылок (таблица рассылок, фильтры, действия; инвариант: композиция admin-компонентов, все side-effects спрятаны в хуки/эффекты app-слоя)

---

### **Итоговые рекомендации и слои (Phase 2 UI)**

### **UI-компоненты**

- 🟡 **Интерактивные** (fetch, CRUD, real-time, формы) — ts-effect через app-слой + feature-эффекты; React-компоненты не управляют retry/timeout/cancellation напрямую.
- 🟢 **Чистый UI** — tsx+react, `ui-core`/`ui-shared`, подключение к store/hooks, без side-effects.
- 🟡 **Auth/Permission** — SSR-safe, использовать `AuthGuardContext`, `Permission`, `AuthGuardProvider` через app-слой (`route-access`, `ui-features/common/*Gate.tsx`), без прямых доменных вызовов.

### **Архитектурные слои**

- **2️⃣ Product Layer — то, что видит пользователь**: Bots, Chat, Marketplace, Billing, Admin, PWA — UI-компоненты в `ui-features` + web-страницы.
- **3️⃣ Platform Layer — возможности платформы**: создание ботов, RAG-настройка, real-time (WS/SSE + offline-cache), AI-агент, интеграции (CRM, Slack, Stripe и др.).
- **4️⃣ Infra Layer — фундамент платформы**: Effect runtime и boundaries (`@livai/core/effect`), API client + guards, observability (telemetry, feature flags), PWA (SW), security (auth-guard, permissions), типизированная конфигурация.
- **5️⃣ Developer Experience Layer — DX и монорепо**: domain-driven пакеты, `ui-core`/`ui-features`, hooks-фасад, единые providers + i18n, app-слой общий, feature-пакеты автономны, web — тонкий композитор.

### **Универсальность платформы**

- Любой SPA/WebApp/Dashboard/SaaS/Internal tool ложится на слои без изменений `core`/`app`.
- После реализации всех ⚪/🟡 компонентов платформа покрывает: SaaS, AI-продукты, маркетплейсы, админки, корпоративные порталы, PWA/offline-first, real-time, multi-tenant, i18n.

### **Сильное место — policies + contracts**

- **AuthPolicy, BotPolicy, BillingPolicy, ChatPolicy** — бизнес-правила высокого уровня.
- **route-permissions** — декларативные права доступа.
- **PermissionGate / RoleGate / AuthGuard** — UI-гейты.
- **feature-*.contract.ts** — типобезопасные контракты app ↔ feature.

Позволяет менять backend, делать white-label, выносить features в отдельные пакеты, подключать REST/GraphQL/BFF — при условии стабильного контракта (ports/DTO/schemas) и versioned migrations при изменениях API.

### **Phase Extensions / Optional**

- **Form engine**: schema → UI, динамические формы (billing/admin).
- **Table engine**: sorting/filtering/virtual scroll, колонка через schema.
- **Theme engine**: design tokens, runtime switching.
- **CMS adapter (optional)**: read-only контент, маркетинг-страницы.
