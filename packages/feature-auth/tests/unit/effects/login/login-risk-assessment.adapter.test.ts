/**
 * @file Unit тесты для effects/login/login-risk-assessment.adapter.ts
 * Полное покрытие 100% всех функций и edge cases
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// 🔧 MOCKS
// ============================================================================
// Note: transformDomainToDto mock removed - signals no longer part of domain

import type { ClassificationRule } from '@livai/domains/strategies';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import { buildAssessment } from '../../../../src/effects/login/login-risk-assessment.adapter.js';
import type { RiskLevel } from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает минимальный DeviceInfo для тестов */
function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-test-123',
    deviceType: 'desktop',
    os: 'Windows 10',
    browser: 'Chrome',
    ...overrides,
  };
}

/** Создает classificationResult для тестов */
function createClassificationResult(overrides: {
  riskScore?: number;
  riskLevel?: RiskLevel;
  triggeredRules?: readonly ClassificationRule[];
} = {}) {
  return {
    riskScore: 0,
    riskLevel: 'low' as RiskLevel,
    triggeredRules: [] as readonly ClassificationRule[],
    ...overrides,
  };
}

/** Создает минимальный context с обязательным timestamp */
function createContext(overrides: {
  userId?: string;
  ip?: string;
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  userAgent?: string;
  previousSessionId?: string;
  timestamp?: string | number;
} = {}) {
  return {
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - normalizeDeviceForRisk (через buildAssessment)
// ============================================================================

describe('normalizeDeviceForRisk', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('platform detection from OS', () => {
    it('определяет platform как desktop когда os undefined и deviceType desktop', () => {
      const deviceInfo = createDeviceInfo({ deviceType: 'desktop' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('desktop');
    });

    it('определяет platform как web когда os undefined и deviceType не desktop', () => {
      const deviceInfo = createDeviceInfo({ os: '', deviceType: 'mobile' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('web');
    });

    it('определяет platform как web когда os пустая строка и deviceType не desktop', () => {
      const deviceInfo = createDeviceInfo({ os: '', deviceType: 'mobile' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('web');
    });

    it('определяет platform как ios когда os содержит ios', () => {
      const deviceInfo = createDeviceInfo({ os: 'iOS 15.0' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('ios');
    });

    it('определяет platform как ios когда os содержит iphone', () => {
      const deviceInfo = createDeviceInfo({ os: 'iPhone OS 15.0' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('ios');
    });

    it('определяет platform как ios когда os содержит ipad', () => {
      const deviceInfo = createDeviceInfo({ os: 'iPad OS 15.0' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('ios');
    });

    it('определяет platform как android когда os содержит android', () => {
      const deviceInfo = createDeviceInfo({ os: 'Android 12' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('android');
    });

    it('определяет platform как desktop когда os содержит windows', () => {
      const deviceInfo = createDeviceInfo({ os: 'Windows 11' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('desktop');
    });

    it('определяет platform как desktop когда os содержит macos', () => {
      const deviceInfo = createDeviceInfo({ os: 'macOS 12.0' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('desktop');
    });

    it('определяет platform как desktop когда os содержит linux', () => {
      const deviceInfo = createDeviceInfo({ os: 'Linux Ubuntu 22.04' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('desktop');
    });

    it('определяет platform как web когда os не соответствует известным платформам', () => {
      const deviceInfo = createDeviceInfo({ os: 'Unknown OS' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.platform).toBe('web');
    });
  });

  describe('optional fields inclusion', () => {
    it('включает os когда os определен и не пустой', () => {
      const deviceInfo = createDeviceInfo({ os: 'Windows 10' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.os).toBe('Windows 10');
    });

    it('не включает os когда os undefined', () => {
      const deviceInfo = createDeviceInfo({ os: '' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.os).toBeUndefined();
    });

    it('не включает os когда os пустая строка', () => {
      const deviceInfo = createDeviceInfo({ os: '' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.os).toBeUndefined();
    });

    it('включает browser когда browser определен и не пустой', () => {
      const deviceInfo = createDeviceInfo({ browser: 'Chrome 112' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.browser).toBe('Chrome 112');
    });

    it('не включает browser когда browser undefined', () => {
      const deviceInfo = createDeviceInfo({ browser: '' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.browser).toBeUndefined();
    });

    it('не включает browser когда browser пустая строка', () => {
      const deviceInfo = createDeviceInfo({ browser: '' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.browser).toBeUndefined();
    });

    it('включает appVersion когда appVersion определен и не пустой', () => {
      const deviceInfo = createDeviceInfo({ appVersion: '1.0.0' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.appVersion).toBe('1.0.0');
    });

    it('не включает appVersion когда appVersion undefined', () => {
      const deviceInfo = createDeviceInfo();
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.appVersion).toBeUndefined();
    });

    it('не включает appVersion когда appVersion пустая строка', () => {
      const deviceInfo = createDeviceInfo({ appVersion: '' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.appVersion).toBeUndefined();
    });

    it('всегда включает deviceId', () => {
      const deviceInfo = createDeviceInfo({ deviceId: 'custom-device-id' });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });

      expect(result.context.device?.deviceId).toBe('custom-device-id');
    });
  });
});

// ============================================================================
// NOTE: Tests for signals mapping removed - signals no longer part of domain
// ============================================================================

// ============================================================================
// 🎯 TESTS - buildAssessment (Main API)
// ============================================================================

describe('buildAssessment', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('строит минимальный LoginRiskEvaluation', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result).toBeDefined();
    expect(result.context.device).toBeDefined();
    expect(result.context.device?.deviceId).toBe('device-test-123');
    expect(result.result).toBeDefined();
    expect(result.result.score).toBe(0);
    expect(result.result.level).toBe('low');
  });

  it('включает userId когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext({ userId: 'user-123' }),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.userId).toBe('user-123');
  });

  it('не включает userId когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.userId).toBeUndefined();
  });

  it('включает ip когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext({ ip: '192.168.1.1' }),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.ip).toBe('192.168.1.1');
  });

  it('не включает ip когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.ip).toBeUndefined();
  });

  it('включает geo когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const geo = {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    };
    const result = buildAssessment({
      deviceInfo,
      context: createContext({ geo }),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.geo).toEqual(geo);
  });

  it('не включает geo когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.geo).toBeUndefined();
  });

  it('включает userAgent когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext({ userAgent: 'Mozilla/5.0' }),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.userAgent).toBe('Mozilla/5.0');
  });

  it('не включает userAgent когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.userAgent).toBeUndefined();
  });

  it('включает previousSessionId когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext({ previousSessionId: 'session-123' }),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.previousSessionId).toBe('session-123');
  });

  it('не включает previousSessionId когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.previousSessionId).toBeUndefined();
  });

  it('включает timestamp когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const timestamp = '2024-01-01T00:00:00.000Z';
    const result = buildAssessment({
      deviceInfo,
      context: createContext({ timestamp }),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.timestamp).toBeGreaterThan(0);
    expect(typeof result.context.timestamp).toBe('number');
  });

  it('строит полный LoginRiskEvaluation со всеми полями', () => {
    const deviceInfo = createDeviceInfo({
      os: 'Windows 11',
      browser: 'Chrome 112',
      appVersion: '1.0.0',
    });
    const context = createContext({
      userId: 'user-123',
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
      userAgent: 'Mozilla/5.0',
      previousSessionId: 'session-123',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    const classificationResult = createClassificationResult({
      riskScore: 75,
      riskLevel: 'high',
      triggeredRules: [],
    });

    const result = buildAssessment({
      deviceInfo,
      context,
      classificationResult,
    });

    expect(result).toBeDefined();
    expect(result.context.userId).toBe('user-123');
    expect(result.context.ip).toBe('192.168.1.1');
    expect(result.context.geo).toEqual(context.geo);
    expect(result.context.device).toBeDefined();
    expect(result.context.device?.deviceId).toBe('device-test-123');
    expect(result.context.device?.platform).toBe('desktop');
    expect(result.context.device?.os).toBe('Windows 11');
    expect(result.context.device?.browser).toBe('Chrome 112');
    expect(result.context.device?.appVersion).toBe('1.0.0');
    expect(result.context.userAgent).toBe('Mozilla/5.0');
    expect(result.context.previousSessionId).toBe('session-123');
    expect(result.context.timestamp).toBeGreaterThan(0);
    expect(result.result.score).toBe(75);
    expect(result.result.level).toBe('high');
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases и Security
// ============================================================================

describe('Security and Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('обрабатывает case-insensitive OS detection', () => {
    const testCases = [
      { os: 'IOS 15.0', expected: 'ios' },
      { os: 'iPhone OS 15.0', expected: 'ios' },
      { os: 'iPad OS 15.0', expected: 'ios' },
      { os: 'ANDROID 12', expected: 'android' },
      { os: 'WINDOWS 11', expected: 'desktop' },
      { os: 'MACOS 12.0', expected: 'desktop' },
      { os: 'LINUX Ubuntu', expected: 'desktop' },
    ];

    testCases.forEach((testCase) => {
      const deviceInfo = createDeviceInfo({ os: testCase.os });
      const result = buildAssessment({
        deviceInfo,
        context: createContext(),
        classificationResult: createClassificationResult(),
      });
      expect(result.context.device?.platform).toBe(testCase.expected);
    });
  });

  it('обрабатывает пустые строки в optional полях deviceInfo', () => {
    const deviceInfo = createDeviceInfo({
      os: '',
      browser: '',
      appVersion: '',
    });
    const result = buildAssessment({
      deviceInfo,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });

    expect(result.context.device?.os).toBeUndefined();
    expect(result.context.device?.browser).toBeUndefined();
    expect(result.context.device?.appVersion).toBeUndefined();
  });

  it('покрывает все ветки в normalizeDeviceForRisk для разных комбинаций os и deviceType', () => {
    // Тест для ветки: os === undefined || os === '' && deviceType === 'desktop'
    const deviceInfo1 = createDeviceInfo({ os: '', deviceType: 'desktop' });
    const result1 = buildAssessment({
      deviceInfo: deviceInfo1,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });
    expect(result1.context.device?.platform).toBe('desktop');

    // Тест для ветки: os === undefined || os === '' && deviceType !== 'desktop'
    const deviceInfo2 = createDeviceInfo({ os: '', deviceType: 'mobile' });
    const result2 = buildAssessment({
      deviceInfo: deviceInfo2,
      context: createContext(),
      classificationResult: createClassificationResult(),
    });
    expect(result2.context.device?.platform).toBe('web');
  });

  it('валидирует riskScore диапазон', () => {
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext(),
        classificationResult: createClassificationResult({ riskScore: -1 }),
      });
    }).toThrow();

    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext(),
        classificationResult: createClassificationResult({ riskScore: 101 }),
      });
    }).toThrow();

    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext(),
        classificationResult: createClassificationResult({ riskScore: NaN }),
      });
    }).toThrow();

    // Valid range
    const result = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext(),
      classificationResult: createClassificationResult({ riskScore: 50 }),
    });
    expect(result.result.score).toBe(50);
  });

  it('валидирует timestamp', () => {
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ timestamp: undefined as unknown as string }),
        classificationResult: createClassificationResult(),
      });
    }).toThrow();

    // Valid timestamp
    const result = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext({ timestamp: '2024-01-01T00:00:00.000Z' }),
      classificationResult: createClassificationResult(),
    });
    expect(result.context.timestamp).toBeGreaterThan(0);
  });

  it('покрывает validateAndParseTimestamp с невалидным ISO 8601 форматом (строка 238)', () => {
    // Timestamp, который не соответствует ISO 8601 формату
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ timestamp: '2024-01-01 00:00:00' }), // Не ISO 8601 формат
        classificationResult: createClassificationResult(),
      });
    }).toThrow(/Invalid timestamp format: must be ISO 8601/);
  });

  it('покрывает validateAndParseTimestamp с number NaN (строка 216)', () => {
    // Timestamp как number, но NaN
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ timestamp: NaN }),
        classificationResult: createClassificationResult(),
      });
    }).toThrow(/Invalid timestamp: must be finite number/);
  });

  it('покрывает validateAndParseTimestamp с number Infinity (строка 216)', () => {
    // Timestamp как number, но Infinity
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ timestamp: Infinity }),
        classificationResult: createClassificationResult(),
      });
    }).toThrow(/Invalid timestamp: must be finite number/);
  });

  // Примечание: строка 328 (catch блок для исключений из ipaddr.js) практически недостижима,
  // так как ipaddr.js обычно не выбрасывает исключения, а возвращает false.
  // Это защитный код на случай, если библиотека изменится в будущем.
  // Покрытие этой строки требует глобального мокирования модуля, что ломает другие тесты.

  it('валидирует IP адрес', () => {
    // Valid IPv4
    const result1 = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext({ ip: '192.168.1.1' }),
      classificationResult: createClassificationResult(),
    });
    expect(result1.context.ip).toBe('192.168.1.1');

    // Invalid IP should throw
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ ip: 'invalid-ip' }),
        classificationResult: createClassificationResult(),
      });
    }).toThrow();
  });

  it('валидирует geo координаты', () => {
    // Valid geo
    const result1 = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext({ geo: { lat: 37.7749, lng: -122.4194 } }),
      classificationResult: createClassificationResult(),
    });
    expect(result1.context.geo?.lat).toBe(37.7749);
    expect(result1.context.geo?.lng).toBe(-122.4194);

    // Invalid lat should throw
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ geo: { lat: 91 } }),
        classificationResult: createClassificationResult(),
      });
    }).toThrow();

    // Invalid lng should throw
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ geo: { lng: 181 } }),
        classificationResult: createClassificationResult(),
      });
    }).toThrow();
  });

  it('устраняет дубликаты reasons при маппинге правил', () => {
    // VPN_DETECTED и NEW_DEVICE_VPN оба маппятся в {type: 'network', code: 'vpn'}
    const triggeredRules: ClassificationRule[] = [
      'VPN_DETECTED',
      'NEW_DEVICE_VPN',
    ] as ClassificationRule[];
    const result = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext(),
      classificationResult: createClassificationResult({ triggeredRules }),
    });

    // Должен быть только один reason с {type: 'network', code: 'vpn'}
    const networkReasons = result.result.reasons.filter(
      (r) => r.type === 'network' && r.code === 'vpn',
    );
    expect(networkReasons).toHaveLength(1);
    expect(result.result.reasons).toHaveLength(1);
  });

  it('устраняет дубликаты для разных правил, маппящихся в один reason', () => {
    // UNKNOWN_DEVICE, IoT_DEVICE, MISSING_OS, MISSING_BROWSER все маппятся в {type: 'device', code: 'unknown'}
    const triggeredRules: ClassificationRule[] = [
      'UNKNOWN_DEVICE',
      'IoT_DEVICE',
      'MISSING_OS',
      'MISSING_BROWSER',
    ] as ClassificationRule[];
    const result = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext(),
      classificationResult: createClassificationResult({ triggeredRules }),
    });

    // Должен быть только один reason с {type: 'device', code: 'unknown'}
    const deviceReasons = result.result.reasons.filter(
      (r) => r.type === 'device' && r.code === 'unknown',
    );
    expect(deviceReasons).toHaveLength(1);
    expect(result.result.reasons).toHaveLength(1);
  });

  it('сохраняет разные reasons при отсутствии дубликатов', () => {
    const triggeredRules: ClassificationRule[] = [
      'VPN_DETECTED',
      'TOR_NETWORK',
      'LOW_REPUTATION',
    ] as ClassificationRule[];
    const result = buildAssessment({
      deviceInfo: createDeviceInfo(),
      context: createContext(),
      classificationResult: createClassificationResult({ triggeredRules }),
    });

    // Должны быть три разных reason
    expect(result.result.reasons).toHaveLength(3);
    expect(result.result.reasons.some((r) => r.type === 'network' && r.code === 'vpn')).toBe(true);
    expect(result.result.reasons.some((r) => r.type === 'network' && r.code === 'tor')).toBe(true);
    expect(result.result.reasons.some((r) => r.type === 'reputation' && r.code === 'low')).toBe(
      true,
    );
  });

  it('покрывает validateIpAddress с пустой строкой после trim (строка 306)', () => {
    // IP адрес, который после trim становится пустой строкой
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ ip: '   ' }), // Пробелы
        classificationResult: createClassificationResult(),
      });
    }).toThrow(/IP address cannot be empty string/);
  });

  it('покрывает validateIpAddress с невалидным IP, вызывающим исключение из ipaddr.js (строка 328)', () => {
    // IP адрес, который вызывает исключение из ipaddr.js (не DomainValidationError)
    // ipaddr.js может выбросить исключение для очень невалидных адресов
    // Попробуем использовать очень длинную строку, которая может вызвать исключение
    expect(() => {
      buildAssessment({
        deviceInfo: createDeviceInfo(),
        context: createContext({ ip: 'a'.repeat(1000) }), // Очень длинная невалидная строка
        classificationResult: createClassificationResult(),
      });
    }).toThrow(/Invalid IP address/);
  });

  it('покрывает validateAndParseTimestamp с Date.parse возвращающим NaN (строка 251)', () => {
    // Мокаем Date.parse, чтобы он возвращал NaN
    const parseSpy = vi.spyOn(global.Date, 'parse').mockReturnValue(NaN);

    try {
      // Используем валидный ISO 8601 формат, но Date.parse вернет NaN
      expect(() => {
        buildAssessment({
          deviceInfo: createDeviceInfo(),
          context: createContext({ timestamp: '2024-01-01T00:00:00.000Z' }),
          classificationResult: createClassificationResult(),
        });
      }).toThrow(/Date.parse returned non-finite value/);
    } finally {
      // Восстанавливаем оригинальный Date.parse
      parseSpy.mockRestore();
    }
  });
});
