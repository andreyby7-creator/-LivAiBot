/**
 * @file packages/domains/src/classification/strategies/deterministic.strategy.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Deterministic Strategy (Pure Domain Logic)
 * ============================================================================
 *
 * Архитектурная роль:
 * Orchestration layer для оценки классификации через локальные правила. Использует generic rule-engine из @livai/core.
 *
 * Принципы:
 * - ✅ Pure domain engine — детерминированная функция, одинаковый вход → одинаковый выход
 * - ✅ No side-effects — изолирован от effects layer (audit/logging), не мутирует внешнее состояние
 * - ✅ Testable — легко тестируется без моков внешних зависимостей
 * - ✅ Domain-focused — содержит только orchestration логику оценки классификации
 * - ✅ SRP — валидация, контекст-билдеры и rule evaluation разделены на чистые функции
 *
 * Масштабируемость: мемоизация genericRules, единый проход через evaluator.evaluateAll,
 * фильтрация по minPriority, защита от мутаций через Readonly/reduce
 * @note Scoring в aggregation/, decision и assessment в policies/ и evaluation/
 *
 * @technical-debt TRANSITIONAL ARCHITECTURE:
 *   Strategy layer сейчас содержит evaluation logic (calculateEvaluationLevelFromRiskScore,
 *   calculateConfidence, assembleClassificationResult), которая должна быть в evaluation layer.
 *   Правильная архитектура:
 *     Strategy → only triggeredRules + violations + riskScore
 *     Evaluation layer → evaluationLevel + confidence + label
 *     Assessment layer → final result assembly
 *   После реализации policies/ эта логика будет перенесена в evaluation/assessment.ts.
 */

import type { Confidence, EvaluationLevel, Rule } from '@livai/core';
import { confidence, evaluationLevel, evaluator } from '@livai/core';

import { CLASSIFICATION_EVALUATION_SCALE } from '../constants.js';
import { classificationLabel } from '../labels.js';
import type { ClassificationRulesConfig } from './config.js';
import { getClassificationRulesConfig } from './config.js';
import type { ClassificationRule, DeviceInfo, RuleEvaluationContext } from './rules.js';
import { allRules } from './rules.js';
import { validateClassificationSemantics } from './validation.js';
import { buildRuleContext } from '../context/context-builders.js';
import {
  assembleAssessmentResultFromContext,
  buildAssessmentContextWithPlugins,
} from '../evaluation/assessment.js';
import type { ClassificationEvaluationResult } from '../evaluation/result.js';
import type { ClassificationContext, ClassificationSignals } from '../signals/signals.js';
import type { SemanticViolation } from '../signals/violations.js';

/* ============================================================================
 * 🔧 КОНСТАНТЫ — CONFIDENCE CALCULATION
 * ============================================================================
 */

/**
 * Константы для расчета confidence
 * @internal
 */
const CONFIDENCE_CONSTANTS = Object.freeze(
  {
    /** Базовый confidence (неопределенность) */
    BASE_CONFIDENCE: 0.5,
    /** Максимальный вклад от riskScore */
    MAX_SCORE_CONTRIBUTION: 0.3,
    /** Максимальный вклад от triggeredRules */
    MAX_RULES_CONTRIBUTION: 0.3,
    /** Вклад одного правила */
    RULE_CONTRIBUTION: 0.1,
    /** Максимальный вклад от entropy сигналов */
    MAX_ENTROPY_CONTRIBUTION: 0.2,
    /** Максимальный штраф от violations */
    MAX_VIOLATIONS_PENALTY: 0.4,
    /** Штраф за одно degrade violation */
    VIOLATION_PENALTY: 0.05,
    /** Минимальный confidence */
    MIN_CONFIDENCE: 0.1,
    /** Fallback confidence при ошибке создания */
    FALLBACK_CONFIDENCE: 0.1,
    /** Размер bucket для нормализации числовых сигналов (0-100 → 0-4) */
    SCORE_BUCKET_SIZE: 25,
  } as const,
);

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
 * 🔧 PRIVATE HELPERS — EVALUATION LEVEL & CONFIDENCE (SRP: отдельная ответственность)
 * ============================================================================
 *
 * @note ВРЕМЕННО: evaluationLevel и confidence здесь (evaluation-layer ответственность).
 *       После policies/ будет перенесено в evaluation/assessment.ts.
 *       Идеальная архитектура: strategy → triggeredRules/violations/riskScore,
 *       evaluation layer → evaluationLevel/confidence/label
 */

/**
 * Собирает boolean сигналы в массив значений
 * @internal
 */
function collectBooleanSignals(
  signals: ClassificationSignals, // Classification signals
): readonly boolean[] { // Массив boolean значений
  return [
    ...(signals.isVpn !== undefined ? [signals.isVpn] : []),
    ...(signals.isTor !== undefined ? [signals.isTor] : []),
    ...(signals.isProxy !== undefined ? [signals.isProxy] : []),
  ];
}

/**
 * Нормализует числовой сигнал в дискретное значение (0-100 → 0-4)
 * @internal
 */
function normalizeScoreToBucket(
  score: number, // Числовой сигнал (0-100)
): number { // Нормализованное значение (0-4)
  return Math.floor(score / CONFIDENCE_CONSTANTS.SCORE_BUCKET_SIZE);
}

/**
 * Собирает числовые сигналы в массив нормализованных значений
 * @internal
 */
function collectNumericSignals(
  signals: ClassificationSignals, // Classification signals
): readonly number[] { // Массив нормализованных числовых значений
  const numericSignals: number[] = [];

  if (signals.reputationScore !== undefined && Number.isFinite(signals.reputationScore)) {
    // eslint-disable-next-line functional/immutable-data -- Сборка массива требует мутации
    numericSignals.push(normalizeScoreToBucket(signals.reputationScore));
  }
  if (signals.velocityScore !== undefined && Number.isFinite(signals.velocityScore)) {
    // eslint-disable-next-line functional/immutable-data -- Сборка массива требует мутации
    numericSignals.push(normalizeScoreToBucket(signals.velocityScore));
  }

  return Object.freeze(numericSignals);
}

/**
 * Подсчитывает частоты значений в массиве
 * @internal
 */
function calculateFrequencies(
  values: readonly (boolean | number)[], // Массив значений
): ReadonlyMap<string, number> { // Map с частотами
  const frequencies = new Map<string, number>();

  // eslint-disable-next-line functional/no-loop-statements -- Подсчет частот требует итерации
  for (const value of values) {
    const key = String(value);
    const current = frequencies.get(key) ?? 0;
    // eslint-disable-next-line functional/immutable-data -- Подсчет частот требует мутации Map
    frequencies.set(key, current + 1);
  }

  return Object.freeze(frequencies) as ReadonlyMap<string, number>;
}

/**
 * Вычисляет entropy по формуле Шеннона: H(X) = -Σ p(x) * log2(p(x))
 * @internal
 */
function calculateShannonEntropy(
  frequencies: ReadonlyMap<string, number>, // Map с частотами значений
  total: number, // Общее количество значений
): number { // Entropy (не нормализованная)
  return Array.from(frequencies.values()).reduce(
    (entropy, count) => {
      const probability = count / total;
      return probability > 0 ? entropy - probability * Math.log2(probability) : entropy;
    },
    0,
  );
}

/**
 * Вычисляет entropy сигналов для оценки качества и разнообразия данных (формула Шеннона)
 * Высокая entropy = больше разнообразия = выше качество данных
 * @internal
 */
function calculateSignalsEntropy(
  signals: ClassificationSignals | undefined, // Classification signals для расчета entropy
): number { // Нормализованная entropy (0-1), где 1 = максимальное разнообразие
  if (signals === undefined) {
    return 0; // Нет сигналов = нет entropy
  }

  // Собираем все доступные сигналы в дискретные значения (functional style)
  const booleanSignals = collectBooleanSignals(signals);
  const numericSignals = collectNumericSignals(signals);
  const signalValues = Object.freeze([...booleanSignals, ...numericSignals]);

  if (signalValues.length === 0) {
    return 0; // Нет доступных сигналов
  }

  if (signalValues.length === 1) {
    return 0; // Один сигнал = нет разнообразия
  }

  // Подсчитываем частоты каждого уникального значения
  const frequencies = calculateFrequencies(signalValues);

  // Вычисляем entropy по формуле Шеннона
  const total = signalValues.length;
  const entropy = calculateShannonEntropy(frequencies, total);

  // Нормализуем entropy к диапазону [0, 1]
  // Максимальная entropy для n сигналов = log2(n)
  const maxEntropy = Math.log2(signalValues.length);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return Math.max(0, Math.min(1, normalizedEntropy));
}

/**
 * Вычисляет evaluation level из riskScore (из aggregation)
 * Маппинг: riskScore (0-100) → evaluationLevel (0-100 в scale)
 *
 * @technical-debt TRANSITIONAL ARCHITECTURE:
 *   Эта функция находится в strategy layer, но по архитектуре должна быть в evaluation layer.
 *   Правильная архитектура:
 *     Strategy → only triggeredRules + violations + riskScore
 *     Evaluation layer → evaluationLevel + confidence + label
 *     Assessment layer → final result assembly
 *   После реализации policies/ эта логика будет перенесена в evaluation/assessment.ts.
 *
 * @internal
 */
function calculateEvaluationLevelFromRiskScore(
  riskScore: number, // Risk score из aggregation (0-100) → evaluationLevel (0-100 в scale)
): EvaluationLevel<'classification'> { // EvaluationLevel для classification domain
  // Ограничиваем riskScore диапазоном scale (0-100)
  const clampedScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  const levelResult = evaluationLevel.create(clampedScore, CLASSIFICATION_EVALUATION_SCALE);
  if (!levelResult.ok) {
    // Если не удалось создать level, возвращаем минимальный (0)
    const fallbackResult = evaluationLevel.create(0, CLASSIFICATION_EVALUATION_SCALE);
    if (!fallbackResult.ok) {
      // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации
      throw new Error(`Failed to create evaluation level: ${JSON.stringify(levelResult.reason)}`);
    }
    return fallbackResult.value;
  }

  return levelResult.value;
}

/**
 * Вычисляет confidence на основе violations, riskScore (из aggregation) и triggeredRules
 * Формула: 0.5 + scoreContribution + rulesContribution + entropyContribution - violationsPenalty
 * Учитывает entropy сигналов (формула Шеннона) для оценки качества данных
 *
 * @technical-debt TRANSITIONAL ARCHITECTURE:
 *   Эта функция находится в strategy layer, но по архитектуре должна быть в evaluation layer.
 *   Правильная архитектура:
 *     Strategy → only triggeredRules + violations + riskScore
 *     Evaluation layer → evaluationLevel + confidence + label
 *     Assessment layer → final result assembly
 *   После реализации policies/ эта логика будет перенесена в evaluation/assessment.ts.
 *
 * @note Saturation: при большом количестве правил (triggeredRules.length * RULE_CONTRIBUTION >= MAX_RULES_CONTRIBUTION)
 *       rulesContribution достигает максимума. RULE_CONTRIBUTION становится бессмысленным после saturation.
 *       Это нормальное поведение, но стоит учитывать при настройке констант.
 * @internal
 */
function calculateConfidence(
  violations: readonly SemanticViolation[], // Массив violations (degrade violations снижают confidence)
  riskScore: number, // Risk score из aggregation (0-100)
  triggeredRules: readonly ClassificationRule[], // Массив сработавших правил
  signals?: ClassificationSignals | undefined, // Classification signals для расчета entropy (опционально)
): Confidence<'classification'> { // Confidence для classification domain
  // Базовый confidence (неопределенность)
  const baseConf = CONFIDENCE_CONSTANTS.BASE_CONFIDENCE;

  // Увеличиваем confidence при наличии качественных сигналов (riskScore > 0 означает наличие данных)
  const scoreContribution = riskScore > 0
    ? Math.min(CONFIDENCE_CONSTANTS.MAX_SCORE_CONTRIBUTION, riskScore / 100)
    : 0;

  // Увеличиваем confidence при наличии triggeredRules (больше правил = выше confidence)
  // @note Saturation: при triggeredRules.length >= 3 (MAX_RULES_CONTRIBUTION / RULE_CONTRIBUTION = 0.3 / 0.1 = 3)
  //       rulesContribution достигает максимума MAX_RULES_CONTRIBUTION
  const rulesContribution = triggeredRules.length > 0
    ? Math.min(
      CONFIDENCE_CONSTANTS.MAX_RULES_CONTRIBUTION,
      triggeredRules.length * CONFIDENCE_CONSTANTS.RULE_CONTRIBUTION,
    )
    : 0;

  // Увеличиваем confidence при наличии разнообразных сигналов (entropy)
  const signalsEntropy = calculateSignalsEntropy(signals);
  const entropyContribution = signalsEntropy > 0
    ? Math.min(
      CONFIDENCE_CONSTANTS.MAX_ENTROPY_CONTRIBUTION,
      signalsEntropy * CONFIDENCE_CONSTANTS.MAX_ENTROPY_CONTRIBUTION,
    )
    : 0;

  // Уменьшаем confidence при наличии degrade violations
  const degradeViolations = violations.filter((v) => v.severity === 'degrade');
  const violationsPenalty = degradeViolations.length > 0
    ? Math.min(
      CONFIDENCE_CONSTANTS.MAX_VIOLATIONS_PENALTY,
      degradeViolations.length * CONFIDENCE_CONSTANTS.VIOLATION_PENALTY,
    )
    : 0;

  // Вычисляем итоговый confidence (с учетом entropy)
  const conf = Math.max(
    CONFIDENCE_CONSTANTS.MIN_CONFIDENCE,
    baseConf + scoreContribution + rulesContribution + entropyContribution - violationsPenalty,
  );

  // Ограничиваем confidence диапазоном [0, 1]
  const clampedConf = Math.max(0, Math.min(1, conf));

  const confidenceResult = confidence.create(clampedConf, 'classification');
  if (!confidenceResult.ok) {
    // Если не удалось создать confidence, возвращаем минимальный
    const fallbackResult = confidence.create(
      CONFIDENCE_CONSTANTS.FALLBACK_CONFIDENCE,
      'classification',
    );
    if (!fallbackResult.ok) {
      // eslint-disable-next-line fp/no-throw -- Критическая ошибка инициализации
      throw new Error(`Failed to create confidence: ${JSON.stringify(confidenceResult.reason)}`);
    }
    return fallbackResult.value;
  }

  return confidenceResult.value;
}

/* ============================================================================
 * 🔧 PRIVATE HELPERS — RESULT ASSEMBLY (SRP: отдельная ответственность)
 * ============================================================================
 */

/**
 * Собирает промежуточный результат rule evaluation
 *
 * @technical-debt TRANSITIONAL ARCHITECTURE:
 *   Эта функция находится в strategy layer, но по архитектуре должна быть в evaluation layer.
 *   Правильная архитектура:
 *     Strategy → only triggeredRules + violations + riskScore
 *     Evaluation layer → evaluationLevel + confidence + label
 *     Assessment layer → final result assembly
 *   После реализации policies/ эта логика будет перенесена в evaluation/assessment.ts.
 *   Сейчас эта функция дублирует логику из evaluation layer (assembleAssessmentResultFromContext),
 *   что создает architectural inconsistency.
 *
 * @note Explainability: whitelist полей (geo, signals), исключая PII (userId, ip, timestamp)
 * @internal
 */
function assembleClassificationResult(
  violations: readonly SemanticViolation[], // Массив violations для расчета confidence
  riskScore: number, // Risk score из aggregation (0-100)
  triggeredRules: readonly ClassificationRule[], // Массив сработавших правил
  context?: Readonly<ClassificationContext>, // Контекст классификации (опционально, для explainability)
): Readonly<ClassificationEvaluationResult> { // Результат оценки классификации
  const evaluationLevelValue = calculateEvaluationLevelFromRiskScore(riskScore);
  const confidenceValue = calculateConfidence(
    violations,
    riskScore,
    triggeredRules,
    context?.signals,
  );

  const labelResult = classificationLabel.create('UNKNOWN');
  if (!labelResult.ok) {
    // eslint-disable-next-line fp/no-throw -- Invariant: UNKNOWN label must be valid (system initialization error)
    throw new Error(
      `Invariant violation: UNKNOWN label must be valid. Reason: ${
        JSON.stringify(labelResult.reason)
      }`,
    );
  }
  const labelValue = labelResult.value;

  // Whitelist полей для explainability (исключаем PII: userId, ip, timestamp, previousSessionId)
  const explainabilityContext = context !== undefined
    ? ((): Readonly<ClassificationContext> | undefined => {
      // Создаем объект сразу с нужными полями (без мутаций)
      const explainabilityFields: {
        geo?: ClassificationContext['geo'];
        signals?: ClassificationContext['signals'];
      } = {
        ...(context.geo !== undefined && { geo: context.geo }),
        ...(context.signals !== undefined && { signals: context.signals }),
      };
      return Object.keys(explainabilityFields).length > 0
        ? Object.freeze(explainabilityFields) as Readonly<ClassificationContext>
        : undefined;
    })()
    : undefined;

  return Object.freeze({
    evaluationLevel: evaluationLevelValue,
    confidence: confidenceValue,
    label: labelValue,
    scale: CLASSIFICATION_EVALUATION_SCALE,
    // Опциональные поля для explainability
    ...(triggeredRules.length > 0 && {
      usedSignals: [] as readonly (keyof ClassificationSignals)[],
    }),
    ...(explainabilityContext !== undefined && { context: explainabilityContext }),
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
  /** Политика оценки классификации (опционально, не используется до реализации policies/) */
  readonly policy?: Readonly<Record<string, unknown>>;
  /** Плагины для расширения контекста (опционально) */
  readonly plugins?: readonly ContextBuilderPlugin[];
  /** Конфигурация правил (опционально, по умолчанию глобальный config) */
  readonly config?: Readonly<ClassificationRulesConfig>;
}>;

/**
 * Оценивает классификацию через локальные правила (pure domain engine)
 * Pipeline: validate → riskScore (из aggregation) → ruleContext → triggeredRules → ruleEvaluationResult → assessmentContext → assembleResult
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
  // 1. Валидация signals (один вызов для детерминированности и производительности)
  const violations = validateClassificationSemantics(context.signals);
  validateBlockingSignals(violations);

  // 2. Извлекаем опции (с дефолтными значениями)
  // riskScore из aggregation передается через options.riskScore
  const riskScore = options.riskScore ?? 0;
  // Policy будет использован после реализации policies/ (см. TODO в 1.8.4)
  // options.policy не используется до реализации policies/
  const plugins = options.plugins ?? [];
  const config = options.config ?? getClassificationRulesConfig();

  // 3. Строим rule context с применением плагинов
  const baseRuleContext = buildRuleContext({ device: deviceInfo, context, riskScore });
  const ruleContext = applyRulePlugins(baseRuleContext.ruleContext, plugins, context);

  // 4. Получаем порог критичности из конфигурации (config передается явно для чистоты)
  const minPriority = config.criticalRulePriorityThreshold;

  // 5. Оцениваем правила через единый проход (minPriority передается явно для чистоты)
  const triggeredRules = evaluateClassificationRulesInternal(ruleContext, minPriority);

  // 6. Создаем промежуточный rule evaluation result (используется для assessment context)
  // @technical-debt TRANSITIONAL ARCHITECTURE:
  //   assembleClassificationResult находится в strategy, но должна быть в evaluation layer.
  //   Это создает дублирование: strategy собирает result, затем evaluation layer пересобирает через
  //   assembleAssessmentResultFromContext. После policies/ эта логика будет перенесена в evaluation/.
  const ruleEvaluationResult = assembleClassificationResult(
    violations,
    riskScore,
    triggeredRules,
    context,
  );

  // 7. Собираем assessment context с применением плагинов (если есть assessment plugins)
  // @note Плагины из ContextBuilderPlugin.extendsAssessmentContext не используются здесь,
  //       так как они работают с BuildClassificationContext, а не с AssessmentContext.
  //       Для расширения AssessmentContext нужно использовать AssessmentContextBuilderPlugin
  //       через отдельное поле в options (будет добавлено при необходимости).
  const assessmentContext = buildAssessmentContextWithPlugins(
    deviceInfo,
    context,
    riskScore,
    ruleEvaluationResult,
    {
      // @todo: добавить support для AssessmentContextBuilderPlugin через options.assessmentPlugins
      // после реализации расширенной системы плагинов
      plugins: [],
    },
  );

  // 8. Собираем финальный результат через assessment logic
  return assembleAssessmentResultFromContext(assessmentContext);
}
