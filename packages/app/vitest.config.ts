import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/app
 *
 * App пакет: прикладной код с умеренными требованиями качества
 * Контракт качества: 75% statements, 70% branches, 80% functions, 75% lines
 */
export default createPackageVitestConfig({
  packageName: '@livai/app',
  packageType: 'app',
});
