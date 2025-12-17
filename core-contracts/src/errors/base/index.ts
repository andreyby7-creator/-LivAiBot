/**
 * @file Base Error Kernel - публичный экспорт всего base слоя
 *
 * Базовый ABI ошибок для всей платформы LivAI.
 * Используется всеми слоями: Domain, Application, IO, Context, Targets.
 */

// BaseError exports
export * from './BaseError.js'

// ErrorCode exports
export { ERROR_CODE, assertNever, isErrorCode } from './ErrorCode.js'
export type { ErrorCode } from './ErrorCode.js'

// ErrorConstants exports
export { ERROR_SEVERITY, ERROR_CATEGORY, ERROR_ORIGIN } from './ErrorConstants.js'
export type { ErrorSeverity, ErrorCategory, ErrorOrigin } from './ErrorConstants.js'

// ErrorMetadata exports
export type { ErrorMetadata } from './ErrorMetadata.js'
export { createErrorMetadata } from './ErrorMetadata.js'

// ErrorCodeMeta exports
export type {
  HttpStatusCode,
  HttpStatusCategory,
  HttpStatusValidationResult,
  GrpcStatusCode,
  ErrorMetrics,
  SemVerPolicy,
  ErrorCodeMeta
} from './ErrorCodeMeta.js'
export {
  HTTP_STATUS_RANGE,
  HTTP_STATUS_CATEGORY_RANGES,
  isValidHttpStatusCode,
  isHttpStatusCode,
  getHttpStatusCategory,
  validateHttpStatusCode,
  DEFAULT_ERROR_CODE_META,
  createErrorCodeMetaWithDefaults,
  generateMetricName,
  toSnakeCase,
  isErrorCodeMeta,
  assertErrorCodeMeta,
  isGrpcStatusCode,
  isErrorMetrics
} from './ErrorCodeMeta.js'

// ErrorCodeMetaData exports
export { ERROR_CODE_META, getErrorCodeMeta, hasErrorCodeMeta, getErrorCodeMetaOrThrow } from './ErrorCodeMetaData.js'

// ErrorUtils exports
export {
  // Immutability utilities
  deepFreeze,
  // BaseError type guard
  isBaseError,
  // Type guards by layer
  isDomainError,
  isApplicationError,
  isInfrastructureError,
  isSecurityError,
  isValidationError,
  // Metadata helpers
  hasCorrelationId,
  hasTenantId,
  isRetryable,
  hasCause,
  getErrorSeverity,
  getErrorCategory,
  getErrorOrigin,
  requiresAlert,
  shouldBlockDeployment,
  getErrorPriority,
  // Cause chain utilities
  getCauseChain,
  getRootCause,
  getNthCause,
  // Filtering and searching
  filterErrorsBySeverity,
  filterErrorsByCategory,
  findErrorByCode,
  // Transformation utilities
  toSerializableError,
  sanitizeError,
  // Comparison utilities
  areErrorsEqual,
  hasSameCode,
  hasSameCodeAndMessage,
  // Context utilities
  mergeErrorContexts,
  extractContextValue,
  // Validation utilities
  isValidErrorMetadata,
  validateErrorStructure
} from './ErrorUtils.js'
export type { ErrorContext, SerializableError } from './ErrorUtils.js'
