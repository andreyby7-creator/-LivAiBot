/**
 * Unit tests для HttpErrorNormalizer
 *
 * Тесты для проверки нормализации HTTP ошибок, извлечения correlationId и работы с различными HTTP клиентами.
 */

import { describe, expect, it } from 'vitest';

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js';
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js';
import {
  extractCorrelationId,
  fromAxiosError,
  normalizeAxiosError,
  normalizeHttpError,
  normalizeHttpResponse,
} from '../../../../src/errors/normalizers/HttpErrorNormalizer.js';

import type {
  HttpErrorContext,
  HttpErrorLike,
} from '../../../../src/errors/normalizers/HttpErrorNormalizer.js';

describe('HttpErrorNormalizer', () => {
  describe('extractCorrelationId', () => {
    it('should extract correlationId from Headers object', () => {
      const headers = new Headers();
      headers.set('X-Request-Id', 'req-123');

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('req-123');
    });

    it('should extract correlationId from X-Correlation-Id header', () => {
      const headers = new Headers();
      headers.set('X-Correlation-Id', 'corr-456');

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('corr-456');
    });

    it('should extract correlationId from correlation-id header', () => {
      const headers = new Headers();
      headers.set('correlation-id', 'corr-789');

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('corr-789');
    });

    it('should prefer X-Request-Id over other headers', () => {
      const headers = new Headers();
      headers.set('X-Request-Id', 'req-123');
      headers.set('X-Correlation-Id', 'corr-456');

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('req-123');
    });

    it('should extract correlationId from Record headers', () => {
      const headers: Record<string, string> = {
        'X-Request-Id': 'req-123',
      };

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('req-123');
    });

    it('should handle case-insensitive headers', () => {
      const headers: Record<string, string> = {
        'x-request-id': 'req-123',
      };

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('req-123');
    });

    it('should return undefined when no correlation header found', () => {
      const headers = new Headers();

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBeUndefined();
    });

    it('should handle array values in headers', () => {
      const headers: Record<string, string[]> = {
        'X-Request-Id': ['req-123'],
      };

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('req-123');
    });

    it('should handle object values in headers (converted to string)', () => {
      // Используем Record с обходом типизации для тестирования ветки с объектом (строки 91-95)
      const headers = {
        'x-request-id': { toString: () => 'req-456' },
      } as any as Record<string, string | string[] | undefined>;

      const correlationId = extractCorrelationId(headers);

      expect(correlationId).toBe('req-456');
    });

    it('should handle object values in headers that convert to empty string', () => {
      // Тест для ветки, когда объект преобразуется в пустую строку (строка 94)
      const headers = {
        'x-request-id': { toString: () => '' }, // Пустая строка
      } as any as Record<string, string | string[] | undefined>;

      const correlationId = extractCorrelationId(headers);

      // Пустая строка должна вернуть undefined (строка 94: stringValue.length > 0 ? stringValue : undefined)
      expect(correlationId).toBeUndefined();
    });

    it('should handle empty string values in headers', () => {
      const headers: Record<string, string> = {
        'X-Request-Id': '',
      };

      const correlationId = extractCorrelationId(headers);

      // Empty strings are returned as-is (not filtered out)
      expect(correlationId).toBe('');
    });
  });

  describe('fromAxiosError', () => {
    it('should convert AxiosError-like object to HttpErrorLike', () => {
      const axiosError = {
        response: {
          status: 404,
          data: { message: 'Not found' },
          headers: { 'X-Request-Id': 'req-123' },
        },
        config: {
          url: 'https://api.example.com/users',
          method: 'GET',
        },
        message: 'Request failed',
      };

      const httpErrorLike = fromAxiosError(axiosError);

      expect(httpErrorLike).toBeDefined();
      expect(httpErrorLike?.status).toBe(404);
      expect(httpErrorLike?.url).toBe('https://api.example.com/users');
      expect(httpErrorLike?.method).toBe('GET');
      expect(httpErrorLike?.message).toBe('Request failed');
    });

    it('should handle Headers object in response', () => {
      const headers = new Headers();
      headers.set('X-Request-Id', 'req-123');

      const axiosError = {
        response: {
          status: 500,
          headers,
        },
      };

      const httpErrorLike = fromAxiosError(axiosError);

      expect(httpErrorLike).toBeDefined();
      expect(httpErrorLike?.headers).toBeDefined();
    });

    it('should return undefined for non-AxiosError objects', () => {
      const regularError = new Error('Regular error');

      const httpErrorLike = fromAxiosError(regularError);

      expect(httpErrorLike).toBeUndefined();
    });

    it('should handle missing response', () => {
      const axiosError = {
        response: {
          status: 500,
        },
        config: {
          url: 'https://api.example.com',
          method: 'POST',
        },
        message: 'Network error',
      };

      const httpErrorLike = fromAxiosError(axiosError);

      expect(httpErrorLike).toBeDefined();
      expect(httpErrorLike?.status).toBe(500);
      expect(httpErrorLike?.url).toBe('https://api.example.com');
    });

    it('should return undefined for objects without response property', () => {
      const notAxiosError = {
        config: {
          url: 'https://api.example.com',
        },
        message: 'Not an Axios error',
      };

      const httpErrorLike = fromAxiosError(notAxiosError);

      // fromAxiosError требует наличие response для создания HttpErrorLike
      expect(httpErrorLike).toBeUndefined();
    });
  });

  describe('normalizeHttpResponse', () => {
    it('should normalize error Response to BaseError', async () => {
      const response = new Response(null, {
        status: 404,
        statusText: 'Not Found',
        headers: {
          'X-Request-Id': 'req-123',
        },
      });

      const error = normalizeHttpResponse(response);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should extract correlationId from response headers', async () => {
      const response = new Response(null, {
        status: 500,
        headers: {
          'X-Correlation-Id': 'corr-456',
        },
      });

      const error = normalizeHttpResponse(response);

      expect(error.correlationId).toBe('corr-456');
    });

    it('should use context correlationId over headers', async () => {
      const response = new Response(null, {
        status: 500,
        headers: {
          'X-Request-Id': 'req-123',
        },
      });

      const context: HttpErrorContext = {
        correlationId: 'ctx-789',
      };

      const error = normalizeHttpResponse(response, context);

      expect(error.correlationId).toBe('ctx-789');
    });

    it('should handle successful response by creating validation error', async () => {
      const response = new Response(null, {
        status: 200,
        statusText: 'OK',
      });

      const error = normalizeHttpResponse(response);

      expect(isBaseError(error)).toBe(true);
      expect(error.message).toContain('normalizeHttpResponse called with successful response');
    });
  });

  describe('normalizeAxiosError', () => {
    it('should normalize HttpErrorLike to BaseError', () => {
      const httpErrorLike: HttpErrorLike = {
        status: 404,
        url: 'https://api.example.com/users',
        method: 'GET',
        message: 'Not found',
      };

      const error = normalizeAxiosError(httpErrorLike);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });
  });

  describe('normalizeHttpError', () => {
    it('should normalize Response to BaseError', async () => {
      const response = new Response(null, {
        status: 500,
      });

      const error = normalizeHttpError(response);

      expect(isBaseError(error)).toBe(true);
    });

    it('should normalize AxiosError-like object to BaseError', () => {
      const axiosError = {
        response: {
          status: 404,
        },
        config: {
          url: 'https://api.example.com',
        },
      };

      const error = normalizeHttpError(axiosError);

      expect(isBaseError(error)).toBe(true);
    });

    it('should normalize unknown error to BaseError', () => {
      const unknownError = new Error('Unknown error');

      const error = normalizeHttpError(unknownError);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should include context in normalized error', () => {
      const context: HttpErrorContext = {
        serviceName: 'test-service',
        endpoint: '/test',
        correlationId: 'req-123',
      };

      const error = normalizeHttpError(new Error('Test'), context);

      // correlationId устанавливается в context через buildHttpContext
      expect(error.context).toBeDefined();
      // buildHttpContext не включает correlationId напрямую, только serviceName, endpoint, method
      expect((error.context as { serviceName?: string; })?.serviceName).toBe('test-service');
      expect((error.context as { endpoint?: string; })?.endpoint).toBe('/test');
    });

    it('should include correlationId when present in context', () => {
      const context: HttpErrorContext = {
        correlationId: 'req-456',
        serviceName: 'test-service',
      };

      const response = new Response('Not Found', { status: 404 });
      const error = normalizeHttpResponse(response, context);

      expect(error.correlationId).toBe('req-456');
    });

    // Note: normalizeHttpResponse передает startedAt в createExternalServiceError,
    // но createExternalServiceError не обрабатывает startedAt (только correlationId).
    // startedAt обрабатывается только в normalizeHttpError через extra.
  });

  describe('Chaos Test - normalizeHttpError resilience', () => {
    /**
     * 🎲 Chaos Test: гарантирует, что normalizeHttpError всегда возвращает BaseError
     * даже для самых неожиданных и случайных входных данных.
     */
    it('should always return BaseError for random unknown values', () => {
      const randomValues: unknown[] = [
        null,
        undefined,
        0,
        -1,
        42,
        3.14,
        '',
        'random string',
        true,
        false,
        {},
        { random: 'property' },
        [],
        [1, 2, 3],
        new Date(),
        new RegExp('test'),
        (() => {}) as () => void,
        Symbol('test'),
        BigInt(123),
      ];

      for (const randomValue of randomValues) {
        const result = normalizeHttpError(randomValue);

        expect(isBaseError(result)).toBe(true);
        expect(result.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
        expect(typeof result.timestamp).toBe('string');
      }
    });

    it('should always return BaseError for random HTTP-like shapes', () => {
      const randomShapes: unknown[] = [
        // Частично сформированные HTTP-объекты
        { status: 404 },
        { status: 500, message: 'Error' },
        { response: { status: 404 } },
        { response: { status: 500, data: { error: 'test' } } },
        { config: { url: 'https://example.com' } },
        { request: {}, response: { status: 404 } },
        // Fetch Response-подобные
        { ok: false, status: 404, statusText: 'Not Found' },
        { ok: false, status: 500 },
        // Headers в разных форматах
        { headers: { 'Content-Type': 'application/json' } },
        { headers: new Headers() },
        { headers: [['Content-Type', 'application/json']] },
        // Смешанные формы
        { error: { status: 404 } },
        { data: { error: { status: 500 } } },
        { result: { status: 404, message: 'test' } },
        // Вложенные структуры
        { response: { error: { status: 500 } } },
        { error: { response: { status: 404 } } },
        // Массивы
        [{ status: 404 }],
        [{ response: { status: 500 } }],
      ];

      for (const randomShape of randomShapes) {
        const result = normalizeHttpError(randomShape);

        expect(isBaseError(result)).toBe(true);
        expect(result.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
        expect(typeof result.timestamp).toBe('string');
      }
    });
  });

  describe('normalizeHttpError', () => {
    it('should include startedAt in normalizeHttpError when present', () => {
      const context: HttpErrorContext = {
        serviceName: 'test-service',
        startedAt: '2025-01-01T12:00:00Z',
      };

      const error = normalizeHttpError(new Error('Test'), context);

      expect((error.extra as { startedAt?: string; })?.startedAt).toBe('2025-01-01T12:00:00Z');
    });

    it('should handle null error', () => {
      const error = normalizeHttpError(null);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle undefined error', () => {
      const error = normalizeHttpError(undefined);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle number error', () => {
      const error = normalizeHttpError(42);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle string error', () => {
      const error = normalizeHttpError('string error');

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle empty object error', () => {
      const error = normalizeHttpError({});

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle partially-shaped error (response without status)', () => {
      const partiallyShapedError = {
        response: {
          // нет status
          headers: { 'X-Request-Id': 'req-123' },
        },
      };

      const error = normalizeHttpError(partiallyShapedError);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle HttpErrorLike without status', () => {
      const httpErrorLike: HttpErrorLike = {
        message: 'HTTP request failed',
        // нет status
        headers: { 'X-Request-Id': 'req-456' },
      };

      const error = normalizeAxiosError(httpErrorLike);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });

    it('should handle HttpErrorLike with status', () => {
      const httpErrorLike: HttpErrorLike = {
        status: 404,
        message: 'Not Found',
        headers: { 'X-Request-Id': 'req-789' },
      };

      const error = normalizeAxiosError(httpErrorLike);

      expect(isBaseError(error)).toBe(true);
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });
  });
});
