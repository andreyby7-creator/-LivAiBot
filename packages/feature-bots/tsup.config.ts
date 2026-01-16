import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'node', // Бизнес-логика ботов
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  treeshake: false,
  minify: false,
  external: ['effect', 'ulidx'],
});
