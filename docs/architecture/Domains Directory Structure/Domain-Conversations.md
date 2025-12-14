domain-conversations/ # 🎯 Домен диалогов (TypeScript + FP + Effect)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── README.md # 🔹 Обзор домена: Aggregates, VO, Events, Specifications, FP + Effect ├── index.ts #
🔹 Центральный экспорт всех сущностей, сервисов, спецификаций ├── entities/ # 🔹 Aggregates /
Entities (TypeScript + FP + Effect) │ ├── README.md # 🔹 Руководство по сущностям: Aggregate, FP/DDD
паттерны, Effect │ ├── index.ts # 🔹 Экспорт всех entity/aggregates │ └── Conversation.ts # 🔹
Aggregate: Conversation, бизнес-логика диалогов, FP + Effect ├── value-objects/ # 🔹 Value Objects
(immutable, FP) │ ├── README.md # 🔹 Руководство по VO: immutability, сравнение, FP │ ├── index.ts #
🔹 Экспорт всех VO │ └── ConversationId.ts # 🔹 VO: идентификатор диалога, immutable, FP ├──
services/ # 🔹 Domain Services (Pure / FP Effects) │ ├── README.md # 🔹 Руководство по сервисам:
чистые функции, эффектные функции, FP/Effect │ ├── index.ts # 🔹 Экспорт всех domain services │ └──
ConversationService.ts # 🔹 Сервис управления диалогами, FP + Effect ├── events/ # 🔹 Domain Events
(immutable, FP) │ ├── README.md # 🔹 Руководство по событиям: Event-driven, immutable, FP │ ├──
index.ts # 🔹 Экспорт всех domain events │ └── MessageSentEvent.ts # 🔹 Event: сообщение отправлено,
immutable, FP ├── specifications/ # 🔹 Domain Specifications / Business Rules │ ├── README.md # 🔹
Руководство по спецификациям: комбинируемые правила бизнеса, FP │ ├── index.ts # 🔹 Экспорт всех
specifications │ └── MaxMessagesPerConversationSpec.ts # 🔹 Спецификация: макс. количество сообщений
в диалоге, FP ├── factories/ # 🔹 Aggregate/Entity Factories │ ├── README.md # 🔹 Руководство по
фабрикам: создание агрегатов и VO, чистые функции, FP │ ├── index.ts # 🔹 Экспорт всех фабрик │ └──
ConversationFactory.ts # 🔹 Создание экземпляров Conversation, FP + Pure Function ├──
state-machines/ # 🔹 Управление статусами агрегатов │ ├── README.md # 🔹 Руководство по
стейт-машинам: жизненный цикл диалогов │ ├── index.ts # 🔹 Экспорт всех state machines │ └──
ConversationStateMachine.ts # 🔹 Стейт-машина диалога (active/archived/closed) ├── unit-of-work/ #
🔹 Unit of Work для транзакций с агрегатами │ ├── README.md # 🔹 Руководство по UoW: транзакции
агрегатов, FP + Effect │ └── IConversationsUnitOfWork.ts # 🔹 Интерфейс UoW для домена диалогов └──
test/ # 🔹 Unit и property-based тесты (FP + Effect) ├── README.md # 🔹 Руководство по тестированию
домена ├── index.ts # 🔹 Экспорт всех тестов для интеграции ├── entities/ │ ├── README.md │ ├──
index.ts # 🔹 Экспорт всех тестов entity │ └── Conversation.test.ts # 🔹 Unit Test для Conversation
Aggregate, FP + Effect ├── services/ │ ├── README.md │ ├── index.ts # 🔹 Экспорт всех тестов service
│ └── ConversationService.test.ts # 🔹 Unit Test для ConversationService, FP + Effect └──
specifications/ ├── README.md ├── index.ts # 🔹 Экспорт всех тестов спецификаций └──
MaxMessagesPerConversationSpec.test.ts # 🔹 Unit Test для спецификации
MaxMessagesPerConversationSpec, FP
