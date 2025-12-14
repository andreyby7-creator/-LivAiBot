domain-subscriptions/ # 🎯 Домен подписок (TypeScript + FP + Effect)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── README.md # 🔹 Обзор домена: Aggregates, VO, Events, Specifications, FP и Effect подходы ├──
index.ts # 🔹 Центральный экспорт всех сущностей, сервисов, спецификаций ├── entities/ # 🔹
Aggregates / Entities (TypeScript + FP + Effect) │ ├── README.md # 🔹 Руководство по сущностям:
Aggregates и Entities, FP/DDD паттерны, Effect │ ├── index.ts # 🔹 Экспорт всех entity/aggregates │
├── Subscription.ts # 🔹 Aggregate: Subscription, бизнес-логика создания/управления, FP + Effect │
├── Plan.ts # 🔹 VO: План подписки, immutable, FP │ └── SubscriptionUsage.ts # 🔹 Aggregate/VO:
отслеживание использования подписки, FP ├── value-objects/ # 🔹 Value Objects (immutable, FP) │ ├──
README.md # 🔹 Руководство по VO: immutability, сравнение, FP-паттерны │ ├── index.ts # 🔹 Экспорт
всех VO │ ├── SubscriptionId.ts # 🔹 VO: идентификатор подписки, immutable, FP │ ├── PlanId.ts # 🔹
VO: идентификатор плана, immutable, FP │ └── UserId.ts # 🔹 VO: идентификатор пользователя,
immutable, FP ├── services/ # 🔹 Domain Services (Pure / FP Effects) │ ├── README.md # 🔹
Руководство по сервисам: чистые функции, эффектные функции, FP/Effect │ ├── index.ts # 🔹 Экспорт
всех domain services │ ├── SubscriptionService.ts # 🔹 Сервис управления подписками, Effect + FP │
├── PlanManagementService.ts # 🔹 Сервис управления планами подписки, FP + Effect │ └──
SubscriptionUsageService.ts # 🔹 Управление использованием подписок, FP + Effect ├── events/ # 🔹
Domain Events (immutable, FP) │ ├── README.md # 🔹 Руководство по событиям: Event-driven, immutable,
FP │ ├── index.ts # 🔹 Экспорт всех domain events │ ├── SubscriptionCreatedEvent.ts # 🔹 Event:
подписка создана │ ├── SubscriptionCancelledEvent.ts # 🔹 Event: подписка отменена │ └──
PlanChangedEvent.ts # 🔹 Event: смена плана ├── specifications/ # 🔹 Domain Specifications /
Business Rules │ ├── README.md # 🔹 Руководство по спецификациям: комбинируемые правила бизнеса, FP
│ ├── index.ts # 🔹 Экспорт всех specifications │ ├── MaxSubscriptionsPerUserSpec.ts # 🔹
Спецификация: макс. количество подписок на пользователя │ ├── PlanEligibilitySpec.ts # 🔹
Спецификация: соответствие пользователя плану │ └── SubscriptionActiveSpec.ts # 🔹 Спецификация:
проверка, что подписка активна ├── factories/ # 🔹 Aggregate/Entity Factories │ ├── README.md # 🔹
Руководство по фабрикам: создание агрегатов и VO, чистые функции, FP │ ├── index.ts # 🔹 Экспорт
всех фабрик │ ├── SubscriptionFactory.ts # 🔹 Создание экземпляров Subscription, FP + Pure Function
│ ├── PlanFactory.ts # 🔹 Создание экземпляров Plan, FP + Pure Function │ └──
SubscriptionUsageFactory.ts # 🔹 Создание экземпляров SubscriptionUsage, FP + Pure Function ├──
state-machines/ # 🔹 Управление статусами агрегатов │ ├── README.md # 🔹 Руководство по
стейт-машинам: жизненный цикл агрегатов │ ├── index.ts # 🔹 Экспорт всех state machines │ ├──
SubscriptionStateMachine.ts # 🔹 Стейт-машина подписки (active/inactive/cancelled) │ └──
PlanStateMachine.ts # 🔹 Стейт-машина плана (available/retired) ├── unit-of-work/ # 🔹 Unit of Work
для транзакций с агрегатами │ ├── README.md # 🔹 Руководство по UoW: транзакции агрегатов, FP +
Effect │ └── ISubscriptionsUnitOfWork.ts # 🔹 Интерфейс UoW для домена подписок └── test/ # 🔹 Unit
и property-based тесты (FP + Effect) ├── README.md # 🔹 Руководство по тестированию домена ├──
index.ts # 🔹 Экспорт всех тестов для интеграции ├── entities/ │ ├── README.md │ ├── index.ts # 🔹
Экспорт всех тестов entity │ ├── Subscription.test.ts # 🔹 Unit Test для Subscription, FP + Effect │
└── Plan.test.ts # 🔹 Unit Test для Plan, FP + Effect ├── services/ │ ├── README.md │ ├── index.ts #
🔹 Экспорт всех тестов service │ ├── SubscriptionService.test.ts # 🔹 Unit Test для сервиса
подписок, FP + Effect │ └── PlanManagementService.test.ts # 🔹 Unit Test для сервиса планов, FP +
Effect └── specifications/ ├── README.md ├── index.ts # 🔹 Экспорт всех тестов спецификаций └──
MaxSubscriptionsPerUserSpec.test.ts # 🔹 Unit Test для спецификации макс. подписок, FP
