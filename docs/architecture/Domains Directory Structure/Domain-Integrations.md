domain-integrations/ # 🎯 Домен интеграций (TypeScript + FP + Effect)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── README.md # 🔹 Обзор домена: Aggregates, VO, Events, Specifications, FP и Effect подходы ├──
index.ts # 🔹 Центральный экспорт всех сущностей, сервисов, спецификаций ├── entities/ # 🔹
Aggregates / Entities (TypeScript + FP + Effect) │ ├── README.md # 🔹 Руководство по сущностям:
Aggregate, FP/DDD паттерны, Effect │ ├── index.ts # 🔹 Экспорт всех entity/aggregates │ └──
Integration.ts # 🔹 Aggregate: Integration, бизнес-логика интеграций, FP + Effect ├──
value-objects/ # 🔹 Value Objects (immutable, FP) │ ├── README.md # 🔹 Руководство по VO:
immutability, сравнение, FP │ ├── index.ts # 🔹 Экспорт всех VO │ └── IntegrationId.ts # 🔹 VO:
идентификатор интеграции, immutable, FP ├── services/ # 🔹 Domain Services (Pure / FP Effects) │ ├──
README.md # 🔹 Руководство по сервисам: чистые функции, эффектные функции, FP/Effect │ ├──
index.ts # 🔹 Экспорт всех domain services │ └── IntegrationService.ts # 🔹 Сервис управления
интеграциями, FP + Effect ├── events/ # 🔹 Domain Events (immutable, FP) │ ├── README.md # 🔹
Руководство по событиям: Event-driven, immutable, FP │ ├── index.ts # 🔹 Экспорт всех domain events
│ └── IntegrationConnectedEvent.ts # 🔹 Event: интеграция подключена, immutable, FP ├──
specifications/ # 🔹 Domain Specifications / Business Rules │ ├── README.md # 🔹 Руководство по
спецификациям: комбинируемые правила бизнеса, FP │ ├── index.ts # 🔹 Экспорт всех specifications │
└── MaxIntegrationsPerUserSpec.ts # 🔹 Спецификация: макс. количество интеграций на пользователя, FP
├── factories/ # 🔹 Aggregate/Entity Factories │ ├── README.md # 🔹 Руководство по фабрикам:
создание агрегатов и VO, чистые функции, FP │ ├── index.ts # 🔹 Экспорт всех фабрик │ └──
IntegrationFactory.ts # 🔹 Создание экземпляров Integration, FP + Pure Function ├──
state-machines/ # 🔹 Управление статусами агрегатов │ ├── README.md # 🔹 Руководство по
стейт-машинам: жизненный цикл агрегатов │ ├── index.ts # 🔹 Экспорт всех state machines │ └──
IntegrationStateMachine.ts # 🔹 Стейт-машина интеграции (pending/connected/disconnected) ├──
unit-of-work/ # 🔹 Unit of Work для транзакций с агрегатами │ ├── README.md # 🔹 Руководство по UoW:
транзакции агрегатов, FP + Effect │ └── IIntegrationsUnitOfWork.ts # 🔹 Интерфейс UoW для домена
интеграций └── test/ # 🔹 Unit и property-based тесты (FP + Effect) ├── README.md # 🔹 Руководство
по тестированию домена ├── index.ts # 🔹 Экспорт всех тестов для интеграции ├── entities/ │ ├──
README.md │ ├── index.ts # 🔹 Экспорт всех тестов entity │ └── Integration.test.ts # 🔹 Unit Test
для Integration Aggregate, FP + Effect ├── services/ │ ├── README.md │ ├── index.ts # 🔹 Экспорт
всех тестов service │ └── IntegrationService.test.ts # 🔹 Unit Test для IntegrationService, FP +
Effect └── specifications/ ├── README.md ├── index.ts # 🔹 Экспорт всех тестов спецификаций └──
MaxIntegrationsPerUserSpec.test.ts # 🔹 Unit Test для спецификации MaxIntegrationsPerUserSpec, FP
