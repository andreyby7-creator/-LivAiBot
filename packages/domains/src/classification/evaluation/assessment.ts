/**
 * @file packages/domains/src/classification/evaluation/assessment.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Assessment Logic (Evaluation Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * Assessment logic для финальной сборки результата оценки классификации.
 * Отдельный слой для сборки assessment context и финального результата.
 * Экспортируется через evaluation/index.ts.
 *
 * Принципы:
 * - ✅ Pure domain — детерминированная функция, одинаковый вход → одинаковый выход
 * - ✅ No side-effects — изолирован от effects layer (audit/logging)
 * - ✅ SRP — только assessment logic, не содержит validation/rule evaluation
 * - ✅ Domain-focused — classification-специфичная логика для финальной сборки результата
 * - ✅ Immutable — все функции возвращают frozen объекты
 *
 * @note Rule evaluation в strategies/deterministic.strategy.ts, scoring в aggregation/,
 *       decision logic в policies/, context builders в strategies/
 * @note Evaluation layer не меняет rule/policy-правила:
 *       он только применяет уже переданный policy-контракт для вычисления riskLevel/label.
 */

import type { Confidence, EvaluationLevel } from '@livai/core';
import { confidence, evaluationLevel } from '@livai/core';

import type { ClassificationEvaluationResult } from './result.js';
import { CLASSIFICATION_EVALUATION_SCALE } from '../constants.js';
import {
  defaultDecisionPolicy,
  determineLabel,
  determineRiskLevel,
} from '../policies/base.policy.js';
import type { DecisionPolicy } from '../policies/base.policy.js';
import type { ClassificationContext } from '../signals/signals.js';
import type { SemanticViolation } from '../signals/violations.js';
import type { ClassificationRule, DeviceInfo } from '../strategies/rules.js';

/* ============================================================================
 * 🧩 ТИПЫ — ASSESSMENT CONTEXT TYPES
 * ============================================================================
 */

/**
 * Контекст для assessment logic
 * Содержит всю информацию, необходимую для финальной сборки assessment result
 *
 * @note Security: не сериализуется напрямую, только через {@link assembleAssessmentResultFromContext}
 *       (предотвращает leakage полей, инжектированных плагинами)
 * @note Scalability: для больших структур (1000+ rules) рекомендуется использовать summary
 *       вместо полного rule evaluation result (используется компактный RuleEvaluationSnapshot)
 *
 * @public
 */
export type AssessmentContext = Readonly<{
  /** Информация об устройстве */
  readonly device: DeviceInfo;
  /** Контекст классификации */
  readonly classificationContext: ClassificationContext;
  /** Risk score из aggregation (0-100) */
  readonly riskScore: number;
  /** Промежуточный результат rule evaluation (без финальной сборки результата). */
  readonly ruleEvaluationSnapshot: Readonly<RuleEvaluationSnapshot>;
  /** Decision policy для расчета risk level/label на финальной сборке */
  readonly decisionPolicy?: Readonly<DecisionPolicy>;
}>;

/** Минимальный промежуточный результат rule evaluation для финальной сборки в evaluation layer. */
export type RuleEvaluationSnapshot = Readonly<{
  /** Risk score из aggregation (0-100), зафиксированный на этапе strategy. */
  readonly riskScore: number;
  /** Сработавшие классификационные правила. */
  readonly triggeredRules: readonly ClassificationRule[];
  /** Нарушения семантики сигналов, вычисленные на strategy-этапе. */
  readonly violations: readonly SemanticViolation[];
}>;

/**
 * Опции для сборки assessment context
 * @public
 */
export type BuildAssessmentContextOptions = Readonly<{
  /** Плагины для расширения assessment context (опционально) */
  readonly plugins?: readonly AssessmentContextBuilderPlugin[];
  /** Decision policy для финальной сборки результата (опционально, по умолчанию default). */
  readonly decisionPolicy?: Readonly<DecisionPolicy>;
}>;

/**
 * Плагин для расширения assessment context
 *
 * @contract Плагины ОБЯЗАНЫ возвращать полностью immutable объекты.
 *           {@link Object.freeze} применяется только на верхнем уровне (shallow freeze),
 *           плагин должен обеспечить immutability всех вложенных структур.
 * @note Security: плагины могут инжектировать произвольные поля (безопасно,
 *       контекст не сериализуется напрямую, см. {@link AssessmentContext})
 * @note Trust boundary: для внешних (не trusted) плагинов в adapter/orchestrator слое
 *       рекомендуется валидация допустимых полей до передачи в domain-layer.
 *
 * @public
 */
export type AssessmentContextBuilderPlugin = Readonly<{
  /** Расширяет assessment context */
  readonly extendAssessmentContext?: (
    context: AssessmentContext,
    classificationContext: ClassificationContext,
  ) => Readonly<AssessmentContext>;
}>;

/* ============================================================================
 * 🔧 PRIVATE HELPERS — CONTEXT BUILDING (SRP: отдельная ответственность)
 * ============================================================================
 */

/**
 * Собирает assessment context из deviceInfo, context, riskScore и rule evaluation snapshot
 * @internal
 */
function buildAssessmentContext(
  deviceInfo: Readonly<DeviceInfo>, // Информация об устройстве
  context: Readonly<ClassificationContext>, // Контекст классификации
  riskScore: number, // Risk score из aggregation (0-100)
  ruleEvaluationSnapshot: Readonly<RuleEvaluationSnapshot>, // Промежуточный результат rule evaluation
  decisionPolicy?: Readonly<DecisionPolicy>, // Decision policy для финальной сборки
): Readonly<AssessmentContext> { // Assessment context
  const assessmentContext: AssessmentContext = {
    device: deviceInfo,
    classificationContext: context,
    riskScore,
    ruleEvaluationSnapshot,
    ...(decisionPolicy !== undefined && { decisionPolicy }),
  };

  return Object.freeze(assessmentContext);
}

const CONFIDENCE_CONSTANTS = Object.freeze(
  {
    BASE_CONFIDENCE: 0.5,
    MAX_SCORE_CONTRIBUTION: 0.3,
    MAX_RULES_CONTRIBUTION: 0.3,
    RULE_CONTRIBUTION: 0.1,
    MAX_ENTROPY_CONTRIBUTION: 0.2,
    MAX_VIOLATIONS_PENALTY: 0.4,
    VIOLATION_PENALTY: 0.05,
    MIN_CONFIDENCE: 0.1,
    FALLBACK_CONFIDENCE: 0.1,
    SCORE_BUCKET_SIZE: 25,
  } as const,
);

function collectBooleanSignals(signals: ClassificationContext['signals']): readonly boolean[] {
  if (signals === undefined) {
    return [];
  }
  return [
    ...(signals.isVpn !== undefined ? [signals.isVpn] : []),
    ...(signals.isTor !== undefined ? [signals.isTor] : []),
    ...(signals.isProxy !== undefined ? [signals.isProxy] : []),
  ];
}

function normalizeScoreToBucket(score: number): number {
  return Math.floor(score / CONFIDENCE_CONSTANTS.SCORE_BUCKET_SIZE);
}

function collectNumericSignals(signals: ClassificationContext['signals']): readonly number[] {
  if (signals === undefined) {
    return [];
  }
  return Object.freeze([
    ...(signals.reputationScore !== undefined && Number.isFinite(signals.reputationScore)
      ? [normalizeScoreToBucket(signals.reputationScore)]
      : []),
    ...(signals.velocityScore !== undefined && Number.isFinite(signals.velocityScore)
      ? [normalizeScoreToBucket(signals.velocityScore)]
      : []),
  ]);
}

function calculateFrequencies(values: readonly (boolean | number)[]): ReadonlyMap<string, number> {
  type FrequencyObject = Readonly<{ readonly [key: string]: number; }>;
  const frequencyObject = values.reduce<FrequencyObject>((acc, value) => {
    const key = String(value);
    const current = acc[key] ?? 0;
    return Object.freeze({
      ...acc,
      [key]: current + 1,
    });
  }, Object.freeze({}));
  return Object.freeze(new Map<string, number>(Object.entries(frequencyObject)));
}

function calculateSignalsEntropy(signals: ClassificationContext['signals']): number {
  if (signals === undefined) {
    return 0;
  }
  const values = Object.freeze([
    ...collectBooleanSignals(signals),
    ...collectNumericSignals(signals),
  ]);
  if (values.length <= 1) {
    return 0;
  }
  const frequencies = calculateFrequencies(values);
  const entropy = Array.from(frequencies.values()).reduce((acc, count) => {
    const probability = count / values.length;
    return probability > 0 ? acc - probability * Math.log2(probability) : acc;
  }, 0);
  const maxEntropy = Math.log2(values.length);
  return maxEntropy > 0 ? Math.max(0, Math.min(1, entropy / maxEntropy)) : 0;
}

function calculateEvaluationLevelFromRiskScore(
  riskScore: number,
): EvaluationLevel<'classification'> {
  const clampedScore = Math.max(0, Math.min(100, Math.round(riskScore)));
  const levelResult = evaluationLevel.create(clampedScore, CLASSIFICATION_EVALUATION_SCALE);
  if (!levelResult.ok) {
    const fallbackResult = evaluationLevel.create(0, CLASSIFICATION_EVALUATION_SCALE);
    if (!fallbackResult.ok) {
      // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации scale/evaluation level.
      throw new Error(`Failed to create evaluation level: ${JSON.stringify(levelResult.reason)}`);
    }
    return fallbackResult.value;
  }
  return levelResult.value;
}

function calculateConfidence(
  violations: readonly SemanticViolation[],
  riskScore: number,
  triggeredRules: readonly ClassificationRule[],
  signals: ClassificationContext['signals'],
): Confidence<'classification'> {
  const scoreContribution = riskScore > 0
    ? Math.min(CONFIDENCE_CONSTANTS.MAX_SCORE_CONTRIBUTION, riskScore / 100)
    : 0;
  const rulesContribution = triggeredRules.length > 0
    ? Math.min(
      CONFIDENCE_CONSTANTS.MAX_RULES_CONTRIBUTION,
      triggeredRules.length * CONFIDENCE_CONSTANTS.RULE_CONTRIBUTION,
    )
    : 0;
  const entropyContribution = ((): number => {
    const entropy = calculateSignalsEntropy(signals);
    return entropy > 0
      ? Math.min(
        CONFIDENCE_CONSTANTS.MAX_ENTROPY_CONTRIBUTION,
        entropy * CONFIDENCE_CONSTANTS.MAX_ENTROPY_CONTRIBUTION,
      )
      : 0;
  })();
  const degradeViolations = violations.filter((v) => v.severity === 'degrade');
  const violationsPenalty = degradeViolations.length > 0
    ? Math.min(
      CONFIDENCE_CONSTANTS.MAX_VIOLATIONS_PENALTY,
      degradeViolations.length * CONFIDENCE_CONSTANTS.VIOLATION_PENALTY,
    )
    : 0;
  const conf = Math.max(
    CONFIDENCE_CONSTANTS.MIN_CONFIDENCE,
    CONFIDENCE_CONSTANTS.BASE_CONFIDENCE
      + scoreContribution
      + rulesContribution
      + entropyContribution
      - violationsPenalty,
  );
  const confidenceResult = confidence.create(Math.max(0, Math.min(1, conf)), 'classification');
  if (!confidenceResult.ok) {
    const fallbackResult = confidence.create(
      CONFIDENCE_CONSTANTS.FALLBACK_CONFIDENCE,
      'classification',
    );
    if (!fallbackResult.ok) {
      // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации confidence.
      throw new Error(`Failed to create confidence: ${JSON.stringify(confidenceResult.reason)}`);
    }
    return fallbackResult.value;
  }
  return confidenceResult.value;
}

function buildExplainabilityContext(
  classificationContext: Readonly<ClassificationContext>,
): Readonly<ClassificationContext> | undefined {
  const explainabilityFields: {
    geo?: ClassificationContext['geo'];
    signals?: ClassificationContext['signals'];
  } = {
    ...(classificationContext.geo !== undefined && { geo: classificationContext.geo }),
    ...(classificationContext.signals !== undefined && { signals: classificationContext.signals }),
  };
  return Object.keys(explainabilityFields).length > 0
    ? Object.freeze(explainabilityFields) as Readonly<ClassificationContext>
    : undefined;
}

/**
 * Применяет плагины для расширения assessment context
 * @note Использует reduce для детерминированного порядка, freeze один раз после reduce
 * @note Контракт детерминизма: одинаковый input + одинаковый ordered plugins => одинаковый output.
 *       Разный порядок plugins может менять результат (это ожидаемое поведение extensibility).
 * @note Оптимизация: не создает новый объект для noop расширений (plugin вернул тот же reference)
 * @note Оптимизация: не freeze повторно, если plugins пустой и baseContext уже frozen
 * @note {@link Object.freeze} только на верхнем уровне, плагины обязаны обеспечить полную immutability
 * @internal
 */
function applyAssessmentPlugins(
  baseContext: Readonly<AssessmentContext>, // Базовый контекст
  plugins: readonly AssessmentContextBuilderPlugin[], // Плагины для расширения контекста
  classificationContext: ClassificationContext, // Контекст классификации
): Readonly<AssessmentContext> { // Расширенный контекст
  const result = plugins.reduce(
    (ctx, plugin) => {
      if (plugin.extendAssessmentContext) {
        const extended = plugin.extendAssessmentContext(ctx, classificationContext);
        // Оптимизация: не создаем новый объект для noop расширений
        if (extended === ctx) {
          return ctx;
        }
        return Object.freeze(extended);
      }
      return ctx;
    },
    baseContext,
  );

  // Оптимизация: не freeze повторно, если plugins пустой и baseContext уже frozen
  return result === baseContext ? baseContext : Object.freeze(result);
}

/* ============================================================================
 * 🔧 PRIVATE HELPERS — RESULT ASSEMBLY (SRP: отдельная ответственность)
 * ============================================================================
 */

/**
 * Собирает финальный assessment result из assessment context
 * @note Decision слой вычисляется здесь: riskScore -> riskLevel -> label (через policies/base.policy)
 * @note evaluationLevel/confidence/scale вычисляются здесь из snapshot и riskScore (evaluation-layer ответственность)
 * @note Слой не пересчитывает rule-результаты и не меняет policy-правила,
 *       а только применяет decision policy к уже собранному assessment context.
 *
 * @internal
 */
function assembleAssessmentResult(
  assessmentContext: Readonly<AssessmentContext>, // Assessment context
): Readonly<ClassificationEvaluationResult> { // Финальный assessment result
  const decisionPolicy = assessmentContext.decisionPolicy ?? defaultDecisionPolicy;
  const evaluationLevelValue = calculateEvaluationLevelFromRiskScore(assessmentContext.riskScore);
  const confidenceValue = calculateConfidence(
    assessmentContext.ruleEvaluationSnapshot.violations,
    assessmentContext.riskScore,
    assessmentContext.ruleEvaluationSnapshot.triggeredRules,
    assessmentContext.classificationContext.signals,
  );
  const riskLevel = determineRiskLevel(
    assessmentContext.riskScore,
    decisionPolicy.thresholds,
  );
  const triggeredRuleCount = assessmentContext.ruleEvaluationSnapshot.triggeredRules.length;
  const resolvedLabel = determineLabel(
    riskLevel,
    triggeredRuleCount,
    assessmentContext.classificationContext.signals,
    decisionPolicy,
  );
  const explainabilityContext = buildExplainabilityContext(assessmentContext.classificationContext);
  const result: ClassificationEvaluationResult = {
    evaluationLevel: evaluationLevelValue,
    confidence: confidenceValue,
    label: resolvedLabel,
    scale: CLASSIFICATION_EVALUATION_SCALE,
    ...(triggeredRuleCount > 0 && {
      usedSignals: [] as readonly (keyof NonNullable<ClassificationContext['signals']>)[],
    }),
    ...(explainabilityContext !== undefined && {
      context: explainabilityContext,
    }),
  };

  return Object.freeze(result);
}

/* ============================================================================
 * 🎯 ГЛАВНЫЙ API
 * ============================================================================
 */

/**
 * Собирает assessment context из deviceInfo, context, riskScore и rule evaluation snapshot
 * Применяет плагины для расширения контекста
 * @public
 */
export function buildAssessmentContextWithPlugins(
  deviceInfo: Readonly<DeviceInfo>, // Информация об устройстве
  context: Readonly<ClassificationContext>, // Контекст классификации
  riskScore: number, // Risk score из aggregation (0-100)
  ruleEvaluationSnapshot: Readonly<RuleEvaluationSnapshot>, // Промежуточный результат rule evaluation
  options: Readonly<BuildAssessmentContextOptions> = {}, // Опции для сборки контекста (плагины)
): Readonly<AssessmentContext> { // Assessment context
  const baseContext = buildAssessmentContext(
    deviceInfo,
    context,
    riskScore,
    ruleEvaluationSnapshot,
    options.decisionPolicy,
  );

  const plugins = options.plugins ?? [];
  return applyAssessmentPlugins(baseContext, plugins, context);
}

/**
 * Собирает финальный assessment result из assessment context
 * @public
 */
export function assembleAssessmentResultFromContext(
  assessmentContext: Readonly<AssessmentContext>, // Assessment context
): Readonly<ClassificationEvaluationResult> { // Финальный assessment result
  return assembleAssessmentResult(assessmentContext);
}
