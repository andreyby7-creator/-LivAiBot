/**
 * @file ErrorMetadata — расширяемая и полностью immutable структура метаданных для BaseError
 *
 * ✅ FP-совместимо
 * ✅ Полностью immutable через ReadonlyDeep (severity, tenantId, retryable, context, cause, origin, extra)
 * ✅ Extendable: severity, tenantId, retryable, context, cause, origin, extra
 * ✅ Type-level immutability only, runtime mutation is developer's responsibility
 * ✅ Используется как опциональный параметр при createError / wrapUnknownError
 */

import { isErrorSeverity, isErrorCategory, isErrorOrigin, type ErrorSeverity, type ErrorCategory, type ErrorOrigin } from "./ErrorConstants.js"

import type { ReadonlyDeep } from "type-fest"

/* -------------------------------------------------------------------------------------------------
 * 🔹 Основной тип метаданных для BaseError
 * ------------------------------------------------------------------------------------------------- */
export type ErrorMetadata = ReadonlyDeep<{
  /** Необязательный correlationId / traceId для трейсинга запросов */
  correlationId?: string

  /** Контекст ошибки: tenantId, userId, дополнительные данные */
  context?: Record<string, unknown>

  /** Локализованное сообщение для i18n-ready приложений */
  localizedMessage?: string

  /** Опциональный cause для chaining ошибок (Node.js 20+ compatible) */
  cause?: unknown

  /** Уровень критичности ошибки */
  severity?: ErrorSeverity

  /** Категория ошибки для UI mapping и группировки */
  category?: ErrorCategory

  /** Tenant, связанный с ошибкой (если multi-tenant) */
  tenantId?: string

  /** Флаг, можно ли повторить операцию после ошибки */
  retryable?: boolean

  /** Происхождение ошибки (например, domain, application, infra, security) */
  origin?: ErrorOrigin

  /** Дополнительные расширяемые поля */
  extra?: Record<string, unknown>
}>

/* -------------------------------------------------------------------------------------------------
 * 🔹 Factory для ErrorMetadata (чистый FP-подход)
 * ------------------------------------------------------------------------------------------------- */
export const createErrorMetadata = (
  metadata?: Partial<ErrorMetadata>
): ErrorMetadata => {
  // Создаем immutable объект с только определенными полями (без undefined)
  // Безопасное извлечение значений из Partial<ErrorMetadata> с использованием type guards
  const result: Readonly<Record<string, unknown>> = Object.freeze({
    ...(metadata?.correlationId !== undefined && typeof metadata.correlationId === "string" && {
      correlationId: metadata.correlationId
    }),
    ...(metadata?.context !== undefined && {
      context: metadata.context
    }),
    ...(metadata?.localizedMessage !== undefined && typeof metadata.localizedMessage === "string" && {
      localizedMessage: metadata.localizedMessage
    }),
    ...(metadata?.cause !== undefined && {
      cause: metadata.cause
    }),
    ...(metadata?.severity !== undefined && isErrorSeverity(metadata.severity) && {
      severity: metadata.severity
    }),
    ...(metadata?.category !== undefined && isErrorCategory(metadata.category) && {
      category: metadata.category
    }),
    ...(metadata?.tenantId !== undefined && typeof metadata.tenantId === "string" && {
      tenantId: metadata.tenantId
    }),
    ...(metadata?.retryable !== undefined && typeof metadata.retryable === "boolean" && {
      retryable: metadata.retryable
    }),
    ...(metadata?.origin !== undefined && isErrorOrigin(metadata.origin) && {
      origin: metadata.origin
    }),
    ...(metadata?.extra !== undefined && typeof metadata.extra === "object" && {
      extra: metadata.extra as Record<string, unknown>
    }),
  })

  return result as ErrorMetadata
}
