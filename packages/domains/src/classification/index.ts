/**
 * @file @livai/domains/classification — Classification Domain (Domain-Specific Labels & Signals)
 *
 * Публичный API пакета classification domain.
 * Экспортирует все публичные компоненты, типы и утилиты для classification labels и signals.
 */

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION LABELS TYPES
 * ============================================================================
 */

/**
 * Типы для classification labels.
 * Union type выводится из CLASSIFICATION_LABELS для single source of truth.
 * Branded types через Label<T> для type safety между доменами.
 *
 * @public
 */

export type {
  ClassificationLabel,
  ClassificationLabelOutcome,
  ClassificationLabelValue,
} from './labels.js';

/* ============================================================================
 * 📋 КОНСТАНТЫ — SINGLE SOURCE OF TRUTH
 * ============================================================================
 */

/**
 * Массив допустимых значений classification labels.
 * Single source of truth: тип выводится из массива для предотвращения рассинхронизации.
 *
 * @public
 */

export { CLASSIFICATION_LABELS } from './labels.js';

/**
 * Валидационные границы для classification domain.
 * Single source of truth для всех модулей classification domain.
 * - GEO_VALIDATION: границы для геолокации (WGS84)
 * - SCORE_VALIDATION: границы для scores (reputation, velocity)
 *
 * @public
 */
export { GEO_VALIDATION, SCORE_VALIDATION } from './constants.js';

/* ============================================================================
 * 🏗️ CLASSIFICATION LABEL — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Classification Label value object: создание, валидация, сериализация, type guards.
 * Thin wrapper над generic label API из @livai/core/domain-kit.
 * Создание label из строки с валидацией через whitelist validator.
 * Автоматическая нормализация (trim) для защиты от пробельных строк.
 * Десериализация с проверкой для защиты от forged labels.
 *
 * @public
 */

export { classificationLabel } from './labels.js';

/* ============================================================================
 * 🔧 CLASSIFICATION LABEL UTILS — PURE LABEL HELPERS
 * ============================================================================
 */

/**
 * Classification Label Utils: pure helpers для работы с labels.
 * Гибридный подход:
 * - Семантические методы (isSafe, isSuspicious, etc.) для частых случаев и читаемости
 * - Универсальный hasValue() для динамических проверок и масштабируемости
 * Только операции над самими labels, без business logic.
 *
 * @public
 */

export { classificationLabelUtils } from './labels.js';

/* ============================================================================
 * 📋 CLASSIFICATION POLICY — BUSINESS LOGIC (DECLARATIVE POLICY MAP)
 * ============================================================================
 */

/**
 * Classification Policy: business logic через declarative policy map.
 * Single source of truth для business logic, легко расширяется без изменения кода.
 * Использует O(1) lookup вместо if/else для rule-engine scalability.
 * Определяет requiresReview и isCritical для каждого label типа.
 *
 * @public
 */

export { classificationPolicy } from './labels.js';

/* ============================================================================
 * 📡 CLASSIFICATION SIGNALS — SIGNALS & CONTEXT MODULE
 * ============================================================================
 */

/**
 * Classification Signals подпакет: domain-specific signals и context для classification.
 * Включает ClassificationSignals (internal + external), ClassificationContext (контекст для оценки),
 * classificationSignals (value object для создания и валидации signals),
 * classificationContext (value object для создания и валидации context).
 * Использует generic типы из @livai/core/domain-kit (EvaluationLevel, Confidence, EvaluationScale).
 * Разделение internal/external signals для чистоты domain и безопасности.
 * Whitelist keys для security-correct извлечения signals (предотвращает silent data propagation).
 *
 * @public
 */
export * from './signals/index.js';

/* ============================================================================
 * 📊 CLASSIFICATION EVALUATION — EVALUATION RESULT MODULE
 * ============================================================================
 */

/**
 * Classification Evaluation подпакет: domain-specific evaluation result для classification.
 * Включает ClassificationEvaluationResult (результат оценки с evaluationLevel, confidence, label, scale).
 * Использует generic типы из @livai/core/domain-kit (EvaluationLevel, Confidence, EvaluationScale).
 * Строгая типизация usedSignals через keyof ClassificationSignals для предотвращения drift.
 *
 * @public
 */
export * from './evaluation/index.js';

/* ============================================================================
 * 📊 CLASSIFICATION AGGREGATION — RISK SCORING MODULE
 * ============================================================================
 */

/**
 * Classification Aggregation подпакет: risk scoring и weights для classification.
 * Включает RiskFactor (registry-style архитектура), RiskWeights (конфигурация весов),
 * calculateRiskScore (основной API для расчета risk score с RiskWeights),
 * calculateRiskScoreWithCustomFactors (API для расчета с кастомными факторами),
 * validateRiskWeights (валидация risk weights).
 * Использует generic aggregation semantics из @livai/core.
 *
 * @public
 */
export * from './aggregation/index.js';

/* ============================================================================
 * 🎯 CLASSIFICATION STRATEGIES — RULES, ASSESSMENT, VALIDATION MODULE
 * ============================================================================
 */

/**
 * Classification Strategies подпакет: classification-специфичные стратегии для оценки классификации.
 * Включает rules (определение и оценка правил), assessment (composition layer),
 * deterministic.strategy (pure domain engine), validation (семантическая валидация signals).
 * Использует generic rule-engine из @livai/core для вычислений.
 * НЕ использует score-calculator (это в aggregation/).
 *
 * @public
 */
export * from './strategies/index.js';

/* ============================================================================
 * 🔌 CLASSIFICATION PROVIDERS — EXTERNAL SIGNAL PROVIDERS (PIPELINE STAGES)
 * ============================================================================
 */

/**
 * Classification Providers подпакет: provider stages для внешних источников сигналов.
 * Содержит stage-фабрики, совместимые с `@livai/core/pipeline` (`StagePlugin<TSlotMap>`),
 * для интеграции remote/vended сигналов в slot graph.
 *
 * @public
 */
export * from './providers/index.js';
