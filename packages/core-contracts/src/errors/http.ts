/**
 * @file Типы ошибок для HTTP API
 */

/**
 * Единый контракт ошибки для HTTP API.
 *
 * Принцип: клиент всегда получает одинаковую форму независимо от сервиса.
 */
export type ErrorResponse = {
  code: ErrorCode;
  message: string;
  trace_id?: string;
  details?: Record<string, unknown> | null;
};

/**
 * Стандартизированные коды ошибок.
 *
 * Используются как string literals для совместимости с JSON API.
 * Для обратной совместимости при добавлении новых кодов.
 */
export const ERROR_CODES = Object.freeze(
  {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DOWNSTREAM_UNAVAILABLE: 'DOWNSTREAM_UNAVAILABLE',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  } as const,
);

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
