/**
 * @file Конфигурация ESLint режима DEV для LivAi
 * Режим разработки с повышенной строгостью для комфортной работы.
 * Критичные правила применяются как ошибки, остальные как предупреждения.
 */

import typescriptParser from '@typescript-eslint/parser';
import { CRITICAL_RULES, PLUGINS } from '../constants.mjs';
import masterConfig, { resolveMonorepoRoot } from '../master.config.mjs';
import { applySeverity, applySeverityAwareRules, QUALITY_WITH_SEVERITY, DEV_EXTRA_RULES, COMMON_IGNORES } from '../shared/rules.mjs';
// TEZ: Type Exemption Zone определена в shared/tez.config.mjs (применяется через master.config.mjs)

/**
 * Получает корневую директорию проекта (монорепо)
 * Используется для правильной настройки tsconfigRootDir независимо от того,
 * откуда запускается ESLint (корень или подпапка)
 */
const PROJECT_ROOT = resolveMonorepoRoot(import.meta.url);

/**
 * Преобразование конфигурации для режима разработки
 * Новая архитектура: BASE_QUALITY_RULES + severity-aware + DEV_EXTRA_RULES + severity трансформация
 */
function convertToDevMode(config) {
  if (Array.isArray(config)) {
    return config.map(convertToDevMode);
  }

  // Severity map для DEV: критичные правила → error, остальные → warn
  const devSeverityMap = { ...CRITICAL_RULES };

  // Композиция слоёв: severity-aware правила + трансформация + dev-specific правила
  const severityAwareRules = applySeverityAwareRules(QUALITY_WITH_SEVERITY, 'dev');
  const transformedRules = config.rules ? applySeverity(config.rules, devSeverityMap, 'warn') : {};

  return {
    ...config,
    rules: {
      ...severityAwareRules,  // Severity-aware правила (dev: warn)
      ...transformedRules,    // Трансформированные правила из master config
      ...DEV_EXTRA_RULES,     // Дополнительные dev-specific правила
    },
  };
}

/**
 * Конфигурация режима разработки
 */
const devConfig = masterConfig.map(config => {
  // Последний элемент = testFilesOverrides, не конвертируем его
  // Тесты должны оставаться с warn/off как задумано
  const isTestOverride = config.files?.some?.(
    f => f.includes('*.test.') || f.includes('*.spec.') || f.includes('__tests__') || f.includes('/test/') || f.includes('/tests/')
  );

  if (isTestOverride) {
    // Тестовые файлы оставляем без изменений - их правила будут переопределены в testFilesOverrides ниже
    return config;
  }

  return convertToDevMode(config);
});

// DEV режим: базируется на master.config.mjs, затем добавляет dev-only overrides ниже
const devConfigWithRules = [...devConfig];

// Игнорирование дополнительных файлов (dist, build, cache уже игнорируются глобально)
devConfigWithRules.unshift({
  ignores: [
    'seed/**/*.d.ts', // Автогенерированные .d.ts файлы в seed (специфично для dev режима)
  ],
});

// ==================== GLOBAL TS/TSX CONFIGURATION ====================
// Глобальная конфигурация для всех TS/TSX файлов с игнорами конфигурационных файлов
// Унифицировано с canary режимом для консистентности
devConfigWithRules.push({
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
    // ==================== ZONE-SPECIFIC: READONLY PARAMETERS ====================
    // Отключаем prefer-readonly-parameter-types глобально для всех файлов
    // UI primitives и apps отключены - React/Next.js типы не поддерживают readonly параметры
    // Effect-first зоны также отключены - конфликтует с Effect API
    // Оставляем активным только для core-contracts, где это критично для type safety
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
  },
});

// Отключение строгих правил для тестовых файлов
// Тесты часто используют анонимные функции, типы которых выводятся автоматически
devConfigWithRules.push({
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
devConfigWithRules.push({
  files: ['**/errors/**/*.ts'],
  rules: {
    'fp/no-throw': 'off', // Валидационные функции могут бросать ошибки
  },
});

// Setup файлы могут использовать throw для обработки ошибок
devConfigWithRules.push({
  files: ['**/vitest.setup.ts', '**/test.setup.ts'],
  rules: {
    'fp/no-throw': 'off', // Setup файлы могут использовать throw
  },
});

// ==================== EFFECTS / STORES EXCEPTIONS ====================
// Effects, stores и setup файлы используют императивные паттерны (if, let, мутации)
// Domain/DTO остаются строгими - это ядро системы
devConfigWithRules.push({
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

// Включаем обратно только для core-contracts, где readonly параметры критичны
devConfigWithRules.push({
  files: [
    'packages/core-contracts/src/**/*.{ts,tsx}',  // Контракты - strict readonly для type safety
  ],
  rules: {
    '@typescript-eslint/prefer-readonly-parameter-types': 'warn',
  },
});

// ==================== CORE-CONTRACTS: NO ANY В КОНТРАКТАХ ====================
// Фиксируем принцип: any только на границе/в инфре, в домене/DTO запрещён.
devConfigWithRules.push({
  files: ['packages/core-contracts/src/**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
});
devConfigWithRules.push({
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
devConfigWithRules.push({
  files: ['packages/domains/**/*.{ts,tsx}'],
  rules: {
    'ai-security/data-leakage': 'off',
    'ai-security/model-poisoning': 'off', // Domain layer работает только с validated data
  },
});

// ==================== NEXT.JS APP ROUTER ====================
// Next.js App Router: pages/ директории нет по дизайну, поэтому правило создаёт шум
// Отключаем глобально, чтобы не получать предупреждение на старте линта
devConfigWithRules.push({
  plugins: PLUGINS,
  rules: {
    '@next/next/no-html-link-for-pages': 'off', // App Router (Next 13+) не использует pages/
  },
});

export default devConfigWithRules;
