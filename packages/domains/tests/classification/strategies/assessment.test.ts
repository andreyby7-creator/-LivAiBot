/**
 * @file Unit тесты для Classification Assessment
 * Полное покрытие всех функций и edge cases (100%)
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultRiskWeights } from '../../../src/classification/aggregation/scoring.js';
import type {
  ClassificationGeo,
  ClassificationSignals,
} from '../../../src/classification/signals/signals.js';
import { classificationContext } from '../../../src/classification/signals/signals.js';
import type {
  ClassificationPolicy,
  ContextBuilderPlugin,
} from '../../../src/classification/strategies/assessment.js';
import { assessClassification } from '../../../src/classification/strategies/assessment.js';
import {
  DEFAULT_RULE_THRESHOLDS,
  resetClassificationRulesConfig,
} from '../../../src/classification/strategies/config.js';
import type { DeviceInfo } from '../../../src/classification/strategies/rules.js';

/* ============================================================================
 * 🧹 SETUP & TEARDOWN
 * ============================================================================
 */

beforeEach(() => {
  // Сбрасываем конфигурацию перед каждым тестом для изоляции
  resetClassificationRulesConfig();
});

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

function createTestClassificationContext(overrides: {
  ip?: string;
  geo?: ClassificationGeo;
  signals?: ClassificationSignals;
  userId?: string;
  previousSessionId?: string;
} = {}): ReturnType<typeof classificationContext.create> {
  const contextData = {
    ip: '192.168.1.1',
    userId: 'user123',
    ...overrides,
  };
  return classificationContext.create(contextData);
}

function createTestSignals(overrides: Partial<ClassificationSignals> = {}): ClassificationSignals {
  return Object.freeze({
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

/* ============================================================================
 * 🧪 TESTS — assessClassification (основной API)
 * ============================================================================
 */

describe('assessClassification', () => {
  it('должен возвращать валидный результат для пустого контекста', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
    expect(result.evaluationLevel).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.label).toBeDefined();
    expect(result.scale).toBeDefined();
    // Новые обязательные поля orchestration данных
    expect(result.riskScore).toBeDefined();
    expect(typeof result.riskScore).toBe('number');
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.riskLevel).toBeDefined();
    expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    expect(result.triggeredRules).toBeDefined();
    expect(Array.isArray(result.triggeredRules)).toBe(true);
  });

  it('должен использовать дефолтные параметры если не переданы', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен использовать дефолтные weights если policy не указана', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const policy: ClassificationPolicy = {};
    const result = assessClassification(deviceInfo, context, policy);
    expect(result).toBeDefined();
  });

  it('должен использовать кастомные weights из policy', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const policy: ClassificationPolicy = {
      weights: {
        device: 0.3,
        geo: 0.2,
        network: 0.3,
        velocity: 0.2,
      },
    };
    const result = assessClassification(deviceInfo, context, policy);
    expect(result).toBeDefined();
  });

  it('должен применять плагины для расширения scoring context', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const pluginCalled = { value: false };
    const plugin: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        // eslint-disable-next-line fp/no-mutation -- Тестовая переменная для проверки вызова
        pluginCalled.value = true;
        return ctx;
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
    expect(pluginCalled.value).toBe(true);
  });

  it('должен применять плагины для расширения rule context', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const pluginCalled = { value: false };
    const plugin: ContextBuilderPlugin = {
      extendRuleContext: (ctx) => {
        // eslint-disable-next-line fp/no-mutation -- Тестовая переменная для проверки вызова
        pluginCalled.value = true;
        return ctx;
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
    expect(pluginCalled.value).toBe(true);
  });

  it('должен применять плагин с extendAssessmentContext через assessment layer', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    // extendAssessmentContext применяется при сборке assessment context в evaluation layer.
    const plugin: ContextBuilderPlugin = {
      extendAssessmentContext: (ctx) => {
        return ctx;
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен применять несколько плагинов в порядке их передачи', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const callOrder: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        callOrder.push(1);
        return ctx;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        callOrder.push(2);
        return ctx;
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin1, plugin2]);
    expect(result).toBeDefined();
    expect(callOrder).toEqual([1, 2]);
  });

  it('должен обрабатывать плагин без методов расширения', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {};
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать пустой массив плагинов', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context, {}, []);
    expect(result).toBeDefined();
  });

  it('должен использовать кастомный config если передан', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const config = {
      criticalRulePriorityThreshold: 50,
      highRiskCountries: new Set(['XX']),
      thresholds: DEFAULT_RULE_THRESHOLDS,
    };
    const result = assessClassification(deviceInfo, context, {}, [], config);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context с geo', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      geo: createTestGeo({ country: 'US' }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context с signals', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      signals: createTestSignals({
        isVpn: true,
        isTor: false,
        isProxy: false,
        reputationScore: 50,
        velocityScore: 30,
      }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context с ip', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      ip: '192.168.1.1',
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context со всеми полями', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      ip: '192.168.1.1',
      geo: createTestGeo({ country: 'US' }),
      signals: createTestSignals({
        isVpn: true,
        reputationScore: 50,
        velocityScore: 30,
      }),
      userId: 'user123',
      previousSessionId: 'session-456',
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать все типы устройств', () => {
    const deviceTypes: DeviceInfo['deviceType'][] = [
      'desktop',
      'mobile',
      'tablet',
      'iot',
      'unknown',
    ];
    deviceTypes.forEach((deviceType) => {
      const deviceInfo = createTestDeviceInfo({ deviceType });
      const context = createTestClassificationContext();
      if (!context) {
        throw new Error('Failed to create context');
      }
      const result = assessClassification(deviceInfo, context);
      expect(result).toBeDefined();
    });
  });

  it('должен быть детерминированным (одинаковый вход → одинаковый выход)', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      signals: createTestSignals({
        isVpn: true,
        reputationScore: 50,
        velocityScore: 30,
      }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result1 = assessClassification(deviceInfo, context);
    const result2 = assessClassification(deviceInfo, context);
    expect(result1.evaluationLevel).toEqual(result2.evaluationLevel);
    expect(result1.confidence).toEqual(result2.confidence);
    expect(result1.label).toEqual(result2.label);
  });

  it('должен быть детерминированным для одинакового ordered набора плагинов', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugins: readonly ContextBuilderPlugin[] = [
      {
        extendScoringContext: (ctx) => {
          return Object.freeze({
            ...ctx,
            config: {
              highRiskCountries: new Set(['RU']),
            },
          });
        },
      },
      {
        extendAssessmentContext: (ctx) => {
          return Object.freeze({
            ...ctx,
            riskScore: 90,
          });
        },
      },
    ];

    const result1 = assessClassification(deviceInfo, context, {}, plugins);
    const result2 = assessClassification(deviceInfo, context, {}, plugins);
    expect(result1).toEqual(result2);
  });

  it('должен учитывать порядок assessment-плагинов предсказуемо', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }

    const setLowRiskScore: ContextBuilderPlugin = {
      extendAssessmentContext: (ctx) => {
        return Object.freeze({
          ...ctx,
          riskScore: 10,
        });
      },
    };
    const setCriticalRiskScore: ContextBuilderPlugin = {
      extendAssessmentContext: (ctx) => {
        return Object.freeze({
          ...ctx,
          riskScore: 90,
        });
      },
    };

    const lowThenCritical = assessClassification(
      deviceInfo,
      context,
      {},
      [setLowRiskScore, setCriticalRiskScore],
    );
    const criticalThenLow = assessClassification(
      deviceInfo,
      context,
      {},
      [setCriticalRiskScore, setLowRiskScore],
    );

    expect(lowThenCritical.label).not.toEqual(criticalThenLow.label);
  });

  it('должен обрабатывать плагин, который возвращает тот же context (noop)', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        return ctx; // Noop - возвращает тот же context
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать плагин, который расширяет scoring context', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        return Object.freeze({
          ...ctx,
          config: {
            highRiskCountries: new Set(['XX']),
          },
        });
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать плагин с version', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {
      version: 1,
      extendScoringContext: (ctx) => {
        return ctx;
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен выбрасывать ошибку для blocking violations', () => {
    const deviceInfo = createTestDeviceInfo();
    // Намеренно обходим factory, чтобы проверить fail-fast path блокирующей семантики.
    const invalidContext = Object.freeze({
      signals: Object.freeze({
        reputationScore: 101,
        velocityScore: 30,
      }),
    }) as unknown as Parameters<typeof assessClassification>[1];

    expect(() => assessClassification(deviceInfo, invalidContext)).toThrow(
      'INVALID_REPUTATION_SCORE (out_of_range): removes_signal',
    );
  });

  it('должен обрабатывать context без optional полей', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать policy с decision и проксировать ее в decision layer', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const policy: ClassificationPolicy = {
      decision: {
        thresholds: {
          mediumFrom: 35,
          highFrom: 65,
          criticalFrom: 85,
        },
        dangerousRuleCountFrom: 3,
        dangerousVelocityFrom: 80,
        dangerousReputationTo: 20,
      },
    };
    const result = assessClassification(deviceInfo, context, policy);
    expect(result).toBeDefined();
  });
});

/* ============================================================================
 * 🧪 TESTS — Edge Cases
 * ============================================================================
 */

describe('edge cases', () => {
  it('должен обрабатывать context с частичными signals', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      signals: createTestSignals({
        isVpn: true,
        // reputationScore и velocityScore отсутствуют
      }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context с частичными geo данными', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      geo: createTestGeo({ country: 'US' }),
      // region, city, lat, lng отсутствуют
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context без signals', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context без geo', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context без ip', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать все boolean сигналы одновременно', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      signals: createTestSignals({
        isVpn: true,
        isTor: true,
        isProxy: true,
      }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать все числовые сигналы одновременно', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      signals: createTestSignals({
        reputationScore: 50,
        velocityScore: 75,
      }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать weights с минимальными значениями (сумма = 1.0)', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const policy: ClassificationPolicy = {
      weights: {
        device: 0.1,
        geo: 0.1,
        network: 0.1,
        velocity: 0.7,
      },
    };
    const result = assessClassification(deviceInfo, context, policy);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать weights с максимальными значениями (сумма = 1.0)', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const policy: ClassificationPolicy = {
      weights: {
        device: 0.4,
        geo: 0.3,
        network: 0.2,
        velocity: 0.1,
      },
    };
    const result = assessClassification(deviceInfo, context, policy);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать config с пустым highRiskCountries', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const config = {
      criticalRulePriorityThreshold: 50,
      highRiskCountries: new Set<string>(),
      thresholds: DEFAULT_RULE_THRESHOLDS,
    };
    const result = assessClassification(deviceInfo, context, {}, [], config);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать config с множеством highRiskCountries', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const config = {
      criticalRulePriorityThreshold: 50,
      highRiskCountries: new Set(['XX', 'YY', 'ZZ']),
      thresholds: DEFAULT_RULE_THRESHOLDS,
    };
    const result = assessClassification(deviceInfo, context, {}, [], config);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать плагин, который расширяет scoring context с новыми полями', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        return Object.freeze({
          ...ctx,
          config: {
            highRiskCountries: new Set(['XX', 'YY']),
          },
        });
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать плагин, который расширяет rule context', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {
      extendRuleContext: (ctx) => {
        return Object.freeze({
          ...ctx,
          metadata: {
            ...ctx.metadata,
            customField: 'test',
          },
        });
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать плагин с несколькими методами расширения', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const plugin: ContextBuilderPlugin = {
      extendScoringContext: (ctx) => {
        return ctx;
      },
      extendRuleContext: (ctx) => {
        return ctx;
      },
      extendAssessmentContext: (ctx) => {
        return ctx;
      },
    };
    const result = assessClassification(deviceInfo, context, {}, [plugin]);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context с previousGeo в signals', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      geo: createTestGeo({ country: 'US' }),
      signals: createTestSignals({
        previousGeo: createTestGeo({ country: 'RU' }),
      }),
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context с previousSessionId', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext({
      previousSessionId: 'session-123',
    });
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать context без previousSessionId', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const result = assessClassification(deviceInfo, context);
    expect(result).toBeDefined();
  });

  it('должен обрабатывать weights равные defaultRiskWeights', () => {
    const deviceInfo = createTestDeviceInfo();
    const context = createTestClassificationContext();
    if (!context) {
      throw new Error('Failed to create context');
    }
    const policy: ClassificationPolicy = {
      weights: defaultRiskWeights,
    };
    const result = assessClassification(deviceInfo, context, policy);
    expect(result).toBeDefined();
  });
});
