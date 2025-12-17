/**
 * @file Функциональный BaseError — полностью FP-совместимое ядро ошибок
 * ✅ Immutable (неизменяемый)
 * ✅ No classes, no this (без классов и this)
 * ✅ Pattern matching через discriminated union (паттерн матчинг через discriminated union)
 * ✅ Стабильный ErrorCode (стабильный ABI)
 */
import { ERROR_CODE } from "./ErrorCode.js"
import { createErrorCodeMetaWithDefaults, generateMetricName } from "./ErrorCodeMeta.js"
import { getErrorCodeMeta } from "./ErrorCodeMetaData.js"
import { ERROR_CATEGORY, ERROR_ORIGIN } from "./ErrorConstants.js"
import { deepFreeze } from "./ErrorUtils.js"
import { isBaseError } from "./ErrorUtils.js"

import type { ErrorCode } from "./ErrorCode.js"
import type { ErrorCodeMeta } from "./ErrorCodeMeta.js"
import type { ErrorOrigin, ErrorCategory } from "./ErrorConstants.js"
import type { ErrorMetadata } from "./ErrorMetadata.js"
import type { ReadonlyDeep } from "type-fest"
/* -------------------------------------------------------------------------------------------------
 * 🔹 Тип BaseError
 * ------------------------------------------------------------------------------------------------- */
/**
 * Базовый тип ошибки для всей платформы
 * Полностью immutable структура, совместимая с функциональным программированием.
 * Используется во всех слоях: Domain / Application / IO / Context / Targets.
 * Состоит из обязательных полей (code, message, timestamp) и опциональных метаданных.
 * Поле cause строго типизировано для type-safe цепочки ошибок.
 */
export type BaseError = ReadonlyDeep<{
  /** Стабильный код ошибки (из ERROR_CODE) */
  code: ErrorCode
  /** Человеко-читаемое сообщение об ошибке */
  message: string
  /** Временная метка создания ошибки (ISO string) */
  timestamp: string
  /** Цепочка причин ошибки. Строго типизированная для type-safe обработки. */
  cause?: BaseError | Error
} & Omit<ErrorMetadata, 'cause'>>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Helper для получения метаданных из реестра
 * ------------------------------------------------------------------------------------------------- */
/** Определяет layer и category по префиксу кода ошибки для fallback метаданных */
const inferLayerAndCategoryFromCode = (code: ErrorCode): ReadonlyDeep<{ layer: ErrorOrigin; category: ErrorCategory }> | undefined =>
  code.startsWith("DOMAIN_")
    ? { layer: ERROR_ORIGIN['DOMAIN'] as ErrorOrigin, category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory }
    : code.startsWith("APPLICATION_")
      ? { layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, category: ERROR_CATEGORY['BUSINESS'] as ErrorCategory }
      : code.startsWith("INFRA_")
        ? { layer: ERROR_ORIGIN['INFRASTRUCTURE'] as ErrorOrigin, category: ERROR_CATEGORY['INFRASTRUCTURE'] as ErrorCategory }
        : code.startsWith("SECURITY_")
          ? { layer: ERROR_ORIGIN['SECURITY'] as ErrorOrigin, category: ERROR_CATEGORY['AUTHORIZATION'] as ErrorCategory }
          : code.startsWith("VALIDATION_")
            ? { layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, category: ERROR_CATEGORY['VALIDATION'] as ErrorCategory }
            : code === "UNKNOWN_ERROR"
              ? { layer: ERROR_ORIGIN['APPLICATION'] as ErrorOrigin, category: ERROR_CATEGORY['UNKNOWN'] as ErrorCategory }
              : undefined
/**
 * Получает метаданные для кода ошибки из реестра ERROR_CODE_META
 * @param code - код ошибки
 * @returns метаданные из реестра или fallback метаданные на основе префикса кода
 */
const getErrorMetaFromCode = (code: ErrorCode): ReadonlyDeep<ErrorCodeMeta> | undefined => {
  // Используем статический реестр из ErrorCodeMetaData.ts
  const metaFromRegistry = getErrorCodeMeta(code)
  // Fallback логика для graceful degradation (на случай если код отсутствует в реестре)
  return metaFromRegistry ?? ((): ReadonlyDeep<ErrorCodeMeta> | undefined => {
    const inferred = inferLayerAndCategoryFromCode(code)
    return inferred
      ? createErrorCodeMetaWithDefaults({
          layer: inferred.layer,
          kind: "error",
          category: inferred.category,
          httpStatus: 500,
          grpcStatus: 13,
          metrics: generateMetricName(inferred.layer, "error", code)
        })
      : undefined
  })()
}
/** Фильтрует undefined поля из объекта метаданных для компактного merge */
const filterUndefinedFields = <T extends ReadonlyDeep<Record<string, unknown>>>(obj: T): ReadonlyDeep<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]: ReadonlyDeep<[string, unknown]>) => value !== undefined)
  ) as ReadonlyDeep<Record<string, unknown>>
/** Проверяет, что значение является POJO (Plain Old JavaScript Object) для безопасного merge */
const isPOJO = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype
/** Глубоко объединяет два объекта Record<string, unknown> в функциональном стиле. ⚠️ Требует, чтобы объекты были POJO для корректного merge */
const deepMergeObjects = (
  base: ReadonlyDeep<Record<string, unknown>> | undefined,
  override: ReadonlyDeep<Record<string, unknown>> | undefined
): ReadonlyDeep<Record<string, unknown>> | undefined => {
  // Валидация: проверяем, что override является POJO
  const overrideValid = override === undefined || isPOJO(override)
  const baseValid = base === undefined || isPOJO(base)
  return !overrideValid
    ? ((): ReadonlyDeep<Record<string, unknown>> | undefined => {
        console.warn('Warning: override object is not a POJO, skipping merge. Use plain objects for context/extra.')
        return base
      })()
    : !baseValid
      ? ((): ReadonlyDeep<Record<string, unknown>> | undefined => {
          console.warn('Warning: base object is not a POJO, skipping merge. Use plain objects for context/extra.')
          return override
        })()
      : override === undefined
        ? base
        : base === undefined
          ? override
          : Object.keys(override).reduce((acc: ReadonlyDeep<Record<string, unknown>>, key: string) => {
              const baseValue = base[key]
              const overrideValue = override[key]
              const isBothPOJO = isPOJO(baseValue) && isPOJO(overrideValue)
              const mergedValue = isBothPOJO
                ? deepMergeObjects(baseValue as ReadonlyDeep<Record<string, unknown>>, overrideValue as ReadonlyDeep<Record<string, unknown>>)
                : overrideValue
              return mergedValue !== undefined ? { ...acc, [key]: mergedValue } : acc
            }, base)
}
/** Извлекает метаданные из ErrorCodeMeta и преобразует их в ErrorMetadata */
const extractMetadataFromMeta = (
  meta: ReadonlyDeep<ErrorCodeMeta>,
  override?: ErrorMetadata
): Omit<ErrorMetadata, 'cause'> => {
  // Преобразуем ErrorCodeMeta в ErrorMetadata для единообразного объединения
  const baseMetadata: ReadonlyDeep<Omit<ErrorMetadata, 'cause'>> = {
    severity: meta.severity,
    category: meta.category,
    origin: meta.layer,
    retryable: meta.retryable
  }
  // Объединяем через deepMergeObjects для единообразной обработки всех полей (включая context и extra)
  return deepMergeObjects(baseMetadata, filterUndefinedFields(override ?? {})) as ReadonlyDeep<Omit<ErrorMetadata, 'cause'>>
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Создание ошибок
 * ------------------------------------------------------------------------------------------------- */
/**
 * Создание новой ошибки BaseError
 * Автоматически заполняет метаданные из реестра ERROR_CODE_META, если он доступен.
 * Переданные метаданные имеют приоритет над значениями из реестра.
 * @param code - стабильный код ошибки из ERROR_CODE
 * @param message - человеко-читаемое сообщение
 * @param metadata - дополнительные метаданные ошибки (correlationId, context, severity и т.д.)
 * @returns полностью immutable ошибка
 */
export const createError = (
  code: ErrorCode,
  message: string,
  metadata?: ErrorMetadata
): BaseError =>
  !Object.prototype.hasOwnProperty.call(ERROR_CODE, code)
    ? ((): never => { throw new Error(`Invalid ErrorCode: ${code}`) })()
    : ((): BaseError => {
        const metaFromRegistry = getErrorMetaFromCode(code)
        const safeMetadata = metadata ?? {}
        // Объединяем метаданные из реестра и переданные метаданные через extractMetadataFromMeta
        const baseMetadata: ReadonlyDeep<Omit<ErrorMetadata, 'cause'>> = metaFromRegistry
          ? extractMetadataFromMeta(metaFromRegistry, safeMetadata)
          : filterUndefinedFields(safeMetadata) as ReadonlyDeep<Omit<ErrorMetadata, 'cause'>>
        // Преобразуем cause в строго типизированный формат
        const causeValue = metadata?.cause
        const typedCause: ReadonlyDeep<BaseError | Error> | undefined = causeValue instanceof Error || (typeof causeValue === 'object' && causeValue !== null && 'code' in causeValue && 'message' in causeValue && 'timestamp' in causeValue)
          ? causeValue as ReadonlyDeep<BaseError | Error>
          : undefined
        return deepFreeze({
          code,
          message,
          timestamp: new Date().toISOString(),
          ...baseMetadata,
          ...(typedCause !== undefined && { cause: typedCause })
        })
      })()
/** Рекурсивно ищет BaseError в цепочке cause ошибки */
const findBaseErrorInChain = (error: unknown): ReadonlyDeep<BaseError> | undefined =>
  isBaseError(error)
    ? error
    : error instanceof Error && 'cause' in error && error.cause !== undefined
      ? findBaseErrorInChain(error.cause)
      : undefined
/**
 * Обертывание неизвестной ошибки в BaseError
 * Автоматически заполняет метаданные из реестра ERROR_CODE_META для fallbackCode.
 * Переданные метаданные имеют приоритет над значениями из реестра.
 * ⚠️ Если переданная ошибка уже является BaseError или содержит BaseError в цепочке cause, возвращает найденный BaseError без двойного оборачивания.
 * @param error - неизвестная ошибка (unknown)
 * @param fallbackCode - код ошибки по умолчанию
 * @param fallbackMessage - сообщение по умолчанию
 * @param additionalMetadata - дополнительные метаданные для ошибки
 * @returns обертка BaseError с cause chaining и метаданными
 */
export const wrapUnknownError = (
  error: unknown,
  fallbackCode: ErrorCode = ERROR_CODE['UNKNOWN_ERROR'] as ErrorCode,
  fallbackMessage = "Неизвестная ошибка",
  additionalMetadata?: ErrorMetadata
): BaseError => {
  // Избегаем двойного оборачивания BaseError (проверяем саму ошибку и цепочку cause)
  const baseErrorInChain = findBaseErrorInChain(error)
  return baseErrorInChain ?? ((): BaseError => {
    const message: ReadonlyDeep<string> = error instanceof Error ? error.message || fallbackMessage : String(error) || fallbackMessage
    const typedCause: ReadonlyDeep<BaseError | Error> | undefined = error instanceof Error
      ? error as ReadonlyDeep<BaseError | Error>
      : undefined
    return createError(fallbackCode, message, {
      ...additionalMetadata,
      ...(typedCause !== undefined && { cause: typedCause })
    })
  })()
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Pattern matching
 * ------------------------------------------------------------------------------------------------- */
/** Type-safe pattern matching для обработки ошибок по ErrorCode */
export const matchError = <T>(
  error: ReadonlyDeep<BaseError>,
  handlers: ReadonlyDeep<{ [K in ErrorCode]?: (e: ReadonlyDeep<BaseError>) => T } & { fallback: (e: ReadonlyDeep<BaseError>) => T }>
): T => {
  return handlers[error.code] ? handlers[error.code]!(error) : handlers.fallback(error)
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты
 * ------------------------------------------------------------------------------------------------- */

/** Проверка, что ошибка имеет конкретный ErrorCode */
export const isErrorCodeValid = (value: unknown): value is ErrorCode =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_CODE, value)
export const isErrorCode = (value: unknown, code: ErrorCode): value is ReadonlyDeep<BaseError> =>
  isBaseError(value) && value.code === code
/* -------------------------------------------------------------------------------------------------
 * 🔹 Экспорт helpers для метаданных
 * ------------------------------------------------------------------------------------------------- */
/** Получает метаданные для кода ошибки из реестра ERROR_CODE_META. Экспортируется для использования в других слоях. */
export { getErrorMetaFromCode }
/* -------------------------------------------------------------------------------------------------
 * 🔹 Специфические конструкторы ошибок по слоям
 * ------------------------------------------------------------------------------------------------- */
/** Создание ошибки Domain слоя с runtime проверкой layer */
export const createDomainError = (
  code: ErrorCode,
  message: string,
  metadata?: ErrorMetadata
): BaseError => {
  const meta = getErrorMetaFromCode(code)
  const inferred = inferLayerAndCategoryFromCode(code)
  const layer = meta?.layer ?? inferred?.layer
  return layer === ERROR_ORIGIN['DOMAIN']
    ? createError(code, message, metadata)
    : ((): never => { throw new Error(`ErrorCode ${code} does not belong to domain layer (actual: ${layer ?? 'unknown'})`) })()
}
/** Создание ошибки Application слоя с runtime проверкой layer */
export const createApplicationError = (
  code: ErrorCode,
  message: string,
  metadata?: ErrorMetadata
): BaseError => {
  const meta = getErrorMetaFromCode(code)
  const inferred = inferLayerAndCategoryFromCode(code)
  const layer = meta?.layer ?? inferred?.layer
  return layer === ERROR_ORIGIN['APPLICATION']
    ? createError(code, message, metadata)
    : ((): never => { throw new Error(`ErrorCode ${code} does not belong to application layer (actual: ${layer ?? 'unknown'})`) })()
}
/** Создание ошибки Infrastructure слоя с runtime проверкой layer */
export const createInfrastructureError = (
  code: ErrorCode,
  message: string,
  metadata?: ErrorMetadata
): BaseError => {
  const meta = getErrorMetaFromCode(code)
  const inferred = inferLayerAndCategoryFromCode(code)
  const layer = meta?.layer ?? inferred?.layer
  return layer === ERROR_ORIGIN['INFRASTRUCTURE']
    ? createError(code, message, metadata)
    : ((): never => { throw new Error(`ErrorCode ${code} does not belong to infrastructure layer (actual: ${layer ?? 'unknown'})`) })()
}
/** Создание ошибки Security слоя с runtime проверкой layer */
export const createSecurityError = (
  code: ErrorCode,
  message: string,
  metadata?: ErrorMetadata
): BaseError => {
  const meta = getErrorMetaFromCode(code)
  const inferred = inferLayerAndCategoryFromCode(code)
  const layer = meta?.layer ?? inferred?.layer
  return layer === ERROR_ORIGIN['SECURITY']
    ? createError(code, message, metadata)
    : ((): never => { throw new Error(`ErrorCode ${code} does not belong to security layer (actual: ${layer ?? 'unknown'})`) })()
}
