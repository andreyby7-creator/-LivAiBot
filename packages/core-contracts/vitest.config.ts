import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/core-contracts
 *
 * Core пакет: фундаментальная библиотека с максимальными требованиями качества
 * Контракт качества: 90% statements, 85% branches, 95% functions, 90% lines
 */
export default createPackageVitestConfig({
  packageName: '@livai/core-contracts',
  packageType: 'core',
});
