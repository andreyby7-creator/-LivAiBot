/**
 * @file Общие правила и утилиты ESLint для всех режимов LivAi
 * Содержит унифицированные функции преобразования уровней строгости
 * и общие правила для DEV/CANARY режимов.
 * 🏗️ СТРАТЕГИЯ МАСШТАБИРОВАНИЯ:
 * - Domain-specific паттерны определяются в соответствующих domain конфигурациях
 * - Infrastructure: полностью исключена (нет кода приложения)
 * 📝 Масштабирование:
 * - Новые пакеты: добавлять паттерны в соответствующие domain файлы
 * - Feature пакеты: используют паттерн feature-* для автоматического захвата
 * ⚠️ ВАЖНО: COMMON_IGNORES содержит ТОЛЬКО "мертвый код" (build artifacts, generated, external)!
 * Весь бизнес-код ДОЛЖЕН линтиться максимально строго!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

/**
 * Находит все пакеты @livai/* в packages/ и apps/
 * Автоматически генерирует список для правила no-restricted-imports
 */
function findLivaiPackages() {
  const packages = [];
  const packagesDir = path.join(PROJECT_ROOT, 'packages');
  const appsDir = path.join(PROJECT_ROOT, 'apps');

  // Сканируем packages/
  if (fs.existsSync(packagesDir)) {
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(packagesDir, entry.name, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.name?.startsWith('@livai/')) {
              packages.push(packageJson.name);
            }
          } catch (error) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    }
  }

  // Сканируем apps/ (если там есть пакеты @livai/*)
  if (fs.existsSync(appsDir)) {
    const entries = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(appsDir, entry.name, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.name?.startsWith('@livai/')) {
              packages.push(packageJson.name);
            }
          } catch (error) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    }
  }

  return packages.sort();
}

/**
 * Генерирует paths для правила no-restricted-imports
 */
function generateRestrictedImportsPaths() {
  const packages = findLivaiPackages();
  return packages.map((pkg) => {
    const isApp = pkg === '@livai/app';
    return {
      name: pkg,
      message:
        `Барель-Импорты в @livai/* запрещены. Используйте subpath exports${isApp ? ', например: "@livai/app/lib/error-mapping.js".' : '.'}`,
    };
  });
}

// ==================== КОНФИГУРАЦИЯ ОТЛАДКИ ====================
// Включить логирование изменений уровня строгости через переменную окружения DEBUG_ESLINT_SEVERITY=1
const DEBUG_ESLINT_SEVERITY = process.env.DEBUG_ESLINT_SEVERITY === '1';
// Проверка, что мы не в production (логирование только в dev/test окружениях)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ==================== КОНСТАНТЫ ДЛЯ МАСШТАБИРОВАНИЯ ====================
// Паттерны для domain-specific конфигураций теперь определяются в соответствующих domain файлах
// Эти константы были убраны, так как COMMON_IGNORES содержит только технические исключения

// ==================== SEVERITY-AWARE RULES ====================
// Правила, которые требуют разных уровней строгости в зависимости от режима

/**
 * Severity-aware правила - правила, которые требуют разных уровней строгости
 * в зависимости от режима и контекста (dev/test/production)
 * 📌 СТРУКТУРА:
 *   ruleName: {
 *     dev: 'warn' | 'error',    // Для комфортной разработки
 *     canary: 'error',          // Максимальная строгость
 *     test: 'off'               // Отключено для тестов (анонимные функции)
 *   }
 */
export const QUALITY_WITH_SEVERITY = {
  // TypeScript strictness
  '@typescript-eslint/explicit-function-return-type': {
    dev: 'warn',    // Рекомендация для читаемости (TS может вывести тип)
    canary: 'error', // Enforce в production API
    test: 'off',    // Анонимные функции в тестах - OK
  },
  '@typescript-eslint/no-explicit-any': {
    dev: 'warn',    // Предупреждение для type safety
    canary: 'error', // Максимальная type safety в production
    test: 'off',    // В тестах any часто необходим для mocks и edge cases
  },

  // Console usage (important for AI systems)
  'no-console': {
    dev: 'warn',    // Разрешено в dev для debugging
    canary: 'error', // Запрещено в production (AI logs через structured logging)
    test: 'off',    // Тесты используют console для debugging
  },

  // AI-specific: Async operations (critical for AI pipelines)
  '@typescript-eslint/no-floating-promises': {
    dev: 'warn',    // Предупреждать о необработанных промисах
    canary: 'error', // Критично для AI пайплайнов (не терять результаты)
    test: 'off',    // В тестах можно для простоты
  },

  // AI-specific: Import cycles (can break AI orchestration)
  'import/no-cycle': {
    dev: 'warn',    // Предупреждать о циклических зависимостях
    canary: 'error', // Запретить в продакшене (ломает AI workflows)
    test: 'off',    // В тестах циклы менее критичны
  },

  // Barrel file prevention: запрет импортов из @livai/app (barrel file)
  // Требует использования subpath exports для избежания загрузки всех зависимостей
  'no-restricted-imports': {
    dev: 'warn',    // Предупреждение в dev режиме
    canary: 'error', // Ошибка в canary режиме
    test: 'warn',   // Предупреждение в тестах (можно использовать для моков)
  },

  // sonarjs/cognitive-complexity убрано - используется статично в domain rules
  // с разными порогами для разных зон (core: 10, pipeline: 15, etc.)
};

/**
 * Специальные правила для конфигурационных файлов
 * Ослабленные требования для инфраструктурного кода, но с сохранением качества
 */
export const CONFIG_FILES_RULES = {
  // Разрешить специфические паттерны конфигов
  '@typescript-eslint/no-var-requires': 'off', // require() в конфигах
  'no-console': 'off', // console.log в конфигах для отладки

  // Ослабить некоторые строгие правила
  '@typescript-eslint/no-explicit-any': 'warn', // any может быть нужен в конфигах
  'no-magic-numbers': 'off', // числа в конфигах - это нормально

  // Но сохранить основные правила качества
  'no-unused-vars': 'error',
  'no-undef': 'error',
  '@typescript-eslint/no-unused-vars': 'error',

  // Отключить правила, конфликтующие с конфиг-форматом
  'import/no-default-export': 'off', // module.exports = {} - норма для конфигов
  'import/prefer-default-export': 'off',

  // Добавить безопасность даже для конфигов
  'no-eval': 'error',           // Запретить eval в конфигах
  'no-implied-eval': 'error',   // Запретить implied eval

  // Дополнительное качество
  'no-duplicate-imports': 'warn',
};

// ==================== EXTRA RULES ДЛЯ РЕЖИМОВ ====================
// Определяем extra rules ПЕРЕД функцией applySeverity, т.к. они используются внутри неё

/**
 * Статические правила для DEV режима (не зависят от режима)
 * Эти правила всегда имеют фиксированный уровень строгости
 * 📌 ЛОГИКА ВЫБОРА:
 * - Стилистические правила (object-shorthand, prefer-const)
 * - Современные паттерны (@typescript-eslint/consistent-type-imports)
 * - Правила, которые не имеют mode-aware поведения
 * - Правила, конфликтующие с Effect-TS паттернами
 * ⚠️ ВАЖНО: Mode-aware правила должны быть в QUALITY_WITH_SEVERITY, а не здесь!
 * (например, '@typescript-eslint/no-explicit-any' теперь там)
 */
export const DEV_EXTRA_RULES = {
  // ==================== СТИЛЬ И ЧИТАЕМОСТЬ ====================
  'object-shorthand': 'warn',        // Предпочитать shorthand синтаксис
  'prefer-const': 'warn',            // Предпочитать const перед let
  'no-var': 'warn',                  // Избегать var
  'no-multiple-empty-lines': 'warn', // Чистота форматирования

  // ==================== COMPATIBILITY & MODERNITY ====================
  '@typescript-eslint/consistent-type-imports': 'warn', // Лучше tree-shaking
  // prefer-arrow-callback удалено - Effect-код часто использует named functions и generators (function*)

  // ESLint: запрет импортов из barrel file для всех пакетов @livai/*
  // Barrel file prevention: запрет импортов из @livai/* (barrel file)
  // Требует использования subpath exports для избежания загрузки всех зависимостей
  // Исключение: сам пакет может использовать barrel file для внутренних импортов
  // Список пакетов генерируется автоматически из packages/ и apps/ через generateRestrictedImportsPaths()
  'no-restricted-imports': [
    'warn',
    {
      paths: generateRestrictedImportsPaths(),
    },
  ],
};

/**
 * Дополнительные правила для CANARY режима (максимальная строгость)
 * В CANARY режиме все базовые правила уже преобразуются в 'error',
 * поэтому здесь только дополнительные правила, специфичные для canary.
 * Type-aware правила (FULL_TYPE_AWARE_RULES) применяются отдельно
 * в canary.config.mjs для файлов с type-aware настройками.
 * 📌 ЛОГИКА:
 *   - CANARY = максимальная строгость, все правила = 'error'
 *   - Дополнительные правила качества сверх BASE_QUALITY_RULES
 *   - Type-aware правила применяются отдельно (см. canary.config.mjs)
 */
export const CANARY_EXTRA_RULES = {
  // В canary все базовые правила уже максимально строгие
  // Здесь только дополнительные правила сверх BASE_QUALITY_RULES
  // Пока пусто - все базовые правила в BASE_QUALITY_RULES

  // ESLint: запрет импортов из barrel file для всех пакетов @livai/*
  // Barrel file prevention: запрет импортов из @livai/* (barrel file)
  // Требует использования subpath exports для избежания загрузки всех зависимостей
  // Исключение: сам пакет может использовать barrel file для внутренних импортов
  // Паттерн блокирует только прямые импорты (@livai/app, @livai/feature-auth),
  // но разрешает subpath exports (@livai/app/lib/error-mapping.js)
  // Список пакетов генерируется автоматически из packages/ и apps/
  'no-restricted-imports': [
    'error',
    {
      paths: generateRestrictedImportsPaths(),
    },
  ],
};

// ==================== УТИЛИТЫ ДЛЯ КЛОНИРОВАНИЯ ====================

/**
 * Shallow клонирование опций ESLint правил
 * ESLint опции обычно плоские (массивы и объекты с примитивными значениями),
 * поэтому shallow clone достаточно для предотвращения мутации.
 * @param {any[]} options - массив опций ESLint правила
 * @returns {any[]} shallow склонированные опции
 */
export function cloneOptionsShallow(options) {
  return options.map(opt =>
    Array.isArray(opt)
      ? [...opt]
      : opt && typeof opt === 'object'
        ? { ...opt }
        : opt
  );
}

/**
 * Универсальная функция применения уровней строгости к правилам ESLint
 * ЧИСТАЯ ФУНКЦИЯ: делает только трансформацию severity, без mode-aware логики
 * @param {Record<string, string | [string, ...any]>} rules - объект с правилами ESLint
 *   Правила могут быть строкой ('error', 'warn', 'off') или массивом ['error', options...]
 * @param {Record<string, 'off' | 'warn' | 'error'>} [severityMap={}] - маппинг ruleName -> severity
 *   Переопределяет уровень строгости для конкретных правил
 * @param {'off' | 'warn' | 'error'} [defaultSeverity='warn'] - уровень по умолчанию для правил не в severityMap
 * @returns {Record<string, string | [string, ...any]>} преобразованные правила с примененными уровнями строгости
 */
export function applySeverity(rules, severityMap = {}, defaultSeverity = 'warn') {
  if (!rules) {
    return {};
  }

  // Собираем изменения для логирования (только если включено логирование и не в production)
  const changes = DEBUG_ESLINT_SEVERITY && !IS_PRODUCTION ? [] : null;

  // Применяем преобразование строгости к правилам
  // Используем reduce вместо fromEntries(map(...)) для лучшей производительности
  const transformedRules = Object.entries(rules).reduce((acc, [ruleName, ruleValue]) => {
      // "off" правила остаются "off" всегда (приоритет над severityMap)
      if (ruleValue === 'off' || (Array.isArray(ruleValue) && ruleValue[0] === 'off')) {
        acc[ruleName] = ruleValue;
        return acc;
      }

      // Определяем текущий и целевой уровень строгости
      const currentSeverity = Array.isArray(ruleValue) ? ruleValue[0] : ruleValue;
      const targetSeverity = severityMap[ruleName] ?? defaultSeverity;

      // Сохраняем изменение для логирования (только если изменился)
      if (changes !== null && currentSeverity !== targetSeverity) {
        changes.push({ ruleName, currentSeverity, targetSeverity });
      }

      // Применяем уровень к правилу
      if (Array.isArray(ruleValue)) {
        // Для массивов: ['warn', options...] → ['error', options...]
        const [_, ...options] = ruleValue; // Игнорируем текущий уровень, заменяем на targetSeverity

        // Shallow clone options для безопасности (предотвращает мутацию исходных опций)
        // Используем cloneOptionsShallow() для простого клонирования ESLint опций
        const clonedOptions = cloneOptionsShallow(options);
        acc[ruleName] = [targetSeverity, ...clonedOptions];
      } else {
        // Для простых правил: 'warn' → 'error'
        acc[ruleName] = targetSeverity;
      }

      return acc;
    }, {});

  // Логируем изменения с группировкой для удобства просмотра больших конфигов
  if (changes !== null && changes.length > 0) {
    console.groupCollapsed(`📊 ESLint Severity Changes (${changes.length} rule${changes.length !== 1 ? 's' : ''})`);
    changes.forEach(({ ruleName, currentSeverity, targetSeverity }) => {
      console.log(`  ${ruleName}: ${currentSeverity} → ${targetSeverity}`);
    });
    console.groupEnd();
  }

  return transformedRules;
}

/**
 * Применяет severity-aware правила к конфигурации
 * @param {Record<string, { dev: string, canary: string, test: string }>} qualityWithSeverity - severity-aware правила
 * @param {'dev'|'canary'|'test'} mode - режим для определения severity
 * @returns {Record<string, string>} правила с примененными уровнями строгости для режима
 */
export function applySeverityAwareRules(qualityWithSeverity, mode) {
  const result = {};

  for (const [ruleName, severityConfig] of Object.entries(qualityWithSeverity)) {
    result[ruleName] = severityConfig[mode] || 'off';
  }

  return result;
}

/**
 * Унифицированный массив игнорируемых файлов
 * ⚠️ ВАЖНО:
 * COMMON_IGNORES содержит ТОЛЬКО технические и сгенерированные файлы.
 * Бизнес-код никогда не должен сюда попадать.
 */
export const COMMON_IGNORES = [
  // ==================== BUILD ARTIFACTS ====================
  // Сгенерированные файлы и артефакты сборки - "мертвый код", не пишется руками
  '**/dist/**', // Скомпилированные файлы (TypeScript → JavaScript)
  '**/node_modules/**', // Зависимости из npm/pnpm
  '**/build/**', // Артефакты сборки
  '**/coverage/**', // Отчёты о покрытии тестами (генерируются автоматически)
  '**/.next/**', // Next.js build artifacts
  '**/.turbo/**', // Turborepo cache
  '**/html/**', // Generated HTML assets

  // ==================== TEST FILES ====================
  // Тестовые файлы имеют ослабленные правила (см. testFilesOverrides в master.config.mjs)
  // Они исключаются из общего линтинга, но проверяются отдельно с более мягкими правилами
  '**/*.test.{ts,tsx,js,jsx,mjs,cjs}',
  '**/*.spec.{ts,tsx,js,jsx,mjs,cjs}',
  '**/__tests__/**',
  '**/test/**',
  '**/tests/**',

  // ==================== CONFIG FILES ====================
  // Конфигурационные файлы проверяются с гибридным подходом:
  // - Ослабленные правила через CONFIG_FILES_RULES
  // - Но НЕ полное исключение из линтинга

  // ==================== INFRASTRUCTURE ====================
  // Infrastructure директория содержит только конфигурационные файлы (YAML, Terraform, etc.)
  // Нет JavaScript/TypeScript кода приложения - "внешний/генерированный код"
  'infrastructure/**',
];
