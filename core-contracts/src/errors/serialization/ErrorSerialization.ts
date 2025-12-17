/**
 * @file ErrorSerialization — специализированная сериализация BaseError для разных audiences
 *
 * 🎯 Назначение:
 *  - HTTP responses (API / RPC)
 *  - Structured logs
 *  - Telemetry / observability systems
 *
 * 🧱 Boundary:
 *  - Error Kernel → External representations
 *  - Это НЕ utils, а serialization boundary
 *  - Разделяет внутренний Error Kernel от внешних форматов
 *
 * 🧱 Архитектурные принципы:
 *  - ❌ Не знает о HTTP-фреймворках (Express, Fastify, Fetch, etc.)
 *  - ❌ Не знает о логгерах (pino, winston, otel)
 *  - ❌ Не знает о runtime (Node / Browser / Edge)
 *  - ✅ Работает только с BaseError контрактом
 *
 * 🧠 Дизайн:
 *  - Один error → разные audiences
 *  - Разные требования к деталям, stack, context
 *  - Безопасно по умолчанию (sanitized)
 *
 * ⚖️ Semver:
 *  - Изменения форматов = MAJOR
 *  - Добавление полей = MINOR
 *  - Удаление полей = MAJOR (даже если "не используется")
 *  - Изменение semantics поля = MAJOR (даже если shape не меняется)
 */

import { getErrorCodeMeta } from "../base/ErrorCodeMetaData.js"
import { isErrorCategory, isErrorOrigin, type ErrorSeverity, type ErrorCategory, type ErrorOrigin } from "../base/ErrorConstants.js"
import {
  // severity
  getErrorSeverity,
  // structure (cause chain)
  hasCause
} from "../base/ErrorUtils.js"

import type { BaseError } from "../base/BaseError.js"
import type { HttpStatusCode, GrpcStatusCode } from "../base/ErrorCodeMeta.js"
import type { ReadonlyDeep } from "type-fest"

/* -------------------------------------------------------------------------------------------------
 * 🔹 Safe value extractors (для безопасного извлечения значений из ReadonlyDeep<BaseError>)
 * ------------------------------------------------------------------------------------------------- */
/** Безопасно извлекает category из ошибки */
const getErrorCategorySafe = (error: ReadonlyDeep<BaseError>): ErrorCategory | undefined =>
  error.category !== undefined && isErrorCategory(error.category) ? error.category : undefined

/** Безопасно извлекает origin из ошибки */
const getErrorOriginSafe = (error: ReadonlyDeep<BaseError>): ErrorOrigin | undefined =>
  error.origin !== undefined && isErrorOrigin(error.origin) ? error.origin : undefined
/** Безопасно извлекает correlationId из ошибки */
const getCorrelationIdSafe = (error: ReadonlyDeep<BaseError>): string | undefined => {
  return typeof error.correlationId === "string" && error.correlationId.length > 0
    ? error.correlationId
    : undefined
}
/** Безопасно извлекает tenantId из ошибки */
const getTenantIdSafe = (error: ReadonlyDeep<BaseError>): string | undefined => {
  return typeof error.tenantId === "string" && error.tenantId.length > 0
    ? error.tenantId
    : undefined
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Shared serialization primitives
 * ------------------------------------------------------------------------------------------------- */

/** Базовая сериализуемая форма ошибки. Не включает cause и stack (audience-specific). */
export type SerializedErrorBase = Readonly<{
  code: string
  message: string
  /** ISO-8601 timestamp */
  timestamp: string
  severity: ErrorSeverity
  category?: ErrorCategory
  origin?: ErrorOrigin
  correlationId?: string
  tenantId?: string
}>
/** Создает минимальную безопасную форму ошибки для всех сериализаций. */
export const toSerializedErrorBase = (
  error: ReadonlyDeep<BaseError>
): SerializedErrorBase => {
  const category = getErrorCategorySafe(error)
  const origin = getErrorOriginSafe(error)
  const correlationId = getCorrelationIdSafe(error)
  const tenantId = getTenantIdSafe(error)
  return {
    code: error.code,
    message: error.message,
    timestamp: error.timestamp,
    severity: getErrorSeverity(error),
    ...(category !== undefined && { category }),
    ...(origin !== undefined && { origin }),
    ...(correlationId !== undefined && { correlationId }),
    ...(tenantId !== undefined && { tenantId })
  }
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 HTTP serialization
 * ------------------------------------------------------------------------------------------------- */
/** HTTP-safe body ошибки для API consumers. Без stack, internal context и sensitive данных. */
export type HttpErrorBody = Readonly<{
  error: SerializedErrorBase
  hasCause?: boolean
}>
/** Абстрактный HTTP response shape. Не привязан к конкретным фреймворкам. */
export type HttpErrorResponse = Readonly<{
  status: number
  body: HttpErrorBody
}>
/**
 * Получает HTTP статус код из метаданных ошибки.
 * @param error - исходная ошибка
 * @returns HTTP статус код или 500 по умолчанию
 */
export const getHttpStatusFromError = (error: ReadonlyDeep<BaseError>): HttpStatusCode => {
  const meta = getErrorCodeMeta(error.code)
  const warnAndReturnDefault = (): HttpStatusCode => {
    console.warn(`[ErrorSerialization] Missing metadata for error code: ${error.code}. Using default HTTP status 500. Please register this error code in ERROR_CODE_META.`)
    return 500
  }
  return meta === undefined ? warnAndReturnDefault() : meta.httpStatus
}
/**
 * Преобразует BaseError в HTTP response contract.
 * @param error - исходная ошибка
 * @returns HTTP response contract с статусом из метаданных
 */
export const toHttpErrorResponse = (
  error: ReadonlyDeep<BaseError>
): HttpErrorResponse => {
  const commonProps = extractCommonProps(error)
  return {
    status: getHttpStatusFromError(error),
    body: {
      error: toSerializedErrorBase(error),
      ...(commonProps.hasCause && { hasCause: true })
    }
  }
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 gRPC serialization
 * ------------------------------------------------------------------------------------------------- */
/** gRPC-safe body ошибки для internal services. details - копия error.context. */
export type GrpcErrorBody = Readonly<{
  code: string
  message: string
  /** Копия error.context для избежания mutable ссылок */
  details?: Readonly<Record<string, unknown>>
}>
/** Абстрактный gRPC response shape. Не привязан к конкретной библиотеке. */
export type GrpcErrorResponse = Readonly<{
  code: GrpcStatusCode
  message: string
  /** Копия error.context для избежания mutable ссылок */
  details?: Readonly<Record<string, unknown>>
}>
/**
 * Получает gRPC статус код из метаданных ошибки.
 * @param error - исходная ошибка
 * @returns gRPC статус код или 13 (INTERNAL) по умолчанию
 */
export const getGrpcStatusFromError = (error: ReadonlyDeep<BaseError>): GrpcStatusCode => {
  const meta = getErrorCodeMeta(error.code)
  const warnAndReturnDefault = (): GrpcStatusCode => {
    console.warn(`[ErrorSerialization] Missing metadata for error code: ${error.code}. Using default gRPC status 13 (INTERNAL). Please register this error code in ERROR_CODE_META.`)
    return 13 // INTERNAL
  }
  return meta === undefined ? warnAndReturnDefault() : meta.grpcStatus
}
/**
 * Преобразует BaseError в gRPC response contract.
 * @param error - исходная ошибка
 * @returns gRPC response contract с статусом из метаданных
 */
export const toGrpcErrorResponse = (
  error: ReadonlyDeep<BaseError>
): GrpcErrorResponse => ({
  code: getGrpcStatusFromError(error),
  message: error.message,
  ...(error.context != null && { details: { ...error.context } })
})
/* -------------------------------------------------------------------------------------------------
 * 🔹 Shared helpers
 * ------------------------------------------------------------------------------------------------- */
/**
 * Извлекает общие свойства ошибки для всех сериализаций.
 * @param error - исходная ошибка
 * @returns объект с общими свойствами (correlationId, tenantId, hasCause)
 */
const extractCommonProps = (error: ReadonlyDeep<BaseError>): Readonly<{
  correlationId?: string
  tenantId?: string
  hasCause: boolean
}> => {
  const correlationId = getCorrelationIdSafe(error)
  const tenantId = getTenantIdSafe(error)
  return {
    ...(correlationId !== undefined && { correlationId }),
    ...(tenantId !== undefined && { tenantId }),
    hasCause: hasCause(error)
  }
}
/** Безопасно извлекает stack trace из ошибки. Возвращает undefined если stack отсутствует или пустой. */
const getStack = (error: unknown): string | undefined => {
  const stack = typeof error === "object" && error !== null
    ? (error as Readonly<Record<"stack", unknown>>)['stack']
    : undefined
  return typeof stack === "string" && stack.length > 0 ? stack : undefined
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Log serialization
 * ------------------------------------------------------------------------------------------------- */
/** Формат ошибки для structured logging. Может включать stack и context. Не для клиентов. */
export type LogErrorFormat = Readonly<{
  error: SerializedErrorBase
  /** Дополнительный контекст для отладки. Не deeply immutable, только для логирования. */
  context?: Readonly<Record<string, unknown>>
  stack?: string
  hasCause?: boolean
}>
/** Опции лог-сериализации. */
export type LogSerializationOptions = Readonly<{
  includeStack?: boolean
  includeContext?: boolean
}>

/** Преобразует BaseError в формат для логов. */
export const toLogErrorFormat = (
  error: ReadonlyDeep<BaseError>,
  options: LogSerializationOptions = {}
): LogErrorFormat => {
  const stack = getStack(error)
  const commonProps = extractCommonProps(error)
  return {
    error: toSerializedErrorBase(error),
    ...(options.includeContext === true && error.context != null && { context: error.context }),
    ...(options.includeStack === true && stack != null && { stack }),
    ...(commonProps.hasCause && { hasCause: true })
  }
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Telemetry serialization
 * ------------------------------------------------------------------------------------------------- */
/** Формат ошибки для телеметрии. Машинно-ориентированный, без message (high cardinality). */
export type TelemetryErrorFormat = Readonly<{
  code: string
  severity: ErrorSeverity
  category?: ErrorCategory
  origin?: ErrorOrigin
  /** Метрики из метаданных для observability. Опционально развернуты для удобства доступа. */
  metrics?: Readonly<{
    counter: string
    histogram: string
  }>
  /** Опционально развернутые метрики для прямого доступа. */
  counter?: string
  histogram?: string
  correlationId?: string
  tenantId?: string
  hasCause: boolean
}>
/** Преобразует BaseError в телеметрический формат. */
export const toTelemetryErrorFormat = (
  error: ReadonlyDeep<BaseError>
): TelemetryErrorFormat => {
  const meta = getErrorCodeMeta(error.code)
  const commonProps = extractCommonProps(error)
  const category = getErrorCategorySafe(error)
  const origin = getErrorOriginSafe(error)
  return {
    code: error.code,
    severity: getErrorSeverity(error),
    ...(category !== undefined && { category }),
    ...(origin !== undefined && { origin }),
    ...(meta?.metrics != null && {
      metrics: meta.metrics,
      counter: meta.metrics.counter,
      histogram: meta.metrics.histogram
    }),
    ...(commonProps.correlationId !== undefined && { correlationId: commonProps.correlationId }),
    ...(commonProps.tenantId !== undefined && { tenantId: commonProps.tenantId }),
    hasCause: commonProps.hasCause
  }
}
