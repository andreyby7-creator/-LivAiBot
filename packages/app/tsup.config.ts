import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',

  // ВАЖНО: библиотечный режим для Next.js (backend/domain пакет)
  splitting: true, // разбивает на модули
  minify: false, // никакой минификации
  sourcemap: true,
  clean: true,

  platform: 'node', // backend/domain пакет с Node.js модулями (events, etc)
  dts: true,

  outDir: 'dist/esm',

  external: [
    'react',
    'react-dom',
    'next',
    // Node.js core модули (backend пакет)
    'events',
    'fs',
    'path',
    'crypto',
    'stream',
    'http',
    'https',
  ],
});
