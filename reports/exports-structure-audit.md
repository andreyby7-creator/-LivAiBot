## Обзор текущей конфигурации

- **Монорепа / TS**
  - Корневой `tsconfig.json`: `module = ES2022`, `moduleResolution = bundler`, `target = ES2024`, глобальные path‑alias под `@livai/*` и `@/*`, `declaration`/`declarationMap` включены, но в пакетах сборка типов делается отдельными `tsconfig.build.json`.
  - Пакеты используют `tsconfig.json` (dev) + `tsconfig.build.json` (prod) c `extends: "../../tsconfig.json"`, `module = NodeNext`, `moduleResolution = NodeNext`, `outDir = "dist/esm"`.
- **Tsup**
  - Все пакеты собираются через `tsup` в `dist/esm`, формат `esm`, таргет везде `es2024`, кроме `@livai/app` (`es2022`), платформы: `neutral` (core/domains/feature-auth), `node` (core-contracts, feature-*), `browser` (ui-*).
- **package.json / main/module/types**
  - Во всех публикуемых пакетах (`packages/*`): `"type": "module"`, `"main": "./dist/esm/index.js"`, `"module": "./dist/esm/index.js"`, `"types": "./dist/esm/index.d.ts"`, `"files": ["dist"]`.
- **exports по пакетам (высокоуровнево)**
  - `@livai/core`, `@livai/domains`, `@livai/core-contracts`, `@livai/feature-bots`, `@livai/feature-chat`, `@livai/feature-voice`, `@livai/ui-core`, `@livai/ui-shared`:
    - `"exports"."."`: `types`/`import` указывают на `./src/index.ts`.
    - Доп. subpath‑exports: часть пакетов (`core`, `domains`) используют логические подпути без `.js` в ключе (`"./domain-kit"`, `"./signals"`, и т.п.), часть вообще без подпутей.
  - `@livai/feature-auth`, `@livai/ui-features`, `@livai/app`:
    - `"exports"."."`: `./src/index.ts`.
    - Много subpath‑exports с ключами, заканчивающимися на `.js` (`"./lib/error-mapping.js"`, `"./auth/login-form.js"`, `"./src/domain/LoginRequest.js"` и т.п.), но `types`/`import` указывают на `./src/*.ts(x)`.
  - Все публичные API в `src/index.ts` построены по схеме «главный индекс реэкспортирует подпакеты» через `export * from './xxx/index.js'` и согласованы со скриптом `scripts/check-exports.js`.

## Выявленные несоответствия и риски

- **1. exports → src, а не dist (главная архитектурная ошибка)**
  - Во всех пакетах `exports` указывают на исходники `./src/*.ts(x)`, а не на собранные файлы `./dist/esm/*.js` и `./dist/esm/*.d.ts` — это production‑антипаттерн для монореп.
  - Формальное несоответствие `main/module/types` (указывает на dist) и `exports` (указывает на src).
  - Конкретные проблемы:
    - **Node не умеет исполнять `.ts`** — прямой экспорт `src` ломает runtime без сборки.
    - **Bundlers могут обходить `exports` и использовать `main/module`**, что даёт разные пути резолва в dev/prod.
    - **Публикация пакетов ломается**: опубликованный артефакт с `exports → src` не работает вне монорепы.
    - **Внешние потребители (external packages) не могут корректно зарезолвить `@livai/*`**, если у них нет такого же TS‑пайплайна.

- **2. Смешение форматов ключей subpath‑exports**
  - `core/domains`: ключи вида `"./domain-kit"`, `"./signals"`, `"./strategies"` (семантические подпути без расширения).
  - `feature-auth/ui-features/app`: ключи вида `"./lib/error-mapping.js"`, `"./auth/login-form.js"`, `"./src/domain/LoginRequest.js"` (в ключе жестко зашит `.js` и/или `src`).
  - Результат: нет единого контракта для импорта (`@livai/domains/signals` против `@livai/ui-features/auth/login-form.js`).

- **3. Наличие `src` в экспортируемых путях**
  - В `@livai/feature-auth` subpath‑ключи содержат `./src/...`, что привязывает потребителя к внутренней структуре исходников.
  - Аналогично в некоторых экспортах `@livai/app`/`@livai/ui-features` путь кодирует структуру исходников, а не публичный API.

- **4. Дублирование генерации d.ts**
  - В большинстве пакетов:
    - `tsconfig.build.json`: `declaration = true`, `declarationDir = "dist/esm"`.
    - `tsup.config.ts`: `dts: true`.
  - Исключение: `@livai/core-contracts` (`dts: false`, типы делает только `tsc`).
  - Риск: дублирующая/конкурирующая генерация `.d.ts`, сложнее отлаживать расхождения.

- **5. Несогласованный target в tsup**
  - Почти все пакеты: `target: 'es2024'`, но:
    - `@livai/app`: `target: 'es2022'`.
  - Это не ломает сборку, но нарушает единый контракт транспиляции, осложняет reasoning о минимальном рантайме.

- **6. Разная семантика platform**
  - `core`/`domains`/`feature-auth`: `platform: 'neutral'` (логика, пригодная для node/web/edge).
  - `core-contracts` и все `feature-*` (кроме auth): `platform: 'node'`.
  - `ui-*` и `@livai/app`: `platform: 'browser'` (или node + external для next).
  - Семантически это оправдано, но нет явного правила/документа, что:
    - domain/core‑слой — `neutral`,
    - feature‑сервисы — `node`,
    - UI/app — `browser`.

- **7. NodeNext vs bundler в tsconfig**
  - Корень: `moduleResolution = bundler`.
  - Пакеты: `moduleResolution = NodeNext` в `tsconfig.build.json`.
  - Сейчас это работает, но это скрытая точка расхождения между дев‑режимом и билдом.
  - Рекомендуемая схема:
    - **dev (`tsconfig.json`) → `moduleResolution = bundler`** для комфортной разработки.
    - **build (`tsconfig.build.json`) → `moduleResolution = NodeNext`** для корректного ESM в Node.
    - При этом во всех исходниках импорты всегда пишутся с `.js`‑расширениями (`"./effects/login.js"`), чтобы поведение bundler/NodeNext было единым.

## Целевая унифицированная модель exports

- **A. Единый принцип: exports/types → dist, src никогда не экспортируется**
  - Базовое правило:
    - **`exports → dist`**
    - **`types  → dist`**
    - **импорты снаружи → только через имя пакета (и subpath), без `dist`/`src`**
    - **`src` никогда не фигурирует в `exports`**
  - Для всех пакетов (пример базового случая):
    - `"type": "module"`,
    - `"types": "./dist/index.d.ts"`,
    - `"exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js",
        "default": "./dist/index.js"
      }
    }`.
  - Сейчас часть пакетов использует `./dist/esm/...` — целевой вариант для библиотек: плоский `./dist/*` без подкаталогов формата (`esm`/`cjs`); структура `dist/esm`/`dist/cjs` имеет смысл только если реально собираются оба формата.
  - С учётом приоритета Node ESM‑резолвера:
    - порядок: `exports` → `imports` → `main`,
    - при наличии `exports` поля `main`/`module` игнорируются,
    - поэтому в целевой модели достаточно `type` + `types` + `exports`, без `main`/`module`.
  - Идеальная структура production‑пакета:
    - `packages/feature-auth/src/index.ts`, `packages/feature-auth/src/effects/login.ts`, …
    - `packages/feature-auth/dist/index.js`, `packages/feature-auth/dist/index.d.ts`, `packages/feature-auth/dist/effects/login.js`, `packages/feature-auth/dist/effects/login.d.ts`.

- **B. Каноническая форма subpath‑exports**
  - **Ключи**:
    - Только логические подпути **без** `src` и без `.js/.ts` в ключе:
      - Примеры: `"./domain-kit"`, `"./classification/signals"`, `"./auth/login-form"`, `"./lib/error-mapping"`.
  - **Значения**:
    - Ссылаются на конкретные файлы в `dist`:
      - `types`: `"./dist/<subpath>.d.ts"`,
      - `import`: `"./dist/<subpath>.js"`,
      - `default`: `"./dist/<subpath>.js"`.
    - Жёсткий инвариант: **каждый subpath‑export обязан иметь поле `types`**, иначе TypeScript не сможет корректно резолвить типы при импорте через subpath (`exports["./effects/login"].types` обязано существовать).
    - Примеры (по таргет‑модели):
      - `@livai/domains`:
        - `"./classification/signals": { "types": "./dist/classification/signals/index.d.ts", "import": "./dist/classification/signals/index.js" }`.
      - `@livai/ui-features`:
        - `"./auth/login-form": { "types": "./dist/auth/login-form.d.ts", "import": "./dist/auth/login-form.js" }`.
      - `@livai/feature-auth`:
        - `"./effects/login": { "types": "./dist/effects/login.d.ts", "import": "./dist/effects/login.js" }`,
        - `"./effects/logout": { "types": "./dist/effects/logout.d.ts", "import": "./dist/effects/logout.js" }`.
  - Жёстко запрещённые формы ключей:
    - **`"./effects/login.js"`**
    - **`"./src/effects/login.js"`**
    - **`"./*": "./dist/*"`**

- **C. Масштабируемый шаблон exports для всех пакетов**
  - **Базовый шаблон (минимальный пакет)**:
    - Только индекс:
      - `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`.
  - **Пакет с подпакетами (core/domains/feature/ui)**:
    - Явно перечисляем только стабильные публичные subpath‑API:
      - Доменные модули (`"./classification"`, `"./classification/signals"`, `"./domain-kit"`).
      - UI компоненты/экраны (`"./auth/login-form"`, `"./primitives"`, `"./components"`).
      - Технические подпакеты (`"./lib/error-mapping"`, `"./providers/intl-provider"`).
    - Избегаем шаблонов вида `"./*": { ... }` для сохранения контроля над публичной поверхностью.

- **D. TS/Path‑alias и внутренняя структура**
  - Внутри монорепы:
    - Продолжаем использовать path‑alias из корневого `tsconfig.json` (`@livai/*`).
    - Рекомендуемая и обязательная root‑конфигурация для dev:
      - `"moduleResolution": "bundler"` (явно зафиксирована в корневом `tsconfig.json`, чтобы dev и build‑режимы не расходились по резолву модулей),
      - `"paths": { "@livai/*": ["packages/*/src"] }`.
    - Импорты в исходниках всегда пишутся через `.js`‑расширения (`"./effects/login.js"`) при `moduleResolution = bundler/NodeNext` — даже если сам файл `src/effects/login.ts`, TypeScript сопоставит `.js`‑импорт с `.ts`‑файлом в `src`.
  - Потребители пакетов:
    - Всегда импортируют только через package‑name + subpath, без `src` и без расширений:
      - `import { X } from '@livai/core'`;
      - `import { Y } from '@livai/domains/classification'`;
      - `import { LoginForm } from '@livai/ui-features/auth/login-form'`;
      - `import { createLoginEffect } from '@livai/feature-auth/effects/login'`.

- **E. Согласование tsup и tsconfig.build**
  - Для всех пакетов:
    - Лучший pipeline:
      - **`tsc` → types**, **`tsup` → js**.
      - `tsup.config.ts`: `dts: false`.
      - `tsconfig.build.json`: `emitDeclarationOnly: true`, `declaration: true`, `declarationDir: "dist"`.
    - Таким образом:
      - **TS всегда работает по `src`**, генерирует только `.d.ts` в `dist`.
      - **Node и bundlers всегда работают по `dist`.**
  - Выбрать **один** источник истины для `.d.ts` (рекомендуемо: `tsc`), убрать параллельную генерацию типов из `tsup`.

- **F. Node/Vite/Vitest совместимость**
  - **Node**:
    - Использует `exports.import` + `type: "module"` → загружает `dist/*.js` (`dist/esm/*.js` в текущей схеме).
  - **Vite/Vitest**:
    - Резолвит пакеты через `exports.import`, обрабатывает ESM, treeshaking и sourcemap по `dist`.
    - Для dev‑режима важно дублировать TS‑paths через Vite‑алиасы:
      - либо использовать `vite-tsconfig-paths`,
      - либо явно прописать `resolve.alias` на monorepo‑пакеты, например:
        - `"@livai": path.resolve(__dirname, "../../packages")`.
    - Vitest должен использовать Vite‑резолвер и условия ESM:
      - в `vitest.config.ts` важно убедиться, что `test.deps.registerNodeLoader`/`resolve` не ломают ESM‑resolution,
      - в `resolve.conditions` желательно явно указывать `["import", "module", "default"]`, чтобы использовались `exports.import/default`.
  - **TypeScript**:
    - Берет типы с `types` на корне и `exports[*].types` по подпутям; корневой `tsconfig.json` через path‑alias позволяет работать с исходниками без публикации.
  - При схеме `exports → dist`, `types → dist`, импорты без расширений у потребителей корректно работают:
    - в **Node.js, Vite, Vitest, Webpack, Turbopack, Rollup, esbuild**.

- **G. Жесткие правила для масштабирования**
  - **1 пакет = 1 корневой индекс + конечный список subpath‑exports** (без wildcard‑шаблонов).
  - В `exports` **запрещено**:
    - указывать `src` в путях,
    - указывать `.ts/.tsx` в ключах,
    - смешивать стили ключей (`"./foo"` и `"./foo.js"` в одном пакете).
  - Все новые пакеты обязаны:
    - иметь `tsconfig.json`/`tsconfig.build.json`/`tsup.config.ts`, соответствующие единому шаблону,
    - заполнять `exports` только путями в `dist`.
  - Рекомендуется:
    - Ввести единый шаблон пакета (`templates/package/`) с предзаполненными `package.json`, `tsconfig*.json`, `tsup.config.ts`, чтобы все новые пакеты были одинаковыми.
    - Для библиотечных пакетов **обязательно** указывать `"sideEffects": false` для максимального tree shaking (Turbopack/Webpack/Vite и т.п.).
    - Экспортировать только стабильные публичные API:
      - `@livai/domains`, `@livai/domains/classification`, `@livai/feature-auth/effects/login`.
      - Не экспортировать внутренние поверхности (`*/internal`, `*/__internal`) и не плодить "глубокие" API вроде `@livai/core/internal/logger`.
    - Жёстко зафиксировать финальную production‑архитектуру и предусмотреть миграцию:
      - `packages/*/src/*`, `packages/*/dist/*`, `packages/*/package.json`, `packages/*/tsconfig.json`, `packages/*/tsconfig.build.json`, `packages/*/tsup.config.ts`.
      - Импорты в коде: `@livai/core`, `@livai/domains/classification`, `@livai/feature-auth/effects/login`.
      - `exports` в `package.json`: только в `dist`, без `src` и без `.js` в ключах; при переводе legacy‑пакетов с `exports → src` и ключей с `.js`/`src/` нужно считать изменения потенциально `breaking` даже для потребителей внутри монорепы и планировать поэтапную миграцию (дублирующие subpath‑exports, депрекация старых путей, обновление импорта во всех пакетах).

## Контроль инвариантов exports

- **Проверка через скрипт (`scripts/check-exports.js`)**
  - Расширить текущий скрипт до явных проверок:
    - **Проверка 1** — `exports` указывают только в `dist` (нет ссылок в `src`).
    - **Проверка 2** — ключи subpath‑exports не содержат `.js`, только логические подпути.
    - **Проверка 3** — нет wildcard‑шаблонов `"./*": "./dist/*"`.
    - **Проверка 4** — все `import`/`default` пути из `exports` реально существуют в `dist`.
    - **Проверка 5** — все `types` пути реально существуют и согласованы по структуре с `import`.
  - Включить этот скрипт в CI как обязательный шаг, чтобы никто не мог незаметно сломать контракт exports.

## Architecture invariants

1. **`exports` всегда указывают только на `dist`** — никаких ссылок на `src` в `exports`; runtime (Node/Vite/Vitest/bundlers) всегда работает по собранным артефактам.
2. **`src` никогда не экспортируется наружу** — публичный API всегда берётся из `dist`, при этом главным API каждого пакета считается `src/index.ts`, а subpath‑exports допускаются только для реально публичных модулей (например, `@livai/core/signals`, но не `@livai/core/internal/logger`).
3. **Ключи subpath‑exports не содержат расширений** — только логические подпути (`"./feature-x/y"`), без `.js`/`.ts` в ключах.
4. **Wildcard‑exports запрещены** — нельзя использовать конструкции вроде `"./*": "./dist/*"`, каждый публичный subpath прописывается явно.
5. **Каждый subpath‑export обязан иметь `types`** — для любого ключа `"./foo/bar"` в `exports` должно быть поле `"types"` с путём в `dist`, иначе TypeScript ломает типы при импорте subpath‑модулей.
6. **Поля `main` и `module` в целевых пакетах не используются** — библиотечный `package.json` должен содержать только `type`, `types` и `exports`; при наличии `exports` поля `main`/`module` считаются запрещёнными, чтобы избежать расхождений резолва.
7. **`dist/esm` не используется в целевой архитектуре** — структура `dist/esm`/`dist/cjs` допустима только при реальной поддержке двух форматов; для текущих pure‑ESM пакетов таргет — плоский `dist/*`.
8. **`sideEffects` всегда объявлены для библиотечных пакетов** — по умолчанию `"sideEffects": false`; если есть реальные сайд‑эффекты, они перечисляются точечными путями (например, `["./polyfill.js"]`) для лучшего tree‑shaking в Webpack/Vite/Turbopack.
9. **Internal API никогда не экспортируется** — внутренние модули хранятся под `src/internal/**` (или аналогичными путями) и не фигурируют в `exports`; публичное пространство имён ограничено корнем (`@livai/pkg`) и явно выбранными subpath‑API.
10. **Импорты между пакетами идут только через имя пакета** — разрешены только `@livai/<package>` и `@livai/<package>/<public-subpath>`; запрещены любые импорты `@livai/*/src/*`, `../../<package>/src/*`, `../../<package>/dist/*`.

## Golden templates (library packages)

- **Golden `package.json` (library package)**

```json
{
  "name": "@livai/package-name",
  "version": "0.0.0",
  "private": true,

  "type": "module",

  "sideEffects": false,

  "types": "./dist/index.d.ts",

  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
    /*
    Example subpath exports:

    "./effects/login": {
      "types": "./dist/effects/login.d.ts",
      "import": "./dist/effects/login.js",
      "default": "./dist/effects/login.js"
    },

    "./effects/logout": {
      "types": "./dist/effects/logout.d.ts",
      "import": "./dist/effects/logout.js",
      "default": "./dist/effects/logout.js"
    }
    */
  },

  "files": [
    "dist"
  ],

  "scripts": {
    "build": "pnpm run build:types && pnpm run build:js",
    "build:types": "tsc -p tsconfig.build.json",
    "build:js": "tsup"
  }
}
```

- **Golden `tsconfig.build.json` (types only via `tsc`)**

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

- **Golden `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: true,
});
```

- **Golden структура пакета**

- `packages/feature-auth/`
  - `src/`
    - `index.ts`
    - `effects/`
      - `login.ts`
      - `logout.ts`
  - `dist/`
    - `index.js`
    - `index.d.ts`
    - `effects/`
      - `login.js`
      - `login.d.ts`
      - `logout.js`
      - `logout.d.ts`
  - `package.json`
  - `tsconfig.json`
  - `tsconfig.build.json`
  - `tsup.config.ts`

- **Golden imports внутри `src` (всегда с `.js`)**

```ts
import { createLoginEffect } from './effects/login.js';
```

- **Golden imports между пакетами (только через API пакета)**

```ts
import { AuthState } from '@livai/feature-auth';
import { createLoginEffect } from '@livai/feature-auth/effects/login';
```

- **Golden root `tsconfig.json`**

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

- **Важно про paths vs runtime**
  - TS `paths` используются только для dev/compile‑time (`@livai/*` → `packages/*/src`).
  - Runtime (Node/Vite/Vitest) всегда использует `exports` из `package.json`, никогда `paths`.
