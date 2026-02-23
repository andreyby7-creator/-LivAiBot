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

✅ Core/policies
1️⃣ AuthPolicy.ts 🟢 — ts — deps: core-contracts; (жизненный цикл токенов, валидность сессии)
2️⃣ BotPermissions.ts 🟢 — ts — deps: core-contracts; (ACL и роли для ботов, CRUD/execute/manage)
3️⃣ BotPolicy.ts 🟢 — ts — deps: core-contracts; (жизненный цикл бота, режимы работы)
4️⃣ ChatPolicy.ts 🟢 — ts — deps: core-contracts; (кто кому может писать, режимы чата, rate limiting)
5️⃣ BillingPolicy.ts 🟢 — ts — deps: core-contracts; (ограничения ресурсов по тарифу, лимиты)
6️⃣ ComposedPolicy.ts 🟢 — ts — deps: core-contracts, AuthPolicy, BotPermissions, BotPolicy, ChatPolicy, BillingPolicy; (объединяет все политики, pre-flight проверки) 

✅ Core/aggregation
7️⃣ weight.ts 🟢 — ts — deps: — ; (операции с весами: нормализация, валидация, scale, combine)
8️⃣ reducer.ts 🟢 — ts — deps: — ; (агрегация значений с весами: sum, average, weighted average, min, max)
9️⃣ scoring.ts 🟢 — ts — deps: reducer, weight; (scoring: weighted scoring, нормализация, агрегация)

✅ Core/data-safety
1️⃣0️⃣ trust-level.ts 🟢 — ts — deps: — ; (security lattice для уровней доверия)
1️⃣1️⃣ sanitization-mode.ts 🟢 — ts — deps: — ; (режимы санитизации данных, PII protection)
1️⃣2️⃣ structural-clone.ts 🟢 — ts — deps: — ; (безопасное глубокое клонирование для taint tracking)
1️⃣3️⃣ taint.ts 🟢 — ts — deps: trust-level; (отслеживание "загрязнения" данных)
1️⃣4️⃣ taint-source.ts 🟢 — ts — deps: taint, sanitization-mode, trust-level; (input boundary: пометка внешних данных как tainted)
1️⃣5️⃣ taint-sink.ts 🟢 — ts — deps: taint, trust-level; (output boundary: проверка trusted данных перед отправкой)
1️⃣6️⃣ taint-propagation.ts 🟢 — ts — deps: taint, trust-level; (отслеживание распространения taint через плагины)

✅ Core/domain-kit
1️⃣7️⃣ confidence.ts 🟢 — ts — deps: — ; (probability/uncertainty modeling, confidence aggregation)
1️⃣8️⃣ evaluation-level.ts 🟢 — ts — deps: — ; (decision algebra, lattice operations)
1️⃣9️⃣ label.ts 🟢 — ts — deps: — ; (domain-specific строковые метки с валидацией)

✅ Core/input-boundary
2️⃣0️⃣ generic-validation.ts 🟢 — ts — deps: — ; (type guards и структурная валидация DTO)
2️⃣1️⃣ context-enricher.ts 🟢 — ts — deps: generic-validation; (обогащение контекста метаданными)
2️⃣2️⃣ projection-engine.ts 🟢 — ts — deps: generic-validation; (трансформация domain → DTO)

✅ Core/pipeline
2️⃣3️⃣ plugin-api.ts 🟢 — ts — deps: — ; (dependency-driven execution engine API)
2️⃣4️⃣ errors.ts 🟢 — ts — deps: plugin-api; (error model, нормализация ошибок)
2️⃣5️⃣ plan.ts 🟢 — ts — deps: plugin-api; (построение execution plan, топологическая сортировка)
2️⃣6️⃣ engine.ts 🟢 — ts — deps: plan, plugin-api; (execution engine, orchestration)
2️⃣7️⃣ facade.ts 🟢 — ts — deps: engine, plan; (единая точка входа, rule-engine)
2️⃣8️⃣ adapter.ts 🟢 — ts — deps: — ; (адаптеры для async runtime'ов)
2️⃣9️⃣ feature-flags.ts 🟢 — ts — deps: — ; (feature flag management для rollout)
3️⃣0️⃣ replay.ts 🟢 — ts — deps: — ; (сохранение событий для replay и тестирования)
3️⃣1️⃣ runtime-overrides.ts 🟢 — ts — deps: — ; (runtime overrides для экстренного управления)
3️⃣2️⃣ safety-guard.ts 🟢 — ts — deps: — ; (автоматический откат при превышении порогов)

✅ Core/resilience
3️⃣3️⃣ metrics.ts 🟢 — ts — deps: — ; (агрегация и анализ метрик производительности)
3️⃣4️⃣ performance-limits.ts 🟢 — ts — deps: metrics; (валидация и контроль лимитов производительности)
3️⃣5️⃣ circuit-breaker.ts 🟢 — ts — deps: — ; (SLA-изоляция внешних зависимостей)

✅ Core/rule-engine
3️⃣6️⃣ predicate.ts 🟢 — ts — deps: — ; (композиция предикатов: AND, OR, NOT)
3️⃣7️⃣ rule.ts 🟢 — ts — deps: predicate; (создание и валидация правил)
3️⃣8️⃣ evaluator.ts 🟢 — ts — deps: rule; (evaluation правил с выбором по приоритету)

✅ Domains/classification
3️⃣9️⃣ constants.ts 🟢 — ts — deps: @livai/core; (single source of truth для валидационных границ)
4️⃣0️⃣ labels.ts 🟢 — ts — deps: @livai/core; (domain-specific labels с валидацией)
4️⃣1️⃣ aggregation/scoring.ts 🟢 — ts — deps: constants, strategies/config, strategies/rules; (расчет risk score на основе факторов)
4️⃣2️⃣ signals/signals.ts 🟢 — ts — deps: @livai/core, constants, labels; (domain-specific signals и context)
4️⃣3️⃣ signals/violations.ts 🟢 — ts — deps: constants, signals/signals; (сигналы нарушений)
4️⃣4️⃣ context/context-builders.ts 🟢 — ts — deps: aggregation/scoring, constants, evaluation/assessment, signals/signals, strategies/config; (построение контекста)
4️⃣5️⃣ strategies/rules.ts 🟢 — ts — deps: constants, strategies/config, signals/signals; (правила классификации)
4️⃣6️⃣ strategies/config.ts 🟢 — ts — deps: — ; (динамическая конфигурация правил)
4️⃣7️⃣ strategies/validation.ts 🟢 — ts — deps: signals/signals, signals/violations; (валидация правил)
4️⃣8️⃣ strategies/deterministic.strategy.ts 🟢 — ts — deps: @livai/core, strategies/config, strategies/rules, strategies/validation, context/context-builders, evaluation/result, policies/base.policy, signals/signals, signals/violations; (детерминированная стратегия оценки)
4️⃣9️⃣ strategies/assessment.ts 🟢 — ts — deps: strategies/config, strategies/deterministic.strategy, strategies/rules, aggregation/scoring, evaluation/assessment, evaluation/result, policies/base.policy, signals/signals, signals/violations; (оценка классификации)
5️⃣0️⃣ policies/base.policy.ts 🟢 — ts — deps: labels, signals/signals; (базовая decision policy)
5️⃣1️⃣ policies/aggregation.strategy.ts 🟢 — ts — deps: policies/base.policy; (стратегия агрегации для policy)
5️⃣2️⃣ policies/aggregation.policy.ts 🟢 — ts — deps: policies/aggregation.strategy; (policy с агрегацией)
5️⃣3️⃣ evaluation/result.ts 🟢 — ts — deps: @livai/core, labels, policies/base.policy, signals/signals, strategies/rules; (результат оценки классификации)
5️⃣4️⃣ evaluation/assessment.ts 🟢 — ts — deps: @livai/core, evaluation/result, constants, policies/base.policy, signals/signals, signals/violations, strategies/rules; (оценка классификации)
5️⃣5️⃣ providers/remote.provider.ts 🟢 — ts — deps: @livai/core, signals/signals, strategies/rules; (загрузка внешних сигналов)

✅ UI-Core/primitives
5️⃣6️⃣ button.tsx 🟢 — ts+react — deps: — ; (кнопка)
5️⃣7️⃣ input.tsx 🟢 — ts+react — deps: — ; (текстовое поле ввода)
5️⃣8️⃣ textarea.tsx 🟢 — ts+react — deps: — ; (многострочное текстовое поле)
5️⃣9️⃣ select.tsx 🟢 — ts+react — deps: — ; (выпадающий список)
6️⃣0️⃣ checkbox.tsx 🟢 — ts+react — deps: — ; (чекбокс)
6️⃣1️⃣ radio.tsx 🟢 — ts+react — deps: — ; (радиокнопка)
6️⃣2️⃣ toggle.tsx 🟢 — ts+react — deps: — ; (переключатель)
6️⃣3️⃣ icon.tsx 🟢 — ts+react — deps: — ; (иконка)
6️⃣4️⃣ avatar.tsx 🟢 — ts+react — deps: — ; (аватар)
6️⃣5️⃣ badge.tsx 🟢 — ts+react — deps: — ; (бейдж)
6️⃣6️⃣ tooltip.tsx 🟢 — ts+react — deps: — ; (подсказка)
6️⃣7️⃣ divider.tsx 🟢 — ts+react — deps: — ; (разделитель)
6️⃣8️⃣ card.tsx 🟢 — ts+react — deps: — ; (карточка)
6️⃣9️⃣ form-field.tsx 🟢 — ts+react — deps: — ; (поле формы с лейблом и ошибкой)
7️⃣0️⃣ dialog.tsx 🟢 — ts+react — deps: — ; (диалоговое окно)
7️⃣1️⃣ form.tsx 🟢 — ts+react — deps: — ; (форма)
7️⃣2️⃣ loading-spinner.tsx 🟢 — ts+react — deps: — ; (индикатор загрузки)
7️⃣3️⃣ dropdown.tsx 🟢 — ts+react — deps: — ; (выпадающее меню)
7️⃣4️⃣ context-menu.tsx 🟢 — ts+react — deps: — ; (контекстное меню)
7️⃣5️⃣ status-indicator.tsx 🟢 — ts+react — deps: — ; (индикатор статуса)

✅ UI-Core/components и types
7️⃣6️⃣ types/ui.ts 🟢 — ts — deps: — ; (типы для UI компонентов)
7️⃣7️⃣ components/Toast.tsx 🟢 — ts+react — deps: — ; (уведомления)
7️⃣8️⃣ components/Skeleton.tsx 🟢 — ts+react — deps: — ; (скелетон загрузки)
7️⃣9️⃣ components/Modal.tsx 🟢 — ts+react — deps: — ; (модальное окно)
8️⃣0️⃣ components/Breadcrumbs.tsx 🟢 — ts+react — deps: — ; (хлебные крошки)
8️⃣1️⃣ components/Tabs.tsx 🟢 — ts+react — deps: — ; (вкладки)
8️⃣2️⃣ components/Accordion.tsx 🟢 — ts+react — deps: — ; (аккордеон)
8️⃣3️⃣ components/DatePicker.tsx 🟢 — ts+react — deps: — ; (выбор даты)
8️⃣4️⃣ components/FileUploader.tsx 🟢 — ts+react — deps: — ; (загрузка файлов)
8️⃣5️⃣ components/SideBar.tsx 🟢 — ts+react — deps: — ; (боковая панель)
8️⃣6️⃣ components/SearchBar.tsx 🟢 — ts+react — deps: — ; (поисковая строка)
8️⃣7️⃣ components/ConfirmDialog.tsx 🟢 — ts+react — deps: — ; (диалог подтверждения)
8️⃣8️⃣ components/ErrorBoundary.tsx 🟢 — ts+react — deps: — ; (граница ошибок)
8️⃣9️⃣ components/UserProfileDisplay.tsx 🟢 — ts+react — deps: — ; (отображение профиля пользователя)
9️⃣0️⃣ components/NavigationMenuItem.tsx 🟢 — ts+react — deps: — ; (элемент навигационного меню)
9️⃣1️⃣ components/LanguageSelector.tsx 🟢 — ts+react — deps: — ; (выбор языка)
9️⃣2️⃣ components/SupportButton.tsx 🟢 — ts+react — deps: — ; (кнопка поддержки)

✅ App/types и libs
9️⃣3️⃣ types/common.ts 🟢 — ts — deps: — ; (общие типы приложения)
9️⃣4️⃣ types/ui-contracts.ts 🟢 — ts — deps: ui-core/types/ui, types/common; (контракты UI)
9️⃣5️⃣ types/api.ts 🟢 — ts — deps: types/common, types/ui-contracts; (типы API)
9️⃣6️⃣ types/errors.ts 🟢 — ts — deps: types/common, types/api; (типы ошибок)
9️⃣7️⃣ types/telemetry.ts 🟢 — ts — deps: types/ui-contracts; (типы телеметрии)
9️⃣8️⃣ lib/telemetry-runtime.ts 🟢 — ts — deps: lib/telemetry, types/telemetry; (runtime телеметрии)
9️⃣9️⃣ lib/telemetry.batch-core.ts 🟢 — ts — deps: types/telemetry; (чистое ядро batch логики)
1️⃣0️⃣0️⃣ lib/telemetry.ts 🟢 — ts — deps: types/telemetry, lib/telemetry.batch-core; (телеметрия)
1️⃣0️⃣1️⃣ lib/service-worker.ts 🟢 — ts — deps: — ; (service worker)
1️⃣0️⃣2️⃣ lib/i18n.ts 🟢 — ts+react — deps: — ; (интернационализация)
1️⃣0️⃣3️⃣ lib/effect-utils.ts 🟢 — ts+effect — deps: types/api; (утилиты для Effect)
1️⃣0️⃣4️⃣ lib/api-client.ts 🟢 — ts+effect — deps: types/api, lib/effect-utils, lib/telemetry; (HTTP клиент)
1️⃣0️⃣5️⃣ lib/websocket.ts 🟢 — ts+effect — deps: lib/effect-utils, lib/telemetry; (WebSocket клиент)
1️⃣0️⃣6️⃣ lib/sse-client.ts 🟢 — ts+effect — deps: lib/effect-utils, lib/telemetry; (SSE клиент)
1️⃣0️⃣7️⃣ lib/error-mapping.ts 🟢 — ts — deps: lib/effect-utils, lib/telemetry, types/common, types/errors; (маппинг ошибок)
1️⃣0️⃣8️⃣ lib/validation.ts 🟢 — ts — deps: lib/error-mapping, lib/telemetry; (валидация)
1️⃣0️⃣9️⃣ lib/feature-flags.ts 🟢 — ts — deps: lib/error-mapping; (feature flags)
1️⃣1️⃣0️⃣ lib/offline-cache.ts 🟢 — ts+effect — deps: lib/effect-utils, lib/telemetry; (офлайн кеш)
1️⃣1️⃣1️⃣ lib/api-schema-guard.ts 🟢 — ts+effect — deps: types/api, lib/error-mapping, lib/telemetry, lib/validation; (защита схемы API)
1️⃣1️⃣2️⃣ lib/performance.ts 🟢 — ts+effect — deps: types/common, lib/telemetry; (метрики производительности)
1️⃣1️⃣3️⃣ lib/auth-guard.ts 🟢 — ts — deps: types/common, lib/error-mapping; (проверка аутентификации и авторизации)
1️⃣1️⃣4️⃣ lib/auth-service.ts 🟢 — ts+effect — deps: lib/api-client, lib/effect-isolation, lib/effect-utils, lib/orchestrator, lib/schema-validated-effect, lib/telemetry, @livai/core-contracts; (сервис аутентификации)
1️⃣1️⃣5️⃣ lib/route-permissions.ts 🟢 — ts — deps: lib/auth-guard; (декларативная конфигурация доступа к маршрутам)
1️⃣1️⃣6️⃣ lib/logger.ts 🟢 — ts — deps: types/common, lib/telemetry; (логирование)
1️⃣1️⃣7️⃣ lib/effect-timeout.ts 🟢 — ts+effect — deps: lib/effect-utils; (timeout для Effect)
1️⃣1️⃣8️⃣ lib/effect-isolation.ts 🟢 — ts+effect — deps: lib/effect-utils; (изоляция для Effect)
1️⃣1️⃣9️⃣ lib/schema-validated-effect.ts 🟢 — ts+effect — deps: lib/api-schema-guard, lib/error-mapping, lib/effect-utils; (валидация схемы для Effect)
1️⃣2️⃣0️⃣ lib/orchestrator.ts 🟢 — ts+effect — deps: lib/effect-timeout, lib/effect-isolation, lib/telemetry, lib/effect-utils; (композиция асинхронных операций)

✅ App/state, provider и hooks
1️⃣2️⃣1️⃣ state/store-utils.ts 🟢 — ts — deps: state/store; (утилиты для store)
1️⃣2️⃣2️⃣ state/store.ts 🟢 — ts+zustand — deps: types/common; (глобальный store)
1️⃣2️⃣3️⃣ state/query/query-client.ts 🟢 — ts+react — deps: lib/telemetry; (query client)
1️⃣2️⃣4️⃣ providers/TelemetryProvider.tsx 🟢 — ts+react — deps: lib/telemetry, types/telemetry, types/ui-contracts; (провайдер телеметрии)
1️⃣2️⃣5️⃣ providers/FeatureFlagsProvider.tsx 🟢 — ts+zustand — deps: lib/feature-flags, types/common, types/ui-contracts; (провайдер feature flags)
1️⃣2️⃣6️⃣ providers/QueryClientProvider.tsx 🟢 — ts+react — deps: state/query/query-client, types/ui-contracts; (провайдер query client)
1️⃣2️⃣7️⃣ providers/ToastProvider.tsx 🟢 — ts+react — deps: providers/TelemetryProvider, types/ui-contracts; (провайдер уведомлений)
1️⃣2️⃣8️⃣ providers/UnifiedUIProvider.tsx 🟢 — ts+react — deps: providers/FeatureFlagsProvider, providers/intl-provider, providers/TelemetryProvider, lib/i18n, types/ui-contracts; (объединенный UI провайдер)
1️⃣2️⃣9️⃣ providers/AppProviders.tsx 🟢 — ts+react — deps: providers/intl-provider, providers/FeatureFlagsProvider, providers/TelemetryProvider, providers/QueryClientProvider, providers/ToastProvider, providers/UnifiedUIProvider, hooks/useAuth, lib/auth-guard, state/store, types/ui-contracts; (корневой провайдер приложения)
1️⃣3️⃣0️⃣ bootstrap.tsx 🟢 — ts+react — deps: providers/AppProviders; (инициализация приложения)
1️⃣3️⃣1️⃣ hooks/useApi.ts 🟢 — ts+react+effect — deps: lib/api-client, lib/api-schema-guard, lib/error-mapping, lib/telemetry, types/api, types/ui-contracts; (хук для API запросов)
1️⃣3️⃣2️⃣ hooks/useAuth.ts 🟢 — ts+react+effect — deps: lib/auth-service, state/store, state/store-utils; (хук аутентификации)
1️⃣3️⃣3️⃣ hooks/useToast.ts 🟢 — ts+react — deps: providers/ToastProvider, lib/telemetry, types/ui-contracts; (хук для уведомлений)
1️⃣3️⃣4️⃣ hooks/useFeatureFlags.ts 🟢 — ts+react — deps: providers/FeatureFlagsProvider, lib/feature-flags, types/common, types/ui-contracts; (хук для feature flags)
1️⃣3️⃣5️⃣ hooks/useOfflineCache.ts 🟢 — ts+react+effect — deps: lib/effect-utils, lib/offline-cache, types/ui-contracts; (хук для офлайн кеша)

✅ App/ui wrappers (enabled: telemetry, feature-flags, i18n)
1️⃣3️⃣6️⃣ ui/button.tsx 🟢 — ts+react — deps: ui-core/primitives/button, providers/UnifiedUIProvider, types/ui-contracts; (обертка кнопки)
1️⃣3️⃣7️⃣ ui/input.tsx 🟢 — ts+react — deps: ui-core/src/index, providers/UnifiedUIProvider, types/ui-contracts; (обертка поля ввода)
1️⃣3️⃣8️⃣ ui/textarea.tsx 🟢 — ts+react — deps: ui-core/primitives/textarea, providers/UnifiedUIProvider, types/ui-contracts; (обертка многострочного поля)
1️⃣3️⃣9️⃣ ui/select.tsx 🟢 — ts+react — deps: ui-core/primitives/select, providers/UnifiedUIProvider, types/ui-contracts; (обертка выпадающего списка)
1️⃣4️⃣0️⃣ ui/checkbox.tsx 🟢 — ts+react — deps: ui-core/primitives/checkbox, providers/UnifiedUIProvider, types/ui-contracts; (обертка чекбокса)
1️⃣4️⃣1️⃣ ui/radio.tsx 🟢 — ts+react — deps: ui-core/primitives/radio, providers/UnifiedUIProvider, types/ui-contracts; (обертка радиокнопки)
1️⃣4️⃣2️⃣ ui/toggle.tsx 🟢 — ts+react — deps: ui-core/primitives/toggle, providers/UnifiedUIProvider, types/ui-contracts; (обертка переключателя)
1️⃣4️⃣3️⃣ ui/icon.tsx 🟢 — ts+react — deps: ui-core/primitives/icon, providers/UnifiedUIProvider, types/ui-contracts; (обертка иконки)
1️⃣4️⃣4️⃣ ui/avatar.tsx 🟢 — ts+react — deps: ui-core/primitives/avatar, providers/UnifiedUIProvider, types/ui-contracts; (обертка аватара)
1️⃣4️⃣5️⃣ ui/badge.tsx 🟢 — ts+react — deps: ui-core/primitives/badge, providers/UnifiedUIProvider, types/ui-contracts; (обертка бейджа)
1️⃣4️⃣6️⃣ ui/tooltip.tsx 🟢 — ts+react — deps: ui-core/primitives/tooltip, providers/UnifiedUIProvider, types/ui-contracts; (обертка подсказки)
1️⃣4️⃣7️⃣ ui/divider.tsx 🟢 — ts+react — deps: ui-core/primitives/divider, providers/UnifiedUIProvider, types/ui-contracts; (обертка разделителя)
1️⃣4️⃣8️⃣ ui/card.tsx 🟢 — ts+react — deps: ui-core/primitives/card, providers/UnifiedUIProvider, types/ui-contracts; (обертка карточки)
1️⃣4️⃣9️⃣ ui/dialog.tsx 🟢 — ts+react — deps: ui-core/primitives/dialog, providers/UnifiedUIProvider; (обертка диалога)
1️⃣5️⃣0️⃣ ui/form.tsx 🟢 — ts+react — deps: ui-core/primitives/form, providers/UnifiedUIProvider, lib/validation, types/ui-contracts; (обертка формы)
1️⃣5️⃣1️⃣ ui/loading-spinner.tsx 🟢 — ts+react — deps: ui-core/primitives/loading-spinner, providers/UnifiedUIProvider, types/ui-contracts; (обертка индикатора загрузки)
1️⃣5️⃣2️⃣ ui/dropdown.tsx 🟢 — ts+react — deps: ui-core/primitives/dropdown, providers/UnifiedUIProvider, types/ui-contracts; (обертка выпадающего меню)
1️⃣5️⃣3️⃣ ui/context-menu.tsx 🟢 — ts+react — deps: ui-core/primitives/context-menu, providers/UnifiedUIProvider, types/ui-contracts; (обертка контекстного меню)
1️⃣5️⃣4️⃣ ui/status-indicator.tsx 🟢 — ts+react — deps: ui-core/primitives/status-indicator, providers/UnifiedUIProvider, types/ui-contracts; (обертка индикатора статуса)
1️⃣5️⃣5️⃣ ui/toast.tsx 🟢 — ts+react — deps: ui-core/components/Toast, providers/UnifiedUIProvider, types/errors, types/ui-contracts; (обертка уведомлений)
1️⃣5️⃣6️⃣ ui/skeleton.tsx 🟢 — ts+react — deps: ui-core/components/Skeleton, providers/UnifiedUIProvider, types/ui-contracts; (обертка скелетона)
1️⃣5️⃣7️⃣ ui/skeleton-group.tsx 🟢 — ts+react — deps: ui-core/components/Skeleton, providers/UnifiedUIProvider, types/ui-contracts; (группа скелетонов)
1️⃣5️⃣8️⃣ ui/modal.tsx 🟢 — ts+react — deps: ui-core/components/Modal, ui-core/types/ui, providers/UnifiedUIProvider, types/ui-contracts; (обертка модального окна)
1️⃣5️⃣9️⃣ ui/breadcrumbs.tsx 🟢 — ts+react — deps: ui-core/components/Breadcrumbs, providers/UnifiedUIProvider, types/ui-contracts; (обертка хлебных крошек)
1️⃣6️⃣0️⃣ ui/tabs.tsx 🟢 — ts+react — deps: ui-core/components/Tabs, providers/UnifiedUIProvider, types/ui-contracts; (обертка вкладок)
1️⃣6️⃣1️⃣ ui/accordion.tsx 🟢 — ts+react — deps: ui-core/components/Accordion, providers/UnifiedUIProvider, types/ui-contracts; (обертка аккордеона)
1️⃣6️⃣2️⃣ ui/date-picker.tsx 🟢 — ts+react — deps: ui-core/components/DatePicker, providers/UnifiedUIProvider, types/ui-contracts; (обертка выбора даты)
1️⃣6️⃣3️⃣ ui/file-uploader.tsx 🟢 — ts+react — deps: ui-core/components/FileUploader, providers/UnifiedUIProvider, types/api, lib/validation, types/ui-contracts; (обертка загрузки файлов)
1️⃣6️⃣4️⃣ ui/sidebar.tsx 🟢 — ts+react — deps: ui-core/components/SideBar, providers/UnifiedUIProvider, types/ui-contracts; (обертка боковой панели)
1️⃣6️⃣5️⃣ ui/search-bar.tsx 🟢 — ts+react — deps: ui-core/components/SearchBar, providers/UnifiedUIProvider, types/ui-contracts; (обертка поисковой строки)
1️⃣6️⃣6️⃣ ui/confirm-dialog.tsx 🟢 — ts+react — deps: ui-core/components/ConfirmDialog, ui-core/components/Modal, providers/UnifiedUIProvider, types/ui-contracts; (обертка диалога подтверждения)
1️⃣6️⃣7️⃣ ui/error-boundary.tsx 🟢 — ts+react — deps: ui-core/components/ErrorBoundary, providers/UnifiedUIProvider, lib/error-mapping, types/errors, types/ui-contracts; (обертка границы ошибок)
1️⃣6️⃣8️⃣ ui/user-profile-display.tsx 🟢 — ts+react — deps: ui-core/components/UserProfileDisplay, providers/UnifiedUIProvider, lib/auth-guard, lib/route-permissions, types/ui-contracts; (обертка отображения профиля)
1️⃣6️⃣9️⃣ ui/navigation-menu-item.tsx 🟢 — ts+react — deps: ui-core/components/NavigationMenuItem, providers/UnifiedUIProvider, lib/route-permissions, types/ui-contracts; (обертка элемента навигации)
1️⃣7️⃣0️⃣ ui/language-selector.tsx 🟢 — ts+react — deps: ui-core/components/LanguageSelector, providers/UnifiedUIProvider, types/ui-contracts; (обертка выбора языка)
1️⃣7️⃣1️⃣ ui/support-button.tsx 🟢 — ts+react — deps: ui-core/components/SupportButton, providers/UnifiedUIProvider, types/ui-contracts; (обертка кнопки поддержки)

✅ App/routing & navigation
1️⃣7️⃣2️⃣ routes/routes.ts 🟢 — ts — deps: types/common; (декларативный список всех routes)
1️⃣7️⃣3️⃣ routes/route-meta.ts 🟢 — ts — deps: routes, lib/route-permissions, types/common; (permissions, flags, auth-required)
1️⃣7️⃣4️⃣ routes/navigation.ts 🟢 — ts — deps: route-meta, routes, types/common; (sidebar/menu/navigation config)

✅ App/events
1️⃣7️⃣5️⃣ events/app-lifecycle-events.ts 🟢 — ts — deps: types/common; (lifecycle event hub)
1️⃣7️⃣6️⃣ events/app-events.ts 🟢 — ts — deps: types/common, zod, uuid; (logout, authExpired, billingChanged)
1️⃣7️⃣7️⃣ events/event-bus.ts 🟢 — ts — deps: events/app-events; (typed event bus)

✅ App/background & scheduler
1️⃣7️⃣8️⃣ background/scheduler.ts 🟢 — ts+effect — deps: events/app-events, events/event-bus, lib/telemetry; (адаптивный планировщик задач с приоритетами)
1️⃣7️⃣9️⃣ background/tasks.ts 🟢 — ts+effect — deps: background/scheduler, events/app-events, events/event-bus; (refresh, sync, retry via scheduler)

✅ App/lifecycle
1️⃣8️⃣0️⃣ state/reset.ts 🟢 — ts — deps: state/store, state/store-utils, events/app-lifecycle-events; (глобальный reset state при logout)
1️⃣8️⃣1️⃣ lib/app-lifecycle.ts 🟢 — ts — deps: background/tasks, events/app-lifecycle-events, types/common; (app lifecycle orchestrator: bootstrap/teardown, staged execution, event subscriptions)

Feature Auth
1️⃣8️⃣2️⃣ domain/LoginRequest.ts 🟢 — ts — deps: — ; (DTO login, только типы запроса)
1️⃣8️⃣3️⃣ domain/RegisterRequest.ts 🟢 — ts — deps: — ; (DTO register, данные для регистрации пользователя)
1️⃣8️⃣4️⃣ domain/RegisterResponse.ts 🟢 — ts — deps: domain/TokenPair, domain/MfaInfo; (DTO ответа регистрации, подтверждение создания аккаунта)
1️⃣8️⃣5️⃣ domain/PasswordResetRequest.ts 🟢 — ts — deps: — ; (DTO запрос сброса пароля, email/username)
1️⃣8️⃣6️⃣ domain/PasswordResetConfirm.ts 🟢 — ts — deps: — ; (DTO подтверждение сброса пароля, token + новый пароль)
1️⃣8️⃣7️⃣ domain/VerifyEmailRequest.ts 🟢 — ts — deps: — ; (DTO верификация email, confirmation token)
1️⃣8️⃣8️⃣ domain/VerifyPhoneRequest.ts 🟢 — ts — deps: — ; (DTO верификация телефона, SMS code)
1️⃣8️⃣9️⃣ domain/RefreshTokenRequest.ts 🟢 — ts — deps: — ; (DTO обновления токена, refresh token)
1️⃣9️⃣0️⃣ domain/LogoutRequest.ts 🟢 — ts — deps: — ; (DTO выхода из системы, опционально refresh token)
1️⃣9️⃣1️⃣ domain/DeviceInfo.ts 🟢 — ts — deps: — ; (DTO информация об устройстве для аудита)
1️⃣9️⃣2️⃣ domain/SessionRevokeRequest.ts 🟢 — ts — deps: — ; (DTO отзыв сессии, session ID)
1️⃣9️⃣3️⃣ domain/MfaChallengeRequest.ts 🟢 — ts — deps: — ; (DTO запрос MFA вызова, тип аутентификации)
1️⃣9️⃣4️⃣ domain/MfaSetupRequest.ts 🟢 — ts — deps: — ; (DTO настройки MFA, секрет и метод)
1️⃣9️⃣5️⃣ domain/MfaBackupCodeRequest.ts 🟢 — ts — deps: — ; (DTO резервных кодов MFA для recovery)
1️⃣9️⃣6️⃣ domain/OAuthLoginRequest.ts 🟢 — ts — deps: — ; (DTO OAuth login, provider token: Google/Yandex/FB/VK)
1️⃣9️⃣7️⃣ domain/OAuthRegisterRequest.ts 🟢 — ts — deps: — ; (DTO OAuth register, provider data для создания аккаунта)
1️⃣9️⃣8️⃣ domain/LoginRiskAssessment.ts 🟢 — ts — deps: — ; (DTO оценки риска логина: гео, device fingerprint, IP)
1️⃣9️⃣9️⃣ domain/SessionPolicy.ts 🟢 — ts — deps: — ; (DTO политик сессии: ограничения по IP, concurrent sessions)
2️⃣0️⃣0️⃣ domain/AuthAuditEvent.ts 🟢 — ts — deps: — ; (DTO событий аудита: client app, IP, deviceId, geo, timestamp)
2️⃣0️⃣1️⃣ domain/EmailTemplateRequest.ts 🟢 — ts — deps: — ; (DTO кастомных email шаблонов для верификации/уведомлений)
2️⃣0️⃣2️⃣ domain/SmsTemplateRequest.ts 🟢 — ts — deps: — ; (DTO кастомных SMS шаблонов для верификации)
2️⃣0️⃣3️⃣ domain/MfaRecoveryRequest.ts 🟢 — ts — deps: — ; (DTO восстановления MFA доступа при потере устройства)
2️⃣0️⃣4️⃣ domain/OAuthErrorResponse.ts 🟢 — ts — deps: — ; (DTO ошибок OAuth: invalid_token, provider_unavailable, user_denied)
2️⃣0️⃣5️⃣ domain/AuthErrorResponse.ts 🟢 — ts — deps: — ; (DTO кастомных ошибок: invalid_credentials, account_locked, rate_limited)
2️⃣0️⃣6️⃣ domain/TokenPair.ts 🟢 — ts — deps: — ; (DTO token pair: accessToken, refreshToken, expiresAt)
2️⃣0️⃣7️⃣ domain/MeResponse.ts 🟢 — ts — deps: — ; (DTO ответа /me: данные пользователя, роли, permissions)
2️⃣0️⃣8️⃣ types/auth.ts 🟢 — ts — deps: domain/LoginRequest, domain/RegisterRequest, domain/RegisterResponse, domain/PasswordResetRequest, domain/PasswordResetConfirm, domain/VerifyEmailRequest, domain/VerifyPhoneRequest, domain/MfaChallengeRequest, domain/MfaSetupRequest, domain/MfaBackupCodeRequest, domain/MfaRecoveryRequest, domain/OAuthLoginRequest, domain/OAuthRegisterRequest, domain/OAuthErrorResponse, domain/AuthErrorResponse, domain/SessionPolicy, domain/SessionRevokeRequest, domain/LoginRiskAssessment, domain/AuthAuditEvent, domain/DeviceInfo, domain/TokenPair, domain/RefreshTokenRequest, domain/LogoutRequest, domain/MeResponse, domain/EmailTemplateRequest, domain/SmsTemplateRequest; (агрегирующие типы auth: AuthState, AuthStatus, AuthError, MFA types, OAuth types, Security types, Recovery types)
2️⃣0️⃣9️⃣ types/auth-risk.ts 🟢 — ts — deps: @livai/domains, domain/LoginRiskAssessment; (auth-specific типы для risk assessment, адаптирует типы из @livai/domains для feature-auth, re-export базовых типов, auth-specific типы для RiskContext/RiskPolicy/RiskAssessmentResult, immutable readonly типы для безопасности)
2️⃣1️⃣0️⃣ effects/login/classification-mapper.ts 🟢 — ts — deps: @livai/domains; (маппинг classification labels из domains в auth-specific decision, strategy pattern для обработки различных labels, оптимизация производительности через pre-filtering правил, изолирует auth-специфичную логику от domain logic, используется в risk-assessment)
2️⃣1️⃣1️⃣ effects/login/login-risk-assessment.adapter.ts 🟢 — ts — deps: @livai/core, domain/DeviceInfo, domain/LoginRiskAssessment; (adapter между domain и DTO для login risk assessment, использует transformDomainToDto из @livai/core для преобразования signals в Record, защита от утечки sensitive данных через whitelist, auth-специфичная логика для LoginRiskAssessment DTO)
2️⃣1️⃣2️⃣ effects/login/risk-assessment.ts 🟢 — ts — deps: @livai/domains, effects/login/classification-mapper, effects/login/login-risk-assessment.adapter, domain/DeviceInfo, types/auth-risk; (composition layer, адаптирует feature-auth типы к domains API, вызывает assessClassification из domains, маппит результаты в auth-specific decision и DTO через classification-mapper, детерминированный результат, plugin pattern для расширяемости)
2️⃣1️⃣3️⃣ effects/login/device-fingerprint.ts 🟢 — ts+effect — deps: domain/DeviceInfo; (pure effect, без side-effects, сбор device info: userAgent, platform, screen, timezone, генерация deviceId)
2️⃣1️⃣4️⃣ effects/login/validation.ts 🟢 — ts — deps: domain/LoginRequest; (type guards для LoginRequest, валидация структуры и формата данных, domain-pure, deterministic, strict shape validation)
2️⃣1️⃣5️⃣ effects/login/login-metadata.enricher.ts 🟢 — ts — deps: @livai/core, domain/LoginRequest, domain/DeviceInfo, @livai/domains; (реализует ContextEnricher из @livai/core для обогащения контекста метаданными логина, использует core input-boundary для dependency-driven execution, extensible через builder registry pattern с injection, PII хеширование через injection, deterministic)
2️⃣1️⃣6️⃣ effects/login/error-mapper.ts 🟢 — ts — deps: @livai/app/lib/error-mapping, domain/AuthErrorResponse, domain/MfaChallengeRequest, domain/OAuthErrorResponse, domain/SessionRevokeRequest, types/auth; (трансформация API ошибок в UI-friendly AuthError без side-effects, переиспользуется для logout, refresh, OAuth, MFA)
2️⃣1️⃣7️⃣ lib/security-pipeline.ts 🟢 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/effect-timeout, @livai/app/lib/effect-utils, domain/DeviceInfo, effects/login/device-fingerprint, effects/login/risk-assessment, types/auth, types/auth-risk; (auth-специфичная обертка над device fingerprint и risk assessment, использует orchestrator для композиции шагов с timeout, facade pattern для единой точки входа, production guard для mandatory audit logger)
2️⃣1️⃣8️⃣ stores/auth.ts 🟢 — ts+zustand — deps: types/auth; (Auth store, чистое состояние, без effects)
2️⃣1️⃣9️⃣ effects/login.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/schema-validated-effect, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, @livai/app/state/store-utils, types/auth, stores/auth, lib/security-pipeline, effects/login/error-mapper, effects/login/validation, effects/login/login-metadata.enricher, domain/LoginRiskAssessment, domain/DeviceInfo, schemas; (выполняет login с оценкой риска через orchestrator, валидация через validatedEffect, обновление store через safeSet, isolation и timeout)
2️⃣2️⃣0️⃣ effects/logout.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/state/store-utils, stores/auth; (выполняет logout через orchestrator, очищает auth state через safeSet, блокировка store через setStoreLocked)
2️⃣2️⃣1️⃣ effects/refresh.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/schema-validated-effect, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, @livai/app/state/store-utils, types/auth, stores/auth, @livai/core/policies/AuthPolicy, schemas; (обновляет access token через orchestrator с idempotency guard, валидация через validatedEffect, синхронизация store через safeSet, isolation и timeout)
2️⃣2️⃣2️⃣ lib/session-manager.ts 🔴 — ts — deps: types/auth, @livai/core/policies/AuthPolicy, domain/SessionPolicy; (auto-refresh, expiry, invalidation, session policies, concurrent limits)
2️⃣2️⃣3️⃣ hooks/useAuth.ts 🔴 — ts+react — deps: stores/auth, effects/login, effects/logout, effects/refresh, types/auth; (Единый React-адаптер auth: инкапсулирует zustand+effects, предоставляет API authState/authStatus/isAuthenticated/login/logout/refresh, скрывает реализацию, точка расширения для auto-refresh, silent login, side-effects; финальный слой feature-auth, аналог useBots/useChat)
2️⃣2️⃣4️⃣ schemas.ts 🟢 — ts+zod — deps: @livai/core-contracts, domain/LoginRequest, domain/RegisterRequest, domain/RegisterResponse, domain/PasswordResetRequest, domain/PasswordResetConfirm, domain/VerifyEmailRequest, domain/VerifyPhoneRequest, domain/MfaChallengeRequest, domain/MfaSetupRequest, domain/MfaBackupCodeRequest, domain/MfaRecoveryRequest, domain/OAuthLoginRequest, domain/OAuthRegisterRequest, domain/OAuthErrorResponse, domain/AuthErrorResponse, domain/LoginRiskAssessment, domain/SessionPolicy, domain/SessionRevokeRequest, domain/AuthAuditEvent, domain/DeviceInfo, domain/TokenPair, domain/RefreshTokenRequest, domain/LogoutRequest, domain/MeResponse, domain/EmailTemplateRequest, domain/SmsTemplateRequest; (Zod схемы для валидации всех auth DTO: login/register/MFA/OAuth/security/audit/templates/errors/recovery на базе core-contracts)

Feature Bots
2️⃣2️⃣5️⃣ domain/Bot.ts 🔴 — ts — deps: — ; (Bot entity, основные поля бота: id, name, status, templateId, metadata)
2️⃣2️⃣6️⃣ domain/BotTemplate.ts 🔴 — ts — deps: — ; (Bot template entity, описание шаблона, дефолтные параметры, capabilities)
2️⃣2️⃣7️⃣ domain/Prompt.ts 🔴 — ts — deps: — ; (Prompt entity, системный/пользовательский prompt, параметры генерации)
2️⃣2️⃣8️⃣ types/bots.ts 🔴 — ts — deps: domain/Bot, domain/BotTemplate, domain/Prompt; (агрегирующие типы bots: BotState, BotStatus, BotError, DTO для create/update)
2️⃣2️⃣9️⃣ stores/bots.ts 🔴 — ts+zustand — deps: types/bots; (Bots store, список ботов, текущий бот, UI-состояние, без effects)
2️⃣3️⃣0️⃣ effects/createBot.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/schema-validated-effect, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, stores/bots, types/bots, @livai/core/policies/BotPolicy, @livai/core/policies/BotPermissions, schemas; (создание бота через orchestrator, валидация через validatedEffect, isolation и timeout)
2️⃣3️⃣1️⃣ effects/updateBot.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/schema-validated-effect, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, stores/bots, types/bots, @livai/core/policies/BotPolicy, @livai/core/policies/BotPermissions, schemas; (обновление бота через orchestrator, валидация через validatedEffect, isolation и timeout)
2️⃣3️⃣2️⃣ effects/deleteBot.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, stores/bots, @livai/core/policies/BotPolicy, @livai/core/policies/BotPermissions; (удаление бота через orchestrator, isolation и timeout)
2️⃣3️⃣3️⃣ hooks/useBots.ts 🔴 — ts+react — deps: stores/bots, effects/createBot, effects/updateBot, effects/deleteBot; (React-API для списка ботов и CRUD)
2️⃣3️⃣4️⃣ hooks/useBotWizard.ts 🔴 — ts+react — deps: stores/bots, effects/createBot; (пошаговый wizard создания бота, управление draft-состоянием)

Feature Chat
2️⃣3️⃣5️⃣ domain/Message.ts 🔴 — ts — deps: — ; (Message entity, текст, автор, timestamp, status доставки)
2️⃣3️⃣6️⃣ domain/Conversation.ts 🔴 — ts — deps: — ; (Conversation entity, id, participants, messages, metadata)
2️⃣3️⃣7️⃣ types/chat.ts 🔴 — ts — deps: domain/Message, domain/Conversation; (агрегирующие типы chat: ChatState, SendMessagePayload, ChatError)
2️⃣3️⃣8️⃣ stores/chat.ts 🔴 — ts+zustand — deps: types/chat; (Chat store, текущее общение, список сообщений, состояние подключения)
2️⃣3️⃣9️⃣ effects/sendMessage.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/schema-validated-effect, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, stores/chat, types/chat, @livai/core/policies/ChatPolicy, schemas; (отправка сообщения через orchestrator с idempotency guard, валидация через validatedEffect, isolation и timeout, optimistic update)
2️⃣4️⃣0️⃣ effects/connectWebSocket.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, @livai/app/lib/websocket, stores/chat, @livai/core/policies/ChatPolicy; (подключение к real-time каналу через orchestrator, isolation и timeout, приём сообщений)
2️⃣4️⃣1️⃣ hooks/useChat.ts 🔴 — ts+react — deps: stores/chat, effects/sendMessage; (React-API для чата и сообщений)
2️⃣4️⃣2️⃣ hooks/useRealTime.ts 🔴 — ts+react+effect — deps: effects/connectWebSocket, stores/chat, @livai/app/lib/telemetry; (Lifecycle-контроль real-time: init WS on mount, cleanup on unmount, reconnect/idempotency, защита от multiple connections, синхронизация состояния подключения в store, telemetry; lifecycle остаётся в React, effect — чистый use-case)
2️⃣4️⃣3️⃣ effects/connectSSE.ts 🔴 — ts+effect — deps: @livai/app/lib/orchestrator, @livai/app/lib/effect-timeout, @livai/app/lib/effect-isolation, @livai/app/lib/sse-client, stores/chat, @livai/core/policies/ChatPolicy; (SSE fallback для real-time чата через orchestrator, isolation и timeout, альтернатива WebSocket, единый контракт обновления chat store, включается по feature-flag или env)
2️⃣4️⃣4️⃣ lib/message-normalizer.ts 🔴 — ts — deps: domain/Message, types/chat; (Нормализация входящих сообщений API/WS/SSE → Message entity: статусы доставки, timestamps, idempotency, forward-compatibility)
2️⃣4️⃣5️⃣ schemas.ts 🔴 — ts+zod — deps: domain/Message, domain/Conversation, types/chat; (Zod схемы для валидации chat данных: Message, Conversation, SendMessagePayload)

App ↔ Feature contracts
2️⃣4️⃣6️⃣ contracts/feature-auth.contract.ts 🔴 — ts — deps: @livai/feature-auth, types/ui-contracts, @livai/core-contracts; (контракт app ↔ auth: isAuthenticated, permissions[])
2️⃣4️⃣7️⃣ contracts/feature-bots.contract.ts 🔴 — ts — deps: @livai/feature-bots, types/ui-contracts, @livai/core-contracts; (контракт app ↔ bots: capabilities, botPermissions)
2️⃣4️⃣8️⃣ contracts/feature-chat.contract.ts 🔴 — ts — deps: @livai/feature-chat, types/ui-contracts, @livai/core-contracts; (контракт app ↔ chat: chatPermissions)

App feature adapters (glue layer: app ↔ features)
2️⃣4️⃣9️⃣ features/auth.adapter.ts 🔴 — ts — deps: @livai/feature-auth/hooks/useAuth, types/ui-contracts; (адаптер auth feature: proxy, flags, SSR-safe)
2️⃣5️⃣0️⃣ features/bots.adapter.ts 🔴 — ts — deps: @livai/feature-bots/hooks/useBots, types/ui-contracts; (адаптер bots feature для app)
2️⃣5️⃣1️⃣ features/chat.adapter.ts 🔴 — ts — deps: @livai/feature-chat/hooks/useChat, types/ui-contracts; (адаптер chat feature для app)

**🏗️ UI Features Guidelines:**

- Структура реализации: **UI → hooks → effects → store**
- **Большинство UI Features пока нет** → при реализации держать чистую архитектуру
- **SSR-safe boundaries** особенно важны для real-time компонентов (WebSocket/SSE в effects)
- **Feature Flags**: использовать `FeatureFlagsProvider` и `useFeatureFlags` для conditional rendering без RSC re-render
- **Auth / Session Management**: useAuth уже объединяет store + effects → убедиться, что auto-refresh и silent-login безопасны и не создают multiple requests при SSR

UI Features — Auth
2️⃣5️⃣2️⃣ auth/login-form.tsx 🟡 — ts+react — deps: @livai/app/types/ui-contracts, @livai/feature-auth/hooks/useAuth; (Login form UI)
2️⃣5️⃣3️⃣ auth/register-form.tsx 🟡 — ts+react — deps: @livai/app/types/ui-contracts, @livai/feature-auth/hooks/useAuth; (Register form UI)
2️⃣5️⃣4️⃣ auth/WorkspaceForm.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, common/PermissionGate; (Workspace form UI) (НЕТ)
2️⃣5️⃣5️⃣ auth/OnboardingFlow.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (Onboarding flow) (НЕТ)
2️⃣5️⃣6️⃣ auth/TwoFactorAuth.tsx 🔴 — tsx+react+effect — deps: @livai/feature-auth/hooks/useAuth; (Two factor auth UI) (НЕТ)

UI Features — Permission-based Components
2️⃣5️⃣7️⃣ common/AuthGuard.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (Generic auth guard wrapper) (НЕТ)
2️⃣5️⃣8️⃣ common/RoleGate.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (Role-based access gate) (НЕТ)
2️⃣5️⃣9️⃣ common/PermissionGate.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (Permission-based access gate) (НЕТ)
2️⃣6️⃣0️⃣ common/ProtectedRoute.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (Route protection wrapper) (НЕТ)

UI Features — Bots
2️⃣6️⃣1️⃣ bots/BotDashboard.tsx 🔴 — tsx+react — deps: @livai/feature-bots/stores/bots, @livai/feature-bots/hooks/useBots; (Bots dashboard) (НЕТ)
2️⃣6️⃣2️⃣ bots/BotWizardFlow.tsx 🔴 — tsx+react+effect — deps: @livai/feature-bots/effects/createBot; (Bot wizard flow) (НЕТ)
2️⃣6️⃣3️⃣ bots/BotTemplateSelector.tsx 🔴 — tsx+react — deps: — ; (Template selector) (НЕТ)
2️⃣6️⃣4️⃣ bots/BotBasicForm.tsx 🔴 — tsx+react — deps: — ; (Bot basic form) (НЕТ)
2️⃣6️⃣5️⃣ bots/PromptEditor.tsx 🔴 — tsx+react+effect — deps: @livai/feature-bots/effects; (Prompt editor) (НЕТ)
2️⃣6️⃣6️⃣ bots/PromptBlocks.tsx 🔴 — tsx+react — deps: — ; (Prompt blocks) (НЕТ)
2️⃣6️⃣7️⃣ bots/PromptPreview.tsx 🔴 — tsx+react — deps: — ; (Prompt preview) (НЕТ)
2️⃣6️⃣8️⃣ bots/BotCard.tsx 🔴 — tsx+react — deps: — ; (Compact bot card for list view) (НЕТ)
2️⃣6️⃣9️⃣ bots/BotDetailCard.tsx 🔴 — tsx+react — deps: — ; (Detailed bot card with creator info) (НЕТ)
2️⃣7️⃣0️⃣ bots/SubscriptionStatusBadge.tsx 🔴 — tsx+react — deps: — ; (Subscription status badge) (НЕТ)
2️⃣7️⃣1️⃣ bots/CreatorInfo.tsx 🔴 — tsx+react — deps: — ; (Creator information component) (НЕТ)
2️⃣7️⃣2️⃣ bots/ContactButton.tsx 🔴 — tsx+react — deps: — ; (Contact creator button) (НЕТ)
2️⃣7️⃣3️⃣ bots/BotListItem.tsx 🔴 — tsx+react — deps: — ; (Bot list item for sidebar/list) (НЕТ)

**🤖 Bots / Chat Real-time:**

- **Чётко разделять**: effects (`connectWebSocket`, `connectSSE`) ↔ UI (`ChatInterface`, `PromptEditor`)
- **Избегать hydration waterfall**: real-time эффекты должны быть изолированы от UI рендера
- **Client/Server boundaries**: WebSocket/SSE строго в effects, не в UI компонентах

UI Features — Chat + Pages
2️⃣7️⃣4️⃣ chat/ChatInterface.tsx 🔴 — tsx+react+effect — deps: @livai/feature-chat/effects; (Chat interface) (НЕТ)
2️⃣7️⃣5️⃣ chat/MessageBubble.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Message bubble) (НЕТ)
2️⃣7️⃣6️⃣ chat/ChatInput.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Chat input) (НЕТ)
2️⃣7️⃣7️⃣ chat/TypingIndicator.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Typing indicator) (НЕТ)
2️⃣7️⃣8️⃣ chat/MessageStatus.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Message status) (НЕТ)
2️⃣7️⃣9️⃣ chat/Attachments.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Attachments) (НЕТ)
2️⃣8️⃣0️⃣ chat/AttachmentsDragDrop.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Drag & Drop для attachments) (НЕТ)
2️⃣8️⃣1️⃣ chat/ChatHistory.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Chat history) (НЕТ)
2️⃣8️⃣2️⃣ chat/ChatListPanel.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Chat list sidebar panel) (НЕТ)
2️⃣8️⃣3️⃣ chat/ChatListHeader.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Chat list header with advanced mode toggle) (НЕТ)
2️⃣8️⃣4️⃣ chat/CreateChatButton.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Create test chat button) (НЕТ)
2️⃣8️⃣5️⃣ chat/AIAgentStatusToggle.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (AI agent active/inactive toggle) (НЕТ)
2️⃣8️⃣6️⃣ chat/ChatActionButtons.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Chat action buttons) (НЕТ)
2️⃣8️⃣7️⃣ chat/MessageInputBar.tsx 🔴 — tsx+react+effect — deps: @livai/feature-chat/effects; (Message input bar with attachments, voice, AI assist) (НЕТ)
2️⃣8️⃣8️⃣ chat/AdvancedModeToggle.tsx 🔴 — tsx+react — deps: @livai/feature-chat/hooks/useChat; (Advanced mode toggle switch) (НЕТ)

UI Features — Admin/Dashboard
2️⃣8️⃣9️⃣ admin/DataTable.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Data table) (НЕТ)
2️⃣9️⃣0️⃣ admin/Pagination.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Pagination) (НЕТ)
2️⃣9️⃣1️⃣ admin/FiltersPanel.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Filters panel) (НЕТ)
2️⃣9️⃣2️⃣ admin/StatCard.tsx 🔴 — tsx+react — deps: — ; (Stat card) (НЕТ)
2️⃣9️⃣3️⃣ admin/Chart.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Chart/Graph) (НЕТ)
2️⃣9️⃣4️⃣ admin/LogsViewer.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Logs viewer) (НЕТ)
2️⃣9️⃣5️⃣ admin/UserRoleBadge.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (User role badge) (НЕТ)
2️⃣9️⃣6️⃣ admin/EmptyState.tsx 🔴 — tsx+react — deps: — ; (Empty state component with icon and message) (НЕТ)
2️⃣9️⃣7️⃣ admin/DateRangePicker.tsx 🔴 — tsx+react — deps: @livai/app/hooks/useApi; (Date range picker component) (НЕТ)
2️⃣9️⃣8️⃣ admin/FilterDropdown.tsx 🔴 — tsx+react — deps: @livai/app/hooks/useApi; (Filter dropdown component) (НЕТ)

UI Features — Billing/Payments/Balance
2️⃣9️⃣9️⃣ billing/PricingCard.tsx 🔴 — tsx+react — deps: — ; (Pricing card) (НЕТ)
3️⃣0️⃣0️⃣ billing/InvoiceTable.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Invoice table) (НЕТ)
3️⃣0️⃣1️⃣ billing/PaymentMethod.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Payment method) (НЕТ)
3️⃣0️⃣2️⃣ billing/BillingHistory.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Billing history) (НЕТ)
3️⃣0️⃣3️⃣ billing/SubscriptionStatus.tsx 🔴 — tsx+react — deps: — ; (Subscription status) (НЕТ)
3️⃣0️⃣4️⃣ billing/BalanceDisplay.tsx 🔴 — tsx+react — deps: — ; (Balance card for sidebar) (НЕТ)
3️⃣0️⃣5️⃣ billing/BotStatusIndicator.tsx 🔴 — tsx+react — deps: — ; (Bot status indicator) (НЕТ)
3️⃣0️⃣6️⃣ billing/TransactionHistoryTable.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Transaction history table with tabs) (НЕТ)
3️⃣0️⃣7️⃣ billing/UsageGraph.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Usage statistics graph/chart) (НЕТ)
3️⃣0️⃣8️⃣ billing/StatSummaryCards.tsx 🔴 — tsx+react — deps: — ; (Summary cards) (НЕТ)
3️⃣0️⃣9️⃣ billing/PaymentModal.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Payment modal with method tabs) (НЕТ)
3️⃣1️⃣0️⃣ billing/AmountInput.tsx 🔴 — tsx+react — deps: @livai/app/hooks/useApi; (Amount input with validation and hints) (НЕТ)
3️⃣1️⃣1️⃣ billing/TeamMemberSelector.tsx 🔴 — tsx+react — deps: — ; (Team member count selector) (НЕТ)
3️⃣1️⃣2️⃣ billing/OrganizationFormFields.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Organization details form fields) (НЕТ)
3️⃣1️⃣3️⃣ billing/DocumentUploadSection.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Document upload section for billing) (НЕТ)

UI Features — PWA/Security
3️⃣1️⃣4️⃣ pwa/InstallPrompt.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/service-worker; (Install prompt) (НЕТ)
3️⃣1️⃣5️⃣ pwa/OfflineIndicator.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/offline-cache; (Offline indicator) (НЕТ)
3️⃣1️⃣6️⃣ pwa/UpdateNotification.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/service-worker; (Update notification) (НЕТ)
3️⃣1️⃣7️⃣ security/PermissionsTable.tsx 🔴 — tsx+react — deps: @livai/feature-auth/hooks/useAuth, @livai/app/lib/route-permissions; (Permissions table) (НЕТ)

UI Features — Marketplace
3️⃣1️⃣8️⃣ marketplace/MarketplaceCard.tsx 🔴 — tsx+react — deps: — ; (Marketplace application/bot card) (НЕТ)
3️⃣1️⃣9️⃣ marketplace/CategoryTabs.tsx 🔴 — tsx+react — deps: — ; (Category filter tabs) (НЕТ)
3️⃣2️⃣0️⃣ marketplace/MarketplaceSearch.tsx 🔴 — tsx+react+effect — deps: @livai/app/lib/api-client; (Marketplace search bar) (НЕТ)

🟡 Web базовые файлы и i18n
3️⃣2️⃣1️⃣ apps/web/package.json 🟢 — deps: — ; (Полная реализация Next.js приложения с зависимостями)
3️⃣2️⃣2️⃣ apps/web/tsconfig.json 🟢 — deps: — ; (Полная TS конфигурация с paths на workspace packages)
3️⃣2️⃣3️⃣ apps/web/next.config.mjs 🟢 — deps: — ; (Полная Next.js конфигурация с настройками безопасности)
3️⃣2️⃣4️⃣ apps/web/.env.example 🟢 — deps: — ; (Пример конфигурации переменных окружения)
3️⃣2️⃣5️⃣ apps/web/src/env.ts 🟢 — deps: — ; (Типизированная конфигурация env переменных)
3️⃣2️⃣6️⃣ apps/web/i18n/i18n.config.json 🟢 — deps: — ; (Конфигурация локалей)
3️⃣2️⃣7️⃣ apps/web/i18n/routing.ts 🟢 — deps: — ; (Полная конфигурация локалей с типами TypeScript)
3️⃣2️⃣8️⃣ apps/web/i18n/request.ts 🟢 — deps: — ; (Полная next-intl request config с загрузкой сообщений)
3️⃣2️⃣9️⃣ apps/web/messages/en.json 🟢 — deps: — ; (Полная локализация EN со всеми необходимыми ключами)
3️⃣3️⃣0️⃣ apps/web/messages/ru.json 🟢 — deps: — ; (Полная локализация RU со всеми необходимыми ключами)
3️⃣3️⃣1️⃣ apps/web/src/app/globals.css 🟢 — deps: — ; (Глобальные стили)
3️⃣3️⃣2️⃣ apps/web/src/app/[locale]/layout.tsx 🟢 — deps: @livai/app/providers/AppProviders; (Полный root layout с i18n provider)
3️⃣3️⃣3️⃣ apps/web/src/app/providers.tsx 🟡 — deps: @livai/app/providers/AppProviders; (Next.js Providers wrapper, проксирует AppProviders)
3️⃣3️⃣4️⃣ apps/web/middleware.ts 🟢 — deps: — ; (Полная i18n routing middleware с next-intl)
3️⃣3️⃣5️⃣ apps/web/public/manifest.json 🟢 — deps: — ; (PWA manifest)
3️⃣3️⃣6️⃣ apps/web/src/sw.ts 🟢 — deps: @livai/app/lib/service-worker; (Service Worker TypeScript исходник)
3️⃣3️⃣7️⃣ apps/web/public/sw.js 🟢 — deps: apps/web/src/sw; (Service Worker JavaScript, генерируется из sw.ts)
3️⃣3️⃣8️⃣ apps/web/src/app/sw-register.ts 🟡 — deps: @livai/app/providers/ToastProvider; (Регистрация Service Worker на клиенте)
3️⃣3️⃣9️⃣ apps/web/public/favicon.ico 🟢 — deps: — ; (Favicon для production)
3️⃣4️⃣0️⃣ apps/web/src/app/icon-192.png/route.ts 🟢 — deps: — ; (PWA icon 192x192, PNG endpoint)
3️⃣4️⃣1️⃣ apps/web/src/app/icon-512.png/route.ts 🟢 — deps: — ; (PWA icon 512x512, PNG endpoint)
3️⃣4️⃣2️⃣ apps/web/src/app/robots.txt/route.ts 🟢 — deps: — ; (Robots.txt для SEO, динамический endpoint)
3️⃣4️⃣3️⃣ apps/web/src/app/sitemap.xml/route.ts 🟢 — deps: — ; (Sitemap для SEO, XML endpoint, i18n поддержка)

Web Pages
3️⃣4️⃣4️⃣ apps/web/src/app/[locale]/page.tsx 🟡 — ts+react — deps: — ; (Главная страница с i18n и навигацией)
3️⃣4️⃣5️⃣ apps/web/src/app/[locale]/dashboard/page.tsx 🟡 — ts+react — deps: apps/web/src/app/[locale]/dashboard/DashboardClient; (Серверный компонент-контейнер для dashboard)
3️⃣4️⃣6️⃣ apps/web/src/app/[locale]/dashboard/DashboardClient.tsx 🟡 — ts+react — deps: @livai/app/providers/AppProviders; (Клиентский компонент dashboard с базовым UI)
3️⃣4️⃣7️⃣ apps/web/src/app/[locale]/auth/login/page.tsx 🟡 — ts+react — deps: apps/web/src/app/[locale]/auth/login/LoginClient; (Серверный компонент-контейнер для login)
3️⃣4️⃣8️⃣ apps/web/src/app/[locale]/auth/login/LoginClient.tsx 🟡 — ts+react — deps: @livai/ui-features/auth/login-form, @livai/feature-auth/hooks/useAuth; (Клиентский компонент login с формой)
3️⃣4️⃣9️⃣ apps/web/src/app/[locale]/auth/register/page.tsx 🟡 — ts+react — deps: apps/web/src/app/[locale]/auth/register/RegisterClient; (Серверный компонент-контейнер для register)
3️⃣5️⃣0️⃣ apps/web/src/app/[locale]/auth/register/RegisterClient.tsx 🟡 — ts+react — deps: @livai/ui-features/auth/register-form, @livai/feature-auth/hooks/useAuth; (Клиентский компонент register с формой)
3️⃣5️⃣1️⃣ apps/web/src/app/[locale]/bots/page.tsx 🔴 — ts+react — deps: @livai/ui-features/bots/BotDashboard; (Bots page with BotDashboard) (НЕТ)
3️⃣5️⃣2️⃣ apps/web/src/app/[locale]/balance/page.tsx 🔴 — ts+react — deps: @livai/ui-features/billing; (Balance page with tabs and billing components) (НЕТ)
3️⃣5️⃣3️⃣ apps/web/src/app/[locale]/marketplace/page.tsx 🔴 — ts+react — deps: @livai/ui-features/marketplace; (Marketplace page with category tabs and cards) (НЕТ)
3️⃣5️⃣4️⃣ apps/web/src/app/[locale]/chat/page.tsx 🔴 — ts+react — deps: @livai/ui-features/chat/ChatInterface, @livai/ui-features/chat/ChatListPanel; (Chat page with ChatInterface and ChatListPanel) (НЕТ)
3️⃣5️⃣5️⃣ apps/web/src/app/[locale]/analytics/page.tsx 🔴 — ts+react — deps: @livai/ui-features/admin; (Analytics page with charts and filters) (НЕТ)
3️⃣5️⃣6️⃣ apps/web/src/app/[locale]/history/page.tsx 🔴 — ts+react — deps: @livai/ui-features/admin; (History page with filters and data table) (НЕТ)
3️⃣5️⃣7️⃣ apps/web/src/app/[locale]/not-found.tsx 🔴 — ts+react — deps: — ; (Custom 404 error page) (НЕТ)
3️⃣5️⃣8️⃣ apps/web/src/app/[locale]/mailings/page.tsx 🔴 — ts+react — deps: @livai/ui-features/admin; (Mailings page with filters and table) (НЕТ)
3️⃣5️⃣9️⃣ apps/web/src/app/[locale]/error.tsx 🔴 — ts+react — deps: — ; (Custom 500 error page) (НЕТ)
3️⃣6️⃣0️⃣ apps/web/src/app/global-error.tsx 🔴 — ts+react — deps: — ; (App-level error boundary для Next.js 16+) (НЕТ)

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
