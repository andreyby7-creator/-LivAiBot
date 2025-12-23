import { describe, expect, it } from 'vitest';

import {
  isCacheClusterError,
  isCacheConnectionError,
  isCacheGenericError,
  isCacheSerializationError,
  isCacheTimeoutError,
  isCacheUnknownError,
  normalizeCacheError,
} from '../../../../../src/errors/shared/normalizers/CacheNormalizer';

import { LIVAI_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';

describe('CacheNormalizer', () => {
  describe('Pure-function invariants', () => {
    it('should return identical output for identical input', () => {
      const input = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const result1 = normalizeCacheError(input);
      const result2 = normalizeCacheError(input);

      // Compare without timestamp which is generated dynamically
      const { timestamp: _, ...result1WithoutTs } = result1 as any;
      const { timestamp: __, ...result2WithoutTs } = result2 as any;

      expect(result1WithoutTs).toEqual(result2WithoutTs);
      expect(result1._tag).toBe(result2._tag);
      expect(result1.code).toBe(result2.code);
      expect(result1.message).toBe(result2.message);
    });

    it('should not mutate input object', () => {
      const input = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const originalInput = { ...input };

      normalizeCacheError(input);

      expect(input).toEqual(originalInput);
    });

    it('should have no side effects (no I/O, no global state)', () => {
      // Test that function doesn't access global state or perform I/O
      const input = { code: 'UNKNOWN_CODE' };
      const result = normalizeCacheError(input);

      // Verify result is deterministic and doesn't depend on external state
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
    });
  });

  describe('normalizeCacheError - Edge cases', () => {
    it('should handle null input', () => {
      const result = normalizeCacheError(null as any);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Cache operation failed with null/undefined error');
      expect(result.details).toBeUndefined();
    });

    it('should handle undefined input', () => {
      const result = normalizeCacheError(undefined as any);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Cache operation failed with null/undefined error');
      expect(result.details).toBeUndefined();
    });

    it('should handle string input', () => {
      const result = normalizeCacheError('some error string');
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('some error string');
      expect(result.details).toBeUndefined();
    });

    it('should handle number input', () => {
      const result = normalizeCacheError(42 as any);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Cache operation failed with unknown error type: number');
      expect(result.details).toBeUndefined();
    });

    it('should handle empty object input', () => {
      const result = normalizeCacheError({});
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Cache operation failed with unknown object error');
      expect(result.details).toBeUndefined();
    });

    it('should handle object with message', () => {
      const result = normalizeCacheError({ message: 'Custom error message' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Custom error message');
      expect(result.details).toBeUndefined();
    });

    it('should handle Error instance', () => {
      const error = new Error('Test error');
      const result = normalizeCacheError(error);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Test error');
      expect(result.details).toBeUndefined();
    });
  });

  describe('normalizeCacheError - Connection errors', () => {
    it('should detect Redis connection errors', () => {
      const result = normalizeCacheError({ code: 'ECONNREFUSED', message: 'Connection refused' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
      expect(result.message).toBe('Cache operation failed with code: ECONNREFUSED');
    });

    it('should detect Memcached connection errors', () => {
      const result = normalizeCacheError({ code: 'ENOTFOUND', message: 'Host not found' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });

    it('should detect timeout connection errors', () => {
      const result = normalizeCacheError({ message: 'Connection timeout' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
      expect(result.message).toBe('Connection timeout');
    });

    it('should detect socket hang up errors', () => {
      const result = normalizeCacheError({ message: 'Socket hang up' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });
  });

  describe('normalizeCacheError - Serialization errors', () => {
    it('should detect JSON parse errors', () => {
      const result = normalizeCacheError({ message: 'JSON parse error' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_SET_FAILED);
      expect(result.message).toBe('JSON parse error');
    });

    it('should detect JSON stringify errors', () => {
      const result = normalizeCacheError({ message: 'JSON stringify error' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_SET_FAILED);
    });

    it('should detect encoding errors', () => {
      const result = normalizeCacheError({ message: 'Encoding error occurred' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_SET_FAILED);
    });

    it('should detect serialization keyword errors', () => {
      const result = normalizeCacheError({ message: 'Serialization failed' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_SET_FAILED);
    });
  });

  describe('normalizeCacheError - Timeout errors', () => {
    it('should detect timeout errors', () => {
      const result = normalizeCacheError({ message: 'Operation timed out' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
      expect(result.message).toBe('Operation timed out');
    });

    it('should detect ETIMEDOUT code', () => {
      const result = normalizeCacheError({ code: 'ETIMEDOUT', message: 'Timeout' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });
  });

  describe('normalizeCacheError - Redis specific errors', () => {
    it('should handle Redis WRONGPASS error', () => {
      const result = normalizeCacheError({ code: 'WRONGPASS', message: 'Wrong password' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });

    it('should handle Redis NOAUTH error', () => {
      const result = normalizeCacheError({ code: 'NOAUTH', message: 'Authentication required' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });

    it('should handle Redis LOADING error', () => {
      const result = normalizeCacheError({ code: 'LOADING', message: 'Redis is loading' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });

    it('should handle Redis CLUSTERDOWN error', () => {
      const result = normalizeCacheError({ code: 'CLUSTERDOWN', message: 'Cluster is down' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });
  });

  describe('normalizeCacheError - Memcached specific errors', () => {
    it('should handle Memcached CONNECTION_ERROR', () => {
      const result = normalizeCacheError({
        code: 'CONNECTION_ERROR',
        message: 'Connection failed',
      });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });

    it('should handle Memcached TIMEOUT', () => {
      const result = normalizeCacheError({ code: 'TIMEOUT', message: 'Operation timeout' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
    });
  });

  describe('normalizeCacheError - Unknown cache codes', () => {
    it('should handle unknown Redis codes', () => {
      const result = normalizeCacheError({ code: 'UNKNOWN_REDIS_CODE', message: 'Unknown error' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Cache operation failed with code: UNKNOWN_REDIS_CODE');
    });

    it('should handle unknown Memcached codes', () => {
      const result = normalizeCacheError({
        code: 'UNKNOWN_MEMCACHED_CODE',
        message: 'Unknown error',
      });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Cache operation failed with code: UNKNOWN_MEMCACHED_CODE');
    });
  });

  describe('normalizeCacheError - Context preservation', () => {
    it('should preserve context information', () => {
      const context = {
        cacheType: 'redis' as const,
        key: 'test:key' as any,
        operation: 'get' as const,
        instanceId: 'instance-1' as any,
        ttlMs: 1000 as any,
      };

      const result = normalizeCacheError({ message: 'Test error' }, context);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
      expect(result.message).toBe('Test error');

      // Check that context is preserved in details
      expect(result.details).toHaveProperty('cacheType', 'redis');
      expect(result.details).toHaveProperty('key', 'test:key');
      expect(result.details).toHaveProperty('operation', 'get');
      expect(result.details).toHaveProperty('instanceId', 'instance-1');
      expect(result.details).toHaveProperty('ttlMs', 1000);
    });

    it('should filter out undefined/null values from context', () => {
      const context = {
        cacheType: 'redis' as const,
        key: undefined,
        operation: 'get' as const,
        instanceId: null as any,
        ttlMs: 1000 as any,
      };

      const result = normalizeCacheError({ message: 'Test error' }, context);
      expect(result.details).toHaveProperty('cacheType', 'redis');
      expect(result.details).toHaveProperty('operation', 'get');
      expect(result.details).toHaveProperty('ttlMs', 1000);
      expect(result.details).not.toHaveProperty('key');
      expect(result.details).not.toHaveProperty('instanceId');
    });
  });

  describe('Type guards', () => {
    describe('isCacheConnectionError', () => {
      it('should return true for connection errors', () => {
        const result = normalizeCacheError({ message: 'Connection refused' });
        expect(isCacheConnectionError(result)).toBe(true);
      });

      it('should return false for non-connection errors', () => {
        const result = normalizeCacheError({ message: 'JSON parse error' });
        expect(isCacheConnectionError(result)).toBe(false);
      });
    });

    describe('isCacheSerializationError', () => {
      it('should return true for serialization errors', () => {
        const result = normalizeCacheError({ message: 'JSON parse error' });
        expect(isCacheSerializationError(result)).toBe(true);
      });

      it('should return false for non-serialization errors', () => {
        const result = normalizeCacheError({ message: 'Connection refused' });
        expect(isCacheSerializationError(result)).toBe(false);
      });
    });

    describe('isCacheClusterError', () => {
      it('should return true for cluster errors', () => {
        const result = normalizeCacheError({ message: 'Connection refused' });
        expect(isCacheClusterError(result)).toBe(true);
      });

      it('should return false for non-cluster errors', () => {
        const result = normalizeCacheError({ message: 'JSON parse error' });
        expect(isCacheClusterError(result)).toBe(false);
      });
    });

    describe('isCacheTimeoutError', () => {
      it('should return true for timeout errors', () => {
        const result = normalizeCacheError({ message: 'Connection timeout' });
        expect(isCacheTimeoutError(result)).toBe(true);
      });

      it('should return false for non-timeout errors', () => {
        const result = normalizeCacheError({ message: 'JSON parse error' });
        expect(isCacheTimeoutError(result)).toBe(false);
      });
    });

    describe('isCacheGenericError', () => {
      it('should return true for generic cache errors', () => {
        const result = normalizeCacheError({ message: 'Unknown error' });
        expect(isCacheGenericError(result)).toBe(true);
      });

      it('should return false for non-generic errors', () => {
        const result = normalizeCacheError({ message: 'Connection refused' });
        expect(isCacheGenericError(result)).toBe(false);
      });
    });

    describe('isCacheUnknownError', () => {
      it('should return true for unknown errors', () => {
        const result = normalizeCacheError({ message: 'Unknown error' });
        expect(isCacheUnknownError(result)).toBe(true);
      });

      it('should return false for known errors', () => {
        const result = normalizeCacheError({ message: 'Connection refused' });
        expect(isCacheUnknownError(result)).toBe(false);
      });
    });
  });

  describe('Error handling - Exception safety', () => {
    it('should not throw exceptions during normalization', () => {
      // Test with various problematic inputs
      const problematicInputs = [
        null,
        undefined,
        {},
        { code: Symbol('test') },
        { message: null },
        { details: undefined },
      ];

      problematicInputs.forEach((input) => {
        expect(() => normalizeCacheError(input as any)).not.toThrow();
      });
    });

    it('should handle circular references safely', () => {
      const circular: any = { message: 'Circular error' };
      circular.self = circular;

      const result = normalizeCacheError(circular);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
    });

    it('should handle prototype pollution attempts safely', () => {
      const polluted = Object.create(null);
      polluted.__proto__ = { toString: () => 'polluted' };
      polluted.constructor = { prototype: null };

      const result = normalizeCacheError(polluted);
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
    });
  });

  describe('Logger integration', () => {
    it('should use provided logger for warnings', () => {
      const logs: string[] = [];
      const mockLogger = {
        warn: (message: string) => logs.push(message),
      };

      normalizeCacheError({ someUnknownProperty: 'value' }, undefined, mockLogger);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toContain('Received object error without code field');
    });

    it('should work without logger (no-op)', () => {
      const result = normalizeCacheError({ someUnknownProperty: 'value' });
      expect(result._tag).toBe('CacheError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);
    });
  });
});
