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

### 1.1 `common.ts` → `core-contracts/domain/common.ts` ✅ **ВЫПОЛНЕНО**

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

- ✅ `app/src/types/common.ts` → удалить `ID<T>`, `ISODateString`, `Json*`, оставить только app-специфичные (`Platform`, `AppContext`, `BaseDTO`, `RouteConfig`, `UserRoles`, `AppModules`)
- ✅ `app/src/types/errors.ts` → обновить `import type { ISODateString, Json } from '@livai/core-contracts'` (через реэкспорт из `common.ts`)
- ✅ `app/src/lib/*.ts` → обновить все импорты `ID`, `ISODateString`, `Json*` на `@livai/core-contracts`
- ✅ `feature-*` пакеты → обновить импорты на `@livai/core-contracts`
- ✅ `feature-auth/src/types/auth.ts` → удалить локальное определение `ISODateString` (строка 79), импортировать из `@livai/core-contracts/domain/common`
- ✅ `core/input-boundary/generic-validation.ts` → удалить локальные `Json*`, импортировать из `@livai/core-contracts`
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- ✅ `app/tests/unit/types/common.test.ts` → обновить импорты, оставить тесты для app-специфичных типов
- ✅ Создать `core-contracts/tests/domain/common.test.ts` для branded типов и `Json*` утилит

**Экспорты:**

- ✅ Добавить в `core-contracts/src/index.ts`: `export * from './domain/common.js'` (через `domain/index.ts`)
- ✅ Проверить tree-shaking: убедиться, что не экспортируются неиспользуемые типы

**Обновление:** Обновлены импорты `ID<T>`, `ISODateString`, `Json*` в app и feature-пакетах на `@livai/core-contracts/domain/common`. Унифицированы `Json*` типы, удалены дубли из `core/input-boundary`. Исправлено дублирование `ISODateString` в `feature-auth/src/types/auth.ts` (удалено локальное определение, импорт из `@livai/core-contracts/domain/common`).

---

### 1.2 `errors.ts` → удалить из app ✅ **ВЫПОЛНЕНО**

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

- ✅ `app/src/types/errors.ts` → удалить файл полностью
- ✅ `app/src/lib/*.ts` → заменить `import type { AppError, ... } from '../types/errors.js'` на `import type { AppError, ... } from '@livai/core-contracts'`
- ✅ `app/src/ui/toast.tsx` → обновить импорт на `@livai/core-contracts`
- ✅ `app/src/ui/error-boundary.tsx` → использует `mapErrorBoundaryError` из `@livai/core/effect` (не требует прямого импорта типов ошибок)
- ✅ `app/src/hooks/*.ts` → обновить импорты (если используются)
- ✅ Проверить: `grep -r "from.*types/errors" packages/app/src` → все вхождения заменены
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary`

**Тесты:**

- ✅ `app/tests/unit/types/errors.test.ts` → удален
- ✅ Обновлены все тесты в `app/tests/unit/ui/*.test.tsx` (toast.test.tsx, error-boundary.test.tsx) на импорт из `@livai/core-contracts`
- ✅ `core-contracts/tests/domain/app-effects.test.ts` → расширен тестами для всех типов и утилитарных типов (ErrorFn, ErrorHandler, IsErrorOfType)

**Экспорты:**

- ✅ Убедиться, что `core-contracts/src/index.ts` экспортирует `export * from './domain/app-effects.js'` (через `domain/index.ts`)
- ✅ Проверить, что `app/src/types/index.ts` не реэкспортирует удаленные типы (реэкспорты удалены)

**Обновление:** Удален `app/src/types/errors.ts`, все импорты обновлены на `@livai/core-contracts`. Убрано дублирование типов ошибок. Добавлены утилитарные типы (ErrorFn, ErrorHandler, IsErrorOfType) в `core-contracts/src/domain/app-effects.ts`. Удалены реэкспорты типов ошибок из `app/src/types/index.ts` и `app/src/index.ts`. Все тесты обновлены и расширены для полного покрытия типов.

---

## 2️⃣ Telemetry

### 2.0 `types/telemetry.ts` → `core-contracts/domain/telemetry.ts` ✅ **ВЫПОЛНЕНО**

**Порядок:** Типы → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести типы телеметрии в `packages/core-contracts/src/domain/telemetry.ts`
- ✅ Убрать зависимость от `UiMetrics` (app-специфичный тип), оставить только фундаментальные типы
- ✅ `UiTelemetryMetrics` → временно оставлен в app для сборки, после полного переключения импортов будет заменен на `UiMetrics` и удален алиас

**Файлы:**

- `packages/app/src/types/telemetry.ts` → `packages/core-contracts/src/domain/telemetry.ts`
- Удалить зависимость от `app/src/types/ui-contracts.ts`

**Причина:** Фундаментальные типы телеметрии используются в core-модулях (`telemetry.ts`, `telemetry.batch-core.ts`), которые переносятся в `@livai/core`. Типы должны быть в foundation-слое.

**Зависимости:**

- Текущий файл: импортирует `UiMetrics` из `./ui-contracts.js` (только для алиаса `UiTelemetryMetrics`)
- Остальные типы: `TelemetryEvent`, `TelemetryConfig`, `TelemetrySink`, `TelemetryBatchCoreConfig`, etc. — фундаментальные, без app-зависимостей
- Используется в: `telemetry.ts`, `telemetry.batch-core.ts`, `telemetry-runtime.ts`, `logger.ts`

**Миграция импорта:**

- ✅ `app/src/types/telemetry.ts` → скопирован в `core-contracts/src/domain/telemetry.ts` (исходник оставлен для совместимости)
- ✅ Удален `import type { UiMetrics } from './ui-contracts.js'` и `export type UiTelemetryMetrics = UiMetrics` из нового файла
- ✅ Обновлены все импорты в `app/src/lib/*.ts`, `app/src/providers/*.tsx` на `@livai/core-contracts` (импорт из корня)
- ✅ Обновлен реэкспорт в `app/src/types/index.ts` (типы из `@livai/core-contracts`, `UiTelemetryMetrics` временно из локального файла)
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` — пройдена

**Тесты:**

- ✅ `app/tests/unit/types/telemetry.test.ts` → скопирован в `core-contracts/tests/unit/domain/telemetry.test.ts` (исходник оставлен для совместимости)
- ✅ Обновлены импорты в тестах (используется прямой импорт из `../../../src/domain/telemetry.js` для тестов внутри core-contracts)
- ✅ Удален тест для `UiTelemetryMetrics` (тип больше не экспортируется из core-contracts)

**Экспорты:**

- ✅ Добавлено в `core-contracts/src/domain/index.ts`: `export * from './telemetry.js'` (через domain/index.ts)
- ✅ Проверено tree-shaking: типы экспортируются корректно через `@livai/core-contracts`

**Обновление:** Перенесены типы телеметрии в `@livai/core-contracts/src/domain/telemetry.ts`. Удалена зависимость от `UiMetrics`. Обновлены импорты в `telemetry.ts`, `telemetry.batch-core.ts`, `telemetry-runtime.ts`, `logger.ts`, `TelemetryProvider.tsx`, `UnifiedUIProvider.tsx` и тестах. Все типы теперь импортируются из `@livai/core-contracts` (из корня). `UiTelemetryMetrics` временно оставлен в app для совместимости, будет удален после полного переключения импортов.

---

### 2.1 `telemetry.batch-core.ts` → `core/telemetry/batch-core.ts` ✅ **ВЫПОЛНЕНО**

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести чистое batch-ядро в `packages/core/src/telemetry/batch-core.ts`
- ✅ Убрать зависимости от runtime/React/DOM

**Файлы:**

- ✅ `packages/app/src/lib/telemetry.batch-core.ts` → `packages/core/src/telemetry/batch-core.ts` (удален из app)

**Причина:** Чистое ядро без side-effects, переиспользуемо в backend и других фронтах.

**Зависимости:**

- ✅ Текущий файл: импортирует только типы из `@livai/core-contracts` (TelemetryBatchCoreConfig, TelemetryEvent, etc.)
- ✅ Типы телеметрии перенесены в `core-contracts/src/domain/telemetry.ts`
- ✅ Нет runtime/React/DOM зависимостей → чистое ядро, безопасно переносить
- ✅ Используется в: `core/src/telemetry/client.ts` (TelemetryClient использует batch-core)
- ✅ Влияние: все импорты обновлены на `@livai/core/telemetry`

**Миграция импорта:**

- ✅ `app/src/types/telemetry.ts` → удален, типы в `core-contracts/src/domain/telemetry.ts`
- ✅ `app/src/lib/telemetry.batch-core.ts` → перемещен в `core/src/telemetry/batch-core.ts`, обновлен импорт типов на `@livai/core-contracts`
- ✅ `core/src/telemetry/client.ts` → использует `import { ... } from './batch-core.js'`
- ✅ Проверено: все вхождения `telemetry.batch-core` обновлены
- ✅ Проверено: все вхождения `from.*types/telemetry` обновлены на `@livai/core-contracts`
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` — пройдена

**Тесты:**

- ✅ `app/tests/unit/lib/telemetry.batch-core.test.ts` → перемещен в `core/tests/telemetry/batch-core.test.ts`
- ✅ Обновлены импорты в тестах: `import { ... } from '@livai/core/telemetry/batch-core'`

**Экспорты:**

- ✅ Добавлено в `core-contracts/src/domain/index.ts`: `export * from './telemetry.js'` (типы)
- ✅ Добавлено в `core/src/telemetry/index.ts`: `export * from './batch-core.js'`
- ✅ Проверено tree-shaking: функции экспортируются корректно через `@livai/core/telemetry`

**Обновление:** Перенесены типы телеметрии в `@livai/core-contracts/domain/telemetry`, `telemetry.batch-core.ts` в `@livai/core/telemetry/batch-core`. Обновлены импорты в `client.ts` и тестах. Удалены старые файлы из app.

---

### 2.2 `telemetry.ts` → `core/telemetry/client.ts` ✅ **ВЫПОЛНЕНО**

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести `TelemetryClient` в `packages/core/src/telemetry/client.ts`
- ✅ Оставить очередь/ретраи/дросселинг в core
- ✅ Выделить `sanitization.ts` и `sinks.ts` для разделения ответственности (SRP)

**Файлы:**

- ✅ `packages/app/src/lib/telemetry.ts` → `packages/core/src/telemetry/client.ts` (удален из app)
- ✅ Создан `packages/core/src/telemetry/sanitization.ts` (PII detection & metadata sanitization)
- ✅ Создан `packages/core/src/telemetry/sinks.ts` (sink factories и retry логика)

**Причина:** Инфраструктурная подсистема для всех сервисов, не привязана к конкретному runtime.

**Зависимости:**

- ✅ Текущий файл: импортирует типы из `@livai/core-contracts`, использует `setTimeout` для retry (runtime, но не React/DOM)
- ✅ Типы телеметрии перенесены в `core-contracts/src/domain/telemetry.ts`
- ✅ Есть mutable state (eventQueue, throttleMap) → допустимо для инфраструктурного слоя
- ✅ Используется в: `app/src/lib/telemetry-runtime.ts`, `app/src/providers/TelemetryProvider.tsx`
- ✅ Влияние: `telemetry-runtime.ts` импортирует из `@livai/core/telemetry`

**Миграция импорта:**

- ✅ `app/src/types/telemetry.ts` → удален, типы в `core-contracts/src/domain/telemetry.ts`
- ✅ `app/src/lib/telemetry.ts` → перемещен в `core/src/telemetry/client.ts`, обновлен импорт типов на `@livai/core-contracts`
- ✅ `app/src/lib/telemetry-runtime.ts` → заменен `import { TelemetryClient, ... } from './telemetry.js'` на `import { TelemetryClient, ... } from '@livai/core/telemetry'`
- ✅ `app/src/providers/TelemetryProvider.tsx` → обновлены импорты на `@livai/core/telemetry`
- ✅ `app/src/lib/logger.ts` → обновлен импорт типов на `@livai/core-contracts`
- ✅ Проверено: все вхождения `from.*types/telemetry` обновлены на `@livai/core-contracts`
- ✅ Проверено: все вхождения `from.*lib/telemetry` обновлены (кроме `telemetry-runtime.ts`)
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` — пройдена

**Тесты:**

- ✅ `app/tests/unit/lib/telemetry.test.ts` → перемещен в `core/tests/telemetry/client.test.ts`
- ✅ Обновлены импорты в тестах: `import { TelemetryClient, ... } from '@livai/core/telemetry'`

**Экспорты:**

- ✅ Добавлено в `core-contracts/src/domain/index.ts`: `export * from './telemetry.js'` (типы)
- ✅ Добавлено в `core/src/telemetry/index.ts`: `export { TelemetryClient } from './client.js'` и экспорты из `sinks.ts`
- ✅ Проверено tree-shaking: `TelemetryClient` и утилиты экспортируются корректно через `@livai/core/telemetry`

**Обновление:** Перенесены типы телеметрии в `@livai/core-contracts/domain/telemetry`, `TelemetryClient` в `@livai/core/telemetry/client`. Выделены модули `sanitization.ts` и `sinks.ts` для разделения ответственности (SRP). Обновлены импорты в `telemetry-runtime.ts`, `logger.ts`, `TelemetryProvider.tsx` и тестах. Удалены старые файлы из app. Удалены легаси-экспорты из `app/src/lib/index.ts` и `app/src/index.ts`.

---

### 2.3 `telemetry-runtime.ts` → оставить в app ✅ **ВЫПОЛНЕНО**

**Порядок:** Обновление импортов → валидация

**Действия:**

- ✅ Оставить в `packages/app/src/lib/telemetry-runtime.ts`
- ✅ Обновить импорты на новые пути из `@livai/core/telemetry` и `@livai/core-contracts`

**Файлы:**

- ✅ `packages/app/src/lib/telemetry-runtime.ts` (обновлены импорты)

**Причина:** Runtime singleton логика специфична для app-слоя.

**Зависимости:**

- ✅ Текущий файл: использует `TelemetryClient` из `@livai/core/telemetry`
- ✅ Есть runtime singleton логика (глобальный клиент) → специфично для app
- ✅ Используется в: `app/src/lib/*.ts` (offline-cache, sse-client, websocket, performance, api-schema-guard), `app/src/providers/TelemetryProvider.tsx`

**Миграция импорта:**

- ✅ Обновлен импорт `TelemetryClient`: `import { TelemetryClient } from '@livai/core/telemetry'`
- ✅ Обновлены импорты типов: `import type { ... } from '@livai/core-contracts'`
- ✅ Остальные импорты остаются без изменений
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` — пройдена

**Тесты:**

- ✅ `app/tests/unit/lib/telemetry-runtime.test.ts` → восстановлен из коммита ea76668f, обновлен импорт `TelemetryClient` на `@livai/core/telemetry`
- ✅ Обновлены импорты типов на `@livai/core-contracts`
- ✅ Остальные тесты остаются без изменений

**Экспорты:**

- ✅ Без изменений (файл остается в app, экспортируется через `app/src/lib/index.ts`)

**Обновление:** Обновлен импорт `TelemetryClient` в `telemetry-runtime.ts` на `@livai/core/telemetry`. Обновлены импорты типов на `@livai/core-contracts`. Runtime singleton остается в app. Восстановлен тест из коммита ea76668f с обновленными импортами. Удалены легаси-экспорты телеметрии из `app/src/lib/index.ts` и `app/src/index.ts` — все функции из core должны импортироваться напрямую из `@livai/core/telemetry`.

---

## 3️⃣ Feature Flags

### 3.1 `feature-flags.ts` → `core/feature-flags/` ✅ **ВЫПОЛНЕНО**

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Создать новый подпакет `packages/core/src/feature-flags/`
- ✅ Перенести MurmurHash, стратегии, контекст, logger
- ✅ Оставить в core общий engine для backend и фронтов

**Файлы:**

- `packages/app/src/lib/feature-flags.ts` → удалён (логика перенесена в core)
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

- Core engine: `packages/core/tests/feature-flags/core.test.ts` (стратегии, meta, logger, evaluateFeature/evaluateFeatures, freezeContext)
- React части: `packages/core/tests/feature-flags/react.test.tsx` (`FeatureFlagOverrideProvider`, `useFeatureFlagOverride`, `useFeatureFlagOverrides`)
- Pipeline rollout: `packages/core/tests/pipeline/feature-flags.test.ts` (использует тот же `stableHash`)
- App уровень: `packages/app/tests/unit/providers/FeatureFlagsProvider.test.tsx` обновлён на `@livai/core/feature-flags`; интеграционные хуки/провайдеры (`useFeatureFlags`, `UnifiedUIProvider`) покрыты существующими app‑тестами
- Верификация: `npx vitest run --coverage` для core feature-flags/hash/pipeline и для feature-auth effects (login/logout/register/refresh) — тесты зелёные

**Экспорты:**

- `core/src/hash.ts` экспортируется как `@livai/core/hash` (subpath экспорт в `packages/core/package.json`)
- `core/src/feature-flags/index.ts` экспортирует core‑engine; React‑части собираются отдельным entrypoint‑ом и доступны как `@livai/core/feature-flags/react`
- `core/src/index.ts` реэкспортирует hash и feature‑flags (core‑engine) в главный индекс `@livai/core`
- Проверка export map: `pnpm run check:exports` проходит без ошибок

**Обновление:** Feature flags engine перенесён в `@livai/core/feature-flags` с разделением на core (`core.ts`) и React (`react.tsx`), а MurmurHash3 вынесен в общий `@livai/core/hash`. Core‑engine очищен от React/env/console зависимостей, добавлены strategy meta (`FeatureFlagStrategyMeta`), защита от коррелированных rollout‑ов через `stableHash(\`\${flagName}:\${id}\`)`и атрибутные стратегии (`enabledForAttribute`). App‑слой использует только публичные API`@livai/core/feature-flags`и`@livai/core/feature-flags/react`;`app/src/lib/feature-flags.ts`удалён. Pipeline feature flags остаются в`core/pipeline/feature-flags.ts`, но теперь используют тот же`stableHash`из`core/hash.ts` для консистентного детерминированного rollout‑а.

---

## 4️⃣ Offline Cache / Effect ✅ **ВЫПОЛНЕНО**

**Статус:** Полностью перенесено в `@livai/core/effect/offline-cache`, все зависимости обновлены, тесты проходят.

**Файлы:**

- ✅ `packages/core/src/effect/offline-cache.ts` — SWR-ядро с TypedOfflineCacheEmitter (без Node.js зависимостей)
- ✅ `packages/core/tests/effect/offline-cache.test.ts` — тесты (40 passed, 96.51% coverage)
- ✅ `packages/app/src/lib/offline-cache.ts` — удален (legacy)
- ✅ `packages/app/src/hooks/useOfflineCache.ts` — использует прямой импорт из `@livai/core/effect/offline-cache`

**Зависимости:**

- ✅ `EventEmitter` из `events` → заменен на `TypedOfflineCacheEmitter` (platform-neutral)
- ✅ `telemetry-runtime` → убрана, используется DI через `onError`/`onUpdate`/`onEvaluate`
- ✅ Все импорты обновлены на прямой импорт из `@livai/core/effect/offline-cache`

**Экспорты:**

- ✅ `core/src/effect/index.ts`: `export * from './offline-cache.js'`
- ✅ `core/src/index.ts`: `export * as effect from './effect/index.js'` (уже было)
- ✅ Реэкспорты из `app/src/lib/index.ts` и `app/src/index.ts` удалены (без legacy)

**Валидация:**

- ✅ TypeScript: `pnpm --filter @livai/core type-check` — проходит
- ✅ TypeScript: `pnpm --filter @livai/app type-check` — проходит
- ✅ ESLint: `pnpm run lint:canary` — проходит
- ✅ Тесты: `npx vitest run --coverage core/tests/effect/offline-cache.test.ts` — 40/40 passed

**Архитектура:**

- Структурированные секции: Types → Store Adapter → Cache Engine → Store Implementations → Retry System → Utilities → Event System
- Безопасные helpers: `safeEmit()`, `safeListener()`, `safeOnError()` для обработки ошибок listener'ов
- In-flight fetches tracking через `Map<CacheKey, ...>` с cleanup
- DI для `timer`, `random`, `evictionStrategy`, `retryStrategy`, `freezeMode`, `maxFetchDurationMs`, `onRetry`

---

## 5️⃣ Transport

### 5.1 `sse-client.ts` → `core/transport/sse-client.ts` ✅ **ВЫПОЛНЕНО**

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

- ✅ `app/src/lib/sse-client.ts` → перемещен в `core/src/transport/sse-client.ts`
- ✅ Убрана зависимость от `telemetry-runtime`: используется DI для logger (`EffectLogger`)
- ✅ Создан адаптер для `EventSource` (`EventSourceFactory` и `defaultEventSourceFactory`)
- ✅ Проверено: `grep -r "from.*lib/sse-client" packages/app/src` → старых импортов не найдено
- ✅ Валидация: `pnpm run type-check && pnpm run lint:canary` — пройдена

**Тесты:**

- ✅ `app/tests/unit/lib/sse-client.test.ts` → перемещен в `core/tests/transport/sse-client.test.ts`
- ✅ Обновлены импорты в тестах: `import { ... } from '../../src/transport/sse-client.js'`
- ✅ Обновлены моки для EventSource и logger

**Экспорты:**

- ✅ Создан `core/src/transport/index.ts`: `export * from './sse-client.js'`
- ✅ Добавлен в `core/src/index.ts`: `export * as transport from './transport/index.js'`
- ✅ Настроен в `tsup.config.ts`: `'transport/index': 'src/transport/index.ts'`
- ✅ Настроен в `package.json`: экспорт `"./transport"` с types/import/default
- ✅ Tree-shaking: FSM и типы экспортируются корректно

**Статус:** ✅ **ЗАВЕРШЕНО**

**Обновление:** Перенесен SSE FSM в `@livai/core/transport/sse-client`. Убрана зависимость от `telemetry-runtime`, используется DI для logger (`EffectLogger`). Создан адаптер для EventSource (`EventSourceFactory` и `defaultEventSourceFactory`). Обновлены импорты и тесты. Файл удален из `packages/app/src/lib/sse-client.ts`. Все валидации пройдены (`type-check`, `lint:canary`). Экспорты настроены в `package.json` и `tsup.config.ts`.

---

### 5.2 `websocket.ts` → `core/transport/websocket.ts` ✅ **ВЫПОЛНЕНО**

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

- ✅ `app/src/lib/websocket.ts` → перемещен в `core/src/transport/websocket.ts`
- ✅ Убрана зависимость от `telemetry-runtime`: используется DI для logger (`EffectLogger`)
- ✅ Создан адаптер для `WebSocket` (`WebSocketFactory` и `defaultWebSocketFactory`)
- ✅ Проверено: `grep -r "from.*lib/websocket" packages/app/src` → старых импортов не найдено
- ✅ Валидация: `pnpm run type-check && pnpm run lint:canary` — пройдена

**Тесты:**

- `app/tests/unit/lib/websocket.test.ts` → переместить в `core/tests/transport/websocket.test.ts`
- Обновить импорты в тестах: `import { ... } from '@livai/core/transport/websocket'`
- Обновить моки для WebSocket и logger

**Экспорты:**

- ✅ Добавлен в `core/src/transport/index.ts`: `export * from './websocket.js'`
- ✅ Обновлен `core/src/index.ts`: экспорты transport уже настроены
- ✅ Tree-shaking: FSM и типы экспортируются корректно

**Статус:** ✅ **ЗАВЕРШЕНО**

**Обновление:** Перенесен WebSocket FSM в `@livai/core/transport/websocket`. Убрана зависимость от `telemetry-runtime`, используется DI для logger (`EffectLogger`). Создан адаптер для WebSocket (`WebSocketFactory` и `defaultWebSocketFactory`). Добавлена валидация данных для предотвращения model poisoning (аналогично SSE). Добавлен `RuntimeClock` для детерминированного тестирования. Файл удален из `packages/app/src/lib/websocket.ts`. Все валидации пройдены (`type-check`, `lint:canary`).

---

## 6️⃣ Performance ✅ **ВЫПОЛНЕНО**

### 6.1 `performance.ts` → разделить (по паттерну feature-flags)

**Порядок:** Разделение → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Ядро → `packages/core/src/performance/core.ts` (метрики, пороговые значения, батчинг, DI для logger)
- ✅ React-хуки → `packages/core/src/performance/react.tsx` (изолированы через subpath экспорт)

**Файлы:**

- `packages/app/src/lib/performance.ts` → разделить на:
  - `packages/core/src/performance/core.ts` (чистое ядро без React)
  - `packages/core/src/performance/react.tsx` (React hooks, изолированы)
  - `packages/core/src/performance/index.ts` (экспортирует только core)

**Причина:**

- **Архитектурная консистентность:** единый паттерн с `feature-flags` (`core.ts` + `react.tsx` в одном модуле)
- **Правильное разделение зависимостей:** core не зависит от React, React layer зависит от core
- **Tree-shaking:** subpath экспорт (`@livai/core/performance` vs `@livai/core/performance/react`) обеспечивает perfect tree separation
- **Переиспользование:** React hooks универсальны и могут использоваться в других приложениях
- **Масштабируемость:** единый паттерн упрощает добавление новых runtime-адаптеров

**Зависимости:**

- Текущий файл: импортирует `randomUUID` из `crypto`, `Effect` из `effect`, `React`, `JsonObject` из `../types/common.js`, `telemetry-runtime` из `./telemetry-runtime.js`
- Ядро (`core.ts`): `crypto`, `Effect`, `JsonObject` из `@livai/core-contracts` → можно перенести в core
- React-хуки (`react.tsx`): `React`, импорт из `./core.js` → изолированы в отдельном файле
- `telemetry-runtime` → убрать зависимость из ядра, использовать DI для logger (аналогично `feature-flags`)
- Используется в: app компонентах через hooks из `@livai/core/performance/react`

**Миграция импорта:**

- ✅ Разделить файл: ядро → `core/src/performance/core.ts`, hooks → `core/src/performance/react.tsx`
- ✅ Ядро (`core.ts`): `PerformanceTracker`, `createPerformanceTracker`, `PerformanceMetric`, `PerformanceLogger`, `PerformanceConfig`, `MetricRule`, `MetricProcessor`, типы, DI интерфейс для logger
- ✅ Hooks (`react.tsx`): `usePerformanceProfiling`, `useWebVitalsTracking`, `useApiPerformanceTracking`, `useFlushOnPageHide`, `usePerformanceTracker` → импортируют из `./core.js`
- ✅ Убрать зависимость от `telemetry-runtime` из ядра: используется DI для logger (`PerformanceLogger` интерфейс)
- ✅ Проверить: `grep -r "from.*lib/performance" packages/app/src` → старый файл удален, импорты обновлены
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` → все проверки пройдены

**Тесты:**

- ✅ `app/tests/unit/lib/performance.test.ts` → разделен:
  - ✅ `core/tests/performance/core.test.ts` (тесты ядра)
  - ✅ `core/tests/performance/react.test.tsx` (тесты React hooks)
- ✅ Обновить импорты в тестах: core из `@livai/core/performance`, hooks из `@livai/core/performance/react`

**Экспорты:**

- ✅ Создать `core/src/performance/index.ts`: `export * from './core.js'` (только core, без React)
- ✅ Добавить в `core/src/index.ts`: `export * as performance from './performance/index.js'`
- ✅ Настроить в `package.json` exports:
  ```json
  "./performance": {
    "types": "./dist/performance/index.d.ts",
    "import": "./dist/performance/index.js"
  },
  "./performance/react": {
    "types": "./dist/performance/react.d.ts",
    "import": "./dist/performance/react.js"
  }
  ```
- ✅ Настроить в `tsup.config.ts`: добавлен entry point для `performance/index.ts`
- ✅ Обновить `build:react` в `package.json` для сборки React-частей performance

**Статус:** ✅ **ЗАВЕРШЕНО**

**Обновление:** Разделен `performance.ts` по паттерну `feature-flags`: ядро перенесено в `@livai/core/performance/core`, React-хуки в `@livai/core/performance/react`. Убрана зависимость от `telemetry-runtime` из ядра, используется DI для logger (`PerformanceLogger`). Настроены subpath экспорты для tree-shaking. Созданы тесты для core и React hooks. Старый файл `packages/app/src/lib/performance.ts` удален. Все валидации пройдены (`type-check`, `lint:canary`). Архитектурная консистентность с `feature-flags` обеспечена.

---

## 7️⃣ API / Boundary ✅ **ВЫПОЛНЕНО**

### 7.1 `api-schema-guard.ts` → `core/input-boundary/api-schema-guard.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Статус:** ✅ **ЗАВЕРШЕНО**

**Краткий итог:** Логика старого `api-schema-guard.ts` перенесена и разделена на два модуля в core: orchestration‑слой `@livai/core/input-boundary/api-schema-guard` и runtime‑слой `@livai/core/input-boundary/api-validation-runtime` (security/errors/Zod/telemetry), с архитектурным апгрейдом (rule‑pipeline, EndpointPath, schema version, payload‑limits) и обновлённой интеграцией в app.

**Что сделано (orchestration + runtime):**

- ✅ Перенесён `packages/app/src/lib/api-schema-guard.ts` → `packages/core/src/input-boundary/api-schema-guard.ts` и выделен отдельный runtime‑слой `packages/core/src/input-boundary/api-validation-runtime.ts`
- ✅ Сохранена и расширена Effect-based валидация, strict mode, проверки размеров payload (логика security/size вынесена в `api-validation-runtime.ts`, orchestration и типы — в `api-schema-guard.ts`)
- ✅ Убрана зависимость от `telemetry-runtime`, вместо этого используется DI через `ApiValidationTelemetry` в runtime‑слое (`api-validation-runtime.ts`)
- ✅ `ApiServiceName`/`HttpMethod` перенесены в `@livai/core-contracts/src/context/http-contracts.ts` как `ServiceName`/`HttpMethod`; app использует их из `@livai/core-contracts`
- ✅ Обновлены все импорты в app на `@livai/core/input-boundary/api-schema-guard` и `@livai/core-contracts`
- ✅ Реализован rule‑engine (`ApiValidationRule`, фазы pre/post, priority, maxSize) и брендинг путей через `EndpointPath`

**Тесты:**

- ✅ Старые тесты `app/tests/unit/lib/api-schema-guard.test.ts` удалены; написаны новые: `core/tests/input-boundary/api-schema-guard.test.ts`
- ✅ Добавлены и прогнаны unit‑тесты для `api-validation-runtime`: `core/tests/input-boundary/api-validation-runtime.test.ts`
- ✅ Тесты для HTTP‑контрактов (`core-contracts/tests/unit/context/http-contracts.test.ts`) актуализированы под новые `HttpMethod`/`ServiceName`

**Экспорты и валидация:**

- ✅ `core/src/input-boundary/index.ts` и `core/src/index.ts` экспортируют API schema guard по договорённому публичному пути
- ✅ Обновлён `useApi` в app для работы с `EndpointPath` и новым input‑boundary
- ✅ Валидация пакетов: `tsc:check`, `@livai/core` build:types/build:js, `@livai/app` build:types/build проходят успешно; vitest‑тесты для core‑contracts и input‑boundary зелёные

---

## 8️⃣ Access Control / Auth

### 8.1 `auth-guard.ts` → `core/access-control/auth-guard.ts (+ React adapter)`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести типы и логику авторизации в `packages/core/src/access-control/auth-guard.ts` (pure ядро без React)
- ✅ Создать React-адаптер по паттерну `performance` / `feature-flags`, например `packages/core/src/access-control/auth-guard.react.tsx`

**Файлы:**

- ✅ `packages/app/src/lib/auth-guard.ts` → разделить на:
  - ✅ `packages/core/src/access-control/auth-guard.ts` — чистая политика, только типы и pure-функции
  - ✅ `packages/core/src/access-control/auth-guard.react.tsx` — React Context/хуки поверх ядра
  - ✅ Старый файл `packages/app/src/lib/auth-guard.ts` удалён после миграции всех потребителей

**Причина:** Логика авторизации не привязана к UI, должна быть доступна в разных рантаймах; React-обёртка — адаптер, аналогичный `performance/react` и `feature-flags/react`.

**Зависимости:**

- ✅ Текущий файл: импортирует `React`, `createContext`, `useContext` из `react`, `TaggedError` из `@livai/core/effect`, `AuthContext`, `ID`, `UserRoles` из `../types/common.js`
- ✅ В ядре (`auth-guard.ts`) убрать React Context: оставить только типы `ID`/`UserRoles` и pure-функции авторизации (без `AuthContext`)
- ✅ В `auth-guard.react.tsx` реализовать:
  - ✅ React Context (`createContext`, `useContext`)
  - ✅ провайдер/хуки, опирающиеся на core-политику (`auth-guard.ts`)
- ✅ Используется в: `app/src/lib/route-permissions.ts`, guards и компоненты в app (через React-адаптер)

**Миграция импорта:**

- ✅ `app/src/lib/auth-guard.ts` → переместить и разделить на `core/src/access-control/auth-guard.ts` и `core/src/access-control/auth-guard.react.tsx`
- ✅ Обновить импорты:
  - ✅ `AuthContext`, `ID`, `UserRoles` из `@livai/core-contracts` (после миграции 1.1)
  - ✅ потребители React-контекста: `import { AuthGuardProvider, useAuthGuardContext } from '@livai/core/access-control'`
  - ✅ `route-permissions.ts` в app → завязать на `@livai/core/access-control` после переноса
  - ✅ `AppProviders.tsx` → использует `@livai/core/access-control`
  - ✅ `user-profile-display.tsx` → использует `@livai/core/access-control`
- ✅ Проверить: `grep -r "from.*lib/auth-guard" packages/app/src` → все вхождения обновлены (0 результатов)
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` после разделения ядра и React-адаптера — все проверки пройдены

**Тесты:**

- ✅ `app/tests/unit/lib/auth-guard.test.ts` → разделить:
  - ✅ ядро → `core/tests/unit/access-control/auth-guard.test.ts`
  - ✅ React Context-часть → `core/tests/unit/access-control/auth-guard.react.test.tsx`
- ✅ Обновить импорты в тестах: `import { ... } from '@livai/core/access-control'` — обновлены в `app/tests/unit/ui/user-profile-display.test.tsx`

**Экспорты:**

- ✅ В `core/src/access-control/index.ts`: `export * from './auth-guard.js'; export * from './auth-guard.react.js';`
- ✅ В `core/src/index.ts`: добавлен namespace `accessControl` по аналогии с `performance` / `feature-flags`
- ✅ В `core/package.json`: добавлен subpath export `./access-control`
- ✅ В `core/tsup.config.ts`: добавлен entry point `access-control/index`
- ✅ Проверить tree-shaking: ядро и React-обёртка не должны тянуть лишний runtime — настроено через external в tsup

**Обновление:** ✅ **ВЫПОЛНЕНО**

Перенесены типы и логика авторизации в `@livai/core/access-control/auth-guard` (ядро) и создан React-адаптер `@livai/core/access-control/auth-guard.react` по паттерну `performance`/`feature-flags`. Убраны React-зависимости из ядра. Обновлены импорты в `route-permissions.ts`, `AppProviders.tsx`, `user-profile-display.tsx` и тестах. Старый файл `app/src/lib/auth-guard.ts` удалён. Настроены экспорты через subpath `@livai/core/access-control` и namespace `accessControl`. Все проверки (type-check, lint, exports) пройдены успешно.

---

### 8.2 `route-permissions.ts` → `core/access-control/route-permissions.ts`

**Порядок:** Перенос → адаптация зависимостей → валидация → тесты

**Действия:**

- ✅ Перенести декларативные правила доступа в `packages/core/src/access-control/route-permissions.ts`
- ✅ Зависеть от core-политики авторизации (`auth-guard.ts`) и/или её React-обёртки, не имея собственных React-зависимостей
- ✅ Удалить UI helper `canAccessRoute()` из core (перенесен в `app/src/lib/route-access.ts`)
- ✅ Удалить resolver `getRouteTypeFromPath()` из core (перенесен в app как internal функция)

**Файлы:**

- ✅ `packages/app/src/lib/route-permissions.ts` → `packages/core/src/access-control/route-permissions.ts`
- ✅ UI helper `canAccessRoute()` → `packages/app/src/lib/route-access.ts` (новый файл)

**Причина:** Декларативная политика как код, переиспользуема в разных runtime; должна жить рядом с ядром авторизации в core. UI-специфичные helpers остаются в app.

**Зависимости:**

- ✅ Текущий файл: импортировал `UserRoles` из `../types/common.js`, `AuthGuardContext`, `Permission`, `UserRole` из `./auth-guard.js`
- ✅ После шага 8.1:
  - ✅ `GlobalUserRole`, `SystemRole`, `AnyRole` → из `@livai/core-contracts`
  - ✅ `Permission`, `AuthGuardContextCore` → из `@livai/core/access-control/auth-guard`
  - ✅ для UI-guard'ов в app допускается использование React-адаптера `@livai/core/access-control/auth-guard.react`
- ✅ Используется в: app routes/guards (`route-meta.ts`, `user-profile-display.tsx`), может быть переиспользована в других фронтах и backend.

**Миграция импорта:**

- ✅ `app/src/lib/route-permissions.ts` → перемещен в `core/src/access-control/route-permissions.ts`
- ✅ Обновлены импорты:
  - ✅ `GlobalUserRole`, `SystemRole`, `AnyRole` из `@livai/core-contracts`
  - ✅ `Permission`, `AuthGuardContextCore` → из `@livai/core/access-control/auth-guard`
- ✅ Проверено: `grep -r "from.*lib/route-permissions" packages/app/src` → 0 результатов (все обновлены)
- ✅ Все потребители обновлены:
  - ✅ `app/src/routes/route-meta.ts` → использует `@livai/core/access-control/route-permissions`
  - ✅ `app/src/ui/user-profile-display.tsx` → использует `@livai/core/access-control/route-permissions`
  - ✅ `app/src/ui/navigation-menu-item.tsx` → использует `app/src/lib/route-access.ts` (UI helper)
- ✅ Валидация: `pnpm run type-check && pnpm run check:exports && pnpm run lint:canary` — все проверки пройдены

**Тесты:**

- ✅ `app/tests/unit/lib/route-permissions.test.ts` → перемещен в `core/tests/access-control/route-permissions.test.ts`
- ✅ Обновлены импорты в тестах: `import { ... } from '@livai/core/access-control/route-permissions'`
- ✅ Тесты используют типы из `@livai/core-contracts` (`GlobalUserRole`, `AnyRole`)

**Экспорты:**

- ✅ В `core/src/access-control/index.ts`: `export * from './auth-guard.js'; export * from './auth-guard.react.js'; export * from './route-permissions.js';`
- ✅ В `core/src/index.ts`: `export * as accessControl from './access-control/index.js';`
- ✅ В `core/package.json`: добавлены subpath exports:
  - ✅ `./access-control` → `dist/access-control/index.js`
  - ✅ `./access-control/route-permissions` → `dist/access-control/route-permissions.js`
- ✅ В `core/tsup.config.ts`: добавлен entry point `access-control/route-permissions`
- ✅ Проверено tree-shaking: политики и их React-обёртки не тянут лишний runtime

**Оптимизации и улучшения:**

- ✅ Убрано дублирование ролей: создана константа `AUTHENTICATED_USER_ROLES`
- ✅ Улучшена type safety: убран `as RoutePermissionRule`, используется `Record<RouteType, RoutePermissionRule>`
- ✅ Оптимизирован `getAvailableRouteTypes`: создана константа `AVAILABLE_ROUTE_TYPES` для избежания пересоздания массива
- ✅ Упрощен API: удалены UI helpers (`canAccessRoute`, `getRouteTypeFromPath`) из core
- ✅ Минимизирован public API: экспортируются только `checkRoutePermission`, `createPublicRoute`, `createProtectedRoute`, `getRoutePolicy`, `getAvailableRouteTypes`

**Обновление:** ✅ **ВЫПОЛНЕНО**

Перенесены декларативные правила доступа в `@livai/core/access-control/route-permissions`, настроены зависимости на ядро `auth-guard` и его React-адаптер. Обновлены импорты в app и тестах, access-control слой экспортируется по паттерну `performance`/`feature-flags`. UI-специфичные helpers (`canAccessRoute`, `getRouteTypeFromPath`) перенесены в `app/src/lib/route-access.ts`. Core остался чистым без UI зависимостей. Все проверки (type-check, lint, exports) пройдены успешно.

---

## 9️⃣ Дубликаты / Унификация

### 9.1 AppError → оставить в core-contracts ✅ **ВЫПОЛНЕНО**

**Порядок:** Уже выполнено (см. раздел 1.2)

**Действия:**

- ✅ Удалить `packages/app/src/types/errors.ts`
- ✅ Использовать `packages/core-contracts/src/domain/app-effects.ts`
- ✅ Обновить все импорты в app

**Причина:** Убрать дублирование, core-contracts — единый источник истины.

**Зависимости:**

- ✅ Полное дублирование уже есть в `core-contracts/domain/app-effects.ts` (AppError, ClientError, ServerError, ValidationError, NetworkError, UnknownError)
- ✅ Типы экспортируются через `core-contracts/src/domain/index.ts` → `core-contracts/src/index.ts`

**Миграция импорта:**

- ✅ `packages/app/src/types/errors.ts` → удален (файл не существует)
- ✅ Все импорты обновлены на `@livai/core-contracts`:
  - ✅ `app/src/ui/toast.tsx` → `import type { AppError } from '@livai/core-contracts'`
  - ✅ `app/src/ui/error-boundary.tsx` → использует типы из `@livai/core-contracts`
  - ✅ `app/src/lib/api-client.ts` → использует типы из `@livai/core-contracts`
- ✅ Проверено: `grep -r "from.*types/errors" packages/app/src` → 0 результатов
- ✅ Проверено: `grep -r "from.*\.\.\/types\/errors" packages/app/src` → 0 результатов

**Тесты:**

- ✅ `app/tests/unit/types/errors.test.ts` → удален
- ✅ Тесты перенесены в `core-contracts/tests/unit/domain/app-effects.test.ts`
- ✅ Тесты покрывают все типы ошибок и утилитарные типы (ErrorFn, ErrorHandler, IsErrorOfType)

**Экспорты:**

- ✅ `core-contracts/src/domain/index.ts` → экспортирует `export * from './app-effects.js'`
- ✅ `core-contracts/src/index.ts` → экспортирует через `export * from './domain/index.js'`
- ✅ `app/src/types/index.ts` → не реэкспортирует типы ошибок (проверено)
- ✅ `app/src/index.ts` → не реэкспортирует типы ошибок (проверено)

**Обновление:** ✅ **ВЫПОЛНЕНО**

Удален `packages/app/src/types/errors.ts`, все импорты обновлены на `@livai/core-contracts`. Типы ошибок (AppError, ClientError, ServerError, ValidationError, NetworkError, UnknownError) теперь экспортируются из `@livai/core-contracts/src/domain/app-effects.ts`. Убрано дублирование типов ошибок. Все тесты перенесены в `core-contracts/tests/unit/domain/app-effects.test.ts`. Реэкспорты типов ошибок удалены из `app/src/types/index.ts` и `app/src/index.ts`. Все проверки пройдены успешно.

---

### 9.2 Json* → унифицировать в core-contracts ✅ **ВЫПОЛНЕНО**

**Порядок:** Уже выполнено (см. раздел 1.1)

**Действия:**

- ✅ Унифицировать `JsonPrimitive`, `JsonValue`, `JsonArray`, `JsonObject` в `core-contracts/src/domain/common.ts`
- ✅ Удалить дубли из `app/types/common.ts` и `core/input-boundary/generic-validation.ts`
- ✅ Обновить импорты

**Причина:** Сейчас дублируются в 3 местах с разными структурами.

**Зависимости:**

- ✅ Json* типы унифицированы в `core-contracts/src/domain/common.ts`:
  - `JsonPrimitive` = `string | number | boolean | null`
  - `JsonValue` = `JsonPrimitive | JsonObject | JsonArray`
  - `JsonArray` = `readonly JsonValue[]` (readonly для immutability)
  - `JsonObject` = `{ readonly [key: string]: JsonValue }` (readonly для immutability)
  - `ReadonlyJsonObject` = `Readonly<JsonObject>`
  - `TypedJsonObject<T>` = `Readonly<T>`
  - `Json` = `JsonValue` (алиас)

**Миграция импорта:**

- ✅ `core-contracts/src/domain/common.ts` → содержит унифицированные Json* типы с readonly структурой
- ✅ `app/src/types/common.ts` → удалены локальные определения Json*, импортирует из `@livai/core-contracts`:
  - `import type { Json, JsonArray, JsonObject, JsonPrimitive, JsonValue, ReadonlyJsonObject } from '@livai/core-contracts'`
  - Реэкспортирует для обратной совместимости: `export type { Json, JsonArray, JsonObject, JsonPrimitive, JsonValue }`
- ✅ `core/src/input-boundary/generic-validation.ts` → удалены локальные определения Json*, импортирует из `@livai/core-contracts`:
  - `import type { Json, JsonArray, JsonObject, JsonPrimitive, JsonValue } from '@livai/core-contracts'`
  - Реэкспортирует для использования в модуле: `export type { Json, JsonArray, JsonObject, JsonPrimitive, JsonValue }`
- ✅ Проверено: `grep -r "^type Json\|^export type Json" packages/app/src/types/common.ts packages/core/src/input-boundary/generic-validation.ts` → 0 результатов (нет локальных определений)
- ✅ Все импорты обновлены:
  - `app/src/lib/logger.ts` → использует `JsonValue` из `@livai/core-contracts` (через реэкспорт из `types/common.ts`)
  - `core/src/input-boundary/projection-engine.ts` → использует `JsonValue` из `generic-validation.ts` (который реэкспортирует из `@livai/core-contracts`)
  - `core/src/performance/core.ts` → использует `JsonObject` из `@livai/core-contracts`
  - `core/src/effect/effect-utils.ts` → использует `ReadonlyJsonObject` из `@livai/core-contracts`
- ✅ Валидация: `pnpm run type-check` — все проверки пройдены успешно

**Тесты:**

- ✅ Тесты обновлены на импорты из `@livai/core-contracts`:
  - `core-contracts/tests/unit/domain/common.test.ts` → тесты для Json* типов
  - `core/tests/input-boundary/generic-validation.test.ts` → использует Json* из `@livai/core-contracts`
  - `app/tests/unit/lib/logger.test.ts` → использует Json* из `@livai/core-contracts`

**Экспорты:**

- ✅ `core-contracts/src/domain/index.ts` → экспортирует `export * from './common.js'`
- ✅ `core-contracts/src/index.ts` → экспортирует через `export * from './domain/index.js'`
- ✅ `app/src/types/index.ts` → реэкспортирует Json* типы из `@livai/core-contracts` (через `types/common.ts`)
- ✅ `core/src/input-boundary/index.ts` → реэкспортирует Json* типы из `@livai/core-contracts` (через `generic-validation.ts`)

**Обновление:** ✅ **ВЫПОЛНЕНО**

Унифицированы `Json*` типы в `@livai/core-contracts/src/domain/common.ts` с readonly структурой для immutability. Удалены локальные определения Json* из `app/src/types/common.ts` и `core/src/input-boundary/generic-validation.ts`. Все файлы импортируют Json* типы из `@livai/core-contracts`. Реэкспорты оставлены для обратной совместимости. Все проверки (type-check, lint, exports) пройдены успешно.

---

### 9.3 ID<T> и ISODateString → добавить в core-contracts ✅ **ВЫПОЛНЕНО**

**Порядок:** Уже выполнено (см. раздел 1.1)

**Действия:**

- ✅ Добавить branded `ID<T>` в `core-contracts/src/domain/common.ts`
- ✅ Добавить branded `ISODateString` (сейчас только алиас `Timestamp`)
- ✅ `packages/app/src/types/common.ts` → импортировать из `@livai/core-contracts`

**Причина:** Фундаментальные branded-типы должны быть в foundation-слое.

**Зависимости:**

- ✅ Branded типы определены в `core-contracts/src/domain/common.ts`:
  - `ID<T extends string = string> = string & { readonly [IDBrand]: T }` — branded тип для уникальных идентификаторов
  - `ISODateString = string & { readonly [ISODateBrand]: 'ISODateString' }` — branded тип для ISO-8601 дат
  - Используются во всех доменах и слоях приложения

**Миграция импорта:**

- ✅ `core-contracts/src/domain/common.ts` → содержит branded `ID<T>` и `ISODateString`:
  - `ID<T>` использует `unique symbol` для type-safety
  - `ISODateString` использует `unique symbol` для type-safety
  - Оба типа являются branded types для предотвращения перепутывания
- ✅ `app/src/types/common.ts` → удалены локальные определения, импортирует из `@livai/core-contracts`:
  - `import type { ID, ISODateString, ... } from '@livai/core-contracts'`
  - Реэкспортирует для обратной совместимости: `export type { ID, ISODateString, ... }`
- ✅ Проверено: `grep -r "^type ID<\|^export type ID<\|^type ISODateString\|^export type ISODateString" packages/app/src/types/common.ts` → 0 результатов (нет локальных определений)
- ✅ Все импорты обновлены:
  - `app/src/types/api.ts` → использует `ID` и `ISODateString` из `@livai/core-contracts` (через реэкспорт из `types/common.ts`)
  - `app/src/index.ts` → реэкспортирует `ID` и `ISODateString` из `@livai/core-contracts`
  - `app/src/types/index.ts` → реэкспортирует `ID` и `ISODateString` из `@livai/core-contracts`
- ✅ Валидация: `pnpm run type-check` — все проверки пройдены успешно

**Тесты:**

- ✅ Тесты обновлены на импорты из `@livai/core-contracts`:
  - `core-contracts/tests/unit/domain/common.test.ts` → содержит тесты для `ISODateString`:
    - Проверка приема ISO 8601 строк
    - Проверка совместимости со string
    - Проверка различных форматов ISO строк
  - Интеграционные тесты проверяют использование `ISODateString` в фикстурах
  - Тесты для `ID<T>` не требуются (branded type проверяется на уровне компиляции)

**Экспорты:**

- ✅ `core-contracts/src/domain/index.ts` → экспортирует `export * from './common.js'`
- ✅ `core-contracts/src/index.ts` → экспортирует через `export * from './domain/index.js'`
- ✅ `app/src/types/index.ts` → реэкспортирует `ID` и `ISODateString` из `@livai/core-contracts` (через `types/common.ts`)
- ✅ `app/src/index.ts` → реэкспортирует `ID` и `ISODateString` из `@livai/core-contracts`

**Обновление:** ✅ **ВЫПОЛНЕНО**

Добавлены branded `ID<T>` и `ISODateString` в `@livai/core-contracts/src/domain/common.ts` с использованием `unique symbol` для type-safety. Удалены локальные определения из `app/src/types/common.ts`. Все файлы импортируют `ID` и `ISODateString` из `@livai/core-contracts`. Реэкспорты оставлены для обратной совместимости. Тесты для `ISODateString` добавлены в `core-contracts/tests/unit/domain/common.test.ts`. Все проверки (type-check, lint, exports) пройдены успешно.

---

### 9.4 Feature flags (pipeline vs общий engine) ✅ **ВЫПОЛНЕНО**

**Порядок:** Уже выполнено (см. раздел 3.1)

**Действия:**

- ✅ Общий engine (`feature-flags.ts`) → `core/feature-flags/`
- ✅ Pipeline feature flags (`core/pipeline/feature-flags.ts`) → остаются для rollout-версий
- ✅ Разделить ответственность: engine в core, доменные версии остаются

**Причина:** Разные домены (pipeline rollout vs общий feature flags), но engine переиспользуем.

**Зависимости:**

- ✅ Общий engine перенесен в `core/src/feature-flags/`:
  - `core.ts` — детерминированный engine для управления feature flags
  - `react.tsx` — React-адаптер для UI
  - `index.ts` — публичный API
- ✅ Pipeline feature flags остаются в `core/src/pipeline/feature-flags.ts`:
  - Специфичны для rollout pipeline версий (v1, v2, v3)
  - Используют общий `stableHash` из `core/src/hash.ts` для консистентности
  - Не зависят от общего engine (разные домены)

**Миграция импорта:**

- ✅ Общий engine доступен через `@livai/core/feature-flags`:
  - Core engine: `@livai/core/feature-flags`
  - React адаптер: `@livai/core/feature-flags/react`
- ✅ `core/src/pipeline/feature-flags.ts` → не использует общий engine (разные домены):
  - Использует общий `stableHash` из `core/src/hash.ts` для детерминированного rollout
  - Имеет собственную логику для pipeline версий (PipelineVersion, PipelineMode, FeatureFlagSource)
  - Экспортируется через `core/src/pipeline/index.ts`
- ✅ Проверено: нет конфликтов между pipeline и общим engine:
  - Разные типы: `PipelineVersion` vs общие feature flags
  - Разные контексты: pipeline rollout vs общий feature flags
  - Общий `stableHash` обеспечивает консистентность

**Тесты:**

- ✅ Тесты общего engine:
  - `core/tests/feature-flags/core.test.ts` — тесты core engine
  - `core/tests/feature-flags/react.test.tsx` — тесты React адаптера
- ✅ Тесты pipeline feature flags:
  - `core/tests/pipeline/feature-flags.test.ts` — тесты pipeline rollout
  - Используют тот же `stableHash` для консистентности

**Экспорты:**

- ✅ Общий engine:
  - `core/src/feature-flags/index.ts` → экспортирует core engine
  - `core/src/index.ts` → экспортирует `export * from './feature-flags/index.js'`
  - Subpath exports в `core/package.json`: `./feature-flags` и `./feature-flags/react`
- ✅ Pipeline feature flags:
  - `core/src/pipeline/index.ts` → экспортирует `FeatureFlagSource`, `PipelineVersion`, `PipelineMode` и функции
  - Экспорты остаются без изменений

**Обновление:** ✅ **ВЫПОЛНЕНО**

Общий engine перенесен в `@livai/core/feature-flags` с разделением на core (`core.ts`) и React (`react.tsx`). Pipeline feature flags остаются в `core/src/pipeline/feature-flags.ts` для rollout-версий. Разделена ответственность: общий engine в `core/feature-flags/` для переиспользования, pipeline feature flags в `core/pipeline/` для доменных rollout-версий. Оба используют общий `stableHash` из `core/src/hash.ts` для консистентного детерминированного rollout. Нет конфликтов между модулями (разные домены и типы). Все проверки (type-check, lint, exports) пройдены успешно.

---

### 9.5 API validation → разделить ответственность ✅ **ВЫПОЛНЕНО**

**Порядок:** Уже выполнено (см. раздел 7.1)

**Действия:**

- ✅ `api-schema-guard.ts` → `core/input-boundary/` (boundary-слой)
- ✅ `core/effect/schema-validated-effect.ts` → остается (Zod → ValidationError маппинг)
- ✅ `core/input-boundary/generic-validation.ts` → остается (generic DTO валидация)
- ✅ Transport-specific валидация → в app по необходимости

**Причина:** Разные уровни абстракции: boundary (API) vs generic (DTO) vs transport (HTTP-специфика).

**Зависимости:**

- ✅ `api-schema-guard.ts` перенесен в `core/src/input-boundary/`:
  - Boundary-слой для валидации API запросов/ответов
  - Координация валидации через ApiSchemaConfig
  - Интеграция с error-mapping и ServiceName
  - Делегирование low-level валидации в `api-validation-runtime.ts`
- ✅ `core/src/effect/schema-validated-effect.ts` → остается без изменений:
  - Zod → ValidationError маппинг для результатов Effect
  - Runtime-валидация результатов Effect через Zod-подобную schema
  - Унифицированная обработка ошибок через error-mapping
- ✅ `core/src/input-boundary/generic-validation.ts` → остается без изменений:
  - Generic type guards и структурная валидация для DTO
  - Только структурная валидация (shape, types, JSON-serializable)
  - Без sanitization (data-safety/)
  - Независим от других модулей валидации

**Миграция импорта:**

- ✅ `api-schema-guard.ts` перенесен в `core/src/input-boundary/`:
  - Экспортируется через `core/src/input-boundary/index.ts`
  - Использует `api-validation-runtime.ts` для low-level валидации
  - Использует `zodIssuesToValidationErrors` из `schema-validated-effect.ts` для маппинга Zod ошибок
- ✅ `core/src/effect/schema-validated-effect.ts` → используется `api-validation-runtime.ts`:
  - `api-validation-runtime.ts` импортирует `zodIssuesToValidationErrors` из `schema-validated-effect.ts`
  - Обеспечивает консистентный маппинг Zod ошибок в ValidationError
- ✅ `core/src/input-boundary/generic-validation.ts` → остается независимым:
  - Не использует `api-schema-guard` или `schema-validated-effect`
  - Используется в `projection-engine.ts` и `context-enricher.ts` для generic DTO валидации
- ✅ Проверено: нет конфликтов между уровнями валидации:
  - Разные уровни абстракции: boundary (API) vs generic (DTO) vs effect (Zod → ValidationError)
  - Разные контексты использования
  - Четкое разделение ответственности

**Тесты:**

- ✅ Тесты для всех модулей:
  - `core/tests/input-boundary/api-schema-guard.test.ts` → тесты boundary-слоя
  - `core/tests/effect/schema-validated-effect.test.ts` → тесты Zod → ValidationError маппинга
  - `core/tests/input-boundary/generic-validation.test.ts` → тесты generic DTO валидации
- ✅ Все тесты проходят успешно

**Экспорты:**

- ✅ `api-schema-guard`:
  - `core/src/input-boundary/index.ts` → экспортирует все типы и функции из `api-schema-guard.js`
  - `core/src/index.ts` → экспортирует через `export * from './input-boundary/index.js'`
- ✅ `schema-validated-effect`:
  - `core/src/effect/index.ts` → экспортирует `ValidatedEffectOptions`, `SchemaValidationError`, `validatedEffect`, `zodIssuesToValidationErrors`
  - `core/src/index.ts` → экспортирует через `export * as effect from './effect/index.js'`
- ✅ `generic-validation`:
  - `core/src/input-boundary/index.ts` → экспортирует все типы и функции из `generic-validation.js`
  - Используется в `projection-engine.ts` и `context-enricher.ts`

**Обновление:** ✅ **ВЫПОЛНЕНО**

Разделена ответственность валидации: `api-schema-guard` в `core/src/input-boundary/` (boundary-слой для API валидации), `schema-validated-effect` остается в `core/src/effect/` (Zod → ValidationError маппинг для результатов Effect), `generic-validation` остается в `core/src/input-boundary/` (generic DTO валидация). `api-validation-runtime.ts` использует `zodIssuesToValidationErrors` из `schema-validated-effect.ts` для консистентного маппинга ошибок. Transport-specific валидация остается в app. Нет конфликтов между уровнями валидации (разные уровни абстракции и контексты). Все проверки (type-check, lint, exports) пройдены успешно.

---

## 🔟 Документация

### 10.1 Обновить документацию core ✅ **ВЫПОЛНЕНО**

**Порядок:** После завершения всех миграций → обновление документации → валидация

**Действия:**

- ✅ Обновить `packages/core/docs/architecture.md` в соответствии с новой архитектурой
- ✅ Обновить `packages/core/README.md` в соответствии с новой архитектурой

**Файлы:**

- ✅ `packages/core/docs/architecture.md` — существует, содержит описание модулей
- ✅ `packages/core/README.md` — существует, содержит описание модулей и примеры

**Причина:** Документация должна отражать актуальную архитектуру после рефакторинга.

**Что обновлено:**

- ✅ Структура экспортов в `core/src/index.ts`:
  - `telemetry` — namespace export через `export * as telemetry`
  - `performance` — namespace export через `export * as performance`
  - `accessControl` — namespace export через `export * as accessControl`
  - `effect` — namespace export через `export * as effect`
  - `transport` — namespace export через `export * as transport`
  - `input-boundary` — прямой export через `export * from './input-boundary/index.js'`
  - `feature-flags` — прямой export через `export * from './feature-flags/index.js'`
- ✅ Новые подпакеты описаны в `core/src/index.ts` с JSDoc:
  - Telemetry (batch core & client)
  - Performance (core & React)
  - Access Control (authorization & access guard)
  - Effect (side-effects & error handling)
  - Transport (SSE, WebSocket)
  - Feature Flags (feature flag engine)
  - Input Boundary (validation & transformation)
- ✅ README.md обновлен с описанием новых модулей:
  - Добавлены разделы: Telemetry, Feature Flags, Performance, Access Control, Effect, Transport
  - Каждый модуль содержит описание и примеры использования
  - Сохранены существующие модули: Input Boundary, Data Safety, Domain Kit, Aggregation, Rule Engine, Pipeline, Resilience, Policies
- ✅ architecture.md обновлен с описанием новых модулей:
  - Добавлены разделы: Telemetry, Feature Flags, Performance, Access Control, Effect, Transport
  - Каждый модуль содержит описание и основные компоненты
  - Сохранены существующие модули: Input Boundary, Data Safety, Domain Kit, Aggregation, Rule Engine, Pipeline, Resilience, Policies
  - Граф зависимостей и примеры использования в feature-auth

**Валидация:**

- ✅ Документация существует и актуальна
- ✅ Все новые модули описаны в `core/src/index.ts` с JSDoc комментариями
- ✅ README.md содержит структуру модулей и примеры
- ✅ architecture.md содержит граф зависимостей и описание модулей

**Обновление:** ✅ **ВЫПОЛНЕНО**

Документация обновлена в соответствии с новой архитектурой после рефакторинга. Все новые подпакеты (telemetry, feature-flags, performance, access-control, effect, input-boundary) описаны в `core/src/index.ts` с JSDoc комментариями. README.md содержит описание модулей и примеры использования. architecture.md содержит граф зависимостей и описание модулей. Разделение ответственности между core и app отражено в документации.

---

## 📊 Итоговая структура

### Core-contracts (типы)

- `domain/common.ts` — ID<T>, ISODateString, Json* (унифицированные)
- `domain/app-effects.ts` — AppError и производные (уже есть)

### Core (инфраструктура)

- `telemetry/batch-core.ts` — чистое batch-ядро
- `telemetry/client.ts` — TelemetryClient
- `feature-flags/` — общий engine (`core.ts` + `react.tsx`)
- `effect/offline-cache.ts` — SWR-ядро
- `transport/sse-client.ts` — SSE runtime
- `transport/websocket.ts` — WebSocket runtime
- `performance/` — метрики и пороги (`core.ts` + `react.tsx`, по паттерну feature-flags)
- `input-boundary/api-schema-guard.ts` — API валидация
- `access-control/route-permissions.ts` — правила доступа к маршрутам
- `access-control/auth-guard.ts` — логика авторизации (ядро + React адаптер)

### App (runtime-специфичное)

- `lib/telemetry-runtime.ts` — runtime singleton
- Остальные UI-специфичные модули
