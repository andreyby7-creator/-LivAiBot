/**
 * @file @livai/core/input-boundary — Generic Validation (DTO Guards)
 * Публичный API пакета input-boundary.
 * Экспортирует все публичные компоненты, типы и утилиты для структурной валидации DTO.
 */

/* ============================================================================
 * 🔍 TYPE GUARDS — БАЗОВЫЕ ТИПЫ
 * ========================================================================== */

/**
 * Type guards для базовых типов.
 * Проверка типов значений: string, number, boolean, null, undefined, array, object.
 * Фильтрация symbol-ключей для безопасности.
 * @public
 */

export {
  isArray,
  isBoolean,
  isNull,
  isNullOrUndefined,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from './generic-validation.js';

/* ============================================================================
 * 📋 JSON-SERIALIZABLE VALIDATION
 * ========================================================================== */

/**
 * Проверка JSON-сериализуемости значений.
 * Рекурсивная проверка структуры без циклических ссылок.
 * Замораживание объектов для immutability.
 * @public
 */

export {
  isJsonPrimitive,
  isJsonSerializable,
  type JsonArray,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue,
} from './generic-validation.js';

/* ============================================================================
 * 🏗️ STRUCTURAL VALIDATION — ОБЪЕКТЫ
 * ========================================================================== */

/**
 * Структурная валидация объектов (shape validation).
 * Проверка наличия обязательных свойств и их типов.
 * Поддержка path accumulation для глубокого error reporting.
 * @public
 */

export {
  getProperty,
  hasProperties,
  hasProperty,
  validateObjectShape,
} from './generic-validation.js';

/* ============================================================================
 * 🎯 VALIDATION OUTCOME — EFFECT-BASED API
 * ========================================================================== */

/**
 * Effect-based API для результатов валидации.
 * ValidationOutcome<T> для composability в pipelines.
 * Строгая типизация причин ошибок через union types.
 * @public
 */

export { type ValidationFailureReason, type ValidationOutcome } from './generic-validation.js';

/* ============================================================================
 * 🔧 RULE ENGINE — EXTENSIBLE VALIDATION
 * ========================================================================== */

/**
 * Rule engine для extensible валидации.
 * Registry pattern: invariants (обязательные) + policies (расширяемые).
 * Composable predicates: andRule, orRule, notRule.
 * @public
 */

export {
  andRule,
  defaultValidationRuleRegistry,
  notRule,
  orRule,
  registerRule,
  validate,
  type ValidationContext,
  type ValidationRule,
  type ValidationRuleRegistry,
} from './generic-validation.js';

/* ============================================================================
 * 🎯 PROJECTION ENGINE — DOMAIN → BOUNDARY CONTRACTS
 * ========================================================================== */

/**
 * Projection Engine для трансформации domain объектов в boundary contracts (DTO, events, persistence, audit).
 * Архитектура: selection → enrichment slots (contributions) → merge (conflict detection) → safe-keys validation → freeze
 * @public
 */

export {
  type DtoFieldMapper,
  type DtoSchema,
  type ProjectionSlot,
  type TransformationContext,
  type TransformationFailureReason,
  type TransformationOutcome,
  transformDomainsToDtos,
  transformDomainToDto,
  transformDomainToPartialDto,
} from './projection-engine.js';

/* ============================================================================
 * 🎯 CONTEXT ENRICHER — CONTEXT → METADATA SIGNALS
 * ========================================================================== */

/**
 * Context Enricher для обогащения контекста метаданными на input boundary.
 * Архитектура: dependency-driven execution (signal-based DAG) → conflict detection → collect all errors
 * Поддержка telemetry через EnrichmentObserver для production monitoring
 * @public
 */

export {
  type ContextEnricher,
  defaultEnricherRegistry,
  enrichContext,
  type EnricherRegistry,
  type EnrichmentError,
  type EnrichmentObserver,
  type EnrichmentResult,
  registerEnricher,
} from './context-enricher.js';

/* ============================================================================
 * 🛡️ API SCHEMA GUARD — API CONTRACT VALIDATION
 * ========================================================================== */

/**
 * API Schema Guard: валидация запросов/ответов API на boundary-слое.
 * @public
 */
export {
  type ApiRequestValidator,
  type ApiResponseValidator,
  type ApiSchemaConfig,
  type ApiValidationContext,
  type ApiValidationError,
  type ApiValidationErrorCode,
  combineRequestValidators,
  combineResponseValidators,
  createRestApiSchema,
  createZodRequestValidator,
  createZodResponseValidator,
  enforceStrictValidation,
  getDefaultStrictMode,
  validateApiInteraction,
  validateApiRequest,
  validateApiResponse,
  validateSchemaVersion,
} from './api-schema-guard.js';
