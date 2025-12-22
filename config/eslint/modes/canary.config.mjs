/**
 * @file Конфигурация ESLint режима CANARY для LivAiBot
 *
 * Режим максимальной строгости с полным type-aware анализом и экспериментальными правилами.
 * Применяет самые строгие проверки качества ко всем зонам архитектуры LivAiBot.
 *
 * Используется для nightly сборок, feature веток и глубокого анализа перед релизом.
 */

import typescriptParser from '@typescript-eslint/parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import masterConfig from '../master.config.mjs';
// TEZ: Type Exemption Zone - импортируем из shared для single source of truth
import { PLUGINS } from '../constants.mjs';
import { applySeverity, applySeverityAwareRules, QUALITY_WITH_SEVERITY, CANARY_EXTRA_RULES, COMMON_IGNORES } from '../shared/rules.mjs';
import { effectFpNamingRules } from '../rules/naming-conventions.mjs';
import architecturalBoundariesConfig from '../rules/architectural-boundaries.mjs';
import { integrationTestRules } from '../rules/integration-tests.rules.mjs';

// ==================== УТИЛИТЫ ДЛЯ МОНОРЕПО ====================

/**
 * Получает корневую директорию проекта (монорепо)
 * Используется для правильной настройки tsconfigRootDir независимо от того,
 * откуда запускается ESLint (корень или подпапка)
 * 
 * Ищет корень проекта по наличию package.json или tsconfig.json вверх по дереву
 * Это более надежно, чем просто считать уровни вложенности
 * 
 * @returns {string} абсолютный путь к корню проекта
 */
function getProjectRoot() {
  // Получаем директорию текущего файла через import.meta.url (ESM)
  const __filename = fileURLToPath(import.meta.url);
  let currentDir = path.dirname(__filename);
  
  // Ищем корень проекта по наличию package.json или tsconfig.json
  // Поднимаемся вверх по дереву до тех пор, пока не найдем корень
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');
    
    // Если нашли package.json или tsconfig.json - это корень проекта
    if (fs.existsSync(packageJsonPath) || fs.existsSync(tsconfigPath)) {
      return currentDir;
    }
    
    // Поднимаемся на уровень выше
    currentDir = path.dirname(currentDir);
  }
  
  // Fallback: если не нашли, используем расчет по уровням
  // (config/eslint/modes/ -> корень = 3 уровня вверх)
  return path.resolve(path.dirname(__filename), '../../..');
}

/**
 * Корневая директория проекта для использования в tsconfigRootDir
 * Гарантирует одинаковую проверку независимо от того, откуда запускается ESLint
 */
const PROJECT_ROOT = getProjectRoot();

/**
 * Type Exemption Zone (TEZ) - типы, исключённые из проверки prefer-readonly-parameter-types
 * Source: shared/tez.config.mjs | ⚠️ TEZ должна быть идентична во всех режимах (dev, canary)
 */

/**
 * CANARY режим: максимальная строгость с полным type-aware анализом для всех зон
 * Используется для nightly jobs, feature branches и глубокого анализа качества
 */
const FULL_TYPE_AWARE_RULES = {
  '@typescript-eslint/no-floating-promises': 'error', // 🟢
  '@typescript-eslint/no-misused-promises': 'error', // 🟢
  '@typescript-eslint/await-thenable': 'error', // 🟢
  '@typescript-eslint/require-await': 'error', // 🟢
  '@typescript-eslint/no-unnecessary-type-assertion': 'error', // 🟢
  '@typescript-eslint/strict-boolean-expressions': 'error', // 🟢
  '@typescript-eslint/prefer-nullish-coalescing': 'error', // 🟢
  '@typescript-eslint/prefer-optional-chain': 'error', // 🟢
  '@typescript-eslint/no-unnecessary-condition': 'error', // 🟢
  '@typescript-eslint/no-confusing-void-expression': 'error', // 🟢 CANARY = all errors!
  '@typescript-eslint/no-unsafe-return': 'error', // 🟢
  '@typescript-eslint/no-unsafe-assignment': 'error', // 🟢
  '@typescript-eslint/no-unsafe-call': 'error', // 🟢
  '@typescript-eslint/prefer-readonly-parameter-types': 'off', // 🔇 УБРАН ШУМ - конфликтует с Effect-first архитектурой

  // 🔴 ДОПОЛНИТЕЛЬНЫЕ МАКСИМАЛЬНО СТРОГИЕ ПРАВИЛА ДЛЯ CANARY
  '@typescript-eslint/no-meaningless-void-operator': 'error', // Бессмысленный void
  '@typescript-eslint/no-redundant-type-constituents': 'error', // Избыточные типы
  '@typescript-eslint/no-type-alias': 'off', // Разрешить type aliases
  '@typescript-eslint/no-unnecessary-qualifier': 'error', // Ненужные квалификаторы
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error', // Избыточные сравнения
  '@typescript-eslint/prefer-enum-initializers': 'error', // Инициализаторы enum
  '@typescript-eslint/prefer-literal-enum-member': 'error', // Литеральные enum
  '@typescript-eslint/prefer-readonly': 'error', // Предпочитать readonly
  '@typescript-eslint/prefer-return-this-type': 'error', // Тип this в возврате
  '@typescript-eslint/prefer-string-starts-ends-with': 'error', // startsWith/endsWith
  '@typescript-eslint/require-array-sort-compare': 'error', // Сравнение в sort
  '@typescript-eslint/restrict-plus-operands': 'error', // Ограничение + операндов
  '@typescript-eslint/restrict-template-expressions': 'error', // Шаблонные выражения
  '@typescript-eslint/return-await': 'error', // Возврат await
  '@typescript-eslint/triple-slash-reference': 'error', // Triple slash reference

  // 🔴 ЗАЩИТА ОТ МУТАЦИЙ (реальная, не типовая)
  'no-param-reassign': 'error', // Запрет переприсваивания параметров
  'functional/immutable-data': 'error', // Запрет мутаций данных

  // 🔴 REACT СТРОГИЕ ПРАВИЛА
  'react/jsx-no-useless-fragment': 'error', // Бессмысленные фрагменты
  'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }], // Скобки в JSX
  'react/self-closing-comp': 'error', // Самозакрывающиеся компоненты

  // 🔴 ДОПОЛНИТЕЛЬНАЯ СТРОГОСТЬ
  'no-lonely-if': 'error', // Одиночные if
  'no-unneeded-ternary': 'error', // Ненужные тернарные операторы
  'no-useless-computed-key': 'error', // Бессмысленные computed keys
  'no-useless-concat': 'error', // Бессмысленная конкатенация
  'no-useless-return': 'error', // Бессмысленный return
  'prefer-object-spread': 'error', // Предпочитать object spread

  'react/destructuring-assignment': 'off', // ⚠️ Отключаем для совместимости с readonly
};

/**
 * Преобразование правил для canary режима
 * Новая архитектура: BASE_QUALITY_RULES + severity-aware + CANARY_EXTRA_RULES + severity трансформация
 */
function transformRulesForCanary(rules) {
  // Для CANARY: пустой severityMap (все правила по умолчанию 'error')
  const transformedRules = applySeverity(rules, {}, 'error');

  // Композиция слоёв: severity-aware правила + трансформация + canary-specific правила
  return {
    ...applySeverityAwareRules(QUALITY_WITH_SEVERITY, 'canary'), // Severity-aware правила (canary: error)
    ...transformedRules,                            // Трансформированные правила из master config
    ...CANARY_EXTRA_RULES,                          // Дополнительные canary-specific правила
  };
}

// ==================== КОНСТАНТЫ ДЛЯ ФИЛЬТРАЦИИ ПРАВИЛ ====================
// ❌ Удалено: FUNCTIONAL_RULES и FP_RULES отключены для Effect-TS проекта
// Effect-TS уже обеспечивает функциональные паттерны через API
// TypeScript + Effect API обеспечивают type safety и immutability

// ==================== CANARY КОНФИГУРАЦИЯ ====================

const canaryConfig = [
  // Глобальные ignores - применяются первыми ко ВСЕМ файлам
  {
    ignores: [
      '**/*.d.ts', // Игнорируем ВСЕ .d.ts файлы в проекте
      'config/**/*.ts', // Конфигурационные файлы могут использовать dynamic imports
      'config/**/*.js', // Тестовые скрипты могут использовать fs, child_process
    ],
  },
  ...masterConfig.map(config => {
    // Последний элемент = testFilesOverrides, не конвертируем его
    // Тесты должны оставаться с warn/off как задумано
    const isTestOverride = config.files?.some?.(
      f => f.includes('*.test.') || f.includes('*.spec.') || f.includes('__tests__')
    );

    if (isTestOverride) {
      // Тестовые файлы оставляем без изменений - их правила будут переопределены в testFilesOverrides ниже
      return config;
    }

    // Преобразуем правила в error режим
    return {
      ...config,
      rules: config.rules ? transformRulesForCanary(config.rules) : {},
    };
  }),
  // Добавляем naming convention правила
  ...effectFpNamingRules,
  // Добавляем architectural boundaries
  ...architecturalBoundariesConfig,
];

// ==================== PRODUCTION ФАЙЛЫ: МАКСИМАЛЬНАЯ СТРОГОСТЬ ====================
// Type-aware + строгий: все @typescript-eslint правила error
// Functional / FP правила: включены, кроме тех, что конфликтуют с Effect-TS
// Side effects: проверяются через Effect
// Readonly: readonly TS + ESLint enforcement
//
// ⚠️ ВАЖНО: Glob-шаблоны '**/*.ts' и '**/*.tsx' проверяют все файлы в монорепо
// Это гарантирует одинаковую проверку независимо от того, откуда запускается ESLint
// (корень или подпапка пакета). Для monorepo лучше запускать ESLint через корневой конфиг
canaryConfig.push({
  files: ['**/*.ts', '**/*.tsx'], // Проверяем все TS/TSX файлы в монорепо
  ignores: [
    ...COMMON_IGNORES, // Используем централизованные ignores для единообразия
    // Исключаем тестовые и dev-only файлы - они проверяются отдельно через overrides
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/*.dev.ts',
    '**/__tests__/**',
    '**/test/**',
    '**/tests/**',
    // Исключаем конфигурационные файлы - они имеют свою специфику
    '**/*.config.ts',
    '**/*.config.tsx',
    '**/vitest.setup.ts',
    '**/test.setup.ts',
  ],
  plugins: PLUGINS,
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      projectService: true,
      // ⚠️ ВАЖНО: Используем PROJECT_ROOT вместо process.cwd() для единообразия
      // Это гарантирует одинаковую проверку независимо от того, откуда запускается ESLint
      // (корень монорепо или подпапка пакета)
      // Для monorepo лучше запускать ESLint через корневой конфиг, а не локально в пакете
      tsconfigRootDir: PROJECT_ROOT,
      noWarnOnMultipleProjects: true, // Оптимизация для монорепо: подавление косметического предупреждения
    },
  },
  settings: {
    next: {
      rootDir: ['apps/admin-panel', 'apps/web', 'apps/mobile'],
    },
  },
  rules: {
    // ==================== TYPE-AWARE ПРАВИЛА (ВСЕ ERROR) ====================
    // Все @typescript-eslint правила установлены в 'error' для максимальной строгости
    ...FULL_TYPE_AWARE_RULES,

    // ==================== FUNCTIONAL/FP ПРАВИЛА ====================
    // ❌ Отключены для Effect-TS проекта
    // Effect-TS уже обеспечивает функциональные паттерны через API
    // TypeScript + Effect API обеспечивают type safety и immutability
    // Правила создавали конфликты с Effect-TS паттернами (Effect.if, Effect.catch и т.д.)
    // ...FUNCTIONAL_RULES, // Отключено - пустой объект
    // ...FP_RULES, // Отключено - пустой объект

    // ==================== NEXT.JS ПРАВИЛА ====================
    '@next/next/no-html-link-for-pages': 'off', // App Router (Next 13+) doesn't use pages/
  },
});

// ==================== DEV-ONLY ФАЙЛЫ: ТАКЖЕ СТРОГИЕ ПРАВИЛА ====================
// Dev-only файлы проверяются с теми же строгими правилами, что и production
// Все условные ветки заменяются на Effect.flatMap / match / pattern matching
// Все side effects (включая console.log/debug) оборачиваются в Effect
canaryConfig.push({
  files: ['**/*.dev.ts', '**/*.spec.ts'],
  plugins: PLUGINS,
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: PROJECT_ROOT,
      noWarnOnMultipleProjects: true,
    },
  },
  rules: {
    // ==================== FUNCTIONAL/FP ПРАВИЛА ====================
    // ❌ Отключены для Effect-TS проекта
    // Effect-TS уже обеспечивает функциональные паттерны через API
    // TypeScript + Effect API обеспечивают type safety и immutability
    // Правила создавали конфликты с Effect-TS паттернами (Effect.if, Effect.catch и т.д.)

    // ==================== TYPE-AWARE ПРАВИЛА ====================
    // Type-aware правила остаются активными даже в dev-only файлах
    // Это гарантирует type safety даже в runtime checks
    ...FULL_TYPE_AWARE_RULES,

    // ==================== FUNCTIONAL/FP ПРАВИЛА ====================
    // ❌ Отключены для Effect-TS проекта
    // Effect-TS уже обеспечивает функциональные паттерны через API
    // TypeScript + Effect API обеспечивают type safety и immutability
  },
});

// Переопределение правил для Effect-системы
// ❌ FUNCTIONAL_RULES отключены для Effect-TS проекта
// Effect-TS уже обеспечивает функциональные паттерны через API
canaryConfig.push({
  files: ['core-contracts/src/io/Effect/**/*.ts'],
  plugins: PLUGINS,
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      projectService: true,
      // Используем PROJECT_ROOT для единообразия с другими конфигурациями
      tsconfigRootDir: PROJECT_ROOT,
      noWarnOnMultipleProjects: true,
    },
  },
  rules: {
    ...FULL_TYPE_AWARE_RULES,
    '@next/next/no-html-link-for-pages': 'off',
  },
});

// ==================== ДЕКЛАРАТИВНЫЕ DOMAIN MAPS ====================
// Отключаем no-magic-numbers для декларативных файлов с HTTP статус-кодами
// HTTP-коды — часть протокола, а не «магия»
// Эти файлы декларативные и не содержат бизнес-логики
canaryConfig.push({
  files: [
    '**/ErrorCodeMeta.ts',
    '**/ErrorCodeMetaData.ts',
  ],
  plugins: PLUGINS,
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: PROJECT_ROOT,
      noWarnOnMultipleProjects: true,
    },
  },
  rules: {
    ...FULL_TYPE_AWARE_RULES,
    'no-magic-numbers': 'off', // HTTP статус-коды — данные, не алгоритмы
  },
});

// ==================== ASSERT NEVER И ВАЛИДАЦИЯ ====================
// assertNever и валидация — compile-time safety guards, throw допустим ТОЛЬКО здесь
canaryConfig.push({
  files: ['**/*ErrorCode.ts', '**/ErrorCodeMeta.ts', '**/ErrorCodeMetaData.ts', '**/BaseErrorTypes.ts', '**/ErrorCode.ts'],
  plugins: PLUGINS,
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: PROJECT_ROOT,
      noWarnOnMultipleProjects: true,
    },
  },
  rules: {
    ...FULL_TYPE_AWARE_RULES,
    'fp/no-throw': 'off', // assertNever, валидация и pattern matching используют throw для compile-time safety
  },
});

// ==================== INPUT BOUNDARY TYPES ====================
// Разрешаем interface для input boundary types (каноничный паттерн Effect-TS: Model ≠ Input)
// interface используется для input/output/contracts, type для unions/ADT/composition
// ErrorMetadataInput — доменный input boundary type с readonly полями, но линтер не распознает interface с readonly полями
// Унифицировано с dev.config.mjs для консистентности между режимами
canaryConfig.push({
  files: ['**/ErrorMetadata.ts'],
  plugins: PLUGINS,
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: PROJECT_ROOT,
      noWarnOnMultipleProjects: true,
    },
  },
  rules: {
    ...FULL_TYPE_AWARE_RULES,
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // Разрешаем interface для input boundary types
    '@typescript-eslint/prefer-readonly-parameter-types': [
      'error',
      {
        allow: ['ErrorMetadataInput'], // Input boundary type с readonly полями (tooling-aware компромисс)
      },
    ],
  },
});

// ==================== UNIFIED ERROR REGISTRY ====================
// Отключаем security/detect-object-injection для UnifiedErrorRegistry.ts
// Все доступы к объектам через динамические ключи контролируемы и безопасны:
// - namespaceKey из Object.keys(namespaceMap) с фиксированной структурой
// - code типизирован как ErrorCode
// - namespace.toLowerCase() с type assertion
canaryConfig.push({
  files: ['**/UnifiedErrorRegistry.ts'],
  rules: {
    'security/detect-object-injection': 'off', // Безопасные контролируемые доступы к объектам
  },
});

// ==================== ERROR METADATA ====================
// Отключаем prefer-readonly-parameter-types для ErrorMetadata.ts
// АРХИТЕКТУРНОЕ РЕШЕНИЕ: functional-first подход с immutable паттернами
// - Входные параметры: обычные (безопасно, exactOptionalPropertyTypes не ломается)
// - Выходные данные: readonly/as const (повышает safety и immutability)
// - Функциональная иммутабельность: immutable паттерны Effect + spread операторы
// - Type safety: Readonly<T> на уровне экспортов для линтера
canaryConfig.push({
  files: ['**/ErrorMetadata.ts'],
  rules: {
    '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Functional-first архитектура
  },
});

// Игнорирование автогенерированных файлов и папок
canaryConfig.unshift({
  ignores: [
    'dist/**',        // Вся папка dist (скомпилированные файлы)
    'seed/**/*.d.ts', // Автогенерированные .d.ts файлы в seed
  ],
});

// Отключение строгих правил для тестовых файлов
// Тесты часто используют анонимные функции, типы которых выводятся автоматически
canaryConfig.push({
  files: ['**/*.test.ts', '**/*.spec.ts'],
  rules: {
    'import/order': 'off', // Тестовые файлы могут иметь свободный порядок импортов
    'fp/no-throw': 'off', // Тесты могут использовать throw в описаниях и коде
    ...applySeverityAwareRules(QUALITY_WITH_SEVERITY, 'test'), // explicit-function-return-type: off
  },
});

// Файлы с валидацией могут использовать throw для error handling
canaryConfig.push({
  files: ['**/ErrorCode.ts', '**/ErrorCodeMeta.ts'],
  rules: {
    'fp/no-throw': 'off', // Валидационные функции могут бросать ошибки
  },
});

// Setup файлы могут использовать throw для обработки ошибок
canaryConfig.push({
  files: ['**/vitest.setup.ts', '**/test.setup.ts'],
  rules: {
    'fp/no-throw': 'off', // Setup файлы могут использовать throw
  },
});

// Правила для integration тестов (runtime testing, console output, error validation)
canaryConfig.push({
  files: ['**/tests/integration/**/*.{ts,tsx,js,jsx}'],
  rules: integrationTestRules,
});

export default canaryConfig;
