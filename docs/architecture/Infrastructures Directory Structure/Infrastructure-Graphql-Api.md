infrastructure-graphql-api/ ├── README.md # 🔹 Обзор GraphQL API: генерация схем, типизация,
мидлвары, интеграция с микросервисами ├── index.ts # 🔹 Главный экспорт всех API утилит ├──
schema/ # 🔹 Определение GraphQL схем (TypeScript + GraphQL) │ ├── README.md # 🔹 Организация схем
по доменам: user, subscription, bots │ ├── user-schema.ts # 🔹 Типизированная схема для пользователя
│ ├── subscription-schema.ts # 🔹 Схема для подписок │ ├── bot-schema.ts # 🔹 Схема для ботов │ └──
index.ts # 🔹 Главный экспорт схем ├── resolvers/ # 🔹 GraphQL резолверы (TypeScript + Effect) │ ├──
README.md # 🔹 Резолверы должны быть чистыми (pure) и без бизнес-логики │ ├── user-resolver.ts # 🔹
Резолверы для user queries/mutations │ ├── subscription-resolver.ts # 🔹 Резолверы для подписок │
├── bot-resolver.ts # 🔹 Резолверы для ботов │ └── index.ts # 🔹 Главный экспорт резолверов ├──
middleware/ # 🔹 GraphQL middleware pipeline │ ├── README.md # 🔹 Для логирования, observability,
auth/tenant context injection │ ├── ErrorHandlingMiddleware.ts # 🔹 Обработка ошибок │ ├──
ObservabilityMiddleware.ts # 🔹 Метрики, telemetry │ ├── TenantContextMiddleware.ts # 🔹 Инъекция
tenant runtime context │ └── index.ts # 🔹 Экспорт всех middleware ├── utils/ # 🔹 Вспомогательные
функции (TypeScript + FP + Effect) │ ├── typeMappers.ts # 🔹 Маппинг DTO ↔ GraphQL types │ ├──
validation.ts # 🔹 Валидация входных данных │ └── index.ts # 🔹 Экспорт утилит ├── adapters/ # 🔹
Adapter layer для интеграции с другими infra/microservices │ ├── README.md # 🔹 Transport-only, без
бизнес-логики │ ├── tenant-adapter.ts # 🔹 Интеграция с infrastructure-tenant │ ├──
ai-service-adapter.ts # 🔹 Интеграция с AI сервисами │ └── index.ts # 🔹 Экспорт всех adapters └──
test/ # ✅ Unit / Integration тесты GraphQL API ├── resolvers.test.ts # 🔹 Тесты резолверов и
валидации ├── middleware.test.ts # 🔹 Тесты middleware pipeline └── schema.test.ts # 🔹 Тесты схем и
типизации
