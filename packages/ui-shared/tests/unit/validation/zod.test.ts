/**
 * @file Unit тесты для `src/validation/zod.ts`.
 */

import { describe, expect, it } from 'vitest';

import {
  buildNestedKey,
  createZodI18nErrorMap,
  translateZodMessage,
  ValidationKeys,
} from '../../../src/validation/zod.js';

describe('translateZodMessage', () => {
  it('без t возвращает исходное сообщение', () => {
    expect(translateZodMessage('validation.required')).toBe('validation.required');
  });

  it('с t возвращает перевод', () => {
    const t = (key: string) => (key === 'validation.required' ? 'Обязательное поле' : key);
    expect(translateZodMessage('validation.required', t)).toBe('Обязательное поле');
  });

  it('fallback на message, если t вернул undefined', () => {
    const t = (_key: string) => undefined;
    expect(translateZodMessage('validation.required', t)).toBe('validation.required');
  });
});

describe('buildNestedKey', () => {
  it('без nested возвращает key без изменений', () => {
    expect(buildNestedKey(['user'], 'validation.required', { nested: false })).toBe(
      'validation.required',
    );
  });

  it('nested=true добавляет путь для validation.* ключей', () => {
    expect(buildNestedKey(['user', 'email'], 'validation.required', { nested: true }))
      .toBe('user.email.validation.required');
  });

  it('nested=true не добавляет путь если key не проходит shouldNest', () => {
    expect(buildNestedKey(['user'], 'custom.message', { nested: true })).toBe('custom.message');
  });

  it('nested=true, но путь пустой — возвращает key', () => {
    expect(buildNestedKey([], 'validation.required', { nested: true })).toBe('validation.required');
  });

  it('shouldNest можно переопределить', () => {
    const shouldNest = (key: string) => key.startsWith('x.');
    expect(buildNestedKey(['a'], 'validation.required', { nested: true, shouldNest })).toBe(
      'validation.required',
    );
    expect(buildNestedKey(['a'], 'x.key', { nested: true, shouldNest })).toBe('a.x.key');
  });
});

describe('createZodI18nErrorMap', () => {
  it('invalid_type + received="undefined" → ValidationKeys.required', () => {
    const map = createZodI18nErrorMap();
    const res = map({ code: 'invalid_type', received: 'undefined' }, { defaultError: 'default' });
    expect(res.message).toBe(ValidationKeys.required);
  });

  it('invalid_type + received!=undefined → ValidationKeys.invalidType', () => {
    const map = createZodI18nErrorMap();
    const res = map({ code: 'invalid_type', received: 'null' }, { defaultError: 'default' });
    expect(res.message).toBe(ValidationKeys.invalidType);
  });

  it('too_small/too_big для string/number/array маппятся на ValidationKeys.*', () => {
    const map = createZodI18nErrorMap();

    expect(map({ code: 'too_small', type: 'string' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.stringMin,
    );
    expect(map({ code: 'too_big', type: 'string' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.stringMax,
    );

    expect(map({ code: 'too_small', type: 'number' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.numberMin,
    );
    expect(map({ code: 'too_big', type: 'number' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.numberMax,
    );

    expect(map({ code: 'too_small', type: 'array' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.arrayMin,
    );
    expect(map({ code: 'too_big', type: 'array' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.arrayMax,
    );
  });

  it('extra codes: invalid_enum/custom/invalid_union/invalid_literal/unrecognized_keys', () => {
    const map = createZodI18nErrorMap();

    expect(map({ code: 'invalid_enum' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.invalidEnum,
    );
    expect(map({ code: 'custom' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.custom,
    );
    expect(map({ code: 'invalid_union' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.invalidUnion,
    );
    expect(map({ code: 'invalid_literal' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.invalidLiteral,
    );
    expect(map({ code: 'unrecognized_keys' }, { defaultError: 'default' }).message).toBe(
      ValidationKeys.unrecognizedKeys,
    );
  });

  it('fallback: если маппинг не сработал, возвращает ctx.defaultError', () => {
    const map = createZodI18nErrorMap();
    const res = map({ code: 'unknown_code', type: 'unknown_type' }, {
      defaultError: 'default.error',
    });
    expect(res.message).toBe('default.error');
  });

  it('nested=true добавляет путь к validation.* ключам', () => {
    const map = createZodI18nErrorMap({ nested: true });

    const res1 = map(
      { code: 'invalid_type', received: 'undefined', path: ['user', 'email'] },
      { defaultError: 'default' },
    );
    expect(res1.message).toBe('user.email.validation.required');

    const res2 = map({ code: 'custom', path: ['user', 'x'] }, { defaultError: 'default' });
    // custom тоже validation.* ключ, значит тоже nest-ится.
    expect(res2.message).toBe('user.x.validation.custom');

    const res3 = map({ code: 'unknown_code', path: ['user'] }, { defaultError: 'plain.error' });
    // defaultError не начинается с validation. → не nest-им
    expect(res3.message).toBe('plain.error');
  });
});
