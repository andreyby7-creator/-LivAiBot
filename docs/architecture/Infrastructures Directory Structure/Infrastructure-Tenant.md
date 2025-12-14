infrastructure-tenant/ ├── README.md # 🔹 Обзор Tenant Infrastructure: принципы изоляции, runtime
context, adapters, lifecycle TypeScript-friendly + FP ideas + Effect-based async ├── index.ts # 🔹
Главный экспорт всех адаптеров и инфраструктурных функций TypeScript + FP + Effect (объединяет
чистые функции и эффекты) ├── adapters/ # 🔹 Адаптеры для изоляции данных tenant │ ├── README.md #
🔹 Принципы адаптеров: transport-only, no business logic TypeScript + FP + Effect: чистые async
эффекты (TaskEither/IO) │ ├── compliance-adapter.ts # 🔹 Проверка соответствия tenant политике │ ├──
firewall-adapter.ts # 🔹 Ограничение доступа tenant │ ├── isolation-adapter.ts # 🔹 Tenant isolation
механизмы │ ├── quota-adapter.ts # 🔹 Лимиты ресурсов tenant │ └── index.ts # 🔹 Экспорт всех
адаптеров ├── capability/ # 🔹 Управление возможностями tenant (capabilities) TypeScript + FP +
Effect Engine и resolver через чистые функции и TaskEither/Effect Storage abstractions FP-friendly
(InMemory/DB) │ ├── CapabilityOverrideEngine.ts # 🔹 Engine для переопределения capabilities │ ├──
TenantCapabilityMatrix.ts # 🔹 Матрица возможностей tenant │ ├── TenantCapabilityResolver.ts # 🔹
Resolver для определения доступных capabilities │ ├── storage/ # 🔹 Хранилища для capabilities │ └──
types.ts # 🔹 Типы для capability системы ├── context/ # 🔹 Tenant runtime context + DI TypeScript +
FP Immutable runtime context DI через чистые factory функции │ ├── TenantRuntimeContext.ts # 🔹
Immutable runtime context для tenant │ └── types.ts # 🔹 Типы для DI и context ├── health/ # 🔹
Health checks / DSL для tenant компонентов TypeScript + Effect Чистые функции DSL для health
проверки компонентов │ ├── HealthDSL.ts # 🔹 DSL для описания health checks │ └── index.ts # 🔹
Экспорт health функций ├── isolation/ # 🔹 Tenant data isolation механизмы TypeScript + Effect
Orchestrator через чистые async эффекты │ ├── TenantIsolationOrchestrator.ts # 🔹 Оркестратор
изоляции данных tenant │ └── index.ts # 🔹 Экспорт isolation функций ├── middleware/ # 🔹 Tenant
runtime middleware pipeline TypeScript + FP + Effect Composable pipeline, чистые middlewares │ ├──
CircuitBreakerMiddleware.ts # 🔹 Middleware для circuit breaker │ ├── RetryMiddleware.ts # 🔹
Middleware для retry логики │ ├── ObservabilityMiddleware.ts # 🔹 Middleware для observability │ ├──
EventPublishingMiddleware.ts # 🔹 Middleware для публикации событий │ └── index.ts # 🔹 Экспорт всех
middleware ├── runtime/ # 🔹 Исполнение tenant runtime + execution graph TypeScript + FP + Effect
Execution graph через immutable структуры Mocks для unit/integration тестов │ ├──
TenantRuntimeExecutor.ts # 🔹 Исполнитель tenant runtime │ ├── TenantContextFactory.ts # 🔹 Factory
для создания tenant context │ ├── execution-graph/ # 🔹 Execution graph компоненты │ │ ├──
ExecutionGraphStep.ts # 🔹 Шаг execution graph │ │ ├── ExecutionStepTracker.ts # 🔹 Трекер шагов
выполнения │ │ └── TenantExecutionGraph.ts # 🔹 Граф выполнения tenant │ ├── mocks/ # 🔹 Mocks для
тестирования │ └── TenantRuntimeTelemetry.ts # 🔹 Telemetry для runtime ├── storage/ # 🔹 Общие
хранилища для tenant infra TypeScript + FP-friendly Чистые абстракции над DB/Cache │ └── index.ts #
🔹 Экспорт storage абстракций └── test/ # ✅ Unit / Integration тесты tenant infra TypeScript +
Vitest Используют mocks + эффекты для изоляции и предсказуемости
