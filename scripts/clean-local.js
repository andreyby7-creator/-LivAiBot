#!/usr/bin/env node

/**
 * Очистка кэша и временных файлов без использования Turbo.
 *
 * Удаляет:
 * - dist/ директории
 * - *.tsbuildinfo файлы
 * - .eslintcache файлы
 * - node_modules/.cache директории
 */

import { existsSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

console.log('🧹 Очистка кэша и временных файлов...');

/**
 * Рекурсивно удаляет директории и файлы
 * @param {string} dir - директория для очистки
 * @param {string[]} patterns - паттерны для удаления
 */
function cleanDirectory(dir, patterns) {
  if (!existsSync(dir)) return;

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Проверяем паттерны директорий
        if (patterns.some((pattern) => item === pattern || item.endsWith(pattern))) {
          console.log(`🗑️  Удаление директории: ${fullPath}`);
          rmSync(fullPath, { recursive: true, force: true });
        } else if (!item.startsWith('.') && item !== 'node_modules') {
          // Рекурсивно очищаем поддиректории
          cleanDirectory(fullPath, patterns);
        }
      } else if (stat.isFile()) {
        // Проверяем паттерны файлов
        if (patterns.some((pattern) => item.endsWith(pattern))) {
          console.log(`🗑️  Удаление файла: ${fullPath}`);
          rmSync(fullPath, { force: true });
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Ошибка при очистке ${dir}: ${error.message}`);
  }
}

// Очищаем корневую директорию
const rootPatterns = ['dist', '.eslintcache'];
cleanDirectory('.', rootPatterns);

// Очищаем packages
if (existsSync('packages')) {
  cleanDirectory('packages', ['dist', '*.tsbuildinfo', '.eslintcache']);
}

// Очищаем services
if (existsSync('services')) {
  cleanDirectory('services', ['__pycache__', '*.pyc']);
}

console.log('\n✅ Очистка завершена');
