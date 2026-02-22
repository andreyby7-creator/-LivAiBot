/**
 * @file packages/domains/src/classification/policies/base.policy.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Base Policy (Decision Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * Базовая decision policy для classification domain.
 * Определяет risk level и итоговый classification label на основе:
 * - risk score + threshold policy;
 * - агрегированных фактов эскалации (triggeredRuleCount + decision signals).
 *
 * Принципы:
 * - ✅ SRP: только policy-решения (без evaluation/scoring orchestration)
 * - ✅ Deterministic: одинаковые входы -> одинаковые результаты
 * - ✅ Fail-safe: невалидные score/count/policy нормализуются или откатываются к default policy
 * - ✅ Domain-pure: без IO, логирования и внешних side-effects
 * - ✅ Strict typing: explicit unions для risk level и policy contracts
 * - ✅ Security hardening: escalation только вверх (нет downgrade path), явные инварианты policy
 * - ✅ Extensible: thresholds и escalation-пороги конфигурируются без изменения core-алгоритма
 */

import type { ClassificationLabel } from '../labels.js';
import { classificationLabel } from '../labels.js';
import type { ClassificationSignals } from '../signals/signals.js';

/* ============================================================================
 * 🧩 TYPES — POLICY CONTRACT
 * ============================================================================
 */

/** Дискретный уровень риска, используемый decision policy. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Пороговые значения risk score (0..100) для перехода между уровнями риска. */
export type RiskThresholds = Readonly<{
  /** Score >= mediumFrom -> medium */
  readonly mediumFrom: number;
  /** Score >= highFrom -> high */
  readonly highFrom: number;
  /** Score >= criticalFrom -> critical */
  readonly criticalFrom: number;
}>;

/** Дополнительные сигналы для policy-эскалации итогового label. */
export type DecisionSignals = Readonly<{
  readonly isVpn?: ClassificationSignals['isVpn'];
  readonly isTor?: ClassificationSignals['isTor'];
  readonly isProxy?: ClassificationSignals['isProxy'];
  readonly reputationScore?: ClassificationSignals['reputationScore'];
  readonly velocityScore?: ClassificationSignals['velocityScore'];
}>;

/** Политика принятия решения для classification domain. */
export type DecisionPolicy = Readonly<{
  /** Пороги risk level на основе risk score. */
  readonly thresholds: RiskThresholds;
  /** Количество triggered rules, начиная с которого label эскалируется до DANGEROUS. */
  readonly dangerousRuleCountFrom: number;
  /** Порог velocity для эскалации до DANGEROUS. */
  readonly dangerousVelocityFrom: number;
  /** Порог reputation (чем меньше, тем рискованнее) для эскалации до DANGEROUS. */
  readonly dangerousReputationTo: number;
}>;

/* ============================================================================
 * 🔧 CONSTANTS — DEFAULT POLICY
 * ============================================================================
 */

const DEFAULT_THRESHOLDS: RiskThresholds = Object.freeze({
  mediumFrom: 35,
  highFrom: 65,
  criticalFrom: 85,
});

/** Базовая policy для classification решений. */
export const defaultDecisionPolicy: DecisionPolicy = Object.freeze({
  thresholds: DEFAULT_THRESHOLDS,
  dangerousRuleCountFrom: 3,
  dangerousVelocityFrom: 80,
  dangerousReputationTo: 20,
});

const SAFE_LABEL_RESULT = classificationLabel.create('SAFE', { normalize: false });
const SUSPICIOUS_LABEL_RESULT = classificationLabel.create('SUSPICIOUS', { normalize: false });
const DANGEROUS_LABEL_RESULT = classificationLabel.create('DANGEROUS', { normalize: false });

if (
  !SAFE_LABEL_RESULT.ok
  || !SUSPICIOUS_LABEL_RESULT.ok
  || !DANGEROUS_LABEL_RESULT.ok
) {
  // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации value-object label.
  throw new Error('Failed to initialize classification labels in base policy');
}

const LABELS = Object.freeze(
  {
    safe: SAFE_LABEL_RESULT.value,
    suspicious: SUSPICIOUS_LABEL_RESULT.value,
    dangerous: DANGEROUS_LABEL_RESULT.value,
  } as const,
);

/* ============================================================================
 * 🔧 INTERNAL HELPERS — PURE DECISION LOGIC
 * ============================================================================
 */

/** Нормализует score в диапазон 0..100; нечисловые/бесконечные значения переводит в fail-safe `0`. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.min(100, Math.max(0, score));
}

/** Проверяет инварианты thresholds: диапазон 0..100 и монотонный порядок medium <= high <= critical. */
function isThresholdsValid(thresholds: RiskThresholds): boolean {
  return (
    thresholds.mediumFrom >= 0
    && thresholds.mediumFrom <= 100
    && thresholds.highFrom >= 0
    && thresholds.highFrom <= 100
    && thresholds.criticalFrom >= 0
    && thresholds.criticalFrom <= 100
    && thresholds.mediumFrom <= thresholds.highFrom
    && thresholds.highFrom <= thresholds.criticalFrom
  );
}

function hasDangerousSignals(
  signals: DecisionSignals | undefined,
  policy: DecisionPolicy,
): boolean {
  if (signals === undefined) {
    return false;
  }
  // isVpn сам по себе не эскалирует до DANGEROUS:
  // для escalation учитываются только более сильные индикаторы (Tor/Proxy/score thresholds).
  return (
    signals.isTor === true
    || signals.isProxy === true
    || (signals.velocityScore !== undefined
      && signals.velocityScore >= policy.dangerousVelocityFrom)
    || (signals.reputationScore !== undefined
      && signals.reputationScore <= policy.dangerousReputationTo)
  );
}

function isDecisionPolicyValid(policy: DecisionPolicy): boolean {
  return (
    isThresholdsValid(policy.thresholds)
    && policy.dangerousRuleCountFrom >= 0
    && Number.isFinite(policy.dangerousRuleCountFrom)
    && policy.dangerousVelocityFrom >= 0
    && policy.dangerousVelocityFrom <= 100
    && Number.isFinite(policy.dangerousVelocityFrom)
    && policy.dangerousReputationTo >= 0
    && policy.dangerousReputationTo <= 100
    && Number.isFinite(policy.dangerousReputationTo)
  );
}

/** Решает, требуется ли эскалация в `DANGEROUS` по агрегированным фактам (count + decision signals). */
function shouldEscalateToDangerous(
  triggeredRuleCount: number,
  decisionSignals: DecisionSignals | undefined,
  policy: DecisionPolicy,
): boolean {
  const normalizedCount = Number.isFinite(triggeredRuleCount)
    ? Math.max(0, triggeredRuleCount)
    : 0;
  return (
    normalizedCount >= policy.dangerousRuleCountFrom
    || hasDangerousSignals(decisionSignals, policy)
  );
}

/* ============================================================================
 * 🎯 API — POLICY FUNCTIONS
 * ============================================================================
 */

/**
 * Определяет risk level на основе risk score и policy thresholds.
 * При невалидных thresholds используется fail-safe fallback на `defaultDecisionPolicy`.
 */
export function determineRiskLevel(
  riskScore: number,
  thresholds: RiskThresholds = defaultDecisionPolicy.thresholds,
): RiskLevel {
  const safeThresholds = isThresholdsValid(thresholds)
    ? thresholds
    : defaultDecisionPolicy.thresholds;
  const score = clampScore(riskScore);
  if (score >= safeThresholds.criticalFrom) {
    return 'critical';
  }
  if (score >= safeThresholds.highFrom) {
    return 'high';
  }
  if (score >= safeThresholds.mediumFrom) {
    return 'medium';
  }
  return 'low';
}

/**
 * Определяет итоговый classification label.
 * Порядок:
 * 1) Base mapping по risk level
 * 2) Эскалация до DANGEROUS по policy (triggered rules / dangerous signals)
 */
export function determineLabel(
  riskLevel: RiskLevel,
  triggeredRuleCount: number,
  decisionSignals?: DecisionSignals,
  policy: DecisionPolicy = defaultDecisionPolicy,
): ClassificationLabel {
  // Fail-safe: невалидный кастомный policy не ломает доменную логику, а откатывается к default.
  const safePolicy = isDecisionPolicyValid(policy) ? policy : defaultDecisionPolicy;

  if (riskLevel === 'critical') {
    return LABELS.dangerous;
  }

  const baseLabel: ClassificationLabel = ((): ClassificationLabel => {
    switch (riskLevel) {
      case 'high':
        return LABELS.dangerous;
      case 'medium':
        return LABELS.suspicious;
      case 'low':
        return LABELS.safe;
      default: {
        const exhaustive: never = riskLevel;
        return exhaustive;
      }
    }
  })();

  const mustEscalate = shouldEscalateToDangerous(
    triggeredRuleCount,
    decisionSignals,
    safePolicy,
  );
  if (mustEscalate) {
    return LABELS.dangerous;
  }
  return baseLabel;
}
