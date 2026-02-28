/**
 * @file Unit тесты для domain/ClientContext.ts
 * Полное покрытие информации о клиентском окружении
 */

import { describe, expect, it } from 'vitest';
import type { ClientContext, ClientContextSafe } from '../../../src/domain/ClientContext.js';
import {
  getAppVersion,
  getDeviceId,
  getGeo,
  getIp,
  getLocale,
  getSessionId,
  getTimezone,
  getUserAgent,
  sanitizeClientContext,
} from '../../../src/domain/ClientContext.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createClientContext(overrides: Partial<ClientContext> = {}): ClientContext {
  return {
    ip: '192.168.1.1',
    deviceId: 'device-123',
    userAgent: 'Mozilla/5.0',
    locale: 'en-US',
    timezone: 'America/New_York',
    geo: { lat: 40.7128, lng: -74.0060 },
    sessionId: 'session-123',
    appVersion: '1.0.0',
    ...overrides,
  };
}

function createMinimalClientContext(overrides: Partial<ClientContext> = {}): ClientContext {
  return {
    ip: '192.168.1.1',
    ...overrides,
  };
}

function createFullClientContext(overrides: Partial<ClientContext> = {}): ClientContext {
  return {
    ip: '192.168.1.1',
    deviceId: 'device-full',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    locale: 'en-US',
    timezone: 'America/New_York',
    geo: { lat: 40.7128, lng: -74.0060 },
    sessionId: 'session-full',
    appVersion: '2.0.0',
    ...overrides,
  };
}

// ============================================================================
// 📋 CLIENT CONTEXT - Полный DTO
// ============================================================================

describe('ClientContext полный DTO', () => {
  it('создает минимальный ClientContext (только IP)', () => {
    const context = createMinimalClientContext();

    expect(context.ip).toBe('192.168.1.1');
    expect(context.deviceId).toBeUndefined();
    expect(context.userAgent).toBeUndefined();
  });

  it('создает полный ClientContext со всеми полями', () => {
    const context = createFullClientContext();

    expect(context.ip).toBe('192.168.1.1');
    expect(context.deviceId).toBe('device-full');
    expect(context.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(context.locale).toBe('en-US');
    expect(context.timezone).toBe('America/New_York');
    expect(context.geo).toEqual({ lat: 40.7128, lng: -74.0060 });
    expect(context.sessionId).toBe('session-full');
    expect(context.appVersion).toBe('2.0.0');
  });

  it('работает с базовым ClientContext', () => {
    const context = createClientContext();

    expect(context.ip).toBe('192.168.1.1');
    expect(context.deviceId).toBe('device-123');
    expect(context.userAgent).toBe('Mozilla/5.0');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Optional fields
// ============================================================================

describe('ClientContext optional fields', () => {
  it('ip опционально', () => {
    const context: ClientContext = {};

    expect(context.ip).toBeUndefined();
  });

  it('deviceId опционально', () => {
    const context = createMinimalClientContext();

    expect(context.deviceId).toBeUndefined();
  });

  it('userAgent опционально', () => {
    const context = createMinimalClientContext();

    expect(context.userAgent).toBeUndefined();
  });

  it('locale опционально', () => {
    const context = createMinimalClientContext();

    expect(context.locale).toBeUndefined();
  });

  it('timezone опционально', () => {
    const context = createMinimalClientContext();

    expect(context.timezone).toBeUndefined();
  });

  it('geo опционально', () => {
    const context = createMinimalClientContext();

    expect(context.geo).toBeUndefined();
  });

  it('sessionId опционально', () => {
    const context = createMinimalClientContext();

    expect(context.sessionId).toBeUndefined();
  });

  it('appVersion опционально', () => {
    const context = createMinimalClientContext();

    expect(context.appVersion).toBeUndefined();
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - IP Address
// ============================================================================

describe('ClientContext IP address', () => {
  it('ip может быть IPv4', () => {
    const context = createClientContext({
      ip: '192.168.1.1',
    });

    expect(context.ip).toBe('192.168.1.1');
  });

  it('ip может быть IPv6', () => {
    const context = createClientContext({
      ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    });

    expect(context.ip).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  });

  it('ip может быть localhost', () => {
    const context = createClientContext({
      ip: '127.0.0.1',
    });

    expect(context.ip).toBe('127.0.0.1');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Device ID
// ============================================================================

describe('ClientContext deviceId', () => {
  it('deviceId может быть строкой', () => {
    const context = createClientContext({
      deviceId: 'device-abc',
    });

    expect(context.deviceId).toBe('device-abc');
  });

  it('deviceId может быть длинной строкой', () => {
    const longDeviceId = `device-${'a'.repeat(100)}`;
    const context = createClientContext({
      deviceId: longDeviceId,
    });

    expect(context.deviceId).toBe(longDeviceId);
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - User Agent
// ============================================================================

describe('ClientContext userAgent', () => {
  it('userAgent может быть строкой браузера', () => {
    const context = createClientContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(context.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  });

  it('userAgent может быть строкой мобильного приложения', () => {
    const context = createClientContext({
      userAgent: 'MyApp/1.0.0 (iOS 15.0)',
    });

    expect(context.userAgent).toBe('MyApp/1.0.0 (iOS 15.0)');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Locale
// ============================================================================

describe('ClientContext locale', () => {
  it('locale может быть в формате BCP 47', () => {
    const context = createClientContext({
      locale: 'en-US',
    });

    expect(context.locale).toBe('en-US');
  });

  it('locale может быть другим языком', () => {
    const context = createClientContext({
      locale: 'ru-RU',
    });

    expect(context.locale).toBe('ru-RU');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Timezone
// ============================================================================

describe('ClientContext timezone', () => {
  it('timezone может быть IANA timezone', () => {
    const context = createClientContext({
      timezone: 'America/New_York',
    });

    expect(context.timezone).toBe('America/New_York');
  });

  it('timezone может быть другим часовым поясом', () => {
    const context = createClientContext({
      timezone: 'Europe/Moscow',
    });

    expect(context.timezone).toBe('Europe/Moscow');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Geo
// ============================================================================

describe('ClientContext geo', () => {
  it('geo может содержать координаты', () => {
    const context = createClientContext({
      geo: { lat: 40.7128, lng: -74.0060 },
    });

    expect(context.geo).toEqual({ lat: 40.7128, lng: -74.0060 });
  });

  it('geo lat может быть положительным числом', () => {
    const context = createClientContext({
      geo: { lat: 55.7558, lng: 37.6173 },
    });

    expect(context.geo?.lat).toBe(55.7558);
  });

  it('geo lng может быть отрицательным числом', () => {
    const context = createClientContext({
      geo: { lat: 40.7128, lng: -74.0060 },
    });

    expect(context.geo?.lng).toBe(-74.0060);
  });

  it('geo lat и lng обязательны в объекте geo', () => {
    const context: ClientContext = {
      geo: { lat: 0, lng: 0 },
    };

    expect(context.geo?.lat).toBe(0);
    expect(context.geo?.lng).toBe(0);
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Session ID
// ============================================================================

describe('ClientContext sessionId', () => {
  it('sessionId может быть строкой', () => {
    const context = createClientContext({
      sessionId: 'session-abc',
    });

    expect(context.sessionId).toBe('session-abc');
  });

  it('sessionId может быть UUID', () => {
    const context = createClientContext({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(context.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - App Version
// ============================================================================

describe('ClientContext appVersion', () => {
  it('appVersion может быть строкой версии', () => {
    const context = createClientContext({
      appVersion: '1.0.0',
    });

    expect(context.appVersion).toBe('1.0.0');
  });

  it('appVersion может быть semantic version', () => {
    const context = createClientContext({
      appVersion: '2.1.3-beta.1',
    });

    expect(context.appVersion).toBe('2.1.3-beta.1');
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Edge cases
// ============================================================================

describe('ClientContext edge cases', () => {
  it('работает с пустым объектом', () => {
    const context: ClientContext = {};

    expect(context.ip).toBeUndefined();
    expect(context.deviceId).toBeUndefined();
    expect(context.userAgent).toBeUndefined();
  });

  it('работает только с IP', () => {
    const context: ClientContext = {
      ip: '192.168.1.1',
    };

    expect(context.ip).toBe('192.168.1.1');
    expect(context.deviceId).toBeUndefined();
  });

  it('работает только с geo', () => {
    const context: ClientContext = {
      geo: { lat: 40.7128, lng: -74.0060 },
    };

    expect(context.geo).toEqual({ lat: 40.7128, lng: -74.0060 });
    expect(context.ip).toBeUndefined();
  });

  it('работает с различными комбинациями полей', () => {
    const combinations: ClientContext[] = [
      { ip: '192.168.1.1' },
      { ip: '192.168.1.1', deviceId: 'device-1' },
      { ip: '192.168.1.1', deviceId: 'device-1', userAgent: 'Mozilla/5.0' },
      { locale: 'en-US', timezone: 'America/New_York' },
      { geo: { lat: 40.7128, lng: -74.0060 } },
    ];

    combinations.forEach((context) => {
      expect(context).toBeDefined();
    });
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Immutability
// ============================================================================

describe('ClientContext immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const context: ClientContext = {
      ip: '192.168.1.1',
      deviceId: 'device-immutable',
    };

    // TypeScript предотвращает мутацию
    // context.ip = 'mutated'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(context.ip).toBe('192.168.1.1');
    expect(context.deviceId).toBe('device-immutable');
  });

  it('geo объект readonly - предотвращает мутацию', () => {
    const context: ClientContext = {
      geo: { lat: 40.7128, lng: -74.0060 },
    };

    // TypeScript предотвращает мутацию
    // context.geo.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(context.geo?.lat).toBe(40.7128);
    expect(context.geo?.lng).toBe(-74.0060);
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Comprehensive snapshots
// ============================================================================

describe('ClientContext comprehensive snapshots', () => {
  it('full client context - полный snapshot', () => {
    const context = createFullClientContext();

    expect(context).toMatchSnapshot();
  });

  it('minimal client context - полный snapshot', () => {
    const context = createMinimalClientContext();

    expect(context).toMatchSnapshot();
  });

  it('client context with geo - полный snapshot', () => {
    const context = createClientContext({
      geo: { lat: 55.7558, lng: 37.6173 },
    });

    expect(context).toMatchSnapshot();
  });

  it('client context with different locales - полный snapshot', () => {
    const locales = ['en-US', 'ru-RU', 'de-DE', 'fr-FR'];

    locales.forEach((locale) => {
      const context = createClientContext({ locale });
      expect(context).toMatchSnapshot();
    });
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Helper Functions (Safe Accessors)
// ============================================================================

describe('ClientContext helper functions', () => {
  it('getIp возвращает IP или null', () => {
    const contextWithIp = createClientContext({ ip: '192.168.1.1' });
    const contextWithoutIp: ClientContext = {};

    expect(getIp(contextWithIp)).toBe('192.168.1.1');
    expect(getIp(contextWithoutIp)).toBeNull();
  });

  it('getDeviceId возвращает deviceId или null', () => {
    const contextWithDevice = createClientContext({ deviceId: 'device-abc' });
    const contextWithoutDevice: ClientContext = {};

    expect(getDeviceId(contextWithDevice)).toBe('device-abc');
    expect(getDeviceId(contextWithoutDevice)).toBeNull();
  });

  it('getUserAgent возвращает userAgent или null', () => {
    const contextWithUA = createClientContext({ userAgent: 'Mozilla/5.0' });
    const contextWithoutUA: ClientContext = {};

    expect(getUserAgent(contextWithUA)).toBe('Mozilla/5.0');
    expect(getUserAgent(contextWithoutUA)).toBeNull();
  });

  it('getLocale возвращает locale или null', () => {
    const contextWithLocale = createClientContext({ locale: 'en-US' });
    const contextWithoutLocale: ClientContext = {};

    expect(getLocale(contextWithLocale)).toBe('en-US');
    expect(getLocale(contextWithoutLocale)).toBeNull();
  });

  it('getTimezone возвращает timezone или null', () => {
    const contextWithTz = createClientContext({ timezone: 'America/New_York' });
    const contextWithoutTz: ClientContext = {};

    expect(getTimezone(contextWithTz)).toBe('America/New_York');
    expect(getTimezone(contextWithoutTz)).toBeNull();
  });

  it('getGeo возвращает geo или null', () => {
    const geo = { lat: 40.7128, lng: -74.0060 } as const;
    const contextWithGeo = createClientContext({ geo });
    const contextWithoutGeo: ClientContext = {};

    expect(getGeo(contextWithGeo)).toEqual(geo);
    expect(getGeo(contextWithoutGeo)).toBeNull();
  });

  it('getSessionId возвращает sessionId или null', () => {
    const contextWithSession = createClientContext({ sessionId: 'session-123' });
    const contextWithoutSession: ClientContext = {};

    expect(getSessionId(contextWithSession)).toBe('session-123');
    expect(getSessionId(contextWithoutSession)).toBeNull();
  });

  it('getAppVersion возвращает appVersion или null', () => {
    const contextWithVersion = createClientContext({ appVersion: '1.0.0' });
    const contextWithoutVersion: ClientContext = {};

    expect(getAppVersion(contextWithVersion)).toBe('1.0.0');
    expect(getAppVersion(contextWithoutVersion)).toBeNull();
  });

  it('helper функции работают deterministic с неполными данными', () => {
    const partialContext: ClientContext = {
      ip: '192.168.1.1',
      // остальные поля отсутствуют
    };

    expect(getIp(partialContext)).toBe('192.168.1.1');
    expect(getDeviceId(partialContext)).toBeNull();
    expect(getUserAgent(partialContext)).toBeNull();
    expect(getLocale(partialContext)).toBeNull();
    expect(getTimezone(partialContext)).toBeNull();
    expect(getGeo(partialContext)).toBeNull();
    expect(getSessionId(partialContext)).toBeNull();
    expect(getAppVersion(partialContext)).toBeNull();
  });
});

// ============================================================================
// 📋 CLIENT CONTEXT - Security Utilities (Sanitization)
// ============================================================================

describe('ClientContext sanitization', () => {
  it('sanitizeClientContext удаляет PII поля (ip, geo)', () => {
    const context = createFullClientContext();
    const sanitized = sanitizeClientContext(context);

    // PII поля удалены
    expect('ip' in sanitized).toBe(false);
    expect('geo' in sanitized).toBe(false);

    // Безопасные поля сохранены
    expect(sanitized.deviceId).toBe('device-full');
    expect(sanitized.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(sanitized.locale).toBe('en-US');
    expect(sanitized.timezone).toBe('America/New_York');
    expect(sanitized.sessionId).toBe('session-full');
    expect(sanitized.appVersion).toBe('2.0.0');
  });

  it('sanitizeClientContext возвращает ClientContextSafe тип', () => {
    const context = createFullClientContext();
    const sanitized: ClientContextSafe = sanitizeClientContext(context);

    expect(sanitized).toBeDefined();
    // TypeScript гарантирует отсутствие ip и geo
  });

  it('sanitizeClientContext работает с минимальным контекстом', () => {
    const minimalContext: ClientContext = { ip: '192.168.1.1' };
    const sanitized = sanitizeClientContext(minimalContext);

    expect('ip' in sanitized).toBe(false);
    expect(sanitized).toEqual({});
  });

  it('sanitizeClientContext работает с контекстом без PII', () => {
    const safeContext: ClientContext = {
      deviceId: 'device-123',
      locale: 'en-US',
    };
    const sanitized = sanitizeClientContext(safeContext);

    expect(sanitized.deviceId).toBe('device-123');
    expect(sanitized.locale).toBe('en-US');
    expect('ip' in sanitized).toBe(false);
    expect('geo' in sanitized).toBe(false);
  });

  it('sanitizeClientContext безопасен для использования в logs', () => {
    const context = createFullClientContext();
    const sanitized = sanitizeClientContext(context);

    // Можно безопасно логировать без PII
    const logEntry = JSON.stringify(sanitized);
    expect(logEntry).not.toContain('192.168.1.1');
    expect(logEntry).not.toContain('40.7128');
    expect(logEntry).not.toContain('-74.0060');
  });

  it('sanitizeClientContext безопасен для использования в audit trails', () => {
    const context = createFullClientContext();
    const sanitized = sanitizeClientContext(context);

    // Audit trail не содержит PII
    const auditEntry: ClientContextSafe = sanitized;
    expect(auditEntry).toBeDefined();
    expect('ip' in auditEntry).toBe(false);
    expect('geo' in auditEntry).toBe(false);
  });
});
