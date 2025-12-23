/**
 * @file DatabaseAdapterFactories.test.ts - Тесты для DatabaseAdapterFactories
 *
 * Цель: проверка фабрик branded types: DatabaseId, DbQuery, timeouts, constraints.
 * Желаемое покрытие: 95%+
 */

import { describe, expect, it } from 'vitest';

import {
  databaseAdapterFactories,
  DatabaseAdapterValidationError,
} from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterFactories';

describe('DatabaseAdapterFactories', () => {
  describe('makeDatabaseId', () => {
    it('should create valid DatabaseId from valid database identifier strings', () => {
      const validIds = [
        'main-db',
        'users-db',
        'production-database',
        'test_db',
        'db-123',
        'my-database-instance',
      ];

      validIds.forEach((id) => {
        const result = databaseAdapterFactories.makeDatabaseId(id);
        expect(typeof result).toBe('string');
        expect(result).toBe(id);
      });
    });

    it('should throw DatabaseAdapterValidationError for empty or invalid database identifier strings', () => {
      expect(() => {
        databaseAdapterFactories.makeDatabaseId('');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeDatabaseId('   ');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeDatabaseId('  \t  ');
      }).toThrow(DatabaseAdapterValidationError);
    });

    it('should throw error with correct message for empty database id', () => {
      expect(() => {
        databaseAdapterFactories.makeDatabaseId('');
      }).toThrow('DatabaseId must be a non-empty string');
    });

    it('should ensure immutability of returned database id', () => {
      const id = databaseAdapterFactories.makeDatabaseId('test-database');
      expect(typeof id).toBe('string');
      expect(id).toBe('test-database');
    });
  });

  describe('makeDbQuery', () => {
    it('should create valid DbQuery from valid SQL query strings', () => {
      const validQueries = [
        'SELECT * FROM users',
        'INSERT INTO users (name, email) VALUES (?, ?)',
        'UPDATE users SET name = ? WHERE id = ?',
        'DELETE FROM users WHERE id = ?',
        'SELECT u.* FROM users u JOIN profiles p ON u.id = p.user_id',
      ];

      validQueries.forEach((query) => {
        const result = databaseAdapterFactories.makeDbQuery(query);
        expect(typeof result).toBe('string');
        expect(result).toBe(query);
      });
    });

    it('should throw DatabaseAdapterValidationError for empty or invalid query strings', () => {
      expect(() => {
        databaseAdapterFactories.makeDbQuery('');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeDbQuery('   ');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeDbQuery('  \t  ');
      }).toThrow(DatabaseAdapterValidationError);
    });

    it('should throw error with correct message for empty query', () => {
      expect(() => {
        databaseAdapterFactories.makeDbQuery('');
      }).toThrow('DbQuery must be a non-empty string');
    });

    it('should ensure immutability of returned query', () => {
      const query = databaseAdapterFactories.makeDbQuery('SELECT * FROM users');
      expect(typeof query).toBe('string');
      expect(query).toBe('SELECT * FROM users');
    });
  });

  describe('makeTimeoutMs', () => {
    it('should create valid DbTimeoutMs for valid timeout values', () => {
      const validTimeouts = [
        100,
        500,
        1000,
        5000,
        30000,
        60000, // Reasonable timeouts
        300000, // Maximum allowed (5 minutes)
      ];

      validTimeouts.forEach((timeout) => {
        const result = databaseAdapterFactories.makeTimeoutMs(timeout);
        expect(result).toBe(timeout);
      });
    });

    it('should throw DatabaseAdapterValidationError for invalid timeout values', () => {
      const invalidTimeouts = [
        -1,
        -100, // Negative
        50, // Below minimum (100)
        400000, // Above maximum (300000)
        null,
        undefined,
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidTimeouts.forEach((invalidTimeout) => {
        expect(() => {
          databaseAdapterFactories.makeTimeoutMs(invalidTimeout as any);
        }).toThrow(DatabaseAdapterValidationError);
      });
    });

    it('should throw error with correct message for out of range timeout', () => {
      expect(() => {
        databaseAdapterFactories.makeTimeoutMs(50);
      }).toThrow('TimeoutMs must be a finite number between 100 and 300000');
    });

    it('should handle boundary values', () => {
      expect(databaseAdapterFactories.makeTimeoutMs(100)).toBe(100);
      expect(databaseAdapterFactories.makeTimeoutMs(300000)).toBe(300000);
    });
  });

  describe('makeDurationMs', () => {
    it('should create valid DbDurationMs for valid duration values', () => {
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
        const result = databaseAdapterFactories.makeDurationMs(duration);
        expect(result).toBe(duration);
      });
    });

    it('should throw DatabaseAdapterValidationError for invalid duration values', () => {
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
          databaseAdapterFactories.makeDurationMs(invalidDuration as any);
        }).toThrow(DatabaseAdapterValidationError);
      });
    });

    it('should throw error with correct message for negative duration', () => {
      expect(() => {
        databaseAdapterFactories.makeDurationMs(-500);
      }).toThrow('DurationMs must be a non-negative finite number');
    });

    it('should handle zero duration', () => {
      const result = databaseAdapterFactories.makeDurationMs(0);
      expect(result).toBe(0);
    });

    it('should handle very large durations', () => {
      const result = databaseAdapterFactories.makeDurationMs(Number.MAX_SAFE_INTEGER);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('makeMaxRetries', () => {
    it('should create valid DbMaxRetries for valid retry counts', () => {
      const validRetries = [
        0,
        1,
        3,
        5,
        10, // Reasonable retry counts
      ];

      validRetries.forEach((retries) => {
        const result = databaseAdapterFactories.makeMaxRetries(retries);
        expect(result).toBe(retries);
      });
    });

    it('should throw DatabaseAdapterValidationError for invalid retry values', () => {
      const invalidRetries = [
        -1,
        -5, // Negative
        15, // Above maximum (10)
        null,
        undefined,
        NaN,
        Infinity,
        1.5, // Float
      ];

      invalidRetries.forEach((invalidRetry) => {
        expect(() => {
          databaseAdapterFactories.makeMaxRetries(invalidRetry as any);
        }).toThrow(DatabaseAdapterValidationError);
      });
    });

    it('should throw error with correct message for out of range retries', () => {
      expect(() => {
        databaseAdapterFactories.makeMaxRetries(15);
      }).toThrow('MaxRetries must be an integer between 0 and 10');
    });

    it('should allow zero retries', () => {
      const result = databaseAdapterFactories.makeMaxRetries(0);
      expect(result).toBe(0);
    });

    it('should handle boundary values', () => {
      expect(databaseAdapterFactories.makeMaxRetries(0)).toBe(0);
      expect(databaseAdapterFactories.makeMaxRetries(10)).toBe(10);
    });
  });

  describe('makeDbConnectionId', () => {
    it('should create valid DbConnectionId from valid connection identifier strings', () => {
      const validIds = [
        'conn-123',
        'pool-connection-1',
        'db-conn-main',
        'connection-abc',
        'c', // minimal valid id
      ];

      validIds.forEach((id) => {
        const result = databaseAdapterFactories.makeDbConnectionId(id);
        expect(typeof result).toBe('string');
        expect(result).toBe(id);
      });
    });

    it('should throw DatabaseAdapterValidationError for empty or invalid connection identifier strings', () => {
      expect(() => {
        databaseAdapterFactories.makeDbConnectionId('');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeDbConnectionId('   ');
      }).toThrow(DatabaseAdapterValidationError);
    });

    it('should throw error with correct message for empty connection id', () => {
      expect(() => {
        databaseAdapterFactories.makeDbConnectionId('');
      }).toThrow('DbConnectionId must be a non-empty string');
    });

    it('should ensure immutability of returned connection id', () => {
      const id = databaseAdapterFactories.makeDbConnectionId('test-connection');
      expect(typeof id).toBe('string');
      expect(id).toBe('test-connection');
    });
  });

  describe('makeTxId', () => {
    it('should create valid TxId from valid transaction identifier strings', () => {
      const validIds = [
        'tx-123',
        'transaction-456',
        'txn-abc-789',
        'tx-001',
        't', // minimal valid id
      ];

      validIds.forEach((id) => {
        const result = databaseAdapterFactories.makeTxId(id);
        expect(typeof result).toBe('string');
        expect(result).toBe(id);
      });
    });

    it('should throw DatabaseAdapterValidationError for empty or invalid transaction identifier strings', () => {
      expect(() => {
        databaseAdapterFactories.makeTxId('');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeTxId('   ');
      }).toThrow(DatabaseAdapterValidationError);
    });

    it('should throw error with correct message for empty transaction id', () => {
      expect(() => {
        databaseAdapterFactories.makeTxId('');
      }).toThrow('TxId must be a non-empty string');
    });

    it('should ensure immutability of returned transaction id', () => {
      const id = databaseAdapterFactories.makeTxId('test-transaction');
      expect(typeof id).toBe('string');
      expect(id).toBe('test-transaction');
    });
  });

  describe('makeDbCircuitBreakerKey', () => {
    it('should create valid DbCircuitBreakerKey for valid keys', () => {
      const validKeys = [
        'main-db:SELECT',
        'users-db:INSERT',
        'prod-db:health',
        'a', // minimal valid key
        'database-instance:complex-operation',
      ];

      validKeys.forEach((key) => {
        const result = databaseAdapterFactories.makeDbCircuitBreakerKey(key);
        expect(result).toBe(key);
        expect(typeof result).toBe('string');
      });
    });

    it('should throw DatabaseAdapterValidationError for invalid keys', () => {
      const invalidKeys: any[] = [
        '',
        '   ',
        '  \t  ',
        null,
        undefined,
      ];

      invalidKeys.forEach((invalidKey) => {
        expect(() => {
          databaseAdapterFactories.makeDbCircuitBreakerKey(invalidKey);
        }).toThrow(DatabaseAdapterValidationError);
      });
    });

    it('should throw error with correct message for empty key', () => {
      expect(() => {
        databaseAdapterFactories.makeDbCircuitBreakerKey('');
      }).toThrow('DbCircuitBreakerKey must be a non-empty string');
    });

    it('should ensure immutability of returned key', () => {
      const key = databaseAdapterFactories.makeDbCircuitBreakerKey('test-db:SELECT');
      expect(key).toBe('test-db:SELECT');
      expect(typeof key).toBe('string');
    });
  });

  describe('makeCircuitBreakerThreshold', () => {
    it('should create valid DbCircuitBreakerThreshold for valid threshold values', () => {
      const validThresholds = [
        1,
        3,
        5,
        10,
        50,
        100, // Reasonable thresholds
      ];

      validThresholds.forEach((threshold) => {
        const result = databaseAdapterFactories.makeCircuitBreakerThreshold(threshold);
        expect(result).toBe(threshold);
      });
    });

    it('should throw DatabaseAdapterValidationError for invalid threshold values', () => {
      const invalidThresholds = [
        -1,
        0, // Non-positive
        150, // Above maximum (100)
        null,
        undefined,
        NaN,
        Infinity,
        1.5, // Float
      ];

      invalidThresholds.forEach((invalidThreshold) => {
        expect(() => {
          databaseAdapterFactories.makeCircuitBreakerThreshold(invalidThreshold as any);
        }).toThrow(DatabaseAdapterValidationError);
      });
    });

    it('should throw error with correct message for out of range threshold', () => {
      expect(() => {
        databaseAdapterFactories.makeCircuitBreakerThreshold(150);
      }).toThrow('CircuitBreakerThreshold must be an integer between 1 and 100');
    });

    it('should not allow zero threshold', () => {
      expect(() => {
        databaseAdapterFactories.makeCircuitBreakerThreshold(0);
      }).toThrow(DatabaseAdapterValidationError);
    });

    it('should allow minimum threshold of 1', () => {
      const result = databaseAdapterFactories.makeCircuitBreakerThreshold(1);
      expect(result).toBe(1);
    });

    it('should handle boundary values', () => {
      expect(databaseAdapterFactories.makeCircuitBreakerThreshold(1)).toBe(1);
      expect(databaseAdapterFactories.makeCircuitBreakerThreshold(100)).toBe(100);
    });
  });

  describe('makeConstraintName', () => {
    it('should create valid ConstraintName from valid constraint name strings', () => {
      const validNames = [
        'users_email_unique',
        'fk_orders_user_id',
        'check_price_positive',
        'pk_users_id',
        'c', // minimal valid name
      ];

      validNames.forEach((name) => {
        const result = databaseAdapterFactories.makeConstraintName(name);
        expect(typeof result).toBe('string');
        expect(result).toBe(name);
      });
    });

    it('should throw DatabaseAdapterValidationError for empty or invalid constraint name strings', () => {
      expect(() => {
        databaseAdapterFactories.makeConstraintName('');
      }).toThrow(DatabaseAdapterValidationError);

      expect(() => {
        databaseAdapterFactories.makeConstraintName('   ');
      }).toThrow(DatabaseAdapterValidationError);
    });

    it('should throw error with correct message for empty constraint name', () => {
      expect(() => {
        databaseAdapterFactories.makeConstraintName('');
      }).toThrow('ConstraintName must be a non-empty string');
    });

    it('should ensure immutability of returned constraint name', () => {
      const name = databaseAdapterFactories.makeConstraintName('test_constraint');
      expect(typeof name).toBe('string');
      expect(name).toBe('test_constraint');
    });
  });

  describe('DatabaseAdapterValidationError', () => {
    it('should be properly exported', () => {
      expect(DatabaseAdapterValidationError).toBeDefined();
      expect(typeof DatabaseAdapterValidationError).toBe('function');
    });

    it('should create error with message and context', () => {
      const error = new DatabaseAdapterValidationError(
        'Test message',
        'testFactory',
        'invalidValue',
      );
      expect(error.message).toBe('[testFactory] Test message');
      expect(error.name).toBe('DatabaseAdapterValidationError');
    });

    it('should have correct factory and value properties', () => {
      const error = new DatabaseAdapterValidationError(
        'Test message',
        'testFactory',
        'invalidValue',
      );
      expect(error.factory).toBe('testFactory');
      expect(error.value).toBe('invalidValue');
    });
  });

  describe('edge cases and complex scenarios', () => {
    it('should handle very long database identifiers', () => {
      const longId = `database_${'a'.repeat(100)}`;
      const result = databaseAdapterFactories.makeDatabaseId(longId);
      expect(result.length).toBeGreaterThan(100);
    });

    it('should handle complex SQL queries with special characters', () => {
      const complexQuery = `SELECT u.id, u.name, COUNT(o.id) as "order_count"
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.created_at > $1 AND u.status IN ('active', 'pending')
        GROUP BY u.id, u.name
        HAVING COUNT(o.id) > 0
        ORDER BY "order_count" DESC
        LIMIT $2`;

      const result = databaseAdapterFactories.makeDbQuery(complexQuery);
      expect(result).toContain('SELECT');
      expect(result).toContain('GROUP BY');
      expect(result).toContain('"order_count"');
      expect(result.length).toBeGreaterThan(200);
    });

    it('should handle constraint names with underscores and numbers', () => {
      const constraintName = 'check_price_gt_0_and_lt_10000';
      const result = databaseAdapterFactories.makeConstraintName(constraintName);
      expect(result).toBe(constraintName);
    });

    it('should handle circuit breaker keys with special characters', () => {
      const key = 'prod-db:complex-query-with-params';
      const result = databaseAdapterFactories.makeDbCircuitBreakerKey(key);
      expect(result).toBe(key);
    });

    it('should handle minimum valid values for all factories', () => {
      expect(databaseAdapterFactories.makeTimeoutMs(100)).toBe(100);
      expect(databaseAdapterFactories.makeDurationMs(0)).toBe(0);
      expect(databaseAdapterFactories.makeMaxRetries(0)).toBe(0);
      expect(databaseAdapterFactories.makeCircuitBreakerThreshold(1)).toBe(1);
      expect(databaseAdapterFactories.makeDatabaseId('a')).toBe('a');
      expect(databaseAdapterFactories.makeDbQuery('SELECT 1')).toBe('SELECT 1');
      expect(databaseAdapterFactories.makeDbConnectionId('a')).toBe('a');
      expect(databaseAdapterFactories.makeTxId('a')).toBe('a');
      expect(databaseAdapterFactories.makeDbCircuitBreakerKey('a')).toBe('a');
      expect(databaseAdapterFactories.makeConstraintName('a')).toBe('a');
    });

    it('should handle maximum valid values for numeric factories', () => {
      expect(databaseAdapterFactories.makeTimeoutMs(300000)).toBe(300000);
      expect(databaseAdapterFactories.makeMaxRetries(10)).toBe(10);
      expect(databaseAdapterFactories.makeCircuitBreakerThreshold(100)).toBe(100);
    });
  });
});
