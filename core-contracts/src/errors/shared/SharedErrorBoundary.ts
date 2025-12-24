/**
 * @file SharedErrorBoundary.ts
 *
 * Хелперы для error boundary в shared-операциях.
 * Используется для 80% случаев обработки ошибок в adapters/services.
 *
 * Принципы:
 *  - чистая функция для нормализации и сериализации ошибок
 *  - интеграция с Retry/Recovery поверх Effect
 *  - zero side-effects кроме логирования через logger
 */

import { Effect } from 'effect';

import { withRetryPolicy } from './policies/RetryPolicy.js';

import type { RetryDecision, RetryPolicy } from './policies/RetryPolicy.js';

export type SharedErrorBoundaryOptions<E = unknown, N = unknown> = {
  /** Нормализация ошибки к внутреннему типу */
  normalize?: (error: E) => N;
  /** Стратегия обработки ошибки: fail | retry | fallback */
  strategy?: (error: N) => RetryDecision;
  /** Сериализация ошибки для логирования */
  serialize?: (error: N) => string;
  /** Логгер вместо console */
  logger?: (msg: string) => void;
  /** Retry-политика для повторов */
  retryPolicy?: RetryPolicy<N>;
};

/**
 * Применить shared error boundary к Effect
 * @example
 * const result = withSharedErrorBoundary(effect, {
 *   normalize: (e) => e,
 *   strategy: (e) => ({ _tag: 'Retry', delay: 100 }),
 *   serialize: (e) => e.message,
 *   logger: console.error,
 *   retryPolicy: DEFAULT_RETRY_POLICY,
 * });
 */
export function withSharedErrorBoundary<A, E, N = E>(
  effect: Effect.Effect<A, E>,
  opts: SharedErrorBoundaryOptions<E, N>,
): Effect.Effect<A, E> {
  const {
    normalize = (e: E): N => e as unknown as N,
    strategy = (): RetryDecision => ({ _tag: 'Stop' } as RetryDecision),
    serialize = (e: N): string => JSON.stringify(e),
    logger = (msg: string): void => {
      console.error(msg);
    },
    retryPolicy,
  } = opts;

  const retryableEffect = retryPolicy
    ? withRetryPolicy(retryPolicy)(
      effect.pipe(
        Effect.catchAll((err: E) => {
          const normalized = normalize(err);
          logger(`SharedErrorBoundary: ${serialize(normalized)}`);
          return Effect.fail(normalized);
        }),
      ),
    )
    : effect.pipe(
      Effect.catchAll((err: E) => {
        const normalized = normalize(err);
        logger(`SharedErrorBoundary: ${serialize(normalized)}`);
        const decision = strategy(normalized);
        return decision._tag === 'Stop' ? Effect.fail(err) : Effect.fail(err);
      }),
    );

  return retryableEffect as Effect.Effect<A, E>;
}
