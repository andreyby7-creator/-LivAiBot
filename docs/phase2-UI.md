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

🟡 Web базовые файлы и i18n
1️⃣ apps/web/package.json 🟢 — Полная реализация Next.js приложения с зависимостями (next-intl, react-hook-form, zod, workspace пакеты)
2️⃣ apps/web/tsconfig.json 🟢 — Полная TS конфигурация с paths на workspace packages и правильными настройками для Next.js
3️⃣ apps/web/next.config.mjs 🟢 — Полная Next.js конфигурация с настройками безопасности, изображений и webpack
4️⃣ apps/web/.env.example 🟢 — Пример конфигурации переменных окружения
5️⃣ apps/web/src/env.ts 🟢 — Типизированная конфигурация env переменных
6️⃣ apps/web/i18n/i18n.config.json 🟢 — Конфигурация локалей
7️⃣ apps/web/i18n/routing.ts 🟢 — Полная конфигурация локалей с типами TypeScript
8️⃣ apps/web/i18n/request.ts 🟢 — Полная next-intl request config с загрузкой сообщений и type guards
9️⃣ apps/web/messages/en.json 🟢 — Полная локализация EN со всеми необходимыми ключами
1️⃣0️⃣ apps/web/messages/ru.json 🟢 — Полная локализация RU со всеми необходимыми ключами
1️⃣1️⃣ apps/web/src/app/globals.css 🟢 — Глобальные стили
1️⃣2️⃣ apps/web/src/app/[locale]/layout.tsx 🟢 — Полный root layout с i18n provider и генерацией метаданных
1️⃣3️⃣ apps/web/src/app/providers.tsx 🟡 — Next.js Providers wrapper — проксирует AppProviders (TODO: добавить ToastProvider, TelemetryProvider, FeatureFlagsProvider из @livai/app; упростить до прокси AppProviders когда будет создан в @livai/app) + покрыть тестами
1️⃣4️⃣ apps/web/middleware.ts 🟢 — Полная i18n routing middleware с next-intl и правильными исключениями
1️⃣5️⃣ apps/web/public/manifest.json 🟢 — PWA manifest
1️⃣6️⃣ apps/web/src/sw.ts 🟢 — Service Worker TypeScript исходник
1️⃣7️⃣ apps/web/public/sw.js 🟢 — Service Worker JavaScript (генерируется из sw.ts при сборке)
1️⃣8️⃣ apps/web/src/app/sw-register.ts 🟡 — Регистрация Service Worker на клиенте (TODO: интегрировать toast notification system из @livai/app для уведомления пользователя перед перезагрузкой вместо console.log)
1️⃣9️⃣ apps/web/public/favicon.ico 🟢 — Favicon для production
2️⃣0️⃣ apps/web/src/app/icon-192.png/route.ts 🟢 — PWA icon 192x192 (PNG endpoint, генерируется на лету)
2️⃣1️⃣ apps/web/src/app/icon-512.png/route.ts 🟢 — PWA icon 512x512 (PNG endpoint, генерируется на лету)
2️⃣2️⃣ apps/web/src/app/robots.txt/route.ts 🟢 — Robots.txt для SEO (динамический endpoint, env-aware policy, готовность к sitemap)
2️⃣3️⃣ apps/web/src/app/sitemap.xml/route.ts 🟢 — Sitemap для SEO (XML endpoint, генерируется на лету, env-aware policy, i18n поддержка)

✅ UI Core primitives
2️⃣4️⃣ packages/ui-core/src/primitives/button.tsx 🟢 — ts+react — deps: —
2️⃣5️⃣ packages/ui-core/src/primitives/input.tsx 🟢 — ts+react — deps: —
2️⃣6️⃣ packages/ui-core/src/primitives/textarea.tsx 🟢 — ts+react — deps: —
2️⃣7️⃣ packages/ui-core/src/primitives/select.tsx 🟢 — ts+react — deps: —
2️⃣8️⃣ packages/ui-core/src/primitives/checkbox.tsx 🟢 — ts+react — deps: —
2️⃣9️⃣ packages/ui-core/src/primitives/radio.tsx 🟢 — ts+react — deps: —
3️⃣0️⃣ packages/ui-core/src/primitives/toggle.tsx 🟢 — ts+react — deps: —
3️⃣1️⃣ packages/ui-core/src/primitives/icon.tsx 🟢 — ts+react — deps: —
3️⃣2️⃣ packages/ui-core/src/primitives/avatar.tsx 🟢 — ts+react — deps: —
3️⃣3️⃣ packages/ui-core/src/primitives/badge.tsx 🟢 — ts+react — deps: —
3️⃣4️⃣ packages/ui-core/src/primitives/tooltip.tsx 🟢 — ts+react — deps: —
3️⃣5️⃣ packages/ui-core/src/primitives/divider.tsx 🟢 — ts+react — deps: —
3️⃣6️⃣ packages/ui-core/src/primitives/card.tsx 🟢 — ts+react — deps: —
3️⃣7️⃣ packages/ui-core/src/primitives/form-field.tsx 🟢 — ts+react — deps: —
3️⃣8️⃣ packages/ui-core/src/primitives/dialog.tsx 🟢 — ts+react — deps: —
3️⃣9️⃣ packages/ui-core/src/primitives/form.tsx 🟢 — ts+react — deps: —
4️⃣0️⃣ packages/ui-core/src/primitives/loading-spinner.tsx 🟢 — ts+react — deps: —
4️⃣1️⃣ packages/ui-core/src/primitives/dropdown.tsx 🟢 — ts+react — deps: —
4️⃣2️⃣ packages/ui-core/src/primitives/context-menu.tsx 🟢 — ts+react — deps: —
4️⃣3️⃣ packages/ui-core/src/primitives/status-indicator.tsx 🟢 — ts+react — deps: —

✅ UI Core components и types
4️⃣4️⃣ packages/ui-core/src/types/ui.ts 🟢 — ts — deps: —
4️⃣5️⃣ packages/ui-core/src/components/Toast.tsx 🟢 — ts+react — deps: —
4️⃣6️⃣ packages/ui-core/src/components/Skeleton.tsx 🟢 — ts+react — deps: —
4️⃣7️⃣ packages/ui-core/src/components/Modal.tsx 🟢 — ts+react — deps: —
4️⃣8️⃣ packages/ui-core/src/components/Breadcrumbs.tsx 🟢 — ts+react — deps: —
4️⃣9️⃣ packages/ui-core/src/components/Tabs.tsx 🟢 — ts+react — deps: —
5️⃣0️⃣ packages/ui-core/src/components/Accordion.tsx 🟢 — ts+react — deps: —
5️⃣1️⃣ packages/ui-core/src/components/DatePicker.tsx 🟢 — ts+react — deps: —
5️⃣2️⃣ packages/ui-core/src/components/FileUploader.tsx 🟢 — ts+react — deps: —
5️⃣3️⃣ packages/ui-core/src/components/SideBar.tsx 🟢 — ts+react — deps: —
5️⃣4️⃣ packages/ui-core/src/components/SearchBar.tsx 🟢 — ts+react — deps: —
5️⃣5️⃣ packages/ui-core/src/components/ConfirmDialog.tsx 🟢 — ts+react — deps: —
5️⃣6️⃣ packages/ui-core/src/components/ErrorBoundary.tsx 🟢 — ts+react — deps: —
5️⃣7️⃣ packages/ui-core/src/components/UserProfileDisplay.tsx 🟢 — ts+react — deps: —
5️⃣8️⃣ packages/ui-core/src/components/NavigationMenuItem.tsx 🟢 — ts+react — deps: —
5️⃣9️⃣ packages/ui-core/src/components/LanguageSelector.tsx 🟢 — ts+react — deps: —
6️⃣0️⃣ packages/ui-core/src/components/SupportButton.tsx 🟢 — ts+react — deps: —

App types и libs
6️⃣1️⃣ packages/app/src/types/common.ts 🟢 — ts — deps: —
6️⃣2️⃣ packages/app/src/types/api.ts 🟢 — ts deps: types/common.ts
6️⃣3️⃣ packages/app/src/types/errors.ts 🔴 — ts — deps: types/common.ts, types/api.ts (НЕТ)
6️⃣4️⃣ packages/app/src/lib/effect-utils.ts 🟢 — ts+effect — deps: types/common.ts
6️⃣5️⃣ packages/app/src/lib/api-client.ts 🟢 — ts+effect — API client — types/api.ts, effect-utils.ts
6️⃣6️⃣ packages/app/src/lib/websocket.ts 🟢 — ts+effect — deps: lib/effect-utils.ts, types/api.ts, types/errors.ts
6️⃣7️⃣ packages/app/src/lib/sse-client.ts 🟢 — ts+effect — deps: lib/effect-utils.ts, types/api.ts, types/errors.ts
6️⃣8️⃣ packages/app/src/lib/validation.ts 🟢 — ts — deps: types/common.ts, types/errors.ts
6️⃣9️⃣ packages/app/src/lib/error-mapping.ts 🟢 — ts — deps: types/errors.ts, types/common.ts, types/api.ts
7️⃣0️⃣ packages/app/src/lib/api-schema-guard.ts 🔴 — ts+effect — deps: types/api.ts, types/errors.ts, lib/validation.ts (НЕТ)
7️⃣1️⃣ packages/app/src/lib/route-permissions.ts 🔴 — ts — deps: lib/auth-guard.ts, types/common.ts (НЕТ)
7️⃣2️⃣ packages/app/src/lib/auth-guard.ts 🔴 — ts — deps: types/common.ts, lib/error-mapping.ts (НЕТ)
7️⃣3️⃣ packages/app/src/lib/feature-flags.ts 🟢 — ts — deps: types/common.ts
7️⃣4️⃣ packages/app/src/lib/telemetry.ts 🟢 — ts — deps: types/common.ts, types/api.ts
7️⃣5️⃣ packages/app/src/lib/logger.ts 🔴 — ts — deps: types/common.ts, lib/error-mapping.ts, lib/telemetry.ts (НЕТ)
7️⃣6️⃣ packages/app/src/lib/performance.ts 🔴 — ts — deps: lib/telemetry.ts, types/common.ts (НЕТ)
7️⃣7️⃣ packages/app/src/lib/offline-cache.ts 🟢 — ts+effect — deps: lib/effect-utils.ts, types/api.ts
7️⃣8️⃣ packages/app/src/lib/service-worker.ts 🟢 — ts — deps: lib/offline-cache.ts, types/common.ts
7️⃣9️⃣ packages/app/src/lib/i18n.ts 🟢 — ts+react — deps: types/common.ts

✅ App UI wrappers
8️⃣0️⃣ packages/app/src/ui/button.tsx 🟢 — ts+react — deps: ui-core/primitives/button.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣1️⃣ packages/app/src/ui/input.tsx 🟢 — ts+react — deps: ui-core/primitives/input.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣2️⃣ packages/app/src/ui/textarea.tsx 🟢 — ts+react — deps: ui-core/primitives/textarea.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣3️⃣ packages/app/src/ui/select.tsx 🟢 — ts+react — deps: ui-core/primitives/select.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣4️⃣ packages/app/src/ui/checkbox.tsx 🟢 — ts+react — deps: ui-core/primitives/checkbox.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣5️⃣ packages/app/src/ui/radio.tsx 🟢 — ts+react — deps: ui-core/primitives/radio.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣6️⃣ packages/app/src/ui/toggle.tsx 🟢 — ts+react — deps: ui-core/primitives/toggle.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
8️⃣7️⃣ packages/app/src/ui/icon.tsx 🟢 — ts+react — deps: ui-core/primitives/icon.tsx, app/types/common.ts, app/lib/i18n.ts
8️⃣8️⃣ packages/app/src/ui/avatar.tsx 🟢 — ts+react — deps: ui-core/primitives/avatar.tsx, app/types/common.ts, app/lib/i18n.ts
8️⃣9️⃣ packages/app/src/ui/badge.tsx 🟢 — ts+react — deps: ui-core/primitives/badge.tsx, app/types/common.ts, app/lib/i18n.ts
9️⃣0️⃣ packages/app/src/ui/tooltip.tsx 🟢 — ts+react — deps: ui-core/primitives/tooltip.tsx, app/types/common.ts, app/lib/i18n.ts
9️⃣1️⃣ packages/app/src/ui/divider.tsx 🟢 — ts+react — deps: ui-core/primitives/divider.tsx, app/types/common.ts
9️⃣2️⃣ packages/app/src/ui/card.tsx 🟢 — ts+react — deps: ui-core/primitives/card.tsx, app/types/common.ts, app/lib/i18n.ts
9️⃣3️⃣ packages/app/src/ui/dialog.tsx 🟢 — ts+react — deps: ui-core/primitives/dialog.tsx, app/types/common.ts, app/lib/i18n.ts
9️⃣4️⃣ packages/app/src/ui/form.tsx 🟢 — ts+react — deps: ui-core/primitives/form.tsx, ui-core/primitives/form-field.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/i18n.ts
9️⃣5️⃣ packages/app/src/ui/loading-spinner.tsx 🟢 — ts+react — deps: ui-core/primitives/loading-spinner.tsx, app/types/common.ts
9️⃣6️⃣ packages/app/src/ui/dropdown.tsx 🟢 — ts+react — deps: ui-core/primitives/dropdown.tsx, app/types/common.ts, app/lib/i18n.ts
9️⃣7️⃣ packages/app/src/ui/context-menu.tsx 🟢 — ts+react — deps: ui-core/primitives/context-menu.tsx, app/types/common.ts, app/lib/i18n.ts
9️⃣8️⃣ packages/app/src/ui/status-indicator.tsx 🟢 — ts+react — deps: ui-core/primitives/status-indicator.tsx, app/types/common.ts
9️⃣9️⃣ packages/app/src/ui/toast.tsx 🟢 — ts+react — deps: ui-core/components/Toast.tsx, app/types/common.ts, app/lib/i18n.ts
1️⃣0️⃣0️⃣ packages/app/src/ui/skeleton.tsx 🟢 — ts+react — deps: ui-core/components/Skeleton.tsx, app/types/common.ts
1️⃣0️⃣1️⃣ packages/app/src/ui/skeleton-group.tsx 🟢 — ts+react — deps: ui-core/components/Skeleton.tsx, app/types/common.ts
1️⃣0️⃣2️⃣ packages/app/src/ui/modal.tsx 🟢 — ts+react — deps: ui-core/components/Modal.tsx, app/types/common.ts, app/lib/i18n.ts
1️⃣0️⃣3️⃣ packages/app/src/ui/breadcrumbs.tsx 🟢 — ts+react — deps: ui-core/components/Breadcrumbs.tsx, app/types/common.ts
1️⃣0️⃣4️⃣ packages/app/src/ui/tabs.tsx 🟢 — ts+react — deps: ui-core/components/Tabs.tsx, app/types/common.ts
1️⃣0️⃣5️⃣ packages/app/src/ui/accordion.tsx 🟢 — ts+react — deps: ui-core/components/Accordion.tsx, app/types/common.ts
1️⃣0️⃣6️⃣ packages/app/src/ui/date-picker.tsx 🟢 — ts+react — deps: ui-core/components/DatePicker.tsx, app/types/common.ts
1️⃣0️⃣7️⃣ packages/app/src/ui/file-uploader.tsx 🟢 — ts+react — deps: ui-core/components/FileUploader.tsx, app/types/common.ts
1️⃣0️⃣8️⃣ packages/app/src/ui/sidebar.tsx 🟢 — ts+react — deps: ui-core/components/SideBar.tsx, app/types/common.ts
1️⃣0️⃣9️⃣ packages/app/src/ui/search-bar.tsx 🟢 — ts+react — deps: ui-core/components/SearchBar.tsx, app/types/common.ts
1️⃣1️⃣0️⃣ packages/app/src/ui/confirm-dialog.tsx 🟢 — ts+react — deps: ui-core/components/ConfirmDialog.tsx, app/types/common.ts
1️⃣1️⃣1️⃣ packages/app/src/ui/error-boundary.tsx 🟢 — ts+react — deps: ui-core/components/ErrorBoundary.tsx, app/types/common.ts
1️⃣1️⃣2️⃣ packages/app/src/ui/user-profile-display.tsx 🟢 — ts+react — deps: ui-core/components/UserProfileDisplay.tsx, app/types/common.ts
1️⃣1️⃣3️⃣ packages/app/src/ui/navigation-menu-item.tsx 🟢 — ts+react — deps: ui-core/components/NavigationMenuItem.tsx, app/types/common.ts
1️⃣1️⃣4️⃣ packages/app/src/ui/language-selector.tsx 🟢 — ts+react — deps: ui-core/components/LanguageSelector.tsx, app/types/common.ts, app/lib/i18n.ts
1️⃣1️⃣5️⃣ packages/app/src/ui/support-button.tsx 🟢 — ts+react — deps: ui-core/components/SupportButton.tsx, app/types/common.ts, app/lib/feature-flags.ts, app/lib/telemetry.ts

App state и hooks
1️⃣1️⃣6️⃣ packages/app/src/providers/TelemetryProvider.tsx 🔴 — ts+react — Telemetry Provider для batch телеметрии — lib/telemetry.ts (НЕТ)
1️⃣1️⃣7️⃣ packages/app/src/providers/ToastProvider.tsx 🔴 — ts+react — Toast Provider для управления состоянием тостов — ui-core/Toast.tsx (НЕТ)
1️⃣1️⃣8️⃣ packages/app/src/providers/FeatureFlagsProvider.tsx 🔴 — ts+react — Feature Flags Provider для runtime переопределения — lib/feature-flags.ts (НЕТ)
1️⃣1️⃣9️⃣ packages/app/src/state/store.ts 🔴 — ts+zustand — Root store (НЕТ)
1️⃣2️⃣0️⃣ packages/app/src/state/query/query-client.ts 🔴 — ts+react — React query client config (НЕТ)
1️⃣2️⃣1️⃣ packages/app/src/providers/QueryClientProvider.tsx 🔴 — ts+react — QueryClient Provider — state/query/query-client.ts (НЕТ)
1️⃣2️⃣2️⃣ packages/app/src/providers/AppProviders.tsx 🔴 — ts+react — App Providers (композиция всех провайдеров) — providers/TelemetryProvider.tsx, providers/ToastProvider.tsx, providers/FeatureFlagsProvider.tsx, providers/QueryClientProvider.tsx, state/store.ts (НЕТ)
1️⃣2️⃣3️⃣ packages/app/src/bootstrap.ts 🔴 — ts — Единый вход в клиентское приложение — providers/AppProviders.tsx (НЕТ)
1️⃣2️⃣4️⃣ packages/app/src/hooks/useApi.ts 🔴 — ts+react — Hook API — lib/api-client.ts (НЕТ)
1️⃣2️⃣5️⃣ packages/app/src/hooks/useToast.ts 🔴 — ts+react — Hook Toast для программного вызова тостов — providers/ToastProvider.tsx (НЕТ)
1️⃣2️⃣6️⃣ packages/app/src/hooks/useFeatureFlags.ts 🔴 — ts+react — Hook Feature Flags — providers/FeatureFlagsProvider.tsx (НЕТ)
1️⃣2️⃣7️⃣ packages/app/src/hooks/useOfflineCache.ts 🔴 — ts+react — Hook Offline Cache — lib/offline-cache.ts (НЕТ)

Feature Auth
1️⃣2️⃣8️⃣ packages/feature-auth/src/domain/LoginRequest.ts 🔴 — ts — DTO login (НЕТ)
1️⃣2️⃣9️⃣ packages/feature-auth/src/domain/TokenPair.ts 🔴 — ts — DTO token pair (НЕТ)
1️⃣3️⃣0️⃣ packages/feature-auth/src/domain/MeResponse.ts 🔴 — ts — DTO me response (НЕТ)
1️⃣3️⃣1️⃣ packages/feature-auth/src/types/auth.ts 🔴 — ts — Типы auth — domain/* (НЕТ)
1️⃣3️⃣2️⃣ packages/feature-auth/src/stores/auth.ts 🔴 — ts+zustand — Auth store — types/auth.ts (НЕТ)
1️⃣3️⃣3️⃣ packages/feature-auth/src/effects/login.ts 🔴 — ts+effect — Login effect — api-client.ts, types/auth.ts (НЕТ)
1️⃣3️⃣4️⃣ packages/feature-auth/src/effects/logout.ts 🔴 — ts+effect — Logout effect — api-client.ts (НЕТ)
1️⃣3️⃣5️⃣ packages/feature-auth/src/effects/refresh.ts 🔴 — ts+effect — Refresh effect — api-client.ts (НЕТ)
1️⃣3️⃣6️⃣ packages/feature-auth/src/hooks/useAuth.ts 🔴 — ts+react — Hook auth — stores/auth.ts, effects/* (НЕТ)
1️⃣3️⃣7️⃣ packages/feature-auth/src/schemas.ts 🟢 — схемы на базе core-contracts (реализован полностью)

Feature Bots
1️⃣3️⃣8️⃣ packages/feature-bots/src/domain/Bot.ts 🔴 — ts — Bot entity (НЕТ)
1️⃣3️⃣9️⃣ packages/feature-bots/src/domain/BotTemplate.ts 🔴 — ts — Bot template (НЕТ)
1️⃣4️⃣0️⃣ packages/feature-bots/src/domain/Prompt.ts 🔴 — ts — Prompt entity (НЕТ)
1️⃣4️⃣1️⃣ packages/feature-bots/src/types/bots.ts 🔴 — ts — Типы bots — domain/* (НЕТ)
1️⃣4️⃣2️⃣ packages/feature-bots/src/stores/bots.ts 🔴 — ts+zustand — Bots store — types/bots.ts (НЕТ)
1️⃣4️⃣3️⃣ packages/feature-bots/src/effects/createBot.ts 🔴 — ts+effect — Create bot — api-client.ts, stores/bots.ts (НЕТ)
1️⃣4️⃣4️⃣ packages/feature-bots/src/effects/updateBot.ts 🔴 — ts+effect — Update bot — api-client.ts, stores/bots.ts (НЕТ)
1️⃣4️⃣5️⃣ packages/feature-bots/src/effects/deleteBot.ts 🔴 — ts+effect — Delete bot — api-client.ts, stores/bots.ts (НЕТ)
1️⃣4️⃣6️⃣ packages/feature-bots/src/hooks/useBots.ts 🔴 — ts+react — Hook bots list — stores/bots.ts, effects/* (НЕТ)
1️⃣4️⃣7️⃣ packages/feature-bots/src/hooks/useBotWizard.ts 🔴 — ts+react — Hook bot wizard — stores/bots.ts, effects/* (НЕТ)

Feature Chat
1️⃣4️⃣8️⃣ packages/feature-chat/src/domain/Message.ts 🔴 — ts — Message entity (НЕТ)
1️⃣4️⃣9️⃣ packages/feature-chat/src/domain/Conversation.ts 🔴 — ts — Conversation entity (НЕТ)
1️⃣5️⃣0️⃣ packages/feature-chat/src/types/chat.ts 🔴 — ts — Типы chat — domain/* (НЕТ)
1️⃣5️⃣1️⃣ packages/feature-chat/src/stores/chat.ts 🔴 — ts+zustand — Chat store — types/chat.ts (НЕТ)
1️⃣5️⃣2️⃣ packages/feature-chat/src/effects/sendMessage.ts 🔴 — ts+effect — Send message effect — api-client.ts, stores/chat.ts (НЕТ)
1️⃣5️⃣3️⃣ packages/feature-chat/src/effects/connectWebSocket.ts 🔴 — ts+effect — WebSocket connect — websocket.ts, stores/chat.ts (НЕТ)
1️⃣5️⃣4️⃣ packages/feature-chat/src/hooks/useChat.ts 🔴 — ts+react — Hook chat — stores/chat.ts, effects/* (НЕТ)
1️⃣5️⃣5️⃣ packages/feature-chat/src/hooks/useRealTime.ts 🔴 — ts+react — Hook real-time — effects/connectWebSocket.ts (НЕТ)

UI Features — Auth
1️⃣5️⃣6️⃣ packages/ui-features/src/auth/login-form.tsx 🟢 — ts+react — Login form UI
1️⃣5️⃣7️⃣ packages/ui-features/src/auth/register-form.tsx 🟢 — ts+react — Register form UI
1️⃣5️⃣8️⃣ packages/ui-features/src/auth/WorkspaceForm.tsx 🔴 — ts+react — Workspace form UI (НЕТ)
1️⃣5️⃣9️⃣ packages/ui-features/src/auth/OnboardingFlow.tsx 🔴 — ts+react — Onboarding flow (НЕТ)
1️⃣6️⃣0️⃣ packages/ui-features/src/auth/TwoFactorAuth.tsx 🔴 — ts+react — Two factor auth UI (НЕТ)

UI Features — Bots
1️⃣6️⃣1️⃣ packages/ui-features/src/bots/BotDashboard.tsx 🔴 — ts+react — Bots dashboard (НЕТ)
1️⃣6️⃣2️⃣ packages/ui-features/src/bots/BotWizardFlow.tsx 🔴 — ts+react+effect — Bot wizard flow (НЕТ)
1️⃣6️⃣3️⃣ packages/ui-features/src/bots/BotTemplateSelector.tsx 🔴 — ts+react — Template selector (НЕТ)
1️⃣6️⃣4️⃣ packages/ui-features/src/bots/BotBasicForm.tsx 🔴 — ts+react — Bot basic form (НЕТ)
1️⃣6️⃣5️⃣ packages/ui-features/src/bots/PromptEditor.tsx 🔴 — ts+react+effect — Prompt editor (НЕТ)
1️⃣6️⃣6️⃣ packages/ui-features/src/bots/PromptBlocks.tsx 🔴 — ts+react — Prompt blocks (НЕТ)
1️⃣6️⃣7️⃣ packages/ui-features/src/bots/PromptPreview.tsx 🔴 — ts+react — Prompt preview (НЕТ)
1️⃣6️⃣8️⃣ packages/ui-features/src/bots/BotCard.tsx 🔴 — ts+react — Compact bot card for list view (НЕТ)
1️⃣6️⃣9️⃣ packages/ui-features/src/bots/BotDetailCard.tsx 🔴 — ts+react — Detailed bot card with creator info (НЕТ)
1️⃣7️⃣0️⃣ packages/ui-features/src/bots/SubscriptionStatusBadge.tsx 🔴 — ts+react — Subscription status badge (active/inactive) (НЕТ)
1️⃣7️⃣1️⃣ packages/ui-features/src/bots/CreatorInfo.tsx 🔴 — ts+react — Creator information component (НЕТ)
1️⃣7️⃣2️⃣ packages/ui-features/src/bots/ContactButton.tsx 🔴 — ts+react — Contact creator button (НЕТ)
1️⃣7️⃣3️⃣ packages/ui-features/src/bots/BotListItem.tsx 🔴 — ts+react — Bot list item for sidebar/list (НЕТ)

UI Features — Chat + Pages
1️⃣7️⃣4️⃣ packages/ui-features/src/chat/ChatInterface.tsx 🔴 — ts+react+effect — Chat interface (НЕТ)
1️⃣7️⃣5️⃣ packages/ui-features/src/chat/MessageBubble.tsx 🔴 — ts+react — Message bubble (НЕТ)
1️⃣7️⃣6️⃣ packages/ui-features/src/chat/ChatInput.tsx 🔴 — ts+react — Chat input (НЕТ)
1️⃣7️⃣7️⃣ packages/ui-features/src/chat/TypingIndicator.tsx 🔴 — ts+react — Typing indicator (НЕТ)
1️⃣7️⃣8️⃣ packages/ui-features/src/chat/MessageStatus.tsx 🔴 — ts+react — Message status (НЕТ)
1️⃣7️⃣9️⃣ packages/ui-features/src/chat/Attachments.tsx 🔴 — ts+react — Attachments (НЕТ)
1️⃣8️⃣0️⃣ packages/ui-features/src/chat/AttachmentsDragDrop.tsx 🔴 — ts+react — Drag & Drop для attachments (НЕТ)
1️⃣8️⃣1️⃣ packages/ui-features/src/chat/ChatHistory.tsx 🔴 — ts+react — Chat history (НЕТ)
1️⃣8️⃣2️⃣ packages/ui-features/src/chat/ChatListPanel.tsx 🔴 — ts+react — Chat list sidebar panel (НЕТ)
1️⃣8️⃣3️⃣ packages/ui-features/src/chat/ChatListHeader.tsx 🔴 — ts+react — Chat list header with advanced mode toggle (НЕТ)
1️⃣8️⃣4️⃣ packages/ui-features/src/chat/CreateChatButton.tsx 🔴 — ts+react — Create test chat button (НЕТ)
1️⃣8️⃣5️⃣ packages/ui-features/src/chat/AIAgentStatusToggle.tsx 🔴 — ts+react — AI agent active/inactive toggle (НЕТ)
1️⃣8️⃣6️⃣ packages/ui-features/src/chat/ChatActionButtons.tsx 🔴 — ts+react — Chat action buttons (share, copy, edit) (НЕТ)
1️⃣8️⃣7️⃣ packages/ui-features/src/chat/MessageInputBar.tsx 🔴 — ts+react+effect — Message input bar with attachments, voice, AI assist (НЕТ)
1️⃣8️⃣8️⃣ packages/ui-features/src/chat/AdvancedModeToggle.tsx 🔴 — ts+react — Advanced mode toggle switch (НЕТ)

UI Features — Admin/Dashboard
1️⃣8️⃣9️⃣ packages/ui-features/src/admin/DataTable.tsx 🔴 — ts+react — Data table (НЕТ)
1️⃣9️⃣0️⃣ packages/ui-features/src/admin/Pagination.tsx 🔴 — ts+react — Pagination (НЕТ)
1️⃣9️⃣1️⃣ packages/ui-features/src/admin/FiltersPanel.tsx 🔴 — ts+react — Filters panel (НЕТ)
1️⃣9️⃣2️⃣ packages/ui-features/src/admin/StatCard.tsx 🔴 — ts+react — Stat card (НЕТ)
1️⃣9️⃣3️⃣ packages/ui-features/src/admin/Chart.tsx 🔴 — ts+react — Chart/Graph (НЕТ)
1️⃣9️⃣4️⃣ packages/ui-features/src/admin/LogsViewer.tsx 🔴 — ts+react — Logs viewer (НЕТ)
1️⃣9️⃣5️⃣ packages/ui-features/src/admin/UserRoleBadge.tsx 🔴 — ts+react — User role badge (НЕТ)
1️⃣9️⃣6️⃣ packages/ui-features/src/admin/EmptyState.tsx 🔴 — ts+react — Empty state component with icon and message (НЕТ)
1️⃣9️⃣7️⃣ packages/ui-features/src/admin/DateRangePicker.tsx 🔴 — ts+react — Date range picker component (НЕТ)
1️⃣9️⃣8️⃣ packages/ui-features/src/admin/FilterDropdown.tsx 🔴 — ts+react — Filter dropdown component (НЕТ)

UI Features — Billing/Payments/Balance
1️⃣9️⃣9️⃣ packages/ui-features/src/billing/PricingCard.tsx 🔴 — ts+react — Pricing card (НЕТ)
2️⃣0️⃣0️⃣ packages/ui-features/src/billing/InvoiceTable.tsx 🔴 — ts+react — Invoice table (НЕТ)
2️⃣0️⃣1️⃣ packages/ui-features/src/billing/PaymentMethod.tsx 🔴 — ts+react — Payment method (НЕТ)
2️⃣0️⃣2️⃣ packages/ui-features/src/billing/BillingHistory.tsx 🔴 — ts+react — Billing history (НЕТ)
2️⃣0️⃣3️⃣ packages/ui-features/src/billing/SubscriptionStatus.tsx 🔴 — ts+react — Subscription status (НЕТ)
2️⃣0️⃣4️⃣ packages/ui-features/src/billing/BalanceDisplay.tsx 🔴 — ts+react — Balance card for sidebar (НЕТ)
2️⃣0️⃣5️⃣ packages/ui-features/src/billing/BotStatusIndicator.tsx 🔴 — ts+react — Bot status indicator (blocked/active) (НЕТ)
2️⃣0️⃣6️⃣ packages/ui-features/src/billing/TransactionHistoryTable.tsx 🔴 — ts+react — Transaction history table with tabs (НЕТ)
2️⃣0️⃣7️⃣ packages/ui-features/src/billing/UsageGraph.tsx 🔴 — ts+react+effect — Usage statistics graph/chart (НЕТ)
2️⃣0️⃣8️⃣ packages/ui-features/src/billing/StatSummaryCards.tsx 🔴 — ts+react — Summary cards (today/yesterday/week expenses) (НЕТ)
2️⃣0️⃣9️⃣ packages/ui-features/src/billing/PaymentModal.tsx 🔴 — ts+react — Payment modal with method tabs (НЕТ)
2️⃣1️⃣0️⃣ packages/ui-features/src/billing/AmountInput.tsx 🔴 — ts+react — Amount input with validation and hints (НЕТ)
2️⃣1️⃣1️⃣ packages/ui-features/src/billing/TeamMemberSelector.tsx 🔴 — ts+react — Team member count selector (НЕТ)
2️⃣1️⃣2️⃣ packages/ui-features/src/billing/OrganizationFormFields.tsx 🔴 — ts+react — Organization details form fields (НЕТ)
2️⃣1️⃣3️⃣ packages/ui-features/src/billing/DocumentUploadSection.tsx 🔴 — ts+react — Document upload section for billing (НЕТ)

UI Features — PWA/Security
2️⃣1️⃣4️⃣ packages/ui-features/src/pwa/InstallPrompt.tsx 🔴 — ts+react — Install prompt (НЕТ)
2️⃣1️⃣5️⃣ packages/ui-features/src/pwa/OfflineIndicator.tsx 🔴 — ts+react — Offline indicator (НЕТ)
2️⃣1️⃣6️⃣ packages/ui-features/src/pwa/UpdateNotification.tsx 🔴 — ts+react — Update notification (НЕТ)
2️⃣1️⃣7️⃣ packages/ui-features/src/security/PermissionsTable.tsx 🔴 — ts+react — Permissions table (НЕТ)

UI Features — Marketplace
2️⃣1️⃣8️⃣ packages/ui-features/src/marketplace/MarketplaceCard.tsx 🔴 — ts+react — Marketplace application/bot card (НЕТ)
2️⃣1️⃣9️⃣ packages/ui-features/src/marketplace/CategoryTabs.tsx 🔴 — ts+react — Category filter tabs (НЕТ)
2️⃣2️⃣0️⃣ packages/ui-features/src/marketplace/MarketplaceSearch.tsx 🔴 — ts+react — Marketplace search bar (НЕТ)

Web Pages
2️⃣2️⃣1️⃣ apps/web/src/app/[locale]/page.tsx 🟢 — Полная главная страница с i18n и навигацией (больше чем каркас)
2️⃣2️⃣2️⃣ apps/web/src/app/[locale]/dashboard/page.tsx 🟡 — Каркас dashboard с skeleton loading, accessibility и TODO для реальных виджетов/данных
2️⃣2️⃣3️⃣ apps/web/src/app/[locale]/auth/login/page.tsx 🟡 — Каркас login страницы с ui-features композитором и TODO для реального auth flow
2️⃣2️⃣4️⃣ apps/web/src/app/[locale]/auth/register/page.tsx 🟡 — Каркас register страницы с ui-features композитором и TODO для реального auth flow
2️⃣2️⃣5️⃣ apps/web/src/app/[locale]/bots/page.tsx 🔴 — Bots page with BotDashboard (НЕТ)
2️⃣2️⃣6️⃣ apps/web/src/app/[locale]/balance/page.tsx 🔴 — Balance page with tabs and billing components (НЕТ)
2️⃣2️⃣7️⃣ apps/web/src/app/[locale]/marketplace/page.tsx 🔴 — Marketplace page with category tabs and cards (НЕТ)
2️⃣2️⃣8️⃣ apps/web/src/app/[locale]/chat/page.tsx 🔴 — Chat page with ChatInterface and ChatListPanel (НЕТ)
2️⃣2️⃣9️⃣ apps/web/src/app/[locale]/analytics/page.tsx 🔴 — Analytics page with charts and filters (НЕТ)
2️⃣3️⃣0️⃣ apps/web/src/app/[locale]/history/page.tsx 🔴 — History page with filters and data table (НЕТ)
2️⃣3️⃣1️⃣ apps/web/src/app/[locale]/mailings/page.tsx 🔴 — Mailings page with filters and table (НЕТ)
2️⃣3️⃣2️⃣ apps/web/src/app/[locale]/not-found.tsx 🔴 — Custom 404 error page (НЕТ)
2️⃣3️⃣3️⃣ apps/web/src/app/[locale]/error.tsx 🔴 — Custom 500 error page (НЕТ)
2️⃣3️⃣4️⃣ apps/web/src/app/global-error.tsx 🔴 — App-level error boundary для Next.js 16+ (НЕТ)

---

**🏗️ Архитектурные слои после реализации**

### **1️⃣ Product Layer** (то, что видит пользователь)

**Bots:** шаблоны, визард создания, prompt editor, preview, статус, подписки, биллинг\
**Chat:** real-time, SSE/WebSocket, history, attachments, AI agent toggle\
**Marketplace:** карточки, категории, поиск\
**Billing:** usage, balance, subscriptions\
**Admin:** logs, charts, tables\
**PWA:** offline, update, install

### **2️⃣ Platform Layer** (то, что позволяет строить ботов)

**Создание ботов:** feature-bots/domain, BotTemplate\
**RAG настройка:** Prompt blocks, Prompt editor, Domain entities\
**Real-time:** WebSocket/SSE каналы, offline cache\
**AI агент:** переключение on/off

→ **Фундамент под:** RAG pipelines, Tool calling, Webhooks, бизнес-автоматизацию, интеграции (CRM, Notion, Slack, Telegram, Stripe, HubSpot)

### **3️⃣ Infra Layer** (то, что превращает проект в платформу)

**Effect runtime:** оркестратор side effects\
**API:** typed client, schema guards, error model\
**Observability:** telemetry, feature flags\
**PWA:** offline, service worker\
**Security:** auth-guard, permissions\
**Config:** env system

### **4️⃣ Developer Experience Layer**

**Monorepo:** domain-driven features, независимые пакеты\
**UI:** core primitives + features, hooks façade\
**Bootstrap:** единые providers, i18n, env typing\
**Архитектура:** app слой общий, feature-пакеты автономны

**Следующие шаги после Фазы 2:**

- **Фаза 2.1 (Примитивы)**: Реализовать недостающие UI primitives (textarea, select, checkbox, radio, toggle, icon, avatar, badge, tooltip, divider, skeleton)
- **Фаза 2.2 (Core компоненты)**: Создать UI components (Toast, Modal, Breadcrumbs, Tabs, Accordion, DatePicker, FileUploader) + app/ui wrappers
- **Фаза 2.3 (App слой)**: Реализовать packages/app (store, hooks, провайдеры, остальные типы/libs)
- **Фаза 2.4 (Feature логика)**: Достроить packages/feature-auth (effects, stores, domain), feature-bots, feature-chat
- **Фаза 2.5 (UI Features)**: Реализовать все ui-features компоненты (Chat, Admin, Billing, PWA, Security, Marketplace) - 60+ файлов
- **Фаза 2.6 (Интеграция)**: Подключить все компоненты к страницам и протестировать end-to-end сценарии
