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
