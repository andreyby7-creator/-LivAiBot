import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/ui-shared
 *
 * UI пакет: переиспользуемые компоненты с умеренными требованиями качества
 * Контракт качества: 70% statements, 65% branches, 75% functions, 70% lines
 */
export default createPackageVitestConfig({
  packageName: '@livai/ui-shared',
  packageType: 'ui',
});
