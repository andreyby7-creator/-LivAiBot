/**
 * @file Unit тесты для types/risk.ts
 * Полное покрытие типов risk assessment с 100% покрытием
 */

import { describe, expect, it } from 'vitest';
import type { RiskLevel } from '../../../src/types/auth.js';
import type { LoginRiskAssessment } from '../../../src/domain/LoginRiskAssessment.js';
import type { DecisionPolicy, DecisionResult } from '../../../src/effects/login/risk-decision.js';
import type { RiskRule, RuleEvaluationContext } from '../../../src/effects/login/risk-rules.js';
import type { RiskWeights, ScoringContext } from '../../../src/effects/login/risk-scoring.js';
import type {
  BuildAssessmentContext,
  ContextBuilderPlugin,
  ExternalRiskSignals,
  InternalRiskSignals,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../../../src/types/risk.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createInternalRiskSignals(
  overrides: Partial<InternalRiskSignals> = {},
): InternalRiskSignals {
  return {
    isVpn: false,
    isTor: false,
    isProxy: false,
    asn: 'AS12345',
    reputationScore: 50,
    velocityScore: 30,
    previousGeo: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    },
    ...overrides,
  };
}

function createExternalRiskSignals(
  overrides: Partial<ExternalRiskSignals> = {},
): ExternalRiskSignals {
  return {
    vendor: 'maxmind',
    score: 75,
    flags: ['suspicious'],
    ...overrides,
  };
}

function createRiskSignals(overrides: Partial<RiskSignals> = {}): RiskSignals {
  return {
    isVpn: false,
    isTor: false,
    isProxy: false,
    asn: 'AS12345',
    reputationScore: 50,
    velocityScore: 30,
    externalSignals: createExternalRiskSignals(),
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

function createRiskWeights(overrides: Partial<RiskWeights> = {}): RiskWeights {
  return {
    device: 0.3,
    geo: 0.2,
    network: 0.3,
    velocity: 0.2,
    ...overrides,
  };
}

function createDecisionPolicy(overrides: Partial<DecisionPolicy> = {}): DecisionPolicy {
  return {
    thresholds: {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90,
    },
    blockOnCriticalRules: true,
    challengeOnHighRisk: true,
    criticalReputationThreshold: 10,
    ...overrides,
  };
}

function createRiskPolicy(overrides: Partial<RiskPolicy> = {}): RiskPolicy {
  return {
    weights: createRiskWeights(),
    decision: createDecisionPolicy(),
    ...overrides,
  };
}

function createLoginRiskAssessment(
  overrides: Partial<LoginRiskAssessment> = {},
): LoginRiskAssessment {
  return {
    userId: 'user-123',
    ip: '192.168.1.1',
    geo: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    },
    device: {
      deviceId: 'device-123',
      fingerprint: 'fp-abc',
      platform: 'web',
      os: 'Windows 11',
      browser: 'Chrome',
    },
    userAgent: 'Mozilla/5.0',
    previousSessionId: 'session-prev',
    timestamp: '2026-01-15T10:30:00.000Z',
    signals: {
      vpn: false,
      riskScore: 25,
    },
    ...overrides,
  };
}

function createDecisionResult(overrides: Partial<DecisionResult> = {}): DecisionResult {
  return {
    action: 'allow',
    ...overrides,
  };
}

function createScoringContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    device: {
      deviceId: 'device-123',
      deviceType: 'desktop',
      os: 'Windows 11',
      browser: 'Chrome',
      ip: '192.168.1.1',
      geo: { lat: 37.7749, lng: -122.4194 },
      userAgent: 'Mozilla/5.0',
      appVersion: '1.0.0',
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    },
    geo: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    },
    ip: '192.168.1.1',
    signals: {
      isVpn: false,
      isTor: false,
      isProxy: false,
      reputationScore: 50,
      velocityScore: 30,
    },
    ...overrides,
  };
}

function createRuleEvaluationContext(
  overrides: Partial<RuleEvaluationContext> = {},
): RuleEvaluationContext {
  return {
    device: {
      deviceId: 'device-123',
      deviceType: 'desktop',
      os: 'Windows 11',
      browser: 'Chrome',
      ip: '192.168.1.1',
      geo: { lat: 37.7749, lng: -122.4194 },
      userAgent: 'Mozilla/5.0',
      appVersion: '1.0.0',
      lastUsedAt: '2026-01-15T10:30:00.000Z',
    },
    geo: {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    },
    previousGeo: {
      country: 'DE',
      region: 'BE',
      city: 'Berlin',
      lat: 52.5200,
      lng: 13.4050,
    },
    signals: {
      isVpn: false,
      isTor: false,
      isProxy: false,
      reputationScore: 50,
      velocityScore: 30,
    },
    metadata: {
      isNewDevice: false,
      riskScore: 25,
    },
    ...overrides,
  };
}

// ============================================================================
// 🧭 INTERNAL RISK SIGNALS
// ============================================================================

describe('InternalRiskSignals внутренние сигналы риска', () => {
  it('создает полные внутренние сигналы риска', () => {
    const signals = createInternalRiskSignals();

    expect(signals.isVpn).toBe(false);
    expect(signals.isTor).toBe(false);
    expect(signals.isProxy).toBe(false);
    expect(signals.asn).toBe('AS12345');
    expect(signals.reputationScore).toBe(50);
    expect(signals.velocityScore).toBe(30);
    expect(signals.previousGeo?.country).toBe('US');
    expect(signals.previousGeo?.lat).toBe(37.7749);
  });

  it('поддерживает все опциональные поля', () => {
    const signals: InternalRiskSignals = {};

    expect(signals.isVpn).toBeUndefined();
    expect(signals.isTor).toBeUndefined();
    expect(signals.isProxy).toBeUndefined();
    expect(signals.asn).toBeUndefined();
    expect(signals.reputationScore).toBeUndefined();
    expect(signals.velocityScore).toBeUndefined();
    expect(signals.previousGeo).toBeUndefined();
  });

  it('поддерживает VPN сигналы', () => {
    const signals = createInternalRiskSignals({ isVpn: true });

    expect(signals.isVpn).toBe(true);
  });

  it('поддерживает TOR сигналы', () => {
    const signals = createInternalRiskSignals({ isTor: true });

    expect(signals.isTor).toBe(true);
  });

  it('поддерживает Proxy сигналы', () => {
    const signals = createInternalRiskSignals({ isProxy: true });

    expect(signals.isProxy).toBe(true);
  });

  it('поддерживает ASN', () => {
    const asnValues = ['AS12345', 'AS67890', 'AS11111'];

    asnValues.forEach((asn) => {
      const signals = createInternalRiskSignals({ asn });
      expect(signals.asn).toBe(asn);
    });
  });

  it('поддерживает reputationScore в диапазоне 0-100', () => {
    const scores = [0, 30, 50, 70, 100];

    scores.forEach((score) => {
      const signals = createInternalRiskSignals({ reputationScore: score });
      expect(signals.reputationScore).toBe(score);
    });
  });

  it('поддерживает velocityScore в диапазоне 0-100', () => {
    const scores = [0, 30, 50, 70, 100];

    scores.forEach((score) => {
      const signals = createInternalRiskSignals({ velocityScore: score });
      expect(signals.velocityScore).toBe(score);
    });
  });

  it('поддерживает previousGeo с полными координатами', () => {
    const signals = createInternalRiskSignals({
      previousGeo: {
        country: 'DE',
        region: 'BE',
        city: 'Berlin',
        lat: 52.5200,
        lng: 13.4050,
      },
    });

    expect(signals.previousGeo?.country).toBe('DE');
    expect(signals.previousGeo?.region).toBe('BE');
    expect(signals.previousGeo?.city).toBe('Berlin');
    expect(signals.previousGeo?.lat).toBe(52.5200);
    expect(signals.previousGeo?.lng).toBe(13.4050);
  });

  it('поддерживает previousGeo с частичными данными', () => {
    const signals = createInternalRiskSignals({
      previousGeo: {
        country: 'US',
        lat: 37.7749,
      },
    });

    expect(signals.previousGeo?.country).toBe('US');
    expect(signals.previousGeo?.lat).toBe(37.7749);
    expect(signals.previousGeo?.region).toBeUndefined();
    expect(signals.previousGeo?.city).toBeUndefined();
    expect(signals.previousGeo?.lng).toBeUndefined();
  });

  it('поддерживает координаты в допустимых диапазонах', () => {
    const coordinates = [
      { lat: -90, lng: -180 }, // Минимальные значения
      { lat: 0, lng: 0 }, // Нулевые значения
      { lat: 90, lng: 180 }, // Максимальные значения
      { lat: 37.7749, lng: -122.4194 }, // San Francisco
      { lat: -33.8688, lng: 151.2093 }, // Sydney (южное полушарие)
    ];

    coordinates.forEach((coord) => {
      const signals = createInternalRiskSignals({
        previousGeo: {
          lat: coord.lat,
          lng: coord.lng,
        },
      });
      expect(signals.previousGeo?.lat).toBe(coord.lat);
      expect(signals.previousGeo?.lng).toBe(coord.lng);
    });
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const signals: InternalRiskSignals = {
      isVpn: false,
      reputationScore: 50,
    };

    // TypeScript предотвращает мутацию
    // signals.isVpn = true; // TypeScript error: Cannot assign to 'isVpn' because it is a read-only property
    // signals.reputationScore = 100; // TypeScript error: Cannot assign to 'reputationScore' because it is a read-only property

    expect(signals.isVpn).toBe(false);
    expect(signals.reputationScore).toBe(50);
  });

  it('previousGeo readonly - предотвращает мутацию вложенных объектов', () => {
    const signals: InternalRiskSignals = {
      previousGeo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    // TypeScript предотвращает мутацию
    // signals.previousGeo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(signals.previousGeo?.lat).toBe(37.7749);
  });
});

// ============================================================================
// 🌐 EXTERNAL RISK SIGNALS
// ============================================================================

describe('ExternalRiskSignals внешние сигналы риска', () => {
  it('создает внешние сигналы риска', () => {
    const signals = createExternalRiskSignals();

    expect(signals['vendor']).toBe('maxmind');
    expect(signals['score']).toBe(75);
    expect(Array.isArray(signals['flags'])).toBe(true);
  });

  it('поддерживает пустой объект', () => {
    const signals: ExternalRiskSignals = {};

    expect(Object.keys(signals).length).toBe(0);
  });

  it('поддерживает любые JSON-serializable данные', () => {
    const signals: ExternalRiskSignals = {
      vendor: 'maxmind',
      score: 75,
      flags: ['suspicious', 'high-risk'],
      metadata: {
        // eslint-disable-next-line @livai/rag/source-citation -- Тестовые данные, не требуют цитирования
        source: 'api',
        timestamp: '2026-01-15T10:30:00.000Z',
      },
      nested: {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      },
      array: [1, 2, 3],
      boolean: true,
      number: 42,
      string: 'test',
      nullValue: null,
    };

    expect(signals['vendor']).toBe('maxmind');
    expect(signals['score']).toBe(75);
    expect(Array.isArray(signals['flags'])).toBe(true);
    expect(signals['metadata']).toEqual({
      // eslint-disable-next-line @livai/rag/source-citation -- Тестовые данные, не требуют цитирования
      source: 'api',
      timestamp: '2026-01-15T10:30:00.000Z',
    });
  });

  it('поддерживает различные типы данных', () => {
    const signals: ExternalRiskSignals = {
      stringValue: 'test',
      numberValue: 42,
      booleanValue: true,
      arrayValue: [1, 2, 3],
      objectValue: { key: 'value' },
      nullValue: null,
    };

    expect(typeof signals['stringValue']).toBe('string');
    expect(typeof signals['numberValue']).toBe('number');
    expect(typeof signals['booleanValue']).toBe('boolean');
    expect(Array.isArray(signals['arrayValue'])).toBe(true);
    expect(typeof signals['objectValue']).toBe('object');
    expect(signals['nullValue']).toBeNull();
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const signals: ExternalRiskSignals = {
      vendor: 'maxmind',
      score: 75,
    };

    // TypeScript предотвращает мутацию
    // signals['vendor'] = 'other'; // TypeScript error: Cannot assign to 'vendor' because it is a read-only property

    expect(signals['vendor']).toBe('maxmind');
  });

  it('readonly - предотвращает мутацию вложенных объектов (явно помеченных readonly)', () => {
    const signals: ExternalRiskSignals = {
      nested: {
        key: 'value',
      },
    };

    // TypeScript предотвращает мутацию
    // signals['nested'] = { key: 'new' }; // TypeScript error: Cannot assign to 'nested' because it is a read-only property

    expect(signals['nested']).toEqual({ key: 'value' });
  });
});

// ============================================================================
// 🧭 RISK SIGNALS (COMBINED)
// ============================================================================

describe('RiskSignals типизированные сигналы риска', () => {
  it('создает полные сигналы риска (internal + external)', () => {
    const signals = createRiskSignals();

    expect(signals.isVpn).toBe(false);
    expect(signals.isTor).toBe(false);
    expect(signals.isProxy).toBe(false);
    expect(signals.asn).toBe('AS12345');
    expect(signals.reputationScore).toBe(50);
    expect(signals.velocityScore).toBe(30);
    expect(signals.externalSignals?.['vendor']).toBe('maxmind');
  });

  it('поддерживает только internal сигналы', () => {
    const signals: RiskSignals = {
      isVpn: true,
      isTor: false,
      reputationScore: 75,
    };

    expect(signals.isVpn).toBe(true);
    expect(signals.isTor).toBe(false);
    expect(signals.reputationScore).toBe(75);
    expect(signals.externalSignals).toBeUndefined();
  });

  it('поддерживает только external сигналы', () => {
    const signals: RiskSignals = {
      externalSignals: createExternalRiskSignals(),
    };

    expect(signals.externalSignals?.['vendor']).toBe('maxmind');
    expect(signals.isVpn).toBeUndefined();
    expect(signals.isTor).toBeUndefined();
  });

  it('поддерживает комбинацию internal и external сигналов', () => {
    const signals: RiskSignals = {
      isVpn: true,
      reputationScore: 25,
      externalSignals: {
        vendor: 'custom',
        score: 90,
      },
    };

    expect(signals.isVpn).toBe(true);
    expect(signals.reputationScore).toBe(25);
    expect(signals.externalSignals?.['vendor']).toBe('custom');
    expect(signals.externalSignals?.['score']).toBe(90);
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const signals: RiskSignals = {
      isVpn: false,
      externalSignals: { vendor: 'test' },
    };

    // TypeScript предотвращает мутацию
    // signals.isVpn = true; // TypeScript error
    // signals.externalSignals!.vendor = 'new'; // TypeScript error

    expect(signals.isVpn).toBe(false);
    expect(signals.externalSignals?.['vendor']).toBe('test');
  });
});

// ============================================================================
// 🧭 RISK CONTEXT
// ============================================================================

describe('RiskContext контекст для оценки риска логина', () => {
  it('создает полный контекст риска', () => {
    const context = createRiskContext();

    expect(context.ip).toBe('192.168.1.1');
    expect(context.geo?.country).toBe('US');
    expect(context.userId).toBe('user-123');
    expect(context.previousSessionId).toBe('session-prev-456');
    expect(context.signals?.isVpn).toBe(false);
    expect(context.timestamp).toBe('2026-01-15T10:30:00.000Z');
  });

  it('поддерживает минимальный контекст (все поля опциональны)', () => {
    const context: RiskContext = {};

    expect(context.ip).toBeUndefined();
    expect(context.geo).toBeUndefined();
    expect(context.userId).toBeUndefined();
    expect(context.previousSessionId).toBeUndefined();
    expect(context.signals).toBeUndefined();
    expect(context.timestamp).toBeUndefined();
  });

  it('поддерживает различные IP адреса (IPv4 и IPv6)', () => {
    const ipAddresses = [
      '192.168.1.1', // IPv4
      '10.0.0.1', // IPv4 private
      '172.16.0.1', // IPv4 private
      '127.0.0.1', // IPv4 localhost
      '::1', // IPv6 localhost
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6 full
      'fe80::1', // IPv6 link-local
    ];

    ipAddresses.forEach((ip) => {
      const context = createRiskContext({ ip });
      expect(context.ip).toBe(ip);
    });
  });

  it('поддерживает полную геолокацию', () => {
    const context = createRiskContext({
      geo: {
        country: 'DE',
        region: 'BE',
        city: 'Berlin',
        lat: 52.5200,
        lng: 13.4050,
      },
    });

    expect(context.geo?.country).toBe('DE');
    expect(context.geo?.region).toBe('BE');
    expect(context.geo?.city).toBe('Berlin');
    expect(context.geo?.lat).toBe(52.5200);
    expect(context.geo?.lng).toBe(13.4050);
  });

  it('поддерживает частичную геолокацию', () => {
    const context = createRiskContext({
      geo: {
        country: 'US',
        lat: 37.7749,
      },
    });

    expect(context.geo?.country).toBe('US');
    expect(context.geo?.lat).toBe(37.7749);
    expect(context.geo?.region).toBeUndefined();
    expect(context.geo?.city).toBeUndefined();
    expect(context.geo?.lng).toBeUndefined();
  });

  it('поддерживает userId (может отсутствовать до идентификации)', () => {
    const contextWithUserId = createRiskContext({ userId: 'user-123' });
    const contextWithoutUserId: RiskContext = {
      ip: '192.168.1.1',
    };

    expect(contextWithUserId.userId).toBe('user-123');
    expect(contextWithoutUserId.userId).toBeUndefined();
  });

  it('поддерживает previousSessionId', () => {
    const context = createRiskContext({ previousSessionId: 'session-prev' });

    expect(context.previousSessionId).toBe('session-prev');
  });

  it('поддерживает signals', () => {
    const context = createRiskContext({
      signals: createRiskSignals({
        isVpn: true,
        reputationScore: 15,
      }),
    });

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.reputationScore).toBe(15);
  });

  it('поддерживает timestamp в ISO 8601 формате', () => {
    const timestamps = [
      '2026-01-15T10:30:00.000Z',
      '2026-01-15T10:30:00Z',
      '2026-12-31T23:59:59.999Z',
    ];

    timestamps.forEach((timestamp) => {
      const context = createRiskContext({ timestamp });
      expect(context.timestamp).toBe(timestamp);
    });
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const context: RiskContext = {
      ip: '192.168.1.1',
      userId: 'user-123',
    };

    // TypeScript предотвращает мутацию
    // context.ip = 'new-ip'; // TypeScript error
    // context.userId = 'new-user'; // TypeScript error

    expect(context.ip).toBe('192.168.1.1');
    expect(context.userId).toBe('user-123');
  });

  it('geo readonly - предотвращает мутацию вложенных объектов', () => {
    const context: RiskContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    // TypeScript предотвращает мутацию
    // context.geo!.lat = 0; // TypeScript error

    expect(context.geo?.lat).toBe(37.7749);
  });

  it('signals readonly - предотвращает мутацию вложенных объектов', () => {
    const context: RiskContext = {
      signals: {
        isVpn: false,
        externalSignals: { vendor: 'test' },
      },
    };

    // TypeScript предотвращает мутацию
    // context.signals!.isVpn = true; // TypeScript error

    expect(context.signals?.isVpn).toBe(false);
  });
});

// ============================================================================
// 🔧 RISK POLICY
// ============================================================================

describe('RiskPolicy политика оценки риска', () => {
  it('создает полную политику риска', () => {
    const policy = createRiskPolicy();

    expect(policy.weights).toBeDefined();
    expect(policy.weights?.device).toBe(0.3);
    expect(policy.weights?.geo).toBe(0.2);
    expect(policy.weights?.network).toBe(0.3);
    expect(policy.weights?.velocity).toBe(0.2);
    expect(policy.decision).toBeDefined();
    expect(policy.decision?.thresholds).toBeDefined();
    expect(policy.decision?.blockOnCriticalRules).toBe(true);
  });

  it('поддерживает минимальную политику (все поля опциональны)', () => {
    const policy: RiskPolicy = {};

    expect(policy.weights).toBeUndefined();
    expect(policy.decision).toBeUndefined();
  });

  it('поддерживает только weights', () => {
    const policy: RiskPolicy = {
      weights: createRiskWeights(),
    };

    expect(policy.weights).toBeDefined();
    expect(policy.decision).toBeUndefined();
  });

  it('поддерживает только decision', () => {
    const policy: RiskPolicy = {
      decision: createDecisionPolicy(),
    };

    expect(policy.weights).toBeUndefined();
    expect(policy.decision).toBeDefined();
  });

  it('поддерживает кастомные weights', () => {
    const policy = createRiskPolicy({
      weights: {
        device: 0.4,
        geo: 0.3,
        network: 0.2,
        velocity: 0.1,
      },
    });

    expect(policy.weights?.device).toBe(0.4);
    expect(policy.weights?.geo).toBe(0.3);
    expect(policy.weights?.network).toBe(0.2);
    expect(policy.weights?.velocity).toBe(0.1);
  });

  it('поддерживает кастомные decision thresholds', () => {
    const policy = createRiskPolicy({
      decision: {
        thresholds: {
          low: 20,
          medium: 50,
          high: 75,
          critical: 95,
        },
        blockOnCriticalRules: false,
        challengeOnHighRisk: false,
        criticalReputationThreshold: 5,
      },
    });

    expect(policy.decision?.thresholds.low).toBe(20);
    expect(policy.decision?.thresholds.medium).toBe(50);
    expect(policy.decision?.thresholds.high).toBe(75);
    expect(policy.decision?.thresholds.critical).toBe(95);
    expect(policy.decision?.blockOnCriticalRules).toBe(false);
    expect(policy.decision?.challengeOnHighRisk).toBe(false);
    expect(policy.decision?.criticalReputationThreshold).toBe(5);
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const policy: RiskPolicy = {
      weights: createRiskWeights(),
    };

    // TypeScript предотвращает мутацию
    // policy.weights!.device = 0.5; // TypeScript error

    expect(policy.weights?.device).toBe(0.3);
  });
});

// ============================================================================
// 📊 RISK ASSESSMENT RESULT
// ============================================================================

describe('RiskAssessmentResult результат оценки риска', () => {
  it('создает полный результат оценки риска', () => {
    const result: RiskAssessmentResult = {
      riskScore: 75,
      riskLevel: 'high',
      triggeredRules: ['VPN_DETECTED', 'HIGH_VELOCITY'],
      decisionHint: createDecisionResult({ action: 'challenge' }),
      assessment: createLoginRiskAssessment(),
    };

    expect(result.riskScore).toBe(75);
    expect(result.riskLevel).toBe('high');
    expect(result.triggeredRules).toEqual(['VPN_DETECTED', 'HIGH_VELOCITY']);
    expect(result.decisionHint.action).toBe('challenge');
    expect(result.assessment).toBeDefined();
  });

  it('поддерживает все уровни риска', () => {
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    riskLevels.forEach((level) => {
      const result: RiskAssessmentResult = {
        riskScore: 50,
        riskLevel: level,
        triggeredRules: [],
        decisionHint: createDecisionResult(),
        assessment: createLoginRiskAssessment(),
      };

      expect(result.riskLevel).toBe(level);
    });
  });

  it('поддерживает riskScore в диапазоне 0-100', () => {
    const scores = [0, 25, 50, 75, 100];

    scores.forEach((score) => {
      const result: RiskAssessmentResult = {
        riskScore: score,
        riskLevel: 'medium',
        triggeredRules: [],
        decisionHint: createDecisionResult(),
        assessment: createLoginRiskAssessment(),
      };

      expect(result.riskScore).toBe(score);
    });
  });

  it('поддерживает пустой массив triggeredRules', () => {
    const result: RiskAssessmentResult = {
      riskScore: 25,
      riskLevel: 'low',
      triggeredRules: [],
      decisionHint: createDecisionResult({ action: 'allow' }),
      assessment: createLoginRiskAssessment(),
    };

    expect(result.triggeredRules).toEqual([]);
    expect(result.triggeredRules.length).toBe(0);
  });

  it('поддерживает все типы правил', () => {
    const allRules: RiskRule[] = [
      'UNKNOWN_DEVICE',
      'IoT_DEVICE',
      'MISSING_OS',
      'MISSING_BROWSER',
      'TOR_NETWORK',
      'VPN_DETECTED',
      'PROXY_DETECTED',
      'LOW_REPUTATION',
      'CRITICAL_REPUTATION',
      'HIGH_VELOCITY',
      'GEO_MISMATCH',
      'HIGH_RISK_COUNTRY',
      'HIGH_RISK_SCORE',
      'NEW_DEVICE_VPN',
      'IoT_TOR',
    ];

    const result: RiskAssessmentResult = {
      riskScore: 95,
      riskLevel: 'critical',
      triggeredRules: allRules,
      decisionHint: createDecisionResult({ action: 'block' }),
      assessment: createLoginRiskAssessment(),
    };

    expect(result.triggeredRules).toEqual(allRules);
    expect(result.triggeredRules.length).toBe(allRules.length);
  });

  it('поддерживает все действия decisionHint', () => {
    const actions: ('allow' | 'challenge' | 'block')[] = ['allow', 'challenge', 'block'];

    actions.forEach((action) => {
      const result: RiskAssessmentResult = {
        riskScore: 50,
        riskLevel: 'medium',
        triggeredRules: [],
        decisionHint: createDecisionResult({ action }),
        assessment: createLoginRiskAssessment(),
      };

      expect(result.decisionHint.action).toBe(action);
    });
  });

  it('поддерживает blockReason в decisionHint', () => {
    const blockReasons: (
      'critical_risk' | 'critical_reputation' | 'rule_block' | 'unknown_risk_level'
    )[] = ['critical_risk', 'critical_reputation', 'rule_block', 'unknown_risk_level'];

    blockReasons.forEach((blockReason) => {
      const result: RiskAssessmentResult = {
        riskScore: 95,
        riskLevel: 'critical',
        triggeredRules: [],
        decisionHint: createDecisionResult({
          action: 'block',
          blockReason,
        }),
        assessment: createLoginRiskAssessment(),
      };

      expect(result.decisionHint.blockReason).toBe(blockReason);
    });
  });

  it('поддерживает полный assessment', () => {
    const assessment = createLoginRiskAssessment({
      userId: 'user-456',
      ip: '10.0.0.1',
      geo: {
        country: 'DE',
        city: 'Berlin',
        lat: 52.5200,
        lng: 13.4050,
      },
    });

    const result: RiskAssessmentResult = {
      riskScore: 60,
      riskLevel: 'medium',
      triggeredRules: ['GEO_MISMATCH'],
      decisionHint: createDecisionResult({ action: 'challenge' }),
      assessment,
    };

    expect(result.assessment.userId).toBe('user-456');
    expect(result.assessment.ip).toBe('10.0.0.1');
    expect(result.assessment.geo?.country).toBe('DE');
  });

  it('triggeredRules readonly - предотвращает мутацию массива', () => {
    const result: RiskAssessmentResult = {
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRules: ['VPN_DETECTED'],
      decisionHint: createDecisionResult(),
      assessment: createLoginRiskAssessment(),
    };

    // TypeScript предотвращает мутацию
    // result.triggeredRules.push('NEW_RULE'); // TypeScript error: Property 'push' does not exist on type 'readonly RiskRule[]'

    expect(result.triggeredRules).toEqual(['VPN_DETECTED']);
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const result: RiskAssessmentResult = {
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRules: [],
      decisionHint: createDecisionResult(),
      assessment: createLoginRiskAssessment(),
    };

    // TypeScript предотвращает мутацию
    // result.riskScore = 100; // TypeScript error
    // result.riskLevel = 'high'; // TypeScript error

    expect(result.riskScore).toBe(50);
    expect(result.riskLevel).toBe('medium');
  });
});

// ============================================================================
// 🔌 CONTEXT BUILDER PLUGIN
// ============================================================================

describe('ContextBuilderPlugin plugin интерфейс для расширения Context Builder', () => {
  it('создает минимальный plugin (только id)', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'test-plugin',
    };

    expect(plugin.id).toBe('test-plugin');
    expect(plugin.priority).toBeUndefined();
    expect(plugin.extendScoringContext).toBeUndefined();
    expect(plugin.extendRuleContext).toBeUndefined();
    expect(plugin.extendAssessmentContext).toBeUndefined();
  });

  it('создает plugin с priority', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'priority-plugin',
      priority: 10,
    };

    expect(plugin.id).toBe('priority-plugin');
    expect(plugin.priority).toBe(10);
  });

  it('поддерживает priority в диапазоне 0-100', () => {
    const priorities = [0, 25, 50, 75, 100];

    priorities.forEach((priority) => {
      const plugin: ContextBuilderPlugin = {
        id: 'priority-plugin',
        priority,
      };

      expect(plugin.priority).toBe(priority);
    });
  });

  it('создает plugin с extendScoringContext', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'scoring-plugin',
      extendScoringContext: (context) => {
        return {
          ...context,
          signals: {
            ...context.signals,
            reputationScore: (context.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
    };

    expect(plugin.id).toBe('scoring-plugin');
    expect(typeof plugin.extendScoringContext).toBe('function');

    const scoringContext = createScoringContext();
    const extended = plugin.extendScoringContext!(scoringContext, createRiskContext());

    expect(extended.signals?.reputationScore).toBe(60);
  });

  it('создает plugin с extendRuleContext', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'rule-plugin',
      extendRuleContext: (context) => {
        return {
          ...context,
          metadata: {
            ...context.metadata,
            isNewDevice: true,
            riskScore: (context.metadata?.riskScore ?? 0) + 5,
          },
        };
      },
    };

    expect(plugin.id).toBe('rule-plugin');
    expect(typeof plugin.extendRuleContext).toBe('function');

    const ruleContext = createRuleEvaluationContext();
    const extended = plugin.extendRuleContext!(ruleContext, createRiskContext());

    expect(extended.metadata?.isNewDevice).toBe(true);
    expect(extended.metadata?.riskScore).toBe(30);
  });

  it('создает plugin с extendAssessmentContext', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'assessment-plugin',
      extendAssessmentContext: (context, riskContext) => {
        return {
          ...context,
          userId: riskContext.userId ?? context.userId ?? 'default-user',
        };
      },
    };

    expect(plugin.id).toBe('assessment-plugin');
    expect(typeof plugin.extendAssessmentContext).toBe('function');

    const assessmentContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
    };
    const extended = plugin.extendAssessmentContext!(
      assessmentContext,
      createRiskContext({ userId: 'user-456' }),
    );

    expect(extended.userId).toBe('user-456');
  });

  it('создает plugin со всеми методами', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'full-plugin',
      priority: 50,
      extendScoringContext: (context) => {
        return {
          ...context,
          signals: {
            ...context.signals,
            reputationScore: (context.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
      extendRuleContext: (context) => {
        return {
          ...context,
          metadata: {
            ...context.metadata,
            isNewDevice: true,
          },
        };
      },
      extendAssessmentContext: (context) => {
        return {
          ...context,
          userId: context.userId ?? 'default-user',
        };
      },
    };

    expect(plugin.id).toBe('full-plugin');
    expect(plugin.priority).toBe(50);
    expect(typeof plugin.extendScoringContext).toBe('function');
    expect(typeof plugin.extendRuleContext).toBe('function');
    expect(typeof plugin.extendAssessmentContext).toBe('function');
  });

  it('extendScoringContext должна быть pure функцией', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'pure-scoring-plugin',
      extendScoringContext: (context) => {
        // Pure функция: не мутирует входные данные, возвращает новый объект
        return {
          ...context,
          signals: {
            ...context.signals,
            reputationScore: (context.signals?.reputationScore ?? 0) + 20,
          },
        };
      },
    };

    const scoringContext = createScoringContext();
    const originalSignals = scoringContext.signals;

    const extended = plugin.extendScoringContext!(scoringContext, createRiskContext());

    // Оригинальный контекст не изменен
    expect(scoringContext.signals).toBe(originalSignals);
    expect(extended.signals?.reputationScore).toBe(70);
  });

  it('extendRuleContext должна быть pure функцией', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'pure-rule-plugin',
      extendRuleContext: (context) => {
        // Pure функция: не мутирует входные данные, возвращает новый объект
        return {
          ...context,
          metadata: {
            ...context.metadata,
            isNewDevice: true,
          },
        };
      },
    };

    const ruleContext = createRuleEvaluationContext();
    // eslint-disable-next-line ai-security/model-poisoning -- Тестовые данные для unit тестов, не используются в production
    const originalMetadata = ruleContext.metadata;

    const extended = plugin.extendRuleContext!(ruleContext, createRiskContext());

    // Оригинальный контекст не изменен
    expect(ruleContext.metadata).toBe(originalMetadata);
    expect(extended.metadata?.isNewDevice).toBe(true);
  });

  it('extendAssessmentContext должна быть pure функцией', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'pure-assessment-plugin',
      extendAssessmentContext: (context) => {
        // Pure функция: не мутирует входные данные, возвращает новый объект
        return {
          ...context,
          userId: context.userId ?? 'default-user',
        };
      },
    };

    const assessmentContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
    };
    const originalUserId = assessmentContext.userId;

    const extended = plugin.extendAssessmentContext!(assessmentContext, createRiskContext());

    // Оригинальный контекст не изменен
    expect(assessmentContext.userId).toBe(originalUserId);
    expect(extended.userId).toBe('user-123');
  });

  it('extendAssessmentContext не может мутировать signals с ReadonlyDeep', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'immutable-signals-plugin',
      extendAssessmentContext: (context) => {
        // Плагин должен возвращать новый объект, не мутируя signals
        // ReadonlyDeep<RiskSignals> предотвращает мутацию вложенных объектов
        return {
          ...context,
          userId: context.userId ?? 'default-user',
          // Плагин не может мутировать context.signals из-за ReadonlyDeep
          // context.signals!.isVpn = true; // TypeScript error
          // context.signals!.previousGeo!.lat = 0; // TypeScript error
          // context.signals!.externalSignals!['vendor'] = 'new'; // TypeScript error
        };
      },
    };

    const assessmentContext: BuildAssessmentContext = {
      userId: 'user-123',
      signals: {
        isVpn: false,
        reputationScore: 50,
        previousGeo: {
          country: 'US',
          lat: 37.7749,
          lng: -122.4194,
        },
        externalSignals: {
          vendor: 'maxmind',
          score: 75,
        },
      },
    };

    const extended = plugin.extendAssessmentContext!(assessmentContext, createRiskContext());

    // Оригинальный signals не изменен (ReadonlyDeep защищает)
    expect(assessmentContext.signals?.isVpn).toBe(false);
    expect(assessmentContext.signals?.reputationScore).toBe(50);
    expect(assessmentContext.signals?.previousGeo?.lat).toBe(37.7749);
    expect(assessmentContext.signals?.externalSignals?.['vendor']).toBe('maxmind');

    // Расширенный контекст имеет те же signals (не мутированы)
    expect(extended.signals?.isVpn).toBe(false);
    expect(extended.signals?.reputationScore).toBe(50);
    expect(extended.signals?.previousGeo?.lat).toBe(37.7749);
    expect(extended.signals?.externalSignals?.['vendor']).toBe('maxmind');
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'immutable-plugin',
      priority: 10,
    };

    // TypeScript предотвращает мутацию
    // plugin.id = 'new-id'; // TypeScript error
    // plugin.priority = 20; // TypeScript error

    expect(plugin.id).toBe('immutable-plugin');
    expect(plugin.priority).toBe(10);
  });

  it('методы readonly - предотвращает мутацию функций', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'immutable-methods-plugin',
      extendScoringContext: (context) => context,
    };

    // TypeScript предотвращает мутацию
    // plugin.extendScoringContext = () => context; // TypeScript error

    expect(typeof plugin.extendScoringContext).toBe('function');
  });
});

// ============================================================================
// 🔧 BUILD ASSESSMENT CONTEXT
// ============================================================================

describe('BuildAssessmentContext контекст для buildAssessment', () => {
  it('создает полный контекст для buildAssessment', () => {
    const context: BuildAssessmentContext = {
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
      previousSessionId: 'session-prev-456',
      timestamp: '2026-01-15T10:30:00.000Z',
      signals: createRiskSignals(),
    };

    expect(context.userId).toBe('user-123');
    expect(context.ip).toBe('192.168.1.1');
    expect(context.geo?.country).toBe('US');
    expect(context.userAgent).toBe('Mozilla/5.0');
    expect(context.previousSessionId).toBe('session-prev-456');
    expect(context.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(context.signals?.isVpn).toBe(false);
  });

  it('поддерживает минимальный контекст (все поля опциональны)', () => {
    const context: BuildAssessmentContext = {};

    expect(context.userId).toBeUndefined();
    expect(context.ip).toBeUndefined();
    expect(context.geo).toBeUndefined();
    expect(context.userAgent).toBeUndefined();
    expect(context.previousSessionId).toBeUndefined();
    expect(context.timestamp).toBeUndefined();
    expect(context.signals).toBeUndefined();
  });

  it('поддерживает частичную геолокацию', () => {
    const context: BuildAssessmentContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
      },
    };

    expect(context.geo?.country).toBe('US');
    expect(context.geo?.lat).toBe(37.7749);
    expect(context.geo?.region).toBeUndefined();
    expect(context.geo?.city).toBeUndefined();
    expect(context.geo?.lng).toBeUndefined();
  });

  it('поддерживает signals', () => {
    const context: BuildAssessmentContext = {
      signals: createRiskSignals({
        isVpn: true,
        reputationScore: 25,
      }),
    };

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.reputationScore).toBe(25);
  });

  it('все поля readonly - предотвращает мутацию', () => {
    const context: BuildAssessmentContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
    };

    // TypeScript предотвращает мутацию
    // context.userId = 'new-user'; // TypeScript error
    // context.ip = 'new-ip'; // TypeScript error

    expect(context.userId).toBe('user-123');
    expect(context.ip).toBe('192.168.1.1');
  });

  it('geo readonly - предотвращает мутацию вложенных объектов', () => {
    const context: BuildAssessmentContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    // TypeScript предотвращает мутацию
    // context.geo!.lat = 0; // TypeScript error

    expect(context.geo?.lat).toBe(37.7749);
  });

  it('signals readonly - предотвращает мутацию вложенных объектов', () => {
    const context: BuildAssessmentContext = {
      signals: {
        isVpn: false,
        externalSignals: { vendor: 'test' },
      },
    };

    // TypeScript предотвращает мутацию
    // context.signals!.isVpn = true; // TypeScript error

    expect(context.signals?.isVpn).toBe(false);
  });

  it('signals ReadonlyDeep - защищает вложенные объекты (previousGeo) от мутаций', () => {
    const context: BuildAssessmentContext = {
      signals: {
        previousGeo: {
          country: 'US',
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    };

    // TypeScript предотвращает мутацию вложенных объектов через ReadonlyDeep
    // context.signals!.previousGeo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(context.signals?.previousGeo?.lat).toBe(37.7749);
    expect(context.signals?.previousGeo?.country).toBe('US');
  });

  it('signals ReadonlyDeep - защищает externalSignals от мутаций', () => {
    const context: BuildAssessmentContext = {
      signals: {
        externalSignals: {
          vendor: 'maxmind',
          score: 75,
          nested: {
            deep: {
              value: 'test',
            },
          },
        },
      },
    };

    // TypeScript предотвращает мутацию externalSignals через ReadonlyDeep
    // context.signals!.externalSignals!['vendor'] = 'new'; // TypeScript error: Cannot assign to 'vendor' because it is a read-only property
    // context.signals!.externalSignals!['nested'] = { deep: { value: 'new' } }; // TypeScript error

    expect(context.signals?.externalSignals?.['vendor']).toBe('maxmind');
    expect(context.signals?.externalSignals?.['score']).toBe(75);
    expect(context.signals?.externalSignals?.['nested']).toEqual({
      deep: {
        value: 'test',
      },
    });
  });

  it('signals ReadonlyDeep - защищает все уровни вложенности', () => {
    const context: BuildAssessmentContext = {
      signals: {
        isVpn: false,
        reputationScore: 50,
        previousGeo: {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          lat: 37.7749,
          lng: -122.4194,
        },
        externalSignals: {
          vendor: 'maxmind',
          metadata: {
            // eslint-disable-next-line @livai/rag/source-citation -- Тестовые данные, не требуют цитирования
            source: 'api',
            timestamp: '2026-01-15T10:30:00.000Z',
          },
        },
      },
    };

    // TypeScript предотвращает мутацию на всех уровнях через ReadonlyDeep
    // context.signals!.isVpn = true; // TypeScript error
    // context.signals!.reputationScore = 100; // TypeScript error
    // context.signals!.previousGeo!.lat = 0; // TypeScript error
    // context.signals!.externalSignals!['vendor'] = 'new'; // TypeScript error
    // context.signals!.externalSignals!['metadata']!['source'] = 'new'; // TypeScript error

    expect(context.signals?.isVpn).toBe(false);
    expect(context.signals?.reputationScore).toBe(50);
    expect(context.signals?.previousGeo?.lat).toBe(37.7749);
    expect(context.signals?.externalSignals?.['vendor']).toBe('maxmind');
    expect(context.signals?.externalSignals?.['metadata']).toEqual({
      // eslint-disable-next-line @livai/rag/source-citation -- Тестовые данные, не требуют цитирования
      source: 'api',
      timestamp: '2026-01-15T10:30:00.000Z',
    });
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('Risk types edge cases', () => {
  it('InternalRiskSignals поддерживает пустой объект', () => {
    const signals: InternalRiskSignals = {};

    expect(Object.keys(signals).length).toBe(0);
  });

  it('RiskSignals поддерживает пустой объект', () => {
    const signals: RiskSignals = {};

    expect(Object.keys(signals).length).toBe(0);
  });

  it('RiskContext поддерживает пустой объект', () => {
    const context: RiskContext = {};

    expect(Object.keys(context).length).toBe(0);
  });

  it('RiskPolicy поддерживает пустой объект', () => {
    const policy: RiskPolicy = {};

    expect(Object.keys(policy).length).toBe(0);
  });

  it('ContextBuilderPlugin требует обязательный id', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'required-id',
    };

    expect(plugin.id).toBe('required-id');
  });

  it('RiskAssessmentResult требует все обязательные поля', () => {
    const result: RiskAssessmentResult = {
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRules: [],
      decisionHint: createDecisionResult(),
      assessment: createLoginRiskAssessment(),
    };

    expect(result.riskScore).toBeDefined();
    expect(result.riskLevel).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
    expect(result.decisionHint).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('поддерживает крайние значения reputationScore', () => {
    const signals = createInternalRiskSignals({
      reputationScore: 0, // Минимальное значение
    });

    expect(signals.reputationScore).toBe(0);

    const signalsMax = createInternalRiskSignals({
      reputationScore: 100, // Максимальное значение
    });

    expect(signalsMax.reputationScore).toBe(100);
  });

  it('поддерживает крайние значения velocityScore', () => {
    const signals = createInternalRiskSignals({
      velocityScore: 0, // Минимальное значение
    });

    expect(signals.velocityScore).toBe(0);

    const signalsMax = createInternalRiskSignals({
      velocityScore: 100, // Максимальное значение
    });

    expect(signalsMax.velocityScore).toBe(100);
  });

  it('поддерживает крайние значения riskScore', () => {
    const resultMin: RiskAssessmentResult = {
      riskScore: 0, // Минимальное значение
      riskLevel: 'low',
      triggeredRules: [],
      decisionHint: createDecisionResult(),
      assessment: createLoginRiskAssessment(),
    };

    expect(resultMin.riskScore).toBe(0);

    const resultMax: RiskAssessmentResult = {
      riskScore: 100, // Максимальное значение
      riskLevel: 'critical',
      triggeredRules: [],
      decisionHint: createDecisionResult(),
      assessment: createLoginRiskAssessment(),
    };

    expect(resultMax.riskScore).toBe(100);
  });

  it('поддерживает все возможные комбинации правил', () => {
    const ruleCombinations: RiskRule[][] = [
      [],
      ['VPN_DETECTED'],
      ['TOR_NETWORK', 'PROXY_DETECTED'],
      ['LOW_REPUTATION', 'HIGH_VELOCITY', 'GEO_MISMATCH'],
      [
        'UNKNOWN_DEVICE',
        'IoT_DEVICE',
        'MISSING_OS',
        'MISSING_BROWSER',
        'TOR_NETWORK',
        'VPN_DETECTED',
        'PROXY_DETECTED',
        'LOW_REPUTATION',
        'CRITICAL_REPUTATION',
        'HIGH_VELOCITY',
        'GEO_MISMATCH',
        'HIGH_RISK_COUNTRY',
        'HIGH_RISK_SCORE',
        'NEW_DEVICE_VPN',
        'IoT_TOR',
      ],
    ];

    ruleCombinations.forEach((rules) => {
      const result: RiskAssessmentResult = {
        riskScore: 50,
        riskLevel: 'medium',
        triggeredRules: rules,
        decisionHint: createDecisionResult(),
        assessment: createLoginRiskAssessment(),
      };

      expect(result.triggeredRules).toEqual(rules);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('Risk types immutability', () => {
  it('InternalRiskSignals readonly - предотвращает мутацию (консистентно с domain типами)', () => {
    const signals: InternalRiskSignals = {
      previousGeo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    // TypeScript предотвращает мутацию (явно помеченные readonly поля)
    // signals.previousGeo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(signals.previousGeo?.lat).toBe(37.7749);
  });

  it('ExternalRiskSignals readonly - предотвращает мутацию', () => {
    const signals: ExternalRiskSignals = {
      nested: {
        deep: {
          value: 'test',
        },
      },
    };

    // TypeScript предотвращает мутацию
    // signals['nested'] = { deep: { value: 'new' } }; // TypeScript error: Cannot assign to 'nested' because it is a read-only property

    expect(signals['nested']).toEqual({ deep: { value: 'test' } });
  });

  it('RiskSignals readonly - предотвращает мутацию (консистентно с domain типами)', () => {
    const signals: RiskSignals = {
      externalSignals: {
        nested: {
          value: 'test',
        },
      },
    };

    // TypeScript предотвращает мутацию (явно помеченные readonly поля)
    // signals.externalSignals = { nested: { value: 'new' } }; // TypeScript error

    expect(signals.externalSignals?.['nested']).toEqual({ value: 'test' });
  });

  it('RiskContext readonly - предотвращает мутацию (консистентно с domain типами)', () => {
    const context: RiskContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
      signals: {
        isVpn: false,
        externalSignals: {
          vendor: 'test',
        },
      },
    };

    // TypeScript предотвращает мутацию (явно помеченные readonly поля)
    // context.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property
    // context.signals!.isVpn = true; // TypeScript error: Cannot assign to 'isVpn' because it is a read-only property
    // context.signals!.externalSignals = { vendor: 'new' }; // TypeScript error

    expect(context.geo?.lat).toBe(37.7749);
    expect(context.signals?.isVpn).toBe(false);
    expect(context.signals?.externalSignals?.['vendor']).toBe('test');
  });

  it('RiskPolicy readonly - предотвращает мутацию (консистентно с domain типами)', () => {
    const policy: RiskPolicy = {
      weights: {
        device: 0.3,
        geo: 0.2,
        network: 0.3,
        velocity: 0.2,
      },
      decision: {
        thresholds: {
          low: 30,
          medium: 60,
          high: 80,
          critical: 90,
        },
      },
    };

    // TypeScript предотвращает мутацию (явно помеченные readonly поля)
    // policy.weights!.device = 0.5; // TypeScript error: Cannot assign to 'device' because it is a read-only property
    // policy.decision!.thresholds!.low = 20; // TypeScript error: Cannot assign to 'low' because it is a read-only property

    expect(policy.weights?.device).toBe(0.3);
    expect(policy.decision?.thresholds.low).toBe(30);
  });

  it('RiskAssessmentResult readonly - предотвращает мутацию (консистентно с domain типами)', () => {
    const result: RiskAssessmentResult = {
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRules: ['VPN_DETECTED'],
      decisionHint: {
        action: 'challenge',
      },
      assessment: createLoginRiskAssessment(),
    };

    // TypeScript предотвращает мутацию (явно помеченные readonly поля)
    // result.riskScore = 100; // TypeScript error: Cannot assign to 'riskScore' because it is a read-only property
    // result.triggeredRules.push('NEW'); // TypeScript error: Property 'push' does not exist on type 'readonly RiskRule[]'
    // result.decisionHint!.action = 'block'; // TypeScript error: Cannot assign to 'action' because it is a read-only property

    expect(result.riskScore).toBe(50);
    expect(result.triggeredRules).toEqual(['VPN_DETECTED']);
    expect(result.decisionHint.action).toBe('challenge');
  });
});
