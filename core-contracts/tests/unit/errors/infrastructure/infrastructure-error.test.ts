/**
 * Unit tests для InfrastructureError
 */

import { describe, expect, it } from 'vitest';

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js';
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js';
import {
  createDatabaseError,
  createExternalServiceError,
  createNetworkError,
  createResourceUnavailableError,
  createTimeoutError,
  flatMapIO,
  isLeft,
  isRight,
  left,
  mapIO,
  matchInfrastructureError,
  right,
} from '../../../../src/errors/infrastructure/InfrastructureError.js';

import type { InfrastructureError } from '../../../../src/errors/infrastructure/InfrastructureError.js';

describe('InfrastructureError', () => {
  describe('createNetworkError', () => {
    it('should create NetworkError with correct structure', () => {
      const error = createNetworkError({
        endpoint: 'https://api.example.com/users',
        method: 'GET',
      });

      expect(error._tag).toBe('Network');
      expect(error.endpoint).toBe('https://api.example.com/users');
      expect(error.method).toBe('GET');
      expect(error.code).toBe(ERROR_CODE.INFRA_NETWORK_ERROR);
      expect(isBaseError(error)).toBe(true);
    });

    it('should include statusCode when provided', () => {
      const error = createNetworkError({
        endpoint: 'https://api.example.com',
        statusCode: 503,
      });

      expect(error.statusCode).toBe(503);
    });
  });

  describe('createTimeoutError', () => {
    it('should create TimeoutError with correct structure', () => {
      const error = createTimeoutError({
        operation: 'database-query',
        timeoutMs: 5000,
      });

      expect(error._tag).toBe('Timeout');
      expect(error.operation).toBe('database-query');
      expect(error.timeoutMs).toBe(5000);
      expect(error.code).toBe(ERROR_CODE.INFRA_TIMEOUT);
    });
  });

  describe('createDatabaseError', () => {
    it('should create DatabaseError with correct structure', () => {
      const error = createDatabaseError({
        database: 'postgres',
        operation: 'SELECT',
      });

      expect(error._tag).toBe('Database');
      expect(error.database).toBe('postgres');
      expect(error.operation).toBe('SELECT');
      expect(error.code).toBe(ERROR_CODE.INFRA_DATABASE_ERROR);
    });

    it('should include sanitizedQuery when provided', () => {
      const error = createDatabaseError({
        database: 'postgres',
        operation: 'SELECT',
        sanitizedQuery: 'SELECT * FROM users WHERE id = ?',
      });

      expect(error.sanitizedQuery).toBe('SELECT * FROM users WHERE id = ?');
    });

    it('should include queryHash when provided', () => {
      const error = createDatabaseError({
        database: 'postgres',
        operation: 'SELECT',
        queryHash: 'abc123',
      });

      expect(error.queryHash).toBe('abc123');
    });

    it('should include correlationId when provided', () => {
      const error = createDatabaseError({
        database: 'postgres',
        operation: 'SELECT',
        correlationId: 'req-123',
      });

      expect(error.correlationId).toBe('req-123');
    });
  });

  describe('createExternalServiceError', () => {
    it('should create ExternalServiceError with correct structure', () => {
      const error = createExternalServiceError({
        serviceName: 'payment-gateway',
        endpoint: 'https://payments.example.com',
      });

      expect(error._tag).toBe('ExternalService');
      expect(error.serviceName).toBe('payment-gateway');
      expect(error.endpoint).toBe('https://payments.example.com');
      expect(error.code).toBe(ERROR_CODE.INFRA_EXTERNAL_SERVICE_ERROR);
    });
  });

  describe('createResourceUnavailableError', () => {
    it('should create ResourceUnavailableError with correct structure', () => {
      const error = createResourceUnavailableError({
        resourceType: 'redis-cache',
      });

      expect(error._tag).toBe('ResourceUnavailable');
      expect(error.resourceType).toBe('redis-cache');
      expect(error.code).toBe(ERROR_CODE.INFRA_RESOURCE_UNAVAILABLE);
    });

    it('should include resourceId when provided', () => {
      const error = createResourceUnavailableError({
        resourceType: 'redis-cache',
        resourceId: 'cache-123',
      });

      expect(error.resourceId).toBe('cache-123');
    });
  });

  describe('matchInfrastructureError', () => {
    it('should match all error types', () => {
      const errors: InfrastructureError[] = [
        createNetworkError({ endpoint: 'test' }),
        createTimeoutError({ operation: 'test', timeoutMs: 1000 }),
        createDatabaseError({ database: 'test', operation: 'test' }),
        createExternalServiceError({ serviceName: 'test' }),
        createResourceUnavailableError({ resourceType: 'test' }),
      ];

      errors.forEach((error) => {
        const result = matchInfrastructureError(error, {
          network: () => 'network',
          timeout: () => 'timeout',
          database: () => 'database',
          externalService: () => 'external',
          resourceUnavailable: () => 'resource',
        });
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Either helpers', () => {
    it('should mapIO transform Right value', () => {
      const ioResult = right(10);
      const mapped = mapIO(ioResult, (x) => x * 2);

      expect(isRight(mapped)).toBe(true);
      if (isRight(mapped)) {
        expect(mapped.right).toBe(20);
      }
    });

    it('should mapIO preserve Left error', () => {
      const error = createNetworkError({ endpoint: 'test' });
      const ioResult = left(error);
      const mapped = mapIO(ioResult, (x) => x * 2);

      expect(isLeft(mapped)).toBe(true);
      if (isLeft(mapped)) {
        expect(mapped.left).toBe(error);
      }
    });

    it('should flatMapIO chain Right values', () => {
      const ioResult = right(10);
      const chained = flatMapIO(ioResult, (x) => right(x * 2));

      expect(isRight(chained)).toBe(true);
      if (isRight(chained)) {
        expect(chained.right).toBe(20);
      }
    });

    it('should flatMapIO preserve Left error', () => {
      const error = createNetworkError({ endpoint: 'test' });
      const ioResult = left(error);
      const chained = flatMapIO(ioResult, (x) => right(x * 2));

      expect(isLeft(chained)).toBe(true);
      if (isLeft(chained)) {
        expect(chained.left).toBe(error);
      }
    });
  });
});
