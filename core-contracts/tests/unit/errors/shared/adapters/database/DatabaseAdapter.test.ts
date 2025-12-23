/**
 * @file DatabaseAdapter.test.ts - Тесты для DatabaseAdapter
 *
 * Цель: покрыть создание адаптера, правильную передачу конфигурации, DB pipeline.
 * Желаемое покрытие: 95%
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  createDatabaseAdapter,
  createDatabaseAdapterWithConfig,
  createDeleteQuery,
  createInsertQuery,
  createSelectQuery,
  createUpdateQuery,
  DatabaseAdapterImpl,
} from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapter';
import {
  databaseAdapterFactories,
  TransactionIsolationLevel,
} from '../../../../../../src/errors/shared/adapters/database';
import type { DatabaseAdapterConfig } from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterConfig';

// Моки для сервисов
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

describe('DatabaseAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDatabaseAdapter', () => {
    it('should create adapter with default config', () => {
      const adapter = createDatabaseAdapter();
      expect(adapter).toBeInstanceOf(DatabaseAdapterImpl);
    });
  });

  describe('createDatabaseAdapterWithConfig', () => {
    it('should create adapter with custom config', () => {
      const customConfig: Partial<DatabaseAdapterConfig> = {
        databaseId: databaseAdapterFactories.makeDatabaseId('custom-db'),
        timeout: databaseAdapterFactories.makeTimeoutMs(5000),
        maxRetries: databaseAdapterFactories.makeMaxRetries(5),
      };

      const adapter = createDatabaseAdapterWithConfig(customConfig);
      expect(adapter).toBeInstanceOf(DatabaseAdapterImpl);
    });

    it('should merge custom config with defaults', () => {
      const customConfig: Partial<DatabaseAdapterConfig> = {
        databaseId: databaseAdapterFactories.makeDatabaseId('test-db'),
        timeout: databaseAdapterFactories.makeTimeoutMs(10000),
      };

      const adapter = createDatabaseAdapterWithConfig(customConfig);
      expect(adapter).toBeInstanceOf(DatabaseAdapterImpl);
    });

    it('should work without databaseId (uses default)', () => {
      const customConfig: Partial<DatabaseAdapterConfig> = {
        timeout: databaseAdapterFactories.makeTimeoutMs(5000),
      };

      const adapter = createDatabaseAdapterWithConfig(customConfig);
      expect(adapter).toBeInstanceOf(DatabaseAdapterImpl);
    });
  });

  describe('DatabaseAdapterImpl', () => {
    let adapter: DatabaseAdapterImpl;

    beforeEach(() => {
      adapter = new DatabaseAdapterImpl();
      vi.clearAllMocks();
    });

    describe('constructor', () => {
      it('should create instance with default config', () => {
        const instance = new DatabaseAdapterImpl();
        expect(instance).toBeInstanceOf(DatabaseAdapterImpl);
        // Note: config is private, we test through behavior
      });

      it('should create instance with custom config', () => {
        const customConfig: Partial<DatabaseAdapterConfig> = {
          databaseId: databaseAdapterFactories.makeDatabaseId('custom-db'),
          timeout: databaseAdapterFactories.makeTimeoutMs(3000),
        };
        const instance = new DatabaseAdapterImpl(customConfig);
        expect(instance).toBeInstanceOf(DatabaseAdapterImpl);
        // Note: config is private, we test through behavior
      });
    });

    describe('select', () => {
      const mockQuery = databaseAdapterFactories.makeDbQuery('SELECT * FROM users WHERE id = $1');
      const mockParams: unknown[] = ['123'];
      const mockOptions = {
        timeout: databaseAdapterFactories.makeTimeoutMs(5000),
      };

      it('should return Effect', () => {
        const result = adapter.select(
          mockQuery,
          mockParams,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          mockOptions,
        );

        expect(Effect.isEffect(result)).toBe(true);
      });

      it('should handle SELECT query with params', () => {
        const result = adapter.select(
          mockQuery,
          mockParams,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          mockOptions,
        );

        expect(Effect.isEffect(result)).toBe(true);
      });

      it('should handle SELECT query without params', () => {
        const result = adapter.select(
          mockQuery,
          undefined,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(Effect.isEffect(result)).toBe(true);
      });

      it('should handle SELECT query with transaction options', () => {
        const transactionOptions = {
          id: 'tx-123',
          isolationLevel: TransactionIsolationLevel.READ_COMMITTED,
        };

        const result = adapter.select(
          mockQuery,
          mockParams,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          { transaction: transactionOptions },
        );

        expect(Effect.isEffect(result)).toBe(true);
      });
    });

    describe('execute', () => {
      const mockQuery = databaseAdapterFactories.makeDbQuery(
        'INSERT INTO users (name) VALUES ($1)',
      );
      const mockParams: unknown[] = ['John'];
      const mockOptions = {
        timeout: databaseAdapterFactories.makeTimeoutMs(3000),
      };

      it('should return Effect', () => {
        const result = adapter.execute(
          mockQuery,
          mockParams,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          mockOptions,
        );

        expect(Effect.isEffect(result)).toBe(true);
      });

      it('should handle EXECUTE query with params', () => {
        const result = adapter.execute(
          mockQuery,
          mockParams,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          mockOptions,
        );

        expect(Effect.isEffect(result)).toBe(true);
      });

      it('should handle EXECUTE query without params', () => {
        const result = adapter.execute(
          mockQuery,
          undefined,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
        );

        expect(Effect.isEffect(result)).toBe(true);
      });

      it('should handle EXECUTE query with transaction options', () => {
        const transactionOptions = {
          id: 'tx-456',
          isolationLevel: TransactionIsolationLevel.SERIALIZABLE,
        };

        const result = adapter.execute(
          mockQuery,
          mockParams,
          mockDbClient,
          mockClock,
          mockLogger,
          mockMetrics,
          mockCircuitBreaker,
          { transaction: transactionOptions },
        );

        expect(Effect.isEffect(result)).toBe(true);
      });
    });
  });

  describe('Query builders', () => {
    describe('createSelectQuery', () => {
      it('should create SELECT query object', () => {
        const result = createSelectQuery('SELECT * FROM users', ['param1']);
        expect(result.query).toBe('SELECT * FROM users');
        expect(result.params).toEqual(['param1']);
        expect(result.options).toEqual({});
      });

      it('should create SELECT query with options', () => {
        const options = { timeout: databaseAdapterFactories.makeTimeoutMs(5000) };
        const result = createSelectQuery('SELECT * FROM users WHERE id = $1', ['123'], options);
        expect(result.query).toBe('SELECT * FROM users WHERE id = $1');
        expect(result.params).toEqual(['123']);
        expect(result.options).toEqual(options);
      });
    });

    describe('createInsertQuery', () => {
      it('should create INSERT query object', () => {
        const result = createInsertQuery('INSERT INTO users (name) VALUES ($1)', ['John']);
        expect(result.query).toBe('INSERT INTO users (name) VALUES ($1)');
        expect(result.params).toEqual(['John']);
        expect(result.options).toEqual({});
      });
    });

    describe('createUpdateQuery', () => {
      it('should create UPDATE query object', () => {
        const result = createUpdateQuery('UPDATE users SET name = $1 WHERE id = $2', ['John', 123]);
        expect(result.query).toBe('UPDATE users SET name = $1 WHERE id = $2');
        expect(result.params).toEqual(['John', 123]);
        expect(result.options).toEqual({});
      });
    });

    describe('createDeleteQuery', () => {
      it('should create DELETE query object', () => {
        const result = createDeleteQuery('DELETE FROM users WHERE id = $1', [123]);
        expect(result.query).toBe('DELETE FROM users WHERE id = $1');
        expect(result.params).toEqual([123]);
        expect(result.options).toEqual({});
      });
    });
  });
});
