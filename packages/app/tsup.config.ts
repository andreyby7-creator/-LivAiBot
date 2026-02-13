import { defineConfig } from 'tsup';

export default defineConfig([
  // Основной entry point с splitting
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'es2022',
    splitting: true, // разбивает на модули
    minify: false,
    sourcemap: true,
    clean: true,
    platform: 'node',
    dts: true,
    outDir: 'dist/esm',
    external: [
      'react',
      'react-dom',
      'next',
      'events',
      'fs',
      'path',
      'crypto',
      'stream',
      'http',
      'https',
    ],
  },
  // Subpath exports без splitting (прямые файлы)
  {
    entry: {
      'lib/error-mapping': 'src/lib/error-mapping.ts',
      'lib/service-worker': 'src/lib/service-worker.ts',
      'runtime/telemetry': 'src/runtime/telemetry.ts',
      'providers/intl-provider': 'src/providers/intl-provider.tsx',
    },
    format: ['esm'],
    target: 'es2022',
    splitting: false, // Без splitting для subpath - должен быть прямым файлом
    minify: false,
    sourcemap: true,
    platform: 'node',
    dts: true,
    outDir: 'dist/esm',
    external: [
      'react',
      'react-dom',
      'next',
      'events',
      'fs',
      'path',
      'crypto',
      'stream',
      'http',
      'https',
    ],
  },
]);
