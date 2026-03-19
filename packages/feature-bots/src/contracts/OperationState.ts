/**
 * @file packages/feature-bots/src/contracts/OperationState.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Operation State Contracts
 * ============================================================================
 *
 * Контракты для lifecycle state моделей операций в эффектах/сторе.
 * Важно: это boundary-типы, которые НЕ зависят от внутренней реализации `BotsState`.
 */

/* ============================================================================
 * 🧩 OPERATION STATE CONTRACTS
 * ============================================================================
 */

export type OperationSuccess<T> = Readonly<{
  readonly status: 'success';
  readonly data: T;
}>;

export type OperationLoading<Op extends string = string> = Readonly<{
  readonly status: 'loading';
  readonly operation: Op;
}>;

export type OperationError<E> = Readonly<{
  readonly status: 'error';
  readonly error: E;
}>;

/**
 * Единый lifecycle-state контракт для операции.
 * Boundary-тип, который описывает полный union: loading → success/error.
 */
export type OperationState<T, E, Op extends string = string> =
  | OperationLoading<Op>
  | OperationSuccess<T>
  | OperationError<E>;

/** Версия контракта operation lifecycle state (для future migrations/compat). */
export const operationStateContractVersion = 1 as const;
