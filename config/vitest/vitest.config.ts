/// <reference types="node" />

/**
 * @file Основная конфигурация Vitest для unit-тестов
 * Конфигурация тестирования для LivAI с поддержкой CI/CD и локальной разработки.
 * Оптимизирована для backend-фокусированных unit-тестов с Node.js окружением.
 * Особенности:
 * - Адаптивные настройки для CI (быстрее) и dev (стабильнее)
 * - Поддержка watch режима и live-reload
 * - Конфигурируемые повторы для flaky-тестов
 */

// @ts-ignore - vitest types should be available from workspace
import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVitestEnv } from './vitest.shared.config.js';

// Определяем корневую директорию проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Функция для динамического поиска модуля в pnpm workspace
function findPnpmModule(moduleName: string): string | null {
  const pnpmDir = path.join(ROOT, 'node_modules/.pnpm');
  try {
    fs.accessSync(pnpmDir, fs.constants.F_OK);
  } catch {
    return null;
  }

  try {
    const entries = fs.readdirSync(pnpmDir);
    const moduleDir = entries.find((entry) =>
      entry.startsWith(`${moduleName}@`) && fs.statSync(path.join(pnpmDir, entry)).isDirectory()
    );

    if (moduleDir) {
      const modulePath = path.join(pnpmDir, moduleDir, 'node_modules', moduleName);
      try {
        fs.accessSync(modulePath, fs.constants.F_OK);
        return modulePath;
      } catch {
        // Module path doesn't exist
      }
    }
  } catch {
    // Игнорируем ошибки, вернем null
  }

  return null;
}

// Алиасы путей для унифицированного импорта в тестах
const aliases: Record<string, string> = {};

// Явное разрешение react-dom и react для гарантированного нахождения модулей в pnpm workspace
const reactDomPath = findPnpmModule('react-dom');
const reactPath = findPnpmModule('react');

if (reactDomPath) {
  aliases['react-dom'] = reactDomPath;
}
if (reactPath) {
  aliases['react'] = reactPath;
}

// ------------------ КОНСТАНТЫ КОНФИГУРАЦИИ -----------------------------

/**
 * Константы конфигурации тестов для разных сред выполнения.
 * Адаптируется под CI и локальную разработку.
 */
const TEST_CONFIG = {
  /** Изоляция тестов: false в CI для скорости, true в dev для надежности */
  ISOLATE_TESTS: process.env['CI'] === 'true' ? false : true,
  /** Параллельность: выше в CI для скорости, ниже в dev для стабильности с БД */
  MAX_CONCURRENCY: process.env['CI'] === 'true' ? 2 : 1,
  /** Режим watch: включен в dev для live-reload, отключен в CI */
  WATCH_MODE: process.env['CI'] !== 'true',
  /** Логирование: более детальное в dev, минимальное в CI */
  VERBOSE_LOGGING: process.env['CI'] !== 'true',
} as const;

// Определение Node версии для fallback esbuild target
const nodeVersion = process.versions.node || '24.0.0';
const nodeMajorVersion = parseInt((nodeVersion as string).split('.')[0] || '24', 10);

// Fallback target: Node24 → Node22 → Node20 (минимум Node 20)
let esbuildTarget: 'node20' | 'node22' | 'node24';
if (nodeMajorVersion >= 24) {
  esbuildTarget = 'node24';
} else if (nodeMajorVersion >= 22) {
  esbuildTarget = 'node22';
} else if (nodeMajorVersion >= 20) {
  esbuildTarget = 'node20';
} else {
  throw new Error(`Node.js ${nodeVersion} не поддерживается. Требуется Node.js 20+`);
}

// Оптимизация: один вызов buildVitestEnv для логирования и конфигурации
const env = buildVitestEnv();

/**
 * Логирует информацию о конфигурации Vitest
 * Переиспользуемая функция для разных типов конфигураций
 */
function logVitestConfiguration(
  configName: string,
  nodeVersion: string,
  esbuildTarget: string,
  testConfig: typeof TEST_CONFIG,
  env: Record<string, string>,
): void {
  // Логируем только в CI или при явном запросе (VITEST_ENV_DEBUG=true)
  if (process.env['CI'] === 'true' || process.env['VITEST_ENV_DEBUG'] === 'true') {
    console.log(`🧪 ${configName} configuration loaded:`);
    console.log(`   - Environment: ${process.env['CI'] === 'true' ? 'CI' : 'Development'}`);
    console.log(`   - Node.js version: ${nodeVersion} (target: ${esbuildTarget})`);
    console.log(`   - Watch mode: ${testConfig.WATCH_MODE ? 'enabled' : 'disabled'}`);
    console.log(`   - Max concurrency: ${testConfig.MAX_CONCURRENCY}`);
    console.log(
      `   - Threading: ${process.env['CI'] === 'true' ? 'multi-threaded (CI)' : 'auto (dev)'}`,
    );
    console.log(`   - Test isolation: ${testConfig.ISOLATE_TESTS ? 'enabled' : 'disabled'}`);
    console.log(`   - allowOnly: ${testConfig.WATCH_MODE ? 'enabled (dev)' : 'disabled (CI)'}`);

    // Логируем загруженные env переменные
    console.log(`   - Environment variables (${Object.keys(env).length} total):`);
    Object.entries(env).forEach(([key, value]) => {
      const displayValue = key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')
        ? '[HIDDEN]'
        : value;
      console.log(`     ${key}: ${displayValue}`);
    });
  }
}

// ------------------ БАЗОВАЯ КОНФИГУРАЦИЯ VITE/VITEST -----------------------------

/**
 * Создает базовую конфигурацию Vitest для unit-тестов
 * @param overrides - Переопределения для специфических нужд
 */
function createBaseVitestConfig(
  overrides: { test?: Record<string, unknown>; } = {},
): ReturnType<typeof defineConfig> {
  return defineConfig({
    test: {
      /** Глобальные переменные Vitest (describe, it, expect) */
      globals: true,

      /** Watch режим: live-reload в dev, run-once в CI */
      watch: TEST_CONFIG.WATCH_MODE,

      /** Таймауты для тестов и хуков */
      testTimeout: 10000,
      hookTimeout: 10000,

      /** Переменные окружения для тестов с валидацией */
      env: { ...(overrides.test?.['env'] || env) },

      /** Репортеры для вывода результатов тестирования */
      reporters: [
        'verbose',
        ['json', { outputFile: './test-results/results.json' }],
      ],

      /** Пул выполнения: threads для Node.js окружения */
      pool: 'threads',

      /**
       * Управление потоками в Vitest 4.x:
       * - singleThread и poolOptions убраны в Vitest 4.x
       * - Управление через переменные окружения:
       *   * VITEST_MAX_THREADS - максимальное количество потоков
       *   * VITEST_MIN_THREADS - минимальное количество потоков
       * - Или через дефолтное поведение (автоматическое определение)
       * - Пример: VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test
       */

      /**
       * Изоляция тестов между запусками.
       * В CI отключена для скорости, в dev включена для надежности.
       */
      isolate: TEST_CONFIG.ISOLATE_TESTS,

      /** Повтор неудачных тестов: больше в CI для flaky-тестов */
      retry: process.env['CI'] === 'true' ? 3 : 1,

      /**
       * Не останавливаться после первого неудачного теста
       * Правильно для unit-тестов: получить полный отчет о всех ошибках
       * Для E2E в CI можно использовать отдельный конфиг с bail: 1
       */
      bail: 0,

      /** Тихий режим отключен для подробного вывода */
      silent: false,

      /** Не считать ошибкой отсутствие тестов */
      passWithNoTests: true,

      /** Разрешить .only тесты: да в dev для отладки, нет в CI для полного прогона */
      allowOnly: process.env['CI'] !== 'true',

      /** Окружение: jsdom для React тестов, node для остальных */
      environment: 'jsdom', // Всегда jsdom для совместимости с React компонентами

      /** По умолчанию тестировать все unit и integration тесты */
      include: [
        'packages/**/*.test.{ts,tsx}',
        'apps/**/*.test.{ts,tsx}',
        'tools/**/*.test.{ts,tsx}',
        'services/**/*.test.{ts,tsx}',
        'config/**/*.test.{ts,tsx}',
        // Корневые тесты (не в workspace)
        '*.test.{ts,tsx}',
        '**/*.test.{ts,tsx}',
      ],

      /** Исключить все остальное */
      exclude: [
        // Core exclusions - these should never be tested
        '**/node_modules/**',
        '**/.pnpm-store/**',
        '**/.pnpm/**',

        // build artifacts
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.output/**',
        '**/.turbo/**',
        '**/.cache/**',

        // coverage & reports
        '**/coverage/**',

        // e2e
        '**/e2e/**',
        '**/playwright*/**',

        // disabled tests
        '**/tests-disabled/**',
      ],

      /** Максимальная параллельность выполнения */
      maxConcurrency: TEST_CONFIG.MAX_CONCURRENCY,

      /** Future-proof опции для расширяемости */
      /**
       * Экспериментальная опция: отключить intercept консоли для лучшей производительности в CI
       * @experimental Не документирована в Vitest 4.x официально
       */
      disableConsoleIntercept: process.env['CI'] === 'true',

      /**
       * Экспериментальная опция: порог для медленных тестов (логирование предупреждений)
       * @experimental Не документирована в Vitest 4.x официально
       */
      slowTestThreshold: process.env['CI'] === 'true' ? 1000 : 300,

      /** Настройка покрытия кода */
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },

      /** Глобальная настройка для всех тестов */
      setupFiles: ['config/vitest/test.setup.ts'],
      globalSetup: [],
    },

    /** Разрешение импортов с унифицированными алиасами */
    resolve: {
      preserveSymlinks: true,
      alias: aliases, // Пустой объект - алиасы можно добавить позже при необходимости
      // Поддержка условий экспорта из package.json (для React jsx-runtime)
      conditions: ['import', 'module', 'browser', 'default'],
    },

    // Настройки сервера для работы с pnpm workspace
    server: {
      fs: {
        // Разрешить доступ к файлам из корня проекта и всех workspace пакетов
        allow: ['..'],
      },
    },

    // Настройки для правильного разрешения зависимостей из скомпилированных пакетов
    ssr: {
      // Включаем все зависимости в обработку Vite (нужно для работы с dist файлами)
      noExternal: ['react', 'react-dom'],
    },

    // Оптимизация зависимостей для правильного разрешения React/React-DOM из dist файлов
    optimizeDeps: {
      // Включаем React и React-DOM для предварительной обработки
      include: ['react', 'react-dom'],
      // Исключаем пакеты монорепозитория из оптимизации (они должны обрабатываться напрямую)
      exclude: [],
      // Принудительно пересобирать зависимости при изменении (для надежности)
      force: false,
      // Эсмеральда (esbuild) опции для правильной обработки
      esbuildOptions: {
        // Поддержка JSX для правильной обработки React
        jsx: 'automatic',
      },
    },

    // ------------------ ГЛОБАЛЬНЫЕ ОПРЕДЕЛЕНИЯ -----------------------------

    /** Определение глобальных констант для тестов */
    define: {
      'import.meta.vitest': 'undefined',
    },

    // ------------------ ESBUILD НАСТРОЙКИ -----------------------------

    /** esbuild target: автоопределение Node 24→22→20 (минимум Node 20) */
    esbuild: {
      target: esbuildTarget,
    },

    // Применяем переопределения через mergeConfig
    ...overrides,
  });
}

// Логируем конфигурацию при запуске
logVitestConfiguration('Vitest', nodeVersion, esbuildTarget, TEST_CONFIG, env);

// ------------------ ОСНОВНАЯ КОНФИГУРАЦИЯ VITE/VITEST -----------------------------

// Экспортируем базовую конфигурацию с явной передачей env для детерминированности
export default createBaseVitestConfig({ test: { env } });

// Экспортируем функцию для создания кастомных конфигураций
export { createBaseVitestConfig };
