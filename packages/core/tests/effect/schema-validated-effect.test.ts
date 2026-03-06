/**
 * @file Unit тесты для schema-validated-effect.ts
 * Цель: 100% coverage для SchemaValidationError, isSchemaValidationError, zodErrorsToValidationErrors, validatedEffect.
 */

import { describe, expect, it, vi } from 'vitest';

import type { ServiceErrorCode, ServicePrefix } from '../../src/effect/error-mapping.js';
import type { ValidationError } from '../../src/effect/validation.js';

describe('effect/schema-validated-effect', () => {
  it('SchemaValidationError и isSchemaValidationError работают корректно', async () => {
    const { SchemaValidationError: schemaValidationErrorCtor, isSchemaValidationError } =
      await import(
        '../../src/effect/schema-validated-effect.js'
      );

    const mappedError = {
      code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID' as ServiceErrorCode,
      message: 'Validation failed',
      service: 'SYSTEM' as ServicePrefix,
      timestamp: 123,
    } satisfies {
      code: ServiceErrorCode;
      message: string;
      service: ServicePrefix;
      timestamp: number;
    };
    const ve: ValidationError = {
      code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID' as ServiceErrorCode,
      field: 'email',
      message: 'Invalid email',
      details: { any: true },
      service: 'SYSTEM',
    };

    const err = new schemaValidationErrorCtor(mappedError, [ve]);

    expect(err).toBeInstanceOf(schemaValidationErrorCtor);
    expect(err.name).toBe('SchemaValidationError');
    expect(err.message).toBe('Validation failed');
    expect(err.mappedError).toBe(mappedError);
    expect(err.validationErrors).toEqual([ve]);

    expect(isSchemaValidationError(err)).toBe(true);
    expect(isSchemaValidationError(new Error('x'))).toBe(false);
    expect(isSchemaValidationError(null)).toBe(false);
  });

  it('validatedEffect: success path → возвращает parseResult.data и вызывает telemetry.onSuccess', async () => {
    const schema = {
      safeParse: (value: unknown) => ({
        success: true as const,
        data: `ok:${String(value)}`,
      }),
    };

    const effect = vi.fn(async () => 'value');
    const onSuccess = vi.fn();
    const onValidationError = vi.fn();

    const { validatedEffect } = await import('../../src/effect/schema-validated-effect.js');

    const validated = validatedEffect(
      schema,
      effect,
      {
        telemetry: { onSuccess, onValidationError },
        service: 'AUTH',
        errorCode: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
      },
    );

    const result = await validated();

    expect(result).toBe('ok:value');
    expect(effect).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({
      service: 'AUTH',
      errorCode: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
    });
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it('validatedEffect: failure path по умолчанию → использует createDomainError и telemetry.onValidationError', async () => {
    vi.resetModules();

    const schema = {
      safeParse: () => ({
        success: false as const,
        error: {
          issues: [
            {
              path: ['user', 'email'],
              message: 'invalid email',
            },
            {
              path: [Symbol('ignored') as unknown as PropertyKey],
              message: 'symbol path',
            },
          ],
        },
      }),
    };

    const effect = vi.fn(async () => ({ raw: true }));
    const mappedError = {
      code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID' as ServiceErrorCode,
      message: 'mapped',
      service: 'AUTH' as ServicePrefix,
      timestamp: 999,
    };

    const createDomainError = vi.fn(() => mappedError);

    vi.doMock('../../src/effect/error-mapping.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/effect/error-mapping.js')>(
        '../../src/effect/error-mapping.js',
      );
      return {
        ...actual,
        createDomainError,
      };
    });

    const { validatedEffect, isSchemaValidationError } = await import(
      '../../src/effect/schema-validated-effect.js'
    );

    const onValidationError = vi.fn();

    const validated = validatedEffect(
      schema,
      effect,
      {
        service: 'AUTH',
        errorCode: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        telemetry: { onValidationError },
      },
    );

    await expect(validated()).rejects.toSatisfy((e: unknown) => {
      if (!isSchemaValidationError(e)) {
        return false;
      }
      expect(e.mappedError).toBe(mappedError);
      expect(e.validationErrors).toHaveLength(2);
      const [first, second] = e.validationErrors;
      expect(first?.field).toBe('user.email');
      expect(first?.service).toBe('AUTH');
      expect(second?.field).toBeUndefined();
      return true;
    });

    expect(createDomainError).toHaveBeenCalledTimes(1);

    expect(onValidationError).toHaveBeenCalledTimes(1);
    expect(onValidationError.mock.calls[0]?.[0]).toMatchObject({
      service: 'AUTH',
      errorCode: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
    });
  });

  it('validatedEffect: failure path без service → ValidationError.service по умолчанию SYSTEM', async () => {
    vi.resetModules();

    const schema = {
      safeParse: () => ({
        success: false as const,
        error: {
          issues: [
            {
              path: ['field'],
              message: 'bad',
            },
          ],
        },
      }),
    };

    const effect = vi.fn(async () => 'x');
    const onValidationError = vi.fn();

    const { validatedEffect, isSchemaValidationError } = await import(
      '../../src/effect/schema-validated-effect.js'
    );

    const validated = validatedEffect(
      schema,
      effect,
      {
        telemetry: { onValidationError },
      },
    );

    await expect(validated()).rejects.toSatisfy((e: unknown) => {
      if (!isSchemaValidationError(e)) {
        return false;
      }
      const [first] = e.validationErrors;
      expect(first?.service).toBe('SYSTEM');
      return true;
    });

    expect(onValidationError).toHaveBeenCalledTimes(1);
    const payload = onValidationError.mock.calls[0]?.[0] as {
      errors: readonly ValidationError[];
    };
    expect(Array.isArray(payload.errors)).toBe(true);
    const [firstError] = payload.errors;
    expect(firstError?.service).toBe('SYSTEM');
  });

  it('validatedEffect: failure path с кастомным errorMapper → не вызывает createDomainError', async () => {
    vi.resetModules();

    const schema = {
      safeParse: () => ({
        success: false as const,
        error: {
          issues: [
            {
              path: ['field'],
              message: 'bad',
            },
          ],
        },
      }),
    };

    const effect = vi.fn(async () => 'x');

    const mappedError = {
      code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID' as ServiceErrorCode,
      message: 'custom',
      service: 'AUTH' as ServicePrefix,
      timestamp: 1,
    };

    const errorMapper = vi.fn((_errors: readonly ValidationError[]) => mappedError);

    const createDomainError = vi.fn();

    vi.doMock('../../src/effect/error-mapping.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/effect/error-mapping.js')>(
        '../../src/effect/error-mapping.js',
      );
      return {
        ...actual,
        createDomainError,
      };
    });

    const { validatedEffect, isSchemaValidationError } = await import(
      '../../src/effect/schema-validated-effect.js'
    );

    const validated = validatedEffect(
      schema,
      effect,
      {
        errorMapper,
        service: 'AUTH',
        errorCode: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
      },
    );

    await expect(validated()).rejects.toSatisfy((e: unknown) => {
      if (!isSchemaValidationError(e)) {
        return false;
      }
      expect(e.mappedError).toBe(mappedError);
      return true;
    });

    expect(errorMapper).toHaveBeenCalledTimes(1);
    expect(createDomainError).not.toHaveBeenCalled();
  });

  it('validatedEffect: ошибки исходного effect не ловятся и пробрасываются как есть', async () => {
    const schema = {
      safeParse: () => ({
        success: true as const,
        data: 'any',
      }),
    };

    const originalError = new Error('network failure');
    const effect = vi.fn(async () => {
      throw originalError;
    });

    const { validatedEffect } = await import('../../src/effect/schema-validated-effect.js');

    const validated = validatedEffect(schema, effect);

    await expect(validated()).rejects.toBe(originalError);
  });

  it('validatedEffect: поддерживает previousResult (совместимость с stepWithPrevious)', async () => {
    const schema = {
      safeParse: (value: unknown) => ({
        success: true as const,
        data: value as { sum: number; },
      }),
    };

    const effectWithPrevious = vi.fn(
      async (_signal?: AbortSignal, previous?: { a: number; b: number; }) => ({
        sum: (previous?.a ?? 0) + (previous?.b ?? 0),
      }),
    );

    const { validatedEffect } = await import('../../src/effect/schema-validated-effect.js');

    const validated = validatedEffect(schema, effectWithPrevious) as (
      signal?: AbortSignal,
      previousResult?: { a: number; b: number; },
    ) => Promise<{ sum: number; }>;

    const result = await validated(undefined, { a: 2, b: 3 });
    expect(result).toEqual({ sum: 5 });
    expect(effectWithPrevious).toHaveBeenCalledWith(undefined, { a: 2, b: 3 });
  });
});
