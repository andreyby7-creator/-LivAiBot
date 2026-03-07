# План рефакторинга Feature Flags

## Цель

Перенести общий feature flags engine из `app/lib/feature-flags.ts` в `core/feature-flags/` с разделением на core (без React) и react части. Унифицировать хэширование между общим engine и pipeline feature flags.

---

## Шаг 1: Создать общий hash модуль

**Файл:** `packages/core/src/hash.ts`

**Действия:**

- Перенести MurmurHash3 из `app/lib/feature-flags.ts` (строки 497-527)
- Экспортировать функцию `stableHash(input: string): number`
- Удалить все константы MURMURHASH_* из app/lib/feature-flags.ts

**Критично:** Этот hash будет использоваться и в `feature-flags/core.ts`, и в `pipeline/feature-flags.ts` для унификации хэширования. Оба модуля должны импортировать `stableHash` из `core/hash.ts`.

**Проверка:**

```bash
grep -r "stableHash" packages/core/src/hash.ts
```

---

## Шаг 2: Создать структуру core/feature-flags

**Структура:**

```
packages/core/src/
├── hash.ts                     # MurmurHash3 / stableHash (общая утилита)
├── feature-flags/
│   ├── index.ts                # Public API: export * from './core.js'; export * as react from './react.js';
│   ├── core.ts                 # Core engine: types + strategies + evaluation + provider (без React)
│   └── react.tsx               # React-specific: FeatureFlagOverrideContext, Provider, useFeatureFlagOverride
└── pipeline/
    └── feature-flags.ts         # Pipeline rollout, использует stableHash из ../../hash.ts
```

**Критично:**

- Плоская структура: `core.ts` - один файл с логическими секциями (TYPES → STRATEGIES → EVALUATION → PROVIDER)
- `react.tsx` - один файл с React-специфичными частями
- Сохранить комментарии-разделители (`/* ===== */`) для навигации (как в `pipeline/plan.ts`)

---

## Шаг 3: Перенести core логику (без React)

**Файл:** `core/feature-flags/core.ts`

**Структура файла (логические секции через комментарии):**

1. **TYPES** (верхняя часть файла)
   - `FeatureAttributeValue`, `KnownFeatureAttributes`, `FeatureAttributes`
   - `FeatureFlagLogger`, `FeatureContext`
   - `FeatureFlagName`, `FeatureFlagDefinition`
   - `FeatureFlagStrategy`, `FeatureFlagProvider`
   - `FeatureEvaluationReason`, `FeatureEvaluationResult`
   - `FeatureFlagOverrides`

2. **STRATEGIES** (после types)
   - `alwaysOn`, `alwaysOff`
   - `enabledForUsers`, `enabledForTenants`
   - `percentageRollout` (использует `stableHash` из `../../hash.js`)
   - `and`, `or`, `not`
   - `setGlobalFeatureFlagLogger`, `getGlobalFeatureFlagLogger`
   - `freezeContext`

3. **EVALUATION** (после strategies)
   - `evaluateFeature`
   - `isFeatureEnabled`
   - `evaluateFeatures`
   - `safeExecuteStrategy` (internal)
   - `evaluateFromMap` (internal)

4. **PROVIDER** (в конце)
   - `createInMemoryFeatureFlagProvider`

**Источник:** `app/lib/feature-flags.ts` строки 46-535 (все кроме React частей и hash)

**Критично:**

- **НЕ импортировать React** - core engine должен быть без React зависимостей
- Импортировать `stableHash` из `../../hash.js` (унификация хэширования)
- Сохранить структуру с комментариями-разделителями (`/* ===== */`)
- Порядок секций: TYPES → STRATEGIES → EVALUATION → PROVIDER

---

## Шаг 4: Перенести React части

**Файл:** `core/feature-flags/react.tsx`

**Содержимое:**

- `FeatureFlagOverrideContext`
- `FeatureFlagOverrideProvider`
- `useFeatureFlagOverride`
- `FeatureFlagOverrides` type (если не экспортирован из core.ts)

**Источник:** `app/lib/feature-flags.ts` строки 545-600

**Критично:**

- **React части полностью изолированы** - только в `react.tsx`, не в `core.ts`
- Добавить `'use client'` директиву в начале файла
- Импортировать типы из `./core.js` (FeatureFlagName, FeatureFlagOverrides)

---

## Шаг 5: Создать главный index.ts

**Файл:** `core/feature-flags/index.ts`

```typescript
// Core engine (без React)
export * from './core.js';

// React parts (опционально)
export * as react from './react.js';
```

---

## Шаг 6: Обновить pipeline feature flags

**Файл:** `core/pipeline/feature-flags.ts`

**Действия:**

- Удалить функцию `deterministicHash` (строки 143-151)
- Импортировать: `import { stableHash } from '../hash.js';`
- Заменить `deterministicHash(userId)` на `stableHash(userId)` в `computeBucketId` (строка 159)

**Критично:** Унификация хэширования - `pipeline/feature-flags.ts` должен использовать тот же `stableHash` из `core/hash.ts`, что и `feature-flags/core.ts`. Это обеспечивает консистентность между системами.

**Проверка:**

```bash
grep -n "deterministicHash\|stableHash" packages/core/src/pipeline/feature-flags.ts
```

---

## Шаг 7: Добавить экспорты в core/src/index.ts

**Файл:** `core/src/index.ts`

**Добавить после секции EFFECT:**

```typescript
/* ============================================================================
 * 🚩 FEATURE-FLAGS — FEATURE FLAG ENGINE
 * ========================================================================== */
/**
 * Feature Flags: детерминированный engine для управления feature flags.
 * Core engine без React зависимостей, React части доступны через react subpath.
 * @public
 */
export * from './feature-flags/index.js';
```

**Критично:** Проверить что все публичные API экспортируются через `core/src/index.ts`. Импорты:

- Core: `@livai/core/feature-flags`
- React: `@livai/core/feature-flags/react`
- Hash: `@livai/core/hash` (или через feature-flags)

---

## Шаг 8: Обновить импорты в app

### 8.1 `app/src/providers/FeatureFlagsProvider.tsx`

**Было:**

```typescript
import type { FeatureFlagName } from '../lib/feature-flags.js';
```

**Стало:**

```typescript
import type { FeatureFlagName } from '@livai/core/feature-flags';
```

### 8.2 `app/src/hooks/useFeatureFlags.ts`

**Было:**

```typescript
import type { FeatureFlagName } from '../lib/feature-flags.js';
```

**Стало:**

```typescript
import type { FeatureFlagName } from '@livai/core/feature-flags';
```

### 8.3 `app/src/providers/UnifiedUIProvider.tsx`

**Было:**

```typescript
import { useFeatureFlagOverride } from '../lib/feature-flags.js';
```

**Стало:**

```typescript
import { useFeatureFlagOverride } from '@livai/core/feature-flags/react';
```

### 8.4 `app/src/lib/index.ts`

**Найти и удалить:**

```typescript
export { ... } from './feature-flags.js';
```

**Критично:** Правильные импорты:

- Core типы/функции: `@livai/core/feature-flags`
- React hooks: `@livai/core/feature-flags/react`
- Pipeline feature flags: остается `@livai/core/pipeline` (экспортирует свои feature flags)

**Проверка:**

```bash
grep -r "from.*lib/feature-flags" packages/app/src
```

---

## Шаг 9: Обновить тесты

### 9.1 Переместить тесты

**Было:** `app/tests/unit/lib/feature-flags.test.ts`\
**Стало:** `core/tests/feature-flags/core.test.ts`

**Действия:**

- Обновить импорты на `@livai/core/feature-flags`
- Удалить тесты для React частей (они остаются в app тестах)
- Обновить импорт hash: `import { stableHash } from '@livai/core/hash'` или через feature-flags

### 9.2 Создать тесты для React частей

**Файл:** `app/tests/unit/lib/feature-flags-react.test.tsx`

**Действия:**

- Перенести тесты для `useFeatureFlagOverride`, `FeatureFlagOverrideProvider`
- Обновить импорты на `@livai/core/feature-flags/react`

### 9.3 Обновить `app/tests/unit/providers/FeatureFlagsProvider.test.tsx`

**Было:**

```typescript
import type { FeatureFlagName } from '../../../src/lib/feature-flags';
```

**Стало:**

```typescript
import type { FeatureFlagName } from '@livai/core/feature-flags';
```

### 9.4 Обновить pipeline feature flags тесты

**Файл:** `core/tests/pipeline/feature-flags.test.ts`

**Проверка:** Тесты должны работать без изменений (hash функция та же, только импорт другой)

**Критично:**

- Core тесты в `core/tests/feature-flags/`
- React тесты остаются в `app/tests/unit/lib/` (они тестируют React интеграцию)

---

## Шаг 10: Удалить старый файл

**Файл:** `app/src/lib/feature-flags.ts`

**Действия:**

- Удалить файл после проверки всех импортов

**Проверка:**

```bash
grep -r "from.*lib/feature-flags" packages/
# Должно быть пусто
```

---

## Шаг 11: Валидация

**Команды:**

```bash
# Type check
pnpm run type-check

# Lint
pnpm run lint:canary

# Проверка экспортов
pnpm run check:exports

# Тесты
pnpm test packages/core/tests/feature-flags
pnpm test packages/app/tests/unit/lib/feature-flags-react
pnpm test packages/core/tests/pipeline/feature-flags
```

---

## Порядок выполнения

1. Шаг 1 (hash) → можно делать параллельно с шагом 2
2. Шаги 2-5 (структура и перенос) → последовательно
3. Шаг 6 (pipeline) → после шага 1
4. Шаги 7-8 (экспорты и импорты) → после шагов 2-5
5. Шаг 9 (тесты) → после шагов 2-5
6. Шаг 10 (удаление) → после всех проверок
7. Шаг 11 (валидация) → финальная проверка

---

## Откат

Если что-то пойдет не так:

1. Восстановить `app/src/lib/feature-flags.ts` из git
2. Откатить изменения импортов
3. Удалить созданные файлы в `core/src/feature-flags/` и `core/src/hash.ts`
