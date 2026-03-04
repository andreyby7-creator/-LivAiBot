/**
 * @file Мост для интеграции Python pytest с Vitest репортингом
 * Обеспечивает:
 * - Запуск Python тестов из Vitest
 * - Объединение отчетов о покрытии
 * - Синхронизацию результатов тестирования
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

// Конфигурация Python сервисов
const PYTHON_SERVICES = ['conversations', 'auth', 'api-gateway', 'bots'];

/** Проверка доступности Python и pytest */
async function checkPythonEnvironment(): Promise<boolean> {
  return new Promise((resolve) => {
    const pythonProcess = spawn('python3', ['--version'], {
      stdio: 'pipe',
    });

    // Таймаут 10 минут для предотвращения зависания
    const timer = setTimeout(() => {
      pythonProcess.kill('SIGKILL');
    }, 10 * 60 * 1000);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        console.warn('⚠️  Python3 не найден или не работает');
        resolve(false);
        return;
      }

      // Проверяем версию Python
      if (!stdout.includes('Python 3.12') && !stdout.includes('Python 3.13')) {
        console.warn('⚠️  Python version not in supported range (3.12/3.13)');
        resolve(false);
        return;
      }

      // Проверяем pytest
      const pytestProcess = spawn('python3', ['-m', 'pytest', '--version'], {
        stdio: 'pipe',
      });

      // Таймаут 10 минут для pytest проверки
      const pytestTimer = setTimeout(() => {
        pytestProcess.kill('SIGKILL');
      }, 10 * 60 * 1000);

      pytestProcess.on('close', (pytestCode) => {
        clearTimeout(pytestTimer);

        if (pytestCode !== 0) {
          console.warn('⚠️  pytest не найден или не работает');
          resolve(false);
        } else {
          console.log('✅ Python и pytest доступны');
          resolve(true);
        }
      });
    });
  });
}

export interface RunPythonTestsOptions {
  service?: string;
  coverage?: boolean;
  verbose?: boolean;
  markers?: string[];
}

export interface TestResult {
  success: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Запуск Python тестов через pytest */
async function runPythonTests(options: RunPythonTestsOptions = {}): Promise<TestResult> {
  const {
    service = 'all', // 'all', 'conversations', 'auth', etc.
    coverage = true,
    verbose = false,
    markers = [], // ['unit', 'not ai'] - маркеры для pytest -m
  } = options;

  // Проверяем окружение перед запуском
  const envOk = await checkPythonEnvironment();
  if (!envOk) {
    return { success: false, code: 1, stdout: '', stderr: 'Python or pytest not available' };
  }

  return new Promise((resolve, reject) => {
    // Базовые аргументы для python -m pytest
    const args = ['-m', 'pytest'];

    // Аргументы для pytest (отдельный массив для читаемости)
    let pytestArgs: string[] = [];

    // Добавляем маркеры: pytest -m "unit and not ai"
    if (markers.length > 0) {
      const markerExpr = markers.join(' and ');
      pytestArgs = [...pytestArgs, '-m', markerExpr];
    }

    // Добавляем покрытие (только если pytest-cov установлен)
    if (coverage) {
      // Синхронная проверка наличия pytest-cov
      try {
        const { execSync } = require('child_process') as typeof import('child_process');
        execSync('python3 -c "import pytest_cov"', { stdio: 'pipe' });
        pytestArgs = [
          ...pytestArgs,
          '--cov=services',
          '--cov-report=json:reports/coverage/python.json',
          '--cov-report=html:reports/coverage/python',
        ];
      } catch {
        // pytest-cov не установлен, пропускаем покрытие
      }
    }

    // Выбираем сервис
    if (service !== 'all') {
      pytestArgs = [...pytestArgs, `services/${service}-service/tests/`];
    } else {
      // Запускаем для каждого сервиса отдельно (glob не работает надежно)
      const servicePaths = PYTHON_SERVICES.map((svc) => `services/${svc}-service/tests/`);
      pytestArgs = [...pytestArgs, ...servicePaths];
    }

    // Детальный вывод
    if (verbose) {
      pytestArgs = [...pytestArgs, '-v', '--tb=long'];
    }

    const pythonProcess = spawn('python3', [...args, ...pytestArgs], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: {
        ...process.env,
        PYTHONPATH: path.resolve(process.cwd(), 'services'),
      },
    });

    // Таймаут контролируется на уровне runCommand в test-runner.ts

    // Храним логи для анализа
    let stdout = '';
    let stderr = '';

    // Перенаправляем stdout и stderr для лучшей обработки ошибок
    const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';
    const prefix = isCI ? '[PYTEST] ' : '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      process.stdout.write(`${prefix}${chunk}`);
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      process.stderr.write(`${prefix}${chunk}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, code, stdout, stderr });
      } else {
        resolve({ success: false, code, stdout, stderr });
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Объединение отчетов о покрытии Python + JavaScript
 * @returns {Promise<{reports: string[], outputDir: string}>} Пути к созданным отчетам
 */
export interface CoverageMergeResult {
  reports: string[];
  outputDir: string;
}

interface PythonCoverageData {
  totals?: {
    percent_covered?: number;
  };
}

interface JsCoverageData {
  total?: {
    percent?: number;
  };
}

async function mergeCoverageReports(): Promise<CoverageMergeResult> {
  try {
    const [pythonCoverage, jsCoverage] = await Promise.all([
      fs.readFile('reports/coverage/python.json', 'utf8').catch(() => null),
      fs.readFile('reports/coverage/js.json', 'utf8').catch(() => null),
    ]);

    const merged = {
      timestamp: new Date().toISOString(),
      python: pythonCoverage !== null ? JSON.parse(pythonCoverage) as PythonCoverageData : null,
      javascript: jsCoverage !== null ? JSON.parse(jsCoverage) as JsCoverageData : null,
      summary: {
        pythonTests: 0,
        jsTests: 0,
        totalCoverage: 0,
      },
    };

    // Рассчитываем объединенное покрытие (усреднение с правильной математикой)
    const pythonCoveragePercent = merged.python?.totals?.percent_covered ?? 0;
    const jsCoveragePercent = merged.javascript?.total?.percent ?? 0;

    const totalCoverage = pythonCoveragePercent > 0 && jsCoveragePercent > 0
      ? Math.round((pythonCoveragePercent + jsCoveragePercent) / 2 * 100) / 100
      : (pythonCoveragePercent || jsCoveragePercent || 0);

    const mergedWithCoverage = {
      ...merged,
      summary: {
        ...merged.summary,
        totalCoverage,
      },
    };

    await fs.writeFile(
      'reports/coverage/merged.json',
      JSON.stringify(mergedWithCoverage, null, 2),
    );

    console.log('📊 Coverage reports merged successfully');
    return {
      reports: [
        'reports/coverage/python.json',
        'reports/coverage/js.json',
        'reports/coverage/merged.json',
      ],
      outputDir: 'reports/coverage',
    };
  } catch (error) {
    console.warn(
      '⚠️  Failed to merge coverage reports:',
      error instanceof Error ? error.message : String(error),
    );
    throw error; // Передаем ошибку выше для обработки в integration.ts
  }
}

/** Проверка здоровья Python сервисов */
async function checkPythonServices(): Promise<Record<string, boolean>> {
  const results = await Promise.allSettled(
    PYTHON_SERVICES.map((service) =>
      runPythonTests({
        service,
        markers: ['unit'],
        verbose: false,
      }).then((result) => ({ service, success: result.success }))
        .catch((error) => {
          console.warn(
            `⚠️  ${service} health check failed:`,
            error instanceof Error ? error.message : String(error),
          );
          return { service, success: false };
        })
    ),
  );

  return results.reduce((acc: Record<string, boolean>, result) => {
    if (result.status === 'fulfilled') {
      return { ...acc, [result.value.service]: result.value.success };
    } else {
      // Это не должно случиться из-за .catch выше, но на всякий случай
      const reason = result.reason as { service: string; };
      return { ...acc, [reason.service]: false };
    }
  }, {} as Record<string, boolean>);
}

export { checkPythonEnvironment, checkPythonServices, mergeCoverageReports, runPythonTests };
