import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'browser', // Базовые UI компоненты
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: false, // Не удаляем .d.ts файлы от tsc (build:types)
  treeshake: true, // Tree shaking для уменьшения размера бандла
  minify: true, // Минификация для продакшена
  external: ['react', 'react-dom'], // React не бандлится - peer dependency для tree shaking в consuming apps
});
