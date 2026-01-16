// Node
import { resolve } from 'path';
import { fileURLToPath } from 'url';
// External
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Internal
import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

/**
 * Конфигурация Vitest для @livai/web
 *
 * Next.js приложение с уникальными требованиями тестирования:
 * - jsdom для React компонентов
 * - Next.js специфические моки
 * - Собственные thresholds для frontend-приложения
 */
export default defineConfig({
  plugins: [tsconfigPaths()],

  test: {
    // Базовые унифицированные настройки от фабрики пакетов
    ...createPackageVitestConfig({
      packageName: '@livai/web',
      packageType: 'app',
    }).test,

    // Переопределяем специфичные для приложения настройки
    globals: true,
    environment: 'jsdom', // Браузерная среда для React компонентов
    setupFiles: [
      '../../config/vitest/package.setup.js', // Базовый setup (включает cleanup)
      './vitest.setup.ts', // Специфичные моки Next.js
    ],
    include: [
      'src/**/*.{test}.{ts,tsx}',
      'tests/**/*.{test}.{ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'coverage/**',
      // Исключаем e2e тесты Playwright
      '../../e2e/**',
      '../../**/e2e/**',
      '../../config/playwright/**',
    ],

    // Специфичные thresholds для веб-приложения
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'i18n/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/app/**', // Next.js app директория - в основном boilerplate
        'src/pages/**', // Next.js pages директория - legacy routing
      ],
      excludeAfterRemap: true, // Унаследовано от фабрики
      clean: true,
      cleanOnRerun: true,
      // Специфичные thresholds для веб-приложения (более мягкие)
      // Применяются только в CI из-за exactOptionalPropertyTypes
      ...(process.env['CI'] === 'true' && {
        thresholds: {
          statements: 70,
          branches: 65,
          functions: 75,
          lines: 70,
        },
      }),
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'), // Next.js специфичный alias
    },
  },
});
