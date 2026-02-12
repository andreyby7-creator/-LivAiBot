# 🚀 ФАЗА 2 — UI (Web + PWA)

**Цель:** построить полноценный фронтенд-платформы для создания AI-чат-ботов с RAG, real-time, бизнес-автоматизацией и интеграциями.

**Фаза 2 = это не «вёрстка UI», а:**

создание клиентской платформы, способной быть хостом для AI-агентов, RAG-пайплайнов, tool-calling, real-time чатов и бизнес-процессов.

## 📦 Базовые технологические принципы

**Zod 4.x** → основной runtime-контракт между backend и frontend

**Effect 3.x** → единый runtime для:

- API вызовов
- WebSocket / SSE
- offline-cache
- retry / cancellation / telemetry

**Zustand 5.x** → хранилище UI состояния

**Next.js App Router + next-intl** → i18n с первого дня, без hydration flicker

**SSR strategy:**
Server Components используются только как контейнеры и data-boundaries.
Вся бизнес-логика, side-effects и state — строго client-side через app + feature слои.

**Гибридные DTO:**

- CRUD → автогенерация Zod из OpenAPI
- Complex формы → ручные Effect pipelines

## 📊 Текущее состояние системы (январь 2026)

| Слой              | Готовность | Комментарий                         |
| ----------------- | ---------- | ----------------------------------- |
| UI инфраструктура | 🟢 70%     | primitives + формы уже есть         |
| App слой          | 🔴 10%     | store, providers, hooks отсутствуют |
| Feature слои      | 🔴 0%      | auth/bots/chat — только схемы       |
| UI Features       | 🟡 5%      | только Login/Register               |
| PWA/Offline       | 🔴 0%      | sw + cache нет                      |
| Real-time         | 🟡 30%     | WebSocket client есть, но не в UI   |

**Общая готовность: ~25%**

## 🧱 Архитектура пакетов (каноническая модель)

Слои строятся строго снизу вверх:

```
ui-core
   ↓
ui-shared
   ↓
app (store, providers, hooks)
   ↓
feature-* (auth, bots, chat)
   ↓
ui-features
   ↓
apps/web (тонкий композитор)
```

- Никаких «пробросов» через два слоя.
- Никаких эффектов внутри ui-core.

## 🧩 Назначение каждого типа пакетов

### **UI**

- `ui-core` — чистые атомарные компоненты (ts+react)
- `ui-shared` — UI-инфраструктура: i18n, WS, SSE, offline-cache, helpers
- `ui-features` — готовые экраны и сценарии

### **App**

- `app` — glue layer: Zustand store, providers, hooks façade

### **Feature**

- `feature-auth` — аутентификация, токены, guards
- `feature-bots` — создание и управление AI-ботами
- `feature-chat` — real-time диалоги и сообщения

## 🎯 Что реально означает «платформа для AI-ботов»

После Фазы 2 ты получаешь:

**UI, способный:**

- создавать AI-агентов
- редактировать prompt-структуры
- управлять real-time диалогами
- включать/выключать AI
- собирать usage для биллинга

**Архитектуру, в которую без переделки можно добавить:**

- RAG pipelines
- Tool calling
- Webhooks
- CRM интеграции
- Marketplace агентов

**Это уже не SPA, а Frontend Runtime для AI-платформы.**

## ⚠️ Критические инженерные ограничения

- `ui-core` → никогда не знает про Effect
- `ui-features` → никогда не знает про API напрямую
- `feature-*` → вся бизнес-логика и побочные эффекты
- `app` → единственная точка композиции

**Это делает код:**

- масштабируемым
- тестируемым
- пригодным для командной разработки

## 🧠 Итоговая формула Фазы 2

**Фаза 2 = UI + Runtime + Platform API Client**

Ты строишь не интерфейс,\
а frontend-движок для AI-платформы.

---

## 🏗️ **АРХИТЕКТУРА UI (строго по LivAi-Structure.md)**

### **🎯 Архитектурные улучшения (интегрированы в план):**

- ✅ **Строгое разделение типов:** `common.ts` (глобальные) vs `auth.ts`, `bots.ts` (feature-specific)
- ✅ **Services в shared/lib:** WebSocket clients, API utilities кроме gateway
- ✅ **Единый root store:** Zustand с middleware (logging + persistence)
- ✅ **Feature flags:** Пошаговый rollout возможностей
- ✅ **i18n с первого дня:** Русский + английский (критично для Беларуси)
- ✅ **Error handling:** Централизованный mapping backend → frontend ошибок
- ✅ **CI/CD:** TypeScript strict + ESLint 9.39+ + Dprint 0.50+ с первого коммита

### **📁 Структура и порядок реализации:**

✅ Core/domain
1️⃣ packages/core/src/domain/AuthPolicy.ts 🟢 — ts — deps: core-contracts — (политики auth: lifecycle токенов, refresh, session validity)
2️⃣ packages/core/src/domain/BotPermissions.ts 🟢 — ts — deps: core-contracts — (типизация прав пользователей для ботов, ACL, CRUD-permissions)
3️⃣ packages/core/src/domain/BotPolicy.ts 🟢 — ts — deps: core-contracts — (бизнес-политики для ботов: ограничения по ролям, режимам, условиям)
4️⃣ packages/core/src/domain/ChatPolicy.ts 🟢 — ts — deps: core-contracts — (ограничения чата: кто кому пишет, лимиты, режимы)
5️⃣ packages/core/src/domain/BillingPolicy.ts 🟢 — ts — deps: core-contracts — (биллинг-политики: лимиты, overuse, блокировки) 📌 применяется ТОЛЬКО в feature-billing effects
6️⃣ packages/core/src/domain/ComposedPolicy.ts 🟢 — ts — deps: core-contracts, AuthPolicy, BotPermissions, BotPolicy, ChatPolicy, BillingPolicy — (составная политика: объединяет все доменные политики в единую точку)

✅ UI Core primitives
7️⃣ packages/ui-core/src/primitives/button.tsx 🟢 — ts+react — deps: —
8️⃣ packages/ui-core/src/primitives/input.tsx 🟢 — ts+react — deps: —
9️⃣ packages/ui-core/src/primitives/textarea.tsx 🟢 — ts+react — deps: —
1️⃣0️⃣ packages/ui-core/src/primitives/select.tsx 🟢 — ts+react — deps: —
1️⃣1️⃣ packages/ui-core/src/primitives/checkbox.tsx 🟢 — ts+react — deps: —
1️⃣2️⃣ packages/ui-core/src/primitives/radio.tsx 🟢 — ts+react — deps: —
1️⃣3️⃣ packages/ui-core/src/primitives/toggle.tsx 🟢 — ts+react — deps: —
1️⃣4️⃣ packages/ui-core/src/primitives/icon.tsx 🟢 — ts+react — deps: —
1️⃣5️⃣ packages/ui-core/src/primitives/avatar.tsx 🟢 — ts+react — deps: —
1️⃣6️⃣ packages/ui-core/src/primitives/badge.tsx 🟢 — ts+react — deps: —
1️⃣7️⃣ packages/ui-core/src/primitives/tooltip.tsx 🟢 — ts+react — deps: —
1️⃣8️⃣ packages/ui-core/src/primitives/divider.tsx 🟢 — ts+react — deps: —
1️⃣9️⃣ packages/ui-core/src/primitives/card.tsx 🟢 — ts+react — deps: —
2️⃣0️⃣ packages/ui-core/src/primitives/form-field.tsx 🟢 — ts+react — deps: —
2️⃣1️⃣ packages/ui-core/src/primitives/dialog.tsx 🟢 — ts+react — deps: —
2️⃣2️⃣ packages/ui-core/src/primitives/form.tsx 🟢 — ts+react — deps: —
2️⃣3️⃣ packages/ui-core/src/primitives/loading-spinner.tsx 🟢 — ts+react — deps: —
2️⃣4️⃣ packages/ui-core/src/primitives/dropdown.tsx 🟢 — ts+react — deps: —
2️⃣5️⃣ packages/ui-core/src/primitives/context-menu.tsx 🟢 — ts+react — deps: —
2️⃣6️⃣ packages/ui-core/src/primitives/status-indicator.tsx 🟢 — ts+react — deps: —

✅ UI Core components и types
2️⃣7️⃣ packages/ui-core/src/types/ui.ts 🟢 — ts — deps: —
2️⃣8️⃣ packages/ui-core/src/components/Toast.tsx 🟢 — ts+react — deps: —
2️⃣9️⃣ packages/ui-core/src/components/Skeleton.tsx 🟢 — ts+react — deps: —
3️⃣0️⃣ packages/ui-core/src/components/Modal.tsx 🟢 — ts+react — deps: —
3️⃣1️⃣ packages/ui-core/src/components/Breadcrumbs.tsx 🟢 — ts+react — deps: —
3️⃣2️⃣ packages/ui-core/src/components/Tabs.tsx 🟢 — ts+react — deps: —
3️⃣3️⃣ packages/ui-core/src/components/Accordion.tsx 🟢 — ts+react — deps: —
3️⃣4️⃣ packages/ui-core/src/components/DatePicker.tsx 🟢 — ts+react — deps: —
3️⃣5️⃣ packages/ui-core/src/components/FileUploader.tsx 🟢 — ts+react — deps: —
3️⃣6️⃣ packages/ui-core/src/components/SideBar.tsx 🟢 — ts+react — deps: —
3️⃣7️⃣ packages/ui-core/src/components/SearchBar.tsx 🟢 — ts+react — deps: —
3️⃣8️⃣ packages/ui-core/src/components/ConfirmDialog.tsx 🟢 — ts+react — deps: —
3️⃣9️⃣ packages/ui-core/src/components/ErrorBoundary.tsx 🟢 — ts+react — deps: —
4️⃣0️⃣ packages/ui-core/src/components/UserProfileDisplay.tsx 🟢 — ts+react — deps: —
4️⃣1️⃣ packages/ui-core/src/components/NavigationMenuItem.tsx 🟢 — ts+react — deps: —
4️⃣2️⃣ packages/ui-core/src/components/LanguageSelector.tsx 🟢 — ts+react — deps: —
4️⃣3️⃣ packages/ui-core/src/components/SupportButton.tsx 🟢 — ts+react — deps: —

✅ App types и libs
4️⃣4️⃣ packages/app/src/types/common.ts 🟢 — ts — deps: —
4️⃣5️⃣ packages/app/src/types/ui-contracts.ts 🟢 — ts — deps: ui-core/types/ui.ts, types/common.ts
4️⃣6️⃣ packages/app/src/types/api.ts 🟢 — ts deps: types/common.ts, types/ui-contracts.ts
4️⃣7️⃣ packages/app/src/types/errors.ts 🟢 — ts — deps: types/common.ts, types/api.ts
4️⃣8️⃣ packages/app/src/types/telemetry.ts 🟢 — ts — deps: types/ui-contracts.ts
4️⃣9️⃣ packages/app/src/lib/telemetry.batch-core.ts 🟢 — ts — deps: types/telemetry.ts (чистое ядро batch логики)
5️⃣0️⃣ packages/app/src/lib/telemetry.ts 🟢 — ts — deps: types/telemetry.ts, lib/telemetry.batch-core.ts
5️⃣1️⃣ packages/app/src/lib/service-worker.ts 🟢 — ts — deps: —
5️⃣2️⃣ packages/app/src/lib/i18n.ts 🟢 — ts+react — deps: —
5️⃣3️⃣ packages/app/src/lib/effect-utils.ts 🟢 — ts+effect — deps: types/api.ts
5️⃣4️⃣ packages/app/src/lib/api-client.ts 🟢 — ts+effect — deps: types/api.ts, lib/effect-utils.ts, lib/telemetry.ts
5️⃣5️⃣ packages/app/src/lib/websocket.ts 🟢 — ts+effect — deps: lib/effect-utils.ts, lib/telemetry.ts
5️⃣6️⃣ packages/app/src/lib/sse-client.ts 🟢 — ts+effect — deps: lib/effect-utils.ts, lib/telemetry.ts
5️⃣7️⃣ packages/app/src/lib/error-mapping.ts 🟢 — ts — deps: lib/effect-utils.ts, lib/telemetry.ts, types/common.ts, types/errors.ts
5️⃣8️⃣ packages/app/src/lib/validation.ts 🟢 — ts — deps: lib/error-mapping.ts, lib/telemetry.ts
5️⃣9️⃣ packages/app/src/lib/feature-flags.ts 🟢 — ts — deps: lib/error-mapping.ts
6️⃣0️⃣ packages/app/src/lib/offline-cache.ts 🟢 — ts+effect — deps: lib/effect-utils.ts, lib/telemetry.ts
6️⃣1️⃣ packages/app/src/lib/api-schema-guard.ts 🟢 — ts+effect — deps: types/api.ts, lib/error-mapping.ts, lib/telemetry.ts, lib/validation.ts
6️⃣2️⃣ packages/app/src/lib/performance.ts 🟢 — ts+effect — deps: types/common.ts, lib/telemetry.ts
6️⃣3️⃣ packages/app/src/lib/auth-guard.ts 🟢 — ts — deps: types/common.ts, lib/error-mapping.ts — (проверяет состояние, не принимает решений)
6️⃣4️⃣ packages/app/src/lib/auth-service.ts 🟢 — ts+effect — deps: lib/api-client.ts, lib/effect-isolation.ts, lib/effect-utils.ts, lib/orchestrator.ts, lib/schema-validated-effect.ts, lib/telemetry.ts, @livai/core-contracts
6️⃣5️⃣ packages/app/src/lib/route-permissions.ts 🟢 — ts — deps: lib/auth-guard.ts — (декларативная конфигурация: requiresAuth, permissions, roles)
6️⃣6️⃣ packages/app/src/lib/logger.ts 🟢 — ts — deps: types/common.ts, lib/telemetry.ts
6️⃣7️⃣ packages/app/src/lib/effect-timeout.ts 🟢 — ts+effect — deps: lib/effect-utils.ts
6️⃣8️⃣ packages/app/src/lib/effect-isolation.ts 🟢 — ts+effect — deps: lib/effect-utils.ts
6️⃣9️⃣ packages/app/src/lib/schema-validated-effect.ts 🟢 — ts+effect — deps: lib/api-schema-guard.ts, lib/error-mapping.ts, lib/effect-utils.ts
7️⃣0️⃣ packages/app/src/lib/orchestrator.ts 🟢 — ts+effect — deps: lib/effect-timeout.ts, lib/effect-isolation.ts, lib/telemetry.ts, lib/effect-utils.ts

✅ App state, provider и hooks
7️⃣1️⃣ packages/app/src/state/store-utils.ts 🟢 — ts — deps: state/store.ts
7️⃣2️⃣ packages/app/src/state/store.ts 🟢 — ts+zustand — deps: types/common.ts
7️⃣3️⃣ packages/app/src/state/query/query-client.ts 🟢 — ts+react — deps: lib/telemetry.ts
7️⃣4️⃣ packages/app/src/providers/TelemetryProvider.tsx 🟢 — ts+react — deps: lib/telemetry.ts, types/telemetry.ts, types/ui-contracts.ts
7️⃣5️⃣ packages/app/src/providers/FeatureFlagsProvider.tsx 🟢 — ts+zustand — deps: lib/feature-flags.ts, types/common.ts, types/ui-contracts.ts
7️⃣6️⃣ packages/app/src/providers/QueryClientProvider.tsx 🟢 — ts+react — deps: state/query/query-client.ts, types/ui-contracts.ts
7️⃣7️⃣ packages/app/src/providers/ToastProvider.tsx 🟢 — ts+react — deps: providers/TelemetryProvider.tsx, types/ui-contracts.ts
7️⃣8️⃣ packages/app/src/providers/UnifiedUIProvider.tsx 🟢 — ts+react — deps: providers/: FeatureFlagsProvider.tsx, intl-provider.tsx, TelemetryProvider.tsx, lib/i18n.ts, types/ui-contracts.ts
7️⃣9️⃣ packages/app/src/providers/AppProviders.tsx 🟢 — ts+react — deps: providers/intl-provider.tsx, providers/FeatureFlagsProvider.tsx, providers/TelemetryProvider.tsx, providers/QueryClientProvider.tsx, providers/ToastProvider.tsx, providers/UnifiedUIProvider.tsx, hooks/useAuth.ts, lib/auth-guard.ts, state/store.ts, types/ui-contracts.ts
8️⃣0️⃣ packages/app/src/bootstrap.tsx 🟢 — ts+react — deps: providers/AppProviders.tsx
8️⃣1️⃣ packages/app/src/hooks/useApi.ts 🟢 — ts+react+effect — deps: lib/api-client.ts, lib/api-schema-guard.ts, lib/error-mapping.ts, lib/telemetry.ts, types/api.ts, types/ui-contracts.ts
8️⃣2️⃣ packages/app/src/hooks/useAuth.ts 🟢 — ts+react+effect — deps: lib/auth-service.ts, state/store.ts, state/store-utils.ts
8️⃣3️⃣ packages/app/src/hooks/useToast.ts 🟢 — ts+react — deps: providers/ToastProvider.tsx, lib/telemetry.ts, types/ui-contracts.ts
8️⃣4️⃣ packages/app/src/hooks/useFeatureFlags.ts 🟢 — ts+react — deps: providers/FeatureFlagsProvider.tsx, lib/feature-flags.ts, types/common.ts, types/ui-contracts.ts
8️⃣5️⃣ packages/app/src/hooks/useOfflineCache.ts 🟢 — ts+react+effect — deps: lib/effect-utils.ts, lib/offline-cache.ts, types/ui-contracts.ts

✅ App UI wrappers (enabled: telemetry, feature-flags, i18n)
8️⃣6️⃣ packages/app/src/ui/button.tsx 🟢 — ts+react — deps: ui-core/primitives/button.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
8️⃣7️⃣ packages/app/src/ui/input.tsx 🟢 — ts+react — deps: ui-core/src/index.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
8️⃣8️⃣ packages/app/src/ui/textarea.tsx 🟢 — ts+react — deps: ui-core/primitives/textarea.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
8️⃣9️⃣ packages/app/src/ui/select.tsx 🟢 — ts+react — deps: ui-core/primitives/select.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣0️⃣ packages/app/src/ui/checkbox.tsx 🟢 — ts+react — deps: ui-core/primitives/checkbox.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣1️⃣ packages/app/src/ui/radio.tsx 🟢 — ts+react — deps: ui-core/primitives/radio.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣2️⃣ packages/app/src/ui/toggle.tsx 🟢 — ts+react — deps: ui-core/primitives/toggle.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣3️⃣ packages/app/src/ui/icon.tsx 🟢 — ts+react — deps: ui-core/primitives/icon.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣4️⃣ packages/app/src/ui/avatar.tsx 🟢 — ts+react — deps: ui-core/primitives/avatar.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣5️⃣ packages/app/src/ui/badge.tsx 🟢 — ts+react — deps: ui-core/primitives/badge.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣6️⃣ packages/app/src/ui/tooltip.tsx 🟢 — ts+react — deps: ui-core/primitives/tooltip.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣7️⃣ packages/app/src/ui/divider.tsx 🟢 — ts+react — deps: ui-core/primitives/divider.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣8️⃣ packages/app/src/ui/card.tsx 🟢 — ts+react — deps: ui-core/primitives/card.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
9️⃣9️⃣ packages/app/src/ui/dialog.tsx 🟢 — ts+react — deps: ui-core/primitives/dialog.tsx, providers/UnifiedUIProvider.tsx
1️⃣0️⃣0️⃣ packages/app/src/ui/form.tsx 🟢 — ts+react — deps: ui-core/primitives/form.tsx, providers/UnifiedUIProvider.tsx, app/lib/validation.ts, app/types/ui-contracts.ts
1️⃣0️⃣1️⃣ packages/app/src/ui/loading-spinner.tsx 🟢 — ts+react — deps: ui-core/primitives/loading-spinner.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣2️⃣ packages/app/src/ui/dropdown.tsx 🟢 — ts+react — deps: ui-core/primitives/dropdown.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣3️⃣ packages/app/src/ui/context-menu.tsx 🟢 — ts+react — deps: ui-core/primitives/context-menu.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣4️⃣ packages/app/src/ui/status-indicator.tsx 🟢 — ts+react — deps: ui-core/primitives/status-indicator.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣5️⃣ packages/app/src/ui/toast.tsx 🟢 — ts+react — deps: ui-core/components/Toast.tsx, providers/UnifiedUIProvider.tsx, app/types/errors.ts, app/types/ui-contracts.ts
1️⃣0️⃣6️⃣ packages/app/src/ui/skeleton.tsx 🟢 — ts+react — deps: ui-core/components/Skeleton.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣7️⃣ packages/app/src/ui/skeleton-group.tsx 🟢 — ts+react — deps: ui-core/components/Skeleton.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣8️⃣ packages/app/src/ui/modal.tsx 🟢 — ts+react — deps: ui-core/components/Modal.tsx, ui-core/types/ui.ts, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣0️⃣9️⃣ packages/app/src/ui/breadcrumbs.tsx 🟢 — ts+react — deps: ui-core/components/Breadcrumbs.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣0️⃣ packages/app/src/ui/tabs.tsx 🟢 — ts+react — deps: ui-core/components/Tabs.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣1️⃣ packages/app/src/ui/accordion.tsx 🟢 — ts+react — deps: ui-core/components/Accordion.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣2️⃣ packages/app/src/ui/date-picker.tsx 🟢 — ts+react — deps: ui-core/components/DatePicker.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣3️⃣ packages/app/src/ui/file-uploader.tsx 🟢 — ts+react — deps: ui-core/components/FileUploader.tsx, providers/UnifiedUIProvider.tsx, app/types/api.ts, app/lib/validation.ts, app/types/ui-contracts.ts
1️⃣1️⃣4️⃣ packages/app/src/ui/sidebar.tsx 🟢 — ts+react — deps: ui-core/components/SideBar.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣5️⃣ packages/app/src/ui/search-bar.tsx 🟢 — ts+react — deps: ui-core/components/SearchBar.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣6️⃣ packages/app/src/ui/confirm-dialog.tsx 🟢 — ts+react — deps: ui-core/components/ConfirmDialog.tsx, ui-core/components/Modal.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣1️⃣7️⃣ packages/app/src/ui/error-boundary.tsx 🟢 — ts+react — deps: ui-core/components/ErrorBoundary.tsx, providers/UnifiedUIProvider.tsx, app/lib/error-mapping.ts, app/types/errors.ts, app/types/ui-contracts.ts
1️⃣1️⃣8️⃣ packages/app/src/ui/user-profile-display.tsx 🟢 — ts+react — deps: ui-core/components/UserProfileDisplay.tsx, providers/UnifiedUIProvider.tsx, app/lib/auth-guard.ts, app/lib/route-permissions.ts, app/types/ui-contracts.ts
1️⃣1️⃣9️⃣ packages/app/src/ui/navigation-menu-item.tsx 🟢 — ts+react — deps: ui-core/components/NavigationMenuItem.tsx, providers/UnifiedUIProvider.tsx, app/lib/route-permissions.ts, app/types/ui-contracts.ts
1️⃣2️⃣0️⃣ packages/app/src/ui/language-selector.tsx 🟢 — ts+react — deps: ui-core/components/LanguageSelector.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts
1️⃣2️⃣1️⃣ packages/app/src/ui/support-button.tsx 🟢 — ts+react — deps: ui-core/components/SupportButton.tsx, providers/UnifiedUIProvider.tsx, app/types/ui-contracts.ts

✅ App routing & navigation
1️⃣2️⃣2️⃣ packages/app/src/routes/routes.ts 🟢 — ts — deps: types/common.ts — (декларативный список всех routes)
1️⃣2️⃣3️⃣ packages/app/src/routes/route-meta.ts 🟢 — ts — deps: routes.ts, route-permissions.ts, types/common.ts — (permissions, flags, auth-required)
1️⃣2️⃣4️⃣ packages/app/src/routes/navigation.ts 🟢 — ts — deps: route-meta.ts, routes.ts, types/common.ts — (sidebar/menu/navigation config)

✅ App events / signals
1️⃣2️⃣5️⃣ packages/app/src/events/app-lifecycle-events.ts 🟢 — ts — deps: types/common.ts — (lifecycle event hub)
1️⃣2️⃣6️⃣ packages/app/src/events/app-events.ts 🟢 — ts — deps: types/common.ts, zod, uuid — (logout, authExpired, billingChanged)
1️⃣2️⃣7️⃣ packages/app/src/events/event-bus.ts 🟢 — ts — deps: app-events.ts — (typed event bus)

✅ App background & scheduler
1️⃣2️⃣8️⃣ packages/app/src/background/scheduler.ts 🟢 — ts+effect — deps: events/app-events.ts, events/event-bus.ts, lib/telemetry.ts — (адаптивный планировщик задач с приоритетами)
1️⃣2️⃣9️⃣ packages/app/src/background/tasks.ts 🟢 — ts+effect — deps: scheduler.ts, events/app-events.ts, events/event-bus.ts — (refresh, sync, retry via scheduler)

✅ App lifecycle
1️⃣3️⃣0️⃣ packages/app/src/state/reset.ts 🟢 — ts — deps: state/store.ts, events/app-lifecycle-events.ts — (глобальный reset state при logout)
1️⃣3️⃣1️⃣ packages/app/src/lib/app-lifecycle.ts 🟢 — ts — deps: background/tasks.ts, events/app-lifecycle-events.ts, types/common.ts — (app lifecycle orchestrator: bootstrap/teardown, staged execution, event subscriptions)

Feature Auth
1️⃣3️⃣2️⃣ packages/feature-auth/src/domain/LoginRequest.ts 🟢 — ts — deps: — , (DTO login, только типы запроса)
1️⃣3️⃣3️⃣ packages/feature-auth/src/domain/RegisterRequest.ts 🟢 — ts — deps: — , (DTO register, данные для регистрации пользователя)
1️⃣3️⃣4️⃣ packages/feature-auth/src/domain/RegisterResponse.ts 🟢 — ts — deps: TokenPair, MfaInfo , (DTO ответа регистрации, подтверждение создания аккаунта)
1️⃣3️⃣5️⃣ packages/feature-auth/src/domain/PasswordResetRequest.ts 🟢 — ts — deps: — , (DTO запрос сброса пароля, email/username)
1️⃣3️⃣6️⃣ packages/feature-auth/src/domain/PasswordResetConfirm.ts 🟢 — ts — deps: — , (DTO подтверждение сброса пароля, token + новый пароль)
1️⃣3️⃣7️⃣ packages/feature-auth/src/domain/VerifyEmailRequest.ts 🟢 — ts — deps: — , (DTO верификация email, confirmation token)
1️⃣3️⃣8️⃣ packages/feature-auth/src/domain/VerifyPhoneRequest.ts 🟢 — ts — deps: — , (DTO верификация телефона, SMS code)
1️⃣3️⃣9️⃣ packages/feature-auth/src/domain/RefreshTokenRequest.ts 🟢 — ts — deps: — , (DTO обновления токена, refresh token)
1️⃣4️⃣0️⃣ packages/feature-auth/src/domain/LogoutRequest.ts 🟢 — ts — deps: — , (DTO выхода из системы, опционально refresh token)
1️⃣4️⃣1️⃣ packages/feature-auth/src/domain/DeviceInfo.ts 🟢 — ts — deps: — , (DTO информация об устройстве для аудита)
1️⃣4️⃣2️⃣ packages/feature-auth/src/domain/SessionRevokeRequest.ts 🟢 — ts — deps: — , (DTO отзыв сессии, session ID)
1️⃣4️⃣3️⃣ packages/feature-auth/src/domain/MfaChallengeRequest.ts 🟢 — ts — deps: — , (DTO запрос MFA вызова, тип аутентификации)
1️⃣4️⃣4️⃣ packages/feature-auth/src/domain/MfaSetupRequest.ts 🟢 — ts — deps: — , (DTO настройки MFA, секрет и метод)
1️⃣4️⃣5️⃣ packages/feature-auth/src/domain/MfaBackupCodeRequest.ts 🟢 — ts — deps: — , (DTO резервных кодов MFA для recovery)
1️⃣4️⃣6️⃣ packages/feature-auth/src/domain/OAuthLoginRequest.ts 🟢 — ts — deps: — , (DTO OAuth login, provider token: Google/Yandex/FB/VK)
1️⃣4️⃣7️⃣ packages/feature-auth/src/domain/OAuthRegisterRequest.ts 🟢 — ts — deps: — , (DTO OAuth register, provider data для создания аккаунта)
1️⃣4️⃣8️⃣ packages/feature-auth/src/domain/LoginRiskAssessment.ts 🟢 — ts — deps: — , (DTO оценки риска логина: гео, device fingerprint, IP)
1️⃣4️⃣9️⃣ packages/feature-auth/src/domain/SessionPolicy.ts 🟢 — ts — deps: — , (DTO политик сессии: ограничения по IP, concurrent sessions)
1️⃣5️⃣0️⃣ packages/feature-auth/src/domain/AuthAuditEvent.ts 🟢 — ts — deps: — , (DTO событий аудита: client app, IP, deviceId, geo, timestamp)
1️⃣5️⃣1️⃣ packages/feature-auth/src/domain/EmailTemplateRequest.ts 🟢 — ts — deps: — , (DTO кастомных email шаблонов для верификации/уведомлений)
1️⃣5️⃣2️⃣ packages/feature-auth/src/domain/SmsTemplateRequest.ts 🟢 — ts — deps: — , (DTO кастомных SMS шаблонов для верификации)
1️⃣5️⃣3️⃣ packages/feature-auth/src/domain/MfaRecoveryRequest.ts 🟢 — ts — deps: — , (DTO восстановления MFA доступа при потере устройства)
1️⃣5️⃣4️⃣ packages/feature-auth/src/domain/OAuthErrorResponse.ts 🟢 — ts — deps: — , (DTO ошибок OAuth: invalid_token, provider_unavailable, user_denied)
1️⃣5️⃣5️⃣ packages/feature-auth/src/domain/AuthErrorResponse.ts 🟢 — ts — deps: — , (DTO кастомных ошибок: invalid_credentials, account_locked, rate_limited)
1️⃣5️⃣6️⃣ packages/feature-auth/src/domain/TokenPair.ts 🟢 — ts — deps: — , (DTO token pair: accessToken, refreshToken, expiresAt)
1️⃣5️⃣7️⃣ packages/feature-auth/src/domain/MeResponse.ts 🟢 — ts — deps: — , (DTO ответа /me: данные пользователя, роли, permissions)
1️⃣5️⃣8️⃣ packages/feature-auth/src/types/auth.ts 🟢 — ts — deps: domain/LoginRequest.ts, domain/RegisterRequest.ts, domain/RegisterResponse.ts, domain/PasswordResetRequest.ts, domain/PasswordResetConfirm.ts, domain/VerifyEmailRequest.ts, domain/VerifyPhoneRequest.ts, domain/MfaChallengeRequest.ts, domain/MfaSetupRequest.ts, domain/MfaBackupCodeRequest.ts, domain/MfaRecoveryRequest.ts, domain/OAuthLoginRequest.ts, domain/OAuthRegisterRequest.ts, domain/OAuthErrorResponse.ts, domain/AuthErrorResponse.ts, domain/SessionPolicy.ts, domain/SessionRevokeRequest.ts, domain/LoginRiskAssessment.ts, domain/AuthAuditEvent.ts, domain/DeviceInfo.ts, domain/TokenPair.ts, domain/RefreshTokenRequest.ts, domain/LogoutRequest.ts, domain/MeResponse.ts, domain/EmailTemplateRequest.ts, domain/SmsTemplateRequest.ts , (агрегирующие типы auth: AuthState, AuthStatus, AuthError, MFA types, OAuth types, Security types, Recovery types)
1️⃣5️⃣4️⃣ packages/feature-auth/src/stores/auth.ts 🟢 — ts+zustand — deps: types/auth.ts , (Auth store, чистое состояние, без effects)
1️⃣5️⃣5️⃣ packages/feature-auth/src/effects/login.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/schema-validated-effect.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, app/state/store-utils.ts, types/auth.ts, stores/auth.ts, domain/LoginRiskAssessment.ts, domain/DeviceInfo.ts, schemas.ts , (выполняет login с оценкой риска через orchestrator, валидация через validatedEffect, обновление store через safeSet, isolation и timeout)
1️⃣5️⃣6️⃣ packages/feature-auth/src/effects/logout.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/state/store-utils.ts, stores/auth.ts , (выполняет logout через orchestrator, очищает auth state через safeSet, блокировка store через setStoreLocked)
1️⃣5️⃣7️⃣ packages/feature-auth/src/effects/refresh.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/schema-validated-effect.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, app/state/store-utils.ts, types/auth.ts, stores/auth.ts, core/domain/AuthPolicy, schemas.ts , (обновляет access token через orchestrator с idempotency guard, валидация через validatedEffect, синхронизация store через safeSet, isolation и timeout)
1️⃣5️⃣8️⃣ packages/feature-auth/src/lib/session-manager.ts 🔴 — ts — deps: types/auth.ts, core/domain/AuthPolicy, domain/SessionPolicy.ts — (auto-refresh, expiry, invalidation, session policies, concurrent limits)
1️⃣5️⃣9️⃣ packages/feature-auth/src/hooks/useAuth.ts 🔴 — ts+react — deps: stores/auth.ts, effects/login.ts, effects/logout.ts, effects/refresh.ts, types/auth.ts — (Единый React-адаптер auth: инкапсулирует zustand+effects, предоставляет API authState/authStatus/isAuthenticated/login/logout/refresh, скрывает реализацию, точка расширения для auto-refresh, silent login, side-effects; финальный слой feature-auth, аналог useBots/useChat)
1️⃣6️⃣0️⃣ packages/feature-auth/src/schemas.ts 🟢 — ts+zod — deps: core-contracts, domain/LoginRequest.ts, domain/RegisterRequest.ts, domain/RegisterResponse.ts, domain/PasswordResetRequest.ts, domain/PasswordResetConfirm.ts, domain/VerifyEmailRequest.ts, domain/VerifyPhoneRequest.ts, domain/MfaChallengeRequest.ts, domain/MfaSetupRequest.ts, domain/MfaBackupCodeRequest.ts, domain/MfaRecoveryRequest.ts, domain/OAuthLoginRequest.ts, domain/OAuthRegisterRequest.ts, domain/OAuthErrorResponse.ts, domain/AuthErrorResponse.ts, domain/LoginRiskAssessment.ts, domain/SessionPolicy.ts, domain/SessionRevokeRequest.ts, domain/AuthAuditEvent.ts, domain/DeviceInfo.ts, domain/TokenPair.ts, domain/RefreshTokenRequest.ts, domain/LogoutRequest.ts, domain/MeResponse.ts, domain/EmailTemplateRequest.ts, domain/SmsTemplateRequest.ts , (Zod схемы для валидации всех auth DTO: login/register/MFA/OAuth/security/audit/templates/errors/recovery на базе core-contracts)

Feature Bots
1️⃣6️⃣1️⃣ packages/feature-bots/src/domain/Bot.ts 🔴 — ts — deps: — , (Bot entity, основные поля бота: id, name, status, templateId, metadata)
1️⃣6️⃣2️⃣ packages/feature-bots/src/domain/BotTemplate.ts 🔴 — ts — deps: — , (Bot template entity, описание шаблона, дефолтные параметры, capabilities)
1️⃣6️⃣3️⃣ packages/feature-bots/src/domain/Prompt.ts 🔴 — ts — deps: — , (Prompt entity, системный/пользовательский prompt, параметры генерации)
1️⃣6️⃣4️⃣ packages/feature-bots/src/types/bots.ts 🔴 — ts — deps: domain/Bot.ts, domain/BotTemplate.ts, domain/Prompt.ts , (агрегирующие типы bots: BotState, BotStatus, BotError, DTO для create/update)
1️⃣6️⃣5️⃣ packages/feature-bots/src/stores/bots.ts 🔴 — ts+zustand — deps: types/bots.ts , (Bots store, список ботов, текущий бот, UI-состояние, без effects)
1️⃣6️⃣6️⃣ packages/feature-bots/src/effects/createBot.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/schema-validated-effect.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, stores/bots.ts, types/bots.ts, core/domain/BotPolicy, core/domain/BotPermissions, schemas.ts , (создание бота через orchestrator, валидация через validatedEffect, isolation и timeout)
1️⃣6️⃣7️⃣ packages/feature-bots/src/effects/updateBot.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/schema-validated-effect.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, stores/bots.ts, types/bots.ts, core/domain/BotPolicy, core/domain/BotPermissions, schemas.ts , (обновление бота через orchestrator, валидация через validatedEffect, isolation и timeout)
1️⃣6️⃣8️⃣ packages/feature-bots/src/effects/deleteBot.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, stores/bots.ts, core/domain/BotPolicy, core/domain/BotPermissions , (удаление бота через orchestrator, isolation и timeout)
1️⃣6️⃣9️⃣ packages/feature-bots/src/hooks/useBots.ts 🔴 — ts+react — deps: stores/bots.ts, effects/createBot.ts, effects/updateBot.ts, effects/deleteBot.ts , (React-API для списка ботов и CRUD)
1️⃣7️⃣0️⃣ packages/feature-bots/src/hooks/useBotWizard.ts 🔴 — ts+react — deps: stores/bots.ts, effects/createBot.ts , (пошаговый wizard создания бота, управление draft-состоянием)

Feature Chat
1️⃣7️⃣1️⃣ packages/feature-chat/src/domain/Message.ts 🔴 — ts — deps: — , (Message entity, текст, автор, timestamp, status доставки)
1️⃣7️⃣2️⃣ packages/feature-chat/src/domain/Conversation.ts 🔴 — ts — deps: — , (Conversation entity, id, participants, messages, metadata)
1️⃣7️⃣3️⃣ packages/feature-chat/src/types/chat.ts 🔴 — ts — deps: domain/Message.ts, domain/Conversation.ts , (агрегирующие типы chat: ChatState, SendMessagePayload, ChatError)
1️⃣7️⃣4️⃣ packages/feature-chat/src/stores/chat.ts 🔴 — ts+zustand — deps: types/chat.ts , (Chat store, текущее общение, список сообщений, состояние подключения)
1️⃣7️⃣5️⃣ packages/feature-chat/src/effects/sendMessage.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/schema-validated-effect.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, stores/chat.ts, types/chat.ts, core/domain/ChatPolicy, schemas.ts , (отправка сообщения через orchestrator с idempotency guard, валидация через validatedEffect, isolation и timeout, optimistic update)
1️⃣7️⃣6️⃣ packages/feature-chat/src/effects/connectWebSocket.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, app/lib/websocket.ts, stores/chat.ts, core/domain/ChatPolicy , (подключение к real-time каналу через orchestrator, isolation и timeout, приём сообщений)
1️⃣7️⃣7️⃣ packages/feature-chat/src/hooks/useChat.ts 🔴 — ts+react — deps: stores/chat.ts, effects/sendMessage.ts , (React-API для чата и сообщений)
1️⃣7️⃣8️⃣ packages/feature-chat/src/hooks/useRealTime.ts 🔴 — ts+react+effect — deps: effects/connectWebSocket.ts, stores/chat.ts, app/lib/telemetry.ts — (Lifecycle-контроль real-time: init WS on mount, cleanup on unmount, reconnect/idempotency, защита от multiple connections, синхронизация состояния подключения в store, telemetry; lifecycle остаётся в React, effect — чистый use-case)
1️⃣7️⃣9️⃣ packages/feature-chat/src/effects/connectSSE.ts 🔴 — ts+effect — deps: app/lib/orchestrator.ts, app/lib/effect-timeout.ts, app/lib/effect-isolation.ts, app/lib/sse-client.ts, stores/chat.ts, core/domain/ChatPolicy — (SSE fallback для real-time чата через orchestrator, isolation и timeout, альтернатива WebSocket, единый контракт обновления chat store, включается по feature-flag или env)
1️⃣8️⃣0️⃣ packages/feature-chat/src/lib/message-normalizer.ts 🔴 — ts — deps: domain/Message.ts, types/chat.ts — (Нормализация входящих сообщений API/WS/SSE → Message entity: статусы доставки, timestamps, idempotency, forward-compatibility)
1️⃣8️⃣1️⃣ packages/feature-chat/src/schemas.ts 🔴 — ts+zod — deps: domain/Message.ts, domain/Conversation.ts, types/chat.ts — (Zod схемы для валидации chat данных: Message, Conversation, SendMessagePayload)

App ↔ Feature contracts
1️⃣8️⃣2️⃣ packages/app/src/contracts/feature-auth.contract.ts 🔴 — ts — deps: feature-auth, types/ui-contracts.ts, core-contracts — (контракт app ↔ auth: isAuthenticated, permissions[])
1️⃣8️⃣3️⃣ packages/app/src/contracts/feature-bots.contract.ts 🔴 — ts — deps: feature-bots, types/ui-contracts.ts, core-contracts — (контракт app ↔ bots: capabilities, botPermissions)
1️⃣8️⃣4️⃣ packages/app/src/contracts/feature-chat.contract.ts 🔴 — ts — deps: feature-chat, types/ui-contracts.ts, core-contracts — (контракт app ↔ chat: chatPermissions)

App feature adapters (glue layer: app ↔ features)
1️⃣8️⃣5️⃣ packages/app/src/features/auth.adapter.ts 🔴 — ts — deps: feature-auth/hooks/useAuth, types/ui-contracts.ts — (адаптер auth feature: proxy, flags, SSR-safe)
1️⃣8️⃣6️⃣ packages/app/src/features/bots.adapter.ts 🔴 — ts — deps: feature-bots/hooks/useBots, types/ui-contracts.ts — (адаптер bots feature для app)
1️⃣8️⃣7️⃣ packages/app/src/features/chat.adapter.ts 🔴 — ts — deps: feature-chat/hooks/useChat, types/ui-contracts.ts — (адаптер chat feature для app)

**🏗️ UI Features Guidelines:**

- Структура реализации: **UI → hooks → effects → store**
- **Большинство UI Features пока нет** → при реализации держать чистую архитектуру
- **SSR-safe boundaries** особенно важны для real-time компонентов (WebSocket/SSE в effects)
- **Feature Flags**: использовать `FeatureFlagsProvider` и `useFeatureFlags` для conditional rendering без RSC re-render
- **Auth / Session Management**: useAuth уже объединяет store + effects → убедиться, что auto-refresh и silent-login безопасны и не создают multiple requests при SSR

UI Features — Auth
1️⃣8️⃣8️⃣ packages/ui-features/src/auth/login-form.tsx 🟡 — ts+react — deps: types/ui-contracts.ts, useAuth() — Login form UI
1️⃣8️⃣9️⃣ packages/ui-features/src/auth/register-form.tsx 🟡 — ts+react — deps: types/ui-contracts.ts, useAuth() — Register form UI
1️⃣9️⃣0️⃣ packages/ui-features/src/auth/WorkspaceForm.tsx 🔴 — tsx+react — deps: useAuth(), PermissionGate — Workspace form UI (НЕТ)
1️⃣9️⃣1️⃣ packages/ui-features/src/auth/OnboardingFlow.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — Onboarding flow (НЕТ)
1️⃣9️⃣2️⃣ packages/ui-features/src/auth/TwoFactorAuth.tsx 🔴 — tsx+react+effect — deps: useAuth() — Two factor auth UI (НЕТ)

UI Features — Permission-based Components
1️⃣9️⃣3️⃣ packages/ui-features/src/common/AuthGuard.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — Generic auth guard wrapper (НЕТ)
1️⃣9️⃣4️⃣ packages/ui-features/src/common/RoleGate.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — Role-based access gate (НЕТ)
1️⃣9️⃣5️⃣ packages/ui-features/src/common/PermissionGate.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — Permission-based access gate (НЕТ)
1️⃣9️⃣6️⃣ packages/ui-features/src/common/ProtectedRoute.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — Route protection wrapper (НЕТ)

UI Features — Bots
1️⃣9️⃣7️⃣ packages/ui-features/src/bots/BotDashboard.tsx 🔴 — tsx+react — deps: store/hooks — Bots dashboard (НЕТ)
1️⃣9️⃣8️⃣ packages/ui-features/src/bots/BotWizardFlow.tsx 🔴 — tsx+react+effect — deps: effects — Bot wizard flow (НЕТ)
1️⃣9️⃣9️⃣ packages/ui-features/src/bots/BotTemplateSelector.tsx 🔴 — tsx+react — deps: — Template selector (НЕТ)
2️⃣0️⃣0️⃣ packages/ui-features/src/bots/BotBasicForm.tsx 🔴 — tsx+react — deps: — Bot basic form (НЕТ)
2️⃣0️⃣1️⃣ packages/ui-features/src/bots/PromptEditor.tsx 🔴 — tsx+react+effect — deps: effects — Prompt editor (НЕТ)
2️⃣0️⃣2️⃣ packages/ui-features/src/bots/PromptBlocks.tsx 🔴 — tsx+react — deps: — Prompt blocks (НЕТ)
2️⃣0️⃣3️⃣ packages/ui-features/src/bots/PromptPreview.tsx 🔴 — tsx+react — deps: — Prompt preview (НЕТ)
2️⃣0️⃣4️⃣ packages/ui-features/src/bots/BotCard.tsx 🔴 — tsx+react — deps: — Compact bot card for list view (НЕТ)
2️⃣0️⃣5️⃣ packages/ui-features/src/bots/BotDetailCard.tsx 🔴 — tsx+react — deps: — Detailed bot card with creator info (НЕТ)
2️⃣0️⃣6️⃣ packages/ui-features/src/bots/SubscriptionStatusBadge.tsx 🔴 — tsx+react — deps: — Subscription status badge (active/inactive) (НЕТ)
2️⃣0️⃣7️⃣ packages/ui-features/src/bots/CreatorInfo.tsx 🔴 — tsx+react — deps: — Creator information component (НЕТ)
2️⃣0️⃣8️⃣ packages/ui-features/src/bots/ContactButton.tsx 🔴 — tsx+react — deps: — Contact creator button (НЕТ)
2️⃣0️⃣9️⃣ packages/ui-features/src/bots/BotListItem.tsx 🔴 — tsx+react — deps: — Bot list item for sidebar/list (НЕТ)

**🤖 Bots / Chat Real-time:**

- **Чётко разделять**: effects (`connectWebSocket`, `connectSSE`) ↔ UI (`ChatInterface`, `PromptEditor`)
- **Избегать hydration waterfall**: real-time эффекты должны быть изолированы от UI рендера
- **Client/Server boundaries**: WebSocket/SSE строго в effects, не в UI компонентах

UI Features — Chat + Pages
2️⃣1️⃣0️⃣ packages/ui-features/src/chat/ChatInterface.tsx 🔴 — tsx+react+effect — deps: effects — Chat interface (НЕТ)
2️⃣1️⃣1️⃣ packages/ui-features/src/chat/MessageBubble.tsx 🔴 — tsx+react — deps: hooks — Message bubble (НЕТ)
2️⃣1️⃣2️⃣ packages/ui-features/src/chat/ChatInput.tsx 🔴 — tsx+react — deps: hooks — Chat input (НЕТ)
2️⃣1️⃣3️⃣ packages/ui-features/src/chat/TypingIndicator.tsx 🔴 — tsx+react — deps: hooks — Typing indicator (НЕТ)
2️⃣1️⃣4️⃣ packages/ui-features/src/chat/MessageStatus.tsx 🔴 — tsx+react — deps: hooks — Message status (НЕТ)
2️⃣1️⃣5️⃣ packages/ui-features/src/chat/Attachments.tsx 🔴 — tsx+react — deps: hooks — Attachments (НЕТ)
2️⃣1️⃣6️⃣ packages/ui-features/src/chat/AttachmentsDragDrop.tsx 🔴 — tsx+react — deps: hooks — Drag & Drop для attachments (НЕТ)
2️⃣1️⃣7️⃣ packages/ui-features/src/chat/ChatHistory.tsx 🔴 — tsx+react — deps: hooks — Chat history (НЕТ)
2️⃣1️⃣8️⃣ packages/ui-features/src/chat/ChatListPanel.tsx 🔴 — tsx+react — deps: hooks — Chat list sidebar panel (НЕТ)
2️⃣1️⃣9️⃣ packages/ui-features/src/chat/ChatListHeader.tsx 🔴 — tsx+react — deps: hooks — Chat list header with advanced mode toggle (НЕТ)
2️⃣2️⃣0️⃣ packages/ui-features/src/chat/CreateChatButton.tsx 🔴 — tsx+react — deps: hooks — Create test chat button (НЕТ)
2️⃣2️⃣1️⃣ packages/ui-features/src/chat/AIAgentStatusToggle.tsx 🔴 — tsx+react — deps: hooks — AI agent active/inactive toggle (НЕТ)
2️⃣2️⃣2️⃣ packages/ui-features/src/chat/ChatActionButtons.tsx 🔴 — tsx+react — deps: hooks — Chat action buttons (share, copy, edit) (НЕТ)
2️⃣2️⃣3️⃣ packages/ui-features/src/chat/MessageInputBar.tsx 🔴 — tsx+react+effect — deps: effects — Message input bar with attachments, voice, AI assist (НЕТ)
2️⃣2️⃣4️⃣ packages/ui-features/src/chat/AdvancedModeToggle.tsx 🔴 — tsx+react — deps: hooks — Advanced mode toggle switch (НЕТ)

UI Features — Admin/Dashboard
2️⃣2️⃣5️⃣ packages/ui-features/src/admin/DataTable.tsx 🔴 — tsx+react+effect — deps: effects — Data table (НЕТ)
2️⃣2️⃣6️⃣ packages/ui-features/src/admin/Pagination.tsx 🔴 — tsx+react+effect — deps: effects — Pagination (НЕТ)
2️⃣2️⃣7️⃣ packages/ui-features/src/admin/FiltersPanel.tsx 🔴 — tsx+react+effect — deps: effects — Filters panel (НЕТ)
2️⃣2️⃣8️⃣ packages/ui-features/src/admin/StatCard.tsx 🔴 — tsx+react — deps: — Stat card (НЕТ)
2️⃣2️⃣9️⃣ packages/ui-features/src/admin/Chart.tsx 🔴 — tsx+react+effect — deps: effects — Chart/Graph (НЕТ)
2️⃣3️⃣0️⃣ packages/ui-features/src/admin/LogsViewer.tsx 🔴 — tsx+react+effect — deps: effects — Logs viewer (НЕТ)
2️⃣3️⃣1️⃣ packages/ui-features/src/admin/UserRoleBadge.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — User role badge (НЕТ)
2️⃣3️⃣2️⃣ packages/ui-features/src/admin/EmptyState.tsx 🔴 — tsx+react — deps: — Empty state component with icon and message (НЕТ)
2️⃣3️⃣3️⃣ packages/ui-features/src/admin/DateRangePicker.tsx 🔴 — tsx+react — deps: hooks — Date range picker component (НЕТ)
2️⃣3️⃣4️⃣ packages/ui-features/src/admin/FilterDropdown.tsx 🔴 — tsx+react — deps: hooks — Filter dropdown component (НЕТ)

UI Features — Billing/Payments/Balance
2️⃣3️⃣5️⃣ packages/ui-features/src/billing/PricingCard.tsx 🔴 — tsx+react — deps: — Pricing card (НЕТ)
2️⃣3️⃣6️⃣ packages/ui-features/src/billing/InvoiceTable.tsx 🔴 — tsx+react+effect — deps: effects — Invoice table (НЕТ)
2️⃣3️⃣7️⃣ packages/ui-features/src/billing/PaymentMethod.tsx 🔴 — tsx+react+effect — deps: effects — Payment method (НЕТ)
2️⃣3️⃣8️⃣ packages/ui-features/src/billing/BillingHistory.tsx 🔴 — tsx+react+effect — deps: effects — Billing history (НЕТ)
2️⃣3️⃣9️⃣ packages/ui-features/src/billing/SubscriptionStatus.tsx 🔴 — tsx+react — deps: — Subscription status (НЕТ)
2️⃣4️⃣0️⃣ packages/ui-features/src/billing/BalanceDisplay.tsx 🔴 — tsx+react — deps: — Balance card for sidebar (НЕТ)
2️⃣4️⃣1️⃣ packages/ui-features/src/billing/BotStatusIndicator.tsx 🔴 — tsx+react — deps: — Bot status indicator (blocked/active) (НЕТ)
2️⃣4️⃣2️⃣ packages/ui-features/src/billing/TransactionHistoryTable.tsx 🔴 — tsx+react+effect — deps: effects — Transaction history table with tabs (НЕТ)
2️⃣4️⃣3️⃣ packages/ui-features/src/billing/UsageGraph.tsx 🔴 — tsx+react+effect — deps: effects — Usage statistics graph/chart (НЕТ)
2️⃣4️⃣4️⃣ packages/ui-features/src/billing/StatSummaryCards.tsx 🔴 — tsx+react — deps: — Summary cards (today/yesterday/week expenses) (НЕТ)
2️⃣4️⃣5️⃣ packages/ui-features/src/billing/PaymentModal.tsx 🔴 — tsx+react+effect — deps: effects — Payment modal with method tabs (НЕТ)
2️⃣4️⃣6️⃣ packages/ui-features/src/billing/AmountInput.tsx 🔴 — tsx+react — deps: hooks — Amount input with validation and hints (НЕТ)
2️⃣4️⃣7️⃣ packages/ui-features/src/billing/TeamMemberSelector.tsx 🔴 — tsx+react — deps: — Team member count selector (НЕТ)
2️⃣4️⃣8️⃣ packages/ui-features/src/billing/OrganizationFormFields.tsx 🔴 — tsx+react+effect — deps: effects — Organization details form fields (НЕТ)
2️⃣4️⃣9️⃣ packages/ui-features/src/billing/DocumentUploadSection.tsx 🔴 — tsx+react+effect — deps: effects — Document upload section for billing (НЕТ)

UI Features — PWA/Security
2️⃣5️⃣0️⃣ packages/ui-features/src/pwa/InstallPrompt.tsx 🔴 — tsx+react+effect — deps: effects — Install prompt (НЕТ)
2️⃣5️⃣1️⃣ packages/ui-features/src/pwa/OfflineIndicator.tsx 🔴 — tsx+react+effect — deps: effects — Offline indicator (НЕТ)
2️⃣5️⃣2️⃣ packages/ui-features/src/pwa/UpdateNotification.tsx 🔴 — tsx+react+effect — deps: effects — Update notification (НЕТ)
2️⃣5️⃣3️⃣ packages/ui-features/src/security/PermissionsTable.tsx 🔴 — tsx+react — deps: useAuth(), route-permissions — Permissions table (НЕТ)

UI Features — Marketplace
2️⃣5️⃣4️⃣ packages/ui-features/src/marketplace/MarketplaceCard.tsx 🔴 — tsx+react — deps: — Marketplace application/bot card (НЕТ)
2️⃣5️⃣5️⃣ packages/ui-features/src/marketplace/CategoryTabs.tsx 🔴 — tsx+react — deps: — Category filter tabs (НЕТ)
2️⃣5️⃣6️⃣ packages/ui-features/src/marketplace/MarketplaceSearch.tsx 🔴 — tsx+react+effect — deps: effects — Marketplace search bar (НЕТ)

🟡 Web базовые файлы и i18n
2️⃣5️⃣7️⃣ apps/web/package.json 🟢 — Полная реализация Next.js приложения с зависимостями (next-intl, react-hook-form, zod, workspace пакеты)
2️⃣5️⃣8️⃣ apps/web/tsconfig.json 🟢 — Полная TS конфигурация с paths на workspace packages и правильными настройками для Next.js
2️⃣5️⃣9️⃣ apps/web/next.config.mjs 🟢 — Полная Next.js конфигурация с настройками безопасности, изображений и webpack
2️⃣6️⃣0️⃣ apps/web/.env.example 🟢 — Пример конфигурации переменных окружения
2️⃣6️⃣1️⃣ apps/web/src/env.ts 🟢 — Типизированная конфигурация env переменных
2️⃣6️⃣2️⃣ apps/web/i18n/i18n.config.json 🟢 — Конфигурация локалей
2️⃣6️⃣3️⃣ apps/web/i18n/routing.ts 🟢 — Полная конфигурация локалей с типами TypeScript
2️⃣6️⃣4️⃣ apps/web/i18n/request.ts 🟢 — Полная next-intl request config с загрузкой сообщений и type guards
2️⃣6️⃣5️⃣ apps/web/messages/en.json 🟢 — Полная локализация EN со всеми необходимыми ключами
2️⃣6️⃣6️⃣ apps/web/messages/ru.json 🟢 — Полная локализация RU со всеми необходимыми ключами
2️⃣6️⃣7️⃣ apps/web/src/app/globals.css 🟢 — Глобальные стили
2️⃣6️⃣8️⃣ apps/web/src/app/[locale]/layout.tsx 🟢 — Полный root layout с i18n provider и генерацией метаданных
2️⃣6️⃣9️⃣ apps/web/src/app/providers.tsx 🟡 — Next.js Providers wrapper — проксирует AppProviders (TODO: добавить ToastProvider, TelemetryProvider, FeatureFlagsProvider из @livai/app; упростить до прокси AppProviders когда будет создан в @livai/app) + покрыть тестами
2️⃣7️⃣0️⃣ apps/web/middleware.ts 🟢 — Полная i18n routing middleware с next-intl и правильными исключениями
2️⃣7️⃣1️⃣ apps/web/public/manifest.json 🟢 — PWA manifest
2️⃣7️⃣2️⃣ apps/web/src/sw.ts 🟢 — Service Worker TypeScript исходник
2️⃣7️⃣3️⃣ apps/web/public/sw.js 🟢 — Service Worker JavaScript (генерируется из sw.ts при сборке)
2️⃣7️⃣4️⃣ apps/web/src/app/sw-register.ts 🟡 — Регистрация Service Worker на клиенте (TODO: интегрировать toast notification system из @livai/app для уведомления пользователя перед перезагрузкой вместо console.log)
2️⃣7️⃣5️⃣ apps/web/public/favicon.ico 🟢 — Favicon для production
2️⃣7️⃣6️⃣ apps/web/src/app/icon-192.png/route.ts 🟢 — PWA icon 192x192 (PNG endpoint, генерируется на лету)
2️⃣7️⃣7️⃣ apps/web/src/app/icon-512.png/route.ts 🟢 — PWA icon 512x512 (PNG endpoint, генерируется на лету)
2️⃣7️⃣8️⃣ apps/web/src/app/robots.txt/route.ts 🟢 — Robots.txt для SEO (динамический endpoint, env-aware policy, готовность к sitemap)
2️⃣7️⃣9️⃣ apps/web/src/app/sitemap.xml/route.ts 🟢 — Sitemap для SEO (XML endpoint, генерируется на лету, env-aware policy, i18n поддержка)

Web Pages
2️⃣8️⃣0️⃣ apps/web/src/app/[locale]/page.tsx 🟡 — Главная страница с i18n и навигацией (больше чем каркас)
2️⃣8️⃣1️⃣ apps/web/src/app/[locale]/dashboard/page.tsx 🟡 — Серверный компонент-контейнер для dashboard с отключенным prerendering
2️⃣8️⃣2️⃣ apps/web/src/app/[locale]/dashboard/DashboardClient.tsx 🟡 — Клиентский компонент dashboard с базовым UI и TODO для виджетов/данных
2️⃣8️⃣3️⃣ apps/web/src/app/[locale]/auth/login/page.tsx 🟡 — Серверный компонент-контейнер для login с отключенным prerendering
2️⃣8️⃣4️⃣ apps/web/src/app/[locale]/auth/login/LoginClient.tsx 🟡 — Клиентский компонент login с формой и TODO для реального auth flow
2️⃣8️⃣5️⃣ apps/web/src/app/[locale]/auth/register/page.tsx 🟡 — Серверный компонент-контейнер для register с отключенным prerendering
2️⃣8️⃣6️⃣ apps/web/src/app/[locale]/auth/register/RegisterClient.tsx 🟡 — Клиентский компонент register с формой и TODO для реального auth flow
2️⃣8️⃣7️⃣ apps/web/src/app/[locale]/bots/page.tsx 🔴 — Bots page with BotDashboard (НЕТ)
2️⃣8️⃣8️⃣ apps/web/src/app/[locale]/balance/page.tsx 🔴 — Balance page with tabs and billing components (НЕТ)
2️⃣8️⃣9️⃣ apps/web/src/app/[locale]/marketplace/page.tsx 🔴 — Marketplace page with category tabs and cards (НЕТ)
2️⃣9️⃣0️⃣ apps/web/src/app/[locale]/chat/page.tsx 🔴 — Chat page with ChatInterface and ChatListPanel (НЕТ)
2️⃣9️⃣1️⃣ apps/web/src/app/[locale]/analytics/page.tsx 🔴 — Analytics page with charts and filters (НЕТ)
2️⃣9️⃣2️⃣ apps/web/src/app/[locale]/history/page.tsx 🔴 — History page with filters and data table (НЕТ)
2️⃣9️⃣3️⃣ apps/web/src/app/[locale]/not-found.tsx 🔴 — Custom 404 error page (НЕТ)
2️⃣9️⃣4️⃣ apps/web/src/app/[locale]/mailings/page.tsx 🔴 — Mailings page with filters and table (НЕТ)
2️⃣9️⃣5️⃣ apps/web/src/app/[locale]/error.tsx 🔴 — Custom 500 error page (НЕТ)
2️⃣9️⃣6️⃣ apps/web/src/app/global-error.tsx 🔴 — App-level error boundary для Next.js 16+ (НЕТ)

💡 **Итог по рекомендациям для UI компонентов:**

- Все интерактивные компоненты, где есть fetch, CRUD, real-time, формы → добавить **ts-effect**
- Компоненты чистого UI → **TSX+React**, подключение к store/hooks
- SSR-safe/route-permissions → предусмотреть для Auth/Permission компоненты

---

**🏗️ Архитектурные слои после реализации**

### **2️⃣ Product Layer** (то, что видит пользователь)

**Bots:** шаблоны, визард создания, prompt editor, preview, статус, подписки, биллинг\
**Chat:** real-time, SSE/WebSocket, history, attachments, AI agent toggle\
**Marketplace:** карточки, категории, поиск\
**Billing:** usage, balance, subscriptions\
**Admin:** logs, charts, tables\
**PWA:** offline, update, install

### **3️⃣ Platform Layer** (то, что позволяет строить ботов)

**Создание ботов:** feature-bots/domain, BotTemplate\
**RAG настройка:** Prompt blocks, Prompt editor, Domain entities\
**Real-time:** WebSocket/SSE каналы, offline cache\
**AI агент:** переключение on/off

→ **Фундамент под:** RAG pipelines, Tool calling, Webhooks, бизнес-автоматизацию, интеграции (CRM, Notion, Slack, Telegram, Stripe, HubSpot)

### **4️⃣ Infra Layer** (то, что превращает проект в платформу)

**Effect runtime:** оркестратор side effects
**Effect boundaries:** единственный слой, где разрешены IO, retry/timeout, cancellation, telemetry. React hooks и UI не управляют эффектами напрямую.

**API:** typed client, schema guards, error model\
**Observability:** telemetry, feature flags\
**PWA:** offline, service worker\
**Security:** auth-guard, permissions\
**Config:** env system

### **5️⃣ Developer Experience Layer**

**Monorepo:** domain-driven features, независимые пакеты\
**UI:** core primitives + features, hooks façade\
**Bootstrap:** единые providers, i18n, env typing\
**Архитектура:** app слой общий, feature-пакеты автономны

---

## 🎯 **Универсальность платформы**

### **Любой SPA / WebApp / Dashboard / SaaS / Internal tool ложится на это без сопротивления**

После реализации всех красных компонентов, получаем **универсальную платформу** для создания любых веб-приложений.

### **3️⃣ Product-кейсы, которые закрываются «из коробки»**

| Тип проекта                          | Статус       |
| ------------------------------------ | ------------ |
| **SaaS с ролями и подписками**       | ✅ полностью |
| **AI-продукты (чаты, агенты, боты)** | ✅ полностью |
| **Маркетплейсы / каталоги**          | ✅ полностью |
| **Админки / backoffice**             | ✅ полностью |
| **Корпоративные порталы**            | ✅ полностью |
| **PWA / offline-first**              | ✅ полностью |
| **Real-time apps (WS/SSE)**          | ✅ полностью |
| **Multi-tenant**                     | ✅ полностью |
| **i18n / locales**                   | ✅ полностью |

### **Самое сильное место — policies + contracts**

- **AuthPolicy / BotPolicy / BillingPolicy / ChatPolicy** — бизнес-правила высокого уровня
- **route-permissions** — декларативные права доступа
- **PermissionGate / RoleGate / AuthGuard** — UI-компоненты защиты
- **feature-*.contract.ts** — интерфейсы связи app ↔ features

👉 **Это позволяет:**

- менять backend без переписывания UI
- делать white-label версии
- выносить features в отдельные пакеты
- подключать другой backend (REST / GraphQL / BFF)

### **Phase Extensions / Optional Platform Extensions**

#### **🔧 Form engine abstraction**

- form schema → UI
- dynamic forms (billing, admin)

#### **📊 Table engine**

- sorting / filtering / virtual scroll
- column config через schema

#### **🎨 Theme engine**

- design tokens
- runtime theme switching

#### **📝 CMS adapter (optional)**

- read-only content
- marketing pages

---
