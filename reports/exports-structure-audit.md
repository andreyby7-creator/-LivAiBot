# Архитектура экспортов монорепы

## Текущее состояние (финальная архитектура)

### Принципы

1. **`exports` → `dist`**: Все runtime (Node/Vite/Vitest/bundlers) работают только по собранным артефактам `dist/*`
2. **`src` не экспортируется**: Публичный API всегда берётся из `dist`, исходники строго внутренние
3. **Логические subpath без расширений**: Ключи вида `"./effects/login"`, не `"./effects/login.js"`
4. **Явные subpath exports**: Каждый публичный модуль явно перечислен, wildcard запрещены
5. **Обязательные `types`**: Каждый subpath export имеет поле `types` для корректного резолва TypeScript

### Статистика

- **11 пакетов** с `exports` конфигурацией
- **~400 subpath exports** суммарно
- **100% пакетов** используют `dist/*` в `exports`
- **0 пакетов** экспортируют `src/*`

### Структура пакетов

```
packages/<package>/
├── src/              # Исходники (внутренние)
│   ├── index.ts
│   └── ...
├── dist/             # Артефакты сборки (публичные)
│   ├── index.js
│   ├── index.d.ts
│   └── ...
├── package.json      # exports → dist/*
├── tsconfig.json     # Dev конфигурация
├── tsconfig.build.json # Build конфигурация (types only)
└── tsup.config.ts   # Build конфигурация (JS only)
```

## Golden Build-Pipeline

### package.json

```json
{
  "type": "module",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./effects/login": {
      "types": "./dist/effects/login.d.ts",
      "import": "./dist/effects/login.js",
      "default": "./dist/effects/login.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "pnpm run build:types && pnpm run build:js",
    "build:types": "tsc -p tsconfig.build.json",
    "build:js": "tsup"
  }
}
```

### tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationMap": true
  },
  "include": ["src"]
}
```

### tsup.config.ts

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2024',
  dts: false,  // Типы генерируются только через tsc
  sourcemap: true,
  clean: true,
  outDir: 'dist'
});
```

### Корневой tsconfig.json

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler",
    "target": "ES2024",
    "paths": {
      "@livai/*": ["packages/*/src"]
    }
  }
}
```

## Architecture Invariants

1. ✅ **`exports` всегда указывают только на `dist`** — никаких ссылок на `src`
2. ✅ **`src` никогда не экспортируется наружу** — публичный API только из `dist`
3. ✅ **Ключи subpath exports не содержат расширений** — только логические подпути
4. ✅ **Wildcard exports запрещены** — каждый subpath явно перечислен
5. ✅ **Каждый subpath export имеет `types`** — обязательное поле для TypeScript
6. ✅ **Поля `main`/`module` не используются** — только `type`, `types`, `exports`
7. ✅ **Плоский `dist/*`** — без `dist/esm`/`dist/cjs` (pure ESM)
8. ✅ **`sideEffects: false`** — для максимального tree-shaking
9. ✅ **Internal API не экспортируется** — только публичные модули
10. ✅ **Импорты только через имя пакета** — `@livai/<package>` или `@livai/<package>/<subpath>`

## Преимущества

### 1. Единообразие и предсказуемость

- **Один контракт**: Все пакеты следуют единому шаблону
- **Явные зависимости**: Каждый публичный модуль явно объявлен
- **Контроль API**: Невозможно случайно экспортировать внутренние модули

### 2. Производительность

- **Tree-shaking**: `sideEffects: false` позволяет bundlers оптимизировать импорты
- **Кэширование**: Собранные артефакты кэшируются эффективнее исходников
- **Быстрый резолв**: Node/bundlers работают напрямую с `dist/*`, без компиляции

### 3. Типобезопасность

- **Корректный резолв типов**: TypeScript всегда находит `.d.ts` через `exports[*].types`
- **Согласованность**: Типы и runtime код всегда синхронизированы (оба из `dist`)
- **Проверка на этапе сборки**: `check-exports.js` валидирует структуру до CI

### 4. Масштабируемость

- **Легко добавлять пакеты**: Единый шаблон для всех новых пакетов
- **Явная поверхность API**: Легко понять, что публично, а что внутреннее
- **Миграция без breaking changes**: Можно добавлять новые subpath exports постепенно

### 5. Совместимость

- **Node.js ESM**: Корректный резолв через `exports.import`
- **Vite/Vitest**: Работает с `exports` и tree-shaking
- **TypeScript**: Корректный резолв типов через `exports[*].types`
- **Bundlers**: Webpack, Turbopack, Rollup, esbuild — все поддерживают `exports`

## Валидация

### Автоматическая проверка

Скрипт `scripts/check-exports.js` проверяет:

1. ✅ `exports` указывают только на `dist` (нет `src`)
2. ✅ Ключи subpath exports не содержат `.js`/`.ts`
3. ✅ Нет wildcard шаблонов `"./*"`
4. ✅ Все файлы из `exports` существуют в `dist`
5. ✅ Все `.d.ts` файлы существуют для subpath exports
6. ✅ Каждый subpath export имеет поле `types`
7. ✅ Нет `main`/`module` полей (только `exports`)
8. ✅ Структура `dist` соответствует `exports`

### CI интеграция

```yaml
- name: Check exports
  run: pnpm run check:exports
```

## Примеры использования

### Импорты между пакетами

```ts
// ✅ Корректно: через имя пакета
import { AuthState } from '@livai/feature-auth';
import { createLoginEffect } from '@livai/feature-auth/effects/login';
import { LoginForm } from '@livai/ui-features/auth/login-form';

// ❌ Запрещено: прямые пути к src/dist
import { X } from '@livai/feature-auth/src/effects/login';
import { Y } from '@livai/feature-auth/dist/effects/login';
```

### Внутренние импорты (внутри пакета)

```ts
// ✅ Корректно: относительные пути с .js
import { helper } from './lib/helper.js';
import { utils } from '../utils/index.js';
```

## Миграция завершена

- ✅ Все пакеты используют `dist/*` в `exports`
- ✅ Убраны все `.js` из ключей subpath exports
- ✅ Убраны все `src/` из путей exports
- ✅ Все пакеты следуют Golden build-pipeline
- ✅ `check-exports.js` проходит для всех пакетов
- ✅ Все тесты проходят
- ✅ Type-check проходит
- ✅ CI валидирует структуру экспортов

## Поддержка

При добавлении нового пакета:

1. Использовать шаблоны из раздела "Golden Build-Pipeline"
2. Заполнить `exports` только путями в `dist`
3. Запустить `pnpm run check:exports` для валидации
4. Убедиться, что `build:types` и `build:js` проходят успешно
