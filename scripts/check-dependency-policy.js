#!/usr/bin/env node

/**
 * Проверка dependency policy в монорепо.
 * Назначение:
 * - Запрещает определённым пакетам зависеть от указанных зависимостей
 * - Защищает архитектурные слои (core, infra, ui)
 * Пример:
 * core-contracts НЕ должен зависеть от firebase / react / supabase
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const POLICY_FILE = 'dependency-policy.json';

if (!existsSync(POLICY_FILE)) {
  console.error('❌ Файл dependency-policy.json не найден');
  process.exit(1);
}

const policy = JSON.parse(readFileSync(POLICY_FILE, 'utf8'));

/**
 * Находит все пакеты в монорепо
 * @returns {Array<{name: string, path: string, packageJson: any}>}
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
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
              if (packageJson.name) {
                packages.push({
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

/**
 * Проверяет зависимости пакета на нарушение policy
 * @param {string} pkgName имя пакета
 * @param {object} pkgJson содержимое package.json
 */
function checkPolicy(pkgName, pkgJson) {
  const rules = policy[pkgName];
  if (!rules) return [];

  const deps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
    ...pkgJson.peerDependencies,
  };

  const violations = [];

  for (const forbidden of rules.forbidden || []) {
    if (deps && deps[forbidden]) {
      violations.push(forbidden);
    }
  }

  return violations;
}

console.log('🔍 Проверка dependency policy...');

const packages = findPackages();
let hasErrors = false;

for (const pkg of packages) {
  const violations = checkPolicy(pkg.name, pkg.packageJson);

  if (violations.length > 0) {
    hasErrors = true;
    console.error(`❌ ${pkg.name} нарушает dependency policy:`);
    violations.forEach((dep) => {
      console.error(`   - запрещённая зависимость: ${dep}`);
    });
  } else {
    console.log(`✅ ${pkg.name}: policy соблюдена`);
  }
}

if (hasErrors) {
  console.error('\n⛔ Dependency policy нарушена');
  process.exit(1);
}

console.log('\n🎉 Dependency policy соблюдена');
