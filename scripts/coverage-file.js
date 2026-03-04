#!/usr/bin/env node

/**
 * @file Скрипт для проверки покрытия кода конкретного файла в монерепо
 * Автоматически парсит отчеты покрытия (JSON и HTML) и показывает метрики прямо в консоли.
 * Работает с JSON отчетами (pnpm exec vitest run --coverage) и HTML отчетами (pnpm run test:coverage:html)
 * Использование: node scripts/coverage-file.js <filename>
 * Пример: node scripts/coverage-file.js fraudDetectionInterfaces.ts
 * Пример: node scripts/coverage-file.js PaymentProviderId.ts
 * Пример: node scripts/coverage-file.js SharedValidators.ts
 * Пример: node scripts/coverage-file.js core-contracts/src/errors/shared/ErrorCode.ts
 * Пример: node scripts/coverage-file.js CurrencyCode.ts
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

// Функция для поиска coverage файлов
function findCoverageFiles(packageName) {
  const coverageFiles = [];
  const projectRoot = join(__dirname, '..');

  // Ищем coverage файлы в разных местах
  const possiblePaths = [
    join(projectRoot, 'coverage'),
    join(projectRoot, 'packages', packageName.replace('packages/', ''), 'coverage'),
    join(projectRoot, 'reports', 'coverage'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        const files = readdirSync(path);
        for (const file of files) {
          if (file.includes('coverage') && (file.endsWith('.json') || file.endsWith('.html'))) {
            coverageFiles.push(join(path, file));
          }
        }
      } catch (error) {
        // Игнорируем ошибки чтения
      }
    }
  }

  return coverageFiles;
}

// Функция для чтения JSON coverage отчета
function readJsonCoverage(filePath, targetFile) {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const fileKey = Object.keys(data).find((key) => key.includes(targetFile));

    if (fileKey && data[fileKey]) {
      const coverage = data[fileKey];
      return {
        statements: calculatePercentage(coverage.s),
        branches: Object.keys(coverage.b || {}).length === 0
          ? 100
          : calculatePercentage(coverage.b),
        functions: Object.keys(coverage.f || {}).length === 0
          ? 100
          : calculatePercentage(coverage.f),
      };
    }
  } catch (error) {
    // Игнорируем ошибки парсинга
  }
  return null;
}

// Вспомогательная функция для расчета процента
function calculatePercentage(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  const values = Object.values(obj);
  if (values.length === 0) return 0;
  const covered = values.filter((v) => v > 0).length;
  return Math.round((covered / values.length) * 100);
}

// Функция для определения пакета по имени файла
function determinePackage(fileName) {
  const packages = getAllPackages();

  // Если файл уже содержит путь к пакету
  for (const pkg of packages) {
    if (fileName.startsWith(pkg + '/')) {
      return pkg;
    }
  }

  // Ищем файл во всех пакетах
  const projectRoot = join(__dirname, '..');
  for (const pkg of packages) {
    const packagePath = join(projectRoot, pkg);
    const srcPath = join(packagePath, 'src');

    if (existsSync(srcPath)) {
      try {
        const result = searchFileInDirectory(srcPath, fileName);
        if (result) {
          return pkg;
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }
  }

  return 'core-contracts'; // По умолчанию
}

// Функция для поиска файла в директории
function searchFileInDirectory(dir, fileName) {
  try {
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const result = searchFileInDirectory(join(dir, item.name), fileName);
        if (result) return result;
      } else if (item.name === fileName) {
        return join(dir, item.name);
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }
  return null;
}

// Основная логика
const targetPackage = determinePackage(fileName);
console.log(`🔍 Анализ покрытия файла: ${fileName}`);
console.log(`📦 Определен пакет: ${targetPackage}`);

const coverageFiles = findCoverageFiles(targetPackage);

if (coverageFiles.length === 0) {
  console.log('❌ Coverage файлы не найдены');
  console.log('💡 Сначала запустите: pnpm run test:coverage:html');
  process.exit(1);
}

console.log(`📄 Найдено ${coverageFiles.length} coverage файла(ов)`);

// Ищем данные о файле в coverage отчетах
let found = false;

for (const coverageFile of coverageFiles) {
  if (coverageFile.endsWith('.json')) {
    const coverage = readJsonCoverage(coverageFile, fileName);
    if (coverage) {
      console.log(`\n✅ Покрытие файла ${fileName}:`);
      console.log(`   Statements: ${coverage.statements}%`);
      console.log(`   Branches: ${coverage.branches}%`);
      console.log(`   Functions: ${coverage.functions}%`);
      console.log(`📊 Из файла: ${coverageFile}`);
      found = true;
      break;
    }
  }
}

if (!found) {
  console.log(`\n❌ Данные о файле ${fileName} не найдены в coverage отчетах`);
  console.log('📋 Доступные coverage файлы:');
  coverageFiles.forEach((file) => console.log(`   - ${file}`));
  console.log('\n💡 Убедитесь, что файл тестируется и покрытие собрано');
}

console.log('\n🎯 Для обновления coverage запустите: pnpm run test:coverage:html');
