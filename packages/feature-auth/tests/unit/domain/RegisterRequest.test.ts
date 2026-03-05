/**
 * @file Unit тесты для domain/RegisterRequest.ts
 * Полное покрытие запроса регистрации
 */

import { describe, expect, it } from 'vitest';

import type { ClientContext } from '../../../src/domain/ClientContext.js';
import type { MfaInfo } from '../../../src/domain/MfaInfo.js';
import type {
  RegisterIdentifier,
  RegisterIdentifierType,
  RegisterRequest,
} from '../../../src/domain/RegisterRequest.js';
import { registerRequestSchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createClientContext(overrides: Partial<ClientContext> = {}): ClientContext {
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

function createMfaInfo(overrides: Partial<MfaInfo> = {}): MfaInfo {
  return {
    type: 'totp',
    token: '123456',
    deviceId: 'device-mfa',
    ...overrides,
  };
}

function createRegisterRequest<T extends RegisterIdentifierType = 'email'>(
  overrides: Partial<RegisterRequest<T>> = {},
): RegisterRequest<T> {
  const identifier = (overrides.identifier ?? {
    type: 'email',
    value: 'user@example.com',
  }) as RegisterIdentifier<T>;

  // eslint-disable-next-line functional/no-conditional-statements
  if (identifier.type === 'email' || identifier.type === 'phone') {
    return {
      dtoVersion: '1.0',
      identifier,
      username: 'user123',
      password: 'plain-text-password-123',
      mfa: createMfaInfo(),
      clientContext: createClientContext(),
      rememberMe: true,
      ...overrides,
    } as RegisterRequest<T>;
  }

  // eslint-disable-next-line functional/no-conditional-statements
  if (identifier.type === 'oauth') {
    return {
      dtoVersion: '1.0',
      identifier,
      provider: 'google',
      providerToken: 'oauth-access-token-123',
      mfa: createMfaInfo(),
      clientContext: createClientContext(),
      rememberMe: true,
      ...overrides,
    } as RegisterRequest<T>;
  }

  return {
    dtoVersion: '1.0',
    identifier,
    password: 'plain-text-password-123',
    mfa: createMfaInfo(),
    clientContext: createClientContext(),
    rememberMe: true,
    ...overrides,
  } as RegisterRequest<T>;
}

function createMinimalRegisterRequest<T extends RegisterIdentifierType = 'email'>(
  overrides: Partial<RegisterRequest<T>> = {},
): RegisterRequest<T> {
  const identifier = (overrides.identifier ?? {
    type: 'email',
    value: 'user@example.com',
  }) as RegisterIdentifier<T>;

  // eslint-disable-next-line functional/no-conditional-statements
  if (identifier.type === 'email' || identifier.type === 'phone') {
    return {
      identifier,
      username: 'user123',
      password: 'password-123',
      ...overrides,
    } as RegisterRequest<T>;
  }

  // eslint-disable-next-line functional/no-conditional-statements
  if (identifier.type === 'oauth') {
    return {
      identifier,
      provider: 'google',
      providerToken: 'oauth-access-token-123',
      ...overrides,
    } as RegisterRequest<T>;
  }

  return {
    identifier,
    password: 'password-123',
    ...overrides,
  } as RegisterRequest<T>;
}

function createFullRegisterRequest<T extends RegisterIdentifierType = 'email'>(
  overrides: Partial<RegisterRequest<T>> = {},
): RegisterRequest<T> {
  const identifier = (overrides.identifier ?? {
    type: 'email',
    value: 'full@example.com',
  }) as RegisterIdentifier<T>;

  const fullContext = createClientContext({
    ip: '10.0.0.1',
    deviceId: 'device-full-789',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    locale: 'ru-RU',
    timezone: 'Europe/Moscow',
    geo: {
      lat: 52.5200,
      lng: 13.4050,
    },
    sessionId: 'session-full-xyz',
    appVersion: '2.1.0',
  });

  // eslint-disable-next-line functional/no-conditional-statements
  if (identifier.type === 'email' || identifier.type === 'phone') {
    return {
      dtoVersion: '1.1',
      identifier,
      username: 'fulluser',
      password: 'full-password-123',
      mfa: createMfaInfo({
        type: 'sms',
        token: '654321',
        deviceId: 'device-full-mfa',
      }),
      clientContext: fullContext,
      rememberMe: false,
      ...overrides,
    } as RegisterRequest<T>;
  }

  // eslint-disable-next-line functional/no-conditional-statements
  if (identifier.type === 'oauth') {
    return {
      dtoVersion: '1.1',
      identifier,
      provider: 'google',
      providerToken: 'oauth-access-token-full',
      mfa: createMfaInfo({
        type: 'sms',
        token: '654321',
        deviceId: 'device-full-mfa',
      }),
      clientContext: fullContext,
      rememberMe: false,
      ...overrides,
    } as RegisterRequest<T>;
  }

  return {
    dtoVersion: '1.1',
    identifier,
    password: 'full-password-123',
    mfa: createMfaInfo({
      type: 'sms',
      token: '654321',
      deviceId: 'device-full-mfa',
    }),
    clientContext: fullContext,
    rememberMe: false,
    ...overrides,
  } as RegisterRequest<T>;
}

// ============================================================================
// 🎯 REGISTER IDENTIFIER TYPES - Типы идентификаторов
// ============================================================================

describe('RegisterIdentifierType enum coverage', () => {
  const allIdentifierTypes: RegisterIdentifierType[] = ['email', 'username', 'phone', 'oauth'];

  it('поддерживает все типы идентификаторов', () => {
    allIdentifierTypes.forEach((type) => {
      const identifier: RegisterIdentifier<typeof type> = {
        type,
        value: type === 'email'
          ? 'user@example.com'
          : type === 'username'
          ? 'username123'
          : type === 'phone'
          ? '+1234567890'
          : 'oauth-id-123',
      };

      expect(identifier.type).toBe(type);
    });
  });

  it('каждый тип идентификатора имеет правильную структуру', () => {
    // Email
    const emailIdentifier: RegisterIdentifier<'email'> = {
      type: 'email',
      value: 'user@example.com',
    };
    expect(emailIdentifier.type).toBe('email');
    expect(emailIdentifier.value).toBe('user@example.com');

    // Username
    const usernameIdentifier: RegisterIdentifier<'username'> = {
      type: 'username',
      value: 'username123',
    };
    expect(usernameIdentifier.type).toBe('username');
    expect(usernameIdentifier.value).toBe('username123');

    // Phone
    const phoneIdentifier: RegisterIdentifier<'phone'> = {
      type: 'phone',
      value: '+1234567890',
    };
    expect(phoneIdentifier.type).toBe('phone');
    expect(phoneIdentifier.value).toBe('+1234567890');

    // OAuth
    const oauthIdentifier: RegisterIdentifier<'oauth'> = {
      type: 'oauth',
      value: 'oauth-id-123',
    };
    expect(oauthIdentifier.type).toBe('oauth');
    expect(oauthIdentifier.value).toBe('oauth-id-123');
  });
});

// ============================================================================
// 📋 REGISTER REQUEST - Полный DTO
// ============================================================================

describe('RegisterRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request = createMinimalRegisterRequest();

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
    expect(request.username).toBe('user123');
    expect(request.password).toBe('password-123');
    expect(request.dtoVersion).toBeUndefined();
    expect(request.mfa).toBeUndefined();
    expect(request.clientContext).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullRegisterRequest();

    expect(request.dtoVersion).toBe('1.1');
    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('full@example.com');
    expect(request.username).toBe('fulluser');
    expect(request.password).toBe('full-password-123');
    // eslint-disable-next-line functional/no-conditional-statements
    if (request.mfa && !Array.isArray(request.mfa)) {
      expect(request.mfa.type).toBe('sms');
      void (request.mfa.type !== 'push' && expect(request.mfa.token).toBe('654321'));
    }
    expect(request.clientContext?.ip).toBe('10.0.0.1');
    expect(request.rememberMe).toBe(false);
  });

  it('identifier обязателен для идентификатора пользователя', () => {
    const request = createRegisterRequest({
      identifier: {
        type: 'email',
        value: 'required@example.com',
      },
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('required@example.com');
  });

  it('работает с email идентификатором', () => {
    const request = createRegisterRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      username: 'user123',
      password: 'password-123',
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
    expect(request.username).toBe('user123');
    expect(request.password).toBe('password-123');
  });

  it('работает с username идентификатором', () => {
    const request = createRegisterRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
      password: 'password-123',
    });

    expect(request.identifier.type).toBe('username');
    expect(request.identifier.value).toBe('username123');
    expect(request.password).toBe('password-123');
  });

  it('работает с phone идентификатором', () => {
    const request = createRegisterRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
      username: 'phoneuser',
      password: 'password-123',
    });

    expect(request.identifier.type).toBe('phone');
    expect(request.identifier.value).toBe('+1234567890');
    expect(request.username).toBe('phoneuser');
    expect(request.password).toBe('password-123');
  });

  it('работает с oauth идентификатором', () => {
    const request = createRegisterRequest<'oauth'>({
      identifier: {
        type: 'oauth',
        value: 'oauth-id-123',
      },
      provider: 'google',
      providerToken: 'oauth-access-token-123',
    });

    expect(request.identifier.type).toBe('oauth');
    expect(request.identifier.value).toBe('oauth-id-123');
    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-access-token-123');
  });
});

// ============================================================================
// 🔑 REQUIRED FIELDS - Обязательные поля
// ============================================================================

describe('RegisterRequest required fields', () => {
  it('identifier обязателен для идентификатора пользователя', () => {
    const request = createRegisterRequest({
      identifier: {
        type: 'email',
        value: 'required@example.com',
      },
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('required@example.com');
  });

  it('email обязателен для email регистрации', () => {
    const request = createRegisterRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      username: 'user123',
      password: 'password-123',
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
  });

  it('username обязателен для username регистрации', () => {
    const request = createRegisterRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
      password: 'password-123',
    });

    expect(request.identifier.type).toBe('username');
    expect(request.identifier.value).toBe('username123');
  });

  it('password обязателен для email/username/phone регистрации', () => {
    const emailRequest = createRegisterRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      password: 'password-123',
    });
    expect(emailRequest.password).toBe('password-123');

    const usernameRequest = createRegisterRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
      password: 'password-123',
    });
    expect(usernameRequest.password).toBe('password-123');
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('RegisterRequest optional fields', () => {
  it('phone опционально для телефона пользователя', () => {
    const requestWithPhone = createRegisterRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
      username: 'phoneuser',
      password: 'password-123',
    });
    const requestWithoutPhone = createMinimalRegisterRequest();

    expect(requestWithPhone.identifier.type).toBe('phone');
    expect(requestWithoutPhone.identifier.type).toBe('email');
  });

  it('mfaSetup опционально для настройки MFA', () => {
    const requestWithMfa = createRegisterRequest({
      mfa: createMfaInfo(),
    });
    const requestWithoutMfa = createMinimalRegisterRequest();

    // eslint-disable-next-line functional/no-conditional-statements
    if (requestWithMfa.mfa && !Array.isArray(requestWithMfa.mfa)) {
      expect(requestWithMfa.mfa.type).toBe('totp');
      void (requestWithMfa.mfa.type !== 'push' && expect(requestWithMfa.mfa.token).toBe('123456'));
    }
    expect(requestWithoutMfa.mfa).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = createRegisterRequest({
      clientContext: createClientContext(),
    });
    const requestWithoutContext = createMinimalRegisterRequest();

    expect(requestWithContext.clientContext?.ip).toBe('192.168.1.1');
    expect(requestWithoutContext.clientContext).toBeUndefined();
  });

  it('rememberMe опционально для запоминания устройства', () => {
    const requestWithRememberMe = createRegisterRequest({ rememberMe: true });
    const requestWithoutRememberMe = createMinimalRegisterRequest();

    expect(requestWithRememberMe.rememberMe).toBe(true);
    expect(requestWithoutRememberMe.rememberMe).toBeUndefined();
  });
});

// ============================================================================
// 🔄 CONDITIONAL FIELDS - Условные поля
// ============================================================================

describe('RegisterRequest conditional fields', () => {
  it('username доступен только для email и phone (conditional)', () => {
    // Email - username доступен
    const emailRequest = createRegisterRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      username: 'user123',
      password: 'password-123',
    });
    expect(emailRequest.username).toBe('user123');

    // Phone - username доступен
    const phoneRequest = createRegisterRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
      username: 'phoneuser',
      password: 'password-123',
    });
    expect(phoneRequest.username).toBe('phoneuser');
  });

  it('password доступен только для не-OAuth (conditional)', () => {
    // Email - password доступен
    const emailRequest = createRegisterRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      password: 'password-123',
    });
    expect(emailRequest.password).toBe('password-123');

    // Username - password доступен
    const usernameRequest = createRegisterRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
      password: 'password-123',
    });
    expect(usernameRequest.password).toBe('password-123');

    // Phone - password доступен
    const phoneRequest = createRegisterRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
      password: 'password-123',
    });
    expect(phoneRequest.password).toBe('password-123');
  });

  it('provider и providerToken доступны только для OAuth (conditional)', () => {
    const oauthRequest = createRegisterRequest<'oauth'>({
      identifier: {
        type: 'oauth',
        value: 'oauth-id-123',
      },
      provider: 'google',
      providerToken: 'oauth-access-token-123',
    });

    expect(oauthRequest.provider).toBe('google');
    expect(oauthRequest.providerToken).toBe('oauth-access-token-123');
  });

  it('MfaInfo поддерживает массив MFA методов', () => {
    const requestWithArrayMfa = createRegisterRequest({
      mfa: [
        createMfaInfo({ type: 'totp', token: '123456' }),
        createMfaInfo({ type: 'sms', token: '654321' }),
      ],
    });

    expect(Array.isArray(requestWithArrayMfa.mfa)).toBe(true);
    // eslint-disable-next-line functional/no-conditional-statements
    if (Array.isArray(requestWithArrayMfa.mfa)) {
      expect(requestWithArrayMfa.mfa).toHaveLength(2);
      expect(requestWithArrayMfa.mfa[0]?.type).toBe('totp');
      expect(requestWithArrayMfa.mfa[1]?.type).toBe('sms');
    }
  });

  it('MfaInfo поддерживает одиночный MFA метод', () => {
    const requestWithSingleMfa = createRegisterRequest({
      mfa: createMfaInfo({ type: 'totp', token: '123456' }),
    });

    expect(requestWithSingleMfa.mfa).not.toBeUndefined();
    // eslint-disable-next-line functional/no-conditional-statements
    if (requestWithSingleMfa.mfa && !Array.isArray(requestWithSingleMfa.mfa)) {
      expect(requestWithSingleMfa.mfa.type).toBe('totp');
      void (requestWithSingleMfa.mfa.type !== 'push'
        && expect(requestWithSingleMfa.mfa.token).toBe('123456'));
    }
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('RegisterRequest edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const request = createRegisterRequest({
      clientContext: {
        ip: '',
        deviceId: '',
        userAgent: '',
        locale: '',
        timezone: '',
        sessionId: '',
        appVersion: '',
      },
    });

    expect(request.clientContext?.ip).toBe('');
    expect(request.clientContext?.deviceId).toBe('');
  });

  it('работает с различными версиями DTO', () => {
    const versions: ('1.0' | '1.1')[] = ['1.0', '1.1'];

    versions.forEach((version) => {
      const request = createRegisterRequest({ dtoVersion: version });
      expect(request.dtoVersion).toBe(version);
    });
  });

  it('работает с различными email форматами', () => {
    const emails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user123@subdomain.example.com',
    ];

    emails.forEach((email) => {
      const request = createRegisterRequest<'email'>({
        identifier: {
          type: 'email',
          value: email,
        },
        password: 'password-123',
      });
      expect(request.identifier.value).toBe(email);
    });
  });

  it('работает с различными username форматами', () => {
    const usernames = [
      'username123',
      'user_name',
      'user-name',
      'user.name',
      'very-long-username-string',
    ];

    usernames.forEach((username) => {
      const request = createRegisterRequest<'username'>({
        identifier: {
          type: 'username',
          value: username,
        },
        password: 'password-123',
      });
      expect(request.identifier.value).toBe(username);
    });
  });

  it('работает с различными phone форматами', () => {
    const phones = [
      '+1234567890',
      '+1-234-567-8900',
      '(123) 456-7890',
      '+44 20 1234 5678',
    ];

    phones.forEach((phone) => {
      const request = createRegisterRequest<'phone'>({
        identifier: {
          type: 'phone',
          value: phone,
        },
        password: 'password-123',
      });
      expect(request.identifier.value).toBe(phone);
    });
  });

  it('работает с различными типами MFA', () => {
    const mfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

    mfaTypes.forEach((type) => {
      const request = createRegisterRequest({
        mfa: createMfaInfo({ type, token: `${type}-token-123` }),
      });

      // eslint-disable-next-line functional/no-conditional-statements
      if (request.mfa && !Array.isArray(request.mfa)) {
        expect(request.mfa.type).toBe(type);
      }
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('RegisterRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: RegisterRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      username: 'user123',
      password: 'password-immutable',
    };

    // TypeScript предотвращает мутацию
    // request.identifier.type = 'username'; // TypeScript error: Cannot assign to 'type' because it is a read-only property
    // request.password = 'new-password'; // TypeScript error: Cannot assign to 'password' because it is a read-only property

    expect(request.identifier.type).toBe('email');
    expect(request.password).toBe('password-immutable');
  });

  it('identifier readonly - предотвращает мутацию вложенных объектов', () => {
    const request: RegisterRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      password: 'password-123',
    };

    // TypeScript предотвращает мутацию identifier
    // request.identifier.type = 'username'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
  });

  it('mfa readonly - предотвращает мутацию вложенных объектов', () => {
    const request: RegisterRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      password: 'password-123',
      mfa: createMfaInfo(),
    };

    // TypeScript предотвращает мутацию mfa
    // request.mfa!.type = 'sms'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    // eslint-disable-next-line functional/no-conditional-statements
    if (request.mfa && !Array.isArray(request.mfa)) {
      expect(request.mfa.type).toBe('totp');
      void (request.mfa.type !== 'push' && expect(request.mfa.token).toBe('123456'));
    }
  });

  it('clientContext readonly - предотвращает мутацию вложенных объектов', () => {
    const request: RegisterRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      password: 'password-123',
      clientContext: {
        ip: '192.168.1.1',
        deviceId: 'device-immutable',
        sessionId: 'session-immutable',
      },
    };

    // TypeScript предотвращает мутацию clientContext
    // request.clientContext!.ip = 'new-ip'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(request.clientContext?.ip).toBe('192.168.1.1');
    expect(request.clientContext?.deviceId).toBe('device-immutable');
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('RegisterRequest comprehensive snapshots', () => {
  it('full register request - полный snapshot', () => {
    const request = createFullRegisterRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal register request - полный snapshot', () => {
    const request = createMinimalRegisterRequest();

    expect(request).toMatchSnapshot();
  });

  it('register request with email - полный snapshot', () => {
    const request = createRegisterRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      username: 'user123',
      password: 'password-123',
    });

    expect(request).toMatchSnapshot();
  });

  it('register request with username - полный snapshot', () => {
    const request: RegisterRequest<'username'> = {
      identifier: {
        type: 'username',
        value: 'username123',
      },
      password: 'password-123',
    };

    expect(request).toMatchSnapshot();
  });

  it('register request with oauth - полный snapshot', () => {
    const request: RegisterRequest<'oauth'> = {
      identifier: {
        type: 'oauth',
        value: 'oauth-id-123',
      },
      provider: 'google',
      providerToken: 'oauth-access-token-123',
    };

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные register requests проходят Zod схему', () => {
    const validRequest = {
      email: 'user@example.com',
      password: 'password-123',
      workspaceName: 'My Workspace',
    };

    const result = registerRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.password).toBe('password-123');
      expect(result.data.workspaceName).toBe('My Workspace');
    }
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const requestWithExtra = {
      email: 'user@example.com',
      password: 'password-123',
      workspaceName: 'My Workspace',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = registerRequestSchema.safeParse(requestWithExtra);
    expect(result.success).toBe(false);
  });

  it('email обязателен для email пользователя', () => {
    const requestWithoutEmail = {
      // email отсутствует
      password: 'password-123',
      workspaceName: 'My Workspace',
    };

    const result = registerRequestSchema.safeParse(requestWithoutEmail);
    expect(result.success).toBe(false);
  });

  it('password обязателен для пароля пользователя', () => {
    const requestWithoutPassword = {
      email: 'user@example.com',
      // password отсутствует
      workspaceName: 'My Workspace',
    };

    const result = registerRequestSchema.safeParse(requestWithoutPassword);
    expect(result.success).toBe(false);
  });

  it('workspaceName обязателен для имени workspace', () => {
    const requestWithoutWorkspaceName = {
      email: 'user@example.com',
      password: 'password-123',
      // workspaceName отсутствует
    };

    const result = registerRequestSchema.safeParse(requestWithoutWorkspaceName);
    expect(result.success).toBe(false);
  });

  it('email валидируется как строка с форматом email', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user123@subdomain.example.com',
    ];

    validEmails.forEach((email) => {
      const request = {
        email,
        password: 'password-123',
        workspaceName: 'My Workspace',
      };

      const result = registerRequestSchema.safeParse(request);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.email).toBe(email);
      }
    });
  });

  it('email отклоняется при невалидном формате', () => {
    const invalidEmails = [
      'not-an-email',
      'user@',
      '@example.com',
      'user@example',
      'user space@example.com',
    ];

    invalidEmails.forEach((email) => {
      const request = {
        email,
        password: 'password-123',
        workspaceName: 'My Workspace',
      };

      const result = registerRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  it('password должен быть минимум 8 символов', () => {
    const invalidPasswords = [
      'short', // 5 символов
      '1234567', // 7 символов
      'abc', // 3 символа
    ];

    invalidPasswords.forEach((password) => {
      const request = {
        email: 'user@example.com',
        password,
        workspaceName: 'My Workspace',
      };

      const result = registerRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  it('password должен быть максимум 128 символов', () => {
    const longPassword = 'a'.repeat(129); // 129 символов

    const request = {
      email: 'user@example.com',
      password: longPassword,
      workspaceName: 'My Workspace',
    };

    const result = registerRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('password валидируется при длине от 8 до 128 символов', () => {
    const validPasswords = [
      '12345678', // 8 символов (минимум)
      'a'.repeat(128), // 128 символов (максимум)
      'password123', // 12 символов
      'P@ssw0rd!', // 10 символов
    ];

    validPasswords.forEach((password) => {
      const request = {
        email: 'user@example.com',
        password,
        workspaceName: 'My Workspace',
      };

      const result = registerRequestSchema.safeParse(request);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.password).toBe(password);
      }
    });
  });

  it('workspaceName валидируется на минимальную длину', () => {
    const requestWithEmptyWorkspaceName = {
      email: 'user@example.com',
      password: 'password-123',
      workspaceName: '', // пустая строка
    };

    const result = registerRequestSchema.safeParse(requestWithEmptyWorkspaceName);
    expect(result.success).toBe(false);
  });

  it('workspaceName валидируется на максимальную длину', () => {
    const longWorkspaceName = 'a'.repeat(201); // 201 символ

    const request = {
      email: 'user@example.com',
      password: 'password-123',
      workspaceName: longWorkspaceName,
    };

    const result = registerRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = {
      email: 'user@example.com',
      password: 'password-123',
      workspaceName: 'My Workspace',
      clientContext: {
        ip: '192.168.1.1',
        deviceId: 'device-123',
        userAgent: 'Mozilla/5.0',
      },
    };

    const requestWithoutContext = {
      email: 'user@example.com',
      password: 'password-123',
      workspaceName: 'My Workspace',
    };

    const result1 = registerRequestSchema.safeParse(requestWithContext);
    const result2 = registerRequestSchema.safeParse(requestWithoutContext);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.clientContext?.ip).toBe('192.168.1.1');
      expect(result1.data.clientContext?.deviceId).toBe('device-123');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.clientContext).toBeUndefined();
    }
  });
});
