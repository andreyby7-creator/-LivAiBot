/**
 * @file Конфигурация ESLint режима DEV для LivAi
 *
 * Режим разработки с повышенной строгостью для комфортной работы.
 * Критичные правила применяются как ошибки, остальные как предупреждения.
 */

import typescriptParser from '@typescript-eslint/parser';
import { CRITICAL_RULES, PLUGINS } from '../constants.mjs';
import masterConfig, { resolveMonorepoRoot } from '../master.config.mjs';
import { applySeverity, applySeverityAwareRules, QUALITY_WITH_SEVERITY, DEV_EXTRA_RULES } from '../shared/rules.mjs';
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
    f => f.includes('*.test.') || f.includes('*.spec.') || f.includes('__tests__')
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
    ...applySeverityAwareRules(QUALITY_WITH_SEVERITY, 'test'), // explicit-function-return-type: off
  },
});


// Исключение для всех пакетов @livai/*: могут использовать barrel file для внутренних импортов
devConfigWithRules.push({
  files: ['packages/*/src/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': 'off', // Пакеты @livai/* могут использовать свой barrel file для внутренних импортов
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

// ==================== ZONE-SPECIFIC: READONLY PARAMETERS ====================
// Отключаем prefer-readonly-parameter-types для Effect-first зон (конфликтует с Effect API)
// Но оставляем активным для контрактов и UI primitives где readonly параметры важны

// Отключаем для всех Effect-first пакетов
devConfigWithRules.push({
  files: ['packages/**/src/**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
  },
});

// Включаем обратно для зон где readonly параметры критичны
devConfigWithRules.push({
  files: [
    'packages/core-contracts/src/**/*.{ts,tsx}',  // Контракты - strict readonly для type safety
    'packages/ui-core/src/**/*.{ts,tsx}',         // UI primitives - strict readonly для immutability
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
