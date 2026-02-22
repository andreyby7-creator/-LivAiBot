/**
 * @file packages/domains/src/classification/strategies/assessment.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Assessment (Composition Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * Composition layer для orchestration оценки классификации. Объединяет scoring, rule engine и decision policy.
 * Использует deterministic.strategy.ts для rule evaluation.
 *
 * Принципы:
 * - ✅ Composition — объединяет подсистемы (scoring, rules, decision)
 * - ✅ Pure domain — детерминированная функция, одинаковый вход → одинаковый выход
 * - ✅ No side-effects — изолирован от effects layer (audit/logging в orchestrator)
 * - ✅ SRP — только orchestration, не содержит validation/error handling/context building
 * - ✅ Domain-focused — classification-специфичная логика
 *
 * @note Scoring должен быть в aggregation/ (calculateRiskScore, defaultRiskWeights)
 * @note Decision должен быть в policies/ (defaultDecisionPolicy, determineRiskLevel, determineLabel)
 * @note Validation и rule snapshot выполняются в deterministic.strategy.ts через evaluateClassificationRulesSnapshot
 * @note Context builders находятся в deterministic.strategy.ts
 * @note Fallback/Fail-safe decision logic не реализуется в orchestration-слое:
 *       policy только проксируется в evaluation/policies, где и применяются default/invariant правила.
 * @note Audit/logging должен быть в orchestrator layer, не здесь
 */

import type { ClassificationRulesConfig } from './config.js';
import { getClassificationRulesConfig } from './config.js';
import type { ContextBuilderPlugin as DeterministicContextBuilderPlugin } from './deterministic.strategy.js';
import { evaluateClassificationRulesSnapshot } from './deterministic.strategy.js';
import type { DeviceInfo } from './rules.js';
import type { RiskWeights, ScoringContext } from '../aggregation/scoring.js';
import { calculateRiskScore, defaultRiskWeights } from '../aggregation/scoring.js';
import {
  assembleAssessmentResultFromContext,
  buildAssessmentContextWithPlugins,
} from '../evaluation/assessment.js';
import type { AssessmentContextBuilderPlugin } from '../evaluation/assessment.js';
import type { ClassificationEvaluationResult } from '../evaluation/result.js';
import { defaultDecisionPolicy } from '../policies/base.policy.js';
import type { DecisionPolicy } from '../policies/base.policy.js';
import type { ClassificationContext } from '../signals/signals.js';
import type { SemanticViolation } from '../signals/violations.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION ASSESSMENT TYPES
 * ============================================================================
 */

/**
 * Плагин для расширения контекста (опционально)
 * Расширяет DeterministicContextBuilderPlugin для поддержки scoring и assessment контекстов
 *
 * @contract Плагины должны быть pure functions:
 *   - Не использовать внешнее состояние (глобальные переменные, модульные переменные, IO)
 *   - Запрещено мутировать context (контексты заморожены через Object.freeze)
 *   - Детерминированные: одинаковый вход → одинаковый выход
 *   - Без side-effects (не вызывать API, не логировать, не изменять внешнее состояние)
 *
 * @note Versioning для защиты от breaking changes в будущем
 * @note Future: async pipeline для rules при очень высоких нагрузках
 *
 * @public
 */
export type ContextBuilderPlugin =
  & DeterministicContextBuilderPlugin
  & AssessmentContextBuilderPlugin
  & Readonly<{
    /** Версия API плагина (для защиты от breaking changes) */
    readonly version?: 1;
    /** Расширяет scoring context (для использования в aggregation/) */
    readonly extendScoringContext?: (
      context: ScoringContext,
      classificationContext: ClassificationContext,
    ) => Readonly<ScoringContext>;
  }>;

/* ============================================================================
 * 🧩 ТИПЫ — COMPOSITION LAYER (POLICY & RESULT)
 * ============================================================================
 */

/**
 * Политика для classification assessment
 * @note Scoring weights должны быть в aggregation/, decision policy в policies/
 * @note Decision policy строго типизирована через `DecisionPolicy` из policies/
 * @public
 */
export type ClassificationPolicy = Readonly<{
  /** Веса для scoring (из aggregation/) */
  readonly weights?: Readonly<RiskWeights>;
  /** Политика принятия решений (должна быть в policies/) */
  readonly decision?: Readonly<DecisionPolicy>;
}>;

/**
 * Результат assessment с возможными ошибками валидации
 * @note Domain-pure альтернатива throw для typed error handling
 * @public
 */
export type AssessmentResult = Readonly<{
  readonly ok: boolean;
  readonly result?: Readonly<ClassificationEvaluationResult>;
  readonly violations?: readonly SemanticViolation[];
}>;

/* ============================================================================
 * 🔧 PRIVATE HELPERS — SCORING (SRP: отдельная ответственность)
 * ============================================================================
 */

/**
 * Создает shallow clone и замораживает контекст для защиты от побочных эффектов в плагинах
 * @internal
 */
function shallowCloneContext<T extends Readonly<Record<string, unknown>>>(
  context: T,
): Readonly<T> {
  return { ...context };
}

function freezeContext<T extends Readonly<Record<string, unknown>>>(context: T): Readonly<T> {
  return Object.freeze(context);
}

/**
 * Применяет плагины extendScoringContext
 * @note Оптимизация: не создает новый объект для noop расширений (plugin вернул тот же reference)
 * @note Оптимизация: не freeze повторно, если plugins пустой и scoringContext уже frozen
 * @internal
 */
function applyScoringContextPlugins(
  scoringContext: Readonly<ScoringContext>,
  plugins: readonly ContextBuilderPlugin[],
  classificationContext: Readonly<ClassificationContext>,
): Readonly<ScoringContext> {
  const result = plugins.reduce(
    (ctx, plugin) => {
      if (plugin.extendScoringContext) {
        const extended = plugin.extendScoringContext(ctx, classificationContext);
        // Оптимизация: не создаем новый объект для noop расширений
        if (extended === ctx) {
          return ctx;
        }
        return extended;
      }
      return ctx;
    },
    scoringContext,
  );

  // Оптимизация: не freeze повторно, если plugins пустой и scoringContext уже frozen
  return result === scoringContext ? scoringContext : freezeContext(result);
}

/**
 * Строит scoring context из deviceInfo и classification context
 * @note config передается явно, контексты клонируются и замораживаются для immutability
 * @internal
 */
function buildScoringContext(
  deviceInfo: Readonly<DeviceInfo>,
  context: Readonly<ClassificationContext>,
  config: Readonly<ClassificationRulesConfig>,
  plugins: readonly ContextBuilderPlugin[] = [],
): Readonly<ScoringContext> {
  const clonedContext = shallowCloneContext(context);
  const clonedDeviceInfo = shallowCloneContext(deviceInfo);

  const baseScoringContext: ScoringContext = {
    device: clonedDeviceInfo,
    ...(clonedContext.geo !== undefined && { geo: clonedContext.geo }),
    ...(clonedContext.ip !== undefined && { ip: clonedContext.ip }),
    ...(clonedContext.signals !== undefined && { signals: clonedContext.signals }),
    config: { highRiskCountries: config.highRiskCountries },
  };

  const frozenBaseContext = freezeContext(baseScoringContext);
  const extendedContext = applyScoringContextPlugins(frozenBaseContext, plugins, context);

  return freezeContext(extendedContext);
}

/* ============================================================================
 * 🎯 ГЛАВНЫЙ API
 * ============================================================================
 */

/**
 * Оценивает классификацию на основе device info и контекста (composition layer)
 * Pipeline: scoring → rule snapshot (strategy) → assessment context (evaluation) → assemble result
 *
 * @throws {Error} Пробрасывает ошибки из evaluateClassificationRules
 *
 * @note Config передается явно (избегает fallback на глобальный state)
 * @note Контексты клонируются и замораживаются для immutability перед передачей в плагины
 * @note Плагины должны быть pure functions: без внешнего состояния, без мутаций context
 * @note Future: async pipeline/lazy evaluation для rules, AssessmentContextBuilderPlugin через опции (после policies/)
 *
 * @public
 */
export function assessClassification(
  deviceInfo: Readonly<DeviceInfo>, // Информация об устройстве
  context: Readonly<ClassificationContext> = {}, // Контекст для оценки классификации
  policy: Readonly<ClassificationPolicy> = {}, // Политика оценки классификации (опционально)
  plugins: readonly ContextBuilderPlugin[] = [], // Плагины для расширения контекста (опционально)
  config: Readonly<ClassificationRulesConfig> = getClassificationRulesConfig(), // Конфигурация правил (по умолчанию глобальный state, но передается явно для избежания fallback)
): Readonly<ClassificationEvaluationResult> { // Результат оценки классификации с evaluationLevel, confidence, label, scale
  // 1. Scoring (из aggregation/)
  const weights: Readonly<RiskWeights> = policy.weights ?? defaultRiskWeights;
  const scoringContext = buildScoringContext(deviceInfo, context, config, plugins);
  const riskScore = calculateRiskScore(scoringContext, weights);

  // 2. Rule evaluation (из deterministic.strategy.ts)
  // Выполняет: validation → rule context building → rule evaluation → snapshot facts
  const clonedDeviceInfo = shallowCloneContext(deviceInfo);
  const clonedContext = shallowCloneContext(context);
  const frozenDeviceInfo = freezeContext(clonedDeviceInfo);
  const frozenContext = freezeContext(clonedContext);
  const ruleEvaluationSnapshot = evaluateClassificationRulesSnapshot(
    frozenDeviceInfo,
    frozenContext,
    {
      riskScore,
      policy,
      plugins,
      config,
    },
  );

  // 3. Decision (из policies/)
  // Граница ответственности: orchestration-слой не содержит decision-правил,
  // а только передает policy в evaluation/policies для fail-safe расчета.
  const decisionPolicy: Readonly<DecisionPolicy> = policy.decision ?? defaultDecisionPolicy;

  // 4. Assemble final result через assessment logic из evaluation/
  const assessmentContext = buildAssessmentContextWithPlugins(
    frozenDeviceInfo,
    frozenContext,
    riskScore,
    ruleEvaluationSnapshot,
    { plugins, decisionPolicy },
  );

  return assembleAssessmentResultFromContext(assessmentContext);
}
