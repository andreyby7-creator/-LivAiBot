/**
 * @file packages/core/src/state-kit/operation.ts
 * ============================================================================
 * 🧱 CORE — State Kit (OperationState)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Foundation primitives для описания статуса операции (idle/loading/success/error)
 * - Используется в feature-/app-слоях для единообразного представления async/sync операций
 * - Не знает про zustand/React/Next и не тянет runtime зависимости
 *
 * Принципы:
 * - ✅ Framework-agnostic: чистые типы и helpers, годятся для SSR и unit-тестов
 * - ✅ Discriminated union: status — единственный тег для pattern matching
 * - ✅ Строгие конструкторы: loading/success/error с обязательными аргументами
 * - ✅ Reset helper: всегда возвращает строго `{ status: 'idle' }`
 *
 * ⚠️ ВАЖНО:
 * - 🚫 Никаких reducer/dispatch/middleware в core/state-kit
 * - 🚫 Никаких runtime adapters (zustand/React)
 */

export type OperationStatus = 'idle' | 'loading' | 'success' | 'error';

/* ============================================================================
 * 📦 OperationState — ТИПЫ СОСТОЯНИЯ ОПЕРАЦИИ
 * ========================================================================== */

export type OperationState<T, Op extends string, E> =
  | { status: 'idle'; }
  | { status: 'loading'; operation: Op; }
  | { status: 'success'; data: T; }
  | { status: 'error'; error: E; };

/* ============================================================================
 * ⚙️ CONSTRUCTORS — КОНСТРУКТОРЫ СОСТОЯНИЙ
 * ========================================================================== */

/**
 * Конструктор состояния "idle".
 * @returns OperationState<T, Op, E> с status="idle"
 */
export function idle<T, Op extends string, E>(): OperationState<T, Op, E> {
  return { status: 'idle' };
}

/**
 * Конструктор состояния "loading" с обязательным именем операции.
 *
 * @template Op extends string
 * @param {Op} operation - идентификатор операции (например, 'create' | 'update')
 * @returns OperationState<never, Op, never> с status="loading"
 */
export function loading<Op extends string>(
  operation: Op,
): OperationState<never, Op, never> {
  return { status: 'loading', operation };
}

/**
 * Конструктор состояния "success" с обязательными данными результата.
 *
 * @template T
 * @param {T} data - полезная нагрузка успешной операции
 * @returns OperationState<T, string, never> с status="success"
 */
export function success<T>(data: T): OperationState<T, string, never> {
  return { status: 'success', data };
}

/**
 * Конструктор состояния "error" с обязательной ошибкой.
 *
 * @template E
 * @param {E} error - ошибка операции
 * @returns OperationState<never, string, E> с status="error"
 */
export function failure<E>(error: E): OperationState<never, string, E> {
  return { status: 'error', error };
}

/* ============================================================================
 * 🔍 TYPE GUARDS — ПРОВЕРКА СТАТУСОВ
 * ========================================================================== */

/** Type guard: состояние в "idle". */
export function isIdle<T, Op extends string, E>(
  state: OperationState<T, Op, E>,
): state is { status: 'idle'; } {
  return state.status === 'idle';
}

/** Type guard: состояние в "loading". */
export function isLoading<T, Op extends string, E>(
  state: OperationState<T, Op, E>,
): state is { status: 'loading'; operation: Op; } {
  return state.status === 'loading';
}

/** Type guard: состояние в "success". */
export function isSuccess<T, Op extends string, E>(
  state: OperationState<T, Op, E>,
): state is { status: 'success'; data: T; } {
  return state.status === 'success';
}

/** Type guard: состояние в "error". */
export function isError<T, Op extends string, E>(
  state: OperationState<T, Op, E>,
): state is { status: 'error'; error: E; } {
  return state.status === 'error';
}

/* ============================================================================
 * 🔁 RESET — СБРОС ОПЕРАЦИИ В IDLE
 * ========================================================================== */

/**
 * Reset helper: всегда возвращает строго `{ status: 'idle' }`.
 * Удобен как общий "сброс" операции, когда не важны типы payload/operation/error.
 */
export function reset(): OperationState<unknown, string, unknown> {
  return idle<unknown, string, unknown>();
}
