/**
 * Unit tests для ApplicationError
 *
 * Тесты для проверки создания application ошибок, ADT, pattern matching и валидации.
 */

import { describe, expect, it } from 'vitest';

import {
  createCommandRejectedError,
  createPermissionDeniedError,
  createQueryFailedError,
  matchApplicationError,
} from '../../../../src/errors/application/ApplicationError.js';
import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js';
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js';

import type { ApplicationError } from '../../../../src/errors/application/ApplicationError.js';
import type {
  CommandContext,
  PermissionContext,
  QueryContext,
} from '../../../../src/errors/application/ApplicationError.js';

describe('ApplicationError', () => {
  describe('createCommandRejectedError', () => {
    it('should create CommandRejectedError with correct structure', () => {
      const context: CommandContext = {
        commandName: 'CreateUser',
        commandId: 'cmd-123',
      };

      const error = createCommandRejectedError(context);

      expect(error._tag).toBe('CommandRejected');
      expect(error.commandName).toBe('CreateUser');
      expect(error.commandId).toBe('cmd-123');
      expect(error.code).toBe(ERROR_CODE.APPLICATION_COMMAND_REJECTED);
      expect(isBaseError(error)).toBe(true);
    });

    it('should create CommandRejectedError with reason', () => {
      const context: CommandContext = {
        commandName: 'UpdateOrder',
        reason: 'Order is already processed',
      };

      const error = createCommandRejectedError(context);

      expect(error._tag).toBe('CommandRejected');
      expect(error.reason).toBe('Order is already processed');
      expect(error.message).toContain('Order is already processed');
    });

    it('should create CommandRejectedError with correlationId', () => {
      const context: CommandContext = {
        commandName: 'DeleteItem',
        correlationId: 'req-456',
      };

      const error = createCommandRejectedError(context);

      expect(error._tag).toBe('CommandRejected');
      expect(error.correlationId).toBe('req-456');
    });
  });

  describe('createQueryFailedError', () => {
    it('should create QueryFailedError with correct structure', () => {
      const context: QueryContext = {
        queryName: 'GetUserById',
      };

      const error = createQueryFailedError(context);

      expect(error._tag).toBe('QueryFailed');
      expect(error.queryName).toBe('GetUserById');
      expect(error.code).toBe(ERROR_CODE.APPLICATION_QUERY_FAILED);
      expect(isBaseError(error)).toBe(true);
    });

    it('should create QueryFailedError with queryId and parameters', () => {
      const context: QueryContext = {
        queryName: 'SearchUsers',
        queryId: 'query-789',
        parameters: {
          filter: 'active',
          limit: 10,
        },
      };

      const error = createQueryFailedError(context);

      expect(error._tag).toBe('QueryFailed');
      expect(error.queryId).toBe('query-789');
    });

    it('should create QueryFailedError with correlationId', () => {
      const context: QueryContext = {
        queryName: 'ListOrders',
        correlationId: 'req-999',
      };

      const error = createQueryFailedError(context);

      expect(error._tag).toBe('QueryFailed');
      expect(error.correlationId).toBe('req-999');
    });
  });

  describe('createPermissionDeniedError', () => {
    it('should create PermissionDeniedError with correct structure', () => {
      const context: PermissionContext = {
        resource: 'user',
        action: 'delete',
      };

      const error = createPermissionDeniedError(context);

      expect(error._tag).toBe('PermissionDenied');
      expect(error.resource).toBe('user');
      expect(error.action).toBe('delete');
      expect(error.code).toBe(ERROR_CODE.APPLICATION_PERMISSION_DENIED);
      expect(isBaseError(error)).toBe(true);
    });

    it('should create PermissionDeniedError with userId', () => {
      const context: PermissionContext = {
        resource: 'order',
        action: 'update',
        userId: 'user-123',
      };

      const error = createPermissionDeniedError(context);

      expect(error._tag).toBe('PermissionDenied');
      expect(error.userId).toBe('user-123');
    });

    it('should create PermissionDeniedError with requiredPermission', () => {
      const context: PermissionContext = {
        resource: 'admin',
        action: 'access',
        requiredPermission: 'admin:full',
      };

      const error = createPermissionDeniedError(context);

      expect(error._tag).toBe('PermissionDenied');
      expect(error.requiredPermission).toBe('admin:full');
    });
  });

  describe('matchApplicationError - Pattern Matching', () => {
    it('should match CommandRejected error', () => {
      const error = createCommandRejectedError({
        commandName: 'CreateUser',
      });

      const result = matchApplicationError(error, {
        commandRejected: (e) => `Command rejected: ${e.commandName}`,
        queryFailed: () => 'query failed',
        permissionDenied: () => 'permission denied',
      });

      expect(result).toBe('Command rejected: CreateUser');
    });

    it('should match QueryFailed error', () => {
      const error = createQueryFailedError({
        queryName: 'GetUser',
      });

      const result = matchApplicationError(error, {
        commandRejected: () => 'command rejected',
        queryFailed: (e) => `Query failed: ${e.queryName}`,
        permissionDenied: () => 'permission denied',
      });

      expect(result).toBe('Query failed: GetUser');
    });

    it('should match PermissionDenied error', () => {
      const error = createPermissionDeniedError({
        resource: 'user',
        action: 'delete',
      });

      const result = matchApplicationError(error, {
        commandRejected: () => 'command rejected',
        queryFailed: () => 'query failed',
        permissionDenied: (e) => `Permission denied: ${e.action} on ${e.resource}`,
      });

      expect(result).toBe('Permission denied: delete on user');
    });

    it('should be exhaustive (TypeScript compile-time check)', () => {
      const error = createCommandRejectedError({
        commandName: 'Test',
      });

      const result = matchApplicationError(error, {
        commandRejected: () => 'rejected',
        queryFailed: () => 'failed',
        permissionDenied: () => 'denied',
      });

      expect(typeof result).toBe('string');
    });
  });

  describe('Type safety', () => {
    it('should have correct ApplicationError union type', () => {
      const errors: ApplicationError[] = [
        createCommandRejectedError({ commandName: 'Test' }),
        createQueryFailedError({ queryName: 'Test' }),
        createPermissionDeniedError({ resource: 'test', action: 'test' }),
      ];

      errors.forEach((error) => {
        expect(error._tag).toBeDefined();
        expect(isBaseError(error)).toBe(true);
      });
    });
  });
});
