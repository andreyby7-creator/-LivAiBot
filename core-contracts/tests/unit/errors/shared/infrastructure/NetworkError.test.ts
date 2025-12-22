import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import {
  createNetworkError,
  getHttpRequestInfo,
  getNetworkConnection,
  getNetworkUrl,
  isHttpError,
  isNetworkError,
  isTimeoutError,
  isValidNetworkErrorContext,
} from '../../../../../src/errors/shared/infrastructure/NetworkError';
import type {
  NetworkError,
  NetworkErrorContext,
} from '../../../../../src/errors/shared/infrastructure/NetworkError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock NetworkErrorContext для тестов */
function createMockNetworkContext(): NetworkErrorContext {
  return {
    url: 'https://api.example.com/users',
    method: 'GET',
    statusCode: 500,
    timeout: 30000,
    responseSize: 1024,
    userAgent: 'LivAiBot/1.0',
    remoteAddress: '192.168.1.1',
    remotePort: 443,
    localAddress: '10.0.0.1',
    localPort: 54321,
    connectionType: 'https',
  } as unknown as NetworkErrorContext;
}

/** Создает mock NetworkError для тестов */
function createMockNetworkError(
  code: string = DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
  message: string = 'Network request failed',
  context?: NetworkErrorContext,
  timestamp?: string,
): NetworkError {
  return createNetworkError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('NetworkError', () => {
  describe('createNetworkError', () => {
    it('создает NetworkError с минимальными обязательными полями', () => {
      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
      );

      expect(error).toEqual({
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: expect.any(String),
      });

      expect(isNetworkError(error)).toBe(true);
    });

    it('создает NetworkError с полным контекстом сети', () => {
      const context = createMockNetworkContext();
      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Connection timeout',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(error.message).toBe('Connection timeout');
      expect(error.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('создает NetworkError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isNetworkError(error)).toBe(true);
    });

    it('создает NetworkError с пустым контекстом', () => {
      const emptyContext = {} as NetworkErrorContext;
      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        emptyContext,
      );

      expect(error.details).toEqual(emptyContext);
      expect(isNetworkError(error)).toBe(true);
    });

    it('создает NetworkError с частичным контекстом', () => {
      const partialContext: NetworkErrorContext = {
        url: 'https://api.example.com',
        statusCode: 404,
      } as unknown as NetworkErrorContext;

      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Not found',
        partialContext,
      );

      expect(error.details).toEqual(partialContext);
      expect(isNetworkError(error)).toBe(true);
    });

    it('корректно генерирует timestamp по умолчанию', () => {
      const before = new Date();
      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
      );
      const after = new Date();

      const errorTimestamp = new Date(error.timestamp);
      expect(errorTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('isNetworkError', () => {
    it('возвращает true для NetworkError', () => {
      const error = createMockNetworkError();
      expect(isNetworkError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'ValidationError', message: 'Validation failed' },
        null,
        undefined,
      ];

      otherErrors.forEach((error) => {
        expect(isNetworkError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов с неправильным типом statusCode в details', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          url: 'https://api.example.com',
          statusCode: '500', // неправильный тип statusCode (строка вместо числа)
        } as unknown as NetworkErrorContext,
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов без обязательного _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильной категорией', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: 'INVALID_CATEGORY',
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным origin', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: 'INVALID_ORIGIN',
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным severity', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: 'INVALID_SEVERITY',
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом code', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: 12345,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом message', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 12345,
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом timestamp', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: 12345,
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом details', () => {
      const invalidError = {
        _tag: 'NetworkError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'Network request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: 'invalid details',
      } as unknown as NetworkError;

      expect(isNetworkError(invalidError)).toBe(false);
    });
  });

  describe('isValidNetworkErrorContext', () => {
    it('возвращает false для null контекста', () => {
      expect(isValidNetworkErrorContext(null)).toBe(false);
    });

    it('возвращает false для undefined контекста', () => {
      expect(isValidNetworkErrorContext(undefined)).toBe(false);
    });

    it('возвращает false для не-объектов', () => {
      expect(isValidNetworkErrorContext('string')).toBe(false);
      expect(isValidNetworkErrorContext(42)).toBe(false);
      expect(isValidNetworkErrorContext(true)).toBe(false);
      expect(isValidNetworkErrorContext([])).toBe(false);
    });

    it('возвращает false если url не является строкой', () => {
      const invalidContext = { url: 42 };
      expect(isValidNetworkErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если method не является строкой', () => {
      const invalidContext = { method: 42 };
      expect(isValidNetworkErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если statusCode не является целым числом', () => {
      expect(isValidNetworkErrorContext({ statusCode: '500' })).toBe(false);
      expect(isValidNetworkErrorContext({ statusCode: 500.5 })).toBe(false);
      expect(isValidNetworkErrorContext({ statusCode: NaN })).toBe(false);
    });

    it('возвращает false если timeout не является целым числом', () => {
      expect(isValidNetworkErrorContext({ timeout: '30000' })).toBe(false);
      expect(isValidNetworkErrorContext({ timeout: 30000.5 })).toBe(false);
      expect(isValidNetworkErrorContext({ timeout: NaN })).toBe(false);
    });

    it('возвращает false если responseSize не является целым числом', () => {
      expect(isValidNetworkErrorContext({ responseSize: '1024' })).toBe(false);
      expect(isValidNetworkErrorContext({ responseSize: 1024.5 })).toBe(false);
      expect(isValidNetworkErrorContext({ responseSize: NaN })).toBe(false);
    });

    it('возвращает false если userAgent не является строкой', () => {
      const invalidContext = { userAgent: 42 };
      expect(isValidNetworkErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если remoteAddress не является строкой', () => {
      const invalidContext = { remoteAddress: 42 };
      expect(isValidNetworkErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если remotePort не является целым числом', () => {
      expect(isValidNetworkErrorContext({ remotePort: '443' })).toBe(false);
      expect(isValidNetworkErrorContext({ remotePort: 443.5 })).toBe(false);
      expect(isValidNetworkErrorContext({ remotePort: NaN })).toBe(false);
    });

    it('возвращает false если localAddress не является строкой', () => {
      const invalidContext = { localAddress: 42 };
      expect(isValidNetworkErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если localPort не является целым числом', () => {
      expect(isValidNetworkErrorContext({ localPort: '54321' })).toBe(false);
      expect(isValidNetworkErrorContext({ localPort: 54321.5 })).toBe(false);
      expect(isValidNetworkErrorContext({ localPort: NaN })).toBe(false);
    });

    it('возвращает false если connectionType не является строкой', () => {
      const invalidContext = { connectionType: 42 };
      expect(isValidNetworkErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает true для валидного пустого контекста', () => {
      expect(isValidNetworkErrorContext({})).toBe(true);
    });

    it('возвращает true для валидного полного контекста', () => {
      const validContext = createMockNetworkContext();
      expect(isValidNetworkErrorContext(validContext)).toBe(true);
    });

    it('возвращает true для контекста с частичными валидными полями', () => {
      const validContext = {
        url: 'https://api.example.com',
        method: 'GET',
        statusCode: 200,
      };
      expect(isValidNetworkErrorContext(validContext)).toBe(true);
    });
  });

  describe('getNetworkUrl', () => {
    it('извлекает URL из NetworkError', () => {
      const context = createMockNetworkContext();
      const error = createMockNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        context,
      );

      const url = getNetworkUrl(error);
      expect(url).toBe('https://api.example.com/users');
    });

    it('возвращает undefined если URL не указан', () => {
      const error = createMockNetworkError();

      const url = getNetworkUrl(error);
      expect(url).toBeUndefined();
    });
  });

  describe('getHttpRequestInfo', () => {
    it('извлекает информацию о HTTP запросе из NetworkError', () => {
      const context = createMockNetworkContext();
      const error = createMockNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        context,
      );

      const requestInfo = getHttpRequestInfo(error);
      expect(requestInfo).toEqual({
        method: 'GET',
        statusCode: 500,
        userAgent: 'LivAiBot/1.0',
      });
    });

    it('возвращает undefined если details отсутствует', () => {
      const error = createMockNetworkError();
      expect(getHttpRequestInfo(error)).toBeUndefined();
    });

    it('возвращает частичную информацию если некоторые поля отсутствуют', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com',
        method: 'POST',
        // statusCode и userAgent отсутствуют
      } as unknown as NetworkErrorContext;

      const error = createMockNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        context,
      );

      const requestInfo = getHttpRequestInfo(error);
      expect(requestInfo).toEqual({
        method: 'POST',
        statusCode: undefined,
        userAgent: undefined,
      });
    });
  });

  describe('getNetworkConnection', () => {
    it('извлекает информацию о сетевом соединении из NetworkError', () => {
      const context = createMockNetworkContext();
      const error = createMockNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        context,
      );

      const connection = getNetworkConnection(error);
      expect(connection).toEqual({
        remoteAddress: '192.168.1.1',
        remotePort: 443,
        localAddress: '10.0.0.1',
        localPort: 54321,
        connectionType: 'https',
      });
    });

    it('возвращает undefined если details отсутствует', () => {
      const error = createMockNetworkError();
      expect(getNetworkConnection(error)).toBeUndefined();
    });

    it('возвращает частичную информацию если некоторые поля отсутствуют', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com',
        remoteAddress: '192.168.1.1',
        // остальные поля отсутствуют
      } as unknown as NetworkErrorContext;

      const error = createMockNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Network request failed',
        context,
      );

      const connection = getNetworkConnection(error);
      expect(connection).toEqual({
        remoteAddress: '192.168.1.1',
        remotePort: undefined,
        localAddress: undefined,
        localPort: undefined,
        connectionType: undefined,
      });
    });
  });

  describe('isTimeoutError', () => {
    it('возвращает true для ошибки таймаута', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 30000,
      } as unknown as NetworkErrorContext;

      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Request timeout',
        context,
      );

      expect(isTimeoutError(error)).toBe(true);
    });

    it('возвращает false если таймаут не указан', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com',
        method: 'GET',
        statusCode: 500,
      } as unknown as NetworkErrorContext;

      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Server error',
        context,
      );

      expect(isTimeoutError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockNetworkError();

      expect(isTimeoutError(error)).toBe(false);
    });
  });

  describe('isHttpError', () => {
    it('возвращает true для HTTP ошибки', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com',
        method: 'GET',
        statusCode: 500,
      } as unknown as NetworkErrorContext;

      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Server error',
        context,
      );

      expect(isHttpError(error)).toBe(true);
    });

    it('возвращает false если статус код не указан', () => {
      const context: NetworkErrorContext = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 30000,
      } as unknown as NetworkErrorContext;

      const error = createNetworkError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Connection timeout',
        context,
      );

      expect(isHttpError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockNetworkError();

      expect(isHttpError(error)).toBe(false);
    });
  });

  describe('NetworkError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockNetworkError();

      expect(error).toHaveProperty('_tag', 'NetworkError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.TECHNICAL);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.HIGH);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });
  });
});
