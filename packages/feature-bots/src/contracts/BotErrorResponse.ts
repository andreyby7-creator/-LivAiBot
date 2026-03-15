/**
 * @file packages/feature-bots/src/contracts/BotErrorResponse.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — BotErrorResponse Contract
 * ============================================================================
 *
 * Архитектурная роль:
 * - Contract-агрегат BotErrorResponse: нормализованный контракт ошибок ботов для API boundary (frontend / SDK).
 * - Используется всеми bot endpoints для единообразной обработки ошибок.
 * - Безопасен для API boundary (не раскрывает внутренние детали).
 * - Совместим с retry-политикой и error-mapping registry.
 *
 * Принципы:
 * - ✅ SRP: только структура контракта ошибок (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явные типы ошибок через exhaustive union для type-safe обработки.
 * - ✅ Contract-pure: без HTTP/DB-деталей, только типы контрактов и инварианты.
 * - ✅ Immutable: все поля readonly для audit trail integrity.
 * - ✅ Extensible: context позволяет эволюцию без ломки core-схемы.
 * - ✅ API-friendly: структурированные ошибки, удобные для UI и SDK.
 */

import type { ISODateString, TraceId } from '@livai/core-contracts';

import type {
  BotErrorCategory,
  BotErrorCode,
  BotErrorContext,
  BotErrorSeverity,
} from '../types/bots.js';

/* ============================================================================
 * 🧩 ERROR RESPONSE TYPES
 * ========================================================================== */

/**
 * Типы ошибок ботов для API boundary.
 * Exhaustive union для type-safe обработки ошибок без if/else-монолита.
 * Соответствует категориям: validation, policy, permission, not_found.
 */
export type BotErrorType =
  // Validation errors
  | 'validation_error'
  | 'name_invalid'
  | 'name_too_short'
  | 'name_too_long'
  | 'name_duplicate'
  | 'instruction_empty'
  | 'instruction_too_long'
  | 'settings_invalid'
  | 'template_not_found'
  | 'version_invalid'
  | 'multi_agent_schema_invalid'
  | 'prompt_invalid'
  | 'workspace_id_invalid'
  // Policy errors
  | 'policy_error'
  | 'policy_action_denied'
  | 'policy_mode_invalid'
  | 'policy_role_insufficient'
  | 'policy_archived'
  | 'policy_system_bot_restricted'
  // Permission errors
  | 'permission_error'
  | 'permission_denied'
  | 'permission_read_denied'
  | 'permission_write_denied'
  | 'permission_execute_denied'
  | 'permission_delete_denied'
  | 'workspace_access_denied'
  // Not found errors
  | 'not_found'
  | 'bot_not_found'
  | 'channel_not_found'
  | 'integration_not_found'
  // Unknown error
  | 'unknown_error';

/**
 * Контракт ошибки бота для API boundary.
 * Используется для единообразной обработки ошибок во всех bot endpoints.
 *
 * Инварианты:
 * - error: тип ошибки (exhaustive union).
 * - code: исходный код ошибки из BotErrorCode (для совместимости с error-mapping registry).
 * - category: категория ошибки (для группировки и фильтрации).
 * - severity: уровень серьёзности (для telemetry и alerts).
 * - retryable: можно ли повторить операцию (для retry-логики).
 * - message: безопасное человеко-читаемое сообщение (опционально, генерируется в UI через i18n).
 * - context: дополнительный контекст ошибки (опционально).
 * - traceId: идентификатор трассировки для distributed tracing (опционально, branded TraceId).
 * - timestamp: временная метка ошибки (ISO 8601, опционально, branded ISODateString).
 *
 * @remarks
 * Runtime validation и sanitization выполняются в lib/bot-error-response-mapper.ts.
 * Sanitization включает фильтрацию чувствительных данных из context/message и проверку формата traceId.
 */
export type BotErrorResponse = Readonly<{
  /** Тип ошибки. */
  readonly error: BotErrorType;
  /** Исходный код ошибки из BotErrorCode (для совместимости с error-mapping registry). */
  readonly code: BotErrorCode;
  /** Категория ошибки. */
  readonly category: BotErrorCategory;
  /** Уровень серьёзности для telemetry и alerts. */
  readonly severity: BotErrorSeverity;
  /** Можно ли повторить операцию. */
  readonly retryable: boolean;
  /** Безопасное человеко-читаемое сообщение (опционально). */
  readonly message?: string;
  /** HTTP статус (если используется на API boundary, опционально). */
  readonly statusCode?: number;
  /** Дополнительный контекст ошибки (опционально). */
  readonly context?: BotErrorContext;
  /** Идентификатор трассировки для distributed tracing (опционально, branded TraceId). */
  readonly traceId?: TraceId;
  /** Временная метка ошибки (ISO 8601, опционально, branded ISODateString). */
  readonly timestamp?: ISODateString;
}>;
