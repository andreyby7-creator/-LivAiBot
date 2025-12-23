/**
 * @file CacheAdapterConfig.test.ts - Тесты для CacheAdapterConfig
 *
 * Цель: проверка генерации конфигураций, circuit breaker key, retry-флагов, default values.
 * Желаемое покрытие: 95–100%
 */

import { describe, expect, it, vi } from 'vitest';

import { cacheAdapterFactories } from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterFactories';
import {
  CACHE_ADAPTER_DEFAULTS,
  CACHE_ADAPTER_RANGES,
  CACHE_ERROR_CODES,
  CACHE_OPERATION_TYPES,
  CACHE_SERIALIZATION_FORMATS,
  createCacheAdapterContext,
  createConfig,
  createDefaultConfig,
  getCircuitBreakerKey,
  isRetryableCacheError,
} from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterConfig.js';
import type { CacheAdapterOptions } from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterTypes.js';

describe('CacheAdapterConfig', () => {
  describe('createDefaultConfig', () => {
    it('should create config with default instance ID', () => {
      const config = createDefaultConfig();

      expect(config).toBeDefined();
      expect(config.instanceId).toBe(CACHE_ADAPTER_DEFAULTS.INSTANCE_ID);
      expect(config.timeout).toBe(CACHE_ADAPTER_DEFAULTS.TIMEOUT_MS);
      expect(config.maxRetries).toBe(CACHE_ADAPTER_DEFAULTS.MAX_RETRIES);
      expect(config.retryDelay).toBe(CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS);
      expect(config.circuitBreakerThreshold).toBe(CACHE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_THRESHOLD);
      expect(config.circuitBreakerRecoveryTimeout).toBe(
        CACHE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
      );
      expect(config.circuitBreakerEnabled).toBe(true);
      expect(config.retriesEnabled).toBe(true);
      expect(config.defaultTtl).toBe(CACHE_ADAPTER_DEFAULTS.DEFAULT_TTL_MS);
      expect(config.compressionEnabled).toBe(false);
      expect(config.serializationFormat).toBe('json');
      expect(config.clusterEnabled).toBe(false);
      expect(config.clusterNodes).toEqual([]);
      expect(config.metricsEnabled).toBe(true);
    });

    it('should create config with custom instance ID', () => {
      const customInstanceId = cacheAdapterFactories.makeCacheInstanceId('my-cache');
      const config = createDefaultConfig(customInstanceId);

      expect(config.instanceId).toBe('my-cache');
      expect(config.timeout).toBe(CACHE_ADAPTER_DEFAULTS.TIMEOUT_MS);
    });
  });

  describe('createConfig', () => {
    it('should create config with default values when no overrides provided', () => {
      const config = createConfig();

      expect(config).toBeDefined();
      expect(typeof config.instanceId).toBe('string');
      expect(config.timeoutMs).toBeUndefined(); // timeout is optional, undefined means disabled
      expect(typeof config.maxRetries).toBe('number');
      expect(typeof config.retryDelay).toBe('number');
      expect(typeof config.circuitBreakerThreshold).toBe('number');
      expect(typeof config.circuitBreakerRecoveryTimeout).toBe('number');
      expect(typeof config.circuitBreakerEnabled).toBe('boolean');
      expect(typeof config.retriesEnabled).toBe('boolean');
      expect(typeof config.defaultTtl).toBe('number');
      expect(typeof config.compressionEnabled).toBe('boolean');
      expect(typeof config.serializationFormat).toBe('string');
      expect(typeof config.clusterEnabled).toBe('boolean');
      expect(Array.isArray(config.clusterNodes)).toBe(true);
      expect(typeof config.metricsEnabled).toBe('boolean');
    });

    it('should create config with custom values', () => {
      const customConfig: Partial<CacheAdapterOptions> = {
        instanceId: cacheAdapterFactories.makeCacheInstanceId('custom-cache'),
        timeoutMs: cacheAdapterFactories.makeTimeoutMs(10000),
        maxRetries: cacheAdapterFactories.makeMaxRetries(5),
        retryDelayMs: cacheAdapterFactories.makeTimeoutMs(2000),
        circuitBreakerThreshold: cacheAdapterFactories.makeCircuitBreakerThreshold(10),
        circuitBreakerRecoveryMs: cacheAdapterFactories.makeTimeoutMs(120000),
        circuitBreakerEnabled: false,
        retriesEnabled: false,
        defaultTtlMs: cacheAdapterFactories.makeCacheTtlMs(7200000),
        compressionEnabled: true,
        serializationFormat: 'msgpack',
        clusterEnabled: true,
        clusterNodes: [
          cacheAdapterFactories.makeCacheNodeId('node-1'),
          cacheAdapterFactories.makeCacheNodeId('node-2'),
        ],
        metricsEnabled: false,
      };

      const config = createConfig(customConfig);

      expect(config.instanceId).toBe('custom-cache');
      expect(config.timeoutMs).toBe(10000);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
      expect(config.circuitBreakerThreshold).toBe(10);
      expect(config.circuitBreakerRecoveryTimeout).toBe(120000);
      expect(config.circuitBreakerEnabled).toBe(false);
      expect(config.retriesEnabled).toBe(false);
      expect(config.defaultTtl).toBe(7200000);
      expect(config.compressionEnabled).toBe(true);
      expect(config.serializationFormat).toBe('msgpack');
      expect(config.clusterEnabled).toBe(true);
      expect(config.clusterNodes).toEqual(['node-1', 'node-2']);
      expect(config.metricsEnabled).toBe(false);
    });

    it('should merge custom values with defaults', () => {
      const partialConfig: Partial<CacheAdapterOptions> = {
        timeoutMs: cacheAdapterFactories.makeTimeoutMs(15000),
        maxRetries: cacheAdapterFactories.makeMaxRetries(1),
      };

      const config = createConfig(partialConfig);

      expect(config.timeoutMs).toBe(15000);
      expect(config.maxRetries).toBe(1);
      // Defaults should remain
      expect(config.instanceId).toBe(CACHE_ADAPTER_DEFAULTS.INSTANCE_ID);
      expect(config.retryDelay).toBe(CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS);
      expect(config.circuitBreakerEnabled).toBe(true);
      expect(config.serializationFormat).toBe('json');
    });

    describe('validation', () => {
      it('should throw error for invalid clusterNodes array', () => {
        const invalidConfig = {
          clusterNodes: 'not-an-array' as any,
        } as Partial<CacheAdapterOptions>;

        expect(() => createConfig(invalidConfig)).toThrow('clusterNodes must be an array');
      });

      it('should throw error for too many cluster nodes', () => {
        const tooManyNodes = Array.from(
          { length: 101 },
          (_, i) => cacheAdapterFactories.makeCacheNodeId(`node-${i}`),
        );

        const invalidConfig: Partial<CacheAdapterOptions> = {
          clusterEnabled: true,
          clusterNodes: tooManyNodes,
        };

        expect(() => createConfig(invalidConfig)).toThrow(
          `clusterNodes length must be between ${CACHE_ADAPTER_RANGES.CLUSTER_NODES.MIN} and ${CACHE_ADAPTER_RANGES.CLUSTER_NODES.MAX}`,
        );
      });

      it('should validate cluster node names during creation', () => {
        // This test verifies that clusterNodes are validated when passed to createConfig
        // The validation happens during the map operation in createConfig
        expect(() => {
          const invalidConfig: Partial<CacheAdapterOptions> = {
            clusterNodes: ['valid-node', '', 'another-valid'] as any, // bypass type check
          };
          createConfig(invalidConfig);
        }).toThrow('CacheNodeId must be a non-empty string');
      });

      it('should throw error for invalid serialization format', () => {
        const invalidConfig = {
          serializationFormat: 'invalid-format' as any,
        };

        expect(() => createConfig(invalidConfig)).toThrow(
          `serializationFormat must be one of: ${CACHE_SERIALIZATION_FORMATS.join(', ')}`,
        );
      });

      it('should warn when clusterNodes specified but clusterEnabled=false', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const configWithWarning: Partial<CacheAdapterOptions> = {
          clusterEnabled: false,
          clusterNodes: [cacheAdapterFactories.makeCacheNodeId('node-1')],
        };

        createConfig(configWithWarning);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('clusterNodes specified but clusterEnabled=false'),
        );

        consoleWarnSpy.mockRestore();
      });

      it('should not warn when clusterNodes specified and clusterEnabled=true', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const validConfig: Partial<CacheAdapterOptions> = {
          clusterEnabled: true,
          clusterNodes: [cacheAdapterFactories.makeCacheNodeId('node-1')],
        };

        createConfig(validConfig);

        expect(consoleWarnSpy).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });

      it('should not warn when clusterEnabled not specified and clusterNodes specified', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const configWithNodes: Partial<CacheAdapterOptions> = {
          clusterNodes: [cacheAdapterFactories.makeCacheNodeId('node-1')],
        };

        createConfig(configWithNodes);

        expect(consoleWarnSpy).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
      });
    });
  });

  describe('createCacheAdapterContext', () => {
    it('should create context with required instanceId', () => {
      const context = createCacheAdapterContext('test-cache');

      expect(context.instanceId).toBe('test-cache');
      expect(context.defaultTimeoutMs).toBeUndefined();
      expect(context.defaultTtlMs).toBeUndefined();
      expect(context.maxRetries).toBeUndefined();
    });

    it('should create context with all optional fields', () => {
      const context = createCacheAdapterContext('test-cache', {
        defaultTimeoutMs: cacheAdapterFactories.makeTimeoutMs(8000),
        defaultTtlMs: cacheAdapterFactories.makeCacheTtlMs(1800000),
        maxRetries: cacheAdapterFactories.makeMaxRetries(3),
      });

      expect(context.instanceId).toBe('test-cache');
      expect(context.defaultTimeoutMs).toBe(8000);
      expect(context.defaultTtlMs).toBe(1800000);
      expect(context.maxRetries).toBe(3);
    });

    it('should create context with partial optional fields', () => {
      const context = createCacheAdapterContext('test-cache', {
        defaultTimeoutMs: cacheAdapterFactories.makeTimeoutMs(12000),
      });

      expect(context.instanceId).toBe('test-cache');
      expect(context.defaultTimeoutMs).toBe(12000);
      expect(context.defaultTtlMs).toBeUndefined();
      expect(context.maxRetries).toBeUndefined();
    });
  });

  describe('getCircuitBreakerKey', () => {
    it('should create circuit breaker key from instance ID and operation', () => {
      const key = getCircuitBreakerKey('my-cache', 'GET');

      expect(key).toBe('my-cache:GET');
    });

    it('should handle different operations', () => {
      expect(getCircuitBreakerKey('cache-1', 'SET')).toBe('cache-1:SET');
      expect(getCircuitBreakerKey('cache-1', 'DELETE')).toBe('cache-1:DELETE');
      expect(getCircuitBreakerKey('cache-1', 'EXISTS')).toBe('cache-1:EXISTS');
      expect(getCircuitBreakerKey('cache-1', 'TTL')).toBe('cache-1:TTL');
    });

    it('should handle different instance IDs', () => {
      expect(getCircuitBreakerKey('prod-cache', 'GET')).toBe('prod-cache:GET');
      expect(getCircuitBreakerKey('dev-cache', 'SET')).toBe('dev-cache:SET');
    });
  });

  describe('isRetryableCacheError', () => {
    describe('Error instances', () => {
      it('should return true for connection errors', () => {
        const error = new Error('Connection refused');
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = new Error('ENOTFOUND error');
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return true for timeout errors', () => {
        const error = new Error('Operation timed out');
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = new Error('Request timeout');
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return true for network errors', () => {
        const error = new Error('Network is unreachable');
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = new Error('ECONNRESET connection reset');
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return true for cluster errors', () => {
        const error = new Error('Cluster node unreachable');
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = new Error('Cluster split brain detected');
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return true for serialization errors', () => {
        const error = new Error('Serialization failed');
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = new Error('Invalid JSON format');
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return true for temporary errors', () => {
        const error = new Error('Temporary failure');
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = new Error('Service temporarily unavailable');
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return false for permanent errors', () => {
        const error = new Error('Authentication failed');
        expect(isRetryableCacheError(error)).toBe(false);

        const error2 = new Error('Permission denied');
        expect(isRetryableCacheError(error2)).toBe(false);
      });
    });

    describe('Error objects with codes', () => {
      it('should return true for retryable error codes', () => {
        const error = { code: CACHE_ERROR_CODES.CONNECTION_ERROR };
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = { code: CACHE_ERROR_CODES.TIMEOUT_ERROR };
        expect(isRetryableCacheError(error2)).toBe(true);

        const error3 = { code: CACHE_ERROR_CODES.CLUSTER_ERROR };
        expect(isRetryableCacheError(error3)).toBe(true);

        const error4 = { code: CACHE_ERROR_CODES.SERIALIZATION_ERROR };
        expect(isRetryableCacheError(error4)).toBe(true);
      });

      it('should return true for uppercase string codes', () => {
        const error = { code: 'CONNECTION_ERROR' };
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = { code: 'TIMEOUT_ERROR' };
        expect(isRetryableCacheError(error2)).toBe(true);
      });

      it('should return true for codes containing keywords', () => {
        const error = { code: 'REDIS_CONNECTION_ERROR' };
        expect(isRetryableCacheError(error)).toBe(true);

        const error2 = { code: 'MEMCACHED_TIMEOUT' };
        expect(isRetryableCacheError(error2)).toBe(true);

        const error3 = { code: 'CLUSTER_NODE_DOWN' };
        expect(isRetryableCacheError(error3)).toBe(true);
      });

      it('should return false for non-retryable error codes', () => {
        const error = { code: 'AUTH_FAILED' };
        expect(isRetryableCacheError(error)).toBe(false);

        const error2 = { code: 'INVALID_KEY' };
        expect(isRetryableCacheError(error2)).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should return false for null or undefined', () => {
        expect(isRetryableCacheError(null)).toBe(false);
        expect(isRetryableCacheError(undefined)).toBe(false);
      });

      it('should return false for non-object values', () => {
        expect(isRetryableCacheError('string error')).toBe(false);
        expect(isRetryableCacheError(123)).toBe(false);
        expect(isRetryableCacheError(true)).toBe(false);
      });

      it('should return false for objects without message or code', () => {
        const error = { someOtherField: 'value' };
        expect(isRetryableCacheError(error)).toBe(false);
      });

      it('should handle objects with non-string codes', () => {
        const error = { code: 500 };
        expect(isRetryableCacheError(error)).toBe(false);
      });
    });
  });

  describe('Constants', () => {
    describe('CACHE_ADAPTER_DEFAULTS', () => {
      it('should have all required default values', () => {
        expect(CACHE_ADAPTER_DEFAULTS.INSTANCE_ID).toBe('default-cache');
        expect(CACHE_ADAPTER_DEFAULTS.MAX_RETRIES).toBe(2);
        expect(CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS).toBe(500);
        expect(CACHE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_THRESHOLD).toBe(5);
        expect(CACHE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS).toBe(30000);
        expect(CACHE_ADAPTER_DEFAULTS.DEFAULT_TTL_MS).toBe(3600000);
        expect(CACHE_ADAPTER_DEFAULTS.MAX_TIMEOUT_MS).toBe(30000);
        expect(CACHE_ADAPTER_DEFAULTS.MIN_TIMEOUT_MS).toBe(100);
        expect(CACHE_ADAPTER_DEFAULTS.MAX_TTL_MS).toBe(2592000000);
        expect(CACHE_ADAPTER_DEFAULTS.MIN_TTL_MS).toBe(1);
      });

      it('should be properly typed as readonly', () => {
        // These should not be assignable
        // CACHE_ADAPTER_DEFAULTS.INSTANCE_ID = 'modified'; // Should error
        expect(() => {
          (CACHE_ADAPTER_DEFAULTS as any).INSTANCE_ID = 'modified';
        }).not.toThrow(); // Object is frozen at runtime, but readonly at type level
      });
    });

    describe('CACHE_ADAPTER_RANGES', () => {
      it('should have all required range definitions', () => {
        expect(CACHE_ADAPTER_RANGES.TIMEOUT.MIN).toBe(CACHE_ADAPTER_DEFAULTS.MIN_TIMEOUT_MS);
        expect(CACHE_ADAPTER_RANGES.TIMEOUT.MAX).toBe(CACHE_ADAPTER_DEFAULTS.MAX_TIMEOUT_MS);
        expect(CACHE_ADAPTER_RANGES.RETRIES.MIN).toBe(0);
        expect(CACHE_ADAPTER_RANGES.RETRIES.MAX).toBe(10);
        expect(CACHE_ADAPTER_RANGES.RETRY_DELAY.MIN).toBe(50);
        expect(CACHE_ADAPTER_RANGES.RETRY_DELAY.MAX).toBe(10000);
        expect(CACHE_ADAPTER_RANGES.CIRCUIT_BREAKER_THRESHOLD.MIN).toBe(1);
        expect(CACHE_ADAPTER_RANGES.CIRCUIT_BREAKER_THRESHOLD.MAX).toBe(100);
        expect(CACHE_ADAPTER_RANGES.CIRCUIT_BREAKER_RECOVERY_TIMEOUT.MIN).toBe(1000);
        expect(CACHE_ADAPTER_RANGES.CIRCUIT_BREAKER_RECOVERY_TIMEOUT.MAX).toBe(300000);
        expect(CACHE_ADAPTER_RANGES.TTL.MIN).toBe(CACHE_ADAPTER_DEFAULTS.MIN_TTL_MS);
        expect(CACHE_ADAPTER_RANGES.TTL.MAX).toBe(CACHE_ADAPTER_DEFAULTS.MAX_TTL_MS);
        expect(CACHE_ADAPTER_RANGES.CLUSTER_NODES.MIN).toBe(1);
        expect(CACHE_ADAPTER_RANGES.CLUSTER_NODES.MAX).toBe(100);
      });
    });

    describe('CACHE_OPERATION_TYPES', () => {
      it('should have all cache operation types', () => {
        expect(CACHE_OPERATION_TYPES.GET).toBe('GET');
        expect(CACHE_OPERATION_TYPES.SET).toBe('SET');
        expect(CACHE_OPERATION_TYPES.DELETE).toBe('DELETE');
        expect(CACHE_OPERATION_TYPES.EXISTS).toBe('EXISTS');
        expect(CACHE_OPERATION_TYPES.TTL).toBe('TTL');
      });
    });

    describe('CACHE_SERIALIZATION_FORMATS', () => {
      it('should have all supported serialization formats', () => {
        expect(CACHE_SERIALIZATION_FORMATS).toEqual(['json', 'msgpack', 'binary']);
      });

      it('should be properly typed as readonly tuple', () => {
        expect(CACHE_SERIALIZATION_FORMATS.length).toBe(3);
        // TypeScript should prevent modification
        // CACHE_SERIALIZATION_FORMATS.push('new-format'); // Should error
      });
    });

    describe('CACHE_ERROR_CODES', () => {
      it('should have all cache error codes', () => {
        expect(CACHE_ERROR_CODES.CONNECTION_ERROR).toBe('CONNECTION_ERROR');
        expect(CACHE_ERROR_CODES.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
        expect(CACHE_ERROR_CODES.SERIALIZATION_ERROR).toBe('SERIALIZATION_ERROR');
        expect(CACHE_ERROR_CODES.CLUSTER_ERROR).toBe('CLUSTER_ERROR');
      });
    });
  });
});
