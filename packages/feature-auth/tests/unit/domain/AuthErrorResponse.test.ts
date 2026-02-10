/**
 * @file Unit тесты для domain/AuthErrorResponse.ts
 * Полное покрытие типов ошибок аутентификации и авторизации
 */

import { describe, expect, it } from 'vitest';
import type { AuthErrorResponse, AuthErrorType } from '../../../src/domain/AuthErrorResponse.js';
import { authErrorResponseSchema } from '../../../src/schemas.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createAuthErrorResponse(
  error: AuthErrorType,
  overrides: Partial<AuthErrorResponse> = {},
): AuthErrorResponse {
  return {
    error,
    message: `Error: ${error}`,
    ...overrides,
  };
}

function createMinimalAuthErrorResponse(error: AuthErrorType): AuthErrorResponse {
  return {
    error,
  };
}

function createFullAuthErrorResponse(
  error: AuthErrorType,
  overrides: Partial<AuthErrorResponse> = {},
): AuthErrorResponse {
  return {
    error,
    message: `Detailed error message for ${error}`,
    retryable: true,
    statusCode: 401,
    userId: 'user-123',
    correlationId: 'corr-abc-123',
    timestamp: '2026-01-15T10:30:00.000Z',
    context: {
      remainingAttempts: 3,
      lockoutDuration: 300,
      riskScore: 75,
    },
    ...overrides,
  };
}

// ============================================================================
// 🎯 AUTH ERROR TYPES - Типы ошибок
// ============================================================================

describe('AuthErrorType enum coverage', () => {
  const allErrorTypes: AuthErrorType[] = [
    'invalid_credentials',
    'account_locked',
    'account_disabled',
    'email_not_verified',
    'phone_not_verified',
    'mfa_required',
    'mfa_failed',
    'rate_limited',
    'session_expired',
    'session_revoked',
    'token_invalid',
    'token_expired',
    'permission_denied',
    'risk_blocked',
    'conflict',
    'unknown_error',
  ];

  it('поддерживает все типы ошибок аутентификации', () => {
    allErrorTypes.forEach((errorType) => {
      const error = createMinimalAuthErrorResponse(errorType);
      expect(error.error).toBe(errorType);
    });
  });

  it('каждый тип ошибки имеет правильную структуру', () => {
    // Credential errors
    const invalidCredentials = createAuthErrorResponse('invalid_credentials');
    expect(invalidCredentials.error).toBe('invalid_credentials');

    // Account errors
    const accountLocked = createAuthErrorResponse('account_locked', {
      message: 'Account is locked',
      retryable: false,
    });
    expect(accountLocked.error).toBe('account_locked');
    expect(accountLocked.retryable).toBe(false);

    // Verification errors
    const emailNotVerified = createAuthErrorResponse('email_not_verified', {
      message: 'Email not verified',
      retryable: true,
    });
    expect(emailNotVerified.error).toBe('email_not_verified');
    expect(emailNotVerified.retryable).toBe(true);

    // MFA errors
    const mfaRequired = createAuthErrorResponse('mfa_required', {
      message: 'MFA required',
      context: { mfaType: 'totp' },
    });
    expect(mfaRequired.error).toBe('mfa_required');
    expect(mfaRequired.context?.['mfaType']).toBe('totp');

    // Token errors
    const tokenExpired = createAuthErrorResponse('token_expired', {
      message: 'Token expired',
      retryable: true,
    });
    expect(tokenExpired.error).toBe('token_expired');
    expect(tokenExpired.retryable).toBe(true);

    // Session errors
    const sessionExpired = createAuthErrorResponse('session_expired', {
      message: 'Session expired',
      retryable: true,
    });
    expect(sessionExpired.error).toBe('session_expired');

    // Rate limiting errors
    const rateLimited = createAuthErrorResponse('rate_limited', {
      message: 'Too many requests',
      retryable: true,
      context: { retryAfter: 60 },
    });
    expect(rateLimited.error).toBe('rate_limited');
    expect(rateLimited.context?.['retryAfter']).toBe(60);

    // Risk errors
    const riskBlocked = createAuthErrorResponse('risk_blocked', {
      message: 'Blocked due to risk assessment',
      retryable: false,
      context: { riskScore: 95 },
    });
    expect(riskBlocked.error).toBe('risk_blocked');
    expect(riskBlocked.retryable).toBe(false);
    expect(riskBlocked.context?.['riskScore']).toBe(95);
  });
});

// ============================================================================
// 📋 AUTH ERROR RESPONSE DTO - Полный DTO
// ============================================================================

describe('AuthErrorResponse полный DTO', () => {
  it('создает минимальное сообщение об ошибке с обязательными полями', () => {
    const error = createMinimalAuthErrorResponse('invalid_credentials');

    expect(error.error).toBe('invalid_credentials');
    expect(error.message).toBeUndefined();
    expect(error.retryable).toBeUndefined();
    expect(error.statusCode).toBeUndefined();
    expect(error.userId).toBeUndefined();
    expect(error.correlationId).toBeUndefined();
    expect(error.timestamp).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it('создает полное сообщение об ошибке со всеми полями', () => {
    const error = createFullAuthErrorResponse('invalid_credentials', {
      message: 'Invalid email or password',
      retryable: true,
      statusCode: 401,
      userId: 'user-456',
      correlationId: 'trace-789',
      timestamp: '2026-01-15T12:00:00.000Z',
      context: {
        remainingAttempts: 2,
        lockoutDuration: 600,
        lastAttempt: '2026-01-15T11:55:00.000Z',
      },
    });

    expect(error.error).toBe('invalid_credentials');
    expect(error.message).toBe('Invalid email or password');
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBe(401);
    expect(error.userId).toBe('user-456');
    expect(error.correlationId).toBe('trace-789');
    expect(error.timestamp).toBe('2026-01-15T12:00:00.000Z');
    expect(error.context).toEqual({
      remainingAttempts: 2,
      lockoutDuration: 600,
      lastAttempt: '2026-01-15T11:55:00.000Z',
    });
  });

  it('работает с различными HTTP статус кодами', () => {
    const statusCodes = [400, 401, 403, 429, 500];

    statusCodes.forEach((statusCode) => {
      const error = createAuthErrorResponse('invalid_credentials', { statusCode });
      expect(error.statusCode).toBe(statusCode);
    });
  });

  it('поддерживает retryable флаг для различных типов ошибок', () => {
    // Retryable errors
    const retryableErrors: AuthErrorType[] = [
      'invalid_credentials',
      'mfa_required',
      'token_expired',
      'session_expired',
      'rate_limited',
    ];

    retryableErrors.forEach((errorType) => {
      const error = createAuthErrorResponse(errorType, { retryable: true });
      expect(error.retryable).toBe(true);
    });

    // Non-retryable errors
    const nonRetryableErrors: AuthErrorType[] = [
      'account_locked',
      'account_disabled',
      'permission_denied',
      'risk_blocked',
    ];

    nonRetryableErrors.forEach((errorType) => {
      const error = createAuthErrorResponse(errorType, { retryable: false });
      expect(error.retryable).toBe(false);
    });
  });
});

// ============================================================================
// 🔄 ERROR TYPE COVERAGE - Покрытие всех типов ошибок
// ============================================================================

describe('AuthErrorResponse type coverage', () => {
  it('invalid_credentials ошибка содержит контекст', () => {
    const error = createAuthErrorResponse('invalid_credentials', {
      message: 'Invalid email or password',
      retryable: true,
      context: {
        remainingAttempts: 3,
        lastAttempt: '2026-01-15T10:00:00.000Z',
      },
    });

    expect(error.error).toBe('invalid_credentials');
    expect(error.context?.['remainingAttempts']).toBe(3);
  });

  it('account_locked ошибка содержит lockout информацию', () => {
    const error = createAuthErrorResponse('account_locked', {
      message: 'Account is locked due to multiple failed attempts',
      retryable: false,
      context: {
        lockoutDuration: 900,
        unlockAt: '2026-01-15T11:00:00.000Z',
      },
    });

    expect(error.error).toBe('account_locked');
    expect(error.retryable).toBe(false);
    expect(error.context?.['lockoutDuration']).toBe(900);
  });

  it('mfa_required ошибка содержит MFA информацию', () => {
    const error = createAuthErrorResponse('mfa_required', {
      message: 'Multi-factor authentication required',
      retryable: true,
      context: {
        mfaType: 'totp',
        mfaChallengeId: 'challenge-123',
      },
    });

    expect(error.error).toBe('mfa_required');
    expect(error.context?.['mfaType']).toBe('totp');
    expect(error.context?.['mfaChallengeId']).toBe('challenge-123');
  });

  it('rate_limited ошибка содержит rate limit информацию', () => {
    const error = createAuthErrorResponse('rate_limited', {
      message: 'Too many requests',
      retryable: true,
      statusCode: 429,
      context: {
        retryAfter: 60,
        limit: 10,
        remaining: 0,
      },
    });

    expect(error.error).toBe('rate_limited');
    expect(error.statusCode).toBe(429);
    expect(error.context?.['retryAfter']).toBe(60);
  });

  it('risk_blocked ошибка содержит risk информацию', () => {
    const error = createAuthErrorResponse('risk_blocked', {
      message: 'Blocked due to risk assessment',
      retryable: false,
      context: {
        riskScore: 95,
        riskFactors: ['unusual_location', 'suspicious_device'],
      },
    });

    expect(error.error).toBe('risk_blocked');
    expect(error.retryable).toBe(false);
    expect(error.context?.['riskScore']).toBe(95);
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('AuthErrorResponse edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const error = createAuthErrorResponse('invalid_credentials', {
      message: '',
      userId: '',
      correlationId: '',
      timestamp: '',
    });

    expect(error.message).toBe('');
    expect(error.userId).toBe('');
    expect(error.correlationId).toBe('');
    expect(error.timestamp).toBe('');
  });

  it('поддерживает пустой context объект', () => {
    const error = createAuthErrorResponse('invalid_credentials', {
      context: {},
    });

    expect(error.context).toEqual({});
  });

  it('поддерживает context с различными типами значений', () => {
    const error = createAuthErrorResponse('invalid_credentials', {
      context: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        arrayValue: [1, 2, 3],
        nestedObject: {
          key: 'value',
        },
        nullValue: null,
      },
    });

    expect(error.context?.['stringValue']).toBe('test');
    expect(error.context?.['numberValue']).toBe(42);
    expect(error.context?.['booleanValue']).toBe(true);
    expect(Array.isArray(error.context?.['arrayValue'])).toBe(true);
    expect(error.context?.['nestedObject']).toEqual({ key: 'value' });
  });

  it('timestamp опционально и может быть в ISO 8601 формате', () => {
    const errorWithTimestamp = createAuthErrorResponse('invalid_credentials', {
      timestamp: '2026-01-15T10:30:00.000Z',
    });

    const errorWithoutTimestamp = createAuthErrorResponse('invalid_credentials');

    expect(errorWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(errorWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('correlationId опционально для distributed tracing', () => {
    const errorWithCorrelation = createAuthErrorResponse('invalid_credentials', {
      correlationId: 'trace-123-456-789',
    });

    const errorWithoutCorrelation = createAuthErrorResponse('invalid_credentials');

    expect(errorWithCorrelation.correlationId).toBe('trace-123-456-789');
    expect(errorWithoutCorrelation.correlationId).toBeUndefined();
  });

  it('userId опционально (может быть неизвестен до идентификации)', () => {
    const errorWithUserId = createAuthErrorResponse('invalid_credentials', {
      userId: 'user-123',
    });

    const errorWithoutUserId = createAuthErrorResponse('invalid_credentials');

    expect(errorWithUserId.userId).toBe('user-123');
    expect(errorWithoutUserId.userId).toBeUndefined();
  });

  it('statusCode опционально для non-API использования', () => {
    const errorWithStatusCode = createAuthErrorResponse('invalid_credentials', {
      statusCode: 401,
    });

    const errorWithoutStatusCode = createAuthErrorResponse('invalid_credentials');

    expect(errorWithStatusCode.statusCode).toBe(401);
    expect(errorWithoutStatusCode.statusCode).toBeUndefined();
  });

  it('retryable опционально и может быть undefined', () => {
    const errorWithRetryable = createAuthErrorResponse('invalid_credentials', {
      retryable: true,
    });

    const errorWithoutRetryable = createAuthErrorResponse('invalid_credentials');

    expect(errorWithRetryable.retryable).toBe(true);
    expect(errorWithoutRetryable.retryable).toBeUndefined();
  });

  it('message опционально для минимальных ошибок', () => {
    const errorWithMessage = createAuthErrorResponse('invalid_credentials', {
      message: 'Invalid credentials',
    });

    const errorWithoutMessage = createMinimalAuthErrorResponse('invalid_credentials');

    expect(errorWithMessage.message).toBe('Invalid credentials');
    expect(errorWithoutMessage.message).toBeUndefined();
  });

  it('context опционально для дополнительных данных', () => {
    const errorWithContext = createAuthErrorResponse('invalid_credentials', {
      context: {
        remainingAttempts: 3,
        lockoutDuration: 300,
      },
    });

    const errorWithoutContext = createMinimalAuthErrorResponse('invalid_credentials');

    expect(errorWithContext.context?.['remainingAttempts']).toBe(3);
    expect(errorWithoutContext.context).toBeUndefined();
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('AuthErrorResponse immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const error: AuthErrorResponse = {
      error: 'invalid_credentials',
      message: 'Test message',
      retryable: true,
      statusCode: 401,
      userId: 'user-123',
      correlationId: 'corr-123',
      timestamp: '2026-01-15T10:30:00.000Z',
      context: {
        key: 'value',
      },
    };

    // TypeScript предотвращает мутацию
    // error.error = 'account_locked'; // TypeScript error: Cannot assign to 'error' because it is a read-only property
    // error.message = 'New message'; // TypeScript error: Cannot assign to 'message' because it is a read-only property

    expect(error.error).toBe('invalid_credentials');
    expect(error.message).toBe('Test message');
  });

  it('context readonly - предотвращает мутацию вложенных объектов', () => {
    const error: AuthErrorResponse = {
      error: 'invalid_credentials',
      context: {
        remainingAttempts: 3,
        lockoutDuration: 300,
      },
    };

    // TypeScript предотвращает мутацию context
    // error.context!['remainingAttempts'] = 5; // TypeScript error: Index signature in type 'readonly Record<string, unknown>' only permits reading

    expect(error.context?.['remainingAttempts']).toBe(3);
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('AuthErrorResponse comprehensive snapshots', () => {
  it('invalid_credentials error - полный snapshot', () => {
    const error = createFullAuthErrorResponse('invalid_credentials', {
      message: 'Invalid email or password',
      retryable: true,
      statusCode: 401,
      context: {
        remainingAttempts: 2,
        lastAttempt: '2026-01-15T10:00:00.000Z',
      },
    });

    expect(error).toMatchSnapshot();
  });

  it('account_locked error - полный snapshot', () => {
    const error = createFullAuthErrorResponse('account_locked', {
      message: 'Account is locked due to multiple failed attempts',
      retryable: false,
      statusCode: 403,
      context: {
        lockoutDuration: 900,
        unlockAt: '2026-01-15T11:00:00.000Z',
        failedAttempts: 5,
      },
    });

    expect(error).toMatchSnapshot();
  });

  it('mfa_required error - полный snapshot', () => {
    const error = createFullAuthErrorResponse('mfa_required', {
      message: 'Multi-factor authentication required',
      retryable: true,
      statusCode: 200,
      context: {
        mfaType: 'totp',
        mfaChallengeId: 'challenge-123',
        availableMethods: ['totp', 'sms', 'push'],
      },
    });

    expect(error).toMatchSnapshot();
  });

  it('rate_limited error - полный snapshot', () => {
    const error = createFullAuthErrorResponse('rate_limited', {
      message: 'Too many requests. Please try again later.',
      retryable: true,
      statusCode: 429,
      context: {
        retryAfter: 60,
        limit: 10,
        remaining: 0,
        resetAt: '2026-01-15T11:00:00.000Z',
      },
    });

    expect(error).toMatchSnapshot();
  });

  it('risk_blocked error - полный snapshot', () => {
    const error = createFullAuthErrorResponse('risk_blocked', {
      message: 'Blocked due to risk assessment',
      retryable: false,
      statusCode: 403,
      context: {
        riskScore: 95,
        riskFactors: ['unusual_location', 'suspicious_device', 'velocity_anomaly'],
        blockedUntil: '2026-01-16T10:30:00.000Z',
      },
    });

    expect(error).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные error responses проходят Zod схему', () => {
    const validError = {
      error: 'invalid_credentials',
      message: 'Invalid email or password',
      code: 'AUTH_001',
      details: {
        remainingAttempts: 3,
      },
      traceId: 'trace-123',
    };

    const result = authErrorResponseSchema.safeParse(validError);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.error).toBe('invalid_credentials');
      expect(result.data.message).toBe('Invalid email or password');
      expect(result.data.code).toBe('AUTH_001');
    }
  });

  it('невалидные типы ошибок отклоняются', () => {
    const invalidError = {
      error: 'invalid_error_type', // невалидный тип
      message: 'Test message',
      code: 'AUTH_001',
    };

    const result = authErrorResponseSchema.safeParse(invalidError);
    expect(result.success).toBe(false);
  });

  it('отсутствие обязательных полей отклоняется', () => {
    const missingError = {
      // error отсутствует
      message: 'Test message',
      code: 'AUTH_001',
    };

    const result = authErrorResponseSchema.safeParse(missingError);
    expect(result.success).toBe(false);
  });

  it('отсутствие message отклоняется', () => {
    const missingMessage = {
      error: 'invalid_credentials',
      // message отсутствует
      code: 'AUTH_001',
    };

    const result = authErrorResponseSchema.safeParse(missingMessage);
    expect(result.success).toBe(false);
  });

  it('отсутствие code отклоняется', () => {
    const missingCode = {
      error: 'invalid_credentials',
      message: 'Test message',
      // code отсутствует
    };

    const result = authErrorResponseSchema.safeParse(missingCode);
    expect(result.success).toBe(false);
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const errorWithExtra = {
      error: 'invalid_credentials',
      message: 'Test message',
      code: 'AUTH_001',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = authErrorResponseSchema.safeParse(errorWithExtra);
    expect(result.success).toBe(false);
  });

  it('все типы ошибок поддерживаются схемой', () => {
    // Проверяем только те типы, которые есть в схеме
    const schemaErrorTypes = [
      'invalid_credentials',
      'account_disabled',
      'account_locked',
      'email_not_verified',
      'phone_not_verified',
      'mfa_required',
      'mfa_invalid',
      'token_expired',
      'token_invalid',
      'session_expired',
      'rate_limited',
      'policy_violation',
      'oauth_error',
    ];

    schemaErrorTypes.forEach((errorType) => {
      const validError = {
        error: errorType,
        message: `Error: ${errorType}`,
        code: 'AUTH_001',
      };

      const result = authErrorResponseSchema.safeParse(validError);
      expect(result.success).toBe(true);
    });
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум обязательных полей
    const minimalError = {
      error: 'invalid_credentials',
      message: 'Invalid credentials',
      code: 'AUTH_001',
    };

    const result = authErrorResponseSchema.safeParse(minimalError);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.error).toBe('invalid_credentials');
      expect(result.data.message).toBe('Invalid credentials');
      expect(result.data.code).toBe('AUTH_001');
      expect(result.data.details).toBeUndefined();
      expect(result.data.traceId).toBeUndefined();
    }
  });

  it('details может содержать любые данные', () => {
    const errorWithDetails = {
      error: 'invalid_credentials',
      message: 'Test message',
      code: 'AUTH_001',
      details: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        arrayValue: [1, 2, 3],
        nestedObject: {
          key: 'value',
        },
      },
    };

    const result = authErrorResponseSchema.safeParse(errorWithDetails);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.details?.['stringValue']).toBe('test');
      expect(result.data.details?.['numberValue']).toBe(42);
      expect(result.data.details?.['booleanValue']).toBe(true);
    }
  });

  it('traceId опционально для distributed tracing', () => {
    const errorWithTraceId = {
      error: 'invalid_credentials',
      message: 'Test message',
      code: 'AUTH_001',
      traceId: 'trace-123-456-789',
    };

    const errorWithoutTraceId = {
      error: 'invalid_credentials',
      message: 'Test message',
      code: 'AUTH_001',
    };

    const resultWithTrace = authErrorResponseSchema.safeParse(errorWithTraceId);
    const resultWithoutTrace = authErrorResponseSchema.safeParse(errorWithoutTraceId);

    expect(resultWithTrace.success).toBe(true);
    expect(resultWithoutTrace.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (resultWithTrace.success) {
      expect(resultWithTrace.data.traceId).toBe('trace-123-456-789');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (resultWithoutTrace.success) {
      expect(resultWithoutTrace.data.traceId).toBeUndefined();
    }
  });
});
