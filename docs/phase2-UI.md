# 🚀 **ПЛАН РЕАЛИЗАЦИИ ФАЗЫ 2 — UI (Web + PWA)**

## ✨ **ОБНОВЛЕННЫЙ ПЛАН С КОРРЕКТНОЙ ПОСЛЕДОВАТЕЛЬНОСТЬЮ РЕАЛИЗАЦИИ**

**🔄 Версии пакетов проверены и актуальны на январь 2026 года**

**⚠️ Важно:** Используем **Zod 4.x** (мажорная версия с улучшенной производительностью) и **Effect 3.x** (единая библиотека)

**📦 Стандарты пакетов:** Все новые пакеты унифицированы со структурой `packages/core-contracts`

**🏗️ Архитектура Фазы 2:** ✅ **СОЗДАНЫ И УНИФИЦИРОВАНЫ 9 пакетов** по стандарту core-contracts (обновлена последовательность реализации):

#### **UI пакеты (4):**

- ✅ `@livai/ui-tokens` - дизайн токены (цвета, типографика, spacing)
- ✅ `@livai/ui-shared` - общие UI утилиты и сервисы (WebSocket, SSE, offline caching, i18n, effect-utils)
- ✅ `@livai/ui-core` - атомарные UI компоненты (Button, Input, Card, Skeleton, Toast)
- ✅ `@livai/ui-features` - составные UI экраны (AuthFlow, BotDashboard, ChatInterface)

#### **Feature пакеты (3):**

- ✅ `@livai/feature-auth` - бизнес-логика аутентификации (DTO, Effect, optimistic UI)
- ✅ `@livai/feature-bots` - бизнес-логика ботов (CRUD, BotWizard, PromptEditor)
- ✅ `@livai/feature-chat` - бизнес-логика чата (real-time, offline caching)

#### **App пакет (1):**

- ✅ `@livai/app` - Next.js композиция (routing, providers, i18n, feature flags)

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
- 🌍 **i18n с первого дня** (русский + английский, без мерцаний)
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

  1. **@livai/ui-core** - атомарные UI компоненты (Button, Input, Card, Skeleton, Toast)
     - Почему: почти все UI-features используют эти компоненты
     - Проверка: компоненты визуально готовы и корректно типизированы

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

  5. **@livai/ui-features** - составные UI экраны (AuthFlow, BotDashboard, ChatInterface)
     - Почему: используют feature-пакеты + ui-core
     - Проверка: экраны корректно интегрируют бизнес-логику

- **Настроить зависимости** между пакетами (peerDependencies, workspace протоколы)
- **Мигрировать apps/web** в тонкий композитор слоев

#### **Этап 2.2: Функциональная разработка**

1. **apps/web/src/app/layout.tsx** - Root layout (провайдеры store, i18n, toast, навигация)
2. **Страницы с навигационным каркасом:**
   - Dashboard, Knowledge, Channels, Dialogs, Billing, Team, Settings (каркас)
   - (auth)/login и (auth)/register → feature-auth + ui-features/auth
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

### **📁 Структура проекта:**

📁 apps/web
1️⃣ apps/web/package.json — ts — Основной package config
2️⃣ apps/web/tsconfig.json — ts — TypeScript конфиг — package.json
3️⃣ apps/web/next.config.mjs — ts — Next.js конфиг — package.json
4️⃣ apps/web/tailwind.config.ts — ts — Tailwind конфиг — package.json
5️⃣ apps/web/.eslintrc.json — ts — ESLint конфиг — package.json
6️⃣ apps/web/playwright.config.ts — ts+playwright — E2E тесты — package.json
7️⃣ apps/web/public/manifest.json — json — PWA манифест
8️⃣ apps/web/public/locales/ru/common.json — json — Локализация RU
9️⃣ apps/web/public/locales/en/common.json — json — Локализация EN
🔟 apps/web/public/icons/icon-192x192.png — assets — Иконка
1️⃣1️⃣ apps/web/public/icons/icon-512x512.png — assets — Иконка
1️⃣2️⃣ apps/web/src/service-worker/sw.ts — ts+effect — Service Worker основной — offline-cache.ts, effect-utils.ts
1️⃣3️⃣ apps/web/src/service-worker/push.ts — ts+effect — Push notifications SW — sw.ts
1️⃣4️⃣ apps/web/src/app/layout.tsx — ts+react — Root layout — ui-core/*
1️⃣5️⃣ apps/web/src/app/dashboard/page.tsx — ts+react — Dashboard page — layout.tsx, ui-features/BotDashboard
1️⃣6️⃣ apps/web/src/app/knowledge/page.tsx — ts+react — Knowledge page — layout.tsx
1️⃣7️⃣ apps/web/src/app/channels/page.tsx — ts+react — Channels page — layout.tsx
1️⃣8️⃣ apps/web/src/app/dialogs/page.tsx — ts+react — Dialogs page — layout.tsx
1️⃣9️⃣ apps/web/src/app/billing/page.tsx — ts+react — Billing page — layout.tsx
2️⃣0️⃣ apps/web/src/app/team/page.tsx — ts+react — Team page — layout.tsx
2️⃣1️⃣ apps/web/src/app/settings/page.tsx — ts+react — Settings page — layout.tsx
2️⃣2️⃣ apps/web/src/app/(auth)/login/page.tsx — ts+react — Login page — LoginForm, useAuth
2️⃣3️⃣ apps/web/src/app/(auth)/register/page.tsx — ts+react — Register page — RegisterForm, useAuth
2️⃣4️⃣ apps/web/src/app/bots/page.tsx — ts+react — Bots list page — BotDashboard
2️⃣5️⃣ apps/web/src/app/bots/[id]/page.tsx — ts+react — Bot detail page — BotWizardFlow, PromptEditor
2️⃣6️⃣ apps/web/src/app/chat/page.tsx — ts+react — Chat page — ChatInterface
2️⃣7️⃣ apps/web/tests/e2e/chat.spec.ts — ts+playwright — Chat E2E test — Chat page
2️⃣8️⃣ apps/web/tests/e2e/auth.spec.ts — ts+playwright — Auth E2E test — login/register pages

📁 packages/app
1️⃣ packages/app/src/state/store.ts — ts+zustand — Root store
2️⃣ packages/app/src/state/query/query-client.ts — ts+react — React query client — store.ts
3️⃣ packages/app/src/state/stores/auth.ts — ts+zustand — Auth store — types/auth.ts
4️⃣ packages/app/src/state/stores/bots.ts — ts+zustand — Bots store — types/bots.ts
5️⃣ packages/app/src/hooks/useAuth.ts — ts+react — Hook Auth — stores/auth.ts
6️⃣ packages/app/src/hooks/useWorkspace.ts — ts+react — Hook Workspace — stores/auth.ts
7️⃣ packages/app/src/hooks/useApi.ts — ts+react — Hook API — lib/api-client.ts
8️⃣ packages/app/src/hooks/useToast.ts — ts+react — Hook Toast — ui-core/useToast.ts
9️⃣ packages/app/src/types/common.ts — ts — Общие типы
🔟 packages/app/src/types/api.ts — ts — Типы API — common.ts
1️⃣1️⃣ packages/app/src/types/auth.ts — ts — Типы auth — common.ts
1️⃣2️⃣ packages/app/src/types/bots.ts — ts — Типы bots — common.ts
1️⃣3️⃣ packages/app/src/lib/error-mapping.ts — ts — Mapping ошибок — types/*
1️⃣4️⃣ packages/app/src/lib/feature-flags.ts — ts — Feature flags — types/*
1️⃣5️⃣ packages/app/src/lib/validation.ts — ts — Validation utils — types/*
1️⃣6️⃣ packages/app/src/lib/effect-utils.ts — ts+effect — Effect helpers ⭐ (сдвинуть вверх)
1️⃣7️⃣ packages/app/src/lib/api-client.ts — ts+effect — API client — types/api.ts, effect-utils.ts ⭐ (раньше offline-cache)
1️⃣8️⃣ packages/app/src/lib/websocket.ts — ts+effect — WebSocket client — effect-utils.ts
1️⃣9️⃣ packages/app/src/lib/sse-client.ts — ts+effect — SSE client — effect-utils.ts
2️⃣0️⃣ packages/app/src/lib/offline-cache.ts — ts+effect — Offline caching — effect-utils.ts ⭐ (после всех, кто его использует) 📋 проверить силу зависимости
2️⃣1️⃣ packages/app/src/lib/i18n.ts — ts+react — i18n utils — types/*
2️⃣2️⃣ packages/app/src/ui/button.tsx — ts+react — UI wrapper Button — ui-core/Button.tsx
2️⃣3️⃣ packages/app/src/ui/input.tsx — ts+react — UI wrapper Input — ui-core/Input.tsx
2️⃣4️⃣ packages/app/src/ui/card.tsx — ts+react — UI wrapper Card — ui-core/Card.tsx
2️⃣5️⃣ packages/app/src/ui/dialog.tsx — ts+react — UI wrapper Dialog — ui-core/Dialog.tsx
2️⃣6️⃣ packages/app/src/ui/form.tsx — ts+react — UI wrapper Form — ui-core/Form.tsx
2️⃣7️⃣ packages/app/src/ui/toast.tsx — ts+react — UI wrapper Toast — ui-core/Toast.tsx
2️⃣8️⃣ packages/app/src/ui/sidebar.tsx — ts+react — Sidebar

📁 packages/feature-auth
1️⃣ packages/feature-auth/src/domain/LoginRequest.ts — ts — DTO login
2️⃣ packages/feature-auth/src/domain/TokenPair.ts — ts — DTO token pair
3️⃣ packages/feature-auth/src/domain/MeResponse.ts — ts — DTO me response
4️⃣ packages/feature-auth/src/types/auth.ts — ts — Типы auth — domain/*
5️⃣ packages/feature-auth/src/stores/auth.ts — ts+zustand — Auth store — types/auth.ts
6️⃣ packages/feature-auth/src/effects/login.ts — ts+effect — Login effect — api-client.ts, types/auth.ts
7️⃣ packages/feature-auth/src/effects/logout.ts — ts+effect — Logout effect — api-client.ts
8️⃣ packages/feature-auth/src/effects/refresh.ts — ts+effect — Refresh effect — api-client.ts
9️⃣ packages/feature-auth/src/hooks/useAuth.ts — ts+react — Hook auth — stores/auth.ts, effects/*

📁 packages/feature-bots
1️⃣ packages/feature-bots/src/domain/Bot.ts — ts — Bot entity
2️⃣ packages/feature-bots/src/domain/BotTemplate.ts — ts — Bot template
3️⃣ packages/feature-bots/src/domain/Prompt.ts — ts — Prompt entity
4️⃣ packages/feature-bots/src/types/bots.ts — ts — Типы bots — domain/*
5️⃣ packages/feature-bots/src/stores/bots.ts — ts+zustand — Bots store — types/bots.ts
6️⃣ packages/feature-bots/src/effects/createBot.ts — ts+effect — Create bot — api-client.ts, stores/bots.ts
7️⃣ packages/feature-bots/src/effects/updateBot.ts — ts+effect — Update bot — api-client.ts, stores/bots.ts
8️⃣ packages/feature-bots/src/effects/deleteBot.ts — ts+effect — Delete bot — api-client.ts, stores/bots.ts
9️⃣ packages/feature-bots/src/hooks/useBots.ts — ts+react — Hook bots list — stores/bots.ts, effects/*
🔟 packages/feature-bots/src/hooks/useBotWizard.ts — ts+react — Hook bot wizard — stores/bots.ts, effects/*

📁 packages/feature-chat
1️⃣ packages/feature-chat/src/domain/Message.ts — ts — Message entity
2️⃣ packages/feature-chat/src/domain/Conversation.ts — ts — Conversation entity
3️⃣ packages/feature-chat/src/types/chat.ts — ts — Типы chat — domain/*
4️⃣ packages/feature-chat/src/stores/chat.ts — ts+zustand — Chat store — types/chat.ts
5️⃣ packages/feature-chat/src/effects/sendMessage.ts — ts+effect — Send message effect — api-client.ts, stores/chat.ts
6️⃣ packages/feature-chat/src/effects/connectWebSocket.ts — ts+effect — WebSocket connect — websocket.ts, stores/chat.ts
7️⃣ packages/feature-chat/src/hooks/useChat.ts — ts+react — Hook chat — stores/chat.ts, effects/*
8️⃣ packages/feature-chat/src/hooks/useRealTime.ts — ts+react — Hook real-time — effects/connectWebSocket.ts

📁 packages/ui-core
1️⃣ packages/ui-core/src/components/Button.tsx — ts+react — Button UI
2️⃣ packages/ui-core/src/components/Input.tsx — ts+react — Input UI
3️⃣ packages/ui-core/src/components/Card.tsx — ts+react — Card UI
4️⃣ packages/ui-core/src/components/Dialog.tsx — ts+react — Dialog UI
5️⃣ packages/ui-core/src/components/Form.tsx — ts+react — Form UI
6️⃣ packages/ui-core/src/components/Toast.tsx — ts+react — Toast UI
7️⃣ packages/ui-core/src/components/Skeleton.tsx — ts+react — Skeleton UI
8️⃣ packages/ui-core/src/hooks/useToast.ts — ts+react — Toast hook
9️⃣ packages/ui-core/src/types/ui.ts — ts — Типы UI

📁 packages/ui-features
1️⃣ packages/ui-features/src/auth/LoginForm.tsx — ts+react — Login form UI
2️⃣ packages/ui-features/src/auth/RegisterForm.tsx — ts+react — Register form UI
3️⃣ packages/ui-features/src/auth/WorkspaceForm.tsx — ts+react — Workspace form UI
4️⃣ packages/ui-features/src/auth/OnboardingFlow.tsx — ts+react — Onboarding flow
5️⃣ packages/ui-features/src/bots/BotDashboard.tsx — ts+react — Bots dashboard
6️⃣ packages/ui-features/src/bots/BotWizardFlow.tsx — ts+react+effect — Bot wizard flow
7️⃣ packages/ui-features/src/bots/BotTemplateSelector.tsx — ts+react — Template selector
8️⃣ packages/ui-features/src/bots/BotBasicForm.tsx — ts+react — Bot basic form
9️⃣ packages/ui-features/src/bots/PromptEditor.tsx — ts+react+effect — Prompt editor
🔟 packages/ui-features/src/bots/PromptBlocks.tsx — ts+react — Prompt blocks
1️⃣1️⃣ packages/ui-features/src/bots/PromptPreview.tsx — ts+react — Prompt preview
1️⃣2️⃣ packages/ui-features/src/chat/ChatInterface.tsx — ts+react+effect — Chat interface
1️⃣3️⃣ packages/ui-features/src/chat/MessageBubble.tsx — ts+react — Message bubble
1️⃣4️⃣ packages/ui-features/src/chat/ChatInput.tsx — ts+react — Chat input
1️⃣5️⃣ packages/ui-features/src/chat/ChatHistory.tsx — ts+react — Chat history

---

## 💡 **ДОПОЛНИТЕЛЬНЫЕ ЗАМЕЧАНИЯ ПО РЕАЛИЗАЦИИ:**

### **⚠️ Важные замечания по инфраструктуре:**

- **Offline caching и effect-utils** стоит внедрять ПОСЛЕ всех, кто их использует (чтобы избежать ранних ошибок зависимостей)
- **WebSocket + SSE fallback** нужно тестировать на всех страницах с реальным трафиком, чтобы гарантировать корректный fallback
- **Feature flags и optimistic UI** уже предусмотрены — хорошо для постепенного rollout и UX

---

## 🎯 **ИТОГОВАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ РЕАЛИЗАЦИИ UI (ОБНОВЛЕНА):**

**Правильная стартовая точка для UI:**

1. **`packages/ui-core`** — атомарные компоненты (Button, Input, Card, Skeleton, Toast)
   - **Почему:** почти все UI-features используют эти компоненты
   - **Проверка:** компоненты визуально готовы и корректно типизированы

2. **`packages/ui-shared`** — утилиты и сервисы для UI (WebSocket, SSE, offline caching, i18n, effect-utils)
   - **Почему:** инфраструктурный слой для эффектов и feature-пакетов
   - **Проверка:** сервисы корректно работают с mock API
   - ⚠️ **offline caching и effect-utils внедрять ПОСЛЕ всех пользователей** (избегать ранних ошибок зависимостей)
   - 🧪 **WebSocket + SSE fallback тестировать с реальным трафиком** на всех страницах

3. **`packages/app`** — root store, hooks, провайдеры (Zustand store, query-client, useAuth/useBots/useChat)
   - **Почему:** все feature-пакеты используют эти hooks и store
   - **Проверка:** store и hooks работают с текущим api-gateway
   - ✅ **Feature flags и optimistic UI предусмотрены** для постепенного rollout и лучшего UX

4. **Feature-пакеты:**
   - `packages/feature-auth` — Login/Register forms, workspace creation
   - `packages/feature-bots` — CRUD ботов, BotWizardFlow, PromptEditor
   - `packages/feature-chat` — ChatInterface, WebSocket подключение, offline caching

5. **`packages/ui-features`** — составные экраны (AuthFlow, BotDashboard, ChatInterface)
   - **Почему:** используют feature-пакеты + ui-core
   - **Проверка:** экраны корректно интегрируют бизнес-логику

6. **`apps/web/src/app/layout.tsx`** — Root layout (провайдеры store, i18n, toast, навигация)

7. **Страницы** — использование feature + ui-features:
   - (auth)/login и (auth)/register → feature-auth + ui-features/auth
   - bots → feature-bots + ui-features/bots
   - chat → feature-chat + ui-features/chat
   - dashboard, knowledge, billing и т.п. → каркас без сложной логики
