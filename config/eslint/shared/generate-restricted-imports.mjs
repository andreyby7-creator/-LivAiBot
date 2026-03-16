#!/usr/bin/env node
/**
 * @file Генератор списка пакетов @livai/* для правила no-restricted-imports
 * Автоматически находит все пакеты @livai/* в packages/ и apps/,
 * и генерирует массив paths для правила no-restricted-imports.
 * Использование:
 *   node config/eslint/shared/generate-restricted-imports.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

/**
 * Находит все пакеты @livai/* в packages/ и apps/
 */
function findLivaiPackages() {
  const packages = [];
  const packagesDir = path.join(PROJECT_ROOT, 'packages');
  const appsDir = path.join(PROJECT_ROOT, 'apps');

  // Сканируем packages/
  if (fs.existsSync(packagesDir)) {
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(packagesDir, entry.name, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.name?.startsWith('@livai/')) {
              packages.push(packageJson.name);
            }
          } catch (error) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    }
  }

  // Сканируем apps/ (если там есть пакеты @livai/*)
  if (fs.existsSync(appsDir)) {
    const entries = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(appsDir, entry.name, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.name?.startsWith('@livai/')) {
              packages.push(packageJson.name);
            }
          } catch (error) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    }
  }

  return packages.sort();
}

/**
 * Генерирует код для правила no-restricted-imports
 */
function generateRestrictedImportsCode(packages) {
  const paths = packages.map((pkg) => {
    const isApp = pkg === '@livai/app';
    return `        {
          name: '${pkg}',
          message:
            'Барель-Импорты в @livai/* запрещены. Используйте subpath exports${isApp ? ', например: "@livai/app/lib/error-mapping.js".' : '.'}',
        },`;
  }).join('\n');

  return `      paths: [
${paths}
      ],`;
}

// Главная функция
const packages = findLivaiPackages();
const code = generateRestrictedImportsCode(packages);

console.log('// Автоматически сгенерировано через: node config/eslint/shared/generate-restricted-imports.mjs');
console.log('// Найдено пакетов:', packages.length);
console.log(code);
