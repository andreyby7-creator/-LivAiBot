apps/admin-panel/ # 🔹 Тонкий UI слой для админов (Next.js 16+ + TypeScript + React + FP + Effect)
└── src/ ├── app/ # 🔹 Next.js 16+ App Router (современный routing) │ ├── layout.tsx # 🔹 Root
layout админки (TypeScript + React + FP) │ ├── page.tsx # 🔹 Главная страница админ-панели
(TypeScript + React + FP) │ ├── users/ # 🔹 Route group пользователей │ │ ├── page.tsx # 🔹 Список
пользователей (TypeScript + React + FP) │ │ ├── create/ # 🔹 Nested route создания │ │ │ └──
page.tsx # 🔹 Форма создания пользователя (TypeScript + React + FP) │ │ └── [id]/ # 🔹 Dynamic route
по ID │ │ ├── page.tsx # 🔹 Детали пользователя (TypeScript + React + FP) │ │ └── edit/ # 🔹 Nested
route редактирования │ │ └── page.tsx # 🔹 Форма редактирования (TypeScript + React + FP) │ ├──
subscriptions/ # 🔹 Route group подписок │ │ ├── page.tsx # 🔹 Список подписок (TypeScript + React +
FP) │ │ └── [id]/ # 🔹 Детали подписки │ │ └── page.tsx # 🔹 Детали подписки (TypeScript + React +
FP) │ ├── billing/ # 🔹 Route group биллинга │ │ ├── page.tsx # 🔹 История платежей (TypeScript +
React + FP) │ │ └── [id]/ # 🔹 Детали платежа │ │ └── page.tsx # 🔹 Детали платежа (TypeScript +
React + FP) │ └── bots/ # 🔹 Route group AI-ботов │ ├── page.tsx # 🔹 Список ботов (TypeScript +
React + FP) │ └── [id]/ # 🔹 Детали бота │ └── page.tsx # 🔹 Детали и настройки бота (TypeScript +
React + FP) │ ├── components/ # 🔹 Локальные UI компоненты (admin-specific) │ ├── layout/ # 🔹
Layout компоненты │ │ ├── AdminLayout.tsx # 🔹 Главный layout (TypeScript + React + FP) │ │ ├──
AdminHeader.tsx # 🔹 Хедер с меню (TypeScript + React + FP) │ │ ├── AdminSidebar.tsx # 🔹 Сайдбар
навигации (TypeScript + React + FP) │ │ └── AdminFooter.tsx # 🔹 Футер (TypeScript + React + FP) │
├── dashboard/ # 🔹 Dashboard компоненты │ │ ├── MetricsCards.tsx # 🔹 Карточки метрик (TypeScript +
React + FP) │ │ ├── RecentActivity.tsx # 🔹 Недавняя активность (TypeScript + React + FP) │ │ └──
ChartsContainer.tsx # 🔹 Контейнер графиков (TypeScript + React + FP) │ ├── tables/ # 🔹 Табличные
компоненты │ │ ├── UsersTable.tsx # 🔹 Таблица пользователей (TypeScript + React + FP) │ │ ├──
SubscriptionsTable.tsx # 🔹 Таблица подписок (TypeScript + React + FP) │ │ ├── BillingTable.tsx # 🔹
Таблица платежей (TypeScript + React + FP) │ │ └── BotsTable.tsx # 🔹 Таблица ботов (TypeScript +
React + FP) │ ├── forms/ # 🔹 Формы админки │ │ ├── UserForm.tsx # 🔹 Форма пользователя
(TypeScript + React + FP) │ │ ├── SubscriptionForm.tsx # 🔹 Форма подписки (TypeScript + React + FP)
│ │ ├── BotConfigForm.tsx # 🔹 Форма настройки бота (TypeScript + React + FP) │ │ └──
PaymentForm.tsx # 🔹 Форма платежа (TypeScript + React + FP) │ └── modals/ # 🔹 Модальные окна │ ├──
ConfirmDialog.tsx # 🔹 Диалог подтверждения (TypeScript + React + FP) │ └── BulkActionsModal.tsx #
🔹 Массовые действия (TypeScript + React + FP) │ ├── features/ # 🔹 Feature-based бизнес-модули │
├── user-management/ # 🔹 Управление пользователями │ │ ├── api/ # 🔹 API calls (delegates to SDK) │
│ │ ├── queries.ts # 🔹 Read operations (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Write
operations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Feature-specific hooks │ │ │ ├──
useUsers.ts # 🔹 Hook для работы с пользователями (TypeScript + React + FP + Effect) │ │ │ ├──
useUserForm.ts # 🔹 Hook для формы пользователя (TypeScript + React + FP + Effect) │ │ │ └──
useUserPermissions.ts # 🔹 Hook для разрешений (TypeScript + React + FP + Effect) │ │ ├──
components/ # 🔹 Feature-specific компоненты │ │ │ ├── UserFilters.tsx # 🔹 Фильтры пользователей
(TypeScript + React + FP) │ │ │ ├── UserActions.tsx # 🔹 Действия с пользователями (TypeScript +
React + FP) │ │ │ └── UserStats.tsx # 🔹 Статистика пользователей (TypeScript + React + FP) │ │ └──
index.ts # 🔹 Feature exports (TypeScript) │ │ │ ├── subscription-lifecycle/ # 🔹 Управление
подписками │ │ ├── api/ # 🔹 API calls │ │ │ ├── queries.ts # 🔹 Subscription queries │ │ │ └──
mutations.ts # 🔹 Subscription mutations │ │ ├── hooks/ # 🔹 Subscription hooks │ │ │ ├──
useSubscriptions.ts # 🔹 Main subscription hook │ │ │ ├── useSubscriptionForm.ts # 🔹 Form hook │ │
│ └── useSubscriptionStats.ts # 🔹 Stats hook │ │ ├── components/ # 🔹 Subscription components │ │ │
├── SubscriptionFilters.tsx │ │ │ ├── SubscriptionActions.tsx │ │ │ └── SubscriptionCharts.tsx │ │
└── index.ts │ │ │ ├── billing-management/ # 🔹 Управление биллингом │ │ ├── api/ # 🔹 Billing API │
│ │ ├── queries.ts │ │ │ └── mutations.ts │ │ ├── hooks/ # 🔹 Billing hooks │ │ │ ├── usePayments.ts
│ │ │ ├── usePaymentForm.ts │ │ │ └── useBillingStats.ts │ │ ├── components/ # 🔹 Billing components
│ │ │ ├── PaymentFilters.tsx │ │ │ ├── RefundActions.tsx │ │ │ └── RevenueCharts.tsx # 🔹 Charts
widgets (вынести в shared/ui/organisms/charts/) │ │ └── index.ts │ │ │ └── ai-bot-management/ # 🔹
Управление AI-ботами │ ├── api/ # 🔹 Bot API │ │ ├── queries.ts │ │ └── mutations.ts │ ├── hooks/ #
🔹 Bot hooks │ │ ├── useBots.ts │ │ ├── useBotForm.ts │ │ └── useBotAnalytics.ts │ ├── components/ #
🔹 Bot components │ │ ├── BotFilters.tsx │ │ ├── TrainingActions.tsx │ │ └── PerformanceCharts.tsx #
🔹 Analytics widgets (вынести в shared/ui/organisms/analytics/) │ └── index.ts │ ├── shared/ # 🔹
Локальные shared ресурсы админки │ ├── types/ # 🔹 Локальные типы админки (TypeScript) │ ├──
constants/ # 🔹 Константы админки (TypeScript) │ └── styles/ # 🔹 Стили админки (CSS/Tailwind) │ ├──
dto/ # 🔹 Re-exports из apps/shared-ui/dto │ └── index.ts # 🔹 Все DTO для удобства импорта │ ├──
mappers/ # 🔹 Re-exports из apps/shared-ui/mappers │ └── index.ts # 🔹 Все мапперы для удобства
импорта │ ├── hooks/ # 🔹 Re-exports из apps/shared-ui/hooks + локальные │ ├── index.ts # 🔹 Shared
hooks + admin-specific │ ├── useAdminPermissions.ts # 🔹 Локальный admin hook (TypeScript + React +
FP + Effect) │ ├── feature-hooks.ts # 🔹 Повторяющиеся hooks между features (TypeScript + React +
FP + Effect) │ └── useFormProvider.ts # 🔹 Единый FormProvider для всех forms (TypeScript + React +
FP + Effect) │ ├── context/ # 🔹 Re-exports из apps/shared-ui/context │ └── index.ts # 🔹 Shared
context providers │ └── utils/ # 🔹 Локальные утилиты админки ├── date/ # 🔹 Работа с датами │ ├──
formatDate.ts # 🔹 Форматирование (TypeScript + FP) │ └── dateHelpers.ts # 🔹 Хелперы дат
(TypeScript + FP) ├── stats/ # 🔹 Статистические расчеты │ ├── calculateMetrics.ts # 🔹 Метрики
(TypeScript + FP) │ └── chartHelpers.ts # 🔹 Графики (TypeScript + FP) ├── validation/ # 🔹
Валидация форм │ ├── adminValidators.ts # 🔹 Admin валидаторы (TypeScript + FP + Zod) └── index.ts #
🔹 Экспорт всех утилит
