import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { ErrorCode } from '../../../../../src/errors/base/ErrorCode';
import {
  createDatabaseError,
  getDatabaseConnection,
  getDatabaseOperation,
  getDatabaseType,
  getTableName,
  isDatabaseConnectionError,
  isDatabaseError,
} from '../../../../../src/errors/shared/infrastructure/DatabaseError';
import type {
  DatabaseError,
  DatabaseErrorContext,
} from '../../../../../src/errors/shared/infrastructure/DatabaseError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock DatabaseErrorContext для тестов */
function createMockDatabaseContext(): DatabaseErrorContext {
  return {
    databaseType: 'postgresql',
    tableName: 'users',
    operation: 'select',
    recordId: 'user-123',
    query: 'SELECT * FROM users WHERE id = $1',
    connectionId: 'conn-456',
    host: 'localhost',
    port: 5432,
  } as unknown as DatabaseErrorContext;
}

/** Создает mock DatabaseError для тестов */
function createMockDatabaseError(
  code: ErrorCode = DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
  message: string = 'Database operation failed',
  context?: DatabaseErrorContext,
  timestamp?: string,
): DatabaseError {
  return createDatabaseError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('DatabaseError', () => {
  describe('createDatabaseError', () => {
    it('создает DatabaseError с минимальными обязательными полями', () => {
      const error = createDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
      );

      expect(error).toEqual({
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: expect.any(String),
      });

      expect(isDatabaseError(error)).toBe(true);
    });

    it('создает DatabaseError с полным контекстом базы данных', () => {
      const context = createMockDatabaseContext();
      const error = createDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database connection failed',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(error.message).toBe('Database connection failed');
      expect(error.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('создает DatabaseError с различными типами баз данных', () => {
      const databaseTypes = ['postgresql', 'mysql', 'mongodb', 'redis'];

      databaseTypes.forEach((dbType) => {
        const context: DatabaseErrorContext = {
          databaseType: dbType,
          operation: 'connect',
        } as unknown as DatabaseErrorContext;

        const error = createDatabaseError(
          DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          `Failed to connect to ${dbType}`,
          context,
        );

        expect(error.details?.databaseType).toBe(dbType);
      });
    });

    it('создает DatabaseError с различными операциями', () => {
      const operations = ['select', 'insert', 'update', 'delete', 'connect', 'disconnect'];

      operations.forEach((operation) => {
        const context: DatabaseErrorContext = {
          databaseType: 'postgresql',
          operation,
          tableName: 'test_table',
        } as unknown as DatabaseErrorContext;

        const error = createDatabaseError(
          DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          `Database ${operation} failed`,
          context,
        );

        expect(error.details?.operation).toBe(operation);
      });
    });

    it('создает DatabaseError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isDatabaseError(error)).toBe(true);
    });
  });

  describe('isDatabaseError', () => {
    it('возвращает true для DatabaseError', () => {
      const error = createMockDatabaseError();
      expect(isDatabaseError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'ValidationError', message: 'Validation failed' },
        { _tag: 'AuthError', message: 'Auth failed' },
        null,
        undefined,
        'string error',
        42,
      ];

      otherErrors.forEach((error) => {
        expect(isDatabaseError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов без _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.TECHNICAL,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным _tag', () => {
      const invalidError = {
        _tag: 'WrongError',
        category: ERROR_CATEGORY.TECHNICAL,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным category', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.SECURITY, // неправильный category
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным origin', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.DOMAIN, // неправильный origin
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным severity', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM, // неправильный severity
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом code', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: 123, // неправильный тип code
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом message', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 123, // неправильный тип message
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом timestamp', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: 123, // неправильный тип timestamp
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом databaseType в details', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          databaseType: 123, // неправильный тип databaseType (число вместо строки)
        } as unknown as DatabaseErrorContext,
      } as unknown as DatabaseError;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом type в details', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 123, // неправильный тип type (число вместо строки)
        },
      } as unknown as DatabaseError;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с details не являющимся объектом', () => {
      const invalidError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: 'invalid details', // неправильный тип details (строка вместо объекта)
      } as unknown as DatabaseError;

      expect(isDatabaseError(invalidError)).toBe(false);
    });

    it('возвращает true для объектов с корректным DatabaseErrorContext', () => {
      const validError = {
        _tag: 'DatabaseError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Database operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          databaseType: 'postgresql',
          tableName: 'users',
          operation: 'select',
          connectionId: 'conn-123',
        } as DatabaseErrorContext,
      } as unknown as DatabaseErrorContext;

      expect(isDatabaseError(validError)).toBe(true);
    });
  });

  describe('getDatabaseType', () => {
    it('извлекает тип базы данных из DatabaseError', () => {
      const context = createMockDatabaseContext();
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
        context,
      );

      const databaseType = getDatabaseType(error);
      expect(databaseType).toBe('postgresql');
    });

    it('возвращает undefined если тип базы данных не указан', () => {
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
      );

      const databaseType = getDatabaseType(error);
      expect(databaseType).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockDatabaseError();
      delete (error as any).details;

      const databaseType = getDatabaseType(error);
      expect(databaseType).toBeUndefined();
    });
  });

  describe('getTableName', () => {
    it('извлекает название таблицы из DatabaseError', () => {
      const context = createMockDatabaseContext();
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
        context,
      );

      const tableName = getTableName(error);
      expect(tableName).toBe('users');
    });

    it('возвращает undefined если название таблицы не указано', () => {
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
      );

      const tableName = getTableName(error);
      expect(tableName).toBeUndefined();
    });
  });

  describe('getDatabaseOperation', () => {
    it('извлекает операцию базы данных из DatabaseError', () => {
      const context = createMockDatabaseContext();
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
        context,
      );

      const operation = getDatabaseOperation(error);
      expect(operation).toBe('select');
    });

    it('возвращает undefined если операция не указана', () => {
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
      );

      const operation = getDatabaseOperation(error);
      expect(operation).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockDatabaseError();
      delete (error as any).details;

      const operation = getDatabaseOperation(error);
      expect(operation).toBeUndefined();
    });
  });

  describe('isDatabaseConnectionError', () => {
    it('возвращает true для ошибки соединения с connectionId', () => {
      const context: DatabaseErrorContext = {
        type: 'user',
        connectionId: 'conn-123',
      } as unknown as DatabaseErrorContext;

      const error = createDatabaseError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Connection failed',
        context,
      );

      expect(isDatabaseConnectionError(error)).toBe(true);
    });

    it('возвращает true для ошибки соединения с host', () => {
      const context: DatabaseErrorContext = {
        type: 'user',
        host: 'localhost',
        port: 5432,
      } as unknown as DatabaseErrorContext;

      const error = createDatabaseError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Connection failed',
        context,
      );

      expect(isDatabaseConnectionError(error)).toBe(true);
    });

    it('возвращает false если информация о соединении отсутствует', () => {
      const context: DatabaseErrorContext = {
        type: 'user',
        databaseType: 'postgresql',
        tableName: 'users',
        operation: 'select',
      } as unknown as DatabaseErrorContext;

      const error = createDatabaseError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Query failed',
        context,
      );

      expect(isDatabaseConnectionError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockDatabaseError();

      expect(isDatabaseConnectionError(error)).toBe(false);
    });
  });

  describe('getDatabaseConnection', () => {
    it('извлекает информацию о соединении из DatabaseError', () => {
      const context = createMockDatabaseContext();
      const error = createMockDatabaseError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Database operation failed',
        context,
      );

      const connection = getDatabaseConnection(error);
      expect(connection).toEqual({
        connectionId: 'conn-456',
        host: 'localhost',
        port: 5432,
      });
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockDatabaseError();
      delete (error as any).details;

      const connection = getDatabaseConnection(error);
      expect(connection).toBeUndefined();
    });
  });

  describe('DatabaseError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockDatabaseError();

      expect(error).toHaveProperty('_tag', 'DatabaseError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.TECHNICAL);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.HIGH);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });

    it('DatabaseErrorContext содержит все необходимые поля для работы с БД', () => {
      const context = createMockDatabaseContext();

      expect(context).toHaveProperty('databaseType');
      expect(context).toHaveProperty('tableName');
      expect(context).toHaveProperty('operation');
      expect(context).toHaveProperty('recordId');
      expect(context).toHaveProperty('query');
      expect(context).toHaveProperty('connectionId');
      expect(context).toHaveProperty('host');
      expect(context).toHaveProperty('port');
    });
  });
});
