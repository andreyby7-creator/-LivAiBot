/**
 * @file DatabaseAdapterTypes.test.ts - Тесты для DatabaseAdapterTypes
 *
 * Цель: типы и branded types; edge cases, optional поля.
 * Желаемое покрытие: 95%+
 */

import { describe, expect, it } from 'vitest';

import { databaseAdapterFactories } from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterFactories';
import {
  TransactionIsolationLevel,
} from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterTypes';

describe('DatabaseAdapterTypes', () => {
  describe('TransactionIsolationLevel', () => {
    it('should have all standard transaction isolation levels', () => {
      const expectedLevels = [
        'READ_UNCOMMITTED',
        'READ_COMMITTED',
        'REPEATABLE_READ',
        'SERIALIZABLE',
      ];

      expectedLevels.forEach((level) => {
        expect(TransactionIsolationLevel).toHaveProperty(level);
        expect(TransactionIsolationLevel[level as keyof typeof TransactionIsolationLevel]).toBe(
          level,
        );
      });
    });

    it('should have consistent values', () => {
      expect(TransactionIsolationLevel.READ_UNCOMMITTED).toBe('READ_UNCOMMITTED');
      expect(TransactionIsolationLevel.READ_COMMITTED).toBe('READ_COMMITTED');
      expect(TransactionIsolationLevel.REPEATABLE_READ).toBe('REPEATABLE_READ');
      expect(TransactionIsolationLevel.SERIALIZABLE).toBe('SERIALIZABLE');
    });
  });

  describe('DbQueryResult', () => {
    it('should create valid DbQueryResult with all required fields', () => {
      const result = {
        rows: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
        rowCount: 2,
        durationMs: databaseAdapterFactories.makeDurationMs(150),
      };

      expect(result.rows).toEqual([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]);
      expect(result.rowCount).toBe(2);
      expect(result.durationMs).toBe(150);
    });

    it('should handle empty result set', () => {
      const result = {
        rows: [],
        rowCount: 0,
        durationMs: databaseAdapterFactories.makeDurationMs(50),
      };

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(result.durationMs).toBe(50);
    });

    it('should handle different row types', () => {
      const testCases = [
        { type: 'object', rows: [{ id: 1, data: 'value' }] },
        { type: 'array in row', rows: [{ items: [1, 2, 3] }] },
        { type: 'null values', rows: [{ id: null, name: 'test' }] },
        { type: 'nested objects', rows: [{ user: { id: 1, profile: { age: 25 } } }] },
      ];

      testCases.forEach(({ type, rows }) => {
        const result = {
          rows,
          rowCount: rows.length,
          durationMs: databaseAdapterFactories.makeDurationMs(100),
        };

        expect(result.rows).toEqual(rows);
        expect(result.rowCount).toBe(rows.length);
      });
    });

    it('should handle large result sets', () => {
      const largeRows = Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `row${i}` }));

      const result = {
        rows: largeRows,
        rowCount: 1000,
        durationMs: databaseAdapterFactories.makeDurationMs(500),
      };

      expect(result.rows).toHaveLength(1000);
      expect(result.rowCount).toBe(1000);
      expect(result.rows[0]).toEqual({ id: 0, data: 'row0' });
      expect(result.rows[999]).toEqual({ id: 999, data: 'row999' });
    });
  });

  describe('DbExecuteResult', () => {
    it('should create valid DbExecuteResult with all required fields', () => {
      const result = {
        affectedRows: 5,
        durationMs: databaseAdapterFactories.makeDurationMs(200),
      };

      expect(result.affectedRows).toBe(5);
      expect(result.durationMs).toBe(200);
    });

    it('should handle zero affected rows', () => {
      const result = {
        affectedRows: 0,
        durationMs: databaseAdapterFactories.makeDurationMs(75),
      };

      expect(result.affectedRows).toBe(0);
      expect(result.durationMs).toBe(75);
    });

    it('should handle large number of affected rows', () => {
      const result = {
        affectedRows: 10000,
        durationMs: databaseAdapterFactories.makeDurationMs(1500),
      };

      expect(result.affectedRows).toBe(10000);
      expect(result.durationMs).toBe(1500);
    });
  });

  describe('DbTransactionContext', () => {
    it('should create valid DbTransactionContext with all required fields', () => {
      const context = {
        txId: databaseAdapterFactories.makeTxId('tx-123'),
        isolationLevel: TransactionIsolationLevel.READ_COMMITTED,
      };

      expect(context.txId).toBe('tx-123');
      expect(context.isolationLevel).toBe(TransactionIsolationLevel.READ_COMMITTED);
    });

    it('should handle different isolation levels', () => {
      const levels = [
        TransactionIsolationLevel.READ_UNCOMMITTED,
        TransactionIsolationLevel.READ_COMMITTED,
        TransactionIsolationLevel.REPEATABLE_READ,
        TransactionIsolationLevel.SERIALIZABLE,
      ];

      levels.forEach((level) => {
        const context = {
          txId: databaseAdapterFactories.makeTxId(`tx-${level}`),
          isolationLevel: level,
        };

        expect(context.isolationLevel).toBe(level);
      });
    });
  });

  describe('DbError union types', () => {
    describe('DbConnectionError', () => {
      it('should create valid DbConnectionError', () => {
        const error = {
          _tag: 'DbConnectionError' as const,
          message: 'Connection timeout',
          code: 'CONNECTION_TIMEOUT',
        };

        expect(error._tag).toBe('DbConnectionError');
        expect(error.message).toBe('Connection timeout');
        expect(error.code).toBe('CONNECTION_TIMEOUT');
      });

      it('should create DbConnectionError without code', () => {
        const error = {
          _tag: 'DbConnectionError' as const,
          message: 'Connection failed',
        };

        expect(error._tag).toBe('DbConnectionError');
        expect(error.message).toBe('Connection failed');
        expect('code' in error ? error.code : undefined).toBeUndefined();
      });
    });

    describe('DbTimeoutError', () => {
      it('should create valid DbTimeoutError', () => {
        const error = {
          _tag: 'DbTimeoutError' as const,
          timeoutMs: databaseAdapterFactories.makeTimeoutMs(5000),
        };

        expect(error._tag).toBe('DbTimeoutError');
        expect(error.timeoutMs).toBe(5000);
      });
    });

    describe('DbConstraintViolation', () => {
      it('should create valid DbConstraintViolation', () => {
        const error = {
          _tag: 'DbConstraintViolation' as const,
          constraint: databaseAdapterFactories.makeConstraintName('users_email_unique'),
        };

        expect(error._tag).toBe('DbConstraintViolation');
        expect(error.constraint).toBe('users_email_unique');
      });
    });

    describe('DbDeadlockError', () => {
      it('should create valid DbDeadlockError', () => {
        const error = {
          _tag: 'DbDeadlockError' as const,
        };

        expect(error._tag).toBe('DbDeadlockError');
      });
    });

    describe('DbUnknownError', () => {
      it('should create valid DbUnknownError', () => {
        const originalError = new Error('Unknown database error');
        const error = {
          _tag: 'DbUnknownError' as const,
          original: originalError,
        };

        expect(error._tag).toBe('DbUnknownError');
        expect(error.original).toBe(originalError);
      });

      it('should handle different original error types', () => {
        const testCases = [
          { type: 'Error', original: new Error('test') },
          { type: 'string', original: 'string error' },
          { type: 'object', original: { message: 'object error' } },
          { type: 'null', original: null },
          { type: 'undefined', original: undefined },
        ];

        testCases.forEach(({ type, original }) => {
          const error = {
            _tag: 'DbUnknownError' as const,
            original,
          };

          expect(error.original).toBe(original);
        });
      });
    });
  });

  describe('DbStrategyDecision union types', () => {
    describe('success decision', () => {
      it('should create valid success decision', () => {
        const decision = {
          type: 'success' as const,
        };

        expect(decision.type).toBe('success');
      });
    });

    describe('retry decision', () => {
      it('should create valid retry decision with delay', () => {
        const decision = {
          type: 'retry' as const,
          retryAfterMs: databaseAdapterFactories.makeTimeoutMs(1000),
        };

        expect(decision.type).toBe('retry');
        expect(decision.retryAfterMs).toBe(1000);
      });

      it('should create valid retry decision without delay', () => {
        const decision = {
          type: 'retry' as const,
        };

        expect(decision.type).toBe('retry');
        expect('retryAfterMs' in decision ? decision.retryAfterMs : undefined).toBeUndefined();
      });
    });

    describe('fail decision', () => {
      it('should create valid fail decision with circuit breaker', () => {
        const decision = {
          type: 'fail' as const,
          errorCode: 'DATABASE_CONNECTION_ERROR' as const,
          openCircuit: true,
        };

        expect(decision.type).toBe('fail');
        expect(decision.errorCode).toBe('DATABASE_CONNECTION_ERROR');
        expect(decision.openCircuit).toBe(true);
      });

      it('should create valid fail decision without circuit breaker', () => {
        const decision = {
          type: 'fail' as const,
          errorCode: 'DATABASE_TIMEOUT_ERROR' as const,
          openCircuit: false,
        };

        expect(decision.type).toBe('fail');
        expect(decision.errorCode).toBe('DATABASE_TIMEOUT_ERROR');
        expect(decision.openCircuit).toBe(false);
      });

      it('should create valid fail decision without openCircuit flag', () => {
        const decision = {
          type: 'fail' as const,
          errorCode: 'DATABASE_CONSTRAINT_VIOLATION' as const,
        };

        expect(decision.type).toBe('fail');
        expect(decision.errorCode).toBe('DATABASE_CONSTRAINT_VIOLATION');
        expect('openCircuit' in decision ? decision.openCircuit : undefined).toBeUndefined();
      });
    });
  });

  describe('DatabaseAdapterContext', () => {
    it('should create valid DatabaseAdapterContext with required fields', () => {
      const context = {
        databaseId: databaseAdapterFactories.makeDatabaseId('main-db'),
      };

      expect(context.databaseId).toBe('main-db');
    });

    it('should create DatabaseAdapterContext with optional timeout', () => {
      const context = {
        databaseId: databaseAdapterFactories.makeDatabaseId('test-db'),
        defaultTimeoutMs: databaseAdapterFactories.makeTimeoutMs(10000),
      };

      expect(context.databaseId).toBe('test-db');
      expect(context.defaultTimeoutMs).toBe(10000);
    });

    it('should create DatabaseAdapterContext with optional maxRetries', () => {
      const context = {
        databaseId: databaseAdapterFactories.makeDatabaseId('prod-db'),
        maxRetries: databaseAdapterFactories.makeMaxRetries(5),
      };

      expect(context.databaseId).toBe('prod-db');
      expect(context.maxRetries).toBe(5);
    });

    it('should create DatabaseAdapterContext with all optional fields', () => {
      const context = {
        databaseId: databaseAdapterFactories.makeDatabaseId('full-db'),
        defaultTimeoutMs: databaseAdapterFactories.makeTimeoutMs(15000),
        maxRetries: databaseAdapterFactories.makeMaxRetries(3),
      };

      expect(context.databaseId).toBe('full-db');
      expect(context.defaultTimeoutMs).toBe(15000);
      expect(context.maxRetries).toBe(3);
    });
  });

  describe('branded types behavior', () => {
    describe('DatabaseId', () => {
      it('should maintain string behavior', () => {
        const id = databaseAdapterFactories.makeDatabaseId('test-database');
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        expect(id).toBe('test-database');
      });

      it('should be assignable to string', () => {
        const id: string = databaseAdapterFactories.makeDatabaseId('assignable-db');
        expect(typeof id).toBe('string');
      });
    });

    describe('DbQuery', () => {
      it('should maintain string behavior', () => {
        const query = databaseAdapterFactories.makeDbQuery('SELECT * FROM users');
        expect(typeof query).toBe('string');
        expect(query.length).toBeGreaterThan(0);
        expect(query).toBe('SELECT * FROM users');
      });

      it('should be assignable to string', () => {
        const query: string = databaseAdapterFactories.makeDbQuery('SELECT 1');
        expect(typeof query).toBe('string');
      });
    });

    describe('DbTimeoutMs', () => {
      it('should maintain number behavior', () => {
        const timeout = databaseAdapterFactories.makeTimeoutMs(5000);
        expect(typeof timeout).toBe('number');
        expect(timeout).toBeGreaterThanOrEqual(100);
        expect(timeout).toBeLessThanOrEqual(300000);
      });

      it('should be assignable to number', () => {
        const timeout: number = databaseAdapterFactories.makeTimeoutMs(30000);
        expect(typeof timeout).toBe('number');
      });
    });

    describe('DbDurationMs', () => {
      it('should maintain number behavior', () => {
        const duration = databaseAdapterFactories.makeDurationMs(2500);
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
      });

      it('should be assignable to number', () => {
        const duration: number = databaseAdapterFactories.makeDurationMs(1000);
        expect(typeof duration).toBe('number');
      });
    });

    describe('DbMaxRetries', () => {
      it('should maintain number behavior', () => {
        const maxRetries = databaseAdapterFactories.makeMaxRetries(3);
        expect(typeof maxRetries).toBe('number');
        expect(maxRetries).toBeGreaterThanOrEqual(0);
        expect(maxRetries).toBeLessThanOrEqual(10);
      });

      it('should be assignable to number', () => {
        const maxRetries: number = databaseAdapterFactories.makeMaxRetries(5);
        expect(typeof maxRetries).toBe('number');
      });
    });

    describe('DbConnectionId', () => {
      it('should maintain string behavior', () => {
        const connectionId = databaseAdapterFactories.makeDbConnectionId('conn-123');
        expect(typeof connectionId).toBe('string');
        expect(connectionId.length).toBeGreaterThan(0);
      });

      it('should be assignable to string', () => {
        const connectionId: string = databaseAdapterFactories.makeDbConnectionId('conn-assignable');
        expect(typeof connectionId).toBe('string');
      });
    });

    describe('TxId', () => {
      it('should maintain string behavior', () => {
        const txId = databaseAdapterFactories.makeTxId('tx-456');
        expect(typeof txId).toBe('string');
        expect(txId.length).toBeGreaterThan(0);
      });

      it('should be assignable to string', () => {
        const txId: string = databaseAdapterFactories.makeTxId('tx-assignable');
        expect(typeof txId).toBe('string');
      });
    });

    describe('DbCircuitBreakerKey', () => {
      it('should maintain string behavior', () => {
        const key = databaseAdapterFactories.makeDbCircuitBreakerKey('db-main:SELECT');
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });

      it('should be assignable to string', () => {
        const key: string = databaseAdapterFactories.makeDbCircuitBreakerKey('db-test:INSERT');
        expect(typeof key).toBe('string');
      });
    });

    describe('DbCircuitBreakerThreshold', () => {
      it('should maintain number behavior', () => {
        const threshold = databaseAdapterFactories.makeCircuitBreakerThreshold(5);
        expect(typeof threshold).toBe('number');
        expect(threshold).toBeGreaterThanOrEqual(1);
        expect(threshold).toBeLessThanOrEqual(100);
      });

      it('should be assignable to number', () => {
        const threshold: number = databaseAdapterFactories.makeCircuitBreakerThreshold(10);
        expect(typeof threshold).toBe('number');
      });
    });

    describe('ConstraintName', () => {
      it('should maintain string behavior', () => {
        const name = databaseAdapterFactories.makeConstraintName('users_email_unique');
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });

      it('should be assignable to string', () => {
        const name: string = databaseAdapterFactories.makeConstraintName('fk_orders_user_id');
        expect(typeof name).toBe('string');
      });
    });
  });

  describe('optional fields handling', () => {
    it('should handle DatabaseAdapterContext without optional fields', () => {
      const context = {
        databaseId: databaseAdapterFactories.makeDatabaseId('minimal-db'),
        // optional fields omitted
      };

      expect(context.databaseId).toBeDefined();
      expect(context).not.toHaveProperty('defaultTimeoutMs');
      expect(context).not.toHaveProperty('maxRetries');
    });

    it('should handle DbStrategyDecision retry without retryAfterMs', () => {
      const decision = {
        type: 'retry' as const,
        // retryAfterMs is optional
      };

      expect(decision.type).toBe('retry');
      expect('retryAfterMs' in decision ? decision.retryAfterMs : undefined).toBeUndefined();
    });

    it('should handle DbError DbConnectionError without code', () => {
      const error = {
        _tag: 'DbConnectionError' as const,
        message: 'Connection lost',
        // code is optional
      };

      expect(error._tag).toBe('DbConnectionError');
      expect('code' in error ? error.code : undefined).toBeUndefined();
    });

    it('should handle DbStrategyDecision fail without openCircuit', () => {
      const decision = {
        type: 'fail' as const,
        errorCode: 'DATABASE_ERROR' as const,
        // openCircuit is optional
      };

      expect(decision.type).toBe('fail');
      expect('openCircuit' in decision ? decision.openCircuit : undefined).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very long database identifiers', () => {
      const longId = `database_${'a'.repeat(100)}`;
      const context = {
        databaseId: databaseAdapterFactories.makeDatabaseId(longId),
      };

      expect(context.databaseId.length).toBeGreaterThan(100);
    });

    it('should handle complex SQL queries', () => {
      const complexQuery = `
        SELECT u.id, u.name, COUNT(o.id) as order_count
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.created_at > $1 AND u.status = $2
        GROUP BY u.id, u.name
        HAVING COUNT(o.id) > 0
        ORDER BY order_count DESC
        LIMIT $3
      `.trim();

      const query = databaseAdapterFactories.makeDbQuery(complexQuery);
      expect(query).toContain('SELECT');
      expect(query).toContain('GROUP BY');
      expect(query.length).toBeGreaterThan(100);
    });

    it('should handle very large row counts', () => {
      const result = {
        rows: [{ count: 1 }],
        rowCount: 1000000,
        durationMs: databaseAdapterFactories.makeDurationMs(1000),
      };

      expect(result.rowCount).toBe(1000000);
    });

    it('should handle very large affected rows', () => {
      const result = {
        affectedRows: 5000000,
        durationMs: databaseAdapterFactories.makeDurationMs(2000),
      };

      expect(result.affectedRows).toBe(5000000);
    });

    it('should handle constraint names with special characters', () => {
      const constraintName = databaseAdapterFactories.makeConstraintName('check_price_positive');
      expect(constraintName).toBe('check_price_positive');
    });

    it('should handle database errors with very long messages', () => {
      const longMessage = 'Database error: '.repeat(50);
      const error = {
        _tag: 'DbConnectionError' as const,
        message: longMessage,
      };

      expect(error.message.length).toBeGreaterThan(700);
    });

    it('should handle zero duration operations', () => {
      const result = {
        rows: [],
        rowCount: 0,
        durationMs: databaseAdapterFactories.makeDurationMs(0),
      };

      expect(result.durationMs).toBe(0);
    });
  });

  describe('factory validation error cases', () => {
    describe('makeDatabaseId validation errors', () => {
      it('should throw error for empty string', () => {
        expect(() => {
          databaseAdapterFactories.makeDatabaseId('');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for whitespace only string', () => {
        expect(() => {
          databaseAdapterFactories.makeDatabaseId('   ');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for non-string value', () => {
        expect(() => {
          databaseAdapterFactories.makeDatabaseId(123 as any);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeDbQuery validation errors', () => {
      it('should throw error for empty query', () => {
        expect(() => {
          databaseAdapterFactories.makeDbQuery('');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for whitespace only query', () => {
        expect(() => {
          databaseAdapterFactories.makeDbQuery('   ');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeTimeoutMs validation errors', () => {
      it('should throw error for timeout below minimum', () => {
        expect(() => {
          databaseAdapterFactories.makeTimeoutMs(50);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for timeout above maximum', () => {
        expect(() => {
          databaseAdapterFactories.makeTimeoutMs(400000);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for non-finite number', () => {
        expect(() => {
          databaseAdapterFactories.makeTimeoutMs(Infinity);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for negative timeout', () => {
        expect(() => {
          databaseAdapterFactories.makeTimeoutMs(-100);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeMaxRetries validation errors', () => {
      it('should throw error for negative retries', () => {
        expect(() => {
          databaseAdapterFactories.makeMaxRetries(-1);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for retries above maximum', () => {
        expect(() => {
          databaseAdapterFactories.makeMaxRetries(15);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for non-integer retries', () => {
        expect(() => {
          databaseAdapterFactories.makeMaxRetries(2.5);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeDbConnectionId validation errors', () => {
      it('should throw error for empty connection id', () => {
        expect(() => {
          databaseAdapterFactories.makeDbConnectionId('');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeTxId validation errors', () => {
      it('should throw error for empty transaction id', () => {
        expect(() => {
          databaseAdapterFactories.makeTxId('');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeDbCircuitBreakerKey validation errors', () => {
      it('should throw error for empty circuit breaker key', () => {
        expect(() => {
          databaseAdapterFactories.makeDbCircuitBreakerKey('');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for whitespace only key', () => {
        expect(() => {
          databaseAdapterFactories.makeDbCircuitBreakerKey('   ');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeCircuitBreakerThreshold validation errors', () => {
      it('should throw error for threshold below minimum', () => {
        expect(() => {
          databaseAdapterFactories.makeCircuitBreakerThreshold(0);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for threshold above maximum', () => {
        expect(() => {
          databaseAdapterFactories.makeCircuitBreakerThreshold(150);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for non-integer threshold', () => {
        expect(() => {
          databaseAdapterFactories.makeCircuitBreakerThreshold(5.5);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeDurationMs validation errors', () => {
      it('should throw error for negative duration', () => {
        expect(() => {
          databaseAdapterFactories.makeDurationMs(-100);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });

      it('should throw error for non-finite duration', () => {
        expect(() => {
          databaseAdapterFactories.makeDurationMs(Infinity);
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });

    describe('makeConstraintName validation errors', () => {
      it('should throw error for empty constraint name', () => {
        expect(() => {
          databaseAdapterFactories.makeConstraintName('');
        }).toThrow(databaseAdapterFactories.ValidationError);
      });
    });
  });
});
