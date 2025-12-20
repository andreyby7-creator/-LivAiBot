/**
 * @file index.ts - Selective exports ядра системы ошибок LivAiBot
 *
 * Экспортирует ТОЛЬКО публичный API: 5 групп (Types, Builders, Utils, Validators, Strategies).
 * НЕ экспортирует внутренние модули (ErrorCode, ErrorConstants, ErrorCodeMeta, etc.).
 */

/**
 * Группа Types: публичные типы и функции для работы с ошибками
 * - BaseError discriminated union тип
 * - withCause, withMetadata, toBaseError, isBaseError
 * - asPlainObject, toSerializableObject, stringifyExternal
 * - getCause, getChainDepth, getMemoizedMaxSeverity
 */
export * as Types from './BaseError.js';

/**
 * Группа Builders: фабрики для создания ошибок
 * - ErrorBuilder классы для всех доменов LivAiBot
 * - LivAiErrorBuilder главный конструктор
 * - createAsyncError для async операций
 */
export * as Builders from './ErrorBuilders.js';

/**
 * Группа Utils: утилиты для работы с цепочками ошибок
 * - safeGetCause, safeTraverseCauses, flattenCauses
 * - getErrorChain, findRootCause, analyzeErrorChain
 * - analyzeErrorChain с memoization и cache management
 */
export * as Utils from './ErrorUtilsCore.js';

/**
 * Группа Validators: валидация ошибок и метаданных
 * - assertImmutable, assertValidErrorCode, assertMatchingMetadata
 * - createLazyValidator, validateErrorChain, CompositeValidator
 * - createAsyncValidator для комплексной async валидации
 */
export * as Validators from './ErrorValidators.js';

/**
 * Группа Strategies: стратегии обработки ошибок
 * - ErrorStrategy типы и конфигурации
 * - Групповые стратегии по префиксам (DOMAIN_*, INFRA_*, etc.)
 * - StrategyModifier для composition и customization
 */
export * as Strategies from './ErrorStrategies.js';
