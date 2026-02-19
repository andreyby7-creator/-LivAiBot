import { createPackageVitestConfig } from '@livai/vitest-config/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/domains-classification
 *
 * Domain implementation пакет: decision computing domain с максимальными требованиями качества
 * Контракт качества: 90% statements, 85% branches, 95% functions, 90% lines
 */
export const config = createPackageVitestConfig({
  packageName: '@livai/domains-classification',
  packageType: 'core',
});
