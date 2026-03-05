import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'neutral', // Бизнес-логика аутентификации (используется в web)
  entry: {
    index: 'src/index.ts',
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
