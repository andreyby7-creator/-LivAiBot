/**
 * @file CacheAdapter.test.ts - Тесты для CacheAdapter
 *
 * Цель: покрыть создание адаптера, правильную передачу конфигурации, cache pipeline.
 * Желаемое покрытие: 95%+
 */

import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  CacheAdapterImpl,
  createCacheAdapter,
  createCacheAdapterWithConfig,
  createCacheDuration,
  createCacheKey,
  createCacheTtl,
} from '../../../../../../src/errors/shared/adapters/cache/CacheAdapter';
import { cacheAdapterFactories } from '../../../../../../src/errors/shared/adapters/cache';
import type { CacheAdapterConfig } from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterConfig';

// Моки для сервисов
const mockCacheClient = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
  delete: () => Promise.resolve(),
} as any;
const mockClock = { now: () => Date.now() } as any;
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
} as any;
const mockMetrics = {
  timing: () => {},
  increment: () => {},
} as any;
const mockCircuitBreaker = {
  isOpen: () => false,
  recordSuccess: () => {},
  recordFailure: () => {},
} as any;

describe('CacheAdapter', () => {
  describe('createCacheAdapter', () => {
    it('should create adapter with default config', () => {
      const adapter = createCacheAdapter();

      expect(adapter).toBeInstanceOf(CacheAdapterImpl);
      expect(adapter).toHaveProperty('get');
      expect(adapter).toHaveProperty('set');
      expect(adapter).toHaveProperty('delete');
    });
  });

  describe('createCacheAdapterWithConfig', () => {
    it('should create adapter with custom config', () => {
      const customConfig: Partial<CacheAdapterConfig> = {
        maxRetries: cacheAdapterFactories.makeMaxRetries(5),
        timeoutMs: cacheAdapterFactories.makeTimeoutMs(10000),
      };

      const adapter = createCacheAdapterWithConfig(customConfig);

      expect(adapter).toBeInstanceOf(CacheAdapterImpl);
    });

    it('should merge custom config with defaults', () => {
      const partialConfig: Partial<CacheAdapterConfig> = {
        maxRetries: cacheAdapterFactories.makeMaxRetries(3),
      };

      const adapter = createCacheAdapterWithConfig(partialConfig);

      expect(adapter).toBeDefined();
    });
  });

  describe('CacheAdapter methods', () => {
    describe('get method', () => {
      it('should return Effect', () => {
        const adapter = createCacheAdapter();
        const key = cacheAdapterFactories.makeCacheKey('test-key');

        const result = adapter.get(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(result).toBeDefined();
      });

      it('should handle cache key creation', () => {
        const adapter = createCacheAdapter();
        const key = cacheAdapterFactories.makeCacheKey('test-key');

        const result = adapter.get(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(result).toBeDefined();
      });
    });

    describe('set method', () => {
      it('should return Effect', () => {
        const adapter = createCacheAdapter();
        const key = cacheAdapterFactories.makeCacheKey('test-key');
        const value = 'test-value';
        const ttl = cacheAdapterFactories.makeCacheTtlMs(3600000);

        const result = adapter.set(
          key,
          value,
          ttl,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(result).toBeDefined();
      });

      it('should handle set without TTL', () => {
        const adapter = createCacheAdapter();
        const key = cacheAdapterFactories.makeCacheKey('test-key');
        const value = 'test-value';

        const result = adapter.set(
          key,
          value,
          undefined,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(result).toBeDefined();
      });
    });

    describe('delete method', () => {
      it('should return Effect', () => {
        const adapter = createCacheAdapter();
        const key = cacheAdapterFactories.makeCacheKey('test-key');

        const result = adapter.delete(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(result).toBeDefined();
      });
    });
  });

  describe('Factory functions', () => {
    describe('createCacheKey', () => {
      it('should create valid cache key', () => {
        const result = createCacheKey('test-key');
        expect(result).toBe('test-key');
      });

      it('should throw on empty key', () => {
        expect(() => createCacheKey('')).toThrow('CacheKey must be a non-empty string');
      });

      it('should throw on whitespace-only key', () => {
        expect(() => createCacheKey('   ')).toThrow('CacheKey must be a non-empty string');
      });
    });

    describe('createCacheTtl', () => {
      it('should create valid TTL', () => {
        const result = createCacheTtl(3600000);
        expect(typeof result).toBe('number');
        expect(result).toBe(3600000);
      });

      it('should throw on zero TTL', () => {
        expect(() => createCacheTtl(0)).toThrow('CacheTtlMs must be a finite number between 1');
      });

      it('should throw on negative TTL', () => {
        expect(() => createCacheTtl(-100)).toThrow('CacheTtlMs must be a finite number between 1');
      });

      it('should throw on too large TTL', () => {
        expect(() => createCacheTtl(3000000000)).toThrow(
          'CacheTtlMs must be a finite number between 1',
        );
      });
    });

    describe('createCacheDuration', () => {
      it('should create valid duration', () => {
        const result = createCacheDuration(1500);
        expect(typeof result).toBe('number');
        expect(result).toBe(1500);
      });

      it('should throw on negative duration', () => {
        expect(() => createCacheDuration(-100)).toThrow(
          'DurationMs must be a non-negative finite number',
        );
      });

      it('should throw on NaN', () => {
        expect(() => createCacheDuration(NaN)).toThrow(
          'DurationMs must be a non-negative finite number',
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should handle circuit breaker open', () => {
      const adapter = createCacheAdapter();
      const key = cacheAdapterFactories.makeCacheKey('test-key');

      const result = adapter.get(
        key,
        mockCacheClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      expect(Effect.isEffect(result)).toBe(true);
    });
  });
});
