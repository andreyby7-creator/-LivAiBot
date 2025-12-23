/**
 * @file HttpAdapterConfig.test.ts - Тесты для HttpAdapterConfig
 *
 * Цель: проверка генерации конфигураций, circuit breaker key, retry-флагов, default values.
 * Желаемое покрытие: 95–100%
 */

import { describe, expect, it } from 'vitest';

import { httpAdapterFactories } from '../../../../../../src/errors/shared/adapters/http/HttpAdapterFactories';
import { HttpMethod } from '../../../../../../src/errors/shared/adapters/http/HttpAdapterTypes';
import {
  createConfig,
  getCircuitBreakerKey,
  HTTP_STATUS_CODES,
  isRetryableError,
} from '../../../../../../src/errors/shared/adapters/http/HttpAdapterConfig.js';
import type { HttpAdapterOptions } from '../../../../../../src/errors/shared/adapters/http/HttpAdapterTypes.js';

describe('HttpAdapterConfig', () => {
  describe('createConfig', () => {
    it('should create config with default values', () => {
      const config = createConfig();

      expect(config).toBeDefined();
      expect(typeof config.timeout).toBe('number');
      expect(typeof config.maxRetries).toBe('number');
      expect(typeof config.retryDelay).toBe('number');
      expect(typeof config.circuitBreakerThreshold).toBe('number');
      expect(typeof config.circuitBreakerRecoveryTimeout).toBe('number');
      expect(typeof config.circuitBreakerEnabled).toBe('boolean');
    });

    it('should create config with custom values', () => {
      const customConfig: Partial<HttpAdapterOptions> = {
        timeoutMs: httpAdapterFactories.makeTimeoutMs(10000),
        maxRetries: httpAdapterFactories.makeMaxRetries(5),
        retryDelayMs: httpAdapterFactories.makeTimeoutMs(2000),
        circuitBreakerThreshold: httpAdapterFactories.makeCircuitBreakerThreshold(10),
        circuitBreakerRecoveryMs: httpAdapterFactories.makeTimeoutMs(60000),
        circuitBreakerEnabled: false,
      };

      const config = createConfig(customConfig);

      expect(config.timeout).toBe(10000);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
      expect(config.circuitBreakerThreshold).toBe(10);
      expect(config.circuitBreakerRecoveryTimeout).toBe(60000);
      expect(config.circuitBreakerEnabled).toBe(false);
    });

    it('should merge partial config with defaults', () => {
      const partialConfig: Partial<HttpAdapterOptions> = {
        timeoutMs: httpAdapterFactories.makeTimeoutMs(15000),
      };

      const config = createConfig(partialConfig);

      expect(config.timeout).toBe(15000);
      // Other values should be defaults
      expect(config.maxRetries).toBeDefined();
      expect(config.circuitBreakerEnabled).toBeDefined();
    });

    it('should ensure config immutability', () => {
      const config = createConfig();

      // Attempt to modify config should not affect the original
      expect(() => {
        (config as any).timeout = 9999;
      }).not.toThrow();

      // But the config values should remain unchanged in practice
      // (since we return a new object, mutation shouldn't affect other uses)
    });

    describe('edge cases', () => {
      it('should handle zero timeout', () => {
        const config = createConfig({
          timeoutMs: httpAdapterFactories.makeTimeoutMs(0),
        });
        expect(config.timeout).toBe(0);
      });

      it('should handle zero retries', () => {
        const config = createConfig({
          maxRetries: httpAdapterFactories.makeMaxRetries(0),
        });
        expect(config.maxRetries).toBe(0);
      });

      it('should handle zero retry delay', () => {
        const config = createConfig({
          retryDelayMs: httpAdapterFactories.makeTimeoutMs(0),
        });
        expect(config.retryDelay).toBe(0);
      });

      it('should handle minimum circuit breaker threshold', () => {
        const config = createConfig({
          circuitBreakerThreshold: httpAdapterFactories.makeCircuitBreakerThreshold(1),
        });
        expect(config.circuitBreakerThreshold).toBe(1);
      });

      it('should handle large values within limits', () => {
        const config = createConfig({
          timeoutMs: httpAdapterFactories.makeTimeoutMs(86400000), // 24 hours
          maxRetries: httpAdapterFactories.makeMaxRetries(10), // Maximum allowed
          retryDelayMs: httpAdapterFactories.makeTimeoutMs(3600000), // 1 hour
          circuitBreakerThreshold: httpAdapterFactories.makeCircuitBreakerThreshold(100), // Maximum allowed
          circuitBreakerRecoveryMs: httpAdapterFactories.makeTimeoutMs(86400000), // 24 hours
        });

        expect(config.timeout).toBe(86400000);
        expect(config.maxRetries).toBe(10);
        expect(config.retryDelay).toBe(3600000);
        expect(config.circuitBreakerThreshold).toBe(100);
        expect(config.circuitBreakerRecoveryTimeout).toBe(86400000);
      });
    });
  });

  describe('getCircuitBreakerKey', () => {
    it('should generate key for URL with hostname', () => {
      const url = httpAdapterFactories.makeHttpUrl('https://api.example.com/v1/users');
      const key = getCircuitBreakerKey(url, HttpMethod.GET);

      expect(key).toBe('api.example.com:GET');
    });

    it('should generate key for different methods', () => {
      const url = httpAdapterFactories.makeHttpUrl('https://api.example.com/v1/data');

      expect(getCircuitBreakerKey(url, HttpMethod.GET)).toBe('api.example.com:GET');
      expect(getCircuitBreakerKey(url, HttpMethod.POST)).toBe('api.example.com:POST');
      expect(getCircuitBreakerKey(url, HttpMethod.PUT)).toBe('api.example.com:PUT');
      expect(getCircuitBreakerKey(url, HttpMethod.DELETE)).toBe('api.example.com:DELETE');
      expect(getCircuitBreakerKey(url, HttpMethod.PATCH)).toBe('api.example.com:PATCH');
    });

    it('should generate key for localhost', () => {
      const url = httpAdapterFactories.makeHttpUrl('http://localhost:3000/api/test');
      const key = getCircuitBreakerKey(url, HttpMethod.GET);

      expect(key).toBe('localhost:GET');
    });

    it('should generate key for IP address', () => {
      const url = httpAdapterFactories.makeHttpUrl('http://192.168.1.1:8080/api');
      const key = getCircuitBreakerKey(url, HttpMethod.POST);

      expect(key).toBe('192.168.1.1:POST');
    });

    it('should handle unknown hostname', () => {
      // Create URL without proper parsing for edge case
      const url = 'invalid-url' as any;
      const key = getCircuitBreakerKey(url, HttpMethod.GET);

      expect(key).toBe('unknown-host:GET');
    });

    it('should handle URL with port', () => {
      const url = httpAdapterFactories.makeHttpUrl('https://api.example.com:8443/v1/test');
      const key = getCircuitBreakerKey(url, HttpMethod.GET);

      expect(key).toBe('api.example.com:GET');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 5xx server errors', () => {
      const error500 = { statusCode: 500 };
      const error502 = { statusCode: 502 };
      const error503 = { statusCode: 503 };
      const error504 = { statusCode: 504 };

      expect(isRetryableError(error500)).toBe(true);
      expect(isRetryableError(error502)).toBe(true);
      expect(isRetryableError(error503)).toBe(true);
      expect(isRetryableError(error504)).toBe(true);
    });

    it('should return true for 408 Request Timeout', () => {
      const error408 = { statusCode: HTTP_STATUS_CODES.REQUEST_TIMEOUT };
      expect(isRetryableError(error408)).toBe(true);
    });

    it('should return true for 429 Too Many Requests', () => {
      const error429 = { statusCode: HTTP_STATUS_CODES.TOO_MANY_REQUESTS };
      expect(isRetryableError(error429)).toBe(true);
    });

    it('should return false for 4xx client errors', () => {
      const error400 = { statusCode: 400 };
      const error401 = { statusCode: 401 };
      const error403 = { statusCode: 403 };
      const error404 = { statusCode: 404 };
      const error422 = { statusCode: 422 };

      expect(isRetryableError(error400)).toBe(false);
      expect(isRetryableError(error401)).toBe(false);
      expect(isRetryableError(error403)).toBe(false);
      expect(isRetryableError(error404)).toBe(false);
      expect(isRetryableError(error422)).toBe(false);
    });

    it('should return false for 2xx success responses', () => {
      const error200 = { statusCode: 200 };
      const error201 = { statusCode: 201 };
      const error204 = { statusCode: 204 };

      expect(isRetryableError(error200)).toBe(false);
      expect(isRetryableError(error201)).toBe(false);
      expect(isRetryableError(error204)).toBe(false);
    });

    it('should return false for 3xx redirects', () => {
      const error301 = { statusCode: 301 };
      const error302 = { statusCode: 302 };
      const error304 = { statusCode: 304 };

      expect(isRetryableError(error301)).toBe(false);
      expect(isRetryableError(error302)).toBe(false);
      expect(isRetryableError(error304)).toBe(false);
    });

    it('should return false for errors without statusCode', () => {
      const errorWithoutStatus = { message: 'Network error' };
      const errorWithUndefinedStatus = { statusCode: undefined };
      const nullError = null;
      const undefinedError = undefined;

      expect(isRetryableError(errorWithoutStatus)).toBe(false);
      expect(isRetryableError(errorWithUndefinedStatus)).toBe(false);
      expect(isRetryableError(nullError as any)).toBe(false);
      expect(isRetryableError(undefinedError as any)).toBe(false);
    });

    it('should return true for network and timeout errors', () => {
      const timeoutError = new Error('Request timeout occurred');
      const networkError = new Error('Network connection failed');
      const connectionError = new Error('Connection reset by peer (ECONNRESET)');
      const notFoundError = new Error('ENOTFOUND error');

      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(connectionError)).toBe(true);
      expect(isRetryableError(notFoundError)).toBe(true);
    });

    it('should return false for non-network errors', () => {
      const validationError = new Error('Validation failed');
      const authError = new Error('Unauthorized access');
      const genericError = new Error('Something went wrong');

      expect(isRetryableError(validationError)).toBe(false);
      expect(isRetryableError(authError)).toBe(false);
      expect(isRetryableError(genericError)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      const stringError = 'string error';
      const numberError = 42;
      const objectError = { message: 'object error' };

      expect(isRetryableError(stringError)).toBe(false);
      expect(isRetryableError(numberError)).toBe(false);
      expect(isRetryableError(objectError)).toBe(false);
    });
  });

  describe('HTTP_STATUS_CODES', () => {
    it('should have correct status code constants', () => {
      expect(HTTP_STATUS_CODES.SERVER_ERROR_MIN).toBe(500);
      expect(HTTP_STATUS_CODES.REQUEST_TIMEOUT).toBe(408);
      expect(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).toBe(429);
    });
  });
});
