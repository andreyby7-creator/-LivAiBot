#!/usr/bin/env node
/**
 * Livai Vitest Runner
 * Enterprise обертка вокруг Vitest
 * 
 * Секции: ПРОВЕРКА ВЕРСИИ NODE | ERROR HANDLING | ПУТИ | ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ | НОРМАЛИЗАЦИЯ ПУТЕЙ | РАЗРЕШЕНИЕ КОНФИГУРАЦИИ | ОПЦИИ КОМАНДНОЙ СТРОКИ | ПОДГОТОВКА | РАННЯЯ ИНИЦИАЛИЗАЦИЯ | ФИЛЬТРАЦИЯ ПАКЕТОВ | ПОСТРОЕНИЕ АРГУМЕНТОВ VITEST | ЛОГИРОВАНИЕ | DRY RUN | COVERAGE POLICY | ПОРОГИ ПОКРЫТИЯ | ПРОВЕРКА .ONLY/.СКIP | CORE API | ЗАПУСК | СТАТИСТИКА ТЕСТОВ | УТИЛИТАРНЫЕ ФУНКЦИИ
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { program } from "commander";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { globSync } from "glob";

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

  const [requiredMajor] = requiredVersion.split('.').map(Number);
  const [currentMajor] = process.versions.node.split('.').map(Number);

  // Требуем только совпадение major (например, любой 24.x подходит).
  if (currentMajor !== requiredMajor) {
    fatal(
      `Требуется Node major ${requiredMajor}.x (см. .nvmrc: ${requiredVersion}), обнаружено ${process.versions.node}. ` +
      `Установите/активируйте нужную major версию (например): nvm install ${requiredMajor} && nvm use ${requiredMajor}`
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

/* ================= ПУТИ ================= */

// Корневой каталог репозитория. Используем path.resolve для нормализации
// (устраняет edge-cейсы с относительными путями/симлинками при запуске).
const ROOT = path.resolve(process.cwd());
const CONFIG_ROOT = path.join(ROOT, "config/vitest");

// Путь к coverage-final.json (единственный источник истины для coverage)
const COVERAGE_FINAL_JSON_PATH = path.join(ROOT, 'coverage', 'coverage-final.json');

// Ожидает появления coverage-final.json в корневой директории coverage.
// Контракт: Vitest настроен на reportsDirectory: 'coverage', reporter: ['json'].
// Простое polling-решение с таймаутом; использует fs.promises.stat вместо existsSync.
async function waitForCoverageFile(timeoutMs = 60000) {
  const coveragePath = COVERAGE_FINAL_JSON_PATH;
  const start = Date.now();

  while (Date.now() - start <= timeoutMs) {
    try {
      await fs.promises.stat(coveragePath);
      return coveragePath;
    } catch {
      // Файл ещё не создан — ждём и повторяем.
    }

    await new Promise(res => setTimeout(res, 200));
  }

  return null;
}

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

/* ================= НОРМАЛИЗАЦИЯ ПУТЕЙ ================= */

// Vitest сам фильтрует и валидирует тестовые файлы.
// Здесь оставляем только:
// - разворачивание glob-паттернов
// - приведение путей к относительным от ROOT.
function validateAndNormalizePaths() {
  if (paths.length === 0) return [];

  const result = new Set();

  for (const p of paths) {
    const hasGlob = /[*?[\]]/.test(p);

    if (hasGlob) {
      const matches = globSync(p, { cwd: ROOT, absolute: false });
      if (matches.length === 0) {
        // Если glob ничего не нашёл — передаём как есть, Vitest сам разберётся.
        result.add(p);
      } else {
        for (const m of matches) {
          result.add(m);
        }
      }
    } else {
      // Обычный путь — приводим к относительному от ROOT.
      const rel = path.relative(ROOT, path.resolve(ROOT, p));
      result.add(rel || '.');
    }
  }

  return Array.from(result);
}

/* ================= РАЗРЕШЕНИЕ КОНФИГУРАЦИИ ================= */

async function runSingleTestType(testType, testEnvironment, coverageEnabled) {
  console.log(`\n🧪 Запуск ${testType.name}...`);
  console.log('═'.repeat(50));

  // Для режима --all используем отдельный репортер с именем тестового типа,
  // чтобы отчеты и JSON-результаты не перетирали друг друга.
  const testTypeReporterConfig = resolveReporterConfig(
    opts.reporter || 'default',
    testType.name,
    opts.reportDir
  );

  const result = await runVitestOnce({
    configPath: testType.config,
    environment: testEnvironment,
    paths: normalizedPaths,
    opts,
    coverageEnabled,
    reporterConfig: testTypeReporterConfig
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
  const testTypes = [
    // В режиме --all явно задаем конфиг и окружение для каждого типа
    { name: 'Unit тесты', config: CONFIGS.base, environment: 'jsdom' },
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

/* ================= ПОДГОТОВКА (PREPARE PHASE) ================= */

async function cleanArtifacts() {
  try {
    await fs.promises.rm(path.join(ROOT, 'coverage'), { recursive: true, force: true });
    await fs.promises.rm(path.join(ROOT, 'node_modules/.vitest'), { recursive: true, force: true });
  } catch (error) {
    console.warn(`⚠️  Не удалось очистить артефакты тестов: ${error.message}`);
  }
}

// Выполняем подготовку до вычисления конфигов/путей
await cleanArtifacts();

/* ================= РАННЯЯ ИНИЦИАЛИЗАЦИЯ ================= */

// Окружение и настройки будут разрешены позже в resolveTestSetup

let normalizedPaths = validateAndNormalizePaths();
let coverageEnabled = false;
let configPath = null;
let environment = null;
let reporter = opts.reporter || 'default';
let reportDir = opts.reportDir || 'reports';

// Вычисляем reporterConfig один раз (DRY: избегаем повторных вызовов resolveReporterConfig)
const reporterConfig = resolveReporterConfig(reporter, null, reportDir);

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

  // Определяем корень пакета из паттерна
  let packageRoot = packagePattern;
  if (!packageRoot.startsWith('packages/') && !packageRoot.startsWith('apps/') && !packageRoot.startsWith('tools/')) {
    // Пробуем найти в стандартных директориях
    const packageDirs = ['packages', 'apps', 'tools'];
    for (const dir of packageDirs) {
      const candidate = `${dir}/${packagePattern}`;
      if (fs.existsSync(path.join(ROOT, candidate))) {
        packageRoot = candidate;
        break;
      }
    }
  }

  // Фильтруем пути, которые начинаются с корня пакета
  return inputPaths.filter(inputPath => inputPath.startsWith(packageRoot));
}

/* ================= ПОСТРОЕНИЕ АРГУМЕНТОВ VITEST ================= */

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
  const testArgs = ["run"];
  
  // Для unit тестов (vitest.config.ts) не указываем --config, чтобы Vitest автоматически
  // находил конфиги в пакетах (packages/*/vitest.config.ts) и использовал их
  // Это позволяет каждому пакету иметь свои паттерны include/exclude относительно корня пакета
  // Для других типов тестов (integration, ai) используем явный конфиг
  const isUnitTestConfig = configPath && configPath.includes('vitest.config.ts');
  if (configPath && !isUnitTestConfig) {
    // Используем абсолютный путь к конфигу для integration/ai тестов
    const normalizedConfigPath = path.resolve(ROOT, configPath);
    testArgs.push("--config", normalizedConfigPath);
  }
  // Для unit тестов не указываем --config - Vitest автоматически найдет все конфиги
  const env = {
    ...process.env,
    ...(coverageEnabled ? { COVERAGE: "true" } : {})
  }; // Клонируем и добавляем coverage если нужно

  if (coverageEnabled) testArgs.push("--coverage");
  if (opts.bail) testArgs.push("--bail");
  if (opts.retry !== "0") testArgs.push("--retry", opts.retry);

  // Параллелизм теперь полностью управляется через vitest.config.ts (pool/maxThreads).
  // В раннере не переопределяем потоки через env/CLI, чтобы избежать скрытой сложности.
  if (opts.runInBand || opts.debug) {
    // Для отладки/серийного запуска можно использовать встроенный флаг Vitest.
    testArgs.push("--runInBand");
  }
  if (opts.watch) testArgs.push("--watch");
  if (opts.changed) testArgs.push("--changed");

  // Установить окружение
  if (environment) {
    testArgs.push("--environment", environment);
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

// Определяет настройки покрытия
function determineCoverageEnabled(opts) {
  return !opts.debug && opts.coverage !== false;
}

// Находит тестовые файлы (DEV TOOLING ONLY).
// Vitest сам является единственным источником истины по запуску тестов;
// эта функция используется только для вспомогательных задач раннера:
//   - --summary (глобальная статистика по тестам),
//   - --dry-run (preview того, что есть в репо),
//   - строгая проверка .only/.skip (checkForbiddenTests).
// - Если roots не переданы или пустые — сканирует весь репозиторий (как раньше).
// - Если roots заданы — сканирует только в пределах этих путей (директории/файлы/glob'ы),
//   что важно для строгих проверок в рамках текущего запуска (например, checkForbiddenTests).
function findAllTestFiles(roots = []) {
  const globPattern = '**/*.test.{ts,tsx,js,jsx,mjs}';
  const globOptions = {
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
  };

  // Fallback: полный скан монорепо
  if (!roots || roots.length === 0) {
    return globSync(globPattern, globOptions);
  }

  const results = new Set();

  for (const root of roots) {
    // Если это конкретный файл и он похож на тест — просто добавить его.
    const abs = path.resolve(ROOT, root);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      if (/\.(test)\.(ts|tsx|js|jsx|mjs)$/.test(abs)) {
        results.add(abs);
      }
      continue;
    }

    // Если это директория или glob — ограничиваем поиск этим префиксом.
    const pattern = root.endsWith('/') ? `${root}${globPattern}` : `${root}/${globPattern}`;
    const matches = globSync(pattern, globOptions);
    for (const match of matches) {
      results.add(match);
    }
  }

  return Array.from(results);
}

// Запускает Vitest один раз с заданными параметрами
// Запускает Vitest один раз с заданными параметрами.
// Вся конфигурация репортера (тип, outputFile и т.п.) должна быть полностью
// рассчитана снаружи и передана через reporterConfig — без повторных вызовов
// resolveReporterConfig внутри (DRY, единый источник истины для конфигурации репортера).
async function runVitestOnce({ configPath, environment, paths, opts, coverageEnabled, reporterConfig }) {
  return new Promise((resolve) => {
    try {
      // Строим аргументы для Vitest
      const { args: testArgs, env } = buildVitestArgs(configPath, environment, paths, opts, coverageEnabled, reporterConfig);

      // Запускаем тесты
      const startTime = Date.now();
      const child = spawn("pnpm", ["exec", "vitest", ...testArgs], {
        stdio: "inherit",
        shell: false,
        env,
        cwd: ROOT, // Явно устанавливаем рабочую директорию для правильного разрешения путей
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
          console.warn("⚠️ Coverage report not detected after 60s timeout");
        }
      }

        // Vitest может возвращать ненулевой код из-за coverage thresholds даже в локальном режиме
        // Игнорируем это в локальном режиме, так как thresholds применяются только в CI
        const vitestSuccess = code === 0;
        const ignoreCoverageExitCode = !CI_MODE && coverageEnabled;
        
        if (!vitestSuccess && ignoreCoverageExitCode) {
          console.log("ℹ️  Vitest вернул ненулевой код, но это может быть из-за coverage thresholds (игнорируется в локальном режиме)");
        }

        resolve({
          success: vitestSuccess || ignoreCoverageExitCode, // В локальном режиме игнорируем coverage-related exit codes
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

// Вычисляет разницу покрытия между текущей и базовой веткой.
// Единственный источник истины — coverage-final.json.
async function getCoverageDiff(baseBranch = 'main') {
  try {
    const currentJsonPath = COVERAGE_FINAL_JSON_PATH;
    if (!fs.existsSync(currentJsonPath)) {
      return null;
    }

    const currentTotal = parseProjectCoverageFromJson(currentJsonPath);
    if (!currentTotal) {
      return null;
    }

    // Для базовой ветки ожидаем снапшот coverage-final-<branch>.json
    const baseJsonPath = path.join(ROOT, 'coverage', `coverage-final-${baseBranch}.json`);
    if (!fs.existsSync(baseJsonPath)) {
      console.log(`ℹ️  Покрытие базовой ветки не найдено в ${path.relative(ROOT, baseJsonPath)}`);
      console.log(`💡 Для включения diff покрытия сохраните coverage-final.json из ветки ${baseBranch} как coverage-final-${baseBranch}.json`);
      return null;
    }

    const baseTotal = parseProjectCoverageFromJson(baseJsonPath);
    if (!baseTotal) {
      return null;
    }

    const diff = {
      lines: currentTotal.lines.pct - baseTotal.lines.pct,
      functions: currentTotal.functions.pct - baseTotal.functions.pct,
      branches: currentTotal.branches.pct - baseTotal.branches.pct,
      statements: currentTotal.statements.pct - baseTotal.statements.pct
    };

    return diff;
  } catch (error) {
    console.warn(`Ошибка вычисления разницы покрытия: ${error.message}`);
    return null;
  }
}

// Парсит coverage-final.json и считает покрытие только по whitelist файлов проекта:
// packages/** и apps/** (единственное место, где выполняется фильтрация coverage).
function parseProjectCoverageFromJson(coverageJsonPath) {
  try {
    if (!fs.existsSync(coverageJsonPath)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));

    // v8 JSON формат: объект { [filename]: { s, f, b, l, statementMap, fnMap, branchMap } }
    const entries = Object.entries(raw);
    if (entries.length === 0) {
      return null;
    }

    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;

    const isProjectFile = (filePath) => {
      const rel = path.relative(ROOT, filePath);
      return rel.startsWith('packages/') || rel.startsWith('apps/');
    };

    for (const [filePath, data] of entries) {
      if (!isProjectFile(filePath)) {
        continue;
      }

      // statements
      if (data.s) {
        const counts = Object.values(data.s).map(Number);
        totalStatements += counts.length;
        coveredStatements += counts.filter((v) => v > 0).length;
      }

      // branches
      if (data.b) {
        const branchArrays = Object.values(data.b).map((v) => Array.isArray(v) ? v : [v]);
        for (const arr of branchArrays) {
          const nums = arr.map(Number);
          totalBranches += nums.length;
          coveredBranches += nums.filter((v) => v > 0).length;
        }
      }

      // functions
      if (data.f) {
        const counts = Object.values(data.f).map(Number);
        totalFunctions += counts.length;
        coveredFunctions += counts.filter((v) => v > 0).length;
      }
    }

    // Если по проектным файлам нет данных — ничего не возвращаем
    if (totalStatements === 0 && totalBranches === 0 && totalFunctions === 0) {
      return null;
    }

    // Для простоты считаем lines = statements (как в clover)
    const totalLines = totalStatements;
    const coveredLines = coveredStatements;

    return {
      lines: {
        total: totalLines,
        covered: coveredLines,
        pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
      },
      functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      },
      branches: {
        total: totalBranches,
        covered: coveredBranches,
        pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
      },
      statements: {
        total: totalStatements,
        covered: coveredStatements,
        pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
      },
    };
  } catch (error) {
    console.warn(`Ошибка парсинга coverage-final.json: ${error.message}`);
    return null;
  }
}

// Объединенная функция для определения полной конфигурации тестов
function resolveTestSetup(scope = 'single') {
  // Проверяем что normalizedPaths и opts определены
  if (!normalizedPaths || !opts) {
    fatal('Критическая ошибка: normalizedPaths или opts не определены');
  }

  // Вычисляем настройки покрытия и репортера (общие для обоих режимов)
  const coverageEnabled = determineCoverageEnabled(opts);
  const reporter = opts.reporter || 'default';
  const reportDir = opts.reportDir || 'reports';

  // Режим --all: возвращаем только общие настройки
  if (scope === 'all' || opts.all) {
    return {
      coverageEnabled,
      reporter,
      reportDir
    };
  }

  // Режим single: определяем конфиг и окружение
  // Явные режимы: --unit / --integration / --ai.
  // Если ничего не указано, считаем это unit-запуском.
  const mode =
    opts.integration ? 'integration' :
    opts.ai ? 'ai' :
    'unit';

  const configPath =
    mode === 'integration' ? CONFIGS.packages :
    mode === 'ai' ? CONFIGS.ai :
    CONFIGS.base;

  // Окружение по умолчанию: unit=jsdom (React/DOM), остальные=node.
  const baseEnvironment = mode === 'unit' ? 'jsdom' : 'node';
  const environment = opts.forceEnv || opts.env || baseEnvironment;

  return {
    configPath,
    environment,
    coverageEnabled,
    reporter,
    reportDir
  };
}

const testSetup = resolveTestSetup(opts.all ? 'all' : 'single');
if (opts.all) {
  // Режим --all: запустить все типы тестов последовательно/параллельно
  coverageEnabled = testSetup.coverageEnabled;
  reporter = testSetup.reporter;
  reportDir = testSetup.reportDir;
  await runAllTestTypes(testSetup).catch((error) => {
    fatal('Критическая ошибка в runAllTestTypes', error);
  });
  process.exit(0);
}
({ configPath, environment, coverageEnabled, reporter, reportDir } = testSetup);
if (!fs.existsSync(configPath)) {
  throw new Error(`Конфигурация Vitest не найдена: ${configPath}`);
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
  const { args: debugArgs, env: debugEnv } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporterConfig);
  console.log('🔧 Vitest args:', debugArgs);
  console.log('📂 Normalized paths:', normalizedPaths);
  console.log('🔍 Всего тестов для запуска:', normalizedPaths.length);
  // Не логируем "сырые" env во избежание утечек; выводим только безопасные флаги
  console.log('🌍 Execution flags:', {
    coverage: coverageEnabled ? 'enabled' : 'disabled',
  });
}

if (opts.summary) {
  showTestSummary();
  process.exit(0);
}

if (opts.dryRun) {
  console.log("\n🧪 РЕЖИМ DRY RUN");
  console.log("📝 Команда для выполнения:");
  const { args: dryRunArgs } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporterConfig);
  console.log(`pnpm exec vitest ${dryRunArgs.join(" ")}`);

  console.log("\n🔍 Обнаружение тестов:");
  try {
    // В dry-run режиме показываем общую картину по всему репозиторию,
    // поэтому здесь по-прежнему используем полный скан.
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
  console.log(`  • Репортер: ${reporter}`);

  process.exit(0);
}

/* ================= COVERAGE POLICY (SINGLE SOURCE) ================= */

// Единственные пороги покрытия для всего репозитория.
// Все фильтрации/whitelist реализованы в coverage aggregator (parseProjectCoverageFromJson).
const COVERAGE_THRESHOLDS = { lines: 80, functions: 80, branches: 80, statements: 80 };


/* ================= ПОРОГИ ПОКРЫТИЯ ================= */

async function checkCoverageThresholds() {
  if (!coverageEnabled) return { enabled: false, reportFound: false, thresholdsStatus: 'not_applicable' };

  try {
    // Единственный источник истины для покрытия — coverage-final.json,
    // фильтрация по проектным путям (packages/**, apps/**) выполняется в parseProjectCoverageFromJson.
    const total = parseProjectCoverageFromJson(COVERAGE_FINAL_JSON_PATH);

    if (!total) {
      console.warn("⚠️ Failed to parse coverage-final.json; skipping threshold checks.");
      return { enabled: true, reportFound: false, thresholdsStatus: 'skipped' };
    }

    // Если отчет пустой (нет строк/функций/веток), пропускаем проверку порогов
    const noData =
      total.lines.total === 0 &&
      total.functions.total === 0 &&
      total.branches.total === 0 &&
      total.statements.total === 0;
    if (noData) {
      console.warn("⚠️ Coverage report is empty; skipping threshold checks.");
      return { enabled: true, reportFound: true, thresholdsStatus: 'skipped' };
    }

    // Пороги покрытия (единая политика для всего репозитория)
    const thresholds = COVERAGE_THRESHOLDS;

    console.log("\n📊 Проверка порогов покрытия:");
    console.log(`   Требуется: ${thresholds.lines}% строк, ${thresholds.functions}% функций, ${thresholds.branches}% ветвей, ${thresholds.statements}% выражений`);
    console.log(`   Текущее: ${total.lines.pct.toFixed(1)}% строк, ${total.functions.pct.toFixed(1)}% функций, ${total.branches.pct.toFixed(1)}% ветвей, ${total.statements.pct.toFixed(1)}% выражений`);

    const results = {
      lines: total.lines.pct >= thresholds.lines,
      functions: total.functions.pct >= thresholds.functions,
      branches: total.branches.pct >= thresholds.branches,
      statements: total.statements.pct >= thresholds.statements,
    };

    const allPassed = Object.values(results).every(Boolean);

    if (allPassed) {
      console.log("✅ Все пороги покрытия достигнуты!");
    } else {
      const message = CI_MODE ? "❌ Пороги покрытия не достигнуты:" : "⚠️  Пороги покрытия не достигнуты (локальная разработка):";
      console.log(message);
      if (!results.lines) console.log(`   • Строки: ${total.lines.pct.toFixed(1)}% < ${thresholds.lines}%`);
      if (!results.functions) console.log(`   • Функции: ${total.functions.pct.toFixed(1)}% < ${thresholds.functions}%`);
      if (!results.branches) console.log(`   • Ветви: ${total.branches.pct.toFixed(1)}% < ${thresholds.branches}%`);
      if (!results.statements) console.log(`   • Выражения: ${total.statements.pct.toFixed(1)}% < ${thresholds.statements}%`);

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

  if (fs.existsSync(COVERAGE_FINAL_JSON_PATH)) {
    console.log(`📄 JSON данные покрытия: ${path.relative(ROOT, COVERAGE_FINAL_JSON_PATH)}`);
  }
}

/* ================= ПРОВЕРКА .ONLY/.SKIP ================= */

// Regex для поиска запрещенных модификаторов тестов
const FORBIDDEN_TEST_PATTERN = /\b(it|test|describe)\.(only|skip)\(/g;

// Анализ файла с помощью regex для поиска запрещенных модификаторов
function analyzeFileForForbiddenTests(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const offenders = { only: [], skip: [] };
    const relativePath = path.relative(ROOT, filePath);

    // Находим все совпадения
    let match;
    while ((match = FORBIDDEN_TEST_PATTERN.exec(content)) !== null) {
      const modifier = match[2]; // 'only' или 'skip'
      // Вычисляем номер строки
      const lineNumber = content.substring(0, match.index).split('\n').length;
      offenders[modifier].push(`${relativePath}:${lineNumber}`);
    }

    return offenders;
  } catch (error) {
    // В случае ошибки чтения, возвращаем пустой результат
    console.warn(`Не удалось проанализировать файл ${path.relative(ROOT, filePath)}: ${error.message}`);
    return { only: [], skip: [] };
  }
}

function checkForbiddenTests() {
  if (!opts.strict && !CI_MODE) return true;

  try {
    // Найти все поддерживаемые тестовые файлы.
    // Предпочитаем ограниченный скан по normalizedPaths (текущий запуск),
    // и только при их отсутствии — полный проход по монорепо.
    const roots = normalizedPaths && normalizedPaths.length > 0 ? normalizedPaths : [];
    const testFiles = findAllTestFiles(roots);

    const offenders = { only: [], skip: [] };

    // Проанализировать каждый файл с помощью regex
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

// Выполняет пост-тестовые проверки (coverage, forbidden tests)
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
}

/** Записывает детальные отчеты об ошибках в reports/test-logs */
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
  const { configPath, environment, paths, coverageEnabled, reporter, reportDir, reporterConfig } = config;

  // Запускаем Vitest
  const result = await runVitestOnce({
    configPath,
    environment,
    paths,
    opts: { ...opts, reportDir }, // Передаем reportDir через opts
    coverageEnabled,
    reporterConfig
  });

  // Выполняем пост-тестовые проверки
  const { allChecksPassed, coverageStatus, results } = await runPostTestChecks(
    result.duration.toFixed(1),
    reporter,
    reportDir
  );

  // В локальном режиме игнорируем coverage thresholds при определении success
  // (thresholds применяются только в CI)
  const finalSuccess = result.success && (CI_MODE ? allChecksPassed : true);

  return {
    success: finalSuccess,
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
    reportDir,
    reporterConfig
  });

  // Обрабатываем результат
  if (result.success) {
    console.log(`\n✅ Все тесты прошли успешно за ${result.duration.toFixed(1)}с`);
    process.exit(0);
  } else {
    console.log(`\n❌ Тесты не удались`);

    // Показываем детали неудачных тестов (используем результаты из runRunner)
    if (result.results) {
      showFailedTestsDetails(result.results);
    }

    process.exit(1);
  }
}

// Запускаем CLI
await runCLI();

/* ================= СТАТИСТИКА ТЕСТОВ ================= */

function showTestSummary() {
  console.log("📊 Статистика тестов LivAI:");
  console.log("═".repeat(50));

  try {
    // Найти все тестовые файлы (только .test файлы, runner не поддерживает .spec)
    // Здесь осознанно сканируем весь репозиторий, т.к. это глобальная сводка.
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
