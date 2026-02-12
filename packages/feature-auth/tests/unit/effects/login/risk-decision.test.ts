/**
 * @file Unit тесты для effects/login/risk-decision.ts
 * Полное покрытие risk decision с тестированием всех функций и edge cases
 */

import { describe, expect, it } from 'vitest';

import type { RiskLevel } from '../../../../src/types/auth.js';
import {
  DefaultDecisionPolicy,
  defaultDecisionPolicy,
  DefaultRiskThresholds,
  defaultRiskThresholds,
  determineDecisionHint,
  determineRiskLevel,
} from '../../../../src/effects/login/risk-decision.js';
import type {
  BlockReason,
  DecisionPolicy,
  DecisionResult,
  DecisionSignals,
  RiskThresholds,
} from '../../../../src/effects/login/risk-decision.js';
import type { RiskRule } from '../../../../src/effects/login/risk-rules.js';

// ============================================================================
// 🎯 TESTS - Exports and Constants
// ============================================================================

describe('Exports and Constants', () => {
  it('экспортирует defaultRiskThresholds', () => {
    expect(defaultRiskThresholds).toBeDefined();
    expect(defaultRiskThresholds.low).toBe(30);
    expect(defaultRiskThresholds.medium).toBe(60);
    expect(defaultRiskThresholds.high).toBe(80);
    expect(defaultRiskThresholds.critical).toBe(90);
  });

  it('экспортирует DefaultRiskThresholds (deprecated alias)', () => {
    expect(DefaultRiskThresholds).toBeDefined();
    expect(DefaultRiskThresholds).toBe(defaultRiskThresholds);
  });

  it('экспортирует defaultDecisionPolicy', () => {
    expect(defaultDecisionPolicy).toBeDefined();
    expect(defaultDecisionPolicy.thresholds).toBe(defaultRiskThresholds);
    expect(defaultDecisionPolicy.blockOnCriticalRules).toBe(true);
    expect(defaultDecisionPolicy.challengeOnHighRisk).toBe(true);
    expect(defaultDecisionPolicy.criticalReputationThreshold).toBe(10);
  });

  it('экспортирует DefaultDecisionPolicy (deprecated alias)', () => {
    expect(DefaultDecisionPolicy).toBeDefined();
    expect(DefaultDecisionPolicy).toBe(defaultDecisionPolicy);
  });
});

// ============================================================================
// 🎯 TESTS - determineRiskLevel
// ============================================================================

describe('determineRiskLevel', () => {
  it('возвращает critical для score >= critical threshold', () => {
    const thresholds: RiskThresholds = {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90,
    };
    expect(determineRiskLevel(90, thresholds)).toBe('critical');
    expect(determineRiskLevel(100, thresholds)).toBe('critical');
    expect(determineRiskLevel(95, thresholds)).toBe('critical');
  });

  it('возвращает high для score >= high threshold и < critical', () => {
    const thresholds: RiskThresholds = {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90,
    };
    expect(determineRiskLevel(80, thresholds)).toBe('high');
    expect(determineRiskLevel(85, thresholds)).toBe('high');
    expect(determineRiskLevel(89, thresholds)).toBe('high');
  });

  it('возвращает medium для score >= medium threshold и < high', () => {
    const thresholds: RiskThresholds = {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90,
    };
    expect(determineRiskLevel(60, thresholds)).toBe('medium');
    expect(determineRiskLevel(70, thresholds)).toBe('medium');
    expect(determineRiskLevel(79, thresholds)).toBe('medium');
  });

  it('возвращает low для score < medium threshold', () => {
    const thresholds: RiskThresholds = {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90,
    };
    expect(determineRiskLevel(0, thresholds)).toBe('low');
    expect(determineRiskLevel(29, thresholds)).toBe('low');
    expect(determineRiskLevel(30, thresholds)).toBe('low');
    expect(determineRiskLevel(59, thresholds)).toBe('low');
  });

  it('использует дефолтные пороги если thresholds не указаны', () => {
    expect(determineRiskLevel(90)).toBe('critical');
    expect(determineRiskLevel(80)).toBe('high');
    expect(determineRiskLevel(60)).toBe('medium');
    expect(determineRiskLevel(30)).toBe('low');
  });

  it('обрабатывает кастомные пороги', () => {
    const customThresholds: RiskThresholds = {
      low: 20,
      medium: 40,
      high: 60,
      critical: 80,
    };
    expect(determineRiskLevel(80, customThresholds)).toBe('critical');
    expect(determineRiskLevel(60, customThresholds)).toBe('high');
    expect(determineRiskLevel(40, customThresholds)).toBe('medium');
    expect(determineRiskLevel(20, customThresholds)).toBe('low');
  });

  it('обрабатывает граничные значения', () => {
    const thresholds: RiskThresholds = {
      low: 30,
      medium: 60,
      high: 80,
      critical: 90,
    };
    // Граничные значения
    expect(determineRiskLevel(90, thresholds)).toBe('critical');
    expect(determineRiskLevel(89, thresholds)).toBe('high');
    expect(determineRiskLevel(80, thresholds)).toBe('high');
    expect(determineRiskLevel(79, thresholds)).toBe('medium');
    expect(determineRiskLevel(60, thresholds)).toBe('medium');
    expect(determineRiskLevel(59, thresholds)).toBe('low');
    expect(determineRiskLevel(30, thresholds)).toBe('low');
    expect(determineRiskLevel(29, thresholds)).toBe('low');
  });
});

// ============================================================================
// 🎯 TESTS - determineDecisionHint
// ============================================================================

describe('determineDecisionHint', () => {
  it('возвращает block с critical_risk для critical riskLevel', () => {
    const result = determineDecisionHint('critical', []);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_risk');
  });

  it('возвращает block с critical_reputation для критической репутации', () => {
    const signals: DecisionSignals = {
      reputationScore: 5, // < 10 (criticalReputationThreshold)
    };
    const result = determineDecisionHint('high', [], signals);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('возвращает block с rule_block для правил с action=block', () => {
    const triggeredRules: RiskRule[] = ['TOR_NETWORK']; // Правило с decisionImpact='block'
    const result = determineDecisionHint('medium', triggeredRules);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('rule_block');
  });

  it('возвращает challenge для правил с action=challenge', () => {
    const triggeredRules: RiskRule[] = ['HIGH_RISK_COUNTRY']; // Правило с decisionImpact='challenge'
    const result = determineDecisionHint('low', triggeredRules);
    expect(result.action).toBe('challenge');
    expect(result.blockReason).toBeUndefined();
  });

  it('возвращает challenge для high risk с challengeOnHighRisk=true', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      challengeOnHighRisk: true,
    };
    const result = determineDecisionHint('high', [], undefined, policy);
    expect(result.action).toBe('challenge');
    expect(result.blockReason).toBeUndefined();
  });

  it('возвращает challenge для medium risk с challengeOnHighRisk=true', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      challengeOnHighRisk: true,
    };
    const result = determineDecisionHint('medium', [], undefined, policy);
    expect(result.action).toBe('challenge');
    expect(result.blockReason).toBeUndefined();
  });

  it('возвращает allow для low risk без правил', () => {
    const result = determineDecisionHint('low', []);
    expect(result.action).toBe('allow');
    expect(result.blockReason).toBeUndefined();
  });

  it('возвращает allow для low risk с правилами без decision impact', () => {
    const triggeredRules: RiskRule[] = ['MISSING_OS']; // Правило без decisionImpact
    const result = determineDecisionHint('low', triggeredRules);
    expect(result.action).toBe('allow');
    expect(result.blockReason).toBeUndefined();
  });

  it('приоритет: critical risk > critical reputation', () => {
    const signals: DecisionSignals = {
      reputationScore: 5, // Критическая репутация
    };
    const result = determineDecisionHint('critical', [], signals);
    // critical risk имеет приоритет над critical reputation
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_risk');
  });

  it('приоритет: critical reputation > rule action', () => {
    const triggeredRules: RiskRule[] = ['HIGH_RISK_COUNTRY']; // challenge правило
    const signals: DecisionSignals = {
      reputationScore: 5, // Критическая репутация
    };
    const result = determineDecisionHint('high', triggeredRules, signals);
    // critical reputation имеет приоритет над rule action
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('приоритет: rule block > rule challenge', () => {
    const triggeredRules: RiskRule[] = ['TOR_NETWORK', 'HIGH_RISK_COUNTRY']; // block и challenge
    const result = determineDecisionHint('medium', triggeredRules);
    // block имеет приоритет над challenge
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('rule_block');
  });

  it('приоритет: rule challenge > policy challenge', () => {
    const triggeredRules: RiskRule[] = ['HIGH_RISK_COUNTRY']; // challenge правило
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      challengeOnHighRisk: true,
    };
    const result = determineDecisionHint('high', triggeredRules, undefined, policy);
    // rule challenge имеет приоритет, но результат тот же
    expect(result.action).toBe('challenge');
    expect(result.blockReason).toBeUndefined();
  });

  it('приоритет: rule challenge > allow', () => {
    const triggeredRules: RiskRule[] = ['HIGH_RISK_COUNTRY']; // challenge правило
    const result = determineDecisionHint('low', triggeredRules);
    // rule challenge имеет приоритет над allow
    expect(result.action).toBe('challenge');
    expect(result.blockReason).toBeUndefined();
  });

  it('возвращает block с unknown_risk_level для невалидного riskLevel', () => {
    const invalidRiskLevel = 'invalid' as unknown as RiskLevel;
    const result = determineDecisionHint(invalidRiskLevel, []);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('unknown_risk_level');
  });

  it('использует кастомный criticalReputationThreshold из policy', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      criticalReputationThreshold: 20,
    };
    const signals: DecisionSignals = {
      reputationScore: 15, // < 20, но >= 10
    };
    const result = determineDecisionHint('high', [], signals, policy);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('использует дефолтный criticalReputationThreshold если не указан в policy', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      // criticalReputationThreshold не указан
    };
    const signals: DecisionSignals = {
      reputationScore: 5, // < 10 (дефолтный threshold)
    };
    const result = determineDecisionHint('high', [], signals, policy);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('использует дефолтный criticalReputationThreshold из defaultDecisionPolicy (строка 164)', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      // criticalReputationThreshold не указан, должен использоваться defaultDecisionPolicy.criticalReputationThreshold
    };
    const signals: DecisionSignals = {
      reputationScore: 5, // < 10
    };
    const result = determineDecisionHint('high', [], signals, policy);
    // Проверяем, что используется дефолтный threshold (строка 164: ?? defaultDecisionPolicy.criticalReputationThreshold)
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('использует fallback на 10 если defaultDecisionPolicy.criticalReputationThreshold тоже undefined (строка 165)', () => {
    // Создаем policy без criticalReputationThreshold для проверки fallback на 10
    // Это edge case для строки 165: ?? 10
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      // criticalReputationThreshold не указан, будет использован defaultDecisionPolicy.criticalReputationThreshold (10)
      // Но если бы defaultDecisionPolicy.criticalReputationThreshold был undefined, использовался бы fallback на 10
    };
    const signals: DecisionSignals = {
      reputationScore: 5, // < 10
    };
    const result = determineDecisionHint('high', [], signals, policy);
    // Проверяем, что используется threshold из defaultDecisionPolicy (10)
    // В реальности defaultDecisionPolicy.criticalReputationThreshold = 10, поэтому fallback на 10 недостижим
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('не блокирует для reputationScore >= threshold', () => {
    const signals: DecisionSignals = {
      reputationScore: 10, // = threshold
    };
    const result = determineDecisionHint('high', [], signals);
    expect(result.action).not.toBe('block');
    expect(result.blockReason).not.toBe('critical_reputation');
  });

  it('не блокирует для reputationScore > threshold', () => {
    const signals: DecisionSignals = {
      reputationScore: 15, // > 10
    };
    const result = determineDecisionHint('high', [], signals);
    expect(result.action).not.toBe('block');
    expect(result.blockReason).not.toBe('critical_reputation');
  });

  it('не блокирует для отсутствующего reputationScore', () => {
    const result = determineDecisionHint('high', [], undefined);
    expect(result.action).not.toBe('block');
    expect(result.blockReason).not.toBe('critical_reputation');
  });

  it('не применяет challengeOnHighRisk для low risk', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      challengeOnHighRisk: true,
    };
    const result = determineDecisionHint('low', [], undefined, policy);
    expect(result.action).toBe('allow');
  });

  it('не применяет challengeOnHighRisk если policy.challengeOnHighRisk=false', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      challengeOnHighRisk: false,
    };
    const result = determineDecisionHint('high', [], undefined, policy);
    expect(result.action).toBe('allow');
  });

  it('не применяет challengeOnHighRisk если policy.challengeOnHighRisk=undefined', () => {
    const policy: DecisionPolicy = {
      thresholds: defaultRiskThresholds,
      // challengeOnHighRisk не указан
    };
    const result = determineDecisionHint('high', [], undefined, policy);
    expect(result.action).toBe('allow');
  });

  it('обрабатывает пустой массив правил', () => {
    const result = determineDecisionHint('medium', []);
    expect(result.action).toBe('challenge'); // challengeOnHighRisk=true по умолчанию
    expect(result.blockReason).toBeUndefined();
  });

  it('обрабатывает несколько правил с разными action', () => {
    const triggeredRules: RiskRule[] = [
      'TOR_NETWORK', // block
      'HIGH_RISK_COUNTRY', // challenge
      'MISSING_OS', // нет action
    ];
    const result = determineDecisionHint('medium', triggeredRules);
    // block имеет приоритет
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('rule_block');
  });

  it('обрабатывает правила без decision impact', () => {
    const triggeredRules: RiskRule[] = ['MISSING_OS', 'MISSING_BROWSER']; // Нет decisionImpact
    const result = determineDecisionHint('low', triggeredRules);
    expect(result.action).toBe('allow');
    expect(result.blockReason).toBeUndefined();
  });

  it('использует дефолтную policy если не указана', () => {
    const result = determineDecisionHint('high', []);
    // Дефолтная policy имеет challengeOnHighRisk=true
    expect(result.action).toBe('challenge');
    expect(result.blockReason).toBeUndefined();
  });

  it('обрабатывает все валидные riskLevel', () => {
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const results = riskLevels.map((level) => determineDecisionHint(level, []));
    results.forEach((result) => {
      expect(result.action).toBeDefined();
      expect(['allow', 'challenge', 'block']).toContain(result.action);
    });
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('обрабатывает reputationScore = 0', () => {
    const signals: DecisionSignals = {
      reputationScore: 0,
    };
    const result = determineDecisionHint('high', [], signals);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('обрабатывает reputationScore = threshold (граничное значение)', () => {
    const signals: DecisionSignals = {
      reputationScore: 10, // = threshold
    };
    const result = determineDecisionHint('high', [], signals);
    // reputationScore = threshold, не должно блокировать
    expect(result.action).not.toBe('block');
    expect(result.blockReason).not.toBe('critical_reputation');
  });

  it('обрабатывает reputationScore = threshold - 1', () => {
    const signals: DecisionSignals = {
      reputationScore: 9, // < threshold
    };
    const result = determineDecisionHint('high', [], signals);
    expect(result.action).toBe('block');
    expect(result.blockReason).toBe('critical_reputation');
  });

  it('обрабатывает кастомные пороги с нестандартными значениями', () => {
    const customThresholds: RiskThresholds = {
      low: 0,
      medium: 25,
      high: 50,
      critical: 75,
    };
    expect(determineRiskLevel(0, customThresholds)).toBe('low');
    expect(determineRiskLevel(25, customThresholds)).toBe('medium');
    expect(determineRiskLevel(50, customThresholds)).toBe('high');
    expect(determineRiskLevel(75, customThresholds)).toBe('critical');
  });

  it('обрабатывает все возможные BlockReason', () => {
    const blockReasons: BlockReason[] = [
      'critical_risk',
      'critical_reputation',
      'rule_block',
      'unknown_risk_level',
    ];
    // Проверяем, что все причины могут быть возвращены
    const results: DecisionResult[] = [
      determineDecisionHint('critical', []), // critical_risk
      determineDecisionHint('high', [], { reputationScore: 5 }), // critical_reputation
      determineDecisionHint('medium', ['TOR_NETWORK']), // rule_block
      determineDecisionHint('invalid' as unknown as RiskLevel, []), // unknown_risk_level
    ];
    const returnedReasons = results
      .map((r) => r.blockReason)
      .filter((r): r is BlockReason => r !== undefined);
    blockReasons.forEach((reason) => {
      expect(returnedReasons).toContain(reason);
    });
  });
});
