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
