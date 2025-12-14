# API Directory Structure

## Обзор

API слой представляет собой тонкий адаптер между внешним миром (HTTP/GraphQL) и внутренней логикой приложения (application-core). Следует принципам Hexagonal Architecture - контроллеры являются Ports для внешнего мира.

## Структура

```
api/
└── src/
    ├── controllers/                   # 🔹 ТОНКИЕ HTTP контроллеры (Hexagonal: Ports для внешнего мира)
    │   ├── UserController.ts          # 🔹 Тонкий REST/GraphQL контроллер для пользователей
    │   │                              #    (TypeScript, FP, Effect, HTTP/GraphQL)
    │   ├── SubscriptionController.ts  # 🔹 Тонкий контроллер подписок
    │   │                              #    (TypeScript, FP, Effect, HTTP/GraphQL)
    │   ├── BillingController.ts       # 🔹 Тонкий контроллер платежей
    │   │                              #    (TypeScript, FP, Effect, HTTP/GraphQL)
    │   ├── BotController.ts           # 🔹 Тонкий контроллер AI-ботов
    │   │                              #    (TypeScript, FP, Effect, HTTP/GraphQL)
    │   └── index.ts                   # 🔹 Экспорт всех контроллеров (TypeScript, FP)
    │
    ├── routes/                        # 🔹 HTTP маршрутизация (Fastify)
    │   ├── userRoutes.ts              # 🔹 Маршруты для пользователей (TypeScript, FP)
    │   ├── subscriptionRoutes.ts      # 🔹 Маршруты для подписок (TypeScript, FP)
    │   ├── billingRoutes.ts           # 🔹 Маршруты для платежей (TypeScript, FP)
    │   ├── botRoutes.ts               # 🔹 Маршруты для ботов (TypeScript, FP)
    │   └── index.ts                   # 🔹 Главный роутер (TypeScript, FP)
    │
    ├── graphql/                       # 🔹 GraphQL слой (тонкий адаптер)
    │   ├── schema.ts                  # 🔹 GraphQL схема (TypeScript, GraphQL, FP)
    │   ├── resolvers/                 # 🔹 Тонкие GraphQL resolvers (делегируют в application-core)
    │   │   ├── userResolver.ts        # 🔹 User GraphQL resolver
    │   │   │                          #    (TypeScript, GraphQL, FP, Effect)
    │   │   ├── subscriptionResolver.ts   # 🔹 Subscription GraphQL resolver
    │   │   │                          #    (TypeScript, GraphQL, FP, Effect)
    │   │   ├── billingResolver.ts     # 🔹 Billing GraphQL resolver
    │   │   │                          #    (TypeScript, GraphQL, FP, Effect)
    │   │   └── botResolver.ts         # 🔹 Bot GraphQL resolver
    │   │                              #    (TypeScript, GraphQL, FP, Effect)
    │   └── index.ts                   # 🔹 GraphQL сервер bootstrap
    │                                  #    (TypeScript, GraphQL, FP, Effect)
    │
    ├── dto/                           # 🔹 API DTO (внешний контракт API)
    │   ├── UserApiDTO.ts              # 🔹 DTO для user API (TypeScript, FP)
    │   ├── SubscriptionApiDTO.ts      # 🔹 DTO для subscription API (TypeScript, FP)
    │   ├── BillingApiDTO.ts           # 🔹 DTO для billing API (TypeScript, FP)
    │   ├── BotApiDTO.ts               # 🔹 DTO для bot API (TypeScript, FP)
    │   └── index.ts                   # 🔹 Экспорт всех API DTO (TypeScript, FP)
    │
    ├── mappers/                       # 🔹 Мапперы API ↔ Application DTO
    │   ├── UserApiMapper.ts           # 🔹 Маппинг API DTO ↔ Application DTO
    │   │                              #    (TypeScript, FP)
    │   ├── SubscriptionApiMapper.ts   # 🔹 Маппинг subscription DTO (TypeScript, FP)
    │   ├── BillingApiMapper.ts        # 🔹 Маппинг billing DTO (TypeScript, FP)
    │   ├── BotApiMapper.ts            # 🔹 Маппинг bot DTO (TypeScript, FP)
    │   └── index.ts                   # 🔹 Экспорт всех мапперов (TypeScript, FP)
    │
    └── middleware/                    # 🔹 HTTP / GraphQL middleware (тонкий слой)
        ├── AuthMiddleware.ts          # 🔹 JWT/OAuth аутентификация
        │                              #    (TypeScript, FP, Effect)
        ├── LoggingMiddleware.ts       # 🔹 HTTP логирование (TypeScript, FP, Effect)
        ├── ErrorHandler.ts            # 🔹 Глобальная обработка ошибок
        │                              #    (TypeScript, FP, Effect)
        ├── RateLimiter.ts             # 🔹 Rate limiting (TypeScript, FP, Effect)
        ├── TenantContextMiddleware.ts # 🔹 Tenant-aware context injection
        │                              #    (TypeScript, FP, Effect)
        ├── ValidationMiddleware.ts    # 🔹 Input validation (TypeScript, FP, Zod)
        └── index.ts                   # 🔹 Экспорт всех middleware
                                       #    (TypeScript, FP, Effect)
```

## Принципы

### Hexagonal Architecture
- **Controllers** = Ports для внешнего мира (HTTP/GraphQL)
- **Routes** = Адаптеры для HTTP фреймворков (Fastify)
- **Middleware** = Cross-cutting concerns (аутентификация, логирование, валидация)

### Тонкий слой
- **Нет бизнес-логики** - только преобразование данных и маршрутизация
- **Делегирование** - все вызовы уходят в application-core
- **Валидация** - проверка входных данных (Zod schemas)

### TypeScript + Functional Programming
- **Строгая типизация** - все DTO и контракты типизированы
- **FP подход** - чистые функции, иммутабельность
- **Effect** - для side effects и error handling

## Зависимости

### External
- **Fastify** - HTTP server framework
- **GraphQL** - query language для API
- **Zod** - schema validation

### Internal
- **application-core** - бизнес-логика
- **shared/dto** - общие DTO
- **infrastructure** - внешние сервисы
