/**
 * @file packages/feature-auth/src/effects/login/risk-decision.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Decision Engine
 * ============================================================================
 *
 * Архитектурная роль:
 * - Определение уровня риска на основе score
 * - Принятие решения (allow/challenge/block) на основе правил и score
 * - Приоритетная система правил
 *
 * Принципы:
 * - ✅ Rule-driven — решения на основе правил
 * - ✅ Priority-based — приоритеты правил
 * - ✅ Configurable — политика может быть настроена
 */

import { evaluateRuleActions } from './risk-rules.js';
import type { RiskRule } from './risk-rules.js';
import type { RiskLevel } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Конфигурация порогов для уровней риска */
export type RiskThresholds = {
  readonly low: number;
  readonly medium: number;
  readonly high: number;
  readonly critical: number;
};

/** Политика принятия решений */
export type DecisionPolicy = {
  readonly thresholds: RiskThresholds;
  readonly blockOnCriticalRules?: boolean;
  readonly challengeOnHighRisk?: boolean;
  /** Порог критической репутации (по умолчанию 10) */
  readonly criticalReputationThreshold?: number;
};

/** Сигналы для decision engine (reputationScore валидирован 0-100) */
export type DecisionSignals = {
  readonly reputationScore?: number;
};

/** Причина блокировки для audit logging */
export type BlockReason =
  | 'critical_risk'
  | 'critical_reputation'
  | 'rule_block'
  | 'unknown_risk_level';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтные пороги */
export const defaultRiskThresholds: RiskThresholds = {
  low: 30,
  medium: 60,
  high: 80,
  critical: 90,
} as const;

/** Дефолтная политика */
export const defaultDecisionPolicy: DecisionPolicy = {
  thresholds: defaultRiskThresholds,
  blockOnCriticalRules: true,
  challengeOnHighRisk: true,
  criticalReputationThreshold: 10,
} as const;

/** @deprecated Используйте defaultRiskThresholds */
export const DefaultRiskThresholds = defaultRiskThresholds;

/** @deprecated Используйте defaultDecisionPolicy */
export const DefaultDecisionPolicy = defaultDecisionPolicy;

/* ============================================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================================
 */

/** Определяет уровень риска на основе score */
export function determineRiskLevel(
  riskScore: number,
  thresholds: RiskThresholds = defaultRiskThresholds,
): RiskLevel {
  if (riskScore >= thresholds.critical) {
    return 'critical';
  }

  if (riskScore >= thresholds.high) {
    return 'high';
  }

  if (riskScore >= thresholds.medium) {
    return 'medium';
  }

  return 'low';
}

/** Проверяет наличие критической репутации (reputationScore < threshold) */
function hasCriticalReputation(
  signals: DecisionSignals | undefined,
  threshold: number,
): boolean {
  return (
    signals?.reputationScore !== undefined
    && signals.reputationScore < threshold
  );
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Результат принятия решения с причиной блокировки для audit logging
 */
export type DecisionResult = {
  readonly action: 'allow' | 'challenge' | 'block';
  readonly blockReason?: BlockReason;
};

/**
 * Определяет рекомендацию по действию с приоритетами правил
 *
 * Детерминированная: одинаковый вход → одинаковый выход (порядок правил не важен).
 * Приоритет: critical risk > critical reputation > ruleAction='block' > ruleAction='challenge' > policy challenge > allow.
 * Fail-safe: неизвестный riskLevel → 'block'.
 *
 * @param riskLevel - Уровень риска
 * @param triggeredRules - Сработавшие правила (порядок не важен)
 * @param signals - Сигналы (reputationScore валидирован 0-100)
 * @param policy - Политика принятия решений
 * @returns Результат с действием и причиной блокировки (для audit logging)
 */
export function determineDecisionHint(
  riskLevel: RiskLevel,
  triggeredRules: readonly RiskRule[],
  signals: DecisionSignals | undefined = undefined,
  policy: DecisionPolicy = defaultDecisionPolicy,
): DecisionResult {
  // Fail-safe: неизвестный riskLevel → блокировка (безопаснее по умолчанию)
  const validRiskLevels: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'] as const;
  if (!validRiskLevels.includes(riskLevel)) {
    return { action: 'block', blockReason: 'unknown_risk_level' };
  }

  // 1. Критический уровень риска = блокировка (высший приоритет)
  if (riskLevel === 'critical') {
    return { action: 'block', blockReason: 'critical_risk' };
  }

  // 2. Критическая репутация (сигнал) = блокировка
  const reputationThreshold = policy.criticalReputationThreshold
    ?? defaultDecisionPolicy.criticalReputationThreshold
    ?? 10;
  if (hasCriticalReputation(signals, reputationThreshold)) {
    return { action: 'block', blockReason: 'critical_reputation' };
  }

  // 3. Оценка действий правил через rule engine (правила уже отсортированы внутри)
  const ruleAction = evaluateRuleActions(triggeredRules);
  if (ruleAction === 'block') {
    return { action: 'block', blockReason: 'rule_block' };
  }

  if (ruleAction === 'challenge') {
    return { action: 'challenge' };
  }

  // 4. Политика: challenge на высокий/средний риск
  if (
    policy.challengeOnHighRisk === true
    && (riskLevel === 'high' || riskLevel === 'medium')
  ) {
    return { action: 'challenge' };
  }

  // 5. Низкий риск = allow
  return { action: 'allow' };
}
