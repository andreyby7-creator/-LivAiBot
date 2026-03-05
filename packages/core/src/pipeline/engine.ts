/**
 * @file packages/core/src/pipeline/engine.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Execution Engine)
 * ============================================================================
 * Архитектурная роль:
 * - Generic execution engine для dependency-driven pipeline
 * - Оркестрация выполнения по уже скомпилированному execution plan
 * - Выполнение стадий с dependency resolution и error handling
 * - Поддержка последовательного и параллельного режимов (fan-out/fan-in) с throttling
 * - Причина изменения: pipeline execution, dependency-driven orchestration, scalable rule-engine
 * Принципы:
 * - ✅ SRP: разделение на типы, выполнение стадии (run/error-handling/validation), orchestration (sequential/parallel)
 * - ✅ Deterministic: одинаковые входы → одинаковый execution plan и результат (детерминированное слияние слотов в порядке executionOrder)
 * - ✅ Domain-pure: generic по TSlotMap (определяется domain), без domain-специфичной логики, без side-effects
 * - ✅ Extensible: plugin system через StagePlugin<TSlotMap>, без изменения core-логики
 * - ✅ Strict typing: union-типы для ExecutionState и PipelineFailureReason
 * - ✅ Microservice-ready: stateless execution engine, без скрытого coupling, AbortSignal для cancellation
 * - ✅ Scalable: fan-out/fan-in, batched parallel execution через maxParallelStages, timeout/cancellation guards
 * - ✅ Reliability: runtime validation (duplicate providers, unknown slots, circular dependencies, опциональная строгая валидация слотов через strictSlotCheck), DoS protection (maxStages, maxExecutionTimeMs, maxParallelStages для throttling)
 * - ✅ Явные стратегии выполнения: последовательная и параллельная orchestration без скрытого coupling
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения (TSlotMap определяется domain layer)
 * - ❌ НЕ зависит от aggregation/domain-specific logic
 * - ⚠️ Execution plan строится один раз при создании engine (immutable)
 * - ⚠️ Parallel execution требует явного разрешения через allowParallelExecution
 * - ⚠️ Поведение deterministic merge и throttling задается execution strategy (см. принципы выше)
 */

import type { ExecutionPlan, ExecutionPlanError } from './plan.js'; // ExecutionPlanError нужен для type narrowing
import { createExecutionPlan } from './plan.js';
import type {
  PipelineConfig,
  PipelineFailureReason,
  PipelineResult,
  StageContext,
  StageFailureReason,
  StageId,
  StageMetadata,
  StagePlugin,
  StageResult,
} from './plugin-api.js';
import { validatePipelineConfig } from './plugin-api.js';

/* ============================================================================
 * 1. TYPES — EXECUTION ENGINE MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Состояние выполнения стадии
 * @template TSlotMap - Тип slot map для pipeline
 * @template TProvides - Слоты, которые предоставляет стадия
 * @note Union-тип для строгой типизации
 * @public
 */
export type ExecutionState<
  TSlotMap extends Readonly<Record<string, unknown>>,
  TProvides extends readonly (keyof TSlotMap)[] = readonly (keyof TSlotMap)[],
> =
  | Readonly<{ status: 'pending'; }> // Стадия ожидает выполнения
  | Readonly<{ status: 'running'; startTime: number; }> // Стадия выполняется
  | Readonly<{ status: 'completed'; result: StageResult<TSlotMap, TProvides>; endTime: number; }> // Стадия завершена
  | Readonly<{ status: 'failed'; error: StageFailureReason; endTime: number; }> // Стадия завершилась с ошибкой
  | Readonly<{ status: 'cancelled'; endTime: number; }>; // Стадия отменена

/**
 * Результат выполнения стадии с метаданными
 * @template TSlotMap - Тип slot map для pipeline
 * @template TProvides - Слоты, которые предоставляет стадия
 * @public
 */
export type StageExecutionResult<
  TSlotMap extends Readonly<Record<string, unknown>>,
  TProvides extends readonly (keyof TSlotMap)[] = readonly (keyof TSlotMap)[],
> = Readonly<{
  /** Результат выполнения стадии */
  readonly result: StageResult<TSlotMap, TProvides>;
  /** Метаданные выполнения стадии */
  readonly metadata: StageMetadata;
  /** Время выполнения стадии (в миллисекундах) */
  readonly executionTimeMs: number;
}>;

type ClockNow = () => number;

type StageBatchResult<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly stageId: StageId;
  readonly result: StageResult<TSlotMap>;
}>;

type StageErrorHandlingOutcome<TSlotMap extends Readonly<Record<string, unknown>>> =
  | Readonly<{
    readonly kind: 'recovered';
    readonly result: StageResult<TSlotMap, readonly (keyof TSlotMap)[]>;
  }>
  | Readonly<{
    readonly kind: 'hook-failed';
    readonly reason: StageFailureReason;
  }>
  | Readonly<{
    readonly kind: 'unhandled';
  }>;

const DEFAULT_EXECUTION_ERROR_MESSAGE = 'Stage execution failed';
const MAX_ERROR_MESSAGE_LENGTH = 512;

function resolveClockNow<TSlotMap extends Readonly<Record<string, unknown>>>(
  config: PipelineConfig<TSlotMap>,
): ClockNow {
  return config.now ?? Date.now;
}

function normalizeExecutionError(error: unknown): StageFailureReason {
  const message = error instanceof Error && error.message.trim().length > 0
    ? error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH)
    : DEFAULT_EXECUTION_ERROR_MESSAGE;
  return {
    kind: 'EXECUTION_ERROR',
    error: new Error(message),
  };
}

/* ============================================================================
 * 2. INTERNAL — STAGE EXECUTION (Pure Functions, No Side-Effects)
 * ============================================================================
 */

/**
 * Создает StageContext для выполнения стадии
 * @note Pure function, без side-effects
 * @internal
 */
function createStageContext<TSlotMap extends Readonly<Record<string, unknown>>>(
  stageId: string, // Идентификатор стадии
  executionIndex: number, // Индекс выполнения стадии в execution plan
  executionPlanVersion: string, // Версия execution plan
  slots: Readonly<Partial<TSlotMap>>, // Текущие слоты данных
  startTime: number, // Время начала выполнения pipeline
  abortSignal?: AbortSignal, // AbortSignal для cancellation
): StageContext<TSlotMap> { // StageContext для выполнения стадии
  return {
    slots: Object.freeze({ ...slots }) as Readonly<Partial<TSlotMap>>,
    metadata: Object.freeze({
      stageId: Object.freeze(stageId),
      executionIndex: Object.freeze(executionIndex),
      executionPlanVersion: Object.freeze(executionPlanVersion),
      startTime: Object.freeze(startTime),
      cancelled: Object.freeze(abortSignal?.aborted ?? false),
    }) as StageMetadata,
    ...(abortSignal !== undefined && { abortSignal }),
  } as StageContext<TSlotMap>;
}

/**
 * Валидирует результат стадии: проверяет соответствие declared provides
 * @note Pure function, без side-effects
 * @note Если strictSlotCheck=true, также проверяет отсутствие необъявленных слотов
 * @internal
 */
function validateStageResult<TSlotMap extends Readonly<Record<string, unknown>>>(
  result: StageResult<TSlotMap>, // Результат выполнения стадии
  plugin: StagePlugin<TSlotMap>, // Plugin для валидации
  strictSlotCheck: boolean, // Строгая валидация слотов (runtime validation)
): StageResult<TSlotMap> | null { // null если валидация прошла, иначе ошибка валидации
  if (!result.ok) {
    return null; // Ошибки не валидируем
  }

  const returnedSlots = Object.keys(result.slots);
  const declaredSlots = plugin.provides.map((s) => String(s));

  // Проверяем, что все declared provides присутствуют в результате
  const missingDeclared = declaredSlots.find((declared) => !returnedSlots.includes(declared));

  if (missingDeclared !== undefined) {
    return {
      ok: false,
      reason: {
        kind: 'SLOT_MISMATCH',
        declared: declaredSlots,
        returned: returnedSlots,
      },
    };
  }

  // Строгая валидация: проверяем отсутствие необъявленных слотов
  if (strictSlotCheck) {
    const unexpectedReturned = returnedSlots.find((returned) => !declaredSlots.includes(returned));

    if (unexpectedReturned !== undefined) {
      return {
        ok: false,
        reason: {
          kind: 'SLOT_MISMATCH',
          declared: declaredSlots,
          returned: returnedSlots,
        },
      };
    }
  }

  return null; // Валидация прошла
}

/**
 * Выполняет стадию pipeline (pure execution, без обработки ошибок)
 * @note Pure function: только выполнение стадии, без обработки ошибок
 * @note SRP: разделение ответственности - runStage только выполняет, handleStageError обрабатывает ошибки
 * @internal
 */
async function runStage<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: StagePlugin<TSlotMap>, // Plugin для выполнения
  context: StageContext<TSlotMap>, // Контекст выполнения стадии
): Promise<StageResult<TSlotMap>> { // Результат выполнения стадии
  // Проверяем cancellation перед выполнением
  /* c8 ignore start -- guarded by orchestration checks; defensive duplicate cancellation check */
  if (context.abortSignal?.aborted === true) {
    return {
      ok: false,
      reason: { kind: 'CANCELLED' },
    };
  }
  /* c8 ignore stop */

  // Выполняем стадию (pure execution)
  return plugin.run(context);
}

/**
 * Обрабатывает ошибки выполнения стадии через onError hook
 * @note Hook logic: обработка ошибок через plugin.onError
 * @note SRP: разделение ответственности - handleStageError только обрабатывает ошибки
 * @note Если onError возвращает undefined, ошибка пробрасывается дальше
 * @internal
 */
function handleStageError<TSlotMap extends Readonly<Record<string, unknown>>>(
  error: unknown, // Ошибка выполнения стадии
  stageId: StageId, // Идентификатор стадии
  plugin: StagePlugin<TSlotMap>, // Plugin для обработки ошибок
  context: StageContext<TSlotMap>, // Контекст выполнения стадии
  now: ClockNow, // Инъецированные часы для детерминированности
): StageErrorHandlingOutcome<TSlotMap> { // Результат обработки ошибки через onError hook
  // Обработка ошибок через onError hook (если доступен)
  if (plugin.onError === undefined) {
    return { kind: 'unhandled' }; // Ошибка не обработана
  }

  try {
    const recoveryResult = plugin.onError(
      {
        reason: normalizeExecutionError(error),
        stageId,
        timestamp: now(),
      },
      context,
    );

    // Если onError вернул результат, используем его для recovery
    // Если undefined, ошибка пробрасывается дальше
    if (recoveryResult === undefined) {
      return { kind: 'unhandled' };
    }
    return {
      kind: 'recovered',
      result: recoveryResult,
    };
  } catch (hookError: unknown) {
    return {
      kind: 'hook-failed',
      reason: normalizeExecutionError(hookError),
    };
  }
}

/**
 * Выполняет стадию pipeline с обработкой ошибок и валидацией
 * @note Композиция runStage (pure) + handleStageError (hook logic) + validateStageResult
 * @note SRP: разделение на pure execution, error handling, validation
 * @internal
 */
async function executeStage<TSlotMap extends Readonly<Record<string, unknown>>>(
  stageId: StageId, // Идентификатор стадии
  plugin: StagePlugin<TSlotMap>, // Plugin для выполнения
  context: StageContext<TSlotMap>, // Контекст выполнения стадии
  startTime: number, // Время начала выполнения стадии
  strictSlotCheck: boolean, // Строгая валидация слотов (runtime validation)
  now: ClockNow, // Инъецированные часы для детерминированности
): Promise<StageExecutionResult<TSlotMap>> { // Результат выполнения стадии
  try {
    // Pure execution: выполняем стадию без обработки ошибок
    const result = await runStage(plugin, context);

    // Валидация результата: проверяем соответствие declared provides
    const validationError = validateStageResult(result, plugin, strictSlotCheck);
    if (validationError !== null) {
      return {
        result: validationError,
        metadata: context.metadata,
        executionTimeMs: now() - startTime,
      };
    }

    return {
      result,
      metadata: context.metadata,
      executionTimeMs: now() - startTime,
    };
  } catch (error: unknown) {
    // Hook logic: обработка ошибок через onError hook
    const errorHandlingOutcome = handleStageError(error, stageId, plugin, context, now);

    if (errorHandlingOutcome.kind === 'recovered') {
      // Recovery успешен: возвращаем результат из onError
      return {
        result: errorHandlingOutcome.result,
        metadata: context.metadata,
        executionTimeMs: now() - startTime,
      };
    }

    const failureReason = errorHandlingOutcome.kind === 'hook-failed'
      ? errorHandlingOutcome.reason
      : normalizeExecutionError(error);

    // Recovery не удался: возвращаем ошибку
    return {
      result: {
        ok: false,
        reason: failureReason,
      },
      metadata: context.metadata,
      executionTimeMs: now() - startTime,
    };
  }
}

/* ============================================================================
 * 3. INTERNAL — EXECUTION ENGINE (Orchestration, Dependency Resolution)
 * ============================================================================
 */

/**
 * Выполняет pipeline последовательно (без параллельного выполнения)
 * @note Deterministic: одинаковый execution plan → одинаковый порядок выполнения
 * @internal
 */
/**
 * Выполняет одну стадию последовательно (helper для рекурсивного выполнения)
 * @internal
 */
async function executeStageSequentially<TSlotMap extends Readonly<Record<string, unknown>>>(
  stageId: StageId, // Идентификатор стадии
  executionIndex: number, // Индекс выполнения стадии
  plan: ExecutionPlan<TSlotMap>, // Execution plan для выполнения
  config: PipelineConfig<TSlotMap>, // Конфигурация pipeline
  currentSlots: Readonly<Partial<TSlotMap>>, // Текущие слоты данных
  startTime: number, // Время начала выполнения pipeline
  now: ClockNow, // Инъецированные часы для детерминированности
): Promise<{ slots: Readonly<Partial<TSlotMap>>; } | PipelineResult<TSlotMap>> { // Обновленные слоты или ошибка
  const plugin = plan.stages[stageId];

  if (plugin === undefined) {
    return {
      ok: false,
      reason: {
        kind: 'STAGE_FAILED',
        stageId,
        reason: {
          kind: 'EXECUTION_ERROR',
          error: new Error(`Stage ${stageId} not found in execution plan`),
        },
      },
    };
  }

  // Проверяем cancellation
  if (config.abortSignal?.aborted === true) {
    return {
      ok: false,
      reason: {
        kind: 'STAGE_FAILED',
        stageId,
        reason: { kind: 'CANCELLED' },
      },
    };
  }

  // Проверяем timeout
  const maxExecutionTimeMs = config.maxExecutionTimeMs;
  if (maxExecutionTimeMs !== undefined && now() - startTime > maxExecutionTimeMs) {
    return {
      ok: false,
      reason: {
        kind: 'EXECUTION_TIMEOUT',
        timeoutMs: maxExecutionTimeMs,
      },
    };
  }

  // Создаем контекст для выполнения стадии
  const context = createStageContext(
    stageId,
    executionIndex,
    plan.version,
    currentSlots,
    startTime,
    config.abortSignal,
  );

  // Выполняем стадию
  const stageStartTime = now();
  const strictSlotCheck = config.strictSlotCheck ?? false;
  const executionResult = await executeStage(
    stageId,
    plugin,
    context,
    stageStartTime,
    strictSlotCheck,
    now,
  );

  // Обрабатываем результат
  const stageResult = executionResult.result;
  if (!stageResult.ok) {
    // Если есть fallback стадия, выполняем её
    if (plan.fallbackStage !== undefined) {
      const fallbackContext = createStageContext(
        'fallback',
        -1,
        plan.version,
        currentSlots,
        startTime,
        config.abortSignal,
      );

      await plan.fallbackStage.run(fallbackContext);
    }

    return {
      ok: false,
      reason: {
        kind: 'STAGE_FAILED',
        stageId,
        reason: (stageResult as { ok: false; reason: StageFailureReason; }).reason,
      },
    };
  }

  // Обновляем слоты данными из результата
  return {
    slots: { ...currentSlots, ...stageResult.slots },
  };
}

/**
 * Выполняет pipeline последовательно (без параллельного выполнения)
 * @note Deterministic: одинаковый execution plan → одинаковый порядок выполнения
 * @internal
 */
async function executeSequentially<TSlotMap extends Readonly<Record<string, unknown>>>(
  plan: ExecutionPlan<TSlotMap>, // Execution plan для выполнения
  config: PipelineConfig<TSlotMap>, // Конфигурация pipeline
  initialSlots: Readonly<Partial<TSlotMap>>, // Начальные слоты данных
  startTime: number, // Время начала выполнения pipeline
  now: ClockNow, // Инъецированные часы для детерминированности
): Promise<PipelineResult<TSlotMap>> { // Результат выполнения pipeline
  // Рекурсивная функция для последовательного выполнения стадий
  const executeStagesRecursive = async (
    remainingStages: readonly StageId[],
    currentSlots: Readonly<Partial<TSlotMap>>,
    currentIndex: number,
  ): Promise<PipelineResult<TSlotMap>> => {
    if (remainingStages.length === 0) {
      return {
        ok: true,
        slots: Object.freeze(currentSlots),
        executionOrder: plan.executionOrder,
      };
    }

    const [firstStageId, ...restStages] = remainingStages;
    if (firstStageId === undefined) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_EXECUTION_PLAN',
          reason: 'Execution plan is corrupted: stage id is undefined',
        },
      };
    }
    const stageResult = await executeStageSequentially(
      firstStageId,
      currentIndex,
      plan,
      config,
      currentSlots,
      startTime,
      now,
    );

    // Если ошибка, возвращаем её
    if (!('slots' in stageResult)) {
      return stageResult;
    }

    // Продолжаем с следующей стадией
    return executeStagesRecursive(restStages, stageResult.slots, currentIndex + 1);
  };

  return executeStagesRecursive(plan.executionOrder, initialSlots, 0);
}

/**
 * Строит уровни выполнения стадий (pure function)
 * @note Deterministic: использует plan.dependencies для O(1) lookup вместо O(N²)
 * @note Pure function: без side-effects, детерминированная
 * @internal
 */
/* eslint-disable-next-line sonarjs/cognitive-complexity */
function buildExecutionLevels<TSlotMap extends Readonly<Record<string, unknown>>>(
  plan: ExecutionPlan<TSlotMap>, // Execution plan для построения уровней
): readonly (readonly StageId[])[] { // Массив уровней выполнения (стадии одного уровня могут выполняться параллельно)
  /* eslint-disable functional/no-let, functional/no-loop-statements, functional/immutable-data, fp/no-mutation */
  const levels: StageId[][] = [];
  let currentLevel: StageId[] = [];
  const completedStages = new Set<StageId>();

  // Итерируемся по executionOrder для гарантированного deterministic порядка
  for (const stageId of plan.executionOrder) {
    const plugin = plan.stages[stageId];

    if (plugin === undefined) {
      continue;
    }

    // Проверяем, все ли зависимости выполнены (O(1) lookup через plan.dependencies)
    const stageDependencies = plan.dependencies[stageId] ?? [];
    const allDependenciesCompleted = stageDependencies.length === 0
      || stageDependencies.every((depStageId) => completedStages.has(depStageId));

    if (allDependenciesCompleted) {
      currentLevel.push(stageId);
    } else {
      // Если текущий уровень не пуст, сохраняем его и начинаем новый
      if (currentLevel.length > 0) {
        levels.push([...currentLevel]);
        // Помечаем стадии текущего уровня как выполненные
        for (const completedStageId of currentLevel) {
          completedStages.add(completedStageId);
        }
        currentLevel = [];
      }
      // Добавляем стадию в новый уровень
      currentLevel.push(stageId);
    }
  }

  // Добавляем последний уровень
  if (currentLevel.length > 0) {
    levels.push([...currentLevel]);
  }

  const frozenLevels = levels.map((level) => Object.freeze([...level]));
  /* eslint-enable functional/no-let, functional/no-loop-statements, functional/immutable-data, fp/no-mutation */
  return frozenLevels;
}

/**
 * Выполняет батч стадий параллельно (pure function для батчевого выполнения)
 * @note Deterministic: результаты объединяются последовательно в порядке level
 * @internal
 */
async function executeStageBatch<TSlotMap extends Readonly<Record<string, unknown>>>(
  level: readonly StageId[], // Батч стадий для выполнения
  plan: ExecutionPlan<TSlotMap>, // Execution plan для выполнения
  config: PipelineConfig<TSlotMap>, // Конфигурация pipeline
  slots: Readonly<Partial<TSlotMap>>, // Текущие слоты данных
  startTime: number, // Время начала выполнения pipeline
  now: ClockNow, // Инъецированные часы для детерминированности
): Promise<readonly StageBatchResult<TSlotMap>[]> { // Результаты выполнения батча
  const strictSlotCheck = config.strictSlotCheck ?? false;

  return Promise.all(
    level.map(async (stageId) => {
      const plugin = plan.stages[stageId];

      if (plugin === undefined) {
        return {
          stageId,
          result: {
            ok: false,
            reason: {
              kind: 'EXECUTION_ERROR',
              error: new Error(`Stage ${stageId} not found in execution plan`),
            },
          },
        };
      }

      const executionIndex = plan.stageIndex[stageId] ?? -1;
      const context = createStageContext(
        stageId,
        executionIndex,
        plan.version,
        slots,
        startTime,
        config.abortSignal,
      );

      const stageStartTime = now();
      const executionResult = await executeStage(
        stageId,
        plugin,
        context,
        stageStartTime,
        strictSlotCheck,
        now,
      );

      return {
        stageId,
        result: executionResult.result,
      };
    }),
  );
}

function guardChecks<TSlotMap extends Readonly<Record<string, unknown>>>(
  config: PipelineConfig<TSlotMap>,
  startTime: number,
  stageId: StageId,
  now: ClockNow,
): PipelineResult<TSlotMap> | null {
  if (config.abortSignal?.aborted === true) {
    return {
      ok: false,
      reason: {
        kind: 'STAGE_FAILED',
        stageId,
        reason: { kind: 'CANCELLED' },
      },
    };
  }

  const maxExecutionTimeMs = config.maxExecutionTimeMs;
  if (maxExecutionTimeMs !== undefined && now() - startTime > maxExecutionTimeMs) {
    return {
      ok: false,
      reason: {
        kind: 'EXECUTION_TIMEOUT',
        timeoutMs: maxExecutionTimeMs,
      },
    };
  }

  return null;
}

async function executeBatch<TSlotMap extends Readonly<Record<string, unknown>>>(
  level: readonly StageId[],
  plan: ExecutionPlan<TSlotMap>,
  config: PipelineConfig<TSlotMap>,
  slots: Readonly<Partial<TSlotMap>>,
  startTime: number,
  maxParallelStages: number,
  now: ClockNow,
): Promise<readonly StageBatchResult<TSlotMap>[]> {
  if (level.length <= maxParallelStages) {
    return executeStageBatch(level, plan, config, slots, startTime, now);
  }

  // False positive: batching math for stage execution, not model/training data usage.
  // eslint-disable-next-line ai-security/model-poisoning
  const batchCount = Math.ceil(level.length / maxParallelStages);
  const chunkedResults = await Promise.all(
    Array.from({ length: batchCount }, (_, batchIndex) => {
      // False positive: вычисление индекса батча, не обработка model/training data.
      // eslint-disable-next-line ai-security/model-poisoning
      const batchStart = batchIndex * maxParallelStages;
      // False positive: slicing deterministic stage batch, not model/training data.
      // eslint-disable-next-line ai-security/model-poisoning
      const batch = level.slice(batchStart, batchStart + maxParallelStages);
      return executeStageBatch(batch, plan, config, slots, startTime, now);
    }),
  );

  return chunkedResults.flat();
}

function mergeResults<TSlotMap extends Readonly<Record<string, unknown>>>(
  targetSlots: Partial<TSlotMap>,
  levelResults: readonly StageBatchResult<TSlotMap>[],
): void {
  // controlled merge: минимальные аллокации, детерминированный порядок levelResults
  // eslint-disable-next-line functional/no-loop-statements
  for (const levelResult of levelResults) {
    /* c8 ignore start -- defensive branch: all failed results are handled before merge in executeLevel */
    if (!levelResult.result.ok) {
      continue;
    }
    /* c8 ignore stop */
    // Controlled imperative merge in hot path; immutable boundary is returned by execute* callers.
    // eslint-disable-next-line functional/immutable-data
    Object.assign(targetSlots, levelResult.result.slots);
  }
}

async function executeLevel<TSlotMap extends Readonly<Record<string, unknown>>>(
  level: readonly StageId[],
  plan: ExecutionPlan<TSlotMap>,
  config: PipelineConfig<TSlotMap>,
  slots: Partial<TSlotMap>,
  startTime: number,
  maxParallelStages: number,
  now: ClockNow,
): Promise<PipelineResult<TSlotMap> | null> {
  /* c8 ignore next -- defensive fallback for malformed level arrays */
  const stageId = (level[0] ?? 'unknown') as StageId;
  const guardFailure = guardChecks(config, startTime, stageId, now);
  if (guardFailure !== null) {
    return guardFailure;
  }

  const levelResults = await executeBatch(
    level,
    plan,
    config,
    slots,
    startTime,
    maxParallelStages,
    now,
  );
  const firstFailure = levelResults.find((levelResult) => !levelResult.result.ok);

  if (firstFailure !== undefined) {
    if (plan.fallbackStage !== undefined) {
      const fallbackContext = createStageContext(
        'fallback',
        -1,
        plan.version,
        slots,
        startTime,
        config.abortSignal,
      );
      await plan.fallbackStage.run(fallbackContext);
    }

    /* c8 ignore start -- defensive branch: find predicate guarantees failed result; false path is unreachable */
    if (!firstFailure.result.ok) {
      return {
        ok: false,
        reason: {
          kind: 'STAGE_FAILED',
          stageId: firstFailure.stageId,
          reason: firstFailure.result.reason,
        },
      };
    }
    /* c8 ignore stop */
  }

  mergeResults(slots, levelResults);
  return null;
}

/**
 * Выполняет pipeline с поддержкой параллельного выполнения (fan-out/fan-in)
 * @note Deterministic: одинаковый execution plan → одинаковый порядок выполнения
 *       Параллельные стадии одного уровня могут выполняться в любом порядке,
 *       но результат детерминирован: слоты объединяются последовательно через Object.assign
 *       в порядке executionOrder (детерминированное слияние слотов).
 *       Коллизии слотов предотвращаются через validateNoDuplicateProviders перед execution.
 * @note Throttling: для больших уровней (>maxParallelStages) стадии выполняются батчами
 * @note O(1) dependency resolution: использует plan.dependencies вместо O(N²) итерации
 * @internal
 */
async function executeWithParallelSupport<TSlotMap extends Readonly<Record<string, unknown>>>(
  plan: ExecutionPlan<TSlotMap>, // Execution plan для выполнения
  config: PipelineConfig<TSlotMap>, // Конфигурация pipeline
  initialSlots: Readonly<Partial<TSlotMap>>, // Начальные слоты данных
  startTime: number, // Время начала выполнения pipeline
  now: ClockNow, // Инъецированные часы для детерминированности
): Promise<PipelineResult<TSlotMap>> { // Результат выполнения pipeline
  /* eslint-disable functional/no-loop-statements */
  const DEFAULT_MAX_PARALLEL_STAGES = 50;
  const slots: Partial<TSlotMap> = { ...initialSlots };
  const maxParallelStages = config.maxParallelStages ?? DEFAULT_MAX_PARALLEL_STAGES;
  const levels = buildExecutionLevels(plan);

  for (const level of levels) {
    const levelFailure = await executeLevel(
      level,
      plan,
      config,
      slots,
      startTime,
      maxParallelStages,
      now,
    );
    if (levelFailure !== null) {
      return levelFailure;
    }
  }

  const result: PipelineResult<TSlotMap> = {
    ok: true,
    slots: Object.freeze(slots),
    executionOrder: plan.executionOrder,
  };
  /* eslint-enable functional/no-loop-statements */
  return result;
}

function mapExecutionPlanErrorToPipelineFailureReason(
  error: ExecutionPlanError,
): PipelineFailureReason {
  switch (error.kind) {
    case 'NO_PLUGINS':
      return { kind: 'NO_PLUGINS' };
    case 'DUPLICATE_PROVIDERS':
      return {
        kind: 'DUPLICATE_PROVIDERS',
        slot: error.slot,
        stageIds: error.stageIds,
      };
    case 'UNKNOWN_SLOT':
      return {
        kind: 'UNKNOWN_SLOT',
        slot: error.slot,
        stageId: error.stageId,
      };
    case 'CIRCULAR_DEPENDENCY':
      return {
        kind: 'CIRCULAR_DEPENDENCY',
        path: error.path,
      };
    case 'INVALID_PLUGIN':
      return {
        kind: 'STAGE_FAILED',
        stageId: error.stageId,
        reason: {
          kind: 'EXECUTION_ERROR',
          error: new Error(error.reason),
        },
      };
    case 'INVALID_CONFIG':
      return {
        kind: 'INVALID_CONFIG',
        reason: error.reason,
      };
    /* c8 ignore start -- exhaustive guard for future union extensions */
    default: {
      const exhaustive: never = error;
      return exhaustive;
    }
      /* c8 ignore stop */
  }
}

/* ============================================================================
 * 4. API — PUBLIC FUNCTIONS
 * ============================================================================
 */

/**
 * Создает execution engine для pipeline
 * @template TSlotMap - Тип slot map для pipeline
 * @note Execution plan строится один раз при создании engine (immutable)
 * @public
 */
export function createPipelineEngine<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[], // Массив плагинов для pipeline
  config: PipelineConfig<TSlotMap>, // Конфигурация pipeline
): PipelineResult<TSlotMap> | ExecutionPlan<TSlotMap> { // Execution plan или ошибка
  // Валидация конфигурации
  if (!validatePipelineConfig<TSlotMap>(config)) {
    return {
      ok: false,
      reason: {
        kind: 'INVALID_CONFIG',
        reason: 'Pipeline configuration is invalid',
      },
    };
  }

  // Строим execution plan
  const planResult = createExecutionPlan(plugins, config);

  // Type guard для ExecutionPlanError
  const isExecutionPlanError = (result: unknown): result is ExecutionPlanError => (
    typeof result === 'object'
    && result !== null
    && 'kind' in result
  );

  if (isExecutionPlanError(planResult)) {
    return {
      ok: false,
      reason: mapExecutionPlanErrorToPipelineFailureReason(planResult),
    };
  }

  return planResult;
}

/**
 * Выполняет pipeline через execution engine
 * @template TSlotMap - Тип slot map для pipeline
 * @note Deterministic: одинаковый execution plan и входные данные → одинаковый результат
 * @public
 */
export async function executePipeline<TSlotMap extends Readonly<Record<string, unknown>>>(
  plan: ExecutionPlan<TSlotMap>, // Execution plan для выполнения
  config: PipelineConfig<TSlotMap>, // Конфигурация pipeline
  initialSlots?: Readonly<Partial<TSlotMap>>, // Начальные слоты данных (опционально)
): Promise<PipelineResult<TSlotMap>> { // Результат выполнения pipeline
  const now = resolveClockNow(config);
  const startTime = now();
  const slots = initialSlots ?? ({} as Partial<TSlotMap>);

  // Выбираем стратегию выполнения на основе конфигурации
  if (config.allowParallelExecution === true) {
    return executeWithParallelSupport(plan, config, slots, startTime, now);
  }

  return executeSequentially(plan, config, slots, startTime, now);
}
