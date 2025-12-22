/**
 * @file Database нормализатор ошибок для LivAiBot
 *
 * Чистая функция нормализации ошибок базы данных. Преобразует неизвестные ошибки БД
 * в стандартизированные TaggedError типы с извлечением constraint violations и анализом transaction state.
 *
 * Поддерживает PostgreSQL, MySQL, SQLite, MongoDB и другие базы данных.
 */

import { LIVAI_ERROR_CODES } from '../../base/ErrorCode.js';
import { createDatabaseError } from '../infrastructure/DatabaseError.js';

import type { DatabaseError } from '../infrastructure/DatabaseError.js';
import type { SharedAdapterError } from '../SharedErrorTypes.js';

/** MySQL error codes */
const MYSQL_ERROR_CODES = {
  ER_DUP_ENTRY: 1062,
  ER_NO_REFERENCED_ROW: 1452,
  ER_ROW_IS_REFERENCED: 1451,
  ER_BAD_NULL_ERROR: 1048,
  ER_LOCK_DEADLOCK: 1213,
} as const;

/** MongoDB error codes */
const MONGODB_ERROR_CODES = {
  E11000_DUPLICATE_KEY: 11000,
} as const;

/** Входные данные ошибки базы данных */
export type DatabaseErrorInput = unknown;

/** Результат нормализации ошибки базы данных */
export type DatabaseNormalizationResult =
  | DatabaseError
  | SharedAdapterError<Record<string, unknown>>;

/** Контекст операции базы данных */
export type DatabaseOperationContext = {
  readonly databaseType?: string;
  readonly tableName?: string;
  readonly operation?: string;
  readonly recordId?: string;
  readonly query?: string;
  readonly connectionId?: string;
  readonly host?: string;
  readonly port?: number;
  readonly constraintName?: string;
  readonly constraintType?: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  readonly transactionState?:
    | 'active'
    | 'committed'
    | 'rolled_back'
    | 'failed'
    | 'timeout'
    | 'deadlock';
  readonly isolationLevel?: string;
  readonly lockTimeout?: number;
};

/** Создает DatabaseOperationContext с валидными значениями */
function createDatabaseOperationContext(values: Record<string, unknown>): DatabaseOperationContext {
  const filtered = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v != null),
  );
  return filtered as DatabaseOperationContext;
}

/** Type guard для объектов */
const isObject = (obj: unknown): obj is Record<string, unknown> =>
  typeof obj === 'object' && obj !== null;

/** Helper для извлечения типа constraint по коду ошибки */
function extractConstraintType(
  input: Record<string, unknown>,
): DatabaseOperationContext['constraintType'] | undefined {
  const codeStr = typeof input['code'] === 'string' ? input['code'] : '';
  const codeNum = typeof input['code'] === 'number' ? input['code'] : 0;
  const errno = typeof input['errno'] === 'number' ? input['errno'] : 0;
  const message = typeof input['message'] === 'string' ? input['message'] : '';

  // PostgreSQL codes (string)
  if (codeStr === '23505') return 'unique';
  if (codeStr === '23503') return 'foreign_key';
  if (codeStr === '23502') return 'not_null';
  if (codeStr === '23514') return 'check';
  if (codeStr === '23506') return 'primary_key';

  // MySQL codes
  if (codeStr === 'ER_DUP_ENTRY' || errno === MYSQL_ERROR_CODES.ER_DUP_ENTRY) return 'unique';
  if (codeStr === 'ER_NO_REFERENCED_ROW' || errno === MYSQL_ERROR_CODES.ER_NO_REFERENCED_ROW) {
    return 'foreign_key';
  }
  if (codeStr === 'ER_ROW_IS_REFERENCED' || errno === MYSQL_ERROR_CODES.ER_ROW_IS_REFERENCED) {
    return 'foreign_key';
  }
  if (codeStr === 'ER_BAD_NULL_ERROR' || errno === MYSQL_ERROR_CODES.ER_BAD_NULL_ERROR) {
    return 'not_null';
  }

  // SQLite patterns (regex для более точного матчинга)
  const sqliteUniqueRegex = /SQLITE_CONSTRAINT.*UNIQUE\s+constraint/i;
  const sqliteForeignKeyRegex = /SQLITE_CONSTRAINT.*FOREIGN\s+KEY\s+constraint/i;
  const sqliteNotNullRegex = /SQLITE_CONSTRAINT.*NOT\s+NULL\s+constraint/i;
  const sqliteCheckRegex = /SQLITE_CONSTRAINT.*CHECK\s+constraint/i;
  const sqlitePrimaryKeyRegex = /SQLITE_CONSTRAINT.*PRIMARY\s+KEY\s+constraint/i;

  if (sqliteUniqueRegex.test(message)) return 'unique';
  if (sqliteForeignKeyRegex.test(message)) return 'foreign_key';
  if (sqliteNotNullRegex.test(message)) return 'not_null';
  if (sqliteCheckRegex.test(message)) return 'check';
  if (sqlitePrimaryKeyRegex.test(message)) return 'primary_key';

  // MongoDB codes (number)
  if (codeNum === MONGODB_ERROR_CODES.E11000_DUPLICATE_KEY || message.includes('E11000')) {
    return 'unique';
  }

  // MongoDB writeErrors (массив ошибок записи)
  if (Array.isArray(input['writeErrors'])) {
    for (const writeError of input['writeErrors'] as Record<string, unknown>[]) {
      const writeErrorCode = typeof writeError['code'] === 'number' ? writeError['code'] : 0;
      const writeErrorMessage = typeof writeError['errmsg'] === 'string'
        ? writeError['errmsg']
        : '';

      if (
        writeErrorCode === MONGODB_ERROR_CODES.E11000_DUPLICATE_KEY
        || writeErrorMessage.includes('E11000')
      ) {
        return 'unique';
      }
    }
  }

  return undefined;
}

/** Helper для извлечения состояния транзакции */
function extractTransactionState(
  input: Record<string, unknown>,
): DatabaseOperationContext['transactionState'] | undefined {
  const detail = typeof input['detail'] === 'string' ? input['detail'] : '';
  const errno = typeof input['errno'] === 'number' ? input['errno'] : 0;
  const codeName = typeof input['codeName'] === 'string' ? input['codeName'] : '';

  if (detail.includes('deadlock')) return 'deadlock';
  if (detail.includes('timeout')) return 'timeout';
  if (errno === MYSQL_ERROR_CODES.ER_LOCK_DEADLOCK) return 'deadlock';
  if (codeName === 'WriteConcernFailed') return 'failed';

  // MongoDB writeErrors (проверка состояний транзакций в массиве ошибок)
  if (Array.isArray(input['writeErrors'])) {
    for (const writeError of input['writeErrors'] as Record<string, unknown>[]) {
      const writeErrorCodeName = typeof writeError['codeName'] === 'string'
        ? writeError['codeName']
        : '';

      if (writeErrorCodeName === 'WriteConcernFailed') {
        return 'failed';
      }
    }
  }

  return undefined;
}

/** Универсальный extractor по стратегиями для каждой БД */
function extractContext(input: unknown): DatabaseOperationContext | undefined {
  if (!isObject(input)) return undefined;

  // PostgreSQL
  if (typeof input['code'] === 'string' && typeof input['detail'] === 'string') {
    const table = typeof input['table'] === 'string' ? input['table'] : undefined;
    const constraint = typeof input['constraint'] === 'string' ? input['constraint'] : undefined;
    const port = typeof input['port'] === 'number' ? input['port'] : undefined;
    const host = typeof input['host'] === 'string' ? input['host'] : undefined;
    const connectionId = typeof input['connectionId'] === 'string'
      ? input['connectionId']
      : undefined;
    const operation = typeof input['operation'] === 'string' ? input['operation'] : undefined;

    const constraintType = extractConstraintType(input);
    const transactionState = extractTransactionState(input);

    let contextValues: Record<string, unknown> = {
      databaseType: 'postgresql',
    };
    if (table != null) contextValues = { ...contextValues, tableName: table };
    if (constraint != null) contextValues = { ...contextValues, constraintName: constraint };
    if (port != null) contextValues = { ...contextValues, port };
    if (host != null) contextValues = { ...contextValues, host };
    if (connectionId != null) contextValues = { ...contextValues, connectionId };
    if (operation != null) contextValues = { ...contextValues, operation };
    if (constraintType) contextValues = { ...contextValues, constraintType };
    if (transactionState) contextValues = { ...contextValues, transactionState };

    return createDatabaseOperationContext(contextValues);
  }

  // MySQL
  if ('errno' in input || 'sqlState' in input || 'sqlMessage' in input) {
    const port = typeof input['port'] === 'number' ? input['port'] : undefined;
    const host = typeof input['host'] === 'string' ? input['host'] : undefined;
    const connectionId = typeof input['connectionId'] === 'string'
      ? input['connectionId']
      : undefined;

    const constraintType = extractConstraintType(input);
    const transactionState = extractTransactionState(input);

    let contextValues: Record<string, unknown> = {
      databaseType: 'mysql',
    };
    if (port != null) contextValues = { ...contextValues, port };
    if (host != null) contextValues = { ...contextValues, host };
    if (connectionId != null) contextValues = { ...contextValues, connectionId };
    if (constraintType) contextValues = { ...contextValues, constraintType };
    if (transactionState) contextValues = { ...contextValues, transactionState };

    return createDatabaseOperationContext(contextValues);
  }

  // SQLite
  if (typeof input['message'] === 'string' && input['message'].includes('SQLITE_CONSTRAINT')) {
    const port = typeof input['port'] === 'number' ? input['port'] : undefined;
    const host = typeof input['host'] === 'string' ? input['host'] : undefined;
    const connectionId = typeof input['connectionId'] === 'string'
      ? input['connectionId']
      : undefined;

    const constraintType = extractConstraintType(input);

    let contextValues: Record<string, unknown> = {
      databaseType: 'sqlite',
    };
    if (port != null) contextValues = { ...contextValues, port };
    if (host != null) contextValues = { ...contextValues, host };
    if (connectionId != null) contextValues = { ...contextValues, connectionId };
    if (constraintType) contextValues = { ...contextValues, constraintType };

    return createDatabaseOperationContext(contextValues);
  }

  // MongoDB
  if ('code' in input || 'codeName' in input || 'writeErrors' in input) {
    const port = typeof input['port'] === 'number' ? input['port'] : undefined;
    const host = typeof input['host'] === 'string' ? input['host'] : undefined;
    const connectionId = typeof input['connectionId'] === 'string'
      ? input['connectionId']
      : undefined;

    const constraintType = extractConstraintType(input);
    const transactionState = extractTransactionState(input);

    let contextValues: Record<string, unknown> = {
      databaseType: 'mongodb',
    };
    if (port != null) contextValues = { ...contextValues, port };
    if (host != null) contextValues = { ...contextValues, host };
    if (connectionId != null) contextValues = { ...contextValues, connectionId };
    if (constraintType) contextValues = { ...contextValues, constraintType };
    if (transactionState) contextValues = { ...contextValues, transactionState };

    return createDatabaseOperationContext(contextValues);
  }

  // Generic
  if ('message' in input && typeof input['message'] === 'string') {
    const msg = input['message'];
    let contextValues: Record<string, unknown> = {};

    if (msg.includes('connection') || msg.includes('connect')) {
      contextValues = { ...contextValues, databaseType: 'generic' };
    }
    if (msg.includes('timeout')) contextValues = { ...contextValues, transactionState: 'timeout' };
    if (msg.includes('deadlock')) {
      contextValues = { ...contextValues, transactionState: 'deadlock' };
    }

    if (Object.keys(contextValues).length > 0) {
      return createDatabaseOperationContext(contextValues);
    }
  }

  return undefined;
}

/** Определяет категорию database ошибки по контексту */
function categorizeDatabaseError(
  context: DatabaseOperationContext,
): 'connection' | 'constraint' | 'transaction' | 'query' | 'unknown' {
  // Connection: наличие сетевых параметров (host, port, connectionId)
  if (context.connectionId != null || context.host != null || context.port != null) {
    return 'connection';
  }

  // Constraint: типы ограничений БД
  if (context.constraintType != null) return 'constraint';

  // Transaction: состояния транзакций
  if (context.transactionState != null) return 'transaction';

  // Query: операции или прямые запросы
  if (context.query != null || context.operation != null) return 'query';

  return 'unknown';
}

/** Маппинг database ошибок на LIVAI error коды */
function mapDatabaseErrorToCode(context: DatabaseOperationContext): string {
  switch (categorizeDatabaseError(context)) {
    case 'connection':
      return LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_FAILED;
    case 'constraint':
      return LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED;
    case 'transaction':
      if (context.transactionState === 'deadlock') return LIVAI_ERROR_CODES.INFRA_DB_DEADLOCK;
      if (context.transactionState === 'timeout') {
        return LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_TIMEOUT;
      }
      return LIVAI_ERROR_CODES.INFRA_DB_TRANSACTION_FAILED;
    case 'query':
      return LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED;
    default:
      return LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED;
  }
}

/** Создает DatabaseError из контекста операции */
function createDatabaseErrorFromContext(context: DatabaseOperationContext): DatabaseError {
  const parts = [
    context.constraintType != null
      ? `${context.constraintType.replace('_', ' ')} constraint violation`
      : undefined, // Нарушение ограничения БД
    context.transactionState != null ? `Transaction ${context.transactionState}` : undefined, // Состояние транзакции
    context.operation != null ? `Database ${context.operation} failed` : undefined, // Операция БД завершилась неудачей
    context.tableName != null ? `on table ${context.tableName}` : undefined, // На таблице
  ].filter(Boolean);

  const message = parts.join(' ') || 'Database operation failed'; // Операция с базой данных завершилась неудачей
  const code = mapDatabaseErrorToCode(context);

  return createDatabaseError(code, message, Object.keys(context).length > 0 ? context : undefined);
}

/** Создает SharedAdapterError для инфраструктурных проблем */
function createAdapterError(
  message: string,
  context: DatabaseOperationContext,
): SharedAdapterError<Record<string, unknown>> {
  return {
    _tag: 'SharedAdapterError',
    category: 'adapter',
    code: 'SHARED_INFRA_DATABASE_ADAPTER_ERROR',
    message,
    details: context,
  };
}

/** Нормализует неизвестную ошибку базы данных */
export function normalizeDatabaseError(input: DatabaseErrorInput): DatabaseNormalizationResult {
  const context = extractContext(input);

  if (context) return createDatabaseErrorFromContext(context);

  let fallbackContextValues: Record<string, unknown> = {
    databaseType: 'unknown',
  };
  if (typeof input === 'string') fallbackContextValues = { ...fallbackContextValues, query: input };
  const fallbackContext = createDatabaseOperationContext(fallbackContextValues);

  const errorMessage = isObject(input) && 'message' in input
    ? String(input['message'])
    : 'Unknown database error'; // Неизвестная ошибка базы данных

  return createAdapterError(errorMessage, fallbackContext);
}

/** Type guards */
export function isDatabaseErrorResult(
  result: DatabaseNormalizationResult,
): result is DatabaseError {
  return result._tag === 'DatabaseError';
}

export function isDatabaseInfraError(
  result: DatabaseNormalizationResult,
): result is SharedAdapterError<Record<string, unknown>> {
  return result._tag === 'SharedAdapterError';
}

/** Извлекает тип базы данных */
export function extractDatabaseType(result: DatabaseNormalizationResult): string | undefined {
  if (isDatabaseErrorResult(result)) return result.details?.databaseType;
  if (isDatabaseInfraError(result)) {
    const details = result.details;
    if (details && typeof details['databaseType'] === 'string') {
      return details['databaseType'];
    }
  }
  return undefined;
}

// Экспорт внутренней функции для тестирования
export { createDatabaseOperationContext };
