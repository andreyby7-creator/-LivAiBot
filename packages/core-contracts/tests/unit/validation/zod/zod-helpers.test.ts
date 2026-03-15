/**
 * @file Unit тесты для Zod-хелперов (validation/zod)
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { zWhen } from '../../../../src/validation/zod/custom/conditional.js';
import { acceptTermsSchema } from '../../../../src/validation/zod/custom/forms.js';
import {
  formatZodError,
  formatZodErrorDetailed,
  formatZodIssues,
  formatZodIssuesDetailed,
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
});

describe('formatZodIssues', () => {
  it('форматирует issues напрямую без ZodError', () => {
    const schema = z.object({ name: z.string().min(2, 'too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssues(res.error.issues);
      expect(formatted).toEqual(['too.short']);
    }
  });

  it('форматирует несколько issues', () => {
    const schema = z.object({
      name: z.string().min(2, 'name.too.short'),
      email: z.string().email('email.invalid'),
    });
    const res = schema.safeParse({ name: 'a', email: 'not-email' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssues(res.error.issues);
      expect(formatted).toHaveLength(2);
      expect(formatted).toContain('name.too.short');
      expect(formatted).toContain('email.invalid');
    }
  });

  it('применяет функцию перевода t()', () => {
    const schema = z.object({ name: z.string().min(2, 'name.too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const t = (key: string) => key === 'name.too.short' ? 'Имя слишком короткое' : `??${key}`;
      const formatted = formatZodIssues(res.error.issues, t);
      expect(formatted).toEqual(['Имя слишком короткое']);
    }
  });

  it('поддерживает keyMode=path+message', () => {
    const schema = z.object({
      user: z.object({ name: z.string().min(2, 'name.too.short') }),
    });
    const res = schema.safeParse({ user: { name: 'a' } });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssues(res.error.issues, undefined, {
        keyMode: 'path+message',
      });
      expect(formatted).toEqual(['user.name.name.too.short']);
    }
  });

  it('возвращает ключ, если t() возвращает undefined', () => {
    const schema = z.object({ name: z.string().min(2, 'name.too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const t = () => undefined;
      const formatted = formatZodIssues(res.error.issues, t);
      expect(formatted).toEqual(['name.too.short']);
    }
  });
});

describe('formatZodIssuesDetailed', () => {
  it('форматирует issues напрямую без ZodError', () => {
    const schema = z.object({ name: z.string().min(2, 'too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssuesDetailed(res.error.issues);
      expect(formatted).toHaveLength(1);
      expect(formatted[0]?.path).toEqual(['name']);
      expect(formatted[0]?.message).toBe('too.short');
    }
  });

  it('форматирует несколько issues с путями', () => {
    const schema = z.object({
      name: z.string().min(2, 'name.too.short'),
      email: z.string().email('email.invalid'),
    });
    const res = schema.safeParse({ name: 'a', email: 'not-email' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssuesDetailed(res.error.issues);
      expect(formatted).toHaveLength(2);
      const nameIssue = formatted.find((f) => f.path.includes('name'));
      const emailIssue = formatted.find((f) => f.path.includes('email'));
      expect(nameIssue?.message).toBe('name.too.short');
      expect(emailIssue?.message).toBe('email.invalid');
    }
  });

  it('применяет функцию перевода t()', () => {
    const schema = z.object({ name: z.string().min(2, 'name.too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const t = (key: string) => key === 'name.too.short' ? 'Имя слишком короткое' : `??${key}`;
      const formatted = formatZodIssuesDetailed(res.error.issues, t);
      expect(formatted[0]?.message).toBe('Имя слишком короткое');
    }
  });

  it('поддерживает keyMode=path+message', () => {
    const schema = z.object({
      user: z.object({ name: z.string().min(2, 'name.too.short') }),
    });
    const res = schema.safeParse({ user: { name: 'a' } });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssuesDetailed(res.error.issues, undefined, {
        keyMode: 'path+message',
      });
      expect(formatted[0]?.path).toEqual(['user', 'name']);
      expect(formatted[0]?.message).toBe('user.name.name.too.short');
    }
  });

  it('нормализует пути с числами (индексы массивов)', () => {
    const schema = z.object({
      users: z.array(z.object({ name: z.string().min(1, 'required') })),
    });
    const res = schema.safeParse({ users: [{ name: '' }] });
    expect(res.success).toBe(false);
    if (!res.success) {
      const formatted = formatZodIssuesDetailed(res.error.issues);
      expect(formatted[0]?.path).toContain(0);
      expect(typeof formatted[0]?.path[1]).toBe('number');
    }
  });

  it('обрабатывает пустой массив issues', () => {
    const formatted = formatZodIssuesDetailed([]);
    expect(formatted).toEqual([]);
  });

  it('возвращает ключ, если t() возвращает undefined', () => {
    const schema = z.object({ name: z.string().min(2, 'name.too.short') });
    const res = schema.safeParse({ name: 'a' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const t = () => undefined;
      const formatted = formatZodIssuesDetailed(res.error.issues, t);
      expect(formatted[0]?.message).toBe('name.too.short');
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
