/**
 * @file Архитектурные границы ESLint для LivAi
 *
 * Zone-based architecture enforcement для LivAi.
 * Динамическая генерация правил на основе зон из check-zones.mjs.
 * Effect-TS aware с поддержкой type-only imports.
 *
 * @see {@link ./utils/check-zones.mjs} - определение зон и маппинг пакетов
 * @see {@link ./utils/validate-zones.mjs} - валидация конфигурации зон
 */

// Импорт данных зон из check-zones.mjs для синхронизации
import { PACKAGE_ZONE_MAPPING } from '../utils/check-zones.mjs';

// Domain-specific правила интегрированы в master.config.mjs
// Architectural-boundaries.mjs фокусируется только на границах импортов

// ==================== АРХИТЕКТУРНЫЕ ЗОНЫ LIVAI ====================
/**
 * Карта зон LivAi и их разрешенных зависимостей
 * Соответствует архитектуре из check-zones.mjs
 * Effect-TS aware: foundation может импортироваться везде
 */
const LAYERS = {
  // foundation: contracts, core, events, observability - может импортироваться везде
  foundation: [],
  // aiExecution: AI бизнес-логика (feature-*) - только foundation
  aiExecution: ['foundation'],
  // infrastructure: инфраструктурные компоненты - foundation + aiExecution
  infrastructure: ['foundation', 'aiExecution'],
  // ui: пользовательский интерфейс (ui-*) - foundation + aiExecution
  ui: ['foundation', 'aiExecution'],
  // apps: приложения - все зоны кроме прямой инфраструктуры
  apps: ['foundation', 'aiExecution', 'ui'],
};

// ==================== ГЕНЕРАЦИЯ ПРАВИЛ АРХИТЕКТУРНЫХ ГРАНИЦ ====================
/**
 * Генерирует правила архитектурных границ на основе LAYERS map
 * Effect-TS aware: разрешает type imports для контрактов и Effect типов
 */
function generateArchitecturalBoundaries() {
  return Object.entries(LAYERS).map(([layer, allowed]) => {
    // Пути к файлам зоны
    const layerPaths = getLayerFilePatterns(layer);

    return {
      files: layerPaths,
      ignores: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        // Zod-валидация — frontend/runtime guard, разрешаем импорт runtime-зависимостей.
        // Архитектурные границы между пакетами/зонами здесь не применяем.
        ...(layer === 'foundation'
          ? ['packages/core-contracts/src/validation/zod/**/*.{ts,tsx}']
          : []),
      ],
      rules: {
        // Архитектурные ограничения импортов
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              // Запрещаем импорты из всех зон кроме разрешенных
              {
                group: ['**/*'], // все остальные зоны
                message: `Зона "${layer}" может импортировать только из: ${allowed.join(', ') || 'ничего (foundation)'}`,
              },
            ],
            paths: [
              // Разрешаем type imports из разрешенных зон
              ...allowed.map(allowedLayer => ({
                name: `../${allowedLayer}/**`,
                importNames: [], // все импорты
                message: `Из зоны "${layer}" разрешены только type imports из "${allowedLayer}"`,
                allowTypeImports: true,
              })),
              // Effect-TS типы всегда разрешены (type-only)
              {
                name: 'effect',
                importNames: [],
                message: 'Effect типы разрешены (type-only imports)',
                allowTypeImports: true,
              },
            ],
          },
        ],
      },
    };
  });
}

/**
 * Получает паттерны файлов для зоны LivAiBot
 * Динамически генерируется из PACKAGE_ZONE_MAPPING для 100% синхронизации
 * с реальной архитектурой проекта
 *
 * @param {string} layer - имя зоны (foundation, aiExecution, ui, apps, infrastructure)
 * @returns {string[]} массив glob паттернов для файлов зоны
 */
function getLayerFilePatterns(layer) {
  const patterns = [];

  // Генерируем паттерны из PACKAGE_ZONE_MAPPING
  for (const [packageName, packageZone] of Object.entries(PACKAGE_ZONE_MAPPING)) {
    if (packageZone === layer) {
      patterns.push(`${packageName}/**/*.{ts,tsx}`);
    }
  }

  // Специальные паттерны для зон без explicit пакетов
  if (layer === 'infrastructure') {
    patterns.push('infrastructure/**/*.{ts,tsx}');
    patterns.push('services/**/*.{ts,tsx}');
  }

  // Если паттерны не найдены, используем fallback и логируем предупреждение
  if (patterns.length === 0) {
    const fallbackPattern = `packages/${layer}/**/*.{ts,tsx}`;
    console.warn(`⚠️  Zone "${layer}" has no packages in PACKAGE_ZONE_MAPPING, using fallback pattern: ${fallbackPattern}`);
    console.warn(`   💡 Add packages to this zone in PACKAGE_ZONE_MAPPING (check-zones.mjs) or update zone configuration`);
    return [fallbackPattern];
  }

  return patterns;
}

// ==================== АРХИТЕКТУРНЫЕ ПРАВИЛА ====================
/**
 * Автоматически сгенерированные правила архитектурных границ
 * Effect-TS aware с поддержкой type-only imports
 */
export const architecturalBoundariesRules = generateArchitecturalBoundaries();

// ==================== ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ====================

/**
 * Правила обнаружения циклических зависимостей
 * Предотвращает архитектурные проблемы с циклами импортов
 * Увеличенная глубина для большого монорепо
 */
export const cyclicDependencyRules = {
  files: ['**/*.{ts,tsx}'],
  ignores: ['**/*.generated.{ts,tsx}', '**/node_modules/**'],
  plugins: {
    /** @type {any} */
    import: (await import('eslint-plugin-import')).default,
  },
  rules: {
    'import/no-cycle': [
      'error',
      {
        maxDepth: 7, // увеличено для большого монорепо с зонами
        ignoreExternal: true,
        allowUnsafeDynamicCyclicDependency: false,
      },
    ],
  },
};


/**
 * Zone-aware правила безопасности
 * Ограничения применяются только к зонам, где они уместны
 */
export const zoneAwareSecurityRules = [
  // Правила для всех зон КРОМЕ infrastructure
  {
    files: [
      'packages/**/*.{ts,tsx,js,jsx}',
      'apps/**/*.{ts,tsx,js,jsx}',
    ],
    ignores: [
      '**/infrastructure/**/*.{ts,tsx,js,jsx}',
      'services/**/*.{ts,tsx,js,jsx}',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/scripts/**',
      '**/tools/**',
      '**/*.config.{ts,js}',
      '**/generated/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // File system access - запрещено вне infrastructure зоны
            {
              group: ['fs', 'fs/promises', 'node:fs', 'node:fs/promises'],
              message: 'Прямой доступ к файловой системе разрешен только в infrastructure зоне.',
            },
          ],
          paths: [
            // Process execution - запрещено вне infrastructure зоны
            {
              name: 'child_process',
              message: 'Прямое выполнение процессов разрешено только в infrastructure зоне.',
            },
            {
              name: 'node:child_process',
              message: 'Прямое выполнение процессов разрешено только в infrastructure зоне.',
            },
          ],
        },
      ],
    },
  },
];

/**
 * Глобальные правила безопасности
 * Применяются ко всем файлам без исключений
 */
export const globalSecurityRules = {
  files: ['**/*.{ts,tsx,js,jsx}'],
  ignores: [
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    '**/scripts/**',
    '**/tools/**',
    '**/*.config.{ts,js}',
    '**/generated/**',
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // Direct database access outside infrastructure
          {
            group: ['@prisma/client'],
            message: 'Прямой доступ к Prisma клиенту разрешен только в инфраструктурном слое.',
          },
        ],
      },
    ],
    // Критические правила безопасности - всегда запрещены
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
};

/**
 * Устаревшие импорты - предупреждения о deprecated пакетах
 * Помогает поддерживать актуальный технологический стек
 */
export const deprecatedImportsRules = {
  files: ['**/*.{ts,tsx}'],
  ignores: ['**/node_modules/**', '**/generated/**'],
  rules: {
    'no-restricted-imports': [
      'warn',
      {
        paths: [
          {
            name: 'moment',
            message: 'Используйте date-fns вместо moment.js. Moment.js устарел и тяжелый.',
          },
          {
            name: 'request',
            message: 'Используйте axios или native fetch. Пакет request устарел.',
          },
          {
            name: 'lodash',
            message:
              'Используйте lodash-es для tree-shaking. Импортируйте конкретные функции: import { map } from "lodash-es"',
          },
        ],
      },
    ],
  },
};

// ==================== ФИНАЛЬНАЯ КОНФИГУРАЦИЯ ====================

/**
 * Полная конфигурация архитектурных границ LivAiBot
 * Автоматически генерируется на основе зон и их зависимостей
 */
/** @type {any[]} */
export default [
  // Архитектурные границы (генерируются динамически)
  ...architecturalBoundariesRules,

  // Zone-aware правила безопасности
  ...zoneAwareSecurityRules,

  // Глобальные правила безопасности
  globalSecurityRules,

  // Дополнительные правила качества
  cyclicDependencyRules,
  deprecatedImportsRules,
];
