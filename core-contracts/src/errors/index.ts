/**
 * @file Error System - единая точка входа для всей системы ошибок
 *
 * Полная система типобезопасных ошибок для платформы LivAI.
 * Предоставляет единый API для работы с ошибками всех слоев.
 *
 * ## Структура системы ошибок:
 *
 * ### Base Layer (`errors/base`)
 * - `BaseError` - базовый тип ошибки
 * - `ERROR_CODE` - стабильные коды ошибок
 * - `ERROR_CODE_META` - централизованный реестр метаданных
 * - `ErrorUtils` - утилиты для работы с ошибками
 *
 * ### Domain Layer (`errors/domain`)
 * - `DomainError` - ADT ошибок доменного слоя
 * - `DomainErrorMeta` - helpers для метаданных domain ошибок
 *
 * ### Application Layer (`errors/application`)
 * - `ApplicationError` - ADT ошибок application слоя (CQRS, orchestration)
 * - `ApplicationErrorMeta` - helpers для метаданных application ошибок
 *
 * ### Infrastructure Layer (`errors/infrastructure`)
 * - `InfrastructureError` - ADT ошибок infrastructure слоя (IO, network, DB)
 * - `InfrastructureErrorMeta` - helpers для метаданных infrastructure ошибок
 *
 * ### Security Layer (`errors/security`)
 * - `SecurityError` - ADT ошибок security слоя (auth, authorization, rate limiting)
 * - `SecurityErrorMeta` - helpers для метаданных security ошибок
 *
 * ### Validation Layer (`errors/validation`)
 * - `ValidationError` - ADT ошибок validation слоя (input validation, schema validation)
 * - `ValidationErrorMeta` - helpers для метаданных validation ошибок
 *
 * ## Использование:
 *
 * ```typescript
 * import { createDomainError, createApplicationError } from '@livai/core-contracts/errors'
 * ```
 */

// Base Layer - Error Kernel
export * from './base/index.js'

// Domain Layer - экспортируем только специфичные типы (исключаем локальные Either)
export type {
  DomainError,
  EntityNotFoundError,
  BusinessRuleViolationError,
  DomainInvariantBrokenError,
  ValidationError as DomainValidationError,
  StateTransitionError,
  EntityContext,
  BusinessRuleContext,
  DomainErrorMetadata
} from './domain/DomainError.js'
export {
  createEntityNotFoundError,
  createBusinessRuleViolationError,
  createDomainInvariantBrokenError,
  createValidationError,
  createStateTransitionError,
  createDomainMetadata,
  matchDomainError
} from './domain/DomainError.js'
export * from './domain/DomainErrorMeta.js'

// Application Layer - экспортируем только специфичные типы (исключаем локальные Either)
export type {
  ApplicationError,
  CommandRejectedError,
  QueryFailedError,
  PermissionDeniedError,
  CommandContext,
  QueryContext,
  PermissionContext,
  ApplicationErrorMetadata
} from './application/ApplicationError.js'
export {
  createCommandRejectedError,
  createQueryFailedError,
  createPermissionDeniedError,
  createApplicationMetadata,
  matchApplicationError
} from './application/ApplicationError.js'
export * from './application/ApplicationErrorMeta.js'

// Infrastructure Layer - экспортируем только специфичные типы (исключаем локальные Either)
export type {
  InfrastructureError,
  NetworkError,
  TimeoutError,
  DatabaseError,
  ExternalServiceError,
  ResourceUnavailableError,
  NetworkContext,
  TimeoutContext,
  DatabaseContext,
  ExternalServiceContext,
  ResourceUnavailableContext,
  InfrastructureErrorMetadata,
  IOResult
} from './infrastructure/InfrastructureError.js'
export {
  createNetworkError,
  createTimeoutError,
  createDatabaseError,
  createExternalServiceError,
  createResourceUnavailableError,
  createInfrastructureMetadata,
  matchInfrastructureError,
  mapIO,
  flatMapIO
} from './infrastructure/InfrastructureError.js'
export * from './infrastructure/InfrastructureErrorMeta.js'

// Security Layer - экспортируем только специфичные типы (исключаем локальные Either)
export type {
  SecurityError,
  UnauthorizedError,
  ForbiddenError,
  TokenExpiredError,
  RateLimitedError,
  UnauthorizedContext,
  ForbiddenContext,
  TokenExpiredContext,
  RateLimitedContext,
  SecurityErrorMetadata
} from './security/SecurityError.js'
export {
  createUnauthorizedError,
  createForbiddenError,
  createTokenExpiredError,
  createRateLimitedError,
  createSecurityMetadata,
  matchSecurityError,
  mapSec,
  flatMapSec,
  isRetryable,
  isRecoverable
} from './security/SecurityError.js'
export * from './security/SecurityErrorMeta.js'

// Validation Layer - экспортируем только специфичные типы (исключаем локальные Either)
export type {
  ValidationError,
  ValidationFailedError,
  SchemaMismatchError,
  RequiredFieldMissingError,
  ValidationFailedContext,
  SchemaMismatchContext,
  RequiredFieldMissingContext,
  ValidationErrorMetadata
} from './validation/ValidationError.js'
export {
  createValidationFailedError,
  createSchemaMismatchError,
  createRequiredFieldMissingError,
  createValidationMetadata,
  matchValidationError,
  mapVal,
  flatMapVal
} from './validation/ValidationError.js'
export * from './validation/ValidationErrorMeta.js'

// Normalizers - нормализация внешних ошибок (HTTP, gRPC, etc.) → BaseError
export * from './normalizers/index.js'

