/**
 * @file ErrorConstants — стабильные константы для error handling
 *
 * ✅ FP-совместимо: immutable константы
 * ✅ Type-safe: typed constants вместо магических строк
 * ✅ Extensible: новые значения добавляются без изменения существующих
 * ✅ Runtime mutation возможна, но discouraged (developer discipline required)
 * ✅ Используется в ErrorMetadata, ErrorShape, UI mapping, logging
 *
 * ❗ ВАЖНО: Это НЕ TypeScript enums, а frozen constant objects
 * - Используем Object.freeze() + as const для runtime immutability
 * - TypeScript enums имеют проблемы с tree-shaking и ABI стабильностью
 * - Frozen objects лучше для FP подхода (нет reverse mapping, чище типы)
 * - Не пытайтесь "оптимизировать" это в enum - это архитектурное решение
 */

import type { ReadonlyDeep } from "type-fest"

/* -------------------------------------------------------------------------------------------------
 * 🔹 Error Severity Constants (Уровни серьезности ошибок)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Стабильные константы уровней серьезности ошибок
 *
 * ⚠️ Enum-like frozen constants object, NOT TypeScript enum
 * - Использует Object.freeze() + as const для immutability
 * - Не имеет reverse mapping (как в enum)
 * - Лучше для tree-shaking и ABI стабильности
 *
 * Используются для:
 * - Логирования (debug/info/warn/error/fatal)
 * - Мониторинга и алертинга
 * - UI индикации серьезности
 * - Приоритизации обработки
 */
export const ERROR_SEVERITY: ReadonlyDeep<Record<string, string>> = Object.freeze({
  /** Отладочная информация (не показывать пользователям) */
  LOW: "low",

  /** Информационное сообщение (показывать в логах) */
  MEDIUM: "medium",

  /** Предупреждение (показывать пользователям, но не блокировать) */
  HIGH: "high",

  /** Критическая ошибка (блокировать операцию, алерт) */
  CRITICAL: "critical",
} as const)

/**
 * Union type всех допустимых уровней серьезности
 */
export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY]

/**
 * Type guard для проверки корректности ErrorSeverity
 */
export const isErrorSeverity = (value: unknown): value is ErrorSeverity =>
  typeof value === "string" &&
  (Object.values(ERROR_SEVERITY) as ReadonlyArray<string>).includes(value)

/* -------------------------------------------------------------------------------------------------
 * 🔹 Error Category Constants (Категории ошибок)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Стабильные константы категорий ошибок
 *
 * ⚠️ Enum-like frozen constants object, NOT TypeScript enum
 * - Использует Object.freeze() + as const для immutability
 * - Не имеет reverse mapping (как в enum)
 * - Лучше для tree-shaking и ABI стабильности
 *
 * Используются для:
 * - UI mapping (цвета, иконки, стили)
 * - Группировки в логах и мониторинге
 * - Определения стратегии обработки
 * - Локализации сообщений
 */
export const ERROR_CATEGORY: ReadonlyDeep<Record<string, string>> = Object.freeze({
  /** Ошибки валидации входных данных */
  VALIDATION: "validation",

  /** Ошибки авторизации и доступа */
  AUTHORIZATION: "authorization",

  /** Бизнес-логика нарушения (domain rules) */
  BUSINESS: "business",

  /** Инфраструктурные ошибки (IO, network, DB) */
  INFRASTRUCTURE: "infrastructure",

  /** Неизвестные/неопределенные ошибки */
  UNKNOWN: "unknown",
} as const)

/**
 * Union type всех допустимых категорий ошибок
 */
export type ErrorCategory = typeof ERROR_CATEGORY[keyof typeof ERROR_CATEGORY]

/**
 * Type guard для проверки корректности ErrorCategory
 */
export const isErrorCategory = (value: unknown): value is ErrorCategory =>
  typeof value === "string" &&
  (Object.values(ERROR_CATEGORY) as ReadonlyArray<string>).includes(value)

/* -------------------------------------------------------------------------------------------------
 * 🔹 Error Origin Constants (Происхождение ошибок)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Стабильные константы происхождения ошибок
 *
 * ⚠️ Enum-like frozen constants object, NOT TypeScript enum
 * - Использует Object.freeze() + as const для immutability
 * - Не имеет reverse mapping (как в enum)
 * - Лучше для tree-shaking и ABI стабильности
 *
 * Используются для:
 * - Трассировки источника ошибки
 * - Определения стратегии обработки
 * - Мониторинга по слоям приложения
 */
export const ERROR_ORIGIN: ReadonlyDeep<Record<string, string>> = Object.freeze({
  /** Domain слой (чистый бизнес) */
  DOMAIN: "domain",

  /** Application слой (оркестрация use-case) */
  APPLICATION: "application",

  /** Infrastructure слой (IO, network, DB) */
  INFRASTRUCTURE: "infrastructure",

  /** Security слой (auth, permissions) */
  SECURITY: "security",
} as const)

/**
 * Union type всех допустимых происхождений ошибок
 */
export type ErrorOrigin = typeof ERROR_ORIGIN[keyof typeof ERROR_ORIGIN]

/**
 * Type guard для проверки корректности ErrorOrigin
 */
export const isErrorOrigin = (value: unknown): value is ErrorOrigin =>
  typeof value === "string" &&
  (Object.values(ERROR_ORIGIN) as ReadonlyArray<string>).includes(value)