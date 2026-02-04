/**
 * Конфигурация Vitest для benchmark тестов @livai/core-contracts
 *
 * Отдельный конфиг для bench, без тяжелого setup для обычных тестов
 * Не использует DOM окружение, jest-dom, глобальные хуки
 *
 * ВАЖНО: benchmark - корневая секция, НЕ внутри test!
 * Vitest парсит benchmark и test на разных этапах
 *
 * bench использует отдельный vitest config
 * test.setup НЕ подключается
 * globals disabled
 */

/**
 * Конфигурация Vitest для benchmark тестов @livai/core-contracts
 *
 * Отдельный конфиг для bench, без тяжелого setup для обычных тестов
 * Не использует DOM окружение, jest-dom, глобальные хуки
 *
 * ВАЖНО: benchmark - корневая секция, НЕ внутри test!
 * Vitest парсит benchmark и test на разных этапах
 *
 * bench использует отдельный vitest config
 * test.setup НЕ подключается
 * globals disabled
 */

// eslint-disable-next-line import/no-default-export
export default {
  benchmark: {
    // Репортеры для benchmark результатов
    reporters: ['default'],
  },

  test: {
    // Bench использует явные импорты (describe, bench из 'vitest')
    globals: false,

    // Node окружение для производительности (без jsdom)
    environment: 'node',

    // Pool forks для microbench (threads искажают метрики)
    pool: 'forks',

    // Таймауты для bench
    testTimeout: 60_000,
    hookTimeout: 30_000,

    // Покрытие отключено
    coverage: {
      enabled: false,
    },

    // Паттерны поиска bench файлов
    include: [
      '**/*.bench.{ts,tsx,js,jsx}',
    ],

    // Исключения
    exclude: [
      'dist/**',
      'node_modules/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
    ],

    // Не считать ошибкой отсутствие bench файлов
    passWithNoTests: true,

    silent: false,
  },
};
