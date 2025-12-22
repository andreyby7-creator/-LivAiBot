import { describe, expect, it } from 'vitest';

import {
  getSharedErrorKind,
  groupSharedErrorsByKind,
  isSharedAdapterError,
  isSharedDomainError,
  isSharedError,
  isSharedErrorKind,
  isSharedInfraError,
  isSharedPolicyError,
  matchSharedError,
  safeMatchSharedError,
  validateSharedError,
  validateSharedErrorCategory,
  validateSharedErrorCode,
  validateSharedErrorKind,
} from '../../../../src/errors/shared/SharedErrorTypes';
import type {
  SharedAdapterError,
  SharedDomainError,
  SharedError,
  SharedErrorCategory,
  SharedErrorCodeString,
  SharedErrorDetails,
  SharedErrorInput,
  SharedErrorKind,
  SharedInfraError,
  SharedPolicyError,
} from '../../../../src/errors/shared/SharedErrorTypes';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock SharedDomainError для тестов */
function createMockSharedDomainError(
  code: SharedErrorCodeString = 'SHARED_DOMAIN_USER_NOT_FOUND',
  message = 'User not found',
  details?: unknown
): SharedDomainError {
  const error: SharedDomainError = {
    _tag: 'SharedDomainError',
    category: 'domain',
    code,
    message,
  };

  if (details !== undefined) {
    (error as any).details = details;
  }

  return error;
}

/** Создает mock SharedInfraError для тестов */
function createMockSharedInfraError(
  code: SharedErrorCodeString = 'SHARED_INFRA_DB_CONNECTION_FAILED',
  message = 'Database connection failed',
  details?: unknown
): SharedInfraError {
  const error: SharedInfraError = {
    _tag: 'SharedInfraError',
    category: 'infrastructure',
    code,
    message,
  };

  if (details !== undefined) {
    (error as any).details = details;
  }

  return error;
}

/** Создает mock SharedPolicyError для тестов */
function createMockSharedPolicyError(
  code: SharedErrorCodeString = 'SHARED_POLICY_RETRY_EXHAUSTED',
  message = 'Retry attempts exhausted',
  details?: unknown
): SharedPolicyError {
  const error: SharedPolicyError = {
    _tag: 'SharedPolicyError',
    category: 'policy',
    code,
    message,
  };

  if (details !== undefined) {
    (error as any).details = details;
  }

  return error;
}

/** Создает mock SharedAdapterError для тестов */
function createMockSharedAdapterError(
  code: SharedErrorCodeString = 'SHARED_ADAPTER_HTTP_TIMEOUT',
  message = 'HTTP request timeout',
  details?: unknown
): SharedAdapterError {
  const error: SharedAdapterError = {
    _tag: 'SharedAdapterError',
    category: 'adapter',
    code,
    message,
  };

  if (details !== undefined) {
    (error as any).details = details;
  }

  return error;
}

/** Создает невалидный объект для тестирования type guards */
function createInvalidError(): object {
  return {
    _tag: 'InvalidError',
    category: 'unknown',
    code: 'INVALID_CODE',
    message: 'Invalid error',
  };
}

// ==================== UNIT TESTS ====================

describe('SharedErrorTypes', () => {
  describe('Типы и базовая структура', () => {
    describe('SharedErrorCodeString тип', () => {
      it('должен принимать корректные SHARED_ коды', () => {
        const validCode: SharedErrorCodeString = 'SHARED_DOMAIN_USER_NOT_FOUND';
        expect(validCode).toBe('SHARED_DOMAIN_USER_NOT_FOUND');
      });

      it('должен отклонять некорректные коды на этапе компиляции', () => {
        // @ts-expect-error - должен быть SHARED_ префикс
        const invalidCode: SharedErrorCodeString = 'USER_NOT_FOUND';
        expect(invalidCode).toBeDefined();
      });
    });

    describe('SharedErrorCategory тип', () => {
      it('должен поддерживать все категории', () => {
        const categories: SharedErrorCategory[] = [
          'domain',
          'infrastructure',
          'policy',
          'adapter',
        ];
        expect(categories).toHaveLength(4);
      });

      it('должен отклонять неизвестные категории', () => {
        // @ts-expect-error - должна быть одна из разрешенных категорий
        const invalidCategory: SharedErrorCategory = 'unknown';
        expect(invalidCategory).toBeDefined();
      });
    });

    describe('SharedErrorKind тип', () => {
      it('должен поддерживать все виды ошибок', () => {
        const kinds: SharedErrorKind[] = [
          'SharedDomainError',
          'SharedInfraError',
          'SharedPolicyError',
          'SharedAdapterError',
        ];
        expect(kinds).toHaveLength(4);
      });

      it('должен отклонять неизвестные виды', () => {
        // @ts-expect-error - должен быть один из разрешенных видов
        const invalidKind: SharedErrorKind = 'UnknownError';
        expect(invalidKind).toBeDefined();
      });
    });

    describe('SharedDomainError тип', () => {
      it('должен иметь правильную структуру', () => {
        const error = createMockSharedDomainError();
        expect(error._tag).toBe('SharedDomainError');
        expect(error.category).toBe('domain');
        expect(error.code).toMatch(/^SHARED_/);
        expect(error.message).toBe('User not found');
      });

      it('должен поддерживать опциональные details', () => {
        const error = createMockSharedDomainError(
          'SHARED_DOMAIN_VALIDATION_FAILED',
          'Validation failed',
          { field: 'email', reason: 'invalid format' }
        );
        expect(error.details).toEqual({
          field: 'email',
          reason: 'invalid format',
        });
      });
    });

    describe('SharedInfraError тип', () => {
      it('должен иметь правильную структуру', () => {
        const error = createMockSharedInfraError();
        expect(error._tag).toBe('SharedInfraError');
        expect(error.category).toBe('infrastructure');
        expect(error.code).toMatch(/^SHARED_/);
        expect(error.message).toBe('Database connection failed');
      });
    });

    describe('SharedPolicyError тип', () => {
      it('должен иметь правильную структуру', () => {
        const error = createMockSharedPolicyError();
        expect(error._tag).toBe('SharedPolicyError');
        expect(error.category).toBe('policy');
        expect(error.code).toMatch(/^SHARED_/);
        expect(error.message).toBe('Retry attempts exhausted');
      });
    });

    describe('SharedAdapterError тип', () => {
      it('должен иметь правильную структуру', () => {
        const error = createMockSharedAdapterError();
        expect(error._tag).toBe('SharedAdapterError');
        expect(error.category).toBe('adapter');
        expect(error.code).toMatch(/^SHARED_/);
        expect(error.message).toBe('HTTP request timeout');
      });
    });

    describe('SharedError union тип', () => {
      it('должен поддерживать discriminated union по _tag', () => {
        const errors: SharedError[] = [
          createMockSharedDomainError(),
          createMockSharedInfraError(),
          createMockSharedPolicyError(),
          createMockSharedAdapterError(),
        ];

        errors.forEach(error => {
          expect(error.code).toMatch(/^SHARED_/);
          expect(['domain', 'infrastructure', 'policy', 'adapter']).toContain(error.category);
        });
      });
    });

    describe('SharedErrorDetails тип', () => {
      it('должен извлекать тип details из SharedError', () => {
        type DomainDetails = SharedErrorDetails<SharedDomainError>;
        const details: DomainDetails = { field: 'email' };
        expect(details).toEqual({ field: 'email' });
      });
    });

    describe('SharedErrorInput тип', () => {
      it('должен требовать SHARED_ коды', () => {
        const input: SharedErrorInput = {
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          message: 'User not found',
        };
        expect(input.code).toMatch(/^SHARED_/);
      });

      it('должен поддерживать опциональные details', () => {
        const input: SharedErrorInput = {
          code: 'SHARED_DOMAIN_VALIDATION_FAILED',
          message: 'Validation failed',
          details: { field: 'password' },
        };
        expect(input.details).toEqual({ field: 'password' });
      });
    });
  });

  describe('Type guards', () => {
    describe('isSharedDomainError', () => {
      it('должен возвращать true для SharedDomainError', () => {
        const error = createMockSharedDomainError();
        expect(isSharedDomainError(error)).toBe(true);
      });

      it('должен возвращать false для других типов ошибок', () => {
        const infraError = createMockSharedInfraError();
        const policyError = createMockSharedPolicyError();
        const adapterError = createMockSharedAdapterError();

        expect(isSharedDomainError(infraError)).toBe(false);
        expect(isSharedDomainError(policyError)).toBe(false);
        expect(isSharedDomainError(adapterError)).toBe(false);
      });

      it('должен возвращать false для невалидных объектов', () => {
        expect(isSharedDomainError(createInvalidError())).toBe(false);
        expect(isSharedDomainError(null)).toBe(false);
        expect(isSharedDomainError({})).toBe(false);
        expect(isSharedDomainError('string')).toBe(false);
      });

      it('должен проверять SHARED_ префикс в коде', () => {
        const invalidError = {
          _tag: 'SharedDomainError',
          category: 'domain',
          code: 'INVALID_CODE', // Нет SHARED_ префикса
          message: 'Invalid',
        };
        expect(isSharedDomainError(invalidError)).toBe(false);
      });
    });

    describe('isSharedInfraError', () => {
      it('должен возвращать true для SharedInfraError', () => {
        const error = createMockSharedInfraError();
        expect(isSharedInfraError(error)).toBe(true);
      });

      it('должен возвращать false для других типов ошибок', () => {
        const domainError = createMockSharedDomainError();
        const policyError = createMockSharedPolicyError();
        const adapterError = createMockSharedAdapterError();

        expect(isSharedInfraError(domainError)).toBe(false);
        expect(isSharedInfraError(policyError)).toBe(false);
        expect(isSharedInfraError(adapterError)).toBe(false);
      });

      it('должен проверять SHARED_ префикс в коде', () => {
        const invalidError = {
          _tag: 'SharedInfraError',
          category: 'infrastructure',
          code: 'INVALID_CODE',
          message: 'Invalid',
        };
        expect(isSharedInfraError(invalidError)).toBe(false);
      });
    });

    describe('isSharedPolicyError', () => {
      it('должен возвращать true для SharedPolicyError', () => {
        const error = createMockSharedPolicyError();
        expect(isSharedPolicyError(error)).toBe(true);
      });

      it('должен возвращать false для других типов ошибок', () => {
        const domainError = createMockSharedDomainError();
        const infraError = createMockSharedInfraError();
        const adapterError = createMockSharedAdapterError();

        expect(isSharedPolicyError(domainError)).toBe(false);
        expect(isSharedPolicyError(infraError)).toBe(false);
        expect(isSharedPolicyError(adapterError)).toBe(false);
      });

      it('должен проверять SHARED_ префикс в коде', () => {
        const invalidError = {
          _tag: 'SharedPolicyError',
          category: 'policy',
          code: 'INVALID_CODE',
          message: 'Invalid',
        };
        expect(isSharedPolicyError(invalidError)).toBe(false);
      });
    });

    describe('isSharedAdapterError', () => {
      it('должен возвращать true для SharedAdapterError', () => {
        const error = createMockSharedAdapterError();
        expect(isSharedAdapterError(error)).toBe(true);
      });

      it('должен возвращать false для других типов ошибок', () => {
        const domainError = createMockSharedDomainError();
        const infraError = createMockSharedInfraError();
        const policyError = createMockSharedPolicyError();

        expect(isSharedAdapterError(domainError)).toBe(false);
        expect(isSharedAdapterError(infraError)).toBe(false);
        expect(isSharedAdapterError(policyError)).toBe(false);
      });

      it('должен проверять SHARED_ префикс в коде', () => {
        const invalidError = {
          _tag: 'SharedAdapterError',
          category: 'adapter',
          code: 'INVALID_CODE',
          message: 'Invalid',
        };
        expect(isSharedAdapterError(invalidError)).toBe(false);
      });
    });

    describe('isSharedError', () => {
      it('должен возвращать true для всех типов SharedError', () => {
        const domainError = createMockSharedDomainError();
        const infraError = createMockSharedInfraError();
        const policyError = createMockSharedPolicyError();
        const adapterError = createMockSharedAdapterError();

        expect(isSharedError(domainError)).toBe(true);
        expect(isSharedError(infraError)).toBe(true);
        expect(isSharedError(policyError)).toBe(true);
        expect(isSharedError(adapterError)).toBe(true);
      });

      it('должен возвращать false для невалидных объектов', () => {
        expect(isSharedError(createInvalidError())).toBe(false);
        expect(isSharedError(null)).toBe(false);
        expect(isSharedError({})).toBe(false);
        expect(isSharedError('string')).toBe(false);
      });

      it('должен проверять SHARED_ префикс во всех типах', () => {
        const invalidErrors = [
          { _tag: 'SharedDomainError', category: 'domain', code: 'INVALID', message: 'test' },
          { _tag: 'SharedInfraError', category: 'infrastructure', code: 'INVALID', message: 'test' },
          { _tag: 'SharedPolicyError', category: 'policy', code: 'INVALID', message: 'test' },
          { _tag: 'SharedAdapterError', category: 'adapter', code: 'INVALID', message: 'test' },
        ];

        invalidErrors.forEach(error => {
          expect(isSharedError(error)).toBe(false);
        });
      });
    });
  });

  describe('Pattern matching', () => {
    describe('matchSharedError', () => {
      it('должен корректно обрабатывать SharedDomainError', () => {
        const error = createMockSharedDomainError();
        const result = matchSharedError(error, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback',
        });
        expect(result).toBe('domain_handled');
      });

      it('должен корректно обрабатывать SharedInfraError', () => {
        const error = createMockSharedInfraError();
        const result = matchSharedError(error, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback',
        });
        expect(result).toBe('infra_handled');
      });

      it('должен корректно обрабатывать SharedPolicyError', () => {
        const error = createMockSharedPolicyError();
        const result = matchSharedError(error, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback',
        });
        expect(result).toBe('policy_handled');
      });

      it('должен корректно обрабатывать SharedAdapterError', () => {
        const error = createMockSharedAdapterError();
        const result = matchSharedError(error, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback',
        });
        expect(result).toBe('adapter_handled');
      });

      it('должен использовать fallback для неизвестных случаев', () => {
        // Создаем объект, который выглядит как SharedError, но имеет неизвестный _tag
        const unknownError = {
          _tag: 'UnknownError' as any,
          category: 'domain' as any,
          code: 'SHARED_DOMAIN_UNKNOWN' as any,
          message: 'Unknown error',
        };

        const result = matchSharedError(unknownError as any, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback_used',
        });
        expect(result).toBe('fallback_used');
      });
    });

    describe('safeMatchSharedError', () => {
      it('должен возвращать результат для SharedError', () => {
        const error = createMockSharedDomainError();
        const result = safeMatchSharedError(error, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback',
        });
        expect(result).toBe('domain_handled');
      });

      it('должен возвращать undefined для не-SharedError', () => {
        const invalidError = createInvalidError();
        const result = safeMatchSharedError(invalidError, {
          sharedDomainError: () => 'domain_handled',
          sharedInfraError: () => 'infra_handled',
          sharedPolicyError: () => 'policy_handled',
          sharedAdapterError: () => 'adapter_handled',
          fallback: () => 'fallback',
        });
        expect(result).toBeUndefined();
      });
    });
  });

  describe('SharedErrorKind utilities', () => {
    describe('getSharedErrorKind', () => {
      it('должен извлекать правильный kind из SharedDomainError', () => {
        const error = createMockSharedDomainError();
        expect(getSharedErrorKind(error)).toBe('SharedDomainError');
      });

      it('должен извлекать правильный kind из SharedInfraError', () => {
        const error = createMockSharedInfraError();
        expect(getSharedErrorKind(error)).toBe('SharedInfraError');
      });

      it('должен извлекать правильный kind из SharedPolicyError', () => {
        const error = createMockSharedPolicyError();
        expect(getSharedErrorKind(error)).toBe('SharedPolicyError');
      });

      it('должен извлекать правильный kind из SharedAdapterError', () => {
        const error = createMockSharedAdapterError();
        expect(getSharedErrorKind(error)).toBe('SharedAdapterError');
      });
    });

    describe('isSharedErrorKind', () => {
      it('должен возвращать true для правильного kind', () => {
        const error = createMockSharedDomainError();
        expect(isSharedErrorKind<SharedDomainError>(error, 'SharedDomainError')).toBe(true);
      });

      it('должен возвращать false для неправильного kind', () => {
        const error = createMockSharedDomainError();
        expect(isSharedErrorKind<SharedInfraError>(error, 'SharedInfraError')).toBe(false);
      });

      it('должен обеспечивать type narrowing', () => {
        const error = createMockSharedDomainError();
        if (isSharedErrorKind<SharedDomainError>(error, 'SharedDomainError')) {
          // TypeScript знает что error имеет тип SharedDomainError
          expect(error.category).toBe('domain');
          expect(error._tag).toBe('SharedDomainError');
        }
      });
    });

    describe('groupSharedErrorsByKind', () => {
      it('должен группировать ошибки по их kind', () => {
        const errors: SharedError[] = [
          createMockSharedDomainError(),
          createMockSharedInfraError(),
          createMockSharedDomainError('SHARED_DOMAIN_ACCESS_DENIED'),
          createMockSharedInfraError('SHARED_INFRA_CACHE_MISS'),
        ];

        const groups = groupSharedErrorsByKind(errors);

        expect(groups.size).toBe(2);
        expect(groups.get('SharedDomainError')).toHaveLength(2);
        expect(groups.get('SharedInfraError')).toHaveLength(2);
        expect(groups.get('SharedPolicyError')).toBeUndefined();
      });

      it('должен возвращать пустую Map для пустого массива', () => {
        const groups = groupSharedErrorsByKind([]);
        expect(groups.size).toBe(0);
      });

      it('должен корректно группировать один элемент', () => {
        const error = createMockSharedDomainError();
        const groups = groupSharedErrorsByKind([error]);

        expect(groups.size).toBe(1);
        expect(groups.get('SharedDomainError')).toHaveLength(1);
        expect(groups.get('SharedDomainError')![0]).toBe(error);
      });

      it('должен создавать immutable копии', () => {
        const errors1 = [createMockSharedDomainError()];
        const errors2 = [createMockSharedDomainError(), createMockSharedInfraError()];

        const groups1 = groupSharedErrorsByKind(errors1);
        const groups2 = groupSharedErrorsByKind(errors2);

        // Проверяем, что разные входные данные дают разные результаты
        expect(groups1.get('SharedDomainError')).toHaveLength(1);
        expect(groups2.get('SharedDomainError')).toHaveLength(1);
        expect(groups2.get('SharedInfraError')).toHaveLength(1);

        // Проверяем, что функция возвращает новые Map объекты
        expect(groups1).not.toBe(groups2);
        expect(groups1.get('SharedDomainError')).not.toBe(groups2.get('SharedDomainError'));
      });
    });
  });

  describe('Assert helpers', () => {
    describe('validateSharedError', () => {
      it('должен возвращать success для SharedError', () => {
        const error = createMockSharedDomainError();
        const result = validateSharedError(error);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(error);
        expect(result.error).toBeUndefined();
      });

      it('должен возвращать error для не-SharedError', () => {
        const invalidError = createInvalidError();
        const result = validateSharedError(invalidError);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Expected SharedError');
        expect(result.value).toBeUndefined();
      });
    });

    describe('validateSharedErrorKind', () => {
      it('должен возвращать success для правильного kind', () => {
        const error = createMockSharedDomainError();
        const result = validateSharedErrorKind(error, 'SharedDomainError');
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(error);
        expect(result.error).toBeUndefined();
      });

      it('должен возвращать error для неправильного kind', () => {
        const error = createMockSharedDomainError();
        const result = validateSharedErrorKind(error, 'SharedInfraError');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Expected SharedError of kind SharedInfraError');
        expect(result.value).toBeUndefined();
      });
    });

    describe('validateSharedErrorCategory', () => {
      it('должен возвращать success для правильной категории', () => {
        const error = createMockSharedDomainError();
        const result = validateSharedErrorCategory(error, 'domain');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('должен возвращать error для неправильной категории', () => {
        const error = createMockSharedDomainError();
        const result = validateSharedErrorCategory(error, 'infrastructure');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Expected SharedError with category infrastructure');
      });
    });

    describe('validateSharedErrorCode', () => {
      it('должен возвращать success для кода с SHARED_ префиксом', () => {
        const result = validateSharedErrorCode('SHARED_DOMAIN_USER_NOT_FOUND');
        expect(result.isValid).toBe(true);
        expect(result.value).toBe('SHARED_DOMAIN_USER_NOT_FOUND');
        expect(result.error).toBeUndefined();
      });

      it('должен возвращать error для кода без SHARED_ префикса', () => {
        const result = validateSharedErrorCode('USER_NOT_FOUND');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Expected SharedError code with SHARED_ prefix');
        expect(result.value).toBeUndefined();
      });
    });
  });

  describe('Integration tests', () => {
    describe('Полный workflow', () => {
      it('должен поддерживать полный цикл: создание → проверка → pattern matching → grouping', () => {
        // Создание ошибок
        const errors: SharedError[] = [
          createMockSharedDomainError(),
          createMockSharedInfraError(),
          createMockSharedPolicyError(),
          createMockSharedAdapterError(),
          createMockSharedDomainError('SHARED_DOMAIN_VALIDATION_FAILED'),
        ];

        // Проверка типов
        errors.forEach(error => {
          expect(isSharedError(error)).toBe(true);
        });

        // Pattern matching
        const results = errors.map(error =>
          matchSharedError(error, {
            sharedDomainError: () => 'domain',
            sharedInfraError: () => 'infra',
            sharedPolicyError: () => 'policy',
            sharedAdapterError: () => 'adapter',
            fallback: () => 'unknown',
          })
        );

        expect(results).toEqual(['domain', 'infra', 'policy', 'adapter', 'domain']);

        // Grouping
        const groups = groupSharedErrorsByKind(errors);
        expect(groups.get('SharedDomainError')).toHaveLength(2);
        expect(groups.get('SharedInfraError')).toHaveLength(1);
        expect(groups.get('SharedPolicyError')).toHaveLength(1);
        expect(groups.get('SharedAdapterError')).toHaveLength(1);
      });

      it('должен поддерживать assert helpers в workflow', () => {
        const error = createMockSharedDomainError();

        // Validation chain
        const errorValidation = validateSharedError(error);
        const categoryValidation = validateSharedErrorCategory(error, 'domain');
        const codeValidation = validateSharedErrorCode(error.code);

        expect(errorValidation.isValid).toBe(true);
        expect(categoryValidation.isValid).toBe(true);
        expect(codeValidation.isValid).toBe(true);

        // После всех assert'ов TypeScript знает точный тип
        expect(error.category).toBe('domain');
        expect(error._tag).toBe('SharedDomainError');
      });
    });

    describe('Error boundaries simulation', () => {
      it('должен правильно работать в error boundary сценарии', () => {
        const externalErrors = [
          createMockSharedDomainError(),
          createInvalidError(),
          createMockSharedInfraError(),
          { code: 'INVALID', message: 'test' }, // Не SharedError
        ];

        const validSharedErrors = externalErrors.filter(isSharedError);
        expect(validSharedErrors).toHaveLength(2);

        // Все прошедшие фильтр ошибки должны быть валидными
        validSharedErrors.forEach(error => {
          const validation = validateSharedError(error);
          expect(validation.isValid).toBe(true);
          expect(error.code).toMatch(/^SHARED_/);
        });
      });
    });
  });
});