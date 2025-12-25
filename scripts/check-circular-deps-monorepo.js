#!/usr/bin/env tsx

// @ts-check

/**
 * @file check-circular-deps-monorepo.js
 * Проверка циклических зависимостей в монорепо LivAiBot
 *
 * Проверяет:
 * 1. Циклические зависимости внутри пакетов
 * 2. Циклические зависимости между пакетами
 *
 * Запуск: pnpm run check:circular-deps
 * Используется в CI/CD для автоматической проверки
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Record<string, string[]>} DependencyGraph
 * @typedef {Record<string, string[]>} PackageGraph
 */

/**
 * Находит все пакеты в монорепо
 * @returns {Array<{name: string, path: string, packageJson: any}>}
 */
function findPackages() {
  const packages = [];

  // Ищем все директории с package.json, исключая node_modules
  const findPackageDirs = (dir) => {
    const result = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);

        if (
          fs.statSync(fullPath).isDirectory() && !item.startsWith('.') && item !== 'node_modules'
        ) {
          const packageJsonPath = path.join(fullPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              if (packageJson.name) {
                result.push({
                  name: packageJson.name,
                  path: fullPath,
                  packageJson,
                });
              }
            } catch (error) {
              // Игнорируем невалидные package.json
            }
          } else {
            // Рекурсивно ищем в поддиректориях
            result.push(...findPackageDirs(fullPath));
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки чтения
    }

    return result;
  };

  return findPackageDirs('.');
}

/**
 * Извлекает импорты из файла
 * @param {string} filePath - путь к файлу
 * @param {string} srcDir - директория src
 * @returns {string[]} массив импортов
 */
function extractImports(filePath, srcDir) {
  if (typeof filePath !== 'string' || typeof srcDir !== 'string' || !filePath || !srcDir) {
    return [];
  }

  const resolvedSrcDir = path.resolve(srcDir);
  const resolvedFilePath = path.resolve(filePath);

  if (!resolvedFilePath.startsWith(resolvedSrcDir) || resolvedFilePath.includes('..')) {
    return [];
  }

  try {
    const content = fs.readFileSync(resolvedFilePath, 'utf8');
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
        resolvedPath = path.relative(srcDir, resolvedPath).replace(/\\/g, '/');
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
  if (typeof dir !== 'string' || !dir || dir.includes('..')) {
    return [];
  }

  const resolvedDir = path.resolve(dir);
  const result = [];

  try {
    const items = fs.readdirSync(resolvedDir);

    for (const item of items) {
      const fullPath = path.join(resolvedDir, item);

      if (fullPath.includes('..') || !fullPath.startsWith(resolvedDir)) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        const subFiles = findTsFiles(fullPath);
        result.push(...subFiles);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
        result.push(fullPath);
      }
    }
  } catch {
    // Игнорируем ошибки чтения
  }

  return result;
}

/**
 * Строит граф зависимостей между пакетами
 * @param {Array<{name: string, path: string, packageJson: any}>} packages
 * @returns {PackageGraph}
 */
function buildPackageGraph(packages) {
  /** @type {PackageGraph} */
  const graph = {};

  for (const pkg of packages) {
    const deps = [];

    // Собираем все зависимости из package.json
    const allDeps = {
      ...pkg.packageJson.dependencies,
      ...pkg.packageJson.devDependencies,
      ...pkg.packageJson.peerDependencies,
    };

    for (const [depName, version] of Object.entries(allDeps || {})) {
      // Проверяем, является ли зависимость другим пакетом из монорепо
      const depPackage = packages.find((p) => p.name === depName);
      if (depPackage) {
        deps.push(depName);
      }
    }

    graph[pkg.name] = deps;
  }

  return graph;
}

/**
 * Детектирует циклические зависимости
 * @param {DependencyGraph} graph - граф зависимостей
 * @returns {Array<[string, string]>} массив циклов
 */
function detectCircularDependencies(graph) {
  /** @type {Array<[string, string]>} */
  const cycles = [];
  /** @type {Set<string>} */
  const processedFiles = new Set();

  for (const [file, deps] of Object.entries(graph)) {
    if (typeof file !== 'string' || !Array.isArray(deps)) continue;

    if (!/^[a-zA-Z0-9\-_.\/]+$/.test(file)) continue;

    for (const dep of deps) {
      if (typeof dep !== 'string' || !/^[a-zA-Z0-9\-_.\/]+$/.test(dep)) continue;

      const reverseDeps = Object.prototype.hasOwnProperty.call(graph, dep) ? graph[dep] : undefined;
      if (
        Array.isArray(reverseDeps)
        && reverseDeps.includes(file)
        && !processedFiles.has(`${file}-${dep}`)
      ) {
        cycles.push([file, dep]);
        processedFiles.add(`${file}-${dep}`);
      }
    }
  }

  return cycles;
}

/**
 * Проверяет пакет на циклические зависимости
 * @param {{name: string, path: string}} pkg - информация о пакете
 * @returns {{cycles: [string, string][], stats: {files: number, deps: number}}}
 */
function checkPackageCycles(pkg) {
  const srcDir = path.join(pkg.path, 'src');

  if (!fs.existsSync(srcDir)) {
    return { cycles: [], stats: { files: 0, deps: 0 } };
  }

  const files = findTsFiles(srcDir);
  /** @type {Record<string, string[]>} */
  const graph = {};

  // Строим граф зависимостей
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/(\.js|\.ts)$/, '');

    if (
      !relativePath
      || typeof relativePath !== 'string'
      || !/^[a-zA-Z0-9\-_.\/]+$/.test(relativePath)
    ) {
      continue;
    }

    const imports = extractImports(file, srcDir);
    if (
      typeof relativePath === 'string' && relativePath.length > 0 && !relativePath.includes('..')
    ) {
      graph[relativePath] = imports;
    }
  }

  const cycles = detectCircularDependencies(graph);

  let totalDeps = 0;
  for (const deps of Object.values(graph)) {
    totalDeps += deps.length;
  }

  return {
    cycles,
    stats: {
      files: Object.keys(graph).length,
      deps: totalDeps,
    },
  };
}

/**
 * Основная функция
 */
function main() {
  process.stdout.write('🔄 Проверка циклических зависимостей в монорепо...\n');

  const packages = findPackages();
  process.stdout.write(`📦 Найдено ${packages.length} пакетов\n`);

  let totalCycles = 0;
  let hasErrors = false;

  // 1. Проверяем внутрипакетные циклы
  process.stdout.write('\n🔍 Проверка внутрипакетных зависимостей...\n');

  for (const pkg of packages) {
    const result = checkPackageCycles(pkg);

    if (result.cycles.length > 0) {
      hasErrors = true;
      totalCycles += result.cycles.length;
      process.stderr.write(`❌ Циклы в пакете ${pkg.name}:\n`);
      for (const [file, dep] of result.cycles) {
        process.stderr.write(`   ${file} ↔ ${dep}\n`);
      }
    } else if (result.stats.files > 0) {
      process.stdout.write(
        `✅ ${pkg.name}: ${result.stats.files} файлов, ${result.stats.deps} зависимостей\n`,
      );
    }
  }

  // 2. Проверяем межпакетные циклы
  process.stdout.write('\n🔗 Проверка межпакетных зависимостей...\n');

  const packageGraph = buildPackageGraph(packages);
  const packageCycles = detectCircularDependencies(packageGraph);

  if (packageCycles.length > 0) {
    hasErrors = true;
    totalCycles += packageCycles.length;
    process.stderr.write('❌ Межпакетные циклы:\n');
    for (const [pkgA, pkgB] of packageCycles) {
      process.stderr.write(`   ${pkgA} ↔ ${pkgB}\n`);
    }
  } else {
    process.stdout.write('✅ Межпакетных циклов не найдено\n');
  }

  // Результат
  if (!hasErrors) {
    process.stdout.write('\n✅ Циклических зависимостей не найдено!\n');

    // Выводим статистику
    let totalFiles = 0;
    let totalDeps = 0;

    for (const pkg of packages) {
      const result = checkPackageCycles(pkg);
      totalFiles += result.stats.files;
      totalDeps += result.stats.deps;
    }

    process.stdout.write(`📊 Статистика монорепо:\n`);
    process.stdout.write(`   Пакетов: ${packages.length}\n`);
    process.stdout.write(`   Файлов: ${totalFiles}\n`);
    process.stdout.write(`   Зависимостей: ${totalDeps}\n`);
    if (totalFiles > 0) {
      process.stdout.write(`   Среднее на файл: ${(totalDeps / totalFiles).toFixed(2)}\n`);
    }

    process.exit(0);
  } else {
    process.stderr.write(`\n🚨 Найдено ${totalCycles} цикл(ов) зависимостей!\n`);
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
