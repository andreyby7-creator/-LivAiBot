/**
 * @file Unit тесты для packages/app/src/lib/schema-validated-effect.ts
 * Enterprise-grade тестирование schema-validated-effect с 100% покрытием:
 * - SchemaValidationError конструктор и свойства
 * - isSchemaValidationError type guard
 * - createValidationError с различными параметрами
 * - validatedEffect для всех сценариев (успех, ошибки валидации, пробрасывание ошибок)
 * - Кастомные errorMapper, errorCode, service
 * - Преобразование Zod ошибок в ValidationError
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { Effect } from '../../../src/lib/effect-utils.js';
import type { MappedError, ServiceErrorCode } from '../../../src/lib/error-mapping.js';
import {
  createValidationError,
  isSchemaValidationError,
  SchemaValidationError,
  validatedEffect,
} from '../../../src/lib/schema-validated-effect.js';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock Effect, который успешно выполняется
 */
function createMockSuccessEffect<T>(value: Readonly<T>): Effect<T> {
  return async (): Promise<T> => {
    return value;
  };
}

/**
 * Создает mock Effect, который выбрасывает ошибку
 */
function createMockErrorEffect(error: Readonly<Error>): Effect<never> {
  return async (): Promise<never> => {
    throw error;
  };
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Schema Validated Effect - Enterprise Grade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SchemaValidationError
  // ==========================================================================

  describe('SchemaValidationError', () => {
    it('должен создавать ошибку с mappedError и validationErrors', () => {
      const mappedError: MappedError<unknown> = {
        code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        message: 'Validation failed',
        timestamp: Date.now(),
        service: 'SYSTEM',
      };
      const validationErrors = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          service: 'SYSTEM',
          field: 'email',
          message: 'Invalid email',
        },
      ] as const;

      const error = new SchemaValidationError(mappedError, validationErrors);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SchemaValidationError);
      expect(error.name).toBe('SchemaValidationError');
      expect(error.message).toBe(mappedError.message);
      expect(error.mappedError).toBe(mappedError);
      expect(error.validationErrors).toBe(validationErrors);
    });
  });

  // ==========================================================================
  // isSchemaValidationError
  // ==========================================================================

  describe('isSchemaValidationError', () => {
    it('должен возвращать true для SchemaValidationError', () => {
      const mappedError: MappedError<unknown> = {
        code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        message: 'Validation failed',
        timestamp: Date.now(),
      };
      const error = new SchemaValidationError(mappedError, []);
      expect(isSchemaValidationError(error)).toBe(true);
    });

    it('должен возвращать false для обычного Error', () => {
      const error = new Error('Test');
      expect(isSchemaValidationError(error)).toBe(false);
    });

    it('должен возвращать false для string', () => {
      expect(isSchemaValidationError('error')).toBe(false);
    });

    it('должен возвращать false для null', () => {
      expect(isSchemaValidationError(null)).toBe(false);
    });

    it('должен возвращать false для undefined', () => {
      expect(isSchemaValidationError(undefined)).toBe(false);
    });
  });

  // ==========================================================================
  // createValidationError
  // ==========================================================================

  describe('createValidationError', () => {
    it('должен создавать MappedError с дефолтными параметрами', () => {
      const validationErrors = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          service: 'SYSTEM',
          field: 'email',
          message: 'Invalid email',
        },
      ] as const;

      const mappedError = createValidationError(validationErrors);

      expect(mappedError.code).toBe('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID');
      expect(mappedError.message).toBeDefined();
      expect(mappedError.timestamp).toBeGreaterThan(0);
      // service может быть undefined, если не передан явно в createValidationError
      // Проверяем только что код и сообщение определены
    });

    it('должен создавать MappedError с кастомным errorCode', () => {
      const validationErrors = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          service: 'SYSTEM',
        },
      ] as const;

      const mappedError = createValidationError(
        validationErrors,
        'AUTH_INVALID_TOKEN',
      );

      expect(mappedError.code).toBe('AUTH_INVALID_TOKEN');
    });

    it('должен создавать MappedError с кастомным service', () => {
      const validationErrors = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          service: 'SYSTEM',
        },
      ] as const;

      const mappedError = createValidationError(validationErrors, undefined, 'AUTH');

      expect(mappedError.service).toBe('AUTH');
    });

    it('должен создавать MappedError с кастомным errorCode и service', () => {
      const validationErrors = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          service: 'SYSTEM',
        },
      ] as const;

      const mappedError = createValidationError(
        validationErrors,
        'BILLING_INSUFFICIENT_FUNDS',
        'BILLING',
      );

      expect(mappedError.code).toBe('BILLING_INSUFFICIENT_FUNDS');
      expect(mappedError.service).toBe('BILLING');
    });
  });

  // ==========================================================================
  // validatedEffect
  // ==========================================================================

  describe('validatedEffect', () => {
    it('должен успешно валидировать результат и пробрасывать его без изменений', async () => {
      const schema = z.object({
        id: z.string(),
        email: z.string().email(),
      });
      const validData = { id: '123', email: 'test@example.com' };
      const effect = createMockSuccessEffect(validData);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toEqual(validData);
      expect(result.id).toBe('123');
      expect(result.email).toBe('test@example.com');
    });

    it('должен бросать SchemaValidationError при невалидных данных', async () => {
      const schema = z.object({
        id: z.string(),
        email: z.string().email(),
      });
      const invalidData = { id: '123', email: 'invalid-email' };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      await expect(validated()).rejects.toThrow(SchemaValidationError);
      // Сообщение зависит от локали, проверяем что оно определено
      try {
        await validated();
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        if (error instanceof SchemaValidationError) {
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
        }
      }
    });

    it('должен бросать SchemaValidationError с правильными validationErrors', async () => {
      const schema = z.object({
        id: z.string(),
        email: z.string().email(),
      });
      const invalidData = { id: '123', email: 'invalid-email' };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.validationErrors.length).toBeGreaterThan(0);
          expect(error.validationErrors[0]?.field).toBe('email');
          expect(error.mappedError.code).toBe('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен пробрасывать ошибки от effect дальше (не глотать)', async () => {
      const schema = z.object({
        id: z.string(),
      });
      const originalError = new Error('Effect error');
      const effect = createMockErrorEffect(originalError);

      const validated = validatedEffect(schema, effect);

      await expect(validated()).rejects.toThrow(originalError);
      await expect(validated()).rejects.toThrow('Effect error');
    });

    it('должен работать с примитивными типами', async () => {
      const schema = z.string();
      const effect = createMockSuccessEffect('test-string');

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toBe('test-string');
    });

    it('должен работать с number типом', async () => {
      const schema = z.number();
      const effect = createMockSuccessEffect(42);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toBe(42);
    });

    it('должен работать с boolean типом', async () => {
      const schema = z.boolean();
      const effect = createMockSuccessEffect(true);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toBe(true);
    });

    it('должен работать с array типом', async () => {
      const schema = z.array(z.string());
      const effect = createMockSuccessEffect(['a', 'b', 'c']);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('должен работать с nested объектами', async () => {
      const schema = z.object({
        user: z.object({
          id: z.string(),
          profile: z.object({
            name: z.string(),
          }),
        }),
      });
      const validData = {
        user: {
          id: '123',
          profile: {
            name: 'John',
          },
        },
      };
      const effect = createMockSuccessEffect(validData);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toEqual(validData);
    });

    it('должен обрабатывать множественные ошибки валидации', async () => {
      const schema = z.object({
        id: z.string().min(5),
        email: z.string().email(),
        age: z.number().min(18),
      });
      const invalidData = { id: '12', email: 'invalid', age: 15 };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.validationErrors.length).toBeGreaterThanOrEqual(3);
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен использовать кастомный errorMapper', async () => {
      const schema = z.object({
        id: z.string(),
      });
      const invalidData = { id: 123 };
      const effect = createMockSuccessEffect(invalidData);

      const customMapper = (): MappedError<unknown> => ({
        code: 'AUTH_INVALID_TOKEN' as ServiceErrorCode,
        message: 'Custom error message',
        timestamp: Date.now(),
        service: 'AUTH',
      });

      const validated = validatedEffect(schema, effect, { errorMapper: customMapper });

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.mappedError.code).toBe('AUTH_INVALID_TOKEN');
          expect(error.mappedError.message).toBe('Custom error message');
          expect(error.mappedError.service).toBe('AUTH');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен использовать кастомный errorCode', async () => {
      const schema = z.object({
        id: z.string(),
      });
      const invalidData = { id: 123 };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect, {
        errorCode: 'AUTH_INVALID_TOKEN',
      });

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.mappedError.code).toBe('AUTH_INVALID_TOKEN');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен использовать кастомный service', async () => {
      const schema = z.object({
        id: z.string(),
      });
      const invalidData = { id: 123 };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect, {
        service: 'AUTH',
      });

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.mappedError.service).toBe('AUTH');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен использовать кастомный errorCode и service вместе', async () => {
      const schema = z.object({
        id: z.string(),
      });
      const invalidData = { id: 123 };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect, {
        errorCode: 'BILLING_INSUFFICIENT_FUNDS',
        service: 'BILLING',
      });

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.mappedError.code).toBe('BILLING_INSUFFICIENT_FUNDS');
          expect(error.mappedError.service).toBe('BILLING');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен работать без options', async () => {
      const schema = z.string();
      const effect = createMockSuccessEffect('test');

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toBe('test');
    });

    it('должен работать с пустыми options', async () => {
      const schema = z.string();
      const effect = createMockSuccessEffect('test');

      const validated = validatedEffect(schema, effect, {});
      const result = await validated();

      expect(result).toBe('test');
    });

    it('должен пробрасывать AbortSignal в effect', async () => {
      const schema = z.string();
      let receivedSignal: AbortSignal | undefined;
      const effect: Effect<string> = async (signal?: AbortSignal) => {
        receivedSignal = signal;
        return 'test';
      };

      const validated = validatedEffect(schema, effect);
      const controller = new AbortController();
      await validated(controller.signal);

      expect(receivedSignal).toBe(controller.signal);
    });

    it('должен обрабатывать Zod ошибки с nested paths', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email(),
          }),
        }),
      });
      const invalidData = {
        user: {
          profile: {
            email: 'invalid-email',
          },
        },
      };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.validationErrors.length).toBeGreaterThan(0);
          const firstError = error.validationErrors[0];
          expect(firstError?.field).toContain('user');
          expect(firstError?.field).toContain('profile');
          expect(firstError?.field).toContain('email');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен обрабатывать Zod ошибки с array paths', async () => {
      const schema = z.object({
        items: z.array(z.object({
          id: z.string(),
        })),
      });
      const invalidData = {
        items: [
          { id: 'valid' },
          { id: 123 },
        ],
      };
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.validationErrors.length).toBeGreaterThan(0);
          const firstError = error.validationErrors[0];
          expect(firstError?.field).toContain('items');
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен обрабатывать Zod ошибки без path (root level)', async () => {
      const schema = z.string();
      const invalidData = 123;
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      try {
        await validated();
        expect.fail('Should have thrown SchemaValidationError');
      } catch (error: unknown) {
        if (isSchemaValidationError(error)) {
          expect(error.validationErrors.length).toBeGreaterThan(0);
          const firstError = error.validationErrors[0];
          expect(firstError?.field).toBeUndefined();
        } else {
          expect.fail('Should be SchemaValidationError');
        }
      }
    });

    it('должен работать с union типами', async () => {
      const schema = z.union([z.string(), z.number()]);
      const effect = createMockSuccessEffect('test');

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toBe('test');
    });

    it('должен валидировать union типы и бросать ошибку при несоответствии', async () => {
      const schema = z.union([z.string(), z.number()]);
      const invalidData = true;
      const effect = createMockSuccessEffect(invalidData);

      const validated = validatedEffect(schema, effect);

      await expect(validated()).rejects.toThrow(SchemaValidationError);
    });

    it('должен работать с optional полями', async () => {
      const schema = z.object({
        id: z.string(),
        email: z.string().email().optional(),
      });
      const validData = { id: '123' };
      const effect = createMockSuccessEffect(validData);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toEqual(validData);
    });

    it('должен работать с nullable полями', async () => {
      const schema = z.object({
        id: z.string(),
        email: z.string().email().nullable(),
      });
      const validData = { id: '123', email: null };
      const effect = createMockSuccessEffect(validData);

      const validated = validatedEffect(schema, effect);
      const result = await validated();

      expect(result).toEqual(validData);
    });
  });
});
