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
export type {
  ContractValidationError,
  ErrorDetails,
  ExecutionContext,
  GrpcErrorContract,
  GrpcErrorContractType,
  HttpErrorContract,
  HttpErrorContractType,
  InternalErrorDTO,
  InternalErrorDTOType,
} from './contracts/index.js';

export {
  createGrpcErrorContract,
  createHttpErrorContract,
  createInternalErrorDTO,
  Either,
  getGrpcCorrelationId,
  getGrpcErrorCode,
  getGrpcErrorDetails,
  getHttpErrorCode,
  getHttpErrorDetails,
  getHttpErrorMessage,
  getInternalCorrelationId,
  getInternalErrorCategory,
  getInternalErrorChain,
  getInternalErrorCode,
  getInternalErrorComponent,
  GRPC_STATUS_CODES,
  hasInternalErrorCause,
  isContractValidationError,
  isGrpcErrorContract,
  isHttpErrorContract,
  isInternalErrorDTO,
} from './contracts/index.js';

// ==================== DOMAIN ERRORS ====================

/**
 * Общие доменные ошибки LivAiBot: ValidationError, AuthError, PermissionError.
 * Builders: createValidationError(), createAuthError(), createPermissionError().
 * Используют BaseError + ErrorBuilders для TaggedError типов.
 * Независимы от инфраструктуры и сервисов.
 */
export type {
  AuthError,
  AuthErrorContext,
  AuthErrorReason,
  DomainError,
  PermissionError,
  PermissionErrorContext,
  ValidationError,
  ValidationErrorContext,
} from './domain/index.js';

export {
  createAuthError,
  createPermissionError,
  createValidationError,
  getAuthDeviceInfo,
  getAuthErrorReason,
  getAuthRequiredPermissions,
  getAuthUserId,
  getAuthUserPermissions,
  getGeoLocation,
  getPermissionResource,
  getRateLimitInfo,
  getRequiredPermissions,
  getUserPermissions,
  getValidationField,
  getValidationRule,
  hasMissingPermissions,
  isAuthError,
  isInsufficientPermissions,
  isMFARequiredError,
  isPermissionError,
  isRateLimitedError,
  isTokenRelatedError,
  isValidationError,
  requiresMFA,
} from './domain/index.js';

// ==================== INFRASTRUCTURE ERRORS ====================

/**
 * Инфраструктурные ошибки: DatabaseError, CacheError, NetworkError, ExternalAPIError.
 * Builders для каждого типа инфраструктуры с автоматической metadata генерацией.
 * Используют BaseError + ErrorBuilders для TaggedError типов.
 */
export type {
  CacheError,
  CacheErrorContext,
  DatabaseError,
  DatabaseErrorContext,
  ExternalAPIError,
  ExternalAPIErrorContext,
  InfrastructureError,
  NetworkError,
  NetworkErrorContext,
} from './infrastructure/index.js';

export {
  createCacheError,
  createDatabaseError,
  createExternalAPIError,
  createNetworkError,
  getAPIConnection,
  getAPIRateLimit,
  getAPIRetryInfo,
  getAPIServiceInfo,
  getCacheConnection,
  getCacheKey,
  getCacheOperation,
  getDatabaseConnection,
  getDatabaseOperation,
  getDatabaseType,
  getHttpRequestInfo,
  getNetworkConnection,
  getNetworkUrl,
  getTableName,
  isCacheConnectionError,
  isCacheError,
  isDatabaseConnectionError,
  isDatabaseError,
  isExternalAPIError,
  isHttpError,
  isNetworkError,
  isRetryableError,
  isTimeoutError,
  isValidCacheErrorContext,
  isValidDatabaseErrorContext,
  isValidExternalAPIErrorContext,
  isValidNetworkErrorContext,
} from './infrastructure/index.js';

// ==================== ADAPTERS ====================

/**
 * Адаптеры для boundary операций: HttpAdapter, DatabaseAdapter, CacheAdapter.
 * Effect-based, с retry/timeout/circuit breaker, error normalization, strategy application.
 * Boundary + side-effects компоненты без бизнес-логики.
 */
export * from './adapters/index.js';

// ==================== NORMALIZERS ====================

/**
 * Нормализаторы ошибок из различных источников: HttpNormalizer, DatabaseNormalizer.
 * Преобразуют unknown ошибки в стандартизированные TaggedError типы с извлечением метаданных.
 * Чистые функции без side-effects.
 */
export * from './normalizers/index.js';

// ==================== SERIALIZATION ====================

/**
 * Сериализаторы для различных протоколов: GraphqlSerializer, GrpcSerializer, JsonSerializer.
 * Преобразуют TaggedError в форматы для внешних систем с sanitization и external contracts.
 */
export * from './serialization/index.js';

// ==================== ERROR BOUNDARY ====================

/**
 * Shared error boundary helpers для обработки ошибок в adapters/services.
 * Мощный модуль для 80% случаев error handling с нормализацией, стратегиями и сериализацией.
 */
export * as ErrorBoundary from './SharedErrorBoundary.js';
