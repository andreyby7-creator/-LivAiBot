/**
 * @file @livai/core — Public API для Core пакета
 * Публичный API пакета @livai/core.
 * Экспортирует все публичные компоненты, типы, утилиты и политики для core domain logic.
 * Tree-shakeable: все named exports остаются, импорты будут по нужным компонентам.
 */

/* ============================================================================
 * 🛡️ DATA-SAFETY — ОТСЛЕЖИВАНИЕ ЗАРАЖЕНИЯ И КОНТРОЛЬ ИНФОРМАЦИОННЫХ ПОТОКОВ
 * ========================================================================== */

/**
 * Data Safety подпакет: taint tracking, IFC, trust levels, sanitization.
 * Включает input/output boundaries, propagation tracking и structural clone.
 * @public
 */
export * from './data-safety/index.js';

/* ============================================================================
 * 🛡️ INPUT-BOUNDARY — ВАЛИДАЦИЯ И ТРАНСФОРМАЦИЯ DTO
 * ========================================================================== */

/**
 * Input Boundary подпакет: валидация DTO, type guards, JSON-serialization, projection engine, context enricher.
 * Включает generic validation, rule engine, projection engine для domain → DTO трансформации,
 * и context enricher для обогащения контекста метаданными.
 * @public
 */
export * from './input-boundary/index.js';

/* ============================================================================
 * 📋 POLICIES — БИЗНЕС-ПОЛИТИКИ И ПРАВИЛА ДОСТУПА
 * ========================================================================== */

/**
 * Business Policies: авторизация, права доступа, биллинг, чат.
 * Rule-engine архитектура для extensible security и business rules.
 * Включает AuthPolicy, BotPermissions, BotPolicy, ChatPolicy, BillingPolicy, ComposedPolicy.
 * @public
 */
export * from './policies/index.js';

/* ============================================================================
 * 📊 TELEMETRY — BATCH CORE & CLIENT
 * ============================================================================
 */

/**
 * Telemetry подпакет: чистое batch ядро телеметрии и runtime-зависимый клиент.
 * Включает batch core для накопления и обработки телеметрических событий,
 * runtime-зависимый клиент с queue и throttle, sink factories с retry логикой.
 *
 * Доступен как через subpath `@livai/core/telemetry`,
 * так и через главный индекс `@livai/core` под неймспейсом `telemetry`.
 *
 * Рекомендуется для feature-пакетов импортировать из `@livai/core/telemetry`
 * для явного разграничения слоев, но экспорт через главный индекс оставлен
 * для удобства и tree-shakeable usage.
 * @public
 */
export * as telemetry from './telemetry/index.js';

/* ============================================================================
 * 🧩 DOMAIN-KIT — DECISION ALGEBRA & PROBABILITY/UNCERTAINTY
 * ========================================================================== */
/**
 * Domain Kit подпакет: decision algebra, probability/uncertainty, domain-specific labels.
 * Включает EvaluationLevel (decision algebra с lattice ordering), Confidence (probability/uncertainty),
 * Label (domain-specific string labels с extensible validation).
 * Branded types с phantom generic для type safety между доменами.
 * @public
 */
export * from './domain-kit/index.js';

/* ============================================================================
 * 📊 AGGREGATION — GENERIC AGGREGATION SEMANTICS
 * ========================================================================== */
/**
 * Aggregation подпакет: generic агрегация значений с весами.
 * Включает Reducer (generic reduction functions), Weight (weight operations),
 * Scoring (scoring operations), и extensible algebra для custom aggregators.
 * Чистые функции без side-effects, только generic math.
 * Effect-based API (ReduceResult, WeightResult, ScoreResult) для composability.
 * @public
 */
export * from './aggregation/index.js';

/* ============================================================================
 * ⚙️ RULE-ENGINE — GENERIC PREDICATE & RULE OPERATIONS
 * ========================================================================== */
/**
 * Rule Engine подпакет: generic операции с предикатами и правилами.
 * Включает Predicate (generic predicate operations), Rule (generic rule operations),
 * Evaluator (generic rule evaluation), и extensible algebra для custom operations.
 * Чистые функции без side-effects, только generic operations.
 * Effect-based API (PredicateResult, RuleResult, EvaluationResult) для composability.
 * @public
 */
export * from './rule-engine/index.js';

/* ============================================================================
 * 🛡️ RESILIENCE — RELIABILITY PRIMITIVES
 * ========================================================================== */
/**
 * Resilience подпакет: reliability primitives для отказоустойчивости.
 * Включает deterministic circuit breaker как pure state machine без side-effects.
 * @public
 */
export * from './resilience/index.js';

/* ============================================================================
 * 🔄 PIPELINE — DEPENDENCY-DRIVEN EXECUTION ENGINE
 * ========================================================================== */
/**
 * Pipeline подпакет: generic dependency-driven execution engine API.
 * Включает StagePlugin (compile-time provides/slots enforcement), StageContext,
 * factory helpers (defineStage, defineFallback), validation (validatePlugin, validatePipelineConfig).
 * Pipeline автоматически определяет порядок выполнения на основе provides/dependsOn.
 * НЕ middleware chain — это dependency-driven execution engine.
 * Effect-based API (StageResult, PipelineResult) для composability.
 * @public
 */
export * from './pipeline/index.js';

/* ============================================================================
 * ⚡ EFFECT — SIDE-EFFECTS & ERROR HANDLING
 * ========================================================================== */
/**
 * Effect подпакет: универсальные утилиты для side-effects, error-mapping и validation.
 * Включает Effect, Result<T, E>, timeout, retry, isolation, orchestration,
 * schema validation, error mapping, и функциональную подсистему валидации.
 * Domain-agnostic слой без зависимостей от runtime/UI.
 *
 * Доступен как через subpath `@livai/core/effect`,
 * так и через главный индекс `@livai/core` под неймспейсом `effect`.
 *
 * Рекомендуется для feature-пакетов импортировать из `@livai/core/effect`
 * для явного разграничения слоев, но экспорт через главный индекс оставлен
 * для удобства и tree-shakeable usage.
 * @public
 */
export * as effect from './effect/index.js';

/* ============================================================================
 * 🔢 HASH — DETERMINISTIC HASH UTILITIES
 * ========================================================================== */
/**
 * Hash utilities: non-cryptographic deterministic hash (MurmurHash3).
 * Используется в feature flags и pipeline rollout.
 * @public
 */
export * from './hash.js';

/* ============================================================================
 * 🚩 FEATURE-FLAGS — FEATURE FLAG ENGINE
 * ========================================================================== */
/**
 * Feature Flags: детерминированный engine для управления feature flags.
 * Core engine без React/env/console зависимостей.
 * React части доступны через subpath `@livai/core/feature-flags/react`.
 * @public
 */
export * from './feature-flags/index.js';

/* ============================================================================
 * 🔌 TRANSPORT — TRANSPORT LAYER (SSE, WebSocket)
 * ========================================================================== */
/**
 * Transport подпакет: универсальные транспортные протоколы (SSE, WebSocket) для всех пакетов.
 * Включает SSE и WebSocket runtime как детерминированные FSM с поддержкой браузера и Node.js через адаптеры.
 * Не привязан к app-слою, переиспользуем в backend и других фронтах.
 *
 * Доступен как через subpath `@livai/core/transport`,
 * так и через главный индекс `@livai/core` под неймспейсом `transport`.
 *
 * Рекомендуется для feature-пакетов импортировать из `@livai/core/transport`
 * для явного разграничения слоев, но экспорт через главный индекс оставлен
 * для удобства и tree-shakeable usage.
 * @public
 */
export * as transport from './transport/index.js';
