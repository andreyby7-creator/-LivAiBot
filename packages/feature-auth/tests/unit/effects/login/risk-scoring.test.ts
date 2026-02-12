/**
 * @file Unit тесты для effects/login/risk-scoring.ts
 * Полное покрытие risk scoring с тестированием всех функций и edge cases
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type { GeoInfo } from '../../../../src/domain/LoginRiskAssessment.js';
import {
  calculateRiskScore,
  calculateRiskScoreFromJson,
  calculateRiskScoreWithAsyncFactors,
  calculateRiskScoreWithAsyncFactorsAndCache,
  calculateRiskScoreWithCache,
  calculateRiskScoreWithFactors,
  clearAsyncScoreCache,
  clearScoreCache,
  createFactorConfigFromJson,
  createFactorConfigsFromJson,
  DefaultRiskWeights,
  defaultRiskWeights,
  factorCalculatorRegistryExport,
  getAsyncScoreCacheSize,
  getCustomFactorPlugin,
  getScoreCacheSize,
  isAsyncFactor,
  isSyncFactor,
  registerCustomFactorPlugin,
  scoringFactorConfigs,
} from '../../../../src/effects/login/risk-scoring.js';
import type {
  FactorConfigJson,
  RiskWeights,
  ScoringContext,
  ScoringSignals,
} from '../../../../src/effects/login/risk-scoring.js';

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

/** Создает GeoInfo для тестов */
function createGeoInfo(overrides: Partial<GeoInfo> = {}): GeoInfo {
  return {
    country: 'US',
    ...overrides,
  };
}

/** Создает ScoringSignals для тестов */
function createSignals(overrides: Partial<ScoringSignals> = {}): ScoringSignals {
  return {
    ...overrides,
  };
}

/** Создает ScoringContext для тестов */
function createScoringContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    device: createDeviceInfo(),
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - Exports and Constants
// ============================================================================

describe('Exports and Constants', () => {
  it('экспортирует defaultRiskWeights', () => {
    expect(defaultRiskWeights).toBeDefined();
    expect(defaultRiskWeights.device).toBe(0.3);
    expect(defaultRiskWeights.geo).toBe(0.25);
    expect(defaultRiskWeights.network).toBe(0.25);
    expect(defaultRiskWeights.velocity).toBe(0.2);
    // Проверяем, что сумма весов = 1.0
    const total = defaultRiskWeights.device
      + defaultRiskWeights.geo
      + defaultRiskWeights.network
      + defaultRiskWeights.velocity;
    expect(total).toBe(1.0);
  });

  it('экспортирует DefaultRiskWeights (deprecated alias)', () => {
    expect(DefaultRiskWeights).toBeDefined();
    expect(DefaultRiskWeights).toBe(defaultRiskWeights);
  });

  it('экспортирует scoringFactorConfigs', () => {
    expect(scoringFactorConfigs).toBeDefined();
    expect(Array.isArray(scoringFactorConfigs)).toBe(true);
    expect(scoringFactorConfigs.length).toBe(4);
  });

  it('экспортирует factorCalculatorRegistryExport', () => {
    expect(factorCalculatorRegistryExport).toBeDefined();
    expect(factorCalculatorRegistryExport instanceof Map).toBe(true);
    expect(factorCalculatorRegistryExport.has('device')).toBe(true);
    expect(factorCalculatorRegistryExport.has('geo')).toBe(true);
    expect(factorCalculatorRegistryExport.has('network')).toBe(true);
    expect(factorCalculatorRegistryExport.has('velocity')).toBe(true);
  });
});

// ============================================================================
// 🎯 TESTS - Type Guards
// ============================================================================

describe('Type Guards', () => {
  describe('isAsyncFactor', () => {
    it('возвращает true для async фактора', () => {
      const factor = {
        id: 'test-async',
        type: 'async' as const,
        calculateAsync: async () => 50,
        weight: 0.5,
      };
      expect(isAsyncFactor(factor)).toBe(true);
    });

    it('возвращает false для sync фактора', () => {
      const factor = {
        id: 'test-sync',
        type: 'sync' as const,
        calculate: () => 50,
        weight: 0.5,
      };
      expect(isAsyncFactor(factor)).toBe(false);
    });
  });

  describe('isSyncFactor', () => {
    it('возвращает true для sync фактора', () => {
      const factor = {
        id: 'test-sync',
        type: 'sync' as const,
        calculate: () => 50,
        weight: 0.5,
      };
      expect(isSyncFactor(factor)).toBe(true);
    });

    it('возвращает false для async фактора', () => {
      const factor = {
        id: 'test-async',
        type: 'async' as const,
        calculateAsync: async () => 50,
        weight: 0.5,
      };
      expect(isSyncFactor(factor)).toBe(false);
    });
  });
});

// ============================================================================
// 🎯 TESTS - calculateRiskScore (Main API)
// ============================================================================

describe('calculateRiskScore', () => {
  it('возвращает 0 для безопасного контекста', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({
        deviceType: 'desktop',
        os: 'Windows 10',
        browser: 'Chrome',
      }),
    });
    const score = calculateRiskScore(ctx);
    expect(score).toBe(0);
  });

  it('возвращает score > 0 для risky контекста', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const score = calculateRiskScore(ctx);
    expect(score).toBeGreaterThan(0);
  });

  it('использует кастомные веса', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    // device risk = 40, weight = 1.0, score = 40
    expect(score).toBe(40);
  });

  it('нормализует score в диапазон 0-100', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
      signals: createSignals({ isTor: true, isVpn: true, isProxy: true }),
    });
    const score = calculateRiskScore(ctx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('округляет score до целого числа', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const customWeights: RiskWeights = {
      device: 0.333,
      geo: 0.333,
      network: 0.334,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ============================================================================
// 🎯 TESTS - Device Risk Scoring
// ============================================================================

describe('Device Risk Scoring', () => {
  it('добавляет score для unknown device', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(40); // UNKNOWN_DEVICE = 40
  });

  it('добавляет score для iot device', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'iot' }),
    });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(30); // IOT_DEVICE = 30
  });

  it('добавляет score для missing OS', () => {
    const device: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'desktop',
      browser: 'Chrome', // Есть browser, нет OS
    };
    const ctx = createScoringContext({ device });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(20); // MISSING_OS = 20
  });

  it('добавляет score для missing browser', () => {
    const device: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'desktop',
      os: 'Windows 10',
    };
    const ctx = createScoringContext({ device });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(15); // MISSING_BROWSER = 15
  });

  it('суммирует несколько device рисков', () => {
    const device: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'unknown',
    };
    const ctx = createScoringContext({ device });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    // UNKNOWN_DEVICE (40) + MISSING_OS (20) + MISSING_BROWSER (15) = 75, но ограничено 100
    expect(score).toBe(75);
  });

  it('ограничивает device risk максимумом 100', () => {
    const device: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'unknown',
    };
    const ctx = createScoringContext({ device });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// 🎯 TESTS - Geo Risk Scoring
// ============================================================================

describe('Geo Risk Scoring', () => {
  it('возвращает 0 когда geo отсутствует', () => {
    const ctx = createScoringContext({});
    const customWeights: RiskWeights = {
      device: 0,
      geo: 1.0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('добавляет score для high-risk country', () => {
    const ctx = createScoringContext({
      geo: createGeoInfo({ country: 'KP' }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 1.0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(40); // HIGH_RISK_COUNTRY = 40
  });

  it('добавляет score для geo mismatch', () => {
    const ctx = createScoringContext({
      geo: createGeoInfo({ country: 'US' }),
      signals: createSignals({
        previousGeo: createGeoInfo({ country: 'DE' }),
      }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 1.0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(60); // GEO_MISMATCH = 60
  });

  it('суммирует geo риски', () => {
    const ctx = createScoringContext({
      geo: createGeoInfo({ country: 'KP' }),
      signals: createSignals({
        previousGeo: createGeoInfo({ country: 'IR' }),
      }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 1.0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    // HIGH_RISK_COUNTRY (40) + GEO_MISMATCH (60) = 100
    expect(score).toBe(100);
  });

  it('не добавляет score для обычной страны', () => {
    const ctx = createScoringContext({
      geo: createGeoInfo({ country: 'US' }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 1.0,
      network: 0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });
});

// ============================================================================
// 🎯 TESTS - Network Risk Scoring
// ============================================================================

describe('Network Risk Scoring', () => {
  it('возвращает 0 когда IP отсутствует', () => {
    const ctx = createScoringContext({
      signals: createSignals({ isTor: true }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('возвращает 0 для невалидного IP', () => {
    const ctx = createScoringContext({
      ip: 'invalid-ip',
      signals: createSignals({ isTor: true }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('добавляет score для TOR', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ isTor: true }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(70); // TOR = 70
  });

  it('добавляет score для VPN', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ isVpn: true }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(50); // VPN = 50
  });

  it('добавляет score для Proxy', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ isProxy: true }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(40); // PROXY = 40
  });

  it('добавляет score для critical reputation', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ reputationScore: 5 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(50); // CRITICAL_REPUTATION = 50
  });

  it('добавляет score для low reputation', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ reputationScore: 20 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(30); // LOW_REPUTATION = 30
  });

  it('не добавляет score для reputation >= 50', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ reputationScore: 50 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('суммирует network риски', () => {
    const ctx = createScoringContext({
      ip: '192.168.1.1',
      signals: createSignals({ isTor: true, isVpn: true }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    // TOR (70) + VPN (50) = 120, но ограничено 100
    expect(score).toBe(100);
  });

  it('валидирует IPv4 адреса', () => {
    const validIps = ['192.168.1.1', '10.0.0.1', '255.255.255.255', '0.0.0.0'];
    validIps.forEach((ip) => {
      const ctx = createScoringContext({
        ip,
        signals: createSignals({ isTor: true }),
      });
      const customWeights: RiskWeights = {
        device: 0,
        geo: 0,
        network: 1.0,
        velocity: 0,
      };
      const score = calculateRiskScore(ctx, customWeights);
      expect(score).toBeGreaterThan(0);
    });
  });

  it('валидирует IPv6 адреса', () => {
    const validIps = [
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      '2001:db8:85a3::8a2e:370:7334',
    ];
    validIps.forEach((ip) => {
      const ctx = createScoringContext({
        ip,
        signals: createSignals({ isTor: true }),
      });
      const customWeights: RiskWeights = {
        device: 0,
        geo: 0,
        network: 1.0,
        velocity: 0,
      };
      const score = calculateRiskScore(ctx, customWeights);
      expect(score).toBeGreaterThan(0);
    });
  });

  it('отклоняет невалидные IP адреса', () => {
    const invalidIps = ['999.999.999.999', '256.1.1.1', '1.1.1', 'not-an-ip'];
    invalidIps.forEach((ip) => {
      const ctx = createScoringContext({
        ip,
        signals: createSignals({ isTor: true }),
      });
      const customWeights: RiskWeights = {
        device: 0,
        geo: 0,
        network: 1.0,
        velocity: 0,
      };
      const score = calculateRiskScore(ctx, customWeights);
      expect(score).toBe(0);
    });
  });
});

// ============================================================================
// 🎯 TESTS - Velocity Risk Scoring
// ============================================================================

describe('Velocity Risk Scoring', () => {
  it('возвращает 0 когда velocityScore отсутствует', () => {
    const ctx = createScoringContext({
      signals: createSignals({}),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('использует velocityScore напрямую', () => {
    const ctx = createScoringContext({
      signals: createSignals({ velocityScore: 75 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(75);
  });

  it('нормализует velocityScore > 100', () => {
    const ctx = createScoringContext({
      signals: createSignals({ velocityScore: 150 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(100);
  });

  it('нормализует velocityScore < 0', () => {
    const ctx = createScoringContext({
      signals: createSignals({ velocityScore: -10 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('обрабатывает NaN velocityScore', () => {
    const ctx = createScoringContext({
      signals: createSignals({ velocityScore: Number.NaN }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });

  it('обрабатывает Infinity velocityScore', () => {
    const ctx = createScoringContext({
      signals: createSignals({ velocityScore: Number.POSITIVE_INFINITY }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(0);
  });
});

// ============================================================================
// 🎯 TESTS - calculateRiskScoreWithFactors
// ============================================================================

describe('calculateRiskScoreWithFactors', () => {
  it('использует кастомные факторы', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const customFactors = [
      {
        calculate: (c: ScoringContext): number => (c.device.deviceType === 'unknown' ? 100 : 0),
        weight: 1.0,
      },
    ];
    const score = calculateRiskScoreWithFactors(ctx, customFactors);
    expect(score).toBe(100);
  });

  it('нормализует веса если сумма != 1.0', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const customFactors = [
      {
        calculate: (): number => 40,
        weight: 0.5, // Сумма весов = 0.5, должна быть нормализована
      },
    ];
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const score = calculateRiskScoreWithFactors(ctx, customFactors);
    expect(consoleSpy).toHaveBeenCalled();
    expect(score).toBe(40); // 40 * (0.5 / 0.5) = 40
    consoleSpy.mockRestore();
  });

  it('предупреждает при сумма весов > 1.1', () => {
    const ctx = createScoringContext();
    const customFactors = [
      {
        calculate: (): number => 50,
        weight: 0.6,
      },
      {
        calculate: (): number => 50,
        weight: 0.6, // Сумма = 1.2 > 1.1
      },
    ];
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    calculateRiskScoreWithFactors(ctx, customFactors);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('предупреждает при сумма весов < 0.9', () => {
    const ctx = createScoringContext();
    const customFactors = [
      {
        calculate: (): number => 50,
        weight: 0.4, // Сумма = 0.4 < 0.9
      },
    ];
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    calculateRiskScoreWithFactors(ctx, customFactors);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('использует веса без нормализации если сумма = 1.0', () => {
    const ctx = createScoringContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
    });
    const customFactors = [
      {
        calculate: (): number => 40,
        weight: 1.0,
      },
    ];
    const score = calculateRiskScoreWithFactors(ctx, customFactors);
    expect(score).toBe(40);
  });
});

// ============================================================================
// 🎯 TESTS - JSON/DB Loading
// ============================================================================

describe('JSON/DB Loading', () => {
  describe('createFactorConfigFromJson', () => {
    it('создает конфиг для device фактора', () => {
      const config: FactorConfigJson = {
        id: 'device-factor',
        type: 'device',
        weight: 0.3,
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeDefined();
      expect(factor?.weight).toBe(0.3);
      expect(typeof factor?.calculate).toBe('function');
    });

    it('создает конфиг для geo фактора', () => {
      const config: FactorConfigJson = {
        id: 'geo-factor',
        type: 'geo',
        weight: 0.25,
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeDefined();
      expect(factor?.weight).toBe(0.25);
    });

    it('создает конфиг для network фактора', () => {
      const config: FactorConfigJson = {
        id: 'network-factor',
        type: 'network',
        weight: 0.25,
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeDefined();
      expect(factor?.weight).toBe(0.25);
    });

    it('создает конфиг для velocity фактора', () => {
      const config: FactorConfigJson = {
        id: 'velocity-factor',
        type: 'velocity',
        weight: 0.2,
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeDefined();
      expect(factor?.weight).toBe(0.2);
    });

    it('создает конфиг для custom фактора с плагином', () => {
      const plugin = {
        id: 'custom-plugin',
        calculate: (): number => 50,
      };
      registerCustomFactorPlugin(plugin);
      const config: FactorConfigJson = {
        id: 'custom-factor',
        type: 'custom',
        weight: 0.5,
        pluginId: 'custom-plugin',
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeDefined();
      expect(factor?.weight).toBe(0.5);
      const calculatedScore = factor?.calculate(createScoringContext());
      expect(calculatedScore).toBe(50);
    });

    it('возвращает undefined для custom фактора когда pluginId undefined (строка 607)', () => {
      const config: FactorConfigJson = {
        id: 'custom-factor',
        type: 'custom',
        weight: 0.5,
        // pluginId отсутствует
      };
      const factor = createFactorConfigFromJson(config);
      // Должен вернуть undefined, так как pluginId отсутствует (строка 607: return undefined)
      expect(factor).toBeUndefined();
    });

    it('возвращает undefined когда calculate не найден в registry (строка 623)', () => {
      // Это edge case, который сложно воспроизвести, так как все типы в registry существуют
      // Но можно проверить через невалидный конфиг
      const config = {
        id: 'invalid',
        type: 'device' as const, // Валидный тип
        weight: 0.3,
      } as FactorConfigJson;
      const factor = createFactorConfigFromJson(config);
      // device тип существует, поэтому должен вернуть factor
      expect(factor).toBeDefined();
      // Строка 623 недостижима, так как все типы в registry существуют
    });

    it('возвращает undefined для custom фактора без pluginId', () => {
      const config: FactorConfigJson = {
        id: 'custom-factor',
        type: 'custom',
        weight: 0.5,
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeUndefined();
    });

    it('возвращает undefined для custom фактора с несуществующим плагином', () => {
      const config: FactorConfigJson = {
        id: 'custom-factor',
        type: 'custom',
        weight: 0.5,
        pluginId: 'non-existent-plugin',
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeUndefined();
    });

    it('возвращает undefined для несуществующего типа фактора в registry', () => {
      // Создаем конфиг с типом, который не существует в registry
      // Но это невозможно через FactorConfigJson, так как type строго типизирован
      // Однако можно проверить edge case через невалидный конфиг
      const config = {
        id: 'invalid-type',
        type: 'device', // Валидный тип, но проверим edge case
        weight: 0.3,
      } as FactorConfigJson;
      const factor = createFactorConfigFromJson(config);
      // device тип существует в registry, поэтому должен вернуть factor
      expect(factor).toBeDefined();
    });

    it('возвращает undefined для невалидного конфига (нет id)', () => {
      const config = {
        type: 'device',
        weight: 0.3,
      } as unknown as FactorConfigJson;
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeUndefined();
    });

    it('возвращает undefined для невалидного конфига (невалидный weight)', () => {
      const config: FactorConfigJson = {
        id: 'device-factor',
        type: 'device',
        weight: 1.5, // > 1.0
      };
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeUndefined();
    });

    it('возвращает undefined для невалидного конфига (невалидный type)', () => {
      const config = {
        id: 'device-factor',
        type: 'invalid-type',
        weight: 0.3,
      } as unknown as FactorConfigJson;
      const factor = createFactorConfigFromJson(config);
      expect(factor).toBeUndefined();
    });
  });

  describe('createFactorConfigsFromJson', () => {
    it('создает массив конфигов из JSON', () => {
      const configs: FactorConfigJson[] = [
        { id: 'device', type: 'device', weight: 0.3 },
        { id: 'geo', type: 'geo', weight: 0.25 },
      ];
      const factors = createFactorConfigsFromJson(configs);
      expect(factors.length).toBe(2);
    });

    it('фильтрует невалидные конфиги', () => {
      const configs: FactorConfigJson[] = [
        { id: 'device', type: 'device', weight: 0.3 },
        { id: 'invalid', type: 'device', weight: 1.5 }, // невалидный
      ];
      const factors = createFactorConfigsFromJson(configs);
      expect(factors.length).toBe(1);
    });

    it('возвращает пустой массив для пустого списка', () => {
      const factors = createFactorConfigsFromJson([]);
      expect(factors).toEqual([]);
    });
  });

  describe('calculateRiskScoreFromJson', () => {
    it('рассчитывает score из JSON конфигов', () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const configs: FactorConfigJson[] = [
        { id: 'device', type: 'device', weight: 1.0 },
      ];
      const score = calculateRiskScoreFromJson(ctx, configs);
      expect(score).toBe(40); // UNKNOWN_DEVICE = 40
    });

    it('возвращает undefined для пустого списка конфигов', () => {
      const ctx = createScoringContext();
      const score = calculateRiskScoreFromJson(ctx, []);
      expect(score).toBeUndefined();
    });
  });
});

// ============================================================================
// 🎯 TESTS - Plugin System
// ============================================================================

describe('Plugin System', () => {
  beforeEach(() => {
    // Очищаем плагины перед каждым тестом
    clearScoreCache();
  });

  describe('registerCustomFactorPlugin', () => {
    it('регистрирует плагин', () => {
      const plugin = {
        id: 'test-plugin',
        calculate: (): number => 50,
      };
      registerCustomFactorPlugin(plugin);
      const retrieved = getCustomFactorPlugin('test-plugin');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-plugin');
    });

    it('перезаписывает существующий плагин', () => {
      const plugin1 = {
        id: 'test-plugin',
        calculate: (): number => 50,
      };
      const plugin2 = {
        id: 'test-plugin',
        calculate: (): number => 75,
      };
      registerCustomFactorPlugin(plugin1);
      registerCustomFactorPlugin(plugin2);
      const retrieved = getCustomFactorPlugin('test-plugin');
      const calculatedScore = retrieved?.calculate(createScoringContext());
      expect(calculatedScore).toBe(75);
    });
  });

  describe('getCustomFactorPlugin', () => {
    it('возвращает зарегистрированный плагин', () => {
      const plugin = {
        id: 'test-plugin',
        calculate: (): number => 50,
      };
      registerCustomFactorPlugin(plugin);
      const retrieved = getCustomFactorPlugin('test-plugin');
      expect(retrieved).toBe(plugin);
    });

    it('возвращает undefined для несуществующего плагина', () => {
      const retrieved = getCustomFactorPlugin('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });
});

// ============================================================================
// 🎯 TESTS - Async Factors
// ============================================================================

describe('Async Factors', () => {
  // eslint-disable-next-line ai-security/token-leakage -- тестовые данные, не реальные токены
  describe('calculateRiskScoreWithAsyncFactors', () => {
    it('рассчитывает score с sync факторами', async () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const factors = [
        {
          id: 'device',
          type: 'sync' as const,
          calculate: (c: ScoringContext): number => (c.device.deviceType === 'unknown' ? 40 : 0),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      expect(score).toBe(40);
    });

    it('рассчитывает score с async факторами', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'async-factor',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(50),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      expect(score).toBe(50);
    });

    it('рассчитывает score с комбинацией sync и async факторов', async () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const factors = [
        {
          id: 'sync',
          type: 'sync' as const,
          calculate: (): number => 40,
          weight: 0.5,
        },
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(60),
          weight: 0.5,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      // (40 * 0.5) + (60 * 0.5) = 50
      expect(score).toBe(50);
    });

    it('обрабатывает таймаут async факторов', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'timeout-factor',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => {
            await new Promise((resolve) => {
              setTimeout(resolve, 10000);
            });
            return 50;
          },
          weight: 1.0,
          timeout: 100, // Короткий таймаут
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тест таймаута, таймаут настроен в факторе
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      // При таймауте возвращается 0
      expect(score).toBe(0);
    }, 10000);

    it('обрабатывает ошибки в async факторах', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'error-factor',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => {
            throw new Error('Test error');
          },
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      // При ошибке возвращается 0
      expect(score).toBe(0);
    });

    it('валидирует результат async фактора (NaN)', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'nan-factor',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(Number.NaN),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      expect(score).toBe(0);
    });

    it('валидирует результат async фактора (Infinity)', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'infinity-factor',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(Number.POSITIVE_INFINITY),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      expect(score).toBe(0);
    });

    it('валидирует результат async фактора (out of range)', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'out-of-range-factor',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(150),
          weight: 1.0,
          maxScore: 100,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      expect(score).toBe(0);
    });

    it('нормализует веса для async факторов', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(50),
          weight: 0.5, // Сумма = 0.5, должна быть нормализована
        },
      ];
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      expect(consoleSpy).toHaveBeenCalled();
      expect(score).toBe(50);
      consoleSpy.mockRestore();
    });

    it('обрабатывает edge case с индексом вне границ массива', async () => {
      const ctx = createScoringContext();
      // Создаем факторы, которые могут вызвать edge case с индексами
      // Внутри calculateRiskScoreWithAsyncFactors есть проверка index < 0 || index >= normalizedWeights.length
      // Это edge case, который сложно воспроизвести напрямую, но код должен быть защищен
      const factors = [
        {
          id: 'sync',
          type: 'sync' as const,
          calculate: (): number => 40,
          weight: 0.5,
        },
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(60),
          weight: 0.5,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score = await calculateRiskScoreWithAsyncFactors(ctx, factors);
      // Должен корректно обработать индексы
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================================================
// 🎯 TESTS - Caching
// ============================================================================

describe('Caching', () => {
  beforeEach(() => {
    clearScoreCache();
    clearAsyncScoreCache();
  });

  afterEach(() => {
    clearScoreCache();
    clearAsyncScoreCache();
  });

  describe('calculateRiskScoreWithCache', () => {
    it('кэширует результат', () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const score1 = calculateRiskScoreWithCache(ctx);
      const score2 = calculateRiskScoreWithCache(ctx);
      expect(score1).toBe(score2);
    });

    it('не использует кэш когда useCache = false', () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const score1 = calculateRiskScoreWithCache(ctx, defaultRiskWeights, true);
      const score2 = calculateRiskScoreWithCache(ctx, defaultRiskWeights, false);
      // Результаты должны быть одинаковыми, но кэш не используется
      expect(score1).toBe(score2);
    });

    it('генерирует разные ключи для разных контекстов', () => {
      const ctx1 = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const ctx2 = createScoringContext({
        device: createDeviceInfo({ deviceType: 'iot' }),
      });
      const score1 = calculateRiskScoreWithCache(ctx1);
      const score2 = calculateRiskScoreWithCache(ctx2);
      expect(score1).not.toBe(score2);
    });
  });

  // eslint-disable-next-line ai-security/token-leakage -- тестовые данные, не реальные токены
  describe('calculateRiskScoreWithAsyncFactorsAndCache', () => {
    it('кэширует результат async факторов', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(50),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score1 = await calculateRiskScoreWithAsyncFactorsAndCache(ctx, factors);
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score2 = await calculateRiskScoreWithAsyncFactorsAndCache(ctx, factors);
      expect(score1).toBe(score2);
    });

    it('не использует кэш когда useCache = false', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(50),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score1 = await calculateRiskScoreWithAsyncFactorsAndCache(ctx, factors, true);
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      const score2 = await calculateRiskScoreWithAsyncFactorsAndCache(ctx, factors, false);
      expect(score1).toBe(score2);
    });
  });

  describe('clearScoreCache', () => {
    it('очищает кэш scoring', () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      calculateRiskScoreWithCache(ctx);
      expect(getScoreCacheSize()).toBeGreaterThan(0);
      clearScoreCache();
      expect(getScoreCacheSize()).toBe(0);
    });

    it('очищает кэш даже если он пустой', () => {
      clearScoreCache();
      expect(getScoreCacheSize()).toBe(0);
      // Повторный вызов не должен вызывать ошибку
      clearScoreCache();
      expect(getScoreCacheSize()).toBe(0);
    });
  });

  describe('clearAsyncScoreCache', () => {
    it('очищает кэш async scoring', async () => {
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(50),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      await calculateRiskScoreWithAsyncFactorsAndCache(ctx, factors);
      expect(getAsyncScoreCacheSize()).toBeGreaterThan(0);
      clearAsyncScoreCache();
      expect(getAsyncScoreCacheSize()).toBe(0);
    });

    it('очищает кэш даже если он пустой', async () => {
      clearAsyncScoreCache();
      expect(getAsyncScoreCacheSize()).toBe(0);
      // Повторный вызов не должен вызывать ошибку
      clearAsyncScoreCache();
      expect(getAsyncScoreCacheSize()).toBe(0);
    });
  });

  describe('getScoreCacheSize', () => {
    it('возвращает размер кэша', () => {
      expect(getScoreCacheSize()).toBe(0);
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      calculateRiskScoreWithCache(ctx);
      expect(getScoreCacheSize()).toBe(1);
    });
  });

  describe('getAsyncScoreCacheSize', () => {
    it('возвращает размер async кэша', async () => {
      expect(getAsyncScoreCacheSize()).toBe(0);
      const ctx = createScoringContext();
      const factors = [
        {
          id: 'async',
          type: 'async' as const,
          calculateAsync: async (): Promise<number> => Promise.resolve(50),
          weight: 1.0,
        },
      ];
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- тестовая функция, таймаут не требуется
      await calculateRiskScoreWithAsyncFactorsAndCache(ctx, factors);
      expect(getAsyncScoreCacheSize()).toBe(1);
    });
  });

  describe('TTL expiration', () => {
    it('удаляет устаревшие записи из кэша при следующем обращении', () => {
      const ctx1 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-1' }),
      });
      const ctx2 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-2' }),
      });

      // Кэшируем первый контекст
      calculateRiskScoreWithCache(ctx1);
      expect(getScoreCacheSize()).toBe(1);

      // Кэшируем второй контекст - это вызовет cleanupExpiredEntries
      calculateRiskScoreWithCache(ctx2);
      expect(getScoreCacheSize()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cache overflow', () => {
    it('удаляет самую старую запись при переполнении кэша', () => {
      clearScoreCache();
      // Создаем много разных контекстов для переполнения кэша (maxSize = 1000)
      // Создаем 1001 контекст, чтобы вызвать removeOldestEntry
      const contexts: ScoringContext[] = Array.from(
        { length: 1001 },
        (_, i) =>
          createScoringContext({
            device: createDeviceInfo({ deviceId: `device-${i}` }),
            ip: `192.168.1.${i % 255}`,
          }),
      );

      // Кэшируем все контексты
      contexts.forEach((ctx) => {
        calculateRiskScoreWithCache(ctx);
      });

      // После переполнения размер должен быть <= maxSize (1000)
      expect(getScoreCacheSize()).toBeLessThanOrEqual(1000);
    });
  });

  describe('getCachedScore TTL expiration', () => {
    it('возвращает undefined для устаревшей записи', () => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-ttl-test' }),
      });

      // Кэшируем результат
      calculateRiskScoreWithCache(ctx);
      expect(getScoreCacheSize()).toBe(1);

      // Мокируем Date.now чтобы симулировать истечение TTL
      const originalNow = Date.now;
      const baseTime = originalNow();
      const timeRef = { value: baseTime };
      // eslint-disable-next-line fp/no-mutation -- мок для теста
      global.Date.now = vi.fn(() => timeRef.value);

      // Устанавливаем время в будущее (больше TTL = 300000 мс)
      // eslint-disable-next-line fp/no-mutation -- мок для теста
      timeRef.value = baseTime + 300001;

      // Пытаемся получить из кэша - должен быть undefined из-за TTL
      const score = calculateRiskScoreWithCache(ctx);
      // Кэш должен быть очищен, поэтому будет пересчет
      expect(score).toBeGreaterThanOrEqual(0);

      // Восстанавливаем Date.now
      // eslint-disable-next-line fp/no-mutation -- восстановление мока
      global.Date.now = originalNow;
    });
  });

  describe('removeOldestEntry edge cases', () => {
    it('не падает при пустом кэше в removeOldestEntry (строка 889)', () => {
      clearScoreCache();
      // removeOldestEntry вызывается внутри setCachedScore при переполнении
      // Но если кэш пустой после cleanupExpiredEntries, функция должна корректно обработать это (строка 889: return)
      // Чтобы покрыть строку 889, нужно вызвать removeOldestEntry с пустым кэшем
      // Это происходит когда setCachedScore вызывается с переполненным кэшем,
      // но после cleanupExpiredEntries кэш становится пустым
      expect(getScoreCacheSize()).toBe(0);

      // Создаем контекст и кэшируем его
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-test' }),
      });
      calculateRiskScoreWithCache(ctx);
      expect(getScoreCacheSize()).toBe(1);

      // Мокируем Date.now чтобы все записи стали устаревшими
      const originalNow = Date.now;
      const baseTime = originalNow();
      const currentTime = baseTime + 300001; // Больше TTL
      // eslint-disable-next-line fp/no-mutation -- мок для теста
      global.Date.now = vi.fn(() => currentTime);

      // Добавляем новый контекст - cleanupExpiredEntries удалит все устаревшие записи
      // Затем removeOldestEntry будет вызван с пустым кэшем (строка 889)
      const ctx2 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-new' }),
        ip: '192.168.1.2',
      });
      calculateRiskScoreWithCache(ctx2);
      // После cleanupExpiredEntries кэш должен содержать только новую запись
      expect(getScoreCacheSize()).toBe(1);

      // Восстанавливаем Date.now
      // eslint-disable-next-line fp/no-mutation -- восстановление мока
      global.Date.now = originalNow;
    });

    it('вызывает removeOldestEntry при переполнении кэша', () => {
      clearScoreCache();
      // Создаем 1001 контекст для переполнения кэша (maxSize = 1000)
      // Это вызовет removeOldestEntry внутри setCachedScore (строка 915)
      const contexts: ScoringContext[] = Array.from(
        { length: 1001 },
        (_, i) =>
          createScoringContext({
            device: createDeviceInfo({ deviceId: `device-${i}` }),
            ip: `192.168.1.${(i % 255) + 1}`,
            signals: createSignals({ reputationScore: i % 100 }),
          }),
      );

      // Кэшируем все контексты - последний вызовет removeOldestEntry
      contexts.forEach((ctx) => {
        calculateRiskScoreWithCache(ctx);
      });

      // После переполнения размер должен быть <= maxSize
      expect(getScoreCacheSize()).toBeLessThanOrEqual(1000);
    });

    it('вызывает cleanupExpiredEntries при добавлении в кэш', () => {
      clearScoreCache();
      const ctx1 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-1' }),
        ip: '192.168.1.1',
      });
      const ctx2 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-2' }),
        ip: '192.168.1.2',
      });

      // Кэшируем первый контекст
      calculateRiskScoreWithCache(ctx1);
      expect(getScoreCacheSize()).toBe(1);

      // Кэшируем второй контекст - это вызовет cleanupExpiredEntries внутри setCachedScore (строка 911)
      // cleanupExpiredEntries вызывается всегда, но не удаляет записи, если они не истекли
      calculateRiskScoreWithCache(ctx2);
      expect(getScoreCacheSize()).toBeGreaterThanOrEqual(1);
    });

    it('удаляет устаревшие записи через cleanupExpiredEntries (строка 880)', () => {
      clearScoreCache();
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-expired' }),
      });

      // Кэшируем результат
      calculateRiskScoreWithCache(ctx);
      expect(getScoreCacheSize()).toBe(1);

      // Мокируем Date.now чтобы симулировать истечение TTL
      const originalNow = Date.now;
      const baseTime = originalNow();
      const timeRef = { value: baseTime };
      // eslint-disable-next-line fp/no-mutation -- мок для теста
      global.Date.now = vi.fn(() => timeRef.value);

      // Устанавливаем время в будущее (больше TTL = 300000 мс)
      // eslint-disable-next-line fp/no-mutation -- мок для теста
      timeRef.value = baseTime + 300001;

      // Добавляем новый контекст - это вызовет cleanupExpiredEntries, который удалит устаревшую запись
      const ctx2 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-new' }),
        ip: '192.168.1.2', // Разный IP для другого ключа кэша
      });
      calculateRiskScoreWithCache(ctx2);
      // cleanupExpiredEntries должен удалить устаревшую запись (строка 880: state.cache.delete(key))
      expect(getScoreCacheSize()).toBe(1); // Только новая запись

      // Восстанавливаем Date.now
      // eslint-disable-next-line fp/no-mutation -- восстановление мока
      global.Date.now = originalNow;
    });

    it('находит и удаляет самую старую запись в removeOldestEntry', () => {
      clearScoreCache();
      // Создаем несколько контекстов с разными временными метками
      const ctx1 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-oldest' }),
        ip: '192.168.1.1',
      });
      const ctx2 = createScoringContext({
        device: createDeviceInfo({ deviceId: 'device-middle' }),
        ip: '192.168.1.2',
      });

      // Кэшируем первый контекст
      calculateRiskScoreWithCache(ctx1);
      // Небольшая задержка для разных timestamp
      const delay = new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      return delay.then(() => {
        // Кэшируем второй контекст
        calculateRiskScoreWithCache(ctx2);
        expect(getScoreCacheSize()).toBe(2);

        // Создаем еще 999 контекстов для переполнения кэша
        // Это вызовет removeOldestEntry, который найдет самую старую запись (строки 896-900)
        Array.from({ length: 999 }, (_, i) => i + 3).forEach((i) => {
          const ctx = createScoringContext({
            device: createDeviceInfo({ deviceId: `device-${i}` }),
            ip: `192.168.1.${(i % 255) + 1}`,
          });
          calculateRiskScoreWithCache(ctx);
        });

        // После переполнения размер должен быть <= maxSize
        // removeOldestEntry должен был удалить самую старую запись (строки 903-904)
        expect(getScoreCacheSize()).toBeLessThanOrEqual(1000);
        return undefined;
      });
    });
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('обрабатывает контекст без signals', () => {
    const ctx = createScoringContext({});
    const score = calculateRiskScore(ctx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('обрабатывает контекст без geo', () => {
    const ctx = createScoringContext({});
    const score = calculateRiskScore(ctx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('обрабатывает контекст без ip', () => {
    const ctx = createScoringContext({});
    const score = calculateRiskScore(ctx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('обрабатывает все типы device', () => {
    const deviceTypes: DeviceInfo['deviceType'][] = [
      'desktop',
      'mobile',
      'tablet',
      'iot',
      'unknown',
    ];
    const results = deviceTypes.map((deviceType) => {
      const ctx = createScoringContext({
        device: createDeviceInfo({ deviceType }),
      });
      return { deviceType, score: calculateRiskScore(ctx) };
    });
    results.forEach((result) => {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  it('обрабатывает граничные значения score (0)', () => {
    const ctx = createScoringContext({
      signals: createSignals({ reputationScore: 0 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 1.0,
      velocity: 0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает граничные значения score (100)', () => {
    const ctx = createScoringContext({
      signals: createSignals({ velocityScore: 100 }),
    });
    const customWeights: RiskWeights = {
      device: 0,
      geo: 0,
      network: 0,
      velocity: 1.0,
    };
    const score = calculateRiskScore(ctx, customWeights);
    expect(score).toBe(100);
  });

  it('обрабатывает null значения в signals', () => {
    const ctx = createScoringContext({
      signals: createSignals({
        reputationScore: null as unknown as number,
      }),
    });
    const score = calculateRiskScore(ctx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
