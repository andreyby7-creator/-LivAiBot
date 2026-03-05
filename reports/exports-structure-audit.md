# Архитектура экспортов монорепы

## Принципы

1. **`exports` → `dist`**: Все runtime работают только по собранным артефактам `dist/*`
2. **`src` не экспортируется**: Публичный API всегда из `dist`, исходники строго внутренние
3. **Логические subpath без расширений**: Ключи вида `"./effects/login"`, не `"./effects/login.js"`
4. **Явные subpath exports**: Каждый публичный модуль явно перечислен, wildcard запрещены
5. **Обязательные `types`**: Каждый subpath export имеет поле `types` для корректного резолва TypeScript

## Поток данных

```
┌─────────────────────────────────────────────────────────────────┐
│                         Исходники (src/)                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ src/index.ts                                              │ │
│  │ src/effects/login.ts                                       │ │
│  │ src/lib/utils.ts                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ build:types (tsc)
                            │ build:js (tsup)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Артефакты сборки (dist/)                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ dist/index.js          ← Runtime код (tsup)                   │ │
│  │ dist/index.d.ts        ← Типы (tsc)                           │ │
│  │ dist/effects/login.js  ← Runtime код (tsup)                   │ │
│  │ dist/effects/login.d.ts ← Типы (tsc)                          │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ package.json exports
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Публичный API (exports)                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ "." → types: "./dist/index.d.ts"                           │ │
│  │      import: "./dist/index.js"                              │ │
│  │                                                              │ │
│  │ "./effects/login" → types: "./dist/effects/login.d.ts"      │ │
│  │                    import: "./dist/effects/login.js"         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ import '@livai/package' или
                            │ import '@livai/package/effects/login'
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Потребители (apps/packages)                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ TypeScript → резолв типов через exports[*].types           │ │
│  │ Runtime → резолв кода через exports[*].import              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Ключевые моменты:**
- **Dev**: `moduleResolution: "bundler"` + `paths` → импорты идут напрямую в `src/` (без сборки)
- **Build**: `tsc` генерирует `.d.ts`, `tsup` генерирует `.js` → оба в `dist/`
- **Runtime**: Все импорты резолвятся через `exports` → только `dist/*`
- **Типы**: TypeScript использует `exports[*].types` → всегда `dist/*.d.ts`

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

## Build Pipeline

### Разделение сборки

- **`tsc`**: Генерирует только `.d.ts` файлы (`emitDeclarationOnly: true`)
- **`tsup`**: Генерирует только `.js` файлы (`dts: false`)
- **`moduleResolution: "bundler"`**: Для dev, `paths` указывают на `packages/*/src`

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
  "files": ["dist"]
}
```

## Преимущества

- **Единообразие**: Все пакеты следуют единому шаблону
- **Производительность**: Tree-shaking, кэширование, быстрый резолв
- **Типобезопасность**: Корректный резолв типов через `exports[*].types`
- **Масштабируемость**: Явная поверхность API, легко добавлять пакеты
- **Совместимость**: Node.js ESM, Vite/Vitest, TypeScript, все bundlers

## Валидация

Скрипт `scripts/check-exports.js` проверяет все invariants и интегрирован в CI.

## Использование

```ts
// ✅ Корректно
import { AuthState } from '@livai/feature-auth';
import { createLoginEffect } from '@livai/feature-auth/effects/login';

// ❌ Запрещено
import { X } from '@livai/feature-auth/src/effects/login';
import { Y } from '@livai/feature-auth/dist/effects/login';
```