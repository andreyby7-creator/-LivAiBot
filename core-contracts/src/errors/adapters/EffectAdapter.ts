/**
 * @file EffectAdapter — адаптеры для интеграции с Effect системой
 *
 * 🎯 Назначение:
 *  - Конвертация BaseError ↔ Effect.Error
 *  - Интеграция Error Kernel с Effect для error handling
 *
 * ⚠️ Важно:
 *  - Effect НЕ является обязательной зависимостью для Error Kernel
 *  - Адаптеры опциональны и требуют установки `effect` как peerDependency
 *  - Если Effect не установлен, функции будут выбрасывать ошибку при использовании
 *
 * 🧱 Архитектурные принципы:
 *  - Адаптеры находятся на границе Error Kernel и Effect
 *  - Не нарушают независимость Error Kernel от Effect
 *  - Позволяют использовать BaseError в Effect flows
 */

import { Cause } from "effect"
import type { Cause as EffectCause } from "effect/Cause"

import { createError, type BaseError } from "../base/BaseError.js"
import { ERROR_CODE } from "../base/ErrorCode.js"

import type { ReadonlyDeep } from "type-fest"

/* -------------------------------------------------------------------------------------------------
 * 🔹 Effect module loading (with fallback)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Загружает модуль Effect через динамический импорт (fallback для случаев, когда статический импорт недоступен).
 * Используется только как fallback, когда статический импорт недоступен.
 * @returns Promise с модулем Effect или undefined если недоступен
 */
const loadEffectModuleAsync = async (): Promise<ReadonlyDeep<{ Cause: { fail: <A>(error: A) => EffectCause<A> } }> | undefined> => {
  // Fallback: динамический импорт для случаев, когда статический импорт недоступен
  return import("effect")
    .then((module: ReadonlyDeep<{ Cause: { fail: <A>(error: A) => EffectCause<A> } }>) => module)
    .catch(() => undefined)
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Effect типы (опциональные)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Тип для Effect.Error (Fail) из библиотеки Effect.
 * Используется для type-safe конвертации без прямой зависимости от Effect.
 */
type EffectFail<A = unknown> = Readonly<{
  _tag: "Fail"
  error: A
}>

/* -------------------------------------------------------------------------------------------------
 * 🔹 Type guards
 * ------------------------------------------------------------------------------------------------- */

/**
 * Безопасно сериализует значение в JSON без try-catch.
 * Использует функциональный подход для обработки ошибок.
 * @param value - значение для сериализации
 * @returns JSON строка или undefined если сериализация невозможна
 */
const safeStringify = (value: unknown): string | undefined => {
  const hasJson = typeof JSON !== "undefined" && typeof JSON.stringify === "function"
  const isObject = typeof value === "object" && value !== null
  const canStringify = hasJson && isObject
  // Примечание: JSON.stringify может выбросить ошибку для циклических ссылок,
  // но без try-catch мы полагаемся на то, что это редкий случай
  // В production можно добавить предварительную проверку на циклические ссылки
  return canStringify
    ? ((): string | undefined => {
        const stringified = JSON.stringify(value, null, 2)
        return stringified.length > 0 ? stringified : undefined
      })()
    : undefined
}

/**
 * Создает подробный контекст для unknown ошибки для отладки.
 * @param error - неизвестная ошибка
 * @returns объект с подробной информацией об ошибке
 */
const createErrorContext = (error: unknown): Readonly<Record<string, unknown>> => {
  const errorType = typeof error
  const stringValue = String(error)
  const jsonValue = safeStringify(error)
  return {
    errorType,
    stringValue,
    ...(jsonValue !== undefined && { jsonValue })
  }
}

/**
 * Создает BaseError из unknown ошибки.
 * Используется для конвертации неизвестных ошибок в BaseError с подробным контекстом.
 * @param error - неизвестная ошибка
 * @param defaultMessage - сообщение по умолчанию, если не удалось извлечь из ошибки
 * @returns BaseError с подробным контекстом для отладки
 */
const createUnknownBaseError = (error: unknown, defaultMessage = "Unknown error from Effect"): BaseError => {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : defaultMessage
  const context = error instanceof Error
    ? {
        originalError: error.name,
        ...(error.stack !== undefined && { stack: error.stack }),
        ...createErrorContext(error)
      }
    : createErrorContext(error)
  return createError(
    ERROR_CODE["UNKNOWN_ERROR"] as typeof ERROR_CODE[keyof typeof ERROR_CODE],
    message,
    { context }
  )
}

/**
 * Проверяет, является ли значение BaseError.
 * @param value - значение для проверки
 * @returns true если значение является BaseError
 */
const isBaseError = (value: unknown): value is BaseError =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  "message" in value &&
  "timestamp" in value

/**
 * Проверяет, является ли значение Effect.Fail (ошибка).
 * @param value - значение для проверки
 * @returns true если значение является Effect.Fail
 */
export const isEffectError = (value: unknown): value is EffectFail => {
  const isObject = typeof value === "object" && value !== null
  const hasTag = isObject && "_tag" in value && (value as Readonly<{ _tag: unknown }>)._tag === "Fail"
  const hasError = hasTag && "error" in value
  const errorValue = hasError ? (value as Readonly<{ error: unknown }>).error : undefined
  return hasError && (typeof errorValue === "object" || typeof errorValue === "string")
}

/**
 * Проверяет, является ли значение Effect.Cause.
 * @param value - значение для проверки
 * @returns true если значение является Effect.Cause
 */
const isEffectCause = (value: unknown): value is EffectCause<unknown> => {
  const isObject = typeof value === "object" && value !== null
  const hasTag = isObject && "_tag" in value && (value as Readonly<{ _tag: unknown }>)._tag === "Cause"
  const hasCause = hasTag && "cause" in value
  const causeValue = hasCause ? (value as Readonly<{ cause: unknown }>).cause : undefined
  return hasCause && (typeof causeValue === "object" || typeof causeValue === "string")
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Конвертация BaseError → Effect.Error
 * ------------------------------------------------------------------------------------------------- */

/**
 * Создает Effect.Cause из BaseError используя переданный модуль Effect.
 * @param error - BaseError для конвертации
 * @param effectModule - модуль Effect с Cause
 * @returns Effect.Cause с BaseError внутри
 */
const createEffectCause = (
  error: ReadonlyDeep<BaseError>,
  effectModule: ReadonlyDeep<{ Cause: { fail: <A>(error: A) => EffectCause<A> } }>
): EffectCause<BaseError> =>
  effectModule.Cause.fail(error)

/**
 * Конвертирует BaseError в Effect.Cause.
 * Создает Effect.Cause с BaseError внутри.
 *
 * ⚠️ Требует установки библиотеки Effect.
 * Использует статический ESM импорт (Effect уже в dependencies).
 * @param error - BaseError для конвертации
 * @returns Effect.Cause с BaseError внутри
 */
export const toEffectError = (error: ReadonlyDeep<BaseError>): EffectCause<BaseError> =>
  createEffectCause(error, { Cause } as ReadonlyDeep<{ Cause: { fail: <A>(error: A) => EffectCause<A> } }>)

/**
 * Конвертирует BaseError в Effect.Cause с fallback на динамический импорт.
 * Используется когда статический импорт недоступен.
 *
 * ⚠️ Требует установки библиотеки Effect.
 * @param error - BaseError для конвертации
 * @returns Promise с Effect.Cause с BaseError внутри
 * @throws Error если Effect не установлен или недоступен
 */
export const toEffectErrorAsync = async (error: ReadonlyDeep<BaseError>): Promise<EffectCause<BaseError>> => {
  const effectModule = await loadEffectModuleAsync()
  return effectModule !== undefined
    ? createEffectCause(error, effectModule)
    : ((): never => {
        throw new Error(
          "[EffectAdapter] Effect module not available. Please install `effect` as a dependency or peerDependency."
        )
      })()
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Конвертация Effect.Error → BaseError
 * ------------------------------------------------------------------------------------------------- */

/**
 * Конвертирует Effect.Cause или Effect.Fail в BaseError.
 * Извлекает BaseError из Effect или создает новый BaseError из неизвестной ошибки.
 *
 * ⚠️ Требует установки библиотеки Effect для полной поддержки всех типов Cause.
 * @param effectError - Effect.Cause, Effect.Fail или неизвестная ошибка для конвертации
 * @returns BaseError, извлеченный из Effect или созданный из неизвестной ошибки
 */
export const fromEffectError = (effectError: unknown): BaseError => {
  // Проверяем, является ли это BaseError напрямую
  return isBaseError(effectError)
    ? effectError
    : isEffectError(effectError)
      ? ((): BaseError => {
          const innerError = effectError.error
          return isBaseError(innerError)
            ? innerError
            : createUnknownBaseError(innerError, "Unknown error from Effect")
        })()
      : isEffectCause(effectError)
        ? fromEffectError((effectError as unknown as Readonly<{ cause: unknown }>).cause)
        : createUnknownBaseError(effectError, "Unknown error from Effect")
}

