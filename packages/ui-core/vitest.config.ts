import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Конфигурация Vitest для @livai/ui-core
 * UI пакет: базовые UI компоненты с умеренными требованиями качества
 *
 * Production-конфигурация для UI библиотек:
 * Тестируем через dist (скомпилированные файлы) - проще и стабильнее для monorepo
 *
 * Преимущества dist-подхода:
 * - Билд уже использует automatic JSX runtime (проверено в dist/index.js)
 * - Нет проблем с esbuild настройками для исходников
 * - Стабильнее на CI и для покрытия типов
 * - Соответствует production-окружению
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Используем dist для тестов - стабильнее для monorepo
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: [
      '../../config/vitest/test.setup.ts',
      './vitest.setup.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      // Coverage для исходников, но тесты используют dist
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'tests/**/*',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        'src/**/*.stories.ts',
        'src/**/*.stories.tsx',
        'src/**/stories/**',
      ],
    },
  },
  resolve: {
    alias: {
      // Критично: импорты из @livai/ui-core резолвятся в dist, а не src
      // Это позволяет тестировать production-сборку
      '@livai/ui-core': path.resolve(__dirname, './dist'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  // esbuild настройки для компиляции тестовых файлов (не исходников)
  // Тестовые файлы все еще компилируются через esbuild, поэтому нужен automatic JSX runtime
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    target: 'esnext',
  },
});
