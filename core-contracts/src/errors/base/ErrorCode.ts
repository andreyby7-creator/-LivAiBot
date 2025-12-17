/**
 * @file Определение ERROR_CODE — стабильного ABI контракта кодов ошибок
 *
 * Используется во всех слоях Core Contracts:
 * Domain / Application / IO / Context / Targets
 * и для проверки стабильности через golden tests.
 *
 * ❗ ВАЖНО:
 * - Это НЕ enum (enum небезопасен для ABI и tree-shaking)
 * - Значения НИКОГДА не переименовываются
 * - Семантика НИКОГДА не меняется
 * - Допускается ТОЛЬКО добавление новых кодов
 * - Любые изменения → ADR
 */

/* -------------------------------------------------------------------------------------------------
 * 🔹 Пространство имён ERROR_CODE (Стабильный ABI)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Коды ошибок Domain Layer (чистый бизнес)
 *
 * ⚠️ ВАЖНО: ERROR_CODE не должен использоваться напрямую в бизнес-логике!
 * Всегда используйте через error interfaces (DomainError, InfrastructureError, etc.)
 * Это предотвращает "магические строки" и обеспечивает type safety.
 */
export const ERROR_CODE: Readonly<Record<string, string>> = {
  DOMAIN_ENTITY_NOT_FOUND: "DOMAIN_ENTITY_NOT_FOUND",
  DOMAIN_INVALID_STATE: "DOMAIN_INVALID_STATE",
  DOMAIN_RULE_VIOLATION: "DOMAIN_RULE_VIOLATION",
  DOMAIN_CONFLICT: "DOMAIN_CONFLICT",
  DOMAIN_INVARIANT_BROKEN: "DOMAIN_INVARIANT_BROKEN",

  /* Application Layer (оркестрация use-case) */
  APPLICATION_COMMAND_REJECTED: "APPLICATION_COMMAND_REJECTED",
  APPLICATION_QUERY_FAILED: "APPLICATION_QUERY_FAILED",
  APPLICATION_PERMISSION_DENIED: "APPLICATION_PERMISSION_DENIED",

  /* Infrastructure Layer (IO / runtime) */
  INFRA_NETWORK_ERROR: "INFRA_NETWORK_ERROR",
  INFRA_TIMEOUT: "INFRA_TIMEOUT",
  INFRA_DATABASE_ERROR: "INFRA_DATABASE_ERROR",
  INFRA_EXTERNAL_SERVICE_ERROR: "INFRA_EXTERNAL_SERVICE_ERROR",
  INFRA_RESOURCE_UNAVAILABLE: "INFRA_RESOURCE_UNAVAILABLE",

  /* Security Layer */
  SECURITY_UNAUTHORIZED: "SECURITY_UNAUTHORIZED",
  SECURITY_FORBIDDEN: "SECURITY_FORBIDDEN",
  SECURITY_TOKEN_EXPIRED: "SECURITY_TOKEN_EXPIRED",
  SECURITY_RATE_LIMITED: "SECURITY_RATE_LIMITED",

  /* Validation / input */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  VALIDATION_SCHEMA_MISMATCH: "VALIDATION_SCHEMA_MISMATCH",
  VALIDATION_REQUIRED_FIELD_MISSING: "VALIDATION_REQUIRED_FIELD_MISSING",

  /* Fallback / Unknown (используется только как catch-all) */
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const

/* -------------------------------------------------------------------------------------------------
 * 🔹 Тип ErrorCode
 * ------------------------------------------------------------------------------------------------- */

/**
 * Union type всех допустимых кодов ошибок
 *
 * Используется для:
 * - ErrorMetadata.code
 * - Pattern matching
 * - Exhaustive проверки
 */
export type ErrorCode = typeof ERROR_CODE[keyof typeof ERROR_CODE]

/* -------------------------------------------------------------------------------------------------
 * 🔹 Type Guards и утилиты
 * ------------------------------------------------------------------------------------------------- */

/**
 * Проверка в runtime, что значение является допустимым ErrorCode
 *
 * ❗ Используется ТОЛЬКО на границах (normalizers, targets)
 */
export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === "string" &&
  (Object.values(ERROR_CODE) as readonly string[]).includes(value)

/**
 * Exhaustive helper для switch / match на ErrorCode
 * Используется для строгой проверки всех кейсов.
 *
 * @example
 * ```typescript
 * switch (error.metadata.code) {
 *   case ERROR_CODE.DOMAIN_RULE_VIOLATION:
 *     // Обработка нарушения правила домена
 *     break
 *   default:
 *     assertNever(error.metadata.code)
 * }
 * ```
 */
export const assertNever = (value: never): never => {
  throw new Error(`Обработанный код ошибки отсутствует: ${String(value)}`)
}

/* -------------------------------------------------------------------------------------------------
 * 🔹 Правила расширения (только документация)
 * ------------------------------------------------------------------------------------------------- */

/**
 * 🔒 Политика расширений ERROR_CODE:
 *
 * ✅ Разрешено:
 * - Добавлять новые значения в ERROR_CODE
 *
 * ❌ Запрещено:
 * - Переименовывать существующие значения
 * - Менять семантику существующих кодов
 * - Привязывать ERROR_CODE к HTTP / gRPC / UI
 *
 * Любые изменения → ADR (например, ADR-0001: Add New Error Code)
 */
