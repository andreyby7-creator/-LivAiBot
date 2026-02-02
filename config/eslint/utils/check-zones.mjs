#!/usr/bin/env node

/**
 * @file Валидация зон пакетов ESLint для LivAi
 *
 * 🏗️ АРХИТЕКТУРА LIVAI:
 * - foundation: core-contracts, core, events, observability
 * - aiExecution: feature-* пакеты (AI бизнес-логика)
 * - ui: ui-* пакеты (пользовательский интерфейс)
 * - apps: packages/app + apps/* (приложения)
 * - infrastructure: ESLint плагины и инфраструктурные компоненты
 *
 * Проверяет что все пакеты правильно распределены по архитектурным зонам.
 * Запускается в CI перед merge для валидации новых пакетов.
 *
 * Usage: node config/eslint/utils/check-zones.mjs
 *
 * ⚠️ Этот файл является утилитой для валидации структуры проекта и требует прямого доступа к файловой системе.
 * Использование fs здесь оправдано, так как это инструмент разработки, а не часть runtime кода.
 */

import fs from 'fs';
import path from 'path';

// ==================== КОНФИГУРАЦИЯ ЗОН ====================
// EXPECTED_ZONES используется для отчетов о coverage и архитектурном контроле
// Источник истины - PACKAGE_ZONE_MAPPING выше!
// Эти зоны описывают ожидаемую архитектуру для аналитики и документации
const EXPECTED_ZONES = {
  // 🎯 FOUNDATION: Ядро системы (ядро, контракты, инфраструктура)
  foundation: {
    description: 'Core system (contracts, core logic, infrastructure)',
    expectedPackages: 4,  // packages/core-contracts, packages/core, packages/events, packages/observability
    technologies: ['typescript', 'effect-ts', 'fp'],
    purpose: 'System foundation and cross-cutting concerns',
  },

  // 🎯 AI EXECUTION: AI бизнес-логика
  aiExecution: {
    description: 'AI business logic (agents, chat, voice, auth)',
    expectedPackages: 4,  // feature-auth, feature-bots, feature-chat, feature-voice
    technologies: ['typescript', 'effect-ts', 'ai', 'fp'],
    purpose: 'AI-powered business capabilities',
  },

  // 🎯 UI: Пользовательский интерфейс
  ui: {
    description: 'User interface components',
    expectedPackages: 3,  // ui-core, ui-features, ui-shared
    technologies: ['react', 'typescript', 'next'],
    purpose: 'UI components and user experience',
  },

  // 🎯 APPS: Frontend приложения
  apps: {
    description: 'Frontend applications',
    expectedPackages: 5,  // app + 4 apps/*
    technologies: ['react', 'next', 'typescript'],
    purpose: 'Application entry points and presentation layer',
  },

  // 🎯 INFRASTRUCTURE: Инфраструктурные компоненты
  infrastructure: {
    description: 'Infrastructure components',
    expectedPackages: 0,  // Пока инфраструктура через директории, не пакеты
    technologies: ['kubernetes', 'terraform', 'docker'],
    purpose: 'Infrastructure as code and deployment',
  },
};

// Экспортируем данные для использования в validate-zones.mjs
export { EXPECTED_ZONES, PACKAGE_ZONE_MAPPING };

// ==================== РАБОТА С ФАЙЛОВОЙ СИСТЕМОЙ ====================
// Объявляем общие пути
const appsDir = path.resolve('./apps');
const packagesDir = path.resolve('./packages');

// Кеш для избежания повторных чтений
let appsCache = null;

// Декларативный маппинг пакетов на зоны для LivAiBot Clean Architecture
//
// ⚠️  ОБНОВЛЯТЬ ПРИ ДОБАВЛЕНИИ НОВЫХ ПАКЕТОВ!
// ⚠️  Кто добавляет пакет, тот и добавляет соответствующую строку в маппинг!
//
// 📋 ПРАВИЛА ДОБАВЛЕНИЯ НОВОГО ПАКЕТА:
//
// 1. Определите архитектурную зону пакета согласно LivAi архитектуре:
//    - foundation: contracts, core, events, observability (ядро системы)
//    - aiExecution: AI бизнес-логика (agents, chat, voice, auth)
//    - ui: пользовательский интерфейс (core, features, shared)
//    - apps: frontend приложения (web, admin, mobile, pwa)
//    - infrastructure: инфраструктурные компоненты
//
// 2. Добавьте пакет в соответствующую зону
//
// 3. Запустите тесты: node config/eslint/test/check-zones.test.js
//
// 4. Проверьте распределение: node config/eslint/utils/check-zones.js
//
// 🔍 ИЕРАРХИЯ ПРИОРИТЕТОВ МАППИНГА:
// 1. Точные совпадения (высокий приоритет): 'exact-package-name'
// 2. Специфичные префиксы (средний приоритет): 'packages/path/'
// 3. Общие префиксы (низкий приоритет): 'packages/general/'
//
// 📝 ФОРМАТ:
// - 'exact-package-name': 'zone' - для точных совпадений
// - 'packages/path/': 'zone' - для префиксов (обязательно заканчивается на /)
const PACKAGE_ZONE_MAPPING = {
  // 🎯 ИСТОЧНИК ИСТИНЫ: ЯВНЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
  // Каждый пакет должен быть явно замэплен - никаких автоматических назначений!

  // FOUNDATION: Ядро системы
  'packages/core-contracts': 'foundation', // Core contracts
  'packages/core': 'foundation',
  'packages/events': 'foundation',
  'packages/observability': 'foundation',

  // AI EXECUTION: AI бизнес-логика
  'packages/feature-auth': 'aiExecution',
  'packages/feature-bots': 'aiExecution',
  'packages/feature-chat': 'aiExecution',
  'packages/feature-voice': 'aiExecution',

  // UI: Пользовательский интерфейс
  'packages/ui-core': 'ui',
  'packages/ui-features': 'ui',
  'packages/ui-shared': 'ui',

  // APPS: Приложения (явное перечисление!)
  'packages/app': 'apps',
  'apps/web': 'apps',
  'apps/admin': 'apps',
  'apps/mobile': 'apps',
  'apps/pwa': 'apps',

  // INFRASTRUCTURE: Инфраструктурные компоненты
  // Пока пусто - инфраструктура через директории, не пакеты
};

// ==================== ФУНКЦИИ ОПРЕДЕЛЕНИЯ ЗОН ====================
/**
 * Определяет зону пакета на основе package.json
 * @deprecated НЕ ИСПОЛЬЗУЕТСЯ: Архитектура должна объявляться явно, а не угадываться
 * @param {string} pkg - путь к пакету
 * @returns {string|null} имя зоны или null
 */
function getZoneFromPackageJson(pkg) {
  const pkgJsonPath = path.join(pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return null;

  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    // Проверяем keywords для LivAi архитектуры
    const keywords = pkgJson.keywords || [];
    if (keywords.includes('ai') || keywords.includes('agent')) return 'aiExecution';
    if (keywords.includes('ui') || keywords.includes('component')) return 'ui';
    if (keywords.includes('auth')) return 'aiExecution';
    if (keywords.includes('infrastructure')) return 'infrastructure';

    // Проверяем description
    const desc = (pkgJson.description || '').toLowerCase();
    if (desc.includes('ai') || desc.includes('agent') || desc.includes('chat')) return 'aiExecution';
    if (desc.includes('ui') || desc.includes('component') || desc.includes('interface')) return 'ui';
    if (desc.includes('auth') || desc.includes('login')) return 'aiExecution';
    if (desc.includes('foundation') || desc.includes('core') || desc.includes('contract')) return 'foundation';

    // Проверяем name паттерны для LivAi
    const name = pkgJson.name || '';
    if (name.includes('feature-')) return 'aiExecution';
    if (name.includes('ui-')) return 'ui';
    if (name.includes('eslint-plugin-')) return 'infrastructure';

    return null;
  } catch {
    return null;
  }
}

/**
 * Определяет зону пакета из декларативного маппинга
 * @param {string} pkg - путь к пакету
 * @returns {string|null} имя зоны или null
 */
function getZoneFromMapping(pkg) {
  // 1. Точные совпадения (высокий приоритет)
  if (Object.prototype.hasOwnProperty.call(PACKAGE_ZONE_MAPPING, pkg)) {
    return PACKAGE_ZONE_MAPPING[pkg];
  }

  // 2. Префиксы (от длинных к коротким для специфичности)
  const prefixMatches = Object.entries(PACKAGE_ZONE_MAPPING)
    .filter(([key]) => key.endsWith('/') && pkg.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length); // Более длинные префиксы первыми

  return prefixMatches[0]?.[1] || null;
}

/**
 * Генерирует предложенный маппинг для неназначенных пакетов
 * @param {string[]} unassignedPackages - массив путей к неназначенным пакетам
 * @returns {string} форматированный маппинг для copy-paste
 */
function generateSuggestedMapping(unassignedPackages) {
  const suggestions = [];

  unassignedPackages.forEach(pkg => {
    const pkgJsonPath = path.join(pkg, 'package.json');

    let suggestedZone = 'foundation'; // default зона
    let comment = 'Auto-suggested';

    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const advisoryZone = getZoneFromPackageJson(pkg);

        if (advisoryZone) {
          suggestedZone = advisoryZone;
          comment = `Suggested by package.json analysis`;
        }
      } catch {
        // ignore errors
      }
    } else {
      // Для пакетов без package.json
      if (pkg.includes('infrastructure/') || pkg.startsWith('infrastructure/')) {
        suggestedZone = 'infrastructure';
        comment = 'Infrastructure component';
      }
    }

    suggestions.push(`  '${pkg}': '${suggestedZone}', // ${comment}`);
  });

  return suggestions.join('\n');
}

/**
 * Основная функция определения зоны пакета
 * @param {string} pkg - путь к пакету
 * @returns {string|null} имя зоны или null (unassigned)
 */
function suggestZone(pkg) {
  // 🎯 ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ: ЯВНЫЙ ДЕКЛАРАТИВНЫЙ МАППИНГ
  // Архитектура ОБЪЯВЛЯЕТСЯ человеком, а не УГАДЫВАЕТСЯ машиной

  const zoneFromMapping = getZoneFromMapping(pkg);
  if (zoneFromMapping) return zoneFromMapping;

  // Нет явного маппинга → unassigned → требует ручного архитектурного решения
  return null;
}

// ==================== РАБОТА С ФАЙЛОВОЙ СИСТЕМОЙ ====================
/**
 * Оптимизированная функция чтения директорий с кешированием
 * @param {string} dirPath - путь к директории
 * @returns {Array} массив объектов с информацией о файлах/директориях
 */
function readDirCached(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries
      .map(name => {
        const fullPath = path.join(dirPath, name);
        try {
          const stat = fs.statSync(fullPath);
          return {
            name,
            fullPath,
            isDirectory: stat.isDirectory(),
            isValid: stat.isDirectory() && !name.startsWith('.') && name !== 'node_modules',
          };
        } catch {
          return { name, fullPath, isDirectory: false, isValid: false };
        }
      })
      .filter(entry => entry.isValid);
  } catch {
    return [];
  }
}

/**
 * Получает список всех реальных пакетов из файловой системы
 * @returns {string[]} отсортированный массив путей к пакетам
 */
function getAllPackages() {
  const allPackages = [];

  // 1. Корневые пакеты (core-contracts) - быстрая проверка существования
  const rootDirs = ['core-contracts'];
  const existingRootDirs = rootDirs.filter(dir => {
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
  allPackages.push(...existingRootDirs);

  // 2. Apps пакеты - одно чтение директории с кешированием
  const appsEntries = readDirCached(appsDir);
  appsCache = appsEntries.map(entry => entry.name); // Кешируем для APPS COVERAGE
  allPackages.push(...appsEntries.map(entry => `apps/${entry.name}`));

  // 3. Packages - плоская структура в LivAi
  const packagesEntries = readDirCached(packagesDir);

  for (const pkgEntry of packagesEntries) {
    const pkgName = pkgEntry.name;
    allPackages.push(`packages/${pkgName}`);
  }

  return allPackages.sort();
}

// Выполняем основной код только если файл запущен напрямую, а не импортирован
if (import.meta.url === `file://${process.argv[1]}`) {
  const actualPackages = getAllPackages();

  // ==================== ОСНОВНАЯ ЛОГИКА ВАЛИДАЦИИ ====================

  console.log(`📦 Найдено пакетов: ${actualPackages.length}\n`);

  // 🎯 ИСТОЧНИК ИСТИНЫ: Проверяем PACKAGE_ZONE_MAPPING
  const issues = [];
  const assigned = new Set();
  const zoneStats = {};

  console.log('🎯 PACKAGE_ZONE_MAPPING VALIDATION:\n');

  // Собираем статистику по зонам
  for (const [pkgName, zoneName] of Object.entries(PACKAGE_ZONE_MAPPING)) {
    const exists = actualPackages.includes(pkgName);

    if (!zoneStats[zoneName]) {
      zoneStats[zoneName] = { total: 0, found: 0, missing: [] };
    }
    zoneStats[zoneName].total++;

    if (exists) {
      zoneStats[zoneName].found++;
      assigned.add(pkgName);
      console.log(`  ✅ ${pkgName} → ${zoneName}`);
    } else {
      zoneStats[zoneName].missing.push(pkgName);
      console.log(`  ❌ ${pkgName} → ${zoneName} (пакет не найден)`);
      issues.push({
        type: 'missing_package',
        package: pkgName,
        zone: zoneName,
        message: `Package '${pkgName}' mapped to zone '${zoneName}' but not found in filesystem`,
      });
    }
  }

  console.log('\n📊 ZONE COVERAGE REPORT:\n');

  for (const [zoneName, stats] of Object.entries(zoneStats)) {
    const coverage = stats.total > 0 ? Math.round((stats.found / stats.total) * 100) : 0;
    console.log(`${zoneName.toUpperCase()} ZONE: ${stats.found}/${stats.total} (${coverage}%)`);

    if (stats.missing.length > 0) {
      stats.missing.forEach(pkg => console.log(`  ⚠️  Missing: ${pkg}`));
    }
  }

  console.log('');

  // Ищем неназначенные пакеты (не в PACKAGE_ZONE_MAPPING)
  const unassigned = actualPackages.filter(pkg => !assigned.has(pkg));

  if (unassigned.length > 0) {
    console.log('⚠️  НЕНАЗНАЧЕННЫЕ ПАКЕТЫ:');
    console.log('========================\n');

    unassigned.forEach(pkg => {
      console.log(`  ❌ ${pkg} - НЕ РАСПРЕДЕЛЁН ПО ЗОНАМ`);
      issues.push({
        type: 'unassigned',
        package: pkg,
        message: `Package '${pkg}' не распределён по зонам`,
      });
    });

    console.log('');
    console.log('💡 Рекомендации для неназначенных пакетов:');

    unassigned.forEach(pkg => {
      // Унифицированный путь к package.json для всех типов пакетов
      const pkgJsonPath = path.join(pkg, 'package.json');

      if (fs.existsSync(pkgJsonPath)) {
        try {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
          const description = pkgJson.description || 'No description';

          // Advisory подсказка из package.json (НЕ authoritative!)
          const advisoryZone = getZoneFromPackageJson(pkg);

          console.log(`  📋 ${pkg}:`);
          console.log(`     Description: ${description}`);
          console.log(`     Advisory guess (NOT authoritative): ${advisoryZone || 'none'}`);
          console.log(`     REQUIRED: Add explicit mapping to PACKAGE_ZONE_MAPPING`);
          console.log('');
        } catch (error) {
          console.log(`  📋 ${pkg}: (error reading package.json)`);
          console.log('');
        }
      } else {
        // Для пакетов без package.json (например, infrastructure/database/seed)
        let suggestedZone = 'infrastructure'; // default для infra подпапок

        if (pkg.includes('infrastructure/database')) {
          suggestedZone = 'infrastructure'; // seed файлы - инфраструктура
        }

        console.log(`  📋 ${pkg}: (no package.json - ${suggestedZone})`);
        console.log('');
      }
    });

    // 🎯 АВТО-ГЕНЕРАЦИЯ МАППИНГА ДЛЯ COPY-PASTE
    console.log('📝 ПРОИЗВЕДЕННЫЙ МАППИНГ ДЛЯ ДОБАВЛЕНИЯ:');
    console.log('==========================================\n');

    const suggestedMapping = generateSuggestedMapping(unassigned);
    console.log('// Добавьте эти строки в PACKAGE_ZONE_MAPPING выше:');
    console.log(suggestedMapping);
    console.log('\n// ⚠️  ПРОВЕРЬТЕ ПРЕДЛОЖЕННЫЕ ЗОНЫ! Авто-определение может быть неточным.');
    console.log('// ⚠️  Согласуйте архитектурные решения с командой перед добавлением.\n');
  }

  // Проверяем apps/ (используем кеш из getAllPackages)
  console.log('🚀 APPS COVERAGE:\n');

  const apps = appsCache || [];
  const expectedApps = {
    web: 'apps',    // Web приложение
    admin: 'apps',  // Admin панель
    mobile: 'apps', // Mobile приложение
    pwa: 'apps',    // Progressive Web App
  };

  apps.forEach(app => {
    const zone = Object.prototype.hasOwnProperty.call(expectedApps, app)
      ? expectedApps[app]
      : 'UNKNOWN';
    console.log(`  ✅ apps/${app} → ${zone} zone`);
  });

  console.log('');

  // Итоговый отчет
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Итоговый отчет\n');

  console.log(`✅ Назначено зон: ${assigned.size} пакетов`);
  console.log(`❌ Неназначено: ${unassigned.length} пакетов`);
  console.log(`📊 Coverage: ${Math.round((assigned.size / actualPackages.length) * 100)}%`);

  console.log('');

  if (issues.length === 0) {
    console.log('🎉 Все пакеты правильно распределены по зонам!');
    console.log('✅ Zone validation PASSED\n');
    process.exit(0);
  } else {
    console.log('❌ Найдены проблемы с распределением зон:');
    console.log(`   Всего проблем: ${issues.length}\n`);

    issues.forEach(issue => {
      console.log(`   ❌ ${issue.package}: ${issue.message}`);
    });

    console.log('');
    console.log('💡 Действия:');
    console.log('   1. Определите правильную зону для каждого пакета согласно LivAi архитектуре');
    console.log('   2. Добавьте маппинг в PACKAGE_ZONE_MAPPING в check-zones.mjs');
    console.log('   3. Запустите анализ снова\n');

    process.exit(1);
  }
} // Закрываем условие import.meta.url === ...
