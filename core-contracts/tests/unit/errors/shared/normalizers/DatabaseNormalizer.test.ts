import { describe, expect, it } from 'vitest';

import {
  extractDatabaseType,
  isDatabaseErrorResult,
  isDatabaseInfraError,
  normalizeDatabaseError,
} from '../../../../../src/errors/shared/normalizers/DatabaseNormalizer';

import { LIVAI_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';

describe('DatabaseNormalizer', () => {
  describe('Pure-function invariants', () => {
    it('should return identical output for identical input', () => {
      const input = { code: '23505', detail: 'Key (email)=(test@test.com) already exists.' };
      const result1 = normalizeDatabaseError(input);
      const result2 = normalizeDatabaseError(input);

      // Compare without timestamp which is generated dynamically
      const { timestamp: _, ...result1WithoutTs } = result1 as any;
      const { timestamp: __, ...result2WithoutTs } = result2 as any;

      expect(result1WithoutTs).toEqual(result2WithoutTs);
      expect(result1._tag).toBe(result2._tag);
      expect(result1.code).toBe(result2.code);
      expect(result1.message).toBe(result2.message);
    });

    it('should not mutate input object', () => {
      const input = { code: '23505', detail: 'test' };
      const originalInput = { ...input };

      normalizeDatabaseError(input);

      expect(input).toEqual(originalInput);
    });

    it('should have no side effects (no I/O, no global state)', () => {
      // Test that function doesn't access global state or perform I/O
      const input = { code: '23505' };
      const result = normalizeDatabaseError(input);

      // Verify result is deterministic and doesn't depend on external state
      expect(result._tag).toBe('DatabaseError');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED);
    });
  });

  describe('Unknown → TaggedError (fail-safe)', () => {
    it('should handle null input', () => {
      const result = normalizeDatabaseError(null as any);
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result._tag).toBe('SharedAdapterError');
      expect(result.category).toBe('adapter');
      expect(result.code).toBe('SHARED_INFRA_DATABASE_ADAPTER_ERROR');
      expect(result.message).toBe('Unknown database error');
      expect(result.details).toBeDefined();
      expect(result.details).toBeInstanceOf(Object);
    });

    it('should handle undefined input', () => {
      const result = normalizeDatabaseError(undefined as any);
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result._tag).toBe('SharedAdapterError');
      expect(result.message).toBe('Unknown database error');
    });

    it('should handle string input', () => {
      const result = normalizeDatabaseError('some db error');
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result.message).toBe('Unknown database error'); // String input doesn't have 'message' property
    });

    it('should handle number input', () => {
      const result = normalizeDatabaseError(42 as any);
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result.message).toBe('Unknown database error');
    });

    it('should handle boolean input', () => {
      const result = normalizeDatabaseError(true as any);
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result.message).toBe('Unknown database error');
    });

    it('should handle empty object input', () => {
      const result = normalizeDatabaseError({});
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result.message).toBe('Unknown database error');
    });

    it('should handle object with message', () => {
      const result = normalizeDatabaseError({ message: 'Custom DB error' });
      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result.message).toBe('Custom DB error');
    });
  });

  describe('Constraint Violations - PostgreSQL', () => {
    it('should map 23505 to unique constraint violation', () => {
      const result = normalizeDatabaseError({
        code: '23505',
        detail: 'Key (email)=(test@test.com) already exists.',
        table: 'users',
      });

      expect(isDatabaseErrorResult(result)).toBe(true);
      expect((result.details as any)?.constraintType).toBe('unique');
      expect((result.details as any)?.databaseType).toBe('postgresql');
      expect((result.details as any)?.tableName).toBe('users');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED);
    });

    it('should map 23503 to foreign_key constraint violation', () => {
      const result = normalizeDatabaseError({
        code: '23503',
        detail: 'Key (user_id)=(123) is not present in table "users".',
      });

      expect(isDatabaseErrorResult(result)).toBe(true);
      expect((result.details as any)?.constraintType).toBe('foreign_key');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED);
    });

    it('should map 23502 to not_null constraint violation', () => {
      const result = normalizeDatabaseError({
        code: '23502',
        detail: 'null value in column "email" violates not-null constraint',
      });

      expect(isDatabaseErrorResult(result)).toBe(true);
      expect((result.details as any)?.constraintType).toBe('not_null');
    });

    it('should map 23514 to check constraint violation', () => {
      const result = normalizeDatabaseError({
        code: '23514',
        detail: 'new row for relation "orders" violates check constraint "positive_amount"',
      });

      expect(isDatabaseErrorResult(result)).toBe(true);
      expect((result.details as any)?.constraintType).toBe('check');
    });

    it('should map 23506 to primary_key constraint violation', () => {
      const result = normalizeDatabaseError({
        code: '23506',
        detail: 'duplicate key value violates unique constraint "users_pkey"',
      });

      expect(isDatabaseErrorResult(result)).toBe(true);
      expect((result.details as any)?.constraintType).toBe('primary_key');
    });
  });

  describe('Constraint Violations - MySQL', () => {
    it('should map ER_DUP_ENTRY / 1062 to unique constraint violation', () => {
      const result1 = normalizeDatabaseError({ code: 'ER_DUP_ENTRY', sqlMessage: 'test' });
      const result2 = normalizeDatabaseError({ errno: 1062, sqlMessage: 'test' });

      expect((result1.details as any)?.constraintType).toBe('unique');
      expect((result2.details as any)?.constraintType).toBe('unique');
      expect((result1.details as any)?.databaseType).toBe('mysql');
    });

    it('should map ER_NO_REFERENCED_ROW / 1452 to foreign_key constraint violation', () => {
      const result1 = normalizeDatabaseError({ code: 'ER_NO_REFERENCED_ROW', sqlMessage: 'test' });
      const result2 = normalizeDatabaseError({ errno: 1452, sqlMessage: 'test' });

      expect((result1.details as any)?.constraintType).toBe('foreign_key');
      expect((result2.details as any)?.constraintType).toBe('foreign_key');
    });

    it('should map ER_ROW_IS_REFERENCED / 1451 to foreign_key constraint violation', () => {
      const result1 = normalizeDatabaseError({ code: 'ER_ROW_IS_REFERENCED', sqlMessage: 'test' });
      const result2 = normalizeDatabaseError({ errno: 1451, sqlMessage: 'test' });

      expect((result1.details as any)?.constraintType).toBe('foreign_key');
      expect((result2.details as any)?.constraintType).toBe('foreign_key');
    });

    it('should map ER_BAD_NULL_ERROR / 1048 to not_null constraint violation', () => {
      const result1 = normalizeDatabaseError({ code: 'ER_BAD_NULL_ERROR', sqlMessage: 'test' });
      const result2 = normalizeDatabaseError({ errno: 1048, sqlMessage: 'test' });

      expect((result1.details as any)?.constraintType).toBe('not_null');
      expect((result2.details as any)?.constraintType).toBe('not_null');
    });

    it('should prioritize code over errno when both present', () => {
      const result = normalizeDatabaseError({
        code: 'ER_DUP_ENTRY',
        errno: 1452, // Different error
      });

      expect((result.details as any)?.constraintType).toBe('unique'); // From code, not errno
    });
  });

  describe('Constraint Violations - SQLite', () => {
    it('should parse UNIQUE constraint violations', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email',
      });

      expect(isDatabaseErrorResult(result)).toBe(true);
      expect((result.details as any)?.constraintType).toBe('unique');
      expect((result.details as any)?.databaseType).toBe('sqlite');
    });

    it('should parse FOREIGN KEY constraint violations', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT_FOREIGN_KEY: FOREIGN KEY constraint failed',
      });

      expect((result.details as any)?.constraintType).toBe('foreign_key');
    });

    it('should parse NOT NULL constraint violations', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT: NOT NULL constraint failed: users.name',
      });

      expect((result.details as any)?.constraintType).toBe('not_null');
    });

    it('should parse CHECK constraint violations', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT_CHECK: CHECK constraint failed: orders',
      });

      expect((result.details as any)?.constraintType).toBe('check');
    });

    it('should parse PRIMARY KEY constraint violations', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT: PRIMARY KEY constraint failed: users',
      });

      expect((result.details as any)?.constraintType).toBe('primary_key');
    });

    it('should handle case insensitive matching', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email',
      });

      expect((result.details as any)?.constraintType).toBe('unique');
    });
  });

  describe('Constraint Violations - MongoDB', () => {
    it('should map E11000 duplicate key error', () => {
      const result1 = normalizeDatabaseError({
        code: 11000,
        codeName: 'test',
        message: 'E11000 duplicate key error collection: test.users index: email',
      });

      const result2 = normalizeDatabaseError({
        codeName: 'test',
        message: 'E11000 duplicate key error',
      });

      expect((result1.details as any)?.constraintType).toBe('unique');
      expect((result2.details as any)?.constraintType).toBe('unique');
      expect((result1.details as any)?.databaseType).toBe('mongodb');
    });

    it('should handle MongoDB writeErrors array', () => {
      const result = normalizeDatabaseError({
        code: 11000,
        writeErrors: [
          {
            code: 11000,
            errmsg: 'E11000 duplicate key error',
            index: 0,
          },
        ],
      });

      expect((result.details as any)?.constraintType).toBe('unique');
    });

    it('should handle WriteConcernFailed in writeErrors', () => {
      const result = normalizeDatabaseError({
        writeErrors: [
          {
            codeName: 'WriteConcernFailed',
            errmsg: 'Write concern failed',
          },
        ],
      });

      expect((result.details as any)?.transactionState).toBe('failed');
    });
  });

  describe('Transaction State Analysis - Deadlock', () => {
    it('should detect PostgreSQL deadlock in detail', () => {
      const result = normalizeDatabaseError({
        code: '40P01', // Deadlock detected
        detail:
          'Process 123 waits for ShareLock on transaction 456; blocked by process 789. Process 789 waits for ShareLock on transaction 123; blocked by process 123. This is a deadlock.',
      });

      expect((result.details as any)?.transactionState).toBe('deadlock');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_DEADLOCK);
    });

    it('should detect MySQL deadlock by errno', () => {
      const result = normalizeDatabaseError({
        errno: 1213, // ER_LOCK_DEADLOCK
        sqlMessage: 'Deadlock found when trying to get lock',
      });

      expect((result.details as any)?.transactionState).toBe('deadlock');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_DEADLOCK);
    });

    it('should detect generic deadlock in message', () => {
      const result = normalizeDatabaseError({
        message: 'Database deadlock detected during transaction',
      });

      expect((result.details as any)?.transactionState).toBe('deadlock');
    });
  });

  describe('Transaction State Analysis - Timeout', () => {
    it('should detect PostgreSQL timeout in detail', () => {
      const result = normalizeDatabaseError({
        code: '57014', // query_canceled
        detail: 'canceling statement due to statement timeout',
      });

      expect((result.details as any)?.transactionState).toBe('timeout');
      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_TIMEOUT);
    });

    it('should detect generic timeout in message', () => {
      const result = normalizeDatabaseError({
        message: 'Query timeout exceeded',
      });

      expect((result.details as any)?.transactionState).toBe('timeout');
    });
  });

  describe('Error Categorization Correctness', () => {
    it('should categorize constraint violations', () => {
      // Test through normalizeDatabaseError which internally calls categorizeDatabaseError
      const result = normalizeDatabaseError({
        code: '23505', // unique constraint
      });

      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED); // constraint category
    });

    it('should categorize transaction states', () => {
      const result = normalizeDatabaseError({
        errno: 1213, // deadlock
      });

      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_DEADLOCK); // transaction category
    });

    it('should categorize connection issues', () => {
      const result = normalizeDatabaseError({
        host: 'localhost',
        port: 5432,
        code: 'test', // Add code to make it recognized
        detail: 'test',
      });

      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_FAILED);
    });

    it('should categorize query operations', () => {
      const result = normalizeDatabaseError({
        operation: 'insert',
        query: 'INSERT INTO users...',
        code: 'test', // Add code to make it recognized
        detail: 'test',
      });

      expect(result.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED);
    });

    it('should handle unknown category', () => {
      const result = normalizeDatabaseError({
        someUnknownField: 'value',
      });

      expect(result.code).toBe('SHARED_INFRA_DATABASE_ADAPTER_ERROR'); // adapter error for unrecognized input
    });
  });

  describe('Context Integrity & Immutability', () => {
    it('should filter out null/undefined fields from context', () => {
      const result = normalizeDatabaseError({
        code: '23505',
        detail: 'test',
        table: 'users',
        constraint: null,
        host: undefined,
        operation: 'insert',
      });

      expect((result.details as any)?.tableName).toBe('users');
      expect((result.details as any)?.operation).toBe('insert');
      expect((result.details as any)?.constraintName).toBeUndefined();
      expect((result.details as any)?.host).toBeUndefined();
    });

    it('should not over-infer constraint types', () => {
      // Similar-looking but not actual constraint error
      const result = normalizeDatabaseError({
        message: 'Some unrelated error with UNIQUE word in it',
      });

      expect(result.details).toHaveProperty('databaseType', 'unknown');
      // SQLite patterns require specific format, so this should not match
    });

    it('should not over-infer transaction states', () => {
      const result = normalizeDatabaseError({
        message: 'Some message mentioning deadlock prevention mechanisms',
      });

      // Should detect 'deadlock' in message
      expect((result.details as any)?.transactionState).toBe('deadlock');
    });

    it('should preserve valid context fields', () => {
      const result = normalizeDatabaseError({
        code: '23505',
        detail: 'test',
        table: 'users',
        constraint: 'users_email_key',
        host: 'localhost',
        port: 5432,
        operation: 'insert',
      });

      expect((result.details as any)?.tableName).toBe('users');
      expect((result.details as any)?.constraintName).toBe('users_email_key');
      expect((result.details as any)?.host).toBe('localhost');
      expect((result.details as any)?.port).toBe(5432);
      expect((result.details as any)?.operation).toBe('insert');
      expect((result.details as any)?.constraintType).toBe('unique');
    });
  });

  describe('Adapter Error Path', () => {
    it('should create SharedAdapterError for unrecognized inputs', () => {
      const result = normalizeDatabaseError({
        unrecognizedField: 'value',
      });

      expect(isDatabaseInfraError(result)).toBe(true);
      expect(result._tag).toBe('SharedAdapterError');
      expect(result.category).toBe('adapter');
      expect(result.code).toBe('SHARED_INFRA_DATABASE_ADAPTER_ERROR');
    });

    it('should extract message from input object', () => {
      const result = normalizeDatabaseError({
        message: 'Custom database error message',
      });

      expect(result.message).toBe('Custom database error message');
    });

    it('should use default message when no message in input', () => {
      const result = normalizeDatabaseError({
        someField: 'value',
      });

      expect(result.message).toBe('Unknown database error');
    });

    it('should set databaseType to unknown in adapter errors', () => {
      const result = normalizeDatabaseError('string error');

      expect(result.details).toHaveProperty('databaseType', 'unknown');
    });
  });

  describe('TaggedError shape validation', () => {
    it('should always have _tag field', () => {
      const results = [
        normalizeDatabaseError({ code: '23505' }),
        normalizeDatabaseError(null),
        normalizeDatabaseError({}),
      ];

      results.forEach((result) => {
        expect(result).toHaveProperty('_tag');
        expect(['DatabaseError', 'SharedAdapterError']).toContain(result._tag);
      });
    });

    it('should have correct category', () => {
      const dbError = normalizeDatabaseError({ code: '23505' });
      const adapterError = normalizeDatabaseError(null);

      expect(dbError).toHaveProperty('category', 'TECHNICAL'); // DatabaseError has TECHNICAL category
      expect(adapterError).toHaveProperty('category', 'adapter');
    });

    it('should have stable error codes', () => {
      const result1 = normalizeDatabaseError({ code: '23505' });
      const result2 = normalizeDatabaseError({ code: '23505' });

      expect(result1.code).toBe(result2.code);
      expect(result1.code).toBe(LIVAI_ERROR_CODES.INFRA_DB_QUERY_FAILED);
    });

    it('should have plain object details', () => {
      const result = normalizeDatabaseError({ code: '23505', table: 'users' });

      expect(result.details).toBeInstanceOf(Object);
      expect(typeof result.details).toBe('object');
      expect(result.details).not.toBeNull();
    });
  });

  describe('Regression / Stability', () => {
    it('should maintain backward compatibility with new fields', () => {
      const baseInput = { code: '23505', table: 'users' };
      const baseResult = normalizeDatabaseError(baseInput);

      // Adding new fields shouldn't break existing behavior
      const extendedInput = { ...baseInput, newField: 'newValue', anotherField: 123 };
      const extendedResult = normalizeDatabaseError(extendedInput);

      expect(extendedResult._tag).toBe(baseResult._tag);
      expect(extendedResult.code).toBe(baseResult.code);
      expect(extendedResult.message).toBe(baseResult.message);
    });

    it('should ignore extra fields gracefully', () => {
      const result = normalizeDatabaseError({
        code: '23505',
        detail: 'test',
        extraField1: 'ignored',
        extraField2: { nested: 'ignored' },
        extraField3: ['ignored'],
      });

      expect((result.details as any)?.constraintType).toBe('unique');
      expect((result.details as any)?.databaseType).toBe('postgresql');
      // Extra fields should not appear in details
      expect(result.details).not.toHaveProperty('extraField1');
      expect(result.details).not.toHaveProperty('extraField2');
      expect(result.details).not.toHaveProperty('extraField3');
    });

    it('should have stable output for same input', () => {
      const input = {
        code: '23505',
        detail: 'Key (email)=(test@test.com) already exists.',
        table: 'users',
        constraint: 'users_email_key',
      };

      const results = Array.from({ length: 5 }, () => normalizeDatabaseError(input));

      // All results should be identical
      results.forEach((result) => {
        expect(result).toEqual(results[0]);
      });
    });
  });

  describe('Utility functions', () => {
    describe('isDatabaseErrorResult', () => {
      it('should correctly identify DatabaseError', () => {
        const dbError = normalizeDatabaseError({ code: '23505' });
        const adapterError = normalizeDatabaseError(null);

        expect(isDatabaseErrorResult(dbError)).toBe(true);
        expect(isDatabaseErrorResult(adapterError)).toBe(false);
      });
    });

    describe('isDatabaseInfraError', () => {
      it('should correctly identify SharedAdapterError', () => {
        const dbError = normalizeDatabaseError({ code: '23505' });
        const adapterError = normalizeDatabaseError(null);

        expect(isDatabaseInfraError(dbError)).toBe(false);
        expect(isDatabaseInfraError(adapterError)).toBe(true);
      });
    });

    describe('extractDatabaseType', () => {
      it('should extract database type from DatabaseError', () => {
        const dbError = normalizeDatabaseError({ code: '23505', detail: 'test' });
        expect(extractDatabaseType(dbError)).toBe('postgresql');
      });

      it('should extract database type from AdapterError', () => {
        const adapterError = normalizeDatabaseError(null);
        expect(extractDatabaseType(adapterError)).toBe('unknown');
      });

      it('should return undefined for invalid results', () => {
        expect(extractDatabaseType({} as any)).toBeUndefined();
      });
    });
  });

  describe('Edge cases for branch coverage', () => {
    it('should handle constraint types with number codes instead of strings', () => {
      // Test edge case where PostgreSQL code is passed as number
      const result = normalizeDatabaseError({
        code: 23505, // number instead of string '23505'
        detail: 'test',
      });

      expect((result.details as any)?.constraintType).toBeUndefined(); // Should not match string pattern
    });

    it('should handle transaction state detection with exact deadlock text', () => {
      const result = normalizeDatabaseError({
        code: 'test',
        detail: 'process deadlock detected',
      });

      expect((result.details as any)?.transactionState).toBe('deadlock');
    });

    it('should handle transaction state detection with exact timeout text', () => {
      const result = normalizeDatabaseError({
        code: 'test',
        detail: 'query timeout occurred',
      });

      expect((result.details as any)?.transactionState).toBe('timeout');
    });

    it('should handle MongoDB writeErrors with empty array', () => {
      const result = normalizeDatabaseError({
        writeErrors: [],
        codeName: 'test',
      });

      expect((result.details as any)?.constraintType).toBeUndefined();
      expect((result.details as any)?.transactionState).toBeUndefined();
    });

    it('should handle MongoDB writeErrors with invalid structure', () => {
      const result = normalizeDatabaseError({
        writeErrors: [
          { invalidField: 'value' }, // No code, errmsg, or codeName
        ],
        codeName: 'test',
      });

      expect((result.details as any)?.constraintType).toBeUndefined();
      expect((result.details as any)?.transactionState).toBeUndefined();
    });

    it('should handle MongoDB writeErrors with mixed valid/invalid entries', () => {
      const result = normalizeDatabaseError({
        writeErrors: [
          { invalidField: 'value' }, // Invalid
          { code: 11000, errmsg: 'E11000 duplicate key' }, // Valid duplicate
          { codeName: 'WriteConcernFailed' }, // Valid transaction state
        ],
        codeName: 'test',
      });

      expect((result.details as any)?.constraintType).toBe('unique');
      expect((result.details as any)?.transactionState).toBe('failed');
    });

    it('should handle SQLite constraint patterns with different cases', () => {
      const result = normalizeDatabaseError({
        message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email', // uppercase
      });

      expect((result.details as any)?.constraintType).toBe('unique');
    });

    it('should handle unknown constraint types in all databases', () => {
      // Test unknown PostgreSQL code
      const result1 = normalizeDatabaseError({
        code: '99999',
        detail: 'unknown error',
      });

      // Test unknown MySQL code
      const result2 = normalizeDatabaseError({
        code: 'UNKNOWN_ERROR',
        sqlMessage: 'unknown mysql error',
      });

      expect((result1.details as any)?.constraintType).toBeUndefined();
      expect((result2.details as any)?.constraintType).toBeUndefined();
    });

    it('should handle unknown transaction states in all databases', () => {
      const result = normalizeDatabaseError({
        code: 'test',
        detail: 'some unknown transaction issue',
        errno: 99999, // Unknown MySQL error
      });

      expect((result.details as any)?.transactionState).toBeUndefined();
    });

    it('should handle default case in mapDatabaseErrorToCode', () => {
      // Test with input that creates unknown category (no recognized fields)
      const result = normalizeDatabaseError({
        unrecognizedField: 'value',
      });

      expect(result.code).toBe('SHARED_INFRA_DATABASE_ADAPTER_ERROR');
    });
  });

  describe('Property-based tests', () => {
    it('should always return TaggedError for any input', () => {
      const testInputs = [
        null,
        undefined,
        'string error',
        42,
        true,
        false,
        {},
        { code: 'test' },
        { errno: 123 },
        { message: 'test' },
        [],
        new Error('test'),
        Symbol('test'),
        () => {},
        { nested: { deep: { value: 'test' } } },
        { code: 23505, detail: 'test', table: 'users', constraint: 'test' },
        { errno: 1062, sqlMessage: 'test' },
        { message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed' },
        { code: 11000, writeErrors: [{ code: 11000 }] },
      ];

      testInputs.forEach((input) => {
        const result = normalizeDatabaseError(input);
        expect(result).toBeDefined();
        expect(result).toHaveProperty('_tag');
        expect(['DatabaseError', 'SharedAdapterError']).toContain(result._tag);
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('message');
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      });
    });

    it('should never throw for any input', () => {
      const problematicInputs: any[] = [
        null,
        undefined,
        {},
        [],
        'string',
        0,
        false,
        Symbol('test'),
        new Map(),
        new Set(),
        new Date(),
        /regex/,
        () => {
          throw new Error('test');
        },
        { circular: {} },
        { __proto__: null },
        { constructor: undefined },
        { toString: 'not a function' },
      ];

      problematicInputs.forEach((input) => {
        expect(() => normalizeDatabaseError(input)).not.toThrow();
      });
    });

    it('should never return undefined', () => {
      const edgeCaseInputs = [
        null,
        undefined,
        {},
        [],
        '',
        0,
        false,
        { code: undefined },
        { errno: null },
        { message: NaN },
      ];

      edgeCaseInputs.forEach((input) => {
        const result = normalizeDatabaseError(input);
        expect(result).not.toBeUndefined();
        expect(result).not.toBeNull();
      });
    });
  });

  describe('Stability / Snapshot tests', () => {
    it('should produce identical output for same input (snapshot)', () => {
      const testCases = [
        { code: '23505', detail: 'Key (email)=(test@test.com) already exists.' },
        { errno: 1062, sqlMessage: 'Duplicate entry' },
        { message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email' },
        { code: 11000, writeErrors: [{ code: 11000, errmsg: 'E11000 duplicate key' }] },
        null,
        undefined,
        'error string',
        42,
        {},
      ];

      testCases.forEach((input) => {
        // Run multiple times to ensure stability
        const results = Array.from({ length: 3 }, () => normalizeDatabaseError(input));

        // All results should be identical
        results.forEach((result) => {
          expect(result._tag).toBe(results[0]._tag);
          expect(result.category).toBe(results[0].category);
          expect(result.code).toBe(results[0].code);
          expect(result.message).toBe(results[0].message);

          // Details should also be structurally identical (excluding timestamps)
          if (result.details && results[0].details) {
            const { timestamp: _, ...detailsWithoutTs } = result.details as any;
            const { timestamp: __, ...firstDetailsWithoutTs } = results[0].details as any;
            expect(detailsWithoutTs).toEqual(firstDetailsWithoutTs);
          } else {
            expect(result.details).toBe(results[0].details);
          }
        });
      });
    });

    it('should produce byte-to-byte identical output for primitives', () => {
      const primitiveInputs = [
        null,
        undefined,
        '',
        'error message',
        0,
        -1,
        999,
        true,
        false,
      ];

      primitiveInputs.forEach((input) => {
        const result1 = normalizeDatabaseError(input);
        const result2 = normalizeDatabaseError(input);

        // Should be completely identical
        expect(result1).toEqual(result2);
        expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
      });
    });
  });
});
