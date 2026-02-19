/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.adapter.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Application Boundary)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Boundary адаптеры между application и domain слоями
 * - Effect library → Effect utils адаптация
 * - AbortSignal bridge
 * - Причина изменения: transport / framework / effect runtime
 *
 * Принципы:
 * - ✅ Adapter pattern — изоляция domain от transport
 * - ✅ Boundary layer — защита от framework coupling
 * - ✅ Runtime abstraction — скрытие деталей Effect library
 */

import type { Effect } from '@livai/app/lib/effect-utils.js';
import type { Effect as EffectLib } from 'effect';
import { Runtime } from 'effect';

/* ============================================================================
 * 🔧 ADAPTERS (Effect Library → Effect Utils)
 * ============================================================================
 */

/**
 * Адаптирует Effect.Effect<T> в Effect<T> для интеграции DeviceFingerprint с orchestrator
 *
 * @warning Architectural Limitation: Promise.race не обеспечивает реального cancellation.
 * Runtime.runPromise продолжает выполняться после reject, что может приводить к:
 * - Side effects после timeout (например, вызовы auditHook)
 * - Двойным вызовам auditHook
 * - Memory leaks (неосвобожденные ресурсы)
 * - Non-deterministic behavior в security pipeline
 *
 * @note Для production security pipeline рекомендуется использовать Effect runtime
 * с поддержкой cooperative cancellation или альтернативные подходы к cancellation.
 */
export function adaptEffectLibraryToUtils<T>(
  effect: EffectLib.Effect<T>, // Effect из библиотеки effect
): Effect<T> { // Effect из effect-utils (async функция с AbortSignal)
  return async (signal?: AbortSignal): Promise<T> => {
    // Если передан AbortSignal, проверяем его перед выполнением
    if (signal?.aborted === true) {
      throw new Error('Effect execution aborted');
    }

    // Выполняем Effect через defaultRuntime
    const effectPromise = Runtime.runPromise(Runtime.defaultRuntime, effect);

    // Если передан AbortSignal, создаем race для прерывания promise chain
    // @warning Это не останавливает выполнение Effect library в фоне
    if (signal !== undefined) {
      const abortPromise = new Promise<never>((_resolve, reject) => {
        const abortHandler = (): void => {
          signal.removeEventListener('abort', abortHandler);
          reject(new Error('Effect execution aborted via AbortSignal'));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      });

      // Promise.race прерывает promise chain, но не останавливает Effect library
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- isolation обеспечивается через orchestrator.step()
      return Promise.race([effectPromise, abortPromise]);
    }

    return effectPromise;
  };
}
