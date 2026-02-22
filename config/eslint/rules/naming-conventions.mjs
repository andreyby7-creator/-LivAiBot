/**
 * @file Архитектурные правила именования ESLint для LivAi
 *
 * Полностью универсальные правила для Effect/FP слоёв.
 * Любой новый Effect-файл автоматически подпадает под правила.
 * Минимум дублирования, максимум дальновидности.
 */

// Импорт данных зон из check-zones.mjs для синхронизации
import { PACKAGE_ZONE_MAPPING } from '../utils/check-zones.mjs';

// ==================== КОНСТАНТЫ ДЛЯ ПРАВИЛ ИМЕНОВАНИЯ ====================

/**
 * Effect-TS API функции (экспортируемые функции-константы)
 * Используются для создания и манипуляции Effect
 * 
 * 📌 ВАЖНО: При добавлении новых Effect API функций добавьте их в этот массив
 * для автоматического применения правил именования (camelCase)
 * 
 * @see https://effect.website/docs/ - официальная документация Effect-TS
 */
const EFFECT_API_FUNCTIONS = [
  // Базовые конструкторы
  'of',
  'pure',
  'fromPromise',
  'defer',
  'sync',
  'async',
  'succeed',
  'fail',
  'die',
  'interrupt',
  
  // Комбинаторы
  'map',
  'flatMap',
  'chain', // alias для flatMap
  'tap',
  'fold',
  'match',
  'catchAll',
  'catchSome',
  'getOrElse',
  'orElse',
  
  // Context и зависимости
  'provide',
  'provideService',
  'access',
  'accessM',
  'serviceFunction',
  'serviceFunctionM',
  
  // Дополнительные комбинаторы
  'zip',
  'zipWith',
  'zipPar',
  'race',
  'timeout',
  'retry',
  'repeat',
];

/**
 * Форматы именования для констант верхнего уровня
 * Используется для централизованного управления правилами именования
 */
const TOP_LEVEL_CONST_FORMATS = ['UPPER_CASE', 'PascalCase'];

// ==================== РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ ДЛЯ ИСКЛЮЧЕНИЙ ====================
const NAMING_EXCEPTIONS = {
  PRISMA_METHODS: '^\\$',
  GRAPHQL_AST_NODES:
    '^(Field|OperationDefinition|FragmentDefinition|InlineFragment|SelectionSet|VariableDefinition|Argument|Directive|FragmentSpread|ObjectField|StringValue|IntValue|FloatValue|BooleanValue|NullValue|EnumValue|ListValue|ObjectValue|Name)$',
  NODE_GLOBALS: '^__(filename|dirname)$',
  GRAPHQL_TYPES: '.*GQL$',
  GRAPHQL_ENUMS: '.*GQLEnum$',
  REACT_COMPONENTS: '.*Component$',
};

// ==================== EFFECT + FP СЛОЙ ====================
/**
 * Динамическая генерация паттернов для Effect/FP файлов
 * Использует PACKAGE_ZONE_MAPPING для автоматической синхронизации с архитектурой
 *
 * 📌 ВАЖНО: При добавлении новых пакетов в foundation зону
 * паттерны автоматически обновляются
 */
const EFFECT_FP_FILE_PATTERNS = Object.entries(PACKAGE_ZONE_MAPPING)
  .filter(([_, zone]) => zone === 'foundation')
  .map(([packageName, _]) => `${packageName}/**/*.{ts,tsx}`);

export const effectFpNamingRules = [
  {
    files: EFFECT_FP_FILE_PATTERNS,
    ignores: ['**/generated/**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',

        // ==================== Типы (PascalCase) ====================
        { selector: 'class', format: ['PascalCase'] },
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },

        // ==================== Функции ====================
        // Все функции и методы: camelCase
        { selector: 'function', format: ['camelCase'] },
        { selector: 'method', format: ['camelCase'] },
        // Исключение для objectLiteralMethod: разрешаем snake_case для ключей, соответствующих union-типам
        // Это необходимо для Record<UnionType, Function>, где ключи должны точно соответствовать значениям union-типа
        {
          selector: 'objectLiteralMethod',
          filter: {
            // Разрешаем snake_case ключи (содержат подчеркивания) для соответствия union-типам
            regex: '^[a-z]+(_[a-z]+)+$',
            match: true,
          },
          format: null, // Отключаем проверку формата для таких ключей
        },

        // ==================== Переменные ====================
        // ErrorCode — доменная сущность (const enum-like object), разрешаем PascalCase (ПЕРЕД общим правилом)
        { selector: 'variable', filter: { regex: '^ErrorCode$', match: true }, format: ['PascalCase'], modifiers: ['const'] },
        // Brand symbols для branded types: PascalCase (IDBrand, ISODateBrand, TrustLevelBrand)
        { selector: 'variable', filter: { regex: '.*Brand$', match: true }, format: ['PascalCase'], modifiers: ['const'] },
        { selector: 'variable', format: ['camelCase'] },

        // Экспортируемые функции-константы Effect API: camelCase (приоритет над общим правилом для const)
        // Используем централизованный список EFFECT_API_FUNCTIONS для future-proofing
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase'],
          filter: {
            // Только для экспортируемых функций Effect API
            // 📌 При добавлении новых Effect API функций добавьте их в EFFECT_API_FUNCTIONS выше
            regex: `^(${EFFECT_API_FUNCTIONS.join('|')})$`,
            match: true,
          },
        },
        // Локальные const переменные внутри функций: camelCase (приоритет над общим правилом для const)
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase'],
          filter: {
            // Исключаем UPPER_CASE константы (они должны быть UPPER_CASE)
            regex: '^[A-Z_]+$',
            match: false,
          },
        },
        // ==================== Исключения (должны быть ПЕРЕД общими правилами) ====================
        { selector: 'method', filter: { regex: NAMING_EXCEPTIONS.PRISMA_METHODS, match: true }, format: null },
        { selector: 'method', filter: { regex: NAMING_EXCEPTIONS.GRAPHQL_AST_NODES, match: true }, format: null },
        { selector: 'variable', filter: { regex: NAMING_EXCEPTIONS.NODE_GLOBALS, match: true }, format: null },
        { selector: 'typeAlias', filter: { regex: NAMING_EXCEPTIONS.GRAPHQL_TYPES, match: true }, format: ['PascalCase'] },
        { selector: 'enum', filter: { regex: NAMING_EXCEPTIONS.GRAPHQL_ENUMS, match: true }, format: ['PascalCase'] },
        { selector: 'variable', filter: { regex: NAMING_EXCEPTIONS.REACT_COMPONENTS, match: true }, format: ['PascalCase'] },
        // Константы верхнего уровня: UPPER_CASE и PascalCase
        // Используем централизованную константу TOP_LEVEL_CONST_FORMATS для future-proofing
        {
          selector: 'variable',
          modifiers: ['const'],
          format: TOP_LEVEL_CONST_FORMATS,
          filter: {
            // Исключаем ErrorCode (обрабатывается отдельным правилом выше)
            regex: '^ErrorCode$',
            match: false,
          },
        },
      ],

      // Запрет default export для всех Effect/FP файлов
      'import/no-default-export': 'error',
    },
  },
];
