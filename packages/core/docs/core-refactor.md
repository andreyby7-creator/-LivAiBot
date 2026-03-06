# 🏗️ Архитектурный скелет: концепция рефакторинга core

**Дата создания:** 2026-03-06\
**Цель:** Определить архитектурные принципы и структуры для рефакторинга `packages/core` с применением Port/Adapter, Effect Architecture и Plugin System.

**Назначение:** Референсный документ для актуализации архитектуры core на любом этапе рефакторинга.

---

## 🏗️ Архитектурные принципы

### Core Principles

**1. Port / Adapter архитектура**

`core` содержит только порты (интерфейсы), реализации (адаптеры) в `app`.

```
core/ports/     → интерфейсы (TelemetryPort, TransportPort, etc.)
app/adapters/   → реализации (PosthogTelemetry, BrowserSSEAdapter, etc.)
```

**2. CoreContext для DI**

Единый `CoreContext` объект объединяет все порты, уменьшая dependency explosion.

```
core/context/CoreContext.ts
  - telemetry: TelemetryPort
  - featureFlags: FeatureFlagsPort
  - transport?: TransportPort
  - performance?: PerformancePort
  - cache?: CachePort
```

**3. Effect Architecture**

Весь core работает через эффекты, runtime подставляет реализации через Service Tags и Layers.

**Компоненты:**

- **Service Tags:** DI через Effect Context (`Context.Tag<ServiceType>`)
- **Services:** Интерфейсы, возвращающие `Effect<T>`
- **Runtime Layers:** Реализации через `Layer.mergeAll`
- **Effect.gen:** Декларативное описание операций

**Структура:**

```
core/
 ├─ services/ (Service Tags + интерфейсы)
 ├─ effects/ (pure логика через Effect)
 └─ pipeline/ (работает через Effect)

app/runtime/
 ├─ browser/ (реализации через Layers)
 ├─ node/ (опционально)
 ├─ edge/ (опционально)
 └─ tests/ (mock реализации)
```

**4. Plugin Architecture**

Core знает только `CorePlugin` interface, все модули — плагины.

**CorePlugin Interface:**

- `name: string`
- `setup?(ctx: CoreContext): void`
- `onRequest?(ctx: CoreContext, req: RequestContext): void`
- `onResponse?(ctx: CoreContext, res: ResponseContext): void`
- `onError?(ctx: CoreContext, error: Error): void`

**PluginRegistry:**

- Управляет lifecycle плагинов
- Вызывает hooks в правильном порядке
- Интегрируется с pipeline

**Готовые плагины:**

- `TelemetryPlugin` — отслеживание операций
- `RetryPlugin` — retry логика
- `CachePlugin` — кэширование
- `PerformancePlugin` — метрики производительности
- `FeatureFlagsPlugin` — feature flags проверки
- `TransportPlugin` — транспорт

**Преимущества комбинации принципов:**

- Core становится 100% pure и runtime-agnostic
- Легко тестировать (mock через Layer, без jest mocks)
- Легко добавлять новые runtime (browser/node/edge/worker/mobile) без изменения core
- Легко добавлять плагины без изменения ядра
- Декларативный код (описываем что, не как)
- Архитектура уровня Stripe SDK, Vercel AI SDK, Temporal Technologies

---

## 🏛️ Архитектура слоёв

### Архитектура зависимостей (Critical Rules)

**Правило:** Все зависимости идут только вниз (строго однонаправленно).

```
core-contracts
      ↓
      core
      ↓
   plugins
      ↓
   runtime
      ↓
     app
```

**❗ Критическое правило:** Никогда наоборот!

**Правила зависимостей:**

- `core-contracts` не зависит ни от чего
- `core` зависит только от `core-contracts`
- `plugins` зависят от `core` и `core-contracts`
- `runtime` зависит от `core`, `plugins` и `core-contracts`
- `app` зависит от всех слоёв

**Проверки:**

- `core-contracts` НЕ импортирует `core` или `app`
- `core` НЕ импортирует `app`, `plugins`, `runtime`
- `plugins` НЕ импортируют `runtime`, `app`
- `runtime` НЕ импортирует `app`

---

### Слои архитектуры

#### core-contracts

**Назначение:** Типовая база

**Содержит:**

- `domain/common.ts` — ID<T>, ISODateString, Json*
- `domain/app-effects.ts` — AppError, ClientError, ServerError
- `domain/telemetry.ts` — TelemetryEvent, TelemetryConfig
- `domain/feature-flags.ts` — FeatureFlag, FeatureFlagConfig

**Правила:**

- Не зависит ни от чего
- Только TypeScript типы
- Нет runtime зависимостей

#### core

**Назначение:** Чистая логика

**Содержит:**

- `services/` — Service Tags + интерфейсы
- `effects/` — pure логика через Effect
- `plugin-system/` — CorePlugin, PluginRegistry
- `context/` — CoreContext
- `plugins/` — готовые плагины
- `transport/`, `telemetry/`, `policies/`, `input-boundary/`

**Правила:**

- Не знает runtime
- Зависит только от `core-contracts`
- Использует Effect для всех операций
- Все зависимости через Service Tags

#### plugins

**Назначение:** Расширения системы

**Содержит:**

- `telemetry/`, `retry/`, `cache/`, `performance/`, `feature-flags/`, `transport/`

**Правила:**

- Зависят от `core` и `core-contracts`
- Реализуют `CorePlugin` interface
- Используют Service Tags
- Не знают runtime

#### runtime

**Назначение:** Реализации сервисов

**Содержит:**

- `browser/` — fetch, localStorage, posthog
- `node/` — undici, redis
- `edge/` — Edge APIs
- `tests/` — mock реализации

**Правила:**

- Зависит от `core`, `plugins`, `core-contracts`
- Реализует Service Tags
- Знает конкретные реализации
- Объединяет через `Layer.mergeAll`

#### app

**Назначение:** Сборка системы

**Содержит:**

- `runtime.ts` — инициализация Layer
- `plugins.ts` — регистрация плагинов
- `client.ts` — клиент для UI
- `lib/` — React hooks, UI-специфичное

**Правила:**

- Зависит от всех слоёв
- Собирает runtime и плагины
- Предоставляет UI-компоненты

---

### Pipeline Flow

**Полный flow от UI до транспорта:**

```
UI Component
  ↓
app/client.ts
  ↓
core/pipeline/executePipeline.ts
  ↓
plugins.onRequest()    (TelemetryPlugin, PerformancePlugin, etc.)
  ↓
core logic             (через Effect.gen)
  ↓
core/services          (Service Tags: Transport, Telemetry, etc.)
  ↓
runtime                (реализации через Layers)
  ↓
transport              (fetch/EventSource/WebSocket)
  ↓
plugins.onResponse()   (TelemetryPlugin, CachePlugin, etc.)
  ↓
result
```

**Обработка ошибок:**

- При ошибке вызывается `plugins.onError()`
- Плагины могут обработать ошибку (retry, logging, etc.)
- Ошибка пробрасывается дальше или обрабатывается

---

## 📊 Итоговая структура

### core-contracts

- **`domain/`** — Типы и контракты
  - `common.ts` — ID<T>, ISODateString, Json*
  - `app-effects.ts` — AppError, ClientError, ServerError
  - `telemetry.ts` — TelemetryEvent, TelemetryConfig
  - `feature-flags.ts` — FeatureFlag, FeatureFlagConfig

### core

- **`services/`** — Service Tags + интерфейсы
  - `Transport.ts`, `Telemetry.ts`, `Cache.ts`, `FeatureFlags.ts`, `Performance.ts`
- **`effects/`** — Pure логика через Effect
  - `offline-cache.ts`, `retry.ts`, `timeout.ts`
- **`plugin-system/`** — Система плагинов
  - `CorePlugin.ts`, `PluginRegistry.ts`
- **`context/`** — DI контекст
  - `CoreContext.ts`
- **`plugins/`** — Готовые плагины
  - `telemetry/`, `performance/`, `feature-flags/`, `cache/`, `retry/`, `transport/`
- **`transport/`** — Логика транспорта
  - `sse-client.ts`, `websocket.ts`
- **`telemetry/`** — Логика телеметрии
  - `batch-core.ts`, `client.ts`
- **`feature-flags/`** — Общий engine
  - `strategies.ts`, `hash.ts`, `types.ts`
- **`performance/`** — Метрики и пороги
  - `core.ts`
- **`policies/`** — Политики доступа
  - `auth-guard.ts`, `route-permissions.ts`
- **`input-boundary/`** — Boundary слой
  - `api-schema-guard.ts`

### app

- **`runtime/browser/`** — Browser реализации
  - `FetchTransport.ts`, `BrowserTelemetry.ts`, `BrowserCache.ts`, `browser-runtime.ts`
- **`runtime/node/`** — Node.js реализации (опционально)
  - `NodeTransport.ts`, `RedisCache.ts`, `node-runtime.ts`
- **`runtime/edge/`** — Edge реализации (опционально)
  - `EdgeTransport.ts`, `EdgeCache.ts`, `edge-runtime.ts`
- **`runtime/tests/`** — Mock реализации
  - `MockTransport.ts`, `MockCache.ts`, `test-runtime.ts`
- **`lib/`** — UI-специфичное
  - `performance.ts` (React hooks)
  - `telemetry-runtime.ts` (singleton, если нужен)

---

## 🔍 Критические правила и проверки

### Проверка направлений зависимостей

**Правило:** См. раздел "Архитектура зависимостей" выше.

**Команды проверки:**

```bash
grep -r "@livai/app" packages/core packages/core-contracts
grep -r "@livai/core" packages/core-contracts
grep -r "@livai/runtime\|@livai/app" packages/core
```

---

### Обновление package.json exports

**Правило:** После переноса обязательно обновить `exports` в `package.json` для всех подпакетов.

**Важно:** Без этого TS paths будут работать, а runtime — нет.

---

### Проверка tsconfig paths

**Правило:** Убедиться, что `tsconfig.base.json` содержит корректные paths для всех пакетов.

---

### Проверка циклических зависимостей

**Правило:** После переноса проверить циклы внутри пакетов.

**Команда:**

```bash
npx madge packages/core/src --circular
npx madge packages/core-contracts/src --circular
npx madge packages/app/src --circular
```

---

### Проверка runtime зависимостей

**Правило:** `core` НЕ использует браузерные/React API напрямую. Все через порты (Port/Adapter) или Service Tags (Effect Architecture).

**Запрещено в core:**

- `window`, `document`, `navigator`
- `localStorage`, `sessionStorage`
- `React`, `react-dom`
- DOM APIs
- Прямые вызовы posthog, sentry, console

**Команда проверки:**

```bash
grep -r "window\|document\|navigator\|localStorage\|React\|posthog\|sentry" packages/core/src
```

---

### EventEmitter в offline-cache

**Проблема:** `events` (Node.js) не всегда подходит для браузера.

**Решение:** Заменить `EventEmitter` из `events` на lightweight emitter (mitt/nanoevents/tiny-emitter) или создать свой `createEmitter()` без Node.js зависимостей.

---

### Проверка публичного API

**Правило:** После рефакторинга проверить стабильность внешнего API.

**Проверки:**

- Публичные экспорты не изменились
- Внешние API пакетов совместимы
- Tree-shaking работает корректно

**Команды:**

```bash
pnpm build
pnpm type-check
```

---

### Проверка порядка сборки

**Правило:** В монорепо важен порядок сборки: `core-contracts` → `core` → `app`

**Команды:**

```bash
pnpm build --filter @livai/core-contracts
pnpm build --filter @livai/core
pnpm build --filter @livai/app
```

---

### Feature flags naming collision

**Правило:** Явно разделить ответственность:

- `core/feature-flags/` — общий engine (MurmurHash, стратегии)
- `core/pipeline/feature-flags.ts` — pipeline rollout версии (остается без изменений)

---

## 🎯 Главный эффект архитектуры

**Через год можно добавить новые runtime:**

- `runtime/edge/` — Edge runtime (Cloudflare Workers, Vercel Edge)
- `runtime/worker/` — Web Workers
- `runtime/node/` — Node.js runtime
- `runtime/mobile/` — React Native / Mobile

**Без изменения:**

- ✅ `core` — остается без изменений
- ✅ `core-contracts` — остается без изменений
- ✅ `plugins` — остаются без изменений
- ✅ `app` — только добавляет новый runtime Layer

**Core остается неизменным!**

---

## ✅ Результат архитектуры

**Система становится:**

✅ **Portable** — легко переносить между runtime (browser/node/edge/worker/mobile)

✅ **Testable** — легко тестировать через mock Layers (без jest mocks)

✅ **Extensible** — легко добавлять плагины без изменения core

✅ **Runtime-agnostic** — core не знает конкретные реализации

✅ **Maintainable** — четкое разделение ответственности между слоями

✅ **Scalable** — легко добавлять новые runtime и плагины

**Архитектура уровня:**

- Stripe SDK
- Vercel AI SDK
- Temporal Technologies
- Effect-TS ecosystem

---

## ⚠️ Важные замечания

1. **Обратная совместимость:** Обновить все импорты в feature-пакетах и web
2. **Тесты:** Перенести тесты вместе с модулями
3. **Экспорты:** Обновить `index.ts` в core и core-contracts
4. **Зависимости:** Проверить циклические зависимости после переноса
5. **Документация:** Обновить JSDoc с новыми путями импорта
6. **Plugin Architecture:** Все модули превращаются в плагины через `CorePlugin` interface
7. **Effect Architecture:** Весь core работает через Effect, runtime подставляет реализации через Service Tags и Layers
8. **Миграция Ports → Services:** Мигрировать `ports/` в `services/` через Effect (Service Tags вместо прямых интерфейсов)
9. **Runtime Layers:** Создать `app/runtime/browser/` с реализациями через Effect Layers

---

**Этот документ — живой скелет архитектуры. Актуализируйте его по мере реализации рефакторинга.**
