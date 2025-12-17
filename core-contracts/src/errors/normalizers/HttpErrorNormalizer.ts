/**
 * @file HttpErrorNormalizer — нормализация HTTP-ошибок (fetch/axios) → BaseError
 *
 * 🎯 Назначение:
 *  - Конвертация HTTP-ответов (Response, AxiosError) в BaseError
 *  - Извлечение correlationId из заголовков
 *  - Маппинг HTTP статусов на ErrorCode
 *
 * 🧱 Boundary:
 *  - External HTTP clients → Error Kernel
 *  - Не зависит от конкретных HTTP-клиентов (работает с абстракциями)
 *  - Использует InfrastructureError для внешних сервисов
 *
 * 🧠 Дизайн:
 *  - Один HTTP-ответ → BaseError с полным контекстом
 *  - Автоматическое извлечение correlationId из заголовков
 *  - Маппинг HTTP статусов на ErrorCode через ERROR_CODE_META
 *
 * 🔮 Future-proof:
 *  - Интерфейс абстрагирован от конкретных HTTP-клиентов (fetch, axios, got, undici и т.д.)
 *  - Новые HTTP-клиенты легко интегрируются через универсальные типы HttpHeaders и HttpErrorLike
 *  - Расширение поддержки новых клиентов не требует изменения API нормализатора
 */
// Runtime imports (value imports для tree-shaking)
import { wrapUnknownError } from "../base/BaseError.js"
import { ERROR_CODE } from "../base/ErrorCode.js"
import { createExternalServiceError } from "../infrastructure/InfrastructureError.js"

// Type-only imports (оптимизация для tree-shaking в ESM)
import type { BaseError } from "../base/BaseError.js"
import type { ErrorCode } from "../base/ErrorCode.js"
import type { HttpStatusCode } from "../base/ErrorCodeMeta.js"
import type { ReadonlyDeep } from "type-fest"
/* -------------------------------------------------------------------------------------------------
 * 🔹 Типы для HTTP-ответов
 * ------------------------------------------------------------------------------------------------- */
/** Абстракция HTTP-заголовков. Работает с fetch Headers и Axios headers. Строгая типизация для compile-time безопасности. */
export type HttpHeaders =
  | Readonly<Record<string, string | string[] | undefined>>
  | Headers
/** Контекст для нормализации HTTP-ошибок */
export type HttpErrorContext = Readonly<{
  serviceName?: string
  endpoint?: string
  method?: string
  correlationId?: string
  startedAt?: string
}>
/**
 * Axios-agnostic HTTP error contract
 * Простой readonly контракт для работы с HTTP-ошибками из любых клиентов
 */
export type HttpErrorLike = Readonly<{
  status?: number
  headers?: Readonly<Record<string, string | string[] | undefined>>
  url?: string
  method?: string
  body?: unknown
  message?: string
}>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Helpers для работы с заголовками
 * ------------------------------------------------------------------------------------------------- */
/** Извлекает correlationId из заголовков. Проверяет X-Request-Id, X-Correlation-Id, correlation-id. Строгая типизация заголовков для compile-time безопасности. */
export const extractCorrelationId = (headers: ReadonlyDeep<HttpHeaders>): string | undefined => {
  // Нормализуем headers в lowercase для единообразного доступа
  const normalizedHeaders: ReadonlyDeep<HttpHeaders> = headers instanceof Headers
    ? headers
    : ((): ReadonlyDeep<Record<string, string | string[] | undefined>> => {
        const normalized: ReadonlyDeep<Record<string, string | string[] | undefined>> = {} as ReadonlyDeep<Record<string, string | string[] | undefined>>
        const recordHeaders = headers as ReadonlyDeep<Record<string, string | string[] | undefined>>
        for (const [key, value] of Object.entries(recordHeaders)) {
          const normalizedValue: ReadonlyDeep<string | string[] | undefined> = Array.isArray(value)
            ? (value as readonly string[]).slice() as ReadonlyDeep<string[]>
            : (value as ReadonlyDeep<string | undefined>)
          ;(normalized as Record<string, string | string[] | undefined>)[key.toLowerCase()] = normalizedValue as string | string[] | undefined
        }
        return normalized
      })()
  /**
   * @internal
   * Внутренний helper для безопасного извлечения значения заголовка.
   */
  const getHeaderValue = (value: unknown): string | undefined =>
    value === undefined
      ? undefined
      : Array.isArray(value)
        ? value[0] as string
        : typeof value === "string"
          ? value
          : typeof value === "object" && value !== null
            ? ((): string | undefined => {
                const stringValue = String(value)
                return stringValue.length > 0 ? stringValue : undefined
              })()
            : undefined
  const getHeader = (name: string): string | undefined => {
    return normalizedHeaders instanceof Headers
      ? normalizedHeaders.get(name.toLowerCase()) ?? undefined
      : ((): string | undefined => {
          const recordHeaders = normalizedHeaders as ReadonlyDeep<Record<string, string | string[] | undefined>>
          return getHeaderValue(recordHeaders[name.toLowerCase()])
        })()
  }
  return getHeader("X-Request-Id") ?? getHeader("X-Correlation-Id") ?? getHeader("correlation-id")
}
/**
 * @internal
 * Boundary-функция: извлекает URL из Response (runtime, mutable, instanceof)
 */
const extractUrlFromResponse = (response: Response): string | undefined => response.url
/**
 * @internal
 * Pure helper: извлекает URL из HttpErrorLike (readonly, линтер счастлив)
 */
const extractUrlFromHttpError = (error: ReadonlyDeep<HttpErrorLike>): string | undefined => {
  return error.url
}
/**
 * @internal
 * Pure helper: нормализует HttpErrorLike в BaseError
 */
const normalizeHttpErrorLike = (
  error: ReadonlyDeep<HttpErrorLike>,
  context?: HttpErrorContext
): ReadonlyDeep<BaseError> => {
  const status = error.status
  return status === undefined
    ? wrapUnknownError(
        new Error(error.message ?? "HTTP request failed"),
        ERROR_CODE["INFRA_EXTERNAL_SERVICE_ERROR"] as ErrorCode,
        error.message ?? "HTTP request failed",
        {
          context: {
            ...buildHttpContext(context, error),
          },
          ...(context?.startedAt !== undefined && { extra: { startedAt: context.startedAt } })
        }
      )
    : ((): ReadonlyDeep<BaseError> => {
        const statusCode = status as HttpStatusCode
        const correlationId = context?.correlationId ?? (error.headers !== undefined
          ? extractCorrelationId(error.headers as HttpHeaders)
          : undefined)
        const endpoint = context?.endpoint ?? extractUrlFromHttpError(error) ?? "unknown"
        const serviceName = context?.serviceName ?? "external-service"
        return createExternalServiceError({
          serviceName,
          endpoint,
          statusCode,
          ...(correlationId !== undefined && { correlationId }),
          ...(context?.startedAt !== undefined && { startedAt: context.startedAt })
        })
      })()
}
/* -------------------------------------------------------------------------------------------------
 * 🔹 Helpers для построения context
 * ------------------------------------------------------------------------------------------------- */
/**
 * @internal
 * Boundary-адаптер: конвертирует AxiosError (или любой похожий объект) в HttpErrorLike
 * Runtime, mutable, instanceof - это boundary с внешним миром
 */
export const fromAxiosError = (error: unknown): HttpErrorLike | undefined => {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  )
      ? ((): HttpErrorLike => {
        const e: Readonly<{
          response?: Readonly<{
            status?: number
            statusText?: string
            data?: unknown
            headers?: Readonly<Record<string, string | string[] | undefined>> | Headers
          }>
          config?: Readonly<{
            url?: string
            method?: string
          }>
          code?: string
          message?: string
        }> = error as {
          response?: {
            status?: number
            statusText?: string
            data?: unknown
            headers?: Record<string, string | string[] | undefined> | Headers
          }
          config?: {
            url?: string
            method?: string
          }
          code?: string
          message?: string
        }
        const headers = e.response?.headers
        const normalizedHeaders: Readonly<Record<string, string | string[] | undefined>> | undefined =
          headers === undefined
            ? undefined
            : headers instanceof Headers
              ? ((): Readonly<Record<string, string | string[] | undefined>> => {
                  const entries: ReadonlyArray<readonly [string, string]> = Array.from(headers.entries())
                  const record: Readonly<Record<string, string | string[] | undefined>> = Object.fromEntries(entries)
                  return record
                })()
              : ((): Readonly<Record<string, string | string[] | undefined>> => {
                  const h: Readonly<Record<string, string | string[] | undefined>> = headers
                  return h
                })()
        const result: HttpErrorLike = {
          ...(e.response?.status !== undefined && { status: e.response.status }),
          ...(normalizedHeaders !== undefined && { headers: normalizedHeaders }),
          ...(e.config?.url !== undefined && { url: e.config.url }),
          ...(e.config?.method !== undefined && { method: e.config.method }),
          ...(e.response?.data !== undefined && { body: e.response.data }),
          ...(e.message !== undefined && { message: e.message })
        }
        return result
      })()
    : undefined
}
/**
 * @internal
 * Pure helper: строит общий HTTP context из HttpErrorContext и HttpErrorLike для использования в BaseError.
 */
const buildHttpContext = (
  context?: HttpErrorContext,
  error?: ReadonlyDeep<HttpErrorLike>
): ReadonlyDeep<Record<string, unknown>> => ({
  ...(context?.serviceName !== undefined && { serviceName: context.serviceName }),
  ...(context?.endpoint !== undefined && { endpoint: context.endpoint }),
  ...(context?.method !== undefined && { method: context.method }),
  ...(error?.method !== undefined && { httpMethod: error.method })
}) as ReadonlyDeep<Record<string, unknown>>
/* -------------------------------------------------------------------------------------------------
 * 🔹 Нормализация HTTP-ответов
 * ------------------------------------------------------------------------------------------------- */
/** Нормализует Response (fetch) в BaseError. Извлекает статус, заголовки, correlationId. Нормализует только ошибки (response.ok === false). */
export const normalizeHttpResponse = (
  response: Response,
  context?: HttpErrorContext
): ReadonlyDeep<BaseError> => {
  const validationError: ReadonlyDeep<Error> = new Error("normalizeHttpResponse called with successful response (response.ok === true)") as ReadonlyDeep<Error>
  return response.ok
    ? wrapUnknownError(
        validationError,
        ERROR_CODE["INFRA_EXTERNAL_SERVICE_ERROR"] as ErrorCode,
        "Cannot normalize successful HTTP response as error",
        {
          context: {
            ...(context?.serviceName !== undefined && { serviceName: context.serviceName }),
            ...(context?.endpoint !== undefined && { endpoint: context.endpoint }),
            status: response.status,
            statusText: response.statusText,
            ...(validationError.stack !== undefined && { stack: validationError.stack })
          }
        }
      )
    : ((): ReadonlyDeep<BaseError> => {
        const status = response.status as HttpStatusCode
        const correlationId = context?.correlationId ?? extractCorrelationId(response.headers)
        const endpoint = context?.endpoint ?? extractUrlFromResponse(response) ?? "unknown"
        const serviceName = context?.serviceName ?? "external-service"
        return createExternalServiceError({
          serviceName,
          endpoint,
          statusCode: status,
          ...(correlationId !== undefined && { correlationId }),
          ...(context?.startedAt !== undefined && { startedAt: context.startedAt })
        })
      })()
}
/** Нормализует AxiosError в BaseError. Извлекает статус, заголовки, correlationId из response. */
export const normalizeAxiosError = (
  error: ReadonlyDeep<HttpErrorLike>,
  context?: HttpErrorContext
): ReadonlyDeep<BaseError> => {
  return normalizeHttpErrorLike(error, context)
}
/** Нормализует HTTP-ошибку (Response, AxiosError, Error, unknown) в BaseError. Универсальная функция для всех типов HTTP-ошибок. */
export const normalizeHttpError = (
  error: unknown,
  context?: HttpErrorContext
): ReadonlyDeep<BaseError> => {
  return error instanceof Response
    ? normalizeHttpResponse(error, context)
    : ((): ReadonlyDeep<BaseError> => {
        const httpErrorLike = fromAxiosError(error)
        return httpErrorLike !== undefined
          ? normalizeHttpErrorLike(httpErrorLike, context)
          : wrapUnknownError(
              error,
              ERROR_CODE["INFRA_EXTERNAL_SERVICE_ERROR"] as ErrorCode,
              "HTTP request failed",
              {
                context: {
                  ...buildHttpContext(context),
                  ...(error instanceof Error && error.stack !== undefined && { stack: error.stack })
                },
                ...(context?.startedAt !== undefined && { extra: { startedAt: context.startedAt } })
              }
            )
      })()
}
