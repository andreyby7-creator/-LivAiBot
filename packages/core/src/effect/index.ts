/**
 * @file @livai/core/effect — Effect Layer (Side-Effects & Error Handling)
 * Публичный API пакета effect.
 * Экспортирует все публичные компоненты, типы и утилиты для side-effects, error-mapping и validation.
 */

/* ============================================================================
 * ⚡ EFFECT UTILS — БАЗОВЫЕ ТИПЫ И УТИЛИТЫ
 * ========================================================================== */

/**
 * Базовые типы и утилиты для эффектов.
 * Включает Effect, EffectContext, Result<T, E>, EffectError, retry, timeout, cancellation.
 * @public
 */

export type {
  Effect,
  EffectAbortController,
  EffectContext,
  EffectError,
  EffectErrorKind,
  EffectFn,
  EffectLogger,
  EffectResult,
  EffectTimer,
  Result,
  RetryPolicy,
} from './effect-utils.js';

// Re-export TraceId from core-contracts for convenience
export type { TraceId } from '@livai/core-contracts';

export {
  asApiEffect,
  combineAbortSignals,
  createEffectAbortController,
  defaultTimer,
  fail,
  flatMap,
  isFail,
  isOk,
  map,
  mapError as mapResultError,
  ok,
  pipeEffects,
  safeExecute,
  sleep,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  withLogging,
  withRetry,
} from './effect-utils.js';

/* ============================================================================
 * ⏱ EFFECT TIMEOUT — TIMEOUT УТИЛИТЫ
 * ========================================================================== */

/**
 * Timeout утилиты для эффектов.
 * Включает TimeoutError, TimeoutOptions, withTimeout, createTimeoutContext.
 * @public
 */

export type { TimeoutEffectContext, TimeoutOptions } from './effect-timeout.js';

export {
  createTimeoutContext,
  isTimeoutError,
  TimeoutError,
  withTimeout,
} from './effect-timeout.js';

/* ============================================================================
 * 🔒 EFFECT ISOLATION — ИЗОЛЯЦИЯ ЭФФЕКТОВ
 * ========================================================================== */

/**
 * Isolation утилиты для безопасного выполнения эффектов.
 * Включает IsolationError, IsolationOptions, runIsolated.
 * @public
 */

export type { IsolationOptions } from './effect-isolation.js';

export { isIsolationError, IsolationError, runIsolated } from './effect-isolation.js';

/* ============================================================================
 * 🎼 ORCHESTRATOR — КОМПОЗИЦИЯ АСИНХРОННЫХ ОПЕРАЦИЙ
 * ========================================================================== */

/**
 * Orchestrator для безопасной композиции асинхронных операций.
 * Включает Step, StepResult, step, orchestrate.
 * @public
 */

export type { Step, StepResult } from './orchestrator.js';

export type { EffectWithPrevious, OrchestratorTelemetry } from './orchestrator.js';

export { createOrchestrator, orchestrate, step, stepWithPrevious } from './orchestrator.js';

/* ============================================================================
 * ✅ SCHEMA VALIDATED EFFECT — ZOD ВАЛИДАЦИЯ РЕЗУЛЬТАТОВ
 * ========================================================================== */

/**
 * Schema-validated effect для валидации результатов через Zod-подобные схемы.
 * Включает ValidatedEffectOptions, SchemaValidationError, validatedEffect.
 * @public
 */

export type { ValidatedEffectOptions } from './schema-validated-effect.js';

export {
  isSchemaValidationError,
  SchemaValidationError,
  validatedEffect,
  zodIssuesToValidationErrors,
} from './schema-validated-effect.js';

/* ============================================================================
 * 🔹 ERROR MAPPING — УНИВЕРСАЛЬНЫЙ МАППИНГ ОШИБОК
 * ========================================================================== */

/**
 * Универсальный mapper для любых DomainError.
 * Включает TaggedError, ServiceErrorCode, MappedError, mapError, mapErrorBoundaryError.
 * @public
 */

export type {
  ErrorBoundaryTelemetryData,
  ErrorMapper,
  MapErrorBoundaryConfig,
  MapErrorBoundaryResult,
  MapErrorConfig,
  MappedError,
  SafeOriginError,
  ServiceErrorCode,
  ServicePrefix,
  TaggedError,
  ValidationErrorLike,
} from './error-mapping.js';

export {
  chainMappers,
  createDomainError,
  errorMessages,
  kindToErrorCode,
  mapError,
  mapErrorBoundaryError,
  SERVICES,
} from './error-mapping.js';

/* ============================================================================
 * 🔹 VALIDATION — ФУНКЦИОНАЛЬНАЯ ПОДСИСТЕМА ВАЛИДАЦИИ
 * ========================================================================== */

/**
 * Функциональная подсистема валидации.
 * Включает ValidationSchema, ValidationContext, ValidationError, ValidationResult,
 * Validator, ObjectSchema, validateObject, validateForm, validateFileBasic.
 * @public
 */

export type {
  AsyncValidator,
  FormValidationResult,
  // validateFormData возвращает FormValidationResult (переэкспорт типа уже покрывает)
  ObjectSchema,
  ValidationContext,
  ValidationError,
  ValidationResult,
  ValidationSchema,
  ValidationStep,
  Validator,
} from './validation.js';

export {
  all,
  asyncPipe,
  fail as validationFail,
  formatFileSize,
  isNumber,
  isString,
  nullable,
  ok as validationOk,
  optional,
  pipe,
  pipeChain,
  pipeMany,
  refine,
  required,
  toAsync,
  validateFileBasic,
  validateForm,
  validateFormData,
  validateObject,
  validationError,
} from './validation.js';

/* ============================================================================
 * 🗄️ OFFLINE CACHE — STALE-WHILE-REVALIDATE CACHE ENGINE
 * ========================================================================== */

/**
 * Offline Cache: SWR ядро оффлайн-кэша (hybrid memory + persistent store).
 * Не зависит от React/DOM; логирование и телеметрия вносятся через onError/onUpdate/onEvaluate.
 * @public
 */

export * from './offline-cache.js';
