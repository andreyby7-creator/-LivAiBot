1. `packages/feature-bots/src/lib/bot-errors.ts` — Error normalization (слой 2) ✅

   **Что:**
   - добавить экспортируемую фабрику доменной ошибки `createBotErrorFromCode(code, context?, options?: { cause?: unknown })` и (опционально) санитизацию/встраивание `cause` в `context.details`.

   **Интерфейсы/контракты:**
   - опираться на SSOT `botErrorMetaByCode` и доменную `getBotRetryable(code)`;
   - вернуть `BotError` как immutable (`Object.freeze`).

   **Definition of done:**
   - есть единый способ создавать `BotError` по `BotErrorCode`, без ручного конструирования в эффектах.

2. `packages/feature-bots/src/lib/error-mapper.ts` — Error normalization (слой 2) ✅

   **Что:**
   - сделать единые точки нормализации для lifecycle/pipeline: `normalizeBotError(...)` (или эквивалент) и корректная приоритизация входов: `BotError → BotErrorResponse → Error → unknown`.
   - где сейчас риск: текущий маппер принимает `BotErrorResponse | Error | string | UnknownObject`, поэтому `BotError` как вход может попадать в fallback и терять контекст/семантику.

   **Definition of done:**
   - lifecycle всегда может передать “что угодно” и получить канонический `BotError` без дрейфа `retryable/category/severity`.

3. `packages/feature-bots/src/effects/shared/lifecycle/contracts.ts` (новый файл) — Contracts/Types (слой 1) ✅

   **Что:**
   - вынести контрактные типы из дока в код: `IdempotencyKey`, `IdempotencyRecord`, `PolicyMeta`, `ExecutionState` + контракт фаз/инвариантов; также `OperationContext` (`operationId/actorId/traceId/policyMeta/auditMeta/abortSignal`).
   - плюс: интерфейсы портов, которые потребуются pipeline (как минимум `IdempotencyPort`, а также модель для hooks и audit execution semantics).

   **Definition of done:**
   - pipeline/orchestrators опираются на типы из одного места, без “дублирования в документации”.

4. `packages/feature-bots/src/effects/shared/lifecycle/error.ts` (новый файл) — Error normalization (слой 2) ✅

   **Что:**
   - реализовать `withErrorBoundary(ctx, fn)` + helpers для нормализации ошибок.
   - зависимости: `normalizeBotError` (ticket 2) и контракты `IdempotencyPort/OperationContext` (ticket 3).

   **Definition of done:**
   - наружу уходит только нормализованный `BotError`, а финализация `fail(...)/complete(...)` не ломается на вторичных ошибках.

5. `packages/feature-bots/src/effects/shared/lifecycle/pipeline.ts` (новый файл) — Execution (слой 3) ✅

   **Что:**
   - реализовать всю “умную” логику execution-потока:
     - idempotency guard (`new/in_progress/completed/takeover/reconcile?`) →
     - execute core thunk →
     - mappingResult (`ok|err`) →
     - persist (`bounded retry`) →
     - finalize (`complete/fail`) →
     - side-effects (`hooks/audit`)
     - по invariants из дока.
   - зависимости: порты `BotsStorePort`, `BotAuditPort`, `IdempotencyPort`, плюс “strict mapping” (`mappingResult`).

   **Definition of done:**
   - pipeline гарантирует порядок `execute → map → persist → finalized → side-effects` и не позволяет partial persist при `mappingResult.ok=false`.

6. `packages/feature-bots/src/effects/shared/operation-lifecycle.ts` (новый файл) — Orchestration/Glue (слой 4) ✅

   **Что:**
   - тонкий glue-слой: `return withErrorBoundary(ctx, () => executePipeline(ctx, input));` без бизнес-ветвлений и без отдельной нормализации.
   - зависимости: `pipeline.ts` + `error.ts`.
   - миграция с текущего `operation-lifecycle.helper.ts` на `operation-lifecycle.ts`:
     - заменить импорты/реэкспорты в `packages/feature-bots/src/effects/shared/index.ts`;
     - заменить импорт в `packages/feature-bots/src/effects/create/create-bot-effect.types.ts`;
   - удалить `packages/feature-bots/src/effects/shared/operation-lifecycle.helper.ts`;

   **Definition of done:**
   - orchestration для эффектов становится “однострочной композицией”.

**Краткая схема потока (по контракту):**

```text
input → operation-lifecycle → error → pipeline → persist → finalize → side-effects
```

7. `packages/feature-bots/src/effects/create/create-bot.helpers.ts` (новый файл) ✅

   **Что:**
   - pure/helpers для create-like:
     - builders для draft botId для policy context
     - единые функции `buildCreateBotRequestBody`
     - решения permission/policy check (без IO).
   - важно: helpers должны быть domain-deterministic/pure; любые IO/время/ids только в orchestrator или DI.

   **Definition of done:**
   - `create-bot-from-template.ts` начинает использовать helpers вместо inline-монолита.

8. `packages/feature-bots/src/effects/create-bot-from-template.ts` ✅

   **Что:**
   - миграция orchestrator-а на новый lifecycle-контракт: `shared/operation-lifecycle.ts` (glue) + `lifecycle/pipeline.ts` + `lifecycle/error.ts`.
   - как:
   - orchestrator передаёт в lifecycle `runOperation(...)`: “thunk execute” (apiClient call),
   - strict `mappingResult builder` и
   - “persist handler” (store update),
   - а pipeline берёт на себя идемпотентность/финализацию/порядок и safe side-effects.
   - отдельно:
     - убрать hand-made audit/event finalization из orchestrator-а, если вы хотите, чтобы pipeline централизовал audit emission;
     - либо оставить, но тогда audit должен быть “в side-effects phase” и obey hooks timing.

   **Definition of done:**
   - create-flow следует новому контракту pipeline без дублирования логики идемпотентности/порядка.

9. `packages/feature-bots/src/effects/shared/index.ts` и/или `packages/feature-bots/src/effects/index.ts` ✅

   **Что:**
   - обновить экспорты так, чтобы orchestrators могли импортировать нужные lifecycle-компоненты (обычно внутренние, без раздувания public API effects).

   **Definition of done:**
   - код компилируется без circular deps и без утечек внутренних типов “наружу пакета” сверх нужного.

10. `packages/core/src/policies/BotPolicy.ts`

**Что:**

- добавить pure метод `canCreateFromTemplate(actor, templateContext, options?)` с расширяемым `PolicyMeta` (версия/flags/segments) и возвращаемым контрактом объяснимости `{ allow, reason, source, ruleId? }`.

**Definition of done:**

- `BotPolicy` остаётся без IO/time/random; только deterministic decision.

11. `packages/core/src/policies/ComposedPolicy.ts`

**Что:**

- добавить компоновку `canCreateFromTemplate(...)` (first-deny-wins, всегда возвращать `source`, fail-closed если нет решения).

**Definition of done:**

- итоговое решение воспроизводимо и едино для всех feature-*.

12. `packages/feature-bots/src/effects/create-custom-bot.ts` (создать, если его ещё нет)

**Что:**

- новый orchestrator по тем же правилам lifecycle pipeline + helpers;
- отдельный policy action (`create_custom`) и идентичный контур idempotency/persist/finalize.

**Definition of done:**

- образец “второго orchestrator-а” без copy/paste lifecycle-логики.

13. `packages/feature-bots/src/effects/index.ts`

**Что:**

- при необходимости расширить barrel экспортами orchestrator-а(ов), не экспортируя helpers/внутренний lifecycle.

**Definition of done:**

- публичный API feature-bots остаётся чистым.

14. `docs/phase2-UI-platform.md` + `packages/feature-bots/docs/phase2-effects-refactor-steps.md`

**Что:**

- сверить contract wording с актуальными типами (`BotErrorResponse использует message, а не safeMessage`; это надо либо отразить в доке, либо унифицировать типы в коде).

**Definition of done:**

- док не расходится с контрактами типов, которые реализованы в коде.
