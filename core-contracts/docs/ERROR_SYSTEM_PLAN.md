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
│   ├── serialization/               # 📤 Общие сериализаторы: JSON, gRPC, GraphQL [TypeScript]
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
│   │   ├── serialization/           # 📤 AI response/result serialization [TypeScript]
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
│   │   ├── serialization/           # 📤 Payment data serialization, PCI masking [TypeScript]
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
│   │   ├── serialization/           # 📤 Tenant-scoped serialization [TypeScript]
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
│   │   ├── serialization/           # 📤 Push payloads, offline queue formats [TypeScript]
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
│       ├── serialization/           # 📤 Feature flag state serialization [TypeScript]
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

**ErrorBuilders.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

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

**ErrorUtilsCore.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Enterprise-grade утилиты для работы с цепочками ошибок с полной защитой от edge cases и performance optimizations. `flattenCauses()` с детекцией циклов, `getErrorChain()` с safe traversal, `findRootCause()` с cycle protection, `safeTraverseCauses()` с configurable depth limit, `analyzeErrorChain()` для комплексного анализа. Lazy evaluation, caching, memoization для expensive operations.
- **Зависимости**: BaseErrorTypes.ts
- **Используется в**: external consumers (НЕ BaseError.ts), ErrorTransformers.ts
- **🔧 Edge case protection**: Полная защита от циклов, null causes, deep chains (configurable maxDepth=1000)
- **🔧 Safe utilities**: `safeGetCause()`, `safeTraverseCauses()`, cycle detection algorithms
- **🔧 Analysis tools**: `analyzeErrorChain()` возвращает chain stats, cycle detection, depth metrics
- **🔧 Performance**: Lazy evaluation, memoization, Set-based cycle detection, early termination, cached results
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**ErrorTransformers.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

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

**ErrorStrategies.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

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

- **🔄 Рефакторинг**: Файл разделен на 7 модулей (ErrorStrategyTypes, ErrorStrategyBase, ErrorStrategyModifiers, ErrorStrategyFactories, ErrorStrategyGroups, ErrorStrategyCore, index) для enterprise maintainability
- **🛡️ Совместимость**: Полная backward compatibility, все API сохранены
- **🧪 Качество**: Улучшена тестируемость, читаемость, type safety

**ErrorMetrics.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Интерфейсы для метрик с helpers `incrementErrorCounter()`, `observeLatency()`. Абстракция над конкретными метриками системами.
- **Зависимости**: Effect (или Event integration) - НЕ BaseError
- **Используется в**: BaseError.ts, external consumers
- **🔧 Рекомендация**: Использовать dependency injection паттерн для метрик системы, чтобы BaseError.ts не зависел от конкретной реализации.
- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**ErrorInstrumentation.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Абстрактные интерфейсы для observability: `logError()`, `sendToTelemetry()`, `mapErrorToSeverityMetric()`.
- **Зависимости**: Effect/OpenTelemetry - НЕ BaseError
- **Используется в**: BaseError.ts, external consumers
- **🔧 Рекомендация**: Использовать strategy паттерн для разных observability систем (console, Winston, OpenTelemetry).
- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**BaseError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

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

**index.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Selective exports ядра системы ошибок LivAiBot. Экспортирует ТОЛЬКО публичный API: 5 групп (Types, Builders, Utils, Validators, Strategies). НЕ экспортирует внутренние модули (ErrorCode, ErrorConstants, ErrorCodeMeta, etc.).
- **Зависимости**: BaseError.ts (ТОЛЬКО публичные типы), ErrorBuilders.ts, ErrorUtilsCore.ts, ErrorTransformers.ts, ErrorValidators.ts, ErrorStrategies.ts
- **Используется в**: shared layer, сервисах, контрактах, extensions
- **🔧 Selective exports**: `export * as Types from './BaseError'`, `export * as Builders from './ErrorBuilders'`, `export * as Utils from './ErrorUtilsCore'`, etc. - контролируемый API без внутренних деталей
- **🔧 НЕ экспортируется**: ErrorCode.ts, ErrorConstants.ts, ErrorCodeMeta.ts, ErrorCodeMetaData.ts, ErrorMetadata.ts, ErrorMetrics.ts, ErrorInstrumentation.ts (internal/implementation)
- **🔧 Developer guidance**: Отдельная документация в /docs. Минимальные JSDoc комментарии для каждой группы.
- **🔧 API stability**: Semantic versioning для публичных exports. Versioning и migration helpers будут добавлены при необходимости в будущем.
- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

### 2️⃣ **Общий слой (shared/)**

**Приоритет: Высокий** - Зависит только от base/. Разрабатывается после ядра.

**🔧 Архитектурные рекомендации для слоев:**

- **Shared Layer**: имеет полную аналогию базовых компонентов (Types, Registry, Validators, Instrumentation) + специализированные модули (domain, infra, adapters, contracts, etc.) для максимальной reusability
- **Services Layer**: имеет enterprise-grade структуру: каждый сервис имеет полную аналогию базовых компонентов (Types, Registry, Validators, Instrumentation) + domain/infra/policies/serialization/adapters/normalizers для complete service isolation
- **Contracts Layer**: обеспечивает distributed error handling: error translation/transformation, service mesh integration, circuit breaker coordination, distributed tracing contracts для enterprise-grade межсервисного взаимодействия
- **Extensions Layer**: предоставляет ecosystem integrations: каждый extension имеет полную аналогию базовых компонентов (Types, Registry, Validators, Instrumentation) + domain-specific error types для seamless integration с external frameworks и protocols

**SharedErrorTypes.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Shared-specific типы ошибок: `SharedDomainError<T>`, `SharedInfraError<T>`, `SharedPolicyError<T>`, `SharedAdapterError<T>`. TaggedError discriminated unions для общих доменов. Type guards и pattern matching helpers. Namespace protection (SHARED_*), category union types, SharedErrorKind для routing, assert helpers для development.
- **Зависимости**: BaseErrorTypes.ts
- **Используется в**: Все компоненты shared слоя, adapters, policies, error boundaries
- **🔧 Namespace protection**: Автоматическая валидация SHARED_ префиксов в runtime и compile-time
- **🔧 Type-safe routing**: SharedErrorKind enum для observability/metrics/contracts/tracing
- **🔧 Structural safety**: Усиленные type guards с проверкой namespace и структуры
- **🔧 Assert helpers**: Development-only assertion functions для boundary validation
- **Экспортирует**: SharedDomainError, SharedInfraError, SharedPolicyError, SharedAdapterError, SharedError, type guards, pattern matching, SharedErrorKind utilities, assert helpers

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**SharedErrorRegistry.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Layered registry resolution для SHARED_* кодов. Регистрация в UnifiedErrorRegistry.shared без создания отдельного реестра. Type-safe namespace константы и API. Проверка консистентности источников истины (SHARED_ERROR_CODES ↔ registry.shared).
- **Зависимости**: UnifiedErrorRegistry.ts, ErrorCodeMeta.ts
- **Используется в**: Инициализация registry, проверка консистентности кодов, layered error resolution
- **🔧 Layered resolution**: Pipeline SharedRegistry → BaseRegistry → fallback с контролируемым порядком
- **🔧 Registry API**: getFromSharedRegistry, getFromBaseRegistry, getFromNamespaceRegistry для type-safe доступа
- **🔧 Consistency checks**: checkSharedCodesConsistency предотвращает расхождения между константами и runtime данными
- **Экспортирует**: registerSharedLayer, resolveSharedErrorMeta, getFrom*Registry функции, REGISTRY_NAMESPACES константы, checkSharedCodesConsistency

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**shared/contracts/** ✅ **ГОТОВ К ПРОДАКШЕНУ**

- **Содержимое**: Внутренние контракты shared слоя для стандартизации обработки ошибок. HttpErrorContract для HTTP API, GrpcErrorContract для gRPC сервисов, InternalErrorDTO для внутренней коммуникации компонентов
- **Зависимости**: SharedErrorTypes.ts, BaseError types, Effect Either
- **Используется в**: HTTP адаптеры, gRPC сервисы, внутренние компоненты shared слоя, миграция к services/contracts layer
- **🔧 HttpErrorContract**: Type-safe HTTP ошибки (400-599) с автоматической валидацией кодов, Content-Type и SHARED_ префиксом
- **🔧 GrpcErrorContract**: Полная поддержка gRPC статус кодов (0-16) с метаданными, correlation ID и timestamp
- **🔧 InternalErrorDTO**: Рекурсивные цепочки ошибок с категориями (domain/infrastructure/policy/adapter) и ExecutionContext
- **Экспортирует**: create_функции, is_ type guards, get* утилиты, Either типы, ErrorDetails, ContractValidationError

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**domain/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Общие доменные ошибки LivAiBot: `ValidationError`, `AuthError`, `PermissionError`. Builders: `createValidationError()`, `createAuthError()`, `createPermissionError()`. Используют BaseError + ErrorBuilders для TaggedError типов. Независимы от инфраструктуры и сервисов.

- **Содержимое**: Общие доменные ошибки LivAiBot для бизнес-логики. ValidationError для ошибок валидации данных, AuthError для аутентификации и авторизации, PermissionError для детального контроля прав доступа
- **Зависимости**: BaseError types, ErrorBuilders, LivAi error codes
- **Используется в**: Доменная логика, контроллеры API, middleware аутентификации, сервисы пользователей, валидация данных
- **🔧 ValidationError**: Type-safe ошибки валидации с полями, правилами и типами данных. Автоматическая генерация и валидация контекста с isValidValidationErrorContext
- **🔧 AuthError**: Комплексные ошибки аутентификации с AuthErrorReason union, MFA статусом, геолокацией, device info, rate limiting, строгим type guard и расширенными утилитами
- **🔧 PermissionError**: Детализированные ошибки прав с ролями, ресурсами, политиками и условиями доступа. Строгая валидация контекста с isValidPermissionErrorContext
- **Экспортирует**: create_функции, is_ type guards (строгие, с валидацией details), isValidValidationErrorContext, isValidPermissionErrorContext, get* утилиты (включая getValidationField, getValidationRule, getValidationValue, getExpectedType, getActualType, getValidationConstraints, getRequiredPermissions, getUserPermissions, getPermissionResource, hasMissingPermissions, getAuthRequiredPermissions, getAuthUserPermissions, getAuthDeviceInfo, getRateLimitInfo), ValidationError/AuthError/PermissionError типы, AuthErrorReason union, DomainError union, isMFARequiredError, isRateLimitedError, isPermissionDeniedError, isPolicyViolationError, isResourceAccessError guards

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**infrastructure/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Общие инфраструктурные ошибки: `DatabaseError`, `CacheError`, `NetworkError`, `ExternalAPIError`. Builders: `createDatabaseError()`, `createNetworkError()`. Pure mapping от внешних ошибок к BaseError через ErrorBuilders. ErrorTransformers для обработки цепочек.

- **Содержимое**: Общие инфраструктурные ошибки LivAiBot для работы с внешними системами. DatabaseError для ошибок баз данных, CacheError для ошибок кеширования, NetworkError для сетевых ошибок, ExternalAPIError для ошибок внешних API
- **Зависимости**: BaseError types, ErrorBuilders, LivAi error codes
- **Используется в**: Репозитории, кеш-сервисы, HTTP клиенты, API интеграции, инфраструктурные адаптеры
- **🔧 DatabaseError**: Ошибки баз данных с типом БД, таблицами, операциями и соединениями. Runtime валидация контекста с isValidDatabaseErrorContext
- **🔧 CacheError**: Ошибки кеширования с ключами, операциями и соединениями. Runtime валидация контекста с isValidCacheErrorContext
- **🔧 NetworkError**: Сетевые ошибки с URL, HTTP статусами и соединениями. Runtime валидация контекста с isValidNetworkErrorContext
- **🔧 ExternalAPIError**: Ошибки внешних API с rate limiting, retry и endpoint информацией. Runtime валидация контекста с isValidExternalAPIErrorContext
- **Экспортирует**: create_функции, is_ type guards (строгие, с валидацией details), isValid_ErrorContext функции, get_ утилиты (включая getDatabaseType, getTableName, getDatabaseOperation, getDatabaseConnection, isDatabaseConnectionError, getCacheKey, getCacheConnection, getCacheOperation, isCacheConnectionError, getNetworkUrl, getHttpRequestInfo, getNetworkConnection, isTimeoutError, isHttpError, getAPIServiceInfo, getAPIRateLimit, getAPIRetryInfo, getAPIConnection, isRateLimitError, isRetryableError), DatabaseError/DatabaseErrorContext/CacheError/CacheErrorContext/NetworkError/NetworkErrorContext/ExternalAPIError/ExternalAPIErrorContext типы, InfrastructureError union

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**serialization/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – HTTP/log сериализаторы: `JsonSerializer`, `GrpcSerializer`, `GraphqlSerializer`. Унифицированные чистые функции с detailLevel, causeMetadata и stack traces. Полная metadata preservation и type safety.

- **JsonSerializer**: JSON сериализация с detailLevel (basic/detailed/full), causeMetadata в full режиме, round-trip сериализация/десериализация с валидацией, версионирование, immutable data structures
- **GrpcSerializer**: gRPC-совместимый формат с severity mapping на gRPC статус коды, protobuf any детали, ErrorInfo/DebugInfo структуры, stack traces в DebugInfo, кастомные severity mappings, causeMetadata в full режиме, десериализация
- **GraphqlSerializer**: GraphQL error формат с extensions, configurable locations/path generators, cause chain как отдельные ошибки, кастомные severity mappings, causeMetadata в full режиме, десериализация
- **Унификация**: BaseErrorPlainObject типизация, detailLevel валидация, causeMetadata consistency, enterprise-grade test coverage (95%+), round-trip compatibility

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc, полная type safety

**normalizers/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – **ТОЛЬКО pure mapping**: `HttpNormalizer`, `DatabaseNormalizer`, `CacheNormalizer`. `unknown → TaggedError`. Чистые функции без side-effects, без DI, без Effect.

- **HttpNormalizer**: HTTP error normalization с mapping на TaggedError типы, validation HTTP статус кодов (100-599), extraction metadata из headers/response body, processing array/string/number headers, user-agent extraction, timeout/URL/method extraction, comprehensive status code mapping (400-504)
- **DatabaseNormalizer**: Database error normalization с mapping SQL ошибок на TaggedError, extraction constraint violations (PostgreSQL/MySQL/SQLite/MongoDB), transaction state analysis (deadlock/timeout), regex patterns для SQLite, MongoDB writeErrors processing, multi-DB support с databaseType detection
- **CacheNormalizer**: Cache error normalization с mapping на TaggedError типы, Redis/Memcached error code processing (ECONNREFUSED, NOAUTH, LOADING, CLUSTERDOWN), keyword-based error classification (connection/timeout/serialization/cluster), context-aware error details extraction, multi-cache support с extensible error patterns, runtime cache type detection
- **Унификация**: Pure function composition, immutable input/output, type-safe TaggedError generation, comprehensive test coverage (94%+ statements, 89%+ branches, 100% functions/lines), property-based testing, snapshot stability, edge case handling

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**adapters/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – **Side-effects + DI**: `HttpAdapter`, `DatabaseAdapter`, `CacheAdapter`. Effect/IO/retry/breaker integration. Error handling: BaseError, ErrorStrategies, ErrorValidators. Circuit breaker coordination.

- **HttpAdapter**: HTTP client/server адаптер с configurable retry strategies (exponential backoff + jitter), timeout handling, circuit breaker integration, branded types для runtime validation, discriminated unions для type-safe error handling, DRY centralized HTTP metrics helpers, pure functional DI architecture, Effect-based composition, BaseError transformation, ErrorStrategies application
- **DatabaseAdapter**: Database адаптер с configurable retry strategies (exponential backoff), timeout handling, circuit breaker integration, branded types для runtime validation, discriminated unions для type-safe error handling, DRY centralized database metrics helpers, pure functional DI architecture, Effect-based composition, BaseError transformation, ErrorStrategies application, transaction isolation levels, connection pooling management, constraint violation handling, PostgreSQL error code mapping, query builder utilities
- **CacheAdapter**: Cache адаптер с configurable retry strategies (exponential backoff), timeout handling, circuit breaker integration, branded types для runtime validation, discriminated unions для type-safe error handling, DRY centralized cache metrics helpers, pure functional DI architecture, Effect-based composition, BaseError transformation, ErrorStrategies application, TTL management, cache miss handling, distributed cache coordination, @experimental bulk operations (mget/mset), Redis/Memcached error mapping, cluster failure handling
- **Унификация**: Effect-based composition, dependency injection pattern, unified error handling pipeline, circuit breaker coordination, enterprise-grade test coverage (95%+)

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**policies/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – **Foundation resilience strategies**: `RetryPolicy`, `RecoveryPolicy`, `CircuitBreakerPolicy`. Pure functional policies без side-effects. Effect integration через interpreters. 100% test coverage.

- **RetryPolicy**: Retry policy алгебра с configurable backoff strategies (fixed, linear, exponential + jitter), limit attempts, conditional retry, Effect integration через withRetryPolicy с controlled state evolution, toSchedule experimental adapter для advanced Effect integration
- **RecoveryPolicy**: Recovery policy алгебра для graceful degradation с fallback values, lazy factories, Effect-based recovery, conditional recovery, buildRecoveryPolicy composition, withRecoveryPolicy Effect integration для safe error handling
- **CircuitBreakerPolicy**: Circuit breaker policy алгебра с state management (Closed/Open/HalfOpen), failure thresholds, timeout-based recovery, composition через buildCircuitBreakerPolicy, withCircuitBreakerPolicy Effect integration с external state management
- **Унификация**: Pure functional design, discriminated unions для type safety, Effect-based composition, comprehensive test coverage (95%+ statements, 100% branches), enterprise-grade error handling foundation

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**SharedErrorBoundary.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Error boundary helpers для shared операций (100% test coverage):

```typescript
withSharedErrorBoundary(
  effect,
  { normalize, strategy, serialize },
);
```

Мощный модуль для 80% error handling в adapters/services.

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**SharedValidators.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Валидаторы shared инвариантов + **явные architectural invariants**:

- ❌ domain error с infra code
- ❌ shared error без namespace SHARED_
- ❌ утечка service-specific metadata
- ✅ `validateSharedDomain()`, `validateSharedInfra()`
- Integration с base ErrorValidators

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc

**SharedInstrumentation.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Monitoring shared операций: tracing adapters, metrics policies, logging normalizers. Strategy pattern для разных observability систем.

- **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
  Обязательно русские: @file и компактные jsdoc

**index.ts** – Selective exports по категориям:

- **Core Types**: `SharedError`, `SharedErrorCategory`, `SharedErrorCode`, `SharedErrorDetails`, etc. + type guards и pattern matching
- **Registry**: `SHARED_ERROR_CODES`, `SHARED_ERROR_METADATA`, `registerSharedErrorsInRegistry()`, `resolveSharedErrorMeta()`
- **Contracts**: `HttpErrorContract`, `GrpcErrorContract`, `InternalErrorDTO` + builders и getters
- **Domain**: `ValidationError`, `AuthError`, `PermissionError` + builders
- **Infrastructure**: `DatabaseError`, `CacheError`, `NetworkError`, `ExternalAPIError` + builders
- **Adapters**: Boundary operations с Effect-based retry/timeout/circuit breaker
- **Normalizers**: Error normalization из различных источников
- **Serialization**: Protocol-specific serializers (GraphQL, gRPC, JSON)
- **ErrorBoundary**: `SharedErrorBoundary` helpers для 80% случаев error handling
- **Validators**: `validateSharedDomain()`, `validateSharedInfra()`, `effectValidateSharedDomain()`
- **Instrumentation**: `withSharedInstrumentation()`, `withTracing()`, `withMetrics()`, `withLogging()`

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

**README.md** – Правила shared vs service layers. Usage examples:

- **SharedErrorTypes**: Для typed errors и pattern matching
- **Domain/Infrastructure**: Builders для типизированных ошибок
- **Contracts**: Internal DTOs для межслойного взаимодействия
- **Adapters**: Boundary operations с Effect-based resilience
- **Normalizers**: Error normalization из внешних источников
- **Serialization**: Protocol-specific error formatting
- **ErrorBoundary**: 80% случаев error handling в adapters/services
- **Validators**: Architectural invariants validation
- **Instrumentation**: Observability с Strategy pattern

### 3️⃣ **Сервисный слой (services/)**

**Приоритет: Средний** - Зависит от base/ и shared/. Можно разрабатывать параллельно для разных сервисов, но базовые зависимости должны быть готовы.

**ai-service/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – AI сервис LivAiBot: Yandex Cloud integration, ML operations.

- **AIServiceErrorTypes.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – AI-specific типы ошибок: `ModelLoadError`, `InferenceError`, `TokenLimitError`, `APIRateLimitError`, `PromptValidationError`, `ContextOverflowError`. Type guards, pattern matching, factory functions для создания type-safe ошибок.
- **AIServiceErrorRegistry.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Реестр AI ошибок: SERVICE_AI_* коды с ML-specific метаданными. Utility functions для фильтрации по operationType, modelType, GPU requirements, streaming capabilities.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

- **AIServiceValidators.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Комплексная система валидации AI операций: `validateAIModel` (проверка доступности моделей, совместимости задач), `validateTokenLimits` (лимиты токенов с safety buffer), `validateAPIResponse` (HTTP статусы, JSON валидация, таймауты), `validateAIOperation` (комплексная валидация всех компонентов). Поддержка `AIModelFamily`, `AITaskType`, конфигурационные интерфейсы для ML-specific валидации.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

- **AIServiceInstrumentation.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Инструментирование AI-сервиса LivAiBot: сбор ML-метрик (latency, tokens, success/failure), интеграция с OpenTelemetry, безопасные метрики без влияния на бизнес-логику. Effect-first подход с vendor-agnostic telemetry.
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc

**domain/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – AI доменные ошибки: `PromptValidationError`, `ModelSelectionError`, `ContextOverflowError`

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc
- **PromptValidationError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные ошибки валидации промптов: правила безопасности, контент-фильтры, форматные ограничения. Factory functions для разных типов валидационных ошибок
- **ModelSelectionError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные ошибки выбора модели AI: проверка доступности, совместимости задач, региональных ограничений, пользовательских лимитов. Fallback стратегии и альтернативные модели
- **ContextOverflowError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные ошибки переполнения контекста: превышение лимитов токенов, истории чата, системных промптов. Стратегии усечения, восстановления и оптимизации контекста. Union тип ContextLimitRule для типобезопасности

**infrastructure/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Yandex AI API errors: connection, rate limits, model availability

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc
- **YandexAIConnectionError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Специализированные ошибки подключения к Yandex AI API: network timeouts, authentication failures, SSL/TLS errors, connection refused. Расширяет ExternalAPIError с Yandex-специфичными полями. Policy helpers для retry/circuit breaker стратегий
- **RateLimitError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Ошибки превышения лимитов Yandex AI API: per-minute/hour/day limits, burst limits, quota exhaustion. Инфраструктурные ограничения провайдера с категорией TECHNICAL. Discriminator hardLimit для различения soft/hard limits. Recovery strategies и usage analytics
- **RateLimitError.ts** – Ошибки превышения лимитов Yandex AI API: per-minute/hour/day limits, burst limits, retry strategies. Специфическая логика для разных типов rate limits с intelligent backoff
- **ModelUnavailableError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Ошибки недоступности моделей Yandex AI: model not found, temporarily unavailable, region restrictions, GPU/memory constraints. Fallback стратегии и альтернативные модели. Union типы ModelUnavailableReason/ModelRecoveryStrategy для типобезопасности

**policies/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – AI-specific стратегии: model fallback, token retry, API circuit breaker

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc
- **modelFallbackPolicy.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Стратегия fallback для недоступных моделей: приоритетные альтернативы, региональные переключения, GPU-constrained модели. Умная логика выбора моделей с учетом task compatibility, user constraints, plan restrictions
- **tokenRetryPolicy.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Умная логика повторных попыток при исчерпании токенов: exponential backoff, quota-aware delays, модельные альтернативы
  - **Технологический стек**: TypeScript strict, TaggedError, ML-semantic токенов, async/await, WeakMap caching, centralized logging, enum-based типизация
  - **Поддерживаемые типы**: TokenRetryPolicyContext, UserQuotaContext, TokenRetryPolicyResult, RetryStrategy, TokenRetryPolicyError, IModelAlternativesService, ModelAlternativeChain, ModelAlternativeOption, ILogger, TokenType (enum), TokenAlternativeReason (enum)
  - **Ключевые компоненты**: shouldRetryOnTokenExhaustion, evaluateTokenRetryPolicy (кеширующая функция), createTokenRetryPolicyError, isTokenRetryPolicyError, getOptimalRetryDelay, canRetryWithTokens
  - **Особенности**: Service layer для динамической загрузки альтернатив с compatibility scoring, quota-aware стратегии с унифицированными порогами, exponential backoff с адаптивными задержками пропорциональными степени исчерпания квот, интеллектуальный выбор альтернативных моделей, immutable кеширование через WeakMap, централизованное логирование, enum-based типизация для предотвращения рассинхронизации
- ✅ **ГОТОВ К ПРОДАКШЕНУ** – **apiCircuitBreakerPolicy.ts** – Circuit breaker для Yandex AI API: failure thresholds, recovery timeouts, graceful degradation при перегрузках
  - **Технологический стек**: TypeScript strict, TaggedError, immutable Record state management, circuit breaker pattern, centralized logging
  - **Поддерживаемые типы**: CircuitBreakerContext, CircuitBreakerConfig, CircuitBreakerResult, CircuitBreakerStateData, CircuitBreakerError, ILogger, CircuitBreakerState (enum), CircuitBreakerTrigger (enum)
  - **Ключевые компоненты**: shouldAllowRequest, recordSuccess/recordFailure, createCircuitBreakerError, isCircuitBreakerError
  - **Особенности**: Три состояния (CLOSED/OPEN/HALF_OPEN), configurable thresholds, recovery timeouts, immutable state management с TTL cleanup, observability callbacks, graceful degradation с рекомендациями

**serialization/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – AI response/result serialization для HTTP/gRPC

- **🛠️ Стек**: TypeScript strict
  Обязательно русские: @file и компактные jsdoc
- **AIResponseSerializer.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Сериализация ответов Yandex AI API: JSON schema validation, error normalization, HTTP status mapping для REST/gRPC
- **AIResultSerializer.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Сериализация результатов обработки AI: token usage статистика, model metadata, confidence scores, структурированный output formatting
  - **Технологический стек**: TypeScript strict, immutable types, fail-safe confidence (0.0), literal outcome types, comprehensive validation
  - **Поддерживаемые типы**: AIResult<T>, AIResultSerializationOutcome, AIResultSerializerConfig<T>, ConfidenceScore, ModelMetadata, TokenUsageStats, SerializedAIResult<T>
  - **Ключевые компоненты**: createAIResultSerializer (configurable factory), serializeAIResult (helper), outcome-based error handling (success/partial/fallback)
  - **Особенности**: Transport-agnostic core, pure serialization, forward-compatible metadata, literal outcome reasons ('low-confidence' | 'invalid-output' | 'confidence-missing'), 98.7% test coverage, comprehensive edge case handling

**adapters/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Yandex AI SDK adapter с error mapping

- **🛠️ Стек**: TypeScript strict + Effect
  Обязательно русские: @file и компактные jsdoc
- **YandexAISDKAdapter.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Адаптер для Yandex AI SDK с Effect-first дизайном
  - **Технологический стек**: TypeScript strict, Effect, Context/Tag dependency injection, Layer composition, typed error boundaries
  - **Поддерживаемые типы**: AICompletionRequest, AICompletionResponse, YandexAIAdapterError (discriminated union: Yandex.ConnectionError, Yandex.InvalidRequestError, Yandex.UnauthorizedError, Yandex.QuotaExceededError, Yandex.UnknownError), YandexAISDK (interface abstraction), YandexAISDKAdapterConfig
  - **Ключевые компоненты**: YandexAISDKAdapter.complete (Effect-based), error mapping (SDK → domain errors), timeout handling, Layer composition для DI
  - **Особенности**: SDK isolation, transport-agnostic design, comprehensive error mapping (Connection/Timeout/Unauthorized/Quota/InvalidRequest/Unknown), Effect.gen для async flows, Context-based dependency injection

  **index.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Selective exports по категориям: Types, Guards, Pattern Matching, Registry, Utilities. Единая точка входа для AI service error system.
  Обязательно русские: @file и компактные jsdoc

**billing-service/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Платежный сервис LivAiBot: subscriptions, payments, billing.

- **BillingServiceErrorTypes.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Payment типы ошибок уровня сервиса: `PaymentFailedError`, `SubscriptionError`, `RefundError`, `InfrastructureUnknownError`. Type guards, pattern matching, factory functions для создания type-safe ошибок с PCI-safe полями (без PAN, CVV, expiry).
- **BillingServiceErrorRegistry.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Реестр платежных ошибок: SERVICE_BILLING_* коды с payment-specific метаданными. Utility functions для фильтрации по paymentMethod, regionId, tenantId, fraudRisk, auditRequired. Расширенные метаданные: refundable, retryable, complianceLevel (pci/gdpr), amountSensitive.
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc

- **BillingServiceValidators.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Комплексная система валидации платежных операций: `validatePaymentAmount` (лимиты валют с safety buffers), `validateCurrencySupport` (BYN/RUB/USD/EUR), `validatePaymentMethod` (credit_card, webpay, bepaid), `validatePCICompliance` (без sensitive данных), `validateBillingOperation` (комплексная валидация всех компонентов). Поддержка `SupportedCurrency`, `SupportedPaymentMethod`, конфигурационные интерфейсы для PCI-compliant валидации.
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc

- **BillingServiceInstrumentation.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Инструментирование платежного сервиса LivAiBot: сбор payment-метрик (success/failure rates, latency, amounts), интеграция с OpenTelemetry, безопасные метрики без влияния на money flow. Effect-first подход с vendor-agnostic telemetry, PCI-safe observability.
  - **🛠️ Стек**: TypeScript + Effect/OpenTelemetry
    Обязательно русские: @file и компактные jsdoc

**domain/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Billing доменные ошибки: subscription limits, payment validation

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc
- **PaymentValidationError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные ошибки валидации платежей: бизнес-правила сумм, валют, методов оплаты. PCI-safe (без PAN/CVV). Factory functions для разных типов валидационных ошибок с поддержкой BYN/RUB/USD/EUR лимитов
- **SubscriptionLimitError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные ошибки лимитов подписок: превышение usage, план restrictions, quota exhaustion. Стратегии fallback и альтернативные тарифы
- **RefundPolicyError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные ошибки политики возвратов: сроки возврата, условия refund, бизнес-правила. Предотвращение дубликатов и мошенничества
- **BillingOperation.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные типы операций биллинга: payment, subscription, refund, cancellation. Operation contexts и metadata для traceability
- **CurrencyCode.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Доменные типы валют: поддерживаемые валюты (BYN/RUB/USD/EUR), currency validation, conversion utilities, exchange rate interfaces

**infrastructure/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Payment gateway API errors: BePaid, WebPay connection failures

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc
- **BePaidAPIError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Специализированные ошибки BePaid API: кард-отклонения (F.0103), лимиты (429), connection errors, SSL/TLS failures. Расширяет InfrastructureError с BePaid-специфичными полями и кодами ошибок
- **WebPayAPIError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Специализированные ошибки WebPay API: transaction failures, authentication errors, network timeouts. WebPay-specific коды и recovery strategies
- **PaymentGatewayUnavailableError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Ошибки недоступности платежных шлюзов: gateway down, regional restrictions, maintenance windows. Circuit breaker triggers и fallback стратегии
- **GenericAPIError.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Обобщенные API ошибки платежных сервисов: network failures, timeouts, malformed responses. Vendor-agnostic error mapping для любых payment providers

**policies/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Payment стратегии: retry failed payments, fraud detection, refund handling, monitoring

- **🛠️ Стек**: TypeScript + Effect
  Обязательно русские: @file и компактные jsdoc
- **paymentRetryPolicy.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Decision engine для retry платежей: анализ BillingServiceError, определение стратегии (immediate/delayed/manual), расчет задержек с exponential backoff. Registry-driven с метаданными из BillingServiceErrorRegistry
  - **Технологический стек**: TypeScript strict, TaggedError, PCI-safe error analysis, async/await, WeakMap caching, centralized logging, enum-based типизация
  - **Поддерживаемые типы**: PaymentRetryPolicyContext, AmountContext, PaymentRetryPolicyResult, RetryStrategy, PaymentRetryPolicyError, ILogger, RetryPolicyType (enum), RetryDecisionReason (enum)
  - **Ключевые компоненты**: shouldRetryPayment, evaluatePaymentRetryPolicy (кеширующая функция), createPaymentRetryPolicyError, isPaymentRetryPolicyError, getOptimalPaymentRetryDelay, canRetryWithAmount
  - **Особенности**: Amount-aware стратегии с лимитами валют, PCI-compliant retry decisions, quota-aware delays, fraud-risk evaluation, immutable кеширование через WeakMap, централизованное логирование, enum-based типизация для предотвращения рассинхронизации
- **fraudDetectionPolicy.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Fraud detection для платежей: анализ паттернов, risk scoring, decision engine с configurable thresholds. Интеграция с external fraud providers, PCI-compliant processing
  - **Технологический стек**: TypeScript strict, TaggedError, ML-based risk scoring, async/await, WeakMap caching, centralized logging
  - **Поддерживаемые типы**: FraudDetectionContext, FraudDecision, FraudDetectionPolicyResult, FraudDetectionError, ILogger, FraudRiskLevel (enum), FraudDecisionReason (enum)
  - **Ключевые компоненты**: evaluateFraudRisk, shouldBlockPayment, createFraudDetectionError, isFraudDetectionError, getFraudScore, updateFraudPatterns
  - **Особенности**: ML-enhanced risk scoring, configurable thresholds, external provider integration, PCI-safe processing, immutable pattern storage, централизованное логирование, enum-based типизация
- **fraudDetectionInterfaces.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Fraud detection интерфейсы: контракты для external fraud providers, type-safe integration points, provider abstraction layer
- **fraudDetectionProviders.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Fraud detection провайдеры: concrete implementations для различных fraud services, failover strategies, provider health checks
- **fraudDetectionTypes.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Fraud detection типы: risk levels, decision reasons, fraud patterns, scoring algorithms, ML model interfaces
- **refundHandlingPolicy.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Refund handling стратегии: policy validation, duplicate prevention, amount verification, timeline checks. Business rule engine для refund approval
  - **Технологический стек**: TypeScript strict, TaggedError, business rule engine, async/await, WeakMap caching, centralized logging
  - **Поддерживаемые типы**: RefundHandlingContext, RefundDecision, RefundHandlingPolicyResult, RefundHandlingError, ILogger, RefundDecisionReason (enum)
  - **Ключевые компоненты**: shouldAllowRefund, evaluateRefundPolicy, createRefundHandlingError, isRefundHandlingError, validateRefundTimeline, preventRefundDuplicates
  - **Особенности**: Business rule validation, duplicate prevention, timeline enforcement, amount verification, configurable policies, централизованное логирование, enum-based типизация
- **monitoringPolicy.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Payment monitoring стратегии: SLA tracking, alert thresholds, anomaly detection, business metric aggregation
  - **Технологический стек**: TypeScript strict, TaggedError, time-series analysis, async/await, WeakMap caching, centralized logging
  - **Поддерживаемые типы**: MonitoringContext, MonitoringAlert, MonitoringPolicyResult, MonitoringError, ILogger, AlertSeverity (enum), MetricType (enum)
  - **Ключевые компоненты**: shouldTriggerAlert, evaluateMonitoringMetrics, createMonitoringError, isMonitoringError, calculateSLAMetrics, detectPaymentAnomalies
  - **Особенности**: SLA-aware monitoring, configurable thresholds, anomaly detection, business metric aggregation, time-series analysis, централизованное логирование, enum-based типизация
- **policyEngine.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Policy engine для billing: orchestration всех политик, decision aggregation, policy chaining, conflict resolution, policy versioning

**serialization/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Payment data/result serialization для HTTP/gRPC

- **🛠️ Стек**: TypeScript strict
  Обязательно русские: @file и компактные jsdoc
- **PaymentResultSerializer.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Сериализация результатов платежных операций: JSON schema validation, PCI-safe нормализация, HTTP/gRPC status mapping. Fail-safe confidence scoring, forward-compatible metadata
  - **Технологический стек**: TypeScript strict, immutable types, PCI-safe serialization, literal outcome types, comprehensive validation
  - **Поддерживаемые типы**: PaymentResult<T>, PaymentResultSerializationOutcome, PaymentResultSerializerConfig<T>, TransactionMetadata, SerializedPaymentResult<T>
  - **Ключевые компоненты**: createPaymentResultSerializer (configurable factory), serializePaymentResult (helper), outcome-based error handling (success/partial/fallback)
  - **Особенности**: Transport-agnostic core, PCI-safe serialization, forward-compatible metadata, literal outcome reasons ('insufficient-funds' | 'invalid-method' | 'gateway-error'), 95%+ test coverage, comprehensive edge case handling
- **PaymentErrorSerializer.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Сериализация ошибок платежных операций: error normalization, PCI-compliant masking, HTTP status mapping для REST/gRPC без sensitive данных
  - **Технологический стек**: TypeScript strict, immutable types, PCI-safe error masking, literal outcome types, comprehensive validation
  - **Поддерживаемые типы**: PaymentError, PaymentErrorSerializationOutcome, PaymentErrorSerializerConfig, ErrorMetadata, SerializedPaymentError
  - **Ключевые компоненты**: createPaymentErrorSerializer (configurable factory), serializePaymentError (helper), outcome-based error handling (masked/partial/fallback)
  - **Особенности**: Transport-agnostic core, PCI-safe error serialization, sensitive data masking, literal outcome reasons ('masked' | 'partial' | 'fallback'), 95%+ test coverage, comprehensive error handling

**adapters/** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Payment gateway SDK adapters с error mapping

- **🛠️ Стек**: TypeScript strict + Effect
  Обязательно русские: @file и компактные jsdoc
- **BePaidAPIAdapter.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Адаптер для BePaid SDK с Effect-first дизайном: белорусский payment aggregator, BYN/RUB/USD/EUR, PCI DSS Level 1
  - **Технологический стек**: TypeScript strict, Effect, Context/Tag dependency injection, Layer composition, typed error boundaries, circuit breaker integration
  - **Поддерживаемые типы**: BePaidPaymentRequest, BePaidPaymentResponse, BePaidAdapterError (discriminated union: ConnectionError, InvalidRequestError, PaymentDeclinedError, ProcessingError), BePaidSDK (interface abstraction), BePaidAdapterConfig
  - **Ключевые компоненты**: BePaidAdapter.createPayment/createPaymentStatus/cancelPayment/getBulkPaymentStatus (Effect-based), error mapping (SDK → domain errors), retry logic, circuit breaker, Layer composition для DI
  - **Особенности**: SDK isolation, transport-agnostic design, comprehensive error mapping, Effect.gen для async flows, Context-based dependency injection, PCI-safe processing, bulk operations support
- **WebPayAPIAdapter.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Адаптер для WebPay SDK: основной белорусский provider, seamless integration, fraud detection hooks

  **index.ts** ✅ **ГОТОВ К ПРОДАКШЕНУ** – Selective exports по категориям: Types, Guards, Pattern Matching, Registry, Utilities. Единая точка входа для billing service error system.
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

**domain/** – Mobile доменные ошибки: offline operations, sync conflicts, user permissions

**infrastructure/** – Device/platform errors: iOS/Android specific failures

**policies/** – Mobile стратегии: offline retry, conflict resolution, push notification errors

**serialization/** – Mobile-specific serialization: push payloads, offline queue formats

**adapters/** – React Native adapters, Firebase integration

**index.ts** – Exports: `Mobile`, `Sync`, `Platform`, etc.

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

**domain/** – Tenant доменные ошибки: quota management, tenant permissions, resource allocation

**infrastructure/** – Multi-tenant DB/cache errors, isolation failures

**policies/** – Tenant стратегии: quota enforcement, resource limiting, tenant isolation

**serialization/** – Tenant-scoped serialization, data isolation

**adapters/** – Multi-tenant database adapters, cache isolation

**index.ts** – Exports: `Tenant`, `Quota`, `Isolation`, etc.

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

**domain/** – Feature flag доменные ошибки: flag configuration, user targeting, rollout rules

**infrastructure/** – Flag storage/retrieval errors, cache inconsistencies

**policies/** – Feature flag стратегии: gradual rollout, emergency disable, A/B test errors

**serialization/** – Feature flag state serialization, targeting rule formats

**adapters/** – LaunchDarkly/other FF service adapters

**index.ts** – Exports: `FeatureFlags`, `Rollout`, `Targeting`, etc.

- **🛠️ Стек**: TypeScript
  Обязательно русские: @file и компактные jsdoc

- **ServiceErrorTypes.ts** – Common service типы: `ServiceUnavailableError`, `TimeoutError`, `ConfigurationError`
  - **🛠️ Стек**: TypeScript
    Обязательно русские: @file и компактные jsdoc
- **ServiceErrorRegistry.ts** – Cross-service реестр ошибок, integration с base registry
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **ServiceValidators.ts** – Cross-service валидаторы: service health checks, inter-service communication
  - **🛠️ Стек**: TypeScript + Effect
    Обязательно русские: @file и компактные jsdoc
- **ServiceInstrumentation.ts** – Cross-service monitoring: service mesh tracing, dependency health
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

## 🚀 **FUTURE ROADMAP - РАСШИРЕНИЯ СИСТЕМЫ**

### **8️⃣ RUNTIME ERROR INTELLIGENCE**

**Возможности:** Автоматический анализ паттернов ошибок в продакшене
**Для чего:** Предиктивный анализ ошибок, автоматическое обнаружение аномалий, рекомендации по исправлениям, выявление трендов, ML-классификация ошибок

### **9️⃣ DISTRIBUTED ERROR TRACING**

**Возможности:** Распределенная трассировка ошибок через микросервисную архитектуру
**Для чего:** Полная видимость потока ошибок между сервисами, отслеживание correlation ID, распределенная отладка, end-to-end наблюдаемость

### **10️⃣ ERROR BUDGET MONITORING**

**Возможности:** SLA-бюджеты ошибок с автоматическими действиями
**Для чего:** Практики инженерии надежности сайта, автоматическое управление качеством сервиса, проактивные оповещения, автоматизированные откаты

### **11️⃣ CHAOS ENGINEERING INTEGRATION**

**Возможности:** Преднамеренное создание ошибок для тестирования устойчивости
**Для чего:** Тестирование системной надежности, выявление слабых мест, валидация отказоустойчивости, автоматизированное тестирование resilience

### **12️⃣ ERROR-DRIVEN DEVELOPMENT TOOLS**

**Возможности:** CLI инструменты для анализа и симуляции ошибок
**Для чего:** Опыт разработчиков, быстрая диагностика проблем, анализ паттернов ошибок, симуляционное тестирование без реальных ошибок

### **13️⃣ CROSS-PLATFORM ERROR SYNC**

**Возможности:** Синхронизация ошибок между разными платформами и языками
**Для чего:** Консистентность ошибок в мультиплатформенных приложениях, унифицированные коды ошибок, автоматизированная генерация кода для разных стеков

### **14️⃣ КРАЙНЯЯ ВЕРСИЯ: УПРАВЛЕНИЕ ОШИБКАМИ ОДНИМ КЛИКОМ**

**Возможности:** Полная автоматизация управления ошибками через единый админ-интерфейс
**Для чего:** Управление ошибками без участия человека, прогнозное обслуживание, автоматизированная непрерывность бизнеса

#### **🔥 ФУНКЦИИ ДАШБОРДА ОДНИМ КЛИКОМ:**

**Интеллект ошибок в реальном времени:**

- Мониторинг частоты ошибок в реальном времени с соблюдением SLA
- Прогноз ошибок с ML-обнаружением аномалий
- Автоматизированный анализ первопричин с предложенными исправлениями
- Расчет влияния на бизнес (потеря дохода, ухудшение пользовательского опыта)

**Система автоматического реагирования:**

- Умные оповещения с политиками эскалации
- Авто-исправление для известных проблем (перезапуск сервисов, откат развертываний)
- Координация circuit breaker между сервисами
- Автоматизированные workflows реагирования на инциденты

**Слой бизнес-аналитики:**

- Корреляция ошибок с бизнес-метриками (конверсия, удержание пользователей)
- Анализ влияния на клиентов (затронутые пользователи, географическое распределение)
- Мониторинг соблюдения SLA с автоматизированной отчетностью
- Анализ стоимости и выгоды для инвестиций в предотвращение ошибок

**Набор инструментов для разработчиков:**

- Воспроизведение ошибок одним кликом в staging-среде
- Автоматизированная генерация тестовых случаев для сценариев ошибок
- Инсайты качества кода на основе паттернов ошибок
- Рекомендации по обучению для команд разработчиков

**Интеграция с предприятием:**

- Интеграция с ITSM системами (ServiceNow, Jira Service Desk)
- Автоматизированная отчетность по compliance (GDPR, SOX, HIPAA)
- Корреляция ошибок в мульти-облаке (AWS, GCP, Azure)
- Мониторинг ошибок API поставщиков и отслеживание SLA

**Прогнозное обслуживание:**

- Прогноз отказов с ML с превентивными действиями
- Планирование capacity на основе трендов ошибок
- Автоматизированные рекомендации по масштабированию
- Оценка здоровья инфраструктуры

**Действия одним кликом:**

- 🔄 **Исправить Известные Проблемы** - автоматическое исправление по базе знаний
- 🚀 **Откатить Развертывание** - откат до стабильной версии
- ⚡ **Масштабировать Ресурсы** - автоматическое увеличение capacity
- 🔒 **Включить Circuit Breaker** - изоляция проблемных сервисов
- 📊 **Сгенерировать Отчет** - мгновенный отчет для stakeholders
- 🎯 **Запустить Диагностику** - комплексная проверка системы

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
