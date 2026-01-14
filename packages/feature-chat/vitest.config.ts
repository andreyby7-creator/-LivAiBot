import { createPackageVitestConfig } from '@livai/vitest-config/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/feature-chat
 *
 * Feature пакет: бизнес-логика чата с высокими требованиями качества
 * Контракт качества: 80% statements, 75% branches, 85% functions, 80% lines
 */
export default createPackageVitestConfig({
  packageName: '@livai/feature-chat',
  packageType: 'feature',
});
