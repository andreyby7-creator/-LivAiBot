/**
 * @file InfrastructureErrorMeta.ts — infrastructure-специфичные helpers для работы с метаданными ошибок
 * Типобезопасные утилиты для извлечения и проверки метаданных infrastructure ошибок.
 * Использует централизованный реестр ERROR_CODE_META из base слоя.
 *
 * ⚠️ Архитектурный инвариант: Infrastructure слой МОЖЕТ интерпретировать operational metadata (retry, timeout, circuit breaker),
 * но НЕ должен знать business логику или domain правила.
 * Эти helpers предоставляют read-only доступ к registry metadata для IO-heavy логики.
 * Любая логика преобразования метаданных для transport (HTTP/gRPC) или UI должна находиться
 * в соответствующих слоях (UI/Targets), а не в Infrastructure.
 */
import { getErrorCodeMeta } from '../base/ErrorCodeMetaData.js'

import type { InfrastructureError } from './InfrastructureError.js'
import type { ErrorCodeMeta } from '../base/ErrorCodeMeta.js'
import type { ErrorSeverity, ErrorCategory } from '../base/ErrorConstants.js'
import type { ReadonlyDeep } from 'type-fest'
// NOTE: Severity / Category могут использоваться для IO decisions (circuit breaker, retry strategies).
// Infrastructure logic MAY branch on these values для operational decisions.

/* -------------------------------------------------------------------------------------------------
 * 🔹 Получение метаданных
 * ------------------------------------------------------------------------------------------------- */
/**
 * Получает полные метаданные для infrastructure ошибки из реестра ERROR_CODE_META.
 * @param error - infrastructure ошибка
 * @returns метаданные из реестра или undefined если код не найден
 *
 * PRECONDITION:
 * ERROR_CODE_META registry must be complete at runtime.
 */
export const getInfrastructureErrorMeta = (error: Readonly<InfrastructureError>): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  getErrorCodeMeta(error.code)
/**
 * Получает полные метаданные для infrastructure ошибки из реестра ERROR_CODE_META или выбрасывает ошибку.
 * @param error - infrastructure ошибка
 * @returns метаданные из реестра
 * @throws Error если метаданные не найдены
 *
 * Полезно для runtime assertions в critical IO paths, где отсутствие метаданных является критической ошибкой.
 */
export const getInfrastructureErrorMetaOrThrow = (error: Readonly<InfrastructureError>): ReadonlyDeep<ErrorCodeMeta> => {
  const meta = getInfrastructureErrorMeta(error)
  const throwError = (): never => {
    throw new Error(`Missing metadata for infrastructure error code: ${error.code}. Registry may be incomplete.`)
  }
  return meta ?? throwError()
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Проверка операционных свойств
 * ------------------------------------------------------------------------------------------------- */
/**
 * Проверяет, можно ли автоматически повторить операцию при возникновении ошибки.
 * @param error - infrastructure ошибка
 * @returns true если операция может быть повторена автоматически, false иначе
 *
 * ⚠️ Архитектурный инвариант: Infrastructure слой МОЖЕТ использовать retryable для IO логики
 * (circuit breaker, exponential backoff, retry strategies).
 * Но НЕ добавлять сюда isRecoverable, isClientError, shouldAlert и т.д.
 * Такая логика должна находиться в UI/Targets слоях.
 */
export const isInfrastructureErrorRetryable = (error: Readonly<InfrastructureError>): boolean => {
  const meta = getInfrastructureErrorMeta(error)
  return meta?.retryable ?? false
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Извлечение классификационных свойств
 * ------------------------------------------------------------------------------------------------- */
// Classification helpers (read-only, may be used for IO decisions)
/**
 * NOTE:
 * Эти значения предназначены для observability / logging / IO decisions.
 * Infrastructure logic MAY branch on severity or category для operational decisions
 * (circuit breaker thresholds, retry strategies, timeout handling).
 */
/**
 * Получает severity (уровень серьезности) infrastructure ошибки.
 * @param error - infrastructure ошибка
 * @returns severity из метаданных или undefined если метаданные не найдены
 */
export const getInfrastructureErrorSeverity = (error: Readonly<InfrastructureError>): ReadonlyDeep<ErrorSeverity> | undefined => {
  const meta = getInfrastructureErrorMeta(error)
  return meta?.severity
}

/**
 * Получает category (категорию) infrastructure ошибки.
 * @param error - infrastructure ошибка
 * @returns category из метаданных или undefined если метаданные не найдены
 */
export const getInfrastructureErrorCategory = (error: Readonly<InfrastructureError>): ReadonlyDeep<ErrorCategory> | undefined => {
  const meta = getInfrastructureErrorMeta(error)
  return meta?.category
}

