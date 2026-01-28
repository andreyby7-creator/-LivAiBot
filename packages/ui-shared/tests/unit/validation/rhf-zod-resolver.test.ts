/**
 * @file Unit тесты для `src/validation/rhf-zod-resolver.ts`.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { zodResolver } from '../../../src/validation/rhf-zod-resolver.js';
import { ValidationKeys } from '../../../src/validation/zod.js';

describe('zodResolver (RHF)', () => {
  it('успешная валидация возвращает values и пустые errors', async () => {
    const schema = z.object({
      email: z.string().min(1),
      password: z.string().min(1),
    });

    const resolver = zodResolver(schema);
    const res = await (resolver as any)({ email: 'a', password: 'b' }, {}, {});

    expect(res.errors).toEqual({});
    expect(res.values).toEqual({ email: 'a', password: 'b' });
  });

  it('invalid_type (missing field) маппится в validation.required', async () => {
    const schema = z.object({ name: z.string() });
    const resolver = zodResolver(schema);

    const res = await (resolver as any)({}, {}, {});
    expect(res.values).toEqual({});
    expect(res.errors).toHaveProperty('name');
    expect(res.errors.name.message).toBe(ValidationKeys.required);
    expect(res.errors.name.type).toBe('invalid_type');
  });

  it('too_small string маппится в validation.string.min', async () => {
    const schema = z.object({ name: z.string().min(2) });
    const resolver = zodResolver(schema);

    const res = await (resolver as any)({ name: '' }, {}, {});
    expect(res.errors.name.message).toBe(ValidationKeys.stringMin);
    expect(res.errors.name.type).toBe('too_small');
  });

  it('too_small/too_big number и array маппятся в соответствующие ключи', async () => {
    const schema = z.object({
      age: z.number().min(18).max(60),
      tags: z.array(z.string()).min(2).max(3),
    });

    const resolver = zodResolver(schema);

    const r1 = await (resolver as any)({ age: 10, tags: [] }, {}, {});
    expect(r1.errors.age.message).toBe(ValidationKeys.numberMin);
    expect(r1.errors.tags.message).toBe(ValidationKeys.arrayMin);

    const r2 = await (resolver as any)({ age: 80, tags: ['a', 'b', 'c', 'd'] }, {}, {});
    expect(r2.errors.age.message).toBe(ValidationKeys.numberMax);
    expect(r2.errors.tags.message).toBe(ValidationKeys.arrayMax);
  });

  it('unrecognized_keys маппится в validation.unrecognizedKeys', async () => {
    const schema = z.object({ ok: z.string() }).strict();
    const resolver = zodResolver(schema);

    const res = await (resolver as any)({ ok: 'x', extra: 1 }, {}, {});
    // Обычно это root-level issue (path = [])
    expect(res.errors.root.message).toBe(ValidationKeys.unrecognizedKeys);
    expect(res.errors.root.type).toBe('unrecognized_keys');
  });

  it('invalid_union и invalid_literal маппятся через extraCodeMap', async () => {
    const schema = z.object({
      mode: z.union([z.literal('a'), z.literal('b')]),
      kind: z.literal('only'),
    });
    const resolver = zodResolver(schema);

    const res = await (resolver as any)({ mode: 'c', kind: 'nope' }, {}, {});
    expect(res.errors.mode.message).toBe(ValidationKeys.invalidUnion);
    expect(res.errors.kind.message).toBe(ValidationKeys.invalidLiteral);
  });

  it('nested path корректно создаёт вложенную структуру errors', async () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });
    const resolver = zodResolver(schema);

    const res = await (resolver as any)({ user: { email: 'not-email' } }, {}, {});
    expect(res.errors).toHaveProperty('user');
    expect(res.errors.user).toHaveProperty('email');
    // для email это будет дефолтный issue.message (не маппим), но не пусто
    expect(typeof res.errors.user.email.message).toBe('string');
    expect(res.errors.user.email.message.length).toBeGreaterThan(0);
  });

  it('custom issue с пустым path попадает в errors.root', async () => {
    const schema = z
      .object({ a: z.string() })
      .superRefine((_val, ctx) => ctx.addIssue({ code: 'custom', message: 'root.custom' }));
    const resolver = zodResolver(schema);

    const res = await (resolver as any)({ a: 'x' }, {}, {});
    expect(res.errors.root.message).toBe('root.custom');
    expect(res.errors.root.type).toBe('custom');
  });

  it('nested path с существующими ошибками рекурсивно строит вложенную структуру', async () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      }),
    });
    const resolver = zodResolver(schema);

    // Сначала создаем ошибку для user.profile.name
    const res1 = await (resolver as any)({ user: { profile: { name: '' } } }, {}, {});
    expect(res1.errors.user.profile.name).toBeDefined();

    // Затем добавляем ошибку для user.profile.email - должна рекурсивно использовать существующий объект
    const res2 = await (resolver as any)(
      { user: { profile: { name: '', email: 'invalid' } } },
      {},
      {},
    );
    expect(res2.errors.user.profile.name).toBeDefined();
    expect(res2.errors.user.profile.email).toBeDefined();
    // Проверяем, что структура вложенная и оба поля имеют ошибки
    expect(typeof res2.errors.user.profile.name.message).toBe('string');
    expect(typeof res2.errors.user.profile.email.message).toBe('string');
  });

  it('nested path с существующими ошибками рекурсивно строит вложенную структуру', async () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      }),
    });
    const resolver = zodResolver(schema);

    // Создаем ошибки для обоих полей одновременно - должна рекурсивно строить вложенную структуру
    const res = await (resolver as any)(
      { user: { profile: { name: '', email: 'invalid' } } },
      {},
      {},
    );
    expect(res.errors.user.profile.name).toBeDefined();
    expect(res.errors.user.profile.email).toBeDefined();
    // Проверяем, что структура вложенная и оба поля имеют ошибки
    expect(typeof res.errors.user.profile.name.message).toBe('string');
    expect(typeof res.errors.user.profile.email.message).toBe('string');
  });
});
