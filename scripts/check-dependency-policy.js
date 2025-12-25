#!/usr/bin/env node

/**
 * Проверка dependency policy в монорепо.
 *
 * Назначение:
 * - Запрещает определённым пакетам зависеть от указанных зависимостей
 * - Защищает архитектурные слои (core, infra, ui)
 *
 * Пример:
 * core-contracts НЕ должен зависеть от firebase / react / supabase
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const POLICY_FILE = 'dependency-policy.json';

if (!existsSync(POLICY_FILE)) {
  console.error('❌ Файл dependency-policy.json не найден');
  process.exit(1);
}

const policy = JSON.parse(readFileSync(POLICY_FILE, 'utf8'));

/**
 * Загружает package.json пакета
 * @param {string} pkgPath путь к пакету
 */
function loadPackageJson(pkgPath) {
  const file = join(pkgPath, 'package.json');
  return JSON.parse(readFileSync(file, 'utf8'));
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

console.log('🔍 Проверка dependency policy...\n');

let hasErrors = false;

for (const pkgName of Object.keys(policy)) {
  const pkgPath = existsSync(pkgName) ? pkgName : join('.', pkgName);

  if (!existsSync(pkgPath)) continue;

  const pkgJson = loadPackageJson(pkgPath);
  const violations = checkPolicy(pkgName, pkgJson);

  if (violations.length > 0) {
    hasErrors = true;
    console.error(`❌ ${pkgName} нарушает dependency policy:`);
    violations.forEach((dep) => {
      console.error(`   - запрещённая зависимость: ${dep}`);
    });
  } else {
    console.log(`✅ ${pkgName}: policy соблюдена`);
  }
}

if (hasErrors) {
  console.error('\n⛔ Dependency policy нарушена');
  process.exit(1);
}

console.log('\n🎉 Dependency policy соблюдена');
