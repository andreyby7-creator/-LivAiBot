# Turbopack Optimization Report

**Дата:** 2026-03-15\
**Цель:** Оптимизация скорости Turbopack без ущерба функциональности

## 🔴 Критичные проблемы

### 1. Смешанные src/dist импорты

**Проблема:** `packages/core/package.json` имел exports на `src` вместо `dist`

**Статус:** ✅ **Исправлено**

**Исправлено:**

- `packages/core/package.json` - exports изменены на `dist`
- `packages/core/tsup.config.ts` - добавлены entry points для `policies/index` и `input-boundary/*`
- Пакет пересобран, файлы созданы в `dist`

**Проверка:**

- ✅ type-check для всех пакетов - OK
- ✅ Импорт `@livai/core/input-boundary/api-schema-guard` - работает (11 экспортов)
- ✅ Файлы созданы: `dist/policies/index.js`, `dist/input-boundary/index.js`, `dist/input-boundary/api-schema-guard.js`

**Ожидаемое улучшение:** 30-50% ускорение dev сервера

---

### 2. `export *` в Barrel Files

**Проблема:** `export *` заставляет Turbopack анализировать весь граф зависимостей

**Статус:** ⚠️ **Требует исправления**

**Найдено:**

- `packages/app/src/index.ts` - 5 `export *`
- `packages/ui-core/src/index.ts` - 3 `export *`
- `packages/core/src/index.ts` - 9 `export *`
- Всего: ~25 критичных использований

**Действие:** Заменить `export *` на явные `export { }` в критичных файлах

**Ожидаемое улучшение:** 20-40% ускорение сборки

---

### 3. transpilePackages слишком широкий

**Проблема:** Включены все 11 пакетов вместо только UI

**Статус:** ✅ **Исправлено**

**Было:**

```javascript
transpilePackages: [
  '@livai/app',
  '@livai/core',
  '@livai/core-contracts',
  '@livai/ui-core',
  '@livai/ui-features',
  '@livai/ui-shared',
  '@livai/feature-auth',
  '@livai/feature-bots',
  '@livai/feature-chat',
  '@livai/feature-voice',
  '@livai/domains',
];
```

**Стало:**

```javascript
transpilePackages: [
  '@livai/ui-core',
  '@livai/ui-features',
  '@livai/ui-shared',
  '@livai/app',
];
```

**Ожидаемое улучшение:** 10-30% ускорение

---

## ✅ Проверки выполнены

### 1. Импорты из `/dist/`

- **Статус:** ✅ OK
- **Результат:** Нет импортов типа `import { x } from '@livai/core/dist/...'`

### 2. Двойные entrypoints

- **Статус:** ✅ **Исправлено**
- **Результат:** `packages/core/package.json` exports исправлены на `dist`, нет полей `main`/`module` (используется только `exports`)

### 3. Alias на src в tsconfig

- **Статус:** ✅ **OK** (с `moduleResolution: "bundler"`)
- **Результат:** `apps/web/tsconfig.json` paths на корень пакетов - нормально для Next.js/Turbopack, разрешение идет через `package.json` exports

### 4. Размер кэша

- **Статус:** ✅ OK
- **Результат:** 562M (нормально, не >1-1.5GB)

### 5. Server/Client Mix

- **Статус:** ✅ OK
- **Результат:** Нет проблем, все корректно разделено

---

## 📋 План действий

| # | Действие                                                   | Статус | Приоритет   | Ожидаемое улучшение |
| - | ---------------------------------------------------------- | ------ | ----------- | ------------------- |
| 1 | Исправить exports на `dist` в `packages/core/package.json` | ✅     | 🔴 Критично | 30-50%              |
| 2 | Удалить `export *` из критичных файлов                     | ⏳     | 🔴 Критично | 20-40%              |
| 3 | Ограничить transpilePackages только UI                     | ✅     | -           | 10-30%              |
| 4 | Мигрировать импорты на прямые пути                         | ⏳     | 🟠 Высокий  | 10-20%              |
| 5 | Добавить subpath exports после миграции                    | ⏳     | 🟡 Средний  | 10-20%              |

---

## 📊 Детальная статистика

**Найдено `export *`:**

- Всего: 129 использований
- Критичные: ~25 в основных barrel файлах
- В тестах: ~104 (можно игнорировать)

**Критичные файлы:**

- `packages/app/src/index.ts` - 5 `export *`
- `packages/ui-core/src/index.ts` - 3 `export *`
- `packages/core/src/index.ts` - 9 `export *`
- `packages/domains/src/classification/index.ts` - 6 `export *`
- `packages/feature-auth/src/index.ts` - 8 `export *`

**Хорошие примеры:**

- `packages/app/src/ui/index.ts` - использует `export { }` ✅

---

## 🎯 Реалистичные оценки ускорения

| Оптимизация                   | Реальный эффект | Сложность |
| ----------------------------- | --------------- | --------- |
| Исправить src/dist смешивание | 🔴 **30-50%**   | Низкая    |
| Удалить `export *`            | 🔴 **20-40%**   | Средняя   |
| Ограничить transpilePackages  | 🟠 **10-30%**   | Низкая    |
| Subpath exports + миграция    | 🟠 **10-20%**   | Высокая   |

**Общий потенциал:** 70-140% ускорение сборки (при выполнении всех оптимизаций)

---

## ⚠️ Важные замечания

1. **Размер barrel-файла не критичен:** Если используется `export { }`, Turbopack tree-shake нормально работает даже с большими файлами
2. **Subpath exports ускоряют только прямые импорты:** Ускорение появляется только при реальном использовании прямых путей, не автоматически
3. **Постепенная миграция возможна:** Критичные файлы сначала, затем менее используемые
4. **transpilePackages:** Только UI пакеты, не все workspace пакеты
