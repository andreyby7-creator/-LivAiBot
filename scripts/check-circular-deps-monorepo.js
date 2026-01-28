#!/usr/bin/env tsx

// @ts-check

/**
 * @file check-circular-deps-monorepo.js
 * Проверка циклических зависимостей в монорепо LivAi
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
import yaml from 'js-yaml';

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
  const rootDir = path.resolve('.');

  // Собираем все найденные пакеты из разных источников
  const allFoundPackages = [];

  /**
   * Ищет все директории с package.json
   * @param {string} dir - директория для поиска
   * @returns {Array<{name: string, path: string, packageJson: any}>} массив пакетов
   */
  const findPackageDirs = (dir) => {
    /** @type {Array<{name: string, path: string, packageJson: any}>} */
    const result = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);

        if (
          fs.statSync(fullPath).isDirectory()
          && !item.startsWith('.')
          && item !== 'node_modules'
          && item !== 'dist'
          && item !== 'build'
          && item !== 'coverage'
        ) {
          const packageJsonPath = path.join(fullPath, 'package.json');
          let packageJsonExists = false;
          try {
            fs.accessSync(packageJsonPath, fs.constants.F_OK);
            packageJsonExists = true;
          } catch {
            packageJsonExists = false;
          }
          if (packageJsonExists) {
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
            // Рекурсивно ищем в поддиректориях (для apps, packages и т.д.)
            result.push(...findPackageDirs(fullPath));
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки чтения
    }

    return result;
  };

  // Ищем пакеты по паттернам pnpm-workspace.yaml
  try {
    const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');
    let workspaceConfigExists = false;
    try {
      fs.accessSync(workspaceConfigPath, fs.constants.F_OK);
      workspaceConfigExists = true;
    } catch {
      workspaceConfigExists = false;
    }
    if (workspaceConfigExists) {
      /** @type {any} */
      const workspaceConfig = yaml.load(fs.readFileSync(workspaceConfigPath, 'utf8'));
      if (workspaceConfig && workspaceConfig.packages) {
        for (const pattern of workspaceConfig.packages) {
          if (typeof pattern === 'string') {
            // Обрабатываем glob паттерны как packages/*
            const baseDir = pattern.split('/*')[0];
            const fullBaseDir = path.join(rootDir, baseDir);
            let baseDirExists = false;
            try {
              fs.accessSync(fullBaseDir, fs.constants.F_OK);
              baseDirExists = true;
            } catch {
              baseDirExists = false;
            }
            if (baseDirExists) {
              allFoundPackages.push(...findPackageDirs(fullBaseDir));
            }
          }
        }
      }
    }
  } catch (error) {
    // Игнорируем ошибки чтения workspace config
  }

  // Ищем в основных директориях монорепо
  const searchDirs = ['apps', 'services', 'tools'];
  for (const searchDir of searchDirs) {
    const fullSearchDir = path.join(rootDir, searchDir);
    let searchDirExists = false;
    try {
      fs.accessSync(fullSearchDir, fs.constants.F_OK);
      searchDirExists = true;
    } catch {
      searchDirExists = false;
    }
    if (searchDirExists) {
      allFoundPackages.push(...findPackageDirs(fullSearchDir));
    }
  }

  // Также ищем в корне (на случай если там есть package.json)
  const rootPackageJson = path.join(rootDir, 'package.json');
  let rootPackageJsonExists = false;
  try {
    fs.accessSync(rootPackageJson, fs.constants.F_OK);
    rootPackageJsonExists = true;
  } catch {
    rootPackageJsonExists = false;
  }
  if (rootPackageJsonExists) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
      if (packageJson.name) {
        allFoundPackages.push({
          name: packageJson.name,
          path: rootDir,
          packageJson,
        });
      }
    } catch (error) {
      // Игнорируем ошибки чтения
    }
  }

  // Убираем дубликаты по имени пакета
  const seenNames = new Set();
  for (const pkg of allFoundPackages) {
    if (!seenNames.has(pkg.name)) {
      seenNames.add(pkg.name);
      packages.push(pkg);
    }
  }

  return packages;
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
      } else if (
        stat.isFile()
        && (item.endsWith('.ts')
          || item.endsWith('.tsx')
          || item.endsWith('.js')
          || item.endsWith('.jsx'))
      ) {
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

  let srcDirExists = false;
  try {
    fs.accessSync(srcDir, fs.constants.F_OK);
    srcDirExists = true;
  } catch {
    srcDirExists = false;
  }
  if (!srcDirExists) {
    return { cycles: [], stats: { files: 0, deps: 0 } };
  }

  const files = findTsFiles(srcDir);
  /** @type {Record<string, string[]>} */
  const graph = {};

  // Строим граф зависимостей
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/(\.js|\.ts|\.tsx|\.jsx)$/, '');

    if (
      !relativePath
      || typeof relativePath !== 'string'
      || !/^[a-zA-Z0-9\-_.\[\]\/]+$/.test(relativePath)
      || relativePath.includes('node_modules')
      || relativePath.includes('dist')
      || relativePath.includes('coverage')
      || relativePath.includes('__pycache__')
      || relativePath.endsWith('.test')
      || relativePath.endsWith('.spec')
      || relativePath.endsWith('.d')
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
  console.log('🔄 Проверка циклических зависимостей в монорепо...');

  const packages = findPackages();
  console.log(`📦 Найдено ${packages.length} пакетов`);

  let totalCycles = 0;
  let hasErrors = false;

  // 1. Проверяем внутрипакетные циклы
  console.log('\n🔍 Проверка внутрипакетных зависимостей...');

  let totalFiles = 0;
  let totalDeps = 0;

  for (const pkg of packages) {
    const result = checkPackageCycles(pkg);

    totalFiles += result.stats.files;
    totalDeps += result.stats.deps;

    if (result.cycles.length > 0) {
      hasErrors = true;
      totalCycles += result.cycles.length;
      console.error(`❌ Циклы в пакете ${pkg.name}:`);
      for (const [file, dep] of result.cycles) {
        console.error(`   ${file} ↔ ${dep}`);
      }
    } else {
      console.log(
        `✅ ${pkg.name}: ${result.stats.files} файлов, ${result.stats.deps} зависимостей`,
      );
    }
  }

  // 2. Проверяем межпакетные циклы
  console.log('\n🔗 Проверка межпакетных зависимостей...');

  const packageGraph = buildPackageGraph(packages);
  const packageCycles = detectCircularDependencies(packageGraph);

  if (packageCycles.length > 0) {
    hasErrors = true;
    totalCycles += packageCycles.length;
    console.error('❌ Межпакетные циклы:');
    for (const [pkgA, pkgB] of packageCycles) {
      console.error(`   ${pkgA} ↔ ${pkgB}`);
    }
  } else {
    console.log('✅ Межпакетных циклов не найдено');
  }

  // Результат
  if (!hasErrors) {
    console.log('\n✅ Циклических зависимостей не найдено!');

    console.log(`📊 Статистика монорепо:`);
    console.log(`   Пакетов: ${packages.length}`);
    console.log(`   Файлов: ${totalFiles}`);
    console.log(`   Зависимостей: ${totalDeps}`);
    if (totalFiles > 0) {
      console.log(`   Среднее на файл: ${(totalDeps / totalFiles).toFixed(2)}`);
    }

    process.exit(0);
  } else {
    console.error(`\n🚨 Найдено ${totalCycles} цикл(ов) зависимостей!`);
    console.error('🔧 Исправьте циклы перед коммитом.');
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ Ошибка при проверке зависимостей: ${error}`);
  process.exit(1);
}
