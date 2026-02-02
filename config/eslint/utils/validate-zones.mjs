#!/usr/bin/env node

/**
 * @file Валидация конфигурации зон ESLint для LivAi
 *
 * Проверяет корректность EXPECTED_ZONES: соответствие expectedPackages,
 * уникальность пакетов в PACKAGE_ZONE_MAPPING, архитектурную целостность.
 *
 * Usage: node config/eslint/utils/validate-zones.mjs [--verbose|-v]
 *
 * Options:
 *   --verbose, -v    Показать полный список пакетов для всех зон
 */

// Используем async IIFE для поддержки top-level await
(async () => {
  // Парсим аргументы командной строки
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');

  if (verbose) {
    console.log('🔍 Режим подробного вывода (--verbose): будут показаны все пакеты зон\n');
  }

  // Импортируем данные из check-zones.mjs
  let EXPECTED_ZONES, PACKAGE_ZONE_MAPPING;
  try {
    const { EXPECTED_ZONES: zones, PACKAGE_ZONE_MAPPING: mapping } = await import('./check-zones.mjs');
    EXPECTED_ZONES = zones;
    PACKAGE_ZONE_MAPPING = mapping;
  } catch (error) {
    console.error('❌ Ошибка импорта данных из check-zones.mjs:', error.message);
    console.error('💡 Убедитесь, что файл check-zones.mjs существует и корректен');
    process.exit(1);
  }

  // Проверяем корректность импортированных данных
  if (!EXPECTED_ZONES || typeof EXPECTED_ZONES !== 'object') {
    console.error('❌ EXPECTED_ZONES не найден или имеет некорректный формат');
    console.error('💡 Проверьте экспорт EXPECTED_ZONES в check-zones.mjs');
    process.exit(1);
  }

  if (!PACKAGE_ZONE_MAPPING || typeof PACKAGE_ZONE_MAPPING !== 'object') {
    console.error('❌ PACKAGE_ZONE_MAPPING не найден или имеет некорректный формат');
    console.error('💡 Проверьте экспорт PACKAGE_ZONE_MAPPING в check-zones.mjs');
    process.exit(1);
  }

  // Проверяем структуру EXPECTED_ZONES
  for (const [zoneName, zoneConfig] of Object.entries(EXPECTED_ZONES)) {
    if (!zoneConfig || typeof zoneConfig !== 'object') {
      console.error(`❌ Конфигурация зоны "${zoneName}" имеет некорректный формат`);
      process.exit(1);
    }

    // Проверяем обязательные поля новой структуры
    if (typeof zoneConfig.expectedPackages !== 'number' || zoneConfig.expectedPackages < 0) {
      console.error(
        `❌ zoneConfig.expectedPackages для зоны "${zoneName}" должен быть неотрицательным числом, получен: ${zoneConfig.expectedPackages}`
      );
      console.error('💡 Проверьте определение зоны в EXPECTED_ZONES (check-zones.mjs)');
      process.exit(1);
    }

    if (!zoneConfig.description || typeof zoneConfig.description !== 'string') {
      console.error(
        `❌ zoneConfig.description для зоны "${zoneName}" должен быть строкой, получен: ${typeof zoneConfig.description}`
      );
      process.exit(1);
    }
  }

  // ==================== НАЧАЛО ВАЛИДАЦИИ ====================

  console.log('🔍 Валидация конфигурации зон для LivAiBot Clean Architecture\n');

  // ==================== ПОДСЧЕТ ПАКЕТОВ ПО ЗОНАМ ====================
  console.log('1️⃣ Подсчет пакетов по зонам...');

  const zonePackageCounts = {};
  const packageZoneMap = new Map();

  // Инициализируем счетчики для всех зон
  Object.keys(EXPECTED_ZONES).forEach(zoneName => {
    zonePackageCounts[zoneName] = 0;
  });

  // Подсчитываем пакеты из PACKAGE_ZONE_MAPPING
  // EXPECTED_ZONES является authoritative source для определения допустимых зон,
  // а PACKAGE_ZONE_MAPPING содержит фактический список пакетов и их назначения
  for (const [packageName, zoneName] of Object.entries(PACKAGE_ZONE_MAPPING)) {
    if (!EXPECTED_ZONES[zoneName]) {
      console.error(`❌ Зона "${zoneName}" из PACKAGE_ZONE_MAPPING не найдена в EXPECTED_ZONES`);
      console.error('💡 Добавьте зону в EXPECTED_ZONES или исправьте маппинг в check-zones.mjs');
      process.exit(1);
    }

    zonePackageCounts[zoneName]++;
    packageZoneMap.set(packageName, zoneName);
  }

  console.log('✅ Подсчет завершен');

  // ==================== ПРОВЕРКА УНИКАЛЬНОСТИ ПАКЕТОВ ====================
  console.log('\n2️⃣ Проверка уникальности пакетов...');

  const duplicates = [];
  const seenPackages = new Set();

  for (const packageName of Object.keys(PACKAGE_ZONE_MAPPING)) {
    if (seenPackages.has(packageName)) {
      const existingZone = packageZoneMap.get(packageName);
      const currentZone = PACKAGE_ZONE_MAPPING[packageName];
      duplicates.push({ pkg: packageName, zones: [existingZone, currentZone] });
    } else {
      seenPackages.add(packageName);
    }
  }

  if (duplicates.length > 0) {
    console.log('❌ Найдены дубликаты пакетов:');
    duplicates.forEach(d => console.log(`   ${d.pkg}: ${d.zones.join(', ')}`));
    console.log('💡 Исправьте дубликаты в PACKAGE_ZONE_MAPPING (check-zones.mjs)');
  } else {
    console.log('✅ Все пакеты уникальны');
  }

  // ==================== ПРОВЕРКА СООТВЕТСТВИЯ expectedPackages ====================
  console.log('\n3️⃣ Проверка соответствия expectedPackages...');

  const mismatchedZones = [];

  for (const [zoneName, zoneConfig] of Object.entries(EXPECTED_ZONES)) {
    const actualCount = zonePackageCounts[zoneName] || 0;
    const expectedCount = zoneConfig.expectedPackages;

    if (actualCount !== expectedCount) {
      mismatchedZones.push({
        zone: zoneName,
        expected: expectedCount,
        actual: actualCount,
        difference: actualCount - expectedCount
      });
    }
  }

  if (mismatchedZones.length > 0) {
    console.log('⚠️  Найдены несоответствия expectedPackages:');
    mismatchedZones.forEach(mismatch => {
      const sign = mismatch.difference > 0 ? '+' : '';
      console.log(`   ${mismatch.zone}: ожидается ${mismatch.expected}, фактически ${mismatch.actual} (${sign}${mismatch.difference})`);
    });
    console.log('💡 Обновите expectedPackages в EXPECTED_ZONES или добавьте/удалите пакеты в PACKAGE_ZONE_MAPPING (check-zones.mjs)');
  } else {
    console.log('✅ Все зоны соответствуют expectedPackages');
  }

  // ==================== КРАТКАЯ СВОДКА ПРОБЛЕМ ====================
  console.log('\n📋 КРАТКАЯ СВОДКА:');
  console.log(`   🔍 Дубликаты пакетов: ${duplicates.length}`);
  console.log(`   📊 Несоответствия expectedPackages: ${mismatchedZones.length}`);

  const totalProblems = duplicates.length + mismatchedZones.length;
  if (totalProblems > 0) {
    console.log(`   🔴 ОБЩЕЕ КОЛИЧЕСТВО ПРОБЛЕМ: ${totalProblems}`);
    console.log('   💡 Детальный анализ ниже...');
  } else {
    console.log('   ✅ ПРОБЛЕМ НЕ НАЙДЕНО - конфигурация корректна!');
  }
  console.log('');

  // ==================== СТАТИСТИКА И ОТЧЕТ ====================

  console.log('\n📊 СТАТИСТИКА:');
  console.log(`   Всего зон: ${Object.keys(EXPECTED_ZONES).length}`);
  console.log(`   Всего пакетов: ${packageZoneMap.size}`);
  console.log(
    `   Среднее пакетов на зону: ${(packageZoneMap.size / Object.keys(EXPECTED_ZONES).length).toFixed(1)}`
  );

  const totalExpected = Object.values(EXPECTED_ZONES).reduce((acc, z) => acc + z.expectedPackages, 0);
  console.log(`   Coverage: ${(packageZoneMap.size / totalExpected * 100).toFixed(1)}%`);

  console.log('\n🎯 LivAi Architecture coverage (отсортировано по количеству пакетов):');

  // Создаем массив зон с их статистикой для сортировки
  const zoneStats = Object.entries(EXPECTED_ZONES).map(([zoneName, zoneConfig]) => {
    // Собираем пакеты для этой зоны
    const packages = [];
    for (const [pkgName, pkgZone] of Object.entries(PACKAGE_ZONE_MAPPING)) {
      if (pkgZone === zoneName) {
        packages.push(pkgName);
      }
    }
    packages.sort(); // Сортируем пакеты для читаемости

    return {
      name: zoneName,
      expectedCount: zoneConfig.expectedPackages,
      actualCount: packages.length,
      packages: packages,
      description: zoneConfig.description,
      technologies: zoneConfig.technologies,
    };
  });

  // Сортируем зоны по количеству пакетов (по убыванию)
  zoneStats.sort((a, b) => b.actualCount - a.actualCount);

  zoneStats.forEach(({ name, expectedCount, actualCount, packages, description }) => {
    const status = actualCount === expectedCount ? '✅' : '⚠️ ';
    console.log(`   ${status} ${name}: ${actualCount}/${expectedCount} пакетов (${description})`);

    if (packages.length === 0) {
      console.log(`     └─ (нет пакетов)`);
    } else if (packages.length > 0) {
      if (verbose) {
        // В verbose режиме показываем все пакеты
        packages.forEach(pkg => console.log(`     └─ ${pkg}`));
      } else {
        // В обычном режиме показываем максимум 3 пакета
        if (packages.length <= 3) {
          packages.forEach(pkg => console.log(`     └─ ${pkg}`));
        } else {
          console.log(`     └─ ${packages.slice(0, 3).join(', ')} ... (+${packages.length - 3} пакетов)`);
          console.log(`       💡 Используйте --verbose для полного списка пакетов`);
        }
      }
    }
  });

  // ==================== ЗАВЕРШЕНИЕ ВАЛИДАЦИИ ====================

  console.log('\n✅ Валидация завершена!');

  // Выход с кодом ошибки если были проблемы
  if (totalProblems > 0) {
    console.log(`\n🔴 Найдено проблем: ${totalProblems}`);
    console.log('💡 Исправьте найденные проблемы в EXPECTED_ZONES или PACKAGE_ZONE_MAPPING (check-zones.mjs)');
    process.exit(1);
  }
})();
