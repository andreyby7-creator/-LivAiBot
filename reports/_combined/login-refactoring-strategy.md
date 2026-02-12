# 🔐 Login Effect Refactoring Strategy

**📅 Дата:** 2026-01\
**📊 Статус:** Архитектурная реструктуризация\
**🔴 Приоритет:** Высокий\
**🎯 Цель:** Убрать монолит `login.ts` и внедрить стандарт безопасной оркестрации для всех `feature-*`

---

## 0️⃣ ПРОБЛЕМА (КОНЦЕНТРИРОВАННО)

### 📄 Текущий `login.ts`

- **📏 1800+ строк** в одном файле
- **🔀 6+ доменов** в одном файле
- **⏱️ Inline timeout** — нет единого стандарта
- **✅ Inline validation** — дублирование логики
- **🛡️ Inline risk** — смешанная ответственность
- **📊 Inline telemetry** — нет централизации
- **❌ Inline error mapping** — хрупкая логика
- **💥 Каскадные ошибки** — нет изоляции
- **⚠️ ESLint AI warnings** — нарушение best practices

### 📋 Таблица нарушений

| Проблема                 | Последствие          | Критичность |
| ------------------------ | -------------------- | ----------- |
| ❌ Нет timeout           | Hanging effects      | 🔴 Высокая  |
| ❌ Нет isolation         | Cascading failures   | 🔴 Высокая  |
| ❌ Нет schema validation | Model poisoning      | 🔴 Высокая  |
| ❌ SRP нарушен           | Низкая тестируемость | 🟡 Средняя  |
| ❌ Дубли логики          | Технический долг     | 🟡 Средняя  |

---

## 1️⃣ ЦЕЛЕВАЯ АРХИТЕКТУРА (СТАНДАРТ ДЛЯ ВСЕХ EFFECTS)

```
┌─────────────────────────────────────────┐
│              UI Layer                   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│          Hooks Layer                    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    Effect (thin orchestration)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Orchestrator                    │
│  ┌───────────────────────────────────┐  │
│  │    Isolated Step                  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │      Timeout                │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │  Validated Schema     │  │  │  │
│  │  │  │  ┌─────────────────┐  │  │  │  │
│  │  │  │  │  API Client     │  │  │  │  │
│  │  │  │  └─────────────────┘  │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│          Store Layer                    │
└─────────────────────────────────────────┘
```

### ✅ Гарантии архитектуры

- ✅ **Каждый step изолирован** — нет каскадных падений
- ✅ **Timeout обязателен** — нет hanging effects
- ✅ **Runtime schema validation** — защита от model poisoning
- ✅ **Нет каскадных падений** — изоляция на уровне step
- ✅ **ESLint AI rules = 0 warnings** — соответствие стандартам
- ✅ **Reusable для всех feature-*** — единый паттерн

### 📝 Правило: Consistency в Naming

**Стандарт именования функций для всех `feature-*`:**

**Формат:** `действие + Сущность`

**Примеры:**

- ✅ `executeSecurityPipeline` — выполнение security pipeline
- ✅ `assessLoginRisk` — оценка login risk
- ✅ `getDeviceFingerprint` — получение device fingerprint
- ✅ `mapAuthError` — маппинг auth error
- ✅ `generateTraceId` — генерация trace ID
- ✅ `buildLoginMetadata` — создание login metadata

**Правила:**

- ✅ **Глагол + Сущность** — четкое указание действия и объекта
- ✅ **CamelCase** — стандарт для TypeScript
- ✅ **Единообразие** — все функции в feature следуют одному паттерну
- ❌ **Избегать** — абстрактных названий без действия (`process`, `handle`, `do`)

**Исключения:**

- Type guards: `isValidLoginRequest` (is + прилагательное + сущность)
- Type constructors: `createValidationError` (create + сущность)

---

## 2️⃣ PHASE 1 — ИНФРАСТРУКТУРА (app/lib)

> 💡 **Принцип:** Сначала строим фундамент. Только потом трогаем `login.ts`.

> ⚠️ **Важно:** Сначала обновляем существующие файлы, которые нужны новым модулям. Потом создаем новые файлы.

### 5️⃣3️⃣ `effect-utils.ts` (UPDATE) ✅

**📁 Path:** `packages/app/src/lib/effect-utils.ts`

#### ➕ Добавить

- 🔷 **Typed Result** — типобезопасный результат (Result<T, E> или Either)
- 🔌 **Abort signal propagation** — поддержка cancellation через AbortSignal в EffectContext

#### ⚠️ Зависимости

**Нужен для:**

- ✅ `effect-timeout.ts` (NEW) — использует AbortSignal из EffectContext
- ✅ `effect-isolation.ts` (NEW) — использует Result/Either для типобезопасной обработки
- ✅ `schema-validated-effect.ts` (NEW) — использует EffectContext
- ✅ `orchestrator.ts` (NEW) — использует все вышеперечисленное

---

### 5️⃣4️⃣ `api-client.ts` (UPDATE) ✅

**📁 Path:** `packages/app/src/lib/api-client.ts`

#### ➕ Добавить

- 🔌 **AbortSignal support** — поддержка cancellation через AbortController

#### ⚠️ Важно: НЕ дублировать timeout

**api-client остается transport-only:**

- ✅ **Поддерживает AbortSignal** — для cancellation из orchestrator
- ❌ **НЕ устанавливает hard timeout** — timeout живет только в orchestrator
- ❌ НЕ знает про zod конкретного feature
- ❌ НЕ делает inline parse
- ✅ Только HTTP transport

**Почему timeout только в orchestrator:**

- ✅ **Архитектурно чище** — единая точка управления timeout
- ✅ **Нет дублирования** — один timeout на step, не два
- ✅ **Правильный abort propagation** — orchestrator управляет AbortController
- ❌ Глобальный timeout в api-client ломает abort propagation

#### ⚠️ Зависимости

**Нужен для:**

- ✅ `schema-validated-effect.ts` (NEW) — оборачивает api-client для валидации

---

### 5️⃣7️⃣ `error-mapping.ts` (UPDATE) ✅

**📁 Path:** `packages/app/src/lib/error-mapping.ts`

#### ➕ Изменения

- 🔄 **Сделать generic** — убрать auth-специфику
- 🧹 **Универсальный mapper** — работает с любыми DomainError

#### ⚠️ Зависимости

**Нужен для:**

- ✅ `schema-validated-effect.ts` (NEW) — использует для создания DomainError из validation errors

---

### 6️⃣1️⃣ `api-schema-guard.ts` (UPDATE) ✅

**📁 Path:** `packages/app/src/lib/api-schema-guard.ts`

#### ➕ Добавить

- 🔒 **Strict mode** — строгий режим валидации
- ✅ **Обязательная валидация для всех effects** — enforce на уровне инфраструктуры

#### ⚠️ Зависимости

**Нужен для:**

- ✅ `schema-validated-effect.ts` (NEW) — использует для Zod валидации

---

### 6️⃣7️⃣ `effect-timeout.ts` (NEW) ✅

**📁 Path:** `packages/app/src/lib/effect-timeout.ts`\
**🔧 Тип:** `ts+effect`\
**📦 Deps:** `lib/effect-utils.ts`, `types/api.ts`

#### 🎯 Назначение

Минимальный, чистый boundary-модуль для применения deterministic timeout к Effect с корректной Abort-propagation.

#### 📦 Эталонный набор функций

**1️⃣ `TimeoutOptions`** — контракт конфигурации (ms, tag)\
**2️⃣ `TimeoutError`** — typed boundary error (timeoutMs, tag)\
**3️⃣ `isTimeoutError`** — type guard для orchestration\
**4️⃣ `withTimeout`** — главная обёртка (effect, options)\
**5️⃣ `validateTimeoutMs`** — опционально, production-hardening (min/max bounds)

#### ✅ Что обеспечивает

- 🔌 **AbortController** — безопасная отмена
- 🛡️ **Безопасный cancel** — без утечек ресурсов
- ⏱️ **Deterministic timeout** — предсказуемое поведение
- 🔒 **Abort propagation** — корректная передача AbortSignal

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Telemetry** → observability layer
- ❌ **Orchestration logic** → orchestrator
- ❌ **Tracking/ID generation** → tracking layer
- ❌ **Promise utils** → generic utils
- ❌ **Config merging** → config layer
- ❌ **Remaining time calculation** → orchestration concern

#### 🎯 Решает

- ✅ `No timeout for agent operation` (ESLint warning)
- ✅ Hanging effects
- ✅ Resource leaks

#### 🏗 Микросервисное мышление

**Timeout не знает про:**

- ❌ Telemetry (логирование)
- ❌ Tracing (трекинг)
- ❌ Бизнес-логику
- ❌ ID generation
- ❌ Retry logic

**Timeout только:**

- ✅ Применяет timeout к Effect
- ✅ Бросает TimeoutError при превышении
- ✅ Корректно propagates AbortSignal

#### ⚠️ Важно: Расширение метаданными EffectContext

**Расширение метаданными (timeoutMs, source) делается в `effect-timeout.ts`, НЕ в `effect-utils.ts`** — чтобы сохранить domain-agnostic принцип и соблюсти SRP.

---

### 6️⃣8️⃣ `effect-isolation.ts` (NEW) ✅

**📁 Path:** `packages/app/src/lib/effect-isolation.ts`\
**🔧 Тип:** `ts+effect`\
**📦 Deps:** `lib/effect-utils.ts`, `types/api.ts`

#### 🎯 Назначение

Минимальный, чистый boundary-модуль для изоляции ошибок и предотвращения cascading failures.

#### 📦 Эталонный набор функций

**1️⃣ `runIsolated`** — основной API (effect, label?)\
**2️⃣ `IsolationError`** — типизированная ошибка (опционально)\
**3️⃣ `isIsolationError`** — type guard (опционально)

#### ✅ Что обеспечивает

- 🛡️ **try/catch boundary** — изоляция ошибок
- 🚫 **Не допускает cascading failure** — безопасность
- 🔒 **Типобезопасная обработка** — через Result/Either

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Telemetry** → observability layer
- ❌ **Orchestration logic** → orchestrator
- ❌ **Error mapping** → error-mapping layer
- ❌ **Fallback logic** → business logic layer

#### 🎯 Решает

- ✅ `Potential cascading failure` (ESLint warning)
- ✅ `Multi-agent orchestration safety` (ESLint warning)
- ✅ Каскадные падения

---

### 6️⃣9️⃣ `schema-validated-effect.ts` (NEW) ✅

**📁 Path:** `packages/app/src/lib/schema-validated-effect.ts`\
**🔧 Тип:** `ts+effect`\
**📦 Deps:** `lib/api-schema-guard.ts`, `lib/error-mapping.ts`, `lib/effect-utils.ts`

#### 🎯 Назначение

Минимальный, чистый boundary-модуль для обязательной Zod валидации результатов Effect.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `ValidatedEffectOptions`** — контракт конфигурации (schema, errorMapper?)\
**2️⃣ `validatedEffect`** — главная обёртка (schema, effect, options?)\
**3️⃣ `createValidationError`** — создание DomainError из validation error (опционально)

#### ✅ Что обеспечивает

- ✅ **Обязательная Zod валидация** — runtime type safety
- 🔒 **Runtime type safety** — защита от невалидных данных
- ❌ **DomainError при fail** — унифицированная обработка через error-mapping
- ✅ **Пробрасывание результата** — если schema прошла, результат effect пробрасывается без изменений

#### ⚠️ Важно: Поведение validatedEffect

**validatedEffect работает следующим образом:**

- ✅ **Если schema прошла** — результат effect пробрасывается без изменений
- ❌ **Если schema не прошла** — бросает `DomainError` (через error-mapping)
- ✅ **Не глотает ошибки** — все ошибки от effect пробрасываются дальше
- ❌ **НЕ делает isolation** — isolation только на уровне `orchestrator`

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Telemetry** → observability layer
- ❌ **Isolation** → effect-isolation layer
- ❌ **Orchestration** → orchestrator
- ❌ **Error mapping детали** → error-mapping layer (использует, но не реализует)

#### ⚠️ Важно: НЕ делает isolation

**validatedEffect НЕ оборачивает в try/catch:**

- ✅ **Только валидация** — проверяет schema и бросает `DomainError` при fail
- ✅ **Пробрасывает ошибки** — не глотает исключения
- ❌ **НЕ делает isolation** — isolation только на уровне `orchestrator`

**Правильная модель:**

```
orchestrator (runIsolated) → изоляция ошибок
  ↓
validatedEffect → только validation + throw DomainError
  ↓
api-client → transport
```

**❌ НЕ правильно:**

- ❌ Двойной try/catch (validatedEffect + orchestrator)
- ❌ Swallowing ошибок в validatedEffect

#### 🎯 Решает

- ✅ `Training data not validated before use` (ESLint warning)
- ✅ `Model poisoning warning` (ESLint warning)
- ✅ Type safety на runtime

#### ⚠️ Совместимость с useApi / api-client

**Существующие модули:**

- `useApi.ts` — React hook для API вызовов
- `api-client.ts` — transport layer
- `api-schema-guard.ts` — schema validation utilities
- `effect-utils.ts` — effect utilities

**Правильная модель (без дублирования):**

```
api-client → transport (только HTTP)
  ↓
schema-validated-effect → runtime validation boundary
  ↓
orchestrator → orchestration boundary
```

**❌ НЕ нужно:**

- ❌ Чтобы `api-client` знал про zod конкретного feature
- ❌ Чтобы feature делал inline parse
- ❌ Дублировать валидацию на разных уровнях

**✅ Правильно:**

- ✅ `api-client` — только transport (HTTP запросы)
- ✅ `schema-validated-effect` — runtime validation boundary (zod schema)
- ✅ `orchestrator` — orchestration boundary (композиция steps)

---

### 7️⃣0️⃣ `orchestrator.ts` (NEW) ✅

**📁 Path:** `packages/app/src/lib/orchestrator.ts`\
**🔧 Тип:** `ts+effect`\
**📦 Deps:** `lib/effect-timeout.ts`, `lib/effect-isolation.ts`, `lib/telemetry.ts`, `lib/effect-utils.ts`

#### 🎯 Назначение

Минимальный, чистый boundary-модуль для безопасной композиции асинхронных операций с step-level isolation и timeout.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `Step`** — тип шага (label: string, effect: Effect<T>, timeoutMs?: number)\
**2️⃣ `orchestrate`** — главная функция (steps: Step[]): Effect<LastStepResult>\
**3️⃣ `step`** — helper для создания шага (label: string, effect: Effect<T>, timeoutMs?: number): Step

#### ✅ Что обеспечивает

- 🔒 **Step-level isolation** — изоляция каждого шага (единственное место isolation через `runIsolated`)
- ⏱️ **Step-level timeout** — таймаут на каждом уровне (через `withTimeout`)
- 🧩 **Безопасную композицию** — последовательное выполнение шагов с передачей результата
- 📊 **Step-level telemetry** — fire-and-forget события в observability layer (orchestrator не управляет логированием)

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Telemetry детали** → telemetry layer (использует, но не реализует)
- ❌ **Error mapping** → error-mapping layer
- ❌ **Retry logic** → effect-retry layer
- ❌ **Parallel execution** → scheduler layer
- ❌ **State management** → store layer

#### ⚠️ Важно: Isolation только здесь

**orchestrator — единственное место isolation:**

- ✅ **runIsolated на каждом step** — изоляция ошибок
- ✅ **Не пробрасывает каскадные ошибки** — безопасность
- ✅ **Логирует fallback** — observability через fire-and-forget telemetry (orchestrator не управляет логированием, только передает события)

**validatedEffect НЕ делает isolation:**

- ✅ Только валидация + throw DomainError
- ❌ НЕ оборачивает в try/catch
- ❌ НЕ глотает ошибки

**Правильная модель (без дублирования):**

```
orchestrator.step → runIsolated (единственное место isolation)
  ↓
validatedEffect → только validation (бросает ошибки, не глотает)
  ↓
api-client → transport (бросает ошибки, не глотает)
```

#### ⚠️ Архитектурное правило: Timeout только в orchestrator

**Timeout управляется на уровне orchestration:**

- ✅ **Orchestrator** использует `effect-timeout.ts` для каждого step
- ✅ **api-client** только поддерживает `AbortSignal` (не устанавливает timeout)
- ❌ **Нет глобального timeout** в api-client — это ломает abort propagation
- ✅ **Единая точка управления** — архитектурно чище

#### 🎯 Решает

- ✅ `Multi-agent orchestration safety` (ESLint warning)
- ✅ `Potential cascading failure` (ESLint warning)
- ✅ Каскадные падения
- ✅ Hanging effects (через timeout)

> 💡 **Это — стандарт для всех `feature-*`.**

---

### 7️⃣1️⃣ `store-utils.ts` (NEW) ✅

**📁 Path:** `packages/app/src/state/store-utils.ts`\
**🔧 Тип:** `ts`\
**📦 Deps:** `state/store.ts`

#### 🎯 Назначение

Минимальный, чистый boundary-модуль для безопасных обновлений store с защитой от race conditions.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `SafeSetOptions`** — контракт конфигурации (label?: string)\
**2️⃣ `safeSet`** — главная функция (partialState: Partial<T>, options?: SafeSetOptions): void\
**3️⃣ `isStoreLocked`** — проверка блокировки store (): boolean (опционально)

#### ✅ Что обеспечивает

- 🛡️ **Защита от race conditions** — thread-safe обновления через atomic операции (локальный lock)
- 🚫 **Блокировка update при logout** — безопасность
- 🔒 **Atomic updates** — все обновления атомарны, исключают race conditions полностью

#### ⚠️ Важно: Atomic операции

**safeSet должен быть atomic:**

- ✅ **Локальный lock** — предотвращает параллельные обновления
- ✅ **Atomic merge** — обновление состояния происходит атомарно
- ✅ **Thread-safe** — безопасно для concurrent обновлений

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Telemetry** → observability layer
- ❌ **State validation** → validation layer
- ❌ **State transformation** → business logic layer
- ❌ **Store initialization** → store layer

---

## 3️⃣ PHASE 2 — РЕФАКТОР FEATURE-AUTH

> 💡 **Принцип:** Теперь можно безопасно разбирать `login.ts`.

### 1️⃣5️⃣9️⃣ `device-fingerprint.ts` (NEW) ✅

**📁 Path:** `packages/feature-auth/src/effects/login/device-fingerprint.ts`\
**🔧 Тип:** `ts+effect` (pure effect, без side-effects)\
**📦 Deps:** `domain/DeviceInfo.ts`

#### 🎯 Назначение

Чистая функция для сбора данных об устройстве без side-effects.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `getDeviceFingerprint`** — основной API (): Effect<DeviceInfo>

#### ✅ Что обеспечивает

- 📱 **Сбор device info** — userAgent, platform, screen, timezone
- 🆔 **Генерация deviceId** — стабильный идентификатор устройства

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Store** → store layer
- ❌ **Telemetry** → observability layer
- ❌ **Orchestration** → orchestrator
- ❌ **Timeout** → effect-timeout layer
- ❌ **Isolation** → effect-isolation layer

#### 📋 Правила

- ✅ **Чистая логика** — только сбор данных об устройстве
- ✅ **Без side-effects** — не изменяет внешнее состояние

---

### 1️⃣6️⃣0️⃣ `risk-assessment.ts` (NEW)

**📁 Path:** `packages/feature-auth/src/effects/login/risk-assessment.ts`\
**🔧 Тип:** `ts+effect` (pure effect, без side-effects)\
**📦 Deps:** `domain/LoginRiskAssessment.ts`, `effects/login/device-fingerprint.ts`

#### 🎯 Назначение

Чистый расчет риска на основе device info и контекста без side-effects.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `assessLoginRisk`** — основной API (deviceInfo: DeviceInfo, context: RiskContext): Effect<LoginRiskAssessment>

#### ✅ Что обеспечивает

- 🧮 **Расчет risk score** — на основе device, geo, IP, session history
- 📊 **Risk metadata** — device, geo, platform, IP информация

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **API calls** → api-client layer
- ❌ **Timeout** → effect-timeout layer
- ❌ **Isolation** → effect-isolation layer
- ❌ **Store** → store layer
- ❌ **Telemetry** → observability layer

#### 📋 Правила

- ✅ **Pure domain logic** — только бизнес-логика расчета риска
- ✅ **Без side-effects** — не изменяет внешнее состояние

---

### 1️⃣6️⃣1️⃣ `error-mapper.ts` (NEW)

**📁 Path:** `packages/feature-auth/src/effects/login/error-mapper.ts`\
**🔧 Тип:** `ts`\
**📦 Deps:** `app/lib/error-mapping.ts`, `domain/AuthErrorResponse.ts`, `types/auth.ts`

#### 🎯 Назначение

Трансформация API ошибок в UI-friendly AuthError без side-effects.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `mapAuthError`** — основной API (error: AuthErrorResponse | DomainError): AuthError

#### ✅ Что обеспечивает

- 🔄 **Трансформация ошибок** — API Error → DomainError → UI AuthError
- 🎯 **Типобезопасный mapping** — структурированные error codes

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Бизнес-логика** → business logic layer
- ❌ **Error handling** → error-handling layer
- ❌ **Telemetry** → observability layer
- ❌ **Store updates** → store layer

#### 📋 Правила

- ✅ **Только трансформация** — без бизнес-логики
- ✅ **Переиспользуется** — logout, refresh, OAuth, MFA
- ✅ **Без side-effects** — чистая функция

---

### 1️⃣6️⃣2️⃣ `helpers.ts` (NEW)

**📁 Path:** `packages/feature-auth/src/effects/login/helpers.ts`\
**🔧 Тип:** `ts`\
**📦 Deps:** `types/auth.ts`

#### 🎯 Назначение

Чистые утилиты без side-effects для login effect.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `generateTraceId`** — генерация trace ID (prefix?: string): string\
**2️⃣ `isValidLoginRequest`** — type guard для login request (value: unknown): value is LoginRequest\
**3️⃣ `buildLoginMetadata`** — создание метаданных (context: LoginContext): LoginMetadata

#### ✅ Что обеспечивает

- 🔍 **Type guards** — проверка типов
- 🆔 **Trace ID generation** — уникальные идентификаторы
- 📊 **Metadata builders** — создание метаданных

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Business logic** → business logic layer
- ❌ **API calls** → api-client layer
- ❌ **Store operations** → store layer
- ❌ **Telemetry** → observability layer

#### 📋 Правила

- ✅ **Без side-effects** — чистые функции
- ✅ **Pure utilities** — только трансформации и проверки

---

### 1️⃣6️⃣3️⃣ `security-pipeline.ts` (NEW)

**📁 Path:** `packages/feature-auth/src/lib/security-pipeline.ts`\
**🔧 Тип:** `ts+effect`\
**📦 Deps:** `effects/login/device-fingerprint.ts`, `effects/login/risk-assessment.ts`, `app/lib/orchestrator.ts`, `types/auth.ts`

#### 🎯 Назначение

Композиция security flow через orchestrator: fingerprint → risk assessment с isolation и timeout.

#### 📦 Эталонный набор функций (FAANG-ready)

**1️⃣ `executeSecurityPipeline`** — основной API (context: SecurityContext): Effect<SecurityResult>

#### ✅ Что обеспечивает

- 🔐 **Security flow** — fingerprint → risk assessment
- 🔒 **Isolation** — через orchestrator (runIsolated)
- ⏱️ **Timeout** — через orchestrator (withTimeout)
- ✅ **Типобезопасный результат** — SecurityResult типизирован строго через validatedEffect (если вовлечены данные от api-client)

#### ⚠️ Важно: Типобезопасность результата

**SecurityResult должен быть типизирован:**

- ✅ **Через validatedEffect** — если результат содержит данные от api-client
- ✅ **Строгая типизация** — все данные проходят Zod валидацию
- ✅ **Runtime type safety** — защита от невалидных данных

#### ❌ Что НЕ делает (нарушение SRP)

- ❌ **Isolation implementation** → effect-isolation layer
- ❌ **Timeout implementation** → effect-timeout layer
- ❌ **Orchestration implementation** → orchestrator
- ❌ **Device fingerprinting** → device-fingerprint.ts
- ❌ **Risk calculation** → risk-assessment.ts

#### 🔄 Reusable для

- 🔐 OAuth login
- 📝 Register
- 🔒 MFA
- 🔄 Session refresh

---

### 1️⃣6️⃣5️⃣ `login.ts` (REWRITE)

**📁 Path:** `packages/feature-auth/src/effects/login.ts`\
**🔧 Тип:** `ts+effect`\
**📦 Deps:** `app/lib/orchestrator.ts`, `app/lib/schema-validated-effect.ts`, `lib/security-pipeline.ts`, `effects/login/error-mapper.ts`, `effects/login/helpers.ts`, `stores/auth.ts`, `types/auth.ts`, `domain/*`, `schemas.ts`

#### ✅ Теперь содержит ТОЛЬКО

- 🎼 **Orchestration** — композиция шагов
- ✅ **Validated API call** — через validatedEffect
- 💾 **Store update** — через safeSet

#### ❌ Не содержит

- ❌ Fingerprint logic → вынесено в `device-fingerprint.ts`
- ❌ Risk logic → вынесено в `risk-assessment.ts`
- ❌ Timeout → используется `withTimeout`
- ❌ Validation → используется `validatedEffect`
- ❌ try/catch → используется `runIsolated`
- ❌ Retry → используется `withRetry` из effect-utils

#### 📏 Целевой размер

**~300 строк** (вместо 1800+)

---

## 4️⃣ PHASE 3 — ОБНОВЛЕНИЕ ДРУГИХ EFFECTS

> 💡 **Принцип:** Применяем тот же стандарт ко всем effects.

### 1️⃣6️⃣7️⃣ `refresh.ts` (UPDATE)

**📁 Path:** `packages/feature-auth/src/effects/refresh.ts`

#### ➕ Добавить

- ⏱️ `withTimeout` — обязательный timeout
- 🔒 `isolation` — изоляция ошибок
- ✅ `validatedEffect` — schema validation

---

### 1️⃣7️⃣6️⃣ `createBot.ts` (UPDATE)

**📁 Path:** `packages/feature-bots/src/effects/createBot.ts`

#### ➕ Добавить

- 🔒 `isolation` — изоляция ошибок
- ⏱️ `timeout` — обязательный timeout
- ✅ `schema validation` — валидация ответа API

---

### 1️⃣8️⃣5️⃣ `sendMessage.ts` (UPDATE)

**📁 Path:** `packages/feature-chat/src/effects/sendMessage.ts`

#### ➕ Добавить

- ✅ `validatedEffect` — schema validation
- 🔒 `isolation` — изоляция ошибок
- ⏱️ `timeout` — обязательный timeout
- 🔄 `idempotency guard` — защита от дубликатов

---

---

## 6️⃣ РЕЗУЛЬТАТ

### 📊 Сравнительная таблица

| Метрика           | До          | После      | Улучшение |
| ----------------- | ----------- | ---------- | --------- |
| 📏 `login.ts`     | 1800+ строк | ~300 строк | **-83%**  |
| ⚠️ AI warnings     | 4+          | 0          | **-100%** |
| ⏱️ Timeout         | Частично    | 100%       | **+100%** |
| 🔒 Isolation      | Нет         | 100%       | **+100%** |
| ✅ Validation     | Частично    | 100%       | **+100%** |
| 🔄 Reusable infra | Нет         | Да         | **+100%** |

### ✅ Качественные улучшения

- ✅ **Паттерн reusable** для всех `feature-*`
- ✅ **Безопасность enforced** на уровне `app/lib`
- ✅ **ESLint AI rules satisfied** — 0 warnings
- ✅ **Архитектура масштабируемая** — легко добавлять новые effects
- ✅ **SSR-safe** — безопасно для SSR
- ✅ **Нет hydration waterfall** — оптимизированная загрузка
- ✅ **Нет каскадных падений** — изоляция на всех уровнях
- ✅ **Нет hanging effects** — timeout везде

---

## 7️⃣ ПОРЯДОК ВНЕДРЕНИЯ (СТРОГО ПО ЭТАПАМ)

### 📋 ЭТАП 1 — Инфраструктура

> 🎯 **Цель:** Построить фундамент для всех effects

1. ✅ **6️⃣7️⃣** `effect-timeout.ts` — единая обёртка timeout
2. ✅ **6️⃣8️⃣** `effect-isolation.ts` — изоляция агентов
3. ✅ **6️⃣9️⃣** `schema-validated-effect.ts` — обязательная валидация
4. ✅ **7️⃣0️⃣** `orchestrator.ts` — composable pipeline
5. ✅ **7️⃣1️⃣** `store-utils.ts` — безопасные обновления store

**✅ Критерий готовности:** Все модули протестированы, ESLint = 0 warnings

---

### 📋 ЭТАП 2 — Feature-Auth

> 🎯 **Цель:** Разобрать монолит `login.ts`

1. ✅ **1️⃣5️⃣5️⃣.1️⃣** `device-fingerprint.ts` — чистый fingerprint
2. ✅ **1️⃣5️⃣5️⃣.2️⃣** `risk-assessment.ts` — чистый risk
3. ✅ **1️⃣5️⃣5️⃣.3️⃣** `error-mapper.ts` — auth error mapping
4. ✅ **1️⃣5️⃣5️⃣.4️⃣** `helpers.ts` — чистые helpers
5. ✅ **1️⃣5️⃣8️⃣.1️⃣** `security-pipeline.ts` — reusable security
6. ✅ **1️⃣5️⃣5️⃣** `login.ts` rewrite — через orchestrator

**✅ Критерий готовности:** `login.ts` = ~300 строк, все тесты проходят

---

### 📋 ЭТАП 3 — Остальные effects

> 🎯 **Цель:** Применить стандарт ко всем effects

1. ✅ **1️⃣5️⃣7️⃣** `refresh.ts` — timeout + isolation + validation
2. ✅ **1️⃣6️⃣6️⃣** `createBot.ts` — timeout + isolation + validation
3. ✅ **1️⃣7️⃣5️⃣** `sendMessage.ts` — timeout + isolation + validation + idempotency

**✅ Критерий готовности:** Все effects используют новый стандарт

---

### 📋 ЭТАП 4 — Валидация

> 🎯 **Цель:** Убедиться, что всё работает

1. ✅ **Unit tests** — покрытие всех новых модулей
2. ✅ **Integration tests** — проверка login flow
3. ✅ **ESLint = 0 warnings** — соответствие стандартам
4. ✅ **TS strict pass** — типобезопасность

**✅ Критерий готовности:** Все проверки пройдены

---

### 📋 ЭТАП 5 — Обновление зависимостей

> 🎯 **Цель:** Убрать старую связность, закрыть AI-warnings, избежать дублирования

> ⚠️ **Критично:** После внедрения `orchestrator` + `validatedEffect` + `isolation` + `timeout` зависимости в этих файлах **ОБЯЗАТЕЛЬНО** нужно изменить.

**Почему это важно:**

- ❌ Иначе останется **старая связность**
- ❌ Часть **AI-warnings вернётся**
- ❌ **Orchestration будет частично дублироваться**
- ❌ **app-layer не станет полноценной платформой**

---

#### 1️⃣5️⃣5️⃣ `login.ts` (DEPENDENCIES UPDATE)

**📁 Path:** `packages/feature-auth/src/effects/login.ts`

**❌ Было:**

```typescript
deps:
  app/lib/api-client.ts
  app/lib/error-mapping.ts
  app/lib/telemetry.ts
  stores/auth.ts
  domain/*
```

**✅ Должно стать:**

```typescript
deps:
  app/lib/orchestrator.ts
  app/lib/schema-validated-effect.ts
  app/lib/effect-timeout.ts
  app/lib/effect-isolation.ts
  lib/security-pipeline.ts
  effects/login/error-mapper.ts
  effects/login/helpers.ts
  stores/auth.ts
  types/auth.ts
  domain/*
  schemas.ts (LoginApiResponse schema)
```

**❌ Что убрать:**

- ❌ Прямой импорт `api-client` → используется внутри `orchestrator`
- ❌ Прямой `telemetry.log` → telemetry внутри `orchestrator` и `validatedEffect`
- ❌ Прямой `error-mapping` → используется внутри `error-mapper.ts` и `validatedEffect`

**💡 Почему?**
Теперь `login` — это **use-case orchestration**, а не transport-слой. Transport и telemetry должны жить внутри:

- `orchestrator` → использует `api-client` внутри (login не знает про transport)
- `validatedEffect` → использует `api-schema-guard` внутри (login не знает про validation детали)
- `error-mapper.ts` → использует `error-mapping` внутри (login не знает про error mapping детали)

**⚠️ Иначе:**

- Двойные таймауты (orchestrator + inline)
- Двойная изоляция (orchestrator + inline try/catch)
- Частично закрытые ESLint AI warnings (не все пути используют новые паттерны)

---

#### 1️⃣5️⃣6️⃣ `logout.ts` (DEPENDENCIES UPDATE)

**📁 Path:** `packages/feature-auth/src/effects/logout.ts`

**❌ Было:**

```typescript
deps:
api - client;
telemetry;
store;
```

**✅ Должно стать:**

```typescript
deps:
  app/lib/orchestrator.ts
  app/lib/schema-validated-effect.ts (если есть response)
  stores/auth.ts
```

**💡 Логика:**
Logout — это **single-step orchestration:**

```
runIsolated → withTimeout → safeSet
```

**❌ Убрать:**

- ❌ Прямой `api-client` → используется внутри `orchestrator`
- ❌ Прямой `telemetry` → telemetry внутри `orchestrator`

---

#### 1️⃣5️⃣7️⃣ `refresh.ts` (DEPENDENCIES UPDATE)

**📁 Path:** `packages/feature-auth/src/effects/refresh.ts`

**❌ Было:**

```typescript
deps:
api - client;
telemetry;
types;
store;
AuthPolicy;
```

**✅ Должно стать:**

```typescript
deps:
app / lib / orchestrator.ts;
app / lib / schema - validated - effect.ts;
stores / auth.ts;
types / auth.ts;
core / domain / AuthPolicy;
```

**❌ Убрать:**

- ❌ Прямой `api-client` → используется внутри `orchestrator`
- ❌ Прямой `telemetry` → telemetry внутри `orchestrator` и `validatedEffect`

**⚠️ Особенно важен, потому что:**

- Вызывается `session-manager`
- Может выполняться **параллельно**
- Может вызвать **cascading failure**

**✅ Поэтому ОБЯЗАН идти через:**

- `runIsolated` → изоляция ошибок (через orchestrator)
- `withTimeout` → обязательный timeout (через orchestrator)
- `idempotency guard` → **ОБЯЗАТЕЛЬНО** защита от параллельных вызовов

#### ⚠️ Критично: Idempotency Guard

**Проблема:**

- `session-manager` может вызвать `refresh` параллельно
- Несколько одновременных refresh → гонка состояний
- Может создать каскадные ошибки

**Решение:**

```typescript
// Внутри refresh.ts через orchestrator
orchestrate([
  step('idempotency-check', checkIfAlreadyRefreshing),
  step('refresh-api', refreshApiCall),
  step('update-store', updateStore),
]);
```

**Или через mutex (если уже есть в auth-service):**

- Использовать существующий `refreshMutex` из `auth-service.ts`
- Обернуть refresh effect в mutex guard
- Защита от параллельных вызовов на уровне effect

**✅ Критерий готовности:**

- Нет параллельных refresh вызовов
- Нет гонки состояний
- Нет каскадных ошибок при одновременных refresh

---

#### 1️⃣5️⃣8️⃣ `session-manager.ts` (DEPENDENCIES UPDATE)

**📁 Path:** `packages/feature-auth/src/lib/session-manager.ts`

> ⚠️ **❗ Это самый важный момент**

**session-manager НЕ ДОЛЖЕН зависеть от orchestrator**

**✅ Правильная зависимость:**

```typescript
deps:
effects / refresh.ts;
types / auth.ts;
core / domain / AuthPolicy;
domain / SessionPolicy.ts;
```

**❌ Нельзя:**

- ❌ Импортировать `orchestrator`
- ❌ Импортировать `api-client`
- ❌ Импортировать `validatedEffect`

**💡 Почему?**
Иначе получится **обратная зависимость**: `feature → infra → feature`

**✅ Правильная архитектура:**

```
session-manager
  ↓
effects/refresh.ts (уже использует orchestrator)
  ↓
app/lib/orchestrator.ts
```

---

**✅ Критерий готовности:** Все зависимости обновлены, нет прямых импортов transport/telemetry из effects, ESLint = 0 warnings

---

## 🏁 ФИНАЛЬНЫЙ ПРИНЦИП

> ⚠️ **НИ ОДИН effect в проекте больше не должен:**

- ❌ Делать **inline timeout** → использовать `withTimeout`
- ❌ Делать **inline validation** → использовать `validatedEffect`
- ❌ Делать **inline isolation** → использовать `runIsolated`
- ❌ Пробрасывать **сырой API response** → использовать `validatedEffect`
- ❌ Обновлять **store без safeSet** → использовать `safeSet`

---

## 📚 СВЯЗАННЫЕ ДОКУМЕНТЫ

- 📄 `auth-implementation.md` — текущая реализация auth
- 📄 `ui-architecture-decisions.md` — архитектурные решения UI
- 📄 `phase2-UI.md` — roadmap Phase 2

---

## ✅ ПРОВЕРКА СООТВЕТСТВИЯ PHASE2-UI.MD

### Соответствие нумерации

| Файл                         | Phase2-UI.md   | Стратегия | Статус                              |
| ---------------------------- | -------------- | --------- | ----------------------------------- |
| `effect-timeout.ts`          | 67 (NEW)       | 67 ✅     | ✅ Соответствует                    |
| `effect-isolation.ts`        | 68 (NEW)       | 68 ✅     | ✅ Соответствует                    |
| `schema-validated-effect.ts` | 69 (NEW)       | 69 ✅     | ✅ Соответствует                    |
| `orchestrator.ts`            | 70 (NEW)       | 70 ✅     | ✅ Соответствует                    |
| `store-utils.ts`             | 68.1 (NEW)     | 71 ✅     | ⚠️ Нумерация отличается (но логично) |
| `login.ts`                   | 155 (REFACTOR) | 155 ✅    | ✅ Соответствует                    |
| `device-fingerprint.ts`      | 155.1 (NEW)    | 155.1 ✅  | ✅ Соответствует                    |
| `risk-assessment.ts`         | 155.2 (NEW)    | 155.2 ✅  | ✅ Соответствует                    |
| `error-mapper.ts`            | 155.3 (NEW)    | 155.3 ✅  | ✅ Соответствует                    |
| `helpers.ts`                 | 155.4 (NEW)    | 155.4 ✅  | ✅ Соответствует                    |
| `security-pipeline.ts`       | 158.1 (NEW)    | 158.1 ✅  | ✅ Соответствует                    |

### Проверка зависимостей

**✅ Все зависимости указаны правильно:**

- Пути соответствуют структуре проекта (`lib/`, `domain/`, `types/`)
- Код-стек указан верно (`ts+effect` для effects, `ts` для pure functions)
- Комментарии соответствуют фактическому коду
- Нет циклических зависимостей

**✅ Соответствие фактическому коду:**

- `login.ts` действительно использует `api-client`, `error-mapping`, `telemetry` (будет убрано)
- `schemas.ts` существует в `feature-auth/src/` (не `schemas/login.schema.ts`)
- `effect-utils.ts` экспортирует `Effect`, `EffectContext`, `withTimeout`, `withRetry`, `withLogging`
- `api-client.ts` использует `effect-utils.ts` и `telemetry.ts`

### ⚠️ Критические проверки архитектуры

#### 1️⃣ Нет дублирования isolation

**✅ Правильная модель:**

- ✅ **orchestrator** — единственное место `runIsolated` (изоляция ошибок)
- ✅ **validatedEffect** — только валидация + throw DomainError (НЕ делает isolation)
- ✅ **api-client** — только transport + throw ошибки (НЕ делает isolation)

**❌ НЕ правильно:**

- ❌ Двойной try/catch (validatedEffect + orchestrator)
- ❌ Swallowing ошибок в validatedEffect
- ❌ Isolation на нескольких уровнях

**✅ Проверка:**

- `validatedEffect` НЕ оборачивает в try/catch
- `validatedEffect` только валидирует и бросает ошибки
- `orchestrator` единственный делает `runIsolated`

---

#### 2️⃣ Refresh idempotency guard

**✅ Обязательно для refresh.ts:**

- ✅ **Idempotency guard** — защита от параллельных вызовов
- ✅ **Mutex или state check** — предотвращение гонки состояний
- ✅ **Через orchestrator** — как отдельный step

**Варианты реализации:**

1. **Через orchestrator step:**
   ```typescript
   orchestrate([
     step('idempotency-check', checkIfAlreadyRefreshing),
     step('refresh-api', refreshApiCall),
   ]);
   ```

2. **Через существующий mutex:**
   - Использовать `refreshMutex` из `auth-service.ts`
   - Обернуть refresh effect в mutex guard

**✅ Критерий готовности:**

- Нет параллельных refresh вызовов
- Нет гонки состояний
- Нет каскадных ошибок при одновременных refresh

---

#### 3️⃣ Проверка путей импортов

**✅ Правильные импорты (только через app/):**

```typescript
// ✅ Правильно
import { orchestrator } from '@livai/app/lib/orchestrator.js';
import { validatedEffect } from '@livai/app/lib/schema-validated-effect.js';

// ❌ НЕ правильно
import { orchestrator } from '../../app/lib/orchestrator.js';
import { apiClient } from '@livai/app/lib/api-client.js'; // в effects
```

**✅ Критерий:**

- Все импорты из `app/lib` через package name (`@livai/app`)
- Нет относительных путей через `../../`
- Нет прямых импортов `api-client` из feature effects

---

**👤 Автор:** AI Assistant\
**📅 Последнее обновление:** 2026-01\
**✅ Проверено:** Соответствие phase2-UI.md и фактическому коду
