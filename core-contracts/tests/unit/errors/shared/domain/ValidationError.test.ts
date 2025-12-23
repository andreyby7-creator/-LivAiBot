import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { ErrorCode } from '../../../../../src/errors/base/ErrorCode';
import {
  createValidationError,
  getActualType,
  getExpectedType,
  getValidationConstraints,
  getValidationField,
  getValidationRule,
  getValidationValue,
  isValidationError,
  isValidValidationErrorContext,
} from '../../../../../src/errors/shared/domain/ValidationError';
import type {
  ValidationError,
  ValidationErrorContext,
} from '../../../../../src/errors/shared/domain/ValidationError';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock ValidationErrorContext для тестов */
function createMockValidationContext(): ValidationErrorContext {
  return {
    type: 'user',
    userId: 'user-456',
    sessionId: 'session-789',
    field: 'email',
    value: 'invalid-email',
    rule: 'email_format',
    expectedType: 'string',
    actualType: 'string',
    constraints: {
      format: 'email',
      maxLength: 254,
    },
    correlationId: 'corr-123',
    requestId: 'req-abc',
  } as unknown as ValidationErrorContext;
}

/** Создает базовый mock ValidationErrorContext без опциональных полей для тестирования валидации */
function createBaseMockValidationContext(): ValidationErrorContext {
  return {
    type: 'user',
    userId: 'user-456',
    sessionId: 'session-789',
    correlationId: 'corr-123',
    requestId: 'req-abc',
  } as ValidationErrorContext;
}

/** Создает mock ValidationError для тестов */
function createMockValidationError(
  code: ErrorCode = DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
  message: string = 'Validation failed',
  context?: ValidationErrorContext,
  timestamp?: string,
): ValidationError {
  return createValidationError(code, message, context, timestamp);
}

// ==================== TESTS ====================

describe('ValidationError', () => {
  describe('createValidationError', () => {
    it('создает ValidationError с минимальными обязательными полями', () => {
      const error = createValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      expect(error).toEqual({
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: expect.any(String),
      });

      expect(isValidationError(error)).toBe(true);
    });

    it('создает ValidationError с кастомным timestamp для тестирования', () => {
      const customTimestamp = '2024-01-01T12:00:00.000Z';
      const error = createValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
      expect(isValidationError(error)).toBe(true);
    });

    it('создает ValidationError с полным контекстом', () => {
      const context = createMockValidationContext();
      const error = createValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Email validation failed',
        context,
      );

      expect(error.details).toEqual(context);
      expect(error.code).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA);
      expect(error.message).toBe('Email validation failed');
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('создает ValidationError с различными кодами ошибок', () => {
      const testCases: { code: ErrorCode; expectedMessage: string; }[] = [
        {
          code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
          expectedMessage: 'Domain validation failed',
        },
        {
          code: DOMAIN_ERROR_CODES.DOMAIN_USER_ALREADY_EXISTS,
          expectedMessage: 'Domain data corruption',
        },
        {
          code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          expectedMessage: 'Domain user not found',
        },
      ];

      testCases.forEach(({ code, expectedMessage }) => {
        const error = createValidationError(code, expectedMessage);
        expect(error.code).toBe(code);
        expect(error.message).toBe(expectedMessage);
        expect(error.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
      });
    });
  });

  describe('isValidationError', () => {
    it('возвращает true для ValidationError', () => {
      const error = createMockValidationError();
      expect(isValidationError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      const otherErrors = [
        new Error('Regular error'),
        { _tag: 'OtherError', message: 'Other' },
        null,
        undefined,
        'string error',
        42,
      ];

      otherErrors.forEach((error) => {
        expect(isValidationError(error)).toBe(false);
      });
    });

    it('возвращает false для объектов без _tag', () => {
      const invalidError = {
        category: ERROR_CATEGORY.BUSINESS,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным _tag', () => {
      const invalidError = {
        _tag: 'WrongError',
        category: ERROR_CATEGORY.BUSINESS,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным category', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.SECURITY, // неправильный category
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным origin', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.INFRASTRUCTURE, // неправильный origin
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным severity', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.HIGH, // неправильный severity
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом code', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: 123, // неправильный тип code
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом message', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 123, // неправильный тип message
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с неправильным типом timestamp', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: 123, // неправильный тип timestamp
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом field в details', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          field: 123, // неправильный тип field
        } as unknown as ValidationErrorContext,
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом constraints в details', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          field: 'email',
          constraints: 'invalid', // неправильный тип constraints (строка вместо объекта)
        } as unknown as ValidationErrorContext,
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом rule в details', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          field: 'email',
          rule: 123, // неправильный тип rule (число вместо строки)
        } as unknown as ValidationErrorContext,
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом expectedType в details', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          field: 'email',
          expectedType: {}, // неправильный тип expectedType (объект вместо строки)
        } as unknown as ValidationErrorContext,
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает false для объектов с невалидным типом actualType в details', () => {
      const invalidError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          field: 'email',
          actualType: null, // неправильный тип actualType (null вместо строки)
        } as unknown as ValidationErrorContext,
      };

      expect(isValidationError(invalidError)).toBe(false);
    });

    it('возвращает true для объектов с корректным ValidationErrorContext', () => {
      const validError = {
        _tag: 'ValidationError',
        category: ERROR_CATEGORY.BUSINESS,
        origin: ERROR_ORIGIN.DOMAIN,
        severity: ERROR_SEVERITY.MEDIUM,
        code: DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        message: 'Validation failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        details: {
          type: 'user',
          userId: 'user123',
          field: 'email',
          value: 'test@example.com',
          rule: 'email_format',
          expectedType: 'string',
          actualType: 'string',
          constraints: { format: 'email' },
        } as ValidationErrorContext,
      };

      expect(isValidationError(validError)).toBe(true);
    });
  });

  describe('getValidationField', () => {
    it('извлекает имя поля из ValidationError', () => {
      const context = createMockValidationContext();
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Field validation failed',
        context,
      );

      const field = getValidationField(error);
      expect(field).toBe('email');
    });

    it('возвращает undefined если поле не указано', () => {
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      const field = getValidationField(error);
      expect(field).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockValidationError();
      delete (error as any).details;

      const field = getValidationField(error);
      expect(field).toBeUndefined();
    });
  });

  describe('getValidationRule', () => {
    it('извлекает правило валидации из ValidationError', () => {
      const context = createMockValidationContext();
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Rule validation failed',
        context,
      );

      const rule = getValidationRule(error);
      expect(rule).toBe('email_format');
    });

    it('возвращает undefined если правило не указано', () => {
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      const rule = getValidationRule(error);
      expect(rule).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockValidationError();
      delete (error as any).details;

      const rule = getValidationRule(error);
      expect(rule).toBeUndefined();
    });
  });

  describe('getValidationValue', () => {
    it('извлекает значение поля из ValidationError', () => {
      const context = createMockValidationContext();
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Value validation failed',
        context,
      );

      const value = getValidationValue(error);
      expect(value).toBe('invalid-email');
    });

    it('возвращает undefined если значение не указано', () => {
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      const value = getValidationValue(error);
      expect(value).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockValidationError();
      delete (error as any).details;

      const value = getValidationValue(error);
      expect(value).toBeUndefined();
    });
  });

  describe('getExpectedType', () => {
    it('извлекает ожидаемый тип из ValidationError', () => {
      const context = createMockValidationContext();
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Type validation failed',
        context,
      );

      const expectedType = getExpectedType(error);
      expect(expectedType).toBe('string');
    });

    it('возвращает undefined если ожидаемый тип не указан', () => {
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      const expectedType = getExpectedType(error);
      expect(expectedType).toBeUndefined();
    });
  });

  describe('getActualType', () => {
    it('извлекает фактический тип из ValidationError', () => {
      const context = createMockValidationContext();
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Type validation failed',
        context,
      );

      const actualType = getActualType(error);
      expect(actualType).toBe('string');
    });

    it('возвращает undefined если фактический тип не указан', () => {
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      const actualType = getActualType(error);
      expect(actualType).toBeUndefined();
    });
  });

  describe('getValidationConstraints', () => {
    it('извлекает ограничения из ValidationError', () => {
      const context = createMockValidationContext();
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Constraints validation failed',
        context,
      );

      const constraints = getValidationConstraints(error);
      expect(constraints).toEqual({
        format: 'email',
        maxLength: 254,
      });
    });

    it('возвращает undefined если ограничения не указаны', () => {
      const error = createMockValidationError(
        DOMAIN_ERROR_CODES.DOMAIN_USER_INVALID_DATA,
        'Validation failed',
      );

      const constraints = getValidationConstraints(error);
      expect(constraints).toBeUndefined();
    });

    it('возвращает undefined если контекст отсутствует', () => {
      const error = createMockValidationError();
      delete (error as any).details;

      const constraints = getValidationConstraints(error);
      expect(constraints).toBeUndefined();
    });
  });

  describe('ValidationError structure', () => {
    it('содержит все обязательные поля TaggedError', () => {
      const error = createMockValidationError();

      expect(error).toHaveProperty('_tag', 'ValidationError');
      expect(error).toHaveProperty('category', ERROR_CATEGORY.BUSINESS);
      expect(error).toHaveProperty('origin', ERROR_ORIGIN.DOMAIN);
      expect(error).toHaveProperty('severity', ERROR_SEVERITY.MEDIUM);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
    });

    it('ValidationErrorContext содержит все необходимые поля', () => {
      const context = createMockValidationContext();

      expect(context).toHaveProperty('type');
      expect(context).toHaveProperty('field');
      expect(context).toHaveProperty('value');
      expect(context).toHaveProperty('rule');
      expect(context).toHaveProperty('expectedType');
      expect(context).toHaveProperty('actualType');
      expect(context).toHaveProperty('constraints');
      expect(context).toHaveProperty('correlationId');
      expect(context).toHaveProperty('userId');
      expect(context).toHaveProperty('sessionId');
      expect(context).toHaveProperty('requestId');
    });
  });

  // ==================== INTERNAL VALIDATION FUNCTIONS ====================

  describe('isValidValidationErrorContext', () => {
    it('должен возвращать true для валидного ValidationErrorContext', () => {
      const validContext = createMockValidationContext();

      expect(isValidValidationErrorContext(validContext)).toBe(true);
    });

    it('должен возвращать false для null или undefined', () => {
      expect(isValidValidationErrorContext(null)).toBe(false);
      expect(isValidValidationErrorContext(undefined)).toBe(false);
    });

    it('должен возвращать false для не-объектов', () => {
      expect(isValidValidationErrorContext('string')).toBe(false);
      expect(isValidValidationErrorContext(123)).toBe(false);
      expect(isValidValidationErrorContext(true)).toBe(false);
    });

    it('должен проверять обязательное поле type', () => {
      const invalidContext = { ...createMockValidationContext() };
      delete (invalidContext as any).type;

      expect(isValidValidationErrorContext(invalidContext)).toBe(false);

      const invalidType = { ...createMockValidationContext(), type: 123 };
      expect(isValidValidationErrorContext(invalidType)).toBe(false);
    });

    describe('optional string fields validation', () => {
      const optionalStringFields: Array<keyof ValidationErrorContext> = [
        'field',
        'rule',
        'expectedType',
        'actualType',
      ];

      it.each(optionalStringFields)(
        'должен принимать валидные строковые значения для %s',
        (field) => {
          const context = { ...createBaseMockValidationContext(), [field]: 'test_value' };
          expect(isValidValidationErrorContext(context)).toBe(true);
        },
      );

      it.each(optionalStringFields)('должен отклонять не-строковые значения для %s', (field) => {
        const invalidValues = [123, true, {}, []];

        invalidValues.forEach((value) => {
          const context = { ...createBaseMockValidationContext(), [field]: value as any };
          expect(isValidValidationErrorContext(context)).toBe(false);
        });
      });

      it.each(optionalStringFields)('должен принимать undefined для %s', (field) => {
        const context = { ...createBaseMockValidationContext() };
        expect(isValidValidationErrorContext(context)).toBe(true);
      });
    });

    describe('value field validation', () => {
      it('должен принимать любые значения для value поля', () => {
        const testValues = [
          'string',
          123,
          true,
          null,
          undefined,
          { nested: 'object' },
          ['array'],
        ];

        testValues.forEach((value) => {
          const context = { ...createBaseMockValidationContext(), value };
          expect(isValidValidationErrorContext(context)).toBe(true);
        });
      });

      it('должен принимать undefined для value', () => {
        const context = { ...createBaseMockValidationContext() };
        expect(isValidValidationErrorContext(context)).toBe(true);
      });
    });

    describe('constraints validation', () => {
      it('должен принимать объект для constraints', () => {
        const context = {
          ...createBaseMockValidationContext(),
          constraints: { minLength: 5, maxLength: 100 },
        };

        expect(isValidValidationErrorContext(context)).toBe(true);
      });

      it('должен принимать пустой объект для constraints', () => {
        const context = {
          ...createBaseMockValidationContext(),
          constraints: {},
        };

        expect(isValidValidationErrorContext(context)).toBe(true);
      });

      it('должен отклонять не-объекты для constraints', () => {
        const invalidValues = ['string', 123, true, null, []];

        invalidValues.forEach((invalidConstraints) => {
          const context = {
            ...createBaseMockValidationContext(),
            constraints: invalidConstraints as any,
          };
          expect(isValidValidationErrorContext(context)).toBe(false);
        });
      });

      it('должен принимать undefined для constraints', () => {
        const context = { ...createBaseMockValidationContext() };
        expect(isValidValidationErrorContext(context)).toBe(true);
      });
    });
  });
});
