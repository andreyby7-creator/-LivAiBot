#!/usr/bin/env tsx

// @ts-check

/**
 * @file check-circular-deps-core-contracts.js
 * Проверка циклических зависимостей в core-contracts
 *
 * Запуск: pnpm run check:deps
 * Используется в CI/CD для автоматической проверки
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Object.<string, string[]>} DependencyGraph
 */

/**
 * Извлекает импорты из файла
 * @param {string} filePath - путь к файлу
 * @param {string} srcDir - директория src
 * @returns {string[]} массив импортов
 */
function extractImports(filePath, srcDir) {
  /** @type {string[]} */
  // Валидация входных параметров для безопасности
  if (typeof filePath !== 'string' || typeof srcDir !== 'string' || !filePath || !srcDir) {
    return [];
  }

  // Проверка на безопасный путь - только абсолютные пути без .. и только внутри разрешенной директории
  const resolvedSrcDir = path.resolve(srcDir);
  const resolvedFilePath = path.resolve(filePath);

  if (!resolvedFilePath.startsWith(resolvedSrcDir) || resolvedFilePath.includes('..')) {
    return [];
  }

  // Дополнительная проверка: путь должен быть каноническим
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath !== filePath) {
    return [];
  }

  try {
    // Создаем whitelist разрешенных путей для fs.readFileSync
    const allowedPaths = [resolvedFilePath];
    const safePath = allowedPaths.find(p => p === resolvedFilePath);

    if (!safePath) {
      return [];
    }

    const content = fs.readFileSync(safePath, 'utf8');
    const imports = [];

    // Регулярное выражение для поиска import statements
    const importRegex = /import\s+.*?from\s+['\"]([^'\"]+)['\"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath == null) continue;

      let resolvedPath = importPath;

      // Преобразуем относительные пути
      if (resolvedPath.startsWith('.')) {
        const dir = path.dirname(filePath);
        resolvedPath = path.resolve(dir, resolvedPath);
        // Относительно src директории
        resolvedPath = path.relative(srcDir, resolvedPath).replace(/\\./g, '/');
      }

      // Убираем расширения
      resolvedPath = resolvedPath.replace(/(\.js|\.ts)$/, '');

      imports.push(resolvedPath);
    }

    return imports;
  } catch {
    return [];
  }
}

/**
 * Рекурсивно находит все .ts и .js файлы
 * @param {string} dir - директория для поиска
 * @returns {string[]} массив файлов
 */
function findTsFiles(dir) {
  /** @type {string[]} */
  // Валидация входного параметра
  if (typeof dir !== 'string' || !dir || dir.includes('..')) {
    return [];
  }

  // Проверка на абсолютный путь и разрешенную директорию
  const resolvedDir = path.resolve(dir);
  const normalizedDir = path.normalize(dir);

  if (normalizedDir !== dir || resolvedDir.includes('..')) {
    return [];
  }

  const result = [];
  // Создаем whitelist для fs.readdirSync
  const allowedDirs = [resolvedDir];
  const safeDir = allowedDirs.find(d => d === resolvedDir);

  if (!safeDir) {
    return [];
  }

  const items = fs.readdirSync(safeDir);

  for (const item of items) {
    const fullPath = path.join(safeDir, item);

    // Проверяем, что путь безопасный
    if (fullPath.includes('..') || !fullPath.startsWith(safeDir)) {
      continue;
    }

    // Создаем whitelist для fs.statSync
    const allowedStatPaths = [fullPath];
    const safeStatPath = allowedStatPaths.find(p => p === fullPath);

    if (!safeStatPath) {
      continue;
    }

    const stat = fs.statSync(safeStatPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      const subFiles = findTsFiles(fullPath);
      result.push(...subFiles);
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
      result.push(fullPath);
    }
  }

  return result;
}

/**
 * Детектирует циклические зависимости
 * @param {DependencyGraph} graph - граф зависимостей
 * @returns {[string, string][]} массив циклов
 */
function detectCircularDependencies(graph) {
  /** @type {[string, string][]} */
  // Валидация входного параметра
  if (!graph || typeof graph !== 'object' || graph.constructor !== Object) {
    return [];
  }

  /** @type {[string, string][]} */
  const cycles = [];
  /** @type {Set<string>} */
  const processedFiles = new Set();

  for (const [file, deps] of Object.entries(graph)) {
    if (typeof file !== 'string' || !Array.isArray(deps)) continue;

    // Проверяем только допустимые строки
    if (!/^[a-zA-Z0-9\-_.\/]+$/.test(file)) continue;

    for (const dep of deps) {
      if (typeof dep !== 'string' || !/^[a-zA-Z0-9\-_.\/]+$/.test(dep)) continue;

      // Проверяем обратную зависимость с безопасным доступом
      const reverseDeps = Object.prototype.hasOwnProperty.call(graph, dep) ? graph[dep] : undefined;
      if (Array.isArray(reverseDeps) && reverseDeps.includes(file) && !processedFiles.has(`${file}-${dep}`)) {
        cycles.push([file, dep]);
        processedFiles.add(`${file}-${dep}`);
      }
    }
  }

  return cycles;
}

/**
 * Основная функция
 */
function main() {
  process.stdout.write('🔄 Проверка циклических зависимостей в core-contracts...\n');

  // Скрипт находится в core-contracts/scripts, поэтому src находится на уровень выше
  const coreContractsPath = path.resolve(__dirname, '..');
  const srcDir = path.join(coreContractsPath, 'src');
  const files = findTsFiles(srcDir);
  /** @type {{ [key: string]: string[] }} */
  const graph = {};

  process.stdout.write(`📁 Найдено ${files.length} файлов для анализа\n`);

  // Строим граф зависимостей
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/(\.js|\.ts)$/, '');

    // Валидация relativePath
    if (!relativePath || typeof relativePath !== 'string' || !/^[a-zA-Z0-9\-_.\/]+$/.test(relativePath)) {
      continue;
    }

    const imports = extractImports(file, srcDir);
    // Безопасное присваивание с дополнительной валидацией
    if (typeof relativePath === 'string' && relativePath.length > 0 && !relativePath.includes('..')) {
      graph[relativePath] = imports;
    }
  }

  // Проверяем циклы
  const cycles = detectCircularDependencies(graph);

  if (cycles.length === 0) {
    process.stdout.write('✅ Циклических зависимостей не найдено\n');

    // Выводим статистику
    let totalDeps = 0;
    for (const deps of Object.values(graph)) {
      totalDeps += deps.length;
    }

    const DECIMAL_PLACES = 2;
    const fileCount = Object.keys(graph).length;

    process.stdout.write(`📊 Статистика:\n`);
    process.stdout.write(`   Файлов: ${fileCount}\n`);
    process.stdout.write(`   Зависимостей: ${totalDeps}\n`);
    process.stdout.write(`   Среднее на файл: ${(totalDeps / fileCount).toFixed(DECIMAL_PLACES)}\n`);

    process.exit(0);
  } else {
    process.stderr.write('❌ Найдены циклические зависимости:\n');
    for (const [file, dep] of cycles) {
      process.stderr.write(`   ${file} ↔ ${dep}\n`);
    }

    process.stderr.write(`\n🚨 ${cycles.length} цикл(ов) зависимостей найдено!\n`);
    process.stderr.write('🔧 Исправьте циклы перед коммитом.\n');

    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`❌ Ошибка при проверке зависимостей: ${error}\n`);
  process.exit(1);
}
