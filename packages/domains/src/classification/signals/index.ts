/**
 * @file @livai/domains/classification/signals — Classification Signals & Context
 * Публичный API пакета classification signals.
 * Экспортирует все публичные компоненты, типы и утилиты для classification signals и context.
 */

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION SIGNALS TYPES
 * ============================================================================
 */

/**
 * Типы для classification signals.
 * ClassificationGeo для геолокации, InternalClassificationSignals для domain layer,
 * ExternalClassificationSignals для vendor signals, ClassificationSignals для объединения.
 * Разделение internal/external для чистоты domain и безопасности.
 * @public
 */

export type {
  BuildClassificationContext,
  ClassificationContext,
  ClassificationGeo,
  ClassificationSignals,
  ExternalClassificationSignals,
  InternalClassificationSignals,
} from './signals.js';

/* ============================================================================
 * 🏗️ CLASSIFICATION SIGNALS — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Classification Signals value object: создание, валидация, утилиты.
 * Создание internal signals из объекта с валидацией (whitelist keys для security).
 * Создание external signals из объекта (plain object проверка, защита от class instances).
 * Создание полных signals (internal + external) с whitelist keys для предотвращения
 * silent data propagation и rule bypass через unknown keys.
 * Shallow copy для защиты от мутаций исходных объектов.
 * @public
 */

export { classificationSignals } from './signals.js';

/* ============================================================================
 * 🏗️ CLASSIFICATION CONTEXT — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Classification Context value object: создание, валидация, утилиты.
 * Создание context из объекта с валидацией всех полей (ip, geo, userId, signals, timestamp).
 * Валидация строковых полей, геолокации, signals через соответствующие модули.
 * Поддержка branded types (label, evaluationScale) для type safety.
 * @public
 */

export { classificationContext } from './signals.js';

/* ============================================================================
 * 🧩 ТИПЫ — SEMANTIC VIOLATION TYPES
 * ============================================================================
 */

/**
 * Типы для semantic violations.
 * SemanticViolation - discriminated union для type safety и exhaustive checking.
 * SemanticViolationCode выводится из SemanticViolation['code'] для single source of truth.
 * Метаданные для каждого типа нарушения (ScoreViolationMeta, CoordinatesViolationMeta, etc.).
 * Причины нарушений (ScoreViolationReason, CoordinateViolationReason, etc.).
 * Строгость, область влияния и влияние нарушения для policy-engine и explainability.
 * @public
 */

export type {
  CoordinatesViolationMeta,
  CoordinateViolationReason,
  IncompleteCoordinatesReason,
  IncompleteCoordinatesViolationMeta,
  ScoreViolationMeta,
  ScoreViolationReason,
  SemanticViolation,
  SemanticViolationAffects,
  SemanticViolationCode,
  SemanticViolationImpact,
  SemanticViolationSeverity,
} from './violations.js';

/* ============================================================================
 * 🔧 SEMANTIC VIOLATION VALIDATOR — VALIDATION MODULE
 * ============================================================================
 */

/**
 * Semantic Violation Validator: валидация classification signals на семантические нарушения.
 * Composable validators для reputation score, velocity score, coordinates.
 * Возвращает массив SemanticViolation для policy-engine и explainability.
 * Immutable подход: фильтрация undefined вместо мутации массива.
 * @public
 */

export { semanticViolationValidator } from './violations.js';
