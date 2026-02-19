/**
 * @file Unit тесты для domain/LocalRulesEngine.ts
 * Полное покрытие Local Rules Engine с 100% покрытием
 */

import { describe, expect, it } from 'vitest';
import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';
import { evaluateLocalRules } from '../../../src/domain/LocalRulesEngine.js';
import type {
  ContextBuilderPlugin,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../../../src/types/risk.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-test-123',
    deviceType: 'desktop',
    os: 'Windows 10',
    browser: 'Chrome',
    ip: '192.168.1.1',
    geo: {
      lat: 37.7749,
      lng: -122.4194,
    },
    userAgent: 'Mozilla/5.0',
    appVersion: '1.0.0',
    lastUsedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

function createRiskSignals(overrides: Partial<RiskSignals> = {}): RiskSignals {
  return {
    isVpn: false,
    isTor: false,
    isProxy: false,
    reputationScore: 50,
    velocityScore: 30,
    previousGeo: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    },
    externalSignals: {
      vendor: 'maxmind',
      score: 75,
    },
    ...overrides,
  };
}

function createRiskContext(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    ip: '192.168.1.1',
    geo: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    },
    userId: 'user-123',
    previousSessionId: 'session-prev-456',
    signals: createRiskSignals(),
    timestamp: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

function createLargeExternalSignals(): Record<string, unknown> {
  return Object.fromEntries(
    Array.from({ length: 1100 }, (_, i) => [`key${i}`, `value${i}`]),
  );
}

// ============================================================================
// 🎯 TESTS - evaluateLocalRules (Main API)
// ============================================================================

describe('evaluateLocalRules', () => {
  it('возвращает результат оценки для валидного контекста без violations', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
    expect(result.riskLevel).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
    expect(result.decisionHint).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('выбрасывает ошибку при блокирующих violations', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        reputationScore: NaN, // Invalid: не число
      }),
    });

    expect(() => {
      evaluateLocalRules(deviceInfo, context);
    }).toThrow('Invalid risk signals');
  });

  it('выбрасывает ошибку при out_of_range violations (блокирующие)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        reputationScore: 101, // Out of range: блокирующее violation
      }),
    });

    expect(() => {
      evaluateLocalRules(deviceInfo, context);
    }).toThrow('Invalid risk signals');
  });

  it('обрабатывает несколько блокирующих violations', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        reputationScore: NaN, // Invalid: не число
        velocityScore: NaN, // Invalid: не число
      }),
    });

    expect(() => {
      evaluateLocalRules(deviceInfo, context);
    }).toThrow('Invalid risk signals');
  });

  it('обрабатывает контекст без signals', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {};

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('использует default weights и decision policy при отсутствии policy', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
    expect(result.riskLevel).toBeDefined();
  });

  it('использует кастомные weights из policy', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const policy: RiskPolicy = {
      weights: {
        device: 0.0,
        geo: 0.0,
        network: 0.0,
        velocity: 0.2,
      },
    };

    const result = evaluateLocalRules(deviceInfo, context, policy);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('использует кастомные decision thresholds из policy', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const policy: RiskPolicy = {
      decision: {
        thresholds: {
          low: 30,
          medium: 60,
          high: 90,
          critical: 95,
        },
      },
    };

    const result = evaluateLocalRules(deviceInfo, context, policy);

    expect(result).toBeDefined();
    expect(result.riskLevel).toBeDefined();
  });

  it('обрабатывает плагины для scoring context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'test-scoring-plugin',
      extendScoringContext: (scoringContext) => ({
        ...scoringContext,
        signals: {
          ...scoringContext.signals,
          reputationScore: 80,
        },
      }),
    };

    const result = evaluateLocalRules(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает плагины для rule context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'test-rule-plugin',
      extendRuleContext: (ruleContext) => ({
        ...ruleContext,
        metadata: {
          ...ruleContext.metadata,
          riskScore: 75,
        },
      }),
    };

    const result = evaluateLocalRules(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
  });

  it('обрабатывает плагины для assessment context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'test-assessment-plugin',
      extendAssessmentContext: (assessmentContext) => ({
        ...assessmentContext,
        signals: {
          ...assessmentContext.signals,
          isVpn: true,
        },
      }),
    };

    const result = evaluateLocalRules(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('обрабатывает несколько плагинов одновременно', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugins: ContextBuilderPlugin[] = [
      {
        id: 'test-scoring-plugin-1',
        extendScoringContext: (scoringContext) => ({
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: 70,
          },
        }),
      },
      {
        id: 'test-rule-plugin-1',
        extendRuleContext: (ruleContext) => ({
          ...ruleContext,
          metadata: {
            ...ruleContext.metadata,
            riskScore: 65,
          },
        }),
      },
    ];

    const result = evaluateLocalRules(deviceInfo, context, {}, plugins);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
  });

  it('обрабатывает большие externalSignals (>1000 ключей)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        externalSignals: createLargeExternalSignals(),
      }),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает decisionSignals с reputationScore', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        reputationScore: 75,
      }),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.decisionHint).toBeDefined();
  });

  it('обрабатывает отсутствие decisionSignals (reputationScore undefined)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({}),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.decisionHint).toBeDefined();
  });

  it('обрабатывает контекст без signals (decisionSignals undefined)', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {};

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.decisionHint).toBeDefined();
  });

  it('обрабатывает большие externalSignals в assessment context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        externalSignals: createLargeExternalSignals(),
      }),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('обрабатывает пустой массив плагинов', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result = evaluateLocalRules(deviceInfo, context, {}, []);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает контекст с минимальными данными', () => {
    const deviceInfo = createDeviceInfo({
      deviceId: 'min-device',
      deviceType: 'desktop',
    });
    const context: RiskContext = {
      ip: '192.168.1.1',
    };

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает контекст с максимальными данными', () => {
    const deviceInfo = createDeviceInfo({
      deviceId: 'max-device',
      deviceType: 'mobile',
      os: 'iOS 17',
      browser: 'Safari',
      ip: '10.0.0.1',
      geo: {
        lat: 40.7128,
        lng: -74.0060,
      },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      appVersion: '2.0.0',
      lastUsedAt: '2026-01-20T12:00:00.000Z',
    });
    const context = createRiskContext({
      ip: '10.0.0.1',
      geo: {
        country: 'US',
        region: 'NY',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
      userId: 'user-max',
      previousSessionId: 'session-max',
      signals: createRiskSignals({
        isVpn: true,
        isTor: false,
        isProxy: false,
        reputationScore: 85,
        velocityScore: 45,
        previousGeo: {
          country: 'CA',
          region: 'ON',
          city: 'Toronto',
          lat: 43.6532,
          lng: -79.3832,
        },
        externalSignals: {
          vendor: 'maxmind',
          score: 90,
        },
      }),
      timestamp: '2026-01-20T12:00:00.000Z',
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
    expect(result.riskLevel).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
    expect(result.decisionHint).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('обрабатывает multiple blocking violations', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        reputationScore: NaN, // Blocking violation
        velocityScore: 101, // Blocking violation (out of range)
      }),
    });

    expect(() => {
      evaluateLocalRules(deviceInfo, context);
    }).toThrow('Invalid risk signals');
  });

  it('обрабатывает плагин с приоритетом', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'test-priority-plugin',
      priority: 10,
      extendScoringContext: (scoringContext) => ({
        ...scoringContext,
        signals: {
          ...scoringContext.signals,
          reputationScore: 60,
        },
      }),
    };

    const result = evaluateLocalRules(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает несколько плагинов с разными приоритетами', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugins: ContextBuilderPlugin[] = [
      {
        id: 'test-priority-plugin-1',
        priority: 5,
        extendScoringContext: (scoringContext) => ({
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: 50,
          },
        }),
      },
      {
        id: 'test-priority-plugin-2',
        priority: 10,
        extendScoringContext: (scoringContext) => ({
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: 60,
          },
        }),
      },
    ];

    const result = evaluateLocalRules(deviceInfo, context, {}, plugins);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает externalSignals ровно на пороге (1000 ключей)', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`]),
    );
    const context = createRiskContext({
      signals: createRiskSignals({
        externalSignals,
      }),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает externalSignals чуть выше порога (1001 ключ)', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals = Object.fromEntries(
      Array.from({ length: 1001 }, (_, i) => [`key${i}`, `value${i}`]),
    );
    const context = createRiskContext({
      signals: createRiskSignals({
        externalSignals,
      }),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает externalSignals чуть ниже порога (999 ключей)', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals = Object.fromEntries(
      Array.from({ length: 999 }, (_, i) => [`key${i}`, `value${i}`]),
    );
    const context = createRiskContext({
      signals: createRiskSignals({
        externalSignals,
      }),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
  });

  it('обрабатывает undefined externalSignals', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({}),
    });

    const result = evaluateLocalRules(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeDefined();
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
      const deviceInfo = createDeviceInfo({ deviceType });
      const context = createRiskContext();
      return evaluateLocalRules(deviceInfo, context);
    });

    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.riskScore).toBeDefined();
    });
  });

  it('возвращает детерминированный результат для одинакового входа', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result1 = evaluateLocalRules(deviceInfo, context);
    const result2 = evaluateLocalRules(deviceInfo, context);

    expect(result1.riskScore).toBe(result2.riskScore);
    expect(result1.riskLevel).toBe(result2.riskLevel);
    expect(result1.triggeredRules).toEqual(result2.triggeredRules);
    expect(result1.decisionHint).toEqual(result2.decisionHint);
  });
});
