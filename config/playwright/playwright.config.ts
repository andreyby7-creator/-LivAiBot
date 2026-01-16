/**
 * @file Конфигурация Playwright для E2E тестирования LivAi
 *
 * Полная конфигурация Playwright для end-to-end тестирования системы LivAi.
 * Оптимизирована для AI зависимых сценариев с адаптивными таймаутами и стабильностью.
 *
 * Охватывает пользовательские сценарии:
 * - Регистрация и создание рабочего пространства
 * - Создание и настройка AI ботов
 * - Интеграция с каналами (CRM, мессенджеры)
 * - Управление базой знаний
 *
 * Особенности:
 * - Адаптивные таймауты для CI и локальной разработки
 * - Контроль параллельности через переменные окружения
 * - Специальные настройки для AI операций
 * - Полная интеграция с системой отчетности
 */

import { devices } from 'playwright';

// Определение окружения выполнения
const isCI = !!process.env['CI'];

/**
 * ДОКУМЕНТАЦИЯ ПО ПЕРЕМЕННЫМ ОКРУЖЕНИЯ
 *
 * E2E_FULLY_PARALLEL=true/false/undefined  - параллельность (auto: локально да, CI нет)
 * E2E_WORKERS=N                            - воркеры (undefined = авто-определение)
 * E2E_TEST_TIMEOUT=ms                      - полный тест (default: 120000)
 * E2E_ACTION_TIMEOUT=ms                    - действия пользователя (default: 15000)
 * E2E_NAVIGATION_TIMEOUT=ms                - навигация (default: CI 60000, local 45000)
 * E2E_EXPECT_TIMEOUT=ms                    - ожидания (default: CI 60000, local 45000)
 * E2E_REPORTS_MAX_AGE_DAYS=N               - очистка старых отчетов (default: CI 7, local 30)
 * E2E_VERBOSE=true                         - детальное логирование конфигурации
 */

// ⚠️ AI тесты требуют значительных CPU/памяти ресурсов

// Валидация и установка значения параллельности
function getFullyParallel(): boolean {
  const envValue = process.env['E2E_FULLY_PARALLEL'];

  if (envValue === 'true') return true;
  if (envValue === 'false') return false;

  // По умолчанию: параллельно локально, последовательно в CI (для стабильности)
  return !isCI;
}

// Валидация и установка количества воркеров
function getWorkers(): number | undefined {
  const envValue = process.env['E2E_WORKERS'];

  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      console.warn(`⚠️  Invalid E2E_WORKERS value: "${envValue}". Using auto-detection.`);
      return undefined;
    }
    return parsed;
  }

  // В CI используем 1 воркер для стабильности и предсказуемости
  // Локально позволяем Playwright самому определить оптимальное количество
  return isCI ? 1 : undefined;
}

// Функция для получения таймаутов из переменных окружения
function getTimeouts(): {
  testTimeout: number;
  actionTimeout: number;
  navigationTimeout: number;
  expectTimeout: number;
} {
  const parseTimeout = (envVar: string | undefined, defaultValue: number): number => {
    if (!envVar) return defaultValue;
    const parsed = parseInt(envVar, 10);
    if (isNaN(parsed) || parsed < 1000) {
      console.warn(`⚠️  Invalid timeout value: "${envVar}". Using default ${defaultValue}ms.`);
      return defaultValue;
    }
    return parsed;
  };

  return {
    testTimeout: parseTimeout(process.env['E2E_TEST_TIMEOUT'], 2 * 60_000), // 2 мин
    actionTimeout: parseTimeout(process.env['E2E_ACTION_TIMEOUT'], 15_000), // 15 сек
    navigationTimeout: parseTimeout(process.env['E2E_NAVIGATION_TIMEOUT'], isCI ? 60_000 : 45_000), // 60 сек CI, 45 сек локально
    expectTimeout: parseTimeout(process.env['E2E_EXPECT_TIMEOUT'], isCI ? 60_000 : 45_000), // 60 сек CI, 45 сек локально
  };
}

const FULLY_PARALLEL = getFullyParallel();
const workers = getWorkers();

// Таймауты для E2E тестов (настраиваемые через переменные окружения)
const timeouts = getTimeouts();

// Функция для оценки системных ресурсов и рекомендации по параллельности
function assessSystemResources(): { recommendedWorkers: number; warnings: string[]; } {
  const warnings: string[] = [];
  const recommendedWorkers = workers || 4; // Default assumption

  // AI тесты особенно требовательны к ресурсам
  if (FULLY_PARALLEL && recommendedWorkers > 2) {
    warnings.push('AI-heavy tests with high parallelism may cause system instability.');
  }

  if (FULLY_PARALLEL) {
    warnings.push('Monitor CPU/memory usage during parallel AI tests.');
  }

  return { recommendedWorkers, warnings };
}

// Вывод информации о конфигурации параллельности (только локально для отладки)
if (!isCI && process.env['E2E_VERBOSE'] !== 'false') {
  const { recommendedWorkers, warnings } = assessSystemResources();

  console.log(
    `🔧 E2E Parallelism: ${FULLY_PARALLEL ? 'ENABLED' : 'DISABLED'}, Workers: ${workers || 'auto'}`,
  );

  if (FULLY_PARALLEL && !workers && recommendedWorkers < 4) {
    console.warn(`⚠️  System assessment recommends ${recommendedWorkers} workers for stability.`);
    console.warn(`   Set E2E_WORKERS=${recommendedWorkers} to optimize performance.`);
  }

  warnings.forEach((warning) => console.warn(`⚠️  ${warning}`));

  if (FULLY_PARALLEL) {
    console.log(`💡 AI tests enabled. Monitor system resources during execution.`);
  }
}

// Таймауты для E2E тестов (адаптированы для AI интеграций)
// Таймауты теперь получаются из функции getTimeouts() с поддержкой переменных окружения

// ⚠️ AI-специфичные настройки для тяжелых тестов с AI интеграциями
// IMPORTANT: Использовать ТОЛЬКО в выделенных describe блоках для AI тестов
// НЕ смешивать с обычными тестами - это может вызвать неожиданные таймауты
// ❌ НЕПРАВИЛЬНО: test('regular test', { ...AI_TEST_CONFIG }) - слишком долго для обычного теста
// ✅ ПРАВИЛЬНО: test.describe('AI Suite', { ...AI_TEST_CONFIG }) - весь suite с AI таймаутами
export const AI_TEST_CONFIG = {
  timeout: 5 * 60_000, // 5 минут - полный AI тест может быть долгим
  expect: { timeout: 120_000 }, // 2 минуты - AI API могут отвечать долго
  retries: isCI ? 3 : 1, // +2 retries в CI для компенсации flaky AI сервисов
};

// Настройки web сервера для E2E тестов
// E2E_WEB_COMMAND - команда запуска сервера (по умолчанию: 'pnpm run dev')
// E2E_BASE_URL - URL веб сервера (по умолчанию: 'http://localhost:3000')
const WEBSERVER_URL = process.env['E2E_BASE_URL'] || 'http://localhost:3000';

// Функция очистки старых отчетов отключена для совместимости с ES modules
function cleanupOldReports(_baseDir: string, _maxAgeDays: number = 7): void {
  // Очистка отчетов отключена для избежания проблем с require() в ES modules
  console.log(`ℹ️  Report cleanup disabled (ES modules compatibility)`);
}

// Директории для артефактов тестирования
const REPORTS_DIR = isCI
  ? `./playwright-report/${new Date().toISOString().split('T')[0]}_${Date.now()}`
  : './playwright-report/';

// Очистка старых отчетов (в CI агрессивнее, локально мягче)
const maxAgeDays = process.env['E2E_REPORTS_MAX_AGE_DAYS']
  ? parseInt(process.env['E2E_REPORTS_MAX_AGE_DAYS'], 10)
  : (isCI ? 7 : 30);

cleanupOldReports('./playwright-report', maxAgeDays);

const OUTPUT_DIR = `${REPORTS_DIR}/test-results`;

// Web server команда упрощена для совместимости

// CI metadata для traceability
const ciMetadata = isCI
  ? {
    commit: process.env['GITHUB_SHA'] || process.env['COMMIT_SHA'] || 'unknown',
    branch: process.env['GITHUB_REF_NAME'] || process.env['BRANCH_NAME'] || 'unknown',
    runId: process.env['GITHUB_RUN_ID'] || process.env['RUN_ID'] || 'unknown',
  }
  : undefined;

// Динамическое формирование reporter'ов без пустых элементов
// Унифицированная конфигурация отчетов (все пути относительно REPORTS_DIR)
const reporters = [
  ['list'], // Базовый консольный вывод
  ...(isCI ? [['github']] : []), // GitHub Actions интеграция только в CI
  ['html', {
    outputFolder: `${REPORTS_DIR}/html`, // HTML отчеты в папке отчетов
    ...(ciMetadata ? { metadata: ciMetadata } : {}), // CI metadata только при наличии
  }],
  ['json', { outputFile: `${OUTPUT_DIR}/results.json` }], // JSON результаты в test-results
];

/**
 * @see https://playwright.dev/docs/test-configuration - официальная документация Playwright
 */
export default {
  testDir: '../../e2e',
  /* Run tests in files in parallel */
  fullyParallel: FULLY_PARALLEL, // Контролируется через E2E_FULLY_PARALLEL

  /* Запрещает сборку в CI, если случайно оставили test.only в коде */
  forbidOnly: isCI,

  /* Retry on CI only */
  retries: isCI ? 2 : 0,

  /* Workers: контролируется через E2E_WORKERS или auto-определение */
  workers,

  /* Global test timeout */
  timeout: timeouts.testTimeout,

  /* Общие настройки для всех проектов браузеров. @see https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Базовый URL для действий типа `await page.goto('/')`. */
    baseURL: WEBSERVER_URL,

    /* Сбор trace при повторах неудачных тестов. @see https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Скриншоты только при падении тестов */
    screenshot: 'only-on-failure',

    /* Видео только при падении тестов */
    video: 'retain-on-failure',

    /* Таймаут для отдельных действий пользователя */
    actionTimeout: timeouts.actionTimeout,

    /* Таймаут для навигации между страницами */
    navigationTimeout: timeouts.navigationTimeout,

    /* Глобальный таймаут для E2E тестов (включая AI операции) */
    testIdAttribute: 'data-testid',
  },

  /* Настройка проектов для основных браузеров */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
      testMatch: [
        '**/smoke/**/*.spec.ts',
        '**/user-journeys/**/*.spec.ts',
        '**/admin-panel/**/*.spec.ts',
      ],
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/mobile/**/*.spec.ts',
    },

    /* Тестирование в брендовых браузерах для расширенного покрытия */
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        channel: 'msedge',
      },
      testMatch: [
        '**/smoke/**/*.spec.ts',
        '**/user-journeys/**/*.spec.ts',
        '**/admin-panel/**/*.spec.ts',
      ],
    },

    {
      name: 'Google Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        channel: 'chrome',
      },
      testMatch: [
        '**/smoke/**/*.spec.ts',
        '**/user-journeys/**/*.spec.ts',
        '**/admin-panel/**/*.spec.ts',
      ],
    },

    /* Дополнительные конфигурации браузеров для расширенного покрытия */
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
      testMatch: [
        '**/user-journeys/**/*.spec.ts',
      ],
    },

    {
      name: 'Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
      testMatch: [
        '**/user-journeys/**/*.spec.ts',
      ],
    },

    {
      name: 'Firefox Mobile',
      use: {
        ...devices['Pixel 7'],
        deviceScaleFactor: 1,
      },
      testMatch: '**/mobile/**/*.spec.ts',
    },

    {
      name: 'Safari Mobile',
      use: {
        ...devices['iPhone 13'],
      },
      testMatch: '**/mobile/**/*.spec.ts',
    },
  ],

  /* Web server отключен - предполагается, что сервер уже запущен */
  // webServer: {
  //   command: WEBSERVER_COMMAND,
  //   url: WEBSERVER_URL,
  //   reuseExistingServer: true,
  //   timeout: WEBSERVER_TIMEOUT,
  //   cwd: WEBSERVER_CWD,
  // },

  /* Глобальная настройка и очистка перед/после всех тестов (временно отключены) */
  // globalSetup: './global-setup',
  // globalTeardown: './global-teardown',

  /* Артефакты тестирования */
  outputDir: OUTPUT_DIR,
  snapshotDir: `${OUTPUT_DIR}/snapshots/`,
  traceDir: `${OUTPUT_DIR}/traces/`,

  /* Настройки ожидания для AI операций */
  expect: {
    timeout: timeouts.expectTimeout,
    /* Настройки для визуальных тестов */
    toHaveScreenshot: {
      maxDiffPixelRatio: isCI ? 0.1 : 0.05, // 10% в CI для шрифтов/браузеров, 5% локально для точности
    },
  },

  /* Настройки отчетности тестов. @see https://playwright.dev/docs/test-reporters */
  reporter: reporters.map((reporter) => {
    if (Array.isArray(reporter) && reporter[0] === 'html' && reporter[1]) {
      return [
        'html',
        {
          ...(reporter[1] as Record<string, unknown>),
          open: isCI ? 'never' : 'on-failure', // Открывать отчеты только при неудаче в CI
        },
      ];
    }
    return reporter;
  }),
};
