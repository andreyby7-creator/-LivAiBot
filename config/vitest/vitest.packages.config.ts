/**
 * @file Фабрика конфигураций Vitest для пакетов LivAI
 *
 * Контракт качества: строгие thresholds по типам пакетов
 * Масштабируемость: автоматическая настройка параллельности
 * Надежность: оптимизированные настройки для каждого типа пакетов
 */

import * as os from 'os';

/**
 * В Vitest 4 `defineConfig()` типизируется как `ViteUserConfigExport`, у которого нет поля `.test`.
 * Поэтому фабрика возвращает "плоский" объект конфигурации с явным `test`,
 * чтобы consumers могли безопасно делать `createPackageVitestConfig(...).test`.
 */
export type PackageVitestConfig = {
  test: Record<string, unknown>;
};

// ------------------ ТИПЫ И ИНТЕРФЕЙСЫ -----------------------------

export type PackageType = 'core' | 'feature' | 'ui' | 'shared' | 'app';

export interface PackageConfigOptions {
  packageName: string;
  packageType: PackageType;
  customExcludes?: string[];
  coverageThresholds?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

// ------------------ КОНСТАНТЫ КАЧЕСТВА - СТРОГИЕ THRESHOLDS ПО ТИПАМ ПАКЕТОВ -----------------------------

/**
 * Контракт качества: строгие thresholds для каждого типа пакетов.
 * Эти значения диктуют минимальный уровень качества кода в monorepo.
 *
 * Core пакеты: максимально строгие требования (фундамент системы)
 * Feature пакеты: высокие требования (бизнес-логика)
 * UI пакеты: умеренные требования (интерфейсная логика)
 * Shared пакеты: строгие требования (переиспользуемый код)
 * App пакеты: умеренные требования (прикладной код)
 */
const STRICT_QUALITY_CONTRACT = {
  core: {
    statements: 90,
    branches: 85,
    functions: 95,
    lines: 90,
  },
  feature: {
    statements: 80,
    branches: 75,
    functions: 85,
    lines: 80,
  },
  ui: {
    statements: 70,
    branches: 65,
    functions: 75,
    lines: 70,
  },
  shared: {
    statements: 85,
    branches: 80,
    functions: 90,
    lines: 85,
  },
  app: {
    statements: 75,
    branches: 70,
    functions: 80,
    lines: 75,
  },
} as const;

// Fallback thresholds для обратной совместимости
const DEFAULT_THRESHOLDS = {
  statements: 70,
  branches: 70,
  functions: 85,
  lines: 85,
} as const;

// ------------------ АВТОМАТИЧЕСКАЯ НАСТРОЙКА ПРОИЗВОДИТЕЛЬНОСТИ -----------------------------

/**
 * Автоматическая настройка параллельности на основе CPU
 * Оптимизирует использование ресурсов в CI и локальной разработке
 * С верхним лимитом для предотвращения перегрузки
 */
function getOptimalConcurrency(): number {
  const cpuCount = os.cpus().length;

  return process.env.CI === 'true'
    ? Math.min(8, Math.max(2, Math.floor(cpuCount / 2))) // В CI используем половину ядер для стабильности, но не больше 8
    : Math.min(8, Math.max(4, cpuCount)); // Локально используем все ядра для скорости, но не больше 8
}

/**
 * Автоматическая настройка потоков
 * Threads обеспечивают лучшую производительность для Node.js тестов
 */
const THREADING_CONFIG = {
  threads: true,
  isolate: true,
  maxConcurrency: getOptimalConcurrency(),
} as const;

// ------------------ БАЗОВЫЕ ЭКСКЛЮДЫ ПО ТИПАМ ПАКЕТОВ -----------------------------

/**
 * Стандартизированные exclude паттерны для coverage по типам пакетов
 * Уменьшают шум в отчетах и фокусируются на бизнес-логике
 */
const BASE_EXCLUDES = {
  core: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'tests/**/*',
    'src/**/index.ts',
    'src/**/types.ts',
    'src/**/interfaces/**/*.ts',
    'src/**/contracts/**/*.ts',
    'src/**/README.md',
    '**/*.d.ts',
    'src/fn/index.ts',
  ],
  feature: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'tests/**/*',
    'src/**/index.ts',
    'src/**/types.ts',
    'src/**/interfaces/**/*.ts',
    'src/**/contracts/**/*.ts',
    '**/*.d.ts',
  ],
  ui: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'tests/**/*',
    '**/*.d.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    'src/**/*.stories.ts',
    'src/**/*.stories.tsx',
    'src/**/stories/**',
  ],
  shared: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'tests/**/*',
    '**/*.d.ts',
  ],
  app: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'tests/**/*',
    '**/*.d.ts',
    'src/main.ts',
    'src/**/*.config.ts',
  ],
} as const;

// ------------------ ОПТИМИЗИРОВАННЫЕ НАСТРОЙКИ ПО ТИПАМ ПАКЕТОВ -----------------------------

/**
 * Специфические настройки окружения для разных типов пакетов
 * UI пакеты: jsdom для React компонентов
 * Остальные: Node.js для backend/библиотечного кода
 */
const ENVIRONMENT_CONFIGS = {
  ui: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        resources: 'usable', // Оптимизировано: только необходимые ресурсы для UI тестов
        url: 'http://localhost:3000',
        pretendToBeVisual: process.env.CI !== 'true', // Визуальный режим только в dev
      },
    },
  },
  core: {
    environment: 'node',
    environmentOptions: {
      node: {
        builtins: ['fs', 'path', 'crypto'],
      },
    },
  },
  feature: {
    environment: 'node',
    environmentOptions: {
      node: {
        builtins: ['fs', 'path', 'crypto'],
      },
    },
  },
  shared: {
    environment: 'node',
    environmentOptions: {
      node: {
        builtins: ['fs', 'path', 'crypto'],
      },
    },
  },
  app: {
    environment: 'node',
    environmentOptions: {
      node: {
        builtins: ['fs', 'path', 'crypto'],
      },
    },
  },
} as const;

// ------------------ ФАБРИКА КОНФИГУРАЦИЙ ПАКЕТОВ -----------------------------

/**
 * Создает оптимизированную конфигурацию Vitest для пакетов LivAI
 *
 * Архитектурные принципы:
 * - Контракт качества через строгие thresholds
 * - Автоматическая оптимизация производительности
 * - Типизированная конфигурация для надежности
 * - Масштабируемость через декларативный подход
 *
 * @param options - Настройки пакета с типизацией
 * @returns Оптимизированная конфигурация Vitest
 */
export function createPackageVitestConfig(options: PackageConfigOptions): PackageVitestConfig {
  const { packageName, packageType, customExcludes = [], coverageThresholds } = options;

  // Выбор thresholds: custom > strict contract > default
  const thresholds = coverageThresholds
    ?? STRICT_QUALITY_CONTRACT[packageType]
    ?? DEFAULT_THRESHOLDS;

  // Комбинированные exclude паттерны с защитой от неизвестных типов
  const baseExcludes = BASE_EXCLUDES[packageType] ?? [];
  const allExcludes = [...baseExcludes, ...customExcludes];

  // Конфигурация окружения для типа пакета
  const envConfig = ENVIRONMENT_CONFIGS[packageType];

  return {
    test: {
      // Идентификация пакета для отчетов
      name: packageName,

      // Глобальные переменные Vitest
      globals: true,

      // Оптимизированные настройки производительности
      ...THREADING_CONFIG,

      // Таймауты: строже в CI для выявления проблем производительности
      testTimeout: process.env.CI === 'true' ? 30000 : 60000,
      hookTimeout: process.env.CI === 'true' ? 10000 : 30000,

      // Watch режим только в разработке
      watch: process.env.CI !== 'true',

      // Настройки окружения
      // ВНИМАНИЕ: если env содержит readonly/замороженные объекты,
      // Vitest может падать. Используйте копию: { ...env }
      ...envConfig,

      // Setup файлы: только пакетный (глобальный setup настраивается отдельно)
      setupFiles: [
        './vitest.setup.ts',
      ],

      // Паттерны поиска тестов (расширен для поддержки всех типов файлов)
      include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}', 'tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      exclude: ['dist/**', 'node_modules/**', 'e2e/**'],

      // Повторы для flaky тестов: больше в CI
      retry: process.env.CI === 'true' ? 3 : 1,

      // Покрытие кода с расширенными репортерами
      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'json', 'lcov'], // Добавлен lcov для CI/CD интеграции
        reportsDirectory: './coverage',
        include: ['src/**/*.ts'],
        exclude: allExcludes,
        excludeAfterRemap: true, // Корректная обработка sourcemaps
        clean: true,
        cleanOnRerun: true,
        // Thresholds применяются только в CI для соблюдения контракта качества
        ...(process.env.CI === 'true' ? { thresholds } : {}),
      },

      // Логирование: детальное в dev, минимальное в CI
      silent: process.env.CI === 'true',

      // Не считать отсутствие тестов ошибкой
      passWithNoTests: true,

      // Разрешать .only в dev для отладки, запрещать в CI
      allowOnly: process.env.CI !== 'true',

      // Не останавливаться после первой ошибки для полного отчета
      bail: 0,

      // Оптимизации для CI
      disableConsoleIntercept: process.env.CI === 'true',
      slowTestThreshold: process.env.CI === 'true' ? 1000 : 300,
    },
  };
}

// ------------------ ЭКСПОРТЫ ДЛЯ РАСШИРЕНИЯ -----------------------------

export {
  BASE_EXCLUDES,
  DEFAULT_THRESHOLDS,
  getOptimalConcurrency,
  STRICT_QUALITY_CONTRACT,
  THREADING_CONFIG,
};
