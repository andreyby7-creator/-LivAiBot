#!/usr/bin/env tsx

/* eslint-disable
  @typescript-eslint/explicit-function-return-type,
  security/detect-non-literal-fs-filename,
  security/detect-object-injection,
  no-console,
  security-node/detect-crlf,
  no-magic-numbers
*/

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
  try {
    const content = fs.readFileSync(filePath, 'utf8');
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
  const result = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

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
  const cycles = [];

  for (const [file, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      // Проверяем обратную зависимость
      const reverseDeps = graph[dep] ?? [];
      if (reverseDeps.includes(file)) {
        cycles.push([file, dep]);
      }
    }
  }

  return cycles;
}

/**
 * Основная функция
 */
function main() {
  console.log('🔄 Проверка циклических зависимостей в core-contracts...\n');

  // Скрипт находится в core-contracts/scripts, поэтому src находится на уровень выше
  const coreContractsPath = path.resolve(__dirname, '..');
  const srcDir = path.join(coreContractsPath, 'src');
  const files = findTsFiles(srcDir);
  const graph = {};

  console.log(`📁 Найдено ${files.length} файлов для анализа`);

  // Строим граф зависимостей
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/(\.js|\.ts)$/, '');
    const imports = extractImports(file, srcDir);
    graph[relativePath] = imports;
  }

  // Проверяем циклы
  const cycles = detectCircularDependencies(graph);

  if (cycles.length === 0) {
    console.log('✅ Циклических зависимостей не найдено');

    // Выводим статистику
    let totalDeps = 0;
    for (const deps of Object.values(graph)) {
      totalDeps += deps.length;
    }

    console.log(`📊 Статистика:`);
    console.log(`   Файлов: ${Object.keys(graph).length}`);
    console.log(`   Зависимостей: ${totalDeps}`);
    console.log(`   Среднее на файл: ${(totalDeps / Object.keys(graph).length).toFixed(2)}`);

    process.exit(0);
  } else {
    console.error('❌ Найдены циклические зависимости:');
    for (const [file, dep] of cycles) {
      console.error(`   ${file} ↔ ${dep}`);
    }

    console.error(`\n🚨 ${cycles.length} цикл(ов) зависимостей найдено!`);
    console.error('🔧 Исправьте циклы перед коммитом.');

    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error('❌ Ошибка при проверке зависимостей:', error);
  process.exit(1);
}
