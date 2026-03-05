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
    clean: false, // Не удаляем .d.ts файлы от tsc (build:types)
    platform: 'node',
    dts: false,
    outDir: 'dist',
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
      'lib/service-worker': 'src/lib/service-worker.ts',
      'lib/telemetry-runtime': 'src/lib/telemetry-runtime.ts',
      'providers/intl-provider': 'src/providers/intl-provider.tsx',
    },
    format: ['esm'],
    target: 'es2022',
    splitting: false, // Без splitting для subpath - должен быть прямым файлом
    minify: false,
    sourcemap: true,
    platform: 'node',
    dts: true, // Генерируем .d.ts для subpath exports
    outDir: 'dist',
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
