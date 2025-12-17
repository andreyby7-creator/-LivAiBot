/**
 * @file ErrorCodeMetaData.ts — централизованный реестр метаданных для всех кодов ошибок
 * Единый источник истины для метаданных всех error codes. Обеспечивает автоматическое заполнение метаданных в BaseError и других слоях.
 * 🎯 Полное покрытие всех кодов из ERROR_CODE | 🔄 Runtime валидация полноты реестра | 📊 Стандартизированные метаданные для observability и operational guidance
 */
import { ERROR_CODE, type ErrorCode } from './ErrorCode.js'
import { createErrorCodeMetaWithDefaults, generateMetricName, type ErrorCodeMeta } from './ErrorCodeMeta.js'
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY, type ErrorCategory, type ErrorOrigin, type ErrorSeverity } from './ErrorConstants.js'
import { deepFreeze } from './ErrorUtils.js'

import type { ReadonlyDeep } from 'type-fest'
/* -------------------------------------------------------------------------------------------------
 * 🔹 Централизованный реестр метаданных
 * ------------------------------------------------------------------------------------------------- */
/** Централизованный реестр метаданных для всех кодов ошибок. Обеспечивает автоматическое заполнение метаданных в BaseError и других слоях. ⚠️ Все коды из ERROR_CODE должны быть представлены в этом реестре. */
export const ERROR_CODE_META: ReadonlyDeep<Record<ErrorCode, ErrorCodeMeta>> = deepFreeze({
  // Domain Layer
  [ERROR_CODE['DOMAIN_ENTITY_NOT_FOUND'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['DOMAIN'] as ErrorOrigin,
    kind: 'entity',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 404,
    grpcStatus: 5, // NOT_FOUND
    metrics: generateMetricName(ERROR_ORIGIN['DOMAIN'] as ErrorOrigin, 'entity', ERROR_CODE['DOMAIN_ENTITY_NOT_FOUND'] as ErrorCode),
    description: 'Domain entity not found'
  }),
  [ERROR_CODE['DOMAIN_INVALID_STATE'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['DOMAIN'] as ErrorOrigin,
    kind: 'state',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 409,
    grpcStatus: 9, // FAILED_PRECONDITION
    metrics: generateMetricName(ERROR_ORIGIN['DOMAIN'] as ErrorOrigin, 'state', ERROR_CODE['DOMAIN_INVALID_STATE'] as ErrorCode),
    description: 'Domain entity is in invalid state for the operation'
  }),
  [ERROR_CODE['DOMAIN_RULE_VIOLATION'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['DOMAIN'] as ErrorOrigin,
    kind: 'rule',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 422,
    grpcStatus: 3, // INVALID_ARGUMENT
    metrics: generateMetricName(ERROR_ORIGIN['DOMAIN'] as ErrorOrigin, 'rule', ERROR_CODE['DOMAIN_RULE_VIOLATION'] as ErrorCode),
    description: 'Domain business rule violation'
  }),
  [ERROR_CODE['DOMAIN_CONFLICT'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['DOMAIN'] as ErrorOrigin,
    kind: 'conflict',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 409,
    grpcStatus: 6, // ALREADY_EXISTS
    metrics: generateMetricName(ERROR_ORIGIN['DOMAIN'] as ErrorOrigin, 'conflict', ERROR_CODE['DOMAIN_CONFLICT'] as ErrorCode),
    description: 'Domain entity conflict detected'
  }),
  [ERROR_CODE['DOMAIN_INVARIANT_BROKEN'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['DOMAIN'] as ErrorOrigin,
    kind: 'invariant',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['CRITICAL'] as ErrorSeverity,
    retryable: false, // ⚠️ Operational: observability должен алертить при этой ошибке
    recoverable: false, // ⚠️ Operational: observability должен алертить при этой ошибке
    httpStatus: 500,
    grpcStatus: 13, // INTERNAL
    metrics: generateMetricName(ERROR_ORIGIN['DOMAIN'] as ErrorOrigin, 'invariant', ERROR_CODE['DOMAIN_INVARIANT_BROKEN'] as ErrorCode),
    description: 'Domain invariant broken - critical business logic violation'
  }),
  // Application Layer
  [ERROR_CODE['APPLICATION_COMMAND_REJECTED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'command',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 400,
    grpcStatus: 3, // INVALID_ARGUMENT
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'command', ERROR_CODE['APPLICATION_COMMAND_REJECTED'] as ErrorCode),
    description: 'Application command rejected'
  }),
  [ERROR_CODE['APPLICATION_QUERY_FAILED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'query',
    category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: true, // Query часто идемпотентный, допустим retry
    recoverable: true,
    httpStatus: 500, // 500 вместо 503 нормально, если причина не infra
    grpcStatus: 13, // INTERNAL
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'query', ERROR_CODE['APPLICATION_QUERY_FAILED'] as ErrorCode),
    description: 'Application query failed'
  }),
  [ERROR_CODE['APPLICATION_PERMISSION_DENIED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'permission',
    category: ERROR_CATEGORY['AUTHORIZATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: false,
    httpStatus: 403,
    grpcStatus: 7, // PERMISSION_DENIED
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'permission', ERROR_CODE['APPLICATION_PERMISSION_DENIED'] as ErrorCode),
    description: 'Application permission denied'
  }),
  // Infrastructure Layer
  [ERROR_CODE['INFRA_NETWORK_ERROR'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin,
    kind: 'network',
    category: ERROR_CATEGORY['INFRASTRUCTURE'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: true,
    recoverable: true,
    httpStatus: 503,
    grpcStatus: 14, // UNAVAILABLE
    metrics: generateMetricName(ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin, 'network', ERROR_CODE['INFRA_NETWORK_ERROR'] as ErrorCode),
    description: 'Infrastructure network error'
  }),
  [ERROR_CODE['INFRA_TIMEOUT'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin,
    kind: 'timeout',
    category: ERROR_CATEGORY['INFRASTRUCTURE'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: true,
    recoverable: true,
    httpStatus: 504,
    grpcStatus: 4, // DEADLINE_EXCEEDED
    metrics: generateMetricName(ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin, 'timeout', ERROR_CODE['INFRA_TIMEOUT'] as ErrorCode),
    description: 'Infrastructure timeout error'
  }),
  [ERROR_CODE['INFRA_DATABASE_ERROR'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin,
    kind: 'database',
    category: ERROR_CATEGORY['INFRASTRUCTURE'] as ErrorCategory,
    severity: ERROR_SEVERITY['CRITICAL'] as ErrorSeverity,
    retryable: true,
    recoverable: true,
    httpStatus: 503,
    grpcStatus: 13, // INTERNAL (можно рассмотреть UNAVAILABLE (14) для кластерных сценариев)
    metrics: generateMetricName(ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin, 'database', ERROR_CODE['INFRA_DATABASE_ERROR'] as ErrorCode),
    description: 'Infrastructure database error'
  }),
  [ERROR_CODE['INFRA_EXTERNAL_SERVICE_ERROR'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin,
    kind: 'external',
    category: ERROR_CATEGORY['INFRASTRUCTURE'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: true,
    recoverable: true,
    httpStatus: 502,
    grpcStatus: 13, // INTERNAL (можно рассмотреть UNAVAILABLE (14) для кластерных сценариев)
    metrics: generateMetricName(ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin, 'external', ERROR_CODE['INFRA_EXTERNAL_SERVICE_ERROR'] as ErrorCode),
    description: 'Infrastructure external service error'
  }),
  [ERROR_CODE['INFRA_RESOURCE_UNAVAILABLE'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin,
    kind: 'resource',
    category: ERROR_CATEGORY['INFRASTRUCTURE'] as ErrorCategory,
    severity: ERROR_SEVERITY['CRITICAL'] as ErrorSeverity,
    retryable: true,
    recoverable: true,
    httpStatus: 503,
    grpcStatus: 14, // UNAVAILABLE
    metrics: generateMetricName(ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin, 'resource', ERROR_CODE['INFRA_RESOURCE_UNAVAILABLE'] as ErrorCode),
    description: 'Infrastructure resource unavailable'
  }),
  // Security Layer
  [ERROR_CODE['SECURITY_UNAUTHORIZED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['SECURITY'] as ErrorOrigin,
    kind: 'auth',
    category: ERROR_CATEGORY['AUTHORIZATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: false,
    httpStatus: 401,
    grpcStatus: 16, // UNAUTHENTICATED
    metrics: generateMetricName(ERROR_ORIGIN['SECURITY'] as ErrorOrigin, 'auth', ERROR_CODE['SECURITY_UNAUTHORIZED'] as ErrorCode),
    description: 'Security unauthorized error'
  }),
  [ERROR_CODE['SECURITY_FORBIDDEN'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['SECURITY'] as ErrorOrigin,
    kind: 'permission',
    category: ERROR_CATEGORY['AUTHORIZATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['HIGH'] as ErrorSeverity,
    retryable: false,
    recoverable: false,
    httpStatus: 403,
    grpcStatus: 7, // PERMISSION_DENIED
    metrics: generateMetricName(ERROR_ORIGIN['SECURITY'] as ErrorOrigin, 'permission', ERROR_CODE['SECURITY_FORBIDDEN'] as ErrorCode),
    description: 'Security forbidden error'
  }),
  [ERROR_CODE['SECURITY_TOKEN_EXPIRED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['SECURITY'] as ErrorOrigin,
    kind: 'token',
    category: ERROR_CATEGORY['AUTHORIZATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 401,
    grpcStatus: 16, // UNAUTHENTICATED
    metrics: generateMetricName(ERROR_ORIGIN['SECURITY'] as ErrorOrigin, 'token', ERROR_CODE['SECURITY_TOKEN_EXPIRED'] as ErrorCode),
    description: 'Security token expired'
  }),
  [ERROR_CODE['SECURITY_RATE_LIMITED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['SECURITY'] as ErrorOrigin,
    kind: 'rate_limit',
    category: ERROR_CATEGORY['AUTHORIZATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: true,
    recoverable: true,
    httpStatus: 429,
    grpcStatus: 8, // RESOURCE_EXHAUSTED
    metrics: generateMetricName(ERROR_ORIGIN['SECURITY'] as ErrorOrigin, 'rate_limit', ERROR_CODE['SECURITY_RATE_LIMITED'] as ErrorCode),
    description: 'Security rate limit exceeded'
  }),
  // Validation Layer
  [ERROR_CODE['VALIDATION_FAILED'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'validation',
    category: ERROR_CATEGORY['VALIDATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 400,
    grpcStatus: 3, // INVALID_ARGUMENT
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'validation', ERROR_CODE['VALIDATION_FAILED'] as ErrorCode),
    description: 'Validation failed'
  }),
  [ERROR_CODE['VALIDATION_SCHEMA_MISMATCH'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'schema',
    category: ERROR_CATEGORY['VALIDATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 400,
    grpcStatus: 3, // INVALID_ARGUMENT
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'schema', ERROR_CODE['VALIDATION_SCHEMA_MISMATCH'] as ErrorCode),
    description: 'Validation schema mismatch'
  }),
  [ERROR_CODE['VALIDATION_REQUIRED_FIELD_MISSING'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'field',
    category: ERROR_CATEGORY['VALIDATION'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: false,
    recoverable: true,
    httpStatus: 400,
    grpcStatus: 3, // INVALID_ARGUMENT
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'field', ERROR_CODE['VALIDATION_REQUIRED_FIELD_MISSING'] as ErrorCode),
    description: 'Validation required field missing'
  }),
  // Fallback
  [ERROR_CODE['UNKNOWN_ERROR'] as ErrorCode]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin,
    kind: 'unknown',
    category: ERROR_CATEGORY['UNKNOWN'] as ErrorCategory,
    severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
    retryable: false,
    recoverable: false,
    httpStatus: 500,
    grpcStatus: 2, // UNKNOWN
    metrics: generateMetricName(ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, 'unknown', ERROR_CODE['UNKNOWN_ERROR'] as ErrorCode),
    description: 'Unknown error - fallback for unhandled errors'
  })
  // ⚠️ Type assertion: осознанный escape hatch, оправдан наличием runtime-валидации ниже (validateRegistryOnLoad)
} as Record<ErrorCode, ErrorCodeMeta>)
/* -------------------------------------------------------------------------------------------------
 * 🔹 Runtime валидация полноты реестра
 * ------------------------------------------------------------------------------------------------- */
/** Проверяет полноту реестра ERROR_CODE_META. Валидирует, что все коды из ERROR_CODE представлены в реестре. @returns список отсутствующих кодов или пустой массив если реестр полный */
const validateRegistryCompleteness = (): ReadonlyDeep<ErrorCode[]> => {
  // ERROR_CODE - as const object (не enum), поэтому Object.values безопасен без дубликатов
  const errorCodes: ReadonlyDeep<readonly ErrorCode[]> = Object.values(ERROR_CODE) as ReadonlyDeep<readonly ErrorCode[]>
  // Используем Object.keys, т.к. код хранится как ключ реестра. Если ErrorCodeMeta начнет хранить code внутри, можно заменить на: Object.values(ERROR_CODE_META).map(meta => meta.code)
  const registryCodes: ReadonlyDeep<readonly ErrorCode[]> = Object.keys(ERROR_CODE_META) as ReadonlyDeep<readonly ErrorCode[]>
  return errorCodes.filter((code: ErrorCode): boolean => !registryCodes.includes(code)) as ReadonlyDeep<ErrorCode[]>
}
/** Валидирует полноту реестра при загрузке модуля. Выбрасывает ошибку, если реестр неполный */
const validateRegistryOnLoad = (): never => {
  const missingCodes = validateRegistryCompleteness()
  return missingCodes.length > 0
    ? ((): never => {
        throw new Error(
          `ERROR_CODE_META registry is incomplete. Missing codes: ${missingCodes.join(', ')}. ` +
          `All codes from ERROR_CODE must be present in the registry.`
        )
      })()
    : ((): never => {
        return undefined as never
      })()
}
// Выполняем валидацию при загрузке модуля
validateRegistryOnLoad()
/* -------------------------------------------------------------------------------------------------
 * 🔹 Helpers для работы с реестром
 * ------------------------------------------------------------------------------------------------- */
/** Получает метаданные для кода ошибки из реестра. @param code - код ошибки @returns метаданные из реестра или undefined если код не найден */
export const getErrorCodeMeta = (code: ErrorCode): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  ERROR_CODE_META[code]
/** Проверяет наличие метаданных для кода ошибки в реестре. @param code - код ошибки @returns true если метаданные найдены, false иначе */
export const hasErrorCodeMeta = (code: ErrorCode): boolean =>
  Object.prototype.hasOwnProperty.call(ERROR_CODE_META, code)
/** Получает метаданные для кода ошибки из реестра или выбрасывает ошибку. @param code - код ошибки @returns метаданные из реестра @throws Error если метаданные не найдены */
export const getErrorCodeMetaOrThrow = (code: ErrorCode): ReadonlyDeep<ErrorCodeMeta> => {
  const meta = ERROR_CODE_META[code]
  const throwError = (): never => {
    throw new Error(`ErrorCodeMeta not found for code: ${code}. Registry may be incomplete.`)
  }
  return meta ?? throwError()
}
