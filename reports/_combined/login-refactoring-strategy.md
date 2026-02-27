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
**📦 Deps:** `app/lib/orchestrator.ts`, `app/lib/schema-validated-effect.ts`, `lib/security-pipeline.ts`, `lib/error-mapper.ts`, `effects/login/helpers.ts`, `stores/auth.ts`, `types/auth.ts`, `domain/*`, `schemas.ts`

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
  lib/error-mapper.ts
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
