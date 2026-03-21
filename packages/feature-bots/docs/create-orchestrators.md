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

**Детерминированный `operationId`:** если в запросе не передан явный `operationId`, оба оркестратора вычисляют его через `shared/operation-id-fingerprint.ts` (FNV-1a, реестр солей `operationIdSalt`). Для кастомного бота к `settings` применяется canonical JSON (`stableJsonFingerprint`), не «сырой» `JSON.stringify`. Security и правила смены соли — в докблоке модуля; обзор в реестре пакета — `docs/phase2-UI-platform.md`.

Платформенная сводка по пакетам: `docs/phase2-UI-platform.md` (корень репозитория).
