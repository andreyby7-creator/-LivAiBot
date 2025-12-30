#!/usr/bin/env node

/**
 * @file Скрипт для проверки покрытия кода конкретного файла в монерепо
 *
 * Автоматически парсит отчеты покрытия (JSON и HTML) и показывает метрики прямо в консоли.
 * Работает с JSON отчетами (pnpm exec vitest run --coverage) и HTML отчетами (pnpm run test:coverage:html)
 *
 * Использование: node scripts/coverage-file.js <filename>
 * Пример: node scripts/coverage-file.js fraudDetectionInterfaces.ts
 * Пример: node scripts/coverage-file.js PaymentProviderId.ts
 * Пример: node scripts/coverage-file.js SharedValidators.ts
 * Пример: node scripts/coverage-file.js core-contracts/src/errors/shared/ErrorCode.ts
 * Пример: node scripts/coverage-file.js CurrencyCode.ts
 *
 * Особенности:
 * - Автоматически определяет пакет по имени файла
 * - Поддерживает JSON отчеты от отдельных тестов (предпочтительно)
 * - Поддерживает HTML отчеты от полного coverage
 * - Рекурсивно ищет файлы покрытия
 * - Показывает реальные метрики: Statements, Branches, Functions, Lines
 * - Для неизвестных файлов показывает доступные отчеты
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fileName = process.argv[2];

if (!fileName) {
  console.log('❌ Ошибка: Укажите имя файла');
  console.log('📖 Использование: node scripts/coverage-file.js <filename>');
  console.log('📝 Пример: node scripts/coverage-file.js ErrorCode.ts');
  console.log(
    '📝 Пример: node scripts/coverage-file.js core-contracts/src/errors/shared/ErrorCode.ts',
  );
  process.exit(1);
}

// Функция для получения списка всех пакетов
function getAllPackages() {
  const projectRoot = join(__dirname, '..');
  const packages = ['core-contracts'];

  try {
    const packagesDir = join(projectRoot, 'packages');
    if (existsSync(packagesDir)) {
      const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => `packages/${dirent.name}`);
      packages.push(...packageDirs);
    }
  } catch (error) {
    // Игнорируем ошибки чтения директории
  }

  return packages;
}

// Функция для определения пакета по пути файла
function findPackageForFile(filePath) {
  const projectRoot = join(__dirname, '..');

  // Если путь содержит имя пакета, используем его
  if (filePath.includes('/')) {
    const packages = getAllPackages();
    for (const pkg of packages) {
      if (filePath.startsWith(pkg + '/')) {
        return pkg;
      }
    }
  }

  // Для простоты - если файл содержит ключевые слова, определяем пакет
  const actualFileName = filePath.includes('/') ? filePath.split('/').pop() : filePath;

  // Определяем пакет по имени файла или содержимому пути
  if (
    actualFileName.includes('fraudDetection')
    || actualFileName.includes('billing')
    || actualFileName.includes('BillingService')
    || filePath.includes('billing-service')
  ) {
    return 'core-contracts';
  }

  if (actualFileName.includes('PaymentProvider') || actualFileName.includes('shared')) {
    return 'core-contracts';
  }

  // По умолчанию возвращаем core-contracts, так как там большинство тестов
  return 'core-contracts';
}

// Определяем пакет для файла
const packageName = findPackageForFile(fileName);
const actualFileName = fileName.includes('/') ? fileName.split('/').pop() : fileName;

if (!packageName) {
  console.log(`❌ Не удалось определить пакет для файла "${fileName}"`);
  console.log('💡 Убедитесь, что запущены тесты с покрытием: pnpm run test:coverage:html');
  console.log('📦 Доступные пакеты:', getAllPackages().join(', '));
  process.exit(1);
}

try {
  // Проверяем наличие отчетов покрытия (HTML или JSON)
  const coverageDir = join(__dirname, '..', packageName, 'coverage');
  const indexHtmlPath = join(coverageDir, 'index.html');
  const coverageJsonPath = join(coverageDir, 'coverage-final.json');

  const hasHtmlReport = existsSync(indexHtmlPath);
  const hasJsonReport = existsSync(coverageJsonPath);

  if (!hasHtmlReport && !hasJsonReport) {
    console.log(`❌ Отчеты покрытия не найдены в пакете ${packageName}`);
    console.log('💡 Запустите один из вариантов:');
    console.log('   - pnpm run test:coverage:html (для полного HTML отчета)');
    console.log('   - pnpm exec vitest run --coverage (для JSON отчета конкретного теста)');
    process.exit(1);
  }

  // Функция для парсинга метрик покрытия из JSON файла
  function parseCoverageMetricsFromJson(jsonContent, fileName) {
    try {
      const coverageData = JSON.parse(jsonContent);
      const metrics = {};

      // Ищем файл в отчете покрытия
      for (const [filePath, fileData] of Object.entries(coverageData)) {
        if (filePath.includes(fileName.replace('.ts', ''))) {
          // Вычисляем метрики из массивов s, f, b
          const statementsCovered = Object.values(fileData.s).filter((count) => count > 0).length;
          const statementsTotal = Object.keys(fileData.s).length;

          const functionsCovered = Object.values(fileData.f).filter((count) => count > 0).length;
          const functionsTotal = Object.keys(fileData.f).length;

          const branchesCovered = Object.values(fileData.b).flat().filter((count) =>
            count > 0
          ).length;
          const branchesTotal = Object.values(fileData.b).flat().length;

          // Для lines используем statements (приближенно)
          const linesCovered = statementsCovered;
          const linesTotal = statementsTotal;

          metrics.statements = {
            percentage: statementsTotal > 0
              ? Math.round((statementsCovered / statementsTotal) * 100)
              : 0,
            fraction: `${statementsCovered}/${statementsTotal}`,
          };
          metrics.functions = {
            percentage: functionsTotal > 0
              ? Math.round((functionsCovered / functionsTotal) * 100)
              : 0,
            fraction: `${functionsCovered}/${functionsTotal}`,
          };
          metrics.branches = {
            percentage: branchesTotal > 0 ? Math.round((branchesCovered / branchesTotal) * 100) : 0,
            fraction: `${branchesCovered}/${branchesTotal}`,
          };
          metrics.lines = {
            percentage: linesTotal > 0 ? Math.round((linesCovered / linesTotal) * 100) : 0,
            fraction: `${linesCovered}/${linesTotal}`,
          };
          break;
        }
      }

      return metrics;
    } catch (error) {
      console.log(`⚠️  Не удалось распарсить JSON отчет покрытия: ${error.message}`);
      return {};
    }
  }

  // Функция для парсинга метрик покрытия из HTML файла
  function parseCoverageMetricsFromHtml(htmlContent) {
    const metrics = {};

    // Найдем все блоки с метриками
    const blockMatches = htmlContent.match(/<div class='fl pad1y space-right2'>([\s\S]*?)<\/div>/g);

    if (blockMatches) {
      const metricTypes = ['statements', 'branches', 'functions', 'lines'];

      blockMatches.forEach((block, index) => {
        if (index < metricTypes.length) {
          const metricType = metricTypes[index];
          const percentageMatch = block.match(/<span class="strong">(\d+(?:\.\d+)?)% <\/span>/);
          const fractionMatch = block.match(/<span class='fraction'>(\d+\/\d+)<\/span>/);

          if (percentageMatch && fractionMatch) {
            metrics[metricType] = {
              percentage: parseFloat(percentageMatch[1]),
              fraction: fractionMatch[1],
            };
          }
        }
      });
    }

    return metrics;
  }

  // Функция для поиска HTML файла покрытия
  function findCoverageFile(fileName) {
    // Известные пути для файлов
    const knownFiles = {
      'fraudDetectionInterfaces': {
        path: join(
          coverageDir,
          'services',
          'billing-service',
          'policies',
          'fraudDetectionInterfaces.ts.html',
        ),
        displayName: 'services/billing-service/policies/fraudDetectionInterfaces.ts',
      },
      'PaymentProviderId': {
        path: join(coverageDir, 'shared', 'PaymentProviderId.ts.html'),
        displayName: 'shared/PaymentProviderId.ts',
      },
    };

    // Ищем точное совпадение
    for (const [key, info] of Object.entries(knownFiles)) {
      if (fileName.includes(key) && existsSync(info.path)) {
        return info;
      }
    }

    // Ищем по всем HTML файлам в coverage директории
    const findFileRecursively = (dir, targetName) => {
      try {
        const items = readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.isDirectory()) {
            const result = findFileRecursively(join(dir, item.name), targetName);
            if (result) return result;
          } else if (
            item.isFile() && item.name.endsWith('.html') && item.name.includes(targetName)
          ) {
            return {
              path: join(dir, item.name),
              displayName: item.name.replace('.html', ''),
            };
          }
        }
      } catch (error) {
        // Игнорируем ошибки чтения
      }
      return null;
    };

    return findFileRecursively(coverageDir, fileName.replace('.ts', ''));
  }

  // Проверяем JSON отчет покрытия первым (более свежий)
  let metrics = {};
  let reportType = '';
  let reportPath = '';

  if (hasJsonReport) {
    try {
      const jsonContent = readFileSync(coverageJsonPath, 'utf8');
      metrics = parseCoverageMetricsFromJson(jsonContent, actualFileName);
      reportType = 'JSON';
      reportPath = coverageJsonPath;

      // Если метрики найдены, используем их
      if (Object.keys(metrics).length > 0) {
        console.log(`📊 Покрытие кода из JSON отчета для файла: ${actualFileName}`);
      }
    } catch (error) {
      console.log(`⚠️  Ошибка чтения JSON отчета: ${error.message}`);
    }
  }

  // Если JSON не дал результатов, пробуем HTML отчет
  if (Object.keys(metrics).length === 0 && hasHtmlReport) {
    const fileInfo = findCoverageFile(actualFileName);

    if (fileInfo && existsSync(fileInfo.path)) {
      try {
        const htmlContent = readFileSync(fileInfo.path, 'utf8');
        metrics = parseCoverageMetricsFromHtml(htmlContent);
        reportType = 'HTML';
        reportPath = fileInfo.path;

        console.log(`📊 Покрытие кода из HTML отчета для файла: ${fileInfo.displayName}`);
      } catch (error) {
        console.log(`⚠️  Ошибка чтения HTML отчета: ${error.message}`);
      }
    }
  }

  // Выводим результаты
  if (Object.keys(metrics).length > 0) {
    console.log(
      `   📝 Statements: ${metrics.statements?.percentage || 0}% (${
        metrics.statements?.fraction || '0/0'
      })`,
    );
    console.log(
      `   🌿 Branches: ${metrics.branches?.percentage || 0}% (${
        metrics.branches?.fraction || '0/0'
      })`,
    );
    console.log(
      `   🔧 Functions: ${metrics.functions?.percentage || 0}% (${
        metrics.functions?.fraction || '0/0'
      })`,
    );
    console.log(
      `   📏 Lines: ${metrics.lines?.percentage || 0}% (${metrics.lines?.fraction || '0/0'})`,
    );

    // Вычисляем среднее покрытие
    const avgCoverage = Object.values(metrics).reduce((sum, metric) =>
      sum + (metric.percentage || 0), 0) / Object.keys(metrics).length;

    if (avgCoverage >= 95) {
      console.log(`✅ Отличное покрытие (${Math.round(avgCoverage)}%)!`);
    } else if (avgCoverage >= 80) {
      console.log(`👍 Хорошее покрытие (${Math.round(avgCoverage)}%)`);
    } else if (avgCoverage >= 70) {
      console.log(
        `⚠️  Среднее покрытие (${Math.round(avgCoverage)}%) - рекомендуется добавить тесты`,
      );
    } else {
      console.log(`❌ Низкое покрытие (${Math.round(avgCoverage)}%) - требуется добавить тесты`);
    }

    console.log(`\n🔗 Полный ${reportType} отчет: file://${reportPath}`);
  } else {
    console.log(`❌ Метрики покрытия для "${actualFileName}" не найдены`);
    console.log(`📁 Доступные отчеты в пакете ${packageName}:`);

    if (hasJsonReport) {
      console.log(`   JSON отчет: file://${coverageJsonPath}`);
      console.log(`   💡 Создан командой: pnpm exec vitest run --coverage`);
    }

    if (hasHtmlReport) {
      console.log(`   Главный HTML отчет: file://${indexHtmlPath}`);
      console.log(`   💡 Создан командой: pnpm run test:coverage:html`);
      console.log(`   💡 Откройте в браузере для просмотра всех файлов покрытия`);
    }

    if (!hasJsonReport && !hasHtmlReport) {
      console.log('   Нет доступных отчетов покрытия');
    }
  }
} catch (error) {
  console.error('❌ Ошибка при обработке файла покрытия:', error.message);
  process.exit(1);
}
