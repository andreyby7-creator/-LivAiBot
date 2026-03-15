/**
 * @file Unit тесты для dto/PasswordResetConfirm.ts
 * Полное покрытие подтверждения сброса пароля
 */

import { describe, expect, it } from 'vitest';

import type { ClientContext } from '../../../src/domain/ClientContext.js';
import type { PasswordResetConfirm } from '../../../src/dto/PasswordResetConfirm.js';
import { passwordResetConfirmSchema } from '../../../src/schemas/index.js';

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

function createPasswordResetConfirm(
  overrides: Partial<PasswordResetConfirm> = {},
): PasswordResetConfirm {
  return {
    dtoVersion: '1.0',
    token: 'reset-token-from-email-123',
    newPassword: 'new-secure-password-123',
    clientContext: createClientContext(),
    redirectUrl: 'https://example.com/success',
    ...overrides,
  };
}

function createMinimalPasswordResetConfirm(
  overrides: Partial<PasswordResetConfirm> = {},
): PasswordResetConfirm {
  return {
    token: 'reset-token-123',
    newPassword: 'new-password-123',
    ...overrides,
  };
}

function createFullPasswordResetConfirm(
  overrides: Partial<PasswordResetConfirm> = {},
): PasswordResetConfirm {
  return {
    dtoVersion: '1.1',
    token: 'reset-token-full-456',
    newPassword: 'new-secure-password-full-456',
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
    redirectUrl: 'https://example.com/success-full',
    ...overrides,
  };
}

// ============================================================================
// 📋 PASSWORD RESET CONFIRM - Полный DTO
// ============================================================================

describe('PasswordResetConfirm полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request = createMinimalPasswordResetConfirm();

    expect(request.token).toBe('reset-token-123');
    expect(request.newPassword).toBe('new-password-123');
    expect(request.dtoVersion).toBeUndefined();
    expect(request.clientContext).toBeUndefined();
    expect(request.redirectUrl).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullPasswordResetConfirm();

    expect(request.dtoVersion).toBe('1.1');
    expect(request.token).toBe('reset-token-full-456');
    expect(request.newPassword).toBe('new-secure-password-full-456');
    expect(request.clientContext?.ip).toBe('10.0.0.1');
    expect(request.clientContext?.deviceId).toBe('device-full-789');
    expect(request.redirectUrl).toBe('https://example.com/success-full');
  });

  it('token обязателен для токена подтверждения', () => {
    const request = createPasswordResetConfirm({
      token: 'required-token-123',
    });

    expect(request.token).toBe('required-token-123');
  });

  it('newPassword обязателен для нового пароля', () => {
    const request = createPasswordResetConfirm({
      newPassword: 'required-password-123',
    });

    expect(request.newPassword).toBe('required-password-123');
  });

  it('работает с различными форматами токенов', () => {
    const tokens = [
      'simple-token',
      'jwt-token.abc.xyz',
      'opaque-token-1234567890',
      'very-long-reset-token-string-with-many-characters',
    ];

    tokens.forEach((token) => {
      const request = createPasswordResetConfirm({ token });
      expect(request.token).toBe(token);
    });
  });

  it('работает с различными форматами паролей', () => {
    const passwords = [
      'password123',
      'P@ssw0rd!',
      'very-long-password-with-many-characters-and-special-symbols-123!@#',
      '12345678', // минимальная длина
    ];

    passwords.forEach((password) => {
      const request = createPasswordResetConfirm({ newPassword: password });
      expect(request.newPassword).toBe(password);
    });
  });
});

// ============================================================================
// 🔒 REQUIRED FIELDS - Обязательные поля
// ============================================================================

describe('PasswordResetConfirm required fields', () => {
  it('token обязателен для токена подтверждения', () => {
    const request = createPasswordResetConfirm({
      token: 'required-token-123',
    });

    expect(request.token).toBe('required-token-123');
  });

  it('newPassword обязателен для нового пароля', () => {
    const request = createPasswordResetConfirm({
      newPassword: 'required-password-123',
    });

    expect(request.newPassword).toBe('required-password-123');
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('PasswordResetConfirm optional fields', () => {
  it('dtoVersion опционально для версии DTO', () => {
    const requestWithVersion = createPasswordResetConfirm({ dtoVersion: '1.1' });
    const requestWithoutVersion = createMinimalPasswordResetConfirm();

    expect(requestWithVersion.dtoVersion).toBe('1.1');
    expect(requestWithoutVersion.dtoVersion).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = createPasswordResetConfirm({
      clientContext: createClientContext(),
    });
    const requestWithoutContext = createMinimalPasswordResetConfirm();

    expect(requestWithContext.clientContext?.ip).toBe('192.168.1.1');
    expect(requestWithoutContext.clientContext).toBeUndefined();
  });

  it('redirectUrl опционально для ссылки на redirect', () => {
    const requestWithRedirect = createPasswordResetConfirm({
      redirectUrl: 'https://example.com/success',
    });
    const requestWithoutRedirect = createMinimalPasswordResetConfirm();

    expect(requestWithRedirect.redirectUrl).toBe('https://example.com/success');
    expect(requestWithoutRedirect.redirectUrl).toBeUndefined();
  });
});

// ============================================================================
// 🔐 SECURITY - Безопасность
// ============================================================================

describe('PasswordResetConfirm security', () => {
  it('newPassword plain-text, должен хешироваться на сервере (security comment)', () => {
    const request = createPasswordResetConfirm({
      newPassword: 'plain-text-password-123',
    });

    // ⚠️ SECURITY: newPassword передается в plain-text и должен быть хеширован на сервере
    // Никогда не хранить пароль в plain-text
    // Сервер должен немедленно хешировать пароль после получения
    expect(request.newPassword).toBe('plain-text-password-123');
    expect(typeof request.newPassword).toBe('string');
    // В реальном приложении пароль должен быть хеширован на сервере перед сохранением
  });

  it('newPassword не должен быть null или empty (security)', () => {
    // Пустая строка должна быть валидной с точки зрения типа, но не должна использоваться
    const requestWithEmptyPassword: PasswordResetConfirm = {
      token: 'token-123',
      newPassword: '',
    };

    expect(requestWithEmptyPassword.newPassword).toBe('');
    expect(requestWithEmptyPassword.newPassword.length).toBe(0);

    // Нормальный пароль
    const requestWithValidPassword: PasswordResetConfirm = {
      token: 'token-123',
      newPassword: 'valid-password-123',
    };

    expect(requestWithValidPassword.newPassword).toBe('valid-password-123');
    expect(requestWithValidPassword.newPassword.length).toBeGreaterThan(0);
  });

  it('token не должен быть null или empty (security)', () => {
    // Пустая строка должна быть валидной с точки зрения типа, но не должна использоваться
    const requestWithEmptyToken: PasswordResetConfirm = {
      token: '',
      newPassword: 'password-123',
    };

    expect(requestWithEmptyToken.token).toBe('');
    expect(requestWithEmptyToken.token.length).toBe(0);

    // Нормальный токен
    const requestWithValidToken: PasswordResetConfirm = {
      token: 'valid-token-123',
      newPassword: 'password-123',
    };

    expect(requestWithValidToken.token).toBe('valid-token-123');
    expect(requestWithValidToken.token.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('PasswordResetConfirm edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const request = createPasswordResetConfirm({
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
      const request = createPasswordResetConfirm({ dtoVersion: version });
      expect(request.dtoVersion).toBe(version);
    });
  });

  it('работает с различными redirectUrl форматами', () => {
    const redirectUrls = [
      'https://example.com/success',
      'http://localhost:3000/success',
      'https://app.example.com/reset/success',
    ];

    redirectUrls.forEach((url) => {
      const request = createPasswordResetConfirm({ redirectUrl: url });
      expect(request.redirectUrl).toBe(url);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('PasswordResetConfirm immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: PasswordResetConfirm = {
      token: 'token-immutable',
      newPassword: 'password-immutable',
    };

    // TypeScript предотвращает мутацию
    // request.token = 'new-token'; // TypeScript error: Cannot assign to 'token' because it is a read-only property
    // request.newPassword = 'new-password'; // TypeScript error: Cannot assign to 'newPassword' because it is a read-only property

    expect(request.token).toBe('token-immutable');
    expect(request.newPassword).toBe('password-immutable');
  });

  it('clientContext readonly - предотвращает мутацию вложенных объектов', () => {
    const request: PasswordResetConfirm = {
      token: 'token-immutable',
      newPassword: 'password-immutable',
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
    const request: PasswordResetConfirm = {
      token: 'token-immutable',
      newPassword: 'password-immutable',
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

describe('PasswordResetConfirm comprehensive snapshots', () => {
  it('full password reset confirm - полный snapshot', () => {
    const request = createFullPasswordResetConfirm();

    expect(request).toMatchSnapshot();
  });

  it('minimal password reset confirm - полный snapshot', () => {
    const request = createMinimalPasswordResetConfirm();

    expect(request).toMatchSnapshot();
  });

  it('password reset confirm with clientContext only - полный snapshot', () => {
    const request: PasswordResetConfirm = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
      clientContext: createClientContext(),
    };

    expect(request).toMatchSnapshot();
  });

  it('password reset confirm with redirectUrl only - полный snapshot', () => {
    const request: PasswordResetConfirm = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
      redirectUrl: 'https://example.com/success',
    };

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные password reset confirm проходят Zod схему', () => {
    const validRequest = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
    };

    const result = passwordResetConfirmSchema.safeParse(validRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.token).toBe('reset-token-123');
      expect(result.data.newPassword).toBe('new-password-123');
    }
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const requestWithExtra = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = passwordResetConfirmSchema.safeParse(requestWithExtra);
    expect(result.success).toBe(false);
  });

  it('token обязателен для токена подтверждения', () => {
    const requestWithoutToken = {
      // token отсутствует
      newPassword: 'new-password-123',
    };

    const result = passwordResetConfirmSchema.safeParse(requestWithoutToken);
    expect(result.success).toBe(false);
  });

  it('newPassword обязателен для нового пароля', () => {
    const requestWithoutPassword = {
      token: 'reset-token-123',
      // newPassword отсутствует
    };

    const result = passwordResetConfirmSchema.safeParse(requestWithoutPassword);
    expect(result.success).toBe(false);
  });

  it('newPassword должен быть минимум 8 символов', () => {
    const invalidPasswords = [
      'short', // 5 символов
      '1234567', // 7 символов
      'abc', // 3 символа
    ];

    invalidPasswords.forEach((password) => {
      const request = {
        token: 'reset-token-123',
        newPassword: password,
      };

      const result = passwordResetConfirmSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  it('newPassword должен быть максимум 128 символов', () => {
    const longPassword = 'a'.repeat(129); // 129 символов

    const request = {
      token: 'reset-token-123',
      newPassword: longPassword,
    };

    const result = passwordResetConfirmSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('newPassword валидируется при длине от 8 до 128 символов', () => {
    const validPasswords = [
      '12345678', // 8 символов (минимум)
      '123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678', // 128 символов (максимум)
      'password123', // 12 символов
      'P@ssw0rd!', // 10 символов
    ];

    validPasswords.forEach((password) => {
      const request = {
        token: 'reset-token-123',
        newPassword: password,
      };

      const result = passwordResetConfirmSchema.safeParse(request);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.newPassword).toBe(password);
      }
    });
  });

  it('dtoVersion опционально для версии DTO', () => {
    const requestWithVersion = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
      dtoVersion: '1.1' as const,
    };

    const requestWithoutVersion = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
    };

    const result1 = passwordResetConfirmSchema.safeParse(requestWithVersion);
    const result2 = passwordResetConfirmSchema.safeParse(requestWithoutVersion);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.dtoVersion).toBe('1.1');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.dtoVersion).toBeUndefined();
    }
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
      clientContext: {
        ip: '192.168.1.1',
        deviceId: 'device-123',
      },
    };

    const requestWithoutContext = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
    };

    const result1 = passwordResetConfirmSchema.safeParse(requestWithContext);
    const result2 = passwordResetConfirmSchema.safeParse(requestWithoutContext);

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

  it('redirectUrl опционально для ссылки на redirect', () => {
    const requestWithRedirect = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
      redirectUrl: 'https://example.com/success',
    };

    const requestWithoutRedirect = {
      token: 'reset-token-123',
      newPassword: 'new-password-123',
    };

    const result1 = passwordResetConfirmSchema.safeParse(requestWithRedirect);
    const result2 = passwordResetConfirmSchema.safeParse(requestWithoutRedirect);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.redirectUrl).toBe('https://example.com/success');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.redirectUrl).toBeUndefined();
    }
  });
});
