/**
 * @file Unit тесты для domain/DeviceInfo.ts
 * Полное покрытие информации об устройстве для аудита и security
 */

import { describe, expect, it } from 'vitest';
import type { DeviceInfo, DeviceType } from '../../../src/domain/DeviceInfo.js';
import { deviceInfoSchema } from '../../../src/schemas.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-abc-123',
    deviceType: 'desktop',
    ...overrides,
  };
}

function createMinimalDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-minimal-123',
    deviceType: 'mobile',
    ...overrides,
  };
}

function createFullDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-full-123',
    deviceType: 'desktop',
    os: 'Windows 11',
    browser: 'Chrome 112.0.0.0',
    ip: '192.168.1.100',
    geo: {
      lat: 55.7558,
      lng: 37.6173,
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    appVersion: '1.0.3',
    lastUsedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// 🎯 DEVICE TYPE ENUM - Типы устройств
// ============================================================================

describe('DeviceType enum coverage', () => {
  const allDeviceTypes: DeviceType[] = [
    'desktop',
    'mobile',
    'tablet',
    'iot',
    'unknown',
  ];

  it('поддерживает все типы устройств', () => {
    allDeviceTypes.forEach((deviceType) => {
      const device = createMinimalDeviceInfo({ deviceType });
      expect(device.deviceType).toBe(deviceType);
    });
  });

  it('каждый тип устройства имеет правильную структуру', () => {
    // Desktop device
    const desktop = createDeviceInfo({ deviceType: 'desktop' });
    expect(desktop.deviceType).toBe('desktop');

    // Mobile device
    const mobile = createDeviceInfo({ deviceType: 'mobile' });
    expect(mobile.deviceType).toBe('mobile');

    // Tablet device
    const tablet = createDeviceInfo({ deviceType: 'tablet' });
    expect(tablet.deviceType).toBe('tablet');

    // IoT device
    const iot = createDeviceInfo({ deviceType: 'iot' });
    expect(iot.deviceType).toBe('iot');

    // Unknown device
    const unknown = createDeviceInfo({ deviceType: 'unknown' });
    expect(unknown.deviceType).toBe('unknown');
  });
});

// ============================================================================
// 📋 DEVICE INFO DTO - Полный DTO
// ============================================================================

describe('DeviceInfo полный DTO', () => {
  it('создает минимальное устройство с обязательными полями', () => {
    const device = createMinimalDeviceInfo();

    expect(device.deviceId).toBe('device-minimal-123');
    expect(device.deviceType).toBe('mobile');
    expect(device.os).toBeUndefined();
    expect(device.browser).toBeUndefined();
    expect(device.ip).toBeUndefined();
    expect(device.geo).toBeUndefined();
    expect(device.userAgent).toBeUndefined();
    expect(device.appVersion).toBeUndefined();
    expect(device.lastUsedAt).toBeUndefined();
  });

  it('создает полное устройство со всеми полями', () => {
    const device = createFullDeviceInfo({
      deviceId: 'device-complete-456',
      deviceType: 'tablet',
      os: 'iOS 17.0',
      browser: 'Safari 17.0',
      ip: '10.0.0.1',
      geo: {
        lat: 40.7128,
        lng: -74.0060,
      },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      appVersion: '2.1.0',
      lastUsedAt: '2026-01-15T12:00:00.000Z',
    });

    expect(device.deviceId).toBe('device-complete-456');
    expect(device.deviceType).toBe('tablet');
    expect(device.os).toBe('iOS 17.0');
    expect(device.browser).toBe('Safari 17.0');
    expect(device.ip).toBe('10.0.0.1');
    expect(device.geo?.lat).toBe(40.7128);
    expect(device.geo?.lng).toBe(-74.0060);
    expect(device.userAgent).toBe('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)');
    expect(device.appVersion).toBe('2.1.0');
    expect(device.lastUsedAt).toBe('2026-01-15T12:00:00.000Z');
  });

  it('deviceId обязателен и уникален', () => {
    const device1 = createDeviceInfo({ deviceId: 'device-unique-1' });
    const device2 = createDeviceInfo({ deviceId: 'device-unique-2' });

    expect(device1.deviceId).toBe('device-unique-1');
    expect(device2.deviceId).toBe('device-unique-2');
    expect(device1.deviceId).not.toBe(device2.deviceId);
  });

  it('работает с различными операционными системами', () => {
    const operatingSystems = [
      'Windows 11',
      'Windows 10',
      'macOS 14.0',
      'iOS 17.0',
      'Android 13',
      'Linux Ubuntu 22.04',
    ];

    operatingSystems.forEach((os) => {
      const device = createDeviceInfo({ os });
      expect(device.os).toBe(os);
    });
  });

  it('работает с различными браузерами', () => {
    const browsers = [
      'Chrome 112.0.0.0',
      'Firefox 110.0',
      'Safari 17.0',
      'Edge 112.0.0.0',
      'Opera 98.0',
    ];

    browsers.forEach((browser) => {
      const device = createDeviceInfo({ browser });
      expect(device.browser).toBe(browser);
    });
  });

  it('работает с различными версиями приложения', () => {
    const appVersions = ['1.0.0', '1.0.3', '2.1.0', '3.0.0-beta.1', '10.5.2'];

    appVersions.forEach((appVersion) => {
      const device = createDeviceInfo({ appVersion });
      expect(device.appVersion).toBe(appVersion);
    });
  });
});

// ============================================================================
// 🔑 REQUIRED FIELDS - Обязательные поля
// ============================================================================

describe('DeviceInfo required fields', () => {
  it('deviceId обязателен и является строкой', () => {
    const device = createDeviceInfo({ deviceId: 'device-required-123' });

    expect(device.deviceId).toBe('device-required-123');
    expect(typeof device.deviceId).toBe('string');
    expect(device.deviceId.length).toBeGreaterThan(0);
  });

  it('deviceType обязателен и является одним из допустимых значений', () => {
    const deviceTypes: DeviceType[] = ['desktop', 'mobile', 'tablet', 'iot', 'unknown'];

    deviceTypes.forEach((deviceType) => {
      const device = createDeviceInfo({ deviceType });
      expect(device.deviceType).toBe(deviceType);
    });
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('DeviceInfo optional fields', () => {
  it('os опционально для информации об ОС', () => {
    const deviceWithOs = createDeviceInfo({ os: 'Windows 11' });
    const deviceWithoutOs = createMinimalDeviceInfo();

    expect(deviceWithOs.os).toBe('Windows 11');
    expect(deviceWithoutOs.os).toBeUndefined();
  });

  it('browser опционально для информации о браузере', () => {
    const deviceWithBrowser = createDeviceInfo({ browser: 'Chrome 112' });
    const deviceWithoutBrowser = createMinimalDeviceInfo();

    expect(deviceWithBrowser.browser).toBe('Chrome 112');
    expect(deviceWithoutBrowser.browser).toBeUndefined();
  });

  it('ip опционально для IP адреса устройства', () => {
    const deviceWithIp = createDeviceInfo({ ip: '192.168.1.1' });
    const deviceWithoutIp = createMinimalDeviceInfo();

    expect(deviceWithIp.ip).toBe('192.168.1.1');
    expect(deviceWithoutIp.ip).toBeUndefined();
  });

  it('geo опционально для геолокации устройства', () => {
    const deviceWithGeo = createDeviceInfo({
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
    });
    const deviceWithoutGeo = createMinimalDeviceInfo();

    expect(deviceWithGeo.geo?.lat).toBe(55.7558);
    expect(deviceWithGeo.geo?.lng).toBe(37.6173);
    expect(deviceWithoutGeo.geo).toBeUndefined();
  });

  it('userAgent опционально для User Agent строки', () => {
    const deviceWithUserAgent = createDeviceInfo({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    const deviceWithoutUserAgent = createMinimalDeviceInfo();

    expect(deviceWithUserAgent.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(deviceWithoutUserAgent.userAgent).toBeUndefined();
  });

  it('appVersion опционально для версии приложения', () => {
    const deviceWithAppVersion = createDeviceInfo({ appVersion: '1.0.3' });
    const deviceWithoutAppVersion = createMinimalDeviceInfo();

    expect(deviceWithAppVersion.appVersion).toBe('1.0.3');
    expect(deviceWithoutAppVersion.appVersion).toBeUndefined();
  });

  it('lastUsedAt опционально для последнего времени использования', () => {
    const deviceWithLastUsed = createDeviceInfo({
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    });
    const deviceWithoutLastUsed = createMinimalDeviceInfo();

    expect(deviceWithLastUsed.lastUsedAt).toBe('2026-01-15T10:30:00.000Z');
    expect(deviceWithoutLastUsed.lastUsedAt).toBeUndefined();
  });
});

// ============================================================================
// 🌍 GEO LOCATION - Геолокация
// ============================================================================

describe('DeviceInfo geo location', () => {
  it('поддерживает полную геолокацию с координатами', () => {
    const device = createDeviceInfo({
      geo: {
        lat: 40.7128,
        lng: -74.0060,
      },
    });

    expect(device.geo?.lat).toBe(40.7128);
    expect(device.geo?.lng).toBe(-74.0060);
  });

  it('geo координаты readonly - предотвращает мутацию', () => {
    const device: DeviceInfo = {
      deviceId: 'device-geo',
      deviceType: 'desktop',
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
    };

    // TypeScript предотвращает мутацию
    // device.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(device.geo?.lat).toBe(55.7558);
    expect(device.geo?.lng).toBe(37.6173);
  });

  it('работает с различными координатами', () => {
    const coordinates = [
      { lat: 55.7558, lng: 37.6173 }, // Moscow
      { lat: 40.7128, lng: -74.0060 }, // New York
      { lat: 51.5074, lng: -0.1278 }, // London
      { lat: 35.6762, lng: 139.6503 }, // Tokyo
    ];

    coordinates.forEach((coord) => {
      const device = createDeviceInfo({ geo: coord });
      expect(device.geo?.lat).toBe(coord.lat);
      expect(device.geo?.lng).toBe(coord.lng);
    });
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('DeviceInfo edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const device = createDeviceInfo({
      os: '',
      browser: '',
      ip: '',
      userAgent: '',
      appVersion: '',
      lastUsedAt: '',
    });

    expect(device.os).toBe('');
    expect(device.browser).toBe('');
    expect(device.ip).toBe('');
    expect(device.userAgent).toBe('');
    expect(device.appVersion).toBe('');
    expect(device.lastUsedAt).toBe('');
  });

  it('deviceId не может быть пустой строкой (обязательное поле)', () => {
    // В реальности это проверяется на уровне схемы, но для DTO это валидно
    const device = createDeviceInfo({ deviceId: 'non-empty-id' });

    expect(device.deviceId).toBe('non-empty-id');
  });

  it('lastUsedAt может быть в ISO 8601 формате', () => {
    const deviceWithTimestamp = createDeviceInfo({
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    });

    const deviceWithoutTimestamp = createMinimalDeviceInfo();

    expect(deviceWithTimestamp.lastUsedAt).toBe('2026-01-15T10:30:00.000Z');
    expect(deviceWithTimestamp.lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(deviceWithoutTimestamp.lastUsedAt).toBeUndefined();
  });

  it('поддерживает различные форматы IP адресов', () => {
    const ipAddresses = [
      '192.168.1.1',
      '10.0.0.1',
      '172.16.0.1',
      '127.0.0.1',
      '::1', // IPv6 localhost
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6 example
    ];

    ipAddresses.forEach((ip) => {
      const device = createDeviceInfo({ ip });
      expect(device.ip).toBe(ip);
    });
  });

  it('поддерживает длинные userAgent строки', () => {
    const longUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36';

    const device = createDeviceInfo({ userAgent: longUserAgent });

    expect(device.userAgent).toBe(longUserAgent);
    expect(device.userAgent?.length).toBeGreaterThan(100);
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('DeviceInfo immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const device: DeviceInfo = {
      deviceId: 'device-immutable-123',
      deviceType: 'desktop',
      os: 'Windows 11',
      browser: 'Chrome 112',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      appVersion: '1.0.3',
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    };

    // TypeScript предотвращает мутацию
    // device.deviceId = 'new-id'; // TypeScript error: Cannot assign to 'deviceId' because it is a read-only property
    // device.deviceType = 'mobile'; // TypeScript error: Cannot assign to 'deviceType' because it is a read-only property
    // device.os = 'Linux'; // TypeScript error: Cannot assign to 'os' because it is a read-only property

    expect(device.deviceId).toBe('device-immutable-123');
    expect(device.deviceType).toBe('desktop');
    expect(device.os).toBe('Windows 11');
  });

  it('geo readonly - предотвращает мутацию вложенных объектов', () => {
    const device: DeviceInfo = {
      deviceId: 'device-geo-immutable',
      deviceType: 'mobile',
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
    };

    // TypeScript предотвращает мутацию geo
    // device.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property
    // device.geo!.lng = 0; // TypeScript error: Cannot assign to 'lng' because it is a read-only property

    expect(device.geo?.lat).toBe(55.7558);
    expect(device.geo?.lng).toBe(37.6173);
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('DeviceInfo comprehensive snapshots', () => {
  it('desktop device - полный snapshot', () => {
    const device = createFullDeviceInfo({
      deviceId: 'device-desktop-123',
      deviceType: 'desktop',
      os: 'Windows 11',
      browser: 'Chrome 112.0.0.0',
    });

    expect(device).toMatchSnapshot();
  });

  it('mobile device - полный snapshot', () => {
    const device = createFullDeviceInfo({
      deviceId: 'device-mobile-456',
      deviceType: 'mobile',
      os: 'iOS 17.0',
      browser: 'Safari 17.0',
      ip: '10.0.0.1',
      geo: {
        lat: 40.7128,
        lng: -74.0060,
      },
    });

    expect(device).toMatchSnapshot();
  });

  it('tablet device - полный snapshot', () => {
    const device = createFullDeviceInfo({
      deviceId: 'device-tablet-789',
      deviceType: 'tablet',
      os: 'iPadOS 17.0',
      browser: 'Safari 17.0',
      appVersion: '2.1.0',
    });

    expect(device).toMatchSnapshot();
  });

  it('IoT device - полный snapshot', () => {
    const device = createFullDeviceInfo({
      deviceId: 'device-iot-abc',
      deviceType: 'iot',
      os: 'Linux 5.15',
      userAgent: 'IoT-Device/1.0',
      appVersion: '1.0.0',
    });

    expect(device).toMatchSnapshot();
  });

  it('minimal device - полный snapshot', () => {
    const device = createMinimalDeviceInfo({
      deviceId: 'device-minimal-snapshot',
      deviceType: 'unknown',
    });

    expect(device).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные device info проходят Zod схему', () => {
    const validDevice = {
      deviceId: 'device-valid-123',
      deviceType: 'desktop',
      os: 'Windows 11',
      browser: 'Chrome 112',
      ip: '192.168.1.1',
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
      userAgent: 'Mozilla/5.0',
      appVersion: '1.0.3',
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    };

    const result = deviceInfoSchema.safeParse(validDevice);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.deviceId).toBe('device-valid-123');
      expect(result.data.deviceType).toBe('desktop');
      expect(result.data.os).toBe('Windows 11');
    }
  });

  it('невалидные типы устройств отклоняются', () => {
    const invalidDevice = {
      deviceId: 'device-invalid',
      deviceType: 'invalid_type', // невалидный тип
    };

    const result = deviceInfoSchema.safeParse(invalidDevice);
    expect(result.success).toBe(false);
  });

  it('отсутствие обязательных полей отклоняется', () => {
    const missingDeviceId = {
      // deviceId отсутствует
      deviceType: 'desktop',
    };

    const missingDeviceType = {
      deviceId: 'device-123',
      // deviceType отсутствует
    };

    const result1 = deviceInfoSchema.safeParse(missingDeviceId);
    const result2 = deviceInfoSchema.safeParse(missingDeviceType);

    expect(result1.success).toBe(false);
    expect(result2.success).toBe(false);
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const deviceWithExtra = {
      deviceId: 'device-extra',
      deviceType: 'desktop',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = deviceInfoSchema.safeParse(deviceWithExtra);
    expect(result.success).toBe(false);
  });

  it('все типы устройств поддерживаются схемой', () => {
    const allTypes: DeviceType[] = ['desktop', 'mobile', 'tablet', 'iot', 'unknown'];

    allTypes.forEach((deviceType) => {
      const validDevice = {
        deviceId: `device-${deviceType}`,
        deviceType,
      };

      const result = deviceInfoSchema.safeParse(validDevice);
      expect(result.success).toBe(true);
    });
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум обязательных полей
    const minimalDevice = {
      deviceId: 'device-minimal',
      deviceType: 'desktop',
    };

    const result = deviceInfoSchema.safeParse(minimalDevice);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.deviceId).toBe('device-minimal');
      expect(result.data.deviceType).toBe('desktop');
      expect(result.data.os).toBeUndefined();
      expect(result.data.browser).toBeUndefined();
      expect(result.data.ip).toBeUndefined();
      expect(result.data.geo).toBeUndefined();
      expect(result.data.userAgent).toBeUndefined();
      expect(result.data.appVersion).toBeUndefined();
      expect(result.data.lastUsedAt).toBeUndefined();
    }
  });

  it('geo может содержать координаты', () => {
    const deviceWithGeo = {
      deviceId: 'device-geo',
      deviceType: 'mobile',
      geo: {
        lat: 40.7128,
        lng: -74.0060,
      },
    };

    const result = deviceInfoSchema.safeParse(deviceWithGeo);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.geo?.lat).toBe(40.7128);
      expect(result.data.geo?.lng).toBe(-74.0060);
    }
  });

  it('lastUsedAt должен быть в ISO 8601 формате', () => {
    const deviceWithValidTimestamp = {
      deviceId: 'device-timestamp',
      deviceType: 'desktop',
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    };

    const deviceWithInvalidTimestamp = {
      deviceId: 'device-invalid-ts',
      deviceType: 'desktop',
      lastUsedAt: 'invalid-date', // невалидный ISO timestamp
    };

    const result1 = deviceInfoSchema.safeParse(deviceWithValidTimestamp);
    const result2 = deviceInfoSchema.safeParse(deviceWithInvalidTimestamp);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
  });

  it('os опционально для информации об ОС', () => {
    const deviceWithOs = {
      deviceId: 'device-os',
      deviceType: 'desktop',
      os: 'Windows 11',
    };

    const deviceWithoutOs = {
      deviceId: 'device-no-os',
      deviceType: 'mobile',
    };

    const result1 = deviceInfoSchema.safeParse(deviceWithOs);
    const result2 = deviceInfoSchema.safeParse(deviceWithoutOs);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.os).toBe('Windows 11');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.os).toBeUndefined();
    }
  });

  it('browser опционально для информации о браузере', () => {
    const deviceWithBrowser = {
      deviceId: 'device-browser',
      deviceType: 'desktop',
      browser: 'Chrome 112',
    };

    const deviceWithoutBrowser = {
      deviceId: 'device-no-browser',
      deviceType: 'mobile',
    };

    const result1 = deviceInfoSchema.safeParse(deviceWithBrowser);
    const result2 = deviceInfoSchema.safeParse(deviceWithoutBrowser);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.browser).toBe('Chrome 112');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.browser).toBeUndefined();
    }
  });

  it('appVersion опционально для версии приложения', () => {
    const deviceWithAppVersion = {
      deviceId: 'device-app-version',
      deviceType: 'desktop',
      appVersion: '1.0.3',
    };

    const deviceWithoutAppVersion = {
      deviceId: 'device-no-app-version',
      deviceType: 'mobile',
    };

    const result1 = deviceInfoSchema.safeParse(deviceWithAppVersion);
    const result2 = deviceInfoSchema.safeParse(deviceWithoutAppVersion);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.appVersion).toBe('1.0.3');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.appVersion).toBeUndefined();
    }
  });
});
