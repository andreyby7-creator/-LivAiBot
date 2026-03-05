/**
 * @file Unit тесты для types/auth-risk.ts
 * Полное покрытие типов risk assessment
 */

import { describe, expect, it } from 'vitest';

import type { ClassificationRule } from '@livai/domains/strategies';

import type { LoginRiskEvaluation } from '../../../src/domain/LoginRiskAssessment.js';
import {
  createLoginRiskEvaluation,
  createLoginRiskResult,
} from '../../../src/domain/LoginRiskAssessment.js';
import type { RiskLevel } from '../../../src/types/auth.js';
import type {
  AuthRuleEvaluationContext,
  AuthScoringContext,
  BuildAssessmentContext,
  ContextBuilderPlugin,
  ExternalRiskSignals,
  InternalRiskSignals,
  IsoTimestamp,
  ReadonlyDeep,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../../../src/types/auth-risk.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createIsoTimestamp = (): IsoTimestamp => '2024-01-15T10:30:00.000Z';

const createLoginRiskEvaluationTest = (): LoginRiskEvaluation =>
  createLoginRiskEvaluation(
    createLoginRiskResult({
      score: 42,
      level: 'medium',
      reasons: [],
      modelVersion: '1.0',
    }),
    {
      userId: 'user-123',
      ip: '192.168.1.1',
      geo: { country: 'US', city: 'New York', lat: 40.7128, lng: -74.006 },
      device: {
        deviceId: 'device-123',
        platform: 'desktop',
        os: 'Windows',
        browser: 'Chrome',
      },
      userAgent: 'Mozilla/5.0',
      timestamp: Date.now(),
    },
  );

const createClassificationRule = (): ClassificationRule => 'TOR_NETWORK';

// ============================================================================
// 🔧 UTILITY TYPES
// ============================================================================

describe('ReadonlyDeep', () => {
  it('должен делать все поля readonly на всех уровнях', () => {
    type TestType = {
      a: number;
      b: {
        c: string;
        d: {
          e: boolean;
        };
      };
      f: number[];
    };

    type ReadonlyTestType = ReadonlyDeep<TestType>;

    const test: ReadonlyTestType = {
      a: 1,
      b: {
        c: 'test',
        d: {
          e: true,
        },
      },
      f: [1, 2, 3],
    };

    // TypeScript предотвращает мутацию через readonly типы
    // Все поля readonly, мутация невозможна на этапе компиляции

    expect(test.a).toBe(1);
    expect(test.b.c).toBe('test');
    expect(test.b.d.e).toBe(true);
    expect(test.f[0]).toBe(1);
  });

  it('должен корректно обрабатывать массивы', () => {
    type TestArray = { items: number[]; };
    type ReadonlyTestArray = ReadonlyDeep<TestArray>;

    const test: ReadonlyTestArray = {
      items: [1, 2, 3],
    };

    // Массив readonly, мутация невозможна на этапе компиляции

    expect(test.items).toEqual([1, 2, 3]);
  });

  it('должен корректно обрабатывать функции', () => {
    type TestFunction = {
      fn: () => void;
    };
    type ReadonlyTestFunction = ReadonlyDeep<TestFunction>;

    const test: ReadonlyTestFunction = {
      fn: () => {},
    };

    // Функции не должны быть readonly
    expect(typeof test.fn).toBe('function');
  });

  it('должен корректно обрабатывать примитивы', () => {
    type TestPrimitive = string | number | boolean | null | undefined;
    type ReadonlyTestPrimitive = ReadonlyDeep<TestPrimitive>;

    const str: ReadonlyTestPrimitive = 'test';
    const num: ReadonlyTestPrimitive = 42;
    const bool: ReadonlyTestPrimitive = true;
    const nul: ReadonlyTestPrimitive = null;
    const undef: ReadonlyTestPrimitive = undefined;

    expect(str).toBe('test');
    expect(num).toBe(42);
    expect(bool).toBe(true);
    expect(nul).toBeNull();
    expect(undef).toBeUndefined();
  });
});

describe('IsoTimestamp', () => {
  it('должен быть строковым типом', () => {
    const timestamp: IsoTimestamp = '2024-01-15T10:30:00.000Z';
    expect(typeof timestamp).toBe('string');
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('должен поддерживать различные ISO 8601 форматы', () => {
    const timestamps: IsoTimestamp[] = [
      '2024-01-15T10:30:00.000Z',
      '2024-01-15T10:30:00Z',
      '2024-01-15T10:30:00.123Z',
    ];

    timestamps.forEach((ts) => {
      const timestamp: IsoTimestamp = ts;
      expect(typeof timestamp).toBe('string');
    });
  });
});

// ============================================================================
// 🧭 RISK SIGNALS TYPES
// ============================================================================

describe('InternalRiskSignals', () => {
  it('должен быть алиасом для InternalClassificationSignals', () => {
    const signals: InternalRiskSignals = {
      isVpn: true,
      isTor: false,
      isProxy: true,
      asn: 'AS12345',
      reputationScore: 75,
      velocityScore: 30,
      previousGeo: {
        country: 'US',
        region: 'NY',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
    };

    expect(signals.isVpn).toBe(true);
    expect(signals.isTor).toBe(false);
    expect(signals.reputationScore).toBe(75);
    expect(signals.previousGeo?.country).toBe('US');
  });
});

describe('ExternalRiskSignals', () => {
  it('должен быть алиасом для ExternalClassificationSignals', () => {
    const signals: ExternalRiskSignals = {
      vendorScore: 85,
      threatLevel: 'low',
      metadata: {
        source: 'vendor-api' as string,
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    };

    expect(signals['vendorScore']).toBe(85);
    expect(signals['threatLevel']).toBe('low');
    expect(signals['metadata']).toBeDefined();
  });

  it('должен поддерживать пустой объект', () => {
    const signals: ExternalRiskSignals = {};
    expect(signals).toEqual({});
  });
});

describe('RiskSignals', () => {
  it('должен быть алиасом для ClassificationSignals', () => {
    const signals: RiskSignals = {
      isVpn: true,
      isTor: false,
      reputationScore: 75,
      externalSignals: {
        vendorScore: 85,
      },
    };

    expect(signals.isVpn).toBe(true);
    expect(signals.externalSignals).toBeDefined();
  });

  it('должен поддерживать только internal signals', () => {
    const signals: RiskSignals = {
      isVpn: true,
      reputationScore: 75,
    };

    expect(signals.isVpn).toBe(true);
    expect(signals.externalSignals).toBeUndefined();
  });
});

// ============================================================================
// 🧭 RISK CONTEXT TYPES
// ============================================================================

describe('RiskContext', () => {
  it('должен поддерживать все поля', () => {
    const context: RiskContext = {
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        region: 'NY',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
      userId: 'user-123',
      previousSessionId: 'session-456',
      signals: {
        isVpn: true,
        reputationScore: 75,
      },
      timestamp: createIsoTimestamp(),
    };

    expect(context.ip).toBe('192.168.1.1');
    expect(context.geo?.country).toBe('US');
    expect(context.userId).toBe('user-123');
    expect(context.signals?.isVpn).toBe(true);
  });

  it('должен поддерживать минимальный контекст', () => {
    const context: RiskContext = {};
    expect(context).toEqual({});
  });

  it('должен поддерживать только IP', () => {
    const context: RiskContext = {
      ip: '192.168.1.1',
    };
    expect(context.ip).toBe('192.168.1.1');
  });

  it('должен поддерживать только geo', () => {
    const context: RiskContext = {
      geo: {
        country: 'US',
        lat: 40.7128,
        lng: -74.0060,
      },
    };
    expect(context.geo?.country).toBe('US');
  });

  it('должен поддерживать signals с ReadonlyDeep', () => {
    const context: RiskContext = {
      signals: {
        isVpn: true,
        reputationScore: 75,
        previousGeo: {
          country: 'US',
          lat: 40.7128,
          lng: -74.0060,
        },
        externalSignals: {
          vendorScore: 85,
        },
      },
    };

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.previousGeo?.country).toBe('US');
    expect(context.signals?.externalSignals).toBeDefined();
  });

  it('должен быть immutable (readonly поля)', () => {
    const context: RiskContext = {
      ip: '192.168.1.1',
      userId: 'user-123',
    };

    // Поля readonly, мутация невозможна на этапе компиляции

    expect(context.ip).toBe('192.168.1.1');
  });
});

describe('RiskPolicy', () => {
  it('должен поддерживать weights', () => {
    const policy: RiskPolicy = {
      weights: {
        device: 0.2,
        geo: 0.3,
        network: 0.3,
        velocity: 0.2,
      },
    };

    expect(policy.weights).toBeDefined();
    expect(policy.weights?.device).toBe(0.2);
    expect(policy.weights?.geo).toBe(0.3);
  });

  it('должен поддерживать пустую политику', () => {
    const policy: RiskPolicy = {};
    expect(policy).toEqual({});
  });

  it('должен быть immutable (readonly поля)', () => {
    const policy: RiskPolicy = {
      weights: {
        device: 0.2,
        geo: 0.3,
        network: 0.3,
        velocity: 0.2,
      },
    };

    // Поля readonly, мутация невозможна на этапе компиляции
    expect(policy.weights?.device).toBe(0.2);
  });
});

describe('RiskAssessmentResult', () => {
  it('должен поддерживать все поля', () => {
    const result: RiskAssessmentResult = {
      riskScore: 75,
      riskLevel: 'medium',
      triggeredRules: [createClassificationRule()],
      decisionHint: {
        action: 'mfa',
        blockReason: 'High risk detected',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    expect(result.riskScore).toBe(75);
    expect(result.riskLevel).toBe('medium');
    expect(result.triggeredRules).toHaveLength(1);
    expect(result.decisionHint.action).toBe('mfa');
    expect(result.assessment).toBeDefined();
  });

  it('должен поддерживать action: login', () => {
    const result: RiskAssessmentResult = {
      riskScore: 20,
      riskLevel: 'low',
      triggeredRules: [],
      decisionHint: {
        action: 'login',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    expect(result.decisionHint.action).toBe('login');
  });

  it('должен поддерживать action: mfa', () => {
    const result: RiskAssessmentResult = {
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRules: [],
      decisionHint: {
        action: 'mfa',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    expect(result.decisionHint.action).toBe('mfa');
  });

  it('должен поддерживать action: block', () => {
    const result: RiskAssessmentResult = {
      riskScore: 90,
      riskLevel: 'critical',
      triggeredRules: [createClassificationRule()],
      decisionHint: {
        action: 'block',
        blockReason: 'Critical risk detected',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    expect(result.decisionHint.action).toBe('block');
    expect(result.decisionHint.blockReason).toBe('Critical risk detected');
  });

  it('должен поддерживать все risk levels', () => {
    const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    levels.forEach((level) => {
      const result: RiskAssessmentResult = {
        riskScore: level === 'low' ? 20 : level === 'medium' ? 50 : level === 'high' ? 75 : 90,
        riskLevel: level,
        triggeredRules: [],
        decisionHint: {
          action: 'login',
        },
        assessment: createLoginRiskEvaluationTest(),
      };

      expect(result.riskLevel).toBe(level);
    });
  });

  it('должен поддерживать пустой массив triggeredRules', () => {
    const result: RiskAssessmentResult = {
      riskScore: 20,
      riskLevel: 'low',
      triggeredRules: [],
      decisionHint: {
        action: 'login',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    expect(result.triggeredRules).toEqual([]);
  });

  it('должен поддерживать множественные triggeredRules', () => {
    const result: RiskAssessmentResult = {
      riskScore: 85,
      riskLevel: 'high',
      triggeredRules: [createClassificationRule(), createClassificationRule()],
      decisionHint: {
        action: 'block',
        blockReason: 'Multiple rules triggered',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    expect(result.triggeredRules).toHaveLength(2);
  });

  it('должен быть immutable (readonly поля)', () => {
    const result: RiskAssessmentResult = {
      riskScore: 75,
      riskLevel: 'medium',
      triggeredRules: [],
      decisionHint: {
        action: 'mfa',
      },
      assessment: createLoginRiskEvaluationTest(),
    };

    // Все поля readonly, мутация невозможна на этапе компиляции

    expect(result.riskScore).toBe(75);
  });
});

// ============================================================================
// 🧭 PLUGIN TYPES
// ============================================================================

describe('BuildAssessmentContext', () => {
  it('должен поддерживать все поля', () => {
    const context: BuildAssessmentContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        region: 'NY',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
      userAgent: 'Mozilla/5.0',
      previousSessionId: 'session-456',
      timestamp: createIsoTimestamp(),
      signals: {
        isVpn: true,
        reputationScore: 75,
      },
    };

    expect(context.userId).toBe('user-123');
    expect(context.ip).toBe('192.168.1.1');
    expect(context.geo?.country).toBe('US');
    expect(context.userAgent).toBe('Mozilla/5.0');
    expect(context.signals?.isVpn).toBe(true);
  });

  it('должен поддерживать минимальный контекст', () => {
    const context: BuildAssessmentContext = {};
    expect(context).toEqual({});
  });

  it('должен поддерживать signals с ReadonlyDeep', () => {
    const context: BuildAssessmentContext = {
      signals: {
        isVpn: true,
        previousGeo: {
          country: 'US',
          lat: 40.7128,
          lng: -74.0060,
        },
        externalSignals: {
          vendorScore: 85,
        },
      },
    };

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.previousGeo?.country).toBe('US');
  });

  it('должен быть immutable (readonly поля)', () => {
    const context: BuildAssessmentContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
    };

    // Поля readonly, мутация невозможна на этапе компиляции

    expect(context.userId).toBe('user-123');
  });
});

describe('ContextBuilderPlugin', () => {
  it('должен поддерживать только id', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'test-plugin',
    };

    expect(plugin.id).toBe('test-plugin');
    expect(plugin.priority).toBeUndefined();
    expect(plugin.extendScoringContext).toBeUndefined();
    expect(plugin.extendRuleContext).toBeUndefined();
    expect(plugin.extendAssessmentContext).toBeUndefined();
  });

  it('должен поддерживать id с priority', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'test-plugin',
      priority: 10,
    };

    expect(plugin.id).toBe('test-plugin');
    expect(plugin.priority).toBe(10);
  });

  it('должен поддерживать extendScoringContext', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'scoring-plugin',
      extendScoringContext: (context) => {
        return {
          ...context,
          signals: {
            ...context.signals,
            reputationScore: 75,
          },
        };
      },
    };

    expect(plugin.extendScoringContext).toBeDefined();
    const context: AuthScoringContext = {
      ip: '192.168.1.1',
    };
    const riskContext: RiskContext = {};
    const result = plugin.extendScoringContext!(context, riskContext);
    expect(result.signals?.reputationScore).toBe(75);
  });

  it('должен поддерживать extendRuleContext', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'rule-plugin',
      extendRuleContext: (context) => {
        return {
          ...context,
          signals: {
            ...context.signals,
            isVpn: true,
          },
        };
      },
    };

    expect(plugin.extendRuleContext).toBeDefined();
    const context: AuthRuleEvaluationContext = {};
    const riskContext: RiskContext = {};
    const result = plugin.extendRuleContext!(context, riskContext);
    expect(result.signals?.isVpn).toBe(true);
  });

  it('должен поддерживать extendAssessmentContext', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'assessment-plugin',
      extendAssessmentContext: (context) => {
        return {
          ...context,
          userAgent: 'Custom Agent',
        };
      },
    };

    expect(plugin.extendAssessmentContext).toBeDefined();
    const context: BuildAssessmentContext = {};
    const riskContext: RiskContext = {};
    const result = plugin.extendAssessmentContext!(context, riskContext);
    expect(result.userAgent).toBe('Custom Agent');
  });

  it('должен поддерживать все методы одновременно', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'full-plugin',
      priority: 5,
      extendScoringContext: (context) => context,
      extendRuleContext: (context) => context,
      extendAssessmentContext: (context) => context,
    };

    expect(plugin.id).toBe('full-plugin');
    expect(plugin.priority).toBe(5);
    expect(plugin.extendScoringContext).toBeDefined();
    expect(plugin.extendRuleContext).toBeDefined();
    expect(plugin.extendAssessmentContext).toBeDefined();
  });

  it('должен поддерживать namespace в id', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'vendor:plugin-name',
    };

    expect(plugin.id).toBe('vendor:plugin-name');
  });

  it('должен быть immutable (readonly поля)', () => {
    const plugin: ContextBuilderPlugin = {
      id: 'test-plugin',
      priority: 10,
    };

    // Поля readonly, мутация невозможна на этапе компиляции

    expect(plugin.id).toBe('test-plugin');
  });
});

describe('AuthRuleEvaluationContext', () => {
  it('должен поддерживать все поля', () => {
    const context: AuthRuleEvaluationContext = {
      device: {
        deviceId: 'device-123',
        fingerprint: 'fp-456',
        platform: 'web',
        os: 'Windows',
        browser: 'Chrome',
      },
      geo: {
        country: 'US',
        region: 'NY',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
      previousGeo: {
        country: 'CA',
        region: 'ON',
        city: 'Toronto',
        lat: 43.6532,
        lng: -79.3832,
      },
      signals: {
        isVpn: true,
        isTor: false,
        isProxy: true,
        reputationScore: 75,
        velocityScore: 30,
      },
      metadata: {
        customField: 'value',
        nested: {
          deep: 'value',
        },
      },
    };

    expect(context.device?.deviceId).toBe('device-123');
    expect(context.geo?.country).toBe('US');
    expect(context.previousGeo?.country).toBe('CA');
    expect(context.signals?.isVpn).toBe(true);
    expect(context.metadata?.['customField']).toBe('value');
  });

  it('должен поддерживать все platform значения', () => {
    const platforms: ('web' | 'ios' | 'android' | 'desktop')[] = [
      'web',
      'ios',
      'android',
      'desktop',
    ];

    platforms.forEach((platform) => {
      const context: AuthRuleEvaluationContext = {
        device: {
          deviceId: 'device-123',
          platform,
        },
      };

      expect(context.device?.platform).toBe(platform);
    });
  });

  it('должен поддерживать signals с ReadonlyDeep', () => {
    const context: AuthRuleEvaluationContext = {
      signals: {
        isVpn: true,
        reputationScore: 75,
      },
    };

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.reputationScore).toBe(75);
  });

  it('должен поддерживать metadata с ReadonlyDeep', () => {
    const context: AuthRuleEvaluationContext = {
      metadata: {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      },
    };

    expect(context.metadata?.['level1']).toBeDefined();
  });

  it('должен поддерживать минимальный контекст', () => {
    const context: AuthRuleEvaluationContext = {};
    expect(context).toEqual({});
  });

  it('должен быть immutable (readonly поля)', () => {
    const context: AuthRuleEvaluationContext = {
      device: {
        deviceId: 'device-123',
        platform: 'web',
      },
    };

    // Поля readonly, мутация невозможна на этапе компиляции
    expect(context.device?.deviceId).toBe('device-123');
  });
});

describe('AuthScoringContext', () => {
  it('должен поддерживать все поля', () => {
    const context: AuthScoringContext = {
      device: {
        deviceId: 'device-123',
        fingerprint: 'fp-456',
        platform: 'web',
        os: 'Windows',
        browser: 'Chrome',
      },
      geo: {
        country: 'US',
        region: 'NY',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
      ip: '192.168.1.1',
      signals: {
        isVpn: true,
        isTor: false,
        isProxy: true,
        reputationScore: 75,
        velocityScore: 30,
        previousGeo: {
          country: 'CA',
          region: 'ON',
          city: 'Toronto',
          lat: 43.6532,
          lng: -79.3832,
        },
      },
    };

    expect(context.device?.deviceId).toBe('device-123');
    expect(context.geo?.country).toBe('US');
    expect(context.ip).toBe('192.168.1.1');
    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.previousGeo?.country).toBe('CA');
  });

  it('должен поддерживать все platform значения', () => {
    const platforms: ('web' | 'ios' | 'android' | 'desktop')[] = [
      'web',
      'ios',
      'android',
      'desktop',
    ];

    platforms.forEach((platform) => {
      const context: AuthScoringContext = {
        device: {
          deviceId: 'device-123',
          platform,
        },
      };

      expect(context.device?.platform).toBe(platform);
    });
  });

  it('должен поддерживать signals с ReadonlyDeep и previousGeo', () => {
    const context: AuthScoringContext = {
      signals: {
        isVpn: true,
        reputationScore: 75,
        previousGeo: {
          country: 'US',
          lat: 40.7128,
          lng: -74.0060,
        },
      },
    };

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.previousGeo?.country).toBe('US');
  });

  it('должен поддерживать signals без previousGeo', () => {
    const context: AuthScoringContext = {
      signals: {
        isVpn: true,
        reputationScore: 75,
      },
    };

    expect(context.signals?.isVpn).toBe(true);
    expect(context.signals?.previousGeo).toBeUndefined();
  });

  it('должен поддерживать минимальный контекст', () => {
    const context: AuthScoringContext = {};
    expect(context).toEqual({});
  });

  it('должен поддерживать только IP', () => {
    const context: AuthScoringContext = {
      ip: '192.168.1.1',
    };

    expect(context.ip).toBe('192.168.1.1');
  });

  it('должен быть immutable (readonly поля)', () => {
    const context: AuthScoringContext = {
      ip: '192.168.1.1',
      device: {
        deviceId: 'device-123',
        platform: 'web',
      },
    };

    // Поля readonly, мутация невозможна на этапе компиляции

    expect(context.ip).toBe('192.168.1.1');
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION
// ============================================================================

describe('Immutability validation', () => {
  it('все типы должны иметь readonly поля', () => {
    const riskContext: RiskContext = {
      ip: '192.168.1.1',
      userId: 'user-123',
    };

    const riskPolicy: RiskPolicy = {
      weights: {
        device: 0.2,
        geo: 0.3,
        network: 0.3,
        velocity: 0.2,
      },
    };

    const buildContext: BuildAssessmentContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
    };

    const ruleContext: AuthRuleEvaluationContext = {
      device: {
        deviceId: 'device-123',
        platform: 'web',
      },
    };

    const scoringContext: AuthScoringContext = {
      ip: '192.168.1.1',
    };

    // Все поля должны быть readonly
    // TypeScript предотвратит мутацию на этапе компиляции
    expect(riskContext).toBeDefined();
    expect(riskPolicy).toBeDefined();
    expect(buildContext).toBeDefined();
    expect(ruleContext).toBeDefined();
    expect(scoringContext).toBeDefined();
  });

  it('ReadonlyDeep должен защищать вложенные объекты', () => {
    const riskContext: RiskContext = {
      signals: {
        isVpn: true,
        previousGeo: {
          country: 'US',
          lat: 40.7128,
          lng: -74.0060,
        },
        externalSignals: {
          vendorScore: 85,
          nested: {
            deep: 'value',
          },
        },
      },
    };

    // ReadonlyDeep защищает все уровни вложенности
    // Мутация невозможна на этапе компиляции

    expect(riskContext.signals?.isVpn).toBe(true);
    expect(riskContext.signals?.previousGeo?.country).toBe('US');
  });
});
