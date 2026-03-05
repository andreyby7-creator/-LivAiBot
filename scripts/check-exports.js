#!/usr/bin/env node

/**
 * @file scripts/check-exports.js
 * Скрипт для проверки package.json exports согласно "Golden build-pipeline" roadmap.
 * Проверяет:
 * - только `dist` в путях
 * - ключи без `.js`
 * - нет `src` в путях
 * - каждый subpath имеет `types`
 * - нет wildcard `"./*": "./dist/*"`
 * - проверка существования файлов (`import`/`default`/`types`)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
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
 * Проверяет package.json exports для одного пакета
 */
function checkPackageExports(packagePath) {
  const packageJsonPath = join(packagePath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return { valid: true, errors: [] };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const errors = [];
  const packageName = packageJson.name || relative(process.cwd(), packagePath);

  if (!packageJson.exports) {
    // Пакет без exports - пропускаем (может быть внутренним)
    return { valid: true, errors: [] };
  }

  const exports = packageJson.exports;
  const packageDir = dirname(packageJsonPath);

  // Проверяем каждый ключ в exports
  for (const [key, value] of Object.entries(exports)) {
    // Проверка 1: ключи без `.js`
    if (key.endsWith('.js')) {
      errors.push({
        package: packageName,
        key,
        error: 'Ключ экспорта не должен содержать `.js`',
      });
    }

    // Проверка 2: нет wildcard `"./*": "./dist/*"`
    if (key === './*' || key === '.*') {
      errors.push({
        package: packageName,
        key,
        error: 'Wildcard экспорты `"./*"` запрещены',
      });
    }

    // Обрабатываем значение (может быть объектом или строкой)
    const exportValue = typeof value === 'string' ? { default: value } : value;

    if (typeof exportValue === 'object' && exportValue !== null) {
      // Проверка 3: каждый subpath должен иметь `types`
      if (!exportValue.types) {
        errors.push({
          package: packageName,
          key,
          error: 'Subpath должен иметь поле `types`',
        });
      }

      // Проверка 4: только `dist` в путях, нет `src`
      const pathsToCheck = [
        exportValue.types,
        exportValue.import,
        exportValue.default,
        exportValue.require,
        exportValue.module,
      ].filter(Boolean);

      for (const path of pathsToCheck) {
        if (typeof path === 'string') {
          // Проверка: нет `src` в путях (исключение: wildcard для динамических импортов, например ./policies/*)
          if ((path.includes('/src/') || path.includes('\\src\\')) && !key.includes('*')) {
            errors.push({
              package: packageName,
              key,
              path,
              error:
                'Путь не должен содержать `src` (исключение: wildcard для динамических импортов)',
            });
          }

          // Проверка: только `dist` в путях (исключение: wildcard для динамических импортов)
          if (!key.includes('*')) {
            if (key === '.') {
              // Для основного экспорта проверяем, что путь начинается с `./dist`
              if (
                !path.startsWith('./dist/')
                && path !== './dist/index.js'
                && path !== './dist/index.d.ts'
              ) {
                errors.push({
                  package: packageName,
                  key,
                  path,
                  error: 'Основной экспорт должен указывать на `./dist/*`',
                });
              }
            } else {
              // Для subpath экспортов проверяем, что путь содержит `dist`
              if (!path.includes('/dist/') && !path.includes('\\dist\\')) {
                errors.push({
                  package: packageName,
                  key,
                  path,
                  error: 'Subpath экспорт должен указывать на `./dist/*`',
                });
              }
            }
          }

          // Проверка 5: существование файлов (исключение: wildcard для динамических импортов)
          if (!key.includes('*')) {
            const fullPath = resolve(packageDir, path);
            if (!existsSync(fullPath)) {
              errors.push({
                package: packageName,
                key,
                path,
                error: `Файл не существует: ${relative(process.cwd(), fullPath)}`,
              });
            }
          }
        }
      }
    } else if (typeof exportValue === 'string') {
      // Если значение - строка, проверяем путь (исключение: wildcard для динамических импортов)
      if (!key.includes('*')) {
        if (exportValue.includes('/src/') || exportValue.includes('\\src\\')) {
          errors.push({
            package: packageName,
            key,
            path: exportValue,
            error: 'Путь не должен содержать `src`',
          });
        }

        if (!exportValue.includes('/dist/') && !exportValue.includes('\\dist\\')) {
          errors.push({
            package: packageName,
            key,
            path: exportValue,
            error: 'Экспорт должен указывать на `./dist/*`',
          });
        }

        // Проверка существования файла
        const fullPath = resolve(packageDir, exportValue);
        if (!existsSync(fullPath)) {
          errors.push({
            package: packageName,
            key,
            path: exportValue,
            error: `Файл не существует: ${relative(process.cwd(), fullPath)}`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Находит все пакеты в директории packages
 */
function findPackages() {
  const packages = [];
  const packagesDir = resolve(process.cwd(), 'packages');

  if (!existsSync(packagesDir)) {
    return packages;
  }

  const entries = readdirSync(packagesDir);

  for (const entry of entries) {
    const packagePath = join(packagesDir, entry);
    const packageJsonPath = join(packagePath, 'package.json');

    if (statSync(packagePath).isDirectory() && existsSync(packageJsonPath)) {
      packages.push(packagePath);
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
    // Проверяем все пакеты
    const packages = findPackages();

    if (packages.length === 0) {
      console.error(`${colors.red}❌ Не найдено пакетов для проверки${colors.reset}`);
      process.exit(1);
    }

    console.log(
      `${colors.cyan}📦 Найдено ${packages.length} пакетов для проверки${colors.reset}\n`,
    );

    let allPassed = true;
    const allErrors = [];

    for (const pkg of packages) {
      const relativePath = relative(process.cwd(), pkg);
      const { valid, errors } = checkPackageExports(pkg);

      if (!valid) {
        allPassed = false;
        allErrors.push(...errors);

        console.log(`${colors.yellow}📄 ${relativePath}/package.json${colors.reset}`);
        errors.forEach((err) => {
          console.log(`   ${colors.red}❌ ${err.key || 'root'}: ${err.error}${colors.reset}`);
          if (err.path) {
            console.log(`      ${colors.blue}Путь: ${err.path}${colors.reset}`);
          }
        });
        console.log('');
      }
    }

    console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    if (allPassed) {
      console.log(`${colors.green}✅ Все пакеты прошли проверку exports!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(
        `${colors.red}❌ Найдено ${allErrors.length} ошибок в package.json exports${colors.reset}\n`,
      );
      console.log(`${colors.yellow}Требования:${colors.reset}`);
      console.log(`  - Только \`dist\` в путях`);
      console.log(`  - Ключи без \`.js\``);
      console.log(`  - Нет \`src\` в путях`);
      console.log(`  - Каждый subpath имеет \`types\``);
      console.log(`  - Нет wildcard \`"./*": "./dist/*"\``);
      console.log(`  - Проверка существования файлов\n`);
      process.exit(1);
    }
  } else {
    // Проверяем указанный пакет
    const packagePath = args[0];
    const { valid, errors } = checkPackageExports(packagePath);

    if (!valid) {
      errors.forEach((err) => {
        console.log(`${colors.red}❌ ${err.key || 'root'}: ${err.error}${colors.reset}`);
        if (err.path) {
          console.log(`   ${colors.blue}Путь: ${err.path}${colors.reset}`);
        }
      });
    } else {
      console.log(`${colors.green}✅ Пакет прошел проверку exports!${colors.reset}`);
    }

    process.exit(valid ? 0 : 1);
  }
}

main();
