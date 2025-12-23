/**
 * @file CacheAdapterFactories.test.ts - Тесты для CacheAdapterFactories
 *
 * Цель: проверка фабрик branded types: CacheKey, TTL, timeouts, instance/node IDs.
 * Желаемое покрытие: 95%+
 */

import { describe, expect, it } from 'vitest';

import {
  cacheAdapterFactories,
  CacheAdapterValidationError,
} from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterFactories';

describe('CacheAdapterFactories', () => {
  describe('makeCacheKey', () => {
    it('should create valid CacheKey from valid cache key strings', () => {
      const validKeys = [
        'user:123',
        'session:abc123',
        'product:456',
        'cache:key:with:colons',
        'simple-key',
        'key_with_underscores',
        'key-with-dashes',
        '123numeric',
      ];

      validKeys.forEach((key) => {
        const result = cacheAdapterFactories.makeCacheKey(key);
        expect(typeof result).toBe('string');
        expect(result).toBe(key);
      });
    });

    it('should throw CacheAdapterValidationError for empty or invalid cache key strings', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheKey('');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheKey('   ');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheKey('  \t  ');
      }).toThrow(CacheAdapterValidationError);
    });

    it('should throw error with correct message for empty cache key', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheKey('');
      }).toThrow('CacheKey must be a non-empty string');
    });

    it('should throw error with correct factory name', () => {
      try {
        cacheAdapterFactories.makeCacheKey('');
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeCacheKey');
          expect(error.value).toBe('');
        }
      }
    });
  });

  describe('makeCacheTtlMs', () => {
    it('should create valid CacheTtlMs from valid TTL values', () => {
      const validTtls = [
        1000, // 1 second
        3600000, // 1 hour
        86400000, // 1 day
        604800000, // 1 week
        2592000000, // 30 days (max)
        1, // minimum valid
      ];

      validTtls.forEach((ttl) => {
        const result = cacheAdapterFactories.makeCacheTtlMs(ttl);
        expect(typeof result).toBe('number');
        expect(result).toBe(ttl);
      });
    });

    it('should throw CacheAdapterValidationError for invalid TTL values', () => {
      const invalidTtls = [
        0, // zero not allowed
        -1000, // negative
        -1, // negative
        2592000001, // too large (> 30 days)
        4000000000, // way too large
        NaN, // not a number
        Infinity, // infinity
        -Infinity, // negative infinity
      ];

      invalidTtls.forEach((ttl) => {
        expect(() => {
          cacheAdapterFactories.makeCacheTtlMs(ttl);
        }).toThrow(CacheAdapterValidationError);
      });
    });

    it('should throw error with correct message for invalid TTL', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheTtlMs(0);
      }).toThrow('CacheTtlMs must be a finite number between 1 and 2592000000');

      expect(() => {
        cacheAdapterFactories.makeCacheTtlMs(-1000);
      }).toThrow('CacheTtlMs must be a finite number between 1 and 2592000000');

      expect(() => {
        cacheAdapterFactories.makeCacheTtlMs(3000000000);
      }).toThrow('CacheTtlMs must be a finite number between 1 and 2592000000');
    });

    it('should throw error with correct factory name for TTL validation', () => {
      try {
        cacheAdapterFactories.makeCacheTtlMs(0);
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeCacheTtlMs');
          expect(error.value).toBe(0);
        }
      }
    });
  });

  describe('makeTimeoutMs', () => {
    it('should create valid TimeoutMs from valid timeout values', () => {
      const validTimeouts = [
        100, // minimum
        500,
        1000,
        5000,
        30000,
        120000, // 2 minutes
        300000, // 5 minutes (max)
      ];

      validTimeouts.forEach((timeout) => {
        const result = cacheAdapterFactories.makeTimeoutMs(timeout);
        expect(typeof result).toBe('number');
        expect(result).toBe(timeout);
      });
    });

    it('should throw CacheAdapterValidationError for invalid timeout values', () => {
      const invalidTimeouts = [
        99, // too small (< 100ms)
        50,
        0,
        -1000, // negative
        -1,
        300001, // too large (> 5 minutes)
        400000,
        1000000,
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidTimeouts.forEach((timeout) => {
        expect(() => {
          cacheAdapterFactories.makeTimeoutMs(timeout);
        }).toThrow(CacheAdapterValidationError);
      });
    });

    it('should throw error with correct message for invalid timeout', () => {
      expect(() => {
        cacheAdapterFactories.makeTimeoutMs(50);
      }).toThrow('TimeoutMs must be a finite number between 100 and 300000');

      expect(() => {
        cacheAdapterFactories.makeTimeoutMs(400000);
      }).toThrow('TimeoutMs must be a finite number between 100 and 300000');
    });

    it('should throw error with correct factory name for timeout validation', () => {
      try {
        cacheAdapterFactories.makeTimeoutMs(50);
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeTimeoutMs');
          expect(error.value).toBe(50);
        }
      }
    });
  });

  describe('makeDurationMs', () => {
    it('should create valid DurationMs from valid duration values', () => {
      const validDurations = [
        0, // zero allowed
        1,
        100,
        1000,
        5000,
        30000,
        120000,
        300000,
      ];

      validDurations.forEach((duration) => {
        const result = cacheAdapterFactories.makeDurationMs(duration);
        expect(typeof result).toBe('number');
        expect(result).toBe(duration);
      });
    });

    it('should throw CacheAdapterValidationError for invalid duration values', () => {
      const invalidDurations = [
        -1, // negative
        -100,
        -1000,
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidDurations.forEach((duration) => {
        expect(() => {
          cacheAdapterFactories.makeDurationMs(duration);
        }).toThrow(CacheAdapterValidationError);
      });
    });

    it('should throw error with correct message for invalid duration', () => {
      expect(() => {
        cacheAdapterFactories.makeDurationMs(-100);
      }).toThrow('DurationMs must be a non-negative finite number');
    });

    it('should throw error with correct factory name for duration validation', () => {
      try {
        cacheAdapterFactories.makeDurationMs(-100);
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeDurationMs');
          expect(error.value).toBe(-100);
        }
      }
    });
  });

  describe('makeMaxRetries', () => {
    it('should create valid MaxRetries from valid retry values', () => {
      const validRetries = [
        0, // no retries
        1,
        2,
        3,
        5,
        10, // maximum
      ];

      validRetries.forEach((retries) => {
        const result = cacheAdapterFactories.makeMaxRetries(retries);
        expect(typeof result).toBe('number');
        expect(result).toBe(retries);
      });
    });

    it('should throw CacheAdapterValidationError for invalid retry values', () => {
      const invalidRetries = [
        -1, // negative
        -5,
        11, // too large (> 10)
        15,
        100,
        2.5, // not integer
        3.14,
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidRetries.forEach((retries) => {
        expect(() => {
          cacheAdapterFactories.makeMaxRetries(retries);
        }).toThrow(CacheAdapterValidationError);
      });
    });

    it('should throw error with correct message for invalid retries', () => {
      expect(() => {
        cacheAdapterFactories.makeMaxRetries(-1);
      }).toThrow('MaxRetries must be an integer between 0 and 10');

      expect(() => {
        cacheAdapterFactories.makeMaxRetries(15);
      }).toThrow('MaxRetries must be an integer between 0 and 10');

      expect(() => {
        cacheAdapterFactories.makeMaxRetries(2.5);
      }).toThrow('MaxRetries must be an integer between 0 and 10');
    });

    it('should throw error with correct factory name for retries validation', () => {
      try {
        cacheAdapterFactories.makeMaxRetries(-1);
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeMaxRetries');
          expect(error.value).toBe(-1);
        }
      }
    });
  });

  describe('makeCacheInstanceId', () => {
    it('should create valid CacheInstanceId from valid instance ID strings', () => {
      const validIds = [
        'cache-1',
        'redis-cluster',
        'memcached-01',
        'cache_instance_1',
        'prod-cache',
        'dev-cache-123',
      ];

      validIds.forEach((id) => {
        const result = cacheAdapterFactories.makeCacheInstanceId(id);
        expect(typeof result).toBe('string');
        expect(result).toBe(id);
      });
    });

    it('should throw CacheAdapterValidationError for empty or invalid instance ID strings', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheInstanceId('');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheInstanceId('   ');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheInstanceId('  \t  ');
      }).toThrow(CacheAdapterValidationError);
    });

    it('should throw error with correct message for empty instance ID', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheInstanceId('');
      }).toThrow('CacheInstanceId must be a non-empty string');
    });

    it('should throw error with correct factory name for instance ID validation', () => {
      try {
        cacheAdapterFactories.makeCacheInstanceId('');
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeCacheInstanceId');
          expect(error.value).toBe('');
        }
      }
    });
  });

  describe('makeCacheNodeId', () => {
    it('should create valid CacheNodeId from valid node ID strings', () => {
      const validIds = [
        'node-1',
        'redis-01',
        'cache-node-abc',
        'node_instance_1',
        'prod-node-123',
        'cluster-node-001',
      ];

      validIds.forEach((id) => {
        const result = cacheAdapterFactories.makeCacheNodeId(id);
        expect(typeof result).toBe('string');
        expect(result).toBe(id);
      });
    });

    it('should throw CacheAdapterValidationError for empty or invalid node ID strings', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheNodeId('');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheNodeId('   ');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheNodeId('  \t  ');
      }).toThrow(CacheAdapterValidationError);
    });

    it('should throw error with correct message for empty node ID', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheNodeId('');
      }).toThrow('CacheNodeId must be a non-empty string');
    });

    it('should throw error with correct factory name for node ID validation', () => {
      try {
        cacheAdapterFactories.makeCacheNodeId('');
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeCacheNodeId');
          expect(error.value).toBe('');
        }
      }
    });
  });

  describe('makeCacheCircuitBreakerKey', () => {
    it('should create valid CacheCircuitBreakerKey from valid key strings', () => {
      const validKeys = [
        'cache-1:get',
        'redis-cluster:set',
        'cache:delete',
        'instance-1:exists',
        'cluster:ttl',
        'cache-key:with:colons',
      ];

      validKeys.forEach((key) => {
        const result = cacheAdapterFactories.makeCacheCircuitBreakerKey(key);
        expect(typeof result).toBe('string');
        expect(result).toBe(key);
      });
    });

    it('should throw CacheAdapterValidationError for empty or invalid circuit breaker key strings', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheCircuitBreakerKey('');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheCircuitBreakerKey('   ');
      }).toThrow(CacheAdapterValidationError);

      expect(() => {
        cacheAdapterFactories.makeCacheCircuitBreakerKey('  \t  ');
      }).toThrow(CacheAdapterValidationError);
    });

    it('should throw error with correct message for empty circuit breaker key', () => {
      expect(() => {
        cacheAdapterFactories.makeCacheCircuitBreakerKey('');
      }).toThrow('CacheCircuitBreakerKey must be a non-empty string');
    });

    it('should throw error with correct factory name for circuit breaker key validation', () => {
      try {
        cacheAdapterFactories.makeCacheCircuitBreakerKey('');
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeCacheCircuitBreakerKey');
          expect(error.value).toBe('');
        }
      }
    });
  });

  describe('makeCircuitBreakerThreshold', () => {
    it('should create valid CircuitBreakerThreshold from valid threshold values', () => {
      const validThresholds = [
        1, // minimum
        2,
        3,
        5,
        10,
        50,
        100, // maximum
      ];

      validThresholds.forEach((threshold) => {
        const result = cacheAdapterFactories.makeCircuitBreakerThreshold(threshold);
        expect(typeof result).toBe('number');
        expect(result).toBe(threshold);
      });
    });

    it('should throw CacheAdapterValidationError for invalid threshold values', () => {
      const invalidThresholds = [
        0, // too small (< 1)
        -1,
        -5,
        101, // too large (> 100)
        150,
        1000,
        2.5, // not integer
        10.7,
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidThresholds.forEach((threshold) => {
        expect(() => {
          cacheAdapterFactories.makeCircuitBreakerThreshold(threshold);
        }).toThrow(CacheAdapterValidationError);
      });
    });

    it('should throw error with correct message for invalid threshold', () => {
      expect(() => {
        cacheAdapterFactories.makeCircuitBreakerThreshold(0);
      }).toThrow('CircuitBreakerThreshold must be an integer between 1 and 100');

      expect(() => {
        cacheAdapterFactories.makeCircuitBreakerThreshold(150);
      }).toThrow('CircuitBreakerThreshold must be an integer between 1 and 100');

      expect(() => {
        cacheAdapterFactories.makeCircuitBreakerThreshold(10.5);
      }).toThrow('CircuitBreakerThreshold must be an integer between 1 and 100');
    });

    it('should throw error with correct factory name for threshold validation', () => {
      try {
        cacheAdapterFactories.makeCircuitBreakerThreshold(0);
      } catch (error) {
        expect(error).toBeInstanceOf(CacheAdapterValidationError);
        if (error instanceof CacheAdapterValidationError) {
          expect(error.factory).toBe('makeCircuitBreakerThreshold');
          expect(error.value).toBe(0);
        }
      }
    });
  });

  describe('ValidationError class', () => {
    it('should create CacheAdapterValidationError with correct properties', () => {
      const error = new CacheAdapterValidationError(
        'Test validation error',
        'testFactory',
        { invalid: 'value' },
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CacheAdapterValidationError);
      expect(error.name).toBe('CacheAdapterValidationError');
      expect(error.message).toBe('[testFactory] Test validation error');
      expect(error.factory).toBe('testFactory');
      expect(error.value).toEqual({ invalid: 'value' });
      expect(error.stack).toBeDefined();
    });

    it('should have correct inheritance', () => {
      const error = new CacheAdapterValidationError('test', 'factory', 'value');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof CacheAdapterValidationError).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(CacheAdapterValidationError.prototype);
    });

    it('should handle different value types in error', () => {
      const testCases = [
        'string value',
        123,
        { object: 'value' },
        [1, 2, 3],
        null,
        undefined,
      ];

      testCases.forEach((value, index) => {
        const error = new CacheAdapterValidationError(
          `Test error ${index}`,
          'testFactory',
          value,
        );

        expect(error.value).toBe(value);
        expect(error.message).toBe(`[testFactory] Test error ${index}`);
      });
    });
  });

  describe('cacheAdapterFactories object', () => {
    it('should export all factory functions', () => {
      expect(typeof cacheAdapterFactories.makeCacheKey).toBe('function');
      expect(typeof cacheAdapterFactories.makeCacheTtlMs).toBe('function');
      expect(typeof cacheAdapterFactories.makeTimeoutMs).toBe('function');
      expect(typeof cacheAdapterFactories.makeDurationMs).toBe('function');
      expect(typeof cacheAdapterFactories.makeMaxRetries).toBe('function');
      expect(typeof cacheAdapterFactories.makeCacheInstanceId).toBe('function');
      expect(typeof cacheAdapterFactories.makeCacheNodeId).toBe('function');
      expect(typeof cacheAdapterFactories.makeCacheCircuitBreakerKey).toBe('function');
      expect(typeof cacheAdapterFactories.makeCircuitBreakerThreshold).toBe('function');
      expect(cacheAdapterFactories.ValidationError).toBe(CacheAdapterValidationError);
    });

    it('should have correct structure', () => {
      const expectedKeys = [
        'makeCacheKey',
        'makeCacheTtlMs',
        'makeTimeoutMs',
        'makeDurationMs',
        'makeMaxRetries',
        'makeCacheInstanceId',
        'makeCacheNodeId',
        'makeCacheCircuitBreakerKey',
        'makeCircuitBreakerThreshold',
        'ValidationError',
      ];

      const actualKeys = Object.keys(cacheAdapterFactories);
      expect(actualKeys).toHaveLength(expectedKeys.length);
      expectedKeys.forEach((key) => {
        expect(actualKeys).toContain(key);
      });
    });
  });
});
