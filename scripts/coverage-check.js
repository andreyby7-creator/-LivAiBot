#!/usr/bin/env node

/**
 * @file Скрипт для анализа проблем покрытия кода
 * Анализирует coverage отчеты и выявляет файлы/функции с низким покрытием
 * Использование: node scripts/coverage-check.js
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COVERAGE_THRESHOLD = {
  statements: 80,
  branches: 75,
  functions: 80,
};

console.log('🔍 Анализ проблем покрытия кода...\n');

// Функция для поиска coverage файлов
function findCoverageFiles() {
  const projectRoot = join(__dirname, '..');
  const possiblePaths = [
    join(projectRoot, 'coverage', 'coverage-final.json'),
    join(projectRoot, 'packages', 'core-contracts', 'coverage', 'coverage-final.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

// Функция для анализа coverage данных
function analyzeCoverage(coverageData) {
  const issues = {
    lowStatements: [],
    lowBranches: [],
    lowFunctions: [],
    uncoveredFiles: [],
  };

  // Исключения: файлы с только типами (type-only files)
  const typeOnlyPatterns = [
    /\/domain\//, // Domain типы
    /\/types\//, // Папки с типами
    /\.d\.ts$/, // Declaration files
  ];

  for (const [filePath, coverage] of Object.entries(coverageData)) {
    // Пропускаем файлы с только типами
    const isTypeOnly = typeOnlyPatterns.some((pattern) => pattern.test(filePath));
    if (isTypeOnly) {
      continue;
    }

    const statements = calculatePercentage(coverage.s);
    // Для branches/functions: если массив пустой, считаем 100% (нет элементов для покрытия)
    const branches = Object.keys(coverage.b || {}).length === 0
      ? 100
      : calculatePercentage(coverage.b);
    const functions = Object.keys(coverage.f || {}).length === 0
      ? 100
      : calculatePercentage(coverage.f);

    // Проверяем на нулевое покрытие (только statements, branches, functions)
    if (statements === 0 && branches === 0 && functions === 0) {
      issues.uncoveredFiles.push(filePath);
      continue;
    }

    // Проверяем пороги только если есть элементы для покрытия
    if (statements < COVERAGE_THRESHOLD.statements) {
      issues.lowStatements.push({ file: filePath, coverage: statements });
    }
    if (Object.keys(coverage.b || {}).length > 0 && branches < COVERAGE_THRESHOLD.branches) {
      issues.lowBranches.push({ file: filePath, coverage: branches });
    }
    if (Object.keys(coverage.f || {}).length > 0 && functions < COVERAGE_THRESHOLD.functions) {
      issues.lowFunctions.push({ file: filePath, coverage: functions });
    }
  }

  return issues;
}

// Вспомогательная функция для расчета процента
function calculatePercentage(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  const values = Object.values(obj);
  if (values.length === 0) return 0;
  const covered = values.filter((v) => v > 0).length;
  return Math.round((covered / values.length) * 100);
}

// Основная логика
const coverageFile = findCoverageFiles();

if (!coverageFile) {
  console.log('❌ Coverage файл не найден');
  console.log('💡 Сначала запустите: pnpm run test:coverage:html');
  process.exit(1);
}

try {
  const coverageData = JSON.parse(readFileSync(coverageFile, 'utf8'));

  // Фильтруем coverage данные - оставляем только существующие файлы
  const filteredCoverageData = {};
  for (const [filePath, coverage] of Object.entries(coverageData)) {
    if (existsSync(filePath)) {
      filteredCoverageData[filePath] = coverage;
    }
  }

  const issues = analyzeCoverage(filteredCoverageData);

  console.log(`📊 Анализ coverage файла: ${coverageFile}\n`);

  let hasIssues = false;

  // Проверяем непокрытые файлы
  if (issues.uncoveredFiles.length > 0) {
    console.log('🚨 Непокрытые файлы:');
    issues.uncoveredFiles.forEach((file) => console.log(`   ❌ ${file}`));
    hasIssues = true;
    console.log();
  }

  // Проверяем низкое покрытие statements
  if (issues.lowStatements.length > 0) {
    console.log(`⚠️  Файлы с низким покрытием statements (< ${COVERAGE_THRESHOLD.statements}%):`);
    issues.lowStatements.forEach((item) => console.log(`   📉 ${item.file}: ${item.coverage}%`));
    hasIssues = true;
    console.log();
  }

  // Проверяем низкое покрытие branches
  if (issues.lowBranches.length > 0) {
    console.log(`⚠️  Файлы с низким покрытием branches (< ${COVERAGE_THRESHOLD.branches}%):`);
    issues.lowBranches.forEach((item) => console.log(`   🌿 ${item.file}: ${item.coverage}%`));
    hasIssues = true;
    console.log();
  }

  // Проверяем низкое покрытие functions
  if (issues.lowFunctions.length > 0) {
    console.log(`⚠️  Файлы с низким покрытием functions (< ${COVERAGE_THRESHOLD.functions}%):`);
    issues.lowFunctions.forEach((item) => console.log(`   🔧 ${item.file}: ${item.coverage}%`));
    hasIssues = true;
    console.log();
  }

  if (!hasIssues) {
    console.log('✅ Все файлы соответствуют требованиям покрытия!');
    console.log(`🎯 Минимальные требования:`);
    console.log(`   Statements: ${COVERAGE_THRESHOLD.statements}%`);
    console.log(`   Branches: ${COVERAGE_THRESHOLD.branches}%`);
    console.log(`   Functions: ${COVERAGE_THRESHOLD.functions}%`);
  } else {
    console.log('💡 Рекомендации:');
    console.log('   - Добавьте тесты для непокрытых файлов');
    console.log('   - Улучшите тесты для файлов с низким покрытием');
    console.log('   - Рассмотрите возможность исключения файлов из покрытия');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Ошибка при анализе coverage файла:', error.message);
  process.exit(1);
}
