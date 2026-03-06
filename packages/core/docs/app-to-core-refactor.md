# 📋 План рефакторинга: перенос инфраструктурных модулей из app в core

**Дата создания:** 2026-03-06\
**Цель:** Выделить инфраструктурные модули из `packages/app` в `packages/core` и `packages/core-contracts` для переиспользования и архитектурной чистоты.

---

## 📝 Инструкции по выполнению

**Порядок выполнения:**

1. Последовательно: сначала типы в `core-contracts`, потом модули в `core`
2. По одному файлу: делаем один файл, сразу адаптируем все зависимости на новые импорты (без временных реэкспортов)
3. Тесты: переносим после реализации и полной проверки файла
4. Валидация после каждого шага: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

---

## 1️⃣ Типы

### 1.1 `common.ts` → `core-contracts/domain/common.ts`

**Порядок:** Типы → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Добавить branded `ID<T>` и `ISODateString` в `core-contracts/src/domain/common.ts`
- ✅ Унифицировать `Json*` типы (сейчас дублируются в 3 местах)
- ✅ `packages/app/src/types/common.ts` → импортировать из `@livai/core-contracts`

**Файлы:**

- `packages/core-contracts/src/domain/common.ts` (расширить)
- `packages/app/src/types/common.ts` (удалить дубли, оставить только app-специфичные типы)

**Причина:** Фундаментальные контракты должны быть в foundation-слое, а не в app.

**Зависимости:**

- Текущий файл: только TypeScript типы, нет runtime зависимостей
- Нет React/DOM/runtime зависимостей → безопасно переносить в core-contracts
- Используется в: `app`, `feature-*` пакетах, `core/input-boundary/generic-validation.ts`
- Конфликты: `Json*` дублируются в `core-contracts/domain/app-effects.ts` и `core/input-boundary/generic-validation.ts`

**Миграция импорта:**

- `app/src/types/common.ts` → удалить `ID<T>`, `ISODateString`, `Json*`, оставить только app-специфичные (`Platform`, `AppContext`, `BaseDTO`, `RouteConfig`, `UserRoles`, `AppModules`)
- `app/src/types/errors.ts` → обновить `import type { ISODateString, Json } from '@livai/core-contracts'`
- `app/src/lib/*.ts` → обновить все импорты `ID`, `ISODateString`, `Json*` на `@livai/core-contracts`
- `feature-*` пакеты → обновить импорты на `@livai/core-contracts`
- `feature-auth/src/types/auth.ts` → удалить локальное определение `ISODateString` (строка 79), импортировать из `@livai/core-contracts/domain/common`
- `core/input-boundary/generic-validation.ts` → удалить локальные `Json*`, импортировать из `@livai/core-contracts`
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/types/common.test.ts` → обновить импорты, оставить тесты для app-специфичных типов
- Создать `core-contracts/tests/domain/common.test.ts` для branded типов и `Json*` утилит

**Экспорты:**

- Добавить в `core-contracts/src/index.ts`: `export * from './domain/common.js'`
- Проверить tree-shaking: убедиться, что не экспортируются неиспользуемые типы

**Обновление:** Обновлены импорты `ID<T>`, `ISODateString`, `Json*` в app и feature-пакетах на `@livai/core-contracts/domain/common`. Унифицированы `Json*` типы, удалены дубли из `core/input-boundary`. Исправлено дублирование `ISODateString` в `feature-auth/src/types/auth.ts` (удалено локальное определение, импорт из `@livai/core-contracts/domain/common`).

---

### 1.2 `errors.ts` → удалить из app

**Порядок:** Удаление → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Использовать `core-contracts/src/domain/app-effects.ts` (уже есть полное дублирование)
- ✅ `packages/app/src/types/errors.ts` → удалить, импортировать из `@livai/core-contracts`

**Файлы:**

- `packages/core-contracts/src/domain/app-effects.ts` (уже содержит `AppError`, `ClientError`, `ServerError`, `ValidationError`, `NetworkError`, `UnknownError`)
- `packages/app/src/types/errors.ts` (удалить)

**Причина:** Комментарий в `app-effects.ts` говорит "намеренно дублируют форму типов из @livai/app" — нужно убрать дублирование.

**Зависимости:**

- Текущий файл: импортирует `ApiError` из `./api.js`, `ISODateString`, `Json`, `Platform` из `./common.js`
- Нет React/DOM/runtime зависимостей → безопасно удалять из app
- Используется в: `app/src/lib/*.ts`, `app/src/ui/error-boundary.tsx`, `app/src/hooks/*.ts`
- Конфликты: полное дублирование в `core-contracts/domain/app-effects.ts` (комментарий подтверждает намеренное дублирование)

**Миграция импорта:**

- `app/src/types/errors.ts` → удалить файл полностью
- `app/src/lib/*.ts` → заменить `import type { AppError, ... } from '../types/errors.js'` на `import type { AppError, ... } from '@livai/core-contracts'`
- `app/src/ui/error-boundary.tsx` → обновить импорт
- `app/src/hooks/*.ts` → обновить импорты
- Проверить: `grep -r "from.*types/errors" packages/app/src` → заменить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/types/errors.test.ts` → удалить или перенести в `core-contracts/tests/domain/app-effects.test.ts`
- Обновить все тесты в `app/tests/unit/lib/*.test.ts`, использующие `AppError`

**Экспорты:**

- Убедиться, что `core-contracts/src/index.ts` экспортирует `export * from './domain/app-effects.js'`
- Проверить, что `app/src/types/index.ts` (если есть) не реэкспортирует удаленные типы

**Обновление:** Удален `app/src/types/errors.ts`, все импорты обновлены на `@livai/core-contracts/domain/app-effects`. Убрано дублирование типов ошибок.

---

## 2️⃣ Telemetry

### 2.0 `types/telemetry.ts` → `core-contracts/domain/telemetry.ts`

**Порядок:** Типы → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести типы телеметрии в `packages/core-contracts/src/domain/telemetry.ts`
- ✅ Убрать зависимость от `UiMetrics` (app-специфичный тип), оставить только фундаментальные типы
- ✅ `UiTelemetryMetrics` → удалить или сделать опциональным расширением в app

**Файлы:**

- `packages/app/src/types/telemetry.ts` → `packages/core-contracts/src/domain/telemetry.ts`
- Удалить зависимость от `app/src/types/ui-contracts.ts`

**Причина:** Фундаментальные типы телеметрии используются в core-модулях (`telemetry.ts`, `telemetry.batch-core.ts`), которые переносятся в `@livai/core`. Типы должны быть в foundation-слое.

**Зависимости:**

- Текущий файл: импортирует `UiMetrics` из `./ui-contracts.js` (только для алиаса `UiTelemetryMetrics`)
- Остальные типы: `TelemetryEvent`, `TelemetryConfig`, `TelemetrySink`, `TelemetryBatchCoreConfig`, etc. — фундаментальные, без app-зависимостей
- Используется в: `telemetry.ts`, `telemetry.batch-core.ts`, `telemetry-runtime.ts`, `logger.ts`

**Миграция импорта:**

- `app/src/types/telemetry.ts` → переместить в `core-contracts/src/domain/telemetry.ts`
- Удалить `import type { UiMetrics } from './ui-contracts.js'` и `export type UiTelemetryMetrics = UiMetrics`
- Если `UiTelemetryMetrics` нужен в app → создать `app/src/types/telemetry-extensions.ts` (опциональное расширение)
- Обновить все импорты: `grep -r "from.*types/telemetry" packages/app/src` → заменить на `@livai/core-contracts/domain/telemetry`
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/types/telemetry.test.ts` → переместить в `core-contracts/tests/domain/telemetry.test.ts`
- Обновить импорты в тестах

**Экспорты:**

- Добавить в `core-contracts/src/index.ts`: `export * from './domain/telemetry.js'`
- Проверить tree-shaking: убедиться, что типы экспортируются корректно

**Обновление:** Перенесены типы телеметрии в `@livai/core-contracts/domain/telemetry`. Удалена зависимость от `UiMetrics`. Обновлены импорты в `telemetry.ts`, `telemetry.batch-core.ts`, `telemetry-runtime.ts`, `logger.ts` и тестах.

---

### 2.1 `telemetry.batch-core.ts` → `core/telemetry/batch-core.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести чистое batch-ядро в `packages/core/src/telemetry/batch-core.ts`
- ✅ Убрать зависимости от runtime/React/DOM

**Файлы:**

- `packages/app/src/lib/telemetry.batch-core.ts` → `packages/core/src/telemetry/batch-core.ts`

**Причина:** Чистое ядро без side-effects, переиспользуемо в backend и других фронтах.

**Зависимости:**

- Текущий файл: импортирует только типы из `../types/telemetry.js` (TelemetryBatchCoreConfig, TelemetryEvent, etc.)
- **Типы телеметрии (`app/src/types/telemetry.ts`) → нужно перенести в `core-contracts/src/domain/telemetry.ts`** (используются в core-модулях)
- Нет runtime/React/DOM зависимостей → чистое ядро, безопасно переносить
- Используется в: `app/src/lib/telemetry.ts` (TelemetryClient использует batch-core)
- Влияние: `telemetry.ts` должен импортировать из `@livai/core/telemetry` после переноса

**Миграция импорта:**

- `app/src/types/telemetry.ts` → перенести в `core-contracts/src/domain/telemetry.ts` (убрать зависимость от `UiMetrics`, оставить только `UiTelemetryMetrics` как опциональный алиас или удалить)
- `app/src/lib/telemetry.batch-core.ts` → переместить в `core/src/telemetry/batch-core.ts`, обновить импорт типов на `@livai/core-contracts/domain/telemetry`
- `app/src/lib/telemetry.ts` → заменить `import { ... } from './telemetry.batch-core.js'` на `import { ... } from '@livai/core/telemetry/batch-core'`, обновить импорт типов
- Проверить: `grep -r "telemetry.batch-core" packages/app/src` → обновить все вхождения
- Проверить: `grep -r "from.*types/telemetry" packages/app/src` → обновить все вхождения на `@livai/core-contracts/domain/telemetry`
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/telemetry.batch-core.test.ts` → переместить в `core/tests/telemetry/batch-core.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/telemetry/batch-core'`

**Экспорты:**

- Добавить в `core-contracts/src/index.ts`: `export * from './domain/telemetry.js'` (типы)
- Добавить в `core/src/telemetry/index.ts`: `export * from './batch-core.js'`
- Добавить в `core/src/index.ts`: `export * as telemetry from './telemetry/index.js'` (или точечные экспорты)
- Проверить tree-shaking: убедиться, что не экспортируются неиспользуемые функции

**Обновление:** Перенесены типы телеметрии в `@livai/core-contracts/domain/telemetry`, `telemetry.batch-core.ts` в `@livai/core/telemetry/batch-core`. Обновлены импорты в `telemetry.ts` и тестах.

---

### 2.2 `telemetry.ts` → `core/telemetry/client.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести `TelemetryClient` в `packages/core/src/telemetry/client.ts`
- ✅ Оставить очередь/ретраи/дросселинг в core

**Файлы:**

- `packages/app/src/lib/telemetry.ts` → `packages/core/src/telemetry/client.ts`

**Причина:** Инфраструктурная подсистема для всех сервисов, не привязана к конкретному runtime.

**Зависимости:**

- Текущий файл: импортирует типы из `../types/telemetry.js`, использует `setTimeout` для retry (runtime, но не React/DOM)
- **Типы телеметрии (`app/src/types/telemetry.ts`) → нужно перенести в `core-contracts/src/domain/telemetry.ts`** (используются в core-модулях)
- Есть mutable state (eventQueue, throttleMap) → но это допустимо для инфраструктурного слоя
- Используется в: `app/src/lib/telemetry-runtime.ts`, `app/src/providers/TelemetryProvider.tsx`
- Влияние: `telemetry-runtime.ts` должен импортировать из `@livai/core/telemetry` после переноса

**Миграция импорта:**

- `app/src/types/telemetry.ts` → перенести в `core-contracts/src/domain/telemetry.ts` (убрать зависимость от `UiMetrics`, оставить только `UiTelemetryMetrics` как опциональный алиас или удалить)
- `app/src/lib/telemetry.ts` → переместить в `core/src/telemetry/client.ts`, обновить импорт типов на `@livai/core-contracts/domain/telemetry`
- `app/src/lib/telemetry.batch-core.ts` → обновить импорт типов на `@livai/core-contracts/domain/telemetry`
- `app/src/lib/telemetry-runtime.ts` → заменить `import { TelemetryClient, ... } from './telemetry.js'` на `import { TelemetryClient, ... } from '@livai/core/telemetry/client'`, обновить импорт типов
- `app/src/providers/TelemetryProvider.tsx` → обновить импорты
- `app/src/lib/logger.ts` → обновить импорт типов на `@livai/core-contracts/domain/telemetry`
- Проверить: `grep -r "from.*types/telemetry" packages/app/src` → обновить все вхождения на `@livai/core-contracts/domain/telemetry`
- Проверить: `grep -r "from.*lib/telemetry" packages/app/src` → обновить все вхождения (кроме `telemetry-runtime.ts`)
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/telemetry.test.ts` → переместить в `core/tests/telemetry/client.test.ts`
- Обновить импорты в тестах: `import { TelemetryClient, ... } from '@livai/core/telemetry/client'`

**Экспорты:**

- Добавить в `core-contracts/src/index.ts`: `export * from './domain/telemetry.js'` (типы)
- Добавить в `core/src/telemetry/index.ts`: `export * from './client.js'`
- Обновить `core/src/index.ts`: добавить экспорты telemetry
- Проверить tree-shaking: убедиться, что `TelemetryClient` и утилиты экспортируются корректно

**Обновление:** Перенесены типы телеметрии в `@livai/core-contracts/domain/telemetry`, `TelemetryClient` в `@livai/core/telemetry/client`. Обновлены импорты в `telemetry-runtime.ts`, `telemetry.batch-core.ts`, `logger.ts`, `TelemetryProvider.tsx` и тестах.

---

### 2.3 `telemetry-runtime.ts` → оставить в app

**Порядок:** Обновление импортов → валидация

**Действия:**

- ✅ Оставить в `packages/app/src/lib/telemetry-runtime.ts`
- ✅ Если есть runtime/React обвязка — остается в app

**Файлы:**

- `packages/app/src/lib/telemetry-runtime.ts` (без изменений)

**Причина:** Runtime singleton логика специфична для app-слоя.

**Зависимости:**

- Текущий файл: использует `TelemetryClient` из `./telemetry.js` (после миграции → `@livai/core/telemetry/client`)
- Есть runtime singleton логика (глобальный клиент) → специфично для app
- Используется в: `app/src/lib/*.ts` (offline-cache, sse-client, websocket, performance, api-schema-guard), `app/src/providers/TelemetryProvider.tsx`

**Миграция импорта:**

- Обновить импорт `TelemetryClient`: `import { TelemetryClient } from '@livai/core/telemetry/client'`
- Остальные импорты остаются без изменений
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/telemetry-runtime.test.ts` → обновить импорт `TelemetryClient` на `@livai/core/telemetry/client`
- Остальные тесты остаются без изменений

**Экспорты:**

- Без изменений (файл остается в app)

**Обновление:** Обновлен импорт `TelemetryClient` в `telemetry-runtime.ts` на `@livai/core/telemetry/client`. Runtime singleton остается в app.

---

## 3️⃣ Feature Flags

### 3.1 `feature-flags.ts` → `core/feature-flags/`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Создать новый подпакет `packages/core/src/feature-flags/`
- ✅ Перенести MurmurHash, стратегии, контекст, logger
- ✅ Оставить в core общий engine для backend и фронтов

**Файлы:**

- `packages/app/src/lib/feature-flags.ts` → `packages/core/src/feature-flags/index.ts`
- Создать структуру:
  - `packages/core/src/feature-flags/strategies.ts` (percentageRollout, etc.)
  - `packages/core/src/feature-flags/hash.ts` (MurmurHash)
  - `packages/core/src/feature-flags/types.ts` (контракты)

**Причина:** Детерминированный engine переиспользуем в backend и других фронтах. Pipeline feature flags (`core/pipeline/feature-flags.ts`) остаются для rollout-версий.

**Зависимости:**

- Текущий файл: импортирует `React` (только для типов, не используется в runtime), `ServicePrefix` из `@livai/core/effect`
- Нет DOM/runtime зависимостей → можно убрать React импорт, оставить только детерминированную логику
- Используется в: `app/src/providers/FeatureFlagsProvider.tsx`, `app/src/hooks/useFeatureFlags.ts`
- Влияние: после переноса `FeatureFlagsProvider` должен импортировать из `@livai/core/feature-flags`

**Миграция импорта:**

- `app/src/lib/feature-flags.ts` → разделить на модули в `core/src/feature-flags/`
- Удалить `import React from 'react'` (не используется в runtime)
- `app/src/providers/FeatureFlagsProvider.tsx` → заменить `import { ... } from '../lib/feature-flags.js'` на `import { ... } from '@livai/core/feature-flags'`
- `app/src/hooks/useFeatureFlags.ts` → обновить импорт
- Проверить: `grep -r "from.*lib/feature-flags" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/feature-flags.test.ts` → переместить в `core/tests/feature-flags/index.test.ts`
- `app/tests/unit/providers/FeatureFlagsProvider.test.tsx` → обновить импорт на `@livai/core/feature-flags`
- Обновить импорты в тестах

**Экспорты:**

- Создать `core/src/feature-flags/index.ts`: `export * from './types.js'`, `export * from './hash.js'`, `export * from './strategies.js'`
- Добавить в `core/src/index.ts`: `export * as featureFlags from './feature-flags/index.js'` (или точечные экспорты)
- Проверить tree-shaking: убедиться, что MurmurHash и стратегии экспортируются корректно

**Обновление:** Перенесен feature flags engine в `@livai/core/feature-flags`. Удален React импорт. Обновлены импорты в `FeatureFlagsProvider.tsx`, `useFeatureFlags.ts` и тестах. Pipeline feature flags остаются в `core/pipeline/feature-flags.ts`.

---

## 4️⃣ Offline Cache / Effect

### 4.1 `offline-cache.ts` → `core/effect/offline-cache.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести SWR-ядро в `packages/core/src/effect/offline-cache.ts`
- ✅ Убрать зависимости от React/DOM, оставить только Effect-интерфейс

**Файлы:**

- `packages/app/src/lib/offline-cache.ts` → `packages/core/src/effect/offline-cache.ts`

**Причина:** Универсальный механизм кэширования для любых эффектов, не привязан к UI.

**Зависимости:**

- Текущий файл: импортирует `EventEmitter` из `events` (Node.js), `Effect` из `@livai/core/effect`, `telemetry-runtime` из `./telemetry-runtime.js`
- `EventEmitter` → можно заменить на lightweight альтернативу или оставить (Node.js core модуль)
- `telemetry-runtime` → нужно убрать зависимость, использовать DI или опциональный logger
- Используется в: `app/src/hooks/useOfflineCache.ts` (React hook)
- Влияние: после переноса hook должен импортировать из `@livai/core/effect/offline-cache`

**Миграция импорта:**

- `app/src/lib/offline-cache.ts` → переместить в `core/src/effect/offline-cache.ts`
- Убрать зависимость от `telemetry-runtime`: использовать DI для logger или сделать опциональным
- `app/src/hooks/useOfflineCache.ts` → заменить `import { ... } from '../lib/offline-cache.js'` на `import { ... } from '@livai/core/effect/offline-cache'`
- Проверить: `grep -r "from.*lib/offline-cache" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/offline-cache.test.ts` → переместить в `core/tests/effect/offline-cache.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/effect/offline-cache'`
- Обновить моки для logger (если используется DI)

**Экспорты:**

- Добавить в `core/src/effect/index.ts`: `export * from './offline-cache.js'`
- Обновить `core/src/index.ts`: добавить экспорты effect (уже есть `export * as effect from './effect/index.js'`)
- Проверить tree-shaking: убедиться, что `createOfflineCache` и типы экспортируются корректно

**Обновление:** Перенесен SWR-ядро в `@livai/core/effect/offline-cache`. Убрана зависимость от `telemetry-runtime`, используется DI для logger. Обновлены импорты в `useOfflineCache.ts` и тестах.

---

## 5️⃣ Transport

### 5.1 `sse-client.ts` → `core/transport/sse-client.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Создать `packages/core/src/transport/` подпакет
- ✅ Перенести функциональный SSE FSM в `packages/core/src/transport/sse-client.ts`
- ✅ Оставить только EventSource-зависимость (опциональные адаптеры для браузера/Node)

**Файлы:**

- `packages/app/src/lib/sse-client.ts` → `packages/core/src/transport/sse-client.ts`

**Причина:** Универсальный SSE runtime для всех пакетов, не привязан к app.

**Зависимости:**

- Текущий файл: импортирует `EffectAbortController`, `EffectContext`, `EffectLogger` из `@livai/core/effect`, `telemetry-runtime` из `./telemetry-runtime.js`
- Использует `EventSource` (браузерный API) → нужно сделать адаптер для Node.js или опциональным
- `telemetry-runtime` → убрать зависимость, использовать DI для logger
- Используется в: возможно, в app hooks или компонентах

**Миграция импорта:**

- `app/src/lib/sse-client.ts` → переместить в `core/src/transport/sse-client.ts`
- Убрать зависимость от `telemetry-runtime`: использовать DI для logger
- Создать адаптер для `EventSource` (браузер/Node.js) или сделать опциональным
- Проверить: `grep -r "from.*lib/sse-client" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/sse-client.test.ts` → переместить в `core/tests/transport/sse-client.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/transport/sse-client'`
- Обновить моки для EventSource и logger

**Экспорты:**

- Создать `core/src/transport/index.ts`: `export * from './sse-client.js'`
- Добавить в `core/src/index.ts`: `export * as transport from './transport/index.js'` (или точечные экспорты)
- Проверить tree-shaking: убедиться, что FSM и типы экспортируются корректно

**Обновление:** Перенесен SSE FSM в `@livai/core/transport/sse-client`. Убрана зависимость от `telemetry-runtime`, используется DI для logger. Создан адаптер для EventSource. Обновлены импорты и тесты.

---

### 5.2 `websocket.ts` → `core/transport/websocket.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести функциональный WebSocket FSM в `packages/core/src/transport/websocket.ts`
- ✅ Оставить только FSM + effect-слой, без UI зависимостей

**Файлы:**

- `packages/app/src/lib/websocket.ts` → `packages/core/src/transport/websocket.ts`

**Причина:** Универсальный WebSocket runtime для всех пакетов.

**Зависимости:**

- Текущий файл: импортирует `EffectAbortController`, `EffectContext`, `EffectError`, `EffectLogger` из `@livai/core/effect`, `sleep`, `withLogging` из `@livai/core/effect`, `telemetry-runtime` из `./telemetry-runtime.js`
- Использует `WebSocket` (браузерный API) → нужно сделать адаптер для Node.js или опциональным
- `telemetry-runtime` → убрать зависимость, использовать DI для logger
- Используется в: возможно, в app hooks или компонентах

**Миграция импорта:**

- `app/src/lib/websocket.ts` → переместить в `core/src/transport/websocket.ts`
- Убрать зависимость от `telemetry-runtime`: использовать DI для logger
- Создать адаптер для `WebSocket` (браузер/Node.js) или сделать опциональным
- Проверить: `grep -r "from.*lib/websocket" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/websocket.test.ts` → переместить в `core/tests/transport/websocket.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/transport/websocket'`
- Обновить моки для WebSocket и logger

**Экспорты:**

- Добавить в `core/src/transport/index.ts`: `export * from './websocket.js'`
- Обновить `core/src/index.ts`: добавить экспорты transport
- Проверить tree-shaking: убедиться, что FSM и типы экспортируются корректно

**Обновление:** Перенесен WebSocket FSM в `@livai/core/transport/websocket`. Убрана зависимость от `telemetry-runtime`, используется DI для logger. Создан адаптер для WebSocket. Обновлены импорты и тесты.

---

## 6️⃣ Performance

### 6.1 `performance.ts` → разделить

**Порядок:** Разделение → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Ядро → `packages/core/src/performance/core.ts` (метрики, пороговые значения, интеграция с telemetry)
- ✅ React-хуки → оставить в `packages/app/src/lib/performance.ts` (только хуки)

**Файлы:**

- `packages/app/src/lib/performance.ts` → разделить на:
  - `packages/core/src/performance/core.ts` (чистое ядро)
  - `packages/app/src/lib/performance.ts` (только React hooks)

**Причина:** Метрики нужны и другим приложениям, но React-хуки специфичны для app.

**Зависимости:**

- Текущий файл: импортирует `randomUUID` из `crypto`, `Effect` из `effect`, `React`, `JsonObject` из `../types/common.js`, `telemetry-runtime` из `./telemetry-runtime.js`
- Ядро (метрики, пороги): `crypto`, `Effect`, `JsonObject` → можно перенести в core
- React-хуки: `usePerformanceProfiling`, `useWebVitalsTracking`, `useApiPerformanceTracking` → остаются в app
- `telemetry-runtime` → убрать зависимость из ядра, использовать DI для logger
- Используется в: возможно, в app компонентах через hooks

**Миграция импорта:**

- Разделить файл: ядро → `core/src/performance/core.ts`, hooks → `app/src/lib/performance.ts`
- Ядро: `createPerformanceMetric`, `collectWebVitalsMetric`, `collectComponentRenderMetric`, `collectApiResponseMetric`, `collectMemoryUsageMetric`, `addMetricToBuffer`, `flushMetricsBuffer`, `initPerformanceMonitoring`, `stopPerformanceMonitoring`, типы
- Hooks: `usePerformanceProfiling`, `useWebVitalsTracking`, `useApiPerformanceTracking`
- `app/src/lib/performance.ts` → импортировать ядро из `@livai/core/performance/core`
- Убрать зависимость от `telemetry-runtime` из ядра: использовать DI для logger
- Проверить: `grep -r "from.*lib/performance" packages/app/src` → обновить импорты hooks
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/performance.test.ts` → разделить:
  - `core/tests/performance/core.test.ts` (тесты ядра)
  - `app/tests/unit/lib/performance.test.ts` (тесты hooks)
- Обновить импорты в тестах

**Экспорты:**

- Создать `core/src/performance/index.ts`: `export * from './core.js'`
- Добавить в `core/src/index.ts`: `export * as performance from './performance/index.js'` (или точечные экспорты)
- `app/src/lib/performance.ts` → экспортировать hooks (без изменений для внешних импортов)

**Обновление:** Разделен `performance.ts`: ядро перенесено в `@livai/core/performance/core`, React-хуки остались в `app/src/lib/performance.ts`. Убрана зависимость от `telemetry-runtime` из ядра, используется DI для logger. Обновлены импорты и тесты.

---

## 7️⃣ API / Boundary

### 7.1 `api-schema-guard.ts` → `core/input-boundary/api-schema-guard.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести в `packages/core/src/input-boundary/api-schema-guard.ts`
- ✅ Оставить Effect-based валидацию, strict mode, размеры

**Файлы:**

- `packages/app/src/lib/api-schema-guard.ts` → `packages/core/src/input-boundary/api-schema-guard.ts`

**Причина:** Boundary-слой между транспортом и доменом, архитектурно ближе к core, чем к app.

**Зависимости:**

- Текущий файл: импортирует `createHash` из `crypto`, `Effect` из `effect`, `TaggedError`, `ValidationContext`, `ValidationError`, `Validator` из `@livai/core/effect`, `ApiServiceName`, `HttpMethod` из `../types/api.js`, `telemetry-runtime` из `./telemetry-runtime.js`
- Нет React/DOM зависимостей → безопасно переносить в core
- `telemetry-runtime` → убрать зависимость, использовать DI для logger
- `ApiServiceName`, `HttpMethod` → возможно, нужно перенести в `core-contracts` или оставить в app
- Используется в: возможно, в app API клиентах

**Миграция импорта:**

- `app/src/lib/api-schema-guard.ts` → переместить в `core/src/input-boundary/api-schema-guard.ts`
- Убрать зависимость от `telemetry-runtime`: использовать DI для logger
- Решить судьбу `ApiServiceName`, `HttpMethod`: перенести в `core-contracts` или сделать generic
- Проверить: `grep -r "from.*lib/api-schema-guard" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/api-schema-guard.test.ts` → переместить в `core/tests/input-boundary/api-schema-guard.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/input-boundary/api-schema-guard'`
- Обновить моки для logger

**Экспорты:**

- Добавить в `core/src/input-boundary/index.ts`: `export * from './api-schema-guard.js'`
- Обновить `core/src/index.ts`: добавить экспорты input-boundary (если есть namespace)
- Проверить tree-shaking: убедиться, что валидаторы экспортируются корректно

**Обновление:** Перенесен `api-schema-guard.ts` в `@livai/core/input-boundary/api-schema-guard`. Убрана зависимость от `telemetry-runtime`, используется DI для logger. Решена судьба `ApiServiceName`/`HttpMethod` (перенесены в `core-contracts` или сделаны generic). Обновлены импорты и тесты.

---

## 8️⃣ Policies / Auth

### 8.1 `route-permissions.ts` → `core/policies/route-permissions.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести декларативные правила доступа в `packages/core/src/policies/route-permissions.ts`
- ✅ Оставить только чистую политику без React зависимостей

**Файлы:**

- `packages/app/src/lib/route-permissions.ts` → `packages/core/src/policies/route-permissions.ts`

**Причина:** Декларативная политика как код, переиспользуема в разных runtime.

**Зависимости:**

- Текущий файл: импортирует `UserRoles` из `../types/common.js`, `AuthGuardContext`, `Permission`, `UserRole` из `./auth-guard.js`
- Нет React/DOM/runtime зависимостей → чистая политика, безопасно переносить
- Используется в: возможно, в app routes или guards
- Влияние: после переноса `auth-guard.ts` также нужно перенести, чтобы избежать циклических зависимостей

**Миграция импорта:**

- `app/src/lib/route-permissions.ts` → переместить в `core/src/policies/route-permissions.ts`
- Обновить импорты: `UserRoles` из `@livai/core-contracts` (после миграции 1.1), `AuthGuardContext`, `Permission`, `UserRole` из `@livai/core/policies/auth-guard` (после миграции 8.2)
- Проверить: `grep -r "from.*lib/route-permissions" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- `app/tests/unit/lib/route-permissions.test.ts` → переместить в `core/tests/policies/route-permissions.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/policies/route-permissions'`

**Экспорты:**

- Создать `core/src/policies/index.ts`: `export * from './route-permissions.js'`
- Добавить в `core/src/index.ts`: `export * as policies from './policies/index.js'` (или точечные экспорты)
- Проверить tree-shaking: убедиться, что политики экспортируются корректно

**Обновление:** Перенесены декларативные правила доступа в `@livai/core/policies/route-permissions`. Обновлены импорты `UserRoles` и `AuthGuardContext`. Обновлены импорты и тесты.

---

### 8.2 `auth-guard.ts` → `core/policies/auth-guard.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести типы и логику авторизации в `packages/core/src/policies/auth-guard.ts`
- ✅ Убрать React зависимости, оставить только pure логику

**Файлы:**

- `packages/app/src/lib/auth-guard.ts` → `packages/core/src/policies/auth-guard.ts`

**Причина:** Логика авторизации не привязана к UI, переиспользуема в backend и других фронтах.

**Зависимости:**

- Текущий файл: импортирует `React`, `createContext`, `useContext` из `react`, `TaggedError` из `@livai/core/effect`, `AuthContext`, `ID`, `UserRoles` из `../types/common.js`
- React Context (`createContext`, `useContext`) → убрать, оставить только pure логику и типы
- Используется в: `app/src/lib/route-permissions.ts`, возможно, в app guards или components
- Влияние: после переноса `route-permissions.ts` должен импортировать из `@livai/core/policies/auth-guard`

**Миграция импорта:**

- `app/src/lib/auth-guard.ts` → переместить в `core/src/policies/auth-guard.ts`
- Убрать React Context: удалить `createContext`, `useContext`, оставить только типы и pure функции
- Обновить импорты: `AuthContext`, `ID`, `UserRoles` из `@livai/core-contracts` (после миграции 1.1)
- `app/src/lib/route-permissions.ts` → обновить импорт на `@livai/core/policies/auth-guard` (после переноса)
- Если нужен React Context в app → создать `app/src/lib/auth-guard-context.tsx` (обертка над core)
- Проверить: `grep -r "from.*lib/auth-guard" packages/app/src` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` после удаления React

**Тесты:**

- `app/tests/unit/lib/auth-guard.test.ts` → переместить в `core/tests/policies/auth-guard.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/policies/auth-guard'`
- Убрать тесты React Context (если есть) → оставить в app

**Экспорты:**

- Добавить в `core/src/policies/index.ts`: `export * from './auth-guard.js'`
- Обновить `core/src/index.ts`: добавить экспорты policies
- Проверить tree-shaking: убедиться, что типы и функции экспортируются корректно

**Обновление:** Перенесены типы и логика авторизации в `@livai/core/policies/auth-guard`. Убраны React зависимости (Context), оставлена только pure логика. Создан `app/src/lib/auth-guard-context.tsx` для React обертки (если нужен). Обновлены импорты в `route-permissions.ts` и тестах.

---

## 9️⃣ Дубликаты / Унификация

### 9.1 AppError → оставить в core-contracts

**Порядок:** Уже выполнено (см. раздел 1.2)

**Действия:**

- ✅ Удалить `packages/app/src/types/errors.ts`
- ✅ Использовать `packages/core-contracts/src/domain/app-effects.ts`
- ✅ Обновить все импорты в app

**Причина:** Убрать дублирование, core-contracts — единый источник истины.

**Зависимости:**

- См. раздел 1.2 (полное дублирование уже есть в `core-contracts/domain/app-effects.ts`)

**Миграция импорта:**

- См. раздел 1.2 (детальная миграция импортов)

**Тесты:**

- См. раздел 1.2 (перенос тестов)

**Экспорты:**

- См. раздел 1.2 (экспорты core-contracts)

**Обновление:** См. раздел 1.2.

---

### 9.2 Json* → унифицировать в core-contracts

**Порядок:** Уже выполнено (см. раздел 1.1)

**Действия:**

- ✅ Унифицировать `JsonPrimitive`, `JsonValue`, `JsonArray`, `JsonObject` в `core-contracts/src/domain/common.ts`
- ✅ Удалить дубли из `app/types/common.ts` и `core/input-boundary/generic-validation.ts`
- ✅ Обновить импорты

**Причина:** Сейчас дублируются в 3 местах с разными структурами.

**Зависимости:**

- См. раздел 1.1 (Json* типы дублируются в 3 местах)

**Миграция импорта:**

- `core-contracts/src/domain/common.ts` → унифицировать `JsonPrimitive`, `JsonValue`, `JsonArray`, `JsonObject` (выбрать одну структуру, предпочтительно readonly)
- `app/src/types/common.ts` → удалить локальные `Json*`, импортировать из `@livai/core-contracts`
- `core/src/input-boundary/generic-validation.ts` → удалить локальные `Json*`, импортировать из `@livai/core-contracts`
- Проверить: `grep -r "type Json" packages` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- Обновить тесты, использующие `Json*` типы, на импорты из `@livai/core-contracts`

**Экспорты:**

- См. раздел 1.1 (экспорты core-contracts)

**Обновление:** Унифицированы `Json*` типы в `@livai/core-contracts/domain/common`. Удалены дубли из `app/types/common.ts` и `core/input-boundary/generic-validation.ts`. Обновлены все импорты.

---

### 9.3 ID<T> и ISODateString → добавить в core-contracts

**Порядок:** Уже выполнено (см. раздел 1.1)

**Действия:**

- ✅ Добавить branded `ID<T>` в `core-contracts/src/domain/common.ts`
- ✅ Добавить branded `ISODateString` (сейчас только алиас `Timestamp`)
- ✅ `packages/app/src/types/common.ts` → импортировать из `@livai/core-contracts`

**Причина:** Фундаментальные branded-типы должны быть в foundation-слое.

**Зависимости:**

- См. раздел 1.1 (branded типы должны быть в foundation-слое)

**Миграция импорта:**

- `core-contracts/src/domain/common.ts` → добавить branded `ID<T>` и `ISODateString` (сейчас `ISODateString` — алиас `Timestamp`, нужно сделать branded)
- `app/src/types/common.ts` → удалить локальные `ID<T>` и `ISODateString`, импортировать из `@livai/core-contracts`
- Проверить: `grep -r "type ID<" packages` → обновить все вхождения
- Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- Обновить тесты, использующие `ID<T>` и `ISODateString`, на импорты из `@livai/core-contracts`

**Экспорты:**

- См. раздел 1.1 (экспорты core-contracts)

**Обновление:** Добавлены branded `ID<T>` и `ISODateString` в `@livai/core-contracts/domain/common`. Удалены дубли из `app/types/common.ts`. Обновлены все импорты.

---

### 9.4 Feature flags (pipeline vs общий engine)

**Порядок:** Уже выполнено (см. раздел 3.1)

**Действия:**

- ✅ Общий engine (`feature-flags.ts`) → `core/feature-flags/`
- ✅ Pipeline feature flags (`core/pipeline/feature-flags.ts`) → остаются для rollout-версий
- ✅ Разделить ответственность: engine в core, доменные версии остаются

**Причина:** Разные домены (pipeline rollout vs общий feature flags), но engine переиспользуем.

**Зависимости:**

- См. раздел 3.1 (общий engine переносится в core)
- `core/pipeline/feature-flags.ts` → остается без изменений (rollout-версии pipeline)

**Миграция импорта:**

- См. раздел 3.1 (миграция общего engine)
- `core/pipeline/feature-flags.ts` → может использовать общий engine из `@livai/core/feature-flags` (опционально)
- Проверить: нет конфликтов между pipeline и общим engine

**Тесты:**

- См. раздел 3.1 (тесты общего engine)
- `core/pipeline/feature-flags.ts` → тесты остаются без изменений

**Экспорты:**

- См. раздел 3.1 (экспорты feature-flags)
- `core/pipeline/feature-flags.ts` → экспорты остаются без изменений

**Обновление:** Общий engine перенесен в `@livai/core/feature-flags`. Pipeline feature flags остаются в `core/pipeline/feature-flags.ts` для rollout-версий. Разделена ответственность: engine в core, доменные версии остаются.

---

### 9.5 API validation → разделить ответственность

**Порядок:** Уже выполнено (см. раздел 7.1)

**Действия:**

- ✅ `api-schema-guard.ts` → `core/input-boundary/` (boundary-слой)
- ✅ `core/effect/schema-validated-effect.ts` → остается (Zod → ValidationError маппинг)
- ✅ `core/input-boundary/generic-validation.ts` → остается (generic DTO валидация)
- ✅ Transport-specific валидация → в app по необходимости

**Причина:** Разные уровни абстракции: boundary (API) vs generic (DTO) vs transport (HTTP-специфика).

**Зависимости:**

- См. раздел 7.1 (api-schema-guard переносится в core)
- `core/effect/schema-validated-effect.ts` → остается без изменений (Zod → ValidationError)
- `core/input-boundary/generic-validation.ts` → остается без изменений (generic DTO)

**Миграция импорта:**

- См. раздел 7.1 (миграция api-schema-guard)
- `core/effect/schema-validated-effect.ts` → может использовать `api-schema-guard` для boundary-валидации (опционально)
- `core/input-boundary/generic-validation.ts` → остается независимым (generic DTO)
- Проверить: нет конфликтов между уровнями валидации

**Тесты:**

- См. раздел 7.1 (тесты api-schema-guard)
- `core/effect/schema-validated-effect.ts` → тесты остаются без изменений
- `core/input-boundary/generic-validation.ts` → тесты остаются без изменений

**Экспорты:**

- См. раздел 7.1 (экспорты api-schema-guard)
- `core/effect/schema-validated-effect.ts` → экспорты остаются без изменений
- `core/input-boundary/generic-validation.ts` → экспорты остаются без изменений

**Обновление:** Разделена ответственность валидации: `api-schema-guard` в `core/input-boundary` (boundary-слой), `schema-validated-effect` остается в `core/effect` (Zod → ValidationError), `generic-validation` остается в `core/input-boundary` (generic DTO). Transport-specific валидация остается в app.

---

## 🔟 Документация

### 10.1 Обновить документацию core

**Порядок:** После завершения всех миграций → обновление документации → валидация

**Действия:**

- ✅ Обновить `/home/boss/Projects/livai/packages/core/docs/architecture.md` в соответствии с новой архитектурой
- ✅ Обновить `/home/boss/Projects/livai/packages/core/README.md` в соответствии с новой архитектурой

**Файлы:**

- `packages/core/docs/architecture.md` (обновить структуру модулей, добавить новые подпакеты)
- `packages/core/README.md` (обновить описание пакета, примеры импортов, структуру)

**Причина:** Документация должна отражать актуальную архитектуру после рефакторинга.

**Что обновить:**

- Добавить описание новых подпакетов: `telemetry/`, `transport/`, `feature-flags/`, `performance/`
- Обновить структуру экспортов в `core/src/index.ts`
- Обновить примеры импортов для новых модулей
- Отразить разделение ответственности между core и app
- Обновить диаграммы архитектуры (если есть)

**Валидация:**

- Проверить, что все новые модули описаны в документации
- Убедиться, что примеры импортов актуальны
- Проверить ссылки на файлы и пути

**Обновление:** Документация обновлена в соответствии с новой архитектурой после рефакторинга.

---

## 📊 Итоговая структура

### Core-contracts (типы)

- `domain/common.ts` — ID<T>, ISODateString, Json* (унифицированные)
- `domain/app-effects.ts` — AppError и производные (уже есть)

### Core (инфраструктура)

- `telemetry/batch-core.ts` — чистое batch-ядро
- `telemetry/client.ts` — TelemetryClient
- `feature-flags/` — общий engine
- `effect/offline-cache.ts` — SWR-ядро
- `transport/sse-client.ts` — SSE runtime
- `transport/websocket.ts` — WebSocket runtime
- `performance/core.ts` — метрики и пороги
- `input-boundary/api-schema-guard.ts` — API валидация
- `policies/route-permissions.ts` — правила доступа
- `policies/auth-guard.ts` — логика авторизации

### App (runtime-специфичное)

- `lib/telemetry-runtime.ts` — runtime singleton
- `lib/performance.ts` — React hooks
- Остальные UI-специфичные модули

---

## ⚠️ Важные замечания

1. **Обратная совместимость:** Обновить все импорты в feature-пакетах и web
2. **Тесты:** Перенести тесты вместе с модулями
3. **Экспорты:** Обновить `index.ts` в core и core-contracts
4. **Зависимости:** Проверить циклические зависимости после переноса
5. **Документация:** Обновить JSDoc с новыми путями импорта
