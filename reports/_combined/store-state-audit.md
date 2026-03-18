## Store/State Refactor — Audit Report

**Дата:** 2026-03-18\
**Статус:** ✅ Базовые контракты и guardrails внедрены

---

## 📊 Итог по направлениям

Легенда: ✅ — выполнено (enforced), ⚪ — optional/процесс (не влияет на runtime).

| Area          | Статус | Guarantee                                                           |
| ------------- | -----: | ------------------------------------------------------------------- |
| State-kit     |     ✅ | Framework-agnostic primitives (operation/persist/updater/version)   |
| Persist (app) |     ✅ | `version` + `PersistedAppState`, merge via `mergePreservingActions` |
| Store runtime |     ✅ | Sync-only actions; no `set({})`; no async in store                  |
| Imports       |     ✅ | No state-kit deep-imports; no `../..` in `packages/**/src/**`       |
| Guardrails    |     ✅ | ESLint/zones: CI fails on boundary/mutation violations              |
| Checklist     |     ⚪ | PR template/checklist (process-only)                                |

---

## 🧭 Architecture at a glance

```text
core/state-kit (public API; no runtime)
  ↓
feature-* stores: entities + operations (OperationKey + OperationState; sync-only)
  ↓  (ESLint/zones enforce)
app store: persist contract (PersistedAppState+version; mergePreservingActions; safe accessors)
  ↓
UI: selector-only reads (SSR-safe)
```

---

## ✅ Выполненные работы (факты)

### 1. `core/state-kit` — primitives без runtime

**Результат:**

- `OperationState` + constructors/type-guards: `packages/core/src/state-kit/operation.ts`
- Persist helpers: `mergePreservingActions`, `createNoopStorage`: `packages/core/src/state-kit/persist.ts`
- Pure updater helper: `applyUpdater` (referential equality): `packages/core/src/state-kit/updater.ts`
- Version helpers: `packages/core/src/state-kit/version.ts`
- Публичный API: `@livai/core` и `@livai/core/state-kit` (deep-imports запрещены guardrails)

### 2. `app` store — строгий persist-контракт + safe accessors

**Результат:**

- `version` + `PersistedAppState` (partialize contract): `packages/app/src/state/store.ts`
- `merge` через `mergePreservingActions`: `packages/app/src/state/store.ts`
- Public helpers: `getAppStoreActions/getAppStoreState/setAppStoreState` (и запрет raw `useAppStore.getState()` вне `store.ts`)
- `store-utils`: `safeSet` (queue), lock guardrail, dev-only visibility/contracts: `packages/app/src/state/store-utils.ts`
- `reset`: soft/full policy + dev visibility + явный контракт lock boundary: `packages/app/src/state/reset.ts`

### 3. `feature-bots` — entities+operations и helper `setOperation`

**Результат:**

- `OperationKey` — single source of truth; `BotsState = { entities, operations }`: `packages/feature-bots/src/types/bots.ts`
- Store transitions используют state-kit constructors: `idle/loading/success/failure`: `packages/feature-bots/src/stores/bots.ts`
- Shared helper `setOperation`: `packages/feature-bots/src/stores/helpers/operations.ts`

### 4. Guardrails — ESLint + зоны + hygiene rules

**Enforce:**

- Запрет мутаций state вне actions; selectors не вызывают actions (custom AST rules)
- Запрет `set({ ... })` и запрет async в store (AST rules)
- SSR-safe / selector-only контракт: store читается через selector API, без “прочитать весь state” вне store boundary
- Запрет `useAppStore.getState()` вне `packages/app/src/state/store.ts`
- Запрет `zustand` в `packages/core/src/**`
- Запрет deep-imports в state-kit и запрет `../..` в `packages/**/src/**`
- Запрет выноса invariant engine из `feature-auth` наружу (no-restricted-imports)
- Контракт на будущее: любые новые stores (chat/voice/billing/…) должны соответствовать этим же принципам и автоматически подпадают под те же guardrails (ESLint/zones/hygiene).

**Файл:** `config/eslint/master.config.mjs`

---

## 🔍 Проверки (что реально запускаем)

- `pnpm -w run lint:canary`
- `pnpm -w -F @livai/app type-check`
- `pnpm run check:circular-deps`
- `pnpm run check:exports`

---

## ⚠️ Оставшиеся пункты (optional / future)

### Optional (скорее косметика / процесс)

| Пункт                                                    | Статус | Impact        |
| -------------------------------------------------------- | -----: | ------------- |
| PR checklist / template                                  |     ⚪ | process       |
| Naming contract (`createXStore/useXStore/selectX`)       |     ⚪ | cosmetic      |
| Snapshot tests для store transitions                     |     ⚪ | low           |
| Dev-only invariants (`Object.freeze`)                    |     ⚪ | dev-only      |
| Запрет “копипасты по сигнатурам begin/commitTransaction” |     ⚪ | low (fragile) |

### Future (не в scope)

| Пункт                                                                          | Статус | Impact |
| ------------------------------------------------------------------------------ | -----: | ------ |
| `feature-chat` store: контракт (entities+operations, state-kit, ports/effects) |     ⚪ | future |
