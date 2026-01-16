import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'neutral', // Next.js композиция и утилиты (используется в web)
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: true, // Генерируем .d.ts вместе с JS (как в ui-* пакетах)
  splitting: false,
  sourcemap: false, // Для продакшена sourcemaps не нужны
  clean: true, // Чистим dist перед сборкой
  treeshake: true,
  minify: true,
  external: ['react', 'react-dom', 'next'],
});
