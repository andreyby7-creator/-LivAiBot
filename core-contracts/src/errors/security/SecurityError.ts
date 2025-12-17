/**
 * @file SecurityError. Security ADT поверх Error Kernel
 * Типобезопасный ADT security failures. Security слой (authentication, authorization, rate limiting).
 * Использует BaseError, discriminated unions, smart constructors, local Either.
 * Semver: новый _tag = MINOR, изменение payload = MAJOR
 *
 * ⚠️ Architectural invariant:
 * Security слой отвечает за authentication и authorization.
 * Может интерпретировать operational metadata (retry для rate limits, recoverable для token refresh),
 * но НЕ должен знать transport/UI представления (HTTP, gRPC, UI messages).
 */
import { createError } from "../base/BaseError.js"
import { ERROR_CODE } from "../base/ErrorCode.js"

import { isSecurityErrorRetryable, isSecurityErrorRecoverable } from "./SecurityErrorMeta.js"

import type { BaseError } from "../base/BaseError.js"
import type { ErrorCode } from "../base/ErrorCode.js"
import type { ReadonlyDeep } from "type-fest"
// Minimal local Either (no dependency on fp libs)
export type EitherTag = 'Left' | 'Right'
export type Either<E, A> = Readonly<{ _tag: 'Left'; left: E }> | Readonly<{ _tag: 'Right'; right: A }>
export const left = <E>(e: E): Either<E, never> => ({ _tag: 'Left', left: e })
export const right = <A>(a: A): Either<never, A> => ({ _tag: 'Right', right: a })
/** Type guard для проверки Left значения Either. Полезно для security-heavy логики. */
export const isLeft = <E, A>(e: Either<E, A>): e is { _tag: 'Left'; left: E } => e._tag === 'Left'
/** Type guard для проверки Right значения Either. Полезно для security-heavy логики. */
export const isRight = <E, A>(e: Either<E, A>): e is { _tag: 'Right'; right: A } => e._tag === 'Right'
/** Преобразует значение в Either через функцию (map). Если Left - возвращает ошибку без изменений. Полезно для security-heavy flows (chaining auth checks). */
export const mapSec = <E, A, B>(
  either: Either<E, A>,
  f: (a: A) => B
): Either<E, B> =>
  isLeft(either) ? either : right(f((either as { _tag: 'Right'; right: A }).right))
/** Преобразует значение в Either через функцию, возвращающую Either (flatMap/bind). Если Left - возвращает ошибку без изменений. Полезно для security-heavy flows (chaining auth checks). */
export const flatMapSec = <E, A, B>(
  either: Either<E, A>,
  f: (a: A) => Either<E, B>
): Either<E, B> =>
  isLeft(either) ? either : f((either as { _tag: 'Right'; right: A }).right)
/* -------------------------------------------------------------------------------------------------
 * 🔹 Security контексты (type-safe)
 * ------------------------------------------------------------------------------------------------- */
/** Контекст для ошибок неавторизации */
export type UnauthorizedContext = ReadonlyDeep<{
  reason?: string
  userId?: string
  correlationId?: string
}>
/** Контекст для ошибок запрета доступа */
export type ForbiddenContext = ReadonlyDeep<{
  resource: string
  action: string
  userId?: string
  requiredPermission?: string
  correlationId?: string
}>
/** Контекст для ошибок истечения токена */
export type TokenExpiredContext = ReadonlyDeep<{
  tokenType?: string
  userId?: string
  correlationId?: string
}>
/** Контекст для ошибок превышения лимита запросов */
export type RateLimitedContext = ReadonlyDeep<{
  limit: number
  windowMs: number
  userId?: string
  endpoint?: string
  correlationId?: string
}>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Security метаданные (хранятся в BaseError.extra)
 * ------------------------------------------------------------------------------------------------- */
/** Security-специфичные метаданные в BaseError.extra */
export type SecurityErrorMetadata = ReadonlyDeep<{
  securityVersion?: string
  /** IP адрес клиента для rate limiting и аудита */
  clientIp?: string
  /** User agent для аудита */
  userAgent?: string
  /** Timestamp для observability (ISO string) */
  timestamp?: string
}>
/** Конструктор security метаданных с defaults. Всегда устанавливает securityVersion и timestamp для observability. */
export const createSecurityMetadata = (
  overrides?: Readonly<Partial<SecurityErrorMetadata>>
): SecurityErrorMetadata => ({
  securityVersion: "unknown",
  timestamp: new Date().toISOString(),
  ...overrides
})
/* -------------------------------------------------------------------------------------------------
 * 🔹 ADT Security ошибок
 * ------------------------------------------------------------------------------------------------- */
/** Ошибка "Неавторизован" */
export type UnauthorizedError = BaseError & {
  _tag: "Unauthorized"
  reason?: string
  userId?: string
  correlationId?: string
}
/** Ошибка "Доступ запрещен" */
export type ForbiddenError = BaseError & {
  _tag: "Forbidden"
  resource: string
  action: string
  userId?: string
  requiredPermission?: string
  correlationId?: string
}
/** Ошибка "Токен истек" */
export type TokenExpiredError = BaseError & {
  _tag: "TokenExpired"
  tokenType?: string
  userId?: string
  correlationId?: string
}
/** Ошибка "Превышен лимит запросов" */
export type RateLimitedError = BaseError & {
  _tag: "RateLimited"
  limit: number
  windowMs: number
  userId?: string
  endpoint?: string
  correlationId?: string
}

/** Полный ADT security ошибок. Exhaustive by design */
export type SecurityError =
  | UnauthorizedError
  | ForbiddenError
  | TokenExpiredError
  | RateLimitedError
/* -------------------------------------------------------------------------------------------------
 * 🔹 Smart constructors (умные конструкторы)
 * ------------------------------------------------------------------------------------------------- */
/** Создает Unauthorized ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createUnauthorizedError = (
  context: UnauthorizedContext
): ReadonlyDeep<UnauthorizedError> => ({
  ...createError(
    ERROR_CODE['SECURITY_UNAUTHORIZED'] as ErrorCode,
    context.reason ?? 'Unauthorized',
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / security logic
      ...(context.userId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.userId !== undefined && { userId: context.userId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createSecurityMetadata()
    }
  ),
  _tag: "Unauthorized" as const,
  ...(context.reason !== undefined && { reason: context.reason }),
  ...(context.userId !== undefined && { userId: context.userId }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<UnauthorizedError>
/** Создает Forbidden ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createForbiddenError = (
  context: ForbiddenContext
): ReadonlyDeep<ForbiddenError> => ({
  ...createError(
    ERROR_CODE['SECURITY_FORBIDDEN'] as ErrorCode,
    `Forbidden: ${context.action} on ${context.resource}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / security logic
      ...(context.userId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.userId !== undefined && { userId: context.userId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createSecurityMetadata()
    }
  ),
  _tag: "Forbidden" as const,
  resource: context.resource,
  action: context.action,
  ...(context.userId !== undefined && { userId: context.userId }),
  ...(context.requiredPermission !== undefined && { requiredPermission: context.requiredPermission }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<ForbiddenError>
/** Создает TokenExpired ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createTokenExpiredError = (
  context: TokenExpiredContext
): ReadonlyDeep<TokenExpiredError> => ({
  ...createError(
    ERROR_CODE['SECURITY_TOKEN_EXPIRED'] as ErrorCode,
    `Token expired${context.tokenType !== undefined ? ` (${context.tokenType})` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / security logic
      ...(context.userId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.userId !== undefined && { userId: context.userId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createSecurityMetadata()
    }
  ),
  _tag: "TokenExpired" as const,
  ...(context.tokenType !== undefined && { tokenType: context.tokenType }),
  ...(context.userId !== undefined && { userId: context.userId }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<TokenExpiredError>
/** Создает RateLimited ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createRateLimitedError = (
  context: RateLimitedContext
): ReadonlyDeep<RateLimitedError> => ({
  ...createError(
    ERROR_CODE['SECURITY_RATE_LIMITED'] as ErrorCode,
    `Rate limit exceeded: ${context.limit} requests per ${context.windowMs}ms${context.endpoint !== undefined ? ` on ${context.endpoint}` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / security logic
      ...(context.userId !== undefined || context.correlationId !== undefined ? {
        context: {
          ...(context.userId !== undefined && { userId: context.userId }),
          ...(context.correlationId !== undefined && { correlationId: context.correlationId })
        }
      } : undefined),
      extra: createSecurityMetadata()
    }
  ),
  _tag: "RateLimited" as const,
  limit: context.limit,
  windowMs: context.windowMs,
  ...(context.userId !== undefined && { userId: context.userId }),
  ...(context.endpoint !== undefined && { endpoint: context.endpoint }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<RateLimitedError>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Pattern matching (exhaustive)
 * ------------------------------------------------------------------------------------------------- */
/** Exhaustive pattern matching для security ошибок. TypeScript гарантирует compile-time exhaustiveness через type narrowing. Если ADT вырастет (добавится новый _tag), компилятор покажет ошибку компиляции. */
export const matchSecurityError = <T>(
  error: Readonly<SecurityError>,
  handlers: Readonly<{
    unauthorized: (e: ReadonlyDeep<UnauthorizedError>) => T
    forbidden: (e: ReadonlyDeep<ForbiddenError>) => T
    tokenExpired: (e: ReadonlyDeep<TokenExpiredError>) => T
    rateLimited: (e: ReadonlyDeep<RateLimitedError>) => T
  }>
): T =>
  error._tag === "Unauthorized" ? handlers.unauthorized(error) :
  error._tag === "Forbidden" ? handlers.forbidden(error) :
  error._tag === "TokenExpired" ? handlers.tokenExpired(error) :
  handlers.rateLimited(error)
/* -------------------------------------------------------------------------------------------------
 * 🔹 Операционные helpers (retryable/recoverable)
 * ------------------------------------------------------------------------------------------------- */
/**
 * Проверяет, можно ли автоматически повторить операцию при возникновении security ошибки.
 * Полезно для rate-limited scenarios (автоматический retry после истечения окна).
 * @param error - security ошибка
 * @returns true если операция может быть повторена автоматически, false иначе
 */
export const isRetryable = (error: Readonly<SecurityError>): boolean =>
  isSecurityErrorRetryable(error)
/**
 * Проверяет, можно ли восстановить доступ вручную или через бизнес-процесс.
 * Полезно для token refresh scenarios (автоматический refresh токена).
 * @param error - security ошибка
 * @returns true если доступ можно восстановить, false иначе
 */
export const isRecoverable = (error: Readonly<SecurityError>): boolean =>
  isSecurityErrorRecoverable(error)
