import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024',
  platform: 'neutral', // Domain logic - используется везде (node, web, edge)
  entry: {
    index: 'src/index.ts',
    'domain-kit/index': 'src/domain-kit/index.ts',
    'effect/index': 'src/effect/index.ts',
    'effect/offline-cache': 'src/effect/offline-cache.ts',
    hash: 'src/hash.ts',
    'feature-flags/index': 'src/feature-flags/index.ts',
    'telemetry/index': 'src/telemetry/index.ts',
    'telemetry/batch-core': 'src/telemetry/batch-core.ts',
    'telemetry/client': 'src/telemetry/client.ts',
    'transport/index': 'src/transport/index.ts',
    'performance/index': 'src/performance/index.ts',
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
