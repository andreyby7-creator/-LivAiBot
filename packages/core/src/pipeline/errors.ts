/**
 * @file packages/core/src/pipeline/errors.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Error Model)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Error model для pipeline execution engine
 * - Нормализация и категоризация ошибок
 * - Translation layer между runtime errors и engine-level types
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, BRANDED ERROR CLASSES, METADATA VALIDATION, FACTORIES, DETECTION, NORMALIZATION, MAPPERS
 * - ✅ Deterministic: структурированная категоризация (Error classes с instanceof), не message parsing
 * - ✅ Isolation semantics: isolation только для явных isolation errors, не fallback (fallback → execution_error)
 * - ✅ Reliability: originalError не раскрывается автоматически (опциональный, internal only), metadata validation предотвращает domain leakage
 * - ✅ Extensibility: metadata для future-proofing (engine-level observability only, no domain data, с валидацией)
 * - ✅ Retry semantics: isolation_error → ISOLATION_ERROR (no retry), execution_error → EXECUTION_ERROR (retry)
 * - ✅ Type-safety: Error classes (TimeoutError, IsolationError, CancelledError) для корректного stack trace и instanceof
 */

import type { PipelineFailureReason, StageError, StageFailureReason } from './plugin-api.js';

/* ============================================================================
 * 1. TYPES — ERROR MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Branded type для runtime проверки PipelineError */
declare const brandSymbol: unique symbol;
type Brand<T, B> = T & { readonly [brandSymbol]: B; };

/** Branded type для StageError для type-safe tracking */
declare const StageErrorBrand: unique symbol;
export type BrandedStageError = StageError & {
  readonly [StageErrorBrand]: 'BrandedStageError';
};

/** Custom Error с явным stageId metadata для надежной обработки */
export type PipelineStageError = Error & {
  readonly stageId: string;
  readonly originalError?: unknown;
};

/**
 * Metadata для engine-level observability
 * @note Must not contain domain data. Only engine-level observability fields allowed.
 * Allowed: executionTime, retryCount, circuitBreakerState, etc.
 * Forbidden: user data, domain entities, business logic state.
 */
export type PipelineErrorMetadata = Readonly<Record<string, unknown>>;

/** Типизированные ошибки pipeline с tagged stageId для надежной обработки */
export type PipelineError = Brand<
  | {
    readonly kind: 'execution_error';
    readonly stageId: string;
    readonly message: string;
    readonly originalError?: unknown;
    /** metadata is for engine-level observability only. Must not contain domain data. */
    readonly metadata?: PipelineErrorMetadata;
  }
  | {
    readonly kind: 'isolation_error';
    readonly stageId: string;
    readonly message: string;
    readonly originalError?: unknown;
    /** metadata is for engine-level observability only. Must not contain domain data. */
    readonly metadata?: PipelineErrorMetadata;
  }
  | {
    readonly kind: 'timeout';
    readonly stageId: string;
    readonly message: string;
    readonly timeoutMs?: number;
    /** metadata is for engine-level observability only. Must not contain domain data. */
    readonly metadata?: PipelineErrorMetadata;
  }
  | {
    readonly kind: 'cancelled';
    readonly stageId: string;
    readonly message: string;
    /** metadata is for engine-level observability only. Must not contain domain data. */
    readonly metadata?: PipelineErrorMetadata;
  }
  | {
    readonly kind: 'dependency_error';
    readonly stageId: string;
    readonly message: string;
    readonly missingSlot?: string;
    /** metadata is for engine-level observability only. Must not contain domain data. */
    readonly metadata?: PipelineErrorMetadata;
  }
  | {
    readonly kind: 'pipeline_error';
    readonly message: string;
    readonly reason: PipelineFailureReason;
    /** metadata is for engine-level observability only. Must not contain domain data. */
    readonly metadata?: PipelineErrorMetadata;
  },
  'PipelineError'
>;

/* ============================================================================
 * 2. BRANDED ERROR CLASSES — TYPE-SAFE ERROR DETECTION WITH STACK TRACE
 * ============================================================================
 */

/**
 * Branded TimeoutError для type-safe detection
 * @note Используйте instanceof для проверки, stack trace формируется автоматически
 */
// eslint-disable-next-line functional/no-classes -- классы нужны для корректного stack trace и instanceof
export class TimeoutError extends Error {
  readonly __type = 'timeout' as const;
  readonly timeoutMs: number | undefined;

  constructor(message: string, timeoutMs?: number) {
    super(message);
    // eslint-disable-next-line fp/no-mutation, functional/no-this-expressions -- конструктор класса требует мутации this
    this.name = 'TimeoutError';
    // eslint-disable-next-line fp/no-mutation, functional/no-this-expressions -- конструктор класса требует мутации this
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Branded IsolationError для type-safe detection
 * @note Используйте instanceof для проверки, stack trace формируется автоматически
 */
// eslint-disable-next-line functional/no-classes -- классы нужны для корректного stack trace и instanceof
export class IsolationError extends Error {
  readonly __type = 'isolation' as const;

  constructor(message: string) {
    super(message);
    // eslint-disable-next-line fp/no-mutation, functional/no-this-expressions -- конструктор класса требует мутации this
    this.name = 'IsolationError';
  }
}

/**
 * Branded CancelledError для type-safe detection
 * @note Используйте instanceof для проверки, stack trace формируется автоматически
 */
// eslint-disable-next-line functional/no-classes -- классы нужны для корректного stack trace и instanceof
export class CancelledError extends Error {
  readonly __type = 'cancelled' as const;

  constructor(message: string = 'Operation cancelled') {
    super(message);
    // eslint-disable-next-line fp/no-mutation, functional/no-this-expressions -- конструктор класса требует мутации this
    this.name = 'CancelledError';
  }
}

/**
 * Создает TimeoutError для type-safe detection
 * @note Используйте instanceof для проверки, stack trace формируется автоматически
 */
export function createTimeoutErrorClass(
  message: string,
  timeoutMs?: number,
): TimeoutError {
  return new TimeoutError(message, timeoutMs);
}

/**
 * Создает IsolationError для type-safe detection
 * @note Используйте instanceof для проверки, stack trace формируется автоматически
 */
export function createIsolationErrorClass(message: string): IsolationError {
  return new IsolationError(message);
}

/**
 * Создает CancelledError для type-safe detection
 * @note Используйте instanceof для проверки, stack trace формируется автоматически
 */
export function createCancelledErrorClass(
  message: string = 'Operation cancelled',
): CancelledError {
  return new CancelledError(message);
}

/* ============================================================================
 * 3. METADATA VALIDATION — PREVENT DOMAIN LEAKAGE
 * ============================================================================
 */

/**
 * Проверяет, что metadata содержит только engine-level observability данные
 * @note Type guard для предотвращения domain leakage
 * @internal
 */
export function isValidPipelineErrorMetadata(
  metadata: unknown,
): metadata is PipelineErrorMetadata {
  if (metadata === null || typeof metadata !== 'object') {
    return false;
  }

  // Проверяем, что это plain object (не domain entity)
  if (Object.getPrototypeOf(metadata) !== Object.prototype) {
    return false;
  }

  // Дополнительная проверка: metadata не должен содержать типичные domain поля
  const obj = metadata as Record<string, unknown>;
  const forbiddenKeys = ['user', 'userId', 'device', 'context', 'entity', 'domain'];
  const hasForbiddenKeys = forbiddenKeys.some((key) => key in obj);

  return !hasForbiddenKeys;
}

/**
 * Создает безопасный PipelineErrorMetadata из unknown
 * @note Валидирует, что metadata не содержит domain данных
 * @note Мягкая валидация: возвращает undefined для невалидных данных
 * @public
 */
export function createPipelineErrorMetadata(
  metadata: unknown,
): PipelineErrorMetadata | undefined {
  if (metadata === undefined || metadata === null) {
    return undefined;
  }

  if (isValidPipelineErrorMetadata(metadata)) {
    return metadata;
  }

  // Если metadata невалиден, возвращаем undefined (не прокидываем domain данные)
  return undefined;
}

/**
 * Runtime guard: строго валидирует PipelineErrorMetadata и бросает ошибку при domain leakage
 * @note Защищает от ошибок и утечек на runtime, бросает ошибку при попытке прокинуть domain-данные
 * @throws {Error} Если metadata содержит domain-данные или невалидную структуру
 * @public
 */
/* eslint-disable fp/no-throw -- runtime guard должен бросать ошибку для защиты от domain leakage */
export function validatePipelineErrorMetadata(
  metadata: unknown,
): asserts metadata is PipelineErrorMetadata {
  if (metadata === undefined || metadata === null) {
    return;
  }

  if (typeof metadata !== 'object') {
    throw new Error(
      `PipelineErrorMetadata must be an object, got: ${typeof metadata}`,
    );
  }

  // Проверяем, что это plain object (не domain entity)
  if (Object.getPrototypeOf(metadata) !== Object.prototype) {
    throw new Error(
      'PipelineErrorMetadata must be a plain object, got object with custom prototype (possible domain entity)',
    );
  }

  // Проверяем на domain поля
  const obj = metadata as Record<string, unknown>;
  const forbiddenKeys = ['user', 'userId', 'device', 'context', 'entity', 'domain'];
  const foundForbiddenKeys = forbiddenKeys.filter((key) => key in obj);

  if (foundForbiddenKeys.length > 0) {
    throw new Error(
      `PipelineErrorMetadata must not contain domain fields: ${foundForbiddenKeys.join(', ')}. `
        + 'Only engine-level observability fields are allowed (executionTime, retryCount, circuitBreakerState, etc.)',
    );
  }
}
/* eslint-enable fp/no-throw */

/* ============================================================================
 * 4. FACTORIES — PURE CONSTRUCTORS (No Domain Logic)
 * ============================================================================
 */

/** Создает PipelineStageError с явным stageId metadata */
export function createPipelineStageError(
  message: string,
  stageId: string,
  originalError?: unknown,
): PipelineStageError {
  const baseError = new Error(message);
  return {
    name: 'PipelineStageError',
    message: baseError.message,
    stack: baseError.stack,
    stageId,
    ...(originalError !== undefined && { originalError }),
  } as PipelineStageError;
}

/** Проверяет, является ли ошибка PipelineStageError */
export function isPipelineStageError(error: unknown): error is PipelineStageError {
  return (
    error !== null
    && typeof error === 'object'
    && 'name' in error
    && error.name === 'PipelineStageError'
    && 'stageId' in error
    && typeof (error as { readonly stageId: unknown; }).stageId === 'string'
  );
}

/** Создает ошибку execution_error (fallback для неизвестных ошибок) */
export function createExecutionError(
  error: unknown,
  stageId: string,
  metadata?: PipelineErrorMetadata,
): PipelineError {
  const message = error instanceof Error ? error.message : String(error);
  const result: PipelineError = {
    kind: 'execution_error',
    stageId,
    message,
    ...(error !== undefined && { originalError: error }),
    ...(metadata !== undefined && { metadata }),
  } as PipelineError;
  return result;
}

/** Создает ошибку isolation_error (только для явных isolation errors) */
export function createIsolationError(
  error: unknown,
  stageId: string,
  metadata?: PipelineErrorMetadata,
): PipelineError {
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: 'isolation_error',
    stageId,
    message,
    originalError: error,
    ...(metadata !== undefined && { metadata }),
  } as PipelineError;
}

/** Создает ошибку timeout */
export function createTimeoutError(
  error: Error,
  stageId: string,
  timeoutMs?: number,
  metadata?: PipelineErrorMetadata,
): PipelineError {
  return {
    kind: 'timeout',
    stageId,
    message: error.message,
    ...(timeoutMs !== undefined && { timeoutMs }),
    ...(metadata !== undefined && { metadata }),
  } as PipelineError;
}

/** Создает ошибку cancelled */
export function createCancelledError(
  stageId: string,
  message: string = 'Stage cancelled',
  metadata?: PipelineErrorMetadata,
): PipelineError {
  return {
    kind: 'cancelled',
    stageId,
    message,
    ...(metadata !== undefined && { metadata }),
  } as PipelineError;
}

/** Создает ошибку dependency_error */
export function createDependencyError(
  stageId: string,
  message: string,
  missingSlot?: string,
  metadata?: PipelineErrorMetadata,
): PipelineError {
  return {
    kind: 'dependency_error',
    stageId,
    message,
    ...(missingSlot !== undefined && { missingSlot }),
    ...(metadata !== undefined && { metadata }),
  } as PipelineError;
}

/** Создает ошибку pipeline_error */
export function createPipelineError(
  message: string,
  reason: PipelineFailureReason,
  metadata?: PipelineErrorMetadata,
): PipelineError {
  return {
    kind: 'pipeline_error',
    message,
    reason,
    ...(metadata !== undefined && { metadata }),
  } as PipelineError;
}

/* ============================================================================
 * 5. CLASSIFICATION — STRUCTURED DETECTION ONLY (Branded Classes)
 * ============================================================================
 */

/** Проверяет, является ли ошибка TimeoutError (instanceof) */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/** Проверяет, является ли ошибка IsolationError (instanceof) */
export function isIsolationError(error: unknown): error is IsolationError {
  return error instanceof IsolationError;
}

/** Проверяет, является ли ошибка CancelledError (instanceof) */
export function isCancelledError(error: unknown): error is CancelledError {
  return error instanceof CancelledError;
}

/** Классифицирует ошибку по структуре (branded types) */
export function classifyError(
  error: unknown,
  stageId: string,
): PipelineError {
  // Структурированная классификация по branded types (type-safe)
  if (isTimeoutError(error)) {
    return createTimeoutError(error, stageId, error.timeoutMs);
  }

  if (isIsolationError(error)) {
    return createIsolationError(error, stageId);
  }

  if (isCancelledError(error)) {
    return createCancelledError(stageId, error.message);
  }

  // Fallback: execution_error (не isolation!)
  return createExecutionError(error, stageId);
}

/* ============================================================================
 * 6. NORMALIZATION — UNKNOWN → PIPELINEERROR (Single Decision Point)
 * ============================================================================
 */

/**
 * Нормализует ошибку в PipelineError
 * @note Единственное место, где происходит decision logic.
 * Использует структурированную классификацию (instanceof), не message parsing.
 * Сохраняет originalError из PipelineStageError для observability.
 */
export function normalizePipelineError(
  error: unknown,
  stageId: string,
): PipelineError {
  // Если ошибка уже содержит stageId metadata (PipelineStageError), используем его
  // ВАЖНО: сохраняем originalError для observability
  if (isPipelineStageError(error)) {
    const base = error.originalError ?? error;
    return classifyError(base, error.stageId);
  }

  // Если ошибка - обычный Error, классифицируем по структуре
  if (error instanceof Error) {
    return classifyError(error, stageId);
  }

  // Fallback: execution_error для неизвестных ошибок
  return createExecutionError(error, stageId);
}

/* ============================================================================
 * 7. MAPPERS — PIPELINEERROR ↔ STAGEFAILUREREASON (Pure Translation)
 * ============================================================================
 */

/**
 * Преобразует PipelineError в StageFailureReason
 * @note Pure translation, без эвристик или классификации
 * @note isolation_error мапится в EXECUTION_ERROR, так как StageFailureReason не поддерживает ISOLATION_ERROR
 *       Семантика isolation сохраняется на уровне PipelineError для observability
 * @public
 */
export function pipelineErrorToStageFailureReason(
  error: PipelineError,
): StageFailureReason {
  switch (error.kind) {
    case 'timeout':
      return {
        kind: 'TIMEOUT',
        timeoutMs: error.timeoutMs ?? 0,
      };
    case 'cancelled':
      return {
        kind: 'CANCELLED',
      };
    case 'execution_error':
      return {
        kind: 'EXECUTION_ERROR',
        error: error.originalError instanceof Error
          ? error.originalError
          : new Error(error.message),
      };
    case 'isolation_error':
      // ВАЖНО: isolation_error мапится в ISOLATION_ERROR для правильной retry semantics
      // isolation_error → no retry (sandbox failure, circuit breaker open, subsystem broken)
      // execution_error → retry (transient error, temporary network issue)
      return {
        kind: 'ISOLATION_ERROR',
        error: error.originalError instanceof Error
          ? error.originalError
          : new Error(error.message),
      };
    case 'dependency_error':
      return {
        kind: 'MISSING_DEPENDENCY',
        slot: error.missingSlot ?? 'unknown',
      };
    case 'pipeline_error':
      // Для pipeline_error возвращаем INVALID_PLUGIN с reason из PipelineFailureReason
      return {
        kind: 'INVALID_PLUGIN',
        reason: error.reason.kind,
      };
    default:
      // Exhaustive check: все варианты обработаны
      return {
        kind: 'EXECUTION_ERROR',
        error: new Error('Unknown pipeline error'),
      };
  }
}

/**
 * Преобразует PipelineError в StageError
 * @note Pure translation, без эвристик
 * @public
 */
export function pipelineErrorToStageError(
  error: PipelineError,
  timestamp: number = Date.now(),
): StageError {
  const stageId = error.kind === 'pipeline_error' ? 'pipeline' : (error.stageId || 'unknown');
  return {
    reason: pipelineErrorToStageFailureReason(error),
    stageId,
    timestamp,
  };
}

/**
 * Преобразует PipelineError в BrandedStageError для type-safe tracking
 * @note Branded type для дополнительной type-safety при работе со StageError
 * @public
 */
export function pipelineErrorToBrandedStageError(
  error: PipelineError,
  timestamp: number = Date.now(),
): BrandedStageError {
  return pipelineErrorToStageError(error, timestamp) as BrandedStageError;
}

/**
 * Создает PipelineError из StageFailureReason
 * @note Pure translation, без эвристик
 * @note Сохраняет структуру dependency failures для future retry policies
 * @public
 */
export function stageFailureReasonToPipelineError(
  reason: StageFailureReason,
  stageId: string,
): PipelineError {
  switch (reason.kind) {
    case 'TIMEOUT':
      return createTimeoutError(
        new Error(`Stage ${stageId} timed out`),
        stageId,
        reason.timeoutMs,
      );
    case 'CANCELLED':
      return createCancelledError(stageId, 'Stage cancelled');
    case 'EXECUTION_ERROR':
      return createExecutionError(reason.error, stageId);
    case 'ISOLATION_ERROR':
      return createIsolationError(reason.error, stageId);
    case 'MISSING_DEPENDENCY':
      // Сохраняем структуру dependency failure для future retry policies
      return createDependencyError(
        stageId,
        `Missing dependency: ${reason.slot}`,
        reason.slot,
      );
    case 'INVALID_SLOT':
      return createExecutionError(
        new Error(`Invalid slot: ${reason.slot}`),
        stageId,
      );
    case 'SLOT_MISMATCH':
      return createExecutionError(
        new Error(
          `Slot mismatch: declared [${reason.declared.join(', ')}], returned [${
            reason.returned.join(', ')
          }]`,
        ),
        stageId,
      );
    case 'CIRCULAR_DEPENDENCY':
      return createExecutionError(
        new Error(`Circular dependency: ${reason.path.join(' → ')}`),
        stageId,
      );
    case 'INVALID_PLUGIN':
      return createExecutionError(
        new Error(`Invalid plugin: ${reason.reason}`),
        stageId,
      );
    default:
      // Exhaustive check: все варианты обработаны
      return createExecutionError(
        new Error(`Stage ${stageId} failed: ${(reason as { kind: string; }).kind}`),
        stageId,
      );
  }
}
