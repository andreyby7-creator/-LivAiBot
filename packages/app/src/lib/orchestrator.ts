/**
 * @file packages/app/src/lib/orchestrator.ts
 * ============================================================================
 * 🎼 ORCHESTRATOR — БЕЗОПАСНАЯ КОМПОЗИЦИЯ АСИНХРОННЫХ ОПЕРАЦИЙ
 * ============================================================================
 *
 * Минимальный, чистый boundary-модуль для безопасной композиции асинхронных
 * операций с step-level isolation и timeout.
 *
 * Архитектурная роль:
 * - Step-level isolation (единственное место isolation через runIsolated)
 * - Step-level timeout (через withTimeout)
 * - Безопасная композиция шагов с передачей результата
 * - Step-level telemetry (fire-and-forget события в observability layer)
 *
 * Принципы:
 * - Zero business logic
 * - Zero error mapping (error mapping → error-mapping layer)
 * - Zero retry logic (retry → effect-retry layer)
 * - Zero parallel execution (parallel → scheduler layer)
 * - Zero state management (state → store layer)
 * - Только orchestration: isolation, timeout, композиция
 *
 * ⚠️ Важно: Isolation только здесь
 * - orchestrator — единственное место isolation через runIsolated
 * - validatedEffect НЕ делает isolation (только валидация + throw)
 * - api-client НЕ делает isolation (только transport)
 *
 * ⚠️ Архитектурное правило: Timeout только в orchestrator
 * - Orchestrator использует effect-timeout.ts для каждого step
 * - api-client только поддерживает AbortSignal (не устанавливает timeout)
 * - Единая точка управления timeout
 */

import { runIsolated } from './effect-isolation.js';
import type { IsolationError } from './effect-isolation.js';
import { withTimeout } from './effect-timeout.js';
import type { TimeoutError } from './effect-timeout.js';
import type { Effect, Result } from './effect-utils.js';
import { isFail, isOk } from './effect-utils.js';
import { infoFireAndForget, warnFireAndForget } from './telemetry.js';

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/**
 * Шаг оркестрации.
 * Каждый шаг изолирован и имеет свой timeout.
 */
export type Step<T> = {
  /** Метка шага для логирования и телеметрии */
  readonly label: string;

  /** Effect для выполнения */
  readonly effect: Effect<T>;

  /** Timeout в миллисекундах (опционально, по умолчанию без timeout) */
  readonly timeoutMs?: number | undefined;
};

/**
 * Результат выполнения шага.
 * Содержит результат или ошибку изоляции.
 */
export type StepResult<T> = Result<T, IsolationError | TimeoutError>;

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/**
 * Helper для создания шага оркестрации.
 *
 * @param label - Метка шага для логирования и телеметрии
 * @param effect - Effect для выполнения
 * @param timeoutMs - Timeout в миллисекундах (опционально)
 * @returns Step для использования в orchestrate
 *
 * @example
 * ```ts
 * const step1 = step('fetch-user', async () => {
 *   return await fetchUser();
 * }, 5000);
 * ```
 */
export function step<T>(
  label: string,
  effect: Effect<T>,
  timeoutMs?: number | undefined,
): Step<T> {
  return {
    label,
    effect,
    timeoutMs,
  };
}

/* ============================================================================
 * 🎯 ОСНОВНОЙ API
 * ========================================================================== */

/**
 * Выполняет последовательность шагов с step-level isolation и timeout.
 *
 * Поведение:
 * - ✅ Каждый шаг изолирован через runIsolated (единственное место isolation)
 * - ✅ Каждый шаг имеет свой timeout (если указан)
 * - ✅ Ошибки одного шага не влияют на другие (cascading failure prevention)
 * - ✅ Результат предыдущего шага передается в следующий
 * - ✅ Step-level telemetry через fire-and-forget
 *
 * @param steps - Массив шагов для выполнения
 * @returns Effect с результатом последнего шага или ошибкой
 *
 * @example
 * ```ts
 * const result = await orchestrate([
 *   step('fetch-user', async () => await fetchUser(), 5000),
 *   step('validate-user', async (prev) => {
 *     return await validateUser(prev);
 *   }, 3000),
 *   step('save-user', async (prev) => {
 *     return await saveUser(prev);
 *   }),
 * ]);
 *
 * if (isOk(result)) {
 *   console.log('Success:', result.value);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export function orchestrate<T extends readonly unknown[]>(
  steps: readonly [...{ [K in keyof T]: Step<T[K]>; }],
): Effect<T[number]> {
  if (steps.length === 0) {
    throw new Error('[orchestrator] Cannot orchestrate empty steps array');
  }

  return async (signal?: AbortSignal): Promise<T[number]> => {
    let previousResult: unknown = undefined;

    for (let i = 0; i < steps.length; i++) {
      const currentStep = steps[i];
      // TypeScript гарантирует, что currentStep определен для валидного индекса
      const { label, effect, timeoutMs } = currentStep;

      // Создаем effect с доступом к результату предыдущего шага
      // Effect может быть стандартным Effect или функцией, принимающей previousResult
      const stepEffect: Effect<unknown> = async (stepSignal?: AbortSignal) => {
        const effectiveSignal = stepSignal ?? signal;
        // Если effect - функция с двумя параметрами, передаем previousResult
        if (effect.length >= 2) {
          return (effect as (signal?: AbortSignal, previousResult?: unknown) => Promise<unknown>)(
            effectiveSignal,
            previousResult,
          );
        }
        // Иначе вызываем как стандартный Effect
        return effect(effectiveSignal);
      };

      // Применяем timeout, если указан
      const effectWithTimeout = timeoutMs != null && timeoutMs > 0
        ? withTimeout(stepEffect, { timeoutMs, tag: label })
        : stepEffect;

      // Изолируем шаг (единственное место isolation)
      const stepResult = await runIsolated(effectWithTimeout, { tag: label });

      // Логируем результат шага через fire-and-forget telemetry
      if (isOk(stepResult)) {
        infoFireAndForget(`Step completed: ${label}`, {
          stepIndex: i,
          stepLabel: label,
          totalSteps: steps.length,
        });
        previousResult = stepResult.value;
      } else if (isFail(stepResult)) {
        const error = stepResult.error;
        warnFireAndForget(`Step failed: ${label}`, {
          stepIndex: i,
          stepLabel: label,
          totalSteps: steps.length,
          error: error instanceof Error
            ? error.message
            : String(error),
        });
        // Возвращаем ошибку изоляции (не продолжаем выполнение следующих шагов)
        throw error;
      }
    }

    // Возвращаем результат последнего шага
    return previousResult as T[number];
  };
}
