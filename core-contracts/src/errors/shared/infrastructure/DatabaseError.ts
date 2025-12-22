/**
 * @file DatabaseError.ts - Ошибки базы данных LivAiBot
 *
 * TaggedError типы для ошибок базы данных.
 * Pure mapping от внешних ошибок базы данных к BaseError через ErrorBuilders.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';

/**
 * Контекст ошибки базы данных с дополнительными полями
 */
export type DatabaseErrorContext = {
  /** Тип базы данных (postgresql, mysql, mongodb, etc.) */
  readonly databaseType?: string;
  /** Название таблицы/коллекции */
  readonly tableName?: string;
  /** Название операции (select, insert, update, delete) */
  readonly operation?: string;
  /** ID записи */
  readonly recordId?: string;
  /** Query или условия */
  readonly query?: string;
  /** Connection ID */
  readonly connectionId?: string;
  /** Database host */
  readonly host?: string;
  /** Database port */
  readonly port?: number;
};

/**
 * TaggedError тип для ошибок базы данных
 */
export type DatabaseError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.TECHNICAL;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.HIGH;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: DatabaseErrorContext;
  readonly timestamp: string;
}, 'DatabaseError'>;

/**
 * Создает DatabaseError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст ошибки базы данных
 * @param timestamp - опциональный timestamp для тестов
 * @returns DatabaseError
 */
export function createDatabaseError(
  code: ErrorCode,
  message: string,
  context?: DatabaseErrorContext,
  timestamp?: string,
): DatabaseError {
  return {
    _tag: 'DatabaseError',
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.HIGH,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as DatabaseError;
}

/**
 * Проверяет, является ли объект допустимым DatabaseErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует DatabaseErrorContext
 */
export function isValidDatabaseErrorContext(context: unknown): context is DatabaseErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем базовые поля ErrorMetadataDomainContext
  if (typeof ctx['type'] !== 'string') return false;

  // Проверяем опциональные поля DatabaseErrorContext
  if (ctx['databaseType'] !== undefined && typeof ctx['databaseType'] !== 'string') return false;
  if (ctx['tableName'] !== undefined && typeof ctx['tableName'] !== 'string') return false;
  if (ctx['operation'] !== undefined && typeof ctx['operation'] !== 'string') return false;
  if (ctx['recordId'] !== undefined && typeof ctx['recordId'] !== 'string') return false;
  if (ctx['query'] !== undefined && typeof ctx['query'] !== 'string') return false;
  if (ctx['connectionId'] !== undefined && typeof ctx['connectionId'] !== 'string') return false;
  if (ctx['host'] !== undefined && typeof ctx['host'] !== 'string') return false;
  if (
    ctx['port'] !== undefined && (typeof ctx['port'] !== 'number' || !Number.isInteger(ctx['port']))
  ) return false;

  return true;
}

/**
 * Type guard для проверки, является ли ошибка DatabaseError
 * @param error - ошибка для проверки
 * @returns true если это DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'DatabaseError'
    && candidate['category'] === ERROR_CATEGORY.TECHNICAL
    && candidate['origin'] === ERROR_ORIGIN.INFRASTRUCTURE
    && candidate['severity'] === ERROR_SEVERITY.HIGH
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined || isValidDatabaseErrorContext(candidate['details']))
  );
}

/**
 * Извлекает тип базы данных из DatabaseError
 * @param error - DatabaseError
 * @returns тип базы данных или undefined
 */
export function getDatabaseType(error: DatabaseError): string | undefined {
  return error.details?.databaseType;
}

/**
 * Извлекает название таблицы из DatabaseError
 * @param error - DatabaseError
 * @returns название таблицы или undefined
 */
export function getTableName(error: DatabaseError): string | undefined {
  return error.details?.tableName;
}

/**
 * Извлекает информацию о соединении из DatabaseError
 * @param error - DatabaseError
 * @returns информация о соединении или undefined
 */
export function getDatabaseConnection(error: DatabaseError): {
  connectionId?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
} | undefined {
  const details = error.details;
  if (!details) return undefined;

  return {
    connectionId: details.connectionId,
    host: details.host,
    port: details.port,
  };
}

/**
 * Извлекает операцию базы данных из DatabaseError
 * @param error - DatabaseError
 * @returns операция или undefined
 */
export function getDatabaseOperation(error: DatabaseError): string | undefined {
  return error.details?.operation;
}

/**
 * Проверяет, является ли DatabaseError ошибкой соединения
 * @param error - DatabaseError
 * @returns true если ошибка связана с соединением
 */
export function isDatabaseConnectionError(error: DatabaseError): boolean {
  return (
    error.details?.connectionId !== undefined
    || error.details?.host !== undefined
  );
}
