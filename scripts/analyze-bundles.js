#!/usr/bin/env node

/**
 * Скрипт анализа бандлов для LivAiBot Monorepo
 * Анализирует размеры бандлов для всех пакетов в монорепо.
 * Генерирует HTML отчеты для каждого пакета и сводный JSON.
 * Проверяет бюджеты размеров и сравнивает с baseline.
 * Использование:
 *   node scripts/analyze-bundles.js
 *   pnpm analyze:bundles
 *   pnpm analyze:bundles --compare=main     # Сравнить с main branch
 *   pnpm analyze:bundles --compare=v1.0.0   # Сравнить с релизом
 *   pnpm analyze:bundles --compare=none     # Без сравнения
 *   pnpm analyze:bundles --size-only        # Только анализ размеров
 *   pnpm analyze:bundles --graph-only       # Только анализ графа зависимостей
 */

import { mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { rollup } from 'rollup';
import { visualizer } from 'rollup-plugin-visualizer';

// Импортируем бюджеты размеров
let budgets = {};
let budgetExceeded = false; // Флаг превышения бюджета

try {
  budgets = JSON.parse(readFileSync('budgets.json', 'utf8'));
} catch (error) {
  console.warn('⚠️  Файл budgets.json не найден, проверки бюджетов отключены');
}

// External зависимости которые не должны показывать предупреждения
const EXTERNAL_WHITELIST = ['effect', 'crypto'];

// CLI аргументы
const args = process.argv.slice(2);
const compareRef = args.find((arg) => arg.startsWith('--compare='))?.split('=')[1] || 'main';
const sizeOnly = args.includes('--size-only');
const graphOnly = args.includes('--graph-only');
const quiet = args.includes('--quiet');

// Валидация CLI аргументов
if (sizeOnly && graphOnly) {
  console.error('❌ Ошибка: нельзя использовать --size-only и --graph-only одновременно');
  process.exit(1);
}

/**
 * Проверяет размеры пакета на соответствие бюджетам
 * @param {string} packageName - Имя пакета
 * @param {Object} sizes - Объект с размерами {raw, gzip, brotli}
 */
function checkBudgets(packageName, sizes) {
  const packageBudgets = budgets[packageName];
  if (!packageBudgets) return; // Нет бюджета для этого пакета

  console.log(`📏 Проверяем бюджет для ${packageName}:`);

  for (const [type, limit] of Object.entries(packageBudgets)) {
    const actual = sizes[type];
    const status = actual > limit ? '❌ ПРЕВЫШЕН' : '✅ OK';

    console.log(`  ${type}: ${formatSize(actual)} / ${formatSize(limit)} ${status}`);

    if (actual > limit) {
      budgetExceeded = true;
    }
  }
}

/**
 * Загружает baseline размеры из git reference (main, tag, etc.)
 * @param {string} ref - Git reference (main, v1.0.0, etc.)
 * @returns {Object|null} Baseline размеры или null если не найдено
 */
async function loadBaseline(ref) {
  try {
    const { execSync } = await import('child_process');

    // Проверяем существует ли reference
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: 'pipe' });
    } catch {
      return null; // Reference не существует
    }

    // Получаем baseline summary из git
    const baselineJson = execSync(`git show ${ref}:reports/bundles-summary.json`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const baseline = JSON.parse(baselineJson);

    if (!baseline.packages) return null;

    // Преобразуем в map по имени пакета
    const baselineMap = {};
    for (const pkg of baseline.packages) {
      if (pkg && pkg.package && pkg.sizes) {
        baselineMap[pkg.package] = pkg.sizes;
      }
    }

    return baselineMap;
  } catch (error) {
    return null; // Baseline недоступен
  }
}

/**
 * Показывает diff размеры по сравнению с baseline
 * @param {string} packageName - Имя пакета
 * @param {Object} currentSizes - Текущие размеры
 * @param {Object} baselineSizes - Baseline размеры
 */
function showDiff(packageName, currentSizes, baselineSizes) {
  if (!baselineSizes) return;

  console.log(`📊 Сравнение с baseline для ${packageName}:`);

  for (const type of ['raw', 'gzip', 'brotli']) {
    const current = currentSizes[type];
    const baseline = baselineSizes[type];

    if (!baseline) continue;

    const diff = current - baseline;
    const diffPercent = ((diff / baseline) * 100).toFixed(1);
    const sign = diff >= 0 ? '+' : '';

    const status = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';

    console.log(`  ${type}: ${sign}${formatSize(diff)} (${sign}${diffPercent}%) ${status}`);
  }
}

const REPORTS_DIR = 'reports/bundles';
const SUMMARY_FILE = 'reports/bundles-summary.json';

/**
 * Находит все пакеты в монорепо с собранными бандлами
 * @returns {Promise<Array>} Массив пакетов с информацией о package.json
 */
async function findPackages() {
  const packages = [];

  // Находим все директории с package.json, исключая node_modules
  const { execSync } = await import('child_process');

  try {
    const result = execSync(
      'find . -name "package.json" -type f -not -path "./node_modules/*" -not -path "./.git/*"',
      {
        encoding: 'utf8',
      },
    );

    const packageJsonPaths = result.trim().split('\n').filter(Boolean);

    for (const packageJsonPath of packageJsonPaths) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const packageDir = join(packageJsonPath, '..');

        // Пропускаем корневой package.json и пакеты без имени
        if (packageJsonPath === './package.json' || !packageJson.name) {
          continue;
        }

        // Получаем имя пакета из пути директории
        const packageName = packageDir.split('/').pop() || packageJson.name;

        packages.push({
          name: packageName,
          path: packageDir,
          packageJsonPath,
          packageJson,
        });
      } catch {
        // Пропускаем некорректные package.json
      }
    }
  } catch (error) {
    console.error(`Error finding packages: ${error.message}`);
    process.exit(1);
  }

  return packages;
}

/**
 * Находит основной entry файл бандла в директории dist пакета
 * @param {string} packagePath - Путь к пакету
 * @returns {string|null} Путь к entry файлу или null если не найден
 */
function findPrimaryEntry(packagePath) {
  const distDir = join(packagePath, 'dist');

  try {
    statSync(distDir);
  } catch {
    return null; // Директория dist не найдена
  }

  // Рекурсивно находим все .js и .mjs файлы в dist/
  function findJsFiles(dir) {
    const files = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findJsFiles(fullPath));
      } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  const jsFiles = findJsFiles(distDir);

  if (jsFiles.length === 0) {
    return null;
  }

  // Приоритет: index.js, затем index.mjs, затем первый .js файл
  const indexJs = jsFiles.find((file) => file.endsWith('/index.js') || file.endsWith('\\index.js'));
  if (indexJs) return indexJs;

  const indexMjs = jsFiles.find((file) =>
    file.endsWith('/index.mjs') || file.endsWith('\\index.mjs')
  );
  if (indexMjs) return indexMjs;

  return jsFiles[0];
}

/**
 * Анализирует бандл пакета - размеры и dependency graph
 * @param {string} packageName - Имя пакета
 * @param {string} entryFile - Путь к entry файлу бандла
 * @returns {Promise<Object|null>} Результаты анализа или null при ошибке
 */
async function analyzeBundle(packageName, entryFile) {
  if (!entryFile) {
    if (!quiet) console.log(`⚠️  Пропускаем ${packageName} - бандл не найден`);
    return null;
  }

  const relativeEntry = relative(process.cwd(), entryFile);
  if (!quiet) console.log(`📊 Анализируем ${packageName}...`);

  try {
    // Убеждаемся что директория отчетов существует
    mkdirSync('reports/bundles', { recursive: true });

    // Читаем файл бандла для анализа размеров
    const code = readFileSync(entryFile, 'utf8');

    // Вычисляем размеры
    const rawSize = Buffer.byteLength(code, 'utf8');
    const zlib = await import('zlib');
    const gzipSize = zlib.gzipSync(code).length;
    const brotliSize = zlib.brotliCompressSync(code).length;

    const fs = await import('fs');

    // Генерируем size report если не graph-only
    if (!graphOnly) {
      const sizeHtmlReport = generateSizeHtmlReport(packageName, relativeEntry, {
        raw: rawSize,
        gzip: gzipSize,
        brotli: brotliSize,
      });

      await fs.writeFileSync(`reports/bundles/${packageName}.size.html`, sizeHtmlReport);
      if (!quiet) console.log(`✅ Сгенерирован size-отчет для ${packageName}`);
    }

    // Генерируем graph report если не size-only
    if (!sizeOnly) {
      try {
        const bundle = await rollup({
          input: entryFile,
          onwarn(warning) {
            if (quiet) return; // В quiet режиме подавляем все предупреждения

            // Подавляем предупреждения о неразрешенных импортах для известных external зависимостей
            const message = warning.message || '';
            const isExternalWarning = message.includes('could not be resolved')
              && EXTERNAL_WHITELIST.some((ext) =>
                message.includes(`"${ext}"`) || message.includes(`"${ext}/`)
              );

            if (isExternalWarning) {
              return;
            }

            // Подавляем другие некритические предупреждения
            if (
              warning.code !== 'CIRCULAR_DEPENDENCY' && warning.code !== 'UNUSED_EXTERNAL_IMPORT'
            ) {
              console.warn(`⚠️  ${packageName}: ${message}`);
            }
          },
          plugins: [
            visualizer({
              filename: `reports/bundles/${packageName}.graph.html`,
              title: `Bundle Graph — ${packageName}`,
              gzipSize: true,
              brotliSize: true,
              template: 'treemap',
              open: false,
            }),
          ],
        });

        await bundle.generate({ format: 'esm' });
        await bundle.close();

        if (!quiet) console.log(`✅ Сгенерирован graph-отчет для ${packageName}`);
      } catch (graphError) {
        if (!quiet) {
          console.warn(
            `⚠️  Не удалось сгенерировать граф для ${packageName}: ${graphError.message}`,
          );
        }
      }
    }

    // Проверяем бюджеты
    checkBudgets(packageName, { raw: rawSize, gzip: gzipSize, brotli: brotliSize });

    return {
      package: packageName,
      entry: relativeEntry,
      sizes: {
        raw: rawSize,
        gzip: gzipSize,
        brotli: brotliSize,
      },
    };
  } catch (error) {
    if (!quiet) console.error(`❌ Error analyzing ${packageName}: ${error.message}`);
    return null;
  }
}

/**
 * Генерирует HTML отчет с анализом размеров бандла
 * @param {string} packageName - Имя пакета
 * @param {string} entryFile - Путь к entry файлу
 * @param {Object} sizes - Объект с размерами {raw, gzip, brotli}
 * @returns {string} HTML разметка отчета
 */
function generateSizeHtmlReport(packageName, entryFile, sizes) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bundle Analysis: ${packageName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .stats { display: flex; gap: 20px; }
    .stat { background: white; padding: 15px; border-radius: 8px; border: 1px solid #ddd; }
    .stat h3 { margin: 0 0 10px 0; color: #666; }
    .stat .value { font-size: 24px; font-weight: bold; color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📦 Bundle Analysis: ${packageName}</h1>
    <p><strong>Entry file:</strong> ${entryFile}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <h3>Raw Size</h3>
      <div class="value">${formatSize(sizes.raw)}</div>
    </div>
    <div class="stat">
      <h3>Gzip Size</h3>
      <div class="value">${formatSize(sizes.gzip)}</div>
    </div>
    <div class="stat">
      <h3>Brotli Size</h3>
      <div class="value">${formatSize(sizes.brotli)}</div>
    </div>
  </div>

  <div style="margin-top: 30px;">
    <h2>📊 Compression Efficiency</h2>
    <p>Gzip ratio: ${((1 - sizes.gzip / sizes.raw) * 100).toFixed(1)}%</p>
    <p>Brotli ratio: ${((1 - sizes.brotli / sizes.raw) * 100).toFixed(1)}%</p>
  </div>
</body>
</html>`;
}

/**
 * Форматирует размер в байтах в читаемый формат
 * @param {number} bytes - Размер в байтах
 * @returns {string} Отформатированная строка размера
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Выводит сводку результатов анализа в консоль
 * @param {Array} results - Массив результатов анализа пакетов
 */
function printSummary(results) {
  console.log('\n📈 Сводка анализа бандлов');
  console.log('='.repeat(60));

  const validResults = results.filter((r) => r !== null);

  if (validResults.length === 0) {
    console.log('Бандлы для анализа не найдены.');
    return;
  }

  console.log(
    'Пакет'.padEnd(20),
    'Размер'.padStart(10),
    'Gzip'.padStart(10),
    'Brotli'.padStart(10),
  );
  console.log('-'.repeat(60));

  let totalRaw = 0, totalGzip = 0, totalBrotli = 0;

  for (const result of validResults) {
    const { package: pkg, sizes } = result;
    console.log(
      pkg.padEnd(20),
      formatSize(sizes.raw).padStart(10),
      formatSize(sizes.gzip).padStart(10),
      formatSize(sizes.brotli).padStart(10),
    );

    totalRaw += sizes.raw;
    totalGzip += sizes.gzip;
    totalBrotli += sizes.brotli;
  }

  console.log('='.repeat(60));
  console.log(
    'ИТОГО'.padEnd(20),
    formatSize(totalRaw).padStart(10),
    formatSize(totalGzip).padStart(10),
    formatSize(totalBrotli).padStart(10),
  );

  console.log('\n📄 Отчеты сохранены в: reports/bundles/');
  console.log('  - *.size.html: Анализ размеров (raw/gzip/brotli)');
  console.log('  - *.graph.html: Граф зависимостей (dependency tree)');
  console.log('📊 Сводка сохранена в: reports/bundles-summary.json');
}

/**
 * Основная функция скрипта
 */
async function main() {
  if (!quiet) console.log('🔍 Анализируем бандлы в LivAiBot монорепо...');

  const packages = await findPackages();
  if (!quiet) console.log(`Найдено ${packages.length} пакетов\n`);

  // Загружаем baseline для сравнения
  let baseline = null;
  if (compareRef !== 'none') {
    if (!quiet) console.log(`📊 Загружаем baseline из ${compareRef}...\n`);
    baseline = await loadBaseline(compareRef);
    if (!baseline) {
      if (!quiet) console.log(`⚠️  Baseline из ${compareRef} недоступен, сравнение отключено\n`);
    }
  }

  const results = [];

  for (const pkg of packages) {
    const entryFile = findPrimaryEntry(pkg.path);
    const result = await analyzeBundle(pkg.name, entryFile);
    if (result) {
      results.push(result);

      // Показываем diff если есть baseline
      if (baseline && baseline[pkg.name]) {
        showDiff(pkg.name, result.sizes, baseline[pkg.name]);
        console.log(); // Пустая строка для читаемости
      }
    }
  }

  printSummary(results);

  // Сохраняем сводку в JSON
  const fs = await import('fs');
  mkdirSync('reports', { recursive: true });
  await fs.writeFileSync(
    SUMMARY_FILE,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        packages: results.filter((r) => r !== null),
        budgetExceeded,
      },
      null,
      2,
    ),
  );

  if (budgetExceeded) {
    console.log('\n❌ Анализ бандлов завершен с превышением бюджета!');
    process.exit(1);
  } else {
    console.log('\n✅ Анализ бандлов завершен успешно!');
  }
}

main().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

// Добавляем quiet режим в справку
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Анализ бандлов для LivAiBot монорепо

Использование:
  node scripts/analyze-bundles.js [опции]

Опции:
  --size-only        Только анализ размеров (быстрее)
  --graph-only       Только анализ графа зависимостей
  --compare=<ref>    Сравнить с git reference (main, tag, etc.)
  --compare=none     Без сравнения
  --quiet           Тихий режим (меньше вывода)
  --help, -h        Показать эту справку

Примеры:
  node scripts/analyze-bundles.js
  node scripts/analyze-bundles.js --size-only --quiet
  node scripts/analyze-bundles.js --compare=v1.0.0
`);
  process.exit(0);
}
