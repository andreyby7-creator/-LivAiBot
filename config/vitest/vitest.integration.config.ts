import { defineConfig } from 'vitest/config';
import { createPackageVitestConfig } from './vitest.packages.config.js';

/**
 * Конфигурация Vitest для интеграционных тестов LivAI
 *
 * Использует фабрику конфигураций пакетов для интеграционных сценариев
 * с настройками для мульти-пакетного тестирования
 */
export default defineConfig({
  ...createPackageVitestConfig({
    packageName: '@livai/integration-tests',
    packageType: 'core', // строгие требования для интеграционных тестов
  }),
  test: {
    // Глобальные API доступны без импорта
    globals: true,

    // Переопределения для интеграционных тестов
    include: [
      'packages/**/tests/integration/**/*.test.{ts,tsx}',
      'packages/**/tests/**/*.integration.test.{ts,tsx}',
      'apps/**/tests/integration/**/*.test.{ts,tsx}',
      // Поддержка для одиночных файлов (как в test:file)
      'packages/**/*.test.{ts,tsx}',
      'apps/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'packages/**/tests/unit/**',
      'apps/**/tests/unit/**',
      'e2e/**',
      '**/e2e/**',
      'config/playwright/**',
      '**/playwright-report/**',
      'packages/**/tests/**/*.spec.{ts,tsx}',
      '**/node_modules/**',
    ],
    // Интеграционные тесты могут быть медленнее
    testTimeout: 30000,
    hookTimeout: 10000,
    // Меньше параллельности для стабильности
    maxConcurrency: 2,
  },
});
