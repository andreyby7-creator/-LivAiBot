/**
 * @file Центральный ESLint конфиг для LivAiBot монорепо
 *
 * Единая точка входа для всех ESLint проверок.
 * Автоматически подключает все зоны, правила и архитектурные границы.
 *
 * ⚠️ ВАЖНО: Для monorepo лучше запускать ESLint через корневой конфиг, а не локально в пакете.
 * Локальный запуск полезен для разработки конкретного пакета, но полный type-aware анализ
 * должен быть через корень для единообразия проверки всех пакетов.
 *
 * Использование:
 * - pnpm lint:dev     (режим разработки с предупреждениями)
 * - pnpm lint:canary  (строгий режим без предупреждений)
 * - pnpm lint:fix     (автофикс проблем)
 */

// ==================== ОСНОВНЫЕ ИМПОРТЫ ====================
/**
 * Импортируем все компоненты ESLint конфигурации
 */
import devMode from './config/eslint/modes/dev.config.mjs';
import canaryMode from './config/eslint/modes/canary.config.mjs';

// ==================== ВЫБОР РЕЖИМА ====================
/**
 * Определяем режим работы на основе переменной окружения
 * По умолчанию используется dev режим
 */
const ESLINT_MODE = process.env.ESLINT_MODE || 'dev';

let selectedConfig;

switch (ESLINT_MODE) {
  case 'dev':
    selectedConfig = devMode;
    break;
  case 'canary':
    selectedConfig = canaryMode;
    break;
  default:
    selectedConfig = devMode;
}

// ==================== ЭКСПОРТ ====================
/**
 * Центральный экспорт конфигурации
 * Выбирает режим на основе ESLINT_MODE + глобальные ignores
 */
export default [
  // Глобальные ignores для всех режимов (включая lint-staged)
  {
    ignores: [
      '**/dist/**',     // Скомпилированные файлы во всех пакетах монорепо
      'config/**/*.ts', // Конфигурационные файлы (vitest, vite) могут использовать dynamic imports
      'config/**/*.js', // Тестовые скрипты могут использовать fs, child_process
    ],
  },
  // Основная конфигурация режима
  ...selectedConfig,
];

// ==================== ДОСТУП К РЕЖИМАМ ====================
/**
 * Прямой доступ к dev режиму
 */
export { devMode };

/**
 * Прямой доступ к canary режиму
 */
export { canaryMode };
