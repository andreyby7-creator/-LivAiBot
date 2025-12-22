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
  SharedAdapterError,
  SharedDomainError,
  SharedError,
  SharedErrorCategory,
  SharedErrorCode,
  SharedErrorCodeString,
  SharedErrorDetails,
  SharedErrorInput,
  SharedErrorKind,
  SharedErrorMatcher,
  SharedInfraError,
  SharedPolicyError,
} from './SharedErrorTypes.js';

// ==================== TYPE GUARDS ====================

/**
 * Функции проверки типов shared ошибок
 */
export {
  isSharedAdapterError,
  isSharedDomainError,
  isSharedError,
  isSharedInfraError,
  isSharedPolicyError,
} from './SharedErrorTypes.js';

// ==================== PATTERN MATCHING ====================

/**
 * Утилиты для pattern matching shared ошибок
 */
export { matchSharedError, safeMatchSharedError } from './SharedErrorTypes.js';

/**
 * Утилиты для работы с SharedErrorKind (observability, metrics, contracts, tracing)
 */
export {
  getSharedErrorKind,
  groupSharedErrorsByKind,
  isSharedErrorKind,
} from './SharedErrorTypes.js';

/**
 * Validation helpers для runtime проверок (adapters, effect boundaries)
 */
export {
  validateSharedError,
  validateSharedErrorCategory,
  validateSharedErrorCode,
  validateSharedErrorKind,
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
