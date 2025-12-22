/**
 * @file index.ts - Экспорт всех компонентов shared слоя обработки ошибок
 *
 * Предоставляет единый entry point для всех shared error handling компонентов.
 */

// ==================== CORE TYPES ====================

/**
 * Основные типы shared ошибок и утилиты
 */
export type {
  SharedErrorCodeString,
  SharedErrorCategory,
  SharedErrorKind,
  SharedDomainError,
  SharedInfraError,
  SharedPolicyError,
  SharedAdapterError,
  SharedError,
  SharedErrorDetails,
  SharedErrorCode,
  SharedErrorInput,
  SharedErrorMatcher,
} from './SharedErrorTypes.js';

// ==================== TYPE GUARDS ====================

/**
 * Функции проверки типов shared ошибок
 */
export {
  isSharedDomainError,
  isSharedInfraError,
  isSharedPolicyError,
  isSharedAdapterError,
  isSharedError,
} from './SharedErrorTypes.js';

// ==================== PATTERN MATCHING ====================

/**
 * Утилиты для pattern matching shared ошибок
 */
export {
  matchSharedError,
  safeMatchSharedError,
} from './SharedErrorTypes.js';

/**
 * Утилиты для работы с SharedErrorKind (observability, metrics, contracts, tracing)
 */
export {
  getSharedErrorKind,
  isSharedErrorKind,
  groupSharedErrorsByKind,
} from './SharedErrorTypes.js';

/**
 * Validation helpers для runtime проверок (adapters, effect boundaries)
 */
export {
  validateSharedError,
  validateSharedErrorKind,
  validateSharedErrorCategory,
  validateSharedErrorCode,
} from './SharedErrorTypes.js';

// ==================== FUTURE EXPORTS ====================

// Domain-specific errors (будут добавлены)
// export * from './domain/index.js';

// Infrastructure errors (будут добавлены)
// export * from './infrastructure/index.js';

// Policy errors (будут добавлены)
// export * from './policies/index.js';

// Adapter errors (будут добавлены)
// export * from './adapters/index.js';

// Normalizers (будут добавлены)
// export * from './normalizers/index.js';

// Serialization (будут добавлены)
// export * from './serialization/index.js';