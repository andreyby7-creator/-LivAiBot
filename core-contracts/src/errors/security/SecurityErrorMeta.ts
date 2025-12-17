/**
 * @file SecurityErrorMeta.ts — security-специфичные helpers для работы с метаданными ошибок
 * Типобезопасные утилиты для извлечения и проверки метаданных security ошибок.
 * Использует централизованный реестр ERROR_CODE_META из base слоя.
 *
 * ⚠️ Архитектурный инвариант: Security слой МОЖЕТ интерпретировать operational metadata (retry для rate limits, recoverable для token refresh),
 * но НЕ должен знать transport/UI представления (HTTP, gRPC, UI messages).
 * Эти helpers предоставляют read-only доступ к registry metadata для security логики.
 * Любая логика преобразования метаданных для transport (HTTP/gRPC) или UI должна находиться
 * в соответствующих слоях (UI/Targets), а не в Security.
 */
import { getErrorCodeMeta } from '../base/ErrorCodeMetaData.js'

import type { SecurityError } from './SecurityError.js'
import type { ErrorCodeMeta } from '../base/ErrorCodeMeta.js'
import type { ErrorSeverity, ErrorCategory } from '../base/ErrorConstants.js'
import type { ReadonlyDeep } from 'type-fest'
// NOTE: Severity / Category могут использоваться для security decisions (rate limiting, token refresh).
// Security logic MAY branch on these values для operational decisions.

/* -------------------------------------------------------------------------------------------------
 * 🔹 Получение метаданных
 * ------------------------------------------------------------------------------------------------- */
/**
 * Получает полные метаданные для security ошибки из реестра ERROR_CODE_META.
 * @param error - security ошибка
 * @returns метаданные из реестра или undefined если код не найден
 *
 * PRECONDITION:
 * ERROR_CODE_META registry must be complete at runtime.
 */
export const getSecurityErrorMeta = (error: Readonly<SecurityError>): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  getErrorCodeMeta(error.code)
/**
 * Получает полные метаданные для security ошибки из реестра ERROR_CODE_META или выбрасывает ошибку.
 * @param error - security ошибка
 * @returns метаданные из реестра
 * @throws Error если метаданные не найдены
 *
 * Полезно для runtime assertions в critical security paths, где отсутствие метаданных является критической ошибкой.
 */
export const getSecurityErrorMetaOrThrow = (error: Readonly<SecurityError>): ReadonlyDeep<ErrorCodeMeta> => {
  const meta = getSecurityErrorMeta(error)
  const throwError = (): never => {
    throw new Error(`Missing metadata for security error code: ${error.code}. Registry may be incomplete.`)
  }
  return meta ?? throwError()
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Проверка операционных свойств
 * ------------------------------------------------------------------------------------------------- */
/**
 * Проверяет, можно ли автоматически повторить операцию при возникновении ошибки.
 * @param error - security ошибка
 * @returns true если операция может быть повторена автоматически, false иначе
 *
 * ⚠️ Архитектурный инвариант: Security слой МОЖЕТ использовать retryable для security логики
 * (rate limiting retry, token refresh flows).
 * Но НЕ добавлять сюда isRecoverable, isClientError, shouldAlert и т.д.
 * Такая логика должна находиться в UI/Targets слоях.
 */
export const isSecurityErrorRetryable = (error: Readonly<SecurityError>): boolean => {
  const meta = getSecurityErrorMeta(error)
  return meta?.retryable ?? false
}
/**
 * Проверяет, можно ли восстановить доступ вручную или через бизнес-процесс.
 * @param error - security ошибка
 * @returns true если доступ можно восстановить, false иначе
 *
 * Полезно для token refresh scenarios и других recoverable security flows.
 */
export const isSecurityErrorRecoverable = (error: Readonly<SecurityError>): boolean => {
  const meta = getSecurityErrorMeta(error)
  return meta?.recoverable ?? false
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Извлечение классификационных свойств
 * ------------------------------------------------------------------------------------------------- */
// Classification helpers (read-only, may be used for security decisions)
/**
 * NOTE:
 * Эти значения предназначены для observability / logging / security decisions.
 * Security logic MAY branch on severity or category для operational decisions
 * (rate limiting thresholds, token refresh strategies, audit logging).
 */
/**
 * Получает severity (уровень серьезности) security ошибки.
 * @param error - security ошибка
 * @returns severity из метаданных или undefined если метаданные не найдены
 */
export const getSecurityErrorSeverity = (error: Readonly<SecurityError>): ReadonlyDeep<ErrorSeverity> | undefined => {
  const meta = getSecurityErrorMeta(error)
  return meta?.severity
}

/**
 * Получает category (категорию) security ошибки.
 * @param error - security ошибка
 * @returns category из метаданных или undefined если метаданные не найдены
 */
export const getSecurityErrorCategory = (error: Readonly<SecurityError>): ReadonlyDeep<ErrorCategory> | undefined => {
  const meta = getSecurityErrorMeta(error)
  return meta?.category
}

