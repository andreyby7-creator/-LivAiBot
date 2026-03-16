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
// Dev-резолвер: @livai/* → packages/*/src (для правильного резолва в тестах)
const aliases: Record<string, string> = {
  '@livai/core': path.resolve(ROOT, 'packages/core/src'),
  '@livai/core-contracts': path.resolve(ROOT, 'packages/core-contracts/src'),
  '@livai/domains': path.resolve(ROOT, 'packages/domains/src'),
  '@livai/feature-auth': path.resolve(ROOT, 'packages/feature-auth/src'),
  '@livai/feature-bots': path.resolve(ROOT, 'packages/feature-bots/src'),
  '@livai/feature-chat': path.resolve(ROOT, 'packages/feature-chat/src'),
  '@livai/feature-voice': path.resolve(ROOT, 'packages/feature-voice/src'),
  '@livai/ui-core': path.resolve(ROOT, 'packages/ui-core/src'),
  '@livai/ui-features': path.resolve(ROOT, 'packages/ui-features/src'),
  '@livai/ui-shared': path.resolve(ROOT, 'packages/ui-shared/src'),
  '@livai/app': path.resolve(ROOT, 'packages/app/src'),
};

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
  /** Количество потоков: в CI ограничиваем для предсказуемой нагрузки, в dev авто */
  MAX_THREADS: process.env['CI'] === 'true' ? 2 : undefined,
  /** Режим watch: включен в dev для live-reload, отключен в CI */
  WATCH_MODE: process.env['CI'] !== 'true',
  /** Логирование: более детальное в dev, минимальное в CI */
  VERBOSE_LOGGING: process.env['CI'] !== 'true',
} as const;

// Node version (для логирования/валидации окружения)
const nodeVersion = process.versions.node || '24.0.0';
const nodeMajorVersion = parseInt((nodeVersion as string).split('.')[0] || '24', 10);
if (nodeMajorVersion < 20) {
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
    console.log(`   - Max threads: ${testConfig.MAX_THREADS ?? 'auto'}`);
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
    // Важно: когда vitest запускается с явным --config, текущий root может стать директорией конфига.
    // Мы фиксируем root на корень репозитория, чтобы include/exclude/coverage были детерминированными.
    root: ROOT,
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
      /** Управление количеством worker-потоков: базово через конфиг, override через env (CI) */
      maxThreads: TEST_CONFIG.MAX_THREADS,

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

      /**
       * Генерация покрытия кода.
       * Все пороги, политики и фильтрация по файлам реализованы в scripts/test-unit.mjs
       * на основе coverage/coverage-final.json (единый источник истины).
       */
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        // Всегда писать coverage в корень репозитория, чтобы runner мог детерминированно
        // найти coverage/coverage-final.json независимо от workspace/package cwd.
        reportsDirectory: path.resolve(ROOT, 'coverage'),
      },

      /** Глобальная настройка для всех тестов */
      setupFiles: ['config/vitest/test.setup.ts'],
      globalSetup: [],
    },

    /** Разрешение импортов с унифицированными алиасами */
    resolve: {
      preserveSymlinks: true,
      alias: aliases, // Пустой объект - алиасы можно добавить позже при необходимости
      // Поддержка условий экспорта из package.json (для правильного резолва @livai/*)
      conditions: ['import', 'module', 'default'],
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
    },

    // ------------------ ГЛОБАЛЬНЫЕ ОПРЕДЕЛЕНИЯ -----------------------------

    /** Определение глобальных констант для тестов */
    define: {
      'import.meta.vitest': 'undefined',
    },

    // Применяем переопределения через mergeConfig
    ...overrides,
  });
}

// Логируем конфигурацию при запуске
// NOTE: мы намеренно не задаем `esbuild` опции в Vite-конфиге, чтобы не смешивать esbuild и oxc.
logVitestConfiguration('Vitest', nodeVersion, 'oxc', TEST_CONFIG, env);

// ------------------ ОСНОВНАЯ КОНФИГУРАЦИЯ VITE/VITEST -----------------------------

// Экспортируем базовую конфигурацию с явной передачей env для детерминированности
export default createBaseVitestConfig({ test: { env } });

// Экспортируем функцию для создания кастомных конфигураций
export { createBaseVitestConfig };
