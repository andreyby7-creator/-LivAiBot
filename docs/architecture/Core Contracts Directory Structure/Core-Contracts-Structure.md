# Core Contracts Directory Structure

## Обзор

Core Contracts - это фундаментальный слой чистых функций и типов, обеспечивающий type safety и functional programming паттерны для всего приложения. Все контракты immutable и testable.

## Архитектурные принципы

### Pure Functions + Effect Pattern
- **Zero side effects** в core слое
- **Effect pattern** для контролируемых side effects
- **Algebraic Data Types** для type safety

### Layered Architecture
- **IO Layer** - базовые эффекты (Effect, TaskEither, Result, Option)
- **Layers** - абстракции для внешних интеграций
- **Schedule** - планировщик и retry стратегии
- **Utils** - функциональные утилиты

## Структура директорий

```
core-contracts/
├── src/
│   ├── effect/                # 🔹 Effect + Pure FP Core
│   │   ├── io/                # 🔹 Базовые FP эффекты
│   │   │   ├── Effect.ts          # TypeScript + Effect + Pure FP
│   │   │   ├── TaskEither.ts      # TypeScript + TaskEither + Pure FP
│   │   │   ├── Result.ts          # TypeScript + Result + Pure FP
│   │   │   ├── Option.ts          # TypeScript + Option + Pure FP
│   │   │   └── SchemaHelpers.ts   # TypeScript + SchemaHelpers + Pure FP
│   │   │
│   │   ├── layers/            # 🔹 Абстракции слоев / Layered Architecture
│   │   │   ├── Layer.ts           # TypeScript + Effect + Pure FP (базовый слой)
│   │   │   ├── DatabaseLayer.ts   # TypeScript + Effect + Pure FP + DB интеграция
│   │   │   ├── CacheLayer.ts      # TypeScript + Effect + Pure FP + Cache интеграция
│   │   │   ├── QueueLayer.ts      # TypeScript + Effect + Pure FP + Queue интеграция
│   │   │   └── TestLayers.ts      # TypeScript + Effect + Pure FP + Mock/Test слои
│   │   │
│   │   ├── schedule/          # 🔹 Планировщик и Retry (Pure FP + Effect)
│   │   │   ├── Retry.ts           # TypeScript + Retry стратегии + Effect
│   │   │   └── Schedule.ts        # TypeScript + Планировщик задач + Effect
│   │   │
│   │   └── utils/             # 🔹 Утилиты FP
│   │       ├── pipe.ts            # TypeScript + FP pipe/composition
│   │       ├── compose.ts         # TypeScript + FP compose
│   │       └── lift.ts            # TypeScript + lift функций в Effect/TaskEither/Result/Option
│   │
│   ├── auth/                 # 🔹 Auth Context & Services (TypeScript + Effect + FP)
│   │   ├── AuthService.ts        # TypeScript + Effect + FP
│   │   ├── context/              # TypeScript + FP
│   │   │   ├── AuthContext.ts        # TypeScript + FP
│   │   │   ├── AuthContextRunner.ts  # TypeScript + FP
│   │   │   ├── AuthContextRunner.ts  # TypeScript + FP
│   │   │   ├── AuthCorrelation.ts    # TypeScript + FP
│   │   │   ├── AuthorizationContext.ts # TypeScript + FP
│   │   │   └── index.ts              # TypeScript + FP
│   │   │
│   │   └── errors/             # TypeScript + FP + Algebraic Data Types
│   │       ├── AuthenticationError.ts # TypeScript + FP + ADT
│   │       ├── AuthError.ts          # TypeScript + FP + ADT
│   │       ├── AuthErrorCodes.ts     # TypeScript + FP + ADT
│   │       ├── AuthErrorMapper.ts    # TypeScript + FP + ADT
│   │       ├── AuthorizationError.ts # TypeScript + FP + ADT
│   │       ├── SessionError.ts       # TypeScript + FP + ADT
│   │       ├── TokenError.ts         # TypeScript + FP + ADT
│   │       ├── legacy.ts             # TypeScript + FP + ADT
│   │       └── index.ts              # TypeScript + FP + ADT
│   │
│   ├── metadata/             # TypeScript + FP + Types/Interfaces
│   │   ├── AuthenticationMethod.ts # TypeScript + FP + Types
│   │   ├── AuthSession.ts          # TypeScript + FP + Types
│   │   ├── AuthToken.ts            # TypeScript + FP + Types
│   │   ├── AuthUser.ts             # TypeScript + FP + Types
│   │   ├── Credentials.ts          # TypeScript + FP + Types
│   │   └── index.ts                # TypeScript + FP + Types
│   │
│   ├── metrics/              # TypeScript + FP + Telemetry / Observability
│   │   ├── AuthMetrics.ts          # TypeScript + FP + Telemetry
│   │   ├── AuthMetricsCollector.ts # TypeScript + FP + Telemetry
│   │   ├── AuthMetricTags.ts       # TypeScript + FP + Telemetry
│   │   └── index.ts                # TypeScript + FP + Telemetry
│   │
│   ├── services/             # TypeScript + Effect + FP (микросервисы)
│   │   ├── AuthorizationService.ts # TypeScript + Effect + FP
│   │   ├── AuthService.ts          # TypeScript + Effect + FP
│   │   └── index.ts                # TypeScript + Effect + FP
│   │
│   ├── specifications/       # TypeScript + FP + Domain Rules
│   │   ├── PermissionSpecification.ts    # TypeScript + FP + Domain Rules
│   │   ├── RoleHierarchySpecification.ts # TypeScript + FP + Domain Rules
│   │   ├── RoleSpecification.ts          # TypeScript + FP + Domain Rules
│   │   └── index.ts                      # TypeScript + FP + Domain Rules
│   │
│   └── validation/           # TypeScript + FP + Schema Validation
│       ├── AuthValidationResult.ts # TypeScript + FP + Schema Validation
│       ├── helpers/                # TypeScript + FP + Schema Validation
│       │   ├── index.ts                # TypeScript + FP + Schema Validation
│       │   └── validateAndCreate.ts    # TypeScript + FP + Schema Validation
│       │
│       └── schemas/             # TypeScript + FP + Zod/Yup / Schema Validation
│           ├── credentials-schema.ts # TypeScript + FP + Schema Validation
│           ├── session-schema.ts     # TypeScript + FP + Schema Validation
│           ├── token-schema.ts       # TypeScript + FP + Schema Validation
│           ├── user-schema.ts        # TypeScript + FP + Schema Validation
│           └── index.ts              # TypeScript + FP + Schema Validation
│
├── ci/                     # 🔹 CI Context & Services (TypeScript + Effect + FP)
│   ├── context/               # TypeScript + FP
│   │   ├── CIContext.ts           # TypeScript + FP
│   │   ├── CIContextRunner.ts     # TypeScript + FP
│   │   ├── CICorrelation.ts       # TypeScript + FP
│   │   └── index.ts               # TypeScript + FP
│   │
│   ├── errors/                # TypeScript + FP + ADT
│   │   ├── CIError.ts             # TypeScript + FP + ADT
│   │   ├── CIErrorCodes.ts        # TypeScript + FP + ADT
│   │   ├── CIErrorMapper.ts       # TypeScript + FP + ADT
│   │   ├── CIErrorSeverity.ts     # TypeScript + FP + ADT
│   │   └── index.ts               # TypeScript + FP + ADT
│   │
│   ├── metadata/             # TypeScript + FP + Types/Interfaces
│   │   ├── CIBuildInfo.ts         # TypeScript + FP + Types
│   │   ├── CIDeployInfo.ts        # TypeScript + FP + Types
│   │   ├── CIEnvParser.ts         # TypeScript + FP + Types
│   │   ├── CIProvider.ts          # TypeScript + FP + Types
│   │   └── index.ts               # TypeScript + FP + Types
│   │
│   ├── metrics/              # TypeScript + FP + Telemetry / Observability
│   │   ├── CIMetrics.ts           # TypeScript + FP + Telemetry
│   │   ├── CIMetricsCollector.ts  # TypeScript + FP + Telemetry
│   │   ├── CIMetricTags.ts        # TypeScript + FP + Telemetry
│   │   └── index.ts               # TypeScript + FP + Telemetry
│   │
│   └── validation/           # TypeScript + FP + Schema Validation
│       ├── CIValidationResult.ts  # TypeScript + FP + Schema Validation
│       └── schemas/               # TypeScript + FP + Schema Validation
│           ├── build-schema.ts        # TypeScript + FP + Schema Validation
│           ├── deploy-schema.ts       # TypeScript + FP + Schema Validation
│           └── index.ts               # TypeScript + FP + Schema Validation
│
├── config/                  # 🔹 Конфигурации (TypeScript)
│   ├── ConfigValue.ts           # TypeScript
│   ├── CoreConfig.ts            # TypeScript
│   ├── IConfigProvider.ts       # TypeScript
│   ├── index.ts                 # TypeScript
│   └── README.md                # Документация
│
├── context/                 # 🔹 Context Propagation (TypeScript + Effect + FP)
│   ├── propagation/            # TypeScript + FP
│   │   ├── ContextStorage.ts       # TypeScript + FP
│   │   ├── CorrelationContext.ts   # TypeScript + FP
│   │   ├── IContextPropagator.ts   # TypeScript + FP
│   │   └── index.ts               # TypeScript + FP
│   │
│   └── tenant/                # TypeScript + FP
│       └── TenantSessionContext.ts # TypeScript + FP
│
├── domain/                  # 🔹 Domain Layer (DDD, TypeScript + FP Core)
│   ├── BaseDomainEvent.ts       # TypeScript + FP
│   ├── BaseEntity.ts            # TypeScript + FP
│   ├── DomainEvent.ts           # TypeScript + FP
│   ├── UserRole.ts              # TypeScript + FP + Domain Types
│   ├── ValueObject.ts           # TypeScript + FP + Domain Types
│   │
│   ├── comparable/            # TypeScript + FP + Value Objects
│   │   ├── Comparable.ts          # TypeScript + FP + Value Objects
│   │   └── index.ts               # TypeScript + FP + Value Objects
│   │
│   ├── events/                # TypeScript + FP + Event-driven
│   │   ├── IDomainEventHandler.ts  # TypeScript + FP + Event-driven
│   │   └── index.ts               # TypeScript + FP + Event-driven
│   │
│   ├── examples/              # TypeScript + FP + DDD Examples
│   │   ├── CampaignAggregate.ts    # TypeScript + FP + DDD Examples
│   │   ├── OrderAggregate.ts       # TypeScript + FP + DDD Examples
│   │   ├── TenantAggregate.ts      # TypeScript + FP + DDD Examples
│   │   └── index.ts                # TypeScript + FP + DDD Examples
│   │
│   ├── exceptions/            # TypeScript + FP + ADT / Domain Exceptions
│   │   ├── DomainExceptions.ts     # TypeScript + FP + ADT
│   │   └── index.ts                # TypeScript + FP + ADT
│   │
│   ├── factories/             # TypeScript + FP + Aggregate/Entity Factories
│   │   ├── EntityFactory.ts        # TypeScript + FP + Aggregate/Entity Factories
│   │   └── index.ts                # TypeScript + FP + Aggregate/Entity Factories
│   │
│   ├── invariants/            # TypeScript + FP + Business Invariants
│   │   ├── InvariantGuard.ts       # TypeScript + FP + Business Invariants
│   │   └── index.ts                # TypeScript + FP + Business Invariants
│   │
│   ├── rules/                 # TypeScript + FP + Business Rules
│   │   ├── BusinessRuleValidator.ts # TypeScript + FP + Business Rules
│   │   ├── IBusinessRule.ts        # TypeScript + FP + Business Rules
│   │   └── index.ts                # TypeScript + FP + Business Rules
│   │
│   ├── services/              # TypeScript + FP + Domain Services
│   │   ├── IDomainService.ts       # TypeScript + FP + Domain Services
│   │   └── index.ts                # TypeScript + FP + Domain Services
│   │
│   ├── snapshots/             # TypeScript + FP + Snapshots
│   │   ├── AggregateSnapshot.ts    # TypeScript + FP + Snapshots
│   │   └── index.ts               # TypeScript + FP + Snapshots
│   │
│   ├── specifications/           # TypeScript + FP + Domain Specifications
│   │   ├── Specification.ts      # TypeScript + FP + Domain Specifications
│   │   └── index.ts              # TypeScript + FP + Domain Specifications
│   │
│   ├── state-machines/           # TypeScript + FP + State Machines
│   │   ├── StateMachine.ts       # TypeScript + FP + State Machines
│   │   └── index.ts              # TypeScript + FP + State Machines
│   │
│   ├── unit-of-work/             # TypeScript + FP + Unit of Work
│   │   ├── IUnitOfWork.ts        # TypeScript + FP + Unit of Work
│   │   └── index.ts              # TypeScript + FP + Unit of Work
│   │
│   ├── value-objects/            # TypeScript + FP + Value Objects
│   │   ├── EntityId.ts           # TypeScript + FP + Value Objects
│   │   └── index.ts              # TypeScript + FP + Value Objects
│   │
│   └── AuditableAggregateRoot.ts # TypeScript + FP
│   └── AuditableEntity.ts        # TypeScript + FP
│
├── errors/                       # 🔹 Errors (TypeScript + FP-friendly)
│   ├── index.ts                  # Центральный экспорт всех типов ошибок
│   ├── auth/                     # TypeScript + FP + ADT
│   ├── base/                     # TypeScript + FP + ADT
│   ├── domain/                   # TypeScript + FP + ADT
│   ├── infrastructure/           # TypeScript + FP + ADT
│   ├── metrics/                  # TypeScript + FP + ADT
│   ├── normalizers/              # TypeScript + FP + ADT
│   └── utils/                    # TypeScript + FP + ADT
│
├── fn/                           # 🔹 Типы функций (TypeScript)
│   ├── index.ts                  # TypeScript
│   └── README.md                 # Документация
│
├── infrastructure/               # 🔹 Инфраструктура (TypeScript + Effect + FP)
│   ├── index.ts                  # Центральный экспорт инфраструктурных компонентов
│   ├── cache/                    # TypeScript + FP + Cache Layer
│   ├── config/                   # TypeScript + FP + Config Providers
│   ├── database/                 # TypeScript + FP + DB Layer
│   ├── health/                   # TypeScript + FP + Health Checks
│   ├── k8s/                      # TypeScript + FP + Kubernetes Integration
│   ├── locking/                  # TypeScript + FP + Distributed Locking
│   ├── filesystem/               # TypeScript + FP + File System Operations
│   └── observability/            # TypeScript + FP + Telemetry / Metrics
│
├── react/                        # 🔹 React Hooks & Provider (TypeScript + FP)
│   ├── index.ts                  # Экспорт React компонентов и хуков
│   ├── EffectProvider.tsx        # TypeScript + FP + React Context Provider
│   └── hooks/                    # TypeScript + FP + React Hooks
│       ├── useEffect.ts          # TypeScript + FP + React Hook
│       ├── useTaskEither.ts      # TypeScript + FP + React Hook
│       ├── useResult.ts          # TypeScript + FP + React Hook
│       ├── useIO.ts              # TypeScript + FP + React Hook
│       ├── useSchema.ts          # TypeScript + FP + React Hook
│       └── useOption.ts          # TypeScript + FP + React Hook
│
└── index.ts                      # TypeScript + FP (главный экспорт)
```

## Принципы организации

### Functional Programming First
- **Pure Functions** - все функции чистые, без side effects
- **Immutability** - данные неизменяемы
- **Composition** - функции компонуются через pipe/compose
- **Type Safety** - 100% типизация на всех уровнях

### Effect Pattern для Side Effects
```typescript
// Безопасное управление side effects
export const readFile = (path: string): Effect<never, Error, string> =>
  Effect.tryCatch(
    () => fs.readFileSync(path, 'utf8'),
    (error) => new FileSystemError(error.message)
  );
```

### Algebraic Data Types (ADT)
```typescript
// Типобезопасные ошибки
export type AuthError =
  | { _tag: 'InvalidCredentials' }
  | { _tag: 'UserNotFound'; userId: string }
  | { _tag: 'TokenExpired'; expiredAt: Date };
```

### Domain-Driven Design (DDD)
- **Entities** - изменяемые объекты с identity
- **Value Objects** - неизменяемые значения
- **Aggregates** - кластеры связанных entities
- **Domain Events** - факты о изменениях в domain

## Использование

### Импорт из core-contracts
```typescript
// Effect и FP утилиты
import { Effect, pipe } from '@livai/core-contracts/effect';

// Domain модели
import { User } from '@livai/core-contracts/domain';

// Infrastructure
import { Database } from '@livai/core-contracts/infrastructure';

// Auth сервисы
import { AuthService } from '@livai/core-contracts/auth';

// Type guards и validators
import { isUser, validateEmail } from '@livai/core-contracts';

// Все вместе
import * as Core from '@livai/core-contracts';
```

### Создание нового модуля
```typescript
// domain/user.ts
export interface User extends BaseEntity {
  readonly email: Email;
  readonly role: UserRole;
  readonly profile: UserProfile;
}

// domain/user.specification.ts
export const isActiveUser = (user: User): boolean =>
  user.status === 'active' && !user.deletedAt;
```

## Архитектурные гарантии

### Type Safety
- **Compile-time checks** - ошибки на этапе сборки
- **Runtime safety** - Effect pattern предотвращает exceptions
- **Domain invariants** - бизнес-правила enforced типами

### Testability
- **Pure functions** - легко тестировать
- **Dependency injection** - через Effect layers
- **Mock-friendly** - TestLayers для изоляции

### Performance
- **Tree shaking** - неиспользуемый код исключается
- **Lazy evaluation** - Effect откладывает выполнение
- **Memory efficiency** - immutable структуры

### Maintainability
- **Clear boundaries** - каждый модуль имеет single responsibility
- **Consistent patterns** - FP + Effect везде
- **Documentation** - типы как документация

---

*Core Contracts - фундамент чистой архитектуры LivAI, обеспечивающий type safety, testability и maintainability на всех уровнях приложения.*
│ │ 
│   ├── SessionError.ts # TypeScript + FP + ADT │ │ │ 
│   ├── TokenError.ts # TypeScript + FP + ADT │ │ │

│   ├── legacy.ts # TypeScript + FP + ADT │ │ │ 
│   └── index.ts # TypeScript + FP + ADT │ │ 
│   ├── metadata/ #
TypeScript + FP + Types/Interfaces │ │ │ 
│   ├── AuthenticationMethod.ts # TypeScript + FP + Types │ │ │

│   ├── AuthSession.ts # TypeScript + FP + Types │ │ │ 
│   ├── AuthToken.ts # TypeScript + FP + Types │ │ │ ├─
AuthUser.ts # TypeScript + FP + Types │ │ │ 
│   ├── Credentials.ts # TypeScript + FP + Types │ │ │ └─
index.ts # TypeScript + FP + Types │ │ 
│   ├── metrics/ # TypeScript + FP + Telemetry / Observability │ │
│ 
│   ├── AuthMetrics.ts # TypeScript + FP + Telemetry │ │ │ 
│   ├── AuthMetricsCollector.ts # TypeScript +
FP + Telemetry │ │ │ 
│   ├── AuthMetricTags.ts # TypeScript + FP + Telemetry │ │ │ 
│   └── index.ts #
TypeScript + FP + Telemetry │ │ 
│   ├── services/ # TypeScript + Effect + FP (микросервисы) │ │ │ ├─
AuthorizationService.ts # TypeScript + Effect + FP │ │ │ 
│   ├── AuthService.ts # TypeScript + Effect +
FP │ │ │ 
│   └── index.ts # TypeScript + Effect + FP │ │ 
│   ├── specifications/ # TypeScript + FP + Domain
Rules │ │ │ 
│   ├── PermissionSpecification.ts # TypeScript + FP + Domain Rules │ │ │ ├─
RoleHierarchySpecification.ts # TypeScript + FP + Domain Rules │ │ │ 
│   ├── RoleSpecification.ts #
TypeScript + FP + Domain Rules │ │ │ 
│   └── index.ts # TypeScript + FP + Domain Rules │ │ └─
validation/ # TypeScript + FP + Schema Validation │ │ 
│   ├── AuthValidationResult.ts # TypeScript + FP +
Schema Validation │ │ 
│   ├── helpers/ │ │ │ 
│   ├── index.ts # TypeScript + FP + Schema Validation │ │ │ └─
validateAndCreate.ts # TypeScript + FP + Schema Validation │ │ 
│   └── schemas/ │ │ ├─
credentials-schema.ts # TypeScript + FP + Zod/Yup / Schema Validation │ │ 
│   ├── session-schema.ts #
TypeScript + FP + Schema Validation │ │ 
│   ├── token-schema.ts # TypeScript + FP + Schema Validation │ │

│   ├── user-schema.ts # TypeScript + FP + Schema Validation │ │ 
│   └── index.ts # TypeScript + FP + Schema
Validation │ 
│   ├── ci/ # 🔹 CI Context & Services (TypeScript + Effect + FP) │ │ 
│   ├── context/ #
TypeScript + FP │ │ │ 
│   ├── CIContext.ts │ │ │ 
│   ├── CIContextRunner.ts │ │ │ 
│   ├── CICorrelation.ts │ │ │ └─
index.ts │ │ 
│   ├── errors/ # TypeScript + FP + ADT │ │ │ 
│   ├── CIError.ts │ │ │ 
│   ├── CIErrorCodes.ts │ │ │

│   ├── CIErrorMapper.ts │ │ │ 
│   ├── CIErrorSeverity.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── metadata/ # TypeScript +
FP + Types/Interfaces │ │ │ 
│   ├── CIBuildInfo.ts │ │ │ 
│   ├── CIDeployInfo.ts │ │ │ 
│   ├── CIEnvParser.ts │ │ │

│   ├── CIProvider.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── metrics/ # TypeScript + FP + Telemetry / Observability │ │
│ 
│   ├── CIMetrics.ts │ │ │ 
│   ├── CIMetricsCollector.ts │ │ │ 
│   ├── CIMetricTags.ts │ │ │ 
│   └── index.ts │ │ └─
validation/ # TypeScript + FP + Schema Validation │ │ 
│   ├── CIValidationResult.ts │ │ 
│   └── schemas/ │ │

│   ├── build-schema.ts │ │ 
│   ├── deploy-schema.ts │ │ 
│   └── index.ts │ 
│   ├── config/ # 🔹 Конфигурации
(TypeScript) │ │ 
│   ├── ConfigValue.ts # TypeScript │ │ 
│   ├── CoreConfig.ts # TypeScript │ │ ├─
IConfigProvider.ts # TypeScript │ │ 
│   ├── index.ts # TypeScript │ │ 
│   └── README.md # Документация │ ├─
context/ # 🔹 Context Propagation (TypeScript + Effect + FP) │ │ 
│   ├── propagation/ # TypeScript + FP │
│ │ 
│   ├── ContextStorage.ts │ │ │ 
│   ├── CorrelationContext.ts │ │ │ 
│   ├── IContextPropagator.ts │ │ │ └─
index.ts │ │ 
│   └── tenant/ # TypeScript + FP │ │ 
│   └── TenantSessionContext.ts │ 
│   ├── domain/ # 🔹 Domain
Layer (DDD, TypeScript + FP Core) │ │ 
│   ├── AuditableAggregateRoot.ts │ │ 
│   ├── AuditableEntity.ts │ │ ├─
BaseDomainEvent.ts │ │ 
│   ├── BaseEntity.ts │ │ 
│   ├── comparable/ # TypeScript + FP + Value Objects │ │ │

│   ├── Comparable.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── DomainEvent.ts │ │ 
│   ├── events/ # TypeScript + FP +
Event-driven │ │ │ 
│   ├── IDomainEventHandler.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── examples/ # TypeScript + FP +
DDD Examples │ │ │ 
│   ├── CampaignAggregate.ts │ │ │ 
│   ├── OrderAggregate.ts │ │ │ 
│   ├── TenantAggregate.ts │
│ │ 
│   └── index.ts │ │ 
│   ├── exceptions/ # TypeScript + FP + ADT / Domain Exceptions │ │ │ ├─
DomainExceptions.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── factories/ # TypeScript + FP + Aggregate/Entity
Factories │ │ │ 
│   ├── EntityFactory.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── invariants/ # TypeScript + FP +
Business Invariants │ │ │ 
│   ├── InvariantGuard.ts │ │ │ 
│   └── index.ts

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

│ │ 
│   ├── rules/ # TypeScript + FP + Business Rules │ │ │ 
│   ├── BusinessRuleValidator.ts │ │ │ ├─
IBusinessRule.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── services/ # TypeScript + FP + Domain Services │ │ │ ├─
IDomainService.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── snapshots/ # TypeScript + FP + Snapshots │ │ │ ├─
AggregateSnapshot.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── specifications/ # TypeScript + FP + Domain
Specifications │ │ │ 
│   ├── Specification.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── state-machines/ # TypeScript +
FP + State Machines │ │ │ 
│   ├── StateMachine.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── unit-of-work/ # TypeScript +
FP + Unit of Work │ │ │ 
│   ├── IUnitOfWork.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── value-objects/ # TypeScript +
FP + Value Objects │ │ │ 
│   ├── EntityId.ts │ │ │ 
│   └── index.ts │ │ 
│   ├── UserRole.ts, ValueObject.ts #
TypeScript + FP + Domain Types │ 
│   ├── errors/ # 🔹 Errors (TypeScript + FP-friendly) │ │ 
│   ├── index.ts #
Центральный экспорт всех типов ошибок │ │ 
│   ├── auth/ # TypeScript + FP + ADT │ │ 
│   ├── base/ #
TypeScript + FP + ADT │ │ 
│   ├── domain/ # TypeScript + FP + ADT │ │ 
│   ├── infrastructure/ # TypeScript +
FP + ADT │ │ 
│   ├── metrics/ # TypeScript + FP + ADT │ │ 
│   ├── normalizers/ # TypeScript + FP + ADT │ │ └─
utils/ # TypeScript + FP + ADT │ 
│   ├── fn/ # 🔹 Типы функций (TypeScript) │ │ 
│   ├── index.ts # TypeScript
│ │ 
│   └── README.md # Документация │ 
│   ├── infrastructure/ # 🔹 Инфраструктура (TypeScript + Effect + FP)
│ │ 
│   ├── index.ts # Центральный экспорт инфраструктурных компонентов │ │ 
│   ├── cache/ # TypeScript + FP +
Cache Layer │ │ 
│   ├── config/ # TypeScript + FP + Config Providers │ │ 
│   ├── database/ # TypeScript + FP +
DB Layer │ │ 
│   ├── health/ # TypeScript + FP + Health Checks │ │ 
│   ├── k8s/ # TypeScript + FP + Kubernetes
Integration │ │ 
│   ├── locking/ # TypeScript + FP + Distributed Locking │ │ 
│   ├── filesystem/ #
TypeScript + FP + File System Operations │ │ 
│   └── observability/ # TypeScript + FP + Telemetry /
Metrics │ 
│   ├── react/ # 🔹 React Hooks & Provider (TypeScript + FP) │ │ 
│   ├── index.ts # Экспорт React
компонентов и хуков │ │ 
│   ├── EffectProvider.tsx # TypeScript + FP + React Context Provider │ │ └─
hooks/ # TypeScript + FP + React Hooks │ │ 
│   ├── useEffect.ts # TypeScript + FP + React Hook │ │ ├─
useTaskEither.ts # TypeScript + FP + React Hook │ │ 
│   ├── useResult.ts # TypeScript + FP + React Hook │
│ 
│   ├── useIO.ts # TypeScript + FP + React Hook │ │ 
│   ├── useSchema.ts # TypeScript + FP + React Hook │ │

│   └── useOption.ts # TypeScript + FP + React Hook │ 
│   └── index.ts # TypeScript + FP (главный экспорт) ├─
targets/ # 🔹 Target-specific entrypoints (browser, node, etc.) │ 
│   ├── browser.ts # TypeScript +
FP-friendly │ 
│   ├── mobile.ts # TypeScript + FP-friendly │ 
│   ├── node.ts # TypeScript + FP-friendly │ ├─
server.ts # TypeScript + FP-friendly │ 
│   └── shared.ts # TypeScript + FP-friendly 
│   ├── package.json #
Node.js / TypeScript + Package Metadata 
│   ├── tsconfig.json # TypeScript Configuration 
│   ├── README.md #
Документация проекта 
│   ├── docs/ # Документация 
│   ├── scripts/ # Скрипты (Node.js / TypeScript) └─
reports/ # Отчёты / Аналитика
