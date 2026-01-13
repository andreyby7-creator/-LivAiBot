import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/feature-auth
 *
 * Feature пакет: бизнес-логика аутентификации с высокими требованиями качества
 * Контракт качества: 80% statements, 75% branches, 85% functions, 80% lines
 */
export default createPackageVitestConfig({
  packageName: '@livai/feature-auth',
  packageType: 'feature',
});
