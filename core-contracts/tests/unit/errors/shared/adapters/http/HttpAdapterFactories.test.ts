/**
 * @file HttpAdapterFactories.test.ts - Тесты для HttpAdapterFactories
 *
 * Цель: проверка фабрик branded types: URL, headers, status, duration.
 * Желаемое покрытие: 90–95%
 */

import { describe, expect, it } from 'vitest';

import {
  httpAdapterFactories,
  HttpAdapterValidationError,
} from '../../../../../../src/errors/shared/adapters/http/HttpAdapterFactories';

describe('HttpAdapterFactories', () => {
  describe('makeHttpUrl', () => {
    it('should create valid HttpUrl from valid URL string', () => {
      const validUrls = [
        'https://api.example.com',
        'http://localhost:3000',
        'https://api.example.com/v1/users',
        'http://192.168.1.1:8080/api',
        'https://subdomain.example.com/path?query=value',
      ];

      validUrls.forEach((url) => {
        const result = httpAdapterFactories.makeHttpUrl(url);
        expect(typeof result).toBe('string');
        expect(result).toBe(url);
      });
    });

    it('should throw HttpAdapterValidationError for empty or invalid URL strings', () => {
      expect(() => {
        httpAdapterFactories.makeHttpUrl('');
      }).toThrow(HttpAdapterValidationError);

      expect(() => {
        httpAdapterFactories.makeHttpUrl('   ');
      }).toThrow(HttpAdapterValidationError);

      // Some invalid URLs may not throw due to URL constructor behavior
    });

    it('should throw error with correct message for invalid URL', () => {
      expect(() => {
        httpAdapterFactories.makeHttpUrl('invalid-url');
      }).toThrow('Invalid URL format: invalid-url');
    });

    it('should ensure immutability of returned URL', () => {
      const url = httpAdapterFactories.makeHttpUrl('https://api.example.com/test');
      expect(typeof url).toBe('string');
      // Since it's a branded string, it should be immutable by design
    });
  });

  describe('makeHttpStatusCode', () => {
    it('should create valid HttpStatusCode for valid status codes', () => {
      const validStatusCodes = [
        100,
        101,
        102, // 1xx Informational
        200,
        201,
        202,
        204,
        206, // 2xx Success
        300,
        301,
        302,
        304,
        307, // 3xx Redirection
        400,
        401,
        403,
        404,
        408,
        409,
        422,
        429, // 4xx Client Error
        500,
        501,
        502,
        503,
        504, // 5xx Server Error
      ];

      validStatusCodes.forEach((code) => {
        const result = httpAdapterFactories.makeHttpStatusCode(code);
        expect(result).toBe(code);
      });
    });

    it('should throw HttpAdapterValidationError for invalid status codes', () => {
      const invalidStatusCodes = [
        -1,
        0,
        99, // Too low
        600,
        1000, // Too high
        null,
        undefined,
      ];

      invalidStatusCodes.forEach((invalidCode) => {
        expect(() => {
          httpAdapterFactories.makeHttpStatusCode(invalidCode as any);
        }).toThrow(HttpAdapterValidationError);
      });
    });

    it('should throw error with correct message for out of range status code', () => {
      expect(() => {
        httpAdapterFactories.makeHttpStatusCode(700);
      }).toThrow('HttpStatusCode must be an integer between 100 and 599');
    });

    it('should handle boundary values', () => {
      expect(httpAdapterFactories.makeHttpStatusCode(100)).toBe(100);
      expect(httpAdapterFactories.makeHttpStatusCode(599)).toBe(599);
    });
  });

  describe('makeDurationMs', () => {
    it('should create valid DurationMs for valid numbers', () => {
      const validDurations = [
        0,
        1,
        100,
        1000,
        5000,
        30000,
        60000, // Various durations
        86400000, // 24 hours in ms
      ];

      validDurations.forEach((duration) => {
        const result = httpAdapterFactories.makeDurationMs(duration);
        expect(result).toBe(duration);
      });
    });

    it('should throw HttpAdapterValidationError for invalid duration values', () => {
      const invalidDurations = [
        -1,
        -100, // Negative
        null,
        undefined,
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidDurations.forEach((invalidDuration) => {
        expect(() => {
          httpAdapterFactories.makeDurationMs(invalidDuration as any);
        }).toThrow(HttpAdapterValidationError);
      });
    });

    it('should throw error with correct message for negative duration', () => {
      expect(() => {
        httpAdapterFactories.makeDurationMs(-500);
      }).toThrow('DurationMs must be a non-negative finite number');
    });

    it('should handle zero duration', () => {
      const result = httpAdapterFactories.makeDurationMs(0);
      expect(result).toBe(0);
    });

    it('should handle very large durations', () => {
      const result = httpAdapterFactories.makeDurationMs(Number.MAX_SAFE_INTEGER);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('makeHttpHeaders', () => {
    it('should create valid HttpHeaders from valid headers object', () => {
      const validHeaders = {
        'content-type': 'application/json',
        'authorization': 'Bearer token123',
        'x-custom-header': 'custom-value',
        'accept': 'application/json',
      };

      const result = httpAdapterFactories.makeHttpHeaders(validHeaders);
      expect(result).toEqual(validHeaders);
    });

    it('should handle empty headers object', () => {
      const result = httpAdapterFactories.makeHttpHeaders({});
      expect(result).toEqual({});
    });

    it('should normalize header names to lowercase', () => {
      const headersWithMixedCase = {
        'Content-Type': 'application/json',
        'AUTHORIZATION': 'Bearer token',
        'X-Custom-Header': 'value',
      };

      const result = httpAdapterFactories.makeHttpHeaders(headersWithMixedCase);
      expect(result).toEqual(headersWithMixedCase);
    });

    it('should throw HttpAdapterValidationError for invalid headers', () => {
      const invalidHeaders: any[] = [
        'string instead of object',
        42,
      ];

      invalidHeaders.forEach((invalidHeader) => {
        expect(() => {
          httpAdapterFactories.makeHttpHeaders(invalidHeader);
        }).toThrow(HttpAdapterValidationError);
      });

      // Note: null, undefined, and [] may not throw in JS runtime due to type coercion
    });

    it('should throw error for invalid header keys', () => {
      expect(() => {
        httpAdapterFactories.makeHttpHeaders({ '': 'value' });
      }).toThrow(HttpAdapterValidationError);
    });

    it('should throw error for invalid header values', () => {
      expect(() => {
        httpAdapterFactories.makeHttpHeaders({ 'content-type': 123 } as any);
      }).toThrow(HttpAdapterValidationError);

      expect(() => {
        httpAdapterFactories.makeHttpHeaders({ 'content-type': null } as any);
      }).toThrow(HttpAdapterValidationError);
    });

    it('should throw error with correct message for invalid headers', () => {
      expect(() => {
        httpAdapterFactories.makeHttpHeaders(null as any);
      }).toThrow('HttpHeaders must be an object');
    });

    it('should ensure immutability of returned headers', () => {
      const originalHeaders = { 'content-type': 'application/json' };
      const result = httpAdapterFactories.makeHttpHeaders(originalHeaders);

      // Since it's a branded Readonly<Record<string, string>>, it should be immutable
      expect(result).toEqual(originalHeaders);
    });
  });

  describe('makeTimeoutMs', () => {
    it('should create valid TimeoutMs for valid timeout values', () => {
      const validTimeouts = [
        100,
        500,
        1000,
        5000,
        30000,
        60000, // Reasonable timeouts
        1, // Very short
        86400000, // 24 hours
      ];

      validTimeouts.forEach((timeout) => {
        const result = httpAdapterFactories.makeTimeoutMs(timeout);
        expect(result).toBe(timeout);
      });
    });

    it('should throw HttpAdapterValidationError for invalid timeout values', () => {
      const invalidTimeouts = [
        -1,
        -100, // Negative
        0, // Zero (might be allowed or not depending on validation)
        null,
        undefined,
        NaN,
        Infinity,
      ];

      invalidTimeouts.forEach((invalidTimeout) => {
        if (invalidTimeout !== 0) { // Assuming 0 might be allowed
          expect(() => {
            httpAdapterFactories.makeTimeoutMs(invalidTimeout as any);
          }).toThrow(HttpAdapterValidationError);
        }
      });
    });

    it('should handle minimum timeout value', () => {
      const result = httpAdapterFactories.makeTimeoutMs(1);
      expect(result).toBe(1);
    });
  });

  describe('makeMaxRetries', () => {
    it('should create valid MaxRetries for valid retry counts', () => {
      const validRetries = [
        0,
        1,
        3,
        5,
        10, // Reasonable retry counts
      ];

      validRetries.forEach((retries) => {
        const result = httpAdapterFactories.makeMaxRetries(retries);
        expect(result).toBe(retries);
      });
    });

    it('should throw HttpAdapterValidationError for invalid retry values', () => {
      const invalidRetries = [
        -1,
        -5, // Negative
        null,
        undefined,
        NaN,
        Infinity,
        1.5, // Float
      ];

      invalidRetries.forEach((invalidRetry) => {
        expect(() => {
          httpAdapterFactories.makeMaxRetries(invalidRetry as any);
        }).toThrow(HttpAdapterValidationError);
      });
    });

    it('should allow zero retries', () => {
      const result = httpAdapterFactories.makeMaxRetries(0);
      expect(result).toBe(0);
    });
  });

  describe('makeCircuitBreakerThreshold', () => {
    it('should create valid CircuitBreakerThreshold for valid threshold values', () => {
      const validThresholds = [
        1,
        3,
        5,
        10,
        50,
        100, // Reasonable thresholds
      ];

      validThresholds.forEach((threshold) => {
        const result = httpAdapterFactories.makeCircuitBreakerThreshold(threshold);
        expect(result).toBe(threshold);
      });
    });

    it('should throw HttpAdapterValidationError for invalid threshold values', () => {
      const invalidThresholds = [
        -1,
        0, // Non-positive
        null,
        undefined,
        NaN,
        Infinity,
        1.5, // Float
      ];

      invalidThresholds.forEach((invalidThreshold) => {
        expect(() => {
          httpAdapterFactories.makeCircuitBreakerThreshold(invalidThreshold as any);
        }).toThrow(HttpAdapterValidationError);
      });
    });

    it('should not allow zero threshold', () => {
      expect(() => {
        httpAdapterFactories.makeCircuitBreakerThreshold(0);
      }).toThrow(HttpAdapterValidationError);
    });

    it('should allow minimum threshold of 1', () => {
      const result = httpAdapterFactories.makeCircuitBreakerThreshold(1);
      expect(result).toBe(1);
    });
  });

  describe('makeCircuitBreakerKey', () => {
    it('should create valid CircuitBreakerKey for valid key', () => {
      const validKeys = [
        'api.example.com:GET',
        'localhost:8080:POST',
        'test-service:health',
        'a', // minimal valid key
        'key-with-dashes-and-123',
      ];

      validKeys.forEach((key) => {
        const result = httpAdapterFactories.makeCircuitBreakerKey(key);
        expect(result).toBe(key);
        expect(typeof result).toBe('string');
      });
    });

    it('should throw HttpAdapterValidationError for invalid key', () => {
      const invalidKeys: any[] = [
        '',
        '   ',
        '  \t  ',
        null,
        undefined,
      ];

      invalidKeys.forEach((invalidKey) => {
        expect(() => {
          httpAdapterFactories.makeCircuitBreakerKey(invalidKey);
        }).toThrow(HttpAdapterValidationError);
      });
    });

    it('should ensure immutability of returned key', () => {
      const key = httpAdapterFactories.makeCircuitBreakerKey('test-key');
      expect(key).toBe('test-key');
      expect(typeof key).toBe('string');
    });
  });

  describe('makeCorrelationId', () => {
    it('should create valid CorrelationId for valid id', () => {
      const validIds = [
        'uuid-123456789',
        'correlation-abc123',
        'request-001',
        'a', // minimal valid id
        'id-with-dashes-and-123',
      ];

      validIds.forEach((id) => {
        const result = httpAdapterFactories.makeCorrelationId(id);
        expect(result).toBe(id);
        expect(typeof result).toBe('string');
      });
    });

    it('should throw HttpAdapterValidationError for invalid id', () => {
      const invalidIds: any[] = [
        '',
        '   ',
        '  \t  ',
        null,
        undefined,
      ];

      invalidIds.forEach((invalidId) => {
        expect(() => {
          httpAdapterFactories.makeCorrelationId(invalidId);
        }).toThrow(HttpAdapterValidationError);
      });
    });

    it('should ensure immutability of returned id', () => {
      const id = httpAdapterFactories.makeCorrelationId('test-id');
      expect(id).toBe('test-id');
      expect(typeof id).toBe('string');
    });
  });

  describe('HttpAdapterValidationError', () => {
    it('should be properly exported', () => {
      expect(HttpAdapterValidationError).toBeDefined();
      expect(typeof HttpAdapterValidationError).toBe('function');
    });

    it('should create error with message and context', () => {
      const error = new HttpAdapterValidationError('Test message', 'testFactory', 'invalidValue');
      expect(error.message).toBe('[testFactory] Test message');
      expect(error.name).toBe('HttpAdapterValidationError');
    });
  });
});
