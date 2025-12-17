/**
 * @file ErrorUtils — чистые утилиты для работы с BaseError
 *
 * ✅ FP-совместимо: pure functions, immutability, type-level safety
 * ✅ Extensible: легко добавлять новые утилиты и слои ошибок
 * ✅ Safe: полностью type-safe, безопасные get/set и cause chain
 * ✅ Consistent: единая архитектура с BaseError, ErrorMetadata и ErrorConstants
 */
// Enum-like frozen constants objects (NOT TypeScript enums) - see ErrorConstants.ts for details
import { ERROR_CODE } from "./ErrorCode.js"
import { ERROR_ORIGIN, ERROR_SEVERITY, ERROR_CATEGORY, isErrorSeverity, isErrorCategory, isErrorOrigin } from "./ErrorConstants.js"

import type { BaseError } from "./BaseError.js"
import type { ErrorCode } from "./ErrorCode.js"
import type { ErrorSeverity, ErrorCategory, ErrorOrigin } from "./ErrorConstants.js"
import type { ErrorMetadata } from "./ErrorMetadata.js"
import type { ReadonlyDeep } from "type-fest"
/* -------------------------------------------------------------------------------------------------
 * 🔹 Deep Freeze Utility (Runtime Immutability)
 * ------------------------------------------------------------------------------------------------- */
/** Глубокий freeze для иммутабельности объектов. Гарантирует полную неизменяемость вложенных структур. */
export const deepFreeze = <T>(obj: T): ReadonlyDeep<T> => {
  Object.freeze(obj)
  const freezeNested = (o: T): ReadonlyDeep<T> => {
    return o !== null && typeof o === 'object'
      ? (Object.getOwnPropertyNames(o).forEach(key => {
          const value = (o as ReadonlyDeep<Record<string, unknown>>)[key]
          return value !== null && typeof value === 'object' && !Object.isFrozen(value)
            ? deepFreeze(value)
            : undefined
        }),
        o as ReadonlyDeep<T>)
      : o as ReadonlyDeep<T>
  }
  return freezeNested(obj)
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 BaseError Type Guards and Helpers
 * ------------------------------------------------------------------------------------------------- */
/** Проверка, что значение является валидным ErrorCode */
const isErrorCodeValid = (value: unknown): value is ErrorCode =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_CODE, value)
/** Helper для проверки опционального строкового поля */
const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string"
/** Helper для проверки опционального булевого поля */
const isOptionalBoolean = (value: unknown): boolean => value === undefined || typeof value === "boolean"
/** Helper для проверки опционального объекта */
const isOptionalObject = (value: unknown): boolean => value === undefined || typeof value === "object"
/** Helper для проверки опционального поля через type guard */
const isOptionalByGuard = <T>(value: unknown, guard: (v: unknown) => v is T): boolean => value === undefined || guard(value)

/**
 * Проверка, что объект является BaseError
 * Использует рекурсивную проверку для cause chain, чтобы обеспечить точную типизацию.
 * Использует существующие type guards для severity, category, origin для избежания дублирования.
 */
export const isBaseError = (value: unknown): value is ReadonlyDeep<BaseError> => {
  const v: Readonly<Record<string, unknown>> | null = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null
  return v !== null &&
         // Обязательные поля
         isErrorCodeValid(v["code"]) &&
         typeof v["message"] === "string" &&
         typeof v["timestamp"] === "string" &&
         // Опциональные поля из ErrorMetadata
         isOptionalString(v["correlationId"]) &&
         isOptionalObject(v["context"]) &&
         isOptionalString(v["localizedMessage"]) &&
         // Проверка cause: BaseError | Error | undefined с рекурсивной проверкой BaseError
         (v["cause"] === undefined || v["cause"] instanceof Error || isBaseError(v["cause"])) &&
         isOptionalByGuard(v["severity"], isErrorSeverity) &&
         isOptionalByGuard(v["category"], isErrorCategory) &&
         isOptionalString(v["tenantId"]) &&
         isOptionalBoolean(v["retryable"]) &&
         isOptionalByGuard(v["origin"], isErrorOrigin) &&
         isOptionalObject(v["extra"])
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Type Guards по слоям (Layer-specific Type Guards)
 * ------------------------------------------------------------------------------------------------- */
/** Создает type guard для проверки ошибок определенного слоя по префиксу кода. Использует generic constraint для сохранения точного типа префикса. */
const createLayerGuard = <P extends string>(prefix: P): ((error: unknown) => error is ReadonlyDeep<BaseError>) =>
  (error: unknown): error is ReadonlyDeep<BaseError> =>
    typeof error === "object" && error !== null &&
    ((): boolean => {
      const e = error as Readonly<Record<"code", unknown>>
      return typeof e.code === "string" && e.code.startsWith(prefix)
    })()
/** Проверяет, является ли ошибка Domain ошибкой (бизнес-логика) */
export const isDomainError = createLayerGuard("DOMAIN_")
/** Проверяет, является ли ошибка Application ошибкой (оркестрация use-case) */
export const isApplicationError = createLayerGuard("APPLICATION_")
/** Проверяет, является ли ошибка Infrastructure ошибкой (IO, network, DB) */
export const isInfrastructureError = createLayerGuard("INFRA_")
/** Проверяет, является ли ошибка Security ошибкой (auth, permissions) */
export const isSecurityError = createLayerGuard("SECURITY_")
/** Проверяет, является ли ошибка Validation ошибкой (входные данные) */
export const isValidationError = createLayerGuard("VALIDATION_")
/* -------------------------------------------------------------------------------------------------
 * 🔹 Helper функции для работы с метаданными (Metadata Helpers)
 * ------------------------------------------------------------------------------------------------- */
/** Проверяет, имеет ли ошибка correlationId для трейсинга. ⚠️ Пустая строка "" НЕ считается валидным. */
export const hasCorrelationId = (error: ReadonlyDeep<BaseError>): boolean =>
  typeof error.correlationId === "string" && error.correlationId.length > 0
/** Проверяет, имеет ли ошибка tenantId (multi-tenant поддержка). ⚠️ Пустая строка "" НЕ считается валидным. */
export const hasTenantId = (error: ReadonlyDeep<BaseError>): boolean =>
  typeof error.tenantId === "string" && error.tenantId.length > 0
/** Проверяет, можно ли повторить операцию после этой ошибки */
export const isRetryable = (error: ReadonlyDeep<BaseError>): boolean =>
  error.retryable === true
/** Проверяет, имеет ли ошибка cause (цепочку причин). ⚠️ Использует `!= null` для проверки undefined и null. */
export const hasCause = (error: ReadonlyDeep<BaseError>): boolean =>
  error.cause != null
/** Получает уровень серьезности ошибки с fallback на 'medium' */
export const getErrorSeverity = (error: ReadonlyDeep<BaseError>): ErrorSeverity =>
  error.severity !== undefined && isErrorSeverity(error.severity) 
    ? error.severity 
    : ('medium' as ErrorSeverity)
/** Получает категорию ошибки с fallback на 'unknown' */
export const getErrorCategory = (error: ReadonlyDeep<BaseError>): ErrorCategory =>
  error.category !== undefined && isErrorCategory(error.category)
    ? error.category
    : ('unknown' as ErrorCategory)
/** Получает происхождение ошибки с fallback на 'application' */
export const getErrorOrigin = (error: ReadonlyDeep<BaseError>): ErrorOrigin =>
  error.origin !== undefined && isErrorOrigin(error.origin)
    ? error.origin
    : ('application' as ErrorOrigin)
/** Проверяет, требует ли ошибка алерта (HIGH или CRITICAL) - для observability и SRE automation */
export const requiresAlert = (error: ReadonlyDeep<BaseError>): boolean => {
  const severity = getErrorSeverity(error)
  return severity === ERROR_SEVERITY['CRITICAL'] || severity === ERROR_SEVERITY['HIGH']
}
/** Проверяет, должна ли ошибка блокировать deployment (CRITICAL) - для CI/CD pipelines */
export const shouldBlockDeployment = (error: ReadonlyDeep<BaseError>): boolean =>
  getErrorSeverity(error) === ERROR_SEVERITY['CRITICAL']
/** Получает приоритет ошибки для сортировки и очередей (CRITICAL=100, HIGH=80, MEDIUM=50, LOW=10) */
export const getErrorPriority = (error: ReadonlyDeep<BaseError>): number => {
  // Если severity присутствует, но не валиден - возвращаем 0
  // Используем тернарный оператор вместо if для соответствия функциональным правилам
  return error.severity !== undefined && !isErrorSeverity(error.severity)
    ? 0
    : ((): number => {
        // Используем getErrorSeverity для получения severity (с fallback на 'medium' если отсутствует)
        const severity = getErrorSeverity(error)
        return severity === ERROR_SEVERITY['CRITICAL']
          ? 100
          : severity === ERROR_SEVERITY['HIGH']
            ? 80
            : severity === ERROR_SEVERITY['MEDIUM']
              ? 50
              : severity === ERROR_SEVERITY['LOW']
                ? 10
                : 0
      })()
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для работы с cause chain (Cause Chain Utilities)
 * ------------------------------------------------------------------------------------------------- */
/**
 * Получает цепочку причин ошибки (от текущей ошибки к корневой причине)
 *
 * Использует tail-recursive подход с аккумулятором (чистый FP, без мутаций).
 * Для практических случаев (до 10 элементов) аллокации на каждом шаге приемлемы.
 * Если понадобится оптимизация для очень длинных цепочек (>100), можно использовать
 * локальный mutable массив (encapsulated mutation), но текущая реализация чище.
 *
 * @param error - исходная ошибка
 * @param maxDepth - максимальная глубина цепочки (по умолчанию 10)
 * @returns массив причин в порядке от текущей к корневой
 */
export const getCauseChain = (
  error: ReadonlyDeep<BaseError>,
  maxDepth = 10
): ReadonlyArray<unknown> => {
  const buildChain = (
    acc: ReadonlyArray<unknown>,
    current: unknown,
    depth: number
  ): ReadonlyArray<unknown> =>
    current == null || depth >= maxDepth
      ? acc
      : buildChain(
          [...acc, current],
          typeof current === "object" && "cause" in current
            ? (current as { cause?: unknown }).cause
            : undefined,
          depth + 1
        )
  return buildChain([], error.cause, 0)
}
/** Получает корневую причину ошибки (самую глубокую). Оптимизированная версия: не создает полный массив цепочки. */
export const getRootCause = (
  error: ReadonlyDeep<BaseError>,
  maxDepth = 10
): unknown => {
  const findRoot = (current: unknown, depth: number): unknown =>
    current == null || depth >= maxDepth
      ? current ?? undefined
      : ((): unknown => {
          const next = typeof current === "object" && "cause" in current
            ? (current as { cause?: unknown }).cause
            : undefined
          return next != null ? findRoot(next, depth + 1) : current
        })()
  return findRoot(error.cause, 0)
}
/** Получает N-ю причину в цепочке (0 = первая cause). Оптимизированная версия: не создает полный массив цепочки. */
export const getNthCause = (
  error: ReadonlyDeep<BaseError>,
  n: number
): unknown =>
  n < 0
    ? undefined
    : ((): unknown => {
        const findNth = (current: unknown, index: number): unknown =>
          current == null
            ? undefined
            : index === n
              ? current
              : ((): unknown => {
                  const next = typeof current === "object" && "cause" in current
                    ? (current as { cause?: unknown }).cause
                    : undefined
                  return next != null ? findNth(next, index + 1) : undefined
                })()
        return findNth(error.cause, 0)
      })()
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для фильтрации и поиска (Filtering & Searching)
 * ------------------------------------------------------------------------------------------------- */
/** Фильтрует массив ошибок по уровню серьезности */
export const filterErrorsBySeverity = <T extends ReadonlyDeep<BaseError>>(
  errors: ReadonlyArray<T>,
  severity: ErrorSeverity
): ReadonlyArray<T> =>
  errors.filter((error) => getErrorSeverity(error) === severity)
/** Фильтрует массив ошибок по категории */
export const filterErrorsByCategory = <T extends ReadonlyDeep<BaseError>>(
  errors: ReadonlyArray<T>,
  category: ErrorCategory
): ReadonlyArray<T> =>
  errors.filter((error) => getErrorCategory(error) === category)
/** Находит ошибку по коду в массиве ошибок */
export const findErrorByCode = <T extends ReadonlyDeep<BaseError>>(
  errors: ReadonlyArray<T>,
  code: string
): T | undefined =>
  errors.find(error => error.code === code)
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для трансформации (Transformation Utilities)
 * ------------------------------------------------------------------------------------------------- */
/** Сериализуемое представление ошибки для логов/мониторинга. Не содержит cause (избегает циклов). */
export type SerializableError = Readonly<Record<string, unknown>>
/** Преобразует ошибку в сериализуемый объект для логов/мониторинга. Возвращает Readonly (не ReadonlyDeep). */
export const toSerializableError = (
  error: ReadonlyDeep<BaseError>
): SerializableError => ({
  code: error.code,
  message: error.message,
  timestamp: error.timestamp,
  ...(error['correlationId'] != null && { correlationId: error['correlationId'] }),
  ...(error['context'] != null && { context: error['context'] }),
  ...(error['localizedMessage'] != null && { localizedMessage: error['localizedMessage'] }),
  ...(error['severity'] != null && { severity: error['severity'] }),
  ...(error['category'] != null && { category: error['category'] }),
  ...(error['tenantId'] != null && { tenantId: error['tenantId'] }),
  ...(error['retryable'] !== undefined && { retryable: error['retryable'] }),
  ...(error['origin'] != null && { origin: error['origin'] }),
  ...(error['extra'] != null && { extra: error['extra'] }),
  // cause опускаем для избежания циклов
  ...(hasCause(error) && { hasCause: true })
})
/** Создает безопасную версию ошибки без sensitive данных (по умолчанию удаляет password, token, secret, key) */
export const sanitizeError = (
  error: ReadonlyDeep<BaseError>,
  sensitiveKeys: ReadonlyArray<string> = ["password", "token", "secret", "key"]
): ReadonlyDeep<BaseError> =>
  !error.context
    ? error
    : {
        ...error,
        // local freeze: safe, object created here - дополнительная runtime защита для newly created context
        context: Object.freeze(
          Object.fromEntries(
            (Object.entries(error.context) as ReadonlyArray<readonly [string, unknown]>).filter(
              ([key]) => !sensitiveKeys.includes(key)
            )
          )
        )
      }
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для сравнения (Comparison Utilities)
 * ------------------------------------------------------------------------------------------------- */
/** Проверяет, равны ли две ошибки по identity (коду). ⚠️ Сравнивает только code, так как message - это presentation. Если нужно сравнить и по message, используйте hasSameCodeAndMessage. */
export const areErrorsEqual = (
  error1: ReadonlyDeep<BaseError>,
  error2: ReadonlyDeep<BaseError>
): boolean =>
  error1.code === error2.code
/** Проверяет, равны ли две ошибки по коду и сообщению. ⚠️ Используйте с осторожностью: message может быть локализовано. Обычно достаточно areErrorsEqual. */
export const hasSameCodeAndMessage = (
  error1: ReadonlyDeep<BaseError>,
  error2: ReadonlyDeep<BaseError>
): boolean =>
  error1.code === error2.code && error1.message === error2.message
/** Проверяет, имеют ли ошибки одинаковый код */
export const hasSameCode = (
  error1: ReadonlyDeep<BaseError>,
  error2: ReadonlyDeep<BaseError>
): boolean =>
  error1.code === error2.code
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для работы с context (Context Utilities)
 * ------------------------------------------------------------------------------------------------- */
/** Тип для контекста ошибки. Readonly (не ReadonlyDeep), так как объект создается динамически и не замораживается. */
export type ErrorContext = Readonly<Record<string, unknown>>
/** Объединяет контексты двух ошибок (правая ошибка имеет приоритет) */
export const mergeErrorContexts = (
  error1: ReadonlyDeep<BaseError>,
  error2: ReadonlyDeep<BaseError>
): ErrorContext => ({
  ...(error1.context ?? {}),
  ...(error2.context ?? {})
})
/**
 * Извлекает значение из контекста ошибки с типизацией
 *
 * ⚠️ Type safety: использует type assertion `as T` для типизации значения.
 * Гарантия корректности типа лежит на вызывающей стороне.
 *
 * @param error - ошибка
 * @param key - ключ для извлечения
 * @param defaultValue - значение по умолчанию
 * @returns значение из контекста или defaultValue
 */
export const extractContextValue = <T>(
  error: ReadonlyDeep<BaseError>,
  key: string,
  defaultValue?: T
): T | undefined => {
  const value = error.context?.[key]
  return typeof value === "undefined" ? defaultValue : (value as T)
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для валидации (Validation Utilities)
 * ------------------------------------------------------------------------------------------------- */
/** Проверяет корректность структуры ErrorMetadata. ⚠️ Валидирует только ErrorMetadata (не включает code, message, timestamp). Для полной ошибки используйте validateErrorStructure. */
export const isValidErrorMetadata = (
  metadata: unknown
): metadata is Partial<ErrorMetadata> =>
  typeof metadata !== "object" || metadata === null
    ? false
    : ((): boolean => {
        const m = metadata as Readonly<Record<string, unknown>>
        return (
          (m['correlationId'] === undefined || typeof m['correlationId'] === "string") &&
          (m['context'] === undefined || typeof m['context'] === "object") &&
          (m['localizedMessage'] === undefined || typeof m['localizedMessage'] === "string") &&
          // cause?: unknown - может быть любым значением (undefined, null, Error, и т.д.)
          // Не проверяем тип, так как unknown допускает любое значение
          (m['severity'] === undefined || (Object.values(ERROR_SEVERITY) as ReadonlyArray<string>).includes(m['severity'] as string)) &&
          (m['category'] === undefined || (Object.values(ERROR_CATEGORY) as ReadonlyArray<string>).includes(m['category'] as string)) &&
          (m['tenantId'] === undefined || typeof m['tenantId'] === "string") &&
          (m['retryable'] === undefined || typeof m['retryable'] === "boolean") &&
          (m['origin'] === undefined || (Object.values(ERROR_ORIGIN) as ReadonlyArray<string>).includes(m['origin'] as string)) &&
          (m['extra'] === undefined || typeof m['extra'] === "object")
        )
      })()
/**
 * Валидирует полную структуру ошибки (BaseError)
 *
 * Проверяет обязательные поля (code через isErrorCodeValid, message, timestamp)
 * и все опциональные метаданные из ErrorMetadata.
 *
 * Использует isBaseError из BaseError.ts для полной валидации структуры.
 *
 * @param error - ошибка для валидации
 * @returns true если структура корректна (является BaseError)
 */
export const validateErrorStructure = (error: unknown): error is ReadonlyDeep<BaseError> =>
  isBaseError(error)