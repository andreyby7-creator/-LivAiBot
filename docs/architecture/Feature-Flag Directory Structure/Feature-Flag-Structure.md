feature-flags/ ├── README.md # 🔹 Обзор feature flags: управление, rollout, условия включения ├──
index.ts # 🔹 Главный экспорт всех функций и адаптеров feature flags ├── core/ # 🔹 Основная логика
feature flags │ ├── README.md # 🔹 Принципы: immutable, FP-friendly, Effect-based │ ├──
FeatureFlag.ts # 🔹 Определение структуры feature flag | TypeScript + FP │ ├──
FeatureFlagEvaluator.ts # 🔹 Логика проверки, включена ли фича | TypeScript + Effect + FP │ ├──
FeatureFlagStore.ts # 🔹 Интерфейс для хранения flags (in-memory / DB) | TypeScript + FP + Effect │
└── index.ts # 🔹 Экспорт core | TypeScript ├── adapters/ # 🔹 Адаптеры для интеграции с внешними
хранилищами и сервисами │ ├── README.md # 🔹 Принципы: transport-only, no business logic |
TypeScript + Effect │ ├── RedisAdapter.ts # 🔹 Хранение и чтение feature flags из Redis |
TypeScript + Effect │ ├── DatabaseAdapter.ts # 🔹 Хранение в базе данных (PostgreSQL / Prisma) |
TypeScript + Effect │ └── index.ts # 🔹 Экспорт всех адаптеров | TypeScript ├── runtime/ # 🔹
Runtime-инструменты для работы с feature flags │ ├── README.md # 🔹 Применение фич в runtime,
middleware pipeline | TypeScript + Effect + FP │ ├── FeatureFlagService.ts # 🔹 Сервис для получения
состояния фич | TypeScript + Effect │ ├── FeatureFlagMiddleware.ts # 🔹 Middleware для
автоматической проверки фич | TypeScript + Effect │ └── index.ts # 🔹 Экспорт runtime | TypeScript
├── utils/ # 🔹 FP-friendly утилиты │ ├── README.md # 🔹 Хелперы для feature flag combinators,
conditions | TypeScript + FP │ ├── conditions.ts # 🔹 Проверка условий для включения фич |
TypeScript + FP │ ├── combinators.ts # 🔹 FP combinators: and, or, not | TypeScript + FP │ └──
index.ts # 🔹 Экспорт утилит | TypeScript ├── types/ # 🔹 Общие типы │ ├── README.md # 🔹 Типы
feature flag DTO / domain-safe | TypeScript + FP │ ├── DTO.ts # 🔹 DTO для передачи между сервисами
| TypeScript │ ├── DomainTypes.ts # 🔹 Immutable domain types | TypeScript + FP │ └── index.ts # 🔹
Экспорт типов | TypeScript └── test/ # ✅ Unit / Integration тесты feature flags ├── mocks/ # 🔹
Моки для testing adapters / core / runtime | TypeScript + Effect ├── core.test.ts # 🔹 Тесты core
logic | TypeScript + FP + Effect ├── runtime.test.ts # 🔹 Тесты runtime и middleware | TypeScript +
Effect └── index.ts # 🔹 Экспорт helper-ов для тестов | TypeScript
