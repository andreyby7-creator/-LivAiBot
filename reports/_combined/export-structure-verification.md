# Проверка структуры экспортов

**Дата:** 2026-03-15T19:00:00Z
**Статус:** ✅ Все проверки пройдены

## Архитектурный принцип

```
Промежуточный уровень = "фильтр / явные экспорты"
Главный индекс = "удобный фасад / реэкспорт подпакетов"
```

## ✅ Главные индексы (используют `export *` для реэкспорта подпакетов)

- `packages/app/src/index.ts` ✅
- `packages/ui-core/src/index.ts` ✅
- `packages/core/src/index.ts` ✅
- `packages/domains/src/index.ts` ✅
- `packages/domains/src/classification/index.ts` ✅ (главный индекс для classification)
- `packages/feature-auth/src/index.ts` ✅
- `packages/feature-auth/src/effects/index.ts` ✅ (главный индекс для effects)
- `packages/core-contracts/src/index.ts` ✅
- `packages/feature-bots/src/index.ts` ✅

## ✅ Промежуточные индексы (используют явные экспорты `export { ... }`)

### packages/app

- `background/index.ts` ✅
- `events/index.ts` ✅
- `hooks/index.ts` ✅
- `lib/index.ts` ✅
- `providers/index.ts` ✅
- `routes/index.ts` ✅
- `state/index.ts` ✅
- `types/index.ts` ✅
- `ui/index.ts` ✅

### packages/ui-core

- `primitives/index.ts` ✅
- `components/index.ts` ✅
- `types/index.ts` ✅

### packages/core

- `data-safety/index.ts` ✅
- `input-boundary/index.ts` ✅
- `policies/index.ts` ✅
- `domain-kit/index.ts` ✅
- `aggregation/index.ts` ✅
- `rule-engine/index.ts` ✅
- `resilience/index.ts` ✅
- `pipeline/index.ts` ✅
- `transport/index.ts` ✅

### packages/domains/classification

- `signals/index.ts` ✅
- `evaluation/index.ts` ✅
- `aggregation/index.ts` ✅
- `policies/index.ts` ✅
- `strategies/index.ts` ✅
- `providers/index.ts` ✅

### packages/feature-auth

- `domain/index.ts` ✅
- `contracts/index.ts` ✅
- `dto/index.ts` ✅
- `schemas/index.ts` ✅
- `types/index.ts` ✅
- `lib/index.ts` ✅
- `stores/index.ts` ✅
- `effects/shared/index.ts` ✅
- `effects/register/index.ts` ✅
- `effects/login/index.ts` ✅
- `effects/refresh/index.ts` ✅
- `effects/logout/index.ts` ✅

## ✅ Особые случаи (нормально использовать `export *`)

Эти промежуточные индексы используют `export *`, но это нормально, так как они реэкспортируют **прямые файлы** (не индексы):

- `packages/core/src/access-control/index.ts` → реэкспортирует `auth-guard.ts`, `auth-guard.react.tsx`, `route-permissions.ts` (прямые файлы)
- `packages/core/src/effect/index.ts` → реэкспортирует `offline-cache.js`
- `packages/core/src/feature-flags/index.ts` → реэкспортирует `core.js`
- `packages/core/src/telemetry/index.ts` → реэкспортирует `batch-core.js`
- `packages/core/src/performance/index.ts` → реэкспортирует `core.js`
- `packages/core-contracts/src/domain/index.ts` → реэкспортирует прямые файлы (common.js, auth.js и т.д.)
- `packages/core-contracts/src/context/index.ts` → реэкспортирует прямые файлы (headers.js, http-contracts.js)
- `packages/core-contracts/src/errors/index.ts` → реэкспортирует прямой файл (http.js)
- `packages/core-contracts/src/validation/zod/index.ts` → реэкспортирует прямые файлы (custom/_.js, utils/_.js)
- `packages/feature-bots/src/types/index.ts` → реэкспортирует прямые файлы (bot-lifecycle.js, bot-commands.js, bots.js)

## Результат

✅ **Все проверки пройдены**

- Главные индексы используют `export *` для реэкспорта подпакетов (правильно)
- Промежуточные индексы используют явные экспорты `export { ... }` (правильно)
- Особые случаи с `export *` реэкспортируют прямые файлы, не индексы (правильно)

Структура соответствует архитектурному принципу:

- **Промежуточный уровень** = фильтр с явными экспортами для tree-shaking
- **Главный индекс** = удобный фасад для реэкспорта всех подпакетов

## Влияние на Turbopack

✅ **Оптимизация на правильном уровне:**

- Промежуточные индексы с явными экспортами обеспечивают эффективный tree-shaking
- Главные индексы с `export *` обеспечивают удобный API без потери производительности
- Turbopack может эффективно анализировать граф зависимостей благодаря явным экспортам на промежуточном уровне

**Вывод:** Структура экспортов оптимальна для Turbopack, дополнительных изменений не требуется.
