/**
 * Unit tests для ApplicationErrorMeta
 *
 * Тесты для проверки helpers работы с метаданными application ошибок.
 */

import { describe, expect, it } from 'vitest';

import {
  createCommandRejectedError,
  createPermissionDeniedError,
  createQueryFailedError,
} from '../../../../src/errors/application/ApplicationError.js';
import {
  getApplicationErrorCategory,
  getApplicationErrorMeta,
  getApplicationErrorSeverity,
  isApplicationErrorRetryable,
} from '../../../../src/errors/application/ApplicationErrorMeta.js';
import { ERROR_CATEGORY, ERROR_SEVERITY } from '../../../../src/errors/base/ErrorConstants.js';

describe('ApplicationErrorMeta', () => {
  describe('getApplicationErrorMeta', () => {
    it('should return metadata for CommandRejectedError', () => {
      const error = createCommandRejectedError({
        commandName: 'CreateUser',
      });

      const meta = getApplicationErrorMeta(error);

      expect(meta).toBeDefined();
      expect(meta?.layer).toBe('application');
      expect(meta?.category).toBe('business');
    });

    it('should return metadata for QueryFailedError', () => {
      const error = createQueryFailedError({
        queryName: 'GetUser',
      });

      const meta = getApplicationErrorMeta(error);

      expect(meta).toBeDefined();
      expect(meta?.layer).toBe('application');
      expect(meta?.kind).toBe('query');
    });

    it('should return metadata for PermissionDeniedError', () => {
      const error = createPermissionDeniedError({
        resource: 'user',
        action: 'delete',
      });

      const meta = getApplicationErrorMeta(error);

      expect(meta).toBeDefined();
      expect(meta?.layer).toBe('application');
      expect(meta?.category).toBe('authorization');
    });
  });

  describe('isApplicationErrorRetryable', () => {
    it('should return false for CommandRejectedError (not retryable)', () => {
      const error = createCommandRejectedError({
        commandName: 'CreateUser',
      });

      expect(isApplicationErrorRetryable(error)).toBe(false);
    });

    it('should return true for QueryFailedError (retryable)', () => {
      const error = createQueryFailedError({
        queryName: 'GetUser',
      });

      expect(isApplicationErrorRetryable(error)).toBe(true);
    });

    it('should return false for PermissionDeniedError (not retryable)', () => {
      const error = createPermissionDeniedError({
        resource: 'user',
        action: 'delete',
      });

      expect(isApplicationErrorRetryable(error)).toBe(false);
    });
  });

  describe('getApplicationErrorSeverity', () => {
    it('should return severity for CommandRejectedError', () => {
      const error = createCommandRejectedError({
        commandName: 'CreateUser',
      });

      const severity = getApplicationErrorSeverity(error);

      expect(severity).toBeDefined();
      expect(severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('should return MEDIUM severity for QueryFailedError', () => {
      const error = createQueryFailedError({
        queryName: 'GetUser',
      });

      const severity = getApplicationErrorSeverity(error);

      expect(severity).toBeDefined();
      expect(severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    it('should return HIGH severity for PermissionDeniedError', () => {
      const error = createPermissionDeniedError({
        resource: 'user',
        action: 'delete',
      });

      const severity = getApplicationErrorSeverity(error);

      expect(severity).toBeDefined();
      expect(severity).toBe(ERROR_SEVERITY.HIGH);
    });
  });

  describe('getApplicationErrorCategory', () => {
    it('should return BUSINESS category for CommandRejectedError', () => {
      const error = createCommandRejectedError({
        commandName: 'CreateUser',
      });

      const category = getApplicationErrorCategory(error);

      expect(category).toBeDefined();
      expect(category).toBe(ERROR_CATEGORY.BUSINESS);
    });

    it('should return BUSINESS category for QueryFailedError', () => {
      const error = createQueryFailedError({
        queryName: 'GetUser',
      });

      const category = getApplicationErrorCategory(error);

      expect(category).toBeDefined();
      expect(category).toBe(ERROR_CATEGORY.BUSINESS);
    });

    it('should return AUTHORIZATION category for PermissionDeniedError', () => {
      const error = createPermissionDeniedError({
        resource: 'user',
        action: 'delete',
      });

      const category = getApplicationErrorCategory(error);

      expect(category).toBeDefined();
      expect(category).toBe(ERROR_CATEGORY.AUTHORIZATION);
    });
  });
});
