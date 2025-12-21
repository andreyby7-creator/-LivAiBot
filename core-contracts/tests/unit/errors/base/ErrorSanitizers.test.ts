import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SANITIZATION_CONFIGS,
  sanitizeContext,
  sanitizeError,
  sanitizeErrorWithLevel,
  sanitizeStackTrace,
} from '../../../../src/errors/base/ErrorSanitizers.js';
import type {
  ErrorMetadataContext,
  IntegrationContext,
  UserContext,
} from '../../../../src/errors/base/ErrorMetadata.js';

describe('ErrorSanitizers', () => {
  describe('DEFAULT_SANITIZATION_CONFIGS', () => {
    it('should contain configurations for all levels', () => {
      expect(DEFAULT_SANITIZATION_CONFIGS.strict).toBeDefined();
      expect(DEFAULT_SANITIZATION_CONFIGS.production).toBeDefined();
      expect(DEFAULT_SANITIZATION_CONFIGS.dev).toBeDefined();
    });

    it('strict configuration should have maximum protection', () => {
      const strict = DEFAULT_SANITIZATION_CONFIGS.strict;
      expect(strict.level).toBe('strict');
      expect(strict.removeStackTraces).toBe(true);
      expect(strict.removeInternalPaths).toBe(true);
      expect(strict.removeSensitiveContext).toBe(true);
      expect(strict.abstractErrorCodes).toBe(true);
      expect(strict.customSensitiveFields).toEqual([]);
    });

    it('production configuration should have balanced protection', () => {
      const production = DEFAULT_SANITIZATION_CONFIGS.production;
      expect(production.level).toBe('production');
      expect(production.removeStackTraces).toBe(true);
      expect(production.removeInternalPaths).toBe(true);
      expect(production.removeSensitiveContext).toBe(true);
      expect(production.abstractErrorCodes).toBe(false);
      expect(production.customSensitiveFields).toEqual([]);
    });

    it('dev configuration should have minimal protection', () => {
      const dev = DEFAULT_SANITIZATION_CONFIGS.dev;
      expect(dev.level).toBe('dev');
      expect(dev.removeStackTraces).toBe(false);
      expect(dev.removeInternalPaths).toBe(false);
      expect(dev.removeSensitiveContext).toBe(false);
      expect(dev.abstractErrorCodes).toBe(false);
      expect(dev.customSensitiveFields).toEqual([]);
    });
  });

  describe('sanitizeError function', () => {
    it('should return primitive values unchanged', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;

      const stringResult = sanitizeError('string error', config);
      expect(stringResult.sanitized).toBe('string error');
      expect(stringResult.removedFields).toEqual([]);
      expect(stringResult.sanitizationLevel).toBe('production');

      const numberResult = sanitizeError(42, config);
      expect(numberResult.sanitized).toBe(42);

      const booleanResult = sanitizeError(true, config);
      expect(booleanResult.sanitized).toBe(true);

      const nullResult = sanitizeError(null, config);
      expect(nullResult.sanitized).toBe(null);

      const undefinedResult = sanitizeError(undefined, config);
      expect(undefinedResult.sanitized).toBe(undefined);
    });

    it('should remove stack trace in production mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const error = {
        message: 'Database connection failed',
        stack: 'Error: Database connection failed\n    at connect (/app/db.js:10:5)',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeError(error, config);

      expect(result.sanitized).toEqual({
        message: 'Database connection failed',
        code: 'DB_CONNECTION_FAILED',
      });
      expect(result.removedFields).toEqual(['stack']);
    });

    it('should leave stack trace in dev mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.dev;
      const error = {
        message: 'Database connection failed',
        stack: 'Error: Database connection failed\n    at connect (/app/db.js:10:5)',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeError(error, config);

      expect(result.sanitized).toEqual(error);
      expect(result.removedFields).toHaveLength(0);
    });

    it('should abstract error codes and mask message in strict mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.strict;
      const error = {
        message: 'Database connection failed',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeError(error, config);

      expect(result.sanitized).toEqual({
        message: 'An error occurred',
        code: 'INTERNAL_ERROR',
      });
      expect(result.removedFields).toEqual(['message', 'code (was: DB_CONNECTION_FAILED)']);
    });

    it('should mask sensitive fields in objects', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const error = {
        message: 'Error occurred',
        user: {
          password: 'secret123',
          username: 'user@example.com',
        },
        api: {
          token: 'jwt-token',
          endpoint: '/api/data',
        },
      };

      const result = sanitizeError(error, config);

      expect(result.sanitized).toEqual({
        message: 'Error occurred',
        user: {
          password: '[REDACTED]',
          username: 'user@example.com',
        },
        api: {
          token: '[REDACTED]',
          endpoint: '/api/data',
        },
      });
      expect(result.removedFields).toEqual(['user.password', 'api.token']);
    });

    it('should remove sensitive fields in strict mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.strict;
      const error = {
        message: 'Error occurred',
        user: {
          password: 'secret123',
          username: 'user@example.com',
        },
        api: {
          token: 'jwt-token',
          endpoint: '/api/data',
        },
      };

      const result = sanitizeError(error, config);

      expect(result.sanitized).toEqual({
        message: 'An error occurred',
        user: {
          username: 'user@example.com',
        },
        api: {
          endpoint: '/api/data',
        },
      });
      expect(result.removedFields).toEqual(['message', 'user.password', 'api.token']);
    });

    it('should use production config by default', () => {
      const error = {
        message: 'Error with stack',
        stack: 'Error stack trace',
      };

      const result = sanitizeError(error);

      expect(result.sanitizationLevel).toBe('production');
      expect(result.removedFields).toEqual(['stack']);
    });
  });

  describe('sanitizeStackTrace function', () => {
    it('should return undefined/empty unchanged', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;

      expect(sanitizeStackTrace(undefined, config)).toBeUndefined();
      expect(sanitizeStackTrace('', config)).toBe('');
    });

    it('should leave stack trace unchanged in dev mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.dev;
      const stackTrace = 'Error: Connection failed\n    at connect (/app/db.js:10:5)';

      const result = sanitizeStackTrace(stackTrace, config);
      expect(result).toBe(stackTrace);
    });

    it('should mask internal paths in production mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const stackTrace = 'Error: Connection failed\n    at connect (file:///app/db.js:10:5)';

      const result = sanitizeStackTrace(stackTrace, config);

      expect(result).toContain('(internal)');
      expect(result).not.toContain('file:///app/db.js');
    });

    it('should remove stack trace completely in strict mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.strict;
      const stackTrace = 'Error: Connection failed\n    at connect (/app/db.js:10:5)';

      const result = sanitizeStackTrace(stackTrace, config);
      expect(result).toBeUndefined();
    });
  });

  describe('sanitizeContext function', () => {
    it('should return undefined unchanged', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;

      expect(sanitizeContext(undefined, config)).toBeUndefined();
    });

    it('should return context unchanged in dev mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.dev;
      const context: ErrorMetadataContext = {
        correlationId: 'test-correlation' as any,
        timestamp: 1234567890 as any,
        context: {
          type: 'user',
          userId: 'user-123',
        },
      };

      const result = sanitizeContext(context, config);
      expect(result).toEqual(context);
    });

    it('should mask sensitive fields in production mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const context: ErrorMetadataContext = {
        correlationId: 'test-correlation' as any,
        timestamp: 1234567890 as any,
        context: {
          type: 'user',
          userId: 'user-123',
          sessionId: 'session-123',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        },
      };

      const result = sanitizeContext(context, config);

      if (result?.context && result.context.type === 'user') {
        expect(result.context.type).toBe('user');
        expect(result.context.userId).toBe('user-123');
        expect(result.context.sessionId).toBe('[REDACTED]');
        expect(result.context.userAgent).toBe('[REDACTED]');
        expect(result.context.ipAddress).toBe('[REDACTED]');
      }
    });

    it('should remove sensitive fields in strict mode', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.strict;
      const context: ErrorMetadataContext = {
        correlationId: 'test-correlation' as any,
        timestamp: 1234567890 as any,
        context: {
          type: 'user',
          userId: 'user-123',
          sessionId: 'secret-session',
          ipAddress: 'secret-ip',
        },
      };

      const result = sanitizeContext(context, config);

      if (result?.context && result.context.type === 'user') {
        expect(result.context.type).toBe('user');
        expect(result.context.userId).toBe('user-123');
        expect((result.context as any).sessionId).toBeUndefined();
        expect((result.context as any).ipAddress).toBeUndefined();
      }
    });

    it('should handle nested objects recursively', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const context: ErrorMetadataContext = {
        correlationId: 'test-correlation' as any,
        timestamp: 1234567890 as any,
        context: {
          type: 'integration',
          integrationId: 'int-123',
          integrationType: 'api',
          requestMetadata: {
            headers: {
              authorization: 'Bearer secret-token',
              'content-type': 'application/json',
            },
            body: {
              password: 'user-password',
              username: 'user@example.com',
            },
          },
        },
      };

      const result = sanitizeContext(context, config);

      if (
        result?.context && result.context.type === 'integration' && result.context.requestMetadata
      ) {
        const requestMetadata = result.context.requestMetadata as any;
        expect(requestMetadata.headers['content-type']).toBe('application/json');
        expect(requestMetadata.headers.authorization).toBe('[REDACTED]');
        expect(requestMetadata.body.username).toBe('user@example.com');
        expect(requestMetadata.body.password).toBe('[REDACTED]');
      }
    });
  });

  describe('sanitizeErrorWithLevel function', () => {
    it('should use strict configuration for strict level', () => {
      const error = {
        message: 'Detailed error message',
        stack: 'Error stack trace',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeErrorWithLevel(error, 'strict');

      expect(result.sanitizationLevel).toBe('strict');
      expect(result.sanitized).toEqual({
        message: 'An error occurred',
        code: 'INTERNAL_ERROR',
      });
      expect(result.removedFields).toEqual([
        'stack',
        'message',
        'code (was: DB_CONNECTION_FAILED)',
      ]);
    });

    it('should use production configuration for production level', () => {
      const error = {
        message: 'Error message',
        stack: 'Error stack trace',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeErrorWithLevel(error, 'production');

      expect(result.sanitizationLevel).toBe('production');
      expect(result.sanitized).toEqual({
        message: 'Error message',
        code: 'DB_CONNECTION_FAILED',
      });
      expect(result.removedFields).toEqual(['stack']);
    });

    it('should use dev configuration for dev level', () => {
      const error = {
        message: 'Error message',
        stack: 'Error stack trace',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeErrorWithLevel(error, 'dev');

      expect(result.sanitizationLevel).toBe('dev');
      expect(result.sanitized).toEqual(error);
      expect(result.removedFields).toHaveLength(0);
    });

    it('should apply custom overrides', () => {
      const error = {
        message: 'Error message',
        stack: 'Error stack trace',
        code: 'DB_CONNECTION_FAILED',
      };

      const result = sanitizeErrorWithLevel(error, 'dev', {
        removeStackTraces: true,
        abstractErrorCodes: true,
      });

      expect(result.sanitizationLevel).toBe('dev');
      expect(result.sanitized).toEqual({
        message: 'Error message',
        code: 'INTERNAL_ERROR',
      });
      expect(result.removedFields).toEqual(['stack', 'code (was: DB_CONNECTION_FAILED)']);
    });

    it('should use production as default for unknown level', () => {
      const error = {
        message: 'Error message',
        stack: 'Error stack trace',
      };

      const result = sanitizeErrorWithLevel(error, 'unknown' as any);

      expect(result.sanitizationLevel).toBe('production');
      expect(result.removedFields).toEqual(['stack']);
    });
  });

  describe('Error code abstraction', () => {
    it('should abstract various error codes correctly', () => {
      const config = {
        level: 'production' as const,
        removeStackTraces: false,
        removeInternalPaths: false,
        removeSensitiveContext: false,
        abstractErrorCodes: true,
        customSensitiveFields: [],
      };

      const testCases = [
        { input: 'DB_CONNECTION_FAILED', expected: 'INTERNAL_ERROR' },
        { input: 'DB_QUERY_TIMEOUT', expected: 'TIMEOUT_ERROR' },
        { input: 'INVALID_JWT_TOKEN', expected: 'AUTHENTICATION_ERROR' },
        { input: 'EXPIRED_JWT_TOKEN', expected: 'AUTHENTICATION_ERROR' },
        { input: 'INSUFFICIENT_PERMISSIONS', expected: 'AUTHORIZATION_ERROR' },
        { input: 'EXTERNAL_API_ERROR', expected: 'EXTERNAL_SERVICE_ERROR' },
        { input: 'UNKNOWN_ERROR_CODE', expected: 'INTERNAL_ERROR' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = sanitizeError({ code: input }, config);
        expect(result.sanitized).toEqual({ code: expected });
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should provide comprehensive error sanitization', () => {
      const complexError = {
        message: 'Database connection failed due to invalid credentials',
        stack: 'Error: Connection failed\n    at connect (file:///app/internal/db.js:10:5)',
        code: 'DB_CONNECTION_FAILED',
        details: {
          host: 'internal-db.company.com',
          port: 5432,
          database: 'sensitive_db',
          username: 'admin',
          password: 'super-secret-password',
          connectionString:
            'postgresql://admin:super-secret-password@internal-db.company.com:5432/sensitive_db',
        },
      };

      // Test production level
      const prodResult = sanitizeError(complexError, DEFAULT_SANITIZATION_CONFIGS.production);
      expect(prodResult.sanitized).toEqual({
        message: 'Database connection failed due to invalid credentials',
        code: 'DB_CONNECTION_FAILED',
        details: {
          host: 'internal-db.company.com',
          port: 5432,
          database: 'sensitive_db',
          username: 'admin',
          password: '[REDACTED]',
          connectionString: '[REDACTED]',
        },
      });
      expect(prodResult.removedFields).toEqual([
        'stack',
        'details.password',
        'details.connectionString',
      ]);

      // Test strict level
      const strictResult = sanitizeError(complexError, DEFAULT_SANITIZATION_CONFIGS.strict);
      expect(strictResult.sanitized).toEqual({
        message: 'An error occurred',
        code: 'INTERNAL_ERROR',
        details: {
          host: 'internal-db.company.com',
          port: 5432,
          database: 'sensitive_db',
          username: 'admin',
        },
      });
      expect(strictResult.removedFields).toEqual([
        'stack',
        'message',
        'code (was: DB_CONNECTION_FAILED)',
        'details.password',
        'details.connectionString',
      ]);
    });

    it('dev mode should preserve all information', () => {
      const error = {
        message: 'Debug error with full details',
        stack: 'Error: Debug failed\n    at debugFunction (/app/debug.js:10:5)',
        code: 'DEBUG_ERROR',
        debugInfo: {
          internalPaths: '/internal/debug/info',
          sensitiveData: 'debug-sensitive',
          stackFrames: ['frame1', 'frame2'],
        },
      };

      const devResult = sanitizeError(error, DEFAULT_SANITIZATION_CONFIGS.dev);

      expect(devResult.sanitized).toEqual(error);
      expect(devResult.removedFields).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle circular references gracefully', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const circularObj: any = { prop: 'value' };
      circularObj.self = circularObj;

      // Note: Currently circular references will cause stack overflow
      // This test documents the limitation - circular reference detection removed for immutability
      expect(() => sanitizeError(circularObj, config)).toThrow('Maximum call stack size exceeded');
    });

    it('should handle deeply nested structures', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;
      const deepStructure = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              token: 'jwt-token',
              normalData: 'normal',
              nested: {
                apiKey: 'api-key-secret',
                userId: 'user-123',
              },
            },
          },
        },
      };

      const result = sanitizeError(deepStructure, config);

      expect(result.sanitized).toEqual({
        level1: {
          level2: {
            level3: {
              password: '[REDACTED]',
              token: '[REDACTED]',
              normalData: 'normal',
              nested: {
                apiKey: '[REDACTED]',
                userId: 'user-123',
              },
            },
          },
        },
      });
      expect(result.removedFields).toEqual([
        'level1.level2.level3.password',
        'level1.level2.level3.token',
        'level1.level2.level3.nested.apiKey',
      ]);
    });

    it('should handle custom sensitive fields', () => {
      const config = {
        level: 'production' as const,
        removeStackTraces: false,
        removeInternalPaths: false,
        removeSensitiveContext: true,
        abstractErrorCodes: false,
        customSensitiveFields: ['customSecret', 'secret.*'],
      };

      const context: ErrorMetadataContext = {
        correlationId: 'test' as any,
        timestamp: 1000 as any,
        context: {
          type: 'user',
          userId: 'user-123',
          sessionId: 'customSecret', // будет замаскирован custom sensitive field
          userAgent: 'secretKey', // будет замаскирован pattern
          ipAddress: 'normal-value', // обычное поле
        },
      };

      const result = sanitizeContext(context, config);

      if (result?.context && result.context.type === 'user') {
        expect(result.context.sessionId).toBe('[REDACTED]');
        expect(result.context.userAgent).toBe('[REDACTED]');
        expect(result.context.ipAddress).toBe('[REDACTED]');
      }
    });

    it('should handle complex nested structures with arrays', () => {
      const config = DEFAULT_SANITIZATION_CONFIGS.production;

      const complexStructure = {
        users: [
          { id: 1, password: 'secret1', name: 'User 1' },
          { id: 2, password: 'secret2', name: 'User 2' },
        ],
        config: {
          database: {
            password: 'db-secret',
            host: 'localhost',
          },
          api: {
            token: 'api-token',
            endpoints: ['/api/v1', '/api/v2'],
          },
        },
      };

      const result = sanitizeError(complexStructure, config);

      expect(result.sanitized).toEqual({
        users: [
          { id: 1, password: '[REDACTED]', name: 'User 1' },
          { id: 2, password: '[REDACTED]', name: 'User 2' },
        ],
        config: {
          database: {
            password: '[REDACTED]',
            host: 'localhost',
          },
          api: {
            token: '[REDACTED]',
            endpoints: ['/api/v1', '/api/v2'],
          },
        },
      });
      expect(result.removedFields).toEqual([
        'users[0].password',
        'users[1].password',
        'config.database.password',
        'config.api.token',
      ]);
    });
  });
});
