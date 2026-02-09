/**
 * @file LivAi Quality Ontology - Runtime DSL
 * @description
 * Файл Runtime DSL для определения качества кода и правил ESLint в платформе LivAi.
 * Содержит загрузку плагинов, базовые правила, критические правила и настройки для всех зон.
 * Полная философия и документация: см. ./ONTOLOGY.md
 *
 * TypeScript Governance Layer.
 * Python services are governed by:
 *  - Ruff (style & correctness)
 *  - Bandit (security)
 *  - Semgrep (AI safety)
 */

/**
 * ⚠️ ВАЖНО:
 * Этот файл — фундаментальная часть системы ESLint LivAi.
 * Содержит базовые константы, плагины и runtime DSL для всех конфигураций.
 * НЕ является основным ESLint конфигом (используется внутри master.config.mjs и режимных конфигов).
 */

// ==================== Конфигурация окружения ====================

/** Режим роутера Next.js: "app" (по умолчанию), "pages" или "hybrid" */
const NEXT_ROUTER_MODE = process.env.NEXT_ROUTER_MODE || 'app';
/** Включить подробный вывод загрузки ESLint плагинов */
const ESLINT_VERBOSE = process.env.ESLINT_VERBOSE === '1';
/** Множество уже предупрежденных плагинов */
const warnedPlugins = new Set();

// ==================== Импорты плагинов ESLint ====================

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
// import importPlugin from 'eslint-plugin-import'; // ❌ Отключен: несовместим с ESLint 10.0.0
const importPlugin = null;
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import promisePlugin from 'eslint-plugin-promise';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
// Безопасность Node.js runtime (CRLF, tainted data и т.д.)
import securityNodePlugin from 'eslint-plugin-security-node';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import globals from 'globals';

/**
 * Попытка динамически импортировать ESLint плагин
 * @param {string} pluginName - название плагина
 * @param {boolean} [verbose=ESLINT_VERBOSE] - выводить лог загрузки
 * @returns {Promise<any|null>} загруженный плагин или null
 */
async function tryImport(pluginName, verbose = ESLINT_VERBOSE) {
  try {
    const mod = await import(pluginName);
    const plugin = mod.default ?? mod;
    if (verbose) {
      console.log(`✅ Плагин ${pluginName} загружен`);
    }
    return plugin;
  } catch (error) {
    if (!warnedPlugins.has(pluginName)) {
      warnedPlugins.add(pluginName);
      const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
      if (code === 'ERR_MODULE_NOT_FOUND') {
        console.warn(`⚠️  Плагин ${pluginName} не найден, правила будут пропущены:`, error.message);
      } else {
        console.error(`❌ Плагин ${pluginName} найден, но падает при инициализации:`, error.message);
      }
    }
    return null;
  }
}

// ==================== Асинхронная загрузка плагинов ====================

// Общая веб-безопасность (object injection, eval, fs access и т.д.)
// const securityPlugin = await tryImport('eslint-plugin-security'); // ❌ Отключен: несовместим с ESLint 10.0.0
const securityPlugin = null;
// const noSecretsPlugin = await tryImport('eslint-plugin-no-secrets'); // ❌ Отключен: несовместим с ESLint 10.0.0
const noSecretsPlugin = null;
const sonarjsPlugin = await tryImport('eslint-plugin-sonarjs');
const boundariesPlugin = await tryImport('eslint-plugin-boundaries');
// const tsdocPlugin = await tryImport('eslint-plugin-tsdoc'); // ❌ Отключен: несовместим с ESLint 10.0.0
const tsdocPlugin = null;
const reactPerfPlugin = await tryImport('eslint-plugin-react-perf');
const nextPlugin = await tryImport('@next/eslint-plugin-next');
// const eslintCommentsPlugin = await tryImport('eslint-plugin-eslint-comments'); // ❌ Отключен: несовместим с ESLint 10.0.0
const eslintCommentsPlugin = null;

// AI Security - first-class citizen
const aiSecurityPlugin = await tryImport('./plugins/ai-security/index.js');

const [fpPlugin, effectPlugin] = await Promise.all([
  tryImport('eslint-plugin-fp'),
  tryImport('@effect/eslint-plugin'),
]);

const [functionalPlugin] = await Promise.all([tryImport('eslint-plugin-functional')]);

const [livAiRagPlugin, livAiMultiagentPlugin] = await Promise.all([
  tryImport('./plugins/rag/index.js'),
  tryImport('./plugins/multiagent/index.js'),
]);

// ==================== Объект всех плагинов ====================
// AI-Governed Platform: AI плагины как core-подсистема, не дополнение

/** @type {Record<string, any>} */
export const PLUGINS = {
  // Language Foundation
  '@typescript-eslint': typescriptEslint,

  // Web/UI Layer
  // import: importPlugin, // ❌ Отключен: несовместим с ESLint 10.0.0
  'jsx-a11y': jsxA11yPlugin,
  react: reactPlugin,
  'react-hooks': reactHooksPlugin,
  promise: promisePlugin,
  'testing-library': testingLibraryPlugin,

  // Ядро безопасности (включая AI Security как first-class)
  // security: общая веб-безопасность (object injection, eval, fs access)
  // security: securityPlugin || {}, // ❌ Отключен: несовместим с ESLint 10.0.0
  // security-node: безопасность Node.js runtime (CRLF, tainted data)
  'security-node': securityNodePlugin,
  // 'no-secrets': noSecretsPlugin || {}, // ❌ Отключен: несовместим с ESLint 10.0.0
  'ai-security': aiSecurityPlugin || {},

  // Functional Programming (Effect-TS как execution model)
  fp: fpPlugin || {},
  effect: effectPlugin || {},
  functional: functionalPlugin || {},

  // AI Core (ядро AI-first платформы)
  '@livai/rag': livAiRagPlugin || {},
  '@livai/multiagent': livAiMultiagentPlugin || {},

  // Quality & Documentation
  sonarjs: sonarjsPlugin || {},
  boundaries: boundariesPlugin || {},
  // tsdoc: tsdocPlugin || {}, // ❌ Отключен: несовместим с ESLint 10.0.0
  'react-perf': reactPerfPlugin || {},
  '@next/next': nextPlugin || {},
  // 'eslint-comments': eslintCommentsPlugin || {}, // ❌ Отключен: несовместим с ESLint 10.0.0
};

// ==================== Кэширование правил ESLint ====================

export const CACHE_CONFIG = {
  /** Директория кэша */
  cacheDir: '.cache',
  /** Максимальный возраст кэша в миллисекундах (24 часа) */
  maxAge: 24 * 60 * 60 * 1000,
};

// ==================== Общие опции языка ====================

export const commonLanguageOptions = {
  parser: typescriptParser,
  parserOptions: {
    projectService: true,
    allowDefaultProject: ['**/*.js', '**/*.jsx'],
    ecmaVersion: 'latest',
    sourceType: 'module',
    noWarnOnMultipleProjects: true,
  },
  globals: {
    // Node.js runtime
    ...globals.node,

    // Browser APIs
    ...globals.browser,

    // Testing frameworks
    ...globals.jest,

    // Vitest
    vi: 'readonly',
    vitest: 'readonly',
  },
};

// ==================== Базовые правила безопасности ====================

// ❌ Отключено: eslint-plugin-security несовместим с ESLint 10.0.0
const SECURITY_BASELINE_RULES = (() => {
  const rules = {};
  // Пустые правила безопасности - плагин отключен
  return rules;
})();

// ==================== Критические правила безопасности ====================
// Runtime killers - ломают production при нарушении

export const SECURITY_CRITICAL_RULES = {
  ...SECURITY_BASELINE_RULES,
  // Дополнительные runtime killers (универсальные)
};

// ================= Правила усиления безопасности Node.js Runtime =================
// Специфичные правила для безопасности Node.js runtime

export const NODE_RUNTIME_RULES = {
  ...SECURITY_CRITICAL_RULES,                         // Наследуем базовые critical правила
  'security-node/detect-crlf': 'error',              // CRLF инъекции в HTTP заголовках
  'security-node/detect-non-literal-regexp': 'warn',  // Небезопасные регулярные выражения
  'security-node/detect-tainted-string': 'warn',     // Строки из ненадежных источников
  'security-node/detect-tainted-array': 'warn',      // Массивы из ненадежных источников
  'security-node/detect-tainted-object': 'warn',     // Объекты из ненадежных источников
};

// ================= Критические правила, ломают production =================

export const CRITICAL_RULES = {
  '@typescript-eslint/consistent-type-imports': 'error', // Строгие type imports
  // ❌ Отключено: eslint-plugin-import несовместим с ESLint 10.0.0
  // 'import/no-cycle': 'error',                      // Запрет циклических зависимостей
  // 'import/no-relative-packages': 'error',          // Запрет относительных импортов пакетов
  'no-return-await': 'error',                      // Запрет избыточного return await
  // fp/no-throw определен в EFFECT_TS_RULES как часть execution model
  ...SECURITY_CRITICAL_RULES,
};

// ==================== AI Safety Rules ====================
// Технологическая безопасность AI систем (technical safeguards)

const AI_SAFETY_RULES = {
  ...(livAiRagPlugin ? {
    '@livai/rag/context-leakage': 'error',      // Утечки контекста RAG
    '@livai/rag/token-limits': 'error',         // Контроль лимитов токенов
    '@livai/rag/source-citation': 'warn',       // Цитирование источников
  } : {}),

  ...(livAiMultiagentPlugin ? {
    '@livai/multiagent/agent-isolation': 'error', // Изоляция агентов
    '@livai/multiagent/orchestration-safety': 'error', // Безопасность оркестрации
  } : {}),
};

// ==================== AI Compliance Rules ====================
// Регуляторные требования (PII, audit, токены, legal compliance)

const AI_COMPLIANCE_RULES = aiSecurityPlugin ? {
  'ai-security/pii-detection': 'error',       // Обнаружение PII в AI контексте
  'ai-security/token-leakage': 'error',       // Утечки токенов API
  'ai-security/prompt-injection': 'error',    // Атаки prompt injection
  'ai-security/data-leakage': 'error',        // Утечки данных в AI pipeline
  'ai-security/model-poisoning': 'error',     // Защита от model poisoning
} : {};

// ==================== Reliability Rules ====================
// Enterprise-grade reliability patterns

const RELIABILITY_RULES = {
  'promise/no-return-wrap': 'error',           // Избыточная обертка промисов
  'promise/no-new-statics': 'error',           // Запрет Promise constructor
  'promise/no-nesting': 'warn',                // Предотвращение callback hell
  'promise/no-promise-in-callback': 'error',   // Промисы вместо колбэков
  'promise/always-return': 'error',            // Возврат значений в цепочках
  'promise/no-return-in-finally': 'error',     // Корректное использование finally
};

// ==================== Базовые правила для всех зон ====================

export const BASE_RULES = {
  // Включаем reliability правила (promises, async patterns)
  ...RELIABILITY_RULES,

  '@typescript-eslint/no-unused-vars': 'error',    // Неиспользуемые переменные
  'no-console': ['error', { allow: ['warn', 'error', 'info'] }], // Контроль использования console
  'prefer-template': 'error',                      // Использование шаблонных строк вместо конкатенации
  'no-debugger': 'error',                          // Запрет debugger в production

  // Строгие TypeScript правила
  '@typescript-eslint/no-explicit-any': 'error', // Повышен до error
  '@typescript-eslint/no-var-requires': 'error',  // Запрет require() вместо import
  '@typescript-eslint/no-require-imports': 'error', // Предпочтение import перед require
  '@typescript-eslint/no-non-null-assertion': 'warn', // Контроль non-null assertion
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'], // Предпочтение type перед interface
  '@typescript-eslint/array-type': ['error', { default: 'array', readonly: 'array' }], // Синтаксис массивов
  '@typescript-eslint/naming-convention': [        // Соглашения об именовании
    'error',
    {
      selector: 'variable',
      modifiers: ['exported'],
      format: ['camelCase', 'PascalCase'],
    },
  ],
  '@typescript-eslint/strict-boolean-expressions': 'error', // Строгие булевые выражения
  '@typescript-eslint/no-unnecessary-type-assertion': 'error', // Избыточные type assertions
  '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }], // Явные типы возврата
  '@typescript-eslint/no-unnecessary-condition': 'error', // Избыточные условия
  '@typescript-eslint/no-unnecessary-qualifier': 'error', // Избыточные квалификаторы
  '@typescript-eslint/prefer-nullish-coalescing': 'error', // Предпочтение ?? вместо ||
  '@typescript-eslint/prefer-optional-chain': 'error', // Предпочтение ?. вместо проверок
  '@typescript-eslint/ban-ts-comment': ['error', {    // Контроль TS комментариев
    'ts-ignore': true,
    'ts-nocheck': true,
    'ts-expect-error': { descriptionFormat: '^.*$' },
  }],

  // ❌ Отключено: eslint-plugin-import несовместим с ESLint 10.0.0
  // 'import/order': [
  //   'error',
  //   {
  //     groups: [
  //       ['builtin', 'external'],
  //       'internal',
  //       ['parent', 'sibling', 'index'],
  //     ],
  //     'newlines-between': 'always',
  //     alphabetize: { order: 'asc', caseInsensitive: true },
  //   },
  // ],
  // 'import/no-duplicates': 'error',                       // Дублирование импортов
  // 'import/no-unused-modules': 'warn',                    // Неиспользуемые модули
  // 'import/no-unresolved': ['warn', {
  //   ignore: ['^@livai/']  // Игнорировать workspace пакеты LivAi
  // }],
  // 'import/consistent-type-specifier-style': ['error', 'prefer-top-level'], // Стиль type imports

  // Контроль отключений ESLint
  // ❌ Отключено: eslint-plugin-eslint-comments несовместим с ESLint 10.0.0
  // ...(eslintCommentsPlugin ? {
  //   'eslint-comments/no-unlimited-disable': 'error',     // Запрет глобального отключения ESLint
  //   'eslint-comments/no-restricted-disable': 'error', // Ограничение отключений
  //   'eslint-comments/disable-enable-pair': 'error',      // Парные отключения ESLint
  // } : {}),

  'no-var': 'warn',                                      // Предпочтение let/const перед var
  'prefer-const': 'warn',                                // Предпочтение const перед let
  'no-undef': 'warn',                                    // Неопределенные переменные
  'no-magic-numbers': ['warn', { ignore: [0, 1, -1, 2, 10, 100, 1000] }], // Магические числа
  'no-trailing-spaces': 'warn',                          // Пробелы в конце строк
  'eol-last': 'warn',                                    // Перевод строки в конце файла
  'no-multiple-empty-lines': 'warn',                     // Множественные пустые строки
  'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }], // Дублирование импортов
  'no-useless-rename': 'warn',                           // Бесполезное переименование

  // Мусорные выражения и ложные конструкции
  'no-unused-expressions': 'error',                      // Неиспользуемые выражения
  'no-void': 'warn',                                     // Использование void

  // Дополнительные правила качества кода
  // ❌ Отключено: eslint-plugin-no-secrets несовместим с ESLint 10.0.0
  // no-secrets/no-secrets определен в SECURITY_BASELINE_RULES как 'error'
  // SonarJS правила определены в ENTERPRISE_RULES (error уровень)
};

// ==================== Enterprise Compliance Rules ====================
// SOC2, ISO27001, AI Act compliance by design
// Multi-tenant + AI-first enterprise requirements

export const ENTERPRISE_RULES = {
  ...BASE_RULES,        // Включает SECURITY_BASELINE_RULES + RELIABILITY_RULES
  ...AI_COMPLIANCE_RULES,

  // Auditability & Compliance (расширенные enterprise требования)
  'sonarjs/cognitive-complexity': ['error', 10],     // Когнитивная сложность кода
  'sonarjs/no-duplicate-string': 'error',            // Дублирование строковых литералов
  'sonarjs/no-all-duplicated-branches': 'error',     // Полностью дублированные ветки
  'sonarjs/no-collapsible-if': 'error',              // Сворачиваемые условные операторы
  'sonarjs/no-identical-functions': 'error',         // Идентичные функции
  'sonarjs/no-redundant-jump': 'error',              // Избыточные операторы перехода
};

// ==================== AI правила (First-Class Citizen) ====================
// AI-first платформа: любой AI код без этих правил — не production-grade
// Технологическая безопасность AI систем

export const AI_RULES = {
  ...AI_SAFETY_RULES,
};

// ==================== React правила ====================

export const REACT_RULES = {
  'react-hooks/rules-of-hooks': 'error',           // Правила использования React hooks
  'react-hooks/exhaustive-deps': 'error',          // Проверка зависимостей useEffect и подобных
  'jsx-a11y/alt-text': 'error',                    // Альтернативный текст для изображений
  'jsx-a11y/anchor-is-valid': 'error',             // Валидные ссылки для навигации
  'jsx-a11y/click-events-have-key-events': 'error', // Клавиатурная навигация
  'jsx-a11y/no-noninteractive-element-interactions': 'error', // Только интерактивные элементы обрабатывают события
  'react/no-danger': 'error',                      // Предотвращение XSS через dangerouslySetInnerHTML
  'react/no-array-index-key': 'error',             // Запрет использования индекса массива как key
};

// ==================== Next.js правила ====================

export const NEXT_RULES = {
  '@next/next/no-html-link-for-pages': 'error', // Использование Link вместо <a>
  ...((NEXT_ROUTER_MODE === 'pages' || NEXT_ROUTER_MODE === 'hybrid')
    ? {
        '@next/next/no-title-in-document-head': 'error', // Title в _document.js вместо <Head>
        '@next/next/no-head-import-in-document': 'error', // Правильный импорт Head
      }
    : {}),
};

// =========================== FP правила ===========================

export const FP_RULES = {
  ...(fpPlugin ? {
    'fp/no-mutation': 'error',       // Запрет мутаций (повышен до error)
    'fp/no-nil': 'error',            // Запрет null/undefined
    'fp/no-rest-parameters': 'warn', // Предпочтение явных параметров
    'fp/no-unused-expression': 'warn', // Неиспользуемые выражения
    'fp/no-get-set': 'error',        // Запрет getter/setter
    'fp/no-events': 'warn',          // Запрет событийной модели
    'fp/no-valueof-field': 'warn',   // Предпочтение equals методам
  } : {}),

  ...(functionalPlugin ? {
    'functional/no-let': 'error',                    // Только const
    'functional/no-loop-statements': 'error',        // Рекурсия вместо циклов
    'functional/no-this-expressions': 'error',       // Запрет this
    'functional/no-classes': 'error',                // ADT вместо классов
    'functional/prefer-immutable-types': 'warn',     // Неизменяемые типы
    'functional/no-mixed-types': 'warn',             // Однородные типы
    'functional/no-expression-statements': 'warn',   // Предпочтение функций
    'functional/no-conditional-statements': 'warn',  // Pattern matching
    'functional/no-try-statements': 'warn',          // Either/Option вместо try/catch
  } : {}),
};

// =================== Effect-TS Execution Model ===================
// Effect-TS как официальный execution model для AI-first платформы
// Канонизирован, а не отключен
// IMPORTANT: Effect-TS rules override FP rules when used together
//
// Правило комбинации: { ...FP_RULES, ...EFFECT_TS_RULES }
// (EFFECT_TS_RULES всегда последним для переопределения)

export const EFFECT_TS_RULES = {
  // Core Effect-TS паттерны (запрещаем антипаттерны)
  // Эти правила переопределяют FP_RULES для совместимости с Effect-TS
  ...(fpPlugin ? {
    'fp/no-throw': 'error',        // Effect.fail вместо throw
    'fp/no-mutation': 'error',     // Иммутабельность как основа
    'fp/no-nil': 'off',            // Effect может возвращать null/undefined (переопределяет FP_RULES)
    'fp/no-rest-parameters': 'off', // Effect API использует rest params (переопределяет FP_RULES)
  } : {}),

  ...(functionalPlugin ? {
    'functional/no-let': 'error',                      // Только const
    'functional/no-loop-statements': 'error',          // Effect recursion вместо loops
    'functional/no-this-expressions': 'error',         // Нет this в FP
    'functional/no-classes': 'error',                  // ADT вместо классов
    'functional/no-expression-statements': 'off',      // Effect.runMainExpression (переопределяет FP_RULES)
    'functional/no-try-statements': 'off',             // Effect.try (переопределяет FP_RULES)
  } : {}),
};

// =================== Zone Guards для Effect-TS ===================

export const EFFECT_ZONE_GUARDS = {
  // fp/no-throw определен в EFFECT_TS_RULES
};

// ==================== AI-First Domain Rules ====================
// Зоны отражают AI-архитектуру, а не только Clean Architecture
// ESLint как архитектурный firewall для AI-first enterprise платформы

/**
 * Foundation Rules - контракты между Python и TypeScript
 * Протоколы, интерфейсы, type definitions (не реализации)
 */
export const FOUNDATION_RULES = {
  ...BASE_RULES,
  ...ENTERPRISE_RULES,

  // Architectural boundaries теперь контролируются через no-restricted-imports в architectural-boundaries.mjs

  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // API contracts
  '@typescript-eslint/no-explicit-any': 'error', // Strict typing в контрактах
};

/**
 * AI Execution Domain Rules - RAG, агенты, orchestration (TypeScript часть)
 * МАКСИМАЛЬНАЯ строгость для AI execution layer (ядро системы)
 */
export const AI_EXECUTION_DOMAIN_RULES = {
  ...CRITICAL_RULES,      // Правила, ломают production при нарушении
  ...FP_RULES,            // Базовые FP правила
  ...EFFECT_TS_RULES,     // Effect как execution model (overrides FP rules)
  ...AI_RULES,            // AI safety & reliability
  ...ENTERPRISE_RULES,    // Compliance by design

  // Architectural boundaries теперь контролируются через no-restricted-imports в architectural-boundaries.mjs

  // Максимальная строгость для ядра
  '@typescript-eslint/no-explicit-any': 'error',
  'sonarjs/cognitive-complexity': ['error', 10], // AI код должен быть простым (максимум!)
  ...(functionalPlugin ? {
    'functional/no-let': 'error',                      // Только const в ядре
    'functional/prefer-immutable-types': 'error',     // Строгое FP в ядре
  } : {}),
};

/**
 * AI Pipeline Domain Rules - embeddings, vector DB, pipelines
 * Высокая строгость, но прагматичная для интеграционной инфраструктуры
 */
export const AI_PIPELINE_DOMAIN_RULES = {
  ...FP_RULES,            // Базовые FP правила
  ...EFFECT_TS_RULES,     // Effect как execution model (overrides FP rules)
  ...ENTERPRISE_RULES,

  // Architectural boundaries теперь контролируются через no-restricted-imports в architectural-boundaries.mjs

  // Ослабления для инфраструктуры (прагматизм для интеграций)
  'no-magic-numbers': 'off', // Нужны числовые константы (размеры векторов, лимиты)
  'sonarjs/cognitive-complexity': ['warn', 15], // Ослаблено для интеграционной логики
  ...(functionalPlugin ? {
    'functional/no-let': 'warn', // Разрешено в инфраструктуре для прагматизма
    'functional/prefer-immutable-types': 'warn', // Ослаблено для инфраструктуры
  } : {}),

  // Специфика инфраструктуры
  'security/detect-child-process': 'warn', // AI pipelines могут использовать subprocess
  '@typescript-eslint/no-explicit-any': 'error',
};

/**
 * API Gateway Domain Rules - edge валидация, security, rate limiting
 * Защита AI API от внешнего мира
 */
export const API_GATEWAY_DOMAIN_RULES = {
  ...CRITICAL_RULES,        // Правила, ломают production при нарушении
  ...ENTERPRISE_RULES,      // Включает SECURITY_BASELINE_RULES
  ...NODE_RUNTIME_RULES,    // Node-специфичные security правила
  'no-console': 'error',    // Gateway логи через structured logging
  '@typescript-eslint/no-explicit-any': 'error', // Строгая типизация в gateway
  'sonarjs/cognitive-complexity': ['error', 10], // API код должен быть простым
};

/**
 * UI/Experience Domain Rules - React, Next.js, accessibility
 * AI-first интерфейсы с WCAG compliance
 */
export const UI_DOMAIN_RULES = {
  ...REACT_RULES,
  ...BASE_RULES,
  'react-hooks/exhaustive-deps': 'error', // Дополнительная проверка зависимостей
  'react/no-danger': 'error',             // Безопасность dangerouslySetInnerHTML
  'react/no-array-index-key': 'error',    // Предотвращение проблем с key
  'jsx-a11y/alt-text': 'error',           // AI генерирует изображения
  'jsx-a11y/anchor-is-valid': 'error',    // Валидные ссылки для навигации
  'jsx-a11y/click-events-have-key-events': 'error', // Клавиатурная навигация
  'jsx-a11y/no-noninteractive-element-interactions': 'error', // Только интерактивные элементы обрабатывают события
  // React Performance для AI-driven UI
  ...(reactPerfPlugin ? {
    'react-perf/jsx-no-new-object-as-prop': 'error', // Предотвращение лишних ререндеров
    'react-perf/jsx-no-new-array-as-prop': 'error',  // Оптимизация массивов в props
    'react-perf/jsx-no-new-function-as-prop': 'error', // Предотвращение создания функций в render
  } : {}),
};

/**
 * Apps Domain Rules - финальные приложения (тонкий слой)
 * Минимальные правила для быстрой разработки PWA
 */
export const APPS_DOMAIN_RULES = {
  ...BASE_RULES,
  ...REACT_RULES,
  // Таргетированные ослабления для быстрой итерации в apps (production всё равно!)
  '@typescript-eslint/no-explicit-any': ['warn', { ignoreRestArgs: true }], // Разрешить any только в rest args
  'sonarjs/cognitive-complexity': ['warn', 15], // Более мягкие требования для прототипов
};

// ==================== Общие настройки ESLint ====================

export const commonSettings = {
  react: {
    version: 'detect',
  },
  next: {
    rootDir: ['apps/web', 'apps/admin', 'apps/mobile', 'apps/pwa'],
  },
  // ❌ Отключено: eslint-plugin-import несовместим с ESLint 10.0.0
  // 'import/resolver': {
  //   typescript: {
  //     alwaysTryTypes: true,
  //     project: [
  //       './tsconfig.json',
  //       './apps/*/tsconfig.json',
  //       './packages/*/tsconfig.json',
  //     ],
  //   },
  //   node: {
  //     extensions: ['.js', '.jsx', '.ts', '.tsx'],
  //   },
  // },
};
