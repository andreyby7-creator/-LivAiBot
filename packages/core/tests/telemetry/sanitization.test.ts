/**
 * @file Unit тесты для sanitization.ts
 * Цель: 100% coverage для Stmts, Branch, Funcs, Lines
 */
import { describe, expect, it } from 'vitest';

import type { TelemetryEvent, TelemetryMetadata } from '@livai/core-contracts';

import {
  applyPIIRedactionMiddleware,
  deepFreeze,
  deepValidateAndRedactPII,
} from '../../src/telemetry/sanitization.js';

// Для тестов допустимо:
// - Мутации объектов для создания тестовых данных (fp/no-mutation)
// - Использование тестовых данных без валидации (ai-security/model-poisoning)
// - Использование тестовых токенов для проверки функциональности (ai-security/token-leakage)
// - Нарушение правил сортировки импортов для удобства чтения (simple-import-sort/imports)
/* eslint-disable fp/no-mutation, ai-security/model-poisoning, ai-security/token-leakage */

/* ========================================================================== */
/* 🔒 DEEP FREEZE */
/* ========================================================================== */

describe('deepFreeze', () => {
  it('возвращает примитивные значения без изменений', () => {
    expect(deepFreeze(null)).toBe(null);
    expect(deepFreeze(undefined)).toBe(undefined);
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze('test')).toBe('test');
    expect(deepFreeze(true)).toBe(true);
    expect(deepFreeze(false)).toBe(false);
  });

  it('замораживает простой объект', () => {
    const obj = { a: 1, b: 'test' };
    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen).toEqual({ a: 1, b: 'test' });
    expect(() => {
      (frozen as { a: number; b: string; }).a = 2;
    }).toThrow();
  });

  it('рекурсивно замораживает вложенные объекты', () => {
    const obj = {
      a: 1,
      nested: {
        b: 2,
        deep: {
          c: 3,
        },
      },
    };
    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.nested.deep)).toBe(true);
    expect(() => {
      (frozen.nested as { b: number; }).b = 3;
    }).toThrow();
  });

  it('рекурсивно замораживает массивы', () => {
    const arr = [1, 2, { a: 3 }];
    const frozen = deepFreeze(arr);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen[2])).toBe(true);
    expect(() => {
      (frozen as number[])[0] = 0;
    }).toThrow();
  });

  it('замораживает массивы с вложенными объектами', () => {
    const arr = [{ a: 1 }, { b: 2 }];
    const frozen = deepFreeze(arr);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen[0])).toBe(true);
    expect(Object.isFrozen(frozen[1])).toBe(true);
  });

  it('обрабатывает циклические ссылки', () => {
    const obj: { a?: number; self?: unknown; } = { a: 1 };
    obj.self = obj;
    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.self).toBe(frozen);
  });

  it('обрабатывает множественные циклические ссылки', () => {
    const obj1: { ref?: unknown; } = {};
    const obj2: { ref?: unknown; } = {};
    obj1.ref = obj2;
    obj2.ref = obj1;
    const frozen1 = deepFreeze(obj1);

    expect(Object.isFrozen(frozen1)).toBe(true);
    expect(Object.isFrozen(frozen1.ref)).toBe(true);
  });

  it('обрабатывает пустые объекты', () => {
    const obj = {};
    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('обрабатывает пустые массивы', () => {
    const arr: unknown[] = [];
    const frozen = deepFreeze(arr);

    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('обрабатывает смешанные структуры', () => {
    const obj = {
      a: 1,
      b: [2, { c: 3 }],
      d: {
        e: [4, 5],
        f: { g: 6 },
      },
    };
    const frozen = deepFreeze(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.b)).toBe(true);
    expect(Object.isFrozen(frozen.b[1])).toBe(true);
    expect(Object.isFrozen(frozen.d)).toBe(true);
    expect(Object.isFrozen(frozen.d.e)).toBe(true);
    expect(Object.isFrozen(frozen.d.f)).toBe(true);
  });
});

/* ========================================================================== */
/* 🔒 DEEP VALIDATE AND REDACT PII */
/* ========================================================================== */

describe('deepValidateAndRedactPII', () => {
  it('возвращает null без изменений', () => {
    expect(deepValidateAndRedactPII(null)).toBe(null);
  });

  it('возвращает undefined без изменений', () => {
    expect(deepValidateAndRedactPII(undefined)).toBe(undefined);
  });

  it('возвращает примитивные значения без изменений', () => {
    expect(deepValidateAndRedactPII(42)).toBe(42);
    expect(deepValidateAndRedactPII('test')).toBe('test');
    expect(deepValidateAndRedactPII(true)).toBe(true);
    expect(deepValidateAndRedactPII(false)).toBe(false);
  });

  it('скрывает PII по ключу (password)', () => {
    const metadata = { password: 'secret123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ password: '[REDACTED]' });
  });

  it('скрывает PII по ключу (access_token)', () => {
    const metadata = { access_token: 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ access_token: '[REDACTED]' });
  });

  it('скрывает PII по ключу (auth-token)', () => {
    const metadata = { 'auth-token': 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ 'auth-token': '[REDACTED]' });
  });

  it('скрывает PII по ключу (auth_token)', () => {
    const metadata = { auth_token: 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ auth_token: '[REDACTED]' });
  });

  it('скрывает PII по ключу (bearer_token)', () => {
    const metadata = { bearer_token: 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ bearer_token: '[REDACTED]' });
  });

  it('скрывает PII по ключу (refresh_token)', () => {
    const metadata = { refresh_token: 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ refresh_token: '[REDACTED]' });
  });

  it('скрывает PII по ключу (jwt)', () => {
    const metadata = { jwt: 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ jwt: '[REDACTED]' });
  });

  it('скрывает PII по ключу (id_token)', () => {
    const metadata = { id_token: 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ id_token: '[REDACTED]' });
  });

  it('скрывает PII по ключу (id-token)', () => {
    const metadata = { 'id-token': 'token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ 'id-token': '[REDACTED]' });
  });

  it('скрывает PII по ключу (secret)', () => {
    const metadata = { secret: 'secret123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ secret: '[REDACTED]' });
  });

  it('скрывает PII по ключу (secret_key)', () => {
    const metadata = { secret_key: 'key123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ secret_key: '[REDACTED]' });
  });

  it('скрывает PII по ключу (private_key)', () => {
    const metadata = { private_key: 'key123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ private_key: '[REDACTED]' });
  });

  it('скрывает PII по ключу (client_secret)', () => {
    const metadata = { client_secret: 'secret123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ client_secret: '[REDACTED]' });
  });

  it('скрывает PII по ключу (credential)', () => {
    const metadata = { credential: 'cred123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ credential: '[REDACTED]' });
  });

  it('скрывает PII по ключу (credentials)', () => {
    const metadata = { credentials: 'cred123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ credentials: '[REDACTED]' });
  });

  it('скрывает PII по ключу (api_key)', () => {
    const metadata = { api_key: 'key123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ api_key: '[REDACTED]' });
  });

  it('скрывает PII по ключу (apikey)', () => {
    const metadata = { apikey: 'key123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ apikey: '[REDACTED]' });
  });

  it('скрывает PII по ключу (authorization)', () => {
    const metadata = { authorization: 'Bearer token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ authorization: '[REDACTED]' });
  });

  it('скрывает PII по ключу (auth_header)', () => {
    const metadata = { auth_header: 'Bearer token123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ auth_header: '[REDACTED]' });
  });

  it('скрывает PII по ключу (credit_card)', () => {
    const metadata = { credit_card: '1234567890123456' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ credit_card: '[REDACTED]' });
  });

  it('скрывает PII по ключу (card_number)', () => {
    const metadata = { card_number: '1234567890123456' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ card_number: '[REDACTED]' });
  });

  it('скрывает PII по ключу (cc_number)', () => {
    const metadata = { cc_number: '1234567890123456' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ cc_number: '[REDACTED]' });
  });

  it('скрывает PII по ключу (ssn)', () => {
    const metadata = { ssn: '123-45-6789' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ ssn: '[REDACTED]' });
  });

  it('скрывает PII по ключу (social_security_number)', () => {
    const metadata = { social_security_number: '123-45-6789' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ social_security_number: '[REDACTED]' });
  });

  it('скрывает PII по ключу (session_id)', () => {
    const metadata = { session_id: 'session123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ session_id: '[REDACTED]' });
  });

  it('скрывает PII по ключу (sessionid)', () => {
    const metadata = { sessionid: 'session123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ sessionid: '[REDACTED]' });
  });

  it('скрывает PII по ключу (case insensitive)', () => {
    const metadata = { PASSWORD: 'secret123' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ PASSWORD: '[REDACTED]' });
  });

  it('не скрывает обычные строки без PII', () => {
    const metadata = { username: 'user123', email: 'user@example.com' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ username: 'user123', email: 'user@example.com' });
  });

  it('обрезает длинные строки', () => {
    const longString = 'a'.repeat(2000);
    const metadata = { message: longString };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({
      message: `${'a'.repeat(1000)}...[TRUNCATED]`,
    });
  });

  it('не обрезает короткие строки', () => {
    const shortString = 'short';
    const metadata = { message: shortString };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ message: 'short' });
  });

  it('обрабатывает числа', () => {
    const metadata = { count: 42, price: 99.99 };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ count: 42, price: 99.99 });
  });

  it('обрабатывает булевы значения', () => {
    const metadata = { isActive: true, isDeleted: false };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ isActive: true, isDeleted: false });
  });

  it('рекурсивно обрабатывает вложенные объекты', () => {
    const metadata = {
      user: {
        password: 'secret123',
        name: 'John',
      },
    };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({
      user: {
        password: '[REDACTED]',
        name: 'John',
      },
    });
  });

  it('рекурсивно обрабатывает глубоко вложенные объекты', () => {
    const metadata = {
      level1: {
        level2: {
          level3: {
            password: 'secret123',
          },
        },
      },
    };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            password: '[REDACTED]',
          },
        },
      },
    });
  });

  it('обрабатывает массивы', () => {
    const metadata = { items: [1, 2, 3] };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('обрабатывает массивы с объектами', () => {
    const metadata = {
      users: [
        { name: 'John', password: 'secret1' },
        { name: 'Jane', password: 'secret2' },
      ],
    };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({
      users: [
        { name: 'John', password: '[REDACTED]' },
        { name: 'Jane', password: '[REDACTED]' },
      ],
    });
  });

  it('обрабатывает циклические ссылки', () => {
    const obj: { a?: number; self?: unknown; } = { a: 1 };
    obj.self = obj;
    const result = deepValidateAndRedactPII(obj);

    expect(result).toEqual({ a: 1, self: '[Circular Reference]' });
  });

  it('обрабатывает множественные циклические ссылки', () => {
    const obj1: { ref?: unknown; } = {};
    const obj2: { ref?: unknown; } = {};
    obj1.ref = obj2;
    obj2.ref = obj1;
    const result = deepValidateAndRedactPII(obj1);

    expect(result).toEqual({ ref: { ref: '[Circular Reference]' } });
  });

  it('использует кастомное значение для замены', () => {
    const metadata = { password: 'secret123' };
    const result = deepValidateAndRedactPII(metadata, '***HIDDEN***');

    expect(result).toEqual({ password: '***HIDDEN***' });
  });

  it('скрывает PII в значениях при enableValueScan=true', () => {
    // isPIIValue проверяет точное совпадение с паттернами (^ и $)
    // Поэтому 'password' будет распознано, а 'password123' - нет
    const metadata = { token: 'password' };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: '[REDACTED]' });
  });

  it('скрывает base64 токены при enableValueScan=true', () => {
    const base64Token =
      'dGhpc2lzYXZlcnlsb25ndG9rZW50aGF0aXNiYXNlNjRlbmNvZGVkYW5kaXNsb25nZXJ0aGFudGhlbWluaW11bWxlbmd0aA==';
    const metadata = { token: base64Token };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: '[REDACTED]' });
  });

  it('не скрывает короткие base64 строки', () => {
    const shortBase64 = 'dGVzdA=='; // "test" в base64, но короткий
    const metadata = { token: shortBase64 };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    // Должен обрезать, но не скрывать как PII (слишком короткий)
    expect(result).toEqual({ token: shortBase64 });
  });

  it('не скрывает некорректные base64 строки', () => {
    const invalidBase64 = 'this is not base64!@#$%';
    const metadata = { token: invalidBase64 };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: invalidBase64 });
  });

  it('не скрывает значения при enableValueScan=false', () => {
    const metadata = { token: 'password123' };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', false);

    expect(result).toEqual({ token: 'password123' });
  });

  it('не скрывает PII при enableRegexDetection=false', () => {
    const metadata = { password: 'secret123' };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', false, false);

    expect(result).toEqual({ password: 'secret123' });
  });

  it('не скрывает значения при enableRegexDetection=false даже с enableValueScan=true', () => {
    const metadata = { token: 'password123' };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true, false);

    expect(result).toEqual({ token: 'password123' });
  });

  it('обрабатывает смешанные структуры', () => {
    const metadata = {
      safe: 'value',
      password: 'secret',
      nested: {
        api_key: 'key123',
        count: 42,
        items: [1, 2, { secret: 'hidden' }],
      },
    };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({
      safe: 'value',
      password: '[REDACTED]',
      nested: {
        api_key: '[REDACTED]',
        count: 42,
        items: [1, 2, { secret: '[REDACTED]' }],
      },
    });
  });

  it('обрабатывает null значения', () => {
    const metadata = { value: null, password: 'secret' };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ value: null, password: '[REDACTED]' });
  });

  it('обрабатывает массивы с null', () => {
    const metadata = { items: [1, null, 3] };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ items: [1, null, 3] });
  });

  it('обрабатывает пустые объекты', () => {
    const metadata = {};
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({});
  });

  it('обрабатывает пустые массивы', () => {
    const metadata = { items: [] };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ items: [] });
  });

  it('обрабатывает строки с граничной длиной', () => {
    const exactLength = 'a'.repeat(1000);
    const metadata = { message: exactLength };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({ message: exactLength });
  });

  it('обрабатывает строки длиннее границы на 1', () => {
    const overLength = 'a'.repeat(1001);
    const metadata = { message: overLength };
    const result = deepValidateAndRedactPII(metadata);

    expect(result).toEqual({
      message: `${'a'.repeat(1000)}...[TRUNCATED]`,
    });
  });

  it('обрабатывает base64 строки с padding', () => {
    const base64WithPadding =
      'dGhpc2lzYXZlcnlsb25ndG9rZW50aGF0aXNiYXNlNjRlbmNvZGVkYW5kaXNsb25nZXJ0aGFudGhlbWluaW11bWxlbmd0aA==';
    const metadata = { token: base64WithPadding };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: '[REDACTED]' });
  });

  it('обрабатывает base64 строки без padding', () => {
    const base64WithoutPadding =
      'dGhpc2lzYXZlcnlsb25ndG9rZW50aGF0aXNiYXNlNjRlbmNvZGVkYW5kaXNsb25nZXJ0aGFudGhlbWluaW11bWxlbmd0aA';
    const metadata = { token: base64WithoutPadding };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: '[REDACTED]' });
  });

  it('обрабатывает base64 строки с минимальной длиной', () => {
    const minBase64 =
      'dGhpc2lzYXZlcnlsb25ndG9rZW50aGF0aXNiYXNlNjRlbmNvZGVkYW5kaXNsb25nZXJ0aGFudGhlbWluaW11bWxlbmd0aA==';
    const metadata = { token: minBase64 };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: '[REDACTED]' });
  });

  it('не обрабатывает base64 строки короче минимальной длины', () => {
    const shortBase64 = 'dGVzdA=='; // 8 символов, меньше 20
    const metadata = { token: shortBase64 };
    const result = deepValidateAndRedactPII(metadata, '[REDACTED]', true);

    expect(result).toEqual({ token: shortBase64 });
  });
});

/* ========================================================================== */
/* 🔒 APPLY PII REDACTION MIDDLEWARE */
/* ========================================================================== */

describe('applyPIIRedactionMiddleware', () => {
  it('возвращает событие без изменений если metadata отсутствует', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
    };
    const result = applyPIIRedactionMiddleware(event);

    expect(result).toEqual(event);
    expect(result.metadata).toBeUndefined();
  });

  it('возвращает событие без изменений если metadata пустой', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {},
    };
    const result = applyPIIRedactionMiddleware(event);

    expect(result).toEqual(event);
  });

  it('возвращает событие без изменений если нет PII', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        username: 'user123',
        count: 42,
      },
    };
    const result = applyPIIRedactionMiddleware(event);

    expect(result).toEqual(event);
  });

  it('удаляет metadata при обнаружении PII в fast path (enableDeepScan=false)', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        password: 'secret123',
        username: 'user123',
      },
    };
    const result = applyPIIRedactionMiddleware(event, false);

    expect(result.metadata).toBeUndefined();
    expect(result.message).toBe('test');
    expect(result.timestamp).toBe(event.timestamp);
  });

  it('скрывает PII вместо удаления metadata в deep path (enableDeepScan=true)', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        password: 'secret123',
        username: 'user123',
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      password: '[REDACTED]',
      username: 'user123',
    });
    expect(result.message).toBe('test');
    expect(result.timestamp).toBe(event.timestamp);
  });

  it('обрабатывает вложенные объекты в fast path', () => {
    const event = {
      level: 'INFO' as const,
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        user: {
          password: 'secret123',
        },
      },
    } as unknown as TelemetryEvent;
    const result = applyPIIRedactionMiddleware(event, false);

    // В fast path (deep=false) не проверяет вложенные объекты
    expect(result.metadata).toBeDefined();
  });

  it('обрабатывает вложенные объекты в deep path', () => {
    const event = {
      level: 'INFO' as const,
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        user: {
          password: 'secret123',
          name: 'John',
        },
      },
    } as unknown as TelemetryEvent;
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      user: {
        password: '[REDACTED]',
        name: 'John',
      },
    });
  });

  it('обрабатывает PII в значениях в deep path', () => {
    // isPIIValue проверяет точное совпадение с паттернами (^ и $)
    // Поэтому 'password' будет распознано, а 'password123' - нет
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        token: 'password',
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      token: '[REDACTED]',
    });
  });

  it('обрабатывает base64 токены в deep path', () => {
    const base64Token =
      'dGhpc2lzYXZlcnlsb25ndG9rZW50aGF0aXNiYXNlNjRlbmNvZGVkYW5kaXNsb25nZXJ0aGFudGhlbWluaW11bWxlbmd0aA==';
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        token: base64Token,
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      token: '[REDACTED]',
    });
  });

  it('обрабатывает множественные PII поля', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        password: 'secret1',
        api_key: 'key123',
        access_token: 'token123',
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      password: '[REDACTED]',
      api_key: '[REDACTED]',
      access_token: '[REDACTED]',
    });
  });

  it('сохраняет не-PII поля в deep path', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        password: 'secret123',
        username: 'user123',
        count: 42,
        isActive: true,
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      password: '[REDACTED]',
      username: 'user123',
      count: 42,
      isActive: true,
    });
  });

  it('обрабатывает массивы в deep path', () => {
    const event = {
      level: 'INFO' as const,
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        users: [
          { name: 'John', password: 'secret1' },
          { name: 'Jane', password: 'secret2' },
        ],
      },
    } as unknown as TelemetryEvent;
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({
      users: [
        { name: 'John', password: '[REDACTED]' },
        { name: 'Jane', password: '[REDACTED]' },
      ],
    });
  });

  it('обрабатывает циклические ссылки в deep path', () => {
    const obj: { a?: number; self?: unknown; } = { a: 1 };
    obj.self = obj;
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: obj as TelemetryMetadata,
    };
    const result = applyPIIRedactionMiddleware(event, true);

    expect(result.metadata).toEqual({ a: 1, self: '[Circular Reference]' });
  });

  it('обрабатывает длинные строки в deep path', () => {
    // Используем строку с пробелами, чтобы она не соответствовала паттерну base64
    const longString = 'a b c '.repeat(334); // ~2000 символов, но не base64 из-за пробелов
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        message: longString,
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    // Проверяем, что строка обрезана до 1000 символов и имеет суффикс
    const resultMessage = result.metadata?.['message'] as string;
    expect(resultMessage).toHaveLength(1014); // 1000 + '...[TRUNCATED]'.length (14)
    expect(resultMessage.endsWith('...[TRUNCATED]')).toBe(true);
    expect(resultMessage.slice(0, 1000)).toBe(longString.slice(0, 1000));
  });

  it('сохраняет все поля события кроме metadata', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: 1234567890,
      metadata: {
        password: 'secret123',
      },
      extra: 'field',
    } as TelemetryEvent;
    const result = applyPIIRedactionMiddleware(event, false);

    expect(result.message).toBe('test');
    expect(result.timestamp).toBe(1234567890);
    expect((result as { extra?: string; }).extra).toBe('field');
    expect(result.metadata).toBeUndefined();
  });

  it('обрабатывает containsPII с deep=false и строковым PII значением', () => {
    // Тест для покрытия строки 104: проверка значения на PII при deep=false
    // Для этого нужно вызвать applyPIIRedactionMiddleware с enableDeepScan=false
    // и metadata, где значение строки является PII (точное совпадение с паттерном)
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        token: 'password', // Точное совпадение с паттерном PII
      },
    };
    // В fast path это вызовет containsPII(event.metadata, false)
    // и строка 104 будет выполнена, когда isPIIValue('password') вернет true
    const result = applyPIIRedactionMiddleware(event, false);
    // В fast path metadata будет удалено
    expect(result.metadata).toBeUndefined();
  });

  it('обрабатывает циклическую ссылку на объект в deepValidateAndRedactPIIInternal', () => {
    // Тест для покрытия строки 244: циклическая ссылка на объект (не массив)
    // Нужно создать объект, который будет обработан как объект (не массив) и имеет циклическую ссылку
    // При втором посещении того же объекта должна сработать строка 244
    // Важно: объект должен быть обработан дважды - сначала добавлен в visited, потом обнаружен как циклическая ссылка
    // Создаем объект с вложенной структурой, где один и тот же объект встречается дважды
    const sharedObj = { value: 'shared' };
    const obj = {
      a: 1,
      first: sharedObj,
      second: sharedObj, // Та же ссылка на sharedObj
      nested: {
        ref: sharedObj, // Еще одна ссылка на sharedObj
      },
    };
    // Вызываем deepValidateAndRedactPII, который создаст новый WeakSet
    const result = deepValidateAndRedactPII(obj);

    // Проверяем, что все ссылки на sharedObj обработаны
    // При втором посещении sharedObj должна сработать строка 244
    expect(result).toEqual({
      a: 1,
      first: { value: 'shared' },
      second: '[Circular Reference]',
      nested: { ref: '[Circular Reference]' },
    });
  });

  it('обрабатывает fallback для нестандартных типов в deepValidateAndRedactPIIInternal', () => {
    // Тест для покрытия строки 280: fallback для случаев, когда metadata не является объектом, массивом или примитивом
    // В JavaScript все значения являются примитивами или объектами, но TypeScript может иметь другие типы
    // Попробуем передать функцию (которая является объектом, но не обрабатывается явно в условиях выше)
    // Функция будет обработана как объект в строке 261, но если она не пройдет проверки выше,
    // то попадет в fallback на строке 280
    // Но функция все равно является объектом, поэтому она попадет в строку 261
    // Попробуем передать null или undefined, но они уже обработаны в строке 231
    // Попробуем передать Symbol (примитив, но не обработан явно)
    const symbol = Symbol('test');
    const result = deepValidateAndRedactPII(symbol as unknown);

    // Symbol должен быть возвращен как есть (fallback)
    expect(result).toBe(symbol);
  });

  it('обрабатывает различные типы PII ключей', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'test',
      timestamp: Date.now(),
      metadata: {
        pwd: 'secret1',
        'access-token': 'secret2',
        auth_token: 'secret3',
        'bearer-token': 'secret4',
        refresh_token: 'secret5',
        jwt: 'secret6',
        'id-token': 'secret7',
        secret: 'secret8',
        secret_key: 'secret9',
        private_key: 'secret10',
        client_secret: 'secret11',
        credential: 'secret12',
        credentials: 'secret13',
        api_key: 'secret14',
        apikey: 'secret15',
        authorization: 'secret16',
        auth_header: 'secret17',
        credit_card: 'secret18',
        card_number: 'secret19',
        cc_number: 'secret20',
        ssn: 'secret21',
        social_security_number: 'secret22',
        session_id: 'secret23',
        sessionid: 'secret24',
      },
    };
    const result = applyPIIRedactionMiddleware(event, true);

    Object.keys(event.metadata!).forEach((key) => {
      expect(result.metadata?.[key]).toBe('[REDACTED]');
    });
  });
});

/* eslint-enable */
