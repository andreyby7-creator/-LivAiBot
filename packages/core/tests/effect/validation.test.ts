/**
 * @file Unit тесты для validation.ts
 * Покрывают ValidationResult, ValidationError, pipe/pipeMany/pipeChain/all,
 * validateObject, validateFormData и validateForm, а также file-валидаторы.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncValidator,
  ObjectSchema,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../../src/effect/validation.js';
import {
  all,
  asyncPipe,
  fail,
  formatFileSize,
  isNumber,
  isString,
  nullable,
  ok,
  optional,
  pipe,
  pipeChain,
  pipeMany,
  refine,
  required,
  toAsync,
  validateFileBasic,
  validateForm,
  validateFormData,
  validateObject,
  validationError,
} from '../../src/effect/validation.js';

const BASE_CTX: ValidationContext = {};

// Общие helper'ы для нескольких тестов, чтобы избежать дублирования реализаций.
const stringValidator: Validator<string> = (input, _ctx) =>
  typeof input === 'string'
    ? ok(input)
    : fail(validationError('SYSTEM_UNKNOWN_ERROR'));

const trimStep: (value: string, ctx: ValidationContext) => ValidationResult<string> = (
  value,
  _ctx,
) => ok(value.trim());

const toNumberStep: (value: string, ctx: ValidationContext) => ValidationResult<number> = (
  value,
  _ctx,
) => {
  const n = Number(value);
  return Number.isNaN(n)
    ? fail(validationError('SYSTEM_UNKNOWN_ERROR'))
    : ok(n);
};

describe('validation core', () => {
  describe('ValidationError / validationError', () => {
    it('создает ValidationError с кодом и полями', () => {
      const error = validationError('SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID', {
        field: 'email',
        message: 'invalid email',
        details: { pattern: '.*@.*' },
        service: 'SYSTEM',
      });

      expect(error.code).toBe('SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID');
      expect(error.service).toBe('SYSTEM');
      expect(error.field).toBe('email');
      expect(error.message).toBe('invalid email');
      expect(error.details).toEqual({ pattern: '.*@.*' });
    });

    it('по умолчанию использует service SYSTEM', () => {
      const error = validationError('SYSTEM_UNKNOWN_ERROR');
      expect(error.service).toBe('SYSTEM');
    });
  });

  describe('ValidationResult / ok / fail', () => {
    it('ok возвращает успешный результат с value', () => {
      const result = ok<number>(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it('fail c одним ValidationError возвращает массив из одной ошибки', () => {
      const e = validationError('SYSTEM_UNKNOWN_ERROR');
      const result = fail(e);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(e);
      }
    });

    it('fail с массивом ValidationError возвращает тот же массив', () => {
      const e1 = validationError('SYSTEM_UNKNOWN_ERROR');
      const e2 = validationError('SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID');
      const result = fail([e1, e2]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toEqual([e1, e2]);
      }
    });
  });

  describe('базовые валидаторы', () => {
    it('required валидирует presence', () => {
      const v = required<string>('SYSTEM_UNKNOWN_ERROR', 'field');

      const okResult = v('value', BASE_CTX);
      expect(okResult.success).toBe(true);

      const failNull = v(null, BASE_CTX);
      expect(failNull.success).toBe(false);

      const failUndefined = v(undefined, BASE_CTX);
      expect(failUndefined.success).toBe(false);
    });

    it('isString валидирует строки', () => {
      const v = isString('SYSTEM_UNKNOWN_ERROR', 'field');

      expect(v('ok', BASE_CTX).success).toBe(true);
      expect(v(42, BASE_CTX).success).toBe(false);
    });

    it('isNumber валидирует числа', () => {
      const v = isNumber('SYSTEM_UNKNOWN_ERROR', 'field');

      expect(v(10, BASE_CTX).success).toBe(true);
      expect(v(NaN, BASE_CTX).success).toBe(false);
      expect(v('10' as unknown, BASE_CTX).success).toBe(false);
    });

    it('refine добавляет дополнительное условие', () => {
      const base = isNumber('SYSTEM_UNKNOWN_ERROR', 'age');
      const positive = refine(
        base,
        (n) => n > 0,
        'SYSTEM_UNKNOWN_ERROR',
        'age',
      );

      expect(positive(10, BASE_CTX).success).toBe(true);
      const negative = positive(-1, BASE_CTX);
      expect(negative.success).toBe(false);
    });

    it('optional пропускает undefined', () => {
      const base = isString('SYSTEM_UNKNOWN_ERROR', 'name');
      const opt = optional(base);

      expect(opt(undefined, BASE_CTX).success).toBe(true);
      expect(opt('ok', BASE_CTX).success).toBe(true);
      expect(opt(42 as unknown, BASE_CTX).success).toBe(false);
    });

    it('nullable пропускает null', () => {
      const base = isString('SYSTEM_UNKNOWN_ERROR', 'name');
      const nul = nullable(base);

      expect(nul(null, BASE_CTX).success).toBe(true);
      expect(nul('ok', BASE_CTX).success).toBe(true);
      expect(nul(42 as unknown, BASE_CTX).success).toBe(false);
    });
  });

  describe('композиция: pipe / pipeMany / all / pipeChain', () => {
    it('pipe композирует два валидатора', () => {
      const requiredString = required<string>('SYSTEM_UNKNOWN_ERROR', 'name');
      const upper: (value: string, ctx: ValidationContext) => ValidationResult<string> = (
        value,
        _ctx,
      ) => ok(value.toUpperCase());
      const v = pipe(requiredString, upper);

      const result = v('alice', BASE_CTX);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('ALICE');
      }
    });

    it('pipeMany выполняет валидаторы последовательно до первой ошибки', () => {
      const lengthAtLeast3 = (value: string, _ctx: ValidationContext): ValidationResult<string> =>
        value.length >= 3
          ? ok(value)
          : fail(validationError('SYSTEM_UNKNOWN_ERROR', { field: 'name' }));

      const v = pipeMany<string>(
        isString('SYSTEM_UNKNOWN_ERROR', 'name'),
        lengthAtLeast3 as Validator<string>,
      );

      expect(v('okay', BASE_CTX).success).toBe(true);
      expect(v('', BASE_CTX).success).toBe(false);
    });

    it('all агрегирует все ошибки валидации', () => {
      const isNonEmpty: Validator<string> = (input, ctx) => {
        if (typeof input !== 'string' || input.length === 0) {
          return fail(
            validationError('SYSTEM_UNKNOWN_ERROR', {
              field: 'name',
              service: ctx.service,
            }),
          );
        }
        return ok(input);
      };

      const hasAtSymbol: Validator<string> = (input, ctx) => {
        if (typeof input !== 'string' || !input.includes('@')) {
          return fail(
            validationError('SYSTEM_UNKNOWN_ERROR', {
              field: 'name',
              service: ctx.service,
            }),
          );
        }
        return ok(input);
      };

      const v = all(isNonEmpty, hasAtSymbol);

      const okResult = v('user@example.com', BASE_CTX);
      expect(okResult.success).toBe(true);

      const badResult = v('', BASE_CTX);
      expect(badResult.success).toBe(false);
      if (!badResult.success) {
        expect(badResult.errors.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('pipeChain позволяет типобезопасную цепочку преобразований', () => {
      const v = pipeChain(stringValidator, trimStep, toNumberStep);

      const okResult = v(' 42 ', BASE_CTX);
      expect(okResult.success).toBe(true);
      if (okResult.success) {
        expect(okResult.value).toBe(42);
      }

      const badResult = v('not-a-number', BASE_CTX);
      expect(badResult.success).toBe(false);
    });
  });

  describe('asyncPipe / toAsync', () => {
    it('toAsync оборачивает sync-валидатор в async', async () => {
      const asyncV = toAsync(stringValidator);

      const result = await asyncV('ok', BASE_CTX);
      expect(result.success).toBe(true);
    });

    it('asyncPipe композирует асинхронные валидаторы', async () => {
      const v1: AsyncValidator<string> = async (input, ctx) => stringValidator(input, ctx);

      const v2 = async (
        value: string,
        ctx: ValidationContext,
      ): Promise<ValidationResult<number>> => toNumberStep(value, ctx);

      const v = asyncPipe(v1, v2);

      const okResult = await v('123', BASE_CTX);
      expect(okResult.success).toBe(true);

      const badResult = await v('x', BASE_CTX);
      expect(badResult.success).toBe(false);
    });
  });

  describe('validateObject', () => {
    it('возвращает SYSTEM_UNKNOWN_ERROR если вход не объект', () => {
      const schema: ObjectSchema<{ name: string; }> = {
        name: isString('SYSTEM_UNKNOWN_ERROR', 'name'),
      };
      const v = validateObject(schema);

      const result = v(null, BASE_CTX);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.code).toBe('SYSTEM_UNKNOWN_ERROR');
      }
    });

    it('валидирует объект и аккумулирует ВСЕ ошибки', () => {
      const schema: ObjectSchema<{ name: string; age: number; }> = {
        name: isString('SYSTEM_UNKNOWN_ERROR', 'name'),
        age: isNumber('SYSTEM_UNKNOWN_ERROR', 'age'),
      };
      const v = validateObject(schema);

      const okResult = v({ name: 'Alice', age: 30 }, BASE_CTX);
      expect(okResult.success).toBe(true);
      if (okResult.success) {
        expect(okResult.value).toEqual({ name: 'Alice', age: 30 });
      }

      const badResult = v({ name: 42, age: 'x' } as unknown, BASE_CTX);
      expect(badResult.success).toBe(false);
      if (!badResult.success) {
        // обе ошибки должны присутствовать
        const fields = badResult.errors.map((e) => e.field);
        expect(fields).toContain('name');
        expect(fields).toContain('age');
      }
    });
  });

  /* eslint-disable ai-security/model-poisoning -- тесты намеренно используют "сырые" данные как вход для validateFormData */
  describe('validateFormData / validateForm', () => {
    it('validateFormData возвращает ok, если схема не ObjectSchema', () => {
      const data = { name: 'Alice' };
      const schema: unknown = 'not-a-schema';
      const result = validateFormData(data, schema, BASE_CTX);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(data);
      }
    });

    it('validateFormData использует validateObject со схемой', () => {
      const schema: ObjectSchema<{ name: string; }> = {
        name: isString('SYSTEM_UNKNOWN_ERROR', 'name'),
      };
      const data = { name: 'Bob' };

      const result = validateFormData(data, schema, BASE_CTX);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual({ name: 'Bob' });
      }
    });

    it('validateForm является тонким DOM-адаптером для validateFormData', () => {
      // Подготовим "форму" с данными и подменим глобальный FormData.
      const fakeEntries: [string, string][] = [
        ['name', 'Charlie'],
        ['name', 'Delta'],
        ['name', 'Echo'],
        ['age', '25'],
      ];

      // eslint-disable-next-line @typescript-eslint/naming-convention -- имитируем FormData конструктор
      function FakeFormData(_form: unknown): {
        entries: () => IterableIterator<[string, string]>;
      } {
        return {
          entries(): IterableIterator<[string, string]> {
            return fakeEntries[Symbol.iterator]();
          },
        };
      }

      vi.stubGlobal('FormData', FakeFormData as unknown as typeof FormData);

      try {
        const form = {} as HTMLFormElement;
        // Используем не-ObjectSchema, чтобы validateFormData вернул ok с "сырыми" данными.
        const schema: unknown = 'not-a-schema';

        const result = validateForm(form, schema, BASE_CTX);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value).toEqual({
            name: ['Charlie', 'Delta', 'Echo'],
            age: '25',
          });
        }
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
  /* eslint-enable ai-security/model-poisoning */

  describe('formatFileSize / validateFileBasic', () => {
    it('formatFileSize корректно форматирует маленькие значения', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(10)).toBe('10 Bytes');
    });

    it('formatFileSize корректно форматирует значения в KB/MB', () => {
      const oneKb = 1024;
      const oneMb = 1024 * 1024;

      expect(formatFileSize(oneKb)).toContain('KB');
      expect(formatFileSize(oneMb)).toContain('MB');
    });

    it('validateFileBasic возвращает ошибку если файл больше maxSize', () => {
      const file = new File(['x'], 'big.txt', { type: 'text/plain' });
      const result = validateFileBasic(file, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('big.txt');
    });

    it('validateFileBasic проверяет MIME/расширение согласно accept', () => {
      const pngFile = new File(['x'], 'image.png', { type: 'image/png' });

      expect(validateFileBasic(pngFile, undefined, 'image/*').valid).toBe(true);
      expect(validateFileBasic(pngFile, undefined, '.png').valid).toBe(true);
      expect(validateFileBasic(pngFile, undefined, 'image/png').valid).toBe(true);
      expect(validateFileBasic(pngFile, undefined, 'image/jpeg').valid).toBe(false);
    });

    it('validateFileBasic пропускает проверку типа если accept пустой или *', () => {
      const file = new File(['x'], 'any.bin', { type: 'application/octet-stream' });
      expect(validateFileBasic(file, undefined, '').valid).toBe(true);
      expect(validateFileBasic(file, undefined, '*').valid).toBe(true);
      expect(validateFileBasic(file, undefined).valid).toBe(true);
    });
  });
});
