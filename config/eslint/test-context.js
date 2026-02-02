import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Тестируем контекст выполнения canary.config.mjs
 * Располагаем скрипт в той же директории, что и canary.config.mjs
 */
function getProjectRoot() {
  // Получаем директорию текущего файла через import.meta.url (ESM)
  const __filename = fileURLToPath(import.meta.url);
  let currentDir = path.dirname(__filename);

  console.log('Директория скрипта (__filename):', __filename);
  console.log('Директория скрипта (dirname):', currentDir);
  console.log('Рабочая директория процесса (cwd):', process.cwd());
  console.log('ESLINT_MODE:', process.env.ESLINT_MODE || 'не установлена');

  // Ищем корень проекта по наличию package.json или tsconfig.json
  // Поднимаемся вверх по дереву до тех пор, пока не найдем корень
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');

    console.log(`\nПроверяем директорию: ${currentDir}`);
    const hasPackageJson = (() => {
      try {
        fs.accessSync(packageJsonPath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    })();
    const hasTsconfig = (() => {
      try {
        fs.accessSync(tsconfigPath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    })();
    console.log(`  package.json: ${hasPackageJson ? '✅' : '❌'}`);
    console.log(`  tsconfig.json: ${hasTsconfig ? '✅' : '❌'}`);

    // Если нашли package.json или tsconfig.json - это корень проекта
    if (hasPackageJson || hasTsconfig) {
      console.log(`  🎯 НАЙДЕН КОРЕНЬ ПРОЕКТА: ${currentDir}`);
      return currentDir;
    }

    // Поднимаемся на уровень выше
    currentDir = path.dirname(currentDir);
  }

  // Fallback: если не нашли, используем расчет по уровням
  // (config/eslint/modes/ -> корень = 3 уровня вверх)
  const fallback = path.resolve(path.dirname(__filename), '../../../..');
  console.log(`\n⚠️  Fallback корень: ${fallback}`);
  return fallback;
}

console.log('='.repeat(80));
console.log('КОНТЕКСТ ИСПОЛНЕНИЯ CANARY.CONFIG.MJS');
console.log('='.repeat(80));

const root = getProjectRoot();

console.log('\n' + '='.repeat(80));
console.log('ИТОГОВЫЙ tsconfigRootDir:', root);
console.log('='.repeat(80));

// Теперь попробуем понять, почему правила применяются по-разному
// Возможно, проблема в том, что ESLint находит разные tsconfig файлы
console.log('\nПРОВЕРКА TSCONFIG ФАЙЛОВ:');

const tsconfigPaths = [
  path.join(root, 'tsconfig.json'),
  path.join(root, 'packages', 'core-contracts', 'tsconfig.json'),
];

tsconfigPaths.forEach((tsconfigPath) => {
  console.log(`\n${tsconfigPath}:`);
  let exists = false;
  try {
    fs.accessSync(tsconfigPath, fs.constants.F_OK);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists) {
    try {
      const content = fs.readFileSync(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(content);
      console.log(`  ✅ Существует, extends: ${tsconfig.extends || 'не указано'}`);
      console.log(`  ✅ include: ${JSON.stringify(tsconfig.include || [])}`);
    } catch (e) {
      console.log(`  ❌ Ошибка чтения: ${e.message}`);
    }
  } else {
    console.log(`  ❌ Не существует`);
  }
});

console.log('\n' + '='.repeat(80));
