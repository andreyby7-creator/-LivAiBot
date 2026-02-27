/**
 * @file Unit тесты для lib/classification-mapper.ts
 * Полное покрытие classification mapper с тестированием всех стратегий и edge cases
 */

import { describe, expect, it } from 'vitest';
import type { ClassificationLabel } from '@livai/domains/labels';
import type { ClassificationRule } from '@livai/domains/strategies';
import type { DecisionPolicy, DecisionSignals, RiskLevel } from '@livai/domains/policies';
import { defaultDecisionPolicy } from '@livai/domains/policies';

import { mapLabelToDecisionHint } from '../../../src/lib/classification-mapper.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает ClassificationLabel для тестов */
function createLabel(value: 'DANGEROUS' | 'SUSPICIOUS' | 'SAFE' | 'UNKNOWN'): ClassificationLabel {
  // Используем type assertion, так как ClassificationLabel - это branded type из domains
  // classificationLabel.value ожидает объект с методом value или свойством value
  return value as unknown as ClassificationLabel;
}

/** Создает DecisionSignals для тестов */
function createSignals(overrides: Partial<DecisionSignals> = {}): DecisionSignals {
  return {
    reputationScore: 50,
    ...overrides,
  };
}

/** Создает DecisionPolicy для тестов */
function createPolicy(overrides: Partial<DecisionPolicy> = {}): DecisionPolicy {
  return {
    ...defaultDecisionPolicy,
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - mapLabelToDecisionHint (Main API)
// ============================================================================

describe('mapLabelToDecisionHint', () => {
  describe('DANGEROUS label', () => {
    it('возвращает block с critical_risk для DANGEROUS', () => {
      const label = createLabel('DANGEROUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'high';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_risk');
    });

    it('возвращает block для DANGEROUS независимо от правил', () => {
      const label = createLabel('DANGEROUS');
      const triggeredRules: ClassificationRule[] = [
        'TOR_NETWORK',
        'VPN_DETECTED',
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_risk');
    });

    it('возвращает block для DANGEROUS независимо от signals и policy', () => {
      const label = createLabel('DANGEROUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'low';
      const signals = createSignals({ reputationScore: 5 });
      const policy = createPolicy({ dangerousReputationTo: 20 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_risk');
    });
  });

  describe('SAFE label', () => {
    it('возвращает login для SAFE', () => {
      const label = createLabel('SAFE');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'low';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('login');
      expect(result.blockReason).toBeUndefined();
    });

    it('возвращает login для SAFE независимо от правил', () => {
      const label = createLabel('SAFE');
      const triggeredRules: ClassificationRule[] = [
        'TOR_NETWORK',
        'CRITICAL_REPUTATION',
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'high';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('login');
    });

    it('возвращает login для SAFE независимо от signals и policy', () => {
      const label = createLabel('SAFE');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 5 });
      const policy = createPolicy();

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('login');
    });
  });

  describe('SUSPICIOUS label', () => {
    it('возвращает mfa для SUSPICIOUS по умолчанию', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('mfa');
      expect(result.blockReason).toBeUndefined();
    });

    it('возвращает block с rule_block для SUSPICIOUS при блокирующем правиле', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = ['TOR_NETWORK'] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('rule_block');
    });

    it('возвращает block с critical_reputation для SUSPICIOUS при низкой репутации', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 5 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('возвращает block с critical_reputation для SUSPICIOUS при репутации ниже порога', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 8 });
      const policy = createPolicy({ dangerousReputationTo: 10 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('возвращает mfa для SUSPICIOUS при репутации выше порога', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 15 });
      const policy = createPolicy({ dangerousReputationTo: 10 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('mfa');
    });

    it('возвращает mfa для SUSPICIOUS при отсутствии signals', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        undefined,
      );

      expect(result.action).toBe('mfa');
    });

    it('возвращает mfa для SUSPICIOUS при отсутствии reputationScore', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({});

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
      );

      expect(result.action).toBe('mfa');
    });

    it('использует кастомный dangerousReputationTo из policy', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 15 });
      const policy = createPolicy({ dangerousReputationTo: 20 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('использует defaultDecisionPolicy.dangerousReputationTo если не указан в policy', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 5 });
      const policy = createPolicy({});

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('приоритизирует rule_block над critical_reputation', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = ['TOR_NETWORK'] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 5 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('rule_block');
    });

    it('работает с правилами без decisionImpact (pre-filtering)', () => {
      const label = createLabel('SUSPICIOUS');
      // Используем правила, которые не имеют decisionImpact
      const triggeredRules: ClassificationRule[] = [
        'UNKNOWN_DEVICE',
        'MISSING_OS',
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      // Должен вернуть mfa, так как правила без decisionImpact отфильтровываются
      expect(result.action).toBe('mfa');
    });

    it('работает с mfa правилами', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = ['GEO_MISMATCH'] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('mfa');
    });
  });

  describe('UNKNOWN label', () => {
    it('делегирует в determineDecisionHint для UNKNOWN', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'critical';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      // determineDecisionHint для critical должен вернуть block
      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_risk');
    });

    it('передает riskLevel в determineDecisionHint для UNKNOWN', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'high';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result).toBeDefined();
    });

    it('передает triggeredRules в determineDecisionHint для UNKNOWN', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = ['TOR_NETWORK'] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result).toBeDefined();
    });

    it('передает signals в determineDecisionHint для UNKNOWN', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 5 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
      );

      expect(result).toBeDefined();
    });

    it('передает policy в determineDecisionHint для UNKNOWN', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const policy = createPolicy({});

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        undefined,
        policy,
      );

      expect(result).toBeDefined();
    });

    it('использует defaultDecisionPolicy если policy не указан для UNKNOWN', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'low';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result).toBeDefined();
    });
  });

  describe('Неизвестный label (fallback to UNKNOWN)', () => {
    it('использует UNKNOWN стратегию для неизвестного label', () => {
      // Создаем label с неизвестным значением через мок
      const label = {
        value: 'UNKNOWN_LABEL',
      } as unknown as ClassificationLabel;
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'critical';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      // Должен использовать UNKNOWN стратегию, которая делегирует в determineDecisionHint
      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_risk');
    });
  });

  describe('UNKNOWN strategy edge cases', () => {
    it('покрывает проверку riskLevel в unknownStrategy (внутренняя защита)', () => {
      // Эта проверка на строке 200 - это внутренняя защита от undefined
      // В реальности riskLevel всегда передается, так как он обязательный параметр
      // Но стратегия проверяет его на случай внутренних ошибок
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'low';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      // Проверяем, что функция работает корректно
      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
    });

    it('покрывает защитный код для undefined riskLevel в unknownStrategy', () => {
      // Тестируем защитный код для riskLevel === undefined
      // Используем type assertion для обхода проверки TypeScript
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel | undefined = undefined;

      // Вызываем функцию напрямую через type assertion для покрытия защитного кода
      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel as any, // Type assertion для обхода проверки TypeScript
      );

      // Защитный код должен вернуть mfa при undefined riskLevel
      expect(result.action).toBe('mfa');
      expect(result.blockReason).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('работает с пустым массивом правил', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('mfa');
    });

    it('работает с большим количеством правил', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [
        'TOR_NETWORK',
        'VPN_DETECTED',
        'PROXY_DETECTED',
        'CRITICAL_REPUTATION',
        'GEO_MISMATCH',
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('rule_block');
    });

    it('работает со всеми уровнями риска', () => {
      const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

      const results = levels.map((riskLevel) => {
        const label = createLabel('UNKNOWN');
        const triggeredRules: ClassificationRule[] = [];
        return mapLabelToDecisionHint(
          label,
          triggeredRules,
          riskLevel,
        );
      });

      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.action).toBeDefined();
      });
    });

    it('работает без signals', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        undefined,
      );

      expect(result.action).toBe('mfa');
    });

    it('работает без policy', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 5 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        undefined,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('работает с reputationScore = 0', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 0 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('работает с reputationScore = 100', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const signals = createSignals({ reputationScore: 100 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
      );

      expect(result.action).toBe('mfa');
    });

    it('работает с reputationScore на границе порога', () => {
      const label = createLabel('SUSPICIOUS');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';
      const policy = createPolicy({ dangerousReputationTo: 10 });

      // На границе (ровно порог)
      const signalsAtThreshold = createSignals({ reputationScore: 10 });
      const resultAtThreshold = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signalsAtThreshold,
        policy,
      );
      expect(resultAtThreshold.action).toBe('mfa');

      // Ниже порога
      const signalsBelow = createSignals({ reputationScore: 9 });
      const resultBelow = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signalsBelow,
        policy,
      );
      expect(resultBelow.action).toBe('block');
      expect(resultBelow.blockReason).toBe('critical_reputation');
    });
  });

  describe('Pre-filtering оптимизация', () => {
    it('фильтрует правила без decisionImpact', () => {
      const label = createLabel('SUSPICIOUS');
      // Смешанный набор: правила с decisionImpact и без
      const triggeredRules: ClassificationRule[] = [
        'TOR_NETWORK', // имеет decisionImpact: 'block'
        'UNKNOWN_DEVICE', // не имеет decisionImpact
        'MISSING_OS', // не имеет decisionImpact
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      // Должен вернуть block из-за TOR_NETWORK, игнорируя правила без decisionImpact
      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('rule_block');
    });

    it('возвращает mfa если все правила отфильтрованы', () => {
      const label = createLabel('SUSPICIOUS');
      // Только правила без decisionImpact
      const triggeredRules: ClassificationRule[] = [
        'UNKNOWN_DEVICE',
        'MISSING_OS',
        'MISSING_BROWSER',
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('mfa');
    });
  });

  describe('UNKNOWN strategy - risk level coverage', () => {
    it('возвращает login для UNKNOWN с low riskLevel', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'low';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('login');
      expect(result.blockReason).toBeUndefined();
    });

    it('возвращает login для UNKNOWN с medium riskLevel', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('login');
      expect(result.blockReason).toBeUndefined();
    });

    it('возвращает mfa для UNKNOWN с high riskLevel', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'high';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('mfa');
      expect(result.blockReason).toBeUndefined();
    });

    it('возвращает block для UNKNOWN с critical riskLevel и низкой репутацией', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'critical';
      const signals = createSignals({ reputationScore: 5 });
      const policy = createPolicy({ dangerousReputationTo: 20 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_reputation');
    });

    it('возвращает block для UNKNOWN с critical riskLevel без низкой репутации', () => {
      const label = createLabel('UNKNOWN');
      const triggeredRules: ClassificationRule[] = [];
      const riskLevel: RiskLevel = 'critical';
      const signals = createSignals({ reputationScore: 50 });
      const policy = createPolicy({ dangerousReputationTo: 20 });

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
        signals,
        policy,
      );

      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('critical_risk');
    });

    it('возвращает mfa для UNKNOWN с challenge правилом', () => {
      const label = createLabel('UNKNOWN');
      // Используем правило, которое имеет decisionImpact: 'challenge'
      const triggeredRules: ClassificationRule[] = ['GEO_MISMATCH'] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      expect(result.action).toBe('mfa');
    });
  });

  describe('Batch fetch optimization', () => {
    it('обрабатывает дубликаты правил в batch fetch', () => {
      const label = createLabel('SUSPICIOUS');
      // Дубликаты правил для проверки batch fetch оптимизации
      const triggeredRules: ClassificationRule[] = [
        'TOR_NETWORK',
        'TOR_NETWORK', // дубликат
        'VPN_DETECTED',
        'TOR_NETWORK', // еще один дубликат
      ] as ClassificationRule[];
      const riskLevel: RiskLevel = 'medium';

      const result = mapLabelToDecisionHint(
        label,
        triggeredRules,
        riskLevel,
      );

      // Должен вернуть block, так как TOR_NETWORK имеет decisionImpact: 'block'
      expect(result.action).toBe('block');
      expect(result.blockReason).toBe('rule_block');
    });

    it('детерминированная сортировка правил для одинакового результата', () => {
      const label = createLabel('SUSPICIOUS');
      const riskLevel: RiskLevel = 'medium';

      // Те же правила в разном порядке
      const rules1: ClassificationRule[] = ['TOR_NETWORK', 'VPN_DETECTED'] as ClassificationRule[];
      const rules2: ClassificationRule[] = ['VPN_DETECTED', 'TOR_NETWORK'] as ClassificationRule[];

      const result1 = mapLabelToDecisionHint(label, rules1, riskLevel);
      const result2 = mapLabelToDecisionHint(label, rules2, riskLevel);

      // Результаты должны быть идентичными благодаря сортировке
      expect(result1.action).toBe(result2.action);
      expect(result1.blockReason).toBe(result2.blockReason);
    });
  });
});
