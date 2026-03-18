## Refactor Plan: State/Store (Final, Execution-Only)

Легенда: 🟢 реализовано, 🟡 рефакторинг, ⚪ реализовать

### Runtime contracts (обязательные)

```ts
// каждый store обязан иметь
type StoreMeta = {
  readonly version: number;
};

type WithMeta<T> = T & StoreMeta;

// каждый store обязан экспортировать
export type PublicStore<TActions, TSelectors> = {
  actions: TActions;
  selectors: TSelectors;
};

// store creation contract (replaceable, SSR-safe через factory)
export type CreateStore<TState, TActions, TSelectors> = () => {
  useStore: <R>(selector: (s: WithMeta<TState>) => R) => R;
  actions: TActions;
  selectors: TSelectors;
};
```

- SSR/test contract: `useStore` обязан быть в selector-форме (`<R>(selector: (s: WithMeta<TState>) => R) => R`), прямое чтение всего state запрещено.

---

### Общие инварианты (глобально)

- ❌ feature → feature imports
- ❌ core знает про runtime (`zustand`)
- ❌ дубли util-кода
- ❌ app читает store internals
- ✅ единый `OperationState`
- ✅ persist merge через `mergePreservingActions`
- ✅ каждый store state = `WithMeta<XState>` (meta включён реально, не “на словах”)
- ✅ selectors: pure (не мутируют state) и без вызова actions
- ✅ store lifecycle: SSR-safe factory; singleton только в `app` (UI meta)
- ✅ app не экспортирует сырые state-типы store (только через `PublicStore`/`public.ts`)
- ✅ `OperationState` экспортируется только из `core/state-kit` (без алиасов в feature)

**ESLint (обязательные правила)**

- 🟢 Запрет мутаций state вне actions:
  - 🟢 `no-param-reassign` для аргумента `state` в store-updaters
  - 🟢 custom rule (AST): запрет прямой мутации `state.*` (assignment/update/delete + mutating methods)
- 🟢 Selectors не вызывают actions:
  - 🟢 custom rule (AST): в функциях `selectX()` и файлах `selectors` запрещены вызовы `actions.*` / `*.actions.*`

---

### Checkpoint 1 — Guardrails (core/state-kit)

**Dependency direction rule (жёстко)**

- 🟢 foundation (core, contracts, domains) → (никто)
- 🟢 aiExecution (feature-*) → foundation
- 🟢 ui (ui-*) → foundation + aiExecution
- 🟢 apps (`packages/app`, `apps/*`) → foundation + aiExecution + ui

**Import boundaries (конкретика)**

- ⚪ разрешены только:
  - `@livai/core/*`
  - `@livai/feature-*/public` (если появится API слой)

**Запрещено**

- `zustand` / любой runtime
- persist config / migrations / autoMigrate
- invariants / rule-engine
- transaction API
- domain types (Auth/Bot/etc)

**Разрешено**

- operation primitives
- persist low-level helpers
- updater helpers
- version compare/assert

**Действия**

- 🟢 добавить/усилить ESLint / checks:
  - 🟢 custom rule: запрет `zustand` и других store-runtime в `packages/core/src/state-kit/**`
  - 🟢 custom rule: запрет feature→feature импортов (разрешены только `@livai/core/*` и `@livai/feature-*/public`)

**CI check (реальный)**

- ESLint (AST) rules:
  - 🟢 `no-restricted-imports` для `zustand` в `packages/core/src/state-kit/**`
  - 🟢 `no-restricted-imports` для `@livai/feature-*` из других feature-пакетов (разрешён только `@livai/feature-*/public`)

- Graph checks (CI scripts):
  - 🟢 `pnpm run check:circular-deps` (циклы внутри и между пакетами)
  - 🟢 `pnpm run check:exports` (public API/exports invariants)

**DoD**

- 🟢 CI падает при нарушении (enforce через ESLint + граф-проверки)
- 🟢 `core/state-kit` полностью framework-agnostic (без зависимостей от React/Zustand/Next/runtime)

---

### Checkpoint 2 — Создание core/state-kit

**Файлы**

`persist.ts`

- 🟢 `mergePreservingActions<T extends { actions: unknown }>(persisted: unknown, current: T): T`
- 🟢 `createNoopStorage()`

**Правила**

- 🟢 `mergePreservingActions<T extends { actions: unknown }>(persisted: unknown, current: T): T`
- 🟢 если `typeof persisted !== 'object' || persisted === null` или объект с некорректным прототипом → вернуть `current`
- 🟢 invalid persisted (нет нужных ключей / типы не совпали) → вернуть `current`
- 🟢 `persisted.actions` всегда игнорируется, берём только `current.actions`
- 🟢 только shallow merge (верхний уровень), deep merge удалён
- 🟢 без validate/migrate

- 🟢 `createNoopStorage()` — SSR-safe storage:
  - `getItem` всегда возвращает `null`
  - `setItem` / `removeItem` — no-op

`operation.ts`

```ts
type OperationStatus = 'idle' | 'loading' | 'success' | 'error';

type OperationState<T, Op extends string, E> =
  | { status: 'idle'; }
  | { status: 'loading'; operation: Op; }
  | { status: 'success'; data: T; }
  | { status: 'error'; error: E; };
```

- constructors (строгие сигнатуры):
  - 🟢 `idle<T, Op extends string, E>(): OperationState<T, Op, E>`
  - 🟢 `loading<Op extends string>(op: Op)`
  - 🟢 `success<T>(data: T)`
  - 🟢 `failure<E>(error: E)` (error-конструктор)
- 🟢 type guards (`isIdle` / `isLoading` / `isSuccess` / `isError`)
- 🟢 reset helper:
  - `reset(): OperationState<unknown, string, unknown>` возвращает строго `{ status: 'idle' }` через factory `idle()`

- NonEmptyString тип удалить; использовать `string` + runtime-assert в месте вызова

**Запрещено**

- reducer / dispatch / middleware

`updater.ts`

- 🟢 `applyUpdater<T>(state: T, updater: (s: T) => T): T`

**Правило**

- 🟢 updater обязан быть pure (не мутировать `state`), enforce через ESLint (`no-param-reassign`)
- 🟢 `applyUpdater<T>` обязан:
  - вычислять `const next = updater(state)`
  - если `next === state`, возвращать исходный `state` (оптимизация и гарантия referential equality)

`version.ts`

- 🟢 `compareVersion(a: number, b: number): -1 | 0 | 1`
- 🟢 `assertVersionEqual(a: number, b: number)`
- 🟢 `isVersionMismatch(a: number, b: number): boolean`

**Правила**

- 🟢 только `number`-версии, строковые/semver в `state-kit` запрещены
- 🟢 `compareVersion(a: number, b: number): -1 | 0 | 1`
- 🟢 `assertVersionEqual(a: number, b: number)`:
  - в dev (`NODE_ENV !== 'production'`) бросает error при несовпадении
  - в prod — может быть no-op/лог

**Запрещено**

- migrate

`export`

- 🟢 `export * from './state-kit'`

**Files**

- 🟢 `packages/core/src/state-kit/persist.ts` — ts — deps: none — low-level persist helpers (`mergePreservingActions`, `createNoopStorage`)
- 🟢 `packages/core/src/state-kit/operation.ts` — ts — deps: none — `OperationState` union + helpers
- 🟢 `packages/core/src/state-kit/updater.ts` — ts — deps: none — pure updater helper
- 🟢 `packages/core/src/state-kit/version.ts` — ts — deps: none — version compare/assert helpers
- 🟢 `packages/core/src/state-kit/index.ts` — ts — deps: state-kit/* — re-export public API; единственная точка экспорта (`@livai/core/state-kit`), deep-imports (`@livai/core/state-kit/operation` и т.п.) запрещены через `package.json` exports + ESLint (`import/no-internal-modules`)
- 🟢 `packages/core/src/index.ts` — ts — deps: state-kit/index — подключение `state-kit` в core API

**DoD**

- 🟡 нет deep-imports
- 🟢 нет runtime зависимостей
- 🟢 API минимальный и чистый

---

### Checkpoint 3 — Refactor feature-bots

**Действия**
3.0 🟢 Добавить `OperationKey`:

```ts
type OperationKey =
  | 'create'
  | 'update'
  | 'delete';
```

3.1 🟢 Удалить:

- 🟢 `Object.freeze`
- 🟢 `toIdle` / `toLoading`
- 🟢 `IDLE` singleton

> Примечание: допускается `Object.freeze` для dev-only guardrails (например, защитить store от случайных мутаций входных объектов),
> но `freeze` не используется как “модель данных” store (нет заморозки initial state / singleton’ов ради архитектуры).

3.2 🟢 Заменить OperationState:

- 🟢 legacy `BotOperationState` → `OperationState<T, OperationKey, BotError>` (перейти на `core/state-kit/operation`)

3.3 🟢 Зафиксировать структуру state и типы entities/operations (без `unknown`):

```ts
type BotId = ID<'Bot'>;

type BotsState = {
  entities: Readonly<Record<BotId, BotInfo>>;
  operations: Readonly<BotsOperations>;
};

type BotsOperations = {
  [K in OperationKey]: OperationState<
    K extends 'create' ? BotInfo
      : K extends 'update' ? BotInfo
      : K extends 'delete' ? void
      : never,
    K,
    BotError
  >;
};
```

3.4 🟢 Унифицировать операции:

- `idle()`
- `loading(op)`
- `success(data)`
- `failure(err)`

3.5 🟢 Убрать boilerplate (типобезопасно связать key/value):

```ts
const setOperation = <K extends keyof BotsOperations>(
  key: K,
  value: BotsOperations[K],
) =>
(state: BotsState): BotsState => ({
  ...state,
  operations: {
    ...state.operations,
    [key]: value,
  },
});
```

- `OperationKey` — единственный source of truth для ключей `BotsOperations`; маппинг обязан использовать `OperationKey`, без дублирующих string-литералов.
- `setOperation` выносится в shared helper внутри `feature-bots` (например, `src/stores/helpers/operations.ts`), локальные operation-helpers в `bots.ts` запрещены.

3.6 🟡 ESLint:

- custom rule: запрет inline `set({})` с autofix, где возможно (оборачивать в updater `state => ({ ...state, ... })`)

3.7 🟢 Запрет inline `set`:

- 🟢 ❌ нельзя: `set({ ... })`
- 🟢 ✅ только: `set(setOperation(...))`

**Files**

- 🟢 `packages/feature-bots/src/stores/bots.ts` — ts — deps: zustand, types/bots — store runtime: операции вынесены в `state.operations`, без freeze, без локальных helpers
- 🟢 `packages/feature-bots/src/types/bots.ts` — ts — deps: core(state-kit types) — `OperationKey`, `BotsState/BotsOperations`, `OperationState` (без локальных дублей)

**DoD**

- 🟢 нет локальных operation helpers
- 🟢 нет freeze
- 🟢 нет дублирования `setState` логики
- 🟢 все operations лежат в `state.operations`
- 🟢 нет операций вне `state.operations`

---

### Checkpoint 4 — Refactor app/store

**Действия**
4.1 🟢 Strict persist contract:

```ts
type PersistedAppState = Pick<
  AppStoreState,
  'theme' | 'version'
>;
```

4.2 🟢 Merge:

```ts
merge: ((persisted, current) => {
  return mergePreservingActions(persisted, current);
});
```

4.3 🟢 Persist policy (уже частично есть через `partialize`, нужно уточнить контракт):

```ts
// ❗ only stable serializable fields
partialize(...)
```

- partialize обязан выбрасывать:
  - функции, промисы и другие non-serializable поля
  - ephemeral-состояние, которое нельзя безопасно восстановить

4.4 🟡 Запрет:

- 🟡 ❌ нельзя читать `store.getState()` вне actions/effects (сейчас есть `useAppStore.getState()` в infra)
  - 🟢 ESLint rule: запрет `useAppStore.getState()` в `packages/app/src/**`, кроме whitelist-мест внутри `packages/app/src/state/store.ts`

**Files**

- 🟡 `packages/app/src/state/store.ts` — ts — deps: zustand, core(state-kit/persist) — app UI meta store (persist contract + mergePreservingActions)

**DoD**

- 🟢 merge не replace (используется `mergePreservingActions`)
- 🟢 partialize документирован

---

### Checkpoint 5 — Refactor feature-auth (минимальный)

**Явно зафиксировать**

- ⚪ auth — единственный complex store (guardrail, enforce через ESLint/архитектурные зоны)

**Guard**

- ⚪ ❌ запрещено копировать `transaction` и invariant engine в другие feature (нужно enforce rules/checklist)
  - ESLint / архитектурное правило:
    - запрет импортов `transaction` и invariant engine вне `feature-auth`
    - запрет копипасты по сигнатурам (например, `beginTransaction`, `commitTransaction`) через custom rule / codemod-check

**НЕ ТРОГАТЬ**

- 🟢 invariants
- 🟢 transaction
- 🟢 validation
- 🟢 persist logic

**Переиспользовать (опционально)**

- ⚪ `createNoopStorage` (из `core/state-kit/persist`) — только если замена не меняет поведение persist
- ⚪ `mergePreservingActions` (из `core/state-kit/persist`) — только если замена не меняет поведение merge (guardrail: снапшот-тест на persist)

**Files**

- 🟢 `packages/feature-auth/src/stores/auth.ts` — ts — deps: zustand — complex auth store (persist + invariants)

**DoD**

- 🟡 нет изменения поведения (если трогаем — только swap storage/merge helpers)
- 🟡 нет обобщения auth

---

### Checkpoint 6 — Cleanup imports

**Действия**

- ⚪ заменить все util → `@livai/core/state-kit`
- 🟡 убрать deep imports (частично уже есть генераторы restricted imports)
  - все вызовы helper-ов для operation/persist/updater/version должны идти из `@livai/core/state-kit`
  - прямые импорты из `packages/core/src/state-kit/*` запрещены (enforce через `import/no-internal-modules`)

➕ ESLint:

- `no-restricted-imports`: запрет относительных импортов выше модуля (`../..`, `../../..` и глубже) во всех `packages/**/src/**`

➕ Проверка:

- dependency-cruiser: правило “no parent relative imports” (`..` выше корня пакета)
- ESLint: `import/no-internal-modules` для запрета deep-imports из `core/state-kit/*`

**Files**

- `packages/core/src/index.ts` — ts — deps: state-kit/index — проверка и фиксация публичного API
- `packages/**/src/**/*` — ts/tsx — deps: `@livai/core/state-kit` — массовая замена util-импортов

**DoD**

- ⚪ единая точка импорта
- 🟡 нет относительных путей в core (частично через ESLint rules/генераторы)

---

### Checkpoint 7 — Future (chat)

**Требования**

- ⚪ operation → только через state-kit:
  - запрещены локальные enum/union для OperationState
  - OperationState импортируется только из `@livai/core/state-kit`
- ⚪ store чистый
- ⚪ effects через ports/adapter: side-effects (HTTP/WebSocket и т.п.) вынесены в `ports`/`adapter`, store содержит только sync transitions над state

**Async модель**

- ❗ store не делает async (async только в effects)
- ❌ нельзя: `async action() {}`
  - ESLint custom rule: запрет `async` методов/arrow-функций в store:
    - `MethodDefinition[async=true]` и `VariableDeclarator > ArrowFunctionExpression[async=true]` в `src/stores/**`

**Files**

- `packages/feature-chat/src/stores/chat.ts` — ts — deps: zustand, `@livai/core/state-kit`, types/chat — chat store (state + sync transitions)

**DoD**

- ⚪ нет feature зависимостей
- ⚪ соблюдён tier (medium)

---

### Checkpoint 8 — CI Guardrails

**Проверки**

- 🟡 `zustand` в core → FAIL (частично через архитектурные правила, без точного check)
- ⚪ `transaction(` в core → FAIL
- ⚪ `createPersistConfig` → FAIL
- 🟡 feature→feature import → FAIL (частично через zones)
- ⚪ no async in store → FAIL
- ⚪ no direct `set({` usage → FAIL

**Усиление (вместо хрупких grep)**

ESLint (AST) правила:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.name='set'] > ObjectExpression",
        "message": "Use updater function instead of inline set"
      },
      {
        "selector": "MethodDefinition[async=true], ArrowFunctionExpression[async=true]",
        "message": "Store actions must be synchronous"
      }
    ],
    "no-param-reassign": "error"
  }
}
```

Архитектурное правило:

- store actions must be synchronous and return `void`

**Files**

- `package.json` / CI config — js/yml — deps: eslint — добавление guardrail-скриптов и правил

**DoD**

- 🟡 guardrails автоматизированы (частично через ESLint zones)
- ⚪ PR checklist соблюдается (нужно добавить checklist/правила и сделать обязательным template с чеклистом guardrails)

---

### Финальный результат (архитектурно)

Модель:

- `core/state-kit` → primitives (0 logic leakage)
- `feature-*` → store + domain rules
- `app` → orchestration only

И самое важное:

- нет "shared store runtime"
- есть единый язык состояния

---

### Что ещё можно улучшить (опционально)

1. Строгий naming contract: `createXStore()`, `useXStore()`, `selectX()`
   - ESLint rule: `id-match` / custom regex для имён фабрик/хуков/селекторов
2. Store API слой (UI не знает про zustand напрямую)
   - UI импортирует только `PublicStore`/`public.ts`
   - запрещены импорты `zustand` в `packages/app/src/**` (enforce через `no-restricted-imports`)
3. Snapshot testing для store
   - snapshot initial state
   - snapshot основных transitions (actions → new state)
   - гарантия, что persist/merge/operation-конструкторы не меняют контракт

---

### Store Contract (обязательный шаблон)

```ts
export type XState = {/* ... */};

export type XActions = {/* ... */};

export type XSelectors = {/* ... */};

export type XStore = {
  state: WithMeta<XState>;
  actions: XActions;
  selectors: XSelectors;
};
```

- runtime-hook: `useXStore<R>(selector: (s: WithMeta<XState>) => R): R` (selector-based API, без прямого `getState()`)

Selector isolation (обязательное правило)

- selectors НЕ могут мутировать state
- selectors НЕ могут вызывать actions
  - ESLint: selector-функции помечаются именованием `selectX`, для них включается отдельное правило `CallExpression[callee.object.name='actions']` → error

Dev invariants (опционально, dev-only)

- `if (process.env.NODE_ENV !== 'production') Object.freeze(state);`
