/**
 * @file packages/domains/src/classification/strategies — Classification Strategies
 *
 * Публичный API пакета strategies.
 * Экспортирует все публичные компоненты, типы и утилиты для classification-специфичных стратегий.
 */

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION RULES TYPES
 * ============================================================================
 */

/**
 * Типы для classification rules.
 * ClassificationRule для идентификации правил, RuleEvaluationContext для контекста оценки,
 * RuleMetadata для метаданных правил.
 *
 * @public
 */
export type {
  ClassificationRule,
  ClassificationRuleConfig,
  DeviceInfo,
  RuleAction,
  RuleContextMetadata,
  RuleEvaluationContext,
  RuleIdentifier,
  RuleMetadata,
  RuleSignals,
  RuleVersion,
  VersionedRuleDefinition,
} from './rules.js';

/* ============================================================================
 * 🔧 RULES — CLASSIFICATION RULES MODULE
 * ============================================================================
 */

/**
 * Classification Rules: определение и оценка classification-специфичных правил.
 * Использует generic rule-engine из @livai/core для вычислений.
 *
 * @public
 */
export {
  allRules,
  clearEnabledRulesCache,
  compositeRules,
  deviceRules,
  evaluateRuleActions,
  evaluateRules,
  geoRules,
  getMaxPriority,
  getRuleDefinition,
  getRulesWithDecisionImpact,
  networkRules,
  sortRulesByPriority,
} from './rules.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION ASSESSMENT TYPES
 * ============================================================================
 */

/**
 * Типы для classification assessment.
 * ContextBuilderPlugin для расширения контекста, ClassificationPolicy для политики,
 * AssessmentResult для typed error handling.
 * @note ScoringContext экспортируется из aggregation/index.ts
 *
 * @public
 */
export type { AssessmentResult, ClassificationPolicy, ContextBuilderPlugin } from './assessment.js';

/* ============================================================================
 * 🎯 ASSESSMENT — CLASSIFICATION ASSESSMENT MODULE
 * ============================================================================
 */

/**
 * Classification Assessment: composition layer для оценки классификации.
 * Объединяет rules, scoring и decision engine.
 *
 * @public
 */
export { assessClassification } from './assessment.js';

/* ============================================================================
 * 🎯 DETERMINISTIC STRATEGY — CLASSIFICATION DETERMINISTIC STRATEGY MODULE
 * ============================================================================
 */

/**
 * Типы для classification deterministic strategy.
 * ContextBuilderPlugin для расширения контекста, EvaluateClassificationRulesOptions для опций.
 *
 * @public
 */
export type {
  ContextBuilderPlugin as DeterministicContextBuilderPlugin,
  EvaluateClassificationRulesOptions,
} from './deterministic.strategy.js';

/**
 * Classification Deterministic Strategy: pure domain engine для оценки классификации.
 * Использует generic rule-engine из @livai/core для вычислений.
 * НЕ использует score-calculator (это в aggregation/).
 *
 * @public
 */
export { evaluateClassificationRules } from './deterministic.strategy.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION CONFIGURATION TYPES
 * ============================================================================
 */

/**
 * Типы для classification rules configuration.
 * ClassificationRulesConfig для динамической конфигурации,
 * RuleThresholds для порогов правил, RuleFeatureFlag для feature flags.
 *
 * @public
 */
export type {
  BaseRuleThresholds,
  ClassificationRulesConfig,
  ConfigChangeCallback,
  RuleConfigVersion,
  RuleFeatureFlag,
  RuleThresholds,
} from './config.js';

/* ============================================================================
 * ⚙️ CONFIGURATION — CLASSIFICATION RULES CONFIGURATION MODULE
 * ============================================================================
 */

/**
 * Classification Rules Configuration: динамическая конфигурация правил.
 * Поддерживает обновление конфигурации без перекомпиляции,
 * versioned rules для A/B testing и staged rollouts,
 * feature flags для постепенного включения правил.
 *
 * @public
 */
export {
  classificationRulesConfigManager,
  DEFAULT_CLASSIFICATION_RULES_CONFIG,
  DEFAULT_CRITICAL_RULE_PRIORITY_THRESHOLD,
  DEFAULT_HIGH_RISK_COUNTRIES,
  DEFAULT_RULE_THRESHOLDS,
  getClassificationRulesConfig,
  isClassificationRuleEnabled,
  registerClearEnabledRulesCacheCallback,
  registerConfigChangeCallback,
  resetClassificationRulesConfig,
  unregisterConfigChangeCallback,
  updateClassificationRulesConfig,
} from './config.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION VALIDATION TYPES
 * ============================================================================
 */

/**
 * Типы для classification validation.
 * ClassificationSemanticValidator для явного контракта валидатора.
 *
 * @public
 */
export type { ClassificationSemanticValidator } from './validation.js';

/* ============================================================================
 * ✅ VALIDATION — CLASSIFICATION VALIDATION MODULE
 * ============================================================================
 */

/**
 * Classification Validation: семантическая валидация classification signals.
 * Использует semanticViolationValidator из signals/violations.ts.
 * Явный контракт через ClassificationSemanticValidator для стабильности в strategy layer.
 *
 * @public
 */
export { validateClassificationSemantics } from './validation.js';
