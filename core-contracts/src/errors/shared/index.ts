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

// ==================== REGISTRY ====================

/**
 * Shared error registry с layered resolution (SharedRegistry → BaseRegistry → fallback)
 * Регистрация SHARED_* кодов в UnifiedErrorRegistry
 */
export {
  checkSharedCodesConsistency,
  getAllSharedErrorCodes,
  getFromBaseRegistry,
  getFromNamespaceRegistry,
  getFromSharedRegistry,
  getRegistryStats,
  getSharedRegistryStats,
  isSharedErrorCode,
  registerSharedErrorsInRegistry,
  registerSharedLayer,
  resolveSharedErrorMeta,
  SHARED_ERROR_CODES,
  SHARED_ERROR_METADATA,
} from './SharedErrorRegistry.js';

export { REGISTRY_NAMESPACES } from './SharedErrorRegistry.js';

export type { RegistryNamespace } from './SharedErrorRegistry.js';

// ==================== CONTRACTS ====================

/**
 * Внутренние контракты shared слоя для HTTP, gRPC и внутренних ошибок.
 * Упрощают миграцию к services/contracts layer и убирают implicit agreements.
 */
export * from './contracts/index.js';

// ==================== DOMAIN ERRORS ====================

/**
 * Общие доменные ошибки LivAiBot: ValidationError, AuthError, PermissionError.
 * Builders: createValidationError(), createAuthError(), createPermissionError().
 * Используют BaseError + ErrorBuilders для TaggedError типов.
 * Независимы от инфраструктуры и сервисов.
 */
export * from './domain/index.js';

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
