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
 *       decision logic в policies/ (будет интегрирована), context builders в strategies/
 */

import type { ClassificationEvaluationResult } from './result.js';
import type { ClassificationContext } from '../signals/signals.js';
import type { DeviceInfo } from '../strategies/rules.js';

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
 *       вместо полного ruleEvaluationResult
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
  /** Результат rule evaluation */
  readonly ruleEvaluationResult: Readonly<ClassificationEvaluationResult>;
}>;

/**
 * Опции для сборки assessment context
 * @public
 */
export type BuildAssessmentContextOptions = Readonly<{
  /** Плагины для расширения assessment context (опционально) */
  readonly plugins?: readonly AssessmentContextBuilderPlugin[];
}>;

/**
 * Плагин для расширения assessment context
 *
 * @contract Плагины ОБЯЗАНЫ возвращать полностью immutable объекты.
 *           {@link Object.freeze} применяется только на верхнем уровне (shallow freeze),
 *           плагин должен обеспечить immutability всех вложенных структур.
 * @note Security: плагины могут инжектировать произвольные поля (безопасно,
 *       контекст не сериализуется напрямую, см. {@link AssessmentContext})
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
 * Собирает assessment context из deviceInfo, context, riskScore и rule evaluation result
 * @internal
 */
function buildAssessmentContext(
  deviceInfo: Readonly<DeviceInfo>, // Информация об устройстве
  context: Readonly<ClassificationContext>, // Контекст классификации
  riskScore: number, // Risk score из aggregation (0-100)
  ruleEvaluationResult: Readonly<ClassificationEvaluationResult>, // Результат rule evaluation
): Readonly<AssessmentContext> { // Assessment context
  const assessmentContext: AssessmentContext = {
    device: deviceInfo,
    classificationContext: context,
    riskScore,
    ruleEvaluationResult,
  };

  return Object.freeze(assessmentContext);
}

/**
 * Применяет плагины для расширения assessment context
 * @note Использует reduce для детерминированного порядка, freeze один раз после reduce
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
 * @note После policies/ будет использоваться determineRiskLevel и determineLabel
 * @note Сейчас explicit assembly (pass-through), структура готова для интеграции decision logic
 *
 * @internal
 */
function assembleAssessmentResult(
  assessmentContext: Readonly<AssessmentContext>, // Assessment context
): Readonly<ClassificationEvaluationResult> { // Финальный assessment result
  const result: ClassificationEvaluationResult = {
    evaluationLevel: assessmentContext.ruleEvaluationResult.evaluationLevel,
    confidence: assessmentContext.ruleEvaluationResult.confidence,
    label: assessmentContext.ruleEvaluationResult.label,
    scale: assessmentContext.ruleEvaluationResult.scale,
    ...(assessmentContext.ruleEvaluationResult.usedSignals !== undefined && {
      usedSignals: assessmentContext.ruleEvaluationResult.usedSignals,
    }),
    ...(assessmentContext.ruleEvaluationResult.context !== undefined && {
      context: assessmentContext.ruleEvaluationResult.context,
    }),
  };

  return Object.freeze(result);
}

/* ============================================================================
 * 🎯 ГЛАВНЫЙ API
 * ============================================================================
 */

/**
 * Собирает assessment context из deviceInfo, context, riskScore и rule evaluation result
 * Применяет плагины для расширения контекста
 * @public
 */
export function buildAssessmentContextWithPlugins(
  deviceInfo: Readonly<DeviceInfo>, // Информация об устройстве
  context: Readonly<ClassificationContext>, // Контекст классификации
  riskScore: number, // Risk score из aggregation (0-100)
  ruleEvaluationResult: Readonly<ClassificationEvaluationResult>, // Результат rule evaluation
  options: Readonly<BuildAssessmentContextOptions> = {}, // Опции для сборки контекста (плагины)
): Readonly<AssessmentContext> { // Assessment context
  const baseContext = buildAssessmentContext(
    deviceInfo,
    context,
    riskScore,
    ruleEvaluationResult,
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
