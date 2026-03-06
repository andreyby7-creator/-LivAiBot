/**
 * @file packages/core/src/effect/orchestrator.ts
 * ============================================================================
 * 🎼 ORCHESTRATOR — БЕЗОПАСНАЯ КОМПОЗИЦИЯ АСИНХРОННЫХ ОПЕРАЦИЙ
 * ============================================================================
 *
 * Минимальный, чистый boundary-модуль для безопасной композиции асинхронных
 * операций с step-level isolation и timeout.
 *
 * Архитектурная роль:
 * - Step-level isolation (isolation boundary через `runIsolated`)
 * - Step-level timeout (применяется внутри orchestrator через `withTimeout`, если задан `timeoutMs`)
 * - Безопасная композиция шагов с передачей `previousResult` (через `stepWithPrevious`)
 * - Step-level telemetry (fire-and-forget, опционально через DI: `createOrchestrator({ telemetry })`)
 *
 * Принципы:
 * - Zero business logic
 * - Zero error mapping (error mapping → error-mapping layer)
 * - Zero retry logic (retry → effect-retry layer)
 * - Zero parallel execution (parallel → scheduler layer)
 * - Zero state management (state → store layer)
 * - Только orchestration: isolation, timeout, композиция
 * ⚠️ Важно: Isolation — boundary оркестратора
 * - orchestrator — рекомендуемая точка для isolation через `runIsolated` на уровне step’ов
 * - validatedEffect НЕ делает isolation (только валидация + throw)
 * - api-client НЕ делает isolation (только transport)
 * ⚠️ Архитектурное правило: Step-level timeout управляется orchestrator’ом
 * - Orchestrator использует `effect-timeout.ts` для каждого step
 * - api-client только поддерживает AbortSignal (не устанавливает timeout)
 * - Единая точка управления timeout
 */

import type { IsolationError } from './effect-isolation.js';
import { runIsolated } from './effect-isolation.js';
import type { TimeoutError } from './effect-timeout.js';
import { withTimeout } from './effect-timeout.js';
import type { Effect, Result } from './effect-utils.js';
import { isFail, isOk } from './effect-utils.js';

/* eslint-disable ai-security/data-leakage */
// В этом модуле telemetry-хуки передают только служебные метки шагов и счётчики, без пользовательских данных.

/* ============================================================================
 * 🔭 OBSERVABILITY (OPTIONAL DI)
 * ========================================================================== */

/**
 * Fire-and-forget телеметрия оркестратора.
 * @remarks
 * - В `@livai/core` по умолчанию no-op (без runtime зависимостей).
 * - Для production/тестов можно внедрить через `createOrchestrator({ telemetry })`.
 */
export type OrchestratorTelemetry = Readonly<{
  info?: (message: string, data?: Record<string, unknown>) => void;
  warn?: (message: string, data?: Record<string, unknown>) => void;
}>;

function createNoopTelemetry(): OrchestratorTelemetry {
  return {};
}

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/**
 * Шаг оркестрации.
 * Каждый шаг изолирован и имеет свой timeout.
 */
export interface Step<T> {
  /** Метка шага для логирования и телеметрии */
  readonly label: string;

  /** Effect для выполнения (включая вариант с previousResult) */
  readonly effect: EffectWithPrevious<T, unknown>;

  /** Timeout в миллисекундах (опционально, по умолчанию без timeout) */
  readonly timeoutMs?: number | undefined;
}

/**
 * Результат выполнения шага.
 * Содержит результат или ошибку изоляции.
 */
export type StepResult<T> = Result<T, IsolationError | TimeoutError>;

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/**
 * Effect который может использовать результат предыдущего шага.
 * @remarks
 * Выделен в явный тип, чтобы не полагаться на runtime проверку `effect.length`.
 */
export type EffectWithPrevious<T, P = unknown> = (
  signal?: AbortSignal,
  previousResult?: P,
) => Promise<T>;

/**
 * Helper для создания шага оркестрации.
 * @param label - Метка шага для логирования и телеметрии
 * @param effect - Effect для выполнения
 * @param timeoutMs - Timeout в миллисекундах (опционально)
 * @returns Step для использования в orchestrate
 *
 * @example
 * ```ts
 * const fetchUserStep = step(
 *   'fetch-user',
 *   async (signal) => fetchUser(signal),
 *   5000,
 * );
 * ```
 */
export function step<T>(
  label: string,
  effect: Effect<T>,
  timeoutMs?: number | undefined,
): Step<T> {
  return {
    label,
    effect: (signal?: AbortSignal): Promise<T> => effect(signal),
    timeoutMs,
  };
}

/**
 * Helper для создания шага оркестрации, которому нужен previousResult.
 * @param label - Метка шага для логирования и телеметрии
 * @param effect - Effect, который принимает previousResult
 * @param timeoutMs - Timeout в миллисекундах (опционально)
 * @returns Step для использования в orchestrate
 */
export function stepWithPrevious<T, P = unknown>(
  label: string,
  effect: EffectWithPrevious<T, P>,
  timeoutMs?: number | undefined,
): Step<T> {
  return {
    label,
    effect: (signal?: AbortSignal, previousResult?: unknown): Promise<T> =>
      effect(signal, previousResult as P),
    timeoutMs,
  };
}

/* ============================================================================
 * 🎯 ОСНОВНОЙ API
 * ========================================================================== */

/**
 * Выполняет последовательность шагов с step-level isolation и timeout.
 * Поведение:
 * - ✅ Каждый шаг изолирован через runIsolated (единственное место isolation)
 * - ✅ Каждый шаг имеет свой timeout (если указан)
 * - ✅ Ошибки одного шага не влияют на другие (cascading failure prevention)
 * - ✅ Результат предыдущего шага передается в следующий
 * - ✅ Step-level telemetry через fire-and-forget
 * @param steps - Массив шагов для выполнения
 * @returns Effect с результатом последнего шага или ошибкой
 *
 * @example
 * ```ts
 * const effect = orchestrate([
 *   step('fetch-user', async (signal) => api.fetchUser(signal), 5000),
 *   stepWithPrevious('validate-user', async (_signal, user) => validateUserData(user), 3000),
 *   stepWithPrevious('save-user', async (signal, user) => api.saveUser(user, signal)),
 * ]);
 *
 * // orchestration возвращает значение последнего шага или бросает ошибку шага (TimeoutError/IsolationError/любую исходную)
 * const savedUser = await effect();
 * void savedUser;
 * ```
 */
export function orchestrate<T extends readonly unknown[]>(
  steps: readonly [...{ [K in keyof T]: Step<T[K]>; }],
): Effect<T[number]> {
  return createOrchestrator().orchestrate(steps);
}

/**
 * Создает orchestrator с внедряемой telemetry (DI-friendly).
 * @remarks
 * В `@livai/core/effect` по умолчанию экспортируется no-op orchestrator через `orchestrate(...)`.
 */
export function createOrchestrator(
  options?: Readonly<{ telemetry?: OrchestratorTelemetry; }>,
): Readonly<{
  orchestrate: typeof orchestrate;
  step: typeof step;
  stepWithPrevious: typeof stepWithPrevious;
}> {
  const telemetry = options?.telemetry ?? createNoopTelemetry();

  const orchestrateImpl = <T extends readonly unknown[]>(
    steps: readonly [...{ [K in keyof T]: Step<T[K]>; }],
  ): Effect<T[number]> => {
    if (steps.length === 0) {
      return () => Promise.reject(new Error('[orchestrator] Cannot orchestrate empty steps array'));
    }

    return async (signal?: AbortSignal): Promise<T[number]> => {
      const runStep = async (
        previousResult: unknown,
        currentStep: Step<unknown>,
        stepIndex: number,
      ): Promise<unknown> => {
        const { label, effect, timeoutMs } = currentStep;

        // Создаем effect с доступом к результату предыдущего шага
        const stepEffect: Effect<unknown> = async (stepSignal?: AbortSignal) => {
          const effectiveSignal = stepSignal ?? signal;
          return effect(effectiveSignal, previousResult);
        };

        // Применяем timeout, если указан
        const effectWithTimeout = timeoutMs != null && timeoutMs > 0
          ? withTimeout(stepEffect, { timeoutMs, tag: label })
          : stepEffect;

        // Изолируем шаг (единственное место isolation)
        const stepResult = await runIsolated(effectWithTimeout, { tag: label });

        if (isOk(stepResult)) {
          telemetry.info?.('Step completed', {
            stepIndex,
            stepLabel: label,
            totalSteps: steps.length,
          });
          return stepResult.value;
        }

        if (isFail(stepResult)) {
          const error = stepResult.error;
          telemetry.warn?.('Step failed', {
            stepIndex,
            stepLabel: label,
            totalSteps: steps.length,
            error: error instanceof Error
              ? error.message
              : String(error),
          });
          return Promise.reject(error);
        }

        // Теоретически недостижимо, но оставляем safety fallback
        return Promise.reject(new Error('[orchestrator] Invalid Result state'));
      };

      const initial: Promise<unknown> = Promise.resolve(undefined as unknown);
      const chain = steps.reduce(
        (prevPromise, currentStep, stepIndex) =>
          prevPromise.then((prev) => runStep(prev, currentStep as Step<unknown>, stepIndex)),
        initial,
      );

      return await chain as T[number];
    };
  };

  return Object.freeze({
    orchestrate: orchestrateImpl as typeof orchestrate,
    step,
    stepWithPrevious,
  });
}

/* eslint-enable ai-security/data-leakage */
