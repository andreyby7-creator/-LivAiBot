/**
 * @file ValidationError. Validation ADT поверх Error Kernel
 * Типобезопасный ADT validation failures. Validation слой (input validation, schema validation).
 * Использует BaseError, discriminated unions, smart constructors, local Either.
 * Semver: новый _tag = MINOR, изменение payload = MAJOR
 *
 * ⚠️ Architectural invariant:
 * Validation слой является частью Application слоя (ERROR_ORIGIN.APPLICATION, ERROR_CATEGORY.VALIDATION).
 * Отвечает за валидацию входных данных и схем.
 * Может интерпретировать operational metadata (recoverable для исправления пользователем),
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
/** Type guard для проверки Left значения Either. Полезно для validation-heavy логики. */
export const isLeft = <E, A>(e: Either<E, A>): e is { _tag: 'Left'; left: E } => e._tag === 'Left'
/** Type guard для проверки Right значения Either. Полезно для validation-heavy логики. */
export const isRight = <E, A>(e: Either<E, A>): e is { _tag: 'Right'; right: A } => e._tag === 'Right'
/** Преобразует значение в Either через функцию (map). Если Left - возвращает ошибку без изменений. Полезно для validation-heavy flows (chaining validators). */
export const mapVal = <E, A, B>(
  either: Either<E, A>,
  f: (a: A) => B
): Either<E, B> =>
  isRight(either) ? right(f(either.right)) : either as Either<E, B>
/** Преобразует значение в Either через функцию, возвращающую Either (flatMap/bind). Если Left - возвращает ошибку без изменений. Полезно для validation-heavy flows (chaining validators). */
export const flatMapVal = <E, A, B>(
  either: Either<E, A>,
  f: (a: A) => Either<E, B>
): Either<E, B> =>
  isRight(either) ? f(either.right) : either as Either<E, B>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Validation контексты (type-safe)
 * ------------------------------------------------------------------------------------------------- */
/** Контекст для ошибок валидации */
export type ValidationFailedContext = ReadonlyDeep<{
  field?: string
  value?: unknown
  reason?: string
  violations?: ReadonlyArray<ReadonlyDeep<{ field: string; message: string }>>
  schemaName?: string
  correlationId?: string
}>
/** Контекст для ошибок несоответствия схемы */
export type SchemaMismatchContext = ReadonlyDeep<{
  expected: string
  actual: string
  path?: string
  schemaName?: string
  correlationId?: string
}>
/** Контекст для ошибок отсутствующих обязательных полей */
export type RequiredFieldMissingContext = ReadonlyDeep<{
  field: string
  expectedType?: string
  schemaName?: string
  correlationId?: string
}>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Validation метаданные (хранятся в BaseError.extra)
 * ------------------------------------------------------------------------------------------------- */
/** Validation-специфичные метаданные в BaseError.extra */
export type ValidationErrorMetadata = ReadonlyDeep<{
  validationVersion?: string
  /** Имя схемы валидации */
  schemaName?: string
  /** Timestamp для observability (ISO string) */
  timestamp?: string
}>
/** Константа версии пакета для observability. Может быть заменена при сборке через build-time injection. */
const PACKAGE_VERSION = '1.0.0'
/** Конструктор validation метаданных с defaults. Всегда устанавливает validationVersion и timestamp для observability. */
export const createValidationMetadata = (
  overrides?: Readonly<Partial<ValidationErrorMetadata>>
): ValidationErrorMetadata => ({
  validationVersion: PACKAGE_VERSION,
  timestamp: new Date().toISOString(),
  ...overrides
})
/* -------------------------------------------------------------------------------------------------
 * 🔹 ADT Validation ошибок
 * ------------------------------------------------------------------------------------------------- */
/** Ошибка "Валидация не прошла" */
export type ValidationFailedError = BaseError & {
  _tag: "ValidationFailed"
  field?: string
  value?: unknown
  reason?: string
  violations?: ReadonlyArray<ReadonlyDeep<{ field: string; message: string }>>
  correlationId?: string
}
/** Ошибка "Несоответствие схемы" */
export type SchemaMismatchError = BaseError & {
  _tag: "SchemaMismatch"
  expected: string
  actual: string
  path?: string
  correlationId?: string
}
/** Ошибка "Отсутствует обязательное поле" */
export type RequiredFieldMissingError = BaseError & {
  _tag: "RequiredFieldMissing"
  field: string
  expectedType?: string
  correlationId?: string
}

/** Полный ADT validation ошибок. Exhaustive by design */
export type ValidationError =
  | ValidationFailedError
  | SchemaMismatchError
  | RequiredFieldMissingError
/* -------------------------------------------------------------------------------------------------
 * 🔹 Smart constructors (умные конструкторы)
 * ------------------------------------------------------------------------------------------------- */
/** Утилита для построения BaseError.context из correlationId. Возвращает undefined если correlationId отсутствует. */
const buildContext = (correlationId?: string): ReadonlyDeep<{ context: { correlationId: string } }> | undefined =>
  correlationId !== undefined ? { context: { correlationId } } as ReadonlyDeep<{ context: { correlationId: string } }> : undefined
/** Создает ValidationFailed ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createValidationFailedError = (
  context: ValidationFailedContext
): ReadonlyDeep<ValidationFailedError> => ({
  ...createError(
    ERROR_CODE['VALIDATION_FAILED'] as ErrorCode,
    context.reason ?? (context.field !== undefined ? `Validation failed for field '${context.field}'` : 'Validation failed'),
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / validation logic
      ...buildContext(context.correlationId),
      extra: createValidationMetadata({
        ...(context.schemaName !== undefined && { schemaName: context.schemaName })
      })
    }
  ),
  _tag: "ValidationFailed" as const,
  ...(context.field !== undefined && { field: context.field }),
  ...(context.value !== undefined && { value: context.value }),
  ...(context.reason !== undefined && { reason: context.reason }),
  ...(context.violations !== undefined && { violations: context.violations }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<ValidationFailedError>
/** Создает SchemaMismatch ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createSchemaMismatchError = (
  context: SchemaMismatchContext
): ReadonlyDeep<SchemaMismatchError> => ({
  ...createError(
    ERROR_CODE['VALIDATION_SCHEMA_MISMATCH'] as ErrorCode,
    `Schema mismatch: expected ${context.expected}, got ${context.actual}${context.path !== undefined ? ` at ${context.path}` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / validation logic
      ...buildContext(context.correlationId),
      extra: createValidationMetadata({
        ...(context.schemaName !== undefined && { schemaName: context.schemaName })
      })
    }
  ),
  _tag: "SchemaMismatch" as const,
  expected: context.expected,
  actual: context.actual,
  ...(context.path !== undefined && { path: context.path }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<SchemaMismatchError>
/** Создает RequiredFieldMissing ошибку. Метаданные автоматически берутся из ERROR_CODE_META. */
export const createRequiredFieldMissingError = (
  context: RequiredFieldMissingContext
): ReadonlyDeep<RequiredFieldMissingError> => ({
  ...createError(
    ERROR_CODE['VALIDATION_REQUIRED_FIELD_MISSING'] as ErrorCode,
    `Required field '${context.field}' is missing${context.expectedType !== undefined ? ` (expected type: ${context.expectedType})` : ''}`,
    {
      // correlationId хранится в BaseError.context для tracing middleware
      // Также дублируется в ADT payload для pattern matching / validation logic
      ...buildContext(context.correlationId),
      extra: createValidationMetadata({
        ...(context.schemaName !== undefined && { schemaName: context.schemaName })
      })
    }
  ),
  _tag: "RequiredFieldMissing" as const,
  field: context.field,
  ...(context.expectedType !== undefined && { expectedType: context.expectedType }),
  ...(context.correlationId !== undefined && { correlationId: context.correlationId })
}) as ReadonlyDeep<RequiredFieldMissingError>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Pattern matching (exhaustive)
 * ------------------------------------------------------------------------------------------------- */
/** Exhaustive pattern matching для validation ошибок. TypeScript гарантирует compile-time exhaustiveness через type narrowing. Если ADT вырастет (добавится новый _tag), компилятор покажет ошибку компиляции. */
export const matchValidationError = <T>(
  error: Readonly<ValidationError>,
  handlers: Readonly<{
    validationFailed: (e: ReadonlyDeep<ValidationFailedError>) => T
    schemaMismatch: (e: ReadonlyDeep<SchemaMismatchError>) => T
    requiredFieldMissing: (e: ReadonlyDeep<RequiredFieldMissingError>) => T
  }>
): T =>
  error._tag === "ValidationFailed"
    ? handlers.validationFailed(error)
    : error._tag === "SchemaMismatch"
      ? handlers.schemaMismatch(error)
      : handlers.requiredFieldMissing(error)

