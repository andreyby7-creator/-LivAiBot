/**
 * @file ApplicationErrorMeta.ts — application-специфичные helpers для работы с метаданными ошибок
 * Типобезопасные утилиты для извлечения и проверки метаданных application ошибок.
 * Использует централизованный реестр ERROR_CODE_META из base слоя.
 *
 * ⚠️ Архитектурный инвариант: Application слой МОЖЕТ интерпретировать operational metadata (retry, auth),
 * но НЕ должен знать transport/UI представления (HTTP, gRPC, UI messages).
 * Эти helpers предоставляют read-only доступ к registry metadata для orchestration логики.
 * Любая логика преобразования метаданных для transport (HTTP/gRPC) или UI должна находиться
 * в соответствующих слоях (Infrastructure/UI), а не в Application.
 */
import { getErrorCodeMeta } from '../base/ErrorCodeMetaData.js'

import type { ApplicationError } from './ApplicationError.js'
import type { ErrorCodeMeta } from '../base/ErrorCodeMeta.js'
import type { ErrorSeverity, ErrorCategory } from '../base/ErrorConstants.js'
import type { ReadonlyDeep } from 'type-fest'
// NOTE: Severity / Category are treated as read-only operational hints.
// Application logic MAY use these for orchestration decisions (unlike Domain layer).

/* -------------------------------------------------------------------------------------------------
 * 🔹 Получение метаданных
 * ------------------------------------------------------------------------------------------------- */
/**
 * Получает полные метаданные для application ошибки из реестра ERROR_CODE_META.
 * @param error - application ошибка
 * @returns метаданные из реестра или undefined если код не найден
 *
 * PRECONDITION:
 * ERROR_CODE_META registry must be complete at runtime.
 */
export const getApplicationErrorMeta = (error: Readonly<ApplicationError>): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  getErrorCodeMeta(error.code)

/* -------------------------------------------------------------------------------------------------
 * 🔹 Проверка операционных свойств
 * ------------------------------------------------------------------------------------------------- */
/**
 * Проверяет, можно ли автоматически повторить операцию при возникновении ошибки.
 * @param error - application ошибка
 * @returns true если операция может быть повторена автоматически, false иначе
 *
 * ⚠️ Архитектурный инвариант: Application слой МОЖЕТ использовать retryable для orchestration логики
 * (в отличие от Domain слоя, который НЕ должен ветвиться на метаданные).
 * Но НЕ добавлять сюда isRecoverable, isClientError, shouldAlert и т.д.
 * Такая логика должна находиться в Infrastructure/UI слоях.
 */
export const isApplicationErrorRetryable = (error: Readonly<ApplicationError>): boolean => {
  const meta = getApplicationErrorMeta(error)
  return meta?.retryable ?? false
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Извлечение классификационных свойств
 * ------------------------------------------------------------------------------------------------- */
// Classification helpers (read-only, may be used for orchestration)
/**
 * NOTE:
 * Эти значения предназначены для observability / logging / orchestration.
 * Application logic MAY branch on severity or category for orchestration decisions
 * (unlike Domain layer which MUST NOT branch on these values).
 */
/**
 * Получает severity (уровень серьезности) application ошибки.
 * @param error - application ошибка
 * @returns severity из метаданных или undefined если метаданные не найдены
 */
export const getApplicationErrorSeverity = (error: Readonly<ApplicationError>): ReadonlyDeep<ErrorSeverity> | undefined => {
  const meta = getApplicationErrorMeta(error)
  return meta?.severity
}

/**
 * Получает category (категорию) application ошибки.
 * @param error - application ошибка
 * @returns category из метаданных или undefined если метаданные не найдены
 */
export const getApplicationErrorCategory = (error: Readonly<ApplicationError>): ReadonlyDeep<ErrorCategory> | undefined => {
  const meta = getApplicationErrorMeta(error)
  return meta?.category
}

