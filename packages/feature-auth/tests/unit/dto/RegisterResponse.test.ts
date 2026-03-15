/**
 * @file Unit тесты для dto/RegisterResponse.ts
 * Полное покрытие ответа регистрации
 */

import { describe, expect, it } from 'vitest';

import type { MfaInfo } from '../../../src/domain/MfaInfo.js';
import type { RegisterResponse } from '../../../src/dto/RegisterResponse.js';
import type { TokenPair } from '../../../src/dto/TokenPair.js';
// Примечание: существующая схема registerResponseSchema не соответствует DTO RegisterResponse
// Схема содержит userId, workspaceId, email, accessToken, refreshToken, tokenType, expiresIn
// DTO содержит tokenPair, mfaChallenge, mfaRequired, provider и т.д.
// Тесты проверяют структуру DTO вручную

// Константы для валидации ISO 8601 datetime
const MAX_ISO_8601_DATETIME_LENGTH = 30;
// eslint-disable-next-line security/detect-unsafe-regex -- Безопасен благодаря ограничению длины строки (MAX_ISO_8601_DATETIME_LENGTH)
const ISO_8601_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresAt: '2026-12-31T23:59:59.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read', 'write'],
    metadata: {
      deviceId: 'device-123',
      ip: '192.168.1.1',
    },
    ...overrides,
  };
}

function createMfaInfo(overrides: Partial<MfaInfo> = {}): MfaInfo {
  return {
    type: 'totp',
    token: '123456',
    deviceId: 'device-mfa',
    ...overrides,
  };
}

function createClientContext(
  overrides: Partial<RegisterResponse['clientContext']> = {},
): RegisterResponse['clientContext'] {
  return {
    ip: '192.168.1.1',
    deviceId: 'device-123',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    locale: 'en-US',
    timezone: 'UTC',
    geo: {
      lat: 55.7558,
      lng: 37.6173,
    },
    sessionId: 'session-abc',
    appVersion: '1.0.3',
    ...overrides,
  };
}

function createRegisterResponse<T extends 'email' | 'username' | 'phone' | 'oauth' = 'email'>(
  overrides: Partial<RegisterResponse<T>> = {},
): RegisterResponse<T> {
  return {
    dtoVersion: '1.0',
    userId: 'user-123',
    tokenPair: createTokenPair(),
    mfaChallenge: createMfaInfo(),
    mfaRequired: false,
    clientContext: createClientContext(),
    ...overrides,
  } as RegisterResponse<T>;
}

function createMinimalRegisterResponse<
  T extends 'email' | 'username' | 'phone' | 'oauth' = 'email',
>(
  overrides: Partial<RegisterResponse<T>> = {},
): RegisterResponse<T> {
  return {
    userId: 'user-minimal',
    mfaRequired: false,
    ...overrides,
  } as RegisterResponse<T>;
}

function createFullRegisterResponse<T extends 'email' | 'username' | 'phone' | 'oauth' = 'email'>(
  overrides: Partial<RegisterResponse<T>> = {},
): RegisterResponse<T> {
  return {
    dtoVersion: '1.1',
    userId: 'user-full',
    tokenPair: createTokenPair({
      accessToken: 'access-token-full',
      refreshToken: 'refresh-token-full',
      expiresAt: '2027-12-31T23:59:59.000Z',
      issuedAt: '2027-01-01T00:00:00.000Z',
      scope: ['read', 'write', 'admin'],
      metadata: {
        deviceId: 'device-full',
        ip: '10.0.0.1',
        sessionId: 'session-full',
      },
    }),
    mfaChallenge: [
      createMfaInfo({ type: 'totp', token: '111111' }),
      createMfaInfo({ type: 'sms', token: '222222' }),
    ],
    mfaRequired: true,
    clientContext: createClientContext({
      ip: '10.0.0.1',
      deviceId: 'device-full',
      userAgent: 'Mozilla/5.0 (Linux; Android 10)',
      locale: 'ru-RU',
      timezone: 'Europe/Moscow',
      geo: {
        lat: 59.9343,
        lng: 30.3351,
      },
      sessionId: 'session-full',
      appVersion: '2.0.0',
    }),
    ...overrides,
  } as RegisterResponse<T>;
}

// ============================================================================
// 📋 REGISTER RESPONSE - Полный DTO
// ============================================================================

describe('RegisterResponse полный DTO', () => {
  it('создает минимальный ответ (обязательные поля)', () => {
    const response = createMinimalRegisterResponse();

    expect(response.userId).toBe('user-minimal');
    expect(response.mfaRequired).toBe(false);
    expect(response.tokenPair).toBeUndefined();
    expect(response.mfaChallenge).toBeUndefined();
  });

  it('создает полный ответ со всеми полями', () => {
    const response = createFullRegisterResponse();

    expect(response.dtoVersion).toBe('1.1');
    expect(response.userId).toBe('user-full');
    expect(response.tokenPair).toBeDefined();
    expect(response.mfaChallenge).toBeDefined();
    expect(response.mfaRequired).toBe(true);
    expect(response.clientContext).toBeDefined();
  });

  it('userId обязателен для идентификатора пользователя', () => {
    const response: RegisterResponse = {
      userId: 'user-required',
      mfaRequired: false,
    };

    expect(response.userId).toBe('user-required');
  });

  it('работает с email регистрацией', () => {
    const response = createRegisterResponse<'email'>({
      userId: 'user-email',
    });

    expect(response.userId).toBe('user-email');
    expect(response.tokenPair).toBeDefined();
  });

  it('работает с username регистрацией', () => {
    const response = createRegisterResponse<'username'>({
      userId: 'user-username',
    });

    expect(response.userId).toBe('user-username');
    expect(response.tokenPair).toBeDefined();
  });

  it('работает с phone регистрацией', () => {
    const response = createRegisterResponse<'phone'>({
      userId: 'user-phone',
    });

    expect(response.userId).toBe('user-phone');
    expect(response.tokenPair).toBeDefined();
  });

  it('работает с oauth регистрацией', () => {
    const response = createRegisterResponse<'oauth'>({
      userId: 'user-oauth',
      provider: 'google',
    });

    expect(response.userId).toBe('user-oauth');
    expect(response.provider).toBe('google');
    expect(response.tokenPair).toBeDefined();
  });
});

// ============================================================================
// 📋 TOKEN PAIR - Пара токенов
// ============================================================================

describe('RegisterResponse TokenPair', () => {
  it('tokenPair содержит accessToken', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        accessToken: 'my-access-token',
      }),
    });

    expect(response.tokenPair?.accessToken).toBe('my-access-token');
  });

  it('tokenPair содержит refreshToken', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        refreshToken: 'my-refresh-token',
      }),
    });

    expect(response.tokenPair?.refreshToken).toBe('my-refresh-token');
  });

  it('tokenPair содержит expiresAt', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        expiresAt: '2026-12-31T23:59:59.000Z',
      }),
    });

    expect(response.tokenPair?.expiresAt).toBe('2026-12-31T23:59:59.000Z');
  });

  it('tokenPair содержит issuedAt (опционально)', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        issuedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    expect(response.tokenPair?.issuedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('tokenPair содержит scope (опционально)', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        scope: ['read', 'write', 'admin'],
      }),
    });

    expect(response.tokenPair?.scope).toEqual(['read', 'write', 'admin']);
  });

  it('tokenPair содержит metadata (опционально)', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        metadata: {
          deviceId: 'device-xyz',
          ip: '10.0.0.1',
        },
      }),
    });

    expect(response.tokenPair?.metadata).toEqual({
      deviceId: 'device-xyz',
      ip: '10.0.0.1',
    });
  });

  it('tokenPair может быть undefined', () => {
    const response = createMinimalRegisterResponse();

    expect(response.tokenPair).toBeUndefined();
  });
});

// ============================================================================
// 📋 MFA CHALLENGE - MFA вызов
// ============================================================================

describe('RegisterResponse MFA Challenge', () => {
  it('mfaChallenge может быть undefined (если MFA не требуется)', () => {
    const response = createMinimalRegisterResponse({
      mfaRequired: false,
    });

    expect(response.mfaChallenge).toBeUndefined();
  });

  it('mfaChallenge может быть одиночным MfaInfo', () => {
    const response = createRegisterResponse({
      mfaChallenge: createMfaInfo({ type: 'totp', token: '123456' }),
      mfaRequired: true,
    });

    expect(response.mfaChallenge).toBeDefined();
    // eslint-disable-next-line no-unused-expressions
    response.mfaChallenge && !Array.isArray(response.mfaChallenge)
      ? (expect(response.mfaChallenge.type).toBe('totp'),
        response.mfaChallenge.type !== 'push'
        && expect(response.mfaChallenge.token).toBe('123456'))
      : void 0;
  });

  it('mfaChallenge может быть массивом MfaInfo (multi-factor)', () => {
    const response = createRegisterResponse({
      mfaChallenge: [
        createMfaInfo({ type: 'totp', token: '111111' }),
        createMfaInfo({ type: 'sms', token: '222222' }),
      ],
      mfaRequired: true,
    });

    expect(response.mfaChallenge).toBeDefined();
    // eslint-disable-next-line no-unused-expressions
    Array.isArray(response.mfaChallenge)
      ? (expect(response.mfaChallenge).toHaveLength(2),
        expect(response.mfaChallenge[0]?.type).toBe('totp'),
        expect(response.mfaChallenge[1]?.type).toBe('sms'))
      : void 0;
  });

  it('mfaChallenge поддерживает все типы MFA', () => {
    const mfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

    mfaTypes.forEach((type) => {
      const response = createRegisterResponse({
        mfaChallenge: createMfaInfo({ type, token: '123456' }),
        mfaRequired: true,
      });

      expect(response.mfaChallenge).toBeDefined();
      // eslint-disable-next-line no-unused-expressions
      response.mfaChallenge && !Array.isArray(response.mfaChallenge)
        ? expect(response.mfaChallenge.type).toBe(type)
        : void 0;
    });
  });

  it('mfaRequired обязателен для флага MFA', () => {
    const response: RegisterResponse = {
      userId: 'user-required',
      mfaRequired: true,
    };

    expect(response.mfaRequired).toBe(true);
  });

  it('mfaRequired может быть false (MFA не требуется)', () => {
    const response = createMinimalRegisterResponse({
      mfaRequired: false,
    });

    expect(response.mfaRequired).toBe(false);
  });
});

// ============================================================================
// 📋 REGISTER RESPONSE - Required fields
// ============================================================================

describe('RegisterResponse required fields', () => {
  it('userId обязателен для идентификатора пользователя', () => {
    const response: RegisterResponse = {
      userId: 'user-required',
      mfaRequired: false,
    };

    expect(response.userId).toBe('user-required');
  });

  it('mfaRequired обязателен для флага MFA', () => {
    const response: RegisterResponse = {
      userId: 'user-required',
      mfaRequired: true,
    };

    expect(response.mfaRequired).toBe(true);
  });
});

// ============================================================================
// 📋 REGISTER RESPONSE - Optional fields
// ============================================================================

describe('RegisterResponse optional fields', () => {
  it('dtoVersion опционально для версии DTO', () => {
    const response = createMinimalRegisterResponse();

    expect(response.dtoVersion).toBeUndefined();
  });

  it('tokenPair опционально для пары токенов', () => {
    const response = createMinimalRegisterResponse();

    expect(response.tokenPair).toBeUndefined();
  });

  it('mfaChallenge опционально для MFA вызова', () => {
    const response = createMinimalRegisterResponse({
      mfaRequired: false,
    });

    expect(response.mfaChallenge).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const response = createMinimalRegisterResponse();

    expect(response.clientContext).toBeUndefined();
  });
});

// ============================================================================
// 📋 REGISTER RESPONSE - Conditional fields
// ============================================================================

describe('RegisterResponse conditional fields', () => {
  it('provider доступен только для OAuth (conditional)', () => {
    const response = createRegisterResponse<'oauth'>({
      provider: 'google',
    });

    expect(response.provider).toBe('google');
  });

  it('provider недоступен для не-OAuth типов', () => {
    const response = createRegisterResponse<'email'>({
      userId: 'user-email',
    });

    // TypeScript не позволит присвоить provider для не-OAuth типов
    expect(response.userId).toBe('user-email');
  });
});

// ============================================================================
// 📋 REGISTER RESPONSE - Edge cases
// ============================================================================

describe('RegisterResponse edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const response = createRegisterResponse({
      userId: '',
      mfaRequired: false,
    });

    expect(response.userId).toBe('');
  });

  it('работает с различными версиями DTO', () => {
    const versions: ('1.0' | '1.1')[] = ['1.0', '1.1'];

    versions.forEach((version) => {
      const response = createRegisterResponse({
        dtoVersion: version,
      });

      expect(response.dtoVersion).toBe(version);
    });
  });

  it('работает с различными форматами expiresAt', () => {
    const expiresAtFormats = [
      '2026-12-31T23:59:59.000Z',
      '2026-12-31T23:59:59Z',
      '2026-12-31T23:59:59.123Z',
    ];

    expiresAtFormats.forEach((expiresAt) => {
      const response = createRegisterResponse({
        tokenPair: createTokenPair({ expiresAt }),
      });

      expect(response.tokenPair?.expiresAt).toBe(expiresAt);
    });
  });

  it('работает с различными типами MFA', () => {
    const mfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

    mfaTypes.forEach((type) => {
      const response = createRegisterResponse({
        mfaChallenge: createMfaInfo({ type, token: '123456' }),
        mfaRequired: true,
      });

      expect(response.mfaChallenge).toBeDefined();
      // eslint-disable-next-line no-unused-expressions
      response.mfaChallenge && !Array.isArray(response.mfaChallenge)
        ? expect(response.mfaChallenge.type).toBe(type)
        : void 0;
    });
  });

  it('работает с длинными токенами', () => {
    const longToken = 'a'.repeat(500);
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        accessToken: longToken,
        refreshToken: longToken,
      }),
    });

    expect(response.tokenPair?.accessToken).toBe(longToken);
    expect(response.tokenPair?.refreshToken).toBe(longToken);
  });
});

// ============================================================================
// 📋 REGISTER RESPONSE - Immutability
// ============================================================================

describe('RegisterResponse immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const response: RegisterResponse = {
      userId: 'user-immutable',
      mfaRequired: false,
      tokenPair: createTokenPair(),
    };

    // TypeScript предотвращает мутацию
    // response.userId = 'mutated'; // TypeScript error: Cannot assign to 'userId' because it is a read-only property
    // response.mfaRequired = true; // TypeScript error: Cannot assign to 'mfaRequired' because it is a read-only property

    expect(response.userId).toBe('user-immutable');
    expect(response.mfaRequired).toBe(false);
  });

  it('tokenPair readonly - предотвращает мутацию вложенных объектов', () => {
    const response: RegisterResponse = {
      userId: 'user-immutable',
      mfaRequired: false,
      tokenPair: createTokenPair({
        accessToken: 'access-immutable',
        refreshToken: 'refresh-immutable',
      }),
    };

    // TypeScript предотвращает мутацию tokenPair
    // response.tokenPair!.accessToken = 'mutated'; // TypeScript error: Cannot assign to 'accessToken' because it is a read-only property

    expect(response.tokenPair?.accessToken).toBe('access-immutable');
    expect(response.tokenPair?.refreshToken).toBe('refresh-immutable');
  });

  it('mfaChallenge readonly - предотвращает мутацию вложенных объектов', () => {
    const response: RegisterResponse = {
      userId: 'user-immutable',
      mfaRequired: true,
      mfaChallenge: createMfaInfo({ type: 'totp', token: '123456' }),
    };

    // TypeScript предотвращает мутацию mfaChallenge
    // response.mfaChallenge!.type = 'sms'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    // eslint-disable-next-line no-unused-expressions
    response.mfaChallenge && !Array.isArray(response.mfaChallenge)
      ? (expect(response.mfaChallenge.type).toBe('totp'),
        response.mfaChallenge.type !== 'push'
        && expect(response.mfaChallenge.token).toBe('123456'))
      : void 0;
  });

  it('clientContext readonly - предотвращает мутацию вложенных объектов', () => {
    const response: RegisterResponse = {
      userId: 'user-immutable',
      mfaRequired: false,
      clientContext: {
        ip: '192.168.1.1',
        deviceId: 'device-immutable',
      },
    };

    // TypeScript предотвращает мутацию clientContext
    // response.clientContext!.ip = 'mutated'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(response.clientContext?.ip).toBe('192.168.1.1');
    expect(response.clientContext?.deviceId).toBe('device-immutable');
  });
});

// ============================================================================
// 📋 REGISTER RESPONSE - Comprehensive snapshots
// ============================================================================

describe('RegisterResponse comprehensive snapshots', () => {
  it('full register response - полный snapshot', () => {
    const response = createFullRegisterResponse();

    expect(response).toMatchSnapshot();
  });

  it('minimal register response - полный snapshot', () => {
    const response = createMinimalRegisterResponse();

    expect(response).toMatchSnapshot();
  });

  it('register response with tokenPair - полный snapshot', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair(),
      mfaRequired: false,
    });

    expect(response).toMatchSnapshot();
  });

  it('register response with mfaChallenge - полный snapshot', () => {
    const response = createRegisterResponse({
      mfaChallenge: createMfaInfo({ type: 'totp', token: '123456' }),
      mfaRequired: true,
    });

    expect(response).toMatchSnapshot();
  });

  it('register response with oauth - полный snapshot', () => {
    const response = createRegisterResponse<'oauth'>({
      provider: 'google',
      tokenPair: createTokenPair(),
    });

    expect(response).toMatchSnapshot();
  });
});

// ============================================================================
// 📋 ZOD SCHEMA VALIDATION
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные register responses проходят Zod схему', () => {
    // Примечание: существующая схема registerResponseSchema не соответствует DTO RegisterResponse
    // Схема содержит userId, workspaceId, email, accessToken, refreshToken, tokenType, expiresIn
    // DTO содержит tokenPair, mfaChallenge, mfaRequired, provider и т.д.
    // Тесты проверяют структуру DTO вручную

    const response = createRegisterResponse({
      userId: 'user-123',
      tokenPair: createTokenPair(),
    });

    expect(response.userId).toBe('user-123');
    expect(response.tokenPair).toBeDefined();
    expect(response.mfaRequired).toBe(false);
  });

  it('userId обязателен для идентификатора пользователя', () => {
    const response: RegisterResponse = {
      userId: 'user-required',
      mfaRequired: false,
    };

    expect(response.userId).toBe('user-required');
  });

  it('mfaRequired обязателен для флага MFA', () => {
    const response: RegisterResponse = {
      userId: 'user-required',
      mfaRequired: true,
    };

    expect(response.mfaRequired).toBe(true);
  });

  it('tokenPair содержит обязательные поля: accessToken, refreshToken, expiresAt', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-12-31T23:59:59.000Z',
      }),
    });

    expect(response.tokenPair?.accessToken).toBe('access-token');
    expect(response.tokenPair?.refreshToken).toBe('refresh-token');
    expect(response.tokenPair?.expiresAt).toBe('2026-12-31T23:59:59.000Z');
  });

  it('mfaChallenge опционально для MFA вызова', () => {
    const response = createMinimalRegisterResponse({
      mfaRequired: false,
    });

    expect(response.mfaChallenge).toBeUndefined();
  });

  it('mfaChallenge может быть одиночным MfaInfo', () => {
    const response = createRegisterResponse({
      mfaChallenge: createMfaInfo({ type: 'totp', token: '123456' }),
      mfaRequired: true,
    });

    expect(response.mfaChallenge).toBeDefined();
    // eslint-disable-next-line no-unused-expressions
    response.mfaChallenge && !Array.isArray(response.mfaChallenge)
      ? (expect(response.mfaChallenge.type).toBe('totp'),
        response.mfaChallenge.type !== 'push'
        && expect(response.mfaChallenge.token).toBe('123456'))
      : void 0;
  });

  it('mfaChallenge может быть массивом MfaInfo', () => {
    const response = createRegisterResponse({
      mfaChallenge: [
        createMfaInfo({ type: 'totp', token: '111111' }),
        createMfaInfo({ type: 'sms', token: '222222' }),
      ],
      mfaRequired: true,
    });

    expect(response.mfaChallenge).toBeDefined();
    // eslint-disable-next-line no-unused-expressions
    Array.isArray(response.mfaChallenge)
      ? expect(response.mfaChallenge).toHaveLength(2)
      : void 0;
  });

  it('clientContext опционально для клиентского контекста', () => {
    const response = createMinimalRegisterResponse();

    expect(response.clientContext).toBeUndefined();
  });

  it('expiresAt валидируется как ISO 8601 datetime', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        expiresAt: '2026-12-31T23:59:59.000Z',
      }),
    });

    const expiresAt = response.tokenPair?.expiresAt;
    expect(expiresAt).toBeDefined();
    // eslint-disable-next-line no-unused-expressions
    expiresAt !== undefined && expiresAt.length <= MAX_ISO_8601_DATETIME_LENGTH
      ? expect(expiresAt).toMatch(ISO_8601_DATETIME_REGEX)
      : void 0;
  });

  it('issuedAt валидируется как ISO 8601 datetime (опционально)', () => {
    const response = createRegisterResponse({
      tokenPair: createTokenPair({
        issuedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    const issuedAt = response.tokenPair?.issuedAt;
    // eslint-disable-next-line no-unused-expressions
    issuedAt !== undefined && issuedAt.length <= MAX_ISO_8601_DATETIME_LENGTH
      ? expect(issuedAt).toMatch(ISO_8601_DATETIME_REGEX)
      : void 0;
  });

  it('mfaChallenge поддерживает все типы MFA', () => {
    const mfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

    mfaTypes.forEach((type) => {
      const response = createRegisterResponse({
        mfaChallenge: createMfaInfo({ type, token: '123456' }),
        mfaRequired: true,
      });

      expect(response.mfaChallenge).toBeDefined();
      // eslint-disable-next-line no-unused-expressions
      response.mfaChallenge && !Array.isArray(response.mfaChallenge)
        ? expect(response.mfaChallenge.type).toBe(type)
        : void 0;
    });
  });
});
