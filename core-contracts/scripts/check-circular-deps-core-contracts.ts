#!/usr/bin/env tsx

/* eslint-disable @typescript-eslint/no-unused-vars, no-console, security/detect-non-literal-fs-filename, functional/immutable-data, @typescript-eslint/array-type, security/detect-object-injection, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/explicit-function-return-type, @typescript-eslint/require-await, security-node/detect-crlf, no-magic-numbers */

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
}

function extractImports(filePath: string, srcDir: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports: string[] = [];

    // Регулярное выражение для поиска import statements
    const importRegex = /import\s+.*?from\s+['\"]([^'\"]+)['\"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      let importPath = match[1];

      // Преобразуем относительные пути
      if (importPath.startsWith('.')) {
        const dir = path.dirname(filePath);
        importPath = path.resolve(dir, importPath);
        // Относительно src директории
        importPath = path.relative(srcDir, importPath).replace(/\\./g, '/');
        importPath = path.relative(srcDir, importPath).replace(/\\./g, '/');
      }

      // Убираем расширения
      importPath = importPath.replace(/(\.js|\.ts)$/, '');

      imports.push(importPath);
    }

    return imports;
  } catch (e) {
    return [];
  }
}

function findTsFiles(dir: string, files: string[] = []): string[] {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
      files.push(fullPath);
    }
  }

  return files;
}

function detectCircularDependencies(graph: DependencyGraph): Array<[string, string]> {
  const cycles: Array<[string, string]> = [];

  for (const [file, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      // Проверяем обратную зависимость
      const reverseDeps = graph[dep] || [];
      if (reverseDeps.includes(file)) {
        cycles.push([file, dep]);
      }
    }
  }

  return cycles;
}

async function main() {
  console.log('🔄 Проверка циклических зависимостей в core-contracts...\n');

  // Скрипт находится в core-contracts/scripts, поэтому src находится на уровень выше
  const coreContractsPath = path.resolve(__dirname, '..');
  const srcDir = path.join(coreContractsPath, 'src');
  const files = findTsFiles(srcDir);
  const graph: DependencyGraph = {};

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

main().catch((error) => {
  console.error('❌ Ошибка при проверке зависимостей:', error);
  process.exit(1);
});
