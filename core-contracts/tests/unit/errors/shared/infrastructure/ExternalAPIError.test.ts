import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import {
  createExternalAPIError,
  getAPIConnection,
  getAPIRateLimit,
  getAPIRetryInfo,
  getAPIServiceInfo,
  isExternalAPIError,
  isRateLimitError,
  isRetryableError,
  isValidExternalAPIErrorContext,
} from '../../../../../src/errors/shared/infrastructure/ExternalAPIError';
import type {
  ExternalAPIError,
  ExternalAPIErrorContext,
} from '../../../../../src/errors/shared/infrastructure/ExternalAPIError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock ExternalAPIErrorContext для тестов */
function createMockExternalAPIContext(): ExternalAPIErrorContext {
  return {
    serviceName: 'TestAPI',
    apiVersion: 'v1.0',
    endpoint: '/users/123',
    method: 'GET',
    statusCode: 500,
    externalRequestId: 'req-abc-123',
    responseTime: 2500,
    responseSize: 2048,
    rateLimit: {
      limit: 100,
      remaining: 50,
      resetTime: 1640995200,
    },
    retry: {
      attempt: 2,
      maxAttempts: 3,
      backoff: 1000,
    },
  } as unknown as ExternalAPIErrorContext;
}

/** Создает mock ExternalAPIError для тестов */
function createMockExternalAPIError(
  code: string = DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
  message: string = 'External API request failed',
  context?: ExternalAPIErrorContext,
  timestamp?: string,
): ExternalAPIError {
  return createExternalAPIError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('ExternalAPIError', () => {
  describe('createExternalAPIError', () => {
    it('создает ExternalAPIError с минимальными обязательными полями', () => {
      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
      );

      expect(error).toEqual({
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: expect.any(String),
      });

      expect(isExternalAPIError(error)).toBe(true);
    });

    it('создает ExternalAPIError с полным контекстом API', () => {
      const context = createMockExternalAPIContext();
      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'API connection timeout',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(error.message).toBe('API connection timeout');
      expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    it('создает ExternalAPIError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isExternalAPIError(error)).toBe(true);
    });

    it('создает ExternalAPIError с пустым контекстом', () => {
      const emptyContext = {} as ExternalAPIErrorContext;
      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        emptyContext,
      );

      expect(error.details).toEqual(emptyContext);
      expect(isExternalAPIError(error)).toBe(true);
    });

    it('создает ExternalAPIError с частичным контекстом', () => {
      const partialContext: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        endpoint: '/test',
        statusCode: 404,
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Not found',
        partialContext,
      );

      expect(error.details).toEqual(partialContext);
      expect(isExternalAPIError(error)).toBe(true);
    });

    it('корректно генерирует timestamp по умолчанию', () => {
      const before = new Date();
      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
      );
      const after = new Date();

      const errorTimestamp = new Date(error.timestamp);
      expect(errorTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('isExternalAPIError', () => {
    it('возвращает true для ExternalAPIError', () => {
      const error = createMockExternalAPIError();
      expect(isExternalAPIError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'ValidationError', message: 'Validation failed' },
        null,
        undefined,
      ];

      otherErrors.forEach((error) => {
        expect(isExternalAPIError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов без обязательного _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильной категорией', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: 'INVALID_CATEGORY',
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным origin', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: 'INVALID_ORIGIN',
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным severity', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: 'INVALID_SEVERITY',
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом code', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: 12345,
        message: 'External API request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом message', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 12345,
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом timestamp', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: 12345,
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом details', () => {
      const invalidError = {
        _tag: 'ExternalAPIError',
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        message: 'External API request failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: 'invalid details',
      } as unknown as ExternalAPIError;

      expect(isExternalAPIError(invalidError)).toBe(false);
    });
  });

  describe('isValidExternalAPIErrorContext', () => {
    it('возвращает false для null контекста', () => {
      expect(isValidExternalAPIErrorContext(null)).toBe(false);
    });

    it('возвращает false для undefined контекста', () => {
      expect(isValidExternalAPIErrorContext(undefined)).toBe(false);
    });

    it('возвращает false для не-объектов', () => {
      expect(isValidExternalAPIErrorContext('string')).toBe(false);
      expect(isValidExternalAPIErrorContext(42)).toBe(false);
      expect(isValidExternalAPIErrorContext(true)).toBe(false);
    });

    it('возвращает false для массивов', () => {
      expect(isValidExternalAPIErrorContext([])).toBe(false);
    });

    it('возвращает false если serviceName не является строкой', () => {
      const invalidContext = { serviceName: 42 };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если apiVersion не является строкой', () => {
      const invalidContext = { apiVersion: 42 };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если endpoint не является строкой', () => {
      const invalidContext = { endpoint: 42 };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если method не является строкой', () => {
      const invalidContext = { method: 42 };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если statusCode не является целым числом', () => {
      expect(isValidExternalAPIErrorContext({ statusCode: '500' })).toBe(false);
      expect(isValidExternalAPIErrorContext({ statusCode: 500.5 })).toBe(false);
      expect(isValidExternalAPIErrorContext({ statusCode: NaN })).toBe(false);
    });

    it('возвращает false если externalRequestId не является строкой', () => {
      const invalidContext = { externalRequestId: 42 };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если responseTime не является целым числом или отрицательным', () => {
      expect(isValidExternalAPIErrorContext({ responseTime: '2500' })).toBe(false);
      expect(isValidExternalAPIErrorContext({ responseTime: 2500.5 })).toBe(false);
      expect(isValidExternalAPIErrorContext({ responseTime: NaN })).toBe(false);
      expect(isValidExternalAPIErrorContext({ responseTime: -100 })).toBe(false);
    });

    it('возвращает false если responseSize не является целым числом', () => {
      expect(isValidExternalAPIErrorContext({ responseSize: '2048' })).toBe(false);
      expect(isValidExternalAPIErrorContext({ responseSize: 2048.5 })).toBe(false);
      expect(isValidExternalAPIErrorContext({ responseSize: NaN })).toBe(false);
    });

    it('возвращает false если rateLimit.limit не является целым числом', () => {
      const invalidContext = { rateLimit: { limit: 100.5 } };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если rateLimit.remaining не является целым числом', () => {
      const invalidContext = { rateLimit: { remaining: 50.5 } };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если rateLimit.resetTime не является целым числом или отрицательным', () => {
      expect(isValidExternalAPIErrorContext({ rateLimit: { resetTime: 1000.5 } })).toBe(false);
      expect(isValidExternalAPIErrorContext({ rateLimit: { resetTime: -1000 } })).toBe(false);
    });

    it('возвращает false если retry.attempt не является целым числом', () => {
      const invalidContext = { retry: { attempt: 2.5 } };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если retry.maxAttempts не является целым числом', () => {
      const invalidContext = { retry: { maxAttempts: 3.5 } };
      expect(isValidExternalAPIErrorContext(invalidContext)).toBe(false);
    });

    it('возвращает false если retry.backoff не является целым числом или отрицательным', () => {
      expect(isValidExternalAPIErrorContext({ retry: { backoff: 1000.5 } })).toBe(false);
      expect(isValidExternalAPIErrorContext({ retry: { backoff: -1000 } })).toBe(false);
    });

    it('возвращает false если rateLimit не является объектом', () => {
      expect(isValidExternalAPIErrorContext({ rateLimit: 'invalid' })).toBe(false);
      expect(isValidExternalAPIErrorContext({ rateLimit: null })).toBe(false);
      expect(isValidExternalAPIErrorContext({ rateLimit: 123 })).toBe(false);
    });

    it('возвращает false если retry не является объектом', () => {
      expect(isValidExternalAPIErrorContext({ retry: 'invalid' })).toBe(false);
      expect(isValidExternalAPIErrorContext({ retry: null })).toBe(false);
      expect(isValidExternalAPIErrorContext({ retry: 123 })).toBe(false);
    });

    it('возвращает true для валидного пустого контекста', () => {
      expect(isValidExternalAPIErrorContext({})).toBe(true);
    });

    it('возвращает true для валидного полного контекста', () => {
      const validContext = createMockExternalAPIContext();
      expect(isValidExternalAPIErrorContext(validContext)).toBe(true);
    });

    it('возвращает true для контекста с частичными валидными полями', () => {
      const validContext = {
        serviceName: 'TestAPI',
        endpoint: '/test',
        statusCode: 200,
      };
      expect(isValidExternalAPIErrorContext(validContext)).toBe(true);
    });
  });

  describe('getAPIServiceInfo', () => {
    it('извлекает информацию о сервисе из ExternalAPIError', () => {
      const context = createMockExternalAPIContext();
      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      const serviceInfo = getAPIServiceInfo(error);
      expect(serviceInfo).toEqual({
        serviceName: 'TestAPI',
        apiVersion: 'v1.0',
        endpoint: '/users/123',
      });
    });

    it('возвращает undefined если details отсутствует', () => {
      const error = createMockExternalAPIError();
      expect(getAPIServiceInfo(error)).toBeUndefined();
    });

    it('возвращает частичную информацию если некоторые поля отсутствуют', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        // apiVersion и endpoint отсутствуют
      } as unknown as ExternalAPIErrorContext;

      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      const serviceInfo = getAPIServiceInfo(error);
      expect(serviceInfo).toEqual({
        serviceName: 'TestAPI',
        apiVersion: undefined,
        endpoint: undefined,
      });
    });
  });

  describe('getAPIRateLimit', () => {
    it('извлекает информацию о rate limiting из ExternalAPIError', () => {
      const context = createMockExternalAPIContext();
      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      const rateLimit = getAPIRateLimit(error);
      expect(rateLimit).toEqual({
        limit: 100,
        remaining: 50,
        resetTime: 1640995200,
      });
    });

    it('возвращает undefined если details отсутствует', () => {
      const error = createMockExternalAPIError();
      expect(getAPIRateLimit(error)).toBeUndefined();
    });

    it('возвращает undefined если rateLimit отсутствует', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        // rateLimit отсутствует
      } as unknown as ExternalAPIErrorContext;

      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      expect(getAPIRateLimit(error)).toBeUndefined();
    });
  });

  describe('getAPIRetryInfo', () => {
    it('извлекает информацию о retry из ExternalAPIError', () => {
      const context = createMockExternalAPIContext();
      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      const retryInfo = getAPIRetryInfo(error);
      expect(retryInfo).toEqual({
        attempt: 2,
        maxAttempts: 3,
        backoff: 1000,
      });
    });

    it('возвращает undefined если details отсутствует', () => {
      const error = createMockExternalAPIError();
      expect(getAPIRetryInfo(error)).toBeUndefined();
    });

    it('возвращает undefined если retry отсутствует', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        // retry отсутствует
      } as unknown as ExternalAPIErrorContext;

      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      expect(getAPIRetryInfo(error)).toBeUndefined();
    });
  });

  describe('getAPIConnection', () => {
    it('извлекает информацию о API соединении из ExternalAPIError', () => {
      const context = createMockExternalAPIContext();
      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      const connection = getAPIConnection(error);
      expect(connection).toEqual({
        serviceName: 'TestAPI',
        endpoint: '/users/123',
        method: 'GET',
        statusCode: 500,
      });
    });

    it('возвращает undefined если details отсутствует', () => {
      const error = createMockExternalAPIError();
      expect(getAPIConnection(error)).toBeUndefined();
    });

    it('возвращает частичную информацию если некоторые поля отсутствуют', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        endpoint: '/test',
        // method и statusCode отсутствуют
      } as unknown as ExternalAPIErrorContext;

      const error = createMockExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'External API request failed',
        context,
      );

      const connection = getAPIConnection(error);
      expect(connection).toEqual({
        serviceName: 'TestAPI',
        endpoint: '/test',
        method: undefined,
        statusCode: undefined,
      });
    });
  });

  describe('isRateLimitError', () => {
    it('возвращает true для ошибки rate limit (remaining === 0)', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: { remaining: 0, limit: 100, resetTime: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Rate limit exceeded',
        context,
      );

      expect(isRateLimitError(error)).toBe(true);
    });

    it('возвращает false если remaining не равно 0', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: { remaining: 50, limit: 100, resetTime: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Normal request',
        context,
      );

      expect(isRateLimitError(error)).toBe(false);
    });

    it('возвращает false если rateLimit отсутствует', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        // rateLimit отсутствует
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'No rate limit info',
        context,
      );

      expect(isRateLimitError(error)).toBe(false);
    });

    it('возвращает false если details отсутствует', () => {
      const error = createMockExternalAPIError();
      expect(isRateLimitError(error)).toBe(false);
    });

    it('возвращает false если remaining отсутствует в rateLimit', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: { limit: 100, resetTime: 1000 }, // remaining отсутствует
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'No remaining info',
        context,
      );

      expect(isRateLimitError(error)).toBe(false);
    });

    it('возвращает false если remaining не является неотрицательным целым числом', () => {
      const context1: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: { remaining: null as any, limit: 100, resetTime: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error1 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Null remaining',
        context1,
      );

      expect(isRateLimitError(error1)).toBe(false);

      const context2: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: { remaining: -1, limit: 100, resetTime: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error2 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Negative remaining',
        context2,
      );

      expect(isRateLimitError(error2)).toBe(false);

      const context3: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: { remaining: 0.5, limit: 100, resetTime: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error3 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Non-integer remaining',
        context3,
      );

      expect(isRateLimitError(error3)).toBe(false);
    });

    it('возвращает false если rateLimit является пустым объектом', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        rateLimit: {} as any, // пустой объект
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Empty rateLimit',
        context,
      );

      expect(isRateLimitError(error)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('возвращает true для повторяемой ошибки (attempt < maxAttempts)', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 1, maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Temporary error',
        context,
      );

      expect(isRetryableError(error)).toBe(true);
    });

    it('возвращает false если достигнуто максимальное количество попыток (attempt === maxAttempts)', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 3, maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Max retries reached',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если attempt > maxAttempts', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 4, maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Too many attempts',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если retry отсутствует', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        // retry отсутствует
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'No retry info',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если attempt отсутствует', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'No attempt info',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если maxAttempts отсутствует', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 1, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'No maxAttempts info',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если details отсутствует', () => {
      const error = createMockExternalAPIError();
      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если attempt является null', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: null as any, maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Null attempt',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если maxAttempts является null', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 1, maxAttempts: null as any, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Null maxAttempts',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('возвращает false если attempt не является положительным целым числом', () => {
      const context1: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: -1, maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error1 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Negative attempt',
        context1,
      );

      expect(isRetryableError(error1)).toBe(false);

      const context2: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 1.5, maxAttempts: 3, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error2 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Non-integer attempt',
        context2,
      );

      expect(isRetryableError(error2)).toBe(false);
    });

    it('возвращает false если maxAttempts не является положительным целым числом', () => {
      const context1: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 1, maxAttempts: 0, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error1 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Zero maxAttempts',
        context1,
      );

      expect(isRetryableError(error1)).toBe(false);

      const context2: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: { attempt: 1, maxAttempts: 2.5, backoff: 1000 },
      } as unknown as ExternalAPIErrorContext;

      const error2 = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Non-integer maxAttempts',
        context2,
      );

      expect(isRetryableError(error2)).toBe(false);
    });

    it('возвращает false если retry является пустым объектом', () => {
      const context: ExternalAPIErrorContext = {
        serviceName: 'TestAPI',
        retry: {} as any, // пустой объект
      } as unknown as ExternalAPIErrorContext;

      const error = createExternalAPIError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        'Empty retry',
        context,
      );

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('ExternalAPIError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockExternalAPIError();

      expect(error).toHaveProperty('_tag', 'ExternalAPIError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.TECHNICAL);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.MEDIUM);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });
  });
});
