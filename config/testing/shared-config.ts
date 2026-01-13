/**
 * @file Общие настройки для всех инструментов тестирования LivAi
 *
 * Этот файл содержит централизованную конфигурацию для всех тестовых фреймворков:
 * - Vitest (JavaScript/TypeScript unit и integration тесты)
 * - Playwright (E2E тесты)
 * - Pytest (Python тесты)
 *
 * Включает пути, переменные окружения, таймауты, настройки покрытия и константы.
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
// Используем process.cwd() для совместимости с strict TypeScript
// Файл находится в config/testing/, поэтому config/ - это родительская директория

// Вспомогательная функция для проверки существования исполняемого файла (синхронная)
function resolveExecutable(name: string, candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  // Fallback через npx для node_modules пакетов
  if (['vitest', 'playwright'].includes(name)) {
    return `npx ${name}`;
  }
  // Для pytest возвращаем команду как есть
  return name;
}

// Вспомогательная функция для подсчета пакетов в monorepo
function countMonorepoPackages(): number {
  let count = 0;

  try {
    // Считаем packages
    const packagesDir = path.resolve(process.cwd(), 'packages');
    if (fs.existsSync(packagesDir)) {
      count += fs.readdirSync(packagesDir).filter((dir) =>
        fs.statSync(path.join(packagesDir, dir)).isDirectory()
      ).length;
    }

    // Считаем apps с package.json
    const appsDir = path.resolve(process.cwd(), 'apps');
    if (fs.existsSync(appsDir)) {
      count += fs.readdirSync(appsDir).filter((dir) =>
        fs.statSync(path.join(appsDir, dir)).isDirectory()
        && fs.existsSync(path.join(appsDir, dir, 'package.json'))
      ).length;
    }
  } catch {
    // В случае ошибки возвращаем 0
    return 0;
  }

  return count;
}

// Вычисляем CI флаг заранее для использования в определениях
const isCIFlag = process.env.CI === 'true' || process.env.CI === '1';

// Настройки окружения (должен быть определен раньше всех остальных)
export const env = {
  // Глобальные флаги
  isCI: isCIFlag,
  isDebug: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  isVerbose: process.env.VERBOSE === 'true' || process.env.VERBOSE === '1',
  isWatch: process.env.WATCH === 'true' || process.env.WATCH === '1',

  // Окружения
  nodeEnv: process.env.NODE_ENV,
  testEnv: process.env.TEST_ENV ?? 'local',

  // Переменные окружения для разных фреймворков
  vitest: {
    globals: process.env.VITEST_GLOBALS === 'true',
    coverage: process.env.VITEST_COVERAGE === 'true'
      || (process.env.VITEST_COVERAGE !== 'false' && isCIFlag), // по умолчанию true только в CI
    pool: process.env.VITEST_POOL ?? 'threads',
    isolate: process.env.VITEST_ISOLATE !== 'false',
  },

  playwright: {
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    browser: process.env.PLAYWRIGHT_BROWSER ?? 'chromium',
    workers: parseInt(process.env.PLAYWRIGHT_WORKERS ?? (isCIFlag ? '2' : '1')),
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    coverage: process.env.PLAYWRIGHT_COVERAGE === 'true'
      || (process.env.PLAYWRIGHT_COVERAGE !== 'false' && isCIFlag), // по умолчанию true только в CI
  },

  pytest: {
    workers: parseInt(process.env.PYTEST_WORKERS ?? (isCIFlag ? '4' : '1')),
    coverage: process.env.PYTEST_COVERAGE !== 'false' && process.env.PYTEST_COVERAGE !== undefined,
    verbose: process.env.PYTEST_VERBOSE === 'true',
  },

  // Таймауты
  timeouts: {
    global: parseInt(process.env.TEST_TIMEOUT_GLOBAL ?? '300000'), // 5 минут
    vitest: parseInt(process.env.TEST_TIMEOUT_VITEST ?? '30000'), // 30 секунд
    playwright: parseInt(process.env.TEST_TIMEOUT_PLAYWRIGHT ?? '120000'), // 2 минуты
    pytest: parseInt(process.env.TEST_TIMEOUT_PYTEST ?? '60000'), // 1 минута
  },
};

// Пути к директориям
export const paths = {
  root: process.cwd(),
  apps: path.resolve(process.cwd(), 'apps'),
  services: path.resolve(process.cwd(), 'services'),
  packages: path.resolve(process.cwd(), 'packages'),
  reports: path.resolve(process.cwd(), 'reports'),

  // Конфигурации фреймворков
  config: {
    vitest: path.resolve(process.cwd(), 'config/vitest'),
    playwright: path.resolve(process.cwd(), 'config/playwright'),
    pytest: path.resolve(process.cwd(), 'config/pytest'),
  },

  // Исполняемые файлы с проверкой существования
  bin: {
    vitest: resolveExecutable('vitest', [
      path.resolve(process.cwd(), 'node_modules/.bin/vitest'),
      path.resolve(process.cwd(), 'node_modules/.bin/vitest.cmd'), // Windows
    ]),
    playwright: resolveExecutable('playwright', [
      path.resolve(process.cwd(), 'node_modules/.bin/playwright'),
      path.resolve(process.cwd(), 'node_modules/.bin/playwright.cmd'), // Windows
    ]),
    pytest: resolveExecutable('pytest', [
      path.resolve(process.cwd(), 'venv/bin/pytest'), // Linux/Mac
      path.resolve(process.cwd(), 'venv/Scripts/pytest.exe'), // Windows
      path.resolve(process.cwd(), 'venv/Scripts/pytest'), // Windows (без расширения)
      path.resolve(process.cwd(), '.venv/bin/pytest'), // Альтернативный путь
      path.resolve(process.cwd(), '.venv/Scripts/pytest.exe'), // Windows альтернативный
      'pytest', // Fallback через PATH
    ]),
  },

  // Отчеты о покрытии
  coverage: {
    root: path.resolve(process.cwd(), 'reports/coverage'),
    js: path.resolve(process.cwd(), 'reports/coverage/js'),
    python: path.resolve(process.cwd(), 'reports/coverage/python'),
    playwright: path.resolve(process.cwd(), 'reports/coverage/playwright'),
    merged: path.resolve(process.cwd(), 'reports/coverage/merged'),
    html: path.resolve(process.cwd(), 'reports/coverage/html'),
  },

  // Результаты тестов
  testResults: {
    vitest: path.resolve(process.cwd(), 'test-results/vitest'),
    playwright: path.resolve(process.cwd(), 'test-results/playwright'),
    pytest: path.resolve(process.cwd(), 'test-results/pytest'),
  },
};

// Таймауты для разных типов тестов (привязаны к env.timeouts)
export const timeouts = {
  // Unit тесты используют vitest таймаут
  unit: env.timeouts.vitest,

  // Integration тесты могут быть гибридными (unit + e2e логика)
  integration: env.timeouts.vitest,

  // E2E тесты используют playwright таймаут
  e2e: env.timeouts.playwright,

  // Health checks - короткий таймаут
  health: 10000,

  // Playwright специфические таймауты для use конфигурации
  playwright: {
    actionTimeout: env.timeouts.vitest, // 30 сек (по умолчанию)
    navigationTimeout: env.timeouts.playwright, // 120 сек (по умолчанию)
    expectTimeout: env.timeouts.playwright, // Для expect операций
  },
};

// Централизованные паттерны исключений для покрытия
const coverageExcludePatterns = {
  // Базовые исключения (общие для всех фреймворков)
  base: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.config.*',
    '**/*.setup.*',
    '**/mocks/**',
    '**/fixtures/**',
  ],

  // Специфические дополнения для каждого фреймворка
  vitest: [
    '**/config/**',
    '**/scripts/**',
  ],

  playwright: [
    '**/test/**',
    '**/tests/**',
    '**/*.test.*',
    '**/*.spec.*',
  ],
};

// Стандартные форматы отчетов о покрытии
const coverageFormats = ['json', 'lcov', 'html'];

// Общие пороги покрытия
const coverageThresholds = {
  branches: parseInt(process.env.COVERAGE_BRANCHES ?? '80', 10),
  functions: parseInt(process.env.COVERAGE_FUNCTIONS ?? '80', 10),
  lines: parseInt(process.env.COVERAGE_LINES ?? '80', 10),
  statements: parseInt(process.env.COVERAGE_STATEMENTS ?? '80', 10),
};

// Маркеры для фильтрации тестов
// skip: поддерживается всеми фреймворками нативно
// ai, slow, flaky: кастомные маркеры для группировки и фильтрации
//
// Использование маркеров в коде:
// Vitest: describe('group', { tag: ['slow'] }, () => {...})
// Playwright: test('name', { tag: ['slow'] }, async () => {...})
// Pytest: @pytest.mark.slow; def test_name(): pass
//
// Фильтрация по маркерам (используйте frameworkConfigs.*.markerFilter):
// Vitest: --testNamePattern='tag:slow'
// Playwright: --grep 'tag:slow'
// Pytest: -m slow
//
// Для фильтрации по маркерам используйте:
// - Vitest: --grep "tag:slow"
// - Playwright: --grep "tag:slow"
// - Pytest: -m slow
export const markers = {
  // Стандартные маркеры (работают во всех фреймворках)
  skip: ['skip'],

  // Кастомные маркеры для группировки и фильтрации
  unit: ['unit'],
  integration: ['integration'],
  e2e: ['e2e'],
  ai: ['ai'],
  slow: ['slow'],
  flaky: ['flaky'],
};

/** Helper функции для работы с маркерами */
export const markerHelpers = {
  // Получить все маркеры кроме skip
  getCustomMarkers: (): string[] => Object.keys(markers).filter((key) => key !== 'skip'),

  // Проверить, содержит ли тест указанный маркер
  hasMarker: (testName: string, marker: string): boolean =>
    testName.includes(`tag:${marker}`) || testName.includes(`@${marker}`),

  // Получить паттерн для фильтрации по маркеру
  getFilterPattern: (marker: string): { vitest: string; playwright: string; pytest: string; } => ({
    vitest: `tag:${marker}`,
    playwright: `tag:${marker}`,
    pytest: `-m ${marker}`,
  }),
};
// Специфические настройки для каждого фреймворка
export const frameworkConfigs = {
  vitest: {
    config: path.resolve(paths.config.vitest, 'vitest.config.ts'),
    aiConfig: path.resolve(paths.config.vitest, 'vitest.ai.config.ts'),
    packagesConfig: path.resolve(paths.config.vitest, 'vitest.packages.config.ts'),
    sharedConfig: path.resolve(paths.config.vitest, 'vitest.shared.config.ts'),
    setupFiles: [
      path.resolve(paths.config.vitest, 'package.setup.ts'),
      path.resolve(paths.config.vitest, 'test.setup.ts'),
    ],
    testMatch: [
      '**/*.{test,spec}.{ts,tsx,js,jsx}',
      '**/tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.config.*',
      '**/*.setup.*',
    ],
    // Настройки для фильтрации по маркерам
    markerFilter: {
      // Vitest поддерживает теги через testNamePattern или другие опции
      pattern: (marker: string): string => `tag:${marker}`,
      example: "vitest --testNamePattern='tag:slow'",
    },
  },

  playwright: {
    config: path.resolve(paths.config.playwright, 'playwright.config.ts'),
    setupFile: path.resolve(paths.config.playwright, 'global-setup.ts'),
    teardownFile: path.resolve(paths.config.playwright, 'global-teardown.ts'),
    testMatch: [
      '**/e2e/**/*.{test,spec}.{ts,tsx,js,jsx}',
      '**/tests/e2e/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    outputDir: path.resolve(process.cwd(), 'test-results/playwright'),
    screenshotDir: path.resolve(process.cwd(), 'test-results/screenshots'),
    // Настройки для фильтрации по маркерам
    markerFilter: {
      // Playwright поддерживает фильтрацию через grep
      grep: (marker: string): string => `tag:${marker}`,
      example: "playwright test --grep 'tag:slow'",
    },
  },

  pytest: {
    config: path.resolve(paths.config.pytest, 'pytest.ini'),
    conftest: path.resolve(paths.config.pytest, 'conftest.py'),
    testMatch: [
      '**/test_*.py',
      '**/tests/**/*.py',
      '**/tests/*_test.py',
    ],
    pythonPath: process.env.PYTHON_PATH ?? 'python',
    cacheDir: path.resolve(process.cwd(), '.pytest_cache'),
    // Функция для очистки pytest cache перед тестами
    cleanupCache: async (): Promise<{ success: boolean; path: string; }> => {
      const cacheDir = path.resolve(process.cwd(), '.pytest_cache');
      try {
        await fsPromises.access(cacheDir);
        await fsPromises.rm(cacheDir, { recursive: true, force: true });
        return { success: true, path: cacheDir };
      } catch {
        return { success: false, path: cacheDir };
      }
    },
    // Настройки для фильтрации по маркерам
    markerFilter: {
      // Pytest поддерживает фильтрацию через -m
      args: (marker: string): string[] => ['-m', marker],
      example: 'pytest -m slow',
    },
  },
};

// Глобальные константы для тестирования
// ВНИМАНИЕ: Это единственный источник правды для портов, браузеров и concurrency уровней.
// Все остальные части проекта должны импортировать эти константы отсюда.
export const constants = {
  // Порты для разных сервисов (единственный источник правды)
  ports: {
    app: parseInt(process.env.PORT ?? '3000', 10),
    api: parseInt(process.env.API_PORT ?? '4000', 10),
    db: parseInt(process.env.DB_PORT ?? '5432', 10),
    redis: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  // Названия браузеров для Playwright (единственный источник правды)
  browsers: {
    chromium: 'chromium',
    firefox: 'firefox',
    webkit: 'webkit',
  },

  // Уровни параллелизации (единственный источник правды)
  concurrency: {
    low: 1,
    medium: 2,
    high: 4,
    max: 8,
  },

  // Размеры отчетов
  reportLimits: {
    maxTestResults: parseInt(process.env.MAX_TEST_RESULTS ?? '1000', 10),
    // Динамический расчет на основе количества пакетов в monorepo
    get maxCoverageFiles(): number {
      const baseLimit = parseInt(process.env.MAX_COVERAGE_FILES ?? '500', 10);
      const packageCount = countMonorepoPackages();
      return Math.max(baseLimit, packageCount * 75);
    },
  },
};

/** Типы тестов для обеспечения консистентности по проекту */
export type TestType = 'unit' | 'integration' | 'e2e';

// Типы тестов для динамической конфигурации
export const testTypes = {
  unit: 'unit',
  integration: 'integration',
  e2e: 'e2e',
} as const satisfies Record<TestType, TestType>;

// Экспорт централизованных паттернов исключений для покрытия
export const coverageExcludes = {
  // Базовые исключения
  base: coverageExcludePatterns.base,

  // Специфические для фреймворков
  vitest: coverageExcludePatterns.vitest,
  playwright: coverageExcludePatterns.playwright,

  // Готовые комбинации (base + специфические)
  get vitestCombined(): string[] {
    return [...this.base, ...this.vitest];
  },
  get playwrightCombined(): string[] {
    return [...this.base, ...this.playwright];
  },

  // Объединение всех исключений
  get all(): string[] {
    return [
      ...this.base,
      ...this.vitest,
      ...this.playwright,
    ];
  },
};

/** Фабричная функция для создания coverage конфигураций */
function createCoverageConfig(exclude: string[], enabled: boolean = true): {
  enabled: boolean;
  provider: 'v8';
  reporter: readonly (string | 'text')[];
  exclude: string[];
  thresholds: typeof coverageThresholds;
} {
  return {
    enabled,
    provider: 'v8' as const,
    reporter: ['text' as const, ...coverageFormats] as const,
    exclude,
    thresholds: coverageThresholds,
  };
}

/** Централизованные конфигурации coverage для каждого фреймворка */
export const coverage = {
  /** Базовая конфигурация coverage (общая для всех фреймворков) */
  base: createCoverageConfig(coverageExcludes.base),

  /** Конфигурация coverage для Vitest */
  vitest: createCoverageConfig(coverageExcludes.vitest, env.vitest.coverage),

  /** Конфигурация coverage для Playwright */
  playwright: createCoverageConfig(coverageExcludes.playwright, env.playwright.coverage),
};

// Примеры дополнительных исключений для специфических случаев
export const coverageExcludeExamples = {
  // Для проектов с большим количеством generated файлов
  generated: [
    '**/generated/**',
    '**/auto-generated/**',
    '**/build/**',
  ],

  // Для проектов с third-party кодом
  thirdParty: [
    '**/vendor/**',
    '**/third-party/**',
    '**/external/**',
  ],

  // Для проектов с большим количеством тестовых утилит
  testUtils: [
    '**/test-utils/**',
    '**/testing-helpers/**',
    '**/__tests__/utils/**',
  ],

  // Для специфических директорий проекта
  custom: (patterns: string[]): string[] => patterns, // Функция для динамического создания
};

/** Функция для получения базовой конфигурации с динамическим таймаутом и retries */
export function getBaseConfig(testType: TestType = testTypes.unit): {
  verbose: boolean;
  debug: boolean;
  bail: number;
  timeout: number;
  retries: number;
  watch: boolean;
  testType: TestType;
} {
  // Динамический расчет таймаута в зависимости от типа тестов
  const timeout = testType === testTypes.unit
    ? timeouts.unit
    : testType === testTypes.integration
    ? timeouts.integration
    : timeouts.e2e;

  // Динамический расчет retries в зависимости от типа тестов и CI
  // E2E тесты более нестабильны, поэтому больше retries (по умолчанию 3)
  // Можно переопределить через E2E_RETRIES=<число>
  const e2eRetries = parseInt(process.env.E2E_RETRIES ?? '3', 10);
  const baseRetries = testType === testTypes.e2e ? e2eRetries : 2;
  const retries = env.isCI ? baseRetries : 0;

  return {
    verbose: env.isVerbose || !env.isCI,
    debug: env.isDebug,
    bail: env.isCI ? 1 : 0,
    timeout,
    retries,
    watch: env.isWatch,
    // Добавляем тип теста для отладки
    testType,
  };
}
