/**
 * @file Центральный ESLint конфиг для LivAi монорепо
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
import typescriptParser from '@typescript-eslint/parser';
import { CONFIG_FILES_RULES } from './config/eslint/shared/rules.mjs';

// ==================== ВЫБОР РЕЖИМА ====================
/**
 * Определяем режим работы на основе переменной окружения
 * По умолчанию используется dev режим
 */
const ESLINT_MODE = process.env.ESLINT_MODE || 'dev';

const MODE_PATHS = {
  dev: './config/eslint/modes/dev.config.mjs',
  canary: './config/eslint/modes/canary.config.mjs',
};

async function loadModeConfig(mode) {
  const normalizedMode = mode === 'canary' ? 'canary' : 'dev';
  const specifier = MODE_PATHS[normalizedMode] ?? MODE_PATHS.dev;
  const targetUrl = new URL(specifier, import.meta.url);

  try {
    const module = await import(targetUrl);
    return module.default;
  } catch (error) {
    console.error(`[eslint] Failed to load '${normalizedMode}' mode config from ${targetUrl.pathname}`);
    throw error;
  }
}

const selectedConfig = await loadModeConfig(ESLINT_MODE);

// ==================== ЭКСПОРТ ====================
/**
 * Центральный экспорт конфигурации
 * Выбирает режим на основе ESLINT_MODE + глобальные ignores
 */
export default [
  // Глобальные ignores для всех режимов (включая lint-staged)
  {
    ignores: [
      '**/dist/**',        // Скомпилированные файлы во всех пакетах монорепо
      '**/build/**',       // Папки сборки
      '**/generated/**',   // Автогенерированные исходники (проверяем через check:contracts)
      '**/html/**',        // Сгенерированные HTML assets и бандлы (webpack/vite output)
      '**/.turbo/**',      // Кеш Turborepo
      '**/.cache/**',      // Различные кеши (webpack, babel, etc.)
      '**/coverage/**',    // Отчеты о покрытии тестами
      '**/.next/**',       // Next.js build output
      '**/.venv/**',       // Python virtual environment
      '**/venv/**',        // Python virtual environment (alternative name)
      '**/public/sw.js',   // Сгенерированный Service Worker из TypeScript
      '**/empty-module.js', // Webpack заглушка для серверных модулей в клиентском коде
      'config/**/*.js',     // JS конфиги/утилиты: без type-aware линтинга (избегаем ошибок typed rules)
      'config/**/*.cjs',    // CJS конфиги/утилиты: аналогично
    ],
  },
  // Основная конфигурация выбранного режима
  ...selectedConfig,
  // Domain файлы — архитектурные исключения для domain слоя
  // @note Отключение правил обосновано архитектурными решениями:
  // - fp/no-throw: throw используется для invariant violation в domain type constructors
  //   (createRiskScore, createRiskModelVersion) — это не recoverable flow, а валидация типов.
  //   FP-правило ориентировано на application logic, а не на domain type constructors.
  // - functional/no-classes: классы используются для infrastructure boundary (DomainValidationError)
  //   для structured logging, instanceof проверок и совместимости с try/catch в app layer.
  //   Замена на фабрику ломает instanceof, stack trace и ухудшает DX.
  {
    files: ['**/domain/**/*.ts'],
    rules: {
      'fp/no-throw': 'off',              // ✅ Глобально для domain
      'functional/no-classes': 'off',    // ✅ Глобально для domain
    },
  },
  // LoginRiskAssessment domain: запрет Record в типах оценки риска логина
  {
    files: ['packages/feature-auth/src/domain/LoginRiskAssessment.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "TSTypeReference[typeName.name='Record'][typeParameters.params.0.typeAnnotation.type='TSStringKeyword'][typeParameters.params.1.typeAnnotation.type='TSUnknownKeyword']",
          message:
            'Record запрещён в domain LoginRiskAssessment. Используйте строго типизированные union types.',
        },
      ],
    },
  },
  // Tsup конфиги — линтим, но мягче (как инфраструктурный код)
  {
    files: ['**/tsup.config.{ts,js,mjs,cjs}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        // ВАЖНО: без type-aware (tsup.config.* часто исключены из tsconfig)
        projectService: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...CONFIG_FILES_RULES,
      // Отключаем type-aware правила для tsup.config.* (иначе они падают без parserServices)
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unnecessary-qualifier': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/prefer-enum-initializers': 'off',
      '@typescript-eslint/prefer-literal-enum-member': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/prefer-return-this-type': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
      '@typescript-eslint/require-array-sort-compare': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/return-await': 'off',
    },
  },
  // Vitest конфиги — требуют default export для работы
  {
    files: ['**/vitest.config.{ts,js,mjs,cjs}'],
    rules: {
      // 'import/no-default-export': 'off', // ❌ Отключено: eslint-plugin-import несовместим с ESLint 10.0.0
    },
  },
];

// Экспорты прямых режимов убраны: конфиг лениво грузит только выбранный режим,
// что исключает падение на отсутствующих файлах режима в CI.
