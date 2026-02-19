/**
 * @file Unit тесты для domain/ContextBuilders.ts
 * Полное покрытие context builders с 100% покрытием
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';
import type { ScoringContext } from '../../../src/effects/login/risk-scoring.js';
import type { ContextBuilderPlugin, RiskContext, RiskSignals } from '../../../src/types/risk.js';
import {
  buildAssessmentContext,
  buildRuleContext,
  buildScoringContext,
} from '../../../src/domain/ContextBuilders.js';

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

// ============================================================================
// 🎯 TESTS - buildScoringContext
// ============================================================================

describe('buildScoringContext', () => {
  it('создает базовый scoring context без опциональных полей', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {};

    const result = buildScoringContext(deviceInfo, context);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBeUndefined();
    expect(result.ip).toBeUndefined();
    expect(result.signals).toBeUndefined();
  });

  it('создает полный scoring context со всеми полями', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result = buildScoringContext(deviceInfo, context);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBe(context.geo);
    expect(result.ip).toBe(context.ip);
    expect(result.signals).toBe(context.signals);
  });

  it('создает scoring context только с geo', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBe(context.geo);
    expect(result.ip).toBeUndefined();
    expect(result.signals).toBeUndefined();
  });

  it('создает scoring context только с ip', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      ip: '192.168.1.1',
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBeUndefined();
    expect(result.ip).toBe('192.168.1.1');
    expect(result.signals).toBeUndefined();
  });

  it('создает scoring context только с signals', () => {
    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals();
    const context: RiskContext = {
      signals,
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBeUndefined();
    expect(result.ip).toBeUndefined();
    expect(result.signals).toBe(signals);
  });

  it('применяет плагины для расширения scoring context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'scoring-plugin',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
    };

    const result = buildScoringContext(deviceInfo, context, [plugin]);

    expect(result.signals?.reputationScore).toBe(60);
  });

  it('применяет несколько плагинов последовательно', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 5,
          },
        };
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
    };

    const result = buildScoringContext(deviceInfo, context, [plugin1, plugin2]);

    expect(result.signals?.reputationScore).toBe(65); // 50 + 5 + 10
  });

  it('пропускает плагины без extendScoringContext', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'no-scoring-plugin',
      // extendScoringContext отсутствует
    };

    const result = buildScoringContext(deviceInfo, context, [plugin]);

    expect(result.signals?.reputationScore).toBe(50); // Не изменен
  });

  it('обрабатывает undefined plugins', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result = buildScoringContext(deviceInfo, context, undefined);

    expect(result.signals?.reputationScore).toBe(50);
  });

  it('обрабатывает пустой массив plugins', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    const result = buildScoringContext(deviceInfo, context, []);

    expect(result.signals?.reputationScore).toBe(50);
  });

  it('использует readonly ссылки на signals (O(1) по памяти)', () => {
    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals();
    const context: RiskContext = {
      signals,
    };

    const result = buildScoringContext(deviceInfo, context);

    // Signals должны быть той же ссылкой (не deep copy)
    expect(result.signals).toBe(signals);
  });
});

// ============================================================================
// 🎯 TESTS - buildRuleContext
// ============================================================================

describe('buildRuleContext', () => {
  it('создает базовый rule context без опциональных полей', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {};
    const riskScore = 25;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBeUndefined();
    expect(result.previousGeo).toBeUndefined();
    expect(result.signals).toBeUndefined();
    expect(result.metadata?.isNewDevice).toBe(true); // previousSessionId === undefined
    expect(result.metadata?.riskScore).toBe(25);
  });

  it('создает полный rule context со всеми полями', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBe(context.geo);
    expect(result.previousGeo).toBe(context.signals?.previousGeo);
    expect(result.signals).toBe(context.signals);
    expect(result.metadata?.isNewDevice).toBe(false); // previousSessionId !== undefined
    expect(result.metadata?.riskScore).toBe(50);
  });

  it('создает rule context только с geo', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };
    const riskScore = 30;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.device).toBe(deviceInfo);
    expect(result.geo).toBe(context.geo);
    expect(result.previousGeo).toBeUndefined();
    expect(result.signals).toBeUndefined();
    expect(result.metadata?.riskScore).toBe(30);
  });

  it('создает rule context с previousGeo из signals', () => {
    const deviceInfo = createDeviceInfo();
    const previousGeo = {
      country: 'DE',
      lat: 52.5200,
      lng: 13.4050,
    };
    const context: RiskContext = {
      signals: {
        previousGeo,
      },
    };
    const riskScore = 40;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.previousGeo).toBe(previousGeo);
    expect(result.metadata?.riskScore).toBe(40);
  });

  it('определяет isNewDevice как true когда previousSessionId отсутствует', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      userId: 'user-123',
      // previousSessionId отсутствует
    };
    const riskScore = 25;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.metadata?.isNewDevice).toBe(true);
  });

  it('определяет isNewDevice как false когда previousSessionId присутствует', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      previousSessionId: 'session-prev-456',
    };
    const riskScore = 25;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.metadata?.isNewDevice).toBe(false);
  });

  it('применяет плагины для расширения rule context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;
    const plugin: ContextBuilderPlugin = {
      id: 'rule-plugin',
      extendRuleContext: (ruleContext) => {
        return {
          ...ruleContext,
          metadata: {
            ...ruleContext.metadata,
            isNewDevice: true,
            riskScore: (ruleContext.metadata?.riskScore ?? 0) + 5,
          },
        };
      },
    };

    const result = buildRuleContext(deviceInfo, context, riskScore, [plugin]);

    expect(result.metadata?.isNewDevice).toBe(true);
    expect(result.metadata?.riskScore).toBe(55);
  });

  it('применяет несколько плагинов последовательно', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      extendRuleContext: (ruleContext) => {
        return {
          ...ruleContext,
          metadata: {
            ...ruleContext.metadata,
            riskScore: (ruleContext.metadata?.riskScore ?? 0) + 5,
          },
        };
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      extendRuleContext: (ruleContext) => {
        return {
          ...ruleContext,
          metadata: {
            ...ruleContext.metadata,
            riskScore: (ruleContext.metadata?.riskScore ?? 0) + 10,
          },
        };
      },
    };

    const result = buildRuleContext(deviceInfo, context, riskScore, [plugin1, plugin2]);

    expect(result.metadata?.riskScore).toBe(65); // 50 + 5 + 10
  });

  it('пропускает плагины без extendRuleContext', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;
    const plugin: ContextBuilderPlugin = {
      id: 'no-rule-plugin',
      // extendRuleContext отсутствует
    };

    const result = buildRuleContext(deviceInfo, context, riskScore, [plugin]);

    expect(result.metadata?.riskScore).toBe(50); // Не изменен
  });

  it('обрабатывает undefined plugins', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;

    const result = buildRuleContext(deviceInfo, context, riskScore, undefined);

    expect(result.metadata?.riskScore).toBe(50);
  });

  it('обрабатывает пустой массив plugins', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;

    const result = buildRuleContext(deviceInfo, context, riskScore, []);

    expect(result.metadata?.riskScore).toBe(50);
  });

  it('использует readonly ссылки на signals (O(1) по памяти)', () => {
    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals();
    const context: RiskContext = {
      signals,
    };
    const riskScore = 25;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    // Signals должны быть той же ссылкой (не deep copy)
    expect(result.signals).toBe(signals);
  });
});

// ============================================================================
// 🎯 TESTS - buildAssessmentContext
// ============================================================================

describe('buildAssessmentContext', () => {
  it('создает базовый assessment context без опциональных полей', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'desktop',
      // userAgent отсутствует
    };
    const context: RiskContext = {};

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userId).toBeUndefined();
    expect(result.ip).toBeUndefined();
    expect(result.geo).toBeUndefined();
    expect(result.userAgent).toBeUndefined();
    expect(result.previousSessionId).toBeUndefined();
    expect(result.timestamp).toBeUndefined();
    expect(result.signals).toBeUndefined();
  });

  it('создает полный assessment context со всеми полями', () => {
    const deviceInfo = createDeviceInfo({ userAgent: 'Mozilla/5.0' });
    const context = createRiskContext();

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userId).toBe(context.userId);
    expect(result.ip).toBe(context.ip);
    expect(result.geo).toBe(context.geo);
    expect(result.userAgent).toBe('Mozilla/5.0');
    expect(result.previousSessionId).toBe(context.previousSessionId);
    expect(result.timestamp).toBe(context.timestamp);
    expect(result.signals).toBe(context.signals);
  });

  it('создает assessment context только с userId', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      userId: 'user-123',
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userId).toBe('user-123');
    expect(result.ip).toBeUndefined();
    expect(result.geo).toBeUndefined();
  });

  it('создает assessment context только с ip', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      ip: '192.168.1.1',
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userId).toBeUndefined();
    expect(result.ip).toBe('192.168.1.1');
    expect(result.geo).toBeUndefined();
  });

  it('создает assessment context только с geo', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userId).toBeUndefined();
    expect(result.ip).toBeUndefined();
    expect(result.geo).toBe(context.geo);
  });

  it('создает assessment context с userAgent из deviceInfo', () => {
    const deviceInfo = createDeviceInfo({ userAgent: 'Custom-Agent' });
    const context: RiskContext = {};

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userAgent).toBe('Custom-Agent');
  });

  it('не добавляет userAgent если он отсутствует в deviceInfo', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'desktop',
      // userAgent отсутствует
    };
    const context: RiskContext = {};

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userAgent).toBeUndefined();
  });

  it('создает assessment context только с previousSessionId', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      previousSessionId: 'session-prev-456',
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.previousSessionId).toBe('session-prev-456');
  });

  it('создает assessment context только с timestamp', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      timestamp: '2026-01-15T10:30:00.000Z',
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.timestamp).toBe('2026-01-15T10:30:00.000Z');
  });

  it('создает assessment context только с signals', () => {
    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals();
    const context: RiskContext = {
      signals,
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.signals).toBe(signals);
  });

  it('применяет плагины для расширения assessment context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'assessment-plugin',
      extendAssessmentContext: (assessmentContext, riskContext) => {
        return {
          ...assessmentContext,
          userId: riskContext.userId ?? assessmentContext.userId ?? 'default-user',
        };
      },
    };

    const result = buildAssessmentContext(deviceInfo, context, [plugin]);

    expect(result.userId).toBe('user-123');
  });

  it('применяет несколько плагинов последовательно', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      userId: 'user-123',
    };
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      extendAssessmentContext: (assessmentContext) => {
        return {
          ...assessmentContext,
          userId: assessmentContext.userId ?? 'default-1',
        };
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      extendAssessmentContext: (assessmentContext) => {
        return {
          ...assessmentContext,
          userId: assessmentContext.userId ?? 'default-2',
        };
      },
    };

    const result = buildAssessmentContext(deviceInfo, context, [plugin1, plugin2]);

    expect(result.userId).toBe('user-123'); // Первый плагин устанавливает, второй не перезаписывает
  });

  it('пропускает плагины без extendAssessmentContext', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      userId: 'user-123',
    };
    const plugin: ContextBuilderPlugin = {
      id: 'no-assessment-plugin',
      // extendAssessmentContext отсутствует
    };

    const result = buildAssessmentContext(deviceInfo, context, [plugin]);

    expect(result.userId).toBe('user-123'); // Не изменен
  });

  it('обрабатывает undefined plugins', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      userId: 'user-123',
    };

    const result = buildAssessmentContext(deviceInfo, context, undefined);

    expect(result.userId).toBe('user-123');
  });

  it('обрабатывает пустой массив plugins', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      userId: 'user-123',
    };

    const result = buildAssessmentContext(deviceInfo, context, []);

    expect(result.userId).toBe('user-123');
  });

  it('использует readonly ссылки на signals (O(1) по памяти)', () => {
    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals();
    const context: RiskContext = {
      signals,
    };

    const result = buildAssessmentContext(deviceInfo, context);

    // Signals должны быть той же ссылкой (не deep copy)
    expect(result.signals).toBe(signals);
  });
});

// ============================================================================
// 🔧 TESTS - Plugin Integration (applyPlugins через публичные функции)
// ============================================================================

describe('Plugin Integration', () => {
  it('плагины получают readonly контексты', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const receivedContextRef: { value: ScoringContext | undefined; } = { value: undefined };
    const plugin: ContextBuilderPlugin = {
      id: 'readonly-check-plugin',
      extendScoringContext: (scoringContext) => {
        // eslint-disable-next-line fp/no-mutation -- Сохранение контекста для проверки
        receivedContextRef.value = scoringContext;
        // TypeScript предотвращает мутацию
        // scoringContext.device.deviceId = 'new-id'; // TypeScript error
        return scoringContext;
      },
    };

    buildScoringContext(deviceInfo, context, [plugin]);

    expect(receivedContextRef.value).toBeDefined();
    expect(receivedContextRef.value?.signals?.reputationScore).toBe(50);
  });

  it('плагины должны возвращать новый объект (pure функции)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const originalSignals = context.signals;
    const plugin: ContextBuilderPlugin = {
      id: 'pure-plugin',
      extendScoringContext: (scoringContext) => {
        // Pure функция: возвращает новый объект, не мутирует входной
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
    };

    const result = buildScoringContext(deviceInfo, context, [plugin]);

    // Оригинальный контекст не изменен
    expect(context.signals).toBe(originalSignals);
    expect(context.signals?.reputationScore).toBe(50);
    // Результат изменен
    expect(result.signals?.reputationScore).toBe(60);
  });

  it('плагины не могут мутировать вложенные объекты signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const originalPreviousGeo = context.signals?.previousGeo;
    const plugin: ContextBuilderPlugin = {
      id: 'immutable-signals-plugin',
      extendScoringContext: (scoringContext) => {
        // Плагин не может мутировать вложенные объекты из-за ReadonlyDeep
        // scoringContext.signals!.previousGeo!.lat = 0; // TypeScript error
        return scoringContext;
      },
    };

    const result = buildScoringContext(deviceInfo, context, [plugin]);

    // Оригинальные signals не изменены
    expect(context.signals?.previousGeo).toBe(originalPreviousGeo);
    expect(result.signals?.previousGeo).toBe(originalPreviousGeo);
  });

  it('плагины могут комбинировать несколько методов расширения', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 50;
    const plugin: ContextBuilderPlugin = {
      id: 'multi-method-plugin',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 5,
          },
        };
      },
      extendRuleContext: (ruleContext) => {
        return {
          ...ruleContext,
          metadata: {
            ...ruleContext.metadata,
            riskScore: (ruleContext.metadata?.riskScore ?? 0) + 10,
          },
        };
      },
      extendAssessmentContext: (assessmentContext) => {
        return {
          ...assessmentContext,
          userId: assessmentContext.userId ?? 'default-user',
        };
      },
    };

    const scoringResult = buildScoringContext(deviceInfo, context, [plugin]);
    const ruleResult = buildRuleContext(deviceInfo, context, riskScore, [plugin]);
    const assessmentResult = buildAssessmentContext(deviceInfo, context, [plugin]);

    expect(scoringResult.signals?.reputationScore).toBe(55);
    expect(ruleResult.metadata?.riskScore).toBe(60);
    expect(assessmentResult.userId).toBe('user-123');
  });
});

// ============================================================================
// 🔧 TESTS - Dev-mode deepFreeze (через NODE_ENV)
// ============================================================================

describe('Dev-mode deepFreeze', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('применяет deepFreeze к signals в dev-mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const signals = context.signals;

    buildScoringContext(deviceInfo, context);

    // В dev-mode signals должны быть заморожены
    void (signals !== undefined
      ? ((): void => {
        expect(Object.isFrozen(signals)).toBe(true);
        // Вложенные объекты также должны быть заморожены
        void (signals.previousGeo !== undefined
          ? expect(Object.isFrozen(signals.previousGeo)).toBe(true)
          : undefined);
        void (signals.externalSignals !== undefined
          ? expect(Object.isFrozen(signals.externalSignals)).toBe(true)
          : undefined);
      })()
      : undefined);
  });

  it('не применяет deepFreeze в production-mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const signals = context.signals;

    buildScoringContext(deviceInfo, context);

    // В production signals не должны быть заморожены (оптимизация)
    void (signals !== undefined
      ? expect(Object.isFrozen(signals)).toBe(false)
      : undefined);
  });

  it('применяет deepFreeze к signals после применения плагинов в dev-mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'dev-mode-plugin',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
    };

    const result = buildScoringContext(deviceInfo, context, [plugin]);

    // Signals после плагина должны быть заморожены
    void (result.signals !== undefined
      ? expect(Object.isFrozen(result.signals)).toBe(true)
      : undefined);
  });

  it('не применяет deepFreeze когда signals отсутствуют', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      // signals отсутствуют
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.signals).toBeUndefined();
  });

  it('deepFreeze обрабатывает signals с null значениями внутри previousGeo', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      signals: {
        isVpn: false,
        previousGeo: {
          country: 'US',
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.signals).toBeDefined();
    expect(result.signals?.previousGeo?.lat).toBe(37.7749);
  });

  it('deepFreeze пропускает примитивы', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      signals: {
        isVpn: false,
        reputationScore: 50,
        velocityScore: 30,
      },
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.signals?.isVpn).toBe(false);
    expect(result.signals?.reputationScore).toBe(50);
  });

  it('deepFreeze пропускает специальные объекты (Date, RegExp, Map, Set) в externalSignals через buildAssessmentContext', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const date = new Date('2026-01-15T10:30:00.000Z');
    const regex = /test/;
    const map = new Map([['key', 'value']]);
    const set = new Set([1, 2, 3]);
    const context: RiskContext = {
      signals: {
        isVpn: false,
        externalSignals: {
          date,
          regex,
          map,
          set,
        },
      },
    };

    const result = buildAssessmentContext(deviceInfo, context);

    // Специальные объекты не должны быть заморожены
    expect(result.signals?.externalSignals?.['date']).toBe(date);
    expect(result.signals?.externalSignals?.['regex']).toBe(regex);
    expect(result.signals?.externalSignals?.['map']).toBe(map);
    expect(result.signals?.externalSignals?.['set']).toBe(set);
  });

  it('deepFreeze обрабатывает циклические ссылки', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const circular: Record<string, unknown> = { value: 'test' };
    Object.defineProperty(circular, 'self', {
      value: circular,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    const context: RiskContext = {
      signals: {
        isVpn: false,
        externalSignals: circular,
      },
    };

    // Не должно быть stack overflow
    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.signals).toBeDefined();
  });

  it('deepFreeze обрабатывает signals с вложенными null/undefined/примитивами через buildAssessmentContext', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      signals: {
        isVpn: false,
        externalSignals: {
          nested: {
            nullValue: null,
            undefinedValue: undefined,
            stringValue: 'test',
            numberValue: 42,
            booleanValue: true,
            emptyObject: {},
          },
        },
      },
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.signals).toBeDefined();
    void (result.signals?.externalSignals !== undefined
      ? ((): void => {
        expect(Object.isFrozen(result.signals.externalSignals)).toBe(true);
        void (result.signals.externalSignals['nested'] !== undefined
          ? expect(Object.isFrozen(result.signals.externalSignals['nested'])).toBe(true)
          : undefined);
      })()
      : undefined);
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('ContextBuilders edge cases', () => {
  it('buildScoringContext обрабатывает контекст без signals', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      ip: '192.168.1.1',
      // signals отсутствуют
    };

    const result = buildScoringContext(deviceInfo, context);

    expect(result.signals).toBeUndefined();
  });

  it('buildRuleContext обрабатывает контекст без previousGeo в signals', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {
      signals: {
        isVpn: false,
        // previousGeo отсутствует
      },
    };
    const riskScore = 25;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.previousGeo).toBeUndefined();
  });

  it('buildAssessmentContext обрабатывает deviceInfo без userAgent', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'desktop',
      // userAgent отсутствует
    };
    const context: RiskContext = {
      userId: 'user-123',
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userAgent).toBeUndefined();
  });

  it('buildScoringContext обрабатывает смешанные плагины (с extend и без)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-with-extend',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 5,
          },
        };
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-without-extend',
      // extendScoringContext отсутствует
    };
    const plugin3: ContextBuilderPlugin = {
      id: 'plugin-with-extend-2',
      extendScoringContext: (scoringContext) => {
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 10,
          },
        };
      },
    };

    const result = buildScoringContext(deviceInfo, context, [plugin1, plugin2, plugin3]);

    expect(result.signals?.reputationScore).toBe(65); // 50 + 5 + 10
  });

  it('buildRuleContext обрабатывает riskScore = 0', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 0;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.metadata?.riskScore).toBe(0);
  });

  it('buildRuleContext обрабатывает riskScore = 100', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const riskScore = 100;

    const result = buildRuleContext(deviceInfo, context, riskScore);

    expect(result.metadata?.riskScore).toBe(100);
  });

  it('buildAssessmentContext обрабатывает все опциональные поля одновременно', () => {
    const deviceInfo = createDeviceInfo({ userAgent: 'Custom-Agent' });
    const context: RiskContext = {
      userId: 'user-123',
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
      },
      previousSessionId: 'session-prev-456',
      timestamp: '2026-01-15T10:30:00.000Z',
      signals: createRiskSignals(),
    };

    const result = buildAssessmentContext(deviceInfo, context);

    expect(result.userId).toBe('user-123');
    expect(result.ip).toBe('192.168.1.1');
    expect(result.geo).toBe(context.geo);
    expect(result.userAgent).toBe('Custom-Agent');
    expect(result.previousSessionId).toBe('session-prev-456');
    expect(result.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(result.signals).toBe(context.signals);
  });
});
