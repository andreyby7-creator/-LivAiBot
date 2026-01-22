# 🚀 **ПЛАН РЕАЛИЗАЦИИ ФАЗЫ 2 — UI (Web + PWA)** ✅ **ЧАСТИЧНО РЕАЛИЗОВАНА**

## ✨ **ОБНОВЛЕННЫЙ ПЛАН С КОРРЕКТНОЙ ПОСЛЕДОВАТЕЛЬНОСТЬЮ РЕАЛИЗАЦИИ**

**🔄 Версии пакетов проверены и актуальны на январь 2026 года**

**⚠️ Важно:** Используем **Zod 4.x** (мажорная версия с улучшенной производительностью) и **Effect 3.x** (единая библиотека)

**📦 Стандарты пакетов:** Все новые пакеты унифицированы со структурой `packages/core-contracts`

## **📊 ТЕКУЩИЙ СТАТУС РЕАЛИЗАЦИИ (январь 2026):**

### **✅ ПОЛНОСТЬЮ РЕАЛИЗОВАНО:**

- **apps/web**: Каркас Next.js приложения с i18n routing ✅
- **packages/ui-core**: Button, Input, FormField компоненты ✅
- **packages/ui-shared**: Zod resolver, validation, i18n утилиты ✅
- **packages/ui-features**: LoginForm, RegisterForm с RHF + Zod ✅
- **packages/feature-auth**: Zod schemas для login/register ✅

### **🟡 НЕ РЕАЛИЗОВАНО:**

- **packages/app**: Zustand store, hooks, провайдеры 🟡
- **packages/ui-core**: 19 недостающих примитивов + 7 компонентов 🟡
- **packages/ui-features**: Chat, Admin, Billing, PWA, Security компоненты 🟡
- **packages/feature-***: Вся бизнес-логика (auth, bots, chat) 🟡

### **🎯 ПРОЦЕНТ ГОТОВНОСТИ: ~25%**

- UI инфраструктура: ✅ Готова
- Auth flow: ✅ Базовый
- Core UI компоненты: ✅ Частично (5/24 примитивов)
- Feature компоненты: 🟡 Требуют реализации
- Admin/Billing/PWA: 🔴 Не реализованы

---

**🏗️ Архитектура Фазы 2:** базовый набор пакетов создан, часть будет расширяться по мере реализации Фазы 2:

#### **UI пакеты (4):**

- 🟡 `@livai/ui-tokens` - дизайн токены (цвета, типографика, spacing) — НЕ РЕАЛИЗОВАНО
- ✅ `@livai/ui-shared` - общие UI утилиты (i18n типы/адаптеры, mapping ошибок Zod→RHF, helpers) — РЕАЛИЗОВАНО
- 🟡 `@livai/ui-core` - атомарные UI компоненты (24 примитива + 7 компонентов) — РЕАЛИЗОВАНО (5/31)
- 🟡 `@livai/ui-features` - составные UI экраны (Auth, Chat, Admin, Billing, PWA) — РЕАЛИЗОВАНО (2/27)

#### **Feature пакеты (3):**

- ✅ `@livai/feature-auth` - auth контракты формы (схемы на базе core-contracts) — РЕАЛИЗОВАНО (частично)
- 🟡 `@livai/feature-bots` - бизнес-логика ботов — НЕ РЕАЛИЗОВАНО
- 🟡 `@livai/feature-chat` - бизнес-логика чата — НЕ РЕАЛИЗОВАНО

#### **App пакет (1):**

- 🟡 `@livai/app` - Next.js композиция (ТОЛЬКО intl provider) — НЕ РЕАЛИЗОВАНО

**Особое внимание уделено разделению стеков:**

- **ts+react** - чистая UI логика (рендеринг, формы, навигация)
- **ts+react+effect** - UI с side effects (real-time, async operations, API calls)
- **ts+effect** - инфраструктура (WebSocket, caching, сервисы)

**Это позволяет сразу видеть сложность каждого файла и правильно распределять работу между разработчиками.**

**⚠️ Важно:** Перед стартом выполнить чеклист технических проверок (lazy-loading, offline caching, Zod sync).

**Гибридный подход к DTO гарантирует:**

- **100% соответствие** backend для стандартных API
- **Максимальную гибкость** для complex форм с side effects

**Важные pre-launch проверки:**

- 🔄 **Lazy-loading + i18n** - без мерцаний переводов
- 💾 **Offline caching** - localStorage + IndexedDB для тест-чата (внедрять после всех пользователей)
- 🔗 **Zod автогенерация** - синхронизация с backend OpenAPI
- 🌐 **WebSocket + SSE fallback** - тестировать на всех страницах с реальным трафиком
- 🚩 **Feature flags + optimistic UI** - для постепенного rollout и лучшего UX

**Встроены все полезные архитектурные улучшения (версии актуальны на январь 2026):**

- 🏗️ **Строгая типизация** (common.ts vs feature-specific)
- 🔧 **Services в shared/lib** (WebSocket + SSE, utilities)
- 🎛️ **Единый root store** (Zustand 5.1+ + middleware)
- 🚩 **Feature flags** (пошаговый rollout)
- 🌍 **i18n с первого дня** (русский + английский, без мерцаний) — `next-intl` (App Router-friendly)
- ⚠️ **Централизованная обработка ошибок**
- 🔄 **Lazy loading** для тяжелых компонентов
- ⚡ **Optimistic UI** для лучшего UX
- 🦴 **Skeleton loaders** для загрузок
- 💾 **Offline caching** (localStorage + IndexedDB)
- 🤖 **Playwright 1.57+ E2E** для critical flows
- 🔧 **CI/CD** (TypeScript strict + ESLint 9.39+ + Dprint 0.50+)
- 🎭 **Effect ecosystem** (effect 3.17+)
- 🌐 **Real-time** (WebSocket основной + SSE fallback)
- 📋 **Явное разделение стеков** (ts+react чистый UI vs ts+react+effect с side effects)
- 📦 **Унифицированные пакеты** (все packages/ следуют core-contracts стандарту)
- 🔄 **Гибридные DTO** (автогенерация Zod 4.x для CRUD + Effect shim для complex forms)

### **🎯 ЦЕЛИ ФАЗЫ 2 (АРХИТЕКТУРА + ФУНКЦИОНАЛЬНОСТЬ):**

#### **Этап 2.1: Создание архитектуры пакетов (ОБНОВЛЕННАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ)**

- **Создать пакеты в правильной последовательности зависимостей:**

  1. **@livai/ui-core** - атомарные UI компоненты (24 примитива + 7 компонентов)
     - Почему: все UI-features используют эти компоненты как основу
     - Проверка: компоненты визуально готовы, типизированы и доступны
     - **Примитивы**: Button, Input, Textarea, Select, Checkbox, Radio, Toggle, Icon, Avatar, Badge, Tooltip, Divider, FormField, Dialog, Form
     - **Компоненты**: Toast, Skeleton, Modal, Breadcrumbs, Tabs, Accordion, DatePicker, FileUploader

  2. **@livai/ui-shared** - утилиты и сервисы для UI (WebSocket, SSE, offline caching, i18n, effect-utils)
     - Почему: инфраструктурный слой для эффектов и feature-пакетов
     - Проверка: сервисы корректно работают с mock API
     - **Важно:** offline caching и effect-utils внедрять ПОСЛЕ всех, кто их использует (чтобы избежать ранних ошибок зависимостей)
     - **Тестирование:** WebSocket + SSE fallback тестировать на всех страницах с реальным трафиком для гарантии корректного fallback

  3. **@livai/app** - root store, hooks, провайдеры (Zustand store, query-client, useAuth/useBots/useChat)
     - Почему: все feature-пакеты используют эти hooks и store
     - Проверка: store и hooks работают с текущим api-gateway
     - **Включено:** feature flags для постепенного rollout + optimistic UI для лучшего UX

  4. **Feature-пакеты:**
     - `@livai/feature-auth` - бизнес-логика аутентификации (Login/Register forms, workspace creation)
     - `@livai/feature-bots` - бизнес-логика ботов (CRUD, BotWizardFlow, PromptEditor)
     - `@livai/feature-chat` - бизнес-логика чата (ChatInterface, WebSocket, offline caching)

  5. **@livai/ui-features** - составные UI экраны (27 компонентов)
     - Почему: используют feature-пакеты + ui-core для комплексных интерфейсов
     - Проверка: экраны корректно интегрируют бизнес-логику и поддерживают все сценарии
     - **Auth**: LoginForm, RegisterForm, WorkspaceForm, OnboardingFlow, TwoFactorAuth
     - **Bots**: BotDashboard, BotWizardFlow, BotTemplateSelector, BotBasicForm, PromptEditor, PromptBlocks, PromptPreview
     - **Chat**: ChatInterface, MessageBubble, ChatInput, TypingIndicator, MessageStatus, Attachments, ChatHistory
     - **Admin**: DataTable, Pagination, FiltersPanel, StatCard, Chart, LogsViewer, UserRoleBadge
     - **Billing**: PricingCard, InvoiceTable, PaymentMethod, BillingHistory, SubscriptionStatus
     - **PWA/Security**: InstallPrompt, OfflineIndicator, UpdateNotification, PermissionsTable

- **Настроить зависимости** между пакетами (peerDependencies, workspace протоколы)
- **Мигрировать apps/web** в тонкий композитор слоев

#### **Этап 2.2: Функциональная разработка**

1. **apps/web/src/app/[locale]/layout.tsx** - Root layout (i18n provider, навигация/провайдеры)
2. **Страницы с навигационным каркасом:**
   - Dashboard, Knowledge, Channels, Dialogs, Billing, Team, Settings (каркас)
   - `[locale]/auth/login` и `[locale]/auth/register` → feature-auth + ui-features/auth
   - bots → feature-bots + ui-features/bots
   - chat → feature-chat + ui-features/chat
3. **Критерии:** через `api-gateway`, DTO согласованы, все через feature + ui-features

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

✅ Web базовые файлы и i18n
1️⃣ apps/web/package.json 🟢 — Полная реализация Next.js приложения с зависимостями (next-intl, react-hook-form, zod, workspace пакеты)
2️⃣ apps/web/tsconfig.json 🟢 — Полная TS конфигурация с paths на workspace packages и правильными настройками для Next.js
3️⃣ apps/web/next.config.mjs 🟢 — Полная Next.js конфигурация с настройками безопасности, изображений и webpack
4️⃣ apps/web/i18n/i18n.config.json 🟢 — Конфигурация локалей
5️⃣ apps/web/i18n/routing.ts 🟢 — Полная конфигурация локалей с типами TypeScript
6️⃣ apps/web/i18n/request.ts 🟢 — Полная next-intl request config с загрузкой сообщений и type guards
7️⃣ apps/web/messages/en.json 🟢 — Полная локализация EN со всеми необходимыми ключами
8️⃣ apps/web/messages/ru.json 🟢 — Полная локализация RU со всеми необходимыми ключами
9️⃣ apps/web/src/app/globals.css 🟢 — Глобальные стили
1️⃣0️⃣ apps/web/src/app/[locale]/layout.tsx 🟢 — Полный root layout с i18n provider и генерацией метаданных
1️⃣1️⃣ apps/web/middleware.ts 🟢 — Полная i18n routing middleware с next-intl и правильными исключениями

✅ UI Core primitives
1️⃣2️⃣ packages/ui-core/src/primitives/button.tsx 🟢 — ts+react — Button UI
1️⃣3️⃣ packages/ui-core/src/primitives/input.tsx 🟢 — ts+react — Input UI
1️⃣4️⃣ packages/ui-core/src/primitives/textarea.tsx 🟢 — ts+react — Textarea UI
1️⃣5️⃣ packages/ui-core/src/primitives/select.tsx 🟢 — ts+react — Select/Dropdown UI
1️⃣6️⃣ packages/ui-core/src/primitives/checkbox.tsx 🟢 — ts+react — Checkbox UI
1️⃣7️⃣ packages/ui-core/src/primitives/radio.tsx 🟢 — ts+react — Radio button UI
1️⃣8️⃣ packages/ui-core/src/primitives/toggle.tsx 🟢 — ts+react — Toggle/Switch UI
1️⃣9️⃣ packages/ui-core/src/primitives/icon.tsx 🟢 — ts+react — Icon UI
2️⃣0️⃣ packages/ui-core/src/primitives/avatar.tsx 🟢 — ts+react — Avatar UI
2️⃣1️⃣ packages/ui-core/src/primitives/badge.tsx 🔴 — ts+react — Badge UI
2️⃣2️⃣ packages/ui-core/src/primitives/tooltip.tsx 🔴 — ts+react — Tooltip UI (НЕТ)
2️⃣3️⃣ packages/ui-core/src/primitives/divider.tsx 🔴 — ts+react — Divider UI (НЕТ)
2️⃣4️⃣ packages/ui-core/src/primitives/form-field.tsx 🟢 — ts+react — Form Field UI
2️⃣5️⃣ packages/ui-core/src/primitives/dialog.tsx 🟢 — ts+react — Dialog UI
2️⃣6️⃣ packages/ui-core/src/primitives/form.tsx 🟢 — ts+react — Form UI

✅ App types и libs
1️⃣7️⃣ packages/app/src/types/common.ts 🟢 — ts — Общие типы для всего приложения
1️⃣8️⃣ packages/app/src/types/api.ts 🟢 — ts — Базовые типы API
1️⃣9️⃣ packages/app/src/lib/effect-utils.ts 🟢 — ts+effect — Effect helpers
2️⃣0️⃣ packages/app/src/lib/api-client.ts 🟢 — ts+effect — API client — types/api.ts, effect-utils.ts
2️⃣1️⃣ packages/app/src/lib/websocket.ts 🟢 — ts+effect — WebSocket client — effect-utils.ts
2️⃣2️⃣ packages/app/src/lib/sse-client.ts 🟢 — ts+effect — SSE client — effect-utils.ts
2️⃣3️⃣ packages/app/src/lib/validation.ts 🟢 — ts — Validation utils — types/*
2️⃣4️⃣ packages/app/src/lib/error-mapping.ts 🟢 — ts — Mapping ошибок — types/*
2️⃣5️⃣ packages/app/src/lib/feature-flags.ts 🟢 — ts — Feature flags — types/*
2️⃣6️⃣ packages/app/src/lib/telemetry.ts 🟢 — ts — Telemetry — types/*
2️⃣7️⃣ packages/app/src/lib/offline-cache.ts 🟢 — ts+effect — Offline caching — effect-utils.ts
2️⃣8️⃣ packages/app/src/lib/i18n.ts 🟢 — ts+react — i18n utils — types/*

App UI wrappers
2️⃣7️⃣ packages/app/src/ui/button.tsx 🟢 — ts+react — UI wrapper Button — ui-core/Button.tsx
2️⃣8️⃣ packages/app/src/ui/input.tsx 🟢 — ts+react — UI wrapper Input — ui-core/Input.tsx
2️⃣9️⃣ packages/app/src/ui/textarea.tsx 🟢 — ts+react — UI wrapper Textarea — ui-core/Textarea.tsx
3️⃣0️⃣ packages/app/src/ui/select.tsx 🟢 — ts+react — UI wrapper Select — ui-core/Select.tsx
3️⃣1️⃣ packages/app/src/ui/checkbox.tsx 🟢 — ts+react — UI wrapper Checkbox — ui-core/Checkbox.tsx
3️⃣2️⃣ packages/app/src/ui/radio.tsx 🟢 — ts+react — UI wrapper Radio — ui-core/Radio.tsx
3️⃣3️⃣ packages/app/src/ui/toggle.tsx 🟢 — ts+react — UI wrapper Toggle — ui-core/Toggle.tsx
3️⃣4️⃣ packages/app/src/ui/icon.tsx 🟢 — ts+react — UI wrapper Icon — ui-core/Icon.tsx
3️⃣5️⃣ packages/app/src/ui/avatar.tsx 🟢 — ts+react — UI wrapper Avatar — ui-core/Avatar.tsx
3️⃣6️⃣ packages/app/src/ui/badge.tsx 🔴 — ts+react — UI wrapper Badge — ui-core/Badge.tsx
3️⃣7️⃣ packages/app/src/ui/tooltip.tsx 🔴 — ts+react — UI wrapper Tooltip — ui-core/Tooltip.tsx (НЕТ)
3️⃣8️⃣ packages/app/src/ui/divider.tsx 🔴 — ts+react — UI wrapper Divider — ui-core/Divider.tsx (НЕТ)
3️⃣9️⃣ packages/app/src/ui/card.tsx 🟢 — ts+react — UI wrapper Card — ui-core/Card.tsx
4️⃣0️⃣ packages/app/src/ui/dialog.tsx 🟢 — ts+react — UI wrapper Dialog — ui-core/Dialog.tsx
4️⃣1️⃣ packages/app/src/ui/form.tsx 🟢 — ts+react — UI wrapper Form — ui-core/Form.tsx
4️⃣2️⃣ packages/app/src/ui/toast.tsx 🔴 — ts+react — UI wrapper Toast — ui-core/Toast.tsx
4️⃣3️⃣ packages/app/src/ui/sidebar.tsx 🔴 — ts+react — Sidebar (НЕТ)
4️⃣4️⃣ packages/app/src/ui/loading-spinner.tsx 🔴 — ts+react — Loading Spinner (НЕТ)
4️⃣5️⃣ packages/app/src/ui/search-bar.tsx 🔴 — ts+react — Search Bar (НЕТ)

App state и hooks
4️⃣6️⃣ packages/app/src/state/store.ts 🔴 — ts+zustand — Root store (НЕТ)
4️⃣7️⃣ packages/app/src/state/query/query-client.ts 🔴 — ts+react — React query client — store.ts (НЕТ)
4️⃣8️⃣ packages/app/src/hooks/useApi.ts 🔴 — ts+react — Hook API — lib/api-client.ts (НЕТ)
4️⃣9️⃣ packages/app/src/hooks/useToast.ts 🔴 — ts+react — Hook Toast — ui-core/useToast.ts (НЕТ)

Feature Auth
5️⃣0️⃣ packages/feature-auth/src/domain/LoginRequest.ts 🔴 — ts — DTO login (НЕТ)
5️⃣1️⃣ packages/feature-auth/src/domain/TokenPair.ts 🔴 — ts — DTO token pair (НЕТ)
5️⃣2️⃣ packages/feature-auth/src/domain/MeResponse.ts 🔴 — ts — DTO me response (НЕТ)
5️⃣3️⃣ packages/feature-auth/src/types/auth.ts 🔴 — ts — Типы auth — domain/* (НЕТ)
5️⃣4️⃣ packages/feature-auth/src/stores/auth.ts 🔴 — ts+zustand — Auth store — types/auth.ts (НЕТ)
5️⃣5️⃣ packages/feature-auth/src/effects/login.ts 🔴 — ts+effect — Login effect — api-client.ts, types/auth.ts (НЕТ)
5️⃣6️⃣ packages/feature-auth/src/effects/logout.ts 🔴 — ts+effect — Logout effect — api-client.ts (НЕТ)
5️⃣7️⃣ packages/feature-auth/src/effects/refresh.ts 🔴 — ts+effect — Refresh effect — api-client.ts (НЕТ)
5️⃣8️⃣ packages/feature-auth/src/hooks/useAuth.ts 🔴 — ts+react — Hook auth — stores/auth.ts, effects/* (НЕТ)
5️⃣9️⃣ packages/feature-auth/src/schemas.ts 🟢 — схемы на базе core-contracts (реализован полностью)

Feature Bots
6️⃣0️⃣ packages/feature-bots/src/domain/Bot.ts 🔴 — ts — Bot entity (НЕТ)
6️⃣1️⃣ packages/feature-bots/src/domain/BotTemplate.ts 🔴 — ts — Bot template (НЕТ)
6️⃣2️⃣ packages/feature-bots/src/domain/Prompt.ts 🔴 — ts — Prompt entity (НЕТ)
6️⃣3️⃣ packages/feature-bots/src/types/bots.ts 🔴 — ts — Типы bots — domain/* (НЕТ)
6️⃣4️⃣ packages/feature-bots/src/stores/bots.ts 🔴 — ts+zustand — Bots store — types/bots.ts (НЕТ)
6️⃣5️⃣ packages/feature-bots/src/effects/createBot.ts 🔴 — ts+effect — Create bot — api-client.ts, stores/bots.ts (НЕТ)
6️⃣6️⃣ packages/feature-bots/src/effects/updateBot.ts 🔴 — ts+effect — Update bot — api-client.ts, stores/bots.ts (НЕТ)
6️⃣7️⃣ packages/feature-bots/src/effects/deleteBot.ts 🔴 — ts+effect — Delete bot — api-client.ts, stores/bots.ts (НЕТ)
6️⃣8️⃣ packages/feature-bots/src/hooks/useBots.ts 🔴 — ts+react — Hook bots list — stores/bots.ts, effects/* (НЕТ)
6️⃣9️⃣ packages/feature-bots/src/hooks/useBotWizard.ts 🔴 — ts+react — Hook bot wizard — stores/bots.ts, effects/* (НЕТ)

Feature Chat
7️⃣0️⃣ packages/feature-chat/src/domain/Message.ts 🔴 — ts — Message entity (НЕТ)
7️⃣1️⃣ packages/feature-chat/src/domain/Conversation.ts 🔴 — ts — Conversation entity (НЕТ)
7️⃣2️⃣ packages/feature-chat/src/types/chat.ts 🔴 — ts — Типы chat — domain/* (НЕТ)
7️⃣3️⃣ packages/feature-chat/src/stores/chat.ts 🔴 — ts+zustand — Chat store — types/chat.ts (НЕТ)
7️⃣4️⃣ packages/feature-chat/src/effects/sendMessage.ts 🔴 — ts+effect — Send message effect — api-client.ts, stores/chat.ts (НЕТ)
7️⃣5️⃣ packages/feature-chat/src/effects/connectWebSocket.ts 🔴 — ts+effect — WebSocket connect — websocket.ts, stores/chat.ts (НЕТ)
7️⃣6️⃣ packages/feature-chat/src/hooks/useChat.ts 🔴 — ts+react — Hook chat — stores/chat.ts, effects/* (НЕТ)
7️⃣7️⃣ packages/feature-chat/src/hooks/useRealTime.ts 🔴 — ts+react — Hook real-time — effects/connectWebSocket.ts (НЕТ)

UI Core components
7️⃣8️⃣ packages/ui-core/src/components/Toast.tsx 🔴 — ts+react — Toast UI (НЕТ)
7️⃣9️⃣ packages/ui-core/src/components/Skeleton.tsx 🔴 — ts+react — Skeleton UI (НЕТ)
8️⃣0️⃣ packages/ui-core/src/components/Modal.tsx 🔴 — ts+react — Modal UI (НЕТ)
8️⃣1️⃣ packages/ui-core/src/components/Breadcrumbs.tsx 🔴 — ts+react — Breadcrumbs UI (НЕТ)
8️⃣2️⃣ packages/ui-core/src/components/Tabs.tsx 🔴 — ts+react — Tabs UI (НЕТ)
8️⃣3️⃣ packages/ui-core/src/components/Accordion.tsx 🔴 — ts+react — Accordion UI (НЕТ)
8️⃣4️⃣ packages/ui-core/src/components/DatePicker.tsx 🔴 — ts+react — DatePicker UI (НЕТ)
8️⃣5️⃣ packages/ui-core/src/components/FileUploader.tsx 🔴 — ts+react — FileUploader UI (НЕТ)
8️⃣6️⃣ packages/ui-core/src/hooks/useToast.ts 🔴 — ts+react — Toast hook (НЕТ)
8️⃣7️⃣ packages/ui-core/src/types/ui.ts 🔴 — ts — Типы UI (НЕТ)

UI Features — Auth
8️⃣8️⃣ packages/ui-features/src/auth/login-form.tsx 🟢 — ts+react — Login form UI
8️⃣9️⃣ packages/ui-features/src/auth/register-form.tsx 🟢 — ts+react — Register form UI
9️⃣0️⃣ packages/ui-features/src/auth/WorkspaceForm.tsx 🔴 — ts+react — Workspace form UI (НЕТ)
9️⃣1️⃣ packages/ui-features/src/auth/OnboardingFlow.tsx 🔴 — ts+react — Onboarding flow (НЕТ)
9️⃣2️⃣ packages/ui-features/src/auth/TwoFactorAuth.tsx 🔴 — ts+react — Two factor auth UI (НЕТ)

UI Features — Bots
9️⃣3️⃣ packages/ui-features/src/bots/BotDashboard.tsx 🔴 — ts+react — Bots dashboard (НЕТ)
9️⃣4️⃣ packages/ui-features/src/bots/BotWizardFlow.tsx 🔴 — ts+react+effect — Bot wizard flow (НЕТ)
9️⃣5️⃣ packages/ui-features/src/bots/BotTemplateSelector.tsx 🔴 — ts+react — Template selector (НЕТ)
9️⃣6️⃣ packages/ui-features/src/bots/BotBasicForm.tsx 🔴 — ts+react — Bot basic form (НЕТ)
9️⃣7️⃣ packages/ui-features/src/bots/PromptEditor.tsx 🔴 — ts+react+effect — Prompt editor (НЕТ)
9️⃣8️⃣ packages/ui-features/src/bots/PromptBlocks.tsx 🔴 — ts+react — Prompt blocks (НЕТ)
9️⃣9️⃣ packages/ui-features/src/bots/PromptPreview.tsx 🔴 — ts+react — Prompt preview (НЕТ)

UI Features — Chat + Pages
1️⃣0️⃣0️⃣ packages/ui-features/src/chat/ChatInterface.tsx 🔴 — ts+react+effect — Chat interface (НЕТ)
1️⃣0️⃣1️⃣ packages/ui-features/src/chat/MessageBubble.tsx 🔴 — ts+react — Message bubble (НЕТ)
1️⃣0️⃣2️⃣ packages/ui-features/src/chat/ChatInput.tsx 🔴 — ts+react — Chat input (НЕТ)
1️⃣0️⃣3️⃣ packages/ui-features/src/chat/TypingIndicator.tsx 🔴 — ts+react — Typing indicator (НЕТ)
1️⃣0️⃣4️⃣ packages/ui-features/src/chat/MessageStatus.tsx 🔴 — ts+react — Message status (НЕТ)
1️⃣0️⃣5️⃣ packages/ui-features/src/chat/Attachments.tsx 🔴 — ts+react — Attachments (НЕТ)
1️⃣0️⃣6️⃣ packages/ui-features/src/chat/ChatHistory.tsx 🔴 — ts+react — Chat history (НЕТ)

UI Features — Admin/Dashboard
1️⃣0️⃣7️⃣ packages/ui-features/src/admin/DataTable.tsx 🔴 — ts+react — Data table (НЕТ)
1️⃣0️⃣8️⃣ packages/ui-features/src/admin/Pagination.tsx 🔴 — ts+react — Pagination (НЕТ)
1️⃣0️⃣9️⃣ packages/ui-features/src/admin/FiltersPanel.tsx 🔴 — ts+react — Filters panel (НЕТ)
1️⃣1️⃣0️⃣ packages/ui-features/src/admin/StatCard.tsx 🔴 — ts+react — Stat card (НЕТ)
1️⃣1️⃣1️⃣ packages/ui-features/src/admin/Chart.tsx 🔴 — ts+react — Chart/Graph (НЕТ)
1️⃣1️⃣2️⃣ packages/ui-features/src/admin/LogsViewer.tsx 🔴 — ts+react — Logs viewer (НЕТ)
1️⃣1️⃣3️⃣ packages/ui-features/src/admin/UserRoleBadge.tsx 🔴 — ts+react — User role badge (НЕТ)

UI Features — Billing/Payments
1️⃣1️⃣4️⃣ packages/ui-features/src/billing/PricingCard.tsx 🔴 — ts+react — Pricing card (НЕТ)
1️⃣1️⃣5️⃣ packages/ui-features/src/billing/InvoiceTable.tsx 🔴 — ts+react — Invoice table (НЕТ)
1️⃣1️⃣6️⃣ packages/ui-features/src/billing/PaymentMethod.tsx 🔴 — ts+react — Payment method (НЕТ)
1️⃣1️⃣7️⃣ packages/ui-features/src/billing/BillingHistory.tsx 🔴 — ts+react — Billing history (НЕТ)
1️⃣1️⃣8️⃣ packages/ui-features/src/billing/SubscriptionStatus.tsx 🔴 — ts+react — Subscription status (НЕТ)

UI Features — PWA/Security
1️⃣1️⃣9️⃣ packages/ui-features/src/pwa/InstallPrompt.tsx 🔴 — ts+react — Install prompt (НЕТ)
1️⃣2️⃣0️⃣ packages/ui-features/src/pwa/OfflineIndicator.tsx 🔴 — ts+react — Offline indicator (НЕТ)
1️⃣2️⃣1️⃣ packages/ui-features/src/pwa/UpdateNotification.tsx 🔴 — ts+react — Update notification (НЕТ)
1️⃣2️⃣2️⃣ packages/ui-features/src/security/PermissionsTable.tsx 🔴 — ts+react — Permissions table (НЕТ)

Web Pages
1️⃣2️⃣3️⃣ apps/web/src/app/[locale]/page.tsx 🟢 — Полная главная страница с i18n и навигацией (больше чем каркас)
1️⃣2️⃣4️⃣ apps/web/src/app/[locale]/dashboard/page.tsx 🟡 — Каркас dashboard с skeleton loading, accessibility и TODO для реальных виджетов/данных
1️⃣2️⃣5️⃣ apps/web/src/app/[locale]/auth/login/page.tsx 🟡 — Каркас login страницы с ui-features композитором и TODO для реального auth flow
1️⃣2️⃣6️⃣ apps/web/src/app/[locale]/auth/register/page.tsx 🟡 — Каркас register страницы с ui-features композитором и TODO для реального auth flow

---

**Возможности после реализации**

1️⃣ Модульная архитектура
app теперь чистый слой с общими типами, lib и hooks — ничего лишнего.
Все domain-specific вещи (auth, bots, chat) полностью вынесены в feature-пакеты.
Преимущество: можно добавлять новые платформы (PWA, мобильное приложение, отдельный дизайн admin-panel) без переписывания core-логики.

2️⃣ UI Core + UI Features
UI primitives (Button, Input, FormField) и core components (Card, Dialog, Toast) универсальны и независимы от платформы.
UI Features (Auth, Bots, Chat) используют primitives → можно переиспользовать их на web, PWA, mobile без дублирования кода.
Преимущество: единый дизайн-системный слой, который работает везде.

3️⃣ Features как отдельные модули
Auth, Bots, Chat полностью самодостаточные.
Каждый feature содержит domain types, store, effects, hooks → можно подключать к любому фронтенду.
Преимущество: например, feature-auth можно сразу подключить и в web, и в PWA, и в мобильное приложение.

4️⃣ Эффекты и API
effect-utils.ts, api-client.ts, offline-cache.ts → универсальные эффекты для всех платформ.
WebSocket, SSE, REST API, offline caching — работает на любой платформе, если подключить слой UI и store.
Преимущество: нет повторного написания логики для мобильного клиента или admin-panel.

5️⃣ i18n и локализация
Полная поддержка next-intl, request config и JSON-файлы.
Преимущество: локализация сразу доступна на web/PWA/mobile без дополнительной настройки.

6️⃣ Admin-panel / Web / PWA / Mobile
После реализации текущей структуры:

- Web → полностью готово, включая страницы (login, register, dashboard, page.tsx).
- Admin-panel → можно собрать как отдельный frontend, используя те же feature-пакеты + UI Core → быстро и без дублирования.
- PWA → Next.js + service worker + offline-cache + UI Features → легко подключить.
- Mobile → через React Native или Expo, используя feature-пакеты + UI Core primitives → почти весь код бизнес-логики переиспользуем.

🔑 Ключевые выгоды

- Масштабируемость → новые платформы подключаются без переписывания feature-логики.
- Повторное использование UI и эффектов → минимизация дублирования.
- Чистая и безопасная архитектура → app слой общий, feature-пакеты автономны.
- Параллельная разработка → несколько команд могут работать над разными feature без блокировки.

**Следующие шаги после Фазы 2:**

- **Фаза 2.1 (Примитивы)**: Реализовать недостающие UI primitives (textarea, select, checkbox, radio, toggle, icon, avatar, badge, tooltip, divider, skeleton)
- **Фаза 2.2 (Core компоненты)**: Создать UI components (Toast, Modal, Breadcrumbs, Tabs, Accordion, DatePicker, FileUploader)
- **Фаза 2.3 (App слой)**: Реализовать packages/app (store, hooks, провайдеры, остальные типы/libs)
- **Фаза 2.4 (Feature логика)**: Достроить packages/feature-auth (effects, stores, domain), feature-bots, feature-chat
- **Фаза 2.5 (UI Features)**: Реализовать все ui-features компоненты (Chat, Admin, Billing, PWA, Security)
- **Фаза 2.6 (Интеграция)**: Подключить все компоненты к страницам и протестировать end-to-end сценарии
