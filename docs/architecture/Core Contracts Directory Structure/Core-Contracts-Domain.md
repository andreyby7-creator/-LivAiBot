core-contracts/ 
│   ├── src/ 
│   ├── domain/ # 🔹 Domain Layer микросервисы (DDD, TypeScript + FP Core) │ ├─
index.ts # Центральный экспорт всех domain микросервисов │ 
│   ├── aggregates/ # 🔹 Базовые и auditable
агрегаты │ │ 
│   ├── AuditableAggregateRoot.ts # Базовый AggregateRoot с audit-полями │ │ ├─
AuditableEntity.ts # Entity с audit-полями │ │ 
│   ├── BaseDomainEvent.ts # Базовый DomainEvent │ │ ├─
BaseEntity.ts # Базовый Entity │ │ 
│   └── examples/ # Примеры агрегатов (для reference) │ │ ├─
CampaignAggregate.ts # Пример агрегата для маркетинговых кампаний │ │ 
│   ├── OrderAggregate.ts # Пример
агрегата для заказов/покупок │ │ 
│   ├── TenantAggregate.ts # Пример агрегата для multi-tenant систем │ │

│   └── index.ts # Экспорт всех примеров агрегатов │ 
│   ├── comparable/ # 🔹 Value Objects с поддержкой
сравнения │ │ 
│   ├── Comparable.ts # Базовый Comparable VO │ │ 
│   └── index.ts # Экспорт всех Comparable VO
│ 
│   ├── events/ # 🔹 Event-driven микросервисы │ │ 
│   ├── IDomainEventHandler.ts # Интерфейс обработчика
DomainEvent │ │ 
│   └── index.ts # Экспорт всех event handler-ов │ 
│   ├── exceptions/ # 🔹 Domain Exceptions
(ADT) │ │ 
│   ├── DomainExceptions.ts # Common domain exceptions │ │ 
│   └── index.ts # Экспорт всех domain
exceptions │ 
│   ├── factories/ # 🔹 Entity / Aggregate Factories │ │ 
│   ├── EntityFactory.ts # Базовая
фабрика для entity │ │ 
│   └── index.ts # Экспорт всех factories │ 
│   ├── invariants/ # 🔹 Бизнес-инварианты
│ │ 
│   ├── InvariantGuard.ts # Проверка invariants │ │ │ 
│   └── index.ts # Экспорт всех invariants

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

│ 
│   ├── rules/ # 🔹 Бизнес-правила / валидация │ │ 
│   ├── BusinessRuleValidator.ts # Валидатор правил │ │

│   ├── IBusinessRule.ts # Интерфейс правила │ │ 
│   └── index.ts # Экспорт всех бизнес-правил │ ├─
services/ # 🔹 Domain Services │ │ 
│   ├── IDomainService.ts # Базовый интерфейс сервисов │ │ └─
index.ts # Экспорт всех domain services │ 
│   ├── snapshots/ # 🔹 Snapshots / сохранение состояния
агрегатов │ │ 
│   ├── AggregateSnapshot.ts # Snapshot агрегата │ │ 
│   └── index.ts # Экспорт всех snapshots │

│   ├── specifications/ # 🔹 Domain Specifications │ │ 
│   ├── Specification.ts # Базовый specification │ │ └─
index.ts # Экспорт всех specifications │ 
│   ├── state-machines/ # 🔹 State Machines │ │ ├─
StateMachine.ts # Базовый state machine │ │ 
│   └── index.ts # Экспорт всех state machines │ ├─
unit-of-work/ # 🔹 Unit of Work │ │ 
│   ├── IUnitOfWork.ts # Интерфейс UoW │ │ 
│   └── index.ts # Экспорт всех
UoW │ 
│   ├── value-objects/ # 🔹 Value Objects │ │ 
│   ├── EntityId.ts # Базовый VO для идентификаторов │ │

│   └── index.ts # Экспорт всех VO │ 
│   ├── UserRole.ts, ValueObject.ts # 🔹 Domain Types / Common VO
