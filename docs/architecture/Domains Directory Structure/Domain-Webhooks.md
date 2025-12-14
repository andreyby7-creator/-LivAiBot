domain-webhooks/ # 🎯 Домен вебхуков (TypeScript + FP + Effect)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── README.md # 🔹 Обзор домена: Aggregates, VO, Events, Specifications, FP + Effect ├── index.ts #
🔹 Центральный экспорт всех сущностей, сервисов, спецификаций ├── entities/ # 🔹 Aggregates /
Entities (TypeScript + FP + Effect) │ ├── README.md # 🔹 Руководство по сущностям: Aggregate, FP/DDD
паттерны, Effect │ ├── index.ts # 🔹 Экспорт всех entity/aggregates │ └── Webhook.ts # 🔹 Aggregate:
Webhook, бизнес-логика вебхуков, FP + Effect ├── value-objects/ # 🔹 Value Objects (immutable, FP) │
├── README.md # 🔹 Руководство по VO: immutability, сравнение, FP │ ├── index.ts # 🔹 Экспорт всех
VO │ └── WebhookId.ts # 🔹 VO: идентификатор вебхука, immutable, FP ├── services/ # 🔹 Domain
Services (Pure / FP Effects) │ ├── README.md # 🔹 Руководство по сервисам: чистые функции, эффектные
функции, FP/Effect │ ├── index.ts # 🔹 Экспорт всех domain services │ └── WebhookService.ts # 🔹
Сервис обработки вебхуков, FP + Effect ├── events/ # 🔹 Domain Events (immutable, FP) │ ├──
README.md # 🔹 Руководство по событиям: Event-driven, immutable, FP │ ├── index.ts # 🔹 Экспорт всех
domain events │ └── WebhookReceivedEvent.ts # 🔹 Event: вебхук получен, immutable, FP ├──
specifications/ # 🔹 Domain Specifications / Business Rules │ ├── README.md # 🔹 Руководство по
спецификациям: комбинируемые правила бизнеса, FP │ ├── index.ts # 🔹 Экспорт всех specifications │
└── MaxWebhooksPerUserSpec.ts # 🔹 Спецификация: макс. количество вебхуков на пользователя, FP ├──
factories/ # 🔹 Aggregate/Entity Factories │ ├── README.md # 🔹 Руководство по фабрикам: создание
агрегатов и VO, чистые функции, FP │ ├── index.ts # 🔹 Экспорт всех фабрик │ └── WebhookFactory.ts #
🔹 Создание экземпляров Webhook, FP + Pure Function ├── state-machines/ # 🔹 Управление статусами
агрегатов │ ├── README.md # 🔹 Руководство по стейт-машинам: жизненный цикл вебхука │ ├── index.ts #
🔹 Экспорт всех state machines │ └── WebhookStateMachine.ts # 🔹 Стейт-машина вебхука
(active/failed/processed) ├── unit-of-work/ # 🔹 Unit of Work для транзакций с агрегатами │ ├──
README.md # 🔹 Руководство по UoW: транзакции агрегатов, FP + Effect │ └── IWebhooksUnitOfWork.ts #
🔹 Интерфейс UoW для домена вебхуков └── test/ # 🔹 Unit и property-based тесты (FP + Effect) ├──
README.md # 🔹 Руководство по тестированию домена ├── index.ts # 🔹 Экспорт всех тестов для
интеграции ├── entities/ │ ├── README.md │ ├── index.ts # 🔹 Экспорт всех тестов entity │ └──
Webhook.test.ts # 🔹 Unit Test для Webhook Aggregate, FP + Effect ├── services/ │ ├── README.md │
├── index.ts # 🔹 Экспорт всех тестов service │ └── WebhookService.test.ts # 🔹 Unit Test для
WebhookService, FP + Effect └── specifications/ ├── README.md ├── index.ts # 🔹 Экспорт всех тестов
спецификаций └── MaxWebhooksPerUserSpec.test.ts # 🔹 Unit Test для спецификации
MaxWebhooksPerUserSpec, FP
