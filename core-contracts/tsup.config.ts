import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Match tsconfig target to avoid unnecessary transformations
  platform: 'neutral', // Core contracts are platform-agnostic, work in any environment
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: false, // tsc handles .d.ts via tsconfig.build.json
  splitting: false,
  sourcemap: true,
  clean: false, // Don't delete .d.ts from tsc
  treeshake: true,
  external: ['effect', 'ulidx'], // Foundation dependencies must remain external
});
