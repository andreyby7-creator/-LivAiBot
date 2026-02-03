#!/usr/bin/env node
/**
 * Livai Vitest Runner
 * Enterprise обертка вокруг Vitest
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { program } from "commander";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { globSync } from "glob";
import ts from "typescript";

/* ================= ПРОВЕРКА ВЕРСИИ NODE ================= */

function assertNodeVersion() {
  // Читаем требуемую версию из .nvmrc файла
  let requiredVersion = '24.12.0'; // значение по умолчанию
  try {
    if (fs.existsSync('.nvmrc')) {
      requiredVersion = fs.readFileSync('.nvmrc', 'utf8').trim();
    }
  } catch (error) {
    console.warn('Не удалось прочитать .nvmrc файл, используем версию по умолчанию');
  }

  const [requiredMajor, requiredMinor] = requiredVersion.split('.').map(Number);
  const [currentMajor, currentMinor] = process.versions.node.split('.').map(Number);

  if (currentMajor !== requiredMajor || currentMinor !== requiredMinor) {
    fatal(
      `Требуется Node ${requiredVersion}, обнаружено ${process.versions.node}. ` +
      `Установите/активируйте нужную версию: nvm install ${requiredVersion} && nvm use ${requiredVersion}`
    );
  }
}

assertNodeVersion();

/* ================= ERROR HANDLING ================= */

// Централизованный error boundary для фатальных ошибок
function fatal(message, error = null) {
  console.error(`💥 ${message}`);
  if (error) {
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${error}`);
    }
  }
  process.exit(1);
}

// Поиск coverage-final.json в любых подпапках coverage (Vitest может складывать в coverage/tmp)
function locateCoverageFile() {
  // Приоритет: корневой coverage/coverage-final.json
  const rootCoverage = path.join(ROOT, 'coverage', 'coverage-final.json');
  if (fs.existsSync(rootCoverage)) return rootCoverage;

  // Если корневого нет — ищем глобально, но игнорируем node_modules и кеши
  const candidates = globSync('**/coverage-final.json', {
    cwd: ROOT,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.pnpm/**', '**/.pnpm-store/**', '**/.turbo/**'],
  });
  return candidates[0] ?? null;
}

async function waitForCoverageFile(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const file = locateCoverageFile();
    if (file && fs.existsSync(file)) return file;
    await new Promise(res => setTimeout(res, 200));
  }
  return null;
}

/* ================= ПУТИ ================= */

const ROOT = process.cwd();
const CONFIG_ROOT = path.join(ROOT, "config/vitest");

const CONFIGS = {
  base: path.join(CONFIG_ROOT, "vitest.config.ts"),                    // unit тесты
  shared: path.join(CONFIG_ROOT, "vitest.shared.config.ts"),           // общая среда для unit тестов
  packages: path.join(CONFIG_ROOT, "vitest.integration.config.ts"),    // интеграционные тесты пакетов
  ai: path.join(CONFIG_ROOT, "vitest.ai-integration.config.ts"),       // AI тесты
};

/* ================= ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ================= */

const CI_MODE = process.env.CI === "true" || process.env.CI === "1" || !!process.env.CI;

dotenvExpand.expand(dotenv.config({ path: path.join(ROOT, ".env") }));
dotenvExpand.expand(dotenv.config({ path: path.join(ROOT, "config/env/.env.test") }));
if (CI_MODE) dotenvExpand.expand(dotenv.config({ path: path.join(ROOT, ".env.ci") }));

// Валидация тестовых переменных
const requiredTestVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
const missingVars = requiredTestVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.warn(`⚠️  Отсутствуют тестовые переменные: ${missingVars.join(', ')}`);
}

/* ================= ОПЦИИ КОМАНДНОЙ СТРОКИ ================= */

program
  .name("livai-test")
  .description("Vitest runner для LivAI")
  .option("--unit", "Запустить unit тесты")
  .option("--integration", "Запустить интеграционные тесты")
  .option("--ai", "Запустить AI интеграционные тесты")
  .option("--all", "Запустить все типы тестов (unit + integration + ai)")
  .option("--packages <name>", "Запустить тесты для конкретного пакета(ов) (поддерживает glob паттерны)")
  .option("--watch", "Запустить в режиме наблюдения")
  .option("--parallel <n>", "Установить уровень параллелизма (auto, max, или число)")
  .option("--force-env <type>", "Принудительно переопределить окружение (node|jsdom)")
  .option("--coverage-diff <branch>", "Показать разницу покрытия по сравнению с веткой (по умолчанию: main)")
  .option("--summary", "Показать статистику тестов без запуска (для больших репозиториев)")
  .option("--config <name>", "Принудительно использовать конфиг vitest: base|shared|packages|ai")
  .option("--coverage", "Включить покрытие")
  .option("--no-coverage", "Отключить покрытие")
  .option("--dry-run", "Показать что будет выполнено без запуска")
  .option("--changed", "Запустить только измененные тесты")
  .option("--bail", "Остановить при первой неудаче")
  .option("--retry <n>", "Повторить неудачные тесты n раз", "0")
  .option("--runInBand", "Отключить параллелизм")
  .option("--strict", "Завершать с ошибкой при .only/.skip")
  .option("--debug", "Режим отладки: подробные логи, без покрытия, однопоточный")
  .option("--reporter <type>", "default|verbose|junit|json", "default")
  .option("--report-dir <path>", "Директория для junit/json отчетов", "reports")
  .option("--env <type>", "node|jsdom")
  .argument("[paths...]", "Проект, директория, файл или glob")
  .parse(process.argv);

const opts = program.opts();
const paths = program.args.length ? program.args : [];

/* ================= РАННЯЯ ИНИЦИАЛИЗАЦИЯ ================= */

// Окружение и настройки будут разрешены позже в resolveTestSetup

let normalizedPaths = validateAndNormalizePaths();
let coverageCleaned = false; // гарантируем, что coverage очищается один раз за запуск
let coverageEnabled = false;
let configPath = null;
let environment = null;
let reporter = opts.reporter || 'default';
let reportDir = opts.reportDir || 'reports';

// Применить фильтрацию пакетов
if (opts.packages) {
  // Если пути не указаны, использовать пакет как путь
  if (normalizedPaths.length === 0) {
    normalizedPaths = [`packages/${opts.packages}`];
  } else {
    // Отфильтровать существующие пути по паттерну пакета
    normalizedPaths = filterPathsByPackage(opts.packages, normalizedPaths);
  }
}

/* ================= ФИЛЬТРАЦИЯ ПАКЕТОВ ================= */

function filterPathsByPackage(packagePattern, inputPaths) {
  if (!packagePattern || inputPaths.length === 0) return inputPaths;

  const filteredPaths = [];
  const packageDirs = ['packages', 'apps', 'tools'];

  for (const inputPath of inputPaths) {
    // Если это уже полный путь к пакету, оставить как есть
    if (inputPath.startsWith('packages/') || inputPath.startsWith('apps/') || inputPath.startsWith('tools/')) {
      filteredPaths.push(inputPath);
      continue;
    }

    // Проверить, соответствует ли путь паттерну пакета
    for (const dir of packageDirs) {
      const fullPath = path.join(ROOT, dir, inputPath);
      if (fs.existsSync(fullPath)) {
        filteredPaths.push(path.relative(ROOT, fullPath));
        break;
      }
    }
  }

  return filteredPaths.length > 0 ? filteredPaths : inputPaths;
}

/* ================= ПОСТРОЕНИЕ АРГУМЕНТОВ VITEСТ ================= */

// Генерирует имя файла для JSON репортера
function getJsonFilename(testTypeName) {
  const base = testTypeName ? `results-${testTypeName.replace(/\s+/g, '-').toLowerCase()}` : "results";
  return `${base}.json`;
}

// Определяет конфигурацию репортера и output файла
function resolveReporterConfig(reporter = 'default', testTypeName = null, reportDir = 'reports') {
  const name = testTypeName ? testTypeName.replace(/\s+/g, '-').toLowerCase() : null;

  const map = {
    junit: { reporter: 'junit', file: name ? `${name}.xml` : 'junit.xml', dir: reportDir },
    json: { reporter: 'json', file: getJsonFilename(testTypeName), dir: reportDir },
    verbose: { reporter: 'verbose', file: null },
    default: { reporter: 'json', file: getJsonFilename(testTypeName), dir: reportDir }
  };

  const cfg = map[reporter] || map.default;

  return {
    reporter: cfg.reporter,
    outputFile: cfg.file ? path.join(cfg.dir, cfg.file) : null
  };
}

// Агрегирует результат одного тестового файла
function aggregateTestResult(testResult, state) {
  const filePath = testResult.testFilePath || testResult.name || '';

  // Пропускаем системные пути
  if (filePath.includes('.pnpm') || filePath.includes('node_modules') || filePath.includes('/projects/')) {
    return;
  }

  const normalizedPath = path.relative(ROOT, filePath);
  if (state.seenTests.has(normalizedPath)) return;

  state.seenTests.add(normalizedPath);
  const packageName = getPackageFromPath(normalizedPath);

  if (!state.packageResults.has(packageName)) {
    state.packageResults.set(packageName, { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 });
  }

  const pkgStats = state.packageResults.get(packageName);

  testResult.assertionResults?.forEach(assertion => {
    state.totalTests++;
    pkgStats.total++;

    switch (assertion.status) {
      case 'passed': state.passedTests++; pkgStats.passed++; break;
      case 'failed':
        state.failedTests++;
        pkgStats.failed++;
        state.failingTestDetails.push({
          file: filePath,
          title: assertion.title || 'Unknown test',
          failureMessages: assertion.failureMessages || []
        });
        break;
      case 'skipped': state.skippedTests++; pkgStats.skipped++; break;
    }
  });

  // Длительность пакета
  const duration = testResult.assertionResults?.reduce((sum, a) => sum + (a.duration || 0), 0) || 0;
  pkgStats.duration += duration;
}

// Финализирует результаты
function finalizeResults({ totalTests, passedTests, failedTests, skippedTests, packageResults, failingTestDetails }) {
  return {
    totalTests, passedTests, failedTests, skippedTests, packageResults, failingTestDetails,
    passRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0'
  };
}

// Валидация формата Vitest JSON
function isValidVitestJson(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.testResults)
  );
}

// Парсит результаты тестов из JSON файла Vitest (единственный источник истины)
function parseVitestJsonResults(outputFile = null, reportDir = 'reports') {
  // Если outputFile не указан, ищем стандартные пути
  const resultsDir = path.join(ROOT, reportDir);
  const resultFiles = [];

  if (outputFile && fs.existsSync(path.join(ROOT, outputFile))) {
    resultFiles.push(path.join(ROOT, outputFile));
  } else {
    // Приоритет: results.json > results.attempt-* > results.final.json > остальные results*.json
    const mainResultFile = path.join(resultsDir, "results.json");
    if (fs.existsSync(mainResultFile)) {
      resultFiles.push(mainResultFile);
    } else {
      try {
        const files = fs.readdirSync(resultsDir)
          .filter(file => file.startsWith('results') && file.endsWith('.json'))
          .map(file => ({ file, mtime: fs.statSync(path.join(resultsDir, file)).mtime.getTime() }))
          .sort((a, b) => b.mtime - a.mtime);

        // Если основного файла нет, ищем последний attempt
        const attempt = files.find(f => f.file.startsWith('results.attempt-'));
        if (attempt) {
          resultFiles.push(path.join(resultsDir, attempt.file));
        } else if (fs.existsSync(path.join(resultsDir, "results.final.json"))) {
          // Последний шанс - final файл
          resultFiles.push(path.join(resultsDir, "results.final.json"));
        }

        // Добавляем остальные результаты (results*.json) как дополнительный источник
        for (const entry of files) {
          const fullPath = path.join(resultsDir, entry.file);
          if (!resultFiles.includes(fullPath)) {
            resultFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Игнорируем ошибки чтения директории
      }
    }
  }

  if (resultFiles.length === 0) {
    return null;
  }

  try {
    const state = {
      totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0,
      packageResults: new Map(), seenTests: new Set(), failingTestDetails: []
    };

    // Агрегируем результаты из всех файлов
    for (const resultFile of resultFiles) {
      if (fs.existsSync(resultFile)) {
        const results = JSON.parse(fs.readFileSync(resultFile, 'utf8'));

        // Валидируем формат JSON перед обработкой
        if (!isValidVitestJson(results)) {
          console.warn(`⚠️ Некорректный формат JSON репортера Vitest в файле: ${path.relative(ROOT, resultFile)}`);
          continue; // Пропускаем файл с некорректным форматом
        }

        results.testResults?.forEach(testResult => aggregateTestResult(testResult, state));
      }
    }

    return finalizeResults(state);
  } catch (error) {
    console.warn(`Ошибка разбора результатов тестов: ${error.message}`);
    return null;
  }
}

// Единая функция для построения аргументов Vitest и переменных окружения
function buildVitestArgs(configPath, environment, normalizedPaths = [], opts, coverageEnabled, reporterConfig) {
  const testArgs = ["run", "--config", configPath];
  const env = {
    ...process.env,
    ...(coverageEnabled ? { COVERAGE: "true" } : {})
  }; // Клонируем и добавляем coverage если нужно

  if (coverageEnabled) testArgs.push("--coverage");
  if (opts.bail) testArgs.push("--bail");
  if (opts.retry !== "0") testArgs.push("--retry", opts.retry);

  // Vitest 4.x: управляем потоками через env (устранение флаки в CI JSON reporter)
  if (CI_MODE || opts.runInBand || opts.debug) {
    env.VITEST_MAX_THREADS = '1';
    env.VITEST_MIN_THREADS = '1';
    testArgs.push("--maxConcurrency", "1");
  }
  if (opts.watch) testArgs.push("--watch");
  if (opts.changed) testArgs.push("--changed");

  // Установить окружение
  if (environment) {
    testArgs.push("--environment", environment);
  }

  // Обработка параллелизма через переменные окружения (Vitest 4.x)
  if (opts.parallel) {
    if (opts.parallel === 'auto') {
      // Позволить Vitest решить (поведение по умолчанию)
      // Не устанавливаем переменные окружения
    } else if (opts.parallel === 'max') {
      env.VITEST_MAX_THREADS = '100';
    } else if (!isNaN(parseInt(opts.parallel))) {
      const threadCount = parseInt(opts.parallel);
      env.VITEST_MAX_THREADS = threadCount.toString();
    }
  }

  // Настроить репортер
  testArgs.push("--reporter", reporterConfig.reporter);

  // Создаем директорию для output файла, если он указан
  if (reporterConfig.outputFile) {
    const outputDir = path.dirname(path.join(ROOT, reporterConfig.outputFile));
    fs.mkdirSync(outputDir, { recursive: true });
    testArgs.push("--outputFile", reporterConfig.outputFile);
  }

  // Полностью полагаемся на exclude в config/vitest/vitest.config.ts
  // Не добавляем exclude в командную строку, чтобы избежать конфликтов

  // Добавить пути
  testArgs.push(...normalizedPaths);

  return { args: testArgs, env };
}

/* ================= РАЗРЕШЕНИЕ КОНФИГУРАЦИИ ================= */

async function runSingleTestType(testType, testEnvironment, coverageEnabled) {
  console.log(`\n🧪 Запуск ${testType.name}...`);
  console.log('═'.repeat(50));

  const result = await runVitestOnce({
    configPath: testType.config,
    environment: testEnvironment,
    paths: normalizedPaths,
    opts,
    coverageEnabled,
    testTypeName: testType.name
  });

  if (result.success) {
    console.log(`✅ ${testType.name} прошли (за ${result.duration.toFixed(1)}с)`);
    return true;
  } else {
    console.error(`${testType.name} не удались (за ${result.duration.toFixed(1)}с)`);
    return false;
  }
}

async function runAllTestTypes(globalSetup) {
  // Использовать те же конфиги, которые выбираются для отдельных типов тестов
  // Для unit тестов в режиме --all окружение определяется автоматически
  const unitProfileResult = resolveTestProfile([], { unit: true }); // Пустые пути = глобальный запуск
  if (!unitProfileResult.ok) {
    fatal(`Ошибка определения профиля unit тестов: ${unitProfileResult.error}`);
  }

  const testTypes = [
    { name: 'Unit тесты', config: CONFIGS.base, environment: unitProfileResult.profile.environment },
    { name: 'Интеграционные тесты', config: CONFIGS.packages, environment: 'node' },
    { name: 'AI тесты', config: CONFIGS.ai, environment: 'node' }
  ];

  const mode = CI_MODE ? 'CI' : 'локальный';
  const strategy = CI_MODE ? 'последовательное' : 'параллельное';
  const speedNote = CI_MODE ? 'для лучшей отладки' : 'для скорости';

  console.log(`\n🚀 Запуск всех типов тестов ${strategy} (${mode})...`);
  console.log(`${CI_MODE ? '📋' : '⚡'} Режим ${mode}: ${strategy} выполнение ${speedNote}`);

  const startTime = Date.now();
  let overallSuccess = true;

  // AI тесты пока не имеют кода для покрытия - отключаем coverage
  const getCoverageEnabled = (testType) => {
    return testType.name === 'AI тесты' ? false : globalSetup.coverageEnabled;
  };

  if (CI_MODE) {
    for (const testType of testTypes) {
      const coverageEnabled = getCoverageEnabled(testType);
      const success = await runSingleTestType(testType, testType.environment, coverageEnabled);
      if (!success) overallSuccess = false;
    }
  } else {
    const results = await Promise.all(
      testTypes.map(testType => {
        const coverageEnabled = getCoverageEnabled(testType);
        return runSingleTestType(testType, testType.environment, coverageEnabled);
      })
    );
    overallSuccess = results.every(success => success);
  }

  const endTime = Date.now();
  const totalDuration = ((endTime - startTime) / 1000).toFixed(1);

  // Выполняем пост-тестовые проверки (как в runTestsWithRetry)
  const { allChecksPassed: postChecksPassed } = await runPostTestChecks(totalDuration, globalSetup.reporter, globalSetup.reportDir);
  overallSuccess = overallSuccess && postChecksPassed;

  console.log('\n' + '='.repeat(50));
  if (overallSuccess) {
    console.log('🎉 Все типы тестов выполнены успешно!');
    process.exit(0);
  } else {
    console.log('❌ Некоторые типы тестов не удались');
    process.exit(1);
  }
}

// Определяет настройки покрытия
function determineCoverageEnabled(opts) {
  return !opts.debug && opts.coverage !== false;
}

// Определяет профиль тестов: тип, конфигурацию и окружение
// Возвращает результат вместо side-effects (throw, console.log)
function resolveTestProfile(paths, opts) {
  // Декларативные правила определения типа тестов
  const TEST_TYPE_RULES = [
    { type: 'ai', check: (paths) => checkGlobPattern(paths, '**/tests/integration/**/*.ai.test.{ts,tsx,js,jsx}') },
    { type: 'integration', check: (paths) => checkGlobPattern(paths, '**/tests/integration/**/*.{ts,tsx,js,jsx}') },
    { type: 'ui-unit', check: (paths) => checkContentPattern(paths, /@testing-library\/react|from\s+['"]react['"]/)},
    { type: 'package-unit', check: (paths) => checkPackageJson(paths) },
    { type: 'unit', check: () => true } // fallback
  ];

  // Определяем тип тестов на основе путей и паттернов файлов
  function detectTestType(localPaths) {
    if (!localPaths || localPaths.length === 0) return 'unit';

    for (const rule of TEST_TYPE_RULES) {
      if (rule.check(localPaths)) {
        return rule.type;
      }
    }

    return 'unit';
  }

  // Проверяет наличие файлов по glob паттерну
  function checkGlobPattern(localPaths, pattern) {
    return localPaths.some(p => {
      try {
        const dir = fs.statSync(p).isDirectory() ? p : path.dirname(p);
        const files = globSync(pattern, { cwd: dir, absolute: false });
        return files.length > 0;
      } catch {
        return false;
      }
    });
  }

  // Проверяет содержимое файлов на паттерн
  function checkContentPattern(localPaths, contentRegex) {
    return localPaths.some(p => {
      try {
        if (fs.statSync(p).isDirectory()) {
          const files = fs.readdirSync(p, { recursive: true });
          return files.some(f => {
            if (f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js')) {
              try {
                const content = fs.readFileSync(path.join(p === '.' ? '' : p, f), 'utf8');
                return contentRegex.test(content);
              } catch {
                return false;
              }
            }
            return false;
          });
        }
        if (p.endsWith('.ts') || p.endsWith('.js') || p.endsWith('.tsx') || p.endsWith('.jsx')) {
          const content = fs.readFileSync(p, 'utf8');
          return contentRegex.test(content);
        }
        return false;
      } catch {
        return false;
      }
    });
  }

  // Проверяет наличие package.json
  function checkPackageJson(localPaths) {
    return localPaths.some(p => {
      const fullPath = path.resolve(ROOT, p);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() &&
             fs.existsSync(path.join(fullPath, 'package.json'));
    });
  }

  // Автоматически определяем окружение для глобальных запусков
  function detectGlobalEnvironment() {
    try {
      // Проверяем наличие React/JSX файлов в проекте
      const reactFiles = globSync('**/*.{tsx,jsx}', {
        cwd: ROOT,
        absolute: false,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**']
      });

      // Если есть React файлы, используем jsdom
      if (reactFiles.length > 0) {
        return 'jsdom';
      }
    } catch {
      // Игнорируем ошибки, возвращаем default
    }

    // По умолчанию используем node
    return 'node';
  }

  // Маппинг конфигураций к окружениям
  const CONFIG_ENV_MAP = {
    packages: 'node',
    integration: 'node',
    ai: 'node',
    base: 'node'
  };

  // Получает окружение по пути конфигурации
  function getEnvByConfig(configPath) {
    return Object.entries(CONFIG_ENV_MAP)
      .find(([key]) => configPath.includes(key))?.[1];
  }

  const testType = detectTestType(paths);

  // --force-env имеет максимальный приоритет
  if (opts.forceEnv) {
    if (!['node', 'jsdom'].includes(opts.forceEnv)) {
      return { ok: false, error: `Недопустимое значение --force-env: ${opts.forceEnv}. Должно быть 'node' или 'jsdom'` };
    }
  }

  // Принудительно указанная конфигурация
  if (opts.config) {
    const cfg = CONFIGS[opts.config];
    if (!cfg) return { ok: false, error: `Неизвестная конфигурация: ${opts.config}` };

    // Приоритет: --force-env > --env > fallback по конфигу
    let env = opts.forceEnv || opts.env;
    if (!env) {
      env = getEnvByConfig(cfg);
    }

    return { ok: true, profile: { type: testType, configPath: cfg, environment: env } };
  }

  // Определяем конфигурацию на основе опций и типа тестов
  let configPath, baseEnvironment;

  if (opts.unit) {
    // Для unit тестов определяем конфигурацию на основе типа
    switch (testType) {
      case 'ai':
        configPath = CONFIGS.ai;
        baseEnvironment = 'node';
        break;
      case 'integration':
      case 'package-unit':
        configPath = CONFIGS.packages;
        baseEnvironment = paths.length === 0 ? 'node' : 'jsdom';
        break;
      case 'ui-unit':
        configPath = CONFIGS.base;
        baseEnvironment = 'jsdom';
        break;
      default:
        configPath = CONFIGS.base;
        // Для unit тестов используем jsdom по умолчанию (совместимость с React)
        // Для глобальных запусков определяем автоматически
        baseEnvironment = paths.length === 0 ? detectGlobalEnvironment() : 'jsdom';
        break;
    }
  } else if (opts.integration) {
    configPath = CONFIGS.packages;
    baseEnvironment = 'node';
  } else if (opts.ai) {
    configPath = CONFIGS.ai;
    baseEnvironment = 'node';
  } else if (opts.all) {
    // --all не использует обычную конфигурацию
    return null;
  } else {
    // Умный fallback на основе путей
    if (paths.length > 0) {
      switch (testType) {
        case 'ai':
          configPath = CONFIGS.ai;
          baseEnvironment = 'node';
          break;
        case 'integration':
          configPath = CONFIGS.packages;
          baseEnvironment = 'node';
          break;
        case 'ui-unit':
        case 'package-unit':
          // Для unit тестов используем основную конфигурацию, а не packages
          // Проверяем, являются ли пути unit тестами
          const isUnitTest = paths.some(p =>
            p.includes('/tests/unit/')
          );
          if (isUnitTest) {
            configPath = CONFIGS.base;
          } else {
            configPath = CONFIGS.packages;
          }
          baseEnvironment = 'jsdom';
          break;
        default:
          configPath = CONFIGS.base;
          baseEnvironment = 'node';
          break;
      }

      // Legacy fallback для обратной совместимости
      const hasIntegrationPatterns = paths.some(p =>
        p.includes('integration') || p.includes('e2e')
      );
      if (hasIntegrationPatterns) {
        configPath = CONFIGS.packages;
        baseEnvironment = 'node';
      }
    } else {
      configPath = CONFIGS.base;
      baseEnvironment = 'node';
    }
  }

  // Приоритет: --force-env > --env > baseEnvironment
  const environment = opts.forceEnv || opts.env || baseEnvironment;

  return { ok: true, profile: { type: testType, configPath, environment } };
}

// Находит все тестовые файлы в проекте (единственный источник истины)
function findAllTestFiles() {
  return globSync('**/*.test.{ts,tsx,js,jsx,mjs}', {
    cwd: ROOT,
    absolute: true,
    ignore: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'coverage/**',
      '**/e2e/**',
      'e2e/**',
      'config/playwright/**',
      '**/.pnpm-store/**',
      '**/.pnpm/**'
    ]
  });
}

// Запускает Vitest один раз с заданными параметрами
async function runVitestOnce({ configPath, environment, paths, opts, coverageEnabled, testTypeName = null }) {
  return new Promise((resolve) => {
    try {
      // Очищаем директории coverage перед запуском
      if (coverageEnabled && !coverageCleaned) {
        fs.rmSync(path.join(ROOT, "coverage"), { recursive: true, force: true });
        coverageCleaned = true;
      }

      // Строим аргументы для Vitest
      const reporterConfig = resolveReporterConfig(opts.reporter || 'default', testTypeName, opts.reportDir);
      const { args: testArgs, env } = buildVitestArgs(configPath, environment, paths, opts, coverageEnabled, reporterConfig);

      // Запускаем тесты
      const startTime = Date.now();
      const child = spawn("pnpm", ["exec", "vitest", ...testArgs], {
        stdio: "inherit",
        shell: false,
        env,
      });

      child.on('close', async (code) => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

      // Ждем завершения записи coverage отчетов
      let coverageFilePath = null;
      if (coverageEnabled) {
        coverageFilePath = await waitForCoverageFile(60000);
        if (coverageFilePath) {
          console.log(`📑 Coverage report detected at: ${path.relative(ROOT, coverageFilePath)}`);
        } else {
          console.warn("⚠️ Coverage report not detected after 60s timeout (searched for **/coverage-final.json)");
        }
      }

        resolve({
          success: code === 0,
          duration: duration,
          exitCode: code,
          signal: child.signal
        });
      });

      child.on('error', (error) => {
        console.error(`💥 Ошибка запуска тестов:`, error.message);
        resolve({
          success: false,
          duration: 0,
          exitCode: 1,
          signal: null,
          error: error.message
        });
      });

    } catch (error) {
      console.error(`💥 Ошибка запуска тестов:`, error.message);
      resolve({
        success: false,
        duration: 0,
        exitCode: 1,
        signal: null,
        error: error.message
      });
    }
  });
}

// Определяет политику покрытия на основе пути конфигурации
function resolveCoveragePolicy(configPath) {
  // Базовая политика для unit тестов
  let policy = {
    thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    description: 'standard'
  };

  if (configPath.includes('packages') || configPath.includes('integration')) {
    // Для packages и integration конфигураций - повышенные требования
    policy = {
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 80 },
      description: 'strict'
    };
  } else if (configPath.includes('ai')) {
    // AI тесты имеют повышенные требования для качества
    policy = {
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 80 },
      description: 'strict'
    };
  }

  return policy;
}

// Вычисляет разницу покрытия между текущей и базовой веткой
async function getCoverageDiff(baseBranch = 'main') {
  try {
    // Получаем текущее покрытие
    const currentCoveragePath = path.join(ROOT, "coverage", "coverage-final.json");
    if (!fs.existsSync(currentCoveragePath)) {
      return null;
    }

    const currentCoverage = JSON.parse(fs.readFileSync(currentCoveragePath, 'utf8'));
    const currentTotal = currentCoverage.total || {};

    // Пытаемся получить покрытие из базовой ветки
    // Это упрощенная версия - в реальности нужно сохранять покрытие из предыдущих запусков
    const baseCoveragePath = path.join(ROOT, "coverage", `coverage-${baseBranch}.json`);

    if (!fs.existsSync(baseCoveragePath)) {
      console.log(`ℹ️  Покрытие базовой ветки не найдено в ${baseCoveragePath}`);
      console.log(`💡 Для включения diff покрытия, сохраните покрытие из ветки ${baseBranch}`);
      return null;
    }

    const baseCoverage = JSON.parse(fs.readFileSync(baseCoveragePath, 'utf8'));
    const baseTotal = baseCoverage.total || {};

    const diff = {
      lines: (currentTotal.lines?.pct || 0) - (baseTotal.lines?.pct || 0),
      functions: (currentTotal.functions?.pct || 0) - (baseTotal.functions?.pct || 0),
      branches: (currentTotal.branches?.pct || 0) - (baseTotal.branches?.pct || 0),
      statements: (currentTotal.statements?.pct || 0) - (baseTotal.statements?.pct || 0)
    };

    return diff;
  } catch (error) {
    console.warn(`Ошибка вычисления разницы покрытия: ${error.message}`);
    return null;
  }
}

// Загружает пороги из конфигурационного файла Vitest
function loadThresholdsFromConfig(configPath) {
  try {
    // Получаем базовую политику покрытия для этого типа конфигурации
    const policy = resolveCoveragePolicy(configPath);
    let thresholds = policy.thresholds;

    if (policy.description === 'strict') {
      // Для strict политик пытаемся загрузить из файла
      try {
        // Импортируем конфиг и извлекаем пороги
        // Примечание: Это упрощенная версия, в реальности может потребоваться более сложная логика
        const configContent = fs.readFileSync(configPath, 'utf8');

        // Ищем STRICT_QUALITY_CONTRACT в файле
        const strictMatch = configContent.match(/STRICT_QUALITY_CONTRACT\s*=\s*({[\s\S]*?});/);
        if (strictMatch) {
          // Используем повышенные требования для качества
          thresholds = { lines: 85, functions: 85, branches: 85, statements: 80 };
        }
      } catch (error) {
        console.warn(`Не удалось загрузить пороги из конфига, используем значения по умолчанию: ${error.message}`);
      }
    }

    return thresholds;
  } catch (error) {
    console.warn(`Ошибка загрузки порогов, используем повышенные значения по умолчанию: ${error.message}`);
    return { lines: 85, functions: 85, branches: 85, statements: 80 };
  }
}

// Объединенная функция для определения полной конфигурации тестов
function resolveTestSetup() {
  // Проверяем что normalizedPaths и opts определены
  if (!normalizedPaths || !opts) {
    fatal('Критическая ошибка: normalizedPaths или opts не определены');
  }

  // Режим --all: конфигурация определяется в resolveTestSetupForAll/runAllTestTypes
  if (opts.all) {
    return null;
  }

  // Получаем профиль тестов через единую функцию
  const profileResult = resolveTestProfile(normalizedPaths, opts);
  if (!profileResult || !profileResult.ok) {
    fatal(`Ошибка определения профиля тестов: ${profileResult?.error || 'profileResult is null/undefined'}`);
  }

  // Вычисляем настройки покрытия
  const coverageEnabled = determineCoverageEnabled(opts);

  return {
    configPath: profileResult.profile.configPath,
    environment: profileResult.profile.environment,
    coverageEnabled,
    reporter: opts.reporter || 'default',
    reportDir: opts.reportDir || 'reports'
  };
}

// Функция для определения глобальных настроек в режиме --all
function resolveTestSetupForAll() {
  // Вычисляем настройки покрытия
  const coverageEnabled = determineCoverageEnabled(opts);

  return {
    coverageEnabled,
    reporter: opts.reporter || 'default',
    reportDir: opts.reportDir || 'reports'
  };
}

const testSetup = resolveTestSetup();
if (!testSetup) {
  // Режим --all: запустить все типы тестов последовательно/параллельно
  // Но нам все равно нужны глобальные настройки для пост-обработки
  const globalTestSetup = resolveTestSetupForAll();
  coverageEnabled = globalTestSetup.coverageEnabled;
  reporter = globalTestSetup.reporter;
  reportDir = globalTestSetup.reportDir;
  await runAllTestTypes(globalTestSetup).catch((error) => {
    fatal('Критическая ошибка в runAllTestTypes', error);
  });
  process.exit(0);
}
({ configPath, environment, coverageEnabled, reporter, reportDir } = testSetup);
if (!fs.existsSync(configPath)) {
  throw new Error(`Конфигурация Vitest не найдена: ${configPath}`);
}

/* ================= ВАЛИДАЦИЯ ПУТЕЙ ================= */

// Предикаты для проверки путей
function isSystem(p) { return ['.pnpm', '.pnpm-store', 'node_modules'].some(x => p.includes(x)); }
function isForbidden(p) { return ['e2e/', 'playwright', 'config/playwright'].some(x => p.includes(x)); }
function isValidTest(p) { return /\.test\.(ts|tsx|js|jsx|mjs)$/.test(p); }

// Проверяет наличие тестовых файлов в директории
function hasTestFiles(dirPath) {
  try {
    const files = fs.readdirSync(dirPath, { recursive: true });
    return files.some(file => {
      const filePath = path.join(dirPath, file.toString());
      return isValidTest(filePath);
    });
  } catch (error) {
    console.warn(`Невозможно прочитать директорию: ${dirPath} (${error.message})`);
    return false;
  }
}

// Валидирует и нормализует пути, фильтруя только тестовые файлы
function validateAndNormalizePaths() {
  if (paths.length === 0) return [];

  const normalizedPaths = [];
  const filteredPaths = [];

  for (const p of paths) {
    if (isSystem(p)) {
      console.log(`⏭️  Пропускаем системный путь: ${p}`);
      continue;
    }

    if (isForbidden(p)) {
      filteredPaths.push(p);
      console.log(`🚫 Отфильтрован запрещенный путь: ${p}`);
      continue;
    }

    const fullPath = path.resolve(ROOT, p);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Путь не существует: ${p} (${fullPath})`);
    }

    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      if (isValidTest(fullPath)) {
        normalizedPaths.push(path.relative(ROOT, fullPath));
      } else {
        filteredPaths.push(p);
        console.warn(`Отфильтрован не-тестовый файл: ${p}`);
      }
    } else if (stat.isDirectory()) {
      if (hasTestFiles(fullPath)) {
        normalizedPaths.push(path.relative(ROOT, fullPath));
      } else {
        filteredPaths.push(p);
        console.warn(`Директория не содержит тестовых файлов: ${p}`);
      }
    } else {
      filteredPaths.push(p);
      console.warn(`Неподдерживаемый тип пути: ${p}`);
    }
  }

  if (filteredPaths.length > 0) {
    console.log(`📋 Отфильтровано ${filteredPaths.length} недопустимых путей, продолжаем с ${normalizedPaths.length} допустимыми путями`);
  }

  return normalizedPaths;
}

/* ================= ЛОГИРОВАНИЕ ================= */

console.log("🚀 LivAI Vitest Runner");
console.log("====================================");
console.log("📋 Режим:", CI_MODE ? "CI" : "Локальный");
console.log("⚙️  Конфиг:", path.relative(ROOT, configPath));
console.log("📊 Coverage:", coverageEnabled ? "enabled" : "disabled");
console.log("📝 Репортер:", reporter);
console.log("🌍 Окружение:", environment || "авто");
console.log("🎯 Пути:", paths.length ? paths.map(p => path.relative(ROOT, p)).join(", ") : "Весь проект");
if (opts.debug) console.log("🐛 Режим отладки: включен");
if (opts.strict) console.log("🎯 Строгий режим: включен");
console.log("====================================");

/* ================= DRY RUN ================= */

// DEBUG: Логируем что передаем Vitest
if (opts.debug) {
  const reporterConfig = resolveReporterConfig(reporter);
  const { args: debugArgs, env: debugEnv } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporterConfig);
  console.log('🔧 Vitest args:', debugArgs);
  console.log('📂 Normalized paths:', normalizedPaths);
  console.log('🔍 Всего тестов для запуска:', normalizedPaths.length);
  // Не логируем "сырые" env во избежание утечек; выводим только безопасные флаги
  console.log('🌍 Execution flags:', {
    coverage: coverageEnabled ? 'enabled' : 'disabled',
    vitestThreads: {
      max: debugEnv.VITEST_MAX_THREADS ? 'custom' : 'default',
      min: debugEnv.VITEST_MIN_THREADS ? 'custom' : 'default',
    },
  });
}

if (opts.summary) {
  showTestSummary();
  process.exit(0);
}

if (opts.dryRun) {
  console.log("\n🧪 РЕЖИМ DRY RUN");
  console.log("📝 Команда для выполнения:");
  const reporterConfig = resolveReporterConfig(reporter);
  const { args: dryRunArgs } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporterConfig);
  console.log(`pnpm exec vitest ${dryRunArgs.join(" ")}`);
  console.log("🔧 Значение опции parallel:", opts.parallel);

  console.log("\n🔍 Обнаружение тестов:");
  try {
    // Используем единую функцию для поиска всех тестовых файлов
    const testFiles = findAllTestFiles();

    if (testFiles.length > 0) {
      console.log("📁 Найденные тестовые файлы:");
      testFiles.slice(0, 20).forEach(file => console.log(`  • ${path.relative(ROOT, file)}`));
      if (testFiles.length > 20) console.log(`  ... и ещё ${testFiles.length - 20} файлов`);
      console.log(`📊 Всего найдено: ${testFiles.length} тестовых файлов`);

      // Проверка на запрещенные файлы (e2e и playwright в .test файлах)
      const forbiddenFiles = testFiles.filter(f => f.includes('/e2e/') || f.includes('/playwright/'));
      if (forbiddenFiles.length > 0) {
        console.log("⚠️  ВНИМАНИЕ: Найдены запрещенные файлы:");
        forbiddenFiles.forEach(file => console.log(`  ❌ ${path.relative(ROOT, file)}`));
      }
    } else {
      console.log("⚠️  Тестовые файлы не найдены");
    }
  } catch (error) {
    console.warn(`Не удалось обнаружить тестовые файлы: ${error.message}`);
  }

  console.log("\n⚙️  Конфигурация:");
  console.log(`  • Файл конфигурации: ${path.relative(ROOT, configPath)}`);
  console.log(`  • Окружение: ${environment || 'авто'}`);
  console.log(`  • Покрытие: ${coverageEnabled ? 'включено' : 'отключено'}`);
  console.log(`  • Потоки: ${opts.runInBand || opts.debug ? 'отключены' : 'включены'}`);
  console.log(`  • Репортер: ${reporter}`);
  if (opts.parallel && opts.parallel !== 'auto') {
    console.log(`  • Параллелизм: ${opts.parallel} потоков`);
  }

  process.exit(0);
}

/* ================= ОЧИСТКА ================= */

// очистка coverage и cache перед CI (только в начале, не перед проверкой отчетов)
if (CI_MODE) {
  fs.rmSync(path.join(ROOT, "node_modules/.vitest"), { recursive: true, force: true });
}

/* ================= ПОРОГИ ПОКРЫТИЯ ================= */

async function checkCoverageThresholds() {
  if (!coverageEnabled) return { enabled: false, reportFound: false, thresholdsStatus: 'not_applicable' };

  const coverageJsonPath = locateCoverageFile();
  if (!coverageJsonPath || !fs.existsSync(coverageJsonPath)) {
    console.warn("⚠️ Coverage report not found; skipping threshold checks. Vitest may not have produced coverage-final.json.");
    return { enabled: true, reportFound: false, thresholdsStatus: 'skipped' };
  }

  try {
    const coverage = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
    const total = coverage.total || {};

    // Если отчет пустой (нет строк/функций/веток), пропускаем проверку порогов
    const noData =
      (total.lines?.total ?? 0) === 0 &&
      (total.functions?.total ?? 0) === 0 &&
      (total.branches?.total ?? 0) === 0 &&
      (total.statements?.total ?? 0) === 0;
    if (noData) {
      console.warn("⚠️ Coverage report is empty; skipping threshold checks.");
      return { enabled: true, reportFound: true, thresholdsStatus: 'skipped' };
    }

    // Динамическая загрузка порогов из конфигурационного файла
    const thresholds = loadThresholdsFromConfig(configPath || CONFIGS.base);

    console.log("\n📊 Проверка порогов покрытия:");
    console.log(`   Требуется: ${thresholds.lines}% строк, ${thresholds.functions}% функций, ${thresholds.branches}% ветвей, ${thresholds.statements}% выражений`);

    const results = {
      lines: (total.lines?.pct || 0) >= thresholds.lines,
      functions: (total.functions?.pct || 0) >= thresholds.functions,
      branches: (total.branches?.pct || 0) >= thresholds.branches,
      statements: (total.statements?.pct || 0) >= thresholds.statements,
    };

    const allPassed = Object.values(results).every(Boolean);

    if (allPassed) {
      console.log("✅ Все пороги покрытия достигнуты!");
    } else {
      const message = CI_MODE ? "❌ Пороги покрытия не достигнуты:" : "⚠️  Пороги покрытия не достигнуты (локальная разработка):";
      console.log(message);
      if (!results.lines) console.log(`   • Строки: ${(total.lines?.pct || 0).toFixed(1)}% < ${thresholds.lines}%`);
      if (!results.functions) console.log(`   • Функции: ${(total.functions?.pct || 0).toFixed(1)}% < ${thresholds.functions}%`);
      if (!results.branches) console.log(`   • Ветви: ${(total.branches?.pct || 0).toFixed(1)}% < ${thresholds.branches}%`);
      if (!results.statements) console.log(`   • Выражения: ${(total.statements?.pct || 0).toFixed(1)}% < ${thresholds.statements}%`);

      if (!CI_MODE) {
        console.log("ℹ️  Пороги применяются только в CI режиме");
      }
    }

    // Показать разницу покрытия, если запрошено
    if (opts.coverageDiff) {
      const diff = await getCoverageDiff(opts.coverageDiff);
      if (diff) {
        console.log("\n📊 Разница покрытия vs " + opts.coverageDiff + ":");
        console.log(`   • Строки: ${diff.lines >= 0 ? '+' : ''}${diff.lines.toFixed(1)}%`);
        console.log(`   • Функции: ${diff.functions >= 0 ? '+' : ''}${diff.functions.toFixed(1)}%`);
        console.log(`   • Ветви: ${diff.branches >= 0 ? '+' : ''}${diff.branches.toFixed(1)}%`);
        console.log(`   • Выражения: ${diff.statements >= 0 ? '+' : ''}${diff.statements.toFixed(1)}%`);

        // Предупредить при значительном снижении покрытия
        const significantDecrease = diff.lines < -5 || diff.functions < -5;
        if (significantDecrease) {
          console.log("⚠️  Обнаружено значительное снижение покрытия!");
        }
      }
    }

    return {
      enabled: true,
      reportFound: true,
      thresholdsStatus: CI_MODE ? (allPassed ? 'passed' : 'failed') : 'checked'
    };
  } catch (error) {
    console.log("⚠️  Ошибка проверки порогов покрытия:", error.message);
    return {
      enabled: true,
      reportFound: false,
      thresholdsStatus: 'error'
    };
  }
}

// Show coverage report location and status
function showCoverageReport(coverageStatus) {
  const { enabled, reportFound, thresholdsStatus } = coverageStatus;

  if (!enabled) {
    console.log(`\n📊 Coverage: disabled`);
    console.log(`📊 Coverage thresholds: not applicable`);
    return;
  }

  console.log(`\n📊 Coverage: enabled`);
  console.log(`📊 Coverage report: ${reportFound ? 'found' : 'missing'}`);

  // Правильный статус thresholds
  const statusMap = {
    passed: 'passed',
    failed: 'failed',
    checked: 'checked (local mode)',
    skipped: 'skipped (no coverage report)',
    error: 'error (parsing failed)'
  };
  const thresholdsDisplay = statusMap[thresholdsStatus] || 'unknown';
  console.log(`📊 Coverage thresholds: ${thresholdsDisplay}`);

  if (!reportFound) {
    return; // Нет отчета, не показываем пути
  }

  const htmlReportPath = path.join(ROOT, "coverage", "index.html");
  const lcovReportPath = path.join(ROOT, "coverage", "lcov-report", "index.html");

  if (fs.existsSync(htmlReportPath)) {
    console.log(`📊 HTML отчет покрытия: file://${htmlReportPath}`);
    console.log(`💡 Открыть в браузере: pnpm run test:coverage:open`);
  }

  if (fs.existsSync(lcovReportPath)) {
    console.log(`📊 LCOV отчет покрытия: file://${lcovReportPath}`);
  }

  const jsonReportPath = path.join(ROOT, "coverage", "coverage-final.json");
  if (fs.existsSync(jsonReportPath)) {
    console.log(`📄 JSON данные покрытия: ${path.relative(ROOT, jsonReportPath)}`);
  }
}

/* ================= УТИЛИТАРНЫЕ ФУНКЦИИ ================= */

// Определяет название пакета по относительному пути
function getPackageFromPath(relativePath) {

  // Проверить apps/
  if (relativePath.startsWith('apps/')) {
    const parts = relativePath.split('/');
    return parts.length >= 2 ? `apps/${parts[1]}` : 'apps';
  }

  // Проверить packages/
  if (relativePath.startsWith('packages/')) {
    const parts = relativePath.split('/');
    return parts.length >= 2 ? `packages/${parts[1]}` : 'packages';
  }

  // Проверить tools/
  if (relativePath.startsWith('tools/')) {
    const parts = relativePath.split('/');
    return parts.length >= 2 ? `tools/${parts[1]}` : 'tools';
  }

  // Для корневых тестов или других директорий
  return 'root';
}

// Генерирует стандартизированный JSON отчет для CI dashboard
function generateCIDashboardReport(parsedResults, totalDuration) {
  try {
    const reportPath = path.join(ROOT, 'test-results', 'ci-dashboard-report.json');

    const report = {
      timestamp: new Date().toISOString(),
      runId: process.env['GITHUB_RUN_ID'] || process.env['CI_BUILD_ID'] || `local-${Date.now()}`,
      environment: {
        ci: CI_MODE,
        nodeVersion: process.version,
        platform: process.platform,
        branch: process.env['GITHUB_HEAD_REF'] || process.env['GIT_BRANCH'] || 'unknown',
        commit: process.env['GITHUB_SHA'] || 'unknown'
      },
      summary: {
        duration: totalDuration * 1000, // в миллисекундах
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      packages: []
    };

    // Заполнить summary
    for (const stats of parsedResults.packageResults.values()) {
      report.summary.tests += stats.total;
      report.summary.passed += stats.passed;
      report.summary.failed += stats.failed;
      report.summary.skipped += stats.skipped;
    }

    // Заполнить packages
    for (const [packageName, stats] of parsedResults.packageResults) {
      report.packages.push({
        name: packageName,
        duration: stats.duration,
        tests: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        status: stats.failed > 0 ? 'failed' : stats.skipped > 0 ? 'partial' : 'passed'
      });
    }

    // Сортировать пакеты по имени для консистентности
    report.packages.sort((a, b) => a.name.localeCompare(b.name));

    // Записать отчет
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 CI Dashboard отчет сгенерирован: ${path.relative(ROOT, reportPath)}`);

  } catch (error) {
    console.warn(`Ошибка генерации CI dashboard отчета: ${error.message}`);
  }
}

/* ================= СТАТИСТИКА ТЕСТОВ ================= */

function showTestSummary() {
  console.log("📊 Статистика тестов LivAI:");
  console.log("═".repeat(50));

  try {
    // Найти все тестовые файлы (только .test файлы, runner не поддерживает .spec)
    const allTestFiles = findAllTestFiles();

    // Классифицировать файлы по типам
    const stats = {
      unit: { files: 0, lines: 0 },
      integration: { files: 0, lines: 0 },
      ai: { files: 0, lines: 0 },
      e2e: { files: 0, lines: 0 },
      total: { files: 0, lines: 0 }
    };

    for (const file of allTestFiles) {
      const relativePath = path.relative(ROOT, file);
      stats.total.files++;

      // Подсчитать строки кода
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').length;
        stats.total.lines += lines;

        // Классифицировать по типу
        if (relativePath.includes('/tests/integration/') || relativePath.includes('.integration.')) {
          stats.integration.files++;
          stats.integration.lines += lines;
        } else if (relativePath.includes('/tests/ai/') || relativePath.includes('.ai.')) {
          stats.ai.files++;
          stats.ai.lines += lines;
        } else if (relativePath.includes('/e2e/') || relativePath.includes('/tests/e2e/')) {
          stats.e2e.files++;
          stats.e2e.lines += lines;
        } else {
          stats.unit.files++;
          stats.unit.lines += lines;
        }
      } catch (error) {
        // Пропустить файлы которые нельзя прочитать
        continue;
      }
    }

    // Показать статистику
    console.log(`   • Unit тесты: ${stats.unit.files} файлов (${stats.unit.lines.toLocaleString()} строк)`);
    console.log(`   • Интеграционные тесты: ${stats.integration.files} файлов (${stats.integration.lines.toLocaleString()} строк)`);
    console.log(`   • AI тесты: ${stats.ai.files} файлов (${stats.ai.lines.toLocaleString()} строк)`);
    console.log(`   • E2E тесты: ${stats.e2e.files} файлов (${stats.e2e.lines.toLocaleString()} строк)`);
    console.log(`   • Всего: ${stats.total.files} файлов, ${stats.total.lines.toLocaleString()} строк тестов`);

    // Показать цели покрытия
    console.log("\n🎯 Цели покрытия (по типу пакета):");
    console.log("   • Core пакеты: 85-95% (строки/функции/ветви)");
    console.log("   • Feature пакеты: 75-85% (строки/функции/ветви)");
    console.log("   • UI пакеты: 65-75% (строки/функции/ветви)");
    console.log("   • AI пакеты: 65-75% (строки/функции/ветви)");

  } catch (error) {
    console.error(`❌ Ошибка генерации статистики тестов: ${error.message}`);
  }
}

/* ================= ПРОВЕРКА .ONLY/.SKIP ================= */

// Анализ файла с помощью TypeScript AST для поиска запрещенных модификаторов
function analyzeFileForForbiddenTests(filePath) {
  try {
    const source = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true
    );

    const offenders = { only: [], skip: [] };

    function visit(node) {
      if (ts.isPropertyAccessExpression(node)) {
        const name = node.name.getText();
        if (name === "only" || name === "skip") {
          const expression = node.expression.getText();
          if (["it", "test", "describe"].includes(expression)) {
            // Получить позицию в файле
            const { line } = ts.getLineAndCharacterOfPosition(source, node.getStart());
            offenders[name].push(`${path.relative(ROOT, filePath)}:${line + 1}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
    return offenders;
  } catch (error) {
    // В случае ошибки парсинга, возвращаем пустой результат
    console.warn(`Не удалось проанализировать файл ${path.relative(ROOT, filePath)}: ${error.message}`);
    return { only: [], skip: [] };
  }
}

function checkForbiddenTests() {
  if (!opts.strict && !CI_MODE) return true;

  try {
    // Найти все поддерживаемые тестовые файлы в проекте (только .test, runner не поддерживает .spec)
    const testFiles = findAllTestFiles();

    const offenders = { only: [], skip: [] };

    // Проанализировать каждый файл с помощью AST
    for (const file of testFiles) {
      const fileOffenders = analyzeFileForForbiddenTests(file);
      offenders.only.push(...fileOffenders.only);
      offenders.skip.push(...fileOffenders.skip);
    }

    const hasOffenders = offenders.only.length > 0 || offenders.skip.length > 0;

    if (hasOffenders) {
      if (CI_MODE) {
        console.error(`❌ Найдены запрещенные модификаторы тестов в CI:`);
        if (offenders.only.length > 0) {
          console.error(`   • .only в: ${offenders.only.slice(0, 10).join(', ')}${offenders.only.length > 10 ? ` (+ещё ${offenders.only.length - 10})` : ''}`);
        }
        if (offenders.skip.length > 0) {
          console.error(`   • .skip в: ${offenders.skip.slice(0, 10).join(', ')}${offenders.skip.length > 10 ? ` (+ещё ${offenders.skip.length - 10})` : ''}`);
        }
        console.error("Удалите вызовы .only/.skip перед коммитом");
        return false;
      } else {
        console.warn(`⚠️  Найдены запрещенные модификаторы тестов:`);
        if (offenders.only.length > 0) {
          console.warn(`   • .only в: ${offenders.only.slice(0, 5).join(', ')}${offenders.only.length > 5 ? ` (+ещё ${offenders.only.length - 5})` : ''}`);
        }
        if (offenders.skip.length > 0) {
          console.warn(`   • .skip в: ${offenders.skip.slice(0, 5).join(', ')}${offenders.skip.length > 5 ? ` (+ещё ${offenders.skip.length - 5})` : ''}`);
        }
        console.warn("Рассмотрите возможность удаления перед коммитом");
      }
    }
  } catch (error) {
    console.warn(`Ошибка проверки запрещенных тестов: ${error.message}`);
  }

  return true;
}

// Выполняет пост-тестовые проверки (coverage, forbidden tests, CI dashboard)
async function runPostTestChecks(duration, reporter, reportDir = 'reports') {
    // Парсим результаты текущего запуска один раз
    const parsedResults = parseVitestJsonResults(null, reportDir);

    // Повторные проверки после запуска
    let allChecksPassed = true;

    // Проверить запрещенные тесты (только в локальном режиме, в CI проверяем до запуска)
    if (!CI_MODE && !checkForbiddenTests()) {
      allChecksPassed = false;
    }

    // Проверить пороги покрытия
    const coverageStatus = await checkCoverageThresholds();
    if (coverageStatus.thresholdsStatus === 'failed') {
      allChecksPassed = false;
    }

    // Показать отчеты о покрытии
    showCoverageReport(coverageStatus);

    // Показать сводку результатов с уже готовыми данными
    displayResultsSummary(duration, reporter, parsedResults, reportDir);

    return { allChecksPassed, results: parsedResults, coverageStatus };
}

// Показывает детали неудачных тестов
function showFailedTestsDetails(results) {
  if (!results || !results.failingTestDetails || results.failingTestDetails.length === 0) {
    console.log('\n📋 Детали неудачных тестов: нет данных');
    return;
  }

  console.log('\n📋 Детали неудачных тестов:');

  // Группируем по файлам для лучшей читаемости
  const byFile = new Map();

  for (const detail of results.failingTestDetails) {
    const file = detail.file;
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file).push(detail);
  }

  for (const [file, failures] of byFile) {
    console.log(`\n❌ ${path.relative(ROOT, file)}:`);
    for (const failure of failures) {
      console.log(`  • ${failure.title}`);
      if (failure.failureMessages && failure.failureMessages.length > 0) {
        for (const msg of failure.failureMessages) {
          // Показываем только первые несколько строк ошибки
          const lines = msg.split('\n').slice(0, 3);
          for (const line of lines) {
            console.log(`    ${line}`);
          }
          if (msg.split('\n').length > 3) {
            console.log('    ...');
          }
        }
      }
    }
  }
}

// Разбор и отображение сводки результатов
function displayResultsSummary(duration, reporter, parsedResults = null, reportDir = 'reports') {
  // Для junit и verbose репортеров не показываем сводку (они уже вывели результаты)
  if (reporter === "junit" || reporter === "verbose") {
    if (reporter === "junit") {
      console.log(`\n📊 Результаты записаны в JUnit XML формат`);
    } else {
      console.log(`\n📊 Verbose вывод завершен`);
    }
    return;
  }

  // Используем переданные результаты или парсим сами
  const results = parsedResults || parseVitestJsonResults(null, reportDir);

  if (!results) {
    console.log(`\n⚠️  Файлы результатов не найдены`);
    return;
  }

  const { totalTests, passedTests, failedTests, skippedTests, packageResults, failingTestDetails, passRate } = results;

  console.log("\n📈 Сводка результатов тестов:");
  console.log(`   • Всего: ${totalTests} тестов`);
  console.log(`   • Прошли: ${passedTests}`);
  console.log(`   • Не удались: ${failedTests}`);
  console.log(`   • Пропущены: ${skippedTests}`);
  console.log(`   • Длительность: ${duration}с`);
  console.log(`   • Процент прохождения: ${passRate}%`);

  // Показать разбивку по пакетам
  if (packageResults.size > 1) {
    console.log("\n📦 Результаты по пакетам:");
    for (const [packageName, stats] of packageResults) {
      const status = stats.failed > 0 ? '❌' : stats.skipped > 0 ? '⚠️' : '✅';
      const duration = (stats.duration / 1000).toFixed(1);
      console.log(`   ${status} ${packageName}: ${stats.total} тестов (${stats.passed} прошли, ${stats.failed} не удались, ${stats.skipped} пропущены) за ${duration}с`);
    }
  }

  // Записывать детальные отчеты в reports/test-logs/
  writeDetailedReports(packageResults, failedTests, failingTestDetails);

  // Генерировать стандартизированный JSON для CI dashboard (только в CI)
  if (CI_MODE) {
    generateCIDashboardReport(results, duration);
  }
}

/**
 * Записывает детальные отчеты об ошибках в reports/test-logs/
 */
function writeDetailedReports(packageResults, totalFailed, failingTestDetails) {
  const reportsDir = path.join(ROOT, 'reports', 'test-logs');

  // Создать директорию, если не существует
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Записать общее количество ошибок
  fs.writeFileSync(path.join(reportsDir, 'error_count.txt'), totalFailed.toString());
  fs.writeFileSync(path.join(reportsDir, 'final_errors.txt'), totalFailed.toString());

  // Записать детальный отчет о падающих тестах
  if (failingTestDetails && failingTestDetails.length > 0) {
    const detailedReport = failingTestDetails.map(detail =>
      `${detail.file}: ${detail.title}\n${detail.failureMessages?.join('\n') || 'No failure message'}`
    ).join('\n\n---\n\n');

    fs.writeFileSync(path.join(reportsDir, 'failing_tests.txt'), detailedReport);
  } else {
    // Fallback: собрать список пакетов с ошибками
    const failingTests = [];
    for (const [packageName, stats] of packageResults) {
      if (stats.failed > 0) {
        failingTests.push(`${packageName}: ${stats.failed} failed tests`);
      }
    }

    if (failingTests.length > 0) {
      fs.writeFileSync(path.join(reportsDir, 'failing_tests.txt'), failingTests.join('\n'));
    }
  }
}

/* ================= CORE API ================= */

// RunnerConfig: {configPath, environment, paths, coverageEnabled, reporter, reportDir}
// RunnerResult: {success, duration, coverageStatus, results}

// Архитектурный центр - платформенный API для запуска тестов
async function runRunner(config) {
  const { configPath, environment, paths, coverageEnabled, reporter, reportDir } = config;

  // Запускаем Vitest
  const result = await runVitestOnce({
    configPath,
    environment,
    paths,
    opts: { ...opts, reportDir }, // Передаем reportDir через opts
    coverageEnabled
  });

  // Выполняем пост-тестовые проверки
  const { allChecksPassed, coverageStatus, results } = await runPostTestChecks(
    result.duration.toFixed(1),
    reporter,
    reportDir
  );

  return {
    success: result.success && allChecksPassed,
    duration: result.duration,
    coverageStatus,
    results
  };
}

/* ================= ЗАПУСК ================= */

// Основная функция CLI - парсит аргументы и вызывает платформенный API
async function runCLI() {
  // В CI режиме проверяем запрещенные тесты ДО запуска
  if (CI_MODE) {
    console.log('🔍 Проверка на запрещенные модификаторы тестов (.only/.skip)...');
    if (!checkForbiddenTests()) {
      fatal('Найдены запрещенные модификаторы тестов. Исправьте перед коммитом.');
    }
  }

  console.log("\n▶️  Начало выполнения тестов...\n");

  // Вызываем платформенный API
  const result = await runRunner({
    configPath,
    environment,
    paths: normalizedPaths,
    coverageEnabled,
    reporter,
    reportDir
  });

  // Обрабатываем результат
  if (result.success) {
    console.log(`\n✅ Все тесты прошли успешно за ${result.duration.toFixed(1)}с`);
    process.exit(0);
  } else {
    console.log(`\n❌ Тесты не удались`);

    // Показываем детали неудачных тестов
    const testResults = parseVitestJsonResults(null, reportDir);
    if (testResults) {
      showFailedTestsDetails(testResults);
    }

    process.exit(1);
  }
}

// Запускаем CLI
await runCLI();
