#!/usr/bin/env node
/**
 * Livai Vitest Runner
 * Enterprise обертка вокруг Vitest
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { program } from "commander";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { globSync } from "glob";

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

const CI_MODE = process.env.CI === "true";

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
function getJsonFilename(testTypeName, attempt) {
  const base = testTypeName ? `results-${testTypeName.replace(/\s+/g, '-').toLowerCase()}` : "results";
  return attempt > 1 ? `${base}.attempt-${attempt}.json` : `${base}.json`;
}

// Единая функция для построения аргументов Vitest и переменных окружения
function buildVitestArgs(configPath, environment, normalizedPaths = [], opts, coverageEnabled, reporter = 'default', testTypeName = null, attempt = 1) {
  const testArgs = ["run", "--config", configPath];
  const env = {
    ...process.env,
    ...(coverageEnabled ? { COVERAGE: "true" } : {})
  }; // Клонируем и добавляем coverage если нужно

  if (coverageEnabled) testArgs.push("--coverage");
  if (opts.bail) testArgs.push("--bail");
  if (opts.retry !== "0") testArgs.push("--retry", opts.retry);

  // Vitest 4.x: --no-threads флаг удален, используем переменные окружения
  if (opts.runInBand || opts.debug) {
    env.VITEST_MAX_THREADS = '1';
    env.VITEST_MIN_THREADS = '1';
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

  // Репортеры - один outputFile на запуск (кроме verbose)
  let outputFile = null;

  if (reporter === "junit") {
    fs.mkdirSync(path.join(ROOT, opts.reportDir), { recursive: true });
    testArgs.push("--reporter", "junit");
    // Для --all режима делаем отдельные файлы для каждого типа тестов
    const fileName = testTypeName ? `${testTypeName.replace(/\s+/g, '-').toLowerCase()}.xml` : "junit.xml";
    outputFile = path.join(opts.reportDir, fileName);
  } else if (reporter === "json") {
    testArgs.push("--reporter", "json");
    outputFile = path.join("test-results", getJsonFilename(testTypeName, attempt));
  } else if (reporter === "verbose") {
    // Verbose репортер выводит в консоль, outputFile не нужен
    testArgs.push("--reporter", "verbose");
    // outputFile остается null
  } else {
    // default → json для парсинга результатов
    testArgs.push("--reporter", "json");
    outputFile = path.join("test-results", getJsonFilename(testTypeName, attempt));
  }

  // Создаем директорию для output файла, если он указан
  if (outputFile) {
    const outputDir = path.dirname(path.join(ROOT, outputFile));
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (outputFile) {
    testArgs.push("--outputFile", outputFile);
  }

  // Полностью полагаемся на exclude в config/vitest/vitest.config.ts
  // Не добавляем exclude в командную строку, чтобы избежать конфликтов

  // Добавить пути
  testArgs.push(...normalizedPaths);

  return { args: testArgs, env };
}

/* ================= РАЗРЕШЕНИЕ КОНФИГУРАЦИИ ================= */

async function runSingleTestType(testType, testEnvironment, coverageEnabled) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Запуск ${testType.name}...`);
    console.log('═'.repeat(50));

    try {
      // Очищаем директории перед каждым типом тестов
      if (coverageEnabled) {
        fs.rmSync(path.join(ROOT, "coverage"), { recursive: true, force: true });
      }

      // Используем единую функцию построения аргументов и переменных окружения
      const { args: testArgs, env } = buildVitestArgs(testType.config, testEnvironment, normalizedPaths, opts, coverageEnabled, opts.reporter || 'default', testType.name, 1);

      // Запускаем тесты
      const startTime = Date.now();
      const child = spawn("pnpm", ["exec", "vitest", ...testArgs], {
        stdio: "inherit",
        shell: false,
        env,
      });

      child.on('close', (code) => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        if (code !== 0) {
          console.log(`❌ ${testType.name} не удались (за ${duration.toFixed(1)}с)`);
          resolve(false);
        } else {
          console.log(`✅ ${testType.name} прошли (за ${duration.toFixed(1)}с)`);
          resolve(true);
        }
      });

      child.on('error', (error) => {
        console.error(`💥 Ошибка запуска ${testType.name}:`, error.message);
        resolve(false);
      });

    } catch (error) {
      console.error(`💥 Ошибка запуска ${testType.name}:`, error.message);
      resolve(false);
    }
  });
}

async function runAllTestTypes(globalSetup) {
  // Использовать те же конфиги, которые выбираются для отдельных типов тестов
  const testTypes = [
    { name: 'Unit тесты', config: CONFIGS.base, environment: 'jsdom' }, // Unit тесты обычно используют jsdom
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

  if (CI_MODE) {
    for (const testType of testTypes) {
      const success = await runSingleTestType(testType, testType.environment, globalSetup.coverageEnabled);
      if (!success) overallSuccess = false;
    }
  } else {
    const results = await Promise.all(
      testTypes.map(testType => runSingleTestType(testType, testType.environment, globalSetup.coverageEnabled))
    );
    overallSuccess = results.every(success => success);
  }

  const endTime = Date.now();
  const totalDuration = ((endTime - startTime) / 1000).toFixed(1);

  // Выполняем пост-тестовые проверки (как в runTestsWithRetry)
  const { allChecksPassed: postChecksPassed } = await runPostTestChecks(totalDuration, globalSetup.reporter);
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

// Определяет окружение для глобального запуска unit тестов
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
      console.log(`🔍 Найдено ${reactFiles.length} React файлов, используем jsdom окружение`);
      return 'jsdom';
    }
  } catch (error) {
    console.log(`⚠️  Ошибка определения глобального окружения: ${error.message}`);
  }

  // По умолчанию используем node
  return 'node';
}

// Определяет тип тестов на основе путей и паттернов файлов
function detectTestType(paths) {
  if (!paths || paths.length === 0) return 'unit';

  // Проверяем наличие AI интеграционных тестов
  const hasAIIntegrationTests = paths.some(p => {
    try {
      const dir = fs.statSync(p).isDirectory() ? p : path.dirname(p);
      const aiFiles = globSync('**/tests/integration/**/*.ai.test.{ts,tsx,js,jsx}', {
        cwd: dir,
        absolute: false
      });
      return aiFiles.length > 0;
    } catch {
      return false;
    }
  });

  if (hasAIIntegrationTests) return 'ai';

  // Проверяем наличие общих интеграционных тестов
  const hasIntegrationTests = paths.some(p => {
    try {
      const dir = fs.statSync(p).isDirectory() ? p : path.dirname(p);
      const integrationFiles = globSync('**/tests/integration/**/*.{ts,tsx,js,jsx}', {
        cwd: dir,
        absolute: false
      });
      return integrationFiles.length > 0;
    } catch {
      return false;
    }
  });

  if (hasIntegrationTests) return 'integration';

  // Проверяем наличие UI компонентов или React импортов (для jsdom)
  const hasReactFiles = paths.some(p => {
      try {
        if (fs.statSync(p).isDirectory()) {
          const files = fs.readdirSync(p, { recursive: true });
          return files.some(f => {
            if (f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js')) {
              try {
                const content = fs.readFileSync(path.join(p === '.' ? '' : p, f), 'utf8');
                return content.includes('import.*React') || content.includes('from.*react') ||
                       content.includes('React.') || content.includes('renderHook') ||
                       content.includes('@testing-library/react');
              } catch {
                return false;
              }
            }
            return false;
          });
        }
        // Для отдельных файлов проверяем содержимое
        if (p.endsWith('.ts') || p.endsWith('.js') || p.endsWith('.tsx') || p.endsWith('.jsx')) {
          try {
            const content = fs.readFileSync(p, 'utf8');
            return content.includes('import.*React') || content.includes('from.*react') ||
                   content.includes('React.') || content.includes('renderHook') ||
                   content.includes('@testing-library/react');
          } catch {
            return false;
          }
        }
        return false;
      } catch {
        return false;
      }
    });

  if (hasReactFiles) return 'ui-unit';

  // Проверяем наличие package.json (для packages config)
  const hasPackages = paths.some(p => {
    const fullPath = path.resolve(ROOT, p);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() &&
           fs.existsSync(path.join(fullPath, 'package.json'));
  });

  if (hasPackages) return 'package-unit';

  return 'unit'; // резервный вариант
}

// Резервные окружения по типу конфигурации. Гарантирует консистентное поведение для каждого типа тестов
const ENVIRONMENT_FALLBACKS = {
  'packages': 'node',      // packages config → backend/API окружение
  'ai': 'node',           // ai config → API calls окружение
  'base': 'node',         // base config → общее backend окружение
  'integration': 'node'   // integration config → API тестирование
};

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
    console.log(`⚠️  Ошибка вычисления разницы покрытия: ${error.message}`);
    return null;
  }
}

// Загружает пороги из конфигурационного файла Vitest
function loadThresholdsFromConfig(configPath) {
  try {
    // Пороги по умолчанию - повышенные требования для качества
    let thresholds = { lines: 85, functions: 85, branches: 85, statements: 80 };

    if (configPath.includes('packages') || configPath.includes('integration')) {
      // Для packages конфигурации пытаемся загрузить из файла
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
        console.log(`⚠️  Не удалось загрузить пороги из конфига, используем значения по умолчанию: ${error.message}`);
      }
    } else if (configPath.includes('ai')) {
      // AI тесты имеют повышенные требования для качества
      thresholds = { lines: 85, functions: 85, branches: 85, statements: 80 };
    }

    return thresholds;
  } catch (error) {
    console.log(`⚠️  Ошибка загрузки порогов, используем повышенные значения по умолчанию: ${error.message}`);
    return { lines: 85, functions: 85, branches: 85, statements: 80 };
  }
}

// Объединенная функция для определения полной конфигурации тестов
function resolveTestSetup() {
  // Вычисляем настройки покрытия
  // Для глобального запуска отключаем coverage в локальном режиме (слишком много файлов)
  const isGlobalRun = opts.unit && normalizedPaths.length === 0;
  const coverageEnabled = opts.debug ? false :
    opts.coverage !== false; // Включаем coverage по умолчанию

  // Set or clear COVERAGE environment variable for Vitest config
  if (coverageEnabled) {
    process.env.COVERAGE = 'true';
  } else {
    delete process.env.COVERAGE;
  }

  // --force-env имеет максимальный приоритет
  if (opts.forceEnv) {
    if (!['node', 'jsdom'].includes(opts.forceEnv)) {
      throw new Error(`Недопустимое значение --force-env: ${opts.forceEnv}. Должно быть 'node' или 'jsdom'`);
    }
    console.log(`🔧 Принудительное переопределение окружения: ${opts.forceEnv}`);
  }

  if (opts.config) {
    const cfg = CONFIGS[opts.config];
    if (!cfg) throw new Error(`Неизвестная конфигурация: ${opts.config}`);

    // Приоритет: --force-env > --env > fallback по конфигу
    let env = opts.forceEnv || opts.env;
    if (!env) {
      // Fallback по типу конфигурации
      const configType = Object.keys(ENVIRONMENT_FALLBACKS).find(type =>
        cfg.includes(type)
      );
      env = configType ? ENVIRONMENT_FALLBACKS[configType] : undefined;
    }

    return { configPath: cfg, environment: env, coverageEnabled, reporter: opts.reporter || 'default' };
  }

  let configPath, baseEnvironment;

  if (opts.unit) {
    // Для unit тестов определяем тип на основе путей
    const testType = detectTestType(normalizedPaths);
    switch (testType) {
      case 'ai':
        configPath = CONFIGS.ai;
        baseEnvironment = 'node';
        break;
      case 'integration':
      case 'package-unit':
        configPath = CONFIGS.packages;
        baseEnvironment = normalizedPaths.length === 0 ? 'node' : 'jsdom';
        break;
      case 'ui-unit':
        configPath = CONFIGS.packages;
        baseEnvironment = 'jsdom';
        break;
      default:
        configPath = CONFIGS.base;
        // Для unit тестов используем jsdom по умолчанию (совместимость с React)
        baseEnvironment = 'jsdom';
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
    if (normalizedPaths.length > 0) {
      const testType = detectTestType(normalizedPaths);

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
          const isUnitTest = normalizedPaths.some(p =>
            p.includes('/tests/unit/') || p.includes('\\tests\\unit\\')
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
      const hasIntegrationPatterns = normalizedPaths.some(p =>
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

  return { configPath, environment, coverageEnabled, reporter: opts.reporter || 'default' };
}

// Функция для определения глобальных настроек в режиме --all
function resolveTestSetupForAll() {
  // Вычисляем настройки покрытия
  const coverageEnabled = opts.debug ? false : opts.coverage !== false;

  return {
    coverageEnabled,
    reporter: opts.reporter || 'default'
  };
}

const testSetup = resolveTestSetup();
if (!testSetup) {
  // Режим --all: запустить все типы тестов последовательно/параллельно
  // Но нам все равно нужны глобальные настройки для пост-обработки
  const globalTestSetup = resolveTestSetupForAll();
  runAllTestTypes(globalTestSetup).catch((error) => {
    console.error('💥 Критическая ошибка в runAllTestTypes:', error);
    process.exit(1);
  });
  // Выйти немедленно, чтобы предотвратить дальнейшее выполнение
  process.exit(0);
}
const { configPath, environment, coverageEnabled, reporter } = testSetup;
if (!fs.existsSync(configPath)) {
  throw new Error(`Конфигурация Vitest не найдена: ${configPath}`);
}

/* ================= ВАЛИДАЦИЯ ПУТЕЙ ================= */

// Валидирует и нормализует пути, фильтруя только тестовые файлы
function validateAndNormalizePaths() {
  if (paths.length === 0) return [];

  // Исключаем файлы из pnpm-store и других системных директорий
  const SYSTEM_PATTERNS = [
    '.pnpm-store',
    '.pnpm',
    'node_modules'
  ];

  // Допустимые расширения тестовых файлов (ТОЛЬКО .test файлы)
  const VALID_TEST_EXTENSIONS = [
    '.test.ts', '.test.tsx', '.test.js', '.test.jsx', '.test.mjs'
  ];

  // Запрещенные паттерны (Playwright E2E тесты и другие внешние тесты)
  const FORBIDDEN_PATTERNS = [
    'e2e/',
    'playwright',
    'config/playwright'
  ];

  const normalizedPaths = [];
  const filteredPaths = [];

  for (const p of paths) {
    // Исключаем системные пути (pnpm-store, node_modules)
    if (SYSTEM_PATTERNS.some(pattern => p.includes(pattern))) {
      console.log(`⏭️  Пропускаем системный путь: ${p}`);
      continue;
    }

    const fullPath = path.resolve(ROOT, p);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Путь не существует: ${p} (${fullPath})`);
    }

    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      // Для файлов - проверяем расширение
      const isValidTest = VALID_TEST_EXTENSIONS.some(ext =>
        fullPath.endsWith(ext) || fullPath.includes(ext)
      );

      if (isValidTest) {
        // Проверяем на запрещенные паттерны (Playwright и другие внешние тесты)
        const isForbidden = FORBIDDEN_PATTERNS.some(pattern =>
          fullPath.includes(pattern) || p.includes(pattern)
        );

        if (!isForbidden) {
          normalizedPaths.push(path.relative(ROOT, fullPath));
        } else {
          filteredPaths.push(p);
          console.log(`🚫 Отфильтрован запрещенный файл (Playwright/other): ${p}`);
        }
      } else {
        filteredPaths.push(p);
        console.log(`⚠️  Отфильтрован не-тестовый файл: ${p}`);
      }
    } else if (stat.isDirectory()) {
      // Проверяем на запрещенные паттерны (Playwright директории)
      const isForbidden = FORBIDDEN_PATTERNS.some(pattern =>
        fullPath.includes(pattern) || p.includes(pattern)
      );

      if (isForbidden) {
        filteredPaths.push(p);
        console.log(`🚫 Отфильтрована запрещенная директория (Playwright/other): ${p}`);
        continue;
      }

      // Для директорий - проверяем наличие тестовых файлов
      try {
        const files = fs.readdirSync(fullPath, { recursive: true });
        const hasTestFiles = files.some(file => {
          const filePath = path.join(fullPath, file.toString());
          return VALID_TEST_EXTENSIONS.some(ext =>
            filePath.endsWith(ext) || filePath.includes(ext)
          );
        });

        if (hasTestFiles) {
          normalizedPaths.push(path.relative(ROOT, fullPath));
        } else {
          filteredPaths.push(p);
          console.log(`⚠️  Директория не содержит тестовых файлов: ${p}`);
        }
      } catch (error) {
        filteredPaths.push(p);
        console.log(`⚠️  Невозможно прочитать директорию: ${p} (${error.message})`);
      }
    } else {
      // Символические ссылки и другие типы файлов
      filteredPaths.push(p);
      console.log(`⚠️  Неподдерживаемый тип пути: ${p}`);
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
  const { args: debugArgs, env: debugEnv } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporter);
  console.log('🔧 Vitest args:', debugArgs);
  console.log('📂 Normalized paths:', normalizedPaths);
  console.log('🔍 Всего тестов для запуска:', normalizedPaths.length);
  console.log('🌍 Environment vars:', {
    COVERAGE: debugEnv.COVERAGE,
    VITEST_MAX_THREADS: debugEnv.VITEST_MAX_THREADS,
    VITEST_MIN_THREADS: debugEnv.VITEST_MIN_THREADS
  });
}

if (opts.summary) {
  showTestSummary();
  process.exit(0);
}

if (opts.dryRun) {
  console.log("\n🧪 РЕЖИМ DRY RUN");
  console.log("📝 Команда для выполнения:");
  const { args: dryRunArgs } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporter);
  console.log(`pnpm exec vitest ${dryRunArgs.join(" ")}`);
  console.log("🔧 Значение опции parallel:", opts.parallel);

  console.log("\n🔍 Обнаружение тестов:");
  try {
    // Используем улучшенный glob с правильными exclude паттернами
    // (Vitest list имеет проблемы с exclude правилами при наличии Playwright файлов)
    // Используем только допустимые расширения тестовых файлов (.test, исключая .spec)
    const testFiles = globSync('**/*.test.{ts,tsx,js,jsx,mjs}', {
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
        '**/playwright-report/**',
        '**/.pnpm-store/**',
        '**/.pnpm/**'
      ]
    });

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
    console.log(`⚠️  Не удалось обнаружить тестовые файлы: ${error.message}`);
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

  const coverageJsonPath = path.join(ROOT, "coverage", "coverage-final.json");
  if (!fs.existsSync(coverageJsonPath)) {
    const error = new Error("Coverage is enabled but report was not generated - check Vitest config and CLI flags");
    console.error(`❌ ${error.message}`);

    // В CI режиме coverage обязателен
    if (CI_MODE) {
      throw error;
    }

    // В локальном режиме даем warning
    console.log("⚠️  Coverage report missing - continuing without threshold checks");
    console.log("💡 Check if Vitest is generating coverage reports correctly");
    return { enabled: true, reportFound: false, thresholdsStatus: 'skipped' };
  }

  try {
    const coverage = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
    const total = coverage.total || {};

    // Динамическая загрузка порогов из конфигурационного файла
    const thresholds = loadThresholdsFromConfig(configPath);

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
function generateCIDashboardReport(packageResults, totalDuration) {
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
    for (const stats of packageResults.values()) {
      report.summary.tests += stats.total;
      report.summary.passed += stats.passed;
      report.summary.failed += stats.failed;
      report.summary.skipped += stats.skipped;
    }

    // Заполнить packages
    for (const [packageName, stats] of packageResults) {
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
    console.log(`⚠️  Ошибка генерации CI dashboard отчета: ${error.message}`);
  }
}

/* ================= СТАТИСТИКА ТЕСТОВ ================= */

function showTestSummary() {
  console.log("📊 Статистика тестов LivAI:");
  console.log("═".repeat(50));

  try {
    // Найти все тестовые файлы (только .test файлы, runner не поддерживает .spec)
    const allTestFiles = globSync('**/*.test.{ts,tsx,js,jsx,mjs}', {
      cwd: ROOT,
      absolute: true,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**', '**/e2e/**', 'e2e/**', 'config/playwright/**', '**/.pnpm-store/**', '**/.pnpm/**']
    });

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

function checkForbiddenTests() {
  if (!opts.strict && !CI_MODE) return true;

  try {
    // Найти все поддерживаемые тестовые файлы в проекте (только .test, runner не поддерживает .spec)
    const testFiles = globSync('**/*.test.{ts,tsx,js,jsx,mjs}', {
      cwd: ROOT,
      absolute: true,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**', '**/e2e/**', 'e2e/**', 'config/playwright/**', '**/.pnpm-store/**', '**/.pnpm/**']
    });

    const offenders = { only: [], skip: [] };

    // Проверить каждый файл на наличие .only/.skip
    for (const file of testFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const lineNumber = index + 1;

          // Искать .only( с границами слов, исключая комментарии и строки
          if (/\b(it|test|describe)\.only\s*\(/.test(line) &&
              !line.trim().startsWith('//') &&
              !line.trim().startsWith('/*') &&
              !line.includes('".only(') &&
              !line.includes("'.only(")) {
            offenders.only.push(`${path.relative(ROOT, file)}:${lineNumber}`);
          }

          // Искать .skip( с границами слов, исключая комментарии и строки
          if (/\b(it|test|describe)\.skip\s*\(/.test(line) &&
              !line.trim().startsWith('//') &&
              !line.trim().startsWith('/*') &&
              !line.includes('".skip(') &&
              !line.includes("'.skip(")) {
            offenders.skip.push(`${path.relative(ROOT, file)}:${lineNumber}`);
          }
        });
      } catch (error) {
        // Пропустить файлы которые нельзя прочитать
        continue;
      }
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
    console.log(`⚠️  Ошибка проверки запрещенных тестов: ${error.message}`);
  }

  return true;
}

// Определяет, стоит ли повторять тест на основе сравнения результатов
function shouldRetryBasedOnResults(lastResult, hasCriticalError, retryCount, maxRetries, previousResults, currentResults) {
  // Базовые проверки
  if (lastResult.status === 0 || hasCriticalError || retryCount >= maxRetries) {
    return false;
  }

  // Если нет результатов для сравнения - повторяем
  if (!currentResults || !currentResults.testResults) {
    return true;
  }

  // Если есть предыдущие результаты - сравниваем
  if (previousResults && previousResults.testResults) {
    const prevStats = getTestStats(previousResults);
    const currentStats = getTestStats(currentResults);

    // Если количество упавших тестов одинаковое - не повторяем
    if (prevStats.failed.length === currentStats.failed.length) {
      // Если списки упавших тестов идентичны - точно не повторяем
      const prevFailureNames = new Set(prevStats.failed.map(f => f.fullName));
      const currentFailureNames = new Set(currentStats.failed.map(f => f.fullName));

      if (prevStats.failed.length === currentStats.failed.length &&
          [...prevFailureNames].every(name => currentFailureNames.has(name))) {
        return false;
      }
    }
  }

  // Проверяем количество упавших тестов - если слишком много, это не flaky
  const currentStats = getTestStats(currentResults);
  const failureRate = currentStats.total > 0 ? (currentStats.failed.length / currentStats.total) * 100 : 0;

  if (currentStats.failed.length > 3) {
    console.log(`🔄 Retry пропущен: слишком много упавших тестов (${currentStats.failed.length}/${currentStats.total}, ${failureRate.toFixed(1)}%)`);
    console.log(`💥 Это системная ошибка, а не flaky failure`);

    // Логируем первые несколько падающих тестов
    if (currentStats.failed.length > 0) {
      console.log(`❌ Примеры падающих тестов:`);
      currentStats.failed.slice(0, 3).forEach(failure => {
        console.log(`   • ${failure.title}`);
      });
      if (currentStats.failed.length > 3) {
        console.log(`   ... и ещё ${currentStats.failed.length - 3} тестов`);
      }
    }

    return false;
  }

  // Если процент упавших >5%, это тоже системная ошибка
  if (failureRate > 5) {
    console.log(`🔄 Retry пропущен: высокий процент упавших тестов (${failureRate.toFixed(1)}% > 5%)`);
    console.log(`💥 Системная ошибка, retry не поможет`);
    return false;
  }

  // Если stderr содержит flaky-паттерны - повторяем
  if (lastResult.stderr && isLikelyFlakyFailure(lastResult.stderr)) {
    return true;
  }

  // По умолчанию повторяем, если есть ошибки и не превышен лимит
  return true;
}

// Извлекает статистику тестов из результатов
function getTestStats(results) {
  const failedTests = [];
  let total = 0;

  if (results.testResults) {
    results.testResults.forEach((testResult) => {
      if (testResult.assertionResults) {
        testResult.assertionResults.forEach((assertion) => {
          total++;
          if (assertion.status === 'failed') {
            failedTests.push({
              fullName: assertion.fullName,
              title: assertion.title,
              ancestorTitles: assertion.ancestorTitles
            });
          }
        });
      }
    });
  }

  return { failed: failedTests, total };
}

// Определяет, является ли failure вероятно flaky
function isLikelyFlakyFailure(stderr) {
  if (!stderr) return false;

  const flakyPatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /race condition/i,
    /flaky/i,
    /unstable/i,
    /temporary failure/i,
    /connection reset/i,
    /econnreset/i,
    /enotfound/i,
    /etimedout/i,
    /webdriver/i, // Для e2e тестов
    /element not found/i, // Для UI тестов
    /stale element/i // Для UI тестов
  ];

  return flakyPatterns.some(pattern => pattern.test(stderr));
}

// Выполняет пост-тестовые проверки (coverage, forbidden tests, CI dashboard)
async function runPostTestChecks(duration, reporter) {
    // Парсим результаты текущего запуска для анализа
    let currentResults = null;
    try {
      const resultsPath = path.join(ROOT, "test-results", "results.json");
      if (fs.existsSync(resultsPath)) {
        currentResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      }
    } catch (error) {
      console.log(`⚠️  Не удалось прочитать результаты тестов: ${error.message}`);
    }

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

    displayResultsSummary(duration, reporter);

    return { allChecksPassed, results: currentResults, coverageStatus };
}

// Выполняет тест с автоматический retry при flaky failures
async function runTestsWithRetry() {
  const MAX_AUTO_RETRIES = 2;
  let retryCount = 0;
  let lastResult = null;
  let duration = 0;
  let finalResultsPath = null;
  let previousResults = null; // Храним результаты предыдущей попытки

  // В CI режиме проверяем запрещенные тесты ДО запуска (чтобы не гонять тесты зря)
  if (CI_MODE) {
    console.log('🔍 Проверка на запрещенные модификаторы тестов (.only/.skip)...');
    if (!checkForbiddenTests()) {
      console.error('❌ Найдены запрещенные модификаторы тестов. Исправьте перед коммитом.');
      process.exit(1);
    }
  }

  while (retryCount <= MAX_AUTO_RETRIES) {
    if (retryCount > 0) {
      console.log(`\n🔄 Автоматический повтор ${retryCount}/${MAX_AUTO_RETRIES} из-за вероятного flaky failure`);
      // Небольшая пауза перед повтором
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const startTime = Date.now();
    // Используем единую функцию построения аргументов и переменных окружения
    const currentAttempt = retryCount + 1;
    const { args: vitestArgs, env } = buildVitestArgs(configPath, environment, normalizedPaths, opts, coverageEnabled, reporter, null, currentAttempt);
    lastResult = spawnSync("pnpm", ["exec", "vitest", ...vitestArgs], {
      stdio: ["inherit", "inherit", "pipe"],
      shell: false,
      env,
    });
    const endTime = Date.now();
    duration = ((endTime - startTime) / 1000).toFixed(1);

    // Даем Vitest время завершить запись coverage отчетов
    // Для глобального запуска нужно больше времени
    const delay = opts.unit && normalizedPaths.length === 0 ? 8000 : 2000;
    if (coverageEnabled) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const { allChecksPassed, results: currentResults } = await runPostTestChecks(duration, reporter);

    // Сохраняем путь к результатам этой попытки
    if (currentAttempt === 1 && fs.existsSync(path.join(ROOT, "test-results", "results.json"))) {
      finalResultsPath = path.join(ROOT, "test-results", "results.json");
    } else if (fs.existsSync(path.join(ROOT, "test-results", `results.attempt-${currentAttempt}.json`))) {
      finalResultsPath = path.join(ROOT, "test-results", `results.attempt-${currentAttempt}.json`);
    }

    // Проверить критические ошибки (без анализа stderr из-за полного буферизации spawnSync)
    const hasCriticalError = lastResult.signal;

    // Если все проверки прошли - выходим успешно
    if (lastResult.status === 0 && !hasCriticalError && allChecksPassed) {
      console.log(`\n✅ Все тесты прошли успешно за ${duration}с`);
      if (retryCount > 0) {
        console.log(`   (После ${retryCount} автоматического повтор${retryCount > 1 ? 'а' : 'а'})`);
      }

      // Копируем финальный результат в results.final.json для истории
      if (finalResultsPath && fs.existsSync(finalResultsPath)) {
        const finalPath = path.join(ROOT, "test-results", "results.final.json");
        fs.copyFileSync(finalResultsPath, finalPath);
        console.log(`📊 Финальный отчет сохранен: test-results/results.final.json`);
      }

      process.exit(0);
    }

    // Проверяем, стоит ли повторять с умным анализом изменений
    const shouldRetry = shouldRetryBasedOnResults(lastResult, hasCriticalError, retryCount, MAX_AUTO_RETRIES, previousResults, currentResults);

    if (!shouldRetry) {
      if (previousResults && currentResults) {
        console.log(`🔄 Retry пропущен: результаты идентичны предыдущей попытке`);
      }
      break;
    }

    // Сохраняем текущие результаты для сравнения при следующем retry
    previousResults = currentResults;

    retryCount++;
  }

  // Финальная обработка неудачи
  console.log(`\n❌ Тесты не удались (код выхода: ${lastResult.status ?? 1})`);
  if (lastResult.signal) {
    console.log(`Сигнал: ${lastResult.signal}`);
  }
  if (retryCount > 0) {
    console.log(`   (После ${retryCount} автоматического повтор${retryCount > 1 ? 'а' : 'а'})`);
  }
  process.exit(1);
}

// Разбор и отображение сводки результатов
function displayResultsSummary(duration, reporter) {
  // Для junit и verbose репортеров не показываем сводку (они уже вывели результаты)
  if (reporter === "junit" || reporter === "verbose") {
    if (reporter === "junit") {
      console.log(`\n📊 Результаты записаны в JUnit XML формат`);
    } else {
      console.log(`\n📊 Verbose вывод завершен`);
    }
    return;
  }

  // Читаем актуальный файл результатов (results.json имеет приоритет над final)
  const resultsDir = path.join(ROOT, "test-results");
  const resultFiles = [];

  // Приоритет: results.json > results.attempt-* > results.final.json
  const mainResultFile = path.join(resultsDir, "results.json");
  if (fs.existsSync(mainResultFile)) {
    resultFiles.push(mainResultFile);
  } else {
    // Если основного файла нет, ищем последний attempt
    const attemptFiles = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith('results.attempt-') && file.endsWith('.json'))
      .sort()
      .reverse();

    if (attemptFiles.length > 0) {
      resultFiles.push(path.join(resultsDir, attemptFiles[0]));
    } else if (fs.existsSync(path.join(resultsDir, "results.final.json"))) {
      // Последний шанс - final файл
      resultFiles.push(path.join(resultsDir, "results.final.json"));
    }
  }

  if (resultFiles.length === 0) {
    console.log(`\n⚠️  Файлы результатов не найдены`);
    return;
  }

  try {
    let totalTests = 0, passedTests = 0, failedTests = 0, skippedTests = 0;
    const packageResults = new Map();
    const seenTests = new Set(); // Для предотвращения дублирования тестов
    const failingTestDetails = []; // Для сбора детальной информации о падающих тестах

    // Агрегируем результаты из всех файлов
    for (const resultFile of resultFiles) {
      if (fs.existsSync(resultFile)) {
        const results = JSON.parse(fs.readFileSync(resultFile, 'utf8'));

        // Разбор формата JSON Vitest с группировкой по пакетам
        if (results.testResults) {
          // results.final.json имеет testResults на верхнем уровне
          results.testResults.forEach((testResult) => {
            // Определить пакет по пути к файлу
            const filePath = testResult.testFilePath || testResult.name || '';

            // Агрессивно пропускаем pnpm store и node_modules пути
            if (filePath.includes('.pnpm-store') ||
                filePath.includes('.pnpm') ||
                filePath.includes('node_modules') ||
                filePath.includes('/projects/')) {
              return;
            }

            const normalizedPath = path.relative(ROOT, filePath);
            const testId = normalizedPath; // Уникальный ID теста

            // Проверяем дублирование
            if (seenTests.has(testId)) {
              console.log(`⚠️  Duplicate test detected: ${testId}`);
              return; // Пропускаем дублированный тест
            }
            seenTests.add(testId);

            const packageName = getPackageFromPath(normalizedPath);

            if (!packageResults.has(packageName)) {
              packageResults.set(packageName, {
                total: 0, passed: 0, failed: 0, skipped: 0, duration: 0
              });
            }

            const pkgStats = packageResults.get(packageName);

            if (testResult.assertionResults) {
              testResult.assertionResults.forEach((assertion) => {
                totalTests++;
                pkgStats.total++;

                switch (assertion.status) {
                  case 'passed':
                    passedTests++;
                    pkgStats.passed++;
                    break;
                  case 'failed':
                    failedTests++;
                    pkgStats.failed++;

                    // Собрать детальную информацию о падающем тесте
                    failingTestDetails.push({
                      file: testResult.testFilePath || testResult.name || 'Unknown file',
                      title: assertion.title || 'Unknown test',
                      failureMessages: assertion.failureMessages || []
                    });
                    break;
                  case 'skipped':
                    skippedTests++;
                    pkgStats.skipped++;
                    break;
                }
              });
            }

            // Добавить длительность для пакета (сумма всех assertionResults)
            if (testResult.assertionResults) {
              const totalDuration = testResult.assertionResults.reduce((sum, assertion) => {
                return sum + (assertion.duration || 0);
              }, 0);
              pkgStats.duration += totalDuration;
            }
          });
        }
      }
    }

      console.log("\n📈 Сводка результатов тестов:");
      console.log(`   • Всего: ${totalTests} тестов`);
      console.log(`   • Прошли: ${passedTests}`);
      console.log(`   • Не удались: ${failedTests}`);
      console.log(`   • Пропущены: ${skippedTests}`);
      console.log(`   • Длительность: ${duration}с`);

      if (totalTests > 0) {
        const passRate = ((passedTests / totalTests) * 100).toFixed(1);
        console.log(`   • Процент прохождения: ${passRate}%`);
      }

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
        generateCIDashboardReport(packageResults, duration);
      }

    } catch (error) {
      console.log(`⚠️  Ошибка разбора результатов тестов: ${error.message}`);
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

/* ================= ЗАПУСК ================= */

console.log("\n▶️  Начало выполнения тестов...\n");

// Запустить тесты с автоматическим retry при flaky failures
await runTestsWithRetry();
