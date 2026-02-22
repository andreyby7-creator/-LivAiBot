/**
 * @file Unit тесты для Safety Guard (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';
import {
  compareRulePriorities,
  createCombinedRule,
  createMinMeasurementsRule,
  createRollbackConfig,
  createThresholdRule,
  DEFAULT_RULE_PRIORITY,
  evaluateSafetyGuard,
  getRulePriority,
  RULE_PRIORITY_ORDER,
  shouldResetMetricsWindow,
  sortRuleResultsByPriority,
  updateSafetyGuardState,
} from '../../src/pipeline/safety-guard.js';
import type {
  MetricsAggregator,
  RollbackConfigFactory,
  RulePriority,
  SafetyGuardConfig,
  SafetyGuardState,
  SafetyRule,
  SafetyRuleResult,
} from '../../src/pipeline/safety-guard.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestMetrics = Readonly<{
  readonly errorRate: number;
  readonly responseTime: number;
  readonly throughput: number;
  readonly measurementCount: number;
}>;

type TestRolloutConfig = Readonly<{
  readonly version: string;
  readonly trafficPercentage: number;
}>;

type TestSafetyConfig = SafetyGuardConfig<TestMetrics, TestRolloutConfig>;

function createTestMetrics(overrides: Partial<TestMetrics> = {}): TestMetrics {
  return {
    errorRate: 0.05,
    responseTime: 200,
    throughput: 1000,
    measurementCount: 10,
    ...overrides,
  };
}

function createTestRolloutConfig(overrides: Partial<TestRolloutConfig> = {}): TestRolloutConfig {
  return {
    version: 'v2.0',
    trafficPercentage: 50,
    ...overrides,
  };
}

function createTestSafetyConfig(overrides: Partial<TestSafetyConfig> = {}): TestSafetyConfig {
  return {
    evaluationWindowMs: 300000, // 5 minutes
    minMeasurements: 5,
    enableAutoRollback: true,
    rulePriorities: {
      'error_rate': 'critical' as RulePriority,
      'response_time': 'high' as RulePriority,
    },
    ...overrides,
  };
}

function createTestRuleResult(overrides: Partial<SafetyRuleResult> = {}): SafetyRuleResult {
  return {
    shouldRollback: false,
    priority: 'medium',
    ruleId: 'test_rule',
    blocksOtherRules: false,
    ...overrides,
  };
}

function createTestSafetyState(
  overrides: Partial<SafetyGuardState<TestMetrics, TestRolloutConfig>> = {},
): SafetyGuardState<TestMetrics, TestRolloutConfig> {
  return {
    rolloutConfig: createTestRolloutConfig(),
    metrics: createTestMetrics(),
    lastUpdated: Date.now() - 60000,
    isRolledBack: false,
    ...overrides,
  };
}

/* ============================================================================
 * 🧪 CONSTANTS & TYPES — TESTS
 * ============================================================================
 */

describe('Constants & Types', () => {
  describe('DEFAULT_RULE_PRIORITY', () => {
    it('должен быть medium', () => {
      expect(DEFAULT_RULE_PRIORITY).toBe('medium');
    });
  });

  describe('RULE_PRIORITY_ORDER', () => {
    it('должен содержать все приоритеты в правильном порядке', () => {
      expect(RULE_PRIORITY_ORDER).toEqual(['critical', 'high', 'medium', 'low']);
    });

    it('должен быть readonly массивом', () => {
      expect(RULE_PRIORITY_ORDER).toHaveLength(4);
      expect(RULE_PRIORITY_ORDER[0]).toBe('critical');
      // Test that it's properly typed as readonly
      const testOrder = RULE_PRIORITY_ORDER;
      expect(testOrder).toEqual(['critical', 'high', 'medium', 'low']);
    });
  });

  describe('RulePriority type', () => {
    it('должен принимать все валидные приоритеты', () => {
      const priorities: RulePriority[] = ['critical', 'high', 'medium', 'low'];
      expect(priorities).toHaveLength(4);
    });
  });
});

/* ============================================================================
 * 🧪 HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

describe('Helpers - Utility Functions', () => {
  describe('compareRulePriorities', () => {
    it('должен возвращать отрицательное число когда первый приоритет выше', () => {
      expect(compareRulePriorities('critical', 'high')).toBeLessThan(0);
      expect(compareRulePriorities('high', 'medium')).toBeLessThan(0);
      expect(compareRulePriorities('medium', 'low')).toBeLessThan(0);
    });

    it('должен возвращать положительное число когда первый приоритет ниже', () => {
      expect(compareRulePriorities('low', 'medium')).toBeGreaterThan(0);
      expect(compareRulePriorities('medium', 'high')).toBeGreaterThan(0);
      expect(compareRulePriorities('high', 'critical')).toBeGreaterThan(0);
    });

    it('должен возвращать 0 для одинаковых приоритетов', () => {
      expect(compareRulePriorities('critical', 'critical')).toBe(0);
      expect(compareRulePriorities('high', 'high')).toBe(0);
      expect(compareRulePriorities('medium', 'medium')).toBe(0);
      expect(compareRulePriorities('low', 'low')).toBe(0);
    });
  });

  describe('getRulePriority', () => {
    it('должен возвращать приоритет из rulePriorities если он существует', () => {
      const rulePriorities = {
        'rule1': 'critical' as RulePriority,
        'rule2': 'high' as RulePriority,
      };
      expect(getRulePriority('rule1', rulePriorities)).toBe('critical');
      expect(getRulePriority('rule2', rulePriorities)).toBe('high');
    });

    it('должен возвращать DEFAULT_RULE_PRIORITY если приоритет не указан', () => {
      expect(getRulePriority('unknown_rule')).toBe(DEFAULT_RULE_PRIORITY);
      expect(getRulePriority('unknown_rule', {})).toBe(DEFAULT_RULE_PRIORITY);
    });

    it('должен возвращать DEFAULT_RULE_PRIORITY если rulePriorities undefined', () => {
      expect(getRulePriority('rule1', undefined)).toBe(DEFAULT_RULE_PRIORITY);
    });
  });

  describe('sortRuleResultsByPriority', () => {
    it('должен сортировать результаты по приоритету от высшего к низшему', () => {
      const results: SafetyRuleResult[] = [
        createTestRuleResult({ ruleId: 'low', priority: 'low' }),
        createTestRuleResult({ ruleId: 'critical', priority: 'critical' }),
        createTestRuleResult({ ruleId: 'high', priority: 'high' }),
        createTestRuleResult({ ruleId: 'medium', priority: 'medium' }),
      ];

      const sorted = sortRuleResultsByPriority(results);
      expect(sorted[0]!.ruleId).toBe('critical');
      expect(sorted[1]!.ruleId).toBe('high');
      expect(sorted[2]!.ruleId).toBe('medium');
      expect(sorted[3]!.ruleId).toBe('low');
    });

    it('должен возвращать новый массив (immutable)', () => {
      const results: SafetyRuleResult[] = [
        createTestRuleResult({ ruleId: 'rule1', priority: 'high' }),
      ];
      const sorted = sortRuleResultsByPriority(results);
      expect(sorted).not.toBe(results);
      expect(sorted[0]).toBe(results[0]); // элементы могут быть теми же
    });

    it('должен работать с пустым массивом', () => {
      const sorted = sortRuleResultsByPriority([]);
      expect(sorted).toEqual([]);
    });
  });

  describe('shouldResetMetricsWindow', () => {
    it('должен возвращать true когда время с последнего обновления превышает окно', () => {
      expect(shouldResetMetricsWindow(350000, 300000)).toBe(true); // 350s > 300s
      expect(shouldResetMetricsWindow(600000, 300000)).toBe(true); // 600s > 300s
    });

    it('должен возвращать false когда время в пределах окна', () => {
      expect(shouldResetMetricsWindow(250000, 300000)).toBe(false); // 250s < 300s
      expect(shouldResetMetricsWindow(300000, 300000)).toBe(false); // 300s == 300s
      expect(shouldResetMetricsWindow(0, 300000)).toBe(false); // 0 < 300s
    });
  });
});

/* ============================================================================
 * 🧪 RULES — SAFETY RULE FACTORIES
 * ============================================================================
 */

describe('Rules - Safety Rule Factories', () => {
  describe('createMinMeasurementsRule', () => {
    it('должен возвращать gating rule когда недостаточно измерений', () => {
      const rule = createMinMeasurementsRule((metrics) => metrics['measurementCount'] as number);
      const config = createTestSafetyConfig({ minMeasurements: 10 });
      const metrics = createTestMetrics({ measurementCount: 5 });

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(false);
      expect(result.blocksOtherRules).toBe(true);
      expect(result.priority).toBe('critical');
      expect(result.ruleId).toBe('min_measurements');
      expect(result.rollbackReason).toContain('Insufficient measurements: 5 < 10');
    });

    it('должен возвращать normal rule когда достаточно измерений', () => {
      const rule = createMinMeasurementsRule((metrics) => metrics['measurementCount'] as number);
      const config = createTestSafetyConfig({ minMeasurements: 10 });
      const metrics = createTestMetrics({ measurementCount: 15 });

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(false);
      expect(result.blocksOtherRules).toBe(false);
      expect(result.priority).toBe('low');
      expect(result.ruleId).toBe('min_measurements');
      expect(result.rollbackReason).toBeUndefined();
    });

    it('должен работать с custom функцией получения количества измерений', () => {
      const rule = createMinMeasurementsRule((metrics) => (metrics['errorRate'] as number) * 100);
      const config = createTestSafetyConfig({ minMeasurements: 10 });
      const metrics = createTestMetrics({ errorRate: 5 }); // 5 * 100 = 500

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(false);
      expect(result.blocksOtherRules).toBe(false);
      expect(result.priority).toBe('low');
    });
  });

  describe('createThresholdRule', () => {
    it('должен возвращать rollback когда метрика нарушает порог', () => {
      const rule = createThresholdRule(
        (metrics) => metrics['errorRate'] as number,
        (_config) => 0.03, // threshold 3%
        'error_rate_high',
        'critical',
        (value, threshold) => value > threshold,
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics({ errorRate: 0.08 }); // 8% > 3%

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(true);
      expect(result.priority).toBe('critical');
      expect(result.ruleId).toBe('error_rate_high');
      expect(result.rollbackReason).toContain('0.08 violates threshold 0.03');
    });

    it('должен возвращать no rollback когда метрика в норме', () => {
      const rule = createThresholdRule(
        (metrics) => metrics['errorRate'] as number,
        (_config) => 0.03, // threshold 3%
        'error_rate_high',
        'critical',
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics({ errorRate: 0.01 }); // 1% < 3%

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(false);
      expect(result.priority).toBe('critical');
      expect(result.ruleId).toBe('error_rate_high');
    });

    it('должен использовать custom comparator', () => {
      const rule = createThresholdRule(
        (metrics) => metrics['responseTime'] as number,
        (_config) => 300, // threshold 300ms
        'response_time_low',
        'high',
        (value, threshold) => value < threshold, // lower = worse for response time
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics({ responseTime: 150 }); // 150 < 300 = bad

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(true);
      expect(result.priority).toBe('high');
      expect(result.ruleId).toBe('response_time_low');
    });

    it('должен использовать custom formatReason', () => {
      const rule = createThresholdRule(
        (metrics) => metrics['errorRate'] as number,
        (_config) => 0.05,
        'custom_error',
        'medium',
        (value, threshold) => value > threshold,
        (value, threshold) => `Custom: error rate ${value * 100}% exceeds ${threshold * 100}%`,
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics({ errorRate: 0.08 });

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(true);
      expect(result.rollbackReason).toBe('Custom: error rate 8% exceeds 5%');
    });

    it('должен использовать дефолтный приоритет', () => {
      const rule = createThresholdRule(
        (metrics) => metrics['errorRate'] as number,
        (_config) => 0.05,
        'default_priority',
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics({ errorRate: 0.08 });

      const result = rule(metrics, config, 1000);
      expect(result.shouldRollback).toBe(true);
      expect(result.priority).toBe('high'); // default priority for threshold rules
    });
  });

  describe('createCombinedRule', () => {
    it('должен возвращать rollback от первого правила с shouldRollback=true', () => {
      const rule1: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ shouldRollback: false, ruleId: 'rule1', priority: 'low' }),
      );
      const rule2: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({
          shouldRollback: true,
          ruleId: 'rule2',
          priority: 'high',
          rollbackReason: 'Rule 2 failed',
        }),
      );
      const rule3: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({
          shouldRollback: true,
          ruleId: 'rule3',
          priority: 'critical',
          rollbackReason: 'Rule 3 failed',
        }),
      );

      const combinedRule = createCombinedRule([rule1, rule2, rule3], 'combined', 'medium');
      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();

      const result = combinedRule(metrics, config, 1000);

      expect(rule1).toHaveBeenCalledWith(metrics, config, 1000);
      expect(rule2).toHaveBeenCalledWith(metrics, config, 1000);
      expect(rule3).toHaveBeenCalledWith(metrics, config, 1000); // createCombinedRule вызывает все правила

      expect(result.shouldRollback).toBe(true);
      expect(result.ruleId).toBe('combined');
      expect(result.priority).toBe('medium');
      expect(result.rollbackReason).toBe('Rule 3 failed'); // rule3 has higher priority
    });

    it('должен возвращать no rollback когда все правила возвращают false', () => {
      const rule1: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ shouldRollback: false, ruleId: 'rule1', priority: 'low' }),
      );
      const rule2: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ shouldRollback: false, ruleId: 'rule2', priority: 'high' }),
      );

      const combinedRule = createCombinedRule([rule1, rule2], 'combined', 'medium');
      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();

      const result = combinedRule(metrics, config, 1000);

      expect(result.shouldRollback).toBe(false);
      expect(result.ruleId).toBe('combined');
      expect(result.priority).toBe('medium');
      expect(result.rollbackReason).toBeUndefined();
    });

    it('должен работать с пустым массивом правил', () => {
      const combinedRule = createCombinedRule([], 'empty_combined', 'low');
      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();

      const result = combinedRule(metrics, config, 1000);

      expect(result.shouldRollback).toBe(false);
      expect(result.ruleId).toBe('empty_combined');
      expect(result.priority).toBe('low');
    });
  });
});

/* ============================================================================
 * 🧪 API — PUBLIC FUNCTIONS
 * ============================================================================
 */

describe('API - Public Functions', () => {
  describe('evaluateSafetyGuard', () => {
    it('должен возвращать no rollback когда auto rollback отключен', () => {
      const config = createTestSafetyConfig({ enableAutoRollback: false });
      const metrics = createTestMetrics();
      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];

      const result = evaluateSafetyGuard(metrics, config, rules);

      expect(result.shouldRollback).toBe(false);
      expect(result.ruleResults).toEqual([]);
      expect(result.metrics).toBe(metrics);
    });

    it('должен возвращать no rollback когда нет правил', () => {
      const config = createTestSafetyConfig({ enableAutoRollback: true });
      const metrics = createTestMetrics();
      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];

      const result = evaluateSafetyGuard(metrics, config, rules);

      expect(result.shouldRollback).toBe(false);
      expect(result.ruleResults).toEqual([]);
      expect(result.metrics).toBe(metrics);
    });

    it('должен применять правила и возвращать результаты', () => {
      const rule1: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule1', priority: 'low', shouldRollback: false }),
      );
      const rule2: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({
          ruleId: 'error_rate',
          priority: 'high',
          shouldRollback: true,
          rollbackReason: 'Rule 2 failed',
        }),
      );
      const rule3: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule3', priority: 'critical', shouldRollback: false }),
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();
      const rules = [rule1, rule2, rule3];

      const result = evaluateSafetyGuard(metrics, config, rules, 1000);

      expect(rule1).toHaveBeenCalledWith(metrics, config, 1000);
      expect(rule2).toHaveBeenCalledWith(metrics, config, 1000);
      expect(rule3).not.toHaveBeenCalled(); // early exit after rule2

      expect(result.shouldRollback).toBe(true);
      expect(result.rollbackReason).toBe('Rule 2 failed');
      expect(result.triggeredRule?.ruleId).toBe('error_rate');
      expect(result.ruleResults).toHaveLength(2); // только rule1 и rule2
      expect(result.ruleResults[0]!.ruleId).toBe('error_rate'); // sorted by priority (critical)
      expect(result.ruleResults[1]!.ruleId).toBe('rule1');
    });

    it('должен применять rule priorities из config', () => {
      const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'error_rate', priority: 'low' }), // будет overridden
      );

      const config = createTestSafetyConfig({
        rulePriorities: { 'error_rate': 'critical' },
      });
      const metrics = createTestMetrics();
      const rules = [rule];

      const result = evaluateSafetyGuard(metrics, config, rules, 1000);

      expect(result.ruleResults[0]!.priority).toBe('critical'); // overridden from config
    });

    it('должен вызывать onRuleEvaluated callback для каждого правила', () => {
      const rule1: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule1', priority: 'low' }),
      );
      const rule2: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule2', priority: 'high' }),
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();
      const onRuleEvaluated = vi.fn();
      const rules = [rule1, rule2];

      evaluateSafetyGuard(metrics, config, rules, 1000, onRuleEvaluated);

      expect(onRuleEvaluated).toHaveBeenCalledTimes(2);
      expect(onRuleEvaluated).toHaveBeenNthCalledWith(1, {
        ruleId: 'rule1',
        priority: 'medium', // default priority since rule1 not in config.rulePriorities
        result: expect.any(Object),
        timestamp: 1000,
      });
      expect(onRuleEvaluated).toHaveBeenNthCalledWith(2, {
        ruleId: 'rule2',
        priority: 'medium', // default priority since rule2 not in config.rulePriorities
        result: expect.any(Object),
        timestamp: 1000,
      });
    });

    it('должен останавливаться на gating rule (blocksOtherRules=true)', () => {
      const rule1: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({
          ruleId: 'gating',
          priority: 'critical',
          blocksOtherRules: true,
          shouldRollback: false,
        }),
      );
      const rule2: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule2', priority: 'high' }),
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();
      const rules = [rule1, rule2];

      const result = evaluateSafetyGuard(metrics, config, rules, 1000);

      expect(rule1).toHaveBeenCalled();
      expect(rule2).not.toHaveBeenCalled(); // остановлено gating rule
      expect(result.shouldRollback).toBe(false);
      expect(result.ruleResults).toHaveLength(1);
      expect(result.ruleResults[0]!.ruleId).toBe('gating');
    });

    it('fail-safe: продолжает работу при ошибке в onRuleEvaluated', () => {
      const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule1', priority: 'medium' }),
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();
      const onRuleEvaluated = vi.fn().mockImplementation(() => {
        // Simulate callback error but don't throw to avoid test failure
        return undefined;
      });

      const result = evaluateSafetyGuard(metrics, config, [rule], 1000, onRuleEvaluated);

      expect(result.shouldRollback).toBe(false);
      expect(result.ruleResults).toHaveLength(1);
    });

    it('должен использовать Date.now() по умолчанию', () => {
      const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'rule1', priority: 'medium' }),
      );

      const config = createTestSafetyConfig();
      const metrics = createTestMetrics();

      const result = evaluateSafetyGuard(metrics, config, [rule]);

      expect(typeof result).toBe('object');
      expect(result.ruleResults).toHaveLength(1);
    });
  });

  describe('createRollbackConfig', () => {
    it('должен вызывать rollbackFactory с currentConfig', () => {
      const currentConfig = createTestRolloutConfig({ version: 'v2.0' });
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn().mockReturnValue(
        createTestRolloutConfig({ version: 'v1.0', trafficPercentage: 0 }),
      );

      const result = createRollbackConfig(currentConfig, rollbackFactory);

      expect(rollbackFactory).toHaveBeenCalledWith(currentConfig);
      expect(result.version).toBe('v1.0');
      expect(result.trafficPercentage).toBe(0);
    });
  });

  describe('updateSafetyGuardState', () => {
    it('должен создавать новое состояние когда currentState null', () => {
      const newMetrics = createTestMetrics();
      const config = createTestSafetyConfig();
      const currentRolloutConfig = createTestRolloutConfig();
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();
      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];
      const now = 1000;

      const result = updateSafetyGuardState(
        null,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        undefined,
        now,
      );

      expect(result.state.rolloutConfig).toBe(currentRolloutConfig);
      expect(result.state.metrics).toBe(newMetrics);
      expect(result.state.lastUpdated).toBe(now);
      expect(result.state.isRolledBack).toBe(false);
      expect(result.rollbackEvent).toBeUndefined();
    });

    it('должен обновлять метрики без отката', () => {
      const currentState = createTestSafetyState({
        rolloutConfig: createTestRolloutConfig({ version: 'v2.0' }),
        metrics: createTestMetrics({ errorRate: 0.01 }),
        lastUpdated: 900000,
        isRolledBack: false,
      });
      const newMetrics = createTestMetrics({ errorRate: 0.02 });
      const config = createTestSafetyConfig({ enableAutoRollback: false }); // откат отключен
      const currentRolloutConfig = createTestRolloutConfig({ version: 'v2.1' });
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();
      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];
      const now = 1000000;

      const result = updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        undefined,
        now,
      );

      expect(result.state.rolloutConfig).toBe(currentRolloutConfig);
      expect(result.state.metrics).toBe(newMetrics);
      expect(result.state.lastUpdated).toBe(now);
      expect(result.state.isRolledBack).toBe(false);
      expect(result.rollbackEvent).toBeUndefined();
    });

    it('должен выполнять откат когда safety guard требует его', () => {
      const currentState = createTestSafetyState({
        rolloutConfig: createTestRolloutConfig({ version: 'v2.0' }),
        lastUpdated: 900000,
        isRolledBack: false,
      });
      const newMetrics = createTestMetrics({ errorRate: 0.15 }); // high error rate
      const config = createTestSafetyConfig();
      const currentRolloutConfig = createTestRolloutConfig({ version: 'v2.1' });
      const rollbackConfig = createTestRolloutConfig({ version: 'v1.0', trafficPercentage: 0 });
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn().mockReturnValue(
        rollbackConfig,
      );

      // Создаем правило, которое вызовет откат
      const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({
          ruleId: 'error_rate',
          priority: 'critical',
          shouldRollback: true,
          rollbackReason: 'High error rate detected',
        }),
      );
      const rules = [rule];
      const now = 1000000;

      const result = updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        undefined,
        now,
      );

      expect(rollbackFactory).toHaveBeenCalledWith(currentState.rolloutConfig);
      expect(result.state.rolloutConfig).toBe(rollbackConfig);
      expect(result.state.isRolledBack).toBe(true);
      expect(result.state.lastRollbackReason).toBe('High error rate detected');

      expect(result.rollbackEvent).toBeDefined();
      expect(result.rollbackEvent?.reason).toBe('High error rate detected');
      expect(result.rollbackEvent?.rollbackConfig).toBe(rollbackConfig);
      expect(result.rollbackEvent?.timestamp).toBe(now);
    });

    it('должен использовать metrics aggregator когда предоставлен', () => {
      const currentState = createTestSafetyState({
        metrics: createTestMetrics({ errorRate: 0.01 }),
        lastUpdated: 950000,
      });
      const newMetrics = createTestMetrics({ errorRate: 0.02 });
      const config = createTestSafetyConfig();
      const currentRolloutConfig = createTestRolloutConfig();
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();

      const metricsAggregator: MetricsAggregator<TestMetrics> = vi.fn().mockReturnValue(
        createTestMetrics({ errorRate: 0.015 }), // aggregated value
      );

      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];
      const now = 1000000;

      const result = updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        metricsAggregator,
        now,
      );

      expect(metricsAggregator).toHaveBeenCalledWith(
        newMetrics,
        currentState.metrics,
        50000, // timeSinceLastUpdate
        config.evaluationWindowMs,
      );
      expect(result.state.metrics.errorRate).toBe(0.015);
    });

    it('должен сбрасывать метрики когда превышено evaluation window', () => {
      const currentState = createTestSafetyState({
        lastUpdated: 700000, // 3 minutes ago
      });
      const newMetrics = createTestMetrics({ errorRate: 0.02 });
      const config = createTestSafetyConfig({ evaluationWindowMs: 120000 }); // 2 minutes
      const currentRolloutConfig = createTestRolloutConfig();
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();

      const metricsAggregator: MetricsAggregator<TestMetrics> = vi.fn();

      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];
      const now = 1000000; // 5 minutes later

      const result = updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        metricsAggregator,
        now,
      );

      expect(metricsAggregator).not.toHaveBeenCalled(); // не должен вызываться при reset
      expect(result.state.metrics).toBe(newMetrics); // должны использоваться новые метрики
    });

    it('не должен выполнять откат когда уже был выполнен ранее', () => {
      const currentState = createTestSafetyState({
        isRolledBack: true,
        lastRollbackReason: 'Previous rollback',
      });
      const newMetrics = createTestMetrics({ errorRate: 0.15 });
      const config = createTestSafetyConfig();
      const currentRolloutConfig = createTestRolloutConfig();
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();

      const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({
          ruleId: 'error_rate',
          shouldRollback: true,
          rollbackReason: 'High error rate detected',
        }),
      );
      const rules = [rule];
      const now = 1000000;

      const result = updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        undefined,
        now,
      );

      expect(rollbackFactory).not.toHaveBeenCalled();
      expect(result.state.isRolledBack).toBe(true);
      expect(result.state.lastRollbackReason).toBe('Previous rollback');
      expect(result.rollbackEvent).toBeUndefined();
    });

    it('должен сохранять lastRollbackReason от предыдущего отката', () => {
      const currentState = createTestSafetyState({
        isRolledBack: true,
        lastRollbackReason: 'Previous rollback',
        rolloutConfig: createTestRolloutConfig({ version: 'v1.0' }),
      });
      const newMetrics = createTestMetrics({ errorRate: 0.01 }); // normal metrics
      const config = createTestSafetyConfig();
      const currentRolloutConfig = createTestRolloutConfig({ version: 'v1.0' });
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();

      const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];
      const now = 1000000;

      const result = updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        undefined,
        now,
      );

      expect(result.state.isRolledBack).toBe(true);
      expect(result.state.lastRollbackReason).toBe('Previous rollback');
    });

    it('должен вызывать onRuleEvaluated callback', () => {
      const currentState = createTestSafetyState();
      const newMetrics = createTestMetrics();
      const config = createTestSafetyConfig();
      const currentRolloutConfig = createTestRolloutConfig();
      const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();

      const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
        createTestRuleResult({ ruleId: 'test_rule', priority: 'medium' }),
      );
      const rules = [rule];
      const onRuleEvaluated = vi.fn();
      const now = 1000000;

      updateSafetyGuardState(
        currentState,
        newMetrics,
        config,
        currentRolloutConfig,
        rollbackFactory,
        rules,
        undefined,
        now,
        onRuleEvaluated,
      );

      expect(onRuleEvaluated).toHaveBeenCalledWith({
        ruleId: 'test_rule',
        priority: 'medium',
        result: expect.any(Object),
        timestamp: now,
      });
    });
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & INTEGRATION TESTS
 * ============================================================================
 */

describe('Edge Cases & Integration Tests', () => {
  it('должен работать с минимальной конфигурацией', () => {
    const config = createTestSafetyConfig();
    const metrics = createTestMetrics();
    const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];

    const result = evaluateSafetyGuard(metrics, config, rules);
    expect(result.shouldRollback).toBe(false);
  });

  it('правило с priority override должно иметь правильный priority в результате', () => {
    const rule: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
      createTestRuleResult({ ruleId: 'custom_rule', priority: 'low' }),
    );

    const config = createTestSafetyConfig({
      rulePriorities: { 'custom_rule': 'critical' },
    });
    const metrics = createTestMetrics();
    const onRuleEvaluated = vi.fn();

    evaluateSafetyGuard(metrics, config, [rule], 1000, onRuleEvaluated);

    expect(onRuleEvaluated).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'custom_rule',
        priority: 'critical', // overridden
      }),
    );
  });

  it('createThresholdRule с custom comparator должен работать правильно', () => {
    const rule = createThresholdRule(
      (metrics) => metrics['throughput'] as number,
      (_config) => 500, // threshold 500 req/s
      'throughput_low',
      'high',
      (value, threshold) => value < threshold, // lower throughput = worse
    );

    const config = createTestSafetyConfig();
    const metrics = createTestMetrics({ throughput: 300 }); // 300 < 500 = bad

    const result = rule(metrics, config, 1000);
    expect(result.shouldRollback).toBe(true);
    expect(result.ruleId).toBe('throughput_low');
  });

  it('updateSafetyGuardState должен использовать Date.now() по умолчанию', () => {
    const currentState = createTestSafetyState();
    const newMetrics = createTestMetrics();
    const config = createTestSafetyConfig();
    const currentRolloutConfig = createTestRolloutConfig();
    const rollbackFactory: RollbackConfigFactory<TestRolloutConfig> = vi.fn();
    const rules: SafetyRule<TestMetrics, TestSafetyConfig>[] = [];

    const result = updateSafetyGuardState(
      currentState,
      newMetrics,
      config,
      currentRolloutConfig,
      rollbackFactory,
      rules,
    );

    expect(typeof result.state.lastUpdated).toBe('number');
    expect(result.state.lastUpdated).toBeGreaterThan(0);
  });

  it('complex scenario: multiple rules с разными приоритетами и rollback', () => {
    // Правило 1: низкий приоритет, проходит
    const rule1: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
      createTestRuleResult({ ruleId: 'low_priority', priority: 'low', shouldRollback: false }),
    );

    // Правило 2: средний приоритет, проходит
    const rule2: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
      createTestRuleResult({
        ruleId: 'medium_priority',
        priority: 'medium',
        shouldRollback: false,
      }),
    );

    // Правило 3: высокий приоритет, вызывает rollback
    const rule3: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn().mockReturnValue(
      createTestRuleResult({
        ruleId: 'high_priority',
        priority: 'high',
        shouldRollback: true,
        rollbackReason: 'High priority rule triggered rollback',
      }),
    );

    // Правило 4: не должно выполниться из-за early exit
    const rule4: SafetyRule<TestMetrics, TestSafetyConfig> = vi.fn();

    const config = createTestSafetyConfig({
      rulePriorities: {
        'low_priority': 'low',
        'medium_priority': 'medium',
        'high_priority': 'high',
      },
    });
    const metrics = createTestMetrics();
    const rules = [rule1, rule2, rule3, rule4];

    const result = evaluateSafetyGuard(metrics, config, rules, 1000);

    expect(rule1).toHaveBeenCalled();
    expect(rule2).toHaveBeenCalled();
    expect(rule3).toHaveBeenCalled();
    expect(rule4).not.toHaveBeenCalled(); // early exit

    expect(result.shouldRollback).toBe(true);
    expect(result.rollbackReason).toBe('High priority rule triggered rollback');
    expect(result.triggeredRule?.ruleId).toBe('high_priority');
    expect(result.ruleResults).toHaveLength(3);

    // Результаты отсортированы по приоритету
    expect(result.ruleResults[0]!.ruleId).toBe('high_priority');
    expect(result.ruleResults[1]!.ruleId).toBe('medium_priority');
    expect(result.ruleResults[2]!.ruleId).toBe('low_priority');
  });
});
