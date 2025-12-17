/**
 * @file ApplicationError. Application ADT поверх Error Kernel
 * Типобезопасный ADT application failures. Application слой (CQRS, orchestration, permissions).
 * Использует BaseError, discriminated unions, smart constructors, local Either.
 * Semver: новый _tag = MINOR, изменение payload = MAJOR
 *
 * ⚠️ Architectural invariant:
 * Application слой МОЖЕТ интерпретировать operational metadata (retry, auth),
 * но НЕ должен знать transport/UI представления (HTTP, gRPC, UI messages).
 */
import { createError, type BaseError } from "../base/BaseError.js"
import { ERROR_CODE, type ErrorCode } from "../base/ErrorCode.js"

import type { ReadonlyDeep } from "type-fest"
// Minimal local Either (no dependency on fp libs)
export type EitherTag = 'Left' | 'Right'
export type Either<E, A> = Readonly<{ _tag: 'Left'; left: E }> | Readonly<{ _tag: 'Right'; right: A }>
export const left = <E>(e: E): Either<E, never> => ({ _tag: 'Left', left: e })
export const right = <A>(a: A): Either<never, A> => ({ _tag: 'Right', right: a })
/** Type guard для проверки Left значения Either. Полезно для orchestration-heavy логики. */
export const isLeft = <E, A>(e: Either<E, A>): e is { _tag: 'Left'; left: E } => e._tag === 'Left'
/** Type guard для проверки Right значения Either. Полезно для orchestration-heavy логики. */
export const isRight = <E, A>(e: Either<E, A>): e is { _tag: 'Right'; right: A } => e._tag === 'Right'

/* -------------------------------------------------------------------------------------------------
 * 🔹 Application контексты (type-safe)
 * ------------------------------------------------------------------------------------------------- */
/** Контекст для отклоненных команд (CQRS) */
export type CommandContext = ReadonlyDeep<{
  commandName: string
  commandId?: string
  correlationId?: string
  reason?: string
}>
/** Контекст для неудачных запросов (CQRS) */
export type QueryContext = ReadonlyDeep<{
  queryName: string
  queryId?: string
  correlationId?: string
  parameters?: ReadonlyDeep<Record<string, unknown>>
}>
/** Контекст для ошибок разрешений */
export type PermissionContext = ReadonlyDeep<{
  resource: string
  action: string
  userId?: string
  correlationId?: string
  requiredPermission?: string
}>

/* -------------------------------------------------------------------------------------------------
 * 🔹 Application метаданные (хранятся в BaseError.extra)
 * ------------------------------------------------------------------------------------------------- */
/** Application-специфичные метаданные в BaseError.extra */
export type ApplicationErrorMetadata = ReadonlyDeep<{
  applicationVersion?: string
  /** Имя сервиса для multi-service архитектуры. Keep optional, don't default. */
  serviceName?: string
}>
/**
 * Конструктор application метаданных с defaults.
 * Всегда устанавливает applicationVersion для observability.
 * @param overrides - переопределения
 */
export const createApplicationMetadata = (
  overrides?: Readonly<Partial<ApplicationErrorMetadata>>
): ApplicationErrorMetadata => ({
  applicationVersion: "unknown",
  ...overrides
})

/* -------------------------------------------------------------------------------------------------
 * 🔹 ADT Application ошибок
 * ------------------------------------------------------------------------------------------------- */
/** Ошибка "Команда отклонена" */
export type CommandRejectedError = BaseError & {
  _tag: "CommandRejected"
  commandName: string
  commandId?: string
  correlationId?: string
  reason?: string
}
/** Ошибка "Запрос не выполнен" */
export type QueryFailedError = BaseError & {
  _tag: "QueryFailed"
  queryName: string
  queryId?: string
  correlationId?: string
}
/** Ошибка "Доступ запрещен" */
export type PermissionDeniedError = BaseError & {
  _tag: "PermissionDenied"
  resource: string
  action: string
  userId?: string
  correlationId?: string
  requiredPermission?: string
}

/** Полный ADT application ошибок. Exhaustive by design */
export type ApplicationError =
  | CommandRejectedError
  | QueryFailedError
  | PermissionDeniedError

/* -------------------------------------------------------------------------------------------------
 * 🔹 Smart constructors (умные конструкторы)
 * ------------------------------------------------------------------------------------------------- */
/**
 * Создает CommandRejected ошибку.
 * Метаданные автоматически берутся из ERROR_CODE_META.
 * @param context - контекст команды (commandName, commandId, reason)
 */
export const createCommandRejectedError = (
  context: CommandContext
): ReadonlyDeep<CommandRejectedError> => ({
  ...createError(
    ERROR_CODE['APPLICATION_COMMAND_REJECTED'] as ErrorCode,
    context.reason ?? `Command '${context.commandName}' was rejected`,
    {
      // correlationId stored in BaseError.context for tracing middleware
      // Also duplicated in ADT payload for pattern matching / orchestration
      ...(context.commandId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.commandId !== undefined && { commandId: context.commandId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createApplicationMetadata()
    }
  ),
  _tag: "CommandRejected" as const,
  commandName: context.commandName,
  ...(context.commandId !== undefined && { commandId: context.commandId }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.reason !== undefined && { reason: context.reason })
})
/**
 * Создает QueryFailed ошибку.
 * Метаданные автоматически берутся из ERROR_CODE_META.
 * @param context - контекст запроса (queryName, queryId, parameters)
 */
export const createQueryFailedError = (
  context: QueryContext
): ReadonlyDeep<QueryFailedError> => ({
  ...createError(
    ERROR_CODE['APPLICATION_QUERY_FAILED'] as ErrorCode,
    `Query '${context.queryName}' failed`,
    {
      // correlationId stored in BaseError.context for tracing middleware
      // Also duplicated in ADT payload for pattern matching / orchestration
      ...(context.queryId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.queryId !== undefined && { queryId: context.queryId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createApplicationMetadata()
    }
  ),
  _tag: "QueryFailed" as const,
  queryName: context.queryName,
  ...(context.queryId !== undefined && { queryId: context.queryId }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
})
/**
 * Создает PermissionDenied ошибку.
 * Метаданные автоматически берутся из ERROR_CODE_META.
 * @param context - контекст разрешения (resource, action, userId, requiredPermission)
 */
export const createPermissionDeniedError = (
  context: PermissionContext
): ReadonlyDeep<PermissionDeniedError> => ({
  ...createError(
    ERROR_CODE['APPLICATION_PERMISSION_DENIED'] as ErrorCode,
    `Permission denied: ${context.action} on ${context.resource}`,
    {
      // correlationId stored in BaseError.context for tracing middleware
      // Also duplicated in ADT payload for pattern matching / orchestration
      ...(context.userId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.userId !== undefined && { userId: context.userId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createApplicationMetadata()
    }
  ),
  _tag: "PermissionDenied" as const,
  resource: context.resource,
  action: context.action,
  ...(context.userId !== undefined && { userId: context.userId }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId }),
  ...(context.requiredPermission !== undefined && { requiredPermission: context.requiredPermission })
})

/* -------------------------------------------------------------------------------------------------
 * 🔹 Pattern matching (exhaustive)
 * ------------------------------------------------------------------------------------------------- */
/**
 * Exhaustive pattern matching для application ошибок.
 * TypeScript гарантирует compile-time exhaustiveness через type narrowing.
 * Если ADT вырастет (добавится новый _tag), компилятор покажет ошибку компиляции.
 * @param error - application ошибка для обработки
 * @param handlers - обработчики для каждого типа ошибки
 * @returns результат обработки соответствующего типа
 */
export const matchApplicationError = <T>(
  error: Readonly<ApplicationError>,
  handlers: Readonly<{
    commandRejected: (e: ReadonlyDeep<CommandRejectedError>) => T
    queryFailed: (e: ReadonlyDeep<QueryFailedError>) => T
    permissionDenied: (e: ReadonlyDeep<PermissionDeniedError>) => T
  }>
): T =>
  error._tag === "CommandRejected" ? handlers.commandRejected(error) :
  error._tag === "QueryFailed" ? handlers.queryFailed(error) :
  handlers.permissionDenied(error)
