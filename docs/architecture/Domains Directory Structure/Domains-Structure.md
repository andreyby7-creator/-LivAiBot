domains/ # ✅ ЧИСТЫЕ DDD домены (только бизнес-логика)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── domain-ai/ # 🎯 AI бизнес-домен (TypeScript + FP + Effect) │ ├── README.md # 🔹 Обзор домена,
Aggregate, VO, Domain Events, Specification │ ├── entities/ # 🔹 Aggregates / Entities (TypeScript +
FP + Effect) │ │ ├── README.md │ │ ├── Bot.ts # TypeScript + FP + Aggregate + Effect │ │ ├──
Model.ts # TypeScript + FP + Aggregate + Effect │ │ └── UserBotSettings.ts # TypeScript + FP + Value
Object (immutable) │ ├── value-objects/ # 🔹 Value Objects (immutable, FP) │ │ ├── README.md │ │ ├──
BotId.ts # TypeScript + FP + Value Object │ │ ├── ModelId.ts # TypeScript + FP + Value Object │ │
└── TokenAmount.ts # TypeScript + FP + Value Object │ ├── services/ # 🔹 Domain Services (Pure / FP
Effects) │ │ ├── README.md │ │ ├── BotOrchestrationService.ts # TypeScript + FP + Effect │ │ ├──
ModelSelectionService.ts # TypeScript + FP + Pure Function │ │ └── TokenManagementService.ts #
TypeScript + FP + Effect │ ├── events/ # 🔹 Domain Events (immutable, FP) │ │ ├── README.md │ │ ├──
BotCreatedEvent.ts # TypeScript + FP + Event │ │ ├── BotUpdatedEvent.ts # TypeScript + FP + Event │
│ └── ModelTrainedEvent.ts # TypeScript + FP + Event │ ├── specifications/ # 🔹 Domain
Specifications / Business Rules │ │ ├── README.md │ │ ├── MaxBotsPerUserSpec.ts # TypeScript + FP +
Specification │ │ └── TokenQuotaSpec.ts # TypeScript + FP + Specification │ ├── factories/ # 🔹
Aggregate/Entity Factories │ │ ├── README.md │ │ ├── BotFactory.ts # TypeScript + FP + Pure Function
│ │ └── ModelFactory.ts # TypeScript + FP + Pure Function │ ├── factories/ # 🔹 Aggregate/Entity
Factories │ │ ├── README.md │ │ ├── BotFactory.ts # TypeScript + FP + Pure Function │ │ └──
ModelFactory.ts # TypeScript + FP + Pure Function │ └── test/ # 🔹 Unit и property-based тесты (FP +
Effect) │ ├── README.md │ ├── entities/ │ │ ├── README.md │ │ └── Bot.test.ts # TypeScript + FP +
Unit Test │ ├── services/ │ │ ├── README.md │ │ └── BotOrchestrationService.test.ts │ └──
specifications/ │ ├── README.md │ └── MaxBotsPerUserSpec.test.ts ├── domain-subscriptions/ # 🎯
Домен подписок (TypeScript + FP + Effect) │ ├── README.md │ ├── entities/ │ │ ├── README.md │ │ ├──
Subscription.ts # TypeScript + FP + Aggregate + Effect │ │ └── Plan.ts # TypeScript + FP + Value
Object │ ├── value-objects/ │ │ ├── README.md │ │ ├── SubscriptionId.ts # TypeScript + FP + Value
Object │ │ └── PlanId.ts # TypeScript + FP + Value Object │ ├── services/ │ │ ├── README.md │ │ └──
SubscriptionService.ts # TypeScript + FP + Effect │ ├── events/ │ │ ├── README.md │ │ └──
SubscriptionCreatedEvent.ts # TypeScript + FP + Event │ ├── specifications/ │ │ ├── README.md │ │
└── MaxSubscriptionsPerUserSpec.ts # TypeScript + FP + Specification │ ├── factories/ │ │ ├──
README.md │ │ └── SubscriptionFactory.ts # TypeScript + FP + Pure Function │ └── test/ │ ├──
README.md │ └── SubscriptionService.test.ts ├── domain-billing/ # 🎯 Домен биллинга (TypeScript +
FP + Effect) │ ├── README.md │ ├── entities/ │ │ ├── README.md │ │ ├── Invoice.ts # TypeScript +
FP + Aggregate + Effect │ │ └── Payment.ts # TypeScript + FP + Aggregate + Effect │ ├──
value-objects/ │ │ ├── README.md │ │ ├── InvoiceId.ts # TypeScript + FP + Value Object │ │ └──
PaymentId.ts # TypeScript + FP + Value Object │ ├── services/ │ │ ├── README.md │ │ └──
BillingService.ts # TypeScript + FP + Effect │ ├── events/ │ │ ├── README.md │ │ └──
InvoicePaidEvent.ts # TypeScript + FP + Event │ ├── specifications/ │ │ ├── README.md │ │ └──
PaymentDueSpec.ts # TypeScript + FP + Specification │ ├── factories/ │ │ ├── README.md │ │ └──
InvoiceFactory.ts # TypeScript + FP + Pure Function │ └── test/ │ ├── README.md │ └──
BillingService.test.ts ├── domain-integrations/ # 🎯 Домен интеграций (TypeScript + FP + Effect) │
├── README.md │ ├── entities/ │ │ ├── README.md │ │ └── Integration.ts # TypeScript + FP +
Aggregate + Effect │ ├── value-objects/ │ │ ├── README.md │ │ └── IntegrationId.ts # TypeScript +
FP + Value Object │ ├── services/ │ │ ├── README.md │ │ └── IntegrationService.ts # TypeScript +
FP + Effect │ ├── events/ │ │ ├── README.md │ │ └── IntegrationConnectedEvent.ts # TypeScript + FP +
Event │ ├── specifications/ │ │ ├── README.md │ │ └── MaxIntegrationsPerUserSpec.ts # TypeScript +
FP + Specification │ ├── factories/ │ │ ├── README.md │ │ └── IntegrationFactory.ts # TypeScript +
FP + Pure Function │ └── test/ │ ├── README.md │ └── IntegrationService.test.ts ├──
domain-conversations/ # 🎯 Домен диалогов (TypeScript + FP + Effect) │ ├── README.md │ ├── entities/
│ │ ├── README.md │ │ └── Conversation.ts # TypeScript + FP + Aggregate + Effect │ ├──
value-objects/ │ │ ├── README.md │ │ └── ConversationId.ts # TypeScript + FP + Value Object │ ├──
services/ │ │ ├── README.md │ │ └── ConversationService.ts # TypeScript + FP + Effect │ ├── events/
│ │ ├── README.md │ │ └── MessageSentEvent.ts # TypeScript + FP + Event │ ├── specifications/ │ │
├── README.md │ │ └── MaxMessagesPerConversationSpec.ts # TypeScript + FP + Specification │ ├──
factories/ │ │ ├── README.md │ │ └── ConversationFactory.ts # TypeScript + FP + Pure Function │ └──
test/ │ ├── README.md │ └── ConversationService.test.ts └── domain-webhooks/ # 🎯 Домен вебхуков
(TypeScript + FP + Effect) ├── README.md ├── entities/ │ ├── README.md │ └── Webhook.ts #
TypeScript + FP + Aggregate + Effect ├── value-objects/ │ ├── README.md │ └── WebhookId.ts #
TypeScript + FP + Value Object ├── services/ │ ├── README.md │ └── WebhookService.ts # TypeScript +
FP + Effect ├── events/ │ ├── README.md │ └── WebhookReceivedEvent.ts # TypeScript + FP + Event ├──
specifications/ │ ├── README.md │ └── MaxWebhooksPerUserSpec.ts # TypeScript + FP + Specification
├── factories/ │ ├── README.md │ └── WebhookFactory.ts # TypeScript + FP + Pure Function └── test/
├── README.md └── WebhookService.test.ts
