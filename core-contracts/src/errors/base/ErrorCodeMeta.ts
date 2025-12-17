/**
 * @file ErrorCodeMeta.ts — расширенные метаданные для всех кодов ошибок
 *
 * Полный набор метаданных для каждого error code с функциональными хелперами.
 * Обеспечивает semantic classification, operational guidance и observability.
 * 🎯 Единый источник истины для всех метаданных ошибок.
 * 🔄 Runtime guards и type-safe helpers для работы с метаданными.
 * 📊 Стандартизированные метрики для observability.
 * 🔒 SemVer политика для стабильности ABI.
 */
import { ERROR_SEVERITY, isErrorSeverity, isErrorCategory, isErrorOrigin, type ErrorSeverity, type ErrorCategory, type ErrorOrigin } from './ErrorConstants.js'

import type { ErrorCode } from './ErrorCode.js'
import type { ReadonlyDeep } from 'type-fest'

/* -------------------------------------------------------------------------------------------------
 * 🔹 Базовые типы для метаданных
 * ------------------------------------------------------------------------------------------------- */
/** HTTP статус коды для ошибок. Protocol mapping для REST API responses. Поддерживает все стандартные HTTP статус коды (100-599). */
export type HttpStatusCode =
  // 1xx Informational
  | 100 | 101 | 102 | 103
  // 2xx Success
  | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226
  // 3xx Redirection
  | 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308
  // 4xx Client Error
  | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409
  | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421
  | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
  // 5xx Server Error
  | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511
  // Non-standard codes (используются некоторыми серверами)
  | 495 | 496 | 497 | 498 | 499 | 598 | 599

/** Категория HTTP статус кода. Используется для классификации и группировки статусов. */
export type HttpStatusCategory = 'informational' | 'success' | 'redirect' | 'client' | 'server'

/** Результат валидации HTTP статус кода. Структурированный результат для функциональной обработки ошибок. */
export type HttpStatusValidationResult =
  | { valid: true; value: number }
  | {
      valid: false
      reason: 'TypeMismatch' | 'OutOfRange' | 'InvalidFormat'
      details: {
        message: string
        expected: string
        received: unknown
        field: string
        suggestion?: string
        context?: Record<string, unknown>
      }
    }

/** Константы диапазонов HTTP статус кодов */
export const HTTP_STATUS_RANGE = Object.freeze({
  MIN: 100,
  MAX: 599
} as const)
/** Константы диапазонов по категориям */
export const HTTP_STATUS_CATEGORY_RANGES = Object.freeze({
  INFORMATIONAL: { min: 100, max: 199 },
  SUCCESS: { min: 200, max: 299 },
  REDIRECT: { min: 300, max: 399 },
  CLIENT_ERROR: { min: 400, max: 499 },
  SERVER_ERROR: { min: 500, max: 599 }
} as const)

/** Проверяет, является ли число валидным HTTP статус кодом. Простая проверка диапазона (100-599) без type narrowing. */
export const isValidHttpStatusCode = (code: number): boolean =>
  Number.isInteger(code) && code >= HTTP_STATUS_RANGE.MIN && code <= HTTP_STATUS_RANGE.MAX
/** Type guard для проверки, является ли значение валидным HttpStatusCode. Выполняет runtime валидацию и предоставляет TypeScript type narrowing. */
export const isHttpStatusCode = (value: unknown): value is HttpStatusCode =>
  typeof value === 'number' && isValidHttpStatusCode(value)
/** Определяет категорию HTTP статус кода. @returns категория статуса или undefined если код вне диапазона */
export const getHttpStatusCategory = (code: number): HttpStatusCategory | undefined => {
  return !isValidHttpStatusCode(code)
    ? undefined
    : code >= HTTP_STATUS_CATEGORY_RANGES.INFORMATIONAL.min && code <= HTTP_STATUS_CATEGORY_RANGES.INFORMATIONAL.max
      ? 'informational'
      : code >= HTTP_STATUS_CATEGORY_RANGES.SUCCESS.min && code <= HTTP_STATUS_CATEGORY_RANGES.SUCCESS.max
        ? 'success'
        : code >= HTTP_STATUS_CATEGORY_RANGES.REDIRECT.min && code <= HTTP_STATUS_CATEGORY_RANGES.REDIRECT.max
          ? 'redirect'
          : code >= HTTP_STATUS_CATEGORY_RANGES.CLIENT_ERROR.min && code <= HTTP_STATUS_CATEGORY_RANGES.CLIENT_ERROR.max
            ? 'client'
            : code >= HTTP_STATUS_CATEGORY_RANGES.SERVER_ERROR.min && code <= HTTP_STATUS_CATEGORY_RANGES.SERVER_ERROR.max
              ? 'server'
              : undefined
}

/** Валидирует HTTP статус код и возвращает структурированный результат. Функциональная альтернатива с явной обработкой ошибок вместо исключений. */
export const validateHttpStatusCode = (code: unknown): ReadonlyDeep<HttpStatusValidationResult> => {
  const createError = (reason: 'TypeMismatch' | 'OutOfRange', message: string, expected: string, suggestion: string, context?: ReadonlyDeep<Record<string, unknown>>): ReadonlyDeep<Extract<HttpStatusValidationResult, { valid: false }>> => ({
    valid: false as const,
    reason,
    details: { message, expected, received: code, field: 'code' as const, suggestion, ...(context && { context }) }
  } as const)
  return typeof code !== 'number'
    ? createError('TypeMismatch', 'HTTP status code must be a number', 'number', 'Provide a numeric HTTP status code between 100 and 599')
    : !Number.isFinite(code) || Number.isNaN(code)
      ? createError('TypeMismatch', 'HTTP status code must be a finite number', 'finite number', 'Provide a valid numeric HTTP status code')
      : !Number.isInteger(code)
        ? createError('TypeMismatch', 'HTTP status code must be an integer', 'integer', 'HTTP status codes are always integers (no decimals)')
        : code < HTTP_STATUS_RANGE.MIN
          ? createError('OutOfRange', 'HTTP status code is below minimum valid range', `≥ ${HTTP_STATUS_RANGE.MIN}`, `HTTP status codes start from ${HTTP_STATUS_RANGE.MIN}`, { min: HTTP_STATUS_RANGE.MIN, max: HTTP_STATUS_RANGE.MAX })
          : code > HTTP_STATUS_RANGE.MAX
            ? createError('OutOfRange', 'HTTP status code is above maximum valid range', `≤ ${HTTP_STATUS_RANGE.MAX}`, `HTTP status codes end at ${HTTP_STATUS_RANGE.MAX}`, { min: HTTP_STATUS_RANGE.MIN, max: HTTP_STATUS_RANGE.MAX })
            : ({ valid: true as const, value: code } as const)
}
/** gRPC статус коды. Protocol mapping для gRPC API responses. Type-safe union всех стандартных gRPC кодов (0-16). */
export type GrpcStatusCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16

/** Валидирует что значение является корректным gRPC статус кодом */
export const isGrpcStatusCode = (value: unknown): value is GrpcStatusCode =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 16
/** Метрики для observability. Стандартизированные имена для Prometheus/OpenTelemetry метрик. Формат: {layer}_{kind}_{code_snake_case}_{type} */
export interface ErrorMetrics {
  /** Название счетчика для метрик (counter) */
  counter: string
  /** Название гистограммы для latency (histogram) */
  histogram: string
}

/** Type guard для проверки ErrorMetrics */
export const isErrorMetrics = (value: unknown): value is ErrorMetrics => {
  const obj = typeof value === 'object' && value !== null
    ? value as ReadonlyDeep<Record<string, unknown>>
    : null
  return obj !== null && typeof obj['counter'] === 'string' && typeof obj['histogram'] === 'string'
}
/** SemVer политика для кодов ошибок. Правила версионирования для стабильности ABI. Используется в golden tests и CI/CD валидации. */
export interface SemVerPolicy {
  /** Версия при добавлении нового кода */
  add: 'PATCH' | 'MINOR' | 'MAJOR'
  /** Версия при изменении существующего кода */
  change: 'PATCH' | 'MINOR' | 'MAJOR'
  /** Версия при удалении кода */
  remove: 'MAJOR'
  /** Версия при исправлении бага (internal fix без изменения ABI) */
  patch?: 'PATCH' | 'MINOR'
}

/** Полные метаданные для кода ошибки. Единый источник истины для semantic classification, operational guidance, protocol mapping, observability и versioning. */
export interface ErrorCodeMeta {
  /** Слой приложения (semantic classification) */
  layer: ErrorOrigin
  /** Semantic kind ошибки (domain-specific classification) */
  kind: string
  /** Уровень критичности (operational guidance) */
  severity: ErrorSeverity
  /** Категория ошибки (semantic classification) */
  category: ErrorCategory
  /** Можно ли автоматически повторить операцию (operational guidance) */
  retryable: boolean
  /** Можно ли восстановить вручную или через бизнес-процесс (operational guidance) */
  recoverable: boolean
  /** HTTP статус для REST API (protocol mapping) */
  httpStatus: HttpStatusCode
  /** gRPC статус для gRPC API (protocol mapping) */
  grpcStatus: GrpcStatusCode
  /** Метрики для observability (Prometheus/OpenTelemetry) */
  metrics: ErrorMetrics
  /** SemVer правила для версионирования */
  semver: SemVerPolicy
  /** Human-readable описание (опционально) */
  description?: string
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Default метаданные для новых кодов ошибок
 * ------------------------------------------------------------------------------------------------- */
/** Метаданные по умолчанию для новых кодов ошибок. Уменьшает дублирование при создании новых кодов. Extensible для новых слоёв (integration, third_party и т.д.). ⚠️ Поле `metrics` не включено в defaults, так как оно обязательное и должно быть явно передано в `createErrorCodeMetaWithDefaults`. */
export const DEFAULT_ERROR_CODE_META: ReadonlyDeep<Partial<ErrorCodeMeta>> = Object.freeze({
  severity: ERROR_SEVERITY['MEDIUM'] as ErrorSeverity,
  retryable: false,
  recoverable: false,
  httpStatus: 500,
  grpcStatus: 13, // INTERNAL
  semver: {
    add: 'MINOR',
    change: 'MAJOR',
    remove: 'MAJOR',
    patch: 'PATCH'
  }
} as const)

/** Создает метаданные с применением defaults. Объединяет переданные метаданные с DEFAULT_ERROR_CODE_META. Уменьшает дублирование при создании новых кодов ошибок. */
export const createErrorCodeMetaWithDefaults = (
  meta: ReadonlyDeep<Partial<ErrorCodeMeta> & Pick<ErrorCodeMeta, 'layer' | 'kind' | 'category' | 'httpStatus' | 'grpcStatus' | 'metrics'>>
): ReadonlyDeep<ErrorCodeMeta> => {
  return !isErrorMetrics(meta.metrics)
    ? ((): never => {
        throw new Error('createErrorCodeMetaWithDefaults: metrics is required and must be a valid ErrorMetrics object')
      })()
    : Object.freeze({
        ...DEFAULT_ERROR_CODE_META,
        ...meta,
        severity: meta.severity ?? (DEFAULT_ERROR_CODE_META.severity as ErrorSeverity),
        retryable: meta.retryable ?? (DEFAULT_ERROR_CODE_META.retryable as boolean),
        recoverable: meta.recoverable ?? (DEFAULT_ERROR_CODE_META.recoverable as boolean),
        semver: meta.semver ?? (DEFAULT_ERROR_CODE_META.semver as SemVerPolicy)
      } as ReadonlyDeep<ErrorCodeMeta>)
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Утилиты для преобразования строк (для метрик/логов)
 * ------------------------------------------------------------------------------------------------- */
/** Преобразует строку в snake_case формат. Поддерживает UPPER_SNAKE_CASE, camelCase, PascalCase, kebab-case. */
export const toSnakeCase = (str: string): string => {
  return str
    .replace(/-/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/_+/g, '_')
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Helper для генерации стандартизированных имен метрик
 * ------------------------------------------------------------------------------------------------- */
/** Генерирует стандартизированное имя метрики для кода ошибки. Формат: Counter: {layer}_{kind}_{code_snake_case}_total, Histogram: {layer}_{kind}_{code_snake_case}_duration_seconds */
export const generateMetricName = (
  layer: ErrorOrigin,
  kind: string,
  code: ErrorCode
): ReadonlyDeep<ErrorMetrics> => {
  const codeSnakeCase = toSnakeCase(code)

  return {
    counter: `${layer}_${kind}_${codeSnakeCase}_total`,
    histogram: `${layer}_${kind}_${codeSnakeCase}_duration_seconds`
  } as ReadonlyDeep<ErrorMetrics>
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Runtime Guards для валидации метаданных
 * ------------------------------------------------------------------------------------------------- */
/** Валидирует поля ErrorCodeMeta и возвращает список ошибок валидации */
const validateErrorCodeMetaFields = (v: ReadonlyDeep<Record<string, unknown>>): ReadonlyDeep<string[]> => {
  // Core classification
  const layerValid = isErrorOrigin(v['layer'])
  const kindValid = typeof v['kind'] === 'string'
  const severityValid = isErrorSeverity(v['severity'])
  const categoryValid = isErrorCategory(v['category'])
  const retryableValid = typeof v['retryable'] === 'boolean'
  const recoverableValid = typeof v['recoverable'] === 'boolean'
  const httpStatusValid = isHttpStatusCode(v['httpStatus'])
  const grpcStatusValid = isGrpcStatusCode(v['grpcStatus'])
  const metricsValid = typeof v['metrics'] === 'object' && v['metrics'] !== null
  const semverValid = typeof v['semver'] === 'object' && v['semver'] !== null
  const metricsErrors: ReadonlyDeep<string[]> = metricsValid ? ((): ReadonlyDeep<string[]> => {
    const m = v['metrics'] as ReadonlyDeep<Record<string, unknown>>
    const counterValid = typeof m['counter'] === 'string'
    const histogramValid = typeof m['histogram'] === 'string'
    return [
      ...(!counterValid ? ['metrics.counter: expected string'] : []),
      ...(!histogramValid ? ['metrics.histogram: expected string'] : [])
    ] as ReadonlyDeep<string[]>
  })() : []
  const semverErrors: ReadonlyDeep<string[]> = semverValid ? ((): ReadonlyDeep<string[]> => {
    const s = v['semver'] as ReadonlyDeep<Record<string, unknown>>
    const validAdd = s['add'] === 'PATCH' || s['add'] === 'MINOR' || s['add'] === 'MAJOR'
    const validChange = s['change'] === 'PATCH' || s['change'] === 'MINOR' || s['change'] === 'MAJOR'
    const validRemove = s['remove'] === 'MAJOR'
    const validPatch = !('patch' in s) || s['patch'] === 'PATCH' || s['patch'] === 'MINOR'
    return [
      ...(!validAdd ? ['semver.add: expected PATCH, MINOR or MAJOR'] : []),
      ...(!validChange ? ['semver.change: expected PATCH, MINOR or MAJOR'] : []),
      ...(!validRemove ? ['semver.remove: expected MAJOR'] : []),
      ...(!validPatch ? ['semver.patch: expected PATCH or MINOR'] : [])
    ] as ReadonlyDeep<string[]>
  })() : []
  const descriptionError: ReadonlyDeep<string[]> = 'description' in v && typeof v['description'] !== 'string' ? ['description: expected string or undefined'] as ReadonlyDeep<string[]> : []
  return [
    ...(!layerValid ? ['layer: invalid ErrorOrigin'] : []),
    ...(!kindValid ? ['kind: expected string'] : []),
    ...(!severityValid ? ['severity: invalid ErrorSeverity'] : []),
    ...(!categoryValid ? ['category: invalid ErrorCategory'] : []),
    ...(!retryableValid ? ['retryable: expected boolean'] : []),
    ...(!recoverableValid ? ['recoverable: expected boolean'] : []),
    ...(!httpStatusValid ? ['httpStatus: invalid HttpStatusCode'] : []),
    ...(!grpcStatusValid ? ['grpcStatus: invalid GrpcStatusCode'] : []),
    ...(!metricsValid ? ['metrics: expected object'] : []),
    ...metricsErrors,
    ...(!semverValid ? ['semver: expected object'] : []),
    ...semverErrors,
    ...descriptionError
  ] as ReadonlyDeep<string[]>
}
/** Type guard для проверки корректности ErrorCodeMeta. Валидирует все обязательные поля интерфейса ErrorCodeMeta. Используется для безопасной валидации динамических объектов метаданных. */
export const isErrorCodeMeta = (value: unknown): value is ErrorCodeMeta => {
  const v = typeof value !== 'object' || value === null
    ? null
    : value as ReadonlyDeep<Record<string, unknown>>

  return v !== null && validateErrorCodeMetaFields(v).length === 0
}
/** Runtime guard с выбросом ошибки для проверки ErrorCodeMeta. Удобный helper для валидации метаданных с явным выбросом ошибки при несоответствии. Используется для строгой валидации на границах системы. */
export const assertErrorCodeMeta = (value: unknown): asserts value is ErrorCodeMeta => {
  return !isErrorCodeMeta(value)
    ? ((): never => {
        const v = typeof value !== 'object' || value === null
          ? null
          : value as ReadonlyDeep<Record<string, unknown>>

        const errorMessage = v === null
          ? `Invalid ErrorCodeMeta: expected object, got ${typeof value}`
          : `Invalid ErrorCodeMeta: ${validateErrorCodeMetaFields(v).join('; ')}`

        throw new Error(errorMessage)
      })()
    : undefined
}
