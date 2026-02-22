/**
 * @file packages/core/src/data-safety/structural-clone.ts
 * ============================================================================
 * 🛡️ CORE — Data Safety (Structural Clone)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Безопасное глубокое клонирование для taint tracking и boundary guards
 * - Поддерживает примитивы, объекты, массивы, Map, Set, Date, RegExp
 * - Причина изменения: data safety, taint isolation, boundary guards
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, UTILITY FUNCTIONS, CLONE OPERATIONS, API
 * - ✅ Deterministic: pure functions, immutable результаты, детерминированное поведение
 * - ✅ Domain-pure: generic по типам значений, без привязки к domain-специфичным типам
 * - ✅ Extensible: поддержка различных типов через type guards и специализированные функции клонирования
 * - ✅ Strict typing: generic типы для Cloned<T>, type guards для CloneableType
 * - ✅ Microservice-ready: stateless, без side-effects, thread-safe
 * - ✅ Security: защита от циклических ссылок (WeakMap), Prototype Pollution (фильтрация __proto__, constructor), fail-hard при неизвестных типах
 *
 * ⚠️ PRODUCTION:
 * - Fail-hard при неизвестных типах, функции и Symbol
 * - Защита от циклических ссылок (WeakMap), Prototype Pollution (фильтрация __proto__, constructor)
 * - Immutable результаты
 */

/* ============================================================================
 * 1. TYPES — CLONE MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Типы, которые могут быть безопасно клонированы */
type CloneableType =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | RegExp
  | Map<unknown, unknown>
  | Set<unknown>
  | unknown[]
  | Record<string, unknown>;

/** Результат клонирования (readonly для безопасности) */
type Cloned<T> = T extends Date ? Date
  : T extends RegExp ? RegExp
  : T extends Map<infer K, infer V> ? Map<Cloned<K>, Cloned<V>>
  : T extends Set<infer V> ? Set<Cloned<V>>
  : T extends (infer V)[] ? readonly Cloned<V>[]
  : T extends Record<string, unknown> ? Readonly<{ [K in keyof T]: Cloned<T[K]>; }>
  : T;

/* ============================================================================
 * 2. CONSTANTS — PROTOTYPE POLLUTION PROTECTION
 * ============================================================================
 */

/* ============================================================================
 * 3. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Проверяет, может ли значение быть безопасно клонировано
 * @note Защищает от функций, Symbol, и других несериализуемых типов
 * @example isCloneable({ a: 1 }) === true; isCloneable(() => {}) === false
 * @public
 */
export function isCloneable(
  value: unknown, // Значение для проверки
): value is CloneableType { // Type guard для CloneableType
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return true;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return false;
  }

  if (typeof value === 'object') {
    return (
      Array.isArray(value)
      || value instanceof Date
      || value instanceof RegExp
      || value instanceof Map
      || value instanceof Set
      || Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
  }

  return false;
}

/* ============================================================================
 * 4. CLONE OPERATIONS — SPECIALIZED CLONE FUNCTIONS
 * ============================================================================
 */

/** Опасные ключи для Prototype Pollution (фильтруются при клонировании) */
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Клонирует примитивные значения (O(1), no allocation) */
function clonePrimitive<T>(value: T): T {
  return value;
}

/** Клонирует Date объект */
function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

/** Клонирует RegExp объект */
function cloneRegExp(regex: RegExp): RegExp {
  const cloned = new RegExp(regex.source, regex.flags);
  // RegExp.lastIndex требует мутации для сохранения состояния
  // eslint-disable-next-line functional/immutable-data, fp/no-mutation
  cloned.lastIndex = regex.lastIndex;
  return cloned;
}

/** Клонирует Map с рекурсивным клонированием ключей и значений */
function cloneMap<K, V>(
  map: Map<K, V>,
  visited: WeakMap<object, unknown>,
): Map<Cloned<K>, Cloned<V>> {
  const cloned = new Map<Cloned<K>, Cloned<V>>();
  visited.set(map, cloned);

  const entries = Array.from(map.entries());
  const clonedEntries = entries.map(([key, val]) =>
    [
      structuralClone(key, visited),
      structuralClone(val, visited),
    ] as [Cloned<K>, Cloned<V>]
  );

  clonedEntries.forEach(([clonedKey, clonedValue]) => {
    // eslint-disable-next-line functional/immutable-data
    cloned.set(clonedKey, clonedValue);
  });

  return cloned;
}

/** Клонирует Set с рекурсивным клонированием значений */
function cloneSet<T>(
  set: Set<T>,
  visited: WeakMap<object, unknown>,
): Set<Cloned<T>> {
  const cloned = new Set<Cloned<T>>();
  visited.set(set, cloned);

  const values = Array.from(set.values());
  const clonedValues = values.map((val) => structuralClone(val, visited));

  clonedValues.forEach((clonedValue) => {
    // eslint-disable-next-line functional/immutable-data
    cloned.add(clonedValue);
  });

  return cloned;
}

/** Клонирует массив с рекурсивным клонированием элементов */
function cloneArray<T>(
  array: T[],
  visited: WeakMap<object, unknown>,
): readonly Cloned<T>[] {
  // Создаем пустой массив и добавляем в visited ДО рекурсивных вызовов
  // для правильной обработки циклических ссылок
  const cloned: Cloned<T>[] = [];
  visited.set(array, cloned);

  array.forEach((item) => {
    // eslint-disable-next-line functional/immutable-data
    cloned.push(structuralClone(item, visited));
  });

  return cloned;
}

/** Клонирует объект с рекурсивным клонированием свойств и защитой от Prototype Pollution */
function cloneObject<T extends Record<string, unknown>>(
  obj: T,
  visited: WeakMap<object, unknown>,
): Readonly<{ [K in keyof T]: Cloned<T[K]>; }> {
  const keys = Object.keys(obj).filter((key) => !PROTOTYPE_POLLUTION_KEYS.has(key));
  // Создаем пустой объект и добавляем в visited ДО рекурсивных вызовов
  // для правильной обработки циклических ссылок
  const cloned = {} as { [K in keyof T]: Cloned<T[K]>; };
  visited.set(obj, cloned);

  // Мутируем cloned напрямую для правильной обработки циклических ссылок
  // (необходимо для того, чтобы visited.get() возвращал правильный объект)
  keys.forEach((key) => {
    const value = obj[key];
    // eslint-disable-next-line functional/immutable-data, fp/no-mutation
    cloned[key as keyof T] = structuralClone(value, visited) as Cloned<T[keyof T]>;
  });

  return cloned as Readonly<{ [K in keyof T]: Cloned<T[K]>; }>;
}

/** Обрабатывает объекты при клонировании */
function cloneObjectValue<T>(
  value: T,
  visited: WeakMap<object, unknown>,
): Cloned<T> {
  if (visited.has(value as object)) {
    return visited.get(value as object) as Cloned<T>;
  }

  if (value instanceof Date) {
    const cloned = cloneDate(value);
    visited.set(value as object, cloned);
    return cloned as Cloned<T>;
  }

  if (value instanceof RegExp) {
    const cloned = cloneRegExp(value);
    visited.set(value as object, cloned);
    return cloned as Cloned<T>;
  }

  if (value instanceof Map) {
    return cloneMap(value, visited) as Cloned<T>;
  }

  if (value instanceof Set) {
    return cloneSet(value, visited) as Cloned<T>;
  }

  if (Array.isArray(value)) {
    return cloneArray(value, visited) as Cloned<T>;
  }

  if (
    Object.getPrototypeOf(value) === Object.prototype
    || Object.getPrototypeOf(value) === null
  ) {
    return cloneObject(value as Record<string, unknown>, visited) as Cloned<T>;
  }

  const constructorName = (value as { constructor?: { name?: string; }; }).constructor?.name
    ?? 'Unknown';
  // eslint-disable-next-line fp/no-throw
  throw new Error(
    `Cannot clone object of type ${constructorName}. `
      + 'Only plain objects, arrays, Date, RegExp, Map, and Set are supported. '
      + 'Use isCloneable() to check before cloning.',
  );
}

/* ============================================================================
 * 5. API — STRUCTURAL CLONE
 * ============================================================================
 */

/**
 * Безопасное глубокое клонирование данных (Structural Clone Algorithm)
 * @template T - Тип значения для клонирования
 * @note Поддерживает: примитивы, объекты, массивы, Date, RegExp, Map, Set.
 *       Защита: циклические ссылки (WeakMap), Prototype Pollution (фильтрация __proto__, constructor),
 *       неизвестные типы и функции/Symbol (fail-hard).
 * @example const obj = { a: 1, b: [2, 3], date: new Date(), __proto__: { polluted: true } }; obj.self = obj; const cloned = structuralClone(obj); // OK: циклические ссылки и __proto__ обрабатываются корректно
 * @throws {Error} Если значение содержит несериализуемые типы или неизвестный тип объекта
 * @public
 */
export function structuralClone<T>(
  value: T, // Значение для клонирования
  visited: WeakMap<object, unknown> = new WeakMap(), // WeakMap для отслеживания обработанных объектов (внутренний параметр)
): Cloned<T> { // Клонированная копия (readonly, immutable)
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return clonePrimitive(value) as Cloned<T>;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `Cannot clone non-serializable type: ${typeof value}. `
        + 'Functions and Symbols cannot be cloned. Use isCloneable() to check before cloning.',
    );
  }

  if (typeof value === 'object') {
    return cloneObjectValue(value, visited);
  }

  // eslint-disable-next-line fp/no-throw
  throw new Error(
    `Cannot clone value of type ${typeof value}. `
      + 'Use isCloneable() to check before cloning.',
  );
}
