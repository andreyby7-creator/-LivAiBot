import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { ErrorCode } from '../../../../../src/errors/base/ErrorCode';
import {
  createPermissionError,
  getPermissionResource,
  getRequiredPermissions,
  getUserPermissions,
  hasMissingPermissions,
  isPermissionDeniedError,
  isPermissionError,
  isPolicyViolationError,
  isResourceAccessError,
  isValidPermissionErrorContext,
} from '../../../../../src/errors/shared/domain/PermissionError';
import type {
  PermissionError,
  PermissionErrorContext,
} from '../../../../../src/errors/shared/domain/PermissionError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock PermissionErrorContext для тестов */
function createMockPermissionContext(): PermissionErrorContext {
  return {
    type: 'user',
    userId: 'user-123',
    sessionId: 'session-abc',
    userRole: 'editor',
    requiredPermissions: [
      'read:documents',
      'write:documents',
      'delete:documents',
    ],
    userPermissions: ['read:documents', 'write:documents'],
    resource: '/api/documents/123',
    resourceType: 'document',
    resourceId: 'doc-123',
    action: 'delete',
    accessContext: 'owner',
    policy: 'document_access_policy',
    conditions: {
      ownership: true,
      department: 'engineering',
      clearance_level: 'confidential',
    },
    correlationId: 'corr-789',
    requestId: 'req-xyz',
  } as unknown as PermissionErrorContext;
}

/** Создает базовый mock PermissionErrorContext без опциональных полей для тестирования валидации */
function createBaseMockPermissionContext(): PermissionErrorContext {
  return {
    type: 'user',
    userId: 'user-123',
    sessionId: 'session-abc',
    correlationId: 'corr-789',
    requestId: 'req-xyz',
  } as PermissionErrorContext;
}

/** Создает mock PermissionError для тестов */
function createMockPermissionError(
  code: ErrorCode = DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
  message: string = 'Permission denied',
  context?: PermissionErrorContext,
  timestamp?: string,
): PermissionError {
  return createPermissionError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('PermissionError', () => {
  describe('createPermissionError', () => {
    it('создает PermissionError с минимальными обязательными полями', () => {
      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
      );

      expect(error).toEqual({
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: expect.any(String),
      });

      expect(isPermissionError(error)).toBe(true);
    });

    it('создает PermissionError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isPermissionError(error)).toBe(true);
    });

    it('создает PermissionError с полным контекстом прав доступа', () => {
      const context = createMockPermissionContext();
      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Access denied to document',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS);
      expect(error.message).toBe('Access denied to document');
      expect(error.severity).toBe(ERROR_SEVERITY.HIGH); // Permission errors are HIGH severity
    });

    it('создает PermissionError с различными ролями пользователей', () => {
      const roles = ['admin', 'editor', 'viewer', 'guest', 'moderator'];

      roles.forEach((role) => {
        const context: PermissionErrorContext = {
          type: 'user',
          userId: 'user-123',
          userRole: role,
          requiredPermissions: ['admin:access'],
          userPermissions: ['read:access'],
        } as unknown as PermissionErrorContext;

        const error = createPermissionError(
          DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          `Access denied for ${role}`,
          context,
        );

        expect(error.details?.userRole).toBe(role);
      });
    });

    it('создает PermissionError с различными типами ресурсов', () => {
      const resourceTypes = [
        'user',
        'document',
        'bot',
        'subscription',
        'team',
        'organization',
      ];

      resourceTypes.forEach((resourceType) => {
        const context: PermissionErrorContext = {
          type: 'user',
          userId: 'user-123',
          resourceType,
          resourceId: `${resourceType}-123`,
          action: 'read',
        } as unknown as PermissionErrorContext;

        const error = createPermissionError(
          DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          `Access denied to ${resourceType}`,
          context,
        );

        expect(error.details?.resourceType).toBe(resourceType);
      });
    });
  });

  describe('isPermissionError', () => {
    it('возвращает true для PermissionError', () => {
      const error = createMockPermissionError();
      expect(isPermissionError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'ValidationError', message: 'Validation failed' },
        { _tag: 'AuthError', message: 'Auth failed' },
        null,
        undefined,
        'string error',
        42,
      ];

      otherErrors.forEach((error) => {
        expect(isPermissionError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов без _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.SECURITY,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным _tag', () => {
      const invalidError = {
        _tag: 'WrongError',
        category: ERROR_CATEGORY.SECURITY,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным category', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.BUSINESS, // неправильный category
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным origin', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.INFRASTRUCTURE, // неправильный origin
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным severity', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM, // неправильный severity
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом code', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: 123, // неправильный тип code
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом message', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 123, // неправильный тип message
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом timestamp', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: 123, // неправильный тип timestamp
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом userPermissions в details', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user-123',
          userPermissions: 'invalid', // неправильный тип userPermissions (строка вместо массива)
        } as unknown as PermissionErrorContext,
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом conditions в details', () => {
      const invalidError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user-123',
          conditions: 'invalid', // неправильный тип conditions (строка вместо объекта)
        } as unknown as PermissionErrorContext,
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(invalidError)).toBe(false);
    });

    it('возвращает true для объектов с корректным PermissionErrorContext', () => {
      const validError = {
        _tag: 'PermissionError',
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH,
        code: DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Permission denied',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          userRole: 'admin',
          requiredPermissions: ['read:users'],
          userPermissions: ['read:users', 'write:users'],
          resource: '/api/users',
          resourceType: 'user',
          resourceId: 'user123',
          action: 'read',
        } as PermissionErrorContext,
      } as unknown as PermissionErrorContext;

      expect(isPermissionError(validError)).toBe(true);
    });
  });

  describe('getRequiredPermissions', () => {
    it('извлекает требуемые права доступа из PermissionError', () => {
      const context = createMockPermissionContext();
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
        context,
      );

      const required = getRequiredPermissions(error);
      expect(required).toEqual([
        'read:documents',
        'write:documents',
        'delete:documents',
      ]);
    });

    it('возвращает undefined если требуемые права не указаны', () => {
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
      );

      const required = getRequiredPermissions(error);
      expect(required).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockPermissionError();
      delete (error as any).details;

      const required = getRequiredPermissions(error);
      expect(required).toBeUndefined();
    });
  });

  describe('getUserPermissions', () => {
    it('извлекает права пользователя из PermissionError', () => {
      const context = createMockPermissionContext();
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
        context,
      );

      const userPermissions = getUserPermissions(error);
      expect(userPermissions).toEqual(['read:documents', 'write:documents']);
    });

    it('возвращает undefined если права пользователя не указаны', () => {
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
      );

      const userPermissions = getUserPermissions(error);
      expect(userPermissions).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockPermissionError();
      delete (error as any).details;

      const userPermissions = getUserPermissions(error);
      expect(userPermissions).toBeUndefined();
    });
  });

  describe('hasMissingPermissions', () => {
    it('возвращает true если пользователю не хватает требуемых прав', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        requiredPermissions: [
          'read:documents',
          'write:documents',
          'delete:documents',
        ],
        userPermissions: ['read:documents', 'write:documents'], // нет delete
      } as unknown as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Missing delete permission',
        context,
      );

      expect(hasMissingPermissions(error)).toBe(true);
    });

    it('возвращает false если у пользователя есть все требуемые права', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        requiredPermissions: ['read:documents', 'write:documents'],
        userPermissions: [
          'read:documents',
          'write:documents',
          'delete:documents',
        ], // есть все + лишние
      } as unknown as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Has all permissions',
        context,
      );

      expect(hasMissingPermissions(error)).toBe(false);
    });

    it('возвращает false если права не указаны', () => {
      const error = createMockPermissionError();

      expect(hasMissingPermissions(error)).toBe(false);
    });

    it('возвращает false если указаны только права пользователя', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        userPermissions: ['read:documents'],
      } as unknown as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Only user permissions',
        context,
      );

      expect(hasMissingPermissions(error)).toBe(false);
    });

    it('возвращает false если указаны только требуемые права', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        requiredPermissions: ['write:documents'],
      } as unknown as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Only required permissions',
        context,
      );

      expect(hasMissingPermissions(error)).toBe(false);
    });
  });

  describe('getPermissionResource', () => {
    it('извлекает информацию о ресурсе из PermissionError', () => {
      const context = createMockPermissionContext();
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Access denied',
        context,
      );

      const resource = getPermissionResource(error);
      expect(resource).toEqual({
        type: 'document',
        id: 'doc-123',
        action: 'delete',
      });
    });

    it('возвращает undefined если информация о ресурсе не указана', () => {
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Access denied',
      );

      const resource = getPermissionResource(error);
      expect(resource).toBeUndefined();
    });

    it('возвращает partial объект если указаны не все поля ресурса', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        resourceType: 'user',
        action: 'read',
        // resourceId не указан
      } as unknown as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Access denied',
        context,
      );

      const resource = getPermissionResource(error);
      expect(resource).toEqual({
        type: 'user',
        id: undefined,
        action: 'read',
      });
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockPermissionError();
      delete (error as any).details;

      const resource = getPermissionResource(error);
      expect(resource).toBeUndefined();
    });
  });

  describe('isPermissionDeniedError', () => {
    it('возвращает true для ошибки отсутствия прав доступа', () => {
      const context = createMockPermissionContext();
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Permission denied',
        context,
      );

      expect(isPermissionDeniedError(error)).toBe(true);
    });

    it('возвращает false если права присутствуют', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user123',
        requiredPermissions: ['read:documents'],
        userPermissions: ['read:documents', 'write:documents'],
      } as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Access granted',
        context,
      );

      expect(isPermissionDeniedError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockPermissionError();

      expect(isPermissionDeniedError(error)).toBe(false);
    });
  });

  describe('isPolicyViolationError', () => {
    it('возвращает true для ошибки нарушения политики', () => {
      const context = createMockPermissionContext();
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Policy violation',
        context,
      );

      expect(isPolicyViolationError(error)).toBe(true);
    });

    it('возвращает false если политика не указана', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user123',
        requiredPermissions: ['read:documents'],
        userPermissions: ['write:documents'],
      } as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'No policy',
        context,
      );

      expect(isPolicyViolationError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockPermissionError();

      expect(isPolicyViolationError(error)).toBe(false);
    });
  });

  describe('isResourceAccessError', () => {
    it('возвращает true для ошибки доступа к ресурсу', () => {
      const context = createMockPermissionContext();
      const error = createMockPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Resource access denied',
        context,
      );

      expect(isResourceAccessError(error)).toBe(true);
    });

    it('возвращает true если указан только тип ресурса', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        resourceType: 'document',
      } as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Resource type error',
        context,
      );

      expect(isResourceAccessError(error)).toBe(true);
    });

    it('возвращает true если указано только действие', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user-123',
        action: 'delete',
      } as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'Action error',
        context,
      );

      expect(isResourceAccessError(error)).toBe(true);
    });

    it('возвращает false если информация о ресурсе не указана', () => {
      const context: PermissionErrorContext = {
        type: 'user',
        userId: 'user123',
        requiredPermissions: ['read:documents'],
        userPermissions: ['write:documents'],
      } as PermissionErrorContext;

      const error = createPermissionError(
        DOMAIN_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        'No resource info',
        context,
      );

      expect(isResourceAccessError(error)).toBe(false);
    });

    it('возвращает false если контекст отсутствует', () => {
      const error = createMockPermissionError();

      expect(isResourceAccessError(error)).toBe(false);
    });
  });

  describe('PermissionError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockPermissionError();

      expect(error).toHaveProperty('_tag', 'PermissionError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.SECURITY);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.DOMAIN);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.HIGH); // Permission errors are HIGH
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });

    it('PermissionErrorContext содержит все необходимые поля для контроля доступа', () => {
      const context = createMockPermissionContext();

      expect(context).toHaveProperty('type');
      expect(context).toHaveProperty('userId');
      expect(context).toHaveProperty('userRole');
      expect(context).toHaveProperty('requiredPermissions');
      expect(context).toHaveProperty('userPermissions');
      expect(context).toHaveProperty('resource');
      expect(context).toHaveProperty('resourceType');
      expect(context).toHaveProperty('resourceId');
      expect(context).toHaveProperty('action');
      expect(context).toHaveProperty('accessContext');
      expect(context).toHaveProperty('policy');
      expect(context).toHaveProperty('conditions');
      expect(context).toHaveProperty('correlationId');
      expect(context).toHaveProperty('sessionId');
      expect(context).toHaveProperty('requestId');
    });
  });

  // ==================== INTERNAL VALIDATION FUNCTIONS ====================

  describe('isValidPermissionErrorContext', () => {
    it('должен возвращать true для валидного PermissionErrorContext', () => {
      const validContext = createMockPermissionContext();

      expect(isValidPermissionErrorContext(validContext)).toBe(true);
    });

    it('должен возвращать false для null или undefined', () => {
      expect(isValidPermissionErrorContext(null)).toBe(false);
      expect(isValidPermissionErrorContext(undefined)).toBe(false);
    });

    it('должен возвращать false для не-объектов', () => {
      expect(isValidPermissionErrorContext('string')).toBe(false);
      expect(isValidPermissionErrorContext(123)).toBe(false);
      expect(isValidPermissionErrorContext(true)).toBe(false);
    });

    it('должен проверять обязательное поле type', () => {
      const invalidContext = { ...createMockPermissionContext() };
      delete (invalidContext as any).type;

      expect(isValidPermissionErrorContext(invalidContext)).toBe(false);

      const invalidType = { ...createMockPermissionContext(), type: 123 };
      expect(isValidPermissionErrorContext(invalidType)).toBe(false);
    });

    describe('optional string fields validation', () => {
      const optionalStringFields: (keyof PermissionErrorContext)[] = [
        'userId',
        'resource',
        'action',
        'policy',
      ];

      it.each(optionalStringFields)(
        'должен принимать валидные строковые значения для %s',
        (field) => {
          const context = { ...createBaseMockPermissionContext(), [field]: 'test_value' };
          expect(isValidPermissionErrorContext(context)).toBe(true);
        },
      );

      it.each(optionalStringFields)('должен отклонять не-строковые значения для %s', (field) => {
        const invalidValues = [123, true, {}, []];

        invalidValues.forEach((value) => {
          const context = { ...createBaseMockPermissionContext(), [field]: value as any };
          expect(isValidPermissionErrorContext(context)).toBe(false);
        });
      });

      it.each(optionalStringFields)('должен принимать undefined для %s', (field) => {
        const context = { ...createBaseMockPermissionContext() };
        expect(isValidPermissionErrorContext(context)).toBe(true);
      });
    });

    describe('arrays validation', () => {
      it('должен принимать валидные массивы строк для requiredPermissions', () => {
        const context = {
          ...createBaseMockPermissionContext(),
          requiredPermissions: ['read:user', 'write:user'],
          userPermissions: ['read:user'],
        };

        expect(isValidPermissionErrorContext(context)).toBe(true);
      });

      it('должен отклонять массивы с не-строковыми значениями', () => {
        const invalidContexts = [
          { ...createBaseMockPermissionContext(), requiredPermissions: [123, 'valid'] },
          { ...createBaseMockPermissionContext(), userPermissions: ['valid', true] },
        ];

        invalidContexts.forEach((context) => {
          expect(isValidPermissionErrorContext(context)).toBe(false);
        });
      });

      it('должен принимать undefined для массивов', () => {
        const context = { ...createBaseMockPermissionContext() };
        expect(isValidPermissionErrorContext(context)).toBe(true);
      });
    });
  });
});
