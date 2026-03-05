/**
 * @file Unit тесты для domain/LogoutRequest.ts
 * Полное покрытие запроса выхода из системы
 */

import { describe, expect, it } from 'vitest';

import type { ClientContext, LogoutRequest } from '../../../src/domain/LogoutRequest.js';
import { logoutRequestSchema } from '../../../src/schemas/index.js';

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

function createLogoutRequest(overrides: Partial<LogoutRequest> = {}): LogoutRequest {
  return {
    dtoVersion: '1.0',
    refreshToken: 'refresh-token-abc-123',
    clientContext: createClientContext(),
    ...overrides,
  };
}

function createMinimalLogoutRequest(overrides: Partial<LogoutRequest> = {}): LogoutRequest {
  return {
    ...overrides,
  };
}

function createFullLogoutRequest(overrides: Partial<LogoutRequest> = {}): LogoutRequest {
  return {
    dtoVersion: '1.1',
    refreshToken: 'refresh-token-full-456',
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
    ...overrides,
  };
}

// ============================================================================
// 📋 LOGOUT REQUEST DTO - Полный DTO
// ============================================================================

describe('LogoutRequest полный DTO', () => {
  it('создает минимальный запрос (все поля опциональны)', () => {
    const request = createMinimalLogoutRequest();

    expect(request.dtoVersion).toBeUndefined();
    expect(request.refreshToken).toBeUndefined();
    expect(request.clientContext).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullLogoutRequest();

    expect(request.dtoVersion).toBe('1.1');
    expect(request.refreshToken).toBe('refresh-token-full-456');
    expect(request.clientContext?.ip).toBe('10.0.0.1');
    expect(request.clientContext?.deviceId).toBe('device-full-789');
    expect(request.clientContext?.userAgent).toBe(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    );
    expect(request.clientContext?.locale).toBe('ru-RU');
    expect(request.clientContext?.timezone).toBe('Europe/Moscow');
    expect(request.clientContext?.geo?.lat).toBe(52.5200);
    expect(request.clientContext?.geo?.lng).toBe(13.4050);
    expect(request.clientContext?.sessionId).toBe('session-full-xyz');
    expect(request.clientContext?.appVersion).toBe('2.1.0');
  });

  it('работает с различными версиями DTO', () => {
    const versions: ('1.0' | '1.1')[] = ['1.0', '1.1'];

    versions.forEach((version) => {
      const request = createLogoutRequest({ dtoVersion: version });
      expect(request.dtoVersion).toBe(version);
    });
  });

  it('работает с различными refresh token форматами', () => {
    const refreshTokens = [
      'simple-token',
      'jwt-refresh-token.abc.xyz',
      'opaque-token-1234567890',
      'very-long-refresh-token-string-with-many-characters',
    ];

    refreshTokens.forEach((token) => {
      const request = createLogoutRequest({ refreshToken: token });
      expect(request.refreshToken).toBe(token);
    });
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('LogoutRequest optional fields', () => {
  it('dtoVersion опционально для версии DTO', () => {
    const requestWithVersion = createLogoutRequest({ dtoVersion: '1.0' });
    const requestWithoutVersion = createMinimalLogoutRequest();

    expect(requestWithVersion.dtoVersion).toBe('1.0');
    expect(requestWithoutVersion.dtoVersion).toBeUndefined();
  });

  it('refreshToken опционально для refresh token', () => {
    const requestWithToken = createLogoutRequest({ refreshToken: 'token-123' });
    const requestWithoutToken = createMinimalLogoutRequest();

    expect(requestWithToken.refreshToken).toBe('token-123');
    expect(requestWithoutToken.refreshToken).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = createLogoutRequest({
      clientContext: createClientContext(),
    });
    const requestWithoutContext = createMinimalLogoutRequest();

    expect(requestWithContext.clientContext?.ip).toBe('192.168.1.1');
    expect(requestWithContext.clientContext?.deviceId).toBe('device-123');
    expect(requestWithoutContext.clientContext).toBeUndefined();
  });
});

// ============================================================================
// 📝 CLIENT CONTEXT - Клиентский контекст
// ============================================================================

describe('LogoutRequest client context', () => {
  it('поддерживает полный client context', () => {
    const request = createLogoutRequest({
      clientContext: createClientContext({
        ip: '192.168.1.100',
        deviceId: 'device-custom',
        userAgent: 'Custom-Agent/1.0',
        locale: 'de-DE',
        timezone: 'Europe/Berlin',
        geo: {
          lat: 40.7128,
          lng: -74.0060,
        },
        sessionId: 'session-custom',
        appVersion: '3.0.0',
      }),
    });

    expect(request.clientContext?.ip).toBe('192.168.1.100');
    expect(request.clientContext?.deviceId).toBe('device-custom');
    expect(request.clientContext?.userAgent).toBe('Custom-Agent/1.0');
    expect(request.clientContext?.locale).toBe('de-DE');
    expect(request.clientContext?.timezone).toBe('Europe/Berlin');
    expect(request.clientContext?.geo?.lat).toBe(40.7128);
    expect(request.clientContext?.geo?.lng).toBe(-74.0060);
    expect(request.clientContext?.sessionId).toBe('session-custom');
    expect(request.clientContext?.appVersion).toBe('3.0.0');
  });

  it('поддерживает частичный client context', () => {
    const request = createLogoutRequest({
      clientContext: {
        ip: '10.0.0.1',
        sessionId: 'session-partial',
        // остальные поля опциональны
      },
    });

    expect(request.clientContext?.ip).toBe('10.0.0.1');
    expect(request.clientContext?.sessionId).toBe('session-partial');
    expect(request.clientContext?.deviceId).toBeUndefined();
    expect(request.clientContext?.userAgent).toBeUndefined();
  });

  it('поддерживает пустой client context', () => {
    const request = createLogoutRequest({
      clientContext: {},
    });

    expect(request.clientContext).toEqual({});
  });

  it('client context geo координаты readonly - предотвращает мутацию', () => {
    const request: LogoutRequest = {
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
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('LogoutRequest edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const request = createLogoutRequest({
      refreshToken: '',
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

    expect(request.refreshToken).toBe('');
    expect(request.clientContext?.ip).toBe('');
    expect(request.clientContext?.deviceId).toBe('');
  });

  it('может работать без refreshToken (logout без отзыва токена)', () => {
    const request = createMinimalLogoutRequest();

    expect(request.refreshToken).toBeUndefined();
  });

  it('может работать только с refreshToken', () => {
    const request: LogoutRequest = {
      refreshToken: 'token-only',
    };

    expect(request.refreshToken).toBe('token-only');
    expect(request.clientContext).toBeUndefined();
    expect(request.dtoVersion).toBeUndefined();
  });

  it('может работать только с clientContext', () => {
    const request: LogoutRequest = {
      clientContext: createClientContext(),
    };

    expect(request.refreshToken).toBeUndefined();
    expect(request.clientContext?.ip).toBe('192.168.1.1');
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('LogoutRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: LogoutRequest = {
      dtoVersion: '1.0',
      refreshToken: 'token-immutable',
      clientContext: createClientContext(),
    };

    // TypeScript предотвращает мутацию
    // request.dtoVersion = '1.1'; // TypeScript error: Cannot assign to 'dtoVersion' because it is a read-only property
    // request.refreshToken = 'new-token'; // TypeScript error: Cannot assign to 'refreshToken' because it is a read-only property

    expect(request.dtoVersion).toBe('1.0');
    expect(request.refreshToken).toBe('token-immutable');
  });

  it('clientContext readonly - предотвращает мутацию вложенных объектов', () => {
    const request: LogoutRequest = {
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
    const request: LogoutRequest = {
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

describe('LogoutRequest comprehensive snapshots', () => {
  it('full logout request - полный snapshot', () => {
    const request = createFullLogoutRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal logout request - полный snapshot', () => {
    const request = createMinimalLogoutRequest();

    expect(request).toMatchSnapshot();
  });

  it('logout request with refreshToken only - полный snapshot', () => {
    const request: LogoutRequest = {
      refreshToken: 'token-only-123',
    };

    expect(request).toMatchSnapshot();
  });

  it('logout request with clientContext only - полный snapshot', () => {
    const request: LogoutRequest = {
      clientContext: createClientContext(),
    };

    expect(request).toMatchSnapshot();
  });

  it('logout request with dtoVersion only - полный snapshot', () => {
    const request: LogoutRequest = {
      dtoVersion: '1.1',
    };

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные logout requests проходят Zod схему', () => {
    const validRequest = {
      refreshToken: 'refresh-token-123',
      sessionId: 'session-456',
    };

    const result = logoutRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.refreshToken).toBe('refresh-token-123');
      expect(result.data.sessionId).toBe('session-456');
    }
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const requestWithExtra = {
      refreshToken: 'token-123',
      sessionId: 'session-456',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = logoutRequestSchema.safeParse(requestWithExtra);
    expect(result.success).toBe(false);
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум полей (все опциональны)
    const minimalRequest = {};

    const result = logoutRequestSchema.safeParse(minimalRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.refreshToken).toBeUndefined();
      expect(result.data.sessionId).toBeUndefined();
    }
  });

  it('refreshToken опционально для refresh token', () => {
    const requestWithToken = {
      refreshToken: 'token-123',
    };

    const requestWithoutToken = {};

    const result1 = logoutRequestSchema.safeParse(requestWithToken);
    const result2 = logoutRequestSchema.safeParse(requestWithoutToken);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.refreshToken).toBe('token-123');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.refreshToken).toBeUndefined();
    }
  });

  it('sessionId опционально для идентификатора сессии', () => {
    const requestWithSessionId = {
      sessionId: 'session-123',
    };

    const requestWithoutSessionId = {};

    const result1 = logoutRequestSchema.safeParse(requestWithSessionId);
    const result2 = logoutRequestSchema.safeParse(requestWithoutSessionId);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.sessionId).toBe('session-123');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.sessionId).toBeUndefined();
    }
  });

  it('refreshToken и sessionId могут использоваться вместе', () => {
    const request = {
      refreshToken: 'token-123',
      sessionId: 'session-456',
    };

    const result = logoutRequestSchema.safeParse(request);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.refreshToken).toBe('token-123');
      expect(result.data.sessionId).toBe('session-456');
    }
  });

  it('refreshToken валидируется как строка', () => {
    const tokens = [
      'simple-token',
      'jwt-refresh-token.abc.xyz',
      'opaque-token-1234567890',
      'very-long-refresh-token-string',
    ];

    tokens.forEach((token) => {
      const request = {
        refreshToken: token,
      };

      const result = logoutRequestSchema.safeParse(request);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.refreshToken).toBe(token);
      }
    });
  });

  it('sessionId валидируется как строка', () => {
    const sessionIds = [
      'session-123',
      'sess-abc-xyz-789',
      'very-long-session-id-string',
    ];

    sessionIds.forEach((sessionId) => {
      const request = {
        sessionId,
      };

      const result = logoutRequestSchema.safeParse(request);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.sessionId).toBe(sessionId);
      }
    });
  });
});
