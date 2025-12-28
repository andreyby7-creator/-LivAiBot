#!/usr/bin/env node

/**
 * @file Скрипт для проверки покрытия кода конкретного файла
 *
 * Использование: node scripts/coverage-file.js <filename>
 * Пример: node scripts/coverage-file.js ErrorCode.ts
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fileName = process.argv[2];

if (!fileName) {
  console.log('❌ Ошибка: Укажите имя файла');
  console.log('📖 Использование: node scripts/coverage-file.js <filename>');
  console.log('📝 Пример: node scripts/coverage-file.js ErrorCode.ts');
  process.exit(1);
}

// Путь к файлу покрытия
const coveragePath = join(__dirname, '..', 'coverage', 'coverage-final.json');

if (!existsSync(coveragePath)) {
  console.log('❌ Файл coverage/coverage-final.json не найден');
  console.log('💡 Запустите сначала: pnpm run test:coverage:html');
  process.exit(1);
}

try {
  // Читаем файл покрытия
  const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));

  // Ищем файл в данных покрытия
  const fileEntry = Object.entries(coverage).find(([key]) =>
    key.endsWith(fileName) || key.includes(`/${fileName}`)
  );

  if (!fileEntry) {
    console.log(`❌ Файл "${fileName}" не найден в отчете покрытия`);
    console.log('📋 Доступные файлы:');
    Object.keys(coverage)
      .filter((key) => key.includes('src/'))
      .slice(0, 10)
      .forEach((key) => console.log(`   - ${key.replace(/.*\/src\//, 'src/')}`));
    if (Object.keys(coverage).length > 10) {
      console.log(`   ... и еще ${Object.keys(coverage).length - 10} файлов`);
    }
    process.exit(1);
  }

  const [filePath, data] = fileEntry;

  // Функция для расчета процента
  const calcPercent = (covered, total) => {
    if (!total || total === 0) return 100;
    return Math.floor((covered / total) * 100);
  };

  // Рассчитываем покрытие для каждого типа
  const statements = calcPercent(
    data.s ? Object.values(data.s).filter((x) => x > 0).length : 0,
    data.s ? Object.keys(data.s).length : 0,
  );

  const functions = calcPercent(
    data.f ? Object.values(data.f).filter((x) => x > 0).length : 0,
    data.f ? Object.keys(data.f).length : 0,
  );

  const branches = calcPercent(
    data.b ? Object.values(data.b).filter(([taken, total]) => taken > 0).length : 0,
    data.b ? Object.keys(data.b).length : 0,
  );

  const lines = calcPercent(
    data.l ? Object.values(data.l).filter((x) => x > 0).length : 0,
    data.l ? Object.keys(data.l).length : 0,
  );

  // Выводим результат
  console.log(`📊 Покрытие кода для файла: ${filePath.replace(/.*\/src\//, 'src/')}`);
  console.log(`   📝 Statements: ${statements}%`);
  console.log(`   🔧 Functions: ${functions}%`);
  console.log(`   🌿 Branches: ${branches}%`);
  console.log(`   📏 Lines: ${lines}%`);

  // Предупреждение если покрытие низкое
  const avgCoverage = (statements + functions + branches + lines) / 4;
  if (avgCoverage < 80) {
    console.log(`⚠️  Низкое покрытие (${Math.floor(avgCoverage)}%) - рекомендуется добавить тесты`);
  } else {
    console.log(`✅ Хорошее покрытие (${Math.floor(avgCoverage)}%)`);
  }
} catch (error) {
  console.error('❌ Ошибка при обработке файла покрытия:', error.message);
  process.exit(1);
}
