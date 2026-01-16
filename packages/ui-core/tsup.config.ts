import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'browser', // Базовые UI компоненты
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: true, // Генерируем .d.ts файлы вместе с JS
  splitting: false,
  sourcemap: false, // Для продакшена sourcemaps не нужны
  clean: true, // Чистим dist перед сборкой для предотвращения накопления старых файлов
  treeshake: true, // Tree shaking для уменьшения размера бандла
  minify: true, // Минификация для продакшена
  external: ['react', 'react-dom'], // React не бандлится - peer dependency для tree shaking в consuming apps
});
