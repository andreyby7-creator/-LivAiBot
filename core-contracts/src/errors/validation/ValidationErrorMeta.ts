/**
 * @file ValidationErrorMeta.ts — validation-специфичные helpers для работы с метаданными ошибок
 * Типобезопасные утилиты для извлечения и проверки метаданных validation ошибок.
 * Использует централизованный реестр ERROR_CODE_META из base слоя.
 *
 * ⚠️ Архитектурный инвариант: Validation слой является частью Application слоя (ERROR_ORIGIN.APPLICATION, ERROR_CATEGORY.VALIDATION).
 * Может интерпретировать operational metadata (recoverable для исправления пользователем),
 * но НЕ должен знать transport/UI представления (HTTP, gRPC, UI messages).
 * Эти helpers предоставляют read-only доступ к registry metadata для validation логики.
 * Любая логика преобразования метаданных для transport (HTTP/gRPC) или UI должна находиться
 * в соответствующих слоях (UI/Targets), а не в Validation.
 */
import { getErrorCodeMeta } from '../base/ErrorCodeMetaData.js'

import type { ValidationError } from './ValidationError.js'
import type { ErrorCodeMeta } from '../base/ErrorCodeMeta.js'
import type { ErrorSeverity, ErrorCategory } from '../base/ErrorConstants.js'
import type { ReadonlyDeep } from 'type-fest'
// NOTE: Severity / Category могут использоваться для validation decisions (error handling, user feedback).
// Validation logic MAY branch on these values для operational decisions.

/* -------------------------------------------------------------------------------------------------
 * 🔹 Получение метаданных
 * ------------------------------------------------------------------------------------------------- */
/**
 * Получает полные метаданные для validation ошибки из реестра ERROR_CODE_META.
 * @param error - validation ошибка
 * @returns метаданные из реестра или undefined если код не найден
 *
 * PRECONDITION:
 * Реестр ERROR_CODE_META должен быть полным во время выполнения.
 */
export const getValidationErrorMeta = (error: Readonly<ValidationError>): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  getErrorCodeMeta(error.code)
/** Вспомогательная функция для получения метаданных. Улучшает читаемость и позволяет избежать повторных вызовов getValidationErrorMeta в рамках одной функции. */
const getMeta = (error: Readonly<ValidationError>): ReadonlyDeep<ErrorCodeMeta> | undefined =>
  getValidationErrorMeta(error)

/* -------------------------------------------------------------------------------------------------
 * 🔹 Проверка операционных свойств
 * ------------------------------------------------------------------------------------------------- */
/**
 * Проверяет, можно ли автоматически повторить операцию при возникновении ошибки.
 * @param error - validation ошибка
 * @returns true если операция может быть повторена автоматически, false иначе
 *
 * ⚠️ Архитектурный инвариант: Validation слой МОЖЕТ использовать retryable для validation логики
 * (но validation ошибки обычно не retryable, так как требуют исправления входных данных).
 * Но НЕ добавлять сюда isRecoverable, isClientError, shouldAlert и т.д.
 * Такая логика должна находиться в UI/Targets слоях.
 */
export const isValidationErrorRetryable = (error: Readonly<ValidationError>): boolean => {
  const meta = getMeta(error)
  return meta?.retryable ?? false
}
/**
 * Проверяет, можно ли восстановить доступ вручную или через исправление входных данных.
 * @param error - validation ошибка
 * @returns true если ошибку можно исправить (пользователь может исправить входные данные), false иначе
 *
 * Полезно для validation scenarios, где пользователь может исправить входные данные.
 * Все validation ошибки обычно recoverable: true.
 * Fallback на true: если метаданные отсутствуют, предполагаем, что пользователь может исправить входные данные.
 */
export const isValidationErrorRecoverable = (error: Readonly<ValidationError>): boolean => {
  const meta = getMeta(error)
  // fallback: предполагаем, что пользователь может исправить входные данные, если метаданные отсутствуют
  return meta === undefined ? true : meta.recoverable
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Извлечение классификационных свойств
 * ------------------------------------------------------------------------------------------------- */
// Classification helpers (read-only, may be used for validation decisions)
/**
 * ПРИМЕЧАНИЕ:
 * Эти значения предназначены для observability / логирования / validation decisions.
 * Validation логика МОЖЕТ ветвиться на severity или category для operational decisions
 * (стратегии обработки ошибок, обратная связь пользователю, flows валидации форм).
 */
/**
 * Получает severity (уровень серьезности) validation ошибки.
 * @param error - validation ошибка
 * @returns severity из метаданных или undefined если метаданные не найдены
 */
export const getValidationErrorSeverity = (error: Readonly<ValidationError>): ReadonlyDeep<ErrorSeverity> | undefined => {
  const meta = getMeta(error)
  return meta?.severity
}

/**
 * Получает category (категорию) validation ошибки.
 * @param error - validation ошибка
 * @returns category из метаданных или undefined если метаданные не найдены
 */
export const getValidationErrorCategory = (error: Readonly<ValidationError>): ReadonlyDeep<ErrorCategory> | undefined => {
  const meta = getMeta(error)
  return meta?.category
}

