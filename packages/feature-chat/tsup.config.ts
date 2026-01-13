import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'node', // Бизнес-логика чата
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist/esm',
  dts: false, // tsc генерирует .d.ts через tsconfig.build.json
  splitting: false,
  sourcemap: false, // Отключаем sourcemaps для скорости продакшена
  clean: false, // Не удаляем .d.ts файлы от tsc
  treeshake: false, // Отключаем treeshake для скорости
  minify: false, // Не минифицируем для скорости
  external: ['effect', 'ulidx'], // Фундаментальные зависимости должны оставаться внешними
});
