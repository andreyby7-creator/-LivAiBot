/**
 * Unit tests для SecurityError
 */

import { describe, expect, it } from 'vitest';

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js';
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js';
import {
  createForbiddenError,
  createRateLimitedError,
  createTokenExpiredError,
  createUnauthorizedError,
  flatMapSec,
  isLeft,
  isRecoverable,
  isRetryable,
  isRight,
  left,
  mapSec,
  matchSecurityError,
  right,
} from '../../../../src/errors/security/SecurityError.js';

import type { SecurityError } from '../../../../src/errors/security/SecurityError.js';

describe('SecurityError', () => {
  describe('createUnauthorizedError', () => {
    it('should create UnauthorizedError with correct structure', () => {
      const error = createUnauthorizedError({
        reason: 'Invalid credentials',
      });

      expect(error._tag).toBe('Unauthorized');
      expect(error.reason).toBe('Invalid credentials');
      expect(error.code).toBe(ERROR_CODE.SECURITY_UNAUTHORIZED);
      expect(isBaseError(error)).toBe(true);
    });

    it('should include userId when provided', () => {
      const error = createUnauthorizedError({
        userId: 'user-123',
      });

      expect(error.userId).toBe('user-123');
    });
  });

  describe('createForbiddenError', () => {
    it('should create ForbiddenError with correct structure', () => {
      const error = createForbiddenError({
        resource: 'user',
        action: 'delete',
      });

      expect(error._tag).toBe('Forbidden');
      expect(error.resource).toBe('user');
      expect(error.action).toBe('delete');
      expect(error.code).toBe(ERROR_CODE.SECURITY_FORBIDDEN);
    });

    it('should include requiredPermission when provided', () => {
      const error = createForbiddenError({
        resource: 'admin',
        action: 'access',
        requiredPermission: 'admin:full',
      });

      expect(error.requiredPermission).toBe('admin:full');
    });
  });

  describe('createTokenExpiredError', () => {
    it('should create TokenExpiredError with correct structure', () => {
      const error = createTokenExpiredError({
        tokenType: 'access',
      });

      expect(error._tag).toBe('TokenExpired');
      expect(error.tokenType).toBe('access');
      expect(error.code).toBe(ERROR_CODE.SECURITY_TOKEN_EXPIRED);
    });

    it('should include userId when provided', () => {
      const error = createTokenExpiredError({
        userId: 'user-123',
      });

      expect(error.userId).toBe('user-123');
    });
  });

  describe('createRateLimitedError', () => {
    it('should create RateLimitedError with correct structure', () => {
      const error = createRateLimitedError({
        limit: 100,
        windowMs: 60000,
      });

      expect(error._tag).toBe('RateLimited');
      expect(error.limit).toBe(100);
      expect(error.windowMs).toBe(60000);
      expect(error.code).toBe(ERROR_CODE.SECURITY_RATE_LIMITED);
    });

    it('should include endpoint when provided', () => {
      const error = createRateLimitedError({
        limit: 100,
        windowMs: 60000,
        endpoint: '/api/users',
      });

      expect(error.endpoint).toBe('/api/users');
    });
  });

  describe('matchSecurityError', () => {
    it('should match all error types', () => {
      const errors: SecurityError[] = [
        createUnauthorizedError({}),
        createForbiddenError({ resource: 'test', action: 'test' }),
        createTokenExpiredError({}),
        createRateLimitedError({ limit: 10, windowMs: 1000 }),
      ];

      errors.forEach((error) => {
        const result = matchSecurityError(error, {
          unauthorized: () => 'unauthorized',
          forbidden: () => 'forbidden',
          tokenExpired: () => 'expired',
          rateLimited: () => 'limited',
        });
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Either helpers', () => {
    it('should mapSec transform Right value', () => {
      const either = right(10);
      const mapped = mapSec(either, (x) => x * 2);

      expect(isRight(mapped)).toBe(true);
      if (isRight(mapped)) {
        expect(mapped.right).toBe(20);
      }
    });

    it('should mapSec preserve Left error', () => {
      const error = createUnauthorizedError({});
      const either = left(error);
      const mapped = mapSec(either, (x) => x * 2);

      expect(isLeft(mapped)).toBe(true);
    });

    it('should flatMapSec chain Right values', () => {
      const either = right(10);
      const chained = flatMapSec(either, (x) => right(x * 2));

      expect(isRight(chained)).toBe(true);
      if (isRight(chained)) {
        expect(chained.right).toBe(20);
      }
    });
  });

  describe('Operational helpers', () => {
    it('should isRetryable return true for RateLimitedError', () => {
      const error = createRateLimitedError({ limit: 10, windowMs: 1000 });
      expect(isRetryable(error)).toBe(true);
    });

    it('should isRetryable return false for UnauthorizedError', () => {
      const error = createUnauthorizedError({});
      expect(isRetryable(error)).toBe(false);
    });

    it('should isRecoverable return true for TokenExpiredError', () => {
      const error = createTokenExpiredError({});
      expect(isRecoverable(error)).toBe(true);
    });

    it('should isRecoverable return false for UnauthorizedError', () => {
      const error = createUnauthorizedError({});
      expect(isRecoverable(error)).toBe(false);
    });
  });
});
