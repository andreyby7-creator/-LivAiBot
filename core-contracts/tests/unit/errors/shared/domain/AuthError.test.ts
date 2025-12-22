import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { ErrorCode } from '../../../../../src/errors/base/ErrorCode';
import {
  createAuthError,
  getAuthDeviceInfo,
  getAuthErrorReason,
  getAuthRequiredPermissions,
  getAuthUserId,
  getAuthUserPermissions,
  getGeoLocation,
  getRateLimitInfo,
  isAuthError,
  isInsufficientPermissions,
  isMFARequiredError,
  isRateLimitedError,
  isRateLimitError,
  isTokenRelatedError,
  requiresMFA,
} from '../../../../../src/errors/shared/domain/AuthError';
import type {
  AuthError,
  AuthErrorContext,
} from '../../../../../src/errors/shared/domain/AuthError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock AuthErrorContext для тестов */
function createMockAuthContext(): AuthErrorContext {
  return {
    type: 'user', // для ErrorMetadataDomainContext
    userId: 'user-123', // из UserContext
    sessionId: 'session-789', // из UserContext
    correlationId: 'corr-456', // из base context
    authType: 'password' as const,
    reason: 'invalid_credentials' as const,
    requiredPermissions: ['read:user', 'write:user', 'delete:user'],
    userPermissions: ['read:user', 'write:user'],
    resource: '/api/users',
    action: 'write',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    requestId: 'req-def',
  } as AuthErrorContext;
}

/** Создает mock AuthError для тестов */
function createMockAuthError(
  code: ErrorCode = DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
  message: string = 'Authentication failed',
  context?: AuthErrorContext,
  timestamp?: string,
): AuthError {
  return createAuthError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('AuthError', () => {
  describe('createAuthError', () => {
    it('создает AuthError с минимальными обязательными полями', () => {
      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Authentication failed',
      );

      expect(error).toEqual({
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Authentication failed',
        timestamp: expect.any(String),
      });

      expect(isAuthError(error)).toBe(true);
    });

    it('создает AuthError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Authentication failed',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isAuthError(error)).toBe(true);
    });

    it('создает AuthError с полным контекстом аутентификации', () => {
      const context = createMockAuthContext();
      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Invalid credentials',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS);
      expect(error.message).toBe('Invalid credentials');
      expect(error.severity).toBe(ERROR_SEVERITY.HIGH); // Auth errors are HIGH severity
    });

    it('создает AuthError с различными типами аутентификации', () => {
      const authTypes = ['password', 'token', 'oauth', 'sso', 'api_key'];

      authTypes.forEach((authType) => {
        const context: AuthErrorContext = {
          type: 'user',
          userId: 'test-user',
          operation: 'authenticate',
          authType,
          reason: 'invalid_credentials',
        } as AuthErrorContext;

        const error = createAuthError(
          DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          `Authentication failed via ${authType}`,
          context,
        );

        expect(error.details?.authType).toBe(authType);
      });
    });

    it('создает AuthError с различными причинами отказов', () => {
      const reasons: AuthErrorContext['reason'][] = [
        'invalid_credentials',
        'token_expired',
        'token_invalid',
        'insufficient_permissions',
        'account_locked',
        'account_disabled',
      ];

      reasons.forEach((reason) => {
        const context: AuthErrorContext = {
          type: 'user',
          userId: 'test-user',
          operation: 'authorize',
          reason,
        } as AuthErrorContext;

        const error = createAuthError(
          DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          `Auth failed: ${reason}`,
          context,
        );

        expect(error.details?.reason).toBe(reason);
      });
    });
  });

  describe('isAuthError', () => {
    it('возвращает true для AuthError', () => {
      const error = createMockAuthError();
      expect(isAuthError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'ValidationError', message: 'Validation failed' },
        { _tag: 'PermissionError', message: 'Permission denied' },
        null,
        undefined,
        'string error',
        42,
      ];

      otherErrors.forEach((error) => {
        expect(isAuthError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов без _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.SECURITY,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным _tag', () => {
      const invalidError = {
        _tag: 'WrongError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с правильным _tag но неправильной category', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.BUSINESS, // неправильная category
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным authType в details', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          operation: 'login',
          authType: 'invalid_type', // невалидный authType
        } as unknown as AuthErrorContext,
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает true для объектов с валидным authType в details', () => {
      const validError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          authType: 'password', // валидный authType
        } as AuthErrorContext,
      };

      expect(isAuthError(validError)).toBe(true);
    });

    it('возвращает false для объектов с правильным _tag но неправильным origin', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.INFRASTRUCTURE, // неправильный origin
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с правильным _tag но неправильным severity', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.LOW, // неправильный severity
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов без code', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов без message', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов без timestamp', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным details', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 123, // неправильный тип userId (число вместо строки)
        } as unknown as AuthErrorContext,
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с authType неправильного типа', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          authType: 123, // неправильный тип authType (число вместо строки)
        } as unknown as AuthErrorContext,
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с mfaRequired неправильного типа', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          mfaRequired: 'yes', // неправильный тип mfaRequired (строка вместо boolean)
        } as unknown as AuthErrorContext,
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с mfaVerified неправильного типа', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          mfaVerified: 1, // неправильный тип mfaVerified (число вместо boolean)
        } as unknown as AuthErrorContext,
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с reason неправильного типа', () => {
      const invalidError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          reason: 123, // неправильный тип reason (число вместо строки)
        } as unknown as AuthErrorContext,
      };

      expect(isAuthError(invalidError)).toBe(false);
    });

    it('возвращает true для объектов с валидным details', () => {
      const validError = {
        _tag: 'AuthError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Auth failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          authType: 'password',
        } as AuthErrorContext,
      };

      expect(isAuthError(validError)).toBe(true);
    });
  });

  describe('getAuthErrorReason', () => {
    it('извлекает причину ошибки аутентификации из AuthError', () => {
      const context = createMockAuthContext();
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Authentication failed',
        context,
      );

      const reason = getAuthErrorReason(error);
      expect(reason).toBe('invalid_credentials');
    });

    it('возвращает undefined если причина не указана', () => {
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Authentication failed',
      );

      const reason = getAuthErrorReason(error);
      expect(reason).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockAuthError();
      delete (error as any).details;

      const reason = getAuthErrorReason(error);
      expect(reason).toBeUndefined();
    });
  });

  describe('getAuthUserId', () => {
    it('извлекает ID пользователя из AuthError', () => {
      const context = createMockAuthContext();
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Authentication failed',
        context,
      );

      const userId = getAuthUserId(error);
      expect(userId).toBe('user-123');
    });

    it('возвращает undefined если userId не указан', () => {
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Authentication failed',
      );

      const userId = getAuthUserId(error);
      expect(userId).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockAuthError();
      delete (error as any).details;

      const userId = getAuthUserId(error);
      expect(userId).toBeUndefined();
    });
  });

  describe('isInsufficientPermissions', () => {
    it('возвращает true для ошибок insufficient_permissions', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authorize',
        reason: 'insufficient_permissions',
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Insufficient permissions',
        context,
      );

      expect(isInsufficientPermissions(error)).toBe(true);
    });

    it('возвращает false для других причин ошибок', () => {
      const reasons: AuthErrorContext['reason'][] = [
        'invalid_credentials',
        'token_expired',
        'token_invalid',
        'account_locked',
        'account_disabled',
      ];

      reasons.forEach((reason) => {
        const context: AuthErrorContext = {
          type: 'user',
          userId: 'test-user',
          operation: 'authorize',
          reason,
        } as AuthErrorContext;

        const error = createAuthError(
          DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          'Auth failed',
          context,
        );

        expect(isInsufficientPermissions(error)).toBe(false);
      });
    });

    it('возвращает false если причина не указана', () => {
      const error = createMockAuthError();

      expect(isInsufficientPermissions(error)).toBe(false);
    });
  });

  describe('isTokenRelatedError', () => {
    it('возвращает true для ошибок токенов', () => {
      const tokenReasons: AuthErrorContext['reason'][] = [
        'token_expired',
        'token_invalid',
        'token_missing',
      ];

      tokenReasons.forEach((reason) => {
        const context: AuthErrorContext = {
          type: 'user',
          userId: 'test-user',
          operation: 'authenticate',
          reason,
        } as AuthErrorContext;

        const error = createAuthError(
          DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          'Token error',
          context,
        );

        expect(isTokenRelatedError(error)).toBe(true);
      });
    });

    it('возвращает false для не токенных ошибок', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authenticate',
        reason: 'invalid_credentials',
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Invalid credentials',
        context,
      );

      expect(isTokenRelatedError(error)).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('возвращает true для rate limit ошибок', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authenticate',
        reason: 'rate_limit_exceeded',
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Rate limit exceeded',
        context,
      );

      expect(isRateLimitError(error)).toBe(true);
    });

    it('возвращает false для других ошибок', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authenticate',
        reason: 'invalid_credentials',
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Invalid credentials',
        context,
      );

      expect(isRateLimitError(error)).toBe(false);
    });
  });

  describe('getGeoLocation', () => {
    it('извлекает геолокацию из ошибки', () => {
      const geoLocation = {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      };

      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authenticate',
        geoLocation,
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Auth failed',
        context,
      );

      expect(getGeoLocation(error)).toEqual(geoLocation);
    });

    it('возвращает undefined если геолокация не указана', () => {
      const error = createMockAuthError();

      expect(getGeoLocation(error)).toBeUndefined();
    });
  });

  describe('requiresMFA', () => {
    it('возвращает true если MFA требуется', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authenticate',
        mfaRequired: true,
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'MFA required',
        context,
      );

      expect(requiresMFA(error)).toBe(true);
    });

    it('возвращает false если MFA не требуется', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'authenticate',
        mfaRequired: false,
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Auth failed',
        context,
      );

      expect(requiresMFA(error)).toBe(false);
    });

    it('возвращает false если mfaRequired не указано', () => {
      const error = createMockAuthError();

      expect(requiresMFA(error)).toBe(false);
    });
  });

  describe('isMFARequiredError', () => {
    it('возвращает true для ошибок с mfaRequired: true', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'login',
        mfaRequired: true,
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'MFA required',
        context,
      );

      expect(isMFARequiredError(error)).toBe(true);
    });

    it('возвращает false для ошибок с mfaRequired: false', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'login',
        mfaRequired: false,
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Auth failed',
        context,
      );

      expect(isMFARequiredError(error)).toBe(false);
    });

    it('возвращает false если mfaRequired не указано', () => {
      const error = createMockAuthError();

      expect(isMFARequiredError(error)).toBe(false);
    });
  });

  describe('isRateLimitedError', () => {
    it('возвращает true для ошибок с reason: rate_limit_exceeded', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        operation: 'login',
        reason: 'rate_limit_exceeded',
      } as AuthErrorContext;

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Rate limit exceeded',
        context,
      );

      expect(isRateLimitedError(error)).toBe(true);
    });

    it('возвращает false для других причин ошибок', () => {
      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        reason: 'invalid_credentials',
      };

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Invalid credentials',
        context,
      );

      expect(isRateLimitedError(error)).toBe(false);
    });

    it('возвращает false если reason не указан', () => {
      const error = createMockAuthError();

      expect(isRateLimitedError(error)).toBe(false);
    });
  });

  describe('getAuthRequiredPermissions', () => {
    it('извлекает требуемые права доступа из AuthError', () => {
      const context = createMockAuthContext();
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
        context,
      );

      const required = getAuthRequiredPermissions(error);
      expect(required).toEqual(['read:user', 'write:user', 'delete:user']);
    });

    it('возвращает undefined если требуемые права не указаны', () => {
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
      );

      const required = getAuthRequiredPermissions(error);
      expect(required).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockAuthError();
      delete (error as any).details;

      const required = getAuthRequiredPermissions(error);
      expect(required).toBeUndefined();
    });
  });

  describe('getAuthUserPermissions', () => {
    it('извлекает права пользователя из AuthError', () => {
      const context = createMockAuthContext();
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
        context,
      );

      const userPermissions = getAuthUserPermissions(error);
      expect(userPermissions).toEqual(['read:user', 'write:user']);
    });

    it('возвращает undefined если права пользователя не указаны', () => {
      const error = createMockAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
      );

      const userPermissions = getAuthUserPermissions(error);
      expect(userPermissions).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockAuthError();
      delete (error as any).details;

      const userPermissions = getAuthUserPermissions(error);
      expect(userPermissions).toBeUndefined();
    });
  });

  describe('getAuthDeviceInfo', () => {
    it('извлекает информацию об устройстве из AuthError', () => {
      const deviceInfo = {
        fingerprint: 'abc123',
        platform: 'web',
        browser: 'Chrome',
      };

      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        deviceInfo,
      };

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Device check failed',
        context,
      );

      expect(getAuthDeviceInfo(error)).toEqual(deviceInfo);
    });

    it('возвращает undefined если информация об устройстве не указана', () => {
      const error = createMockAuthError();

      expect(getAuthDeviceInfo(error)).toBeUndefined();
    });
  });

  describe('getRateLimitInfo', () => {
    it('извлекает информацию о rate limiting из AuthError', () => {
      const rateLimitInfo = {
        attempts: 5,
        limit: 10,
        resetTime: Date.now() + 60000,
      };

      const context: AuthErrorContext = {
        type: 'user',
        userId: 'test-user',
        reason: 'rate_limit_exceeded',
        rateLimitInfo,
      };

      const error = createAuthError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Rate limit exceeded',
        context,
      );

      expect(getRateLimitInfo(error)).toEqual(rateLimitInfo);
    });

    it('возвращает undefined если информация о rate limiting не указана', () => {
      const error = createMockAuthError();

      expect(getRateLimitInfo(error)).toBeUndefined();
    });
  });

  describe('AuthError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockAuthError();

      expect(error).toHaveProperty('_tag', 'AuthError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.SECURITY);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.DOMAIN);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.HIGH); // Auth errors are HIGH
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });

    it('AuthErrorContext содержит все необходимые поля для аутентификации', () => {
      const context = createMockAuthContext();

      expect(context).toHaveProperty('userId');
      expect(context).toHaveProperty('authType');
      expect(context).toHaveProperty('reason');
      expect(context).toHaveProperty('requiredPermissions');
      expect(context).toHaveProperty('userPermissions');
      expect(context).toHaveProperty('resource');
      expect(context).toHaveProperty('action');
      expect(context).toHaveProperty('ipAddress');
      expect(context).toHaveProperty('userAgent');
      expect(context).toHaveProperty('correlationId');
      expect(context).toHaveProperty('sessionId');
      expect(context).toHaveProperty('requestId');
    });
  });
});
