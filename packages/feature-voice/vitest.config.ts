import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/feature-voice
 *
 * Feature пакет: бизнес-логика голосовых функций с высокими требованиями качества
 * Контракт качества: 80% statements, 75% branches, 85% functions, 80% lines
 */
export default createPackageVitestConfig({
  packageName: '@livai/feature-voice',
  packageType: 'feature',
});
