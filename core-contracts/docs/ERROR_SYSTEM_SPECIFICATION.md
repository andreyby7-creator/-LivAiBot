# 🎯 Error System Specification v2.0 - LivAiBot

## Цели системы ошибок (фиксируем как инварианты)

Система ошибок должна:

- ✅ **Быть Effect-bounded** - Effect используется только в async операциях, instrumentation и metrics. Base types остаются чистыми.
- ✅ **ADT + Cause + FiberFailure** - типобезопасные discriminated unions, Cause для chaining, FiberFailure для runtime
- ✅ **Layer-safe, FP-safe, immutable** - строгие границы слоев, функциональное программирование, иммутабельность
- ✅ **Иметь строгую семантику** - каждый тип ошибки имеет четкий смысл и контекст
- ✅ **ErrorCode = контракт** - стабильные коды ошибок как ABI между компонентами
- ✅ **Metadata = декларативна** - декларативное описание свойств ошибок
- ✅ **Не протекать между слоями** - domain ≠ application ≠ infrastructure
- ✅ **Domain ≠ Application ≠ Infrastructure** - четкое разделение ответственности
- ✅ **Безопасная** - error sanitization, no information disclosure, secure serialization
- ✅ **Производительная** - lazy evaluation, caching, optimized traversals
- ✅ **Масштабируемая** - unified registries, scaffolding tools, extension lifecycle
- ✅ **Поддерживать будущее** - telemetry / retry / policy / SLO / UI / observability
- ✅ **Не требовать runtime-маппинга** - всё определяется на уровне типов и констант

---

## 📁 Архитектурное дерево системы ошибок

```
errors/
├── README.md                        # 📚 Система документации + архитектурные инварианты [Markdown]
├── index.ts                         # 🔌 Главный экспорт всех ошибок (re-export) [TypeScript]
├── package.json                     # 📦 Метаданные пакета + скрипты сборки [JSON]
│                                    # ⚠️ Добавить: "private": true, "workspaces": ["services/*", "extensions/*"]

├── base/                            # ⚛️ ЯДРО СИСТЕМЫ ОШИБОК (неизменяемый фундамент)
│   ├── index.ts                     # Versioned экспорты ядра системы [TypeScript]
│   ├── BaseError.ts                 # Чистый discriminated union тип ошибки [TypeScript]
│   ├── ErrorBuilders.ts             # Фабрики создания ошибок [TypeScript]
│   ├── BaseErrorTypes.ts            # Утилитарные типы: OptionalCause<E>, ErrorTag<C>, matchError [TypeScript]
│   ├── ErrorCode.ts                 # Универсальные коды ошибок (контракт ABI) [TypeScript]
│   ├── ErrorConstants.ts            # Перечисления Severity/Category/Origin [TypeScript]
│   ├── ErrorCodeMeta.ts             # Типы метаданных кодов ошибок [TypeScript]
│   ├── UnifiedErrorRegistry.ts      # Единый реестр всех ошибок с namespacing [TypeScript]
│   ├── ErrorMetadata.ts             # Технические метаданные (correlationId, context) [TypeScript + type-fest]
│   ├── ErrorSanitizers.ts           # Security sanitization: no sensitive data leaks [TypeScript]
│   ├── ErrorUtilsCore.ts            # Базовые утилиты работы с ошибками [TypeScript]
│   ├── ErrorTransformers.ts         # Трансформеры и мапперы ошибок [TypeScript]
│   ├── ErrorStrategies.ts           # Стратегии обработки ошибок [TypeScript]
│   ├── ErrorValidators.ts           # Runtime проверки и валидация [TypeScript]
│   ├── ErrorMetrics.ts              # Определения метрик ошибок [TypeScript + Effect]
│   └── ErrorInstrumentation.ts      # Хелперы телеметрии и наблюдаемости [TypeScript + Effect]
│   # ✅ Effect используется ТОЛЬКО в metrics и instrumentation

├── shared/                          # 🔄 ОБЩИЕ ПОВТОРНО ИСПОЛЬЗУЕМЫЕ ОШИБКИ
│   ├── README.md                    # 📋 Правила использования shared vs сервисный слой [Markdown]
│   ├── index.ts                     # Selective exports shared API [TypeScript]
│   ├── SharedErrorTypes.ts          # Shared-specific типы и discriminated unions [TypeScript]
│   ├── SharedErrorRegistry.ts       # Реестр общих ошибок с метаданными [TypeScript + Effect]
│   ├── SharedValidators.ts          # Валидаторы shared инвариантов [TypeScript + Effect]
│   ├── SharedInstrumentation.ts     # Monitoring shared операций [TypeScript + Effect/OpenTelemetry]
│   ├── domain/                      # 🔐 Общие доменные ошибки: ValidationError, AuthError [TypeScript]
│   ├── infrastructure/              # 🏗️ Общие инфраструктурные ошибки: DB, Network, Cache [TypeScript + Effect]
│   ├── serialization/               # 📤 Общие сериализаторы: JSON, gRPC, GraphQL [TypeScript + Effect]
│   ├── adapters/                    # 🔌 Общие адаптеры: HTTP, DB, Cache с DI [TypeScript + Effect]
│   ├── normalizers/                 # 🔄 Общие нормализаторы: HTTP, DB error mapping [TypeScript]
│   └── policies/                    # 🎛️ Общие политики: Retry, CircuitBreaker, Fallback [TypeScript + Effect]
│   # ⚠️ Не допустить "зависимого монолита" - импортировать только base, не services

├── services/                        # 🏢 СПЕЦИФИЧНЫЕ ОШИБКИ СЕРВИСОВ (автономные)
│   ├── index.ts                     # Selective exports по сервисам [TypeScript]
│   ├── ServiceErrorTypes.ts         # Common service типы: ServiceUnavailableError, TimeoutError [TypeScript]
│   ├── ServiceErrorRegistry.ts      # Cross-service реестр ошибок [TypeScript + Effect]
│   ├── ServiceValidators.ts         # Cross-service валидаторы [TypeScript + Effect]
│   ├── ServiceInstrumentation.ts    # Cross-service monitoring [TypeScript + Effect/OpenTelemetry]
│   ├── ai-service/
│   │   ├── AIServiceErrorTypes.ts   # AI-specific типы: ModelLoadError, InferenceError [TypeScript]
│   │   ├── AIServiceErrorRegistry.ts # AI ошибки registry: SERVICE_AI_* [TypeScript + Effect]
│   │   ├── AIServiceValidators.ts   # AI валидаторы: model, token validation [TypeScript + Effect]
│   │   ├── AIServiceInstrumentation.ts # ML monitoring: performance, latency [TypeScript + Effect/OpenTelemetry]
│   │   ├── index.ts                 # AI service exports [TypeScript]
│   │   ├── domain/                  # 🤖 AI доменные ошибки: PromptValidationError [TypeScript]
│   │   ├── infrastructure/          # 🖥️ Yandex AI API errors: connection, rate limits [TypeScript + Effect]
│   │   ├── policies/                # 🎛️ AI стратегии: model fallback, token retry [TypeScript + Effect]
│   │   ├── serialization/           # 📤 AI response/result serialization [TypeScript + Effect]
│   │   ├── adapters/                # 🔌 Yandex AI SDK adapter [TypeScript + Effect]
│   │   └── normalizers/             # 🔄 Yandex API response normalization [TypeScript]
│   ├── billing-service/
│   │   ├── BillingServiceErrorTypes.ts # Payment типы: PaymentFailedError, SubscriptionError [TypeScript]
│   │   ├── BillingServiceErrorRegistry.ts # Billing registry: SERVICE_BILLING_* [TypeScript + Effect]
│   │   ├── BillingServiceValidators.ts # Payment валидаторы: PCI compliance [TypeScript + Effect]
│   │   ├── BillingServiceInstrumentation.ts # Payment monitoring: fraud detection [TypeScript + Effect/OpenTelemetry]
│   │   ├── index.ts                 # Billing service exports [TypeScript]
│   │   ├── domain/                  # 💳 Billing доменные ошибки: subscription limits [TypeScript]
│   │   ├── infrastructure/          # 🏦 Payment gateway errors: Stripe API failures [TypeScript + Effect]
│   │   ├── policies/                # 🎛️ Payment стратегии: retry, fraud detection [TypeScript + Effect]
│   │   ├── serialization/           # 📤 Payment data serialization, PCI masking [TypeScript + Effect]
│   │   ├── adapters/                # 🔌 Payment gateway adapters [TypeScript + Effect]
│   │   └── normalizers/             # 🔄 Gateway response normalization [TypeScript]
│   ├── tenant-service/
│   │   ├── TenantServiceErrorTypes.ts # Tenant типы: QuotaExceededError, IsolationError [TypeScript]
│   │   ├── TenantServiceErrorRegistry.ts # Tenant registry: SERVICE_TENANT_* [TypeScript + Effect]
│   │   ├── TenantServiceValidators.ts # Tenant валидаторы: quota, isolation [TypeScript + Effect]
│   │   ├── TenantServiceInstrumentation.ts # Tenant monitoring: usage metrics [TypeScript + Effect/OpenTelemetry]
│   │   ├── index.ts                 # Tenant service exports [TypeScript]
│   │   ├── domain/                  # 🏢 Tenant доменные ошибки: resource allocation [TypeScript]
│   │   ├── infrastructure/          # 🗂️ Multi-tenant DB/cache errors [TypeScript + Effect]
│   │   ├── policies/                # 🎛️ Tenant стратегии: quota enforcement [TypeScript + Effect]
│   │   ├── serialization/           # 📤 Tenant-scoped serialization [TypeScript + Effect]
│   │   ├── adapters/                # 🔌 Multi-tenant database adapters [TypeScript + Effect]
│   │   └── normalizers/             # 🔄 Tenant data normalization [TypeScript]
│   ├── mobile-service/
│   │   ├── MobileServiceErrorTypes.ts # Mobile типы: NetworkOfflineError, SyncConflictError [TypeScript]
│   │   ├── MobileServiceErrorRegistry.ts # Mobile registry: SERVICE_MOBILE_* [TypeScript + Effect]
│   │   ├── MobileServiceValidators.ts # Mobile валидаторы: platform, version [TypeScript + Effect]
│   │   ├── MobileServiceInstrumentation.ts # Mobile monitoring: crash reports [TypeScript + Effect/OpenTelemetry]
│   │   ├── index.ts                 # Mobile service exports [TypeScript]
│   │   ├── domain/                  # 📱 Mobile доменные ошибки: offline operations [TypeScript]
│   │   ├── infrastructure/          # 📡 Device/platform errors: iOS/Android [TypeScript + Effect]
│   │   ├── policies/                # 🎛️ Mobile стратегии: offline retry, sync conflicts [TypeScript + Effect]
│   │   ├── serialization/           # 📤 Push payloads, offline queue formats [TypeScript + Effect]
│   │   ├── adapters/                # 🔌 React Native, Firebase adapters [TypeScript + Effect]
│   │   └── normalizers/             # 🔄 Mobile data normalization [TypeScript]
│   └── feature-flag-service/
│       ├── FeatureFlagServiceErrorTypes.ts # FF типы: FlagNotFoundError, TargetingError [TypeScript]
│       ├── FeatureFlagServiceErrorRegistry.ts # FF registry: SERVICE_FEATURE_* [TypeScript + Effect]
│       ├── FeatureFlagServiceValidators.ts # FF валидаторы: targeting rules [TypeScript + Effect]
│       ├── FeatureFlagServiceInstrumentation.ts # FF monitoring: rollout metrics [TypeScript + Effect/OpenTelemetry]
│       ├── index.ts                 # Feature flag service exports [TypeScript]
│       ├── domain/                  # 🚩 FF доменные ошибки: flag configuration [TypeScript]
│       ├── infrastructure/          # 🎛️ Flag storage/retrieval errors [TypeScript + Effect]
│       ├── policies/                # 🎛️ FF стратегии: gradual rollout [TypeScript + Effect]
│       ├── serialization/           # 📤 Feature flag state serialization [TypeScript + Effect]
│       ├── adapters/                # 🔌 LaunchDarkly adapters [TypeScript + Effect]
│       └── normalizers/             # 🔄 Flag data normalization [TypeScript]
│   # ⚠️ Каждый сервис автономен, использует base/shared, не зависит от других сервисов

├── contracts/                       # 🤝 КОНТРАКТЫ МЕЖСЕРВИСНОГО ВЗАИМОДЕЙСТВИЯ
│   ├── index.ts                     # Selective exports контрактов [TypeScript]
│   ├── ContractErrorTypes.ts        # Contract типы: ServiceCallError, CircuitBreakerError [TypeScript]
│   ├── ContractErrorRegistry.ts     # Contract registry: CONTRACT_* codes [TypeScript + Effect]
│   ├── ContractValidators.ts        # Contract валидаторы: SLA, health checks [TypeScript + Effect]
│   ├── ContractInstrumentation.ts   # Contract monitoring: service mesh tracing [TypeScript + Effect/OpenTelemetry]
│   ├── ServiceErrorMap.ts           # Error mappings: AI→Billing, Billing→Mobile [TypeScript]
│   ├── ErrorBoundaryTypes.ts        # Boundary типы: GatewayTimeoutError, ServiceUnavailableError [TypeScript]
│   ├── ContractValidation.ts        # Runtime contract validation [TypeScript]
│   ├── ErrorTranslation.ts          # Error translation: domain→transport→client [TypeScript]
│   ├── CircuitBreakerContracts.ts   # Circuit breaker coordination contracts [TypeScript + Effect]
│   ├── TracingContracts.ts          # Distributed tracing contracts [TypeScript + Effect/OpenTelemetry]
│   ├── FederationUtils.ts           # Federation/gateway utilities [TypeScript + Effect]
│   ├── ServiceMeshIntegration.ts    # Service mesh integration [TypeScript + Effect]
│   ├── APIGatewayContracts.ts       # API gateway error contracts [TypeScript]
│   └── versioning/                  # 📅 Contract versions & migrations [TypeScript]
│   # ⚠️ Contracts обеспечивают loose coupling между сервисами через error translation

├── tools/                           # 🛠️ ИНСТРУМЕНТЫ РАЗРАБОТКИ
│   ├── codegen/                     # Генерация кода для сервисов [TypeScript]
│   │   ├── templates/               # Шаблоны ошибок для новых сервисов [Handlebars]
│   │   ├── generators/              # CLI инструменты генерации [TypeScript + Commander]
│   │   └── validators/              # Валидаторы структуры ошибок [TypeScript]
│   ├── examples/                    # 📖 Примеры использования [TypeScript]
│   │   ├── ai-service-usage.ts      # Как использовать ошибки ИИ [TypeScript]
│   │   ├── cross-service-errors.ts  # Обработка межсервисных ошибок [TypeScript]
│   │   └── best-practices.ts        # Паттерны обработки ошибок [TypeScript]
│   └── migration/                   # Помощники миграции [TypeScript]
│       ├── v1-to-v2/                # Руководства по миграции [Markdown]
│       └── breaking-changes/        # Документация breaking changes [Markdown]

├── extensions/                      # 🌍 СООБЩЕСТВЕННЫЕ РАСШИРЕНИЯ
│   ├── index.ts                     # Selective exports расширений [TypeScript]
│   ├── ExtensionErrorTypes.ts       # Common extension типы [TypeScript]
│   ├── ExtensionErrorRegistry.ts    # Extension registry [TypeScript + Effect]
│   ├── ExtensionValidators.ts       # Extension валидаторы [TypeScript + Effect]
│   ├── ExtensionInstrumentation.ts  # Extension monitoring [TypeScript + Effect/OpenTelemetry]
│   ├── ml-errors/                   # 🤖 ML/AI Framework Errors [TypeScript]
│   │   ├── MLErrorTypes.ts          # ML типы: ModelLoadError, InferenceError [TypeScript]
│   │   ├── MLErrorRegistry.ts       # ML registry: EXTENSION_ML_* [TypeScript + Effect]
│   │   ├── MLValidators.ts          # ML валидаторы: tensor shapes [TypeScript + Effect]
│   │   ├── MLInstrumentation.ts     # ML monitoring: GPU utilization [TypeScript + Effect/OpenTelemetry]
│   │   ├── tensorflow/               # TensorFlow-specific errors [TypeScript]
│   │   ├── pytorch/                  # PyTorch-specific errors [TypeScript]
│   │   └── model-serving/            # Model serving errors [TypeScript]
│   ├── blockchain-errors/           # ⛓️ Blockchain/Web3 Errors [TypeScript]
│   │   ├── BlockchainErrorTypes.ts  # Blockchain типы: TransactionError [TypeScript]
│   │   ├── BlockchainErrorRegistry.ts # Blockchain registry: EXTENSION_BLOCKCHAIN_* [TypeScript + Effect]
│   │   ├── BlockchainValidators.ts  # Blockchain валидаторы: address validation [TypeScript + Effect]
│   │   ├── BlockchainInstrumentation.ts # Blockchain monitoring: gas usage [TypeScript + Effect/OpenTelemetry]
│   │   ├── ethereum/                 # Ethereum-specific errors [TypeScript]
│   │   ├── smart-contracts/          # Smart contract errors [TypeScript]
│   │   └── web3/                     # Web3 interaction errors [TypeScript]
│   ├── iot-errors/                  # 📡 IoT/Embedded Errors [TypeScript]
│   │   ├── IoTErrorTypes.ts         # IoT типы: ConnectivityError, SensorError [TypeScript]
│   │   ├── IoTErrorRegistry.ts      # IoT registry: EXTENSION_IOT_* [TypeScript + Effect]
│   │   ├── IoTValidators.ts         # IoT валидаторы: protocol compliance [TypeScript + Effect]
│   │   ├── IoTInstrumentation.ts    # IoT monitoring: device health [TypeScript + Effect/OpenTelemetry]
│   │   ├── connectivity/             # Connection errors [TypeScript]
│   │   ├── sensors/                  # Sensor errors [TypeScript]
│   │   └── firmware/                 # Firmware errors [TypeScript]
│   ├── cloud-errors/                # ☁️ Cloud Provider Errors [TypeScript]
│   │   ├── CloudErrorTypes.ts       # Cloud типы: ServiceError, QuotaError [TypeScript]
│   │   ├── CloudErrorRegistry.ts    # Cloud registry: EXTENSION_CLOUD_* [TypeScript + Effect]
│   │   ├── CloudValidators.ts       # Cloud валидаторы: IAM permissions [TypeScript + Effect]
│   │   ├── CloudInstrumentation.ts  # Cloud monitoring: API metrics [TypeScript + Effect/OpenTelemetry]
│   │   ├── aws/                      # AWS-specific errors [TypeScript]
│   │   ├── gcp/                      # GCP-specific errors [TypeScript]
│   │   └── azure/                    # Azure-specific errors [TypeScript]
│   └── database-errors/             # 🗄️ Database-Specific Errors [TypeScript]
│       ├── DatabaseErrorTypes.ts    # DB типы: ConnectionError, QueryError [TypeScript]
│       ├── DatabaseErrorRegistry.ts # DB registry: EXTENSION_DB_* [TypeScript + Effect]
│       ├── DatabaseValidators.ts    # DB валидаторы: query syntax [TypeScript + Effect]
│       ├── DatabaseInstrumentation.ts # DB monitoring: query performance [TypeScript + Effect/OpenTelemetry]
│       ├── sql/                      # SQL database errors [TypeScript]
│       ├── nosql/                    # NoSQL database errors [TypeScript]
│       └── orm/                      # ORM-specific errors [TypeScript]

└── governance/                      # 📋 УПРАВЛЕНИЕ И ПРАВИЛА
    ├── CHANGELOG.md                 # История изменений [Markdown]
    ├── CONTRIBUTING.md              # Как внести вклад [Markdown]
    ├── error-naming-conventions.md  # Стандарты именования [Markdown]
    ├── deprecation-policy.md        # Политика устаревания [Markdown]
    ├── breaking-change-policy.md    # Процесс breaking changes [Markdown]
    └── service-onboarding.md        # Как добавить новый сервис [Markdown]
```

---

## 📋 **Порядок разработки**

### 1️⃣ **Ядро системы (base/)**

**Приоритет: Высокий** - Разрабатывается первым, все остальные слои зависят от него.

**🔧 Архитектурные рекомендации:**

- **Избегать циклических зависимостей**: BaseError.ts не должен зависеть от файлов, которые зависят от него
- **Минимизировать поверхность API**: Экспортировать только необходимые типы и функции
- **Обеспечить immutable by default**: Все структуры должны быть иммутабельными из коробки

**BaseErrorTypes.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Полная система базовых типов ошибок для LivAiBot платформы. `OptionalCause<E>`, `SafeCause<E>`, `ErrorTag<C>`, `TaggedError<T, Tag>`, `ErrorMatcher<E, R>`, `ExhaustiveMatcher<E, A>`, `PatternMap<E, A>`, `ErrorChain<E>`, `AggregatedError<E>`. Специализированные типы: `IntegrationError<T>`, `AIProcessingError`, `UserContextError`, `AdminOperationError`, `MobilePlatformError`. Type guards: `isTaggedError`, `isIntegrationError`, etc. Hierarchical pattern matching для performance.
- **Зависимости**: нет
- **Используется в**: ErrorBuilders.ts, ErrorUtilsCore.ts, ErrorTransformers.ts, ErrorValidators.ts, ErrorStrategies.ts
- **🔧 Hierarchical pattern matching**: `matchByCategory()` вместо 100+ individual cases - massive performance improvement
- **🔧 Полная система pattern matching**: ExhaustiveMatcher для гарантии покрытия всех кейсов, IntegrationError для внешних API, AIProcessingError для ML операций, context-aware типы для разных ролей пользователей
- **🔧 Точечное отключение ESLint**: `fp/no-throw` отключено для `matchByCategory()` в `BaseErrorTypes.ts` - используется `throw` для compile-time safety при pattern matching
- **Экспортирует**: OptionalCause<E>, SafeCause<E>, ErrorTag<C>, TaggedError<T, Tag>, ErrorMatcher<E, R>, ExhaustiveMatcher<E, A>, PatternMap<E, A>, ErrorChain<E>, AggregatedError<E>, IntegrationError<T>, AIProcessingError, UserContextError, AdminOperationError, MobilePlatformError, isTaggedError, isIntegrationError, isAIProcessingError, isUserContextError, isAdminOperationError, isMobilePlatformError, matchByCategory
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorCode.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Полная иерархия кодов ошибок LivAiBot с семантическими префиксами. Структура: `PREFIX_CATEGORY_INCREMENT` (DOMAIN_AUTH_001). Группы: Domain (бизнес-логика), Infra (инфраструктура), Service (сервисы), Admin (админ-панель). Подгруппы: AUTH, USER, SUBSCRIPTION, BOT, INTEGRATION, TOKEN, DB, CACHE, NETWORK, EXTERNAL, AI, BILLING, MOBILE, TENANT, FEATURE, FINANCE, AUDIT. ABI-safe с validation helpers.
- **Зависимости**: нет
- **Используется в**: BaseError.ts, ErrorCodeMeta.ts, ErrorCodeMetaData.ts, ErrorValidators.ts, ErrorStrategies.ts
- **🔧 Расширенная иерархия**: `DOMAIN_SUBSCRIPTION_001`, `DOMAIN_INTEGRATION_001`, `DOMAIN_BOT_001`, `ADMIN_USER_001`, `MOBILE_*` с полным покрытием LivAiBot доменов
- **🔧 Validation helpers**: `validateErrorCodeUniqueness()`, `createErrorCode<T>()`, `ServiceErrorCodeMapping` для type-safe валидации
- **🔧 Точечное отключение ESLint**: `fp/no-throw` отключено для `ErrorCode.ts` - используется `throw` для compile-time safety в error system
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorConstants.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Полная система констант ошибок LivAiBot с расширенной классификацией. `Severity` (Critical/Fatal, Error, Warning, Info), `Category` (Business, Technical, Security, Performance), `Origin` (Domain, Infrastructure, Service, External, Admin). Дополнительно: `Impact` (User, System, Data), `Scope` (Request, Session, Global), `Layer` (Presentation, Application, Domain, Infrastructure), `Priority` (Low, Medium, High, Critical), `RetryPolicy` (None, Immediate, ExponentialBackoff, Scheduled). Immutable, чисто declarative.
- **Зависимости**: нет
- **Используется в**: BaseError.ts, ErrorCodeMeta.ts, ErrorValidators.ts, ErrorStrategies.ts
- **🔧 Расширения**: Новые категории (Layer, Priority, RetryPolicy) обеспечивают полную классификацию для SLO, alerting, observability и политик повтора
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorCodeMeta.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Типы метаданных для кодов ошибок (`description`, `severity`, `category`); добавить `defaultSeverity` и `defaultOrigin` для упрощения фабрик. Без runtime зависимостей.
- **Зависимости**: ErrorCode.ts, ErrorConstants.ts
- **Используется в**: ErrorCodeMetaData.ts, BaseError.ts
- **🔧 Точечное отключение ESLint**: `fp/no-throw` отключено для файлов `*ErrorCode*.ts` - используется `throw` для compile-time safety в error system
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**UnifiedErrorRegistry.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Единый реестр всех ошибок системы с namespacing. Структура: `BASE.*`, `SHARED.*`, `SERVICES.*`, `CONTRACTS.*`, `EXTENSIONS.*`. Функции `getMeta(code)`, `hasMeta(code)`, `getByNamespace(namespace)` для безопасного доступа. Компилируется в unified lookup table для performance.
- **Зависимости**: ErrorCodeMeta.ts, ErrorCode.ts
- **Используется в**: BaseError.ts, все слои для error metadata lookup
- **🔧 Namespacing**: Избегание конфликтов кодов между слоями и сервисами
- **🔧 Performance**: Pre-compiled registry, cached lookups
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorMetadata.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Enterprise-grade система метаданных LivAiBot с deterministic генерацией, chain-aware merging, typed contexts и tracing support. `CorrelationId`, `context`, `timestamp`, `MetadataClock` interface для DI, `mergeMetadata()` helper, typed contexts (UserContext, BotContext, IntegrationContext, AIProcessingContext, AdminContext), `TracingMetadata` для distributed debugging, validation helpers. Полностью тестируемая и production-ready.
- **Зависимости**: нет (но использует Effect Context для clock DI)
- **Используется в**: BaseError.ts, ErrorBuilders.ts, ErrorTransformers.ts, ErrorSanitizers.ts
- **🔧 Deterministic генерация**: `MetadataClock` interface с DI для тестируемой генерации correlationId/timestamp
- **🔧 Chain-aware merging**: `mergeMetadata()` с стратегиями для объединения метаданных при chainErrors
- **🔧 Typed contexts**: Специфичные типы контекстов для каждого домена LivAiBot (пользователи, боты, интеграции, AI, админ)
- **🔧 Tracing support**: `TracingMetadata` для distributed debugging в сложной экосистеме
- **🔧 Validation**: `validateMetadata()`, `withTracing()` helpers для production safety
- **🛠️ Стек**: TypeScript + Effect
- **⚠️ Архитектурное исключение**: `prefer-readonly-parameter-types: off` для functional-first подхода (immutable паттерны Effect)
  Обязательно русские: @file и компактные jsdoc

**ErrorSanitizers.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Security sanitization для предотвращения information disclosure. `sanitizeError()` для удаления sensitive data, `sanitizeStackTrace()` для фильтрации internal paths, `sanitizeContext()` для очистки sensitive context fields. Configurable sanitization levels (strict/production/dev).
- **Зависимости**: BaseErrorTypes.ts, ErrorMetadata.ts
- **Используется в**: BaseError.ts (toJSON method), ErrorTransformers.ts (serialization), external consumers
- **🔧 Sensitive data removal**: API keys, passwords, connection strings, personal data
- **🔧 Stack trace filtering**: Internal paths, file names, line numbers in production
- **🔧 Configurable levels**: strict (max sanitization), production (balanced), dev (minimal)
- **🔧 Error code abstraction**: Internal codes → generic public codes для security
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorValidators.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Balanced validation system для LivAiBot с compile-time и runtime checks. Core invariants: `assertImmutable()` с shallow/deep modes, `assertValidErrorCode()` с registry validation, `assertMatchingMetadata()` с configurable tolerance. Compile-time helpers: `ValidErrorCode<T>`, `ImmutableError<E>`, `HasRequiredFields<E>` conditional types. Performance-optimized: lazy validation, configurable strictness levels (strict/dev/production), Effect-based async validators.
- **Зависимости**: BaseErrorTypes.ts, ErrorCode.ts, ErrorConstants.ts, ErrorMetadata.ts
- **Используется в**: external consumers (НЕ BaseError.ts), ErrorBuilders.ts (runtime validation), ErrorTransformers.ts (chain validation)
- **🔧 Core invariants**: Immutable checks (shallow mode для perf), valid error codes, metadata consistency validation
- **🔧 Compile-time helpers**: TS conditional types для type-safe validation (`ValidErrorCode<C>`, `ImmutableError<E>`)
- **🔧 Balanced performance**: Configurable strictness (strict/dev/prod), lazy evaluation, cached results
- **🔧 Advanced validation**: Chain validation, structural checks, custom validation rules
- **🔧 Effect integration**: `validateErrorEffect()` для async validation operations
- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ErrorBuilders.ts** ✅

- **Содержимое**: Enterprise-grade фабрики ошибок LivAiBot с полным coverage всех доменов. Возвращает промежуточные TaggedError<T, Tag> типы для каждого домена: Domain (Auth, User, Subscription, Bot, Token, Integration), Infra (Database, Cache, Network, External), Service (AI, Billing, Mobile, Tenant, Feature), Admin (User, Finance, Audit, Integration). Fluent API, Effect-native builders для async операций, automatic metadata generation, validation. Полностью устраняет циклические зависимости.
- **Зависимости**: BaseErrorTypes.ts, ErrorMetadata.ts, ErrorCode.ts, ErrorConstants.ts, ErrorValidators.ts
- **Используется в**: external consumers, BaseError.ts (конвертация TaggedError в финальные типы)
- **🔧 Промежуточные типы**: Все builders возвращают TaggedError<T, Tag>, а не BaseError напрямую
- **🔧 Полный coverage**: 6 domain + 4 infra + 5 service + 4 admin = 19 специализированных builders
- **🔧 Fluent API**: `errorBuilder().domain('Auth').code('...').message('...').context(...).cause(...).build()`
- **🔧 Effect-native**: `createAsyncError()` для async операций с Effect integration
- **🔧 Metadata integration**: Automatic metadata generation с deterministic clock
- **🔧 Validation**: Runtime validation кодов и данных на этапе создания
- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ErrorUtilsCore.ts** ✅

- **Содержимое**: Enterprise-grade утилиты для работы с цепочками ошибок с полной защитой от edge cases и performance optimizations. `flattenCauses()` с детекцией циклов, `getErrorChain()` с safe traversal, `findRootCause()` с cycle protection, `safeTraverseCauses()` с configurable depth limit, `analyzeErrorChain()` для комплексного анализа. Lazy evaluation, caching, memoization для expensive operations.
- **Зависимости**: BaseErrorTypes.ts
- **Используется в**: external consumers (НЕ BaseError.ts), ErrorTransformers.ts
- **🔧 Edge case protection**: Полная защита от циклов, null causes, deep chains (configurable maxDepth=1000)
- **🔧 Safe utilities**: `safeGetCause()`, `safeTraverseCauses()`, cycle detection algorithms
- **🔧 Analysis tools**: `analyzeErrorChain()` возвращает chain stats, cycle detection, depth metrics
- **🔧 Performance**: Lazy evaluation, memoization, Set-based cycle detection, early termination, cached results
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorTransformers.ts** ✅

- **Содержимое**: Полная система generic трансформеров ошибок LivAiBot с intelligent metadata merging. `mapError<E,F>()` generic mapping, `chainErrors<E>()` с configurable strategies, `aggregateErrors<E>()` с custom aggregators, `filterErrors<E>()`, `groupErrors<E>()`, `transformErrorChain<E>()`. Полностью generic - не зависит от BaseError, работает с любыми error-like объектами.
- **Зависимости**: BaseErrorTypes.ts, ErrorMetadata.ts, ErrorUtilsCore.ts, ErrorValidators.ts
- **Используется в**: external consumers (НЕ BaseError.ts)
- **🔧 Generic design**: Все функции generic <E, F>, принимают любые error-like объекты
- **🔧 Intelligent merging**: `chainErrors()` с mergeMetadata() для chain-aware объединения контекстов
- **🔧 Advanced transformers**: `filterErrors()`, `groupErrors()`, `transformErrorChain()` для комплексных операций
- **🔧 Aggregation strategies**: `ErrorAggregators` (first, last, bySeverity, custom)
- **🔧 Effect integration**: `mapErrorEffect()`, `chainErrorsEffect()` для async трансформаций
- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ErrorStrategies.ts** ✅

- **Содержимое**: Enterprise-grade стратегии обработки ошибок LivAiBot с grouping по префиксам. 19 групповых стратегий (DOMAIN_AUTH__, INFRA_DB__, SERVICE_AI_* etc.) вместо individual codes. Composition-based архитектура с BaseStrategies + modifiers. Pure функции без side-effects, deterministic behavior. Effect integration для stateful операций (circuit breaker). Strategy resolution pipeline: custom → grouped → severity-based fallback.
- **Зависимости**: BaseErrorTypes.ts, ErrorCode.ts, ErrorConstants.ts
- **Используется в**: external consumers (НЕ BaseError.ts)
- **🔧 Grouping по префиксам**: 19 стратегий для групп кодов (DOMAIN__, INFRA__, SERVICE__, ADMIN__) вместо 100+ individual mappings
- **🔧 Composition architecture**: BaseStrategies + modifiers (withRetry, withAlert, withFallback) для flexible reuse
- **🔧 Pure functions**: Deterministic, no side-effects, testable без mocks
- **🔧 Effect integration**: Async стратегии для circuit breaker, monitoring через Effect Context
- **🔧 Resolution pipeline**: custom strategies → grouped strategies → severity-based fallback
- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ErrorMetrics.ts** ✅

- **Содержимое**: Интерфейсы для метрик с helpers `incrementErrorCounter()`, `observeLatency()`. Абстракция над конкретными метриками системами.
- **Зависимости**: Effect (или Event integration) - НЕ BaseError
- **Используется в**: BaseError.ts, external consumers
- **🔧 Рекомендация**: Использовать dependency injection паттерн для метрик системы, чтобы BaseError.ts не зависел от конкретной реализации.
- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ErrorInstrumentation.ts** ✅

- **Содержимое**: Абстрактные интерфейсы для observability: `logError()`, `sendToTelemetry()`, `mapErrorToSeverityMetric()`.
- **Зависимости**: Effect/OpenTelemetry - НЕ BaseError
- **Используется в**: BaseError.ts, external consumers
- **🔧 Рекомендация**: Использовать strategy паттерн для разных observability систем (console, Winston, OpenTelemetry).
- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**BaseError.ts** ✅

- **Содержимое**: Enterprise-grade discriminated union тип ошибки LivAiBot с максимальной safety и performance optimizations. Чистый immutable тип с deep immutability guarantee. Методы: `withCause()` (deep chain immutability), `withMetadata()` (configurable merge strategies), `asPlainObject()` (internal use), `toJSON()` (external serialization with sanitization). Chain manipulation: `prependCause()`, `withoutCause()`, `withCauseChain()`. Metadata helpers: `withCorrelationId()`, `withUserContext()`. Performance: lazy evaluation для complex chains, circular reference protection.
- **Зависимости**: BaseErrorTypes.ts, ErrorCode.ts, ErrorConstants.ts, ErrorCodeMeta.ts, ErrorCodeMetaData.ts, ErrorMetadata.ts (ТОЛЬКО типы, 6 зависимостей)
- **Используется в**: index.ts, shared layer, сервисах, контрактах, extensions, ErrorBuilders.ts (конвертация TaggedError)
- **🔧 TaggedError конвертация**: `toBaseError(taggedError: TaggedError<any, any>): BaseError` - преобразует промежуточные типы в финальные
- **🔧 Deep immutability**: withCause/withMetadata создают полностью новые объекты, cause chains immutable
- **🔧 Secure serialization**: `asPlainObject()` для internal, `toJSON()` для external с sanitization (no sensitive data, stack trace filtering)
- **🔧 Chain manipulation**: `prependCause()`, `withoutCause()`, `withCauseChain()` для complex error flows
- **🔧 Performance**: Lazy evaluation, memoization для expensive operations, circular reference detection
- **🔧 Рекомендация**: "Чистый" тип без зависимостей на утилиты. Все операции - отдельные функции, принимающие BaseError как параметр.
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**index.ts**

- **Содержимое**: Versioned selective exports ядра системы ошибок LivAiBot. Экспортирует ТОЛЬКО публичный API: 5 групп (Types, Builders, Utils, Validators, Strategies). НЕ экспортирует внутренние модули (ErrorCode, ErrorConstants, ErrorCodeMeta, etc.). Versioned API для backward compatibility.
- **Зависимости**: BaseError.ts (ТОЛЬКО публичные типы), ErrorBuilders.ts, ErrorUtilsCore.ts, ErrorTransformers.ts, ErrorValidators.ts, ErrorStrategies.ts
- **Используется в**: shared layer, сервисах, контрактах, extensions
- **🔧 Selective exports**: `export * as Types from './BaseError'`, `export * as Builders from './ErrorBuilders'`, `export * as Utils from './ErrorUtilsCore'`, etc. - контролируемый API без внутренних деталей
- **🔧 Versioning**: `export * as v2 from './current'`, `export * as v1 from './v1'`, `export * as latest from './current'`
- **🔧 Migration helpers**: `export { migrateErrorV1toV2 } from './migrations'`
- **🔧 НЕ экспортируется**: ErrorCode.ts, ErrorConstants.ts, ErrorCodeMeta.ts, ErrorCodeMetaData.ts, ErrorMetadata.ts, ErrorMetrics.ts, ErrorInstrumentation.ts (internal/implementation)
- **🔧 Developer guidance**: JSDoc с usage examples, но без перегрузки файла. Отдельная документация в /docs
- **🔧 API stability**: Semantic versioning для публичных exports, clear migration guides, deprecation warnings
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**💡 Комментарий:** разработку ядра лучше делать полностью immutable и test-first, чтобы остальные слои могли безопасно использовать его.

**💡 Комментарий:** shared layer имеет полную аналогию базовых компонентов (Types, Registry, Validators, Instrumentation) + специализированные модули (domain, infra, adapters, etc.) для максимальной reusability.

**💡 Комментарий:** services layer имеет enterprise-grade структуру: каждый сервис имеет полную аналогию базовых компонентов (Types, Registry, Validators, Instrumentation) + domain/infra/policies/serialization/adapters/normalizers для complete service isolation.

**💡 Комментарий:** contracts layer обеспечивает distributed error handling: error translation/transformation, service mesh integration, circuit breaker coordination, distributed tracing contracts для enterprise-grade межсервисного взаимодействия.

**💡 Комментарий:** extensions layer предоставляет ecosystem integrations: каждый extension имеет полную аналогию базовых компонентов (Types, Registry, Validators, Instrumentation) + domain-specific error types для seamless integration с external frameworks и protocols.

### 2️⃣ **Общий слой (shared/)**

**Приоритет: Высокий** - Зависит только от base/. Разрабатывается после ядра.

**SharedErrorTypes.ts** – Shared-specific типы ошибок: `SharedDomainError<T>`, `SharedInfraError<T>`, `SharedPolicyError<T>`, `SharedAdapterError<T>`. TaggedError discriminated unions для общих доменов. Type guards и pattern matching helpers.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**SharedErrorRegistry.ts** – Реестр общих ошибок LivAiBot: коды SHARED_DOMAIN__, SHARED_INFRA__, etc. с метаданными. Integration с base ErrorCode registry. Safe lookup функции.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**domain/** – Общие доменные ошибки LivAiBot: `ValidationError`, `AuthError`, `PermissionError`. Builders: `createValidationError()`, `createAuthError()`. Используют BaseError + ErrorBuilders для TaggedError типов. Независимы от инфраструктуры и сервисов.

**infrastructure/** – Общие инфраструктурные ошибки: `DatabaseError`, `CacheError`, `NetworkError`, `ExternalAPIError`. Builders: `createDatabaseError()`, `createNetworkError()`. Pure mapping от внешних ошибок к BaseError через ErrorBuilders. ErrorTransformers для обработки цепочек.

**serialization/** – HTTP/log сериализаторы: `JsonSerializer`, `GrpcSerializer`, `GraphqlSerializer`. Чистые функции преобразования BaseError.toJSON()/asPlainObject(). Error serialization strategies с metadata preservation.

**adapters/** – Effect/HTTP/DB адаптеры: `HttpAdapter`, `DatabaseAdapter`, `CacheAdapter`. Изоляция через DI. Error handling: BaseError, ErrorStrategies, ErrorValidators. Circuit breaker integration.

**normalizers/** – HTTP/DB нормализаторы: `HttpNormalizer`, `DatabaseNormalizer`. Перевод внешних ошибок в BaseError через ErrorBuilders. Runtime validation с ErrorValidators.

**policies/** – Общие стратегии: `RetryPolicy`, `CircuitBreakerPolicy`, `FallbackPolicy`. Declarative ErrorStrategies с группировкой. Custom policies без привязки к сервисам.

**SharedValidators.ts** – Валидаторы shared инвариантов: `validateSharedDomain()`, `validateSharedInfra()`. Integration с base ErrorValidators. Custom validation rules для shared contexts.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**SharedInstrumentation.ts** – Monitoring shared операций: tracing adapters, metrics policies, logging normalizers. Strategy pattern для разных observability систем.

- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**index.ts** – Selective exports: `export * as Types from './SharedErrorTypes'`, `export * as Domain from './domain'`, `export * as Infra from './infrastructure'`, `export * as Adapters from './adapters'`, etc.

**README.md** – Правила shared vs service layers. Usage examples: SharedErrorTypes для typed errors, ErrorBuilders для domain ошибок, ErrorTransformers для infra chains, ErrorStrategies для policies, SharedValidators для validation.

### 3️⃣ **Сервисный слой (services/)**

**Приоритет: Средний** - Зависит от base/ и shared/. Можно разрабатывать параллельно для разных сервисов, но базовые зависимости должны быть готовы.

**ai-service/** – AI сервис LivAiBot: Yandex Cloud integration, ML operations.

- **AIServiceErrorTypes.ts** – AI-specific типы: `ModelLoadError`, `InferenceError`, `TokenLimitError`, `APIRateLimitError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **AIServiceErrorRegistry.ts** – Реестр AI ошибок: SERVICE_AI_* коды с ML-specific метаданными
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **AIServiceValidators.ts** – Валидаторы AI операций: model validation, token limits, API responses
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **AIServiceInstrumentation.ts** – ML monitoring: model performance, inference latency, token usage
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **domain/** – AI доменные ошибки: `PromptValidationError`, `ModelSelectionError`, `ContextOverflowError`
- **infrastructure/** – Yandex AI API errors: connection, rate limits, model availability
- **policies/** – AI-specific стратегии: model fallback, token retry, API circuit breaker
- **serialization/** – AI response/result serialization для HTTP/gRPC
- **adapters/** – Yandex AI SDK adapter с error mapping
- **index.ts** – Exports: `AI`, `Types`, `Validators`, etc.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

**billing-service/** – Платежный сервис: subscriptions, payments, billing.

- **BillingServiceErrorTypes.ts** – Payment типы: `PaymentFailedError`, `SubscriptionError`, `RefundError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **BillingServiceErrorRegistry.ts** – Реестр платежных ошибок: SERVICE_BILLING_* с payment метаданными
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **BillingServiceValidators.ts** – Валидаторы платежей: amount validation, currency checks, PCI compliance
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **BillingServiceInstrumentation.ts** – Payment monitoring: transaction success rates, fraud detection
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **domain/** – Billing доменные ошибки: subscription limits, payment validation
- **infrastructure/** – Payment gateway errors: Stripe, PayPal API failures
- **policies/** – Payment стратегии: retry failed payments, fraud detection, refund handling
- **serialization/** – Payment data serialization, PCI-compliant error masking
- **adapters/** – Payment gateway adapters с error normalization
- **index.ts** – Exports: `Billing`, `Payments`, `Validators`, etc.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

**mobile-service/** – Мобильное приложение: iOS/Android, offline sync.

- **MobileServiceErrorTypes.ts** – Mobile типы: `NetworkOfflineError`, `SyncConflictError`, `PlatformError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **MobileServiceErrorRegistry.ts** – Реестр мобильных ошибок: SERVICE_MOBILE_* с platform метаданными
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **MobileServiceValidators.ts** – Валидаторы mobile: platform checks, version validation, sync integrity
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **MobileServiceInstrumentation.ts** – Mobile monitoring: crash reports, offline usage, platform-specific metrics
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **domain/** – Mobile доменные ошибки: offline operations, sync conflicts, user permissions
- **infrastructure/** – Device/platform errors: iOS/Android specific failures
- **policies/** – Mobile стратегии: offline retry, conflict resolution, push notification errors
- **serialization/** – Mobile-specific serialization: push payloads, offline queue formats
- **adapters/** – React Native adapters, Firebase integration
- **index.ts** – Exports: `Mobile`, `Sync`, `Platform`, etc.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

**tenant-service/** – Мульти-тенант сервис: isolation, quotas, tenant management.

- **TenantServiceErrorTypes.ts** – Tenant типы: `QuotaExceededError`, `IsolationError`, `TenantNotFoundError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **TenantServiceErrorRegistry.ts** – Реестр tenant ошибок: SERVICE_TENANT_* с isolation метаданными
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **TenantServiceValidators.ts** – Валидаторы tenant: quota checks, isolation validation, resource limits
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **TenantServiceInstrumentation.ts** – Tenant monitoring: usage metrics, isolation violations, resource consumption
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **domain/** – Tenant доменные ошибки: quota management, tenant permissions, resource allocation
- **infrastructure/** – Multi-tenant DB/cache errors, isolation failures
- **policies/** – Tenant стратегии: quota enforcement, resource limiting, tenant isolation
- **serialization/** – Tenant-scoped serialization, data isolation
- **adapters/** – Multi-tenant database adapters, cache isolation
- **index.ts** – Exports: `Tenant`, `Quota`, `Isolation`, etc.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

**feature-flag-service/** – Feature flags: rollout management, targeting.

- **FeatureFlagServiceErrorTypes.ts** – FF типы: `FlagNotFoundError`, `TargetingError`, `RolloutError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **FeatureFlagServiceErrorRegistry.ts** – Реестр FF ошибок: SERVICE_FEATURE_* с rollout метаданными
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **FeatureFlagServiceValidators.ts** – Валидаторы FF: flag validation, targeting rules, rollout percentages
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **FeatureFlagServiceInstrumentation.ts** – FF monitoring: rollout metrics, flag usage, A/B test results
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **domain/** – Feature flag доменные ошибки: flag configuration, user targeting, rollout rules
- **infrastructure/** – Flag storage/retrieval errors, cache inconsistencies
- **policies/** – Feature flag стратегии: gradual rollout, emergency disable, A/B test errors
- **serialization/** – Feature flag state serialization, targeting rule formats
- **adapters/** – LaunchDarkly/other FF service adapters
- **index.ts** – Exports: `FeatureFlags`, `Rollout`, `Targeting`, etc.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

**ServiceErrorTypes.ts** – Common service типы: `ServiceUnavailableError`, `TimeoutError`, `ConfigurationError`

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ServiceErrorRegistry.ts** – Cross-service реестр ошибок, integration с base registry

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ServiceValidators.ts** – Cross-service валидаторы: service health checks, inter-service communication

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ServiceInstrumentation.ts** – Cross-service monitoring: service mesh tracing, dependency health

- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**index.ts** – Selective exports по сервисам: `export * as AI from './ai-service'`, `export * as Billing from './billing-service'`, etc.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

### 4️⃣ **Контракты межсервисного взаимодействия (contracts/)**

**Приоритет: Средний** - Зависит от base/, shared/ и сервисного слоя. Разрабатывается после готовности хотя бы одного сервиса.

**ContractErrorTypes.ts** – Типы контрактов межсервисного взаимодействия: `ServiceCallError`, `CircuitBreakerError`, `TimeoutError`, `RateLimitError`. TaggedError discriminated unions для contract violations.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ContractErrorRegistry.ts** – Реестр контрактных ошибок: CONTRACT_* коды с service mesh метаданными. Integration с base ErrorCode registry для unified error codes.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ContractValidators.ts** – Валидаторы межсервисных контрактов: service health checks, SLA validation, circuit breaker state validation. Runtime contract compliance checking.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ContractInstrumentation.ts** – Monitoring межсервисного взаимодействия: service mesh tracing, circuit breaker metrics, SLA dashboards, dependency health monitoring.

- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**ServiceErrorMap.ts** – Dynamic mapping ошибок между сервисами LivAiBot; runtime registration `ErrorMappingRegistry.register()` для loose coupling. Bidirectional transformations AI→Billing, Billing→Mobile, etc. с semantic preservation. Integration с ErrorBuilders, ErrorValidators, ErrorTransformers.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorBoundaryTypes.ts** – Типы границ ошибок для federation/gateway/API gateway: `GatewayTimeoutError`, `ServiceUnavailableError`, `CircuitBreakerOpenError`. Contract definitions через TaggedError типы и ErrorStrategies для boundary handling.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ContractValidation.ts** – Runtime валидация контрактов через ErrorValidators: service-to-service communication validation, SLA compliance checking, error structure validation при межсервисном взаимодействии с ErrorTransformers.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorTranslation.ts** – Утилиты трансляции ошибок между сервисами: domain error → transport error → client error. ErrorTransformers для protocol conversion (HTTP→gRPC→WebSocket).

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**CircuitBreakerContracts.ts** – Контракты circuit breaker coordination: distributed state sharing, failure threshold synchronization, recovery coordination между сервисами.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**TracingContracts.ts** – Контракты distributed tracing: trace context propagation, span correlation, baggage contracts для end-to-end observability.

- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**versioning/** – Версии контрактов для backward/forward совместимости: semantic versioning для ErrorCode, API contracts, service mesh protocols. Migration utilities и compatibility layers.

**FederationUtils.ts** – Утилиты federation/gateway: error aggregation across services, SLA-based routing, fallback coordination. ErrorTransformers для federation error handling, ErrorStrategies для distributed recovery.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ServiceMeshIntegration.ts** – Интеграция с service mesh (Istio/Linkerd): error propagation, traffic policies, observability contracts, circuit breaker coordination.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**APIGatewayContracts.ts** – Контракты API gateway: error transformation (internal→external), rate limiting errors, authentication failures, request validation errors.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**index.ts** – Selective exports контрактов: `export * as Types from './ContractErrorTypes'`, `export * as Validation from './ContractValidators'`, `export * as Translation from './ErrorTranslation'`, etc. с versioning support.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

### 5️⃣ **Расширения (extensions/)**

**Приоритет: Низкий** - Зависят только от base/shared; можно разрабатывать параллельно с сервисами.

**ExtensionErrorTypes.ts** – Common extension типы: `ExtensionLoadError`, `UnsupportedProtocolError`, `VersionMismatchError`. TaggedError discriminated unions для extension contract violations.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ExtensionErrorRegistry.ts** – Реестр extension ошибок: EXTENSION_* коды с protocol метаданными. Integration с base ErrorCode registry для unified codes.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ExtensionValidators.ts** – Валидаторы extensions: protocol compliance, version compatibility, capability validation. Runtime extension safety checking.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ExtensionInstrumentation.ts** – Monitoring extensions: protocol metrics, extension health, performance monitoring, usage analytics.

- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**ml-errors/** – ML/AI framework ошибки для TensorFlow/PyTorch/ModelServing экосистем.

- **MLErrorTypes.ts** – ML типы: `ModelLoadError`, `InferenceError`, `GradientError`, `CudaError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **MLErrorRegistry.ts** – ML registry: EXTENSION_ML_* codes
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **MLValidators.ts** – ML валидаторы: tensor shapes, model formats, CUDA compatibility
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **MLInstrumentation.ts** – ML monitoring: inference latency, model accuracy, GPU utilization
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **tensorflow/** – TensorFlow-specific: TFRecordError, SessionError, GraphDefError
- **pytorch/** – PyTorch-specific: ModuleError, DataLoaderError, OptimizerError
- **model-serving/** – Serving-specific: DeploymentError, ScalingError, HealthCheckError

**blockchain-errors/** – Blockchain/web3 ошибки для Ethereum, Smart Contracts, DeFi.

- **BlockchainErrorTypes.ts** – Blockchain типы: `TransactionError`, `ContractError`, `GasError`, `NetworkError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **BlockchainErrorRegistry.ts** – Blockchain registry: EXTENSION_BLOCKCHAIN_* codes
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **BlockchainValidators.ts** – Blockchain валидаторы: address validation, ABI compliance, gas estimation
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **BlockchainInstrumentation.ts** – Blockchain monitoring: transaction success rates, gas usage, network latency
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **ethereum/** – Ethereum-specific: NonceError, RevertError, EventLogError
- **smart-contracts/** – Contract-specific: CompilationError, DeploymentError, ExecutionError
- **web3/** – Web3-specific: ProviderError, SignerError, WalletError

**iot-errors/** – IoT/embedded ошибки для устройств, сенсоров, прошивок.

- **IoTErrorTypes.ts** – IoT типы: `ConnectivityError`, `SensorError`, `FirmwareError`, `ProtocolError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **IoTErrorRegistry.ts** – IoT registry: EXTENSION_IOT_* codes
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **IoTValidators.ts** – IoT валидаторы: protocol compliance, firmware versions, sensor calibration
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **IoTInstrumentation.ts** – IoT monitoring: device health, sensor readings, firmware update success
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **connectivity/** – Connection-specific: WiFiError, BluetoothError, CellularError
- **sensors/** – Sensor-specific: CalibrationError, ReadingError, ThresholdError
- **firmware/** – Firmware-specific: UpdateError, RollbackError, CompatibilityError

**cloud-errors/** – Cloud provider специфичные ошибки (AWS, GCP, Azure).

- **CloudErrorTypes.ts** – Cloud типы: `ServiceError`, `QuotaError`, `PermissionError`, `RegionError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **CloudErrorRegistry.ts** – Cloud registry: EXTENSION_CLOUD_* codes
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **CloudValidators.ts** – Cloud валидаторы: IAM permissions, service limits, region availability
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **CloudInstrumentation.ts** – Cloud monitoring: API call metrics, service health, cost optimization
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **aws/** – AWS-specific: S3Error, LambdaError, EC2Error, DynamoDBError
- **gcp/** – GCP-specific: BigQueryError, CloudStorageError, ComputeEngineError
- **azure/** – Azure-specific: BlobStorageError, FunctionsError, VMsError

**database-errors/** – Специфичные ошибки баз данных (PostgreSQL, MongoDB, Redis, etc.).

- **DatabaseErrorTypes.ts** – DB типы: `ConnectionError`, `QueryError`, `TransactionError`, `SchemaError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **DatabaseErrorRegistry.ts** – DB registry: EXTENSION_DB_* codes
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **DatabaseValidators.ts** – DB валидаторы: connection strings, query syntax, schema validation
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **DatabaseInstrumentation.ts** – DB monitoring: query performance, connection pools, deadlock detection
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc
- **sql/** – SQL-specific: PostgreSQLError, MySQLError, ConstraintError
- **nosql/** – NoSQL-specific: MongoDBError, RedisError, CassandraError
- **orm/** – ORM-specific: MigrationError, RelationshipError, LazyLoadError

**index.ts** – Selective exports расширений с lifecycle management: `export * as ML from './ml-errors'`, `export * as Blockchain from './blockchain-errors'`, etc. Optional loading для tree-shaking. Extension registry с deprecation warnings и compatibility checks.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ExtensionLifecycle.ts** – Управление жизненным циклом расширений: version compatibility, deprecation warnings, migration paths, security advisories для external frameworks.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

### 6️⃣ **Governance (governance/)**

**Приоритет: Средний** - Независимы от кода, можно вести параллельно.

**error-naming-conventions.md** – Стандарты именования ошибок.

- **🛠️ Стек**: Markdown
  Обязательно русские: @file и компактные jsdoc

**deprecation-policy.md** – Политика устаревания ошибок.

- **🛠️ Стек**: Markdown
  Обязательно русские: @file и компактные jsdoc

**breaking-change-policy.md** – Процесс изменения интерфейсов, contract-safe.

- **🛠️ Стек**: Markdown
  Обязательно русские: @file и компактные jsdoc

**service-onboarding.md** – Руководство по добавлению новых сервисов.

- **🛠️ Стек**: Markdown
  Обязательно русские: @file и компактные jsdoc

**CHANGELOG.md** – История изменений, semver-based.

- **🛠️ Стек**: Markdown
  Обязательно русские: @file и компактные jsdoc

**CONTRIBUTING.md** – Правила вклада в систему ошибок.

- **🛠️ Стек**: Markdown
  Обязательно русские: @file и компактные jsdoc

### 7️⃣ **Инструменты разработки (tools/)**

**Приоритет: Низкий** - Не обязательны для core, подключаются на финальном этапе или по мере роста системы.

**codegen/templates/** – Шаблоны TaggedError типов для новых сервисов (Handlebars); генерация ErrorBuilders и ErrorStrategies.

- **🛠️ Стек**: Handlebars
  Обязательно русские: @file и компактные jsdoc

**codegen/generators/** – CLI генераторы для создания сервисов/файлов ошибок; автоматическая генерация кодов по иерархии.

- **🛠️ Стек**: TypeScript + Commander
  Обязательно русские: @file и компактные jsdoc

**codegen/validators/** – Валидаторы структуры ошибок через ErrorValidators; проверка compliance с base/shared и ErrorCode иерархией. Service scaffolding: `npx livai-errors scaffold service <name>` генерирует полную структуру сервиса с типами, registry, validators, instrumentation.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**examples/** – Примеры использования ErrorBuilders, ErrorTransformers, ErrorStrategies; best practices для LivAiBot паттернов.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**migration/** – Скрипты и документация миграций; поддержка перехода на новую систему TaggedError + ErrorBuilders.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

---

## ✅ **АУДИТ ЗАВЕРШЕН - ВСЕ ПРОБЛЕМЫ УСТРАНЕНЫ**

**🚨 CRITICAL исправлены:**

- ✅ Effect boundaries: только в metrics/instrumentation
- ✅ Error sanitization: security middleware added
- ✅ Selective exports versioning: v1/v2/latest with migrations

**⚠️ HIGH исправлены:**

- ✅ Registry consolidation: UnifiedErrorRegistry с namespacing
- ✅ Validation pipeline: composable, performance-optimized
- ✅ Stack trace sanitization: configurable filtering

**📈 MEDIUM исправлены:**

- ✅ Performance optimizations: lazy eval, caching, hierarchical matching
- ✅ Service scaffolding: CLI tools для быстрого добавления сервисов
- ✅ Extension lifecycle: version management, deprecation warnings

**🔧 LOW исправлены:**

- ✅ Dynamic error mapping: runtime registration для loose coupling
- ✅ Hierarchical pattern matching: performance boost для complex unions
- ✅ Extension lifecycle management: automated compatibility checks

**Система ошибок LivAiBot теперь enterprise-grade, secure, performant и production-ready!** 🏆

**Все 20+ выявленных проблем устранены.**

---

## ⚠️ **ПЕРЕСМОТР: OVERHEAD vs НЕОБХОДИМОСТЬ ДЛЯ LIVAiBot**

**Учитывая корректировку (локальные аналоги вместо Stripe/Firebase), полный пересмотр анализа:**

### 📊 **Новый контекст LivAiBot:**

- **Без Stripe:** Нет PCI compliance, payment gateway complexity
- **Без Firebase:** Нет complex mobile backend, simpler push notifications
- **Локальные аналоги:** Менее complex integrations, fewer error scenarios
- **Возможно меньшее количество сервисов** или более монолитная архитектура

### ⚖️ **Пересмотренный вердикт: 70% OVERHEAD, 30% НЕОБХОДИМОСТЬ**

#### **Почему OVERHEAD (70%):**

- **Упрощенные интеграции** → меньше error translation complexity
- **Локальные сервисы** → меньше distributed error scenarios
- **Отсутствие enterprise integrations** → меньше security/compliance requirements
- **~500-1000 файлов** → excessive для simplified architecture

#### **Почему НЕОБХОДИМОСТЬ (30%):**

- **AI/ML компоненты** → complex error handling still needed
- **Distributed архитектура** → error propagation required
- **Финансовые операции** → basic audit trails needed
- **Mobile приложения** → error recovery needed

### 🔄 **Циклические зависимости**

**Риски:** Hidden циклы (ErrorBuilders → BaseError → ErrorMetadata → ErrorBuilders)
**✅ Решения:**

- ESLint "no-cycle-imports" rule
- Build-time DAG import validation

### ⚡ **Performance & Memory Leaks**

**Риски:** Lazy evaluation + memoization в long-lived services, GC pressure от deep chains
**✅ Решения:**

- Chain depth limit (100-200, configurable)
- Cache eviction policies
- Weak references для memoization

### 🔒 **Security / Sanitization**

**Риски:** Неоднородная очистка nested errors, sensitive data leaks
**✅ Решения:**

- Mandatory sanitization для toJSON()
- CI lint rule для external serialization
- Error code abstraction (internal → generic public)

### 📝 **TypeScript Type Explosion**

**Риски:** TaggedError<T, Tag>, ExhaustiveMatcher<E,A> → slow compilation
**✅ Решения:**

- Stable base types vs domain-specific
- Lazy imports для heavy types
- Type-only imports

### 🎭 **Effect Integration Boundaries**

**Риски:** Неправильное использование Effect в core types
**✅ Решения:**

- Lint rules на Effect<T> usage в base/core
- Type guards для enforcement

### 🔄 **Cross-Service Translation**

**Риски:** Mismatch между кодами/метаданными через multiple layers
**✅ Решения:**

- Property-based tests для translation
- Integration validation для mappings

### 📊 **Observability Consistency**

**Риски:** Разные semantic levels в разных monitoring системах
**✅ Решения:**

- Unified metric registry
- Registry-driven severity mapping

### 🏗️ **Base Layer Specific**

**Риски:** Deep immutability → memory footprint, infinite loops in chains
**✅ Решения:**

- Force strict sanitization в production
- Weak maps для memoization
- Cycle detection в withCauseChain()

### 🧩 **Shared Layer Specific**

**Риски:** Subtle bugs в chaining, policy deadlocks
**✅ Решения:**

- Chain preservation unit tests
- Policy simulation tests

### 🏢 **Services Layer Specific**

**Риски:** Code collisions, environment differences, async error loss
**✅ Решения:**

- Namespace uniqueness CI checks
- Serialization snapshot tests
- Async error coverage tests

### 🤝 **Contracts Layer Specific**

**Риски:** Translation mismatches, metadata duplication/loss
**✅ Решения:**

- Property-based error translation tests
- Distributed tracing integration tests

### 🌍 **Extensions Layer Specific**

**Риски:** Namespace collisions, race conditions, metadata loss
**✅ Решения:**

- Namespacing enforcement
- Concurrency safety tests

### ⚡ **Governance Specific**

**Риски:** Human error, inconsistencies, version mismatches
**✅ Решения:**

- Codegen для registry updates
- Automated semantic versioning
- Breaking change detection

---

**Итого: Для LivAiBot с локальными аналогами - наша полная система = OVERHEAD. Начните с simplified версии и эволюционируйте по мере роста.**

**Согласны с таким подходом?** 🤔
