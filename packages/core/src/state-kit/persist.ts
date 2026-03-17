/**
 * @file packages/core/src/state-kit/persist.ts
 * ============================================================================
 * 🧱 CORE — State Kit (Persist Helpers)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Foundation primitives для persist слоя store/state
 * - Не знает про zustand/React/Next и не тянет runtime зависимости
 * - Используется в app/feature слоях как low-level helper
 *
 * Принципы:
 * - ✅ Framework-agnostic: годится для SSR и unit-тестов
 * - ✅ Shallow merge only: только верхний уровень (никакого deep merge)
 * - ✅ Preserve actions: `persisted.actions` всегда игнорируется
 * - ✅ Fail-closed: invalid persisted → возвращаем current
 *
 * ⚠️ ВАЖНО:
 * - 🚫 Никаких migrations/validate в core/state-kit
 * - 🚫 Никаких runtime adapters (zustand)
 */

type ObjectRecord = Record<string, unknown>;

/* ============================================================================
 * 🔍 TYPE GUARDS — ПРОВЕРКА PLAIN-ОБЪЕКТОВ
 * ========================================================================== */

function isPlainObject(value: unknown): value is ObjectRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  // Жёстче ограничиваемся plain-объектами без кастомного прототипа
  return Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Shallow merge persisted state → current, при этом всегда сохраняет current.actions.
 *
 * Контракт:
 * - если persisted не является plain object → возвращаем current
 * - persisted.actions всегда игнорируется
 * - только shallow merge на верхнем уровне (без глубокого слияния / nested merge)
 *
 * Если нужен deep merge для вложенных объектов — это отдельный helper на уровне domain,
 * а не в core/state-kit.
 *
 * @template T
 * @param {unknown} persisted - произвольный объект из persist-слоя
 * @param {T} current - текущий state со своими actions
 * @returns {T} новый state с shallow-обновлёнными полями и неизменёнными actions
 */
export function mergePreservingActions<T extends { actions: unknown; }>(
  persisted: unknown,
  current: T,
): T {
  if (!isPlainObject(persisted)) return current;

  const enumerableEntries = Object.entries(persisted).filter(
    ([key]) => key !== 'actions',
  );
  const rest = Object.fromEntries(enumerableEntries) as Partial<T>;

  return {
    ...current,
    ...rest,
    actions: current.actions,
  };
}

interface StorageLike {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
}

/**
 * SSR-safe no-op storage.
 *
 * - getItem всегда возвращает null
 * - setItem/removeItem — no-op (ничего не делают)
 */
export function createNoopStorage(): StorageLike {
  return {
    getItem: (): string | null => null,
    setItem: (): void => {},
    removeItem: (): void => {},
  };
}
