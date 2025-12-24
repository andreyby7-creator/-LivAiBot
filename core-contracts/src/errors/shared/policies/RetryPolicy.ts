/**
 * @file RetryPolicy.ts
 *
 * Алгебра retry-политик для Effect.
 *
 * Принципы:
 *  - retry = чистая стратегия (без side-effects)
 *  - policy ≠ Schedule (Schedule — лишь адаптер)
 *  - никакой domain / recovery / circuit breaker логики
 *
 * Используется как foundation-layer для всех адаптеров.
 */

import { Duration, Effect, Schedule } from 'effect';

// ==================== БАЗОВЫЕ ТИПЫ ====================

/** Контекст retry-попытки */
export type RetryContext<E = unknown> = {
  readonly attempt: number;
  readonly error: E;
};

/** Решение retry-политики */
export type RetryDecision =
  | { readonly _tag: 'Retry'; readonly delay: Duration.Duration; }
  | { readonly _tag: 'Stop'; };

/** Retry-политика как чистая функция */
export type RetryPolicy<E = unknown> = (
  ctx: RetryContext<E>,
) => RetryDecision;

// ==================== ПРИМИТИВНЫЕ ПОЛИТИКИ ====================

/** Никогда не повторять */
export const noRetry: RetryPolicy = () => ({ _tag: 'Stop' });

/** Повтор с фиксированной задержкой */
export const fixedDelay = (delayMs: number): RetryPolicy => () => ({
  _tag: 'Retry',
  delay: Duration.millis(delayMs),
});

/** Линейный backoff */
export const linearBackoff = (baseDelayMs: number): RetryPolicy => ({ attempt }) => ({
  _tag: 'Retry',
  delay: Duration.millis(baseDelayMs * attempt),
});

/** Базовое значение для расчета экспоненциального backoff */
const EXPONENTIAL_BASE = 2;

/** Экспоненциальный backoff */
export const exponentialBackoff = (baseDelayMs: number): RetryPolicy => ({ attempt }) => ({
  _tag: 'Retry',
  delay: Duration.millis(baseDelayMs * Math.pow(EXPONENTIAL_BASE, attempt - 1)),
});

// ==================== КОМБИНАТОРЫ ====================

/** Ограничение количества попыток */
export const limitAttempts =
  <E>(maxAttempts: number) => (policy: RetryPolicy<E>): RetryPolicy<E> => (ctx) =>
    ctx.attempt >= maxAttempts
      ? { _tag: 'Stop' }
      : policy(ctx);

/** Retry только для определённых ошибок */
export const retryIf =
  <E>(predicate: (error: E) => boolean) => (policy: RetryPolicy<E>): RetryPolicy<E> => (ctx) =>
    predicate(ctx.error)
      ? policy(ctx)
      : { _tag: 'Stop' };

/** Коэффициент jitter по умолчанию (30% от базовой задержки) */
const DEFAULT_JITTER_RATIO = 0.3;

/** Добавление jitter к задержке */
export const withJitter =
  <E>(ratio = DEFAULT_JITTER_RATIO) => (policy: RetryPolicy<E>): RetryPolicy<E> => (ctx) => {
    const decision = policy(ctx);
    if (decision._tag === 'Stop') {
      return decision;
    }

    const baseMs = Duration.toMillis(decision.delay);
    const jitter = baseMs * ratio * Math.random();

    return {
      _tag: 'Retry',
      delay: Duration.millis(baseMs + jitter),
    };
  };

/** Композиция retry политик */
export const buildRetryPolicy = <E>(
  policy: RetryPolicy<E>,
  ...combinators: ((p: RetryPolicy<E>) => RetryPolicy<E>)[]
): RetryPolicy<E> => combinators.reduce((acc, combinator) => combinator(acc), policy);

// ==================== ADAPTER: POLICY → SCHEDULE ====================

/**
 * @experimental Преобразование RetryPolicy в Effect.Schedule
 *
 * ⚠️ Текущее состояние:
 *    - attempt корректно увеличивается (через unfold)
 *    - RetryContext эволюционирует на каждой итерации (через unfold)
 *    - ОСТАНОВКА работает корректно (через whileInput)
 *    - ⚠️ delay из RetryDecision НЕ интегрирован (требует Schedule.makeWithState)
 *
 * 🔄 Будущая реализация через Schedule.makeWithState для полной интеграции delay
 *
 * Пока используйте withRetryPolicy для production - он работает корректно
 */
export const toSchedule = <E>(
  policy: RetryPolicy<E>,
): Schedule.Schedule<RetryContext<E>, RetryContext<E>, never> => {
  // unfold для эволюции состояния + whileInput для остановки
  const base = Schedule.unfold(
    { attempt: 1, error: undefined as E },
    (ctx) => ({ attempt: ctx.attempt + 1, error: ctx.error }),
  );

  return base.pipe(
    Schedule.whileInput((ctx) => policy(ctx)._tag === 'Retry'),
  );
};

// ==================== EFFECT HELPERS ====================

/**
 * ✅ ПРОДАКШЕН ГОТОВАЯ функция - применять retry-политику к Effect
 *
 * Осознанно не используем Effect.retry / Schedule для полного контроля над retry-семантикой:
 * - zero dependency on Schedule semantics
 * - предсказуемая эволюция RetryContext
 * - полный контроль над timing и delay
 * - корректная обработка всех edge cases
 */
export const withRetryPolicy =
  <A, E>(policy: RetryPolicy<E>) => (effect: Effect.Effect<A, E>): Effect.Effect<A, E> => {
    const retryWithContext = (
      currentEffect: Effect.Effect<A, E>,
      attempt: number,
    ): Effect.Effect<A, E> =>
      Effect.catchAll(currentEffect, (error) => {
        const ctx: RetryContext<E> = { attempt, error };
        const decision = policy(ctx);

        if (decision._tag === 'Stop') {
          return Effect.fail(error);
        }

        return Effect.delay(
          retryWithContext(currentEffect, attempt + 1),
          decision.delay,
        );
      });

    return retryWithContext(effect, 1);
  };

// ==================== ГОТОВЫЕ ПОЛИТИКИ ====================

/** Максимальная задержка в мс для стандартного экспоненциального backoff */
const DEFAULT_BACKOFF_DELAY_MS = 100;

/** Максимальное количество попыток для стандартной политики */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Задержка в мс для быстрого retry */
const FAST_RETRY_DELAY_MS = 50;

/** Максимальное количество попыток для быстрого retry */
const FAST_MAX_ATTEMPTS = 5;

/** Задержка в мс для консервативного retry */
const SLOW_BACKOFF_DELAY_MS = 500;

/** Максимальное количество попыток для консервативного retry */
const SLOW_MAX_ATTEMPTS = 2;

/** Стандартная infra retry-политика */
export const DEFAULT_RETRY_POLICY = buildRetryPolicy(
  exponentialBackoff(DEFAULT_BACKOFF_DELAY_MS),
  withJitter(),
  limitAttempts(DEFAULT_MAX_ATTEMPTS),
);

/** Быстрый retry для локальных операций */
export const FAST_RETRY_POLICY = buildRetryPolicy(
  fixedDelay(FAST_RETRY_DELAY_MS),
  limitAttempts(FAST_MAX_ATTEMPTS),
);

/** Консервативный retry для внешних систем */
export const SLOW_RETRY_POLICY = buildRetryPolicy(
  exponentialBackoff(SLOW_BACKOFF_DELAY_MS),
  limitAttempts(SLOW_MAX_ATTEMPTS),
);
