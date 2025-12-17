/**
 * @file DomainError. Domain ADT поверх Error Kernel
 * Типобезопасный ADT domain failures. Чистый DDD + FP без инфраструктуры.
 * Использует BaseError, discriminated unions, smart constructors, local Either.
 * Semver: новый _tag = MINOR, изменение payload = MAJOR
 */
import { createError, type BaseError } from "../base/BaseError.js"
import { ERROR_CODE, type ErrorCode } from "../base/ErrorCode.js"

import type { ReadonlyDeep } from "type-fest"
// Minimal local Either (no dependency on fp libs)
export type EitherTag = 'Left' | 'Right'
export type Either<E, A> = Readonly<{ _tag: 'Left'; left: E }> | Readonly<{ _tag: 'Right'; right: A }>
export const left = <E>(e: E): Either<E, never> => ({ _tag: 'Left', left: e })
export const right = <A>(a: A): Either<never, A> => ({ _tag: 'Right', right: a })

/* -------------------------------------------------------------------------------------------------
 * 🔹 Domain контексты (type-safe)
 * ------------------------------------------------------------------------------------------------- */

/** Допустимые операции в domain слое */
export type DomainOperation =
  | "create"
  | "update"
  | "delete"
  | "read"
  | "transition"
/** Контекст для ошибок сущностей */
export type EntityContext = ReadonlyDeep<{
  entityType: string
  entityId: string | number
  operation?: DomainOperation
}>
/** Контекст для нарушений бизнес-правил */
export type BusinessRuleContext = ReadonlyDeep<{
  ruleName: string
  violatedFields?: ReadonlyArray<string>
}>
/** Контекст для ошибок валидации */
export type ValidationContext = ReadonlyDeep<{
  field: string
  value: unknown
  constraint: string
}>
/** Контекст для недопустимых переходов состояний */
export type StateTransitionContext = ReadonlyDeep<{
  from: string
  to: string
  allowed: ReadonlyArray<StateTransitionKey>
}>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Domain метаданные (хранятся в BaseError.extra)
 * ------------------------------------------------------------------------------------------------- */
/** Именованные доменные контексты для типобезопасной классификации ошибок */
export type DomainContextName =
  | 'ordering'
  | 'billing'
  | 'inventory'
  | 'catalog'
  | 'shipping'
  | 'customer'
  | 'payment'
  | 'notification'
/** Domain-специфичные метаданные в BaseError.extra */
export type DomainErrorMetadata = ReadonlyDeep<{
  domainVersion: string
  domainContext: DomainContextName
  workflowStep?: string
  businessUnit?: string
}>
/**
 * Конструктор domain метаданных с defaults.
 * @param overrides - переопределения (могут перезаписать domainVersion и domainContext)
 */
export const createDomainMetadata = (
  overrides?: Readonly<Partial<DomainErrorMetadata>>
): DomainErrorMetadata => ({
  domainVersion: "1.0",
  domainContext: "ordering",
  ...overrides
})
/* -------------------------------------------------------------------------------------------------
 * 🔹 ADT Domain ошибок
 * ------------------------------------------------------------------------------------------------- */
/** Ошибка "Сущность не найдена" */
export type EntityNotFoundError = BaseError & {
  _tag: "EntityNotFound"
  entityType: string
  entityId: string | number
}
/** Ошибка "Нарушение бизнес-правила" */
export type BusinessRuleViolationError = BaseError & {
  _tag: "BusinessRuleViolation"
  ruleName: string
  violatedFields?: ReadonlyArray<string>
}
/** Ошибка "Нарушение domain инварианта" */
export type DomainInvariantBrokenError = BaseError & {
  _tag: "DomainInvariantBroken"
  invariant: string
}
/** Ошибка валидации */
export type ValidationError = BaseError & {
  _tag: "Validation"
  field: string
  constraint: string
}
/** Ключ перехода состояний в формате "from->to" */
export type StateTransitionKey = `${string}->${string}`
/** Ошибка недопустимого перехода состояний */
export type StateTransitionError = BaseError & {
  _tag: "StateTransition"
  from: string
  to: string
  allowed: ReadonlyArray<StateTransitionKey>
}

/** Полный ADT domain ошибок. Exhaustive by design */
export type DomainError =
  | EntityNotFoundError
  | BusinessRuleViolationError
  | DomainInvariantBrokenError
  | ValidationError
  | StateTransitionError
/* -------------------------------------------------------------------------------------------------
 * 🔹 Smart constructors (умные конструкторы)
 * ------------------------------------------------------------------------------------------------- */
/** Создает EntityNotFound ошибку. Метаданные автоматически берутся из ERROR_CODE_META. @param context - контекст сущности */
export const createEntityNotFoundError = (
  context: EntityContext
): ReadonlyDeep<EntityNotFoundError> => ({
  ...createError(
    ERROR_CODE['DOMAIN_ENTITY_NOT_FOUND'] as ErrorCode,
    `${context.entityType} with ID ${context.entityId} not found`,
    {
      ...(context.operation !== undefined && { context: { operation: context.operation } }),
      extra: createDomainMetadata()
    }
  ),
  _tag: "EntityNotFound" as const,
  entityType: context.entityType,
  entityId: context.entityId
}) as ReadonlyDeep<EntityNotFoundError>
/**
 * Создает BusinessRuleViolation ошибку.
 * Метаданные автоматически берутся из ERROR_CODE_META.
 * @param ruleName - название правила (источник истины)
 * @param message - сообщение об ошибке
 * @param context - контекст нарушения (ruleName, violatedFields)
 */
export const createBusinessRuleViolationError = (
  ruleName: string,
  message: string,
  context?: BusinessRuleContext
): ReadonlyDeep<BusinessRuleViolationError> => ({
  ...createError(
    ERROR_CODE['DOMAIN_RULE_VIOLATION'] as ErrorCode,
    message,
    {
      context: { ruleName, ...context },
      extra: createDomainMetadata()
    }
  ),
  _tag: "BusinessRuleViolation" as const,
  ruleName,
  ...(context?.violatedFields !== undefined && { violatedFields: context.violatedFields })
}) as ReadonlyDeep<BusinessRuleViolationError>
/**
 * Создает DomainInvariantBroken ошибку.
 * Метаданные автоматически берутся из ERROR_CODE_META.
 * @param invariant - название нарушенного инварианта
 * @param message - сообщение об ошибке
 */
export const createDomainInvariantBrokenError = (
  invariant: string,
  message: string
): ReadonlyDeep<DomainInvariantBrokenError> => ({
  ...createError(
    ERROR_CODE['DOMAIN_INVARIANT_BROKEN'] as ErrorCode,
    message,
    {
      extra: createDomainMetadata()
    }
  ),
  _tag: "DomainInvariantBroken" as const,
  invariant
}) as ReadonlyDeep<DomainInvariantBrokenError>
/**
 * Создает Validation ошибку.
 * Метаданные автоматически берутся из ERROR_CODE_META.
 * @param context - контекст валидации (field, value, constraint)
 */
export const createValidationError = (
  context: ValidationContext
): ReadonlyDeep<ValidationError> => ({
  ...createError(
    ERROR_CODE['VALIDATION_FAILED'] as ErrorCode,
    `Validation failed for field '${context.field}'`,
    {
      context: { value: context.value },
      extra: createDomainMetadata()
    }
  ),
  _tag: "Validation" as const,
  field: context.field,
  constraint: context.constraint
}) as ReadonlyDeep<ValidationError>
/** Создает StateTransition ошибку. Метаданные автоматически берутся из ERROR_CODE_META. @param context - контекст перехода */
export const createStateTransitionError = (
  context: StateTransitionContext
): ReadonlyDeep<StateTransitionError> => ({
  ...createError(
    ERROR_CODE['DOMAIN_INVALID_STATE'] as ErrorCode,
    `Invalid state transition: ${context.from} → ${context.to}`,
    {
      extra: createDomainMetadata()
    }
  ),
  _tag: "StateTransition" as const,
  from: context.from,
  to: context.to,
  allowed: context.allowed
}) as ReadonlyDeep<StateTransitionError>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Pattern matching (exhaustive)
 * ------------------------------------------------------------------------------------------------- */
/**
 * Exhaustive pattern matching для domain ошибок.
 * TypeScript гарантирует compile-time exhaustiveness через type narrowing.
 * @param error - domain ошибка для обработки
 * @param handlers - обработчики для каждого типа ошибки
 * @returns результат обработки соответствующего типа
 */
export const matchDomainError = <T>(
  error: Readonly<DomainError>,
  handlers: Readonly<{
    entityNotFound: (e: ReadonlyDeep<EntityNotFoundError>) => T
    businessRuleViolation: (e: ReadonlyDeep<BusinessRuleViolationError>) => T
    domainInvariantBroken: (e: ReadonlyDeep<DomainInvariantBrokenError>) => T
    validation: (e: ReadonlyDeep<ValidationError>) => T
    stateTransition: (e: ReadonlyDeep<StateTransitionError>) => T
  }>
): T =>
  error._tag === "EntityNotFound" ? handlers.entityNotFound(error) :
  error._tag === "BusinessRuleViolation" ? handlers.businessRuleViolation(error) :
  error._tag === "DomainInvariantBroken" ? handlers.domainInvariantBroken(error) :
  error._tag === "Validation" ? handlers.validation(error) :
  handlers.stateTransition(error)
/* -------------------------------------------------------------------------------------------------
 * 🔹 Domain validation helpers (FP)
 * ------------------------------------------------------------------------------------------------- */
/**
 * Генерирует ключ перехода состояний в формате "from->to".
 * Используется для проверки допустимости переходов в validateStateTransition.
 * @param from - исходное состояние
 * @param to - целевое состояние
 * @returns StateTransitionKey в формате "from->to"
 */
export const createStateTransitionKey = (
  from: string,
  to: string
): StateTransitionKey => `${from}->${to}`
/**
 * Проверяет существование сущности.
 * Возвращает Either с EntityNotFoundError, если сущность отсутствует.
 * @param entity - сущность для проверки (может быть null или undefined)
 * @param context - контекст сущности (entityType, entityId, operation)
 * @returns Either с EntityNotFoundError или валидной сущностью
 */
export const validateEntityExists = <T>(
  entity: T | null | undefined,
  context: EntityContext
): Either<ReadonlyDeep<EntityNotFoundError>, T> =>
  entity == null
    ? left(createEntityNotFoundError(context))
    : right(entity)
/**
 * Проверяет бизнес-правило.
 * Возвращает Either с BusinessRuleViolationError, если правило нарушено.
 * @param value - значение для проверки
 * @param rule - предикат правила (возвращает true если правило соблюдено)
 * @param ruleName - название правила (источник истины)
 * @param message - сообщение об ошибке при нарушении
 * @param context - дополнительный контекст нарушения (violatedFields)
 * @returns Either с BusinessRuleViolationError или валидным значением
 */
export const validateBusinessRule = <T>(
  value: T,
  rule: (value: T) => boolean,
  ruleName: string,
  message: string,
  context?: BusinessRuleContext
): Either<ReadonlyDeep<BusinessRuleViolationError>, T> =>
  rule(value)
    ? right(value)
    : left(createBusinessRuleViolationError(ruleName, message, context))
/**
 * Проверяет допустимость перехода состояний.
 * Использует createStateTransitionKey для генерации ключа перехода.
 * Возвращает Either с StateTransitionError, если переход недопустим.
 * @param current - текущее состояние сущности
 * @param target - целевое состояние для перехода
 * @param allowed - массив допустимых переходов (StateTransitionKey[])
 * @returns Either с StateTransitionError или void при успешной проверке
 */
export const validateStateTransition = (
  current: string,
  target: string,
  allowed: ReadonlyArray<StateTransitionKey>
): Either<ReadonlyDeep<StateTransitionError>, void> =>
  allowed.includes(createStateTransitionKey(current, target))
    ? right(undefined)
    : left(
        createStateTransitionError({
          from: current,
          to: target,
          allowed
        })
      )
