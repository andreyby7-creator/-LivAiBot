#!/usr/bin/env node

/**
 * Проверка неиспользуемых зависимостей в монорепо.
 *
 * Использует depcheck для анализа каждого пакета.
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Находит все пакеты в монорепо
 * @returns {Array<{name: string, path: string}>}
 */
function findPackages() {
  const packages = [];

  function findPackageDirs(dir) {
    try {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);

        if (statSync(fullPath).isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          const packageJsonPath = join(fullPath, 'package.json');
          if (existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'));
              if (packageJson.name) {
                packages.push({
                  name: packageJson.name,
                  path: fullPath,
                });
              }
            } catch (error) {
              // Игнорируем невалидные package.json
            }
          } else {
            // Рекурсивно ищем в поддиректориях
            findPackageDirs(fullPath);
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки чтения
    }
  }

  findPackageDirs('.');
  return packages;
}

console.log('🔍 Проверка неиспользуемых зависимостей...');

const packages = findPackages();
let hasUnused = false;

for (const pkg of packages) {
  console.log(`📦 Проверка ${pkg.name}...`);

  try {
    // Запускаем depcheck для пакета
    execSync(`cd "${pkg.path}" && npx depcheck --json`, { stdio: 'pipe' });

    // Если depcheck завершился успешно без ошибок, значит нет неиспользуемых зависимостей
    console.log(`✅ ${pkg.name}: неиспользуемых зависимостей не найдено`);
  } catch (error) {
    // depcheck возвращает exit code > 0 если есть неиспользуемые зависимости
    hasUnused = true;
    console.log(`⚠️  ${pkg.name}: найдены неиспользуемые зависимости`);
    // Можно распарсить JSON вывод depcheck для детального отчета
  }

  console.log();
}

if (hasUnused) {
  console.log('⚠️  Найдены неиспользуемые зависимости в некоторых пакетах');
  console.log('💡 Рекомендуется удалить их для уменьшения размера бандла');
  process.exit(1);
} else {
  console.log('✅ Неиспользуемых зависимостей не найдено');
}
