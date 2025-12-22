import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { ErrorCode } from '../../../../../src/errors/base/ErrorCode';
import {
  createCacheError,
  getCacheConnection,
  getCacheKey,
  getCacheOperation,
  isCacheConnectionError,
  isCacheError,
} from '../../../../../src/errors/shared/infrastructure/CacheError';
import type {
  CacheError,
  CacheErrorContext,
} from '../../../../../src/errors/shared/infrastructure/CacheError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock CacheErrorContext для тестов */
function createMockCacheContext(): CacheErrorContext {
  return {
    cacheType: 'redis',
    key: 'user:123',
    operation: 'get',
    ttl: 3600,
    namespace: 'users',
    host: 'localhost',
    port: 6379,
    connectionId: 'cache-conn-456',
  } as unknown as CacheErrorContext;
}

/** Создает mock CacheError для тестов */
function createMockCacheError(
  code: ErrorCode = DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
  message: string = 'Cache operation failed',
  context?: CacheErrorContext,
  timestamp?: string,
): CacheError {
  return createCacheError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('CacheError', () => {
  describe('createCacheError', () => {
    it('создает CacheError с минимальными обязательными полями', () => {
      const error = createCacheError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Cache operation failed',
      );

      expect(error).toEqual({
        _tag: 'CacheError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
        timestamp: expect.any(String),
      });

      expect(isCacheError(error)).toBe(true);
    });

    it('создает CacheError с полным контекстом кеша', () => {
      const context = createMockCacheContext();
      const error = createCacheError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Cache connection failed',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(error.message).toBe('Cache connection failed');
      expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    it('создает CacheError с различными типами кеша', () => {
      const cacheTypes = ['redis', 'memcached', 'memory'];

      cacheTypes.forEach((cacheType) => {
        const context: CacheErrorContext = {
          cacheType,
          operation: 'get',
        } as unknown as CacheErrorContext;

        const error = createCacheError(
          DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          `Failed to connect to ${cacheType}`,
          context,
        );

        expect(error.details?.cacheType).toBe(cacheType);
      });
    });

    it('создает CacheError с различными операциями', () => {
      const operations = ['get', 'set', 'delete', 'expire', 'exists'];

      operations.forEach((operation) => {
        const context: CacheErrorContext = {
          cacheType: 'redis',
          operation,
          key: 'test:key',
        } as unknown as CacheErrorContext;

        const error = createCacheError(
          DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          `Cache ${operation} failed`,
          context,
        );

        expect(error.details?.operation).toBe(operation);
      });
    });

    it('создает CacheError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createCacheError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Cache operation failed',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isCacheError(error)).toBe(true);
    });
  });

  describe('isCacheError', () => {
    it('возвращает true для CacheError', () => {
      const error = createMockCacheError();
      expect(isCacheError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'ValidationError', message: 'Validation failed' },
        { _tag: 'DatabaseError', message: 'Database failed' },
        null,
        undefined,
        'string error',
        42,
      ];

      otherErrors.forEach((error) => {
        expect(isCacheError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов без _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.TECHNICAL,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
      } as unknown as CacheErrorContext;

      expect(isCacheError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным _tag', () => {
      const invalidError = {
        _tag: 'WrongError',
        category: ERROR_CATEGORY.TECHNICAL,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
      } as unknown as CacheErrorContext;

      expect(isCacheError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным category', () => {
      const invalidError = {
        _tag: 'CacheError',
        category: ERROR_CATEGORY.SECURITY, // неправильный category
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as CacheErrorContext;

      expect(isCacheError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным origin', () => {
      const invalidError = {
        _tag: 'CacheError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.DOMAIN, // неправильный origin
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as CacheErrorContext;

      expect(isCacheError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным severity', () => {
      const invalidError = {
        _tag: 'CacheError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH, // неправильный severity
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as CacheErrorContext;

      expect(isCacheError(invalidError)).toBe(false);
    });

    it('возвращает true для объектов с корректным CacheErrorContext', () => {
      const validError = {
        _tag: 'CacheError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Cache operation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          cacheType: 'redis',
          key: 'user:123',
          operation: 'get',
          connectionId: 'cache-conn-123',
        } as CacheErrorContext,
      } as unknown as CacheError;

      expect(isCacheError(validError)).toBe(true);
    });
  });

  describe('getCacheKey', () => {
    it('извлекает ключ кеша из CacheError', () => {
      const context = createMockCacheContext();
      const error = createMockCacheError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Cache operation failed',
        context,
      );

      const key = getCacheKey(error);
      expect(key).toBe('user:123');
    });

    it('возвращает undefined если ключ не указан', () => {
      const error = createMockCacheError();

      const key = getCacheKey(error);
      expect(key).toBeUndefined();
    });
  });

  describe('getCacheConnection', () => {
    it('извлекает информацию о соединении из CacheError', () => {
      const context = createMockCacheContext();
      const error = createMockCacheError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Cache operation failed',
        context,
      );

      const connection = getCacheConnection(error);
      expect(connection).toEqual({
        cacheType: 'redis',
        host: 'localhost',
        port: 6379,
        connectionId: 'cache-conn-456',
      });
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockCacheError();
      delete (error as any).details;

      const connection = getCacheConnection(error);
      expect(connection).toBeUndefined();
    });
  });

  describe('getCacheOperation', () => {
    it('извлекает операцию кеша из CacheError', () => {
      const context = createMockCacheContext();
      const error = createMockCacheError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Cache operation failed',
        context,
      );

      const operation = getCacheOperation(error);
      expect(operation).toBe('get');
    });

    it('возвращает undefined если операция не указана', () => {
      const error = createMockCacheError();

      const operation = getCacheOperation(error);
      expect(operation).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockCacheError();
      delete (error as any).details;

      const operation = getCacheOperation(error);
      expect(operation).toBeUndefined();
    });
  });

  describe('isCacheConnectionError', () => {
    it('возвращает true для ошибки соединения с connectionId', () => {
      const context: CacheErrorContext = {
        type: 'user',
        connectionId: 'cache-conn-123',
      } as unknown as CacheErrorContext;

      const error = createCacheError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Connection failed',
        context,
      );

      expect(isCacheConnectionError(error)).toBe(true);
    });

    it('возвращает true для ошибки соединения с host', () => {
      const context: CacheErrorContext = {
        type: 'user',
        host: 'localhost',
        port: 6379,
      } as unknown as CacheErrorContext;

      const error = createCacheError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Connection failed',
        context,
      );

      expect(isCacheConnectionError(error)).toBe(true);
    });

    it('возвращает false если информация о соединении отсутствует', () => {
      const context: CacheErrorContext = {
        type: 'user',
        cacheType: 'redis',
        key: 'user:123',
        operation: 'get',
      } as unknown as CacheErrorContext;

      const error = createCacheError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Cache operation failed',
        context,
      );

      expect(isCacheConnectionError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockCacheError();

      expect(isCacheConnectionError(error)).toBe(false);
    });
  });

  describe('CacheError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockCacheError();

      expect(error).toHaveProperty('_tag', 'CacheError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.TECHNICAL);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.MEDIUM);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });

    it('CacheErrorContext содержит все необходимые поля для работы с кешем', () => {
      const context = createMockCacheContext();

      expect(context).toHaveProperty('cacheType');
      expect(context).toHaveProperty('key');
      expect(context).toHaveProperty('operation');
      expect(context).toHaveProperty('ttl');
      expect(context).toHaveProperty('namespace');
      expect(context).toHaveProperty('host');
      expect(context).toHaveProperty('port');
      expect(context).toHaveProperty('connectionId');
    });
  });
});
