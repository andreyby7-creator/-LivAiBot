/**
 * @file SharedValidators.test.ts
 * Unit-тесты для SharedValidators.ts
 */

import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit, Option } from 'effect';
import {
  effectValidateSharedDomain,
  effectValidateSharedInfra,
  validateSharedDomain,
  validateSharedError,
  validateSharedInfra,
} from '../../../../src/errors/shared/SharedValidators.js';
import { LIVAI_ERROR_CODES } from '../../../../src/errors/base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN } from '../../../../src/errors/base/ErrorConstants.js';

import type { SharedValidationError } from '../../../../src/errors/shared/SharedValidators.js';
import type { BaseError, ErrorMetadata } from '../../../../src/errors/base/BaseError.js';
import type { CorrelationId } from '../../../../src/errors/base/ErrorMetadata.js';

// Mock данные для тестов
const mockMetadata: ErrorMetadata = {
  context: {
    correlationId: 'test-correlation-id' as CorrelationId,
    timestamp: 1234567890 as any,
  },
  userContext: {
    userId: '123',
    tenantId: 'test-tenant',
    sessionId: 'test-session',
  },
};

// Helper функция для создания BaseError в тестах
function createMockBaseError(overrides: Partial<BaseError> = {}): BaseError {
  return {
    _tag: 'BaseError',
    code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Test error message',
    severity: 'medium',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    timestamp: Date.now(),
    cause: undefined,
    causeChain: [],
    metadata: mockMetadata,
    codeMetadata: {
      code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'User not found',
      severity: 'medium',
      category: ERROR_CATEGORY.BUSINESS,
      origin: ERROR_ORIGIN.DOMAIN,
    },
    ...overrides,
  };
}

const validSharedDomainError = createMockBaseError({
  code: 'SHARED_DOMAIN_INVALID_INPUT',
  message: 'Invalid input provided',
  severity: 'low',
  category: ERROR_CATEGORY.BUSINESS,
  origin: ERROR_ORIGIN.DOMAIN,
  metadata: mockMetadata,
});

const validSharedInfraError = createMockBaseError({
  code: 'SHARED_INFRA_DATABASE_CONNECTION',
  message: 'Database connection failed',
  severity: 'high',
  category: ERROR_CATEGORY.TECHNICAL,
  origin: ERROR_ORIGIN.INFRASTRUCTURE,
  metadata: mockMetadata,
});

const invalidDomainError = createMockBaseError({
  code: 'INVALID_DOMAIN_CODE',
  message: 'Invalid domain error',
  severity: 'medium',
  category: ERROR_CATEGORY.BUSINESS,
  origin: ERROR_ORIGIN.DOMAIN,
  metadata: mockMetadata,
});

const invalidInfraError = createMockBaseError({
  code: 'INVALID_INFRA_CODE',
  message: 'Invalid infra error',
  severity: 'high',
  category: ERROR_CATEGORY.TECHNICAL,
  origin: ERROR_ORIGIN.INFRASTRUCTURE,
  metadata: mockMetadata,
});

const mixedDomainInfraError = createMockBaseError({
  code: 'SHARED_INFRA_MIXED_DOMAIN',
  message: 'Mixed domain-infra error',
  severity: 'medium',
  category: ERROR_CATEGORY.BUSINESS,
  origin: ERROR_ORIGIN.INFRASTRUCTURE,
  metadata: mockMetadata,
});

describe('SharedValidators', () => {
  describe('validateSharedDomain', () => {
    it('должен успешно валидировать корректную shared domain ошибку', () => {
      const result = validateSharedDomain(validSharedDomainError);

      expect(result.code).toBe('SHARED_DOMAIN_INVALID_INPUT');
      expect(result.reason).toBe('Invalid input provided');
      expect(result.meta).toEqual(mockMetadata);
    });

    it('должен отклонять ошибку без SHARED_ namespace', () => {
      const result = validateSharedDomain(invalidDomainError);

      expect(result.code).toBe('SHARED_INVALID_DOMAIN');
      expect(result.reason).toContain('Domain error должен иметь SHARED_ namespace');
      expect(result.reason).toContain('INVALID_DOMAIN_CODE');
      expect(result.meta?.originalCode).toBe('INVALID_DOMAIN_CODE');
    });

    it('должен отклонять domain ошибку с infra кодом', () => {
      const result = validateSharedDomain(mixedDomainInfraError);

      expect(result.code).toBe('SHARED_INVALID_DOMAIN');
      expect(result.reason).toContain('Domain error не может быть infra code');
      expect(result.reason).toContain('SHARED_INFRA_MIXED_DOMAIN');
      expect(result.meta?.originalCode).toBe('SHARED_INFRA_MIXED_DOMAIN');
    });
  });

  describe('validateSharedInfra', () => {
    it('должен успешно валидировать корректную shared infra ошибку', () => {
      const result = validateSharedInfra(validSharedInfraError);

      expect(result.code).toBe('SHARED_INFRA_DATABASE_CONNECTION');
      expect(result.reason).toBe('Database connection failed');
      expect(result.meta).toEqual(mockMetadata);
    });

    it('должен отклонять ошибку без SHARED_INFRA_ namespace', () => {
      const result = validateSharedInfra(invalidInfraError);

      expect(result.code).toBe('SHARED_INVALID_INFRA');
      expect(result.reason).toContain('Infra error должен иметь SHARED_INFRA_ namespace');
      expect(result.reason).toContain('INVALID_INFRA_CODE');
      expect(result.meta?.originalCode).toBe('INVALID_INFRA_CODE');
    });
  });

  describe('validateSharedError', () => {
    it('должен перенаправлять infra ошибки в validateSharedInfra', () => {
      const result = validateSharedError(validSharedInfraError);

      expect(result.code).toBe('SHARED_INFRA_DATABASE_CONNECTION');
      expect(result.reason).toBe('Database connection failed');
    });

    it('должен перенаправлять domain ошибки в validateSharedDomain', () => {
      const result = validateSharedError(validSharedDomainError);

      expect(result.code).toBe('SHARED_DOMAIN_INVALID_INPUT');
      expect(result.reason).toBe('Invalid input provided');
    });

    it('должен корректно обрабатывать ошибки без SHARED_ префикса как domain', () => {
      const result = validateSharedError(invalidDomainError);

      expect(result.code).toBe('SHARED_INVALID_DOMAIN');
      expect(result.reason).toContain('SHARED_ namespace');
    });
  });

  describe('effectValidateSharedDomain', () => {
    it('должен успешно проходить валидацию для корректной domain ошибки', async () => {
      const effect = Effect.succeed('success');
      const wrappedEffect = effectValidateSharedDomain(effect);

      const result = await Effect.runPromise(wrappedEffect);
      expect(result).toBe('success');
    });

    it('должен возвращать ошибку валидации для некорректной domain ошибки', async () => {
      const effect = Effect.fail(invalidDomainError);
      const wrappedEffect = effectValidateSharedDomain(effect);

      const exit = await Effect.runPromiseExit(wrappedEffect);

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption) as SharedValidationError;
          expect(error.code).toBe('SHARED_INVALID_DOMAIN');
          expect(error.reason).toContain('SHARED_ namespace');
        },
      });
    });
  });

  describe('effectValidateSharedInfra', () => {
    it('должен успешно проходить валидацию для корректной infra ошибки', async () => {
      const effect = Effect.succeed('success');
      const wrappedEffect = effectValidateSharedInfra(effect);

      const result = await Effect.runPromise(wrappedEffect);
      expect(result).toBe('success');
    });

    it('должен возвращать ошибку валидации для некорректной infra ошибки', async () => {
      const effect = Effect.fail(invalidInfraError);
      const wrappedEffect = effectValidateSharedInfra(effect);

      const exit = await Effect.runPromiseExit(wrappedEffect);

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption) as SharedValidationError;
          expect(error.code).toBe('SHARED_INVALID_INFRA');
          expect(error.reason).toContain('SHARED_INFRA_ namespace');
        },
      });
    });
  });

  describe('типизация и структура', () => {
    it('должен корректно типизировать SharedValidationError', () => {
      const error: SharedValidationError = {
        code: 'TEST_ERROR',
        reason: 'Test validation error',
        meta: { testKey: 'testValue' },
      };

      expect(error.code).toBe('TEST_ERROR');
      expect(error.reason).toBe('Test validation error');
      expect(error.meta?.testKey).toBe('testValue');
    });

    it('должен поддерживать SharedValidationError без meta', () => {
      const error: SharedValidationError = {
        code: 'SIMPLE_ERROR',
        reason: 'Simple error without meta',
      };

      expect(error.code).toBe('SIMPLE_ERROR');
      expect(error.reason).toBe('Simple error without meta');
      expect(error.meta).toBeUndefined();
    });
  });

  describe('интеграционные сценарии', () => {
    it('должен корректно работать в цепочке Effect операций', async () => {
      const complexEffect = Effect.gen(function*() {
        // Имитируем бизнес-логику, которая может выбросить ошибку
        const result1 = yield* Effect.succeed('step1');
        const result2 = yield* Effect.fail(validSharedDomainError); // Эта ошибка должна пройти валидацию
        return `${result1}-${result2}`;
      });

      const validatedEffect = effectValidateSharedDomain(complexEffect);

      const exit = await Effect.runPromiseExit(validatedEffect);

      expect(Exit.isFailure(exit)).toBe(true);
      Exit.match(exit, {
        onSuccess: () => expect.fail('Expected failure'),
        onFailure: (cause) => {
          const failureOption = Cause.failureOption(cause);
          expect(Option.isSome(failureOption)).toBe(true);
          const error = Option.getOrThrow(failureOption) as SharedValidationError;
          expect(error.code).toBe('SHARED_DOMAIN_INVALID_INPUT');
          expect(error.reason).toBe('Invalid input provided');
        },
      });
    });

    it('должен обеспечивать type safety для error handling', () => {
      // Проверяем, что функции возвращают правильные типы
      const domainResult: SharedValidationError = validateSharedDomain(validSharedDomainError);
      const infraResult: SharedValidationError = validateSharedInfra(validSharedInfraError);
      const generalResult: SharedValidationError = validateSharedError(validSharedDomainError);

      expect(typeof domainResult.code).toBe('string');
      expect(typeof domainResult.reason).toBe('string');
      expect(typeof infraResult.code).toBe('string');
      expect(typeof infraResult.reason).toBe('string');
      expect(typeof generalResult.code).toBe('string');
      expect(typeof generalResult.reason).toBe('string');
    });
  });
});
