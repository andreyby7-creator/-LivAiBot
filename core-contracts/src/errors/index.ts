/**
 * @file index.ts - Публичный API модуля ошибок LivAiBot
 *
 * Enterprise-grade система ошибок с discriminated union архитектурой.
 * Экспортирует контролируемый набор API для безопасной работы с ошибками.
 * Внутренние детали (ErrorCode, ErrorConstants) инкапсулированы.
 */

// ==================== ГРУППЫ ПУБЛИЧНОГО API ====================

/**
 * Types: discriminated union типы и core функции работы с ошибками
 * - BaseError discriminated union тип
 * - Type guards: isBaseError
 * - Core функции: withCause, withMetadata, toBaseError
 * - Сериализация: asPlainObject, toSerializableObject, stringifyExternal
 */
export * as Types from './base/BaseError.js';

/**
 * Builders: фабрики создания ошибок для всех доменов
 * - ErrorBuilder классы для доменов (Domain, Infra, Service, Admin)
 * - LivAiErrorBuilder главный конструктор
 * - createAsyncError для async операций
 */
export * as Builders from './base/ErrorBuilders.js';

/**
 * Utils: утилиты работы с цепочками ошибок
 * - Chain utilities: safeGetCause, flattenCauses, getErrorChain
 * - Analysis: analyzeErrorChain с memoization
 * - Safe traversal с cycle detection
 */
export * as Utils from './base/ErrorUtilsCore.js';

/**
 * Validators: валидация ошибок и метаданных
 * - Core validation: assertImmutable, validateErrorChain
 * - Composite validators для комплексной проверки
 * - Async validation support
 */
export * as Validators from './base/ErrorValidators.js';

/**
 * Strategies: стратегии обработки ошибок
 * - Error strategy types и modifiers
 * - Factory functions и grouping по префиксам
 * - Composition-based architecture
 */
export * as Strategies from './base/ErrorStrategies.js';

/**
 * Domain: доменные ошибки бизнес-логики
 * - ValidationError: ошибки валидации данных
 * - AuthError: ошибки аутентификации и авторизации
 * - PermissionError: ошибки прав доступа
 * - DomainError: union тип всех доменных ошибок
 */
export * as Domain from './shared/domain/index.js';

/**
 * Infrastructure: инфраструктурные ошибки для внешних систем
 * - DatabaseError: ошибки баз данных
 * - CacheError: ошибки кеширования
 * - NetworkError: сетевые ошибки
 * - ExternalAPIError: ошибки внешних API
 * - InfrastructureError: union тип всех инфраструктурных ошибок
 */
export * as Infrastructure from './shared/infrastructure/index.js';

/**
 * Adapters: адаптеры для внешних систем с resilience паттернами
 * - HttpAdapter: HTTP клиент с timeout, retry, circuit breaker
 * - DatabaseAdapter: БД клиент с transaction management, connection pooling
 * - CacheAdapter: Cache клиент с serialization, clustering support
 */
export * as Adapters from './shared/adapters/index.js';

/**
 * Normalizers: нормализаторы ошибок из внешних систем
 * - HttpNormalizer: HTTP ошибки -> TaggedError
 * - DatabaseNormalizer: SQL ошибки -> TaggedError с constraint mapping
 * - CacheNormalizer: Cache ошибки -> TaggedError с cluster support
 */
export * as Normalizers from './shared/normalizers/index.js';

/**
 * Serialization: сериализаторы ошибок для разных протоколов
 * - JsonSerializer: JSON сериализация с metadata preservation
 * - GrpcSerializer: gRPC-совместимый формат
 * - GraphqlSerializer: GraphQL error format
 */
export * as Serialization from './shared/serialization/index.js';

/**
 * Contracts: межсервисные контракты обработки ошибок
 * - HttpErrorContract: HTTP error contracts с validation
 * - GrpcErrorContract: gRPC error contracts с correlation
 * - InternalErrorDTO: internal error contracts для компонентов
 */
export * as Contracts from './shared/contracts/index.js';

/**
 * Policies: foundation политики для resilience patterns
 * - RetryPolicy: повтор операций с backoff strategies
 * - RecoveryPolicy: graceful degradation с fallback values
 * - CircuitBreakerPolicy: system health protection
 */
export * as Policies from './shared/policies/index.js';

/**
 * AI Service: специализированные ошибки и инструменты для AI/ML сервисов
 * - AIServiceError: discriminated union для AI операций
 * - AI adapters: Yandex SDK, model providers
 * - AI instrumentation: metrics, tracing, observability
 * - AI policies: circuit breaker, fallback, token management
 * - AI serialization: response/result formatters
 */
export * as AIService from './services/ai-service/index.js';
