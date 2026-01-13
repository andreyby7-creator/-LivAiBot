#!/usr/bin/env node

/**
 * @file Главный тестовый раннер LivAi - объединяет все тестовые фреймворки
 *
 * Этот файл является центральной точкой запуска всех тестов в проекте LivAi.
 * Он координирует запуск unit тестов (Vitest), E2E тестов (Playwright) и Python тестов (pytest),
 * собирает покрытие кода и предоставляет унифицированную отчетность.
 */

import { spawn } from 'child_process';

import dayjs from 'dayjs';

// Твои существующие модули
import { mergeCoverageReports } from './coverage-merger';
import { runIntegrationTests } from './integration';
import { env, timeouts } from './shared-config';

// ─────────────────────────────────────────────────────────────
// Цвета без зависимости от chalk (чтобы раннер не падал)
// ─────────────────────────────────────────────────────────────
const color = {
  green: (s: string): string => `\x1b[32m${s}\x1b[0m`,
  red: (s: string): string => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string): string => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string): string => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string): string => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string): string => `\x1b[1m${s}\x1b[0m`,
};

// ─────────────────────────────────────────────────────────────
// Семантика
// ─────────────────────────────────────────────────────────────
type SuiteStatus = 'passed' | 'failed' | 'broken' | 'skipped';

interface SuiteResult {
  name: string;
  status: SuiteStatus;
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
    errorCode?: string; // Детальная классификация ошибки
  }[];
  rawOutput: string;
}

// ─────────────────────────────────────────────────────────────
// Универсальный запуск команды
// ─────────────────────────────────────────────────────────────
function runCommand(cmd: string, args: string[], cwd = process.cwd(), timeout = 300000): Promise<{
  code: number | null;
  signal: string | null;
  output: string;
  duration: number;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, { cwd, stdio: 'pipe', shell: false });

    // Таймаут для предотвращения зависания
    const timeoutId = setTimeout(() => {
      console.log(color.yellow(`\n⏰ Timeout: killing process after ${timeout}ms`));
      child.kill('SIGTERM'); // Сначала SIGTERM

      // Если через 5 секунд не умер - SIGKILL
      setTimeout(() => {
        if (!child.killed) {
          console.log(color.red('💀 Force killing process with SIGKILL'));
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    let output = '';
    let stderrOutput = '';

    child.stdout.on('data', (d) => {
      const s = d.toString();
      output += s;
      process.stdout.write(s);
    });

    child.stderr.on('data', (d) => {
      const s = d.toString();
      output += s;
      stderrOutput += s; // Собираем stderr для последующего отображения
    });

    child.on('close', (code, signal) => {
      // Очищаем таймаут
      clearTimeout(timeoutId);

      // Выводим stderr с правильной окраской на основе exit code
      if (stderrOutput.trim()) {
        if (code !== 0 || signal !== null) {
          // Процесс завершился с ошибкой или сигналом - красный цвет
          process.stderr.write(color.red(stderrOutput));
        } else {
          // Процесс успешный - обычный цвет (warnings, progress и т.д.)
          process.stderr.write(stderrOutput);
        }
      }

      resolve({
        code,
        signal,
        output,
        duration: (Date.now() - start) / 1000,
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Парсинг реального статуса
// ─────────────────────────────────────────────────────────────
// Определение статуса по контексту выполнения (без grep-анализа текста)
function getStatusFromCode(code: number | null, signal: string | null, cmd: string): SuiteStatus {
  // Инфраструктурные ошибки - процесс не может выполниться
  if (signal !== null) return 'broken'; // Процесс убит сигналом
  if (code === null) return 'broken'; // Процесс не запустился

  // Процесс выполнился - определяем по exit code
  if (code === 0) return 'passed'; // Успех

  // Неизвестный exit code - считаем инфраструктурной ошибкой
  // Только известные exit codes тестовых фреймворков считаем test failures
  if (isTestFailureExitCode(code, cmd)) {
    return 'failed'; // Известный exit code для test failure
  }

  return 'broken'; // Неизвестный exit code = инфраструктурная ошибка
}

// Проверяет, является ли exit code известным кодом test failure для данного фреймворка
function isTestFailureExitCode(code: number, framework: string): boolean {
  // Vitest: exit code 1 = test failure
  if (framework === 'vitest' && code === 1) return true;

  // Pytest: exit code 1 = test failure
  if (framework === 'pytest' && code === 1) return true;

  // Playwright: exit code 1 = test failure
  if (framework === 'playwright' && code === 1) return true;

  return false; // Неизвестный код = инфраструктурная ошибка
}

// Дополнительная классификация типа ошибки для диагностики
function classifyError(code: number | null, signal: string | null, output: string): string {
  if (signal !== null) return `signal_terminated_${signal.toLowerCase()}`;
  if (code === null) return 'infrastructure_process_failed';
  if (code === 0) return 'success';

  // Анализ stdout только для дополнительной информации
  if (output.includes('ModuleNotFoundError') || output.includes('ERR_MODULE_NOT_FOUND')) {
    return 'missing_dependency';
  }
  if (output.includes('ENOENT')) {
    return 'command_not_found';
  }
  if (output.includes('spawn')) {
    return 'spawn_error';
  }
  if (output.includes('timeout')) {
    return 'test_timeout';
  }

  return 'test_failure';
}

// detectStatus удалена - теперь используем getStatusFromCode напрямую

function buildErrors(
  code: number | null,
  signal: string | null,
  output: string,
): SuiteResult['errors'] {
  const errors: SuiteResult['errors'] = [];
  const errorCode = classifyError(code, signal, output);

  if (output.includes('ModuleNotFoundError')) {
    errors.push({
      type: 'import',
      message: 'Python import errors detected',
      errorCode,
    });
  }

  if (output.includes('ERR_MODULE_NOT_FOUND')) {
    errors.push({
      type: 'import',
      message: 'Node module import error',
      errorCode,
    });
  }

  if (output.includes('ENOENT') || output.includes('spawn')) {
    errors.push({
      type: 'spawn',
      message: 'Command spawn failure',
      errorCode,
    });
  }

  // Если не нашли специфических инфраструктурных ошибок,
  // но команда завершилась с ошибкой - это test failure
  if (errors.length === 0 && code !== 0) {
    errors.push({
      type: 'test',
      message: 'Test assertions failed - see raw output for details',
      errorCode,
    });
  }

  // Только если команда успешна, но есть output - это unknown (редкий случай)
  if (errors.length === 0 && code === 0 && output.trim() !== '') {
    errors.push({
      type: 'unknown',
      message: 'Unexpected output from successful command',
      errorCode,
    });
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────
// Suite runners
// ─────────────────────────────────────────────────────────────
async function runVitest(): Promise<SuiteResult> {
  console.log(color.cyan('\n🧪 UNIT TESTS (Vitest)'));
  const r = await runCommand(
    'npx',
    ['vitest', 'run', '--config', 'config/vitest/vitest.config.ts'],
    process.cwd(),
    1 * 60 * 1000,
  ); // 1 минута

  const status = getStatusFromCode(r.code, r.signal, 'vitest');

  return {
    name: 'Vitest',
    status,
    duration: r.duration,
    errors: status === 'passed' ? [] : buildErrors(r.code, r.signal, r.output),
    rawOutput: r.output,
  };
}

async function runPytest(): Promise<SuiteResult> {
  console.log(color.cyan('\n🐍 PYTHON TESTS (pytest)'));

  // Список сервисов с тестами
  const servicesWithTests = [
    'services/api-gateway',
    'services/auth-service',
    'services/bots-service',
    'services/conversations-service',
  ];

  const results = [];
  for (const serviceDir of servicesWithTests) {
    console.log(color.gray(`Running pytest in ${serviceDir}...`));
    const r = await runCommand(
      'python',
      [
        '-m',
        'pytest',
        '--cov-report=json:reports/coverage/python.json',
      ],
      serviceDir,
      2 * 60 * 1000,
    ); // 2 минуты на сервис
    results.push(r);
  }

  // Объединяем результаты
  const combinedCode = results.some((r) => r.code !== 0) ? 1 : 0;
  const combinedOutput = results.map((r, i) => `=== ${servicesWithTests[i]} ===\n${r.output}`).join(
    '\n\n',
  );

  // Подсчитываем общее количество тестов
  const totalTests = results.reduce((sum, r) => {
    const match = r.output.match(/(\d+) passed/);
    return sum + (match && match[1] ? parseInt(match[1]) : 0);
  }, 0);

  console.log(
    color.green(
      `✅ Python tests completed: ${totalTests} tests passed across ${servicesWithTests.length} services`,
    ),
  );

  return {
    name: 'Pytest',
    status: combinedCode === 0 ? 'passed' : 'failed',
    duration: results.reduce((sum, r) => sum + r.duration, 0),
    errors: combinedCode !== 0
      ? [{
        type: 'test',
        message: 'Some Python tests failed - see raw output for details',
        errorCode: 'pytest_failures',
      }]
      : [],
    rawOutput: combinedOutput,
  };
}

async function runPlaywright(): Promise<SuiteResult> {
  console.log(color.cyan('\n🌐 E2E TESTS (Playwright)'));
  const r = await runCommand('npx', ['playwright', 'test'], process.cwd(), 5 * 60 * 1000); // 5 минут

  const status = getStatusFromCode(r.code, r.signal, 'playwright');

  return {
    name: 'Playwright',
    status,
    duration: r.duration,
    errors: status === 'passed' ? [] : buildErrors(r.code, r.signal, r.output),
    rawOutput: r.output,
  };
}

// ─────────────────────────────────────────────────────────────
// Reporter
// ─────────────────────────────────────────────────────────────
function printSuite(result: SuiteResult): void {
  const statusColor = result.status === 'passed'
    ? color.green
    : result.status === 'broken'
    ? color.red
    : color.yellow;

  console.log(
    `${statusColor(result.status.toUpperCase())} ${result.name} (${result.duration.toFixed(2)}s)`,
  );

  if (result.errors.length > 0) {
    console.log(color.red('  Errors:'));
    for (const e of result.errors) {
      console.log(`   - [${e.type}] ${e.message}`);
    }
  }
}

function globalStatus(results: SuiteResult[]): SuiteStatus {
  if (results.some((r) => r.status === 'broken')) return 'broken';
  if (results.some((r) => r.status === 'failed')) return 'failed';
  if (results.every((r) => r.status === 'passed')) return 'passed';
  return 'skipped';
}

// ─────────────────────────────────────────────────────────────
// MAIN - возвращает статус для композируемости
// ─────────────────────────────────────────────────────────────
async function main(): Promise<SuiteStatus> {
  console.log(color.bold('\n🚀 LIVAI ULTRA TEST SUITE'));
  console.log(color.gray(`Start: ${dayjs().format('DD.MM.YYYY HH:mm:ss')}`));

  const [vitest, pytest, playwright] = await Promise.all([
    runVitest(),
    runPytest(),
    runPlaywright(),
  ]);

  const integration = await runIntegrationTests(); // твой существующий модуль

  console.log(color.bold('\n📊 RESULTS'));
  printSuite(vitest);
  printSuite(pytest);
  printSuite(playwright);
  printSuite(integration);

  console.log(color.bold('\n📦 COVERAGE'));
  const coverage = await mergeCoverageReports();
  if (coverage) {
    console.log(color.green(`Merged coverage: ${coverage.coverage.total}%`));
  } else {
    console.log(color.red('Coverage invalid or missing'));
  }

  const all = [vitest, pytest, playwright, integration];
  const gStatus = globalStatus(all);

  console.log(color.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  if (gStatus === 'passed') {
    console.log(color.bold(color.green('GLOBAL STATUS: PASSED')));
  } else if (gStatus === 'broken') {
    console.log(color.bold(color.red('GLOBAL STATUS: BROKEN (infrastructure error)')));
  } else {
    console.log(color.bold(color.yellow('GLOBAL STATUS: FAILED (tests failed)')));
  }
  console.log(color.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  return gStatus;
}

// CLI обертка - здесь делаем process.exit()
main().then((status) => {
  process.exit(status === 'passed' ? 0 : 1);
}).catch((e) => {
  console.error(color.red('Fatal runner error'), e);
  process.exit(2);
});

// Экспорт для использования как библиотеки
export { main as runTestSuite };
