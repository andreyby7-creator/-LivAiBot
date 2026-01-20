/**
 * @file Unit тесты для Zod-хелперов (validation/zod)
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { acceptTermsSchema } from '../../../../src/validation/zod/custom/forms.js';
import { zWhen } from '../../../../src/validation/zod/custom/conditional.js';
import {
  formatZodError,
  formatZodErrorDetailed,
} from '../../../../src/validation/zod/custom/i18n.js';

describe('acceptTermsSchema', () => {
  it('пропускает true', () => {
    expect(acceptTermsSchema.parse(true)).toBe(true);
  });

  it('отклоняет false с i18n-ключом', () => {
    const res = acceptTermsSchema.safeParse(false);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('form.acceptTerms.required');
    }
  });
});

describe('zWhen', () => {
  it('когда включено — схема становится optional', () => {
    const schema = zWhen(true, z.object({ temperature: z.number().min(0).max(2) }));
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it('когда выключено — значение запрещено', () => {
    const schema = zWhen(false, z.object({ temperature: z.number().min(0).max(2) }));
    expect(schema.safeParse(undefined).success).toBe(false);
    expect(schema.safeParse({ temperature: 1 }).success).toBe(false);
  });
});

describe('formatZodError', () => {
  it('возвращает массив сообщений для UI', () => {
    const schema = z.object({ name: z.string().min(2, 'Слишком короткое имя') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(formatZodError(res.error)).toEqual(['Слишком короткое имя']);
    }
  });

  it('умеет переводить i18n-ключи через t()', () => {
    const res = acceptTermsSchema.safeParse(false);
    expect(res.success).toBe(false);
    if (!res.success) {
      const t = (key: string) =>
        key === 'form.acceptTerms.required'
          ? 'Необходимо принять условия'
          : `??${key}`;
      expect(formatZodError(res.error, t)).toEqual(['Необходимо принять условия']);
    }
  });

  it('поддерживает режим keyMode=path+message для nested форм', () => {
    const schema = z.object({
      user: z.object({
        acceptTerms: acceptTermsSchema,
      }),
    });

    const res = schema.safeParse({ user: { acceptTerms: false } });
    expect(res.success).toBe(false);
    if (!res.success) {
      const t = (key: string) =>
        key === 'user.acceptTerms.form.acceptTerms.required'
          ? 'Необходимо принять условия (nested)'
          : `??${key}`;
      expect(formatZodError(res.error, t, { keyMode: 'path+message' })).toEqual([
        'Необходимо принять условия (nested)',
      ]);
    }
  });

  it('может возвращать ошибки с путём поля для UI', () => {
    const schema = z.object({ acceptTerms: acceptTermsSchema });
    const res = schema.safeParse({ acceptTerms: false });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodErrorDetailed(res.error);
      expect(formatted[0]?.path).toEqual(['acceptTerms']);
      expect(formatted[0]?.message).toBe('form.acceptTerms.required');
    }
  });

  it('обрабатывает числа в пути через formatZodErrorDetailed', () => {
    // Тестируем normalizeZodPath косвенно через formatZodErrorDetailed
    const schema = z.object({
      users: z.array(z.object({ name: z.string().min(1, 'required') })),
    });

    const res = schema.safeParse({ users: [{ name: '' }] });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodErrorDetailed(res.error);
      // Проверяем что путь содержит число (индекс массива)
      expect(formatted[0]?.path).toContain(0); // индекс 0 в массиве
    }
  });

  it('formatZodIssues работает без функции перевода', () => {
    const schema = z.object({ name: z.string().min(2, 'too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodError(res.error);
      expect(formatted).toEqual(['too.short']);
    }
  });

  it('formatZodIssuesDetailed работает без функции перевода', () => {
    const schema = z.object({ name: z.string().min(2, 'too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodErrorDetailed(res.error);
      expect(formatted[0]?.path).toEqual(['name']);
      expect(formatted[0]?.message).toBe('too.short');
    }
  });

  it('keyMode=path+message работает с пустым путём', () => {
    const schema = z.string().min(2, 'too.short');
    const res = schema.safeParse('a');
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodError(res.error, undefined, { keyMode: 'path+message' });
      expect(formatted).toEqual(['too.short']);
    }
  });

  it('keyMode=path+message работает с числами в пути', () => {
    const schema = z.object({
      users: z.array(z.object({ name: z.string().min(2, 'name.too.short') })),
    });
    const res = schema.safeParse({ users: [{ name: 'a' }] });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodError(res.error, undefined, { keyMode: 'path+message' });
      expect(formatted).toEqual(['users.0.name.name.too.short']);
    }
  });
});
