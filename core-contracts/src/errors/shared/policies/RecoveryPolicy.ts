/**
 * @file RecoveryPolicy.ts
 *
 * Алгебра recovery-политик (graceful degradation) для Effect.
 *
 * Принципы:
 *  - recovery = чистая стратегия (без side-effects)
 *  - recovery ≠ retry (никаких повторов и таймингов)
 *  - policy ≠ Effect (Effect — лишь интерпретатор)
 *  - никакой domain / circuit breaker логики
 *
 * Используется как foundation-layer для всех адаптеров.
 */

import { Effect } from 'effect';

// ==================== БАЗОВЫЕ ТИПЫ ====================

/** Контекст восстановления */
export type RecoveryContext<E = unknown> = {
  readonly error: E;
};

/** Решение recovery-политики */
export type RecoveryDecision<A = unknown> =
  | { readonly _tag: 'Recover'; readonly value: A; }
  | { readonly _tag: 'RecoverEffect'; readonly effect: Effect.Effect<A, never>; }
  | { readonly _tag: 'Fail'; };

/** Recovery-политика как чистая функция */
export type RecoveryPolicy<A = unknown, E = unknown> = (
  ctx: RecoveryContext<E>,
) => RecoveryDecision<A>;

// ==================== ПРИМИТИВНЫЕ ПОЛИТИКИ ====================

/** Никогда не восстанавливаться */
export const noRecovery = <A = never, E = unknown>(): RecoveryPolicy<A, E> => () => ({
  _tag: 'Fail',
});

/** Немедленный fallback-результат */
export const fallbackValue = <A, E = unknown>(value: A): RecoveryPolicy<A, E> => () => ({
  _tag: 'Recover',
  value,
});

/** Ленивый fallback (без Effect) */
export const fallbackFactory = <A, E = unknown>(factory: () => A): RecoveryPolicy<A, E> => () => ({
  _tag: 'Recover',
  value: factory(),
});

/** Ленивый fallback через Effect */
export const fallbackEffect = <A, E = unknown>(
  effectFactory: () => Effect.Effect<A, never>,
): RecoveryPolicy<A, E> =>
() => ({ _tag: 'RecoverEffect', effect: effectFactory() });

// ==================== КОМБИНАТОРЫ ====================

/** Recovery только для определённых ошибок */
export const recoverIf =
  <A, E>(predicate: (error: E) => boolean) =>
  (policy: RecoveryPolicy<A, E>): RecoveryPolicy<A, E> =>
  (ctx) =>
    predicate(ctx.error)
      ? policy(ctx)
      : { _tag: 'Fail' };

/** Композиция recovery-политик (первая Recover побеждает) */
export const buildRecoveryPolicy = <A, E>(
  ...policies: RecoveryPolicy<A, E>[]
): RecoveryPolicy<A, E> =>
(ctx) => {
  for (const policy of policies) {
    const decision = policy(ctx);
    if (decision._tag !== 'Fail') {
      return decision;
    }
  }
  return { _tag: 'Fail' };
};

// ==================== EFFECT HELPERS ====================

/**
 * Применить recovery-политику к Effect
 *
 * Семантика:
 *  - effect выполняется ровно один раз
 *  - retry здесь невозможен
 *  - recovery либо возвращает fallback
 *  - либо пробрасывает исходную ошибку
 */
export const withRecoveryPolicy =
  <A, E>(policy: RecoveryPolicy<A, E>) => (effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    Effect.catchAll(effect, (error) => {
      const ctx: RecoveryContext<E> = { error };
      const decision = policy(ctx);

      switch (decision._tag) {
        case 'Recover':
          return Effect.succeed(decision.value);

        case 'RecoverEffect':
          return decision.effect;

        case 'Fail':
        default:
          return Effect.fail(error);
      }
    });

// ==================== ГОТОВЫЕ ПОЛИТИКИ ====================

/** Стандартная политика: без восстановления */
export const DEFAULT_RECOVERY_POLICY = noRecovery();

/** Recovery через null (read-операции) */
export const NULL_RECOVERY_POLICY = fallbackValue<null, unknown>(null);

/** Recovery через пустой массив */
export const EMPTY_ARRAY_RECOVERY_POLICY = fallbackValue<unknown[], unknown>([]);

/** Recovery через пустой объект */
export const EMPTY_OBJECT_RECOVERY_POLICY = fallbackValue<Record<string, never>, unknown>({});
