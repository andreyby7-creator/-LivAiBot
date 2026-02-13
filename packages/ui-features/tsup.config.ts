import { defineConfig } from 'tsup';

export default defineConfig([
  // Основной entry point
  {
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
  },
  // Subpath exports для избежания загрузки всего index.ts
  {
    target: 'es2024',
    platform: 'browser',
    entry: {
      'auth/login-form': 'src/auth/login-form.tsx',
      'auth/register-form': 'src/auth/register-form.tsx',
    },
    format: ['esm'],
    outDir: 'dist/esm',
    dts: true,
    splitting: false, // Без splitting для subpath - должен быть прямым файлом
    sourcemap: false,
    clean: false, // Не чистим, т.к. основной entry point уже очистил
    treeshake: true,
    minify: true,
    external: ['react', 'react-dom'],
  },
]);
