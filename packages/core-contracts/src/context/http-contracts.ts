/**
 * @file @livai/core-contracts/context/http-contracts.ts
 * ============================================================================
 * 🌐 HTTP — BASE HTTP CONTRACTS (METHODS, SERVICE IDENTIFIERS)
 * ============================================================================
 *
 * Foundation-типы для HTTP protocol primitives и service identifiers.
 * Заметка по архитектуре:
 * - HttpMethod должен быть extensible (HTTP spec расширяется, и бывают внутренние verb'ы).
 * - Service identifier не должен быть closed union (избегаем core-contracts churn при добавлении сервисов).
 */

/* ============================================================================
 * 🌐 HTTP METHOD — PROTOCOL PRIMITIVE
 * ========================================================================== */

/**
 * Поддерживаемые HTTP методы.
 * Production: canonical base + extension capability (не closed union).
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'
  // Extension capability: CONNECT/TRACE/PROPFIND/INTERNAL/etc без изменения core-contracts
  | Uppercase<string>;

/* ============================================================================
 * 🧭 SERVICE NAME — SERVICE IDENTIFIER (NOT TOPOLOGY)
 * ========================================================================== */

/**
 * Идентификатор сервиса (service discovery / routing key).
 * Production: extensible union — новые сервисы не требуют правок core-contracts.
 * NOTE: registry/topology держите в infra, этот тип — только identifier/shape.
 */
export type ServiceName =
  | 'auth'
  | 'billing'
  | 'chat'
  | 'bots'
  | 'gateway'
  | (string & {});
