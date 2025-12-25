#!/usr/bin/env node

/**
 * Анализ метрик графа импортов пакетов.
 *
 * Метрики:
 *  - maxDepth — максимальная глубина цепочки импортов
 *  - fanIn — сколько файлов импортируют данный файл
 *  - fanOut — сколько файлов импортирует данный файл
 *
 * Назначение:
 *  - раннее выявление усложнения архитектуры
 *  - поиск "узлов напряжения"
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

/**
 * Рекурсивно собирает все .js/.ts файлы
 * @param {string} dir - директория для поиска
 * @returns {string[]} массив путей к файлам
 */
function collectSourceFiles(dir) {
  const files = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        files.push(...collectSourceFiles(fullPath));
      } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Игнорируем ошибки чтения директории
  }

  return files;
}

/**
 * Извлекает import-зависимости из файла
 * @param {string} filePath - путь к файлу
 * @param {string} srcDir - корневая директория src
 * @returns {string[]} массив относительных путей к импортируемым файлам
 */
function extractImports(filePath, srcDir) {
  try {
    const code = readFileSync(filePath, 'utf8');
    const regex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    const imports = [];

    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];

      // Преобразуем относительные импорты в абсолютные пути
      let resolvedPath = importPath;
      if (resolvedPath.startsWith('.')) {
        const dir = join(filePath, '..');
        resolvedPath = join(dir, importPath);

        // Убираем расширение
        resolvedPath = resolvedPath.replace(/(\.js|\.ts)$/, '');

        // Преобразуем в относительный путь от src
        resolvedPath = relative(srcDir, resolvedPath);
      }

      imports.push(resolvedPath);
    }

    return imports;
  } catch (error) {
    return [];
  }
}

/**
 * Строит граф импортов
 * @param {string[]} files - массив файлов
 * @param {string} srcDir - корневая директория src
 * @returns {Map<string, string[]>} граф зависимостей
 */
function buildGraph(files, srcDir) {
  const graph = new Map();

  for (const file of files) {
    const relativePath = relative(srcDir, file).replace(/(\.js|\.ts)$/, '');
    const imports = extractImports(file, srcDir);
    graph.set(relativePath, imports);
  }

  return graph;
}

/**
 * Вычисляет максимальную глубину графа
 * @param {Map<string, string[]>} graph - граф зависимостей
 * @returns {number} максимальная глубина
 */
function computeMaxDepth(graph) {
  const visited = new Set();
  const depths = new Map();

  function dfs(node) {
    if (visited.has(node)) {
      return depths.get(node) || 0;
    }

    visited.add(node);

    const children = graph.get(node) || [];
    let maxChildDepth = 0;

    for (const child of children) {
      maxChildDepth = Math.max(maxChildDepth, dfs(child));
    }

    const depth = maxChildDepth + 1;
    depths.set(node, depth);

    return depth;
  }

  let globalMax = 0;
  for (const node of graph.keys()) {
    globalMax = Math.max(globalMax, dfs(node));
  }

  return globalMax;
}

/**
 * Вычисляет метрики fanIn и fanOut
 * @param {Map<string, string[]>} graph - граф зависимостей
 * @returns {Map<string, {fanIn: number, fanOut: number}>} метрики для каждого файла
 */
function computeFanMetrics(graph) {
  const fanIn = new Map();
  const fanOut = new Map();

  // Инициализируем счетчики
  for (const node of graph.keys()) {
    fanIn.set(node, 0);
    fanOut.set(node, 0);
  }

  // Вычисляем fanOut и fanIn
  for (const [node, deps] of graph.entries()) {
    fanOut.set(node, deps.length);

    for (const dep of deps) {
      fanIn.set(dep, (fanIn.get(dep) || 0) + 1);
    }
  }

  // Комбинируем результаты
  const metrics = new Map();
  for (const node of graph.keys()) {
    metrics.set(node, {
      fanIn: fanIn.get(node) || 0,
      fanOut: fanOut.get(node) || 0,
    });
  }

  return metrics;
}

/**
 * Находит файлы с экстремальными метриками
 * @param {Map<string, {fanIn: number, fanOut: number}>} metrics - метрики
 * @returns {Object} статистика по экстремальным значениям
 */
function findExtremes(metrics) {
  let maxFanIn = { file: '', value: 0 };
  let maxFanOut = { file: '', value: 0 };

  for (const [file, metric] of metrics.entries()) {
    if (metric.fanIn > maxFanIn.value) {
      maxFanIn = { file, value: metric.fanIn };
    }
    if (metric.fanOut > maxFanOut.value) {
      maxFanOut = { file, value: metric.fanOut };
    }
  }

  return { maxFanIn, maxFanOut };
}

/**
 * Анализирует пакет
 * @param {string} pkgName - имя пакета
 * @param {string} srcDir - директория src пакета
 */
function analyzePackage(pkgName, srcDir) {
  const files = collectSourceFiles(srcDir);

  if (files.length === 0) {
    console.log(`📦 ${pkgName}: нет исходных файлов`);
    return;
  }

  const graph = buildGraph(files, srcDir);
  const maxDepth = computeMaxDepth(graph);
  const metrics = computeFanMetrics(graph);
  const extremes = findExtremes(metrics);

  console.log(`📦 ${pkgName}`);
  console.log(`   • файлов: ${files.length}`);
  console.log(`   • max depth: ${maxDepth}`);
  console.log(`   • max fan-in: ${extremes.maxFanIn.value} (${extremes.maxFanIn.file})`);
  console.log(`   • max fan-out: ${extremes.maxFanOut.value} (${extremes.maxFanOut.file})`);

  // Предупреждения
  if (maxDepth > 8) {
    console.warn(`   📏 Граф слишком глубокий (${maxDepth}) — возможна деградация архитектуры`);
  }

  if (extremes.maxFanIn.value > 10) {
    console.warn(
      `   ⭐ Высокий fan-in (${extremes.maxFanIn.value}) — файл ${extremes.maxFanIn.file} слишком популярен`,
    );
  }

  if (extremes.maxFanOut.value > 15) {
    console.warn(
      `   🧩 Высокий fan-out (${extremes.maxFanOut.value}) — файл ${extremes.maxFanOut.file} слишком сложный`,
    );
  }

  console.log();
}

/**
 * Находит все пакеты в монорепо
 * @returns {Array<{name: string, srcDir: string}>}
 */
function findPackages() {
  const packages = [];

  // Используем find для поиска всех директорий с package.json
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
        const srcDir = join(packageDir, 'src');

        // Проверяем что есть src директория
        if (existsSync(srcDir) && packageJson.name) {
          packages.push({
            name: packageJson.name,
            srcDir,
          });
        }
      } catch {
        // Игнорируем невалидные package.json
      }
    }
  } catch (error) {
    console.error(`Ошибка поиска пакетов: ${error.message}`);
  }

  return packages;
}

console.log('📐 Анализ метрик графа импортов...\n');

const packages = findPackages();

if (packages.length === 0) {
  console.log('Пакеты с исходным кодом не найдены');
  process.exit(0);
}

for (const pkg of packages) {
  analyzePackage(pkg.name, pkg.srcDir);
}

console.log('✅ Анализ метрик завершён');
