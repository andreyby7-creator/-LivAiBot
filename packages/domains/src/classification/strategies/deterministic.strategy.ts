/**
 * @file packages/domains/src/classification/strategies/deterministic.strategy.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Deterministic Strategy (Pure Domain Logic)
 * ============================================================================
 * Архитектурная роль:
 * Deterministic strategy-слой для оценки классификации через локальные правила.
 * Использует generic rule-engine из @livai/core, формирует минимальный rule snapshot
 * и делегирует финальную сборку результата в evaluation layer.
 * Принципы:
 * - ✅ Pure domain engine — детерминированная функция, одинаковый вход → одинаковый выход
 * - ✅ No side-effects — изолирован от effects layer (audit/logging), не мутирует внешнее состояние
 * - ✅ Testable — легко тестируется без моков внешних зависимостей
 * - ✅ Domain-focused — стратегия локальных правил без IO и инфраструктурных зависимостей
 * - ✅ SRP — валидация, context building, rule evaluation и сборка промежуточного результата разделены
 * Масштабируемость: мемоизация genericRules, единый проход через evaluator.evaluateAll,
 * фильтрация по minPriority, детерминированный порядок plugin-расширений.
 * @note Scoring приходит из aggregation/, decision label рассчитывается через policies/
 *       (`determineRiskLevel` / `determineLabel`), финальная сборка выполняется в evaluation/.
 * Актуальная архитектура:
 *   Strategy → validation + ruleContext + triggeredRules + minimal snapshot
 *   Policies → riskLevel/label decision
 *   Evaluation layer → evaluationLevel/confidence/label/scale и финальная сборка результата
 * @note Публичный API `evaluateClassificationRules` сохранен; добавлен
 *       `evaluateClassificationRulesSnapshot` для composition-layer без дублирования финальной сборки.
 */

import type { Rule } from '@livai/core';
import { evaluator } from '@livai/core';

import type { ClassificationRulesConfig } from './config.js';
import { getClassificationRulesConfig } from './config.js';
import type { ClassificationRule, DeviceInfo, RuleEvaluationContext } from './rules.js';
import { allRules } from './rules.js';
import { validateClassificationSemantics } from './validation.js';
import { buildRuleContext } from '../context/context-builders.js';
import type {
  AssessmentContextBuilderPlugin,
  RuleEvaluationSnapshot,
} from '../evaluation/assessment.js';
import {
  assembleAssessmentResultFromContext,
  buildAssessmentContextWithPlugins,
} from '../evaluation/assessment.js';
import type { ClassificationEvaluationResult } from '../evaluation/result.js';
import { defaultDecisionPolicy } from '../policies/base.policy.js';
import type { DecisionPolicy } from '../policies/base.policy.js';
import type { ClassificationContext } from '../signals/signals.js';
import type { SemanticViolation } from '../signals/violations.js';

/* ============================================================================
 * 🔧 МЕМОИЗАЦИЯ GENERIC RULES (Deterministic Behavior)
 * ============================================================================
 */

/**
 * Преобразует classification rules в generic Rule для evaluator
 * Мемоизируется один раз на уровне модуля для избежания лишних аллокаций
 * @internal
 */
const genericRules: readonly Rule<
  (ctx: RuleEvaluationContext) => boolean,
  ClassificationRule
>[] = Object.freeze(
  allRules.map((rule): Rule<
    (ctx: RuleEvaluationContext) => boolean,
    ClassificationRule
  > => ({
    predicate: rule.evaluate,
    result: rule.id,
    ...(rule.priority !== undefined && { priority: rule.priority }),
  })),
);

/* ============================================================================
 * 🔧 PRIVATE HELPERS — VALIDATION (SRP: отдельная ответственность)
 * ============================================================================
 */

/**
 * Проверяет violations и выбрасывает ошибку, если найдены блокирующие
 * Принимает уже вычисленные violations для избежания двойного вызова validateClassificationSemantics
 * @throws {Error} Если найдены блокирующие violations (severity: 'block')
 * @internal
 */
function validateBlockingSignals(
  violations: readonly SemanticViolation[], // Массив violations для проверки
): void {
  const blockingViolations = violations.filter((v) =>
    v.severity === 'block'
  ) as readonly SemanticViolation[];

  if (blockingViolations.length > 0) {
    const violationMessages = blockingViolations.map((v) => {
      const metaStr = 'meta' in v && 'reason' in v.meta ? ` (${v.meta.reason})` : '';
      return `${v.code}${metaStr}: ${v.impact}`;
    }).join('; ');
    // eslint-disable-next-line fp/no-throw -- Domain validation error, must throw
    throw new Error(`Invalid classification signals: ${violationMessages}`);
  }
}

/* ============================================================================
 * 🔧 PRIVATE HELPERS — CONTEXT BUILDERS (SRP: локальные функции)
 * ============================================================================
 */

/**
 * Делает shallow freeze для RuleEvaluationContext (верхний уровень + signals, metadata)
 * @note deviceInfo не freeze глубоко (передается как Readonly<DeviceInfo>)
 * @note Deep immutability: плагины ОБЯЗАНЫ возвращать полностью immutable объекты.
 *       Если DeviceInfo содержит вложенные объекты, они должны быть immutable по контракту.
 *       Для строгой безопасности рекомендуется deepFreeze, но это дороже по производительности.
 * @internal
 */
function freezeRuleContext(
  context: RuleEvaluationContext, // Контекст для freeze
): Readonly<RuleEvaluationContext> { // Замороженный контекст
  // Freeze вложенные объекты (первый уровень вложенности)
  if (context.signals !== undefined) {
    Object.freeze(context.signals);
  }
  if (context.metadata !== undefined) {
    Object.freeze(context.metadata);
  }
  // Freeze верхнего уровня
  // @note: context.device не freeze глубоко (см. документацию выше)
  return Object.freeze(context);
}

/**
 * Применяет плагины для расширения rule context
 * @note Использует reduce для детерминированного порядка, freeze один раз после reduce
 * @note Оптимизация: не создает новый объект для noop расширений (plugin вернул тот же reference)
 * @note Оптимизация: не freeze повторно, если plugins пустой и baseContext уже frozen
 * @internal
 */
function applyRulePlugins(
  baseContext: Readonly<RuleEvaluationContext>, // Базовый контекст
  plugins: readonly ContextBuilderPlugin[], // Плагины для расширения контекста
  classificationContext: ClassificationContext, // Контекст классификации
): Readonly<RuleEvaluationContext> { // Расширенный контекст
  const result = plugins.reduce(
    (ctx, plugin) => {
      if (plugin.extendRuleContext) {
        const extended = plugin.extendRuleContext(ctx, classificationContext);
        // Оптимизация: не создаем новый объект для noop расширений
        if (extended === ctx) {
          return ctx;
        }
        return extended;
      }
      return ctx;
    },
    baseContext,
  );

  // Оптимизация: не freeze повторно, если plugins пустой и baseContext уже frozen
  return result === baseContext ? baseContext : freezeRuleContext(result);
}

/* ============================================================================
 * 🔧 PRIVATE HELPERS — RULE SNAPSHOT ASSEMBLY (SRP: отдельная ответственность)
 * ============================================================================
 */

/** Собирает минимальный промежуточный snapshot для финальной сборки в evaluation layer. */
function createRuleEvaluationSnapshot(
  violations: readonly SemanticViolation[],
  riskScore: number,
  triggeredRules: readonly ClassificationRule[],
): Readonly<RuleEvaluationSnapshot> {
  return Object.freeze({
    violations: Object.freeze([...violations]),
    riskScore,
    triggeredRules,
  });
}

/* ============================================================================
 * 🔧 PRIVATE HELPERS — RULE EVALUATION (SRP: отдельная ответственность)
 * ============================================================================
 */

/**
 * Оценивает правила через generic rule-engine (единый проход через evaluator.evaluateAll)
 * @internal
 */
function evaluateClassificationRulesInternal(
  ruleContext: Readonly<RuleEvaluationContext>, // Контекст для оценки правил
  minPriority: number, // Минимальный приоритет для фильтрации правил
): readonly ClassificationRule[] { // Массив сработавших правил
  const evaluationResult = evaluator.evaluateAll(genericRules, ruleContext, {
    minPriority,
  });

  if (!evaluationResult.ok) {
    return [];
  }
  const triggeredRules: readonly ClassificationRule[] = Array.isArray(evaluationResult.value)
    ? Object.freeze(
      evaluationResult.value.filter(
        (value): value is ClassificationRule => typeof value === 'string',
      ),
    )
    : typeof evaluationResult.value === 'string'
    ? Object.freeze([evaluationResult.value])
    : Object.freeze([]);

  return triggeredRules;
}

/* ============================================================================
 * 🔧 PLUGIN TYPES (Extensibility)
 * ============================================================================
 */

/**
 * Плагин для расширения контекста (опционально)
 * @note Содержит только реально используемые методы расширения контекста.
 *       Для расширения AssessmentContext используйте AssessmentContextBuilderPlugin из evaluation/assessment.ts
 * @public
 */
export type ContextBuilderPlugin = Readonly<{
  /** Расширяет rule context для rule evaluation */
  readonly extendRuleContext?: (
    context: RuleEvaluationContext,
    classificationContext: ClassificationContext,
  ) => RuleEvaluationContext;
}>;

/* ============================================================================
 * 🎯 ГЛАВНЫЙ API
 * ============================================================================
 */

/**
 * Опции для evaluateClassificationRules
 * @note Структура опций позволяет масштабировать API без breaking changes
 * @public
 */
export type EvaluateClassificationRulesOptions = Readonly<{
  /** Risk score из aggregation (0-100), используется в ruleContext.metadata и для расчета evaluationLevel/confidence */
  readonly riskScore?: number;
  /** Decision policy для расчета label (может приходить напрямую или как поле decision у composition-policy). */
  readonly policy?:
    | Readonly<DecisionPolicy>
    | Readonly<{ readonly decision?: Readonly<DecisionPolicy>; }>;
  /** Плагины для расширения контекста (опционально) */
  readonly plugins?: readonly ContextBuilderPlugin[];
  /** Плагины для расширения assessment context в evaluation layer (опционально). */
  readonly assessmentPlugins?: readonly AssessmentContextBuilderPlugin[];
  /** Конфигурация правил (опционально, по умолчанию глобальный config) */
  readonly config?: Readonly<ClassificationRulesConfig>;
}>;

function isDecisionPolicy(
  policy: NonNullable<EvaluateClassificationRulesOptions['policy']>,
): policy is Readonly<DecisionPolicy> {
  return 'thresholds' in policy;
}

function resolveDecisionPolicy(
  policy: EvaluateClassificationRulesOptions['policy'],
): Readonly<DecisionPolicy> {
  if (policy === undefined) {
    return defaultDecisionPolicy;
  }
  if (isDecisionPolicy(policy)) {
    return policy;
  }
  return policy.decision ?? defaultDecisionPolicy;
}

/** Оценивает rules и возвращает минимальный промежуточный snapshot для evaluation layer. */
export function evaluateClassificationRulesSnapshot(
  deviceInfo: Readonly<DeviceInfo>,
  context: Readonly<ClassificationContext> = {},
  options: Readonly<EvaluateClassificationRulesOptions> = {},
): Readonly<RuleEvaluationSnapshot> {
  const violations = validateClassificationSemantics(context.signals);
  validateBlockingSignals(violations);
  const riskScore = options.riskScore ?? 0;
  const plugins = options.plugins ?? [];
  const config = options.config ?? getClassificationRulesConfig();
  const baseRuleContext = buildRuleContext({ device: deviceInfo, context, riskScore });
  const ruleContext = applyRulePlugins(baseRuleContext.ruleContext, plugins, context);
  const minPriority = config.criticalRulePriorityThreshold;
  const triggeredRules = evaluateClassificationRulesInternal(ruleContext, minPriority);
  return createRuleEvaluationSnapshot(violations, riskScore, triggeredRules);
}

/**
 * Оценивает классификацию через локальные правила (pure domain engine)
 * Pipeline: validate → riskScore (из aggregation) → ruleContext → triggeredRules → snapshot → assessmentContext → assembleResult
 * @throws {Error} Если externalSignals невалидны (blocking violations)
 * @note Config и riskScore (из aggregation) injectable через options (по умолчанию глобальный config)
 * @note Финальная сборка через assessment logic из evaluation/assessment.ts
 * @note API contract: функция может выбросить исключение при blocking violations.
 *       Для обработки ошибок рекомендуется использовать try-catch или Result type wrapper.
 * @public
 */
export function evaluateClassificationRules(
  deviceInfo: Readonly<DeviceInfo>, // Информация об устройстве
  context: Readonly<ClassificationContext> = {}, // Контекст для оценки классификации
  options: Readonly<EvaluateClassificationRulesOptions> = {}, // Опции для rule evaluation (riskScore, policy, plugins, config)
): Readonly<ClassificationEvaluationResult> { // Результат оценки классификации с evaluationLevel, confidence, label, scale
  const ruleEvaluationSnapshot = evaluateClassificationRulesSnapshot(deviceInfo, context, options);
  const decisionPolicy = resolveDecisionPolicy(options.policy);
  const assessmentPlugins = options.assessmentPlugins ?? [];

  // Финальная сборка делегирована в evaluation layer, strategy возвращает только snapshot фактов.
  const assessmentContext = buildAssessmentContextWithPlugins(
    deviceInfo,
    context,
    ruleEvaluationSnapshot.riskScore,
    ruleEvaluationSnapshot,
    {
      plugins: assessmentPlugins,
      decisionPolicy,
    },
  );

  return assembleAssessmentResultFromContext(assessmentContext);
}
