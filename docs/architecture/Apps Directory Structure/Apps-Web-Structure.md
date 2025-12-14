apps/web/ # 🔹 Тонкий UI слой для веб-пользователей (Next.js 16+ + TypeScript + React + FP + Effect)
└── src/ ├── app/ # 🔹 Next.js 16+ App Router (public + protected routing) │ ├── (public)/ # 🔹
Public routes group (landing, auth) │ │ ├── layout.tsx # 🔹 Public layout (TypeScript + React + FP)
│ │ ├── page.tsx # 🔹 Landing page (TypeScript + React + FP) │ │ ├── pricing/ # 🔹 Pricing page │ │
│ └── page.tsx # 🔹 Тарифы и подписки (TypeScript + React + FP) │ │ ├── about/ # 🔹 About page │ │ │
└── page.tsx # 🔹 О компании (TypeScript + React + FP) │ │ └── auth/ # 🔹 Auth routes │ │ ├──
login/ # 🔹 Login page │ │ │ └── page.tsx # 🔹 Форма входа (TypeScript + React + FP) │ │ └──
register/ # 🔹 Register page │ │ └── page.tsx # 🔹 Форма регистрации (TypeScript + React + FP) │ │ │
├── (protected)/ # 🔹 Protected routes group (authenticated users) │ │ ├── layout.tsx # 🔹 Protected
layout (TypeScript + React + FP) │ │ ├── dashboard/ # 🔹 User dashboard │ │ │ └── page.tsx # 🔹
Главная панель пользователя (TypeScript + React + FP) │ │ ├── profile/ # 🔹 Profile routes │ │ │ ├──
page.tsx # 🔹 Страница профиля (TypeScript + React + FP) │ │ │ └── edit/ # 🔹 Edit profile │ │ │ └──
page.tsx # 🔹 Форма редактирования профиля (TypeScript + React + FP) │ │ ├── subscriptions/ # 🔹
Subscriptions routes │ │ │ ├── page.tsx # 🔹 Список подписок (TypeScript + React + FP) │ │ │ └──
[id]/ # 🔹 Subscription details │ │ │ └── page.tsx # 🔹 Детали подписки (TypeScript + React + FP) │
│ ├── billing/ # 🔹 Billing routes │ │ │ ├── page.tsx # 🔹 История платежей (TypeScript + React +
FP) │ │ │ └── [id]/ # 🔹 Payment details │ │ │ └── page.tsx # 🔹 Детали платежа (TypeScript +
React + FP) │ │ ├── bots/ # 🔹 AI Bots routes │ │ │ ├── page.tsx # 🔹 Список ботов (TypeScript +
React + FP) │ │ │ ├── [id]/ # 🔹 Bot details │ │ │ │ └── page.tsx # 🔹 Детали бота (TypeScript +
React + FP) │ │ │ └── chat/ # 🔹 Chat interface │ │ │ └── [botId]/ # 🔹 Chat with specific bot │ │ │
└── page.tsx # 🔹 AI Chat interface (TypeScript + React + FP + WebSocket) │ │ └── notifications/ #
🔹 Notifications routes │ │ └── page.tsx # 🔹 Уведомления пользователя (TypeScript + React + FP) │ │
│ ├── layout.tsx # 🔹 Root layout (TypeScript + React + FP) │ ├── loading.tsx # 🔹 Global loading
(TypeScript + React + FP) │ ├── not-found.tsx # 🔹 404 page (TypeScript + React + FP) │ └──
error.tsx # 🔹 Error boundary (TypeScript + React + FP) │ ├── components/ # 🔹 Локальные UI
компоненты (web-specific) │ ├── layout/ # 🔹 Layout components │ │ ├── WebLayout.tsx # 🔹 Main web
layout (TypeScript + React + FP) │ │ ├── PublicHeader.tsx # 🔹 Header for public pages (TypeScript +
React + FP) │ │ ├── ProtectedHeader.tsx # 🔹 Header for authenticated users (TypeScript + React +
FP) │ │ ├── Sidebar.tsx # 🔹 User sidebar navigation (TypeScript + React + FP) │ │ └── Footer.tsx #
🔹 Web footer (TypeScript + React + FP) │ │ │ ├── landing/ # 🔹 Landing page components │ │ ├──
HeroSection.tsx # 🔹 Hero section (TypeScript + React + FP) │ │ ├── FeaturesSection.tsx # 🔹
Features showcase (TypeScript + React + FP) │ │ ├── PricingSection.tsx # 🔹 Pricing cards
(TypeScript + React + FP) │ │ └── TestimonialsSection.tsx # 🔹 Testimonials (TypeScript + React +
FP) │ │ │ ├── dashboard/ # 🔹 Dashboard components │ │ ├── UserStats.tsx # 🔹 User statistics cards
(TypeScript + React + FP) │ │ ├── RecentActivity.tsx # 🔹 Recent user activity (TypeScript + React +
FP) │ │ ├── QuickActions.tsx # 🔹 Quick action buttons (TypeScript + React + FP) │ │ └──
UsageOverview.tsx # 🔹 Token/usage overview (TypeScript + React + FP) │ │ │ ├── chat/ # 🔹 AI Chat
components │ │ ├── ChatInterface.tsx # 🔹 Main chat UI (TypeScript + React + FP + WebSocket) │ │ ├──
MessageBubble.tsx # 🔹 Message bubble component (TypeScript + React + FP) │ │ ├──
TypingIndicator.tsx # 🔹 Typing indicator (TypeScript + React + FP) │ │ ├── ChatHistory.tsx # 🔹
Chat history component (TypeScript + React + FP) │ │ └── MessageInput.tsx # 🔹 Message input with
attachments (TypeScript + React + FP) │ │ │ ├── forms/ # 🔹 Web forms │ │ ├── AuthForm.tsx # 🔹
Login/Register form (TypeScript + React + FP) │ │ ├── ProfileForm.tsx # 🔹 Profile edit form
(TypeScript + React + FP) │ │ ├── SubscriptionForm.tsx # 🔹 Subscription management form
(TypeScript + React + FP) │ │ ├── PaymentForm.tsx # 🔹 Payment form (TypeScript + React + FP) │ │
└── BotConfigForm.tsx # 🔹 Bot configuration form (TypeScript + React + FP) │ │ │ ├── tables/ # 🔹
Data tables (simpler than admin) │ │ ├── SubscriptionsTable.tsx # 🔹 User subscriptions
(TypeScript + React + FP) │ │ ├── PaymentsTable.tsx # 🔹 User payments (TypeScript + React + FP) │ │
└── BotsTable.tsx # 🔹 User bots (TypeScript + React + FP) │ │ │ ├── notifications/ # 🔹
Notification components │ │ ├── NotificationList.tsx # 🔹 List of notifications (TypeScript +
React + FP) │ │ ├── NotificationItem.tsx # 🔹 Single notification (TypeScript + React + FP) │ │ └──
NotificationSettings.tsx # 🔹 Notification preferences (TypeScript + React + FP) │ │ │ └── modals/ #
🔹 Modal dialogs │ ├── ConfirmDialog.tsx # 🔹 Confirmation dialog (TypeScript + React + FP) │ ├──
PaymentModal.tsx # 🔹 Payment processing modal (TypeScript + React + FP) │ └── SettingsModal.tsx #
🔹 User settings modal (TypeScript + React + FP) │ ├── features/ # 🔹 Feature-based UI логика
(web-specific) │ ├── auth/ # 🔹 Authentication feature │ │ ├── api/ # 🔹 Auth API calls │ │ │ ├──
queries.ts # 🔹 Auth status queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹
Login/logout mutations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Auth hooks │ │ │ ├──
useAuth.ts # 🔹 Main auth hook (TypeScript + React + FP + Effect) │ │ │ ├── useLogin.ts # 🔹 Login
hook (TypeScript + React + FP + Effect) │ │ │ └── useRegister.ts # 🔹 Register hook (TypeScript +
React + FP + Effect) │ │ └── components/ # 🔹 Auth components │ │ ├── LoginForm.tsx # 🔹 Login form
component (TypeScript + React + FP) │ │ └── RegisterForm.tsx # 🔹 Register form component
(TypeScript + React + FP) │ │ │ ├── profile/ # 🔹 User profile feature │ │ ├── api/ # 🔹 Profile API
│ │ │ ├── queries.ts # 🔹 Profile data queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts #
🔹 Profile update mutations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Profile hooks │ │ │ ├──
useProfile.ts # 🔹 Profile data hook (TypeScript + React + FP + Effect) │ │ │ └──
useProfileForm.ts # 🔹 Profile form hook (TypeScript + React + FP + Effect) │ │ └── components/ # 🔹
Profile components │ │ ├── ProfileHeader.tsx # 🔹 Profile header (TypeScript + React + FP) │ │ └──
ProfileStats.tsx # 🔹 Profile statistics (TypeScript + React + FP) │ │ │ ├── subscriptions/ # 🔹
Subscriptions management │ │ ├── api/ # 🔹 Subscription API │ │ │ ├── queries.ts # 🔹 Subscription
queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Subscription mutations (TypeScript +
FP + Effect) │ │ ├── hooks/ # 🔹 Subscription hooks │ │ │ ├── useSubscriptions.ts # 🔹 Subscriptions
list hook (TypeScript + React + FP + Effect) │ │ │ ├── useSubscriptionForm.ts # 🔹 Subscription form
hook (TypeScript + React + FP + Effect) │ │ │ └── useSubscriptionStats.ts # 🔹 Subscription stats
hook (TypeScript + React + FP + Effect) │ │ └── components/ # 🔹 Subscription components │ │ ├──
SubscriptionCard.tsx # 🔹 Subscription card (TypeScript + React + FP) │ │ ├──
SubscriptionFilters.tsx # 🔹 Subscription filters (TypeScript + React + FP) │ │ └──
SubscriptionCharts.tsx # 🔹 Subscription charts (TypeScript + React + FP + Chart.js/Recharts) →
shared/ui/organisms/charts/ │ │ │ ├── billing/ # 🔹 Billing & payments │ │ ├── api/ # 🔹 Billing API
│ │ │ ├── queries.ts # 🔹 Payment queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹
Payment mutations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Billing hooks │ │ │ ├──
usePayments.ts # 🔹 Payments list hook (TypeScript + React + FP + Effect) │ │ │ ├──
usePaymentForm.ts # 🔹 Payment form hook (TypeScript + React + FP + Effect) │ │ │ └──
useBillingStats.ts # 🔹 Billing stats hook (TypeScript + React + FP + Effect) │ │ └── components/ #
🔹 Billing components │ │ ├── PaymentCard.tsx # 🔹 Payment card (TypeScript + React + FP) │ │ ├──
InvoiceViewer.tsx # 🔹 Invoice viewer (TypeScript + React + FP) │ │ └── RevenueCharts.tsx # 🔹
Revenue charts (TypeScript + React + FP + Chart.js/Recharts) → shared/ui/organisms/charts/ │ │ │ ├──
ai-chat/ # 🔹 AI Chat feature (core web feature) │ │ ├── api/ # 🔹 Chat API (WebSocket + HTTP) │ │ │
├── queries.ts # 🔹 Chat history queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Chat
message mutations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Chat hooks │ │ │ ├── useChat.ts #
🔹 Main chat hook (TypeScript + React + FP + Effect + WebSocket) │ │ │ ├── useChatMessages.ts # 🔹
Messages management (TypeScript + React + FP + Effect) │ │ │ └── useChatTyping.ts # 🔹 Typing
indicators (TypeScript + React + FP + Effect) │ │ └── components/ # 🔹 Chat components │ │ ├──
ChatContainer.tsx # 🔹 Chat container (TypeScript + React + FP) │ │ ├── MessageList.tsx # 🔹
Messages list (TypeScript + React + FP) │ │ └── ChatInput.tsx # 🔹 Chat input with file upload
(TypeScript + React + FP) │ │ │ ├── notifications/ # 🔹 User notifications │ │ ├── api/ # 🔹
Notifications API │ │ │ ├── queries.ts # 🔹 Notification queries (TypeScript + FP + Effect) │ │ │
└── mutations.ts # 🔹 Notification mutations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹
Notification hooks │ │ │ ├── useNotifications.ts # 🔹 Notifications list hook (TypeScript + React +
FP + Effect) │ │ │ └── useNotificationSettings.ts # 🔹 Notification settings hook (TypeScript +
React + FP + Effect) │ │ └── components/ # 🔹 Notification components │ │ ├── NotificationBell.tsx #
🔹 Notification bell icon (TypeScript + React + FP) │ │ └── NotificationPanel.tsx # 🔹 Notification
dropdown/panel (TypeScript + React + FP) │ │ │ └── pwa/ # 🔹 PWA features │ ├── api/ # 🔹 PWA API
(service worker, push) │ │ └── service-worker.ts # 🔹 Service worker registration (TypeScript + FP)
│ ├── hooks/ # 🔹 PWA hooks │ │ ├── usePWAInstall.ts # 🔹 PWA install hook (TypeScript + React +
FP + Effect) │ │ ├── usePushNotifications.ts # 🔹 Push notifications hook (TypeScript + React + FP +
Effect) │ │ └── useOfflineStatus.ts # 🔹 Offline/online status hook (TypeScript + React + FP +
Effect) │ └── components/ # 🔹 PWA components │ ├── InstallPrompt.tsx # 🔹 PWA install prompt
(TypeScript + React + FP) │ └── OfflineIndicator.tsx # 🔹 Offline indicator (TypeScript + React +
FP) │ ├── dto/ # 🔹 Re-exports из apps/shared-ui/dto │ └── index.ts # 🔹 Все DTO для импорта
(TypeScript + FP) │ ├── mappers/ # 🔹 Re-exports из apps/shared-ui/mappers │ └── index.ts # 🔹 Все
мапперы для импорта (TypeScript + FP) │ ├── hooks/ # 🔹 Re-exports из apps/shared-ui/hooks +
локальные │ ├── index.ts # 🔹 Shared hooks + web-specific hooks (TypeScript + React + FP + Effect) │
├── useFormProvider.ts # 🔹 Единый FormProvider для консистентного state management (TypeScript +
React + FP + Effect) │ ├── feature-hooks.ts # 🔹 Повторяющиеся hooks между features (TypeScript +
React + FP + Effect) │ └── useWebSpecific.ts # 🔹 Web-specific hooks (PWA, routing) (TypeScript +
React + FP + Effect) │ ├── context/ # 🔹 Re-exports из apps/shared-ui/context + web-specific │ ├──
index.ts # 🔹 Shared contexts + web contexts (TypeScript + React + FP + Effect) │ └──
WebContext.tsx # 🔹 Web-specific context (PWA, offline) (TypeScript + React + FP + Effect) │ ├──
lib/ # 🔹 Web-specific libraries │ ├── pwa/ # 🔹 PWA utilities │ │ ├── manifest.json # 🔹 PWA
manifest │ │ ├── sw.ts # 🔹 Service worker (TypeScript + FP) │ │ └── push-manager.ts # 🔹 Push
notification manager (TypeScript + FP) │ ├── websocket/ # 🔹 WebSocket client for real-time chat │ │
├── chat-ws-client.ts # 🔹 Chat WebSocket client (TypeScript + FP + Effect) │ │ └── ws-hooks.ts # 🔹
WebSocket hooks (TypeScript + React + FP + Effect) │ └── analytics/ # 🔹 Web analytics (PostHog,
etc.) │ └── web-analytics.ts # 🔹 Web analytics tracking (TypeScript + FP) │ └── utils/ # 🔹
Локальные утилиты веба ├── date/ # 🔹 Работа с датами │ ├── formatDate.ts # 🔹 Форматирование дат
(TypeScript + FP) │ └── dateHelpers.ts # 🔹 Хелперы дат (TypeScript + FP) ├── formatting/ # 🔹
Форматирование данных │ ├── currency.ts # 🔹 Форматирование валюты (TypeScript + FP) │ ├──
numbers.ts # 🔹 Форматирование чисел (TypeScript + FP) │ └── text.ts # 🔹 Форматирование текста
(TypeScript + FP) ├── validation/ # 🔹 Валидация форм │ └── webValidators.ts # 🔹 Web-специфичная
валидация (TypeScript + FP + Zod) ├── pwa/ # 🔹 PWA утилиты │ ├── installHelpers.ts # 🔹 PWA install
helpers (TypeScript + FP) │ └── offlineHelpers.ts # 🔹 Offline helpers (TypeScript + FP) └──
index.ts # 🔹 Экспорт всех утилит (TypeScript + FP)
