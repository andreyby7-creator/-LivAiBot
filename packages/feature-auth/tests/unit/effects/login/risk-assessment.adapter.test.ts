/**
 * @file Unit тесты для effects/login/risk-assessment.adapter.ts
 * Полное покрытие risk assessment adapter с тестированием всех функций и edge cases
 */

import { describe, expect, it } from 'vitest';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import { buildAssessment } from '../../../../src/effects/login/risk-assessment.adapter.js';
import type {
  RiskSignals,
  SignalsMapperPlugin,
} from '../../../../src/effects/login/risk-assessment.adapter.js';

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

/** Создает RiskSignals для тестов */
function createRiskSignals(overrides: Partial<RiskSignals> = {}): RiskSignals {
  return {
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - buildAssessment (Main API)
// ============================================================================

describe('buildAssessment', () => {
  it('строит assessment с минимальными данными', () => {
    const deviceInfo = createDeviceInfo();
    const context = {};
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment).toBeDefined();
    expect(assessment.device).toBeDefined();
    expect(assessment.device?.deviceId).toBe('device-test-123');
  });

  it('строит assessment с полными данными', () => {
    const deviceInfo = createDeviceInfo({
      deviceId: 'device-full',
      deviceType: 'mobile',
      os: 'iOS 17.0',
      browser: 'Safari',
      userAgent: 'Mozilla/5.0',
      appVersion: '1.0.0',
    });
    const context = {
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
      previousSessionId: 'session-456',
      timestamp: '2026-01-15T10:30:00.000Z',
      signals: createRiskSignals({
        isVpn: true,
        isTor: false,
        isProxy: false,
        asn: 'AS12345',
        reputationScore: 80,
        velocityScore: 20,
        previousGeo: {
          country: 'DE',
          region: 'Berlin',
          city: 'Berlin',
          lat: 52.52,
          lng: 13.405,
        },
      }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.userId).toBe('user-123');
    expect(assessment.ip).toBe('192.168.1.1');
    expect(assessment.geo?.country).toBe('US');
    expect(assessment.geo?.region).toBe('CA');
    expect(assessment.geo?.city).toBe('San Francisco');
    expect(assessment.geo?.lat).toBe(37.7749);
    expect(assessment.geo?.lng).toBe(-122.4194);
    expect(assessment.device?.deviceId).toBe('device-full');
    expect(assessment.device?.platform).toBe('ios');
    expect(assessment.device?.os).toBe('iOS 17.0');
    expect(assessment.device?.browser).toBe('Safari');
    expect(assessment.device?.appVersion).toBe('1.0.0');
    expect(assessment.userAgent).toBe('Mozilla/5.0');
    expect(assessment.previousSessionId).toBe('session-456');
    expect(assessment.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(assessment.signals).toBeDefined();
    expect(assessment.signals?.['isVpn']).toBe(true);
    expect(assessment.signals?.['isTor']).toBe(false);
    expect(assessment.signals?.['asn']).toBe('AS12345');
    expect(assessment.signals?.['reputationScore']).toBe(80);
    expect(assessment.signals?.['velocityScore']).toBe(20);
    const previousGeo = assessment.signals?.['previousGeo'] as { country?: string; } | undefined;
    expect(previousGeo?.['country']).toBe('DE');
  });

  it('строит assessment без userId', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      ip: '192.168.1.1',
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.userId).toBeUndefined();
    expect(assessment.ip).toBe('192.168.1.1');
  });

  it('строит assessment без IP', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      userId: 'user-123',
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.userId).toBe('user-123');
    expect(assessment.ip).toBeUndefined();
  });

  it('строит assessment без geo', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      userId: 'user-123',
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.geo).toBeUndefined();
  });

  it('строит assessment с частичным geo', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      geo: {
        country: 'US',
      },
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.geo?.country).toBe('US');
    expect(assessment.geo?.region).toBeUndefined();
  });

  it('строит assessment без userAgent', () => {
    const deviceInfo = createDeviceInfo();
    // Удаляем userAgent из deviceInfo
    const { userAgent, ...deviceInfoWithoutUserAgent } = deviceInfo;
    const context = {};
    const assessment = buildAssessment(deviceInfoWithoutUserAgent, context);

    expect(assessment.userAgent).toBeUndefined();
  });

  it('строит assessment с userAgent из deviceInfo', () => {
    const deviceInfo = createDeviceInfo({
      userAgent: 'Mozilla/5.0',
    });
    const context = {};
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.userAgent).toBe('Mozilla/5.0');
  });

  it('строит assessment без previousSessionId', () => {
    const deviceInfo = createDeviceInfo();
    const context = {};
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.previousSessionId).toBeUndefined();
  });

  it('строит assessment без timestamp', () => {
    const deviceInfo = createDeviceInfo();
    const context = {};
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.timestamp).toBeUndefined();
  });

  it('строит assessment без signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {};
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals).toBeUndefined();
  });

  it('строит assessment с пустыми signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({}),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals).toBeUndefined();
  });

  it('строит assessment с signals (isVpn)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isVpn: true }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['isVpn']).toBe(true);
  });

  it('строит assessment с signals (isTor)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isTor: true }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['isTor']).toBe(true);
  });

  it('строит assessment с signals (isProxy)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isProxy: true }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['isProxy']).toBe(true);
  });

  it('строит assessment с signals (asn)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ asn: 'AS12345' }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['asn']).toBe('AS12345');
  });

  it('строит assessment с signals (reputationScore)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ reputationScore: 80 }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['reputationScore']).toBe(80);
  });

  it('строит assessment с signals (velocityScore)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ velocityScore: 75 }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['velocityScore']).toBe(75);
  });

  it('строит assessment с signals (previousGeo)', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({
        previousGeo: {
          country: 'DE',
          region: 'Berlin',
          city: 'Berlin',
          lat: 52.52,
          lng: 13.405,
        },
      }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    const previousGeo = assessment.signals?.['previousGeo'] as {
      country?: string;
      region?: string;
      city?: string;
      lat?: number;
      lng?: number;
    } | undefined;
    expect(previousGeo?.['country']).toBe('DE');
    expect(previousGeo?.['region']).toBe('Berlin');
    expect(previousGeo?.['city']).toBe('Berlin');
    expect(previousGeo?.['lat']).toBe(52.52);
    expect(previousGeo?.['lng']).toBe(13.405);
  });

  it('не включает externalSignals в assessment', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({
        isVpn: true,
        externalSignals: {
          vendorScore: 85,
          vendorFlags: ['suspicious'],
        },
      }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['isVpn']).toBe(true);
    expect(assessment.signals?.['externalSignals']).toBeUndefined();
    // Проверяем что externalSignals не попал в DTO
    expect('externalSignals' in (assessment.signals ?? {})).toBe(false);
  });

  it('применяет mapperPlugin для кастомных полей', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isVpn: true }),
    };
    const mapperPlugin: SignalsMapperPlugin = (signals, baseRecord) => ({
      ...baseRecord,
      customField: 'custom-value',
      customScore: signals.reputationScore ?? 0,
    });
    const assessment = buildAssessment(deviceInfo, context, mapperPlugin);

    expect(assessment.signals?.['isVpn']).toBe(true);
    expect(assessment.signals?.['customField']).toBe('custom-value');
    expect(assessment.signals?.['customScore']).toBe(0);
  });

  it('применяет mapperPlugin который возвращает пустой record', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isVpn: true }),
    };
    const mapperPlugin: SignalsMapperPlugin = () => ({});
    const assessment = buildAssessment(deviceInfo, context, mapperPlugin);

    expect(assessment.signals).toBeUndefined();
  });
});

// ============================================================================
// 🎯 TESTS - determinePlatformFromOS (через buildAssessment)
// ============================================================================

describe('determinePlatformFromOS', () => {
  it('определяет ios для iOS OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'iOS 17.0' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('ios');
  });

  it('определяет ios для iPhone OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'iPhone OS 17.0' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('ios');
  });

  it('определяет ios для iPad OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'iPad OS 17.0' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('ios');
  });

  it('определяет android для Android OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'Android 13' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('android');
  });

  it('определяет desktop для Windows OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'Windows 10' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('desktop');
  });

  it('определяет desktop для macOS OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'macOS 13.0' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('desktop');
  });

  it('определяет desktop для Linux OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'Linux' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('desktop');
  });

  it('определяет web для неизвестного OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'Unknown OS' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('web');
  });

  it('определяет desktop для undefined OS с deviceType=desktop', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-desktop',
      deviceType: 'desktop',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('desktop');
  });

  it('определяет web для undefined OS с deviceType=mobile', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-mobile',
      deviceType: 'mobile',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('web');
  });

  it('определяет web для undefined OS с deviceType=tablet', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-tablet',
      deviceType: 'tablet',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('web');
  });

  it('определяет web для undefined OS с deviceType=iot', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-iot',
      deviceType: 'iot',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('web');
  });

  it('определяет web для undefined OS с deviceType=unknown', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-unknown',
      deviceType: 'unknown',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('web');
  });

  it('обрабатывает case-insensitive OS', () => {
    const deviceInfo = createDeviceInfo({ os: 'ANDROID 13' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.platform).toBe('android');
  });
});

// ============================================================================
// 🎯 TESTS - mapDeviceInfoToRiskInfo (через buildAssessment)
// ============================================================================

describe('mapDeviceInfoToRiskInfo', () => {
  it('маппит deviceId', () => {
    const deviceInfo = createDeviceInfo({ deviceId: 'device-123' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.deviceId).toBe('device-123');
  });

  it('маппит os если указан', () => {
    const deviceInfo = createDeviceInfo({ os: 'Windows 10' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.os).toBe('Windows 10');
  });

  it('не маппит os если не указан', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-no-os',
      deviceType: 'desktop',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.os).toBeUndefined();
  });

  it('маппит browser если указан', () => {
    const deviceInfo = createDeviceInfo({ browser: 'Chrome' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.browser).toBe('Chrome');
  });

  it('не маппит browser если не указан', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-no-browser',
      deviceType: 'desktop',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.browser).toBeUndefined();
  });

  it('маппит appVersion если указан', () => {
    const deviceInfo = createDeviceInfo({ appVersion: '1.0.0' });
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.appVersion).toBe('1.0.0');
  });

  it('не маппит appVersion если не указан', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-no-app-version',
      deviceType: 'desktop',
    };
    const assessment = buildAssessment(deviceInfo, {});

    expect(assessment.device?.appVersion).toBeUndefined();
  });
});

// ============================================================================
// 🎯 TESTS - assertJsonSerializable (через mapSignalsToRecord)
// ============================================================================

describe('assertJsonSerializable', () => {
  it('выбрасывает ошибку для функции в signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: {
        isVpn: (): void => {},
      } as unknown as RiskSignals,
    };

    expect(() => buildAssessment(deviceInfo, context)).toThrow(
      'Field "isVpn" contains a function, which is not JSON-serializable',
    );
  });

  it('выбрасывает ошибку для символа в signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: {
        isVpn: Symbol('test'),
      } as unknown as RiskSignals,
    };

    expect(() => buildAssessment(deviceInfo, context)).toThrow(
      'Field "isVpn" contains a symbol, which is not JSON-serializable',
    );
  });

  it('выбрасывает ошибку для циклических ссылок в signals', () => {
    const deviceInfo = createDeviceInfo();
    const circular: Record<string, unknown> = { self: null };
    // eslint-disable-next-line fp/no-mutation -- намеренное создание циклической ссылки для теста
    circular['self'] = circular;
    const context = {
      signals: {
        previousGeo: circular,
      } as unknown as RiskSignals,
    };

    expect(() => buildAssessment(deviceInfo, context)).toThrow(
      'Field "previousGeo" is not JSON-serializable',
    );
  });

  it('выбрасывает ошибку для циклических ссылок в signals (другой тип ошибки)', () => {
    const deviceInfo = createDeviceInfo();
    const circular: Record<string, unknown> = { self: null };
    // eslint-disable-next-line fp/no-mutation -- намеренное создание циклической ссылки для теста
    circular['self'] = circular;
    const context = {
      signals: {
        previousGeo: circular,
      } as unknown as RiskSignals,
    };

    try {
      buildAssessment(deviceInfo, context);
      expect.fail('Должна была быть выброшена ошибка');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('not JSON-serializable');
      // Проверяем что ошибка содержит сообщение об ошибке JSON.stringify
      // eslint-disable-next-line functional/no-conditional-statements -- проверка типа в catch блоке, if более читабелен
      if (error instanceof Error) {
        expect(error.message).toBeTruthy();
      }
    }
  });

  it('принимает null значения', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: {
        asn: null,
      } as unknown as RiskSignals,
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['asn']).toBe(null);
  });

  it('принимает undefined значения', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({
        // isVpn не указан (undefined)
      }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['isVpn']).toBeUndefined();
  });

  it('обрабатывает default case в getSignalValueSafely', () => {
    const deviceInfo = createDeviceInfo();
    // Создаем signals с полем, которого нет в whitelist (через type assertion)
    const context = {
      signals: {
        isVpn: true,
        // externalSignals не в whitelist, но мы можем проверить default case
      } as RiskSignals,
    };
    const assessment = buildAssessment(deviceInfo, context);

    // externalSignals не должен попасть в DTO
    expect(assessment.signals?.['externalSignals']).toBeUndefined();
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('обрабатывает все типы device', () => {
    const deviceTypes: DeviceInfo['deviceType'][] = [
      'desktop',
      'mobile',
      'tablet',
      'iot',
      'unknown',
    ];
    const assessments = deviceTypes.map((deviceType) => {
      const deviceInfo = createDeviceInfo({ deviceType });
      return buildAssessment(deviceInfo, {});
    });
    assessments.forEach((assessment) => {
      expect(assessment.device).toBeDefined();
      expect(assessment.device?.deviceId).toBeDefined();
    });
  });

  it('обрабатывает все поля signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({
        isVpn: true,
        isTor: true,
        isProxy: true,
        asn: 'AS12345',
        reputationScore: 80,
        velocityScore: 75,
        previousGeo: {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          lat: 37.7749,
          lng: -122.4194,
        },
      }),
    };
    const assessment = buildAssessment(deviceInfo, context);

    expect(assessment.signals?.['isVpn']).toBe(true);
    expect(assessment.signals?.['isTor']).toBe(true);
    expect(assessment.signals?.['isProxy']).toBe(true);
    expect(assessment.signals?.['asn']).toBe('AS12345');
    expect(assessment.signals?.['reputationScore']).toBe(80);
    expect(assessment.signals?.['velocityScore']).toBe(75);
    const previousGeo = assessment.signals?.['previousGeo'] as { country?: string; } | undefined;
    expect(previousGeo?.['country']).toBe('US');
  });

  it('обрабатывает mapperPlugin который модифицирует существующие поля', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isVpn: true }),
    };
    const mapperPlugin: SignalsMapperPlugin = (_signals, baseRecord) => ({
      ...baseRecord,
      isVpn: false, // Переопределяет существующее поле
    });
    const assessment = buildAssessment(deviceInfo, context, mapperPlugin);

    expect(assessment.signals?.['isVpn']).toBe(false);
  });

  it('обрабатывает mapperPlugin который возвращает только новые поля', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({}),
    };
    const mapperPlugin: SignalsMapperPlugin = () => ({
      customField: 'custom-value',
    });
    const assessment = buildAssessment(deviceInfo, context, mapperPlugin);

    expect(assessment.signals?.['customField']).toBe('custom-value');
  });

  it('обрабатывает mapperPlugin с доступом к signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({
        isVpn: true,
        reputationScore: 80,
      }),
    };
    const mapperPlugin: SignalsMapperPlugin = (signalsParam) => ({
      isVpn: signalsParam.isVpn,
      reputationScore: signalsParam.reputationScore,
      customField: 'custom',
    });
    const assessment = buildAssessment(deviceInfo, context, mapperPlugin);

    expect(assessment.signals?.['isVpn']).toBe(true);
    expect(assessment.signals?.['reputationScore']).toBe(80);
    expect(assessment.signals?.['customField']).toBe('custom');
  });

  it('обрабатывает mapperPlugin который не возвращает signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = {
      signals: createRiskSignals({ isVpn: true }),
    };
    const mapperPlugin: SignalsMapperPlugin = () => ({
      // Возвращаем пустой объект, но с полем для проверки
      empty: true,
    });
    const assessment = buildAssessment(deviceInfo, context, mapperPlugin);

    expect(assessment.signals?.['empty']).toBe(true);
  });
});
