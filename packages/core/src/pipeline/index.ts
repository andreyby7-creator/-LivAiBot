/**
 * @file @livai/core/pipeline — Dependency-Driven Pipeline Engine API
 * Публичный API пакета pipeline.
 * Экспортирует все публичные компоненты, типы и утилиты для dependency-driven execution engine.
 */

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC PLUGIN API & CONTEXT
 * ============================================================================
 */

/**
 * Типы для dependency-driven pipeline execution engine.
 * StagePlugin для стадий pipeline, StageContext для контекста выполнения,
 * StageResult для effect-based API, PipelineConfig для конфигурации.
 * @public
 */

export {
  type FallbackStage,
  type PipelineConfig,
  type PipelineFailureReason,
  type PipelineResult,
  type SlotId,
  type StageContext,
  type StageError,
  type StageFailureReason,
  type StageId,
  type StageMetadata,
  type StagePlugin,
  type StageResult,
} from './plugin-api.js';

/* ============================================================================
 * 🔧 VALIDATION — PLUGIN & CONFIG VALIDATION
 * ============================================================================
 */

/**
 * Validation: функции для валидации plugin и конфигурации pipeline.
 * validatePlugin проверяет структуру и типы plugin.
 * validatePipelineConfig проверяет конфигурацию pipeline.
 * @public
 */

export { validatePipelineConfig, validatePlugin } from './plugin-api.js';

/* ============================================================================
 * 🏭 FACTORY HELPERS — УЛУЧШЕННЫЙ TYPE INFERENCE
 * ============================================================================
 */

/**
 * Factory Helpers: функции для создания стадий с улучшенным type inference.
 * defineStage гарантирует tuple type для provides через const assertion.
 * defineFallback создает fallback стадии (side-effect only).
 * @public
 */

export { defineFallback, defineStage } from './plugin-api.js';

/* ============================================================================
 * 🗂️ PLAN — EXECUTION PLAN BUILDING
 * ============================================================================
 */

/**
 * Execution Plan: функции и типы для построения immutable execution plan.
 * createExecutionPlan строит execution plan из массива плагинов с валидацией зависимостей,
 * топологической сортировкой и построением индексов для O(1) lookup.
 * ExecutionPlanError содержит типизированные ошибки построения плана.
 * Generic по TSlotMap, domain-agnostic, детерминированный.
 * @public
 */

export {
  createExecutionPlan,
  createExecutionPlanOrThrow,
  createExecutionPlanSafe,
} from './plan.js';

export type { ExecutionPlan, ExecutionPlanError } from './plan.js';

/* ============================================================================
 * ⚙️ ENGINE — EXECUTION ORCHESTRATION
 * ============================================================================
 */

/**
 * Engine: типы и фабрика для выполнения скомпилированного execution plan.
 * createPipelineEngine создает immutable engine с deterministic orchestration.
 * @public
 */

export { createPipelineEngine } from './engine.js';

export type { ExecutionState, StageExecutionResult } from './engine.js';

/* ============================================================================
 * 🧭 FACADE — POLICY-DRIVEN ORCHESTRATION
 * ============================================================================
 */

/**
 * Facade: единая точка входа для compile / execute / compile+execute
 * с rule-engine и расширяемыми обработчиками.
 * @public
 */

export { createAllowAllRule, createAllowedCommandsRule, createPipelineFacade } from './facade.js';

export type {
  CompileAndExecuteCommand,
  CompilePlanCommand,
  ExecutePlanCommand,
  FacadeAuditEvent,
  FacadeAuditHook,
  FacadePolicyRejectCode,
  FacadePolicyRejectReason,
  FacadeRuleDecision,
  PipelineFacade,
  PipelineFacadeCommand,
  PipelineFacadeCommandKind,
  PipelineFacadeFailure,
  PipelineFacadeOptions,
  PipelineFacadeResult,
  PipelineFacadeRule,
  PipelineFacadeSuccess,
} from './facade.js';

/* ============================================================================
 * 🚩 FEATURE FLAGS — ROLLOUT & A/B TESTING
 * ============================================================================
 */

/**
 * Feature Flags: функции и типы для управления rollout pipeline версий.
 * resolvePipelineMode разрешает режим выполнения на основе контекста.
 * resolveFeatureFlag возвращает полный результат с метаданными для observability.
 * Поддерживает multiple sources (tenant, user bucket, traffic percentage) с приоритетами.
 * Generic по контексту, domain-agnostic, детерминированный.
 * @public
 */

export {
  createCombinedResolver,
  createTenantResolver,
  createTrafficPercentageResolver,
  createUserBucketResolver,
  DEFAULT_ROLLOUT_CONFIG,
  getPipelineVersion,
  isActiveMode,
  isShadowMode,
  resolveFeatureFlag,
  resolvePipelineMode,
} from './feature-flags.js';

export type {
  FeatureFlagResolver,
  FeatureFlagResult,
  FeatureFlagSource,
  PipelineMode,
  PipelineVersion,
  ResolverPriority,
  RolloutConfig,
} from './feature-flags.js';

/* ============================================================================
 * 🚨 RUNTIME OVERRIDES — ON-CALL SAFETY SWITCHES
 * ============================================================================
 */

/**
 * Runtime Overrides: функции и типы для экстренного управления pipeline.
 * readRuntimeOverridesFromEnv читает overrides из environment variables через injectable provider.
 * applyRuntimeOverrides применяет overrides к конфигурации pipeline.
 * Поддерживает injectable env provider для deterministic testing.
 * Generic по конфигурации, domain-agnostic, детерминированный.
 * @public
 */

export {
  applyRuntimeOverrides,
  createCustomOverrideProvider,
  createDefaultEnvProvider,
  createDefaultOverrideMapper,
  createEnvProviderFromObject,
  DEFAULT_RUNTIME_OVERRIDES,
  getActiveOverrideKeys,
  hasActiveOverrides,
  readRuntimeOverridesFromEnv,
  validateRuntimeOverrides,
} from './runtime-overrides.js';

export type {
  EnvProvider,
  OverrideApplier,
  OverrideEvent,
  OverrideEventHandler,
  OverrideKey,
  OverridePriority,
  OverridePriorityMap,
  OverrideProvider,
  OverrideResult,
  OverrideSource,
  RuntimeOverride,
  RuntimeOverrides,
} from './runtime-overrides.js';

/* ============================================================================
 * 🔧 ERROR MODEL — PIPELINE ERROR HANDLING
 * ============================================================================
 */

/**
 * Error Model: функции и типы для обработки ошибок pipeline.
 * normalizePipelineError нормализует ошибки в типизированный PipelineError.
 * pipelineErrorToStageFailureReason преобразует PipelineError в StageFailureReason.
 * pipelineErrorToStageError преобразует PipelineError в StageError.
 * @public
 */

export {
  classifyError,
  createCancelledError,
  createCancelledErrorClass,
  createDependencyError,
  createExecutionError,
  createIsolationError,
  createIsolationErrorClass,
  createPipelineError,
  createPipelineErrorMetadata,
  createPipelineStageError,
  createTimeoutError,
  createTimeoutErrorClass,
  isCancelledError,
  isIsolationError,
  isPipelineStageError,
  isTimeoutError,
  isValidPipelineErrorMetadata,
  normalizePipelineError,
  pipelineErrorToBrandedStageError,
  pipelineErrorToStageError,
  pipelineErrorToStageFailureReason,
  stageFailureReasonToPipelineError,
  validatePipelineErrorMetadata,
} from './errors.js';

export type {
  BrandedStageError,
  CancelledError,
  IsolationError,
  PipelineError,
  PipelineErrorMetadata,
  PipelineStageError,
  TimeoutError,
} from './errors.js';

/* ============================================================================
 * 🛡️ SAFETY GUARD — AUTO-ROLLBACK & QUALITY PROTECTION
 * ============================================================================
 */

/**
 * Safety Guard: функции и типы для автоматического отката при деградации метрик.
 * evaluateSafetyGuard оценивает метрики через rule engine.
 * updateSafetyGuardState обновляет состояние guard'а с новыми метриками.
 * Поддерживает extensible rule engine с приоритетами и event hooks для мониторинга.
 * Generic по метрикам и конфигурации rollout, domain-agnostic, детерминированный.
 * @public
 */

export {
  compareRulePriorities,
  createCombinedRule,
  createMinMeasurementsRule,
  createRollbackConfig,
  createThresholdRule,
  DEFAULT_RULE_PRIORITY,
  evaluateSafetyGuard,
  getRulePriority,
  RULE_PRIORITY_ORDER,
  shouldResetMetricsWindow,
  sortRuleResultsByPriority,
  updateSafetyGuardState,
} from './safety-guard.js';

export type {
  MetricsAggregator,
  RollbackConfigFactory,
  RollbackEvent,
  RuleEvent,
  RuleEventHandler,
  RulePriority,
  SafetyGuardConfig,
  SafetyGuardResult,
  SafetyGuardState,
  SafetyRule,
  SafetyRuleResult,
  ThresholdComparator,
} from './safety-guard.js';

/* ============================================================================
 * 🔄 REPLAY — EVENT CAPTURE & OFFLINE TESTING
 * ============================================================================
 */

/**
 * Replay: функции и типы для захвата событий pipeline для офлайн replay и тестирования.
 * createReplayEvent создает replay event из данных pipeline.
 * captureReplayEvent сохраняет событие (если включено и проходит фильтры).
 * Поддерживает extensible filter engine и sanitizer engine для PII removal.
 * Generic по типам событий, контекста и метаданных, domain-agnostic, детерминированный.
 * @public
 */

export {
  applyFilters,
  captureReplayEvent,
  createCombinedFilter,
  createCombinedSanitizer,
  createFieldRemovalSanitizer,
  createReplayEvent,
  createTransformSanitizer,
  DEFAULT_INCLUDE_PII,
  DEFAULT_MAX_EVENTS_PER_MINUTE,
  defaultEventIdGenerator,
  deterministicEventIdGenerator,
  formatTimestamp,
  shouldCaptureEvent,
} from './replay.js';

export type {
  CaptureResult,
  ContextSanitizer,
  EventIdGenerator,
  FilterEvent,
  FilterEventHandler,
  MetadataFactory,
  ReplayCaptureConfig,
  ReplayEvent,
  ReplayEventFilter,
  ReplayEventSaver,
} from './replay.js';

/* ============================================================================
 * 🔌 ADAPTERS — RUNTIME ADAPTERS & CANCELLATION
 * ============================================================================
 */

/**
 * Adapters: функции и типы для адаптации различных async runtime'ов в pipeline execution engine.
 * adaptEffectLibrary адаптирует Effect library эффект в PipelineEffect.
 * createRuntimeAdapter создает generic адаптер для любого runtime'а.
 * withTimeout добавляет таймаут к pipeline эффекту.
 * Generic по типам результата и runtime, domain-agnostic, детерминированный.
 * @public
 */

export {
  adaptEffectLibrary,
  AdapterTimeoutError,
  CancellationError,
  createAbortPromise,
  createRuntimeAdapter,
  createTimeoutPromise,
  DEFAULT_CANCELLATION_MESSAGE,
  DEFAULT_TIMEOUT_MESSAGE,
  isAborted,
  isAdapterTimeoutError,
  isCancellationError,
  withTimeout,
} from './adapter.js';

export type {
  AdapterConfig,
  AdapterEvent,
  AdapterEventHandler,
  AdapterEventType,
  AdapterResult,
  PipelineEffect,
  RuntimeAdapter,
  RuntimeAdapterFactory,
} from './adapter.js';
