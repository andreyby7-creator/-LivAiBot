infrastructure-graphql-server/ ├── README.md # 🔹 Обзор GraphQL инфраструктуры: схемы, resolvers,
middleware, subscriptions, интеграции с tenant/microservices ├── index.ts # 🔹 Главный экспорт
сервера и утилит GraphQL ├── schema/ # 🔹 GraphQL схемы и SDL │ ├── README.md # 🔹 Организация схем:
modular, чистый SDL │ ├── user-schema.ts # 🔹 Типы, queries и mutations для пользователя │ ├──
subscription-schema.ts # 🔹 Queries и mutations для подписок │ ├── bot-schema.ts # 🔹 Queries,
mutations и subscriptions для ботов │ └── index.ts # 🔹 Объединение всех схем ├── resolvers/ # 🔹
GraphQL resolvers (TypeScript + FP + Effect) │ ├── README.md # 🔹 Разделение по доменам: чистые
функции, composition │ ├── user-resolver.ts # 🔹 Resolver для пользователя │ ├──
subscription-resolver.ts # 🔹 Resolver для подписок │ ├── bot-resolver.ts # 🔹 Resolver для ботов │
├── root-resolver.ts # 🔹 Объединение всех resolvers │ └── index.ts # 🔹 Главный экспорт resolvers
├── middleware/ # 🔹 GraphQL middleware pipeline (TypeScript + Effect) │ ├── README.md # 🔹
Авторизация, логирование, error handling, observability │ ├── AuthMiddleware.ts # 🔹 Проверка
токенов и прав доступа │ ├── LoggingMiddleware.ts # 🔹 Логирование запросов и ошибок │ ├──
ErrorHandlingMiddleware.ts # 🔹 Форматирование ошибок в GraphQL │ └── index.ts # 🔹 Экспорт всех
middleware ├── subscriptions/ # 🔹 Реализация GraphQL Subscriptions │ ├── README.md # 🔹 WebSocket /
PubSub / Event-driven │ ├── pubsub.ts # 🔹 Простая in-memory реализация PubSub (для dev) или
адаптеры для Redis / RabbitMQ │ └── index.ts # 🔹 Экспорт подписок ├── adapters/ # 🔹 Интеграции с
другими микросервисами / infra │ ├── README.md # 🔹 transport-only adapters, no business logic │ ├──
tenant-adapter.ts # 🔹 Интеграция с infrastructure-tenant │ ├── ai-service-adapter.ts # 🔹
Интеграция с AI микросервисами │ └── index.ts # 🔹 Экспорт всех adapters ├── utils/ # 🔹
Вспомогательные функции для GraphQL │ ├── schemaHelpers.ts # 🔹 генерация типов, scalars, validation
helpers │ ├── resolverHelpers.ts # 🔹 common resolver helpers (lift, pipe, effect composition) │ └──
index.ts # 🔹 Экспорт всех утилит └── test/ # ✅ Unit / Integration тесты ├── resolvers.test.ts # 🔹
Тесты resolvers с mock data ├── schema.test.ts # 🔹 Тесты схем и SDL ├── subscriptions.test.ts # 🔹
Тесты подписок (PubSub) └── adapters.test.ts # 🔹 Тесты интеграций с микросервисами
