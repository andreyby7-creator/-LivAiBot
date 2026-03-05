import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024',
  platform: 'neutral', // Domain implementation - используется везде (node, web, edge)
  entry: {
    index: 'src/index.ts',
    'classification/signals/index': 'src/classification/signals/index.ts',
    'classification/strategies/index': 'src/classification/strategies/index.ts',
    'classification/policies/index': 'src/classification/policies/index.ts',
    'classification/aggregation/index': 'src/classification/aggregation/index.ts',
    'classification/labels': 'src/classification/labels.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: false, // Не удаляем .d.ts файлы от tsc (build:types)
  treeshake: true,
  minify: true,
  external: ['effect'],
});
