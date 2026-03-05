## Roadmap: Унификация exports/types и dist‑pipeline

### Цель

- Все runtime (Node/Vite/Vitest/bundlers) работают только по `dist/*`.
- TypeScript читает типы только из `dist/*`.
- `src/*` — строго внутренний, не экспортируется.
- Монорепа масштабируется без хаотичных путей и конфликтов.

### Этап 1: Корневой TS/ESM контракт

- **Задачи**
  - Зафиксировать корневой `tsconfig.json`:
    - `"module": "ES2022"`,
    - `"moduleResolution": "bundler"`,
    - `"target": "ES2024"`,
    - `"paths": { "@livai/*": ["packages/*/src"] }`.
  - Проверить dev‑`tsconfig.json` пакетов:
    - нет локальных переопределений `moduleResolution`, только в `tsconfig.build.json`.
- **Checkpoint**
  - `npx tsc --noEmit` или `pnpm run type-check:local` проходит без ошибок.
  - ✅ Выполнено: `pnpm run type-check:local` (tsc --noEmit) прошёл без ошибок.

### Этап 2: Golden build‑pipeline

- **Задачи**
  - Привести все `tsconfig.build.json` библиотек к шаблону:
    - `extends: "./tsconfig.json"`,
    - `"outDir": "./dist"`,
    - `"declaration": true`,
    - `"emitDeclarationOnly": true`,
    - `"declarationMap": true`,
    - `"include": ["src"]`.
  - Привести `tsup.config.ts` к Golden‑шаблону:
    - `entry: ['src/index.ts']`,
    - `format: ['esm']`,
    - `target: 'es2024'`,
    - `dts: false`,
    - `sourcemap: true`,
    - `clean: true`,
    - `outDir: 'dist'`.
  - Убрать генерацию `.d.ts` из `tsup` (tsup больше не отвечает за типы) — **все типы генерируются через `tsconfig.build.json`**.
  - В `package.json` и CI‑скриптах зафиксировать порядок `build:types` → `build:js` (особенно в проверках), чтобы избежать временных ошибок резолва типов.
- **Checkpoint**
  - JS и `.d.ts` собираются только в `dist/*`, без `dist/esm`.
  - ✅ Выполнено: `pnpm run build:types` ✅, `pnpm run build:js` ✅; выходные артефакты в `packages/*/dist/*`, legacy `packages/*/dist/esm` удалён (не генерируется повторно).

### Этап 3: Golden package.json и sideEffects

- **Задачи**
  - Привести `package.json` библиотек к шаблону:
    - `"type": "module"`, `"sideEffects": false`,
    - `"types": "./dist/index.d.ts"`,
    - `"exports"` для корня:
      - `".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "default": "./dist/index.js" }`,
    - удалить `"main"` и `"module"`.
  - Уточнить `"files": ["dist"]`.
  - Явно указать реальные сайд‑эффекты, если есть (`"sideEffects": ["./polyfill.js"]` и т.п.).
- **Checkpoint**
  - `pnpm run check:exports` не выявляет `main/module` и лишних путей вне `dist`.
  - ✅ Выполнено: для всех библиотек `main/module` удалены, корневой `"types"` и `exports["."]` указывают на `./dist/index.(d.)ts/js`, `"files": ["dist"]`; `pnpm run check:exports` проходит без ошибок.

### Этап 4: Нормализация dist

- **Задачи**
  - Изменить все `tsup.config.ts` с `outDir: 'dist/esm'` → `outDir: 'dist'`.
  - Удалить старые каталоги `dist/esm`.
  - Проверить, что `exports` и `types` указывают только на `dist/*`.
- **Checkpoint**
  - `pnpm run build:js`/`build:types` не создают `dist/esm`.
  - ✅ Выполнено: все `tsup.config.ts` используют `outDir: 'dist'`, legacy‑каталоги `packages/*/dist/esm` удалены; повторные `pnpm run build:types && pnpm run build:js` не создают `dist/esm`, артефакты лежат только в `packages/*/dist/*`.

### Этап 5: Миграция exports: src → dist

- **Задачи**
  - Перевести все текущие `exports` с `src` → `dist` без изменения ключей (для совместимости).
  - Legacy‑ключи в `exports` (старые варианты) **оставляем до финальной очистки на этапе 9**, чтобы не ломать зависимости при миграции импортов.
  - Добавить новые логические subpaths (без `.js` и `src`), например:
    - `"./effects/login": { "types": "./dist/effects/login.d.ts", "import": "./dist/effects/login.js", "default": "./dist/effects/login.js" }`.
  - Следить, чтобы новые subpaths соответствовали текущей файловой структуре `src/*`, чтобы избежать рассинхронизации между API и реальными модулями.
  - Проверить, что каждый subpath имеет поле `types`.
- **Checkpoint**
  - `pnpm run check:exports` (строгая проверка `dist`) — нет ссылок на `src`, все subpaths имеют `types`.
  - ✅ Выполнено (базовый шаг): корневые `exports["."]` всех библиотек уже указывают на `./dist/index.(d.)ts/js`, для основных subpaths с готовыми JS‑артефактами (`@livai/core`, `@livai/domains`, `@livai/core-contracts`, `@livai/app` lib/_, `@livai/ui-features` auth/_) значения `types/import/default` переведены с `src` → `dist`; устаревшие `src/*`‑ключи в `@livai/feature-auth` и wildcard‑паттерны остаются как legacy до этапов 7–9, когда будет усилен `check-exports` и удалены старые контракты.

### Этап 6: Рефакторинг внутренних импортов ✅ Выполнено

- **Задачи**
  - ✅ Запретить импорты вида `@livai/*/src/*` и `../../*/src/*`:
    - заменить на `@livai/package` или `@livai/package/subpath`.
  - ✅ Запретить импорты `dist` внутрь `src`:
    - заменить на локальные `./module.js`/`../domain/service.js` или публичные `@livai/*` subpaths.
  - ✅ Зафиксировать `.js` в импортах внутри `src`:
    - `from './foo'` → `from './foo.js'`.
  - ✅ Настроить `eslint-plugin-import` (правило `no-restricted-imports`), чтобы запретить импорты `src/*` и `dist/*` внутри `src`.
  - ✅ Разорвать циклические зависимости: перенести effect-утилиты из `@livai/app/lib/*` в `@livai/core/effect`, обновить импорты в `feature-auth` и `app`.
- **Checkpoint**
  - ✅ `pnpm run type-check && pnpm run tsc:check` проходят без ошибок резолва.
  - ✅ Все импорты мигрированы на новые пути (`@livai/core/effect`, `@livai/app`, `@livai/feature-auth`).
  - ✅ Циклические зависимости устранены (`app → feature-auth → app`).

### Этап 7: Ужесточение check-exports и CI

- **Задачи**
  - Обновить `scripts/check-exports.js`:
    - только `dist`,
    - ключи без `.js`,
    - нет `src`,
    - каждый subpath имеет `types`,
    - нет wildcard `"./*": "./dist/*"`,
    - проверка существования файлов (`import`/`default`/`types`).
  - Включить `check:exports` в CI.
- **Checkpoint**
  - Любое нарушение контрактов → падение CI.
  - ✅ Выполнено: `scripts/check-exports.js` обновлен с проверками для новых экспортов (legacy-ключи разрешены до этапа 9), `check:exports` добавлен в CI workflow.

### Этап 8: Dev/Runtime resolution

- **Задачи**
  - Убедиться, что dev‑резолвер (`tsconfig.json`) с `moduleResolution: "bundler"` используется во всех dev‑сценариях.
  - Vite:
    - либо `vite-tsconfig-paths`,
    - либо `alias` `@livai` → `packages/*/src`.
  - Vitest:
    - Vite‑резолвер,
    - `resolve.conditions = ["import","module","default"]`.
- **Checkpoint**
  - `pnpm test` не выдаёт ошибок резолва `@livai/*/src/*`.
  - ✅ Выполнено: `moduleResolution: "bundler"` в `config/tsconfig/base.json`, добавлены алиасы `@livai/*` → `packages/*/src` в Vite и Vitest, `resolve.conditions` обновлен на `["import","module","default"]`.

### Этап 9: Очистка legacy‑exports и финальный lock‑in

- **Задачи**
  - Удалить legacy‑ключи `.js` и `src/` из `exports`.
  - Оставить только логические публичные subpaths.
  - Провести финальную проверку 10 инвариантов `Architecture invariants` для всех библиотек.
  - Обновить `scripts/check-exports.js`: удалить легаси-ключи
- **Checkpoint (финальный)**
  - `pnpm run build && pnpm run type-check && pnpm run test && pnpm run check:exports` проходят,
  - нет `dist/esm`, нет `exports` → `src`, все subpaths имеют `types`.
  - ✅ Выполнено: удалены все legacy-ключи с `.js` и `src/` из exports, обновлен `scripts/check-exports.js` (исключение: wildcard для динамических импортов `./policies/*`), обновлены импорты в коде и тестах. Исправлена генерация `.d.ts` для subpath exports в `@livai/app` через включение `dts: true` в `tsup.config.ts`.

### Рекомендации по чекпоинтам и контролю

- Каждый этап — отдельный PR/коммит с прогоном `check-exports` и `type-check`.
- PR‑ревью должно включать проверку, что **все импорты идут через новые subpaths**, и нет обходных путей через `src/*`.
- Для legacy‑пакетов на этапе 5:
  - сначала добавлять логические subpaths без удаления старых ключей,
  - удалять legacy‑keys только после массовой миграции импортов.
- CI должен блокировать merge при нарушении любого архитектурного инварианта.
- Документировать публичные subpath‑API каждого пакета, чтобы новые импорты шли только через них.
- Для массовой миграции импортов использовать автоматические скрипты поиска/замены с фиксацией `.js` в `src`.
