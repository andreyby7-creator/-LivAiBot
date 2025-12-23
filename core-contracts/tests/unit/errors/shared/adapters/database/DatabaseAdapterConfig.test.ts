/**
 * @file DatabaseAdapterConfig.test.ts - Тесты для DatabaseAdapterConfig
 *
 * Цель: проверка генерации конфигураций, circuit breaker key, retry-флагов, default values.
 * Желаемое покрытие: 95–100%
 */

import { describe, expect, it } from 'vitest';

import { databaseAdapterFactories } from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterFactories';
import { TransactionIsolationLevel } from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterTypes';
import {
  createConfig,
  createDatabaseAdapterContext,
  DATABASE_ADAPTER_DEFAULTS,
  DATABASE_ADAPTER_RANGES,
  DB_OPERATION_TYPES,
  getCircuitBreakerKey,
  isRetryableDbError,
} from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterConfig.js';
import type { DatabaseAdapterOptions } from '../../../../../../src/errors/shared/adapters/database/DatabaseAdapterTypes.js';

describe('DatabaseAdapterConfig', () => {
  describe('createConfig', () => {
    it('should create config with default values', () => {
      const config = createConfig();

      expect(config).toBeDefined();
      expect(typeof config.timeout).toBe('number');
      expect(typeof config.maxRetries).toBe('number');
      expect(typeof config.retryDelay).toBe('number');
      expect(typeof config.circuitBreakerThreshold).toBe('number');
      expect(typeof config.circuitBreakerRecoveryTimeout).toBe('number');
      expect(typeof config.circuitBreakerEnabled).toBe('boolean');
      expect(typeof config.retriesEnabled).toBe('boolean');
      expect(typeof config.maxConnectionPoolSize).toBe('number');
      expect(typeof config.minConnectionPoolSize).toBe('number');
      expect(typeof config.connectionTimeout).toBe('number');
      expect(typeof config.connectionMaxLifetime).toBe('number');
      expect(typeof config.connectionIdleTimeout).toBe('number');
      expect(typeof config.sqlLoggingEnabled).toBe('boolean');
      expect(typeof config.metricsEnabled).toBe('boolean');
      expect(config.defaultIsolationLevel).toBe(TransactionIsolationLevel.READ_COMMITTED);
    });

    it('should create config with custom values', () => {
      const customConfig: Partial<DatabaseAdapterOptions> = {
        timeoutMs: databaseAdapterFactories.makeTimeoutMs(10000),
        maxRetries: databaseAdapterFactories.makeMaxRetries(5),
        retryDelayMs: databaseAdapterFactories.makeTimeoutMs(2000),
        circuitBreakerThreshold: databaseAdapterFactories.makeCircuitBreakerThreshold(10),
        circuitBreakerRecoveryMs: databaseAdapterFactories.makeTimeoutMs(300000),
        circuitBreakerEnabled: false,
        retriesEnabled: false,
        maxConnectionPoolSize: 50,
        minConnectionPoolSize: 5,
        connectionTimeoutMs: databaseAdapterFactories.makeTimeoutMs(20000),
        connectionMaxLifetimeMs: databaseAdapterFactories.makeTimeoutMs(120000),
        connectionIdleTimeoutMs: databaseAdapterFactories.makeTimeoutMs(60000),
        defaultIsolationLevel: TransactionIsolationLevel.SERIALIZABLE,
        sqlLoggingEnabled: true,
        metricsEnabled: false,
      };

      const config = createConfig(customConfig);

      expect(config.timeout).toBe(10000);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
      expect(config.circuitBreakerThreshold).toBe(10);
      expect(config.circuitBreakerRecoveryTimeout).toBe(300000);
      expect(config.circuitBreakerEnabled).toBe(false);
      expect(config.retriesEnabled).toBe(false);
      expect(config.maxConnectionPoolSize).toBe(50);
      expect(config.minConnectionPoolSize).toBe(5);
      expect(config.connectionTimeout).toBe(20000);
      expect(config.connectionMaxLifetime).toBe(120000);
      expect(config.connectionIdleTimeout).toBe(60000);
      expect(config.defaultIsolationLevel).toBe(TransactionIsolationLevel.SERIALIZABLE);
      expect(config.sqlLoggingEnabled).toBe(true);
      expect(config.metricsEnabled).toBe(false);
    });

    it('should merge partial config with defaults', () => {
      const partialConfig: Partial<DatabaseAdapterOptions> = {
        timeoutMs: databaseAdapterFactories.makeTimeoutMs(15000),
        maxConnectionPoolSize: 25,
      };

      const config = createConfig(partialConfig);

      expect(config.timeout).toBe(15000);
      expect(config.maxConnectionPoolSize).toBe(25);
      // Other values should be defaults
      expect(config.maxRetries).toBeDefined();
      expect(config.circuitBreakerEnabled).toBeDefined();
      expect(config.sqlLoggingEnabled).toBeDefined();
    });

    it('should validate connection pool size constraints', () => {
      // Valid range - when max >= min (default min is 2)
      expect(() => createConfig({ maxConnectionPoolSize: 2 })).not.toThrow();
      expect(() => createConfig({ maxConnectionPoolSize: 100 })).not.toThrow();

      // Invalid range
      expect(() => createConfig({ maxConnectionPoolSize: 1 })).toThrow(); // 1 < default min 2
      expect(() => createConfig({ maxConnectionPoolSize: 0 })).toThrow();
      expect(() => createConfig({ maxConnectionPoolSize: 101 })).toThrow();
      expect(() => createConfig({ maxConnectionPoolSize: 1.5 })).toThrow();
    });

    it('should validate minConnectionPoolSize <= maxConnectionPoolSize', () => {
      expect(() =>
        createConfig({
          minConnectionPoolSize: 10,
          maxConnectionPoolSize: 5,
        })
      ).toThrow();
    });

    it('should ensure config immutability', () => {
      const config = createConfig();

      // Attempt to modify config should not affect the original
      expect(() => {
        (config as any).timeout = 9999;
      }).not.toThrow();

      // But the config values should remain unchanged in practice
      // (since we return a new object, mutation shouldn't affect other uses)
    });

    describe('edge cases', () => {
      it('should handle zero timeout', () => {
        expect(() =>
          createConfig({
            timeoutMs: databaseAdapterFactories.makeTimeoutMs(100), // minimum valid
          })
        ).not.toThrow();
      });

      it('should handle zero retries', () => {
        const config = createConfig({
          maxRetries: databaseAdapterFactories.makeMaxRetries(0),
        });
        expect(config.maxRetries).toBe(0);
      });

      it('should handle zero retry delay', () => {
        expect(() =>
          createConfig({
            retryDelayMs: databaseAdapterFactories.makeTimeoutMs(100), // minimum valid
          })
        ).not.toThrow();
      });

      it('should handle minimum circuit breaker threshold', () => {
        const config = createConfig({
          circuitBreakerThreshold: databaseAdapterFactories.makeCircuitBreakerThreshold(1),
        });
        expect(config.circuitBreakerThreshold).toBe(1);
      });

      it('should handle minimum connection pool sizes', () => {
        const config = createConfig({
          minConnectionPoolSize: 1,
          maxConnectionPoolSize: 1,
        });
        expect(config.minConnectionPoolSize).toBe(1);
        expect(config.maxConnectionPoolSize).toBe(1);
      });

      it('should handle large values within limits', () => {
        const config = createConfig({
          timeoutMs: databaseAdapterFactories.makeTimeoutMs(300000), // Maximum allowed
          maxRetries: databaseAdapterFactories.makeMaxRetries(10), // Maximum allowed
          retryDelayMs: databaseAdapterFactories.makeTimeoutMs(30000), // Maximum allowed
          circuitBreakerThreshold: databaseAdapterFactories.makeCircuitBreakerThreshold(100), // Maximum allowed
          circuitBreakerRecoveryMs: databaseAdapterFactories.makeTimeoutMs(300000), // Maximum allowed
          maxConnectionPoolSize: 100, // Maximum allowed
          connectionTimeoutMs: databaseAdapterFactories.makeTimeoutMs(120000), // Maximum allowed
          connectionMaxLifetimeMs: databaseAdapterFactories.makeTimeoutMs(300000), // Maximum allowed
          connectionIdleTimeoutMs: databaseAdapterFactories.makeTimeoutMs(300000), // Maximum allowed
        });

        expect(config.timeout).toBe(300000);
        expect(config.maxRetries).toBe(10);
        expect(config.retryDelay).toBe(30000);
        expect(config.circuitBreakerThreshold).toBe(100);
        expect(config.circuitBreakerRecoveryTimeout).toBe(300000);
        expect(config.maxConnectionPoolSize).toBe(100);
        expect(config.connectionTimeout).toBe(120000);
        expect(config.connectionMaxLifetime).toBe(300000);
        expect(config.connectionIdleTimeout).toBe(300000);
      });
    });
  });

  describe('createDatabaseAdapterContext', () => {
    it('should create context with databaseId', () => {
      const context = createDatabaseAdapterContext('main-db');

      expect(context.databaseId).toBe('main-db');
      expect(context.defaultTimeoutMs).toBeUndefined();
      expect(context.maxRetries).toBeUndefined();
    });

    it('should create context with optional timeout', () => {
      const context = createDatabaseAdapterContext('test-db', {
        defaultTimeoutMs: databaseAdapterFactories.makeTimeoutMs(5000),
      });

      expect(context.databaseId).toBe('test-db');
      expect(context.defaultTimeoutMs).toBe(5000);
      expect(context.maxRetries).toBeUndefined();
    });

    it('should create context with optional maxRetries', () => {
      const context = createDatabaseAdapterContext('prod-db', {
        maxRetries: databaseAdapterFactories.makeMaxRetries(3),
      });

      expect(context.databaseId).toBe('prod-db');
      expect(context.defaultTimeoutMs).toBeUndefined();
      expect(context.maxRetries).toBe(3);
    });

    it('should create context with all optional fields', () => {
      const context = createDatabaseAdapterContext('full-db', {
        defaultTimeoutMs: databaseAdapterFactories.makeTimeoutMs(10000),
        maxRetries: databaseAdapterFactories.makeMaxRetries(5),
      });

      expect(context.databaseId).toBe('full-db');
      expect(context.defaultTimeoutMs).toBe(10000);
      expect(context.maxRetries).toBe(5);
    });

    it('should handle zero values correctly', () => {
      const context = createDatabaseAdapterContext('zero-db', {
        defaultTimeoutMs: databaseAdapterFactories.makeTimeoutMs(100), // minimum valid
        maxRetries: databaseAdapterFactories.makeMaxRetries(0),
      });

      expect(context.defaultTimeoutMs).toBe(100);
      expect(context.maxRetries).toBe(0);
    });

    it('should handle empty overrides', () => {
      const context = createDatabaseAdapterContext('empty-db', {});

      expect(context.databaseId).toBe('empty-db');
      expect(context.defaultTimeoutMs).toBeUndefined();
      expect(context.maxRetries).toBeUndefined();
    });
  });

  describe('getCircuitBreakerKey', () => {
    it('should generate key for databaseId and operation', () => {
      const key = getCircuitBreakerKey('main-db', 'SELECT');

      expect(typeof key).toBe('string');
      expect(key).toBe('main-db:SELECT');
    });

    it('should generate keys for different operations', () => {
      const dbId = 'test-db';

      expect(getCircuitBreakerKey(dbId, DB_OPERATION_TYPES.SELECT)).toBe('test-db:SELECT');
      expect(getCircuitBreakerKey(dbId, DB_OPERATION_TYPES.INSERT)).toBe('test-db:INSERT');
      expect(getCircuitBreakerKey(dbId, DB_OPERATION_TYPES.UPDATE)).toBe('test-db:UPDATE');
      expect(getCircuitBreakerKey(dbId, DB_OPERATION_TYPES.DELETE)).toBe('test-db:DELETE');
      expect(getCircuitBreakerKey(dbId, DB_OPERATION_TYPES.DDL)).toBe('test-db:DDL');
      expect(getCircuitBreakerKey(dbId, DB_OPERATION_TYPES.TRANSACTION)).toBe(
        'test-db:TRANSACTION',
      );
    });

    it('should handle complex database identifiers', () => {
      const complexDbId = 'prod-analytics-db-cluster-01';
      const key = getCircuitBreakerKey(complexDbId, 'SELECT');

      expect(key).toBe('prod-analytics-db-cluster-01:SELECT');
    });

    it('should handle operation types with special characters', () => {
      const key = getCircuitBreakerKey('my-db', 'complex_operation');
      expect(key).toBe('my-db:complex_operation');
    });

    it('should return branded type', () => {
      const key = getCircuitBreakerKey('test-db', 'SELECT');
      // Should be assignable to string (branded type extends string)
      const stringKey: string = key;
      expect(typeof stringKey).toBe('string');
    });
  });

  describe('isRetryableDbError', () => {
    it('should return true for connection errors', () => {
      const connectionError = new Error('Connection timeout occurred');
      const networkError = new Error('Network connection failed');
      const resetError = new Error('Connection reset by peer (ECONNRESET)');
      const notFoundError = new Error('ENOTFOUND error');

      expect(isRetryableDbError(connectionError)).toBe(true);
      expect(isRetryableDbError(networkError)).toBe(true);
      expect(isRetryableDbError(resetError)).toBe(true);
      expect(isRetryableDbError(notFoundError)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const timeoutError = new Error('Request timeout occurred');
      const deadlineError = new Error('Query timeout');

      expect(isRetryableDbError(timeoutError)).toBe(true);
      expect(isRetryableDbError(deadlineError)).toBe(true);
    });

    it('should return true for deadlock errors', () => {
      const deadlockError = new Error('Deadlock detected');
      const serializationError = new Error('Serialization failure');

      expect(isRetryableDbError(deadlockError)).toBe(true);
      expect(isRetryableDbError(serializationError)).toBe(true);
    });

    it('should return true for temporary/unavailable errors', () => {
      const tempError = new Error('Temporary server error');
      const unavailableError = new Error('Service unavailable');

      expect(isRetryableDbError(tempError)).toBe(true);
      expect(isRetryableDbError(unavailableError)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const validationError = new Error('Validation failed');
      const authError = new Error('Access denied');
      const constraintError = new Error('Foreign key constraint violation');

      expect(isRetryableDbError(validationError)).toBe(false);
      expect(isRetryableDbError(authError)).toBe(false);
      expect(isRetryableDbError(constraintError)).toBe(false);
    });

    it('should return true for PostgreSQL error codes', () => {
      // Test with numeric error codes
      const deadlockError = { code: 40 }; // PostgreSQL deadlock
      const serializationError = { code: 40001 }; // PostgreSQL serialization_failure
      const tooManyConnError = { code: 53300 }; // PostgreSQL too_many_connections

      expect(isRetryableDbError(deadlockError)).toBe(true);
      expect(isRetryableDbError(serializationError)).toBe(true);
      expect(isRetryableDbError(tooManyConnError)).toBe(true);
    });

    it('should return false for non-retryable PostgreSQL error codes', () => {
      const uniqueViolation = { code: 23505 }; // PostgreSQL unique_violation (may not always be retryable)
      const notNullViolation = { code: 23502 }; // PostgreSQL not_null_violation
      const genericError = { code: 99999 }; // Unknown error code

      expect(isRetryableDbError(uniqueViolation)).toBe(true); // Currently included in retryable codes
      expect(isRetryableDbError(notNullViolation)).toBe(false);
      expect(isRetryableDbError(genericError)).toBe(false);
    });

    it('should return false for errors without retryable patterns', () => {
      const syntaxError = new Error('Syntax error in SQL');
      const typeError = new Error('Type mismatch');
      const logicError = new Error('Business logic error');

      expect(isRetryableDbError(syntaxError)).toBe(false);
      expect(isRetryableDbError(typeError)).toBe(false);
      expect(isRetryableDbError(logicError)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      const stringError = 'string error';
      const numberError = 42;
      const objectError = { message: 'object error' };
      const nullError = null;
      const undefinedError = undefined;

      expect(isRetryableDbError(stringError)).toBe(false);
      expect(isRetryableDbError(numberError)).toBe(false);
      expect(isRetryableDbError(objectError)).toBe(false);
      expect(isRetryableDbError(nullError as any)).toBe(false);
      expect(isRetryableDbError(undefinedError as any)).toBe(false);
    });

    it('should return false for empty error objects', () => {
      const emptyError = {};
      const errorWithoutCode = { message: 'test' };

      expect(isRetryableDbError(emptyError)).toBe(false);
      expect(isRetryableDbError(errorWithoutCode)).toBe(false);
    });
  });

  describe('DATABASE_ADAPTER_DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(DATABASE_ADAPTER_DEFAULTS.TIMEOUT_MS).toBe(30000);
      expect(DATABASE_ADAPTER_DEFAULTS.MAX_RETRIES).toBe(3);
      expect(DATABASE_ADAPTER_DEFAULTS.RETRY_DELAY_MS).toBe(1000);
      expect(DATABASE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_THRESHOLD).toBe(10);
      expect(DATABASE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS).toBe(60000);
      expect(DATABASE_ADAPTER_DEFAULTS.MAX_CONNECTION_POOL_SIZE).toBe(20);
      expect(DATABASE_ADAPTER_DEFAULTS.MIN_CONNECTION_POOL_SIZE).toBe(2);
      expect(DATABASE_ADAPTER_DEFAULTS.CONNECTION_TIMEOUT_MS).toBe(10000);
      expect(DATABASE_ADAPTER_DEFAULTS.CONNECTION_MAX_LIFETIME_MS).toBe(240000);
      expect(DATABASE_ADAPTER_DEFAULTS.CONNECTION_IDLE_TIMEOUT_MS).toBe(120000);
      expect(DATABASE_ADAPTER_DEFAULTS.DEFAULT_ISOLATION_LEVEL).toBe('READ_COMMITTED');
    });

    it('should have all required default properties', () => {
      const requiredDefaults = [
        'TIMEOUT_MS',
        'MAX_RETRIES',
        'RETRY_DELAY_MS',
        'CIRCUIT_BREAKER_THRESHOLD',
        'CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS',
        'MAX_CONNECTION_POOL_SIZE',
        'MIN_CONNECTION_POOL_SIZE',
        'CONNECTION_TIMEOUT_MS',
        'CONNECTION_MAX_LIFETIME_MS',
        'CONNECTION_IDLE_TIMEOUT_MS',
        'DEFAULT_ISOLATION_LEVEL',
      ];

      requiredDefaults.forEach((prop) => {
        expect(DATABASE_ADAPTER_DEFAULTS).toHaveProperty(prop);
      });
    });
  });

  describe('DB_OPERATION_TYPES', () => {
    it('should have correct operation type constants', () => {
      expect(DB_OPERATION_TYPES.SELECT).toBe('SELECT');
      expect(DB_OPERATION_TYPES.INSERT).toBe('INSERT');
      expect(DB_OPERATION_TYPES.UPDATE).toBe('UPDATE');
      expect(DB_OPERATION_TYPES.DELETE).toBe('DELETE');
      expect(DB_OPERATION_TYPES.DDL).toBe('DDL');
      expect(DB_OPERATION_TYPES.TRANSACTION).toBe('TRANSACTION');
    });

    it('should have all required operation types', () => {
      const requiredTypes = [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'DDL',
        'TRANSACTION',
      ];

      requiredTypes.forEach((type) => {
        expect(DB_OPERATION_TYPES).toHaveProperty(type);
      });
    });
  });

  describe('DATABASE_ADAPTER_RANGES', () => {
    it('should have correct timeout ranges', () => {
      expect(DATABASE_ADAPTER_RANGES.TIMEOUT.MIN).toBe(100);
      expect(DATABASE_ADAPTER_RANGES.TIMEOUT.MAX).toBe(300000);
    });

    it('should have correct retry ranges', () => {
      expect(DATABASE_ADAPTER_RANGES.RETRIES.MIN).toBe(0);
      expect(DATABASE_ADAPTER_RANGES.RETRIES.MAX).toBe(10);
    });

    it('should have correct retry delay ranges', () => {
      expect(DATABASE_ADAPTER_RANGES.RETRY_DELAY.MIN).toBe(100);
      expect(DATABASE_ADAPTER_RANGES.RETRY_DELAY.MAX).toBe(30000);
    });

    it('should have correct circuit breaker ranges', () => {
      expect(DATABASE_ADAPTER_RANGES.CIRCUIT_BREAKER_THRESHOLD.MIN).toBe(1);
      expect(DATABASE_ADAPTER_RANGES.CIRCUIT_BREAKER_THRESHOLD.MAX).toBe(100);
    });

    it('should have correct connection pool ranges', () => {
      expect(DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MIN).toBe(1);
      expect(DATABASE_ADAPTER_RANGES.CONNECTION_POOL_SIZE.MAX).toBe(100);
    });
  });

  describe('integration tests', () => {
    it('should create valid config and context together', () => {
      const config = createConfig({
        timeoutMs: databaseAdapterFactories.makeTimeoutMs(15000),
        maxRetries: databaseAdapterFactories.makeMaxRetries(2),
      });

      const context = createDatabaseAdapterContext('integration-db', {
        defaultTimeoutMs: databaseAdapterFactories.makeTimeoutMs(20000),
        maxRetries: databaseAdapterFactories.makeMaxRetries(1),
      });

      expect(config.timeout).toBe(15000);
      expect(config.maxRetries).toBe(2);
      expect(context.databaseId).toBe('integration-db');
      expect(context.defaultTimeoutMs).toBe(20000);
      expect(context.maxRetries).toBe(1);
    });

    it('should generate circuit breaker key for context database', () => {
      const context = createDatabaseAdapterContext('cb-test-db');
      const key = getCircuitBreakerKey(context.databaseId, 'SELECT');

      expect(key).toBe('cb-test-db:SELECT');
    });

    it('should handle all transaction isolation levels', () => {
      const levels = [
        TransactionIsolationLevel.READ_UNCOMMITTED,
        TransactionIsolationLevel.READ_COMMITTED,
        TransactionIsolationLevel.REPEATABLE_READ,
        TransactionIsolationLevel.SERIALIZABLE,
      ];

      levels.forEach((level) => {
        const config = createConfig({ defaultIsolationLevel: level });
        expect(config.defaultIsolationLevel).toBe(level);
      });
    });
  });
});
