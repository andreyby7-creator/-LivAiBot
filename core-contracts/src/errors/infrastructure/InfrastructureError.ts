/**
 * @file InfrastructureError. Infrastructure ADT поверх Error Kernel
 * Типобезопасный ADT infrastructure failures. Infrastructure слой (IO, runtime, external services).
 * Использует BaseError, discriminated unions, smart constructors, local Either.
 * Semver: новый _tag = MINOR, изменение payload = MAJOR
 *
 * ⚠️ Architectural invariant:
 * Infrastructure слой отвечает за IO операции и runtime окружение.
 * Может интерпретировать operational metadata (retry, timeout, circuit breaker),
 * но НЕ должен знать business логику или domain правила.
 */
import { createError, type BaseError } from "../base/BaseError.js"
import { ERROR_CODE, type ErrorCode } from "../base/ErrorCode.js"

import type { ReadonlyDeep } from "type-fest"
// Минимальный локальный Either (без зависимостей от fp библиотек)
export type EitherTag = 'Left' | 'Right'
export type Either<E, A> = Readonly<{ _tag: 'Left'; left: E }> | Readonly<{ _tag: 'Right'; right: A }>
/** Семантический alias для Either в Infrastructure слое (IO operations) */
export type IOResult<E, A> = Either<E, A>
export const left = <E>(e: E): Either<E, never> => ({ _tag: 'Left', left: e })
export const right = <A>(a: A): Either<never, A> => ({ _tag: 'Right', right: a })
/** Type guard для проверки Left значения Either. Полезно для IO-heavy логики. */
export const isLeft = <E, A>(e: Either<E, A>): e is { _tag: 'Left'; left: E } => e._tag === 'Left'
/** Type guard для проверки Right значения Either. Полезно для IO-heavy логики. */
export const isRight = <E, A>(e: Either<E, A>): e is { _tag: 'Right'; right: A } => e._tag === 'Right'
/** Преобразует значение в IOResult через функцию (map). Если Left - возвращает ошибку без изменений. */
export const mapIO = <E, A, B>(
  ioResult: IOResult<E, A>,
  f: (a: A) => B
): IOResult<E, B> =>
  isLeft(ioResult) ? ioResult : right(f((ioResult as { _tag: 'Right'; right: A }).right))
/** Преобразует значение в IOResult через функцию, возвращающую IOResult (flatMap/bind). Если Left - возвращает ошибку без изменений. */
export const flatMapIO = <E, A, B>(
  ioResult: IOResult<E, A>,
  f: (a: A) => IOResult<E, B>
): IOResult<E, B> =>
  isLeft(ioResult) ? ioResult : f((ioResult as { _tag: 'Right'; right: A }).right)
/* -------------------------------------------------------------------------------------------------
 * 🔹 Infrastructure контексты (type-safe)
 * ------------------------------------------------------------------------------------------------- */
/** Контекст для сетевых ошибок */
export type NetworkContext = ReadonlyDeep<{
  endpoint: string
  method?: string
  statusCode?: number
  correlationId?: string
  startedAt?: string
}>
/** Контекст для ошибок таймаута */
export type TimeoutContext = ReadonlyDeep<{
  operation: string
  timeoutMs: number
  correlationId?: string
  startedAt?: string
}>
/** Контекст для ошибок базы данных */
export type DatabaseContext = ReadonlyDeep<{
  database: string
  operation: string
  /** ⚠️ SECURITY: query может содержать PII / secrets. Используйте только sanitizedQuery или queryHash вместо сырого SQL. */
  query?: string // ⚠️ DEPRECATED: используйте sanitizedQuery или queryHash
  /** Sanitized версия запроса без PII/secrets для безопасного логирования */
  sanitizedQuery?: string
  /** Хеш запроса для безопасного логирования без PII/secrets */
  queryHash?: string
  correlationId?: string
  startedAt?: string
}>
/** Контекст для ошибок внешних сервисов */
export type ExternalServiceContext = ReadonlyDeep<{
  serviceName: string
  endpoint?: string
  statusCode?: number
  correlationId?: string
  startedAt?: string
}>
/** Контекст для недоступных ресурсов */
export type ResourceUnavailableContext = ReadonlyDeep<{
  resourceType: string
  resourceId?: string
  correlationId?: string
  startedAt?: string
}>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Infrastructure метаданные (хранятся в BaseError.extra)
 * ------------------------------------------------------------------------------------------------- */
/** Infrastructure-специфичные метаданные в BaseError.extra */
export type InfrastructureErrorMetadata = ReadonlyDeep<{
  infrastructureVersion?: string
  /** Имя хоста/инстанса для распределенных систем */
  hostname?: string
  /** Регион/зона для multi-region архитектуры */
  region?: string
  /** Timestamp для observability (ISO string) */
  timestamp?: string
}>
/** Конструктор infrastructure метаданных с defaults. Всегда устанавливает infrastructureVersion и timestamp для observability. */
export const createInfrastructureMetadata = (
  overrides?: Readonly<Partial<InfrastructureErrorMetadata>>
): InfrastructureErrorMetadata => ({
  infrastructureVersion: "unknown",
  timestamp: new Date().toISOString(),
  ...overrides
})
/* -------------------------------------------------------------------------------------------------
 * 🔹 ADT Infrastructure ошибок
 * ------------------------------------------------------------------------------------------------- */
/** Ошибка "Сетевая ошибка" */
export type NetworkError = BaseError & {
  _tag: "Network"
  endpoint: string
  method?: string
  statusCode?: number
  correlationId?: string
  startedAt?: string
}
/** Ошибка "Таймаут" */
export type TimeoutError = BaseError & {
  _tag: "Timeout"
  operation: string
  timeoutMs: number
  correlationId?: string
  startedAt?: string
}
/** Ошибка "Ошибка базы данных" */
export type DatabaseError = BaseError & {
  _tag: "Database"
  database: string
  operation: string
  /** ⚠️ SECURITY: query может содержать PII / secrets. Используйте только sanitizedQuery или queryHash вместо сырого SQL. */
  query?: string // ⚠️ DEPRECATED: используйте sanitizedQuery или queryHash
  /** Sanitized версия запроса без PII/secrets для безопасного логирования */
  sanitizedQuery?: string
  /** Хеш запроса для безопасного логирования без PII/secrets */
  queryHash?: string
  correlationId?: string
  startedAt?: string
}
/** Ошибка "Ошибка внешнего сервиса" */
export type ExternalServiceError = BaseError & {
  _tag: "ExternalService"
  serviceName: string
  endpoint?: string
  statusCode?: number
  correlationId?: string
  startedAt?: string
}
/** Ошибка "Ресурс недоступен" */
export type ResourceUnavailableError = BaseError & {
  _tag: "ResourceUnavailable"
  resourceType: string
  resourceId?: string
  correlationId?: string
  startedAt?: string
}
/** Полный ADT infrastructure ошибок. Exhaustive by design */
export type InfrastructureError =
  | NetworkError
  | TimeoutError
  | DatabaseError
  | ExternalServiceError
  | ResourceUnavailableError
/* -------------------------------------------------------------------------------------------------
 * 🔹 Smart constructors (умные конструкторы)
 * ------------------------------------------------------------------------------------------------- */
/** Создает Network ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createNetworkError = (
  context: NetworkContext
): ReadonlyDeep<NetworkError> => ({
  ...createError(
    ERROR_CODE['INFRA_NETWORK_ERROR'] as ErrorCode,
    `Network error: ${context.method ?? 'GET'} ${context.endpoint}${context.statusCode !== undefined ? ` (${context.statusCode})` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / retry logic
      ...(context.correlationId !== undefined ? {
        context: {
          correlationId: context.correlationId
        }
      } : undefined),
      extra: createInfrastructureMetadata()
    }
  ),
  _tag: "Network" as const,
  endpoint: context.endpoint,
  ...(context.method !== undefined && { method: context.method }),
  ...(context.statusCode !== undefined && { statusCode: context.statusCode }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.startedAt !== undefined && { startedAt: context.startedAt })
}) as ReadonlyDeep<NetworkError>
/** Создает Timeout ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createTimeoutError = (
  context: TimeoutContext
): ReadonlyDeep<TimeoutError> => ({
  ...createError(
    ERROR_CODE['INFRA_TIMEOUT'] as ErrorCode,
    `Operation '${context.operation}' timed out after ${context.timeoutMs}ms`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / retry logic
      ...(context.correlationId !== undefined ? {
        context: {
          correlationId: context.correlationId
        }
      } : undefined),
      extra: createInfrastructureMetadata()
    }
  ),
  _tag: "Timeout" as const,
  operation: context.operation,
  timeoutMs: context.timeoutMs,
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.startedAt !== undefined && { startedAt: context.startedAt })
}) as ReadonlyDeep<TimeoutError>
/** Создает Database ошибку. Метаданные автоматически берутся из ERROR_CODE_META. @warning query может содержать PII/secrets - используйте sanitizedQuery или queryHash вместо сырого SQL */
export const createDatabaseError = (
  context: DatabaseContext
): ReadonlyDeep<DatabaseError> => ({
  ...createError(
    ERROR_CODE['INFRA_DATABASE_ERROR'] as ErrorCode,
    `Database error: ${context.operation} on ${context.database}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / retry logic
      ...(context.correlationId !== undefined ? {
        context: {
          correlationId: context.correlationId
        }
      } : undefined),
      extra: createInfrastructureMetadata()
    }
  ),
  _tag: "Database" as const,
  database: context.database,
  operation: context.operation,
  ...(context.query !== undefined && { query: context.query }),
  ...(context.sanitizedQuery !== undefined && { sanitizedQuery: context.sanitizedQuery }),
  ...(context.queryHash !== undefined && { queryHash: context.queryHash }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.startedAt !== undefined && { startedAt: context.startedAt })
}) as ReadonlyDeep<DatabaseError>
/** Создает ExternalService ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createExternalServiceError = (
  context: ExternalServiceContext
): ReadonlyDeep<ExternalServiceError> => ({
  ...createError(
    ERROR_CODE['INFRA_EXTERNAL_SERVICE_ERROR'] as ErrorCode,
    `External service error: ${context.serviceName}${context.endpoint !== undefined ? ` (${context.endpoint})` : ''}${context.statusCode !== undefined ? ` - ${context.statusCode}` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / retry logic
      ...(context.correlationId !== undefined ? {
        context: {
          correlationId: context.correlationId
        }
      } : undefined),
      extra: createInfrastructureMetadata()
    }
  ),
  _tag: "ExternalService" as const,
  serviceName: context.serviceName,
  ...(context.endpoint !== undefined && { endpoint: context.endpoint }),
  ...(context.statusCode !== undefined && { statusCode: context.statusCode }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.startedAt !== undefined && { startedAt: context.startedAt })
}) as ReadonlyDeep<ExternalServiceError>
/** Создает ResourceUnavailable ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createResourceUnavailableError = (
  context: ResourceUnavailableContext
): ReadonlyDeep<ResourceUnavailableError> => ({
  ...createError(
    ERROR_CODE['INFRA_RESOURCE_UNAVAILABLE'] as ErrorCode,
    `Resource unavailable: ${context.resourceType}${context.resourceId !== undefined ? ` (${context.resourceId})` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / retry logic
      ...(context.correlationId !== undefined ? {
        context: {
          correlationId: context.correlationId
        }
      } : undefined),
      extra: createInfrastructureMetadata()
    }
  ),
  _tag: "ResourceUnavailable" as const,
  resourceType: context.resourceType,
  ...(context.resourceId !== undefined && { resourceId: context.resourceId }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.startedAt !== undefined && { startedAt: context.startedAt })
}) as ReadonlyDeep<ResourceUnavailableError>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Pattern matching (exhaustive)
 * ------------------------------------------------------------------------------------------------- */
/** Exhaustive pattern matching для infrastructure ошибок. TypeScript гарантирует compile-time exhaustiveness через type narrowing. Если ADT вырастет (добавится новый _tag), компилятор покажет ошибку компиляции. */
export const matchInfrastructureError = <T>(
  error: Readonly<InfrastructureError>,
  handlers: Readonly<{
    network: (e: ReadonlyDeep<NetworkError>) => T
    timeout: (e: ReadonlyDeep<TimeoutError>) => T
    database: (e: ReadonlyDeep<DatabaseError>) => T
    externalService: (e: ReadonlyDeep<ExternalServiceError>) => T
    resourceUnavailable: (e: ReadonlyDeep<ResourceUnavailableError>) => T
  }>
): T =>
  error._tag === "Network" ? handlers.network(error) :
  error._tag === "Timeout" ? handlers.timeout(error) :
  error._tag === "Database" ? handlers.database(error) :
  error._tag === "ExternalService" ? handlers.externalService(error) :
  handlers.resourceUnavailable(error)
