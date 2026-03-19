/**
 * @file packages/feature-bots/src/effects/shared/mapper.contracts.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Shared Mapper Contracts
 * ============================================================================
 *
 * Общие контракты mapper-слоя для feature-bots effects.
 * Используются в create/update/delete/... API мапперах для единообразной
 * типизации issue-структур и кодов mapping-level ошибок.
 */

/* ============================================================================
 * 🧭 CONSTANTS
 * ============================================================================
 */

/** Канонический код parsing/mapping ошибки для boundary API мапперов. */
export const mapperErrorCodeParsingJsonInvalid = 'BOT_PARSING_JSON_INVALID' as const;

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Нормализованная issue-запись для schema/shape ошибок на boundary.
 *
 * @remarks
 * Это mapping-level структура для диагностики в `BotErrorResponse.context.details`.
 * Не является бизнес-доменной ошибкой.
 */
export type ParseIssue = Readonly<{
  readonly path: string;
  readonly message: string;
}>;
