import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

/**
 * Конфигурация Vitest для @livai/app
 *
 * App пакет: прикладной код с умеренными требованиями качества
 * Контракт качества: 75% statements, 70% branches, 80% functions, 75% lines
 *
 * Особенности: содержит React компоненты, поэтому используем jsdom environment
 */
export default createPackageVitestConfig({
  packageName: '@livai/app',
  packageType: 'ui', // Используем 'ui' тип для jsdom environment
});
