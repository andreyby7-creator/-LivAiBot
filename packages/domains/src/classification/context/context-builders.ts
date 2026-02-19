/**
 * @file packages/domains/src/classification/context/context-builders.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Context Builders (Pure Functions, Slot-Based API)
 * ============================================================================
 *
 * Архитектурная роль:
 * Pure functions для построения контекстов разных слоёв classification domain.
 * Используют slot-based API для интеграции в declarative pipeline.
 * Изолированы от основной логики для соблюдения SRP.
 *
 * Принципы:
 * - ✅ Pure — детерминированные функции без side-effects, IO, async, conditions
 * - ✅ Slot-based API — функции принимают и возвращают Pick<ClassificationSlotMap, ...> для pipeline integration
 * - ✅ SRP — каждый builder отвечает за свой тип контекста
 * - ✅ Reusable — используются в strategies, evaluation, aggregation layers
 * - ✅ Immutable — все функции возвращают frozen объекты с защитой вложенных структур
 * - ✅ Scalable — O(1) по памяти: shallow copy вместо deep copy
 * - ✅ Pipeline-ready — готовы к автоматической композиции стадий через slot-based архитектуру
 *
 * @note Общие требования для всех builders:
 *       - Signals должны быть sanitized через semanticViolationValidator до вызова (adapter layer responsibility)
 *       - Builders не выполняют security checks — соблюдается разделение ответственности
 *       - Все builders используют shallow copy для immutability (O(1) по памяти)
 *       - Security: freeze вложенных объектов первого уровня для защиты от plugin mutations
 *       - Slot-based: все функции работают с Pick<ClassificationSlotMap, ...> для уменьшения coupling
 */

import type { ScoringContext } from '../aggregation/scoring.js';
import { SCORE_VALIDATION } from '../constants.js';
import type { AssessmentContext } from '../evaluation/assessment.js';
import type { ClassificationEvaluationResult } from '../evaluation/result.js';
import type { ClassificationContext, ClassificationSignals } from '../signals/signals.js';
import type { ClassificationRulesConfig } from '../strategies/config.js';
import type {
  DeviceInfo,
  RuleContextMetadata,
  RuleEvaluationContext,
  RuleSignals,
} from '../strategies/rules.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION SLOT MAP
 * ============================================================================
 */

/**
 * Slot map для classification pipeline
 * Определяет все слоты данных, которые могут быть использованы в pipeline
 *
 * @note Slot-based архитектура позволяет автоматическую композицию стадий
 * @note Каждый builder работает с подмножеством слотов (Pick<ClassificationSlotMap, ...>)
 * @public
 */
export type ClassificationSlotMap = Readonly<{
  /** Информация об устройстве */
  readonly device: DeviceInfo;
  /** Контекст для оценки классификации */
  readonly context: ClassificationContext;
  /** Сигналы классификации (опционально, может быть частью context) */
  readonly signals?: ClassificationSignals;
  /** Конфигурация правил */
  readonly config: ClassificationRulesConfig;
  /** Risk score из aggregation (0-100) */
  readonly riskScore?: number;
  /** Контекст для scoring */
  readonly scoringContext?: ScoringContext;
  /** Контекст для rule evaluation */
  readonly ruleContext?: RuleEvaluationContext;
  /** Результат rule evaluation */
  readonly ruleEvaluationResult?: ClassificationEvaluationResult;
  /** Контекст для assessment */
  readonly assessmentContext?: AssessmentContext;
}>;

/* ============================================================================
 * 🔧 HELPER: FREEZE CONTEXT
 * ============================================================================
 */

/**
 * Замораживает контекст для защиты от мутаций
 * @internal
 */
function freezeContext<T extends Readonly<Record<string, unknown>>>(context: T): Readonly<T> {
  return Object.freeze(context);
}

/* ============================================================================
 * 🔧 SCORING CONTEXT BUILDER
 * ============================================================================
 */

/**
 * Подготавливает контекст для scoring (pure function, slot-based API)
 *
 * @param slots - Слоты данных из pipeline (device, context, config)
 * @returns ScoringContext для calculateRiskScore
 *
 * @note Pure function: нет side-effects, IO, async, conditions
 * @note Immutable: возвращает frozen объект
 * @note Slot-based API: интегрирован в declarative pipeline
 * @public
 */
export function buildScoringContext(
  slots: Pick<ClassificationSlotMap, 'device' | 'context' | 'config'>,
): Pick<ClassificationSlotMap, 'scoringContext'> {
  const { device, context, config } = slots;

  const baseScoringContext: ScoringContext = {
    device: { ...device },
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.signals !== undefined && { signals: context.signals }),
    config: { highRiskCountries: config.highRiskCountries },
  };

  const scoringContext = freezeContext(baseScoringContext);

  return { scoringContext } as Pick<ClassificationSlotMap, 'scoringContext'>;
}

/* ============================================================================
 * 🔧 RULE CONTEXT BUILDER
 * ============================================================================
 */

/**
 * Строит RuleSignals из ClassificationSignals (pure function)
 * @internal
 * @note Возвращает пустой объект вместо undefined для pipeline удобства
 *       Это позволяет избежать проверок на undefined downstream
 */
function buildRuleSignals(signals: ClassificationSignals | undefined): RuleSignals {
  if (signals === undefined) {
    return {};
  }

  const ruleSignals: RuleSignals = {
    ...(signals.isVpn !== undefined && { isVpn: signals.isVpn }),
    ...(signals.isTor !== undefined && { isTor: signals.isTor }),
    ...(signals.isProxy !== undefined && { isProxy: signals.isProxy }),
    ...(signals.reputationScore !== undefined && { reputationScore: signals.reputationScore }),
    ...(signals.velocityScore !== undefined && { velocityScore: signals.velocityScore }),
  };

  return ruleSignals;
}

/**
 * Валидирует и нормализует risk score (pure function)
 * @internal
 */
function validateRiskScore(score: number | undefined): number {
  if (score === undefined) {
    return 0;
  }

  // Проверка на NaN и Infinity
  if (!Number.isFinite(score)) {
    return 0;
  }

  // Ограничение диапазоном 0-100
  return Math.min(Math.max(score, SCORE_VALIDATION.MIN_SCORE), SCORE_VALIDATION.MAX_SCORE);
}

/**
 * Подготавливает контекст для rule evaluation (pure function, slot-based API)
 *
 * @param slots - Слоты данных из pipeline (device, context, riskScore)
 * @returns RuleEvaluationContext для evaluateRules
 *
 * @note Pure function: нет side-effects, IO, async, conditions
 * @note Immutable: возвращает frozen объект
 * @note Slot-based API: интегрирован в declarative pipeline
 * @note Security: валидация riskScore для защиты от poisoning
 * @public
 */
export function buildRuleContext(
  slots: Pick<ClassificationSlotMap, 'device' | 'context' | 'riskScore'>,
): Required<Pick<ClassificationSlotMap, 'ruleContext'>> {
  const { device, context, riskScore } = slots;

  // Валидация и нормализация riskScore для защиты от poisoning
  const validatedRiskScore = validateRiskScore(riskScore);

  // Строим signals объект с правильной типизацией
  const signals = buildRuleSignals(context.signals);

  // Валидация previousSessionId для защиты от poisoning
  // isNewDevice = true если:
  //   - previousSessionId === undefined (нет информации о сессии)
  //   - previousSessionId === '' (пустая строка = невалидно)
  // isNewDevice = false если:
  //   - previousSessionId = 'valid-session-id' (валидная непустая строка)
  // @note TypeScript гарантирует что previousSessionId не может быть null (тип: string | undefined)
  const isNewDevice = context.previousSessionId === undefined
    || (typeof context.previousSessionId === 'string' && context.previousSessionId.length === 0);

  // Строим metadata объект с правильной типизацией
  const metadata: RuleContextMetadata = {
    isNewDevice,
    riskScore: validatedRiskScore,
  };

  const ruleContext: RuleEvaluationContext = {
    device: { ...device },
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.signals?.previousGeo !== undefined && { previousGeo: context.signals.previousGeo }),
    signals, // Теперь всегда объект (пустой или с полями)
    metadata,
  };

  // Freeze вложенные объекты (первый уровень вложенности)
  // signals теперь всегда объект (пустой или с полями), поэтому всегда freeze
  Object.freeze(ruleContext.signals);
  // metadata всегда определён, так как создаётся выше
  Object.freeze(ruleContext.metadata);

  const frozenRuleContext = freezeContext(ruleContext);

  return { ruleContext: frozenRuleContext } as Required<Pick<ClassificationSlotMap, 'ruleContext'>>;
}

/* ============================================================================
 * 🔧 ASSESSMENT CONTEXT BUILDER
 * ============================================================================
 */

/**
 * Подготавливает контекст для assessment (pure function, slot-based API)
 *
 * @param slots - Слоты данных из pipeline (device, context, riskScore, ruleEvaluationResult)
 * @returns AssessmentContext для assembleAssessmentResultFromContext
 *
 * @note Pure function: нет side-effects, IO, async, conditions
 * @note Immutable: возвращает frozen объект с защитой от мутаций вложенных объектов
 * @note Slot-based API: интегрирован в declarative pipeline
 * @note Security: freeze classificationContext и его вложенные объекты для защиты от plugin mutations
 * @public
 */
export function buildAssessmentContext(
  slots: Pick<ClassificationSlotMap, 'device' | 'context' | 'riskScore'> & {
    readonly ruleEvaluationResult: Readonly<ClassificationEvaluationResult>;
  },
): Pick<ClassificationSlotMap, 'assessmentContext'> {
  const { device, context, riskScore = 0, ruleEvaluationResult } = slots;

  // Security: freeze classificationContext и его вложенные объекты
  // Freeze signals если есть
  const frozenContext: ClassificationContext = context.signals !== undefined
    ? {
      ...context,
      signals: Object.freeze({ ...context.signals }),
    }
    : { ...context };

  // Freeze geo если есть (shallow freeze для защиты от мутаций полей)
  if (frozenContext.geo !== undefined) {
    // Shallow freeze geo объекта и его полей для защиты от nested mutations
    // Это защищает от изменения полей типа geo.country, geo.region и т.д.
    Object.freeze(frozenContext.geo);
    // Примечание: для deep freeze всех nested объектов можно использовать утилиту,
    // но для production shallow freeze достаточно, так как geo создаётся через factory
  }

  // Freeze весь classificationContext
  const fullyFrozenContext = freezeContext(frozenContext);

  const assessmentContext: AssessmentContext = {
    device: { ...device },
    classificationContext: fullyFrozenContext,
    riskScore,
    ruleEvaluationResult,
  };

  const frozenAssessmentContext = freezeContext(assessmentContext);

  return { assessmentContext: frozenAssessmentContext } as Pick<
    ClassificationSlotMap,
    'assessmentContext'
  >;
}
