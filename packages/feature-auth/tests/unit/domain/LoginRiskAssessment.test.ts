/**
 * @file Unit тесты для domain/LoginRiskAssessment.ts
 * Полное покрытие оценки риска аутентификации с учетом security и privacy
 */

import { describe, expect, it } from 'vitest';
import type {
  DeviceRiskInfo,
  GeoInfo,
  LoginRiskAssessment,
} from '../../../src/domain/LoginRiskAssessment.js';
import { loginRiskAssessmentSchema } from '../../../src/schemas.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createGeoInfo(overrides: Partial<GeoInfo> = {}): GeoInfo {
  return {
    country: 'US',
    region: 'CA',
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    ...overrides,
  };
}

function createDeviceRiskInfo(overrides: Partial<DeviceRiskInfo> = {}): DeviceRiskInfo {
  return {
    deviceId: 'device-abc-123',
    fingerprint: 'fp-xyz-789',
    platform: 'web',
    os: 'Windows 11',
    browser: 'Chrome 112',
    appVersion: '1.0.3',
    ...overrides,
  };
}

function createLoginRiskAssessment(
  overrides: Partial<LoginRiskAssessment> = {},
): LoginRiskAssessment {
  return {
    userId: 'user-123',
    ip: '192.168.1.1',
    geo: createGeoInfo(),
    device: createDeviceRiskInfo(),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    previousSessionId: 'session-prev-456',
    timestamp: '2026-01-15T10:30:00.000Z',
    signals: {
      asn: 'AS12345',
      vpn: false,
      riskScore: 25,
    },
    ...overrides,
  };
}

function createMinimalLoginRiskAssessment(
  overrides: Partial<LoginRiskAssessment> = {},
): LoginRiskAssessment {
  return {
    ...overrides,
  };
}

function createFullLoginRiskAssessment(
  overrides: Partial<LoginRiskAssessment> = {},
): LoginRiskAssessment {
  return {
    userId: 'user-full-456',
    ip: '10.0.0.1',
    geo: {
      country: 'DE',
      region: 'BE',
      city: 'Berlin',
      lat: 52.5200,
      lng: 13.4050,
    },
    device: {
      deviceId: 'device-full-789',
      fingerprint: 'fp-full-abc',
      platform: 'ios',
      os: 'iOS 17.0',
      browser: 'Safari 17.0',
      appVersion: '2.1.0',
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    previousSessionId: 'session-full-prev',
    timestamp: '2026-01-15T12:00:00.000Z',
    signals: {
      asn: 'AS67890',
      vpn: true,
      proxy: false,
      tor: false,
      velocityAnomaly: true,
      reputationScore: 75,
      externalRiskVendor: 'maxmind',
    },
    ...overrides,
  };
}

// ============================================================================
// 🌍 GEO INFO - Геолокационная информация
// ============================================================================

describe('GeoInfo геолокационная информация', () => {
  it('создает полную геоинформацию', () => {
    const geo = createGeoInfo();

    expect(geo.country).toBe('US');
    expect(geo.region).toBe('CA');
    expect(geo.city).toBe('San Francisco');
    expect(geo.lat).toBe(37.7749);
    expect(geo.lng).toBe(-122.4194);
  });

  it('поддерживает частичную геоинформацию', () => {
    const geo: GeoInfo = {
      country: 'DE',
      city: 'Berlin',
      // region, lat, lng опциональны
    };

    expect(geo.country).toBe('DE');
    expect(geo.city).toBe('Berlin');
    expect(geo.region).toBeUndefined();
    expect(geo.lat).toBeUndefined();
    expect(geo.lng).toBeUndefined();
  });

  it('работает с координатами без адреса', () => {
    const geo: GeoInfo = {
      lat: 52.5200,
      lng: 13.4050,
    };

    expect(geo.lat).toBe(52.5200);
    expect(geo.lng).toBe(13.4050);
    expect(geo.country).toBeUndefined();
    expect(geo.region).toBeUndefined();
    expect(geo.city).toBeUndefined();
  });

  it('geo координаты readonly - предотвращает мутацию', () => {
    const geo: GeoInfo = {
      country: 'US',
      lat: 37.7749,
      lng: -122.4194,
    };

    // TypeScript предотвращает мутацию
    // geo.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property
    // geo.lng = 0; // TypeScript error: Cannot assign to 'lng' because it is a read-only property

    expect(geo.lat).toBe(37.7749);
    expect(geo.lng).toBe(-122.4194);
  });
});

// ============================================================================
// 📱 DEVICE RISK INFO - Информация об устройстве
// ============================================================================

describe('DeviceRiskInfo информация об устройстве', () => {
  it('создает полную информацию об устройстве', () => {
    const device = createDeviceRiskInfo();

    expect(device.deviceId).toBe('device-abc-123');
    expect(device.fingerprint).toBe('fp-xyz-789');
    expect(device.platform).toBe('web');
    expect(device.os).toBe('Windows 11');
    expect(device.browser).toBe('Chrome 112');
    expect(device.appVersion).toBe('1.0.3');
  });

  it('поддерживает частичную информацию об устройстве', () => {
    const device: DeviceRiskInfo = {
      deviceId: 'device-partial',
      fingerprint: 'fp-partial',
      // platform, os, browser, appVersion опциональны
    };

    expect(device.deviceId).toBe('device-partial');
    expect(device.fingerprint).toBe('fp-partial');
    expect(device.platform).toBeUndefined();
    expect(device.os).toBeUndefined();
  });

  it('поддерживает все платформы', () => {
    const platforms: ('web' | 'ios' | 'android' | 'desktop')[] = [
      'web',
      'ios',
      'android',
      'desktop',
    ];

    platforms.forEach((platform) => {
      const device = createDeviceRiskInfo({ platform });
      expect(device.platform).toBe(platform);
    });
  });

  it('device поля readonly - предотвращает мутацию', () => {
    const device: DeviceRiskInfo = {
      deviceId: 'device-immutable',
      fingerprint: 'fp-immutable',
      platform: 'web',
    };

    // TypeScript предотвращает мутацию
    // device.deviceId = 'new-id'; // TypeScript error: Cannot assign to 'deviceId' because it is a read-only property
    // device.platform = 'ios'; // TypeScript error: Cannot assign to 'platform' because it is a read-only property

    expect(device.deviceId).toBe('device-immutable');
    expect(device.platform).toBe('web');
  });
});

// ============================================================================
// 📋 LOGIN RISK ASSESSMENT DTO - Полный DTO
// ============================================================================

describe('LoginRiskAssessment полный DTO', () => {
  it('создает минимальную оценку риска (все поля опциональны)', () => {
    const assessment = createMinimalLoginRiskAssessment();

    expect(assessment.userId).toBeUndefined();
    expect(assessment.ip).toBeUndefined();
    expect(assessment.geo).toBeUndefined();
    expect(assessment.device).toBeUndefined();
    expect(assessment.userAgent).toBeUndefined();
    expect(assessment.previousSessionId).toBeUndefined();
    expect(assessment.timestamp).toBeUndefined();
    expect(assessment.signals).toBeUndefined();
  });

  it('создает полную оценку риска со всеми полями', () => {
    const assessment = createFullLoginRiskAssessment();

    expect(assessment.userId).toBe('user-full-456');
    expect(assessment.ip).toBe('10.0.0.1');
    expect(assessment.geo?.country).toBe('DE');
    expect(assessment.geo?.city).toBe('Berlin');
    expect(assessment.device?.deviceId).toBe('device-full-789');
    expect(assessment.device?.fingerprint).toBe('fp-full-abc');
    expect(assessment.device?.platform).toBe('ios');
    expect(assessment.userAgent).toBe('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(assessment.previousSessionId).toBe('session-full-prev');
    expect(assessment.timestamp).toBe('2026-01-15T12:00:00.000Z');
    expect(assessment.signals?.['asn']).toBe('AS67890');
    expect(assessment.signals?.['vpn']).toBe(true);
  });

  it('работает с различными IP адресами', () => {
    const ipAddresses = [
      '192.168.1.1',
      '10.0.0.1',
      '172.16.0.1',
      '127.0.0.1',
      '::1', // IPv6 localhost
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6 example
    ];

    ipAddresses.forEach((ip) => {
      const assessment = createLoginRiskAssessment({ ip });
      expect(assessment.ip).toBe(ip);
    });
  });

  it('работает с различными userAgent строками', () => {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'Mozilla/5.0 (Android 13; Mobile)',
      'Custom-Client/1.0',
    ];

    userAgents.forEach((userAgent) => {
      const assessment = createLoginRiskAssessment({ userAgent });
      expect(assessment.userAgent).toBe(userAgent);
    });
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('LoginRiskAssessment optional fields', () => {
  it('userId опционально (может отсутствовать до идентификации)', () => {
    const assessmentWithUserId = createLoginRiskAssessment({ userId: 'user-123' });
    const assessmentWithoutUserId = createMinimalLoginRiskAssessment();

    expect(assessmentWithUserId.userId).toBe('user-123');
    expect(assessmentWithoutUserId.userId).toBeUndefined();
  });

  it('ip опционально для IP адреса клиента', () => {
    const assessmentWithIp = createLoginRiskAssessment({ ip: '192.168.1.1' });
    const assessmentWithoutIp = createMinimalLoginRiskAssessment();

    expect(assessmentWithIp.ip).toBe('192.168.1.1');
    expect(assessmentWithoutIp.ip).toBeUndefined();
  });

  it('geo опционально для геолокации', () => {
    const assessmentWithGeo = createLoginRiskAssessment({
      geo: createGeoInfo(),
    });
    const assessmentWithoutGeo = createMinimalLoginRiskAssessment();

    expect(assessmentWithGeo.geo?.country).toBe('US');
    expect(assessmentWithGeo.geo?.lat).toBe(37.7749);
    expect(assessmentWithoutGeo.geo).toBeUndefined();
  });

  it('device опционально для информации об устройстве', () => {
    const assessmentWithDevice = createLoginRiskAssessment({
      device: createDeviceRiskInfo(),
    });
    const assessmentWithoutDevice = createMinimalLoginRiskAssessment();

    expect(assessmentWithDevice.device?.deviceId).toBe('device-abc-123');
    expect(assessmentWithDevice.device?.fingerprint).toBe('fp-xyz-789');
    expect(assessmentWithoutDevice.device).toBeUndefined();
  });

  it('userAgent опционально для User-Agent строки', () => {
    const assessmentWithUserAgent = createLoginRiskAssessment({
      userAgent: 'Mozilla/5.0',
    });
    const assessmentWithoutUserAgent = createMinimalLoginRiskAssessment();

    expect(assessmentWithUserAgent.userAgent).toBe('Mozilla/5.0');
    expect(assessmentWithoutUserAgent.userAgent).toBeUndefined();
  });

  it('previousSessionId опционально для предыдущей сессии', () => {
    const assessmentWithPrevious = createLoginRiskAssessment({
      previousSessionId: 'session-prev',
    });
    const assessmentWithoutPrevious = createMinimalLoginRiskAssessment();

    expect(assessmentWithPrevious.previousSessionId).toBe('session-prev');
    expect(assessmentWithoutPrevious.previousSessionId).toBeUndefined();
  });

  it('timestamp опционально для временной метки', () => {
    const assessmentWithTimestamp = createLoginRiskAssessment({
      timestamp: '2026-01-15T10:30:00.000Z',
    });
    const assessmentWithoutTimestamp = createMinimalLoginRiskAssessment();

    expect(assessmentWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(assessmentWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('signals опционально для дополнительных сигналов риска', () => {
    const assessmentWithSignals = createLoginRiskAssessment({
      signals: {
        vpn: true,
        riskScore: 85,
      },
    });
    const assessmentWithoutSignals = createMinimalLoginRiskAssessment();

    expect(assessmentWithSignals.signals?.['vpn']).toBe(true);
    expect(assessmentWithSignals.signals?.['riskScore']).toBe(85);
    expect(assessmentWithoutSignals.signals).toBeUndefined();
  });
});

// ============================================================================
// 🔒 SECURITY & PRIVACY - Безопасность и конфиденциальность
// ============================================================================

describe('LoginRiskAssessment security & privacy', () => {
  it('IP адрес - PII данные, должны обрабатываться согласно GDPR', () => {
    // IP адрес является Personal Identifiable Information (PII)
    const assessment = createLoginRiskAssessment({
      ip: '192.168.1.1',
    });

    expect(assessment.ip).toBe('192.168.1.1');

    // В продакшене эти данные должны:
    // - Храниться с шифрованием
    // - Иметь ограниченный TTL
    // - Соответствовать GDPR/privacy policy
    // - Использоваться только для security/fraud prevention
  });

  it('геолокация - PII данные, требуют особой обработки', () => {
    // Геолокация является PII и требует особой обработки
    const assessment = createLoginRiskAssessment({
      geo: {
        country: 'US',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
    });

    expect(assessment.geo?.country).toBe('US');
    expect(assessment.geo?.lat).toBe(37.7749);

    // В продакшене эти данные должны:
    // - Анонимизироваться при хранении (если возможно)
    // - Иметь ограниченный доступ
    // - Соответствовать GDPR/privacy regulations
    // - Использоваться только для risk assessment
  });

  it('device fingerprint - tracking данные, требуют конфиденциальности', () => {
    // Device fingerprint используется для tracking и fraud prevention
    const assessment = createLoginRiskAssessment({
      device: {
        deviceId: 'device-fingerprint-123',
        fingerprint: 'fp-hash-abc-xyz',
        platform: 'web',
      },
    });

    expect(assessment.device?.deviceId).toBe('device-fingerprint-123');
    expect(assessment.device?.fingerprint).toBe('fp-hash-abc-xyz');

    // В продакшене эти данные должны:
    // - Храниться в зашифрованном виде
    // - Иметь ограниченный доступ
    // - Использоваться только для security purposes
    // - Соответствовать privacy policy
  });

  it('userAgent - browser fingerprinting данные', () => {
    // User-Agent используется для browser fingerprinting
    const assessment = createLoginRiskAssessment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    expect(assessment.userAgent).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    // В продакшене эти данные должны:
    // - Использоваться для security monitoring
    // - Не передаваться третьим лицам без согласия
    // - Соответствовать privacy regulations
  });

  it('signals могут содержать sensitive security данные', () => {
    // Signals могут содержать sensitive данные о рисках
    const assessment = createLoginRiskAssessment({
      signals: {
        vpn: true,
        proxy: false,
        tor: true,
        reputationScore: 15, // Низкий reputation score
        externalRiskVendor: 'maxmind',
      },
    });

    expect(assessment.signals?.['vpn']).toBe(true);
    expect(assessment.signals?.['tor']).toBe(true);
    expect(assessment.signals?.['reputationScore']).toBe(15);

    // В продакшене эти данные должны:
    // - Храниться с шифрованием
    // - Иметь ограниченный доступ
    // - Не логироваться в plain text
    // - Использоваться только для risk assessment
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('LoginRiskAssessment edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const assessment = createLoginRiskAssessment({
      userId: '',
      ip: '',
      userAgent: '',
      previousSessionId: '',
      timestamp: '',
    });

    expect(assessment.userId).toBe('');
    expect(assessment.ip).toBe('');
    expect(assessment.userAgent).toBe('');
    expect(assessment.previousSessionId).toBe('');
    expect(assessment.timestamp).toBe('');
  });

  it('поддерживает пустой geo объект', () => {
    const assessment = createLoginRiskAssessment({
      geo: {},
    });

    expect(assessment.geo).toEqual({});
  });

  it('поддерживает пустой device объект', () => {
    const assessment = createLoginRiskAssessment({
      device: {},
    });

    expect(assessment.device).toEqual({});
  });

  it('timestamp может быть в ISO 8601 формате', () => {
    const assessmentWithTimestamp = createLoginRiskAssessment({
      timestamp: '2026-01-15T10:30:00.000Z',
    });

    const assessmentWithoutTimestamp = createMinimalLoginRiskAssessment();

    expect(assessmentWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(assessmentWithTimestamp.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(assessmentWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('signals может содержать любые данные', () => {
    const assessment = createLoginRiskAssessment({
      signals: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        arrayValue: [1, 2, 3],
        nestedObject: {
          key: 'value',
        },
        nullValue: null,
      },
    });

    expect(assessment.signals?.['stringValue']).toBe('test');
    expect(assessment.signals?.['numberValue']).toBe(42);
    expect(assessment.signals?.['booleanValue']).toBe(true);
    expect(Array.isArray(assessment.signals?.['arrayValue'])).toBe(true);
    expect(assessment.signals?.['nestedObject']).toEqual({ key: 'value' });
  });

  it('поддерживает различные форматы IP адресов (IPv4 и IPv6)', () => {
    const ipv4Addresses = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1'];
    const ipv6Addresses = ['::1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'fe80::1'];

    [...ipv4Addresses, ...ipv6Addresses].forEach((ip) => {
      const assessment = createLoginRiskAssessment({ ip });
      expect(assessment.ip).toBe(ip);
    });
  });

  it('поддерживает различные координаты (положительные и отрицательные)', () => {
    const coordinates = [
      { lat: 37.7749, lng: -122.4194 }, // San Francisco (западное полушарие)
      { lat: 52.5200, lng: 13.4050 }, // Berlin (восточное полушарие)
      { lat: -33.8688, lng: 151.2093 }, // Sydney (южное полушарие)
      { lat: 0, lng: 0 }, // Экватор и нулевой меридиан
    ];

    coordinates.forEach((coord) => {
      const assessment = createLoginRiskAssessment({
        geo: {
          lat: coord.lat,
          lng: coord.lng,
        },
      });
      expect(assessment.geo?.lat).toBe(coord.lat);
      expect(assessment.geo?.lng).toBe(coord.lng);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('LoginRiskAssessment immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const assessment: LoginRiskAssessment = {
      userId: 'user-immutable',
      ip: '192.168.1.1',
      geo: createGeoInfo(),
      device: createDeviceRiskInfo(),
      userAgent: 'Mozilla/5.0',
      previousSessionId: 'session-immutable',
      timestamp: '2026-01-15T10:30:00.000Z',
      signals: {
        key: 'value',
      },
    };

    // TypeScript предотвращает мутацию
    // assessment.userId = 'new-user'; // TypeScript error: Cannot assign to 'userId' because it is a read-only property
    // assessment.ip = 'new-ip'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(assessment.userId).toBe('user-immutable');
    expect(assessment.ip).toBe('192.168.1.1');
  });

  it('geo readonly - предотвращает мутацию вложенных объектов', () => {
    const assessment: LoginRiskAssessment = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    // TypeScript предотвращает мутацию geo
    // assessment.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property
    // assessment.geo!.lng = 0; // TypeScript error: Cannot assign to 'lng' because it is a read-only property

    expect(assessment.geo?.lat).toBe(37.7749);
    expect(assessment.geo?.lng).toBe(-122.4194);
  });

  it('device readonly - предотвращает мутацию вложенных объектов', () => {
    const assessment: LoginRiskAssessment = {
      device: {
        deviceId: 'device-immutable',
        fingerprint: 'fp-immutable',
        platform: 'web',
      },
    };

    // TypeScript предотвращает мутацию device
    // assessment.device!.deviceId = 'new-id'; // TypeScript error: Cannot assign to 'deviceId' because it is a read-only property
    // assessment.device!.platform = 'ios'; // TypeScript error: Cannot assign to 'platform' because it is a read-only property

    expect(assessment.device?.deviceId).toBe('device-immutable');
    expect(assessment.device?.platform).toBe('web');
  });

  it('signals readonly - предотвращает мутацию вложенных объектов', () => {
    const assessment: LoginRiskAssessment = {
      signals: {
        vpn: true,
        riskScore: 75,
      },
    };

    // TypeScript предотвращает мутацию signals
    // assessment.signals!['vpn'] = false; // TypeScript error: Index signature in type 'readonly Record<string, unknown>' only permits reading

    expect(assessment.signals?.['vpn']).toBe(true);
    expect(assessment.signals?.['riskScore']).toBe(75);
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('LoginRiskAssessment comprehensive snapshots', () => {
  it('full risk assessment - полный snapshot', () => {
    const assessment = createFullLoginRiskAssessment();

    expect(assessment).toMatchSnapshot();
  });

  it('minimal risk assessment - полный snapshot', () => {
    const assessment = createMinimalLoginRiskAssessment();

    expect(assessment).toMatchSnapshot();
  });

  it('risk assessment with geo only - полный snapshot', () => {
    const assessment = createLoginRiskAssessment({
      geo: createGeoInfo({
        country: 'DE',
        city: 'Berlin',
        lat: 52.5200,
        lng: 13.4050,
      }),
    });

    expect(assessment).toMatchSnapshot();
  });

  it('risk assessment with device only - полный snapshot', () => {
    const assessment = createLoginRiskAssessment({
      device: createDeviceRiskInfo({
        platform: 'ios',
        os: 'iOS 17.0',
        browser: 'Safari 17.0',
      }),
    });

    expect(assessment).toMatchSnapshot();
  });

  it('risk assessment with signals only - полный snapshot', () => {
    const assessment = createLoginRiskAssessment({
      signals: {
        vpn: true,
        proxy: false,
        tor: true,
        velocityAnomaly: true,
        reputationScore: 15,
      },
    });

    expect(assessment).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные risk assessments проходят Zod схему', () => {
    const validAssessment = {
      userId: 'user-123',
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
      device: {
        deviceId: 'device-123',
        fingerprint: 'fp-abc',
        platform: 'web',
        os: 'Windows 11',
        browser: 'Chrome 112',
      },
      userAgent: 'Mozilla/5.0',
      previousSessionId: 'session-prev',
      timestamp: '2026-01-15T10:30:00.000Z',
      signals: {
        vpn: false,
        riskScore: 25,
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(validAssessment);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.userId).toBe('user-123');
      expect(result.data.ip).toBe('192.168.1.1');
      expect(result.data.geo?.country).toBe('US');
      expect(result.data.device?.platform).toBe('web');
    }
  });

  it('невалидный timestamp отклоняется', () => {
    const invalidAssessment = {
      timestamp: 'invalid-date', // невалидный ISO timestamp
    };

    const result = loginRiskAssessmentSchema.safeParse(invalidAssessment);
    expect(result.success).toBe(false);
  });

  it('невалидный platform в device отклоняется', () => {
    const invalidAssessment = {
      device: {
        platform: 'invalid-platform', // невалидный platform
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(invalidAssessment);
    expect(result.success).toBe(false);
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const assessmentWithExtra = {
      userId: 'user-123',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = loginRiskAssessmentSchema.safeParse(assessmentWithExtra);
    expect(result.success).toBe(false);
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум полей (все опциональны)
    const minimalAssessment = {};

    const result = loginRiskAssessmentSchema.safeParse(minimalAssessment);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.userId).toBeUndefined();
      expect(result.data.ip).toBeUndefined();
      expect(result.data.geo).toBeUndefined();
      expect(result.data.device).toBeUndefined();
      expect(result.data.userAgent).toBeUndefined();
      expect(result.data.previousSessionId).toBeUndefined();
      expect(result.data.timestamp).toBeUndefined();
      expect(result.data.signals).toBeUndefined();
    }
  });

  it('geo может содержать координаты', () => {
    const assessmentWithGeo = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(assessmentWithGeo);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.geo?.country).toBe('US');
      expect(result.data.geo?.lat).toBe(37.7749);
      expect(result.data.geo?.lng).toBe(-122.4194);
    }
  });

  it('device может содержать fingerprint и platform', () => {
    const assessmentWithDevice = {
      device: {
        deviceId: 'device-123',
        fingerprint: 'fp-abc-xyz',
        platform: 'ios',
        os: 'iOS 17.0',
        browser: 'Safari',
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(assessmentWithDevice);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.device?.deviceId).toBe('device-123');
      expect(result.data.device?.fingerprint).toBe('fp-abc-xyz');
      expect(result.data.device?.platform).toBe('ios');
    }
  });

  it('timestamp должен быть в ISO 8601 формате', () => {
    const assessmentWithValidTimestamp = {
      timestamp: '2026-01-15T10:30:00.000Z',
    };

    const assessmentWithInvalidTimestamp = {
      timestamp: 'invalid-date', // невалидный ISO timestamp
    };

    const result1 = loginRiskAssessmentSchema.safeParse(assessmentWithValidTimestamp);
    const result2 = loginRiskAssessmentSchema.safeParse(assessmentWithInvalidTimestamp);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
  });

  it('platform должен быть одним из допустимых значений', () => {
    const validPlatforms = ['web', 'ios', 'android', 'desktop'];

    validPlatforms.forEach((platform) => {
      const assessment = {
        device: {
          platform,
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(assessment);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.device?.platform).toBe(platform);
      }
    });
  });

  it('signals может содержать любые данные', () => {
    const assessmentWithSignals = {
      signals: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        arrayValue: [1, 2, 3],
        nestedObject: {
          key: 'value',
        },
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(assessmentWithSignals);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.signals?.['stringValue']).toBe('test');
      expect(result.data.signals?.['numberValue']).toBe(42);
      expect(result.data.signals?.['booleanValue']).toBe(true);
    }
  });

  it('IP адрес валидируется как строка (различные форматы)', () => {
    const ipAddresses = [
      '192.168.1.1', // IPv4
      '10.0.0.1', // IPv4 private
      '::1', // IPv6 localhost
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6 full
    ];

    ipAddresses.forEach((ip) => {
      const assessment = {
        ip,
      };

      const result = loginRiskAssessmentSchema.safeParse(assessment);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.ip).toBe(ip);
      }
    });
  });

  it('fingerprint валидируется как строка', () => {
    const fingerprints = [
      'fp-simple',
      'fp-hash-abc-xyz-123',
      'fp-with-special-chars-!@#$%',
      'fp-very-long-fingerprint-string-with-many-characters',
    ];

    fingerprints.forEach((fingerprint) => {
      const assessment = {
        device: {
          fingerprint,
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(assessment);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.device?.fingerprint).toBe(fingerprint);
      }
    });
  });

  it('координаты валидируются как числа', () => {
    const coordinates = [
      { lat: 37.7749, lng: -122.4194 }, // San Francisco
      { lat: 52.5200, lng: 13.4050 }, // Berlin
      { lat: -33.8688, lng: 151.2093 }, // Sydney
      { lat: 0, lng: 0 }, // Equator/Prime meridian
    ];

    coordinates.forEach((coord) => {
      const assessment = {
        geo: {
          lat: coord.lat,
          lng: coord.lng,
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(assessment);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.geo?.lat).toBe(coord.lat);
        expect(result.data.geo?.lng).toBe(coord.lng);
      }
    });
  });
});
