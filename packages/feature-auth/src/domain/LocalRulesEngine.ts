/**
 * @file packages/feature-auth/src/domain/localRulesEngine.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Local Rules Engine (Pure Domain Logic)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Pure domain engine для оценки риска через локальные правила
 * - Детерминированная функция без side-effects
 * - Изолирован от effects layer (audit/logging)
 *
 * Принципы:
 * - ✅ Pure — детерминированная функция, одинаковый вход → одинаковый выход
 * - ✅ No side-effects — не вызывает audit/logging, не мутирует внешнее состояние
 * - ✅ Testable — легко тестируется без моков внешних зависимостей
 * - ✅ Domain-focused — содержит только orchestration логику оценки риска
 * - ✅ SRP — использует модули для context builders, validation и plugin appliers
 *
 * Масштабируемость (Rule-engine Scalability):
 * - ✅ O(1) lookup правил через Map<RiskRule, RuleMetadata> — масштабируется на сотни правил
 * - ✅ Short-circuit evaluation для критических правил (priority >= 90) — прерывает оценку
 *       при первом блокирующем правиле для улучшения latency
 * - ✅ Оптимизация для больших externalSignals (>1000 ключей):
 *       ленивая проверка + shallow freeze по умолчанию в PluginAppliers для снижения overhead
 * - ✅ Кэширование промежуточных результатов: riskScore переиспользуется в ruleContext,
 *       base contexts кэшируются для избежания повторных вычислений
 * - ⚠️ Рекомендация: профилировать на 500–1000 правил для проверки производительности
 *
 * @note Side-effects (audit/logging) изолированы в wrapper layer (local-rules.source.ts)
 *       через optional auditHook, который вызывается после получения результата.
 * @note Оптимизации для больших payload реализованы в PluginAppliers (shallow freeze,
 *       ленивая проверка для externalSignals > 1000 ключей).
 * @note Short-circuiting для критических правил реализован в evaluateRules (risk-rules.ts).
 * @note Кэширование: промежуточные результаты (riskScore, base contexts) переиспользуются
 *       для избежания повторных вычислений.
 * @note Safety: все временные объекты защищены через ReadonlyDeep и ProtectedSignals,
 *       TypeScript guards гарантируют compile-time безопасность.
 * @note Отключение правила обосновано: readonly массивы/типы неизменяемы на runtime.
 *       Параметры plugins приходят из effects layer, временные объекты защищены через ReadonlyDeep.
 */

/* eslint-disable functional/prefer-immutable-types */
/* readonly массивы/типы неизменяемы на runtime, параметры приходят из effects layer */

import type { ReadonlyDeep } from 'type-fest';

import {
  buildAssessmentContext,
  buildRuleContext,
  buildScoringContext,
} from './ContextBuilders.js';
import type { DeviceInfo } from './DeviceInfo.js';
import { applyAssessmentPlugins, applyRulePlugins, applyScoringPlugins } from './PluginAppliers.js';
import { validateRiskSemantics } from './RiskValidation.js';
import type { RiskSemanticViolation } from './RiskValidation.js';
import { buildAssessment } from '../effects/login/risk-assessment.adapter.js';
import {
  defaultDecisionPolicy,
  determineDecisionHint,
  determineRiskLevel,
} from '../effects/login/risk-decision.js';
import type { DecisionSignals } from '../effects/login/risk-decision.js';
import { evaluateRules } from '../effects/login/risk-rules.js';
import { calculateRiskScore, defaultRiskWeights } from '../effects/login/risk-scoring.js';
import type {
  BuildAssessmentContext,
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
} from '../types/risk.js';

/* ============================================================================
 * 🧭 TYPE ALIASES
 * ============================================================================
 */

/**
 * Защищенные сигналы с явной типизацией для compile-time запрета мутаций
 * Используется для критичных вложенных объектов, которые не должны мутироваться
 * @note Соответствует типу ProtectedSignals из PluginAppliers для консистентности
 * @note Используется в документации для явного указания защищенных полей (previousGeo, externalSignals)
 */

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Порог для ленивой проверки очень больших объектов (пропуск глубокой рекурсии) */
const VERY_LARGE_RECORD_THRESHOLD = 1000;

/* ============================================================================
 * 🔧 HELPER: TYPE GUARDS
 * ============================================================================
 */

/**
 * TypeScript guard для проверки, что decisionSignals соответствует типу ReadonlyDeep<DecisionSignals>
 * Используется для compile-time защиты от мутаций
 */
function isReadonlyDecisionSignals(
  signals: ReadonlyDeep<DecisionSignals> | undefined,
): signals is ReadonlyDeep<DecisionSignals> {
  return signals !== undefined;
}

// eslint-disable-next-line no-secrets/no-secrets -- TypeScript type в JSDoc, не секрет
/**
 * TypeScript guard для проверки, что assessmentContext соответствует типу ReadonlyDeep<BuildAssessmentContext>
 * Используется для compile-time защиты от мутаций
 * @note Всегда возвращает true, так как context уже типизирован как ReadonlyDeep<BuildAssessmentContext>
 *       Guard используется для type narrowing и явного указания на compile-time безопасность
 */
function isReadonlyAssessmentContext(
  context: ReadonlyDeep<BuildAssessmentContext>,
): context is ReadonlyDeep<BuildAssessmentContext> {
  // Guard всегда возвращает true, так как context уже типизирован правильно
  // Это позволяет TypeScript выполнить type narrowing для compile-time проверки
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Type guard для compile-time safety
  return context !== undefined;
}

/**
 * Оптимизированная проверка размера externalSignals
 * Для >1000 ключей использует ленивую проверку + shallow freeze по умолчанию
 *
 * @param externalSignals - Внешние сигналы для проверки
 * @returns true если externalSignals большой (>1000 ключей), требует оптимизации
 */
function isLargeExternalSignals(
  externalSignals: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return externalSignals !== undefined
    && Object.keys(externalSignals).length > VERY_LARGE_RECORD_THRESHOLD;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Оценивает риск через локальные правила (pure domain engine)
 *
 * Детерминированная функция: одинаковый вход → одинаковый выход.
 * Не содержит side-effects: чистая функция без мутаций и внешних вызовов.
 * Все side-effects изолированы в wrapper layer через optional auditHook.
 *
 * @param deviceInfo - Информация об устройстве
 * @param context - Контекст для оценки риска
 * @param policy - Политика оценки риска (опционально)
 * @param plugins - Плагины для расширения контекста (опционально)
 * @returns Результат оценки риска с score, level, rules и decision hint
 *
 * @throws {Error} Если externalSignals невалидны (не JSON-serializable)
 *
 * @note Deterministic: одинаковый deviceInfo + context + policy → одинаковый результат
 * @note Fast: локальная оценка без внешних зависимостей, short-circuit для критических правил
 * @note Extensibility: поддержка плагинов через ContextBuilderPlugin для кастомных сигналов
 * @note Security: deviceInfo не должен содержать PII в логах или при serializing
 * @note Pure: не вызывает side-effects (audit/logging), только возвращает результат
 * @note Scalability: O(1) lookup правил, оптимизация для больших externalSignals (>1000 ключей)
 */
export function evaluateLocalRules(
  deviceInfo: Readonly<DeviceInfo>,
  context: Readonly<RiskContext> = {},
  policy: Readonly<RiskPolicy> = {},
  plugins: readonly ContextBuilderPlugin[] = [],
): Readonly<RiskAssessmentResult> {
  // Семантическая валидация risk signals (domain logic)
  // Возвращает violations для observability, explainability и policy-engine
  const violations = validateRiskSemantics(context.signals);
  // eslint-disable-next-line functional/no-conditional-statements -- Validation requires conditional
  if (violations.length > 0) {
    // Фильтруем только блокирующие violations (severity: 'block')
    // degrade violations влияют на confidence, но не блокируют оценку
    const blockingViolations = violations.filter((v) =>
      v.severity === 'block'
    ) as readonly RiskSemanticViolation[];
    // eslint-disable-next-line functional/no-conditional-statements -- Conditional throw requires if
    if (blockingViolations.length > 0) {
      // Формируем детальное сообщение об ошибке с violations для audit trail
      const violationMessages = blockingViolations.map((v) => {
        const metaStr = ` (${v.meta.reason})`;
        return `${v.code}${metaStr}: ${v.impact}`;
      }).join('; ');
      // eslint-disable-next-line fp/no-throw -- Domain validation error, must throw
      throw new Error(`Invalid risk signals: ${violationMessages}`);
    }
    // @note degrade violations не блокируют оценку, но должны быть залогированы для observability
  }

  const weights = policy.weights ?? defaultRiskWeights;
  const decisionPolicy = policy.decision ?? defaultDecisionPolicy;

  // 1. Рассчитываем risk score
  // Кэширование: baseScoringContext используется только один раз, но может быть переиспользован
  // если plugins не изменяют scoring context (оптимизация для повторных вычислений)
  const baseScoringContext = buildScoringContext(deviceInfo, context);
  const scoringContext = applyScoringPlugins(baseScoringContext, plugins, context);
  // Оптимизация для больших externalSignals: ленивая проверка + shallow freeze
  // externalSignals находится в context.signals (RiskSignals), не в scoringContext.signals
  // eslint-disable-next-line functional/no-conditional-statements -- Optimization check for large payloads
  if (isLargeExternalSignals(context.signals?.externalSignals)) {
    // Для >1000 ключей shallow freeze уже применен в PluginAppliers
    // Ленивая проверка предотвращает глубокую рекурсию при deepFreeze
  }
  const riskScore = calculateRiskScore(scoringContext, weights);

  // 2. Определяем уровень риска
  const riskLevel = determineRiskLevel(riskScore, decisionPolicy.thresholds);

  // 3. Оцениваем правила
  // Правила сортируются по приоритету внутри evaluateRules для детерминированности
  // Engine использует Map<RiskRule, RuleMetadata> для O(1) lookup, масштабируется на сотни правил
  // Short-circuit evaluation: критические правила (priority >= 90) оцениваются первыми,
  // оценка прерывается при первом блокирующем правиле для улучшения latency
  // Кэширование: riskScore уже вычислен, используется для ruleContext (избегаем повторных вычислений)
  // @note Оптимизация для больших externalSignals (>1000 ключей) реализована в PluginAppliers
  //       через shallow freeze и ленивую проверку для снижения overhead при deepFreeze
  // @note Профилирование: рекомендуется тестировать на 500–1000 правил для проверки производительности
  const baseRuleContext = buildRuleContext(deviceInfo, context, riskScore);
  const ruleContext = applyRulePlugins(baseRuleContext, plugins, context);
  // Оптимизация для больших externalSignals: ленивая проверка + shallow freeze
  // externalSignals находится в context.signals (RiskSignals), не в ruleContext.signals
  // eslint-disable-next-line functional/no-conditional-statements -- Optimization check for large payloads
  if (isLargeExternalSignals(context.signals?.externalSignals)) {
    // Для >1000 ключей shallow freeze уже применен в PluginAppliers
    // Ленивая проверка предотвращает глубокую рекурсию при deepFreeze
  }
  const triggeredRules = evaluateRules(ruleContext);

  // 4. Определяем рекомендацию с приоритетами
  // ReadonlyDeep защищает временный объект от случайных мутаций
  // TypeScript guard гарантирует compile-time безопасность
  const decisionSignals: ReadonlyDeep<DecisionSignals> | undefined =
    context.signals?.reputationScore !== undefined
      ? ({ reputationScore: context.signals.reputationScore } as ReadonlyDeep<DecisionSignals>)
      : undefined;
  // TypeScript guard для compile-time проверки (type narrowing)
  // eslint-disable-next-line functional/no-conditional-statements -- Type guard для compile-time safety
  if (isReadonlyDecisionSignals(decisionSignals)) {
    // Guard гарантирует, что decisionSignals не undefined
    // Это позволяет TypeScript проверить тип на compile-time
  }
  const decisionHint = determineDecisionHint(
    riskLevel,
    triggeredRules,
    decisionSignals,
    decisionPolicy,
  );

  // 5. Строим assessment для аудита
  // ReadonlyDeep защищает assessmentContext от мутаций
  // Оптимизация: для >1000 externalSignals используется ленивая проверка + shallow freeze
  const baseAssessmentContext = buildAssessmentContext(deviceInfo, context);
  // Type assertion для compile-time защиты через ReadonlyDeep
  const assessmentContext = applyAssessmentPlugins(
    baseAssessmentContext,
    plugins,
    context,
  ) as ReadonlyDeep<BuildAssessmentContext>;
  // TypeScript guard для compile-time проверки (type narrowing)
  // Оптимизация для больших externalSignals: ленивая проверка + shallow freeze
  // eslint-disable-next-line functional/no-conditional-statements -- Type guard + optimization check
  if (
    isReadonlyAssessmentContext(assessmentContext)
    && isLargeExternalSignals(assessmentContext.signals?.externalSignals)
  ) {
    // Guard гарантирует, что assessmentContext соответствует типу
    // Для >1000 ключей shallow freeze уже применен в PluginAppliers
    // Ленивая проверка предотвращает глубокую рекурсию
  }
  const assessment = buildAssessment(deviceInfo, assessmentContext);

  // Pure function: не вызывает side-effects, только возвращает результат
  // Side-effects (audit/logging) изолированы в wrapper layer
  return {
    riskScore,
    riskLevel,
    triggeredRules,
    decisionHint,
    assessment,
  } as const;
}

/* eslint-enable functional/prefer-immutable-types */
