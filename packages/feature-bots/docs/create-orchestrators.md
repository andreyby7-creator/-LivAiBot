# Create-bot orchestrators (паритет)

Два публичных оркестратора делят один контракт create-flow.

**`create-bot-from-template.ts`**

- **Вход:** `CreateBotFromTemplateRequest` + `BotTemplate`
- **DI deps:** `CreateBotFromTemplateDeps`
- **Effect config:** `CreateBotEffectConfig`
- **Lifecycle:** `lifecycleHelper.runOperation({ operation: 'create', ... })`
- **Pre-flight:** `prepareBotCreationContext` — permissions `create`, policy `configure` на draft
- **Доменный инвариант до API:** `assertBotTemplateInvariant(template)`
- **Тело API:** `buildCreateBotRequestBody`
- **Техн. `templateId` для draft/fallback id:** `template.id`
- **Audit / store:** `create-bot-audit.mapper`, `updateCreateBotState`

**`create-custom-bot.ts`**

- **Вход:** `CreateCustomBotRequest` (name, instruction, `BotSettings`, опц. `templateId`)
- **DI deps:** то же, что у from-template (`CreateCustomBotDeps` = alias `CreateBotFromTemplateDeps`)
- **Effect config:** то же (`CreateBotEffectConfig`)
- **Lifecycle:** то же
- **Pre-flight:** `prepareCustomBotCreationContext` — permissions `create`, policy **`create_custom`** на draft
- **Доменный инвариант до API:** нет шаблона
- **Тело API:** `buildCustomCreateBotRequestBody`
- **Техн. `templateId` для draft/fallback id:** `customBotCreateSourceId` (`'custom_bot'`)
- **Audit / store:** то же

**Детерминированный `operationId`:** если в запросе не передан явный `operationId`, оба оркестратора вычисляют его через `shared/operation-id-fingerprint.ts` (FNV-1a, реестр солей `operationIdSalt`). Паритет по правилам:

|                       | **from-template**                                                                                                   | **custom-bot**                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Сборка                | `buildOperationIdSource`                                                                                            | `buildOperationIdSourceWithStableJson` (последний сегмент — объект `settings`)                                                                                                    |
| Сегменты (кроме соли) | `workspaceId`, `template.id`, `name`, затем `stableJsonFingerprint` для `instructionOverride` (нет поля → как `''`) | `workspaceId`, `name`, `stableJsonFingerprint` для `instruction`, `stableJsonFingerprint` для `templateId` (`undefined` → JSON `null`, отличимо от `''`), затем объект `settings` |

Security и смена соли — в докблоке модуля; обзор в реестре — `docs/phase2-UI-platform.md`.

**Время, `eventId` и audit-meta (shared runtime):** типы `ClockPort` / `EventIdGeneratorPort` и утилиты `createAuditMetaPort`, `wrapBestEffortHook` живут в `shared/orchestrator-runtime.ts` (SSOT). Пара `(timestamp, eventId)` для audit — через `auditMetaPort.nextAuditMeta()` (внутри только `clock.now()` и `eventIdGenerator.next()`). Уникальность/формат `eventId` задаётся реализацией порта, не модулем. `wrapBestEffortHook` по умолчанию глотает ошибки user-hook (чтобы не ломать основной flow); опционально `onError` для логов/отладки. Публично типы портов по-прежнему реэкспортируются из `create-bot-from-template.ts` для стабильного API пакета.

Платформенная сводка по пакетам: `docs/phase2-UI-platform.md` (корень репозитория).
