import { createPackageVitestConfig } from '../../config/vitest/vitest.packages.config.js';

// Защита от случайного запуска bench с test-конфигом
if (process.argv.includes('bench')) {
  process.stderr.write(
    '❌ Bench must be run with vitest.bench.config.ts, not vitest.config.ts\n'
      + 'Use: pnpm run bench\n',
  );
  process.exit(1);
}

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
