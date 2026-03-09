/**
 * @file packages/core/src/hash.ts
 * ============================================================================
 * 🔢 CORE — Hash Utilities (MurmurHash3)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Детерминированное хэширование для feature flags и pipeline rollout
 * - Унифицированный алгоритм хэширования между модулями
 * - Причина изменения: унификация хэширования между feature-flags и pipeline
 *
 * Принципы:
 * - ✅ Deterministic: одинаковый вход → одинаковый выход
 * - ✅ Domain-pure: без side-effects, платформо-агностично
 * - ✅ Microservice-ready: stateless, без скрытого coupling
 */

/* ============================================================================
 * 🔢 МУРМУРХЭШ КОНСТАНТЫ
 * ========================================================================== */

/**
 * Стандартные константы MurmurHash3 для детерминированного хэширования.
 * Не изменять - это проверенная non-cryptographic hash реализация.
 * ⚠️ Not cryptographically secure - используйте только для детерминированного распределения.
 */
const MURMURHASH_C1 = 0xcc9e2d51; // Первая константа смешивания
const MURMURHASH_C2 = 0x1b873593; // Вторая константа смешивания
const MURMURHASH_R1 = 15; // Первый угол поворота
const MURMURHASH_R2 = 13; // Второй угол поворота
const MURMURHASH_M = 5; // Константа умножения
const MURMURHASH_N = 0xe6546b64; // Константа сложения
const MURMURHASH_FINALIZE_MIX_1 = 0x85ebca6b; // Финализация 1
const MURMURHASH_FINALIZE_MIX_2 = 0xc2b2ae35; // Финализация 2
const MURMURHASH_BLOCK_SIZE = 4; // Размер блока обработки в байтах
const MURMURHASH_BYTE_BITS = 8; // Бит в байте
const MURMURHASH_WORD_BITS = 32; // Бит в 32-bit слове
const MURMURHASH_FINALIZE_SHIFT_1 = 16; // Первый сдвиг финализации
const MURMURHASH_FINALIZE_SHIFT_2 = 13; // Второй сдвиг финализации
const MURMURHASH_FINALIZE_SHIFT_3 = 16; // Третий сдвиг финализации

/* ============================================================================
 * 🎯 PUBLIC API
 * ========================================================================== */

/**
 * Реализация MurmurHash3 32-bit для детерминированного распределения.
 * Обеспечивает лучшую устойчивость к коллизиям по сравнению с простым хэшированием строк.
 * Используется для процентных rollout'ов фич и pipeline версий.
 * ⚠️ **Not cryptographically secure** - это non-cryptographic hash функция.
 * Используйте только для детерминированного распределения, не для безопасности.
 * @param input - Входная строка для хэширования
 * @returns 32-bit беззнаковое целое число (0..2^32-1)
 * @public
 */
/* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation */
// Обоснование: Hash алгоритмы (MurmurHash3, FNV, xxhash) по своей природе требуют мутаций, циклов и let.
// Использование функционального стиля сделает алгоритм медленным, нечитабельным и ненадёжным.
// Это стандартная реализация MurmurHash3, которая должна быть максимально эффективной.
export function stableHash(input: string): number {
  let hash = 0;

  // Обрабатываем по 4 байта за раз
  for (let i = 0; i < input.length; i += MURMURHASH_BLOCK_SIZE) {
    let k = 0;
    for (let j = 0; j < MURMURHASH_BLOCK_SIZE && i + j < input.length; j++) {
      k |= input.charCodeAt(i + j) << (j * MURMURHASH_BYTE_BITS);
    }

    k = Math.imul(k, MURMURHASH_C1);
    k = (k << MURMURHASH_R1) | (k >>> (MURMURHASH_WORD_BITS - MURMURHASH_R1));
    k = Math.imul(k, MURMURHASH_C2);

    hash ^= k;
    hash = (hash << MURMURHASH_R2) | (hash >>> (MURMURHASH_WORD_BITS - MURMURHASH_R2));
    hash = Math.imul(hash, MURMURHASH_M) + MURMURHASH_N;
  }

  // Финальное смешивание (стандартная финализация MurmurHash3)
  hash ^= input.length;
  hash ^= hash >>> MURMURHASH_FINALIZE_SHIFT_1;
  hash = Math.imul(hash, MURMURHASH_FINALIZE_MIX_1);
  hash ^= hash >>> MURMURHASH_FINALIZE_SHIFT_2;
  /* istanbul ignore next */
  hash = Math.imul(hash, MURMURHASH_FINALIZE_MIX_2);
  /* istanbul ignore next */
  hash ^= hash >>> MURMURHASH_FINALIZE_SHIFT_3;

  return hash >>> 0; // Гарантируем беззнаковый 32-bit
}
/* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */
