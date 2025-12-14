infrastructure-graphql-client/ ├── README.md # 🔹 Обзор GraphQL клиента: использование Apollo /
urql, типизация запросов, интеграция с microservices/tenant ├── index.ts # 🔹 Главный экспорт
клиента и утилит ├── client/ # 🔹 GraphQL клиент (TypeScript + Effect) │ ├── README.md # 🔹
Настройка клиента, retry, caching, error handling │ ├── ApolloClientFactory.ts # 🔹 Factory для
Apollo Client с DI, middleware, cache │ ├── GraphQLClient.ts # 🔹 Обёртка для
запросов/мутаций/subscriptions │ └── index.ts # 🔹 Экспорт всех клиентов ├── queries/ # 🔹 GraphQL
queries / mutations / subscriptions │ ├── README.md # 🔹 Организация по доменам: user, subscription,
bots │ ├── user-queries.ts # 🔹 Типизированные запросы для пользователя │ ├──
subscription-queries.ts # 🔹 Запросы для подписок │ ├── bot-queries.ts # 🔹 Запросы для ботов │ └──
index.ts # 🔹 Главный экспорт всех запросов ├── adapters/ # 🔹 Adapter layer для интеграции с
другими infra/microservices │ ├── README.md # 🔹 Transport-only, без бизнес-логики │ ├──
tenant-adapter.ts # 🔹 Интеграция с infrastructure-tenant │ ├── ai-service-adapter.ts # 🔹
Интеграция с AI сервисами │ └── index.ts # 🔹 Экспорт всех adapters ├── utils/ # 🔹 Вспомогательные
функции (TypeScript + FP + Effect) │ ├── requestHelpers.ts # 🔹 Обёртки для выполнения запросов,
retry, error handling │ ├── typeMappers.ts # 🔹 Маппинг DTO ↔ GraphQL types │ └── index.ts # 🔹
Экспорт утилит └── test/ # ✅ Unit / Integration тесты клиента ├── client.test.ts # 🔹 Тестирование
выполнения запросов и мутаций ├── adapters.test.ts # 🔹 Тесты интеграции с микросервисами └──
queries.test.ts # 🔹 Тесты типизации и валидности запросов
