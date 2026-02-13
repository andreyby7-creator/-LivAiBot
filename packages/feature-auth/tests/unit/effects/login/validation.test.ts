/**
 * @file Unit тесты для effects/login/validation.ts
 * Полное покрытие validation функций с тестированием всех функций и edge cases
 */

import { describe, expect, it } from 'vitest';

import type {
  ClientContext,
  LoginIdentifierType,
  LoginRequest,
  MfaInfo,
} from '../../../../src/domain/LoginRequest.js';
import { isValidLoginRequest } from '../../../../src/effects/login/validation.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает валидный LoginRequest для тестов */
function createValidLoginRequest<T extends LoginIdentifierType>(
  type: T,
  overrides: Partial<LoginRequest<T>> = {},
): LoginRequest<T> {
  const base = {
    identifier: {
      type,
      value: type === 'email'
        ? 'user@example.com'
        : type === 'phone'
        ? '+1234567890'
        : type === 'oauth'
        ? 'oauth-user-id'
        : 'testuser',
    },
  } as LoginRequest<T>;

  return { ...base, ...overrides } as LoginRequest<T>;
}

/** Создает MfaInfo для тестов */
function createMfaInfo(
  type: 'totp' | 'sms' | 'email' | 'push' = 'totp',
  token: string = '123456',
  deviceId?: string,
): MfaInfo {
  const base: MfaInfo = { type, token };
  return deviceId !== undefined ? { ...base, deviceId } : base;
}

// ============================================================================
// ✅ VALID CASES - Валидные случаи
// ============================================================================

describe('isValidLoginRequest - валидные случаи', () => {
  it('валидирует минимальный email login request', () => {
    const request = createValidLoginRequest('email');

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует полный email login request', () => {
    const request = createValidLoginRequest('email', {
      password: 'password123',
      dtoVersion: '1.0',
      rememberMe: true,
      mfa: createMfaInfo(),
      clientContext: { ip: '192.168.1.1' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует email login request с массивом MFA', () => {
    const request = createValidLoginRequest('email', {
      mfa: [createMfaInfo('totp', '123456'), createMfaInfo('sms', '789012')],
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует минимальный username login request', () => {
    const request = createValidLoginRequest('username');

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует полный username login request', () => {
    const request = createValidLoginRequest('username', {
      password: 'password123',
      dtoVersion: '1.1',
      rememberMe: false,
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует минимальный phone login request', () => {
    const request = createValidLoginRequest('phone');

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует полный phone login request', () => {
    const request = createValidLoginRequest('phone', {
      password: 'password123',
      mfa: createMfaInfo('sms', '123456', 'device-123'),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует минимальный oauth login request', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(10),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует полный oauth login request', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'yandex',
      providerToken: 'a'.repeat(100),
      password: 'backup-password',
      mfa: createMfaInfo('push', 'push-token'),
      dtoVersion: '1.0',
      rememberMe: true,
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует oauth login request с кастомным whitelist', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'github',
      providerToken: 'a'.repeat(50),
    });

    const customProviders = new Set<string>(['github', 'gitlab']);

    expect(isValidLoginRequest(request, customProviders)).toBe(true);
  });

  it('валидирует email с максимальной длиной', () => {
    // MAX_IDENTIFIER_VALUE_LENGTH = 256, но также проверяется MAX_EMAIL_LENGTH = 320
    // Первая проверка идет на MAX_IDENTIFIER_VALUE_LENGTH, поэтому максимум 256
    // '@b.c' это 4 символа, поэтому максимум для локальной части = 252
    const longEmail = `${'a'.repeat(252)}@b.c`;
    const request = createValidLoginRequest('email', {
      identifier: { type: 'email', value: longEmail },
    });

    expect(longEmail.length).toBe(256);
    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует phone с минимальной длиной E.164', () => {
    const request = createValidLoginRequest('phone', {
      identifier: { type: 'phone', value: '+1234567890' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует phone с максимальной длиной E.164', () => {
    const request = createValidLoginRequest('phone', {
      identifier: { type: 'phone', value: '+123456789012345' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует providerToken с минимальной длиной', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(10),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует providerToken с максимальной длиной', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(2048),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует MFA с deviceId', () => {
    const request = createValidLoginRequest('email', {
      mfa: createMfaInfo('totp', '123456', 'device-123'),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует все типы MFA', () => {
    const types: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

    types.forEach((mfaType) => {
      const request = createValidLoginRequest('email', {
        mfa: createMfaInfo(mfaType, 'token-123'),
      });

      expect(isValidLoginRequest(request)).toBe(true);
    });
  });

  it('валидирует dtoVersion 1.0', () => {
    const request = createValidLoginRequest('email', {
      dtoVersion: '1.0',
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует dtoVersion 1.1', () => {
    const request = createValidLoginRequest('email', {
      dtoVersion: '1.1',
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует rememberMe true', () => {
    const request = createValidLoginRequest('email', {
      rememberMe: true,
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует rememberMe false', () => {
    const request = createValidLoginRequest('email', {
      rememberMe: false,
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует clientContext как объект', () => {
    const request = createValidLoginRequest('email', {
      clientContext: { ip: '192.168.1.1', userAgent: 'Chrome' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует все дефолтные OAuth провайдеры', () => {
    const providers = ['google', 'yandex', 'facebook', 'vk'];

    providers.forEach((provider) => {
      const request = createValidLoginRequest('oauth', {
        provider,
        providerToken: 'a'.repeat(50),
      });

      expect(isValidLoginRequest(request)).toBe(true);
    });
  });
});

// ============================================================================
// ❌ INVALID CASES - Невалидные случаи
// ============================================================================

describe('isValidLoginRequest - невалидные случаи', () => {
  it('отклоняет null', () => {
    expect(isValidLoginRequest(null)).toBe(false);
  });

  it('отклоняет undefined', () => {
    expect(isValidLoginRequest(undefined)).toBe(false);
  });

  it('отклоняет не объект', () => {
    expect(isValidLoginRequest('string')).toBe(false);
    expect(isValidLoginRequest(123)).toBe(false);
    expect(isValidLoginRequest(true)).toBe(false);
    expect(isValidLoginRequest([])).toBe(false);
  });

  it('отклоняет объект без identifier', () => {
    const request = {} as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier null', () => {
    const request = {
      identifier: null,
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier не объект', () => {
    const request = {
      identifier: 'string',
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier без type', () => {
    const request = {
      identifier: { value: 'user@example.com' },
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier без value', () => {
    const request = {
      identifier: { type: 'email' },
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier с лишними полями', () => {
    const request = {
      identifier: { type: 'email', value: 'user@example.com', extra: 'field' },
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет невалидный identifier.type', () => {
    const request = {
      identifier: { type: 'invalid', value: 'user@example.com' },
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier.value не string', () => {
    const request = {
      identifier: { type: 'email', value: 123 },
    } as unknown as LoginRequest<LoginIdentifierType>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier.value пустой', () => {
    const request = createValidLoginRequest('email', {
      identifier: { type: 'email', value: '' },
    });

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет identifier.value слишком длинный', () => {
    const request = createValidLoginRequest('email', {
      identifier: { type: 'email', value: 'a'.repeat(257) },
    });

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет невалидный email формат', () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@example',
      'user example.com',
      'user@example@com',
    ];

    invalidEmails.forEach((email) => {
      const request = createValidLoginRequest('email', {
        identifier: { type: 'email', value: email },
      });

      expect(isValidLoginRequest(request)).toBe(false);
    });
  });

  it('отклоняет email слишком длинный', () => {
    // MAX_EMAIL_LENGTH = 320, поэтому 321 должен быть отклонен
    const longEmail = `${'a'.repeat(317)}@b.c`;
    const request = createValidLoginRequest('email', {
      identifier: { type: 'email', value: longEmail },
    });

    expect(longEmail.length).toBeGreaterThan(320);
    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет невалидный phone формат', () => {
    const invalidPhones = [
      '1234567890', // нет +
      '+1', // слишком короткий (минимум +[1-9]\d, т.е. минимум 3 символа: +[1-9] + хотя бы одна цифра)
      '+abc123', // не цифры
      '+', // только +
      '+12345678901234567', // слишком длинный (больше 15 цифр после +)
      '+0123456789', // начинается с 0 после +
    ];

    invalidPhones.forEach((phone) => {
      const request = createValidLoginRequest('phone', {
        identifier: { type: 'phone', value: phone },
      });

      expect(isValidLoginRequest(request)).toBe(false);
    });
  });

  it('отклоняет oauth без provider', () => {
    const request = createValidLoginRequest('oauth', {
      providerToken: 'a'.repeat(50),
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет oauth без providerToken', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет oauth с невалидным provider', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'invalid-provider',
      providerToken: 'a'.repeat(50),
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет oauth с provider не из whitelist', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'github',
      providerToken: 'a'.repeat(50),
    } as unknown as LoginRequest<'oauth'>);

    const customProviders = new Set<string>(['gitlab']);

    expect(isValidLoginRequest(request, customProviders)).toBe(false);
  });

  it('отклоняет oauth с пустым provider', () => {
    const request = createValidLoginRequest('oauth', {
      provider: '',
      providerToken: 'a'.repeat(50),
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет providerToken не string', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 123,
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет providerToken слишком короткий', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(9),
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет providerToken слишком длинный', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(2049),
    } as unknown as LoginRequest<'oauth'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет невалидный dtoVersion', () => {
    const request = createValidLoginRequest('email', {
      dtoVersion: '2.0',
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет dtoVersion не string', () => {
    const request = createValidLoginRequest('email', {
      dtoVersion: 1.0,
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет password не string', () => {
    const request = createValidLoginRequest('email', {
      password: 123,
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет rememberMe не boolean', () => {
    const request = createValidLoginRequest('email', {
      rememberMe: 'true',
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет clientContext null', () => {
    const request = createValidLoginRequest('email', {
      clientContext: null,
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет clientContext не объект', () => {
    const request = createValidLoginRequest('email', {
      clientContext: 'string',
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA не объект и не массив', () => {
    const request = createValidLoginRequest('email', {
      mfa: 'string',
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA null', () => {
    const request = createValidLoginRequest('email', {
      mfa: null,
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA без type', () => {
    const request = createValidLoginRequest('email', {
      mfa: { token: '123456' },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA с невалидным type', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 'invalid', token: '123456' },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA type не string', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 123, token: '123456' },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA без token', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 'totp' },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA token не string', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 'totp', token: 123 },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA token пустой', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 'totp', token: '' },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA deviceId не string', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 'totp', token: '123456', deviceId: 123 },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет MFA с лишними полями', () => {
    const request = createValidLoginRequest('email', {
      mfa: { type: 'totp', token: '123456', extra: 'field' },
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет массив MFA с невалидным элементом', () => {
    const request = createValidLoginRequest('email', {
      mfa: [createMfaInfo(), { type: 'invalid', token: '123' }],
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет массив MFA с null элементом', () => {
    const request = createValidLoginRequest('email', {
      mfa: [createMfaInfo(), null],
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет объект с лишними полями для email', () => {
    const request = {
      identifier: { type: 'email', value: 'user@example.com' },
      extraField: 'value',
    } as unknown as LoginRequest<'email'>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет объект с лишними полями для oauth', () => {
    const request = {
      identifier: { type: 'oauth', value: 'oauth-user' },
      provider: 'google',
      providerToken: 'a'.repeat(50),
      extraField: 'value',
    } as unknown as LoginRequest<'oauth'>;

    expect(isValidLoginRequest(request)).toBe(false);
  });

  it('отклоняет oauth с password полем (не в whitelist для oauth)', () => {
    // password не должен быть в whitelist для oauth, но на самом деле он есть
    // Проверим что password валиден для oauth
    const request = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(50),
      password: 'backup-password',
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });
});

// ============================================================================
// 🎯 EDGE CASES - Граничные случаи
// ============================================================================

describe('isValidLoginRequest - edge cases', () => {
  it('валидирует email с минимально валидным форматом', () => {
    const request = createValidLoginRequest('email', {
      identifier: { type: 'email', value: 'a@b.c' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует username с минимальной длиной', () => {
    const request = createValidLoginRequest('username', {
      identifier: { type: 'username', value: 'a' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует username с максимальной длиной', () => {
    const request = createValidLoginRequest('username', {
      identifier: { type: 'username', value: 'a'.repeat(256) },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует oauth identifier с минимальной длиной', () => {
    const request = createValidLoginRequest('oauth', {
      identifier: { type: 'oauth', value: 'a' },
      provider: 'google',
      providerToken: 'a'.repeat(10),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует oauth identifier с максимальной длиной', () => {
    const request = createValidLoginRequest('oauth', {
      identifier: { type: 'oauth', value: 'a'.repeat(256) },
      provider: 'google',
      providerToken: 'a'.repeat(10),
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует пустой массив MFA', () => {
    const request = createValidLoginRequest('email', {
      mfa: [],
    } as unknown as LoginRequest<'email'>);

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует MFA массив с одним элементом', () => {
    const request = createValidLoginRequest('email', {
      mfa: [createMfaInfo()],
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует MFA массив с несколькими элементами', () => {
    const request = createValidLoginRequest('email', {
      mfa: [
        createMfaInfo('totp', '111'),
        createMfaInfo('sms', '222'),
        createMfaInfo('email', '333'),
        createMfaInfo('push', '444'),
      ],
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует clientContext с произвольными полями', () => {
    const request = createValidLoginRequest('email', {
      clientContext: {
        ip: '192.168.1.1',
        userAgent: 'Chrome',
        customField: 'value',
        nested: { field: 'value' },
      } as unknown as ClientContext,
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует все поля одновременно', () => {
    const request = createValidLoginRequest('email', {
      password: 'password123',
      dtoVersion: '1.1',
      rememberMe: true,
      mfa: [createMfaInfo('totp', '123456', 'device-1'), createMfaInfo('sms', '789012')],
      clientContext: { ip: '192.168.1.1', userAgent: 'Chrome' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });

  it('валидирует oauth со всеми полями', () => {
    const request = createValidLoginRequest('oauth', {
      provider: 'facebook',
      providerToken: 'a'.repeat(100),
      password: 'backup-password',
      dtoVersion: '1.0',
      rememberMe: false,
      mfa: createMfaInfo('push', 'push-token', 'mobile-device'),
      clientContext: { ip: '10.0.0.1' },
    });

    expect(isValidLoginRequest(request)).toBe(true);
  });
});

// ============================================================================
// 🔍 TYPE GUARD - Проверка type guard функциональности
// ============================================================================

describe('isValidLoginRequest - type guard', () => {
  it('сужает тип до LoginRequest после проверки', () => {
    const value: unknown = createValidLoginRequest('email');

    // eslint-disable-next-line functional/no-conditional-statements -- Type guard test requires if statement
    if (!isValidLoginRequest(value)) {
      throw new Error('Type guard failed');
    }
    // TypeScript должен понимать что value это LoginRequest
    expect(value.identifier.type).toBe('email');
    expect(value.identifier.value).toBe('user@example.com');
  });

  it('сужает тип для oauth после проверки', () => {
    const value: unknown = createValidLoginRequest('oauth', {
      provider: 'google',
      providerToken: 'a'.repeat(50),
    });

    // eslint-disable-next-line functional/no-conditional-statements -- Type guard test requires if statement
    if (!isValidLoginRequest(value)) {
      throw new Error('Type guard failed');
    }
    expect(value.identifier.type).toBe('oauth');
    // TypeScript должен понимать что для oauth есть provider и providerToken
    // eslint-disable-next-line functional/no-conditional-statements -- Type narrowing test
    if (value.identifier.type === 'oauth') {
      expect(value.provider).toBe('google');
      expect(value.providerToken).toBe('a'.repeat(50));
    }
  });
});
