import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024',
  platform: 'neutral', // Domain implementation - используется везде (node, web, edge)
  entry: {
    index: 'src/index.ts',
    // TODO: Добавить когда classification domain будет реализован
    // 'classification/index': 'src/classification/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  minify: true,
  external: ['effect'],
});
