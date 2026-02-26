/**
 * @file Unit тесты для domain/LoginRiskAssessment.ts
 * Полное покрытие оценки риска аутентификации с учетом security и privacy
 */

import { describe, expect, it } from 'vitest';
import type {
  DeviceRiskInfo,
  GeoInfo,
  LoginRiskEvaluation,
  LoginRiskResult,
} from '../../../src/domain/LoginRiskAssessment.js';
import {
  createEmptyLoginRiskResult,
  createLoginRiskEvaluation as createLoginRiskEvaluationDomain,
  createLoginRiskResult,
  createRiskModelVersion,
  createRiskScore,
  deriveLoginDecision,
  DomainValidationError,
} from '../../../src/domain/LoginRiskAssessment.js';
import { loginRiskAssessmentSchema } from '../../../src/schemas/index.js';

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

function createLoginRiskEvaluationHelper(
  overrides: {
    result?: Partial<LoginRiskResult>;
    context?: Partial<LoginRiskEvaluation['context']>;
  } = {},
): LoginRiskEvaluation {
  const result = createLoginRiskResult({
    score: 25,
    level: 'low',
    modelVersion: '1.0',
    ...overrides.result,
  });

  const context: LoginRiskEvaluation['context'] = {
    userId: 'user-123',
    ip: '192.168.1.1',
    geo: createGeoInfo(),
    device: createDeviceRiskInfo(),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    previousSessionId: 'session-prev-456',
    timestamp: new Date('2026-01-15T10:30:00.000Z').getTime(),
    ...overrides.context,
  };

  return createLoginRiskEvaluationDomain(result, context);
}

function createMinimalLoginRiskEvaluation(): LoginRiskEvaluation {
  const result = createEmptyLoginRiskResult();
  const context: LoginRiskEvaluation['context'] = {
    timestamp: new Date('2026-01-15T10:30:00.000Z').getTime(), // Фиксированный timestamp для snapshots
  };
  return createLoginRiskEvaluationDomain(result, context);
}

function createFullLoginRiskEvaluation(): LoginRiskEvaluation {
  const result = createLoginRiskResult({
    score: 75,
    level: 'high',
    reasons: [{ type: 'network', code: 'vpn' }],
    modelVersion: '1.0',
  });

  const context: LoginRiskEvaluation['context'] = {
    userId: 'user-full-456',
    ip: '10.0.0.1',
    geo: createGeoInfo({
      country: 'DE',
      region: 'BE',
      city: 'Berlin',
      lat: 52.5200,
      lng: 13.4050,
    }),
    device: createDeviceRiskInfo({
      deviceId: 'device-full-789',
      fingerprint: 'fp-full-abc',
      platform: 'ios',
      os: 'iOS 17.0',
      browser: 'Safari 17.0',
      appVersion: '2.1.0',
    }),
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    previousSessionId: 'session-full-prev',
    timestamp: new Date('2026-01-15T12:00:00.000Z').getTime(),
  };

  return createLoginRiskEvaluationDomain(result, context);
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

  // Валидация координат GeoInfo не реализована в domain слое
  // GeoInfo - это простой тип без валидации
  // Валидация может быть добавлена в adapter слое при необходимости
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

describe('LoginRiskEvaluation полный DTO', () => {
  it('создает минимальную оценку риска (все поля опциональны)', () => {
    const evaluation = createMinimalLoginRiskEvaluation();

    expect(evaluation.context.userId).toBeUndefined();
    expect(evaluation.context.ip).toBeUndefined();
    expect(evaluation.context.geo).toBeUndefined();
    expect(evaluation.context.device).toBeUndefined();
    expect(evaluation.context.userAgent).toBeUndefined();
    expect(evaluation.context.previousSessionId).toBeUndefined();
    expect(evaluation.context.timestamp).toBeDefined();
    expect(evaluation.result.score).toBeDefined();
    expect(evaluation.result.level).toBeDefined();
    expect(evaluation.result.reasons).toBeDefined();
    expect(evaluation.result.modelVersion).toBeDefined();
  });

  it('создает полную оценку риска со всеми полями', () => {
    const evaluation = createFullLoginRiskEvaluation();

    expect(evaluation.context.userId).toBe('user-full-456');
    expect(evaluation.context.ip).toBe('10.0.0.1');
    expect(evaluation.context.geo?.country).toBe('DE');
    expect(evaluation.context.geo?.city).toBe('Berlin');
    expect(evaluation.context.device?.deviceId).toBe('device-full-789');
    expect(evaluation.context.device?.fingerprint).toBe('fp-full-abc');
    expect(evaluation.context.device?.platform).toBe('ios');
    expect(evaluation.context.userAgent).toBe(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    );
    expect(evaluation.context.previousSessionId).toBe('session-full-prev');
    expect(evaluation.context.timestamp).toBe(new Date('2026-01-15T12:00:00.000Z').getTime());
    expect(evaluation.result.score).toBeDefined();
    expect(evaluation.result.level).toBe('high');
    expect(evaluation.result.reasons).toHaveLength(1);
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
      const evaluation = createLoginRiskEvaluationHelper({ context: { ip } });
      expect(evaluation.context.ip).toBe(ip);
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
      const evaluation = createLoginRiskEvaluationHelper({ context: { userAgent } });
      expect(evaluation.context.userAgent).toBe(userAgent);
    });
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('LoginRiskEvaluation optional fields', () => {
  it('userId опционально (может отсутствовать до идентификации)', () => {
    const evaluationWithUserId = createLoginRiskEvaluationHelper({
      context: { userId: 'user-123' },
    });
    const evaluationWithoutUserId = createMinimalLoginRiskEvaluation();

    expect(evaluationWithUserId.context.userId).toBe('user-123');
    expect(evaluationWithoutUserId.context.userId).toBeUndefined();
  });

  it('ip опционально для IP адреса клиента', () => {
    const evaluationWithIp = createLoginRiskEvaluationHelper({ context: { ip: '192.168.1.1' } });
    const evaluationWithoutIp = createMinimalLoginRiskEvaluation();

    expect(evaluationWithIp.context.ip).toBe('192.168.1.1');
    expect(evaluationWithoutIp.context.ip).toBeUndefined();
  });

  it('geo опционально для геолокации', () => {
    const evaluationWithGeo = createLoginRiskEvaluationHelper({
      context: { geo: createGeoInfo() },
    });
    const evaluationWithoutGeo = createMinimalLoginRiskEvaluation();

    expect(evaluationWithGeo.context.geo?.country).toBe('US');
    expect(evaluationWithGeo.context.geo?.lat).toBe(37.7749);
    expect(evaluationWithoutGeo.context.geo).toBeUndefined();
  });

  it('device опционально для информации об устройстве', () => {
    const evaluationWithDevice = createLoginRiskEvaluationHelper({
      context: { device: createDeviceRiskInfo() },
    });
    const evaluationWithoutDevice = createMinimalLoginRiskEvaluation();

    expect(evaluationWithDevice.context.device?.deviceId).toBe('device-abc-123');
    expect(evaluationWithDevice.context.device?.fingerprint).toBe('fp-xyz-789');
    expect(evaluationWithoutDevice.context.device).toBeUndefined();
  });

  it('userAgent опционально для User-Agent строки', () => {
    const evaluationWithUserAgent = createLoginRiskEvaluationHelper({
      context: { userAgent: 'Mozilla/5.0' },
    });
    const evaluationWithoutUserAgent = createMinimalLoginRiskEvaluation();

    expect(evaluationWithUserAgent.context.userAgent).toBe('Mozilla/5.0');
    expect(evaluationWithoutUserAgent.context.userAgent).toBeUndefined();
  });

  it('previousSessionId опционально для предыдущей сессии', () => {
    const evaluationWithPrevious = createLoginRiskEvaluationHelper({
      context: { previousSessionId: 'session-prev' },
    });
    const evaluationWithoutPrevious = createMinimalLoginRiskEvaluation();

    expect(evaluationWithPrevious.context.previousSessionId).toBe('session-prev');
    expect(evaluationWithoutPrevious.context.previousSessionId).toBeUndefined();
  });

  it('timestamp обязателен для временной метки', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: { timestamp: new Date('2026-01-15T10:30:00.000Z').getTime() },
    });

    expect(evaluation.context.timestamp).toBe(new Date('2026-01-15T10:30:00.000Z').getTime());
  });
});

// ============================================================================
// 🔒 SECURITY & PRIVACY - Безопасность и конфиденциальность
// ============================================================================

describe('LoginRiskEvaluation security & privacy', () => {
  it('IP адрес - PII данные, должны обрабатываться согласно GDPR', () => {
    // IP адрес является Personal Identifiable Information (PII)
    const evaluation = createLoginRiskEvaluationHelper({
      context: { ip: '192.168.1.1' },
    });

    expect(evaluation.context.ip).toBe('192.168.1.1');

    // В продакшене эти данные должны:
    // - Храниться с шифрованием
    // - Иметь ограниченный TTL
    // - Соответствовать GDPR/privacy policy
    // - Использоваться только для security/fraud prevention
  });

  it('геолокация - PII данные, требуют особой обработки', () => {
    // Геолокация является PII и требует особой обработки
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        geo: {
          country: 'US',
          city: 'San Francisco',
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    });

    expect(evaluation.context.geo?.country).toBe('US');
    expect(evaluation.context.geo?.lat).toBe(37.7749);

    // В продакшене эти данные должны:
    // - Анонимизироваться при хранении (если возможно)
    // - Иметь ограниченный доступ
    // - Соответствовать GDPR/privacy regulations
    // - Использоваться только для risk assessment
  });

  it('device fingerprint - tracking данные, требуют конфиденциальности', () => {
    // Device fingerprint используется для tracking и fraud prevention
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        device: {
          deviceId: 'device-fingerprint-123',
          fingerprint: 'fp-hash-abc-xyz',
          platform: 'web',
        },
      },
    });

    expect(evaluation.context.device?.deviceId).toBe('device-fingerprint-123');
    expect(evaluation.context.device?.fingerprint).toBe('fp-hash-abc-xyz');

    // В продакшене эти данные должны:
    // - Храниться в зашифрованном виде
    // - Иметь ограниченный доступ
    // - Использоваться только для security purposes
    // - Соответствовать privacy policy
  });

  it('userAgent - browser fingerprinting данные', () => {
    // User-Agent используется для browser fingerprinting
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    expect(evaluation.context.userAgent).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    // В продакшене эти данные должны:
    // - Использоваться для security monitoring
    // - Не передаваться третьим лицам без согласия
    // - Соответствовать privacy regulations
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('LoginRiskEvaluation edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        userId: '',
        ip: '',
        userAgent: '',
        previousSessionId: '',
        timestamp: Date.now(),
      },
    });

    expect(evaluation.context.userId).toBe('');
    expect(evaluation.context.ip).toBe('');
    expect(evaluation.context.userAgent).toBe('');
    expect(evaluation.context.previousSessionId).toBe('');
    expect(evaluation.context.timestamp).toBeDefined();
  });

  it('поддерживает пустой geo объект', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        geo: {},
      },
    });

    expect(evaluation.context.geo).toEqual({});
  });

  it('поддерживает пустой device объект', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        device: {},
      },
    });

    expect(evaluation.context.device).toEqual({});
  });

  it('timestamp обязателен и должен быть числом', () => {
    const evaluationWithTimestamp = createLoginRiskEvaluationHelper({
      context: {
        timestamp: new Date('2026-01-15T10:30:00.000Z').getTime(),
      },
    });

    const evaluationWithoutTimestamp = createMinimalLoginRiskEvaluation();

    expect(evaluationWithTimestamp.context.timestamp).toBe(
      new Date('2026-01-15T10:30:00.000Z').getTime(),
    );
    expect(evaluationWithoutTimestamp.context.timestamp).toBeDefined();
  });

  it('поддерживает различные форматы IP адресов (IPv4 и IPv6)', () => {
    const ipv4Addresses = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1'];
    const ipv6Addresses = ['::1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'fe80::1'];

    [...ipv4Addresses, ...ipv6Addresses].forEach((ip) => {
      const evaluation = createLoginRiskEvaluationHelper({ context: { ip } });
      expect(evaluation.context.ip).toBe(ip);
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
      const evaluation = createLoginRiskEvaluationHelper({
        context: {
          geo: {
            lat: coord.lat,
            lng: coord.lng,
          },
        },
      });
      expect(evaluation.context.geo?.lat).toBe(coord.lat);
      expect(evaluation.context.geo?.lng).toBe(coord.lng);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('LoginRiskEvaluation immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        userId: 'user-immutable',
        ip: '192.168.1.1',
        geo: createGeoInfo(),
        device: createDeviceRiskInfo(),
        userAgent: 'Mozilla/5.0',
        previousSessionId: 'session-immutable',
        timestamp: new Date('2026-01-15T10:30:00.000Z').getTime(),
      },
    });

    // TypeScript предотвращает мутацию
    // evaluation.context.userId = 'new-user'; // TypeScript error: Cannot assign to 'userId' because it is a read-only property
    // evaluation.context.ip = 'new-ip'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(evaluation.context.userId).toBe('user-immutable');
    expect(evaluation.context.ip).toBe('192.168.1.1');
  });

  it('geo readonly - предотвращает мутацию вложенных объектов', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        geo: {
          country: 'US',
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    });

    // TypeScript предотвращает мутацию geo
    // evaluation.context.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property
    // evaluation.context.geo!.lng = 0; // TypeScript error: Cannot assign to 'lng' because it is a read-only property

    expect(evaluation.context.geo?.lat).toBe(37.7749);
    expect(evaluation.context.geo?.lng).toBe(-122.4194);
  });

  it('device readonly - предотвращает мутацию вложенных объектов', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        device: {
          deviceId: 'device-immutable',
          fingerprint: 'fp-immutable',
          platform: 'web',
        },
      },
    });

    // TypeScript предотвращает мутацию device
    // evaluation.context.device!.deviceId = 'new-id'; // TypeScript error: Cannot assign to 'deviceId' because it is a read-only property
    // evaluation.context.device!.platform = 'ios'; // TypeScript error: Cannot assign to 'platform' because it is a read-only property

    expect(evaluation.context.device?.deviceId).toBe('device-immutable');
    expect(evaluation.context.device?.platform).toBe('web');
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('LoginRiskEvaluation comprehensive snapshots', () => {
  it('full risk evaluation - полный snapshot', () => {
    const evaluation = createFullLoginRiskEvaluation();

    expect(evaluation).toMatchSnapshot();
  });

  it('minimal risk evaluation - полный snapshot', () => {
    const evaluation = createMinimalLoginRiskEvaluation();

    expect(evaluation).toMatchSnapshot();
  });

  it('risk evaluation with geo only - полный snapshot', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        geo: createGeoInfo({
          country: 'DE',
          city: 'Berlin',
          lat: 52.5200,
          lng: 13.4050,
        }),
      },
    });

    expect(evaluation).toMatchSnapshot();
  });

  it('risk evaluation with device only - полный snapshot', () => {
    const evaluation = createLoginRiskEvaluationHelper({
      context: {
        device: createDeviceRiskInfo({
          platform: 'ios',
          os: 'iOS 17.0',
          browser: 'Safari 17.0',
        }),
      },
    });

    expect(evaluation).toMatchSnapshot();
  });
});

// ============================================================================
// 🔧 DOMAIN VALIDATION FUNCTIONS - Функции валидации domain типов
// ============================================================================

describe('deriveLoginDecision вычисление решения', () => {
  it('возвращает "block" для critical уровня риска', () => {
    expect(deriveLoginDecision('critical')).toBe('block');
  });

  it('возвращает "block" для high уровня риска', () => {
    expect(deriveLoginDecision('high')).toBe('block');
  });

  it('возвращает "mfa" для medium уровня риска', () => {
    expect(deriveLoginDecision('medium')).toBe('mfa');
  });

  it('возвращает "login" для low уровня риска', () => {
    expect(deriveLoginDecision('low')).toBe('login');
  });

  it('возвращает undefined для невалидного значения (lookup table)', () => {
    // Используем type assertion для тестирования lookup table
    // В реальности это не должно произойти, но это защита от расширения типа
    // Используем 'as any' чтобы обойти проверки TypeScript
    // Теперь функция использует lookup table, поэтому для невалидного значения вернется undefined
    const result = deriveLoginDecision('unknown' as any);
    expect(result).toBeUndefined();
  });
});

describe('DomainValidationError toJSON', () => {
  it('сериализует ошибку с полями', () => {
    const error = new DomainValidationError(
      'Test error',
      'testField',
      'testValue',
      'TEST_CODE',
    );

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'DomainValidationError',
      message: 'Test error',
      field: 'testField',
      value: 'testValue',
      code: 'TEST_CODE',
    });

    // Проверяем, что объект frozen
    expect(Object.isFrozen(json)).toBe(true);
  });

  it('сериализует ошибку без опциональных полей', () => {
    const error = new DomainValidationError('Test error');

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'DomainValidationError',
      message: 'Test error',
      code: 'DOMAIN_VALIDATION_ERROR',
    });

    expect(json.field).toBeUndefined();
    expect(json.value).toBeUndefined();
  });

  it('сериализует ошибку с field но без value', () => {
    const error = new DomainValidationError('Test error', 'testField');

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'DomainValidationError',
      message: 'Test error',
      field: 'testField',
      code: 'DOMAIN_VALIDATION_ERROR',
    });

    expect(json.value).toBeUndefined();
  });
});

describe('createRiskScore валидация', () => {
  it('создает валидный RiskScore в диапазоне 0-100', () => {
    expect(createRiskScore(0)).toBe(0);
    expect(createRiskScore(50)).toBe(50);
    expect(createRiskScore(100)).toBe(100);
  });

  it('выбрасывает ошибку при score = NaN', () => {
    expect(() => {
      createRiskScore(NaN);
    }).toThrow(DomainValidationError);

    try {
      createRiskScore(NaN);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('score');
      expect((error as DomainValidationError).code).toBe('RISK_SCORE_INVALID_FINITE');
      expect((error as DomainValidationError).value).toBeNaN();
    }
  });

  it('выбрасывает ошибку при score = Infinity', () => {
    expect(() => {
      createRiskScore(Infinity);
    }).toThrow(DomainValidationError);

    try {
      createRiskScore(Infinity);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('score');
      expect((error as DomainValidationError).code).toBe('RISK_SCORE_INVALID_FINITE');
      expect((error as DomainValidationError).value).toBe(Infinity);
    }
  });

  it('выбрасывает ошибку при score = -Infinity', () => {
    expect(() => {
      createRiskScore(-Infinity);
    }).toThrow(DomainValidationError);

    try {
      createRiskScore(-Infinity);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('score');
      expect((error as DomainValidationError).code).toBe('RISK_SCORE_INVALID_FINITE');
      expect((error as DomainValidationError).value).toBe(-Infinity);
    }
  });

  it('выбрасывает ошибку при score < 0', () => {
    expect(() => {
      createRiskScore(-1);
    }).toThrow(DomainValidationError);

    try {
      createRiskScore(-1);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('score');
      expect((error as DomainValidationError).code).toBe('RISK_SCORE_OUT_OF_RANGE');
      expect((error as DomainValidationError).value).toBe(-1);
    }
  });

  it('выбрасывает ошибку при score > 100', () => {
    expect(() => {
      createRiskScore(101);
    }).toThrow(DomainValidationError);

    try {
      createRiskScore(101);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('score');
      expect((error as DomainValidationError).code).toBe('RISK_SCORE_OUT_OF_RANGE');
      expect((error as DomainValidationError).value).toBe(101);
    }
  });
});

describe('createRiskModelVersion валидация', () => {
  it('создает валидный RiskModelVersion', () => {
    expect(createRiskModelVersion('1.0')).toBe('1.0');
    expect(createRiskModelVersion('2.5')).toBe('2.5');
    expect(createRiskModelVersion('1.0.0')).toBe('1.0.0');
    expect(createRiskModelVersion('1.0.0-beta')).toBe('1.0.0-beta');
    expect(createRiskModelVersion('2.5.1-alpha')).toBe('2.5.1-alpha');
  });

  it('выбрасывает ошибку при пустой строке', () => {
    expect(() => {
      createRiskModelVersion('');
    }).toThrow(DomainValidationError);

    try {
      createRiskModelVersion('');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('modelVersion');
      expect((error as DomainValidationError).code).toBe('MODEL_VERSION_INVALID_TYPE');
      expect((error as DomainValidationError).value).toBe('');
    }
  });

  it('выбрасывает ошибку при не-строке (number)', () => {
    expect(() => {
      // @ts-expect-error - намеренно передаем неверный тип для теста
      createRiskModelVersion(123);
    }).toThrow(DomainValidationError);

    try {
      // @ts-expect-error - намеренно передаем неверный тип для теста
      createRiskModelVersion(123);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('modelVersion');
      expect((error as DomainValidationError).code).toBe('MODEL_VERSION_INVALID_TYPE');
      expect((error as DomainValidationError).value).toBe(123);
    }
  });

  it('выбрасывает ошибку при невалидном формате (без точки)', () => {
    expect(() => {
      createRiskModelVersion('10');
    }).toThrow(DomainValidationError);

    try {
      createRiskModelVersion('10');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('modelVersion');
      expect((error as DomainValidationError).code).toBe('MODEL_VERSION_INVALID_FORMAT');
      expect((error as DomainValidationError).value).toBe('10');
    }
  });

  it('выбрасывает ошибку при невалидном формате (только буквы)', () => {
    expect(() => {
      createRiskModelVersion('invalid');
    }).toThrow(DomainValidationError);

    try {
      createRiskModelVersion('invalid');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('modelVersion');
      expect((error as DomainValidationError).code).toBe('MODEL_VERSION_INVALID_FORMAT');
      expect((error as DomainValidationError).value).toBe('invalid');
    }
  });

  it('выбрасывает ошибку при невалидном формате (неправильный порядок)', () => {
    expect(() => {
      createRiskModelVersion('.1.0');
    }).toThrow(DomainValidationError);

    try {
      createRiskModelVersion('.1.0');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).field).toBe('modelVersion');
      expect((error as DomainValidationError).code).toBe('MODEL_VERSION_INVALID_FORMAT');
      expect((error as DomainValidationError).value).toBe('.1.0');
    }
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные risk evaluations проходят Zod схему', () => {
    const validEvaluation = {
      result: {
        score: 25,
        level: 'low',
        decision: 'login',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
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
        timestamp: new Date('2026-01-15T10:30:00.000Z').getTime(),
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(validEvaluation);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.context.userId).toBe('user-123');
      expect(result.data.context.ip).toBe('192.168.1.1');
      expect(result.data.context.geo?.country).toBe('US');
      expect(result.data.context.device?.platform).toBe('web');
      expect(result.data.result.score).toBe(25);
      expect(result.data.result.level).toBe('low');
    }
  });

  it('невалидный timestamp отклоняется', () => {
    const invalidEvaluation = {
      result: {
        score: 25,
        level: 'low',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        timestamp: 'invalid-date', // невалидный timestamp (должен быть number)
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(invalidEvaluation);
    expect(result.success).toBe(false);
  });

  it('невалидный platform в device отклоняется', () => {
    const invalidEvaluation = {
      result: {
        score: 25,
        level: 'low',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        device: {
          platform: 'invalid-platform', // невалидный platform
        },
        timestamp: Date.now(),
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(invalidEvaluation);
    expect(result.success).toBe(false);
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const evaluationWithExtra = {
      result: {
        score: 25,
        level: 'low',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        userId: 'user-123',
        timestamp: Date.now(),
      },
      extraField: 'not allowed', // дополнительное поле
    };

    const result = loginRiskAssessmentSchema.safeParse(evaluationWithExtra);
    expect(result.success).toBe(false);
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум полей (result обязателен, context обязателен, но поля внутри опциональны)
    const minimalEvaluation = {
      result: {
        score: 0,
        level: 'low',
        decision: 'login',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        timestamp: Date.now(),
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(minimalEvaluation);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.context.userId).toBeUndefined();
      expect(result.data.context.ip).toBeUndefined();
      expect(result.data.context.geo).toBeUndefined();
      expect(result.data.context.device).toBeUndefined();
      expect(result.data.context.userAgent).toBeUndefined();
      expect(result.data.context.previousSessionId).toBeUndefined();
      expect(result.data.context.timestamp).toBeDefined();
    }
  });

  it('geo может содержать координаты', () => {
    const evaluationWithGeo = {
      result: {
        score: 25,
        level: 'low',
        decision: 'login',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        geo: {
          country: 'US',
          lat: 37.7749,
          lng: -122.4194,
        },
        timestamp: Date.now(),
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(evaluationWithGeo);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.context.geo?.country).toBe('US');
      expect(result.data.context.geo?.lat).toBe(37.7749);
      expect(result.data.context.geo?.lng).toBe(-122.4194);
    }
  });

  it('device может содержать fingerprint и platform', () => {
    const evaluationWithDevice = {
      result: {
        score: 25,
        level: 'low',
        decision: 'login',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        device: {
          deviceId: 'device-123',
          fingerprint: 'fp-abc-xyz',
          platform: 'ios',
          os: 'iOS 17.0',
          browser: 'Safari',
        },
        timestamp: Date.now(),
      },
    };

    const result = loginRiskAssessmentSchema.safeParse(evaluationWithDevice);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.context.device?.deviceId).toBe('device-123');
      expect(result.data.context.device?.fingerprint).toBe('fp-abc-xyz');
      expect(result.data.context.device?.platform).toBe('ios');
    }
  });

  it('timestamp должен быть числом (epoch ms)', () => {
    const evaluationWithValidTimestamp = {
      result: {
        score: 25,
        level: 'low',
        decision: 'login',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        timestamp: Date.now(),
      },
    };

    const evaluationWithInvalidTimestamp = {
      result: {
        score: 25,
        level: 'low',
        reasons: [],
        modelVersion: '1.0',
      },
      context: {
        timestamp: 'invalid-date', // невалидный timestamp (должен быть number)
      },
    };

    const result1 = loginRiskAssessmentSchema.safeParse(evaluationWithValidTimestamp);
    const result2 = loginRiskAssessmentSchema.safeParse(evaluationWithInvalidTimestamp);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
  });

  it('platform должен быть одним из допустимых значений', () => {
    const validPlatforms = ['web', 'ios', 'android', 'desktop'];

    validPlatforms.forEach((platform) => {
      const evaluation = {
        result: {
          score: 25,
          level: 'low',
          decision: 'login',
          reasons: [],
          modelVersion: '1.0',
        },
        context: {
          device: {
            platform: platform as 'web' | 'ios' | 'android' | 'desktop',
          },
          timestamp: Date.now(),
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(evaluation);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.context.device?.platform).toBe(platform);
      }
    });
  });

  it('IP адрес валидируется как строка (различные форматы)', () => {
    const ipAddresses = [
      '192.168.1.1', // IPv4
      '10.0.0.1', // IPv4 private
      '::1', // IPv6 localhost
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6 full
    ];

    ipAddresses.forEach((ip) => {
      const evaluation = {
        result: {
          score: 25,
          level: 'low',
          decision: 'login',
          reasons: [],
          modelVersion: '1.0',
        },
        context: {
          ip,
          timestamp: Date.now(),
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(evaluation);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.context.ip).toBe(ip);
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
      const evaluation = {
        result: {
          score: 25,
          level: 'low',
          decision: 'login',
          reasons: [],
          modelVersion: '1.0',
        },
        context: {
          device: {
            fingerprint,
          },
          timestamp: Date.now(),
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(evaluation);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.context.device?.fingerprint).toBe(fingerprint);
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
      const evaluation = {
        result: {
          score: 25,
          level: 'low',
          decision: 'login',
          reasons: [],
          modelVersion: '1.0',
        },
        context: {
          geo: {
            lat: coord.lat,
            lng: coord.lng,
          },
          timestamp: Date.now(),
        },
      };

      const result = loginRiskAssessmentSchema.safeParse(evaluation);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.context.geo?.lat).toBe(coord.lat);
        expect(result.data.context.geo?.lng).toBe(coord.lng);
      }
    });
  });
});
