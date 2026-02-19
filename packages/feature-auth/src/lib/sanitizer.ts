/**
 * @file packages/feature-auth/src/lib/sanitizer.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Sanitizer (Security Boundary)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Security boundary для externalSignals (anti-corruption layer)
 * - Защита от prototype pollution, functions, symbols
 * - Sanitization перед попаданием в domain layer
 * - Используется для всех операций pipeline (login, register, mfa, etc.)
 *
 * Принципы:
 * - ✅ Security-first — защита от всех известных attack vectors
 * - ✅ Fail-closed — при ошибке возвращает undefined (блокирует небезопасные данные)
 * - ✅ Performance-aware — оптимизирован для hot-path (каждый login)
 * - ✅ Depth/size limits — защита от DoS через глубокие/большие объекты
 *
 * @note Это критическая security boundary. Любые изменения должны быть тщательно протестированы.
 * @note Performance: O(n) по размеру объекта. Для больших объектов рекомендуется lazy validation.
 * @note Security: защищает от prototype pollution, function injection, symbol poisoning.
 */

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Максимальная глубина вложенности объектов (защита от DoS) */
const MAX_DEPTH = 10;

/** Максимальное количество ключей в объекте (защита от DoS) */
const MAX_KEYS = 1000;

/** Максимальный размер объекта в байтах (приблизительно, защита от DoS) */
const MAX_SIZE_BYTES = 100_000; // 100KB

/** Размер number в байтах (IEEE 754 double precision) */
const NUMBER_SIZE_BYTES = 8;

/** Запрещенные ключи (prototype pollution protection) */
const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

/* ============================================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Безопасно получает значение из объекта по ключу (защита от object injection)
 *
 * @param obj - Объект для доступа
 * @param key - Ключ для доступа
 * @returns Значение или undefined
 */
function safeGetValue(obj: Record<string, unknown>, key: string): unknown {
  // Используем Object.prototype.hasOwnProperty для безопасного доступа
  // eslint-disable-next-line security/detect-object-injection -- key проверен через FORBIDDEN_KEYS
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Безопасно клонирует объект, удаляя prototype pollution и опасные свойства
 *
 * @param value - Значение для клонирования
 * @param depth - Текущая глубина вложенности
 * @param visited - Set для отслеживания циклических ссылок
 * @returns Безопасный клон или undefined если небезопасно
 */
function safeClone(
  value: unknown,
  depth: number = 0,
  visited: WeakSet<object> = new WeakSet(),
): unknown {
  if (depth > MAX_DEPTH) {
    return undefined;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.reduce<unknown[]>((acc, item) => {
      const cloned = safeClone(item, depth + 1, visited);
      return cloned !== undefined ? [...acc, cloned] : acc;
    }, []);
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (visited.has(value) || keys.length > MAX_KEYS) {
      return undefined;
    }
    visited.add(value);

    return keys.reduce<Record<string, unknown>>((acc, key) => {
      if (FORBIDDEN_KEYS.has(key)) {
        return acc;
      }

      // Безопасное получение значения (защита от object injection)
      const itemValue = safeGetValue(value as Record<string, unknown>, key);
      if (itemValue === undefined) {
        return acc;
      }

      const cloned = safeClone(itemValue, depth + 1, visited);
      return cloned !== undefined ? { ...acc, [key]: cloned } : acc;
    }, {});
  }

  return undefined;
}

/**
 * Приблизительно оценивает размер объекта в байтах
 *
 * @param value - Значение для оценки
 * @returns Приблизительный размер в байтах
 */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'boolean') {
    return 1;
  }

  if (typeof value === 'number') {
    return NUMBER_SIZE_BYTES;
  }

  if (typeof value === 'string') {
    return value.length * 2; // UTF-16
  }

  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + estimateSize(item), 0);
  }

  if (typeof value === 'object') {
    return Object.keys(value).reduce<number>((size, key) => {
      const itemValue = safeGetValue(value as Record<string, unknown>, key);
      return size + key.length * 2 + estimateSize(itemValue);
    }, 0);
  }

  return 0;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Sanitizes external signals (security boundary)
 *
 * Защищает от:
 * - Prototype pollution (__proto__, constructor, prototype)
 * - Function injection
 * - Symbol poisoning
 * - Циклических ссылок
 * - DoS через глубокие/большие объекты
 *
 * @param raw - Сырые данные от внешнего источника
 * @returns Безопасный объект или undefined если небезопасно
 *
 * @note Это критическая security boundary. Все данные от внешних источников должны проходить через эту функцию.
 * @note Performance: O(n) по размеру объекта. Для больших объектов рекомендуется lazy validation в pipeline.
 * @note Security: signals должны быть PII-free перед логированием (IP, email, deviceId должны быть очищены или замаскированы).
 */
export function sanitizeExternalSignals(
  raw: unknown,
): Readonly<Record<string, unknown>> | undefined {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return undefined;
  }

  const size = estimateSize(raw);
  if (size > MAX_SIZE_BYTES) {
    return undefined;
  }

  const sanitized = safeClone(raw);

  if (sanitized === undefined || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return undefined;
  }

  return sanitized as Readonly<Record<string, unknown>>;
}
