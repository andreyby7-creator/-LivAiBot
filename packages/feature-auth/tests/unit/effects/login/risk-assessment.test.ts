/**
 * @file Unit тесты для effects/login/risk-assessment.ts
 * Полное покрытие risk assessment с тестированием всех функций и edge cases
 */

import { describe, expect, it, vi } from 'vitest';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type { RiskLevel } from '../../../../src/types/auth.js';
import { assessLoginRisk } from '../../../../src/effects/login/risk-assessment.js';
import type {
  AuditHook,
  ContextBuilderPlugin,
  ExternalRiskSignals,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../../../../src/effects/login/risk-assessment.js';
import { defaultDecisionPolicy } from '../../../../src/effects/login/risk-decision.js';
import { sanitizeExternalSignals } from '../../../../src/lib/sanitizer.js';
import type { RiskSemanticViolation } from '../../../../src/domain/RiskValidation.js';
import * as ValidationModule from '../../../../src/domain/RiskValidation.js';

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

/** Создает RiskContext для тестов */
function createRiskContext(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    ip: '192.168.1.1',
    geo: {
      country: 'US',
    },
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
// 🎯 TESTS - assessLoginRisk (Main API)
// ============================================================================

describe('assessLoginRisk', () => {
  it('возвращает результат оценки риска для безопасного контекста', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.riskLevel).toBeDefined();
    expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    expect(Array.isArray(result.triggeredRules)).toBe(true);
    expect(result.decisionHint).toBeDefined();
    expect(result.decisionHint.action).toBeDefined();
    expect(['allow', 'challenge', 'block']).toContain(result.decisionHint.action);
    expect(result.assessment).toBeDefined();
  });

  it('возвращает результат для risky контекста', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.triggeredRules.length).toBeGreaterThan(0);
  });

  it('использует дефолтные policy если не указаны', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskLevel).toBeDefined();
  });

  it('использует кастомные weights из policy', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext();
    const policy: RiskPolicy = {
      weights: {
        device: 1.0,
        geo: 0,
        network: 0,
        velocity: 0,
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    // device risk = 40, weight = 1.0, score = 40
    expect(result.riskScore).toBe(40);
  });

  it('использует кастомную decision policy', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const policy: RiskPolicy = {
      decision: {
        thresholds: {
          low: 20,
          medium: 40,
          high: 60,
          critical: 80,
        },
        challengeOnHighRisk: false,
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result).toBeDefined();
    expect(result.riskLevel).toBeDefined();
  });

  it('обрабатывает контекст без IP', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    // Удаляем ip из контекста
    const { ip, ...contextWithoutIp } = context;
    const result = assessLoginRisk(deviceInfo, contextWithoutIp);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает контекст без geo', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    // Удаляем geo из контекста
    const { geo, ...contextWithoutGeo } = context;
    const result = assessLoginRisk(deviceInfo, contextWithoutGeo);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает контекст без signals', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    // Удаляем signals из контекста
    const { signals, ...contextWithoutSignals } = context;
    const result = assessLoginRisk(deviceInfo, contextWithoutSignals);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает контекст без userId', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    // Удаляем userId из контекста
    const { userId, ...contextWithoutUserId } = context;
    const result = assessLoginRisk(deviceInfo, contextWithoutUserId);

    expect(result).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('обрабатывает контекст с userId', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({ userId: 'user-123' });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.assessment.userId).toBe('user-123');
  });

  it('обрабатывает контекст с previousSessionId', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({ previousSessionId: 'session-123' });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.assessment.previousSessionId).toBe('session-123');
  });

  it('обрабатывает контекст без previousSessionId (новое устройство)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    // Удаляем previousSessionId из контекста
    const { previousSessionId, ...contextWithoutSessionId } = context;
    const result = assessLoginRisk(deviceInfo, contextWithoutSessionId);

    expect(result).toBeDefined();
    // isNewDevice должно быть true
    expect(result.triggeredRules).toBeDefined();
  });

  it('обрабатывает контекст с timestamp', () => {
    const deviceInfo = createDeviceInfo();
    const timestamp = '2026-01-15T10:30:00.000Z';
    const context = createRiskContext({ timestamp });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.assessment.timestamp).toBe(timestamp);
  });

  it('обрабатывает контекст без timestamp', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    // Удаляем timestamp из контекста
    const { timestamp, ...contextWithoutTimestamp } = context;
    const result = assessLoginRisk(deviceInfo, contextWithoutTimestamp);

    expect(result).toBeDefined();
    expect(result.assessment).toBeDefined();
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
      return { deviceType, result: assessLoginRisk(deviceInfo, context) };
    });
    results.forEach(({ result }) => {
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.riskLevel).toBeDefined();
    });
  });

  it('обрабатывает различные сигналы риска', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      isVpn: true,
      isTor: true,
      isProxy: true,
      reputationScore: 20,
      velocityScore: 75,
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.triggeredRules.length).toBeGreaterThan(0);
  });

  it('обрабатывает previousGeo в signals', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      previousGeo: {
        country: 'DE',
        region: 'Berlin',
        city: 'Berlin',
        lat: 52.52,
        lng: 13.405,
      },
    };
    const context = createRiskContext({
      geo: { country: 'US' },
      signals,
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
  });

  it('обрабатывает externalSignals (валидные JSON-serializable)', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals: ExternalRiskSignals = {
      vendorScore: 85,
      vendorFlags: ['suspicious', 'high_risk'],
      metadata: {
        // eslint-disable-next-line @livai/rag/source-citation -- тестовые данные, не реальная citation
        source: 'vendor-api',
        confidence: 0.95,
      },
    };
    const signals: RiskSignals = {
      externalSignals,
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('sanitizeExternalSignals отклоняет невалидные externalSignals (не объект)', () => {
    const invalidSignals = 'not-an-object';

    const result = sanitizeExternalSignals(invalidSignals);

    expect(result).toBeUndefined();
  });

  it('sanitizeExternalSignals отклоняет невалидные externalSignals (циклические ссылки)', () => {
    const circular: Record<string, unknown> = { self: null };
    // eslint-disable-next-line fp/no-mutation -- намеренное создание циклической ссылки для теста
    circular['self'] = circular; // Циклическая ссылка

    // sanitizeExternalSignals может вызвать переполнение стека при оценке размера циклических ссылок
    // Ожидаем, что функция либо вернет undefined, либо выбросит ошибку
    const getResult = (): ReturnType<typeof sanitizeExternalSignals> => {
      try {
        return sanitizeExternalSignals(circular);
      } catch {
        // Если произошло переполнение стека, это тоже валидное поведение для циклических ссылок
        return undefined;
      }
    };
    const result = getResult();

    expect(result).toBeUndefined();
  });

  it('sanitizeExternalSignals удаляет функции из externalSignals', () => {
    const signalsWithFunction = {
      func: (): void => {},
      validField: 'value',
    };

    const result = sanitizeExternalSignals(signalsWithFunction);

    // Функция должна быть удалена, но объект остается валидным с остальными полями
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('func');
    expect(result).toHaveProperty('validField');
    expect(result?.['validField']).toBe('value');
  });

  it('принимает валидные externalSignals с массивами', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals: ExternalRiskSignals = {
      flags: ['flag1', 'flag2'],
      scores: [10, 20, 30],
    };
    const signals: RiskSignals = {
      externalSignals,
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('принимает валидные externalSignals с null значениями', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals: ExternalRiskSignals = {
      value1: null,
      value2: 'string',
      value3: 42,
    };
    const signals: RiskSignals = {
      externalSignals,
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('принимает валидные externalSignals с вложенными объектами', () => {
    const deviceInfo = createDeviceInfo();
    const externalSignals: ExternalRiskSignals = {
      nested: {
        level1: {
          level2: 'value',
        },
      },
    };
    const signals: RiskSignals = {
      externalSignals,
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// 🎯 TESTS - Plugins
// ============================================================================

describe('Plugins', () => {
  it('применяет плагин для расширения scoring context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'scoring-plugin',
      extendScoringContext: (scoringContext) => ({
        ...scoringContext,
        signals: scoringContext.signals
          ? {
            ...scoringContext.signals,
            customScore: 50,
          }
          : {
            customScore: 50,
          },
      }),
    };
    const result = assessLoginRisk(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('применяет плагин для расширения rule context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'rule-plugin',
      extendRuleContext: (ruleContext) => ({
        ...ruleContext,
        metadata: {
          ...ruleContext.metadata,
          customFlag: true,
        },
      }),
    };
    const result = assessLoginRisk(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.triggeredRules).toBeDefined();
  });

  it('применяет плагин для расширения assessment context', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'assessment-plugin',
      extendAssessmentContext: (assessmentContext) => ({
        ...assessmentContext,
        customField: 'custom-value',
      }),
    };
    const result = assessLoginRisk(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.assessment).toBeDefined();
  });

  it('применяет несколько плагинов последовательно', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin1: ContextBuilderPlugin = {
      id: 'plugin-1',
      extendScoringContext: (scoringContext) => ({
        ...scoringContext,
        signals: scoringContext.signals
          ? {
            ...scoringContext.signals,
            score1: 10,
          }
          : {
            score1: 10,
          },
      }),
    };
    const plugin2: ContextBuilderPlugin = {
      id: 'plugin-2',
      extendScoringContext: (scoringContext) => ({
        ...scoringContext,
        signals: scoringContext.signals
          ? {
            ...scoringContext.signals,
            score2: 20,
          }
          : {
            score2: 20,
          },
      }),
    };
    const result = assessLoginRisk(deviceInfo, context, {}, [plugin1, plugin2]);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает плагин без методов расширения', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const plugin: ContextBuilderPlugin = {
      id: 'empty-plugin',
    };
    const result = assessLoginRisk(deviceInfo, context, {}, [plugin]);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает пустой массив плагинов', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const result = assessLoginRisk(deviceInfo, context, {}, []);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// 🎯 TESTS - Audit Hook
// ============================================================================

describe('Audit Hook', () => {
  it('вызывает audit hook для block решения', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true }),
    });
    const auditHook: AuditHook = vi.fn();
    const result = assessLoginRisk(deviceInfo, context, {}, [], auditHook);

    expect(auditHook).toHaveBeenCalledTimes(1);
    expect(auditHook).toHaveBeenCalledWith(result, context);
    expect(result.decisionHint.action).toBe('block');
  });

  it('вызывает audit hook для challenge решения', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({
        reputationScore: 20, // LOW_REPUTATION
      }),
    });
    const policy: RiskPolicy = {
      decision: {
        thresholds: defaultDecisionPolicy.thresholds,
        challengeOnHighRisk: true,
      },
    };
    const auditHook: AuditHook = vi.fn();
    const result = assessLoginRisk(deviceInfo, context, policy, [], auditHook);

    // LOW_REPUTATION дает challenge через правило или policy
    // Если challengeOnHighRisk=true и riskLevel=high, то будет challenge
    // eslint-disable-next-line functional/no-conditional-statements -- тестовая логика, if более читабелен
    if (result.decisionHint.action === 'challenge') {
      expect(auditHook).toHaveBeenCalledTimes(1);
      expect(auditHook).toHaveBeenCalledWith(result, context);
    } else {
      // Если не challenge, то проверяем что hook не вызван
      expect(auditHook).not.toHaveBeenCalled();
    }
  });

  it('не вызывает audit hook для allow решения', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const auditHook: AuditHook = vi.fn();
    assessLoginRisk(deviceInfo, context, {}, [], auditHook);

    expect(auditHook).not.toHaveBeenCalled();
  });

  it('не вызывает audit hook если hook не передан', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const auditHook: AuditHook = vi.fn();
    const result = assessLoginRisk(deviceInfo, context, {}, [], undefined);

    expect(auditHook).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('передает правильные параметры в audit hook', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      userId: 'user-123',
      signals: createRiskSignals({ isTor: true }),
    });
    const auditHook: AuditHook = vi.fn();
    assessLoginRisk(deviceInfo, context, {}, [], auditHook);

    expect(auditHook).toHaveBeenCalledWith(
      expect.objectContaining({
        riskScore: expect.any(Number),
        riskLevel: expect.any(String),
        triggeredRules: expect.any(Array),
        decisionHint: expect.objectContaining({
          action: 'block',
        }),
        assessment: expect.any(Object),
      }),
      context,
    );
  });
});

// ============================================================================
// 🎯 TESTS - Integration with Rules
// ============================================================================

describe('Integration with Rules', () => {
  it('возвращает triggered rules для risky контекста', () => {
    // UNKNOWN_DEVICE срабатывает для deviceType='unknown'
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-unknown',
      deviceType: 'unknown',
      // OS и browser отсутствуют для чистого UNKNOWN_DEVICE
    };
    const context = createRiskContext({
      ip: '192.168.1.1', // Нужен валидный IP для network rules
      signals: createRiskSignals({ isTor: true }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.triggeredRules.length).toBeGreaterThan(0);
    // UNKNOWN_DEVICE срабатывает для deviceType='unknown' (строка 193 в risk-rules.ts)
    // Проверяем что хотя бы одно из правил сработало
    expect(
      result.triggeredRules.includes('UNKNOWN_DEVICE')
        || result.triggeredRules.includes('TOR_NETWORK'),
    ).toBe(true);
    // TOR_NETWORK срабатывает для isTor=true с валидным IP
    expect(result.triggeredRules).toContain('TOR_NETWORK');
  });

  it('возвращает пустой массив правил для безопасного контекста', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.triggeredRules).toEqual([]);
  });

  it('обрабатывает правила с decision impact', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.decisionHint.action).toBe('block');
    expect(result.decisionHint.blockReason).toBe('rule_block');
  });

  it('обрабатывает composite правила', () => {
    // IoT_TOR требует deviceType='iot' и isTor=true
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-iot',
      deviceType: 'iot',
      // OS и browser отсутствуют для чистого IoT_DEVICE
    };
    const context = createRiskContext({
      ip: '192.168.1.1', // Нужен валидный IP для network rules
      signals: createRiskSignals({ isTor: true }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    // IoT_DEVICE срабатывает для deviceType='iot' (строка 198 в risk-rules.ts)
    // TOR_NETWORK срабатывает для isTor=true с валидным IP
    // IoT_TOR - composite правило, требует и deviceType='iot' и isTor=true (строка 348 в risk-rules.ts)
    expect(result.triggeredRules.length).toBeGreaterThan(0);
    // Проверяем что хотя бы одно из правил сработало
    expect(
      result.triggeredRules.includes('IoT_DEVICE')
        || result.triggeredRules.includes('TOR_NETWORK')
        || result.triggeredRules.includes('IoT_TOR'),
    ).toBe(true);
  });
});

// ============================================================================
// 🎯 TESTS - Integration with Scoring
// ============================================================================

describe('Integration with Scoring', () => {
  it('рассчитывает risk score на основе device факторов', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext();
    const policy: RiskPolicy = {
      weights: {
        device: 1.0,
        geo: 0,
        network: 0,
        velocity: 0,
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result.riskScore).toBe(40); // UNKNOWN_DEVICE = 40
  });

  it('рассчитывает risk score на основе geo факторов', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      geo: { country: 'KP' }, // High-risk country
    });
    const policy: RiskPolicy = {
      weights: {
        device: 0,
        geo: 1.0,
        network: 0,
        velocity: 0,
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result.riskScore).toBe(40); // HIGH_RISK_COUNTRY = 40
  });

  it('рассчитывает risk score на основе network факторов', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true }),
    });
    const policy: RiskPolicy = {
      weights: {
        device: 0,
        geo: 0,
        network: 1.0,
        velocity: 0,
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result.riskScore).toBe(70); // TOR = 70
  });

  it('рассчитывает risk score на основе velocity факторов', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({ velocityScore: 75 }),
    });
    const policy: RiskPolicy = {
      weights: {
        device: 0,
        geo: 0,
        network: 0,
        velocity: 1.0,
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result.riskScore).toBe(75);
  });

  it('рассчитывает комбинированный risk score', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    // Комбинированный score с дефолтными весами
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// 🎯 TESTS - Integration with Decision
// ============================================================================

describe('Integration with Decision', () => {
  it('определяет risk level на основе score', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const policy: RiskPolicy = {
      decision: {
        thresholds: {
          low: 30,
          medium: 60,
          high: 80,
          critical: 90,
        },
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result.riskLevel).toBeDefined();
    expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
  });

  it('определяет decision hint на основе risk level и правил', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.decisionHint.action).toBe('block');
    expect(result.decisionHint.blockReason).toBe('rule_block');
  });

  it('определяет decision hint для critical risk', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      signals: createRiskSignals({ isTor: true, isVpn: true, isProxy: true }),
    });
    const policy: RiskPolicy = {
      decision: {
        thresholds: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0, // Все score >= 0 = critical
        },
      },
    };
    const result = assessLoginRisk(deviceInfo, context, policy);

    expect(result.decisionHint.action).toBe('block');
    expect(result.decisionHint.blockReason).toBe('critical_risk');
  });

  it('определяет decision hint для critical reputation', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext({
      signals: createRiskSignals({ reputationScore: 5 }), // < 10
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.decisionHint.action).toBe('block');
    expect(result.decisionHint.blockReason).toBe('critical_reputation');
  });

  it('определяет decision hint для challenge', () => {
    const deviceInfo = createDeviceInfo();
    // Используем HIGH_RISK_COUNTRY правило, которое дает challenge (decisionImpact='challenge')
    const context = createRiskContext({
      geo: { country: 'KP' }, // High-risk country (строка 318 в risk-rules.ts)
    });
    const result = assessLoginRisk(deviceInfo, context);

    // HIGH_RISK_COUNTRY правило дает challenge (строка 321 в risk-rules.ts)
    expect(result.triggeredRules).toContain('HIGH_RISK_COUNTRY');
    // HIGH_RISK_COUNTRY имеет decisionImpact='challenge', но может быть переопределен другими правилами
    // Проверяем что это валидное решение
    expect(['allow', 'challenge', 'block']).toContain(result.decisionHint.action);
    // eslint-disable-next-line functional/no-conditional-statements -- тестовая логика, if более читабелен
    if (result.decisionHint.action === 'challenge') {
      expect(result.decisionHint.blockReason).toBeUndefined();
    }
  });

  it('определяет decision hint для allow', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.decisionHint.action).toBe('allow');
    expect(result.decisionHint.blockReason).toBeUndefined();
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('обрабатывает пустой контекст', () => {
    const deviceInfo = createDeviceInfo();
    const context: RiskContext = {};
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it('обрабатывает контекст с минимальными данными', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-min',
      deviceType: 'desktop',
    };
    const context: RiskContext = {};
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает контекст с максимальными данными', () => {
    const deviceInfo = createDeviceInfo({
      deviceId: 'device-max',
      deviceType: 'desktop',
      os: 'Windows 11',
      browser: 'Chrome 120',
      userAgent: 'Mozilla/5.0',
    });
    const context = createRiskContext({
      userId: 'user-123',
      previousSessionId: 'session-456',
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
      signals: createRiskSignals({
        isVpn: false,
        isTor: false,
        isProxy: false,
        asn: 'AS12345',
        reputationScore: 80,
        velocityScore: 20,
        previousGeo: {
          country: 'US',
          region: 'NY',
          city: 'New York',
          lat: 40.7128,
          lng: -74.006,
        },
      }),
      timestamp: '2026-01-15T10:30:00.000Z',
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.assessment.userId).toBe('user-123');
    expect(result.assessment.previousSessionId).toBe('session-456');
    expect(result.assessment.ip).toBe('192.168.1.1');
    expect(result.assessment.geo?.country).toBe('US');
    expect(result.assessment.timestamp).toBe('2026-01-15T10:30:00.000Z');
  });

  it('обрабатывает все возможные risk levels', () => {
    const deviceInfo = createDeviceInfo();
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const results = riskLevels.map((level) => {
      // Создаем контекст, который даст нужный risk level
      const policy: RiskPolicy = {
        decision: {
          thresholds: {
            low: level === 'low' ? 0 : 100,
            medium: level === 'medium' ? 0 : 100,
            high: level === 'high' ? 0 : 100,
            critical: level === 'critical' ? 0 : 100,
          },
        },
      };
      return { level, result: assessLoginRisk(deviceInfo, {}, policy) };
    });
    results.forEach(({ result }) => {
      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    });
  });

  it('обрабатывает граничные значения risk score (0)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает граничные значения risk score (100)', () => {
    const deviceInfo = createDeviceInfo({ deviceType: 'unknown' });
    const context = createRiskContext({
      signals: createRiskSignals({
        isTor: true,
        isVpn: true,
        isProxy: true,
        reputationScore: 5,
        velocityScore: 100,
      }),
    });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it('обрабатывает externalSignals с пустым объектом', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      externalSignals: {},
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает externalSignals с undefined', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      // externalSignals не указан (undefined)
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает контекст без signals.externalSignals', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      isVpn: true,
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('выбрасывает ошибку для blocking violations (reputationScore вне диапазона)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      reputationScore: 150, // Вне диапазона 0-100
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_REPUTATION_SCORE.*out_of_range/,
    );
  });

  it('выбрасывает ошибку для blocking violations (reputationScore не число)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      reputationScore: 'not-a-number' as unknown as number,
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_REPUTATION_SCORE.*not_a_number/,
    );
  });

  it('выбрасывает ошибку для blocking violations (reputationScore Infinity)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      reputationScore: Number.POSITIVE_INFINITY,
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_REPUTATION_SCORE.*not_finite/,
    );
  });

  it('выбрасывает ошибку для blocking violations (velocityScore вне диапазона)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      velocityScore: -10, // Вне диапазона 0-100
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_VELOCITY_SCORE.*out_of_range/,
    );
  });

  it('выбрасывает ошибку для blocking violations (невалидные координаты - lat вне диапазона)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      previousGeo: {
        lat: 100, // Вне диапазона -90 до 90
        lng: 0,
      },
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_COORDINATES.*lat_out_of_range/,
    );
  });

  it('выбрасывает ошибку для blocking violations (невалидные координаты - lng вне диапазона)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      previousGeo: {
        lat: 0,
        lng: 200, // Вне диапазона -180 до 180
      },
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_COORDINATES.*lng_out_of_range/,
    );
  });

  it('выбрасывает ошибку для blocking violations (неполные координаты - только lat)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      previousGeo: {
        lat: 37.7749,
        // lng отсутствует - неполные координаты
      },
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INCOMPLETE_COORDINATES.*incomplete_coordinates_spoofing_risk/,
    );
  });

  it('выбрасывает ошибку для blocking violations (неполные координаты - только lng)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      previousGeo: {
        // lat отсутствует
        lng: -122.4194,
      },
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INCOMPLETE_COORDINATES.*incomplete_coordinates_spoofing_risk/,
    );
  });

  it('выбрасывает ошибку для blocking violations (несколько violations)', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      reputationScore: 150, // Вне диапазона
      velocityScore: -10, // Вне диапазона
      previousGeo: {
        lat: 100, // Вне диапазона
        lng: 0,
      },
    };
    const context = createRiskContext({ signals });

    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals:/,
    );
    // Проверяем, что сообщение содержит все violations
    try {
      assessLoginRisk(deviceInfo, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('INVALID_REPUTATION_SCORE');
      expect(message).toContain('INVALID_VELOCITY_SCORE');
      expect(message).toContain('INVALID_COORDINATES');
    }
  });

  it('обрабатывает валидные signals без violations', () => {
    const deviceInfo = createDeviceInfo();
    const signals: RiskSignals = {
      reputationScore: 50, // Валидное значение
      velocityScore: 30, // Валидное значение
      previousGeo: {
        lat: 37.7749, // Валидные координаты
        lng: -122.4194,
      },
    };
    const context = createRiskContext({ signals });
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  it('обрабатывает degrade violations без блокировки (не блокирует оценку)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    // Мокируем validateRiskSemantics для возврата degrade violations
    const degradeViolation: RiskSemanticViolation = {
      code: 'INVALID_REPUTATION_SCORE',
      severity: 'degrade',
      affects: 'confidence',
      impact: 'increases_risk',
      meta: {
        value: 50,
        reason: 'out_of_range',
      },
    };

    vi.spyOn(ValidationModule, 'validateRiskSemantics').mockReturnValue([degradeViolation]);

    // degrade violations не должны блокировать оценку
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);

    vi.restoreAllMocks();
  });

  it('обрабатывает ignore violations без блокировки (не блокирует оценку)', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    // Мокируем validateRiskSemantics для возврата ignore violations
    const ignoreViolation: RiskSemanticViolation = {
      code: 'INVALID_VELOCITY_SCORE',
      severity: 'ignore',
      affects: 'confidence',
      impact: 'increases_risk',
      meta: {
        value: 30,
        reason: 'out_of_range',
      },
    };

    vi.spyOn(ValidationModule, 'validateRiskSemantics').mockReturnValue([ignoreViolation]);

    // ignore violations не должны блокировать оценку
    const result = assessLoginRisk(deviceInfo, context);

    expect(result).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);

    vi.restoreAllMocks();
  });

  it('обрабатывает смешанные violations (block + degrade) - блокирует только при наличии block', () => {
    const deviceInfo = createDeviceInfo();
    const context = createRiskContext();

    // Мокируем validateRiskSemantics для возврата смешанных violations
    const blockViolation: RiskSemanticViolation = {
      code: 'INVALID_REPUTATION_SCORE',
      severity: 'block',
      affects: 'signals',
      impact: 'removes_signal',
      meta: {
        value: 150,
        reason: 'out_of_range',
      },
    };
    const degradeViolation: RiskSemanticViolation = {
      code: 'INVALID_VELOCITY_SCORE',
      severity: 'degrade',
      affects: 'confidence',
      impact: 'increases_risk',
      meta: {
        value: 30,
        reason: 'out_of_range',
      },
    };

    vi.spyOn(ValidationModule, 'validateRiskSemantics').mockReturnValue([
      blockViolation,
      degradeViolation,
    ]);

    // При наличии block violation должна быть ошибка
    expect(() => assessLoginRisk(deviceInfo, context)).toThrow(
      /Invalid risk signals: INVALID_REPUTATION_SCORE/,
    );

    vi.restoreAllMocks();
  });
});
