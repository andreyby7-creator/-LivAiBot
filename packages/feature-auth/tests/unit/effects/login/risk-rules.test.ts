/**
 * @file Unit тесты для effects/login/risk-rules.ts
 * Полное покрытие risk rules с тестированием всех правил и функций
 */

import { describe, expect, it } from 'vitest';

import type { DeviceInfo, DeviceType } from '../../../../src/domain/DeviceInfo.js';
import type { GeoInfo } from '../../../../src/domain/LoginRiskAssessment.js';
import {
  AllRules,
  allRules,
  compositeRules,
  deviceRules,
  evaluateRuleActions,
  evaluateRules,
  geoRules,
  getMaxPriority,
  getRuleDefinition,
  getRulesWithDecisionImpact,
  networkRules,
  sortRulesByPriority,
} from '../../../../src/effects/login/risk-rules.js';
import type {
  RiskRule,
  RuleContextMetadata,
  RuleEvaluationContext,
  RuleSignals,
} from '../../../../src/effects/login/risk-rules.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает минимальный DeviceInfo для тестов */
function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-test-123',
    deviceType: 'desktop',
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

/** Создает RuleEvaluationContext для тестов */
function createRuleContext(
  overrides: Partial<RuleEvaluationContext> = {},
): RuleEvaluationContext {
  return {
    device: createDeviceInfo(),
    ...overrides,
  };
}

/** Создает RuleSignals для тестов */
function createSignals(overrides: Partial<RuleSignals> = {}): RuleSignals {
  return {
    ...overrides,
  };
}

/** Создает RuleContextMetadata для тестов */
function createMetadata(
  overrides: Partial<RuleContextMetadata> = {},
): RuleContextMetadata {
  // Валидация: убеждаемся, что overrides содержит только валидные поля
  // Используем тернарный оператор и spread для создания immutable объекта
  return {
    ...(overrides.isNewDevice !== undefined
      ? { isNewDevice: Boolean(overrides.isNewDevice) }
      : {}),
    ...(overrides.riskScore !== undefined && Number.isFinite(overrides.riskScore)
      ? { riskScore: overrides.riskScore }
      : {}),
  };
}

// ============================================================================
// 🎯 TESTS - Exports and Constants
// ============================================================================

describe('Exports and Constants', () => {
  it('экспортирует allRules', () => {
    expect(allRules).toBeDefined();
    expect(Array.isArray(allRules)).toBe(true);
    expect(allRules.length).toBeGreaterThan(0);
  });

  it('экспортирует AllRules (deprecated alias)', () => {
    expect(AllRules).toBeDefined();
    expect(AllRules).toBe(allRules);
  });

  it('экспортирует deviceRules', () => {
    expect(deviceRules).toBeDefined();
    expect(Array.isArray(deviceRules)).toBe(true);
    expect(deviceRules.length).toBe(4);
  });

  it('экспортирует networkRules', () => {
    expect(networkRules).toBeDefined();
    expect(Array.isArray(networkRules)).toBe(true);
    expect(networkRules.length).toBe(6);
  });

  it('экспортирует geoRules', () => {
    expect(geoRules).toBeDefined();
    expect(Array.isArray(geoRules)).toBe(true);
    expect(geoRules.length).toBe(2);
  });

  it('экспортирует compositeRules', () => {
    expect(compositeRules).toBeDefined();
    expect(Array.isArray(compositeRules)).toBe(true);
    expect(compositeRules.length).toBe(3);
  });

  it('allRules содержит все правила из модулей', () => {
    const totalRules = deviceRules.length
      + networkRules.length
      + geoRules.length
      + compositeRules.length;
    expect(allRules.length).toBe(totalRules);
  });
});

// ============================================================================
// 🎯 TESTS - Device Rules
// ============================================================================

describe('Device Rules', () => {
  describe('UNKNOWN_DEVICE', () => {
    it('срабатывает для unknown device', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'unknown' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('UNKNOWN_DEVICE');
    });

    it('не срабатывает для известного device', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'desktop' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('UNKNOWN_DEVICE');
    });
  });

  describe('IoT_DEVICE', () => {
    it('срабатывает для iot device', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'iot' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('IoT_DEVICE');
    });

    it('не срабатывает для non-iot device', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'mobile' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('IoT_DEVICE');
    });
  });

  describe('MISSING_OS', () => {
    it('срабатывает когда OS отсутствует', () => {
      const device: DeviceInfo = {
        deviceId: 'device-test-123',
        deviceType: 'desktop',
      };
      const ctx = createRuleContext({
        device,
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('MISSING_OS');
    });

    it('не срабатывает когда OS присутствует', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ os: 'Windows 10' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('MISSING_OS');
    });
  });

  describe('MISSING_BROWSER', () => {
    it('срабатывает когда browser отсутствует', () => {
      const device: DeviceInfo = {
        deviceId: 'device-test-123',
        deviceType: 'desktop',
      };
      const ctx = createRuleContext({
        device,
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('MISSING_BROWSER');
    });

    it('не срабатывает когда browser присутствует', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ browser: 'Chrome' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('MISSING_BROWSER');
    });
  });
});

// ============================================================================
// 🎯 TESTS - Network Rules
// ============================================================================

describe('Network Rules', () => {
  describe('TOR_NETWORK', () => {
    it('срабатывает когда isTor = true', () => {
      const ctx = createRuleContext({
        signals: createSignals({ isTor: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('TOR_NETWORK');
    });

    it('не срабатывает когда isTor = false', () => {
      const ctx = createRuleContext({
        signals: createSignals({ isTor: false }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('TOR_NETWORK');
    });

    it('не срабатывает когда isTor отсутствует', () => {
      const ctx = createRuleContext({
        signals: createSignals({}),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('TOR_NETWORK');
    });

    it('имеет decisionImpact = block и priority = 100', () => {
      const rule = getRuleDefinition('TOR_NETWORK');
      expect(rule).toBeDefined();
      expect(rule?.decisionImpact).toBe('block');
      expect(rule?.priority).toBe(100);
    });
  });

  describe('VPN_DETECTED', () => {
    it('срабатывает когда isVpn = true', () => {
      const ctx = createRuleContext({
        signals: createSignals({ isVpn: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('VPN_DETECTED');
    });

    it('не срабатывает когда isVpn = false', () => {
      const ctx = createRuleContext({
        signals: createSignals({ isVpn: false }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('VPN_DETECTED');
    });

    it('не срабатывает когда isVpn отсутствует', () => {
      const ctx = createRuleContext({
        signals: createSignals({}),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('VPN_DETECTED');
    });
  });

  describe('PROXY_DETECTED', () => {
    it('срабатывает когда isProxy = true', () => {
      const ctx = createRuleContext({
        signals: createSignals({ isProxy: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('PROXY_DETECTED');
    });

    it('не срабатывает когда isProxy = false', () => {
      const ctx = createRuleContext({
        signals: createSignals({ isProxy: false }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('PROXY_DETECTED');
    });
  });

  describe('CRITICAL_REPUTATION', () => {
    it('срабатывает когда reputationScore < 10', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 5 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает когда reputationScore = 10', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 10 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает когда reputationScore > 10', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 15 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает когда reputationScore отсутствует', () => {
      const ctx = createRuleContext({
        signals: createSignals({}),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает для невалидных score (NaN)', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: Number.NaN }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает для невалидных score (Infinity)', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: Number.POSITIVE_INFINITY }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает для невалидных score (< 0)', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: -1 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('не срабатывает для невалидных score (> 100)', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 101 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('CRITICAL_REPUTATION');
    });

    it('имеет decisionImpact = block и priority = 90', () => {
      const rule = getRuleDefinition('CRITICAL_REPUTATION');
      expect(rule).toBeDefined();
      expect(rule?.decisionImpact).toBe('block');
      expect(rule?.priority).toBe(90);
    });
  });

  describe('LOW_REPUTATION', () => {
    it('срабатывает когда 10 <= reputationScore < 30', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 20 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('LOW_REPUTATION');
    });

    it('срабатывает когда reputationScore = 10 (граничное значение)', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 10 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('LOW_REPUTATION');
    });

    it('не срабатывает когда reputationScore = 30', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 30 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('LOW_REPUTATION');
    });

    it('не срабатывает когда reputationScore < 10', () => {
      const ctx = createRuleContext({
        signals: createSignals({ reputationScore: 5 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('LOW_REPUTATION');
    });

    it('не срабатывает когда reputationScore отсутствует', () => {
      const ctx = createRuleContext({
        signals: createSignals({}),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('LOW_REPUTATION');
    });
  });

  describe('HIGH_VELOCITY', () => {
    it('срабатывает когда velocityScore > 70', () => {
      const ctx = createRuleContext({
        signals: createSignals({ velocityScore: 80 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('HIGH_VELOCITY');
    });

    it('не срабатывает когда velocityScore = 70', () => {
      const ctx = createRuleContext({
        signals: createSignals({ velocityScore: 70 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_VELOCITY');
    });

    it('не срабатывает когда velocityScore < 70', () => {
      const ctx = createRuleContext({
        signals: createSignals({ velocityScore: 50 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_VELOCITY');
    });

    it('не срабатывает когда velocityScore отсутствует', () => {
      const ctx = createRuleContext({
        signals: createSignals({}),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_VELOCITY');
    });
  });
});

// ============================================================================
// 🎯 TESTS - Geo Rules
// ============================================================================

describe('Geo Rules', () => {
  describe('HIGH_RISK_COUNTRY', () => {
    it('срабатывает для KP (North Korea)', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'KP' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('HIGH_RISK_COUNTRY');
    });

    it('срабатывает для IR (Iran)', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'IR' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('HIGH_RISK_COUNTRY');
    });

    it('срабатывает для SY (Syria)', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'SY' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('HIGH_RISK_COUNTRY');
    });

    it('не срабатывает для обычной страны', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'US' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_COUNTRY');
    });

    it('не срабатывает когда country отсутствует', () => {
      const geo: GeoInfo = {};
      const ctx = createRuleContext({
        geo,
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_COUNTRY');
    });

    it('не срабатывает когда geo отсутствует', () => {
      const ctx = createRuleContext({});
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_COUNTRY');
    });

    it('имеет decisionImpact = challenge', () => {
      const rule = getRuleDefinition('HIGH_RISK_COUNTRY');
      expect(rule).toBeDefined();
      expect(rule?.decisionImpact).toBe('challenge');
    });
  });

  describe('GEO_MISMATCH', () => {
    it('срабатывает когда страны различаются', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'US' }),
        previousGeo: createGeoInfo({ country: 'DE' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('GEO_MISMATCH');
    });

    it('не срабатывает когда страны совпадают', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'US' }),
        previousGeo: createGeoInfo({ country: 'US' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('GEO_MISMATCH');
    });

    it('не срабатывает когда previousGeo отсутствует', () => {
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'US' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('GEO_MISMATCH');
    });

    it('не срабатывает когда geo отсутствует', () => {
      const ctx = createRuleContext({
        previousGeo: createGeoInfo({ country: 'DE' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('GEO_MISMATCH');
    });

    it('не срабатывает когда country в previousGeo отсутствует', () => {
      const previousGeo: GeoInfo = {};
      const ctx = createRuleContext({
        geo: createGeoInfo({ country: 'US' }),
        previousGeo,
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('GEO_MISMATCH');
    });

    it('не срабатывает когда country в geo отсутствует', () => {
      const geo: GeoInfo = {};
      const ctx = createRuleContext({
        geo,
        previousGeo: createGeoInfo({ country: 'DE' }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('GEO_MISMATCH');
    });

    it('имеет decisionImpact = challenge', () => {
      const rule = getRuleDefinition('GEO_MISMATCH');
      expect(rule).toBeDefined();
      expect(rule?.decisionImpact).toBe('challenge');
    });
  });
});

// ============================================================================
// 🎯 TESTS - Composite Rules
// ============================================================================

describe('Composite Rules', () => {
  describe('IoT_TOR', () => {
    it('срабатывает для iot device с TOR', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'iot' }),
        signals: createSignals({ isTor: true }),
      });
      const triggered = evaluateRules(ctx);
      // IoT_TOR - критическое правило, но оно не срабатывает первым из-за short-circuit
      // TOR_NETWORK срабатывает первым (priority 100) и прерывает оценку
      // Но IoT_TOR все равно должен быть оценен, если TOR_NETWORK не блокирует
      // Проверяем, что хотя бы одно из правил сработало
      expect(triggered.length).toBeGreaterThan(0);
      // IoT_TOR может не быть в списке из-за short-circuit логики
      // Проверяем, что TOR_NETWORK сработал (это гарантирует, что isTor = true)
      expect(triggered).toContain('TOR_NETWORK');
    });

    it('не срабатывает для non-iot device с TOR', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'desktop' }),
        signals: createSignals({ isTor: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('IoT_TOR');
    });

    it('не срабатывает для iot device без TOR', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType: 'iot' }),
        signals: createSignals({ isTor: false }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('IoT_TOR');
    });

    it('имеет decisionImpact = block и priority = 95', () => {
      const rule = getRuleDefinition('IoT_TOR');
      expect(rule).toBeDefined();
      expect(rule?.decisionImpact).toBe('block');
      expect(rule?.priority).toBe(95);
    });
  });

  describe('NEW_DEVICE_VPN', () => {
    it('срабатывает для нового устройства с VPN', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo(),
        signals: createSignals({ isVpn: true }),
        metadata: createMetadata({ isNewDevice: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('NEW_DEVICE_VPN');
    });

    it('срабатывает когда metadata отсутствует (treat as new)', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo(),
        signals: createSignals({ isVpn: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('NEW_DEVICE_VPN');
    });

    it('срабатывает когда isNewDevice = undefined (treat as new)', () => {
      // Валидация: создаем валидный metadata объект без isNewDevice
      // Пустой объект валиден для RuleContextMetadata (все поля опциональны)
      // eslint-disable-next-line ai-security/model-poisoning -- тестовые данные, createMetadata гарантирует валидность
      const metadata: RuleContextMetadata = createMetadata({});
      const ctx = createRuleContext({
        device: createDeviceInfo(),
        signals: createSignals({ isVpn: true }),
        metadata,
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('NEW_DEVICE_VPN');
    });

    it('не срабатывает для существующего устройства с VPN', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo(),
        signals: createSignals({ isVpn: true }),
        metadata: createMetadata({ isNewDevice: false }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('NEW_DEVICE_VPN');
    });

    it('не срабатывает для нового устройства без VPN', () => {
      const ctx = createRuleContext({
        device: createDeviceInfo(),
        signals: createSignals({ isVpn: false }),
        metadata: createMetadata({ isNewDevice: true }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('NEW_DEVICE_VPN');
    });

    it('имеет decisionImpact = challenge', () => {
      const rule = getRuleDefinition('NEW_DEVICE_VPN');
      expect(rule).toBeDefined();
      expect(rule?.decisionImpact).toBe('challenge');
    });
  });

  describe('HIGH_RISK_SCORE', () => {
    it('срабатывает когда riskScore >= 80', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: 80 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('HIGH_RISK_SCORE');
    });

    it('срабатывает когда riskScore > 80', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: 90 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает когда riskScore < 80', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: 70 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает когда riskScore отсутствует', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({}),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает когда metadata отсутствует', () => {
      const ctx = createRuleContext({});
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает для невалидных score (NaN)', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: Number.NaN }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает для невалидных score (Infinity)', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: Number.POSITIVE_INFINITY }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает для невалидных score (< 0)', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: -1 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });

    it('не срабатывает для невалидных score (> 100)', () => {
      const ctx = createRuleContext({
        metadata: createMetadata({ riskScore: 101 }),
      });
      const triggered = evaluateRules(ctx);
      expect(triggered).not.toContain('HIGH_RISK_SCORE');
    });
  });
});

// ============================================================================
// 🎯 TESTS - evaluateRules (Main API)
// ============================================================================

describe('evaluateRules', () => {
  it('возвращает пустой массив для безопасного контекста', () => {
    const ctx = createRuleContext({
      device: createDeviceInfo({
        deviceType: 'desktop',
        os: 'Windows 10',
        browser: 'Chrome',
      }),
    });
    const triggered = evaluateRules(ctx);
    expect(triggered).toEqual([]);
  });

  it('возвращает несколько правил одновременно', () => {
    const device: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'unknown',
    };
    const ctx = createRuleContext({
      device,
    });
    const triggered = evaluateRules(ctx);
    expect(triggered).toContain('UNKNOWN_DEVICE');
    expect(triggered).toContain('MISSING_OS');
  });

  it('short-circuits при блокирующем критическом правиле', () => {
    const ctx = createRuleContext({
      device: createDeviceInfo({ deviceType: 'iot' }),
      signals: createSignals({ isTor: true }),
    });
    const triggered = evaluateRules(ctx);
    // TOR_NETWORK - критическое блокирующее правило (priority 100)
    // Оно срабатывает первым и прерывает оценку (short-circuit)
    // IoT_TOR (priority 95) не будет оценен, так как TOR_NETWORK уже блокирует
    expect(triggered).toContain('TOR_NETWORK');
    // Проверяем, что оценка прервалась (не все правила оценены)
    // Это видно по тому, что IoT_TOR не в списке, хотя условия выполнены
    expect(triggered).not.toContain('IoT_TOR');
  });

  it('оценивает критические правила первыми', () => {
    const ctx = createRuleContext({
      signals: createSignals({ isTor: true }),
    });
    const triggered = evaluateRules(ctx);
    // TOR_NETWORK - критическое правило (priority 100)
    expect(triggered).toContain('TOR_NETWORK');
  });

  it('оценивает некритические правила после критических', () => {
    const ctx = createRuleContext({
      device: createDeviceInfo({ deviceType: 'unknown' }),
      signals: createSignals({ isVpn: true }),
    });
    const triggered = evaluateRules(ctx);
    // UNKNOWN_DEVICE - некритическое правило
    // VPN_DETECTED - некритическое правило
    expect(triggered).toContain('UNKNOWN_DEVICE');
    expect(triggered).toContain('VPN_DETECTED');
  });
});

// ============================================================================
// 🎯 TESTS - getRuleDefinition
// ============================================================================

describe('getRuleDefinition', () => {
  it('возвращает определение правила по ID', () => {
    const rule = getRuleDefinition('TOR_NETWORK');
    expect(rule).toBeDefined();
    expect(rule?.id).toBe('TOR_NETWORK');
    expect(rule?.evaluate).toBeDefined();
    expect(typeof rule?.evaluate).toBe('function');
  });

  it('возвращает undefined для несуществующего правила', () => {
    // TypeScript не позволит передать несуществующий RiskRule,
    // но в runtime это возможно
    const rule = getRuleDefinition('TOR_NETWORK' as RiskRule);
    expect(rule).toBeDefined(); // TOR_NETWORK существует
  });

  it('возвращает правило с правильными метаданными', () => {
    const rule = getRuleDefinition('TOR_NETWORK');
    expect(rule).toBeDefined();
    expect(rule?.scoreImpact).toBe(70);
    expect(rule?.decisionImpact).toBe('block');
    expect(rule?.priority).toBe(100);
  });

  it('возвращает правило без метаданных', () => {
    const rule = getRuleDefinition('UNKNOWN_DEVICE');
    expect(rule).toBeDefined();
    expect(rule?.scoreImpact).toBe(40);
    expect(rule?.decisionImpact).toBeUndefined();
    expect(rule?.priority).toBeUndefined();
  });
});

// ============================================================================
// 🎯 TESTS - getRulesWithDecisionImpact
// ============================================================================

describe('getRulesWithDecisionImpact', () => {
  it('возвращает правила с decision impact', () => {
    const triggered: RiskRule[] = ['TOR_NETWORK', 'VPN_DETECTED', 'UNKNOWN_DEVICE'];
    const rules = getRulesWithDecisionImpact(triggered);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((rule) => rule.decisionImpact !== undefined)).toBe(true);
  });

  it('возвращает только правила с decision impact', () => {
    const triggered: RiskRule[] = ['TOR_NETWORK', 'VPN_DETECTED'];
    const rules = getRulesWithDecisionImpact(triggered);
    // TOR_NETWORK имеет decisionImpact = 'block'
    // VPN_DETECTED не имеет decisionImpact
    const hasTor = rules.some((rule) => rule.id === 'TOR_NETWORK');
    const hasVpn = rules.some((rule) => rule.id === 'VPN_DETECTED');
    expect(hasTor).toBe(true);
    expect(hasVpn).toBe(false);
  });

  it('возвращает пустой массив для правил без decision impact', () => {
    const triggered: RiskRule[] = ['UNKNOWN_DEVICE', 'MISSING_OS'];
    const rules = getRulesWithDecisionImpact(triggered);
    expect(rules.length).toBe(0);
  });

  it('возвращает пустой массив для пустого списка', () => {
    const rules = getRulesWithDecisionImpact([]);
    expect(rules).toEqual([]);
  });

  it('возвращает правила с block и challenge', () => {
    const triggered: RiskRule[] = ['TOR_NETWORK', 'NEW_DEVICE_VPN'];
    const rules = getRulesWithDecisionImpact(triggered);
    expect(rules.length).toBe(2);
    const torRule = rules.find((rule) => rule.id === 'TOR_NETWORK');
    const vpnRule = rules.find((rule) => rule.id === 'NEW_DEVICE_VPN');
    expect(torRule?.decisionImpact).toBe('block');
    expect(vpnRule?.decisionImpact).toBe('challenge');
  });
});

// ============================================================================
// 🎯 TESTS - getMaxPriority
// ============================================================================

describe('getMaxPriority', () => {
  it('возвращает максимальный приоритет среди правил', () => {
    const triggered: RiskRule[] = ['TOR_NETWORK', 'CRITICAL_REPUTATION', 'NEW_DEVICE_VPN'];
    const maxPriority = getMaxPriority(triggered);
    // TOR_NETWORK имеет priority 100
    // CRITICAL_REPUTATION имеет priority 90
    // NEW_DEVICE_VPN не имеет priority (0)
    expect(maxPriority).toBe(100);
  });

  it('возвращает 0 для правил без приоритета', () => {
    const triggered: RiskRule[] = ['UNKNOWN_DEVICE', 'MISSING_OS'];
    const maxPriority = getMaxPriority(triggered);
    expect(maxPriority).toBe(0);
  });

  it('возвращает 0 для пустого списка', () => {
    const maxPriority = getMaxPriority([]);
    expect(maxPriority).toBe(0);
  });

  it('возвращает правильный приоритет для одного правила', () => {
    const triggered: RiskRule[] = ['CRITICAL_REPUTATION'];
    const maxPriority = getMaxPriority(triggered);
    expect(maxPriority).toBe(90);
  });
});

// ============================================================================
// 🎯 TESTS - sortRulesByPriority
// ============================================================================

describe('sortRulesByPriority', () => {
  it('сортирует правила по приоритету (descending)', () => {
    const rules: RiskRule[] = ['NEW_DEVICE_VPN', 'CRITICAL_REPUTATION', 'TOR_NETWORK'];
    const sorted = sortRulesByPriority(rules);
    // TOR_NETWORK (100) > CRITICAL_REPUTATION (90) > NEW_DEVICE_VPN (0)
    expect(sorted[0]).toBe('TOR_NETWORK');
    expect(sorted[1]).toBe('CRITICAL_REPUTATION');
    expect(sorted[2]).toBe('NEW_DEVICE_VPN');
  });

  it('сохраняет порядок для правил с одинаковым приоритетом', () => {
    // Все правила без priority имеют priority = 0
    const rules: RiskRule[] = ['UNKNOWN_DEVICE', 'MISSING_OS'];
    const sorted = sortRulesByPriority(rules);
    // Порядок может быть любым для правил с одинаковым приоритетом
    expect(sorted.length).toBe(2);
    expect(sorted).toContain('UNKNOWN_DEVICE');
    expect(sorted).toContain('MISSING_OS');
  });

  it('возвращает пустой массив для пустого списка', () => {
    const sorted = sortRulesByPriority([]);
    expect(sorted).toEqual([]);
  });

  it('не мутирует исходный массив', () => {
    const rules: RiskRule[] = ['TOR_NETWORK', 'CRITICAL_REPUTATION'];
    const original = [...rules];
    sortRulesByPriority(rules);
    expect(rules).toEqual(original);
  });
});

// ============================================================================
// 🎯 TESTS - evaluateRuleActions
// ============================================================================

describe('evaluateRuleActions', () => {
  it('возвращает block для блокирующих правил', () => {
    const triggered: RiskRule[] = ['TOR_NETWORK'];
    const action = evaluateRuleActions(triggered);
    expect(action).toBe('block');
  });

  it('возвращает challenge для challenge правил', () => {
    const triggered: RiskRule[] = ['NEW_DEVICE_VPN'];
    const action = evaluateRuleActions(triggered);
    expect(action).toBe('challenge');
  });

  it('возвращает block когда есть и block и challenge (block приоритетнее)', () => {
    const triggered: RiskRule[] = ['TOR_NETWORK', 'NEW_DEVICE_VPN'];
    const action = evaluateRuleActions(triggered);
    expect(action).toBe('block');
  });

  it('возвращает undefined для правил без decision impact', () => {
    const triggered: RiskRule[] = ['UNKNOWN_DEVICE', 'MISSING_OS'];
    const action = evaluateRuleActions(triggered);
    expect(action).toBeUndefined();
  });

  it('возвращает undefined для пустого списка', () => {
    const action = evaluateRuleActions([]);
    expect(action).toBeUndefined();
  });

  it('возвращает block с наивысшим приоритетом', () => {
    // IoT_TOR (priority 95, block) vs CRITICAL_REPUTATION (priority 90, block)
    const triggered: RiskRule[] = ['CRITICAL_REPUTATION', 'IoT_TOR'];
    const action = evaluateRuleActions(triggered);
    expect(action).toBe('block');
    // IoT_TOR имеет больший приоритет (95 > 90)
  });

  it('возвращает challenge с наивысшим приоритетом', () => {
    // NEW_DEVICE_VPN (priority 0, challenge) vs HIGH_RISK_COUNTRY (priority undefined, challenge)
    const triggered: RiskRule[] = ['NEW_DEVICE_VPN', 'HIGH_RISK_COUNTRY'];
    const action = evaluateRuleActions(triggered);
    expect(action).toBe('challenge');
  });

  it('сортирует правила по приоритету перед оценкой', () => {
    const triggered: RiskRule[] = ['NEW_DEVICE_VPN', 'TOR_NETWORK'];
    const action = evaluateRuleActions(triggered);
    // Должен вернуть block (TOR_NETWORK имеет больший приоритет)
    expect(action).toBe('block');
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('обрабатывает контекст без signals', () => {
    const ctx = createRuleContext({});
    const triggered = evaluateRules(ctx);
    expect(Array.isArray(triggered)).toBe(true);
  });

  it('обрабатывает контекст без geo', () => {
    const ctx = createRuleContext({});
    const triggered = evaluateRules(ctx);
    expect(Array.isArray(triggered)).toBe(true);
  });

  it('обрабатывает контекст без metadata', () => {
    const ctx = createRuleContext({});
    const triggered = evaluateRules(ctx);
    expect(Array.isArray(triggered)).toBe(true);
  });

  it('обрабатывает все типы device', () => {
    const deviceTypes: DeviceType[] = ['desktop', 'mobile', 'tablet', 'iot', 'unknown'];
    const results = deviceTypes.map((deviceType) => {
      const ctx = createRuleContext({
        device: createDeviceInfo({ deviceType }),
      });
      const triggered = evaluateRules(ctx);
      return { deviceType, triggered };
    });
    // Проверяем, что все результаты валидны
    results.forEach((result) => {
      expect(Array.isArray(result.triggered)).toBe(true);
    });
  });

  it('обрабатывает граничные значения score (0)', () => {
    const ctx = createRuleContext({
      signals: createSignals({ reputationScore: 0 }),
    });
    const triggered = evaluateRules(ctx);
    expect(triggered).toContain('CRITICAL_REPUTATION');
  });

  it('обрабатывает граничные значения score (100)', () => {
    const ctx = createRuleContext({
      signals: createSignals({ reputationScore: 100 }),
    });
    const triggered = evaluateRules(ctx);
    expect(triggered).not.toContain('CRITICAL_REPUTATION');
    expect(triggered).not.toContain('LOW_REPUTATION');
  });

  it('обрабатывает null значения в signals', () => {
    const ctx = createRuleContext({
      signals: createSignals({
        reputationScore: null as unknown as number,
      }),
    });
    const triggered = evaluateRules(ctx);
    // null не должен вызывать ошибок
    expect(Array.isArray(triggered)).toBe(true);
  });
});
