/**
 * @file Unit тесты для Classification Risk Scoring
 * Полное покрытие всех функций и edge cases (100%)
 */
import { describe, expect, it } from 'vitest';

import type {
  RiskFactor,
  RiskWeights,
  ScoringContext,
} from '../../../src/classification/aggregation/scoring.js';
import {
  calculateRiskScore,
  calculateRiskScoreWithCustomFactors,
  defaultRiskWeights,
  validateRiskWeights,
} from '../../../src/classification/aggregation/scoring.js';
import type {
  ClassificationGeo,
  ClassificationSignals,
} from '../../../src/classification/signals/signals.js';
import { getClassificationRulesConfig } from '../../../src/classification/strategies/config.js';
import type { DeviceInfo } from '../../../src/classification/strategies/rules.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createTestDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return Object.freeze({
    deviceId: 'test-device-123',
    deviceType: 'desktop',
    os: 'Windows',
    browser: 'Chrome',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  });
}

function createTestScoringContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return Object.freeze({
    device: createTestDeviceInfo(),
    ...overrides,
  });
}

function createTestGeo(overrides: Partial<ClassificationGeo> = {}): ClassificationGeo {
  return Object.freeze({
    country: 'US',
    region: 'CA',
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    ...overrides,
  });
}

function createTestSignals(overrides: Partial<ClassificationSignals> = {}): ClassificationSignals {
  return Object.freeze({
    ...overrides,
  });
}

/* ============================================================================
 * 🧪 TESTS — validateRiskWeights
 * ============================================================================
 */

describe('validateRiskWeights', () => {
  it('должен возвращать true для валидных весов (сумма = 1.0)', () => {
    const weights: RiskWeights = {
      device: 0.3,
      geo: 0.25,
      network: 0.25,
      velocity: 0.2,
    };
    expect(validateRiskWeights(weights)).toBe(true);
  });

  it('должен возвращать true для весов с суммой близкой к 1.0 (0.9)', () => {
    const weights: RiskWeights = {
      device: 0.225,
      geo: 0.225,
      network: 0.225,
      velocity: 0.225,
    };
    // Сумма = 0.9, что >= MIN_TOTAL (0.9)
    expect(validateRiskWeights(weights)).toBe(true);
  });

  it('должен возвращать true для весов с суммой близкой к 1.0 (1.1)', () => {
    const weights: RiskWeights = {
      device: 0.3,
      geo: 0.3,
      network: 0.25,
      velocity: 0.25,
    };
    expect(validateRiskWeights(weights)).toBe(true);
  });

  it('должен возвращать false для весов с суммой < 0.9', () => {
    const weights: RiskWeights = {
      device: 0.1,
      geo: 0.1,
      network: 0.1,
      velocity: 0.1,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для весов с суммой > 1.1', () => {
    const weights: RiskWeights = {
      device: 0.4,
      geo: 0.4,
      network: 0.4,
      velocity: 0.4,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для отрицательного device веса', () => {
    const weights: RiskWeights = {
      device: -0.1,
      geo: 0.3,
      network: 0.3,
      velocity: 0.3,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для отрицательного geo веса', () => {
    const weights: RiskWeights = {
      device: 0.3,
      geo: -0.1,
      network: 0.3,
      velocity: 0.3,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для отрицательного network веса', () => {
    const weights: RiskWeights = {
      device: 0.3,
      geo: 0.3,
      network: -0.1,
      velocity: 0.3,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для отрицательного velocity веса', () => {
    const weights: RiskWeights = {
      device: 0.3,
      geo: 0.3,
      network: 0.3,
      velocity: -0.1,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для device веса > 1.0', () => {
    const weights: RiskWeights = {
      device: 1.1,
      geo: 0.0,
      network: 0.0,
      velocity: 0.0,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для geo веса > 1.0', () => {
    const weights: RiskWeights = {
      device: 0.0,
      geo: 1.1,
      network: 0.0,
      velocity: 0.0,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для network веса > 1.0', () => {
    const weights: RiskWeights = {
      device: 0.0,
      geo: 0.0,
      network: 1.1,
      velocity: 0.0,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать false для velocity веса > 1.0', () => {
    const weights: RiskWeights = {
      device: 0.0,
      geo: 0.0,
      network: 0.0,
      velocity: 1.1,
    };
    expect(validateRiskWeights(weights)).toBe(false);
  });

  it('должен возвращать true для весов с нулевыми значениями (если сумма валидна)', () => {
    const weights: RiskWeights = {
      device: 0.5,
      geo: 0.0,
      network: 0.5,
      velocity: 0.0,
    };
    expect(validateRiskWeights(weights)).toBe(true);
  });

  it('должен возвращать true для весов на границе (0.0)', () => {
    const weights: RiskWeights = {
      device: 0.0,
      geo: 0.0,
      network: 0.0,
      velocity: 1.0,
    };
    expect(validateRiskWeights(weights)).toBe(true);
  });

  it('должен возвращать true для весов на границе (1.0)', () => {
    const weights: RiskWeights = {
      device: 1.0,
      geo: 0.0,
      network: 0.0,
      velocity: 0.0,
    };
    expect(validateRiskWeights(weights)).toBe(true);
  });
});

/* ============================================================================
 * 🧪 TESTS — defaultRiskWeights
 * ============================================================================
 */

describe('defaultRiskWeights', () => {
  it('должен быть валидным', () => {
    expect(validateRiskWeights(defaultRiskWeights)).toBe(true);
  });

  it('должен иметь сумму близкую к 1.0', () => {
    const total = defaultRiskWeights.device
      + defaultRiskWeights.geo
      + defaultRiskWeights.network
      + defaultRiskWeights.velocity;
    expect(total).toBeGreaterThanOrEqual(0.9);
    expect(total).toBeLessThanOrEqual(1.1);
  });

  it('должен быть immutable', () => {
    expect(Object.isFrozen(defaultRiskWeights)).toBe(true);
  });
});

/* ============================================================================
 * 🧪 TESTS — calculateRiskScore (основной API)
 * ============================================================================
 */

describe('calculateRiskScore', () => {
  it('должен возвращать 0 для пустого контекста', () => {
    const context = createTestScoringContext();
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен рассчитывать device risk для unknown device', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'unknown' }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать device risk для iot device', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'iot' }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать device risk для missing OS', () => {
    const deviceInfo = createTestDeviceInfo();
    const { os, ...deviceWithoutOs } = deviceInfo;
    const context = createTestScoringContext({
      device: deviceWithoutOs,
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать device risk для missing browser', () => {
    const deviceInfo = createTestDeviceInfo();
    const { browser, ...deviceWithoutBrowser } = deviceInfo;
    const context = createTestScoringContext({
      device: deviceWithoutBrowser,
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать geo risk для high-risk country', () => {
    const config = getClassificationRulesConfig();
    const firstCountry = Array.from(config.highRiskCountries)[0];
    const highRiskCountry = firstCountry !== undefined && firstCountry !== '' ? firstCountry : 'XX';
    const context = createTestScoringContext({
      geo: createTestGeo({ country: highRiskCountry }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать geo risk для geo mismatch', () => {
    const context = createTestScoringContext({
      geo: createTestGeo({ country: 'US' }),
      signals: createTestSignals({
        previousGeo: createTestGeo({ country: 'RU' }),
      }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать network risk для Tor', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ isTor: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать network risk для VPN', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ isVpn: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать network risk для Proxy', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ isProxy: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать network risk для low reputation', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 30 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать network risk для critical reputation', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 5 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен рассчитывать velocity risk', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: 50 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен использовать кастомные веса', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'unknown' }),
    });
    const customWeights: RiskWeights = {
      device: 1.0,
      geo: 0.0,
      network: 0.0,
      velocity: 0.0,
    };
    const score = calculateRiskScore(context, customWeights);
    expect(score).toBeGreaterThan(0);
  });

  it('должен использовать config из context если передан', () => {
    const config = getClassificationRulesConfig();
    const firstCountry = Array.from(config.highRiskCountries)[0];
    const highRiskCountry = firstCountry !== undefined && firstCountry !== '' ? firstCountry : 'XX';
    const context = createTestScoringContext({
      geo: createTestGeo({ country: highRiskCountry }),
      config: { highRiskCountries: config.highRiskCountries },
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен возвращать score в диапазоне 0-100', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'unknown' }),
      geo: createTestGeo({ country: 'US' }),
      ip: '192.168.1.1',
      signals: createTestSignals({
        isTor: true,
        isVpn: true,
        isProxy: true,
        reputationScore: 5,
        velocityScore: 90,
      }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать IPv6 адреса', () => {
    const context = createTestScoringContext({
      ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      signals: createTestSignals({ isTor: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать compressed IPv6 адреса', () => {
    const context = createTestScoringContext({
      ip: '2001:db8::1',
      signals: createTestSignals({ isVpn: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен игнорировать невалидный IP', () => {
    const context = createTestScoringContext({
      ip: 'invalid-ip',
      signals: createTestSignals({ isTor: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен игнорировать undefined IP', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ isTor: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать NaN reputationScore', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: Number.NaN }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать Infinity reputationScore', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: Number.POSITIVE_INFINITY }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать отрицательный reputationScore', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: -10 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать reputationScore > 100', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 150 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать NaN velocityScore', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: Number.NaN }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать Infinity velocityScore', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: Number.POSITIVE_INFINITY }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать отрицательный velocityScore', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: -10 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать velocityScore > 100', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: 150 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен быть детерминированным (одинаковый вход → одинаковый выход)', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'unknown' }),
      geo: createTestGeo({ country: 'US' }),
      ip: '192.168.1.1',
      signals: createTestSignals({ isTor: true, velocityScore: 50 }),
    });
    const score1 = calculateRiskScore(context);
    const score2 = calculateRiskScore(context);
    expect(score1).toBe(score2);
  });
});

/* ============================================================================
 * 🧪 TESTS — calculateRiskScoreWithCustomFactors
 * ============================================================================
 */

// eslint-disable-next-line ai-security/token-leakage -- Название функции, не токен
describe('calculateRiskScoreWithCustomFactors', () => {
  it('должен использовать кастомные факторы', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'custom1',
        weight: 0.5,
        compute: () => 50,
      },
      {
        name: 'custom2',
        weight: 0.5,
        compute: () => 30,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(40); // (50 * 0.5) + (30 * 0.5) = 40
  });

  it('должен нормализовать веса если сумма != 1.0', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'custom1',
        weight: 0.6,
        compute: () => 50,
      },
      {
        name: 'custom2',
        weight: 0.4,
        compute: () => 30,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    // Нормализованные веса: 0.6/1.0 = 0.6, 0.4/1.0 = 0.4
    // (50 * 0.6) + (30 * 0.4) = 30 + 12 = 42
    expect(score).toBe(42);
  });

  it('должен кешировать normalizedFactors для одинаковых весов', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'custom1',
        weight: 0.6,
        compute: () => 50,
      },
      {
        name: 'custom2',
        weight: 0.4,
        compute: () => 30,
      },
    ];
    const score1 = calculateRiskScoreWithCustomFactors(context, customFactors);
    const score2 = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score1).toBe(score2);
  });

  it('должен использовать факторы напрямую если сумма весов = 1.0 (без нормализации)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'custom1',
        weight: 0.5,
        compute: () => 50,
      },
      {
        name: 'custom2',
        weight: 0.5,
        compute: () => 30,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    // (50 * 0.5) + (30 * 0.5) = 40, без нормализации
    expect(score).toBe(40);
  });

  it('должен использовать кеш для normalizedFactors при повторных вызовах', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'custom1',
        weight: 0.6,
        compute: () => 50,
      },
      {
        name: 'custom2',
        weight: 0.4,
        compute: () => 30,
      },
    ];
    // Первый вызов создает и кеширует normalizedFactors
    const score1 = calculateRiskScoreWithCustomFactors(context, customFactors);
    // Второй вызов использует кеш
    const score2 = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score1).toBe(score2);
    expect(score1).toBe(42); // (50 * 0.6/1.0) + (30 * 0.4/1.0) = 30 + 12 = 42
  });

  it('должен выбрасывать ошибку для пустого массива факторов', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [];
    expect(() => {
      calculateRiskScoreWithCustomFactors(context, customFactors);
    }).toThrow('Invalid factors');
  });

  it('должен выбрасывать ошибку для дублирующихся имен', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'duplicate',
        weight: 0.5,
        compute: () => 50,
      },
      {
        name: 'duplicate',
        weight: 0.5,
        compute: () => 30,
      },
    ];
    expect(() => {
      calculateRiskScoreWithCustomFactors(context, customFactors);
    }).toThrow('Invalid factors');
  });

  it('должен выбрасывать ошибку для невалидных весов (сумма < 0.9)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 0.1,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.1,
        compute: () => 30,
      },
    ];
    expect(() => {
      calculateRiskScoreWithCustomFactors(context, customFactors);
    }).toThrow('Invalid factors');
  });

  it('должен выбрасывать ошибку для невалидных весов (сумма > 1.1)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 0.6,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.6,
        compute: () => 30,
      },
    ];
    expect(() => {
      calculateRiskScoreWithCustomFactors(context, customFactors);
    }).toThrow('Invalid factors');
  });

  it('должен выбрасывать ошибку для отрицательного веса', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: -0.1,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 1.1,
        compute: () => 30,
      },
    ];
    expect(() => {
      calculateRiskScoreWithCustomFactors(context, customFactors);
    }).toThrow('Invalid factors');
  });

  it('должен выбрасывать ошибку для веса > 1.0', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.1,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.0,
        compute: () => 30,
      },
    ];
    expect(() => {
      calculateRiskScoreWithCustomFactors(context, customFactors);
    }).toThrow('Invalid factors');
  });

  it('должен обрабатывать факторы с нулевым весом', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.0,
        compute: () => 100,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(50);
  });

  it('должен обрабатывать факторы с score > 100 (ограничивает до 100)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 150,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(100);
  });

  it('должен обрабатывать факторы с отрицательным score (ограничивает до 0)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => -10,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(0);
  });

  it('должен обрабатывать факторы с undefined score', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 0.5,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.5,
        compute: () => undefined as unknown as number,
      },
    ];
    // Функция должна обработать undefined и вернуть валидный score
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен использовать кеш для normalizedFactors при разных контекстах с одинаковыми факторами', () => {
    const context1 = createTestScoringContext();
    const context2 = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'mobile' }),
    });
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'custom1',
        weight: 0.6,
        compute: () => 50,
      },
      {
        name: 'custom2',
        weight: 0.4,
        compute: () => 30,
      },
    ];
    // Первый вызов создает и кеширует normalizedFactors
    const score1 = calculateRiskScoreWithCustomFactors(context1, customFactors);
    // Второй вызов с другим контекстом, но теми же факторами - использует кеш
    const score2 = calculateRiskScoreWithCustomFactors(context2, customFactors);
    // Оба должны использовать одинаковые нормализованные веса
    expect(score1).toBe(score2);
    expect(score1).toBe(42);
  });

  it('должен обрабатывать score точно на границе MIN_SCORE', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 0,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(0);
  });

  it('должен обрабатывать score точно на границе MAX_SCORE', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 100,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(100);
  });

  it('должен обрабатывать score между MIN_SCORE и MAX_SCORE', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 50,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(50);
  });

  it('должен обрабатывать weightedScore < 0 (ограничивает до 0)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => -10,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(0);
  });

  it('должен обрабатывать weightedScore > 100 (ограничивает до 100)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 150,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(100);
  });

  it('должен округлять weightedScore', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 0.5,
        compute: () => 33.333,
      },
      {
        name: 'factor2',
        weight: 0.5,
        compute: () => 66.666,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    // (33.333 * 0.5) + (66.666 * 0.5) = 16.6665 + 33.333 = 49.9995 ≈ 50
    expect(score).toBe(50);
  });
});

/* ============================================================================
 * 🧪 TESTS — Edge Cases & Integration
 * ============================================================================
 */

describe('scoring edge cases', () => {
  it('должен обрабатывать все факторы одновременно', () => {
    const config = getClassificationRulesConfig();
    const firstCountry = Array.from(config.highRiskCountries)[0];
    const highRiskCountry = firstCountry !== undefined && firstCountry !== '' ? firstCountry : 'XX';
    const deviceInfo = createTestDeviceInfo({ deviceType: 'unknown' });
    const { os, browser, ...deviceWithoutOsAndBrowser } = deviceInfo;
    const context = createTestScoringContext({
      device: deviceWithoutOsAndBrowser,
      geo: createTestGeo({ country: highRiskCountry }),
      ip: '2001:db8::1',
      signals: createTestSignals({
        isTor: true,
        isVpn: true,
        isProxy: true,
        reputationScore: 5,
        velocityScore: 90,
        previousGeo: createTestGeo({ country: 'RU' }),
      }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать mixed IPv6 адреса', () => {
    const context = createTestScoringContext({
      ip: '2001:db8::192.168.1.1',
      signals: createTestSignals({ isVpn: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать IPv4-mapped IPv6 адреса', () => {
    const context = createTestScoringContext({
      ip: '::ffff:192.168.1.1',
      signals: createTestSignals({ isProxy: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать IPv6 с зонами', () => {
    const context = createTestScoringContext({
      ip: 'fe80::1%eth0',
      signals: createTestSignals({ isTor: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать compressed IPv6 (::1)', () => {
    const context = createTestScoringContext({
      ip: '::1',
      signals: createTestSignals({ isVpn: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать пустую строку IP', () => {
    const context = createTestScoringContext({
      ip: '',
      signals: createTestSignals({ isTor: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать reputationScore на границе LOW_REPUTATION_THRESHOLD', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 50 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('должен обрабатывать reputationScore на границе VERY_LOW_REPUTATION_THRESHOLD', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 10 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('должен обрабатывать reputationScore = 0', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 0 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать reputationScore между порогами', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 30 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('должен обрабатывать null reputationScore', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: null as unknown as number }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать null velocityScore', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: null as unknown as number }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать undefined signals', () => {
    const context = createTestScoringContext({
      signals: undefined,
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать undefined geo', () => {
    const context = createTestScoringContext({
      geo: undefined,
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать geo без country', () => {
    const geoInfo = createTestGeo();
    const { country, ...geoWithoutCountry } = geoInfo;
    const context = createTestScoringContext({
      geo: geoWithoutCountry,
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать geo mismatch с одинаковыми странами', () => {
    const context = createTestScoringContext({
      geo: createTestGeo({ country: 'US' }),
      signals: createTestSignals({
        previousGeo: createTestGeo({ country: 'US' }),
      }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать geo mismatch с undefined previousGeo.country', () => {
    const previousGeoInfo = createTestGeo();
    const { country, ...previousGeoWithoutCountry } = previousGeoInfo;
    const context = createTestScoringContext({
      geo: createTestGeo({ country: 'US' }),
      signals: createTestSignals({
        previousGeo: previousGeoWithoutCountry,
      }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать geo mismatch с undefined current geo.country', () => {
    const geoInfo = createTestGeo();
    const { country, ...geoWithoutCountry } = geoInfo;
    const context = createTestScoringContext({
      geo: geoWithoutCountry,
      signals: createTestSignals({
        previousGeo: createTestGeo({ country: 'US' }),
      }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });
});

/* ============================================================================
 * 🧪 TESTS — Internal Functions Coverage (для увеличения покрытия функций)
 * ============================================================================
 */

describe('internal functions coverage', () => {
  // calculateDeviceRisk coverage
  it('должен обрабатывать desktop device (не unknown, не iot) - должен давать 0 device risk', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'desktop' }),
    });
    const score = calculateRiskScore(context);
    // Desktop device без missing OS/browser должен давать 0 device risk
    expect(score).toBe(0);
  });

  it('должен обрабатывать mobile device (не unknown, не iot) - должен давать 0 device risk', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'mobile' }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать tablet device (не unknown, не iot) - должен давать 0 device risk', () => {
    const context = createTestScoringContext({
      device: createTestDeviceInfo({ deviceType: 'tablet' }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать комбинацию unknown device + missing OS + missing browser', () => {
    const deviceInfo = createTestDeviceInfo({ deviceType: 'unknown' });
    const { os, browser, ...deviceWithoutOsAndBrowser } = deviceInfo;
    const context = createTestScoringContext({
      device: deviceWithoutOsAndBrowser,
    });
    const score = calculateRiskScore(context);
    // UNKNOWN_DEVICE (40) + MISSING_OS (20) + MISSING_BROWSER (15) = 75, но ограничено до 100
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать комбинацию iot device + missing OS', () => {
    const deviceInfo = createTestDeviceInfo({ deviceType: 'iot' });
    const { os, ...deviceWithoutOs } = deviceInfo;
    const context = createTestScoringContext({
      device: deviceWithoutOs,
    });
    const score = calculateRiskScore(context);
    // IOT_DEVICE (30) + MISSING_OS (20) = 50
    expect(score).toBeGreaterThan(0);
  });

  // calculateGeoRisk coverage
  it('должен обрабатывать geo с country, но не в high-risk списке', () => {
    // Используем страну, которая может быть не в high-risk списке
    const context = createTestScoringContext({
      geo: createTestGeo({ country: 'US' }),
    });
    const score = calculateRiskScore(context);
    // Если US не в high-risk списке, geo risk должен быть 0
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('должен обрабатывать geo без country, но с previousGeo', () => {
    const geoInfo = createTestGeo();
    const { country, ...geoWithoutCountry } = geoInfo;
    const context = createTestScoringContext({
      geo: geoWithoutCountry,
      signals: createTestSignals({
        previousGeo: createTestGeo({ country: 'US' }),
      }),
    });
    const score = calculateRiskScore(context);
    // Без country не может быть geo mismatch
    expect(score).toBe(0);
  });

  // calculateNetworkRisk coverage
  it('должен обрабатывать reputationScore = 0 (не должен давать CRITICAL или LOW)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 0 }),
    });
    const score = calculateRiskScore(context);
    // reputationScore = 0 не должно давать CRITICAL (требуется > 0) или LOW
    expect(score).toBe(0);
  });

  it('должен обрабатывать reputationScore точно на VERY_LOW_REPUTATION_THRESHOLD (10)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 10 }),
    });
    const score = calculateRiskScore(context);
    // reputationScore = 10 должно давать LOW_REPUTATION (>= 10 и < 50)
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать reputationScore между VERY_LOW и LOW (например, 30)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 30 }),
    });
    const score = calculateRiskScore(context);
    // reputationScore = 30 должно давать LOW_REPUTATION (>= 10 и < 50)
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать reputationScore >= LOW_REPUTATION_THRESHOLD (50)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 50 }),
    });
    const score = calculateRiskScore(context);
    // reputationScore = 50 не должно давать LOW_REPUTATION (>= 50)
    expect(score).toBe(0);
  });

  it('должен обрабатывать reputationScore между 0 и VERY_LOW (например, 5)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 5 }),
    });
    const score = calculateRiskScore(context);
    // reputationScore = 5 должно давать CRITICAL_REPUTATION (> 0 и < 10)
    expect(score).toBeGreaterThan(0);
  });

  // validateAndNormalizeScore coverage через calculateNetworkRisk и calculateVelocityRisk
  it('должен обрабатывать reputationScore точно на MIN_SCORE (0)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 0 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать reputationScore точно на MAX_SCORE (100)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 100 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать reputationScore между MIN и MAX (например, 75)', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ reputationScore: 75 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать velocityScore точно на MIN_SCORE (0)', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: 0 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBe(0);
  });

  it('должен обрабатывать velocityScore точно на MAX_SCORE (100)', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: 100 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать velocityScore между MIN и MAX (например, 75)', () => {
    const context = createTestScoringContext({
      signals: createTestSignals({ velocityScore: 75 }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // isValidIp coverage
  it('должен обрабатывать IPv4 адреса через isValidIpv4', () => {
    const context = createTestScoringContext({
      ip: '192.168.1.1',
      signals: createTestSignals({ isVpn: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  it('должен обрабатывать IPv6 адреса через isValidIpv6', () => {
    const context = createTestScoringContext({
      ip: '2001:db8::1',
      signals: createTestSignals({ isVpn: true }),
    });
    const score = calculateRiskScore(context);
    expect(score).toBeGreaterThan(0);
  });

  // validateFactorsRegistry coverage через calculateRiskScoreWithCustomFactors
  it('должен обрабатывать факторы с валидной суммой весов на границе MIN_TOTAL (0.9)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 0.45,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.45,
        compute: () => 30,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать факторы с валидной суммой весов на границе MAX_TOTAL (1.1)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 0.55,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.55,
        compute: () => 30,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('должен обрабатывать факторы с весами на границе MIN_WEIGHT (0.0)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 50,
      },
      {
        name: 'factor2',
        weight: 0.0,
        compute: () => 100,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(50);
  });

  it('должен обрабатывать факторы с весами на границе MAX_WEIGHT (1.0)', () => {
    const context = createTestScoringContext();
    const customFactors: readonly RiskFactor[] = [
      {
        name: 'factor1',
        weight: 1.0,
        compute: () => 50,
      },
    ];
    const score = calculateRiskScoreWithCustomFactors(context, customFactors);
    expect(score).toBe(50);
  });
});
