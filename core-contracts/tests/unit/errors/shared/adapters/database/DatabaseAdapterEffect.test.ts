/**
 * @file DatabaseAdapterEffect.test.ts - Тесты для DatabaseAdapterEffect
 *
 * Цель: покрыть весь Effect pipeline: executeSelect, executeQuery, timeout, retry, circuit breaker, normalizeDatabaseError, стратегии ошибок.
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
  executeQuery,
  executeSelect,
} from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterEffect';
import {
  databaseAdapterFactories,
  TransactionIsolationLevel,
} from '../../../../../../src/errors/shared/adapters/database';
import type {
  DbExecuteResult,
  DbQueryResult,
} from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterTypes';

// Mock external functions with controlled behavior
let mockNormalizeDatabaseError: any = vi.fn((err) => err); // Default: return error as-is
let mockResolveAndExecuteWithCircuitBreaker: any = vi.fn(() =>
  Effect.succeed({
    success: true,
    shouldRetry: false,
    result: null,
  })
);

vi.mock('../../../../../../src/errors/shared/normalizers/DatabaseNormalizer', () => ({
  normalizeDatabaseError: (...args: any[]) => mockNormalizeDatabaseError?.(...args),
}));

vi.mock('../../../../../../src/errors/base/ErrorStrategies', () => ({
  resolveAndExecuteWithCircuitBreaker: (...args: any[]) =>
    mockResolveAndExecuteWithCircuitBreaker?.(...args),
}));

// Mocks for services
const mockDbClient = vi.fn();
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

describe('DatabaseAdapterEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default behavior
    mockNormalizeDatabaseError = vi.fn((err) => err);
    mockResolveAndExecuteWithCircuitBreaker = vi.fn(() =>
      Effect.succeed({
        success: true,
        shouldRetry: false,
        result: null,
      })
    );
    mockCircuitBreaker.isOpen.mockReturnValue(false);
    mockDbClient.mockReset();
  });

  describe('executeSelect', () => {
    const mockQuery = databaseAdapterFactories.makeDbQuery('SELECT * FROM users WHERE id = $1');
    const mockParams: unknown[] = ['123'];
    const mockTimeoutMs = databaseAdapterFactories.makeTimeoutMs(5000);

    it('should return successful DbQueryResult on successful SELECT', async () => {
      const mockResult = {
        rows: [{ id: '123', name: 'John' }],
        rowCount: 1,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeSelect(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any);

      expect(result).toEqual({
        rows: [{ id: '123', name: 'John' }],
        rowCount: 1,
        durationMs: expect.any(Number),
      });

      expect(mockDbClient).toHaveBeenCalledWith(mockQuery, mockParams, {
        timeout: mockTimeoutMs,
        transaction: undefined,
      });
    });

    it('should handle SELECT with transaction options', async () => {
      const mockResult = {
        rows: [{ id: '123' }],
        rowCount: 1,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const transaction = {
        id: 'tx-123',
        isolationLevel: TransactionIsolationLevel.READ_COMMITTED,
      };

      const effect = executeSelect(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
        undefined, // maxRetries
        undefined, // retryDelay
        transaction,
      );

      const result = await Effect.runPromise(effect as any) as DbQueryResult<unknown>;

      expect(result.rows).toEqual([{ id: '123' }]);
      expect(mockDbClient).toHaveBeenCalledWith(mockQuery, mockParams, {
        timeout: mockTimeoutMs,
        transaction,
      });
    });

    it('should handle SELECT request failure and log error', async () => {
      const dbError = new Error('Connection timeout');
      mockDbClient.mockRejectedValueOnce(dbError);

      // Mock error strategy to indicate failure without retry
      mockResolveAndExecuteWithCircuitBreaker.mockReturnValue(
        Effect.succeed({
          success: false,
          shouldRetry: false,
        }),
      );

      const effect = executeSelect(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const exit = await Effect.runPromiseExit(effect as any);

      expect(exit._tag).toBe('Failure');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database query failed',
        expect.objectContaining({
          databaseId: 'test-db',
          query: mockQuery,
          error: 'An unknown error occurred in Effect.tryPromise',
        }),
      );
      expect(mockMetrics.increment).toHaveBeenCalledWith('db_query_error', 1, {
        databaseId: 'test-db',
      });
    });

    it('should handle SELECT with retry on recoverable error', async () => {
      // Since Schedule is mocked to prevent retries, we test that retry logic is triggered
      const dbError = new Error('Deadlock detected');

      mockDbClient.mockRejectedValueOnce(dbError);

      // Mock error strategy to indicate retry should happen (but won't due to mocked Schedule)
      mockResolveAndExecuteWithCircuitBreaker.mockReturnValue(
        Effect.succeed({
          success: false,
          shouldRetry: true,
        }),
      );

      const effect = executeSelect(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
        1, // maxRetries
        100, // retryDelay
      );

      const exit = await Effect.runPromiseExit(effect as any);

      expect(exit._tag).toBe('Failure');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Database operation failed, will retry',
        expect.objectContaining({
          errorCode: 'INFRA_DB_002', // INFRA_ERROR_CODES.INFRA_DB_QUERY_FAILED
          databaseId: 'test-db',
        }),
      );
      // Since Schedule is mocked to recurs(0), no actual retry happens
      expect(mockDbClient).toHaveBeenCalledTimes(1); // Only original call
    });

    it('should handle empty result set', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);
      mockClock.now.mockReturnValue(1000);

      const effect = executeSelect(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any);

      expect(result).toEqual({
        rows: [],
        rowCount: 0,
        durationMs: expect.any(Number),
      });
    });

    it('should handle SELECT without params', async () => {
      const mockResult = {
        rows: [{ status: 'active' }],
        rowCount: 1,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeSelect(
        databaseAdapterFactories.makeDbQuery('SELECT status FROM config'),
        undefined,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any) as DbQueryResult<unknown>;

      expect(result.rows).toEqual([{ status: 'active' }]);
      expect(mockDbClient).toHaveBeenCalledWith(
        databaseAdapterFactories.makeDbQuery('SELECT status FROM config'),
        undefined,
        { timeout: mockTimeoutMs, transaction: undefined },
      );
    });

    it('should log successful SELECT operation', async () => {
      const mockResult = {
        rows: [{ id: '456' }],
        rowCount: 1,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeSelect(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      await Effect.runPromise(effect as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database SELECT query completed',
        expect.objectContaining({
          rowCount: 1,
        }),
      );
      expect(mockMetrics.timing).toHaveBeenCalledWith(
        'db_query_duration',
        expect.any(Number),
        { operation: 'SELECT', rowCount: 1 },
      );
    });
  });

  describe('executeQuery', () => {
    const mockQuery = databaseAdapterFactories.makeDbQuery('INSERT INTO users (name) VALUES ($1)');
    const mockParams: unknown[] = ['John'];
    const mockTimeoutMs = databaseAdapterFactories.makeTimeoutMs(3000);

    it('should return successful DbExecuteResult on successful EXECUTE', async () => {
      const mockResult = {
        affectedRows: 1,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeQuery(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any);

      expect(result).toEqual({
        affectedRows: 1,
        durationMs: expect.any(Number),
      });
    });

    it('should handle EXECUTE with zero affected rows', async () => {
      const mockResult = {
        affectedRows: 0,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeQuery(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any);

      expect(result).toEqual({
        affectedRows: 0,
        durationMs: expect.any(Number),
      });
    });

    it('should handle EXECUTE request failure', async () => {
      const dbError = new Error('Foreign key constraint violation');
      mockDbClient.mockRejectedValueOnce(dbError);

      mockResolveAndExecuteWithCircuitBreaker.mockReturnValue(
        Effect.succeed({
          success: false,
          shouldRetry: false,
        }),
      );

      const effect = executeQuery(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const exit = await Effect.runPromiseExit(effect as any);

      expect(exit._tag).toBe('Failure');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database query failed',
        expect.objectContaining({
          databaseId: 'test-db',
          query: mockQuery,
        }),
      );
    });

    it('should handle EXECUTE without params', async () => {
      const mockResult = {
        affectedRows: 5,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeQuery(
        databaseAdapterFactories.makeDbQuery('UPDATE users SET status = $1'),
        ['inactive'],
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any) as DbExecuteResult;

      expect(result.affectedRows).toBe(5);
    });

    it('should log successful EXECUTE operation', async () => {
      const mockResult = {
        affectedRows: 3,
      };

      mockDbClient.mockResolvedValueOnce(mockResult);

      const effect = executeQuery(
        mockQuery,
        mockParams,
        mockTimeoutMs,
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      await Effect.runPromise(effect as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database EXECUTE query completed',
        expect.objectContaining({
          affectedRows: 3,
        }),
      );
      expect(mockMetrics.timing).toHaveBeenCalledWith(
        'db_query_duration',
        expect.any(Number),
        { operation: 'EXECUTE', affectedRows: 3 },
      );
    });
  });

  describe('circuit breaker behavior', () => {
    it('should fail when circuit breaker is open', async () => {
      mockCircuitBreaker.isOpen.mockReturnValue(true);

      const effect = executeSelect(
        databaseAdapterFactories.makeDbQuery('SELECT 1'),
        undefined,
        databaseAdapterFactories.makeTimeoutMs(1000),
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const exit = await Effect.runPromiseExit(effect as any);

      expect(exit._tag).toBe('Failure');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker is open, skipping DB operation',
        { key: expect.stringContaining('test-db:SELECT') },
      );
      expect(mockDbClient).not.toHaveBeenCalled();
    });

    it('should succeed when circuit breaker is closed', async () => {
      mockCircuitBreaker.isOpen.mockReturnValue(false);
      mockDbClient.mockResolvedValue({ rows: [], rowCount: 0 });

      const effect = executeSelect(
        databaseAdapterFactories.makeDbQuery('SELECT 1'),
        undefined,
        databaseAdapterFactories.makeTimeoutMs(1000),
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      const result = await Effect.runPromise(effect as any) as DbQueryResult<unknown>;

      expect(result.rowCount).toBe(0);
      expect(mockDbClient).toHaveBeenCalled();
    });
  });

  describe('error normalization and strategies', () => {
    it('should normalize database errors', async () => {
      const rawError = new Error('Connection lost');
      const normalizedError = { _tag: 'DatabaseError', code: 'CONNECTION_LOST' };

      mockNormalizeDatabaseError.mockReturnValue(normalizedError);
      mockDbClient.mockRejectedValue(rawError);
      mockResolveAndExecuteWithCircuitBreaker.mockReturnValue(
        Effect.succeed({
          success: false,
          shouldRetry: false,
        }),
      );

      const effect = executeSelect(
        databaseAdapterFactories.makeDbQuery('SELECT 1'),
        undefined,
        databaseAdapterFactories.makeTimeoutMs(1000),
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      await Effect.runPromiseExit(effect as any);

      expect(mockNormalizeDatabaseError).toHaveBeenCalledWith(
        expect.objectContaining({
          _tag: 'UnknownException',
          cause: rawError,
        }),
      );
      expect(mockResolveAndExecuteWithCircuitBreaker).toHaveBeenCalledWith(
        'CONNECTION_LOST',
        normalizedError,
        [],
        expect.objectContaining({
          query: databaseAdapterFactories.makeDbQuery('SELECT 1'),
          taggedError: normalizedError,
        }),
      );
    });

    it('should handle unknown errors with default code', async () => {
      const rawError = new Error('Unknown error');
      const normalizedError = rawError; // normalizeDatabaseError returns as-is

      mockNormalizeDatabaseError.mockReturnValue(normalizedError);
      mockDbClient.mockRejectedValue(rawError);
      mockResolveAndExecuteWithCircuitBreaker.mockReturnValue(
        Effect.succeed({
          success: false,
          shouldRetry: false,
        }),
      );

      const effect = executeSelect(
        databaseAdapterFactories.makeDbQuery('SELECT 1'),
        undefined,
        databaseAdapterFactories.makeTimeoutMs(1000),
        'test-db',
        mockDbClient,
        mockClock,
        mockLogger,
        mockMetrics,
        mockCircuitBreaker,
      );

      await Effect.runPromiseExit(effect as any);

      expect(mockResolveAndExecuteWithCircuitBreaker).toHaveBeenCalledWith(
        'INFRA_DB_002', // default code for unknown errors
        normalizedError,
        [],
        expect.any(Object),
      );
    });
  });
});
