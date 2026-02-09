import { createPackageVitestConfig } from '@livai/vitest-config/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/core
 *
 * Core пакет: доменная бизнес-логика с максимальными требованиями качества
 * Контракт качества: 90% statements, 85% branches, 95% functions, 90% lines
 */
export const config = createPackageVitestConfig({
  packageName: '@livai/core',
  packageType: 'core',
});
