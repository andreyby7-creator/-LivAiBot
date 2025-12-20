/**
 * Golden tests для проверки стабильности Error Kernel ABI
 *
 * Эти тесты гарантируют, что ABI контракты не меняются случайно.
 * Любые изменения должны быть explicit и документированы через ADR.
 */

import { describe, expect, it } from 'vitest';

import {
  createApplicationError,
  createDomainError,
  createError,
  createInfrastructureError,
  createSecurityError,
  isErrorCode as isErrorCodeInBaseError,
  matchError,
  wrapUnknownError,
} from '../../../../src/errors/base/BaseError.ts';
import { assertNever, ERROR_CODE, isErrorCode } from '../../../../src/errors/base/ErrorCode.ts';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
  isErrorCategory,
  isErrorOrigin,
  isErrorSeverity,
} from '../../../../src/errors/base/ErrorConstants.ts';
import { createErrorMetadata } from '../../../../src/errors/base/ErrorMetadata.ts';
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.ts';

import type { BaseError } from '../../../../src/errors/base/BaseError.ts';

describe('Error Kernel - Golden ABI Tests', () => {
  describe('ERROR_CODE stability', () => {
    it('should have stable set of error codes (Golden Test)', () => {
      // Golden set - если это меняется, должен быть ADR
      const expectedCodes = [
        'DOMAIN_ENTITY_NOT_FOUND',
        'DOMAIN_INVALID_STATE',
        'DOMAIN_RULE_VIOLATION',
        'DOMAIN_CONFLICT',
        'DOMAIN_INVARIANT_BROKEN',
        'APPLICATION_COMMAND_REJECTED',
        'APPLICATION_QUERY_FAILED',
        'APPLICATION_PERMISSION_DENIED',
        'INFRA_NETWORK_ERROR',
        'INFRA_TIMEOUT',
        'INFRA_DATABASE_ERROR',
        'INFRA_EXTERNAL_SERVICE_ERROR',
        'INFRA_RESOURCE_UNAVAILABLE',
        'SECURITY_UNAUTHORIZED',
        'SECURITY_FORBIDDEN',
        'SECURITY_TOKEN_EXPIRED',
        'SECURITY_RATE_LIMITED',
        'VALIDATION_FAILED',
        'VALIDATION_SCHEMA_MISMATCH',
        'VALIDATION_REQUIRED_FIELD_MISSING',
        'UNKNOWN_ERROR',
      ] as const;

      const actualCodes = Object.values(ERROR_CODE).sort();
      const expectedSorted = [...expectedCodes].sort();

      expect(actualCodes).toEqual(expectedSorted);
    });

    it('should have ErrorCode type covering all codes', () => {
      const codes = Object.values(ERROR_CODE);
      codes.forEach((code) => {
        expect(typeof code).toBe('string');
      });
    });

    it('should validate ErrorCode values with type guard', () => {
      // Валидные коды
      Object.values(ERROR_CODE).forEach((code) => {
        expect(isErrorCode(code)).toBe(true);
      });

      // Невалидные значения
      expect(isErrorCode('INVALID_CODE')).toBe(false);
      expect(isErrorCode(null)).toBe(false);
      expect(isErrorCode(undefined)).toBe(false);
      expect(isErrorCode(123)).toBe(false);
      expect(isErrorCode({})).toBe(false);
      expect(isErrorCode([])).toBe(false);
    });

    it('should maintain immutability', () => {
      // TypeScript предотвращает мутацию readonly объекта на compile-time
      // @ts-expect-error - пытаемся мутировать readonly объект (демонстрирует type safety)
      ((): void => {
        ERROR_CODE.NEW_CODE = 'NEW_CODE';
      })();

      // Если код компилируется без ошибок, значит type-level immutability работает
      expect(true).toBe(true);
    });
  });

  describe('Error constructors', () => {
    it('should create errors with correct types', () => {
      const domainError = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      const appError = createApplicationError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'Test');
      const infraError = createInfrastructureError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Test');
      const securityError = createSecurityError(ERROR_CODE.SECURITY_UNAUTHORIZED, 'Test');

      expect(isBaseError(domainError)).toBe(true);
      expect(isBaseError(appError)).toBe(true);
      expect(isBaseError(infraError)).toBe(true);
      expect(isBaseError(securityError)).toBe(true);

      expect(domainError.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
      expect(appError.code).toBe(ERROR_CODE.APPLICATION_COMMAND_REJECTED);
      expect(infraError.code).toBe(ERROR_CODE.INFRA_NETWORK_ERROR);
      expect(securityError.code).toBe(ERROR_CODE.SECURITY_UNAUTHORIZED);
    });

    it('should have correct error codes', () => {
      const domainError = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      const appError = createApplicationError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'Test');
      const infraError = createInfrastructureError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Test');
      const securityError = createSecurityError(ERROR_CODE.SECURITY_UNAUTHORIZED, 'Test');

      expect(domainError.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
      expect(appError.code).toBe(ERROR_CODE.APPLICATION_COMMAND_REJECTED);
      expect(infraError.code).toBe(ERROR_CODE.INFRA_NETWORK_ERROR);
      expect(securityError.code).toBe(ERROR_CODE.SECURITY_UNAUTHORIZED);
    });

    it('should throw when createDomainError is called with non-domain code', () => {
      expect(() => {
        createDomainError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'Test');
      }).toThrow('ErrorCode APPLICATION_COMMAND_REJECTED does not belong to domain layer');
    });

    it('should throw when createApplicationError is called with non-application code', () => {
      expect(() => {
        createApplicationError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      }).toThrow('ErrorCode DOMAIN_ENTITY_NOT_FOUND does not belong to application layer');
    });

    it('should throw when createInfrastructureError is called with non-infrastructure code', () => {
      expect(() => {
        createInfrastructureError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      }).toThrow('ErrorCode DOMAIN_ENTITY_NOT_FOUND does not belong to infrastructure layer');
    });

    it('should throw when createSecurityError is called with non-security code', () => {
      expect(() => {
        createSecurityError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      }).toThrow('ErrorCode DOMAIN_ENTITY_NOT_FOUND does not belong to security layer');
    });
  });

  describe('Error serialization', () => {
    it('should serialize correctly', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test message');

      expect(error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
      expect(error.message).toBe('Test message');
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should serialize with metadata', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test message', {
        correlationId: 'test-123',
        context: { userId: 42 },
      });

      expect(error.correlationId).toBe('test-123');
      expect(error.context).toEqual({ userId: 42 });
    });

    it('should support pattern matching', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');

      const result = matchError(error, {
        [ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND]: (e) => `Domain: ${e.message}`,
        [ERROR_CODE.INFRA_NETWORK_ERROR]: (e) => `Infra: ${e.message}`,
        fallback: (e) => `Unknown: ${e.message}`,
      });

      expect(result).toBe('Domain: Test');
    });
  });

  describe('ErrorMetadata', () => {
    it('should create empty metadata', () => {
      const metadata = createErrorMetadata();
      expect(metadata).toEqual({});
      expect(Object.isFrozen(metadata)).toBe(true);
    });

    it('should create metadata with partial fields', () => {
      const metadata = createErrorMetadata({
        correlationId: 'req-123',
        severity: 'high',
        category: 'business',
        tenantId: 'tenant-456',
        retryable: true,
      });

      expect(metadata.correlationId).toBe('req-123');
      expect(metadata.severity).toBe('high');
      expect(metadata.category).toBe('business');
      expect(metadata.tenantId).toBe('tenant-456');
      expect(metadata.retryable).toBe(true);
      expect(metadata.context).toBeUndefined();
      expect(Object.isFrozen(metadata)).toBe(true);
    });

    it('should exclude undefined fields', () => {
      const metadata = createErrorMetadata({
        correlationId: 'req-123',
        context: undefined, // explicitly undefined
        severity: 'low',
      });

      expect(metadata.correlationId).toBe('req-123');
      expect(metadata.severity).toBe('low');
      expect(metadata).not.toHaveProperty('context');
      expect(Object.isFrozen(metadata)).toBe(true);
    });

    it('should handle all metadata fields', () => {
      const fullMetadata = createErrorMetadata({
        correlationId: 'req-123',
        context: { userId: 'user-456' },
        localizedMessage: 'User not found',
        cause: new Error('Original error'),
        severity: 'critical',
        category: 'business',
        tenantId: 'tenant-789',
        retryable: false,
        origin: 'domain',
        extra: { debug: true },
      });

      expect(fullMetadata.correlationId).toBe('req-123');
      expect(fullMetadata.context).toEqual({ userId: 'user-456' });
      expect(fullMetadata.localizedMessage).toBe('User not found');
      expect(fullMetadata.cause).toBeInstanceOf(Error);
      expect(fullMetadata.severity).toBe('critical');
      expect(fullMetadata.category).toBe('business');
      expect(fullMetadata.tenantId).toBe('tenant-789');
      expect(fullMetadata.retryable).toBe(false);
      expect(fullMetadata.origin).toBe('domain');
      expect(fullMetadata.extra).toEqual({ debug: true });
      expect(Object.isFrozen(fullMetadata)).toBe(true);
    });
  });

  describe('Error immutability', () => {
    it('should be deeply frozen (runtime + type-level immutability)', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test', {
        context: { nested: { value: 42 } },
      });

      // Runtime freeze: objects are immutable at runtime
      expect(Object.isFrozen(error)).toBe(true);
      expect(Object.isFrozen(error.context)).toBe(true);
      expect(Object.isFrozen((error.context as any).nested)).toBe(true);

      // TypeScript prevents mutation of readonly properties (compile-time safety)
      const attemptCodeMutation = (): void => {
        (error as any).code = 'OTHER_CODE';
      };
      const attemptMessageMutation = (): void => {
        (error as any).message = 'New message';
      };
      const attemptNestedMutation = (): void => {
        (error.context as any).nested = {};
      };

      // Runtime: мутация невозможна (deep freeze protection)
      expect(() => attemptCodeMutation()).toThrow(TypeError);
      expect(() => attemptMessageMutation()).toThrow(TypeError);
      expect(() => attemptNestedMutation()).toThrow(TypeError);

      // Свойства остаются неизменными
      expect(error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
      expect(error.message).toBe('Test');
      expect((error.context as any).nested.value).toBe(42);
    });

    it('should demonstrate runtime immutability protection', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');

      // Runtime: deep freeze предотвращает мутацию
      expect(() => {
        (error as any).code = 'OTHER_CODE';
      }).toThrow(TypeError);

      // Свойства остаются неизменными
      expect(error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
    });

    it('should validate error structure with type guards', () => {
      const validError = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      const invalidObject = { code: 'INVALID', message: 'test', timestamp: '2024' };

      // Valid error passes type guard
      expect(isBaseError(validError)).toBe(true);

      // Invalid object fails type guard (wrong code)
      expect(isBaseError(invalidObject)).toBe(false);

      // Type narrowing works
      if (isBaseError(validError)) {
        // validError имеет тип ReadonlyDeep<BaseError>
        expect(validError.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
      }
    });
  });

  describe('ErrorConstants', () => {
    describe('ERROR_SEVERITY', () => {
      it('should have stable severity constants', () => {
        expect(ERROR_SEVERITY.LOW).toBe('low');
        expect(ERROR_SEVERITY.MEDIUM).toBe('medium');
        expect(ERROR_SEVERITY.HIGH).toBe('high');
        expect(ERROR_SEVERITY.CRITICAL).toBe('critical');
      });

      it('should be frozen (immutable)', () => {
        expect(Object.isFrozen(ERROR_SEVERITY)).toBe(true);
      });

      it('should validate severity values with type guard', () => {
        expect(isErrorSeverity('low')).toBe(true);
        expect(isErrorSeverity('medium')).toBe(true);
        expect(isErrorSeverity('high')).toBe(true);
        expect(isErrorSeverity('critical')).toBe(true);
        expect(isErrorSeverity('invalid')).toBe(false);
        expect(isErrorSeverity(123)).toBe(false);
        expect(isErrorSeverity(null)).toBe(false);
      });
    });

    describe('ERROR_CATEGORY', () => {
      it('should have stable category constants', () => {
        expect(ERROR_CATEGORY.VALIDATION).toBe('validation');
        expect(ERROR_CATEGORY.AUTHORIZATION).toBe('authorization');
        expect(ERROR_CATEGORY.BUSINESS).toBe('business');
        expect(ERROR_CATEGORY.INFRASTRUCTURE).toBe('infrastructure');
        expect(ERROR_CATEGORY.UNKNOWN).toBe('unknown');
      });

      it('should be frozen (immutable)', () => {
        expect(Object.isFrozen(ERROR_CATEGORY)).toBe(true);
      });

      it('should validate category values with type guard', () => {
        expect(isErrorCategory('validation')).toBe(true);
        expect(isErrorCategory('authorization')).toBe(true);
        expect(isErrorCategory('business')).toBe(true);
        expect(isErrorCategory('infrastructure')).toBe(true);
        expect(isErrorCategory('unknown')).toBe(true);
        expect(isErrorCategory('invalid')).toBe(false);
        expect(isErrorCategory(123)).toBe(false);
        expect(isErrorCategory(null)).toBe(false);
      });
    });

    describe('ERROR_ORIGIN', () => {
      it('should have stable origin constants', () => {
        expect(ERROR_ORIGIN.DOMAIN).toBe('domain');
        expect(ERROR_ORIGIN.APPLICATION).toBe('application');
        expect(ERROR_ORIGIN.INFRASTRUCTURE).toBe('infrastructure');
        expect(ERROR_ORIGIN.SECURITY).toBe('security');
      });

      it('should be frozen (immutable)', () => {
        expect(Object.isFrozen(ERROR_ORIGIN)).toBe(true);
      });

      it('should validate origin values with type guard', () => {
        expect(isErrorOrigin('domain')).toBe(true);
        expect(isErrorOrigin('application')).toBe(true);
        expect(isErrorOrigin('infrastructure')).toBe(true);
        expect(isErrorOrigin('security')).toBe(true);
        expect(isErrorOrigin('invalid')).toBe(false);
        expect(isErrorOrigin(123)).toBe(false);
        expect(isErrorOrigin(null)).toBe(false);
      });
    });
  });

  describe('wrapUnknownError', () => {
    it('должен оборачивать Error объект', () => {
      const originalError = new Error('Original error message');
      const wrapped = wrapUnknownError(originalError, ERROR_CODE.UNKNOWN_ERROR, 'Fallback message');

      expect(wrapped.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
      expect(wrapped.message).toBe('Original error message');
      expect(wrapped.cause).toBe(originalError);
    });

    it('должен использовать fallback message если Error.message пустой', () => {
      const originalError = new Error('');
      const wrapped = wrapUnknownError(originalError, ERROR_CODE.UNKNOWN_ERROR, 'Fallback message');

      expect(wrapped.message).toBe('Fallback message');
      expect(wrapped.cause).toBe(originalError);
    });

    it('должен обрабатывать не-Error объекты (string)', () => {
      const stringError = 'String error';
      const wrapped = wrapUnknownError(stringError, ERROR_CODE.UNKNOWN_ERROR, 'Fallback message');

      expect(wrapped.message).toBe('String error');
      // cause устанавливается только для Error объектов, не для примитивов
      expect(wrapped.cause).toBeUndefined();
    });

    it('должен обрабатывать не-Error объекты (number)', () => {
      const numberError = 42;
      const wrapped = wrapUnknownError(numberError, ERROR_CODE.UNKNOWN_ERROR, 'Fallback message');

      expect(wrapped.message).toBe('42');
      // cause устанавливается только для Error объектов, не для примитивов
      expect(wrapped.cause).toBeUndefined();
    });

    it('должен обрабатывать null/undefined', () => {
      // String(null) = "null", String(undefined) = "undefined" - используются как message
      const wrappedNull = wrapUnknownError(null, ERROR_CODE.UNKNOWN_ERROR, 'Fallback message');
      expect(wrappedNull.message).toBe('null');
      // cause устанавливается только для Error объектов
      expect(wrappedNull.cause).toBeUndefined();

      const wrappedUndefined = wrapUnknownError(
        undefined,
        ERROR_CODE.UNKNOWN_ERROR,
        'Fallback message',
      );
      expect(wrappedUndefined.message).toBe('undefined');
      // cause устанавливается только для Error объектов
      expect(wrappedUndefined.cause).toBeUndefined();
    });

    it('должен использовать дефолтные параметры', () => {
      const error = new Error('Test');
      const wrapped = wrapUnknownError(error);

      expect(wrapped.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
      expect(wrapped.message).toBe('Test');
    });

    it('должен добавлять дополнительные метаданные', () => {
      const error = new Error('Test');
      const wrapped = wrapUnknownError(error, ERROR_CODE.UNKNOWN_ERROR, 'Fallback', {
        correlationId: 'req-123',
        severity: 'high',
      });

      expect(wrapped.correlationId).toBe('req-123');
      expect(wrapped.severity).toBe('high');
    });
  });

  describe('Error chaining (cause)', () => {
    it('should preserve BaseError as cause', () => {
      const rootError = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Root error');
      const wrappedError = createError(
        ERROR_CODE.DOMAIN_INVALID_STATE,
        'Wrapped error',
        { cause: rootError },
      );

      expect(wrappedError.cause).toBe(rootError);
      expect(isBaseError(wrappedError.cause)).toBe(true);
      expect((wrappedError.cause as BaseError).code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
    });

    it('should preserve Error as cause', () => {
      const rootError = new Error('Root error');
      const wrappedError = createError(
        ERROR_CODE.DOMAIN_INVALID_STATE,
        'Wrapped error',
        { cause: rootError },
      );

      expect(wrappedError.cause).toBe(rootError);
      expect(wrappedError.cause).toBeInstanceOf(Error);
    });

    it('should handle error chain depth 2', () => {
      const rootError = new Error('Root error');
      const middleError = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Middle error',
        { cause: rootError },
      );
      const topError = createError(
        ERROR_CODE.DOMAIN_INVALID_STATE,
        'Top error',
        { cause: middleError },
      );

      expect(topError.cause).toBe(middleError);
      expect(isBaseError(topError.cause)).toBe(true);
      const middleCause = topError.cause as BaseError;
      expect(middleCause.cause).toBe(rootError);
      expect(middleCause.cause).toBeInstanceOf(Error);
    });

    it('should handle error chain depth 3', () => {
      const rootError = new Error('Root error');
      const firstError = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'First error',
        { cause: rootError },
      );
      const secondError = createError(
        ERROR_CODE.DOMAIN_INVALID_STATE,
        'Second error',
        { cause: firstError },
      );
      const thirdError = createError(
        ERROR_CODE.DOMAIN_RULE_VIOLATION,
        'Third error',
        { cause: secondError },
      );

      expect(thirdError.cause).toBe(secondError);
      const secondCause = thirdError.cause as BaseError;
      expect(secondCause.cause).toBe(firstError);
      const firstCause = secondCause.cause as BaseError;
      expect(firstCause.cause).toBe(rootError);
    });

    it('should prevent double wrapping (same error instance)', () => {
      const rootError = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Root error');
      const wrappedOnce = createError(
        ERROR_CODE.DOMAIN_INVALID_STATE,
        'Wrapped once',
        { cause: rootError },
      );
      // Попытка обернуть уже обернутую ошибку
      const wrappedTwice = createError(
        ERROR_CODE.DOMAIN_RULE_VIOLATION,
        'Wrapped twice',
        { cause: wrappedOnce },
      );

      // Каждая обертка создает новый BaseError, но сохраняет цепочку
      expect(wrappedTwice.cause).toBe(wrappedOnce);
      expect((wrappedTwice.cause as BaseError).cause).toBe(rootError);
    });

    it('should handle BaseError chain with different error codes', () => {
      const domainError = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Domain error');
      const appError = createApplicationError(
        ERROR_CODE.APPLICATION_COMMAND_REJECTED,
        'Application error',
        { cause: domainError },
      );
      const infraError = createInfrastructureError(
        ERROR_CODE.INFRA_NETWORK_ERROR,
        'Infrastructure error',
        { cause: appError },
      );

      expect(infraError.cause).toBe(appError);
      expect((infraError.cause as BaseError).code).toBe(ERROR_CODE.APPLICATION_COMMAND_REJECTED);
      expect(((infraError.cause as BaseError).cause as BaseError).code).toBe(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
      );
    });
  });

  describe('isErrorCode (BaseError)', () => {
    it('должен возвращать true для BaseError с указанным кодом', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      expect(isErrorCodeInBaseError(error, ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)).toBe(true);
    });

    it('должен возвращать false для BaseError с другим кодом', () => {
      const error = createDomainError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      expect(isErrorCodeInBaseError(error, ERROR_CODE.INFRA_NETWORK_ERROR)).toBe(false);
    });

    it('должен возвращать false для не-BaseError объектов', () => {
      expect(isErrorCodeInBaseError({}, ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)).toBe(false);
      expect(isErrorCodeInBaseError(null, ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)).toBe(false);
      expect(isErrorCodeInBaseError('string', ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)).toBe(false);
    });
  });

  describe('createError edge cases', () => {
    it('должен выбрасывать ошибку при невалидном ErrorCode', () => {
      // TypeScript не позволит передать невалидный код через типы, но runtime проверка все равно есть
      // Используем 'as any' чтобы протестировать runtime поведение
      expect(() => {
        createError('INVALID_ERROR_CODE' as any, 'Test message');
      }).toThrow('Invalid ErrorCode');
    });
  });

  describe('assertNever', () => {
    it('должен выбрасывать ошибку при вызове', () => {
      // Это функция для exhaustive checking в switch/case
      // Используется для type safety в compile-time
      expect(() => {
        // @ts-expect-error - преднамеренно передаем не-never значение для тестирования runtime поведения
        assertNever('test');
      }).toThrow('Обработанный код ошибки отсутствует');
    });
  });

  // Note: deepMergeObjects вызывается только для merge baseMetadata и override в extractMetadataFromMeta,
  // но не для отдельных полей context/extra. Поэтому тесты для non-POJO в extra не будут вызывать console.warn.
  // deepMergeObjects используется только внутри extractMetadataFromMeta для merge метаданных из реестра и переданных метаданных.
});

describe('Error System - Chaos Test', () => {
  /**
   * 🎲 Chaos Test: гарантирует, что система всегда возвращает BaseError
   * даже для самых неожиданных и случайных входных данных.
   *
   * Это финальный тест устойчивости системы - проверяет, что boundary-функции
   * никогда не выбрасывают необработанные исключения, а всегда возвращают валидный BaseError.
   */
  describe('wrapUnknownError - chaos resilience', () => {
    it('should always return BaseError for random unknown values', () => {
      const randomValues: unknown[] = [
        // Примитивы
        null,
        undefined,
        0,
        -1,
        42,
        3.14,
        Infinity,
        -Infinity,
        NaN,
        '',
        'random string',
        '🚀 emoji',
        true,
        false,
        // Объекты
        {},
        { random: 'property' },
        { nested: { deep: { value: 123 } } },
        [],
        [1, 2, 3],
        ['mixed', 42, { obj: true }],
        // Специальные объекты
        new Date(),
        new RegExp('test'),
        new Map(),
        new Set(),
        new WeakMap(),
        new WeakSet(),
        // Функции
        (() => {}) as () => void,
        (function named() {}) as () => void,
        // Символы
        Symbol('test'),
        Symbol.for('test'),
        // BigInt
        BigInt(123),
        // Proxy
        new Proxy({}, {}),
        // Экзотические случаи
        { toString: () => 'custom' },
        { valueOf: () => 42 },
        { [Symbol.toPrimitive]: () => 'primitive' },
      ];

      for (const randomValue of randomValues) {
        const result = wrapUnknownError(randomValue);

        expect(isBaseError(result)).toBe(true);
        expect(result.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
        expect(typeof result.timestamp).toBe('string');
        expect(() => new Date(result.timestamp)).not.toThrow();
      }
    });

    it('should always return BaseError for random shapes (partially-formed objects)', () => {
      const randomShapes: unknown[] = [
        // Частично сформированные Error-подобные объекты
        { message: 'test' },
        { code: 'CUSTOM_ERROR' },
        { name: 'Error', message: 'test' },
        { stack: 'at line 1' },
        { cause: new Error('nested') },
        // Axios-подобные объекты
        { response: { status: 404 } },
        { response: { data: { error: 'test' } } },
        { config: { url: 'https://example.com' } },
        { request: {} },
        // HTTP-подобные объекты
        { status: 500 },
        { statusText: 'Internal Server Error' },
        { headers: { 'Content-Type': 'application/json' } },
        // Смешанные формы
        { error: { code: 'ERR', message: 'test' } },
        { data: { error: { message: 'test' } } },
        { result: { error: 'test' } },
        // Вложенные структуры
        { error: { details: { code: 'ERR', message: 'test' } } },
        { response: { error: { code: 'ERR' } } },
        // Массивы с объектами
        [{ error: 'test' }],
        [{ code: 'ERR', message: 'test' }],
        // Случайные комбинации
        { a: 1, b: 'test', c: { d: true } },
        { 0: 'zero', 1: 'one', length: 2 },
      ];

      for (const randomShape of randomShapes) {
        const result = wrapUnknownError(randomShape);

        expect(isBaseError(result)).toBe(true);
        expect(result.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
        expect(typeof result.timestamp).toBe('string');
      }
    });
  });
});
