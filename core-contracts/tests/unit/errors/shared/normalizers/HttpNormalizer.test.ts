import { describe, expect, it } from 'vitest';

import {
  extractHttpStatusCode,
  extractHttpUrl,
  isHttpAdapterError,
  isHttpNetworkError,
  normalizeHttpError,
} from '../../../../../src/errors/shared/normalizers/HttpNormalizer';

import { LIVAI_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';

describe('HttpNormalizer', () => {
  describe('normalizeHttpError', () => {
    describe('Edge cases - invalid inputs', () => {
      it('should handle null input', () => {
        const result = normalizeHttpError(null as any);
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('Unknown HTTP error');
      });

      it('should handle undefined input', () => {
        const result = normalizeHttpError(undefined as any);
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('Unknown HTTP error');
      });

      it('should handle string input', () => {
        const result = normalizeHttpError('some error string');
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('Unknown HTTP error');
      });

      it('should handle number input', () => {
        const result = normalizeHttpError(42 as any);
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('Unknown HTTP error');
      });

      it('should handle empty object input', () => {
        const result = normalizeHttpError({});
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('Unknown HTTP error');
      });

      it('should handle object with message', () => {
        const result = normalizeHttpError({ message: 'Custom error message' });
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('Custom error message');
      });
    });

    describe('Response-like objects', () => {
      it('should handle axios-style response', () => {
        const axiosResponse = {
          url: 'https://api.example.com/users',
          status: 404,
          statusText: 'Not Found',
          method: 'GET',
          headers: { 'content-type': 'application/json' },
          data: { error: 'User not found' },
        };

        const result = normalizeHttpError(axiosResponse);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_NOT_FOUND);
        expect(result.message).toBe('HTTP 404 Not Found');
        expect(result.details?.statusCode).toBe(404);
        expect(result.details?.url).toBe('https://api.example.com/users');
        expect(result.details?.method).toBe('GET');
        expect(result.details?.headers).toEqual({ 'content-type': 'application/json' });
      });

      it('should handle fetch-style response', () => {
        const fetchResponse = {
          url: 'https://api.example.com/data',
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Map([['content-type', 'text/plain']]), // fetch uses Map
        };

        const result = normalizeHttpError(fetchResponse);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_NETWORK_SSL_ERROR);
        expect(result.message).toBe('HTTP 500 Internal Server Error');
        expect(result.details?.statusCode).toBe(500);
        expect(result.details?.url).toBe('https://api.example.com/data');
      });

      it('should handle response with array headers', () => {
        const responseWithArrayHeaders = {
          url: 'https://api.example.com/test',
          status: 200,
          statusText: 'OK',
          headers: {
            'set-cookie': ['session=abc123', 'theme=dark'],
            'content-type': 'application/json',
          },
        };

        const result = normalizeHttpError(responseWithArrayHeaders);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.details?.headers).toEqual({
          'set-cookie': 'session=abc123, theme=dark',
          'content-type': 'application/json',
        });
      });

      it('should handle response with number headers', () => {
        const responseWithNumberHeaders = {
          url: 'https://api.example.com/test',
          status: 200,
          headers: {
            'content-length': 1024,
            'x-rate-limit': 100,
          },
        };

        const result = normalizeHttpError(responseWithNumberHeaders);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.details?.headers).toEqual({
          'content-length': '1024',
          'x-rate-limit': '100',
        });
      });

      it('should extract user-agent from headers', () => {
        const response = {
          url: 'https://api.example.com/test',
          status: 403,
          headers: {
            'user-agent': 'MyApp/1.0',
            'authorization': 'Bearer token123',
          },
        };

        const result = normalizeHttpError(response);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.details?.userAgent).toBe('MyApp/1.0');
      });

      it('should handle invalid status codes', () => {
        const response = {
          url: 'https://api.example.com/test',
          status: 999, // Invalid HTTP status code
        };

        const result = normalizeHttpError(response);
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('HTTP request failed without valid status code');
      });

      it('should handle status codes below 100', () => {
        const response = {
          url: 'https://api.example.com/test',
          status: 99, // Invalid HTTP status code
        };

        const result = normalizeHttpError(response);
        expect(isHttpAdapterError(result)).toBe(true);
        expect(result.message).toBe('HTTP request failed without valid status code');
      });
    });

    describe('Error-like objects', () => {
      it('should handle axios error format', () => {
        const axiosError = {
          statusCode: 429,
          statusText: 'Too Many Requests',
          response: {
            status: 429,
            headers: { 'retry-after': '60' },
            data: { message: 'Rate limit exceeded' },
          },
          request: {
            url: 'https://api.example.com/users',
            method: 'POST',
          },
        };

        const result = normalizeHttpError(axiosError);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_RATE_LIMIT);
        expect(result.message).toBe('HTTP 429 Too Many Requests');
        expect(result.details?.statusCode).toBe(429);
        expect(result.details?.url).toBe('https://api.example.com/users');
        expect(result.details?.method).toBe('POST');
        expect(result.details?.responseBody).toEqual({ message: 'Rate limit exceeded' });
      });

      it('should prefer statusCode over status', () => {
        const errorObj = {
          statusCode: 404,
          status: 500, // Should be ignored
          response: { data: 'Not found' },
        };

        const result = normalizeHttpError(errorObj);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_NOT_FOUND);
        expect(result.details?.statusCode).toBe(404);
      });

      it('should handle statusMessage fallback', () => {
        const errorObj = {
          status: 503,
          statusMessage: 'Service Temporarily Unavailable',
          response: { body: 'Server overload' },
        };

        const result = normalizeHttpError(errorObj);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_UNAVAILABLE);
        expect((result.details as any)?.statusText).toBe('Service Temporarily Unavailable');
        expect(result.details?.responseBody).toBe('Server overload');
      });

      it('should handle direct url and method properties', () => {
        const errorObj = {
          url: 'https://api.example.com/endpoint',
          method: 'DELETE',
          statusCode: 401,
        };

        const result = normalizeHttpError(errorObj);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.details?.url).toBe('https://api.example.com/endpoint');
        expect(result.details?.method).toBe('DELETE');
      });
    });

    describe('HTTP status code mapping', () => {
      const statusCodeTests = [
        {
          status: 400,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_BAD_REQUEST,
          description: '400 Bad Request',
        },
        {
          status: 401,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_AUTH_FAILED,
          description: '401 Unauthorized',
        },
        {
          status: 403,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_AUTH_FAILED,
          description: '403 Forbidden',
        },
        {
          status: 404,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_NOT_FOUND,
          description: '404 Not Found',
        },
        {
          status: 405,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_METHOD_NOT_ALLOWED,
          description: '405 Method Not Allowed',
        },
        {
          status: 408,
          expectedCode: LIVAI_ERROR_CODES.INFRA_NETWORK_TIMEOUT,
          description: '408 Request Timeout',
        },
        {
          status: 409,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_CONFLICT,
          description: '409 Conflict',
        },
        {
          status: 410,
          expectedCode: LIVAI_ERROR_CODES.INFRA_NETWORK_CONNECTION_REFUSED,
          description: '410 Gone',
        },
        {
          status: 413,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_PAYLOAD_TOO_LARGE,
          description: '413 Payload Too Large',
        },
        {
          status: 414,
          expectedCode: LIVAI_ERROR_CODES.INFRA_NETWORK_CONNECTION_REFUSED,
          description: '414 URI Too Long',
        },
        {
          status: 415,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_UNSUPPORTED_MEDIA_TYPE,
          description: '415 Unsupported Media Type',
        },
        {
          status: 422,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_VALIDATION_FAILED,
          description: '422 Unprocessable Entity',
        },
        {
          status: 429,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_RATE_LIMIT,
          description: '429 Too Many Requests',
        },
        {
          status: 451,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_AUTH_FAILED,
          description: '451 Unavailable For Legal Reasons',
        },
        {
          status: 500,
          expectedCode: LIVAI_ERROR_CODES.INFRA_NETWORK_SSL_ERROR,
          description: '500 Internal Server Error',
        },
        {
          status: 502,
          expectedCode: LIVAI_ERROR_CODES.INFRA_NETWORK_DNS_FAILED,
          description: '502 Bad Gateway',
        },
        {
          status: 503,
          expectedCode: LIVAI_ERROR_CODES.INFRA_EXTERNAL_API_UNAVAILABLE,
          description: '503 Service Unavailable',
        },
        {
          status: 504,
          expectedCode: LIVAI_ERROR_CODES.INFRA_NETWORK_TIMEOUT,
          description: '504 Gateway Timeout',
        },
      ];

      statusCodeTests.forEach(({ status, expectedCode, description }) => {
        it(`should map ${description}`, () => {
          const response = { status, statusText: 'Test' };
          const result = normalizeHttpError(response);
          expect(isHttpNetworkError(result)).toBe(true);
          expect(result.code).toBe(expectedCode);
          expect(result.details?.statusCode).toBe(status);
        });
      });

      it('should handle unknown status codes in client range', () => {
        const response = { status: 418, statusText: "I'm a teapot" }; // 418 is unhandled
        const result = normalizeHttpError(response);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_NETWORK_CONNECTION_REFUSED);
        expect(result.details?.statusCode).toBe(418);
      });

      it('should handle unknown status codes in server range', () => {
        const response = { status: 507, statusText: 'Insufficient Storage' }; // 507 is handled
        const result = normalizeHttpError(response);
        expect(isHttpNetworkError(result)).toBe(true);
        expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_NETWORK_CONNECTION_REFUSED);
        expect(result.details?.statusCode).toBe(507);
      });
    });
  });

  describe('Type guards', () => {
    it('should correctly identify NetworkError', () => {
      const networkError = normalizeHttpError({ status: 404 });
      const adapterError = normalizeHttpError({});

      expect(isHttpNetworkError(networkError)).toBe(true);
      expect(isHttpNetworkError(adapterError)).toBe(false);

      expect(isHttpAdapterError(networkError)).toBe(false);
      expect(isHttpAdapterError(adapterError)).toBe(true);
    });

    it('should return false for invalid input types', () => {
      expect(isHttpNetworkError({} as any)).toBe(false);
      expect(isHttpNetworkError({ _tag: 'WrongTag' } as any)).toBe(false);

      expect(isHttpAdapterError({} as any)).toBe(false);
      expect(isHttpAdapterError({ _tag: 'WrongTag' } as any)).toBe(false);
    });
  });

  describe('Utility functions', () => {
    describe('extractHttpStatusCode', () => {
      it('should extract status code from NetworkError', () => {
        const networkError = normalizeHttpError({ status: 404 });
        expect(extractHttpStatusCode(networkError)).toBe(404);
      });

      it('should extract status code from AdapterError', () => {
        const adapterError = normalizeHttpError({ statusCode: 500 });
        expect(extractHttpStatusCode(adapterError)).toBe(500);
      });

      it('should return undefined for invalid cases', () => {
        const adapterError = normalizeHttpError({});
        expect(extractHttpStatusCode(adapterError)).toBeUndefined();
      });

      it('should return undefined when details is null', () => {
        // Создаем mock объект с undefined details
        const mockResult = {
          _tag: 'SharedAdapterError' as const,
          category: 'adapter' as const,
          code: 'SHARED_INFRA_HTTP_ADAPTER_ERROR' as const,
          message: 'test',
          details: undefined,
        };
        expect(extractHttpStatusCode(mockResult)).toBeUndefined();
      });

      it('should return undefined when statusCode is not a number', () => {
        const adapterError = normalizeHttpError({ statusCode: 'not-a-number' as any });
        expect(extractHttpStatusCode(adapterError)).toBeUndefined();
      });
    });

    describe('extractHttpUrl', () => {
      it('should extract URL from NetworkError', () => {
        const networkError = normalizeHttpError({
          url: 'https://api.example.com/test',
          status: 200,
        });
        expect(extractHttpUrl(networkError)).toBe('https://api.example.com/test');
      });

      it('should extract URL from AdapterError', () => {
        const adapterError = normalizeHttpError({
          url: 'https://api.example.com/error',
          statusCode: 500,
        });
        expect(extractHttpUrl(adapterError)).toBe('https://api.example.com/error');
      });

      it('should return undefined when URL is not available', () => {
        const error = normalizeHttpError({ status: 404 });
        expect(extractHttpUrl(error)).toBeUndefined();
      });

      it('should return undefined when details is null', () => {
        const mockResult = {
          _tag: 'SharedAdapterError' as const,
          category: 'adapter' as const,
          code: 'SHARED_INFRA_HTTP_ADAPTER_ERROR' as const,
          message: 'test',
          details: undefined,
        };
        expect(extractHttpUrl(mockResult)).toBeUndefined();
      });

      it('should return undefined when url is not a string', () => {
        const adapterError = normalizeHttpError({ url: 123 as any });
        expect(extractHttpUrl(adapterError)).toBeUndefined();
      });
    });
  });

  describe('Coverage for internal functions', () => {
    // These tests ensure we hit the internal function branches
    it('should handle objects that do not match extraction patterns', () => {
      const result = normalizeHttpError({
        url: 'https://api.example.com/test',
        method: 'GET',
      });
      expect(isHttpAdapterError(result)).toBe(true);
      expect(result.message).toBe('Unknown HTTP error');
    });

    it('should handle context extraction with invalid status code', () => {
      const result = normalizeHttpError({
        statusCode: 999, // Invalid status code
        url: 'https://api.example.com/test',
      });
      expect(isHttpAdapterError(result)).toBe(true);
      expect(result.message).toBe('HTTP request failed without valid status code');
    });

    it('should handle timeout and other properties', () => {
      const result = normalizeHttpError({
        url: 'https://api.example.com/test',
        status: 408,
        timeout: 5000,
      });
      expect(isHttpNetworkError(result)).toBe(true);
      expect(result.details?.timeout).toBe(5000);
    });
  });

  describe('Property-based tests', () => {
    it('should always return TaggedError for any input', () => {
      const testInputs = [
        null,
        undefined,
        'http error',
        404,
        true,
        false,
        {},
        { status: 404 },
        { statusCode: 500 },
        { response: { status: 200 } },
        { request: { url: 'test' } },
        [],
        new Error('test'),
        Symbol('test'),
        () => {},
        { status: 200, statusText: 'OK', headers: { 'content-type': 'json' } },
        { statusCode: 429, response: { data: 'rate limited' } },
        { url: 'https://api.test.com', method: 'GET', timeout: 5000 },
      ];

      testInputs.forEach((input) => {
        const result = normalizeHttpError(input);
        expect(result).toBeDefined();
        expect(result).toHaveProperty('_tag');
        expect(['NetworkError', 'SharedAdapterError']).toContain(result._tag);
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('message');
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      });
    });

    it('should never throw for any input', () => {
      const problematicInputs: any[] = [
        null,
        undefined,
        {},
        [],
        'string',
        0,
        false,
        Symbol('test'),
        new Map(),
        new Set(),
        new Date(),
        /regex/,
        () => {
          throw new Error('test');
        },
        { circular: {} },
        { __proto__: null },
        { constructor: undefined },
        { toString: 'not a function' },
        { status: NaN },
        { statusCode: Infinity },
      ];

      problematicInputs.forEach((input) => {
        expect(() => normalizeHttpError(input)).not.toThrow();
      });
    });

    it('should never return undefined', () => {
      const edgeCaseInputs = [
        null,
        undefined,
        {},
        [],
        '',
        0,
        false,
        { status: undefined },
        { statusCode: null },
        { response: NaN },
        { request: {} },
      ];

      edgeCaseInputs.forEach((input) => {
        const result = normalizeHttpError(input);
        expect(result).not.toBeUndefined();
        expect(result).not.toBeNull();
      });
    });
  });

  describe('Stability / Snapshot tests', () => {
    it('should produce identical output for same input (snapshot)', () => {
      const testCases = [
        { status: 404, statusText: 'Not Found' },
        { statusCode: 500, response: { data: 'Server Error' } },
        { url: 'https://api.test.com', method: 'POST', timeout: 30000 },
        null,
        undefined,
        'http error',
        404,
        {},
      ];

      testCases.forEach((input) => {
        // Run multiple times to ensure stability
        const results = Array.from({ length: 3 }, () => normalizeHttpError(input));

        // All results should be identical
        results.forEach((result) => {
          expect(result._tag).toBe(results[0]._tag);
          expect(result.category).toBe(results[0].category);
          expect(result.code).toBe(results[0].code);
          expect(result.message).toBe(results[0].message);

          // Details should also be structurally identical (excluding timestamps if any)
          if (result.details && results[0].details) {
            expect(result.details).toEqual(results[0].details);
          } else {
            expect(result.details).toBe(results[0].details);
          }
        });
      });
    });

    it('should produce byte-to-byte identical output for primitives', () => {
      const primitiveInputs = [
        null,
        undefined,
        '',
        'http error message',
        0,
        404,
        500,
        true,
        false,
      ];

      primitiveInputs.forEach((input) => {
        const result1 = normalizeHttpError(input);
        const result2 = normalizeHttpError(input);

        // Should be completely identical
        expect(result1).toEqual(result2);
        expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
      });
    });
  });
});
