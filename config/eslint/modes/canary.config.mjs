/**
 * @file Конфигурация ESLint режима CANARY для LivAi
 * Режим максимальной строгости с полным type-aware анализом и экспериментальными правилами.
 * Применяет самые строгие проверки качества ко всем зонам архитектуры LivAi.
 * Используется для nightly сборок, feature веток и глубокого анализа перед релизом.
 */

import typescriptParser from '@typescript-eslint/parser';
import masterConfig, { resolveMonorepoRoot } from '../master.config.mjs';
// TEZ: Type Exemption Zone определена в shared/tez.config.mjs и применяется через master.config.mjs
import { PLUGINS } from '../constants.mjs';
import { applySeverity, applySeverityAwareRules, QUALITY_WITH_SEVERITY, CANARY_EXTRA_RULES, COMMON_IGNORES } from '../shared/rules.mjs';

/**
 * Корневая директория проекта для использования в tsconfigRootDir
 * Гарантирует одинаковую проверку независимо от того, откуда запускается ESLint
 */
const PROJECT_ROOT = resolveMonorepoRoot(import.meta.url);

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
  '@typescript-eslint/consistent-type-imports': 'error', // Строгие type imports (из CRITICAL_RULES)
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
  // ⚠️ ВАЖНО: functional/immutable-data убран из глобальных правил
  // Применяется только в foundation зоне (см. constants.mjs -> FOUNDATION_RULES)
  // UI/Apps/тесты имеют явные overrides для отключения
  'no-param-reassign': 'error', // Запрет переприсваивания параметров

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
      // ВАЖНО: config/**/*.{ts,js} игнорируется в eslint.config.mjs с точечными исключениями.
      // Здесь не дублируем, чтобы не сломать '!config/testing/shared-config.ts'.
    ],
  },
  ...masterConfig.map(config => {
    // Последний элемент = testFilesOverrides, не конвертируем его
    // Тесты должны оставаться с warn/off как задумано
    const isTestOverride = config.files?.some?.(
      f => f.includes('*.test.') || f.includes('*.spec.') || f.includes('__tests__') || f.includes('/test/') || f.includes('/tests/')
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
    // Исключаем dev-only файлы - они проверяются отдельно через overrides
    '**/*.dev.ts',
    // TSUP конфиги линтим отдельным (non-type-aware) override, чтобы не падать на projectService
    '**/tsup.config.{ts,js,mjs,cjs}',
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
      rootDir: ['apps/admin', 'apps/web', 'apps/mobile'],
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

      },
});

// ==================== DEV-ONLY ФАЙЛЫ: ТАКЖЕ СТРОГИЕ ПРАВИЛА ====================
// Dev-only файлы проверяются с теми же строгими правилами, что и production
// Все условные ветки заменяются на Effect.flatMap / match / pattern matching
// Все side effects (включая console.log/debug) оборачиваются в Effect
canaryConfig.push({
  files: ['**/*.dev.ts'],
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

// Игнорирование дополнительных файлов (dist, build, cache уже игнорируются глобально)
canaryConfig.unshift({
  ignores: [
    'seed/**/*.d.ts', // Автогенерированные .d.ts файлы в seed (специфично для canary режима)
  ],
});

// Отключение строгих правил для тестовых файлов
// Тесты часто используют анонимные функции, типы которых выводятся автоматически
canaryConfig.push({
  files: ['**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}'],
  rules: {
    'import/order': 'off', // Тестовые файлы могут иметь свободный порядок импортов
    'fp/no-unused-expression': 'off', // expect() выражения в тестах - нормальная практика
    'functional/prefer-immutable-types': 'off', // Тесты часто нуждаются в мутабельных данных
    'functional/immutable-data': 'off', // Тесты используют моки, мутации объектов - нормальная практика
    'ai-security/pii-detection': 'off', // Тестовые данные не являются реальными PII
    '@typescript-eslint/consistent-type-imports': 'off', // Тесты часто используют import() type annotations для моков и типов
    ...applySeverityAwareRules(QUALITY_WITH_SEVERITY, 'test'), // explicit-function-return-type: off
  },
});

// Файлы с валидацией могут использовать throw для error handling
canaryConfig.push({
  files: ['**/errors/**/*.ts'],
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

// ==================== EFFECTS / STORES EXCEPTIONS ====================
// Effects, stores и setup файлы используют императивные паттерны (if, let, мутации)
// Domain/DTO остаются строгими - это ядро системы
canaryConfig.push({
  files: [
    'packages/feature-*/src/effects/**/*.{ts,tsx}',
    'packages/feature-*/src/lib/**/*.{ts,tsx}',
    'packages/feature-*/src/stores/**/*.{ts,tsx}',
    'packages/app/src/state/**/*.{ts,tsx}',
    'config/playwright/global-setup.ts',
    'config/playwright/global-teardown.ts',
  ],
  rules: {
    'functional/immutable-data': 'off',
    'fp/no-mutation': 'off',
    'functional/no-let': 'off',
    'functional/no-conditional-statements': 'off',
    'functional/no-loop-statements': 'off',
    'fp/no-throw': 'off',
    'fp/no-unused-expression': 'off',
    'functional/prefer-immutable-types': 'off',
  },
});

// ==================== CORE-CONTRACTS: NO ANY + READONLY PARAMETERS ====================
// Фиксируем принцип: any только на границе/в инфре, в домене/DTO запрещён.
// Readonly параметры критичны для type safety в контрактах
canaryConfig.push({
  files: ['packages/core-contracts/src/**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/prefer-readonly-parameter-types': 'error', // Строго для контрактов
  },
});
canaryConfig.push({
  files: [
    'packages/core-contracts/src/**/entrypoints/**/*.{ts,tsx}',
    'packages/core-contracts/src/**/infra/**/*.{ts,tsx}',
    'packages/core-contracts/src/**/adapters/**/*.{ts,tsx}',
    'packages/core-contracts/src/**/serialization/**/*.{ts,tsx}',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
});

// ==================== DOMAINS: AI-SECURITY RULES ====================
// Domain layer работает только с trusted данными (валидированными в adapter/application layer)
// Валидация выполняется на границе между внешним миром и domain (HTTP/DB/Queue → Schema validation → Domain)
// Domain layer содержит только pure functions без side-effects
// Любые новые файлы должны соблюдать архитектурный контракт (см. packages/domains/ADR-001-domain-layer-trust-policy.md)
// ai-security/model-poisoning и data-leakage выключены намеренно для trusted zone
canaryConfig.push({
  files: ['packages/domains/**/*.{ts,tsx}'],
  rules: {
    'ai-security/data-leakage': 'off',
    'ai-security/model-poisoning': 'off', // Domain layer работает только с validated data
  },
});

// ==================== NEXT.JS APP ROUTER ====================
// Next.js App Router: pages/ директории нет по дизайну, поэтому правило создаёт шум
// Отключаем глобально, чтобы не получать предупреждение на старте линта
canaryConfig.push({
  plugins: PLUGINS,
  rules: {
    '@next/next/no-html-link-for-pages': 'off', // App Router (Next 13+) не использует pages/
  },
});

export default canaryConfig;
