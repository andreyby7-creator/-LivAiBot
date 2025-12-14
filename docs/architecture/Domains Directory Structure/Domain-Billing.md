domain-billing/ # 🎯 Домен биллинга (TypeScript + FP + Effect)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── README.md # 🔹 Обзор домена: Aggregates, VO, Events, Specifications, FP и Effect подходы ├──
index.ts # 🔹 Центральный экспорт всех сущностей, сервисов, спецификаций ├── entities/ # 🔹
Aggregates / Entities (TypeScript + FP + Effect) │ ├── README.md # 🔹 Руководство по сущностям:
Aggregate и Entity, FP/DDD паттерны, Effect │ ├── index.ts # 🔹 Экспорт всех entity/aggregates │ ├──
Invoice.ts # 🔹 Aggregate: Invoice, бизнес-логика создания и управления счетами, FP + Effect │ └──
Payment.ts # 🔹 Aggregate: Payment, бизнес-логика обработки платежей, FP + Effect ├──
value-objects/ # 🔹 Value Objects (immutable, FP) │ ├── README.md # 🔹 Руководство по VO:
immutability, сравнение, FP паттерны │ ├── index.ts # 🔹 Экспорт всех VO │ ├── InvoiceId.ts # 🔹 VO:
идентификатор счета, immutable, FP │ └── PaymentId.ts # 🔹 VO: идентификатор платежа, immutable, FP
├── services/ # 🔹 Domain Services (Pure / FP Effects) │ ├── README.md # 🔹 Руководство по сервисам:
чистые функции, эффектные функции, FP/Effect │ ├── index.ts # 🔹 Экспорт всех domain services │ └──
BillingService.ts # 🔹 Сервис управления счетами и платежами, FP + Effect ├── events/ # 🔹 Domain
Events (immutable, FP) │ ├── README.md # 🔹 Руководство по событиям: Event-driven, immutable, FP │
├── index.ts # 🔹 Экспорт всех domain events │ └── InvoicePaidEvent.ts # 🔹 Event: счет оплачен,
immutable, FP ├── specifications/ # 🔹 Domain Specifications / Business Rules │ ├── README.md # 🔹
Руководство по спецификациям: комбинируемые правила бизнеса, FP │ ├── index.ts # 🔹 Экспорт всех
specifications │ └── PaymentDueSpec.ts # 🔹 Спецификация: проверка задолженности по платежу, FP ├──
factories/ # 🔹 Aggregate/Entity Factories │ ├── README.md # 🔹 Руководство по фабрикам: создание
агрегатов и VO, чистые функции, FP │ ├── index.ts # 🔹 Экспорт всех фабрик │ ├── InvoiceFactory.ts #
🔹 Создание экземпляров Invoice, FP + Pure Function │ └── PaymentFactory.ts # 🔹 Создание
экземпляров Payment, FP + Pure Function ├── state-machines/ # 🔹 Управление статусами агрегатов │
├── README.md # 🔹 Руководство по стейт-машинам: жизненный цикл агрегатов │ ├── index.ts # 🔹
Экспорт всех state machines │ ├── InvoiceStateMachine.ts # 🔹 Стейт-машина счета
(draft/issued/paid/cancelled) │ └── PaymentStateMachine.ts # 🔹 Стейт-машина платежа
(pending/completed/failed/refunded) ├── unit-of-work/ # 🔹 Unit of Work для транзакций с агрегатами
│ ├── README.md # 🔹 Руководство по UoW: транзакции агрегатов, FP + Effect │ └──
IBillingUnitOfWork.ts # 🔹 Интерфейс UoW для домена биллинга └── test/ # 🔹 Unit и property-based
тесты (FP + Effect) ├── README.md # 🔹 Руководство по тестированию домена ├── index.ts # 🔹 Экспорт
всех тестов для интеграции ├── entities/ │ ├── README.md │ ├── index.ts # 🔹 Экспорт всех тестов
entity │ ├── Invoice.test.ts # 🔹 Unit Test для Invoice Aggregate, FP + Effect │ └──
Payment.test.ts # 🔹 Unit Test для Payment Aggregate, FP + Effect ├── services/ │ ├── README.md │
├── index.ts # 🔹 Экспорт всех тестов service │ └── BillingService.test.ts # 🔹 Unit Test для
BillingService, FP + Effect └── specifications/ ├── README.md ├── index.ts # 🔹 Экспорт всех тестов
спецификаций └── PaymentDueSpec.test.ts # 🔹 Unit Test для спецификации PaymentDueSpec, FP
