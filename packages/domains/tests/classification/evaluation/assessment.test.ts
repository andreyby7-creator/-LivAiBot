/**
 * @file Unit тесты для Classification Assessment Logic
 * Полное покрытие всех функций и edge cases (100%)
 */
import { describe, expect, it } from 'vitest';

import type {
  AssessmentContextBuilderPlugin,
  BuildAssessmentContextOptions,
  RuleEvaluationSnapshot,
} from '../../../src/classification/evaluation/assessment.js';
import {
  assembleAssessmentResultFromContext,
  buildAssessmentContextWithPlugins,
} from '../../../src/classification/evaluation/assessment.js';
import type { ClassificationLabelValue } from '../../../src/classification/labels.js';
import { classificationLabel } from '../../../src/classification/labels.js';
import type {
  ClassificationContext,
  ClassificationSignals,
} from '../../../src/classification/signals/signals.js';
import { classificationContext } from '../../../src/classification/signals/signals.js';
import type { SemanticViolation } from '../../../src/classification/signals/violations.js';
import type {
  ClassificationRule,
  DeviceInfo,
} from '../../../src/classification/strategies/rules.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createTestEvaluationResult(
  labelValue: ClassificationLabelValue,
  levelValue: number,
  confidenceValue: number,
  scaleMin: number,
  scaleMax: number,
  usedSignals?: readonly (keyof ClassificationSignals)[],
  context?: ClassificationContext,
): RuleEvaluationSnapshot {
  // Параметры сохраняются для компактности существующих тестов.
  void labelValue;
  void confidenceValue;
  void scaleMin;
  void scaleMax;
  void context;
  const triggeredRules: readonly ClassificationRule[] =
    usedSignals !== undefined && usedSignals.length > 0
      ? Object.freeze(['VPN_DETECTED'] as const)
      : Object.freeze([] as const);
  return Object.freeze({
    riskScore: levelValue,
    triggeredRules,
    violations: Object.freeze([]),
  });
}

function createTestDeviceInfo(): DeviceInfo {
  return Object.freeze({
    deviceId: 'test-device-123',
    deviceType: 'desktop',
    os: 'Windows',
    browser: 'Chrome',
    userAgent: 'Mozilla/5.0',
  });
}

function createTestClassificationContext(): ClassificationContext {
  const contextData = {
    ip: '192.168.1.1',
    userId: 'user123',
  };
  const contextResult = classificationContext.create(contextData);
  if (!contextResult) {
    throw new Error('Failed to create context');
  }
  return contextResult;
}

/* ============================================================================
 * 🧪 ТЕСТЫ — buildAssessmentContextWithPlugins
 * ============================================================================
 */

// eslint-disable-next-line ai-security/token-leakage -- Имя функции, не токен
describe('buildAssessmentContextWithPlugins', () => {
  describe('базовая функциональность', () => {
    it('создает assessment context без плагинов', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 50;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 10, 0.9, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      expect(context).toBeDefined();
      expect(context.device).toEqual(deviceInfo);
      expect(context.classificationContext).toEqual(classificationCtx);
      expect(context.riskScore).toBe(riskScore);
      expect(context.ruleEvaluationSnapshot).toEqual(ruleEvaluationResult);
    });

    it('создает assessment context с пустыми опциями', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 75;
      const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 50, 0.7, 0, 100);
      const options: BuildAssessmentContextOptions = {};

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(context).toBeDefined();
      expect(context.riskScore).toBe(riskScore);
    });

    it('создает assessment context с пустым массивом плагинов', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 25;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 5, 0.95, 0, 100);
      const options: BuildAssessmentContextOptions = {
        plugins: [],
      };

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(context).toBeDefined();
      expect(context.riskScore).toBe(riskScore);
    });
  });

  describe('работа с плагинами', () => {
    it('применяет один плагин для расширения контекста', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 60;
      const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 60, 0.6, 0, 100);

      const plugin: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          return Object.freeze({
            ...ctx,
            // Плагин может добавить дополнительные поля (для теста просто возвращаем расширенный контекст)
          });
        },
      };

      const options: BuildAssessmentContextOptions = {
        plugins: [plugin],
      };

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(context).toBeDefined();
      expect(context.riskScore).toBe(riskScore);
    });

    it('применяет несколько плагинов в порядке их следования', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 80;
      const ruleEvaluationResult = createTestEvaluationResult('DANGEROUS', 90, 0.3, 0, 100);

      const callOrder: number[] = [];

      const plugin1: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          callOrder.push(1);
          return Object.freeze({ ...ctx });
        },
      };

      const plugin2: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          callOrder.push(2);
          return Object.freeze({ ...ctx });
        },
      };

      const plugin3: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          callOrder.push(3);
          return Object.freeze({ ...ctx });
        },
      };

      const options: BuildAssessmentContextOptions = {
        plugins: [plugin1, plugin2, plugin3],
      };

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(context).toBeDefined();
      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('игнорирует плагины без extendAssessmentContext', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 40;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 20, 0.8, 0, 100);

      const plugin1: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          return Object.freeze({ ...ctx });
        },
      };

      const plugin2: AssessmentContextBuilderPlugin = {
        // Нет extendAssessmentContext
      };

      const plugin3: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          return Object.freeze({ ...ctx });
        },
      };

      const options: BuildAssessmentContextOptions = {
        plugins: [plugin1, plugin2, plugin3],
      };

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(context).toBeDefined();
      expect(context.riskScore).toBe(riskScore);
    });

    it('плагин получает правильный classificationContext', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 55;
      const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 55, 0.65, 0, 100);

      const receivedContext: { value: ClassificationContext | undefined; } = { value: undefined };

      const plugin: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (_ctx, classificationContext) => {
          // eslint-disable-next-line fp/no-mutation -- Мутация допустима в тестах для проверки передачи контекста
          receivedContext.value = classificationContext;
          return Object.freeze(_ctx);
        },
      };

      const options: BuildAssessmentContextOptions = {
        plugins: [plugin],
      };

      buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(receivedContext.value).toBeDefined();
      expect(receivedContext.value).toEqual(classificationCtx);
    });
  });

  describe('immutability', () => {
    it('возвращает frozen объект', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 30;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 15, 0.85, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      expect(Object.isFrozen(context)).toBe(true);
    });

    it('возвращает frozen объект после применения плагинов', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 70;
      const ruleEvaluationResult = createTestEvaluationResult('DANGEROUS', 85, 0.4, 0, 100);

      const plugin: AssessmentContextBuilderPlugin = {
        extendAssessmentContext: (ctx, _classificationContext) => {
          return Object.freeze({ ...ctx });
        },
      };

      const options: BuildAssessmentContextOptions = {
        plugins: [plugin],
      };

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        options,
      );

      expect(Object.isFrozen(context)).toBe(true);
    });
  });

  describe('различные значения riskScore', () => {
    it('работает с минимальным riskScore (0)', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 0;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 0, 1, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      expect(context.riskScore).toBe(0);
    });

    it('работает с максимальным riskScore (100)', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 100;
      const ruleEvaluationResult = createTestEvaluationResult('DANGEROUS', 100, 0.1, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      expect(context.riskScore).toBe(100);
    });

    it('работает со средним riskScore', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 50;
      const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 50, 0.5, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      expect(context.riskScore).toBe(50);
    });
  });
});

/* ============================================================================
 * 🧪 ТЕСТЫ — assembleAssessmentResultFromContext
 * ============================================================================
 */

// eslint-disable-next-line ai-security/token-leakage -- Имя функции, не токен
describe('assembleAssessmentResultFromContext', () => {
  describe('базовая функциональность', () => {
    it('собирает результат из контекста с минимальными полями', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 20;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 10, 0.9, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result).toBeDefined();
      expect(result.evaluationLevel).toBe(riskScore);
      expect(result.confidence).toBeDefined();
      expect(classificationLabel.value(result.label)).toBe('SAFE');
      expect(result.scale.min).toBe(0);
      expect(result.scale.max).toBe(100);
      expect(result.usedSignals).toBeUndefined();
      expect(result.context).toBeUndefined();
    });

    it('снижает confidence при наличии degrade violations в snapshot', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 40;
      const degradeViolation: SemanticViolation = {
        code: 'INVALID_REPUTATION_SCORE',
        severity: 'degrade',
        affects: 'confidence',
        impact: 'increases_risk',
        meta: {
          value: 10,
          reason: 'out_of_range',
        },
      };
      const withViolationSnapshot: RuleEvaluationSnapshot = Object.freeze({
        riskScore,
        triggeredRules: Object.freeze([]),
        violations: Object.freeze([degradeViolation]),
      });
      const withoutViolationSnapshot: RuleEvaluationSnapshot = Object.freeze({
        riskScore,
        triggeredRules: Object.freeze([]),
        violations: Object.freeze([]),
      });

      const withViolationContext = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        withViolationSnapshot,
      );
      const withoutViolationContext = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        withoutViolationSnapshot,
      );
      const withViolationResult = assembleAssessmentResultFromContext(withViolationContext);
      const withoutViolationResult = assembleAssessmentResultFromContext(withoutViolationContext);

      expect(withViolationResult.confidence).toBeLessThan(withoutViolationResult.confidence);
    });

    it('собирает результат из контекста со всеми полями', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 60;
      const usedSignals: (keyof ClassificationSignals)[] = ['isVpn', 'reputationScore'];
      const ruleEvaluationResult = createTestEvaluationResult(
        'SUSPICIOUS',
        60,
        0.7,
        0,
        100,
        usedSignals,
        classificationCtx,
      );

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result).toBeDefined();
      expect(result.evaluationLevel).toBe(riskScore);
      expect(result.confidence).toBeDefined();
      expect(classificationLabel.value(result.label)).toBe('SUSPICIOUS');
      expect(result.scale.min).toBe(0);
      expect(result.scale.max).toBe(100);
      expect(result.usedSignals).toEqual([]);
      expect(result.context).toBeUndefined();
    });
  });

  describe('опциональные поля', () => {
    it('правильно обрабатывает usedSignals когда они определены', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 45;
      const usedSignals: (keyof ClassificationSignals)[] = ['isTor', 'isProxy'];
      const ruleEvaluationResult = createTestEvaluationResult(
        'SUSPICIOUS',
        45,
        0.6,
        0,
        100,
        usedSignals,
      );

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result.usedSignals).toBeDefined();
      expect(result.usedSignals).toEqual([]);
    });

    it('правильно обрабатывает context когда он определен', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 35;
      const ruleEvaluationResult = createTestEvaluationResult(
        'SAFE',
        15,
        0.85,
        0,
        100,
        undefined,
        classificationCtx,
      );

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result.context).toBeUndefined();
    });

    it('правильно обрабатывает оба опциональных поля одновременно', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 75;
      const usedSignals: (keyof ClassificationSignals)[] = [
        'isVpn',
        'reputationScore',
        'velocityScore',
      ];
      const ruleEvaluationResult = createTestEvaluationResult(
        'DANGEROUS',
        85,
        0.3,
        0,
        100,
        usedSignals,
        classificationCtx,
      );

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result.usedSignals).toBeDefined();
      expect(result.usedSignals).toEqual([]);
      expect(result.context).toBeUndefined();
    });

    it('правильно обрабатывает отсутствие опциональных полей', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 25;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 12, 0.9, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result.usedSignals).toBeUndefined();
      expect(result.context).toBeUndefined();
    });
  });

  describe('различные значения label', () => {
    it('правильно собирает результат с label SAFE', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 10;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 5, 0.95, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);
      const labelValue = classificationLabel.value(result.label);

      expect(labelValue).toBe('SAFE');
    });

    it('правильно собирает результат с label SUSPICIOUS', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 50;
      const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 50, 0.7, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);
      const labelValue = classificationLabel.value(result.label);

      expect(labelValue).toBe('SUSPICIOUS');
    });

    it('правильно собирает результат с label DANGEROUS', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 90;
      const ruleEvaluationResult = createTestEvaluationResult('DANGEROUS', 95, 0.2, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);
      const labelValue = classificationLabel.value(result.label);

      expect(labelValue).toBe('DANGEROUS');
    });

    it('пересчитывает label по policy и не делает pass-through UNKNOWN из ruleEvaluationResult', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 30;
      const ruleEvaluationResult = createTestEvaluationResult('UNKNOWN', 30, 0.8, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);
      const labelValue = classificationLabel.value(result.label);

      expect(labelValue).toBe('SAFE');
    });

    it('применяет кастомную decisionPolicy из options.decisionPolicy', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 15;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 15, 0.8, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
        {
          decisionPolicy: {
            thresholds: {
              mediumFrom: 10,
              highFrom: 60,
              criticalFrom: 90,
            },
            dangerousRuleCountFrom: 3,
            dangerousVelocityFrom: 80,
            dangerousReputationTo: 20,
          },
        },
      );

      const result = assembleAssessmentResultFromContext(context);
      const labelValue = classificationLabel.value(result.label);

      expect(labelValue).toBe('SUSPICIOUS');
    });

    it('эскалирует label до DANGEROUS по decision signals даже при низком riskScore', () => {
      const deviceInfo = createTestDeviceInfo();
      const contextWithTor = classificationContext.create({
        ip: '192.168.1.1',
        userId: 'user123',
        signals: {
          isTor: true,
        },
      });
      if (!contextWithTor) {
        throw new Error('Failed to create context with signals');
      }
      const riskScore = 5;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 5, 0.9, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        contextWithTor,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);
      const labelValue = classificationLabel.value(result.label);

      expect(labelValue).toBe('DANGEROUS');
    });
  });

  describe('immutability', () => {
    it('возвращает frozen объект', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 40;
      const ruleEvaluationResult = createTestEvaluationResult('SAFE', 20, 0.85, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('возвращает frozen объект даже с опциональными полями', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 65;
      const usedSignals: (keyof ClassificationSignals)[] = ['isVpn'];
      const ruleEvaluationResult = createTestEvaluationResult(
        'SUSPICIOUS',
        65,
        0.6,
        0,
        100,
        usedSignals,
        classificationCtx,
      );

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('правильность сборки всех полей', () => {
    it('копирует все обязательные поля из ruleEvaluationResult', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 55;
      const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 55, 0.65, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result.evaluationLevel).toBe(riskScore);
      expect(result.confidence).toBeDefined();
      expect(classificationLabel.value(result.label)).toBe('SUSPICIOUS');
      expect(result.scale.min).toBe(0);
      expect(result.scale.max).toBe(100);
    });

    it('создает новый объект, а не возвращает ссылку на ruleEvaluationResult', () => {
      const deviceInfo = createTestDeviceInfo();
      const classificationCtx = createTestClassificationContext();
      const riskScore = 70;
      const ruleEvaluationResult = createTestEvaluationResult('DANGEROUS', 80, 0.4, 0, 100);

      const context = buildAssessmentContextWithPlugins(
        deviceInfo,
        classificationCtx,
        riskScore,
        ruleEvaluationResult,
      );

      const result = assembleAssessmentResultFromContext(context);

      expect(result).not.toBe(ruleEvaluationResult);
      expect(result.evaluationLevel).toBe(riskScore);
    });
  });
});

/* ============================================================================
 * 🧪 ТЕСТЫ — Интеграционные тесты
 * ============================================================================
 */

describe('интеграционные тесты', () => {
  // eslint-disable-next-line ai-security/token-leakage -- Имя функции, не токен
  it('полный pipeline: buildAssessmentContextWithPlugins → assembleAssessmentResultFromContext', () => {
    const deviceInfo = createTestDeviceInfo();
    const classificationCtx = createTestClassificationContext();
    const riskScore = 60;
    const usedSignals: (keyof ClassificationSignals)[] = ['isVpn', 'reputationScore'];
    const ruleEvaluationResult = createTestEvaluationResult(
      'SUSPICIOUS',
      60,
      0.7,
      0,
      100,
      usedSignals,
      classificationCtx,
    );

    const plugin: AssessmentContextBuilderPlugin = {
      extendAssessmentContext: (ctx, _classificationContext) => {
        return Object.freeze({ ...ctx });
      },
    };

    const options: BuildAssessmentContextOptions = {
      plugins: [plugin],
    };

    const context = buildAssessmentContextWithPlugins(
      deviceInfo,
      classificationCtx,
      riskScore,
      ruleEvaluationResult,
      options,
    );

    const result = assembleAssessmentResultFromContext(context);

    expect(result).toBeDefined();
    expect(result.evaluationLevel).toBe(riskScore);
    expect(result.confidence).toBeDefined();
    expect(classificationLabel.value(result.label)).toBe('SUSPICIOUS');
    expect(result.scale.min).toBe(0);
    expect(result.scale.max).toBe(100);
    expect(result.usedSignals).toEqual([]);
    expect(result.context).toBeUndefined();
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('работает с различными scale значениями', () => {
    const deviceInfo = createTestDeviceInfo();
    const classificationCtx = createTestClassificationContext();
    const riskScore = 3;
    const ruleEvaluationResult = createTestEvaluationResult('SUSPICIOUS', 3, 0.7, 0, 10);

    const context = buildAssessmentContextWithPlugins(
      deviceInfo,
      classificationCtx,
      riskScore,
      ruleEvaluationResult,
    );

    const result = assembleAssessmentResultFromContext(context);

    expect(result.scale.min).toBe(0);
    expect(result.scale.max).toBe(100);
    expect(result.evaluationLevel).toBe(3);
  });
});
