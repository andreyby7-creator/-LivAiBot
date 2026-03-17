/**
 * @file packages/core/src/state-kit/updater.ts
 * ============================================================================
 * 🧱 CORE — State Kit (Updater Helpers)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Foundation helper для применения updater-функции к state
 * - Не знает про zustand/React/Next и не тянет runtime зависимости
 * - Даёт единый контракт для "функционального" обновления state
 *
 * Принципы:
 * - ✅ Framework-agnostic: чистая функция, пригодна для SSR и unit-тестов
 * - ✅ Без мутаций параметров: updater не должен мутировать исходный state (enforce через ESLint)
 * - ✅ Referential equality: если updater вернул тот же объект, возвращаем исходный state
 *
 * ⚠️ ВАЖНО:
 * - 🚫 updater НЕ проверяется на immutability в runtime (только через линтер)
 * - 🚫 Никаких reducer/dispatch/middleware в core/state-kit
 */

/* ============================================================================
 * 🔁 APPLY UPDATER — ФУНКЦИОНАЛЬНОЕ ОБНОВЛЕНИЕ STATE
 * ========================================================================== */

/**
 * Применяет updater к state с сохранением referential equality,
 * когда updater возвращает тот же объект.
 *
 * @template T
 * @param {T} state - исходное состояние
 * @param {(s: T) => T} updater - чистая функция-обновитель
 * @returns {T} либо новый state, либо исходный, если ссылочно не изменился
 */
export function applyUpdater<T>(state: T, updater: (s: T) => T): T {
  const next = updater(state);
  return next === state ? state : next;
}
