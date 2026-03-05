import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2024', // Совпадает с target в tsconfig для избежания лишних трансформаций
  platform: 'browser', // Базовые UI компоненты
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: false, // Не удаляем .d.ts файлы от tsc (build:types)
  treeshake: true, // Tree shaking для уменьшения размера бандла
  minify: false, // Временно отключено для диагностики JSX transform
  external: ['react', 'react-dom', 'react/jsx-runtime'], // React не бандлится - peer dependency для tree shaking в consuming apps
  // Используем tsconfig.build.json, который не наследует strict.json с jsx: "react-jsx"
  // Это позволяет esbuild правильно применять automatic JSX transform
  tsconfig: './tsconfig.build.json',
  // Критично: loader для .tsx файлов на уровне tsup, чтобы esbuild распознал JSX
  // Без этого esbuild может использовать ts loader вместо tsx, и JSX transform не применится
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  esbuildOptions(options) {
    // Используем новый JSX transform (react-jsx) вместо старого (React.createElement)
    // automatic runtime использует react/jsx-runtime вместо React.createElement
    // Это критично для production UI-библиотеки
    // TypeScript с jsx: "preserve" не трогает JSX, esbuild делает transform
    options.jsx = 'automatic';
    options.jsxImportSource = 'react';
    options.jsxDev = false;
    // Критично: loader должен быть и в esbuildOptions, иногда tsup игнорирует верхний уровень
    options.loader = {
      '.ts': 'ts',
      '.tsx': 'tsx',
    };
  },
});
