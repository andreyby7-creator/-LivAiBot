/**
 * @file @livai/core/state-kit — Store/State Primitives
 * Публичный API пакета state-kit.
 * Экспортирует framework-agnostic примитивы для store/state: persist helpers (merge + storage), OperationState и helpers.
 */

/* ============================================================================
 * 💾 PERSIST — SSR-SAFE STORAGE & MERGE CONTRACT
 * ========================================================================== */

/**
 * Persist helpers: SSR-safe storage и контракт merge persisted → current.
 * Гарантии:
 * - shallow merge на верхнем уровне
 * - `persisted.actions` игнорируется (actions всегда берутся из текущего store)
 * @public
 */
export { createNoopStorage, mergePreservingActions } from './persist.js';

/* ============================================================================
 * ⚙️ OPERATION — ЕДИНЫЙ ЯЗЫК СТАТУСОВ ОПЕРАЦИЙ
 * ========================================================================== */

/**
 * OperationState: единый статус для операций (idle/loading/success/error).
 * Предоставляет строгие конструкторы, type guards и reset helper.
 * @public
 */
export {
  failure,
  idle,
  isError,
  isIdle,
  isLoading,
  isSuccess,
  loading,
  type OperationState,
  type OperationStatus,
  reset,
  success,
} from './operation.js';

/* ============================================================================
 * 🔁 UPDATER — ЧИСТОЕ ПРИМЕНЕНИЕ ОБНОВЛЕНИЙ К STATE
 * ========================================================================== */

/**
 * Updater helpers: единый контракт для функционального обновления state.
 * Гарантии:
 * - referential equality: при `next === state` возвращается исходный объект
 * - предполагается, что updater не мутирует аргумент (enforce через ESLint)
 * @public
 */
export { applyUpdater } from './updater.js';

/* ============================================================================
 * 🔢 VERSION — СРАВНЕНИЕ НОМЕРНЫХ ВЕРСИЙ STATE
 * ========================================================================== */

/**
 * Version helpers: сравнение и проверка числовых версий state/store.
 * Гарантии:
 * - используются только number-версии (semver-строки запрещены в state-kit)
 * - предоставляют compare/assert/isVersionMismatch без migrate-логики
 * @public
 */
export { assertVersionEqual, compareVersion, isVersionMismatch } from './version.js';
