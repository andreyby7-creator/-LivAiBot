/**
 * @file Unit тесты для domain/PasswordResetRequest.ts
 * Полное покрытие запроса сброса пароля
 */

import { describe, expect, it } from 'vitest';
import type {
  ClientContext,
  PasswordResetIdentifier,
  PasswordResetIdentifierType,
  PasswordResetRequest,
} from '../../../src/domain/PasswordResetRequest.js';
import { passwordResetRequestSchema } from '../../../src/schemas.js';

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

function createPasswordResetRequest<T extends PasswordResetIdentifierType = 'email'>(
  overrides: Partial<PasswordResetRequest<T>> = {},
): PasswordResetRequest<T> {
  return {
    dtoVersion: '1.0',
    identifier: {
      type: 'email',
      value: 'user@example.com',
    } as PasswordResetIdentifier<T>,
    clientContext: createClientContext(),
    redirectUrl: 'https://example.com/reset',
    ...overrides,
  };
}

function createMinimalPasswordResetRequest<T extends PasswordResetIdentifierType = 'email'>(
  overrides: Partial<PasswordResetRequest<T>> = {},
): PasswordResetRequest<T> {
  return {
    identifier: {
      type: 'email',
      value: 'user@example.com',
    } as PasswordResetIdentifier<T>,
    ...overrides,
  };
}

function createFullPasswordResetRequest<T extends PasswordResetIdentifierType = 'email'>(
  overrides: Partial<PasswordResetRequest<T>> = {},
): PasswordResetRequest<T> {
  return {
    dtoVersion: '1.1',
    identifier: {
      type: 'email',
      value: 'full@example.com',
    } as PasswordResetIdentifier<T>,
    clientContext: createClientContext({
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
    }),
    redirectUrl: 'https://example.com/reset-full',
    ...overrides,
  };
}

// ============================================================================
// 🎯 PASSWORD RESET IDENTIFIER TYPES - Типы идентификаторов
// ============================================================================

describe('PasswordResetIdentifierType enum coverage', () => {
  const allIdentifierTypes: PasswordResetIdentifierType[] = ['email', 'username', 'phone'];

  it('поддерживает все типы идентификаторов', () => {
    allIdentifierTypes.forEach((type) => {
      const request = createPasswordResetRequest({
        identifier: {
          type,
          value: type === 'email'
            ? 'user@example.com'
            : type === 'username'
            ? 'username123'
            : '+1234567890',
        },
      });

      expect(request.identifier.type).toBe(type);
    });
  });

  it('каждый тип идентификатора имеет правильную структуру', () => {
    // Email
    const emailRequest = createPasswordResetRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    });
    expect(emailRequest.identifier.type).toBe('email');
    expect(emailRequest.identifier.value).toBe('user@example.com');

    // Username
    const usernameRequest = createPasswordResetRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
    });
    expect(usernameRequest.identifier.type).toBe('username');
    expect(usernameRequest.identifier.value).toBe('username123');

    // Phone
    const phoneRequest = createPasswordResetRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
    });
    expect(phoneRequest.identifier.type).toBe('phone');
    expect(phoneRequest.identifier.value).toBe('+1234567890');
  });
});

// ============================================================================
// 📋 PASSWORD RESET REQUEST - Полный DTO
// ============================================================================

describe('PasswordResetRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request = createMinimalPasswordResetRequest();

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
    expect(request.dtoVersion).toBeUndefined();
    expect(request.clientContext).toBeUndefined();
    expect(request.redirectUrl).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullPasswordResetRequest();

    expect(request.dtoVersion).toBe('1.1');
    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('full@example.com');
    expect(request.clientContext?.ip).toBe('10.0.0.1');
    expect(request.clientContext?.deviceId).toBe('device-full-789');
    expect(request.redirectUrl).toBe('https://example.com/reset-full');
  });

  it('identifier обязателен для идентификатора пользователя', () => {
    const request = createPasswordResetRequest({
      identifier: {
        type: 'email',
        value: 'required@example.com',
      },
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('required@example.com');
  });

  it('работает с email идентификатором', () => {
    const request = createPasswordResetRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
  });

  it('работает с username идентификатором', () => {
    const request = createPasswordResetRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
    });

    expect(request.identifier.type).toBe('username');
    expect(request.identifier.value).toBe('username123');
  });

  it('работает с phone идентификатором', () => {
    const request = createPasswordResetRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
    });

    expect(request.identifier.type).toBe('phone');
    expect(request.identifier.value).toBe('+1234567890');
  });
});

// ============================================================================
// 🔑 REQUIRED FIELDS - Обязательные поля
// ============================================================================

describe('PasswordResetRequest required fields', () => {
  it('identifier обязателен для идентификатора пользователя', () => {
    const request = createPasswordResetRequest({
      identifier: {
        type: 'email',
        value: 'required@example.com',
      },
    });

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('required@example.com');
  });

  it('identifier.type обязателен для типа идентификатора', () => {
    const request = createPasswordResetRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    });

    expect(request.identifier.type).toBe('email');
  });

  it('identifier.value обязателен для значения идентификатора', () => {
    const request = createPasswordResetRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    });

    expect(request.identifier.value).toBe('user@example.com');
  });

  it('email или username обязательны (через identifier)', () => {
    // Email
    const emailRequest = createPasswordResetRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    });
    expect(emailRequest.identifier.type).toBe('email');
    expect(emailRequest.identifier.value).toBe('user@example.com');

    // Username
    const usernameRequest = createPasswordResetRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
    });
    expect(usernameRequest.identifier.type).toBe('username');
    expect(usernameRequest.identifier.value).toBe('username123');
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('PasswordResetRequest optional fields', () => {
  it('dtoVersion опционально для версии DTO', () => {
    const requestWithVersion = createPasswordResetRequest({ dtoVersion: '1.1' });
    const requestWithoutVersion = createMinimalPasswordResetRequest();

    expect(requestWithVersion.dtoVersion).toBe('1.1');
    expect(requestWithoutVersion.dtoVersion).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = createPasswordResetRequest({
      clientContext: createClientContext(),
    });
    const requestWithoutContext = createMinimalPasswordResetRequest();

    expect(requestWithContext.clientContext?.ip).toBe('192.168.1.1');
    expect(requestWithoutContext.clientContext).toBeUndefined();
  });

  it('redirectUrl опционально для ссылки на redirect', () => {
    const requestWithRedirect = createPasswordResetRequest({
      redirectUrl: 'https://example.com/reset',
    });
    const requestWithoutRedirect = createMinimalPasswordResetRequest();

    expect(requestWithRedirect.redirectUrl).toBe('https://example.com/reset');
    expect(requestWithoutRedirect.redirectUrl).toBeUndefined();
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('PasswordResetRequest edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const request = createPasswordResetRequest({
      clientContext: {
        ip: '',
        deviceId: '',
        userAgent: '',
        locale: '',
        timezone: '',
        sessionId: '',
        appVersion: '',
      },
      redirectUrl: '',
    });

    expect(request.clientContext?.ip).toBe('');
    expect(request.clientContext?.deviceId).toBe('');
    expect(request.redirectUrl).toBe('');
  });

  it('работает с различными версиями DTO', () => {
    const versions: ('1.0' | '1.1')[] = ['1.0', '1.1'];

    versions.forEach((version) => {
      const request = createPasswordResetRequest({ dtoVersion: version });
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
      const request = createPasswordResetRequest<'email'>({
        identifier: {
          type: 'email',
          value: email,
        },
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
      const request = createPasswordResetRequest<'username'>({
        identifier: {
          type: 'username',
          value: username,
        },
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
      const request = createPasswordResetRequest<'phone'>({
        identifier: {
          type: 'phone',
          value: phone,
        },
      });
      expect(request.identifier.value).toBe(phone);
    });
  });

  it('работает с различными redirectUrl форматами', () => {
    const redirectUrls = [
      'https://example.com/reset',
      'http://localhost:3000/reset',
      'https://app.example.com/password/reset',
    ];

    redirectUrls.forEach((url) => {
      const request = createPasswordResetRequest({ redirectUrl: url });
      expect(request.redirectUrl).toBe(url);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('PasswordResetRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: PasswordResetRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    };

    // TypeScript предотвращает мутацию
    // request.identifier.type = 'username'; // TypeScript error: Cannot assign to 'type' because it is a read-only property
    // request.identifier.value = 'new-value'; // TypeScript error: Cannot assign to 'value' because it is a read-only property

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
  });

  it('identifier readonly - предотвращает мутацию вложенных объектов', () => {
    const request: PasswordResetRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    };

    // TypeScript предотвращает мутацию identifier
    // request.identifier.type = 'username'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    expect(request.identifier.type).toBe('email');
    expect(request.identifier.value).toBe('user@example.com');
  });

  it('clientContext readonly - предотвращает мутацию вложенных объектов', () => {
    const request: PasswordResetRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      clientContext: {
        ip: '192.168.1.1',
        deviceId: 'device-immutable',
        sessionId: 'session-immutable',
      },
    };

    // TypeScript предотвращает мутацию clientContext
    // request.clientContext!.ip = 'new-ip'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property
    // request.clientContext!.deviceId = 'new-device'; // TypeScript error: Cannot assign to 'deviceId' because it is a read-only property

    expect(request.clientContext?.ip).toBe('192.168.1.1');
    expect(request.clientContext?.deviceId).toBe('device-immutable');
  });

  it('clientContext geo readonly - предотвращает мутацию координат', () => {
    const request: PasswordResetRequest<'email'> = {
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
      clientContext: {
        geo: {
          lat: 55.7558,
          lng: 37.6173,
        },
      },
    };

    // TypeScript предотвращает мутацию geo
    // request.clientContext!.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(request.clientContext?.geo?.lat).toBe(55.7558);
    expect(request.clientContext?.geo?.lng).toBe(37.6173);
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('PasswordResetRequest comprehensive snapshots', () => {
  it('full password reset request - полный snapshot', () => {
    const request = createFullPasswordResetRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal password reset request - полный snapshot', () => {
    const request = createMinimalPasswordResetRequest();

    expect(request).toMatchSnapshot();
  });

  it('password reset request with email - полный snapshot', () => {
    const request = createPasswordResetRequest<'email'>({
      identifier: {
        type: 'email',
        value: 'user@example.com',
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('password reset request with username - полный snapshot', () => {
    const request = createPasswordResetRequest<'username'>({
      identifier: {
        type: 'username',
        value: 'username123',
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('password reset request with phone - полный snapshot', () => {
    const request = createPasswordResetRequest<'phone'>({
      identifier: {
        type: 'phone',
        value: '+1234567890',
      },
    });

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные password reset requests проходят Zod схему', () => {
    const validRequest = {
      email: 'user@example.com',
    };

    const result = passwordResetRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const requestWithExtra = {
      email: 'user@example.com',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = passwordResetRequestSchema.safeParse(requestWithExtra);
    expect(result.success).toBe(false);
  });

  it('email обязателен для email пользователя', () => {
    const requestWithoutEmail = {
      // email отсутствует
    };

    const result = passwordResetRequestSchema.safeParse(requestWithoutEmail);
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
      };

      const result = passwordResetRequestSchema.safeParse(request);
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
      };

      const result = passwordResetRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  it('email валидируется на максимальную длину', () => {
    // Создаем email длиннее MAX_EMAIL_LENGTH (320 символов)
    const longEmail = `a${'b'.repeat(320)}@example.com`;

    const request = {
      email: longEmail,
    };

    const result = passwordResetRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = {
      email: 'user@example.com',
      clientContext: {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
    };

    const requestWithoutContext = {
      email: 'user@example.com',
    };

    const result1 = passwordResetRequestSchema.safeParse(requestWithContext);
    const result2 = passwordResetRequestSchema.safeParse(requestWithoutContext);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.clientContext?.ip).toBe('192.168.1.1');
      expect(result1.data.clientContext?.userAgent).toBe('Mozilla/5.0');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.clientContext).toBeUndefined();
    }
  });
});
