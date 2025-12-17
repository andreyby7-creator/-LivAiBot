/**
 * @file DomainErrorMeta.ts — domain-специфичные helpers для работы с метаданными ошибок
 * Типобезопасные утилиты для извлечения и проверки метаданных domain ошибок.
 * Использует централизованный реестр ERROR_CODE_META из base слоя.
 *
 * ⚠️ Архитектурный инвариант: Domain слой НЕ должен интерпретировать transport / UI semantics.
 * Эти helpers предоставляют только read-only доступ к registry metadata.
 * Любая логика преобразования метаданных для transport (HTTP/gRPC) или UI должна находиться
 * в соответствующих слоях (Application/Infrastructure/UI), а не в Domain.
 */
import { getErrorCodeMeta } from '../base/ErrorCodeMetaData.js'

import type { DomainError } from './DomainError.js'
import type { ErrorCodeMeta } from '../base/ErrorCodeMeta.js'
import type { ErrorSeverity, ErrorCategory } from '../base/ErrorConstants.js'
import type { ReadonlyDeep } from 'type-fest'
// NOTE: Severity / Category are treated as read-only operational hints.
// Domain logic MUST NOT branch on these values.

/* -------------------------------------------------------------------------------------------------
 * 🔹 Получение метаданных
 * ------------------------------------------------------------------------------------------------- */
/**
 * Получает полные метаданные для domain ошибки из реестра ERROR_CODE_META.
 * @param error - domain ошибка
 * @returns метаданные из реестра или undefined если код не найден
 *
 * NOTE:
 * Возвращает undefined, если реестр неполный.
 * Domain слой НЕ обязан обрабатывать этот кейс —
 * ответственность лежит на base/bootstrap уровне.
 */
export const getDomainErrorMeta = (error: Readonly<DomainError>): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  getErrorCodeMeta(error.code)

/* -------------------------------------------------------------------------------------------------
 * 🔹 Проверка операционных свойств
 * ------------------------------------------------------------------------------------------------- */
/**
 * Проверяет, можно ли автоматически повторить операцию при возникновении ошибки.
 * @param error - domain ошибка
 * @returns true если операция может быть повторена автоматически, false иначе
 *
 * ⚠️ Архитектурный инвариант: НЕ добавлять сюда isRecoverable, isClientError, shouldAlert и т.д.
 * Это не domain concern, даже если данные лежат в meta.
 * Такая логика должна находиться в Application/Infrastructure слоях.
 */
export const isDomainErrorRetryable = (error: Readonly<DomainError>): boolean => {
  const meta = getDomainErrorMeta(error)
  return meta?.retryable ?? false
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Извлечение классификационных свойств
 * ------------------------------------------------------------------------------------------------- */
// Classification helpers (read-only, non-branching)
/**
 * WARNING:
 * Эти значения предназначены для observability / logging / mapping.
 * Domain logic MUST NOT branch on severity or category.
 */
/**
 * Получает severity (уровень серьезности) domain ошибки.
 * @param error - domain ошибка
 * @returns severity из метаданных или undefined если метаданные не найдены
 */
export const getDomainErrorSeverity = (error: Readonly<DomainError>): ReadonlyDeep<ErrorSeverity> | undefined => {
  const meta = getDomainErrorMeta(error)
  return meta?.severity
}

/**
 * Получает category (категорию) domain ошибки.
 * @param error - domain ошибка
 * @returns category из метаданных или undefined если метаданные не найдены
 */
export const getDomainErrorCategory = (error: Readonly<DomainError>): ReadonlyDeep<ErrorCategory> | undefined => {
  const meta = getDomainErrorMeta(error)
  return meta?.category
}
