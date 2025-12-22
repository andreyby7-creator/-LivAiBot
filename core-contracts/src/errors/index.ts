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
