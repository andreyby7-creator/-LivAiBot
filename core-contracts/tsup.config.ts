import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Match tsconfig target to avoid unnecessary transformations
  platform: 'node', // Core contracts use Node.js crypto module for correlation IDs
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: false, // tsc handles .d.ts via tsconfig.build.json
  splitting: false,
  sourcemap: false, // Отключаем sourcemaps для скорости продакшена
  clean: false, // Don't delete .d.ts from tsc
  treeshake: false, // Отключаем treeshake для скорости
  minify: false, // Не минифицируем для скорости
  external: ['effect', 'ulidx'], // Foundation dependencies must remain external
});
