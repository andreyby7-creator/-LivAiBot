/**
 * @file packages/feature-auth/src/effects/login/risk-assessment.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Assessment (Composition Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Composition layer для risk assessment subsystem
 * - Объединяет rules, scoring и decision engine
 * - Public API для risk assessment
 *
 * Принципы:
 * - ✅ Composition — объединяет подсистемы
 * - ✅ Configurable — принимает policy для настройки
 * - ✅ Детерминированный результат — одинаковый вход → одинаковый выход
 * - ❌ Нет store — store layer
 * - ❌ Нет telemetry — observability layer
 * - ❌ Нет orchestration — orchestrator
 * - ❌ Нет timeout — effect-timeout layer
 * - ❌ Нет isolation — effect-isolation layer
 * - ❌ Нет API calls — api-client layer
 */

import { buildAssessment } from './risk-assessment.adapter.js';
import {
  defaultDecisionPolicy,
  determineDecisionHint,
  determineRiskLevel,
} from './risk-decision.js';
import { evaluateRules } from './risk-rules.js';
import type { RuleEvaluationContext } from './risk-rules.js';
import { calculateRiskScore, defaultRiskWeights } from './risk-scoring.js';
import type { ScoringContext } from './risk-scoring.js';
import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import { validateRiskSemantics } from '../../domain/RiskValidation.js';
import type {
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
} from '../../types/risk.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 *
 * @note Все типы risk assessment реэкспортируются из types/risk.ts
 *       для единого источника истины и консистентности архитектуры
 */

// Реэкспорт типов из types/risk.ts (единый источник истины)
export type {
  ContextBuilderPlugin,
  ExternalRiskSignals,
  InternalRiskSignals,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../../types/risk.js';

/**
 * Hook для audit/logging критических решений
 * Вызывается при блокировке или challenge для отслеживания security events
 */
export type AuditHook = (
  result: RiskAssessmentResult,
  context: RiskContext,
) => void;

/* ============================================================================
 * 🔧 CONTEXT BUILDERS (SRP: отдельная ответственность для каждого контекста)
 * ============================================================================
 */

/**
 * Context Builder для подготовки контекстов разных слоёв
 * Разделяет ответственность: каждый builder отвечает за свой тип контекста
 *
 * @note Для extensibility: можно добавить plugin pattern через ContextBuilderPlugin
 * интерфейс для кастомных сигналов и расширений контекста
 */

/** Подготавливает контекст для scoring */
function buildScoringContext(
  deviceInfo: DeviceInfo,
  context: RiskContext,
): ScoringContext {
  return {
    device: deviceInfo,
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.signals !== undefined && { signals: context.signals }),
  };
}

/** Подготавливает контекст для rule evaluation */
function buildRuleContext(
  deviceInfo: DeviceInfo,
  context: RiskContext,
  riskScore: number,
): RuleEvaluationContext {
  return {
    device: deviceInfo,
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.signals?.previousGeo !== undefined && { previousGeo: context.signals.previousGeo }),
    ...(context.signals !== undefined && { signals: context.signals }),
    metadata: {
      isNewDevice: context.previousSessionId === undefined,
      riskScore,
    },
  };
}

/** Подготавливает контекст для buildAssessment */
function buildAssessmentContext(
  deviceInfo: DeviceInfo,
  context: RiskContext,
): Parameters<typeof buildAssessment>[1] {
  return {
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
    ...(context.previousSessionId !== undefined
      && { previousSessionId: context.previousSessionId }),
    ...(context.timestamp !== undefined && { timestamp: context.timestamp }),
    ...(context.signals !== undefined && { signals: context.signals }),
  };
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Оценивает риск логина на основе device info и контекста
 *
 * Детерминированная функция: одинаковый вход → одинаковый выход.
 * Timestamp передается извне (orchestrator) для детерминизма.
 * externalSignals должны соответствовать контракту (JSON-serializable, read-only).
 *
 * @param deviceInfo - Информация об устройстве из DeviceFingerprint
 * @param context - Контекст для оценки риска (IP, geo, session history, timestamp)
 * @param policy - Политика оценки риска (опционально, используются дефолтные значения)
 * @param plugins - Плагины для расширения контекста (опционально)
 * @param auditHook - Hook для audit/logging критических решений (опционально)
 * @returns Результат оценки риска с score, level, rules и decision hint
 *
 * @note Extensibility:
 * - ContextBuilderPlugin: добавлять кастомные сигналы без изменения core logic
 * - Plugin pattern для scoring/decision/rules: можно расширить через интерфейсы
 *   ScoringPlugin, DecisionPlugin, RulePlugin для кастомных алгоритмов
 */

/** Применяет плагины для расширения scoring context */
function applyScoringPlugins(
  context: ScoringContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): ScoringContext {
  let result = context;
  for (const plugin of plugins) {
    if (plugin.extendScoringContext) {
      result = plugin.extendScoringContext(result, riskContext);
    }
  }
  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Применяет плагины для расширения rule context */
function applyRulePlugins(
  context: RuleEvaluationContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): RuleEvaluationContext {
  let result = context;
  for (const plugin of plugins) {
    if (plugin.extendRuleContext) {
      result = plugin.extendRuleContext(result, riskContext);
    }
  }
  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Применяет плагины для расширения assessment context */
function applyAssessmentPlugins(
  context: Parameters<typeof buildAssessment>[1],
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): Parameters<typeof buildAssessment>[1] {
  let result = context;
  for (const plugin of plugins) {
    if (plugin.extendAssessmentContext) {
      result = plugin.extendAssessmentContext(result, riskContext);
    }
  }
  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Вызывает audit hook для критических решений */
function callAuditHookIfNeeded(
  result: RiskAssessmentResult,
  context: RiskContext,
  auditHook?: AuditHook,
): void {
  if (
    auditHook
    && (result.decisionHint.action === 'block' || result.decisionHint.action === 'challenge')
  ) {
    auditHook(result, context);
  }
}

export function assessLoginRisk(
  deviceInfo: DeviceInfo,
  context: RiskContext = {},
  policy: RiskPolicy = {},
  plugins: readonly ContextBuilderPlugin[] = [],
  auditHook?: AuditHook,
): RiskAssessmentResult {
  // Семантическая валидация risk signals (domain logic)
  // Возвращает violations для observability, explainability и policy-engine
  // @note Security sanitization должна быть выполнена ДО вызова этой функции
  //       через sanitizeExternalSignals() из lib/security-pipeline/core/
  const violations = validateRiskSemantics(context.signals);
  if (violations.length > 0) {
    // Фильтруем только блокирующие violations (severity: 'block')
    // degrade violations влияют на confidence, но не блокируют оценку
    const blockingViolations = violations.filter((v) => v.severity === 'block');
    if (blockingViolations.length > 0) {
      // Формируем детальное сообщение об ошибке с violations для audit trail
      const violationMessages = blockingViolations.map((v) => {
        const metaStr = ` (${v.meta.reason})`;
        return `${v.code}${metaStr}: ${v.impact}`;
      }).join('; ');
      throw new Error(`Invalid risk signals: ${violationMessages}`);
    }
    // @note degrade violations не блокируют оценку, но должны быть залогированы для observability
  }

  const weights = policy.weights ?? defaultRiskWeights;
  const decisionPolicy = policy.decision ?? defaultDecisionPolicy;

  // 1. Рассчитываем risk score
  const baseScoringContext = buildScoringContext(deviceInfo, context);
  const scoringContext = applyScoringPlugins(baseScoringContext, plugins, context);
  const riskScore = calculateRiskScore(scoringContext, weights);

  // 2. Определяем уровень риска
  const riskLevel = determineRiskLevel(riskScore, decisionPolicy.thresholds);

  // 3. Оцениваем правила
  // Правила сортируются по приоритету внутри evaluateRuleActions для детерминированности
  // Engine использует Map<RiskRule, RuleMetadata> для O(1) lookup, масштабируется на сотни правил
  // @note Lazy evaluation: для критических правил (priority >= 90) можно добавить short-circuit
  // чтобы прервать оценку при первом блокирующем правиле для повышения производительности
  const baseRuleContext = buildRuleContext(deviceInfo, context, riskScore);
  const ruleContext = applyRulePlugins(baseRuleContext, plugins, context);
  const triggeredRules = evaluateRules(ruleContext);

  // 4. Определяем рекомендацию с приоритетами
  const decisionSignals = context.signals?.reputationScore !== undefined
    ? { reputationScore: context.signals.reputationScore }
    : undefined;
  const decisionHint = determineDecisionHint(
    riskLevel,
    triggeredRules,
    decisionSignals,
    decisionPolicy,
  );

  // 5. Строим assessment для аудита
  const baseAssessmentContext = buildAssessmentContext(deviceInfo, context);
  const assessmentContext = applyAssessmentPlugins(baseAssessmentContext, plugins, context);
  const assessment = buildAssessment(deviceInfo, assessmentContext);

  const result: RiskAssessmentResult = {
    riskScore,
    riskLevel,
    triggeredRules,
    decisionHint,
    assessment,
  };

  // Audit hook для критических решений (block/challenge)
  callAuditHookIfNeeded(result, context, auditHook);

  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}
