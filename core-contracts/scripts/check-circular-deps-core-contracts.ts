#!/usr/bin/env tsx

/**
 * @file check-circular-deps-core-contracts.ts
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

type DependencyGraph = {
  [file: string]: string[];
};

function extractImports(filePath: string, srcDir: string): string[] {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const content = fs.readFileSync(filePath, 'utf8');
    const imports: string[] = [];

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

      // eslint-disable-next-line functional/immutable-data
      imports.push(resolvedPath);
    }

    return imports;
  } catch {
    return [];
  }
}

function findTsFiles(dir: string, files: string[] = []): string[] {
  const result = [...files];
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
      // eslint-disable-next-line functional/immutable-data
      result.push(fullPath);
    }
  }

  return result;
}

function detectCircularDependencies(graph: DependencyGraph): [string, string][] {
  const cycles: [string, string][] = [];

  for (const [file, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      // Проверяем обратную зависимость
      // eslint-disable-next-line security/detect-object-injection
      const reverseDeps = graph[dep] ?? [];
      if (reverseDeps.includes(file)) {
        // eslint-disable-next-line functional/immutable-data
        cycles.push([file, dep]);
      }
    }
  }

  return cycles;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function main() {
  // eslint-disable-next-line no-console
  console.log('🔄 Проверка циклических зависимостей в core-contracts...\n');

  // Скрипт находится в core-contracts/scripts, поэтому src находится на уровень выше
  const coreContractsPath = path.resolve(__dirname, '..');
  const srcDir = path.join(coreContractsPath, 'src');
  const files = findTsFiles(srcDir);
  const graph: DependencyGraph = {};

  // eslint-disable-next-line no-console, security-node/detect-crlf
  console.log(`📁 Найдено ${files.length} файлов для анализа`);

  // Строим граф зависимостей
  for (const file of files) {
    const relativePath = path.relative(srcDir, file).replace(/(\.js|\.ts)$/, '');
    const imports = extractImports(file, srcDir);
    // eslint-disable-next-line functional/immutable-data, security/detect-object-injection
    graph[relativePath] = imports;
  }

  // Проверяем циклы
  const cycles = detectCircularDependencies(graph);

  if (cycles.length === 0) {
    // eslint-disable-next-line no-console
    console.log('✅ Циклических зависимостей не найдено');

    // Выводим статистику
    let totalDeps = 0;
    for (const deps of Object.values(graph)) {
      totalDeps += deps.length;
    }

    // eslint-disable-next-line no-console, security-node/detect-crlf
    console.log(`📊 Статистика:`);
    // eslint-disable-next-line no-console, security-node/detect-crlf
    console.log(`   Файлов: ${Object.keys(graph).length}`);
    // eslint-disable-next-line no-console, security-node/detect-crlf
    console.log(`   Зависимостей: ${totalDeps}`);
    // eslint-disable-next-line no-console, no-magic-numbers, security-node/detect-crlf
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
