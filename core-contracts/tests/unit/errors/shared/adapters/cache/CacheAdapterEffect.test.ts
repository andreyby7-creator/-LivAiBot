/**
 * @file CacheAdapterEffect.test.ts - Тесты для CacheAdapterEffect
 *
 * Цель: покрыть весь Effect pipeline: cacheGet, cacheSet, cacheDelete, timeout, retry, circuit breaker, normalizeCacheError, стратегии ошибок.
 * Желаемое покрытие: 95–100% (особенно catchAll ветки)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect, Schedule } from 'effect';

// Use real Effect but with controlled timeouts and retries
vi.mock('effect', async () => {
  const actual = await vi.importActual('effect') as any;
  return {
    ...actual,
    // Keep real Effect functions but mock Schedule for instant retries
    Schedule: {
      ...actual.Schedule,
      spaced: vi.fn(() => actual.Schedule.recurs(0)), // No actual retries
      delayed: vi.fn(() => actual.Schedule.recurs(0)),
      recurs: vi.fn(() => actual.Schedule.recurs(0)),
      exponential: vi.fn(() => actual.Schedule.recurs(0)),
    },
  };
});

import {
  cacheDelete,
  cacheGet,
  cacheSet,
} from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterEffect';
import { cacheAdapterFactories } from '../../../../../../src/errors/shared/adapters/cache';

// Mock getCircuitBreakerKey to return consistent keys
vi.mock(
  '../../../../../../src/errors/shared/adapters/cache/CacheAdapterConfig',
  async (importOriginal: any) => {
    const actual = await importOriginal();
    return {
      ...actual,
      getCircuitBreakerKey: vi.fn((key: string, operation: string) => `${key}:${operation}`),
    };
  },
);

// Mock external functions with controlled behavior
let mockNormalizeCacheError: any = vi.fn((err) => err); // Default: return error as-is
let mockResolveAndExecuteWithCircuitBreaker: any = vi.fn(() =>
  Effect.succeed({
    success: true,
    shouldRetry: false,
    result: null,
  })
);

vi.mock('../../../../../../src/errors/shared/normalizers/CacheNormalizer', () => ({
  normalizeCacheError: (...args: any[]) => mockNormalizeCacheError?.(...args),
}));

vi.mock('../../../../../../src/errors/base/ErrorStrategies', () => ({
  resolveAndExecuteWithCircuitBreaker: (...args: any[]) =>
    mockResolveAndExecuteWithCircuitBreaker?.(...args),
}));

// Mocks for services
const mockCacheClient = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
} as any;

const mockClock = {
  now: vi.fn(() => Date.now()),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockMetrics = {
  timing: vi.fn(),
  increment: vi.fn(),
};

const mockCircuitBreaker = {
  isOpen: vi.fn(() => false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  getFailureCount: vi.fn(() => 0),
};

describe('CacheAdapterEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default behavior
    mockNormalizeCacheError = vi.fn((err) => err);
    mockResolveAndExecuteWithCircuitBreaker = vi.fn(() =>
      Effect.succeed({
        success: true,
        shouldRetry: false,
        result: null,
      })
    );
    // Reset circuit breaker state
    mockCircuitBreaker.isOpen.mockReturnValue(false);
  });

  describe('cacheGet', () => {
    const key = cacheAdapterFactories.makeCacheKey('test-key');

    it('should successfully get cache value', async () => {
      const expectedValue = 'test-value';
      mockCacheClient.get.mockResolvedValue(expectedValue);

      const result = await (Effect.runPromise as any)(
        cacheGet(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        ),
      );

      expect(result).toBe(expectedValue);
      expect(mockCacheClient.get).toHaveBeenCalledWith(key);
      expect(mockLogger.info).toHaveBeenCalledWith('Cache операция выполнена', expect.any(Object));
      expect(mockMetrics.timing).toHaveBeenCalledWith(
        'cache_operation_duration',
        expect.any(Number),
        { operation: 'GET' },
      );
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
    });

    it('should handle cache miss (null)', async () => {
      mockCacheClient.get.mockResolvedValue(null);

      const result = await (Effect.runPromise as any)(
        cacheGet(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        ),
      );

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockMetrics.timing).toHaveBeenCalled();
    });

    it('should handle circuit breaker open', async () => {
      mockCircuitBreaker.isOpen.mockReturnValue(true);

      await expect(
        (Effect.runPromise as any)(
          cacheGet(
            key,
            mockCacheClient,
            mockClock,
            mockLogger,
            mockMetrics,
            mockCircuitBreaker,
          ),
        ),
      ).rejects.toThrow('Circuit breaker open');

      expect(mockLogger.warn).toHaveBeenCalledWith('Circuit breaker открыт, операция пропущена', {
        key: expect.any(String),
      });
      expect(mockCacheClient.get).not.toHaveBeenCalled();
    });

    it('should handle cache operation error', async () => {
      const testError = new Error('Cache connection failed');
      mockCacheClient.get.mockRejectedValue(testError);

      await expect(
        (Effect.runPromise as any)(
          cacheGet(
            key,
            mockCacheClient,
            mockClock,
            mockLogger,
            mockMetrics,
            mockCircuitBreaker,
          ),
        ),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Ошибка cache операции', expect.any(Object));
      expect(mockMetrics.increment).toHaveBeenCalledWith('cache_operation_error', 1, {
        operation: 'GET',
      });
    });

    it('should handle retry scenario', async () => {
      mockResolveAndExecuteWithCircuitBreaker = vi.fn(() =>
        Effect.succeed({
          success: false,
          shouldRetry: true,
          result: null,
        })
      );

      const testError = new Error('Temporary cache error');
      mockCacheClient.get.mockRejectedValue(testError);

      await expect(
        (Effect.runPromise as any)(
          cacheGet(
            key,
            mockCacheClient,
            mockClock,
            mockLogger,
            mockMetrics,
            mockCircuitBreaker,
          ),
        ),
      ).rejects.toThrow();

      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Повтор cache операции', expect.any(Object));
    });
  });

  describe('cacheSet', () => {
    const key = cacheAdapterFactories.makeCacheKey('test-key');
    const value = 'test-value';
    const ttl = cacheAdapterFactories.makeCacheTtlMs(3600000);

    it('should successfully set cache value', async () => {
      mockCacheClient.set.mockResolvedValue(undefined);

      await (Effect.runPromise as any)(
        cacheSet(
          key,
          value,
          ttl,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        ),
      );

      expect(mockCacheClient.set).toHaveBeenCalledWith(key, value, ttl);
      expect(mockLogger.info).toHaveBeenCalledWith('Cache операция выполнена', expect.any(Object));
      expect(mockMetrics.timing).toHaveBeenCalledWith(
        'cache_operation_duration',
        expect.any(Number),
        { operation: 'SET' },
      );
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
    });

    it('should handle set without TTL', async () => {
      mockCacheClient.set.mockResolvedValue(undefined);

      await (Effect.runPromise as any)(
        cacheSet(
          key,
          value,
          undefined,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        ),
      );

      expect(mockCacheClient.set).toHaveBeenCalledWith(key, value, undefined);
    });

    it('should handle circuit breaker open', async () => {
      mockCircuitBreaker.isOpen.mockReturnValue(true);

      await expect(
        (Effect.runPromise as any)(
          cacheSet(
            key,
            value,
            ttl,
            mockCacheClient,
            mockClock,
            mockLogger,
            mockMetrics,
            mockCircuitBreaker,
          ),
        ),
      ).rejects.toThrow('Circuit breaker open');

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockCacheClient.set).not.toHaveBeenCalled();
    });
  });

  describe('cacheDelete', () => {
    const key = cacheAdapterFactories.makeCacheKey('test-key');

    it('should successfully delete cache value', async () => {
      mockCacheClient.delete.mockResolvedValue(undefined);

      await (Effect.runPromise as any)(
        cacheDelete(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        ),
      );

      expect(mockCacheClient.delete).toHaveBeenCalledWith(key);
      expect(mockLogger.info).toHaveBeenCalledWith('Cache операция выполнена', expect.any(Object));
      expect(mockMetrics.timing).toHaveBeenCalledWith(
        'cache_operation_duration',
        expect.any(Number),
        { operation: 'DELETE' },
      );
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
    });

    it('should handle circuit breaker open', async () => {
      mockCircuitBreaker.isOpen.mockReturnValue(true);

      await expect(
        (Effect.runPromise as any)(
          cacheDelete(
            key,
            mockCacheClient,
            mockClock,
            mockLogger,
            mockMetrics,
            mockCircuitBreaker,
          ),
        ),
      ).rejects.toThrow('Circuit breaker open');

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockCacheClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('timeout handling', () => {
    const key = cacheAdapterFactories.makeCacheKey('test-key');

    it('should accept timeout parameter', async () => {
      const timeoutMs = cacheAdapterFactories.makeTimeoutMs(1000);
      mockCacheClient.get.mockResolvedValue('value');

      const result = await (Effect.runPromise as any)(
        cacheGet(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          undefined, // maxRetries
          undefined, // retryDelay
          timeoutMs,
        ),
      );

      expect(result).toBe('value');
    });

    it('should work without timeout', async () => {
      mockCacheClient.get.mockResolvedValue('value');

      const result = await (Effect.runPromise as any)(
        cacheGet(
          key,
          mockCacheClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          undefined, // maxRetries
          undefined, // retryDelay
          undefined, // timeoutMs
        ),
      );

      expect(result).toBe('value');
    });
  });
});
