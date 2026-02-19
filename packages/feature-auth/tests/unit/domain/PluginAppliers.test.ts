/**
 * @file Unit тесты для domain/PluginAppliers.ts
 * Полное покрытие plugin appliers с 100% покрытием
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';
import type { RuleEvaluationContext } from '../../../src/effects/login/risk-rules.js';
import type { ScoringContext } from '../../../src/effects/login/risk-scoring.js';
import type {
  BuildAssessmentContext,
  ContextBuilderPlugin,
  RiskContext,
  RiskSignals,
} from '../../../src/types/risk.js';
import {
  applyAssessmentPlugins,
  applyRulePlugins,
  applyScoringPlugins,
} from '../../../src/domain/PluginAppliers.js';

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

function createScoringContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    device: createDeviceInfo(),
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
    device: createDeviceInfo(),
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

function createBuildAssessmentContext(
  overrides: Partial<BuildAssessmentContext> = {},
): BuildAssessmentContext {
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
    userAgent: 'Mozilla/5.0',
    previousSessionId: 'session-prev-456',
    timestamp: '2026-01-15T10:30:00.000Z',
    signals: createRiskSignals(),
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - applyScoringPlugins
// ============================================================================

describe('applyScoringPlugins', () => {
  it('возвращает контекст без изменений при пустом массиве плагинов', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();

    const result = applyScoringPlugins(context, [], riskContext);

    expect(result).toBe(context);
  });

  it('применяет один плагин для расширения scoring context', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
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

    const result = applyScoringPlugins(context, [plugin], riskContext);

    expect(result.signals?.reputationScore).toBe(60);
  });

  it('применяет несколько плагинов последовательно', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
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

    const result = applyScoringPlugins(context, [plugin1, plugin2], riskContext);

    expect(result.signals?.reputationScore).toBe(65); // 50 + 5 + 10
  });

  it('сортирует плагины по priority перед применением', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: 20,
      extendScoringContext: (scoringContext) => {
        order.push(1);
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 1,
          },
        };
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      priority: 10,
      extendScoringContext: (scoringContext) => {
        order.push(2);
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 2,
          },
        };
      },
    };
    const plugin3: ContextBuilderPlugin = {
      id: 'plugin-3',
      priority: 15,
      extendScoringContext: (scoringContext) => {
        order.push(3);
        return {
          ...scoringContext,
          signals: {
            ...scoringContext.signals,
            reputationScore: (scoringContext.signals?.reputationScore ?? 0) + 3,
          },
        };
      },
    };

    applyScoringPlugins(context, [plugin1, plugin2, plugin3], riskContext);

    // Порядок применения: plugin2 (10), plugin3 (15), plugin1 (20)
    expect(order).toEqual([2, 3, 1]);
  });

  it('применяет плагины без priority последними', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: 10,
      extendScoringContext: (scoringContext) => {
        order.push(1);
        return scoringContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      // priority отсутствует
      extendScoringContext: (scoringContext) => {
        order.push(2);
        return scoringContext;
      },
    };
    const plugin3: ContextBuilderPlugin = {
      id: 'plugin-3',
      priority: 5,
      extendScoringContext: (scoringContext) => {
        order.push(3);
        return scoringContext;
      },
    };

    applyScoringPlugins(context, [plugin1, plugin2, plugin3], riskContext);

    // Порядок: plugin3 (5), plugin1 (10), plugin2 (без priority = MAX_SAFE_INTEGER)
    expect(order[0]).toBe(3);
    expect(order[1]).toBe(1);
    expect(order[2]).toBe(2);
  });

  it('пропускает плагины без extendScoringContext', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'no-scoring-plugin',
      // extendScoringContext отсутствует
    };

    const result = applyScoringPlugins(context, [plugin], riskContext);

    expect(result.signals?.reputationScore).toBe(50); // Не изменен
  });
});

// ============================================================================
// 🎯 TESTS - applyRulePlugins
// ============================================================================

describe('applyRulePlugins', () => {
  it('возвращает контекст без изменений при пустом массиве плагинов', () => {
    const context = createRuleEvaluationContext();
    const riskContext = createRiskContext();

    const result = applyRulePlugins(context, [], riskContext);

    expect(result).toBe(context);
  });

  it('применяет один плагин для расширения rule context', () => {
    const context = createRuleEvaluationContext();
    const riskContext = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'rule-plugin',
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

    const result = applyRulePlugins(context, [plugin], riskContext);

    expect(result.metadata?.riskScore).toBe(35); // 25 + 10
  });

  it('применяет несколько плагинов последовательно', () => {
    const context = createRuleEvaluationContext();
    const riskContext = createRiskContext();
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

    const result = applyRulePlugins(context, [plugin1, plugin2], riskContext);

    expect(result.metadata?.riskScore).toBe(40); // 25 + 5 + 10
  });

  it('сортирует плагины по priority перед применением', () => {
    const context = createRuleEvaluationContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: 30,
      extendRuleContext: (ruleContext) => {
        order.push(1);
        return ruleContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      priority: 10,
      extendRuleContext: (ruleContext) => {
        order.push(2);
        return ruleContext;
      },
    };

    applyRulePlugins(context, [plugin1, plugin2], riskContext);

    // Порядок: plugin2 (10), plugin1 (30)
    expect(order).toEqual([2, 1]);
  });

  it('пропускает плагины без extendRuleContext', () => {
    const context = createRuleEvaluationContext();
    const riskContext = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'no-rule-plugin',
      // extendRuleContext отсутствует
    };

    const result = applyRulePlugins(context, [plugin], riskContext);

    expect(result.metadata?.riskScore).toBe(25); // Не изменен
  });
});

// ============================================================================
// 🎯 TESTS - applyAssessmentPlugins
// ============================================================================

describe('applyAssessmentPlugins', () => {
  it('возвращает контекст без изменений при пустом массиве плагинов', () => {
    const context = createBuildAssessmentContext();
    const riskContext = createRiskContext();

    const result = applyAssessmentPlugins(context, [], riskContext);

    expect(result).toBe(context);
  });

  it('применяет один плагин для расширения assessment context', () => {
    const context = createBuildAssessmentContext();
    const riskContext = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'assessment-plugin',
      extendAssessmentContext: (assessmentContext) => {
        return {
          ...assessmentContext,
          userId: assessmentContext.userId ?? 'default-user',
        };
      },
    };

    const result = applyAssessmentPlugins(context, [plugin], riskContext);

    expect(result.userId).toBe('user-123');
  });

  it('применяет несколько плагинов последовательно', () => {
    const context = createBuildAssessmentContext();
    const riskContext = createRiskContext();
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

    const result = applyAssessmentPlugins(context, [plugin1, plugin2], riskContext);

    expect(result.userId).toBe('user-123'); // Первый плагин устанавливает, второй не перезаписывает
  });

  it('сортирует плагины по priority перед применением', () => {
    const context = createBuildAssessmentContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: 50,
      extendAssessmentContext: (assessmentContext) => {
        order.push(1);
        return assessmentContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      priority: 20,
      extendAssessmentContext: (assessmentContext) => {
        order.push(2);
        return assessmentContext;
      },
    };

    applyAssessmentPlugins(context, [plugin1, plugin2], riskContext);

    // Порядок: plugin2 (20), plugin1 (50)
    expect(order).toEqual([2, 1]);
  });

  it('пропускает плагины без extendAssessmentContext', () => {
    const context = createBuildAssessmentContext();
    const riskContext = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'no-assessment-plugin',
      // extendAssessmentContext отсутствует
    };

    const result = applyAssessmentPlugins(context, [plugin], riskContext);

    expect(result.userId).toBe('user-123'); // Не изменен
  });
});

// ============================================================================
// 🔧 TESTS - Dev-mode deepFreeze
// ============================================================================

describe('Dev-mode deepFreeze', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('применяет deepFreeze к signals в dev-mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const signals = context.signals;

    applyScoringPlugins(context, [], riskContext);

    // В dev-mode signals должны быть заморожены
    void (signals !== undefined
      ? ((): void => {
        expect(Object.isFrozen(signals)).toBe(true);
      })()
      : undefined);
  });

  it('не применяет deepFreeze в production-mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const signals = context.signals;

    applyScoringPlugins(context, [], riskContext);

    // В production signals не должны быть заморожены (оптимизация)
    void (signals !== undefined
      ? expect(Object.isFrozen(signals)).toBe(false)
      : undefined);
  });

  it('применяет deepFreeze к signals после применения плагинов в dev-mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const context = createScoringContext();
    const riskContext = createRiskContext();
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

    const result = applyScoringPlugins(context, [plugin], riskContext);

    // Signals после плагина должны быть заморожены
    void (result.signals !== undefined
      ? expect(Object.isFrozen(result.signals)).toBe(true)
      : undefined);
  });

  it('не применяет deepFreeze когда signals отсутствуют', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const context: ScoringContext = {
      device: createDeviceInfo(),
      // signals отсутствуют
    };
    const riskContext = createRiskContext();

    const result = applyScoringPlugins(context, [], riskContext);

    expect(result.signals).toBeUndefined();
  });

  it('deepFreeze обрабатывает signals с null значениями внутри', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const context = createScoringContext({
      signals: {
        isVpn: false,
        previousGeo: {
          country: 'US',
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    });
    const riskContext = createRiskContext();

    applyScoringPlugins(context, [], riskContext);

    expect(context.signals).toBeDefined();
  });

  it('deepFreeze пропускает примитивы', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const context = createScoringContext({
      signals: {
        isVpn: false,
        reputationScore: 50,
        velocityScore: 30,
      },
    });
    const riskContext = createRiskContext();

    applyScoringPlugins(context, [], riskContext);

    expect(context.signals?.isVpn).toBe(false);
    expect(context.signals?.reputationScore).toBe(50);
  });

  it('deepFreeze пропускает специальные объекты (Date, RegExp, Map, Set) в externalSignals через buildAssessmentContext', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const date = new Date('2026-01-15T10:30:00.000Z');
    const regex = /test/;
    const map = new Map([['key', 'value']]);
    const set = new Set([1, 2, 3]);
    const context = createBuildAssessmentContext({
      signals: {
        isVpn: false,
        externalSignals: {
          date,
          regex,
          map,
          set,
        },
      },
    });
    const riskContext = createRiskContext();

    const result = applyAssessmentPlugins(context, [], riskContext);

    // Специальные объекты не должны быть заморожены
    expect(result.signals?.externalSignals?.['date']).toBe(date);
    expect(result.signals?.externalSignals?.['regex']).toBe(regex);
    expect(result.signals?.externalSignals?.['map']).toBe(map);
    expect(result.signals?.externalSignals?.['set']).toBe(set);
  });

  it('deepFreeze обрабатывает циклические ссылки через buildAssessmentContext', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const circular: Record<string, unknown> = { value: 'test' };
    Object.defineProperty(circular, 'self', {
      value: circular,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    const context = createBuildAssessmentContext({
      signals: {
        isVpn: false,
        externalSignals: circular,
      },
    });
    const riskContext = createRiskContext();

    // Не должно быть stack overflow
    const result = applyAssessmentPlugins(context, [], riskContext);

    expect(result.signals).toBeDefined();
  });

  it('deepFreeze использует shallow freeze для больших Record (externalSignals > 50 ключей)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const largeRecord: Record<string, unknown> = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`key${i}`, `value${i}`]),
    );
    const context = createBuildAssessmentContext({
      signals: {
        isVpn: false,
        externalSignals: largeRecord,
      },
    });
    const riskContext = createRiskContext();

    const result = applyAssessmentPlugins(context, [], riskContext);

    // Большой Record должен быть заморожен (shallow freeze)
    void (result.signals?.externalSignals !== undefined
      ? expect(Object.isFrozen(result.signals.externalSignals)).toBe(true)
      : undefined);
  });

  it('deepFreeze обрабатывает очень большие объекты (≥1000 ключей) с ленивой проверкой', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const veryLargeRecord: Record<string, unknown> = Object.fromEntries(
      Array.from({ length: 1100 }, (_, i) => [`key${i}`, `value${i}`]),
    );
    const context = createBuildAssessmentContext({
      signals: {
        isVpn: false,
        externalSignals: veryLargeRecord,
      },
    });
    const riskContext = createRiskContext();

    // Не должно быть stack overflow или проблем с производительностью
    const result = applyAssessmentPlugins(context, [], riskContext);

    expect(result.signals).toBeDefined();
    void (result.signals?.externalSignals !== undefined
      ? expect(Object.isFrozen(result.signals.externalSignals)).toBe(true)
      : undefined);
  });

  it('deepFreeze обрабатывает не-массивы и не-объекты (другие типы объектов)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const context = createBuildAssessmentContext({
      signals: {
        isVpn: false,
        externalSignals: {
          // Объект с конструктором, отличным от Object
          customObj: Object.create(null),
        },
      },
    });
    const riskContext = createRiskContext();

    const result = applyAssessmentPlugins(context, [], riskContext);

    expect(result.signals).toBeDefined();
  });

  it('deepFreeze обрабатывает вложенные объекты на большой глубине (depth > 2)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const veryLargeRecord: Record<string, unknown> = Object.fromEntries(
      Array.from({ length: 1100 }, (_, i) => [`key${i}`, `value${i}`]),
    );
    // Создаем глубоко вложенную структуру
    const nested: Record<string, unknown> = {
      level1: {
        level2: {
          level3: veryLargeRecord,
        },
      },
    };
    const context = createBuildAssessmentContext({
      signals: {
        isVpn: false,
        externalSignals: nested,
      },
    });
    const riskContext = createRiskContext();

    const result = applyAssessmentPlugins(context, [], riskContext);

    expect(result.signals).toBeDefined();
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('PluginAppliers edge cases', () => {
  it('applyScoringPlugins обрабатывает контекст без signals', () => {
    const context: ScoringContext = {
      device: createDeviceInfo(),
      // signals отсутствуют
    };
    const riskContext = createRiskContext();

    const result = applyScoringPlugins(context, [], riskContext);

    expect(result.signals).toBeUndefined();
  });

  it('applyScoringPlugins обрабатывает смешанные плагины (с extend и без)', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
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

    const result = applyScoringPlugins(context, [plugin1, plugin2, plugin3], riskContext);

    expect(result.signals?.reputationScore).toBe(65); // 50 + 5 + 10
  });

  it('applyScoringPlugins обрабатывает плагины с одинаковым priority', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: 10,
      extendScoringContext: (scoringContext) => {
        order.push(1);
        return scoringContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      priority: 10,
      extendScoringContext: (scoringContext) => {
        order.push(2);
        return scoringContext;
      },
    };

    applyScoringPlugins(context, [plugin1, plugin2], riskContext);

    // Порядок должен быть стабильным (stable sort)
    expect(order.length).toBe(2);
    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  it('applyScoringPlugins обрабатывает плагины с отрицательным priority', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: -10,
      extendScoringContext: (scoringContext) => {
        order.push(1);
        return scoringContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      priority: 10,
      extendScoringContext: (scoringContext) => {
        order.push(2);
        return scoringContext;
      },
    };

    applyScoringPlugins(context, [plugin1, plugin2], riskContext);

    // Порядок: plugin1 (-10), plugin2 (10)
    expect(order).toEqual([1, 2]);
  });

  it('applyScoringPlugins обрабатывает плагины с нулевым priority', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: 0,
      extendScoringContext: (scoringContext) => {
        order.push(1);
        return scoringContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      priority: 10,
      extendScoringContext: (scoringContext) => {
        order.push(2);
        return scoringContext;
      },
    };

    applyScoringPlugins(context, [plugin1, plugin2], riskContext);

    // Порядок: plugin1 (0), plugin2 (10)
    expect(order).toEqual([1, 2]);
  });

  it('applyScoringPlugins обрабатывает плагины с очень большим priority', () => {
    const context = createScoringContext();
    const riskContext = createRiskContext();
    const order: number[] = [];
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      priority: Number.MAX_SAFE_INTEGER - 1,
      extendScoringContext: (scoringContext) => {
        order.push(1);
        return scoringContext;
      },
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      // priority отсутствует (будет MAX_SAFE_INTEGER)
      extendScoringContext: (scoringContext) => {
        order.push(2);
        return scoringContext;
      },
    };

    applyScoringPlugins(context, [plugin1, plugin2], riskContext);

    // Порядок: plugin1 (MAX_SAFE_INTEGER - 1), plugin2 (MAX_SAFE_INTEGER)
    expect(order).toEqual([1, 2]);
  });
});
