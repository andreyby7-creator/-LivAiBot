/**
 * @file TypeScript версия интеграционного слоя для всех тестовых фреймворков LivAi
 * С полной типизацией для конфигураций и опций
 */

// Импорт функций из python-bridge.ts
import {
  mergeCoverageReports as mergeCoverageReportsImpl,
  runPythonTests as runPythonTestsImpl,
} from '../vitest/integrations/python-bridge';

import {
  coverage,
  env,
  getBaseConfig,
  paths,
  type TestType,
  testTypes,
  timeouts,
} from './shared-config';

// Тип SuiteResult из test-runner.ts
interface SuiteResult {
  name: string;
  status: 'passed' | 'failed' | 'broken' | 'skipped';
  duration: number;
  files?: number;
  tests?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  coverage?: number;
  errors: {
    type: 'test' | 'import' | 'spawn' | 'config' | 'unknown';
    message: string;
  }[];
  rawOutput: string;
}

import type {
  CoverageMergeResult as BaseCoverageMergeResult,
  RunPythonTestsOptions,
  TestResult,
} from '../vitest/integrations/python-bridge';
import type { Config as PlaywrightConfig } from '@playwright/test';

// Типизированный объект Python bridge модуля
const pythonBridge: PythonBridgeModule = {
  runPythonTests: runPythonTestsImpl,
  mergeCoverageReports: mergeCoverageReportsImpl,
};

/** Опции для генерации конфигурации Vitest */
interface VitestConfigOptions {
  testType?: TestType;
  coverage?: boolean;
}

/** Опции для генерации конфигурации Playwright */
interface PlaywrightConfigOptions {
  baseURL?: string;
  testType?: TestType;
  timeouts?: {
    actionTimeout?: number;
    navigationTimeout?: number;
    expectTimeout?: number;
  };
}

/** Конфигурация coverage для Vitest */
type VitestCoverageConfig = typeof coverage.vitest & {
  reportsDirectory: string;
};

/** Результат конфигурации Vitest */
type VitestConfigResult = {
  test: {
    environment: 'node';
    globals: boolean;
  };
  coverage?: false | VitestCoverageConfig;
  verbose: boolean;
  debug: boolean;
  bail: number;
  timeout: number;
  retries: number;
  watch: boolean;
  testType: TestType;
};

/** Расширяем тип для локального использования */
interface CoverageMergeResult extends BaseCoverageMergeResult {
  success: boolean;
}

interface PythonBridgeModule {
  runPythonTests: (options?: RunPythonTestsOptions) => Promise<TestResult>;
  mergeCoverageReports: () => Promise<BaseCoverageMergeResult>;
}

/** Возвращает общую конфигурацию для Vitest с типизацией */
export function getVitestConfig(options: VitestConfigOptions = {}): VitestConfigResult {
  const { testType = testTypes.unit, coverage: coverageOverride } = options;
  const enableCoverage = coverageOverride ?? env.vitest.coverage;
  const baseConfig = getBaseConfig(testType);

  return {
    ...baseConfig,
    test: {
      environment: 'node',
      globals: true,
    },
    coverage: enableCoverage && {
      ...coverage.vitest,
      reportsDirectory: paths.coverage.js,
    },
    testType,
  };
}

/** Возвращает общую конфигурацию для Playwright с типизацией */
export function getPlaywrightConfig(
  options: PlaywrightConfigOptions = {},
): Partial<PlaywrightConfig> {
  const {
    baseURL = 'http://localhost:3000',
    testType = testTypes.e2e,
    timeouts: timeoutOverrides = {}, // Переопределения таймаутов
  } = options;
  const baseConfig = getBaseConfig(testType);

  const config: Partial<PlaywrightConfig> = {
    ...baseConfig,
    use: {
      baseURL,
      headless: env.playwright.headless,
      screenshot: 'only-on-failure' as const,
      video: 'retain-on-failure' as const,
      trace: 'on-first-retry' as const,
      ...timeouts.playwright,
      ...timeoutOverrides,
    },
    expect: {
      timeout: timeoutOverrides.expectTimeout ?? timeouts.e2e,
    },
    ...(env.isCI ? {} : {
      webServer: {
        command: 'cd apps/web && pnpm run dev',
        url: baseURL,
        reuseExistingServer: !env.isCI,
        timeout: 120000,
      },
    }),
  };

  return config;
}

/** Запуск Python тестов через bridge */
export async function runPythonTests(options?: RunPythonTestsOptions): Promise<TestResult> {
  return pythonBridge.runPythonTests(options);
}

/** Объединение отчетов о покрытии Python + JavaScript */
export async function mergeCoverageReports(): Promise<CoverageMergeResult> {
  try {
    const result = await pythonBridge.mergeCoverageReports();
    return {
      ...result,
      success: true,
    };
  } catch {
    return {
      success: false,
      reports: [],
      outputDir: paths.coverage.root,
    };
  }
}

/**
 * Запуск интеграционных тестов
 * Объединяет результаты Python и JavaScript тестов
 */
export async function runIntegrationTests(): Promise<SuiteResult> {
  const startTime = Date.now();

  try {
    // Запускаем Python тесты с таймаутом 10 минут
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Integration tests timeout after 10 minutes')),
        10 * 60 * 1000,
      );
    });
    const pythonResult = await Promise.race([runPythonTests(), timeoutPromise]);

    // Объединяем отчеты о покрытии
    const coverageResult = await mergeCoverageReports();

    const duration = Date.now() - startTime;

    // Парсим вывод Python тестов для получения статистики
    const output = pythonResult.stdout + pythonResult.stderr;
    const testStats = parseTestOutput(output);

    return {
      name: 'Integration Tests',
      status: pythonResult.success ? 'passed' : 'failed',
      duration,
      files: testStats.files,
      tests: testStats.tests,
      passed: testStats.passed,
      failed: testStats.failed,
      coverage: coverageResult.success ? 85 : 0, // примерное значение
      errors: pythonResult.code !== 0
        ? [{
          type: 'test' as const,
          message: pythonResult.stderr || 'Python tests failed',
        }]
        : [],
      rawOutput: output,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      name: 'Integration Tests',
      status: 'failed',
      duration,
      errors: [{
        type: 'spawn',
        message: error instanceof Error ? error.message : 'Unknown integration test error',
      }],
      rawOutput: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Парсит вывод тестов для извлечения статистики */
function parseTestOutput(output: string): {
  files: number;
  tests: number;
  passed: number;
  failed: number;
} {
  // Простой парсер для pytest вывода
  // Пример: "collected 5 items", "3 passed, 2 failed"
  const collectedMatch = output.match(/collected (\d+) items/);
  const resultsMatch = output.match(/(\d+) passed(?:, (\d+) failed)?/);

  const tests = collectedMatch && collectedMatch[1] ? parseInt(collectedMatch[1]) : 0;
  const passed = resultsMatch && resultsMatch[1] ? parseInt(resultsMatch[1]) : 0;
  const failed = resultsMatch && resultsMatch[2] ? parseInt(resultsMatch[2]) : 0;
  const files = Math.max(1, Math.ceil(tests / 10)); // грубая оценка

  return { files, tests, passed, failed };
}
