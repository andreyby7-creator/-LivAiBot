import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false, // Explicit imports for library code - better practices
    environment: 'node',
    environmentOptions: {
      node: {
        builtins: ['fs', 'path', 'crypto'], // Explicit Node.js builtins for contracts
      },
    },
    setupFiles: ['../config/vitest/test.setup.ts', './vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 10000,
    coverage: {
      enabled: true, // Explicitly enable coverage for consistent behavior in CI/local
      provider: 'v8',
      reporter: ['text', 'json'], // Removed 'html' to avoid linting issues with generated files
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'tests/**/*',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/**/interfaces/**/*.ts',
        'src/**/contracts/**/*.ts',
        'src/**/README.md',
        // TypeScript-only types - compile-time only, no runtime logic
        '**/*.d.ts',
        // Interfaces - compile-time contracts only
        'src/fn/index.ts',
      ],
      clean: true,
      cleanOnRerun: true,
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 85,
        lines: 85,
      },
    },
  },
});
