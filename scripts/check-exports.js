#!/usr/bin/env node

/**
 * @file scripts/check-exports.js
 * 
 * Скрипт для проверки, что все экспорты из исходных файлов присутствуют в индексных файлах.
 * 
 * Использование:
 *   node scripts/check-exports.js [package-path]
 * 
 * Примеры:
 *   node scripts/check-exports.js packages/app/src
 *   node scripts/check-exports.js packages/feature-auth/src
 *   node scripts/check-exports.js packages/ui-core/src
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Извлекает все экспорты из файла
 */
function extractExports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const exports = new Set();
  
  const lines = content.split('\n');
  let inMultiLineExport = false;
  let multiLineBuffer = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Пропускаем комментарии
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    
    // Проверяем начало многострочного экспорта
    if (trimmed.startsWith('export') && trimmed.includes('{') && !trimmed.includes('}')) {
      inMultiLineExport = true;
      multiLineBuffer = line;
      continue;
    }
    
    // Продолжаем собирать многострочный экспорт
    if (inMultiLineExport) {
      multiLineBuffer += '\n' + line;
      if (line.includes('}')) {
        inMultiLineExport = false;
        // Парсим собранный блок
        const blockMatch = multiLineBuffer.match(/export\s*\{([^}]+)\}/s);
        if (blockMatch) {
          blockMatch[1].split(',').forEach((item) => {
            const clean = item.trim()
              .replace(/^type\s+/, '')
              .replace(/^as\s+(\w+)$/, '$1')
              .split(/\s+/)[0]
              .trim();
            if (clean && clean !== 'type' && clean !== 'const' && clean !== 'function' && clean !== 'interface') {
              exports.add(clean);
            }
          });
        }
        multiLineBuffer = '';
      }
      continue;
    }
    
    // Однострочные экспорты
    // export const/function/class/enum Something
    const constFuncMatch = trimmed.match(/^export\s+(?:const|function|class|enum|async\s+function)\s+(\w+)/);
    if (constFuncMatch) {
      exports.add(constFuncMatch[1]);
      continue;
    }
    
    // export type Something
    const typeMatch = trimmed.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.add(typeMatch[1]);
      continue;
    }
    
    // export interface Something
    const interfaceMatch = trimmed.match(/^export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.add(interfaceMatch[1]);
      continue;
    }
    
    // export { Something, type Other } from ...
    const namedExportMatch = trimmed.match(/^export\s*\{([^}]+)\}/);
    if (namedExportMatch) {
      namedExportMatch[1].split(',').forEach((item) => {
        const clean = item.trim()
          .replace(/^type\s+/, '')
          .replace(/^as\s+(\w+)$/, '$1')
          .split(/\s+/)[0]
          .trim();
        if (clean && clean !== 'type' && clean !== 'const' && clean !== 'function' && clean !== 'interface') {
          exports.add(clean);
        }
      });
      continue;
    }
    
    // export default
    if (trimmed.startsWith('export default')) {
      exports.add('default');
      continue;
    }
  }
  
  return Array.from(exports).filter(name => name && name !== 'type' && name !== 'const' && name !== 'function' && name !== 'interface');
}

/**
 * Извлекает все экспорты из индексного файла
 */
function extractIndexExports(indexPath) {
  if (!existsSync(indexPath)) {
    return { exports: new Set(), reExports: new Set(), exportedFiles: new Set() };
  }
  
  const content = readFileSync(indexPath, 'utf-8');
  const exports = new Set();
  const reExports = new Set();
  const exportedFiles = new Set();
  
  const lines = content.split('\n');
  let inMultiLineExport = false;
  let multiLineBuffer = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Пропускаем комментарии
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    
    // Проверяем реэкспорты (export * from или export { ... } from)
    const reExportMatch = trimmed.match(/^export\s+(?:\*|\{[^}]+\})\s+from\s+['"]([^'"]+)['"]/);
    if (reExportMatch) {
      const importPath = reExportMatch[1];
      // Извлекаем имя файла из пути
      const fileName = importPath.replace(/^\.\//, '').replace(/\.js$/, '');
      exportedFiles.add(fileName);
      reExports.add(importPath);
      
      // Если это export *, то все экспорты из файла считаются реэкспортированными
      if (trimmed.includes('export *')) {
        // Помечаем файл как полностью реэкспортированный
        exportedFiles.add(fileName);
      }
      continue;
    }
    
    // Проверяем начало многострочного экспорта
    if (trimmed.startsWith('export') && trimmed.includes('{') && !trimmed.includes('}')) {
      inMultiLineExport = true;
      multiLineBuffer = line;
      continue;
    }
    
    // Продолжаем собирать многострочный экспорт
    if (inMultiLineExport) {
      multiLineBuffer += '\n' + line;
      if (line.includes('}')) {
        inMultiLineExport = false;
        // Парсим собранный блок
        const blockMatch = multiLineBuffer.match(/export\s*\{([^}]+)\}(?:\s+from\s+['"]([^'"]+)['"])?/s);
        if (blockMatch) {
          // Извлекаем экспорты
          blockMatch[1].split(',').forEach((item) => {
            const clean = item.trim()
              .replace(/^type\s+/, '')
              .replace(/^as\s+(\w+)$/, '$1')
              .split(/\s+/)[0]
              .trim();
            if (clean && clean !== 'type' && clean !== 'const' && clean !== 'function' && clean !== 'interface') {
              exports.add(clean);
            }
          });
          
          // Если есть from, это реэкспорт
          if (blockMatch[2]) {
            const fileName = blockMatch[2].replace(/^\.\//, '').replace(/\.js$/, '');
            exportedFiles.add(fileName);
            reExports.add(blockMatch[2]);
          }
        }
        multiLineBuffer = '';
      }
      continue;
    }
    
    // Однострочные экспорты
    // export const/function/class/enum Something
    const constFuncMatch = trimmed.match(/^export\s+(?:const|function|class|enum|async\s+function)\s+(\w+)/);
    if (constFuncMatch) {
      exports.add(constFuncMatch[1]);
      continue;
    }
    
    // export type Something
    const typeMatch = trimmed.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.add(typeMatch[1]);
      continue;
    }
    
    // export interface Something
    const interfaceMatch = trimmed.match(/^export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.add(interfaceMatch[1]);
      continue;
    }
    
    // export { Something, type Other } from ...
    const namedExportMatch = trimmed.match(/^export\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (namedExportMatch) {
      const fileName = namedExportMatch[2].replace(/^\.\//, '').replace(/\.js$/, '');
      exportedFiles.add(fileName);
      reExports.add(namedExportMatch[2]);
      
      namedExportMatch[1].split(',').forEach((item) => {
        const clean = item.trim()
          .replace(/^type\s+/, '')
          .replace(/^as\s+(\w+)$/, '$1')
          .split(/\s+/)[0]
          .trim();
        if (clean && clean !== 'type' && clean !== 'const' && clean !== 'function' && clean !== 'interface') {
          exports.add(clean);
        }
      });
      continue;
    }
    
    // export { Something } (без from)
    const namedExportOnlyMatch = trimmed.match(/^export\s*\{([^}]+)\}(?!\s+from)/);
    if (namedExportOnlyMatch) {
      namedExportOnlyMatch[1].split(',').forEach((item) => {
        const clean = item.trim()
          .replace(/^type\s+/, '')
          .replace(/^as\s+(\w+)$/, '$1')
          .split(/\s+/)[0]
          .trim();
        if (clean && clean !== 'type' && clean !== 'const' && clean !== 'function' && clean !== 'interface') {
          exports.add(clean);
        }
      });
      continue;
    }
  }
  
  return { exports, reExports, exportedFiles };
}

/**
 * Рекурсивно находит все файлы в директории
 */
function findFiles(dir, extensions = ['.ts', '.tsx'], excludeDirs = ['node_modules', '.git', 'dist', 'coverage']) {
  const files = [];
  
  if (!existsSync(dir)) {
    return files;
  }
  
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!excludeDirs.includes(entry) && !entry.startsWith('.')) {
        files.push(...findFiles(fullPath, extensions, excludeDirs));
      }
    } else if (stat.isFile()) {
      const ext = entry.substring(entry.lastIndexOf('.'));
      if (extensions.includes(ext) && entry !== 'index.ts' && entry !== 'index.tsx') {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Находит индексный файл для директории
 */
function findIndexFile(filePath) {
  const dir = dirname(filePath);
  const indexPath = join(dir, 'index.ts');
  
  if (existsSync(indexPath)) {
    return indexPath;
  }
  
  // Проверяем родительские директории
  let currentDir = dir;
  const rootDir = resolve(process.cwd(), 'packages');
  
  while (currentDir !== rootDir && currentDir !== dirname(currentDir)) {
    const parentIndex = join(currentDir, 'index.ts');
    if (existsSync(parentIndex)) {
      return parentIndex;
    }
    currentDir = dirname(currentDir);
  }
  
  return null;
}

/**
 * Проверяет экспорты в пакете
 */
function checkPackage(packagePath) {
  const fullPath = resolve(process.cwd(), packagePath);
  
  if (!existsSync(fullPath)) {
    console.error(`${colors.red}❌ Директория не найдена: ${packagePath}${colors.reset}`);
    process.exit(1);
  }
  
  // Показываем относительный путь для лучшей читаемости
  const displayPath = relative(process.cwd(), fullPath);
  console.log(`${colors.cyan}🔍 Проверка экспортов в: ${displayPath}${colors.reset}\n`);
  
  const files = findFiles(fullPath);
  const issues = [];
  const checked = new Set();
  
  // Собираем все индексные файлы и их содержимое
  const indexFiles = new Map();
  const allIndexFiles = findFiles(fullPath, ['.ts', '.tsx'], ['node_modules', '.git', 'dist', 'coverage'])
    .filter(f => f.endsWith('index.ts') || f.endsWith('index.tsx'));
  
  allIndexFiles.forEach((indexFile) => {
    const { exports: indexExports, reExports, exportedFiles } = extractIndexExports(indexFile);
    const indexContent = readFileSync(indexFile, 'utf-8');
    indexFiles.set(indexFile, { exports: indexExports, reExports, exportedFiles, content: indexContent });
  });
  
  // Группируем файлы по директориям для проверки индексных файлов
  const dirMap = new Map();
  
  files.forEach((file) => {
    const dir = dirname(file);
    if (!dirMap.has(dir)) {
      dirMap.set(dir, []);
    }
    dirMap.get(dir).push(file);
  });
  
  // Проверяем каждый файл
  for (const [dir, dirFiles] of dirMap.entries()) {
    const indexPath = join(dir, 'index.ts');
    
    // Проверяем индексный файл в текущей директории
    let indexData = indexFiles.get(indexPath);
    
    // Если нет индексного файла в текущей директории, ищем в родительских
    if (!indexData) {
      let currentDir = dir;
      while (currentDir !== fullPath && currentDir !== dirname(currentDir)) {
        const parentIndex = join(currentDir, 'index.ts');
        if (indexFiles.has(parentIndex)) {
          indexData = indexFiles.get(parentIndex);
          break;
        }
        currentDir = dirname(currentDir);
      }
    }
    
    if (!indexData) {
      // Пропускаем директории без индексных файлов
      continue;
    }
    
    const { exports: indexExports, reExports, exportedFiles, content: indexContent } = indexData;
    
    // Проверяем файлы в этой директории
    for (const file of dirFiles) {
      const fileName = file.substring(file.lastIndexOf('/') + 1);
      const baseName = fileName.replace(/\.(ts|tsx)$/, '');
      const fileExports = extractExports(file);
      
      if (fileExports.length === 0) {
        continue;
      }
      
      // Проверяем, реэкспортирован ли файл полностью (export * from)
      const relativePath = './' + baseName + '.js';
      const isFullyReExported = Array.from(reExports).some((reExp) => {
        const reExpBase = reExp.replace(/^\.\//, '').replace(/\.js$/, '');
        return reExpBase === baseName && indexContent.includes(`export * from '${reExp}'`) || indexContent.includes(`export * from "${reExp}"`);
      });
      
      if (isFullyReExported) {
        // Файл полностью реэкспортирован, пропускаем проверку отдельных экспортов
        continue;
      }
      
      // Проверяем, реэкспортирован ли файл через именованный экспорт
      const isNamedReExported = Array.from(reExports).some((reExp) => {
        const reExpBase = reExp.replace(/^\.\//, '').replace(/\.js$/, '');
        return reExpBase === baseName;
      });
      
      if (isNamedReExported) {
        // Файл реэкспортирован через именованный экспорт, проверяем конкретные экспорты
        // Но если это export * from, то все экспорты считаются реэкспортированными
        const hasWildcardReExport = indexContent.includes(`export * from`) && 
          Array.from(reExports).some((reExp) => {
            const reExpBase = reExp.replace(/^\.\//, '').replace(/\.js$/, '');
            return reExpBase === baseName;
          });
        
        if (hasWildcardReExport) {
          continue;
        }
      }
      
      // Проверяем каждый экспорт
      for (const exp of fileExports) {
        const key = `${file}:${exp}`;
        if (checked.has(key)) {
          continue;
        }
        checked.add(key);
        
        // Проверяем, есть ли экспорт в индексном файле
        if (!indexExports.has(exp)) {
          // Проверяем, может быть это реэкспорт из файла через export { ... } from
          const isReExported = Array.from(reExports).some((reExp) => {
            const reExpBase = reExp.replace(/^\.\//, '').replace(/\.js$/, '');
            return reExpBase === baseName;
          });
          
          if (!isReExported) {
            issues.push({
              file: relative(process.cwd(), file),
              export: exp,
              indexFile: relative(process.cwd(), indexPath),
            });
          }
        }
      }
    }
  }
  
  // Выводим результаты
  if (issues.length === 0) {
    console.log(`${colors.green}✅ Все экспорты присутствуют в индексных файлах!${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}❌ Найдено ${issues.length} пропущенных экспортов:${colors.reset}\n`);
    
    // Группируем по файлам
    const grouped = new Map();
    issues.forEach((issue) => {
      if (!grouped.has(issue.indexFile)) {
        grouped.set(issue.indexFile, []);
      }
      grouped.get(issue.indexFile).push(issue);
    });
    
    for (const [indexFile, fileIssues] of grouped.entries()) {
      console.log(`${colors.yellow}📄 ${indexFile}${colors.reset}`);
      
      // Группируем по исходным файлам
      const bySource = new Map();
      fileIssues.forEach((issue) => {
        if (!bySource.has(issue.file)) {
          bySource.set(issue.file, []);
        }
        bySource.get(issue.file).push(issue.export);
      });
      
      for (const [sourceFile, exports] of bySource.entries()) {
        console.log(`   ${colors.blue}${sourceFile}${colors.reset}`);
        exports.forEach((exp) => {
          console.log(`      ${colors.red}- ${exp}${colors.reset}`);
        });
      }
      console.log('');
    }
    
    return false;
  }
}

/**
 * Находит все пакеты с директорией src
 */
function findPackagesWithSrc() {
  const packages = [];
  const packagesDir = resolve(process.cwd(), 'packages');
  
  if (!existsSync(packagesDir)) {
    return packages;
  }
  
  const entries = readdirSync(packagesDir);
  
  for (const entry of entries) {
    const packagePath = join(packagesDir, entry);
    const srcPath = join(packagePath, 'src');
    
    if (statSync(packagePath).isDirectory() && existsSync(srcPath)) {
      packages.push(srcPath);
    }
  }
  
  return packages.sort();
}

/**
 * Главная функция
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Проверяем все пакеты с директорией src
    const packages = findPackagesWithSrc();
    
    if (packages.length === 0) {
      console.error(`${colors.red}❌ Не найдено пакетов с директорией src${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.cyan}📦 Найдено ${packages.length} пакетов для проверки${colors.reset}\n`);
    
    let allPassed = true;
    
    for (const pkg of packages) {
      const relativePath = relative(process.cwd(), pkg);
      const passed = checkPackage(pkg);
      allPassed = allPassed && passed;
    }
    
    console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    if (allPassed) {
      console.log(`${colors.green}✅ Все пакеты прошли проверку!${colors.reset}\n`);
    } else {
      console.log(`${colors.red}❌ Некоторые пакеты имеют проблемы с экспортами${colors.reset}\n`);
    }
    
    process.exit(allPassed ? 0 : 1);
  } else {
    // Проверяем указанный пакет
    const packagePath = args[0];
    const passed = checkPackage(packagePath);
    process.exit(passed ? 0 : 1);
  }
}

main();
